# Acceptance failed: keep all three PRs draft

The required result remains **two complete matching-build native passes**. There
are **zero**. The denominator remains **357 native cases**, including **258
behavioral obligations** and **40 device/layout profiles**. Focused checks and
partial full attempts do not count as repeats.

Current tested checkpoint:

- Plugin: `098e6ee13dc245c5c86c57575dbf6d10c5f72052`
- Fork: `053a3b9f9e77917c457fce8ca9453d38b92a303b`
- Extras: `1cdcb7c425a9b80afdc7b39c88861143b4b85e58`

Changes after reviewed plugin `9c08d814` affect test tooling, its regression,
inventory and documentation/evidence only. **Production code is unchanged.** The
accepted PDF timeout/concurrency-lock rollback and approved fixes remain.

## Accessible evidence

- [Current status, counts, artifact/config hashes, restoration and next actions](acceptance-status.json)
- [Evidence checksums](acceptance-evidence-manifest.json)
- [First failed full attempt at 9c08d814](acceptance-failed-9c08d814.json)
  ([raw download](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/refs/heads/2026-10-28-automated-test-coverage/docs/testing-evidence/3022/acceptance-failed-9c08d814.json))
- [Failed full attempt at 098e6ee1](acceptance-failed-098e6ee1.json)
  ([raw download](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/refs/heads/2026-10-28-automated-test-coverage/docs/testing-evidence/3022/acceptance-failed-098e6ee1.json))

Raw files retain available case assertions, measured geometry, decoded rendering
evidence, captured notifications/exceptions, bounded idle samples and missing
identities. Main/behavior observers can record the same event; their counts are
separate, not added as distinct notifications. No partial report is presented as
a complete pass.

## Current results

| Check | Result |
| --- | --- |
| Final portable gate | **655 passed: 57 new / 598 reused**, plus source-coverage and package-consumer gates |
| Plugin fast | 477 passed: 43 new / 434 reused |
| Fork source / browser | 127 passed (12 new / 115 reused) / 18 reused passes |
| Extras source / browser | 29 passed (2 new / 27 reused) / 4 reused passes |
| Unchanged exclusive input recheck | All 16 text-history variants and the original desktop pointer profile pass |
| Focused corrected cleanup | Popout drop and all six 1000-element stability cycles pass; no notifications or unexpected exceptions |
| Full attempt at 9c08d814 | 353 required identities pass, stability cycle 3 fails, 3 identities missing; 9 unexpected exceptions |
| Full attempt at 098e6ee1 | 336 required identities pass, 21 missing after text-history failure; 4 unexpected exceptions |
| Both full attempts: behavior/device lanes | All 258 behavioral cases and all 40 device profiles pass in each |
| Cleanup, restoration, native negative controls | Pass in both attempts; two controls are outside the 357-case denominator |
| Complete native repeats | **0 / 2** |
| Final production audit | Pass; no additional production behavior changes |

The native plan contains 273 new / 84 reused identities. First attempt observed
273 new / 81 reused; second observed 273 new / 63 reused. Six desktop native-CLI
cases are planned: six execute in the first attempt and four in the second
(native authoring and Lucide are omitted after the earlier failure). Both mobile
public `EA.executeCLI` cases execute in each attempt and are counted separately.
Three historical PDF timeout/lock test identities were removed/replaced; the
source/coverage gate is not double-counted as extra portable cases.

## Remaining failures

1. **`text-undo-2976`: history button unavailable in the full sequence.** The
   unchanged isolated 16-variant run passes. The direct helper's failure does not
   retain the exact variant/action; capture that and DOM readiness/layout before
   deciding whether tooling or product behavior is responsible. Its missing
   result is not counted as passed, nor are the later 20 omitted identities.
2. **Four uncaught `illegal access` exceptions during
   `native:lifecycle-dirty-popout-to-main`** in the latest production run. Scene
   and persistence assertions pass; strict exception capture still fails. This
   Electron 43.3.0 host predates the related
   [43.5.0 teardown fix](https://releases.electronjs.org/pr/53041). The signature
   matches a known upstream issue; complete causation is unproven. An approved
   fixed-host comparison is a next step. No installer upgrade, production patch
   or exception waiver was performed.
3. **Earlier `native:stability-roundtrip:3` first-commit timeout.** A proven
   test-only file-delete/detach cleanup race caused its subsequent host `children`
   exception and is corrected with a red-before/green-after regression. The load
   timeout's cause remains unproven. All six focused cycles pass with passive
   state snapshots; the latest full attempt stops before stability. Full-sequence
   verification remains required.

The exact ResizeObserver diagnostic policy is unchanged. First attempt has two
trusted notifications during popout Markdown reading with successful bounded
settling; the latest has none. Storms, unstable geometry, other errors, every
debugger exception, failed persistence or cleanup remain failures. No focus
emulation, observer patch or broad exclusion was introduced.

## Repeatable commands and vault

The exclusive runtime vault is `.test-work/vaults/excalidraw-auto-test/`.

```powershell
npm.cmd run verify:obsidian -- --text-undo --devices --device-profiles=desktop-wide-full-light
npm.cmd run verify:obsidian -- --internal-drop --stability
# After blockers are resolved, use separate fresh report directories:
npm.cmd run test:native
npm.cmd run test:native
npm.cmd run test:regression:portable
node scripts/testing/review3022ProductionDiff.mjs
```

Every native sequence builds, deploys and hash-verifies workspace fork/plugin/
Extras artifacts, configures/enables plugins, verifies the explicit canonical CLI
target and restores the 22-file seed baseline under the application-session lock.
One-time opening/trust/CLI prerequisites are complete. No stale or personal/
desktop-vault fallback is allowed. [Full setup and recovery](../../OBSIDIAN_RUNTIME_TESTING.md).

The working vault is installed and usable: both plugins ready, baseline note and
collapsed sidebars restored, desktop mode, no tasks, print roots or popouts. Plugin
main is **5,030,423 bytes**, SHA-256
`cdc284000720118563ddfddcd482b8b9ade49be354619584e06fc3e4cf1cd6df`.

Native evidence covers Windows Electron and emulated phone/tablet layouts with
measured mobile mode/geometry. Physical Android/iOS/WebView/stylus behavior,
actual OS drag/clipboard, native macOS/Linux and isolated whole-app cold start
remain separate environments. Synthetic drag payloads are labeled separately.

Historical evidence: [initial independent core checkpoint](checkpoint-native-summary.json),
[its artifact manifests](checkpoint-artifact-manifests.json), and
[the approved focus-correction checkpoint](focus-correction-summary.json).
