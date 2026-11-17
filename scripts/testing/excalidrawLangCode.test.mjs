/** Exercise the real Obsidian language -> Excalidraw canvas langCode lookup (#2956). */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const NAMES = new Set(["LOCALE", "obsidianToExcalidrawMap", "getExcalidrawLangCode"]);

// constants.ts needs the Obsidian runtime, so only the declarations on the lookup path are run
function lookupFor(obsidianLanguage) {
  const path = resolve(import.meta.dirname, "../../src/constants/constants.ts");
  const file = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
  const source = file.statements
    .filter(node => ts.isFunctionDeclaration(node)
      ? NAMES.has(node.name?.text)
      : ts.isVariableStatement(node) && node.declarationList.declarations.some(d => NAMES.has(d.name.getText(file))))
    .map(node => node.getText(file).replace(/^export /, ""))
    .join("\n");
  const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const context = { getLanguage: () => obsidianLanguage };
  vm.runInNewContext(`${javascript}\nthis.langCode = getExcalidrawLangCode(LOCALE);`, context);
  return context.langCode;
}

test("Obsidian pt-BR selects the Brazilian Portuguese canvas", () => {
  assert.equal(lookupFor("pt-BR"), "pt-BR");
});

test("European Portuguese stays distinct", () => {
  assert.equal(lookupFor("pt"), "pt-PT");
});

test("English and unknown languages use en-US", () => {
  assert.equal(lookupFor("en"), "en-US");
  assert.equal(lookupFor("xx-YY"), "en-US");
});

test("other region-specific languages keep their mapping", () => {
  assert.equal(lookupFor("fi-FI"), "fi-FI");
  assert.equal(lookupFor("zh-TW"), "zh-TW");
  assert.equal(lookupFor("zh"), "zh-CN");
});
