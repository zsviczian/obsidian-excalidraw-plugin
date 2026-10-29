# Obsidian runtime testing on macOS and Windows

Use the repository-local, marker-owned vault:

`obsidian-excalidraw-plugin/.test-work/vaults/excalidraw-auto-test/`

From the plugin checkout, the preparation-and-test entry point is:

```powershell
npm.cmd run test:native
```

On macOS use `npm run test:native`. This builds current selected workspace
revisions, freezes them, installs the real plugin and available Extras binaries,
hash-verifies deployment, applies deterministic settings, enables both plugins,
verifies the running CLI-selected canonical vault/config paths, runs the expanded
native suite and restores the declared baseline. Every CLI call explicitly uses
`vault=excalidraw-auto-test`. Conflicting inherited vault environment variables
are rejected before mutation. There is no personal/default/desktop-vault fallback.

## One-time preparation

1. Install this checkout's npm dependencies, the sibling fork's Yarn dependencies
   and available Extras npm dependencies. Use Node 22.22.3 or newer.
2. Run `npm run test:native -- --prepare-only` to build and install the working
   vault before opening it. This is the same entry point with execution omitted;
   a copied seed without binaries is not a prepared installation.
3. Open that exact folder as a vault in Obsidian once. Accept the community-plugin
   trust prompt and enable/register **Settings ? General ? Command line interface**.
   Leave the vault open. The runner never edits the global vault registry.
4. Repeat `npm run test:native`. Subsequent runs require no manual copying,
   plugin enabling or Extras service configuration.

The immutable seed in `tests/vault/` contains synthetic CC0 notes, drawings and
assets plus `.obsidian` configuration and both plugins' `data.json`. The runner
copies current builds into the working vault's plugin directories:

- `.obsidian/plugins/obsidian-excalidraw-plugin/{main.js,manifest.json,styles.css,data.json}`
- `.obsidian/plugins/excalidraw-extras/{main.js,manifest.json,styles.css,data.json}`

Executable builds, installed manifests and runtime work are ignored, never
committed as fixtures. `.excalidraw-automation.json` records ownership/seed
identity; `.excalidraw-installed-build.json` records installed hashes and frozen
producer provenance. Latest means these selected workspace revisions, including
recorded dirty-diff and lock hashes. Missing Extras is explicit and cannot count
as passed service coverage.

## Focused and complete commands

| Command | Work |
| --- | --- |
| `npm run test:native` | Preparation, complete native core and expanded behavior matrix, popout drop variants and device workflows |
| `npm run test:native -- --prepare-only` | Build/freeze/install/apply configuration; report first-open prerequisite or verify live readiness |
| `npm run test:regression` | Complete native work plus independent portable/source/browser/package gates |
| `npm run verify:obsidian:smoke` | Same current-workspace preparation, then focused editor startup |
| `npm run verify:obsidian -- --extras-services` | Same preparation; real MathJax/Mermaid gateways and a single native PDF export |
| `npm run verify:obsidian -- --behavior-matrix` | Same preparation; expanded desktop/main/split/nested/popout behavioral workflows |
| `npm run verify:obsidian:diagnostics` | Same fresh-build preparation, then the real unhandled-error negative control |

The historical `verify:obsidian:plugin` name is retained as a command alias; it
now prepares current workspace inputs too. `--plugin-only` is rejected. No native
sequence silently consumes a previous installed artifact. Set
`EXCALIDRAW_FORK_ROOT` / `EXCALIDRAW_EXTRAS_ROOT` only for non-sibling checkouts;
the dedicated target vault remains local to this plugin repository.

For portable checks install the fork's pinned Chromium once (`yarn playwright
install chromium`, with `--with-deps` on Linux CI). Native input uses the real
Obsidian Electron host and its owned debugger, not Playwright's Chromium.

## Transport, ownership and safe cleanup

The Windows launcher discovers `Obsidian.com` under the standard installation
locations; use `EXCALIDRAW_OBSIDIAN_CLI` for another executable path. macOS uses
the installed Obsidian CLI/application binary. See the official
[CLI installation guide](https://obsidian.md/help/cli). The driver launches
npm/Yarn through the current Node binary and passes native argument arrays.
Long Windows evals use an owned temporary UTF-8 script cleaned after each call.

All native work is serial under the application-user-data lock, including build,
preparation, staging, debugger ownership and cleanup. Never detach another
owner's debugger or restart a shared application. Whole-app cold restart remains
an optional, separately guarded isolated-session workflow.

Every scenario owns its exact UUID files/controllers. It waits for asynchronous
work and physical save acknowledgement before deleting owned data. Successful
runs restore declared settings/theme, fixture content and preferences, retain the
installed working vault for inspection and record cleanup/restoration evidence.
Reports live under `.test-work/reports` or `EXCALIDRAW_TEST_REPORT_DIR`.

A tooling deadline is a failed test, not cancellation of native printing.
Unsettled native work retains its resources/controller/files and recovery record.
Do not delete or reload it while a native promise is pending. The single-export
PDF scenario waits for real completion, verifies its header/page geometry/text
and decoded pixels, and retains `native-single-export.pdf` plus its rendered page
in the report directory. There is no native concurrent-print acceptance test.

The expanded matrix records actual mobile mode, measured geometry, scene state,
saved/reopened data, decoded output, errors and cleanup. Trusted CDP interaction
and synthetic drag payloads are labeled separately. Phone/tablet emulation is
not physical Android/iOS, native OS drag or stylus evidence.

## Earlier focused scenario details

The following scenario notes retain their feature-specific assertions. Their
native execution now uses the preparation and local vault contract above.

## Troubleshooting and further coverage

For the Lucide picker, run `npm run test:lucide`, then the guarded
`npm run verify:obsidian:plugin -- --lucide`. Protocol 3 requires the matching
component artifacts and declarations. For a temporary paired checkout, build the
fork, copy its four Obsidian artifacts as described above, and set
`EXCALIDRAW_FORK_ROOT` to the fork root for the generated declaration
preflight. This is local integration, not published dependency verification.

The Lucide lane checks read-only paginated discovery, atomic create/apply,
group/member handles, deterministic style and all three insertion presets,
workbench-only construction across the installed catalog, bounded picker DOM,
search/keyboard navigation, selection, native Undo/Redo, two-drawing styles,
popout targeting, deferred stale-target refusal, session reuse, export and saved
read-back. Malformed installed icons are recorded as rejected inputs, never
counted as successful conversions. The existing `--svg-import` lane retains the
supplied corpus read-only. Physical touch, restored popouts after cold restart
and other operating systems remain separate gates.

For text separators and editable-image geometry (#3013, #3014, #2947), run
`npm run test:image-geometry`. These tests cover one/multiple newline separators,
independent image copies, unresized content growth, a resize during rendering,
cancelled renders, reload geometry, crops, and versioned LaTeX bounds updates.
Run `npm run verify:obsidian:plugin -- --image-geometry` for real formula editing,
cached bounds, and save/reopen in the main window and a popout. Its deterministic
SVG gateway tests the plugin lifecycle without requiring Extras or claiming to
test MathJax rendering. The scenario also opens the actual Markdown-image
sidepanel, edits content after a canvas resize, and checks the displayed size
after rendering and reopen. It waits for the render-complete indicator between
edits; a metadata update alone does not establish that persistence has finished.
The temporary gateway, owned panel tab and fixtures are cleaned up.

The Markdown sidepanel case also duplicates an image with the same file ID,
gives the copy a different canvas size, and changes the editor's Width input.
Both instances must adopt the new intrinsic dimensions without moving. A later
content edit and save/reopen must keep their shared width and file ID. Source
tests also cover unrelated images and a duplicate created during rendering.

A separate owned Markdown table case creates two cropped siblings (one full-width
and one aligned to the right edge), then changes the uncropped copy's Width up
and down through the real sidepanel input. It checks relative crop windows,
finite geometry and aspect ratios, reads saved geometry back from disk after
each edit, exports SVG and PNG, edits content, and reopens the drawing. Crop
geometry is initialized through the scene API with the same fields as the crop
tool; physical crop gestures and popout/mobile crop editing remain manual checks.
Source regressions also verify that cropped local Markdown/equation images skip
PDF-link synchronization during saving while file-backed PDFs retain it.

With Excalidraw Extras installed and **MathJax-to-SVG** enabled, run
`npm run verify:obsidian:plugin -- --image-geometry-real`. This uses the actual
Extras renderer for the #3014 short/long formula edits, cached bounds and
save/reopen checks in the main window and a popout, plus both Markdown sidepanel
cases. Latex Suite is not required; its preview-specific gate remains separate.

On 2026-10-26, the real Extras renderer passed formula expansion/shrinkage,
matching cached bounds and save/reopen in both windows. The short formula was
20×11 and the expanded formula 80×15, with matching runtime bounds. The Markdown
sidepanel cases, including cropped table Width changes from 500 to 700 to 300,
disk save/readback, SVG/PNG exports and reopen, and fixture cleanup also passed.
All four feature cases passed. The overall run failed its
clean-error gate on the previously recorded ResizeObserver teardown
notifications; this real-renderer run is not an overall clean pass.

For wheel zoom limits (#3008), run
`npm run verify:obsidian -- --wheel-zoom`. It builds/copies the local fork and
dispatches actual wheel events with deliberately changed live minimum/maximum
settings, including scroll constraints and zoom above 3000%, in the main window
and a popout. Test settings are restored without saving them. This option can
be combined with `--image-geometry`. Use the current-workspace lane only after the
installed component contains the fix. Unpublished artifact copies remain a
local integration checkpoint; the declared published dependency is unchanged.

On macOS, both feature scenarios passed on 2026-10-26, including formula
expansion/shrinkage, matching cached bounds and reopen. Fixture cleanup passed.
The overall clean-error gate failed on the already documented popout teardown
`ResizeObserver loop completed with undelivered notifications`; no clean overall
native pass is claimed. Windows, Linux pen input and physical mobile remain
separate validation environments.

A later combined-development-build run of `--image-geometry` passed the entire
native runner, including its clean-error and cleanup gates, formula main/popout
cases, and the real Markdown sidepanel resize/edit/reopen case. The earlier
ResizeObserver failures remain recorded; one clean run does not establish that
the intermittent teardown issue is fixed.

For browser drag actions (#2967), run `npm run test:drop-actions`, then
`npm run verify:obsidian:plugin -- --web-drop`. The native scenario serves an
owned tiny PNG over localhost and supplies mixed Files/URI-list/HTML payloads
with deliberately conflicting web/local modifier maps. Twenty cases check
URL-backed versus vault-file references, actual PNG attachment bytes, linked
image versus page targets, extensionless/blob URL file fallback, and save/reopen
in the main window and a popout. The source tests also exercise the production
URL recognition helpers, hook consumption, internal drags, genuine OS-file
actions, and duplicate-file Use/Overwrite/Import choices. Settings are restored
and only newly created, owned attachments are removed. No external image service
is contacted. Cancellation waits for scenario cleanup before the parent removes
the disposable drawing.

On macOS on 2026-10-26, all twenty native cases and fixture cleanup passed.
The overall runner failed its clean-error gate on the previously observed
popout ResizeObserver loop notifications; no unrelated observer fix is claimed.

These synthetic payloads do not establish physical Windows browser drag
behavior. Before merging #2992, manually check a browser image and linked image
with all four web actions, a search-result image with an extensionless URL,
YouTube thumbnail import/navigation, and a real OS-file drag repeated through
the Use/Overwrite/Import choices. Save/reopen the drawing, and repeat the linked
image case in a popout. Extensionless/blob image references use the supplied file
as a vault attachment because they cannot be persisted as a supported image URL.

For internal file eligibility, run `npm run test:drop-actions`, then
`npm run verify:obsidian:plugin -- --internal-drop`. The native scenario uses
Obsidian's file-drag payload factory and the live modifier mappings with owned
font/image fixtures in main and popout windows. Unsupported fonts must advertise
only Insert link, with no other-modifiers hint, and insert a link regardless of
the requested image/frame action. A real PNG must still advertise and insert an
image with Shift. Both workflows survive save/reopen; fixture files, tooltip and
drag/controller state are cleaned up. Source tests cover default Mac/Windows
modifiers, singular/plural payloads, Markdown/PDF/media support and registered
custom views. These synthetic events supplement real drag gestures.

For YouTube thumbnail URL regressions, run `npm run test:drop-actions`, then
`npm run verify:obsidian:plugin -- --youtube-drop`. This opt-in network scenario
requests the reported public video's JPEGs from `https://i.ytimg.com`. It checks
Chrome-style link and mixed thumbnail payloads with both image URL/import
actions in main/popout windows, real JPEG decoding beyond the missing-image
placeholder size, retained video navigation, vault storage and save/reopen.
It also dispatches DOM drop events through the canvas with the live Option frame
mapping (Ctrl+Shift on Windows), covering plain/URI/HTML-only links and thumbnails
with and without Files. The original drag data is cleared after synchronous
dispatch. The plugin must hand off an independent URL-only transfer so Excalidraw
can parse it asynchronously and own provider-specific insertion and sizing.
Twenty-two frame cases check native YouTube (560×315), Shorts (315×560), Vimeo
(560×315) and Twitter (480×480) dimensions, frame mounting and save/reopen. With
image cases this makes thirty checks across main and popout windows. The provider
frames use public URLs; their third-party content may load during these checks.
Only owned drawings and newly created attachments are removed, and modifier
settings are restored. The source tests cover the actual thumbnail URL resolver
at every fallback resolution, including the required `/vi/` path and tracking
parameters. This mode needs network access; the ordinary `--web-drop` scenario
continues to use localhost only.

For Markdown embed changes, run the focused tests and the native regression for
issue #2953:

```bash
npm run test:markdown-embeds
npm run verify:obsidian:plugin -- --embed-recovery
```

Use `npm.cmd` in PowerShell. `--embed-recovery` also works with `verify:obsidian`
and can be combined with `--text-undo` or `--grouped-link-click`. The offline tests exercise the real
postprocessor with deferred image generation, including failed renders, temporary
detachment, overlapping attribute updates, repeated callbacks, loader cancellation,
and permanent context unload. They require no Obsidian process or extra DOM package.

The native scenario creates four UUID-named Markdown files (including a hybrid
drawing), one tiny PNG, and adds text to the parent runner's disposable drawing.
A long embedded note uses a collapsed callout
so three repeated drawing embeds stay in the viewport. It temporarily defers the
test plugin's `awaitInit()`, detaches the owned note's content for longer than the
loader's cancellation interval, and verifies rendering and decoding after
reattachment. SVG image, PNG, and inline SVG are checked in Live Preview, Reading
mode, warm reopen, and width updates; an additional popout checks detachment and
width updates in its own document. Closing a context with a pending render must
stop insertion. The hybrid fixture uses `excalidraw-open-md: true`, a relative
`![[#^as-image]]`, a nested drawing, and a native PNG. Live Preview and Reading mode
must show all three, both directly and inside another note's Markdown transclusion;
a filename-qualified `#^as-image` must still force the drawing side. These checks
run in the popout and require a Markdown drawing for the parent smoke fixture.
The scenario restores the temporary method override and preview
setting, closes its own leaves, deletes only its recorded fixture paths, and
removes its controller in `finally`. The parent runner still checks deployed
hashes, JavaScript errors, and drawing cleanup.

This is a controlled lifecycle regression, not a reproduction of every reported
layout race. Separately check an expanded long embedded note and scrolling,
Hybrid Note PDF export, and cold application startup. Record live macOS and
physical mobile coverage separately; Windows results do not establish those gates.

For grouped Ctrl/Cmd-click selection and link navigation, run:

```bash
npm run verify:obsidian:plugin -- --grouped-link-click
```

This regression dispatches synthetic pointer events through the mounted editor.
It checks first-click selection, unlinked members, second-click navigation with
Shift/Alt, nested groups, bound labels, and unchanged ungrouped link behavior.
It observes the real link resolver and intercepts its final navigation hook to
keep the test in its disposable drawing. Settings and hooks are restored afterward.
This establishes desktop event routing, not physical mouse/touch input.

For text-edit/history changes, run the repeatable regression for issue #2976:

```bash
npm run verify:obsidian:plugin -- --text-undo
```

Use `npm.cmd` in PowerShell. The same `--text-undo` option works with
`verify:obsidian` for a fork integration build. The complete #2976 fix also needs
the component's unchanged-text history fix, included in the paired source
checkpoint but pending package publication. Until the next component package and plugin dependency update,
use `verify:obsidian` with the matching sibling source to test the complete pair;
the declared `0.18.140` package does not include that component fix. The scenario
uses native CDP
keyboard input and the **Undo**/**Redo** toolbar buttons in the runner's
temporary drawing. It checks raw and parsed text modes, reopening after undo and
redo, submitting without changes, editing after undo, Markdown source preservation,
and legacy/empty source handling. The matrix includes plain text, `[[link]]`,
`[[link]]]` with an extra closing bracket, and `[[link|alias]]`. It writes a
`text-undo-2976` result to the report; the parent runner still owns drawing cleanup
and JavaScript error checks. The scenario uses the toolbar's stable test IDs, so
labels may be localized. Physical mobile and popout checks remain separate.

For the native Excalidraw authoring protocol, run:

```sh
node --test scripts/testing/cli.test.mjs
npm run verify:obsidian:plugin -- --native-cli
```

The native scenario uses real registered commands and owned fixtures for file
input, construction, template prose, read/apply/save/reopen, replay/stale/busy
receipts, delayed text preparation, save failure, SVG/PNG, vault image metadata,
and trusted script context/source changes/prompt refusal. Its temporary hooks and
files are restored/deleted in `finally`. It records actual artifact dimensions
and bytes. The separate text-undo scenario still requires the component fix
described above. Run one driver at a time; UI/CDP input also needs the intended
vault window to retain focus.

The native CLI lane also saves a light/dark SVG/PNG image-policy matrix in the
report's `image-previews/` directory before cleaning its Vault fixtures. It covers
shared-image originals, thumbnails and placeholders, crop/mirroring/rotation,
transparency, frame title bounds, source/dirty-state preservation, metadata clear
semantics, and an actual same-size/same-mtime
attachment replacement after disk asset preparation. No raced output may publish. Set `EXCALIDRAW_CLI_POPOUT=1` to add
popout inventory/export/teardown. This host currently reports ResizeObserver
notifications when closing even a blank drawing popout; the runner preserves
those errors and fails its clean-error gate rather than hiding them.

Set `EXCALIDRAW_CLI_LARGE_IDENTITY=1` for the explicit native identity stress:
387 synthetic file records hold more aggregate payload characters than V8's
maximum single-string length, including prepared descriptor payloads. It checks
stable read/pagination revisions, last-byte replacement, stale-apply refusal and
placeholder export, recording read timings and sampled JS heap usage. Its strings
share immutable backing storage; this is not a benchmark of 570 MB of independently
decoded real images, regenerated-equal payloads, peak memory or UI responsiveness.
Those measurements still require an image-heavy drawing copy in the test vault.

For SVG-to-native conversion fidelity (#3018), run:

```bash
npm run test:svg-import
npm run verify:obsidian:plugin -- --svg-import
```

Use `npm.cmd` in PowerShell. This lane reads the test vault's `TestAssets/*.svg`
without changing them, verifies before/after hashes, and imports every actual
installed Obsidian `getIconIds()`/`getIcon()` SVG. Its temporary owned module is
unloaded/deleted afterward; no icon catalog or native CLI operation is added to
the product. Original samples and generated previews remain local.

The runner reconstructs the old converter from pinned Git source and compares
source-browser rendering, old native output and new native output on five
backgrounds. Self-authored fixtures cover holes, overlaps, opacity and known-good
primitives. Main/popout checks exercise command and EA insertion, scripted edits,
grouping, native public history actions, clipboard between disposable drawings,
SVG-as-image insertion, exports, save/reopen and plugin reload. Scripted transforms
do not establish physical pointer/touch behavior. Approximate group compositing
and unsupported text are reported separately from fidelity passes. See
[the measured corpus, costs and remaining limits](SVG_IMPORT_VALIDATION.md).
The runner continues to fail its strict JavaScript-error gate if it captures the
previously observed, unattributed ResizeObserver notification; it does not hide it.

For LaTeX dialog input and window ownership (#2970), run:

```bash
npm run verify:obsidian:plugin -- --latex-input
```

Use `npm.cmd` in PowerShell. This option also works with `verify:obsidian`.
Close any existing LaTeX dialog in the test vault first. The scenario exercises
the real plugin prompt and CodeMirror in the main window, a direct popout, and
a tab moved to a popout. Native CDP input checks click placement, arrows,
Backspace, selection replacement, undo, Mod-Enter, formula save/reopen, cancel
and editor destruction. Popout input attaches only to the single new page target
created by the scenario. It restores its temporary gateway override, detaches
its CDP session, closes its popouts, and removes its controller in `finally`;
the parent runner owns the disposable drawing and final JavaScript-error check.

This input regression supplies a deterministic local SVG renderer through the
MathJax gateway. It requires no Extras installation or network access and does
not test MathJax rendering, its activation flow, or Latex Suite extensions.
For the optional Latex Suite preview-positioning gate, install that separate
extension in the local working vault and enable its math previews once. The
coordinator installs/configures Extras MathJax automatically. Latex Suite is not
a dependency of the required core profile. Then run:

```bash
npm run verify:obsidian:plugin -- --latex-preview
```

Use `npm.cmd` in PowerShell. This gate uses the real renderer without a gateway
override and repeats the input/save/cancel checks in all three window cases. It
also requires a visible, successfully rendered preview in each owning window.
The paired Extras fix registers tooltip positioning in existing and newly opened
popouts; testing only the main plugin cannot establish that companion gate.

Obsidian 1.14.0's Temml renderer rejects Latex Suite's `\class` cursor and
bracket markers with “Function \class is not trusted.” This is separate from
CodeMirror window ownership and Extras tooltip positioning. A vault with a
pre-existing global MathJax may render successfully despite identical plugin
versions. [Obsidian 1.14.1 switched to MathJax 4.1.3](https://obsidian.md/changelog/2026-09-08-desktop-v1.14.1/).
Update Obsidian to 1.14.1 or newer, or temporarily clear Latex Suite's **Cursor
symbol** and disable **Highlight brackets in preview** when testing 1.14.0.
Do not weaken renderer trust or install a global MathJax as a test workaround.

On Windows, the real-preview gate passed after upgrading the test host to
Obsidian 1.14.4 with the original Latex Suite settings. Main-window, direct-popout
and moved-tab input, rendered previews, save/reopen, cancel, JavaScript error
checks and fixture cleanup all passed without disabling cursor decorations.

Separately validate modal
dragging outside the editor, macOS/Linux popouts, restored windows and physical
mobile input. Windows CDP results do not establish these platform/extension gates.

If CLI access is disabled, enable it in Obsidian first. If the app is running but
the CLI cannot reach it, check host permissions: a sandbox may lack access to the
macOS CLI socket or Windows IPC. Retry with authorized host access instead of
opening a second instance or choosing another vault.

If a call times out, inspect pending trust, onboarding, or native error dialogs.
On Windows, malformed inline eval transport can produce a main-process JSON
parse error dialog that blocks later commands. Dismiss it and retry through the
Node helper. If necessary, ask the user to save work and restart Obsidian; do not
force-close the application while other vaults are open. After interrupted cleanup,
review the report/controller's exact drawing path before removing leftovers; never
delete notes by prefix alone.

The historical default smoke covers one newly created main-window drawing. For the
current reproducible workspace smoke/full/device/soak profiles, source and fixture
guards, see [the maintained testing guide](TESTING.md). A smoke alone does not validate
saved scenes, clipboard, text editing, fonts/images, export, custom pens, popout
migration, offline assets, or physical mobile touch. For affected features, follow
the fork's [native validation procedure](https://github.com/zsviczian/excalidraw/blob/master/dev-docs/Obsidian/OBSIDIAN_RUNTIME_TESTING.md)
and its V03–V11 gates (also available in the sibling checkout). Record macOS and
Windows live results separately, along with artifact identity and unavailable
gates. A test of platform argument construction is not a live macOS smoke.

### Exact browser diagnostic policy (2026-10-29)

The native coordinator retains the exact browser ResizeObserver notification as
raw diagnostic evidence, including timing and affected task/case phases. It does
not suppress events or patch observers. Every context/profile and post-cleanup
host must reach one second of unchanged geometry with no new notifications within
five seconds. Persistent storms, unstable geometry, JavaScript exceptions, other
errors, failed behavior and failed cleanup fail acceptance. The exact message is
`ResizeObserver loop completed with undelivered notifications.`; messages carrying
an Error/stack or broader exception text are not eligible. Instrumentation
triggered one reproduced loop; sole causation of every notification is unproven.
Full runs include uncaught-exception and deliberately incorrect-layout negative
controls, reported separately from the 357 required feature cases.

Desktop behavioral editing uses registered native plugin CLI commands. Phone and
tablet workflows use public `EA.executeCLI`; those two in-process workflows are
not counted as native CLI command invocations. The current plan therefore has
five native CLI feature cases and two mobile EA CLI cases.

### Two complete matching-build repeats and shareable evidence

Keep all three selected workspace revisions unchanged between repeats:

```powershell
$env:EXCALIDRAW_TEST_REPORT_DIR = Join-Path $PWD '.test-work/reports/native-repeat-1'
npm.cmd run test:native
$env:EXCALIDRAW_TEST_REPORT_DIR = Join-Path $PWD '.test-work/reports/native-repeat-2'
npm.cmd run test:native
node scripts/testing/summarizeNativeEvidence.mjs .test-work/reports/native-repeat-1 .test-work/reports/native-repeat-2
$env:EXCALIDRAW_TEST_REPORT_DIR = Join-Path $PWD '.test-work/reports/final-portable'
npm.cmd run test:regression:portable
node scripts/testing/review3022ProductionDiff.mjs
```

The full native profile enforces all 357 required feature identities, including
258 behavioral cases. Diagnostic negative controls are additional and separate.
The evidence exporter refuses incomplete repeats, failed cleanup/baseline
restoration, dirty source revisions, changed build manifests or mismatched
artifacts. It writes sanitized case results, geometry, notification records,
PDF/Canvas evidence and artifact/source manifests to `docs/testing-evidence/3022/`.
These small documents may be committed and linked from the existing PRs; generated
plugin binaries and full local reports remain ignored. No publication is needed.

Focused device diagnosis can use `--profile=devices --device-profiles=phone-portrait-light,tablet-portrait-full-light`.
The profile still runs all 43 workflows in each selected context. Full/regression
profiles reject this filter and continue to require all 40 device profiles and
all 258 behavioral obligations.

Independent core diagnosis: `node scripts/testing/host/verify.mjs --core --diagnostics`
builds/deploys the same three repositories and requires all 59 non-matrix core
identities, including popout drops. It does not satisfy the full 357-case profile.
Returned, fully cleaned scenarios may retain failures while independent scenarios
continue; pending task/print resources stop the sequence. Existing report evidence
cannot be overwritten: select a fresh report directory for each attempt.

The immutable seed now declares a single main reading-view tab and collapsed
sidebars in `.obsidian/workspace.json`. Preparation and baseline restoration apply
that layout through Obsidian's live workspace API and verify the active leaf and
sidebar state. Native tests therefore do not inherit a previous picker/split
layout. Behavioral split/popout/device scenarios still construct and assert their
own declared contexts. Canvas preview scenarios collapse sidebars before fitting
their multi-node fixture, preserving rendered-preview and independent-resize checks.
