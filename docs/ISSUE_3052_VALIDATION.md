# Drawing controls, creation actions and companion reliability

Validation record for [plugin PR #3052](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/3052)
and [fork PR #484](https://github.com/zsviczian/excalidraw/pull/484).
[Sanitized case results, source identities and artifact hashes](testing-evidence/3052/results.json)
are committed with this record; full local reports remain ignored.

## Tested checkpoints

| Component | Revision and scope |
| --- | --- |
| Plugin baseline | `78674a39ccf046b93b5de4155edcc871d82602cf` |
| Complete portable/native checkpoint | `fdca179677bcabccb83e883e89026723345be67b` |
| Final keyboard follow-up | `78782221011caa2e8eb0e5f9655f426d4bb60c01`; only production difference from the complete checkpoint is the pen-repeat guard |
| Fork | `8260fa444f84c616d1486c2a47365c1b72c4be9a`, based on `29b11ad978d0a793f6502dcdc259f3481054c368` |
| Extras | Clean `4bd7af3325a8059a5ca68fc3e88169507b08c773`; manifest 0.2.1, API package 0.1.1, Mermaid service 3.6.0 |
| K-Plex in the complete native run | Clean `69eb4642dbf7bb995bff6d1b2e8409fd6e2c5046` |

Native host: Windows, Obsidian **1.15.1**, installer **1.14.5**,
Electron **43.8.3**, Chromium **150.0.7871.250**. Build tooling uses Node 22.22.3.
Only the marker-owned `.test-work/vaults/excalidraw-auto-test/` was used.
Every sequence rebuilt, froze, installed and hash-verified its selected sources
under the shared application-user-data lock, then restored its declared baseline.

## Issue outcomes

Maintainer follow-up, 2026-11-15: the empty-tab action is now **New Drawing**
and enabled by default, overriding the original issue's opt-in proposal. Explicit
persisted opt-outs remain respected; no migration overwrites existing choices.
The creation regression now loads the actual production defaults and checks
default visibility, independent opt-outs, host rerenders and cleanup. The native
and portable counts below remain evidence for their explicitly named earlier
checkpoints, which preceded this default/copy change.

This follow-up's production build and all 789 fast cases pass, including the five
bundle checks and maintained-locale inflation. The strengthened real-defaults
creation regression fails before the default change and passes afterward. This
localized default/copy change does not alter the creation pipeline or controller;
the earlier complete native run is not represented as a new native validation.
The new production bundle is 5,145,119 bytes (97,761 bytes below 5 MiB).

The maintainer also requested a mandatory consent control for compatibility work
with another plugin. It is canonical in `CODING_STANDARDS.md` and prominently
linked from `AGENTS.md` and `CONTRIBUTING.md`. On 2026-11-15 the maintainer
explicitly approved retaining the generic #3051 Extras guards and their regression
coverage. No Lazy Loader-specific production workaround was introduced or approved.

| Issue | Implementation and observable evidence |
| --- | --- |
| [#3049](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/3049) | Prefer the physical table/cell boundary even when native images have an `internal-embed` wrapper. Preserve file, renderer-generation, document and stale-source guards. Reset `right` for in-flow phone/coarse-pointer controls. Source regressions fail before the fix. Native main/split/popout and phone/tablet cases pass for PNG and both SVG formats, repeated cells, alignment, exact source, history, fullscreen and Reading controls. |
| [#3047](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/3047) | Independent ribbon visibility and **New Drawing** action, both on by default after the maintainer's 2026-11-15 follow-up, using the existing folder/format/template pipeline. Both settings layouts and maintained locales are covered. Earlier native main/popout creation passes; nondefault preferences and an unknown-key sentinel survive actual plugin reload and on-disk persistence. Core empty-tab actions remain present. |
| [#3044](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/3044) | Plugin-only unmodified P toggle through the existing editor API. Exclude inputs, embeds, modifiers, composition, active drawing, view mode and retired views. Review found that repeats after selection commits could reenter pen; the strengthened state-mutating source test fails before the final guard and passes afterward. Actual repeated-key input passes in main/popout: second P selects mouse, holding it preserves selection, fresh P selects pen, input text and V still work. |
| [#3048](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/3048) | Two fingerprinted fork conditions route normalized YouTube videos/playlists through the existing iframe instead of a guest webview. Four real-editor provider cases pass after two baseline failures. Both actual browser artifacts pass nested cross-origin offline-player fullscreen at zoom 0.5 and 2. Native main/popout tests pass iframe routing, viewport-sized HTML fullscreen and trusted player-button exit. Actual YouTube playback and physical Escape remain unverified. |
| [#3051](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/3051) | Guard absent/incomplete Extras APIs, check versions before feature access and reject missing/non-string component versions through the normal unavailable/update path. Preserve the exact Mermaid 3.6 handshake. Native missing/incomplete API cancellation, continued drawing access, recovery and late plugin enablement pass. The original startup failure is not reproduced or claimed fixed. |

The [reporter's follow-up](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/3051#issuecomment-6875289427)
says a two-plugin vault works and immediate loading avoids the approximately
60-plugin vault's failure with Lazy Loader's 20-second delay. Its quoted
NotebookLM explanations are not established facts: the main plugin owns the
waiting view/layout-ready path and already converts fallback Markdown leaves.
Controlled enablement after layout readiness works without a usable Extras API.
Current Extras also already includes MathJax startup isolation (`6c55a9d`).
No unrelated startup refactor or automatic closure of #3051 is justified.

## Maintainer-approved PNG correction

### Android fullscreen follow-up, 2026-11-15

The maintainer reports a long "Loading preview" wait on physical Android when
Markdown preview type is PNG, while Native SVG opens quickly. Git history traces
the fullscreen `fwidth: "1600"` / fresh-payload path to commit `14115712` in
PR #3037; PR #3052 retained it. That path bypasses the cache and requests scale 3,
so it can rasterize nine times the base pixel area on every opening. This is a
confirmed unnecessary-work path, not a measured attribution of every Android delay.

Owned PNG images now retain a weakly keyed reference to their existing encoded
blob. Fullscreen reuses those pixels through a new independently owned URL in the
source document. It does not start another scene export or depend on cache
availability. SVG/Native SVG and unowned-payload fallback paths remain unchanged.
The deliberate trade-off is that PNG zoom uses the displayed raster's resolution
rather than an automatically generated fresh 3x raster; no switch to SVG is hidden
behind the PNG setting.

The new routing regression fails before the fix because fullscreen starts a second
raster export. Pixel-copy coverage includes cached/uncached images, close/reopen,
source retirement, document ownership and plugin teardown. All 41 focused
Markdown/PNG cases, all 791 fast cases, 251 measured source cases and the
production build pass. Both changed production modules have zero focused lint
errors/warnings. Native embed validation and
physical Android confirmation are recorded separately; earlier full-profile
counts are not acceptance evidence for this follow-up.

Native validation independently exposed concurrent cold renders revoking an
earlier image's URL, and warm-cache siblings sharing a revocable URL. The
postprocessor now reads cached raster blobs and gives every image its own URL.
The cache stores the blob without owning that renderer's URL. Cache schemas,
drawing backups and fork source are unchanged.

Images and wrappers enter the destination document before loading. A live image's
URL is created in the stable main plugin realm and stays readable until
replacement, discard, decode failure or plugin unload. This supports frame pixel
consumers and actual Markdown main-to-popout-to-main migration. Plugin teardown
releases remaining sources; weak references provide a fallback for legacy DOM
consumers that omit retirement callbacks.

Source cases cover cold concurrency, warm siblings, pixel reads, uncached
payloads, errors, cache shutdown and stale plugin disposers. The PNG helper has
100% measured line/function and 89.47% branch coverage at the complete checkpoint.
Its source is unchanged by the final keyboard follow-up.

## Validation results and acceptance scope

| Lane | Result |
| --- | --- |
| Complete portable at `fdca1796` | **1,023 canonical cases pass**, plus source/package gates: 789 plugin fast, 161 fork owned, 24 fork built-browser, 30 Extras source and 19 Extras browser cases |
| Measured plugin source at that checkpoint | **250 cases in 39 files pass**; coverage gate passes |
| Complete native at `fdca1796` | **468/468 required cases pass**, including **160 device cases**, 40 device/layout profiles and all 258 behavioral obligations |
| Native diagnostics and restoration | Both negative controls pass; strict idle, unexpected-error, source-stability, cleanup and baseline-restoration gates pass. One isolated ResizeObserver notification, no storm. Deliberately injected write-failure logs remain recorded separately from unexpected errors. |
| Final localized follow-up at `78782221` | Strengthened source test red before / green after; all **789 fast cases pass**. Fresh focused native build passes all nine issue identities, **13 total checks**, including actual held-P input in both windows. Errors, cleanup and baseline restoration pass. |
| Hosted final source checks | [Plugin tests](https://github.com/zsviczian/obsidian-excalidraw-plugin/actions/runs/43649533527) and [CodeQL](https://github.com/zsviczian/obsidian-excalidraw-plugin/actions/runs/43649533590) both pass at `78782221`. |
| Builds and packaging | Complete checkpoint production/development/library and package-consumer gates pass. Final keyboard production/native rebuild passes. Production artifact: **5,145,115 bytes**, **97,765 bytes** below 5 MiB. Its SHA-256 is in the evidence file. |
| Lint and inventory | Modified postprocessor/PNG helper and final pen helper have zero focused ESLint errors/warnings. CSS policy, feature mappings and public/test inventory pass. Full-plugin lint retains the previously recorded **116-error backlog**; no global clean-lint claim. |
| Fork checks | Full/owned types, both Obsidian modes and declarations pass. Owned coverage floors pass; final local run measures 48.03% lines, 64.03% branches, 44.86% functions. Fifteen audit tests and the 276-path ledger comparison against upstream `82d5847e57dcb6fb5982833ea9ec2137fe0b2bd5` pass. |

The complete native run is deliberately identified separately from the final
localized keyboard follow-up. A complete native profile was not repeated after
that guard-only change. The final fast working-tree diff was verified byte-for-byte
against the subsequently committed `78782221`; its fresh native artifacts use the
clean commit. Fork and Extras artifact hashes match the complete checkpoint.

## Retained failures and limits

- Earlier native runs exposed PNG cache, document-migration and premature
  URL-release failures; the existing frame pixel assertions were retained.
  A complete run also recorded a sustained ResizeObserver storm. No observer
  production fix, error suppression or gate waiver is claimed. The final complete
  run passed with native observer methods and one isolated notification.
- One portable attempt stopped before browser execution because the local
  Playwright cache path was unset. Pointing it to the existing pinned Chromium
  cache produced the complete 1,023-case pass; no source change was needed.
- Required raw inherited `yarn test:update` remains red and discovers ignored
  historical copies. Its current-tree subset has 1,331 passed / 1,513 failed
  assertions plus one todo across 175 files (82 failing). This is not a clean
  compatibility result or parent comparison. All 16 generated primary-tree
  snapshot/inline-snapshot edits were preserved as a patch and restored.
- Physical Windows Escape could not be checked: desktop automation failed twice
  to activate the visible/focused test window, sent no physical input and cleaned
  its owned fixture. CDP Escape does not invoke Chromium's reserved browser
  shortcut, so it was not substituted as a passing physical test.

Priority manual checks before release: physical phone/tablet touch on Reading and
table controls; actual stylus-button P/hold/release; real YouTube
playback/fullscreen/Escape in main and popout; minimum supported Obsidian and
other desktop OSes; isolated whole-app cold startup. Desktop mobile emulation
does not establish physical Android/iOS behavior. The exact #3051 third-party
startup combination remains unconfirmed.

Local reports include `pr3052-portable-live-source-ready/`,
`pr3052-native-full-live-source/`, `pr3052-pen-repeat-fast/` and
`pr3052-native-pen-repeat-final/` under `.test-work/reports/`.
Use `npm.cmd run test:regression:portable` with the pinned Playwright Chromium
cache, `npm.cmd run test:native` for a complete native profile, and
`npm.cmd run verify:obsidian:plugin -- --issue-3052` for the focused issue lane.
Run the complete portable and native commands separately: the combined wrapper's
30-minute child timeout is shorter than this native profile's approximately
44-minute execution.

## Package handoff

CI pins the tested fork/Extras implementations. Four generated local fork files
were copied into the ignored installed package and hash-verified for integration.
No package version, dependency or lockfile was changed. Publication and the exact
published dependency handoff remain a later maintainer step. This PR includes no
personal-vault deployment or merge. Keep both PRs draft for the remaining manual
and release-coordination checks.
