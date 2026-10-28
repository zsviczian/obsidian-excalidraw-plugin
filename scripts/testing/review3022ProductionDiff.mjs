/** Maintainer-scoped #3022 follow-up audit, separate from future product regression acceptance. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const plugin = resolve(import.meta.dirname, "../..");
const baselines = {
  plugin: "afd763e60ce486096bde2954f73bd5988a793660",
  fork: "e0cf824c6225d02f48b98c30c5b79d6ab8536c35",
  extras: "e37c06feff9fef48877f565328762433a676afcc",
};
export function reviewProductionDiff({
  pluginRoot = plugin,
  forkRoot = resolve(pluginRoot, "../excalidraw"),
  extrasRoot = resolve(pluginRoot, "../obsidian-excalidraw-extras"),
} = {}) {
  const roots = { plugin: pluginRoot, fork: forkRoot, extras: extrasRoot },
    report = {
      scope:
        "Only PDF timeout and per-document concurrency rejection may change production behavior in this follow-up.",
      baselines,
      repositories: {},
    };
  const git = (root, args) => {
    const r = spawnSync("git", args, {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout;
  };
  for (const [kind, root] of Object.entries(roots)) {
    const paths =
      kind === "plugin"
        ? [
            "src",
            "styles.css",
            "rollup.config.mjs",
            "MathjaxToSVG",
            "scripts/buildReactRuntime.mjs",
            "scripts/excalidrawTypeSource.mjs",
          ]
        : kind === "fork"
          ? [
              "packages",
              "scripts/buildPackage.js",
              "scripts/buildObsidianPackage.js",
            ]
          : ["src", "styles.css", "rollup.config.mjs"];
    const changed = git(root, [
      "diff",
      "--name-only",
      baselines[kind],
      "--",
      ...paths,
    ])
      .trim()
      .split("\n")
      .filter(Boolean);
    assert.deepEqual(
      changed,
      kind === "extras" ? ["src/PDFExport/index.ts"] : [],
      kind + " has an unauthorized additional production diff",
    );
    for (const path of [
      "package.json",
      ...(kind === "fork" ? ["packages/excalidraw/package.json"] : []),
      "manifest.json",
      "manifest-beta.json",
    ]) {
      const result = spawnSync("git", ["show", baselines[kind] + ":" + path], {
        cwd: root,
        encoding: "utf8",
        windowsHide: true,
      });
      if (result.status !== 0) continue;
      const previous = JSON.parse(result.stdout),
        current = JSON.parse(readFileSync(join(root, path), "utf8"));
      for (const key of [
        "version",
        "dependencies",
        "peerDependencies",
        "optionalDependencies",
        "exports",
      ])
        assert.deepEqual(
          current[key],
          previous[key],
          kind + " changed " + path + " " + key,
        );
    }
    report.repositories[kind] = {
      head: git(root, ["rev-parse", "HEAD"]).trim(),
      productionPathsChanged: changed,
      diff: git(root, [
        "diff",
        "--ignore-all-space",
        baselines[kind],
        "--",
        ...paths,
      ]),
    };
  }
  const source = readFileSync(
    join(extrasRoot, "src/PDFExport/index.ts"),
    "utf8",
  );
  for (const discarded of [
    "printingDocuments",
    "120000",
    "setTimeout",
    "clearTimeout",
    "already in progress",
    "timed out",
  ])
    assert.ok(
      !source.includes(discarded),
      "Discarded PDF behavior remains: " + discarded,
    );
  for (const retained of [
    "elementToPrint.ownerDocument",
    "document.defaultView",
    "getPageSize(pageSize)",
    "ipc.once('print-to-pdf', onComplete)",
    "ipc.send('print-to-pdf', options)",
    "ipc.removeListener('print-to-pdf', onComplete)",
    "printDiv?.remove()",
    "document.adoptedStyleSheets.filter",
  ])
    assert.ok(
      source.includes(retained),
      "Accepted PDF behavior missing: " + retained,
    );
  report.status = "passed";
  return report;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const report = reviewProductionDiff(),
    output = resolve(
      process.env.EXCALIDRAW_TEST_REPORT_DIR ||
        join(plugin, ".test-work/reports/production-diff-3022"),
    );
  mkdirSync(output, { recursive: true });
  writeFileSync(
    join(output, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  process.stdout.write(
    "Production diff audit passed: plugin/fork runtime unchanged; Extras contains only the reviewed PDF rollback. " +
      output +
      "\n",
  );
}
