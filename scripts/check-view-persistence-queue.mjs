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
const backups = [];
const persistenceEvents = [];
const failures = [];
const backupScheduleFailures = [];
const persistedCallbacks = [];
const persistedCallbackFailures = [];
const persistenceActivities = [];
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
    persistenceEvents.push(`write:${text}`);
  },
  scheduleBackup: (filePath, text) => {
    if (text === "backup-schedule-fail") {
      throw new Error("injected backup scheduling failure");
    }
    backups.push(`${filePath}:${text}`);
    persistenceEvents.push(`backup:${text}`);
  },
  now: () => Date.now(),
  scheduleCleanup: (callback, delayMs) => setTimeout(callback, delayMs),
  cancelCleanup: (timer) => clearTimeout(timer),
  onFailure: (result) => failures.push(result.status),
  onBackupScheduleFailure: (_error, failedRequest) =>
    backupScheduleFailures.push(failedRequest.text),
  onPersisted: (persistedRequest) => {
    persistedCallbacks.push(persistedRequest.text);
    if (persistedRequest.text === "completion-callback-fail") {
      throw new Error("injected completion callback failure");
    }
  },
  onPersistedCallbackFailure: (_error, failedRequest) => {
    persistedCallbackFailures.push(failedRequest.text);
    throw new Error("injected completion diagnostic failure");
  },
  beginPersistenceActivity: (activeRequest) => {
    persistenceActivities.push(`start:${activeRequest.text}`);
    return () => persistenceActivities.push(`end:${activeRequest.text}`);
  },
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
let liveLeaseAcquired = false;
const liveLeasePromise = queue.acquireWriteLease("Drawing.md").then((lease) => {
  liveLeaseAcquired = true;
  return lease;
});
await Promise.resolve();
assert.deepEqual(writes, [], "the first write is still deliberately blocked");
assert.equal(
  liveLeaseAcquired,
  false,
  "a live write cannot overtake detached requests already accepted for the path",
);
releaseFirstWrite();
assert.equal((await first).status, "persisted");
assert.equal((await second).status, "persisted");
assert.deepEqual(
  writes,
  ["Drawing.md:first", "Drawing.md:second"],
  "independent requests execute in accepted order without coalescing",
);

const liveLease = await liveLeasePromise;
const behindLiveLease = queue.enqueue(
  request("behind-live", { operationId: 3 }),
);
await Promise.resolve();
assert.deepEqual(
  writes,
  ["Drawing.md:first", "Drawing.md:second"],
  "a detached write cannot overlap an acquired live write lease",
);
liveLease.release();
liveLease.release();
assert.equal((await behindLiveLease).status, "persisted");
assert.deepEqual(writes, [
  "Drawing.md:first",
  "Drawing.md:second",
  "Drawing.md:behind-live",
]);

queue.registerMigrationHandoff({
  leafId: "leaf-1",
  request: request("migration", {
    producerId: "popout-view",
    operationId: 4,
    reason: "window-migration",
  }),
});
const behindMigration = queue.enqueue(
  request("behind-migration", { operationId: 5 }),
);
await Promise.resolve();
assert.deepEqual(
  writes,
  ["Drawing.md:first", "Drawing.md:second", "Drawing.md:behind-live"],
  "registering a migration handoff reserves order without starting a write",
);
const migration = queue.consumeMigrationHandoff("leaf-1", "Drawing.md");
assert.ok(migration, "the replacement consumes the matching handoff");
assert.equal(migration.request.text, "migration");
assert.equal((await migration.completion).status, "persisted");
assert.equal((await behindMigration).status, "persisted");
assert.deepEqual(writes, [
  "Drawing.md:first",
  "Drawing.md:second",
  "Drawing.md:behind-live",
  "Drawing.md:migration",
  "Drawing.md:behind-migration",
]);
assert.deepEqual(
  backups,
  writes,
  "detached and migration backups follow successful source-write order",
);
assert.deepEqual(
  persistenceEvents,
  [
    "write:first",
    "backup:first",
    "write:second",
    "backup:second",
    "write:behind-live",
    "backup:behind-live",
    "write:migration",
    "backup:migration",
    "write:behind-migration",
    "backup:behind-migration",
  ],
  "each backup is scheduled before the next accepted source write starts",
);
assert.deepEqual(
  persistenceActivities,
  [
    "start:first",
    "end:first",
    "start:second",
    "end:second",
    "start:behind-live",
    "end:behind-live",
    "start:migration",
    "end:migration",
    "start:behind-migration",
    "end:behind-migration",
  ],
  "detached and migration writes expose their complete physical activity",
);

queue.registerMigrationHandoff({
  leafId: "leaf-discarded",
  request: request("discarded-migration", {
    operationId: 6,
    reason: "window-migration",
  }),
});
const behindDiscardedMigration = queue.enqueue(
  request("after-discard", { operationId: 7 }),
);
queue.discardMigrationHandoff("leaf-discarded");
assert.equal((await behindDiscardedMigration).status, "persisted");
assert.equal(
  writes.includes("Drawing.md:discarded-migration"),
  false,
  "discarding a failed replacement releases order without writing",
);

queue.registerMigrationHandoff({
  leafId: "leaf-mismatch",
  request: request("wrong-target-migration", {
    operationId: 8,
    reason: "window-migration",
  }),
});
assert.equal(
  queue.consumeMigrationHandoff("leaf-mismatch", "Other.md"),
  null,
  "a mismatched replacement must not receive another file's text",
);

assert.equal(
  (await queue.enqueue(request("missing", { filePath: "Missing.md" }))).status,
  "target-missing",
);
assert.equal(
  (await queue.enqueue(request("", { operationId: 9 }))).status,
  "invalid-request",
);
assert.equal(
  (
    await queue.enqueue(
      request("recreated", { expectedFileCtime: 9, operationId: 10 }),
    )
  ).status,
  "target-changed",
);
assert.equal(
  (await queue.enqueue(request("fail", { operationId: 11 }))).status,
  "failed",
);
assert.equal(
  backups.includes("Drawing.md:fail"),
  false,
  "a failed source write must preserve the prior backup",
);
const backupsBeforeEmptySceneWrite = backups.length;
assert.equal(
  (
    await queue.enqueue(
      request("empty-scene", {
        operationId: 12,
        hasNonDeletedElements: false,
      }),
    )
  ).status,
  "persisted",
);
assert.equal(
  backups.length,
  backupsBeforeEmptySceneWrite,
  "a successful empty-scene write preserves the prior backup",
);
assert.equal(
  (await queue.enqueue(request("backup-schedule-fail", { operationId: 13 })))
    .status,
  "persisted",
  "backup scheduling failure does not reclassify source persistence",
);
assert.deepEqual(backupScheduleFailures, ["backup-schedule-fail"]);
assert.equal(
  (await queue.enqueue(request("after-failure", { operationId: 14 }))).status,
  "persisted",
  "a failed request does not strand later work",
);
assert.equal(
  (
    await queue.enqueue(
      request("completion-callback-fail", { operationId: 15 }),
    )
  ).status,
  "persisted",
  "a completion callback failure cannot reclassify a successful source write",
);
assert.deepEqual(
  persistedCallbacks,
  [
    "first",
    "second",
    "behind-live",
    "migration",
    "behind-migration",
    "after-discard",
    "empty-scene",
    "backup-schedule-fail",
    "after-failure",
    "completion-callback-fail",
  ],
  "only successful physical writes publish persistence completion",
);
assert.deepEqual(persistedCallbackFailures, ["completion-callback-fail"]);
assert.deepEqual(failures, [
  "target-changed",
  "target-missing",
  "invalid-request",
  "target-changed",
  "failed",
]);

let fakeNow = 0;
let cleanupCallback = null;
const expiryWrites = [];
const expiryFailures = [];
const expiryQueue = new ViewPersistenceQueue({
  resolveFile: (path) => files.get(path) ?? null,
  write: async (file, text) => expiryWrites.push(`${file.path}:${text}`),
  scheduleBackup: () => undefined,
  now: () => fakeNow,
  scheduleCleanup: (callback) => {
    cleanupCallback = callback;
    return 1;
  },
  cancelCleanup: () => {
    cleanupCallback = null;
  },
  handoffTtlMs: 10,
  onFailure: (result) => expiryFailures.push(result.status),
});
expiryQueue.registerMigrationHandoff({
  leafId: "leaf-expired",
  request: request("expired-migration", {
    operationId: 16,
    reason: "window-migration",
  }),
});
const behindExpiredMigration = expiryQueue.enqueue(
  request("after-expiry", { operationId: 17 }),
);
assert.ok(cleanupCallback, "an abandoned handoff has a bounded cleanup");
fakeNow = 10;
cleanupCallback();
assert.equal((await behindExpiredMigration).status, "persisted");
assert.deepEqual(expiryWrites, ["Drawing.md:after-expiry"]);
assert.deepEqual(expiryFailures, ["handoff-expired"]);

log("view persistence queue checks passed");
