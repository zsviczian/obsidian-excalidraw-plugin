/** Native PR #3030 regressions, using only the coordinator's owned test vault. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInAppTask } from "./inAppTask.mjs";

export const workflowBundleCaseIds = ["native:workflow-markdown-extraction-3009", "native:workflow-zen-controls-3000"];

export async function runWorkflowBundleScenario({ cli, drawingPath }) {
  assert.ok(drawingPath.startsWith("__excalidraw_cli_smoke_"));
  const prefix = drawingPath.replace(/\.(excalidraw\.md|excalidraw|md)$/, "") + "_bundle";
  const fixture = readFileSync(new URL("../../../tests/vault/Drawings/Uncompressed.excalidraw.md", import.meta.url), "utf8");
  const result = await runInAppTask({ cli, execute: exerciseWorkflows, args: [prefix, fixture], timeoutMs: 180000, cleanupMs: 60000 });
  return { id: "workflow-bundle-3030", status: "passed", ...result };
}

async function exerciseWorkflows(c, prefix, fixture) {
  const plugin = app.plugins.plugins["obsidian-excalidraw-plugin"];
  const mainDocument = app.workspace.containerEl.ownerDocument;
  const previous = app.workspace.activeLeaf, leaves = new Set(), tabs = new Set(), rootFiles = new Set();
  const attachmentFolderPath = app.vault.getConfig("attachmentFolderPath");
  c.observations = {};
  const check = (condition, message) => { if (!condition) throw Error(message); };
  const closeTab = async (tab, view) => {
    tab.close(); tabs.delete(tab);
    await c.waitForCleanup(() => !view.sameFileEditGate.hasActiveOwners && !view.isSaveInProgress(), "Markdown editor close persistence");
  };
  const closeLeaf = async leaf => {
    const view = leaf.view, doc = view.containerEl.ownerDocument;
    if (view.excalidrawAPI && view.isDirty()) check((await view.saveWithOutcome()).status === "persisted", "owned drawing cleanup save");
    if (doc === mainDocument) { await leaf.setViewState({ type: "empty", state: {} }); leaf.detach(); }
    else {
      leaf.detach();
      if (app.workspace.floatingSplit.children.some(child => child.doc === doc)) doc.defaultView.close();
      await c.waitForCleanup(() => !view.excalidrawAPI && !view.containerEl.isConnected &&
        !app.workspace.floatingSplit.children.some(child => child.doc === doc), "owned popout teardown");
    }
    leaves.delete(leaf);
  };
  c.defer(async () => {
    try {
      for (const doc of new Set([mainDocument, ...[...leaves].map(leaf => leaf.view.containerEl.ownerDocument)])) {
        const modal = doc.querySelector(".excalidraw-file-and-folder-selector");
        modal?.querySelector("button:not(.mod-cta)")?.click();
      }
      for (const { tab, view } of [...tabs]) await closeTab(tab, view);
      for (const leaf of [...leaves]) await closeLeaf(leaf);
      for (const path of rootFiles) { const file = app.vault.getFileByPath(path); if (file) await app.vault.delete(file, true); }
      const folder = app.vault.getFolderByPath(prefix);
      if (folder) { check(folder.path === prefix && prefix.startsWith("__excalidraw_cli_smoke_"), "unowned workflow folder"); await app.vault.delete(folder, true); }
      if (previous?.containerEl?.isConnected) app.workspace.setActiveLeaf(previous, { focus: true });
    } finally { app.vault.setConfig("attachmentFolderPath", attachmentFolderPath); }
  });
  await app.vault.createFolder(prefix);
  await app.vault.createFolder(prefix + "/Drawings");
  await app.vault.createFolder(prefix + "/Chosen");
  await app.vault.createFolder(prefix + "/Attachments");
  app.vault.setConfig("attachmentFolderPath", prefix + "/Attachments");
  const ready = async leaf => c.waitFor(() => leaf.view.isLoaded && leaf.view.excalidrawAPI &&
    !leaf.view.excalidrawAPI.getAppState().isLoading && !leaf.view.semaphores.justLoaded && !leaf.view.isClosingOrMigrating(), "workflow drawing first commit");
  const open = async (path, popout = false) => {
    const file = await app.vault.create(path, fixture);
    if (!path.startsWith(prefix + "/")) rootFiles.add(path);
    await c.waitFor(() => plugin.isExcalidrawFile(file), "workflow fixture metadata");
    const leaf = popout ? app.workspace.openPopoutLeaf() : app.workspace.getLeaf("tab"); leaves.add(leaf);
    if (popout) await c.waitFor(() => leaf.view.containerEl.ownerDocument !== mainDocument, "empty workflow popout migration");
    await leaf.openFile(file); await ready(leaf);
    app.workspace.setActiveLeaf(leaf, { focus: true }); leaf.view.ownerWindow.focus();
    return leaf;
  };
  const reopen = async leaf => {
    const path = leaf.view.file.path;
    await leaf.view.forceSave(true, true);
    await leaf.setViewState({ type: "empty", state: {} });
    await leaf.setViewState({ type: "excalidraw", state: { file: path } }); await ready(leaf);
    return leaf.view;
  };
  await c.case("native:workflow-markdown-extraction-3009", ["P02", "P03", "P05"], async () => {
    const variants = [], markdown = "# Custom note\n\nPreserve **content**, [[Links/Target]] and Unicode: árvíz 测试.\n";
    for (const options of [
      { name: "root", root: true }, { name: "nested" }, { name: "unicode", unicode: true },
      { name: "cancel", cancel: true }, { name: "collision", collision: true },
      { name: "explicit", explicit: true }, { name: "popout", popout: true },
    ]) {
      const path = options.root ? prefix + "_root.excalidraw.md" : prefix + "/Drawings/" + (options.unicode ? "测试 árvíz" : options.name) + ".excalidraw.md";
      const leaf = await open(path, options.popout), view = leaf.view;
      if (options.name === "nested") {
        await open(prefix + "/Other.excalidraw.md");
        app.workspace.setActiveLeaf(leaf, { focus: true });
      }
      const panel = await plugin.openSidepanel(false), beforeTabs = new Set(panel.tabs.keys());
      await view.openMarkdownImageEditor();
      const tab = [...panel.tabs.values()].find(tab => !beforeTabs.has(tab.id));
      check(tab, "owned extraction editor tab missing"); const ownedTab = { tab, view }; tabs.add(ownedTab);
      await c.waitFor(() => tab.contentEl.querySelector(".excalidraw-markdown-image-editor__markdown-view .cm-content"), "extraction source editor");
      const content = tab.contentEl.querySelector(".excalidraw-markdown-image-editor__markdown-view .cm-content");
      const cm = content.cmTile?.view ?? content.cmView?.rootView?.view;
      cm.dispatch({ changes: { from: 0, to: cm.state.doc.length, insert: markdown } });
      tab.contentEl.querySelector(".excalidraw-markdown-image-editor__toolbar button.mod-cta").click();
      await c.waitFor(() => !tab.contentEl.querySelector(".excalidraw-markdown-image-editor__status")?.classList.contains("is-updating") &&
        tab.contentEl.querySelector("button .lucide-file-output"), "local Markdown render and extraction action");
      const image = view.getViewElements().find(element => element.customData?.markdownImage);
      check(image, "local Markdown image missing");
      // Keep the selected image's drawing as the owner. The sidepanel deliberately
      // reattaches when another drawing becomes active, so arrange both drawings
      // before opening this editor rather than invalidating it mid-operation.
      tab.contentEl.querySelector("button .lucide-file-output").closest("button").click();
      const doc = tab.contentEl.ownerDocument;
      await c.waitFor(() => doc.querySelector(".excalidraw-file-and-folder-selector"), "extraction destination dialog");
      const modal = doc.querySelector(".excalidraw-file-and-folder-selector"), inputs = modal.querySelectorAll("input");
      const normalize = path => path.replace(/^\/+|\/+$/g, "");
      const expectedFolder = normalize(view.file.parent.path), actualFolder = normalize(inputs[0].value);
      c.observations.extraction = [...(c.observations.extraction || []), { name: options.name, expectedFolder, actualFolder }];
      check(actualFolder === expectedFolder, "Extraction default must be the owning drawing folder: " + JSON.stringify({ expectedFolder, actualFolder }));
      const set = (input, value) => { input.value = value; input.dispatchEvent(new doc.defaultView.Event("input", { bubbles: true })); };
      const folder = options.explicit ? prefix + "/Chosen" : expectedFolder;
      const filename = prefix + "_" + options.name + ".md";
      const requestedPath = (folder ? folder + "/" : "") + filename;
      const before = new Set(app.vault.getFiles().map(file => file.path));
      if (options.collision) await app.vault.create(requestedPath, "Keep existing note.");
      set(inputs[0], folder); set(inputs[1], filename);
      modal.querySelector(options.cancel ? "button:not(.mod-cta)" : "button.mod-cta").click();
      await c.waitFor(() => !modal.isConnected, "extraction dialog closes");
      let extractedPath = null;
      if (options.cancel) {
        check(!app.vault.getFileByPath(requestedPath) && view.excalidrawData.getMarkdownImage(image.fileId), "cancel created a note or changed local source");
      } else {
        await c.waitFor(() => view.excalidrawData.getFile(image.fileId)?.file?.extension === "md", "extraction external source replacement");
        const file = view.excalidrawData.getFile(image.fileId).file; extractedPath = file.path;
        if (!extractedPath.startsWith(prefix + "/")) rootFiles.add(extractedPath);
        check(normalize(file.parent.path) === folder && (await app.vault.read(file)).trim() === markdown.trim(), "extracted destination or content differs");
        if (options.collision) { check(file.path !== requestedPath && await app.vault.adapter.read(requestedPath) === "Keep existing note.", "filename collision overwrote a note"); }
        else check(!before.has(file.path), "extraction reused an existing file");
      }
      await closeTab(tab, view); tabs.delete(ownedTab);
      const restored = await reopen(leaf), savedImage = restored.getViewElements().find(element => element.id === image.id);
      check(savedImage, "extraction image lost on reopen");
      if (options.cancel) check(restored.excalidrawData.getMarkdownImage(savedImage.fileId), "cancelled local Markdown did not survive reopen");
      else check(restored.excalidrawData.getFile(savedImage.fileId)?.file?.path === extractedPath, "extracted source link did not survive reopen");
      variants.push({ name: options.name, folder, extractedPath, reopened: true });
      await closeLeaf(leaf);
    }
    return { assertions: ["root/nested/Unicode owning folder defaults", "two simultaneous drawings retain the selected image's owner", "explicit selection and cancellation", "unique names and original content preserved", "external source links persist through save/reopen", "main/popout extraction"], variants };
  });
  await c.case("native:workflow-zen-controls-3000", ["P03", "P08"], async () => {
    const variants = [];
    for (const popout of [false, true]) {
      const leaf = await open(prefix + "/Zen-" + popout + ".excalidraw.md", popout), view = leaf.view, api = view.excalidrawAPI;
      const doc = view.ownerDocument, win = view.ownerWindow;
      view.setUIMode("full");
      const root = view.containerEl.querySelector(".excalidraw");
      const originalRootDirection = root.getAttribute("dir"), originalDocumentDirection = doc.documentElement.getAttribute("dir");
      const originalWidth = view.contentEl.style.width;
      const originalMaxWidth = view.contentEl.style.maxWidth;
      const contents = win.require("@electron/remote").getCurrentWebContents(), originalZoom = contents.getZoomFactor();
      try {
        for (const direction of ["ltr", "rtl"]) {
          doc.documentElement.setAttribute("dir", direction); root.setAttribute("dir", direction);
          for (const [width, scale] of [[900, 1], [360, 1], [240, 1], [360, 1.25]]) {
            contents.setZoomFactor(scale);
            view.contentEl.setCssProps({ width: width + "px", "max-width": "100%" });
            api.updateScene({ appState: { zenModeEnabled: true, zoom: { value: 1.7 } }, captureUpdate: "NEVER" });
            await c.waitFor(() => api.getAppState().zenModeEnabled && view.containerEl.querySelector(".disable-zen-mode--visible"), "Zen exit control");
            const exit = view.containerEl.querySelector(".disable-zen-mode--visible"), zoom = view.containerEl.querySelector(".reset-zoom-button");
            check(zoom, "Zen zoom indicator missing");
            await c.waitFor(() => win.getComputedStyle(exit).visibility === "visible" && Number(win.getComputedStyle(exit).opacity) > 0.99, "Zen exit transition completes");
            const a = exit.getBoundingClientRect(), b = zoom.getBoundingClientRect();
            const intersects = Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
            const editor = root.getBoundingClientRect();
            const record = { popout, direction, width, scale, editor: editor.toJSON(), exit: a.toJSON(), zoom: b.toJSON(), intersects };
            c.observations.zen = [...(c.observations.zen || []), record];
            check(!intersects, "Zen exit overlaps zoom indicator: " + JSON.stringify(record));
            for (const button of [exit, zoom]) {
              const bounds = button.getBoundingClientRect();
              record.hit = { button: button.className, target: doc.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)?.outerHTML.slice(0, 800), viewport: [win.innerWidth, win.innerHeight] };
              check(bounds.width > 0 && bounds.height > 0 && bounds.left >= editor.left && bounds.right <= editor.right &&
                bounds.top >= editor.top && bounds.bottom <= editor.bottom && bounds.left >= 0 && bounds.right <= win.innerWidth &&
                doc.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)?.closest("button") === button,
                "Zen control is clipped or covered");
            }
            zoom.click(); await c.waitFor(() => api.getAppState().zoom.value === 1, "Zen zoom action");
            exit.click(); await c.waitFor(() => !api.getAppState().zenModeEnabled, "Zen exit action");
            variants.push(record);
          }
        }
      } finally {
        if (originalRootDirection === null) root.removeAttribute("dir"); else root.setAttribute("dir", originalRootDirection);
        if (originalDocumentDirection === null) doc.documentElement.removeAttribute("dir"); else doc.documentElement.setAttribute("dir", originalDocumentDirection);
        contents.setZoomFactor(originalZoom);
        view.contentEl.setCssProps({ width: originalWidth, "max-width": originalMaxWidth });
        api.updateScene({ appState: { zenModeEnabled: false }, captureUpdate: "NEVER" });
      }
      await closeLeaf(leaf);
    }
    return { assertions: ["Zen exit and zoom indicator do not intersect", "both controls remain inside the editor and uncovered", "zoom and exit actions activate repeatedly", "LTR/RTL wide/narrow panes and UI scale", "main/popout document ownership"], variants };
  });
  return { tests: c.tests };
}
