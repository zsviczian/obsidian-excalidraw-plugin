/** Run the real update operation with a deferred renderer (#2947). */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as customData from "../src/utils/elementCustomDataUtils.ts";
import * as geometry from "../src/utils/markdownImageUtils.ts";

function fixture() {
  let finish;
  const rendering = new Promise(resolve => { finish = resolve; });
  const render = { width: 400, paddingBottom: 0, fontColor: "black", border: {}, transclusion: { fontColor: "black", border: {} } };
  const make = (id, width = 400, height = 120) => ({ id, fileId: "shared", type: "image", x: 10, y: 20, width, height, customData: { markdownImage: { schemaVersion: 1, version: 1, source: "local", render, renderedSize: { width: 400, height: 120 } } } });
  let elements = [make("one"), make("two", 200, 60)];
  const stored = new Map();
  let saves = 0;
  const view = {
    file: { path: "fixture.md" }, plugin: { settings: { markdownImageSettings: { defaults: render } } },
    getViewElements: () => elements,
    setMarkdownImageEditorIsEditing() {}, rememberMarkdownImageRender() {}, setDirty() {},
    forceSave: async () => { saves++; },
    excalidrawData: { getFile: () => null, setMarkdownImage: (id, data) => stored.set(id, data) },
  };
  let dict = {};
  const ea = {
    imagesDict: {}, copyViewElementsToEAforEditing: input => { dict = Object.fromEntries(input.map(el => [el.id, structuredClone(el)])); },
    getElement: id => dict[id], destroy() {},
    addElementsToView: async () => { elements = elements.map(el => dict[el.id] ?? el); return true; },
  };
  const dependencies = {
    "src/core": { getEA: () => ea },
    "src/shared/EmbeddedFileLoader": { EmbeddedFilesLoader: class { renderMarkdownToSVG() { return rendering; } } },
    "src/utils/elementCustomDataUtils": customData,
    "src/utils/markdownImageUtils": geometry,
    "src/types/markdownImageTypes": { MARKDOWN_IMAGE_CUSTOM_DATA_KEY: customData.MARKDOWN_IMAGE_CUSTOM_DATA_KEY },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../src/shared/MarkdownImage.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: name => dependencies[name] ?? {} });
  return {
    render, view, stored, elements: () => elements, saves: () => saves,
    start: (settings = render, apply = () => true) => exports.updateMarkdownImage(view, elements[0], "new content", settings, "local", apply),
    finish: () => finish({ dataURL: "data:image/svg+xml;base64,fixture", size: { width: 400, height: 260 }, hasSVGwithBitmap: false }),
  };
}

test("content edits grow untouched images while each resized copy retains its bounds", async () => {
  const f = fixture(), done = f.start(); f.finish();
  assert.equal(await done, true);
  assert.deepEqual(f.elements().map(el => [el.width, el.height]), [[400, 260], [200, 60]]);
  assert.equal(f.saves(), 1);
  assert.equal(f.stored.get("shared").markdown, "new content");
});

test("a resize during rendering uses the live scene dimensions", async () => {
  const f = fixture(), done = f.start();
  f.elements()[0].width = 800; f.elements()[0].height = 240;
  f.finish(); await done;
  assert.deepEqual(f.elements().map(el => [el.width, el.height]), [[800, 240], [200, 60]]);
});

test("cancelled render and a removed target do not commit or save", async () => {
  for (const remove of [false, true]) {
    const f = fixture(), done = f.start(f.render, () => remove);
    if (remove) f.elements().splice(0, 1);
    f.finish();
    assert.equal(await done, false);
    assert.equal(f.saves(), 0);
    assert.equal(f.stored.size, 0);
  }
});
