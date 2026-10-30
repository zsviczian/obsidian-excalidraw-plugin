/** Real plugin gateway, real Extras renderers and native Electron PDF output. */
import assert from "node:assert/strict";
import { runInAppTask } from "./inAppTask.mjs";
import { copyFileSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileHash, ownedPath } from "../contracts.mjs";

export async function runExtrasServicesScenario({
  cli,
  drawingPath,
  reportDir,
}) {
  assert.ok(drawingPath.startsWith("__excalidraw_cli_smoke_"));
  const prefix =
    drawingPath.replace(/\.(excalidraw\.md|excalidraw|md)$/, "") + "_extras";
  const fixtures = JSON.parse(
    readFileSync(
      new URL("../../../tests/fixtures/mermaid-diagrams.json", import.meta.url),
      "utf8",
    ),
  );
  let offlineOwned = false;
  const network = (offline) => {
    cli("dev:cdp", "method=Network.enable", "params={}");
    cli(
      "dev:cdp",
      "method=Network.emulateNetworkConditions",
      "params=" +
        JSON.stringify({
          offline,
          latency: 0,
          downloadThroughput: offline ? 0 : -1,
          uploadThroughput: offline ? 0 : -1,
        }),
    );
    offlineOwned = offline;
    return { offline };
  };
  let result;
  try {
    result = await runInAppTask({
      cli,
      execute: exerciseExtras,
      args: [prefix, fixtures, drawingPath],
      timeoutMs: 180_000,
      cleanupMs: 135_000,
      onProgress: (phase) =>
        writeFileSync(
          join(reportDir, "native-single-export-progress.json"),
          JSON.stringify({ phase, at: new Date().toISOString() }) + "\n",
        ),
      onRequest: (request) => {
        if (request.method === "mermaid-network") {
          assert.equal(typeof request.params.offline, "boolean");
          return network(request.params.offline);
        }
        assert.equal(request.method, "pdf-evidence");
        assert.equal(request.params.path, prefix + "/Output.pdf");
        const vault = cli("vault", "info=path").trim(),
          source = ownedPath(vault, request.params.path);
        mkdirSync(reportDir, { recursive: true });
        const pdf = join(reportDir, "native-single-export.pdf"),
          png = join(reportDir, "native-single-export-page.png");
        copyFileSync(source, pdf);
        writeFileSync(png, Buffer.from(request.params.pngBase64, "base64"));
        return { pdf, png, sha256: fileHash(pdf), pageSha256: fileHash(png) };
      },
    });
  } finally {
    if (offlineOwned) network(false);
  }
  return { id: "extras-services", status: "passed", ...result };
}

async function exerciseExtras(c, prefix, fixtures, drawingPath) {
  c.phase = "extras-services";
  const plugin = app.plugins.plugins["obsidian-excalidraw-plugin"],
    extras = app.plugins.plugins["excalidraw-extras"];
  const check = (value, label) => {
    if (!value) throw Error(label);
  };
  check(
    extras?.api,
    "Build and enable the paired Extras plugin in the owned vault first",
  );
  for (const component of ["mathjax", "mermaid", "pdf"])
    check(
      extras.api.features.isActive(component),
      `Enable Extras ${component} in the test vault first`,
    );
  c.defer(async () => {
    const folder = app.vault.getFolderByPath(prefix);
    if (folder) {
      check(
        folder.path === prefix && prefix.startsWith("__excalidraw_cli_smoke_"),
        "unowned cleanup",
      );
      await app.vault.delete(folder, true);
    }
  });
  await app.vault.createFolder(prefix);
  await c.case(
    "native:extras-mathjax-gateway",
    ["P05", "P09", "P11"],
    async () => {
      const mathjax = await plugin.extrasGateway.getMathJax();
      check(mathjax, "plugin gateway did not obtain MathJax");
      const result = await mathjax.tex2dataURL("\\frac{a^2+b^2}{c}", 1, null, {
        throwOnError: true,
      });
      check(
        result?.dataURL.startsWith("data:image/svg+xml;base64,"),
        "MathJax SVG missing",
      );
      const image = new Image();
      image.src = result.dataURL;
      await image.decode();
      check(
        image.naturalWidth > 0 &&
          image.naturalHeight > 0 &&
          result.size.width > 0,
        "MathJax image did not decode",
      );
      return {
        assertions: [
          "real plugin gateway resolves Extras",
          "actual MathJax SVG decodes with positive geometry",
        ],
        width: image.naturalWidth,
        height: image.naturalHeight,
      };
    },
  );
  await c.case("native:extras-mermaid-gateway", ["P09", "P11"], async () => {
    await c.requestHost("mermaid-network", { offline: true });
    try {
      check(!navigator.onLine, "Mermaid offline control was not applied");
      const service = await plugin.extrasGateway.getMermaid();
      check(service, "plugin gateway did not obtain Mermaid");
      const module = await service.getModule();
      const converted = await module.parseMermaidToExcalidraw(
        "flowchart LR\n A[Start] --> B[End]",
      );
      check(
        converted.elements.some((e) => e.type === "arrow") &&
          converted.elements.some(
            (e) => e.label?.text === "Start" || e.text === "Start",
          ),
        "Mermaid source is not editable",
      );
      const diagrams = [];
      for (const fixture of fixtures) {
        const result = await module.parseMermaidToExcalidraw(
          fixture.definition,
        );
        const view = app.workspace
          .getLeavesOfType("excalidraw")
          .find((leaf) => leaf.view.file?.path === drawingPath)?.view;
        check(view?.excalidrawAPI, "Mermaid owning test drawing unavailable");
        const elements =
          view.packages.excalidrawLib.convertToExcalidrawElements(
            result.elements,
          );
        check(
          elements.length > 0 &&
            elements.every((e) =>
              [e.x, e.y, e.width, e.height].every(Number.isFinite),
            ),
          fixture.id + " invalid normalized geometry",
        );
        check(
          fixture.editable
            ? elements.every((e) => e.type !== "image")
            : elements.some((e) => e.type === "image"),
          fixture.id + " representation changed",
        );
        if (fixture.editable) {
          const text = elements
            .filter((e) => e.type === "text")
            .map((e) => e.text)
            .join("\n");
          for (const label of fixture.labels)
            check(text.includes(label), fixture.id + " lost label " + label);
        } else {
          const image = elements.find((e) => e.type === "image"),
            file = result.files[image.fileId];
          check(file?.dataURL, fixture.id + " missing SVG");
          const decoded = new Image();
          decoded.src = file.dataURL;
          await decoded.decode();
          check(
            decoded.naturalWidth > 0 && decoded.naturalHeight > 0,
            fixture.id + " image failed to decode",
          );
        }
        diagrams.push({
          id: fixture.id,
          elements: elements.length,
          types: [...new Set(elements.map((e) => e.type))],
        });
      }
      let rejected = false;
      try {
        await module.parseMermaidToExcalidraw("flowchart TD\n A[");
      } catch {
        rejected = true;
      }
      check(rejected, "invalid Mermaid source was accepted");
      const recovered = await module.parseMermaidToExcalidraw(
        "sequenceDiagram\n Alice->>Bob: Recovered",
      );
      check(
        recovered.elements.length > 0,
        "Mermaid did not recover after invalid source",
      );
      return {
        assertions: [
          "real plugin gateway resolves Mermaid",
          "actual converter returns editable labels and arrow",
          "twelve diagram types load offline with finite normalized geometry and preserved representation",
          "editable labels and decoded image dimensions survive lazy loading",
          "syntax rejects and next diagram recovers",
        ],
        elements: converted.elements.length,
        diagrams,
      };
    } finally {
      await c.requestHost("mermaid-network", { offline: false });
    }
  });
  await c.case("native:extras-pdf-output", ["P05", "P09"], async () => {
    const service = await plugin.extrasGateway.getExportToPDF();
    check(service, "plugin gateway did not obtain PDF service");
    const doc = app.workspace.containerEl.ownerDocument,
      content = doc.body.createDiv();
    c.defer(() => content.remove());
    const page = content.createDiv({ cls: "print-page" });
    page.createEl("p", { text: "EXCALIDRAW_OWNED_PDF" });
    page
      .createSvg("svg", {
        attr: {
          xmlns: "http://www.w3.org/2000/svg",
          width: "120",
          height: "80",
          viewBox: "0 0 120 80",
        },
      })
      .createSvg("rect", {
        attr: { x: "10", y: "10", width: "100", height: "60", fill: "#ff0000" },
      });
    const beforeStyles = [...doc.adoptedStyleSheets],
      beforePrints = doc.querySelectorAll("body > .print").length;
    const path = prefix + "/Output.pdf",
      absolutePath = app.vault.adapter.getFullPath(path);
    c.phase = "pdf-native-print";
    await service.exportToPDF(
      content,
      absolutePath,
      "#ffffff",
      { width: 384, height: 288 },
      false,
      { top: 0, right: 0, bottom: 0, left: 0 },
      false,
      "@page { size: 4in 3in; margin: 0; }",
    );
    check(
      doc.querySelectorAll("body > .print").length === beforePrints &&
        doc.adoptedStyleSheets.length === beforeStyles.length &&
        beforeStyles.every((sheet, i) => doc.adoptedStyleSheets[i] === sheet),
      "PDF temporary DOM or stylesheet leaked",
    );
    c.phase = "pdf-read-completed-output";
    await c.waitFor(
      () => app.vault.getFileByPath(path),
      "native PDF file event",
    );
    const file = app.vault.getFileByPath(path),
      bytes = new Uint8Array(await app.vault.readBinary(file));
    const byteLength = bytes.length; // PDF.js transfers and detaches its input buffer.
    check(
      new TextDecoder().decode(bytes.slice(0, 8)).startsWith("%PDF-"),
      "native output is not a PDF",
    );
    if (!window.pdfjsLib) await plugin.ea.obsidian.loadPdfJs();
    const loading = window.pdfjsLib.getDocument({ data: bytes });
    const pdf = await loading.promise;
    c.defer(() => pdf.destroy());
    check(pdf.numPages === 1, `unexpected PDF page count: ${pdf.numPages}`);
    c.phase = "pdf-page";
    const first = await pdf.getPage(1),
      viewport = first.getViewport({ scale: 1 });
    check(
      Math.abs(viewport.width - 288) < 1 && Math.abs(viewport.height - 216) < 1,
      "PDF media box differs from 4in × 3in",
    );
    c.phase = "pdf-text";
    const text = (await first.getTextContent()).items
      .map((item) => item.str || "")
      .join(" ");
    check(text.includes("EXCALIDRAW_OWNED_PDF"), "PDF lost printable text");
    const canvas = createFragment().createEl("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    c.phase = "pdf-decode-pixels";
    // Batch verification must not depend on display animation frames: Electron
    // can occlude the vault while its CLI remains available. PDF.js print intent
    // renders the same page without requestAnimationFrame scheduling.
    await first.render({ canvasContext: context, viewport, intent: "print" })
      .promise;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let red = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (pixels[i] > 180 && pixels[i + 1] < 80 && pixels[i + 2] < 80) red++;
    check(red > 100, "PDF lost SVG content");
    c.phase = "pdf-retain-evidence";
    const evidence = await c.requestHost("pdf-evidence", {
      path,
      pngBase64: canvas.toDataURL("image/png").split(",")[1],
    });
    return {
      assertions: [
        "actual Electron PDF completion",
        "print DOM and styles restored",
        "valid PDF header and one page",
        "expected media box",
        "text extraction preserves content",
        "rendered PDF contains red SVG pixels",
      ],
      bytes: byteLength,
      pages: pdf.numPages,
      width: viewport.width,
      height: viewport.height,
      redPixels: red,
      evidence,
    };
  });
  return { tests: c.tests };
}
