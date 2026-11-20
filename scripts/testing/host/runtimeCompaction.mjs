/** Real local CJK registration and glyph-subset exports in main/popout documents. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInAppTask } from "./inAppTask.mjs";
import { behaviorEnvironment } from "./behaviorEnvironment.mjs";
import { behaviorInputDriver } from "./behaviorMatrix.mjs";
import { completeConsoleErrors } from "./debuggerSession.mjs";
import {
  settleBrowserDiagnostics,
  splitWindowErrors,
} from "./browserDiagnostics.mjs";

export const runtimeCompactionCaseIds = ["main", "popout"].flatMap(
  (context) => [
    `native:runtime-compaction:cjk:${context}`,
    `native:runtime-compaction:font-subset:${context}`,
  ],
);

export async function runRuntimeCompactionScenario({ cli, drawingPath }) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const faces = JSON.parse(
    readFileSync(join(root, "tests/fixtures/cjk-font-faces.json"), "utf8"),
  );
  const face = faces.find(({ descriptors }) =>
    descriptors.unicodeRange.split(",").some((range) => {
      const [start, end = start] = range
        .replace("U+", "")
        .split("-")
        .map((value) => parseInt(value, 16));
      return start <= 0x4e2d && end >= 0x4e2d;
    }),
  );
  assert.match(face.uri, /^Xiaolai-Regular-[a-f0-9]{32}\.woff2$/);
  const fork = resolve(
    process.env.EXCALIDRAW_FORK_ROOT || join(root, "../excalidraw"),
  );
  const bytes = readFileSync(
    join(fork, "packages/excalidraw/fonts/Xiaolai", face.uri),
  );
  const asset = {
    name: face.uri,
    bytes: bytes.toString("base64"),
    unicodeRange: face.descriptors.unicodeRange,
  };
  const execute = new Function(`return async function(c,path,template,asset){
    return (${exerciseRuntimeCompaction.toString()})(c,path,template,asset,
      ${behaviorEnvironment.toString()},${completeConsoleErrors.toString()},${settleBrowserDiagnostics.toString()});
  }`)();
  const result = await runInAppTask({
    cli,
    execute,
    args: [
      drawingPath,
      readFileSync(
        join(root, "tests/vault/Drawings/Uncompressed.excalidraw.md"),
        "utf8",
      ),
      asset,
    ],
    timeoutMs: 180000,
    cleanupMs: 90000,
    onRequest: behaviorInputDriver(cli),
  });
  assert.equal(
    result.consoleErrors.flat().length,
    0,
    "Compaction emitted console errors",
  );
  assert.equal(
    splitWindowErrors(result.windowErrors.flat()).unexpected.length,
    0,
    "Compaction emitted window errors",
  );
  assert.ok(
    result.browserIdle.flat().every((entry) => entry.status === "passed"),
    "Compaction cleanup did not settle",
  );
  return {
    id: "runtime-compaction",
    status: "passed",
    ...result,
    consoleErrors: result.consoleErrors.flat(),
    windowErrors: result.windowErrors.flat(),
    browserIdle: result.browserIdle.flat(),
    fontAsset: {
      name: asset.name,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.length,
    },
  };
}

async function exerciseRuntimeCompaction(
  c,
  parentPath,
  template,
  asset,
  createEnvironment,
  collectErrors,
  settle,
) {
  const check = (value, label) => {
    if (!value) throw Error(label);
  };
  check(
    parentPath.startsWith("__excalidraw_cli_smoke_"),
    "Unowned compaction parent",
  );
  const runId = parentPath.match(
    /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i,
  )?.[0];
  check(runId, "Compaction parent has no run identity");
  const folder =
    "__excalidraw_cli_smoke_" + runId.slice(0, 8) + "_compaction_fonts";
  check(
    !app.vault.getAbstractFileByPath(folder),
    "Compaction font fixture collision",
  );
  const pluginId = "obsidian-excalidraw-plugin";
  let plugin = app.plugins.plugins[pluginId];
  const keys = [
    "fontAssetsPath",
    "loadChineseFonts",
    "loadJapaneseFonts",
    "loadKoreanFonts",
  ];
  const saved = Object.fromEntries(
    keys.map((key) => [
      key,
      {
        present: Object.hasOwn(plugin.settings, key),
        value: plugin.settings[key],
      },
    ]),
  );
  c.defer(async () => {
    const live = app.plugins.plugins[pluginId];
    check(
      live?.isReady,
      "Live plugin unavailable for font settings restoration",
    );
    for (const [key, old] of Object.entries(saved)) {
      if (old.present) live.settings[key] = old.value;
      else delete live.settings[key];
    }
    await live.saveSettings();
    await app.plugins.disablePlugin(pluginId);
    await app.plugins.enablePlugin(pluginId);
    await c.waitForCleanup(
      () => app.plugins.plugins[pluginId]?.isReady,
      "restore original font configuration",
    );
    const target = app.vault.getFolderByPath(folder);
    if (target) {
      check(
        target.path === folder &&
          target.path.startsWith("__excalidraw_cli_smoke_"),
        "Refusing unowned font cleanup",
      );
      await app.vault.delete(target, true);
    }
  });
  await app.vault.createFolder(folder);
  const fontBytes = Uint8Array.from(atob(asset.bytes), (char) =>
    char.charCodeAt(0),
  );
  await app.vault.createBinary(folder + "/" + asset.name, fontBytes.buffer);
  Object.assign(plugin.settings, {
    fontAssetsPath: folder,
    loadChineseFonts: true,
    loadJapaneseFonts: false,
    loadKoreanFonts: false,
  });
  await plugin.saveSettings();
  for (const leaf of app.workspace.getLeavesOfType("excalidraw")) {
    if (leaf.view.excalidrawAPI && leaf.view.isDirty())
      check(
        (await leaf.view.saveWithOutcome()).status === "persisted",
        "Save before font reload",
      );
  }
  await app.plugins.disablePlugin(pluginId);
  await app.plugins.enablePlugin(pluginId);
  await c.waitFor(
    () => app.plugins.plugins[pluginId]?.isReady,
    "CJK configuration reload",
  );
  plugin = app.plugins.plugins[pluginId];
  check(
    plugin.getCJKFontSettings().c,
    "Local CJK configuration was not enabled",
  );
  const consoleErrors = [],
    windowErrors = [],
    browserIdle = [];
  for (const context of ["main", "popout"]) {
    const env = await createEnvironment(
      c,
      parentPath,
      { id: context, input: "mouse" },
      template,
      collectErrors,
      settle,
    );
    const view = await env.openDrawing("runtime-compaction");
    const doc = view.ownerDocument,
      win = doc.defaultView;
    consoleErrors.push(c.externalConsoleErrors || []);
    windowErrors.push(env.windowErrors);
    browserIdle.push(env.browserIdle);
    await c.case(
      "native:runtime-compaction:cjk:" + context,
      ["P03", "P08"],
      async () => {
        await c.waitFor(
          () => [...doc.fonts].some((face) => face.family === "Xiaolai"),
          "local CJK registration in owning document",
        );
        // Registration remains lazy. Request the glyph before checking loaded state.
        const loaded = await doc.fonts.load('28px "Xiaolai"', "中");
        check(
          loaded.some(
            (face) => face.family === "Xiaolai" && face.status === "loaded",
          ),
          "Local CJK font did not load on first use",
        );
        const reference = new win.FontFace(
          "CJKCompactionReference",
          fontBytes.buffer,
          { unicodeRange: asset.unicodeRange },
        );
        await reference.load();
        doc.fonts.add(reference);
        c.defer(() => {
          if (!win.closed) doc.fonts.delete(reference);
        });
        const raster = (family) => {
          const canvas = doc.createElement("canvas");
          canvas.width = 80;
          canvas.height = 60;
          const ctx = canvas.getContext("2d");
          ctx.font = '28px "' + family + '"';
          ctx.fillStyle = "#123456";
          ctx.fillText("中", 5, 40);
          return [...ctx.getImageData(0, 0, 80, 60).data];
        };
        const actual = raster("Xiaolai"),
          expected = raster("CJKCompactionReference");
        check(
          actual.some((value, index) => index % 4 === 3 && value > 0),
          "Local CJK raster is blank",
        );
        check(
          actual.every((value, index) => value === expected[index]),
          "Shared-registry CJK raster differs from the source font",
        );
        return {
          assertions: [
            "local subset settings survive real reload",
            "font registered in the view's owning document",
            "CJK pixels exactly match the original font bytes",
          ],
        };
      },
    );
    await c.case(
      "native:runtime-compaction:font-subset:" + context,
      ["P03", "P08"],
      async () => {
        const lib = view.packages.excalidrawLib;
        const elements = lib.convertToExcalidrawElements([
          {
            type: "text",
            text: "ABC",
            fontFamily: 1,
            fontSize: 28,
            x: 0,
            y: 0,
          },
        ]);
        await lib.loadSceneFonts(elements);
        const faces = lib.Fonts.registered.get(1).fontFaces;
        check(
          faces.length === 1 && typeof faces[0].urls[0] === "string",
          "Single-face font fixture unavailable",
        );
        const completeBytes = atob(faces[0].urls[0].split(",")[1]).length;
        const options = {
          elements,
          files: {},
          appState: { exportBackground: false },
          exportPadding: 0,
        };
        const payloads = (svg) =>
          [
            ...svg.outerHTML.matchAll(
              /data:font\/woff2;base64,([A-Za-z0-9+/=]+)/g,
            ),
          ].map((match) => match[1]);
        const started = performance.now(),
          first = payloads(await lib.exportToSvg(options)),
          firstExportMs = performance.now() - started;
        check(
          first.length === 1 && atob(first[0]).length < completeBytes,
          "SVG did not subset the font",
        );
        const binary = Uint8Array.from(atob(first[0]), (char) =>
          char.charCodeAt(0),
        );
        check(
          String.fromCharCode(...binary.subarray(0, 4)) === "wOF2",
          "Subset font is not WOFF2",
        );
        await new win.FontFace(
          "SubsetCompactionReference",
          binary.buffer,
        ).load();
        const again = payloads(await lib.exportToSvg(options));
        check(
          JSON.stringify(first) === JSON.stringify(again),
          "Repeated font export changed subset bytes",
        );
        return {
          assertions: [
            "actual WASM produces smaller embedded font",
            "owner-window FontFace decodes output",
            "warm export preserves exact subset bytes",
          ],
          firstExportMs,
          subsetBytes: binary.length,
          completeBytes,
        };
      },
    );
  }
  return { tests: c.tests, consoleErrors, windowErrors, browserIdle };
}
