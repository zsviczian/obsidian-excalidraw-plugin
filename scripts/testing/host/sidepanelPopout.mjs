/** Focused native sidepanel placement, reuse, teardown and settings reload checks. */
import { runInAppTask } from "./inAppTask.mjs";

export const sidepanelPopoutCaseIds = [
  "native:sidepanel:sidebar-default",
  "native:sidepanel:popout-reuse",
  "native:sidepanel:settings-reload",
  "native:sidepanel:markdown-popout-focus",
  "native:sidepanel:location-setting-change",
];

export async function runSidepanelPopoutScenario({ cli, drawingPath }) {
  const result = await runInAppTask({
    cli, execute: exerciseSidepanelPopout, args: [drawingPath], timeoutMs: 120000, cleanupMs: 60000,
  });
  return { id: "sidepanel-popout", status: "passed", ...result };
}

async function exerciseSidepanelPopout(c, drawingPath) {
  const id = "obsidian-excalidraw-plugin", type = "excalidraw-sidepanel";
  const workspace = app.workspace, doc = workspace.containerEl.ownerDocument;
  const check = (condition, message) => { if (!condition) throw Error(message); };
  let plugin = app.plugins.plugins[id];
  check(plugin?.isReady, "Plugin is not ready");
  check(workspace.getLeavesOfType(type).length === 0, "Preexisting sidepanel must remain untouched");
  const markerKey = "__excalidrawSidepanelPopoutTest";
  const original = Object.fromEntries(["sidepanelOpenInPopout", markerKey].map(key =>
    [key, { present: Object.hasOwn(plugin.settings, key), value: plugin.settings[key] }]));
  const ownedLeaves = new Set();
  const windows = () => workspace.floatingSplit.children.map(win => win.id).sort().join();
  const originalWindows = windows();
  const closePanels = async () => {
    for (const leaf of ownedLeaves) {
      if (workspace.getLeavesOfType(type).includes(leaf)) leaf.detach();
    }
    await c.waitForCleanup(() => workspace.getLeavesOfType(type).length === 0 && windows() === originalWindows,
      "sidepanel leaves and owned popouts close");
  };
  c.defer(async () => {
    await closePanels();
    if (!app.plugins.plugins[id]) await app.plugins.enablePlugin(id);
    await c.waitForCleanup(() => app.plugins.plugins[id]?.isReady, "live plugin for settings restoration");
    plugin = app.plugins.plugins[id];
    for (const [key, saved] of Object.entries(original)) {
      if (saved.present) plugin.settings[key] = saved.value;
      else delete plugin.settings[key];
    }
    await plugin.saveSettings();
  });
  const open = async () => {
    const panel = await plugin.openSidepanel();
    check(panel, "Sidepanel did not open");
    ownedLeaves.add(panel.leaf);
    await c.waitFor(() => panel.containerEl.isConnected, "sidepanel DOM connects");
    return panel;
  };
  await c.case("native:sidepanel:sidebar-default", ["P08"], async () => {
    check(plugin.settings.sidepanelOpenInPopout === false, "Prepared default must be the sidebar");
    const panel = await open();
    check(panel.leaf.getRoot() === workspace.rightSplit, "Default sidepanel did not open in right sidebar");
    check(panel.containerEl.ownerDocument === doc, "Default panel opened in another window");
    await closePanels();
    return { assertions: ["default opens in right sidebar", "no popout created", "close removes panel"] };
  });
  await c.case("native:sidepanel:popout-reuse", ["P08"], async () => {
    plugin.settings.sidepanelOpenInPopout = true;
    const panel = await open();
    await c.waitFor(() => panel.containerEl.ownerDocument !== doc, "sidepanel reaches popout document");
    const tab = await panel.createTab({ title: "Native sidepanel test" });
    const input = tab.contentEl.createEl("textarea");
    input.value = "Keep panel input across repeated opens";
    check(input.ownerDocument === panel.containerEl.ownerDocument, "Tab belongs to wrong document");
    const repeat = await plugin.openSidepanel();
    check(repeat === panel && input.isConnected && input.value === "Keep panel input across repeated opens",
      "Repeated opening replaced panel or tab contents");
    check(workspace.getLeavesOfType(type).length === 1, "Repeated opening duplicated the sidepanel");
    plugin.settings.sidepanelOpenInPopout = false;
    check(await plugin.openSidepanel() === panel, "Preference change replaced a live panel");
    await closePanels();
    check(!input.isConnected, "Closed popout retained tab DOM");
    const sidebar = await open();
    check(sidebar.leaf.getRoot() === workspace.rightSplit, "Reopen did not apply changed preference");
    await closePanels();
    return { assertions: ["new panel in popout document", "tabs use popout document", "singleton preserves input", "close cleans up", "next open applies preference"] };
  });
  await c.case("native:sidepanel:settings-reload", ["P01", "P08"], async () => {
    const marker = { zero: 0, enabled: false, nested: { retained: true } };
    // The settings writer sorts object keys; assert values independent of key order.
    const hasMarker = value => value?.zero === 0 && value?.enabled === false && value?.nested?.retained === true;
    plugin.settings.sidepanelOpenInPopout = true;
    plugin.settings[markerKey] = marker;
    await plugin.saveSettings();
    const settingsPath = app.vault.configDir + "/plugins/" + id + "/data.json";
    const persisted = JSON.parse(await app.vault.adapter.read(settingsPath));
    c.observations ??= {};
    c.observations.sidepanelSettings = { persistedPreference: persisted.sidepanelOpenInPopout, persistedMarker: persisted[markerKey] };
    check(persisted.sidepanelOpenInPopout === true && hasMarker(persisted[markerKey]),
      "Non-default preference or unknown settings missing from disk");
    const previous = plugin;
    await app.plugins.disablePlugin(id);
    await app.plugins.enablePlugin(id);
    await c.waitFor(() => app.plugins.plugins[id]?.isReady, "replacement plugin startup");
    plugin = app.plugins.plugins[id];
    check(plugin !== previous && plugin.settings.sidepanelOpenInPopout === true, "Reload lost popout preference");
    check(hasMarker(plugin.settings[markerKey]), "Reload lost unknown settings");
    const loadedDisk = JSON.parse(await app.vault.adapter.read(settingsPath));
    check(loadedDisk.sidepanelOpenInPopout === true && hasMarker(loadedDisk[markerKey]),
      "Startup changed persisted preferences");
    const panel = await open();
    await c.waitFor(() => panel.containerEl.ownerDocument !== doc, "reloaded preference opens popout");
    await closePanels();
    return { assertions: ["non-default setting and unknown keys persisted", "new plugin loads them at startup", "disk preserved", "reloaded preference opens popout"] };
  });
  await c.case("native:sidepanel:location-setting-change", ["P08"], async () => {
    plugin.settings.sidepanelOpenInPopout = false;
    const sibling = workspace.getRightLeaf(false);
    const siblingId = sibling.id;
    c.defer(() => workspace.getLeafById(siblingId)?.detach());
    await sibling.setViewState({ type: "backlink", active: false });
    const panel = await open(), panelLeaf = panel.leaf;
    const tab = await panel.createTab({ title: "Keep script input while moving" });
    const input = tab.contentEl.createEl("textarea");
    input.value = "Unsaved script panel content";
    const settingsTab = plugin.settingsTab;
    const change = async (value, legacy = false) => {
      if (legacy) {
        const spec = settingsTab.getUIModeSpecs().find(spec => spec.control.key === "sidepanelOpenInPopout");
        await settingsTab.settingBindings.setLegacySpecValue(spec, value);
        await plugin.saveSettings();
      } else {
        settingsTab.getSettingDefinitions();
        await settingsTab.setControlValue("sidepanelOpenInPopout", value);
      }
    };
    const inPopout = expected => c.waitFor(() =>
      (panel.containerEl.ownerDocument !== doc) === expected && panelLeaf.view === panel,
      expected ? "existing panel moves to popout" : "existing panel returns to sidebar");
    const dock = workspace.rightSplit;
    const sidebarTabs = panelLeaf.parent;
    const originalGroups = [...dock.children];
    for (const legacy of [false, true]) {
      dock.collapse();
      await change(true, legacy);
      check(dock.collapsed && windows() === originalWindows && panelLeaf.getRoot() === dock,
        "Editing settings opened a window or expanded the sidebar");
      check(await plugin.openSidepanel(false) === panel && windows() === originalWindows,
        "A background panel lookup consumed the pending popout");
      tab.reveal();
      await inPopout(true);
      check(tab.contentEl.isConnected && input.value === "Unsaved script panel content", "Move replaced script input");
      await change(false, legacy); await inPopout(false);
      check(dock.collapsed, "Docking expanded the sidebar");
      await c.waitFor(() => windows() === originalWindows, "old popout closes after docking");
      check(panelLeaf.parent === sidebarTabs && sibling.parent === sidebarTabs &&
        sidebarTabs.children.includes(sibling) && sidebarTabs.children.includes(panelLeaf) &&
        dock.children.length === originalGroups.length && originalGroups.every((group, i) => dock.children[i] === group),
        "Docking stacked a group instead of adding a sibling tab");
    }
    await change(true);
    await change(false);
    check(await open() === panel && windows() === originalWindows, "Disabling did not cancel a queued popout");
    // Manual detach while the preference says sidebar must survive later opens
    // and same-value writes. Only the next actual preference change moves it.
    workspace.moveLeafToPopout(panelLeaf); await inPopout(true);
    check(await plugin.openSidepanel() === panel, "Manual popout was replaced");
    await change(false); await inPopout(true);
    await change(true); await change(false); await inPopout(false);
    await change(true); await open(); await inPopout(true);
    const placeholder = workspace.getRightLeaf(false), destination = placeholder.parent;
    panelLeaf.parent.removeChild(panelLeaf); panelLeaf.setDimension(null);
    destination.insertChild(-1, panelLeaf); placeholder.detach();
    await workspace.revealLeaf(panelLeaf); await inPopout(false);
    check(await plugin.openSidepanel() === panel, "Manual docking was replaced");
    await change(true); await inPopout(false);
    check(input.isConnected && input.value === "Unsaved script panel content" && workspace.getLeavesOfType(type).length === 1,
      "Setting changes replaced tabs or duplicated the panel");
    await closePanels();
    // Reload a saved collapsed layout with a deferred Excalidraw sidebar tab.
    // Use the host layout restore path so the leaf is genuinely deferred.
    plugin.settings.sidepanelOpenInPopout = false;
    await workspace.revealLeaf(sibling);
    dock.collapse();
    const restorable = await plugin.openSidepanel(false);
    check(restorable, "Could not stage a sidebar panel for layout restoration");
    ownedLeaves.add(restorable.leaf);
    const layout = workspace.getLayout();
    await closePanels();
    await workspace.changeLayout(layout);
    const deferredLeaf = workspace.getLeavesOfType(type)[0];
    if (deferredLeaf) ownedLeaves.add(deferredLeaf);
    check(deferredLeaf?.isDeferred && workspace.rightSplit.collapsed, "Restored panel was not deferred in the collapsed sidebar");
    await change(true);
    check(deferredLeaf.isDeferred && windows() === originalWindows, "Changing settings loaded or moved the deferred panel");
    const restoredPanel = await open();
    check(restoredPanel.leaf === deferredLeaf && !deferredLeaf.isDeferred, "Reveal did not load the original deferred panel");
    await c.waitFor(() => restoredPanel.containerEl.ownerDocument !== doc, "deferred panel reaches popout on first reveal");
    await closePanels();
    workspace.getLeafById(siblingId)?.detach();
    return { assertions: ["both settings adapters defer popout until reveal", "docking preserves collapsed sidebar and sibling tabs", "same view and script input survive", "manual moves and cancellation are respected", "restored deferred panel moves on its first reveal"] };
  });
  await c.case("native:sidepanel:markdown-popout-focus", ["P05", "P08"], async () => {
    plugin.settings.sidepanelOpenInPopout = true;
    const leaf = workspace.getLeavesOfType("excalidraw").find(leaf => leaf.view.file?.path === drawingPath);
    check(leaf, "Owned test drawing is unavailable after reload");
    await c.waitFor(() => leaf.view.excalidrawAPI && leaf.view.isLoaded && !leaf.view.semaphores.justLoaded,
      "drawing ready for Markdown insertion");
    const view = leaf.view, api = view.excalidrawAPI;
    workspace.setActiveLeaf(leaf, { focus: true });
    doc.defaultView.focus();
    api.updateScene({ appState: { selectedElementIds: {} }, captureUpdate: "NEVER" });
    const before = new Set(api.getSceneElements().map(element => element.id));
    // Invoke the actual context-menu action, including its normal onClose callback.
    const menu = view.onContextMenu(api.getSceneElements(), api.getAppState(), callback => callback?.());
    const findAction = node => {
      if (!node) return null;
      if (Array.isArray(node)) return node.map(findAction).find(Boolean);
      if (node.props?.["data-testid"] === "insertMarkdownImage") return node;
      return findAction(node.props?.children);
    };
    const action = findAction(menu);
    check(action, "Insert editable Markdown image context-menu action is missing");
    action.props.onClick();
    await c.waitFor(() => workspace.getLeavesOfType(type).length === 1, "Markdown popout created");
    const panelLeaf = workspace.getLeavesOfType(type)[0];
    ownedLeaves.add(panelLeaf);
    const panel = panelLeaf.view;
    await c.waitFor(() => panel.containerEl.ownerDocument !== doc &&
      panel.containerEl.querySelector(".excalidraw-markdown-image-editor__markdown-view .cm-content"),
      "Markdown editor mounted in popout");
    await c.waitFor(() => api.getSceneElements().some(element => !before.has(element.id) && element.type === "image"),
      "editable Markdown image inserted");
    await new Promise(resolve => window.setTimeout(resolve, 900));
    const panelDoc = panel.containerEl.ownerDocument;
    const remote = doc.defaultView.require("@electron/remote");
    const popout = remote.BrowserWindow.getAllWindows().find(win => win.webContents.id ===
      panelDoc.defaultView.require("@electron/remote").getCurrentWebContents().id);
    const editor = workspace.activeEditor;
    c.observations ??= {};
    c.observations.markdownPopoutFocus = {
      focusedWindow: remote.BrowserWindow.getFocusedWindow()?.id, popout: popout?.id,
      documentFocused: panelDoc.hasFocus(), activeEditorInPopout: editor?.containerEl?.ownerDocument === panelDoc,
      editorContainerInPopout: editor?.leaf?.getContainer()?.doc === panelDoc,
      activeElement: panelDoc.activeElement?.className,
    };
    check(popout?.isFocused() && panelDoc.hasFocus(), "Markdown insertion brought the main window in front of its popout");
    check(panel.containerEl.querySelector(".cm-content")?.contains(panelDoc.activeElement), "Markdown editor did not retain keyboard focus");
    const sourceSection = panel.containerEl.querySelector(".excalidraw-markdown-image-editor__source");
    check(Number.parseFloat(panelDoc.defaultView.getComputedStyle(sourceSection).paddingTop) >= 8,
      "Markdown extraction section lacks top padding");
    await closePanels();
    await c.waitForCleanup(() => !view.isSameFileEditingActive() && !view.isPersistenceBusy(), "Markdown editor flush settles");
    return { assertions: ["actual context-menu action inserts editable image", "popout remains foreground after insertion", "editor retains keyboard focus", "close flushes editor"] };
  });
  return { tests: c.tests };
}
