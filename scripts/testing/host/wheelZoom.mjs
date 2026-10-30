/** #3008: real wheel events must use live plugin zoom limits in each document. */
import assert from "node:assert/strict";
import { runLegacyTask } from './legacyTask.mjs';

async function exercise(control, drawingPath) {
  const c = globalThis[control];
  const plugin = app.plugins.plugins["obsidian-excalidraw-plugin"];
  const main = app.workspace.getLeavesOfType("excalidraw").find(l => l.view.file?.path === drawingPath);
  const previous = { min: plugin.settings.zoomMin, max: plugin.settings.zoomMax };
  c.results = [];
  try {
    plugin.settings.zoomMin = 0.01;
    plugin.settings.zoomMax = 50;
    for (const popout of [false, true]) {
      let leaf = main;
      if (popout) {
        leaf = app.workspace.openPopoutLeaf(); c.pop = leaf;
        await leaf.setViewState({ type: "excalidraw", state: { file: drawingPath } });
        for (let i = 0; i < 200 && !leaf.view.excalidrawAPI; i++) await new Promise(resolve => setTimeout(resolve, 25));
      }
      const view = leaf.view, api = view.excalidrawAPI;
      const canvas = view.containerEl.querySelector("canvas.excalidraw__canvas.interactive") ?? view.containerEl.querySelector("canvas.excalidraw__canvas");
      if (!canvas) throw Error("interactive canvas missing");
      const tick = async deltaY => {
        canvas.dispatchEvent(new view.ownerWindow.WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY }));
        await new Promise(resolve => setTimeout(resolve, 30));
      };
      const zoom = () => api.getAppState().zoom.value;
      const constraints = { x: 0, y: 0, width: 100000, height: 100000, lockScroll: false, lockZoom: false, zoom: 1, overscroll: 0 };
      api.updateScene({ appState: { allowWheelZoom: true, inputDevice: "trackpad", zoom: { value: 0.1 }, scrollConstraints: constraints }, captureUpdate: "NEVER" });
      for (let i = 0; i < 6; i++) await tick(100);
      if (zoom() !== 0.01) throw Error(`wheel minimum: ${zoom()}`);
      await tick(100);
      if (zoom() !== 0.01) throw Error(`wheel snapped back: ${zoom()}`);
      await tick(-1);
      if (zoom() <= 0.01 || zoom() >= 0.1) throw Error(`zoom-in below 10%: ${zoom()}`);
      plugin.settings.zoomMin = 0.2;
      await tick(100);
      if (zoom() !== 0.2) throw Error(`live wheel minimum: ${zoom()}`);
      plugin.settings.zoomMin = 0.01;
      api.updateScene({ appState: { zoom: { value: 29.99 } }, captureUpdate: "NEVER" });
      await tick(-100);
      if (zoom() <= 30) throw Error(`host maximum above 3000% rejected: ${zoom()}`);
      plugin.settings.zoomMax = 5;
      await tick(-100);
      if (zoom() !== 5) throw Error(`live wheel maximum: ${zoom()}`);
      plugin.settings.zoomMax = 50;
      api.updateScene({ appState: { scrollConstraints: null, zoom: { value: 1 } }, captureUpdate: "NEVER" });
      c.results.push({ window: popout ? "popout" : "main", minimum: 0.01, maximum: 5, liveSettings: true, scrollConstraints: true });
      if (c.pop) { await c.pop.setViewState({ type: "empty", state: {} }); c.pop.detach(); c.pop = null; }
    }
  } finally {
    plugin.settings.zoomMin = previous.min;
    plugin.settings.zoomMax = previous.max;
    if (c.pop) { await c.pop.setViewState({ type: "empty", state: {} }); c.pop.detach(); }
  }
}

/** Restores the live settings without persisting test values. */
export async function runWheelZoomScenario({ cli, drawingPath }) {
  assert.ok(drawingPath.startsWith('__excalidraw_cli_smoke_'));
  const control = "__excalidrawWheelZoom";
  const result=await runLegacyTask({cli,control,execute:exercise,args:[drawingPath]});
  return { id: "wheel-zoom-3008", status: "passed", cases: result.results };
}
