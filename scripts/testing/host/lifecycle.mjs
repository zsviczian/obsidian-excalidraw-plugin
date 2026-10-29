/** Real split, fullscreen, migration, surviving-editor and plugin-reload invariants. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInAppTask } from "./inAppTask.mjs";

export async function runLifecycleScenario({ cli, drawingPath }, { migrationRoute = "direct" } = {}) {
  assert.ok(["direct", "host-drag"].includes(migrationRoute));
  assert.ok(drawingPath.startsWith("__excalidraw_cli_smoke_"));
  const prefix = drawingPath.replace(/\.(excalidraw\.md|excalidraw|md)$/, "") + "_lifecycle";
  const fixture = readFileSync(new URL("../../../tests/vault/Drawings/Uncompressed.excalidraw.md", import.meta.url), "utf8");
  const result = await runInAppTask({ cli, execute: exerciseLifecycle, args: [prefix, fixture, migrationRoute], timeoutMs: 180_000 });
  return { id: migrationRoute === "direct" ? "lifecycle" : "lifecycle-host-drag-control", status: "passed", ...result };
}

async function exerciseLifecycle(c, prefix, fixture, migrationRoute) {
  if (migrationRoute === "host-drag") {
    const originalCase = c.case.bind(c);
    c.case = (id, features, run) => originalCase(id.replace("native:", "diagnostic:host-drag:"), features, run);
  }
  let plugin = app.plugins.plugins["obsidian-excalidraw-plugin"];
  const doc = app.workspace.containerEl.ownerDocument, previous = app.workspace.activeLeaf, owned = new Set();
  const check = (condition, label) => { if (!condition) throw Error(label); };
  const focusMain = () => {
    let anchor;
    app.workspace.iterateAllLeaves(leaf => { if (!anchor && leaf.getRoot() === app.workspace.rootSplit && leaf.view.containerEl.ownerDocument === doc) anchor = leaf; });
    check(anchor, "main-window workspace anchor unavailable");
    app.workspace.setActiveLeaf(anchor, { focus: true }); doc.defaultView.focus();
  };
  const close = async leaf => {
    c.phase = "close-owned-leaf";
    const view = leaf.view, ownerWindow = view.ownerWindow;
    view.exitFullscreen?.();
    if (ownerWindow && ownerWindow !== doc.defaultView && !ownerWindow.closed) {
      // Closing the last popout leaf can destroy the realm that owns the
      // setViewState promise. Close the actual window after saving, then wait
      // from the main-window task for the host's observable teardown instead.
      if (view.isDirty?.()) check((await view.saveWithOutcome()).status === "persisted", "popout cleanup could not save");
      ownerWindow.close(); await c.waitForCleanup(() => ownerWindow.closed, "owned popout teardown");
    } else { await leaf.setViewState({ type: "empty", state: {} }); leaf.detach(); }
    owned.delete(leaf);
  };
  c.defer(async () => {
    for (const leaf of owned) await close(leaf);
    if (previous?.containerEl?.isConnected) app.workspace.setActiveLeaf(previous, { focus: true });
    c.phase = "delete-owned-folder";
    const folder = app.vault.getFolderByPath(prefix);
    if (folder) { check(folder.path === prefix && prefix.startsWith("__excalidraw_cli_smoke_"), "unowned cleanup"); await app.vault.delete(folder, true); }
  });
  await app.vault.createFolder(prefix);
  const first = await app.vault.create(prefix + "/First.excalidraw.md", fixture);
  const second = await app.vault.create(prefix + "/Second.excalidraw.md", fixture);
  const ready = async leaf => {
    try { await c.waitFor(() => leaf.view.excalidrawAPI && leaf.view.isLoaded && !leaf.view.excalidrawAPI.getAppState().isLoading && !leaf.view.semaphores.justLoaded && !leaf.view.isClosingOrMigrating(), "owned editor first commit"); }
    catch (error) { const view = leaf.view; throw Error(error.message + ": " + JSON.stringify({ type: view.getViewType(), api: !!view.excalidrawAPI, loaded: view.isLoaded, loading: view.excalidrawAPI?.getAppState().isLoading, justLoaded: view.semaphores?.justLoaded, closing: view.isClosingOrMigrating?.(), connected: view.containerEl.isConnected, main: view.ownerDocument === doc })); }
  };
  const open = async (file, type = "tab") => { focusMain(); const leaf = app.workspace.getLeaf(type); owned.add(leaf); check(leaf.view.containerEl.ownerDocument === doc, "main-window open selected a popout"); await leaf.openFile(file); await ready(leaf); return leaf; };
  await c.waitFor(() => plugin.isExcalidrawFile(first) && plugin.isExcalidrawFile(second), "fixture metadata");
  let main = await open(first), survivor = await open(second, "split");
  const edit = async (leaf, x) => {
    const view = leaf.view, api = view.excalidrawAPI;
    api.updateScene({ elements: api.getSceneElements().map((element, i) => i ? element : { ...element, x, version: element.version + 1, versionNonce: element.versionNonce + 1 }), captureUpdate: "IMMEDIATELY", forceFlushSync: true });
    await c.waitFor(() => view.isDirty(), "local dirty revision");
  };
  await c.case("native:lifecycle-two-split-fullscreen", ["P03", "P08"], async () => {
    check(main.view.packages === survivor.view.packages && main.view.excalidrawAPI !== survivor.view.excalidrawAPI, "private runtime or per-editor API identity differs");
    await edit(main, 456); check(survivor.view.excalidrawAPI.getSceneElements()[0].x !== 456, "two drawings share scene state");
    const view = main.view; view.gotoFullscreen();
    check(view.isFullscreen() && view.contentEl.hasClass("excalidraw-fullscreen-content"), "fullscreen did not enter");
    view.exitFullscreen(); check(!view.isFullscreen() && !view.contentEl.hasClass("excalidraw-fullscreen-content"), "fullscreen classes leaked");
    return { assertions: ["split editors share one runtime and distinct APIs", "one drawing's edit does not affect the other", "fullscreen enters and restores owned classes"] };
  });
  await c.case("native:lifecycle-dirty-main-to-popout", ["P02", "P03"], async () => {
    const retired = main.view;
    app.workspace.moveLeafToPopout(main);
    await c.waitFor(() => main.view !== retired && main.view.ownerDocument !== doc && main.view.excalidrawAPI, "main to popout replacement");
    await ready(main);
    check(!retired.excalidrawAPI && main.view.excalidrawAPI.getSceneElements()[0].x === 456, "dirty source survived migration or lost its edit");
    check(main.view.packages === survivor.view.packages, "popout evaluated another private runtime");
    return { assertions: ["dirty edit survives main-to-popout", "retired source API unmounted", "popout retains shared private runtime"] };
  });
  await c.case("native:lifecycle-dirty-popout-to-main", ["P02", "P03"], async () => {
    await edit(main, 654); const retired = main.view;
    // Obsidian removes the original empty tab group after moving its final leaf.
    // Reacquire a live destination instead of retaining that detached group.
    const destination = survivor.parent;
    check(destination.containerEl.isConnected && destination.containerEl.ownerDocument === doc && typeof main.parent.removeChild === "function" && typeof destination.insertChild === "function", "installed host cannot migrate an owned leaf back to main");
    let routeEvidence = { input: "direct host remove/insert operations" };
    if (migrationRoute === "host-drag") {
      // Enter Obsidian's registered tab dragstart/drop handlers instead of
      // rearranging leaf parents in test code. This is a synthetic host-route
      // control, not evidence of a real OS drag or trusted pointer interaction.
      const source = main.tabHeaderEl, target = survivor.tabHeaderEl;
      const sourceWindow = source.ownerDocument.defaultView, mainWindow = doc.defaultView;
      const sr = source.getBoundingClientRect(), tr = target.getBoundingClientRect();
      check(sr.width > 0 && tr.width > 0, "migration tab headers are not visible");
      const point = { clientX: tr.x + tr.width / 2, clientY: tr.y + tr.height * 0.8 };
      const start = new sourceWindow.DragEvent("dragstart", { bubbles: true, cancelable: true,
        clientX: sr.x + sr.width / 2, clientY: sr.y + sr.height / 2, dataTransfer: new sourceWindow.DataTransfer() });
      const end = new sourceWindow.DragEvent("dragend", { bubbles: true });
      let dropDispatched = false;
      source.dispatchEvent(start);
      try {
        const over = new mainWindow.DragEvent("dragover", { bubbles: true, cancelable: true,
          ...point, dataTransfer: new mainWindow.DataTransfer() });
        target.dispatchEvent(over);
        check(app.workspace.getDropLocation(over) === destination, "ordinary tab drag did not target the live main tab group");
        const drop = new mainWindow.DragEvent("drop", { bubbles: true, cancelable: true,
          ...point, dataTransfer: new mainWindow.DataTransfer() });
        dropDispatched = true;
        target.dispatchEvent(drop); // Host drop handler removes its drag listeners before migrating.
        check(main.getRoot() === app.workspace.rootSplit, "ordinary tab drop did not move the owned leaf");
        routeEvidence = { input: "synthetic dragstart/dragover/drop through Obsidian's ordinary tab handlers",
          trusted: false, sourceMain: sourceWindow === mainWindow, point };
      } finally {
        if (!dropDispatched) source.dispatchEvent(end);
      }
    } else {
      main.parent.removeChild(main); main.setDimension(null); destination.insertChild(-1, main);
      destination.selectTabIndex(destination.children.indexOf(main)); app.workspace.requestResize();
    }
    await c.waitFor(() => main.view !== retired && main.view.ownerDocument === doc && main.view.excalidrawAPI, "popout to main replacement");
    await ready(main); check(!retired.excalidrawAPI && main.view.excalidrawAPI.getSceneElements()[0].x === 654, "popout source survived or lost edit");
    await c.waitFor(() => !main.view.isDirty(), "replacement main-window persistence");
    const saved = await plugin.ea.getSceneFromFile(first); check(saved.elements[0].x === 654, "main replacement did not write captured migration edit");
    return { routeEvidence, assertions: ["dirty edit survives popout-to-main", "retired popout API unmounted", "replacement main window physically saves captured edit"] };
  });
  await c.case("native:lifecycle-new-popout-survivor", ["P03"], async () => {
    const popout = app.workspace.openPopoutLeaf(); owned.add(popout);
    // Obsidian moves the initially empty leaf asynchronously; begin file loading
    // only after it reaches its destination document, as in the Lucide probe.
    await c.waitFor(() => popout.view.containerEl.ownerDocument !== doc, "empty popout migration before drawing load");
    await popout.setViewState({ type: "excalidraw", state: { file: first.path } });
    app.workspace.setActiveLeaf(popout, { focus: true }); await ready(popout);
    check(popout.view.ownerDocument !== doc && popout.view.excalidrawAPI.getSceneElements()[0].x === 654, "fresh popout did not load persisted data");
    const popWindow = popout.view.ownerWindow;
    await close(popout);
    await c.waitFor(() => popWindow.closed, "owned popout close");
    await edit(survivor, 777); check((await survivor.view.saveWithOutcome()).status === "persisted", "surviving editor cannot save");
    check(main.view.excalidrawAPI.getSceneElements()[0].x === 654, "popout teardown contaminated main editor");
    return { assertions: ["fresh popout opens persisted scene", "popout window closes", "surviving drawing remains editable and saves", "other drawing stays unchanged"] };
  });
  await c.case("native:lifecycle-plugin-reload", ["P01", "P02", "P03"], async () => {
    const oldPlugin = plugin, oldViews = [main.view, survivor.view], oldRuntime = plugin.getCLIRuntime();
    c.defer(async () => {
      if (!app.plugins.plugins["obsidian-excalidraw-plugin"]) {
        await app.plugins.enablePlugin("obsidian-excalidraw-plugin");
        await c.waitForCleanup(() => app.plugins.plugins["obsidian-excalidraw-plugin"]?.isReady, "restore plugin after reload failure");
      }
    });
    await app.plugins.disablePlugin("obsidian-excalidraw-plugin");
    await c.waitFor(() => oldViews.every(view => !view.excalidrawAPI), "plugin disable editor teardown");
    let retired = false; try { oldPlugin.getCLIRuntime(); } catch { retired = true; } check(retired, "plugin disable retained runtime registrations");
    await app.plugins.enablePlugin("obsidian-excalidraw-plugin");
    await c.waitFor(() => app.plugins.plugins["obsidian-excalidraw-plugin"]?.isReady, "reloaded plugin readiness");
    plugin = app.plugins.plugins["obsidian-excalidraw-plugin"];
    check(plugin !== oldPlugin && plugin.getCLIRuntime() !== oldRuntime, "plugin reload reused retired instance");
    main = await open(first); survivor = await open(second);
    check(main.view.excalidrawAPI.getSceneElements()[0].x === 654 && survivor.view.excalidrawAPI.getSceneElements()[0].x === 777, "reload lost drawing data");
    check(Object.keys(app.commands.commands).filter(id => id === "obsidian-excalidraw-plugin:excalidraw-autocreate").length === 1, "command registration duplicated");
    return { assertions: ["disable unmounts editor APIs and retires runtime", "reload obtains a new plugin and runtime", "both saved drawings reopen", "stable command registered once"] };
  });
  return { tests: c.tests };
}
