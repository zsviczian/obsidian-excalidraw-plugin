import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";

const compile = (path, dependencies = {}) => {
  const code = ts.transpileModule(readFileSync(new URL("../../" + path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {}; vm.runInNewContext(code, { exports, require: name => dependencies[name] ?? {} }); return exports;
};
const parts = compile("src/utils/embeddedFilenameParts.ts");
const links = compile("src/utils/linkUtils.ts", { "./pathUtils": { cleanBlockRef: value => value, cleanSectionHeading: value => value } });
const { EmbeddedFile } = compile("src/shared/EmbeddedFileLoader.ts", {
  "../utils/sceneDataUtils": links, "../utils/embeddedAssetUtils": parts, obsidian: { Notice: class {} },
});
const drawing = { path: "Folder/Draw.md", extension: "md" }, note = { path: "Note.md", extension: "md" };
const plugin = { settings: { mdSVGwidth: 500, mdSVGmaxHeight: 500 }, isExcalidrawFile: file => file === drawing,
  app: { metadataCache: { getFirstLinkpathDest: path => path === "Note.md" ? note : drawing } } };

test("embedded drawing loader recognizes padded default and whole-scene links while retaining 100%", () => {
  for (const [link, frame, anchored] of [
    ["Draw.md#^as-image,padding=40|100%", false, true],
    ["Draw.md#^frame=,padding=30", true, false],
    ["Draw.md#^frame=some-id,padding=20|100%", true, true],
  ]) {
    const file = new EmbeddedFile(plugin, "Host.md", link);
    assert.equal(file.file, drawing); assert.equal(file.filenameparts.filepath, drawing.path);
    assert.equal(file.isMarkdownSection, false); assert.equal(file.filenameparts.hasFrameref, frame);
    assert.equal(file.shouldScale(), !anchored); assert.equal(file.linkParts.original, link);
    assert.ok(file.filenameparts.padding > 0);
  }
});

test("an ordinary Markdown block named as-image keeps its section-transclusion behavior", () => {
  const file = new EmbeddedFile(plugin, "Host.md", "Note.md#^as-image");
  assert.equal(file.file, note); assert.equal(file.isMarkdownSection, true);
});
