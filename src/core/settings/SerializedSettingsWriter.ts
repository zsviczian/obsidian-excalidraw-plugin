/**
 * Serialized stable-snapshot writer for plugin settings.
 *
 * Also exports the canonical serialization shared with the settings manager:
 * JSON object key order carries no meaning, yet the on-disk bytes of
 * `data.json` depend on it. Multiple persistence paths may serialize the same
 * settings value with different key orders; an order-sensitive comparison
 * then classifies every incoming shape as drift and rewrites the file in an
 * endless loop. Sorting object keys recursively makes the serialized form a
 * pure function of the settings value, so key order alone can no longer
 * produce phantom changes.
 */

/** Persistence operation required by the serialized settings writer. */
export interface SerializedSettingsWriterHost<Snapshot> {
  saveData(data: Snapshot): Promise<void>;
}

const MAX_CANONICALIZATION_DEPTH = 100;

const canonicalizeValue = (value: unknown, depth: number): unknown => {
  if (value === null || depth >= MAX_CANONICALIZATION_DEPTH) {
    return value;
  }
  if (typeof value === "object") {
    // Array order is semantically significant and stays untouched.
    if (Array.isArray(value)) {
      return value.map((item) => canonicalizeValue(item, depth + 1));
    }
    // Null-prototype accumulator: an own "__proto__" key is stored as data
    // instead of being assigned through Object.prototype's setter.
    const source = value as Record<string, unknown>;
    const canonical = Object.create(null) as Record<string, unknown>;
    for (const key of Object.keys(source).sort()) {
      canonical[key] = canonicalizeValue(source[key], depth + 1);
    }
    return canonical;
  }
  return value;
};

/**
 * Serializes a settings payload with recursively sorted object keys.
 *
 * Values that only differ in key order produce identical strings, so a plain
 * string comparison becomes a semantically safe equality check.
 * Native serialization first preserves property-key-aware toJSON calls,
 * boxed primitive values, and JSON's omission and array replacement rules.
 */
export const stringifySettingsCanonically = (settings: unknown): string => {
  const snapshot: unknown = JSON.parse(JSON.stringify(settings));
  return JSON.stringify(canonicalizeValue(snapshot, 0));
};

/**
 * Serializes complete settings writes so an older save cannot finish after a
 * newer one. Each request captures an immutable canonical JSON snapshot
 * (recursively sorted object keys) before waiting for an earlier write.
 *
 * Unchanged saves are suppressed by comparing the canonical snapshot with the
 * last successfully persisted one *inside* the serialized queue — after all
 * preceding writes have settled — so an in-flight older write can never make
 * the writer skip a newer payload (A -> B -> A still persists the final A).
 * Writes requested with `force` bypass the suppression for repair flows that
 * must reach disk even when the content matches the last payload this writer
 * produced, such as replacing externally corrupted data.
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
  public persist(
    settings: Snapshot,
    options?: { force?: boolean },
  ): Promise<void> {
    let canonical: string;
    try {
      canonical = stringifySettingsCanonically(settings);
    } catch (error) {
      return Promise.reject(
        error instanceof Error
          ? error
          : new Error("Could not serialize settings snapshot"),
      );
    }
    const force = options?.force === true;
    const persistence = this.persistenceChain
      .catch((): void => undefined)
      .then(() => {
        if (!force && canonical === this.lastPersistedCanonical) {
          return;
        }
        const snapshot = JSON.parse(canonical) as Snapshot;
        return this.host.saveData(snapshot).then((): void => {
          this.lastPersistedCanonical = canonical;
        });
      });
    this.persistenceChain = persistence;
    return persistence;
  }
}
