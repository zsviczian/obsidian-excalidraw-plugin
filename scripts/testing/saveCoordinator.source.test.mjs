import assert from "node:assert/strict";
import test from "node:test";
import { sourceHarness } from "./sourceHarness.mjs";
const tick = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function setup(t) {
  const oldWindow = globalThis.window, timers = new Map(), errors = []; let timer = 0, activity = 0;
  globalThis.window = { setTimeout(fn) { timers.set(++timer, fn); return timer; }, clearTimeout(id) { timers.delete(id); } };
  const graph = sourceHarness({ obsidian: { Notice: class {} }, "../../lang/helpers": { t: key => key }, "../../utils/coreUtils": { errorlog: value => errors.push(value) } });
  t.after(() => { coordinator.destroy(); graph.close(); globalThis.window = oldWindow; });
  const { ViewSaveCoordinator } = await graph.importModule("src/view/managers/ViewSaveCoordinator.ts");
  const view = { id: "owned-view", file: { path: "owned.excalidraw.md" }, semaphores: { viewunload: false }, isLoaded: true, autosaveInterval: 10000,
    plugin: { autosaveEnabled: true }, excalidrawAPI: { getAppState: () => ({ activeTool: { type: "selection" }, editingTextElement: null, newElement: null }) }, isSameFileEditingActive: () => false };
  const deps = { performSave: async operation => ({ status: "persisted", preparedSave: { ...operation, filePath: view.file.path, capturedRevision: coordinator.getCurrentRevisionForSaveCapture(), text: "durable", hasNonDeletedElements: true } }),
    requestSave: () => coordinator.save(), isSynchronizing: () => false, yieldToPendingExternalSynchronization: async () => {}, isDirty: () => coordinator.isDirty(), checkSceneVersion() {},
    refreshCanvasOffset() {}, getFreedrawLastActiveTimestamp: () => 0, markDirtyVisuals() {}, clearDirtyVisuals() {}, beginAutoexportSaveActivity: () => { activity++; return () => activity--; } };
  const coordinator = new ViewSaveCoordinator(view, deps); coordinator.beginSaveTarget();
  return { coordinator, view, deps, timers, errors, activity: () => activity };
}
test("failed saves keep dirty state and successful retry acknowledges only captured bytes", async t => {
  const { coordinator: c, deps, activity } = await setup(t); c.setDirty(); const original = deps.performSave;
  deps.performSave = async () => ({ status: "failed" });
  const failed = await c.saveWithOutcome(); assert.equal(failed.status, "failed"); assert.equal(failed.acknowledgedRevision, null); assert.equal(c.isDirty(), true); assert.equal(activity(), 0);
  deps.performSave = original; const saved = await c.saveWithOutcome(); assert.equal(saved.status, "persisted"); assert.equal(saved.acknowledgedRevision, saved.currentRevision); assert.equal(c.isDirty(), false); assert.equal(activity(), 0);
});
test("an edit during a save queues its own later snapshot instead of clearing the newer dirty revision", async t => {
  const { coordinator: c, deps } = await setup(t), gate = deferred(), writes = [];
  deps.performSave = async operation => { const capturedRevision = c.getCurrentRevisionForSaveCapture(); writes.push(capturedRevision); if (writes.length === 1) await gate.promise; return { status: "persisted", preparedSave: { ...operation, capturedRevision, filePath: "owned.excalidraw.md", text: "revision-" + capturedRevision, hasNonDeletedElements: true } }; };
  c.setDirty(); const pending = c.save(); await tick(); c.setDirty(); assert.equal(c.isDirty(), true); gate.resolve(); await pending;
  assert.deepEqual(writes, [1, 2]); assert.equal(c.isDirty(), false);
});
test("handoff is never reported as physically acknowledged, and unconfirmed bytes remain distinguishable", async t => {
  const { coordinator: c, deps } = await setup(t); c.setDirty();
  deps.performSave = async operation => { const preparedSave = { ...operation, capturedRevision: 1, filePath: "owned.excalidraw.md", text: "handoff", hasNonDeletedElements: true }; c.observePreparedSave(preparedSave); return { status: "persistence-handed-off", preparedSave }; };
  const result = await c.saveWithOutcome(); assert.equal(result.acknowledgedRevision, null); assert.equal(c.classifyContent("owned.excalidraw.md", c.getSaveTargetGeneration(), "handoff").kind, "matches-unconfirmed-handoff");
});
test("own-write echoes, newer edits, accepted external content and new target generations stay distinct", async t => {
  const { coordinator: c } = await setup(t); c.setDirty(); await c.save(); const generation = c.getSaveTargetGeneration();
  assert.equal(c.classifyContent("owned.excalidraw.md", generation, "durable").kind, "matches-successful-write");
  c.setDirty(); assert.equal(c.classifyContent("owned.excalidraw.md", generation, "durable").hasNewerLocalRevision, true);
  c.observeAcceptedContent("owned.excalidraw.md", generation, "external"); assert.equal(c.classifyContent("owned.excalidraw.md", generation, "external").kind, "matches-accepted-content");
  c.beginSaveTarget(); assert.notEqual(c.classifyContent("owned.excalidraw.md", c.getSaveTargetGeneration(), "durable").kind, "matches-successful-write");
});
test("migration state transfers only settled, nonnegative matching revision baselines", async t => {
  const { coordinator: c } = await setup(t); c.setDirty(); assert.equal(c.exportMigrationState(), null); await c.save();
  const state = c.exportMigrationState(); assert.deepEqual(state, { currentRevision: 1, savedRevision: 1 });
  for (const invalid of [{ currentRevision: -1, savedRevision: -1 }, { currentRevision: 2, savedRevision: 1 }, { currentRevision: Infinity, savedRevision: Infinity }]) assert.equal(c.adoptMigrationState(invalid), false);
  assert.equal(c.adoptMigrationState(state), true); assert.equal(c.isDirty(), false);
});
test("a rejected autosave releases its busy flag and later autosaves can persist", async t => {
  const { coordinator: c, deps, timers, errors } = await setup(t); let attempts = 0;
  deps.requestSave = async () => { if (++attempts === 1) throw Error("owned autosave failure"); await c.save(); };
  c.setupAutosaveTimer(); c.setDirty(); timers.get(c.autosaveTimer)(); await tick();
  assert.equal(c.isBusy, false); assert.equal(c.isDirty(), true); assert.equal(errors.length, 1);
  timers.get(c.autosaveTimer)(); await tick(); assert.equal(attempts, 2); assert.equal(c.isDirty(), false); assert.equal(c.isBusy, false);
});
