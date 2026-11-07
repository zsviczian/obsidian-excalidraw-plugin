/** #3036: trusted input against real Markdown widgets, exact source and history. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInAppTask } from "./inAppTask.mjs";
import { behaviorEnvironment } from "./behaviorEnvironment.mjs";
import { behaviorInputDriver } from "./behaviorMatrix.mjs";
import { completeConsoleErrors } from "./debuggerSession.mjs";
import { settleBrowserDiagnostics, splitWindowErrors } from "./browserDiagnostics.mjs";

const casesFor = ids => ids.flatMap(id => [...["PNG", "SVGIMG", "SVG"].map(mode => `native:embed-controls:${id}:${mode}`), `native:embed-ownership:${id}`, `native:embed-table:${id}`, `native:embed-hybrid:${id}`]);
export const embedControlCaseIds = casesFor(["main", "split", "popout"]);
export const embedControlDeviceCaseIds = casesFor(["phone", "tablet"]);

export async function runEmbedControlsScenario({ cli, drawingPath, contexts = ["main", "split", "popout"], inputMode = "mouse", viewportScale = 1 }) {
  const template = readFileSync(new URL("../../../tests/vault/Drawings/Uncompressed.excalidraw.md", import.meta.url), "utf8");
  const tests = [], consoleErrors = [], windowErrors = [], browserIdle = [];
  for (const id of contexts) {
    const execute = new Function(`return async function(c,path,context,template,modifier){
      const env=await (${behaviorEnvironment.toString()})(c,path,context,template,${completeConsoleErrors.toString()},${settleBrowserDiagnostics.toString()});
      const runCase=c.case.bind(c);c.case=async (...args)=>{c.phase=args[0];return runCase(...args);};
      try {await (${exerciseEmbedControls.toString()})(c,env,template,modifier);}
      catch(error){c.observations={...c.observations,diagnostics:env.diagnostics()};throw error;}
      return {tests:c.tests,consoleErrors:c.externalConsoleErrors||[],windowErrors:env.windowErrors,browserIdle:env.browserIdle};
    }`)();
    const result = await runInAppTask({ cli, execute, args: [drawingPath, { id, input: inputMode }, template, process.platform === "darwin" ? 4 : 2],
      timeoutMs: 480000, cleanupMs: 60000, onRequest: behaviorInputDriver(cli, viewportScale),
      onProgress: phase => { if (phase) process.stdout.write("Embed controls: " + phase + "\n"); },
    }).catch(error => { error.evidence = [...tests, ...(error.evidence || [])]; throw error; });
    tests.push(...result.tests); consoleErrors.push(...result.consoleErrors); windowErrors.push(...result.windowErrors); browserIdle.push(...result.browserIdle);
  }
  assert.equal(consoleErrors.length, 0, "Embed controls emitted console errors");
  assert.equal(splitWindowErrors(windowErrors).unexpected.length, 0, "Embed controls emitted window errors");
  assert.ok(browserIdle.every(item => item.status === "passed"), "Embed controls did not settle");
  return { id: "drawing-embed-controls-3036", status: "passed", tests, consoleErrors, windowErrors, browserIdle };
}

async function exerciseEmbedControls(c, env, template, modifier) {
  const { p, leaf, doc, win, create, check, click, key, input, geometry } = env;
  const context = geometry().requested.id, touch = geometry().requested.input === "touch";
  const browserWindow = win.require("@electron/remote").getCurrentWindow();
  const wasMinimized = browserWindow.isMinimized();
  if (wasMinimized) browserWindow.restore();
  browserWindow.show(); browserWindow.focus();
  if (wasMinimized) c.defer(() => { if (!browserWindow.isDestroyed()) browserWindow.minimize(); });
  const mainWindow = context === "popout" ? app.workspace.containerEl.ownerDocument.defaultView.require("@electron/remote").getCurrentWindow() : null;
  const mainWasMinimized = mainWindow?.isMinimized();
  if (mainWindow && !mainWasMinimized) c.defer(() => { if (!mainWindow.isDestroyed()) mainWindow.restore(); });
  const drawing = await create("Controls.excalidraw.md", template);
  await c.waitFor(() => p.isExcalidrawFile(drawing), "embed drawing metadata");
  const drawingBytes = await app.vault.read(drawing);
  const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII="), char => char.charCodeAt(0));
  const plain = await app.vault.createBinary(env.prefix + "/ordinary.png", png.buffer);
  const token = `![[${drawing.path}|180]]`;
  const markdown = `![Caption|200](${drawing.path}#^as-image "Keep title")`;
  const content = `# Controls\n\n${token}\n\n${token}\n\n${markdown}\n\n![[${plain.path}|40]]\n\nFooter\n`;
  const note = await create("Controls.md", content);
  const open = async (mode = "source", file = note) => {
    await leaf.setViewState({ type: "markdown", state: { file: file.path, mode, source: false } });
    app.workspace.setActiveLeaf(leaf, { focus: true }); win.focus();
    if (mode === "source") leaf.view.editor.setCursor({ line: leaf.view.editor.lastLine(), ch: 0 });
    await c.waitFor(() => activeRoot()?.querySelectorAll(".excalidraw-embed-toolbar").length === 3, "three active owned embed toolbars");
    await c.waitFor(() => frames().every(frame => {
      const image = frame.querySelector(".excalidraw-embedded-img");
      return image?.getBoundingClientRect().height > 0 && (image.tagName !== "IMG" || image.complete && image.naturalWidth > 0);
    }), "decoded drawing previews with positive dimensions");
  };
  const activeRoot = () => leaf.view.contentEl.querySelector(leaf.view.getMode?.() === "preview" ? ".markdown-preview-view" : ".markdown-source-view");
  const frames = () => [...activeRoot()?.querySelectorAll(".excalidraw-embed-controls-frame") || []];
  const action = async (index, name) => {
    const frame = frames()[index];
    check(frame, "missing embed frame " + index); frame.scrollIntoView({ block: "center" });
    let rect, signature, stableSince;
    await c.waitFor(() => {
      rect = frames()[index]?.getBoundingClientRect();
      if (!rect?.height) return false;
      const current = [rect.x, rect.y, rect.width, rect.height].map(value => Math.round(value * 10)).join(":");
      if (signature !== current) { signature = current; stableSince = Date.now(); }
      return Date.now() - stableSince >= 120;
    }, "embed scroll settled before hover");
    if (!touch) await input("Input.dispatchMouseEvent", { type: "mouseMoved", x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
    await click(() => frames()[index]?.querySelector(`[data-excalidraw-embed-action="${name}"]`));
  };
  const drag = async (index, delta, cancel = false, expectedSource = content) => {
    let frame = frames()[index], handle = frame.querySelector('[data-excalidraw-embed-action="resize"]');
    handle.focus(); handle.scrollIntoView({ block: "center" });
    let r, x, y, signature, stableSince, scrollAttempts = 0;
    await c.waitFor(() => {
      const nextFrame = frames()[index], next = nextFrame?.querySelector('[data-excalidraw-embed-action="resize"]');
      if (!next) return false;
      if (next !== handle) { frame = nextFrame; handle = next; handle.focus(); handle.scrollIntoView({ block: "center" }); }
      r = handle.getBoundingClientRect(); x = r.x + r.width / 2; y = r.y + r.height / 2;
      const scroller = leaf.view.editor.cm.scrollDOM.getBoundingClientRect();
      c.observations = { ...c.observations, dragPreparation: {
        handle: r.toJSON(), frame: frame.getBoundingClientRect().toJSON(),
        image: frame.querySelector(".excalidraw-embedded-img")?.getBoundingClientRect().toJSON(),
        hit: doc.elementFromPoint(x, y)?.outerHTML.slice(0, 500),
        focus: doc.activeElement?.outerHTML.slice(0, 300),
        scroller: scroller.toJSON(), scrollTop: leaf.view.editor.cm.scrollDOM.scrollTop, scrollAttempts,
      } };
      if (!handle.contains(doc.elementFromPoint(x, y))) {
        // CodeMirror can apply its pending caret scroll after focus/scrollIntoView
        // and image measurement. Reposition an offscreen target, then still
        // require a stable real hit; never scroll to bypass an obscuring overlay.
        if (scrollAttempts < 3 && (x < scroller.left || x >= scroller.right || y < scroller.top || y >= scroller.bottom)) {
          scrollAttempts++; handle.scrollIntoView({ block: "center", inline: "nearest" });
        }
        signature = null; return false;
      }
      const current = [r.x, r.y, r.width, r.height].map(value => Math.round(value * 10)).join(":");
      if (signature !== current) { signature = current; stableSince = Date.now(); }
      return Date.now() - stableSince >= 120;
    }, "stable uncovered resize handle");
    const image = frame.querySelector(".excalidraw-embedded-img"), visual = image.querySelector("svg") ?? image;
    const initial = visual.getBoundingClientRect();
    const events = [], eventNames = ["pointerdown", "pointermove", "pointerup", "pointercancel", "touchstart", "touchmove", "blur", "lostpointercapture"];
    const observe = event => events.push({ type: event.type, target: event.target.className, trusted: event.isTrusted, x: event.clientX, y: event.clientY, prevented: event.defaultPrevented, cancelable: event.cancelable });
    for (const name of eventNames) win.addEventListener(name, observe, true);
    c.defer(() => { for (const name of eventNames) win.removeEventListener(name, observe, true); });
    c.observations = { ...c.observations, drag: { handle: handle.outerHTML, bounds: r.toJSON(), image: frame.querySelector(".excalidraw-embedded-img").getBoundingClientRect().toJSON(), hit: doc.elementFromPoint(x, y)?.outerHTML.slice(0, 500), events } };
    const touchRules = [];
    const inspectRules = rules => { for (const rule of rules) {
      if (rule.style?.touchAction && rule.selectorText && handle.matches(rule.selectorText)) touchRules.push({ selector: rule.selectorText, value: rule.style.touchAction, priority: rule.style.getPropertyPriority("touch-action") });
      if (rule.cssRules) inspectRules(rule.cssRules);
    } };
    for (const sheet of doc.styleSheets) { try { inspectRules(sheet.cssRules); } catch { /* Cross-origin sheets cannot be inspected. */ } }
    c.observations.drag.touchRules = touchRules;
    const send = (phase, point) => touch ? input("Input.dispatchTouchEvent", { type: phase === "down" ? "touchStart" : phase === "move" ? "touchMove" : "touchEnd", touchPoints: phase === "up" ? [] : [{ x: point, y, id: 1 }] })
      : input("Input.dispatchMouseEvent", { type: phase === "down" ? "mousePressed" : phase === "move" ? "mouseMoved" : "mouseReleased", x: point, y, button: "left", buttons: phase === "up" ? 0 : 1, clickCount: 1 });
    try {
      const states = c.observations.drag.states = [];
      const snapshot = () => states.push({ connected: frame.isConnected, current: frame === frames()[index], classes: frame.className, handleAction: win.getComputedStyle(handle).touchAction, selection: leaf.view.editor.cm.state.selection.main.toJSON() });
      await send("down", x); snapshot(); await send("move", x + delta / 2); snapshot(); await send("move", x + delta); snapshot();
      check(leaf.view.editor.getValue() === expectedSource, "pointer movement wrote source before commit");
      check(frame.hasClass("excalidraw-embed-resizing"), "real pointer did not start CSS resize preview");
      const preview = visual.getBoundingClientRect();
      check(Math.abs(preview.width - initial.width - delta) < 1 && Math.abs(preview.height - preview.width * initial.height / initial.width) < 1, "resize preview geometry lost its requested size or aspect ratio");
      if (cancel) await key("Escape", "Escape", 27);
    } finally { await send("up", x + delta); }
    return initial.width + delta;
  };
  for (const mode of ["PNG", "SVGIMG", "SVG"]) await c.case(`native:embed-controls:${context}:${mode}`, ["P02", "P05"], async () => {
    p.settings.previewImageType = mode;
    await open();
    if (mainWindow) { mainWindow.minimize(); browserWindow.focus(); check(mainWindow.isMinimized(), "main window was not minimized for popout input"); }
    if (touch) {
      const frame = frames()[0], image = frame.querySelector(".excalidraw-embedded-img").getBoundingClientRect(), toolbar = frame.querySelector(".excalidraw-embed-toolbar").getBoundingClientRect();
      check(toolbar.top >= image.bottom && toolbar.bottom <= frame.getBoundingClientRect().bottom + 1, "touch toolbar overlaps image or following note content");
    }
    let cm = leaf.view.editor.cm;
    const changed = content.replace(token + "\n\n" + token, token + "\n\n" + token.replace("|180", "|220"));
    await drag(1, 40);
    c.phase = `native:embed-controls:${context}:${mode}:history`;
    await c.waitFor(() => cm.state.doc.toString() === changed, "only second repeated embed resized");
    cm.focus(); await key("z", "KeyZ", 90, modifier);
    await c.waitFor(() => cm.state.doc.toString() === content, "single undo restores exact original source");
    await key("z", "KeyZ", 90, modifier | 8);
    await c.waitFor(() => cm.state.doc.toString() === changed, "single redo restores exact resized source");
    await c.waitFor(() => frames().length === 3 && frames()[1].querySelector('[data-excalidraw-embed-action="reset"]'), "resized controls remounted once");
    await action(1, "reset");
    await c.waitFor(() => cm.state.doc.toString() === content.replace(token + "\n\n" + token, token + "\n\n" + `![[${drawing.path}]]`), "reset removes only explicit dimensions");
    cm.focus(); await key("z", "KeyZ", 90, modifier);
    await c.waitFor(() => cm.state.doc.toString() === changed, "reset is one undo step");
    await key("z", "KeyZ", 90, modifier);
    await c.waitFor(() => cm.state.doc.toString() === content, "original size restored");
    await c.waitFor(() => frames().length === 3, "restored embeds");
    await drag(1, 35, true);
    check(cm.state.doc.toString() === content && !frames()[1].hasClass("excalidraw-embed-resizing"), "Escape committed or retained preview");
    const cancelledFrame = frames()[1], cancelledImage = cancelledFrame.querySelector(".excalidraw-embedded-img");
    const imageCorner = (cancelledImage.querySelector("svg") ?? cancelledImage).getBoundingClientRect(), handleCorner = cancelledFrame.querySelector('[data-excalidraw-embed-action="resize"]').getBoundingClientRect();
    check(Math.abs(handleCorner.right - imageCorner.right + 2) < 2 && Math.abs(handleCorner.bottom - imageCorner.bottom + 2) < 2, "cancel left the resize handle away from the visible inside corner");
    frames()[1].querySelector('[data-excalidraw-embed-action="resize"]').focus();
    await key("ArrowRight", "ArrowRight", 39);
    await c.waitFor(() => cm.state.doc.toString() === content.replace(token + "\n\n" + token, token + "\n\n" + token.replace("|180", "|188")), "keyboard resize commits on key release");
    cm.focus(); await key("z", "KeyZ", 90, modifier);
    await c.waitFor(() => cm.state.doc.toString() === content && frames().length === 3, "keyboard resize is one undo step");
    await action(2, "edit");
    check(cm.state.sliceDoc(cm.state.selection.main.from, cm.state.selection.main.to) === markdown, "edit source selected the wrong token");
    check(cm.state.doc.toString() === content, "edit source rewrote Markdown");
    leaf.view.editor.setCursor({ line: leaf.view.editor.lastLine(), ch: 0 });
    await c.waitFor(() => frames().length === 3, "source-edit rendering roundtrip");
    const inline = frames()[0].querySelector(".excalidraw-embedded-img");
    await action(0, "preview");
    c.phase = `native:embed-controls:${context}:${mode}:fullscreen`;
    let modal, stage;
    await c.waitFor(() => (modal = doc.querySelector(".excalidraw-embed-preview-modal")) && (stage = modal.querySelector(".excalidraw-embed-preview-stage")) && modal.querySelector(".excalidraw-embedded-img"), "fresh fullscreen payload");
    check(modal.querySelector("[fileSource]")?.getAttribute("fileSource") === drawing.path, "fullscreen changed drawing identity");
    const keys = [], recordKey = event => keys.push({ key: event.key, code: event.code, target: event.target.className, trusted: event.isTrusted });
    doc.addEventListener("keydown", recordKey, true); c.defer(() => doc.removeEventListener("keydown", recordKey, true));
    c.observations = { ...c.observations, fullscreen: { focus: doc.activeElement?.outerHTML.slice(0, 500), connected: modal.isConnected, keys } };
    await key("+", "Equal", 187, 8);
    c.observations.fullscreen.zoom = stage.getAttribute("data-zoom");
    c.observations.fullscreen.stageConnected = stage.isConnected;
    check(Number(stage.getAttribute("data-zoom")) > 1, "fullscreen keyboard zoom failed");
    await key("ArrowRight", "ArrowRight", 39);
    check(modal.querySelector(".excalidraw-embed-preview-surface").style.transform.includes("-24px"), "fullscreen keyboard pan failed");
    await key("0", "Digit0", 48);
    check(Number(stage.getAttribute("data-zoom")) === 1, "fullscreen fit failed");
    if (touch) {
      const r = stage.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      const points = distance => [{ x: x - distance, y, id: 1 }, { x: x + distance, y, id: 2 }];
      try {
        await input("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: points(20) });
        await input("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: points(40) });
        check(Number(stage.getAttribute("data-zoom")) > 1.25, "fullscreen trusted pinch failed");
      } finally { await input("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); }
      await key("0", "Digit0", 48);
      try {
        await input("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
        await input("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + 20, y: y + 12, id: 1 }] });
        check(modal.querySelector(".excalidraw-embed-preview-surface").style.transform.includes("20px, 12px"), "fullscreen trusted touch pan failed");
      } finally { await input("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); }
      await key("0", "Digit0", 48);
    }
    await key("Escape", "Escape", 27);
    await c.waitFor(() => !modal.isConnected, "fullscreen closes on Escape");
    doc.removeEventListener("keydown", recordKey, true);
    check(doc.activeElement?.getAttribute("data-excalidraw-embed-action") === "preview", "fullscreen did not restore opener focus");
    check(inline.isConnected && (mode === "SVG" ? !!inline.querySelector("svg") : inline.complete && inline.naturalWidth > 0), "closing fullscreen invalidated inline payload");
    check(!leaf.view.contentEl.querySelector(`.internal-embed[src="${plain.path}"] [data-excalidraw-embed-action]`), "ordinary image acquired drawing controls");
    await open("preview");
    check(!activeRoot().querySelector('[data-excalidraw-embed-action="resize"], [data-excalidraw-embed-action="edit"], [data-excalidraw-embed-action="reset"]'), "Reading mode acquired source mutation controls");
    check(!leaf.view.contentEl.querySelector('.markdown-source-view [data-excalidraw-embed-action="resize"]'), "hidden source retained editable controls after mode switch");
    await action(2, "preview");
    await c.waitFor(() => doc.querySelector(".excalidraw-embed-preview-modal [fileSource]")?.getAttribute("fileSource") === drawing.path + "#^as-image", "Reading fullscreen preserves reference");
    await key("Escape", "Escape", 27);
    await action(0, "open");
    await c.waitFor(() => leaf.view.excalidrawAPI && leaf.view.file === drawing, "explicit Open drawing navigates to editor");
    check(await app.vault.read(drawing) === drawingBytes, "embed actions changed drawing source");
    // Retiring the source owner removes every control and cancels its dialogs.
    check(!doc.querySelector(".excalidraw-embed-preview-modal"), "retired source left fullscreen modal");
    return { assertions: ["trusted proportional resize previews without source writes", "only second identical token changed", "one-step undo/redo and reset", "Escape cancellation", "exact Markdown-image syntax selection and roundtrip", "fresh fullscreen zoom/pan/fit/Escape/focus", "inline payload survives modal cleanup", "Reading controls cannot write", "ordinary image unchanged", "Open drawing and drawing bytes unchanged"], actual: geometry() };
  });

  await c.case(`native:embed-ownership:${context}`, ["P03", "P04", "P05"], async () => {
    const small = `![[${drawing.path}|100]]`;
    const source = `# Source A\n\n${small} ${small}\n\n\`${small}\`\n\n\`\`\`md\n${small}\n\`\`\`\n\nFooter\n`;
    const sourceB = "# Source B\n\n" + small + "\n\nFooter\n";
    const a = await create("Ownership-A.md", source), b = await create("Ownership-B.md", sourceB);
    await leaf.setViewState({ type: "markdown", state: { file: a.path, mode: "source", source: false } });
    leaf.view.editor.setCursor({ line: leaf.view.editor.lastLine(), ch: 0 });
    await c.waitFor(() => frames().length === 2, "two same-line embeds; code examples have no controls");
    const cm = leaf.view.editor.cm;
    let other;
    if (!touch) {
      app.workspace.setActiveLeaf(leaf, { focus: true });
      other = app.workspace.getLeaf("split", "vertical"); env.owned.add(other);
      await other.setViewState({ type: "markdown", state: { file: b.path, mode: "source", source: false } });
      check(other.parent !== leaf.parent, "ownership test needs independent visible panes");
      app.workspace.setActiveLeaf(other, { focus: true });
    }
    const target = frames()[1].querySelector('[data-excalidraw-embed-action="resize"]');
    target.focus(); await key("ArrowRight", "ArrowRight", 39);
    const expected = source.replace(small + " " + small, small + " " + small.replace("|100", "|108"));
    await c.waitFor(() => cm.state.doc.toString() === expected, "only second same-line token changed");
    check(!other || other.view.editor.getValue() === sourceB, "another pane's note was edited");
    check(await app.vault.read(b) === sourceB, "other note's persisted source changed");
    cm.focus(); await key("z", "KeyZ", 90, modifier);
    await c.waitFor(() => cm.state.doc.toString() === source && frames().length === 2, "same-line undo restores source");
    const oldFrame = frames()[0], oldImage = oldFrame.querySelector(".excalidraw-embedded-img");
    oldImage.dispatchEvent(new win.CustomEvent("excalidraw-embed-rerender"));
    await c.waitFor(() => oldFrame.querySelector(".excalidraw-embedded-img") !== oldImage && frames().length === 2, "refresh preserves exactly one control set per embed");
    await action(0, "preview");
    await c.waitFor(() => doc.querySelector(".excalidraw-embed-preview-modal"), "ownership fullscreen opened");
    await leaf.setViewState({ type: "markdown", state: { file: b.path, mode: "source", source: false } });
    await c.waitFor(() => !doc.querySelector(".excalidraw-embed-preview-modal"), "switching source owner closes its viewer");
    check(!oldFrame.isConnected && !target.isConnected, "retired owner retained controls");
    check(leaf.view.editor.getValue() === sourceB && await app.vault.read(a) === source, "retired source or switched note changed");
    check(await app.vault.read(drawing) === drawingBytes, "ownership tests changed drawing content");
    return { assertions: ["same-line repeated embeds target only their own token", "inline/fenced examples have no controls", "independent note and pane stay unchanged", "one-step undo", "refresh remounts controls exactly once", "switching source unloads controls and fullscreen", "drawing bytes unchanged"], actual: geometry() };
  });

  await c.case(`native:embed-table:${context}`, ["P03", "P04", "P05"], async () => {
    const token = `![[${drawing.path}\\|Caption\\|100\\|left]]`;
    const markdown = `![Label\\|120\\|right](<${drawing.path}#^as-image> "Keep title")`;
    const source = `# Table source\n\n| Drawing | Cell |\n| --- | --- |\n| ${token} | first |\n| ${token} | second |\n| ${markdown} | third |\n\nFooter\n`;
    const file = await create("Table-source.md", source);
    await leaf.setViewState({ type: "markdown", state: { file: file.path, mode: "source", source: false } });
    app.workspace.setActiveLeaf(leaf, { focus: true });
    leaf.view.editor.setCursor({ line: leaf.view.editor.lastLine(), ch: 0 });
    const cm = leaf.view.editor.cm;
    const tableEvents = [], observeTableInput = event => tableEvents.push({ type: event.type, key: event.key, target: event.target.getAttribute?.("class"), activeLeaf: app.workspace.activeLeaf?.id, trusted: event.isTrusted });
    for (const name of ["focusin", "keydown", "keyup"]) doc.addEventListener(name, observeTableInput, true);
    c.defer(() => { for (const name of ["focusin", "keydown", "keyup"]) doc.removeEventListener(name, observeTableInput, true); });
    c.observations.tableInput = { ownerLeaf: leaf.id, events: tableEvents };
    const ready = () => {
      const current = frames();
      c.observations = { ...c.observations, table: { selection: cm.state.selection.main.toJSON(), frames: current.map(frame => ({ connected: frame.isConnected, bounds: frame.getBoundingClientRect().toJSON(), width: frame.querySelector(".excalidraw-embedded-img")?.getAttribute("w") })), html: cm.contentDOM.querySelector(".cm-table-widget")?.outerHTML.replace(/<svg\b[\s\S]*?<\/svg>/g, "<svg/>").slice(0, 10000) } };
      return current.length === 3 && current.every((frame, i) => frame.querySelector(".excalidraw-embedded-img")?.getAttribute("w") === (i === 2 ? "120" : "100"));
    };
    await c.waitFor(ready, "three authoritative table cells and escaped display dimensions");
    let other;
    if (!touch) {
      other = app.workspace.getLeaf("split", "vertical"); env.owned.add(other);
      await other.setViewState({ type: "markdown", state: { file: file.path, mode: "source", source: false } });
      other.view.editor.setCursor({ line: other.view.editor.lastLine(), ch: 0 });
      app.workspace.setActiveLeaf(other, { focus: true });
    }
    // A second pane's asynchronous activation can reclaim programmatic focus.
    // Use the same trusted click that a keyboard user uses to focus the handle.
    await action(1, "resize");
    await c.waitFor(() => doc.activeElement === frames()[1]?.querySelector('[data-excalidraw-embed-action="resize"]'), "owned table resize keyboard focus");
    const keyboardImage = frames()[1].querySelector(".excalidraw-embedded-img"), keyboardVisual = keyboardImage.querySelector("svg") ?? keyboardImage;
    const keyboardWidth = keyboardVisual.getBoundingClientRect().width;
    check(keyboardWidth > 52, "table fixture is too narrow for measured shrinking");
    await key("ArrowLeft", "ArrowLeft", 37);
    c.observations.tableInput.afterKeyboard = { activeLeaf: app.workspace.activeLeaf?.id, activeElement: doc.activeElement?.getAttribute("class"), outerFocus: cm.hasFocus, source: cm.state.doc.toString() };
    const changed = source.replace(token + " | second", token.replace("\\|100", "\\|" + Math.round(keyboardWidth - 8)) + " | second");
    await c.waitFor(() => cm.state.doc.toString() === changed, "only the second identical physical table cell resized");
    if (other) await c.waitFor(() => other.view.editor.getValue() === changed, "same-note split receives the exact table transaction");
    cm.focus(); await key("z", "KeyZ", 90, modifier);
    await c.waitFor(() => cm.state.doc.toString() === source && ready(), "one undo restores table source and rendered dimensions");
    for (const [index, label, original, sourceWidth] of [[1, "left", token, 100], [2, "right", markdown, 120]]) {
      c.phase = `native:embed-table:${context}:aligned-resize-${label}`;
      const targetWidth = await drag(index, -20, false, source);
      const resized = original.replace("\\|" + sourceWidth, "\\|" + Math.round(targetWidth));
      const expected = index === 1 ? source.replace(token + " | second", resized + " | second") : source.replace(original, resized);
      await c.waitFor(() => cm.state.doc.toString() === expected, "aligned table resize preserves exact source and other cells");
      cm.focus(); await key("z", "KeyZ", 90, modifier);
      await c.waitFor(() => cm.state.doc.toString() === source && ready(), "aligned resize is one undo step");
    }
    await action(2, "edit");
    check(cm.state.sliceDoc(cm.state.selection.main.from, cm.state.selection.main.to) === markdown, "table source edit selected the wrong syntax or cell");
    leaf.view.editor.setCursor({ line: leaf.view.editor.lastLine(), ch: 0 });
    // The table intentionally owns an inner cell editor while syntax is being
    // edited. Moving the outer caret by API does not blur that editor. Exit it
    // through trusted note input before counting/restoring its normal previews.
    await click(() => [...cm.contentDOM.querySelectorAll(".cm-line")].find(line => line.closest(".cm-content") === cm.contentDOM && line.textContent.trim() === "Footer"));
    await c.waitFor(ready, "table syntax edit roundtrip");
    check(cm.state.doc.toString() === source, "table source editing roundtrip rewrote surrounding syntax");
    await action(1, "reset");
    const reset = source.replace(token + " | second", token.replace("\\|100", "") + " | second");
    await c.waitFor(() => cm.state.doc.toString() === reset, "table reset preserves escaped aliases, style, title and other cells");
    cm.focus(); await key("z", "KeyZ", 90, modifier);
    await c.waitFor(() => cm.state.doc.toString() === source, "table reset is one undo step");
    check(await app.vault.read(drawing) === drawingBytes, "table controls changed the drawing file");
    return { assertions: ["native table widget public boundaries and physical cell ownership", "escaped wiki and Markdown-image dimensions render", "only second identical row changes", "same-note split synchronization", "left/right pointer previews retain measured size and aspect ratio", "one-step undo/reset", "exact Markdown syntax selection", "aliases/styles/title and other cells preserved", "drawing bytes unchanged"], actual: geometry() };
  });

  await c.case(`native:embed-hybrid:${context}`, ["P02", "P05"], async () => {
    p.settings.previewImageType = "SVG";
    const selfToken = "![[Hybrid|180]]", otherToken = `![[${drawing.path}|180]]`;
    const fixture = template.replace("User Markdown retained.", `# Hybrid controls\n\n${selfToken}\n\n${otherToken}\n\nFooter\n`);
    check(fixture !== template, "hybrid fixture Markdown marker missing");
    const file = await create("Hybrid.md", fixture);
    await c.waitFor(() => p.isExcalidrawFile(file), "hybrid drawing metadata");
    await leaf.setViewState({ type: "markdown", state: { file: file.path, mode: "source", source: false } });
    // Known drawings are routed back to Excalidraw. Use its public Markdown
    // action, which also establishes the leaf-specific mode override.
    await c.waitFor(() => leaf.view.excalidrawAPI && leaf.view.isLoaded && !leaf.view.semaphores.justLoaded, "hybrid drawing ready before opening Markdown");
    await leaf.view.openAsMarkdown();
    await c.waitFor(() => leaf.view.getViewType() === "markdown" && leaf.view.editor, "drawing opened through its Markdown action");
    await leaf.view.setState({ ...leaf.view.getState(), mode: "source", source: false }, { history: false });
    app.workspace.setActiveLeaf(leaf, { focus: true });
    const editor = leaf.view.editor, cm = editor.cm;
    // Opening a drawing as Markdown may first save/decompress its scene. The
    // controls must preserve the complete content produced by that transition.
    const source = editor.getValue();
    check(source.includes(selfToken + "\n\n" + otherToken), "hybrid fixture embeds changed before interaction");
    editor.setCursor({ line: editor.getValue().slice(0, editor.getValue().indexOf("Footer")).split("\n").length - 1, ch: 0 });
    const ready = () => frames().length === 2 && frames().every(frame => frame.querySelector('[data-excalidraw-embed-action="resize"]'));
    await c.waitFor(ready, "self and other drawing controls in drawing Markdown view");
    check(frames()[0].querySelector(".excalidraw-embedded-img").getAttribute("fileSource") === file.path, "short self-link resolved to a different drawing");
    check(frames()[1].querySelector(".excalidraw-embedded-img").getAttribute("fileSource") === drawing.path, "other drawing identity changed");
    await action(0, "resize");
    const image = frames()[0].querySelector(".excalidraw-embedded-img"), visual = image.querySelector("svg") ?? image;
    const initialWidth = visual.getBoundingClientRect().width;
    check(initialWidth > 52, "hybrid preview too narrow to shrink");
    await key("ArrowLeft", "ArrowLeft", 37);
    const changed = source.replace(selfToken, selfToken.replace("|180", "|" + Math.round(initialWidth - 8)));
    await c.waitFor(() => cm.state.doc.toString() === changed, "hybrid resize changes only its exact self-embed token");
    await leaf.view.save();
    check(await app.vault.read(file) === changed, "hybrid resize changed serialized drawing data or failed to persist");
    cm.focus(); await key("z", "KeyZ", 90, modifier);
    await c.waitFor(() => cm.state.doc.toString() === source && ready(), "hybrid resize is one undo step");
    await action(0, "reset");
    await c.waitFor(() => cm.state.doc.toString() === source.replace(selfToken, "![[Hybrid]]"), "hybrid reset changes only self dimensions");
    cm.focus(); await key("z", "KeyZ", 90, modifier);
    await c.waitFor(() => cm.state.doc.toString() === source && ready(), "hybrid reset is one undo step");
    await leaf.view.save();
    check(await app.vault.read(file) === source, "hybrid undo did not restore exact persisted drawing content");
    await action(0, "edit");
    check(cm.state.sliceDoc(cm.state.selection.main.from, cm.state.selection.main.to) === selfToken, "hybrid source edit selected drawing metadata");
    editor.setCursor({ line: source.slice(0, source.indexOf("Footer")).split("\n").length - 1, ch: 0 });
    await c.waitFor(ready, "hybrid source selection roundtrip");
    await action(0, "preview");
    await c.waitFor(() => doc.querySelector(".excalidraw-embed-preview-modal [fileSource]")?.getAttribute("fileSource") === file.path, "hybrid self-preview uses its drawing");
    await key("Escape", "Escape", 27);
    await c.waitFor(() => !doc.querySelector(".excalidraw-embed-preview-modal"), "hybrid self-preview closes");
    await leaf.view.setState({ ...leaf.view.getState(), mode: "preview" }, { history: false });
    await c.waitFor(() => frames().length === 2 && frames().every(frame => !frame.querySelector('[data-excalidraw-embed-action="resize"]')), "hybrid Reading controls are preview-only");
    await action(0, "preview");
    await c.waitFor(() => doc.querySelector(".excalidraw-embed-preview-modal [fileSource]")?.getAttribute("fileSource") === file.path, "Reading self-preview uses its drawing");
    await key("Escape", "Escape", 27);
    await c.waitFor(() => !doc.querySelector(".excalidraw-embed-preview-modal"), "Reading self-preview closes");
    check(await app.vault.read(file) === source && await app.vault.read(drawing) === drawingBytes, "hybrid controls changed drawing data or another drawing");
    return { assertions: ["drawing opened as Markdown owns self and other drawing embeds", "short self-link identity", "exact resize/reset and single undo", "physical save preserves serialized drawing data", "exact source selection", "Live Preview and Reading fullscreen", "Reading controls do not edit source", "other drawing unchanged"], actual: geometry() };
  });
}
