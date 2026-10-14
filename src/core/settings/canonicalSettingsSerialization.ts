/**
 * Canonical settings serialization.
 *
 * JSON object key order carries no meaning, yet the on-disk bytes of
 * `data.json` depend on it. The same settings value can be serialized by
 * several writers (the settings manager, declarative settings tab rebuilds,
 * externally synchronized copies), and when those writers emit keys in
 * different orders, an order-sensitive string comparison classifies every
 * incoming shape as drift and rewrites the file, ping-ponging between two
 * byte layouts indefinitely.
 *
 * Sorting object keys recursively before `JSON.stringify` makes the
 * serialized form a pure function of the settings value, so key order alone
 * can no longer produce phantom changes.
 */

const MAX_CANONICALIZATION_DEPTH = 100;

const canonicalizeValue = (value: unknown, depth: number): unknown => {
  if (value === null || depth >= MAX_CANONICALIZATION_DEPTH) {
    return value;
  }
  if (Array.isArray(value)) {
    // Array order is semantically significant and stays untouched.
    return value.map((item) => canonicalizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const canonical: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      canonical[key] = canonicalizeValue(record[key], depth + 1);
    }
    return canonical;
  }
  return value;
};

/**
 * Serializes a settings payload with recursively sorted object keys.
 *
 * Values that only differ in key order produce identical strings, so a
 * plain string comparison becomes a semantically safe equality check.
 */
export const stringifySettingsCanonically = (settings: unknown): string =>
  JSON.stringify(canonicalizeValue(settings, 0));
