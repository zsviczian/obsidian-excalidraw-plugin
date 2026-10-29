/** Trusted CDP input reaches command palette, toolbar, context menu and real shortcuts. */
export async function exerciseInteractionBehavior(c, env, rows, modifier) {
  const { p, check, doc, key, click } = env;
  for (const row of rows)
    await c.case(row.testId, row.featureIds, async () => {
      Object.assign(p.settings, {
        defaultMode: "normal",
        disableContextMenu: false,
        penModeSingleFingerPanning: false,
      });
      let view = await env.openDrawing(row.id),
        api = view.excalidrawAPI;
      const events = [],
        listener = (e) =>
          events.push({
            type: e.type,
            trusted: e.isTrusted,
            pointerType: e.pointerType,
          });
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
            const input = doc.querySelector(".prompt input.prompt-input");
            await click(input);
            await c.waitFor(
              () => doc.activeElement === input,
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
          if (view.isFullscreen() !== wasFullscreen) view.exitFullscreen();
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
            const point = { x: r.x + r.width * x, y: r.y + r.height * y };
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
          for (const type of ["mousePressed", "mouseReleased"])
            await env.input("Input.dispatchMouseEvent", {
              type,
              ...menuPoint,
              button: "right",
              buttons: type === "mousePressed" ? 2 : 0,
              clickCount: 1,
            });
          let selectAll;
          await c.waitFor(() => {
            c.caseTrace = {
              menuPoint,
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
          assertions: row.assertions,
          actual: env.geometry(),
          input:
            "trusted CDP mouse/touch/keyboard; context menu uses mouse compatibility input in mobile emulation",
          events,
        };
      } finally {
        for (const type of ["keydown", "pointerdown", "contextmenu"])
          doc.removeEventListener(type, listener, true);
        if (doc.querySelector(".prompt input.prompt-input, .context-menu"))
          await key("Escape", "Escape", 27);
      }
    });
}
