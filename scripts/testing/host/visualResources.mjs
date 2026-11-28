/** Native Visual Resources gestures, curation, and blank-drawing framework workflow. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInAppTask } from "./inAppTask.mjs";
import { behaviorInputDriver } from "./behaviorMatrix.mjs";

export const visualResourceCaseIds = [
  "native:visual-resources:palette-and-insertion",
  "native:visual-resources:panel-controls",
  "native:visual-resources:stencils",
  "native:visual-resources:svg-strokes-and-curation",
  "native:visual-resources:document-targets-and-preview-budget",
  "native:visual-resources:popout-drop",
  "native:visual-resources:framework-picker",
  "native:visual-resources:reload",
];

export async function runVisualResourcesScenario({ cli, drawingPath, reportDir }) {
  const library = JSON.parse(readFileSync(new URL("../../../visual-frameworks/thinking-frameworks.excalidrawlib", import.meta.url), "utf8"));
  library.libraryItems = library.libraryItems.slice(0, 1);
  const input = behaviorInputDriver(cli);
  const result = await runInAppTask({ cli, execute: exercise, args: [drawingPath, library], timeoutMs: 150000, cleanupMs: 60000,
    onRequest: request => {
      if (request.method !== "resource-settings-screenshot") return input(request);
      cli("dev:screenshot", "path=" + join(reportDir, "visual-resource-settings.png"));
      return { captured: true };
    },
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
    const toolbarLabels = [...panel.querySelectorAll(".excalidraw-resource-search-tools button")].map(button => button.getAttribute("aria-label"));
    check(toolbarLabels.join("|") === ["VR_FILTER", "VR_COLLECTIONS", "VR_SELECT", "VR_LAYOUT", "VR_SETTINGS", "VR_POPOUT"]
      .map(key => plugin.getLabel(key)).join("|"), "Toolbar actions are out of order or still include the help button");
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
    const filterOption = key => panel.querySelector('.excalidraw-resource-filter-popover [data-filter="' + key + '"]');
    const groups = JSON.stringify(plugin.settings.visualResources.groups);
    filter.click();
    await c.waitFor(() => filterOption("none"), "filter popover opens");
    filterOption("none").click();
    check(!plugin.settings.visualResources.filters.length && JSON.stringify(plugin.settings.visualResources.groups) === groups,
      "Select none changed discovery groups or left resource types enabled");
    check(!panel.querySelector(".excalidraw-resource-card"), "Select none left visible results");
    check(filter.getAttribute("aria-expanded") === "true" && !filterOption("has-named-frames") &&
      !panel.querySelector(".excalidraw-resource-filter-section"), "Disabling resource types closed the popover or left fine filters visible");
    filterOption("all").click();
    check(plugin.settings.visualResources.filters.includes("other") && JSON.stringify(plugin.settings.visualResources.groups) === groups,
      "Select all changed discovery groups or skipped a resource type");
    check(filter.getAttribute("aria-expanded") === "true" && filterOption("has-named-frames").parentElement.textContent.includes("2.29.4"),
      "The drawing facet was missing its requirement, or the popover closed after editing");
    filterOption("done").click();
    toolbarButton("VR_SETTINGS").click();
    let settings;
    await c.waitFor(() => (settings = doc.querySelector(".excalidraw-resource-settings-modal")), "settings opens the compact editor");
    const grids = settings.querySelector(".excalidraw-resource-settings-card .excalidraw-resource-settings-grid");
    const ruleName = () => settings.querySelector(".excalidraw-resource-settings-card-header input");
    check(settings.querySelectorAll(".excalidraw-resource-settings-card").length === 1 &&
      win.getComputedStyle(grids).gridTemplateColumns.split(" ").length === 2 &&
      settings.querySelectorAll('input[type="color"]').length === 2,
      "Settings did not show one paged rule, a two-column card, and color swatches");
    const firstRule = ruleName().value;
    settings.querySelector(".excalidraw-resource-settings-pager button:last-child").click();
    check(ruleName().value !== firstRule, "Rule navigation did not change the editable card");
    settings.querySelector(".excalidraw-resource-settings-pager button:first-child").click();
    await c.requestHost("resource-settings-screenshot", {});
    const closeSettings = settings.querySelector(".modal-close-button, .modal-header-button");
    if (closeSettings) closeSettings.click();
    else await c.requestHost("behavior-input", {
      contentsId: win.require("@electron/remote").getCurrentWebContents().id,
      method: "Input.dispatchKeyEvent",
      params: [{ type: "keyDown", key: "Escape", code: "Escape" }, { type: "keyUp", key: "Escape", code: "Escape" }],
    });
    await c.waitFor(() => !settings.isConnected, "settings dismissal completes");
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
    selectedActions.click();
    await menuAction("VR_FAVORITE");
    await c.waitFor(() => plugin.visualResources.collections.state(locator).favorite, "bulk favorite applied without an existing playlist");
    await plugin.visualResources.collections.curate([locator], { favorite: false });
    await c.waitFor(() => !plugin.visualResources.collections.state(locator).favorite, "test favorite cleared");
    checkbox.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    check(!panel.querySelector(".excalidraw-resource-checkbox") && card() && count() === before,
      "Exiting selection mode changed the scene or left selection controls");

    await vault.create(root + "/icon - Resource probe second.svg", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>');
    const actions = () => card().closest(".excalidraw-resource-card").querySelector(".excalidraw-resource-actions button:last-child");
    const isBusy = view.isPersistenceBusy;
    let busy = true;
    view.isPersistenceBusy = () => busy || isBusy.call(view);
    try {
      actions().click();
      await menuAction("VR_INSERT_SVG");
      check(count() === before, "Insertion published before its target finished saving");
      busy = false;
      await c.waitFor(() => count() === before + 1, "insertion requested during save publishes without canvas refocus");
      api.history.undo();
      await c.waitFor(() => count() === before, "one undo removes the single insertion");
    } finally { view.isPersistenceBusy = isBusy; }
    toolbarButton("VR_SELECT").click();
    const bulkFixtures = new Set(["Resource probe", "Resource probe second"]);
    const bulkInputs = () => [...panel.querySelectorAll(".excalidraw-resource-checkbox")]
      .filter(input => bulkFixtures.has(input.getAttribute("aria-label")));
    await c.waitFor(() => bulkInputs().length === bulkFixtures.size, "both bulk insert resources are listed");
    for (const input of bulkInputs()) input.click();
    selectedActions.click();
    await menuAction("VR_INSERT_SELECTED");
    await c.waitFor(() => count() === before + 2, "bulk insertion publishes both SVGs");
    api.history.undo();
    await c.waitFor(() => count() === before, "a single undo removes the bulk insertion");
    toolbarButton("VR_EXIT_SELECTION").click();

    const ea = plugin.ea.getAPI(view);
    try {
      const frameId = ea.addFrame(480, 310, 230, 160, "Divider test frame");
      ea.addElementsToFrame(frameId, [ea.addRect(500, 340, 55, 43)]);
      ea.addFrame(760, 310, 180, 160, "Second frame");
      ea.addFrame(980, 310, 180, 160, "Third frame");
      check(await ea.addElementsToView(false, true, true), "Could not save the owned frame fixture");
    } finally { ea.destroy(); }
    search("Divider test frame");
    let framesButton;
    await c.waitFor(() => (framesButton = [...panel.querySelectorAll(".excalidraw-resource-actions button")]
      .find(button => button.getAttribute("aria-label") === plugin.getLabel("VR_BROWSE_FRAMES") + " (3)" &&
        !button.classList.contains("excalidraw-display-none"))), "named-frame count in search results");
    framesButton.click();
    const divider = panel.querySelector(".excalidraw-resource-divider");
    const galleryPane = panel.querySelector(".excalidraw-resource-main");
    const framePane = panel.querySelector(".excalidraw-resource-frames");
    await c.waitFor(() => framePane.querySelector(".excalidraw-resource-body")?.textContent.includes("Divider test frame"),
      "frame selector with a visible split divider");
    check(framePane.querySelectorAll(".excalidraw-resource-body").length === 3, "The master query hid other frames from the selected drawing");
    let x, y;
    await c.waitFor(() => {
      const start = divider.getBoundingClientRect();
      x = Math.round(start.left + start.width / 2);
      y = Math.round(start.top + start.height / 2);
      const hit = doc.elementFromPoint(x, y);
      c.observations.frameDivider = { x, y, hit: hit?.className, bounds: start.toJSON(),
        gallery: galleryPane.getBoundingClientRect().height, frames: framePane.getBoundingClientRect().height,
        ratio: win.devicePixelRatio, scale: win.visualViewport?.scale, events: [] };
      return hit === divider;
    }, "frame divider is unobstructed");
    const beforeHeight = galleryPane.getBoundingClientRect().height;
    const contentsId = win.require("@electron/remote").getCurrentWebContents().id;
    const record = event => c.observations.frameDivider.events.push({ type: event.type, x: event.clientX, y: event.clientY,
      target: event.target.className?.baseVal ?? event.target.className, trusted: event.isTrusted });
    for (const type of ["pointerdown", "pointermove", "pointerup"]) doc.addEventListener(type, record, true);
    try {
      await c.requestHost("behavior-input", { contentsId, method: "Input.dispatchMouseEvent", params: [
        { type: "mouseMoved", x, y, button: "none", buttons: 0 },
        { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 },
        { type: "mouseMoved", x, y: y - 45, button: "left", buttons: 1 },
        { type: "mouseReleased", x, y: y - 45, button: "left", buttons: 0, clickCount: 1 },
      ] });
      c.observations.frameDivider.after = { height: galleryPane.getBoundingClientRect().height, split: divider.getAttribute("aria-valuenow") };
    } finally {
      for (const type of ["pointerdown", "pointermove", "pointerup"]) doc.removeEventListener(type, record, true);
    }
    await c.waitFor(() => galleryPane.getBoundingClientRect().height < beforeHeight - 12, "pointer drag grows the frame pane");
    const afterPointer = Number(divider.getAttribute("aria-valuenow"));
    divider.dispatchEvent(new win.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    check(Number(divider.getAttribute("aria-valuenow")) > afterPointer, "Divider keyboard input did not resize the panes");
    check(query.value === "Divider test frame" && framePane.querySelector(".excalidraw-resource-body"),
      "Resizing dropped search or frame context");
    search("second.svg");
    check(!framesButton.isConnected && galleryPane.querySelector('[aria-label="Resource probe second"]'),
      "A search for the unrelated SVG did not replace the selected drawing in the gallery");
    check(divider.classList.contains("excalidraw-display-none") && !framePane.querySelector(".excalidraw-resource-body"),
      "Leaving the selected drawing outside the search results left its frames visible");
    controller.show = showMenu;
    plugin.settings.visualResources = preferences;
    await plugin.saveSettings();
    return { assertions: ["canvas button uses neighboring toolbar styling", "toolbar shares the search row at wide widths and wraps when narrow",
      "bulk filter actions change resource types and preserve their fine filters",
      "bulk favorite works without a playlist, and selection preserves the scene",
      "settings uses a paged compact editor and both background swatches",
      "context insertion remains available while the drawing saves, and bulk insertion has one undo",
      "frame pane shows the entire selection and follows the parent search results"] };
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
    const sibling = { ...original, id: "sibling", name: "stencil-probe-zz sibling", elements: [original.elements[0]] };
    const file = await vault.create(libraryFolderPath + "/Probe.excalidrawlib", JSON.stringify({
      ...library, source: "native-test", libraryItems: [original, sibling],
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
    search("stencil-probe");
    const thumbnail = title => cardFor(title)?.querySelector(".excalidraw-resource-preview img");
    await c.waitFor(() => thumbnail(original.id)?.complete && thumbnail(sibling.name)?.complete, "both previews load");
    const originalCard = cardFor(original.id), originalPreview = thumbnail(original.id);
    const siblingCard = cardFor(sibling.name), siblingPreview = thumbnail(sibling.name);
    const resources = plugin.visualResources;
    const previewResource = resources.preview;
    const previewRequests = [];
    resources.preview = function(resource, dark) {
      if (resource.locator.provider === "stencil") previewRequests.push(resource.locator.id);
      return previewResource.call(this, resource, dark);
    };
    c.defer(() => { resources.preview = previewResource; });
    cardFor(original.id).querySelector(".excalidraw-resource-rename").click();
    nameInput().value = "Tall stencil";
    key(nameInput(), "Enter");
    await c.waitFor(() => cardFor("Tall stencil"), "rename stays in the original search results");
    check(cardFor("Tall stencil") === originalCard && originalCard.nextElementSibling === siblingCard &&
      doc.activeElement === originalCard.querySelector(".excalidraw-resource-rename"), "Rename changed tile position or keyboard focus");
    plugin.visualResourcePanel.reload();
    await c.waitFor(() => !panel.querySelector(".excalidraw-resource-status[aria-live]").textContent, "background refresh finishes");
    check(thumbnail("Tall stencil") === originalPreview && thumbnail(sibling.name) === siblingPreview,
      "Rename or background refresh recreated the loaded previews");
    search("");
    check(siblingCard.nextElementSibling === originalCard && thumbnail(sibling.name) === siblingPreview,
      "Changing the query should apply normal sort and reuse unmoved preview data");
    check(!previewRequests.length, "Rename, refresh, or sorting requested previews for unchanged stencils: " + previewRequests.join(", "));
    await vault.process(file, raw => {
      const data = JSON.parse(raw);
      data.libraryItems[1].elements[0].backgroundColor = "#3388ff";
      return JSON.stringify(data);
    });
    await c.waitFor(() => thumbnail(sibling.name) && thumbnail(sibling.name) !== siblingPreview, "edited stencil preview refreshes");
    check(thumbnail("Tall stencil") === originalPreview && previewRequests.every(id => id === sibling.id),
      "Editing one stencil requested unrelated stencil previews");
    resources.preview = previewResource;
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
      "action menu rename preserves identity, elements and curation",
      "rename preserves search context, tile position and keyboard focus",
      "refresh and sort reuse loaded previews, while edits refresh only their own stencil"] };
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
    const doc = panel.ownerDocument, win = doc.defaultView, controller = plugin.visualResourcePanel;
    const previous = Object.getOwnPropertyDescriptor(win, "kplexApi");
    const showMenu = controller.show;
    Object.defineProperty(win, "kplexApi", { configurable: true, value: { version: 1, v1: {
      version: 1,
      capabilities: () => ({ ok: true, value: { operations: ["ontology"] } }),
      ontology: () => ({ ok: true, value: { fields: [
        { name: "Illustration parent", configured: true, roles: ["parent"] },
        { name: "Derived artwork", configured: true, roles: ["child"] },
      ] } }),
    } } });
    controller.show = function(menu, ...args) { return showMenu.call(this, menu.setUseNativeMenu(false), ...args); };
    try {
      await controller.open(view);
      search("Resource probe");
      await c.waitFor(() => card() && resources.writable(view), "SVG stroke options have an editable drawing");
      card().closest(".excalidraw-resource-card").querySelector(".excalidraw-resource-actions button:last-child").click();
      let strokes;
      await c.waitFor(() => (strokes = [...doc.querySelectorAll(".menu-item-title")]
        .find(el => el.textContent === plugin.getLabel("VR_INSERT_STROKES"))), "stroke insertion offers a property chooser");
      strokes.closest(".menu-item").click();
      let modal;
      await c.waitFor(() => (modal = [...doc.querySelectorAll(".modal")].find(el => el.querySelector(".modal-title")?.textContent ===
        plugin.getLabel("VR_INSERT_STROKES"))), "SVG stroke dialog opens");
      const setting = key => [...modal.querySelectorAll(".setting-item-name")]
        .find(el => el.textContent === plugin.getLabel(key))?.closest(".setting-item");
      setting("VR_SVG_RETAIN_LINK").querySelector(".checkbox-container").click();
      const direction = setting("VR_KPLEX_DIRECTION").querySelector("select");
      const fields = setting("VR_KPLEX_FIELD").querySelector("select");
      check([...fields.options].some(option => option.value === "Illustration parent") &&
        ![...fields.options].some(option => option.value === "Derived artwork"), "K-Plex fields did not follow the selected relationship direction");
      direction.value = "child";
      direction.dispatchEvent(new win.Event("change", { bubbles: true }));
      fields.value = "Derived artwork";
      fields.dispatchEvent(new win.Event("change", { bubbles: true }));
      check(setting("VR_SVG_PROPERTY").querySelector("input").value === "Derived artwork", "Chosen K-Plex property did not reach the editable field");
      modal.querySelector("button.mod-cta").click();
      await c.waitFor(() => app.metadataCache.getFileCache(view.file)?.frontmatter?.["Derived artwork"]?.length === 1,
        "stroke insertion writes the chosen K-Plex property");
    } finally {
      if (previous) Object.defineProperty(win, "kplexApi", previous);
      else Reflect.deleteProperty(win, "kplexApi");
      controller.show = showMenu;
    }
    await resources.collections.savePlaylist("Native playlist", "native-list");
    await resources.collections.curate([locator], { favorite: true, playlist: "native-list", member: true });
    await resources.collections.refresh();
    check(resources.collections.state(locator).favorite && resources.collections.state(locator).memberships.includes("native-list"), "Favorite and playlist membership did not persist");
    await resources.collections.curate([locator], { playlist: "native-list", member: false });
    check(resources.collections.state(locator).favorite && !resources.collections.state(locator).memberships.includes("native-list"), "Removing membership changed the independent favorite");
    return { assertions: ["SVG conversion publishes editable elements", "source link appears in the default and selected ontology properties",
      "playlist membership and favorite are independent"], sourceLinks: 1, nativeElements: count() - before };
  });
  await runCase("native:visual-resources:document-targets-and-preview-budget", async () => {
    const doc = panel.ownerDocument;
    const original = await vault.read(view.file);
    const large = await vault.create(root + "/Large frame preview probe.excalidraw.md", original + "\n" + " ".repeat(1024 * 1024 + 128));
    const medium = await vault.create(root + "/Medium linked preview probe.excalidraw.md", original + "\n" + " ".repeat(128 * 1024));
    const solidRaster = async (name, color) => {
      const canvas = doc.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
      return await vault.createBinary(root + "/" + name, await blob.arrayBuffer());
    };
    const inside = await solidRaster("Preview inside.jpg", "#23c46e");
    const outside = await solidRaster("Preview outside.jpg", "#b20a92");
    const sourceImage = api.getSceneElements().find(el => el.type === "image");
    const sourceFrame = api.getSceneElements().find(el => el.type === "frame");
    check(sourceImage && sourceFrame, "Preview fixture is missing its native image and frame");
    const makeImage = (id, fileId, x) => ({ ...sourceImage, id, fileId, x, y: 0,
      frameId: null, angle: 0, width: 400, height: 300, crop: null, scale: [1, 1], index: null, groupIds: [], opacity: 100 });
    const previewFrame = { ...sourceFrame, id: "preview-frame", name: "Thumbnail", x: 0, y: 0, width: 400, height: 300 };
    const fence = String.fromCharCode(96).repeat(3);
    const savedDrawing = (elements, frontmatter = "", embedded = "") => {
      const json = JSON.stringify({ type: "excalidraw", version: 2, elements, appState: {}, files: {} });
      const compressed = plugin.ea.compressToBase64(json);
      return "---\nexcalidraw-plugin: parsed\n" + frontmatter + "---\n\n# Excalidraw Data\n\n" +
        embedded + "\n## Drawing\n" + fence + "compressed-json\n" + compressed + "\n" + fence + "\n";
    };
    const linked = await vault.create(root + "/Preview linked frame.excalidraw.md", savedDrawing([
      previewFrame, makeImage("preview-inside", "inside", 0), makeImage("preview-outside", "outside", 700),
    ], "excalidraw-thumbnail: Thumbnail\n", "## Embedded Files\ninside: [[" + inside.path + "]]\n\noutside: [[" + outside.path + "]]\n"));
    const line = library.libraryItems[0].elements.find(el => el.type === "line");
    const detailed = await vault.create(root + "/Preview detailed vectors.excalidraw.md", savedDrawing(
      Array.from({ length: 1734 }, (_, i) => ({ ...line, id: "preview-line-" + i, index: null, groupIds: [],
        x: (i % 40) * 32, y: Math.floor(i / 40) * 18, width: 29, height: 6,
        points: Array.from({ length: 30 }, (_, point) => [point, point % 2 * 6]), boundElements: null, angle: 0 }))));
    await c.waitFor(() => app.metadataCache.getFileCache(linked)?.frontmatter?.["excalidraw-thumbnail"] === "Thumbnail",
      "saved thumbnail frame is indexed");
    await c.waitFor(() => app.metadataCache.getFileCache(large)?.frontmatter?.["excalidraw-anchors"]?.includes("Divider test frame"),
      "large drawing has indexed frame metadata");
    const note = await vault.create(root + "/Destination note.md", "Test note\n");
    const canvas = await vault.create(root + "/Destination canvas.canvas", '{"nodes":[],"edges":[]}');
    const documentLeaf = workspace.getLeaf("tab");
    c.defer(() => documentLeaf.detach());
    await documentLeaf.setViewState({ type: "markdown", state: { file: note.path, mode: "source" }, active: true });
    await c.waitFor(() => documentLeaf.view.file === note && documentLeaf.view.getMode() === "source", "note editor is writable");
    workspace.setActiveLeaf(documentLeaf, { focus: true });
    check(app.commands.executeCommandById(id + ":visual-resources"), "Visual Resources command unavailable from Markdown");
    await c.waitFor(() => plugin.visualResourcePanel.target === documentLeaf.view, "Markdown is the insertion target");
    search("Resource probe");
    await c.waitFor(() => card()?.getAttribute("aria-disabled") === null, "SVG can be embedded in Markdown");
    card().click();
    await c.waitFor(() => documentLeaf.view.editor.getValue().includes("![[") &&
      documentLeaf.view.editor.getValue().includes("Resource probe"), "note has a linked SVG embed");
    const editor = documentLeaf.view.editor;
    editor.setValue("Above\nBelow");
    const cm = editor.cm;
    await c.waitFor(() => cm?.coordsAtPos(6), "Markdown editor has drop coordinates");
    const coords = cm.coordsAtPos(6);
    const win = cm.dom.ownerDocument.defaultView;
    const transfer = new win.DataTransfer();
    card().dispatchEvent(new win.DragEvent("dragstart", { dataTransfer: transfer, bubbles: true }));
    const dragEvent = type => new win.DragEvent(type, { dataTransfer: transfer, clientX: coords.left + 1,
      clientY: (coords.top + coords.bottom) / 2, bubbles: true, cancelable: true });
    const over = dragEvent("dragover"), drop = dragEvent("drop");
    cm.contentDOM.dispatchEvent(over);
    cm.contentDOM.dispatchEvent(drop);
    check(over.defaultPrevented && drop.defaultPrevented && editor.getValue().startsWith("Above\n![[") &&
      editor.getValue().endsWith("Below"), "Markdown drop did not insert the embed at the pointed-to position");
    const controller = plugin.visualResourcePanel;
    const show = controller.show;
    controller.show = function(menu, ...args) { return show.call(this, menu.setUseNativeMenu(false), ...args); };
    try {
      card().closest(".excalidraw-resource-card").querySelector(".excalidraw-resource-actions button:last-child").click();
      await c.waitFor(() => [...doc.querySelectorAll(".menu-item-title")].some(el => el.textContent === plugin.getLabel("VR_SVG_OPTIONS")),
        "stroke source defaults are available from Markdown");
      check(![...doc.querySelectorAll(".menu-item-title")].some(el => el.textContent === plugin.getLabel("VR_INSERT_STROKES")),
        "Markdown menu offered to insert editable strokes");
      controller.menu.hide();
    } finally { controller.show = show; }

    const read = vault.read;
    const cachedRead = vault.cachedRead;
    let largeReads = 0;
    vault.read = function(file) {
      if (file === large) largeReads++;
      return read.call(this, file);
    };
    vault.cachedRead = function(file) {
      if (file === large) largeReads++;
      return cachedRead.call(this, file);
    };
    try {
      search("Large frame preview probe");
      let browse;
      await c.waitFor(() => (browse = [...panel.querySelectorAll(".excalidraw-resource-main .excalidraw-resource-actions button")]
        .find(button => button.getAttribute("aria-label") === plugin.getLabel("VR_BROWSE_FRAMES") + " (3)")),
        "large drawing uses its indexed frame count");
      browse.click();
      await c.waitFor(() => panel.querySelector(".excalidraw-resource-frames .excalidraw-resource-body")?.textContent.includes("Divider test frame"),
        "large drawing lists frames from its metadata");
      const resources = plugin.visualResources;
      const descriptor = (await resources.list()).find(item => item.source === large.path);
      const mediumResource = (await resources.list()).find(item => item.source === medium.path);
      check((await resources.preview(mediumResource, false))?.startsWith("data:image/png"), "A medium drawing with linked assets did not produce a tiny raster preview");
      const previews = await resources.list();
      const linkedResource = previews.find(item => item.source === linked.path);
      const detailedResource = previews.find(item => item.source === detailed.path);
      const readBinary = vault.readBinary, rasterReads = [];
      vault.readBinary = function(file) {
        if (file === inside || file === outside) rasterReads.push(file.path);
        return readBinary.call(this, file);
      };
      try {
        const url = await resources.preview(linkedResource, false);
        check(url?.startsWith("data:image/png"), "Cold linked thumbnail frame did not produce a PNG");
        const image = doc.createElement("img");
        image.src = url;
        await image.decode();
        check(image.naturalWidth === 256 && image.naturalHeight === 192, "Thumbnail did not preserve the chosen frame's bounds");
        const sample = doc.createElement("canvas");
        sample.width = sample.height = 1;
        const ctx = sample.getContext("2d");
        ctx.drawImage(image, -128, -96);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        check(g > 165 && r < 75 && b < 145 && a === 255, "Linked JPEG pixels were replaced by a placeholder: " + [r, g, b, a]);
        check(await resources.preview(linkedResource, false) === url && rasterReads.join("|") === inside.path,
          "A warm request reloaded the raster or the renderer read assets outside the thumbnail frame");
        check((await resources.preview(detailedResource, false))?.startsWith("data:image/png"),
          "The detailed cold drawing with 1,734 elements and 52,020 stroke points did not produce a PNG");
      } finally { vault.readBinary = readBinary; }
      check(await resources.preview(descriptor, false) === null, "Cold large drawing was rendered");
      const frame = (await resources.frames(descriptor))[0];
      check(await resources.preview(frame, false) === null && largeReads === 0,
        "Listing a large drawing or frame read its full scene");
      const placeholder = [...panel.querySelectorAll(".excalidraw-resource-main .excalidraw-resource-card")]
        .find(el => el.textContent.includes("Large frame preview probe")).querySelector(".excalidraw-resource-preview svg");
      const registered = plugin.drawingCreationUI.ribbon.querySelector("svg");
      check(placeholder && placeholder.innerHTML === registered.innerHTML, "An uncached drawing did not use the ribbon icon");
      panel.querySelector(".excalidraw-resource-frames .excalidraw-resource-body").click();
      await c.waitFor(() => documentLeaf.view.editor.getValue().includes("#^frame="), "named frame embedded in Markdown");

      await documentLeaf.openFile(canvas);
      workspace.setActiveLeaf(documentLeaf, { focus: true });
      await c.waitFor(() => documentLeaf.view.getViewType() === "canvas" && plugin.visualResourcePanel.target === documentLeaf.view,
        "native Canvas is the insertion target");
      const frameCard = () => panel.querySelector(".excalidraw-resource-frames .excalidraw-resource-body");
      await c.waitFor(() => frameCard()?.getAttribute("aria-disabled") === null, "named frame can be added to Canvas");
      frameCard().click();
      await c.waitFor(async () => JSON.parse(await read.call(vault, canvas)).nodes.some(node =>
        node.type === "file" && node.file === large.path && node.subpath?.startsWith("#^frame=")), "Canvas saved a native frame file node");
    } finally { vault.read = read; vault.cachedRead = cachedRead; }
    await documentLeaf.setViewState({ type: "empty", state: {} });
    documentLeaf.detach();
    workspace.setActiveLeaf(leaf, { focus: true });
    await plugin.visualResourcePanel.open(view);
    check(doc === panel.ownerDocument, "document insertion changed the panel's owning document");
    return { assertions: ["Markdown receives linked SVG and named-frame embeds, including drop at the pointer",
      "Canvas saves a native file node with its frame subpath",
      "low-resolution drawing PNGs retain linked JPEG pixels and skip assets outside the selected frame",
      "detailed vector scenes produce a PNG and over-budget cold files use the ribbon icon without reading the scene"] };
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
