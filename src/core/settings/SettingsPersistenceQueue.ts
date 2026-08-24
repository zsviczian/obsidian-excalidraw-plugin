/**
 * Coalesces settings mutations so rapid controls do not enqueue one complete
 * `data.json` write per input event.
 */

/** Persistence operations owned by the settings tab. */
export interface SettingsPersistenceQueueHost {
  /** Persists the latest in-memory settings snapshot. */
  persistSettings(): Promise<void>;
  /** Applies side effects that must observe a successfully persisted snapshot. */
  applyPendingActions(): Promise<void>;
  /** Returns true while persistence would replace a control being edited. */
  shouldDeferPersistence?(): boolean;
}

interface PersistenceWaiter {
  revision: number;
  resolve: () => void;
  reject: (reason: unknown) => void;
}

/**
 * Trailing-edge persistence queue for settings mutations.
 *
 * Rapid mutations are collapsed into one write. If another mutation arrives
 * while that write is in flight, one follow-up write persists the newest
 * snapshot before pending actions and callers are released.
 */
export class SettingsPersistenceQueue {
  private requestedRevision = 0;
  private completedRevision = 0;
  private debounceTimer: number | null = null;
  private activeRun: Promise<void> | null = null;
  private waiters: PersistenceWaiter[] = [];

  constructor(
    private readonly host: SettingsPersistenceQueueHost,
    private readonly debounceMilliseconds: number = 250,
  ) {}

  /**
   * Records a mutation and resolves after a persisted snapshot containing it
   * has had its pending actions applied.
   */
  enqueue(): Promise<void> {
    const revision = ++this.requestedRevision;
    const persistence = new Promise<void>((resolve, reject) => {
      this.waiters.push({ revision, resolve, reject });
    });
    this.schedule();
    return persistence;
  }

  /** Immediately starts any scheduled persistence and awaits completion. */
  flush(): Promise<void> {
    this.cancelTimer();
    if (this.activeRun !== null) {
      return this.activeRun;
    }
    if (this.completedRevision >= this.requestedRevision) {
      return Promise.resolve();
    }
    return this.startRun();
  }

  private schedule(): void {
    if (this.activeRun !== null) {
      return;
    }
    this.cancelTimer();
    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      if (this.host.shouldDeferPersistence?.()) {
        this.schedule();
        return;
      }
      void this.startRun().catch((): void => undefined);
    }, this.debounceMilliseconds);
  }

  private cancelTimer(): void {
    if (this.debounceTimer === null) {
      return;
    }
    window.clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
  }

  private startRun(): Promise<void> {
    if (this.activeRun !== null) {
      return this.activeRun;
    }
    const run = this.persistLatestRevision();
    this.activeRun = run;
    void run
      .finally(() => {
        if (this.activeRun === run) {
          this.activeRun = null;
        }
      })
      .catch((): void => undefined);
    return run;
  }

  private async persistLatestRevision(): Promise<void> {
    try {
      while (this.completedRevision < this.requestedRevision) {
        const revisionToPersist = this.requestedRevision;
        await this.host.persistSettings();
        if (revisionToPersist !== this.requestedRevision) {
          continue;
        }
        await this.host.applyPendingActions();
        if (revisionToPersist !== this.requestedRevision) {
          continue;
        }
        this.completedRevision = revisionToPersist;
        this.resolveWaitersThrough(revisionToPersist);
      }
    } catch (error) {
      this.rejectWaiters(error);
      throw error;
    }
  }

  private resolveWaitersThrough(revision: number): void {
    const remaining: PersistenceWaiter[] = [];
    for (const waiter of this.waiters) {
      if (waiter.revision <= revision) {
        waiter.resolve();
      } else {
        remaining.push(waiter);
      }
    }
    this.waiters = remaining;
  }

  private rejectWaiters(reason: unknown): void {
    const waiters = this.waiters;
    this.waiters = [];
    for (const waiter of waiters) {
      waiter.reject(reason);
    }
  }
}
