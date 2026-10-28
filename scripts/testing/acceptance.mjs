/** Join canonical executed suites once; overlapping coverage/soak reports are gates. */
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { aggregateReports, adaptSmokeReport } from "./contracts.mjs";
import { validateFeatures, projectRoot } from "./features.mjs";
import { writeReportFiles } from "./reportFiles.mjs";
export function auditAcceptance(registry, reports, gateReports = []) {
  validateFeatures(registry);
  const normalized = reports.map((r) =>
    r.schemaVersion === 1 ? adaptSmokeReport(r) : r,
  );
  const required = [
    ...new Set(
      registry.features.flatMap((f) => f.tests.flatMap((test) => test.cases)),
    ),
  ];
  const aggregate = aggregateReports(normalized, required);
  const all = [...normalized, ...gateReports];
  const missingSuites = (registry.requiredSuites || []).filter(
    (id) => !normalized.some((r) => r.suiteId === id),
  );
  const missingGates = (registry.requiredGates || []).filter(
    (id) => !gateReports.some((r) => r.suiteId === id),
  );
  const identities = new Map(),
    provenanceErrors = [];
  const observe = (producer, identity, label) => {
    if (!identity?.commit || !identity.diffHash || !identity.lockfileHash) {
      provenanceErrors.push(label + ": missing exact source identity");
      return;
    }
    const value = JSON.stringify(
      Object.fromEntries(
        ["commit", "dirty", "diffHash", "lockfileHash"].map((key) => [
          key,
          identity[key],
        ]),
      ),
    );
    if (identities.has(producer) && identities.get(producer) !== value)
      provenanceErrors.push(
        label + ": source differs from the canonical " + producer + " reports",
      );
    else identities.set(producer, value);
  };
  for (const report of all) {
    const producer = report.suiteId.startsWith("fork-")
      ? "fork"
      : report.suiteId.startsWith("extras-")
        ? "extras"
        : "plugin";
    const identity =
      report.legacy?.combination?.manifests.plugin ||
      report.combination?.manifests.plugin ||
      report.source;
    observe(producer, identity, report.suiteId);
    for (const [kind, manifest] of Object.entries(
      report.legacy?.combination?.manifests ||
        report.combination?.manifests ||
        {},
    ))
      observe(kind, manifest, report.suiteId + " frozen " + kind);
  }
  const features = registry.features.map((feature) => {
    const cases = [...new Set(feature.tests.flatMap((test) => test.cases))];
    const missing = cases.filter(
      (id) => !aggregate.tests.some((t) => t.testId === id),
    );
    const nonpassing = aggregate.tests.filter(
      (t) => cases.includes(t.testId) && t.status !== "passed",
    );
    return {
      featureId: feature.id,
      status:
        missing.length || nonpassing.length
          ? "failed"
          : feature.remaining.length
            ? "blocked"
            : "passed",
      cases,
      missing,
      nonpassing: nonpassing.map((t) => ({
        testId: t.testId,
        status: t.status,
        reason: t.reason,
      })),
      remaining: feature.remaining,
    };
  });
  // Coverage repeats canonical Node test IDs; it must never inflate discovery.
  const gates = gateReports.map((r) => ({
    suiteId: r.suiteId,
    status: r.status,
    cleanup: r.cleanup,
    coverageGate: r.coverageGate,
    source: r.source,
  }));
  const badGates = gateReports.filter(
    (r) =>
      r.status !== "passed" ||
      r.cleanup !== "passed" ||
      !r.tests?.length ||
      r.coverageGate === "failed",
  );
  const acceptanceProblems = [
    ...missingSuites.map((id) => "Missing suite: " + id),
    ...missingGates.map((id) => "Missing quality gate: " + id),
    ...provenanceErrors,
    ...features
      .filter((f) => f.status !== "passed")
      .map((f) => f.featureId + ": " + f.status),
  ];
  return {
    ...aggregate,
    failedSuites: [
      ...(aggregate.failedSuites || []),
      ...badGates.map((r) => ({
        suiteId: r.suiteId,
        reason:
          r.error || r.cleanupError || "Required quality gate did not pass",
      })),
      ...(acceptanceProblems.length
        ? [
            {
              suiteId: "acceptance-gates",
              reason: acceptanceProblems.join("; "),
            },
          ]
        : []),
    ],
    suiteId: "feature-acceptance",
    status:
      aggregate.status === "passed" &&
      features.every((f) => f.status === "passed") &&
      !badGates.length &&
      !missingSuites.length &&
      !missingGates.length &&
      !provenanceErrors.length
        ? "passed"
        : "failed",
    features,
    gates,
    missingSuites,
    missingGates,
    provenanceErrors,
    reports: normalized.map((r) => ({
      suiteId: r.suiteId,
      status: r.status,
      cleanup: r.cleanup,
      source: r.source,
    })),
    error:
      "Acceptance includes required cases, all suite/error/cleanup gates, and explicit remaining obligations. A passing family mapping does not cover every public API entry.",
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2),
    outputArg = args.find((arg) => arg.startsWith("--output="));
  assert.ok(
    args.every(
      (arg) =>
        arg.startsWith("--report=") ||
        arg.startsWith("--gate=") ||
        arg.startsWith("--output="),
    ),
    "Use --report=JSON --gate=JSON --output=DIR",
  );
  const read = (prefix) =>
    args
      .filter((arg) => arg.startsWith(prefix))
      .map((arg) =>
        JSON.parse(readFileSync(resolve(arg.slice(prefix.length)), "utf8")),
      );
  let result;
  try {
    result = auditAcceptance(
      JSON.parse(readFileSync(join(projectRoot, "tests/features.json"))),
      read("--report="),
      read("--gate="),
    );
  } catch (error) {
    result = {
      schemaVersion: 2,
      suiteId: "feature-acceptance",
      status: "failed",
      cleanup: "not-started",
      missing: [],
      error: String(error.stack || error),
      tests: [
        {
          testId: "acceptance-inputs",
          status: "failed",
          reason: String(error),
        },
      ],
    };
  }
  const output = resolve(
    outputArg?.slice(9) || join(projectRoot, ".test-work/reports/acceptance"),
  );
  mkdirSync(output, { recursive: true });
  writeFileSync(
    join(output, "report.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  writeReportFiles(result, output);
  process.stdout.write(
    `Feature acceptance: ${result.status}; ${result.tests.length} canonical cases; ${result.missing.length} required cases missing\n`,
  );
  if (result.status !== "passed") process.exitCode = 1;
}
