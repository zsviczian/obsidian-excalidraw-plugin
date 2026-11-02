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
    async renderMarkdownToSVG(file, markdown, settings, autoFit) {
      f.renders.push({ file, markdown, settings: structuredClone(settings), autoFit });
      f.onRender(); return { dataURL: "data:image/svg+xml,test", size: { width: autoFit ? f.fittedWidth : settings.width, height: 140 } };
    }
  } },
  "src/shared/ExcalidrawData": { getTransclusion() {}, REGEX_LINK: {} },
  "src/utils/elementCustomDataUtils": { addAppendUpdateCustomData: (el, data) => el.customData = { ...el.customData, ...data }, setMarkdownImageRenderedSize() {} },
  "src/types/markdownImageTypes": { MARKDOWN_IMAGE_CUSTOM_DATA_KEY: "markdownImage", MARKDOWN_IMAGE_SCHEMA_VERSION: 1 },
  "src/utils/markdownImageUtils": { resolveMarkdownImageRenderSettings: defaults => structuredClone(defaults), getMarkdownImageDisplayGeometry() {}, getMarkdownImageCropGeometry() {} },
  "src/utils/codeBlockMarkdownImageUtils": { CODE_BLOCK_IMAGE_MAX_WIDTH: 800 },
  "src/utils/pathUtils": { cleanSectionHeading: s => s },
  "src/utils/coreUtils": { errorlog: error => { throw error; } },
});
const { insertMarkdownImage, insertCodeBlockMarkdownImage } = await harness.importModule("src/shared/MarkdownImage.ts");
test.after(() => harness.close());
function setup() {
  f = { commits: 0, destroyed: 0, dirty: 0, selected: 0, sources: new Map(), renders: [], fittedWidth: 640, onRender() {}, onAddImage() {} };
  const el = { id: "element", type: "image", fileId: "temporary" };
  f.ea = { imagesDict: {}, async addImage() { f.onAddImage(); return el.id; }, getElement: () => el,
    async addElementsToView() { f.commits++; return true; }, destroy() { f.destroyed++; } };
  f.view = { file: {}, excalidrawAPI: { selectElements() { f.selected++; } }, currentPosition: { x: 1, y: 2 },
    isClosingOrMigrating: () => false, plugin: { settings: { markdownImageSettings: { defaults: structuredClone(render) } } },
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
  for (const insert of [insertMarkdownImage, insertCodeBlockMarkdownImage]) for (const phase of ["onRender", "onAddImage"]) {
    for (const retire of [view => view.file = {}, view => view.excalidrawAPI = { selectElements() {} }, view => view.isClosingOrMigrating = () => true]) {
      const state = setup(); state[phase] = () => retire(state.view);
      assert.equal(await insert(state.view, "```js\nx();\n```"), null);
      assert.equal(state.commits, 0); assert.equal(state.sources.size, 0); assert.equal(state.dirty, 0);
      assert.equal(state.destroyed, phase === "onAddImage" ? 1 : 0);
    }
  }
});
test("pasted code requests adaptive width once and persists the actual flow width without changing general defaults", async () => {
  const state = setup(); state.view.plugin.settings.markdownImageSettings.defaults.width = 180;
  const code = "```js\nconsole.log('adaptive');\n```";
  const element = await insertCodeBlockMarkdownImage(state.view, code);
  assert.equal(state.renders[0].autoFit, true); assert.equal(state.renders[0].settings.width, 800);
  assert.equal(element.width, 640); assert.equal(element.customData.markdownImage.render.width, 640);
  assert.equal(state.view.plugin.settings.markdownImageSettings.defaults.width, 180);
  assert.equal(state.sources.get(element.fileId).markdown, code); assert.equal(state.commits, 1);
  await insertMarkdownImage(state.view, code);
  assert.equal(state.renders[1].autoFit, false); assert.equal(state.renders[1].settings.width, 180);
});
