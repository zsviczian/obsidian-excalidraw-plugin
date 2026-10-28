/** Internal file tooltip/action agreement using Obsidian's real drag payload factory. */
import assert from "node:assert/strict";
import {runLegacyTask} from "./legacyTask.mjs";

async function exercise(control, drawingPath, pngBase64, includePopout) {
  const c = globalThis[control];
  const main = app.workspace.getLeavesOfType("excalidraw").find(leaf => leaf.view.file?.path === drawingPath);
  const previousDrag = app.dragManager.draggable;
  if (previousDrag) throw Error("an existing user drag is in progress");
  const suffix = crypto.randomUUID();
  c.files = []; c.results = [];
  const waitFor = async (predicate, label) => {
    for (let i = 0; i < 200; i++) {
      if (c.cancelled) throw Error("internal-drop scenario cancelled");
      if (predicate()) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw Error(`Timed out: ${label}`);
  };
  const png = Uint8Array.from(atob(pngBase64), char => char.charCodeAt(0));
  try {
    for (const [extension, bytes] of [["ttf", new Uint8Array([0])], ["png", png]]) {
      const path = `__excalidraw_internal_drop_${suffix}.${extension}`;
      if (app.vault.getFileByPath(path)) throw Error("owned file already exists");
      c.files.push(await app.vault.createBinary(path, bytes.buffer));
    }
    const [font, image] = c.files;
    for (const popout of includePopout ? [false,true] : [false]) {
      let leaf = main;
      if (popout) {
        leaf = app.workspace.openPopoutLeaf(); c.pop = leaf;
        await leaf.setViewState({ type: "excalidraw", state: { file: drawingPath } });
        await waitFor(() => leaf.view.excalidrawAPI, "popout API");
      }
      let view = leaf.view;
      app.workspace.setActiveLeaf(leaf, { focus: true });
      const ids = [];
      let linkTooltip;
      for (const [file, keys] of [[font, {}], [font, { shiftKey: true }], [font, { shiftKey: true, ctrlKey: true }], [font, { ctrlKey: true }], [image, { shiftKey: true }]]) {
        const transfer = new view.ownerWindow.DataTransfer();
        const event = new view.ownerWindow.DragEvent("dragover", {
          dataTransfer: transfer, clientX: 300, clientY: 300, cancelable: true,
          shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...keys,
        });
        // Use Obsidian's own file payload instead of a hand-written descriptor.
        app.dragManager.draggable = app.dragManager.dragFile(event, file);
        view.dropManager.onDragOver(event);
        const tooltip = view.ownerDocument.querySelector(".excalidraw-draginfo")?.innerText;
        if (!tooltip) throw Error("internal tooltip missing");
        if (file === font) {
          linkTooltip ??= tooltip;
          if (tooltip !== linkTooltip || tooltip.includes("\n")) throw Error("font advertises an unsupported drop action");
        } else if (tooltip === linkTooltip) throw Error("valid Shift-image drop advertises a link");
        const before = new Set(view.getViewElements().map(element => element.id));
        if (view.dropManager.onDrop(event) !== false) throw Error("internal drop was not consumed");
        app.dragManager.draggable = previousDrag;
        let element;
        await waitFor(() => {
          element = view.getViewElements().find(element => !before.has(element.id));
          return element;
        }, "internal insertion");
        if (file === font) {
          if (element.type !== "text" || !element.text.includes(font.basename)) throw Error("font did not insert a link");
        } else {
          if (element.type !== "image" || view.excalidrawData.getFile(element.fileId)?.file?.path !== image.path) throw Error("Shift-image did not retain the vault image");
        }
        ids.push({ id: element.id, type: element.type });
        c.results.push({ window: popout ? "popout" : "main", extension: file.extension, keys, tooltip, inserted: element.type });
      }
      await view.forceSave(true, true);
      await leaf.setViewState({ type: "empty", state: {} });
      await leaf.setViewState({ type: "excalidraw", state: { file: drawingPath } });
      await waitFor(() => leaf.view.excalidrawAPI, "reopen API");
      view = leaf.view;
      for (const expected of ids) {
        if (!view.getViewElements().some(element => element.id === expected.id && element.type === expected.type)) throw Error("internal insertion changed after reopen");
      }
      if (c.pop) { await c.pop.setViewState({ type: "empty", state: {} }); c.pop.detach(); c.pop = null; }
      app.workspace.setActiveLeaf(main, { focus: true });
    }
  } finally {
    app.dragManager.draggable = previousDrag;
    let cleanupError;
    try {
      if (c.pop) { await c.pop.setViewState({ type: "empty", state: {} }); c.pop.detach(); }
      if (main.view.excalidrawAPI) {
        main.view.dropManager.onDragLeave();
        main.view.excalidrawAPI.updateScene({ elements: [], captureUpdate: "NEVER" });
        await main.view.forceSave(true, true);
        app.workspace.setActiveLeaf(main, { focus: true });
      }
    } catch (error) { cleanupError = error; }
    for (const file of c.files) {
      try { if (app.vault.getFileByPath(file.path)) await app.vault.delete(file); }
      catch (error) { cleanupError ??= error; }
    }
    if (cleanupError) { const error=Error('Internal-drop cleanup failed: '+String(cleanupError));error.cleanupFailed=true;throw error; }
  }
}

export async function runInternalDropScenario({cli,drawingPath,includePopout=true}) {
  assert.ok(drawingPath.startsWith('__excalidraw_cli_smoke_'));
  const png="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3f8AAAAASUVORK5CYII=";
  const result=await runLegacyTask({cli,control:'__excalidrawInternalDrop',execute:exercise,args:[drawingPath,png,includePopout],timeoutMs:180000});
  return{id:'internal-drop-tooltip',status:'passed',input:'synthetic DragEvent with actual Obsidian drag payload',cases:result.results,reopen:true};
}
