/** Execute the production submission hook and parser; no original-source coverage credit. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const compile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const source = readFileSync(new URL("../../src/view/ExcalidrawView.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("ExcalidrawView.ts", source, ts.ScriptTarget.Latest, true);
const viewClass = ast.statements.find((n) => ts.isClassDeclaration(n) && n.name?.text === "ExcalidrawView");
const method = viewClass.members.find((n) => n.name?.getText(ast) === "onBeforeTextSubmit");
const Submit = vm.runInNewContext(compile(`class Submit { ${method.getText(ast)} }\nSubmit;`), {
  window: { setTimeout: () => 1, clearTimeout() {} }, t: (key) => key,
  isTextImageTransclusion: () => false, TextMode: { raw: "raw", parsed: "parsed" },
});
const exports = {};
vm.runInNewContext(compile(readFileSync(new URL("../../src/shared/ExcalidrawData.ts", import.meta.url), "utf8")), {
  exports, require: () => ({}), window: { setTimeout: () => 1, clearTimeout() {} },
});

for (const mode of ["parsed", "raw"]) {
  for (const bound of [false, true]) {
    test(`${mode} ${bound ? "bound" : "standalone"} text submission preserves earlier drawing history and Markdown source`, () => {
      for (const raw of ["plain", "[[link]]", "[[link|label]]", "[label](https://example.com)"]) {
        const model = Object.create(exports.ExcalidrawData.prototype);
        Object.assign(model, { plugin: { settings: { parseTODO: false } }, textElements: new Map(),
          linkPrefix: "", urlPrefix: "", showLinkBrackets: false });
        const undo = ["x", "y", "z", "w", "A"], redo = [], sizes = [];
        const view = Object.assign(Object.create(Submit.prototype), {
          excalidrawAPI: { history: { clear() { undo.length = 0; redo.length = 0; } } },
          semaphores: {}, textMode: mode, excalidrawData: model, setDirty() {},
          updateContainerSize: (...args) => sizes.push(args),
          plugin: { settings: { syncElementLinkWithText: true } },
        });
        const element = { id: "label", type: "text", originalText: "", rawText: "", link: null,
          containerId: bound ? "A" : null };
        const [parsed, link] = model.quickParse(raw);
        const result = view.onBeforeTextSubmit(element, raw, raw, false);
        assert.deepEqual(undo, ["x", "y", "z", "w", "A"], raw);
        assert.equal(model.getRawText(element.id), raw);
        assert.equal(result.updatedNextOriginalText ?? raw, mode === "raw" ? raw : parsed);
        assert.equal(result.nextLink, link);
        assert.equal(sizes.length, bound ? 1 : 0);

        // A cache refresh on unchanged submission after undo must preserve redo too.
        redo.push("text edit", "B");
        model.textElements.delete(element.id);
        view.onBeforeTextSubmit({ ...element, originalText: raw, rawText: raw }, raw, raw, false);
        assert.deepEqual(undo, ["x", "y", "z", "w", "A"], raw);
        assert.deepEqual(redo, ["text edit", "B"], raw);
      }
    });
  }
}
