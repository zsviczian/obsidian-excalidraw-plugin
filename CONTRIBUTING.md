# Contributing to Obsidian Excalidraw Plugin

First off, thank you for considering contributing to the Obsidian Excalidraw plugin! This project integrates a heavily customized Excalidraw fork into Obsidian. 

Because this is not a generic React canvas app, but rather a deeply integrated Obsidian plugin with popout window support, mobile compatibility constraints, and performance optimizations, please read the following guidelines carefully before making any changes.

## 💬 Discuss First

Before spending your valuable time writing code for a new feature or significant refactor, please **open an issue** to discuss it first. This ensures your idea aligns with the project's roadmap and architecture, and helps prevent wasted effort or complex merge conflicts later.

## 🚀 Getting Started

1. Fork the repository and clone it locally.
2. Run `npm install` in the root directory to install the main dependencies. 
   *(Note: The `MathjaxToSVG` sub-component has its own separate dependencies. You do not need to install them manually; the first time you run `npm run build`, it will take care of this automatically).*
3. To test your changes locally, we recommend symlinking your cloned repository folder into a test Obsidian vault's `.obsidian/plugins/obsidian-excalidraw-plugin` directory. (Using a community plugin like [Obsidian Hot Reload](https://github.com/pjeby/hot-reload) will make local development much faster).

## 🛠️ Build and Lint Commands

- **Build the project:** Run `npm run build`
  *(Note: Our Rollup build is non-trivial as it merges CSS, handles MathjaxToSVG dependencies, and embeds runtime payloads. Run this command frequently to validate your changes).*
- **Run ESLint:** Run `npm run code`
- **Fix ESLint Warnings:** Run `node ./scripts/fix-eslint-warnings.mjs`

## 🧪 Testing

At this time, the project **has no automated tests**. As a contributor, you are responsible for testing your changes thoroughly. 

Because Obsidian runs across a variety of environments, please manually test your changes on as many of the following platforms as possible to avoid breaking the plugin for other users:
- Desktop: Mac, Windows, Linux
- Mobile: Android, iOS (Test on both Phones and Tablets)

## 🏗️ Architecture & Sub-components

This project consists of multiple sub-components and non-standard integrations to support Obsidian-specific features.

### 1. React & Package Manager
Because the plugin must support Obsidian's native popout windows, React and Excalidraw cannot be loaded as simple global singletons. 
- References to React and ReactDOM are handled via `PackageManager.ts` (`src/core/managers/PackageManager.ts`).
- They are loaded to Obsidian popout windows separately during runtime. Do not introduce direct `ReactDOM.createRoot()` or similar global React calls outside of this package manager model.

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

## 🌍 Localization & User-Facing Text

- **No hardcoded strings:** There should be no hardcoded English strings directly in the UI components or logic.
- **Language files:** All strings must be added to the localization files located in `src/lang/locale/`. 
- **Translations:** At a minimum, you must add your new keys and strings to `en.ts`. However, it is highly appreciated if you can provide translated strings for all of our actively maintained translations (`es.ts`, `ru.ts`, `zh-cn.ts`, `zh-tw.ts`) using a translation tool.

## 📦 Pull Requests & Versioning

- **Do NOT bump versions:** Please do not bump the version numbers in `manifest.json`, `manifest-beta.json`, or `package.json` in your Pull Requests. Version bumping and release coordination are handled exclusively by the maintainer during the final GitHub Release workflow.
- **Release Notes:** If you are adding a feature or fixing a bug that users need to know about, please document it in `src/shared/Dialogs/Messages.ts` under the upcoming version key.

Once again, thank you for contributing to the plugin!
