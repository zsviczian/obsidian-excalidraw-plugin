/** Exercise the actual vault export entry point and existing scene link filter. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function compile(path, dependencies) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../../" + path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: name => dependencies[name] ?? {} });
  return exports;
}

const { sceneRemoveInternalLinks } = compile("src/utils/excalidrawViewUtils.ts", {
  obsidian: { Modal: class {} },
  "../shared/ExcalidrawData": { REG_LINKINDEX_HYPERLINK: /^\w+:\/\// },
});
const writes = [];
const { ViewExportManager } = compile("src/view/managers/ViewExportManager.ts", {
  "../../utils/fileUtils": { getIMGFilename: path => path + ".svg", exportImageToFile: async (...args) => writes.push(args) },
});

for (const method of ["vault", "clipboard"]) for (const include of [true, false]) test(`${method} SVG honors internal links=${include} without changing the source scene`, async () => {
  const scene = { elements: [{ id: "internal", link: "[[Target|Alias]]" }, { id: "external", link: "https://example.com/?q=<tag>&x=1" }], appState: {} };
  const before = structuredClone(scene), rendered = [];
  const view = { file: { path: "Drawing.md" }, excalidrawAPI: {}, getScene: () => scene, plugin: { settings: { autoExportLightAndDark: false } } };
  const manager = new ViewExportManager(view, { getOrCreateExportDialog: () => null, getExportInternalLinks: () => include, sceneRemoveInternalLinks });
  manager.svg = async source => { rendered.push(source); return { outerHTML: JSON.stringify(source.elements.map(element => element.link)) }; };
  if (method === "vault") await manager.saveSVG({ scene }); else await manager.getSVG();
  assert.deepEqual(scene, before);
  assert.equal(rendered.length, 1);
  assert.equal(rendered[0].elements[0].link, include ? "[[Target|Alias]]" : null);
  assert.equal(rendered[0].elements[1].link, before.elements[1].link);
  if (method === "vault") assert.equal(writes.at(-1)[2], JSON.stringify(rendered[0].elements.map(element => element.link)));
});
