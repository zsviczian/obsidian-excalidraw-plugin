# Test findings for maintainer review

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

## F17 - Mobile embedding exception: production approval pending

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
internal Canvas-node factory currently omits that option. Proposed narrow fix:
create this internal node with `focus: false`, preserving deliberate editing
activation. The maintainer has been asked for explicit approval. No production
change or exception filtering has been made for this finding.

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
