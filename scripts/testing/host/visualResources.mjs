/** Native Visual Resources gestures, curation, and blank-drawing framework workflow. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInAppTask } from "./inAppTask.mjs";
import { behaviorInputDriver } from "./behaviorMatrix.mjs";

export const visualResourceCaseIds = [
  "native:visual-resources:palette-and-insertion",
  "native:visual-resources:panel-controls",
  "native:visual-resources:stencils",
  "native:visual-resources:svg-strokes-and-curation",
  "native:visual-resources:popout-drop",
  "native:visual-resources:framework-picker",
  "native:visual-resources:reload",
];

export async function runVisualResourcesScenario({ cli, drawingPath }) {
  const library = JSON.parse(readFileSync(new URL("../../../visual-frameworks/thinking-frameworks.excalidrawlib", import.meta.url), "utf8"));
  library.libraryItems = library.libraryItems.slice(0, 1);
  const result = await runInAppTask({ cli, execute: exercise, args: [drawingPath, library], timeoutMs: 120000, cleanupMs: 60000,
    onRequest: behaviorInputDriver(cli),
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
  for (const key of ["folder", "visualResources", "frameworkFolder", "frameworksOnBlank", "frameworksSnoozedUntil", "sidepanelOpenInPopout", "showNewVersionNotification", "templateFilePath", "libraryFolderPath", "libraryStorageMode", "libraryMigrationStatus"]) {
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
    plugin.stencilLibraryManager.invalidate();
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
  await runCase("native:visual-resources:panel-controls", async () => {
    const doc = panel.ownerDocument, win = doc.defaultView;
    const preferences = structuredClone(plugin.settings.visualResources);
    const controller = plugin.visualResourcePanel;
    const showMenu = controller.show;
    controller.show = function(menu, ...args) { return showMenu.call(this, menu.setUseNativeMenu(false), ...args); };
    c.defer(() => { controller.show = showMenu; });
    const trigger = view.containerEl.querySelector(".excalidraw-visual-resources-trigger");
    check(trigger, "Canvas toolbar is missing the Visual Resources action");
    const adjacent = trigger.previousElementSibling;
    check(win.getComputedStyle(trigger).backgroundColor === win.getComputedStyle(adjacent).backgroundColor,
      "The shapes button paints different button chrome from Insert Any File");
    check(trigger.getBoundingClientRect().height === adjacent.getBoundingClientRect().height,
      "The shapes button uses different toolbar sizing");
    trigger.click();
    await c.waitFor(() => !controller.script, "canvas action opens general resources");
    const query = panel.querySelector("input[type=search]");
    const toolbarButton = key => [...panel.querySelectorAll(".excalidraw-resource-search-tools button")]
      .find(button => button.getAttribute("aria-label") === plugin.getLabel(key));
    const filter = toolbarButton("VR_FILTER");
    const originalWidth = panel.style.width;
    try {
      panel.style.width = "720px";
      check(filter.getBoundingClientRect().top < query.getBoundingClientRect().bottom, "The wide toolbar wraps below search");
      panel.style.width = "285px";
      check(filter.getBoundingClientRect().top >= query.getBoundingClientRect().bottom, "The narrow toolbar does not wrap below search");
    } finally { panel.style.width = originalWidth; }
    const menuAction = async key => {
      let item;
      await c.waitFor(() => (item = [...doc.querySelectorAll(".menu-item-title")]
        .find(el => el.textContent === plugin.getLabel(key))), "rendered menu action " + key);
      item.closest(".menu-item").click();
    };
    const openFilters = () => filter.click();
    openFilters();
    await menuAction("VR_SELECT_NO_FILTERS");
    check(!plugin.settings.visualResources.filters.length && !plugin.settings.visualResources.groups.length,
      "Select none did not clear resource kinds and discovery groups");
    check(!panel.querySelector(".excalidraw-resource-card"), "Select none left visible results");
    openFilters();
    await menuAction("VR_SELECT_ALL_FILTERS");
    check(plugin.settings.visualResources.filters.includes("other") && plugin.settings.visualResources.groups.length > 0,
      "Select all did not enable all kinds and discovery groups");
    search("Resource probe");
    await c.waitFor(card, "resource visible after Select all");
    const before = count();
    toolbarButton("VR_SELECT").click();
    const checkbox = [...panel.querySelectorAll("input.excalidraw-resource-checkbox")]
      .find(input => input.getAttribute("aria-label") === "Resource probe");
    const selectionBar = panel.querySelector(".excalidraw-resource-selection");
    const selectedActions = selectionBar.querySelector("button");
    check(checkbox && !checkbox.checked && selectedActions.disabled, "Selection mode omitted checkboxes or initial state");
    checkbox.focus();
    checkbox.click();
    check(checkbox.isConnected && checkbox.checked && doc.activeElement === checkbox && !selectedActions.disabled,
      "Toggling a checkbox removed focus or failed to enable bulk actions");
    check(selectionBar.textContent.includes(plugin.getLabel("VR_SELECTION_COUNT").replace("{COUNT}", "1")),
      "Selection count did not update");
    checkbox.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    check(!panel.querySelector(".excalidraw-resource-checkbox") && card() && count() === before,
      "Exiting selection mode changed the scene or left selection controls");

    const ea = plugin.ea.getAPI(view);
    try {
      const frameId = ea.addFrame(480, 310, 230, 160, "Divider test frame");
      ea.addElementsToFrame(frameId, [ea.addRect(500, 340, 55, 43)]);
      check(await ea.addElementsToView(false, true, true), "Could not save the owned frame fixture");
    } finally { ea.destroy(); }
    search("Divider test frame");
    let framesButton;
    await c.waitFor(() => (framesButton = [...panel.querySelectorAll(".excalidraw-resource-actions button")]
      .find(button => button.getAttribute("aria-label") === plugin.getLabel("VR_FRAME") + " (1)" &&
        !button.classList.contains("excalidraw-display-none"))), "named-frame count in search results");
    framesButton.click();
    const divider = panel.querySelector(".excalidraw-resource-divider");
    const galleryPane = panel.querySelector(".excalidraw-resource-main");
    const framePane = panel.querySelector(".excalidraw-resource-frames");
    await c.waitFor(() => framePane.querySelector(".excalidraw-resource-body")?.textContent.includes("Divider test frame"),
      "frame selector with a visible split divider");
    const start = divider.getBoundingClientRect();
    const beforeHeight = galleryPane.getBoundingClientRect().height;
    const x = Math.round(start.left + start.width / 2), y = Math.round(start.top + start.height / 2);
    const contentsId = win.require("@electron/remote").getCurrentWebContents().id;
    await c.requestHost("behavior-input", { contentsId, method: "Input.dispatchMouseEvent", params: [
      { type: "mouseMoved", x, y, button: "none", buttons: 0 },
      { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 },
      { type: "mouseMoved", x, y: y - 45, button: "left", buttons: 1 },
      { type: "mouseReleased", x, y: y - 45, button: "left", buttons: 0, clickCount: 1 },
    ] });
    await c.waitFor(() => galleryPane.getBoundingClientRect().height < beforeHeight - 12, "pointer drag grows the frame pane");
    const afterPointer = Number(divider.getAttribute("aria-valuenow"));
    divider.dispatchEvent(new win.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    check(Number(divider.getAttribute("aria-valuenow")) > afterPointer, "Divider keyboard input did not resize the panes");
    check(query.value === "Divider test frame" && framePane.querySelector(".excalidraw-resource-body"),
      "Resizing dropped search or frame context");
    framePane.querySelector(".excalidraw-resource-toolbar button").click();
    check(divider.classList.contains("excalidraw-display-none"), "Closing frames left the split divider visible");
    controller.show = showMenu;
    plugin.settings.visualResources = preferences;
    await plugin.saveSettings();
    return { assertions: ["canvas button uses neighboring toolbar styling", "toolbar shares the search row at wide widths and wraps when narrow",
      "bulk filter actions update kinds and groups", "checkbox selection keeps focus and preserves the scene",
      "pointer and keyboard resize the frame split without losing the current search"] };
  });
  await runCase("native:visual-resources:stencils", async () => {
    const doc = panel.ownerDocument, win = doc.defaultView;
    const preferences = plugin.settings.visualResources;
    const libraryFolderPath = root + "/Stencils";
    Object.assign(plugin.settings, { libraryFolderPath, libraryStorageMode: "vault", libraryMigrationStatus: "not-required",
      visualResources: { ...preferences, filters: ["stencil"], list: false } });
    plugin.stencilLibraryManager.invalidate();
    await vault.createFolder(libraryFolderPath);
    const source = library.libraryItems[0].elements;
    const rectangle = source.find(element => element.type === "rectangle");
    const original = { id: "stencil-probe-generated-id", created: 1, status: "unpublished", elements: [
      { ...rectangle, id: "stencil-top", x: 0, y: 0, width: 90, height: 40, backgroundColor: "#ff2222", fillStyle: "solid" },
      { ...rectangle, id: "stencil-bottom", x: 0, y: 700, width: 90, height: 40, backgroundColor: "#22ff22", fillStyle: "solid" },
      { ...source.find(element => element.type === "text"), id: "stencil-text", x: 0, y: 340, width: 90, height: 24,
        fontSize: 20, text: "BRAIN", originalText: "BRAIN", rawText: "", autoResize: true },
    ] };
    const file = await vault.create(libraryFolderPath + "/Probe.excalidrawlib", JSON.stringify({
      ...library, source: "native-test", libraryItems: [original],
    }));
    await plugin.visualResourcePanel.open(view);
    search(original.id);
    const cardFor = title => [...panel.querySelectorAll(".excalidraw-resource-card")]
      .find(el => el.querySelector('[aria-label="' + title + '"]'));
    let tile, img;
    await c.waitFor(() => (img = (tile = cardFor(original.id))?.querySelector(".excalidraw-resource-preview img"))?.naturalHeight,
      "tall unnamed stencil thumbnail loads");
    const preview = img.parentElement.getBoundingClientRect(), image = img.getBoundingClientRect();
    const fits = image.top >= preview.top - 1 && image.bottom <= preview.bottom + 1 &&
      image.left >= preview.left - 1 && image.right <= preview.right + 1;
    const grip = tile.querySelector("[draggable=true]");
    await view.changeTextMode("parsed", false);
    await c.waitFor(() => plugin.visualResources.writable(view), "drawing prepared for the stencil drop");
    const before = new Set(api.getSceneElements().map(element => element.id));
    const transfer = new win.DataTransfer();
    grip.dispatchEvent(new win.DragEvent("dragstart", { dataTransfer: transfer, bubbles: true }));
    const state = api.getAppState();
    const event = new win.DragEvent("drop", { dataTransfer: transfer, clientX: state.offsetLeft + 120,
      clientY: state.offsetTop + 140, cancelable: true });
    check(view.dropManager.onDrop(event) === false && event.defaultPrevented, "Stencil drag did not reach the native scene drop path");
    let inserted;
    await c.waitFor(() => (inserted = api.getSceneElements().filter(element => !before.has(element.id))).length === 3, "stencil inserted");
    const text = inserted.find(element => element.type === "text");
    c.observations.stencil = { previewHeight: preview.height, imageHeight: image.height, text: text?.text, width: text?.width };
    check(fits && text?.text === "BRAIN" && text.width > 40,
      "Stencil preview or text regression: " + JSON.stringify(c.observations.stencil));
    check(view.excalidrawData.getRawText(text.id) === "BRAIN", "Inserted text lost its editable source");
    await c.waitFor(() => plugin.visualResources.writable(view), "stencil insertion saved");
    api.history.undo();
    await c.waitFor(() => api.getSceneElements().length === before.size, "one undo removes the stencil");
    const stencilLocator = { provider: "stencil", path: file.path, id: original.id };
    const diskItem = async () => JSON.parse(await vault.read(file)).libraryItems[0];
    check((await diskItem()).elements[2].rawText === "", "Dropping mutated the source stencil");
    await plugin.visualResources.collections.curate([stencilLocator], { favorite: true });
    await c.waitFor(() => cardFor(original.id)?.querySelector("[aria-pressed=true]"), "favorited stencil is rendered");
    const nameInput = () => panel.querySelector(".excalidraw-resource-name-input");
    const key = (element, value) => element.dispatchEvent(new win.KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true }));
    cardFor(original.id).querySelector(".excalidraw-resource-rename").click();
    check(doc.activeElement === nameInput() && nameInput().selectionEnd === original.id.length,
      "Clicking a stencil name did not select the generated ID for editing");
    nameInput().value = "Canceled name";
    key(nameInput(), "Escape");
    check(!nameInput() && !((await diskItem()).name), "Cancel saved a stencil name or closed the panel");
    cardFor(original.id).querySelector(".excalidraw-resource-rename").click();
    nameInput().value = "Tall stencil";
    key(nameInput(), "Enter");
    search("Tall stencil");
    await c.waitFor(() => cardFor("Tall stencil"), "inline name appears in search");
    check((await diskItem()).name === "Tall stencil", "Inline rename did not reach the owning library");

    const controller = plugin.visualResourcePanel;
    const showMenu = controller.show;
    controller.show = function(menu, ...args) { return showMenu.call(this, menu.setUseNativeMenu(false), ...args); };
    try {
      cardFor("Tall stencil").querySelector(".excalidraw-resource-actions button:last-child").click();
      let menuItem;
      await c.waitFor(() => (menuItem = [...doc.querySelectorAll(".menu-item-title")]
        .find(el => el.textContent === plugin.getLabel("VR_RENAME"))), "stencil action menu has Rename");
      menuItem.closest(".menu-item").click();
      let editor;
      await c.waitFor(() => (editor = doc.querySelector('.modal input[aria-label="' + plugin.getLabel("VR_NAME") + '"]')),
        "menu rename opens the name editor");
      check(editor.value === "Tall stencil", "Menu rename lost the current stencil name");
      editor.value = "Renamed stencil";
      editor.dispatchEvent(new win.Event("input", { bubbles: true }));
      key(editor, "Enter");
      search("Renamed stencil");
      await c.waitFor(() => cardFor("Renamed stencil"), "menu name appears in search");
    } finally { controller.show = showMenu; }
    const renamed = await diskItem();
    check(renamed.name === "Renamed stencil" && renamed.id === original.id &&
      JSON.stringify(renamed.elements) === JSON.stringify(original.elements), "Renaming changed stencil identity or contents");
    check(plugin.visualResources.collections.state(stencilLocator).favorite && count() === before.size,
      "Renaming lost the favorite or inserted another stencil");
    plugin.settings.visualResources = preferences;
    return { assertions: ["tall stencil thumbnail fits entirely", "drag inserts visible and editable text when rawText is empty",
      "one undo removes the stencil", "inline rename accepts Enter and cancels with Escape",
      "action menu rename preserves identity, elements and curation"] };
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
    const receivingFile = await plugin.createDrawing("Resource drop receiver.excalidraw.md", root, drawingData);
    const receivingLeaf = workspace.openPopoutLeaf();
    c.defer(() => {
      if (workspace.getLeafById(receivingLeaf.id) === receivingLeaf) receivingLeaf.detach();
    });
    await c.waitFor(() => receivingLeaf.view.containerEl.ownerDocument !== view.ownerDocument, "receiving leaf migrated to its popout");
    await receivingLeaf.setViewState({ type: "excalidraw", state: { file: receivingFile.path }, active: true });
    await c.waitFor(() => {
      const receiver = receivingLeaf.view;
      c.observations.receiver = { sameDocument: receiver.ownerDocument === view.ownerDocument,
        loaded: !!receiver.isLoaded, hasEditor: !!receiver.excalidrawAPI,
        fileMatches: receiver.file === receivingFile };
      return receiver.file === receivingFile && receiver.ownerDocument !== view.ownerDocument && plugin.visualResources.writable(receiver);
    }, "writable receiving popout");
    const receiver = receivingLeaf.view;
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
