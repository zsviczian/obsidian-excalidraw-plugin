import assert from "node:assert/strict";
import test from "node:test";
import { sourceHarness } from "./sourceHarness.mjs";
import { embedTestDOM } from "./embedTestDOM.mjs";

test("creation actions opt in independently, survive host rerenders and release their listeners", async () => {
  const dom = embedTestDOM(), events = new Set(), created = [], errors = [];
  dom.Element.prototype.contains = function (node) { return node === this || this.children.some(child => child.contains(node)); };
  class Component extends dom.Component { registerEvent(ref) { this.register(() => events.delete(ref)); } }
  const graph = sourceHarness({
    obsidian: { Component, setIcon: (el, icon) => { el.icon = icon; } },
    "src/constants/constants": { ICON_NAME: "excalidraw" }, "src/lang/helpers": { t: key => key },
    "src/utils/fileUtils": { getDrawingFilename: settings => settings.drawingFilenamePrefix + ".excalidraw.md" },
    "src/utils/coreUtils": { errorlog: error => errors.push(error) },
    "src/utils/styleUtils": { hideElement: el => el.addClass("hidden"), showElement: el => el.removeClass("hidden") },
  });
  const container = new dom.Element(), list = container.createDiv({ cls: "empty-state-action-list" });
  const existing = list.createEl("button", { text: "New note" });
  const leaf = { view: { containerEl: container, getViewType: () => "empty" } };
  let leaves = [leaf], ribbonCount = 0, active, resolveCreation;
  const plugin = { settings: { showRibbonIcon: true, showNewDrawingInEmptyTab: false, drawingFilenamePrefix: "Configured" }, isReady: true,
    app: { workspace: { on: (_, callback) => { events.add(callback); return callback; }, onLayoutReady(callback) { this.ready = callback; }, getLeavesOfType: () => leaves, setActiveLeaf: leaf => { active = leaf; } } },
    addRibbonIcon() { ribbonCount++; return ribbon; }, createAndOpenDrawing: (...args) => { created.push(args); return new Promise(resolve => { resolveCreation = resolve; }); } };
  const ribbon = new dom.Element();
  try {
    const { DrawingCreationUI } = await graph.importModule("src/core/managers/DrawingCreationUI.ts");
    const manager = new DrawingCreationUI(plugin, () => {}); manager.load(); manager.refresh();
    assert.deepEqual(list.children, [existing]); assert.equal(ribbon.hasClass("hidden"), false);
    plugin.settings.showRibbonIcon = false; plugin.settings.showNewDrawingInEmptyTab = true; manager.refresh();
    assert.equal(ribbon.hasClass("hidden"), true); assert.equal(list.children.length, 2);
    const button = list.querySelector(".excalidraw-new-drawing");
    button.fire("click"); button.fire("click");
    assert.equal(active, leaf); assert.deepEqual(created, [["Configured.excalidraw.md", "active-pane"]]);
    resolveCreation(""); await new Promise(resolve => setImmediate(resolve)); assert.equal(button.disabled, false);
    list.empty(); dom.observers[0].fire(); dom.observers[0].fire(); assert.deepEqual(list.children, [button]);
    plugin.settings.showNewDrawingInEmptyTab = false; manager.refresh();
    assert.equal(button.isConnected, false); assert.equal(dom.observers[0].connected, false);
    plugin.settings.showNewDrawingInEmptyTab = true; manager.refresh(); leaves = []; manager.refresh();
    assert.equal(list.children.length, 0); assert.equal(ribbonCount, 1);
    manager.unload(); plugin.app.workspace.ready(); assert.equal(ribbon.isConnected, false);
    assert.equal(events.size, 0); assert.equal(dom.listenerCount(), 0); assert.deepEqual(errors, []);
  } finally { graph.close(); }
});
