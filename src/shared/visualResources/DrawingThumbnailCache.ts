const PNGS = "pngs";
const ENTRIES = "entries";
const TOTALS = "totals";
const ACCESS = "used";
const BUDGET = 100 * 1024 * 1024;
const MAX_ENTRIES = 8192;
const PURGE_DELAY_MS = 60_000;

interface Entry {
  stamp: string;
  bytes: number;
  used: number;
}

interface Totals {
  bytes: number;
  count: number;
}

type CacheHost = Pick<Window, "indexedDB" | "setTimeout" | "clearTimeout"> & { IDBKeyRange: typeof IDBKeyRange };

/** Device-local derived PNGs. All accounting and eviction are in one transaction. */
export class DrawingThumbnailCache {
  private opening: Promise<IDBDatabase | null> | null = null;
  private database: IDBDatabase | null = null;
  private disposed = false;
  private purgeTimer: number | null = null;

  constructor(private readonly owner: CacheHost, private readonly databaseName: string,
    private readonly retentionDays: () => number) {}

  private cutoff(): number {
    return Date.now() - Math.max(1, this.retentionDays()) * 86_400_000;
  }

  private open(): Promise<IDBDatabase | null> {
    if (this.disposed || !this.owner.indexedDB) return Promise.resolve(null);
    if (this.database) return Promise.resolve(this.database);
    return this.opening ??= new Promise<IDBDatabase | null>((resolve, reject) => {
      const request = this.owner.indexedDB.open(this.databaseName, 1);
      let blocked = false;
      request.onupgradeneeded = () => {
        if (blocked || this.disposed) { request.transaction?.abort(); return; }
        const db = request.result;
        db.createObjectStore(PNGS);
        db.createObjectStore(ENTRIES).createIndex(ACCESS, ACCESS);
        db.createObjectStore(TOTALS);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => { blocked = true; resolve(null); };
      request.onsuccess = () => {
        const db = request.result;
        if (blocked || this.disposed) { db.close(); resolve(null); return; }
        this.database = db;
        const close = () => {
          db.close();
          if (this.database === db) this.database = null;
        };
        db.onversionchange = close;
        db.onclose = close;
        this.schedulePurge();
        resolve(db);
      };
    }).catch((): null => null).finally(() => { this.opening = null; });
  }

  private schedulePurge(): void {
    if (this.purgeTimer !== null) return;
    this.purgeTimer = this.owner.setTimeout(() => {
      this.purgeTimer = null;
      void this.purgeExpired();
    }, PURGE_DELAY_MS);
  }

  /** IDB callbacks keep queued requests in the same active transaction on mobile WebViews. */
  private async transaction<T>(queue: (tx: IDBTransaction, result: (value: T) => void) => void): Promise<T | null> {
    const db = await this.open();
    if (!db || this.disposed) return null;
    try {
      return await new Promise<T | null>((resolve, reject) => {
        const tx = db.transaction([PNGS, ENTRIES, TOTALS], "readwrite");
        let result: T | null = null;
        tx.oncomplete = () => resolve(result);
        tx.onabort = () => reject(tx.error);
        queue(tx, value => { result = value; });
      });
    } catch {
      // Storage being full or unavailable must not interfere with rendering.
      return null;
    }
  }

  /** Reads a matching PNG and updates only its small access record. */
  public get(id: string, stamp: string): Promise<Blob | null> {
    return this.transaction<Blob>((tx, result) => {
      const entries = tx.objectStore(ENTRIES);
      const match = entries.get(id) as IDBRequest<Entry | undefined>;
      match.onsuccess = () => {
        const entry = match.result;
        if (entry?.stamp !== stamp || entry.used < this.cutoff()) return;
        const request = tx.objectStore(PNGS).get(id) as IDBRequest<Blob | undefined>;
        request.onsuccess = () => {
          const png = request.result;
          if (!png || png.type !== "image/png") return;
          // Repeated visits to the same drawing need only update recency once a minute.
          if (Date.now() - entry.used >= 60_000) entries.put({ ...entry, used: Date.now() }, id);
          result(png);
        };
      };
    });
  }

  /** Replaces the same drawing/frame/theme entry and evicts the least recently used PNGs. */
  public async put(id: string, stamp: string, png: Blob): Promise<void> {
    const bytes = png.size + 2 * (id.length + stamp.length);
    if (!png.size || png.type !== "image/png" || bytes > 384 * 1024) return;
    await this.transaction((tx) => {
      const entries = tx.objectStore(ENTRIES);
      const pngs = tx.objectStore(PNGS);
      const totals = tx.objectStore(TOTALS);
      const state = totals.get("size") as IDBRequest<Totals | undefined>;
      const old = entries.get(id) as IDBRequest<Entry | undefined>;
      old.onsuccess = () => {
        const size = state.result ?? { bytes: 0, count: 0 };
        size.bytes += bytes - (old.result?.bytes ?? 0);
        size.count += old.result ? 0 : 1;
        entries.put({ stamp, bytes, used: Date.now() } satisfies Entry, id);
        pngs.put(png, id);
        if (size.bytes <= BUDGET && size.count <= MAX_ENTRIES) {
          totals.put(size, "size");
          return;
        }
        this.removeEntries(tx, size, () => size.bytes <= BUDGET && size.count <= MAX_ENTRIES, undefined, id);
      };
    });
  }

  private removeEntries(tx: IDBTransaction, size: Totals, finished: () => boolean, range?: IDBKeyRange, keep?: string): void {
    const pngs = tx.objectStore(PNGS);
    const scan = tx.objectStore(ENTRIES).index(ACCESS).openCursor(range);
    scan.onsuccess = () => {
      const cursor = scan.result;
      if (!cursor || finished()) {
        tx.objectStore(TOTALS).put(size, "size");
        return;
      }
      if (cursor.primaryKey !== keep) {
        const entry = cursor.value as Entry;
        size.bytes -= entry.bytes;
        size.count--;
        pngs.delete(cursor.primaryKey);
        cursor.delete();
      }
      cursor.continue();
    };
  }

  private async purgeExpired(): Promise<void> {
    await this.transaction(tx => {
      const cutoff = this.owner.IDBKeyRange.upperBound(this.cutoff(), true);
      const state = tx.objectStore(TOTALS).get("size") as IDBRequest<Totals | undefined>;
      state.onsuccess = () => {
        if (state.result) this.removeEntries(tx, state.result, () => false, cutoff);
      };
    });
    // The first open schedules housekeeping. A purge after a database
    // reconnect should not leave a second timer behind.
    if (this.purgeTimer !== null) this.owner.clearTimeout(this.purgeTimer);
    this.purgeTimer = null;
  }

  public async clear(): Promise<void> {
    await this.transaction(tx => {
      for (const name of [PNGS, ENTRIES, TOTALS]) tx.objectStore(name).clear();
    });
  }

  public destroy(): void {
    this.disposed = true;
    if (this.purgeTimer !== null) this.owner.clearTimeout(this.purgeTimer);
    this.purgeTimer = null;
    this.database?.close();
    this.database = null;
  }
}
