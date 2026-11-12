/** Canonical picker targets must also retain the existing image-transclusion source slice. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

class TFile {}
const raw = "[Heading](http://www.google.com)", canonical = "Heading http www google com";
const exports = {};
const clean = value => value?.replace(/[:#]/g, "");
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../../src/shared/ExcalidrawData.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, require: name => ({
  obsidian: { TFile, stripHeading: value => value === raw ? canonical : value },
  "../utils/pathUtils": { cleanSectionHeading: clean, cleanBlockRef: clean },
}[name] ?? {}) });

function fixture() {
  const source = "# " + raw + "\n\nFIRST_BODY\n\n## Child\n\nCHILD_BODY\n\n# Other\n\nOTHER_BODY\n";
  const headings = [raw, "Child", "Other"].map((heading, i) => {
    const start = source.indexOf((i === 1 ? "## " : "# ") + heading);
    const content = start + (i === 1 ? 3 : 2);
    return { display: (i === 1 ? "## " : "# ") + (i ? heading : "Heading"), node: {
      type: "heading", depth: i === 1 ? 2 : 1, data: { hProperties: { dataHeading: heading } },
      position: { start: { offset: start, line: i * 4 + 1 } },
      children: [{ value: i ? heading : undefined, children: i ? undefined : [{ value: "Heading" }], position: { start: { offset: content, line: i * 4 + 1 } } }],
    } };
  });
  const file = new TFile();
  const app = { vault: { read: async () => source }, metadataCache: { blockCache: { getForFile: async () => ({ blocks: headings }) } } };
  const resolve = ref => exports.getTransclusion({ path: "Note.md", original: "Note.md#" + ref, ref, isBlockRef: false }, app, file);
  return { source, resolve };
}

test("canonical linked-heading image targets retain the heading body and nested sections", async () => {
  const f = fixture(), result = await f.resolve(canonical);
  assert.equal(result.contents, raw + "\n\nFIRST_BODY\n\n## Child\n\nCHILD_BODY");
  assert.equal(result.leadingHashes, "# "); assert.equal(result.lineNum, 1);
});

test("existing display-label targets, ordinary sections and missing-section fallback stay unchanged", async () => {
  const f = fixture();
  assert.equal((await f.resolve("Heading")).contents, raw + "\n\nFIRST_BODY\n\n## Child\n\nCHILD_BODY");
  assert.equal((await f.resolve("Other")).contents, "Other\n\nOTHER_BODY");
  assert.equal((await f.resolve("Missing")).contents, "Note.md#Missing");
});
