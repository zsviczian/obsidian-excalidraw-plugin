# Maintaining the test lanes

## Required current-product regression

Current fork behavior is the accepted baseline. Run `npm run test:regression`
with the dedicated native test-vault environment below. It builds the three
repositories, runs independent fork/Extras source and built-browser tests, plugin
fixture/source tests and coverage gates, clean package consumers, and native
CLI/ExcalidrawAutomate/persistence/rendering checks, main/popout lifecycle and the
40-case device/layout matrix. Every required
case and error/cleanup gate must pass. JSON, JUnit, command logs and source
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

## Windows workspace quick start

From the plugin checkout, with the dedicated vault open and Obsidian CLI enabled:

```powershell
$env:EXCALIDRAW_TEST_VAULT_NAME = 'excalidraw-test'
$env:EXCALIDRAW_TEST_VAULT_PATH = 'C:/Obsidian/excalidraw-test'
$env:EXCALIDRAW_TEST_CONFIG_DIR = "$env:EXCALIDRAW_TEST_VAULT_PATH/.obsidian"
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Resolve-Path ../excalidraw) '.test-work/browsers'
yarn.cmd --cwd ../excalidraw playwright install chromium # One-time browser setup
npm.cmd run test:regression
```

Use the actual dedicated vault path if it differs. Repeat the last command for a
fresh run; the default report directory is unique each time. `npm.cmd` and
`yarn.cmd` also work when PowerShell blocks their `.ps1` shims.

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

Set all of these explicitly; never fall back to an active vault:

```sh
EXCALIDRAW_TEST_VAULT_NAME=excalidraw-test
EXCALIDRAW_TEST_VAULT_PATH=/absolute/path/excalidraw-test
EXCALIDRAW_TEST_CONFIG_DIR=/absolute/path/excalidraw-test/.obsidian
EXCALIDRAW_TEST_REPORT_DIR=/absolute/path/to/new-report-directory
```

Use environment assignment appropriate to the shell. Other vault names require
the provisioner's ownership marker and `EXCALIDRAW_TEST_AUTOMATION_ROOT`.
Provisioning copies the immutable CC0 synthetic seed; it does not register a
vault or alter Obsidian's global registry. Initial installer, CLI registration,
vault opening, community-plugin trust and install/discovery are explicit setup
prerequisites. See [the runner contract](testing-contracts.md) and
[runtime transport guidance](OBSIDIAN_RUNTIME_TESTING.md).

| Command | Required work |
| --- | --- |
| `npm run verify:obsidian:smoke` | Build/freeze/stage all three repositories; load commands, protocol and one main-window drawing |
| `npm run verify:obsidian:regression` | Full production native profile: core/persistence, main/popout lifecycle, real services, CLI/EA, trusted tools, imports/text/history, six large-scene round trips and 40 device/layout cases |
| `npm run verify:obsidian:full` | Smoke plus data/lifecycle, real Extras services/PDF, workflow/pickers, Lucide, text/history, images/embeds, wheel, CLI, links, LaTeX input, core EA authoring, stability and device matrix |
| `npm run verify:obsidian:devices` | Smoke then 40 measured desktop/mobile-emulation/theme/layout/breakpoint cases |
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
