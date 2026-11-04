import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Exercise the complete production migration callback. Only Obsidian/runtime
// boundaries are substituted; persistence and replacement ordering are observed.
const source = readFileSync(new URL("../../src/view/ExcalidrawView.ts", import.meta.url), "utf8");
const tree = ts.createSourceFile("view.ts", source, ts.ScriptTarget.Latest, true);
let callback;
function visit(node) {
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "onWindowMigrated" && ts.isArrowFunction(node.arguments[0])) callback = node.arguments[0];
  ts.forEachChild(node, visit);
}
visit(tree); assert.ok(callback);
const javascript = ts.transpileModule(`(function () { return ${callback.getText(tree)}; }).call(view)`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function clock() {
  let id = 0; const tasks = new Map();
  return { closed: false, setTimeout(fn) { tasks.set(++id, fn); return id; },
    fire() { for (const [id, fn] of [...tasks]) { tasks.delete(id); fn(); } },
    close() { this.closed = true; tasks.clear(); }, tasks };
}
function setup() {
  const main = clock(), destination = clock(), events = [], states = [];
  const file = { path: "owned.excalidraw.md", stat: { mtime: 1 } };
  const plugin = {
    app: { vault: { async read(f) { assert.equal(f, file); events.push("read"); return "Markdown"; } } },
    discardViewMigrationPersistenceHandoff() { events.push("discard"); },
    completeMigrationAutoexport(_, path, success) { assert.equal(path, file.path); assert.equal(success, false); },
    registerViewMigrationHandoff({ drawing }) { assert.equal(drawing, "drawing"); events.push("handoff"); return "token"; },
  };
  const view = {
    file, plugin, compatibilityMode: false, semaphores: {},
    invalidateSetViewDataLoad() {}, isSameFileEditingActive: () => true,
    markdownImageController: { cancelPendingConversion() {} }, clearExcalidrawInitializeTimer() {},
    sceneFileManager: { terminateActiveLoaders() {} },
    captureWindowMigrationSnapshot() { this.windowMigrationSaveSnapshot = {}; events.push("snapshot"); return {}; },
    unmountExcalidrawRoot() { events.push("unmount"); },
    saveCoordinator: { async flush() { events.push("flush"); } },
    isDirty: () => false, createWindowMigrationDrawingState: () => "drawing",
  };
  view.leaf = { id: "leaf", view, async setViewState(state) { states.push(state); } };
  const migrate = vm.runInNewContext(javascript, { view, window: main,
    beginMarkdownImageEditorViewUnload: () => null, EMBEDDABLE_SEMAPHORE_TIMEOUT: 1500,
    warningUnknowSeriousError() { assert.fail("unexpected dirty migration"); },
    closeLeafView: async leaf => { assert.equal(leaf, view.leaf); events.push("close-view"); },
    VIEW_TYPE_EXCALIDRAW: "excalidraw", windowMigratedDisableZoomOnce: false,
  });
  return { main, destination, events, states, view, migrate };
}

test("dirty migration unmounts synchronously and completes after the source popout closes", async () => {
  const s = setup(), sourcePopout = clock();
  let settled = false; s.migrate(s.destination).then(() => settled = true);
  assert.deepEqual(s.events, ["snapshot", "unmount"]);
  sourcePopout.close(); s.main.fire(); await tick(); s.main.fire(); await tick();
  assert.equal(settled, true);
  assert.deepEqual(s.events, ["snapshot", "unmount", "read", "flush", "close-view", "handoff"]);
  assert.equal(s.states.length, 1);
  assert.equal(s.states[0].state.migrationHandoffToken, "token");
});

for (const phase of ["grace", "replacement yield"]) {
  test(`destination closure during migration ${phase} settles without recreating a retired leaf`, async () => {
    const s = setup(); let settled = false;
    s.migrate(s.destination).then(() => settled = true);
    if (phase === "replacement yield") { s.main.fire(); await tick(); }
    s.destination.close(); s.main.fire(); await tick();
    assert.equal(settled, true);
    assert.equal(s.events.includes("close-view"), false);
    assert.equal(s.events.includes("handoff"), false);
    assert.equal(s.events.includes("discard"), true);
    if (phase === "grace") assert.equal(s.events.includes("read"), false);
    assert.equal(s.states.length, 0);
  });
}
