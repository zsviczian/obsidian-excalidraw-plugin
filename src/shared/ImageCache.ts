import { App, Notice, TFile } from "obsidian";
import ExcalidrawPlugin from "src/core/main";
import { PDFPageViewProps, Size } from "src/types/embeddedFileLoaderTypes";
import { convertSVGStringToElement } from "../utils/utils";
import { FILENAMEPARTS, PreviewImageType } from "../types/utilTypes";
import { hasExcalidrawEmbeddedImagesTreeChanged } from "../utils/fileUtils";
const DB_NAME = `Excalidraw ${(app as unknown as { appId: string }).appId}`;
const CACHE_STORE = "imageCache";
const BACKUP_STORE = "drawingBAK";

type FileCacheData = {
  mtime: number;
  lastAccessed?: number;
  blob?: Blob;
  svg?: string;
  renderScale?: number;
  size?: Size;
  pdfPageViewProps?: PDFPageViewProps;
};
type BackupData = string;
type BackupKey = string;

export type ImageKey = {
  filepath: string;
  cacheId?: string;
  blockref: string;
  sectionref: string;
  isDark: boolean;
  previewImageType: PreviewImageType;
  scale: number;
  isTransparent: boolean;
  inlineFonts: boolean;
} & FILENAMEPARTS;

type GetImageFromCacheOptions = {
  skipDependencyCheck?: boolean;
  minRenderScale?: number;
};

const getKey = (key: ImageKey): string =>
  `${key.filepath}#${key.cacheId ?? ""}#${key.blockref ?? ""}#${key.sectionref ?? ""}#${key.isDark ? 1 : 0}#${
    key.hasGroupref
  }#${key.hasArearef}#${key.hasFrameref}#${key.hasClippedFrameref}#${
    key.hasSectionref
  }#${key.inlineFonts}#${
    key.previewImageType === PreviewImageType.SVGIMG
      ? 1
      : key.previewImageType === PreviewImageType.PNG
        ? 0
        : 2
  }#${key.scale}${key.isTransparent ? "#t" : ""}`; //key.isSVG ? 1 : 0

class ImageCache {
  private dbName: string;
  private cacheStoreName: string;
  private backupStoreName: string;
  private db: IDBDatabase | null;
  private isInitializing: boolean;
  private plugin: ExcalidrawPlugin;
  private app: App;
  public initializationNotice: boolean = false;
  private obsidanURLCache = new Map<string, string>();
  private purgeInvalidCacheTimer: number = null;
  private purgeInvalidBackupTimer: number = null;

  private getCacheRetentionCutoff(): number {
    const retentionDays = Math.max(
      1,
      this.plugin?.settings?.imageCacheRetentionDays ?? 30,
    );
    return Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  }

  private touchCacheData(key: string, cacheData: FileCacheData): void {
    if (!this.db) {
      return;
    }
    const nextLastAccessed = Date.now();
    // Avoid rewriting IndexedDB on every cache hit while still keeping actively used
    // entries alive for retention-based purging.
    if (
      cacheData.lastAccessed &&
      nextLastAccessed - cacheData.lastAccessed < 60 * 1000
    ) {
      return;
    }

    const transaction = this.db.transaction(this.cacheStoreName, "readwrite");
    const store = transaction.objectStore(this.cacheStoreName);
    store.put(
      {
        ...cacheData,
        lastAccessed: nextLastAccessed,
      },
      key,
    );
  }

  public destroy(): void {
    this.isInitializing = true;
    if (this.purgeInvalidCacheTimer) {
      window.clearTimeout(this.purgeInvalidCacheTimer);
    }
    if (this.purgeInvalidBackupTimer) {
      window.clearTimeout(this.purgeInvalidBackupTimer);
    }
    this.db = null;
    this.plugin = null;
    this.app = null;
    this.obsidanURLCache.forEach((url) => URL.revokeObjectURL(url));
    this.obsidanURLCache.clear();
    this.obsidanURLCache = null;
  }

  constructor(dbName: string, cacheStoreName: string, backupStoreName: string) {
    this.dbName = dbName;
    this.cacheStoreName = cacheStoreName;
    this.backupStoreName = backupStoreName;
    this.db = null;
    this.isInitializing = false;
    this.plugin = null;
  }

  public async initializeDB(plugin: ExcalidrawPlugin): Promise<void> {
    this.plugin = plugin;
    this.app = plugin.app;
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
          reject(
            new Error(
              `Failed to open or create IndexedDB database: ${this.dbName}`,
            ),
          );
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
            const db = upgradeRequest.result;
            db.close();
            resolve();
          };

          upgradeRequest.onerror = () => {
            reject(
              new Error(`Failed to upgrade IndexedDB database: ${this.dbName}`),
            );
          };
        });

        this.db = await new Promise<IDBDatabase>((resolve, reject) => {
          const openRequest = indexedDB.open(this.dbName);
          openRequest.onsuccess = () => {
            const db = openRequest.result;
            resolve(db);
          };
          openRequest.onerror = () => {
            reject(
              new Error(`Failed to open IndexedDB database: ${this.dbName}`),
            );
          };
        });
      }

      this.purgeInvalidCacheTimer = window.setTimeout(() => {
        this.purgeInvalidCacheTimer = null;
        void this.purgeInvalidCacheFiles();
      }, 60000);

      this.purgeInvalidBackupTimer = window.setTimeout(() => {
        this.purgeInvalidBackupTimer = null;
        void this.purgeInvalidBackupFiles();
      }, 120000);
    } finally {
      this.isInitializing = false;
      if (this.initializationNotice) {
        new Notice(
          "Excalidraw Image Cache is Initialized - You may now retry opening your damaged drawing.",
        );
        this.initializationNotice = false;
      }
      console.log("Initialized Excalidraw Image Cache");
    }
  }

  private async purgeInvalidCacheFiles(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const transaction = this.db.transaction(this.cacheStoreName, "readwrite");
      const store = transaction.objectStore(this.cacheStoreName);
      const files = this.app.vault.getFiles();
      const deletePromises: Promise<void>[] = [];
      const request = store.openCursor();
      request.onsuccess = (event: Event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>)
          .result;
        if (cursor) {
          const key = cursor.key as string;
          const isLegacyKey = key.split("#").length - 1 < 13; // introduced hasGroupref, etc. in 1.9.28 // introduced hasClippedFrameref in 2.2.10 //introduced inlineFonts 2.2.11 //introduced cacheId in 2.23.x
          const filepath = key.split("#")[0];
          const fileExists = files.some((f: TFile) => f.path === filepath);
          const file = fileExists
            ? files.find((f: TFile) => f.path === filepath)
            : null;
          const lastAccessed = cursor.value.lastAccessed ?? cursor.value.mtime;
          const isExpired = lastAccessed < this.getCacheRetentionCutoff();
          if (
            isLegacyKey ||
            !file ||
            (file && file.stat.mtime > cursor.value.mtime) ||
            (!cursor.value.blob && !cursor.value.svg) ||
            isExpired
          ) {
            if (this.obsidanURLCache.has(key)) {
              URL.revokeObjectURL(this.obsidanURLCache.get(key));
              this.obsidanURLCache.delete(key);
            }
            deletePromises.push(
              new Promise<void>((innerResolve, innerReject) => {
                const deleteRequest = store.delete(cursor.primaryKey);
                deleteRequest.onsuccess = () => innerResolve();
                deleteRequest.onerror = () => {
                  const error = deleteRequest.error;
                  const errorMsg = `Failed to delete file with key: ${key}. Error: ${error.message}`;
                  innerReject(new Error(errorMsg));
                };
              }),
            );
          }
          cursor.continue();
        } else {
          Promise.all(deletePromises)
            .then(() => {
              transaction.commit();
              resolve();
            })
            .catch((error) => reject(error));
        }
      };

      request.onerror = () => {
        const error = request.error;
        console.log(error);
        const errorMsg = `Failed to purge invalid files from IndexedDB. Error: ${error.message}`;
        reject(new Error(errorMsg));
      };
    });
  }

  private async purgeInvalidBackupFiles(): Promise<void> {
    const transaction = this.db.transaction(this.backupStoreName, "readwrite");
    const store = transaction.objectStore(this.backupStoreName);
    const files = this.app.vault.getFiles();
    const deletePromises: Promise<void>[] = [];
    const request = store.openCursor();
    return await new Promise<void>((resolve, reject) => {
      request.onsuccess = (event: Event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>)
          .result;
        if (cursor) {
          const key = cursor.key as BackupKey;
          const fileExists = files.some((f: TFile) => f.path === key);
          if (!fileExists) {
            deletePromises.push(
              new Promise<void>((resolve, reject) => {
                const deleteRequest = store.delete(cursor.primaryKey);
                deleteRequest.onsuccess = () => resolve();
                deleteRequest.onerror = () =>
                  reject(
                    new Error(`Failed to delete backup file with key: ${key}`),
                  );
              }),
            );
          }
          cursor.continue();
        } else {
          Promise.all(deletePromises)
            .then(() => {
              transaction.commit();
              resolve();
            })
            .catch((error) => reject(error));
        }
      };

      request.onerror = () => {
        const error = request.error;
        const errorMsg = `Failed to purge invalid backup files from IndexedDB. Error: ${error.message}`;
        console.log(error);
        reject(new Error(errorMsg));
      };
    });
  }

  private getObjectStore(
    mode: IDBTransactionMode,
    storeName: string,
  ): IDBObjectStore {
    const transaction = this.db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  private async getCacheData(key: string): Promise<FileCacheData | null> {
    const store = this.getObjectStore("readonly", this.cacheStoreName);
    const request = store.get(key);

    return await new Promise<FileCacheData | null>((resolve, reject) => {
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
    const store = this.getObjectStore("readonly", this.backupStoreName);
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
    return (
      !!this.db &&
      !this.isInitializing &&
      !!this.plugin &&
      this.plugin.settings.allowImageCache
    );
  }

  private fullyInitialized = false;

  private async getResolvedCacheData(
    key_: ImageKey,
    options?: GetImageFromCacheOptions,
  ): Promise<{ cacheData: FileCacheData; key: string } | undefined> {
    if (!this.isReady()) {
      return undefined;
    }

    const key = getKey(key_);

    try {
      const cachedData = this.fullyInitialized
        ? await this.getCacheData(key)
        : await Promise.race([
            this.getCacheData(key),
            new Promise<undefined>((_, reject) =>
              window.setTimeout(() => {
                reject(undefined);
              }, 100),
            ),
          ]);
      this.fullyInitialized = true;
      if (!cachedData) {
        return undefined;
      }

      const file = this.app.vault.getAbstractFileByPath(
        key_.filepath.split("#")[0],
      );
      if (!file || !(file instanceof TFile)) {
        return undefined;
      }
      if (cachedData.mtime < file.stat.mtime) {
        return undefined;
      }
      if (
        !options?.skipDependencyCheck &&
        hasExcalidrawEmbeddedImagesTreeChanged(
          file,
          cachedData.mtime,
          this.plugin,
        )
      ) {
        return undefined;
      }
      // Validated reads can require a minimum render scale so lower-resolution PDF
      // snapshots are upgraded in the background without blocking the first paint.
      const cachedRenderScale = cachedData.renderScale ?? key_.scale;
      if (
        options?.minRenderScale &&
        cachedRenderScale < options.minRenderScale
      ) {
        return undefined;
      }
      this.touchCacheData(key, cachedData);
      return { cacheData: cachedData, key };
    } catch (_) {
      return undefined;
    }
  }

  public async getImageCacheData(
    key_: ImageKey,
    options?: GetImageFromCacheOptions,
  ): Promise<FileCacheData | undefined> {
    return (await this.getResolvedCacheData(key_, options))?.cacheData;
  }

  public async getImageFromCache(
    key_: ImageKey,
    options?: GetImageFromCacheOptions,
  ): Promise<string | SVGSVGElement | undefined> {
    const resolved = await this.getResolvedCacheData(key_, options);
    if (!resolved) {
      return undefined;
    }

    const { cacheData, key } = resolved;
    if (cacheData.svg) {
      return convertSVGStringToElement(cacheData.svg);
    }
    if (this.obsidanURLCache.has(key)) {
      return this.obsidanURLCache.get(key);
    }
    const obsidianURL = URL.createObjectURL(cacheData.blob);
    this.obsidanURLCache.set(key, obsidianURL);
    return obsidianURL;
  }

  public async getBAKFromCache(filepath: string): Promise<BackupData | null> {
    if (!this.isReady()) {
      return null; // Database not initialized yet
    }

    return this.getBackupData(filepath);
  }

  //cache SVG should have the width and height parameters and not the embedded font
  public addImageToCache(
    key_: ImageKey,
    obsidianURL: string,
    image: Blob | SVGSVGElement,
    metadata?: Partial<FileCacheData>,
  ): void {
    if (!this.isReady()) {
      return; // Database not initialized yet
    }

    const file = this.app.vault.getAbstractFileByPath(
      key_.filepath.split("#")[0],
    );
    if (!file || !(file instanceof TFile)) {
      return;
    }

    let svg: string = null;
    let blob: Blob = null;
    if (image instanceof SVGSVGElement) {
      svg = image.outerHTML;
    } else {
      blob = image;
    }
    const now = Date.now();
    const data: FileCacheData = {
      mtime: now,
      lastAccessed: now,
      blob,
      svg,
      ...metadata,
    };
    const transaction = this.db.transaction(this.cacheStoreName, "readwrite");
    const store = transaction.objectStore(this.cacheStoreName);
    const key = getKey(key_);
    store.put(data, key);
    if (!svg && obsidianURL) {
      if (
        this.obsidanURLCache.has(key) &&
        this.obsidanURLCache.get(key) !== obsidianURL
      ) {
        URL.revokeObjectURL(this.obsidanURLCache.get(key));
      }
      this.obsidanURLCache.set(key, obsidianURL);
    }
  }

  public async addBAKToCache(
    filepath: string,
    data: BackupData,
  ): Promise<void> {
    if (!this.isReady()) {
      return; // Database not initialized yet
    }

    const transaction = this.db.transaction(this.backupStoreName, "readwrite");
    const store = transaction.objectStore(this.backupStoreName);
    store.put(data, filepath);
  }

  public async removeBAKFromCache(filepath: string): Promise<void> {
    if (!this.isReady()) {
      return; // Database not initialized yet
    }

    const transaction = this.db.transaction(this.backupStoreName, "readwrite");
    const store = transaction.objectStore(this.backupStoreName);

    return new Promise<void>((resolve, reject) => {
      const request = store.delete(filepath);
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        reject(new Error(`Failed to remove backup file with key: ${filepath}`));
      };
    });
  }

  public async clearImageCache(): Promise<void> {
    if (!this.isReady()) {
      return; // Database not initialized yet
    }

    this.obsidanURLCache.forEach((url) => URL.revokeObjectURL(url));
    this.obsidanURLCache.clear();

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
      request.onerror = () =>
        reject(new Error(`Failed to clear ${storeName}.`));
    });
  }
}

export const imageCache = new ImageCache(DB_NAME, CACHE_STORE, BACKUP_STORE);
