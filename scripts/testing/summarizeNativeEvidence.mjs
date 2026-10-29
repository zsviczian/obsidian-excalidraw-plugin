/** Export small, sanitized, reviewable evidence; refuses incomplete or mismatched native repeats. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { aggregateReports, adaptSmokeReport, sha256 } from "./contracts.mjs";
import { requiredNativeCases, requiredDeviceCases } from "./regression.mjs";
import { behavioralCases } from "./behaviorPlan.mjs";

export function summarizeNativeRun(directory) {
  const read = (name) =>
    JSON.parse(readFileSync(join(directory, name), "utf8"));
  const native = read("report.json"),
    devices = read("devices/report.json"),
    preparation = read("preparation.json"),
    oracle = read("error-oracle/report.json");
  const required = [...requiredNativeCases, ...requiredDeviceCases];
  const aggregate = aggregateReports(
    [adaptSmokeReport(native), devices],
    required,
  );
  assert.equal(
    aggregate.status,
    "passed",
    "Required native acceptance is incomplete",
  );
  assert.equal(
    native.baselineRestoration?.restored,
    true,
    "Baseline was not restored",
  );
  assert.equal(oracle.status, "passed");
  assert.equal(oracle.cleanup, "passed");
  assert.ok(
    oracle.tests.some(
      (test) =>
        test.testId === "native:diagnostics-rejects-broken-layout" &&
        test.status === "passed",
    ),
  );
  const manifests = Object.fromEntries(
    Object.entries(native.combination.manifests).map(([kind, m]) => {
      assert.equal(m.dirty, false, kind + " revision must be clean");
      return [
        kind,
        {
          repository: m.repository,
          commit: m.commit,
          diffHash: m.diffHash,
          lockfileHash: m.lockfileHash,
          buildCommand: m.buildCommand,
          toolchain: m.toolchain,
          artifacts: m.artifacts,
        },
      ];
    }),
  );
  assert.deepEqual(Object.keys(manifests).sort(), ["extras", "fork", "plugin"]);
  assert.deepEqual(
    native.artifacts.sourceHashes,
    native.artifacts.installedHashes,
  );
  assert.equal(preparation.target.vaultName, "excalidraw-auto-test");
  const cases = aggregate.tests.map((test) => ({
    testId: test.testId,
    status: test.status,
    featureIds: test.featureIds,
    assertions: test.assertions,
    evidenceKind: test.evidenceKind,
    transport: test.transport,
    actual: test.actual,
    decoded: test.decoded,
    pdfPixels: test.pdfPixels,
    markdownPixels: test.markdownPixels,
    reopened: test.reopened,
    sourceKinds: test.sourceKinds,
  }));
  const notifications = [
    ...(native.windowErrors || []),
    ...devices.tests.flatMap((test) => test.windowEvents || []),
  ];
  const counts = {
    required: required.length,
    executed: cases.length,
    behavioral: behavioralCases().length,
    nativeCLI: cases.filter(
      (test) =>
        test.evidenceKind === "native-cli-commands" ||
        test.testId === "native-cli-authoring" ||
        test.testId === "lucide-3019",
    ).length,
    mobileEA: cases.filter((test) => test.evidenceKind === "in-process-ea-cli")
      .length,
  };
  const workflow = native.scenarios.find((s) => s.id === "workflow-fixes-3020");
  const extras = native.scenarios.find((s) => s.id === "extras-services");
  return {
    schemaVersion: 1,
    status: aggregate.status,
    environment: native.capabilities,
    canonicalTarget: native.target,
    startedAt: native.startedAt,
    completedAt: native.completedAt,
    vault: ".test-work/vaults/excalidraw-auto-test/",
    counts,
    manifests,
    installed: preparation.installations,
    baselineRestoration: native.baselineRestoration,
    deviceRestoration: devices.restoration,
    diagnostics: {
      count: notifications.length,
      events: notifications,
      settlingChecks: native.scenarios.map((s) => ({
        id: s.id,
        result: s.settlingCheck,
      })),
      finalIdle: native.cleanupIdle,
      deviceIdle: devices.tests
        .filter((t) => t.browserIdle)
        .map((t) => ({ id: t.testId, result: t.browserIdle })),
    },
    negativeControls: oracle.tests,
    deviceMeasurements: devices.tests
      .filter((test) => test.actual)
      .map((test) => ({
        testId: test.testId,
        requested: test.requested,
        actual: test.actual,
      })),
    canvas: workflow?.canvas,
    pdf: extras?.tests?.find((t) => t.testId === "native:extras-pdf-output"),
    cases,
    limitations: devices.limitations,
  };
}

function sanitize(value, roots) {
  if (Array.isArray(value)) return value.map((item) => sanitize(item, roots));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, sanitize(item, roots)]),
    );
  if (typeof value !== "string") return value;
  let text = value.replaceAll("\\", "/");
  for (const [root, label] of roots)
    text = text.replaceAll(root.replaceAll("\\", "/"), label);
  text = text.replace(/[A-Za-z]:\/Users\/[^/\s"']+/g, "<user>");
  return text;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  assert.equal(
    process.argv.length,
    4,
    "Use: node scripts/testing/summarizeNativeEvidence.mjs <first-run-directory> <second-run-directory>",
  );
  const project = resolve(fileURLToPath(new URL("../..", import.meta.url))),
    output = join(project, "docs/testing-evidence/3022");
  const runs = process.argv
    .slice(2)
    .map((path) => summarizeNativeRun(resolve(path)));
  assert.deepEqual(
    runs[0].manifests,
    runs[1].manifests,
    "Native repeats used different revisions/artifacts",
  );
  const roots = [
    [project, "<plugin>"],
    [resolve(project, "../excalidraw"), "<fork>"],
    [resolve(project, "../obsidian-excalidraw-extras"), "<extras>"],
  ];
  mkdirSync(output, { recursive: true });
  const files = runs.map((run, i) => {
    const name = "native-repeat-" + (i + 1) + ".json",
      text = JSON.stringify(sanitize(run, roots), null, 2) + "\n";
    writeFileSync(join(output, name), text);
    return { name, sha256: sha256(text), bytes: Buffer.byteLength(text) };
  });
  writeFileSync(
    join(output, "manifest.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        vault: ".test-work/vaults/excalidraw-auto-test/",
        testedRevisions: Object.fromEntries(
          Object.entries(runs[0].manifests).map(([kind, m]) => [
            kind,
            m.commit,
          ]),
        ),
        files,
      },
      null,
      2,
    ) + "\n",
  );
  process.stdout.write(
    "Sanitized native evidence written to " + relative(project, output) + "\n",
  );
}
