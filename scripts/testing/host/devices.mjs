/** Actual Obsidian mobile mode reloads the vault. Own state in Node across those reloads. */
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { validateTarget } from "./runner.mjs";
import { parseCLIJSON, runInAppTask } from "./inAppTask.mjs";
import { acquireDebuggerSession, unexpectedConsoleErrors } from "./debuggerSession.mjs";
import { deviceProfiles } from "./deviceProfiles.mjs";
import { writeReportFiles } from "../reportFiles.mjs";
import { waitForNativeReady } from "./hostReadiness.mjs";
import { mainWindowExpression, restoreDeviceState } from "./deviceRecovery.mjs";

/** The caller owns the application-session lock and exact build staging. */
export async function runDeviceMatrix({ cli, reportDir, vaultName, vaultPath, configDir, automationRoot, profiles = deviceProfiles() }) {
  reportDir = resolve(reportDir);
  const target = validateTarget({ vaultName, vaultPath, configDir, automationRoot });
  assert.equal(realpathSync(cli("vault", "info=path").trim()), target.vault, "Device CLI selected another vault");
  const evaluate = code => parseCLIJSON(cli("eval", "code=" + code));
  const owner = mainWindowExpression;
  const original = evaluate(`JSON.stringify((()=>{const w=${owner};if(w.webContents.debugger.isAttached())throw Error('Existing debugger owner');return{mobile:app.isMobile===true,theme:app.vault.getConfig('theme'),layout:app.workspace.getLayout(),desktopMode:localStorage.getItem('excalidraw.desktopUIMode'),id:w.id,bounds:w.getBounds(),normalBounds:w.getNormalBounds(),minimum:w.getMinimumSize(),maximized:w.isMaximized(),fullscreen:w.isFullScreen(),zoom:w.webContents.getZoomFactor(),touch:{maxTouchPoints:navigator.maxTouchPoints,coarse:matchMedia('(pointer: coarse)').matches,hover:matchMedia('(hover: hover)').matches}};})())`);
  const path = `__excalidraw_cli_smoke_devices_${randomUUID()}.excalidraw.md`;
  const fixture = readFileSync(new URL("../../../tests/vault/Drawings/Uncompressed.excalidraw.md", import.meta.url), "utf8");
  const report = { schemaVersion: 2, suiteId: "native-devices", status: "failed", cleanup: "not-started", tests: [],
    requestedProfile: "devices", actualProfile: profiles.map(profile => profile.id),
    limitations: ["Desktop Obsidian mobile emulation with trusted CDP touch input; no physical Android/iOS, WebView, stylus or OS-permission claim"] };
  report.environment={cliVersion:cli('version').trim(),...evaluate("JSON.stringify({versions:require('process').versions,platform:require('process').platform,userAgent:navigator.userAgent})")};
  report.fixture={id:'Drawings/Uncompressed.excalidraw.md',sha256:createHash('sha256').update(fixture).digest('hex')};
  mkdirSync(reportDir, { recursive: true }); writeFileSync(join(reportDir, "recovery.json"), JSON.stringify({ vaultName, path, original }, null, 2));
  let debuggerSession, currentMobile = original.mobile, created = false;
  report.reloadDiagnostics = [];
  const ready = () => waitForNativeReady(cli, { diagnostics: report.reloadDiagnostics });
  try {
    evaluate(`(()=>{const w=${owner};if(w.id!==${original.id})throw Error('Main owner changed');w.setFullScreen(false);w.unmaximize();w.setMinimumSize(200,200);w.webContents.setZoomFactor(1);return JSON.stringify(true);})()`);
    await runInAppTask({ cli, args: [path, fixture], execute: async (_c, path, fixture) => {
      if (app.vault.getFileByPath(path)) throw Error("Device fixture collision"); await app.vault.create(path, fixture); return { created: true };
    } }); created = true;
    for (const profile of profiles) {
      // Resize the actual main owner, rather than merely changing CSS width.
      evaluate(`(()=>{const w=${owner};if(w.id!==${original.id})throw Error('Main owner changed');w.setContentSize(${profile.width},${profile.height});w.show();w.focus();w.webContents.focus();return JSON.stringify(true);})()`);
      if (currentMobile !== profile.mobile) {
        cli("dev:mobile", profile.mobile ? "on" : "off"); currentMobile = profile.mobile; await ready();
      }
      evaluate(`(()=>{app.changeTheme(${JSON.stringify(profile.theme === "dark" ? "obsidian" : "moonstone")});return JSON.stringify(true);})()`);
      debuggerSession = acquireDebuggerSession(cli);
      cli("dev:cdp", "method=Emulation.setTouchEmulationEnabled", `params=${JSON.stringify({ enabled: profile.input === "touch", maxTouchPoints: profile.input === "touch" ? 5 : 1 })}`);
      const result = await runInAppTask({ cli, execute: exerciseDevice, args: [path, fixture, profile], timeoutMs: 60_000,
        onRequest: request => {
          if (request.method === "resize-editor" && Number.isSafeInteger(request.params.delta) && Math.abs(request.params.delta) <= 32) {
            evaluate(`(()=>{const w=${owner};if(w.id!==${original.id})throw Error('Main owner changed');const [width,height]=w.getContentSize();w.setContentSize(width+${request.params.delta},height);return JSON.stringify(true);})()`); return { resized: true };
          }
          if (request.method === "screenshot" && request.params.id === profile.id) { cli("dev:screenshot", "path=" + join(reportDir, profile.id + ".png")); return { captured: true }; }
          if (request.method !== "cdp" || !["Input.dispatchMouseEvent", "Input.dispatchTouchEvent"].includes(request.params.method)) throw Error("Unexpected device input request");
          cli("dev:cdp", "method=" + request.params.method, "params=" + JSON.stringify(request.params.params)); return { dispatched: true };
        } });
      const errors = debuggerSession.read(); assert.deepEqual(unexpectedConsoleErrors(errors), [], "Unexpected device console/JavaScript error");
      debuggerSession.dispose(); debuggerSession = null;
      report.tests.push({ testId: "native:device:" + profile.id, featureIds: ["P07", "P08"], status: "passed", ...result });
    }
    report.status = "passed";
  } catch (error) {
    report.error = String(error.stack || error);
    report.tests.push({ testId: "native:device:" + (profiles[report.tests.length]?.id || "setup"), featureIds: ["P07", "P08"], status: "failed", reason: report.error });
    if (error.cleanupFailed) report.unsettledTask = true;
  } finally {
    try {
      let debuggerError;
      if (debuggerSession) { try { debuggerSession.dispose(); } catch (error) { debuggerError=error; } finally { debuggerSession=null; } }
      report.restoration = await restoreDeviceState({ cli, original, path, created });
      if (debuggerError) throw debuggerError;
      report.cleanup = report.unsettledTask ? "failed" : "passed";
    } catch (error) { report.cleanup = "failed"; report.cleanupError = String(error.stack || error); }
    if (report.cleanup !== "passed") report.status = "failed";
    writeFileSync(join(reportDir, "report.json"), JSON.stringify(report, null, 2) + "\n"); writeReportFiles(report, reportDir);
  }
  return report;
}

async function exerciseDevice(c, path, fixture, profile) {
  const p = app.plugins.plugins["obsidian-excalidraw-plugin"], doc = app.workspace.containerEl.ownerDocument;
  await c.waitFor(() => innerWidth === profile.width && innerHeight === profile.height, "actual requested viewport");
  const check = (condition, message) => { if (!condition) throw Error(message); };
  const settings = Object.fromEntries(["desktopUIMode", "tabletUIMode", "phoneUIMode", "penModeSingleFingerPanning"].map(key => [key, p.settings[key]]));
  const desktopMode = localStorage.getItem("excalidraw.desktopUIMode");
  c.defer(() => { Object.assign(p.settings, settings); if (desktopMode === null) localStorage.removeItem("excalidraw.desktopUIMode"); else localStorage.setItem("excalidraw.desktopUIMode", desktopMode); });
  let anchor; app.workspace.iterateAllLeaves(leaf => { if (!anchor && leaf.getRoot() === app.workspace.rootSplit) anchor = leaf; });
  check(anchor, "Main workspace anchor missing"); app.workspace.setActiveLeaf(anchor, { focus: true }); doc.defaultView.focus();
  // A mode reload can restore the previous debounced workspace snapshot. Retire
  // only this task's restored drawing before resetting its owned file; otherwise
  // that live editor can reconcile old link IDs into the fresh seed.
  const restoredOwned = [];
  app.workspace.iterateAllLeaves(leaf => { if (leaf.view.file?.path === path && ["excalidraw", "markdown"].includes(leaf.view.getViewType())) restoredOwned.push(leaf); });
  for (const leaf of restoredOwned) {
    check(leaf.view.containerEl.ownerDocument === doc, "Restored device drawing unexpectedly belongs to a popout");
    await leaf.setViewState({ type: "empty", state: {} }); leaf.detach();
  }
  const file = app.vault.getFileByPath(path); check(file, "Owned device fixture missing"); await app.vault.modify(file, fixture);
  p.settings.desktopUIMode = profile.mode === "mobile" ? "tray" : profile.mode;
  p.settings.tabletUIMode = profile.mode === "mobile" ? "compact" : profile.mode;
  p.settings.phoneUIMode = profile.boundary ? "mobile" : profile.mode; p.settings.penModeSingleFingerPanning = false;
  const leaf = app.workspace.getLeaf("tab");
  c.defer(async () => { await leaf.setViewState({ type: "empty", state: {} }); leaf.detach(); });
  await leaf.openFile(file);
  await c.waitFor(() => leaf.view.excalidrawAPI && !leaf.view.semaphores.justLoaded && !leaf.view.isClosingOrMigrating(), "device editor first commit");
  const view = leaf.view, api = view.excalidrawAPI;
  check(view.ownerDocument === doc, "Device drawing opened in a popout");
  check(api.getSceneElements().length === 2, "Device seed did not reset to exactly two elements");
  const paneBefore = view.containerEl.getBoundingClientRect().toJSON();
  if (profile.pane === "fullscreen") {
    view.gotoFullscreen(); c.defer(() => { view.exitFullscreen(); check(!view.isFullscreen(), "Owned fullscreen did not restore"); });
    await c.waitFor(() => view.isFullscreen() && view.containerEl.querySelector("canvas.interactive").getBoundingClientRect().width >= innerWidth - 100, "owned fullscreen viewport");
  }
  if (profile.editorWidth !== undefined) {
    const width = view.containerEl.querySelector(".excalidraw").getBoundingClientRect().width;
    if (width !== profile.editorWidth) await c.requestHost("resize-editor", { delta: Math.round(profile.editorWidth - width) });
    await c.waitFor(() => view.containerEl.querySelector(".excalidraw").getBoundingClientRect().width === profile.editorWidth, "exact editor breakpoint width");
  }
  view.setUIMode(profile.mode === "mobile" ? "tray" : profile.mode); view.setTheme(profile.theme);
  api.updateScene({ appState: { penMode: false, viewModeEnabled: false }, captureUpdate: "NEVER" });
  await c.waitFor(() => doc.body.hasClass(profile.theme === "dark" ? "theme-dark" : "theme-light") && api.getAppState().theme === profile.theme, "actual host and drawing themes");
  try { await c.waitFor(() => api.getEditorInterface().formFactor === profile.formFactor, "measured device classification"); }
  catch (error) { throw Error(error.message + ": " + JSON.stringify({ viewport: { width: innerWidth, height: innerHeight }, editor: api.getEditorInterface(), device: p.getObsidianDevice() })); }
  if (profile.canFitSidebar !== undefined) check(api.getEditorInterface().canFitSidebar === profile.canFitSidebar, "Sidebar breakpoint differs");
  const rect = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
  const button = [...view.containerEl.querySelectorAll('[data-testid="toolbar-rectangle"]')].find(element => !element.closest(".tool-popover-content") && element.getBoundingClientRect().width > 0);
  check(button, "Rectangle tool is not reachable");
  const bounds = rect(button), x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
  check(bounds.x >= 0 && bounds.y >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight, "Rectangle tool is clipped");
  check(doc.elementFromPoint(x, y)?.closest("button") === button, "Rectangle tool is covered");
  const input = async (type, x, y) => {
    if (profile.input === "touch") await c.requestHost("cdp", { method: "Input.dispatchTouchEvent", params: { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] } });
    else await c.requestHost("cdp", { method: "Input.dispatchMouseEvent", params: { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1 } });
  };
  await input(profile.input === "touch" ? "touchStart" : "mousePressed", x, y); await input(profile.input === "touch" ? "touchEnd" : "mouseReleased", x, y);
  await c.waitFor(() => api.getAppState().activeTool.type === "rectangle", "trusted toolbar selection");
  if (!profile.boundary) await c.waitFor(() => {
    const root = view.containerEl.querySelector(".excalidraw"), compact = view.containerEl.querySelector(".compact-shape-actions");
    if (profile.mode === "mobile") return root.classList.contains("excalidraw--mobile");
    if (profile.mode === "tray") return root.classList.contains("excalidraw--tray") && !!view.containerEl.querySelector(".App-top-bar");
    if (profile.mode === "compact") return !!compact && compact.getBoundingClientRect().width > 0;
    return !compact && !root.classList.contains("excalidraw--tray") && !!view.containerEl.querySelector(".selected-shape-actions");
  }, "actual requested layout");
  const canvas = view.containerEl.querySelector("canvas.interactive"), canvasBounds = rect(canvas), events = [];
  await c.requestHost("screenshot", { id: profile.id });
  const listener = event => { if (event.target === canvas) events.push({ trusted: event.isTrusted, pointerType: event.pointerType }); };
  doc.addEventListener("pointerdown", listener, true); c.defer(() => doc.removeEventListener("pointerdown", listener, true));
  let start, end;
  try { await c.waitFor(() => {
    for (const [x, y] of [[0.65, 0.5], [0.6, 0.4], [0.7, 0.6]]) {
      const a = { x: canvasBounds.x + canvasBounds.width * x, y: canvasBounds.y + canvasBounds.height * y };
      const b = { x: a.x + Math.min(80, canvasBounds.width * 0.2), y: a.y + Math.min(60, canvasBounds.height * 0.18) };
      if (doc.elementFromPoint(a.x, a.y) === canvas && doc.elementFromPoint(b.x, b.y) === canvas) { start = a; end = b; return true; }
    }
    return false;
  }, "uncovered canvas drawing area"); }
  catch (error) { throw Error(error.message + ": " + JSON.stringify({ canvas: canvasBounds, hits: [[0.65, 0.5], [0.6, 0.4], [0.7, 0.6]].map(([x,y]) => doc.elementFromPoint(canvasBounds.x + canvasBounds.width*x,canvasBounds.y + canvasBounds.height*y)?.outerHTML.slice(0,180)) })); }
  if (profile.input === "mouse") await input("mouseMoved", start.x, start.y);
  await input(profile.input === "touch" ? "touchStart" : "mousePressed", start.x, start.y);
  await input(profile.input === "touch" ? "touchMove" : "mouseMoved", end.x, end.y);
  await input(profile.input === "touch" ? "touchEnd" : "mouseReleased", end.x, end.y);
  try { await c.waitFor(() => api.getSceneElements().length === 3, "trusted drawing input"); }
  catch (error) { throw Error(error.message + ": " + JSON.stringify({ count: api.getSceneElements().length, events, activeTool: api.getAppState().activeTool, newElement: api.getAppState().newElement?.type, penMode: api.getAppState().penMode, focused: doc.hasFocus(), start, end })); }
  check(events.some(event => event.trusted && event.pointerType === profile.input), "Input was not trusted or had the wrong pointer type");
  await c.waitFor(() => view.isDirty(), "device edit dirty state");
  check((await view.saveWithOutcome()).status === "persisted", "Device edit did not save");
  check((await p.ea.getSceneFromFile(file)).elements.length === 3, "Device disk round trip lost elements");
  check((app.isMobile === true) === profile.mobile, "Narrow desktop/mobile mode confused");
  await c.requestHost("screenshot", { id: profile.id });
  return { assertions: ["actual Obsidian mobile/desktop mode", "measured editor classification", "actual host and drawing theme", "visible uncovered tool", "trusted pointer selects and draws", "device edit saves to disk"],
    requested: profile, actual: { viewport: { width: innerWidth, height: innerHeight }, retiredRestoredOwnedEditors: restoredOwned.length, paneBefore, fullscreen: view.isFullscreen(), editorBounds: rect(view.containerEl.querySelector(".excalidraw")), canvas: canvasBounds, tool: bounds, editorInterface: api.getEditorInterface(), hostDevice: p.getObsidianDevice(), mobile: app.isMobile === true,
      maxTouchPoints: navigator.maxTouchPoints, coarsePointer: matchMedia("(pointer: coarse)").matches, events } };
}
