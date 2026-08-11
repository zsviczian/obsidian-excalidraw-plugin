# Incremental refactor assessment and plan

Status: active plan for the 2.27.0 refactor, last updated 2026-08-09

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
| Remaining view phases | In progress | Manually validate the React-root extraction checkpoint; the higher-risk scene-file loader (`ViewSceneFileManager`) remains the next Phase 6 controller candidate. Phase 8 (converting the extracted root to TSX) should follow only after this checkpoint closes |

### Action log

| Date | Action | Outcome | Validation |
| --- | --- | --- | --- |
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

The current checkpoint is manual validation of the Phase 7 React-root
extraction (`src/view/components/ExcalidrawRoot.ts`). First test a popout
window because a cross-window React mismatch is the highest-impact risk given
the render tree now lives in a different file, then verify tools-panel
positioning/resize, the embeddable and selected-element context menus, the
welcome screen, custom menu actions, web and Obsidian embeddables, and
text-to-diagram/diagram-to-code in the main window. Repeat basic rendering and
embeddables on a mobile device. The next controller candidate remains
`ViewSceneFileManager`, but its loader queue, retry timers, cache validation,
and lifecycle teardown make it a higher-risk extraction than this one was.
Phase 8 (converting the extracted root to TSX) should follow only after this
checkpoint is manually validated, and must not be combined with any state or
callback-wiring change.

After those steps, reassess coupling, bundle size, and manual-test coverage
before committing to the next phase. The plan is deliberately a sequence of
checkpoints rather than a promise to execute every proposed module unchanged.
