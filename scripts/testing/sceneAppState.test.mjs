import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// Exercise the view's scene capture and the model's Markdown payload serializer intact.
function loadMethods(path, className, names, dependencies = {}) {
  const source = ts.createSourceFile(path, readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === className);
  const methods = names.map(name => {
    const method = declaration.members.find(node => node.name?.getText(source) === name);
    assert.ok(method, `${className}.${name}`);
    return method.getText(source);
  });
  const { outputText } = ts.transpileModule(`export class Loaded { ${methods.join("\n")} }`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  new Function("exports", ...Object.keys(dependencies), outputText)(exports, ...Object.values(dependencies));
  return exports.Loaded.prototype;
}

const viewMethods = loadMethods("src/view/ExcalidrawView.ts", "ExcalidrawView", ["getScene", "getSceneWithAppState"], {
  URLs: { GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_RELEASES_TAG: "https://example.test/releases" },
  PLUGIN_VERSION: "test",
  getAppStateStrokeWidthEntry: () => ({}),
});
const dataMethods = loadMethods("src/shared/ExcalidrawData.ts", "ExcalidrawData", ["generateMDBase"]);

test("Markdown scene payload preserves both hint values and every input device", () => {
  for (const showHints of [false, true]) {
    for (const inputDevice of ["auto", "mouse", "trackpad"]) {
      const view = Object.assign(Object.create(viewMethods), {
        excalidrawAPI: {
          getAppState: () => ({ showHints, inputDevice, activeTool: { type: "selection" } }),
          getSceneElements: () => [], getFiles: () => ({}),
        },
      });
      const model = {
        scene: view.getScene(), plugin: { settings: {} }, textElements: new Map(),
        elementLinks: new Map(), equations: new Map(), files: new Map(), markdownImages: new Map(),
      };
      const { sceneJSONstring } = dataMethods.generateMDBase.call(model);
      const saved = JSON.parse(sceneJSONstring);
      assert.equal(saved.appState.showHints, showHints);
      assert.equal(saved.appState.inputDevice, inputDevice);
      const snapshot = view.getSceneWithAppState(false, {
        showHints: !showHints, inputDevice: "trackpad", activeTool: { type: "selection" },
      });
      assert.equal(snapshot.appState.showHints, !showHints);
      assert.equal(snapshot.appState.inputDevice, "trackpad");
    }
  }
});
