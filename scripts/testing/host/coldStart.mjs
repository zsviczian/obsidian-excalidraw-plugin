import {
  prepareColdDrawing,
  verifyColdDrawing,
  cleanupColdDrawing,
} from "./coldDrawing.mjs";
/** Official app restart is allowed only after proving an isolated owned session. */
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { requireIsolatedSession } from "./requireIsolatedSession.mjs";
import { validateTarget } from "./runner.mjs";
import { acquireHostLock } from "./hostLock.mjs";
import { runInAppTask, parseCLIJSON } from "./inAppTask.mjs";
import { obsidianCliExecutable, spawnNativeSync } from "./processTools.mjs";
import {
  sourceIdentity,
  validateArtifactManifest,
  fileHash,
} from "../contracts.mjs";
import { writeReportFiles } from "../reportFiles.mjs";
import { configureLocalVaultEnvironment } from "../localVault.mjs";
export async function restartIsolatedHost({
  proveIsolation,
  cli,
  readMainPID,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
  timeoutMs = 60000,
}) {
  proveIsolation();
  assert.ok(
    cli("help").includes("restart"),
    "Host CLI has no app restart capability",
  );
  const before = readMainPID();
  assert.ok(
    Number.isInteger(before) && before > 0,
    "Main-process identity unavailable",
  );
  cli("restart");
  const end = now() + timeoutMs,
    transitions = [];
  for (;;) {
    try {
      const after = readMainPID();
      if (Number.isInteger(after) && after > 0 && after !== before) {
        proveIsolation();
        return { before, after, transitions };
      }
    } catch (error) {
      const reason = String(error);
      if (!transitions.includes(reason)) transitions.push(reason);
    }
    if (now() >= end)
      throw Error("App restart did not produce a new ready main process");
    await wait(100);
  }
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  configureLocalVaultEnvironment(root);
  const reportDir = resolve(
    process.env.EXCALIDRAW_TEST_REPORT_DIR ||
      join(root, ".test-work/reports/cold-start"),
  );
  mkdirSync(reportDir, { recursive: true });
  const report = {
    schemaVersion: 2,
    suiteId: "native-cold",
    status: "blocked",
    cleanup: "passed",
    source: sourceIdentity(root),
    tests: [],
  };
  let lock,
    created = false,
    started = false,
    preserve = false;
  const path = "__excalidraw_cli_smoke_cold_" + randomUUID() + ".excalidraw.md";
  const cli = (...args) => {
    const r = spawnNativeSync(
      obsidianCliExecutable(),
      ["vault=" + process.env.EXCALIDRAW_TEST_VAULT_NAME, ...args],
      { encoding: "utf8", timeout: 15000, maxBuffer: 4 * 1024 * 1024 },
    );
    if (r.error || r.status || /^Error:/m.test(r.stdout))
      throw Error(r.error?.message || r.stdout || r.stderr);
    return r.stdout;
  };
  const proveIsolation = () =>
    requireIsolatedSession({
      workRoot: process.env.EXCALIDRAW_TEST_AUTOMATION_ROOT,
      vaultPath: process.env.EXCALIDRAW_TEST_VAULT_PATH,
      vaultName: process.env.EXCALIDRAW_TEST_VAULT_NAME,
      userDataPath: process.env.EXCALIDRAW_TEST_USER_DATA_PATH,
      readHostUserData: () =>
        parseCLIJSON(
          cli(
            "eval",
            "code=JSON.stringify(require('@electron/remote').app.getPath('userData'))",
          ),
        ),
    });
  try {
    // No CLI mutation, file creation or restart is allowed before this proof.
    proveIsolation();
    lock = acquireHostLock({
      userDataPath: process.env.EXCALIDRAW_TEST_USER_DATA_PATH,
    });
    proveIsolation();
    const target = validateTarget({
      vaultName: process.env.EXCALIDRAW_TEST_VAULT_NAME,
      vaultPath: process.env.EXCALIDRAW_TEST_VAULT_PATH,
      configDir: process.env.EXCALIDRAW_TEST_CONFIG_DIR,
      automationRoot: process.env.EXCALIDRAW_TEST_AUTOMATION_ROOT,
    });
    assert.ok(
      process.env.EXCALIDRAW_TEST_COMBINATION_PATH,
      "Supply the smoke profile frozen combination.json",
    );
    const combinationPath = resolve(
        process.env.EXCALIDRAW_TEST_COMBINATION_PATH,
      ),
      combination = JSON.parse(readFileSync(combinationPath, "utf8")),
      output = dirname(combinationPath);
    for (const kind of ["fork", "extras", "plugin"]) {
      validateArtifactManifest(combination.manifests[kind], join(output, kind));
      const current = sourceIdentity(combination.roots[kind]);
      for (const key of ["commit", "dirty", "diffHash", "lockfileHash"])
        assert.equal(
          current[key],
          combination.manifests[kind][key],
          "Cold-start source changed since its prerequisite workspace build: " +
            kind +
            " " +
            key,
        );
    }
    report.combination = combination;
    report.source = combination.manifests.plugin;
    const installed = target.pluginDir;
    for (const entry of combination.manifests.plugin.artifacts)
      assert.equal(
        fileHash(join(installed, entry.relativePath.split("/").at(-1))),
        entry.sha256,
        "Cold-start installed artifact mismatch",
      );
    assert.match(
      cli("dev:errors").trim(),
      /^No errors captured\.?$/i,
      "Review existing host errors before cold restart",
    );
    report.originalLayout = parseCLIJSON(
      cli("eval", "code=JSON.stringify(app.workspace.getLayout())"),
    );
    assert.equal(
      parseCLIJSON(
        cli(
          "eval",
          "code=JSON.stringify(!!app.vault.getFileByPath(" +
            JSON.stringify(path) +
            "))",
        ),
      ),
      false,
      "Owned cold fixture already exists",
    );
    const fixture = readFileSync(
      join(root, "tests/vault/Drawings/Uncompressed.excalidraw.md"),
      "utf8",
    );
    started = true;
    created = true;
    writeFileSync(
      join(reportDir, "recovery.json"),
      JSON.stringify(
        {
          path,
          phase: "preparing",
          vaultName: process.env.EXCALIDRAW_TEST_VAULT_NAME,
        },
        null,
        2,
      ),
    );
    await runInAppTask({
      cli,
      args: [path, fixture],
      execute: prepareColdDrawing,
    });
    const readMainPID = () =>
      parseCLIJSON(
        cli(
          "eval",
          "code=JSON.stringify((()=>{const p=app.plugins.plugins['obsidian-excalidraw-plugin'];if(!p?.isReady||!p.getCLIRuntime())return null;return require('@electron/remote').app.getAppMetrics().find(metric=>metric.type==='Browser')?.pid})())",
        ),
      );
    report.restart = await restartIsolatedHost({
      proveIsolation,
      cli,
      readMainPID,
    });
    const evidence = await runInAppTask({
      cli,
      args: [path],
      execute: verifyColdDrawing,
    });
    assert.match(
      cli("dev:errors").trim(),
      /^No errors captured\.?$/i,
      "Cold startup captured JavaScript errors",
    );
    report.status = "passed";
    report.tests.push({
      testId: "native:cold-durable-restoration",
      featureIds: ["P01", "P02", "P03"],
      status: "passed",
      ...evidence,
    });
    report.limitations = [
      "CLI startup error buffer is checked; no pre-initialization CDP stream or physical-device acceptance is claimed",
    ];
  } catch (error) {
    preserve = error.cleanupFailed === true;
    report.status = started ? "failed" : "blocked";
    report.error = String(error.stack || error);
    report.tests.push({
      testId: "native:cold-durable-restoration",
      featureIds: ["P01", "P02", "P03"],
      status: report.status,
      reason: report.error,
    });
  } finally {
    if (preserve) {
      report.cleanup = "failed";
      report.cleanupError =
        "Unsettled cold-start task; preserve exact journaled fixture for recovery";
    } else if (created) {
      try {
        proveIsolation();
        await runInAppTask({
          cli,
          args: [path, report.originalLayout],
          execute: cleanupColdDrawing,
        });
      } catch (error) {
        report.status = "failed";
        report.cleanup = "failed";
        report.cleanupError = String(error);
      }
    }
    lock?.release();
    writeFileSync(
      join(reportDir, "report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    writeReportFiles(report, reportDir);
  }
  process.stdout.write(
    `Isolated cold-start lane: ${report.status}; cleanup: ${report.cleanup}\n`,
  );
  if (report.status !== "passed") process.exitCode = 1;
}
