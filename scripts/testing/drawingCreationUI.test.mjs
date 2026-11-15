import assert from "node:assert/strict";
import test from "node:test";
import { sourceHarness } from "./sourceHarness.mjs";
import { embedTestDOM } from "./embedTestDOM.mjs";

test("creation actions default to visible, respect independent opt-outs and release their listeners", async () => {
  const dom = embedTestDOM(), events = new Set(), created = [], errors = [];
  dom.Element.prototype.contains = function (node) { return node === this || this.children.some(child => child.contains(node)); };
  class Component extends dom.Component { registerEvent(ref) { this.register(() => events.delete(ref)); } }
  const graph = sourceHarness({
    obsidian: { Component, setIcon: (el, icon) => { el.icon = icon; } },
    "src/constants/constants": { ICON_NAME: "excalidraw" }, "src/lang/helpers": { t: key => key },
    "src/utils/fileUtils": { getDrawingFilename: settings => settings.drawingFilenamePrefix + ".excalidraw.md" },
    "src/utils/coreUtils": { errorlog: error => errors.push(error) },
    "src/utils/styleUtils": { hideElement: el => el.addClass("hidden"), showElement: el => el.removeClass("hidden") },
    "src/types/utilTypes": { PreviewImageType: { SVG: "SVG" } },
    "src/utils/pens": { PENS: {} },
    "src/utils/carveout": { ANNOTATED_PREFIX: "Annotated", CROPPED_PREFIX: "Cropped" },
    "src/utils/geminiImageModelUtils": { getGeminiSupportedSizes: () => [] },
  });
  const container = new dom.Element(), list = container.createDiv({ cls: "empty-state-action-list" });
  const existing = list.createEl("button", { text: "New note" });
  const leaf = { view: { containerEl: container, getViewType: () => "empty" } };
  let leaves = [leaf], ribbonCount = 0, active, resolveCreation;
  const plugin = { settings: null, isReady: true,
    app: { workspace: { on: (_, callback) => { events.add(callback); return callback; }, onLayoutReady(callback) { this.ready = callback; }, getLeavesOfType: () => leaves, setActiveLeaf: leaf => { active = leaf; } } },
    addRibbonIcon() { ribbonCount++; return ribbon; }, createAndOpenDrawing: (...args) => { created.push(args); return new Promise(resolve => { resolveCreation = resolve; }); } };
  const ribbon = new dom.Element();
  const previousVersion = globalThis.PLUGIN_VERSION;
  try {
    globalThis.PLUGIN_VERSION = "test";
    const { DEFAULT_SETTINGS } = await graph.importModule("src/core/settingsDefaults.ts");
    assert.equal(DEFAULT_SETTINGS.showRibbonIcon, true);
    assert.equal(DEFAULT_SETTINGS.showNewDrawingInEmptyTab, true);
    plugin.settings = { ...DEFAULT_SETTINGS, drawingFilenamePrefix: "Configured" };
    const { DrawingCreationUI } = await graph.importModule("src/core/managers/DrawingCreationUI.ts");
    const manager = new DrawingCreationUI(plugin, () => {}); manager.load(); manager.refresh();
    assert.equal(list.children.length, 2); assert.equal(ribbon.hasClass("hidden"), false);
    plugin.settings.showNewDrawingInEmptyTab = false; manager.refresh();
    assert.deepEqual(list.children, [existing]); assert.equal(ribbon.hasClass("hidden"), false);
    plugin.settings.showRibbonIcon = false; plugin.settings.showNewDrawingInEmptyTab = true; manager.refresh();
    assert.equal(ribbon.hasClass("hidden"), true); assert.equal(list.children.length, 2);
    const button = list.querySelector(".excalidraw-new-drawing");
    const observer = dom.observers.at(-1);
    button.fire("click"); button.fire("click");
    assert.equal(active, leaf); assert.deepEqual(created, [["Configured.excalidraw.md", "active-pane"]]);
    resolveCreation(""); await new Promise(resolve => setImmediate(resolve)); assert.equal(button.disabled, false);
    list.empty(); observer.fire(); observer.fire(); assert.deepEqual(list.children, [button]);
    plugin.settings.showNewDrawingInEmptyTab = false; manager.refresh();
    assert.equal(button.isConnected, false); assert.equal(observer.connected, false);
    plugin.settings.showNewDrawingInEmptyTab = true; manager.refresh(); leaves = []; manager.refresh();
    assert.equal(list.children.length, 0); assert.equal(ribbonCount, 1);
    manager.unload(); plugin.app.workspace.ready(); assert.equal(ribbon.isConnected, false);
    assert.ok(dom.observers.every(observer => !observer.connected));
    assert.equal(events.size, 0); assert.equal(dom.listenerCount(), 0); assert.deepEqual(errors, []);
  } finally {
    graph.close();
    if (previousVersion === undefined) delete globalThis.PLUGIN_VERSION;
    else globalThis.PLUGIN_VERSION = previousVersion;
  }
});
