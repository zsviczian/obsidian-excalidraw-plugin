import { Notice, TFile } from "obsidian";
import ExcalidrawPlugin from "src/main";

//@ts-ignore
const DB_NAME = "Excalidraw " + app.appId;
const CACHE_STORE = "imageCache";
const BACKUP_STORE = "drawingBAK";

type FileCacheData = { mtime: number; imageBase64: string };
type BackupData = string;
type BackupKey = string;

type ImageKey = {
  filepath: string;
  blockref: string;
  sectionref: string;
  isDark: boolean;
  isSVG: boolean;
  scale: number;
};

const getKey = (key: ImageKey): string =>
  `${key.filepath}#${key.blockref}#${key.sectionref}#${key.isDark ? 1 : 0}#${key.isSVG ? 1 : 0}#${key.scale}`;

class ImageCache {
  private dbName: string;
  private cacheStoreName: string;
  private backupStoreName: string;
  private db: IDBDatabase | null;
  private isInitializing: boolean;
  public plugin: ExcalidrawPlugin;
  public initializationNotice: boolean = false;

  constructor(dbName: string, cacheStoreName: string, backupStoreName: string) {
    this.dbName = dbName;
    this.cacheStoreName = cacheStoreName;
    this.backupStoreName = backupStoreName;
    this.db = null;
    this.isInitializing = false;
    this.plugin = null;
    app.workspace.onLayoutReady(() => this.initializeDB());
  }

  private async initializeDB(): Promise<void> {
    if (this.isInitializing || this.db !== null) {
      return;
    }

    this.isInitializing = true;

    try {
      const request = indexedDB.open(this.dbName);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.cacheStoreName)) {
          db.createObjectStore(this.cacheStoreName);
        }
        if (!db.objectStoreNames.contains(this.backupStoreName)) {
          db.createObjectStore(this.backupStoreName);
        }
      };

      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = (event: Event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          resolve(db);
        };

        request.onerror = () => {
          reject(new Error(`Failed to open or create IndexedDB database: ${this.dbName}`));
        };
      });

      // Pre-create the object stores to reduce delay when accessing them later
      if (
        !this.db.objectStoreNames.contains(this.cacheStoreName) ||
        !this.db.objectStoreNames.contains(this.backupStoreName)
      ) {
        const version = this.db.version + 1;
        this.db.close();

        const upgradeRequest = indexedDB.open(this.dbName, version);
        upgradeRequest.onupgradeneeded = (event: IDBVersionChangeEvent) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(this.cacheStoreName)) {
            db.createObjectStore(this.cacheStoreName);
          }
          if (!db.objectStoreNames.contains(this.backupStoreName)) {
            db.createObjectStore(this.backupStoreName);
          }
        };

        await new Promise<void>((resolve, reject) => {
          upgradeRequest.onsuccess = () => {
            const db = upgradeRequest.result as IDBDatabase;
            db.close();
            resolve();
          };

          upgradeRequest.onerror = () => {
            reject(new Error(`Failed to upgrade IndexedDB database: ${this.dbName}`));
          };
        });

        this.db = await new Promise<IDBDatabase>((resolve, reject) => {
          const openRequest = indexedDB.open(this.dbName);
          openRequest.onsuccess = () => {
            const db = openRequest.result as IDBDatabase;
            resolve(db);
          };
          openRequest.onerror = () => {
            reject(new Error(`Failed to open IndexedDB database: ${this.dbName}`));
          };
        });
      }

      await this.purgeInvalidCacheFiles();
      await this.purgeInvalidBackupFiles();
    } finally {
      this.isInitializing = false;
      if(this.initializationNotice) {
        new Notice("Excalidraw Image Cache is Initialized - You may now retry opening your damaged drawing.");
        this.initializationNotice = false;
      }
      console.log("Initialized Excalidraw Image Cache");
    }
  }

  private async purgeInvalidCacheFiles(): Promise<void> {
    const transaction = this.db!.transaction(this.cacheStoreName, "readwrite");
    const store = transaction.objectStore(this.cacheStoreName);
    const files = app.vault.getFiles();

    const deletePromises: Promise<void>[] = [];

    const request = store.openCursor();
    return new Promise<void>((resolve, reject) => {
      request.onsuccess = (event: Event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          const key = cursor.key as string;
          const filepath = key.split("#")[0];
          const fileExists = files.some((f: TFile) => f.path === filepath);
          const file = fileExists ? files.find((f: TFile) => f.path === filepath) : null;
          if (!file || (file && file.stat.mtime > cursor.value.mtime)) {
            deletePromises.push(
              new Promise<void>((resolve, reject) => {
                const deleteRequest = store.delete(cursor.primaryKey);
                deleteRequest.onsuccess = () => resolve();
                deleteRequest.onerror = () =>
                  reject(new Error(`Failed to delete file with key: ${key}`));
              })
            );
          }
          cursor.continue();
        } else {
          Promise.all(deletePromises)
            .then(() => resolve())
            .catch((error) => reject(error));
        }
      };

      request.onerror = () => {
        reject(new Error("Failed to purge invalid files from IndexedDB."));
      };
    });
  }

  private async purgeInvalidBackupFiles(): Promise<void> {
    const transaction = this.db!.transaction(this.backupStoreName, "readwrite");
    const store = transaction.objectStore(this.backupStoreName);
    const files = app.vault.getFiles();
  
    const deletePromises: Promise<void>[] = [];
  
    const request = store.openCursor();
    return new Promise<void>((resolve, reject) => {
      request.onsuccess = (event: Event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          const key = cursor.key as BackupKey;
          const fileExists = files.some((f: TFile) => f.path === key);
          if (!fileExists) {
            deletePromises.push(
              new Promise<void>((resolve, reject) => {
                const deleteRequest = store.delete(cursor.primaryKey);
                deleteRequest.onsuccess = () => resolve();
                deleteRequest.onerror = () =>
                  reject(new Error(`Failed to delete backup file with key: ${key}`));
              })
            );
          }
          cursor.continue();
        } else {
          Promise.all(deletePromises)
            .then(() => resolve())
            .catch((error) => reject(error));
        }
      };
  
      request.onerror = () => {
        reject(new Error("Failed to purge invalid backup files from IndexedDB."));
      };
    });
  }

  private async getObjectStore(mode: IDBTransactionMode, storeName: string): Promise<IDBObjectStore> {
    const transaction = this.db!.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  private async getCacheData(key: string): Promise<FileCacheData | null> {
    const store = await this.getObjectStore("readonly", this.cacheStoreName);
    const request = store.get(key);

    return new Promise<FileCacheData | null>((resolve, reject) => {
      request.onsuccess = () => {
        const result = request.result as FileCacheData;
        resolve(result || null);
      };

      request.onerror = () => {
        reject(new Error("Failed to retrieve data from IndexedDB."));
      };
    });
  }

  private async getBackupData(key: BackupKey): Promise<BackupData | null> {
    const store = await this.getObjectStore("readonly", this.backupStoreName);
    const request = store.get(key);

    return new Promise<BackupData | null>((resolve, reject) => {
      request.onsuccess = () => {
        const result = request.result as BackupData;
        resolve(result || null);
      };

      request.onerror = () => {
        reject(new Error("Failed to retrieve backup data from IndexedDB."));
      };
    });
  }

  public isReady(): boolean {
    return !!this.db && !this.isInitializing && !!this.plugin && this.plugin.settings.allowImageCache;
  }

  public async getImageFromCache(key_: ImageKey): Promise<string | undefined> {
    if (!this.isReady()) {
      return null; // Database not initialized yet
    }

    const key = getKey(key_);
    return this.getCacheData(key).then((cachedData) => {
      const file = app.vault.getAbstractFileByPath(key_.filepath.split("#")[0]);
      if (!file || !(file instanceof TFile)) return undefined;
      if (cachedData && cachedData.mtime === file.stat.mtime) {
        return cachedData.imageBase64;
      }
      return undefined;
    });
  }

  public async getBAKFromCache(filepath: string): Promise<BackupData | null> {
    if (!this.isReady()) {
      return null; // Database not initialized yet
    }

    return this.getBackupData(filepath);
  }

  public addImageToCache(key_: ImageKey, imageBase64: string): void {
    if (!this.isReady()) {
      return; // Database not initialized yet
    }

    const file = app.vault.getAbstractFileByPath(key_.filepath.split("#")[0]);
    if (!file || !(file instanceof TFile)) return;
    const data: FileCacheData = { mtime: file.stat.mtime, imageBase64 };

    const transaction = this.db.transaction(this.cacheStoreName, "readwrite");
    const store = transaction.objectStore(this.cacheStoreName);
    const key = getKey(key_);
    store.put(data, key);
  }

  public async addBAKToCache(filepath: string, data: BackupData): Promise<void> {
    if (!this.isReady()) {
      return; // Database not initialized yet
    }

    const transaction = this.db.transaction(this.backupStoreName, "readwrite");
    const store = transaction.objectStore(this.backupStoreName);
    store.put(data, filepath);
  }

  public async clearImageCache(): Promise<void> {
    if (!this.isReady()) {
      return; // Database not initialized yet
    }

    return this.clear(this.cacheStoreName, "Image cache was cleared");
  }

  public async clearBackupCache(): Promise<void> {
    if (!this.isReady()) {
      return; // Database not initialized yet
    }

    return this.clear(this.backupStoreName, "All backups were cleared");
  }

  private async clear(storeName: string, message: string): Promise<void> {
    if (!this.isReady()) {
      return; // Database not initialized yet
    }
  
    const transaction = this.db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
  
    return new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => {
        new Notice(message);
        resolve();
      };
      request.onerror = () => reject(new Error(`Failed to clear ${storeName}.`));
    });
  }

}

export const imageCache = new ImageCache(DB_NAME, CACHE_STORE, BACKUP_STORE);