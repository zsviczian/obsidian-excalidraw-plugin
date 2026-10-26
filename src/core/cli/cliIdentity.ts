/** Exact, segmented CLI identity; never serializes or hashes asset payloads as a group. */
import { CLIError } from "./cliProtocol";

/**
 * Retain immutable primitive strings directly, including arbitrarily large data URLs.
 * Copy every mutable container/record so in-place edits cannot mutate the earlier
 * snapshot. This intentionally avoids structuredClone, JSON.stringify and hashing
 * on the source assets. A view owns at most one cached identity per CLI session.
 */
export function captureCLIIdentity(value: unknown, parents = new WeakSet<object>(), depth = 0): unknown {
  if (!value || typeof value !== "object") return value;
  if (depth > 60 || parents.has(value)) throw new CLIError("INTERNAL_ERROR", "Live metadata could not be inspected safely.");
  parents.add(value);
  let result: unknown;
  if (value instanceof Date) result = value.getTime();
  else if (value instanceof Map) result = new Map([...(value as Map<unknown, unknown>)].map(([key, entry]) => [captureCLIIdentity(key, parents, depth + 1), captureCLIIdentity(entry, parents, depth + 1)]));
  else if (value instanceof Set) result = new Set([...value].map(entry => captureCLIIdentity(entry, parents, depth + 1)));
  else if (ArrayBuffer.isView(value)) result = Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  else if (value instanceof ArrayBuffer) result = Array.from(new Uint8Array(value));
  else if (Array.isArray(value)) result = value.map(entry => captureCLIIdentity(entry, parents, depth + 1));
  else {
    const copy = Object.create(null) as Record<string, unknown>;
    for (const [key, entry] of Object.entries(value)) copy[key] = captureCLIIdentity(entry, parents, depth + 1);
    result = copy;
  }
  parents.delete(value);
  return result;
}

/** Exact recursive equality: a last-byte asset change cannot collide with a hash. */
export function sameCLIIdentity(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (a instanceof Map || b instanceof Map) {
    if (!(a instanceof Map) || !(b instanceof Map) || a.size !== b.size) return false;
    const aEntries = (a as Map<unknown, unknown>).entries(), bEntries = (b as Map<unknown, unknown>).entries();
    for (let i = 0; i < a.size; i++) {
      const left = aEntries.next().value as [unknown, unknown], right = bEntries.next().value as [unknown, unknown];
      if (!sameCLIIdentity(left[0], right[0]) || !sameCLIIdentity(left[1], right[1])) return false;
    }
    return true;
  }
  if (a instanceof Set || b instanceof Set) {
    if (!(a instanceof Set) || !(b instanceof Set) || a.size !== b.size) return false;
    const left = a.values(), right = b.values();
    for (let i = 0; i < a.size; i++) if (!sameCLIIdentity(left.next().value, right.next().value)) return false;
    return true;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a), bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
  return aKeys.every((key, i) => key === bKeys[i] && sameCLIIdentity(left[key], right[key]));
}
