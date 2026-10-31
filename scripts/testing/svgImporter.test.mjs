/** Exercise the actual public method and dialog publication/cleanup boundaries. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { loadConverter } from "./svgConverterHarness.mjs";

function loadMethod(file, name, scope) {
  const source = readFileSync(
    new URL(`../../src/${file}`, import.meta.url),
    "utf8",
  );
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  let text;
  const visit = (node) => {
    if (ts.isMethodDeclaration(node) && node.name.getText(tree) === name)
      text = node.getText(tree);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.ok(text, `${file}:${name}`);
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(`export class Subject{${text}}`, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    { exports, ...scope },
  );
  return exports.Subject;
}
const notices = [];
const Subject = loadMethod("shared/ExcalidrawAutomate.ts", "importSVG", {
  svgToExcalidraw: loadConverter(),
  t: (key) => key,
  Notice: class {
    constructor(message) {
      notices.push(message);
    }
  },
});
function workbench() {
  const ea = new Subject();
  ea.elementsDict = {
    sentinel: { id: "sentinel", type: "rectangle", width: 17 },
  };
  ea.copyViewElementsToEAforEditing = (elements) => {
    for (const e of elements) ea.elementsDict[e.id] = structuredClone(e);
  };
  return ea;
}
test("ea.importSVG stays synchronous, appends fresh elements and leaves unrelated work untouched", () => {
  const ea = workbench(),
    before = JSON.stringify(ea.elementsDict.sentinel);
  const value = ea.importSVG(
    '<svg><g><rect width="20" height="10"/></g></svg>',
  );
  assert.equal(value, true);
  assert.equal(JSON.stringify(ea.elementsDict.sentinel), before);
  assert.equal(Object.keys(ea.elementsDict).length, 2);
  ea.importSVG('<svg><g><rect width="20" height="10"/></g></svg>');
  assert.equal(Object.keys(ea.elementsDict).length, 3);
});
test("fatal import cannot partially append or clear an existing workbench", () => {
  const ea = workbench(),
    before = JSON.stringify(ea.elementsDict);
  assert.equal(
    ea.importSVG(
      '<svg><rect width="20" height="10"/><use href="#missing"/></svg>',
    ),
    false,
  );
  assert.equal(JSON.stringify(ea.elementsDict), before);
  assert.match(notices.at(-1), /SVG_IMPORT_ERROR/);
});
test("ea.importSVG publishes all geometry and a paint approximation notice for unsupported colors", () => {
  const ea = workbench(),
    before = JSON.stringify(ea.elementsDict.sentinel);
  assert.equal(
    ea.importSVG(
      '<svg color="blue"><rect width="20" height="10" fill="color(display-p3 1 0 0)"/><rect x="25" width="20" height="10" fill="red"/></svg>',
    ),
    true,
  );
  assert.equal(JSON.stringify(ea.elementsDict.sentinel), before);
  const imported = Object.values(ea.elementsDict).filter(
    (e) => e.id !== "sentinel",
  );
  assert.equal(imported.length, 2);
  assert.equal(imported[0].backgroundColor, "#0000ff");
  assert.equal(imported[1].backgroundColor, "#ff0000");
  assert.match(notices.at(-1), /SVG_IMPORT_PAINT/);
});
test("partial/approximate conversions show diagnostics, while transparent SVG remains valid", () => {
  const ea = workbench();
  assert.equal(
    ea.importSVG(
      '<svg><text>unsupported</text><rect width="10" height="10"/></svg>',
    ),
    true,
  );
  assert.match(notices.at(-1), /SVG_IMPORT_UNSUPPORTED/);
  assert.equal(
    ea.importSVG('<svg><rect width="10" height="10" opacity="0"/></svg>'),
    true,
  );
  assert.ok(Object.values(ea.elementsDict).some((e) => e.opacity === 0));
});

function dialogFixture({
  svg = "<svg/>",
  success = true,
  empty = false,
  error = false,
  deferred = false,
} = {}) {
  const calls = [];
  let resolve;
  const view = { file: { path: "drawing.md" }, excalidrawAPI: {} };
  const ea = {
    importSVG() {
      calls.push("import");
      return success;
    },
    getElements: () => (empty ? [] : [{ id: "owned" }]),
    addToGroup() {
      calls.push("group");
    },
    async addElementsToView() {
      calls.push("insert");
    },
    destroy() {
      calls.push("destroy");
    },
  };
  const Dialog = loadMethod(
    "shared/Dialogs/ImportSVGDialog.ts",
    "onChooseItem",
    {
      getEA: () => ea,
      t: (x) => x,
      errorlog: () => calls.push("error"),
      Notice: class {},
    },
  );
  const dialog = new Dialog();
  dialog.view = view;
  dialog.app = {
    vault: {
      read: () =>
        deferred
          ? new Promise((r) => {
              resolve = r;
            })
          : error
            ? Promise.reject(Error("read failed"))
            : Promise.resolve(svg),
    },
  };
  dialog.onChooseItem({ path: "sample.svg" }, {});
  return { calls, view, finish: () => resolve(svg) };
}
const settled = () => new Promise((resolve) => setImmediate(resolve));
for (const options of [
  { success: false },
  { empty: true },
  { svg: "" },
  { error: true },
])
  test(`dialog declines failed/empty imports and always destroys EA: ${JSON.stringify(options)}`, async () => {
    const f = dialogFixture(options);
    await settled();
    assert.ok(!f.calls.includes("group"));
    assert.ok(!f.calls.includes("insert"));
    assert.equal(f.calls.filter((c) => c === "destroy").length, 1);
  });
test("dialog inserts only a completed conversion and destroys EA once", async () => {
  const f = dialogFixture();
  await settled();
  assert.deepEqual(f.calls, ["import", "group", "insert", "destroy"]);
});
test("dialog does not insert into a replaced editor after an awaited read", async () => {
  const f = dialogFixture({ deferred: true });
  f.view.excalidrawAPI = {};
  f.finish();
  await settled();
  assert.deepEqual(f.calls, ["destroy"]);
});
