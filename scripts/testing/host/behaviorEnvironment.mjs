/** Serialized only into the owned native vault; shared setup never substitutes for behavioral assertions. */
export async function behaviorEnvironment(c, parentPath, context, template) {
  const p = app.plugins.plugins["obsidian-excalidraw-plugin"],
    mainDoc = app.workspace.containerEl.ownerDocument;
  const check = (condition, label) => {
    if (!condition) throw Error(label);
  };
  check(
    parentPath.startsWith("__excalidraw_cli_smoke_"),
    "Unowned behavior fixture",
  );
  const prefix =
    parentPath.replace(/\.(excalidraw\.md|excalidraw|md)$/, "") +
    "_behavior_" +
    context.id;
  check(!app.vault.getFolderByPath(prefix), "Behavior fixture collision");
  await app.vault.createFolder(prefix);
  const owned = new Set(),
    previous = app.workspace.activeLeaf;
  c.defer(async () => {
    for (const leaf of [...owned].reverse()) {
      if (leaf.view?.excalidrawAPI && leaf.view.isDirty())
        check(
          (await leaf.view.saveWithOutcome()).status === "persisted",
          "Behavior cleanup save failed",
        );
      if (leaf.view?.containerEl.isConnected) {
        await leaf.setViewState({ type: "empty", state: {} });
        leaf.detach();
      }
    }
    const folder = app.vault.getFolderByPath(prefix);
    if (folder) await app.vault.delete(folder, true);
    if (previous?.view.containerEl.isConnected)
      app.workspace.setActiveLeaf(previous, { focus: true });
  });
  const settings = structuredClone(p.settings);
  c.defer(async () => {
    delete p.settings.__behaviorFutureSetting;
    Object.assign(p.settings, settings);
    await p.saveSettings();
  });
  const ready = async (leaf) =>
    c.waitFor(
      () =>
        leaf.view?.excalidrawAPI &&
        leaf.view.isLoaded &&
        !leaf.view.semaphores.justLoaded &&
        !leaf.view.excalidrawAPI.getAppState().isLoading &&
        !leaf.view.isClosingOrMigrating(),
      "behavior drawing readiness",
    );
  const focusMain = () => {
    let leaf;
    app.workspace.iterateAllLeaves((candidate) => {
      if (!leaf && candidate.getRoot() === app.workspace.rootSplit)
        leaf = candidate;
    });
    check(leaf, "No main workspace anchor");
    app.workspace.setActiveLeaf(leaf, { focus: true });
    return leaf;
  };
  const anchor = focusMain();
  let leaf;
  if (context.id === "popout") {
    leaf = app.workspace.openPopoutLeaf();
    await c.waitFor(
      () => leaf.view.containerEl.ownerDocument !== mainDoc,
      "empty behavior popout migration",
    );
  } else if (context.id === "nested-split") {
    const first = app.workspace.getLeaf("split", "vertical");
    owned.add(first);
    const note = await app.vault.create(
      prefix + "/Split-anchor.md",
      "Owned nested-split anchor.",
    );
    await first.openFile(note);
    app.workspace.setActiveLeaf(first, { focus: true });
    leaf = app.workspace.getLeaf("split", "horizontal");
    check(
      first.parent !== anchor.parent && leaf.parent !== first.parent,
      "Nested behavior context did not create independent tab groups",
    );
  } else leaf = app.workspace.getLeaf(context.id === "split" ? "split" : "tab");
  owned.add(leaf);
  if (context.id === "split")
    check(
      leaf.parent !== anchor.parent,
      "Split behavior context reused the original tab group",
    );
  const workspacePath = () => {
    const find = (node, path = []) => {
      if (node.type === "leaf" && node.id === leaf.id) return path;
      for (const child of node.children || []) {
        const result = find(child, [
          ...path,
          { type: node.type, direction: node.direction, id: node.id },
        ]);
        if (result) return result;
      }
    };
    return find(app.workspace.getLayout().main) || [];
  };
  if (context.id === "nested-split")
    check(
      workspacePath().filter((node) => node.type === "split").length >= 2,
      "Nested behavior context is not nested in the actual saved workspace tree",
    );
  const doc = leaf.view.containerEl.ownerDocument,
    win = doc.defaultView;
  const ownerContents = win.require("@electron/remote").getCurrentWebContents();
  const mainContents = mainDoc.defaultView
    .require("@electron/remote")
    .getCurrentWebContents();
  const errors = [];
  if (ownerContents.id !== mainContents.id) {
    check(
      !ownerContents.debugger.isAttached(),
      "Behavior popout already has a debugger owner",
    );
    ownerContents.debugger.attach("1.3");
    const listener = (_event, method, params) => {
      if (method === "Runtime.exceptionThrown")
        errors.push(params.exceptionDetails);
      if (method === "Runtime.consoleAPICalled" && params.type === "error")
        errors.push(params.args);
    };
    ownerContents.debugger.on("message", listener);
    await ownerContents.debugger.sendCommand("Runtime.enable");
    c.defer(() => {
      ownerContents.debugger.removeListener("message", listener);
      ownerContents.debugger.detach();
      check(
        errors.length === 0,
        "Unexpected popout behavior error: " + JSON.stringify(errors),
      );
    });
  }
  const input = (method, params) =>
    c.requestHost("behavior-input", {
      contentsId: ownerContents.id,
      method,
      params,
    });
  const key = async (key, code, keyCode, modifiers = 0) => {
    for (const type of ["keyDown", "keyUp"])
      await input("Input.dispatchKeyEvent", {
        type,
        key,
        code,
        windowsVirtualKeyCode: keyCode,
        modifiers,
      });
  };
  const click = async (element, button = "left") => {
    check(element, "Missing interaction target");
    element.scrollIntoView({ block: "nearest", inline: "nearest" });
    let x, y;
    await c.waitFor(() => {
      const r = element.getBoundingClientRect();
      x = r.x + r.width / 2;
      y = r.y + r.height / 2;
      return (
        r.width > 0 &&
        r.height > 0 &&
        element.contains(doc.elementFromPoint(x, y))
      );
    }, "visible uncovered behavior control");
    if (context.input === "touch" && button === "left") {
      await input("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y, id: 1 }],
      });
      await input("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    } else {
      await input("Input.dispatchMouseEvent", {
        type: "mousePressed",
        x,
        y,
        button,
        buttons: button === "right" ? 2 : 1,
        clickCount: 1,
      });
      await input("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x,
        y,
        button,
        buttons: 0,
        clickCount: 1,
      });
    }
  };
  const create = (name, content) =>
    app.vault.create(prefix + "/" + name, content);
  const openDrawing = async (name, frontmatter = {}, source = template) => {
    const yaml = Object.entries(frontmatter)
      .map(([key, value]) => key + ": " + JSON.stringify(value))
      .join("\n");
    const file = await create(
      name + ".excalidraw.md",
      source.replace(
        "excalidraw-plugin: parsed",
        "excalidraw-plugin: parsed\n" + yaml,
      ),
    );
    await c.waitFor(
      () =>
        p.isExcalidrawFile(file) &&
        Object.entries(frontmatter).every(
          ([key, value]) =>
            JSON.stringify(
              app.metadataCache.getFileCache(file)?.frontmatter?.[key],
            ) === JSON.stringify(value),
        ),
      "drawing metadata and declared overrides",
    );
    await leaf.openFile(file);
    await ready(leaf);
    app.workspace.setActiveLeaf(leaf, { focus: true });
    win.focus();
    check(
      leaf.view.ownerDocument === doc &&
        (doc !== mainDoc) === (context.id === "popout"),
      "Drawing window targeting changed",
    );
    return leaf.view;
  };
  const saveReopen = async (view) => {
    const ids = view.excalidrawAPI.getSceneElements().map((e) => e.id),
      file = view.file;
    check(
      (await view.saveWithOutcome()).status === "persisted",
      "Behavior save not physically acknowledged",
    );
    const disk = await p.ea.getSceneFromFile(file);
    check(
      JSON.stringify(
        disk.elements.filter((e) => !e.isDeleted).map((e) => e.id),
      ) === JSON.stringify(ids),
      "Behavior scene IDs differ on disk",
    );
    await leaf.setViewState({ type: "empty", state: {} });
    await leaf.openFile(file);
    await ready(leaf);
    check(
      JSON.stringify(
        leaf.view.excalidrawAPI.getSceneElements().map((e) => e.id),
      ) === JSON.stringify(ids),
      "Behavior scene IDs differ after reopen",
    );
    return leaf.view;
  };
  const decode = async (source) => {
    const image = new win.Image(),
      url =
        typeof source === "string" ? source : win.URL.createObjectURL(source);
    try {
      image.src = url;
      await image.decode();
      const canvas = doc.body.createEl("canvas");
      canvas.remove();
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      check(
        canvas.width > 0 && canvas.height > 0,
        "Decoded output has no dimensions",
      );
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let red = 0,
        blue = 0,
        transparent = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (
          pixels[i] > 180 &&
          pixels[i + 1] < 90 &&
          pixels[i + 2] < 90 &&
          pixels[i + 3]
        )
          red++;
        if (pixels[i + 2] > 180 && pixels[i] < 90 && pixels[i + 3]) blue++;
        if (!pixels[i + 3]) transparent++;
      }
      return {
        width: canvas.width,
        height: canvas.height,
        red,
        blue,
        transparent,
        cornerAlpha: pixels[3],
      };
    } finally {
      if (typeof source !== "string") win.URL.revokeObjectURL(url);
    }
  };
  const geometry = () => ({
    requested: context,
    mobile: app.isMobile === true,
    hostDevice: p.getObsidianDevice(),
    viewport: { width: win.innerWidth, height: win.innerHeight },
    editor: leaf.view.containerEl.getBoundingClientRect().toJSON(),
    editorInterface: leaf.view.excalidrawAPI?.getEditorInterface(),
    workspacePath: workspacePath(),
    leafId: leaf.id,
    ownerContentsId: ownerContents.id,
    mainContentsId: mainContents.id,
  });
  check(
    (app.isMobile === true) === ["phone", "tablet"].includes(context.id),
    "Behavior context does not match actual Obsidian mobile mode",
  );
  return {
    p,
    doc,
    win,
    prefix,
    leaf,
    owned,
    check,
    ready,
    create,
    openDrawing,
    saveReopen,
    decode,
    input,
    key,
    click,
    geometry,
  };
}
