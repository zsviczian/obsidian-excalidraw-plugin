# Obsidian Excalidraw Plugin Agent Guide

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

- React and ReactDOM
- a JSX runtime shim for compatibility
- the customized `@zsviczian/excalidraw` package
- `MathjaxToSVG`
- `lz-string`
- selected compressed locale payloads

These payloads are executed or unpacked at runtime. This is intentional.

### Popout Window Support

- `src/core/managers/PackageManager.ts` manages window-scoped React/ReactDOM/Excalidraw packages.
- This is necessary because the plugin must work in Obsidian/Electron popout windows.
- Do not replace this with a naive global singleton approach.

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

### Safe URL Tokenization

- Safe URLs are centralized in `src/constants/safeUrls.ts`.
- The build tokenizes URL constants and resolves them at runtime.
- If you change safe URL handling, rebuild and verify both token emission and token resolution.

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

## Naming And Placement Conventions

Treat the following as the target convention for all new code and for any future naming-cleanup pass. The current repository contains legacy exceptions. Do not rename files opportunistically inside behavior changes; do naming cleanup in a dedicated, compatibility-aware refactor.

### File And Symbol Naming

- Use PascalCase filenames when the file's main export is a class, React component, modal, manager, view, or similarly named object with clear identity. The filename should match the primary export. Examples already in the repo include `ExcalidrawView.ts`, `CommandManager.ts`, and `ReleaseNotes.ts`.
- Use lowerCamelCase filenames for helper and utility modules whose main exports are functions or small related helpers. Examples already in the repo include `fileUtils.ts`, `pathUtils.ts`, and `exportUtils.ts`.
- Use lowerCamelCase filenames for grouped type modules unless the file is intentionally mirroring an externally established name.
- Use PascalCase for classes, React components, dialogs, managers, views, interfaces, and domain-level type aliases.
- Use lowerCamelCase for functions, methods, variables, parameters, and object properties.
- Use UPPER_SNAKE_CASE for exported constants and locale keys.
- Keep persisted settings keys, serialized fields, and frontmatter keys stable and lowerCamelCase unless an explicit migration is added.
- For future rename work, fix typos and inconsistent acronym casing in a dedicated pass rather than mixing those renames with behavior changes. Existing examples worth normalizing later include files such as `YoutTubeUtils.ts`, `modifierkeyHelper.ts`, and `TTDDialogPersistanceAdater.ts`.

### Folder Placement Guide

- `src/core/`: plugin bootstrap, plugin-wide lifecycle, registration, settings, and orchestration. If a change affects the plugin globally rather than a single open view, start here.
- `src/core/managers/`: plugin-global coordinators that own subscriptions, registration, or lifecycle-managed behavior.
- `src/core/editor/`: markdown/editor bridge behavior and editor-specific UX.
- `src/view/`: the live Excalidraw pane and view-owned behavior.
- `src/view/components/`: React components rendered inside the main Excalidraw view or tightly coupled to `ExcalidrawView` state.
- `src/view/managers/`: view-scoped controllers that belong to a single view instance rather than the whole plugin.
- `src/view/sidepanel/`: sidepanel-only view code.
- `src/shared/`: reusable subsystems used by multiple areas such as `core`, `view`, scripting, import/export, or dialogs.
- `src/shared/Dialogs/`: Obsidian modals, prompts, release-note content, and user-facing dialog flows. `src/shared/Dialogs/Messages.ts` is the source for next-version change messages shown to users.
- `src/shared/components/`: reusable UI helpers that are not owned solely by the main Excalidraw view.
- `src/shared/Suggesters/`: suggestion modals and suggestion-specific helpers.
- `src/shared/Workers/`: worker entrypoints and worker-specific helper code.
- `src/shared/OCR/`: OCR integrations and OCR-specific logic.
- `src/shared/svgToExcalidraw/`: SVG parsing and import pipeline code.
- `src/utils/`: side-effect-light helpers. If a module owns long-lived state, subscriptions, or plugin/view lifecycle, it likely does not belong in `utils`.
- `src/constants/`: shared constants, icon definitions, startup content, and URL registries. Keep logic here minimal and obvious.
- `src/types/`: shared TypeScript contracts and ambient declarations, not implementation logic.
- `src/lang/locale/`: user-visible strings. `en.ts` is the source of truth for new keys.
- `MathjaxToSVG/`: a separate subproject with its own build and runtime role. Treat it as an independent package with the same documentation and compatibility expectations as the main plugin.

## Documentation Standard

Use TSDoc as the documentation standard. It is the modern TypeScript-friendly evolution of JSDoc and is the right fit for this repository; do not think in terms of JavaDoc for TS code.

- Require TSDoc for exported classes, exported functions, public methods, public library APIs, and non-obvious modules.
- Public APIs in `src/core/index.ts` and `src/shared/ExcalidrawAutomate.ts` should always have complete TSDoc.
- Settings migrations, compatibility shims, build-time tokenization code, and package-loading code should also carry clear high-signal documentation.
- Add short module-level documentation to files whose behavior is easy to misread, such as `rollup.config.mjs`, `src/core/managers/PackageManager.ts`, migration code in `src/core/main.ts`, and the `MathjaxToSVG/` subproject.
- Internal/private code should only be commented when the behavior is non-obvious. Avoid trivial comments.

## Backward Compatibility Requirements

Backwards compatibility is a strong requirement in this repository.

- Do not break persisted settings, serialized scene data, frontmatter keys, command IDs, or documented user workflows without an explicit migration or compatibility layer.
- Do not rename public API methods, script-engine entry points, or library exports casually. `src/core/index.ts` and `src/shared/ExcalidrawAutomate.ts` are especially sensitive.
- Naming-only refactors must preserve observable behavior.
- If a rename reaches beyond a purely internal import graph, prefer temporary aliases, re-exports, or compatibility wrappers during migration.
- If settings shape or stored values change, update defaults, settings UI, load/save flow, and migration logic together.
- Assume user scripts, vault content, templates, embeds, release-note references, and community documentation may depend on existing names and behavior.

## User-Facing Change Workflow

- Every user-visible change intended for the next release should be documented in `src/shared/Dialogs/Messages.ts` under the next upcoming version key.
- Keep `Messages.ts` entries concise, user-facing, and focused on observable behavior, not implementation detail.
- If a change affects scripting, API behavior, settings, or migration, mention that explicitly in the release-note entry.
- Every new user-visible language string must be added first in `src/lang/locale/en.ts`.
- The same change must also update `src/lang/locale/ru.ts`, `src/lang/locale/es.ts`, `src/lang/locale/zh-cn.ts`, and `src/lang/locale/zh-tw.ts`.
- These maintained locales are part of the build-time localized bundle path, so they are not optional follow-up work.
- Preserve locale key names and the existing comment grouping by owning file or subsystem.
- If a string contains URLs or runtime-dependent tokens, follow the existing locale patterns so build-time tokenization and runtime resolution continue to work.

## React Runtime Import Model

React usage in this repository is special because React and ReactDOM are package-managed per window to support Obsidian popout windows and runtime package injection.

- It is fine to import React for types, component definitions, JSX compilation, and nearby established patterns.
- Do not assume a single global React/ReactDOM runtime is safe for rendering, root creation, or view-owned objects.
- For view-bound rendering and roots, follow `src/view/ExcalidrawView.ts` and use `view.packages.react` and `view.packages.reactDOM` through the package-manager flow.
- For view-owned React objects such as refs or runtime-created elements, follow neighboring patterns such as `src/view/components/menu/ToolsPanel.tsx` and `src/view/components/CustomEmbeddable.tsx`, which intentionally use the package-managed React instance.
- Do not introduce a new direct `ReactDOM.createRoot()` path outside the package-manager model unless you have verified popout-window safety.
- Before adding or refactoring a React file, inspect the nearest existing file in that area and match its import/runtime pattern.

## Where To Make Changes

Use this routing guide before editing.

- Startup, lifecycle, readiness, plugin-wide state: `src/core/main.ts`
- Public/library API surface: `src/core/index.ts`
- Settings schema/defaults/UI: `src/core/settings.ts`
- Commands and command registration: `src/core/managers/CommandManager.ts`
- Vault or workspace event handling: `src/core/managers/EventManager.ts` and `src/core/managers/FileManager.ts`
- Markdown rendering or markdown embeds: `src/core/managers/MarkdownPostProcessor.ts`
- Package/runtime loading across windows: `src/core/managers/PackageManager.ts`
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

## Script Engine And Automation Notes

- Excalidraw Automate is a major public surface of this project.
- `src/shared/ExcalidrawAutomate.ts` is large and high-impact.
- `src/shared/Scripts.ts` loads and manages vault-based scripts.
- Example and user-facing docs live in `AutomateHowTo.md`, `docs/ExcalidrawScriptsEngine.md`, `docs/API/`, and `ea-scripts/`.
- If you change public automation behavior, consider whether docs or the library build need updates.

## High-Risk Areas

These areas require extra care:

- `rollup.config.mjs`: payload injection, localization, manifest/versioning, CSS bundling
- `src/core/main.ts`: lifecycle order, settings migration, startup initialization
- `src/view/ExcalidrawView.ts`: very large, stateful, performance-sensitive, and central to user behavior
- `src/core/managers/PackageManager.ts`: cross-window package loading and runtime evaluation
- `src/lang/helpers.ts`: build-token compatibility for compressed locales
- AI/provider settings and persisted credentials handling
- PDF/export code paths and Electron/Obsidian-specific integrations

If a task touches any of the above, read adjacent code first and validate more carefully than usual.

## Validation Expectations

There is no standard unit-test suite wired into `package.json`.

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

- Treat `eslint.config.cjs` as the quality bar for all new and modified code.
- Use lint results to avoid introducing new violations in touched files, even if repo-wide lint still fails because of unrelated backlog.
- `npm run code` is useful for visibility, but a failing repo-wide run does not by itself mean your change is invalid if the failures are pre-existing and unrelated.
- Run `npm run build` for anything that can affect bundle integrity, runtime injection, or production output.
- Run `npm run lib` if you touch the public/library API surface.
- Run `npm run build:mathjax` or `npm run build:all` if you edit `MathjaxToSVG/`.
- Run `npm run madge` after structural import changes or when touching shared architecture.
- Prefer targeted diagnostics for the files you touched when repo-wide lint noise obscures signal.
- Do not treat `dist/` output edits as source fixes.

## Practical Agent Guidance

- Start from the narrowest owning abstraction, not from broad repo-wide searches.
- Prefer minimal, local changes.
- Avoid reformatting large files unless necessary.
- Do not edit generated `dist/` or `lib/` outputs by hand.
- Assume undocumented behavior may still be intentional.
- For new code, follow the target naming conventions even if nearby legacy files do not yet.
- When a change looks odd, search for the constraint that explains it before removing it.
- When in doubt, preserve startup performance, popout support, and existing vault compatibility.

## Type System And Type Refactoring

Replacing `any` types is a precision task requiring understanding of the codebase's type architecture and constraints.

### Core Principles

When replacing `any` types:

- **Functional equivalence is non-negotiable**: Code must remain 100% functionally identical. Type changes are *only* for TypeScript type checking, never for runtime behavior changes.
- **Never invent local types**: If a type can be inferred from existing usage, Excalidraw types, or Obsidian APIs, use it. Do not create ad-hoc interface definitions.
- **Do not replace with `unknown`**: `unknown` is stricter than `any` and will require guards/assertions elsewhere, breaking functional equivalence. The goal is precision, not strictness.
- **Use existing infrastructure**: Extend `src/types/types.d.ts` for Obsidian unpublished APIs, create new files in `src/types/` that build on existing conventions, and reference Excalidraw types directly.

### Type Files And Responsibilities

- **`src/types/types.d.ts`**: Ambient module declarations and Obsidian unpublished API types. This is the standard location for extending Obsidian's type system and for global type declarations. Use the existing patterns (interfaces extending `obsidian` module interfaces) consistently.
- **`src/types/excalidrawLib.ts`** (or similar): When creating new type files for project-specific types, place them in `src/types/` and use PascalCase for files that export types or interfaces.
- **Type files in subsystem directories**: Files like `src/shared/ExcalidrawAutomate.ts` may carry substantial type definitions and exports alongside implementation. Do not move these without evaluating the impact on the public API surface.
- **Leverage existing type files**: Consult `src/types/excalidrawLib.ts` for the current Excalidraw type model before adding new Excalidraw-derived types.

### Excalidraw Type Integration

- Do not invent wrapper types for Excalidraw entities. Reference the customized `@zsviczian/excalidraw` types directly.
- Build on existing type extensions in the codebase (e.g., `src/types/types.d.ts` may already extend Excalidraw types).
- When a type depends on Excalidraw internals, document the dependency clearly so future changes to the fork are visible.
- Obsidian unpublished API types often interact with Excalidraw components; model these intersections carefully in `src/types/types.d.ts`.

### Inference And Scanning Workflow

To identify the correct type for an `any` reference:

1. **Scan usage**: Identify all sites where the value is used. Determine what properties, methods, or operations are performed on it.
2. **Check existing types**: Search `src/types/`, the Excalidraw type definitions (via node_modules), and Obsidian API typings for matching types.
3. **Check upstream patterns**: Look at similar usage patterns elsewhere in the codebase. How are comparable values typed?
4. **Intersect constraints**: The correct type must support all observed operations. If multiple possible types exist, choose the one that is most specific without inventing new constraints.
5. **Test narrowing**: If the type was `any`, code may not have type guards. Ensure that replacing `any` with a more specific type does not require adding guards or assertions that change behavior.

### Common Patterns

- **DOM elements and jQuery-like objects**: Often `any` when they should be `HTMLElement`, `HTMLDivElement`, `Element`, etc. Check `src/utils/` and view components for examples.
- **Obsidian unpublished APIs**: Frequently `any` because the official typings are incomplete. Add to `src/types/types.d.ts` to model the actual shape based on Obsidian source or runtime inspection.
- **Excalidraw component state and config objects**: Usually `any` but should reference `ExcalidrawProps`, `AppState`, or similar exported by `@zsviczian/excalidraw`.
- **Event handler parameters and callbacks**: Often `any` but should be typed based on what the callback receives. Check invocation sites.
- **Imported worker or third-party runtime objects**: May be `any` if the package lacks types. Create a minimal type stub in `src/types/` if needed, or use `as const` to infer from a known shape.

### Adding Obsidian Unpublished API Types

When documenting an unpublished Obsidian API in `src/types/types.d.ts`:

- Use module declaration patterns already in the file (`declare module "obsidian" { interface App { ... } }`).
- Include a brief comment explaining the API or linking to the Obsidian source, if known.
- Only add properties and methods that are actually used in the codebase. Avoid speculative extensions.
- Be conservative: unpublished APIs can change; document the version or observation date if possible.
- Do not duplicate types; if Obsidian's types already define something, extend or refine, not redefine.

### Validation Approach

When replacing `any`:

1. **No new runtime errors**: Run the plugin in Obsidian after the change. Verify that all observed functionality works identically.
2. **TypeScript checking**: The change should reduce or eliminate TypeScript errors, not introduce new ones.
3. **No new guards or assertions**: If code previously worked with `any`, replacing it with a specific type should not require new `if` checks, `as` casts, or optional chaining that wasn't there before. If it does, the type choice is too strict.
4. **Build passes**: `npm run build` must succeed. Type changes can affect bundle outcome if they affect build-time inference.
5. **Lint cleanliness**: The changed file should not gain new lint violations. Use `npm run code -- src/path/to/file.ts` to check the specific file.

### When To Create A New Type File

- If a set of related types will be used across multiple modules and are not Obsidian or Excalidraw types, create a new file in `src/types/`.
- Name it to reflect its domain (e.g., `canvasTypes.ts`, `aiProviderTypes.ts`).
- Document the file's purpose and scope at the top with a brief module-level comment.
- Export types, not implementation. Do not put logic in type files.
- If the file re-exports types from Excalidraw or elsewhere, document the origin.

## Default Stance For Future Prompts

When you are asked to modify this repository:

- assume the current behavior exists for a reason
- favor root-cause fixes over superficial patches
- keep scope tight
- maintain backwards compatibility unless the task explicitly authorizes a breaking change
- validate with build plus lint-aware checks before declaring success
- do not introduce new lint violations in touched code, even if the full repo lint command still fails
- document user-visible changes in `src/shared/Dialogs/Messages.ts`
- add new language keys in `src/lang/locale/en.ts` and update `ru.ts`, `es.ts`, `zh-cn.ts`, and `zh-tw.ts` in the same change
- be especially careful around startup, build plumbing, localization tokenization, settings migration, and popout-window behavior

#### Custom Element Metadata (`customData`)

- All types and helpers for Excalidraw element `customData` (extensible metadata on elements, e.g., for LaTeX, PDF, image, or plugin-specific keys) are centralized in `src/utils/elementCustomDataUtils.ts`.
- If you need to add a new `customData` key, type, or helper, always add it to this file and import from here in all consumers. This avoids type duplication and ensures discoverability for future maintainers and agents.
- See `ExcalidrawCustomData`, `ExcalidrawCustomDataPatch`, `ExcalidrawPDFCustomData`, `ExcalidrawLatexCustomData`, and `addAppendUpdateCustomData` in that file for canonical patterns.
