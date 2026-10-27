# Lucide icon picker and native insertion — temporary handoff

Prepared by **Zsolt's Codex Agent** at the maintainer's request.

**Status: plan only; no runtime implementation.** The draft PR associated with this branch owns the detailed implementation plan and acceptance criteria. Remove this temporary file before finalizing that PR.

## Baselines and ownership

- Plugin branch: `2026-10-27-lucide-icon-picker`, targeting `master`, from `9e52063296ffcd3b38d6a2bd5b23546d7e6268f7`.
- SVG converter prerequisite: [merged plugin PR #3018](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/3018). Reuse the upgraded converter; do not reopen or repurpose that PR.
- Component reference: `zsviczian/excalidraw`, `master` at `02d5b607525da43eadaad72954d4fc644f3c157a`.
- CLI skill reference: `zsviczian/obsidian-excalidraw-cli`, `main` at `11d020f28d2a0ddabd1559038ea2b978f47e667a`.
- The local implementation workspace contains all three projects. Verify their actual paths, instructions, branches, revisions, and dirty state before working. Companion implementation branches/PRs are not created by this plan-only checkpoint.

## Agreed feature

Provide **Insert Lucide Icon** through the command palette and the existing image-tool menu. Reuse the Excalidraw sidepanel for a searchable icon grid, showing Obsidian `getIcon()` SVGs. Discover installed Lucide identifiers through `getIconIds()`, rather than bundling or downloading a catalog.

On insertion, convert the selected SVG to ordinary editable native Excalidraw elements, put every generated element into one fresh outer group, and insert that group. Size presets determine scene size and initial stroke width. Preserve standard Excalidraw editing, roughness, grouping, persistence, and export behavior. Do not create image elements, vault attachments, symbolic Embedded Files references, or an icon dependency on reload.

Add a synchronous `ea.addLucideIcon()` convenience API that creates grouped elements only in the EA workbench and returns group/member handles. It must not clear unrelated work, insert into a scene, save, or require an open drawing. UI and native CLI should share the same validated conversion path.

Include native CLI discovery and insertion, create/apply integration, explicit one-to-many result handles, and updated CLI skill/examples. Do not require arbitrary eval or a trusted script for ordinary icon discovery/insertion.

## Implementation constraints

- Start from the converter's actual capabilities and warning contract. Preserve `ea.importSVG(svg): boolean` and its generic SVG behavior. Do not treat a successful but empty/partial conversion as a valid icon.
- Resolve color and intended SVG viewport before conversion; keep transparent fills and round-cap dots correct. Scale geometry and stroke width once, independent of viewport zoom. Default preset values and API shapes in the PR are implementation proposals, not existing APIs.
- Prepare new elements, styles, and grouping before appending to the workbench. Failures must leave unrelated elements/images/styles unchanged; repeat insertion needs fresh element/group IDs.
- Keep the picker singleton/reusable, bind each insertion to the intended live view, and handle tab switches, close/reopen, popouts, mobile, and cleanup without stale writes or leaked hotkeys.
- Keep the fork patch to the shared image-menu action and typed host boundary; maintain its customization inventory. Follow coordinated protocol/type/artifact rules. No renderer or special group-resize change.
- Keep the CLI bundle as documentation and thin helpers, not another converter. Preserve revision guards, request receipts, explicit targets, bounded output, and existing `idMap` semantics.

Read the PR and all relevant `AGENTS.md`/`CONTRIBUTING.md` files before implementation. Re-run converter tests and actual installed-icon checks, then UI/EA/CLI integration against the authorized `excalidraw-test` vault. Preserve supplied SVG originals. Record exact source/artifact versions and tests actually run; prior #3018 results are not validation of this new feature.

Continue on this plugin branch/PR, link any companion fork/CLI PRs, remove this file, and update the PR with implementation and validation evidence. Do not merge, publish packages, or bump versions without explicit authorization.
