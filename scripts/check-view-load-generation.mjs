import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { ViewLoadGeneration } = await jiti.import(
  "../src/view/managers/ViewLoadGeneration.ts",
);

const generations = new ViewLoadGeneration();
const fileA = { path: "A.md" };
const fileB = { path: "B.md" };
const firstA = generations.begin(fileA, "A.md\u000010");
assert.equal(generations.isCurrent(firstA, fileA, "A.md\u000010"), true);

const loadB = generations.begin(fileB, "B.md\u000020");
assert.equal(
  generations.isCurrent(firstA, fileA, "A.md\u000010"),
  false,
  "a later B load invalidates A",
);
assert.equal(generations.isCurrent(loadB, fileB, "B.md\u000020"), true);

const secondA = generations.begin(fileA, "A.md\u000010");
assert.equal(
  generations.isCurrent(firstA, fileA, "A.md\u000010"),
  false,
  "returning to the same A identity cannot revive its older continuation",
);
assert.equal(generations.isCurrent(secondA, fileA, "A.md\u000010"), true);

generations.invalidate();
assert.equal(
  generations.isCurrent(secondA, fileA, "A.md\u000010"),
  false,
  "clear, close, unload, or migration invalidates the active load",
);

const recreatedA = { path: "A.md" };
const recreatedToken = generations.begin(recreatedA, "A.md\u000030");
assert.equal(
  generations.isCurrent(recreatedToken, fileA, "A.md\u000010"),
  false,
  "same-path recreation is not the same load target",
);

process.stdout.write("view load generation checks passed\n");
