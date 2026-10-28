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
