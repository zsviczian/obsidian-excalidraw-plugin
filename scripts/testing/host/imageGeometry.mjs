/** #3014/#2947: real formula bounds and resized Markdown sidepanel edits. */
import assert from "node:assert/strict";

const CONTROL = "__excalidrawImageGeometry";

async function exercise(control, drawingPath, popout) {
  const plugin = app.plugins.plugins["obsidian-excalidraw-plugin"];
  const main = app.workspace.getLeavesOfType("excalidraw").find(l => l.view.file?.path === drawingPath);
  const c = globalThis[control];
  c.plugin = plugin;
  c.gateway = plugin.extrasGateway;
  c.original = c.gateway.getMathJax;
  c.hadOwn = Object.hasOwn(c.gateway, "getMathJax");
  c.previous = app.workspace.activeLeaf;
  const waitFor = async (predicate, label) => {
    for (let i = 0; i < 200; i++) {
      if (predicate()) return;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw Error(`Timed out: ${label}`);
  };
  // The gateway is the only fake: geometry, editor submission, scene/cache
  // updates, persistence, and reload all run through the real plugin/runtime.
  c.gateway.getMathJax = async () => ({ tex2dataURL: async tex => {
    const size = tex === "V" ? { width: 30, height: 30 } : { width: 300, height: 60 };
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}"><rect width="100%" height="100%" fill="black"/></svg>`;
    return { mimeType: "image/svg+xml", fileId: "geometry" + tex.length,
      dataURL: "data:image/svg+xml;base64," + btoa(svg), created: Date.now(), size };
  } });
  let leaf = main;
  if (popout) {
    leaf = app.workspace.openPopoutLeaf(); c.pop = leaf;
    await leaf.setViewState({ type: "excalidraw", state: { file: drawingPath } });
    await waitFor(() => leaf.view.excalidrawAPI, "popout API");
  }
  const view = leaf.view, lib = view.packages.excalidrawLib;
  app.workspace.setActiveLeaf(leaf, { focus: true });
  const ea = new plugin.ea.constructor(plugin, view);
  let id;
  try { id = await ea.addLaTex(100, 100, "V"); await ea.addElementsToView(false, true); }
  finally { ea.destroy(); }
  const element = () => view.getViewElements().find(el => el.id === id);
  const bounds = () => lib.getCommonBoundingBox([element()]);
  c.results = [];
  for (const formula of ["long formula", "V"]) {
    const before = { width: element().width, height: element().height, version: element().version, bounds: bounds() };
    await view.openLaTeXEditor(id);
    const doc = view.ownerDocument;
    await waitFor(() => doc.querySelector(".excalidraw-LatexPrompt .cm-content"), "formula editor");
    const content = doc.querySelector(".excalidraw-LatexPrompt .cm-content");
    const cm = content.cmTile?.view ?? content.cmView?.rootView?.view;
    cm.dispatch({ changes: { from: 0, to: cm.state.doc.length, insert: formula } });
    content.closest(".excalidraw-LatexPrompt").querySelector("button.mod-cta").click();
    await waitFor(() => Math.abs(element().width - before.width) > 1, "updated formula dimensions");
    const after = { width: element().width, height: element().height, version: element().version, bounds: bounds() };
    if (Math.abs(after.width - after.bounds.width) > 0.001 || Math.abs(after.height - after.bounds.height) > 0.001) throw Error(`cached bounds differ from displayed formula geometry: ${JSON.stringify({before,after})}`);
    if (after.version <= before.version) throw Error("formula version did not advance");
    c.results.push({ formula, before, after });
  }
  await view.forceSave(true, true);
  const expected = { width: element().width, height: element().height };
  await leaf.setViewState({ type: "empty", state: {} });
  await leaf.setViewState({ type: "excalidraw", state: { file: drawingPath } });
  await waitFor(() => leaf.view.excalidrawAPI && leaf.view.getViewElements().some(el => el.id === id), "formula reopen");
  const reopened = leaf.view.getViewElements().find(el => el.id === id);
  if (Math.abs(reopened.width - expected.width) > 0.001 || Math.abs(reopened.height - expected.height) > 0.001) throw Error("formula dimensions changed on reopen");
  c.reopen = true;
}

async function exerciseMarkdown(control, drawingPath) {
  const c = globalThis[control], plugin = app.plugins.plugins["obsidian-excalidraw-plugin"];
  const leaf = app.workspace.getLeavesOfType("excalidraw").find(l => l.view.file?.path === drawingPath);
  const view = leaf.view, doc = view.ownerDocument;
  c.previous = app.workspace.activeLeaf;
  if (doc.querySelector(".excalidraw-markdown-image-editor .cm-content")) throw Error("close the existing Markdown-image editor before testing");
  const waitFor = async (predicate, label) => {
    for (let i = 0; i < 300; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 50)); }
    throw Error(`Timed out: ${label}`);
  };
  const panel = await plugin.openSidepanel(false), beforeTabs = new Set(panel.tabs.keys());
  app.workspace.setActiveLeaf(leaf, { focus: true });
  const beforeIds = new Set(view.getViewElements().map(el => el.id));
  await view.openMarkdownImageEditor();
  c.tab = [...panel.tabs.values()].find(tab => !beforeTabs.has(tab.id));
  if (!c.tab) throw Error("owned Markdown-image tab missing");
  const image = view.getViewElements().find(el => !beforeIds.has(el.id) && el.customData?.markdownImage);
  if (!image) throw Error("owned Markdown image missing");
  const current = () => view.getViewElements().find(el => el.id === image.id);
  await waitFor(() => c.tab.contentEl.querySelector(".excalidraw-markdown-image-editor__markdown-view .cm-content"), "Markdown source editor");
  const setContent = async text => {
    const content = c.tab.contentEl.querySelector(".excalidraw-markdown-image-editor__markdown-view .cm-content");
    const cm = content.cmTile?.view ?? content.cmView?.rootView?.view;
    const version = current().customData.markdownImage.version;
    cm.dispatch({ changes: { from: 0, to: cm.state.doc.length, insert: text } });
    c.tab.contentEl.querySelector(".excalidraw-markdown-image-editor__toolbar button.mod-cta").click();
    try {
      await waitFor(() => current().customData.markdownImage.version > version && view.excalidrawData.getMarkdownImage(image.fileId)?.markdown.trim() === text.trim() && !c.tab.contentEl.querySelector(".excalidraw-markdown-image-editor__status")?.classList.contains("is-updating"), "Markdown render commit");
    } catch (error) {
      throw Error(`${error.message}: ${JSON.stringify({ version, currentVersion: current()?.customData?.markdownImage?.version, stored: view.excalidrawData.getMarkdownImage(image.fileId)?.markdown, editor: cm.state.doc.toString() })}`);
    }
  };
  await setContent("Short content");
  const original = current();
  const expected = { width: original.width * 2, height: original.height * 2 };
  view.excalidrawAPI.mutateElement(original, expected);
  await setContent(Array.from({ length: 12 }, (_, i) => `Line ${i + 1}`).join("\n\n"));
  if (current().width !== expected.width || current().height !== expected.height) throw Error("Markdown editor reset the canvas resize");
  c.results = [{ kind: "markdown-sidepanel", displayed: expected, rendered: current().customData.markdownImage.renderedSize }];
  c.tab.close(); c.tab = null;
  await new Promise(resolve => setTimeout(resolve, 100));
  await view.forceSave(true, true);
  await leaf.setViewState({ type: "empty", state: {} });
  await leaf.setViewState({ type: "excalidraw", state: { file: drawingPath } });
  await waitFor(() => leaf.view.excalidrawAPI && leaf.view.getViewElements().some(el => el.id === image.id), "Markdown image reopen");
  const reopened = leaf.view.getViewElements().find(el => el.id === image.id);
  if (reopened.width !== expected.width || reopened.height !== expected.height) throw Error("Markdown resize changed on reopen");
  c.reopen = true;
}

async function cleanup(control) {
  const c = globalThis[control]; if (!c) return;
  if (c.gateway) {
    if (c.hadOwn) c.gateway.getMathJax = c.original;
    else delete c.gateway.getMathJax;
  }
  c.tab?.close();
  if (c.pop) { await c.pop.setViewState({ type: "empty", state: {} }); c.pop.detach(); }
  if (c.previous && c.previous !== c.pop) app.workspace.setActiveLeaf(c.previous, { focus: true });
  delete globalThis[control];
}

/** Uses only the parent runner's disposable drawing and restores its gateway. */
export async function runImageGeometryScenario({ cli, drawingPath }) {
  const evaluate = code => JSON.parse(cli("eval", `code=${code}`).trim().replace(/^=>\s*/, ""));
  const cases = [];
  for (const [popout, scenario] of [[false, exercise], [true, exercise], [false, exerciseMarkdown]]) {
    try {
      evaluate(`(()=>{if(globalThis.${CONTROL})throw Error("geometry controller exists");const c=globalThis.${CONTROL}={state:"pending"};(${scenario.toString()})(${JSON.stringify(CONTROL)},${JSON.stringify(drawingPath)},${popout}).then(()=>c.state="done").catch(e=>{c.error=e.stack;c.state="failed"});return JSON.stringify({started:true})})()`);
      let result;
      for (let i = 0; i < 200; i++) {
        result = evaluate(`JSON.stringify({state:globalThis.${CONTROL}.state,error:globalThis.${CONTROL}.error,results:globalThis.${CONTROL}.results,reopen:globalThis.${CONTROL}.reopen})`);
        if (result.state !== "pending") break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert.equal(result.state, "done", result.error ?? "geometry scenario timed out");
      cases.push({ window: popout ? "popout" : "main", ...result });
    } finally {
      cli("eval", `code=(${cleanup.toString()})(${JSON.stringify(CONTROL)})`);
    }
  }
  return { id: "image-geometry-3014", status: "passed", cases };
}
