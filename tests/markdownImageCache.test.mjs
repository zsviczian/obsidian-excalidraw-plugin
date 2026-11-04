import test from "node:test";
import assert from "node:assert/strict";
import { createMarkdownImageRenderCacheEntry } from "../src/utils/markdownImageUtils.ts";

test("stored display baseline does not invalidate an unchanged SVG render", () => {
  const render = { width: 400, fontColor: "black" };
  const initial = { schemaVersion: 1, version: 3, source: "local", render };
  const withBaseline = { ...initial, renderedSize: { width: 400, height: 120 } };
  const before = createMarkdownImageRenderCacheEntry("Hello", "drawing.md", initial, render);
  const after = createMarkdownImageRenderCacheEntry("Hello", "drawing.md", withBaseline, render);
  assert.deepEqual(after, before);
});
