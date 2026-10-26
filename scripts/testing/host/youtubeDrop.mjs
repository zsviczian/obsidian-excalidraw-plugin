/** Opt-in network smoke for the exact YouTube link reported during #2992 testing. */
import assert from "node:assert/strict";

async function exercise(control, drawingPath) {
  const c = globalThis[control], plugin = app.plugins.plugins["obsidian-excalidraw-plugin"];
  const main = app.workspace.getLeavesOfType("excalidraw").find(leaf => leaf.view.file?.path === drawingPath);
  const previous = structuredClone(plugin.settings.modifierKeyConfig);
  const existingFiles = new Set(app.vault.getFiles().map(file => file.path));
  const video = "https://www.youtube.com/watch?v=p3Qc3Hho_Lc&pp=ugUHEgVlbi1HQg%3D%3D";
  const thumbnail = "https://i.ytimg.com/vi/p3Qc3Hho_Lc/hqdefault.jpg";
  c.attachments = []; c.results = [];
  const waitFor = async (predicate, label) => {
    for (let i = 0; i < 300; i++) {
      if (c.cancelled) throw Error("YouTube-drop scenario cancelled");
      if (predicate()) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw Error(`Timed out: ${label}`);
  };
  try {
    for (const popout of [false, true]) {
      let leaf = main;
      if (popout) {
        leaf = app.workspace.openPopoutLeaf(); c.pop = leaf;
        await leaf.setViewState({ type: "excalidraw", state: { file: drawingPath } });
        await waitFor(() => leaf.view.excalidrawAPI, "popout API");
      }
      let view = leaf.view;
      app.workspace.setActiveLeaf(leaf, { focus: true });
      for (const action of ["image-url", "image-import"]) {
        for (const payload of ["link", "thumbnail"]) {
          for (const os of ["Mac", "Win"]) {
            plugin.settings.modifierKeyConfig[os].WebBrowserDragAction = { defaultAction: action, rules: [] };
          }
          const transfer = new view.ownerWindow.DataTransfer();
          transfer.setData("text/plain", video);
          transfer.setData("text/uri-list", video);
          transfer.setData("text/html", `<a href="${video}">${payload === "thumbnail" ? `<img src="${thumbnail}">` : "YouTube video"}</a>`);
          // A supplied File exercises browser mixed-payload routing. Thumbnail
          // bytes must come from the real resolver, not this intentionally empty File.
          if (payload === "thumbnail") transfer.items.add(new view.ownerWindow.File([], "browser-thumbnail.jpg", { type: "image/jpeg" }));
          const before = new Set(view.getViewElements().map(element => element.id));
          if (view.dropManager.onDrop({ dataTransfer: transfer, clientX: 300, clientY: 300, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false }) !== false) throw Error("YouTube drop not consumed");
          let element, embedded, binary;
          await waitFor(() => {
            element = view.getViewElements().find(element => !before.has(element.id) && element.type === "image");
            embedded = element && view.excalidrawData.getFile(element.fileId);
            binary = element && view.excalidrawAPI.getFiles()[element.fileId];
            return embedded && binary;
          }, "YouTube thumbnail insertion");
          if (element.link !== video) throw Error("video navigation URL changed");
          if (action === "image-url") {
            if (!embedded.isHyperLink || !embedded.hyperlink.startsWith("https://i.ytimg.com/vi/p3Qc3Hho_Lc/")) throw Error("thumbnail is missing the /vi/ path");
          } else {
            if (!embedded.file) throw Error("thumbnail import has no vault attachment");
            if (!existingFiles.has(embedded.file.path)) c.attachments.push(embedded.file.path);
            const bytes = new Uint8Array(await app.vault.readBinary(embedded.file));
            if (bytes[0] !== 255 || bytes[1] !== 216) throw Error("import is not JPEG data");
          }
          const bitmap = new view.ownerWindow.Image();
          bitmap.src = binary.dataURL;
          await bitmap.decode();
          if (bitmap.naturalWidth <= 120 || bitmap.naturalHeight <= 90) throw Error("thumbnail decoded a missing-image placeholder");
          const id = element.id;
          await view.forceSave(true, true);
          await leaf.setViewState({ type: "empty", state: {} });
          await leaf.setViewState({ type: "excalidraw", state: { file: drawingPath } });
          await waitFor(() => leaf.view.excalidrawAPI, "reopen API");
          view = leaf.view;
          const reopened = view.getViewElements().find(element => element.id === id);
          if (reopened?.link !== video || !view.excalidrawData.getFile(reopened.fileId)) throw Error("thumbnail missing after reopen");
          c.results.push({ window: popout ? "popout" : "main", action, payload, width: bitmap.naturalWidth, height: bitmap.naturalHeight, reopen: true });
        }
      }
      if (c.pop) { await c.pop.setViewState({ type: "empty", state: {} }); c.pop.detach(); c.pop = null; }
      app.workspace.setActiveLeaf(main, { focus: true });
    }
  } finally {
    plugin.settings.modifierKeyConfig = previous;
    let cleanupError;
    try {
      if (c.pop) { await c.pop.setViewState({ type: "empty", state: {} }); c.pop.detach(); }
      if (main.view.excalidrawAPI) {
        main.view.excalidrawAPI.updateScene({ elements: [], captureUpdate: "NEVER" });
        await main.view.forceSave(true, true);
        app.workspace.setActiveLeaf(main, { focus: true });
      }
    } catch (error) { cleanupError = error; }
    for (const path of c.attachments) {
      try { const file = app.vault.getFileByPath(path); if (file) await app.vault.delete(file); }
      catch (error) { cleanupError ??= error; }
    }
    if (cleanupError) throw cleanupError;
  }
}

export async function runYouTubeDropScenario({ cli, drawingPath }) {
  const control = "__excalidrawYouTubeDrop";
  const evaluate = code => JSON.parse(cli("eval", `code=${code}`).trim().replace(/^=>\s*/, ""));
  const state = () => evaluate(`JSON.stringify({state:globalThis.${control}?.state,error:globalThis.${control}?.error,results:globalThis.${control}?.results})`);
  let started = false;
  try {
    evaluate(`(()=>{if(globalThis.${control})throw Error("YouTube-drop controller exists");const c=globalThis.${control}={state:"pending"};(${exercise.toString()})(${JSON.stringify(control)},${JSON.stringify(drawingPath)}).then(()=>c.state="done").catch(error=>{c.state="failed";c.error=error.stack});return JSON.stringify({started:true})})()`);
    started = true;
    let result;
    for (let i = 0; i < 1800; i++) {
      result = state();
      if (result.state !== "pending") break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(result.state, "done", result.error ?? "YouTube-drop scenario timed out");
    return { id: "youtube-drop-thumbnail", status: "passed", cases: result.results };
  } finally {
    if (started) {
      if (state().state === "pending") {
        cli("eval", `code=globalThis.${control}.cancelled=true`);
        for (let i = 0; i < 250 && state().state === "pending"; i++) await new Promise(resolve => setTimeout(resolve, 100));
        assert.notEqual(state().state, "pending", "YouTube-drop scenario did not finish cleanup");
      }
      cli("eval", `code=delete globalThis.${control}`);
    }
  }
}
