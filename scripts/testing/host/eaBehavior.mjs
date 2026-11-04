/** Public EA operations and hooks, without invoking maintained user scripts. */
export async function exerciseEABehavior(c, env, rows) {
  const { p, check, openDrawing, saveReopen } = env;
  for (const row of rows)
    await c.case(row.testId, row.featureIds, async () => {
      let view = await openDrawing(row.id);
      const ea = p.ea.getAPI(view),
        cleanups = [];
      ea.registerCleanup(() => cleanups.push("disposed"));
      try {
        if (row.id === "ea-selection-groups-bindings-frames") {
          const a = ea.addRect(20, 20, 120, 60),
            b = ea.addEllipse(280, 20, 120, 60);
          const textBox = ea.addText(30, 130, "Behavior EA text", {
            box: "box",
          });
          const arrow = ea.connectObjects(a, "right", b, "left", {
            endArrowHead: "arrow",
          });
          const group = ea.addToGroup([a, b]),
            frame = ea.addFrame(0, 0, 500, 250, "Behavior frame");
          ea.addElementsToFrame(frame, [a, b, textBox, arrow]);
          check(
            ea
              .getElementsInFrame(ea.getElement(frame), ea.getElements())
              .some((el) => el.id === a),
            "EA frame query omitted a child",
          );
          check(
            ea.getElementsInFrame(null, ea.getElements()).length === 0,
            "Invalid frame query must not select unrelated objects",
          );
          ea.getElement(a).customData = {
            behavior: { context: row.context, zero: 0, flag: false },
          };
          check(
            await ea.addElementsToView(false, true, true),
            "EA could not publish authored elements",
          );
          ea.selectElementsInView([a, b]);
          await c.waitFor(
            () =>
              ea.getViewSelectedElements(false).some((el) => el.id === a) &&
              ea.getViewSelectedElements(false).some((el) => el.id === b),
            "EA selection publication",
          );
          const byId = (id) =>
            view.excalidrawAPI.getSceneElements().find((e) => e.id === id);
          check(
            byId(a).groupIds.includes(group) &&
              byId(b).groupIds.includes(group),
            "EA group relation missing",
          );
          check(
            byId(a).frameId === frame &&
              byId(b).frameId === frame &&
              byId(arrow).startBinding?.elementId === a &&
              byId(arrow).endBinding?.elementId === b,
            "EA frame/binding relation missing",
          );
          ea.clear();
          const before = byId(a).x;
          ea.copyViewElementsToEAforEditing([byId(a)]);
          ea.getElement(a).x += 17;
          check(
            byId(a).x === before,
            "Workbench edited the live scene before publication",
          );
          check(
            await ea.addElementsToView(false, true, true),
            "EA edit publication failed",
          );
          view = await saveReopen(view);
          const saved = view.excalidrawAPI
            .getSceneElements()
            .find((e) => e.id === a);
          check(
            saved.x === before + 17 &&
              saved.customData.behavior.zero === 0 &&
              saved.customData.behavior.flag === false,
            "EA edit/custom data did not survive reopen",
          );
        } else {
          const otherFile = await env.create(
            "Target-isolation.excalidraw.md",
            await app.vault.read(view.file),
          );
          const otherLeaf = app.workspace.getLeaf("tab");
          env.owned.add(otherLeaf);
          await c.waitFor(
            () =>
              p.isExcalidrawFile(otherFile) &&
              app.metadataCache.getFileCache(otherFile)?.frontmatter?.[
                "excalidraw-plugin"
              ],
            "other EA target metadata",
          );
          await otherLeaf.openFile(otherFile);
          await env.ready(otherLeaf);
          app.workspace.setActiveLeaf(otherLeaf, { focus: true });
          const otherBefore = JSON.stringify(
            otherLeaf.view.excalidrawAPI.getSceneElements(),
          );
          check(
            ea.targetView === view &&
              ea.getExcalidrawAPI() === view.excalidrawAPI,
            "EA switched to the active drawing instead of its explicit target",
          );
          const id = ea.addRect(75, 90, 111, 55);
          ea.getElement(id).customData = { target: view.file.path };
          const count = ea.getElements().length;
          check(
            ea.connectObjects("missing-behavior-id", "right", id, "left") ===
              undefined && ea.getElements().length === count,
            "Invalid EA connection partially mutated its workbench",
          );
          const hookCalls = [];
          ea.onSceneChangeHook = {
            trackElements: true,
            callback: (_elements, _state, _files, target) =>
              hookCalls.push(target.file.path),
          };
          check(
            ea.registerThisAsViewEA(),
            "Could not register target-scoped EA hooks",
          );
          check(
            await ea.addElementsToView(false, true, true),
            "Targeted EA publication failed",
          );
          await c.waitFor(
            () => hookCalls.includes(view.file.path),
            "target scene change hook",
          );
          check(
            hookCalls.every((path) => path === view.file.path),
            "Hook ran against another drawing",
          );
          check(
            JSON.stringify(otherLeaf.view.excalidrawAPI.getSceneElements()) ===
              otherBefore,
            "Explicit EA target contaminated active drawing",
          );
          view = await saveReopen(view);
          check(
            view.excalidrawAPI
              .getSceneElements()
              .some(
                (e) => e.id === id && e.customData.target === view.file.path,
              ),
            "Targeted custom data missing from saved/reopened scene",
          );
          ea.setView(null);
          check(
            ea.targetView === null,
            "Explicit null target did not clear EA target",
          );
        }
        ea.destroy();
        ea.destroy();
        check(
          cleanups.length === 1 && ea.targetView === null,
          "EA disposal was not idempotent",
        );
        return {
          assertions: row.assertions,
          actual: env.geometry(),
          publicAPIs:
            row.id === "ea-selection-groups-bindings-frames"
              ? [
                  "getAPI",
                  "addRect",
                  "addEllipse",
                  "addText",
                  "connectObjects",
                  "addToGroup",
                  "addFrame",
                  "addElementsToFrame",
                  "getElementsInFrame",
                  "selectElementsInView",
                  "getViewSelectedElements",
                  "copyViewElementsToEAforEditing",
                  "addElementsToView",
                  "registerCleanup",
                  "destroy",
                ]
              : [
                  "getAPI",
                  "setView",
                  "getExcalidrawAPI",
                  "addRect",
                  "connectObjects",
                  "getElements",
                  "addElementsToView",
                  "onSceneChangeHook",
                  "registerThisAsViewEA",
                  "registerCleanup",
                  "destroy",
                ],
        };
      } finally {
        ea.destroy();
      }
    });
}

export async function exerciseSettingsLifecycle(c, env, rows) {
  const { p, check, openDrawing, saveReopen } = env;
  for (const row of rows)
    await c.case(row.testId, row.featureIds, async () => {
      if (row.id === "settings-live-persistence") {
        Object.assign(p.settings, {
          defaultMode: "normal",
          linkOpacity: 1,
          showLinkBrackets: true,
        });
        let view = await openDrawing(row.id);
        p.settings.linkOpacity = 0;
        p.settings.showLinkBrackets = false;
        p.settings.__behaviorFutureSetting = {
          retained: true,
          zero: 0,
          flag: false,
        };
        check(
          view.excalidrawData.getLinkOpacity() === 0,
          "Live global opacity update not read",
        );
        await p.saveSettings();
        const disk = JSON.parse(
          await app.vault.adapter.read(
            app.vault.configDir +
              "/plugins/obsidian-excalidraw-plugin/data.json",
          ),
        );
        check(
          disk.linkOpacity === 0 &&
            disk.showLinkBrackets === false &&
            disk.__behaviorFutureSetting.zero === 0 &&
            disk.__behaviorFutureSetting.flag === false,
          "Physical settings write lost zero/false/unknown keys",
        );
        await p.loadSettings();
        check(
          p.settings.linkOpacity === 0 &&
            p.settings.showLinkBrackets === false &&
            p.settings.__behaviorFutureSetting.retained,
          "Settings load did not recover saved values",
        );
        const api = view.excalidrawAPI,
          canvas = view.containerEl.querySelector("canvas.interactive"),
          bounds = canvas.getBoundingClientRect();
        const wheelEvents = [];
        c.caseTrace = { wheelEvents };
        const observeWheel = (event) =>
          wheelEvents.push({
            trusted: event.isTrusted,
            deltaY: event.deltaY,
            ctrl: event.ctrlKey,
            meta: event.metaKey,
            target: event.target?.className,
          });
        canvas.addEventListener("wheel", observeWheel, { passive: true });
        c.defer(() => canvas.removeEventListener("wheel", observeWheel));
        p.settings.allowWheelZoom = true;
        let point;
        for (const [x, y] of [
          [0.7, 0.55],
          [0.65, 0.7],
          [0.55, 0.5],
        ]) {
          const value = {
            x: bounds.x + bounds.width * x,
            y: bounds.y + bounds.height * y,
          };
          if (env.doc.elementFromPoint(value.x, value.y) === canvas) {
            point = value;
            break;
          }
        }
        check(point, "No uncovered wheel target in this context");
        p.settings.zoomMin = 0.5;
        p.settings.zoomMax = 3;
        api.updateScene({
          appState: {
            allowWheelZoom: true,
            inputDevice: "trackpad",
            zoom: { value: 1 },
            scrollConstraints: null,
          },
          captureUpdate: "NEVER",
        });
        await c.waitFor(
          () => api.getAppState().allowWheelZoom === true,
          "wheel-ready app state",
        );
        for (let i = 0; i < 12 && api.getAppState().zoom.value > 0.5; i++) {
          const before = api.getAppState().zoom.value;
          await env.input("Input.dispatchMouseEvent", {
            type: "mouseWheel",
            ...point,
            modifiers: 0,
            deltaX: 0,
            deltaY: 300,
          });
          // Wait for each wheel update; Chromium may coalesce a burst of ticks.
          await c.waitFor(
            () => api.getAppState().zoom.value < before,
            "individual trusted wheel update",
          );
        }
        await c.waitFor(
          () => Math.abs(api.getAppState().zoom.value - 0.5) < 1e-8,
          "trusted wheel uses first live minimum",
        );
        p.settings.zoomMin = 0.75;
        await env.input("Input.dispatchMouseEvent", {
          type: "mouseWheel",
          ...point,
          modifiers: 0,
          deltaX: 0,
          deltaY: 300,
        });
        await c.waitFor(
          () => Math.abs(api.getAppState().zoom.value - 0.75) < 1e-8,
          "trusted wheel reads changed host minimum without reload",
        );
        view = await saveReopen(view);
        check(
          view.excalidrawData.getLinkOpacity() === 0 &&
            view.excalidrawData.showLinkBrackets === false,
          "Reopened drawing did not observe persisted live settings",
        );
        delete p.settings.__behaviorFutureSetting;
      } else {
        Object.assign(p.settings, {
          defaultMode: "normal",
          linkPrefix: "GLOBAL ",
          urlPrefix: "URL ",
          exportPaddingSVG: 20,
          pngExportScale: 2,
          exportEmbedScene: true,
          iframeMatchExcalidrawTheme: true,
        });
        let view = await openDrawing(row.id, {
          "excalidraw-link-prefix": "",
          "excalidraw-url-prefix": "",
          "excalidraw-embeddable-theme": "dark",
          "excalidraw-export-padding": 0,
          "excalidraw-export-svgpadding": 77,
          "excalidraw-export-pngscale": 0,
        });
        check(
          view.excalidrawData.linkPrefix === "" &&
            view.excalidrawData.urlPrefix === "",
          "Empty prefix override lost to global defaults",
        );
        check(
          view.excalidrawData.embeddableTheme === "dark",
          "Embeddable theme override ignored",
        );
        check(
          view.getViewExportPadding() === 0 && view.getViewExportScale() === 2,
          "Zero padding / invalid zero scale precedence differs",
        );
        view = await saveReopen(view);
        check(
          view.excalidrawData.linkPrefix === "" &&
            view.getViewExportPadding() === 0,
          "Prefix/padding override lost on reopen",
        );
        await app.fileManager.processFrontMatter(view.file, (fm) => {
          fm["excalidraw-export-pngscale"] = 3;
          fm["excalidraw-export-embed-scene"] = false;
          fm["excalidraw-export-internal-links"] = false;
        });
        await c.waitFor(
          () =>
            app.metadataCache.getFileCache(view.file)?.frontmatter?.[
              "excalidraw-export-pngscale"
            ] === 3,
          "updated frontmatter scale metadata",
        );
        await c.waitFor(
          () => view.data.includes("excalidraw-export-pngscale: 3"),
          "loaded view synchronizes external frontmatter before saving",
        );
        view = await saveReopen(view);
        check(
          view.getViewExportScale() === 3 &&
            view.getViewExportEmbedScene() === false &&
            view.getViewExportIncludeInternalLinks() === false,
          "Positive scale or explicit false export override lost on reopen",
        );
      }
      return {
        assertions: row.assertions,
        actual: env.geometry(),
        reopened: true,
      };
    });
}
