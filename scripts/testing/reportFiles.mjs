/** Human and CI views of the same evidence; no independently computed success. */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
const xml = value => String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
export function renderJUnit(report) {
  const unsuccessful = report.tests.filter(test => test.status !== "passed");
  const cases = report.tests.map(test => `<testcase classname="${xml(report.suiteId)}" name="${xml(test.testId)}" time="${(test.durationMs || 0) / 1000}">${test.status === "passed" ? "" : `<failure type="${xml(test.status)}" message="${xml(test.reason || test.status)}">${xml(test.reason || test.status)}</failure>`}</testcase>`);
  // A required blocked case is deliberately a failure, never a skipped green job.
  if (report.status !== "passed" && !unsuccessful.length) cases.push(`<testcase classname="${xml(report.suiteId)}" name="suite-gate"><failure>${xml(report.error || report.cleanupError || "Suite, discovery or cleanup gate failed")}</failure></testcase>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites><testsuite name="${xml(report.suiteId)}" tests="${cases.length}" failures="${unsuccessful.length + (cases.length > report.tests.length ? 1 : 0)}">${cases.join("\n")}</testsuite></testsuites>\n`;
}
export function writeReportFiles(report, output) {
  writeFileSync(join(output, "junit.xml"), renderJUnit(report));
  const counts = Object.fromEntries(["passed", "failed", "blocked", "notApplicable"].map(status => [status, report.tests.filter(test => test.status === status).length]));
  writeFileSync(join(output, "summary.txt"), `${report.suiteId}: ${report.status}\nCleanup: ${report.cleanup}\n${JSON.stringify(counts)}\n` + report.tests.filter(test => test.status !== "passed").map(test => `${test.testId}: ${test.status}\n${test.reason || "No reason supplied"}`).join("\n") + "\n");
}
