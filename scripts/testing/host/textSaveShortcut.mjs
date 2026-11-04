/** Native #2941 regression: actual text editing, trusted shortcuts and physical persistence. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInAppTask } from "./inAppTask.mjs";
import { behaviorEnvironment } from "./behaviorEnvironment.mjs";
import { behaviorInputDriver } from "./behaviorMatrix.mjs";
import { completeConsoleErrors } from "./debuggerSession.mjs";
import { settleBrowserDiagnostics, splitWindowErrors } from "./browserDiagnostics.mjs";

export const textSaveShortcutCaseIds = ["main", "popout"].map(context => "native:workflow-text-save-2941:" + context);

export async function runTextSaveShortcutScenario({ cli, drawingPath }) {
  const template = readFileSync(new URL("../../../tests/vault/Drawings/Uncompressed.excalidraw.md", import.meta.url), "utf8");
  const tests = [], consoleErrors = [], windowErrors = [], browserIdle = [];
  for (const id of ["main", "popout"]) {
    const execute = new Function(`return async function(c,path,context,template,modifier){
      const env=await (${behaviorEnvironment.toString()})(c,path,context,template,${completeConsoleErrors.toString()},${settleBrowserDiagnostics.toString()});
      await (${exerciseTextSave.toString()})(c,env,modifier);
      return {tests:c.tests,consoleErrors:c.externalConsoleErrors||[],windowErrors:env.windowErrors,browserIdle:env.browserIdle};
    }`)();
    const result = await runInAppTask({ cli, execute,
      args: [drawingPath, { id, input: "mouse" }, template, process.platform === "darwin" ? 4 : 2],
      timeoutMs: 180000, cleanupMs: 60000, onRequest: behaviorInputDriver(cli),
    }).catch(error => { error.evidence = [...tests, ...(error.evidence || [])]; throw error; });
    tests.push(...result.tests); consoleErrors.push(...result.consoleErrors); windowErrors.push(...result.windowErrors); browserIdle.push(...result.browserIdle);
  }
  assert.equal(consoleErrors.length, 0, "Text save emitted console errors");
  assert.equal(splitWindowErrors(windowErrors).unexpected.length, 0, "Text save emitted window errors");
  assert.ok(browserIdle.every(result => result.status === "passed"), "Text save did not settle");
  return { id: "workflow-text-save-2941", status: "passed", tests, consoleErrors, windowErrors, browserIdle };
}

async function exerciseTextSave(c, env, modifier) {
  const { p, doc, win, check, openDrawing, saveReopen, key, input, geometry } = env;
  const autosave = p.autosaveEnabled;
  p.autosaveEnabled = false;
  c.defer(() => { p.autosaveEnabled = autosave; });
  const exports = [], restorers = [];
  // Exercise the real standalone route without allowing the negative control to
  // open an OS dialog or create a file outside this test's owned vault.
  for (const owner of new Set([win, app.workspace.containerEl.ownerDocument.defaultView])) {
    const descriptor = Object.getOwnPropertyDescriptor(owner, "showSaveFilePicker");
    Object.defineProperty(owner, "showSaveFilePicker", { configurable: true, value: async () => {
      exports.push("picker");
      return { name: "negative-control.excalidraw", kind: "file", createWritable: async () => ({ write: async () => { exports.push("write"); }, close: async () => { exports.push("closed"); } }) };
    } });
    restorers.push(() => descriptor ? Object.defineProperty(owner, "showSaveFilePicker", descriptor) : delete owner.showSaveFilePicker);
    const prototype = owner.HTMLAnchorElement.prototype, click = prototype.click;
    prototype.click = function () {
      if (this.download.endsWith(".excalidraw") && this.href.startsWith("blob:")) { exports.push("download"); return; }
      return click.call(this);
    };
    restorers.push(() => { prototype.click = click; });
  }
  c.defer(() => { for (const restore of restorers.reverse()) restore(); });
  await c.case("native:workflow-text-save-2941:" + geometry().requested.id, ["P02", "P03"], async () => {
    const variants = [];
    for (const mode of ["raw", "parsed"]) for (const bound of [false, true]) {
      let view = await openDrawing("text-save-" + mode + "-" + bound);
      await view.changeTextMode(mode);
      const api = view.excalidrawAPI;
      api.updateScene({ elements: [], appState: { viewModeEnabled: false }, captureUpdate: "NEVER" });
      const ea = p.ea.getAPI(view);
      try {
        ea.addText(0, 0, "Before", bound ? { box: "box" } : undefined);
        await ea.addElementsToView(true, false, true);
      } finally { ea.destroy(); }
      await view.forceSave(true, true);
      const text = api.getSceneElements().find(element => element.type === "text");
      check(text && Boolean(text.containerId) === bound, "Text save fixture binding differs");
      api.history.clear();
      const enter = async () => {
        api.selectElements([api.getSceneElements().find(element => element.id === text.id)]);
        view.containerEl.querySelector(".excalidraw").focus();
        await c.waitFor(() => api.getAppState().selectedElementIds[text.id], "text-save selection");
        await key("Enter", "Enter", 13);
        await c.waitFor(() => doc.activeElement?.matches("textarea.excalidraw-wysiwyg"), "trusted text editor opens");
      };
      await enter();
      await key("a", "KeyA", 65, modifier);
      const source = "After [[Target|label]] " + mode + " " + bound;
      await input("Input.insertText", { text: source });
      await c.waitFor(() => doc.activeElement?.value === source, "pending text source");
      const beforeExports = exports.length;
      await key("s", "KeyS", 83, modifier);
      await c.waitFor(() => !view.containerEl.querySelector("textarea.excalidraw-wysiwyg"), "save submits text editor");
      // Wait for a physical file read, not merely a clean flag or autosave.
      await c.waitFor(async () => {
        c.observations = { ...c.observations, textSave: { mode, bound, exports: [...exports], dirty: view.isDirty() } };
        if (exports.length !== beforeExports) throw Error("Ctrl/Cmd+S invoked standalone Excalidraw save: " + exports.join(","));
        const saved = (await p.ea.getSceneFromFile(view.file)).elements.find(element => element.id === text.id);
        return saved?.rawText === source && !view.isSaveInProgress() && !view.isDirty();
      }, "shortcut forces pending source to the current drawing with autosave disabled");
      check(api.getSceneElements().find(element => element.id === text.id).rawText === source, "text source differs after save");
      view.containerEl.querySelector(".excalidraw").focus();
      await key("z", "KeyZ", 90, modifier);
      await c.waitFor(() => {
        const current = api.getSceneElements().find(element => element.id === text.id);
        c.observations.history = { current: current && { text: current.text, rawText: current.rawText, originalText: current.originalText }, exports: [...exports], editing: api.getAppState().editingTextElement?.id, active: doc.activeElement?.outerHTML.slice(0, 500), undoDisabled: view.containerEl.querySelector('[data-testid="button-undo"]')?.disabled, redoDisabled: view.containerEl.querySelector('[data-testid="button-redo"]')?.disabled };
        return current?.rawText === "Before";
      }, "text save preserves undo");
      await key("z", "KeyZ", 90, modifier | 8);
      await c.waitFor(() => api.getSceneElements().find(element => element.id === text.id)?.rawText === source, "text save preserves redo");
      // Test this separate editor session after the Ctrl+S history assertion;
      // entering it can create its own selection/history checkpoint.
      if (mode === "raw" && !bound) {
        await enter();
        const beforeShift = exports.length;
        await key("s", "KeyS", 83, modifier | 8);
        await c.waitFor(() => exports.length > beforeShift && exports.at(-1) === "closed" && !view.containerEl.querySelector("textarea.excalidraw-wysiwyg"), "Shift+S retains its standalone save route");
      }
      await key("s", "KeyS", 83, modifier);
      await c.waitFor(async () => !view.isDirty() && !view.isSaveInProgress() &&
        (await p.ea.getSceneFromFile(view.file)).elements.find(element => element.id === text.id)?.rawText === source, "canvas save persists redo");
      view = await saveReopen(view);
      const restored = view.excalidrawAPI.getSceneElements().find(element => element.id === text.id);
      check(restored?.rawText === source && Boolean(restored.containerId) === bound, "saved text/binding lost on reopen");
      variants.push({ mode, bound, forcedDiskWrite: true, undoRedo: true, reopened: true });
    }
    return { assertions: ["trusted Ctrl/Cmd+S submits pending raw/parsed and bound/plain text", "forced physical write with autosave disabled", "no standalone dialog or download", "Shift+S retains its standalone save route", "undo/redo and canvas save", "source and binding survive reopen"], variants };
  });
}
