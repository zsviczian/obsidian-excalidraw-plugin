import { Notice, TFile } from "obsidian";
import ExcalidrawPlugin from "src/main";

//@ts-ignore
const DB_NAME = "Excalidraw " + app.appId;
const CACHE_STORE_NAME = "imageCache";
const BACKUP_STORE = "drawingBAK";


type FileCacheData = { mtime: number; imageBase64: string };

type ImageKey = {
  filepath: string;
  blockref: string;
  sectionref: string;
  isDark: boolean;
  isSVG: boolean;
  scale: number;
};

const getKey = (key: ImageKey): string => `${key.filepath}#${key.blockref}#${key.sectionref}#${key.isDark?1:0}#${key.isSVG?1:0}#${key.scale}`;

class ImageCache {
  private dbName: string;
  private storeName: string;
  private db: IDBDatabase | null;
  private isInitializing: boolean;
  public plugin: ExcalidrawPlugin;

  constructor(dbName: string, storeName: string) {
    this.dbName = dbName;
    this.storeName = storeName;
    this.db = null;
    this.isInitializing = false;
    this.plugin = null;
    app.workspace.onLayoutReady(()=>this.initializeDB());
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
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
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
      
      // Pre-create the object store to reduce delay when accessing it later
      if (!this.db.objectStoreNames.contains(this.storeName)) {
        const version = this.db.version + 1;
        this.db.close();

        const upgradeRequest = indexedDB.open(this.dbName, version);
        upgradeRequest.onupgradeneeded = (event: IDBVersionChangeEvent) => {
          const db = (event.target as IDBOpenDBRequest).result;
          db.createObjectStore(this.storeName);
        };

        await new Promise<void>((resolve, reject) => {
          upgradeRequest.onsuccess = () => {
            const db = (upgradeRequest.result as IDBDatabase);
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
            const db = (openRequest.result as IDBDatabase);
            resolve(db);
          };
          openRequest.onerror = () => {
            reject(new Error(`Failed to open IndexedDB database: ${this.dbName}`));
          };
        });
      }
      await this.purgeInvalidFiles();

    } finally {
      this.isInitializing = false;
      console.log("Initialized Excalidraw Image Cache");
    } 
  }

  private async purgeInvalidFiles(): Promise<void> {
    const transaction = this.db!.transaction(this.storeName, "readwrite");
    const store = transaction.objectStore(this.storeName);
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

  private async getObjectStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const transaction = this.db!.transaction(this.storeName, mode);
    return transaction.objectStore(this.storeName);
  }

  private async getCacheData(key: string): Promise<FileCacheData | null> {
    const store = await this.getObjectStore("readonly");
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

  public isReady(): boolean {
    return !!this.db && !this.isInitializing && !!this.plugin && this.plugin.settings.allowImageCache;
  } 

  public async get(key_: ImageKey): Promise<string | undefined> {
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

  public add(key_: ImageKey, imageBase64: string): void {
    if (!this.isReady()) {
      return;  // Database not initialized yet
    }

    const file = app.vault.getAbstractFileByPath(key_.filepath.split("#")[0]);
    if (!file || !(file instanceof TFile)) return;
    const data: FileCacheData = { mtime: file.stat.mtime, imageBase64 };

    const transaction = this.db.transaction(this.storeName, "readwrite");
    const store = transaction.objectStore(this.storeName);
    const key = getKey(key_)
    store.put(data, key);
  }

  public async clear(): Promise<void> {
    // deliberately not checking isReady() here
    if (!this.db || this.isInitializing) {
      return; // Database not initialized yet
    }

    const transaction = this.db.transaction(this.storeName, "readwrite");
    const store = transaction.objectStore(this.storeName);
    const request = store.clear();

    return new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        new Notice("Image cache cleared.");
        resolve();
      };

      request.onerror = () => {
        reject(new Error("Failed to clear data in IndexedDB."));
      };
    });
  }
}

export const imageCache = new ImageCache(DB_NAME, CACHE_STORE_NAME);