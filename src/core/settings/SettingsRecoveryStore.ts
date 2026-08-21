/**
 * Crash-recovery journal and serialized writer for plugin settings snapshots.
 */

const PENDING_SETTINGS_RECOVERY_VERSION = 1;

interface PendingSettingsRecovery<Snapshot> {
  version: typeof PENDING_SETTINGS_RECOVERY_VERSION;
  token: string;
  settings: Snapshot;
}

/** Storage operations required by the settings recovery journal. */
export interface SettingsRecoveryStoreHost<Snapshot> {
  loadRecoveryData(): unknown;
  saveRecoveryData(data: unknown): void;
  saveData(data: Snapshot): Promise<void>;
}

/**
 * Stages a synchronous recovery snapshot before starting an asynchronous
 * `data.json` write and serializes writes so older saves cannot finish last.
 */
export class SettingsRecoveryStore<Snapshot extends Record<string, unknown>> {
  private persistenceChain: Promise<void> = Promise.resolve();
  private persistenceToken = 0;

  public constructor(
    private readonly host: SettingsRecoveryStoreHost<Snapshot>,
  ) {}

  /** Returns the snapshot left by a save that did not complete and clear it. */
  public loadPendingSnapshot(): Snapshot | null {
    const recovery = this.loadPendingRecovery();
    return recovery?.settings ?? null;
  }

  /**
   * Stages and serializes a stable snapshot, clearing its journal entry only
   * if no newer save has replaced it.
   */
  public persist(settings: Snapshot): Promise<void> {
    const snapshot = this.createStableSnapshot(settings);
    const token = `${Date.now()}:${++this.persistenceToken}`;
    this.storePendingRecovery({
      version: PENDING_SETTINGS_RECOVERY_VERSION,
      token,
      settings: snapshot,
    });
    const persistence = this.persistenceChain
      .catch((): void => undefined)
      .then(async () => {
        await this.host.saveData(snapshot);
        this.clearPendingRecovery(token);
      });
    this.persistenceChain = persistence;
    return persistence;
  }

  private createStableSnapshot(settings: Snapshot): Snapshot {
    return JSON.parse(JSON.stringify(settings)) as Snapshot;
  }

  private loadPendingRecovery(): PendingSettingsRecovery<Snapshot> | null {
    try {
      const stored = this.host.loadRecoveryData();
      if (
        typeof stored !== "object" ||
        stored === null ||
        (stored as { version?: unknown }).version !==
          PENDING_SETTINGS_RECOVERY_VERSION ||
        typeof (stored as { token?: unknown }).token !== "string" ||
        typeof (stored as { settings?: unknown }).settings !== "object" ||
        (stored as { settings?: unknown }).settings === null ||
        Array.isArray((stored as { settings?: unknown }).settings)
      ) {
        return null;
      }
      return stored as PendingSettingsRecovery<Snapshot>;
    } catch (error) {
      console.error("Could not read pending Excalidraw settings recovery", error);
      return null;
    }
  }

  private storePendingRecovery(
    recovery: PendingSettingsRecovery<Snapshot>,
  ): void {
    try {
      this.host.saveRecoveryData(recovery);
    } catch (error) {
      console.error("Could not stage pending Excalidraw settings recovery", error);
    }
  }

  private clearPendingRecovery(token: string): void {
    const pendingRecovery = this.loadPendingRecovery();
    if (pendingRecovery?.token !== token) {
      return;
    }
    try {
      this.host.saveRecoveryData(null);
    } catch (error) {
      console.error("Could not clear pending Excalidraw settings recovery", error);
    }
  }
}
