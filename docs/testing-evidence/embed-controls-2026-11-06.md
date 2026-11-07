# Drawing embed controls (#3036 / PR #3037)

Implementation branch: `2026-11-06-issue-3036-embed-controls`, based on
`375b460c0b2baf01a65e818a8c9b485e92615ebd`.

## Behavior and ownership

Direct Live Preview drawing embeds get proportional corner resizing, reset,
selection of their exact embed syntax, fullscreen viewing and Open drawing.
Normal Reading mode gets fullscreen viewing and Open drawing only. Print/PDF,
hover previews, Canvas and nested or hybrid Markdown contexts get no toolbar.
An ambiguous or retired source binding never writes.

The editor bridge uses public `editorInfoField`, `editorLivePreviewField` and
CodeMirror DOM/source boundaries. It checks the complete source token, owning
file/editor and canonical drawing/reference. It does not depend on native private
widget fields, the active note, a global occurrence index or whole-file replacement.
Bindings map through prefix edits and retire on edits inside their token. Native
table widgets use their public source boundary and the physical table cell;
rectangular shape, delimiter row, complete token and row/column identity must
agree before a write. Escaped table aliases also retain their displayed size.

Movement changes CSS only. A completed resize uses one isolated editor history
transaction. Unchanged or cancelled gestures preserve the original source bytes.
Changed percentage sizing becomes pixels. Explicit height or width/height sizing
becomes a pixel box preserving the displayed aspect ratio; width-only sizing
remains width-only. Reset removes just the dimension field. Paths, references,
titles, aliases, style suffixes, whitespace and escaped table separators remain
unchanged. Existing wrapper layout remains responsible for alignment and percentage
sizing. Controls follow the visible image bounds.

Cancellation restores control placement immediately; scrolling and viewport
changes and image decoding remeasure it through an owned ResizeObserver. Hover
toolbars sit inside the image because native widgets use paint containment.
Small images and always-visible touch toolbars use normal flow below the image.
A full-width no-op keeps percentage syntax
instead of shrinking solely to create space for the handle.

Fullscreen uses the existing exporter with the same drawing/reference and theme,
but bypasses the shared image cache. It owns and releases that fresh image. SVG
links are inactive in the viewer. Closing a source owner closes its viewers and
cancels gestures; late exports are discarded. Open drawing and the existing
double-click/long-press gestures share the same navigation helper, including mask
prompts and modifier/reference behavior.

Reading-mode controls have one plugin-owned registry in addition to their render
context lifetime. Context cleanup removes each owner from the registry, and
plugin unload closes any remaining controls/viewers. Hidden Live Preview controls
retire when switching to Reading mode. A Reading export completing
after plugin unload is discarded before touching the document.

No dependency, release version, fork or Extras change is required. The unmerged
area-padding PR #2868 is not a dependency.

## Native API spike

On Windows / Obsidian 1.14.5, the existing renderer left no working native image
edit/resize controls in the Markdown editor. Two identical wiki embeds and a
Markdown image embed had distinct public `posAtDOM` starts and parent boundaries.
The boundary included the exact token and a trailing newline. Private widget
fields were inspected for research only; production uses the public boundaries.
The spike ran three times with cleanup and baseline restoration.

Evidence: `.test-work/reports/pr3037-native-spike/widget-spike.json`.

## Automated checks

Whole production-module tests exercise lossless dimension rewriting, real
CodeMirror history/range mapping, controller gestures and cleanup, fullscreen
async ownership and shared navigation. Existing postprocessor/lifecycle tests
also cover cache bypass and toolbar exclusions. New source modules participate
in `test:source-coverage` and native cases are required by the regression profile
and P05 feature mapping.

Run the affected native desktop matrix with:

```sh
node scripts/testing/host/verify.mjs --embed-controls
```

The complete native profile also includes the phone/tablet workflows in actual
Obsidian mobile emulation with trusted CDP touch input. This is not physical-device
coverage. Native cases assert exact source, history and unchanged drawing bytes;
screenshots alone do not establish behavior.

The development native attempts are retained under
`.test-work/reports/pr3037-controls-focused*`. The first attempt stopped on a
malformed test PNG, which was corrected. The next attempts exposed incorrect
held-button input in the harness, then a production stale-generation remount
loop after resizing. The latter starved the renderer's replacement timer and CLI.
The bridge now rejects stale generations before mounting; a bounded production
bridge test reproduces and prevents the loop. A recovery build was hash-verified
in the owned test vault. The stalled run remains failed, including cleanup.
It is not acceptance evidence. The maintainer restarted Obsidian; acknowledged
CLI recovery removed only the failed run's owned fixtures and restored the
declared baseline. Recovery evidence is retained under
`.test-work/recovery/pr3037-stale-renderer/restarted-baseline.json`.

The focused desktop matrix passed on Windows / Obsidian 1.14.5 after recovery:
all 15 embed cases across main, split and popout contexts, with clean console,
source stability, cleanup and baseline restoration. It covers all three image
modes, repeated/same-line tokens, table cells, same-note split synchronization,
history, source selection, fullscreen keyboard controls/focus, Reading mode and
popout input with the main window minimized. Evidence:
`.test-work/reports/pr3037-controls-focused-10/report.json`.

Trusted touch initially exposed the host's `body.emulate-mobile .clickable-icon`
rule overriding the resize handle's touch action. A scoped selector now outranks
that rule. All ten phone/tablet embed cases, including resize/history/reset,
tables, fullscreen pinch and pan, passed against the fresh frozen build:
`.test-work/reports/pr3037-phone-probe-3/report.json`.

Toolbar compatibility mouse/touch events are isolated from the surrounding native
table, preserving button default activation. Editing table syntax intentionally
opens Obsidian's inner cell editor; the host retains its hidden display preview.
The native test exits through a trusted footer click instead of moving only the
outer editor's caret. It verifies that this roundtrip preserves every source byte.

Complete portable regression at `76ffd8ed4dbb347e0c1a7ef01d5778f9537a41d3`
passed 934 canonical cases, with successful cleanup and no missing cases. It
includes 717 plugin tests and 199 source-coverage tests. GitHub Plugin tests and
CodeQL passed at that revision. The first complete native attempt remains failed:
399 passed, five failed, cleanup passed. Evidence is retained under
`.test-work/reports/pr3037-native-76ffd8ed/`.

The November 7 checkpoint addresses the observed native readiness failures:

- Focus the table handle through trusted hover/scroll/click input before keyboard
  resizing, while retaining inactive-pane ownership and exact transaction checks.
- Wait for saved fixture frontmatter before each stability reopen; disk persistence
  completes before Obsidian republishes the cache used by its default-view router.
- Flush live Markdown saves before retiring views and deleting owned fixtures.
- Restore Electron zoom and require bounded geometry/notification idle before
  closing the owning popout; keep the strict host exception gate unchanged.
- Coalesce the controller's ResizeObserver-driven layout writes into an owned
  animation frame and cancel it on unload. This does not attribute or suppress the
  host's historically recorded observer notifications.

All six stability cycles and the restored-zoom workflow passed focused validation
without unexpected host errors. Full phone/tablet workflows passed 108 cases with
clean error gates, cleanup and restoration. The corrected desktop input sequence
then passed all 15 embed cases with baseline restoration. Evidence:
`.test-work/reports/pr3037-native-readiness-focused-1/`, including
`devices/report.json` and `controls-input-probe.json`. Failed predecessor attempts
remain separate; the focused parent report's hidden-handle input failure is not
acceptance evidence.

Latest source suite: 717 tests in 87 files passed. Modified embed modules have zero
targeted lint or TypeScript diagnostics. Fresh complete portable/native acceptance
is still required at this checkpoint. Minimum Obsidian 1.8.7, macOS, physical
Android/iOS and hosted CodeScanner remain separate unverified gates.

The isolated alignment check found that the existing
`div.excalidraw-svg-left/right` width rule overrode the gesture's single-class
width rule. A requested 220 px preview measured 600 px in a 600 px container for
both alignments, in PNG, SVG image and inline SVG. The scoped two-class gesture
selector measures 220 px in all nine default/left/right and image-mode cases.
Evidence: `.test-work/pr3037-alignment-css-probe.json` and
`.test-work/pr3037-alignment-css-fixed.json`. The native input cases now assert
actual preview size/aspect ratio during movement and exercise pointer resizing
of left-aligned wiki embeds and right-aligned Markdown-image table cells. Fresh
complete acceptance is required after this CSS checkpoint.

The complete-sequence split fixture can leave only 170 px for its owning pane.
Table resize checks therefore shrink from the measured displayed width instead
of assuming an eight-pixel enlargement fits. Pointer checks likewise shrink by
20 px while measuring actual geometry. Exact source, other-cell preservation,
same-note synchronization and isolated undo remain required. Passive focus/key
evidence is retained on failure. The independent extraction workflow now waits
for the owner to leave save/synchronization work and for its new editor tab to
appear, and verifies the rendered tab's full drawing identity.

`npm run code` reports 118 existing errors outside the modified production
modules; targeted lint and targeted TypeScript diagnostics pass. Production
builds retain the same existing 18 Rollup circular-dependency warnings. The
`madge` executable and hosted Obsidian CodeScanner are not installed locally.

## Priority review

1. Resize/reset/edit repeated, same-line and table embeds; verify one-step undo,
   untouched surrounding syntax and unchanged drawing files.
2. Compare all three preview modes, fragments, themes, inline SVG links and mask
   navigation. Close the viewer during export and switch notes during interaction.
3. Repeat through refresh, detach/reattach, split panes, popout teardown and plugin
   reload, then use physical phone/tablet touch for scrolling, focus and gestures.
