/** Restore independent state even when another restoration step fails. */
import assert from "node:assert/strict";
import { parseCLIJSON, runInAppTask } from "./inAppTask.mjs";
import { waitForNativeReady } from "./hostReadiness.mjs";
export const mainWindowExpression = "app.workspace.containerEl.ownerDocument.defaultView.require('@electron/remote').getCurrentWindow()";

export async function restoreDeviceState({ cli, original, path, created }) {
  assert.match(path, /^__excalidraw_cli_smoke_devices_[a-f0-9-]{36}\.excalidraw\.md$/);
  const evaluate = code => parseCLIJSON(cli("eval", "code=" + code)), errors = [];
  const attempt = async (label, callback) => { try { return await callback(); } catch (error) { errors.push(`${label}: ${error.stack || error}`); } };
  await attempt("mobile mode", async () => {
    const state = await waitForNativeReady(cli);
    if (state.mobile !== original.mobile) { cli("dev:mobile", original.mobile ? "on" : "off"); await waitForNativeReady(cli); }
  });
  await attempt("owned fixture and layout", () => runInAppTask({ cli, args: [path, created, original.layout], execute: async (_c, path, created, layout) => {
    for (const leaf of app.workspace.getLeavesOfType("excalidraw").filter(leaf => leaf.view.file?.path === path)) {
      if (leaf.view.ownerDocument !== app.workspace.containerEl.ownerDocument) throw Error("Device fixture unexpectedly belongs to a popout");
      await leaf.setViewState({ type: "empty", state: {} }); leaf.detach();
    }
    const file = app.vault.getFileByPath(path);
    if (created && file) await app.vault.delete(file, true);
    await app.workspace.changeLayout(layout);
    return { removed: !app.vault.getFileByPath(path) };
  } }));
  await attempt("theme, preference and geometry", () => evaluate(`(()=>{const w=${mainWindowExpression};if(w.id!==${original.id})throw Error('Main owner changed');app.changeTheme(${JSON.stringify(original.theme)});${original.desktopMode === null ? "localStorage.removeItem('excalidraw.desktopUIMode');" : `localStorage.setItem('excalidraw.desktopUIMode',${JSON.stringify(original.desktopMode)});`}w.webContents.setZoomFactor(${original.zoom ?? 1});w.setBounds(${JSON.stringify(original.bounds)});w.setMinimumSize(...${JSON.stringify(original.minimum)});${original.maximized ? "w.maximize();" : ""}${original.fullscreen ? "w.setFullScreen(true);" : ""}return JSON.stringify(true);})()`));
  await attempt("restoration verification", async () => {
    const state = evaluate(`JSON.stringify((()=>{const w=${mainWindowExpression};return{mobile:app.isMobile===true,theme:app.vault.getConfig('theme'),desktopMode:localStorage.getItem('excalidraw.desktopUIMode'),id:w.id,minimum:w.getMinimumSize(),maximized:w.isMaximized(),fullscreen:w.isFullScreen(),zoom:w.webContents.getZoomFactor(),touch:{maxTouchPoints:navigator.maxTouchPoints,coarse:matchMedia('(pointer: coarse)').matches,hover:matchMedia('(hover: hover)').matches}};})())`);
    for (const key of ["mobile", "theme", "desktopMode", "id", "minimum", "maximized", "fullscreen", ...(original.zoom === undefined ? [] : ["zoom"]), ...(original.touch ? ["touch"] : [])]) assert.deepEqual(state[key], original[key], `Restoration differs: ${key}`);
  });
  if (errors.length) throw new AggregateError(errors.map(error => Error(error)), "Device restoration failed: " + errors.join("; "));
  return { restored: true };
}
