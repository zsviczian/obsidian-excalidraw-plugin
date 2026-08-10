# Contributing to Obsidian Excalidraw Plugin

First off, thank you for considering contributing to the Obsidian Excalidraw plugin! This project integrates a heavily customized Excalidraw fork into Obsidian.

Because this is not a generic React canvas app, but rather a deeply integrated Obsidian plugin with popout window support, mobile compatibility constraints, and performance optimizations, please read the following guidelines carefully before making any changes.

## 💬 Discuss First

Before spending your valuable time writing code for a new feature or significant refactor, please **open an issue** to discuss it first. This ensures your idea aligns with the project's roadmap and architecture, and helps prevent wasted effort or complex merge conflicts later.

## 🚀 Getting Started

1. Fork the repository and clone it locally.
2. Use Node.js 22 or newer and verify it with `node --version`. A shell that mixes a different Node binary with another installation's Corepack can fail before a build starts.
3. Run `npm install` in the root directory to install the main dependencies.
   *(Note: The `MathjaxToSVG` sub-component has its own separate dependencies. You do not need to install them manually; the first time you run `npm run build`, it will take care of this automatically).*
4. To test your changes locally, we recommend symlinking your cloned repository folder into a test Obsidian vault's `.obsidian/plugins/obsidian-excalidraw-plugin` directory. (Using a community plugin like [Obsidian Hot Reload](https://github.com/pjeby/hot-reload) will make local development much faster).

## 🛠️ Build and Lint Commands

- **Build the project:** Run `npm run build`
  *(Note: Our Rollup build is non-trivial as it merges CSS, handles MathjaxToSVG dependencies, and embeds runtime payloads. Run this command frequently to validate your changes).*
- **Build readable development payloads:** Run `npm run dev`
- **Build the public library API:** Run `npm run lib` when changing exports or ExcalidrawAutomate APIs
- **Run ESLint:** Run `npm run code`
- **Fix ESLint Warnings:** Run `node ./scripts/fix-eslint-warnings.mjs`

The shipped plugin is `dist/main.js`, `dist/styles.css`, and `dist/manifest.json`. Keep `main.js` below the release size limit and report its byte size after dependency or packaging changes.

## 🧪 Testing

At this time, the project **has no comprehensive automated test suite**. As a contributor, you are responsible for testing your changes thoroughly.

Because Obsidian runs across a variety of environments, please manually test your changes on as many of the following platforms as possible to avoid breaking the plugin for other users:
- Desktop: Mac, Windows, Linux
- Mobile: Android, iOS (Test on both Phones and Tablets)

Use a risk-based test plan rather than a generic smoke test. Every change should identify the most likely regression and whether it needs separate coverage in:

- the main Obsidian window
- a newly opened and restored popout window
- plugin reload and cold application startup
- desktop and mobile layouts
- offline mode, when the change affects packaged assets or runtime loading

Timers, observers, autosave coordination, and undocumented Obsidian API workarounds may exist for platform behavior outside the plugin's control. Trace their purpose before simplifying them.

## 🪵 Logging Requirement

- **Do not use direct `console.log(...)` calls in project code.** Use the shared logging helper exported as `log` from `src/utils/debugHelper.ts`.
- If you are working in a Node script where importing `src/utils/debugHelper.ts` is not practical, define and use a local `log` wrapper instead of calling `console.log(...)` directly.

## 🏗️ Architecture & Sub-components

This project consists of multiple sub-components and non-standard integrations to support Obsidian-specific features.

### 1. React & Package Manager
Because the plugin must support Obsidian's native popout windows, React and Excalidraw cannot be loaded as simple global singletons.
- References to React and ReactDOM are handled via `PackageManager.ts` (`src/core/managers/PackageManager.ts`).
- The runtime is assembled from official React npm entry points and loaded separately for each Obsidian window.
- Do not introduce direct `ReactDOM.createRoot()` calls outside this package-manager model.
- Do not publish React or ReactDOM on `window`. The documented `window.ExcalidrawLib` scripting surface is the deliberate exception.

Rendering and persistence have different window-ownership rules. DOM, events, portals, and React roots should use the owning view window. Existing plugin-level IndexedDB and local-storage data belongs to the main Obsidian application window and is shared with popouts; do not move it to `view.ownerWindow` without an explicit storage design and migration.

### 2. MathjaxToSVG
LaTeX support is provided by the `MathjaxToSVG` library, which is packaged as a separate sub-component (located in the `MathjaxToSVG/` folder).
- It is compressed using `LZString` during build time.
- It is decompressed and executed dynamically during runtime only when needed, maintaining optimal Obsidian startup times.

### 3. Excalidraw Fork Guidelines
This plugin relies on a custom Excalidraw component fork: [`zsviczian/excalidraw`](https://github.com/zsviczian/excalidraw/).

If you must submit a PR to the Excalidraw fork, **keep changes to the absolute minimum**. Compounding changes to the fork make merging upstream updates from `excalidraw/excalidraw` exponentially harder.

- **Resist the temptation:** Do not implement features in the fork if they can be achieved using plugin wrappers, monkey patches, or API integrations within the main Obsidian plugin repo.
- **Use ringfenced areas:** Place changes in files clearly marked for the fork whenever possible:
  - `packages/excalidraw/obsidianUtils.ts`
  - `packages/common/src/commonObsidianUtils.ts`
  - `packages/excalidraw/css/obsidianStylingOverrides.css`
- **Mark your changes explicitly:** Add a comment with your initials and the Issue or PR ID to easily identify custom additions during merge conflicts.
  ```ts
  private shouldRenderAllEmbeddables: boolean = false; //zsviczian
  ```
- **Use dedicated functions:** If your code extension doesn't fit neatly into the ringfenced files, extract it into a dedicated new function rather than putting huge chunks of logic inline.
  ```ts
  //mfuria #329. Right-click pan support when enabled via host plugin setting
  if (
    isPanWithRightMouseEnabled() &&
    event.pointerType === "mouse" &&
    event.button === POINTER_BUTTON.SECONDARY &&
    !this.state.editingTextElement
  ) {
    // prevent native context menu
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener('contextmenu', onContextMenu, { once: true });

    // Start right-click panning
    this.startRightClickPanning(event);
    return;
  }

  //mfuria #329. start right-click panning
  private startRightClickPanning(event) { ... }
  ```

### 4. Working Across Both Repositories

The customized component is maintained in the separate [`zsviczian/excalidraw`](https://github.com/zsviczian/excalidraw/) repository. When both repositories are checked out as siblings, the usual path is `../excalidraw`.

The repositories deliberately use different package managers:

- `obsidian-excalidraw-plugin`: npm
- `zsviczian/excalidraw`: Yarn

From `../excalidraw/packages/excalidraw`, `yarn build:obsidian` produces four consumer-specific files in `dist/obsidian`: development and production JavaScript and CSS. This plugin reads the corresponding four files from `node_modules/@zsviczian/excalidraw/dist/obsidian/`.

For an unpublished integration test, you may temporarily copy those four generated files into the installed package under this repository's ignored `node_modules`. Keep the declared npm dependency unchanged. Running `npm install` restores the published package. The durable workflow is to publish a new component version, update the plugin dependency, run `npm install`, and rebuild.

The Excalidraw Obsidian artifact has strict runtime constraints:

- one function-evaluable JavaScript file, with no runtime chunks
- React, ReactDOM, and their JSX runtimes remain external and are supplied by this plugin
- Mermaid remains external and is loaded lazily through Excalidraw Extras
- all required assets work offline except deliberately lazy CJK font subsets
- production is minified; development retains debugger-friendly source information

Radix menus and popovers may be portaled to the owning document body by `ObsidianRadixPortal`. Portaled content no longer has its original component ancestors and can sit behind modal stacking contexts. Style portaled content through a class that survives the portal, and test visibility, positioning, click-outside, and Escape behavior in the main window and a popout.

### 5. Incremental Refactoring

Use `RefactorPlan.md` as the living record for ongoing structural work. Refactors should be small enough to build and test independently. Move cohesive code intact before redesigning it, update the progress table and action log, and provide a risk-based test checklist at the end of each step.

`ExcalidrawView` must remain an Obsidian `TextFileView`; it should not be converted wholesale into React. React owns the child UI, while the view remains the Obsidian lifecycle and compatibility boundary. ExcalidrawAutomate, command IDs, settings, serialized data, and existing plugin integrations must remain backwards compatible.

## 🌍 Localization & User-Facing Text

- **No hardcoded strings:** There should be no hardcoded English strings directly in the UI components or logic.
- **Language files:** All strings must be added to the localization files located in `src/lang/locale/`.
- **Translations:** At a minimum, you must add your new keys and strings to `en.ts`. However, it is highly appreciated if you can provide translated strings for all of our actively maintained translations (`es.ts`, `ru.ts`, `zh-cn.ts`, `zh-tw.ts`) using a translation tool.

## 📦 Pull Requests & Versioning

- **Do NOT bump versions:** Please do not bump the version numbers in `manifest.json`, `manifest-beta.json`, or `package.json` in your Pull Requests. Version bumping and release coordination are handled exclusively by the maintainer during the final GitHub Release workflow.
- **Release Notes:** If you are adding a feature or fixing a bug that users need to know about, please document it in `src/shared/Dialogs/Messages.ts` under the upcoming version key.

Once again, thank you for contributing to the plugin!
