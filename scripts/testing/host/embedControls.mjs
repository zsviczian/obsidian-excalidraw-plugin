/** #3036: trusted input against real Markdown widgets, exact source and history. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInAppTask } from "./inAppTask.mjs";
import { behaviorEnvironment } from "./behaviorEnvironment.mjs";
import { behaviorInputDriver } from "./behaviorMatrix.mjs";
import { completeConsoleErrors } from "./debuggerSession.mjs";
import { settleBrowserDiagnostics, splitWindowErrors } from "./browserDiagnostics.mjs";

const casesFor = ids => ids.flatMap(id => [...["PNG", "SVGIMG", "SVG"].map(mode => `native:embed-controls:${id}:${mode}`), `native:embed-ownership:${id}`]);
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
    await c.waitFor(() => leaf.view.contentEl.querySelectorAll(".excalidraw-embed-toolbar").length === 3, "three owned embed toolbars");
    await c.waitFor(() => frames().every(frame => {
      const image = frame.querySelector(".excalidraw-embedded-img");
      return image?.getBoundingClientRect().height > 0 && (image.tagName !== "IMG" || image.complete && image.naturalWidth > 0);
    }), "decoded drawing previews with positive dimensions");
  };
  const frames = () => [...leaf.view.contentEl.querySelectorAll(".excalidraw-embed-controls-frame")];
  const action = async (index, name) => {
    const frame = frames()[index];
    check(frame, "missing embed frame " + index); frame.scrollIntoView({ block: "center" });
    const rect = frame.getBoundingClientRect();
    if (!touch) await input("Input.dispatchMouseEvent", { type: "mouseMoved", x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
    await click(() => frames()[index]?.querySelector(`[data-excalidraw-embed-action="${name}"]`));
  };
  const drag = async (index, delta, cancel = false) => {
    const frame = frames()[index], handle = frame.querySelector('[data-excalidraw-embed-action="resize"]');
    handle.focus(); handle.scrollIntoView({ block: "center" });
    const r = handle.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    const events = [], observe = event => events.push({ type: event.type, target: event.target.className, trusted: event.isTrusted, x: event.clientX, y: event.clientY });
    for (const name of ["pointerdown", "pointermove", "pointerup", "blur", "lostpointercapture"]) win.addEventListener(name, observe, true);
    c.defer(() => { for (const name of ["pointerdown", "pointermove", "pointerup", "blur", "lostpointercapture"]) win.removeEventListener(name, observe, true); });
    c.observations = { ...c.observations, drag: { handle: handle.outerHTML, bounds: r.toJSON(), image: frame.querySelector(".excalidraw-embedded-img").getBoundingClientRect().toJSON(), hit: doc.elementFromPoint(x, y)?.outerHTML.slice(0, 500), events } };
    const send = (phase, point) => touch ? input("Input.dispatchTouchEvent", { type: phase === "down" ? "touchStart" : phase === "move" ? "touchMove" : "touchEnd", touchPoints: phase === "up" ? [] : [{ x: point, y, id: 1 }] })
      : input("Input.dispatchMouseEvent", { type: phase === "down" ? "mousePressed" : phase === "move" ? "mouseMoved" : "mouseReleased", x: point, y, button: "left", buttons: phase === "up" ? 0 : 1, clickCount: 1 });
    try {
      await send("down", x); await send("move", x + delta / 2); await send("move", x + delta);
      check(leaf.view.editor.getValue() === content, "pointer movement wrote source before commit");
      check(frame.hasClass("excalidraw-embed-resizing"), "real pointer did not start CSS resize preview");
      if (cancel) await key("Escape", "Escape", 27);
    } finally { await send("up", x + delta); }
  };
  for (const mode of ["PNG", "SVGIMG", "SVG"]) await c.case(`native:embed-controls:${context}:${mode}`, ["P02", "P05"], async () => {
    p.settings.previewImageType = mode;
    await open();
    if (mainWindow) { mainWindow.minimize(); browserWindow.focus(); check(mainWindow.isMinimized(), "main window was not minimized for popout input"); }
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
    await key("+", "Equal", 187, 8);
    check(Number(stage.getAttribute("data-zoom")) > 1, "fullscreen keyboard zoom failed");
    await key("ArrowRight", "ArrowRight", 39);
    check(modal.querySelector(".excalidraw-embed-preview-surface").style.transform.includes("-24px"), "fullscreen keyboard pan failed");
    await key("0", "Digit0", 48);
    check(Number(stage.getAttribute("data-zoom")) === 1, "fullscreen fit failed");
    await key("Escape", "Escape", 27);
    await c.waitFor(() => !modal.isConnected, "fullscreen closes on Escape");
    check(doc.activeElement?.getAttribute("data-excalidraw-embed-action") === "preview", "fullscreen did not restore opener focus");
    check(inline.isConnected && (mode === "SVG" ? !!inline.querySelector("svg") : inline.complete && inline.naturalWidth > 0), "closing fullscreen invalidated inline payload");
    check(!leaf.view.contentEl.querySelector(`.internal-embed[src="${plain.path}"] [data-excalidraw-embed-action]`), "ordinary image acquired drawing controls");
    await open("preview");
    check(!leaf.view.contentEl.querySelector('[data-excalidraw-embed-action="resize"], [data-excalidraw-embed-action="edit"], [data-excalidraw-embed-action="reset"]'), "Reading mode acquired source mutation controls");
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
}
