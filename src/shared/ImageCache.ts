import { App, Notice } from "obsidian";
import { t } from "src/lang/helpers";
import ExcalidrawPlugin from "src/core/main";
import { PDFPageViewProps, Size } from "src/types/embeddedFileLoaderTypes";
import { convertSVGStringToElement, errorlog } from "../utils/utils";
import { log } from "../utils/debugHelper";
import { FILENAMEPARTS, PreviewImageType } from "../types/utilTypes";
import { hasExcalidrawEmbeddedImagesTreeChanged } from "../utils/fileUtils";
import { EXCALIDRAW_PLUGIN } from "src/constants/constants";
import { blobToDataURL } from "../utils/coreUtils";
import { isInstanceOfSVGSVGElement } from "../utils/typechecks";

type FileCacheData = {
  schemaVersion: 2;
  payloadKind: "svg" | "raster";
  mtime: number;
  blob: Blob;
  renderScale?: number;
  size?: Size;
  hasSVGwithBitmap?: boolean;
  pdfPageViewProps?: PDFPageViewProps;
};
type ImageCacheMetadata = Partial<
  Pick<
    FileCacheData,
    "renderScale" | "size" | "hasSVGwithBitmap" | "pdfPageViewProps"
  >
>;
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
  expectedPayloadKind?: FileCacheData["payloadKind"];
  requireSvgInspectionMetadata?: boolean;
  svgFormat?: "element" | "data-url";
  onCacheHit?: (metadata: {
    mtime: number;
    renderScale?: number;
    size?: Size;
    hasSVGwithBitmap?: boolean;
    payloadKind: FileCacheData["payloadKind"];
  }) => void;
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
  }#${key.scale}${key.isTransparent ? "#t" : ""}${
    key.padding === undefined ? "" : `#p${key.padding}`
  }`; //key.isSVG ? 1 : 0

class ImageCache {
  private dbName: string;
  private cacheStoreName: string;
  private cacheAccessStoreName: string;
  private backupStoreName: string;
  private legacyCacheStoreNames: readonly string[];
  private db: IDBDatabase | null;
  private isInitializing: boolean;
  private plugin: ExcalidrawPlugin;
  private app: App;
  public initializationNotice: boolean = false;
  private obsidanURLCache = new Map<string, string>();
  private purgeInvalidCacheTimer: number = null;
  private purgeInvalidBackupTimer: number = null;
  private touchedCacheKeys = new Set<string>();
  private cacheReadinessPromise: Promise<void> | null = null;

  private getCacheRetentionCutoff(): number {
    const retentionDays = Math.max(
      1,
      this.plugin?.settings?.imageCacheRetentionDays ?? 30,
    );
    return Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  }

  /**
   * Records cache use without rewriting the potentially very large image value.
   * The access store has a disjoint transaction scope, so these small writes do
   * not block image-cache reads. One write per key and plugin session is enough
   * for retention-based housekeeping.
   */
  private touchCacheData(key: string): void {
    if (!this.db || this.touchedCacheKeys.has(key)) {
      return;
    }
    this.touchedCacheKeys.add(key);
    const transaction = this.db.transaction(
      this.cacheAccessStoreName,
      "readwrite",
    );
    const request = transaction
      .objectStore(this.cacheAccessStoreName)
      .put(Date.now(), key);
    request.onerror = (event) => {
      event.preventDefault();
      this.touchedCacheKeys.delete(key);
    };
  }

  public destroy(): void {
    this.isInitializing = true;
    if (this.purgeInvalidCacheTimer) {
      window.clearTimeout(this.purgeInvalidCacheTimer);
    }
    if (this.purgeInvalidBackupTimer) {
      window.clearTimeout(this.purgeInvalidBackupTimer);
    }
    this.db?.close();
    this.db = null;
    this.plugin = null;
    this.app = null;
    this.obsidanURLCache.forEach((url) => URL.revokeObjectURL(url));
    this.obsidanURLCache.clear();
    this.obsidanURLCache = null;
    this.touchedCacheKeys.clear();
    this.cacheReadinessPromise = null;
  }

  constructor(
    dbName: string,
    cacheStoreName: string,
    cacheAccessStoreName: string,
    backupStoreName: string,
    legacyCacheStoreNames: readonly string[],
  ) {
    this.dbName = dbName;
    this.cacheStoreName = cacheStoreName;
    this.cacheAccessStoreName = cacheAccessStoreName;
    this.backupStoreName = backupStoreName;
    this.legacyCacheStoreNames = legacyCacheStoreNames;
    this.db = null;
    this.isInitializing = false;
    this.plugin = null;
  }

  /**
   * Creates the current cache stores and removes disposable legacy image-cache
   * stores in the same IndexedDB version-change transaction.
   *
   * The drawing backup store is deliberately preserved. Legacy image payloads
   * are not converted because doing so would deserialize and rewrite the full
   * cache during startup; the v2 cache is rebuilt lazily as images are used.
   */
  private applyStoreSchema(db: IDBDatabase): void {
    if (!db.objectStoreNames.contains(this.cacheStoreName)) {
      db.createObjectStore(this.cacheStoreName);
    }
    if (!db.objectStoreNames.contains(this.cacheAccessStoreName)) {
      db.createObjectStore(this.cacheAccessStoreName);
    }
    if (!db.objectStoreNames.contains(this.backupStoreName)) {
      db.createObjectStore(this.backupStoreName);
    }
    this.legacyCacheStoreNames.forEach((storeName) => {
      if (
        storeName !== this.backupStoreName &&
        db.objectStoreNames.contains(storeName)
      ) {
        db.deleteObjectStore(storeName);
      }
    });
  }

  private requiresStoreUpgrade(db: IDBDatabase): boolean {
    return (
      !db.objectStoreNames.contains(this.cacheStoreName) ||
      !db.objectStoreNames.contains(this.cacheAccessStoreName) ||
      !db.objectStoreNames.contains(this.backupStoreName) ||
      this.legacyCacheStoreNames.some((storeName) =>
        db.objectStoreNames.contains(storeName),
      )
    );
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
        this.applyStoreSchema(db);
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

      // Existing databases are upgraded atomically: create v2 stores, remove
      // disposable v1 image stores, and leave drawingBAK untouched.
      if (this.requiresStoreUpgrade(this.db)) {
        const version = this.db.version + 1;
        this.db.close();

        const upgradeRequest = indexedDB.open(this.dbName, version);
        upgradeRequest.onupgradeneeded = (event: IDBVersionChangeEvent) => {
          const db = (event.target as IDBOpenDBRequest).result;
          this.applyStoreSchema(db);
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

      // All initial cache consumers share this probe instead of racing separate
      // reads against a short timeout. Once it resolves, normal reads can proceed.
      await this.ensureCacheStoreReady();

      this.purgeInvalidCacheTimer = window.setTimeout(() => {
        this.purgeInvalidCacheTimer = null;
        void this.purgeInvalidCacheFiles();
      }, 60000);

      this.purgeInvalidBackupTimer = window.setTimeout(() => {
        this.purgeInvalidBackupTimer = null;
        void this.purgeInvalidBackupFiles();
      }, 120000);
    } catch (error) {
      // An upgrade failure can leave `this.db` pointing at the closed legacy
      // connection. Do not advertise a broken cache as ready to consumers.
      this.db?.close();
      this.db = null;
      this.cacheReadinessPromise = null;
      throw error;
    } finally {
      this.isInitializing = false;
      if (this.initializationNotice) {
        new Notice(t("IMAGE_CACHE_INITIALIZED"));
        this.initializationNotice = false;
      }
      log("Initialized Excalidraw Image Cache");
    }
  }

  private ensureCacheStoreReady(): Promise<void> {
    if (this.cacheReadinessPromise !== null) {
      return this.cacheReadinessPromise;
    }
    this.cacheReadinessPromise = new Promise<void>((resolve, reject) => {
      const transaction = this.db.transaction(this.cacheStoreName, "readonly");
      const request = transaction
        .objectStore(this.cacheStoreName)
        .get("__excalidraw_cache_readiness_probe__");
      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error("Failed to initialize image-cache reads."));
    });
    return this.cacheReadinessPromise;
  }

  private async getCacheAccessTimes(): Promise<Map<string, number>> {
    const accessTimes = new Map<string, number>();
    const transaction = this.db.transaction(
      this.cacheAccessStoreName,
      "readonly",
    );
    const request = transaction
      .objectStore(this.cacheAccessStoreName)
      .openCursor();
    return new Promise<Map<string, number>>((resolve, reject) => {
      request.onsuccess = (event: Event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>)
          .result;
        if (!cursor) {
          resolve(accessTimes);
          return;
        }
        if (
          typeof cursor.key === "string" &&
          typeof cursor.value === "number"
        ) {
          accessTimes.set(cursor.key, cursor.value);
        }
        cursor.continue();
      };
      request.onerror = () =>
        reject(new Error("Failed to retrieve image-cache access times."));
    });
  }

  private isCurrentCacheData(cacheData: FileCacheData): boolean {
    return (
      cacheData?.schemaVersion === 2 &&
      (cacheData.payloadKind === "svg" || cacheData.payloadKind === "raster") &&
      cacheData.blob instanceof Blob
    );
  }

  private async purgeInvalidCacheFiles(): Promise<void> {
    const accessTimes = await this.getCacheAccessTimes();
    return new Promise<void>((resolve, reject) => {
      const transaction = this.db.transaction(
        [this.cacheStoreName, this.cacheAccessStoreName],
        "readwrite",
      );
      const store = transaction.objectStore(this.cacheStoreName);
      const accessStore = transaction.objectStore(this.cacheAccessStoreName);
      const request = store.openCursor();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(
          transaction.error ??
            new Error("Failed to purge invalid image-cache entries."),
        );
      request.onsuccess = (event: Event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>)
          .result;
        if (cursor) {
          const key = cursor.key as string;
          const cacheData = cursor.value as FileCacheData;
          // Cache-key suffixes such as transparency and padding are optional, so
          // separator counts cannot identify an old schema reliably. Unreachable
          // legacy entries are harmless and age out through normal retention.
          const filepath = key.split("#")[0];
          const file = this.app.vault.getFileByPath(filepath);
          const lastAccessed = accessTimes.get(key) ?? cacheData.mtime;
          const isExpired = lastAccessed < this.getCacheRetentionCutoff();
          if (
            !file ||
            (file && file.stat.mtime > cacheData.mtime) ||
            !this.isCurrentCacheData(cacheData) ||
            isExpired
          ) {
            if (this.obsidanURLCache.has(key)) {
              URL.revokeObjectURL(this.obsidanURLCache.get(key));
              this.obsidanURLCache.delete(key);
            }
            store.delete(cursor.primaryKey);
            accessStore.delete(cursor.primaryKey);
            this.touchedCacheKeys.delete(key);
          }
          cursor.continue();
        }
      };

      request.onerror = () => {
        const error = request.error;
        const errorMsg = `Failed to purge invalid files from IndexedDB. Error: ${error.message}`;
        errorlog({
          where: "purgeInvalideCacheFiles",
          error: error,
          message: errorMsg,
        });
        reject(new Error(errorMsg));
      };
    });
  }

  private async purgeInvalidBackupFiles(): Promise<void> {
    const transaction = this.db.transaction(this.backupStoreName, "readwrite");
    const store = transaction.objectStore(this.backupStoreName);
    const deletePromises: Promise<void>[] = [];
    const request = store.openCursor();
    return await new Promise<void>((resolve, reject) => {
      request.onsuccess = (event: Event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>)
          .result;
        if (cursor) {
          const key = cursor.key as BackupKey;
          const fileExists = Boolean(this.app.vault.getFileByPath(key));
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
            .catch((error) => reject(error as Error));
        }
      };

      request.onerror = () => {
        const error = request.error;
        const errorMsg = `Failed to purge invalid backup files from IndexedDB. Error: ${error.message}`;
        errorlog({
          where: "purgeInvalidBackupFiles",
          error: error,
          message: errorMsg,
        });
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

  private async getResolvedCacheData(
    key_: ImageKey,
    options?: GetImageFromCacheOptions,
  ): Promise<{ cacheData: FileCacheData; key: string } | undefined> {
    const key = getKey(key_);
    if (!this.isReady()) {
      return undefined;
    }

    try {
      await this.ensureCacheStoreReady();
      const cachedData = await this.getCacheData(key);
      if (!cachedData) {
        return undefined;
      }
      if (!this.isCurrentCacheData(cachedData)) {
        const transaction = this.db.transaction(
          [this.cacheStoreName, this.cacheAccessStoreName],
          "readwrite",
        );
        transaction.objectStore(this.cacheStoreName).delete(key);
        transaction.objectStore(this.cacheAccessStoreName).delete(key);
        this.touchedCacheKeys.delete(key);
        return undefined;
      }

      const file = this.app.vault.getFileByPath(key_.filepath.split("#")[0]);
      if (!file) {
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
      if (
        options?.expectedPayloadKind &&
        cachedData.payloadKind !== options.expectedPayloadKind
      ) {
        return undefined;
      }
      if (
        options?.requireSvgInspectionMetadata &&
        cachedData.payloadKind === "svg" &&
        typeof cachedData.hasSVGwithBitmap !== "boolean"
      ) {
        return undefined;
      }
      options?.onCacheHit?.({
        mtime: cachedData.mtime,
        renderScale: cachedData.renderScale,
        size: cachedData.size,
        hasSVGwithBitmap: cachedData.hasSVGwithBitmap,
        payloadKind: cachedData.payloadKind,
      });
      this.touchCacheData(key);
      return { cacheData: cachedData, key };
    } catch (error) {
      console.error(
        "unexpected error in getResolvedCacheData",
        "ImageCache.getResolvedCacheData",
        key_,
        error,
      );
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
    if (cacheData.payloadKind === "svg") {
      if (options?.svgFormat === "data-url") {
        return blobToDataURL(cacheData.blob);
      }
      return convertSVGStringToElement(await cacheData.blob.text());
    }
    if (this.obsidanURLCache.has(key)) {
      return this.obsidanURLCache.get(key);
    }
    const obsidianURL = URL.createObjectURL(cacheData.blob);
    this.obsidanURLCache.set(key, obsidianURL);
    return obsidianURL;
  }

  public releaseObsidianURL(url: string): void {
    if (!url || !this.obsidanURLCache) {
      return;
    }

    const keysToDelete: string[] = [];
    this.obsidanURLCache.forEach((cachedUrl, key) => {
      if (cachedUrl === url) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.obsidanURLCache.delete(key));
    URL.revokeObjectURL(url);
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
    metadata?: ImageCacheMetadata,
  ): void {
    if (!this.isReady()) {
      return; // Database not initialized yet
    }

    const file = this.app.vault.getFileByPath(key_.filepath.split("#")[0]);
    if (!file) {
      return;
    }

    const isSVGElement = isInstanceOfSVGSVGElement(image);
    const payloadKind =
      isSVGElement || image.type === "image/svg+xml" ? "svg" : "raster";
    const blob =
      isSVGElement
        ? new Blob([image.outerHTML.replaceAll("&nbsp;", " ")], {
            type: "image/svg+xml",
          })
        : image;
    const now = Date.now();
    const data: FileCacheData = {
      schemaVersion: 2,
      payloadKind,
      mtime: now,
      blob,
      ...metadata,
    };
    const transaction = this.db.transaction(
      [this.cacheStoreName, this.cacheAccessStoreName],
      "readwrite",
    );
    const store = transaction.objectStore(this.cacheStoreName);
    const accessStore = transaction.objectStore(this.cacheAccessStoreName);
    const key = getKey(key_);
    store.put(data, key);
    accessStore.put(now, key);
    this.touchedCacheKeys.add(key);
    if (payloadKind === "raster" && obsidianURL) {
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

    this.touchedCacheKeys.clear();
    return this.clear(
      [this.cacheStoreName, this.cacheAccessStoreName],
      "Image cache was cleared",
    );
  }

  public async clearBackupCache(): Promise<void> {
    if (!this.isReady()) {
      return; // Database not initialized yet
    }

    return this.clear(this.backupStoreName, "All backups were cleared");
  }

  private async clear(
    storeNames: string | string[],
    message: string,
  ): Promise<void> {
    if (!this.isReady()) {
      return; // Database not initialized yet
    }

    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    const transaction = this.db.transaction(names, "readwrite");

    return new Promise<void>((resolve, reject) => {
      const requests = names.map((name) =>
        transaction.objectStore(name).clear(),
      );
      transaction.oncomplete = () => {
        new Notice(message);
        resolve();
      };
      transaction.onerror = () =>
        reject(new Error(`Failed to clear ${names.join(", ")}.`));
      requests.forEach((request) => {
        request.onerror = () =>
          reject(new Error(`Failed to clear ${names.join(", ")}.`));
      });
    });
  }
}

let imageCache: ImageCache = null;

export const getImageCache = (): ImageCache => {
  if (!imageCache) {
    const DB_NAME = `Excalidraw ${EXCALIDRAW_PLUGIN.app.appId}`;
    const CACHE_STORE = "imageCacheV2";
    const CACHE_ACCESS_STORE = "imageCacheAccessV2";
    const BACKUP_STORE = "drawingBAK";
    const LEGACY_CACHE_STORES = ["imageCache", "imageCacheAccess"] as const;
    imageCache = new ImageCache(
      DB_NAME,
      CACHE_STORE,
      CACHE_ACCESS_STORE,
      BACKUP_STORE,
      LEGACY_CACHE_STORES,
    );
  }
  return imageCache;
};
