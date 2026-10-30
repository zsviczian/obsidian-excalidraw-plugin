# Acceptance incomplete: keep all three PRs draft

At plugin `9b2874ba`, two fresh complete matching-build runs produced **357/357
passes**, then **350/357 passes with seven failures**. Both execute all **258
behavioral obligations** and **40 device/layout profiles**. No identity is missing.
The required pair has not passed. At the subsequent test-diagnostic checkpoint
`84a30be0`, focused investigations and portable checks pass where noted below;
**two fresh complete native passes remain required** after resolution.

No production behavior changed after reviewed `f240fb86`. The PDF timeout and
concurrency-lock rollback and all previously approved fixes are preserved.

## Accessible evidence

- [Current status and artifact manifests](acceptance-status.json)
- [Complete case results, assertions, measurements, diagnostics and restoration](acceptance-investigation-2026-10-30.json)
  ([JSON download](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/refs/heads/2026-10-28-automated-test-coverage/docs/testing-evidence/3022/acceptance-investigation-2026-10-30.json))
- [Sanitized raw notification payloads](native-event-payloads-2026-10-30.jsonl)
  ([JSONL download](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/refs/heads/2026-10-28-automated-test-coverage/docs/testing-evidence/3022/native-event-payloads-2026-10-30.jsonl))
- [SHA-256 evidence manifest](acceptance-evidence-manifest.json)
- [Earlier failed attempts and controls](acceptance-investigation-2026-10-29.json),
  [9c08d814](acceptance-failed-9c08d814.json) and
  [098e6ee1](acceptance-failed-098e6ee1.json) remain retained.

Each observer's raw arrays retain ordered event IDs, duplicate IDs and original
counts. Payloads are stored once in JSONL. **Do not sum independent observer
counts as distinct notifications.** Payload and file hashes and references are
verified. Historical transport loss is documented in the earlier report; the
current finite-paging capture is complete.

## Results

| Check | Result |
| --- | --- |
| Final portable at `84a30be0` | **664 passed: 66 new / 598 reused**, plus source/package gates |
| Plugin fast | 486 passed: 52 new / 434 reused |
| Fork source / browser | 127 passed (12 new / 115 reused) / 18 reused passes |
| Extras source / browser | 29 passed (2 new / 27 reused) / four reused passes |
| Full native attempt 1 at `9b2874ba` | **357/357 pass**; 258 behavioral obligations and 40 profiles pass |
| Matching full native attempt 2 | **350 pass / seven fail**; all 258 behavior cases pass, 34/40 profiles pass |
| Text history | All 16 original variants pass in both complete attempts and the ordered replay |
| Large scenes | All six 1000-element cycles pass in both complete attempts and the ordered replay |
| Popout drag/drop | All 15 variants execute and pass in both complete attempts |
| Native negative controls | Both actual unhandled-exception and broken-layout controls pass in each full attempt; outside the 357 denominator |
| Focused Markdown/pixel/missing-source confirmation | All 12 cases pass in main, split, nested-split and popout |
| Isolated traced Lucide | Pass; zero window events |
| 172 desktop behavior cases followed by core at `84a30be0` | All functional cases execute; sustained storm fails strict idle gates |
| Isolated lifecycle | Pass; zero window events |
| 43 popout behavior cases followed by lifecycle | Pass; one transient exact notification settles |
| Test-owned empty-popout observer controls | All three variants clean with both community runtimes unloaded; no acceptance credit |
| Final production-diff audit | Pass; no additional production behavior change |
| Final vault inspection | Plugins ready, baseline restored, no tasks/print roots/popouts, passive sample quiet |

Both complete attempts record **273 new / 84 reused native identities**. Six
desktop cases use registered native plugin CLI commands. The two mobile cases
use public `EA.executeCLI` and are reported separately. Individual command calls,
inventory entries, screenshots and diagnostics are not added to the case count.
The [feature registry](../../../tests/features.json), executable cases and all
original functional, persistence, rendered-output and cleanup assertions remain.

The two new portable cases after the previous 662-case checkpoint exercise the
actual CORS-enabled detached image decoder and safe missing-source setup. The
existing runner success case also verifies a future alpha-version string; it is
reused, not counted as a new case.

## Remaining failure and focused evidence

The second complete attempt fails:

- `lucide-3019`
- `native:device:desktop-wide-full-light`
- `native:device:desktop-wide-tray-light`
- `native:device:desktop-wide-compact-light`
- `native:device:desktop-narrow-full-light`
- `native:device:desktop-narrow-tray-light`
- `native:device:desktop-narrow-compact-light`

Its 702 exact notifications start within the exhaustive Lucide probe, before the
final screenshot. Behavioral assertions pass; its parent idle gate and the six
early profile idle gates correctly fail. There are no unrelated exceptions.

The later 172-desktop-plus-core replay retains **16,879 raw notifications**. One
earlier popout Markdown notification settles. The sustained loop first appears
during `native:lifecycle-new-popout-survivor`, before Lucide, and persists through
subsequent parent idle checks and cleanup idle. All text variants and six large
cycles still pass. Cleanup and baseline restoration pass; their success does
not waive the failed idle gates.

A passive two-second sample after restoration retains 120 notifications with
no debugger, input, geometry sampling, drawing or popout. An unload control
records 120 while loaded and 121 while both community runtimes are unloaded,
then zero during restoration. A short timeline records repeated native resize
delivery and JavaScript error-handler calls, without identifying the responsible
observer. Isolated lifecycle and Lucide pass; popout-only predecessors followed
by lifecycle pass. Closing an empty popout with no added observer, a test-owned
main-realm observer, or an owning-realm observer is also clean. These controls
do not prove sole host causation, exonerate the ordered drawing sequence, or
justify changing a production observer.

Next: isolate the retained state between the desktop workflows and fresh-popout
teardown, then propose a minimal production change for explicit approval only
if supported by evidence. No more full runs were spent after this reproduction.
The earlier illegal-access and `getZoomFactor` exceptions were not reproduced
on this host; their historical failures remain visible and no waiver is added.

## Diagnostic and runtime policy

Only the exact trusted browser notification
`ResizeObserver loop completed with undelivered notifications.` without an
Error/stack is classified separately. Geometry and notification-free idle must
hold for **1000 ms within 5000 ms**. Storms, unstable geometry, unresponsive
controls, unrelated errors, every JavaScript exception, failed persistence and
cleanup still fail. Both native negative controls confirm strict rejection.
Unnecessary focus emulation stays removed. Earlier instrumentation triggered a
reproduced loop; instrumentation being the sole cause of every later notification
remains unproven. No events or production observers are suppressed or patched.

The maintainer installed Obsidian **1.14.5 / Electron 43.8.3**; Chromium is
150.0.7871.250. These are recorded evidence, **not a version allowlist**. The
suite does not pin or skip versions, including future Obsidian alphas. Build
Node is 22.22.3; runtime Node is 24.22.0.

## Revisions, artifacts and PDF

Both complete attempts use:

- Plugin `9b2874ba173d5b28a3304920ccacd94c3fcbe02c`
- Fork `053a3b9f9e77917c457fce8ca9453d38b92a303b`
- Extras `1cdcb7c425a9b80afdc7b39c88861143b4b85e58`

Latest portable/focused code is plugin
`84a30be09918e4bbbb913eb5212c4e3b137c72e6`; fork and Extras are unchanged.
The intervening change retains passive test-stage timestamps only. All
three-repository artifact identities match in the complete pair. Public reports
include installed/configuration/seed hashes and final file inspection.

Plugin `main.js`: **5,030,423 bytes**, SHA-256
`cdc284000720118563ddfddcd482b8b9ade49be354619584e06fc3e4cf1cd6df`;
212,457 bytes below the release target. Fork production JS:
`9ff28736724a15606c6281e69450196b8f5f97ac3bc03eff789c24f42d3b2f14`.
Extras `main.js`:
`28f3c966b44bb35881b98d05f3fc327163b170b51bcdb3af13821c427015c8bb`.

Both complete attempts produce a real single plugin-to-Extras PDF: 10,616 bytes,
one 288 x 216 pt page, expected extracted text and 3330 red pixels. The first
output was decoded and visually inspected; its PDF SHA-256 is
`19d3629d2b45bb22b3646668a9c41061943636b27245159c5d0a8520946d3203`
and rendered-page SHA-256 is
`7ef3e029a4a65827e1e3855a95d58971f7d6a923e419d9b1ff116ce9f22bd152`.
Print resources restore. Production waiting remains completion-driven, with no
timeout or per-document concurrent-export rejection. Portable fake-time coverage
retains pending work/resources beyond two minutes until real completion. Test
deadlines preserve unsettled native work and do not claim cancellation.

## Repeatable commands and prepared vault

Run from the plugin checkout, exclusively in
**`.test-work/vaults/excalidraw-auto-test/`**. One-time trust/CLI prerequisites are
complete. Each native entry builds the selected workspace fork/plugin/Extras,
freezes and deploys/hash-verifies artifacts, configures/enables both plugins,
verifies canonical vault/config/application identity under the shared session
lock, cleans owned data and restores baseline. No stale or personal-vault fallback.

```powershell
# Focused reproductions do not replace complete repeats:
$env:EXCALIDRAW_TEST_REPORT_DIR = Join-Path $PWD '.test-work/reports/unique-prefix'
npm.cmd run verify:obsidian -- --behavior-matrix --core
$env:EXCALIDRAW_TEST_REPORT_DIR = Join-Path $PWD '.test-work/reports/unique-lifecycle'
npm.cmd run verify:obsidian -- --lifecycle
$env:EXCALIDRAW_TEST_REPORT_DIR = Join-Path $PWD '.test-work/reports/unique-popout-prefix'
npm.cmd run verify:obsidian -- --behavior-matrix --behavior-context=popout --lifecycle
# Only after the blocker is resolved, with exclusive foreground access:
$env:EXCALIDRAW_TEST_REPORT_DIR = Join-Path $PWD '.test-work/reports/fresh-complete-1'
npm.cmd run test:native
$env:EXCALIDRAW_TEST_REPORT_DIR = Join-Path $PWD '.test-work/reports/fresh-complete-2'
npm.cmd run test:native
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Resolve-Path ../excalidraw).Path '.test-work/browsers'
$env:EXCALIDRAW_TEST_REPORT_DIR = Join-Path $PWD '.test-work/reports/fresh-portable'
npm.cmd run test:regression:portable
node scripts/testing/review3022ProductionDiff.mjs
```

[Preparation, reports and safe recovery](../../OBSIDIAN_RUNTIME_TESTING.md) remain
maintained. Failed evidence is retained. A verified saved-baseline renderer-only
reload was used for recovery, with no acceptance credit; other vault windows
were untouched. Final installed plugins/baseline are usable, with no owned work
or debugger and a quiet passive sample. Native input has stopped.

Physical touch/WebView/stylus, real OS drag/clipboard, native macOS/Linux and
isolated whole-app cold start remain separate environments. Keep all three PRs
draft. No merge, package publication, version/dependency bump or upstream test
rewrite was performed.
