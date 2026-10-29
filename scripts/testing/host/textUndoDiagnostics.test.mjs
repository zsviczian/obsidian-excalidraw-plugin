import assert from "node:assert/strict";
import test from "node:test";
import { captureTextUndoState } from "./textUndoDiagnostics.mjs";

function fixture() {
  const history = { undoStack: [{}], redoStack: [{}, {}] };
  const button = (x, disabled) => ({
    disabled,
    bounds: { x, y: 10, width: 30, height: 20 },
    getBoundingClientRect() {
      return this.bounds;
    },
    closest() {
      return this;
    },
  });
  const undo = button(10, false),
    redo = button(50, true);
  const root = {
    className: "excalidraw",
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 800, height: 600 }),
    __reactFiber$owned: { return: { stateNode: { history } } },
  };
  const win = {
    closed: false,
    innerWidth: 800,
    innerHeight: 600,
    getComputedStyle: () => ({ display: "block", visibility: "visible" }),
    require: () => ({ getCurrentWebContents: () => ({ id: 42 }) }),
  };
  const doc = {
    defaultView: win,
    hasFocus: () => true,
    elementFromPoint: (x) => (x < 50 ? undo : redo),
  };
  const element = {
    id: "owned",
    type: "text",
    text: "label",
    originalText: "label",
    rawText: "[[file|label]]",
    version: 2,
  };
  const query = (selector) =>
    selector === ".excalidraw"
      ? root
      : selector.includes("button-undo")
        ? undo
        : selector.includes("button-redo")
          ? redo
          : null;
  const view = {
    file: { path: "__excalidraw_cli_smoke_owned.md" },
    textMode: "parsed",
    compatibilityMode: false,
    isDirty: () => true,
    isClosingOrMigrating: () => false,
    containerEl: { ownerDocument: doc, querySelector: query },
    excalidrawData: {
      getParsedResult: () => ({ raw: element.rawText, parsed: element.text }),
    },
    excalidrawAPI: {
      getAppState: () => ({
        viewModeEnabled: false,
        selectedElementIds: { owned: true },
      }),
      getSceneElementsIncludingDeleted: () => [element],
      getEditorInterface: () => ({ formFactor: "desktop" }),
    },
  };
  const workspace = {
    containerEl: { ownerDocument: doc },
    activeLeaf: {
      id: "other",
      view: { file: { path: "Notes/Other.md" }, getViewType: () => "markdown" },
    },
    getLayout: () => ({ active: "other", main: { id: "split" } }),
  };
  return { history, undo, redo, root, win, doc, view, workspace };
}

test("text-history diagnostics preserve owning window, leaked active target, controls and actual stack depths without mutation", () => {
  const f = fixture(),
    snapshot = captureTextUndoState(f.view, f.workspace);
  assert.equal(snapshot.owner.contentsId, 42);
  assert.equal(snapshot.owner.main, true);
  assert.equal(snapshot.activeLeaf.file, "Notes/Other.md");
  assert.equal(snapshot.targetDrawing, f.view.file.path);
  assert.equal(snapshot.controls.undo.disabled, false);
  assert.equal(snapshot.controls.redo.disabled, true);
  assert.equal(snapshot.controls.undo.visible, true);
  assert.deepEqual(snapshot.history, {
    source: "read-only owning App fiber",
    undoDepth: 1,
    redoDepth: 2,
  });
  assert.equal(snapshot.elements[0].cache.raw, "[[file|label]]");
  assert.deepEqual(f.history, { undoStack: [{}], redoStack: [{}, {}] });
  assert.doesNotThrow(() => JSON.stringify(snapshot));
});

test("missing and hidden history controls remain unavailable evidence and cyclic private fibers stay bounded", () => {
  const f = fixture(),
    original = f.view.containerEl.querySelector;
  f.view.containerEl.querySelector = (selector) =>
    selector.includes("button-redo") ? null : original(selector);
  f.undo.bounds.width = 0;
  f.win.getComputedStyle = () => ({ display: "none", visibility: "hidden" });
  const cyclic = {};
  cyclic.return = cyclic;
  f.root["__reactFiber$owned"] = cyclic;
  const snapshot = captureTextUndoState(f.view, f.workspace);
  assert.equal(snapshot.controls.redo.present, false);
  assert.equal(snapshot.controls.redo.disabled, null);
  assert.equal(snapshot.controls.redo.visible, false);
  assert.equal(snapshot.controls.undo.visible, false);
  assert.equal(snapshot.history.source, "not exposed by public API");
  assert.doesNotThrow(() => JSON.stringify(snapshot));
});
