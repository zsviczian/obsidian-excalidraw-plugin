/** Serialized only into the owned native vault; shared setup never substitutes for behavioral assertions. */
export async function behaviorEnvironment(
  c,
  parentPath,
  context,
  template,
  completeConsoleErrors,
  settleBrowserDiagnostics,
) {
  const p = app.plugins.plugins["obsidian-excalidraw-plugin"],
    mainDoc = app.workspace.containerEl.ownerDocument;
  const check = (condition, label) => {
    if (!condition) throw Error(label);
  };
  check(
    parentPath.startsWith("__excalidraw_cli_smoke_"),
    "Unowned behavior fixture",
  );
  const runId = parentPath.match(
    /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i,
  )?.[0];
  check(runId, "Owned behavior parent has no run identity");
  const prefix =
    "__excalidraw_cli_smoke_" + runId.slice(0, 8) + "_behavior_" + context.id;
  check(!app.vault.getFolderByPath(prefix), "Behavior fixture collision");
  await app.vault.createFolder(prefix);
  const windowErrors = [], browserIdle = [],
    errorListeners = [];
  const observeWindowErrors = (window) => {
    const listener = (event) =>
      windowErrors.push({
        context: context.id,
        window: window === mainDoc.defaultView ? "main" : "owner",
        phase: c.activeCase || c.phase,
        message: event.message,
        at: Date.now(),
        hasError: event.error != null,
        isTrusted: event.isTrusted,
        stack: event.error?.stack,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
      });
    window.addEventListener("error", listener);
    errorListeners.push({ window, listener });
  };
  // Registered first so it also observes owned teardown; no error is suppressed.
  c.defer(() => {
    for (const { window, listener } of errorListeners)
      if (!window.closed) window.removeEventListener("error", listener);
  });
  observeWindowErrors(mainDoc.defaultView);
  const owned = new Set(),
    previous = app.workspace.activeLeaf;
  c.defer(async () => {
    c.phase = "behavior:" + context.id + ":cleanup";
    const windows = new Map();
    for (const leaf of [...owned].reverse()) {
      const view = leaf.view,
        owner = view.ownerWindow || view.containerEl.ownerDocument.defaultView;
      if (!owner || owner.closed) {
        await c.waitForCleanup(
          () => !view.excalidrawAPI,
          "retired behavior editor teardown",
        );
        continue;
      }
      if (!windows.has(owner)) windows.set(owner, []);
      windows.get(owner).push({ leaf, view });
    }
    for (const [owner, entries] of windows) {
      browserIdle.push(await settleBrowserDiagnostics(owner,windowErrors,'behavior:'+context.id));
      for (const { view } of entries) view.exitFullscreen?.();
      for (const { view } of entries)
        if (view.excalidrawAPI && view.isDirty())
          check(
            (await view.saveWithOutcome()).status === "persisted",
            "Behavior cleanup save failed",
          );
      if (owner !== mainDoc.defaultView) {
        // Several owned drawings can share this popout. Retire all its tabs
        // before closing the window; do not strand setViewState promises there.
        for (const { leaf } of entries) leaf.detach();
        if (!owner.closed) owner.close();
        await c.waitForCleanup(
          () =>
            owner.closed && entries.every(({ view }) => !view.excalidrawAPI),
          "all owned popout editors teardown",
        );
      } else {
        for (const { leaf } of entries)
          if (leaf.view.containerEl.isConnected) {
            await leaf.setViewState({ type: "empty", state: {} });
            leaf.detach();
          }
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
  if (win !== mainDoc.defaultView) observeWindowErrors(win);
  const ownerContents = win.require("@electron/remote").getCurrentWebContents();
  const mainContents = mainDoc.defaultView
    .require("@electron/remote")
    .getCurrentWebContents();
  const errors = [];
  c.externalConsoleErrors = errors;
  if (ownerContents.id !== mainContents.id) {
    check(
      !ownerContents.debugger.isAttached(),
      "Behavior popout already has a debugger owner",
    );
    const background = ownerContents.getBackgroundThrottling();
    ownerContents.setBackgroundThrottling(false);
    c.defer(() => {
      if (!ownerContents.isDestroyed())
        ownerContents.setBackgroundThrottling(background);
    });
    ownerContents.debugger.attach("1.3");
    const listener = (_event, method, params) => {
      if (method === "Runtime.exceptionThrown")
        errors.push({
          kind: "exception",
          details: params.exceptionDetails,
          messages: [
            String(
              params.exceptionDetails.exception?.description ??
                params.exceptionDetails.text,
            ),
          ],
        });
      if (method === "Runtime.consoleAPICalled" && params.type === "error")
        errors.push({
          kind: "console",
          overflowArgs: params.args.some((arg) => arg.preview?.overflow)
            ? params.args
            : undefined,
          messages: params.args.map(
            (arg) =>
              String(arg.description ?? arg.value ?? arg.type) +
              (arg.preview?.properties
                ? " " + JSON.stringify(arg.preview.properties)
                : ""),
          ),
        });
    };
    ownerContents.debugger.on("message", listener);
    await ownerContents.debugger.sendCommand("Runtime.enable");
    c.defer(async () => {
      await completeConsoleErrors({ errors, debugger: ownerContents.debugger });
      ownerContents.debugger.removeListener("message", listener);
      ownerContents.debugger.detach();
      // The coordinator applies the same strict error/count oracle across
      // main and popout captures after owned cleanup has settled.
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
  const click = async (target, button = "left") => {
    // Menus may replace a button while positioning. Reacquire only when the
    // caller supplies a resolver; every candidate still needs a real hit test.
    const resolve = () => typeof target === "function" ? target() : target;
    let element = resolve();
    check(element || typeof target === "function", "Missing interaction target");
    // Leave already-visible controls in place. Scrolling a fixed toolbar or
    // modal input can disturb the surrounding Obsidian workspace layout.
    const uncovered = () =>
      element && [...element.getClientRects()].some(
        (r) =>
          r.width > 0 &&
          r.height > 0 &&
          element.contains(
            doc.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
          ),
      );
    if (element && !uncovered())
      element.scrollIntoView({
        block: element.tagName === "A" ? "center" : "nearest",
        inline: "nearest",
      });
    let x, y;
    await c.waitFor(() => {
      element = resolve();
      if (!element) return false;
      // Wrapped inline links have a bounding-box center outside their text.
      for (const r of element.getClientRects()) {
        x = r.x + r.width / 2;
        y = r.y + r.height / 2;
        if (
          r.width > 0 &&
          r.height > 0 &&
          element.contains(doc.elementFromPoint(x, y))
        )
          return true;
      }
      c.caseTrace = {
        ...c.caseTrace,
        clickTarget: {
          html: element.outerHTML.slice(0, 700),
          connected: element.isConnected,
          bounds: element.getBoundingClientRect().toJSON(),
          hit: doc.elementFromPoint(x, y)?.outerHTML.slice(0, 400),
        },
      };
      return false;
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
    if (["phone", "tablet"].includes(context.id)) {
      leaf.view.gotoFullscreen();
      await c.waitFor(
        () =>
          leaf.view.excalidrawAPI.getEditorInterface().formFactor ===
          context.id,
        "actual " + context.id + " editor classification",
      );
    }
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
    check(view.leaf===leaf,'Save/reopen selected a different owned leaf');
    app.workspace.setActiveLeaf(leaf,{focus:true});
    await leaf.setViewState({ type: "empty", state: {} });
    await leaf.openFile(file);
    app.workspace.setActiveLeaf(leaf,{focus:true});
    await ready(leaf);
    if (["phone", "tablet"].includes(context.id)) {
      leaf.view.gotoFullscreen();
      await c.waitFor(
        () =>
          leaf.view.excalidrawAPI.getEditorInterface().formFactor ===
          context.id,
        "reopened " + context.id + " editor classification",
      );
    }
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
      // Read the actual resource through its CORS contract, without a version branch.
      image.crossOrigin = "anonymous";
      image.src = url;
      await image.decode();
      // Keep verification out of the observed workspace layout in every window.
      const canvas = doc.adoptNode(createFragment()).createEl("canvas");
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
        green = 0,
        blue = 0,
        transparent = 0;
      let redDominant = 0,
        halfAlphaRed = 0,
        redOverWhite = 0;
      const opaqueColors = new Map();
      for (let i = 0; i < pixels.length; i += 4) {
        const [r, g, b, a] = pixels.subarray(i, i + 4);
        if (a && r > g + 30 && r > b + 30) {
          redDominant++;
          if (a >= 120 && a <= 136) halfAlphaRed++;
        }
        if (
          r === 255 &&
          Math.abs(g - 127.5) < 1.6 &&
          Math.abs(b - 127.5) < 1.6 &&
          a === 255
        )
          redOverWhite++;
        if (a === 255) {
          const key = r + "," + g + "," + b;
          opaqueColors.set(key, (opaqueColors.get(key) || 0) + 1);
        }
        if (
          pixels[i] > 180 &&
          pixels[i + 1] < 90 &&
          pixels[i + 2] < 90 &&
          pixels[i + 3]
        )
          red++;
        if (pixels[i + 2] > 180 && pixels[i] < 90 && pixels[i + 3]) blue++;
        if (g > 180 && r < 90 && b < 90 && a) green++;
        if (!pixels[i + 3]) transparent++;
      }
      return {
        width: canvas.width,
        height: canvas.height,
        red,
        green,
        blue,
        transparent,
        cornerAlpha: pixels[3],
        redDominant,
        halfAlphaRed,
        redOverWhite,
        dominantOpaque: [...opaqueColors.entries()]
          .sort((a, b) => b[1] - a[1])[0]?.[0]
          .split(",")
          .map(Number),
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
    visibility: doc.visibilityState,
    scopedBackgroundThrottling: ownerContents.getBackgroundThrottling(),
    focusEmulation: false,
  });
  const diagnostics = () => {
    const view = leaf.view,
      state = view.excalidrawAPI?.getAppState();
    return {
      file: view.file?.path,
      viewType: view.getViewType(),
      mode: view.getMode?.(),
      actual: geometry(),
      camera: state
        ? {
            zoom: state.zoom,
            allowWheelZoom: state.allowWheelZoom,
            inputDevice: state.inputDevice,
            width: state.width,
            height: state.height,
            viewModeEnabled: state.viewModeEnabled,
          }
        : null,
      canvas: [...view.containerEl.querySelectorAll("canvas")].map((el) => ({
        classes: el.className,
        bounds: el.getBoundingClientRect().toJSON(),
      })),
      preview: [
        ...view.contentEl.querySelectorAll(
          ".markdown-preview-view,.markdown-preview-sizer",
        ),
      ]
        .slice(0, 3)
        .map((el) => ({
          classes: el.className,
          bounds: el.getBoundingClientRect().toJSON(),
          text: el.textContent.slice(0, 800),
          html: el.outerHTML.slice(0, 1800),
        })),
      palette: [...doc.querySelectorAll(".prompt .suggestion-item")].map(
        (el) => el.textContent,
      ),
      trace: c.caseTrace,
    };
  };
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
    diagnostics,
    windowErrors,
    browserIdle,
  };
}
