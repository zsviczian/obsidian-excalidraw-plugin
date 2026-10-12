/** #2970: real CodeMirror input in a main window and an owned Electron popout. */
import assert from "node:assert/strict";

const CONTROL = "__excalidrawLatexInput";

async function setup(control, drawingPath, realRenderer) {
  if (globalThis[control]) throw Error("LaTeX controller already exists");
  const plugin = app.plugins.plugins["obsidian-excalidraw-plugin"];
  const leaf = app.workspace.getLeavesOfType("excalidraw").find(l => l.view.file?.path === drawingPath);
  if (!leaf?.view.excalidrawAPI) throw Error("owned drawing missing");
  if (document.querySelector(".excalidraw-LatexPrompt .cm-editor")) throw Error("close the existing LaTeX dialog first");
  const gateway = plugin.extrasGateway;
  const c = { plugin, leaf, current: leaf, previous: app.workspace.activeLeaf,
    original: gateway.getMathJax, hadOwn: Object.hasOwn(gateway, "getMathJax"), realRenderer, state: "pending" };
  globalThis[control] = c;
  if (realRenderer) {
    const extras = app.plugins.plugins["excalidraw-extras"];
    if (!extras?.settings.enableMathJaxToSVG) throw Error("Enable Extras MathJax-to-SVG in excalidraw-test before --latex-preview");
    if (!app.plugins.plugins["obsidian-latex-suite"]?.settings.mathPreviewEnabled) throw Error("Enable Latex Suite math previews in excalidraw-test before --latex-preview");
  }
  // Exercise the actual prompt and formula persistence without installing Extras,
  // requesting activation, or claiming to test MathJax's rendering engine.
  if (!realRenderer) gateway.getMathJax = async () => ({ tex2dataURL: async tex => {
    const safe = tex.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="30"><text x="0" y="20">${safe}</text></svg>`;
    const bytes = new TextEncoder().encode(tex);
    const digest = await crypto.subtle.digest("SHA-1", bytes);
    return { mimeType: "image/svg+xml", fileId: Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join(""),
      dataURL: "data:image/svg+xml;base64," + btoa(svg), created: Date.now(), size: { width: 120, height: 30 } };
  } });
  const ea = new plugin.ea.constructor(plugin, leaf.view);
  try {
    c.elementId = await ea.addLaTex(0, 0, "abcdef");
    if (!c.elementId || !await ea.addElementsToView(false, true)) throw Error("could not create formula fixture");
  } finally { ea.destroy(); }
}

function editor(control) {
  const c = globalThis[control];
  const doc = c.current.view.ownerDocument ?? c.current.view.containerEl.ownerDocument;
  const content = doc.querySelector(".excalidraw-LatexPrompt .cm-content");
  // Obsidian supplies CodeMirror externally. Its current release uses cmTile;
  // older supported releases expose cmView. This introspection is test-only.
  return { c, doc, content, view: content?.cmTile?.view ?? content?.cmView?.rootView?.view };
}

function snapshot(control) {
  const { c, doc, content, view } = editor(control);
  const selection = doc.getSelection();
  const e = c.current.view.getViewElements?.().find(e => e.id === c.elementId);
  const tooltip = content?.closest(".cm-editor").querySelector(".cm-tooltip-cursor");
  const rect = tooltip?.getBoundingClientRect();
  return { state: c.state, error: c.error, modal: !!content, rootMatches: view?.root === doc,
    focused: view?.hasFocus, text: view?.state.doc.toString(), anchor: view?.state.selection.main.anchor,
    head: view?.state.selection.main.head, nativeHead: selection?.focusOffset,
    nativeInEditor: !!content && content.contains(selection?.focusNode), destroyed: c.retired?.destroyed,
    popout: doc !== app.workspace.containerEl.ownerDocument,
    formula: e && c.current.view.excalidrawData.getEquation(e.fileId)?.latex,
    dirty: c.current.view.isDirty?.(), tool: c.current.view.excalidrawAPI?.getAppState().activeTool.type,
    preview: { exists: !!tooltip, visible: !!rect && rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= doc.defaultView.innerHeight,
      rendered: !!tooltip?.querySelector("mjx-container, math, .katex"),
      error: tooltip?.querySelector(".temml-error, .katex-error, mjx-merror, merror")?.textContent } };
}

async function open(control) {
  const c = globalThis[control];
  app.workspace.setActiveLeaf(c.current, { focus: true });
  await c.current.view.openLaTeXEditor(c.elementId);
}

function cancel(control) {
  const { c, content, view } = editor(control);
  c.retired = view;
  content?.closest(".excalidraw-LatexPrompt").querySelector("button:not(.mod-cta)")?.click();
  return { closed: true };
}

async function popout(control, migrate) {
  const c = globalThis[control];
  if (migrate) {
    app.workspace.moveLeafToPopout(c.leaf);
    c.pop = c.leaf;
  } else {
    c.pop = app.workspace.openPopoutLeaf();
    await c.pop.setViewState({ type: "excalidraw", state: { file: c.leaf.view.file.path } });
  }
  c.current = c.pop;
}

async function saveAndReopen(control) {
  const c = globalThis[control];
  const path = c.current.view.file.path;
  await c.current.view.forceSave(true, true);
  if (c.current.view.isDirty()) throw Error("formula remained dirty after save");
  await c.current.setViewState({ type: "empty", state: {} });
  await c.current.setViewState({ type: "excalidraw", state: { file: path } });
}

async function cleanup(control) {
  const c = globalThis[control];
  if (!c) return;
  const gateway = c.plugin.extrasGateway;
  if (!c.realRenderer) {
    if (c.hadOwn) gateway.getMathJax = c.original;
    else delete gateway.getMathJax;
  }
  cancel(control);
  if (c.pop) { await c.pop.setViewState({ type: "empty", state: {} }); c.pop.detach(); }
  if (c.previous && c.previous !== c.pop) app.workspace.setActiveLeaf(c.previous, { focus: true });
  delete globalThis[control];
}

/** The guarded runner owns deployment/drawing cleanup; this scenario owns dialogs,
 * temporary gateway replacement, popouts, CDP sessions and controller cleanup.
 * All evaluated functions are trusted local source; arguments use JSON literals.
 * CLI eval accepts raw JavaScript, not HTML, so HTML script escaping is inapplicable.
 */
export async function runLatexInputScenario({ cli, drawingPath, realRenderer = false }) {
  const evaluate = code => JSON.parse(cli("eval", `code=${code}`).trim().replace(/^=>\s*/, ""));
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  // Browser functions referencing these helpers need their local definitions.
  const definitions = `${editor.toString()};${cancel.toString()};`;
  const invoke = (fn, ...args) => evaluate(`(()=>{${definitions}return JSON.stringify((${fn.toString()})(${[CONTROL, ...args].map(v => JSON.stringify(v)).join(",")}))})()`);
  const current = () => invoke(snapshot);
  async function poll(test, label) {
    for (let i = 0; i < 100; i++) {
      const value = current();
      if (value.error) throw Error(value.error);
      if (test(value)) return value;
      await wait(100);
    }
    throw Error(`${label}: ${JSON.stringify(current())}`);
  }
  async function act(fn, ...args) {
    evaluate(`(()=>{${definitions}const c=globalThis.${CONTROL};c.state="pending";c.error=null;Promise.resolve((${fn.toString()})(${[CONTROL, ...args].map(v => JSON.stringify(v)).join(",")})).then(()=>c.state="done").catch(e=>{c.error=e.stack||String(e);c.state="failed"});return JSON.stringify({started:true})})()`);
    await poll(v => v.state === "done", fn.name);
  }
  const cdp = (method, params = {}) => JSON.parse(cli("dev:cdp", `method=${method}`, `params=${JSON.stringify(params)}`));
  let session, request = 0;
  const input = (method, params) => session ? cdp("Target.sendMessageToTarget", {
    sessionId: session, message: JSON.stringify({ id: ++request, method, params }),
  }) : cdp(method, params);
  const modifier = process.platform === "darwin" ? 4 : 2;
  function key(key, code, keyCode, modifiers = 0) {
    for (const type of ["keyDown", "keyUp"]) input("Input.dispatchKeyEvent", { type, key, code, windowsVirtualKeyCode: keyCode, modifiers });
  }
  const cases = [];
  invoke(control => {
    if (globalThis[control]) throw Error("LaTeX controller already exists");
    if (document.querySelector(".excalidraw-LatexPrompt .cm-editor")) throw Error("close the existing LaTeX dialog first");
    return { ready: true };
  });
  try {
    // setup must install its controller before starting async fixture work.
    evaluate(`(()=>{Promise.resolve((${setup.toString()})(${JSON.stringify(CONTROL)},${JSON.stringify(drawingPath)},${JSON.stringify(realRenderer)})).then(()=>globalThis.${CONTROL}.state="done").catch(e=>{const c=globalThis.${CONTROL};if(c){c.error=e.stack;c.state="failed"}else throw e});return JSON.stringify({started:true})})()`);
    await poll(v => v.state === "done", "setup");
    for (const mode of ["main", "direct-popout", "moved-popout"]) {
      if (mode !== "main") {
        const before = new Set(cdp("Target.getTargets").targetInfos.map(t => t.targetId));
        await act(popout, mode === "moved-popout");
        await poll(v => v.popout && v.formula, "popout ready");
        const candidates = cdp("Target.getTargets").targetInfos.filter(t => t.type === "page" && !before.has(t.targetId));
        assert.equal(candidates.length, 1, "exactly one owned popout target");
        session = cdp("Target.attachToTarget", { targetId: candidates[0].targetId, flatten: false }).sessionId;
      }
      await act(open);
      const opened = await poll(v => v.modal, "editor opened");
      assert.ok(opened.rootMatches, `${mode}: CodeMirror root belongs to mounted document`);
      assert.equal(opened.text, "abcdef", `${mode}: source after reopen`);
      key("a", "KeyA", 65, modifier);
      input("Input.insertText", { text: "abcdef" });
      await poll(v => v.text === "abcdef" && v.head === 6, "text entry");
      key("ArrowLeft", "ArrowLeft", 37);
      await poll(v => v.head === 5 && v.nativeInEditor && v.nativeHead === 5, "arrow/native caret");
      if (realRenderer) {
        const { preview } = await poll(v => v.preview.exists, "Latex Suite preview");
        assert.ok(preview.visible, `${mode}: Latex Suite preview is inside its owning window`);
        assert.ok(!preview.error, `${mode}: Latex Suite preview renderer error: ${preview.error}. Obsidian 1.14.0 Temml rejects Latex Suite's \\class markers; update Obsidian to 1.14.1 or newer, or clear Latex Suite Cursor symbol and disable bracket highlighting.`);
        assert.ok(preview.rendered, `${mode}: preview contains rendered math`);
      }
      key("Backspace", "Backspace", 8);
      await poll(v => v.text === "abcdf" && v.head === 4, "backspace");
      key("z", "KeyZ", 90, modifier);
      await poll(v => v.text === "abcdef", "undo");
      // Place the cursor using the editor's actual layout and native mouse input.
      const point = invoke(control => {
        const { view } = editor(control);
        const rect = view.coordsAtPos(2);
        return { x: rect.left, y: (rect.top + rect.bottom) / 2 };
      });
      for (const type of ["mousePressed", "mouseReleased"]) input("Input.dispatchMouseEvent", { type, ...point, button: "left", clickCount: 1 });
      await poll(v => v.head === 2 && v.nativeHead === 2, "click placement");
      key("ArrowRight", "ArrowRight", 39, 8);
      await poll(v => v.anchor === 2 && v.head === 3, "shift selection");
      input("Input.insertText", { text: "X" });
      await poll(v => v.text === "abXdef", "selection replacement");
      assert.equal(current().tool, opened.tool, `${mode}: typing does not activate canvas tools`);
      key("Enter", "Enter", 13, modifier);
      await poll(v => !v.modal && v.formula === "abXdef", "Mod-Enter submission");
      await act(saveAndReopen);
      await poll(v => v.formula === "abXdef", "saved source");
      await act(open);
      await poll(v => v.modal && v.text === "abXdef", "reopen submitted source");
      key("a", "KeyA", 65, modifier);
      input("Input.insertText", { text: "cancelled" });
      await poll(v => v.text === "cancelled", "cancelled edit");
      invoke(cancel);
      await poll(v => !v.modal && v.destroyed && v.formula === "abXdef", "cancel and editor destruction");
      // Restore fixture text for the next independent window case.
      await act(open);
      await poll(v => v.modal, "restore editor");
      key("a", "KeyA", 65, modifier); input("Input.insertText", { text: "abcdef" });
      await poll(v => v.text === "abcdef", "restore text");
      key("Enter", "Enter", 13, modifier);
      await poll(v => !v.modal && v.formula === "abcdef", "restore source");
      await act(saveAndReopen);
      await poll(v => v.formula === "abcdef", "restore saved source");
      cases.push(mode);
      if (session) {
        cdp("Target.detachFromTarget", { sessionId: session }); session = undefined;
        await act(async control => { const c = globalThis[control]; await c.pop.setViewState({ type: "empty", state: {} }); c.pop.detach(); c.pop = null; c.current = c.leaf; });
      }
    }
    return { id: realRenderer ? "latex-preview-2970" : "latex-input-2970", status: "passed", cases,
      renderer: realRenderer ? "real Extras MathJax and Latex Suite preview" : "local SVG stub; MathJax/Extras not tested",
      assertions: ["mounted CodeMirror root", "native clicks/arrows/backspace", "selection replacement/undo", "Mod-Enter/save/reopen", "cancel/destroy",
        ...(realRenderer ? ["visible Latex Suite preview", "preview contains rendered math without errors"] : [])] };
  } finally {
    let detachError;
    try { if (session) cdp("Target.detachFromTarget", { sessionId: session }); }
    catch (error) { detachError = error; }
    evaluate(`(()=>{${definitions}Promise.resolve((${cleanup.toString()})(${JSON.stringify(CONTROL)})).catch(e=>{globalThis.${CONTROL}.cleanupError=e.stack});return JSON.stringify({started:true})})()`);
    for (let i = 0; i < 100; i++) {
      const value = evaluate(`JSON.stringify({exists:!!globalThis.${CONTROL},error:globalThis.${CONTROL}?.cleanupError})`);
      if (!value.exists) break;
      if (value.error) throw Error(value.error);
      if (i === 99) throw Error("LaTeX cleanup timed out");
      await wait(100);
    }
    if (detachError) throw detachError;
  }
}
