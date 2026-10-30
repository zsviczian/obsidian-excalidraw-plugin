import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { auditAcceptance } from "./acceptance.mjs";
const registry = () =>
  JSON.parse(
    readFileSync(new URL("../../tests/features.json", import.meta.url)),
  );
const suite = (tests) => ({
  schemaVersion: 2,
  suiteId: "canonical",
  status: "passed",
  cleanup: "passed",
  source: {
    commit: "a".repeat(40),
    dirty: false,
    diffHash: "b".repeat(64),
    lockfileHash: "c".repeat(64),
  },
  tests,
});
test("acceptance cannot substitute discovered files or green subsets for required executed cases", () => {
  const r = registry(),
    report = suite([{ testId: "unrelated", status: "passed" }]);
  const result = auditAcceptance(r, [report]);
  assert.equal(result.status, "failed");
  assert.ok(result.missing.length > 0);
  assert.equal(result.features[0].status, "failed");
  assert.throws(() => auditAcceptance(r, [report, report]), /Duplicate/);
});
test("coverage and soak gates do not double-count canonical identities or hide failed cleanup", () => {
  const r = registry();
  r.features.forEach((f) => (f.remaining = []));
  r.requiredSuites = ["canonical"];
  r.requiredGates = ["overlapping-coverage"];
  const cases = [
    ...new Set(r.features.flatMap((f) => f.tests.flatMap((t) => t.cases))),
  ].map((testId) => ({ testId, status: "passed" }));
  const report = suite(cases),
    gate = {
      ...report,
      suiteId: "overlapping-coverage",
      coverageGate: "passed",
    };
  const passed = auditAcceptance(r, [report], [gate]);
  assert.equal(passed.status, "passed");
  assert.equal(passed.tests.length, cases.length);
  assert.equal(
    auditAcceptance(r, [report], [{ ...gate, cleanup: "failed" }]).status,
    "failed",
  );
  assert.equal(
    auditAcceptance(r, [report], []).status,
    "failed",
    "Required coverage cannot disappear",
  );
  assert.equal(
    auditAcceptance(
      r,
      [report],
      [{ ...gate, source: { ...gate.source, commit: "d".repeat(40) } }],
    ).status,
    "failed",
    "Stale-source coverage cannot pass",
  );
  r.features[0].remaining = ["Required isolated cold start not available"];
  assert.equal(
    auditAcceptance(r, [report], [gate]).features[0].status,
    "blocked",
  );
});
