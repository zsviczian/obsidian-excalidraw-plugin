/** Load actual drawing data; separators edited by linters must not eat text (#3013). */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../../src/shared/ExcalidrawData.ts", import.meta.url), "utf8");
const exports = {};
const dependencies = {
  "../constants/constants": { JSON_parse: JSON.parse, loadSceneFonts: async () => {} },
  "../utils/sceneDataUtils": { hasExportTheme: () => false },
  "./excalidrawMarkdownParsing": {
    getJSON: data => ({ pos: data.indexOf("# Drawing"), scene: data.slice(data.indexOf("# Drawing") + 10) }),
    parseMarkdownImages: () => new Map(),
    RE_EXCALIDRAWDATA_NOSECTION_OK: /^# Excalidraw Data/m,
    RE_TEXTELEMENTS_NOSECTION_OK: /^##? Text Elements/m,
    RE_EXCALIDRAWDATA_FALLBACK_2: /^# Excalidraw Data/m,
    RE_TEXTELEMENTS_FALLBACK_2: /^##? Text Elements/m,
  },
};
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, require: name => dependencies[name] ?? {}, window: { setTimeout: () => 1, clearTimeout() {} } });

async function load(entries, separator) {
  const model = Object.create(exports.ExcalidrawData.prototype);
  Object.assign(model, {
    plugin: { settings: {} }, markdownImages: new Map(), files: new Map(), equations: new Map(), mermaids: new Map(),
    parse: async text => ({ parsed: text }), setTextMode: async () => true,
  });
  for (const method of ["setShowLinkBrackets", "setLinkPrefix", "setUrlPrefix", "setAutoexportPreferences", "setembeddableThemePreference", "initializeNonInitializedFields", "findNewTextElementsInScene", "findNewElementLinksInScene"]) model[method] = () => {};
  const elements = entries.map(([id, text]) => ({ id, type: "text", text, rawText: text }));
  const data = "# Excalidraw Data\n\n## Text Elements\n" + entries.map(([id, text]) => `${text} ^${id}${separator}`).join("") + "# Drawing\n" + JSON.stringify({ elements, appState: {} });
  assert.equal(await model.loadData(data, { path: "fixture.md" }, "raw"), true);
  return model;
}

for (const separator of ["\n", "\n\n", "\n\n\n\n"]) {
  test(`text survives ${separator.length} newline separator(s), including single-character list markers`, async () => {
    const entries = [["abcd1234", "+"], ["efgh5678", "+"], ["ijkl9012", "- item\n* item\n1. item"], ["mnop3456", "[[note|label]]"]];
    const model = await load(entries, separator);
    for (const [id, text] of entries) {
      assert.equal(model.textElements.get(id).raw, text);
      assert.equal(model.scene.elements.find(el => el.id === id).rawText, text);
    }
  });
}
