# Test findings for maintainer review

**Acceptance checkpoint: F32 and the [2026-10-30 acceptance report](testing-evidence/3022/README.md). Later approved link-history fix: F33.**
Earlier findings retain their original hosts and failed attempts as history.
The required native pair passes 357/357 in both complete matching-build repeats.
Earlier failures remain historical evidence; no production observer fix is claimed.

The current fork is the accepted baseline. A historical upstream test failure is
not a product defect. The independent regression suite checks fork contracts and
the editing workflows affected by those contracts. It does not require upstream's
web-app suite, old DOM snapshots, render counts or synchronous tool scheduling.
No snapshots or expected-failure lists are automatically accepted.

## F01 - Popout teardown: confirmed production trigger and residual

The maintainer confirmed this is longstanding and authorized a 30-minute
investigation, then separate follow-up for anything unresolved. The investigation
ran from 17:18 to 17:45 UTC on 2026-10-28.

The private React scheduler selected Electron's Node `setImmediate` rather than
its browser MessageChannel path. Keeping that choice lexical to the private
runtime removes the reproduced production trigger without changing host globals,
React package entrypoints, fork protocols, save ordering or view lifecycle code.

| Controlled check | Unexpected exceptions | Result |
| --- | ---: | --- |
| Original production scheduler, focused lifecycle | 3 | Failed |
| Browser scheduler, same focused lifecycle | 0 | Passed twice |
| Restore original scheduler, same lifecycle | 3 | Failed again |
| Browser scheduler, full production functional run | 0 | All 44 canonical cases passed |
| Same production run, device/layout matrix | 0 | All 40 cases and restoration passed |
| Browser scheduler, development lifecycle and CLI | 3 | Functional checks and cleanup passed; error gate failed during dirty popout-to-main migration |

The shipped-bootstrap regression also fails with the original payload (two
reads of Node's scheduler), and passes with the corrected production and
development payloads. A/B artifacts, hashes and raw errors are retained under
`.test-work/reports/repair-react-*`. The original no-stack exceptions report
line 0 of `app://obsidian.md/index.html`; no exception has been whitelisted.

Electron documents the underlying shared-event-loop teardown error in
[the original fix](https://github.com/electron/electron/pull/52964) and
[the 43.x backport](https://github.com/electron/electron/pull/53041), released in
[43.5.0](https://releases.electronjs.org/pr/53041). This host uses Electron
43.3.0. Clean Markdown-only controls with DOM timers, Node immediates and read-only
filesystem callbacks did not reproduce it. This confirms a private-React trigger,
not that every filesystem/Node teardown path in the host is repaired.

**Residual for separate follow-up:** development-mode dirty migration still
produced three primitive illegal-access exceptions. The maintainer's time cap
ends this investigation; the existing runtime beyond the narrow scheduler change
is retained. Reproduce by building with `npm run dev`, deploying the three
artifacts to the dedicated vault, editing in a popout and moving it back to main.
The required regression runs production artifacts, including main/popout
lifecycle, with strict error and cleanup gates. Physical devices and other desktop
hosts still require their own evidence.

Current production residual, 2026-10-29: the expanded production suite also
captures eight primitive illegal-access exceptions at 9c08d814 and four during
dirty popout-to-main migration at 098e6ee1. The residual is therefore not limited
to development builds. The upstream 43.5.0 fix was rechecked; this host remains
43.3.0. A matching signature is not proof of complete causation. No host upgrade,
additional production mitigation or exception exclusion was made. See F21.

## Product fixes retained in scope after evidence review

| Finding | Before | Regression evidence and expected contract |
| --- | --- | --- |
| F02 — Autosave rejection | An unexpected rejected save leaves the autosave busy flag set and prevents later attempts. | `saveCoordinator.source.test.mjs` rejects the first request, verifies the busy flag clears, then physically acknowledges a later request and clears dirty state. Normal failed outcomes remain dirty. |
| F03 — Fork type exports | Package export paths point to nonexistent `dist/types` files rather than generated `types` files. | Both clean packed consumers compile supported public/host calls and reject invalid calls. No runtime protocol or version change in this test PR. |
| F04 — Extras activation | Temporary activation expiry can revoke a permanent activation; retained API closures can reactivate an unloaded plugin. | Whole-module feature tests retain permanent activation and reject stale lifecycle operations. |
| F05 — PDF resource lifetime | Invalid dimensions and failing IPC/print paths can retain resources. | Whole-module tests cover validation, owning realm, completion-driven waiting, listeners, style/DOM cleanup, rejection and later retry. The introduced 120000 ms timeout and per-document lock were rolled back at maintainer request; no replacement mechanism was added. A controlled delay beyond two minutes retains resources until real completion. Native tests decode a single real Electron PDF and retain its output. |

These are concrete error paths, rather than changes made to reproduce an upstream
snapshot. They remain independently reviewable in their repositories.

## Test-infrastructure findings

- **F06 — Normal build failure: repaired.** Host-contract tests ran as `prebuild`
  against old published declarations although this workspace intentionally uses an
  unpublished paired runtime. Tests are explicit commands now. The ordinary build
  and contract test share local declarations only when all four runtime files
  match byte-for-byte. Production and library builds pass without the former
  test-only override. The published dependency/version is unchanged as requested.
- **F07 — Historical upstream deviations: individual review.** The
  [fork's case index](../../excalidraw/dev-docs/Obsidian/test-deviations-3022.json)
  records each failed assertion, location, evidence and assessment. It is
  review material, not an expected-failure allowlist used to make tests pass.
  The independent fork suite no longer adapts upstream test helpers.
- **F08 — Library search/menu: no reproduced product defect.** Trusted input in
  both actual built artifacts clears search with Escape, leaves the sidebar open
  and exposes its load control through the document portal. The old synchronous,
  ancestor-scoped tests failed before establishing those actual behaviors.
- **F09 — Cold restart: environment prerequisite.** The shared Obsidian session
  cannot be restarted safely as an isolated single-vault test. The optional cold
  profile remains guarded and reports this limitation. It is not a product failure
  or a required case in the production regression profile.

Source/model tests use controlled fixture data and boundary substitutes. Browser
tests exercise real production/development artifacts. Native tests exercise real
Obsidian CLI, EA, file persistence and decoded exports. Reports keep those forms
of evidence distinct. Physical mobile and other operating systems require their
own validation; desktop emulation does not establish those environments.

## F10 - Plain PDF TFile input: approved fix, source regression passes

In `behavior-main-scheduled/report.json`, `EA.addImage(x,y,pdfTFile)`
reproduces a loader error followed by a null-size exception. The API documents
`TFile | string`, and the loader defaults the page to 1, but its crop parsing
reads `linkParts.ref.split(...)` when ref is null. An explicit
`pdfTFile.path + '#page=1'` works. The maintainer confirmed that a plain PDF must
load page 1 and approved an immediate fix. Optional crop-reference access now
preserves that default. Source regressions pass; native workflows again use the
plain TFile, while separate explicit-page coverage is retained.

## F11 - System-font Markdown image: approved fix, source regression passes

The same native report records `Failed to fetch font "Helvetica" from urls "" []`
for Markdown-image frontmatter `excalidraw-font: Helvetica`. The plugin comment
expects an empty CSS definition for that system font; the fork font-content
helper instead reports the empty source list. The maintainer classified this as
a defect and approved an immediate fix. The helper now respects metadata.local;
local no-fetch and bundled-font regressions pass. Native workflows again use
Helvetica. No exception allowlist has been introduced.

## F12 - Native tooling teardown and layout diagnostics

The broad desktop run `behavior-desktop-contexts/` closed the final popout via
`await leaf.setViewState({type:'empty'})`. Obsidian destroyed that renderer while
the promise remained pending, the same host limitation already documented in the
lifecycle helper. It also produced repeated primitive illegal-access exceptions.
The failed run was retained. Guarded recovery verified renderer 252 was destroyed,
that no print DOM remained, then reloaded only the canonical local-vault renderer
250 and removed the exact two owned scenario paths. No native print was cancelled;
the orphaned promise was not represented as settled.

The behavior cleanup now follows the existing lifecycle pattern: physically save
if dirty, close the owning popout window, and wait from the main realm for actual
host teardown. A focused split/popout repeat completed all eight business cases
and cleanup without that stranded promise, but failed the strict error gate on
ResizeObserver notifications. This remains a failed run, not a waived host error.
Test input was also unnecessarily scrolling already-visible fixed controls; the
next run checks targeted input without those extra layout changes. Reproduce and
classify any residual before proposing a production change.

## Maintainer decision - Export padding and frames

Frame-enabled SVG/PNG exports suppress padding even without frame elements. The
maintainer confirmed this is intended. Padding combinations explicitly disable
frame rendering, and a separate default/enabled policy case protects the existing
behavior in each context. No production modification is needed.

## Maintainer authorization and fixes, 2026-10-29

The maintainer classified F10 and F11 as defects and explicitly requested immediate
fixes, expanding the earlier rollback-only production scope. PDF crop parsing now
uses optional access for a missing reference, preserving the existing page-1
default. Five AST-isolated actual-method cases pass: null/missing reference,
explicit page, explicit crop, and a negative control reproducing the old failure.
These receive no whole-module coverage or native-render credit.

The fork CSS helper now respects the existing `metadata.local` flag, returning an
empty definition for system fonts without fetching font-file content. The 127-case
independent fork suite includes local-font no-fetch and bundled-font CSS regressions;
artifact/declaration build, full typecheck and focused lint pass. The native
composite embed workflow again uses a plain PDF TFile and Helvetica in every
context. Native confirmation and complete repeated acceptance remain pending.

The production-diff audit now verifies the exact two approved patches and their
release-note lines, plus the unchanged targeted Extras rollback. No other runtime
edits are permitted. Broad plugin lint still reports 119 existing diagnostics;
focused lint of both touched plugin source files passes.

## F13 - ResizeObserver notifications and instrumentation interference

A control reproduced a notification loop after explicit CDP focus emulation;
ordinary debugger attachment did not reproduce it in that comparison. The loop
also continued after both community runtimes were unloaded. This establishes
instrumentation interference, not that instrumentation is the sole cause of
every later notification or that no plugin observer could be involved. Unnecessary
focus emulation remains removed. No production observer is patched or silenced.

The maintainer approved a narrow diagnostic policy on 2026-10-29. Only the exact
browser notification `ResizeObserver loop completed with undelivered notifications.`
without a JavaScript Error/stack is classified separately. CLI text must have the
exact timestamped notification format; other messages and all debugger exceptions
remain failures. Raw events, timestamps, affected task/case phases and counts are
retained. Behavioral and cleanup assertions remain required. Each host/context
must reach 1000 ms of notification-free, stable measured geometry within 5000 ms;
persistent storms or geometry changes fail. Native CLI deadlines still detect an
unresponsive renderer. Failed input, persistence or cleanup assertions cannot be
waived by this policy. Source controls reject unrelated exceptions, near matches,
storms and deliberately unstable geometry. Full native runs additionally exercise
an actual uncaught exception and an intentionally incorrect measured-layout case
through the normal task/case failure collector.


## F14 - Missing Canvas preparation prerequisite

The original local core-plugin list omitted Canvas, which the existing #3020
Canvas-embedding cases require. Opening an unsupported .canvas file caused repeated
open-URI attempts and an EBUSY cleanup failure. Enabling the required core plugin,
closing the exact owned leaves and deleting only the report-owned paths completed
recovery. The immutable seed and regenerated hashes now include Canvas. The old
workflow checks this prerequisite before creating Canvas files. This changes only
test setup and avoids a personal-vault/runtime dependency.

## F15 - Canvas target ownership and workflow cleanup investigation

The reviewed-head focused workflow reproduced three loaded Canvas nodes with empty
preview containers. A minimal Canvas with copied seed drawings rendered correctly;
a second minimal reproduction using freshly generated drawings and a simple
popout cycle also rendered correctly. Evidence is retained in
`canvas-focused-current/canvas-{minimal,generated,after-popout,zoom}.json`.

Inspection found an empty popout still alive after workflow cleanup. Its document
could become the target of later `getLeaf("tab")` calls. The workflow now closes
its owned popout and waits for actual window/API teardown, explicitly selects a
main-window anchor, and asserts Canvas document ownership. All preview, growth
and independent-size assertions remain. Focused native confirmation passes (`canvas-owned-diagnostic-policy/`): all six SVG/SVGIMG/PNG x immersive combinations render, selected-node preview growth is 2.006x, independent-copy geometry is unchanged, fullscreen/template workflows and cleanup pass. Both real native negative controls pass.
A stylesheet-unload exception also occurred while that extra popout was alive;
production code remains unchanged. It is not classified as a ResizeObserver
notification. The focused run has no such exception after correct owned-window cleanup; reassess if it recurs.

## F16 - First complete attempt: strict storm failure and mobile activation

`native-repeat-1/` at plugin 0e6c48c5 is failed and retained. All 172 desktop
behavior cases, lifecycle, Extras including real PDF, data integrity and Canvas
pass. The Lucide scenario completes its functional assertions but leaves an empty
host sidepanel/layout behind; the post-scenario idle check records roughly
60 ResizeObserver notifications/second and fails within five seconds. No storm
waiver or production change was made. The scenario now restores its original
layout. A trusted command-palette/open/close control checks idle while the ordinary
picker is open and after closing it, before the exhaustive workflow.

Phone and tablet each complete 41 of 43 behavioral obligations. Both remaining
failures use saveReopen after deliberately activating another drawing: the helper
reopens its owned tab without selecting it, then checks an inactive editor's
form factor. Disk-save checks pass. The helper now explicitly selects the owned
leaf before/after reopen; scene-ID, durable-save and form-factor checks remain.
All 40 device interaction/layout profiles executed; six earlier desktop profiles
fail the inherited notification storm and the two feature-bearing profiles also
reflect their workflow failures. Cleanup and baseline restoration pass. Neither
required full repeat has passed yet.

## F17 - Mobile embedding exception: approved focus correction

The isolated command below reproduces the exception with only the embedding
workflow selected; its rendering/save/reopen assertions pass but the JavaScript
error gate correctly fails:

```powershell
node scripts/testing/host/verify.mjs --profile=devices --device-profiles=phone-portrait-light --behavior-cases=drawing-and-markdown-embeds
```

`mobile-embeddable-isolated/` records Obsidian's mobile-toolbar `update` calling
`activeEditor.editor.hasFocus()` while the active editor is the plugin-owned
embedded Markdown preview with no editor. The active drawing remains Excalidraw.
Inspection of Obsidian 1.14.5's actual `createFileNode` implementation confirms
that omitted `focus` defaults to selection/focus of the new node. The plugin's
internal Canvas-node factory omitted that option. The maintainer explicitly
approved the narrow fix: create this internal node with `focus: false`, preserving
deliberate editing activation. This correction is now implemented, with four
actual-method regressions covering construction, replacement, explicit editing
and a negative control reproducing the old missing-editor failure. All four pass.
The existing `patchMobileView` visibility workaround remains unchanged: preventing
unrequested editor activation does not establish that mobile visibility patching
can be removed. Native confirmation at plugin `38bf80fb` now passes the isolated
phone case with actual mobile mode, a 390 x 844 viewport, decoded rendering,
save/reopen, no window errors and successful device/baseline restoration. The
exception gate has not been weakened. [Sanitized evidence and artifact hashes](testing-evidence/3022/focus-correction-summary.json).

The next independent-core run retains failures from cleaned scenarios instead of
omitting later unrelated cases. Pending native work still stops the sequence.
The nested-pane context-menu driver also now sends its trusted press/release in
one CLI dispatch sequence, avoiding an uncontrolled CLI-duration button hold;
selection, shortcut, save/reopen and scene assertions are unchanged.

## F18 - Deterministic baseline layout and Canvas level of detail

The first independent core attempt restored a prior open-sidebar layout, leaving
Canvas only 380 pixels wide. Its fitted multi-node scene correctly used Obsidian's
far-zoom placeholders, so rendered-preview assertions failed. This is distinct
from F15's wrong-window targeting. The seed now includes an explicit single-tab,
collapsed-sidebar baseline, applied and verified through the live workspace API.
Canvas also collapses sidebars for its fit/resize measurement. No production
rendering policy or preview/resize assertion changed. Safe task failures now carry
an explicit cleanup-verified marker so independent scenarios can continue; actual
unsettled work still stops all subsequent work.

## Verified independent checkpoint (2026-10-29)

At plugin 3fc7cc9c / fork 053a3b9 / Extras 1cdcb7c, all 59 independent core cases
plus the focused nested-pane toolbar/context-menu case pass. This includes all 15
popout drop variants, real PDF decoding/visual inspection, cleanup and declared
baseline restoration. Both actual native negative controls pass. There are zero
recorded notifications or unexpected exceptions in that run. Fresh portable
verification passes 650 canonical cases (52 new, 598 reused), plus source/package
gates. [Sanitized, accessible evidence](testing-evidence/3022/README.md) records
case results and actual source/artifact hashes.

This does not establish full acceptance: neither complete matching-build repeat
has passed. The approved F17 correction is now independently confirmed above. CLI accounting includes the
Lucide case's real native commands: six CLI-bearing cases in the full plan, with
the two mobile public EA protocol cases reported separately.

## Foreground-access interruption after the focus correction

The next full attempt at plugin `38bf80fb` passed all 172 desktop behavioral
cases and reached the independent/device workflows. It also recorded a parsed
keyboard redo/submission mismatch and a trusted pointer timeout. The maintainer
requested foreground use of another Obsidian vault during this interval. A focus
conflict is plausible, but causation is not established; retain both failures and
rerun the unchanged assertions with exclusive access before classifying them.

The native dispatcher was stopped to avoid further UI interference. Its owned
task settled with cleanup passed, no print work was pending, and recovery restored
the exact device geometry and declared vault baseline. Both plugins are ready;
no test tasks, print resources or popouts remain. This interrupted attempt is not
one of the two required complete repeats. Foreground tests remain on hold until
the maintainer signals availability. Independent background portable validation
passes 654 canonical cases (56 new / 598 reused), plus source/package gates.

## F19 - Exclusive input recheck and failed full acceptance at 9c08d814

The maintainer confirmed exclusive foreground access. The unchanged text-undo
scenario passes all 16 parsed/raw, keyboard/button variants, including parsed
keyboard wikilink redo and unchanged submission. The unchanged first desktop
trusted-pointer profile passes drawing, physical save and restoration. No window
or unexpected JavaScript errors occur in that focused rerun. The prior failures
remain preserved; foreground interference is plausible but not established.

Fresh portable verification at 9c08d814 / 053a3b9 / 1cdcb7c passes 654 canonical
cases and source/package gates. The next full `npm.cmd run test:native` attempt
passes all 258 behavioral obligations and all 40 device/layout profiles, but fails
`native:stability-roundtrip:3` waiting for the large scene's first commit. Cycles
4/5 and the successful JavaScript-error gate remain missing. Eight uncaught
`illegal access` exceptions and one Obsidian `children` null-reference exception
are retained and fail the gate. The two exact trusted ResizeObserver notifications
in popout Markdown reading settle under the existing bounded policy; no exclusion
was broadened. Cleanup, baseline restoration and both native negative controls
pass. This is not a complete passing repeat: acceptance remains zero of two.

## F20 - Stability failure cleanup races Obsidian's file-delete handler

The captured Obsidian 1.14.5 stack resolves to its file-view `onDelete` handler:
after awaiting an empty-file open, it still accesses the leaf parent's children.
The test deletes the open file and then detaches its leaf while that handler is
pending, making the parent null. A deterministic actual-function regression fails
with the old order and passes when the test retires its view/leaf before deleting
the fixture. This is a test-only cleanup correction; production is unchanged.

That correction does not establish the cause of the earlier first-commit timeout
or the eight `illegal access` exceptions. Added passive per-cycle load snapshots
and a focused `--stability` selector for diagnosis without changing the six-cycle,
1000-element, save/reopen, root-retirement, rendering or timeout assertions. Both
full repeats must use a new clean checkpoint after any test-tooling changes.

## F21 - Current acceptance remains failed at 098e6ee1

The frozen test-only checkpoint passes build, 477 fast tests and the final portable
gate: 655 canonical cases (57 new / 598 reused), plus source/package gates. The
exact production audit passes and the production diff from reviewed 9c08d814 is
empty. The installed plugin remains 5,030,423 bytes with the same artifact hash.

A freshly built focused `--internal-drop --stability` run passes popout drop and
all six unchanged 1000-element save/reopen cycles with no notifications or
unexpected exceptions. Passive snapshots show each new editor reaching 1000
elements with a fresh API. This validates the corrected cleanup, not the cause of
the earlier load timeout.

The next full `npm.cmd run test:native` attempt passes all 258 behavior cases and
40 device profiles, but `text-undo-2976` fails with `history button unavailable`.
The parent records it as a feature-scenario failure, so its result and the later
20 required identities are missing. There are 336 recorded required passes, not a
complete 357-case pass. The helper does not retain its exact variant/action for
this direct eval error; capture button state/readiness and that label before
classifying the cause or changing assertions. The earlier unchanged isolated
16-variant run passes, so neither interference nor a product defect is assumed.

Four uncaught primitive `illegal access` exceptions are timestamped while
`native:lifecycle-dirty-popout-to-main` is active. Its persistence/scene assertions
pass, but exceptions remain fatal. No broader diagnostic rule is applied. The
first failed full attempt's two exact ResizeObserver notifications settle under
the bounded policy; the latest attempt has none. [Current sanitized reports,
counts, raw events, hashes and missing cases](testing-evidence/3022/README.md).

Both failed full attempts pass task cleanup, device/baseline restoration and the
two actual native error/layout negative controls. The working vault is installed,
both plugins are ready, and no tasks, print roots or popouts remain. Foreground
testing stopped; final portable checks use headless browsers and do not drive
Obsidian. Acceptance is zero of two complete passes. Keep all PRs draft and do not
merge. Next steps are focused text-action diagnostics, an approved fixed-host
migration comparison, and two fresh complete matching-build runs once blockers
are resolved. Production fixes still require explicit approval.

## F22 - Invalid text-mode fixture and exact history failure

At 65f63a30 the full desktop/core prefix reproduces `raw/button/wikilink`, second
undo after unchanged redo submission. Undo is present, visible, enabled and
uncovered in the correct main-window drawing. Its stack drops from three entries
to two, but raw source stays `[[other]]`; cached display is stale and link metadata
has changed. This is not an unavailable-button occurrence.

Native setup snapshots prove `changeTextMode(mode, false)` sets the view raw while
leaving its data model parsed. Tests now await the normal mode save/reload before
clearing the next scene/history. The same failing step then has two coherent
entries and restores source. All 16 variants pass after full predecessors at
e4a36a6b and 9cb6c5eb. Structural comparison preserves all 28 original assertion/
poll calls. The earlier unavailable-button occurrence remains unreproduced; no
control is skipped/retried, and no history assertion or deadline is weakened.

## F23 - Markdown-image test retires a still-closing drawing

Passive native snapshots at 4199a3dd show the crop helper signals tab close and
starts retiring its drawing while `sameFileEditGate.hasActiveOwners` is still
true. The non-crop helper's 100-ms sample is already released. Feature close is
asynchronous and includes native editor flush, save and reload; signalling close
is not its completion.

Only test tooling changes: a shared bounded helper waits for ownership release
and persistence completion before retirement, including failed-scenario cleanup.
Two offline controls prove asynchronous waiting and that deadline failure retains
the live owner without cancellation. At 9cb6c5eb both native image cases release
ownership before retirement. Existing dimensions/crops, disk save/reopen and SVG/
PNG assertions remain. This does not establish a cause or fix for the storms.

## F24 - Retained storms, finite evidence retrieval and host controls

The full e4a36a6b attempt fails the unchanged quiet/stable gate around web drop.
Pane geometry stays fixed while the event counter grows around 60/second through
desktop cleanup. It reaches 14,428. The old single-response raw retrieval exceeds
CLI capacity; complete desktop raw payloads are absent, with only idle counters
and the latest 50 CLI notification lines retained. This evidence limitation is
explicit. Finite prefix pagination now preserves large streams, tested above
4 MB without chasing later events. Device cleanup disposes its own listener even
if retrieval fails. No browser/production event or observer is suppressed.

At 9cb6c5eb native retrieval retains 674 exact notifications and one unrelated
window error. A post-run passive control observes 113 notifications while loaded,
112 with both community runtimes fully unloaded, and 115 after restoration, each
over two seconds. No debugger, input, drawing, popout or geometry sampling is
active. The active community runtimes are not required to sustain that loop; its
trigger remains unproven. F13's earlier focus-emulation reproduction does not
establish instrumentation as the sole cause of later notifications.

After retaining evidence, recovery reloads only the verified, fully saved
test-vault renderer. Other vault windows and installer remain untouched. Its final
two-second passive sample is quiet and both plugins/baseline are restored. This
recovery earns no acceptance credit. Storms still fail within five seconds; the
one-second quiet/stable interval, unrelated exception and cleanup gates remain.

## F25 - 2026-10-29 acceptance and runtime decision (historical)

Final portable verification at 9cb6c5eb / 053a3b9 / 1cdcb7c passes 662 canonical
cases: 64 new / 598 reused, plus source/package gates. Production build and the
exact accepted-scope audit pass. No production behavior changes follow f240fb86.

The e4a36a6b full attempt has 345 required passes, 11 failures and one missing
identity (`lucide-3019`), with all 258 behavior cases executed and 34/40 device
profiles passing. Five desktop native-CLI cases and both mobile public EA protocol
cases execute; all six desktop CLI cases execute in the later focused core. The
corrected core has no required identity missing, all text assertions and six
large-scene cycles pass, but strict acceptance still fails at Lucide idle and an
unrelated popout-close exception. No complete passing repeat exists: **0/2**.

Four primitive illegal-access exceptions recur during dirty popout-to-main after
desktop predecessors at 4199a3dd. Both migration routes can pass with the same
predecessors. Six alternating-route plain Markdown migrations pass with both
community runtimes unloaded. Those controls neither establish sole host causation
nor exonerate drawing migration. Current core additionally throws
`t.webContents.getZoomFactor is not a function` in Obsidian's `updateStatus`,
called during fresh popout close. Its installed callback reads Electron zoom
while checking the DOM window's closed state. No workaround or exception waiver.

Installed executable 1.14.0 runs app code 1.14.5 on Electron 43.3.0. The official
[1.14.5 installer](https://obsidian.md/changelog/2026-10-22-desktop-v1.14.5/)
uses Electron 43.8.3, including the related
[43.5.0 child-window teardown fix](https://releases.electronjs.org/release/v43.5.0).
A controlled comparison is proposed, not a proven resolution. Explicit maintainer
approval is pending; no installer or production change was made. [Accessible
case results, complete available raw payloads, limitations and hashes](testing-evidence/3022/README.md)
are published. Keep all three PRs draft pending both complete native passes.

## F26 - Pixel-verifier CORS and missing-source setup

At bebf652f, eight Markdown pixel-verification cases fail because their verifier
loads vault-resource URLs without CORS opt-in. Native default/anonymous/fetched-
blob controls decode the same actual resources: default canvas reads throw
SecurityError; anonymous loading before `src` and fetched blobs expose the same
expected colors/transparency. The corrected verifier opts into CORS and creates
its canvas detached in the owning document. No production change, security
bypass, version branch or pixel assertion removal. The actual-helper regression
enforces CORS ordering and rejects live-body canvas insertion.

The missing-source case also deleted an image while its drawing editor remained
alive and required exactly one incidental filesystem error. Nested-split behavior
recovers correctly with zero such logs. Setup now retires the editor before
deletion, then reopens the drawing; the incidental-error allowance is removed.
All missing-reference, save/reopen, recreation and decoded-recovery assertions
remain. A second actual-source regression enforces retirement before deletion.
All 12 focused cases and both full attempts pass these behaviors at 9b2874ba.

## F27 - 2026-10-30 complete attempts and retained storm

The maintainer installed Obsidian 1.14.5 / Electron 43.8.3. Versions are recorded
metadata, never an exact-version allowlist, skip or altered success criterion.
The existing runner-success test now exercises a future alpha version. No
installer action was performed by the agent and no production behavior changed.

At plugin 9b2874ba / fork 053a3b9 / Extras 1cdcb7c, two complete native runs use
identical source revisions and all matching artifact identities. First: **357/357
pass**. Second: **350 pass / seven fail**, no missing IDs. Both pass all 258
behavioral obligations, 16 text-history variants, six large-scene cycles, all 15
popout-drop variants, physical save/cleanup and baseline restoration. Six desktop
cases use registered native CLI commands; both mobile public EA.executeCLI cases
are separate. Both actual error/layout negative controls pass in each attempt.

The second fails `lucide-3019` and six light desktop profiles (wide/narrow times
full/tray/compact) on the unchanged quiet-idle gate. Its 702 exact notifications
start inside the exhaustive Lucide probe, before the final screenshot. Functional
assertions pass and no unrelated JavaScript exception is captured. This does not
establish Lucide as the sole trigger or allow those failures to count as passed.

At diagnostic-only checkpoint 84a30be0, passive Lucide stage labels are retained
without changing actions or thresholds. Isolated Lucide passes with zero events.
The 172-desktop-plus-core replay retains 16,879 notifications: one earlier popout
Markdown notification settles, but a sustained loop starts during
`native:lifecycle-new-popout-survivor`, before Lucide. Subsequent parent idle and
cleanup-idle gates fail. All functional cases execute; all history variants and
six large cycles still pass. Restoration succeeds but does not waive failed idle.

After restoration, a two-second passive sample captures 120 notifications with no
debugger, input, layout sampling, drawing or popout. The unload control records
120 loaded, 121 with both community runtimes unloaded, then zero while restoring.
A short native timeline records repeated resize-delivery phases and JavaScript
error-handler calls; it does not identify the observer. Isolated lifecycle passes
with zero events. The 43-popout-case prefix followed by lifecycle passes with one
transient notification that settles. Three empty-popout controls (no added
observer, test-owned main-realm observer, owning-realm observer) are clean with
both community runtimes unloaded. These controls do not prove sole host causation
or justify a production observer change. Earlier focus instrumentation did trigger
a loop; sole instrumentation causation of every later event remains unproven.

The exact diagnostic policy is unchanged: one second of stable geometry and
notification-free idle within five seconds. Storms, unrelated exceptions,
unresponsive controls, failed behavior/persistence and cleanup fail. No browser
event or production observer is suppressed or patched. The earlier illegal-access
and getZoomFactor exceptions were not reproduced here; historical evidence stays.

Final portable at 84a30be0 passes **664 cases: 66 new / 598 reused**, plus source,
package, build and declaration gates. Exact production-diff audit passes. The
first full PDF is decoded and visually inspected: 10,616 bytes, one 288 x 216 pt
page, expected text and 3330 red pixels. PDF rollback remains completion-driven.

The historical pair is one pass and one failure, not accepted. Two fresh complete
matching-build passes remain required at the resolved checkpoint. Next: isolate
state retained between desktop workflows and fresh-popout teardown; propose a
minimal production fix for explicit approval only if evidence supports it. No
additional full reruns were spent after the ordered reproduction. Keep all PRs
draft. Sanitized cases, raw payloads, source/artifact hashes, controls and restored
baseline are [published together](testing-evidence/3022/README.md). Final installed
plugins are ready with no owned work and a quiet passive sample; recovery earns
no acceptance credit.

## F28 - Ordered reductions and unmatched visibility (before approved trace)

At 780d1440, main -> split -> lifecycle passes with zero notifications; nested
split -> popout -> lifecycle passes with one settling notification. Their
document visibility is hidden, unlike the historical visible failing prefix.
They therefore do not clear that failure. Native inspection finds the window
visible/focused/non-minimized while its document reports hidden. Ordinary native
show/focus restores visible state in 58 ms without emulation or renderer reset.

The new passive reader initially misclassifies internal registrations. Installed
source uses Events._ for event-name maps and Component._events for cleanup
callbacks. The extended actual-shape regression fails before correction and
passes after; unsupported internals are explicitly unavailable. No production
observer or callback is patched by this reader, and behavioral errors propagate.

At f5d5d217, the visible nested-split/popout prefix and then a visible
split/nested-split/popout prefix both pass with one settling notification.
The exact original 172-case prefix followed by lifecycle passes with snapshots
off (two settling notifications) and on (zero). All frozen artifacts match the
historical complete pair. Settings, inspected registrations, layout/sidebar,
root/popout and temporary scheduling evidence return to their expected baseline.
No retained leak in these inspected fields or a stable failing reduced sequence
is demonstrated. No sole instrumentation/host causation or harmlessness follows.

Final portable passes 666 cases (68 new / 598 reused), including 488 plugin fast;
source/package/build/declaration gates and production audit pass. No new full
native run is attempted because the intermittent trigger is unresolved. The
historical failed pair and raw notifications remain unchanged and all PRs stay
draft. A 30-minute diagnostic-only observer creation/target-lifetime trace is
proposed, requiring an explicit exception to the earlier no-patching rule. It is
not implemented or run. No production/PDF change, suppression, threshold increase
or mid-run renderer reset was made. [Accessible reductions and boundary state](testing-evidence/3022/resize-reduction-2026-10-30.json)
include exact source/artifact identities, cases, raw diagnostics and restoration.

## F29 - Approved ownership trace and minimal frame-lifetime control

The explicitly approved 30-minute diagnostic ends live experiments at
10:49:39 UTC, before 10:51:04. Main/popout observer construction and method calls
are intercepted only in the diagnostic run; callback receiver/arguments/return/
throw and restoration checks pass. The traced prefix/lifecycle/Lucide sequence
passes with one settling notification, 2,331 observer records and no tracer errors.
It earns no acceptance credit. Interception is removed, followed by a verified
saved-baseline renderer-only reload to clear captured wrappers. Native methods
and quiet restored service/layout state are verified afterward. No production or
printing code is changed; no observer suppression or idle threshold change.

The smaller matched test uses only a native ResizeObserver and same-origin
iframe DOM, with both community plugins unloaded and no workspace/popout calls.
An element is adopted into the iframe before registration, and the iframe is
then removed while the observer remains. No observer: zero notifications in the
one-second sample. Main-document constructor: 62. Iframe constructor: zero.
Disconnecting the test-owned main observer stops the iframe notifications. Last
delivery remains nonzero (123 x 81), with no zero-size delivery before disconnect.
A separate iframe case records 61 messages; a frameless-HTML-document control is
quiet and delivers zero size. This isolates a retained cross-frame observation
mechanism, not the exact responsible observer in the original failing suite.

The popout reproduction also occurs through native BrowserWindow.close with
both plugins unloaded; replacing DOM window.close alone is not supported as a
fix. Contaminated/aborted controls and startup/readiness refusals are documented
without credit or invented counts. Detached WeakRef targets alone are not called
leaks; available targets at trace end include host workspace containers but no
available cross-realm target. Missing/collected targets are not miscounted.

All small controls temporarily use backgroundThrottling=false, as existing native
tooling does. A matched scheduling comparison under verified visible conditions
remains necessary before classifying tooling versus production/host responsibility.
No sole host cause or harmlessness is concluded, and the one-second samples are
not represented as a measured five-second gate failure. Historical long storms
remain failures. The diagnostic cap is over; a bounded untraced follow-up is
proposed, with permission pending. Source archives, full observer records, raw
controls, matching artifacts and removal/recovery proofs are
[accessible together](testing-evidence/3022/observer-diagnostic-2026-10-30.json).

## F30 - Scheduling comparison complete; original observer still unidentified

The maintainer authorized continuation without further time-extension questions.
This follow-up uses native observer constructors and methods throughout, with
no interception. Under verified visible/focused conditions, normal scheduling
produces 0/62/0 iframe notifications (none/main/owner constructor); unthrottled
scheduling also produces 0/62/0. Reverse-order repetitions produce 0/62/0 and
0/61/0. Only the test-owned observer is disconnected; all next-second samples
are quiet and original scheduling is restored. The smaller mechanism does not
require the tooling's throttling override. This does not identify the original
suite observer or establish a five-second failure from one-second samples.

Fresh automatic build/deploy/hash/configuration at plugin `ab1ef6da`, fork
`053a3b9`, Extras `1cdcb7c` matches all frozen artifacts. The 172-case desktop
prefix, original lifecycle and six saved/dirty close controls pass all 183 child
cases with zero notifications. Saved/dirty 2,000-element closes pass. All 40
profiles plus both 43-case phone/tablet workflows pass, followed by another
desktop/lifecycle/Lucide replay with two settling notifications and passing
restoration. A real pending save during a 2,000-element popout close hands off
persistence successfully, reaches disk and retires its API/root without errors.
The host-only resize/close timing controls and hidden-popout close are quiet for
5.5 seconds with both plugins unloaded and no added observers.

The first isolated close probe omitted its parent result status. All six child
assertions passed, but the parent correctly failed; that failed evidence is
preserved. The ignored wrapper was corrected before the distinct ordered probe.
No maintained test assertions or production behavior changed. These are
diagnostic occurrences, not new canonical coverage or complete native repeats.

Passive evidence confirms the fresh lifecycle popout is visible/focused before
closing. The real pending-save probe observes a main-realm ToolsPanel observer
and an API/root still present at the first closed-window check, but no notifications. These
observations alone do not justify a constructor or lifecycle production change.
Fresh portable validation passes 666 (68 new / 598 reused), with all source,
package, build and declaration gates; production audit passes. The installed
vault is restored, quiet and usable, with no tasks, print roots or popouts.

The original sustained failure remains unresolved. Renewing the earlier
forwarding-only trace over the full desktop/core sequence was rejected before
execution by automatic approval review: the original exception expired and the
later authorization specified untraced controls. No trace was installed or
rejection bypassed. Explicit trace approval is pending. No full acceptance
retry, production/PDF change, exception exclusion, timeout increase or diagnostic
renderer reset was used in this continuation. Required mobile-mode changes and
restoration reload Obsidian through its normal emulation command. Keep all PRs draft and retain the required
two fresh matching-build complete passes. [Sanitized case evidence and source
archives](testing-evidence/3022/observer-scheduling-followup-2026-10-30.json)
include failed-wrapper evidence, raw notifications and exact artifact hashes.

## F31 - Full desktop/core trace and matched untraced comparison

The maintainer instructed autonomous continuation within the PR purpose. At
plugin `fd32ac68`, fork `053a3b9` and Extras `1cdcb7c`, the forwarding-only trace
passes all 231 required desktop/core identities and records 3,511 observers,
1,478 targets and two isolated settling notifications. Recording failures and
overflow are zero. Its available closed-document observation has a final
zero-size delivery; no available target fits the smaller nonzero-size orphaned
condition. WeakRef liveness, missing targets or ownership mismatch alone do not
identify the historical storm's cause.

The trace is removed and native methods restored. A verified saved-baseline
renderer-only reload clears captured wrappers after the completed diagnostic,
outside acceptance evidence. The matched untraced 231-case core run then passes
with one settling notification. Both use identical artifact bytes. Neither
focused run counts as a complete acceptance repeat. No production, lifecycle,
observer gate, timing threshold or upstream-test change follows this diagnosis.
[Complete comparison and raw trace](testing-evidence/3022/observer-core-comparison-2026-10-30.json)
retain identities, counts, target/constructor evidence, limitations and recovery.

## F32 - Two complete matching-build native passes

Both subsequent standard `npm.cmd run test:native` runs pass **357/357** required
identities, including all **258 behavioral obligations** and **40 device/layout
profiles**. Each has six registered desktop CLI-bearing cases and two public
mobile `EA.executeCLI` cases. All text-history variants, six stability cycles,
15 popout-drop variants, cleanup, baseline restoration and both native negative
controls pass. No identity is missing, skipped or replaced by a focused probe.

The repeats use clean plugin `fd32ac682e2aadc0f982fa23d36da482011117f9`, fork
`053a3b9f9e77917c457fce8ca9453d38b92a303b` and Extras
`1cdcb7c425a9b80afdc7b39c88861143b4b85e58`; artifact and seed hashes match.
No diagnostic loader, observer interception, optional state snapshots or
diagnostic reset is used between the complete repeats. Main captures retain one
and two exact transient notifications respectively, all settling; device captures
are quiet. Every unrelated exception/error and sustained storm remains fatal.

Final portable validation passes **666 cases (68 new / 598 reused)**, with source,
package, build and declaration gates. Production audit passes. Native accounting
remains 273 new / 84 reused; this completion adds no canonical test identities.
Each repeat performs a real single PDF export and verifies page/text/pixels and
resource cleanup; the final rendered page was visually inspected. The working
vault contains both installed plugins, restored configuration and no owned work.

The historical sustained observer trigger is still unidentified. Passing current
runs do not prove it was harmless or fixed; the failed evidence remains linked
and the strict gate is unchanged. Physical touch/WebView/stylus, real OS
drag/clipboard, native macOS/Linux and isolated whole-app cold start remain
separate environments. [Both complete case matrices and manifests](testing-evidence/3022/native-acceptance-pair-2026-10-30.json)
support review readiness without claiming those additional environments.

## F33 - Parsed-link submission discarded earlier drawing history

The maintainer reproduced drawing earlier shapes, A, a bound `[[link]]` label
and B, then undoing B and the label but being unable to undo A or earlier shapes.
Source execution confirms this predates the testing PR and the October 11 text
restoration fix. The parser submission branch explicitly cleared the entire
history whenever raw Markdown differed from parsed display text. The initial
focused native reproduction confirms the same failure: after two undos, five
rectangles remain with undo depth zero. Original evidence is retained under
`.test-work/reports/2026-10-30-link-history-before/`.

The maintainer authorized fixing this on October 30. Remove only that ordinary
parsed-link submission reset: the matching fork already captures raw Markdown,
parsed display and link metadata in the text transaction. Leave the independent
mode-switch, asynchronous-transclusion and invalid-clipboard reset paths intact.
No fork or Extras production code, observer or printing changes.

Four new source cases use the actual submission hook and parser for raw/parsed
and bound/standalone text, each checking plain text, wiki links, aliases and
Markdown links plus cache refresh after undo. Eight native sequences use real
CDP drawing/text input and keyboard/toolbar history. They undo B, the link text,
A and all four earlier rectangles to an empty scene, then redo the entire scene
and compare identities, geometry, source, links and bindings. The first fixed
probe exposed a test assumption: entering a label may capture a selection-only
entry. That failed evidence remains in `2026-10-30-link-history-after/`. The
corrected test explicitly verifies at most one such entry, no element delta,
unchanged scene and one consumed history entry; no drawing-action assertion is
removed. The final focused run passes all eight sequences and all 16 existing
text-edit variants, error controls, cleanup and baseline restoration:
`.test-work/reports/2026-10-30-link-history-verified/`.

Repeat with `node --test scripts/testing/textSubmissionHistory.test.mjs` and
`npm.cmd run verify:obsidian -- --text-undo --diagnostics`. Broader portable and
build verification uses `npm.cmd run test:regression:portable`; the exact
production audit now includes this specifically authorized patch. Native case
identity remains `text-undo-2976`; no earlier complete-run evidence is relabeled
as testing this later fix. Main-window trusted input is covered; popout and
physical mobile remain separate risk checks for this follow-up.

Broader verification also exposed an independent fork-owned browser setup
error. After the preceding tool workflow already selects Selection, clicking
that active toolbar button intentionally activates Lasso. Passive failure
capture confirms `activeTool.type === "lasso"`; the existing readiness assertion
correctly fails. Guard only that redundant setup click. All 18 normal browser
cases then pass with the original group/delete/history assertions unchanged.
The fork inventory records this test-only correction. Use the documented
`PLAYWRIGHT_BROWSERS_PATH` when running portable checks; no browser upgrade is
needed. Initial failed reports remain in the ignored local evidence directories.

Local deployment verification caught a settings-file rewrite during reload.
The original backup was restored while the plugin was unloaded, then loaded
again and verified byte-identical after settling. The fixed runtime and drawing
editors are ready. The rewrite's original cause is unassigned; no settings
production change is included, and private settings/backups remain untracked.

## F34 - Settings replacement during reload: unsafe late-save path reproduced

The preserved deployment evidence shows a substantive replacement, not merely
canonical JSON ordering: 212 persisted keys became 187. Canonical comparison
against source literals matches 178 of 179 comparable default properties; the
exception is the normal once-off compression-reset flag. Eight computed defaults
are outside that static comparison. The replacement differs from the native
vault's configured fixture, and the two vaults have distinct recovery namespaces.
This supports default initialization/persistence as the failure mechanism; it
does not prove which load or save initiated the incident.

There is a concrete unsafe lifecycle path. `onunload()` destroys the settings
manager and sets `settings = null`. The manager's `destroy()` closes the recovery
store but does not reject later `saveSettings()` calls. The API-key persistence
helper spreads its input (`{ ...settings }`), so a null input becomes an empty
object. The still-active writer can then save `{}`. The loader accepts an empty
object as a valid record and fills defaults on the next load.

An isolated reproduction executes the actual manager, serialization writer and
key-obfuscation modules with fake storage: destroy the manager, clear host
settings, invoke a late save. It performs one write after destruction and loses
the non-default sentinel. This is evidence of the unsafe path, not a native
capture of the original callback. The private diagnostic is
`tmp/reproduce-late-settings-save.mjs`, with results under the ignored deployment
evidence directory; no real settings are used in that reproduction.

Existing native coverage saves/loads settings on a live plugin instance. The
separate plugin-reload case asserts drawing/runtime/command survival, without
asserting custom settings across that boundary. A combined regression must use
non-default values and unknown keys, cover delayed saves during teardown, reload
the plugin, and check both persisted data and loaded preferences. Keep any
production fix separate until approved. Original settings were restored from
the exact backup and their loaded preferences verified. No additional reload
experiment was performed in the personal vault for this diagnosis.
