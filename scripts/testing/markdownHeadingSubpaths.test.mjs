/** Obsidian's display labels are not link targets; retain cache-owned source identity. */
import assert from "node:assert/strict";
import test from "node:test";
import { sourceHarness } from "./sourceHarness.mjs";

const sourceHeading = "[Heading](http://www.google.com)", linkHeading = "Heading http www google com";
const harness = sourceHarness({
  obsidian: {
    stripHeading: heading => heading === sourceHeading ? linkHeading : heading,
    resolveSubpath: (cache, subpath) => {
      const current = cache.headings.find(heading => "#" + (heading.heading === sourceHeading ? linkHeading : heading.heading) === subpath);
      return current ? { type: "heading", current } : null;
    },
  },
  "src/constants/constants": { MD_EX_SECTIONS: ["# Excalidraw Data"], nanoid: () => "new-block" },
  "src/lang/helpers": { t: key => key }, "src/shared/Scripts": { ScriptEngine: {} },
  "src/utils/pathUtils": { cleanSectionHeading: heading => heading.replace(/[#:]/g, "").trim() },
});
const { getMarkdownHeadingSubpaths } = await harness.importModule("src/shared/Suggesters/markdownSubpathSuggester.ts");
test.after(() => harness.close());

function fixture(headings = ["Plain", sourceHeading, "Plain"]) {
  const cache = { headings: headings.map((heading, i) => ({ heading, position: { start: { offset: i * 100 } } })) };
  const blocks = headings.map((heading, i) => ({ display: heading === sourceHeading ? "# Heading" : "# " + heading,
    node: { type: "heading", position: { start: { offset: i * 100 } } } }));
  return { cache, blocks, app: { metadataCache: { getFileCache: () => cache, blockCache: { getForFile: async () => ({ blocks }) } } } };
}

test("heading suggestions retain formatted source targets, friendly labels and duplicate order", async () => {
  const { app, cache, blocks } = fixture();
  const before = structuredClone({ cache, blocks });
  assert.deepEqual(await getMarkdownHeadingSubpaths(app, {}, false), [
    { display: "# Plain", subpath: "#Plain" }, { display: "# Heading", subpath: "#" + linkHeading }, { display: "# Plain", subpath: "#Plain" },
  ]);
  assert.deepEqual({ cache, blocks }, before);
});

test("missing or unmatched cache cannot offer a section that Obsidian cannot resolve", async () => {
  const f = fixture(); f.cache.headings = [];
  assert.deepEqual(await getMarkdownHeadingSubpaths(f.app, {}, false), []);
  f.app.metadataCache.getFileCache = () => null;
  assert.deepEqual(await getMarkdownHeadingSubpaths(f.app, {}, false), []);
});
