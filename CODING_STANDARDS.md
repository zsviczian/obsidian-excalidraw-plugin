# Coding standards and mandatory practices

This is the canonical home for cross-cutting coding requirements in this repository.
Preserve existing behavior, prefer root-cause fixes, and keep scope tight.
Read it before implementing or reviewing changes. Add future requirements here and
link to the relevant section instead of duplicating rules in other guides.

[AGENTS.md](AGENTS.md) provides architecture, lifecycle constraints, task routing,
and agent workflows. [CONTRIBUTING.md](CONTRIBUTING.md) provides contributor setup,
build commands, and release procedures. Subsystem-specific constraints in those
guides remain mandatory alongside these standards.

## Timers, window ownership, and asynchronous work

- Use `window.setTimeout()` / `window.setInterval()` and the matching
  `window.clearTimeout()` / `window.clearInterval()` for coordination, persistence,
  retries, debouncing that survives migration, and promise settlement. In plugin
  modules, `window` is the main application window. `activeWindow`, a view's
  `ownerWindow`, or a DOM node's `defaultView` may be a popout that closes before
  its timer fires. This lifetime rule also applies on older Obsidian versions;
  improved hidden/minimized-window scheduling does not make a closed window run
  callbacks. See Obsidian's [timer rule](https://github.com/obsidianmd/eslint-plugin/blob/master/docs/rules/prefer-window-timers.md).
- Keep DOM creation, focus, event listeners, portals, observers, and rendering
  attached to the owning document/window. Choosing the main window as a timer
  source does not change the callback's DOM ownership.
- An owning-window timer may be used for disposable UI work that should stop
  with that window. Capture the scheduling window and use that same object to
  cancel the timer. Do not re-read a focus-following or migrated window getter
  during cleanup; timer IDs belong to their scheduling window.
- Clear timers and unregister listeners when their owning component unloads.
  Use Obsidian's `register*` cleanup helpers. Keep cleanup idempotent and avoid
  retaining completed-operation closures until plugin unload.
- A canceled timer does not settle its promise. Resolve or reject pending waits
  during cancellation so their `finally` blocks release listeners, semaphores,
  and global state. Check the original file/API/view identity and lifecycle
  after awaited work before changing a scene or starting a write.
- Migration waits must preserve synchronous source-root unmount before the first
  `await`. Stop UI reconstruction when the destination leaf/window has retired;
  retain the established persistence-handoff ownership rules in `AGENTS.md`.
- Use `requestAnimationFrame()` for rendering in its owning window, not as an
  unbounded persistence or cleanup clock. Awaited frame-based work that must
  finish in a hidden or closed window needs a main-window timeout fallback or
  explicit cancellation. A timer/task yield or frame callback is not proof of
  actual paint.

## Security, privacy, and compliance

Follow Obsidian's **Developer Policies** and **Plugin Guidelines**. In particular:

- Default to local/offline operation. Only make network requests when essential to the feature.
- No hidden telemetry. If you collect optional analytics or call third-party services, require explicit opt-in and document clearly in `README.md` and in settings.
- Keep every external origin and every fully static URL as a literal `https://...` string in source so reviewers and security scanners can identify the destination without executing the code. A dynamic resource path may be appended only to a literal base URL, and each untrusted path segment must be validated or encoded.
- Never conceal a network destination or evade a scanner finding by splitting or joining domain labels, deriving an origin from Git state, environment variables, runtime configuration, or character codes, or by encoding, compressing, encrypting, or otherwise transforming a URL. Do not weaken, suppress, or work around a scanner by making an endpoint less statically visible; fix the underlying behavior or document a genuine false positive transparently.
- Never execute remote code, fetch and eval scripts, or auto-update plugin code outside of normal releases.
- Minimize scope: read/write only what's necessary inside the vault. Do not access files outside the vault.
- Clearly disclose any external services used, data sent, and risks.
- Respect user privacy. Do not collect vault contents, filenames, or personal information unless absolutely necessary and explicitly consented.
- Avoid deceptive patterns, ads, or spammy notifications.
- Register and clean up all DOM, app, and interval listeners using the provided `register*` helpers so the plugin unloads safely.

## UX & copy guidelines (for UI text, commands, settings)

- Prefer sentence case for headings, buttons, and titles.
- Use clear, action-oriented imperatives in step-by-step copy.
- Use **bold** to indicate literal UI labels. Prefer "select" for interactions.
- Use arrow notation for navigation: **Settings → Community plugins**.
- Keep in-app strings short, consistent, and free of jargon.

## DOM Styling And Visibility

- Prefer Obsidian's established classes such as `mod-warning` before adding plugin-specific CSS. Consult the Obsidian CSS variables and component conventions when styling settings or dialogs.
- Never use `document.createElement()`, `Document.createElement()`, or `Document.createDocumentFragment()`. Prefer Obsidian's `createEl()`, `createDiv()`, `createSpan()`, `createSvg()`, and `createFragment()` helpers, following these established patterns:
  - Create detached typed rendering elements whose owning document is irrelevant through a fragment, for example `const canvas = createFragment().createEl("canvas")` or `const image = createFragment().createEl("img")`.
  - Before creating a temporary wrapper solely for serialization, check whether the consumer accepts a `DocumentFragment` or DOM node directly. For example, `htmlToMarkdown()` accepts a fragment; clone and transform that detached tree before passing it to the consumer. Do not substitute `XMLSerializer` without verifying that its XML serialization is equivalent to the required HTML representation.
  - Register known runtime font sources through document-scoped `FontFace` objects and `document.fonts.add()`/`delete()`. Preserve descriptors such as `unicodeRange`, retain each face for replacement and cleanup, and do not build a generic CSS parser merely to translate arbitrary stylesheet text into `FontFace` objects.
  - `setCssProps()`/`setCssStyles()` are suitable for dynamic declarations on one element, not for CSS requiring selectors, pseudo-elements, at-rules, or arbitrary rule text. Creating the same `<style>` through `createEl("style")` does not resolve the separate CodeScanner policy finding for dynamic style elements.
- `deliberateCreateElement`, injected by `rollup.config.mjs`, is restricted to the remaining reviewed `<style>` cases: document-scoped runtime stylesheets that cannot be represented as element declarations, and styles that must belong to an iframe's `contentDocument`, where Obsidian's DOM helpers are not installed. Do not broaden this exception without first exhausting the patterns above and documenting why document-specific native creation is intrinsic. Track the upstream policy discussion in [obsidianmd/eslint-plugin#196](https://github.com/obsidianmd/eslint-plugin/issues/196).
- Use semantic interactive elements and Obsidian's event helpers. Link-like navigation should use a real anchor, not a button merely styled as a link; use `onClickEvent` when applying custom navigation behavior. Validate touch interactions on a physical mobile device because desktop mobile emulation proves layout, not native touch activation.
- When a control already has a styled tooltip, do not also set an HTML `title` attribute. Keep its accessible name in `aria-label`; `title` produces a second native Chromium/Electron tooltip and must not replace accessible labeling.
- Do not write an element's `style` attribute directly. Use `setStyle` and `removeStyle` from `src/utils/styleUtils.ts` when a dynamic inline style is genuinely necessary.
- Use the existing visibility helpers instead of the native `hidden` property or attribute, which is not reliable in Obsidian's styled UI. Choose `hideElement`/`showElement` or `setComponentVisibility` from `src/utils/styleUtils.ts`, or `setElementHidden`/`setElementDisplay` from `src/utils/htmlUtils.ts` when a boolean/display-oriented API is clearer.
- Search `src/utils/styleUtils.ts` and `src/utils/htmlUtils.ts` before introducing new DOM styling helpers or display classes.
- Run Obsidian CodeScanner after CSS changes. Preserve compatibility with the declared minimum Obsidian version and prefer a widely supported property when it provides the same result; for example, a basic underline is preferable to optional underline-thickness/offset styling.
- For a known vault path, use the most specific synchronous lookup: `app.vault.getFolderByPath()` for folders and `app.vault.getFileByPath()` for files. Use `getAbstractFileByPath()` only when either type is intentionally accepted, and avoid adapter-level existence checks when the Vault API already models the target.
- Radix content in the customized Excalidraw package may be rendered through `ObsidianRadixPortal` directly under the owning document's body. A body portal escapes component ancestor selectors and modal stacking contexts. When a trigger is visible but its menu or popover is not, first inspect whether the content mounted behind a modal or lost ancestor-scoped styles. Use a class on the portaled content, a portal-safe selector, and an explicit stacking level when required; validate main-window, popout, click-outside, and Escape behavior.

## Performance

- Keep startup light. Defer heavy work until needed.
- Avoid long-running tasks during `onload`; use lazy initialization.
- Batch disk access and avoid excessive vault scans.
- Debounce/throttle expensive operations in response to file system events.
- For temporary performance diagnostics, use a unique searchable prefix and
  emit one copyable string per event rather than logging expandable objects.
  Keep timing-only callbacks and state isolated from production behavior.
- Distinguish synchronous API duration, queue completion, browser-task yields,
  animation-frame callbacks, and actual paint; none is a substitute for the
  others when explaining perceived latency.
- Temporary diagnostics are not product observability. Do not log vault
  contents, and include filenames only when the maintainer explicitly needs
  per-file attribution. Remove the diagnostics before commit and search both
  `src/` and the built `dist/main.js` for their prefix.

## Coding conventions

- TypeScript with `"strict": true` preferred.
- **Keep `main.ts` minimal**: Focus only on plugin lifecycle (onload, onunload, addCommand calls). Delegate all feature logic to separate modules.
- **Split large files**: If any file exceeds ~200-300 lines, consider breaking it into smaller, focused modules.
- **Use clear module boundaries**: Each file should have a single, well-defined responsibility.
- Bundle everything into `main.js` (no unbundled runtime deps).
- Avoid Node/Electron APIs if you want mobile compatibility; set `isDesktopOnly` accordingly.
- Prefer `async/await` over promise chains; handle errors gracefully.

## Mobile

- Don't assume desktop-only behavior unless `isDesktopOnly` is `true`.
- Avoid using desktop only objects and functions such as Node Buffer, SharedArrayBuffer, etc. For the special case when this is required, make proper mobile safe guards.
- Avoid large in-memory structures; be mindful of memory and storage constraints.
- Treat a physical phone or tablet as a separate validation environment for touch targets, synthesized clicks, scrolling gestures, focus, and the mobile WebView. Desktop mobile emulation is useful for responsive layout checks but is not a substitute for real touch testing.

## Agent do/don't

**Do**

- Add commands with stable IDs (don't rename once released).
- Provide defaults and validation in settings.
- Write idempotent code paths so reload/unload doesn't leak listeners or intervals.
- Use `this.register*` helpers for everything that needs cleanup.

**Don't**

- Introduce network calls without an obvious user-facing reason and documentation.
- Ship features that require cloud services without clear disclosure and explicit opt-in.
- Store or transmit vault contents unless essential and consented.

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
- The paired plugin-to-fork host protocol is the deliberate exception described above: coordinate and version breaking contract changes instead of preserving fallbacks for mismatched package versions.

## User-Facing Change Workflow

### Release notes in `Messages.ts`

`src/shared/Dialogs/Messages.ts` is shown directly to end users. Treat the upcoming version entry as a short, curated account of the final release, not a commit log or an implementation checklist.

- Select significant new capabilities, useful workflow improvements, important fixes to released behavior, and actions users must take. A code change does not automatically need an entry.
- Consolidate related work into one concise outcome. When refining an unreleased feature, update its existing description; do not add separate bullets for interim bugs, test discoveries, edge cases or follow-up fixes that users never received.
- Omit internal refactors, test/build work, lifecycle mechanisms and routine defensive fixes such as autosave rejection recovery. Keep technical reasoning and incremental history in PRs, issues, tests and developer documentation.
- Lead with what users can do or what noticeable problem is resolved. Prefer one short sentence per bullet; add a second only for a necessary action, compatibility warning or important limitation. Avoid repeating one feature under UI, CLI and API headings.
- Mention API or scripting changes only when they provide a meaningful capability or require users to adapt. Keep signatures, parameters, protocol versions, return structures and code examples in API documentation and `SuggesterInfo.ts`, not release notes.
- Edit only the upcoming release entry unless historical corrections are explicitly requested. Before handoff, reread that entire entry and remove duplication and implementation detail. Preserve useful issue links without requiring one bullet per issue.

### Localized interface strings

- Do not hardcode English strings in UI components or logic. Put user-facing
  strings in the localization files under `src/lang/locale/`.

- Every new user-visible language string must be added first in `src/lang/locale/en.ts`.
- The same change must also update `src/lang/locale/ru.ts`, `src/lang/locale/es.ts`, `src/lang/locale/zh-cn.ts`, and `src/lang/locale/zh-tw.ts`.
- These maintained locales are part of the build-time localized bundle path, so they are not optional follow-up work.
- Preserve locale key names and the existing comment grouping by owning file or subsystem.
- If a string contains URLs or runtime-dependent tokens, follow the existing locale patterns so build-time tokenization and runtime resolution continue to work.

## React Runtime Import Model

React usage in this repository is special because one compressed private React/ReactDOM runtime is package-managed across main-window and popout roots.

- It is fine to import React for types, component definitions, JSX compilation, and nearby established patterns. The plugin build resolves those imports through the inflated private runtime; the library build and separately built Excalidraw artifact keep React external.
- The shared runtime is safe only because each root and Excalidraw instance receives stable owner-document state. Never recover view ownership from the runtime's lexical main window.
- For view-bound rendering and roots, follow `src/view/ExcalidrawView.ts` and use `view.packages.react` and `view.packages.reactDOM` through the package-manager flow.
- For view-owned React objects such as refs or runtime-created elements, follow neighboring patterns such as `src/view/components/menu/ToolsPanel.tsx` and `src/view/components/CustomEmbeddable.tsx`, which intentionally use the package-managed React instance.
- Do not introduce a new direct `ReactDOM.createRoot()` path outside the package-manager model unless you have verified popout-window safety.
- Before adding or refactoring a React file, inspect the nearest existing file in that area and match its import/runtime pattern.

## Type System And Type Refactoring

### Type Consolidation Follow-through

- Treat user requests like "tiny follow-up" or "do this consolidation" as end-to-end tasks: complete extraction, replace all known duplicates, and remove local leftovers in the same pass.
- When a type is used in more than one module, prefer a shared definition in `src/types/` and import it everywhere instead of repeating local aliases.
- For scope-local inline types (for example inside a processor or callback), quickly verify whether the shape already exists elsewhere before keeping or adding a local declaration.
- Example: if `RemoteDirectoryInfo` is used in both `src/utils/utils.ts` and `src/core/main.ts`, define it once in `src/types/githubTypes.ts`, update both imports, and delete both local aliases in the same change.
- After type-only consolidations, run targeted diagnostics on touched files plus `npm run build`, and confirm no runtime behavior was intentionally changed.


Replacing `any` types is a precision task requiring understanding of the codebase's type architecture and constraints.

### Core Principles

When replacing `any` types:

- **Functional equivalence is non-negotiable**: Code must remain 100% functionally identical. Type changes are *only* for TypeScript type checking, never for runtime behavior changes.
- **Never invent local types**: If a type can be inferred from existing usage, Excalidraw types, or Obsidian APIs, use it. Do not create ad-hoc interface definitions.
- **Do not replace with `unknown` by default**: `unknown` is stricter than `any` and often requires guards/assertions elsewhere, which can break functional equivalence.
- **Exception for bridge casts**: In rare generic conditional return scenarios where TypeScript cannot express a provably equivalent return value, a narrow `as unknown as ...` bridge cast is acceptable. Keep it local, document why, and do not use it to bypass real type mismatches.
- **Use existing infrastructure**: Extend `src/types/types.d.ts` for Obsidian unpublished APIs, create new files in `src/types/` that build on existing conventions, and reference Excalidraw types directly.

### CRITICAL: Behavioral Change Detection When Replacing `any`

**Type replacements that appear to be "type-only" can introduce subtle runtime behavior changes. You must proactively detect and flag these before finalizing any change.**

#### Behavior-Altering Patterns

When scanning code that uses a value currently typed as `any`, watch for these patterns that can be affected by a type change:

1. **Falsy/Truthy checks**: `if (!value)`, `if (value)`, `value ? ... : ...`
   - **Risk**: If the original code treats `0`, `""`, `false`, `null`, `undefined`, or `[]` as falsy, and you infer a type that allows these values, behavior changes.
   - **Example**: Old code `if (!offset)` rejects `offset === 0`. New type `offset: number` allows `0`, fundamentally changing behavior for edge cases.
   - **Action**: If the code has falsy checks, document that behavior explicitly in your change notes to the user.

2. **Existence checks**: `if (value === undefined)`, `if (value === null)`, `if (value)`
   - **Risk**: Changing from accepting `any` (including undefined) to a narrower type may exclude valid edge cases.
   - **Action**: Verify all call sites provide values matching the new type constraint.

3. **Optional chaining with falsy fallbacks**: `value?.prop ?? default`, `value?.prop ?? fallback`
   - **Risk**: The fallback behavior may change if the inferred type rules out falsy intermediate values.
   - **Action**: Test that fallback behavior is identical.

4. **Conditional logic on properties**: `if (obj.prop)`, `switch (obj.type)`, loops over `obj`
   - **Risk**: Narrowing from `any` to a specific object shape might exclude properties the runtime code depends on.
   - **Action**: Verify the inferred type shape includes all properties actually accessed.

#### Mandatory Pre-Change Verification

Before replacing an `any` type:

1. **Scan all usages** of the value (especially the entire function or component containing it).
2. **Identify falsy/truthy checks** or conditional logic that depends on the value.
3. **Compare semantics**: Does the old behavior permit `0`, `""`, `false`, `null`, or `undefined` in a way the new type might not?
4. **If a behavior change is introduced**: Explicitly document it in a comment in the code AND flag it to the user BEFORE considering the task complete.
5. **Document edge cases** that the type change affects.

#### Examples of Correct vs. Incorrect Replacements

**INCORRECT** (behavioral change, not flagged):
```typescript
// Old: const value: any = ...; if (!value) return null;
// New: const value: number = ...; if (typeof value !== "number") return null;
// Problem: Old code rejects 0, new code accepts 0. Behavior changed silently.
```

**CORRECT** (behavioral change, explicitly flagged):
```typescript
// Old: const offset: any = ...; if (!offset) return null;
// New: const offset: number = ...; if (typeof offset !== "number") return null;
// Flagged: "Note: This change now allows offset=0 (previously rejected as falsy).
//           This is intentional and fixes a bug where block IDs could not be inserted at file start."
```

**CORRECT** (no behavioral change):
```typescript
// Old: const frame: any = ...; if (frame.type === "frame" && !frame.isDeleted) ...
// New: const frame: { type: string; isDeleted?: boolean } = ...; if (frame.type === "frame" && !frame.isDeleted) ...
// OK: Inferred type supports all operations, no falsy checks introduced, behavior identical.
```

### Type Files And Responsibilities

- **`src/types/types.d.ts`**: Ambient module declarations and Obsidian unpublished API types. This is the standard location for extending Obsidian's type system and for global type declarations. Use the existing patterns (interfaces extending `obsidian` module interfaces) consistently.
- **`src/types/excalidrawLib.d.ts`**: Ambient declarations for the evaluated `window.ExcalidrawLib` runtime. Derive declarations from published fork types where possible, and keep the file lowerCamelCase in line with grouped type-module naming.
- **Type files in subsystem directories**: Files like `src/shared/ExcalidrawAutomate.ts` may carry substantial type definitions and exports alongside implementation. Do not move these without evaluating the impact on the public API surface.
- **Leverage existing type files**: Consult `src/types/excalidrawLib.d.ts` and the installed fork declarations for the current Excalidraw type model before adding new Excalidraw-derived types.

### Excalidraw Type Integration

- Do not invent wrapper types for Excalidraw entities. Reference the customized `@zsviczian/excalidraw` types directly.
- Before defining a plugin-local union or interface for a fork concept, search the published fork declarations and import or alias the canonical type. Ambient runtime bridges should reuse those types rather than duplicate their structure.
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
- **Scene boundary typing (`getScene()` vs persistence sync)**: Scene producers may return readonly/non-deleted element arrays while persistence code mutates scene internals. Prefer broader input types at boundary methods (e.g., sync/update entry points), then narrow/cast internally where mutation is required.
- **AppState strict vs partial contracts**: Many helpers accept `AppState` while repository data paths often carry `Partial<AppState>`. Prefer widening helper signatures only when behavior is unchanged and call sites are truly partial; otherwise use narrow local assertions at call sites instead of reshaping runtime objects.
- **Legacy appState compatibility keys**: Preserve compatibility for legacy keys used during migrations or cross-version loads (e.g., `currentItemLinearStrokeSharpness`, `currentItemStrokeSharpness`) when tightening types.

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
4. **Side-effect parity check**: When replacing index-based mutation code with object transforms (e.g., sanitize/copy patterns), explicitly verify whether the original code intentionally mutated shared objects. Preserve side effects unless a behavior change is explicitly approved.
5. **Build passes**: `npm run build` must succeed. Type changes can affect bundle outcome if they affect build-time inference.
6. **Lint cleanliness**: The changed file should not gain new lint violations. Use `npm run code -- src/path/to/file.ts` to check the specific file.

### Justified ESLint Suppressions

In some cases, `@typescript-eslint/no-explicit-any` or `@typescript-eslint/no-unnecessary-type-assertion` warnings are justified and reflect legitimate constraints rather than type-safety failures. When suppressing these rules, follow strict guidelines:

#### When Suppressions Are Justified

- **Provider-specific dynamic payloads**: AI providers, image APIs, and other external services return schemas that vary by provider. Normalizing these requires accepting `any` properties or using type assertions on the `item` parameter to access provider-specific fields.
  - Example: `(item: Record<string, any>) => item.image?.url || item.image?.b64_json` normalizes images from different providers into a common schema.

- **Mutation-path type casts**: When updating scene elements or bound references, Excalidraw type definitions may return readonly or union types, but the mutation path requires the mutable variant. The assertion is necessary and doesn't bypass a real type mismatch.
  - Example: `sceneElements.find(...) as unknown as Mutable<ExcalidrawElement>` during ID migration where the lookup guarantees the mutable variant exists.

- **Legacy or compatibility code**: When bridging serialized data, migrations, or undocumented Obsidian APIs where the runtime shape is known but the type system cannot express it without inventing local stubs.

#### How To Document Suppressions

Always use `eslint-disable-next-line` (not file-wide disables) and include a comment explaining:

1. **Which rule** is being suppressed and why
2. **What constraint** makes the suppression necessary (provider variability, mutation path, etc.)
3. **Why a stricter type is not feasible** without breaking functional equivalence

**Format**:
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- <rule name>: <1-2 sentence explanation of the constraint>
```

**Examples**:

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- image provider payload schemas vary and are normalized in this function.
const normalizedData = rawItems.flatMap((item: Record<string, any>) => {
  // ... normalize item.url, item.b64_json, item.image.url, etc.
});
```

```typescript
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- scene lookup returns union; mutation path requires mutable element.
const containerEl = sceneElements.find(
  (el) => el.id === textElement.containerId,
) as unknown as Mutable<ExcalidrawElement>;
```

#### Suppressions To Avoid

- **Lazy typing**: Do not suppress `no-explicit-any` to avoid refactoring a complex function. Fix the type instead.
- **Overly broad assertions**: Do not use `as any` or `as unknown as any` to bypass unrelated type mismatches.
- **Undocumented suppressions**: Every suppression must include a clear comment. Suppressions without explanation are a code review red flag.

### When To Create A New Type File

- If a set of related types will be used across multiple modules and are not Obsidian or Excalidraw types, create a new file in `src/types/`.
- Name it to reflect its domain (e.g., `canvasTypes.ts`, `aiProviderTypes.ts`).
- Document the file's purpose and scope at the top with a brief module-level comment.
- Export types, not implementation. Do not put logic in type files.
- If the file re-exports types from Excalidraw or elsewhere, document the origin.

## Logging


- **Do not use direct `console.log(...)` calls in project code.** Use the shared logging helper exported as `log` from `src/utils/debugHelper.ts`.
- If you are working in a Node script where importing `src/utils/debugHelper.ts` is not practical, define and use a local `log` wrapper instead of calling `console.log(...)` directly.

## Validation requirements

- Treat recoverable native failures as work to diagnose and resolve. Inspect the exact selected sources, locked dependencies, loaded companion versions, pending host requests, owning document/menu renderer and cleanup evidence; fix test infrastructure when it is wrong without weakening product assertions. Rebuild/deploy current workspace artifacts and rerun failed and blocked cases before returning. Preserve failed evidence. If progress actually requires human help (trust, permissions, foreground access or a safe restart), prompt the maintainer promptly instead of silently leaving the lane unfinished. Follow [native recovery](docs/OBSIDIAN_RUNTIME_TESTING.md#recovering-from-native-test-failures).
- Every behavior-changing feature, fix or refactor must add or extend executable tests for its intended behavior and the existing workflows it can affect. For a bug fix, preserve evidence that the regression fails before the fix and passes afterward. Assert observable outcomes; do not substitute registration, inventory, screenshots alone or an implementation-mirroring mock for behavioral evidence.
- Source tests under `scripts/testing/` and `tests/` named `*.test.mjs` are discovered by `test:fast`. Native helpers are not auto-discovered: wire new scenarios into the coordinator/profile and declared required-case/feature mappings. An unreferenced test file provides no executed coverage.
- During implementation, run the affected focused tests and required build after each independently testable checkpoint. Keep `tests/features.json` and `tests/inventory.json` current when coverage or discovery changes. Preserve existing assertions; report unexpected behavior instead of weakening tests or accepting new snapshots automatically.
- Settings/persistence changes need non-default configurations and unknown-key sentinels across actual plugin unload/reload and startup, with both on-disk data and loaded preferences asserted. Calling `loadSettings()` on an existing instance alone does not establish reload preservation. Include pending saves and externally changed data when those lifecycles are affected; preserve backup evidence if an unexpected replacement occurs.
- Before declaring a code PR ready, run `npm run test:regression:portable`. Also run the affected native scenarios for editor input/history, rendering/embeds, settings/persistence, window ownership/lifecycle, CLI/EA integration or real Extras services. Run the complete `npm run test:native` profile before readiness when those native workflows are affected. A focused pass is not a complete native pass.
- Run the complete portable and native profiles for coordinated release acceptance, after integrating upstream fork changes, and when validating a newly installed Obsidian version, including alphas. Record the actual host version; do not skip a case solely because the host is newer. Repeat complete matching-build runs when the acceptance plan requires them (including #3022); do not impose a new repeat count implicitly on unrelated changes.
- Portable CI runs on pull requests and pushes to `master`. Native CI is an explicitly dispatched, exact-commit workflow on the isolated desktop runner; local native testing is invoked through the documented commands. Neither suite runs inside the shipped plugin during ordinary use. Review the pinned companion revisions in workflows for coordinated changes: a pinned CI combination does not automatically test another repository's latest branch.
- Documentation-only or demonstrably mechanical changes do not require invented behavioral tests. Run their relevant documentation/inventory checks and state why runtime validation is unnecessary. Record the commands, results, source/artifact identities and genuine limitations for every code handoff.

Use [the testing guide](docs/TESTING.md) for the full command matrix and [runtime testing](docs/OBSIDIAN_RUNTIME_TESTING.md) for targeted native flags and the prepared-vault contract. Native tests use the repository-local vault, never a personal vault. An explicitly requested personal-vault deployment is separate from test execution: back up existing artifacts/settings, verify preservation, and stop to recover/report any unexpected settings replacement.

## Custom element metadata (`customData`)

- All types and helpers for Excalidraw element `customData` (extensible metadata on elements, e.g., for LaTeX, PDF, image, or plugin-specific keys) are centralized in `src/utils/elementCustomDataUtils.ts`.
- If you need to add a new `customData` key, type, or helper, always add it to this file and import from here in all consumers. This avoids type duplication and ensures discoverability for future maintainers and agents.
- See `ExcalidrawCustomData`, `ExcalidrawCustomDataPatch`, `ExcalidrawPDFCustomData`, `ExcalidrawLatexCustomData`, and `addAppendUpdateCustomData` in that file for canonical patterns.
