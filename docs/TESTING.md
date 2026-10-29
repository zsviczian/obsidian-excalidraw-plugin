# Maintaining the test lanes

## Current checkpoint (2026-10-29)

[Accessible sanitized case summaries and artifact manifests](testing-evidence/3022/README.md)
record the tested plugin `9cb6c5eb`, fork `053a3b9` and Extras `1cdcb7c`.
Fresh portable verification passes **662 canonical cases (64 new, 598 reused)**.
The approved internal-preview focus correction passes four actual-method tests
and the isolated phone embedding workflow, with no window errors and successful
save/reopen, device restoration and baseline cleanup. Existing `patchMobileView`
visibility handling remains unchanged. Hosted Plugin tests and CodeQL pass.

Acceptance remains **failed**: **zero of two required complete native repeats**
have passed. The latest full attempt at e4a36a6b records 345 required passes,
11 failures and one missing identity. All 258 behavioral cases execute; 34/40
device profiles pass, while six fail inherited notification storms. Five desktop
native-CLI cases execute and both mobile public EA protocol cases execute.
Cleanup, baseline restoration and both native negative controls pass.

Native evidence proves two test defects: raw-mode setup left its data model
parsed, and cropped Markdown-image testing retired its drawing before asynchronous
editor close completed. Both are corrected with regressions, preserving original
assertions. All 16 text-history variants and six large-scene cycles now pass after
the full core predecessors. The corrected core has no required identity missing
but still fails strict gates: a Lucide notification storm and an Obsidian popout
`updateStatus`/`getZoomFactor` exception. Four illegal-access exceptions also recur
intermittently in a separate dirty-migration prefix. Clean route and six
plugins-unloaded Markdown controls do not establish sole host causation.

Raw retrieval is paged with an over-4-MB regression; complete current events and
an explicit older capture limitation are published. A passive storm continues
with both community runtimes unloaded and no debugger, drawing or input. A final
renderer-only recovery restores a quiet installed baseline but earns no acceptance
credit. Installer comparison requires maintainer approval; production and installer
are unchanged. Do not merge or substitute focused results for the 357-case gate.
The full plan has six native CLI-bearing cases (five editing plus Lucide) and two
separate mobile public `EA.executeCLI` workflows. Historical checkpoints below
retain their original scope and results.

## Required current-product regression

Current fork behavior is the accepted baseline. Run `npm run test:regression`.
Native work always prepares `.test-work/vaults/excalidraw-auto-test/` from the
current selected workspace revisions; no desktop-vault environment is needed. It builds the three
repositories, runs independent fork/Extras source and built-browser tests, plugin
fixture/source tests and coverage gates, clean package consumers, and native
CLI/ExcalidrawAutomate/persistence/rendering checks, main/popout lifecycle and the
40-case device/layout matrix plus the expanded behavioral workflows. Every
required case and error/cleanup gate must pass. The earlier 685-case core
checkpoint does not satisfy omitted important behaviors in this follow-up. JSON, JUnit, command logs and source
identities are written together under `.test-work/reports/regression-<uuid>`.

Use `npm run test:regression:portable` in hosted CI or without an Obsidian session.
It explicitly reports portable coverage and does not claim native validation.
Install the fork's pinned Playwright Chromium first (`yarn playwright install
chromium`; Linux CI also needs `--with-deps`). Run the same command again for a
fresh repeat; reports are not reused. Never automatically update expectations.

Focused native, soak and isolated restart profiles remain available. See
[suspected failures and decisions](TESTING_FINDINGS_3022.md) before
treating any of them as accepted behavior. The historical upstream web-app audit
is opt-in; it is not part of the independent fork regression gate.

Use Node 22.22.3, npm here and in Extras, and Yarn in the fork. Source-mapped
tests use Node's synchronous registration hooks and require Node 22.15 or newer.
The plugin still supports its declared Obsidian minimum; the native CLI has a
separate installer floor (1.12.7) and desktop-only transport.

## Repository-local preparation and test entry point

From the plugin checkout:

```powershell
npm.cmd run test:native -- --prepare-only
# Open .test-work/vaults/excalidraw-auto-test/ once in Obsidian and accept trust.
npm.cmd run test:native
```

`test:native` is one preparation-and-test entry point; `--prepare-only` is an
optional first-open convenience. It installs real `main.js`, `manifest.json`,
`styles.css` and declared `data.json` for the plugin and available workspace
Extras. Subsequent runs rebuild, freeze, deploy/hash-verify, configure and enable
both automatically. Installer/CLI registration and the first Obsidian vault
opening/trust are one-time host prerequisites. No global vault-registry edit,
manual plugin copy, service configuration or personal/desktop-vault fallback is
part of a run. Conflicting inherited vault environment variables fail early.

The seed includes synthetic content and deterministic application/core-plugin/
community-plugin/plugin settings. Generated executables remain in the ignored
working vault. See [runtime preparation, commands and recovery](OBSIDIAN_RUNTIME_TESTING.md).

For all portable and native gates together, use:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Resolve-Path ../excalidraw) '.test-work/browsers'
yarn.cmd --cwd ../excalidraw playwright install chromium # One-time portable browser setup
npm.cmd run test:regression
```

Repeat the same command for fresh evidence. Default reports use unique output
directories. `npm.cmd` / `yarn.cmd` avoid blocked PowerShell `.ps1` shims.

## Expanded behavioral obligations

`tests/features.json.behaviorMatrix` defines all factor domains, reviewed
expected results/assertions, case templates and required context-specific IDs.
There are currently **258 additional required behavioral cases** across main,
ordinary split, nested split, popout, emulated phone and emulated tablet contexts.
Six of these use actual plugin CLI `read`/`apply` transport; the other host cases
use native EA/renderers and trusted CDP input as applicable. Fifteen popout
web/internal-drop variants are also required and explicitly labeled synthetic
payload evidence. Existing native command-authoring and lifecycle cases remain.

The settings plan covers every pair in its declared domains plus explicit
high-risk rows, including conflicting defaults/overrides, missing values,
false and zero. Export rows check actual decoded output. Markdown rows use real
reading view and Live Preview; image rows cover shared sources, independent
crops/sizes, source edits, missing assets, drawing/Markdown/PDF and local
embeddables. EA and actual palette/menu/shortcut workflows run in each context.
Phone/tablet workflows therefore establish more than rectangle layout tests.

Source discovery enumerates 187 settings, 24 frontmatter fields, 161 public EA
entries, 76 commands and 14 hooks. Enumeration is not proof that every member is
behaviorally covered. Reports retain the exact exercised cases and genuine gaps;
physical touch/stylus, OS drag/clipboard, other native OSes and isolated whole-app
restart remain separate environments. Missing important required cases keep the
expanded suite unfinished; they cannot be waived by the old core count.

**Current follow-up status:** PDF rollback, real PDF output, source gates and
installation guards pass. The isolated approved focus correction passes natively.
Two complete native repeats remain required; foreground native work is paused.
Do not treat implemented case declarations as passed evidence.

Reports distinguish new/reused canonical identities against
`tests/reused-case-ids-3022.json`, actual plugin CLI command cases, host/EA/input
cases and mobile emulation. That historical ID list is only count accounting;
it is never an expected-failure or acceptance allowlist.

## Follow-up evidence, 2026-10-28 (unfinished)

The clean follow-up portable aggregate passes **633 canonical cases**: 458 plugin
fast, 124 fork source, 18 fork browser, 29 Extras source and four Extras browser.
It includes **35 new and 598 reused canonical identities**. The overlapping
plugin source-coverage gate passes 73 cases; both packed-consumer gates pass.
Evidence: `.test-work/reports/expanded-portable-clean/`, using clean plugin
`d7d9a355efdf07fe1f47ded0f7e32f5c6b1225bf`, fork
`6fc8f6b7176b93e098c75f3d8846c06c4cfb3106` and Extras
`1cdcb7c425a9b80afdc7b39c88861143b4b85e58`.
The first pre-checkpoint portable run also passed (632 cases, before the added
live-configuration tooling case). Later follow-ups strengthen only native export
geometry assertions and update documentation; these native assertions remain
unexecuted until the local-vault prerequisite is completed.

The current required native denominator is **357 cases**: 317 core/behavior/drop
cases and 40 device/layout cases (273 new identities / 84 reused). Six exercise
registered desktop plugin CLI commands; two mobile workflows use public
`EA.executeCLI` separately. Host/EA/trusted-input cases and emulated contexts are
counted separately. The historical native IDs are omitted by the portable profile,
rather than removed tests. Three old PDF deadline/lock identities were replaced
or removed. The dated 2026-10-28 follow-up had zero fresh native passes; current
subset results are recorded above and do not satisfy the complete-repeat gate.
| Required follow-up | Current result |
| --- | --- |
| PDF timeout/lock rollback | Source regression passes; completion remains event-driven |
| Delay beyond two minutes | Controlled clock passes at 120001 ms and a further 15 minutes; resources remain owned until completion |
| Real plugin-to-Extras PDF and decoded-page inspection | **Passed**, `opened-single-pdf-repeat/`: one page, 288 x 216 pt, preserved text and 3330 red pixels |
| Actual installed plugin and Extras files | Present and hash-verified; latest preparation/provenance must be refreshed after changes |
| One-time local vault registration/trust | **Completed** by maintainer; native canonical-path verification passes |
| 258 cross-context behavioral cases | Isolated F17 correction passes; full repeats remain pending after a foreground-access interruption |
| 15 additional popout drop variants | **Passed** in the 59-case independent core run |
| Two complete matching-build native runs | **Pending** |
| Follow-up production diff | Pass: exact PDF rollback and approved plain-PDF/font/internal-preview-focus fixes and release notes |

The portable report records **zero native cases**. Source simulation, actual
browser rendering, CLI command transport and host/EA/trusted-input evidence are
separate. Profile-omitted native cases are not described as deleted tests. The
new/reused ledger records canonical identities rather than new test files or
changed assertion counts. No new suspected product defect has been established
by these unexecuted native cases; failures must be reproduced and reported before
any further production change.

## Portable checks

Install each checkout's declared dependencies. Set `EXCALIDRAW_FORK_ROOT`,
and `EXCALIDRAW_EXTRAS_ROOT` to explicit sibling
checkouts when they are elsewhere. Then run:

```sh
npm run test:build-workspace
npm run build
npm run test:contracts
npm run lib
npm run test:packages
npm run test:fixtures
npm run test:inventory
npm run test:features
npm run test:fast
npm run test:source-coverage
```

Build first: the fast command includes production-bundle assertions. Every
repository-owned `.test.mjs` is discovered; zero discovery, missing files,
duplicate IDs, failed/todo/skipped cases and ratchet regressions fail. Regenerate
`tests/inventory.json` with `node scripts/testing/inventory.mjs` after intentional
surface/test changes, then review the diff. Fixture changes require the same
deliberate regeneration/review through `scripts/testing/fixtures.mjs`.

`tests/features.json` maps P01–P12 source anchors, fixture IDs, executable cases,
success/failure/cleanup expectations and remaining obligations. It is an
obligation list. A mapping or AST inventory is not execution coverage of every
command, setting, EA method or hook. Keep unresolved cases in the denominator.
Source coverage measures actual compiled production modules with source maps;
historical extraction/VM tests receive no original-source coverage credit.

## Native workspace profiles

The target is fixed to the marker-owned repository-local vault. The coordinator
sets its name, canonical vault/config paths and ownership root; do not point
native commands at the historical desktop vault. `EXCALIDRAW_TEST_REPORT_DIR`
may select a fresh report directory. `EXCALIDRAW_TEST_USER_DATA_PATH` selects an
explicit host identity when the normal application data location differs; the
actual CLI host must match the held session lock.

Provisioning installs executable builds as well as the immutable seed. It never
edits the global registry. Complete the first opening/trust/CLI prerequisite
above once; subsequent native profiles perform preparation automatically.

| Command | Required work |
| --- | --- |
| `npm run verify:obsidian:smoke` | Build/freeze/stage all three repositories; load commands, protocol and one main-window drawing |
| `npm run verify:obsidian:regression` | Full production native profile: core/persistence, main/popout lifecycle, real services, CLI/EA, trusted tools, imports/text/history, six large-scene round trips, the required behavior matrix, popout drop variants and 40 device/layout cases |
| `npm run verify:obsidian:full` | Smoke plus data/lifecycle, real Extras services/PDF, workflow/pickers, Lucide, text/history, images/embeds, wheel, CLI, links, LaTeX input, core EA authoring, stability and device matrix |
| `npm run verify:obsidian:devices` | Smoke then 40 measured desktop/mobile-emulation/theme/layout/breakpoint cases plus phone/tablet behavioral workflows |
| `npm run verify:obsidian:soak` | Smoke then 25 bounded 1,000-element open/edit/save/export/close cycles |
| `npm run verify:obsidian:diagnostics` | Separate negative control: an actual intentional unhandled host exception must be captured and rejected by the ordinary oracle |
| `npm run verify:obsidian:cold` | Official app restart and durable workspace restoration, guarded by an isolated single-vault session proof |

Each producer freezes bytes and generated declaration evidence before staging.
Only the four runtime fork artifacts are copied to the installed exact npm
package; dependency pins and published declarations remain unchanged. This is
workspace verification, not a published-package release claim. Reports record
producer commits, dirty-diff/lockfile hashes and installed artifact hashes.
The maintainer has deferred fork publication and the plugin pin update.

The normal build and explicit `test:contracts` command use the same type source.
An unpublished handoff uses generated sibling declarations only when all four
installed runtime files exactly match its build. Unrelated/missing sibling
artifacts leave installed-package type resolution intact. Tests never run as a
`prebuild` hook, and CI does not supply a separate test-only type override.

Native calls run serially under the shared application-user-data lock. Never
steal DevTools/debugger ownership. Async host operations settle before cleanup;
unsettled work preserves its exact owned fixtures/controller for guarded
recovery. Each scenario gets a separate UUID-owned drawing. Dirty cleanup saves
first, then uses the Vault delete event to retire the view before detaching.
Do not globally clear IndexedDB or delete notes by prefix. A nonpassing required
scenario, unexpected error or failed cleanup fails the suite.

Desktop emulation uses actual Obsidian mobile mode and trusted input, but does
not establish physical Android/iOS WebView, stylus, native keyboard or safe-area
behavior. Whole-application restart is allowed only in an isolated automation
session. Plugin reload is separate evidence and must never be called cold restart.

The cold lane also requires `EXCALIDRAW_TEST_USER_DATA_PATH` and a frozen smoke
`EXCALIDRAW_TEST_COMBINATION_PATH`. Its user-data directory must contain
`.excalidraw-native-session.json` with `{ "schemaVersion": 2, "owner":
"obsidian-excalidraw-tests", "vaultId": "<owned provisioner vault ID>" }`.
The actual CLI user-data path and sole registered vault must match the markers.
The driver then checks a changed main-process PID and saved drawing restoration.
Missing isolation is a required blocked result. Its driver guards are tested;
the real restart remains unexecuted in the maintainer's shared session.
The native workflow requires a configured protected `native-test-approval`
environment, an approved exact SHA, the environment variables above and a
prepared `excalidraw-isolated` runner. This PR does not configure repository
access, environment reviewers or runner provisioning.

## Supplemental release-matrix audit

This older exhaustive matrix includes historical upstream diagnostics and
unavailable platform obligations. It is retained as an investigation tool, not
the passing current-product regression baseline. Its failed historical report
must not be presented as completion of the regression-suite task.

Run `npm run test:acceptance -- --report=<canonical.json> ...
--gate=<quality.json> ... --output=<directory>`. Pass canonical fast, fork-owned,
fork-inherited, both browser, Extras-source, native full, device, error-oracle and
cold reports once each. Pass plugin source coverage, packed fork/Extras consumers
and the soak report as gates. The required suite IDs live in `tests/features.json`.
Package reports are written under `.test-work/reports/package-fork` and
`package-extras`; producer-independent basic consumer evidence is explicitly
adapted to schema 2 by the coordinator.

The audit rejects missing cases/suites, duplicate canonical IDs, stale or mixed
source identities, mismatched frozen producers, failed cleanup and required
blocked obligations. Coverage and soak overlap other tests and therefore do not
inflate canonical discovery. Existing inherited failures remain failures.
Physical/mobile/legacy/OS limits stay documented in the registry and release
checks; a source or emulated pass does not satisfy those workflows.

## Historical acceptance evidence

[The baseline/checkpoint record](TESTING_BASELINE_3022.md) preserves first
attempts, inherited failures and unavailable lanes. Raw machine-specific reports
are ignored under `.test-work/reports` and `tmp/pr3022-baseline`.

Before the scheduler correction, this Windows host (Obsidian 1.14.5, installer
1.14.0, Electron 43.3.0) passed functional assertions but failed its native error
gate on popout teardown. The browser-scheduler correction now passes all 44
production native cases and 40 device/layout cases with zero unexpected errors.
Development-mode dirty migration retains a separately tracked exception under
the maintainer's 30-minute investigation cap. Keep errors visible without
wildcard suppression. The underlying host fix is in Electron 43.5.0.
See [Electron's fix/release record](https://releases.electronjs.org/pr/53041).

The earlier tested code was `eb616f363e7da356e3e848d26b4ded859948451b`, paired with
fork `d04bc1a6` and Extras `e37c06fe`. All 18 native functional scenarios and
40 device cases pass; the native run still fails on 12 teardown exceptions.
The exact-source 25-cycle soak and real-error negative control pass cleanly.
The audit has 3,341 canonical cases with no missing inputs or source mismatch,
and correctly remains failed. Follow-up documentation-only commits do not
change that tested runtime or the recorded code checkpoint.

Device error capture is attached after CLI/plugin readiness in each profile;
it does not establish a continuous pre-initialization stream across emulation
reloads. The host's emulator retains its phone device flag at tablet geometry;
those cases establish measured tablet-size layouts/input. Actual tablet
preference branches also have source tests; physical-device behavior remains
separate evidence.

The fork's independent gate does not run or transform upstream test helpers.
The optional inherited diagnostic preserves its own failures and is available
through manual workflow dispatch. It is not a required PR job. Workflows upload
their reports even on failure. Ordinary hosted CI never launches Obsidian or
accesses vaults.

## Native execution checkpoint, 2026-10-29

Reports under the ignored working tree retain source/diff identities, artifact
hashes, all failures and cleanup evidence. The plugin artifact remains 5,029,887
bytes with SHA-256 `676808bf603c5169886a25a7b4d5b193e32e1c580276bc078b832516aab048fd`;
Extras remains `28f3c966b44bb35881b98d05f3fc327163b170b51bcdb3af13821c427015c8bb`.

- `opened-single-pdf-repeat/`: real gateway/export, decoded output and cleanup
  pass. Retained `native-single-export.pdf` is 10,610 bytes; SHA-256
  `7e93eafebb3710df05efce6697ae39287b4c9348038c1255e53dd7a7a6ef1bc8`.
  Its decoded page was also visually inspected. An earlier tooling display-render
  deadline remains recorded as failed; PDF.js print intent avoids waiting for a
  display animation frame in an occluded renderer. This changes test tooling only.
- `follow-up-fast/`: 462 tests in 51 files pass, including four additional
  tooling regressions since the 458-case portable checkpoint. A fresh full
  portable aggregate is still required before reporting a new aggregate count.
- `behavior-desktop-contexts/`: broad desktop execution; the failed popout
  cleanup awaited a promise whose realm Obsidian destroyed. Failed evidence and
  guarded recovery are retained. Only the verified local-vault renderer was
  reloaded after proving no native print resources remained. The task was not
  reported as settled or passed.
- `behavior-split-popout-targeted/`: eight real behavior cases pass; cleanup
  passes; acceptance fails on ResizeObserver notifications. No error filtering.

The padding oracle follows the maintainer decision: frame-enabled exports retain
their existing no-padding policy; explicit padding cases disable frame rendering.
A separate policy case runs in every context. Behavior input scopes background throttling to its owned renderer, records actual
mode/geometry and uses ordinary window focus. CDP focus emulation was removed
after reproducing a host-only ResizeObserver loop. Trusted CDP input does not
establish physical touch or OS drag behavior. Lifecycle tests keep their
own focus semantics. Popout error capture uses the same strict combined oracle;
expected missing-asset ENOENT diagnostics require the exact owned path and count.

## Authorized defect fixes, 2026-10-29

The maintainer explicitly approved immediate fixes for the plain-PDF page-1
null-reference error and Helvetica Markdown-image empty-source font fetch. The
PDF loader now handles a missing crop reference; the fork CSS helper skips local
system-font content. Exact patches and release notes are checked by
`scripts/testing/review3022ProductionDiff.mjs`. This approval expands the original
PDF rollback-only follow-up scope; no other runtime changes are authorized.
Five actual-method PDF simulations and the 127-case independent fork suite pass.
Native composite embeds use plain PDF TFiles and Helvetica to confirm both fixes;
explicit PDF page-reference coverage remains in the separate native PDF case.

## Host-tooling recovery checkpoint, 2026-10-29

The current approved-fix build passes all 172 desktop behavioral case assertions,
five lifecycle cases, three real Extras gateway cases and seven data-integrity
cases. The old Canvas workflow stopped because the local seed omitted the Canvas
core plugin. The deterministic core configuration now includes Canvas and the
workflow asserts its activation before opening a .canvas file. Exact owned
resources and markers were recovered; no personal vault was used.

A bounded idle control reproduced about 60 ResizeObserver errors/second with both
community runtimes fully unloaded and zero editors. Ordinary debugger attachment
produced zero; CDP focus emulation triggered the loop. That unnecessary emulation
was removed, and only the registered local-vault window was closed/reopened to
clear its host state. The fresh renderer control reports zero errors with both
plugins loaded and Canvas enabled. No errors are filtered. Native startup now
requires an error-free baseline and the behavioral gate includes all recorded
window errors. Complete core/mobile acceptance and two complete repeats remain
required. Portable CI passed 645 cases at e3f421b3; its artifact upload separately
failed with ECONNRESET after upload, not during build or tests.
