# Maintaining the test lanes

Use Node 22.22.3, npm here and in Extras, and Yarn in the fork. Source-mapped
tests use Node's synchronous registration hooks and require Node 22.15 or newer.
The plugin still supports its declared Obsidian minimum; the native CLI has a
separate installer floor (1.12.7) and desktop-only transport.

## Portable checks

Install each checkout's declared dependencies. Set `EXCALIDRAW_FORK_ROOT`,
`EXCALIDRAW_TEST_FORK_TYPES_ROOT` and `EXCALIDRAW_EXTRAS_ROOT` to explicit sibling
checkouts when they are elsewhere. Then run:

```sh
npm run test:build-workspace
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

## Acceptance audit

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

## Current acceptance evidence

[The baseline/checkpoint record](TESTING_BASELINE_3022.md) preserves first
attempts, inherited failures and unavailable lanes. Raw machine-specific reports
are ignored under `.test-work/reports` and `tmp/pr3022-baseline`.

On the current Windows host (Obsidian 1.14.5, installer 1.14.0, Electron 43.3.0),
the full functional scenarios pass but popout teardown emits `illegal access`
exceptions, so the overall run fails. Electron documents this class of teardown
failure and its fix in 43.5.0; that is a likely explanation requiring confirmation
on a fixed host. Keep the errors visible, without wildcard suppression.
See [Electron's fix/release record](https://releases.electronjs.org/pr/53041).

The fork's additive owned gate and inherited compatibility diagnostic are
independent. The latter currently fails; it must not become a skipped or
`continue-on-error` green gate. The three repositories' workflows upload reports
even on failure. Ordinary hosted CI never launches Obsidian or accesses vaults.
