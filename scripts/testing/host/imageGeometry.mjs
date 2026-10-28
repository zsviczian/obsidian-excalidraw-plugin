/** #3014/#2947: real formula bounds and resized Markdown sidepanel edits. */
import { runLegacyTask } from "./legacyTask.mjs";
import { exerciseMarkdownCrop } from "./markdownImageCrop.mjs";

const CONTROL = "__excalidrawImageGeometry";

async function exercise(control, drawingPath, popout, realRenderer) {
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
  if (realRenderer) {
    if (!app.plugins.plugins["excalidraw-extras"]?.settings.enableMathJaxToSVG || !await c.gateway.getMathJax()) {
      throw Error("Enable Extras MathJax-to-SVG in excalidraw-test before --image-geometry-real");
    }
  } else {
    // Only deterministic mode replaces the gateway; real mode uses Extras.
    c.gateway.getMathJax = async () => ({ tex2dataURL: async tex => {
    const size = tex === "V" ? { width: 30, height: 30 } : { width: 300, height: 60 };
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}"><rect width="100%" height="100%" fill="black"/></svg>`;
    return { mimeType: "image/svg+xml", fileId: "geometry" + tex.length,
      dataURL: "data:image/svg+xml;base64," + btoa(svg), created: Date.now(), size };
    } });
  }
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
  for (const formula of ["V \\in \\mathbb R^{n_{seq} \\times d}", "V"]) {
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

  const ea = view.ownerWindow.ExcalidrawAutomate.getAPI(view);
  let duplicate;
  try {
    duplicate = ea.cloneElement(current());
    duplicate.x += current().width + 20;
    ea.elementsDict[duplicate.id] = duplicate;
    await ea.addElementsToView(false, false, true);
  } finally { ea.destroy(); }
  await waitFor(() => view.getViewElements().some(element => element.id === duplicate.id), "shared Markdown duplicate");
  const sibling = () => view.getViewElements().find(element => element.id === duplicate.id);
  view.excalidrawAPI.mutateElement(sibling(), { width: sibling().width / 4, height: sibling().height / 4 });
  const positions = [current(), sibling()].map(element => ({ x: element.x, y: element.y }));
  const previousWidth = current().customData.markdownImage.render.width;
  const nextWidth = previousWidth === 700 ? 900 : 700;
  const widthInput = c.tab.contentEl.querySelector('input[type="number"][max="4000"]');
  if (!widthInput) throw Error("Markdown appearance width input missing");
  widthInput.value = String(nextWidth);
  widthInput.dispatchEvent(new widthInput.ownerDocument.defaultView.Event("input", { bubbles: true }));
  await waitFor(() => current().customData.markdownImage.render.width === nextWidth && !c.tab.contentEl.querySelector(".excalidraw-markdown-image-editor__status")?.classList.contains("is-updating"), "shared Markdown width render");
  const checkSharedWidth = () => {
    const copies = [current(), sibling()];
    const intrinsic = current().customData.markdownImage.renderedSize;
    copies.forEach((element, index) => {
      if (element.fileId !== image.fileId || element.customData.markdownImage.render.width !== nextWidth || element.width !== intrinsic.width || element.height !== intrinsic.height) throw Error("shared Markdown copy missed the width change");
      if (element.x !== positions[index].x || element.y !== positions[index].y) throw Error("shared width edit moved a Markdown copy");
    });
    return { width: intrinsic.width, height: intrinsic.height };
  };
  checkSharedWidth();
  await setContent("Shorter shared content");
  const sharedBounds = checkSharedWidth();
  c.results.push({ kind: "markdown-shared-width", copies: 2, previousWidth, nextWidth, displayed: sharedBounds, fileId: image.fileId });
  c.tab.close(); c.tab = null;
  await new Promise(resolve => setTimeout(resolve, 100));
  await view.forceSave(true, true);
  await leaf.setViewState({ type: "empty", state: {} });
  await leaf.setViewState({ type: "excalidraw", state: { file: drawingPath } });
  await waitFor(() => leaf.view.excalidrawAPI && leaf.view.getViewElements().some(el => el.id === image.id), "Markdown image reopen");
  for (const id of [image.id, duplicate.id]) {
    const reopened = leaf.view.getViewElements().find(el => el.id === id);
    if (!reopened || reopened.fileId !== image.fileId || reopened.width !== sharedBounds.width || reopened.height !== sharedBounds.height || reopened.customData.markdownImage.render.width !== nextWidth) throw Error("shared Markdown width changed on reopen");
  }
  c.reopen = true;
}

async function cleanup(control) {
  const c = globalThis[control]; if (!c) return;
  if (c.gateway) {
    if (c.hadOwn) c.gateway.getMathJax = c.original;
    else delete c.gateway.getMathJax;
  }
  c.tab?.close();
  if (c.pop) {
    const win=c.pop.view.containerEl.ownerDocument.defaultView;
    if(win===app.workspace.containerEl.ownerDocument.defaultView){await c.pop.setViewState({type:'empty',state:{}});c.pop.detach();}
    else {if(c.pop.view.isDirty?.())await c.pop.view.saveWithOutcome();win.close();const end=Date.now()+10000;while(!win.closed){if(Date.now()>end)throw Error('Geometry popout did not close');await new Promise(resolve=>setTimeout(resolve,25));}}
  }
  if (c.previous?.view.containerEl.isConnected && c.previous !== c.pop) app.workspace.setActiveLeaf(c.previous, { focus: true });
  delete globalThis[control];
}

/** Uses only the parent runner's disposable drawing and restores its gateway. */
export async function runImageGeometryScenario({ cli, drawingPath, realRenderer = false }) {
  const cases=[];
  for(const [popout,scenario] of [[false,exercise],[true,exercise],[false,exerciseMarkdown],[false,exerciseMarkdownCrop]]){
    const result=await runLegacyTask({cli,control:CONTROL,execute:scenario,cleanup,args:[drawingPath,popout,realRenderer],timeoutMs:90000,cleanupMs:120000});
    cases.push({window:popout?'popout':'main',...result});
  }
  return {id:realRenderer?'image-geometry-real-3014':'image-geometry-3014',renderer:realRenderer?'extras-mathjax':'deterministic-svg',status:'passed',cases};
}
