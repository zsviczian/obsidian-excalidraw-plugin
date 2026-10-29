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
        "PDF timeout/concurrency rollback, plus the maintainer-authorized plain-PDF, local-font and internal Canvas-node focus fixes of 2026-10-29 and their release notes; no other production changes.",
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
      kind === "extras"
        ? ["src/PDFExport/index.ts"]
        : kind === "plugin"
          ? [
              "src/shared/Dialogs/Messages.ts",
              "src/shared/EmbeddedFileLoader.ts",
              "src/view/managers/CanvasNodeFactory.ts",
            ]
          : ["packages/excalidraw/obsidianUtils.ts"],
      kind + " has an unauthorized additional production diff",
    );
    const normalized = (text) => text.replaceAll("\r\n", "\n");
    const expectedFile = (path, transform) => {
      const before = git(root, ["show", baselines[kind] + ":" + path]);
      const expected = transform(normalized(before));
      assert.notEqual(
        expected,
        normalized(before),
        "Authorized patch anchor missing: " + path,
      );
      assert.equal(
        normalized(readFileSync(join(root, path), "utf8")),
        expected,
        "Unexpected production edits in " + path,
      );
    };
    if (kind === "plugin") {
      expectedFile("src/view/managers/CanvasNodeFactory.ts", (source) =>
        source
          .replace(
            "    save: boolean;",
            "    save: boolean;\n    focus: boolean;",
          )
          .replace(
            "      save: false,",
            "      save: false,\n      // Internal preview creation must not take the workspace's active editor.\n      focus: false,",
          ),
      );
      expectedFile("src/shared/EmbeddedFileLoader.ts", (source) =>
        source.replace(
          'linkParts.ref\n        .split("rect=")[1]',
          'linkParts.ref?.split("rect=")[1]',
        ),
      );
      expectedFile("src/shared/Dialogs/Messages.ts", (source) =>
        source.replace(
          "## Fixed\n- Autosave",
          [
            "## Fixed",
            "- Embedded Markdown previews no longer take editor focus when they load, avoiding a mobile toolbar error. [#3022](${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_PULL}/3022)",
            "- Importing a PDF file through ExcalidrawAutomate loads page 1 when no page reference is supplied. [#3022](${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_PULL}/3022)",
            "- Markdown images using Helvetica no longer try to fetch a nonexistent font file. [#3022](${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_PULL}/3022)",
            "- Autosave",
          ].join("\n"),
        ),
      );
    }
    if (kind === "fork")
      expectedFile("packages/excalidraw/obsidianUtils.ts", (source) =>
        source.replace(
          "  const fontFaces = Fonts.registered.get(fontFamily)?.fontFaces;",
          [
            "  const registered = Fonts.registered.get(fontFamily);",
            "  // zsviczian -- #477: system fonts have no font-file content to embed.",
            "  if (registered?.metadata.local) {",
            '    return "";',
            "  }",
            "  const fontFaces = registered?.fontFaces;",
          ].join("\n"),
        ),
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
    "Production diff audit passed: exact plain-PDF/local-font/internal-node-focus fixes and release notes; Extras PDF rollback only. " +
      output +
      "\n",
  );
}
