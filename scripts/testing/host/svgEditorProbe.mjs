/** Existing command, EA workbench, native history/clipboard and persistence checks. */
export async function probeSvgEditor(key, drawingPath, popout) {
  const c = globalThis[key],
    plugin = app.plugins.plugins["obsidian-excalidraw-plugin"];
  const waitFor = async (predicate, label) => {
    c.stage = label;
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      if (globalThis[key] !== c) throw Error("SVG probe cancelled");
      if (predicate()) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw Error(`SVG editor timeout: ${label}`);
  };
  const main = app.workspace
    .getLeavesOfType("excalidraw")
    .find((l) => l.view.file?.path === drawingPath);
  const files = [];
  let leaf = main,
    copyLeaf = null;
  const ownedName = (suffix) =>
    `__excalidraw_cli_smoke_svg_${suffix}_${crypto.randomUUID()}`;
  const extraFile = async (name, content) => {
    const f = await app.vault.create(name, content);
    files.push(f);
    return f;
  };
  try {
    if (popout) {
      const file = await plugin.createDrawing(
        ownedName("popout") + ".excalidraw.md",
        "/",
      );
      files.push(file);
      leaf = app.workspace.openPopoutLeaf();
      await leaf.setViewState({
        type: "excalidraw",
        state: { file: file.path },
      });
      await waitFor(() => leaf.view.excalidrawAPI, "popout editor");
    }
    const view = leaf.view,
      api = view.excalidrawAPI,
      lib = view.packages.excalidrawLib;
    app.workspace.setActiveLeaf(leaf, { focus: true });
    api.updateScene({
      appState: { viewModeEnabled: false, selectedElementIds: {} },
      captureUpdate: "NEVER",
      forceFlushSync: true,
    });
    const initial = view.getViewElements().length;
    api.history.clear();
    const ea = new plugin.ea.constructor(plugin, view);
    let sentinel, imported;
    try {
      sentinel = ea.addRect(140, 10, 20, 20);
      const before = JSON.stringify(ea.getElement(sentinel));
      const content =
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><g><path fill="red" d="M0 0H90V90H0Z M20 20V70H70V20Z"/><path fill="none" stroke="blue" stroke-linecap="round" stroke-linejoin="round" d="M5 95Q45 10 95 95"/></g></svg>';
      if (
        !ea.importSVG(content) ||
        JSON.stringify(ea.getElement(sentinel)) !== before
      )
        throw Error("native EA append changed unrelated workbench element");
      const snapshot = JSON.stringify(ea.getElements());
      if (
        ea.importSVG(
          '<svg><rect width="2" height="2"/><use href="#missing"/></svg>',
        ) ||
        JSON.stringify(ea.getElements()) !== snapshot
      )
        throw Error("failed native import changed workbench");
      if (view.getViewElements().length !== initial)
        throw Error("importSVG inserted before requested");
      imported = ea.getElements().map((e) => e.id);
      await ea.addElementsToView(false, false, true, true);
    } finally {
      ea.destroy();
    }
    await waitFor(
      () =>
        imported.every((id) => view.getViewElements().some((e) => e.id === id)),
      "EA insertion",
    );
    const history = async (action) => {
      // Public fork API executes the same registered native action as the toolbar.
      // Flush pending React work when the CLI is driving a background window.
      api.updateScene({
        appState: { selectedElementIds: {} },
        captureUpdate: "IMMEDIATELY",
        forceFlushSync: true,
      });
      api.history[action]();
    };
    await history("undo");
    await waitFor(
      () => !view.getViewElements().some((e) => imported.includes(e.id)),
      "native undo",
    );
    await history("redo");
    await waitFor(
      () =>
        imported.every((id) => view.getViewElements().some((e) => e.id === id)),
      "native redo",
    );
    const edit = new plugin.ea.constructor(plugin, view);
    let duplicateIds = [];
    try {
      const source = view
        .getViewElements()
        .filter((e) => imported.includes(e.id) && e.id !== sentinel);
      edit.copyViewElementsToEAforEditing(source);
      const group = crypto.randomUUID();
      for (const original of source) {
        const item = edit.getElement(original.id);
        item.roughness = 1;
        item.angle = 0.2;
        if (item.backgroundColor !== "transparent")
          item.backgroundColor = "#00aa77";
        item.groupIds = [];
        const duplicate = edit.cloneElement(item);
        duplicate.x += 200;
        duplicate.groupIds = [group];
        duplicate.width *= 1.25;
        duplicate.height *= 1.25;
        if (duplicate.points)
          duplicate.points = duplicate.points.map(([x, y]) => [
            x * 1.25,
            y * 1.25,
          ]);
        edit.elementsDict[duplicate.id] = duplicate;
        duplicateIds.push(duplicate.id);
      }
      edit.addToGroup(source.map((e) => e.id));
      await edit.addElementsToView(false, false, true, true);
    } finally {
      edit.destroy();
    }
    await waitFor(
      () =>
        duplicateIds.every((id) =>
          view.getViewElements().some((e) => e.id === id),
        ),
      "duplicate/edit",
    );
    const selected =
      app.vault.getFileByPath("TestAssets/rocket.svg") ??
      app.vault
        .getFolderByPath("TestAssets")
        ?.children.find((f) => f.extension === "svg");
    if (!selected) throw Error("supplied SVG sample missing");
    const beforeCommand = new Set(view.getViewElements().map((e) => e.id));
    if (
      !app.commands.executeCommandById("obsidian-excalidraw-plugin:import-svg")
    )
      throw Error("SVG command unavailable");
    const dialog = plugin.importSVGDialog;
    dialog.onChooseItem(
      selected,
      new view.ownerWindow.KeyboardEvent("keydown", { key: "Enter" }),
    );
    dialog.close();
    await waitFor(
      () => view.getViewElements().some((e) => !beforeCommand.has(e.id)),
      "command/dialog insertion",
    );
    const commandElements = view
      .getViewElements()
      .filter((e) => !beforeCommand.has(e.id));
    if (
      !commandElements.length ||
      !commandElements.every(
        (e) => e.groupIds.at(-1) === commandElements[0].groupIds.at(-1),
      )
    )
      throw Error("command import lost outer group");
    const invalid = await extraFile(
      ownedName("invalid") + ".svg",
      '<svg><path d="M0 0Z1"/></svg>',
    );
    const beforeInvalid = view.getViewElements().length;
    app.workspace.setActiveLeaf(leaf, { focus: true });
    app.commands.executeCommandById("obsidian-excalidraw-plugin:import-svg");
    dialog.onChooseItem(
      invalid,
      new view.ownerWindow.KeyboardEvent("keydown", { key: "Enter" }),
    );
    dialog.close();
    await new Promise((r) => setTimeout(r, 200));
    if (view.getViewElements().length !== beforeInvalid)
      throw Error("failed dialog import changed scene");
    const options = {
      elements: view.getViewElements(),
      files: api.getFiles(),
      appState: {
        ...api.getAppState(),
        exportWithDarkMode: false,
        exportBackground: false,
      },
    };
    const svg = await lib.exportToSvg({ ...options, skipInliningFonts: true }),
      png = await lib.exportToBlob({ ...options, mimeType: "image/png" });
    if (!svg.outerHTML.includes("<svg") || !png?.size)
      throw Error("edited native SVG/PNG export failed");
    await view.forceSave(true, true);
    const expected = view.getViewElements().map((e) => ({
      id: e.id,
      type: e.type,
      width: e.width,
      height: e.height,
      angle: e.angle,
      groupIds: e.groupIds,
      strokeColor: e.strokeColor,
      backgroundColor: e.backgroundColor,
      roughness: e.roughness,
    }));
    const scenePath = view.file.path;
    await leaf.setViewState({ type: "empty", state: {} });
    await leaf.setViewState({ type: "excalidraw", state: { file: scenePath } });
    await waitFor(
      () =>
        leaf.view.excalidrawAPI &&
        expected.every((e) =>
          leaf.view.getViewElements().some((item) => item.id === e.id),
        ),
      "save/reopen",
    );
    for (const snapshot of expected) {
      const actual = leaf.view
        .getViewElements()
        .find((e) => e.id === snapshot.id);
      for (const [field, value] of Object.entries(snapshot))
        if (JSON.stringify(actual[field]) !== JSON.stringify(value))
          throw Error(`SVG reopen changed ${field}`);
    }
    const current = leaf.view,
      sourceElements = current.getViewElements();
    const copyPath = await plugin.createAndOpenDrawing(
      ownedName("copy") + ".excalidraw.md",
      "new-tab",
      "/",
    );
    const copyFile = app.vault.getFileByPath(copyPath);
    files.push(copyFile);
    await waitFor(() => {
      copyLeaf = app.workspace
        .getLeavesOfType("excalidraw")
        .find((l) => l.view.file?.path === copyPath);
      return copyLeaf?.view.excalidrawAPI;
    }, "copy drawing");
    const target = copyLeaf.view,
      transfer = new target.ownerWindow.DataTransfer();
    app.workspace.setActiveLeaf(copyLeaf, { focus: true });
    target.excalidrawAPI.updateScene({
      appState: { viewModeEnabled: false, selectedElementIds: {} },
      captureUpdate: "NEVER",
      forceFlushSync: true,
    });
    transfer.setData(
      "text/plain",
      JSON.stringify({
        type: "excalidraw/clipboard",
        elements: sourceElements,
        files: {},
      }),
    );
    target.containerEl.querySelector(".excalidraw").focus();
    const canvas = target.containerEl.querySelector("canvas.interactive"),
      bounds = canvas.getBoundingClientRect();
    const x = bounds.x + bounds.width / 2,
      y = bounds.y + bounds.height / 2;
    canvas.dispatchEvent(
      new target.ownerWindow.PointerEvent("pointermove", {
        bubbles: true,
        clientX: x,
        clientY: y,
        pointerType: "mouse",
        pointerId: 1,
      }),
    );
    c.clipboardDebug = {
      active: target.ownerDocument.activeElement?.className,
      under: target.ownerDocument.elementFromPoint(x, y)?.tagName,
      mode: target.excalidrawAPI.getAppState().viewModeEnabled,
    };
    target.containerEl.querySelector(".excalidraw").dispatchEvent(
      new target.ownerWindow.ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: transfer,
      }),
    );
    await waitFor(
      () => target.getViewElements().length === sourceElements.length,
      "cross-drawing native paste",
    );
    if (
      target
        .getViewElements()
        .some((e) => sourceElements.some((source) => source.id === e.id))
    )
      throw Error("native paste reused identities");
    await target.forceSave(true, true);
    const imageEA = new plugin.ea.constructor(plugin, target);
    let imageId;
    try {
      imageId = await imageEA.addImage(0, 150, selected);
      if (imageEA.getElement(imageId)?.type !== "image")
        throw Error("ordinary SVG image insertion was converted to strokes");
      await imageEA.addElementsToView(false, false, true, true);
    } finally {
      imageEA.destroy();
    }
    await waitFor(
      () =>
        target
          .getViewElements()
          .some((e) => e.id === imageId && e.type === "image"),
      "ordinary SVG image insertion",
    );
    await target.forceSave(true, true);
    c.editorResults ??= [];
    c.editorResults.push({
      window: popout ? "popout" : "main",
      eaAppend: true,
      failureAtomic: true,
      command: true,
      grouping: true,
      scriptedEditDuplicateResizeRotate: true,
      undoRedo: true,
      copyBetweenDrawings: true,
      svgAsImage: true,
      svgExport: true,
      pngBytes: png.size,
      reopen: true,
    });
  } finally {
    c.stage = "cleanup";
    if (copyLeaf) {
      await copyLeaf.setViewState({ type: "empty", state: {} });
      copyLeaf.detach();
    }
    if (popout && leaf) {
      await leaf.setViewState({ type: "empty", state: {} });
      leaf.detach();
    }
    for (const file of files) {
      if (
        file?.name.startsWith("__excalidraw_cli_smoke_svg_") &&
        app.vault.getFileByPath(file.path)
      )
        await app.vault.delete(file);
    }
    app.workspace.setActiveLeaf(main, { focus: true });
  }
}
