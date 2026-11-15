/** Maintainer-selected creation, keyboard, companion-failure and video regressions. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInAppTask } from "./inAppTask.mjs";
import { behaviorEnvironment } from "./behaviorEnvironment.mjs";
import { behaviorInputDriver } from "./behaviorMatrix.mjs";
import { completeConsoleErrors } from "./debuggerSession.mjs";
import { settleBrowserDiagnostics, splitWindowErrors } from "./browserDiagnostics.mjs";

export const issue3052CaseIds = ["main", "popout"].flatMap(context => [
  "native:creation-actions-3047:" + context, "native:pen-toggle-3044:" + context,
  "native:youtube-fullscreen-3048:" + context, "native:extras-unavailable-3051:" + context,
]).concat("native:png-embed-window-migration:main");

export async function runIssue3052Scenario({ cli, drawingPath }) {
  const template = readFileSync(new URL("../../../tests/vault/Drawings/Uncompressed.excalidraw.md", import.meta.url), "utf8");
  const tests = [], consoleErrors = [], windowErrors = [];
  for (const context of ["main", "popout"]) {
    const execute = new Function(`return async function(c,path,context,template){
      const env=await (${behaviorEnvironment.toString()})(c,path,{id:context,input:'mouse'},template,${completeConsoleErrors.toString()},${settleBrowserDiagnostics.toString()});
      const runCase=c.case.bind(c);c.case=async(...args)=>{c.phase=args[0];return runCase(...args);};
      try {await (${exerciseIssues.toString()})(c,env,template);}
      catch(error){
        try {c.observations={...c.observations,diagnostics:env.diagnostics()};}
        catch(diagnosticError){c.observations={...c.observations,diagnosticError:String(diagnosticError)};}
        throw error;
      }
      return {tests:c.tests,consoleErrors:c.externalConsoleErrors||[],windowErrors:env.windowErrors};
    }`)();
    const result = await runInAppTask({ cli, execute, args: [drawingPath, context, template], timeoutMs: 300000, cleanupMs: 60000,
      onRequest: behaviorInputDriver(cli), onProgress: phase => { if (phase) process.stdout.write("Issue fixes: " + phase + "\n"); },
    }).catch(error => { error.evidence = [...tests, ...(error.evidence || [])]; throw error; });
    tests.push(...result.tests); consoleErrors.push(...result.consoleErrors); windowErrors.push(...result.windowErrors);
  }
  assert.equal(consoleErrors.length, 0, "Issue scenarios emitted console errors");
  assert.equal(splitWindowErrors(windowErrors).unexpected.length, 0, "Issue scenarios emitted window errors");
  return { id: "issue-fixes-3052", status: "passed", tests, consoleErrors, windowErrors };
}

async function exerciseIssues(c, env, template) {
  c.observations ??= {};
  const { doc, win, create, check, click, key, geometry } = env;
  let leaf = env.leaf;
  let p = env.p;
  const context = geometry().requested.id;
  const livePlugin = async () => {
    if (!app.plugins.plugins["obsidian-excalidraw-plugin"]) await app.plugins.enablePlugin("obsidian-excalidraw-plugin");
    await c.waitForCleanup(() => app.plugins.plugins["obsidian-excalidraw-plugin"]?.isReady, "live plugin after reload");
    return app.plugins.plugins["obsidian-excalidraw-plugin"];
  };
  c.defer(livePlugin);
  const disablePlugin = async () => {
    // Reload tests change registration/settings, not save cancellation. Flush
    // the owned edits before retiring the plugin (as deployment does).
    const views = app.workspace.getLeavesOfType("excalidraw").map(leaf => leaf.view);
    for (const view of views) {
      if (view.excalidrawAPI && view.isDirty())
        check((await view.saveWithOutcome()).status === "persisted", "pre-reload drawing flush failed");
    }
    await c.waitFor(() => views.every(view => !view.isSaveInProgress() && !view.isSynchronizing), "pre-reload saves settled");
    await app.plugins.disablePlugin("obsidian-excalidraw-plugin");
    await c.waitFor(() => views.every(view => !view.excalidrawAPI), "all reload source roots unmounted");
  };
  const drawing = await create("Issue-fixture.excalidraw.md", template);
  await c.waitFor(() => p.isExcalidrawFile(drawing), "issue fixture metadata");
  const open = async () => {
    await leaf.setViewState({ type: "excalidraw", state: { file: drawing.path } });
    app.workspace.setActiveLeaf(leaf, { focus: true });
    await c.waitFor(() => leaf.view.excalidrawAPI && !leaf.view.excalidrawAPI.getAppState().isLoading, "issue fixture editor");
    return leaf.view;
  };
  if (context === "main") await c.case("native:png-embed-window-migration:main", ["P05", "P08"], async () => {
    const original = p.settings.previewImageType;
    const restore = async () => { const current = await livePlugin(); current.settings.previewImageType = original; await current.saveSettings(); };
    c.defer(restore);
    p.settings.previewImageType = "PNG";
    const source = `![[${drawing.path}|180]]\n\n![[${drawing.path}|220]]\n\nFooter\n`;
    const note = await create("PNG-migration.md", source), destination = leaf.parent;
    const images = () => [...leaf.view.containerEl.querySelectorAll("img.excalidraw-embedded-img")];
    const decoded = async label => {
      await c.waitFor(() => {
        const nodes = images();
        c.observations.pngMigration = { label, ownerMain: leaf.view.containerEl.ownerDocument === doc, images: nodes.map(img => ({ source: img.src, width: img.naturalWidth, complete: img.complete })) };
        return nodes.length === 2 && nodes.every(img => img.complete && img.naturalWidth > 0);
      }, label + " PNG images decode");
    };
    await leaf.setViewState({ type: "markdown", state: { file: note.path, mode: "source", source: false } });
    leaf.view.editor.setCursor({ line: leaf.view.editor.lastLine(), ch: 0 });
    await decoded("main");
    app.workspace.moveLeafToPopout(leaf);
    await c.waitFor(() => leaf.view.containerEl.ownerDocument !== doc, "PNG Markdown view moves to popout");
    const popup = leaf.view.containerEl.ownerDocument.defaultView;
    const observeError = event => env.windowErrors.push({ context: "png-migration", window: "popout", phase: c.activeCase,
      message: event.message, hasError: event.error != null, isTrusted: event.isTrusted, stack: event.error?.stack });
    popup.addEventListener("error", observeError);
    c.defer(() => { if (!popup.closed) popup.removeEventListener("error", observeError); });
    await decoded("popout");
    leaf.parent.removeChild(leaf); leaf.setDimension(null); destination.insertChild(-1, leaf);
    destination.selectTabIndex(destination.children.indexOf(leaf)); app.workspace.requestResize();
    await c.waitFor(() => leaf.view.containerEl.ownerDocument === doc, "PNG Markdown view returns to main");
    await decoded("returned main");
    check(await app.vault.read(note) === source, "PNG window migration changed Markdown source");
    await restore();
    return { assertions: ["two PNG embeds decode in main", "decoded PNG embeds survive actual main-to-popout and popout-to-main Markdown migration", "Markdown source remains unchanged"] };
  });
  await c.case("native:pen-toggle-3044:" + context, ["P03", "P08"], async () => {
    const view = await open(), api = view.excalidrawAPI;
    const root = view.containerEl.querySelector(".excalidraw"); root.focus();
    api.setActiveTool({ type: "selection" });
    await key("p", "KeyP", 80); await c.waitFor(() => api.getAppState().activeTool.type === "freedraw", "P selects pen");
    const penKey = { key: "p", code: "KeyP", windowsVirtualKeyCode: 80 };
    await env.input("Input.dispatchKeyEvent", { type: "keyDown", ...penKey });
    try {
      await c.waitFor(() => api.getAppState().activeTool.type === "selection", "second P selects mouse");
      await env.input("Input.dispatchKeyEvent", { type: "keyDown", ...penKey, autoRepeat: true });
    } finally {
      await env.input("Input.dispatchKeyEvent", { type: "keyUp", ...penKey });
    }
    check(api.getAppState().activeTool.type === "selection", "holding the second P returned to pen");
    await key("p", "KeyP", 80);
    await c.waitFor(() => api.getAppState().activeTool.type === "freedraw", "fresh P reenters pen");
    const input = root.createEl("input"); c.defer(() => input.remove()); input.focus();
    // The shortcut helper deliberately omits printable text. A real typing
    // keyDown needs text as well as key/code to exercise the exclusion rule.
    await env.input("Input.dispatchKeyEvent", { type: "keyDown", key: "p", code: "KeyP", windowsVirtualKeyCode: 80, text: "p" });
    await env.input("Input.dispatchKeyEvent", { type: "keyUp", key: "p", code: "KeyP", windowsVirtualKeyCode: 80 });
    c.observations.penInput = { value: input.value, tool: api.getAppState().activeTool.type, focused: doc.activeElement === input };
    check(input.value === "p" && api.getAppState().activeTool.type === "freedraw", "P consumed text input");
    input.remove(); root.focus(); await key("v", "KeyV", 86);
    check(api.getAppState().activeTool.type === "selection", "existing selection shortcut changed");
    return { assertions: ["native P enters pen and second P selects mouse", "holding the second P keeps selection after the API commits", "fresh P reenters pen", "text input retains P", "V still selects mouse", "owning main/popout keyboard"] };
  });
  await c.case("native:youtube-fullscreen-3048:" + context, ["P03", "P08"], async () => {
    const view = await open(), api = view.excalidrawAPI;
    const elements = view.packages.excalidrawLib.convertToExcalidrawElements([{ type: "embeddable", x: 50, y: 50, width: 480, height: 270, link: "https://www.youtube.com/watch?v=abcdefghijk" }]);
    api.updateScene({ elements, appState: { scrollX: 0, scrollY: 0, zoom: { value: 0.75 }, activeEmbeddable: { element: elements[0], state: "active" } }, captureUpdate: "NEVER" });
    await c.waitFor(() => view.containerEl.querySelector("iframe.excalidraw__embeddable"), "YouTube iframe transport");
    check(!view.containerEl.querySelector("webview.excalidraw__embeddable"), "YouTube still uses guest webview fullscreen");
    const iframe = view.containerEl.querySelector("iframe.excalidraw__embeddable");
    check(iframe.src.startsWith("https://releases.obsidian.md/youtube?"), "YouTube wrapper routing changed");
    // Replace the external player with a local fixture; exercise the actual
    // Electron fullscreen boundary without requiring YouTube/network service.
    iframe.srcdoc = "<!doctype html><html><body style='margin:0;background:#183048'>Offline fullscreen player<button id='exit' style='position:absolute;left:24px;top:24px'>Exit fullscreen</button></body></html>";
    await c.waitFor(() => iframe.contentDocument?.querySelector("#exit"), "offline fullscreen fixture");
    const exit = iframe.contentDocument.querySelector("#exit");
    exit.addEventListener("click", () => { void iframe.contentDocument.exitFullscreen(); });
    const trigger = doc.body.createEl("button", { text: "Test video fullscreen" });
    trigger.setCssStyles({ position: "fixed", left: "100px", top: "100px", zIndex: "100000" });
    c.defer(async () => { trigger.remove(); if (doc.fullscreenElement) await doc.exitFullscreen(); });
    trigger.onClickEvent(() => { void iframe.contentDocument.documentElement.requestFullscreen(); });
    await click(trigger); await c.waitFor(() => doc.fullscreenElement === iframe, "video owns fullscreen top layer");
    const r = iframe.getBoundingClientRect();
    c.observations.fullscreen = { bounds: r.toJSON(), viewport: { width: win.innerWidth, height: win.innerHeight } };
    check(Math.abs(r.width - win.innerWidth) < 2 && Math.abs(r.height - win.innerHeight) < 2 && Math.abs(r.x) < 2 && Math.abs(r.y) < 2, "video did not fill owning window");
    // CDP Escape is a renderer event, not Chromium's reserved browser shortcut
    // (also reproduced in an unmodified browser). Exercise the player's own
    // trusted exit control instead; physical Escape remains a manual check.
    const b = exit.getBoundingClientRect(), x = b.x + b.width / 2, y = b.y + b.height / 2;
    check(doc.elementFromPoint(x, y) === iframe && exit.contains(iframe.contentDocument.elementFromPoint(x, y)), "fullscreen exit target is covered");
    for (const type of ["mousePressed", "mouseReleased"]) await env.input("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mousePressed" ? 1 : 0, clickCount: 1 });
    await c.waitFor(() => !doc.fullscreenElement, "player exits fullscreen");
    check(iframe.isConnected && iframe.getBoundingClientRect().width < win.innerWidth, "video embed identity/geometry not restored");
    trigger.remove();
    // Unlike the cross-origin provider, this same-origin fixture lets Obsidian
    // capture a child element lacking its DOM extensions when opening a modal.
    // Retire the player and restore native editor focus before the next case.
    api.updateScene({ elements: [], captureUpdate: "NEVER" });
    await c.waitFor(() => !iframe.isConnected, "offline player teardown");
    view.containerEl.querySelector(".excalidraw").focus();
    check(typeof doc.activeElement.instanceOf === "function", "editor focus not restored after local player");
    return { assertions: ["YouTube iframe transport and existing wrapper URL", "trusted Electron HTML fullscreen fills owning window", "trusted player exit restores the same embedded player"], bounds: r.toJSON(), externalPlayback: "not exercised; offline fixture", physicalEscape: "separate manual check; CDP does not invoke the browser shortcut" };
  });
  await c.case("native:extras-unavailable-3051:" + context, ["P01", "P03"], async () => {
    const extras = app.plugins.plugins["excalidraw-extras"], original = extras.api;
    c.defer(() => { extras.api = original; });
    for (const api of [undefined, {}, { versions: {} }]) {
      extras.api = api;
      if (api === undefined && context === "main") {
        const retired = leaf.view;
        await disablePlugin();
        await c.waitFor(() => !retired.excalidrawAPI, "late-load source root unmounted");
        if (!leaf.view) env.owned.delete(leaf);
        leaf = app.workspace.getLeaf("tab"); env.owned.add(leaf);
        await leaf.setViewState({ type: "markdown", state: { file: drawing.path } });
        check(leaf.view.getViewType() === "markdown", "late-load fixture did not start as Markdown");
        c.observations.lateLoad = { before: leaf.view.getViewType(), layoutReady: app.workspace.layoutReady, extrasApiMissing: true };
        p = await livePlugin();
        await c.waitFor(() => leaf.view.excalidrawAPI && !leaf.view.excalidrawAPI.getAppState().isLoading, "late load restores drawing from Markdown");
        c.observations.lateLoad.after = { type: leaf.view.getViewType(), editorReady: true };
      }
      check(await p.extrasGateway.getMermaid() === null, "unavailable companion did not cancel gracefully");
      const view = await open(); check(p.isReady && !!view.excalidrawAPI, "optional Extras API blocked drawing mode");
    }
    extras.api = original;
    check(p.extrasGateway.getAPI() === original, "updated companion API could not recover");
    return { assertions: ["absent/incomplete optional API produces cancellation without an exception", "drawings remain editable", ...(context === "main" ? ["main-window late plugin load restores a fallback Markdown drawing"] : []), "restored companion becomes available"], reporterCause: "reporter links failure to Lazy Loader's 20-second delay; exact third-party interaction remains unconfirmed" };
  });
  await c.case("native:creation-actions-3047:" + context, ["P01", "P02", "P08"], async () => {
    // The editor fixture is deliberately mutated by the video case. Keep the
    // creation template immutable so autosave cannot change this expectation.
    const creationTemplate = await create("Creation-template.excalidraw.md", template);
    await c.waitFor(() => p.isExcalidrawFile(creationTemplate), "creation template metadata");
    const original = JSON.parse(JSON.stringify(p.settings));
    c.defer(async () => {
      const current = await livePlugin();
      current.settings = original; await current.saveSettings(); current.drawingCreationUI.refresh();
    });
    p.settings.showRibbonIcon = false; p.settings.showNewDrawingInEmptyTab = true;
    p.settings.folder = env.prefix; p.settings.templateFilePath = creationTemplate.path; p.settings.drawingFilenamePrefix = "New-action-";
    p.settings.__issue3052Unknown = { preserved: true };
    await p.saveSettings();
    await leaf.setViewState({ type: "empty", state: {} }); app.workspace.setActiveLeaf(leaf, { focus: true });
    p.drawingCreationUI.refresh();
    await c.waitFor(() => leaf.view.containerEl.querySelector(".excalidraw-new-drawing"), "new-tab drawing action");
    const list = leaf.view.containerEl.querySelector(".empty-state-action-list"), builtins = [...list.children].filter(el => !el.hasClass("excalidraw-new-drawing"));
    check(builtins.length > 0, "empty-tab core actions disappeared");
    check(p.drawingCreationUI.ribbon.hasClass("excalidraw-display-none"), "ribbon preference ignored");
    await click(list.querySelector(".excalidraw-new-drawing"));
    await c.waitFor(() => leaf.view.excalidrawAPI && leaf.view.file?.path.startsWith(env.prefix + "/New-action-"), "creation uses configured destination and format");
    await env.ready(leaf);
    check(leaf.view.file.extension === "md" && leaf.view.excalidrawAPI.getSceneElements().length > 0, "creation ignored template or file format");
    check(await app.vault.read(creationTemplate) === template, "creation modified its template");
    if (context === "main") {
      const retired = leaf.view;
      await disablePlugin();
      await c.waitFor(() => !retired.excalidrawAPI, "creation source root unmounted");
      if (!leaf.view) env.owned.delete(leaf);
      const current = await livePlugin();
      check(!current.settings.showRibbonIcon && current.settings.showNewDrawingInEmptyTab && current.settings.__issue3052Unknown?.preserved, "reload lost creation preferences or unknown settings");
      const data = JSON.parse(await app.vault.adapter.read(app.vault.configDir + "/plugins/obsidian-excalidraw-plugin/data.json"));
      check(data.showNewDrawingInEmptyTab && data.showRibbonIcon === false && data.__issue3052Unknown.preserved, "disk settings differ after reload");
    }
    return { assertions: ["empty-tab action retains core actions", "independent ribbon visibility", "configured destination, format and template", ...(context === "main" ? ["nondefault and unknown settings survive actual plugin reload and disk persistence"] : [])] };
  });
}
