/** A code paste may finish rendering after its drawing has been replaced. */
import assert from "node:assert/strict";
import test from "node:test";
import { sourceHarness } from "./sourceHarness.mjs";
let f;
const render = { width: 400, border: {}, transclusion: { border: {} } };
const harness = sourceHarness({
  obsidian: { TFile: class {} },
  "src/core": { getEA: () => f.ea },
  "src/constants/constants": { fileid: () => "source-id", MD_EX_SECTIONS: {} },
  "src/shared/EmbeddedFileLoader": { EmbeddedFile: class {}, EmbeddedFilesLoader: class {
    async renderMarkdownToSVG() { f.onRender(); return { dataURL: "data:image/svg+xml,test", size: { width: 400, height: 140 } }; }
  } },
  "src/shared/ExcalidrawData": { getTransclusion() {}, REGEX_LINK: {} },
  "src/utils/elementCustomDataUtils": { addAppendUpdateCustomData: (el, data) => el.customData = { ...el.customData, ...data }, setMarkdownImageRenderedSize() {} },
  "src/types/markdownImageTypes": { MARKDOWN_IMAGE_CUSTOM_DATA_KEY: "markdownImage", MARKDOWN_IMAGE_SCHEMA_VERSION: 1 },
  "src/utils/markdownImageUtils": { resolveMarkdownImageRenderSettings: () => render, getMarkdownImageDisplayGeometry() {}, getMarkdownImageCropGeometry() {} },
  "src/utils/pathUtils": { cleanSectionHeading: s => s },
  "src/utils/coreUtils": { errorlog: error => { throw error; } },
});
const { insertMarkdownImage } = await harness.importModule("src/shared/MarkdownImage.ts");
test.after(() => harness.close());
function setup() {
  f = { commits: 0, destroyed: 0, dirty: 0, selected: 0, sources: new Map(), onRender() {}, onAddImage() {} };
  const el = { id: "element", type: "image", fileId: "temporary" };
  f.ea = { imagesDict: {}, async addImage() { f.onAddImage(); return el.id; }, getElement: () => el,
    async addElementsToView() { f.commits++; return true; }, destroy() { f.destroyed++; } };
  f.view = { file: {}, excalidrawAPI: { selectElements() { f.selected++; } }, currentPosition: { x: 1, y: 2 },
    isClosingOrMigrating: () => false, plugin: { settings: { markdownImageSettings: { defaults: render } } },
    excalidrawData: { setMarkdownImage: (id, source) => f.sources.set(id, source) },
    getViewElements: () => [el], rememberMarkdownImageRender() {}, setDirty() { f.dirty++; } };
  return f;
}
test("Markdown image insertion retains editable local text and commits once", async () => {
  const state = setup(); const element = await insertMarkdownImage(state.view, "```js\nx();\n```");
  assert.equal(element.type, "image"); assert.equal(element.customData.markdownImage.source, "local");
  assert.equal(state.sources.get(element.fileId).markdown, "```js\nx();\n```");
  assert.equal(state.commits, 1); assert.equal(state.destroyed, 1); assert.equal(state.dirty, 1); assert.equal(state.selected, 1);
});
test("Markdown image render and decode cannot insert into a replaced file, API or migrating view", async () => {
  for (const phase of ["onRender", "onAddImage"]) {
    for (const retire of [view => view.file = {}, view => view.excalidrawAPI = { selectElements() {} }, view => view.isClosingOrMigrating = () => true]) {
      const state = setup(); state[phase] = () => retire(state.view);
      assert.equal(await insertMarkdownImage(state.view, "```js\nx();\n```"), null);
      assert.equal(state.commits, 0); assert.equal(state.sources.size, 0); assert.equal(state.dirty, 0);
      assert.equal(state.destroyed, phase === "onAddImage" ? 1 : 0);
    }
  }
});
