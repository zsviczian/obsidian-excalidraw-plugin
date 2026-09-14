import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { BackupPersistenceQueue } = await jiti.import(
  "../src/shared/BackupPersistenceQueue.ts",
);

const log = (message) => process.stdout.write(`${message}\n`);
const timers = new Map();
let nextTimer = 1;
const ownerWindow = {
  setTimeout: (callback) => {
    const timer = nextTimer++;
    timers.set(timer, callback);
    return timer;
  },
  clearTimeout: (timer) => timers.delete(timer),
};
const runNextTimer = () => {
  const entry = timers.entries().next().value;
  assert.ok(entry, "a backup drain timer is pending");
  const [timer, callback] = entry;
  timers.delete(timer);
  callback();
};

const writes = [];
const errors = [];
let releaseSlowWrite;
const slowWrite = new Promise((resolve) => {
  releaseSlowWrite = resolve;
});
const queue = new BackupPersistenceQueue({
  ownerWindow,
  write: async (filepath, data) => {
    if (data === "slow") {
      await slowWrite;
    }
    if (data === "fail") {
      throw new Error("injected backup failure");
    }
    writes.push(`${filepath}:${data}`);
  },
  onError: (error, stage) => errors.push(`${stage}:${error.message}`),
});

assert.equal(queue.schedule("Drawing.md", "old", 50), false);
assert.equal(queue.schedule("Drawing.md", "new", 50), true);
assert.equal(timers.size, 1, "only the newest delayed payload remains queued");
runNextTimer();
await queue.flush("Drawing.md");
assert.deepEqual(writes, ["Drawing.md:new"]);

queue.schedule("Drawing.md", "slow", 50);
runNextTimer();
await Promise.resolve();
assert.equal(
  queue.schedule("Drawing.md", "newest", 50),
  true,
  "a newer payload is retained behind an active backup write",
);
releaseSlowWrite();
await queue.flush("Drawing.md");
assert.deepEqual(writes, [
  "Drawing.md:new",
  "Drawing.md:slow",
  "Drawing.md:newest",
]);

queue.schedule("Drawing.md", "fail", 50);
runNextTimer();
await queue.flush("Drawing.md");
assert.equal(errors.length, 1, "backup failure is reported independently");
queue.schedule("Drawing.md", "after-failure", 50);
runNextTimer();
await queue.flush("Drawing.md");
assert.equal(writes.at(-1), "Drawing.md:after-failure");

queue.schedule("Drawing.md", "cancelled", 50);
queue.schedule("Other.md", "also-cancelled", 50);
await queue.cancelAll();
assert.equal(timers.size, 0, "clearing backups cancels every pending write");
assert.equal(writes.includes("Drawing.md:cancelled"), false);
assert.equal(writes.includes("Other.md:also-cancelled"), false);

log("backup persistence queue checks passed");
