import assert from "node:assert/strict";
import test from "node:test";
import { classifySettingsDataLoad, isSettingsDataRecord } from "../../../src/core/settings/settingsDataValidation.ts";
import { SettingsPersistenceQueue } from "../../../src/core/settings/SettingsPersistenceQueue.ts";

test("missing first-install settings are distinct from corruption and synchronized records", () => {
  for (const value of [null, undefined]) for (const fileState of ["missing", "empty", "present", "unknown"]) for (const loadFailed of [false, true]) for (const isInitialLoad of [false, true]) {
    assert.equal(classifySettingsDataLoad({ value, fileState, loadFailed, isInitialLoad }), fileState === "missing" && !loadFailed && isInitialLoad ? "first-installation" : "invalid");
  }
  for (const value of [[], "corrupt", 10, true]) assert.equal(isSettingsDataRecord(value), false);
  for (const value of [{}, { unknownFutureSetting: { retained: true } }]) {
    assert.equal(classifySettingsDataLoad({ value, fileState: "present", loadFailed: false, isInitialLoad: false }), "valid");
  }
});
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
test("settings queue coalesces writes, waits for in-flight revisions and applies actions after success", async t => {
  const before = globalThis.window; globalThis.window = globalThis; t.after(() => { globalThis.window = before; });
  const first = deferred(), writes = []; let actions = 0;
  const queue = new SettingsPersistenceQueue({ persistSettings: async () => { writes.push(writes.length + 1); if (writes.length === 1) await first.promise; }, applyPendingActions: async () => { actions++; } }, 10000);
  const a = queue.enqueue(), b = queue.enqueue(), running = queue.flush();
  await Promise.resolve(); const c = queue.enqueue();
  first.resolve(); await Promise.all([a, b, c, running]);
  assert.deepEqual(writes, [1, 2]); assert.equal(actions, 1);
  await queue.flush(); assert.deepEqual(writes, [1, 2]);
});
test("settings write failure rejects waiters, skips actions and permits a successful retry", async t => {
  const before = globalThis.window; globalThis.window = globalThis; t.after(() => { globalThis.window = before; });
  let failed = true, actions = 0;
  const queue = new SettingsPersistenceQueue({ persistSettings: async () => { if (failed) throw Error("owned disk failure"); }, applyPendingActions: async () => { actions++; } }, 10000);
  const waiting = queue.enqueue();
  await Promise.all([assert.rejects(waiting, /owned disk failure/), assert.rejects(queue.flush(), /owned disk failure/)]);
  assert.equal(actions, 0); failed = false;
  const next = queue.enqueue(); await queue.flush(); await next; assert.equal(actions, 1);
});
