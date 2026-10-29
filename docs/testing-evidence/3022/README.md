# Acceptance blocked: keep all three PRs draft

Required acceptance remains **0/2 complete matching-build native passes**. The
denominator stays **357 native cases**, including **258 behavioral obligations**
and **40 device/layout profiles**. Focused and partial results do not replace it.

Current portable and focused-native code checkpoint:

- Plugin: `9cb6c5eb1f517839059bf5c239a46cfcfc36e9bf`
- Fork: `053a3b9f9e77917c457fce8ca9453d38b92a303b`
- Extras: `1cdcb7c425a9b80afdc7b39c88861143b4b85e58`

Changes after reviewed plugin `f240fb86` affect test tooling, its regressions,
inventory and evidence only. **Production behavior is unchanged.** The accepted
PDF timeout/concurrency-lock rollback and approved fixes remain intact.

## Accessible evidence

- [Current status, artifact hashes and restoration](acceptance-status.json)
- [Exact case results, failed full attempt and focused controls](acceptance-investigation-2026-10-29.json)
  ([machine report download](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/refs/heads/2026-10-28-automated-test-coverage/docs/testing-evidence/3022/acceptance-investigation-2026-10-29.json))
- [Sanitized raw event payloads](native-event-payloads-2026-10-29.jsonl)
  ([JSONL download](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/refs/heads/2026-10-28-automated-test-coverage/docs/testing-evidence/3022/native-event-payloads-2026-10-29.jsonl))
- [SHA-256 evidence manifest](acceptance-evidence-manifest.json)
- Earlier failed full attempts remain at [9c08d814](acceptance-failed-9c08d814.json)
  and [098e6ee1](acceptance-failed-098e6ee1.json).

Raw event arrays use ordered IDs into the JSONL file. Identical payloads are
stored once, while each observer retains its own order, repeated IDs and count.
**Do not add independent observer counts as distinct notifications.** Every
reference and payload/file hash was verified. The e4a36a6b full attempt explicitly
lacks complete desktop raw payloads after its stream outgrew CLI transport. Idle
samples reach 14,428 events; CLI retains its latest 50 exact notifications. The
next checkpoint fixes retrieval with finite pagination, an over-4-MB regression
and native confirmation. The lost payload is not invented.

## Results

| Check | Result |
| --- | --- |
| Final portable gate | **662 passed: 64 new / 598 reused**, plus source/package gates |
| Plugin fast | 484 passed: 50 new / 434 reused |
| Fork source / browser | 127 passed (12 new / 115 reused) / 18 reused passes |
| Extras source / browser | 29 passed (2 new / 27 reused) / 4 reused passes |
| Text-history correction | All 16 variants pass after full desktop/core predecessors; all 28 original assertion/poll AST calls preserved |
| Large-scene sequence | All six 1000-element cycles pass after preceding core workflows; no timeout increase |
| Direct versus ordinary host tab-drag | Both routes pass minimally and after all 172 desktop predecessors; synthetic host-drag evidence only |
| Plain Markdown migration control | Six alternating-route dirty migrations pass with both community runtimes unloaded |
| Full attempt at e4a36a6b | **345 required identities pass, 11 fail, one missing**; all 258 behavior cases run; 34/40 device profiles pass |
| Corrected core at 9cb6c5eb | No required core identity missing; Lucide storm and popout-close exception still fail strict gates |
| Native negative controls | Pass in the full attempt; outside the 357-case denominator |
| Restoration | Pass; final renderer-only recovery leaves installed plugins ready and baseline quiet |
| Complete native repeats | **0/2** |
| Exact production-diff audit | Pass |

The native plan remains **273 new / 84 reused identities**. The latest full attempt
records 273 new / 83 reused; `lucide-3019` is missing after ordinary interaction
hits the inherited storm. Parent scenario idle failures also remain failures.
Five desktop native-CLI cases execute versus six planned; both mobile public
`EA.executeCLI` cases execute separately. The later focused core executes all six
desktop CLI cases, including Lucide, but still fails. No omitted case is passed
or removed. Seven portable controls were added after reviewed f240fb86: two passive
history diagnostics, two mode-fixture regressions, one large-event transport
regression and two asynchronous image-editor cleanup controls.

## Findings and remaining blockers

1. **Invalid text-mode fixture corrected.** `changeTextMode(mode, false)` changed
   the view while leaving the model parsed. A prefix reproduction fails at
   `raw/button/wikilink`, second undo after unchanged redo submission: the enabled,
   visible, uncovered Undo button consumes a real entry without restoring text.
   Native snapshots prove the mode mismatch. Tests now await normal save/reload
   before clearing the next scene/history. The earlier unavailable-button
   occurrence itself was not reproduced; no control is skipped or retried.
2. **Intermittent migration exceptions unresolved.** Four primitive `illegal access`
   exceptions recur during `native:lifecycle-dirty-popout-to-main` after desktop
   predecessors at 4199a3dd. Both route comparisons can pass, and six plain
   Markdown migrations with both plugins unloaded are clean. Those controls do
   not establish sole host causation or exonerate the drawing workflow. At
   9cb6c5eb, fresh-popout close also throws
   `TypeError: t.webContents.getZoomFactor is not a function` in Obsidian's
   `updateStatus` callback. Every exception remains a failure.
3. **Sustained ResizeObserver storms remain failures.** The full attempt starts
   roughly 60 events/second around web drop: sampled pane geometry is stable,
   but quiet idle never occurs. Corrected core retains 674 exact notifications
   and one unrelated window error; late Lucide idle fails. A post-run passive
   control records 112 notifications in two seconds with both plugins unloaded,
   no drawing/popout, debugger, input or layout sampling. Active community
   runtimes are not required to sustain that loop; its original trigger remains
   unproven.
4. **Separate test-cleanup overlap corrected.** Native evidence shows crop testing
   retiring its drawing while the Markdown-image editor still owns the file.
   Tests now wait for actual ownership release and persistence before retirement,
   including error cleanup. A deadline preserves unsettled work. Native evidence
   confirms release before retirement in both image cases. This does not claim
   to solve the storm or migration exceptions.

Unnecessary CDP focus emulation remains removed. Instrumentation triggered an
earlier loop; being the sole cause of every notification is unproven. Only the
exact trusted browser notification without an Error/stack is diagnostic. The
**1000-ms quiet/stable interval within 5000 ms** is unchanged. Storms, unstable
geometry, unrelated errors, exceptions, failed persistence and cleanup still fail.
No production observer is patched, silenced or broadly excluded.

## Runtime decision

Installed executable: Obsidian **1.14.0**, running app code **1.14.5**, Electron
**43.3.0**. The official [1.14.5 installer](https://obsidian.md/changelog/2026-10-22-desktop-v1.14.5/)
uses Electron **43.8.3**; Electron [43.5.0 documents a related child-window teardown fix](https://releases.electronjs.org/release/v43.5.0).
This motivates a controlled comparison, not a proven diagnosis. Installer-change
approval is pending. No installer, app-code version or production patch was made.

## Commands and prepared vault

Use `.test-work/vaults/excalidraw-auto-test/` exclusively. Trust/CLI prerequisites
are complete. Each native entry builds workspace fork/plugin/Extras, freezes,
deploys and hash-verifies artifacts, configures/enables plugins, checks canonical
vault/config identity under the shared session lock and restores baseline. Choose
a fresh `EXCALIDRAW_TEST_REPORT_DIR` each time. No stale or desktop-vault fallback.

```powershell
npm.cmd run verify:obsidian -- --behavior-matrix --core
npm.cmd run verify:obsidian -- --migration-comparison
npm.cmd run verify:obsidian -- --behavior-matrix --migration-comparison
npm.cmd run verify:obsidian -- --markdown-migration-control
# After blockers are resolved; focused profiles are not full repeats:
npm.cmd run test:native
npm.cmd run test:native
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Resolve-Path ../excalidraw).Path '.test-work/browsers'
npm.cmd run test:regression:portable
node scripts/testing/review3022ProductionDiff.mjs
```

[Preparation, report-directory setup and safe recovery](../../OBSIDIAN_RUNTIME_TESTING.md)
remain maintained. After retaining the storm, recovery reloaded only the verified,
fully saved test-vault renderer. Other vault windows and installer were untouched.
Recovery earns **no acceptance credit**. Final inspection has both plugins ready,
baseline note/collapsed sidebars, desktop mode, no tasks/print roots/popouts and
a quiet two-second passive sample.

Installed plugin: **5,030,423 bytes**, SHA-256
`cdc284000720118563ddfddcd482b8b9ade49be354619584e06fc3e4cf1cd6df`,
212,457 bytes below the release target. Current artifact/settings/seed hashes are
published. Real single plugin-to-Extras PDF export still produces one 288 x 216 pt
page with expected text and 3330 red pixels, decoded and visually inspected.
Print resources restore; completion remains driven by native response.

Physical touch/WebView/stylus, real OS drag/clipboard, native macOS/Linux and
isolated whole-app cold start remain separate environments. No merge, package
publication, release/dependency bump or upstream test rewrite was performed.
