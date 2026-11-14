# Drawing controls, creation actions and companion reliability

Implementation checkpoint for [PR #3052](https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/3052).
Plugin source baseline: `78674a39ccf046b93b5de4155edcc871d82602cf`.
Fork companion: [PR #484](https://github.com/zsviczian/excalidraw/pull/484),
`8260fa444f84c616d1486c2a47365c1b72c4be9a`, based on `29b11ad97`.
Selected Extras remains clean at `4bd7af3325a8059a5ca68fc3e88169507b08c773`.

## Scope and evidence

| Issue | Finding and implementation | Evidence and limits |
| --- | --- | --- |
| [#3049](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/3049) | Native table images also have an `internal-embed` wrapper. Prefer the physical table/cell boundary before the ordinary widget path; retain source, renderer-generation, file, document and stale-range guards. Relative mobile/coarse-pointer toolbar rows now reset the absolute toolbar's `right` offset. | Both new table ownership assertions fail before the fix and pass afterward, including self-embeds and invalid-generation cleanup. The previous native reports linked in the issue establish both failures on the pre-merge parent. Current native table operations and phone geometry remain pending. |
| [#3047](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/3047) | Independent `showRibbonIcon` (true) and `showNewDrawingInEmptyTab` (false) defaults. Both settings layouts use the canonical specs. A plugin-owned component adds one action to each empty view's existing action list, preserves core actions, reattaches after core-plugin rerenders and releases its observers/listeners. Creation calls the existing folder/format/template pipeline. | Source test covers independent opt-in, duplicate-click prevention, host rerenders and cleanup. Native creation, actual host styling and nondefault/unknown-key persistence across reload are registered but not yet executed. |
| [#3044](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/3044) | Plugin keyboard capture changes an unmodified P from freedraw to selection through the existing imperative API. First P is still owned by the editor. Ignore repeat, modifiers, composition, editable inputs, dialogs, embeds, view mode, in-progress drawing and retiring views. | Source test covers the keyboard ownership and exclusion rules. No fork customization or setting is introduced. Native main/popout input remains pending. |
| [#3048](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/3048) | Two fingerprinted fork conditions keep normalized desktop YouTube videos/playlists on the existing iframe fallback instead of a guest webview. Generic webviews, Vimeo, wrapper URLs, permissions and saved scenes are unchanged. The host custom renderer lacks the normalized provider URL; duplicating normalization there would be a larger change. | Two real-editor YouTube assertions fail before the fix; all four provider cases pass afterward. Both actual browser artifacts pass trusted nested cross-origin fullscreen, viewport geometry and exit at zoom 0.5 and 2 using offline provider fixtures. The reported Electron effect and real YouTube playback are not yet verified. See companion OBS-016/033 inventory and validation. |
| [#3051](https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/3051) | The report lacks exact versions/debug details, so an outdated Extras installation is a hypothesis. Current Extras already contains the earlier MathJax startup isolation fix (`6c55a9d`). Independently confirmed: a registered but incomplete Extras API throws before the normal update/cancel path. Guard the API shape, check versions before feature access and treat missing/non-string component versions as unavailable. | New source regression fails before the guard and passes afterward. Exact Mermaid 3.6 handshake remains intact. Native cases simulate absent/incomplete APIs, plugin reload, continued drawing access and recovery. This does not claim to reproduce or close the reporter's original startup failure. |

## Non-CLI validation completed

- Plugin source suite: **781 cases in 104 files pass**.
- Production build and five bundle checks pass, including offline fonts, private React bootstrap, locale inflation and release size. `main.js`: **5,144,419 bytes**, **98,461 bytes** below 5 MiB.
- CSS lint, public/test inventory and feature mappings pass. New core helpers and the modified embed/gateway modules pass focused ESLint with zero errors/warnings. The full plugin lint command remains red on **116 errors** in the existing repository backlog.
- Fork owned source/coverage: **161 cases pass**; coverage floors pass (48.11% lines, 64.01% branches, 45.03% functions).
- Fork built-artifact browser suite: **24 cases pass** across production/development, including the two new fullscreen cases. Full and owned-test TypeScript checks pass; both Obsidian artifact modes and declarations build. New-test lint and 15 audit tests pass; all 276 differing paths are fingerprint-accounted against upstream `82d5847e`.
- The required raw inherited `yarn test:update` command fails and also discovers ignored historical source copies. Its current-tree subset has 1,331 passed / 1,513 failed assertions and one todo. This is not a clean compatibility result or a parent comparison. All 16 generated primary-tree snapshot/inline-snapshot edits were preserved as a patch and restored; none was accepted.

Retained local reports: plugin `.test-work/reports/fast/`, `pr3052-fast.log`,
`pr3052-plugin-lint.log`; fork `.test-work/reports/fork-owned-source/`,
`pr3052-youtube-browser/`, `pr3052-inherited/`.

The four generated fork artifacts were copied into the ignored installed package
and hash-verified for integration builds. Package versions and dependency/lock
files are unchanged. This is an unpublished local handoff, not a package release.
No personal-vault deployment is included in this PR.

## Native validation paused

The maintainer explicitly requested no further Obsidian CLI calls while another
agent uses the host. Before that request, the first embed checkpoint built and
prepared the owned vault but stopped on a transient readiness probe; subsequent
read-only probes confirmed the canonical test-vault path, layout readiness and
plugin readiness. No behavioral native pass is claimed for this implementation.

After explicit approval, start with:

```powershell
npm.cmd run verify:obsidian:plugin -- --embed-controls --issue-3052 --lifecycle --devices --device-profiles=phone-portrait-light,tablet-portrait-full-light
```

The coordinator must rebuild/freeze/hash-verify the selected paired sources and
use only `.test-work/vaults/excalidraw-auto-test/` under the shared application
lock. `--issue-3052` is also included in complete profiles and their required
case list. It covers main/popout creation, keyboard, optional-API failures and
offline-player Electron fullscreen. Existing embed cases cover source fidelity,
one-step undo, repeated table cells, Reading view and responsive controls.

Priority manual checks after automation: actual phone touch on embed controls;
empty-tab action appearance/creation after settings changes and reload; actual
YouTube playback/fullscreen/Escape in main and popout windows. Other desktop
OSes, physical mobile and an isolated whole-app restart remain separate gates.
