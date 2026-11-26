/** Native Visual Resources gestures, curation, and blank-drawing framework workflow. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInAppTask } from "./inAppTask.mjs";

export const visualResourceCaseIds = [
  "native:visual-resources:palette-and-insertion",
  "native:visual-resources:svg-strokes-and-curation",
  "native:visual-resources:popout-drop",
  "native:visual-resources:framework-picker",
  "native:visual-resources:reload",
];

export async function runVisualResourcesScenario({ cli, drawingPath }) {
  const library = JSON.parse(readFileSync(new URL("../../../visual-frameworks/thinking-frameworks.excalidrawlib", import.meta.url), "utf8"));
  library.libraryItems = library.libraryItems.slice(0, 1);
  const result = await runInAppTask({ cli, execute: exercise, args: [drawingPath, library], timeoutMs: 120000, cleanupMs: 60000,
    onProgress: phase => { if (phase) process.stdout.write("Visual Resources: " + phase + "\n"); } });
  assert.deepEqual(result.tests.map(test => test.testId), visualResourceCaseIds);
  return { id: "visual-resources-3074", status: "passed", ...result };
}

async function exercise(c, drawingPath, library) {
  const id = "obsidian-excalidraw-plugin";
  let plugin = app.plugins.plugins[id];
  const workspace = app.workspace, vault = app.vault;
  c.observations = {};
  const root = drawingPath.replace(/\.(excalidraw\.md|excalidraw|md)$/, "") + "_visual_resources";
  const check = (value, detail) => { if (!value) throw Error(detail); };
  const runCase = (testId, action) => {
    c.phase = testId;
    return c.case(testId, ["P08"], action);
  };
  check(root.startsWith("__excalidraw_cli_smoke_") && !vault.getAbstractFileByPath(root), "Unowned visual resources fixture root");
  const saved = {};
  for (const key of ["folder", "visualResources", "frameworkFolder", "frameworksOnBlank", "frameworksSnoozedUntil", "sidepanelOpenInPopout", "showNewVersionNotification", "templateFilePath"]) {
    saved[key] = plugin.settings[key];
  }
  c.defer(async () => {
    if (!app.plugins.plugins[id]) await app.plugins.enablePlugin(id);
    await c.waitForCleanup(() => app.plugins.plugins[id]?.isReady, "plugin ready for settings restoration");
    plugin = app.plugins.plugins[id];
    plugin.visualResourcePanel.tab?.close();
    for (const leaf of workspace.getLeavesOfType("excalidraw-sidepanel")) leaf.detach();
    for (const leaf of workspace.getLeavesOfType("excalidraw").filter(leaf => leaf.view.file?.path.startsWith(root + "/"))) {
      await leaf.setViewState({ type: "empty", state: {} });
      leaf.detach();
    }
    Object.assign(plugin.settings, saved);
    await plugin.saveSettings();
    const folder = vault.getFolderByPath(root);
    if (folder) await vault.delete(folder, true);
  });
  await vault.createFolder(root);
  const frameworkFolder = root + "/Frameworks";
  await vault.createFolder(frameworkFolder);
  const svg = await vault.create(root + "/icon - Resource probe.svg", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 32"><rect width="64" height="32" fill="#22aa66"/></svg>');
  await vault.create(frameworkFolder + "/Probe.excalidrawlib", JSON.stringify(library));
  Object.assign(plugin.settings, { folder: root, frameworkFolder, templateFilePath: "",
    frameworksOnBlank: true, frameworksSnoozedUntil: 0, sidepanelOpenInPopout: false,
    showNewVersionNotification: false, visualResources: { filters: ["icon", "lucide", "image", "drawing", "framework"] } });
  await plugin.saveSettings();
  const drawingData = await vault.read(vault.getFileByPath(drawingPath));
  const ownedDrawing = await plugin.createAndOpenDrawing("Visual Resource probe.excalidraw.md", "new-tab", root, drawingData);
  let leaf;
  await c.waitFor(() => (leaf = workspace.getLeavesOfType("excalidraw").find(leaf => leaf.view.file?.path === ownedDrawing))?.view.excalidrawAPI?.id,
    "owned drawing initialized");
  const view = leaf?.view, api = view?.excalidrawAPI;
  check(api, "Native probe drawing is not ready");
  workspace.setActiveLeaf(leaf, { focus: true });
  let panel;
  const search = query => {
    const input = panel.querySelector("input[type=search]");
    input.value = query;
    input.dispatchEvent(new (input.ownerDocument.defaultView.Event)("input", { bubbles: true }));
  };
  const card = () => [...panel.querySelectorAll(".excalidraw-resource-body")]
    .find(button => button.getAttribute("aria-label") === "Resource probe");
  const count = () => api.getSceneElements().length;
  const locator = { provider: "vault", path: svg.path };
  await runCase("native:visual-resources:palette-and-insertion", async () => {
    const indexed = (await plugin.visualResources.list()).find(resource => resource.source === svg.path);
    check(indexed?.kind === "icon", "Vault icon is absent from discovery results");
    const initial = count();
    check(app.commands.executeCommandById(id + ":visual-resources"), "Browser command was unavailable");
    await c.waitFor(() => (panel = workspace.getLeavesOfType("excalidraw-sidepanel")[0]?.view.containerEl.querySelector(".excalidraw-resource-browser")), "browser mounted");
    search("Resource probe");
    await c.waitFor(() => {
      c.observations.browser = { status: panel.querySelector(".excalidraw-resource-status")?.textContent,
        search: panel.querySelector("input[type=search]")?.value, rendered: !!card() };
      return card();
    }, "configured vault icon searchable");
    const win = panel.ownerDocument.defaultView;
    card().dispatchEvent(new win.MouseEvent("click", { bubbles: true, detail: 1 }));
    card().dispatchEvent(new win.MouseEvent("click", { bubbles: true, detail: 2 }));
    card().dispatchEvent(new win.MouseEvent("dblclick", { bubbles: true, detail: 2 }));
    await c.waitFor(() => workspace.getLeavesOfType("image").some(leaf => leaf.view.file?.path === svg.path), "double click opens source");
    await new Promise(resolve => win.setTimeout(resolve, 525));
    check(count() === initial, "Double click inserted before opening");
    const opened = workspace.getLeavesOfType("image").find(leaf => leaf.view.file?.path === svg.path);
    opened.detach();
    workspace.setActiveLeaf(leaf, { focus: true });
    await plugin.visualResourcePanel.open(view);
    search("Resource probe");
    await c.waitFor(() => card()?.getAttribute("aria-disabled") === null, "drawing ready after source open");
    card().dispatchEvent(new win.MouseEvent("click", { bubbles: true, detail: 1 }));
    await plugin.visualResourcePanel.open(null);
    await new Promise(resolve => win.setTimeout(resolve, 525));
    check(count() === initial, "A delayed click published after the target changed");
    await plugin.visualResourcePanel.open(view, "Icon Library");
    check(workspace.getLeavesOfType("excalidraw-sidepanel").length === 1, "Icon preset duplicated the sidepanel");
    check(plugin.settings.visualResources.filters.includes("lucide"), "Icon preset replaced general filters");
    search("Resource probe");
    await c.waitFor(() => card()?.getAttribute("aria-disabled") !== "true" && card()?.textContent.includes("Resource probe"), "icon preset is ready for insertion");
    card().click();
    await c.waitFor(() => count() === initial + 1, "single click inserted one linked image");
    const image = api.getSceneElements().find(element => element.type === "image");
    check(image && image.width === 180, "Vault icon did not keep the existing width");
    return { assertions: ["vault icon discovered and rendered", "double-click opens without inserting",
      "changing target cancels pending insertion", "one panel serves both presets", "linked icon keeps its configured width"],
      linkedImage: image.id, samePanel: true, doubleClickInsertions: 0 };
  });
  await runCase("native:visual-resources:svg-strokes-and-curation", async () => {
    const resources = plugin.visualResources;
    const resource = (await resources.list()).find(item => item.source === svg.path);
    const before = count();
    await c.waitFor(() => resources.writable(view), "drawing is writable after linked insert");
    await resources.insertSvgStrokes(resource, view, () => true, true);
    await c.waitFor(() => count() > before, "editable SVG strokes published");
    check(api.getSceneElements().filter(element => element.type === "image").length === 1, "Editable import added an image element");
    await c.waitFor(() => app.metadataCache.getFileCache(view.file)?.frontmatter?.["excalidraw-svg-sources"]?.length === 1, "SVG source property cached");
    await resources.collections.savePlaylist("Native playlist", "native-list");
    await resources.collections.curate([locator], { favorite: true, playlist: "native-list", member: true });
    await resources.collections.refresh();
    check(resources.collections.state(locator).favorite && resources.collections.state(locator).memberships.includes("native-list"), "Favorite and playlist membership did not persist");
    await resources.collections.curate([locator], { playlist: "native-list", member: false });
    check(resources.collections.state(locator).favorite && !resources.collections.state(locator).memberships.includes("native-list"), "Removing membership changed the independent favorite");
    return { assertions: ["SVG conversion publishes editable elements", "source link appears in the drawing properties",
      "playlist membership and favorite are independent"], sourceLinks: 1, nativeElements: count() - before };
  });
  await runCase("native:visual-resources:popout-drop", async () => {
    const receivingPath = await plugin.createAndOpenDrawing("Resource drop receiver.excalidraw.md", "popout-window", root, drawingData);
    let receiver;
    await c.waitFor(() => {
      receiver = workspace.getLeavesOfType("excalidraw").find(leaf => leaf.view.file?.path === receivingPath)?.view;
      return receiver?.ownerDocument !== view.ownerDocument && plugin.visualResources.writable(receiver);
    }, "writable receiving popout");
    await plugin.visualResourcePanel.open(view, "Icon Library");
    search("Resource probe");
    await c.waitFor(card, "draggable icon card in the main window sidebar");
    const receiveApi = receiver.excalidrawAPI;
    receiveApi.updateScene({ appState: { zoom: { value: 1.35 }, scrollX: 33, scrollY: -24 },
      captureUpdate: "NEVER", forceFlushSync: true });
    const state = receiveApi.getAppState();
    const clientX = state.offsetLeft + 115, clientY = state.offsetTop + 125;
    const expectedX = (clientX - state.offsetLeft) / state.zoom.value - state.scrollX;
    const expectedY = (clientY - state.offsetTop) / state.zoom.value - state.scrollY;
    const before = new Set(receiveApi.getSceneElements().map(element => element.id));
    const sourceCount = count();
    const sourceWindow = panel.ownerDocument.defaultView;
    const transfer = new sourceWindow.DataTransfer();
    card().dispatchEvent(new sourceWindow.DragEvent("dragstart", { dataTransfer: transfer, bubbles: true }));
    const event = new receiver.ownerWindow.DragEvent("drop", { dataTransfer: transfer, clientX, clientY, cancelable: true });
    check(receiver.dropManager.onDrop(event) === false && event.defaultPrevented, "The receiving drop manager did not consume the resource");
    let inserted;
    await c.waitFor(() => (inserted = receiveApi.getSceneElements().find(element => !before.has(element.id))), "resource inserted into receiving popout");
    check(inserted.type === "image" && receiver.excalidrawData.getFile(inserted.fileId)?.file?.path === svg.path,
      "Dropped SVG lost its source link");
    check(Math.abs(inserted.x + inserted.width / 2 - expectedX) < 1 && Math.abs(inserted.y + inserted.height / 2 - expectedY) < 1,
      "Resource drop lost the receiving view's zoom or pan");
    check(count() === sourceCount && receiveApi.getSceneElements().length === before.size + 1,
      "Drop inserted in the wrong drawing or added more than one element");
    receiveApi.history.undo();
    await c.waitFor(() => receiveApi.getSceneElements().length === before.size, "one undo removes the dropped resource");
    await receiver.leaf.setViewState({ type: "empty", state: {} });
    receiver.leaf.detach();
    return { assertions: ["resource drop reaches the receiving popout", "linked image uses receiving scene coordinates",
      "source scene is unchanged", "one undo removes the insertion"] };
  });
  await runCase("native:visual-resources:framework-picker", async () => {
    workspace.setActiveLeaf(leaf, { focus: true });
    const prepared = plugin.prepareInteractiveDrawing(true);
    const doc = view.ownerDocument;
    let picker;
    await c.waitFor(() => (picker = doc.querySelector(".excalidraw-framework-picker"))?.querySelector(".excalidraw-resource-body"), "local framework is available offline");
    picker.querySelector(".excalidraw-resource-body").click();
    const result = await prepared;
    check(result.kind === "ready" && result.data.includes(library.libraryItems[0].elements[0].id), "Framework selection did not produce editable scene data");
    const path = await plugin.createAndOpenDrawing("Framework probe.excalidraw.md", "new-tab", root, result.data);
    await c.waitFor(() => workspace.getLeavesOfType("excalidraw").some(leaf => leaf.view.file?.path === path && leaf.view.excalidrawAPI?.getSceneElements().length > 0), "framework drawing renders with editable elements");
    const before = vault.getFiles().length;
    const cancelled = plugin.createAndOpenInteractiveDrawing("Cancelled.excalidraw.md", "new-tab", root);
    await c.waitFor(() => (picker = doc.querySelector(".excalidraw-framework-picker")), "interactive new drawing picker");
    picker.dispatchEvent(new (doc.defaultView.KeyboardEvent)("keydown", { key: "Escape", bubbles: true }));
    const close = picker.closest(".modal")?.querySelector(".modal-close-button");
    close?.click();
    check(await cancelled === "" && vault.getFiles().length === before, "Dismissal created a drawing");
    const snoozed = plugin.prepareInteractiveDrawing();
    await c.waitFor(() => (picker = doc.querySelector(".excalidraw-framework-picker")), "picker before snoozing");
    const later = [...picker.querySelectorAll("button")].find(button => button.textContent === plugin.getLabel("VR_SHOW_LATER"));
    check(later, "Show me later action unavailable");
    const clickedAt = Date.now();
    later.click();
    check((await snoozed).kind === "ready", "Snoozing did not continue with a blank drawing");
    check(plugin.settings.frameworksSnoozedUntil >= clickedAt + 7 * 86400000, "Snooze did not last seven days");
    check((await plugin.prepareInteractiveDrawing()).kind === "ready" && !doc.querySelector(".excalidraw-framework-picker"),
      "The automatic picker opened during the snooze");
    return { assertions: ["framework opens offline", "selected framework starts an editable drawing",
      "dismissal writes nothing", "automatic prompt snoozes for seven days"],
      item: library.libraryItems[0].id, cancelledWithoutFile: true, sevenDaySnooze: true };
  });
  await runCase("native:visual-resources:reload", async () => {
    plugin.settings.visualResources = { ...plugin.settings.visualResources, filters: ["lucide", "other"], unknownPreference: "retain" };
    await plugin.saveSettings();
    const settingsPath = plugin.manifest.dir + "/data.json";
    const disk = JSON.parse(await vault.adapter.read(settingsPath));
    check(disk.visualResources.unknownPreference === "retain" && disk.frameworksSnoozedUntil > Date.now(),
      "New preferences did not persist on disk");
    const previous = plugin;
    await app.plugins.disablePlugin(id);
    await app.plugins.enablePlugin(id);
    await c.waitFor(() => app.plugins.plugins[id]?.isReady && app.plugins.plugins[id] !== previous, "fresh plugin startup");
    plugin = app.plugins.plugins[id];
    await plugin.visualResources.collections.refresh();
    check(plugin.settings.visualResources.filters.join(",") === "lucide,other", "General browser filters changed after startup");
    check(plugin.settings.visualResources.unknownPreference === "retain" && plugin.settings.frameworksSnoozedUntil === disk.frameworksSnoozedUntil,
      "Snooze or unknown preferences were lost during startup");
    check(plugin.visualResources.collections.state(locator).favorite, "Vault-wide favorite was lost after plugin reload");
    return { assertions: ["settings and unknown keys survive full plugin reload", "vault collection reload restores favorites"] };
  });
  return { tests: c.tests, observations: c.observations };
}
