import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { AutoexportJobQueue } = await jiti.import(
  "../src/core/managers/AutoexportJobQueue.ts",
);
const { KeyedAsyncLock } = await jiti.import(
  "../src/core/managers/KeyedAsyncLock.ts",
);
const { AutoexportSaveBatchGate } = await jiti.import(
  "../src/core/managers/AutoexportSaveBatchGate.ts",
);

const log = (message) => process.stdout.write(`${message}\n`);
const eventually = async (predicate, message) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.fail(message);
};

let nextTimer = 1;
const batchTimers = new Map();
const batchInvalidations = [];
const batchReleases = [];
const batchGate = new AutoexportSaveBatchGate({
  scheduler: {
    setTimeout: (callback) => {
      const timer = nextTimer++;
      batchTimers.set(timer, callback);
      return timer;
    },
    clearTimeout: (timer) => batchTimers.delete(timer),
  },
  settleDelayMs: 500,
  getSourceKey: (job) => job.source,
  shouldRender: (job) => job.render,
  invalidate: (job) => batchInvalidations.push(job.id),
  release: (job) => batchReleases.push(job.id),
});
const endFirstActivity = batchGate.beginActivity("drawing");
const endSecondActivity = batchGate.beginActivity("drawing");
batchGate.publish({ id: "N", source: "drawing", render: true });
batchGate.publish({ id: "N+1", source: "drawing", render: true });
assert.deepEqual(batchReleases, [], "active saves hold all heavy exports");
endFirstActivity();
assert.equal(batchTimers.size, 0, "all source save loops must become idle");
endSecondActivity();
assert.equal(
  batchTimers.size,
  1,
  "the final save activity starts one settle timer",
);
batchGate.publish({ id: "N+2", source: "drawing", render: true });
assert.equal(
  batchTimers.size,
  1,
  "a newer persisted state resets the quiet timer",
);
const finalBatchTimer = Array.from(batchTimers.values())[0];
batchTimers.clear();
finalBatchTimer();
assert.deepEqual(
  batchInvalidations,
  ["N", "N+1", "N+2"],
  "every persisted state invalidates older output immediately",
);
assert.deepEqual(
  batchReleases,
  ["N+2"],
  "only the newest persisted state renders after the save batch settles",
);

const endBarrierActivity = batchGate.beginActivity("drawing");
batchGate.publish({ id: "render", source: "drawing", render: true });
batchGate.publish({ id: "no-output", source: "drawing", render: false });
endBarrierActivity();
assert.equal(
  batchTimers.size,
  0,
  "a final no-output state cancels pending render",
);
assert.deepEqual(batchReleases, ["N+2"]);
batchGate.destroy();

const deferredEvents = [];
let scheduledDrain = null;
const deferredQueue = new AutoexportJobQueue({
  getSourceKey: (job) => job.source,
  getDestinationKeys: (job) => job.destinations,
  execute: async (job) => {
    deferredEvents.push(job.id);
  },
  schedule: (callback) => {
    scheduledDrain = callback;
  },
});
deferredQueue.enqueue({
  id: "deferred",
  source: "drawing",
  destinations: ["drawing.png"],
});
assert.deepEqual(
  deferredEvents,
  [],
  "enqueue assigns order without starting heavy work synchronously",
);
assert.ok(scheduledDrain, "the coordinator scheduler receives the drain");
scheduledDrain();
await eventually(
  () => deferredEvents.includes("deferred"),
  "the scheduled drain should execute",
);

const started = [];
const written = [];
let releaseFirst;
const firstBlocked = new Promise((resolve) => {
  releaseFirst = resolve;
});
const queue = new AutoexportJobQueue({
  getSourceKey: (job) => job.source,
  getDestinationKeys: (job) => job.destinations,
  execute: async (job, guard) => {
    started.push(job.id);
    if (job.id === "N") {
      await firstBlocked;
    }
    if (
      guard.isCurrentSource() &&
      job.destinations.every((path) => guard.isCurrentDestination(path))
    ) {
      written.push(job.id);
    }
  },
});

queue.enqueue({ id: "N", source: "drawing", destinations: ["drawing.png"] });
queue.enqueue({ id: "N+1", source: "drawing", destinations: ["drawing.png"] });
queue.enqueue({ id: "N+2", source: "drawing", destinations: ["drawing.png"] });
releaseFirst();
await eventually(
  () => written.includes("N+2"),
  "the newest trailing source request should complete",
);
assert.deepEqual(
  started,
  ["N", "N+2"],
  "only the newest trailing source request is retained",
);
assert.deepEqual(
  written,
  ["N+2"],
  "an obsolete active render cannot write after a newer persisted request",
);

let releaseCollision;
const collisionBlocked = new Promise((resolve) => {
  releaseCollision = resolve;
});
const collisionWrites = [];
const collisionQueue = new AutoexportJobQueue({
  getSourceKey: (job) => job.source,
  getDestinationKeys: (job) => job.destinations,
  execute: async (job, guard) => {
    if (job.id === "source-A") {
      await collisionBlocked;
    }
    if (guard.isCurrentDestination(job.destinations[0])) {
      collisionWrites.push(job.id);
    }
  },
});
collisionQueue.enqueue({
  id: "source-A",
  source: "A",
  destinations: ["shared.png"],
});
collisionQueue.enqueue({
  id: "source-B",
  source: "B",
  destinations: ["shared.png"],
});
await eventually(
  () => collisionWrites.includes("source-B"),
  "the newer colliding destination should write",
);
releaseCollision();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.deepEqual(
  collisionWrites,
  ["source-B"],
  "an older job from another source cannot overwrite a newer destination",
);

let releaseBarrier;
const barrierBlocked = new Promise((resolve) => {
  releaseBarrier = resolve;
});
const barrierWrites = [];
const barrierQueue = new AutoexportJobQueue({
  getSourceKey: (job) => job.source,
  getDestinationKeys: (job) => job.destinations,
  execute: async (job, guard) => {
    if (job.id === "export") {
      await barrierBlocked;
    }
    if (guard.isCurrentSource()) {
      barrierWrites.push(job.id);
    }
  },
});
barrierQueue.enqueue({
  id: "export",
  source: "drawing",
  destinations: ["drawing.svg"],
});
barrierQueue.enqueue({ id: "barrier", source: "drawing", destinations: [] });
releaseBarrier();
await eventually(
  () => barrierWrites.includes("barrier"),
  "a persistence barrier should settle",
);
assert.deepEqual(
  barrierWrites,
  ["barrier"],
  "a newer persisted revision without outputs cancels older rendering",
);

const recoveryStarted = [];
const recoveryWrites = [];
let releaseFailedExport;
const failedExportBlocked = new Promise((resolve) => {
  releaseFailedExport = resolve;
});
const recoveryQueue = new AutoexportJobQueue({
  getSourceKey: (job) => job.source,
  getDestinationKeys: (job) => job.destinations,
  execute: async (job, guard) => {
    recoveryStarted.push(job.id);
    if (job.id === "failed") {
      await failedExportBlocked;
      throw new Error("injected export failure");
    }
    if (guard.isCurrentSource()) {
      recoveryWrites.push(job.id);
    }
  },
  onFailure: () => {
    throw new Error("injected diagnostic failure");
  },
});
recoveryQueue.enqueue({
  id: "failed",
  source: "drawing",
  destinations: ["drawing.png"],
});
recoveryQueue.enqueue({
  id: "recovery",
  source: "drawing",
  destinations: ["drawing.png"],
});
releaseFailedExport();
await eventually(
  () => recoveryWrites.includes("recovery"),
  "a newer trailing export should run after render and diagnostic failures",
);
assert.deepEqual(recoveryStarted, ["failed", "recovery"]);
assert.deepEqual(recoveryWrites, ["recovery"]);

let releaseDestroyed;
const destroyedBlocked = new Promise((resolve) => {
  releaseDestroyed = resolve;
});
const destroyedWrites = [];
const destroyedQueue = new AutoexportJobQueue({
  getSourceKey: (job) => job.source,
  getDestinationKeys: (job) => job.destinations,
  execute: async (job, guard) => {
    await destroyedBlocked;
    if (guard.isCurrentSource()) {
      destroyedWrites.push(job.id);
    }
  },
});
destroyedQueue.enqueue({
  id: "old-runtime",
  source: "drawing",
  destinations: ["drawing.png"],
});
await Promise.resolve();
destroyedQueue.destroy();
destroyedQueue.enqueue({
  id: "after-destroy",
  source: "drawing",
  destinations: ["drawing.png"],
});
releaseDestroyed();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.deepEqual(
  destroyedWrites,
  [],
  "an unloaded plugin runtime cannot publish pending or later output",
);

const writeLock = new KeyedAsyncLock();
const lockedEvents = [];
let releaseLockedWrite;
const lockedWrite = new Promise((resolve) => {
  releaseLockedWrite = resolve;
});
const firstLocked = writeLock.run("shared.png", async () => {
  lockedEvents.push("first-start");
  await lockedWrite;
  lockedEvents.push("first-end");
});
const secondLocked = writeLock.run("shared.png", async () => {
  lockedEvents.push("second");
});
const independent = writeLock.run("other.png", async () => {
  lockedEvents.push("independent");
});
await independent;
assert.deepEqual(
  lockedEvents,
  ["first-start", "independent"],
  "different destinations remain independent while one output is blocked",
);
releaseLockedWrite();
await Promise.all([firstLocked, secondLocked]);
assert.deepEqual(
  lockedEvents,
  ["first-start", "independent", "first-end", "second"],
  "writes to one resolved destination execute in accepted order",
);

log("autoexport job queue checks passed");
