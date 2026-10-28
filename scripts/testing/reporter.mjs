/** Node test events -> schema-2 evidence. Does not infer native feature coverage. */
import { relative } from "node:path";
export default async function* reporter(source) {
  const tests = [], diagnostics = []; let coverage;
  for await (const event of source) {
    if (["test:pass", "test:fail"].includes(event.type) && event.data.details?.type !== "suite") {
      const { name, file, line, details, skip, todo } = event.data;
      const sourcePath = file ? relative(process.cwd(), file).replaceAll("\\", "/") : "unknown";
      tests.push({ testId: `node:${sourcePath}::${name}`, featureIds: [], sourcePath, sourceLine: line, name,
        status: skip || todo ? "blocked" : event.type === "test:pass" ? "passed" : "failed",
        ...(event.type === "test:fail" || skip || todo ? { reason: String(details?.error?.stack || skip || todo || "Test failed") } : {}),
        durationMs: details?.duration_ms ?? 0 });
    }
    if (event.type === "test:coverage") coverage = { ...event.data.summary, files: event.data.summary.files.map(file => ({ ...file, path: relative(process.cwd(), file.path).replaceAll("\\", "/") })) };
    if (event.type === "test:diagnostic") diagnostics.push(event.data.message);
  }
  yield JSON.stringify({ schemaVersion: 2, suiteId: process.env.EXCALIDRAW_TEST_SUITE_ID || "plugin-fast", status: tests.length && tests.every(t => t.status === "passed") ? "passed" : "failed",
    cleanup: "passed", toolchain: { node: process.version, platform: process.platform }, tests, coverage, diagnostics }, null, 2) + "\n";
}
