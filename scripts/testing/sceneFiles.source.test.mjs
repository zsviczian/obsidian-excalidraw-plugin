import assert from "node:assert/strict";
import test from "node:test";
import { sourceHarness } from "./sourceHarness.mjs";

async function setup(t) {
  const previous = globalThis.window, timers = new Map(); let timer = 0;
  globalThis.window = { setTimeout(callback) { timers.set(++timer, callback); return timer; }, clearTimeout(id) { timers.delete(id); } };
  const graph = sourceHarness({ "../../utils/markdownImageUtils": { createMarkdownImageRenderCacheEntry() {}, resolveMarkdownImageRenderSettings() {} } });
  t.after(() => { graph.close(); globalThis.window = previous; });
  const { ViewSceneFileManager, getVisibleImageFileIds, waitForWindowPaint } = await graph.importModule("src/view/managers/ViewSceneFileManager.ts");
  const api = { isDestroyed: false, getAppState: () => ({ zoom: { value: 2 }, scrollX: -10, scrollY: -20, width: 200, height: 100 }), getFiles: () => ({}) };
  const view = { excalidrawAPI: api, file: { path: "owned.excalidraw.md" }, semaphores: {}, getViewElements: () => [], excalidrawData: { getFileEntries: () => [] } };
  const loaders = [], added = [];
  const manager = new ViewSceneFileManager(view, { createEmbeddedFilesLoader() {
    const loader = { terminate: false, cleaned: 0, emptyPDFDocsMap() { this.cleaned++; }, loadSceneFiles(options) { this.options = options; } };
    loaders.push(loader); return loader;
  }, addFiles(files) { added.push(files); } });
  t.after(() => manager.terminateActiveLoaders());
  return { manager, view, api, loaders, added, timers, getVisibleImageFileIds, waitForWindowPaint };
}

for (const [name, invalidate] of [
  ["replacement API for the same path", ({ view, api }) => { view.excalidrawAPI = { ...api }; }],
  ["another file", ({ view }) => { view.file = { path: "other.excalidraw.md" }; }],
  ["window migration", ({ view }) => { view.semaphores.windowMigrating = true; }],
  ["view unload", ({ view }) => { view.semaphores.viewunload = true; }],
  ["destroyed editor", ({ api }) => { api.isDestroyed = true; }],
]) {
  test(`late file callbacks reject ${name} and release PDF resources`, async t => {
    const state = await setup(t); let completed = 0;
    await state.manager.loadSceneFiles(false, undefined, () => completed++);
    invalidate(state);
    state.loaders[0].options.addFiles([{ id: "late" }], false, true);
    assert.equal(completed, 0); assert.equal(state.added.length, 0);
    assert.equal(state.loaders[0].terminate, true); assert.equal(state.loaders[0].cleaned, 1);
  });
}

test("current file callbacks deliver partial and final batches once; teardown cancels all owned loaders", async t => {
  const { manager, loaders, added } = await setup(t); let completed = 0;
  await manager.loadSceneFiles(false, undefined, () => completed++);
  loaders[0].options.addFiles([{ id: "first" }], false, false);
  assert.equal(completed, 0); assert.equal(added.length, 1);
  loaders[0].options.addFiles([{ id: "last" }], false, true);
  assert.equal(completed, 1); assert.equal(added.length, 2);
  await manager.loadSceneFiles(); await manager.loadSceneFiles();
  manager.terminateActiveLoaders(); manager.terminateActiveLoaders();
  assert.equal(loaders[1].terminate, true); assert.equal(loaders[2].terminate, true);
  assert.equal(loaders[1].cleaned, 1); assert.equal(loaders[2].cleaned, 1);
});

test("viewport prioritization uses scene zoom, scroll and image bounds", async t => {
  const { view, getVisibleImageFileIds } = await setup(t);
  view.getViewElements = () => [
    { type: "image", fileId: "visible", x: 15, y: 25, width: 20, height: 20 },
    { type: "image", fileId: "outside", x: 300, y: 300, width: 20, height: 20 },
    { type: "image", fileId: "deleted", isDeleted: true, x: 15, y: 25, width: 20, height: 20 },
  ];
  assert.deepEqual([...getVisibleImageFileIds(view)], ["visible"]);
});

test("paint waiting uses two owning-window frames and a bounded fallback", async t => {
  const { waitForWindowPaint, timers } = await setup(t), frames = [];
  let finished = false; const pending = waitForWindowPaint(() => ({ requestAnimationFrame: callback => frames.push(callback) })).then(() => finished = true);
  assert.equal(frames.length, 1); frames.shift()(); await Promise.resolve(); assert.equal(finished, false);
  frames.shift()(); await pending; assert.equal(timers.size, 0);
  const fallback = waitForWindowPaint(() => ({ requestAnimationFrame() {} }));
  [...timers.values()][0](); await fallback; assert.equal(timers.size, 0);
});
