/** Execute the production capture handler, including retirement during submission. */
import assert from "node:assert/strict";
import test from "node:test";
import { sourceHarness } from "./sourceHarness.mjs";

const harness = sourceHarness();
const { handleTextSaveShortcut } = await harness.importModule("src/view/managers/textSaveShortcut.ts");
test.after(() => harness.close());

function fixture() {
  const calls = [], doc = {}, api = {}, file = {};
  const editable = { tagName: "TEXTAREA", classList: { contains: name => name === "excalidraw-wysiwyg" }, ownerDocument: doc,
    blur() { calls.push("submit"); } };
  doc.activeElement = editable;
  const view = { excalidrawAPI: api, file, ownerDocument: doc, containerEl: { contains: () => true },
    isClosingOrMigrating: () => false,
    packages: { reactDOM: { flushSync(callback) { calls.push("flush"); callback(); calls.push("committed"); } } },
    forceSave(...args) { calls.push(["forceSave", ...args]); } };
  const event = { target: editable, key: "s", ctrlKey: true,
    preventDefault() { calls.push("preventDefault"); }, stopPropagation() { calls.push("stopPropagation"); } };
  return { calls, doc, editable, view, event };
}

for (const modifier of ["ctrlKey", "metaKey"]) {
  test(`${modifier} save submits and commits before forced persistence, waiting for busy saves`, () => {
    const f = fixture(); Object.assign(f.event, { ctrlKey: false, [modifier]: true, key: "S" });
    handleTextSaveShortcut(f.view, f.event);
    assert.deepEqual(f.calls, ["preventDefault", "stopPropagation", "flush", "submit", "committed", ["forceSave", false, true]]);
  });
}
test("unrelated shortcuts, Shift+S and embedded Markdown editors retain their handlers", () => {
  for (const mutation of [
    f => f.event.shiftKey = true, f => f.event.altKey = true, f => f.event.ctrlKey = false,
    f => f.event.key = "x", f => f.editable.tagName = "DIV", f => f.editable.classList.contains = () => false,
    f => f.doc.activeElement = {}, f => f.view.containerEl.contains = () => false, f => f.editable.ownerDocument = {},
    f => f.view.file = null, f => f.view.excalidrawAPI = null, f => f.view.isClosingOrMigrating = () => true,
  ]) {
    const f = fixture(); mutation(f); handleTextSaveShortcut(f.view, f.event); assert.deepEqual(f.calls, []);
  }
});
test("submission cannot save a replacement file, API or retiring view", () => {
  for (const retire of [f => f.view.file = {}, f => f.view.excalidrawAPI = {}, f => f.view.isClosingOrMigrating = () => true]) {
    const f = fixture(); f.editable.blur = () => { f.calls.push("submit"); retire(f); };
    handleTextSaveShortcut(f.view, f.event);
    assert.deepEqual(f.calls, ["preventDefault", "stopPropagation", "flush", "submit", "committed"]);
  }
});
