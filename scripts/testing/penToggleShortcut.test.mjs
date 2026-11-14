import assert from "node:assert/strict";
import test from "node:test";
import { sourceHarness } from "./sourceHarness.mjs";

test("P toggles freedraw to selection only for the owning canvas and ignores repeats", async () => {
  const graph = sourceHarness();
  try {
    const { handlePenToggleShortcut: handle } = await graph.importModule("src/view/managers/penToggleShortcut.ts");
    const selected = [], doc = {}, target = { ownerDocument: doc, closest: selector => selector === ".excalidraw" ? {} : null };
    doc.activeElement = target;
    const state = { activeTool: { type: "freedraw" } };
    const view = { ownerDocument: doc, containerEl: { contains: el => el === target }, isClosingOrMigrating: () => false,
      excalidrawAPI: { getAppState: () => state, setActiveTool: tool => selected.push(tool) } };
    const event = extra => ({ key: "p", target, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...extra });
    const e = event(); assert.equal(handle(view, e), true); assert.equal(e.prevented, true); assert.equal(e.stopped, true);
    assert.deepEqual(selected, [{ type: "selection" }]);
    assert.equal(handle(view, event({ repeat: true })), true); assert.equal(selected.length, 1);
    for (const flags of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }, { isComposing: true }, { defaultPrevented: true }, { key: "v" }]) assert.equal(handle(view, event(flags)), false);
    for (const flags of [{ activeTool: { type: "selection" } }, { newElement: {} }, { viewModeEnabled: true }, { openDialog: {} }]) {
      const original = { ...state }; Object.assign(state, flags); assert.equal(handle(view, event()), false);
      for (const key of Object.keys(state)) delete state[key]; Object.assign(state, original);
    }
    target.closest = () => ({}); assert.equal(handle(view, event()), false);
    target.ownerDocument = {}; assert.equal(handle(view, event()), false);
    assert.equal(selected.length, 1);
  } finally { graph.close(); }
});
