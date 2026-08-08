# Incremental refactor assessment and plan

Status: active plan for the 2.27.0 refactor, last updated 2026-08-08

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
| All later phases | Planned | Begin only after the preceding checkpoint is validated |

### Action log

| Date | Action | Outcome | Validation |
| --- | --- | --- | --- |
| 2026-08-08 | Reviewed `AGENTS.md`, `CONTRIBUTING.md`, plugin lifecycle, view lifecycle, package loading, rendering, and Rollup packaging | Established the hybrid Obsidian-host/React-child target and incremental implementation sequence | `npm run build` passed; existing circular dependency warnings recorded |
| 2026-08-08 | Refined scope for 2.27.0 | Legacy AI migration will be retired; generic top-level settings normalization, ExcalidrawAutomate compatibility, duplicate-logic review, and TSDoc are now explicit requirements | Settings and utility reference searches completed; documentation-only build passed |
| 2026-08-08 | Assessed automatic supported-key settings sanitization | Confirmed that removing `stripLegacyAISettings()` alone would re-persist legacy defaults; a shallow replacement is viable only with a cleaned runtime schema and forward-version protection | TypeScript AST check confirmed 204 interface keys and 204 matching `DEFAULT_SETTINGS` keys; load/save, migration, encryption, and dynamic-settings writes reviewed |
| 2026-08-08 | Rejected automatic settings sanitization | Because supported settings change frequently, unknown-key removal creates unacceptable forward-version, downgrade, and mixed-device sync risk. Phase 1 is now limited to removing confirmed legacy AI code and fallback fields | Plan updated; no runtime code changed |
| 2026-08-08 | Completed Phase 1 legacy AI retirement | Removed the legacy migration and stripping helpers from `main.ts`, retired obsolete settings/default fields and the GPT one-off reset, and removed all legacy fallback reads from `AIUtils.ts`. Current provider profiles, model maps, multimodal default, and token settings remain intact. Unknown persisted keys are not sanitized and may round-trip inertly | Repository-wide residue search found no legacy AI runtime references; `ExcalidrawSettings` and `DEFAULT_SETTINGS` each contain the same 183 keys; production build passed after every code slice with the existing 34 circular dependency warnings and no new warnings; `dist/main.js` is 5,097,728 bytes (8,657 bytes smaller than baseline) |
| 2026-08-08 | Closed the Phase 1 validation checkpoint | Manual testing of the legacy AI retirement found no regressions | User confirmed testing completed with no issues |

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
    MarkdownIntegrationManager.ts Post processors and install code blocks

src/view/
  ExcalidrawView.ts               Obsidian host, public facade, composition
  components/
    ExcalidrawRoot.tsx            Package-aware render tree, eventually TSX
  managers/
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

1. Move install-codeblock registration and Markdown integration setup behind a
   `MarkdownIntegrationManager`, while still registering the Markdown post
   processor from `onload()`.
2. Move startup-script execution behind a focused runner owned by the script
   subsystem.
3. Move startup timing storage/formatting into a small `StartupTimer` while
   retaining `plugin.logStartupEvent()` as a delegate if consumers need it.
4. Group initialization and cleanup of managers, but keep a readable ordered
   list in `onloadOnLayoutReady()` and `onunload()`.
5. Only after reference searches and runtime validation, remove confirmed dead
   members. Current review candidates include the unused private
   `registerEventListeners()` and a `fileExplorerObserver` field in `main.ts`
   that appears separate from the observer owned by `ObserverManager`.

Do not hide lifecycle ordering inside a generic service container. The desired
`main.ts` is a readable composition root, not an empty forwarding shell.

### Phase 6: extract low-risk `ExcalidrawView` subsystems

Start with cohesive operations that do not own mount/unmount ordering or save
mutual exclusion. For every extraction, retain the current method on
`ExcalidrawView` as a delegate.

Recommended order:

1. `ViewExportManager`: export preference resolution, file collection, SVG,
   PNG, PDF, clipboard, and save-to-file operations.
2. `ViewLinkNavigationManager`: link parsing, hook invocation, navigation, and
   link click handling.
3. `ViewSceneFileManager`: active/next/deferred embedded-file loaders and
   deferred validation scheduling.
4. `MarkdownImageController`: deletion queue, edit handoff, conversion, and
   local-source operations.
5. `ViewInteractionController`: hover preview and pointer/key interaction only
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
3. Extract `ViewExportManager` while keeping all current `ExcalidrawView`
   export methods as delegates. This establishes the view-controller pattern
   away from lifecycle and synchronization.

The next checkpoint is extracting the package-aware React root using
`createElement()` without TSX or state changes, followed by popout validation.
Convert to TSX only in the subsequent change.

After those steps, reassess coupling, bundle size, and manual-test coverage
before committing to the next phase. The plan is deliberately a sequence of
checkpoints rather than a promise to execute every proposed module unchanged.
