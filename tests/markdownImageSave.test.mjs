import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Exercise the actual PDF-link synchronization called during drawing saves.
const source = readFileSync(new URL("../src/shared/ExcalidrawData.ts", import.meta.url), "utf8");
const tree = ts.createSourceFile("ExcalidrawData.ts", source, ts.ScriptTarget.Latest, true);
let method;
function visit(node) {
  if (ts.isMethodDeclaration(node) && node.name.getText(tree) === "syncCroppedPDFs") method = node.getText(tree);
  ts.forEachChild(node, visit);
}
visit(tree);
assert.ok(method);
const exports = {};
vm.runInNewContext(ts.transpileModule(`export class Subject { ${method} }`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, getPDFRect: () => "&rect=1,2,3,4" });

test("saving cropped local Markdown and equations skips file-backed PDF synchronization", () => {
  const subject = new exports.Subject();
  subject.plugin = { settings: { pdfScale: 1 } };
  subject.scene = { elements: [
    { id: "markdown", type: "image", fileId: "local-markdown", crop: {} },
    { id: "formula", type: "image", fileId: "equation", crop: {} },
    { id: "remote", type: "image", fileId: "remote", crop: {} },
    { id: "note", type: "image", fileId: "note", crop: {} },
    { id: "pdf", type: "image", fileId: "pdf", crop: {} },
    { id: "deleted", type: "image", fileId: "pdf", crop: {}, isDeleted: true },
  ] };
  const files = new Map([
    ["remote", {}], ["note", { file: { extension: "md" } }],
    ["pdf", { file: { extension: "pdf" }, linkParts: { original: "source.pdf#page=2" } }],
  ]);
  subject.getFile = id => files.get(id);
  subject.elementLinks = new Map();
  subject.syncCroppedPDFs();
  assert.deepEqual([...subject.elementLinks], [["pdf", "[[source.pdf#page=2&rect=1,2,3,4]]"]]);
  assert.ok(subject.scene.elements.slice(0, 4).every(element => element.link === undefined));
  assert.equal(subject.scene.elements.at(-1).link, undefined);
});
