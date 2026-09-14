import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const {
  classifyObservedSaveContent,
  isRedundantObservedSaveContent,
  isSameSaveOperation,
} = await jiti.import("../src/view/managers/saveContentClassification.ts");

const log = (message) => process.stdout.write(`${message}\n`);
const prepared = (overrides = {}) => ({
  producerId: "view-1",
  targetGeneration: 2,
  operationId: 4,
  requestedRevision: 5,
  capturedRevision: 6,
  filePath: "Drawing.md",
  text: "saved",
  hasNonDeletedElements: true,
  ...overrides,
});
const classify = (overrides = {}) =>
  classifyObservedSaveContent({
    filePath: "Drawing.md",
    targetGeneration: 2,
    observedText: "saved",
    currentRevision: 6,
    savedRevision: 6,
    successfulWrite: prepared(),
    latestAttempt: null,
    acceptedContent: null,
    ...overrides,
  });

assert.deepEqual(classify(), {
  kind: "matches-successful-write",
  hasNewerLocalRevision: false,
});
assert.equal(isRedundantObservedSaveContent(classify()), true);
assert.deepEqual(classify({ currentRevision: 7 }), {
  kind: "matches-successful-write",
  hasNewerLocalRevision: true,
});
assert.equal(
  isRedundantObservedSaveContent(classify({ currentRevision: 7 })),
  true,
  "matching persisted bytes remain redundant without acknowledging newer local work",
);
assert.equal(
  classify({
    successfulWrite: null,
    acceptedContent: {
      filePath: "Drawing.md",
      targetGeneration: 2,
      text: "saved",
    },
  }).kind,
  "matches-accepted-content",
);
assert.deepEqual(
  classify({
    currentRevision: 7,
    savedRevision: 6,
    successfulWrite: null,
    acceptedContent: {
      filePath: "Drawing.md",
      targetGeneration: 2,
      text: "saved",
    },
  }),
  {
    kind: "matches-accepted-content",
    hasNewerLocalRevision: true,
  },
);
assert.equal(
  classify({
    successfulWrite: null,
    latestAttempt: { preparedSave: prepared(), state: "prepared" },
  }).kind,
  "matches-pending-write",
);
assert.equal(
  isSameSaveOperation(prepared(), prepared()),
  true,
  "the same operation may complete its prepared record",
);
assert.equal(
  isSameSaveOperation(prepared(), prepared({ operationId: 5 })),
  false,
  "an older completion must not replace a newer operation",
);
assert.equal(
  classify({
    successfulWrite: null,
    latestAttempt: { preparedSave: prepared(), state: "failed" },
  }).kind,
  "matches-failed-write",
);
assert.equal(
  classify({
    successfulWrite: null,
    latestAttempt: { preparedSave: prepared(), state: "handed-off" },
  }).kind,
  "matches-unconfirmed-handoff",
);
assert.equal(
  classify({ observedText: "external" }).kind,
  "different-from-known-content",
);
assert.equal(
  isRedundantObservedSaveContent(classify({ observedText: "external" })),
  false,
);
assert.equal(classify({ targetGeneration: 3 }).kind, "unknown");
assert.equal(
  classify({
    successfulWrite: prepared({ targetGeneration: 1 }),
    latestAttempt: {
      preparedSave: prepared({ targetGeneration: 1 }),
      state: "successful",
    },
  }).kind,
  "unknown",
);

log("save content classification checks passed");
