/** Real menus, Mermaid choice and SVG replacement, using the existing owned-vault/input environment. */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { runInAppTask } from "./inAppTask.mjs";
import { behaviorEnvironment } from "./behaviorEnvironment.mjs";
import { behaviorInputDriver } from "./behaviorMatrix.mjs";
import { completeConsoleErrors } from "./debuggerSession.mjs";
import {
  settleBrowserDiagnostics,
  splitWindowErrors,
} from "./browserDiagnostics.mjs";

export async function runSVGEntryPointsScenario({
  cli,
  drawingPath,
  reportDir,
}) {
  let template = readFileSync(
    new URL(
      "../../../tests/vault/Drawings/Uncompressed.excalidraw.md",
      import.meta.url,
    ),
    "utf8",
  );
  template = template.replace(/```json\s*([\s\S]*?)```/, (_block, json) => {
    const scene = JSON.parse(json);
    scene.elements = [];
    scene.files = {};
    return "```json\n" + JSON.stringify(scene) + "\n```";
  });
  const tests = [],
    consoleErrors = [],
    windowErrors = [],
    browserIdle = [];
  const systemInputs = resolve(".test-work/inputs/svg-entry-" + randomUUID());
  assert.equal(resolve(systemInputs, ".."), resolve(".test-work/inputs"));
  let safeToRemoveInputs = true;
  mkdirSync(systemInputs, { recursive: true });
  const systemFiles = {
    unicode: join(systemInputs, "Unicode.svg"),
    mindmap: join(systemInputs, "Mindmap.svg"),
  };
  writeFileSync(
    systemFiles.unicode,
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect x="5" y="5" width="190" height="90" fill="#9bd4fc"/><text x="20" y="60">SVG entrée 東京</text></svg>',
  );
  writeFileSync(
    systemFiles.mindmap,
    readFileSync(
      new URL(
        "../../../tests/fixtures/mermaid-mindmap-css-variables.svg",
        import.meta.url,
      ),
    ),
  );
  try {
    for (const id of ["main", "popout"]) {
      const execute =
        new Function(`return async function(c,path,template,context,modifier,systemFiles){
      const env=await (${behaviorEnvironment.toString()})(c,path,context,template,${completeConsoleErrors.toString()},${settleBrowserDiagnostics.toString()});
      c.diagnostics=env.diagnostics;
      try { await (${exerciseSVGEntryPoints.toString()})(c,env,context.id,modifier,systemFiles); }
      catch(error) { c.observations=env.diagnostics(); throw error; }
      return {tests:c.tests,consoleErrors:c.externalConsoleErrors||[],windowErrors:env.windowErrors,browserIdle:env.browserIdle,png:env.svgPreview};
    }`)();
      let result;
      try {
        result = await runInAppTask({
          cli,
          execute,
          args: [
            drawingPath,
            template,
            { id, input: "mouse" },
            process.platform === "darwin" ? 4 : 2,
            systemFiles,
          ],
          timeoutMs: 240000,
          cleanupMs: 60000,
          onRequest: behaviorInputDriver(cli),
          onProgress: (phase, state) =>
            writeFileSync(
              join(reportDir, "svg-entry-" + id + "-progress.json"),
              JSON.stringify({
                phase,
                tests: state.tests,
                at: new Date().toISOString(),
              }),
            ),
        });
      } catch (error) {
        if (!error.cleanupVerified) safeToRemoveInputs = false;
        writeFileSync(
          join(reportDir, "svg-entry-" + id + "-failure.json"),
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
      tests.push(...result.tests);
      consoleErrors.push(...result.consoleErrors);
      windowErrors.push(...result.windowErrors);
      browserIdle.push(...result.browserIdle);
      if (result.png?.startsWith("data:image/png;base64,")) {
        writeFileSync(
          join(reportDir, "svg-entry-" + id + ".png"),
          Buffer.from(result.png.split(",")[1], "base64"),
        );
      }
    }
  } finally {
    if (safeToRemoveInputs)
      rmSync(systemInputs, { recursive: true, force: true });
  }
  const classified = splitWindowErrors(windowErrors);
  return {
    id: "svg-entry-points",
    status:
      tests.length === 10 &&
      tests.every((t) => t.status === "passed") &&
      !consoleErrors.length &&
      !classified.unexpected.length &&
      browserIdle.every((i) => i.status === "passed")
        ? "passed"
        : "failed",
    tests,
    consoleErrors,
    windowErrors,
    browserIdle,
    browserDiagnostics: classified.diagnostics,
  };
}

async function exerciseSVGEntryPoints(c, env, context, modifier, systemFiles) {
  const {
    p,
    doc,
    win,
    leaf,
    check,
    openDrawing,
    ready,
    create,
    click,
    key,
    input,
    saveReopen,
  } = env;
  const label = (key) => p.getLabel(key),
    frames = () =>
      new Promise((resolve) =>
        win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)),
      );
  const trusted = [];
  const onClick = (event) => {
    if (event.isTrusted) trusted.push({ type: event.type, at: Date.now() });
  };
  doc.addEventListener("click", onClick, true);
  c.defer(() => doc.removeEventListener("click", onClick, true));
  const ownedPrompts = new Set();
  c.defer(() => {
    for (const prompt of ownedPrompts)
      if (prompt.isConnected)
        prompt
          .closest(".modal-container")
          ?.querySelector(".modal-close-button")
          ?.click();
  });
  c.defer(() => {
    if (leaf.view.excalidrawAPI?.getAppState().openDialog?.name === "ttd")
      leaf.view.excalidrawAPI.updateScene({
        appState: { openDialog: null },
        captureUpdate: "NEVER",
      });
  });
  const run = (id, fn) =>
    c.case(
      "native:svg-entry:" + context + ":" + id,
      ["P03", "P09"],
      async () => {
        c.phase = "svg-entry:" + context + ":" + id;
        const before = trusted.length;
        const result = await fn();
        check(
          trusted.length > before,
          "Entry point did not receive trusted clicks",
        );
        return { ...result, trustedClicks: trusted.length - before };
      },
    );
  await run("image-menu-import", async () => {
    let view = await openDrawing("SVG-menu");
    const wc = require("@electron/remote").webContents.fromId(
      env.geometry().ownerContentsId,
    );
    const chooserEvents = [];
    const listener = (_event, method, params) => {
      if (method === "Page.fileChooserOpened") chooserEvents.push(params);
    };
    wc.debugger.on("message", listener);
    c.defer(async () => {
      try {
        await wc.debugger.sendCommand("Page.setInterceptFileChooserDialog", {
          enabled: false,
        });
      } finally {
        wc.debugger.removeListener("message", listener);
      }
    });
    await wc.debugger.sendCommand("Page.enable");
    await wc.debugger.sendCommand("Page.setInterceptFileChooserDialog", {
      enabled: true,
    });
    const openPicker = async () => {
      const before = chooserEvents.length;
      const trigger = [
        ...view.contentEl.querySelectorAll(
          '[data-testid="dropdown-menu-button"]',
        ),
      ].find((el) => el.title === label("COMP_IMG"));
      await click(trigger);
      await c.waitFor(
        () => doc.querySelector('[data-testid="toolbar-svg-import"]'),
        "SVG image menu item",
      );
      await click(doc.querySelector('[data-testid="toolbar-svg-import"]'));
      await c.waitFor(
        () =>
          chooserEvents.length > before &&
          doc.querySelector('[data-testid="svg-system-file-input"]'),
        "intercepted system SVG file chooser",
      );
      const input = doc.querySelector('[data-testid="svg-system-file-input"]');
      check(
        input.accept === ".svg,image/svg+xml",
        "System picker lost SVG filter",
      );
      return input;
    };
    let prompt = await openPicker();
    // The OS chooser is intercepted, so cancellation is explicitly synthetic.
    prompt.dispatchEvent(new win.Event("cancel"));
    await c.waitFor(() => !prompt.isConnected, "SVG picker cancellation");
    check(
      view.excalidrawAPI.getSceneElements().length === 0,
      "Cancelling the picker inserted elements",
    );
    prompt = await openPicker();
    await wc.debugger.sendCommand("DOM.setFileInputFiles", {
      files: [systemFiles.unicode],
      backendNodeId: chooserEvents.at(-1).backendNodeId,
    });
    await c.waitFor(
      () =>
        view.excalidrawAPI
          .getSceneElements()
          .some((e) => e.type === "text" && e.rawText === "SVG entrée 東京"),
      "editable SVG file insertion",
    );
    check(
      view.excalidrawAPI.getSceneElements().every((e) => e.type !== "image"),
      "File menu inserted an image",
    );
    view = await saveReopen(view);
    check(
      view.excalidrawAPI
        .getSceneElements()
        .some((e) => e.rawText === "SVG entrée 東京"),
      "File text did not persist",
    );
    view = await openDrawing("SVG-mindmap-system");
    await openPicker();
    await wc.debugger.sendCommand("DOM.setFileInputFiles", {
      files: [systemFiles.mindmap],
      backendNodeId: chooserEvents.at(-1).backendNodeId,
    });
    await c.waitFor(
      () =>
        view.excalidrawAPI
          .getSceneElements()
          .some((e) => e.type === "text" && e.rawText === "Project Launch"),
      "system mindmap conversion",
    );
    const elements = view.excalidrawAPI.getSceneElements();
    for (const color of ["#4c78a8", "#f58518", "#54a24b", "#e45756"])
      check(
        elements.some((e) => e.strokeColor === color),
        "Mindmap branch color missing " + color,
      );
    check(
      elements.some((e) => e.backgroundColor === "#f3f3f3"),
      "Mindmap root became black",
    );
    check(
      elements.some((e) => e.backgroundColor === "#4c78a838"),
      "Mindmap fill transparency lost",
    );
    const canvas = await view.packages.excalidrawLib.exportToCanvas({
      elements,
      files: {},
      appState: {
        ...view.excalidrawAPI.getAppState(),
        exportBackground: false,
        exportWithDarkMode: false,
      },
    });
    const data = canvas
      .getContext("2d")
      .getImageData(0, 0, canvas.width, canvas.height).data;
    // Canvas stores premultiplied channels: #4c78a838 reads back as
    // [77,118,168,56], not [76,120,168,56]. Use an independent solid reference.
    const reference = createFragment().createEl("canvas");
    reference.width = 1;
    reference.height = 1;
    const referenceContext = reference.getContext("2d");
    referenceContext.fillStyle = "#4c78a838";
    referenceContext.fillRect(0, 0, 1, 1);
    const bluePixel = referenceContext.getImageData(0, 0, 1, 1).data;
    let blue = 0;
    for (let i = 0; i < data.length; i += 4)
      if (
        data[i] === bluePixel[0] &&
        data[i + 1] === bluePixel[1] &&
        data[i + 2] === bluePixel[2] &&
        data[i + 3] === bluePixel[3]
      )
        blue++;
    check(blue > 100, "Decoded mindmap lost blue translucent fill");
    view = await saveReopen(view);
    check(
      view.excalidrawAPI
        .getSceneElements()
        .some((e) => e.backgroundColor === "#f3f3f3"),
      "Mindmap colors lost on reopen",
    );
    return {
      systemChooserEvents: chooserEvents.length,
      cancellationTransport: "synthetic cancel event; OS chooser intercepted",
      selectionTransport:
        "CDP DOM.setFileInputFiles after trusted menu clicks and Page.fileChooserOpened",
      mindmapBluePixels: blue,
      mindmapBlueReference: Array.from(bluePixel),
      assertions: [
        "trusted image-menu entry",
        "system chooser event and SVG filter",
        "synthetic picker cancellation leaves drawing unchanged",
        "exact system SVG file selection outside vault",
        "supplied mindmap colors/transparency and decoded pixels",
        "native geometry and editable Unicode text",
        "physical save/reopen",
      ],
    };
  });
  let keptFile;
  for (const choice of ["convert", "image", "cancel"])
    await run("mermaid-" + choice, async () => {
      let view = await openDrawing("Mermaid-" + choice);
      const api = view.excalidrawAPI;
      api.updateScene({
        appState: { openDialog: { name: "ttd", tab: "mermaid" } },
        captureUpdate: "NEVER",
      });
      await c.waitFor(
        () => doc.querySelector(".ttd-dialog .cm-content"),
        "Mermaid editor",
      );
      await click(doc.querySelector(".ttd-dialog .cm-content"));
      await key("a", "KeyA", 65, modifier);
      await input("Input.insertText", {
        text: 'pie title SVG choice\n "Alice" : 60\n "Bob" : 40',
      });
      let insert;
      await c.waitFor(() => {
        insert = [...doc.querySelectorAll(".ttd-dialog button")].find(
          (el) => el.textContent.trim().startsWith("Insert") && !el.disabled,
        );
        return (
          doc.querySelector(".ttd-dialog-output-canvas-container canvas") &&
          insert
        );
      }, "real Mermaid SVG preview");
      await click(insert);
      let prompt;
      await c.waitFor(() => {
        prompt = [...doc.querySelectorAll(".modal-content")].find((el) =>
          el.textContent.includes(label("MERMAID_SVG_CONVERSION_PROMPT")),
        );
        return prompt;
      }, "SVG conversion choice");
      ownedPrompts.add(prompt);
      const button = [...prompt.querySelectorAll("button")].find(
        (el) =>
          el.textContent ===
          label(
            choice === "convert"
              ? "SVG_CONVERT_ELEMENTS"
              : choice === "image"
                ? "SVG_KEEP_IMAGE"
                : "PROMPT_BUTTON_CANCEL",
          ),
      );
      await click(button);
      await c.waitFor(() => !prompt.isConnected, "conversion prompt close");
      await frames();
      if (choice === "cancel")
        check(api.getSceneElements().length === 0, "Cancel inserted a diagram");
      else {
        await c.waitFor(
          () => api.getSceneElements().length > 0,
          "chosen diagram insertion",
        );
        if (choice === "convert")
          check(
            api.getSceneElements().every((e) => e.type !== "image") &&
              api
                .getSceneElements()
                .some((e) => e.type === "text" && e.text.includes("Alice")),
            "Conversion lost editable labels or retained an image",
          );
        else {
          check(
            api
              .getSceneElements()
              .some((e) => e.type === "image" && e.customData?.mermaidText),
            "Keep SVG lost image/source",
          );
          keptFile = view.file;
        }
      }
      view = await saveReopen(view);
      return {
        assertions: [
          "real Extras SVG preview",
          "trusted Insert and explicit " + choice + " choice",
          "correct scene representation",
          "physical save/reopen",
        ],
      };
    });
  await run("scene-convert-undo-reopen", async () => {
    check(keptFile, "Missing kept SVG fixture");
    await leaf.openFile(keptFile);
    await ready(leaf);
    let view = leaf.view,
      api = view.excalidrawAPI;
    const original = api.getSceneElements().find((e) => e.type === "image"),
      source = api.getFiles()[original.fileId].dataURL;
    const image = {
      ...original,
      angle: 0.2,
      opacity: 70,
      groupIds: ["outer-svg-group"],
      version: original.version + 1,
    };
    const shared = {
      ...original,
      id: crypto.randomUUID(),
      x: original.x + original.width + 100,
      width: original.width / 2,
      height: original.height / 2,
      groupIds: [],
      index: null,
      version: 1,
    };
    api.updateScene({
      elements: [image, shared],
      captureUpdate: "IMMEDIATELY",
    });
    api.selectElements([image]);
    api.zoomToFit([image], 1, 0.05);
    await frames();
    const state = api.getAppState(),
      x =
        (image.x + image.width / 2 + state.scrollX) * state.zoom.value +
        state.offsetLeft,
      y =
        (image.y + image.height / 2 + state.scrollY) * state.zoom.value +
        state.offsetTop;
    for (const type of ["mousePressed", "mouseReleased"])
      await input("Input.dispatchMouseEvent", {
        type,
        x,
        y,
        button: "right",
        buttons: type === "mousePressed" ? 2 : 0,
        clickCount: 1,
      });
    await c.waitFor(
      () => doc.querySelector('[data-testid="convertSvgToStrokes"] button'),
      "embedded SVG context action",
    );
    await click(() =>
      doc.querySelector('[data-testid="convertSvgToStrokes"] button'),
    );
    await c.waitFor(
      () =>
        !api.getSceneElements().some((e) => e.id === image.id) &&
        api.getSceneElements().length > 1,
      "in-place SVG conversion",
    );
    const native = api.getSceneElements().filter((e) => e.id !== shared.id),
      ids = native.map((e) => e.id);
    check(
      native.every(
        (e) =>
          e.type !== "image" &&
          e.groupIds.includes("outer-svg-group") &&
          Math.abs(e.opacity - 70) < 1e-6,
      ),
      "Replacement lost grouping/opacity",
    );
    check(
      api.getSceneElements().at(-1).id === shared.id,
      "Replacement changed scene layer",
    );
    check(
      api.getSceneElements().find((e) => e.id === shared.id).width ===
        shared.width && api.getFiles()[original.fileId].dataURL === source,
      "Shared SVG source/geometry changed",
    );
    const canvas = await view.packages.excalidrawLib.exportToCanvas({
      elements: native,
      files: {},
      appState: {
        ...api.getAppState(),
        exportBackground: false,
        exportWithDarkMode: false,
      },
    });
    const pixels = canvas
      .getContext("2d")
      .getImageData(0, 0, canvas.width, canvas.height).data;
    env.svgPreview = canvas.toDataURL();
    let painted = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) painted++;
    check(painted > 100, "Converted preview is empty");
    await key("z", "KeyZ", 90, modifier);
    await c.waitFor(
      () =>
        api.getSceneElements().some((e) => e.id === image.id) &&
        !api.getSceneElements().some((e) => ids.includes(e.id)),
      "one-step SVG conversion undo",
    );
    await key("z", "KeyZ", 90, modifier | 8);
    await c.waitFor(
      () =>
        !api.getSceneElements().some((e) => e.id === image.id) &&
        ids.every((id) => api.getSceneElements().some((e) => e.id === id)),
      "SVG conversion redo",
    );
    view = await saveReopen(view);
    check(
      view.excalidrawAPI
        .getSceneElements()
        .some((e) => e.id === shared.id && e.type === "image"),
      "Shared image lost on reopen",
    );
    const styled = await create(
      "Styled-source.svg",
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><style>svg {opacity: .5} g rect {fill: blue}</style><rect width="100" height="50" fill="red"/></svg>',
    );
    let cssView = await openDrawing("Styled-SVG");
    const cssEA = p.ea.getAPI();
    cssEA.setView(cssView);
    let cssId;
    try {
      cssId = await cssEA.addImage(0, 0, styled, false);
      Object.assign(cssEA.getElement(cssId), {
        width: 200,
        height: 100,
        opacity: 60,
      });
      check(
        await cssEA.addElementsToView(false, true, true),
        "Styled SVG image insertion failed",
      );
    } finally {
      cssEA.destroy();
    }
    const cssAPI = cssView.excalidrawAPI;
    const cssImage = cssAPI.getSceneElements().find((e) => e.id === cssId);
    cssAPI.selectElements([cssImage]);
    cssAPI.zoomToFit([cssImage], 1, 0.05);
    await frames();
    const cssState = cssAPI.getAppState(),
      cssX =
        (cssImage.x + cssImage.width / 2 + cssState.scrollX) *
          cssState.zoom.value +
        cssState.offsetLeft,
      cssY =
        (cssImage.y + cssImage.height / 2 + cssState.scrollY) *
          cssState.zoom.value +
        cssState.offsetTop;
    for (const type of ["mousePressed", "mouseReleased"])
      await input("Input.dispatchMouseEvent", {
        type,
        x: cssX,
        y: cssY,
        button: "right",
        buttons: type === "mousePressed" ? 2 : 0,
        clickCount: 1,
      });
    await c.waitFor(
      () => doc.querySelector('[data-testid="convertSvgToStrokes"] button'),
      "styled SVG context action",
    );
    await click(() =>
      doc.querySelector('[data-testid="convertSvgToStrokes"] button'),
    );
    await c.waitFor(
      () =>
        !cssAPI.getSceneElements().some((e) => e.type === "image") &&
        cssAPI.getSceneElements().some((e) => e.type === "rectangle"),
      "styled SVG conversion",
    );
    const cssRectangle = cssAPI
      .getSceneElements()
      .find((e) => e.type === "rectangle");
    check(
      cssRectangle.backgroundColor === "#ff0000" &&
        Math.abs(cssRectangle.opacity - 30) < 1e-6,
      "SVG placement changed root/ancestor CSS",
    );
    const cssCanvas = await cssView.packages.excalidrawLib.exportToCanvas({
      elements: cssAPI.getSceneElements(),
      files: {},
      appState: {
        ...cssAPI.getAppState(),
        exportBackground: false,
        exportWithDarkMode: false,
      },
    });
    const cssPixels = cssCanvas
      .getContext("2d")
      .getImageData(0, 0, cssCanvas.width, cssCanvas.height).data;
    let cssRed = 0;
    for (let i = 0; i < cssPixels.length; i += 4)
      if (
        cssPixels[i] === 255 &&
        cssPixels[i + 1] === 0 &&
        cssPixels[i + 2] === 0 &&
        cssPixels[i + 3] >= 75 &&
        cssPixels[i + 3] <= 78
      )
        cssRed++;
    check(cssRed > 100, "Decoded SVG CSS opacity/color differs");
    cssView = await saveReopen(cssView);
    return {
      assertions: [
        "trusted right-click on generated embedded SVG",
        "in-place grouped replacement at original layer",
        "shared source and independent sizes preserved",
        "decoded output pixels",
        "one-step undo/redo",
        "physical save/reopen",
        "source SVG root/ancestor styles apply once",
        "decoded red pixels retain 30 percent opacity",
      ],
      nativeElements: native.length,
      paintedPixels: painted,
      cssRedPixels: cssRed,
    };
  });
}
