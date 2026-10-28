/** Real Vault/scene/backup persistence; edits only the parent runner's UUID-owned copy. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInAppTask } from "./inAppTask.mjs";

export async function runDataIntegrityScenario({ cli, drawingPath }) {
  assert.ok(drawingPath.startsWith("__excalidraw_cli_smoke_"));
  const prefix = drawingPath.replace(/\.(excalidraw\.md|excalidraw|md)$/, "") + "_data";
  const fixtures = ["Uncompressed.excalidraw.md", "Compressed.excalidraw.md", "Legacy.excalidraw"].map(name => ({ name, data: readFileSync(new URL(`../../../tests/vault/Drawings/${name}`, import.meta.url), "utf8") }));
  const result = await runInAppTask({ cli, execute: exerciseDataIntegrity, args: [prefix, fixtures], timeoutMs: 150000 });
  return { id: "data-integrity", status: "passed", ...result };
}

async function exerciseDataIntegrity(c, prefix, fixtures) {
  const p = app.plugins.plugins["obsidian-excalidraw-plugin"], originalLeaf = app.workspace.activeLeaf;
  let mainAnchor;
  app.workspace.iterateAllLeaves(leaf => { if (!mainAnchor && leaf.getRoot() === app.workspace.rootSplit) mainAnchor = leaf; });
  if (!mainAnchor) throw Error("Main-window workspace anchor unavailable");
  app.workspace.setActiveLeaf(mainAnchor, { focus: true }); app.workspace.containerEl.ownerDocument.defaultView.focus();
  const ownedLeaves = new Set(), ownedPaths = new Set(); let backupDB;
  const check = (condition, message) => { if (!condition) throw Error(message); };
  const close = async leaf => { if (leaf.view?.getViewType() !== "empty") await leaf.setViewState({ type: "empty", state: {} }); leaf.detach(); ownedLeaves.delete(leaf); };
  c.defer(async () => {
    for (const leaf of ownedLeaves) await close(leaf);
    if (originalLeaf) app.workspace.setActiveLeaf(originalLeaf, { focus: true });
    const folder = app.vault.getFolderByPath(prefix);
    if (folder) { check(folder.path === prefix && prefix.startsWith("__excalidraw_cli_smoke_"), "unowned cleanup"); await app.vault.delete(folder, true); }
    if (backupDB) {
      const transaction = backupDB.transaction("drawingBAK", "readwrite");
      for (const path of ownedPaths) { check(path.startsWith(prefix + "/"), "unowned backup key"); transaction.objectStore("drawingBAK").delete(path); }
      await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error); });
      backupDB.close();
    }
  });
  await app.vault.createFolder(prefix);
  const open = async file => {
    const leaf = app.workspace.getLeaf("tab"); ownedLeaves.add(leaf); await leaf.openFile(file);
    await c.waitFor(() => leaf.view.file?.path === file.path && leaf.view.isLoaded && leaf.view.excalidrawAPI && !leaf.view.semaphores.justLoaded && !leaf.view.isClosingOrMigrating(), "drawing first commit");
    return leaf;
  };
  const readScene = file => p.ea.getSceneFromFile(file);
  for (const fixture of fixtures) {
    await c.case(`native:data-roundtrip:${fixture.name}`, ["P02"], async () => {
      const path = prefix + "/" + fixture.name; ownedPaths.add(path);
      const file = await app.vault.create(path, fixture.data);
      await c.waitFor(() => p.isExcalidrawFile(file), "drawing metadata");
      let leaf = await open(file), view = leaf.view, api = view.excalidrawAPI;
      const elements = api.getSceneElements(); check(elements.length === 2, "fixture elements missing");
      const updated = elements.map((element, i) => i ? element : { ...element, x: 123, version: element.version + 1, versionNonce: element.versionNonce + 1 });
      api.updateScene({ elements: updated, captureUpdate: "IMMEDIATELY" });
      await c.waitFor(() => view.isDirty(), "local dirty revision");
      const receipt = await view.saveWithOutcome(); check(receipt.status === "persisted" && receipt.acknowledgedRevision !== null, "save was not physically acknowledged");
      const diskScene = await readScene(file); check(diskScene.elements[0].x === 123 && diskScene.elements[0].customData.retainedUnknown.value === 0, "saved scene/custom data differ");
      const bytes = await app.vault.read(file);
      if (fixture.name.endsWith(".md")) check(bytes.includes("User Markdown retained."), "user Markdown lost");
      await close(leaf); leaf = await open(file); check(leaf.view.excalidrawAPI.getSceneElements()[0].x === 123, "reopen lost edit");
      await close(leaf);
      return { assertions: ["two elements load", "real edit becomes dirty", "physical save receipt", "disk customData and Markdown preserved", "reopen restores edit"], path, bytes: bytes.length };
    });
  }
  const target = app.vault.getFileByPath(prefix + "/Uncompressed.excalidraw.md");
  let active = await open(target);
  await c.case("native:data-backup", ["P02"], async () => {
    const dbName = `Excalidraw ${app.appId}`;
    check((await indexedDB.databases()).some(entry => entry.name === dbName), "expected main-window cache database missing");
    backupDB = await new Promise((resolve, reject) => { const request = indexedDB.open(dbName); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    check(backupDB.objectStoreNames.contains("drawingBAK"), "durable backup store missing");
    await c.waitFor(async () => {
      const value = await new Promise((resolve, reject) => { const request = backupDB.transaction("drawingBAK", "readonly").objectStore("drawingBAK").get(target.path); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      return typeof value === "string" && value.includes("User Markdown retained.");
    }, "owned durable backup");
    return { assertions: ["successful save reaches durable main-window backup", "owned UUID key contains user Markdown"], databaseStore: "drawingBAK" };
  });
  await c.case("native:data-external-change", ["P02"], async () => {
    // Use a source fixture to arrange an external write, then assert the actual live editor follows it.
    const text = fixtures[0].data, match = text.match(/```json\n([\s\S]*?)\n```/); check(match, "uncompressed fixture block missing");
    // Saving Markdown assigns stable link-compatible IDs. An external edit must
    // preserve the identities from disk, rather than reintroduce seed IDs.
    const scene = await readScene(target); scene.elements[0].x = 321; scene.elements[0].version += 3;
    await app.vault.modify(target, text.replace(match[1], JSON.stringify(scene, null, 2)));
    await c.waitFor(() => active.view.excalidrawAPI?.getSceneElements()[0]?.x === 321, "external change synchronization");
    const elements = active.view.excalidrawAPI.getSceneElements();
    check(elements.length === 2, "external synchronization changed element count: " + JSON.stringify(elements.map(({ id, type, isDeleted }) => ({ id, type, isDeleted }))));
    return { assertions: ["external Vault edit reaches the open editor", "own-write reconciliation preserves element count"] };
  });
  await c.case("native:data-write-failure", ["P02"], async () => {
    const view = active.view, api = view.excalidrawAPI, original = app.vault.modify;
    const before = await app.vault.read(target);
    const faulty = async function(file, ...args) { if (file.path === target.path) throw Error("EXCALIDRAW_OWNED_WRITE_FAILURE"); return original.call(this, file, ...args); };
    try {
      app.vault.modify = faulty;
      api.updateScene({ elements: api.getSceneElements().map((element, i) => i ? element : { ...element, x: 777, version: element.version + 1, versionNonce: element.versionNonce + 1 }), captureUpdate: "IMMEDIATELY" });
      await c.waitFor(() => view.isDirty(), "failed-write dirty state");
      const failed = await view.saveWithOutcome(); check(failed.status === "failed" && failed.acknowledgedRevision === null, "failed write acknowledged durability");
      check(view.isDirty() && (await app.vault.read(target)) === before, "failed write cleared edits or changed disk");
    } finally { check(app.vault.modify === faulty, "Vault method ownership changed"); app.vault.modify = original; }
    const saved = await view.saveWithOutcome(); check(saved.status === "persisted" && !view.isDirty(), "retry failed");
    check((await readScene(target)).elements[0].x === 777, "retry did not persist original local edit");
    return { assertions: ["injected failure reports no durability", "dirty scene and old disk bytes survive", "successful retry saves local edit"] };
  });
  await c.case("native:data-rename-delete", ["P02", "P03"], async () => {
    await app.vault.createFolder(prefix + "/Moved");
    const moved = prefix + "/Moved/\u00c1rv\u00edzt\u0171r\u0151 \u6d4b\u8bd5.excalidraw.md"; ownedPaths.add(moved);
    await app.vault.rename(target, moved);
    await c.waitFor(() => active.view.file?.path === moved, "renamed drawing view");
    check(active.view.excalidrawAPI.getSceneElements()[0].x === 777, "rename lost edits");
    await close(active); active = await open(target); check(active.view.excalidrawAPI.getSceneElements()[0].x === 777, "moved drawing did not reopen");
    await app.vault.delete(target, true);
    await c.waitFor(() => active.view.getViewType() === "empty" || !active.view.containerEl.isConnected, "deleted drawing view retirement");
    if (active.view.containerEl.isConnected) active.detach();
    ownedLeaves.delete(active);
    check(!app.vault.getFileByPath(moved), "deleted drawing recreated");
    return { assertions: ["rename/move preserves editor and disk", "Unicode path reopens", "deletion retires the view"] };
  });
  return { tests: c.tests, expectedConsoleErrors: [{ contains: "EXCALIDRAW_OWNED_WRITE_FAILURE", min: 2, max: 2 }] };
}
