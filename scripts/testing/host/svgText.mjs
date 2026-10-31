/** Native editable SVG/HTML labels. Optional user fixture is read-only and never committed. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DOMParser } from "@xmldom/xmldom";
import { runInAppTask } from "./inAppTask.mjs";

export async function runSvgTextScenario({ cli, drawingPath, reportDir }) {
  const fixture = process.env.EXCALIDRAW_SVG_TEXT_FIXTURE;
  const source = fixture
    ? readFileSync(fixture, "utf8")
    : '<svg xmlns="http://www.w3.org/2000/svg" xmlns:h="http://www.w3.org/1999/xhtml" width="240" height="100"><g transform="translate(20 20)"><rect width="140" height="50" fill="#e9d5ff"/><foreignObject x="10" y="10" width="120" height="30"><h:div style="line-height:1.5;text-align:center"><h:p>Editable label</h:p></h:div></foreignObject></g><text x="180" y="90" text-anchor="middle">SVG text</text></svg>';
  const sourceHash = createHash("sha256").update(source).digest("hex");
  assert.ok(
    source.length <= 2000000 && !/<!DOCTYPE|<!ENTITY/i.test(source),
    "Unsafe/excessive SVG text fixture",
  );
  const document = new DOMParser().parseFromString(source, "image/svg+xml");
  const expected = ["text", "foreignObject"].flatMap((tag) =>
    Array.from(document.getElementsByTagName(tag), (el) =>
      el.textContent.trim(),
    ).filter(Boolean),
  );
  assert.ok(expected.length, "Text fixture has no labels");
  let result;
  try {
    result = await runInAppTask({
      cli,
      execute: probeText,
      args: [drawingPath, source, expected],
    });
  } catch (error) {
    writeFileSync(
      join(reportDir, "svg-text-failure.json"),
      JSON.stringify(
        {
          error: error.message,
          tests: error.evidence,
          observations: error.observations,
          cleanupVerified: error.cleanupVerified,
        },
        null,
        2,
      ),
    );
    throw error;
  }
  if (fixture)
    assert.equal(
      createHash("sha256").update(readFileSync(fixture, "utf8")).digest("hex"),
      sourceHash,
      "Original SVG changed",
    );
  const { png, ...evidence } = result;
  assert.match(png, /^data:image\/png;base64,/);
  writeFileSync(
    join(reportDir, "svg-editable-text.png"),
    Buffer.from(png.split(",")[1], "base64"),
  );
  return {
    id: "svg-editable-text",
    status: "passed",
    sourceHash,
    originalUnchanged: true,
    expectedLabels: expected.length,
    ...evidence,
  };
}

async function probeText(c, path, source, expected) {
  const plugin = app.plugins.plugins["obsidian-excalidraw-plugin"];
  let view = app.workspace
    .getLeavesOfType("excalidraw")
    .find((l) => l.view.file?.path === path)?.view;
  if (!view?.excalidrawAPI) throw Error("Exact text target unavailable");
  const check = (value, message) => {
    if (!value) throw Error(message);
  };
  const ea = plugin.ea.getAPI();
  c.observations = {};
  const snapshot = (element) =>
    element &&
    Object.fromEntries(
      [
        "id",
        "text",
        "rawText",
        "originalText",
        "version",
        "width",
        "height",
      ].map((key) => [key, element[key]]),
    );
  ea.setView(view);
  c.defer(() => ea.destroy());
  let ids, editedId, editedValue, png;
  await c.case(
    "native:svg-text:labels-render-edit-save-reopen",
    ["P03", "P09"],
    async () => {
      check(ea.importSVG(source), "SVG text import failed");
      const elements = ea.getElements(),
        labels = elements.filter((e) => e.type === "text");
      check(
        labels.length === expected.length &&
          expected.every((value) => labels.some((e) => e.text === value)),
        "SVG/HTML labels were dropped or changed",
      );
      check(
        labels.every(
          (e) =>
            e.rawText === e.text &&
            e.originalText === e.text &&
            e.fontSize > 0 &&
            e.width > 0 &&
            e.height > 0,
        ),
        "Text is not editable native content",
      );
      ids = labels.map((e) => e.id);
      const textCanvas = await view.packages.excalidrawLib.exportToCanvas({
        elements: labels,
        files: {},
        appState: {
          ...view.excalidrawAPI.getAppState(),
          exportBackground: false,
          exportWithDarkMode: false,
        },
      });
      const pixels = textCanvas
        .getContext("2d")
        .getImageData(0, 0, textCanvas.width, textCanvas.height).data;
      let glyphPixels = 0;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) glyphPixels++;
      check(glyphPixels > 20, "Decoded text-only export has no visible glyphs");
      const canvas = await view.packages.excalidrawLib.exportToCanvas({
        elements,
        files: {},
        appState: {
          ...view.excalidrawAPI.getAppState(),
          exportBackground: true,
          exportWithDarkMode: false,
          exportScale: 2,
          viewBackgroundColor: "#f1f1f1",
        },
      });
      png = canvas.toDataURL();
      check(
        canvas.width > 100 && canvas.height > 50,
        "Native text preview did not render",
      );
      check(
        await ea.addElementsToView(false, true, true),
        "Text insertion failed",
      );
      const first = labels[0];
      editedId = first.id;
      editedValue = first.text + " (edited)";
      ea.clear();
      ea.copyViewElementsToEAforEditing([
        view.excalidrawAPI.getSceneElements().find((e) => e.id === editedId),
      ]);
      const edited = ea.getElement(editedId);
      edited.text = edited.rawText = edited.originalText = editedValue;
      ea.refreshTextElementSize(editedId);
      check(
        await ea.addElementsToView(false, true, true),
        "Native text edit failed",
      );
      c.observations.liveEdited = snapshot(
        view.excalidrawAPI.getSceneElements().find((e) => e.id === editedId),
      );
      check(
        c.observations.liveEdited?.rawText === editedValue,
        "Edited raw text did not reach scene",
      );
      const saved = await view.saveWithOutcome();
      check(
        saved.acknowledgedRevision !== null &&
          saved.acknowledgedRevision >= saved.requestedRevision,
        "Text save unacknowledged",
      );
      await view.leaf.setViewState({ type: "empty", state: {} });
      check(
        (await plugin.executeCLI({ apiVersion: 1, command: "open", path })).ok,
        "Text drawing reopen failed",
      );
      await c.waitFor(() => {
        c.observations.reopened = app.workspace
          .getLeavesOfType("excalidraw")
          .find((l) => l.view.file?.path === path)
          ?.view.excalidrawAPI?.getSceneElements()
          .filter((e) => e.type === "text")
          .map(snapshot);
        return app.workspace
          .getLeavesOfType("excalidraw")
          .some(
            (l) =>
              l.view.file?.path === path &&
              l.view.excalidrawAPI
                ?.getSceneElements()
                .some((e) => e.id === editedId && e.text === editedValue),
          );
      }, "edited text reopen");
      view = app.workspace
        .getLeavesOfType("excalidraw")
        .find((l) => l.view.file?.path === path).view;
      const reopened = view.excalidrawAPI.getSceneElements();
      check(
        ids.every((id) =>
          reopened.some(
            (e) =>
              e.id === id &&
              e.type === "text" &&
              e.text ===
                (id === editedId
                  ? editedValue
                  : labels.find((l) => l.id === id).text),
          ),
        ),
        "Saved labels changed",
      );
      return {
        assertions: [
          "all source labels become native text",
          "raw/editable text and positive measured geometry",
          "real native preview export",
          "decoded text-only export contains visible glyphs",
          "native text edit",
          "acknowledged save and exact IDs/text after reopen",
        ],
        labels: labels.length,
        nativeElements: elements.length,
        glyphPixels,
      };
    },
  );
  await c.case("native:svg-text:popout-reopen", ["P03", "P09"], async () => {
    const leaf = app.workspace.openPopoutLeaf();
    c.defer(async () => {
      await leaf.setViewState({ type: "empty", state: {} });
      leaf.detach();
    });
    await leaf.setViewState({
      type: "excalidraw",
      state: { file: path },
      active: true,
    });
    await c.waitFor(
      () =>
        leaf.view.isLoaded &&
        leaf.view.excalidrawAPI
          ?.getSceneElements()
          .some((e) => e.id === editedId && e.text === editedValue),
      "popout text",
    );
    const elements = leaf.view.excalidrawAPI.getSceneElements();
    check(
      ids.every((id) => elements.some((e) => e.id === id && e.type === "text")),
      "Popout lost native labels",
    );
    const canvas = await leaf.view.packages.excalidrawLib.exportToCanvas({
      elements,
      files: {},
      appState: {
        ...leaf.view.excalidrawAPI.getAppState(),
        exportBackground: true,
        exportWithDarkMode: false,
      },
    });
    check(
      canvas.width > 100 && canvas.height > 50,
      "Popout text export failed",
    );
    return {
      assertions: [
        "saved editable labels load in popout",
        "edited value preserved",
        "owning-window preview export",
      ],
    };
  });
  return { tests: c.tests, png };
}
