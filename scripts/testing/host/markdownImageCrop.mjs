/** Shared Markdown crop/width regression: scene validity, disk save and exports. */
export async function exerciseMarkdownCrop(control, drawingPath) {
  const c = globalThis[control], plugin = app.plugins.plugins["obsidian-excalidraw-plugin"];
  const leaf = app.workspace.getLeavesOfType("excalidraw").find(l => l.view.file?.path === drawingPath);
  const view = leaf.view;
  c.previous = app.workspace.activeLeaf;
  const waitFor = async (predicate, label) => {
    for (let i = 0; i < 400; i++) {
      if (predicate()) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw Error(`Timed out: ${label}`);
  };
  const panel = await plugin.openSidepanel(false), beforeTabs = new Set(panel.tabs.keys());
  app.workspace.setActiveLeaf(leaf, { focus: true });
  const before = new Set(view.getViewElements().map(element => element.id));
  await view.openMarkdownImageEditor();
  c.tab = [...panel.tabs.values()].find(tab => !beforeTabs.has(tab.id));
  const image = view.getViewElements().find(element => !before.has(element.id) && element.customData?.markdownImage);
  if (!c.tab || !image) throw Error("owned crop fixture missing");
  const current = () => view.getViewElements().find(element => element.id === image.id);
  const idle = () => !c.tab.contentEl.querySelector(".excalidraw-markdown-image-editor__status")?.classList.contains("is-updating");
  await waitFor(() => c.tab.contentEl.querySelector(".excalidraw-markdown-image-editor__markdown-view .cm-content"), "crop source editor");
  const setContent = async text => {
    const content = c.tab.contentEl.querySelector(".excalidraw-markdown-image-editor__markdown-view .cm-content");
    const cm = content.cmTile?.view ?? content.cmView?.rootView?.view;
    const version = current().customData.markdownImage.version;
    cm.dispatch({ changes: { from: 0, to: cm.state.doc.length, insert: text } });
    c.tab.contentEl.querySelector(".excalidraw-markdown-image-editor__toolbar button.mod-cta").click();
    await waitFor(() => current().customData.markdownImage.version > version && idle(), "crop content render");
  };
  const table = "| Name | Value |\n| --- | --- |\n" + Array.from({ length: 8 }, (_, i) => `| Row ${i + 1} | Value ${i + 1} |`).join("\n");
  await setContent(table);
  const intrinsic = current().customData.markdownImage.renderedSize;
  const ea = view.ownerWindow.ExcalidrawAutomate.getAPI(view);
  const croppedIds = [];
  try {
    for (const [index, crop] of [
      { x: 0, y: 0, width: intrinsic.width, height: intrinsic.height / 2 },
      { x: intrinsic.width / 4, y: 0, width: intrinsic.width * 3 / 4, height: intrinsic.height },
    ].entries()) {
      const copy = ea.cloneElement(current());
      Object.assign(copy, { x: image.x + (index + 1) * (intrinsic.width + 40), width: crop.width, height: crop.height,
        crop: { ...crop, naturalWidth: intrinsic.width, naturalHeight: intrinsic.height } });
      ea.elementsDict[copy.id] = copy; croppedIds.push(copy.id);
    }
    await ea.addElementsToView(false, false, true);
  } finally { ea.destroy(); }
  const copies = () => croppedIds.map(id => view.getViewElements().find(element => element.id === id));
  const assertValid = elements => {
    for (const element of elements) {
      if (!element || !element.crop || ![element.x, element.y, element.width, element.height, ...Object.values(element.crop)].every(Number.isFinite)) throw Error(`invalid crop geometry: ${JSON.stringify(element && { id: element.id, x: element.x, y: element.y, width: element.width, height: element.height, crop: element.crop })}`);
      const crop = element.crop;
      if (crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0 || crop.x + crop.width > crop.naturalWidth + 1e-8 || crop.y + crop.height > crop.naturalHeight + 1e-8) throw Error("crop outside the rendered image");
      if (Math.abs(element.width / element.height - crop.width / crop.height) > 1e-8) throw Error("cropped copy is distorted");
    }
  };
  const persistAndCheck = async () => {
    assertValid(copies());
    await view.forceSave(true, true);
    const reader = view.ownerWindow.ExcalidrawAutomate.getAPI(view);
    try {
      const saved = await reader.getSceneFromFile(view.file);
      const persisted = croppedIds.map(id => saved.elements.find(element => element.id === id));
      assertValid(persisted);
      for (let i = 0; i < persisted.length; i++) {
        if (JSON.stringify(persisted[i].crop) !== JSON.stringify(copies()[i].crop) || persisted[i].width !== copies()[i].width || persisted[i].height !== copies()[i].height) throw Error("crop did not persist to the drawing file");
      }
    } finally { reader.destroy(); }
  };
  const widthInput = c.tab.contentEl.querySelector('input[type="number"][max="4000"]');
  const widths = [current().customData.markdownImage.render.width === 700 ? 900 : 700, 300];
  for (const width of widths) {
    const fractions = copies().map(element => ({ x: element.crop.x / element.crop.naturalWidth, y: element.crop.y / element.crop.naturalHeight, width: element.crop.width / element.crop.naturalWidth, height: element.crop.height / element.crop.naturalHeight }));
    widthInput.value = String(width);
    widthInput.dispatchEvent(new widthInput.ownerDocument.defaultView.Event("input", { bubbles: true }));
    await waitFor(() => current().customData.markdownImage.render.width === width && idle(), "cropped shared width render");
    copies().forEach((element, index) => {
      const actual = { x: element.crop.x / element.crop.naturalWidth, y: element.crop.y / element.crop.naturalHeight, width: element.crop.width / element.crop.naturalWidth, height: element.crop.height / element.crop.naturalHeight };
      if (Object.keys(actual).some(key => Math.abs(actual[key] - fractions[index][key]) > 1e-8)) throw Error("editor width changed the relative crop window");
    });
    await persistAndCheck();
  }
  await setContent(table + "\n| Extra row | New content |");
  await persistAndCheck();
  const ownedIds = [image.id, ...croppedIds];
  const exportOptions = { elements: view.getViewElements().filter(element => ownedIds.includes(element.id)), files: view.excalidrawAPI.getFiles(), appState: { ...view.excalidrawAPI.getAppState(), exportBackground: false } };
  const svg = await view.ownerWindow.ExcalidrawLib.exportToSvg(exportOptions);
  // Inspect geometry attributes, excluding arbitrary base64/font/image bytes.
  for (const node of [svg, ...svg.querySelectorAll("*")]) {
    for (const name of ["x", "y", "width", "height", "viewBox", "transform", "d", "points", "cx", "cy", "rx", "ry"]) {
      if (/\b(?:NaN|Infinity)\b/.test(node.getAttribute(name) ?? "")) throw Error(`export contains invalid ${name}`);
    }
  }
  const png = await view.ownerWindow.ExcalidrawLib.exportToBlob({ ...exportOptions, mimeType: "image/png" });
  if (!png?.size) throw Error("PNG crop export failed");
  const expected = copies().map(element => ({ id: element.id, crop: { ...element.crop }, width: element.width, height: element.height }));
  c.tab.close(); c.tab = null;
  await view.forceSave(true, true);
  await leaf.setViewState({ type: "empty", state: {} });
  await leaf.setViewState({ type: "excalidraw", state: { file: drawingPath } });
  await waitFor(() => leaf.view.excalidrawAPI && croppedIds.every(id => leaf.view.getViewElements().some(element => element.id === id)), "cropped shared image reopen");
  const reopened = expected.map(snapshot => leaf.view.getViewElements().find(element => element.id === snapshot.id));
  assertValid(reopened);
  reopened.forEach((element, index) => {
    if (element.width !== expected[index].width || element.height !== expected[index].height || JSON.stringify(element.crop) !== JSON.stringify(expected[index].crop)) throw Error("crop geometry changed on reopen");
  });
  c.results = [{ kind: "markdown-shared-crops", crops: 2, widths, diskSave: true, svgExport: true, pngExport: true, finite: true }];
  c.reopen = true;
}
