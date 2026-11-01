import assert from "node:assert/strict";
import test from "node:test";
import { sourceHarness } from "./sourceHarness.mjs";

const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function clock() {
  let sequence = 0;
  const tasks = new Map();
  return {
    closed: false, tasks,
    setTimeout(callback) { tasks.set(++sequence, callback); return sequence; },
    clearTimeout(id) { tasks.delete(id); },
    fire() { for (const [id, callback] of [...tasks]) { tasks.delete(id); callback(); } },
    close() { this.closed = true; tasks.clear(); },
  };
}

async function setup(t) {
  const previous = globalThis.window, main = clock(), popout = clock(), listeners = new Set(), cleanups = [];
  globalThis.window = main;
  const graph = sourceHarness({
    obsidian: {
      Notice: class {}, setIcon() {}, ItemView: class { async onClose() {} },
      MarkdownRenderChild: class {
        constructor(containerEl) { this.containerEl = containerEl; }
        register(callback) { cleanups.push(callback); }
      },
    },
    "../../constants/constants": { MD_EX_SECTIONS: [] },
    "../../lang/helpers": { t: key => key },
    "../../utils/pathUtils": { cleanSectionHeading: text => text },
    "src/constants/constants": { ICON_NAME: "excalidraw", VIEW_TYPE_SIDEPANEL: "sidepanel" },
    "src/lang/helpers": { t: key => key },
    "src/utils/excalidrawViewLookup": { getLastActiveExcalidrawView: () => null },
    "./SidepanelTab": { ExcalidrawSidepanelTab: class {} },
    "src/utils/styleUtils": { hideElement() {}, showElement() {} },
    "./MarkdownImageEditor": { handleMarkdownImageEditorSidepanelClosing: async () => {} },
  });
  t.after(() => { graph.close(); globalThis.window = previous; });
  const { MarkdownImageController } = await graph.importModule("src/view/managers/MarkdownImageController.ts");
  const { ExcalidrawSidepanelView: Panel } = await graph.importModule("src/view/sidepanel/Sidepanel.ts");
  const vault = { on(_, callback) { listeners.add(callback); return callback; }, offref(ref) { listeners.delete(ref); } };
  const file = { path: "owned.excalidraw.md" };
  const view = { ownerWindow: popout, file, app: { vault }, register: callback => cleanups.push(callback) };
  const controller = new MarkdownImageController(view, {});
  return { main, popout, listeners, cleanups, view, controller, Panel };
}

test("file-modification fallback settles and releases its vault listener after the popout closes", async t => {
  const { main, popout, listeners, controller } = await setup(t);
  let settled = false;
  controller.waitForViewFileModification(2500).then(() => settled = true);
  popout.close(); main.fire(); await tick();
  assert.equal(settled, true);
  assert.equal(listeners.size, 0);
  assert.equal(main.tasks.size, 0);
});

test("file-modification arrival clears the original scheduler after window migration", async t => {
  const { main, popout, listeners, controller, view } = await setup(t);
  const pending = controller.waitForViewFileModification(2500);
  view.ownerWindow = main;
  for (const callback of listeners) callback(view.file);
  await pending;
  assert.equal(listeners.size, 0);
  assert.equal(main.tasks.size, 0);
  assert.equal(popout.tasks.size, 0);
});

test("view unload settles a pending conversion wait and removes timers and listeners", async t => {
  const { main, popout, listeners, controller, cleanups } = await setup(t);
  let settled = false;
  controller.waitForViewFileModification(2500).then(() => settled = true);
  cleanups.forEach(cleanup => cleanup()); await tick();
  assert.equal(settled, true);
  assert.equal(listeners.size, 0);
  assert.equal(main.tasks.size + popout.tasks.size, 0);
});

function panelFixture(Panel, popout) {
  const panel = Object.create(Panel.prototype), executed = [];
  Object.assign(panel, {
    plugin: { settings: {}, scriptEngine: {} }, containerEl: { ownerDocument: { defaultView: popout } },
    restorePromise: null, persistedScripts: new Map([["first", { title: "first" }], ["second", { title: "second" }]]),
    restoringScriptNames: new Set(), backgroundRestoredTabIds: new Set(), tabs: new Map(), tabHosts: new Map(),
    scriptTabs: new Map(), tabOptions: new Map(), restoreRetryTimer: null,
    loadPersistedScriptsFromSettings() {}, getTabByScript() { return null; },
    async runScriptByName(name) { executed.push(name); }, updateEmptyStateVisibility() {},
  });
  return { panel, executed };
}

test("sidepanel restore finishes and releases global silence when its popout timer source closes", async t => {
  const { main, popout, Panel } = await setup(t), { panel, executed } = panelFixture(Panel, popout);
  let settled = false;
  panel.restorePersistedTabs().then(() => settled = true); await tick();
  popout.close(); main.fire(); await tick(); main.fire(); await tick();
  assert.equal(settled, true);
  assert.deepEqual(executed, ["first", "second"]);
  assert.equal(Panel.restoreSilent, false);
  assert.equal(panel.restoringScriptNames.size, 0);
});

test("closing the sidepanel cancels its restore yield without executing another script", async t => {
  const { main, popout, Panel } = await setup(t), { panel, executed } = panelFixture(Panel, popout);
  let settled = false;
  panel.restorePersistedTabs().then(() => settled = true); await tick();
  await panel.onClose(); await tick();
  assert.equal(settled, true);
  assert.deepEqual(executed, ["first"]);
  assert.equal(Panel.restoreSilent, false);
  assert.equal(main.tasks.size + popout.tasks.size, 0);
});

test("a current conversion finishes after its main-window fallback and saves the converted section", async t => {
  const state = await setup(t), counts = conversionFixture(state);
  const pending = state.controller.convertEmbeddableToMarkdownImage("embed");
  await tick(); state.main.fire(); await pending;
  assert.deepEqual(counts, { reads: 2, conversions: 1, saves: 1 });
  assert.equal(state.view.data, "");
  assert.equal(state.listeners.size, 0);
});

for (const reason of ["unload", "migration", "file replacement", "API replacement"]) {
  test(`a pending conversion cannot read or mutate a retired target after ${reason}`, async t => {
    const state = await setup(t), counts = conversionFixture(state);
    const pending = state.controller.convertEmbeddableToMarkdownImage("embed");
    await tick();
    if (reason === "unload" || reason === "migration") state.view.isClosingOrMigrating = () => true;
    if (reason === "file replacement") state.view.file = { path: "different.excalidraw.md" };
    if (reason === "API replacement") state.view.excalidrawAPI = {};
    state.main.fire(); await tick();
    let settled = false; pending.then(() => settled = true); await tick();
    assert.equal(settled, true);
    assert.deepEqual(counts, { reads: 1, conversions: 0, saves: 0 });
    assert.equal(state.listeners.size, 0);
  });
}

function conversionFixture({ view, controller }) {
  const counts = { reads: 0, conversions: 0, saves: 0 };
  view.excalidrawAPI = {};
  view.isClosingOrMigrating = () => false;
  view.getViewElements = () => [{ id: "embed", type: "embeddable" }];
  view.getEmbeddableLeafElementById = () => ({ node: { isEditing: true, child: { file: view.file, text: "new text" } } });
  view.canvasNodeFactory = { stopEditing() {} };
  view.updateScene = () => {};
  view.app.vault.read = async () => ++counts.reads === 1 ? "old text" : "new text";
  view.forceSave = async () => { counts.saves++; };
  Object.assign(controller.dependencies, {
    getEmbeddableMarkdownImageSource: async () => ({ source: "local" }),
    getLevelOneMarkdownHeadings: () => [], containsReservedMarkdownImageMarker: () => false,
    convertEmbeddableElementToMarkdownImage: async () => { counts.conversions++; return true; },
    errorlog: error => { throw error; },
  });
  return counts;
}

test("Markdown embed debounce follows a live render context into another window", async t => {
  const { main, popout, cleanups } = await setup(t);
  let observe, child, renders = 0;
  popout.MutationObserver = class { constructor(callback) { observe = callback; } observe() {} disconnect() {} };
  const attrs = new Set(), container = {
    ownerDocument: { defaultView: popout },
    removeAttribute: name => attrs.delete(name), setAttribute: name => attrs.add(name),
    empty() {}, appendChild(image) { image.parentElement = this; },
  };
  const graph = sourceHarness({ obsidian: { MarkdownRenderChild: class {
    constructor(el) { this.containerEl = el; }
    register(callback) { cleanups.push(callback); }
  } } });
  t.after(() => graph.close());
  const { renderMarkdownEmbed } = await graph.importModule("src/core/managers/MarkdownEmbedRenderChild.ts");
  await renderMarkdownEmbed({ empty() {} }, container, { addChild(value) { child = value; child.onload(); } }, {
    enqueue: task => task(), createImage: async () => { renders++; return {}; },
    discardImage() {}, isPluginLoaded: () => true,
  });
  observe([{ attributeName: "width" }]);
  container.ownerDocument = { defaultView: main }; popout.close();
  main.fire(); await tick();
  assert.equal(renders, 2);
  assert.equal(attrs.has("ready"), true);
  observe([{ attributeName: "height" }]);
  cleanups.forEach(cleanup => cleanup()); child.onunload(); main.fire(); await tick();
  assert.equal(renders, 2, "unloading cancels the debounce");
  assert.equal(main.tasks.size, 0);
});
