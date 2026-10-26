/** #2967: mixed browser/file drops against an owned local PNG server. */
import assert from "node:assert/strict";
import { createServer } from "node:http";

async function exercise(control, drawingPath, imageURL) {
  const c = globalThis[control], plugin = app.plugins.plugins["obsidian-excalidraw-plugin"];
  const main = app.workspace.getLeavesOfType("excalidraw").find(l => l.view.file?.path === drawingPath);
  const previous = structuredClone(plugin.settings.modifierKeyConfig);
  c.attachments = []; c.results = []; c.ownedIds = [];
  const waitFor = async (predicate, label) => {
    for (let i = 0; i < 200; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 50)); }
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
        for (const os of ["Mac", "Win"]) {
          plugin.settings.modifierKeyConfig[os].WebBrowserDragAction = { defaultAction: action, rules: [] };
          plugin.settings.modifierKeyConfig[os].LocalFileDragAction = { defaultAction: action === "image-url" ? "image-import" : "image-url", rules: [] };
        }
        const before = new Set(view.getViewElements().map(el => el.id));
        const transfer = new view.ownerWindow.DataTransfer();
        transfer.items.add(new view.ownerWindow.File([new Uint8Array([1])], "browser-cache.png", { type: "image/png" }));
        transfer.setData("text/uri-list", `# image source\r\n${imageURL}\r\n`);
        const result = view.dropManager.onDrop({ dataTransfer: transfer, clientX: 300, clientY: 300, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false });
        if (result !== false) throw Error("mixed drop was not consumed");
        let image, embedded;
        await waitFor(() => {
          image = view.getViewElements().find(el => !before.has(el.id) && el.type === "image");
          embedded = image && view.excalidrawData.getFile(image.fileId);
          return image && embedded;
        }, `insert ${action}`);
        c.ownedIds.push(image.id);
        if (action === "image-url") {
          if (!embedded.isHyperLink || embedded.hyperlink !== imageURL) throw Error("URL action imported a local file");
        } else {
          if (!embedded.file || !app.vault.getFileByPath(embedded.file.path)) throw Error("import action did not write a vault attachment");
          c.attachments.push(embedded.file.path);
          const bytes = await app.vault.readBinary(embedded.file);
          if (new Uint8Array(bytes)[0] !== 137) throw Error("attachment is not the served PNG");
        }
        await view.forceSave(true, true);
        await leaf.setViewState({ type: "empty", state: {} });
        await leaf.setViewState({ type: "excalidraw", state: { file: drawingPath } });
        await waitFor(() => leaf.view.excalidrawAPI, "reopen API");
        view = leaf.view;
        const reopened = view.getViewElements().find(el => el.id === image.id);
        if (!reopened) throw Error("dropped image missing after reopen");
        c.results.push({ window: popout ? "popout" : "main", action, storedAs: action === "image-import" ? "vault-file" : "URL", reopen: true });
      }
      if (c.pop) { await c.pop.setViewState({ type: "empty", state: {} }); c.pop.detach(); c.pop = null; }
    }
  } finally {
    plugin.settings.modifierKeyConfig = previous;
    if (c.pop) { await c.pop.setViewState({ type: "empty", state: {} }); c.pop.detach(); }
    // The parent runner owns the drawing. Remove these exact owned image
    // elements before deleting only attachments created by this scenario.
    if (main.view.excalidrawAPI) {
      main.view.excalidrawAPI.updateScene({ elements: main.view.getViewElements().filter(el => !c.ownedIds.includes(el.id)), captureUpdate: "NEVER" });
      await main.view.forceSave(true, true);
    }
    for (const path of c.attachments) { const file = app.vault.getFileByPath(path); if (file) await app.vault.delete(file); }
  }
}

/** No external service is contacted; the server and owned fixtures are closed. */
export async function runWebDropScenario({ cli, drawingPath }) {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3f8AAAAASUVORK5CYII=", "base64");
  const server = createServer((_request, response) => { response.writeHead(200, { "Content-Type": "image/png" }); response.end(png); });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const imageURL = `http://127.0.0.1:${server.address().port}/excalidraw-drop-${Date.now()}.png`;
  const control = "__excalidrawWebDrop";
  const evaluate = code => JSON.parse(cli("eval", `code=${code}`).trim().replace(/^=>\s*/, ""));
  try {
    evaluate(`(()=>{if(globalThis.${control})throw Error("web-drop controller exists");const c=globalThis.${control}={state:"pending"};(${exercise.toString()})(${JSON.stringify(control)},${JSON.stringify(drawingPath)},${JSON.stringify(imageURL)}).then(()=>c.state="done").catch(e=>{c.state="failed";c.error=e.stack});return JSON.stringify({started:true})})()`);
    let result;
    for (let i = 0; i < 400; i++) {
      result = evaluate(`JSON.stringify({state:globalThis.${control}.state,error:globalThis.${control}.error,results:globalThis.${control}.results})`);
      if (result.state !== "pending") break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(result.state, "done", result.error ?? "web-drop scenario timed out");
    return { id: "web-drop-2967", status: "passed", cases: result.results };
  } finally {
    cli("eval", `code=delete globalThis.${control}`);
    await new Promise(resolve => server.close(resolve));
  }
}
