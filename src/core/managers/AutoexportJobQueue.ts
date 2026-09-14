export interface AutoexportJobGuard {
  readonly sequence: number;
  isCurrentSource(): boolean;
  isCurrentDestination(destinationKey: string): boolean;
}

interface AutoexportJobQueueOptions<T> {
  readonly getSourceKey: (job: T) => string;
  readonly getDestinationKeys: (job: T) => readonly string[];
  readonly execute: (job: T, guard: AutoexportJobGuard) => Promise<void>;
  readonly onFailure?: (error: unknown) => void;
  readonly schedule?: (callback: () => void) => void;
}

interface ScheduledJob<T> {
  readonly sequence: number;
  readonly destinationKeys: readonly string[];
  readonly job: T;
}

interface SourceJobState<T> {
  active: boolean;
  trailing: ScheduledJob<T> | null;
}

/** One active job and one newest trailing job for each source identity. */
export class AutoexportJobQueue<T> {
  private destroyed = false;
  private sequence = 0;
  private readonly sourceStates = new Map<string, SourceJobState<T>>();
  private readonly latestSourceSequence = new Map<string, number>();
  private readonly latestDestinationSequence = new Map<string, number>();
  private readonly destinationReferences = new Map<string, number>();

  public constructor(private readonly options: AutoexportJobQueueOptions<T>) {}

  public enqueue(job: T): void {
    if (this.destroyed) {
      return;
    }
    const sourceKey = this.options.getSourceKey(job);
    const scheduled = {
      sequence: ++this.sequence,
      destinationKeys: Array.from(
        new Set(this.options.getDestinationKeys(job)),
      ),
      job,
    } satisfies ScheduledJob<T>;
    this.latestSourceSequence.set(sourceKey, scheduled.sequence);
    for (const destinationKey of scheduled.destinationKeys) {
      this.latestDestinationSequence.set(destinationKey, scheduled.sequence);
      this.destinationReferences.set(
        destinationKey,
        (this.destinationReferences.get(destinationKey) ?? 0) + 1,
      );
    }

    const state = this.sourceStates.get(sourceKey) ?? {
      active: false,
      trailing: null,
    };
    this.sourceStates.set(sourceKey, state);
    if (state.active) {
      if (state.trailing) {
        this.releaseDestinations(state.trailing);
      }
      state.trailing = scheduled;
      return;
    }
    state.active = true;
    this.scheduleDrain(sourceKey, state, scheduled);
  }

  /** Invalidates pending/final-write guards without interrupting source saves. */
  public destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    for (const state of this.sourceStates.values()) {
      if (state.trailing) {
        this.releaseDestinations(state.trailing);
        state.trailing = null;
      }
    }
    this.latestSourceSequence.clear();
    this.latestDestinationSequence.clear();
    this.destinationReferences.clear();
  }

  private async drain(
    sourceKey: string,
    state: SourceJobState<T>,
    first: ScheduledJob<T>,
  ): Promise<void> {
    let scheduled: ScheduledJob<T> | null = first;
    while (scheduled) {
      try {
        await this.options.execute(
          scheduled.job,
          this.createGuard(sourceKey, scheduled),
        );
      } catch (error: unknown) {
        try {
          this.options.onFailure?.(error);
        } catch {
          // Diagnostic failure must not strand the source queue.
        }
      } finally {
        this.releaseDestinations(scheduled);
      }
      scheduled = state.trailing;
      state.trailing = null;
    }

    state.active = false;
    if (state.trailing) {
      const trailing = state.trailing;
      state.trailing = null;
      state.active = true;
      this.scheduleDrain(sourceKey, state, trailing);
    } else {
      this.sourceStates.delete(sourceKey);
      this.latestSourceSequence.delete(sourceKey);
    }
  }

  private scheduleDrain(
    sourceKey: string,
    state: SourceJobState<T>,
    scheduled: ScheduledJob<T>,
  ): void {
    const start = () => {
      void this.drain(sourceKey, state, scheduled);
    };
    if (this.options.schedule) {
      this.options.schedule(start);
      return;
    }
    queueMicrotask(start);
  }

  private createGuard(
    sourceKey: string,
    scheduled: ScheduledJob<T>,
  ): AutoexportJobGuard {
    return {
      sequence: scheduled.sequence,
      isCurrentSource: () =>
        this.latestSourceSequence.get(sourceKey) === scheduled.sequence,
      isCurrentDestination: (destinationKey) =>
        this.latestDestinationSequence.get(destinationKey) ===
        scheduled.sequence,
    };
  }

  private releaseDestinations(scheduled: ScheduledJob<T>): void {
    for (const destinationKey of scheduled.destinationKeys) {
      const references =
        (this.destinationReferences.get(destinationKey) ?? 1) - 1;
      if (references > 0) {
        this.destinationReferences.set(destinationKey, references);
      } else {
        this.destinationReferences.delete(destinationKey);
        this.latestDestinationSequence.delete(destinationKey);
      }
    }
  }
}
