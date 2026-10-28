# Testing baseline: 2026-10-28

This is an implementation checkpoint, not comprehensive acceptance.

| Repository | Initial revision | Actual checks |
| --- | --- | --- |
| Plugin | master `48e70b73`, reconciled into the existing #3022 branch | 346 Node tests pass in 23 files; production build passes with the inherited protocol-2 declaration warning; full lint has 119 errors, zero warnings |
| Fork | `9ede0da2`, companion handoff branch | Ordinary Vitest diagnostic: 5,465 tests, 2,392 pass, 2,977 fail, 94 pending; typecheck fails. The default discovery includes an ignored historical checkout under tmp, so these are raw command counts, not the current-source coverage denominator. Bounded current-source compatibility discovery is being investigated separately |
| Extras | `f82fe17c`, companion handoff branch | Four Mermaid and three tooltip tests pass; production and API builds pass |

Environment: Windows, Node 22.22.3, installed Obsidian 1.14.5, Electron 43.3.0.
The CLI supports `dev:mobile` and `dev:debug`. The dedicated legacy test host
reports the expected user-data identity and no attached debugger. No other
vault is authorized for the native lane.

The initial inherited `h.app` bootstrap failure was traced to Vitest resolving
the raw Testing Library `render` star export ahead of the existing async
`renderApp` override. A fingerprint-checked, test-only transform makes the
exports explicit. A second bounded helper adapter advances the fork's actual
zero-delay tool-selection task inside React `act`; production scheduling is
unchanged and trusted browser input separately verifies it. All 79 fork-owned
tests pass. The current-source inherited diagnostic now has 2,692 tests:
2,264 pass, 380 fail, 47 pending and one todo. It remains a failed lane.

The portable core corpus contains 15 deterministic, synthetic fixtures with
CC0 provenance. No desktop-vault content, settings, font files or third-party
artwork was copied. Provisioning/reset guards run at two independent filesystem
roots, including spaces and Unicode; this proves filesystem portability, not
second-machine/native registration acceptance. The initial Unicode copy
attempt failed; per-file copies with hash verification corrected it.

The initial source-only run passed 36 tests in seven files. Node's built-in
coverage summary later proved unstable when it merged native type stripping
and several isolated compilations of the same source URL. Its percentages are
diagnostics, not the coverage baseline. Pinned development-only c8 12.0.0 now
remaps distinct whole-module compilation graphs before merging source counts.
Two repeated 59-test source runs pass the per-area ratchets; the aggregate fast
lane passes 403 tests in 36 files. Historical VM/extraction cases remain in fast
discovery but receive no original-source coverage credit. Twenty-three source
modules execute; 235 other runtime modules remain listed explicitly; 24 erased type-only modules are excluded separately. This is not a global
feature-coverage claim.

The actual fork production and development artifacts pass ten Chromium checks,
including trusted pointer drawing/keyboard undo, owner-document isolation and
decoded PNG/SVG output. Extras passes 23 Node tests, source-mapped ratchets and
four actual-bundle browser cases for MathJax pixels, strict-error recovery,
editable Mermaid/image fallback and capability/unload boundaries. Browser:
Chromium 145.0.7632.6, Playwright 1.58.2, with external requests blocked.

Native checkpoints in the dedicated vault: seven data-integrity cases pass;
five split/fullscreen/migration/reload cases pass; real Extras gateway rendering
and an Electron-generated PDF pass. PDF.js verifies one 288×216-point page,
the expected text and rendered red SVG pixels. Data testing captures exactly
the two intentional write-error logs and zero unexpected errors. Initial
readiness, cleanup, wrong-tab-group, external seed-ID and delete/detach races
remain in the raw failure logs; they were corrected in test orchestration, not
hidden by console filters. An isolated autosave rejection regression failed
before the small coordinator fix and passes afterward.

Actual mobile emulation passes an initial desktop/phone/tablet probe with
trusted mouse/touch input and disk round trips. Mode changes reload Obsidian;
the driver reacquires CLI/plugin readiness and restores theme, mode, geometry,
preferences and layout. All 28 device cases pass, including 16 trusted-touch cases, with clean error and state-restoration gates.
A pre-existing 254-pixel nested full-layout pane leaves almost no uncovered
canvas. Device viewport cases therefore explicitly use the owned pane's
reversible fullscreen; ordinary split behavior has its separate lifecycle
lane. Neither case is represented as physical mobile acceptance.

Ignored raw logs are in `tmp/pr3022-baseline/` and `.test-work/reports/`.
Portable JSON schemas and executable byte/path/report validation are under
`scripts/testing/`; the shared contract is [documented here](testing-contracts.md).
Future checkpoints must retain first-attempt failures, required blocked lanes,
inherited-suite results and physical/legacy/platform gaps explicitly.

## Core/device/frozen-workspace checkpoint

- Plugin: 414 fast tests in 42 files; 59 measured whole-module tests with ratchets pass. Direct native EA authoring, image/decoded export, SVG import and disposal pass. Trusted toolbar/history, custom highlighter and transient-laser semantics pass.
- Devices: 40 measured desktop/mobile-emulation/theme/layout/breakpoint cases pass, including exact boundaries and trusted input. Physical mobile remains untested.
- Stability: six 1000-element edit/save/reopen cycles pass with fresh APIs, retired roots and actual decoded PNG pixels; the subsequent 16 text/history variants and grouped-link checks pass with zero captured errors.
- Fork d04bc1a6: 93 owned tests, 12 built-browser cases, full/owned typechecks and clean packed consumer pass. Selected source coverage is 43.2% lines, 61.08% branches, 40.52% functions. Eighteen runtime modules remain unexecuted. The inherited lane stays failed: 2264 pass, 380 fail, 47 pending, one todo (2692 total). The required root update diagnostic also failed; all 16 generated golden changes were restored.
- Extras e37c06fe: 30 source tests/ratchets, four production-bundle browser cases, production/API builds and clean packed API consumer pass. Native real MathJax, editable Mermaid and PDF checks pass; PDF is one 288x216pt page with text and 3330 red SVG pixels.

The full frozen diagnostic has 12 passing functional scenarios and passing owned cleanup, but its overall error gate fails: three primitive illegal-access exceptions and two ENOENT errors after fixture deletion. A revised save-then-Vault-delete retirement sequence passes a later multi-scenario clean run; full repeat remains required. Electron documents the matching child-window teardown defect as fixed in 43.5.0 (https://releases.electronjs.org/pr/53041), newer than this host's 43.3.0. Treat the match as a hypothesis requiring a fixed-host run, not an approved suppression.

Earlier exploratory maintained-script evidence is retained only in ignored diagnostics. Script-specific coverage is outside this PR following maintainer direction; core EA has its own direct native cases. Current remaining obligations are tracked in tests/features.json. Hosted and exact-SHA trusted-native workflows are implemented but have not yet run remotely. Native cold restart/fresh session registration, legacy/minimum hosts, macOS/Linux and physical Android/iOS are explicit unavailable gates in this shared session.

## Final core verification checkpoint

424 fast tests in 45 files pass. Direct native PDF reference import through PDF.js preserves page/source metadata and unchanged source bytes, with decoded blue pixels and a physical drawing save. Trusted eraser input removes scene elements and undo restores exact IDs. Ten portable local-server web-drop and five internal-file payload cases pass with saved/reopened storage identity, zero captured errors and clean cleanup. These drop events are explicitly synthetic; native pointer/keyboard/touch coverage is separate.

The first portable-drop driver stalled waiting for its local HTTP server after all in-app controllers had settled. Its exact owned Node PID was verified and stopped, the recorded owned drawing/debugger were recovered and the failure remains in ignored evidence. Explicit connection teardown fixes the driver; the repeat passes. Cancellation and legacy cleanup-failure ownership have dedicated regressions.

The maintained native unhandled-exception negative control passes. Cold-start safety tests reject a shared session and a renderer-only reload; the live lane is blocked before CLI mutation because no isolated owned session is configured. Fresh plugin discovery has a capability-checked host path and regression tests; actual first-vault registration/trust remains an explicit setup prerequisite.

The full committed 680e8a54 native run passes all 15 functional scenarios and owned cleanup. Its only captured errors are six primitive illegal-access exceptions during popout teardown; the previous ENOENT deletion errors are gone. The 25-cycle committed native soak passes cleanly. The initial 40-case device run passes; final metadata/bounds assertions need the final exact-source rerun.

Hosted Linux Plugin tests at 680e8a54 pass installation, frozen producer builds, library, fixture/inventory/feature, fast, source-coverage and bundle-syntax gates. Extras e37c06fe remote validation/build/CodeQL pass. Fork remote workflow execution is not claimed. Its refreshed d04bc1a6 owned source/ratchets pass (43.2% lines, 61.09% branches, 40.52% functions); its refreshed inherited lane remains failed with the same 380 cases and 37 console-reported unhandled errors. Both clean packed consumers pass and now have explicit coordinator schema-2 evidence adapters.

The acceptance audit requires all declared suites, unique canonical cases, exact matching source identities and frozen producers, separate overlapping coverage/soak gates, clean cleanup and remaining obligations. JUnit preserves suite/error failures even when another suite already has failing assertions. Missing reports and blocked cold start cannot produce green acceptance. Final verification results will identify the exact tested code commit.

## Final recorded results

Exact tested code: eb616f363e7da356e3e848d26b4ded859948451b; fork d04bc1a6211a15394a1cc7036e7a7532608bf421; Extras e37c06feff9fef48877f565328762433a676afcc. All producer identities are clean and match the acceptance input reports. Later documentation-only changes leave this tested runtime unchanged.

- Plugin: 424 fast tests/45 files pass; 59 whole-module source tests/10 files and ratchets pass. That source layer lists 235 unexecuted runtime modules rather than inferring complete coverage.
- Native full: all 18 functional scenarios and cleanup pass. Twelve primitive illegal-access teardown exceptions make the overall gate fail. No ENOENT deletion error remains.
- Native devices: all 40 cases and cleanup pass, including current/normal window bounds restoration. Runtime versions, fixture hash and installed artifact hashes are recorded.
- Native soak: all 25 large-scene cycles pass, zero unexpected errors, clean cleanup and stable source identities.
- Native error oracle: the real intentional unhandled error is captured and rejected by the ordinary clean-error oracle; owned cleanup passes.
- Native cold: blocked before any CLI mutation because this is a shared application session; driver isolation/reload/PID guards pass. A genuine cold-start positive run is still required.
- Fork: 93 owned source/coverage and 12 built-browser cases pass at the pushed commit. The inherited run remains 2264 pass/380 fail/47 pending/one todo, with 37 unhandled errors in its console output.
- Extras: 30 source/coverage and four actual-bundle browser cases pass at the pushed commit. Both isolated packed API consumers pass.
- Hosted Linux Plugin tests at eb616f36 pass all install/build/library/package/fixture/inventory/feature/fast/source/syntax steps. Extras remote validation/build/CodeQL pass. No fork remote run or self-hosted native run is claimed.

The final audit contains 3341 canonical cases: 2912 passed, 380 failed and 49 blocked. It has zero missing required cases, suites, gates or source-provenance mismatches. Required remaining obligations, inherited failures and native error gates keep acceptance failed; overlapping coverage/soak evidence is attached without double-counting. Machine-specific raw evidence is in .test-work/reports/final-* and tmp/pr3022-baseline/final-*.

Desktop emulation is not physical-device acceptance. The emulator retains a phone host flag at tablet geometry, so tablet cases establish measured layouts/input and source tests separately exercise tablet preference branches. Per-case debugger capture starts after readiness and does not prove a continuous startup stream across reloads. Legacy/minimum hosts, other OSes, OS clipboard/drag transports and physical Android/iOS remain explicit registry/release limits. The plan-only handoff is retired in favor of maintained TESTING.md, testing-contracts.md, features.json and this evidence record.
