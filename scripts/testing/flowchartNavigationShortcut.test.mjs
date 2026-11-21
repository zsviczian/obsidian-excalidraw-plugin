import assert from "node:assert/strict";
import test from "node:test";
import { sourceHarness } from "./sourceHarness.mjs";

function fixture() {
  const canvas = {}, container = {querySelector: () => canvas}, doc = {activeElement: container};
  const state = {selectedElementIds: {a: true}};
  const elements = [{id: "a"}, {id: "b"}];
  const view = {ownerDocument: doc, excalidrawContainer: container, isClosingOrMigrating: () => false,
    excalidrawAPI: {getAppState: () => state, getSceneElements: () => elements}};
  const event = extra => ({key: "ArrowUp", altKey: true, target: container,
    preventDefault() {throw Error("Eligibility must not consume the event");},
    stopPropagation() {throw Error("Eligibility must not consume the event");}, ...extra});
  return {view, event, state, elements, doc, canvas, container};
}

test("canvas flowchart arrows remain eligible in their owning main/popout documents", async () => {
  const graph = sourceHarness();
  try {
    const {isCanvasFlowchartNavigationShortcut: eligible} = await graph.importModule("src/view/managers/flowchartNavigationShortcut.ts");
    const first = fixture(), second = fixture();
    for (const context of [first, second]) {
      for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) assert.equal(eligible(context.view, context.event({key})), true);
      assert.equal(eligible(context.view, context.event({repeat: true})), true);
      context.doc.activeElement = context.canvas;
      assert.equal(eligible(context.view, context.event({target: context.canvas})), true);
    }
    assert.equal(eligible(first.view, second.event()), false, "A foreign editor must not use the active view's scope");
  } finally {graph.close();}
});

test("flowchart scope leaves text fields, property popups and other modifier shortcuts alone", async () => {
  const graph = sourceHarness();
  try {
    const {isCanvasFlowchartNavigationShortcut: eligible} = await graph.importModule("src/view/managers/flowchartNavigationShortcut.ts");
    const f = fixture();
    for (const target of [{tagName: "TEXTAREA"}, {tagName: "INPUT"}, {className: "color-picker-content"}, {role: "dialog"}, null]) {
      f.doc.activeElement = target;
      assert.equal(eligible(f.view, f.event({target})), false);
    }
    f.doc.activeElement = f.container;
    for (const flags of [{altKey: false}, {ctrlKey: true}, {metaKey: true}, {shiftKey: true}, {key: "Enter"}, {isComposing: true}, {defaultPrevented: true}]) assert.equal(eligible(f.view, f.event(flags)), false);
    f.doc.activeElement = {};
    assert.equal(eligible(f.view, f.event()), false, "Unfocused canvas input must retain its normal scope");
  } finally {graph.close();}
});

test("flowchart scope requires one live selection and a ready editable canvas", async () => {
  const graph = sourceHarness();
  try {
    const {isCanvasFlowchartNavigationShortcut: eligible} = await graph.importModule("src/view/managers/flowchartNavigationShortcut.ts");
    const f = fixture();
    for (const selectedElementIds of [{}, {a: true, b: true}, {missing: true}]) {
      f.state.selectedElementIds = selectedElementIds;
      assert.equal(eligible(f.view, f.event()), false);
    }
    f.state.selectedElementIds = {a: true, b: false};
    assert.equal(eligible(f.view, f.event()), true);
    for (const key of ["isLoading", "viewModeEnabled", "editingTextElement", "openDialog", "openPopup", "newElement", "resizingElement"]) {
      f.state[key] = true;
      assert.equal(eligible(f.view, f.event()), false);
      delete f.state[key];
    }
    assert.equal(eligible(null, f.event()), false);
    f.view.isClosingOrMigrating = () => true;
    assert.equal(eligible(f.view, f.event()), false);
    f.view.isClosingOrMigrating = () => false;
    f.view.excalidrawAPI = null;
    assert.equal(eligible(f.view, f.event()), false);
  } finally {graph.close();}
});
