type PendingBackup = {
  data: string;
};

type BackupWriteState = {
  timer: number | null;
  inFlight: Promise<void> | null;
  pending: PendingBackup | null;
};

type BackupPersistenceQueueOptions = {
  ownerWindow: Window;
  write: (filepath: string, data: string) => Promise<void>;
  onError?: (error: unknown, stage: "write") => void;
};

/**
 * Coalesces plugin-global drawing backups by vault path.
 *
 * @remarks
 * Each path owns at most one IndexedDB write and one latest trailing payload.
 * The timer belongs to the main application window because persistent plugin
 * storage is shared by main and popout views.
 */
export class BackupPersistenceQueue {
  private readonly ownerWindow: Window;
  private readonly write: BackupPersistenceQueueOptions["write"];
  private readonly onError?: BackupPersistenceQueueOptions["onError"];
  private readonly writes = new Map<string, BackupWriteState>();

  constructor(options: BackupPersistenceQueueOptions) {
    this.ownerWindow = options.ownerWindow;
    this.write = options.write;
    this.onError = options.onError;
  }

  /**
   * Schedules the latest payload for a path.
   *
   * @returns `true` when an older pending payload was replaced or the new
   * payload was coalesced behind an active write.
   */
  public schedule(filepath: string, data: string, delayMs: number): boolean {
    let state = this.writes.get(filepath);
    if (!state) {
      state = { timer: null, inFlight: null, pending: null };
      this.writes.set(filepath, state);
    }

    const coalesced = state.pending !== null || state.inFlight !== null;
    state.pending = { data };
    this.clearTimer(state);
    if (state.inFlight === null) {
      this.scheduleDrain(filepath, state, delayMs);
    }
    return coalesced;
  }

  /** Writes all currently pending data for one path without the normal delay. */
  public async flush(filepath: string): Promise<void> {
    const state = this.writes.get(filepath);
    if (!state) {
      return;
    }

    this.clearTimer(state);
    while (this.writes.get(filepath) === state) {
      this.clearTimer(state);
      if (state.inFlight !== null) {
        try {
          await state.inFlight;
        } catch {
          // The owning drain reports the write failure and releases state.
        }
        continue;
      }
      if (state.pending === null) {
        break;
      }
      await this.drain(filepath, state, 0);
    }
  }

  /** Cancels queued data and waits for an already-active write to settle. */
  public async cancel(filepath: string): Promise<void> {
    const state = this.writes.get(filepath);
    if (!state) {
      return;
    }
    this.clearTimer(state);
    state.pending = null;
    this.writes.delete(filepath);
    if (state.inFlight !== null) {
      try {
        await state.inFlight;
      } catch {
        // The owning drain reports the write failure; cancellation still wins.
      }
    }
  }

  /** Cancels every queued backup before the backup store is cleared. */
  public async cancelAll(): Promise<void> {
    await Promise.all(
      Array.from(this.writes.keys(), (filepath) => this.cancel(filepath)),
    );
  }

  /** Drops timers and references during plugin unload without starting writes. */
  public destroy(): void {
    this.writes.forEach((state) => this.clearTimer(state));
    this.writes.clear();
  }

  private clearTimer(state: BackupWriteState): void {
    if (state.timer !== null) {
      this.ownerWindow.clearTimeout(state.timer);
      state.timer = null;
    }
  }

  private scheduleDrain(
    filepath: string,
    state: BackupWriteState,
    delayMs: number,
  ): void {
    state.timer = this.ownerWindow.setTimeout(() => {
      state.timer = null;
      void this.drain(filepath, state, delayMs);
    }, delayMs);
  }

  private async drain(
    filepath: string,
    state: BackupWriteState,
    trailingDelayMs: number,
  ): Promise<void> {
    if (
      this.writes.get(filepath) !== state ||
      state.inFlight !== null ||
      state.pending === null
    ) {
      return;
    }

    const pending = state.pending;
    state.pending = null;
    const write = this.write(filepath, pending.data);
    state.inFlight = write;
    try {
      await write;
    } catch (error: unknown) {
      this.onError?.(error, "write");
    } finally {
      if (this.writes.get(filepath) === state) {
        state.inFlight = null;
        if (state.pending !== null) {
          this.scheduleDrain(filepath, state, trailingDelayMs);
        } else {
          this.writes.delete(filepath);
        }
      }
    }
  }
}
