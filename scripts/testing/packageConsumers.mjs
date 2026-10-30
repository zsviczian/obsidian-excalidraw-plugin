/** Explicit adapter for the independent producers' packed-consumer evidence. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { sourceIdentity, ownedPath } from "./contracts.mjs";
import { writeReportFiles } from "./reportFiles.mjs";
export function runPackageConsumer({ root, kind, reportDir }) {
  assert.ok(["fork", "extras"].includes(kind));
  root = resolve(root);
  reportDir = resolve(reportDir);
  mkdirSync(reportDir, { recursive: true });
  const source = sourceIdentity(root),
    report = {
      schemaVersion: 2,
      suiteId: kind + "-package",
      status: "failed",
      cleanup: "passed",
      source,
      tests: [],
    };
  try {
    const script = ownedPath(
      root,
      kind === "fork"
        ? "tests/obsidian/packageConsumer.mjs"
        : "scripts/testing/packageConsumer.mjs",
    );
    const result = spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      timeout: 300000,
      maxBuffer: 8 * 1024 * 1024,
    });
    writeFileSync(
      join(reportDir, "consumer.log"),
      (result.stdout || "") + (result.stderr || ""),
    );
    assert.ok(!result.error, result.error?.message);
    assert.equal(
      result.status,
      0,
      "Independent packed consumer failed; see consumer.log",
    );
    assert.deepEqual(
      sourceIdentity(root),
      source,
      "Producer source changed during consumer verification",
    );
    const match = result.stdout.match(
      /Packed (?:fork|Extras API) consumer passed: (.+)/,
    );
    assert.ok(match, "Missing independent consumer evidence");
    const work = resolve(match[1].trim()),
      relativeWork = relative(root, work).split(sep).join("/");
    assert.ok(
      relativeWork.startsWith(".test-work/consumers/"),
      "Unexpected consumer evidence location",
    );
    const evidence = JSON.parse(
      readFileSync(ownedPath(root, relativeWork + "/evidence.json"), "utf8"),
    );
    assert.equal(evidence.status, "passed");
    assert.ok(
      evidence.sha512 && evidence.files > 0 && evidence.consumer,
      "Incomplete tarball/declaration evidence",
    );
    report.evidence = evidence;
    report.status = "passed";
    report.tests.push({
      testId: kind + ":packed-consumer",
      featureIds: ["P01", "P09", "P10"],
      status: "passed",
      assertions: [
        "independent isolated install of the actual packed package",
        "generated declarations accept supported calls and reject invalid inputs",
        "packed files and integrity inspected",
        "producer source stable",
      ],
    });
  } catch (error) {
    report.error = String(error.stack || error);
    report.tests.push({
      testId: kind + ":packed-consumer",
      featureIds: ["P01"],
      status: "failed",
      reason: report.error,
    });
  }
  writeFileSync(
    join(reportDir, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  writeReportFiles(report, reportDir);
  return report;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  let failed = false;
  for (const kind of ["fork", "extras"]) {
    const producerRoot = resolve(
      process.env[
        kind === "fork" ? "EXCALIDRAW_FORK_ROOT" : "EXCALIDRAW_EXTRAS_ROOT"
      ] ||
        join(
          root,
          kind === "fork" ? "../excalidraw" : "../obsidian-excalidraw-extras",
        ),
    );
    const report = runPackageConsumer({
      root: producerRoot,
      kind,
      reportDir: join(root, ".test-work/reports/package-" + kind),
    });
    process.stdout.write(`${report.suiteId}: ${report.status}\n`);
    if (report.status !== "passed") failed = true;
  }
  if (failed) process.exitCode = 1;
}
