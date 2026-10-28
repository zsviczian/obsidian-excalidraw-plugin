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
| F05 — PDF resource lifetime | Invalid dimensions and failing IPC/print paths can retain resources; overlapping requests in one document have no correlated completion event. | Whole-module tests cover validation, owning realm, deadlines, listeners, style/DOM cleanup, rejection and later retry; the browser lane renders real MathJax/Mermaid, and native tests decode real Electron PDF output. |

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
