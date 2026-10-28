/** Independent current-product regression baseline; never invokes upstream tests. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { aggregateReports, sourceIdentity } from "./contracts.mjs";
import { writeReportFiles } from "./reportFiles.mjs";
import { packageManagerInvocation } from "./host/processTools.mjs";
import { runPackageConsumer } from "./packageConsumers.mjs";
import { deviceProfiles, breakpointProfiles } from "./host/deviceProfiles.mjs";

export const requiredDeviceCases = [
  ...deviceProfiles(),
  ...breakpointProfiles(),
].map((profile) => "native:device:" + profile.id);

export const requiredNativeCases = [
  "plugin-load",
  "drawing-main-window",
  "javascript-errors",
  "source-stability",
  "native:lifecycle-two-split-fullscreen",
  "native:lifecycle-dirty-main-to-popout",
  "native:lifecycle-dirty-popout-to-main",
  "native:lifecycle-new-popout-survivor",
  "native:lifecycle-plugin-reload",
  "workflow-fixes-3020",
  "lucide-3019",
  "wheel-zoom-3008",
  "image-geometry-real-3014",
  "web-drop-2967",
  "internal-drop-tooltip",
  "text-undo-2976",
  "markdown-embed-recovery-2953",
  "grouped-link-click",
  "latex-input-2970",
  "native:extras-mathjax-gateway",
  "native:extras-mermaid-gateway",
  "native:extras-pdf-output",
  "native:data-roundtrip:Uncompressed.excalidraw.md",
  "native:data-roundtrip:Compressed.excalidraw.md",
  "native:data-roundtrip:Legacy.excalidraw",
  "native:data-backup",
  "native:data-external-change",
  "native:data-write-failure",
  "native:data-rename-delete",
  "native-cli-authoring",
  "native:ea-shapes-bindings-and-isolation",
  "native:ea-edit-image-and-decoded-export",
  "native:ea-svg-import-and-disposal",
  "native:core-toolbar-draw-history",
  "native:core-custom-highlighter",
  "native:core-eraser-and-undo",
  "native:core-laser-transient",
  "native:pdf-reference-and-decoded-content",
  ...Array.from({ length: 6 }, (_, i) => "native:stability-roundtrip:" + i),
];

export function auditRegression(reports, gates, { native = true } = {}) {
  const required = [
    "plugin-fast",
    "fork-owned",
    "fork-browser",
    "extras-source",
    "extras-browser",
    ...(native ? ["native-obsidian", "native-devices"] : []),
  ];
  const requiredGates = [
    "plugin-source-coverage",
    "fork-package",
    "extras-package",
  ];
  assert.deepEqual(
    reports.map((r) => r.suiteId).sort(),
    required.sort(),
    "Required regression suite missing or duplicated",
  );
  assert.deepEqual(
    gates.map((r) => r.suiteId).sort(),
    requiredGates.sort(),
    "Required regression gate missing or duplicated",
  );
  const result = aggregateReports(
    reports,
    native ? [...requiredNativeCases, ...requiredDeviceCases] : [],
  );
  const failedGates = gates.filter(
    (r) =>
      r.status !== "passed" ||
      r.cleanup !== "passed" ||
      !r.tests?.length ||
      r.coverageGate === "failed",
  );
  result.suiteId = "core-regression";
  result.profile = native ? "portable-and-native-core" : "portable";
  result.gates = gates.map((r) => ({
    suiteId: r.suiteId,
    status: r.status,
    cleanup: r.cleanup,
  }));
  if (failedGates.length) {
    result.status = "failed";
    result.failedSuites.push(
      ...failedGates.map((r) => ({
        suiteId: r.suiteId,
        reason: r.error || "Quality gate failed",
      })),
    );
  }
  result.scope =
    "Independent fork contracts and affected editing workflows; plugin fixtures/source tests, built renderers, package contracts, native CLI/EA authoring, main/popout lifecycle and 40 device/layout cases. Isolated restart and physical devices need separate environments; see TESTING_FINDINGS_3022.md.";
  return result;
}

async function main() {
  assert.ok(
    process.argv.slice(2).every((arg) => arg === "--portable"),
    "Use --portable or no options",
  );
  const native = !process.argv.includes("--portable");
  if (native)
    for (const key of [
      "EXCALIDRAW_TEST_VAULT_NAME",
      "EXCALIDRAW_TEST_VAULT_PATH",
      "EXCALIDRAW_TEST_CONFIG_DIR",
    ])
      assert.ok(
        process.env[key],
        "Set " + key + " for the dedicated native test vault",
      );
  const plugin = resolve(import.meta.dirname, "../..");
  const roots = {
    plugin,
    fork: resolve(
      process.env.EXCALIDRAW_FORK_ROOT || join(plugin, "../excalidraw"),
    ),
    extras: resolve(
      process.env.EXCALIDRAW_EXTRAS_ROOT ||
        join(plugin, "../obsidian-excalidraw-extras"),
    ),
  };
  const output = resolve(
    process.env.EXCALIDRAW_TEST_REPORT_DIR ||
      join(plugin, ".test-work/reports/regression-" + randomUUID()),
  );
  mkdirSync(output, { recursive: true });
  let phase = "source-identity";
  try {
    const before = Object.fromEntries(
      Object.entries(roots).map(([key, root]) => [key, sourceIdentity(root)]),
    );
    const reports = [],
      gates = [];
    const run = (name, kind, manager, args, reportFile, gate = false) => {
      phase = name;
      const directory = join(output, name);
      mkdirSync(directory, { recursive: true });
      const invocation = packageManagerInvocation(manager, args),
        fd = openSync(join(directory, "command.log"), "w");
      process.stdout.write("Running " + name + "\n");
      let result;
      try {
        result = spawnSync(invocation.file, invocation.args, {
          cwd: roots[kind],
          env: {
            ...process.env,
            EXCALIDRAW_FORK_ROOT: roots.fork,
            EXCALIDRAW_EXTRAS_ROOT: roots.extras,
            EXCALIDRAW_TEST_REPORT_DIR: directory,
          },
          stdio: ["ignore", fd, fd],
          windowsHide: true,
          timeout: 1800000,
        });
      } finally {
        closeSync(fd);
      }
      assert.ok(
        !result.error && result.status === 0,
        name + " failed; inspect " + join(directory, "command.log"),
      );
      if (reportFile) {
        const report = JSON.parse(
          readFileSync(join(directory, reportFile), "utf8"),
        );
        (gate ? gates : reports).push(report);
      }
    };
    run(
      "build",
      "plugin",
      "npm",
      ["run", native ? "verify:obsidian:regression" : "test:build-workspace"],
      native ? "report-v2.json" : undefined,
    );
    if (native)
      reports.push(
        JSON.parse(
          readFileSync(join(output, "build/devices/report.json"), "utf8"),
        ),
      );
    for (const command of [
      "lib",
      "test:contracts",
      "test:fixtures",
      "test:inventory",
    ])
      run(command.replaceAll(":", "-"), "plugin", "npm", ["run", command]);
    run("plugin-fast", "plugin", "npm", ["run", "test:fast"], "report.json");
    run(
      "plugin-source",
      "plugin",
      "npm",
      ["run", "test:source-coverage"],
      "report.json",
      true,
    );
    run("fork-types", "fork", "yarn", ["test:obsidian:types"]);
    run(
      "fork-owned",
      "fork",
      "yarn",
      ["test:obsidian:coverage"],
      "report.json",
    );
    run(
      "fork-browser",
      "fork",
      "yarn",
      ["test:obsidian:browser"],
      "report.json",
    );
    run(
      "extras-source",
      "extras",
      "npm",
      ["run", "test:source"],
      "report.json",
    );
    run(
      "extras-browser",
      "extras",
      "npm",
      ["run", "test:browser"],
      "report.json",
    );
    for (const name of ["fork", "extras"]) {
      phase = name + "-package";
      gates.push(
        runPackageConsumer({
          root: roots[name],
          kind: name,
          reportDir: join(output, "package-" + name),
        }),
      );
    }
    phase = "regression-audit";
    for (const [kind, root] of Object.entries(roots))
      assert.deepEqual(
        sourceIdentity(root),
        before[kind],
        kind + " changed during regression verification",
      );
    for (const report of [...reports, ...gates]) {
      const kind = report.suiteId.startsWith("fork-")
        ? "fork"
        : report.suiteId.startsWith("extras-")
          ? "extras"
          : "plugin";
      const actual =
        report.legacy?.combination?.manifests.plugin || report.source;
      for (const key of ["commit", "dirty", "diffHash", "lockfileHash"])
        assert.deepEqual(
          actual?.[key],
          before[kind][key],
          report.suiteId + " stale source: " + key,
        );
    }
    const result = auditRegression(reports, gates, { native });
    result.sources = before;
    writeFileSync(
      join(output, "report.json"),
      JSON.stringify(result, null, 2) + "\n",
    );
    writeReportFiles(result, output);
    process.stdout.write(
      `Core regression ${result.status}; ${result.tests.length} canonical cases; ${output}\n`,
    );
    if (result.status !== "passed") process.exitCode = 1;
  } catch (error) {
    const reason = String(error.stack || error);
    const failed = {
      schemaVersion: 2,
      suiteId: "core-regression",
      status: "failed",
      cleanup: "not-started",
      error: reason,
      tests: [{ testId: "regression:" + phase, status: "failed", reason }],
    };
    writeFileSync(
      join(output, "report.json"),
      JSON.stringify(failed, null, 2) + "\n",
    );
    writeReportFiles(failed, output);
    throw error;
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    process.stderr.write(String(error.stack || error) + "\n");
    process.exitCode = 1;
  });
