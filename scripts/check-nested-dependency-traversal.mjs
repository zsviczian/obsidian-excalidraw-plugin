import assert from "node:assert/strict";
import { createJiti } from "jiti";

const log = (message) => process.stdout.write(`${message}\n`);
const jiti = createJiti(import.meta.url);
const {
  collectReachableDependencyValues,
  getMatchingTopLevelDependencyKeys,
  hasReachableDependency,
} = await jiti.import("../src/utils/nestedDependencyTraversal.ts");

const graph = (entries) => ({
  nodes: new Map(
    Object.entries(entries).map(([key, childKeys]) => [
      key,
      { value: key, childKeys },
    ]),
  ),
});

const diamond = graph({
  root: ["left", "right"],
  left: ["shared"],
  right: ["shared"],
  shared: ["leaf"],
  leaf: [],
});
assert.deepEqual(
  collectReachableDependencyValues(diamond, "root"),
  ["left", "right", "shared", "leaf"],
  "direct dependencies retain metadata order and shared dependencies are returned once",
);
assert.deepEqual(
  getMatchingTopLevelDependencyKeys(
    diamond,
    "root",
    new Set(["left", "right"]),
    (value) => value === "leaf",
  ),
  new Set(["left", "right"]),
  "a changed shared descendant must invalidate every containing top-level dependency",
);

const cyclic = graph({
  root: ["a"],
  a: ["b"],
  b: ["root", "a", "changed"],
  changed: [],
});
let cycleVisits = 0;
assert.equal(
  hasReachableDependency(cyclic, "root", (value) => {
    cycleVisits++;
    return value === "changed";
  }),
  true,
  "cycles must terminate and still find reachable changes",
);
assert.ok(cycleVisits <= 3, "a cycle must not cause repeated visits");
assert.deepEqual(
  getMatchingTopLevelDependencyKeys(
    cyclic,
    "root",
    new Set(["a"]),
    (value) => value === "root",
  ),
  new Set(),
  "a back-link to the root must not invalidate a top-level dependency",
);

const layeredEntries = { root: ["top"] };
const layerCount = 22;
for (let layer = 0; layer < layerCount; layer++) {
  const left = `left-${layer}`;
  const right = `right-${layer}`;
  const nextLeft = `left-${layer + 1}`;
  const nextRight = `right-${layer + 1}`;
  layeredEntries[left] = [nextLeft, nextRight];
  layeredEntries[right] = [nextLeft, nextRight];
}
layeredEntries.top = ["left-0", "right-0"];
layeredEntries[`left-${layerCount}`] = [];
layeredEntries[`right-${layerCount}`] = [];
const layered = graph(layeredEntries);
let layeredVisits = 0;
assert.equal(
  hasReachableDependency(layered, "root", () => {
    layeredVisits++;
    return false;
  }),
  false,
  "an unchanged dependency graph must report no change",
);
assert.equal(
  layeredVisits,
  layered.nodes.size - 1,
  "a graph with exponentially many conceptual paths must visit each node once",
);

assert.deepEqual(
  getMatchingTopLevelDependencyKeys(
    diamond,
    "root",
    new Set(["left"]),
    (value) => value === "right",
  ),
  new Set(),
  "only requested direct dependencies may be returned",
);

log("nested dependency traversal checks passed");
