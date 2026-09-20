export interface OwnWriteReloadGuardScheduler {
  readonly setTimeout: (callback: () => void, delayMs: number) => number;
  readonly clearTimeout: (timer: number) => void;
}

/** Owns one view's short-lived reload suppression for its own Vault write. */
export class OwnWriteReloadGuard {
  private suppressed = false;
  private cleanupTimer: number | null = null;

  public constructor(
    private readonly scheduler: OwnWriteReloadGuardScheduler,
    private readonly cleanupDelayMs: number,
  ) {}

  /** Sets suppression for the physical write without starting cleanup early. */
  public setForWrite(suppressed: boolean): void {
    this.clear();
    this.suppressed = suppressed;
  }

  /** Re-arms suppression and its bounded post-write cleanup period. */
  public armCleanup(): void {
    this.clearTimer();
    this.suppressed = true;
    const timer = this.scheduler.setTimeout(() => {
      if (this.cleanupTimer !== timer) {
        return;
      }
      this.cleanupTimer = null;
      this.suppressed = false;
    }, this.cleanupDelayMs);
    this.cleanupTimer = timer;
  }

  /** Consumes one expected own-write notification and cancels late cleanup. */
  public consume(): boolean {
    if (!this.suppressed) {
      return false;
    }
    this.suppressed = false;
    this.clearTimer();
    return true;
  }

  /** Clears suppression and any scheduled cleanup idempotently. */
  public clear(): void {
    this.suppressed = false;
    this.clearTimer();
  }

  /** Preserves the historical timer-only compatibility operation. */
  public clearTimer(): void {
    if (this.cleanupTimer === null) {
      return;
    }
    this.scheduler.clearTimeout(this.cleanupTimer);
    this.cleanupTimer = null;
  }

  public destroy(): void {
    this.clear();
  }
}
