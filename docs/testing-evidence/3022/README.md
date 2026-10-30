# Acceptance incomplete: keep all three PRs draft

At plugin `9b2874ba`, two fresh complete matching-build runs produced **357/357
passes**, then **350/357 passes with seven failures**. Both execute all **258
behavioral obligations** and **40 device/layout profiles**. No identity is missing.
The required pair has not passed. At the subsequent test-diagnostic checkpoint
`f5d5d217`, focused investigations and portable checks pass where noted below;
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
- [Ordered reductions, matched snapshot controls and boundary state](resize-reduction-2026-10-30.json)
  ([JSON download](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/refs/heads/2026-10-28-automated-test-coverage/docs/testing-evidence/3022/resize-reduction-2026-10-30.json))
- [Approved observer diagnostic and minimal ownership controls](observer-diagnostic-2026-10-30.json)
  ([JSON download](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/refs/heads/2026-10-28-automated-test-coverage/docs/testing-evidence/3022/observer-diagnostic-2026-10-30.json))
- [Complete sanitized observer records](approved-observer-trace-records-2026-10-30.json)
  ([JSON download](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/refs/heads/2026-10-28-automated-test-coverage/docs/testing-evidence/3022/approved-observer-trace-records-2026-10-30.json))
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
| Final portable at `f5d5d217` | **666 passed: 68 new / 598 reused**, plus source/package gates |
| Plugin fast | 488 passed: 54 new / 434 reused |
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

Two further offline cases verify the new opt-in passive reader: it does not
write settings/layout/focus/scheduling or expose setting values, and preserves
an original behavioral failure and cleanup evidence. Its initial listener-shape
assumption failed an extended actual-shape regression; the corrected reader
distinguishes Events maps from Component cleanup callbacks and labels missing
internals unavailable. This diagnostic correction does not explain the storm.

## Latest ordered reductions

All trials rebuild/deploy/configure through the standard coordinator and match
every frozen artifact against the earlier complete pair. Each retains its
original functional, persistence, error/idle and cleanup assertions.

| Ordered predecessors, then unchanged lifecycle | Matrix + lifecycle occurrences | Snapshots | Main document | Result / raw main-window notifications |
| --- | ---: | --- | --- | --- |
| Main -> split | 86 + 5 | On, initial reader | Hidden | Pass / 0 |
| Nested split -> popout | 86 + 5 | On, initial reader | Hidden | Pass / 1 settling |
| Nested split -> popout | 86 + 5 | On, corrected reader | Visible | Pass / 1 settling |
| Split -> nested split -> popout | 129 + 5 | On | Visible | Pass / 1 settling |
| Exact original four-context prefix | 172 + 5 | **Off** | Visible | Pass / 2 settling |
| Exact original four-context prefix | 172 + 5 | **On** | Visible | Pass / 0 |

These are repeated occurrences of existing IDs, not new native cases or complete
acceptance repeats. The first two hidden-document runs are not matched controls
against the historical visible failure. Electron reported a visible/focused,
non-minimized native window while its document was hidden. Ordinary native
show/focus restored document visibility in 58 ms, without emulation, observer
changes or a renderer reset. Subsequent visible trials also pass, so this
precondition mismatch is not claimed as the original cause or a resolution.

With the corrected reader, all setting digests, workspace/vault/metadata event
registrations and plugin cleanup-registration counts return to the pre-prefix
baseline before lifecycle. Layout/sidebar state, roots, popouts and temporary
main scheduling also return as expected; owned lifecycle additions retire during
cleanup. Owner identities and scheduling are recorded. Initial-reader listener
records are explicitly unavailable evidence, not zero registrations. The matched
original-prefix controls do not establish that passive snapshots cause or cure
the intermittent failure.

**Original-suite blocker:** the responsible observer is not yet identified; the
ordered reductions do not reliably fail. The historical storm remains a failure
and the current prefix passes are not a fix. The subsequent approved diagnostic
isolates a smaller ownership/lifetime mechanism below. No new 357-case run was
spent and no acceptance gate was weakened.

## Approved observer diagnostic: completed within cap

The maintainer approved a 30-minute diagnostic-only exception. Investigation
started at 10:21:04 UTC; last live experiment ended at 10:49:39, before the
10:51:04 deadline. Budapest was UTC+1: the earlier spoken 12:51 deadline was an
hour too late; the runtime guard always used the correct UTC deadline, 11:51 local.

The traced 172-case prefix, lifecycle and Lucide workflow passes with one exact
notification that settles. It records 2,331 observers/968 targets across five
realms, with no recording errors. Constructor/method interception was restored
before export. A verified saved-baseline renderer-only reload then cleared
callbacks/constructors that modules could have captured, outside the trial and
with no acceptance credit. Final native-function checks show original
ResizeObserver/observe/unobserve/disconnect, no trace global or owned work, both
plugins ready and a quiet passive sample.

**Small failing mechanism, without workspace/popout operations:** create a
same-origin iframe, adopt a test element into its document, observe it, then
remove the iframe while retaining the observation. Both community plugins are
unloaded during these matched controls. Registration occurs after adoption in
all observer arms, and the target delivers the same live dimensions first.

| Observer constructor | Notifications in the 1-second sample after frame removal | Next 1-second sample after own-observer disconnect |
| --- | ---: | ---: |
| No observer | 0 | 0 |
| Main document's ResizeObserver | **62** | 0 |
| Iframe document's ResizeObserver | **0** | 0 |

The main observer's last delivery is 123 x 81; no zero-size delivery follows
frame removal before disconnect. A separate iframe trial records 61 messages in
one second and zero after disconnect. Adopting into a frameless HTML document
instead is quiet and delivers zero size. The retained condition is a main-realm
observation of an element whose iframe has been removed, not a retained setting
or event-registration difference. These one-second controls reproduce rapid
repeated notifications; they do not independently claim five seconds of
persistence. Historical native storms beyond that unchanged gate remain retained.

An adopted-element popout control also repeats notifications with both plugins
unloaded using native BrowserWindow.close(), so changing only the close entry
point is not an evidenced fix. An earlier multi-arm trial was contaminated after
a loop and is explicitly not independent; another aborted before returning JSON
and has no invented counts. Guarded recovery/readiness failures are retained.

**Limits and next decision:** all small controls temporarily disabled background
throttling, matching the native tooling, and restored it. Normal-versus-unthrottled
scheduling under verified visible conditions was not compared before the cap.
The traced original workflow did not fail, so its exact responsible observer is
still unproven. No sole host/browser causation, harmlessness or production fix is
inferred. A 15-minute untraced scheduling comparison is proposed; permission is
pending because the approved diagnostic window has ended. No additional full
acceptance run should precede that distinction and an evidenced resolution.

The [complete bounded control](iframe-ownership-control-source.txt),
[guarded vault/session runner](guarded-native-probe-source.txt),
[trace source](approved-observer-trace-source.txt),
[loader](approved-observer-loader-source.txt) and
[forwarding/restoration self-check](approved-observer-selfcheck-source.txt) are
inert source archives for review, not production/acceptance imports. The trace
deadline is expired. Any fresh interception requires new authorization; the
untraced control does not replace ResizeObserver or alter production observers.
Reports include source/artifact hashes, raw notifications and recovery records.

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
`f5d5d217ac7779115b820377181a7ced8f1605a1`; fork and Extras are unchanged.
Intervening changes retain passive test-stage timestamps and opt-in state
evidence, its offline regressions and documentation only. All
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
