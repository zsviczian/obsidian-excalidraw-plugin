# Workflow fixes: PR #3020

Date: 2026-10-28. Plugin branch `2026-10-28-small-workflow-fixes`, reconciled
with master `962416bb`. Source checkpoints: `1d4a7aa6` (#2743 fullscreen) and
`d8877a18` (#2649 templates). No fork, Extras, CLI-bundle, dependency, version or
scene-format changes are part of this PR. The prepared handoff is removed.

## Outcomes

| Issue | Before | Result |
| --- | --- | --- |
| #2743 | A lower-right drawing becomes 0x0: an outer mod-root split gets `excalidraw-hidden`. Optional header lookup can also throw, and exit removes unrelated classes/styles. | Keep the complete ancestor path visible, hide surrounding sibling panes, and restore only owned classes. One owner per document; migration cleanup retains the entry document. Temporary CSS classes preserve existing inline styles. |
| #2649 | Same-named templates display identical labels. Escape falls through to blank content after the destination folder is created. | Dedicated template/blank/cancel results, relative folder labels and initially selected explicit blank. Interactive callers prepare before folder/file/embed/editor/leaf effects. |
| #2729 | The reported SVG-only fixed-size behavior was not reproduced on this host. | No speculative MarkdownPostProcessor, image-cache or rendering change. Width scaling passes in all six preview/immersive combinations. Tall previews are clipped in all three modes; this observation does not establish the reported SVG-versus-PNG cause. Keep the issue unresolved. |

The public `getBlankDrawing(): Promise<string>` and `createDrawing(): Promise<TFile>`
contracts remain. The former retains its legacy script dismissal fallback;
internal `prepareDrawing()` exposes cancellation to UI workflows. Existing
explicit initData, EA and exact-path CLI creation bypass interactive preparation.
The legacy `templatePromt` export remains as a file-or-null adapter. Shared link
prompts are unchanged. Zero/single-template automatic selection is preserved.

## Reproduction and regression evidence

Six initial fullscreen fixture tests failed on the baseline. Seven now pass,
covering depth 0-3, optional controls, existing classes/styles, repeated toggles,
another drawing/window, ownership transfer and cleanup after document migration.
The two original template creation-boundary tests also failed before the fix.
Five chooser/creation tests now pass, including Obsidian's close-before-selection
order and theme, compatibility and compression combinations.

Native pre-fix fullscreen evidence: `%TEMP%/excalidraw-obsidian-mSpMEO` and the
baseline probe log `%TEMP%/workflow-3020-baseline-direct.log`. Runtime main.js
matches the original master artifact, SHA-256
`b9a471eeea1f0f81d158fa0cc68032447cbe73b6a6f1a0fef131dbc026db9cb0`.
That probe recorded the hidden outer split and 0x0 content; its later Canvas
API test was incomplete and is not claimed as an overall pass.

The intermediate `%TEMP%/excalidraw-obsidian-pFgYJY/report.json` passes native
fullscreen after its fix and records the old template behavior: two identical
labels, Escape creates a drawing and a destination folder. It also records the
unchanged wide-Canvas width scaling before the template changes.

## Final native acceptance

**Passed:** `%TEMP%/excalidraw-obsidian-uhyar0/report.json`, including the strict
JavaScript-error gate and owned-fixture cleanup. Windows, Node 22.22.3, Obsidian
1.14.5 (installer 1.14.0), console launcher
`C:/Program Files/Obsidian/Obsidian.com`, vault `C:/Obsidian/excalidraw-test`.

```powershell
$env:EXCALIDRAW_TEST_VAULT_NAME='excalidraw-test'
$env:EXCALIDRAW_TEST_VAULT_PATH='C:/Obsidian/excalidraw-test'
$env:EXCALIDRAW_TEST_CONFIG_DIR='C:/Obsidian/excalidraw-test/.obsidian'
$env:EXCALIDRAW_TEST_FORK_TYPES_ROOT='C:/Users/viczi/GitHub/excalidraw'
npm run verify:obsidian:plugin -- --workflow-fixes --native-cli --embed-recovery
```

- Quarter split: 958x641 becomes 2560x1438 and returns to identical bounds.
  Eighth split: 479x641 becomes 2560x1438 and restores. Popout: 1024x722 becomes
  1024x800 and restores. Repeated toggles, second-drawing ownership transfer,
  closing a fullscreen drawing, unchanged drawing elements and main/popout
  isolation pass. Layout restoration is measured, not inferred from class names.
- The actual chooser initially selects **Blank drawing** and distinguishes
  `Alpha/Same.excalidraw.md` from `Beta/Same.excalidraw.md`. Filtering selects the
  Beta contents. Explicit blank creates one drawing. Escape/outside dismissal,
  new-and-embed, note conversion and the actual file-explorer folder menu cancel
  without extra files/folders or note edits. Zero/single templates, legacy JSON
  and explicit initialization work without new prompts.
- Two differently sized Canvas nodes reference one drawing; a third uses a tall
  drawing. All SVG/SVG-as-image/PNG cases with immersive mode off/on scale the
  small wide preview from 318 to 638 pixels as its node grows from 320 to 640;
  the second preview remains unchanged. These cases use fresh Canvas views and
  shared warm image-cache entries. The tall preview is 318x1643 in a 320x480
  node across all modes, so height fitting/clipping is explicitly not accepted
  as fixed. No old-environment or universal #2729 resolution is claimed.
- Existing native CLI authoring/receipt/save/read-back/export checks pass, as do
  18 embed-recovery assertions spanning Live Preview, Reading mode, warm reopen,
  width refresh, popouts and hybrid Markdown/image rendering.

The probe fits Canvas in a normal-sized pane: at far zoom in an eighth-width
pane, Obsidian intentionally renders placeholders. It waits for newly created
and restored drawings' first render before teardown; a returned filename alone
does not establish editor readiness. Early runs recorded a late onChange error
reading cleared settings during reload, and a menu-builder test double lacked a
core API. The final probe uses the actual Obsidian Menu via EA, awaits editor
readiness and retains the strict error gate. No lifecycle production fix or
error filtering is claimed.

## Checks and artifact identity

| Check | Result |
| --- | --- |
| `npm run test:workflow-fixes` | 12 pass |
| `npm run test:markdown-embeds` | 20 pass |
| `npm run test:drawing-load-error` | Four pass |
| `npm run test:obsidian:runner` | 11 pass |
| `npm run test:bundle` | Four pass |
| Production and public-library output | Build successfully |
| Generated paired-fork host declarations | Pass |
| Focused lint on touched production modules | Clean |
| Full `npm run code` | 119 existing errors, zero warnings; not claimed green |

Final production main.js: **5,029,444 bytes**, 213,436 below 5 MiB; SHA-256
`c9f2f53c05b5c8b977d62cee20562931173455dc9e95ed73ec63107df9b6bec3`.
CSS SHA-256: `4f71f6598b45de2e1ae94c20b7a190397a8b1150cd78b29e10fdf4638b6e6c7d`.
The test vault's three installed artifacts match the build exactly.

The declared component version remains 0.18.145. Its four installed runtime
artifacts still contain the locally built protocol-3 changes from fork #476,
as already authorized for the #3019 intermediate source merge. Their hashes
remain in [Lucide validation](LUCIDE_ICON_VALIDATION.md). The environment variable
above checks generated matching declarations; Rollup still warns about the old
installed action union. This PR introduces no new package coordination. Normal
published-byte verification remains deferred to the maintainer's release step.

## Maintainer review and remaining limits

Local review artifacts are copied to the ignored `tmp/pr3020-validation/` folder:
`before-nested-layout.png`, `before-fullscreen.png`, `after-fullscreen.png`,
`after-eighth-layout.png`, `before-template-chooser.png`,
`after-template-chooser.png`, `canvas-before-resize.png`,
`canvas-after-resize.png`, and the final `report.json`. Screenshots of the
chooser and Canvas were visually inspected. They are synthetic dedicated-vault
fixtures, not a published image corpus.

Priority manual checks: nested fullscreen and restored popouts after cold
restart; annotation/NewFileActions nested dialogs; physical mobile focus,
keyboard/touch and scrolling. macOS/Linux and physical mobile were not run.
Hosted CodeScanner is unavailable locally and remains pending for the two
fullscreen CSS rules. No issue is closed, no new labels are assigned, and the
PR stays draft. The separate categorization work in the original preparation
was not expanded by this implementation.
