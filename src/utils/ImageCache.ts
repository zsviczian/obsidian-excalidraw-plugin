import { TFile } from "obsidian";

type FileCacheData = { mtime: number; imageBase64: string };
type ImageKey = {
  filepath: string;
  blockref: string;
  sectionref: string;
  isDark: boolean;
  isSVG: boolean;
  scale: number;
};

const getKey = (key: ImageKey): string =>
  JSON.stringify({
    filepath: key.filepath,
    blockref: key.blockref,
    sectionref: key.sectionref,
    isDark: key.isDark,
    isSVG: key.isSVG,
    scale: key.scale,
  });

class ImageCache {
  private dbName: string;
  private storeName: string;
  private db: IDBDatabase | null;
  private isInitializing: boolean;

  constructor(dbName: string, storeName: string) {
    this.dbName = dbName;
    this.storeName = storeName;
    this.db = null;
    this.isInitializing = false;
  }

  public async initializeDB(): Promise<void> {
    const start = Date.now();
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
        console.log("Creating object store");
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
      //await this.purgeInvalidFiles();

    } finally {
      this.isInitializing = false;
      console.log(`Initialized Excalidraw Image Cache database in ${Date.now() - start}ms`);
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
          const key: ImageKey = JSON.parse(cursor.key as string);
          const fileExists = files.some((file: TFile) => {
            return file.path.split("#")[0] === key.filepath;
          });
          if (!fileExists) {
            cursor.delete();
          } else {
            const file = files.find((file: TFile) => file.path.split("#")[0] === key.filepath);
            if (file && file.stat.mtime > cursor.value.mtime) {
              deletePromises.push(
                new Promise<void>((resolve, reject) => {
                  const deleteRequest = store.delete(cursor.primaryKey);
                  deleteRequest.onsuccess = () => resolve();
                  deleteRequest.onerror = () =>
                    reject(new Error(`Failed to delete file with key: ${key}`));
                })
              );
            }
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

  public async openDB(): Promise<IDBDatabase> {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.dbName);

      request.onerror = () => {
        reject(new Error("Failed to open IndexedDB database."));
      };

      request.onsuccess = () => {
        const db = request.result as IDBDatabase;
        resolve(db);
      };
    });
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

  private async setCacheData(key: string, data: FileCacheData): Promise<void> {
    const store = await this.getObjectStore("readwrite");
    const request = store.put(data, key);

    return new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error("Failed to store data in IndexedDB."));
      };
    });
  }

  private async deleteCacheData(key: string): Promise<void> {
    const store = await this.getObjectStore("readwrite");
    store.delete(key);
  }

  public async isCached(key_: ImageKey): Promise<boolean> {
    const key = getKey(key_);
    return this.getCacheData(key).then((cachedData) => {
      if (cachedData) {
        const file = app.vault.getAbstractFileByPath(key_.filepath.split("#")[0]);
        if (!file || !(file instanceof TFile)) return false;
        if (cachedData.mtime === file.stat.mtime) {
          return true;
        }
      }
      return false;
    });
  }

  public isReady(): boolean {
    return !!this.db && !this.isInitializing;
  } 

  public async get(key_: ImageKey): Promise<string | undefined> {
    const start = Date.now();
    if (!this.db || this.isInitializing) {
      console.log(`get from cache FAILED (not ready) in ${Date.now() - start}ms`);
      return null; // Database not initialized yet
    }

    const key = getKey(key_);
    return this.getCacheData(key).then((cachedData) => {
      const file = app.vault.getAbstractFileByPath(key_.filepath.split("#")[0]);
      if (!file || !(file instanceof TFile)) return undefined;
      if (cachedData && cachedData.mtime === file.stat.mtime) {
        console.log(`get from cache SUCCEEDED in ${Date.now() - start}ms`);
        return cachedData.imageBase64;
      }
      console.log(`get from cache FAILED in ${Date.now() - start}ms`);
      return undefined;
    });
  }

  public add(key_: ImageKey, imageBase64: string): void {
    const start = Date.now();
    if (!this.db || this.isInitializing) {
      return;  // Database not initialized yet
    }

    const file = app.vault.getAbstractFileByPath(key_.filepath.split("#")[0]);
    if (!file || !(file instanceof TFile)) return;
    const data: FileCacheData = { mtime: file.stat.mtime, imageBase64 };

    const transaction = this.db.transaction(this.storeName, "readwrite");
    const store = transaction.objectStore(this.storeName);
    const key = getKey(key_)
    store.put(data, key);
    console.log(`add to cache in ${Date.now() - start}ms`);
  }

  delete(key_: ImageKey): Promise<void> {
    const key = getKey(key_);
    return this.deleteCacheData(key);
  }
}

const imageCache = new ImageCache("ExcalidrawImageDB", "ImageStore");
imageCache.initializeDB();

async function searchAndDeleteImages(filepath: string): Promise<void> {
  const db = await imageCache.openDB();
  const transaction = db.transaction("ImageStore", "readwrite");
  const store = transaction.objectStore("ImageStore");
  const request = store.openCursor();

  return new Promise<void>((resolve, reject) => {
    request.onsuccess = (event: Event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        const key: ImageKey = JSON.parse(cursor.key as string);
        if (key.filepath === filepath) {
          cursor.delete();
        }
        cursor.continue();
      } else {
        resolve();
      }
    };

    request.onerror = () => {
      reject(new Error("Failed to search and delete images in IndexedDB."));
    };
  });
}

export { imageCache, searchAndDeleteImages };

