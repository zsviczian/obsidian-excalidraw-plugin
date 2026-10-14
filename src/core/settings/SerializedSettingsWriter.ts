import { stringifySettingsCanonically } from "./canonicalSettingsSerialization";

/**
 * Serialized stable-snapshot writer for plugin settings.
 */

/** Persistence operation required by the serialized settings writer. */
export interface SerializedSettingsWriterHost<Snapshot> {
  saveData(data: Snapshot): Promise<void>;
}

/**
 * Serializes complete settings writes so an older save cannot finish after a
 * newer one. Each request captures an immutable canonical JSON snapshot
 * (recursively sorted object keys) before waiting for an earlier write, and
 * payloads that are canonically identical to the last persisted one are
 * skipped without touching storage, so key-order variation between writers
 * can no longer churn `data.json` or fire spurious vault change events.
 */
export class SerializedSettingsWriter<
  Snapshot extends Record<string, unknown>,
> {
  private persistenceChain: Promise<void> = Promise.resolve();
  private lastPersistedCanonical = "";

  public constructor(
    private readonly host: SerializedSettingsWriterHost<Snapshot>,
  ) {}

  /**
   * Remembers the canonical form of a payload that is already on disk so an
   * unchanged save can be skipped without reading or writing storage.
   */
  public rememberPersistedSnapshot(settings: Snapshot): void {
    this.lastPersistedCanonical = stringifySettingsCanonically(settings);
  }

  /** Queues one stable snapshot and resolves when that snapshot is saved. */
  public persist(settings: Snapshot): Promise<void> {
    const canonical = stringifySettingsCanonically(settings);
    if (canonical === this.lastPersistedCanonical) {
      return Promise.resolve();
    }
    let snapshot: Snapshot;
    try {
      snapshot = JSON.parse(canonical) as Snapshot;
    } catch (error) {
      return Promise.reject(
        error instanceof Error
          ? error
          : new Error("Could not serialize settings snapshot"),
      );
    }
    const persistence = this.persistenceChain
      .catch((): void => undefined)
      .then(() => this.host.saveData(snapshot))
      .then(() => {
        this.lastPersistedCanonical = canonical;
      });
    this.persistenceChain = persistence;
    return persistence;
  }
}
