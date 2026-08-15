# Incremental refactor assessment and plan

Status: parked as of 2026-08-13 (see "Parked: next steps if resumed" near the
end). Focus has shifted to `src/core/settings.ts` and declarative-settings
readiness; this plan is not being actively worked but is left in a
resumable state.

This document is the working plan for reducing the size and coupling of
`src/core/main.ts` and `src/view/ExcalidrawView.ts` without destabilizing the
Obsidian integration. It is intentionally incremental. Each implementation
step should be small enough to review, build, and manually validate in
isolation.

## Progress tracking

Release target: **2.27.0**.

Update this document in every refactor change. A change is not complete until
its phase status and the action log reflect what was implemented, what was
validated, and what remains uncertain.

| Phase | Status | Current outcome |
| --- | --- | --- |
| Assessment and baseline design | Complete | Initial architecture, risks, sequencing, and validation matrix documented |
| Retire legacy AI settings and fallbacks | Complete | Removed the retired migration, schema/default fields, GPT reset, and AI runtime fallbacks without filtering unknown persisted keys; manual testing found no issues |
| Extract settings implementation service | Implemented; awaiting manual validation | `PluginSettingsManager` now owns persistence, default assembly, remaining migrations, and API-key obfuscation; plugin methods and startup readiness remain intact, while temporary autosave enablement is now explicit plugin-instance state rather than persisted settings state |
| Extract footer safe-area styling | Implemented; awaiting manual validation | `FooterSafeAreaManager` now owns device-specific stylesheet injection, open-document traversal, and unload cleanup; the plugin method remains as a settings-UI compatibility delegate |
| Extract font management | Implemented; awaiting manual validation | `FontManager` now owns CJK discovery/loading, custom-font registration, document stylesheets, readiness, and cleanup; plugin methods and the externally read `fourthFontLoaded` field remain intact |
| Extract startup instrumentation | Implemented; awaiting manual validation | `StartupTimer` now owns startup event history, delta tracking, and breakdown formatting; lifecycle calls, public methods, and the public `loadTimestamp` field remain intact |
| Remove confirmed dead `main.ts` code | Implemented; awaiting manual validation | Removed the uncalled cache-registration method and the never-assigned duplicate file-explorer observer field/cleanup; the active observer in `ObserverManager` remains unchanged |
| Extract view export pipeline | Implemented; awaiting manual validation | `ViewExportManager` now owns raw scene, SVG, PNG, clipboard, PDF, option-resolution, and alternate-theme embedded-file export behavior; all view methods and `exportDialog` compatibility remain intact |
| Remove inert `ExcalidrawView` fragments | Complete | Removed obsolete commented declarations, experiments, debug calls, and alternative implementations; no active code or workaround documentation changed |
| Extract view fullscreen handling | Implemented; awaiting manual validation | `ViewFullscreenManager` now owns the existing document-scoped fullscreen class and style mutations while `ExcalidrawView` retains its public compatibility methods |
| Extract view link navigation | Implemented; awaiting manual validation | `ViewLinkNavigationManager` now owns element-link resolution, hook dispatch, link prompting, modifier-aware navigation, and special image-link handling while all view methods remain compatibility delegates |
| Retire obsolete Draw.io integration | Implemented; awaiting manual validation | Removed special Diagram-plugin routing and retired the Create DrawIO file script from the maintained library and generated reference catalogs; user-installed vault scripts remain untouched |
| Extract Excalidraw extension rendering | Implemented; awaiting manual validation | `ViewExcalidrawExtensionRenderer` now owns text-to-diagram, diagram-to-code, welcome screen, custom main menu, and embeddable rendering while the view retains its existing render delegates and package-managed React runtime |
| Audit production bundle size | Complete | Ranked packaging, dependency, dead-data, and static-payload reductions; translation extraction remains a last resort |
| Use inflate-only Pako runtime | Complete | Replaced the full Pako distribution with its API-compatible inflate-only build; all existing Excalidraw and locale payloads retain their format and decompression path |
| Replace bundled YAML runtime | Implemented; awaiting manual validation | `mergeMarkdownFiles()` now uses Obsidian's public YAML APIs, and `yaml` is no longer a direct production dependency |
| Compress per-window React payload | Complete | React, ReactDOM, and the official JSX runtimes are inflated before React participates in plugin bootstrap; the decompressed source remains available for private popout-window package creation, and manual testing found no startup or runtime regression |
| Replace bundled OpenType metric reader | Complete | A bounds-checked SFNT reader now extracts only the TTF/OTF metrics consumed by Excalidraw; WOFF/WOFF2 fallback behavior is unchanged, `opentype.js` is no longer bundled, and manual testing found no font regression |
| Migrate the Excalidraw runtime bundle | Implemented; production and development startup, color picker, runtime Mermaid loading, private npm-entrypoint React, and debugger payload validated | Added an isolated upstream-fork `build:obsidian` that bundles the ESM source graph into one function-evaluable artifact, preserves runtime Mermaid loading, removes the fork's retired UMD/webpack packaging path, and embeds the upstream Assistant UI fonts for offline use. The per-window React runtime is generated from official npm package entrypoints and kept in the plugin's lexical package scope rather than assigned to `window` |
| Upgrade the private React runtime to React 19 | Implemented; awaiting manual validation | Updated the paired React and ReactDOM runtime to stable 19.2.8 with matching React 19 types while retaining private per-window package creation and the official JSX runtime entrypoints |
| Repair text-to-diagram history menu | Implemented; awaiting manual validation | Persistence is working and saved chats are loaded; the body-portaled history dropdown now retains its TTD styling and stacks above the text-to-diagram modal |
| Audit and consolidate duplicate logic | In progress | Consolidated `updateFrontmatterInString()`, `arrayToMap()`, `wrapTextAtCharLength()`, `getLinkParts()`/`LinkParts`, `getBinaryFileFromDataURL()`, `svgToBase64()`, `getFontDataURL()`, `cropCanvas()`, `getImageSize()`, `promiseTry()`, `isVersionNewerThanOther()`, `repositionElementsToCursor()`, the internal `cloneElement()`, and `getBoundTextElementId()`; continue one independently testable helper family at a time |
| Extract the React root (Phase 7) | Implemented; awaiting manual validation | `src/view/components/ExcalidrawRoot.ts` now owns the mechanical body of the former `excalidrawRootElement()`: menu/observer mount and teardown, and the full Excalidraw prop wiring. `ExcalidrawView` keeps `excalidrawRoot`/`createRoot()` ownership and the bound-function render call; ~30 previously private members the render tree touches were widened to `public` (type-only, no logic change) following the precedent already set by `packages`/`plugin`/`excalidrawAPI` |
| Extract `MarkdownImageController` (Phase 6 item 6) | Complete | `src/view/managers/MarkdownImageController.ts` now owns the deletion queue (`queueMarkdownImageDeletion`/`processMarkdownImageDeletionQueue` + its 3 state fields) and the edit/convert trio (`openMarkdownImageEditor`, `convertEmbeddableToMarkdownImage`, `convertMarkdownImageToEmbeddable`). `ExcalidrawView` keeps all three as public delegates (called from `CommandManager`, `ExcalidrawRoot`, and `EmbeddableActionsMenu`), calls `queueMarkdownImageDeletion` from `onExcalidrawIncrement`, and reads `markdownImageController.markdownImageDeletionPrompt` from `save()` exactly where it read the field directly before. Cross-module functions from the existing `ExcalidrawData`/`MarkdownImage`/`MarkdownImageEditor`/`Dialogs/Prompt`/`excalidrawViewUtils` cycle are constructor-injected rather than imported directly, matching the `ViewLinkNavigationManager`/`ViewExcalidrawExtensionRenderer` precedent. Manual testing found no issues |
| Extract `ViewSceneFileManager` (Phase 6 item 5) | Complete | `src/view/managers/ViewSceneFileManager.ts` now owns the active/next loader pair, the deferred background revalidation pass and its timer, the request-coalescing queue, and the stale-image retry loop (7 state fields, 5 methods). `loadSceneFiles()` and `scheduleSceneFileDeferredValidation()` stay as public delegates on `ExcalidrawView` (external callers: `ExcalidrawAutomate.ts`'s scripting surface and `EventManager.ts`'s leaf-switch handler, neither of which needed edits). The three byte-for-byte-duplicated loader-teardown blocks in `onClose()`, `onunload()`, and `clear()` collapsed to one call each to a new `terminateActiveLoaders()` method. A previously-missed direct external read of `activeLoader` in `EventManager.ts:387` is preserved via a pass-through getter on `ExcalidrawView`. `EmbeddedFilesLoader` and the shared `addFiles()` helper (still `ExcalidrawView`-owned, since it's also used by the unrelated LaTeX-equation-editing flow) are constructor-injected, matching the `ViewExportManager`/`MarkdownImageController` precedent |
| Establish a typed Excalidraw/Obsidian host boundary | In progress; package-settings checkpoint complete | The common-package boundary and the eleven active synchronous settings capabilities in `packages/excalidraw/obsidianUtils.ts` are complete and user-validated. A separate versioned `ObsidianExcalidrawHostAdapter` exposes semantic scalar methods without exposing the plugin or its settings object. Both adapters are installed transactionally per evaluated main/popout runtime and independently disposed on package teardown. Legacy lookup remains only for the not-yet-migrated plugin-wide services/view-scoped operations and can be removed once those capabilities are routed through typed adapters. The unused stale `getOpenAIDefaultVisionModel()` accessor is excluded because its former plugin setting no longer exists and it has no callers; it should be deleted rather than made part of the new contract |
| Remaining view phases | Parked | `MarkdownImageController` and `ViewSceneFileManager` are both closed (user-confirmed manual testing, no issues). The Phase 7 React-root extraction (`ExcalidrawRoot.ts`) was never explicitly re-confirmed after its own checkpoint note was written and should be the first thing re-validated if this plan resumes. `ViewInteractionController` (hover preview + pointer/key handling) was explicitly declined by the user for now and remains the last Phase 6 controller candidate if resumed. Phase 8 (converting the extracted React root to TSX) should follow only after the React-root checkpoint is confirmed closed. See "Parked: next steps if resumed" |

### Action log

| Date | Action | Outcome | Validation |
| --- | --- | --- | --- |
| 2026-08-15 | Added the Excalidraw-package host boundary and migrated active settings-only helpers | Added the versioned `ObsidianExcalidrawHostAdapter` registry with semantic scalar methods for double-tap erasing, right-button panning, zoom-to-fit maximum, pen crosshair, single-finger pen panning, double-click text editing, zoom step/min/max, context-menu disabling, and element-link/text synchronization. Production helpers prefer the adapter and retain their existing defaults plus legacy fallback. `PackageManager` installs a live plugin-side adapter per window, disposes it with the corresponding package, and treats common/package registrations transactionally so a protocol failure cannot leave a partial host installed. Plugin services and active-view operations remain outside this contract | Focused Vitest passed 15/15 across the common and package registries; the new package suite exercises the actual production helpers with a structural fake and no Obsidian/plugin runtime. Both new fork files, the artifact export, the plugin adapter, and `PackageManager` pass targeted ESLint with zero diagnostics; `obsidianUtils.ts` retains exactly its ten pre-existing formatting warnings and has no findings on migrated lines. Fork Obsidian artifact/declarations and the coordinated plugin production build passed under Node 22 with the unchanged 33 circular-dependency warnings. `dist/main.js` is 4,720,214 bytes and contains the new protocol/capabilities. User confirmed the desktop, popout, pen/mobile, zoom, context-menu, and link-sync validation completed successfully with no issues |
| 2026-08-15 | Completed and validated the modern common-package host path by migrating preferred UI mode and highlight color | `getPreferredUIMode(formFactor)` now delegates phone/tablet/desktop selection to the registered host, and `getHighlightColor(background, opacity)` delegates both arguments while preserving the existing blue fallback. Together with the prior checkpoints, every configured-runtime consumer in `commonObsidianUtils.ts` now resolves through the typed adapter. No `obsidianUtils.ts`, component, app-state, or package-manager surface changed | Focused Vitest passed 10/10 with structural-fake coverage for all three form factors, explicit/default highlight opacity, and argument forwarding; targeted ESLint passed with zero diagnostics in both touched fork files; common ESM/type build, fork Obsidian artifact and declarations, and coordinated plugin production build passed under Node 22. The existing 33 circular-dependency warnings are unchanged; `dist/main.js` is 4,718,330 bytes and contains both capability routes. User confirmed main-window/popout UI modes, applicable phone/tablet layouts, and light/dark selection, hover, binding, and frame highlights all checked out successfully |
| 2026-08-15 | Migrated and validated `getDesktopUIMode()` through the typed host boundary | A configured runtime now obtains the desktop-mode candidate from `host.getDesktopUIMode()` and does not consult global `app`. The existing runtime normalization is preserved: `full`, `compact`, `tray`, and `mobile` pass through, while any unsupported value falls back to `tray`. Older artifacts with no registered host retain the legacy lookup | Focused Vitest passed 8/8, including no-plugin assertions for both a valid `compact` mode and an invalid host value normalized to `tray`; targeted ESLint passed with zero diagnostics in both touched fork files; common ESM/type build, fork Obsidian artifact and declarations, and the coordinated plugin production build passed under Node 22. The existing 33 circular-dependency warnings are unchanged; `dist/main.js` is 4,718,290 bytes. User confirmed `full`, `compact`, and `tray` behavior in the main window and popout, including close/reopen initialization |
| 2026-08-15 | Migrated and validated `getObsidianDeviceInfo()` through the typed host boundary | A configured runtime now returns `host.getDeviceInfo()` directly and does not consult or populate the legacy module cache/global `app` path. The fallback is retained only for older artifacts with no registered adapter. This changes one getter and no component, app-state, plugin, or package-manager surface | Focused Vitest passed 7/7, including a structural-fake assertion that calls the production getter with no Obsidian/plugin runtime; targeted ESLint passed with zero diagnostics in both touched fork files; common ESM/type build, fork Obsidian artifact and declarations, and coordinated plugin production build passed under Node 22. The existing 33 circular-dependency warnings are unchanged; `dist/main.js` is 4,718,306 bytes and contains the device capability route. User confirmed main-window and popout layout, desktop UI-mode changes, and applicable form-factor behavior all checked out successfully |
| 2026-08-15 | Migrated and validated the render-canvas limits through the typed host boundary | Exported the common-host registration API from the Obsidian artifact; added a plugin-side structural adapter whose getters read current configuration; registered one adapter per evaluated window runtime in `PackageManager`; and dispose it before package teardown. `getAreaLimit()` and `getWidthHeightLimit()` now prefer the adapter while retaining the legacy bridge as a coordinated-version fallback. No component prop or app-state field was added, and the adapter's plugin reference has exactly the existing package-manager lifetime. Follow-up type cleanup made Excalidraw's `StylesPanelMode` the single union definition and retained the plugin's `UIMode` name as a type-only alias | Focused Vitest passed 6/6 using an in-memory fake with no Obsidian/plugin runtime; targeted fork and plugin ESLint passed with zero diagnostics on the boundary implementation files; common ESM/type build, fork `build:obsidian` plus declarations, and the coordinated plugin production build passed under Node 22. The plugin build retains the existing 33 circular-dependency warnings and produces a 4,718,286-byte `dist/main.js` containing the protocol, registration API, and canvas capability. Full plugin `npm run code` still reports its pre-existing backlog (147 errors and one warning), with no findings in the two touched manager/adapter implementation files. User confirmed the limit values, render behavior, main/popout adapter counts, and cleanup all checked out successfully; iOS intentionally retains the default limits |
| 2026-08-15 | Established the first isolated Excalidraw/Obsidian host-boundary checkpoint | Added the fork-only `packages/common/src/commonObsidianHost.ts` contract and registry without importing Obsidian or the plugin, and without wiring any production caller. Registration is protocol-checked; cleanup is idempotent; an older disposer cannot clear a newer registration. Moved the existing `ObsidianDeviceType` definition to the new canonical module and re-exported it from the old path, preserving imports and runtime behavior. Added five tests driven by an in-memory structural fake rather than a running plugin | Fork `build:obsidian`, declaration generation, and the common-package ESM/type build passed under Node 22; the focused Vitest file passed 5/5; targeted ESLint reported zero errors/warnings in all four touched fork files; `git diff --check` passed. Baseline plugin production build passed with the existing 33 circular-dependency warnings and produced a 4,716,880-byte `dist/main.js`. Repository-wide fork typecheck remains non-blocking because its pre-existing test-harness backlog includes the disabled `createTestHook`/`window.h`, implicit-`any` cascades, and stale fixtures; the new files are clean under targeted validation. No manual runtime test is required yet because the registry has no production consumer |
| 2026-08-08 | Reviewed `AGENTS.md`, `CONTRIBUTING.md`, plugin lifecycle, view lifecycle, package loading, rendering, and Rollup packaging | Established the hybrid Obsidian-host/React-child target and incremental implementation sequence | `npm run build` passed; existing circular dependency warnings recorded |
| 2026-08-08 | Refined scope for 2.27.0 | Legacy AI migration will be retired; generic top-level settings normalization, ExcalidrawAutomate compatibility, duplicate-logic review, and TSDoc are now explicit requirements | Settings and utility reference searches completed; documentation-only build passed |
| 2026-08-08 | Assessed automatic supported-key settings sanitization | Confirmed that removing `stripLegacyAISettings()` alone would re-persist legacy defaults; a shallow replacement is viable only with a cleaned runtime schema and forward-version protection | TypeScript AST check confirmed 204 interface keys and 204 matching `DEFAULT_SETTINGS` keys; load/save, migration, encryption, and dynamic-settings writes reviewed |
| 2026-08-08 | Rejected automatic settings sanitization | Because supported settings change frequently, unknown-key removal creates unacceptable forward-version, downgrade, and mixed-device sync risk. Phase 1 is now limited to removing confirmed legacy AI code and fallback fields | Plan updated; no runtime code changed |
| 2026-08-08 | Completed Phase 1 legacy AI retirement | Removed the legacy migration and stripping helpers from `main.ts`, retired obsolete settings/default fields and the GPT one-off reset, and removed all legacy fallback reads from `AIUtils.ts`. Current provider profiles, model maps, multimodal default, and token settings remain intact. Unknown persisted keys are not sanitized and may round-trip inertly | Repository-wide residue search found no legacy AI runtime references; `ExcalidrawSettings` and `DEFAULT_SETTINGS` each contain the same 183 keys; production build passed after every code slice with the existing 34 circular dependency warnings and no new warnings; `dist/main.js` is 5,097,728 bytes (8,657 bytes smaller than baseline) |
| 2026-08-08 | Closed the Phase 1 validation checkpoint | Manual testing of the legacy AI retirement found no regressions | User confirmed testing completed with no issues |
| 2026-08-08 | Consolidated `updateFrontmatterInString()` | Kept the used implementation in `sceneDataUtils.ts` as canonical, added TSDoc describing its intentionally string-based behavior, and removed the identical unreferenced implementation from `utils.ts` | Repository search confirms one definition and one consumer import; `npm run build` passed with the existing 34 circular dependency warnings; bundle size remains 5,097,728 bytes; targeted ESLint reports the existing backlog but no diagnostics on changed lines; `git diff --check` passed |
| 2026-08-08 | Consolidated `arrayToMap()` | Extracted the identical implementations to side-effect-free `collectionUtils.ts` with TSDoc, then re-exported the same binding from `utils.ts` and `sceneDataUtils.ts` so all existing import paths and callers remain intact. Directly importing `sceneDataUtils.ts` from `utils.ts` was rejected because it would introduce a cycle through `fileUtils`, `main`, and `utils` | Repository search confirms one implementation; `npm run build` passed with the same 34 circular dependency warnings; bundle size is 5,097,611 bytes, 117 bytes smaller than the preceding step; the new module passes targeted ESLint; `npm run madge` remains unavailable because `madge` is not installed; `git diff --check` passed |
| 2026-08-08 | Consolidated `wrapTextAtCharLength()` | Extracted the identical pure wrapping logic to documented `textUtils.ts` and re-exported it from both existing modules, preserving ExcalidrawData and ExcalidrawAutomate imports and behavior | Repository search confirms one implementation; targeted ESLint and `npm run build` passed; the existing 34 circular dependency warnings are unchanged; bundle size decreased by 623 bytes to 5,096,988 bytes |
| 2026-08-08 | Consolidated `getLinkParts()` and `LinkParts` | Moved the duplicated parser and type to documented `linkUtils.ts`, preserving both existing value and type import paths through re-exports | Repository search confirms one function and one type definition; targeted ESLint and `npm run build` passed; the existing 34 circular dependency warnings are unchanged; bundle size decreased by 395 bytes to 5,096,593 bytes |
| 2026-08-08 | Consolidated `getBinaryFileFromDataURL()` | Moved the duplicated URL-fetch/base64 decoding helper into `fileUtils.ts`, its existing dependency owner, and preserved both old import paths through re-exports. Replaced the loosely typed first `matchAll()` result with equivalent typed `match()` capture handling | Repository search confirms one implementation; targeted ESLint, `npm run build`, `npm run lib`, and `git diff --check` passed; the existing 34 circular dependency warnings are unchanged; bundle size decreased by 405 bytes to 5,096,188 bytes |
| 2026-08-08 | Closed the text, link, and binary helper validation checkpoint | Manual testing found no regressions in wrapping, link parsing, or binary image handling | User confirmed the recommended checks completed successfully |
| 2026-08-08 | Consolidated `svgToBase64()` | Kept `embeddedAssetUtils.ts` as the canonical owner, added TSDoc for XML entity and UTF-8 handling, and preserved the `utils.ts` import surface through a re-export. Added explicit regex callback parameter types without changing encoding behavior | Repository search confirms one implementation; `npm run build` passed with the unchanged 34 circular dependency warnings; bundle size decreased by 206 bytes to 5,095,988 bytes; targeted ESLint has no diagnostics on the consolidated helper and retains two unrelated backlog errors in `embeddedAssetUtils.ts`; `git diff --check` passed |
| 2026-08-08 | Consolidated `getFontDataURL()` | Kept `embeddedAssetUtils.ts` as the canonical owner, added TSDoc for vault resolution, extension mapping, and empty-result behavior, and preserved the `utils.ts` export used by plugin startup | Repository search confirms one implementation; `npm run build` passed with the unchanged 34 circular dependency warnings; bundle size decreased by 609 bytes to 5,095,379 bytes; targeted ESLint has no diagnostics on the consolidated helper and retains the same two unrelated backlog errors in `embeddedAssetUtils.ts`; `git diff --check` passed |
| 2026-08-08 | Closed the font helper validation checkpoint | Manual testing found no regressions in vault font loading | User confirmed `getFontDataURL()` works |
| 2026-08-08 | Consolidated `cropCanvas()` | Kept `embeddedAssetUtils.ts` as the canonical owner, added TSDoc for source rectangles, output scaling, and intentionally unchanged browser canvas behavior, and preserved the `utils.ts` export | Repository search confirms one implementation; `npm run build` passed with the unchanged 34 circular dependency warnings; bundle size remains 5,095,379 bytes because Rollup already removed the unused duplicate; targeted ESLint has no diagnostics on the consolidated helper and retains the same two unrelated backlog errors in `embeddedAssetUtils.ts`; `git diff --check` passed |
| 2026-08-08 | Consolidated `getImageSize()` and `promiseTry()` | Kept the identical embedded-asset implementations as canonical, documented their native image-loading and promise-boundary semantics, and preserved the `utils.ts` import surface through re-exports. The former `getImageSize()` differed only in bracing and comments; both `promiseTry()` copies were textually identical. No caller used distinct behavior | Repository search confirms one implementation of each helper; `npm run build` passed after each code change; targeted ESLint passed |
| 2026-08-08 | Consolidated `isVersionNewerThanOther()` | Extracted the identical implementations to dependency-light `versionUtils.ts` and preserved both `utils.ts` and `sceneDataUtils.ts` import paths. Missing, malformed, prerelease, and numeric comparison behavior remains unchanged | Repository search confirms one implementation; `npm run build` and targeted ESLint passed |
| 2026-08-08 | Consolidated element positioning, cloning, and bound-text helpers | Extracted `estimateBounds()`, `repositionElementsToCursor()`, the internal ID-preserving `cloneElement()`, and `getBoundTextElementId()` to documented `excalidrawElementUtils.ts`, preserving exports from both former owner modules. Repositioning and cloning were identical. The only bound-text difference was a redundant optional chain after an equivalent non-null/length guard, so callers could not observe it. The public `ExcalidrawAutomate.cloneElement()` API, which assigns a new ID, was not changed | Repository search confirms one implementation of each helper; targeted ESLint, `npm run build`, `npm run lib`, and `git diff --check` passed; bundle size remains 5,095,379 bytes because Rollup had already eliminated the duplicate paths; `npm run madge` could not run because `madge` is not installed |
| 2026-08-08 | Extracted plugin settings implementation from `main.ts` | Added documented `PluginSettingsManager` with a narrow host contract to own load/save, default assembly, existing library/Markdown-image/oEmbed/preview migrations, and API-key obfuscation. At this extraction checkpoint, retained `plugin.settings`, all public plugin method signatures, startup autosave behavior, settings readiness, settings-tab timing, external-change library invalidation, persisted format, and unknown-key behavior. After delegate TSDoc, `main.ts` decreased from 1,676 to 1,563 lines | `npm run build` passed after each code change; `npm run lib` and a scoped `git diff --check` passed; the new manager and changed delegate lines have no ESLint diagnostics, while targeted lint still reports four unrelated existing `any` diagnostics in the startup-script block of `main.ts`; the initial extraction build was 5,094,122 bytes, 1,257 bytes below the preceding checkpoint. A concurrent unrelated `nanoid` dependency update changed the final workspace build to 5,094,522 bytes; `npm run madge` could not run because `madge` is not installed; manual settings validation remains pending |
| 2026-08-09 | Reviewed and retained `reEnableAutosave` | An attempted removal was reversed after confirming that this is not migration code: it resets the session-scoped temporary disable/enable autosave commands when the plugin starts. Restored `LoadSettingsOptions`, startup `{ reEnableAutosave: true }`, and the post-load in-memory assignment exactly as extracted. No autosave behavior change remains | Repository search confirms the complete option flow is restored; `npm run build`, `npm run lib`, targeted manager ESLint, and scoped `git diff --check` passed; the existing 34 circular dependency warnings are unchanged; `main.ts` is again 1,563 lines and the bundle is again 5,094,522 bytes; manual settings validation remains pending |
| 2026-08-09 | Moved temporary autosave enablement out of persisted settings | A full runtime and history review confirmed that `settings.autosave` had no settings UI and served only as the global gate for the temporary enable/disable commands. Replaced it with documented plugin-instance state initialized to enabled, updated commands and view scheduling to use that state, removed `autosave` from `ExcalidrawSettings` and `DEFAULT_SETTINGS`, and removed `LoadSettingsOptions`/`reEnableAutosave`. Desktop and mobile interval settings remain unchanged. Existing persisted `autosave` keys are intentionally left inert under the no-sanitizer policy | Repository search confirms there are no remaining supported-setting or runtime references to `settings.autosave`; the settings interface and defaults contain the same 182 keys; `npm run build`, `npm run lib`, and scoped `git diff --check` passed with the existing 34 circular dependency warnings. Broad lint reports only the existing backlog and no diagnostics on changed lines; bundle size decreased by 151 bytes to 5,094,371 bytes; manual session-command validation remains pending |
| 2026-08-09 | Extracted footer safe-area styling from `main.ts` | Added documented `FooterSafeAreaManager` with a narrow host contract to own phone/tablet CSS injection, exact device-aware open-document traversal, setting-driven removal, and unload cleanup. Kept `plugin.updateFooterSafeAreaPadding()` and its layout-ready and settings UI call sites unchanged as delegates. Font document traversal remains in `main.ts` until the separate font extraction | `npm run build`, targeted manager ESLint, and scoped `git diff --check` passed; `main.ts` decreased by 46 lines from 1,558 to 1,512; bundle size increased by 99 bytes to 5,094,470 bytes from manager/delegate overhead; `npm run madge` could not run because `madge` is not installed; phone/tablet manual validation remains pending |
| 2026-08-09 | Extracted font management from `main.ts` | Added documented `FontManager` to own the existing CJK asset cache, vault reads, CJK/custom stylesheet lifecycle, custom font metrics and package registration, readiness state, and device-aware document traversal. Preserved every plugin-facing font method as a delegate, retained `plugin.fourthFontLoaded` for view compatibility, kept the initial readiness value and 100ms timer unchanged, and injected lazy package-map access without changing `PackageManager` construction or ownership | `npm run build`, `npm run lib`, targeted manager ESLint, and scoped `git diff --check` passed; `main.ts` decreased by 130 lines from 1,512 to 1,382; bundle size increased by 379 bytes to 5,094,849 bytes from manager/facade overhead; `npm run madge` could not run because `madge` is not installed; desktop, mobile, CJK, custom-font, and popout manual validation remains pending |
| 2026-08-09 | Extracted startup timing instrumentation from `main.ts` | Added documented `StartupTimer` to own the private event list, previous-event timestamp, total/delta formatting, and debug output. Kept every timing call in its original lifecycle position, retained `logStartupEvent()` and the misspelled `printStarupBreakdown()` as plugin delegates, preserved pre-layout events across the layout-ready baseline reset, and retained `loadTimestamp` as an own public field with unchanged assignment behavior | `npm run build`, `npm run lib`, targeted manager ESLint, and scoped `git diff --check` passed; `main.ts` decreased by 6 lines from 1,382 to 1,376; the latest bundle is 5,095,747 bytes, 898 bytes above the preceding checkpoint due to the manager and compatibility facade; `npm run madge` could not run because `madge` is not installed; startup breakdown inspection remains pending |
| 2026-08-09 | Rejected a catch-all Markdown integration manager and removed proven dead code from `main.ts` | Markdown post-processing, install-codeblock handling, observer setup, and rerender behavior have different lifecycle and ownership constraints, so they will remain explicit rather than being grouped under a weak abstraction. Removed the uncalled private `registerEventListeners()`, its `MetadataCache` import, the never-assigned `main.ts` `fileExplorerObserver`, and its inert unload check. The active file-explorer observer and teardown in `ObserverManager` were not changed | Repository-wide reference searches confirmed both removed members had no callers or assignments and that `PluginFileManager.initialize()` owns the active initial cache walk; `npm run build` passed with the existing circular-dependency warnings; targeted lint reports only the same four pre-existing startup-script `any` diagnostics and none on changed lines; `git diff --check` passed; `main.ts` decreased by 29 lines from 1,376 to 1,347 and the bundle decreased by 381 bytes to 5,095,366 bytes; manual unload/reload validation remains pending |
| 2026-08-09 | Extracted the complete `ExcalidrawView` export pipeline | Added documented `ViewExportManager` to own raw `.excalidraw`, SVG, PNG, clipboard, PDF, export-option resolution, autoexport file writing, and alternate-theme embedded-file loading. Retained every existing public method on `ExcalidrawView` as a documented delegate, kept the public `exportDialog` field and its persistence/teardown lifecycle on the view, and supplied existing runtime dependencies explicitly to avoid a new import cycle. Converted seven type-only imports and pointed `exportUtils` directly at canonical `svgToBase64()` to remove runtime back-edges without changing behavior | `npm run build` passed after every code change; `npm run lib`, manager-targeted ESLint, repository reference searches, and `git diff --check` passed. Broader touched-file lint retains the existing backlog but reports no manager diagnostics. Circular dependency warnings decreased from 34 to 33; `ExcalidrawView.ts` decreased by 365 lines from 9,080 to 8,715; the bundle increased by 2,177 bytes to 5,097,543 bytes and remains below 5 MiB; manual export validation remains pending |
| 2026-08-09 | Removed inert commented-out fragments from `ExcalidrawView` | Deleted the obsolete `excalidrawRef` declaration, disabled dimensions state/effect experiment and matching width/height props, old tooltip and paste alternatives, commented debug logging, and retired `setLocalFont()` calls. Retained comments that explain active semaphore, timer, observer, and sizing workarounds | `npm run build` passed with the same 33 circular-dependency warnings; residue search found none of the targeted fragments; `git diff --check` passed; `ExcalidrawView.ts` decreased by 46 lines from 8,715 to 8,669; bundle size is unchanged at 5,097,543 bytes because comments were not emitted; no runtime testing is required beyond the export-manager checkpoint |
| 2026-08-09 | Extracted fullscreen DOM coordination from `ExcalidrawView` | Added documented `ViewFullscreenManager` with a narrow structural host to own the existing enter, state-check, and exit algorithms. Preserved the public `gotoFullscreen()`, `isFullscreen()`, and `exitFullscreen()` methods as delegates, the owner-document scoping needed by popout windows, tools-panel state updates, leaf-change timeout cancellation, CSS class names, selectors, and mobile layout restoration | `npm run build`, `npm run lib`, manager-targeted ESLint, repository call-site searches, and `git diff --check` passed. The same 33 circular-dependency warnings remain; `ExcalidrawView.ts` decreased by 105 lines from 8,669 to 8,564; the manager contains 166 documented lines; bundle size increased by 828 bytes to 5,098,371 bytes and remains below 5 MiB. Manual main-window, popout, mobile, and teardown validation remains pending, with cross-document DOM restoration the highest-risk area |
| 2026-08-09 | Extracted link navigation from `ExcalidrawView` | Added documented `ViewLinkNavigationManager` to own tooltip removal, link-source resolution, public hook dispatch, modifier handling, link prompting, new-file behavior, embedded and Markdown image links, LaTeX/Mermaid/Draw.io branches, fullscreen exit, and pane navigation. Retained `removeLinkTooltip()`, `handleLinkHookCall()`, the private selection resolver, `processLinkText()`, `linkClick()`, and `handleLinkClick()` on the view as delegates so every existing caller and hook surface remains intact. Supplied cyclic runtime dependencies and four private view operations explicitly; the manager imports the concrete view only as a type. Reused canonical `SelectedElementWithLink` and `SelectedImage` interfaces from `excalidrawViewTypes.ts` and removed their local duplicates | Final `npm run build`, `npm run lib`, manager-targeted ESLint, repository call-site searches, import-graph analysis, and `git diff --check` passed. The build retained the 33-warning circular-dependency baseline; static analysis found zero runtime import paths from the manager back to `ExcalidrawView`. The full-view lint retains its pre-existing type backlog but no new unused import. `ExcalidrawView.ts` decreased by 442 lines from 8,564 to 8,122; the manager contains 649 documented lines; bundle size increased by 2,478 bytes to 5,100,849 bytes and remains below 5 MiB. Manual link-routing validation remains pending, with modifier semantics and special image-link branches the highest-risk areas |
| 2026-08-09 | Retired Draw.io/Diagram plugin customization | Removed detection of `drawio-obsidian`, Draw.io SVG inspection, and routing to the external `diagram-edit` view from link navigation. Deleted the Create DrawIO file Automate script and icon from the maintained script library, its directory metadata and install catalog entries, and its generated script-library and AI-reference copies. Added a 2.27.0 release note. Historical release notes remain unchanged as an accurate record, and existing script files in user vaults are intentionally not deleted | `npm run build`, `npm run lib`, manager-targeted ESLint, JSON parsing, repository residue searches, and `git diff --check` passed. Runtime and maintained catalog searches find no Draw.io plugin IDs, view types, or SVG markers; only the new retirement note, this action history, and historical release notes retain the name. Circular-dependency warnings remain at 33; `ViewLinkNavigationManager.ts` decreased by 25 lines from 649 to 624; the final bundle is 5,100,535 bytes, 314 bytes below the preceding checkpoint and still below 5 MiB. Manual validation should confirm ordinary SVG links now follow normal Obsidian navigation and that the script no longer appears in the downloadable catalog |
| 2026-08-09 | Extracted Excalidraw extension rendering from `ExcalidrawView` | Added documented `ViewExcalidrawExtensionRenderer` to own `ttdDialog()`, `diagramToCode()`, `ttdDialogTrigger()`, `renderWelcomeScreen()`, `renderCustomActionsMenu()`, and `renderEmbeddable()`. Kept the six private view methods and all Excalidraw root call sites as delegates. The renderer uses `view.packages.react` and `view.packages.excalidrawLib`; back-edge-prone runtime modules and private dialog actions are constructor-injected, and the concrete view import is type-only. `renderEmbeddableMenu()`, `renderToolsPanel()`, and `renderTopRightUI()` remain in the view because they own refs, live menu instances, or view lifecycle state | Production builds passed after every code edit, `npm run lib` passed, renderer-targeted ESLint and `git diff --check` passed, and full-view lint showed only the established type backlog after extraction-specific unused imports were removed. The build retained the 33-warning circular-dependency baseline. `ExcalidrawView.ts` decreased by 358 lines from 8,122 to 7,764; the renderer contains 479 documented lines; the bundle increased by 1,746 bytes to 5,102,281 bytes and remains below 5 MiB. Manual testing should prioritize a popout window, then the main-window welcome/menu/embeddable paths, then ExcaliAI text-to-diagram and diagram-to-code; repeat core rendering on mobile, with popout React isolation the highest-risk regression |
| 2026-08-09 | Audited production `main.js` size | The fresh 5,103,913-byte bundle has 138,967 bytes of headroom below 5 MiB. The first recommended batch is packaging-only: use Pako's inflate-only build (about 25 KB gross saving) and store the per-window React payload deflated (about 78 KB gross saving). The next source-level candidate is replacing the bundled `yaml` parser used only by `mergeMarkdownFiles()` with Obsidian's external `parseYaml()`/`stringifyYaml()` APIs after compatibility tests. Larger later candidates are a focused TTF/OTF metadata reader instead of `opentype.js`, build-time compaction of CJK metadata and static help/startup payloads, and pruning release-note entries that the current ten-item display cap makes unreachable. Translation extraction and changes to the embedded Excalidraw runtime remain last-resort work | Generated a Rollup module-composition report, measured injected payloads and standalone dependency costs, searched all imports/callers, ran `npm run code:unused` with no unused-variable findings, verified that only `pako.inflate()` is called and that `pako_inflate.min.js` decodes the current payload format, and confirmed that 13 of 23 release-note entries are unreachable under the current `.slice(0, 10)` behavior. The documentation-only production build passed with the existing 33 circular-dependency warnings; no runtime source was changed |
| 2026-08-09 | Replaced full Pako with its inflate-only distribution | Changed only the Rollup build input from `pako.min.js` to `pako_inflate.min.js`. The existing CommonJS wrapper, `pako.inflate()` call, global `unpackBase64Deflate()` compatibility surface, compressed payload format, and per-window package architecture remain unchanged. Obsidian YAML replacement is the next checkpoint. React compression is deferred because a previous attempt prevented `main.js` from completing bootstrap before the inflater could run | `npm run build` passed with the existing 33 circular-dependency warnings; `node --check dist/main.js` passed; the inflate-only and full builds produced byte-for-byte identical output for all five emitted Excalidraw and locale payloads; `git diff --check` passed. `main.js` decreased exactly 25,380 bytes, from 5,103,913 to 5,078,533 bytes, leaving 164,347 bytes below 5 MiB. Manual validation should prioritize cold startup and locale switching on mobile, then a desktop popout; a decompression failure during initialization is the highest-impact risk |
| 2026-08-09 | Replaced the bundled YAML runtime with Obsidian's public YAML APIs | Updated the sole runtime consumer, `mergeMarkdownFiles()`, to use `parseYaml()` and `stringifyYaml()` from `obsidian`, added TSDoc for its precedence and array-merge contract, and removed `yaml` as a direct production dependency. Existing target frontmatter remains text-preserved. Obsidian serialization may represent nulls as empty values and keep long scalars on one line; these forms parse to the same values as the previous output | Repository search confirms no source imports from `yaml`; targeted ESLint and `npm run lib` passed; production builds before and after dependency cleanup passed with the existing 33 circular-dependency warnings; the CRLF-aware whitespace check passed. `main.js` decreased 104,707 bytes, from 5,078,533 to 4,973,826 bytes, leaving 269,054 bytes below 5 MiB. Manual validation should prioritize template/target array merging and missing keys through **Convert note to Excalidraw** and `ExcalidrawAutomate.create()`, then null, long-text, date, alias, multiline, quoted-value, desktop, and mobile cases |
| 2026-08-09 | Compressed the per-window React runtime payload | Deflated the minified React, ReactDOM, and JSX-shim source at build time. In the emitted bootstrap, inflate-only Pako and the dependency-free `unpackBase64Deflate()` helper are initialized first; only then is `REACT_PACKAGES` inflated and evaluated. The decompressed string remains alive for `PackageManager.getPackage()` to evaluate in each popout window. Removed the now-unused direct `jsesc` development dependency. This ordering specifically addresses the prior attempt that failed before React decompression could run | `npm run build` passed with the existing 33 circular-dependency warnings; `node --check dist/main.js` passed; emitted-order inspection confirms the inflater precedes React decompression; an isolated bootstrap smoke test initialized React 18.3.1 and ReactDOM, then successfully evaluated the retained package source a second time to simulate a popout. `main.js` decreased 78,540 bytes, from 4,973,826 to 4,895,286 bytes, leaving 347,594 bytes below 5 MiB. Manual validation is mandatory because the historical failure occurred during Obsidian startup: test desktop and mobile cold starts first, then main-window rendering, a new and restored popout, moving a leaf between windows, plugin disable/re-enable, and the extension-renderer paths |
| 2026-08-09 | Closed the compressed React validation checkpoint | Manual testing found no startup or runtime regressions with the bootstrap-safe compressed React payload | User confirmed the implementation works; the checkpoint is ready to commit |
| 2026-08-09 | Replaced `opentype.js` with a focused SFNT metric reader | Added documented, bounds-checked parsing of `head.unitsPerEm`, `hhea.ascender`, and `hhea.descender`, preserving exact raw values and the established line-height calculation. The already-read vault buffer is reused instead of decoding the generated data URL. Glyph outlines, shaping, rendering, and embedding remain owned by the browser and Excalidraw. Removed unused font-family-name parsing plus the `opentype.js` runtime and type dependencies. WOFF/WOFF2 continue to use the same fallback metrics as before | The new reader produced exact metric parity with `opentype.js` across all 21 installed TTF/OTF fixtures, including a CFF OTF, and safely rejected three malformed/truncated fixtures. Repository search found no remaining runtime dependency references. Targeted ESLint passed for the new reader and `FontManager`; `node --check dist/main.js` and production builds passed with the existing 33 circular-dependency warnings; `npm run madge` remains unavailable because `madge` is not installed. `main.js` decreased 186,132 bytes, from 4,895,286 to 4,709,154 bytes, leaving 533,726 bytes below 5 MiB. Manual validation should first compare existing and newly created local-font text using representative TTF and OTF files on desktop, including wrapping, baselines, bound text, reload, SVG/PNG/PDF export, and a popout; then repeat core text creation/reload on mobile and smoke-test WOFF/WOFF2. The highest-risk regression is different layout for an unusual TTF/OTF whose metrics fall back because its table structure is malformed or unsupported |
| 2026-08-09 | Closed the focused SFNT reader validation checkpoint | Manual testing found no regressions in local-font loading or behavior after removing `opentype.js` | User confirmed the implementation works well; the checkpoint is ready to commit |
| 2026-08-09 | Added and adopted the parallel Excalidraw `build:obsidian` artifact | Kept upstream `buildPackage.js` and `index.tsx` unchanged. Added documented fork-only build and entry files that bundle the current ESM source graph and runtime dependencies into one IIFE artifact, expose the same `ExcalidrawLib` window contract, externalize React/ReactDOM/official JSX runtimes, inline dynamic imports, explicitly disable unavailable worker module URLs, embed non-CJK WOFF2 imports, and retain 209 Xiaolai paths for lazy vault/network loading. Mermaid remains a dependency resolved at runtime: the bundle keeps `getSharedMermaidInstance()` delegating to the host plugin and contains no bundled `@excalidraw/mermaid-to-excalidraw` module. Switched Rollup's payload and stylesheet inputs to `dist/obsidian`; retained the existing React UMD payload and Assistant CSS URLs until this startup checkpoint is manually validated | `yarn build:obsidian` and declaration generation passed without esbuild warnings. A JSDOM/window evaluation against the current React payload found exactly 106 exports in both old and new bundles with no missing or added keys, including the Mermaid bridge. The package dry run contains only four `dist/obsidian` artifacts plus declarations and no CJK binaries or legacy UMD output. `npm run build` passed with the unchanged 33 circular-dependency baseline and an unrelated unresolved `opentype.js` warning from existing source. `dist/main.js` decreased by 209,935 bytes from 5,102,281 to 4,892,346 bytes. Manual validation is required before modernizing React; main-window startup is the first gate, then popout creation/migration, mobile startup, Mermaid through Excalidraw Extras, core editing, and export paths |
| 2026-08-09 | Integrated prerequisite size-reduction work from PR #2876 into the ESM migration branch | Fast-forwarded `migrate-to-esm-build` to the exact PR head, preserving all four reviewed commits: inflate-only Pako, Obsidian YAML, compressed per-window React, and the focused SFNT reader that removes `opentype.js`. Reapplied the in-progress ESM artifact paths and combined both action histories | Both the clean PR head and the combined ESM state passed `npm run build` with the established 33 circular-dependency warnings and no unresolved `opentype.js` warning. The integrated `dist/main.js` is 4,684,742 bytes |
| 2026-08-09 | Closed the production ESM startup checkpoint | The ESM-source-based Excalidraw payload starts successfully in Obsidian and its surface behavior works as expected. This validates the main-window production gate required before retiring the legacy build path | User confirmed successful startup and surface-level operation. Popout, mobile, Mermaid, and broader workflow coverage remain part of the risk-based manual matrix |
| 2026-08-09 | Retired the fork's legacy UMD/webpack package machinery | Restored upstream-style ESM package metadata, removed `build:umd`, the CommonJS `require` export, UMD entry/environment/public-path shims, both webpack configurations, their dedicated TypeScript configurations, size script, and webpack-only dependencies. `build:obsidian` now cleans only `dist/obsidian`, so standard ESM and Obsidian outputs coexist; standard `prepack` builds both | `yarn build:esm`, `yarn build:obsidian`, and `yarn pack` passed; the tarball contains ESM development/production entries and both single-file Obsidian runtimes, with no legacy UMD entry or webpack files. The shared lockfile dropped about 1,900 obsolete dependency lines. The plugin passed both `npm run dev` and `npm run build` with the existing 33 circular-dependency warnings; development additionally retains the existing Rollup sourcemap-option warning. `node --check dist/main.js` passed. Repository-wide `yarn test:typecheck` remains blocked by the fork's existing test-global and fixture type backlog, with no diagnostics in the modified build files |
| 2026-08-09 | Replaced the obsolete fixed Excalidraw color-picker height cap exposed by the ESM CSS order | The ESM bundle revealed contradictory fork styles: `ColorPicker.scss` intentionally removes Obsidian's global cap, while the later `obsidianStylingOverrides.css` reapplied `max-height: 10rem`. Replaced only that stale fixed value with Radix's placement-specific `--radix-popover-content-available-height`, retaining vertical scrolling solely when the actual collision boundary requires it. `ObsidianRadixPortal`, its collision boundary, and the plugin's separate 260px `ColorPicker.ts` dialog remain unchanged | Development and production Obsidian CSS now use the Radix available-height variable instead of `10rem`; the focused `ObsidianRadixPortal` test passed; `yarn build:obsidian`, plugin development build, plugin production build, and JavaScript syntax validation passed. Manual validation should open stroke/background palettes in the main window and a popout, then check a short mobile viewport; portal positioning in popouts is the highest-risk area |
| 2026-08-09 | Restored the fork's native color control to the color picker's input row | An upstream invalid-color-message change introduced a new outer wrapper around the hex input row. The fork-only native `input[type=color]` remained outside the inner grid during the merge, so it appeared on a separate line. Moved it back into the existing fork-specific fifth grid column without widening the popover or changing color/alpha behavior | `yarn build:obsidian` and both plugin build modes passed. Manual validation should confirm the native color control stays in the hex row for stroke, background, canvas, main-window, and popout palettes; narrow/mobile layouts are the highest wrapping risk |
| 2026-08-09 | Made the Assistant UI font genuinely offline in the Obsidian package | Restored upstream's relative URLs for the four locally present Assistant WOFF2 weights. The Obsidian WOFF2 data-URL loader now embeds them in the generated stylesheet instead of retaining the fork's obsolete `unpkg.com/@zsviczian/excalidraw@0.17.6-2` URLs. CJK font behavior is unchanged | Generated development and production CSS contain embedded Assistant font data and no old remote URLs; `yarn build:obsidian` and both plugin build modes passed. Manual validation should compare normal, medium, semibold, and bold UI text offline in the main window and a popout; fallback-font layout changes are the primary risk |
| 2026-08-09 | Closed the color-picker and Mermaid checkpoints and fingerprinted Assistant overrides | User validation confirmed that the palette height and native color-input alignment are fixed and that Mermaid still loads through Excalidraw Extras. Added the required `/*zsviczian*/` fingerprint to each fork-modified Assistant source rule | `yarn build:obsidian` and the plugin production build passed after fingerprinting; no generated CSS behavior changed |
| 2026-08-09 | Rejected the speculative text-to-diagram storage fallback | Manual testing showed that mirroring IndexedDB to local storage did not make chats persist and raised no storage error, so the fallback and migration code were removed rather than retaining an unnecessary second persistence backend | The plugin's original IndexedDB adapter is restored. Its silent no-op behavior and owning-window selection remain candidates for a dedicated plugin-side investigation after the ESM migration is merged |
| 2026-08-09 | Reverted the speculative Excalidraw-core text-to-diagram changes | Repository history confirmed that chat persistence has been a host-provided `TTDPersistenceAdapter` implementation since plugin version 2.20.2. The core autosave dependency and duplicate-hook changes did not fix the Obsidian failure and would increase future upstream merge friction, so all three core file edits and the added test were removed | The Excalidraw TTD sources now match the branch baseline exactly; no TTD file remains in the fork diff. Persistence diagnosis is explicitly deferred to the plugin-owned adapter and renderer integration after this ESM-focused checkpoint is merged |
| 2026-08-09 | Replaced React/ReactDOM UMD ingestion with a private official-package runtime | A documented nested Rollup build bundles installed `react`, `react-dom`, `react-dom/client`, `react/jsx-runtime`, and `react/jsx-dev-runtime` entrypoints. React 18 production's undefined `jsxDEV` retains the compatible `jsx` fallback. React, ReactDOM, and the JSX runtimes are lexical variables inside each `PackageManager` evaluation instead of `window` properties. The documented `window.ExcalidrawLib` scripting API remains available for backwards compatibility | Production build and syntax validation pass with the existing 33 circular dependencies. Two-window JSDOM evaluation initializes React 18.3.1 and all 106 Excalidraw exports with distinct package objects while sentinel `window.React` and `window.ReactDOM` values remain untouched and each window receives its own public `ExcalidrawLib`. Production `main.js` remains below 5 MiB. Manual validation must prioritize cold startup, new/restored popouts, moving a leaf between windows, plugin reload, and extension-renderer dialogs |
| 2026-08-09 | Restored debugger-grade development payloads | Development Excalidraw and React artifacts are no longer passed through the production-oriented Uglify step. The Excalidraw development build now carries an inline source map with original TS/TSX sources and a stable `sourceURL`, while production remains minified and map-free | The decompressed development payload is readable, contains original Excalidraw sources and an inline source map, and does not publish React or ReactDOM on `window`; the intentional `window.ExcalidrawLib` compatibility API remains. The larger development output is intentional and is not released; manual validation should confirm `obsidian-excalidraw-runtime.development.js` and original Excalidraw sources appear in DevTools |
| 2026-08-09 | Removed the redundant development CSS source map | The Excalidraw Obsidian build now strips only the generated development CSS inline map after compilation. Readable CSS and the JavaScript TS/TSX source map remain intact, while the plugin's cssnano pass no longer nests the original CSS map inside a second combined map | `yarn build:obsidian`, plugin production, and plugin development builds passed. Upstream development CSS decreased from 992,360 to 341,778 bytes. Combined development `styles.css` decreased from 2,123,032 to 331,366 bytes and contains no `sourceMappingURL`; development JavaScript retains its inline map, stable debugger source name, and readable original source modules |
| 2026-08-09 | Fixed the private React main-window bootstrap | Runtime testing exposed an asymmetry missed by the raw package test: the Rollup bundle still referenced its external `React` binding before the private runtime had created that lexical name, and the main-window Excalidraw evaluation could not see lexical React through a separate `window.eval`. The bootstrap now declares React, ReactDOM, and both JSX runtimes in plugin scope, and the main-window Excalidraw factory receives those exact instances as explicit parameters. Popout package creation remains independent per window, and React is still not assigned to `window` | Production and development builds pass. An emitted-bootstrap JSDOM test executes through the formerly failing React namespace initialization, loads React 18.3.1 and all 106 Excalidraw exports, confirms the package aliases use the same instances, preserves the public `window.ExcalidrawLib`, and confirms `window.React` and `window.ReactDOM` remain unset. Cold startup in Obsidian is the required manual checkpoint |
| 2026-08-09 | Upgraded the plugin-private runtime to React 19.2.8 | Updated the exact paired `react` and `react-dom` dependencies and matching React 19 declaration packages. Preserved the official-package runtime builder, lexical main-window bootstrap, independent popout evaluation, client renderer, and JSX runtime surfaces; no React global was introduced | Dependency resolution deduplicates Excalidraw, Jotai, Radix, and the plugin onto React 19.2.8. Production, development, and library builds passed; an isolated runtime evaluation reported React 19.2.8 with callable `createRoot`, `jsx`, and `jsxDEV`. Manual validation should prioritize cold startup and Excalidraw editing in the main window, then new/restored popouts and moving a leaf between windows; React runtime mismatch is the highest-impact risk |
| 2026-08-09 | Corrected the text-to-diagram persistence diagnosis | Manual inspection confirmed chats are present in the existing main-window IndexedDB store, and the history button proves `savedChats` was loaded. Reverted the view-window persistence-adapter experiment and retained the original main-window adapter | Investigate menu rendering instead: the shared dropdown is body-portaled by `ObsidianRadixPortal`, so the history content can sit behind the modal and lose styles that depended on a TTD ancestor. Validate menu visibility, restore, delete, and popout behavior after the component fix |
| 2026-08-09 | Restored the text-to-diagram history menu above its modal | `DropdownMenu.Content` already uses `ObsidianRadixPortal`; the regression was that its body-level portal escaped both the modal stacking context and the TTD header ancestor used by its styles. Added a TTD-specific class that survives the portal and moved the existing menu rules to that selector with a z-index immediately above the Excalidraw modal | `yarn build:obsidian` passed and emitted the class in JavaScript plus the portal-safe selector in both CSS builds. The plugin production build using the local component artifacts passed with the existing 33 circular dependencies. Validate opening, restoring, and deleting history in the main window first, then repeat in a popout and on mobile; stacking and click-outside behavior are the highest-risk areas |
| 2026-08-10 | Codified the refactor and ESM migration lessons in contributor guidance | Corrected stale sample-plugin details in the plugin agent guide, documented incremental refactoring and risk-based testing, separated per-window rendering from main-window persistence, and described the two-repository ESM artifact handoff. Expanded both contributor guides and added a fork-specific `AGENTS.md` covering fingerprinting, external React and Mermaid, offline assets, Radix portals, upstream mergeability, and validation | Documentation-only change. Verify links, commands, artifact names, package-manager boundaries, and Git diffs in both repositories; future component work should validate `yarn build:obsidian` before refreshing the plugin's local artifacts, and future plugin work should continue to run `npm run build` after source changes |
| 2026-08-11 | Extracted the React root without changing rendering syntax (Phase 7) | Added `src/view/components/ExcalidrawRoot.ts` exporting `createExcalidrawRootElement(view, initdata)`, a mechanical move of the former `excalidrawRootElement()` body: `React.useRef`/`useEffect` hook calls, ObsidianMenu/EmbeddableMenu/SelectedElementActionsMenu mount and teardown, the ResizeObserver wiring, and the full `Excalidraw` prop object, all with `this.` replaced by `view.` and zero logic changes. `ExcalidrawView.instantiateExcalidraw()` now calls `React.createElement(createExcalidrawRootElement.bind(null, this, initdata))` in place of the former `this.excalidrawRootElement.bind(this, initdata)` — same bound-zero-arg-function-component shape, same `excalidrawRoot`/`ReactDOM.createRoot()` ownership. Because the render tree reached ~30 previously private `ExcalidrawView` fields and methods (`dropManager`, `obsidianMenu`, `embeddableMenu`, `selectedElementActionsMenu`, and the on*/render* callback family), those were widened to `public` as a type-only part of this same checkpoint rather than inventing a narrow host-object interface, matching how `packages`/`plugin`/`excalidrawAPI`/`getViewElements()`/`openMarkdownImageEditor()` were already public for the same reason. Removed two imports (`obsidianToExcalidrawMap`, `shouldRenderMermaid`) that became unused in `ExcalidrawView.ts` after the move | `npm run build`, `npm run lib`, and `node --check dist/main.js` passed with the existing 33 circular-dependency baseline (verified: baseline `ExcalidrawView.ts`-only lint is 162 problems/155 errors/7 warnings; post-move the same 155 errors split as 146 in `ExcalidrawView.ts` + 9 in the new file, confirming the extraction relocated pre-existing findings rather than introducing new ones). `ExcalidrawView.ts` decreased by 191 lines from 7,765 to 7,574; the new module is 243 documented lines; `dist/main.js` is 4,710,938 bytes, 194 bytes below the preceding checkpoint. Manual validation should prioritize a popout window first (cross-window React mismatch is the highest-impact risk given the render tree moved files), then main-window tools-panel positioning/resize, the embeddable and selected-element context menus, welcome screen, and text-to-diagram/diagram-to-code dialogs; repeat basic editing on mobile |
| 2026-08-11 | Replaced deprecated `React.MutableRefObject` with `RefObject` | React 19's types unified `MutableRefObject` into `RefObject` (both now have a writable `current`); `MutableRefObject` survives only as a deprecated alias. Type-only rename across all 9 flagged usages in `ExcalidrawView.ts`, `CustomEmbeddable.tsx`, and `ObsidianMenu.tsx`, fallout from the earlier React 19 runtime upgrade surfaced by an Obsidian code-scanner report | `npm run build`, `npm run lib`, and `node --check dist/main.js` passed with the unchanged 33-warning baseline; bundle size unchanged (types are erased at compile). A stash/pop comparison confirmed the one remaining `CustomEmbeddable.tsx:1477` `no-unsafe-assignment` finding pre-dates this change |
| 2026-08-11 | Extracted `MarkdownImageController` from `ExcalidrawView` (Phase 6 item 6) | Added `src/view/managers/MarkdownImageController.ts` owning the Markdown-image deletion queue (`queueMarkdownImageDeletion`/`processMarkdownImageDeletionQueue` plus its 3 state fields) and the edit/convert trio (`openMarkdownImageEditor`, `convertEmbeddableToMarkdownImage`, `convertMarkdownImageToEmbeddable`), a mechanical move with `this.` replaced by `this.view.`. `ExcalidrawView` keeps all three conversion/edit methods as public delegates (external callers: `CommandManager.ts`, `ExcalidrawRoot.ts`, `EmbeddableActionsMenu.tsx`), replaced its one internal `queueMarkdownImageDeletion` call site in `onExcalidrawIncrement()` with `this.markdownImageController.queueMarkdownImageDeletion(...)`, and reads `this.markdownImageController.markdownImageDeletionPrompt` in `save()` in place of the field it read directly before (same conditional-then-await shape, unchanged). Widened `getBackOfTheNoteSections()` to `public` (shared by 3 other existing call sites plus the new controller). Cross-module functions from the existing `ExcalidrawData`/`MarkdownImage`/`MarkdownImageEditor`/`Dialogs/Prompt`/`excalidrawViewUtils` cycle (`parseMarkdownImages`, `unwrapMarkdownImageBlock`, `isMarkdownImageElement`, `getMarkdownImageCustomData`, `getEmbeddableMarkdownImageSource`, `convertEmbeddableElementToMarkdownImage`, `getMarkdownImageSource`, `convertMarkdownImageElementToEmbeddable`, `getLevelOneMarkdownHeadings`, `openMarkdownImageEditorSidepanel`, `MultiOptionConfirmationPrompt`, `GenericInputPrompt`, `insertBackOfTheNoteContent`, `errorlog`) are constructor-injected rather than imported directly in the new file, matching the `ViewLinkNavigationManager`/`ViewExcalidrawExtensionRenderer` precedent for avoiding a new circular-import edge | `npm run build`, `npm run lib`, and `node --check dist/main.js` passed with the unchanged 33-warning circular-dependency baseline (empirically confirming the dependency-injection approach added no new cycle). Targeted ESLint on `ExcalidrawView.ts` is unchanged at 149 problems/146 errors/3 warnings before and after (the moved code carried zero lint findings of its own), and the new `MarkdownImageController.ts` has zero ESLint findings; the three external caller files were re-checked and show only the 9 pre-existing findings already attributed to the prior React-root checkpoint. Repository-wide search confirmed no other file reads the three moved state fields. `ExcalidrawView.ts` decreased by 234 lines from 7,574 to 7,340; the new module is 367 documented lines; `dist/main.js` is 4,712,873 bytes, 1,935 bytes above the preceding checkpoint, still well below 5 MiB. Manual validation should prioritize the Markdown-image deletion keep/delete prompt racing a save (`save()`'s await), then the local- and external-source conversion paths in both directions, the H1-heading and section-name prompts, and the embeddable-to-Markdown-image path when the source file is dirty; the deletion-queue/save race is the highest-impact risk since it crosses persistence timing |
| 2026-08-12 | Closed the `MarkdownImageController` validation checkpoint | Manual testing found no issues | User confirmed testing completed with no issues; committed |
| 2026-08-12 | Planned and extracted `ViewSceneFileManager` from `ExcalidrawView` (Phase 6 item 5) | Entered plan mode to scope the higher-risk loader/timer/teardown surface before touching it; plan approved, then implemented. Added `src/view/managers/ViewSceneFileManager.ts` owning `activeLoader`/`nextLoader`/`deferredValidationLoader`/`deferredValidationTimer`/`deferredValidationFilePath`/`queuedLoadSceneFilesRequest`/`pendingDeferredValidationFileIDs` and the 5 methods that operate on them (`cancelDeferredSceneFileValidation`, `addDeferredValidationCandidates`, `scheduleDeferredSceneFileValidation`, `scheduleSceneFileDeferredValidation`, `loadSceneFiles`), a mechanical move with `this.` replaced by `this.view.` for view reads/writes and left as same-class `this.` for the loader's own reciprocal calls. `lastSceneLoadTime` stays on `ExcalidrawView` (read externally by `excalidrawViewUtils.ts` for leaf-switch detection) but continues to be written by the manager via `view.lastSceneLoadTime = ...`. `loadSceneFiles()` and `scheduleSceneFileDeferredValidation()` stay as public delegates so their two external callers (`ExcalidrawAutomate.ts`'s scripting surface, `EventManager.ts`'s leaf-switch handler) needed no edits. The three byte-for-byte-duplicated loader-teardown blocks in `onClose()`, `onunload()`, and `clear()` collapsed to one call each to a new `terminateActiveLoaders()` method. A production build caught a direct external read of `activeLoader` at `EventManager.ts:387` that the initial plan's call-site trace had missed (it greps for method calls, not field reads); preserved with a pass-through `get activeLoader()` getter on `ExcalidrawView` rather than editing the external caller. `EmbeddedFilesLoader` (already a confirmed cycle participant) and the shared `addFiles()` helper (kept on `ExcalidrawView` since the unrelated LaTeX-equation-editing flow also calls it) are constructor-injected rather than imported directly in the new file, matching the `ViewExportManager`/`MarkdownImageController` precedent | `npm run build`, `npm run lib`, and `node --check dist/main.js` passed with the unchanged 33-warning circular-dependency baseline. A repository-wide search after the `EventManager.ts` fix confirmed no remaining external reference to any of the 7 moved fields or 3 fully-private moved methods. Targeted ESLint across `ExcalidrawView.ts`, `EventManager.ts`, and `ExcalidrawAutomate.ts` is unchanged at 229 problems/225 errors/4 warnings before and after (the moved code carried zero lint findings of its own), and the new `ViewSceneFileManager.ts` has zero ESLint findings. `ExcalidrawView.ts` decreased by 242 lines from 7,340 to 7,098; the new module is 324 documented lines; `dist/main.js` is 4,713,231 bytes, 358 bytes above the preceding checkpoint, still well below 5 MiB. Manual validation should prioritize, in order: opening a drawing with several embedded images/PDFs (stale-first pass with no flicker from the deferred validated pass), rapid file switching (`nextLoader` queuing and `clear()`'s termination path), theme toggling with images open, editing a locally-linked image's path, a sync update changing embedded files, an ExcalidrawAutomate script calling `targetView.loadSceneFiles` plus a leaf switch to trigger `EventManager`'s deferred-validation call, and view close/plugin reload/popout close with a load in flight — the deferred-validation/save-race and lifecycle-teardown paths are the highest-impact risk since none of this is exercised by the build |
| 2026-08-12 | Closed the `ViewSceneFileManager` validation checkpoint | Manual testing found no issues | User confirmed "ViewSceneFileManager testing did not uncover any nasty surprises" in the same message that declined `ViewInteractionController` for now; committed |
| 2026-08-13 | Investigated the circular-dependency count and fixed unnecessary value imports | `npx madge --circular` reports 322 elementary cycles versus Rollup's steady 33-warning summary; confirmed this is the same underlying densely-connected core (roughly `ExcalidrawView.ts`, `main.ts`, `ExcalidrawAutomate.ts`, `ExcalidrawData.ts`, `EmbeddedFileLoader.ts`, `ImageCache.ts`, `fileUtils.ts`, `constants.ts`, `types.d.ts`, and several `Dialogs/`/`utils/` files) enumerated as many overlapping paths rather than 322 independent problems. Found 19 files importing `ExcalidrawView` or `ExcalidrawPlugin` as a *value* (e.g. `import ExcalidrawView from "..."`) purely to type a constructor parameter or field, with zero actual runtime usage (verified by grep for property/method access) — converted all 19 to `import type`, plus one unrelated `svgToExcalidraw` `Point` type import, to remove genuinely unnecessary runtime coupling | `npm run build` and a `git stash`/`pop` ESLint diff (514/514, unchanged) passed. Both the madge count (322) and the Rollup circular-dependency warning count ("and 30 more", 33 total) were **unchanged** by this fix: madge does not distinguish `import type` from value imports when building its graph, and the Rollup-reported cycles turned out to route through other, genuinely-necessary value imports in the same core cluster, not through the 19 edges fixed here. The fix is still correct and was committed (`f39db658`) as a real (if small) coupling reduction, but actually shrinking the reported cycle count would require breaking real value-level cycles inside the core cluster (e.g. `ExcalidrawData.ts` <-> `EmbeddedFileLoader.ts`), which is a larger, separate undertaking |

## Executive recommendation

Do not convert `ExcalidrawView` wholesale into a React component.

`ExcalidrawView` must remain an Obsidian `TextFileView` because Obsidian owns
its file/view lifecycle, leaf identity, serialization hooks, window migration,
and teardown. React is a child runtime mounted inside that host. The viable
target is therefore a hybrid:

1. Keep `ExcalidrawView` as a thin Obsidian adapter and stable compatibility
   facade.
2. Move cohesive, non-rendering behavior into view-scoped controllers under
   `src/view/managers/`.
3. Move the current `excalidrawRootElement()` function component and its render
   wiring into a package-aware component module.
4. Use React state only for state that determines rendered UI.
5. Move save/reload/unload coordination toward explicit non-React
   coordinators. Do not replace these flags with React state.

Two compatibility requirements apply to every phase:

- The ExcalidrawAutomate API, hook behavior, defaults, signatures, and its
  access to `ExcalidrawView` must remain intact for scripts and companion
  plugins.
- Extracted modules, exported functions, public methods, compatibility shims,
  and non-obvious lifecycle code must receive high-signal TSDoc. TSDoc is the
  TypeScript equivalent intended by “JavaDoc-like documentation” in this plan.

For `main.ts`, keep the lifecycle ordering visible in the plugin class while
moving implementation details into focused managers. A short explicit startup
sequence is safer here than a generic dependency-injection or plugin framework.

## Current-state assessment

### Size and dependency surface

At the time of this assessment:

| File | Lines | Primary responsibilities currently mixed together |
| --- | ---: | --- |
| `src/core/main.ts` | 2,102 | Entry point, settings migration and persistence, startup choreography, teardown, fonts, styles, post processors, script startup, compatibility facades |
| `src/view/ExcalidrawView.ts` | 9,080 | Obsidian view lifecycle, persistence, sync, scene loading, exports, link handling, input handling, embeddables, menus, React root, Excalidraw callbacks |
| `src/core/managers/PackageManager.ts` | 235 | Per-window React, ReactDOM, and Excalidraw runtime creation and cleanup |
| `rollup.config.mjs` | 294 | Single-bundle construction, runtime injection, compression, CSS, locales, and build-time compatibility workarounds |

A repository search finds approximately 62 source modules importing the
concrete plugin class and 46 importing `ExcalidrawView`. These counts do not
include unknown user scripts or companion plugins. Both classes are therefore
compatibility surfaces even where TypeScript marks a member as an internal
implementation detail.

The production `dist/main.js` built during this assessment is 5,106,385 bytes.
That is only 136,495 bytes, or 2.60%, below a 5 MiB limit. Bundle size
must be checked after every refactor. Source-file splitting will improve source
architecture but will not create runtime chunks because Rollup uses
`inlineDynamicImports: true` and deliberately emits one CommonJS `main.js`.

### Bundle-size reduction audit for the 2.27.0 checkpoint

After the view extractions, a fresh production bundle is 5,103,913 bytes. The
5 MiB ceiling is 5,242,880 bytes, leaving 138,967 bytes (about 136 KiB or
2.65%) of headroom. The large injected sections explain why ordinary source
cleanup has limited impact:

The first implemented reduction, switching to inflate-only Pako, reduced the
bundle exactly 25,380 bytes to 5,078,533 bytes. Current headroom is 164,347
bytes (about 160 KiB or 3.13%). Replacing the bundled YAML runtime then reduced
the bundle another 104,707 bytes to 4,973,826 bytes. Current headroom is
269,054 bytes (about 263 KiB or 5.13%). Compressing the React package source
then reduced the bundle another 78,540 bytes to 4,895,286 bytes. Replacing
`opentype.js` with the focused SFNT reader reduced it another 186,132 bytes to
4,709,154 bytes. Current headroom is 533,726 bytes (about 521 KiB or 10.18%).

| Injected section | Approximate production characters | Share of `main.js` |
| --- | ---: | ---: |
| Deflated/base64 Excalidraw runtime | 2,786,756 | 54.6% |
| Minified Rollup application bundle | 1,941,603 | 38.1% |
| Four compressed non-English locales | 188,668 | 3.7% |
| Uncompressed per-window React/ReactDOM payload | 138,628 | 2.7% |
| Inflate-only Pako runtime | 21,479 | 0.4% |

The recent structural extractions increased the application section slightly,
but they did not duplicate React or Excalidraw. The best first savings are
therefore packaging and dependency substitutions rather than reversing the
new module boundaries.

Recommended order:

1. Completed: replaced `pako.min.js` with `pako_inflate.min.js`. Repository-wide
   search found only `pako.inflate()` at runtime, and the smaller distribution
   decodes the same zlib payloads. The source files are 46,859 and 21,479 bytes
   respectively; the production bundle decreased exactly 25,380 bytes.
2. Implemented; awaiting manual validation: replaced the `yaml` package used
   only by `mergeMarkdownFiles()` with Obsidian's external `parseYaml()` and
   `stringifyYaml()` functions. The production bundle decreased 104,707 bytes.
   Parsing remains equivalent; Obsidian's frontmatter serializer can format
   nulls and long lines differently while preserving their parsed values.
3. Implemented; awaiting manual validation: deflated the
   React/ReactDOM/JSX-shim source at build time. Unlike the prior failed
   attempt, the emitted bootstrap initializes Pako and the inflater before
   decompressing or evaluating React. The production bundle decreased 78,540
   bytes, and the decompressed package source remains available for popouts.
   This still requires real Obsidian startup testing because that is where the
   earlier approach failed.
4. Remove or archive release-note entries that cannot be rendered. The dialog
   always slices the assembled notes to ten entries; `Messages.ts` currently
   has 23 top-level entries, so `2.24.1` and the 12 older entries are
   unreachable even when the user manually requests all notes. Those entries
   occupy about 18 KB of source string data. Preserve their history outside
   the runtime import graph.
5. Implemented; awaiting manual validation: replaced `opentype.js` with a
   focused SFNT reader for the three metrics actually consumed by Excalidraw.
   English family-name parsing was removed because it had no consumer. The
   reader matched all 21 available TTF/OTF fixtures exactly and retains the
   existing fallback for invalid files and all WOFF/WOFF2 fonts. The production
   bundle decreased 186,132 bytes.

Secondary static-payload candidates, after the above checkpoints:

- `CJKLoader.ts` contains about 122 KB of generated font filenames and Unicode
  ranges. Build-time serialization plus the already available inflater can
  compact this substantially without moving the data to Excalidraw Extras.
- `SuggesterInfo.ts` contains about 80 KB of static ExcalidrawAutomate help
  metadata. Lazy inflation could reduce its stored representation, but its
  synchronous public help and suggester paths must retain the same object
  shape and timing.
- The startup-script template is stored as 18,912 base64 characters; deflating
  the decoded template produces about 5,096 base64 characters. This is a
  modest, localized later win.
- The empty-drawing placeholder is about 23 KB of static scene data and the
  embedded Excalidraw Mastery settings logo is about 20 KB. Compacting them or
  changing the image format is possible, but both are user-visible and should
  follow the non-visual reductions.
- `chroma-js` is used only for applying SVG color alpha while ColorMaster is
  already bundled. Consolidation may remove another dependency, but named
  colors and exact output syntax must be compared before assuming the two
  implementations are interchangeable.

Do not prioritize the following:

- Moving translations to Excalidraw Extras. The four compressed locales total
  about 189 KB, but the safer first two packaging changes alone should recover
  roughly 103 KB, and the dependency substitutions offer more headroom.
- Removing `polybooljs`, `lz-string`, or compatibility facades solely because
  they appear large. They participate in the public ExcalidrawAutomate or
  persisted-scene surface.
- Replacing Popper or CodeMirror CSS parsing without a dedicated behavioral
  project. Their collision handling and editor behavior carry more risk than
  their likely saving justifies.
- Changing the embedded Excalidraw runtime or its base64 codec as an early
  step. It dominates bundle size, but it is also the most startup-sensitive
  and popout-sensitive payload.

Every bundle reduction must record both gross source expectation and actual
`dist/main.js` delta. Packaging changes require startup tests in the main
window and a popout on desktop, plus a mobile cold start. Font, YAML, SVG, and
static-data changes require the feature-specific tests described above rather
than relying on build success alone.

### `main.ts`

The plugin class is doing three different jobs:

- It is the required Rollup and Obsidian entry point.
- It is the ordered composition root for plugin-wide services.
- It is a widely used facade over settings, file, event, observer, command,
  stencil, package, and view operations.

The first roughly 580 lines also contain pure or mostly pure settings
compatibility logic, especially the legacy AI-setting migration. That
compatibility has reached its retirement point and can be removed as the first
substantial reduction of the entry module.

Several existing managers already own meaningful behavior, but `main.ts`
retains delegate methods such as `openDrawing()`, `isExcalidrawFile()`,
`modifyEventHandler()`, `getPackage()`, and observer operations. Those delegates
should remain during early refactors. Removing them would turn a structural
change into a repository-wide and potentially external API change.

The ordering inside `onload()` and `onloadOnLayoutReady()` is behavioral:

- The Markdown post processor must be registered during `onload()`.
- `PluginFileManager` must exist early enough for Markdown processing.
- Settings and Excalidraw Automate are needed before layout-ready work.
- Per-window packages, observers, monkey patches, styles, scripts, fonts, and
  image cache have a deliberate sequence.
- Loading views are switched only after the required runtime is ready.
- Some work is intentionally deferred until after real Excalidraw views exist.

The refactor must preserve this sequence, including which calls are awaited,
which are launched without awaiting, and the current error isolation around
individual startup steps.

### Persisted settings and legacy AI compatibility

There is currently no generic supported-key normalization, and this refactor
will not add one. Obsidian stores the plugin's persisted settings in
`data.json`; `loadSettings()` merges all loaded top-level properties into
`plugin.settings`, and `saveSettings()` can write those properties back.

Before Phase 1, `ExcalidrawSettings` and `DEFAULT_SETTINGS` contained the same 204
top-level keys. This is useful, but an interface is erased by TypeScript and
cannot be inspected at runtime. `DEFAULT_SETTINGS` or a generated/explicit key
set must be the runtime representation of the specification.
After the targeted legacy AI removal, both contain the same 183 keys. No
runtime supported-key filter was introduced.

The legacy AI compatibility path is spread across more than the migration
function:

- migration and stripping helpers in `main.ts`;
- legacy properties in `ExcalidrawSettings` and `DEFAULT_SETTINGS`;
- fallback reads in `AIUtils.ts`;
- a one-off GPT reset during startup.

The existing `LEGACY_AI_SETTING_KEYS` list also mixes genuinely obsolete keys
with `aiDefaultMultimodalModel`, which is still used by the current settings UI
and AI model selection. The list must not simply be deleted wholesale. The
first implementation must define the current supported AI schema, preserve
current profile/model/default fields, and remove only the retired compatibility
surface.

Removing `stripLegacyAISettings()` is safe only after legacy members are also
removed from `DEFAULT_SETTINGS`. Otherwise
`Object.assign({}, DEFAULT_SETTINGS, loaded)` reintroduces every legacy default
into memory and an unfiltered `saveSettings()` persists them again.

The chosen 2.27.0 policy is deliberately non-destructive: remove confirmed
legacy AI members from the current TypeScript settings contract, defaults,
migration, and runtime fallback logic, but do not delete arbitrary persisted
keys. A stale legacy key already present in `data.json` may continue to
round-trip as an inert unknown property. This is preferable to risking deletion
of settings introduced by a newer plugin version or stored by another device.

### `ExcalidrawView`

The view class currently combines several distinct state domains:

| State domain | Examples | Appropriate owner |
| --- | --- | --- |
| Obsidian lifecycle | loaded, unloading, popout unload, window migration, leaf close | `ExcalidrawView` plus a lifecycle helper |
| Persistence and synchronization | dirty path, saving, autosaving, force-saving, prevent reload, just loaded | Plain TypeScript coordinator, not React |
| Excalidraw runtime | imperative API, scene, files, Excalidraw `AppState` | Excalidraw itself plus view adapters |
| Rendered plugin UI | tools panel visibility, theme, fullscreen indicator, preview mode | React component state or a small UI store |
| Transient interaction throttles | hover sleep, wheel timeout, text-edit resize guard, imported-image timer | Focused controller or lifecycle-owned timers |

The current `ViewSemaphores` object mixes all five domains. Its name obscures
the fact that some values are lifecycle state, some are mutex-like guards, some
are one-shot event suppression, and some are timer state.

This does not mean the flags can be removed mechanically. They coordinate
events from independent owners: Obsidian file events, React/Excalidraw
callbacks, autosave timers, sync, view unload, leaf detach monkey patches,
embeddable editors, mobile keyboards, and popout teardown. The current file has
46 `window.setTimeout()` calls, 22 `window.clearTimeout()` calls, two
`ResizeObserver` constructions, and both native and debugging mutation
observer paths. Changes to timing, scheduling, or cleanup are behavioral
changes even when the resulting code looks simpler.

The view's public identity must also remain stable. `ExcalidrawAutomate` uses
`instanceof ExcalidrawView`, stores it as `targetView`, and exposes it through
hooks. Dialogs, managers, utilities, components, scripts, and companion-plugin
behavior access many view members directly.

### Duplicate and triplicate logic

An initial exact-name scan confirmed several consolidation candidates:

- `utils.ts` and `sceneDataUtils.ts` both contain helpers including
  `wrapTextAtCharLength`, `getBinaryFileFromDataURL`, `getLinkParts`,
  `arrayToMap`, and `updateFrontmatterInString`.
- `utils.ts` and `embeddedAssetUtils.ts` both contain helpers including
  `getFontDataURL`, `svgToBase64`, export-setting helpers, and `cropCanvas`.
- `excalidrawAutomateUtils.ts` and `excalidrawViewHelpers.ts` both contain
  `cloneElement` and `getBoundTextElementId`.

Some pairs are textually identical; others have already diverged in types,
null handling, safe-frontmatter access, or naming. This is evidence for an
audit, not permission for bulk deletion. Overload declarations, intentionally
isolated build subprojects, domain-specific variants, and compatibility
re-exports must not be misclassified as accidental duplication.

### React and popout windows

The current root renderer is already a React function component in substance:
`excalidrawRootElement()` calls hooks and is mounted with `createRoot()`. It is
embedded as a class method and written with `React.createElement()` rather than
living in a component module.

The unusual runtime binding is essential:

- Rollup embeds React, ReactDOM, and compressed Excalidraw payloads.
- `PackageManager` evaluates a fresh package set in each Obsidian window.
- `ExcalidrawView.onload()` resolves packages for `ownerWindow`.
- The root, hooks, refs, and elements use `this.packages.react` and
  `this.packages.reactDOM`.
- The package is removed when the last relevant leaf in a window closes.

An extracted component must preserve that binding. A normal module-level
`import React from "react"` followed by global `ReactDOM.createRoot()` is not a
safe replacement. JSX is possible, but only after proving that every emitted
element and hook call is bound to the view's package-managed React instance.

## Architectural target

The intended dependency direction is:

```text
Obsidian
  |
  v
ExcalidrawPlugin (entry point and stable facade)
  |
  +--> explicitly ordered plugin managers/services
  |
  +--> PackageManager -- one Packages instance per Window
                         |
                         v
ExcalidrawView (Obsidian TextFileView and stable facade)
  |
  +--> view-scoped controllers
  |
  +--> package-aware React root adapter
           |
           v
      Excalidraw and plugin React UI
```

The target is not a strict line-count goal. It is successful when ownership is
clear, lifecycle edges are explicit, and behavior can be changed in one
subsystem without reading 9,000 lines first.

Suggested eventual source boundaries are:

```text
src/core/
  main.ts                         Obsidian entry, ordered lifecycle, facades
  managers/
    PluginSettingsManager.ts      Load/save/encryption/default assembly
    FontManager.ts                Per-document fonts and package registration
    ViewportStyleManager.ts       Phone/tablet safe-area behavior

src/view/
  ExcalidrawView.ts               Obsidian host, public facade, composition
  components/
    ExcalidrawRoot.tsx            Package-aware render tree, eventually TSX
  managers/
    ViewExcalidrawExtensionRenderer.ts
    ViewExportManager.ts
    ViewLinkNavigationManager.ts
    ViewSceneFileManager.ts
    ViewPersistenceCoordinator.ts
    ViewInteractionController.ts
    ViewLifecycleResources.ts
```

These names are provisional. Create a module only when a specific extraction
is being implemented; do not scaffold empty abstractions in advance.

## Refactoring rules

Every step in this plan should follow these constraints:

1. One responsibility per change. Do not combine extraction, renaming, type
   tightening, timer changes, and behavior changes.
2. Keep old public methods as forwarding facades until all internal and known
   external consumers have a migration path.
3. Preserve command IDs, settings keys, frontmatter, scene serialization,
   hooks, class identity, import paths, and method signatures.
4. Preserve startup and teardown order exactly unless a separate change is
   specifically testing an order change.
5. Preserve `await`, fire-and-forget, timeout, debounce, and retry semantics
   during code moves.
6. Preserve the choice of `window`, `ownerWindow`, `mainDocument`, and
   `ownerDocument`. Do not normalize them during extraction.
7. Do not add a state-management library. It would add bundle weight and a
   second abstraction before the state domains are separated.
8. Do not upgrade React, Excalidraw, Rollup, TypeScript, or Obsidian typings in
   the same change as a structural refactor.
9. Do not change the custom Excalidraw fork as part of this source-structure
   effort unless a later, isolated requirement proves it necessary.
10. Run `npm run build` immediately after every code change. Use targeted lint
    on touched files and run `npm run code` for visibility when appropriate.
11. Preserve the complete ExcalidrawAutomate public surface. An internal move
    must retain forwarding members on `ExcalidrawView` or the plugin wherever
    scripts or plugins may rely on them.
12. Add TSDoc to every new exported class/function and public method. Add
    module-level documentation and `@remarks` for ordering constraints,
    ownership, timers, observers, undocumented Obsidian behavior, popout
    runtime binding, and compatibility decisions. Avoid comments that merely
    restate the code.
13. Search for exact and semantic duplicates before adding a helper. When
    consolidating existing duplicates, map every import and caller, select one
    canonical owner, preserve aliases where compatibility requires them, and
    validate behavior before deleting the alternatives.
14. At the end of every refactor step, provide a risk-ranked test
    recommendation. Identify the behavior most likely to break, give concrete
    checks in priority order, state whether desktop, mobile, tablet, or popout
    coverage is warranted, and call out any high-risk path that was not tested.

## Implementation sequence

Each numbered sub-step should normally be its own commit or pull request.

### Phase 0: establish a behavioral baseline

Before moving runtime code:

1. Record production `main.js` byte size and the startup breakdown emitted by
   the existing startup instrumentation.
2. Create a repeatable manual smoke-test vault or checklist covering the
   validation matrix later in this document.
3. Record which tests are possible on desktop, mobile, and popout windows in
   the current development environment.
4. Capture known warnings from `npm run build` so a later change can be judged
   on whether it introduced a new warning.
5. For synchronization work, capture debug traces for open, edit, autosave,
   external modify, reload, leaf close, last-popout-leaf close, and plugin
   unload. This becomes the characterization oracle for later coordinator work.

No production behavior should change in this phase.

### Phase 1: retire legacy AI settings and fallbacks

This is the recommended first implementation change.

1. Define and document the current supported AI settings. Keep the profile and
   model maps, current default model IDs—including
   `aiDefaultMultimodalModel`—and current token limits.
2. Remove `migrateLegacyAISettings()`, its URL/provider/capability helpers, and
   legacy-only types/constants from `main.ts`.
3. Remove retired AI properties from `ExcalidrawSettings` and
   `DEFAULT_SETTINGS`, and remove fallback reads from `AIUtils.ts`. Search the
   full repository before deciding that a field is legacy.
4. Preserve current fields even if they appear in the old legacy-key list.
   `aiDefaultMultimodalModel` is a confirmed example.
5. Remove `stripLegacyAISettings()` and `LEGACY_AI_SETTING_KEYS` only after the
   legacy defaults and runtime fallbacks are gone.
6. Retire the GPT-specific one-off startup reset if its only purpose is the old
   AI schema. Treat the unrelated compression reset separately.
7. Do not introduce generic supported-key filtering, a settings schema
   version, or unknown-key deletion. Preserve unrelated persisted properties.
8. Add fixtures covering a current profile/model configuration, encrypted
   current API keys, arbitrary script settings, and raw legacy AI fields.
   Confirm that legacy fields no longer influence resolved AI configuration
   and that unrelated properties remain untouched.
9. Verify that loading and saving current settings remains behaviorally
   identical and that current AI defaults are still persisted.
10. Add a concise 2.27.0 entry to `src/shared/Dialogs/Messages.ts` if the
    settings cleanup is observable to users. Do not add new UI copy merely to
    announce an internal refactor.

This is a deliberate retirement, not a compatibility migration: users who use
ExcalidrawAI have already migrated, and obsolete AI-only values may be dropped.
The implementation must nevertheless preserve every field in the current AI
schema.

Implementation completed on 2026-08-08. The retired keys were removed from
the TypeScript contract and defaults, and they no longer participate in AI
configuration resolution. Existing unknown properties in `data.json` are not
deleted; this intentionally preserves the no-sanitizer decision.

### Phase 2: introduce a settings implementation service

After Phase 1 is stable:

1. Create `PluginSettingsManager` to own load, default assembly, remaining
   migrations, encryption/decryption, save, and external-settings reload.
2. Keep `plugin.settings` as the canonical externally visible settings object.
3. Keep `ExcalidrawPlugin.loadSettings()`, `saveSettings()`, and
   `onExternalSettingsChange()` as delegates with their current signatures.
4. Keep the one-off startup update and settings-tab readiness in the explicit
   startup flow until their timing is separately characterized.

Do not change persisted data format in this phase.

### Phase 3: audit and consolidate duplicate logic

Perform the audit in small families rather than a repository-wide rewrite:

1. Generate an inventory of duplicate exported names and textual clone
   candidates across `.ts` and `.tsx` files.
2. For each candidate, compare implementation, types, null/falsy behavior,
   side effects, environment assumptions, and every import/call site.
3. Classify it as exact duplicate, intentional variant, overload/re-export, or
   uncertain. Record the classification in the action log.
4. Choose the canonical module using the repository placement rules. Scene
   data helpers belong in a scene-focused module; embedded asset helpers belong
   in an asset-focused module; lifecycle state does not belong in `utils`.
5. Consolidate one helper family per change. Redirect imports first, retain a
   forwarding export when an import path may be public, then delete the old
   implementation only after validation.
6. Add focused characterization tests for helpers whose copies have diverged.
7. Check bundle byte impact: consolidation should normally be neutral or
   smaller, but Rollup tree shaking and circular imports can produce surprising
   results.
8. Repeat the audit after the major file extractions so refactoring does not
   create new near-duplicates.

The initial candidates listed in the assessment are the starting queue, not a
pre-approved deletion list.

### Phase 4: extract plugin-owned window assets

Do this in separate changes:

1. Extract font discovery, CJK loading, per-document style installation,
   per-window Excalidraw font registration, and cleanup into `FontManager`.
2. Preserve plugin delegates used by settings and popout-view initialization:
   `initializeFonts()`, `loadFontFromFile()`, and related accessors.
3. Extract phone/tablet footer safe-area style management into a small
   `ViewportStyleManager` or extend `StylesManager` if its ownership and
   teardown model match.
4. Preserve the current document enumeration and deliberate style-element
   creation path.

Font initialization crosses `PackageManager`, open documents, settings, and
popout creation, so it should not be combined with package-manager changes.

### Phase 5: slim `main.ts` while retaining explicit choreography

Candidates should be extracted one at a time:

1. Keep Markdown post-processing, install-codeblock registration, observer
   setup, and rerender behavior explicit in their current owners. A proposed
   `MarkdownIntegrationManager` was rejected because these responsibilities do
   not form a cohesive lifecycle unit.
2. Move startup-script execution behind a focused runner owned by the script
   subsystem.
3. Completed: startup timing storage/formatting now belongs to `StartupTimer`,
   with the plugin methods retained as compatibility delegates.
4. Group initialization and cleanup of managers, but keep a readable ordered
   list in `onloadOnLayoutReady()` and `onunload()`.
5. Completed: after repository-wide reference searches, removed the unused
   private `registerEventListeners()` and the never-assigned
   `fileExplorerObserver` field and unload check from `main.ts`. The active
   observer owned by `ObserverManager` remains intact.

Do not hide lifecycle ordering inside a generic service container. The desired
`main.ts` is a readable composition root, not an empty forwarding shell.

### Phase 6: extract low-risk `ExcalidrawView` subsystems

Start with cohesive operations that do not own mount/unmount ordering or save
mutual exclusion. For every extraction, retain the current method on
`ExcalidrawView` as a delegate.

Recommended order:

1. Completed: `ViewExportManager` owns export preference resolution, file
   collection, SVG, PNG, PDF, clipboard, and save-to-file operations while the
   view retains compatibility delegates and dialog lifecycle.
2. Implemented: `ViewFullscreenManager` owns fullscreen DOM class and style
   coordination while the view retains compatibility delegates. Validate the
   unchanged selectors in the main window, popouts, mobile layouts, screenshot
   capture, link-driven exit, and view teardown before closing this checkpoint.
3. Implemented: `ViewLinkNavigationManager` owns link-source resolution, hook
   invocation, prompting, modifier handling, special embedded-image branches,
   and pane navigation while the view retains compatibility delegates.
4. Implemented: `ViewExcalidrawExtensionRenderer` owns the plugin-specific
   Excalidraw render slots for TTD, diagram-to-code, the welcome screen, custom
   actions, and embeddables. The view retains its render delegates and supplies
   all elements through its window-scoped React and Excalidraw packages.
5. `ViewSceneFileManager`: active/next/deferred embedded-file loaders and
   deferred validation scheduling.
6. `MarkdownImageController`: deletion queue, edit handoff, conversion, and
   local-source operations.
7. `ViewInteractionController`: hover preview and pointer/key interaction only
   after the earlier controllers establish a working host-interface pattern.

Each manager should depend on the smallest host interface practical rather
than importing the concrete view if that can be done without a large rewrite.
Avoid inventing a broad `IExcalidrawView` containing most of the current class;
that merely duplicates the monolith as an interface.

### Phase 7: extract the React root without changing rendering syntax

The first renderer extraction should be a mechanical move, not a state rewrite
or JSX conversion.

1. Define a narrow render-host contract containing runtime packages, refs,
   callbacks, and render slots required by the root.
2. Move the body of `excalidrawRootElement()` to a component module.
3. Pass the `Packages` instance resolved for `view.ownerWindow` into that
   component.
4. Inside the component, call hooks and `createElement()` from that package's
   `react` object.
5. Continue creating the root with that package's `reactDOM.createRoot()`.
6. Keep API assignment, initialization callbacks, cleanup, and ref handoff
   behavior identical.
7. Test main window, existing popout, moving a leaf to a popout, restored
   workspace popout, and closing the last popout leaf.

A safe conceptual shape is:

```ts
const runtime = view.packages;
const Root = createExcalidrawRootComponent(renderHost, runtime.react);
view.excalidrawRoot = runtime.reactDOM.createRoot(view.contentEl);
view.excalidrawRoot.render(runtime.react.createElement(Root));
```

The exact API can differ, but it must not fall back to a module-global React or
ReactDOM instance.

### Phase 8: convert the extracted root to TSX

Only after Phase 7 is stable should syntax change:

1. Rename the renderer to `.tsx` and convert a small render fragment at a time.
2. Ensure the configured classic JSX transform resolves `React.createElement`
   to a lexically scoped, package-managed React object.
3. Use module-level React imports for types only where possible.
4. Do not combine JSX conversion with callback, prop, state, or menu changes.
5. Compare behavior and bundle size after each fragment conversion.

TSX will improve readability, but it is not itself a state-management
architecture. The package-runtime constraint matters more than the file
extension.

### Phase 9: separate UI state from operational state

Introduce React state only where it eliminates imperative UI synchronization.

1. Define a small `ViewUiSnapshot` for values actually rendered by plugin UI,
   such as dirty indicator, fullscreen, preview mode, view mode, theme, and
   selected UI mode.
2. If multiple components need the snapshot, implement a tiny plain
   TypeScript observable store owned by the view.
3. Subscribe with the package-managed React instance, potentially through
   `useSyncExternalStore()` after verifying availability in every loaded
   runtime.
4. Migrate one existing imperative `ToolsPanel.setState()` pathway at a time.
5. Avoid copying Excalidraw `AppState` into another store. Read it from the API
   or consume the relevant callback value.

Do not put the following in React state:

- saving, autosaving, or force-saving;
- reload suppression;
- dirty file identity used during file switching;
- unload or popout-unload state;
- timers, observers, or loader ownership;
- data needed after the React root has started unmounting.

React updates are asynchronous and the component can disappear while Obsidian
still requires a final save. Those concerns must remain available independently
of the mounted tree.

### Phase 10: replace `ViewSemaphores` incrementally

Do not replace the entire object in one change. First classify and encapsulate
one cluster while preserving the existing storage and timing.

Suggested clusters:

| Coordinator | Initial fields/behavior |
| --- | --- |
| `ViewPersistenceCoordinator` | `saving`, `autosaving`, `forceSaving`, `dirty`, save wait behavior |
| `ViewReloadGuard` | `preventReload`, `embeddableIsEditingSelf`, their reset timers |
| `ViewLoadState` | `justLoaded`, `preventAutozoom`, initial `onChange` suppression |
| `ViewLifecycleState` | `viewloaded`, `viewunload`, `popoutUnload`, `scriptsReady` |
| `ViewInteractionThrottle` | `hoverSleep`, `wheelTimeout`, `isEditingText`, imported-image guard |

For each cluster:

1. Add named query and transition methods while still using the current fields.
2. Replace direct writes in one call path at a time.
3. Add debug assertions for impossible transitions without changing production
   recovery behavior.
4. Compare characterization traces.
5. Only then move storage into the coordinator.
6. Keep compatibility accessors for known external reads or writes until their
   consumers are migrated.

Potential future improvements such as a single-flight save promise, abortable
waits, or replacing polling loops are behavioral projects. They should follow,
not accompany, the structural extraction. Existing watchdogs and sleeps must
remain until device and Obsidian behavior has been tested against a replacement.

### Phase 11: narrow dependencies and clean up compatibility facades

After the major boundaries are stable:

1. Replace concrete plugin/view imports with small type-only capability
   contracts in newly extracted modules where this materially reduces cycles.
2. Move repeated shared shapes to `src/types/`; do not create duplicate local
   aliases.
3. Use deprecation comments and forwarding accessors before removing a facade
   used by scripts or companion plugins.
4. Run `npm run madge` once its tooling is available and address new cycles
   introduced by the refactor. The command was not available in the installed
   dependencies during this assessment.
5. Perform naming cleanup only in a dedicated compatibility-aware pass.

## Validation matrix

`npm run build` is mandatory after every code modification. In addition, each
phase should select the relevant manual cases below. Every step's handoff must
turn that selection into a risk-ranked test recommendation: lead with the
highest-probability or highest-impact failure, name the required platforms and
window modes, and distinguish automated validation from untested manual risk.

### Build and static checks

- Production build completes with no new errors or warnings.
- Touched files pass targeted ESLint diagnostics.
- `npm run code` is reviewed for newly introduced findings despite the existing
  repository backlog.
- `npm run lib` is run when the public/library API is touched.
- When a change can affect ExcalidrawAutomate, compare the generated library
  declarations/API docs with the baseline and run `npm run doc` as applicable.
- `npm run madge` is run after structural import changes once available.
- `dist/main.js` stays below 5 MiB and its byte delta is recorded.
- No generated `dist/` or `lib/` file is edited manually.

### Startup and lifecycle

- Fresh plugin enable with no open drawing.
- Restored workspace with one or multiple drawings.
- Main-window view creation before and after plugin readiness.
- Existing popout, restored popout, and leaf moved between windows.
- Close normal leaf, close last popout leaf, close popout window, disable
  plugin, and reload plugin.
- Confirm package cleanup does not break another leaf in the same window.
- Confirm startup breakdown has no material regression.

### Persistence and synchronization

- Manual save and command-triggered force save.
- Desktop and mobile autosave intervals.
- Close while clean, dirty, already saving, and editing text.
- External file modification and sync-style reload.
- Same drawing open as Excalidraw and Markdown.
- Same drawing open in multiple leaves/windows.
- Embeddable or Markdown-image editor updates its owning drawing.
- Initial `onChange` does not cause a false save or sync ping-pong.
- Container-size update after load does not mark the scene incorrectly.

### Interaction and UI

- Desktop, phone, and tablet layouts.
- Mobile on-screen keyboard open/close during text editing.
- Resize, sliding panes, hover editor, canvas node, fullscreen, and popout.
- Hover preview while scrolling/zooming.
- Link click modifier combinations and view mode.
- Tools panel, selected-element actions, embeddable menu, welcome screen,
  context menu, and custom actions.
- Theme, canvas color, grid, handedness, UI mode, pinch zoom, and wheel zoom.

### Data and integrations

- Large drawing and many embedded files.
- SVG, PNG, clipboard, PDF, and `.excalidraw` export.
- Local images, Markdown images, PDFs, LaTeX, Mermaid, web embeds, and YouTube.
- Excalidraw Automate calls and all view hooks.
- Existing ExcalidrawAutomate function/property names, signatures, defaults,
  return values, hook timing, `targetView` behavior, and
  `instanceof ExcalidrawView` behavior remain unchanged.
- Script engine startup, pinned scripts, and install-codeblock flow.
- ExcaliBrain or another companion integration if available.

## Per-change review checklist

Before merging any refactor step, answer all of the following:

- What ownership boundary became clearer?
- Which public methods and fields were preserved as facades?
- Were all repository references searched before and after the change?
- Did any `await`, timer, retry count, observer target, event target, or cleanup
  order change?
- Did any use of `window`/`ownerWindow` or `mainDocument`/`ownerDocument`
  change?
- Which manual lifecycle cases were exercised?
- Did the production build pass, and what was the `main.js` byte delta?
- Were any new warnings or circular dependencies introduced?
- Were duplicate-name and semantic-clone searches performed before adding a
  new helper, and were intentional variants kept distinct?
- Do all new modules, exports, public methods, compatibility shims, and
  non-obvious lifecycle constraints have useful TSDoc?
- If the view or plugin facade moved, was ExcalidrawAutomate API and hook
  compatibility verified with library declarations and representative scripts?
- What is the highest-risk regression, which concrete tests are recommended in
  priority order, and which devices, platforms, or popout configurations are
  necessary for this particular change?
- Is the change independently reversible?

## Recommended first three implementation changes

1. Retire the complete legacy AI migration, fields, defaults, reset, and
   `AIUtils` fallback path without sanitizing unrelated persisted keys. This is
   the first 2.27.0 implementation target.
2. Complete the duplicate inventory, classify the confirmed utility
   candidates, and consolidate one exact, low-risk family after mapping all
   callers. Record the decision and validation in the action log.
3. Completed: extracted `ViewExportManager` while keeping all current
   `ExcalidrawView` export methods as delegates. This establishes the
   view-controller pattern away from lifecycle and synchronization.

`MarkdownImageController` and `ViewSceneFileManager` are both closed (manual
testing found no issues in either). This plan is now parked — see "Parked:
next steps if resumed" immediately below for exactly where to pick it back
up.

## Parked: next steps if resumed

As of 2026-08-13 this plan is paused in favor of `src/core/settings.ts` and
declarative-settings-readiness work (tracked separately, not in this
document). Nothing here is abandoned — the sequence below is exactly where
to resume.

**Learnings worth carrying forward:**

- The `ExcalidrawView`-typed-host + constructor-injected-dependencies pattern
  (used by every manager extracted so far) has held up across five
  extractions with zero functional regressions found in manual testing. Keep
  using it unchanged for `ViewInteractionController` if that's picked up.
- A production build has twice caught an external reference the plan's
  initial call-site trace missed (`activeLoader` read directly from
  `EventManager.ts`, found only because `tsc` failed to compile after the
  field went private) — grep-based call-site tracing during planning finds
  method calls reliably but can miss direct field reads. Always let the
  build be the final authority, not the trace.
- `git stash`/`pop` before/after ESLint diffing has been a reliable,
  cheap way to prove an extraction introduced zero new lint findings — keep
  using it for any future extraction or fix in this codebase.
- Circular-dependency counts from `npx madge --circular` and from Rollup's
  own build warning are **not directly comparable**: madge enumerates every
  elementary cycle (so one small strongly-connected core produces hundreds
  of overlapping paths), while Rollup reports something closer to the
  distinct problem count. Don't use the madge number as a target to drive
  toward zero; use Rollup's steady warning count (currently 33) as the
  tracked baseline instead.
- `import type` fixes for value-imports-that-are-really-just-types are safe
  and worth doing opportunistically (see the 2026-08-13 action-log entry),
  but they only remove *unnecessary* runtime coupling — they will not move
  the reported cycle count if a real value-level cycle still connects the
  same two files through another path. Actually reducing the core cluster's
  cycle count needs a deliberate pass at the genuine value-level cycles
  (starting candidates: `ExcalidrawData.ts` <-> `EmbeddedFileLoader.ts`,
  `constants.ts` -> `types.d.ts` -> `ExcalidrawAutomate.ts` -> `constants.ts`),
  which is real dependency-inversion work, not a quick follow-up.

**If resumed, in order:**

1. Re-validate the Phase 7 React-root extraction
   (`src/view/components/ExcalidrawRoot.ts`) manually — it was implemented
   and the checkpoint text was written, but no explicit user confirmation of
   manual testing was ever logged for it the way `MarkdownImageController`
   and `ViewSceneFileManager` were. Prioritize a popout window first (cross-
   window React mismatch is the highest-impact risk), then tools-panel
   positioning/resize, the embeddable and selected-element context menus,
   the welcome screen, custom menu actions, web/Obsidian embeddables, and
   text-to-diagram/diagram-to-code in the main window; repeat basic
   rendering and embeddables on mobile.
2. Decide on `ViewInteractionController` (hover preview + pointer/key
   handling). The user explicitly declined it for now ("I am not sure I
   want to implement `ViewInteractionController` at this time") rather than
   ruling it out permanently — it remains the last unclaimed Phase 6
   controller candidate, deliberately sequenced last for its hover-editor
   interop and mobile-keyboard timing risk.
3. Phase 8 (converting the extracted React root to TSX) should follow only
   after the React-root checkpoint above is explicitly confirmed closed, and
   must not be combined with any state or callback-wiring change.
4. After those steps, reassess coupling, bundle size, and manual-test
   coverage before committing to the next phase. This plan is deliberately a
   sequence of checkpoints rather than a promise to execute every proposed
   module unchanged.

## Related, separate effort: settings.ts declarative-shape adoption

Started 2026-08-13, independent of the `ExcalidrawView`/`main.ts` plan above
(different file, different motivation — not part of the parked plan, not
blocked by it, and not blocking it). Tracked here because it's the other
active refactor in the codebase and future sessions should know it exists.

**Goal:** prepare for Obsidian's declarative settings API
(`getSettingDefinitions()`, requires Obsidian 1.13+) without bumping
`minAppVersion` past 1.8.7 yet, by modeling settings as data
(`SettingDefinition` objects with a `control` variant) that the *current*
`display()` interprets via a new `buildSetting()` method, rather than each
setting being hand-built with `new Setting(...).addToggle(...)` etc.
`render`/`visible` (for Obsidian's real API) are deliberately not
implemented yet — only the legacy-rendering interpreter exists so far.

**Sequence so far:** extracted `ExcalidrawSettings`/`DEFAULT_SETTINGS`/AI
config constants to `src/core/settingsDefaults.ts`; split
`ExcalidrawSettingTab.display()` into 14 per-section methods (pure code
motion, verified via reconstruction diff); added the `SettingDefinition`
type system and `buildSetting()` interpreter, piloted against one or two
settings per control type (toggle/text/dropdown/slider) before doing a
full pass; converted all plain toggles, then extended `ToggleControl` with
`before`/`after`/`afterUpdate` hooks (matching every side-effect ordering
found: before assignment, between assignment and `applySettingsUpdate()`,
after `applySettingsUpdate()`) and `negate` (for two inverted-boolean
settings), and made `buildSetting()` return the underlying `Setting` so
callers that need to keep manipulating it afterward (e.g.
`.nameEl.setAttribute(...)`, later show/hide) can capture it. Toggle
control type is fully closed out. Text control type is also now fully
closed out: extended `TextControl` with the same `before`/`after`/
`afterUpdate` hooks, a `vaultPath` hook that wires the text input into the
existing `addVaultPathSupport()` (path suggester + existence warning), and
a `capture` hook (called with the raw `TextComponent` before
placeholder/value/onChange are wired) for callers that need to keep
manipulating the component afterward (a sibling toggle disabling it,
`configurePasswordTextInput()`). Dropdown control type is also now fully
closed out: extended `DropdownControl` with the same `before`/`after`/
`afterUpdate` hooks, and added a new `NumberDropdownControl` variant for
dropdowns whose options are numbers stored as DOM strings but bind to a
numeric field (autosave intervals, PDF-export scale, custom-pen count) —
`parse: "int" | "float"` controls the `parseInt`/`parseFloat` conversion
back into the setting. Slider control type is also now fully closed out:
extended `SliderControl` with `after`/`afterUpdate` hooks (no `before` —
no existing slider needed one). Widened `SliderSetting.onChange` in
`sliderUtils.ts` from `(value: number) => void` to `(value: number) =>
void | Promise<void>` since the hooks can be async, and `createSliderWithText`'s
internal caller now awaits it (`no-misused-promises`/`no-floating-promises`
caught both sides of this at lint time — a real, correctly-caught gap, not
a false positive). All four control types are now fully converted.

**Deliberately left as legacy imperative code (toggle type), each because
it doesn't fit the current `control` shape cleanly:**

- `AI_ENABLED_NAME` (`aiEnabled`) — reads with a `?? true` defensive
  fallback for legacy persisted data; `ToggleControl` has no way to express
  a read-time default.
- `GRID_DIRECTION_NAME` — two `.addToggle()` calls chained onto one
  `Setting` row (horizontal/vertical), bound to a nested,
  migration-guarded field (`gridSettings.GRID_DIRECTION?.horizontal ??
  true` with an inline "2.10.1 migration" backfill). `SettingDefinition`
  assumes one control per row and a flat top-level key.
- `GRID_DYNAMIC_COLOR_NAME` (`gridSettings.DYNAMIC_COLOR`) — nested field,
  not a flat `BooleanSettingKey`.
- `EXPORT_SVG_NAME` / `EXPORT_PNG_NAME` (`autoexportSVG`/`autoexportPNG`)
  — each toggle mutates a *different* setting's dropdown options
  (add/remove an "SVG"/"PNG" choice from the embed-type dropdown). A
  genuine cross-control relationship, structurally the same category as
  the deferred `visible` mechanism.
- The dynamic per-installed-script toggle in the Compatibility section —
  not a real named setting at all (`variableName`/`getValue`/`setValue`
  are runtime-generated per script), inherently `render`-only content once
  that control type exists.

**Deliberately left as legacy imperative code (text type), each because it
doesn't fit the current `control` shape cleanly:**

- `PAGE_TRANSCLUSION_CHARCOUNT_NAME`, `TRANSCLUSION_DEFAULT_WRAP_NAME`,
  `MD_TRANSCLUDE_WIDTH_NAME`, `MD_TRANSCLUDE_HEIGHT_NAME` — numeric text
  inputs with `parseInt`/`NaN` validation, an early return that leaves the
  input unchanged (and unpersisted) on invalid input, and a different
  fallback default per field on an empty string. A genuinely different
  control shape (validated numeric text) than `TextControl`/`sanitize`
  (a pure string-to-string transform) models; not worth a new control type
  for 4 settings.
- The AI section's `addNumberSetting` closure — takes arbitrary
  getter/setter functions rather than a fixed `ExcalidrawSettings` key,
  used for token-limit fields with custom validation; structurally
  incompatible with `TextControl.key: StringSettingKey`.
- `STARTUP_SCRIPT_NAME` — one `Setting` row chains both `.addText()` and
  `.addButton()` (path input + an "Open"/"Create" button whose label the
  text input's `onChange` updates). Same category as `GRID_DIRECTION_NAME`
  above: `SettingDefinition` assumes one control per row, and this row has
  a real cross-control dependency within itself.
- The two dynamic per-installed-script text closures (`addStringSetting`'s
  array/plain branches) in Compatibility — same reasoning as the dynamic
  script toggle above.

**Deliberately left as legacy imperative code (dropdown type), each because
it doesn't fit the current `control` shape cleanly:**

- `LIBRARY_STORAGE_NAME` — its `onChange` early-returns on no-op selection,
  branches into async migration prompts, and in one branch assigns a fixed
  `"vault"` rather than the selected value; ends with a full `this.display()`
  re-render (one of only two such calls in the whole file). Doesn't fit the
  "always assign the selected value" model at all.
- The AI provider/model dropdown (inside the dynamic `renderAISettings`
  closure) — options are built from a runtime list, and the row also
  chains `.addExtraButton()`; same dynamic/multi-control reasoning as the
  AI text-model closures already excluded from toggle/text.
- `EMBED_TYPE_NAME` — this is the dropdown `EXPORT_SVG_NAME`/
  `EXPORT_PNG_NAME` (excluded from the toggle pass) mutate: its own options
  are conditionally built from `autoexportPNG`/`autoexportSVG`, it
  self-corrects `embedType` back to `"excalidraw"` if the previously
  selected option becomes unavailable, and its `onChange` shows/hides
  `embedComment`'s row. A cross-control cluster, not a single setting.
- The dynamic per-installed-script dropdown closure in Compatibility —
  same reasoning as the other dynamic script content.

**Deliberately left as legacy imperative code (slider type), each because
it doesn't fit the current `control` shape cleanly:**

- `GRID_OPACITY_NAME` (`gridSettings.OPACITY`), `LASER_DECAY_TIME_NAME`
  (`laserSettings.DECAY_TIME`), `LASER_DECAY_LENGTH_NAME`
  (`laserSettings.DECAY_LENGTH`) — nested fields, not a flat
  `NumberSettingKey`. Same reasoning as `GRID_DYNAMIC_COLOR_NAME` from the
  toggle pass.

**All four control types (toggle/text/dropdown/slider) are now fully
converted.** What remains before this data structure could feed Obsidian's
real `getSettingDefinitions()`:

1. **`render` support in `buildSetting()`** — every exception listed across
   the four sections above (roughly 20 settings) is a `render` candidate:
   custom components (`HotkeyEditor`, `FontPickerComponent`,
   `VaultPathSuggest`-only cases, `PDFExportSettingsComponent`,
   `ModifierKeySettingsComponent`, `UIModeSettingsComponent`), multi-control
   rows (`GRID_DIRECTION_NAME`, `STARTUP_SCRIPT_NAME`), nested/nonflat
   fields (`gridSettings`/`laserSettings` members), cross-control clusters
   (`EMBED_TYPE_NAME` + the SVG/PNG export toggles, `TASKBONE_ENABLE_NAME`'s
   captured text component), branching/early-return logic
   (`LIBRARY_STORAGE_NAME`), and the fully dynamic AI provider/model and
   per-installed-script content.
2. **The `visible`/`registerVisibilityGate`/`refreshVisibilityGates`
   mechanism** (designed but never implemented — see the investigation
   findings near the top of this section) for the 6 existing show/hide
   relationships, most of which are now `control` entries reaching into a
   still-legacy sibling (`embedComment`, `aiEl`, `gridColorSection`).
3. Only after both of those does actually wiring up
   `getSettingDefinitions()` (behind Path B — keep `display()` for pre-1.13
   users) become the natural next step, and only once `minAppVersion` is a
   decision the user is ready to make.

Each remains its own small, separately-committed step per the same
full-type-closeout-before-commit, review-before-commit discipline used for
all four control types above.

## Related, separate effort: no-unsafe-* lint cleanup — parked 2026-08-13

Started while looking for the next refactoring target after the settings.ts
work above. Independent of both plans on this page; not blocked by them and
doesn't block them.

**Context:** a survey across the codebase found it already disciplined about
the usual cruft — only 2 explicit `any` annotations and 0 `as any` casts in
all of `src/`, `npm run code:unused` (the project's own dead-code check)
found nothing, and only 3 TODO/FIXME markers exist. The one real remaining
backlog is 470 `@typescript-eslint/no-unsafe-*` findings (was 514 before the
fix below), concentrated in `ExcalidrawView.ts` (145), `ExcalidrawData.ts`
(64, was 108), `ExcalidrawAutomate.ts` (77), and `AIUtils.ts` (42).

**Risk policy for this effort:** the general rule for *all* `any`-replacement
work in this repo — not restated here, read it there — is `AGENTS.md`'s
"CRITICAL: Behavioral Change Detection When Replacing `any`" section. It
covers falsy/truthy checks, existence checks, and optional-chaining
fallbacks changing meaning once a real type replaces `any`, with a mandatory
pre-change verification checklist. Every fix logged below was screened
against that checklist before being applied.

**Done:** fixed `ExcalidrawData.ts`'s cluster at its root cause. Traced it to
8 `let parts;` / `let res;` declarations with no initializer and no type
annotation (`getDecompressedScene`, `getJSON`, the text-element/element-link
parsing loop, and both `quickParse`/`hasTransclusion` link-parsing loops) —
each later assigned via `someIterator.next()`. With no annotation and no
initializer, TypeScript infers these as implicit `any` forever, cascading
into every downstream `.value`/`.length`/`.index` access. The correct type,
`RegExpMatchIteratorResult = IteratorResult<RegExpMatchArray, undefined>`,
already existed in the same file (line 102) and was already used correctly
by half a dozen other methods (`REGEX_TAGS`/`REGEX_LINK`'s `getResList`,
`getTag`, `getLink`, etc.) — and was already *implied* by the exact
functions these bare variables got passed into. Applying it to the 8
un-annotated declarations was a pure type-annotation change (8 one-line
edits, nothing else touched) — TypeScript was just made aware of a type the
code was already behaving as. Reduced `ExcalidrawData.ts` from 108 to 64
findings (44 fewer, matched exactly by the whole-codebase count dropping
514 → 470). `npm run build`, `tsc --noEmit`, and `node --check dist/main.js`
all passed; the existing 33-warning circular-dependency baseline is
unchanged. Committed (`c78cfcc1`).

**Investigated and deliberately not pursued: `AIUtils.ts`'s cluster (42
findings).** This is a *qualitatively different* kind of `any`, not a
same-shape follow-up to the fix above:

- The root is Obsidian's own `RequestUrlResponse.json: any`
  (`node_modules/obsidian/obsidian.d.ts:3585`) — a genuine external
  boundary (arbitrary third-party HTTP JSON), not a local missing
  annotation. Any type added here is an *assumption* about what
  OpenAI/Anthropic/Google/xAI/OpenAI-compatible providers return, not a
  fact already provable from existing code the way `RegExpMatchIteratorResult`
  was.
  - The largest sub-cluster, `buildGenerateAIImageResult` (~35 of the 42
  findings), parses `json.data` behind an `Array.isArray(json?.data)`
  runtime guard — i.e. a runtime check is already standing in for a type.
  Adding a fixed interface wouldn't break that guard, but it creates
  exactly the risk flagged as a hard constraint for this codebase: future
  edits could be tempted to skip the guard because "the type says it's
  there."
  - `response.json.error` is directly **mutated** in one spot (line ~2065,
  `response.json.error.imageRequest = {...}`) — a plugin-specific field no
  provider ever sends. A correct interface has to account for that, which
  turns this into real interface-design work across 5 provider shapes, not
  a mechanical fix.
- Conclusion: doesn't meet the same low-risk bar. Left entirely untouched.

**Done (2026-08-14): fixed the `ExcalidrawDataScene.elements`/`appState`
intersection-collapse root cause.** Triaged the remaining 64 findings across
`ExcalidrawData.ts` (63) and the newly-extracted `EmbeddedDataRegistries.ts`
(1) into three buckets before touching anything:

1. **A real bug, not a typing artifact.** `EmbeddedDataRegistries.getFiles()`
   did `Object.values(this.host.files)` where `files` is a `Map`.
   `Object.values()` on a `Map` instance always returns `[]` (verified with
   a plain Node check — this is standard JS, not a TS quirk: a `Map`'s data
   lives in internal slots, not enumerable own properties). The only real
   caller, `ViewSceneFileManager.ts`'s stale-image retry loop ("in case one
   or more files have not loaded retry later"), has therefore likely never
   actually retried anything since it was written. Fixed with
   `Array.from(this.host.files.values())` — a genuine, intentional runtime
   behavior change (the point of the fix), not a type-only edit. Searched
   every `Map`-typed field in `src/` (`files`/`filesMaster`/`equations`/
   `equationsMaster`/`markdownImages`/`markdownImagesMaster`/`mermaids`/
   `mermaidsMaster`/`elementLinks`/`buttons`/`colorsCache`/`packageMap`/
   `pageDimensionsByPage`/`pdfDocsMap`) against every `Object.keys/values/
   entries` call site in the codebase — this was the only instance of the
   pattern; every other `files`-named argument passed to `Object.values`
   elsewhere is genuinely `BinaryFiles` (Excalidraw's own `Record` type),
   confirmed per call site, not a `Map`.
2. **One dominant root cause behind most of the rest — type-definition-only,
   no runtime behavior change.** `ExcalidrawDataScene` was declared as
   `SceneDataWithFiles & { elements: Mutable<ExcalidrawElement>[]; appState:
   ...; ... }`. `SceneDataWithFiles` (via the upstream `SceneData` type)
   *already* declares `elements` and `appState`. TypeScript doesn't let the
   second declaration override the first inside an intersection — it
   intersects both property types. Verified empirically with a throwaway
   `@ts-expect-error`-shaped probe (added and reverted): the real type of
   `this.scene.elements` was `readonly ExcalidrawElement[] & Mutable<ExcalidrawElement>[]`.
   Calling `.filter()`/similar directly on that (no `?.`, no trailing `as`)
   made TypeScript's overload resolution collapse the call to `any`,
   cascading into every downstream property access. Fixed by wrapping the
   base type in `Omit<SceneDataWithFiles, "elements" | "appState">` so the
   local, stricter declarations actually replace instead of intersect.
   Sampled `ExcalidrawView.ts`/`ExcalidrawAutomate.ts` beforehand and found
   only one non-`.filter()` touch point (`excalidrawData.scene.elements.length`),
   so the blast radius looked contained to `ExcalidrawData.ts` itself before
   attempting the fix — confirmed after the fact via a clean `npm run build`
   (zero new hard type errors anywhere in the dependency graph) plus a
   `git stash`/`pop` full-repo ESLint diff showing zero new findings in any
   file. Two genuine (and expected) knock-on compile errors surfaced in
   `ExcalidrawData.ts` itself — `updateTextElementsFromScene()` and
   `generateMDBase()` both filter `scene.elements` down to elements assumed
   (by the surrounding logic, not the type) to always be text elements, then
   read `.rawText`/`.originalText`/`.text`, which don't exist on the general
   `ExcalidrawElement` union. These were previously invisible because the
   filter result was silently `any`; fixed with the same
   `as Mutable<ExcalidrawTextElement>[]` cast idiom the file already uses in
   `updateSceneTextElements()` and `syncFiles()` for the identical situation
   — no behavior change, just making the existing runtime assumption
   type-visible. Also removed one `as Mutable<ExcalidrawElement>[]` cast in
   `loadData()` that the fix made genuinely redundant
   (`no-unnecessary-type-assertion`).
3. **Genuine external boundary — confirmed, left untouched.**
   `fileCache.frontmatter[key]` accesses (`getOnLoadScript`/`setLinkPrefix`/
   `setUrlPrefix`/`setAutoexportPreferences`/`setembeddableThemePreference`/
   `getLinkOpacity`, ~13 findings) and `JSON.parse(data)` in
   `loadLegacyData()` (1 finding). Obsidian's own published type is
   `FrontMatterCache { [key: string]: any }` — arbitrary user-authored YAML;
   same category as the `AIUtils.ts` cluster already declined above.

**Outcome:** `ExcalidrawData.ts` findings dropped from 63 to 17;
`EmbeddedDataRegistries.ts` from 1 to 0. The type-definition fix also had
beneficial ripple effects with zero negative side effects, confirmed via a
`git stash`/`pop` per-file ESLint diff: `excalidrawAutomateUtils.ts` dropped
21 → 12 and `ExcalidrawView.ts` dropped 145 → 144, both previously relying
on the same `any` leak through call sites this session didn't touch
directly. Whole-repo count: 470 → 413 (57 fewer), matching the sum of all
per-file deltas exactly — confirming zero new findings anywhere. `npm run
build`, `npm run lib`, `node --check dist/main.js`, and `git diff --check`
all passed; the 33-warning circular-dependency baseline is unchanged;
`dist/main.js` is 4,716,860 bytes (6 bytes above the structural-extraction
checkpoint, noise). Manual testing pending, prioritizing the two intentional
behavior changes: the stale-image retry loop (open a drawing with an image
still mid-sync and confirm it eventually loads without a manual reopen) and
general text-element/link/back-of-card parsing sanity (the two
`as Mutable<ExcalidrawTextElement>[]` sites).

**Correction:** an earlier note in this log mislabeled
`src/utils/excalidrawAutomateUtils.ts` (which benefited from the
`ExcalidrawDataScene` fix, 21 → 12) as `src/shared/ExcalidrawAutomate.ts`
(a different, similarly-named file that was untouched and still has ~79
findings). Accurate counts as of this correction: `ExcalidrawView.ts` 144,
`ExcalidrawAutomate.ts` 79 (unchanged), `AIUtils.ts` 46 (declined, drifted
slightly from 42), `ExcalidrawData.ts` 17, `excalidrawAutomateUtils.ts` 12.

**Done (2026-08-14, session 2): triaged `excalidrawAutomateUtils.ts`'s
remaining 12 findings, fixed one, and surfaced a much bigger separate
issue.**

1. **Fixed:** `getTextElementsMatchingQueryFromString()`'s
   `let parts;` (no annotation, assigned via `res.next()` where
   `res = text.matchAll(...)`) — the exact same un-annotated-iterator-result
   shape as the original `RegExpMatchIteratorResult` fix in `ExcalidrawData.ts`.
   Annotated it `IteratorResult<RegExpMatchArray, undefined>` inline (this
   file doesn't import the private alias of the same name from
   `ExcalidrawData.ts`). Fixed 2 of the 12 findings, confirmed zero new
   findings anywhere via a `git stash`/`pop` full-repo ESLint diff (413 → 411).
2. **Left alone, confirmed genuine boundary:** `el.customData?.text2Path?.text`
   (2 findings) — `customData?: Record<string, any>` is Excalidraw's own
   intentional extensible-metadata mechanism, documented in this repo's own
   `AGENTS.md` ("Custom Element Metadata"). Not a bug, same category as the
   `frontmatter`/`AIUtils.ts` cases already declined.
3. **Flagged, NOT fixed — a new, much bigger, separate structural issue.**
   The remaining 8 findings (`getTemplate()`'s `excalidrawData.scene.files[f.id]`
   computed assignment; `Object.values(scene.files).filter((f: BinaryFileData)
   => fileIDWhiteList.has(f.id))`; three separate `template?.appState?.theme`
   sites in `createPNG()`/`createSVG()`; one `newElement.link = link` in
   `updateElementLinksToObsidianLinks()`) all trace to the same root cause,
   confirmed empirically with the same throwaway-probe technique used for the
   `ExcalidrawDataScene` fix (added and reverted each time): `BinaryFileData["id"]`
   and `AppState["theme"]` (and by extension pieces of `ExcalidrawElement`)
   resolve to `any`/`error`, even though the standalone types they're built
   from (`FileId`, `Theme`) resolve cleanly on their own. Traced to
   `@zsviczian/excalidraw`'s own bundled `.d.ts` files
   (`element/src/types.d.ts` etc.) containing bare-specifier imports like
   `import type {...} from "@excalidraw/common"` and
   `import type {...} from "@excalidraw/common/utility-types"` — a package
   this plugin's `package.json` never depends on and that isn't in
   `package-lock.json`. This looks like an artifact of the upstream
   Excalidraw monorepo's `packages/common` workspace split leaking into the
   fork's published type declarations without the dependency being declared.
   Two things ruled this out as a quick fix, both tested and reverted:
   - Installing `@excalidraw/common@0.18.0-f0063e113` (npm's `latest` dist-tag)
     with `--no-save` did **not** fix any of the 8 findings — simple package
     presence isn't sufficient.
   - This project's `tsconfig.json` uses `"moduleResolution": "node"`
     (classic/legacy resolution), which does not consult `package.json`
     `exports` maps for **subpath** imports at all (only unscoped/bare
     imports use the top-level `types` field) — `@excalidraw/common/utility-types`
     specifically cannot resolve under this setting regardless of what's
     installed. Testing `"moduleResolution": "bundler"` (which does support
     `exports` subpaths) did fix this pattern, but broke hundreds of other,
     previously-clean type checks elsewhere in the project — global
     resolution-mode changes are not a safe or scoped fix.
   - Also discovered while testing: merely having `@excalidraw/common`
     physically present under `node_modules/@excalidraw/` (even completely
     unreferenced by `package.json`/`package-lock.json`) changed
     `src/utils/excalidrawViewUtils.ts`'s type resolution enough to produce a
     **new real compile error** (`ColorPaletteCustom` not assignable to
     `string | string[]`) that disappeared the moment the untracked package
     was removed. This means even the "just add the dependency" option needs
     careful, isolated verification before being treated as safe — it is not
     guaranteed side-effect-free.
   - This is very likely the dominant root cause behind large portions of
     the still-untriaged `ExcalidrawView.ts` (144) and `ExcalidrawAutomate.ts`
     (79) clusters too, given how much of `ExcalidrawElement`/`AppState`
     transitively depends on the same upstream types. Needs its own dedicated
     investigation (candidates: a scoped `tsconfig` `paths` remapping instead
     of a global `moduleResolution` change; fixing the dts generation in the
     sibling `zsviczian/excalidraw` fork repo per the two-repository
     workflow; or a local ambient `.d.ts` shim) rather than being bundled
     into routine lint-cleanup work.

`npm run build`, `npm run lib`, `node --check dist/main.js`, and
`git diff --check` all passed for the one applied fix; the 33-warning
circular-dependency baseline is unchanged; `dist/main.js` is 4,716,860 bytes
(unchanged from the previous checkpoint, as expected for a single local type
annotation). `excalidrawAutomateUtils.ts`: 12 → 10 findings (2 genuine
boundary, 8 flagged under the `@excalidraw/common` issue above). Manual
testing pending for the one behavior-adjacent area touched (search-by-quoted-
text element selection, `getTextElementsMatchingQueryFromString()` — though
this was a pure type-annotation change with no logic touched).

**Closed the 2026-08-14 (session 1) validation checkpoint:** user confirmed
both targeted manual tests — the stale-image retry loop and general text-
element/link/back-of-card parsing — succeeded with no issues; committed.

## Related, separate effort: `@excalidraw/common` type-resolution fix

Started 2026-08-14 (session 3), on branch `excalidraw-type-import-fix`.
Directly grew out of the `excalidrawAutomateUtils.ts` triage above, whose
"flagged, needs its own investigation" finding turned out to be the single
largest lint win of the whole `no-unsafe-*` effort by a wide margin.

**Root cause (confirmed against both this repo and upstream, no fork changes
needed):** `@zsviczian/excalidraw`'s bundled `.d.ts` files import bare-specifier
`@excalidraw/common`, `@excalidraw/common/utility-types`, `@excalidraw/element`,
`@excalidraw/math`, `@excalidraw/utils`, and self-referencing `@excalidraw/excalidraw/*`
— packages this plugin's `package.json` never lists as dependencies. Confirmed
this is not fork-specific: the same gap exists in upstream's own published
`@excalidraw/excalidraw@0.18.1` (`npm view @excalidraw/excalidraw dependencies`
lists neither `@excalidraw/common` nor `@excalidraw/element`/`math`/`utils`
either, and its own shipped `.d.ts` files contain the identical bare imports).
It's an inherent characteristic of how the Excalidraw monorepo publishes
per-package types, not a bug introduced by the fork. Every value that
transitively touched one of those unresolvable imports (`Theme`,
`BinaryFileData["id"]`, most of `AppState`, large parts of the
`ExcalidrawElement` union) silently collapsed to `any`, which is what the
`no-unsafe-*` backlog had actually been measuring all along.

**The fix, and how it evolved (read this before touching it again):**

1. First attempt: added `@excalidraw/element@0.18.0-f0063e113` (npm's
   `latest` tag) as a `devDependency` and mapped all four `@excalidraw/*`
   specifiers to it via `tsconfig.json` `paths`. This worked for simple
   leaf types (`Theme`, `FileId`) but **introduced genuine false-positive
   type errors** for complex types: the externally-installed package's own
   `ExcalidrawElement` (e.g. `ExcalidrawArrowElement.lastCommittedPoint:
   LocalPoint | null`) structurally disagreed with `@zsviczian/excalidraw`'s
   own bundled `ExcalidrawElement` (no such optional field) — two
   same-named-but-different types competing, caught via
   `InsertPDFModal.ts`'s `selectElements()`/`zoomToFit()` calls suddenly
   failing with a real structural mismatch that hadn't existed before.
   **Reverted** (`npm uninstall @excalidraw/element`) once this was
   understood — an independently-versioned external package is fundamentally
   the wrong source of truth here, no matter which version is pinned.
2. **Correct fix:** `node_modules/@zsviczian/excalidraw/types/` already
   vendors its own exact-match copies of `common/`, `element/`, `math/`,
   `utils/`, and `excalidraw/` (it has to, to be self-contained) — so
   `tsconfig.json` `paths` redirects `@excalidraw/common|element|math|utils`
   (bare and `/*` subpaths) straight into that same already-installed
   package's own `types/` tree instead of an external one. Zero version-drift
   risk by construction (literally the same files), and **no new
   dependency at all** — `package.json` ended up completely untouched.
   Also explains why the first attempt's `devDependency` alone (before
   the `paths` redirect existed) did nothing: this project's
   `"moduleResolution": "node"` (classic/legacy) never consults
   `package.json` `exports` maps for **subpath** imports at all, only
   bare ones via the top-level `types` field — `@excalidraw/common/utility-types`
   could not have resolved through package installation alone regardless
   of version. A global `"moduleResolution": "bundler"` switch (which does
   support subpath `exports`) was tested and immediately reverted: it fixed
   this pattern but broke hundreds of other, previously-clean type checks
   elsewhere in the project — `paths` remapping is the correctly scoped
   tool here, a global resolution-mode change is not.

**Fallout, fixed file by file, small-to-large, each verified with a fresh
`npm run build` before moving on:** turning the fix on project-wide surfaced
117 real, previously-masked compile errors across 18 files (the same
narrowing-gap shape as the two `ExcalidrawData.ts`
`as Mutable<ExcalidrawTextElement>[]` fixes in the prior session, now at
project scale). Fixed via the same idioms throughout — casting to the
narrower literal/branded type at the exact site where the code already
behaved as if it had that type (`as Theme` / `as "dark" | "light"` for
theme strings, `as FileId` for branded IDs, `as NonDeletedExcalidrawElement`
/ `as unknown as NonDeletedExcalidrawElement` for the `isDeleted: boolean`
vs `isDeleted: false` narrowing gap, matching the user's explicit "readonly
complaints are deliberate, fix as mutable" guidance generalized to this
whole family of narrowing gaps), or widening an explicit type annotation at
a `let`/`const` declaration when the array was later reassigned to a
narrower produced type. Files fully cleared: `LaTeX.ts`, `dynamicStyling.ts`,
`screenshot.ts`, `ExcalidrawData.ts`, `excalidrawAutomateUtils.ts`,
`ExcalidrawAutomate.ts`, `ExcalidrawRoot.ts`, `InsertPDFModal.ts`,
`ExcalidrawView.ts`, `ViewExcalidrawExtensionRenderer.ts`,
`ViewExportManager.ts`, `ObsidianMenu.tsx`, `EmbeddableActionsMenu.tsx`,
`CustomEmbeddable.tsx`. A final `eslint --fix` pass (scoped — confirmed
beforehand that every "potentially fixable" finding at that point was
`no-unnecessary-type-assertion`, i.e. removing a now-redundant cast this
same fix made unnecessary, never a behavior-changing rule) mechanically
cleaned up a further cascade of now-redundant `as X`/`as unknown as X`
casts across files this session hadn't touched directly (`DropManager.ts`,
`EmbeddedFileLoader.ts`, `ExportDialog.ts`), each confirmed zero-risk by
definition (an assertion ESLint proved changes nothing about the expression's
type cannot change its runtime value either). One resulting unused import
(`ExtendedFillStyle` in `ObsidianMenu.tsx`, superseded by the real `FillStyle`
cast) was removed by hand.

**Two real bugs found and fixed along the way (not type-only — flagged and
confirmed before fixing, per the user's explicit instruction):**

- `ExcalidrawView.ts`'s `addFiles()`: `isDark = s.scene.appState.theme;`
  assigned the literal string `"light"`/`"dark"` directly to a `boolean`
  parameter. Proof this was live and wrong, not just a type nag: three lines
  later the code did `isDark: !!isDark` — `!!` on any non-empty string is
  always `true`, so every call through this fallback path (whenever the
  caller didn't pass `isDark` explicitly) had unconditionally treated the
  scene as dark-themed regardless of the actual theme, since the very first
  version of this code. User caught this by inspection and supplied the
  fix directly; applied as `isDark = s.scene.appState.theme === "dark"`,
  matching the already-correct sibling usage at the same file's line ~4088
  (`isDark: st.theme === "dark"`).
- `ExcalidrawView.ts`'s `getSelectedTextElement()`: the "selected element is
  part of a group containing a text element" branch returned
  `{id: selectedElement[0].id, text: (selectedElement[0] as
  ExcalidrawTextElement).text}` — casting the *originally selected* element
  (proven only to be grouped with a text element, never proven to be text
  itself) instead of `textElement[0]`, the group's actual text element the
  same branch had just found two lines above via `.filter(type === "text")`
  and then never used. Silently wrong whenever the selected element itself
  wasn't literally text (e.g. a shape grouped with a caption): `.text` would
  read `undefined` off a non-text element at runtime, previously invisible
  because the cast was `any`-permissive. The sibling "bound text elements"
  branch immediately above already does this correctly (`id`/`text` both
  from its own found `textElement[0]`). Asked the user whether `id` should
  also switch to `textElement[0].id` (this method is exposed via the public
  `ExcalidrawAutomate` scripting API, so changing which `id` a script
  receives needed explicit confirmation, not an assumption) — confirmed yes;
  both `id` and `text` now come from `textElement[0]`, matching the sibling
  branch exactly.

**One found, initially flagged as a suspected logic bug — corrected by the
user, then fixed as type-only after all.** `excalidrawViewUtils.ts`'s
`getViewColorPalette()`: `AppState["colorPalette"][palette]`'s *declared*
type is `ColorPaletteCustom = {[key: string]: ColorTuple | string}` (a
config-shaped record), which made the function's `Array.isArray(basePalette)`
check look like dead code guarding a shape the value could never have. Wrong
— the user tested it directly and confirmed `getViewColorPalette()` already
returns correct values, then pointed at the authoritative fork-side type
(`packages/excalidraw/types.ts`, marked `//zsviczian`) to settle it. The real
runtime shape is a flat list of single colors and/or grouped 5-color tuples,
not a record — confirmed independently by the function's own pre-existing
`flattenPalette()` helper a few lines below, whose parameter was *already*
explicitly typed `readonly (string | string[])[]`. So `ColorPaletteCustom`
describes the record-shaped *settings/config* input, but the fork
transforms it into this flat list by the time it lands in `AppState` — a
type-declaration imprecision in the fork's own upstream-facing type, not a
logic bug in the plugin. Fixed as a documented bridge cast at the one read
site (`as unknown as string | readonly (string | string[])[]`, matching the
shape `flattenPalette()` already assumed) plus one follow-on cast the first
one's `Array.isArray` narrowing didn't propagate through
(`readonly (string|string[])[]`'s negative-array branch doesn't narrow
cleanly to `string` in this TS version — cast directly instead of relying on
control-flow narrowing). Zero logic touched; build now fully clean.

**Outcome:** `npm run build`, `npm run lib`, `node --check dist/main.js` all
pass (exit 0) with **zero remaining diagnostics** — every one of the
originally-surfaced 117 build errors is now fixed; the 33-warning
circular-dependency baseline is unchanged;
`dist/main.js` is 4,716,853 bytes, effectively unchanged (this was
exclusively a `tsconfig.json`/source type-annotation effort, nothing
touched the runtime bundle). Confirmed via a `git stash -u`/`pop` full-repo
ESLint diff against the pre-session-3 commit (`b7472cb8`): **411 → 229
findings (182 fewer, 44%), with zero files regressing** — every file with a
changed count went down, none went up. `ExcalidrawView.ts` alone dropped
144 → 18 (87%). Several files neither this session nor the prior one
touched directly also improved as pure beneficiaries of the project-wide
type-resolution fix: `CropImage.ts`, `InsertImageDialog.ts`, `carveout.ts`,
and `utils.ts`. `ExcalidrawRoot.ts`, `getElementAtPointer.ts`,
`screenshot.ts`, and `carveout.ts` are now fully clean (0 findings).
`ExcalidrawAutomate.ts` (still the largest remaining cluster at 57, down
from 79) and `excalidrawViewUtils.ts` (20, down from 23) have not been
individually re-triaged since this fix landed — worth a fresh look before
assuming their remaining findings are all external-boundary cases, since
this session found real bugs by just reading the surfaced errors in
context. Manual testing pending, prioritizing the two real bug fixes above
(dark/light theme detection when embedding freshly-pasted images/PDFs
without an explicit theme argument; selecting a non-text element that's
grouped with a text element, e.g. via a script calling
`getSelectedTextElement`/its public API surface) over the purely type-level
changes elsewhere, including `getViewColorPalette()` since its logic itself
was already confirmed correct and unchanged.

**Done (2026-08-14, session 4): `ExcalidrawAutomate.ts` fully triaged, 57 → 0.**
On `master` (the `excalidraw-type-import-fix` PR was merged as #2892 in the
interim; `master` is now at `2.27.0-beta.2`). Same methodology, three
clusters:

1. **Safe, fixed (49 of 57).** `cloneElement()`/`cloneElements()`'s inner
   map both do `JSON.parse(JSON.stringify(el))` to deep-clone an already-known
   `ExcalidrawElement` — cast to `Mutable<ExcalidrawElement>` (`cloneElement`)
   and a small local `ClonedElementDraft = Mutable<ExcalidrawElement> &
   {containerId?; startBinding?; endBinding?}` (`cloneElements`, since the
   remap logic generically probes text/arrow-only relationship fields across
   whatever element variant it receives — matches the union's actual base
   fields plus the two Excalidraw-typed cross-cutting ones, not an invented
   shape). One follow-on: `newEl.boundElements.map((bound: {id: string; type:
   string}) => ...)` had a same-shape-but-looser-than-necessary inline
   annotation; swapped for the real imported `BoundElement` type. Also a
   `new Promise((resolve) => ...)` with no generic, resolved with `string |
   null` in different branches — TS had defaulted the whole chain to
   `unknown`; added the explicit `Promise<string | null>`.
2. **Initially suppressed as external-boundary (8), then genuinely fixed
   once the actual sources became available — 0 suppressions remain.** Two
   distinct sources, both traced to their exact origin before touching
   anything: `addMermaid()`'s `result.files` traced to the upstream
   `mermaidToExcalidraw()` function's own declared return type (`{
   elements?: ExcalidrawElement[]; files?: any; error?: string } | undefined`
   in `@zsviczian/excalidraw`'s `MermaidToExcalidrawLib.d.ts`) — `files?:
   any` was the *library's own* declared type, not something the earlier
   `@excalidraw/common` fix masked or could improve from this side. First
   pass suppressed both with `eslint-disable-next-line` plus a one-line
   justification per site, matching this repo's documented suppression
   format. The user then fixed it at the actual source: updated
   `mermaidToExcalidraw`'s declaration in the fork
   (`packages/excalidraw/components/TTDDialog/MermaidToExcalidrawLib.ts`)
   to `files?: BinaryFiles`, rebuilt, and refreshed this repo's installed
   `node_modules` copy — both suppressions simply deleted, no cast needed,
   the value is now genuinely typed. For `cloneElements()`'s
   `JSON.parse(elementsOrClipboard)`, the user pointed at the authoritative
   source instead of accepting the suppression: `actionCopy`/
   `serializeAsClipboardJSON()` in the fork's own
   `packages/excalidraw/clipboard.ts` show the real envelope Excalidraw's
   own copy action produces (`{type: "excalidraw/clipboard", elements,
   files}`, `EXPORT_DATA_TYPES.excalidrawClipboard === "excalidraw/clipboard"`
   confirmed against `packages/common/src/constants.ts`, matching the
   plugin's own runtime check exactly). Replaced the suppressions with a real
   union type (`{type: string; elements: ExcalidrawElement[]} |
   ExcalidrawElement[]`, the second arm being this method's own added
   convenience for a bare JSON-stringified array, not an Excalidraw-produced
   format) and one added `!Array.isArray(parsed)` guard ahead of the
   `.type` check purely to let the union narrow before that property access
   — logically a no-op versus the original runtime behavior, since a bare
   array was already implicitly guaranteed to fail the `.type ===
   "excalidraw/clipboard"` comparison (arrays have no `.type`).

`npm run build`/`npm run lib`/`node --check dist/main.js` all pass clean
with **zero `eslint-disable` suppressions anywhere in this file**;
33-warning circular-dependency baseline unchanged; `dist/main.js` is
4,716,872 bytes (+19 bytes from the prior checkpoint, from the fork's own
rebuild — this repo's change is compile-time only). Confirmed via
`git stash`/pop full-repo ESLint diff: 229 → 172 (57 fewer), zero
regressions, the entire delta contained to this one file. Committed
(`efb00d1d`) on branch `excalidraw-automate-cleanup`, pushed; PR not yet
opened (`gh` unavailable in this environment — no token/CLI to author it
directly, link and prepared title/body handed to the user instead).

**Done (2026-08-14, session 5): `excalidrawViewUtils.ts` fully triaged,
20 → 0.** On branch `excalidraw-automate-cleanup` (continued rather than
starting a new branch). Two clusters:

1. **The exact `RegExpMatchIteratorResult`-shaped bug again (16 of 20).**
   `isTextImageTransclusion()`'s `const match = text.trim().matchAll(...).next();`
   — a bare `let`/`const` with no annotation, assigned via `.next()` on a
   `matchAll()` iterator, collapsing to implicit `any` and cascading through
   16 downstream accesses. Same exact shape as the very first fix in this
   whole `no-unsafe-*` effort (`ExcalidrawData.ts`, session predating this
   page's start) — annotated `IteratorResult<RegExpMatchArray, undefined>`.
   The plan's own "if resumed" note several sections up predicted exactly
   this: "look for more `ExcalidrawData.ts`-shaped cases... a local variable
   whose real type is already known... just missing on one declaration."
2. **`Function.prototype.bind()` degrading a real signature to `any` (4).**
   `getViewColorPalette()`'s `cmFactory = view.hookServer?.getCM?.bind(...) ??
   view.plugin.ea.getCM.bind(...)`. Probed each side independently
   (throwaway type-probes, added and reverted): `view.hookServer?.getCM` and
   `view.plugin.ea.getCM` both resolve cleanly to their real declared
   signature, `(color: TInput) => ColorMaster` — the `any` is introduced
   exclusively by `.bind()`'s own type declaration failing to preserve it.
   A plain variable type annotation on `cmFactory` satisfied `tsc` but
   *not* `eslint`'s `no-unsafe-assignment` (which still flags assigning a
   provably-`any`-typed expression regardless of the target annotation);
   switched to an explicit `as (color: TInput) => ColorMaster` cast instead,
   which both tools accept. Imported the real `TInput`/`ColorMaster` types
   from `@zsviczian/colormaster` — the file's own pre-existing local
   `ColorMasterLike` structural type and `isColorMasterLike()` guard (used
   for everything *after* the `cmFactory(...)` call) were left untouched,
   since only the call signature itself needed fixing.

`npm run build`/`npm run lib`/`node --check dist/main.js` all pass clean;
33-warning circular-dependency baseline and `dist/main.js` byte size both
unchanged (4,716,872 bytes — compile-time only). Confirmed via `git
stash`/pop full-repo ESLint diff: 172 → 152 (20 fewer), zero regressions,
entire delta contained to this one file.

**If resumed:** `AIUtils.ts` (46, previously declined as external-boundary)
is the natural next target — worth confirming that conclusion still holds
given how many things in this effort turned out to have a real fix hiding
behind what first looked like a boundary, rather than assuming. After that,
a final full-repo sweep once the remaining clusters are gone. Realistic
floor is still not 0 — `AIUtils.ts`'s provider-JSON boundary and Obsidian's
own `FrontMatterCache: {[key: string]: any}` remain genuine, unavoidable
external boundaries by their own nature, not by insufficient effort.

## Related, separate effort: `ExcalidrawData.ts` structural extraction

Started 2026-08-14. Independent of the other work on this page; not blocked
by the parked `ExcalidrawView`/`main.ts` plan and doesn't block it. Motivated
by the same "split large files" guidance in `AGENTS.md` already applied to
`main.ts` and `ExcalidrawView.ts`, applied here to `ExcalidrawData.ts`
(2,845 lines). Two mechanical, same-sitting extractions, both validated by
build before moving to the next.

**1. Extracted Markdown/frontmatter parsing to `excalidrawMarkdownParsing.ts`.**
Moved the module-level (non-class) functions and their private helpers intact:
`changeThemeOfExcalidrawMD`, `getJSON`, `getMarkdownDrawingSection(Async)`,
`parseMarkdownImages`, `unwrapMarkdownImageBlock`, `syncMarkdownImagesInHeader`,
`getExcalidrawMarkdownHeader`, `getExcalidrawMarkdownHeaderSection`, plus their
supporting regexes and private helpers (`isCompressedMD`, `getDecompressedScene`,
`getMarkdownImageBlocks`, `serializeMarkdownImageBlock`, the `RE_*` section-
boundary regexes). `ExcalidrawData.ts` re-imports the four of these its own
class methods still call (`getJSON`, `getMarkdownDrawingSection(Async)`,
`parseMarkdownImages`) and re-exports all ten previously-exported names so
every existing external import path (`FileManager.ts`, `ExcalidrawAutomate.ts`,
`ExcalidrawView.ts`, `MarkdownImageController.ts`, `excalidrawViewUtils.ts`,
`excalidrawAutomateUtils.ts`) keeps working unchanged. One planning miss
caught by the build, not by the initial call-site trace: four of the
section-boundary regexes (`RE_EXCALIDRAWDATA_NOSECTION_OK`,
`RE_EXCALIDRAWDATA_FALLBACK_2`, `RE_TEXTELEMENTS_NOSECTION_OK`,
`RE_TEXTELEMENTS_FALLBACK_2`) turned out to be used a second time, directly,
by the class's own text-element-section detection in `loadData()`, not only
inside the moved `getExcalidrawMarkdownHeader()` — exported those four from
the new file and imported them back rather than duplicating the regexes.
REGEX_TAGS/REGEX_LINK/REG_LINKINDEX_HYPERLINK and the `AutoexportPreference`
enum were deliberately left in `ExcalidrawData.ts` since the class body uses
them extensively; they're a different concern (inline link/tag parsing, not
header/drawing-section parsing).

**2. Extracted the four embedded-data registries to `EmbeddedDataRegistries.ts`.**
Moved the Files/Equations/Local-Markdown-images/Mermaids `Map`-based
get/set/has/delete method families (~20 methods) intact into a new
`EmbeddedDataRegistries` class, constructor-injected with `host: ExcalidrawData`
(type-only import), matching the `ViewSceneFileManager`/`MarkdownImageController`
precedent. `ExcalidrawData` keeps every method as a one-line public delegate
(`this.embeddedDataRegistries.setFile(fileId, data)`, etc.) so no external
caller needed to change. The four registries are structurally similar but
**not identical** (Files has hyperlink/local-link branching Equations/Mermaids
don't; Markdown-images has a `clearMaster` flag the others don't), so they
were moved as four distinct method groups rather than collapsed into one
generic registry — collapsing them would have been exactly the kind of
behavior-risking consolidation `AGENTS.md` warns against ("marginal behavior
differences must be shown unused"). Required widening `app`, `plugin`,
`equations`, and `mermaids` from `private` to `public` on `ExcalidrawData`
(`files`/`markdownImages`/`file` were already public) — a type-only visibility
change with the same precedent as the ~30 fields widened during the Phase 7
React-root extraction. A first pass value-imported `EmbeddedFile` from
`EmbeddedFileLoader.ts` into the new file for its two `new EmbeddedFile(...)`
call sites; the production build caught that this added a new circular-
dependency edge (33 → 34 Rollup warnings, a genuinely new edge through the
new file, not just another path through the pre-existing `ExcalidrawData.ts`
↔ `EmbeddedFileLoader.ts` cycle already on the "starting candidates" list
above). Fixed by constructor-injecting the `EmbeddedFile` class itself
(`embeddedFileCtor: typeof EmbeddedFile`, passed as
`new EmbeddedDataRegistries(this, EmbeddedFile)` from `ExcalidrawData`'s
constructor, which already value-imports `EmbeddedFile`) and switching the
new file's own import to `import type` — restoring the 33-warning baseline.
This is the same constructor-injection-to-avoid-a-new-cycle-edge pattern the
`no-unsafe-*` and Phase-6 sections above already established.

**Outcome:** `ExcalidrawData.ts` decreased from 2,845 to 2,285 lines (560
fewer, ~20%); `excalidrawMarkdownParsing.ts` is 474 documented lines and
`EmbeddedDataRegistries.ts` is 285 documented lines. `npm run build`,
`npm run lib`, and `node --check dist/main.js` passed; the circular-
dependency baseline is unchanged at 33 warnings. Targeted ESLint on all three
files plus a full `src/` run confirm **zero new findings**: the pre-existing
64 `no-unsafe-*` findings in `ExcalidrawData.ts` split as 63 remaining +
1 relocated into `EmbeddedDataRegistries.ts` (the `getFiles()` `Object.values()`
`any[]` return, which already existed at the old location), and the
`excalidrawMarkdownParsing.ts` extraction carried zero findings of its own;
the full-repo count is unchanged at 470. `dist/main.js` is 4,716,854 bytes,
comfortably below the 5 MiB release limit. `git diff --check` passed (no
whitespace issues). Manual testing pending — see the plan file for whether
to prioritize this over the `no-unsafe-*` continuation noted just above,
since it touches the same file.

### Action log

| Date | Action | Outcome | Validation |
| --- | --- | --- | --- |
| 2026-08-14 | Extracted Markdown/frontmatter parsing and the four embedded-data registries out of `ExcalidrawData.ts` (see the two numbered items above) | `ExcalidrawData.ts` reduced from 2,845 to 2,285 lines via two new files, `excalidrawMarkdownParsing.ts` (474 lines) and `EmbeddedDataRegistries.ts` (285 lines); all existing external import paths preserved via re-exports/delegates | `npm run build`, `npm run lib`, `node --check dist/main.js` all passed; circular-dependency baseline unchanged at 33 (after fixing one transient new edge caught by the first build, via constructor-injecting `EmbeddedFile` instead of value-importing it in the new registries file); targeted ESLint on the three touched/new files and a full `src/` run both confirm zero new findings (64 pre-existing `ExcalidrawData.ts` findings now split 63+1 across the two files; full-repo count unchanged at 470); `dist/main.js` is 4,716,854 bytes; `git diff --check` passed. Manual testing pending: embedding/pasting images, equations, local Markdown images, and Mermaid diagrams across drawings (registry extraction); opening drawings with unusual header structures, theme-switching a Markdown file, and back-of-card text-element parsing (parsing extraction). |
| 2026-08-14 | Closed the `ExcalidrawData.ts` structural-extraction validation checkpoint | Manual testing of both extractions found no issues | User confirmed testing completed with no issues; committed |

## Related, separate effort: script-registered element actions + autostart permissions

Started 2026-08-14. Independent of the other work on this page. Full design
(context, API shapes, sequencing, AGENTS.md/CONTRIBUTING.md compliance
notes, verification plan) is in the approved plan at
`/Users/zsviczian/.claude/plans/proud-wandering-tulip.md` — this section
tracks execution against that plan; see the plan file for the "why."

Two features, shipped as 5 sequential checkpoints: (1) let scripts register
buttons in the selected-element context menu
(`ExcalidrawAutomate.registerElementActionProvider()`), and (2) let a
script ask to be automatically re-run whenever a new `ExcalidrawView`
opens, gated by a per-script user confirmation (Allow/Deny/Ask-later) that
persists and is manageable later from Settings and a Command Palette
action reusing the same rendering component (matching how
`EmbeddalbeMDFileCustomDataSettingsComponent` is reused across contexts).

### Progress

| Step | Status | Outcome |
| --- | --- | --- |
| 1. Type move | Complete | Moved `SelectedElementMenuAction`/`SelectedElementMenuProvider` from `SelectedElementActionsMenu.ts` to new `src/types/elementActionTypes.ts`. Pure mechanical move, no other file referenced the old location yet, so no compatibility re-export was needed. |
| 2. `registerElementActionProvider` | Implemented; user-tested, two fixes applied | Added the public method on `ExcalidrawAutomate` (delegates to the existing `view.selectedElementActionsMenu.registerProvider()`, id defaults to `this.activeScript ?? nanoid()`, matching `createSidepanelTab`'s precedent). Added `ScriptEngine.trackElementActionProvider()`/cleanup in `unloadScript()` (`src/shared/Scripts.ts`) for the one gap the existing mechanism didn't already cover: a script's file being deleted while a view using its registered action is still open (ordinary view-close cleanup was already handled by `SelectedElementActionsMenu.destroy()`). Added the `SuggesterInfo.ts` entry and a `## New` bullet in `Messages.ts` under `2.27.0` per the ExcalidrawAutomate Change Checklist. No new locale keys needed — this API produces no plugin-authored user-visible strings (button text/icon come from the registering script). User tested registering multiple menus and clearing them independently — both worked. Fix 1: `registerProvider()` primes the menu to recompute on its *next* `update()` call (by resetting `selectedElementId`), but nothing was triggering `update()` immediately — if an eligible element was already selected when a script registered (e.g. run via command palette), the button didn't appear until the user deselected and reselected. Fixed by having `registerElementActionProvider()` immediately call `selectedElementActionsMenu.update(view.getViewElements(), appState)` right after registering, mirroring the exact call `ExcalidrawRoot.ts`'s mount effect already makes at view-open time. Fix 2 (found later, during step 3/4 testing): running the same script a second time in the same view registered a second provider under the same id, producing a duplicate button, since `SelectedElementActionsMenu`'s `providers` array had no id-uniqueness enforcement. Fixed via new `SelectedElementActionsMenu.hasProvider(id)` + a guard in `registerElementActionProvider()` that logs via `errorMessage()` and returns `null` instead of double-registering. |
| 3. Autostart data + prompt flow | Implemented; pending user testing | Added `autostartScripts: { [scriptName: string]: "allow" \| "deny" \| "unknown" }` (default `{}`) to `ExcalidrawSettings`/`DEFAULT_SETTINGS` (`src/core/settingsDefaults.ts`) — deliberately a sibling of `scriptEngineSettings`, not reused, since this is plugin/user-trusted permission state a script must not silently flip. Added `ExcalidrawAutomate.registerAutostart(): Promise<"allow"\|"deny"\|"pending">` reusing the existing `MultiOptionConfirmationPrompt<T>` (`src/shared/Dialogs/Prompt.ts`, same class `MarkdownImageController.ts` already uses for its keep/delete prompt): no active script → `errorMessage()` + `"pending"`; missing entry → created as `"unknown"` and persisted immediately (visible in the future management UI right after the first run, before any button is clicked); `"allow"`/`"deny"` short-circuit with no prompt; `"unknown"` (including a dismissed-without-choosing prompt, which the class resolves as `null`) shows the Allow/Deny/Ask-me-later prompt, persists Allow/Deny, and leaves `"unknown"`+returns `"pending"` for Ask-me-later or dismissal. Added `SuggesterInfo.ts` entry, a `## New` bullet in `Messages.ts` under `2.27.0`, and new locale keys (`AUTOSTART_SCRIPT_PROMPT`/`_ALLOW`/`_DENY`/`_ASK_LATER`) in `en.ts` + `ru`/`es`/`zh-cn`/`zh-tw` — this step's prompt text and button labels are genuinely new plugin-authored user-visible strings, unlike step 2. Two scope additions made after initial user testing, both confirmed via `AskUserQuestion` before implementing: (a) a fresh "allow" now also immediately re-runs the script in every other currently-open Excalidraw view via new `ScriptEngine.attachAutostartScriptToOpenViews()` (enumerates `getExcalidrawViews(app, true)`, reuses `executeScript()` per view, per-view try/catch so one failure doesn't affect others) — otherwise approval only ever affected views opened afterward; (b) deleting or renaming a script's file now purges its `autostartScripts` entry via new `ScriptEngine.purgeAutostartPermission()`, called from the existing `deleteEventHandler`/`renameEventHandler` (not from `unloadScript()` itself, since that method is also called for non-identity-changing cases like a script-folder-path change or plugin unload, where purging would be wrong) — a renamed script now starts fresh under its new name instead of leaving a stale orphaned entry under the old one forever. No autostart-on-view-open execution/UI wiring yet (steps 4-5). |
| 4. Autostart execution | Implemented, user-tested, one addition applied | Added `ScriptEngine.runAutostartScripts(view: ExcalidrawView): void` (`src/shared/Scripts.ts`): reads `settings.autostartScripts`, filters `"allow"`, resolves each via the existing `getScriptFileByName()`, and runs it against the given view. Shares a new private `runAutostartScriptInView(scriptName, file, view, where)` helper with step 3's `attachAutostartScriptToOpenViews()` (read file → strip frontmatter → `executeScript()`, with its own try/catch so one bad script doesn't affect the others or block the view) — refactored out to avoid duplicating that logic between the two entry points. Wired into `ExcalidrawRoot.ts`'s mount effect with a single line, `view.plugin.scriptEngine.runAutostartScripts(view);`, placed right after the existing `selectedElementActionsMenu` setup/first `update()` call so registered element actions are ready before any autostart script runs against the new view. Fire-and-forget (not awaited), matching "keep startup light." Deliberately independent of the sidepanel autostart feature — different persisted field (`autostartScripts` vs `sidepanelTabs`), different trigger, different execution owner; `Sidepanel.ts` untouched. User confirmed manual testing passed. Addition from follow-up user feedback: `runAutostartScriptInView()` now records whether each autostart run succeeded or failed in a new sibling setting, `autostartScriptFailures: { [scriptName]: boolean }` (`settingsDefaults.ts`), via a new `recordAutostartResult(scriptName, failed)` helper — writes `settings` (and calls `saveSettings()`) only when the flag actually *changes* (clears on the first success after a failure, sets on the first failure after a success/never-run), not on every autostart run, to avoid a disk write every time an allow-listed script runs cleanly. Purely informational: never touches `autostartScripts` itself, so a failing script is never auto-removed from the allow list — surfacing the warning and any removal decision is left to the future settings/modal UI (step 5) and the user, respectively. `purgeAutostartPermission()` (rename/delete cleanup, from step 3) now also purges the failure flag alongside the permission entry. |
| 5. Autostart UI | Implemented; pending user testing (design revised four times before any testing occurred — see Action log) | Added `AutostartScriptsSettingsComponent` (`src/shared/Dialogs/AutostartScriptsSettingsComponent.ts`, new file): a plain class taking `(contentEl, plugin)`, matching the `EmbeddalbeMDFileCustomDataSettingsComponent` reuse pattern. `render()` renders as a bordered table (header row + one row per script), reusing the AI provider table's existing `.excalidraw-ai-provider-table`/`__header`/`__row` CSS as-is (no new `styles.css` rules), each script row a 3-option dropdown — Autostart / Manual start only / Ask every time (`allow`/`deny`/`unknown`) — writing straight to `autostartScripts[name]` + `saveSettings()`, reusing the exact same locale keys as the permission prompt's buttons so both surfaces speak one vocabulary. Shows a `var(--text-error)`-colored warning under any script whose `settings.autostartScriptFailures[name]` is set. Empty state (`AUTOSTART_SCRIPTS_EMPTY`) rendered as its own table row when no script has ever registered. Same file also has `AutostartScriptsModal extends Modal`, whose `onOpen()` mounts the component into `this.contentEl` (its own header row supplies the heading/description; the modal's native `titleEl` gets `AUTOSTART_SCRIPTS_HEAD` separately for the window chrome) and adds an explicit `PROMPT_BUTTON_CLOSE` button below it (in addition to Obsidian's built-in header close icon, per user request). Wired into Settings inside `renderExcalidrawAutomateSection()` (`src/core/settings.ts`), directly under the Startup script setting, in a child `createDiv()` of that section's own `<details>` — not its own foldable section. New command `view-autostart-scripts` (`src/core/managers/CommandManager.ts`), unconditional `callback` (not gated on an active Excalidraw view, since this manages global settings) opening `AutostartScriptsModal`. New locale keys `AUTOSTART_SCRIPTS_HEAD`/`_DESC`/`_EMPTY`/`AUTOSTART_SCRIPT_FAILED_WARNING` plus a new generic `PROMPT_BUTTON_CLOSE` in `en.ts` + `ru`/`es`/`zh-cn`/`zh-tw`; `AUTOSTART_SCRIPTS_HEAD` is reused as both the command name and the table/modal heading. No SuggesterInfo/Messages.ts entry needed — no new `ExcalidrawAutomate` API, and the command/settings-UI mention was already added to the `2.27.0` `## New` bullet back in step 3. This is UI/settings-only code (not part of the plugin's public API surface), so `npm run lib` was run as a matter of course but wasn't expected to be affected. |

### Action log

| Date | Action | Outcome | Validation |
| --- | --- | --- | --- |
| 2026-08-14 | Completed steps 1-2 | See Progress table above | `npm run build`, `tsc --noEmit`, `npm run lib` (public API surface touched) all passed; `node --check dist/main.js` passed; ESLint unchanged at 470/0 across the whole repo (same baseline before and after via `git stash` comparison); the existing 33-warning circular-dependency baseline is unchanged. Manual validation pending: register an action from a throwaway script, confirm it appears/disappears correctly across selection changes, and confirm deleting the script file while its view is open removes the button with no error on the next selection change. |
| 2026-08-14 | Completed step 3 (including two scope additions from user testing feedback — see Progress table) | See Progress table above | `npm run build`, `tsc --noEmit` (no new errors in touched files; remaining errors are pre-existing environment/`node_modules` typing issues), `npm run lib` (public API surface touched) all passed; `node --check dist/main.js` passed; ESLint on touched files plus full-repo run both unchanged at the 470-problem baseline (0 new errors — one transient `no-unsafe-assignment` on an untyped `catch (e)` was introduced and fixed immediately by typing it `catch (error: unknown)`, matching the existing pattern already used elsewhere in `Scripts.ts`). User confirmed manual testing worked; committed as `dbb9a7dc`. |
| 2026-08-14 | Completed step 4 | See Progress table above | `npm run build`, `tsc --noEmit`, `npm run lib` all passed; `node --check dist/main.js` passed; ESLint on touched files plus full-repo run both unchanged at the 470-problem baseline (0 new errors). User confirmed manual testing (cold startup, registered action available immediately, broken script isolation) passed as expected. |
| 2026-08-14 | Added autostart failure tracking (`autostartScriptFailures`) to step 4, per follow-up user feedback | See step 4 row in Progress table above | `npm run build`, `tsc --noEmit`, `npm run lib` all passed; `node --check dist/main.js` passed; ESLint unchanged at the 470-problem baseline. Manual validation pending: put a script that throws on autostart on the allow list, confirm `settings.autostartScriptFailures[scriptName]` becomes `true` after the failing run and the script stays on the allow list; fix the script and reopen a view, confirm the flag clears; confirm `saveSettings()` is not called on ordinary successful autostart runs (no flag to clear). |
| 2026-08-14 | Completed step 5 (requested early, ahead of steps 3-4 being tested, specifically to make manual testing of the failure-flag addition easier) | See Progress table above | `npm run build`, `npm run lib` all passed; `node --check dist/main.js` passed; `tsc --noEmit` error count unchanged (526 before and after, verified via `git stash -u`/`pop` — a plain `git stash` without `-u` was tried first and misleadingly showed a *higher* before-count, because it left the new untracked component file on disk while stashing away the `settingsDefaults.ts` fields it depends on; `-u` gives the correct apples-to-apples comparison); ESLint on the new file plus touched files plus full-repo run all unchanged at the 470-problem baseline. Manual UI testing pending — this is Obsidian-plugin UI with no CLI-testable dev server, so it needs to be exercised in a real vault: open Settings → Compatibility → "Autostart scripts" and the `view-autostart-scripts` command's modal, confirm both show the same live state, confirm the empty state before any script has registered, and confirm the failed-run warning (step 4's addition) is visible and clears correctly. |
| 2026-08-14 | Revised step 5 per user feedback before any testing had occurred: replaced the Allow/Deny/Ask-later dropdown with a remove-only trash button, added an explicit Close button to the modal | See step 5 row in Progress table above | `npm run build`, `npm run lib` all passed; `node --check dist/main.js` passed; `tsc --noEmit` error count unchanged (526/526, `git stash -u`/`pop`); ESLint unchanged at the 470-problem baseline. Manual testing still pending (same checklist as above, plus: confirm removing a script clears both its permission and its failure-flag entry, and confirm the new modal Close button and Obsidian's own header close icon both work). |
| 2026-08-14 | Two fixes from user manual testing of step 2/3: (a) running an already-registered script a second time in the same view created a duplicate action button; (b) the Allow/Deny/Ask-me-later prompt gave no hint of where to manage the decision afterward | Fixed both, no schema/settings changes | (a) Added `SelectedElementActionsMenu.hasProvider(id): boolean` (`src/view/components/menu/SelectedElementActionsMenu.ts`) and a check at the top of `ExcalidrawAutomate.registerElementActionProvider()`: if this script's id is already registered in the target view, it logs a message via the existing `errorMessage()` helper and returns `null` instead of pushing a second provider (previously `SelectedElementActionsMenu`'s `providers` array had no id-uniqueness enforcement, so re-running the same script produced two entries whose `getActions()` calls were both concatenated into the rendered button list). Updated the method's TSDoc and its `SuggesterInfo.ts` entry to document the new no-op-on-duplicate behavior. (b) Added `AUTOSTART_SCRIPT_PROMPT_MANAGE_HINT` (new locale key, `en`/`ru`/`es`/`zh-cn`/`zh-tw`) and appended it to the prompt message in `registerAutostart()` as a muted, smaller-font second line pointing at the `view-autostart-scripts` command and the Settings → Compatibility → Autostart scripts section built in step 5 - only possible to write accurately once step 5's UI existed. | `npm run build`, `npm run lib`, `node --check dist/main.js` all passed; `tsc --noEmit` unchanged (526/526); ESLint on touched files plus full-repo run unchanged at the 470-problem baseline. Manual validation pending: run the same script twice in one view and confirm only one button appears (and a message is logged, not a thrown error); trigger the autostart prompt and confirm the hint line renders and reads correctly under both the Compatibility-section and command-palette-modal paths it references. |
| 2026-08-14 | Reverted step 5's remove-only trash button back to a dropdown, per user catching a design flaw before testing: a "Manual start only" (deny) decision was a dead end, since removing the entry only let a script re-decide by being *re-run*, with no way to flip it back to Autostart directly from Settings | Restored the dropdown in `AutostartScriptsSettingsComponent`, reworded all three option/button labels for clarity | The three `autostartScripts` values keep their internal names (`allow`/`deny`/`unknown`) but their *displayed* text changed everywhere at once, since the settings dropdown and the permission prompt's buttons share the same three locale keys (`AUTOSTART_SCRIPT_ALLOW`/`_DENY`/`_ASK_LATER`) - updating the strings fixed both surfaces' wording and their mutual ambiguity in one edit, and keeps them permanently in sync (one vocabulary, not two). New wording: "Allow"/"Deny"/"Ask me later" → "Autostart"/"Manual start only"/"Ask every time" (mirrored in `ru`/`es`/`zh-cn`/`zh-tw`). Dropped `AUTOSTART_SCRIPT_REMOVE` (tooltip for the now-removed trash button) and reworded `AUTOSTART_SCRIPTS_DESC` to no longer describe removal. `AutostartScriptsSettingsComponent.render()`'s row is back to `addDropdown()` (same code shape as the very first draft of this component, before the trash-button detour), writing straight to `autostartScripts[scriptName]` + `saveSettings()` - deliberately does *not* touch `autostartScriptFailures` on a dropdown change, since a permission change doesn't retroactively affect whether the last actual run failed. | `npm run build`, `npm run lib`, `node --check dist/main.js` all passed; `tsc --noEmit` unchanged (526/526); ESLint on touched files plus full-repo run unchanged at the 470-problem baseline. Manual validation pending: set a script to "Manual start only," confirm it's immediately switchable back to "Autostart" or "Ask every time" from both the Settings section and the command-palette modal without re-running the script; confirm the prompt dialog now shows the reworded button labels. |
| 2026-08-14 | Third step-5 revision, per user direction: relocate the Settings placement (out of its own top-level `<details>`/`Compatibility` area, into the ExcalidrawAutomate section, directly under the Startup script setting) and restyle as a bordered table instead of a foldable list | Moved and restyled, no behavior change to the underlying data/permission logic | Removed the standalone `<details>`/`<summary>` block this component used to sit in at the end of `renderCompatibilitySection()` (`src/core/settings.ts`); added a single `new AutostartScriptsSettingsComponent(detailsEl.createDiv(), this.plugin).render()` call at the end of `renderExcalidrawAutomateSection()`, right after the existing Startup script `Setting` block, inside that section's own (pre-existing) `<details>` - a *child* `createDiv()`, not the shared `detailsEl` itself, since the component's `render()` calls `.empty()` on its container and would otherwise wipe out the Startup script setting above it on every re-render. Restyled `AutostartScriptsSettingsComponent` to match the AI-provider table's exact look: a bordered, rounded, indented box with a header row (name=`AUTOSTART_SCRIPTS_HEAD`, desc=`AUTOSTART_SCRIPTS_DESC`) and one row per script below it. Initially implemented by *duplicating* `renderAISettings()`'s `.excalidraw-ai-provider-table` CSS (`styles.css:403-465`) under new `.excalidraw-autostart-scripts-table`/`__header`/`__row` class names, reasoning it would isolate the change from the AI section - user immediately (and correctly) pushed back: applying the AI table's *existing* classes to a second container changes nothing about the AI table itself, since no existing rule is edited, so the "isolation" bought nothing but 60-odd duplicate lines in `styles.css`. Reverted to reusing `.excalidraw-ai-provider-table`/`__header`/`__row` directly and deleted the duplicate block entirely - net effect on `styles.css` is now zero lines added. The empty state is its own `__row`-styled `Setting` (desc only, no name) rather than a plain paragraph, so it still renders inside the bordered box instead of looking detached from it. `AutostartScriptsModal` no longer duplicates the heading/description in its body (`this.contentEl.createDiv({text: AUTOSTART_SCRIPTS_DESC, ...})` removed) since the table's own header row already shows both - the modal's native `titleEl` still gets `AUTOSTART_SCRIPTS_HEAD` for the window chrome, which isn't visually duplicative of the in-body header. | `npm run build`, `npm run lib`, `node --check dist/main.js` all passed; `tsc --noEmit` unchanged (526/526); ESLint on touched files plus full-repo run unchanged at the 470-problem baseline; confirmed no `excalidraw-autostart-scripts-table*` class references remain anywhere (`styles.css`, `dist/styles.css`, or the component file) after the revert. Manual validation pending: open Settings → Excalidraw Automate, confirm the table appears directly under Startup script (not inside Compatibility, not foldable), confirm its bordered/indented look matches the AI provider table's, and confirm the command-palette modal still shows the same table plus its Close button. |
