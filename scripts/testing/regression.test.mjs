import assert from "node:assert/strict";
import test from "node:test";
import {
  auditRegression,
  requiredNativeCases,
  requiredDeviceCases,
} from "./regression.mjs";

const suite = (
  suiteId,
  tests = [{ testId: suiteId + ":case", status: "passed" }],
) => ({
  schemaVersion: 2,
  suiteId,
  status: "passed",
  cleanup: "passed",
  tests,
});
const fixture = () => ({
  reports: [
    "plugin-fast",
    "fork-owned",
    "fork-browser",
    "extras-source",
    "extras-browser",
  ].map((name) => suite(name)),
  gates: ["plugin-source-coverage", "fork-package", "extras-package"].map(
    (name) => suite(name),
  ),
});
test("portable regression requires independent suites and never substitutes an upstream result", () => {
  const { reports, gates } = fixture();
  assert.equal(
    auditRegression(reports, gates, { native: false }).status,
    "passed",
  );
  assert.throws(
    () =>
      auditRegression(
        [
          ...reports.filter((r) => r.suiteId !== "fork-owned"),
          suite("fork-inherited"),
        ],
        gates,
        { native: false },
      ),
    /suite missing/,
  );
  assert.throws(
    () => auditRegression(reports.slice(1), gates, { native: false }),
    /suite missing/,
  );
});
test("a native regression cannot pass without every declared CLI and EA case", () => {
  const { reports, gates } = fixture();
  assert.throws(() => auditRegression(reports, gates), /suite missing/);
  const native = suite(
    "native-obsidian",
    requiredNativeCases.map((testId) => ({ testId, status: "passed" })),
  );
  const devices = suite(
    "native-devices",
    requiredDeviceCases.map((testId) => ({ testId, status: "passed" })),
  );
  assert.equal(
    auditRegression([...reports, native, devices], gates).status,
    "passed",
  );
  native.tests.pop();
  assert.equal(
    auditRegression([...reports, native, devices], gates).status,
    "failed",
  );
});
test("unexpected errors, cleanup and coverage failures keep regression red", () => {
  const { reports, gates } = fixture();
  const failed = {
    ...reports[0],
    status: "failed",
    error: "Unhandled exception",
  };
  assert.equal(
    auditRegression([failed, ...reports.slice(1)], gates, { native: false })
      .status,
    "failed",
  );
  for (const failure of [{ cleanup: "failed" }, { coverageGate: "failed" }]) {
    const result = auditRegression(
      reports,
      [{ ...gates[0], ...failure }, ...gates.slice(1)],
      { native: false },
    );
    assert.equal(result.status, "failed");
  }
});
