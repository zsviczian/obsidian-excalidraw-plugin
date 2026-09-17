export interface DependencyGraphNode<T> {
  value: T;
  childKeys: readonly string[];
}

export interface DependencyGraph<T> {
  nodes: ReadonlyMap<string, DependencyGraphNode<T>>;
}

/**
 * Returns each dependency reachable from rootKey once, excluding the root.
 */
export function collectReachableDependencyValues<T>(
  graph: DependencyGraph<T>,
  rootKey: string,
): T[] {
  const root = graph.nodes.get(rootKey);
  if (!root) {
    return [];
  }

  const values: T[] = [];
  const visited = new Set<string>([rootKey]);
  const pending = [rootKey];

  while (pending.length > 0) {
    const key = pending.pop();
    if (!key) {
      continue;
    }
    const node = graph.nodes.get(key);
    if (!node) {
      continue;
    }
    for (const childKey of node.childKeys) {
      if (visited.has(childKey)) {
        continue;
      }
      visited.add(childKey);
      const child = graph.nodes.get(childKey);
      if (!child) {
        continue;
      }
      values.push(child.value);
      pending.push(childKey);
    }
  }

  return values;
}

/**
 * Tests each reachable dependency at most once and stops at the first match.
 */
export function hasReachableDependency<T>(
  graph: DependencyGraph<T>,
  rootKey: string,
  predicate: (value: T) => boolean,
): boolean {
  const root = graph.nodes.get(rootKey);
  if (!root) {
    return false;
  }

  const visited = new Set<string>([rootKey]);
  const pending = [...root.childKeys];

  while (pending.length > 0) {
    const key = pending.pop();
    if (!key || visited.has(key)) {
      continue;
    }
    visited.add(key);

    const node = graph.nodes.get(key);
    if (!node) {
      continue;
    }
    if (predicate(node.value)) {
      return true;
    }
    pending.push(...node.childKeys);
  }

  return false;
}

/**
 * Returns the root's requested direct dependencies that contain a matching
 * file anywhere in their reachable subgraph. Cycles and shared descendants
 * are visited once per top-level dependency; distinct dependency paths are
 * deliberately never materialized.
 */
export function getMatchingTopLevelDependencyKeys<T>(
  graph: DependencyGraph<T>,
  rootKey: string,
  requestedTopLevelKeys: ReadonlySet<string>,
  predicate: (value: T) => boolean,
): Set<string> {
  const matchingTopLevelKeys = new Set<string>();
  const root = graph.nodes.get(rootKey);
  if (!root || requestedTopLevelKeys.size === 0) {
    return matchingTopLevelKeys;
  }

  for (const topLevelKey of root.childKeys) {
    if (
      !requestedTopLevelKeys.has(topLevelKey) ||
      matchingTopLevelKeys.has(topLevelKey)
    ) {
      continue;
    }

    // Exclude the root even when a nested drawing links back to it.
    const visited = new Set<string>([rootKey]);
    const pending = [topLevelKey];
    while (pending.length > 0) {
      const key = pending.pop();
      if (!key || visited.has(key)) {
        continue;
      }
      visited.add(key);

      const node = graph.nodes.get(key);
      if (!node) {
        continue;
      }
      if (predicate(node.value)) {
        matchingTopLevelKeys.add(topLevelKey);
        break;
      }
      pending.push(...node.childKeys);
    }
  }

  return matchingTopLevelKeys;
}
