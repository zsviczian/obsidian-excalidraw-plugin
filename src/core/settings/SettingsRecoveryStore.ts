/**
 * Device-local, transactional storage for the last known good settings.
 *
 * The recovery copy deliberately lives outside the vault and Obsidian's
 * localStorage. IndexedDB can hold large legacy settings records and replaces
 * the single recovery record atomically if a write completes.
 */

const DATABASE_VERSION = 1;
const STORE_NAME = "settingsRecovery";
const RECORD_KEY = "lastKnownGood";
const RECORD_VERSION = 1;

interface SettingsRecoveryRecord<Snapshot> {
  version: typeof RECORD_VERSION;
  settings: Snapshot;
}

interface SettingsRecoveryStoreOptions {
  databaseName: string;
  indexedDBFactory?: IDBFactory | null;
}

const normalizeError = (error: unknown, message: string): Error =>
  error instanceof Error ? error : new Error(message);

/**
 * Stores one durable last-known-good settings snapshot for the current vault.
 */
export class SettingsRecoveryStore<Snapshot extends Record<string, unknown>> {
  private database: IDBDatabase | null = null;
  private databasePromise: Promise<IDBDatabase> | null = null;
  private readonly indexedDBFactory: IDBFactory | null;
  private destroyed = false;

  public constructor(private readonly options: SettingsRecoveryStoreOptions) {
    this.indexedDBFactory =
      "indexedDBFactory" in options
        ? (options.indexedDBFactory ?? null)
        : typeof indexedDB === "undefined"
          ? null
          : indexedDB;
  }

  /** Returns the last complete settings snapshot, if one is available. */
  public async load(): Promise<Snapshot | null> {
    const database = await this.getDatabase();
    return new Promise<Snapshot | null>((resolve, reject) => {
      let request: IDBRequest<SettingsRecoveryRecord<Snapshot> | undefined>;
      try {
        const transaction = database.transaction(STORE_NAME, "readonly");
        request = transaction
          .objectStore(STORE_NAME)
          .get(RECORD_KEY) as IDBRequest<
          SettingsRecoveryRecord<Snapshot> | undefined
        >;
        request.onsuccess = () => {
          const record = request.result;
          resolve(
            record?.version === RECORD_VERSION &&
              typeof record.settings === "object" &&
              record.settings !== null &&
              !Array.isArray(record.settings)
              ? record.settings
              : null,
          );
        };
        request.onerror = () => {
          reject(
            request.error ?? new Error("Could not read settings recovery"),
          );
        };
      } catch (error) {
        reject(normalizeError(error, "Could not read settings recovery"));
      }
    });
  }

  /** Atomically replaces the last-known-good settings snapshot. */
  public async save(settings: Snapshot): Promise<void> {
    const database = await this.getDatabase();
    return new Promise<void>((resolve, reject) => {
      try {
        const transaction = database.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).put(
          {
            version: RECORD_VERSION,
            settings,
          } satisfies SettingsRecoveryRecord<Snapshot>,
          RECORD_KEY,
        );
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
          reject(
            transaction.error ?? new Error("Could not save settings recovery"),
          );
        };
        transaction.onabort = () => {
          reject(
            transaction.error ?? new Error("Settings recovery write aborted"),
          );
        };
      } catch (error) {
        reject(normalizeError(error, "Could not save settings recovery"));
      }
    });
  }

  /** Closes the database connection owned by this plugin instance. */
  public destroy(): void {
    this.destroyed = true;
    this.database?.close();
    this.database = null;
    this.databasePromise = null;
  }

  private async getDatabase(): Promise<IDBDatabase> {
    if (this.destroyed) {
      throw new Error("Settings recovery store has been destroyed");
    }
    if (this.database) {
      return this.database;
    }
    const indexedDBFactory = this.indexedDBFactory;
    if (!indexedDBFactory) {
      throw new Error("IndexedDB is unavailable for settings recovery");
    }
    if (this.databasePromise === null) {
      this.databasePromise = this.openDatabase(indexedDBFactory);
    }
    try {
      return await this.databasePromise;
    } catch (error) {
      this.database?.close();
      this.database = null;
      this.databasePromise = null;
      throw error;
    }
  }

  private openDatabase(indexedDBFactory: IDBFactory): Promise<IDBDatabase> {
    return new Promise<IDBDatabase>((resolve, reject) => {
      let requestCompleted = false;
      const request = indexedDBFactory.open(
        this.options.databaseName,
        DATABASE_VERSION,
      );
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        if (requestCompleted || this.destroyed) {
          database.close();
          if (!requestCompleted) {
            requestCompleted = true;
            reject(new Error("Settings recovery store has been destroyed"));
          }
          return;
        }
        requestCompleted = true;
        database.onversionchange = () => {
          database.close();
          if (this.database === database) {
            this.database = null;
            this.databasePromise = null;
          }
        };
        this.database = database;
        resolve(database);
      };
      request.onerror = () => {
        requestCompleted = true;
        reject(request.error ?? new Error("Could not open settings recovery"));
      };
      request.onblocked = () => {
        requestCompleted = true;
        reject(new Error("Settings recovery database upgrade was blocked"));
      };
    });
  }
}
