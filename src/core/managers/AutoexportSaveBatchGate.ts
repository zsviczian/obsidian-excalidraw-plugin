export interface AutoexportSaveBatchScheduler {
  readonly setTimeout: (callback: () => void, delayMs: number) => number;
  readonly clearTimeout: (timer: number) => void;
}

interface AutoexportSaveBatchGateOptions<T> {
  readonly scheduler: AutoexportSaveBatchScheduler;
  readonly settleDelayMs: number;
  readonly getSourceKey: (request: T) => string;
  readonly shouldRender: (request: T) => boolean;
  readonly invalidate: (request: T) => void;
  readonly release: (request: T) => void;
}

interface SourceBatchState<T> {
  activityCount: number;
  pending: T | null;
  timer: number | null;
}

/** Coalesces persisted snapshots until every known save loop is idle. */
export class AutoexportSaveBatchGate<T> {
  private destroyed = false;
  private readonly sourceStates = new Map<string, SourceBatchState<T>>();

  public constructor(
    private readonly options: AutoexportSaveBatchGateOptions<T>,
  ) {}

  /** Marks one view-owned save loop active for a source identity. */
  public beginActivity(sourceKey: string): () => void {
    if (this.destroyed) {
      return () => undefined;
    }
    const state = this.getOrCreateState(sourceKey);
    state.activityCount += 1;
    this.cancelTimer(state);
    let released = false;
    return () => {
      if (released || this.destroyed) {
        return;
      }
      released = true;
      state.activityCount = Math.max(0, state.activityCount - 1);
      if (state.activityCount === 0) {
        this.schedulePending(sourceKey, state);
      }
      this.deleteIfEmpty(sourceKey, state);
    };
  }

  /** Accepts the newest successfully persisted snapshot for one source. */
  public publish(request: T): void {
    if (this.destroyed) {
      return;
    }
    const sourceKey = this.options.getSourceKey(request);
    const state = this.getOrCreateState(sourceKey);
    this.options.invalidate(request);
    this.cancelTimer(state);
    if (!this.options.shouldRender(request)) {
      state.pending = null;
      this.deleteIfEmpty(sourceKey, state);
      return;
    }
    state.pending = request;
    if (state.activityCount === 0) {
      this.schedulePending(sourceKey, state);
    }
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    for (const state of this.sourceStates.values()) {
      this.cancelTimer(state);
      state.pending = null;
    }
    this.sourceStates.clear();
  }

  private getOrCreateState(sourceKey: string): SourceBatchState<T> {
    const existing = this.sourceStates.get(sourceKey);
    if (existing) {
      return existing;
    }
    const state: SourceBatchState<T> = {
      activityCount: 0,
      pending: null,
      timer: null,
    };
    this.sourceStates.set(sourceKey, state);
    return state;
  }

  private schedulePending(sourceKey: string, state: SourceBatchState<T>): void {
    if (state.pending === null || state.timer !== null) {
      return;
    }
    state.timer = this.options.scheduler.setTimeout(() => {
      state.timer = null;
      if (this.destroyed || state.activityCount !== 0) {
        return;
      }
      const pending = state.pending;
      state.pending = null;
      if (pending !== null) {
        this.options.release(pending);
      }
      this.deleteIfEmpty(sourceKey, state);
    }, this.options.settleDelayMs);
  }

  private cancelTimer(state: SourceBatchState<T>): void {
    if (state.timer === null) {
      return;
    }
    this.options.scheduler.clearTimeout(state.timer);
    state.timer = null;
  }

  private deleteIfEmpty(sourceKey: string, state: SourceBatchState<T>): void {
    if (
      state.activityCount === 0 &&
      state.pending === null &&
      state.timer === null &&
      this.sourceStates.get(sourceKey) === state
    ) {
      this.sourceStates.delete(sourceKey);
    }
  }
}
