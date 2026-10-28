/** Discover every repository-owned Node test, preserve focused npm entry points. */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { walkFiles } from "./contracts.mjs";
import { verifySeed } from "./provision.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const reportDir = resolve(process.env.EXCALIDRAW_TEST_REPORT_DIR || join(root, ".test-work/reports/fast"));
verifySeed();
const files = ["scripts/testing", "tests"].flatMap(path => walkFiles(join(root, path)).filter(file => file.endsWith(".test.mjs")).map(file => `${path}/${file}`));
if (!files.length) throw Error("Zero discovered Node tests");
mkdirSync(reportDir, { recursive: true });
const reportPath = join(reportDir, "report.json"), coverage = process.argv.includes("--coverage");
// Separate measured whole-module tests from historical VM/extraction harnesses.
const selected = coverage ? files.filter(file => file.endsWith(".source.test.mjs") || [
  "scripts/testing/settings/settingsWriter.test.mjs", "tests/markdownImageGeometry.test.mjs", "tests/markdownImageCache.test.mjs", "tests/markdownImageMetadata.test.mjs",
].includes(file)) : files;
const args = ["--experimental-transform-types", "--enable-source-maps", "--test", "--test-concurrency=4",
  "--test-reporter=dot", "--test-reporter=./scripts/testing/reporter.mjs", "--test-reporter-destination=stdout", `--test-reporter-destination=${reportPath}`,
  ...(coverage ? ["--experimental-test-coverage", "--test-coverage-include=src/**"] : []), ...selected];
const result = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit", windowsHide: true,
  env: { ...process.env, EXCALIDRAW_TEST_REPORT_DIR: reportDir }, timeout: 300_000 });
if (result.error) throw result.error;
const report = JSON.parse(readFileSync(reportPath, "utf8"));
const executed = new Set(report.tests.map(t => t.sourcePath));
const missing = selected.filter(file => !executed.has(file));
if (missing.length) { report.status = "failed"; report.missingFiles = missing; }
report.discovery = { files: selected, discovered: selected.length, executed: executed.size, excludedFromSourceCoverage: files.filter(file => !selected.includes(file)) };
if (coverage) {
  const measured = new Set((report.coverage?.files || []).map(file => resolve(root, file.path)));
  report.unexecutedProductionModules = walkFiles(join(root, "src")).filter(file => /\.(ts|tsx)$/.test(file) && !/\.d\.ts$/.test(file)).map(file => `src/${file}`).filter(file => !measured.has(resolve(root, file)));
  report.coverageLimitations = "Only modules executed as original files are measured. Extracted/transpiled copies have no original-source credit. Native/built payload coverage is separate.";
}
writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
process.stdout.write(`\n${report.tests.length} tests in ${selected.length} files: ${report.status}; ${reportPath}\n`);
process.exitCode = result.status !== 0 || report.status !== "passed" ? 1 : 0;
