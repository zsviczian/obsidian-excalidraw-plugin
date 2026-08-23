/**
 * Serialized stable-snapshot writer for plugin settings.
 */

/** Persistence operation required by the serialized settings writer. */
export interface SerializedSettingsWriterHost<Snapshot> {
  saveData(data: Snapshot): Promise<void>;
}

/**
 * Serializes complete settings writes so an older save cannot finish after a
 * newer one. Each request captures an immutable JSON snapshot before waiting
 * for an earlier write.
 */
export class SerializedSettingsWriter<
  Snapshot extends Record<string, unknown>,
> {
  private persistenceChain: Promise<void> = Promise.resolve();

  public constructor(
    private readonly host: SerializedSettingsWriterHost<Snapshot>,
  ) {}

  /** Queues one stable snapshot and resolves when that snapshot is saved. */
  public persist(settings: Snapshot): Promise<void> {
    let snapshot: Snapshot;
    try {
      snapshot = JSON.parse(JSON.stringify(settings)) as Snapshot;
    } catch (error) {
      return Promise.reject(
        error instanceof Error
          ? error
          : new Error("Could not serialize settings snapshot"),
      );
    }
    const persistence = this.persistenceChain
      .catch((): void => undefined)
      .then(() => this.host.saveData(snapshot));
    this.persistenceChain = persistence;
    return persistence;
  }
}
