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
]);

export async function runIssue3052Scenario({ cli, drawingPath }) {
  const template = readFileSync(new URL("../../../tests/vault/Drawings/Uncompressed.excalidraw.md", import.meta.url), "utf8");
  const tests = [], consoleErrors = [], windowErrors = [];
  for (const context of ["main", "popout"]) {
    const execute = new Function(`return async function(c,path,context,template){
      const env=await (${behaviorEnvironment.toString()})(c,path,{id:context,input:'mouse'},template,${completeConsoleErrors.toString()},${settleBrowserDiagnostics.toString()});
      await (${exerciseIssues.toString()})(c,env,template);
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
  const { leaf, doc, win, create, check, click, key, geometry } = env;
  let p = env.p;
  const context = geometry().requested.id;
  const drawing = await create("Issue-fixture.excalidraw.md", template);
  await c.waitFor(() => p.isExcalidrawFile(drawing), "issue fixture metadata");
  const open = async () => {
    await leaf.setViewState({ type: "excalidraw", state: { file: drawing.path } });
    app.workspace.setActiveLeaf(leaf, { focus: true });
    await c.waitFor(() => leaf.view.excalidrawAPI && !leaf.view.excalidrawAPI.getAppState().isLoading, "issue fixture editor");
    return leaf.view;
  };
  await c.case("native:pen-toggle-3044:" + context, ["P03", "P08"], async () => {
    const view = await open(), api = view.excalidrawAPI;
    const root = view.containerEl.querySelector(".excalidraw"); root.focus();
    api.setActiveTool({ type: "selection" });
    await key("p", "KeyP", 80); await c.waitFor(() => api.getAppState().activeTool.type === "freedraw", "P selects pen");
    await key("p", "KeyP", 80); await c.waitFor(() => api.getAppState().activeTool.type === "selection", "second P selects mouse");
    await key("p", "KeyP", 80);
    const input = view.containerEl.createEl("input"); c.defer(() => input.remove()); input.focus();
    await key("p", "KeyP", 80); check(input.value === "p" && api.getAppState().activeTool.type === "freedraw", "P consumed text input");
    input.remove(); root.focus(); await key("v", "KeyV", 86);
    check(api.getAppState().activeTool.type === "selection", "existing selection shortcut changed");
    return { assertions: ["native P enters pen and second P selects mouse", "text input retains P", "V still selects mouse", "owning main/popout keyboard"] };
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
    iframe.srcdoc = "<!doctype html><html><body style='margin:0;background:#183048'>Offline fullscreen player</body></html>";
    await c.waitFor(() => iframe.contentDocument?.body?.textContent === "Offline fullscreen player", "offline fullscreen fixture");
    const trigger = doc.body.createEl("button", { text: "Test video fullscreen" });
    trigger.setCssStyles({ position: "fixed", left: "100px", top: "100px", zIndex: "100000" });
    c.defer(async () => { trigger.remove(); if (doc.fullscreenElement) await doc.exitFullscreen(); });
    trigger.onClickEvent(() => { void iframe.contentDocument.documentElement.requestFullscreen(); });
    await click(trigger); await c.waitFor(() => doc.fullscreenElement === iframe, "video owns fullscreen top layer");
    const r = iframe.getBoundingClientRect();
    check(Math.abs(r.width - win.innerWidth) < 2 && Math.abs(r.height - win.innerHeight) < 2 && Math.abs(r.x) < 2 && Math.abs(r.y) < 2, "video did not fill owning window");
    await key("Escape", "Escape", 27); await c.waitFor(() => !doc.fullscreenElement, "video exits fullscreen");
    check(iframe.isConnected && iframe.getBoundingClientRect().width < win.innerWidth, "video embed identity/geometry not restored");
    trigger.remove();
    return { assertions: ["YouTube iframe transport and existing wrapper URL", "trusted Electron HTML fullscreen fills owning window", "Escape restores the same embedded player"], bounds: r.toJSON(), externalPlayback: "not exercised; offline fixture" };
  });
  await c.case("native:extras-unavailable-3051:" + context, ["P01", "P03"], async () => {
    const extras = app.plugins.plugins["excalidraw-extras"], original = extras.api;
    c.defer(() => { extras.api = original; });
    for (const api of [undefined, {}, { versions: {} }]) {
      extras.api = api;
      if (api === undefined && context === "main") {
        await app.plugins.disablePlugin("obsidian-excalidraw-plugin");
        await app.plugins.enablePlugin("obsidian-excalidraw-plugin");
        await c.waitFor(() => app.plugins.plugins["obsidian-excalidraw-plugin"]?.isReady, "startup without Extras API");
        p = app.plugins.plugins["obsidian-excalidraw-plugin"];
      }
      check(await p.extrasGateway.getMermaid() === null, "unavailable companion did not cancel gracefully");
      const view = await open(); check(p.isReady && !!view.excalidrawAPI, "optional Extras API blocked drawing mode");
    }
    extras.api = original;
    check(p.extrasGateway.getAPI() === original, "updated companion API could not recover");
    return { assertions: ["absent/incomplete optional API produces cancellation without an exception", "drawings remain editable", "restored companion becomes available"], reporterCause: "unconfirmed without version/debug information" };
  });
  await c.case("native:creation-actions-3047:" + context, ["P01", "P02", "P08"], async () => {
    const original = JSON.parse(JSON.stringify(p.settings));
    c.defer(async () => {
      const current = app.plugins.plugins["obsidian-excalidraw-plugin"];
      current.settings = original; await current.saveSettings(); current.drawingCreationUI.refresh();
    });
    p.settings.showRibbonIcon = false; p.settings.showNewDrawingInEmptyTab = true;
    p.settings.folder = env.prefix; p.settings.templateFilePath = drawing.path; p.settings.drawingFilenamePrefix = "New-action-";
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
    check(leaf.view.file.extension === "md" && leaf.view.excalidrawAPI.getSceneElements().length > 0, "creation ignored template or file format");
    if (context === "main") {
      await app.plugins.disablePlugin("obsidian-excalidraw-plugin"); await app.plugins.enablePlugin("obsidian-excalidraw-plugin");
      await c.waitFor(() => app.plugins.plugins["obsidian-excalidraw-plugin"]?.isReady, "settings reload readiness");
      const current = app.plugins.plugins["obsidian-excalidraw-plugin"];
      check(!current.settings.showRibbonIcon && current.settings.showNewDrawingInEmptyTab && current.settings.__issue3052Unknown?.preserved, "reload lost creation preferences or unknown settings");
      const data = JSON.parse(await app.vault.adapter.read(app.vault.configDir + "/plugins/obsidian-excalidraw-plugin/data.json"));
      check(data.showNewDrawingInEmptyTab && data.showRibbonIcon === false && data.__issue3052Unknown.preserved, "disk settings differ after reload");
    }
    return { assertions: ["opt-in empty-tab action retains core actions", "independent ribbon visibility", "configured destination, format and template", "nondefault and unknown settings survive actual plugin reload and disk persistence"] };
  });
}
