# Testing acceptance and approved follow-ups

The later maintainer-approved parsed-link history and settings teardown fixes
are committed in `7e80c1bd76072b9631a0efef6678e30ed97cfe7f`. Verification passes
**681 portable cases**, including 11 new settings regressions, and all five
focused native lifecycle cases with cleanup/restoration and matching artifacts.
[Sanitized follow-up results, case IDs, source/artifact identities and limits](settings-lifecycle-verification-2026-10-30.json)
keep that evidence separate from the original full-repeat checkpoint below.
The settings follow-up did not repeat the entire 357-case native matrix twice.
The maintainer explicitly requested merging the paired source branches while
deferring fork/Extras releases and version/dependency updates.

## Original complete native acceptance checkpoint

At plugin `fd32ac682e2aadc0f982fa23d36da482011117f9`, fork
`053a3b9f9e77917c457fce8ca9453d38b92a303b` and Extras
`1cdcb7c425a9b80afdc7b39c88861143b4b85e58`, both fresh complete runs pass
**357/357 required cases**, including all **258 behavioral obligations** and
**40 device/layout profiles**. Cleanup, baseline restoration, source/artifact
identity and both native error/layout negative controls pass in each run.
Final portable validation passes **666 cases (68 new / 598 reused)** and the
production-diff audit passes. The original completion commits changed
documentation and inert diagnostic archives only; the later approved production
fixes and their scoped verification are described above.

The historical sustained ResizeObserver storm did not recur. Its cause remains
unidentified, and no production fix or sole host/instrumentation cause is
claimed. The strict storm gate remains unchanged. Earlier failed attempts,
including the `9b2874ba` 357-pass / 350-pass pair, remain preserved below.

At that checkpoint, no production behavior changed after reviewed `f240fb86`. The PDF timeout and
concurrency-lock rollback and all previously approved fixes are preserved.

## Accessible evidence

- [Both complete native runs, all case results, source/artifact hashes, diagnostics and restoration](native-acceptance-pair-2026-10-30.json)
  ([JSON download](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/refs/heads/2026-10-28-automated-test-coverage/docs/testing-evidence/3022/native-acceptance-pair-2026-10-30.json))
- [Full desktop/core ownership trace and matched untraced comparison](observer-core-comparison-2026-10-30.json)
  ([raw observer records](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/refs/heads/2026-10-28-automated-test-coverage/docs/testing-evidence/3022/observer-core-trace-records-2026-10-30.json))
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
- [Scheduling comparison, subsequent native controls and fresh portable results](observer-scheduling-followup-2026-10-30.json)
  ([JSON download](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/refs/heads/2026-10-28-automated-test-coverage/docs/testing-evidence/3022/observer-scheduling-followup-2026-10-30.json))
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
| Fresh complete native run 1 at `fd32ac68` | **357/357 pass**; all 258 behavioral obligations and all 40 profiles; cleanup/restoration and both negative controls pass |
| Matching fresh complete native run 2 | **357/357 pass**, same source/artifacts; all behavior, profile, cleanup/restoration and negative-control gates pass |
| Final portable at `fd32ac68` | **666 passed: 68 new / 598 reused**, plus source/package/build/declaration gates |
| Plugin fast | 488 passed: 54 new / 434 reused |
| Fork source / browser | 127 passed (12 new / 115 reused) / 18 reused passes |
| Extras source / browser | 29 passed (2 new / 27 reused) / four reused passes |
| Historical native attempt 1 at `9b2874ba` | **357/357 pass**; 258 behavioral obligations and 40 profiles pass |
| Historical matching native attempt 2 | **350 pass / seven fail**; all 258 behavior cases pass, 34/40 profiles pass |
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

## Final complete repeats and diagnostic distinction

Both normal repeats use `npm.cmd run test:native`, with no observer interception,
diagnostic loader or optional state snapshots. Every sequence freshly builds
the three selected workspace revisions, deploys/hash-verifies the executable
plugins, applies configuration, enables services and verifies the explicit
canonical CLI vault/config paths. All code artifact hashes and the immutable
seed match between repeats. No diagnostic renderer reset occurs between them.
Required mobile-mode changes and restoration use Obsidian's normal reload path.

| Final result | Run 1 | Run 2 |
| --- | ---: | ---: |
| Required native cases | 357 / 357 passed | 357 / 357 passed |
| Behavioral obligations | 258 / 258 | 258 / 258 |
| Device/layout profiles | 40 / 40 | 40 / 40 |
| Registered desktop CLI-bearing cases | 6 passed | 6 passed |
| Public mobile `EA.executeCLI` cases | 2 passed | 2 passed |
| Main-window exact notifications | 1, settled | 2, settled |
| Profile notification captures | 0 | 0 |
| Cleanup and baseline restoration | Passed | Passed |
| Unrelated-error and broken-layout negative controls | Both passed | Both passed |

The preceding diagnostic trace covers all **231 required desktop/core
identities** and records **3,511 observers / 1,478 targets**, with two isolated
settling notifications, zero recording failures and no overflow. Its available
closed-document observation has a final zero-size delivery; no available target
fits the smaller nonzero-size orphaned-observation condition. Missing/collected
targets are unavailable evidence, not misclassified cross-realm targets. This
does not identify or exonerate the historical observer.

The trace is restored and removed; a verified saved-baseline renderer-only
reload clears captured wrappers **after that diagnostic and before both normal
repeats**, outside acceptance evidence. The matched untraced 231-case core run
then passes with one settling notification. Neither focused core run earns
complete native acceptance credit. The subsequent two ordinary complete runs
provide that evidence. No lifecycle workaround, observer suppression, idle
threshold increase, production fix or upstream-test rewrite was introduced.

Both normal repeats export and decode one real plugin-to-Extras PDF: 10,616
bytes, one 288 x 216 pt page and 3330 red pixels, with restored print resources.
Their decoded page hashes equal
`7ef3e029a4a65827e1e3855a95d58971f7d6a923e419d9b1ff116ce9f22bd152`;
the final rendered page was visually inspected. Per-export PDF hashes are in
the case records. Waiting remains completion-driven, with no production timeout
or per-document concurrency lock.

The final working vault remains installed and usable: both plugins ready,
desktop mode, baseline note/layout restored, native observer methods, no tasks,
print roots, popouts or debugger and a quiet passive sample. The public report
records the final bytes/hashes of all eight installed plugin files, including
both `data.json` files. Physical-device/WebView/stylus, real OS drag/clipboard,
other native OSes and isolated whole-app cold start remain separate environments.

The [pair audit source](native-pair-audit-source.txt),
[trace loader](observer-core-loader-source.txt),
[candidate analysis](observer-candidate-analysis-source.txt) and
[trace-removal guard](observer-core-removal-source.txt) are inert review archives,
not imports of the ordinary acceptance command.

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

## Historical ordered reductions

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

## Historical approved observer diagnostic: completed within cap

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

**Limit at that checkpoint:** all small controls temporarily disabled background
throttling, matching the native tooling, and restored it. Scheduling had not yet
been compared before the cap. The untraced follow-up below completes that
comparison; the original workflow's responsible observer remains unproven.

The [complete bounded control](iframe-ownership-control-source.txt),
[guarded vault/session runner](guarded-native-probe-source.txt),
[trace source](approved-observer-trace-source.txt),
[loader](approved-observer-loader-source.txt) and
[forwarding/restoration self-check](approved-observer-selfcheck-source.txt) are
inert source archives for review, not production/acceptance imports. The trace
deadline is expired. Any fresh interception requires new authorization; the
untraced control does not replace ResizeObserver or alter production observers.
Reports include source/artifact hashes, raw notifications and recovery records.

## Historical untraced scheduling and native follow-up

The maintainer authorized continued work without further time-extension
confirmations. No observer interception was used in this follow-up. The
[complete sanitized results](observer-scheduling-followup-2026-10-30.json) retain
case results, source/artifact identities, raw notifications, native window state,
restoration and the fresh 666-case portable report.

With both plugins unloaded, the iframe control ran with normal and unthrottled
scheduling, then repeated in reverse order. Every arm verified actual document
visibility, focus and native window visibility/focus; original scheduling was
restored in `finally`.

| Scheduling | None / main-constructor / iframe-constructor notifications in one second |
| --- | --- |
| Normal, first | 0 / 62 / 0 |
| Unthrottled, first | 0 / 62 / 0 |
| Unthrottled, repeated | 0 / 62 / 0 |
| Normal, repeated | 0 / 61 / 0 |

Every next-second sample after disconnecting only the test-owned observer is
quiet. Unthrottled scheduling is not required for this smaller mechanism. These
one-second samples still do not establish the original five-second gate failure.

| Native workflow at clean plugin `ab1ef6da`, fork `053a3b9`, Extras `1cdcb7c` | Result |
| --- | --- |
| Host-only open/resize/close, both plugins unloaded, no added observers | Quiet for 5.5 seconds with immediate, 50 ms and 500 ms close timing |
| Host-only hide then close | Verified hidden popout; quiet for 5.5 seconds |
| Six isolated saved/dirty drawing closes | All child assertions pass; initial parent fails because the ignored wrapper omitted its result status; failed evidence preserved |
| 172 desktop behaviors, original five lifecycle cases, then corrected six close controls | All 183 child cases pass; zero notifications; cleanup/restoration pass |
| Saved and dirty 2,000-element drawing closes | Both pass; zero notifications; disk persistence and retired APIs verified |
| All 40 device profiles plus 43 phone and 43 tablet behaviors | All 126 pass; zero captured profile notifications; restoration passes |
| Subsequent 172 desktop behaviors, original lifecycle and Lucide | Pass; two transient notifications settle; cleanup/restoration pass |
| 2,000-element popout close with a real save already pending | Pass; immutable persistence handoff reaches disk, API/root retire, zero notifications |

The passive lifecycle snapshot verifies that the fresh popout is visible,
focused, non-minimized and fully loaded before closing. The pending-save control
also observes a main-realm ToolsPanel observer and an API/root still present at
the first closed-window check, followed by successful retirement without errors.
Neither constructor mismatch nor asynchronous retirement alone is therefore
established as the historical storm's cause. No production fix is inferred.

All automatic coordinator runs freshly build, deploy/configure and hash-check
the three workspace revisions; their artifact bytes match the earlier frozen
pair. The initial small scheduling controls reuse the already installed frozen
build and earn no acceptance credit. Diagnostic repeats create **zero new
canonical cases**. The four desktop behavioral CLI cases use registered native
commands; the two mobile CLI cases use public `EA.executeCLI`. Lucide also
exercises registered export commands in the post-device replay; the separate
`native-cli-authoring` workflow was not rerun in those focused profiles.

Portable validation freshly passes **666 cases (68 new / 598 reused)** at these
revisions, plus source/package gates, builds and declarations. Production audit
passes; no maintained test source or production/PDF code changed in this
continuation. The original long storm remains unresolved and no complete native
357-case acceptance run was spent. All three PRs remain draft.

The proposed next diagnostic is the unchanged forwarding-only observer trace
over the full desktop/core sequence, which includes workflows omitted from the
smaller controls. **Automatic approval review rejected restarting it** because
the original trace exception expired and the subsequent permission covered
untraced controls. That command did not execute; no new trace was installed or
workaround attempted. At that checkpoint renewed-trace authorization was
pending. The maintainer subsequently instructed autonomous continuation within
the PR purpose; the completed full core trace, untraced comparison and ordinary
complete repeats are reported above.

Inert control sources are archived alongside the evidence:
[scheduling](observer-scheduling-control-source.txt),
[host resize](observer-host-resize-control-source.txt),
[drawing close](observer-drawing-close-control-source.txt),
[scenario loader](observer-close-loader-source.txt),
[passive window state](observer-passive-close-state-source.txt),
[large drawing](observer-large-close-control-source.txt),
[pending save](observer-inflight-close-control-source.txt), and
[hidden host window](observer-hidden-host-control-source.txt).

To repeat the device-predecessor/desktop comparison from the plugin checkout,
with the same one-time vault prerequisites and exclusive foreground access:

```powershell
New-Item -ItemType Directory -Force tmp | Out-Null
Copy-Item -LiteralPath docs/testing-evidence/3022/observer-passive-close-state-source.txt -Destination tmp/pr3022-passive-close-state-loader.mjs
$env:EXCALIDRAW_TEST_REPORT_DIR = Join-Path $PWD '.test-work/reports/unique-device-predecessor'
npm.cmd run verify:obsidian -- --profile=devices
$env:EXCALIDRAW_TEST_STATE_EVIDENCE = '1'
$env:EXCALIDRAW_TEST_REPORT_DIR = Join-Path $PWD '.test-work/reports/unique-post-device-prefix'
node --import ./tmp/pr3022-passive-close-state-loader.mjs scripts/testing/host/verify.mjs --behavior-matrix --lifecycle --lucide
Remove-Item Env:EXCALIDRAW_TEST_STATE_EVIDENCE
```

The loader adds only the archived passive pre-close snapshot; it does not change
observer methods, readiness or assertions. Both commands rebuild, deploy and
verify the workspace artifacts automatically. Use fresh report names, keep the
revisions fixed, and retain a failed first command rather than interpreting a
later pass as its replacement. These focused profiles are not full acceptance.

## Historical failures and focused evidence

The historical second complete attempt at `9b2874ba` fails:

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

The subsequent reductions and ownership trace do not reliably reproduce that
sustained failure, so its retained state and exact observer remain unidentified.
No production change is inferred. The final two complete runs retain the strict
gate and pass; the earlier failed evidence is not replaced or waived.
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

Both final complete attempts use:

- Plugin `fd32ac682e2aadc0f982fa23d36da482011117f9`
- Fork `053a3b9f9e77917c457fce8ca9453d38b92a303b`
- Extras `1cdcb7c425a9b80afdc7b39c88861143b4b85e58`

Maintained test code is unchanged from plugin `f5d5d217`; intervening completion
commits contain documentation and inert diagnostic archives. Fork and Extras
code is unchanged at the tested heads above. All artifact identities match in
the final pair; reports include installed/configuration/seed hashes and final
file inspection. The older `9b2874ba` pair is preserved as historical evidence.

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
# Two complete repeats, with exclusive foreground access and fixed revisions:
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
isolated whole-app cold start remain separate environments. Acceptance evidence
supports ready-for-review status for all three PRs. No merge, package publication,
version/dependency bump or upstream test rewrite was performed.
