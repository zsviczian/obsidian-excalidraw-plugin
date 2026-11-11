import assert from "node:assert/strict";
import test from "node:test";
import { sourceHarness } from "./sourceHarness.mjs";
const graph = sourceHarness({ "./pathUtils": { cleanBlockRef: value => value, cleanSectionHeading: value => value } });
const { rewriteDrawingPreviewLink: rewrite, getDrawingPreviewParts: parts } = await graph.importModule("src/utils/drawingPreviewLink.ts");
const { getEmbeddedFileMasterLink: restore } = await graph.importModule("src/utils/linkUtils.ts");
const { getThumbnailPaddingConfig } = await graph.importModule("src/utils/thumbnailPadding.ts");
test.after(() => graph.close());

test("thumbnail and whole-scene padding remain independent of frame selection and anchoring", () => {
  assert.equal(rewrite("Draw.md", { padding: 40 }), "Draw.md#^as-image,padding=40");
  assert.equal(rewrite("Draw.md#^group=abc", { padding: 40 }), "Draw.md#^group=abc,padding=40");
  assert.equal(parts("Draw.md#^as-image,padding=40|100%").blockref, "as-image");
  assert.equal(parts("Draw.md#^as-image,padding=40|100%").padding, 40);
  assert.equal(rewrite("Draw.md#^frame=,padding=40|100%", { frame: null }), "Draw.md#^as-image,padding=40|100%");
  assert.equal(rewrite("Draw.md#^as-image,padding=40|100%", { frame: "b" }), "Draw.md#^frame=b,padding=40|100%");
  assert.equal(rewrite("Draw.md#^frame=b,padding=40|100%", { padding: null }), "Draw.md#^frame=b|100%");
  assert.equal(rewrite("Draw.md#^frame=b,padding=40|100%", { anchored: false }), "Draw.md#^frame=b,padding=40");
  assert.equal(rewrite("100% ../Draw.md#^area=a|Caption", { anchored: true }), "100% ../Draw.md#^area=a|Caption|100%");
});

test("preview changes preserve raw encoding, padding, other aliases and the shared master-map link", () => {
  const old = "../Draw%20one%23%5Eclippedframe%3DOld%2Cpadding%3D00%2E50|Alias|100%";
  assert.equal(rewrite(old, { frame: "new" }), "../Draw%20one%23%5Eclippedframe%3Dnew%2Cpadding%3D00%2E50|Alias|100%");
  assert.equal(rewrite("Draw.md#^frame=Part,padding=10, two", { padding: 20 }), "Draw.md#^frame=Part,padding=10, two,padding=20");
  assert.equal(restore("Draw.md|100%", "^as-image,padding=40|100%"), "Draw.md#^as-image,padding=40|100%");
  assert.equal(restore("Draw.md|100%", "^frame=b,padding=40"), "Draw.md#^frame=b,padding=40|100%");
  assert.equal(restore("Draw.md", "^frame=b,padding=40|Caption"), "Draw.md#^frame=b,padding=40|Caption");
  assert.equal(restore("Draw.md|100%", null), "Draw.md|100%");
});

test("outer thumbnail padding enlarges the viewport while retaining the original frame clip", () => {
  const frame = { id: "f", x: 100, y: 200, width: 300, height: 150 };
  const config = getThumbnailPaddingConfig({ exportingFrame: frame, withBackground: false, withTheme: true }, { theme: "dark" }, 25, 2);
  assert.deepEqual(config, { exportingFrame: frame, padding: 0, scale: 2, fit: "none", origin: "canvas", x: 75, y: 175, width: 350, height: 200, theme: "dark", canvasBackgroundColor: false });
  assert.equal(config.exportingFrame, frame);
});
