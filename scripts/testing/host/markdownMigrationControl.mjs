/** Bounded host-only comparison. No Excalidraw runtime, forced scene flush or acceptance credit. */
import assert from "node:assert/strict";
import { runInAppTask } from "./inAppTask.mjs";

export async function runMarkdownMigrationControl({ cli, drawingPath }) {
  assert.ok(drawingPath.startsWith("__excalidraw_cli_smoke_"));
  const result = await runInAppTask({ cli, execute: exerciseMarkdownMigration,
    args: [drawingPath], timeoutMs: 180000, cleanupMs: 60000 });
  return { id: "diagnostic-markdown-migration", status: "passed", ...result };
}

async function exerciseMarkdownMigration(c, drawingPath) {
  const workspace = app.workspace, doc = workspace.containerEl.ownerDocument;
  const prefix = drawingPath.replace(/\.(excalidraw\.md|excalidraw|md)$/, "") + "_markdown_migration";
  const ids = ["excalidraw-extras", "obsidian-excalidraw-plugin"];
  const check = (value, label) => { if (!value) throw Error(label); };
  check(!doc.querySelector("body > .print"), "Native print work must settle before host-only control");
  const base = workspace.getLeavesOfType("excalidraw").find(l => l.view.file?.path === drawingPath);
  check(base, "Owned drawing missing");
  await base.setViewState({ type: "empty", state: {} });
  const previous = workspace.activeLeaf, owned = new Set();
  c.defer(async () => {
    for (const id of ids) if (!app.plugins.plugins[id]) await app.plugins.enablePlugin(id);
    await c.waitForCleanup(() => app.plugins.plugins[ids[1]]?.isReady && app.plugins.plugins[ids[0]]?.api, "restore both community runtimes");
  });
  c.defer(async () => {
    for (const leaf of owned) {
      const win = leaf.view.containerEl.ownerDocument.defaultView;
      if (win !== doc.defaultView && !win.closed) {
        await leaf.view.save(); win.close(); await c.waitForCleanup(() => win.closed, "host-only popout close");
      } else if (leaf.containerEl.isConnected) {
        await leaf.setViewState({ type: "empty", state: {} }); leaf.detach();
      }
    }
    const folder = app.vault.getFolderByPath(prefix);
    if (folder) { check(prefix.startsWith("__excalidraw_cli_smoke_"), "unowned host-only folder"); await app.vault.delete(folder, true); }
    if (previous?.containerEl.isConnected) workspace.setActiveLeaf(previous, { focus: true });
  });
  for (const id of [...ids].reverse()) await app.plugins.disablePlugin(id);
  check(ids.every(id => !app.plugins.plugins[id]), "Community runtime remains active in host-only control");
  await app.vault.createFolder(prefix);
  for (let cycle = 0; cycle < 6; cycle++) {
    const route = cycle % 2 ? "host-drag" : "direct";
    await c.case(`diagnostic:markdown-migration:${route}:${cycle}`, ["P03"], async () => {
      let anchor; workspace.iterateAllLeaves(l => { if (!anchor && l.getRoot() === workspace.rootSplit) anchor = l; });
      check(anchor, "Main workspace anchor missing"); workspace.setActiveLeaf(anchor, { focus: true });
      const file = await app.vault.create(prefix + "/" + cycle + ".md", "Initial host-only note.");
      const leaf = workspace.getLeaf("tab"); owned.add(leaf);
      await leaf.setViewState({ type: "markdown", state: { file: file.path, mode: "source", source: true } });
      await c.waitFor(() => leaf.view.editor && leaf.view.containerEl.ownerDocument === doc, "main Markdown editor");
      workspace.moveLeafToPopout(leaf);
      await c.waitFor(() => leaf.view.containerEl.ownerDocument !== doc && leaf.view.editor, "Markdown popout");
      const popWindow = leaf.view.containerEl.ownerDocument.defaultView;
      const marker = "Dirty host-only Markdown cycle " + cycle;
      leaf.view.editor.setValue(marker);
      check(leaf.view.editor.getValue() === marker && await app.vault.read(file) !== marker, "Markdown migration fixture is not dirty");
      const target = anchor.parent;
      if (route === "host-drag") {
        const source = leaf.tabHeaderEl, destination = anchor.tabHeaderEl;
        const sr = source.getBoundingClientRect(), tr = destination.getBoundingClientRect();
        check(sr.width > 0 && tr.width > 0, "Host-only tab headers are not visible");
        const end = new popWindow.DragEvent("dragend", { bubbles: true }); let dropped = false;
        source.dispatchEvent(new popWindow.DragEvent("dragstart", { bubbles: true, cancelable: true,
          clientX: sr.x + sr.width / 2, clientY: sr.y + sr.height / 2, dataTransfer: new popWindow.DataTransfer() }));
        try {
          const point = { clientX: tr.x + tr.width / 2, clientY: tr.y + tr.height * 0.8 };
          const over = new doc.defaultView.DragEvent("dragover", { bubbles: true, cancelable: true, ...point, dataTransfer: new doc.defaultView.DataTransfer() });
          destination.dispatchEvent(over);
          check(workspace.getDropLocation(over) === target, "Host-only drag targeted another group");
          dropped = true;
          destination.dispatchEvent(new doc.defaultView.DragEvent("drop", { bubbles: true, cancelable: true, ...point, dataTransfer: new doc.defaultView.DataTransfer() }));
        } finally { if (!dropped) source.dispatchEvent(end); }
      } else {
        leaf.parent.removeChild(leaf); leaf.setDimension(null); target.insertChild(-1, leaf);
        target.selectTabIndex(target.children.indexOf(leaf)); workspace.requestResize();
      }
      await c.waitFor(() => leaf.view.containerEl.ownerDocument === doc && leaf.view.editor, "Markdown return to main");
      await c.waitFor(() => popWindow.closed, "Markdown source window teardown");
      check(leaf.view.editor.getValue() === marker, "Markdown migration lost unsaved text");
      await leaf.view.save(); check(await app.vault.read(file) === marker, "Markdown physical save differs");
      check(ids.every(id => !app.plugins.plugins[id]), "Community runtime activated during host-only control");
      await leaf.setViewState({ type: "empty", state: {} }); leaf.detach(); owned.delete(leaf);
      return { route, input: "public Markdown editor API; synthetic host drag where specified", communityPluginsLoaded: false,
        assertions: ["dirty Markdown survives popout-to-main", "actual source window closes", "physical save matches", "both community runtimes remain unloaded"] };
    });
  }
  return { tests: c.tests };
}
