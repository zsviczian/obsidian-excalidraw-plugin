/** Required core workflows across actual workspace contexts; no screenshots count as behavioral passes. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { behavioralCases } from "../behaviorPlan.mjs";
import { runInAppTask, parseCLIJSON } from "./inAppTask.mjs";
import { behaviorEnvironment } from "./behaviorEnvironment.mjs";
import {
  exerciseSettingsBehavior,
  exerciseExportBehavior,
} from "./settingsBehavior.mjs";
import {
  exerciseEABehavior,
  exerciseSettingsLifecycle,
} from "./eaBehavior.mjs";
import { exerciseMarkdownBehavior } from "./markdownBehavior.mjs";
import { exerciseImageBehavior } from "./imageBehavior.mjs";
import { exerciseInteractionBehavior } from "./interactionBehavior.mjs";
import { exerciseCLIBehavior } from "./cliBehavior.mjs";

const methods = new Set([
  "Input.dispatchMouseEvent",
  "Input.dispatchTouchEvent",
  "Input.dispatchKeyEvent",
  "Input.insertText",
  "Emulation.setTouchEmulationEnabled",
]);
export function behaviorInputDriver(cli) {
  return (request) => {
    if (request.method === "behavior-plugin-cli") {
      assert.ok(["read", "apply"].includes(request.params.command));
      assert.ok(
        request.params.request.path.startsWith("__excalidraw_cli_smoke_") &&
          request.params.request.path.includes("_behavior_"),
      );
      return parseCLIJSON(
        cli(
          "obsidian-excalidraw-plugin:" + request.params.command,
          "json=" + JSON.stringify(request.params.request),
        ),
      );
    }
    assert.equal(request.method, "behavior-input");
    assert.ok(
      methods.has(request.params.method) &&
        Number.isSafeInteger(request.params.contentsId),
    );
    const { contentsId, method, params } = request.params;
    return parseCLIJSON(
      cli(
        "eval",
        "code=" +
          `(async()=>{const wc=require('@electron/remote').webContents.fromId(${contentsId});if(!wc?.debugger.isAttached())throw Error('Behavior input debugger ownership missing');await wc.debugger.sendCommand(${JSON.stringify(method)},${JSON.stringify(params)});return JSON.stringify({dispatched:true});})()`,
      ),
    );
  };
}

export async function runBehaviorMatrix({
  cli,
  drawingPath,
  contexts = ["main", "split", "nested-split", "popout"],
  input = "mouse",
  caseIds,
}) {
  const template = readFileSync(
    new URL(
      "../../../tests/vault/Drawings/Uncompressed.excalidraw.md",
      import.meta.url,
    ),
    "utf8",
  );
  const tests = [];
  for (const id of contexts) {
    const rows = behavioralCases([id]).filter(
      (row) => !caseIds || caseIds.includes(row.id),
    );
    assert.ok(
      rows.length &&
        (!caseIds ||
          caseIds.every((caseId) => rows.some((row) => row.id === caseId))),
      "Focused behavior case does not exist",
    );
    const execute =
      new Function(`return async function(c,path,context,template,rows,modifier){
      const env=await (${behaviorEnvironment.toString()})(c,path,context,template);
      await (${exerciseSettingsBehavior.toString()})(c,env,rows.filter(r=>r.id.startsWith('settings-')&&r.values));
      await (${exerciseExportBehavior.toString()})(c,env,rows.filter(r=>r.id.startsWith('export-')));
      await (${exerciseSettingsLifecycle.toString()})(c,env,rows.filter(r=>['settings-live-persistence','frontmatter-prefixes-theme-scale'].includes(r.id)));
      await (${exerciseCLIBehavior.toString()})(c,env,rows.filter(r=>r.id==='cli-atomic-targeted-edit'));
      await (${exerciseMarkdownBehavior.toString()})(c,env,rows.filter(r=>r.id.startsWith('markdown-')||r.id==='raw-parsed-text'));
      await (${exerciseImageBehavior.toString()})(c,env,rows.filter(r=>r.id.startsWith('images-')||r.id==='drawing-and-markdown-embeds'));
      await (${exerciseEABehavior.toString()})(c,env,rows.filter(r=>r.id.startsWith('ea-')));
      await (${exerciseInteractionBehavior.toString()})(c,env,rows.filter(r=>r.id.startsWith('command-')||r.id==='toolbar-context-shortcuts'),modifier);
      return {tests:c.tests};
    }`)();
    const result = await runInAppTask({
      cli,
      execute,
      args: [
        drawingPath,
        { id, input },
        template,
        rows,
        process.platform === "darwin" ? 4 : 2,
      ],
      timeoutMs: 600000,
      cleanupMs: 60000,
      onRequest: behaviorInputDriver(cli),
    });
    assert.deepEqual(
      result.tests.map((t) => t.testId).sort(),
      rows.map((r) => r.testId).sort(),
      "Behavioral obligations missing from " + id,
    );
    tests.push(...result.tests);
  }
  return {
    id: "behavior-matrix",
    status: "passed",
    tests,
    scope: { contexts, caseIds: caseIds || "all" },
  };
}
