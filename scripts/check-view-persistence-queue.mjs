import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { ViewPersistenceQueue } = await jiti.import(
  "../src/core/managers/ViewPersistenceQueue.ts",
);

const log = (message) => process.stdout.write(`${message}\n`);
const files = new Map([
  ["Drawing.md", { path: "Drawing.md", stat: { ctime: 10 } }],
]);
const writes = [];
const failures = [];
let releaseFirstWrite;
const firstWriteBlocked = new Promise((resolve) => {
  releaseFirstWrite = resolve;
});
let writeCount = 0;
const queue = new ViewPersistenceQueue({
  resolveFile: (path) => files.get(path) ?? null,
  write: async (file, text) => {
    writeCount += 1;
    if (writeCount === 1) {
      await firstWriteBlocked;
    }
    if (text === "fail") {
      throw new Error("injected write failure");
    }
    writes.push(`${file.path}:${text}`);
  },
  onFailure: (result) => failures.push(result.status),
});
const request = (text, overrides = {}) => ({
  producerId: "view-1",
  targetGeneration: 1,
  operationId: 1,
  requestedRevision: 1,
  capturedRevision: 1,
  filePath: "Drawing.md",
  expectedFileCtime: 10,
  text,
  hasNonDeletedElements: true,
  reason: "view-unload",
  ...overrides,
});

const first = queue.enqueue(request("first"));
const second = queue.enqueue(request("second", { operationId: 2 }));
await Promise.resolve();
assert.deepEqual(writes, [], "the first write is still deliberately blocked");
releaseFirstWrite();
assert.equal((await first).status, "persisted");
assert.equal((await second).status, "persisted");
assert.deepEqual(
  writes,
  ["Drawing.md:first", "Drawing.md:second"],
  "independent requests execute in accepted order without coalescing",
);

assert.equal(
  (await queue.enqueue(request("missing", { filePath: "Missing.md" }))).status,
  "target-missing",
);
assert.equal(
  (await queue.enqueue(request("", { operationId: 3 }))).status,
  "invalid-request",
);
assert.equal(
  (
    await queue.enqueue(
      request("recreated", { expectedFileCtime: 9, operationId: 4 }),
    )
  ).status,
  "target-changed",
);
assert.equal(
  (await queue.enqueue(request("fail", { operationId: 5 }))).status,
  "failed",
);
assert.equal(
  (await queue.enqueue(request("after-failure", { operationId: 6 }))).status,
  "persisted",
  "a failed request does not strand later work",
);
await queue.flush("Drawing.md");
assert.deepEqual(failures, [
  "target-missing",
  "invalid-request",
  "target-changed",
  "failed",
]);

log("view persistence queue checks passed");
