/** Discover every repository-owned Node test, preserve focused npm entry points. */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { walkFiles, sourceIdentity } from "./contracts.mjs";
import { verifySeed } from "./provision.mjs";
import { verifyCoverageRatchets } from "./coverageGate.mjs";
import { writeReportFiles } from "./reportFiles.mjs";
import { productionModules } from "./sourceInventory.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const coverage = process.argv.includes("--coverage");
const reportDir = resolve(process.env.EXCALIDRAW_TEST_REPORT_DIR || join(root, `.test-work/reports/${coverage ? "coverage" : "fast"}`));
const seed=verifySeed(), source=sourceIdentity(root);
const files = ["scripts/testing", "tests"].flatMap(path => walkFiles(join(root, path)).filter(file => file.endsWith(".test.mjs")).map(file => `${path}/${file}`));
if (!files.length) throw Error("Zero discovered Node tests");
mkdirSync(reportDir, { recursive: true });
const reportPath = join(reportDir, "report.json");
// Separate measured whole-module tests from historical VM/extraction harnesses.
const selected = coverage ? files.filter(file => file.endsWith(".source.test.mjs") || [
  "scripts/testing/settings/settingsWriter.test.mjs", "tests/markdownImageGeometry.test.mjs", "tests/markdownImageCache.test.mjs", "tests/markdownImageMetadata.test.mjs",
].includes(file)) : files;
const args = ["--experimental-transform-types", "--enable-source-maps", "--test", "--test-concurrency=4",
  "--test-reporter=dot", "--test-reporter=./scripts/testing/reporter.mjs", "--test-reporter-destination=stdout", `--test-reporter-destination=${reportPath}`,
  ...selected];
const coverageArgs = coverage ? [join(root, "node_modules/c8/bin/c8.js"), "--exclude-after-remap", "--include=src/**", "--exclude=src/**/*.d.ts",
  "--reporter=json", "--reporter=json-summary", "--reporter=lcov", "--reporter=html", `--reports-dir=${join(reportDir, "source")}`,
  `--temp-directory=${join(reportDir, "raw-" + randomUUID())}`, process.execPath, ...args] : args;
const result = spawnSync(process.execPath, coverageArgs, { cwd: root, stdio: "inherit", windowsHide: true,
  env: { ...process.env, EXCALIDRAW_TEST_REPORT_DIR: reportDir, EXCALIDRAW_TEST_SUITE_ID: coverage?'plugin-source-coverage':'plugin-fast' }, timeout: 300_000 });
if (result.error) throw result.error;
const report = JSON.parse(readFileSync(reportPath, "utf8"));
report.source=source;report.fixtureManifestHash=seed.seedHash;
report.requestedProfile=coverage?'source-coverage':'fast';report.actualProfile=report.requestedProfile;
if(JSON.stringify(sourceIdentity(root))!==JSON.stringify(source)){report.status='failed';report.error='Plugin source changed during the test run';}
const executed = new Set(report.tests.map(t => t.sourcePath));
const missing = selected.filter(file => !executed.has(file));
if (missing.length) { report.status = "failed"; report.missingFiles = missing; }
report.discovery = { files: selected, discovered: selected.length, executed: executed.size, excludedFromSourceCoverage: files.filter(file => !selected.includes(file)) };
if (coverage) {
  const summary = JSON.parse(readFileSync(join(reportDir, "source/coverage-summary.json"), "utf8"));
  report.coverage = { engine: "c8", version: JSON.parse(readFileSync(join(root, "node_modules/c8/package.json"), "utf8")).version,
    totals: summary.total, files: Object.entries(summary).filter(([path]) => path !== "total").map(([path, value]) => ({
      path: path.replaceAll("\\", "/").startsWith(root.replaceAll("\\", "/") + "/") ? path.replaceAll("\\", "/").slice(root.length + 1) : path,
      coveredLinePercent: value.lines.pct, coveredBranchPercent: value.branches.pct, coveredFunctionPercent: value.functions.pct,
      lines: value.lines, branches: value.branches, functions: value.functions,
    })) };
  const measured = new Set((report.coverage?.files || []).map(file => resolve(root, file.path)));
  const modules = productionModules(root);
  report.excludedTypeOnlyModules = modules.typeOnly;
  report.unexecutedProductionModules = modules.runtime.filter(file => !measured.has(resolve(root, file)));
  report.coverageLimitations = "Whole production modules are source-mapped before merging isolated compiled graphs. Historical extracted copies have no original-source credit. Native/built payload coverage is separate.";
  try { verifyCoverageRatchets(report.coverage, JSON.parse(readFileSync(join(root, "tests/coverage-ratchets.json"), "utf8"))); report.coverageGate = "passed"; }
  catch (error) { report.status = "failed"; report.coverageGate = "failed"; report.error = error.message; }
}
if (new Set(report.tests.map(test => test.testId)).size !== report.tests.length) { report.status = "failed"; report.error = "Duplicate Node test identities"; }
writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
writeReportFiles(report, reportDir);
process.stdout.write(`\n${report.tests.length} tests in ${selected.length} files: ${report.status}; ${reportPath}\n`);
process.exitCode = result.status !== 0 || report.status !== "passed" ? 1 : 0;
