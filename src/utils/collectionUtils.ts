/**
 * Converts identifiers or objects with identifiers into a keyed lookup map.
 *
 * @param items - Values to index, or an existing map to reuse.
 * @returns The original map when one is supplied; otherwise, a new map keyed
 * by each string value or object's `id` property.
 */
export function arrayToMap<T extends { id: string } | string>(
  items: readonly T[] | Map<string, T>,
) {
  if (items instanceof Map) {
    return items;
  }
  return items.reduce((acc: Map<string, T>, element) => {
    acc.set(typeof element === "string" ? element : element.id, element);
    return acc;
  }, new Map());
}
