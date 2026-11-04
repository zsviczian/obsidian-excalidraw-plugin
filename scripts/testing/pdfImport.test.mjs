/** Execute the actual PDF loader method with deterministic PDF.js/canvas boundaries.
 * AST isolation receives no whole-module source-coverage or native-render credit.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function loader({ reproduceOriginal = false } = {}) {
  const file = new URL(
    "../../src/shared/EmbeddedFileLoader.ts",
    import.meta.url,
  );
  const source = readFileSync(file, "utf8");
  const tree = ts.createSourceFile(
    file.pathname,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  let method, cacheKey;
  const visit = (node) => {
    if (
      ts.isMethodDeclaration(node) &&
      node.name.getText(tree) === "pdfToDataURL"
    )
      method = node.getText(tree);
    if (
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.some(
        (d) => d.name.getText(tree) === "getPDFCacheId",
      )
    )
      cacheKey = node.getText(tree);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.ok(method && cacheKey);
  if (reproduceOriginal)
    method = method.replace("linkParts.ref?.split", "linkParts.ref.split");
  const pages = [],
    crops = [],
    errors = [],
    canvases = [];
  const canvas = () => {
    const value = {
      width: 0,
      height: 0,
      getContext: () => ({}),
      toBlob: (callback) => callback(new Blob(["owned-render"])),
    };
    canvases.push(value);
    return value;
  };
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(`${cacheKey}\nexport class Subject {${method}}`, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      Blob,
      PreviewImageType: { PNG: 1 },
      createEl: canvas,
      getPDFDoc: async () => ({
        getPage: async (number) => {
          pages.push(number);
          return {
            getViewport: ({ scale }) => ({
              width: 100 * scale,
              height: 80 * scale,
            }),
            render: () => ({ promise: Promise.resolve() }),
            view: [0, 0, 100, 80],
            rotate: 0,
          };
        },
      }),
      cropCanvas: (_canvas, crop) => {
        crops.push(crop);
        return canvas();
      },
      blobToBase64: async (blob) =>
        Buffer.from(await blob.arrayBuffer()).toString("base64"),
      errorlog: (error) => errors.push(error),
    },
  );
  const subject = Object.assign(new exports.Subject(), {
    beforeFileRead: true,
    plugin: { settings: { pdfScale: 2 } },
    pdfDocsMap: new Map(),
    pdfDocs: new Set(),
    terminate: false,
  });
  return { subject, pages, crops, errors, canvases };
}

for (const [name, parts, page, size] of [
  ["plain PDF file", { ref: null, page: null }, 1, [200, 160]],
  ["missing PDF reference", { ref: undefined, page: undefined }, 1, [200, 160]],
  ["explicit PDF page", { ref: "page=2", page: 2 }, 2, [200, 160]],
  ["explicit PDF crop", { ref: "page=1&rect=1,2,5,8", page: 1 }, 1, [8, 12]],
])
  test("PDF loader renders " + name, async () => {
    const state = loader();
    const result = await state.subject.pdfToDataURL(
      { path: "Assets/Small.pdf" },
      parts,
    );
    assert.equal(state.errors.length, 0);
    assert.deepEqual(state.pages, [page]);
    assert.equal(result[1].width, size[0]);
    assert.equal(result[1].height, size[1]);
    assert.match(result[0], /^data:image\/png;base64,/);
    assert.equal(result[2].right, 100);
    assert.equal(result[3], 2);
    assert.equal(result[4], false);
    assert.equal(state.canvases.at(-1).width, 0);
    assert.equal(state.canvases.at(-1).height, 0);
    if (parts.ref?.includes("rect="))
      assert.deepEqual(
        { ...state.crops[0] },
        { left: 2, top: 144, width: 8, height: 12 },
      );
  });

test("the previous plain-PDF null-reference path fails the loader evidence", async () => {
  const state = loader({ reproduceOriginal: true });
  const result = await state.subject.pdfToDataURL(
    { path: "Assets/Small.pdf" },
    { ref: null, page: null },
  );
  assert.equal(result[0], null);
  assert.equal(state.errors.length, 1);
  assert.match(String(state.errors[0].error), /null.*split/);
  assert.deepEqual(state.pages, []);
});
