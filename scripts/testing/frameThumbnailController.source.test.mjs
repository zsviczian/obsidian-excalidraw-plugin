import assert from "node:assert/strict";
import test from "node:test";
import { load } from "js-yaml";
import { sourceHarness } from "./sourceHarness.mjs";

async function fixture(policy = "always") {
  const prompts = [], errors = [], settingsWrites = [];
  class Prompt {
    constructor(_plugin, message, buttons) { this.message = message; this.buttons = buttons; this.waitForClose = new Promise(resolve => { this.resolve = resolve; }); prompts.push(this); }
    close() { this.resolve(null); } choose(value) { this.resolve(value); }
  }
  const graph = sourceHarness({ obsidian: { Notice: class {}, parseYaml: load },
    "src/shared/Dialogs/FrameNavigator": { FrameNavigator: class { open() {} close() {} } },
    "src/lang/helpers": { t: key => key }, "src/utils/coreUtils": { errorlog: value => errors.push(value) } });
  const { FrameThumbnailController } = await graph.importModule("src/view/managers/FrameThumbnailController.ts");
  const { readFrameProperty } = await graph.importModule("src/utils/frameMetadata.ts");
  const file = { path: "Drawing.md" }, api = {};
  let disk = '---\nexcalidraw-plugin: parsed\nexcalidraw-thumbnail: A\nunknown: sentinel\n---\nBody', closed = false, saves = 0;
  let elements = [{ id: "frame-id", type: "frame", name: "A", x: 0, y: 0, width: 100, height: 80 }];
  const view = { file, excalidrawAPI: api, data: disk, compatibilityMode: false,
    app: { vault: { read: async () => disk, getFileByPath: path => path === file.path ? file : null } },
    plugin: { _loaded: true, settings: { thumbnailRenamePolicy: policy, unknown: "sentinel" }, saveSettings: async () => settingsWrites.push(structuredClone(view.plugin.settings)) },
    getViewElements: () => elements, isClosingOrMigrating: () => closed, setDirty() {},
    forceSave: async () => { saves++; view.data = disk = controller.applyHeader(view.data, elements); },
  };
  const controller = new FrameThumbnailController(view, Prompt); controller.update(elements, true);
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const rename = name => { elements = [{ ...elements[0], name }]; controller.update(elements); };
  return { controller, view, file, api, prompts, errors, settingsWrites, rename, flush, yaml: () => readFrameProperty(disk), saves: () => saves,
    scene: value => { elements = value; controller.update(elements); },
    external: name => { disk = disk.replace(/excalidraw-thumbnail:.*\n/, 'excalidraw-thumbnail: ' + JSON.stringify(name) + '\n'); },
    close: () => { closed = true; controller.reset(); graph.close(); } };
}

test("thumbnail rename follows always policy and undo/redo without replacing user hooks or unknown settings", async () => {
  const f = await fixture();
  try {
    const hook = () => {}; f.view.onSceneChangeHook = hook;
    f.rename("B"); await f.flush(); assert.equal(f.yaml(), "B");
    f.rename("A"); await f.flush(); assert.equal(f.yaml(), "A");
    f.rename("B"); await f.flush(); assert.equal(f.yaml(), "B");
    assert.equal(f.prompts.length, 0); assert.equal(f.saves(), 3); assert.equal(f.view.onSceneChangeHook, hook);
    assert.equal(f.view.plugin.settings.unknown, "sentinel");
  } finally { f.close(); }
});

test("first rename persists a selected policy and ask allows a different decision on subsequent renames", async () => {
  const f = await fixture("unset");
  try {
    f.rename("B"); assert.equal(f.prompts.length, 1); f.prompts[0].choose("ask"); await f.flush();
    assert.equal(f.settingsWrites[0].thumbnailRenamePolicy, "ask"); assert.equal(f.settingsWrites[0].unknown, "sentinel");
    f.prompts[1].choose(false); await f.flush(); assert.equal(f.yaml(), "A");
    f.rename("C"); f.prompts[2].choose(true); await f.flush(); assert.equal(f.yaml(), "C");
  } finally { f.close(); }
});

test("cancelling first-rename policy does not reopen a prompt on unchanged selection or scene updates", async () => {
  const f = await fixture("unset");
  try { f.rename("B"); f.prompts[0].close(); await f.flush(); f.rename("B"); await f.flush(); assert.equal(f.prompts.length, 1); assert.equal(f.yaml(), "A"); }
  finally { f.close(); }
});

test("a rename reverted while its own YAML write settles keeps tracking the same frame", async () => {
  const f = await fixture();
  try {
    const save = f.view.forceSave; let first = true;
    f.view.forceSave = async () => { await save(); if (first) { first = false; f.rename("A"); } };
    f.rename("B"); await f.flush(); await f.flush();
    assert.equal(f.yaml(), "A"); assert.equal(f.saves(), 2);
  } finally { f.close(); }
});

test("a context-menu thumbnail choice establishes identity before the next scene event renames it", async () => {
  const f = await fixture();
  try {
    f.scene([{ id: "other", type: "frame", name: "Other", x: 0, y: 0, width: 100, height: 80 }]);
    assert.equal(await f.controller.setThumbnail("Other"), true);
    f.rename("Renamed"); await f.flush();
    assert.equal(f.yaml(), "Renamed");
  } finally { f.close(); }
});

test("external YAML changes, blank names and retired views cannot be overwritten by a pending rename", async () => {
  for (const kind of ["external", "blank", "retired"]) {
    const f = await fixture("ask");
    try {
      f.rename("B"); const prompt = f.prompts[0];
      if (kind === "external") f.external("Manual");
      if (kind === "blank") f.rename("");
      if (kind === "retired") f.controller.reset();
      prompt.choose(true); await f.flush();
      assert.equal(f.yaml(), kind === "external" ? "Manual" : "A"); assert.equal(f.saves(), 0);
    } finally { f.close(); }
  }
});
