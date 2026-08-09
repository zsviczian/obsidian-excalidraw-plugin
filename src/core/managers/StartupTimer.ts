import { log } from "src/utils/debugHelper";

/** Stores and formats plugin startup timing events without owning startup order. */
export class StartupTimer {
  private readonly events: string[] = [];
  private lastLogTimestamp: number;

  public constructor(
    initialTimestamp: number,
    private readonly pluginVersion: string,
  ) {
    this.lastLogTimestamp = initialTimestamp;
  }

  /**
   * Starts a new timing baseline while retaining events recorded before the
   * reset, matching the existing constructor-to-layout startup breakdown.
   */
  public reset(timestamp: number): void {
    this.lastLogTimestamp = timestamp;
  }

  /** Records one startup event with total and previous-event elapsed times. */
  public logEvent(message: string, loadTimestamp: number): void {
    const timestamp = Date.now();
    this.events.push(
      `${message}\nTotal: ${timestamp - loadTimestamp}ms Delta: ${timestamp - this.lastLogTimestamp}ms\n`,
    );
    this.lastLogTimestamp = timestamp;
  }

  /** Writes the complete startup timing breakdown to the debug log. */
  public printBreakdown(): void {
    log(
      `Excalidraw ${this.pluginVersion} startup breakdown:\n${this.events.join(
        "\n",
      )}`,
    );
  }
}
