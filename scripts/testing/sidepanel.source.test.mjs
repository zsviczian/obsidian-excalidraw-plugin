import assert from "node:assert/strict";
import test, { after } from "node:test";
import { sourceHarness } from "./sourceHarness.mjs";

const device = { isDesktop: true };
const graph = sourceHarness({
  obsidian: { ItemView: class {}, WorkspaceLeaf: class {}, setIcon() {} },
  "src/constants/constants": { DEVICE: device, ICON_NAME: "excalidraw", VIEW_TYPE_SIDEPANEL: "excalidraw-sidepanel" },
  "src/core/main": { default: class {} },
  "src/lang/helpers": { t: key => key },
  "src/utils/excalidrawViewLookup": { getLastActiveExcalidrawView() {} },
  "./SidepanelTab": { ExcalidrawSidepanelTab: class {} },
  "src/utils/styleUtils": { hideElement() {}, showElement() {} },
  "./MarkdownImageEditor": { handleMarkdownImageEditorSidepanelClosing() {} },
});
const { ExcalidrawSidepanelView: Panel } = await graph.importModule("src/view/sidepanel/Sidepanel.ts");
after(() => graph.close());

function fixture(preference, desktop = true) {
  device.isDesktop = desktop;
  const leaves = [], reveals = [], placements = [];
  const mainDoc = {}, popoutDoc = {};
  let ready = 0;
  const create = location => {
    placements.push(location);
    const containerEl = {
      ownerDocument: location === "popout" ? popoutDoc : mainDoc,
      getBoundingClientRect: () => ({ width: 0, height: 0 }),
    };
    const leaf = { containerEl, async setViewState(state) {
      this.state = state;
      this.view = Object.assign(Object.create(Panel.prototype), {
        leaf: this, app: plugin.app, containerEl, waitUntilReady: async () => { ready++; },
      });
    } };
    leaves.push(leaf); return leaf;
  };
  const plugin = { settings: { sidepanelOpenInPopout: preference }, app: { workspace: {
    getLeavesOfType: () => leaves,
    getRightLeaf: () => create("sidebar"),
    openPopoutLeaf: () => create("popout"),
    containerEl: { ownerDocument: mainDoc },
    moveLeafToPopout: leaf => { placements.push("popout"); leaf.containerEl.ownerDocument = popoutDoc; },
    revealLeaf: async leaf => reveals.push(leaf),
  } } };
  return { plugin, placements, reveals, leaves, mainDoc, popoutDoc, get ready() { return ready; } };
}

test("sidepanel defaults to the sidebar and opts into desktop popouts", async () => {
  for (const preference of [undefined, false, true]) {
    const f = fixture(preference);
    const view = await Panel.getOrCreate(f.plugin);
    assert.deepEqual(f.placements, [preference === true ? "popout" : "sidebar"]);
    assert.equal(view.leaf, f.leaves[0]);
    assert.equal(view.leaf.state.type, "excalidraw-sidepanel");
    assert.equal(view.leaf.state.active, true);
    assert.deepEqual(f.reveals, [view.leaf]);
    assert.equal(f.ready, 1);
  }
});

test("mobile sidepanels ignore the synchronized desktop popout preference", async () => {
  for (const preference of [false, true]) {
    const f = fixture(preference, false);
    // Mobile does not provide the desktop-only API.
    delete f.plugin.app.workspace.openPopoutLeaf;
    await Panel.getOrCreate(f.plugin);
    assert.deepEqual(f.placements, ["sidebar"]);
  }
});

test("reopening reuses sidepanel tabs and silent creation does not reveal the leaf", async () => {
  const f = fixture(true);
  const first = await Panel.getOrCreate(f.plugin, false);
  first.retainedTab = { text: "unsaved panel input" };
  assert.equal(first.leaf.state.active, false);
  assert.deepEqual(f.reveals, []);
  assert.deepEqual(f.placements, ["sidebar"]);
  const second = await Panel.getOrCreate(f.plugin);
  assert.equal(first, second);
  assert.equal(second.retainedTab.text, "unsaved panel input");
  assert.deepEqual(f.placements, ["sidebar", "popout"]);
  assert.deepEqual(f.reveals, [first.leaf]);
  // Once closed, the new preference applies to the next panel.
  f.leaves.length = 0;
  f.plugin.settings.sidepanelOpenInPopout = false;
  assert.notEqual(await Panel.getOrCreate(f.plugin), first);
  assert.deepEqual(f.placements, ["sidebar", "popout", "sidebar"]);
});

test("changing placement defers the popout and docks without revealing the sidebar", async () => {
  const f = fixture(false), { mainDoc, popoutDoc } = f, rightRoot = {};
  const panel = await Panel.getOrCreate(f.plugin);
  const leaf = panel.leaf, workspace = f.plugin.app.workspace, calls = [];
  const input = { value: "unsaved script input" };
  panel.retainedTab = input;
  workspace.containerEl = { ownerDocument: mainDoc };
  workspace.rightSplit = rightRoot;
  panel.containerEl = { ownerDocument: mainDoc };
  let root = rightRoot;
  const parent = { removeChild: child => { assert.equal(child, leaf); calls.push("remove"); } };
  leaf.parent = parent;
  leaf.getRoot = () => root;
  leaf.setDimension = value => { assert.equal(value, null); calls.push("reset dimension"); };
  workspace.moveLeafToPopout = child => {
    assert.equal(child, leaf); calls.push("popout");
    panel.containerEl.ownerDocument = popoutDoc; root = {}; leaf.parent = parent;
  };
  workspace.requestResize = () => calls.push("resize");
  workspace.getRightLeaf = split => {
    assert.equal(split, false);
    return { parent: { insertChild(index, child) {
      assert.equal(index, -1); assert.equal(child, leaf); calls.push("dock");
      panel.containerEl.ownerDocument = mainDoc; root = rightRoot;
    } }, detach: () => calls.push("remove placeholder") };
  };
  await Panel.applyLocationPreference(f.plugin, true);
  assert.equal(panel.containerEl.ownerDocument, mainDoc);
  assert.equal(await Panel.getOrCreate(f.plugin, false), panel);
  assert.deepEqual(calls, []);
  assert.equal(await Panel.getOrCreate(f.plugin), panel);
  assert.equal(panel.containerEl.ownerDocument, popoutDoc);
  await Panel.applyLocationPreference(f.plugin, false);
  assert.equal(panel.containerEl.ownerDocument, mainDoc);
  assert.equal(panel.retainedTab, input);
  assert.equal(input.value, "unsaved script input");
  assert.deepEqual(f.reveals, [leaf, leaf]);
  assert.deepEqual(calls, ["popout", "remove", "reset dimension", "dock", "remove placeholder", "resize"]);
  await Panel.applyLocationPreference(f.plugin, false);
  assert.equal(calls.length, 6, "already docked panel should stay in place");
});

test("a deferred sidebar leaf loads quietly before its queued popout", async () => {
  const f = fixture(false);
  const workspace = f.plugin.app.workspace;
  const leaf = workspace.getRightLeaf(false);
  const deferredView = { containerEl: leaf.containerEl };
  leaf.view = deferredView;
  leaf.loadIfDeferred = async () => {
    await leaf.setViewState({ type: "excalidraw-sidepanel", active: false });
  };
  Panel.applyLocationPreference(f.plugin, true);
  assert.equal(leaf.view, deferredView);
  assert.deepEqual(f.placements, ["sidebar"]);
  await Panel.getOrCreate(f.plugin, false);
  assert.equal(leaf.state.active, false);
  assert.deepEqual(f.reveals, []);
  const panel = await Panel.getOrCreate(f.plugin);
  assert.equal(panel.leaf, leaf);
  assert.equal(panel.containerEl.ownerDocument, f.popoutDoc);
  assert.deepEqual(f.placements, ["sidebar", "popout"]);
});

test("applying sidepanel placement on mobile or without a panel creates no leaves", async () => {
  for (const desktop of [false, true]) {
    const f = fixture(false, desktop);
    await Panel.applyLocationPreference(f.plugin, true);
    await Panel.applyLocationPreference(f.plugin, false);
    assert.deepEqual(f.placements, []);
  }
  const f = fixture(true, false);
  const panel = await Panel.getOrCreate(f.plugin);
  await Panel.applyLocationPreference(f.plugin, true);
  assert.equal(await Panel.getOrCreate(f.plugin), panel);
  assert.deepEqual(f.placements, ["sidebar"]);
});
