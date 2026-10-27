# SVG-to-Excalidraw fidelity upgrade — temporary implementation handoff

Prepared by **Zsolt's Codex Agent** at the maintainer's request.

**Status:** Plan only. This commit changes no runtime code and does not fix the converter. Remove this temporary file before the implementation PR is finalized. The draft PR associated with this branch owns the detailed implementation plan and acceptance criteria.

## Workspace and baseline

- Repository: `zsviczian/obsidian-excalidraw-plugin`.
- Implementation branch: `2026-10-27-svg-import-fidelity`; target: `master`.
- Starting commit: `5e4c83f6370f93d3f794ef7afb9545a6b6208c11`.
- Related reports, not automatic closure targets: [SVG import artifacts #1173](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1173) and [excessive imported control points #2474](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2474).

## Goal and boundaries

Improve the existing general-purpose SVG-to-native-Excalidraw converter, especially paint order/layers, transparency, compound paths, stroke geometry, and coordinate handling, without regressing successful imports. Keep `ea.importSVG(svgString): boolean` synchronous and workbench-only, and preserve the existing Import SVG command and ordinary SVG-as-image workflows.

Lucide SVGs are one fixture family, not the feature being implemented. Do not add an icon picker, `addLucideIcon`, icon presets, native CLI operations, CLI skill changes, virtual embedded assets, a new scene format, or group-resize customization. Prefer plugin-only changes; a renderer/fork limitation requires a documented proposal, not an unapproved cross-repository expansion.

## Fixture handoff

The maintainer will add representative SVGs and Lucide icon samples to the local `excalidraw-test` repository. Their paths and availability were not verified when this plan was prepared. Discover that checkout and read its instructions; do not invent filenames, replace its contents, or publish private samples into this public repository without permission. Treat supplied originals as read-only and keep generated artifacts separate.

Record corpus revision/file hashes and installed Obsidian/plugin/component versions. Establish browser-rendered source references and old-converter baselines before changing behavior. Compare old/source/new results on transparent, light, dark, and nonuniform backgrounds; document each fixture as unchanged, improved, regressed, or explicitly unsupported. Missing maintainer samples remain a pending acceptance gate, not an assumed pass.

## First steps for the local agent

1. Read `AGENTS.md`, `CONTRIBUTING.md`, `docs/agent-workflows/issue-resolution.md`, `docs/OBSIDIAN_RUNTIME_TESTING.md`, the draft PR, and the linked issue discussions. Verify branch/head, dirty worktrees, current related work, and the installed component version.
2. Trace `src/shared/svgToExcalidraw/`, `ExcalidrawAutomate.importSVG`, `ImportSVGDialog`, and all consumers. Add characterization tests and minimal failing fixtures before changing the converter.
3. Implement and validate small checkpoints: paint-order/style/alpha correctness; path and transform fidelity; bounded sampling and diagnostics; importer integration and compatibility. Distinguish SVG group compositing from multiplying child opacities; never represent transparent holes by painting white or the canvas background.
4. Run the plan's focused tests and repository-required builds, then the guarded live lane against the actual `excalidraw-test` vault. Report tests actually run, visual comparisons, performance/size changes, and unresolved limitations separately.
5. Continue on this branch and PR, remove this file, update the PR with actual changes and evidence, and leave it draft for maintainer review. Do not merge, publish, or bump versions.
