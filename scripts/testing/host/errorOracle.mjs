/** Separate native negative control: a real uncaught error must fail our oracle. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  acquireDebuggerSession,
  unexpectedConsoleErrors,
} from "./debuggerSession.mjs";
import { parseCLIJSON, runInAppTask } from "./inAppTask.mjs";
import { spawnNativeSync } from "./processTools.mjs";
import { writeReportFiles } from "../reportFiles.mjs";
import {classifyCLIErrorText} from './browserDiagnostics.mjs';
export async function runErrorOracle({ cli, reportDir, source = {} }) {
  mkdirSync(reportDir, { recursive: true });
  const token = randomUUID().replaceAll("-", ""),
    key = "__excalidrawErrorOracle_" + token,
    marker = "EXCALIDRAW_TEST_EXCEPTION_" + token;
  const report = {
    schemaVersion: 2,
    suiteId: "native-error-oracle",
    status: "failed",
    cleanup: "not-started",
    source,
    tests: [],
  };
  let session,
    installed = false;
  try {
    report.initialCLIErrors=classifyCLIErrorText(cli('dev:errors'));
    assert.deepEqual(report.initialCLIErrors.unexpected,[],"Existing host errors must be reviewed first");
    session = acquireDebuggerSession(cli);
    assert.deepEqual(session.read(), [], "Fresh debugger has existing errors");
    parseCLIJSON(
      cli(
        "eval",
        `code=(()=>{if(globalThis[${JSON.stringify(key)}])throw Error('Oracle controller collision');const c={};globalThis[${JSON.stringify(key)}]=c;c.timer=setTimeout(()=>{c.timer=null;throw Error(${JSON.stringify(marker)})},0);return JSON.stringify(true)})()`,
      ),
    );
    installed = true;
    const end = Date.now() + 10000;
    let errors;
    for (;;) {
      errors = session.read();
      if (
        errors.some(
          (e) =>
            e.kind === "exception" && e.messages.join(" ").includes(marker),
        )
      )
        break;
      if (Date.now() > end)
        throw Error(
          "Native oracle did not capture the intentional unhandled exception",
        );
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.equal(errors.length, 1, "Unexpected additional native error");
    assert.ok(
      errors.every(
        (e) => e.kind === "exception" && e.messages.join(" ").includes(marker),
      ),
    );
    assert.equal(
      unexpectedConsoleErrors(errors).length,
      1,
      "Ordinary clean-error gate accepted an unhandled error",
    );
    report.captured = errors;
    report.status = "passed";
    report.tests.push({
      testId: "native:diagnostics-rejects-unhandled",
      featureIds: ["P11"],
      status: "passed",
      assertions: [
        "actual uncaught host exception captured by a fresh owned stream",
        "ordinary clean-error oracle rejects it",
        "no unrelated error is filtered",
      ],
    });
    const actualWidth=parseCLIJSON(cli('eval','code=JSON.stringify(app.workspace.containerEl.getBoundingClientRect().width)'));
    let layoutFailure;
    try {
      await runInAppTask({cli,args:[actualWidth+17],execute:async(c,expected)=>c.case('negative-control:broken-layout',['P11'],async()=>{
        const actual=app.workspace.containerEl.getBoundingClientRect().width;
        if(actual!==expected)throw Error('INTENTIONAL_LAYOUT_MISMATCH: '+actual+' !== '+expected);
        return {assertions:['workspace width matches expected']};
      })});
    } catch(error){layoutFailure=error;}
    assert.match(layoutFailure?.message||'',/INTENTIONAL_LAYOUT_MISMATCH/,'Deliberately broken native layout assertion passed');
    assert.notEqual(layoutFailure.cleanupFailed,true,'Negative control did not clean up');
    assert.equal(layoutFailure.evidence?.[0]?.status,'failed','The ordinary native case collector accepted a broken layout');
    report.layoutNegativeControl=layoutFailure.evidence;
    report.tests.push({testId:'native:diagnostics-rejects-broken-layout',featureIds:['P11'],status:'passed',assertions:['actual workspace geometry measured','ordinary native task/case collector rejects deliberately wrong width','negative-control cleanup passes']});

  } catch (error) {
    report.error = String(error.stack || error);
    report.tests.push({
      testId: "native:diagnostics-rejects-unhandled",
      featureIds: ["P11"],
      status: "failed",
      reason: report.error,
    });
  } finally {
    const errors = [];
    try {
      if (installed)
        parseCLIJSON(
          cli(
            "eval",
            `code=(()=>{const c=globalThis[${JSON.stringify(key)}];if(!c)throw Error('Owned oracle controller disappeared');if(c.timer!==null)clearTimeout(c.timer);delete globalThis[${JSON.stringify(key)}];return JSON.stringify(true)})()`,
          ),
        );
    } catch (error) {
      errors.push(String(error));
    }
    try {
      if (session) {
        const captured = session.read();
        assert.ok(
          captured.length === 1 &&
            captured.every(
              (e) =>
                e.kind === "exception" && e.messages.join(" ").includes(marker),
            ),
          "Unrelated or missing errors prevent clearing the host buffer",
        );
        cli("dev:errors", "clear");
      }
    } catch (error) {
      errors.push(String(error));
    }
    try {
      session?.dispose();
    } catch (error) {
      errors.push(String(error));
    }
    report.cleanup = errors.length ? "failed" : "passed";
    if (errors.length) {
      report.status = "failed";
      report.cleanupError = errors.join("; ");
    }
    writeFileSync(
      join(reportDir, "report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    writeReportFiles(report, reportDir);
  }
  return report;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const result = spawnNativeSync(
    process.execPath,
    [
      join(root, "scripts/testing/host/verify.mjs"),
      "--profile=smoke",
      "--diagnostics",
    ],
    { cwd: root, env: process.env, stdio: "inherit", windowsHide: true },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
