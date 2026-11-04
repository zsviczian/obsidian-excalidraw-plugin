import test from "node:test";
import assert from "node:assert/strict";
import * as customData from "../src/utils/elementCustomDataUtils.ts";

test("Markdown image records the last rendered SVG size without changing appearance", () => {
  const render = { width: 400, fontColor: "black" };
  const element = {
    type: "image",
    customData: {
      markdownImage: { schemaVersion: 1, version: 3, source: "local", render },
      unrelated: "keep",
    },
  };
  customData.setMarkdownImageRenderedSize?.(element, { width: 400, height: 120 });
  assert.deepEqual(element.customData.markdownImage.renderedSize, { width: 400, height: 120 });
  assert.equal(element.customData.markdownImage.render, render);
  assert.equal(element.customData.unrelated, "keep");
});
