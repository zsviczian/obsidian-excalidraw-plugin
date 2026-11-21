/** Trusted CDP input reaches command palette, toolbar, context menu and real shortcuts. */
export async function exerciseInteractionBehavior(c, env, rows, modifier) {
  const { p, check, doc, key, click } = env;
  for (const row of rows)
    await c.case(row.testId, row.featureIds, async () => {
      const checkColorShortcut = row.id === "toolbar-context-shortcuts" &&
        ["main", "popout"].includes(row.context);
      Object.assign(p.settings, {
        defaultMode: "normal",
        disableContextMenu: false,
        penModeSingleFingerPanning: false,
      });
      if (checkColorShortcut) p.settings.desktopUIMode = "full";
      let view = await env.openDrawing(row.id),
        api = view.excalidrawAPI;
      const events = [],
        listener = (e) =>
          events.push({
            type: e.type,
            at: e.timeStamp,
            trusted: e.isTrusted,
            pointerType: e.pointerType,
            x:e.clientX,y:e.clientY,target:e.target?.outerHTML?.slice(0,250),
          });
      const toolsPanelLayouts = [];
      for (const type of ["keydown", "pointerdown", "contextmenu"])
        doc.addEventListener(type, listener, true);
      try {
        if (row.id === "command-palette-selection-cancel") {
          const command =
            app.commands.commands["obsidian-excalidraw-plugin:fullscreen"];
          check(command, "Fullscreen command missing");
          const before = JSON.stringify(api.getSceneElements()),
            wasFullscreen = view.isFullscreen();
          const search = async (selected = command) => {
            await key("p", "KeyP", 80, modifier);
            await c.waitFor(
              () => doc.querySelector(".prompt input.prompt-input"),
              "trusted command-palette opening",
            );
            let input;
            await click(()=>doc.querySelector(".prompt input.prompt-input"));
            await c.waitFor(
              () => {
                input=doc.querySelector(".prompt input.prompt-input");
                c.caseTrace={paletteFocus:{input:input?.outerHTML,active:doc.activeElement?.outerHTML?.slice(0,500),focused:doc.hasFocus(),events}};
                return input && doc.activeElement === input;
              },
              "palette input focus",
            );
            await env.input("Input.insertText", { text: selected.name });
            let item;
            await c.waitFor(() => {
              c.caseTrace = {
                command: selected.name,
                query: input.value,
                items: [
                  ...doc.querySelectorAll(".prompt .suggestion-item"),
                ].map((el) => el.textContent),
              };
              item = [...doc.querySelectorAll(".prompt .suggestion-item")].find(
                // Obsidian renders the command's namespace and label in separate
                // spans, without the colon/space in the registered command name.
                (el) =>
                  el.querySelector(".suggestion-content")?.textContent ===
                  selected.name.replace(": ", ""),
              );
              return item;
            }, "command-palette search result");
            return item;
          };
          await click(await search());
          await c.waitFor(
            () =>
              view.isFullscreen() !== wasFullscreen &&
              !doc.querySelector(".prompt input.prompt-input"),
            "palette command changes target view",
          );
          const state = view.isFullscreen();
          await search();
          await key("Escape", "Escape", 27);
          await c.waitFor(
            () => !doc.querySelector(".prompt input.prompt-input"),
            "palette cancellation",
          );
          check(
            view.isFullscreen() === state &&
              JSON.stringify(api.getSceneElements()) === before,
            "Cancelled palette command changed view or scene",
          );
          if (view.isFullscreen() !== wasFullscreen) {
            if (wasFullscreen) view.gotoFullscreen();
            else view.exitFullscreen();
          }
          const first = api.getSceneElements()[0],
            expectedX = first.x + 19;
          api.updateScene({
            elements: api.getSceneElements().map((el) =>
              el.id === first.id
                ? {
                    ...el,
                    x: expectedX,
                    version: el.version + 1,
                    versionNonce: el.versionNonce + 1,
                  }
                : el,
            ),
            captureUpdate: "IMMEDIATELY",
          });
          await c.waitFor(() => view.isDirty(), "palette-save dirty edit");
          await click(
            await search(
              app.commands.commands["obsidian-excalidraw-plugin:save"],
            ),
          );
          await c.waitFor(
            async () =>
              (await p.ea.getSceneFromFile(view.file)).elements.find(
                (el) => el.id === first.id,
              )?.x === expectedX && !view.isDirty(),
            "trusted palette save reaches the correct physical file",
          );
          check(
            events.some((e) => e.type === "keydown" && e.trusted),
            "Palette input was not trusted",
          );
        } else {
          if (checkColorShortcut) {
            // #3061: native keys must stay inside a color picker in its own document.
            const priorMode = api.getEditorInterface().desktopUIMode;
            const originalElements = api.getSceneElements();
            view.setUIMode("full");
            await c.waitFor(() => api.getEditorInterface().desktopUIMode === "full", "desktop color-picker mode");
            const probe = view.packages.excalidrawLib.convertToExcalidrawElements([
              { type: "text", text: "Color shortcut probe", x: 30, y: 30, fontFamily: 2, strokeColor: "#e03131" },
            ])[0];
            try {
              api.updateScene({elements: [probe], appState: {selectedElementIds: {[probe.id]: true}, viewModeEnabled: false, openPopup: null}, captureUpdate: "NEVER"});
              await c.waitFor(() => api.getAppState().selectedElementIds[probe.id], "selected color shortcut text");
              view.excalidrawContainer.focus();
              await key("s", "KeyS", 83);
              await c.waitFor(() => api.getAppState().openPopup === "elementStroke" && doc.querySelector(".color-picker-content"), "S opens stroke palette");
              const picker = doc.querySelector(".color-picker-content");
              const choice = picker.querySelector('.color-picker-content--default button[aria-label$="— s"]');
              check(choice, "S palette entry missing");
              const expected = choice.title.match(/#[0-9a-f]{6}/i)?.[0];
              check(expected && expected !== probe.strokeColor, "Color shortcut fixture is ambiguous");
              c.caseTrace = {colorShortcut: {context: row.context, expected, activeElement: doc.activeElement?.outerHTML?.slice(0, 800), pickerDocument: picker.ownerDocument === doc}};
              await key("s", "KeyS", 83);
              await c.waitFor(() => api.getSceneElements().find(el => el.id === probe.id)?.strokeColor === expected, "second S applies palette color to selected text");
              check(api.getAppState().activeTool.type === "selection", "Palette shortcut reached tool selection");
              await key("Escape", "Escape", 27);
              await c.waitFor(() => !doc.querySelector(".color-picker-content"), "palette Escape closes in owning window");
            } finally {
              api.updateScene({elements: originalElements, appState: {selectedElementIds: {}, openPopup: null}, captureUpdate: "NEVER"});
              view.setUIMode(priorMode);
            }
          }
          const panel = view.toolsPanelRef.current;
          const wasVisible = panel.state.visible;
          if (!wasVisible) panel.toggleVisibility(true);
          try {
            const wrapper = panel.containerRef.current;
            const handle = wrapper.querySelector(".excalidraw-toolsPanel-dragHandle");
            const body = wrapper.querySelector(".Island.App-menu__left.scrollbar");
            await c.waitFor(() => body.getBoundingClientRect().height > 0, "expanded Obsidian tools panel");
            const aligned = () => {
              const headerRect = handle.getBoundingClientRect();
              const bodyRect = body.getBoundingClientRect();
              const layout = {
                handle: {left: headerRect.left, right: headerRect.right},
                body: {left: bodyRect.left, right: bodyRect.right},
              };
              check(Math.abs(headerRect.left - bodyRect.left) < 0.5 &&
                Math.abs(headerRect.right - bodyRect.right) < 0.5,
                "Tools panel edges differ: " + JSON.stringify(layout));
              toolsPanelLayouts.push(layout);
            };
            aligned();
            await click(handle);
            await c.waitFor(() => body.getBoundingClientRect().height === 0, "tools panel collapse");
            await click(handle);
            await c.waitFor(() => body.getBoundingClientRect().height > 0, "tools panel expand");
            aligned();
          } finally {
            if (!wasVisible && panel.state.visible) panel.toggleVisibility(true);
          }
          api.updateScene({
            appState: { penMode: false, viewModeEnabled: false },
            captureUpdate: "NEVER",
          });
          let tool;
          await c.waitFor(() => {
            tool = [
              ...view.containerEl.querySelectorAll(
                '[data-testid="toolbar-rectangle"]',
              ),
            ].find(
              (el) =>
                el.getBoundingClientRect().width > 0 &&
                !el.closest(".tool-popover-content"),
            );
            return tool;
          }, "visible rectangle toolbar");
          await click(tool);
          await c.waitFor(
            () => api.getAppState().activeTool.type === "rectangle",
            "trusted rectangle tool",
          );
          const canvas = view.containerEl.querySelector("canvas.interactive"),
            r = canvas.getBoundingClientRect();
          let a, b;
          await c.waitFor(() => {
            for (const [x, y] of [
              [0.7, 0.55],
              [0.65, 0.7],
              [0.55, 0.5],
            ]) {
              const start = { x: r.x + r.width * x, y: r.y + r.height * y },
                end = { x: start.x + 45, y: start.y + 30 };
              if (
                doc.elementFromPoint(start.x, start.y) === canvas &&
                doc.elementFromPoint(end.x, end.y) === canvas
              ) {
                a = start;
                b = end;
                return true;
              }
            }
          }, "uncovered drawing area in this context");
          const before = api.getSceneElements().length;
          if (row.context === "phone" || row.context === "tablet") {
            await env.input("Input.dispatchTouchEvent", {
              type: "touchStart",
              touchPoints: [{ ...a, id: 1 }],
            });
            await env.input("Input.dispatchTouchEvent", {
              type: "touchMove",
              touchPoints: [{ ...b, id: 1 }],
            });
            await env.input("Input.dispatchTouchEvent", {
              type: "touchEnd",
              touchPoints: [],
            });
          } else {
            for (const [type, point, buttons] of [
              ["mousePressed", a, 1],
              ["mouseMoved", b, 1],
              ["mouseReleased", b, 0],
            ])
              await env.input("Input.dispatchMouseEvent", {
                type,
                ...point,
                button: "left",
                buttons,
                clickCount: 1,
              });
          }
          await c.waitFor(
            () => api.getSceneElements().length === before + 1,
            "trusted toolbar authoring",
          );
          view.containerEl.querySelector(".excalidraw").focus();
          await key("v", "KeyV", 86);
          await c.waitFor(
            () => api.getAppState().activeTool.type === "selection",
            "selection shortcut",
          );
          let menuPoint;
          const scene = api.getSceneElements(),
            state = api.getAppState();
          for (const [x, y] of [0.1, 0.3, 0.5, 0.7, 0.9].flatMap((x) =>
            [0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((y) => [x, y]),
          )) {
            // Native contextmenu events use integer coordinates; hit-test that same point.
            const point = {
              x: Math.round(r.x + r.width * x),
              y: Math.round(r.y + r.height * y),
            };
            const sx = (point.x - r.x) / state.zoom.value - state.scrollX,
              sy = (point.y - r.y) / state.zoom.value - state.scrollY;
            if (
              doc.elementFromPoint(point.x, point.y) === canvas &&
              !scene.some(
                (el) =>
                  sx >= el.x - 5 &&
                  sx <= el.x + el.width + 5 &&
                  sy >= el.y - 5 &&
                  sy <= el.y + el.height + 5,
              )
            ) {
              menuPoint = point;
              break;
            }
          }
          check(menuPoint, "No empty canvas point for the canvas context menu");
          // Send one native click sequence without a CLI round trip between
          // press/release, which can turn a click into a long right-button hold.
          const rightClick=await env.input("Input.dispatchMouseEvent",["mousePressed", "mouseReleased"].map(type=>({
              type,
              ...menuPoint,
              button: "right",
              buttons: type === "mousePressed" ? 2 : 0,
              clickCount: 1,
            })));
          let selectAll;
          await c.waitFor(() => {
            c.caseTrace = {
              menuPoint,
              rightClick,
              contextMenu: api.getAppState().contextMenu,
              menuHTML: doc
                .querySelector(".context-menu")
                ?.outerHTML.slice(0, 3000),
              events,
            };
            selectAll = doc.querySelector(
              '.context-menu [data-testid="selectAll"] button',
            );
            return selectAll;
          }, "trusted context-menu selection action");
          await click(selectAll);
          await c.waitFor(
            () =>
              api
                .getSceneElements()
                .every((el) => api.getAppState().selectedElementIds[el.id]),
            "context select-all scene state",
          );
          const ids = api.getSceneElements().map((e) => e.id);
          await key("Delete", "Delete", 46);
          await c.waitFor(
            () => api.getSceneElements().length === 0,
            "delete shortcut",
          );
          await key("z", "KeyZ", 90, modifier);
          await c.waitFor(
            () =>
              JSON.stringify(api.getSceneElements().map((e) => e.id)) ===
              JSON.stringify(ids),
            "trusted undo restores exact scene IDs",
          );
          await key("Escape", "Escape", 27);
          check(
            events.some((e) => e.type === "pointerdown" && e.trusted),
            "Authoring pointer was not trusted",
          );
          view = await env.saveReopen(view);
        }
        return {
          assertions: row.assertions.filter(assertion => checkColorShortcut ||
            !assertion.startsWith("desktop color-picker shortcuts")),
          actual: env.geometry(),
          input:
            "trusted CDP mouse/touch/keyboard; context menu uses mouse compatibility input in mobile emulation",
          events,
          toolsPanelLayouts,
        };
      } finally {
        for (const type of ["keydown", "pointerdown", "contextmenu"])
          doc.removeEventListener(type, listener, true);
        if (doc.querySelector(".prompt input.prompt-input, .context-menu"))
          await key("Escape", "Escape", 27);
      }
    });
}
