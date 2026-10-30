import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";

test("actual behavior decoder requests CORS before loading and never attaches a canvas to the workspace", async () => {
  const text = readFileSync(new URL("./behaviorEnvironment.mjs", import.meta.url), "utf8");
  const file = ts.createSourceFile("behaviorEnvironment.mjs", text, ts.ScriptTarget.Latest, true);
  let initializer;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === "decode") initializer = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(file); assert.ok(initializer);
  let image, requestedCORS, adopted = 0;
  const created = [], revoked = [];
  class Image {
    naturalWidth = 4; naturalHeight = 2;
    set src(value) { this.source = value; requestedCORS = this.crossOrigin; }
    async decode() { assert.equal(requestedCORS, "anonymous"); }
  }
  const pixels = new Uint8ClampedArray([
    255,0,0,255, 0,255,0,255, 0,0,255,255, 0,0,0,0,
    255,0,0,255, 0,255,0,255, 0,0,255,255, 0,0,0,0,
  ]);
  const canvas = { getContext: () => ({ drawImage(value) { image = value; }, getImageData: () => ({ data: pixels }) }) };
  const fragment = { createEl(tag) { assert.equal(tag, "canvas"); return canvas; } };
  const doc = { body: { createEl() { throw Error("Verification mutated the live layout"); } },
    adoptNode(value) { assert.equal(value, fragment); adopted++; return value; } };
  const decode = vm.runInNewContext(`(${initializer.getText(file)})`, {
    win: { Image, URL: { createObjectURL(value) { created.push(value); return "blob:owned"; }, revokeObjectURL(value) { revoked.push(value); } } },
    doc, createFragment: () => fragment, check: (value, label) => assert.ok(value, label),
  });
  for (const source of ["app://fixture/Transparency.png", { type: "image/png" }]) {
    const result = await decode(source);
    assert.equal(result.width, 4); assert.equal(result.height, 2);
    assert.equal(result.red, 2); assert.equal(result.green, 2); assert.equal(result.blue, 2); assert.equal(result.transparent, 2);
  }
  assert.equal(image.crossOrigin, "anonymous"); assert.equal(adopted, 2);
  assert.equal(created.length, 1); assert.deepEqual(revoked, ["blob:owned"]);
});

test("missing-source setup retires the old editor before deleting its file", async () => {
  const text = readFileSync(new URL("./imageBehavior.mjs", import.meta.url), "utf8");
  const start = text.indexOf("const drawing = view.file"), end = text.indexOf("const missing = current()", start);
  assert.ok(start > 0 && end > start);
  let retired = false, removed = false, opened = false;
  const file = { path: "owned-drawing.md" }, asset = { path: "owned-source.svg" };
  const leaf = { view: {}, async setViewState(state) { assert.equal(state.type, "empty"); retired = true; },
    async openFile(value) { assert.equal(value, file); assert.equal(removed, true); opened = true; } };
  const execute = vm.runInNewContext(`(async()=>{${text.slice(start, end)}})`, {
    view: { file }, source: asset,
    env: { leaf, async ready(value) { assert.equal(value, leaf); assert.equal(opened, true); } },
    app: { vault: { async delete(value) { assert.equal(value, asset); assert.equal(retired, true, "Live file deletion creates an incidental loader race"); removed = true; } } },
  });
  await execute(); assert.equal(opened, true);
});
