/** Trusted input: earlier shapes survive link submission in the undo/redo chain. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { captureTextUndoState } from "./textUndoDiagnostics.mjs";

export async function runTextCreationHistory({ cli, drawingPath, reportDir, prepareFixture }) {
  const view = `app.workspace.getLeavesOfType('excalidraw').find(l=>l.view.file?.path===${JSON.stringify(drawingPath)})?.view`;
  const evaluate = (code) => JSON.parse(cli("eval", "code=" + code).trim().replace(/^=>\s*/, ""));
  const cdp = (method, params) => cli("dev:cdp", "method=" + method, "params=" + JSON.stringify(params));
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const snapshots = [], completed = [];
  const persist = () => writeFileSync(join(reportDir, "text-creation-history.json"), JSON.stringify({ completed, snapshots }, null, 2));
  const state = () => evaluate(`JSON.stringify((${captureTextUndoState.toString()})(${view},app.workspace))`);
  const scene = () => evaluate(`JSON.stringify(${view}.excalidrawAPI.getSceneElements().map(e=>({id:e.id,type:e.type,x:e.x,y:e.y,width:e.width,height:e.height,angle:e.angle,rawText:e.rawText,text:e.text,originalText:e.originalText,link:e.link,containerId:e.containerId,boundElements:e.boundElements})))`);
  async function poll(predicate, label, read = scene) {
    const end = Date.now() + 10000;
    for (;;) { const value = read(); if (predicate(value)) return value;
      if (Date.now() >= end) throw Error(label + ": " + JSON.stringify(value)); await wait(50); }
  }
  const key = (key, code, keyCode, modifiers = 0) => {
    for (const type of ["keyDown", "keyUp"]) cdp("Input.dispatchKeyEvent", { type, key, code, windowsVirtualKeyCode: keyCode, modifiers });
  };
  const mouse = (type, point, extra = {}) => cdp("Input.dispatchMouseEvent", { type, ...point, button: "left", clickCount: 1, ...extra });
  const click = (point, count = 1) => { mouse("mousePressed", point, { clickCount: count }); mouse("mouseReleased", point, { clickCount: count }); };
  const focus = () => evaluate(`(()=>{${view}.containerEl.querySelector('.excalidraw').focus();return JSON.stringify(true)})()`);
  async function draw(point, width, count) {
    focus(); key("r", "KeyR", 82);
    mouse("mouseMoved", point); mouse("mousePressed", point, { buttons: 1 });
    mouse("mouseMoved", { x: point.x + width / 2, y: point.y + 35 }, { buttons: 1 });
    mouse("mouseMoved", { x: point.x + width, y: point.y + 70 }, { buttons: 1 });
    mouse("mouseReleased", { x: point.x + width, y: point.y + 70 });
    const elements = await poll((elements) => elements.length === count, "rectangle creation");
    return elements.findLast((e) => e.type === "rectangle").id;
  }
  for (const mode of ["parsed", "raw"]) for (const bound of [true, false]) for (const input of ["keyboard", "button"]) {
    const label = `${mode}/${bound ? "bound" : "standalone"}/${input}`;
    try {
      evaluate(`(${prepareFixture.toString()})(${view},${JSON.stringify(mode)}).then(JSON.stringify)`);
      const r = evaluate(`(()=>{const r=${view}.containerEl.querySelector('canvas.interactive').getBoundingClientRect();return JSON.stringify({x:r.x,y:r.y,width:r.width,height:r.height})})()`);
      assert.ok(r.width > 500 && r.height > 350, "usable drawing geometry");
      const width = Math.min(70, r.width * .09), y = r.y + r.height * .35;
      const points = Array.from({ length: 6 }, (_, i) => ({ x: r.x + r.width * (.06 + i * .15), y }));
      const ids = [];
      for (let i = 0; i < 5; i++) ids.push(await draw(points[i], width, i + 1));
      const a = ids.at(-1);
      if (bound) {
        const center = { x: points[4].x + width / 2, y: y + 35 };
        click(center); click(center, 2);
      } else {
        key("t", "KeyT", 84); click({ x: points[4].x, y: y + 150 });
      }
      await poll((s) => s.editor !== null, "open text editor", state);
      cdp("Input.insertText", { text: "[[link]]" }); key("Escape", "Escape", 27);
      await poll((s) => s.editor === null, "submit text", state);
      const withText = await poll((elements) => elements.length === 6 && elements.some((e) => e.rawText === "[[link]]"), "submitted Markdown source");
      const text = withText.find((e) => e.type === "text");
      assert.equal(text.containerId, bound ? a : null, label + " text ownership");
      ids.push(text.id);
      ids.push(await draw(points[5], width, 7));
      const final = scene();
      const act = async (action, expected, selectionOnly = false) => {
        const ready = await poll((s) => s.controls[action].present && s.controls[action].visible && !s.controls[action].disabled,
          `${label}: ${action} control unavailable`, state);
        snapshots.push({ label, action, expected, selectionOnly, state: ready }); persist();
        if (input === "keyboard") {
          focus(); key("z", "KeyZ", 90, (process.platform === "darwin" ? 4 : 2) | (action === "redo" ? 8 : 0));
        } else {
          const b = ready.controls[action].bounds; click({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
        }
        const expectedIds = ids.slice(0, expected).sort();
        const result = await poll((elements) => JSON.stringify(elements.map((e) => e.id).sort()) === JSON.stringify(expectedIds), `${label}: ${action} to ${expected} elements`);
        await poll((s) => s.history[action + "Depth"] === ready.history[action + "Depth"] - 1,
          `${label}: ${action} consumes exactly one history entry`, state);
        return result;
      };
      const counts = [7];
      let selectionSteps = 0;
      for (let n = 6; n >= 0; n--) {
        const top = state().history.undoEntries?.at(-1);
        if (top && ["added", "removed", "updated"].every((key) => Object.keys(top.elements?.[key] || {}).length === 0)) {
          // Entering a label may capture deselection before the text transaction.
          // Verify this exact entry; never skip unavailable controls or element edits.
          assert.ok(top.appState && Object.keys(top.appState).every((side) =>
            Object.keys(top.appState[side]).every((key) => key === "selectedElementIds")), "selection-only history delta");
          assert.equal(++selectionSteps, 1, "at most one editor-selection entry");
          const beforeSelection = scene();
          await act("undo", n + 1, true);
          assert.deepEqual(scene(), beforeSelection, "selection undo does not alter the drawing");
          counts.push(n + 1);
        }
        await act("undo", n); counts.push(n);
      }
      for (const n of counts.slice(0, -1).reverse()) await act("redo", n);
      assert.deepEqual(scene(), final, label + " full redo restores geometry/link/binding/source state");
      completed.push(label); persist();
    } catch (error) {
      snapshots.push({ label, failure: error.message, state: state(), scene: scene() }); persist(); throw error;
    }
  }
  return { variants: completed, assertions: ["undo B, link text, A and all four earlier shapes to empty", "verify at most one selection-only editor entry", "redo complete scene", "bound/standalone source and links", "raw/parsed and keyboard/toolbar"] };
}
