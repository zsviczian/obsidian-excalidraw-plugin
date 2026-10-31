/** Focused real-EA paint fallback and real-Extras Mermaid SVG geometry checks. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { runInAppTask } from "./inAppTask.mjs";

export async function runSvgPaintScenario({ cli, drawingPath, reportDir }) {
  const result = await runInAppTask({
    cli,
    execute: probePaint,
    args: [drawingPath],
  });
  const { png, ...evidence } = result;
  assert.match(png, /^data:image\/png;base64,/);
  writeFileSync(
    join(reportDir, "svg-paint-fallback.png"),
    Buffer.from(png.split(",")[1], "base64"),
  );
  return { id: "svg-paint-fallback", status: "passed", ...evidence };
}

async function probePaint(c, path) {
  const plugin = app.plugins.plugins["obsidian-excalidraw-plugin"];
  const view = app.workspace
    .getLeavesOfType("excalidraw")
    .find((l) => l.view.file?.path === path)?.view;
  if (!view?.excalidrawAPI) throw Error("Missing exact SVG paint target");
  const requireValue = (value, message) => {
    if (!value) throw Error(message);
  };
  const api = view.excalidrawAPI;
  const ea = plugin.ea.getAPI();
  ea.setView(view);
  c.defer(() => ea.destroy());
  const ids = [];
  let png;
  await c.case(
    "native:svg-paint:render-save-reopen",
    ["P03", "P09"],
    async () => {
      const source =
        '<svg xmlns="http://www.w3.org/2000/svg" color="#2468ac"><rect width="20" height="20" fill="color(display-p3 1 0 0)"/><rect x="25" width="20" height="20" fill="red"/></svg>';
      requireValue(ea.importSVG(source), "Unsupported paint aborted EA import");
      const elements = ea.getElements();
      requireValue(
        elements.length === 2 &&
          elements[0].backgroundColor === "#2468ac" &&
          elements[1].backgroundColor === "#ff0000",
        "Native fallback colors differ",
      );
      ids.push(...elements.map((e) => e.id));
      const canvas = await view.packages.excalidrawLib.exportToCanvas({
        elements,
        files: {},
        appState: {
          ...api.getAppState(),
          exportBackground: false,
          exportWithDarkMode: false,
          exportScale: 2,
        },
      });
      const pixels = canvas
        .getContext("2d")
        .getImageData(0, 0, canvas.width, canvas.height).data;
      let blue = 0,
        red = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (
          pixels[i] === 36 &&
          pixels[i + 1] === 104 &&
          pixels[i + 2] === 172 &&
          pixels[i + 3] === 255
        )
          blue++;
        if (
          pixels[i] === 255 &&
          pixels[i + 1] === 0 &&
          pixels[i + 2] === 0 &&
          pixels[i + 3] === 255
        )
          red++;
      }
      requireValue(
        blue > 50 && red > 50,
        "Decoded export lost fallback or ordinary paint",
      );
      png = canvas.toDataURL();
      requireValue(
        await ea.addElementsToView(false, true, true),
        "EA insertion refused",
      );
      const saved = await view.saveWithOutcome();
      requireValue(
        saved.acknowledgedRevision !== null &&
          saved.acknowledgedRevision >= saved.requestedRevision,
        "SVG paint save not acknowledged",
      );
      await view.leaf.setViewState({ type: "empty", state: {} });
      const opened = await plugin.executeCLI({
        apiVersion: 1,
        command: "open",
        path,
      });
      requireValue(opened.ok, "Could not reopen persisted SVG paint drawing");
      await c.waitFor(
        () =>
          app.workspace
            .getLeavesOfType("excalidraw")
            .some(
              (l) =>
                l.view.file?.path === path &&
                l.view.excalidrawAPI
                  ?.getSceneElements()
                  .some((e) => e.id === ids[1]),
            ),
        "reopened fallback scene",
      );
      const reopened = app.workspace
        .getLeavesOfType("excalidraw")
        .find((l) => l.view.file?.path === path)
        .view.excalidrawAPI.getSceneElements();
      requireValue(
        reopened.find((e) => e.id === ids[0])?.backgroundColor === "#2468ac" &&
          reopened.find((e) => e.id === ids[1])?.backgroundColor === "#ff0000",
        "Saved/reopened colors differ",
      );
      return {
        assertions: [
          "EA import succeeds",
          "all geometry retained",
          "decoded export has fallback and normal colors",
          "save acknowledged",
          "exact IDs/colors survive reopen",
        ],
        bluePixels: blue,
        redPixels: red,
      };
    },
  );
  const service = await plugin.getMermaid();
  requireValue(service.loaded, "Workspace Extras Mermaid unavailable");
  const converter = await service.api;
  for (const [name, definition] of Object.entries({
    pie: 'pie title Geometry\n "One" : 60\n "Two" : 40',
    mindmap: "mindmap\n root((Example))\n  Branch",
    gantt:
      "gantt\n title Example\n dateFormat YYYY-MM-DD\n section Work\n Task :a1, 2026-01-01, 3d",
    journey: "journey\n title Example\n section Work\n Task: 5: Alice",
    timeline: "timeline\n title Example\n 2026 : Start",
    git: "gitGraph\n commit",
    quadrant: "quadrantChart\n title Example\n A: [0.3, 0.6]",
  })) {
    await c.case(
      "native:svg-paint:mermaid-" + name,
      ["P03", "P09"],
      async () => {
        const converted = await converter.parseMermaidToExcalidraw(definition);
        const image = converted.elements.find((e) => e.type === "image");
        const dataURL = converted.files?.[image?.fileId]?.dataURL;
        requireValue(
          dataURL?.startsWith("data:image/svg+xml;base64,"),
          name + " did not return an SVG image",
        );
        const svg = new TextDecoder().decode(
          Uint8Array.from(atob(dataURL.split(",")[1]), (ch) =>
            ch.charCodeAt(0),
          ),
        );
        const bench = plugin.ea.getAPI();
        try {
          requireValue(bench.importSVG(svg), name + " SVG import failed");
          const native = bench.getElements();
          requireValue(
            native.length > 0 &&
              native.every((e) => e.type !== "image" && e.type !== "text"),
            name + " did not produce native geometry",
          );
          return {
            assertions: [
              "real Extras returns SVG-backed image",
              "actual SVG imports through EA",
              "nonempty native geometry without an image fallback",
            ],
            nativeElements: native.length,
            limitations: [
              "SVG labels/effects are not preserved as editable text or semantic bindings",
            ],
          };
        } finally {
          bench.destroy();
        }
      },
    );
  }
  return { tests: c.tests, png };
}
