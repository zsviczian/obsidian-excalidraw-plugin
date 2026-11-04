# Obsidian Excalidraw Plugin Agent Guide

## Required reading

Read [CODING_STANDARDS.md](CODING_STANDARDS.md) before implementing or reviewing
changes. It is the canonical source for coding requirements, including timers,
DOM/window ownership, cleanup, security, naming, type changes, localization, and
validation. Add future cross-cutting requirements there instead of duplicating
them here. Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup and build workflows.

## Purpose

This repository contains the Obsidian Excalidraw plugin: an Obsidian.md plugin that integrates a heavily customized Excalidraw fork into Obsidian.

This is not a generic React canvas app. Many implementation choices are driven by:

- Obsidian plugin lifecycle constraints
- Electron desktop and mobile compatibility
- popout window support
- startup time and bundle size
- compatibility with a customized upstream Excalidraw fork
- advanced plugin-specific features such as scripts, automation, custom pens, custom fonts, markdown embeds, PDF export, OCR, AI features, and deep vault integration

When working in this repo, optimize for correctness inside Obsidian and for preserving existing behavior. Do not assume that a simpler-looking web-app pattern is safe here.

Use https://github.com/obsidian-typings/obsidian-typings as a reference when dealing with Obsidian APIs, especially undocumented or weakly documented ones.

## Product And Deployment Model

- The shipped plugin is effectively three files: `main.js`, `styles.css`, and `manifest.json`.
- The production build emits these into `dist/`.
- The bundle is intentionally assembled as a single CommonJS `main.js` with embedded runtime payloads.
- `package.json` is primarily the library/package manifest. Its version is not the canonical plugin release version.
- Plugin release versions live in `manifest.json` and `manifest-beta.json`.
- `package.json` `main` and `types` point to the library build in `lib/`, not the Obsidian runtime bundle.

## Core Mental Model

- `src/core/main.ts` owns plugin startup, lifecycle, settings loading, migration, and manager initialization.
- `src/view/ExcalidrawView.ts` is the main runtime surface for the editor/view experience.
- `src/core/managers/` contains most lifecycle-adjacent coordination logic.
- `src/shared/` contains major reusable subsystems such as Excalidraw Automate, dialogs, data handling, script engine support, LaTeX, workers, and SVG conversion.
- `src/utils/` contains lower-level helpers for Obsidian integration, export, files, PDF, AI, dynamic styling, and scene manipulation.
- `rollup.config.mjs` is a critical part of the runtime architecture, not just a packaging detail.

Treat build code and runtime code as one system.

## Project Overview And Tooling

- Target: Obsidian Community Plugin (TypeScript → bundled JavaScript).
- Runtime entry point: `src/core/main.ts`, compiled by `rollup.config.mjs` to `dist/main.js`.
- Required release artifacts: `main.js`, `manifest.json`, and `styles.css`.
- Node.js: use Node 22 or newer. Check `node --version` before diagnosing build-tool failures; mixed Node/Corepack installations can produce misleading errors.
- Package manager: npm. Use `npm install` and the scripts in this repository's `package.json`.
- Runtime bundler: Rollup. Do not replace this build with a sample-plugin esbuild setup; Rollup also assembles compressed runtime payloads and merged CSS.
- Primary lint command: `npm run code`. `npm run lint` is broader and may expose unrelated repository backlog.
- Types: Obsidian type definitions plus conservative declarations for intentionally used unpublished APIs.

## Issue Investigation And Resolution Templates

When triaging or updating issues across the plugin, Excalidraw fork, Extras, and EA Scripts, use the central [plugin issue tracker and label guidelines](.github/ISSUE_LABELS.md); this plugin repository is the default issue hub for all four projects.



- For source-based issue investigations, GitHub issue comments, and a prioritized shortlist, use [issue assessment](docs/agent-workflows/issue-assessment.md).
- Only after maintainer approval of specific issues, use [issue implementation handoff and resolution](docs/agent-workflows/issue-resolution.md) to prepare a dedicated branch and plan-only draft PR for the local implementation agent.
- The issue owns the technical assessment; the draft PR owns the implementation plan; the branch owns the code. Keep draft PRs open through implementation, link cross-repository dependencies, and do not merge without authorization.

## References

- Obsidian sample plugin: https://github.com/obsidianmd/obsidian-sample-plugin
- API documentation: https://docs.obsidian.md
- Developer policies: https://docs.obsidian.md/Developer+policies
- Plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Style guide: https://help.obsidian.md/style-guide

## Repository Map

### Runtime Source

- `src/core/main.ts`: plugin class, lifecycle ordering, view registration, settings load/save/migration, startup instrumentation
- `src/core/index.ts`: library/public API entry used by consumers of the lib build
- `src/core/settings.ts`: settings interface, defaults, settings tab UI
- `src/core/managers/`: command, event, file, observer, package, style, and markdown post processor managers
- `src/core/editor/`: editor-specific helpers and mode handling
- `src/view/`: Excalidraw views, loading view, sidepanel, view managers
- `src/shared/`: Excalidraw Automate, script engine, dialogs, OCR, LaTeX, data model, workers, suggesters, SVG parser
- `src/utils/`: file/path/export/PDF/Obsidian/scene/UI/helper utilities
- `src/lang/`: localization helpers and locale files
- `src/constants/`: constants, icons, startup script, safe URLs
- `src/types/`: project TypeScript contracts

### Build, Docs, And Supporting Content

- `rollup.config.mjs`: main plugin build and runtime payload embedding
- `MathjaxToSVG/`: separate subproject built before the main plugin and embedded into the bundle
- `scripts/`: build helpers such as `build-mathjax.mjs`
- `styles.css`: plugin stylesheet merged with Excalidraw CSS during build
- `docs/`: user-facing documentation and API/docs content
- `ea-scripts/`: downloadable/example scripts for the script engine, not the main plugin runtime
- `test-data/`: fixtures and sample content, not a conventional automated test suite

## Startup And Lifecycle Rules

Lifecycle ordering matters.

- `onload()` in `src/core/main.ts` registers views, extensions, icons, the ribbon action, settings loading, Excalidraw Automate initialization, the markdown post processor, and the `onLayoutReady` callback.
- `onloadOnLayoutReady()` initializes the package manager, event manager, observer manager, command manager, compression worker, Excalidraw config, monkey patches, styles manager, script engine, fonts, image cache, and finally switches loading views to real Excalidraw views.

Important constraints:

- Keep markdown post processor registration in `onload()`. Obsidian expects post processors to be registered there.
- Monkey patches are intentionally registered after layout is ready.
- Startup order is performance-sensitive and behavior-sensitive.
- Do not move initialization steps across `onload()` and `onLayoutReady()` casually.
- `ExcalidrawView.onUnloadFile()` deliberately avoids calling `super.onUnloadFile()` to avoid duplicate autosave behavior.

If a task touches startup behavior, read the surrounding lifecycle code before editing.

## Build And Packaging Rules

This project uses a non-trivial Rollup build because startup time, popout-window behavior, and bundle size matter.

### Key Facts

- The main build entry is `src/core/main.ts`.
- Production output is `dist/main.js` plus `dist/styles.css` and `dist/manifest.json`.
- `inlineDynamicImports` is enabled for the main bundle.
- The build compresses and embeds selected runtime payloads into `main.js`.
- `styles.css` is merged with upstream Excalidraw CSS and minified.

### Embedded Runtime Payloads

The build embeds or injects runtime code for:

- React, ReactDOM/client, and the official JSX runtime entry points built from the installed npm packages
- the customized `@zsviczian/excalidraw` Obsidian artifact built from Excalidraw's ESM source graph
- `MathjaxToSVG`
- `lz-string`
- selected compressed locale payloads

These payloads are executed or unpacked at runtime. This is intentional.

React and the Excalidraw package are separate compressed payloads. React must remain external to the Excalidraw artifact, because the plugin inflates one matching private React runtime and supplies it to the single evaluated Excalidraw runtime used by every view. Mermaid is also intentionally absent from the artifact and is loaded lazily at runtime through Excalidraw Extras. All other required Excalidraw assets are expected to work offline except the deliberately lazy CJK font subsets.

### Two-Repository Excalidraw Workflow

The customized component lives in the sibling `zsviczian/excalidraw` repository. When both repositories are available locally, it is normally at `../excalidraw`; verify the actual workspace path and branch instead of assuming it.

- The Excalidraw repository uses Yarn and builds the consumer-specific payload from `packages/excalidraw` with `yarn build:obsidian`.
- That build emits four files under `packages/excalidraw/dist/obsidian/`: production and development JavaScript plus production and development CSS.
- This plugin consumes the same four paths from `node_modules/@zsviczian/excalidraw/dist/obsidian/` in `rollup.config.mjs`.
- For a temporary unpublished integration test, build the sibling package and copy only those four generated files into the installed package under `node_modules`. Do not change `package.json` or `package-lock.json` to a local `file:` dependency merely for this handoff. A later `npm install` restores the published package.
- For the durable handoff, publish a new `@zsviczian/excalidraw` version, update this repository's dependency, run `npm install`, and rebuild the plugin.
- A local artifact copy proves integration only. If plugin source consumes a
  new fork API, do not describe the plugin handoff as commit- or release-ready
  until the published package is installed and the exact dependency and
  lockfile contain that API, unless the maintainer explicitly requests a
  paired intermediate commit.
- Never hand-edit or commit generated `dist/`, `lib/`, or `node_modules` artifacts as source fixes.
- Treat the repositories as separate Git histories. Check branch, status, diff, build, and commit state independently in each one, and do not commit or publish unless explicitly requested.

### Typed Excalidraw Host Boundary

The customized Excalidraw runtime receives Obsidian capabilities through typed host adapters. Treat this as the only supported plugin-to-fork dependency-inversion boundary.

- Do not expose or recover the plugin through component props, `appState`, `window`, `globalThis`, `app.plugins`, or fork-side `hostPlugin` variables.
- Keep adapters narrow and semantic. They may expose operations such as reading a current limit or running a named action, but never the plugin instance, the complete settings object, or an active view.
- Capabilities used by `@excalidraw/common` or lower layers belong in `ObsidianCommonHostAdapter`. Capabilities used only by the Excalidraw package belong in `ObsidianExcalidrawHostAdapter`.
- View-specific state must remain instance-scoped. Do not put an active view into either window-runtime adapter; expose a semantic plugin-side action when the component genuinely requires such behavior.
- `PackageManager` registers both adapters once with the shared Excalidraw runtime. React components and individual `ExcalidrawView` instances must not configure or dispose them.
- Adapter methods must read live plugin state instead of capturing settings snapshots during registration.
- `PackageManager` owns the complete lifetime: dispose registrations before releasing the shared runtime, make cleanup idempotent, and roll back all registrations if configuring either adapter fails.

A closure that references the plugin is not itself a memory leak. The risk is allowing a registry, listener, or evaluated runtime retaining that closure to outlive its owning `PackageManager` registration.

The fork is the source of truth for host-adapter contracts and protocol constants. Import or derive types from its published declarations where possible. If the evaluated `window.ExcalidrawLib` surface requires an ambient declaration, derive that declaration from the fork types instead of restating property lists or unions locally.

### Coordinated Internal Protocol And Release

The host adapters are an internal protocol between this plugin and its exact `@zsviczian/excalidraw` dependency. They are not a compatibility surface between arbitrary historical plugin and fork versions.

- A breaking adapter change must increment the relevant protocol version and update the fork implementation, fork tests, plugin adapter, and plugin ambient runtime declaration in one coordinated checkpoint.
- Fail fast during package loading when a required boundary is absent or incompatible. Do not retain global-plugin discovery or legacy bridge fallbacks solely to support mismatched plugin and fork versions.
- Preserve the general backwards-compatibility requirements for persisted settings, serialized scenes, scripts, commands, and public APIs; this exception applies only to the paired internal host protocol.
- For a maintainer-coordinated release, build and verify the fork package first, publish it, update the plugin's exact dependency, run `npm install`, and rebuild and smoke-test against the published artifact before committing the plugin handoff.

### Popout Window Support

- The bundle bootstrap inflates and indirectly evaluates one compressed private React/ReactDOM payload in the main application realm before module-level React consumers run. `src/core/managers/PackageManager.ts` then evaluates one Excalidraw artifact and leases the combined shared package to every view.
- A lease retains the view's actual acquisition window for migration and persistence decisions; package evaluation ownership must never substitute for that identity.
- Popouts receive only a temporary `window.ExcalidrawLib` compatibility alias. Remove it after the final lease for that window while keeping the shared runtime alive until plugin unload.
- The React runtime is built from official npm entry points, inflated once during bundle bootstrap, and kept in plugin/package lexical scope. Do not assign React or ReactDOM to `window`; only the documented `window.ExcalidrawLib` compatibility surface remains global.
- Every Excalidraw root must receive its stable owning document. Rendering, DOM ownership, events, observers, portals, realm constructors, fonts, timers, and React roots must derive from the owning view document/window where appropriate; do not turn the shared runtime into a mutable "current window" singleton.
- Treat `HTMLElement.onWindowMigrated()` as a destructive runtime boundary. Its callback runs after Obsidian has moved the view container to another document, while the existing React root and Excalidraw API still belong to the source window runtime.
- For a dirty migration, synchronously capture every API-owned value needed for persistence and unmount the source React root **before the first `await`**. Do not move synchronization, compression, Vault/native file access, `closeLeafView()`, or another asynchronous step ahead of that unmount. On macOS/Electron, doing so reproducibly allowed the source popout window to be destroyed before `root.unmount()`, freezing Obsidian and disconnecting DevTools.
- Cancel deferred initialization and scene-file loaders before migration unmount, and require delayed loader callbacks to match the exact API instance and file path that started them. Component-owned image decoding can still outlive a synchronous `addFiles()` call, so the Excalidraw runtime must also stop after an awaited decode when its editor has unmounted; never delay migration unmount to wait for image work.
- The migration callback owns the single persistence flush. Generic `onClose()` and `onUnloadFile()` safeguards must not start duplicate migration saves, and the retired source view must reject blur-save side effects and vault-modify synchronization after its API is unmounted.
- A popout-to-main migration may serialize from a synchronously captured drawing snapshot, but the replacement main-window view must perform the final drawing-file write. Never initiate the final Vault/native write from the source popout callback.

### Main-Window Persistent Storage

Window ownership for rendering is not the same as ownership for persistent plugin data.

- Existing plugin-level IndexedDB and local-storage data belongs to Obsidian's main application window and must remain shared across normal views and popouts.
- Do not change persistent storage to `view.ownerWindow`, create one database per popout, or infer a storage migration from a rendering bug unless the task explicitly requires that behavior.
- Diagnose persistence and presentation separately. For example, a visible history button conditioned on loaded records proves the load path worked even when a portaled history menu is hidden.
- If a new feature is intentionally view-local, document that exception and test window migration and popout teardown explicitly.

### IndexedDB And Cache Schema Changes

- Classify every affected store as disposable derived cache or durable user
  data before changing its schema. Image previews may be rebuilt; drawing
  backups must not be deleted as cache migration cleanup.
- Create current stores and remove obsolete disposable stores in one IndexedDB
  version-change transaction. Prefer lazy cache rebuilding over deserializing
  and rewriting a large legacy cache during startup.
- If opening or upgrading fails, close and clear unusable database handles and
  readiness promises. A closed legacy connection must never make the cache
  report itself as ready.
- Use browser APIs such as `Blob` and `FileReader` for in-memory payload
  conversion so the path remains mobile-safe. Vault file access must still use
  Obsidian's Vault API.
- Validate cold upgrade, preservation of durable stores, first cold rebuild,
  warm reopen, clear, timed purge, plugin reload, and one mobile run. Persistent
  plugin data remains owned by the main application window; popouts need a
  usage smoke test, not a separate database.

### MathJax Subproject

- `MathjaxToSVG/` is a standalone subproject with its own build.
- `scripts/build-mathjax.mjs` hashes the subproject, installs dependencies if needed, and rebuilds it when inputs change.
- The main plugin build expects `MathjaxToSVG/dist/index.js` to exist and embeds it.

### Localization Compression

- English is loaded directly.
- Some non-English locales are compressed and embedded at build time.
- `rollup.config.mjs` tokenizes runtime-dependent strings in locales.
- `src/lang/helpers.ts` resolves those tokens at runtime.
- If you add new runtime-dependent locale patterns, you must keep `rollup.config.mjs` and `src/lang/helpers.ts` in sync.

### Safe URL Handling

- Safe URLs are centralized in `src/constants/safeUrls.ts`.
- Preserve literal, statically reviewable origins and complete static URLs. Only repository-relative or resource-relative paths may be constructed dynamically from validated or encoded path segments.
- If you change safe URL handling, rebuild and verify that the intended literal origins remain visible in both source and `dist/main.js`, and search for domain assembly or endpoint-obfuscation patterns before release.

### Versioning Nuance

- The release workflow publishes `dist/main.js`, `dist/styles.css`, and `dist/manifest.json`.
- Stable releases use `manifest.json`.
- Pre-releases swap in `manifest-beta.json` in the GitHub release workflow.
- `rollup.config.mjs` currently reads `manifest-beta.json` when injecting `PLUGIN_VERSION`, so version changes must be intentional and consistent.

## Architectural Conventions

- Prefer repository-local patterns over upstream Excalidraw assumptions.
- Many unusual solutions are workarounds for Obsidian or Electron limitations. Do not remove them just because they look unconventional.
- The codebase uses non-published Obsidian APIs and monkey patches where necessary.
- Performance and startup-time optimizations are first-class design constraints.
- Popout window support is a first-class design constraint.
- Backwards compatibility is a strong default requirement.
- Preserve existing abstractions unless the task clearly requires a redesign.
- Avoid broad refactors unless there is strong evidence they are necessary.

### Incremental Refactoring Protocol

- Use `RefactorPlan.md` as the living architectural record. Update the progress table and append an action-log entry after each completed or reverted checkpoint.
- Make one independently testable behavior change or mechanical extraction at a time. Prefer moving code intact before simplifying it.
- Preserve timers, observers, semaphores, lifecycle ordering, and unpublished-API workarounds unless their purpose has been traced and an equivalent behavior has been verified across affected platforms.
- Do not convert `ExcalidrawView` wholesale into React. It must remain an Obsidian `TextFileView`; React is the child rendering runtime. Extract cohesive view-scoped controllers and components while retaining compatibility delegates on the view.
- For duplicate utilities, compare every implementation and caller before consolidation. Marginal behavior differences must be shown unused or deliberately preserved.
- Do not derive a runtime settings sanitizer from the TypeScript interface. Interfaces do not exist at runtime, settings evolve frequently, and unknown keys may belong to a newer or companion version. Remove obsolete keys only through an explicit, reviewed migration or retirement decision.
- End every checkpoint with risk-based manual test recommendations: identify the highest-probability failure, the affected workflow, and whether main-window, popout, desktop operating systems, and mobile need separate coverage.

## Where To Make Changes

Use this routing guide before editing.

- Startup, lifecycle, readiness, plugin-wide state: `src/core/main.ts`
- Public/library API surface: `src/core/index.ts`
- Settings schema/defaults/UI: `src/core/settings.ts`
- Commands and command registration: `src/core/managers/CommandManager.ts`
- Vault or workspace event handling: `src/core/managers/EventManager.ts` and `src/core/managers/FileManager.ts`
- Markdown rendering or markdown embeds: `src/core/managers/MarkdownPostProcessor.ts`
- Shared package/runtime loading and per-window leases: `src/core/managers/PackageManager.ts`
- Styling setup and style injection: `src/core/managers/StylesManager.ts`, `styles.css`, `src/utils/dynamicStyling.ts`
- Main canvas/editor behavior: `src/view/ExcalidrawView.ts`
- Sidepanel behavior: `src/view/sidepanel/`
- Scripting and automation API: `src/shared/ExcalidrawAutomate.ts` and `src/shared/Scripts.ts`
- Dialogs and UI support components: `src/shared/Dialogs/`
- Release notes and next-version change messages: `src/shared/Dialogs/Messages.ts` and `src/shared/Dialogs/ReleaseNotes.ts`
- Export/PDF/image workflows: `src/utils/exportUtils.ts`, `src/utils/PDFUtils.ts`, `src/shared/ImageCache.ts`
- Localization: `src/lang/locale/en.ts`, then the maintained locales `ru.ts`, `es.ts`, `zh-cn.ts`, and `zh-tw.ts`, then build/runtime localization helpers if needed
- Build output, bundle shape, and injected payloads: `rollup.config.mjs` and `MathjaxToSVG/`

## Settings Change Checklist

If a task changes persisted settings, inspect all relevant pieces.

- `ExcalidrawSettings` in `src/core/settings.ts`
- `DEFAULT_SETTINGS` in `src/core/settings.ts`
- settings UI in `src/core/settings.ts`
- loading and migration logic in `src/core/main.ts`
- any encryption or decryption logic for persisted keys

Settings changes are often incomplete if only one of these surfaces is updated.

## Declarative Settings And Persistence

The plugin supports Obsidian 1.8.7 while optionally using the declarative settings API introduced in Obsidian 1.13. Preserve both compatibility paths.

- Do not bump the `obsidian` dependency or `minAppVersion` merely to consume declarative settings. Gate the runtime path with `requireApiVersion("1.13.0")` and keep conservative placeholder declarations for the newer API.
- `getSettingDefinitions()` must return the complete tree only when the runtime supports declarative settings and the restart-applied compatibility preference enables them. Returning an empty array is the intentional fallback to the legacy renderer.
- The settings page model is the canonical hierarchy for declarative rendering, legacy single-page rendering, descriptions, search aliases, breadcrumbs, cross-page navigation, and Markdown export. Do not create separate setting lists or behavior implementations for the two layouts.
- Controls that change each other's options, visibility, or disabled state must share one integrated component or one shared configurator. Apply dependent state during initial render as well as after changes. Scope captured control references to one rendered definition tree; generating an export-only tree must never replace bindings used by the mounted UI.
- On Obsidian 1.13+, do not call `display()` to refresh a declarative page. Update the mounted controls through their binding/configurator path or ask Obsidian to rebuild definitions only when the definition tree itself changed.
- Declarative page navigation uses guarded unpublished Obsidian APIs. Prefer `openPagePath`; retain the checked `findTabById`/`navigateToPage` fallback, derive localized paths from the canonical page model, and degrade to non-navigating text when the API is unavailable.
- Route all settings writes through `PluginSettingsManager` and its serialized stable-snapshot writer. Save when values change; never make plugin shutdown or settings-tab closure the primary persistence boundary because Obsidian may not await asynchronous writes during termination. Avoid competing direct `saveData()` calls.
- Missing and invalid `data.json` states are different. A first installation with no file is valid; a missing file with a recovery snapshot requires a restore-or-defaults choice; invalid startup data should restore a valid device-local snapshot or ask the user how to proceed; invalid data arriving during a running session must be rejected and repaired from the valid in-memory settings.
- The last-known-good recovery snapshot is durable, device-local IndexedDB data owned by the main application window. Refresh it after every valid load or save, do not store large snapshots in `localStorage`, and do not create independent recovery databases for popouts.
- Preserve unknown persisted keys. Do not derive a sanitizer from the TypeScript settings interface or treat unfamiliar keys as corruption.

## Script Engine And Automation Notes

- Excalidraw Automate is a major public surface of this project.
- `src/shared/ExcalidrawAutomate.ts` is large and high-impact.
- `src/shared/Scripts.ts` loads and manages vault-based scripts.
- Example and user-facing docs live in `AutomateHowTo.md`, `docs/ExcalidrawScriptsEngine.md`, `docs/API/`, and `ea-scripts/`.
- If you change public automation behavior, consider whether docs or the library build need updates.

### ExcalidrawAutomate Change Checklist

When public automation behavior changes, review these documentation surfaces; update only those affected:

1. **`src/shared/Dialogs/SuggesterInfo.ts`** — Add or update the corresponding entry in `EXCALIDRAW_AUTOMATE_INFO`. The `field` must match the function or property name exactly. The `desc` should explain behavior clearly, including any important limitations or session-scoped constraints. The `code` should reflect the actual TypeScript signature.
2. **`src/shared/Dialogs/Messages.ts`** — Apply the [release-note selection rules](CODING_STANDARDS.md#user-facing-change-workflow). Mention a meaningful new scripting capability or required migration concisely; do not add an entry for every API fix or unreleased refinement, and do not include TypeScript signatures or code blocks.
3. **`src/lang/locale/en.ts`** (and maintained locales) — Only required if the change introduces new user-visible strings. Follow the [user-facing change workflow](CODING_STANDARDS.md#user-facing-change-workflow).

## High-Risk Areas

These areas require extra care:

- `rollup.config.mjs`: payload injection, localization, manifest/versioning, CSS bundling
- `src/core/main.ts`: lifecycle order, settings migration, startup initialization
- `src/view/ExcalidrawView.ts`: very large, stateful, performance-sensitive, and central to user behavior
- `src/core/managers/PackageManager.ts`: shared runtime evaluation, host registration, and cross-window lease/alias lifetime
- `src/lang/helpers.ts`: build-token compatibility for compressed locales
- AI/provider settings and persisted credentials handling
- PDF/export code paths and Electron/Obsidian-specific integrations

If a task touches any of the above, read adjacent code first and validate more carefully than usual.

## Validation Expectations

Use the layered test commands and explicit acceptance limits documented below. Fast/source tests, built artifacts, native integration and physical devices establish different evidence.

### Required regression coverage and execution

Follow the mandatory [validation requirements](CODING_STANDARDS.md#validation-requirements). The testing guides below define commands and native environments.

### Obsidian CLI runtime lane

Resolve recoverable dependency, host-request, menu-renderer and cleanup failures and rerun failed/blocked cases before returning. Follow [native failure recovery](docs/OBSIDIAN_RUNTIME_TESTING.md#recovering-from-native-test-failures); ask the maintainer promptly when an actual human prerequisite prevents progress.

Start with the layered [testing guide](docs/TESTING.md) and [Obsidian runtime testing](docs/OBSIDIAN_RUNTIME_TESTING.md). Use `npm run test:native` to prepare and test `.test-work/vaults/excalidraw-auto-test/`. Every native sequence builds selected workspace revisions, freezes and hash-verifies the plugin and available Extras artifacts, installs and enables them, applies the immutable seed's settings, verifies the running CLI vault/config identity and restores the declared baseline. Use the matching local fork when available. Never reuse stale installed builds. Missing Extras is explicit and cannot satisfy Extras-dependent coverage. Serialize preparation, deployment, scenarios and cleanup under the shared application-user-data lock. Specific maintained scripts remain tested in ea-scripts; focus here on core Excalidraw and ExcalidrawAutomate. Inventory and screenshots do not establish behavior; missing important matrix cases remain unfinished.

The marker-owned repository-local vault is the native target. Do not fall back to a personal/default vault or the historical desktop `excalidraw-test` vault. A first run prepares actual plugin files before reporting Obsidian's one-time opening, community-plugin trust or CLI registration prerequisite. Subsequent runs need no manual plugin copying, enabling or service configuration. Keep fixtures/configuration in the immutable seed and generated binaries in the ignored working vault. Preserve markers, canonical path checks and unsettled work on tooling deadlines; a test deadline does not cancel native PDF printing. Whole-app restart still requires proof of an isolated single-vault application session.

Use the test-only `scripts/testing/host/processTools.mjs` for native launches. Windows captures output through `Obsidian.com`; long or multiline Windows evals use an owned temporary UTF-8 script and are cleaned up after each call. Oversized evals on any desktop platform use that script handoff to avoid OS argument limits. Keep transport-response deadlines separate from operation completion; recover only exact completed receipts without replaying mutations. npm and Yarn launch through JavaScript entries using the current Node executable, avoiding Windows `.cmd` shims. Run CLI scenarios serially. If a request times out, check for a pending Obsidian error/trust dialog; ask the user to save and restart when necessary rather than force-closing an application with other vaults open. Record Windows and macOS live validation separately.

Use this lane after fork behavior or packaging changes when Obsidian is available, then exercise the affected workflow using the fork's V03–V11 validation gates. A blank-drawing smoke does not validate raw text, clipboard, font/image assets, saved scenes, custom pens, popout migration, offline behavior, or physical mobile touch. Record what was tested, artifact/source identity, and any pending or unavailable gates. Never deploy a local build to a personal/default vault as a substitute for the named test vault. Keep CLI eval access to internal plugin instances and temporary test controllers out of production modules.

Repo-wide ESLint currently reports a large backlog of pre-existing issues, so it is not yet a blocking pass/fail gate for every task.

Primary validation commands:

```bash
npm run code
npm run build
```

Additional useful commands:

```bash
npm run lib
npm run build:mathjax
npm run build:all
npm run madge
npm run doc
```

Validation guidance:

- After every code modification, run `npm run build` before starting the next checkpoint. Treat new build errors or warnings relative to the recorded baseline as blockers and report relevant existing warnings accurately.
- Treat `eslint.config.cjs` as the quality bar for all new and modified code.
- Use lint results to avoid introducing new violations in touched files, even if repo-wide lint still fails because of unrelated backlog.
- `npm run code` is useful for visibility, but a failing repo-wide run does not by itself mean your change is invalid if the failures are pre-existing and unrelated.
- Run `npm run build` for anything that can affect bundle integrity, runtime injection, or production output.
- Run `npm run lib` if you touch the public/library API surface.
- Run `npm run build:mathjax` or `npm run build:all` if you edit `MathjaxToSVG/`.
- Run `npm run madge` after structural import changes or when touching shared architecture.
- Compare Madge and Rollup circular-dependency results only with their own baselines. Madge enumerates overlapping elementary paths and can include type-only imports, while Rollup reports runtime bundle cycles; their raw counts are not directly comparable.
- When the customized Excalidraw source changes, run its `yarn build:obsidian`, refresh the four local package artifacts, and then run this repository's production and relevant development builds. A plugin build against the old installed artifact does not validate the component change.
- For host-boundary changes, run the fork's focused adapter tests without Obsidian, then validate plugin registration and teardown through cold startup, plugin reload, the main window, a new and restored popout, and window removal. Confirm adapter methods observe settings changed after registration.
- After React/package-loading changes, validate cold startup, plugin reload, the main window, new and restored popouts, and moving a leaf between windows. Confirm that no `window.React` or `window.ReactDOM` global was introduced.
- After Radix/portal changes, validate visibility, positioning, stacking, click-outside, and Escape handling in both the main window and a popout; include mobile when viewport collision behavior can differ.
- Record `dist/main.js` byte size after packaging changes and report remaining headroom under the 5 MB release target: 5 × 1024 × 1024 = 5,242,880 bytes.
- Prefer targeted diagnostics for the files you touched when repo-wide lint noise obscures signal.
- Prefer `npm run build` plus targeted file diagnostics over raw `tsc --noEmit` as the primary gate. Standalone `tsc` can surface large volumes of dependency-typing noise unrelated to touched files.
- Do not treat `dist/` output edits as source fixes.


## Practical Agent Guidance

**All changes must consider the full codebase, not just the immediate file or local context.**

- Before making or validating any change, agents must proactively search for all dependencies, references, and affected code across the repository. This includes:
	- Searching for all usages, imports, and related patterns (e.g., property access, type assertions, function calls, etc.)
	- Considering both direct and indirect consumers of the changed code or types
	- Reviewing all files that may be impacted by a type, interface, or API change
- Never assume a change is local unless you have verified, by search or analysis, that no other code is affected.
- After making a change, validate the relevant build and compare errors and warnings with the recorded baseline. Touched files must not introduce new diagnostics.
- Prefer minimal, local changes when possible, but never at the expense of breaking global correctness or introducing subtle bugs elsewhere.
- Avoid reformatting large files unless necessary.
- Do not edit generated `dist/` or `lib/` outputs by hand.
- Assume undocumented behavior may still be intentional.
- For new code, follow the target naming conventions even if nearby legacy files do not yet.
- When a change looks odd, search for the constraint that explains it before removing it.
- When in doubt, preserve startup performance, popout support, and existing vault compatibility.

### Type Consolidation Follow-through

Follow the [type consolidation requirements](CODING_STANDARDS.md#type-consolidation-follow-through).

**Summary:**

> Agents must always consider the full codebase impact of any change, proactively search for dependencies and affected code, and validate correctness globally—not just locally—before considering a task complete.

## Default Stance For Future Prompts

Follow [CODING_STANDARDS.md](CODING_STANDARDS.md) for implementation, review,
compatibility, documentation, localization, and validation requirements. Preserve
repository-specific lifecycle and build constraints described in this guide.
