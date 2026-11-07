import assert from "node:assert/strict";
import test, { after } from "node:test";
import { sourceHarness } from "./sourceHarness.mjs";

let promptResult, prompts = [];
const device = { isDesktop: true, isMacOS: false, isIOS: false };
const graph = sourceHarness({
  "src/constants/constants": { DEVICE: device, VIEW_TYPE_EXCALIDRAW: "excalidraw" },
  "src/lang/helpers": { t: key => ({ EMBED_OPEN_DRAWING: "Open drawing", EMBED_OPEN_MODIFIER: "{keys}+click: {action}" })[key] ?? key },
  "src/utils/coreUtils": { errorlog: error => assert.fail(JSON.stringify(error)) },
  "src/utils/obsidianUtils": { getNewOrAdjacentLeaf: plugin => plugin.app.workspace.getLeaf("split") },
  "src/utils/modifierkeyHelper": {
    linkClickModifierType: event => event.modifier,
    labelCTRL: () => device.isMacOS ? "CMD" : "CTRL", labelMETA: () => device.isMacOS ? "CTRL" : "WIN", labelALT: () => "ALT", labelSHIFT: () => "SHIFT",
    modifierKeyTooltipMessages: () => ({ LinkClickAction: { "new-tab": "New tab", "popout-window": "Popout", "active-pane": "Current pane" } }),
  },
  "src/utils/utils": { isMaskFile: (_plugin, file) => !!file.mask },
  "src/utils/excalidrawViewUtils": { getExcalidrawFileForwardLinks: () => "[[Forward]]" },
  "src/shared/Dialogs/Prompt": { linkPrompt: async text => { prompts.push(text); return promptResult; } },
});
const { openDrawingEmbed, getDrawingEmbedOpenTooltip } = await graph.importModule("src/core/managers/openDrawingEmbed.ts");
after(() => graph.close());
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture(mask = false) {
  const drawing = { path: "Drawing.excalidraw.md", mask }, calls = [], links = [], saves = [], leaves = [], origin = {};
  const createLeaf = (location, markdown = false) => {
    const leaf = { id: "leaf-" + leaves.length, view: { file: markdown ? drawing : null, getViewType: () => markdown ? "markdown" : "empty", containerEl: { contains: element => markdown && element === origin }, save: async () => saves.push(location) },
      async setViewState(state) {
        const call = [drawing, location, state.active, ""]; calls.push(call);
        assert.equal(state.type, "excalidraw"); assert.equal(state.state.file, drawing.path);
        this.view = { file: drawing, getViewType: () => "excalidraw", containerEl: { contains: () => false }, setEphemeralState: state => { call[3] = state.subpath; } };
      } };
    leaves.push(leaf); return leaf;
  };
  const active = createLeaf("active-pane", true);
  const workspace = { iterateAllLeaves: callback => leaves.forEach(callback), setActiveLeaf() {}, getLeaf: type => type ? createLeaf(type === "split" ? "new-pane" : "new-tab") : active,
    openPopoutLeaf: () => createLeaf("popout-window"), openLinkText: async (...args) => links.push(args) };
  const plugin = { _loaded: true, settings: { focusOnFileTab: true }, excalidrawFileModes: {}, app: { vault: { getFileByPath: path => path === drawing.path ? drawing : null }, workspace },
    isExcalidrawFile: file => file?.path.endsWith("excalidraw.md") };
  prompts = []; return { plugin, drawing, calls, links, saves, active, origin };
}
test("Open drawing preserves all modifier and complete reference semantics of existing gestures", async () => {
  for (const modifier of ["active-pane", "new-pane", "popout-window", "new-tab", "md-properties"]) {
    const f = fixture(), reference = "#^clippedframe=Frame name,padding=2";
    openDrawingEmbed(f.plugin, f.drawing.path + reference, { modifier }, f.origin); await flush();
    assert.deepEqual(f.calls, [[f.drawing, modifier === "md-properties" ? "new-tab" : modifier, true, reference]]);
    if (modifier === "active-pane") { assert.deepEqual(f.saves, ["active-pane"]); assert.equal(f.active.view.getViewType(), "excalidraw"); }
    openDrawingEmbed(f.plugin, "missing.excalidraw.md", { modifier }); assert.equal(f.calls.length, 1);
  }
});
test("mask link prompts retain drawing selection, Markdown subpath routing and cancellation", async () => {
  for (const [modifier, pane] of [["active-pane", false], ["new-pane", "split"], ["popout-window", "window"], ["new-tab", "tab"], ["md-properties", "tab"]]) {
    const f = fixture(true), target = { path: "Note.md" };
    promptResult = [target, "Note", "#Section"];
    openDrawingEmbed(f.plugin, f.drawing.path, { modifier }); await flush();
    assert.deepEqual(f.links, [["Note", "", pane, { eState: { subpath: "#Section" } }]]);
    assert.match(prompts[0], /\[\[Forward\]\]/);
    promptResult = [f.drawing, f.drawing.path, "#^group=abcdefgh"];
    openDrawingEmbed(f.plugin, f.drawing.path, { modifier }); await flush();
    assert.deepEqual(f.calls, [[f.drawing, modifier === "md-properties" ? "new-tab" : modifier, true, "#^group=abcdefgh"]]);
    promptResult = null; openDrawingEmbed(f.plugin, f.drawing.path, { modifier }); await flush();
    assert.equal(f.calls.length, 1); assert.equal(f.links.length, 1);
  }
});

test("open tooltips follow live platform settings and omit unsupported mobile popouts", () => {
  const rules = [
    { ctrl_cmd: true, result: "new-tab" },
    { ctrl_cmd: true, shift: true, result: "popout-window" },
    { ctrl_cmd: true, result: "active-pane" },
  ];
  const settings = { modifierKeyConfig: { Win: { LinkClickAction: { rules } }, Mac: { LinkClickAction: { rules } } } };
  assert.equal(getDrawingEmbedOpenTooltip(settings), "Open drawing\nCTRL+click: New tab\nCTRL+SHIFT+click: Popout");
  rules[0].result = "active-pane";
  assert.match(getDrawingEmbedOpenTooltip(settings), /CTRL\+click: Current pane/);
  device.isDesktop = false; device.isMacOS = true;
  try { assert.equal(getDrawingEmbedOpenTooltip(settings), "Open drawing\nCMD+click: Current pane"); }
  finally { device.isDesktop = true; device.isMacOS = false; }
});
