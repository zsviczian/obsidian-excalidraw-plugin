/** Required core workflows across actual workspace contexts; no screenshots count as behavioral passes. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
import { completeConsoleErrors } from "./debuggerSession.mjs";
import { splitWindowErrors, settleBrowserDiagnostics } from './browserDiagnostics.mjs';

const methods = new Set([
  "Input.dispatchMouseEvent",
  "Input.dispatchTouchEvent",
  "Input.dispatchKeyEvent",
  "Input.insertText",
  "Emulation.setTouchEmulationEnabled",
]);

/** Continue independent cases while retaining failures; cancellation still stops work. */
export function collectBehaviorCases(c) {
  const runCase = c.case.bind(c);
  c.case = async (...args) => {
    c.phase = args[0];
    c.caseTrace = {};
    try {
      return await runCase(...args);
    } catch (error) {
      const record = c.tests.find(
        (test) => test.testId === args[0] && test.status === "failed",
      );
      if (record && c.diagnostics) {
        try {
          record.diagnostics = c.diagnostics();
        } catch (diagnosticError) {
          record.diagnosticError = String(diagnosticError);
        }
      }
      if (
        c.cancelled ||
        !c.tests.some(
          (test) => test.testId === args[0] && test.status === "failed",
        )
      )
        throw error;
    }
  };
}
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
  reportDir,
}) {
  const template = readFileSync(
    new URL(
      "../../../tests/vault/Drawings/Uncompressed.excalidraw.md",
      import.meta.url,
    ),
    "utf8",
  );
  const tests = [],
    consoleErrors = [],
    windowErrors = [], browserIdle = [];
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
      (${collectBehaviorCases.toString()})(c);
      const env=await (${behaviorEnvironment.toString()})(c,path,context,template,${completeConsoleErrors.toString()},${settleBrowserDiagnostics.toString()});
      c.diagnostics=env.diagnostics;
      await (${exerciseSettingsBehavior.toString()})(c,env,rows.filter(r=>r.id.startsWith('settings-')&&r.values));
      await (${exerciseExportBehavior.toString()})(c,env,rows.filter(r=>r.id.startsWith('export-')));
      await (${exerciseSettingsLifecycle.toString()})(c,env,rows.filter(r=>['settings-live-persistence','frontmatter-prefixes-theme-scale'].includes(r.id)));
      await (${exerciseCLIBehavior.toString()})(c,env,rows.filter(r=>r.id==='cli-atomic-targeted-edit'));
      await (${exerciseMarkdownBehavior.toString()})(c,env,rows.filter(r=>r.id.startsWith('markdown-')||r.id==='raw-parsed-text'));
      await (${exerciseImageBehavior.toString()})(c,env,rows.filter(r=>r.id.startsWith('images-')||r.id==='drawing-and-markdown-embeds'));
      await (${exerciseEABehavior.toString()})(c,env,rows.filter(r=>r.id.startsWith('ea-')));
      await (${exerciseInteractionBehavior.toString()})(c,env,rows.filter(r=>r.id.startsWith('command-')||r.id==='toolbar-context-shortcuts'),modifier);
      return {tests:c.tests,consoleErrors:c.externalConsoleErrors||[],windowErrors:env.windowErrors,browserIdle:env.browserIdle};
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
      onProgress: (phase, state) => {
        if (reportDir)
          writeFileSync(
            join(reportDir, "behavior-" + id + "-progress.json"),
            JSON.stringify({
              phase,
              tests: state.tests,
              at: new Date().toISOString(),
            }) + "\n",
          );
      },
    }).catch((error) => {
      // Keep completed contexts when a later context cannot finish cleanup.
      error.evidence = [...tests, ...(error.evidence || [])];
      throw error;
    });
    assert.deepEqual(
      result.tests.map((t) => t.testId).sort(),
      rows.map((r) => r.testId).sort(),
      "Behavioral obligations missing from " + id,
    );
    tests.push(...result.tests);
    consoleErrors.push(...result.consoleErrors);
    windowErrors.push(...result.windowErrors);
    browserIdle.push(...result.browserIdle);
  }
  const classified=splitWindowErrors(windowErrors);
  return {
    id: "behavior-matrix",
    status:
      tests.every((test) => test.status === "passed") &&
      classified.unexpected.length === 0 && browserIdle.every(idle=>idle.status==='passed')
        ? "passed"
        : "failed",
    ...(classified.unexpected.length || browserIdle.some(idle=>idle.status!=='passed')
      ? {
          reason: "Unexpected native window errors during behavioral workflows",
        }
      : {}),
    tests,
    consoleErrors,
    windowErrors,
    browserDiagnostics:classified.diagnostics,
    unexpectedWindowErrors:classified.unexpected,
    browserIdle,
    expectedConsoleErrors: tests.flatMap(
      (test) => test.expectedConsoleErrors || [],
    ),
    scope: { contexts, caseIds: caseIds || "all" },
  };
}
