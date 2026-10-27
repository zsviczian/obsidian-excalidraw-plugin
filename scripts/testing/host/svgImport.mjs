/** #3018 corpus, browser-rendered source oracle and native editor regressions. */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSvgBaseline, SVG_BASELINE_COMMIT } from "./svgBaseline.mjs";
import { probeSvgRendering } from "./svgRenderProbe.mjs";
import { probeSvgEditor } from "./svgEditorProbe.mjs";
import { probeSvgReload } from "./svgReloadProbe.mjs";
import { svgFixtures } from "./svgFixtures.mjs";

/** Runs against only the parent runner's fixture; original supplied assets are read-only. */
export async function runSvgImportScenario({ cli, drawingPath, reportDir }) {
  const key = "__svgImport3018",
    projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const evaluate = (code) =>
    JSON.parse(
      cli("eval", `code=${code}`)
        .trim()
        .replace(/^=>\s*/, ""),
    );
  const vault = evaluate(
    "JSON.stringify({path:app.vault.adapter.basePath})",
  ).path;
  const assetDir = join(vault, "TestAssets"),
    hashes = () =>
      Object.fromEntries(
        readdirSync(assetDir)
          .filter((name) => name.endsWith(".svg"))
          .sort()
          .map((name) => [
            name,
            createHash("sha256")
              .update(readFileSync(join(assetDir, name)))
              .digest("hex"),
          ]),
      );
  const originalHashes = hashes(),
    baseline = await buildSvgBaseline(projectRoot, reportDir);
  const run = async (fn, args) => {
    evaluate(
      `(()=>{const c=globalThis.${key};c.state="pending";delete c.error;(${fn.toString()})(${args.map((value) => JSON.stringify(value)).join(",")}).then(()=>c.state="done").catch(e=>{c.state="failed";c.error=e.stack});return JSON.stringify({started:true})})()`,
    );
    let state;
    for (let i = 0; i < 800; i++) {
      state = evaluate(
        `JSON.stringify({state:globalThis.${key}.state,error:globalThis.${key}.error,stage:globalThis.${key}.stage})`,
      );
      if (state.state !== "pending") break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(
      state.state,
      "done",
      state.error ?? `${fn.name} timed out: ${state.stage}`,
    );
  };
  try {
    evaluate(
      `(()=>{if(globalThis.${key})throw Error("SVG controller exists");globalThis.${key}={baseline:(()=>{${baseline};return SvgBaseline;})()};return JSON.stringify({started:true})})()`,
    );
    await run(probeSvgRendering, [
      key,
      drawingPath,
      "__svg-import-3018-" + randomUUID(),
      svgFixtures,
    ]);
    const rendering = evaluate(
      `JSON.stringify({iconCount:globalThis.${key}.iconCount,lucideCount:globalThis.${key}.lucideCount,corpus:globalThis.${key}.corpus,results:globalThis.${key}.results})`,
    );
    assert.equal(
      rendering.corpus.length,
      rendering.iconCount,
      "getIconIds() entries without converted getIcon() output",
    );
    for (const [index, fixture] of rendering.results.entries()) {
      for (const [kind, png] of Object.entries(fixture.previews))
        writeFileSync(
          join(reportDir, `svg-${index}-${kind}.png`),
          Buffer.from(png.split(",")[1], "base64"),
        );
      delete fixture.previews;
      for (const metric of fixture.metrics) {
        if (
          ![
            "group-opacity-approximation",
            "TestAssets/noun_Rocket_8415980.svg",
          ].includes(fixture.name)
        )
          assert.ok(
            metric.updated.mean < 0.01,
            `${fixture.name}: source/current raster difference ${metric.updated.mean}`,
          );
        if (fixture.name.startsWith("known-good"))
          assert.ok(
            metric.updated.mean <= metric.baseline.mean + 0.001,
            `${fixture.name} regressed`,
          );
      }
    }
    writeFileSync(
      join(reportDir, "svg-corpus.json"),
      JSON.stringify(
        {
          baseline: SVG_BASELINE_COMMIT,
          assetHashes: originalHashes,
          ...rendering,
        },
        null,
        2,
      ),
    );
    for (const popout of [false, true])
      await run(probeSvgEditor, [key, drawingPath, popout]);
    const editor = evaluate(`JSON.stringify(globalThis.${key}.editorResults)`);
    assert.equal(editor.length, 2);
    const snapshot = evaluate(
      `(()=>{const v=app.workspace.getLeavesOfType("excalidraw").find(l=>l.view.file?.path===${JSON.stringify(drawingPath)}).view;return JSON.stringify(v.getViewElements().map(e=>({id:e.id,type:e.type,x:e.x,y:e.y,width:e.width,height:e.height,angle:e.angle,points:e.points,groupIds:e.groupIds,backgroundColor:e.backgroundColor,strokeColor:e.strokeColor})))})()`,
    );
    cli("plugin:disable", "id=obsidian-excalidraw-plugin");
    cli("plugin:enable", "id=obsidian-excalidraw-plugin");
    let ready = false;
    for (let i = 0; i < 200; i++) {
      ready = evaluate(
        'JSON.stringify(!!app.plugins.plugins["obsidian-excalidraw-plugin"]?.isReady)',
      );
      if (ready) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.equal(ready, true, "plugin reload readiness");
    await run(probeSvgReload, [key, drawingPath, snapshot]);
    assert.deepEqual(hashes(), originalHashes, "supplied SVG assets changed");
    return {
      id: "svg-import-3018",
      status: "passed",
      baseline: SVG_BASELINE_COMMIT,
      assetHashes: originalHashes,
      iconCount: rendering.iconCount,
      lucideCount: rendering.lucideCount,
      iconResults: rendering.corpus.length,
      visualCases: rendering.results,
      editor,
      pluginReload: true,
    };
  } finally {
    evaluate(
      `(()=>{delete globalThis.${key};return JSON.stringify({clean:true})})()`,
    );
  }
}
