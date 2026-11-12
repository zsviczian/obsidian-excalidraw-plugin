/** Run the actual picker constructor against unsupported frontmatter and valid aliases. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const exports = {};
class SuggestionModal {
  constructor(app, input, items) { this.app = app; this.inputEl = input; this.items = items; }
  setPlaceholder() {}
}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../../src/shared/Suggesters/FileSuggestionModal.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, require: name => ({
  "./SuggestionModal": { SuggestionModal }, "src/lang/helpers": { t: value => value },
  "src/utils/styleUtils": { setStyle() {} },
}[name] ?? {}) });

function picker(values) {
  const items = values.map((aliases, i) => ({ path: `Notes/File-${i}.md`, aliases }));
  const app = { metadataCache: { getFileCache: file => ({ frontmatter: { aliases: file.aliases } }) } };
  const input = { inputEl: { clientWidth: 200, addEventListener() {} } };
  return { items, modal: new exports.FileSuggestionModal(app, input, items, {}) };
}

test("unsupported alias metadata cannot hide mixed vault files or mutate YAML values", () => {
  const values = [undefined, null, {}, { "[object Object]": null }, 1, true, [null, {}, false, 7, ""]];
  const before = structuredClone(values);
  const { items, modal } = picker(values);
  assert.equal(modal.getItems().length, items.length);
  assert.deepEqual(Array.from(modal.getItems(), item => item.path), items.map(item => item.path));
  assert.deepEqual(values, before);
});

test("string aliases remain whole and valid list members remain searchable after reopening", () => {
  for (let i = 0; i < 2; i++) {
    const { modal } = picker(["Whole alias", ["First", null, {}, "Second", ""]]);
    assert.deepEqual(Array.from(modal.getItems(), item => modal.getItemText(item)), [
      "Notes/File-0.md", "Notes/File-0.md|Whole alias", "Notes/File-1.md", "Notes/File-1.md|First", "Notes/File-1.md|Second",
    ]);
  }
});
