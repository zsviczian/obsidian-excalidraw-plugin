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

The first fork-owned bootstrap tests mount the real editor successfully using
the original setup. A focused inherited MobileMenu test still fails with an
undefined captured `h.app`; missing hooks remain a hypothesis until its exact
identity/timing cause is demonstrated. Do not apply a production test-global
fallback or suppress those failures.

The portable core corpus contains 15 deterministic, synthetic fixtures with
CC0 provenance. No desktop-vault content, settings, font files or third-party
artwork was copied. Provisioning/reset guards run at two independent filesystem
roots, including spaces and Unicode; this proves filesystem portability, not
second-machine/native registration acceptance. The initial Unicode copy
attempt failed; per-file copies with hash verification corrected it.

The first measured source-only run passes 36 tests in seven files. It executes
whole modules through native TypeScript support or a test-only ESM graph with
source maps. It records 261 unexecuted production modules. Historical VM and
extraction tests remain useful regressions but are deliberately excluded from
this source-coverage run. Do not describe percentages over executed files as
whole-product feature coverage.

Ignored raw logs are in `tmp/pr3022-baseline/` and `.test-work/reports/`.
Portable JSON schemas and executable byte/path/report validation are under
`scripts/testing/`; the shared contract is [documented here](testing-contracts.md).
Future checkpoints must retain first-attempt failures, required blocked lanes,
inherited-suite results and physical/legacy/platform gaps explicitly.
