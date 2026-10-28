/** Portable synthetic PDF reference through the real EA/Obsidian PDF.js loader. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../contracts.mjs";
import { runInAppTask } from "./inAppTask.mjs";
export async function runPDFImportScenario({ cli, drawingPath }) {
  assert.ok(drawingPath.startsWith("__excalidraw_cli_smoke_"));
  const pdf = readFileSync(
    new URL("../../../tests/vault/Assets/Small.pdf", import.meta.url),
  );
  const result = await runInAppTask({
    cli,
    execute: exercisePDF,
    args: [drawingPath, pdf.toString("base64")],
    timeoutMs: 120000,
  });
  return {
    id: "portable-pdf-import",
    status: "passed",
    fixtureHash: sha256(pdf),
    ...result,
  };
}
async function exercisePDF(c, drawingPath, pdf) {
  const p = app.plugins.plugins["obsidian-excalidraw-plugin"],
    view = app.workspace
      .getLeavesOfType("excalidraw")
      .find((l) => l.view.file?.path === drawingPath)?.view;
  const check = (value, label) => {
    if (!value) throw Error(label);
  };
  check(view?.excalidrawAPI, "Owned PDF target missing");
  const api = view.excalidrawAPI,
    original = api.getSceneElements(),
    path =
      drawingPath.replace(/\.(excalidraw\.md|excalidraw|md)$/, "") +
      "_source.pdf",
    ea = p.ea.getAPI(view);
  c.defer(async () => {
    api.updateScene({
      elements: original,
      captureUpdate: "IMMEDIATELY",
      forceFlushSync: true,
    });
    check(
      (await view.saveWithOutcome()).status === "persisted",
      "PDF cleanup scene did not save",
    );
    ea.destroy();
    const file = app.vault.getFileByPath(path);
    if (file) {
      check(
        file.path === path && path.startsWith("__excalidraw_cli_smoke_"),
        "Unowned PDF cleanup",
      );
      await app.vault.delete(file);
    }
  });
  const bytes = Uint8Array.from(atob(pdf), (char) => char.charCodeAt(0));
  const file = await app.vault.createBinary(path, bytes.buffer);
  await c.case(
    "native:pdf-reference-and-decoded-content",
    ["P05", "P09", "P10"],
    async () => {
      const id = await ea.addImage(0, 0, path + "#page=1", false, false),
        element = ea.getElement(id);
      check(
        element?.type === "image" && element.width > 0 && element.height > 0,
        "PDF page image not created",
      );
      const payload = ea.imagesDict[element.fileId];
      check(
        payload?.dataURL.startsWith("data:image/png;base64,"),
        "PDF page did not render to PNG",
      );
      check(
        payload.hyperlink === path + "#page=1" && payload.pdfPageViewProps,
        "PDF page/source metadata missing",
      );
      const decoded = new Image();
      decoded.src = payload.dataURL;
      await decoded.decode();
      const canvas = createFragment().createEl("canvas");
      canvas.width = 100;
      canvas.height = 80;
      const context = canvas.getContext("2d");
      context.drawImage(decoded, 0, 0, 100, 80);
      const pixels = context.getImageData(0, 0, 100, 80).data;
      let blue = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (
          pixels[i + 2] > 160 &&
          pixels[i] < 80 &&
          pixels[i + 1] < 80 &&
          pixels[i + 3] > 0
        )
          blue++;
      check(blue > 500, "Imported PDF lost its blue rectangle");
      check(
        await ea.addElementsToView(false, true, true),
        "PDF page publication failed",
      );
      check(
        (await view.saveWithOutcome()).status === "persisted",
        "PDF page did not physically save",
      );
      const scene = await p.ea.getSceneFromFile(view.file),
        disk = await app.vault.read(view.file);
      check(
        scene.elements.some(
          (el) => el.id === id && el.fileId === element.fileId,
        ) && disk.includes(path + "#page=1"),
        "Saved PDF source reference missing",
      );
      check(
        (await app.vault.readBinary(file)).byteLength === bytes.byteLength,
        "Import changed source PDF bytes",
      );
      return {
        assertions: [
          "real PDF.js page render through public EA API",
          "decoded blue PDF pixels",
          "page/source metadata retained",
          "physical drawing preserves PDF reference",
          "source PDF bytes unchanged",
        ],
        width: decoded.naturalWidth,
        height: decoded.naturalHeight,
        bluePixels: blue,
      };
    },
  );
  return { tests: c.tests };
}
