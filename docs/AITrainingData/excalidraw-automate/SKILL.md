---
name: excalidraw-automate
description: Write and manipulate ExcalidrawAutomate scripts for Obsidian.md. Use when the user wants to create, modify, or understand an Excalidraw script.
---

**ExcalidrawAutomate full library for LLM training**

Excalidraw-Obsidian is an Obsidian.md plugins that is built on the open source Excalidraw component. Excalidraw-Obisdian includes Excalidraw Automate, a powerful scripting API that allows users to automate tasks and enhance their workflow within Excalidraw.

Read the information below and respond with I'm ready. The user will then prompt for an ExcalidrawAutomate script to be created. Use the examples, the ExcalidrawAutomate documentation, and the varios type definitions and information from also the Excalidraw component and from Obsidian.md to generate the script based on the user's requirements.

**Routing note:** Prefer the curated skill package and reference set first. If your environment cannot open linked files or has URL access disabled, use the repository base below and resolve the references from there.

- Master repository: https://github.com/zsviczian/obsidian-excalidraw-plugin
- Start with: https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/docs/AITrainingData/excalidraw-automate/SKILL.md
- Type definitions: https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/docs/AITrainingData/excalidraw-automate/references/type-definitions.md
- API usage index: https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/docs/AITrainingData/excalidraw-automate/references/api-usage-index.md
- ExcalidrawLib signatures: https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/docs/AITrainingData/excalidraw-automate/references/excalidraw-lib-functions.md
- Startup examples: https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/docs/AITrainingData/excalidraw-automate/references/startup-scripts.md

In addition to ExcalidrawAutomate, you can also use two other sources of functions:
- The Excalidraw API available via `ea.getExcalidrawAPI()`. Note: the API is only available if `ea.targetView` is set. When running Excalidraw scripts using the script engine, the provided `ea` object is already set up with targetView by default. Otherwise call `ea.setView()` to select a sensible default or `ea.setView(view)` to bind explicitly. Calling `ea.setView(null)` deliberately clears `targetView`; it does not auto-select another drawing.
- `window.ExcalidrawLib` which exposes a rich set of utility functions that do not require an active ExcalidrawView.

**CRITICAL RULE ON API SELECTION:** If a function or objective can be achieved via `ea` (ExcalidrawAutomate) methods, ALWAYS prefer `ea` over `window.ExcalidrawLib`. `ea` methods include essential wrapper logic to make features work flawlessly within the Obsidian environment.

A dedicated section “ExcalidrawLib module functions” in this document lists the function signatures extracted directly from the ExcalidrawLib TypeScript declarations.

- When the user asks for a dialog window, by default create a FloatingModal. Do not extend the FloatingModal class. Instead, define the modal's behavior by creating a new instance (e.g., `const modal = new ea.FloatingModal(...)`) and then assigning functions directly to the `onOpen` and `onClose` properties of that instance.
For a reference, follow the implementation pattern used in the "Printable Layout Wizard.md" script.
- Elements have a `customData` property that can be used to store arbitrary data. To ensure the data the script adds to elements use the `ea.addAppendUpdateCustomData` function. This function ensures that existing customData is preserved when adding new data.
- Elements can be hidden by setting their opacity to 0. When hiding elements this way, it is good practice to temporarily store their original opacity in customData. This allows for easy restoration of the original opacity later.
- Elements can be deleted from the scene by setting their isDeleted property to true.
- The Obsidian.md module is available on `ea.obsidian`.
- Version checks are distinct: use `ea.verifyMinimumPluginVersion()` for the Excalidraw plugin and `ea.verifyMinAppVersion()` only for the Obsidian application version.
- Use `utils.executionSource` to distinguish `"manual"` toolbar/command/hotkey runs from `"autostart"`, `"sidepanel-restore"`, and `"drawing-onload"` runs. Autostart-capable scripts should register their view-local providers on every applicable run, then return after registration when the source is `"autostart"`.
- `ea.registerAutostart(message?)` accepts a concise script-specific explanation of what autostart registers or performs. The explanation appears as the second paragraph of the permission prompt; do not imply that the script's main interactive action starts automatically when only its tools/providers do.
- `ea.registerElementActionProvider()` action descriptors take an Obsidian/Lucide icon name such as `"presentation"`, not serialized SVG markup. For buttons a script renders itself, obtain the SVG with `ea.obsidian.getIcon()` and recreate it in the button's owning document when popout support matters.
- When an Excalidraw API method requires an element, pass the known typed scene element. For example, call `api.startLineEditor(line, pointIndices)`; do not re-read selection state when the intended line is already known.
- For persistent workbench mutations, await `ea.addElementsToView()` with saving enabled (the default). Prefer this public EA save path over unpublished methods on `ea.targetView`.

**Sidepanels and multi-view tooling:**
- Sidepanels are for scripts that must stay open while users hop between multiple Excalidraw views. They should implement the SidepanelTab hooks (`onOpen`, `onFocus(view)`, `onClose`, `onExcalidrawViewClosed`) and manage their own `ea.targetView` explicitly.
- Persisted sidepanel scripts are launched during plugin startup (e.g., Obsidian restart, plugin update) with `ea.targetView === null`. Scripts must handle this by deferring view-bound work until `onFocus` delivers a view; call `ea.setView(view)` when you decide to bind. When `onFocus` supplies `null` or focus moves to a non-Excalidraw view, call `ea.setView(null)` to make the unbound state explicit and prevent later view operations from targeting a stale drawing.
- Each `ea` instance may host a single `sidepanelTab`. This sidepanel tab is stored in `ea.sidepanelTab`. Create the tab with `ea.createSidepanelTab(title, persist=false, reveal=true)`; the returned `ea.sidepanelTab` exposes `contentEl`, `setContent`, `setTitle`, `setDisabled`, `setCloseCallback`, `open/close`, and focus lifecycle hooks. Note auto-reveal during tab creation via `ea.createSidepanelTab()` is disabled during plugin startup. You can reveal a tab with `ea.sidepanelTab?.open()`. You can persist with `ea.persistSidepanelTab()` (tabs are restored and scripts re-run on next startup). Close with `ea.sidepanelTab?.close()`.
- Mobile UX: sidepanels slide in without disturbing canvas layout and are better for longer forms than floating modals. Prefer them for complex inputs, especially on phones.
- Auto-closing patterns: For scripts that use sidepanels but perform operations that are single-`ExcalidrawView` relevant, they can call `ea.closeSidepanelTab()` after completing the operation, and/or inside `ea.sidepanelTab.onFocus = (view) => { if (view !== ea.targetView) { ea.sidepanelTab?.close(); } }` to shut down when the user leaves the originating view.
- Scripts can detect view change in `onFocus(view)` by comparing `ea.targetView` to the provided `view` parameter.
- Persistence UX: scripts may offer a “Persist tab” control inside `contentEl` that calls `ea.persistSidepanelTab()`. Once persisted, hide that control; users can later remove the tab via the sidepanel close button (scripts cannot unpersist themselves, but can close themselves via `ea.sidepanelTab?.close()`).
- Use `checkForActiveSidepanelTabForScript` to avoid creating duplicate tabs for the same script name. This method returns the `ExcalidrawSidepanelTab` associated with the supplied `scriptName` (or `ea.activeScript` when omitted), or `null` if none exists. It is intended to let a script detect an existing tab that may be owned by another `ExcalidrawAutomate` instance (for example, a persisted tab restored at startup). Typical pattern:
  - Before creating a new sidepanel, call `ea.checkForActiveSidepanelTabForScript()` to see if a tab already exists.
  - If a tab exists and `tab.getHostEA() === ea`, reuse it (your script already hosts it).
  - If a tab exists but is hosted by a different `ea` instance, decide whether to reuse or hand off control — e.g. open the existing tab and exit to avoid duplicates.
  - Note: persisted tabs restored on startup may be created with `ea.targetView === null` and hosted by a different `ea` instance; handle that case by waiting for `onFocus` before binding view-specific work.
  - Example usage:
    `const sp = ea.checkForActiveSidepanelTabForScript();
    if (sp) {
      if (sp.getHostEA() === ea) {
        // we already own the tab — reuse it
        sp.open();
      } else {
        // another EA instance hosts the tab — open it for the user and exit
        sp.open();
        return;
      }
    }
    // no existing tab — safe to create a new one
    // ea.createSidepanelTab("My Script", false, true);`
- A dedicated section "sidepanelTabTypes.d.ts" in this document lists the `ExcalidrawSidepanelTab` function signatures.

#### **0. External Documentation & Resources**

To keep this training file concise, large external type definitions are not included. If you need to look up Obsidian APIs or Excalidraw internals, refer to the following resources:
- **Obsidian API Type Definitions:** https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts
- **Obsidian Developer Docs:** https://docs.obsidian.md/Home (Community site with API and CSS documentation/examples)
- **Obsidian Developer Forum:** https://forum.obsidian.md/c/developers-api/14
- **ExcalidrawAutomate Implementation:** If the provided API documentation is unclear, consult the source directly: https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/src/shared/ExcalidrawAutomate.ts
- **Excalidraw Core Fork:** For doubts regarding core Excalidraw functionality, consult the fork used by the plugin: https://github.com/zsviczian/excalidraw

#### **1. The Core Workflow: Handling Element Immutability**

*   **Central Rule:** Elements returned from the Excalidraw scene are immutable and should never be modified directly. EA owns a stateful, in-memory "workbench" (`elementsDict` and `imagesDict`) where a script stages one coherent persistent or temporary operation independently of the scene.
*   **The Workflow:**
    1.  Start an independent transaction with `ea.clear()`. This clears only the workbench; it does not delete scene elements or reset style.
    2.  Read existing scene elements using `ea.getViewElements()` or `ea.getViewSelectedElements()`.
    3.  To work with mutable copies of those same scene elements, copy them into the workbench with `ea.copyViewElementsToEAforEditing(elements)`. Their IDs are preserved.
    4.  Modify the workbench copies retrieved by their original IDs (e.g., `ea.getElement(id).locked = true;`).
    5.  For a persistent scene edit, commit once with `await ea.addElementsToView()`; saving is enabled by default. For temporary transformations such as export or preview preparation, pass the workbench elements to the relevant EA operation without committing them to the scene.
    6.  Call `ea.clear()` after the operation to discard the workbench copies, preferably in a `finally` block when an awaited operation can fail.
*   **Temporary workbench example:**
    ```javascript
    ea.clear();
    try {
      const sceneElements = ea.getViewElements();
      ea.copyViewElementsToEAforEditing(sceneElements);
      ea.getElement(pathId).opacity = 0;
      // elementsOverride replaces the export scene, so pass the complete workbench.
      const svg = await ea.createViewSVG({ elementsOverride: ea.getElements() });
      // Use svg. The live scene was never changed.
    } finally {
      ea.clear();
    }
    ```
*   **`elementsOverride` is a complete replacement:** In `createViewSVG()`, this option replaces the view's element array; it is not merged with the scene and is not a patch by element ID. The array must contain every element that should appear in the SVG. When temporarily modifying an existing scene for export, the simplest safe workflow is to copy the complete desired export set into EA, modify the workbench copy, and pass `ea.getElements()` as the override.
*   **Identity is the boundary:** `copyViewElementsToEAforEditing()` is the standard way to obtain mutable, identity-preserving copies of existing scene elements for both persistent edits and temporary EA operations. By contrast, `ea.cloneElement()` and `ea.cloneElements()` deliberately generate new IDs and are only for creating genuine duplicate scene elements. Never use them to obtain editable workbench copies of existing elements.
*   **One workbench transaction at a time:** The workbench is shared mutable state on an EA instance. Do not interleave asynchronous preview/export preparation and scene mutation through the same workbench. Await the operation, then clear the workbench before starting another transaction.
*   **Deletion:** To delete an element, set its `isDeleted` property to `true` on the workbench copy (`ea.getElement(id).isDeleted = true;`) and then commit with `await ea.addElementsToView()`.

#### **2. User Interaction: Prompts and Dialogs**

*   **Simple Input:** For straightforward user input, use the `utils` object provided to the script.
    *   `await utils.inputPrompt()`: To get a string or number from the user.
    *   `await utils.suggester()`: To let the user select from a predefined list of options.
*   **Complex Dialogs:** When a more complex UI with multiple controls is needed, create a floating dialog window.
    *   **Use `FloatingModal`:** Always create a new instance: `const modal = new ea.FloatingModal(ea.plugin.app);`.
    *   **Do Not Extend:** Do not use `class MyModal extends ea.FloatingModal`.
    *   **Define Behavior:** Assign functions directly to the `onOpen` and `onClose` properties of the instance. Inside `onOpen`, use the `modal.contentEl` property to build your UI.
    *   **Reference Implementation:** The script "Printable Layout Wizard.md" is the canonical example for this pattern. Use `ea.obsidian.Setting` to add controls like toggles and dropdowns within the modal.

#### **3. Element Manipulation and Querying**

*   **Finding Elements:** The most common starting point is to get the user's selection with `ea.getViewSelectedElements()`. Use standard JavaScript array methods like `.filter()` to narrow down the selection (e.g., `elements.filter(el => el.type === "text")`).
*   **Geometric Calculations:**
    *   Before performing layout or positioning tasks, use `ea.getBoundingBox(elements)` to get the collective dimensions and position of a group of elements.
    *   Use `ea.measureText(text)` to determine the width and height of a string based on the current `ea.style` settings before creating a text element or a container for it.
*   **Grouping:**
    *   To create a group, use `ea.addToGroup([elementId1, elementId2, ...])`.
    *   To operate on existing groups within a selection, use `ea.getMaximumGroups(selectedElements)` which correctly identifies the top-level groups. Use `ea.getLargestElement(group)` to find the primary container within a group (e.g., the box around a text element).

#### **4. Styling: Creation vs. Modification**

*   **For New Elements:** Set the properties on the global `ea.style` object *before* you call a creation function like `ea.addText()` or `ea.addRect()`. This acts like setting the active color/style on a paintbrush.
*   **For Existing Elements:** To change the style of an existing element, modify the properties directly on the element's copy in the EA workbench (after `copyViewElementsToEAforEditing`). For example: `const myElement = ea.getElement(id); myElement.strokeColor = '#FF0000';`.

#### **5. Data Persistence and Customization**

*   **Storing Custom Data:** Elements have a `customData` property for arbitrary data.
    *   **Always Use `ea.addAppendUpdateCustomData(id, newData)`:** This is crucial. It safely adds or updates your key-value pairs without overwriting data that might have been stored by other scripts or the Excalidraw plugin itself.
*   **Creating Configurable Scripts:** To make your script's behavior customizable by the user:
    *   Use `ea.getScriptSettings()` to retrieve saved settings.
    *   scriptSettings are stored with Excalidraw settings in Obsidian data.json. Keep this light. You MUST NEVER save large data objects such as base64 images or huge arrays here. Keep this lean and efficient.
    *   Check if settings exist, and if not, define the default structure.
    *   Use `await ea.setScriptSettings(settings)` to save any changes. This allows users to configure your script in the Excalidraw plugin settings pane.

#### **6. Best Practices and Advanced Techniques**

*   **Script Overview Block (MANDATORY):** Create, and consistently maintain with each update, a comprehensive comment block at the very beginning of the script. This block must explain the purpose of the script, its key features, and the high-level solution logic or architecture.
*   **Strictly Modular Architecture (NO LOOSE CODE):** Avoid creating large monolithic blocks of code or leaving logic loose at the root level of the script. Instead, organize *everything* into relatively small, atomic functions. This includes UI components as well; if the UI includes sections, tabs, or panels, these should be rendered via sub-functions. This is a critical requirement to ensure long-term maintainability and evolution of the script, as loose code quickly becomes unmanageable over multiple iterative prompts.
*   **Evergreen JSDoc Headers and Comments:** Every function must have a proper JSDoc/Javadoc-style header containing parameter names, types, and a clear description of the function's purpose. These descriptions must be kept *evergreen* (updated alongside any code changes). Additionally, when modifying or updating a script, you must strictly *retain all existing internal code comments*.
*   **Isolate Constants and User-Facing Strings:** *Do not embed hardcoded magic values, config parameters, or UI strings deep inside the logic.* You must separate all constants and language strings and collect them at the very top of the file. This makes it easier to tweak values later and provides a clear, unified section for localization and customization.
*   **Icons:** Obsidian uses https://lucide.dev icons. These icons are available for scripts via `ea.obsidian.getIcon("Icon Name")`. For UI components prefer use of lucide.dev icons.
*   **Omit Version Verification:** While many of the sample scripts in the library include a version verification block at the outset (using `ea.verifyMinimumPluginVersion`), *do not add this section* when generating a new script unless explicitly instructed to do so.
*   **Embrace `await`:** Many EA functions are asynchronous and return a `Promise` (e.g., `ea.addElementsToView()`, `ea.createSVG()`, `utils.inputPrompt()`). **Always** use `await` when calling these functions to ensure your script executes in the correct order.
*   **Accessing Obsidian API:** The full Obsidian API is available via `ea.obsidian`. For example, use `new ea.obsidian.Notice("message")` or `ea.obsidian.normalizePath(filepath)`.
*   **Accessing Excalidraw API:** The full Excalidraw API is available on `ea.getExcalidrawAPI()`, these API functions are Scene dependent. Additional support functions are available on `window.ExcalidrawLib`.
*   **Visibility vs. Deletion:**
    *   To temporarily hide an element, set `element.opacity = 0`. It's good practice to store the original opacity in `customData` so it can be restored. It is also recommended to lock hidden elements so they do not get accidentally selected or moved around.
    *   To permanently remove an element from the scene, set `element.isDeleted = true`.
*   **Image Handling:** When dealing with image elements, use `ea.getViewFileForImageElement(imageElement)` to get the corresponding `TFile` from the Obsidian vault. This is necessary for any logic that needs to read or manipulate the source image file.

#### **6.1. Tests in a Multi-Script Workspace**

*   **Tests are part of implementation:** Add or update focused automated tests for behavior changes. When fixing a regression, reproduce it with a failing test first when practical.
*   **Co-locate by ownership:** Put script tests in `src/scripts/{slug}/__tests__/*.test.ts` and shared utility tests in `src/sharedUtils/__tests__/*.test.ts`. Do not maintain a separate root test tree that mirrors dozens of scripts.
*   **Never import executable entrypoints:** `main.ts` runs immediately against the globals injected by Obsidian. Keep it as a thin bootstrap and move testable orchestration to `run.ts` or another import-safe module.
*   **Use the universal runner:** Use Vitest. Run a focused suite while iterating, then run `npm run check`; the repository gate includes TypeScript, ESLint, and all test suites. Use `npm run test:watch` for continuous feedback.
*   **Test behavior, not bundler details:** Prefer pure domain functions and narrow fakes for `ea`, the Excalidraw API, Obsidian globals, timers, and DOM boundaries. Build and perform an Obsidian smoke test for integration behavior automation cannot prove.

#### **6.2. Per-Script Localization**

*   **Catalogs belong to the script:** Store strings in `src/scripts/{slug}/lang/`, with one file per locale. Never create one language catalog shared across unrelated scripts.
*   **English defines the contract:** `lang/en.ts` is the typed source of truth. Maintain `de.ts`, `es.ts`, `fr.ts`, `ru.ts`, and `zh-cn.ts`; incomplete reviewed catalogs may rely on English fallback.
*   **Use the shared helper:** Register catalogs in `lang/index.ts` with `createTranslator`. Resolve the locale with `ea.obsidian.moment.locale()` and pass the translator into import-safe script logic.
*   **Interpolate by name:** Use placeholders such as `{count}` instead of string concatenation. Do not use dynamically constructed regular expressions for interpolation.
*   **Keep UI copy out of logic:** Add user-visible strings to the script catalog rather than embedding them in controllers, runners, or helpers.

#### **7. SVG and Image Export Approaches**
Generating images (SVG/PNG) requires specific approaches depending on the context. Follow these three rules strictly to avoid performance issues and missing assets:
1. **Exporting elements currently in the EA workbench:** Use `await ea.createSVG(null, ...)` or `await ea.createPNG(null, ...)` (passing `null` as the `templatePath`).
2. **Exporting an Excalidraw file that is NOT currently open:** Pass the file path as the template to `createSVG` or `createPNG` (e.g., `await ea.createSVG(file.path, ...)`). This is the most reliable approach as ExcalidrawAutomate natively handles loading the scene, resolving embedded images, and instantiating loaders behind the scenes. **Do NOT attempt to manually read the file, reconstruct the scene, or load images into memory.**
3. **Exporting the currently active `ExcalidrawView`:** Use `await ea.createViewSVG(...)`. This is specifically for the open view. Its `elementsOverride` parameter is a complete replacement for the exported element array, not an additive injection or a patch by ID. If supplied, include every existing or temporary element that should appear in the SVG. For temporary changes to existing elements, copy the complete desired export set into the EA workbench, modify it there, and pass `ea.getElements()`.

#### **8. Custom Pens and Perfect Freehand**

Excalidraw's freehand tool is powered by the open-source Perfect Freehand library. The plugin exposes “custom pens” that bundle:
- Canvas style for the next strokes (colors, width, fillStyle, roughness).
- Perfect Freehand stroke geometry and behavior (pressure simulation, outline, tapering, easing, etc.).

Key concepts:
- AppState-driven drawing: When `appState.currentStrokeOptions` is set, the freedraw tool renders new strokes using those Perfect Freehand options.
- Element-level persistence: If a freedraw element has `element.customData.strokeOptions`, it is rendered with those options regardless of the current tool state.
- Types reference: See `src/types/penTypes.ts`. The `PenOptions` shape is:
  ```ts
  interface PenOptions {
    highlighter: boolean; // if true the pen is drawn at the lowest layer, behind all other elements
    constantPressure: boolean;
    hasOutline: boolean;
    outlineWidth: number;
    options: {
      thinning: number;
      smoothing: number;
      streamline: number;
      easing: string; // see supported names below
      start: { cap: boolean; taper: number | boolean; easing: string; };
      end:   { cap: boolean; taper: number | boolean; easing: string; };
    };
  }
  ```

Using custom pens from scripts:
- Activate a custom pen for drawing:
  ```ts
  // obtain the Excalidraw API
  const api = ea.getExcalidrawAPI();

  // define Perfect Freehand options (example similar to "finetip")
  const penOptions = {
    highlighter: false,
    constantPressure: true,
    hasOutline: false,
    outlineWidth: 1,
    options: {
      thinning: -0.5,
      smoothing: 0.4,
      streamline: 0.4,
      easing: "linear",
      start: { taper: 5, cap: false, easing: "linear" },
      end:   { taper: 5, cap: false, easing: "linear" },
    },
  };

  // apply stroke options + canvas style, then switch to freedraw (strokeWidth, color, background, fillStyle are optional)
  ea.viewUpdateScene({
    appState: {
      currentStrokeOptions: penOptions,
      currentItemStrokeWidth: 0.5,
      currentItemStrokeColor: "#3E6F8D",
      currentItemBackgroundColor: "transparent",
      currentItemFillStyle: "hachure",
    },
  });
  api.setActiveTool({ type: "freedraw" });
  ```

- Clear custom pen (revert to default freedraw behavior):
  ```ts
  ea.viewUpdateScene({ appState: { currentStrokeOptions: null } });
  ```

- Persist custom strokeOptions onto existing freedraw elements:
  ```ts
  const selected = ea.getViewSelectedElements().filter(el => el.type === "freedraw");
  ea.copyViewElementsToEAforEditing(selected);
  for (const el of selected) {
    ea.addAppendUpdateCustomData(el.id, { strokeOptions: penOptions });
  }
  await ea.addElementsToView();
  ```

Notes:
- New strokes respect `appState.currentStrokeOptions` at draw time. Existing elements only change if you update their `customData.strokeOptions`.
- For pens that should behave like real markers/highlighters, set `highlighter: true` and often `constantPressure: true` with an `outlineWidth` for the edge.

Supported easing names (string values for `options.easing`, `options.start.easing`, `options.end.easing`):
linear, easeInQuad, easeOutQuad, easeInOutQuad, easeInCubic, easeOutCubic, easeInOutCubic, easeInQuart, easeOutQuart, easeInOutQuart, easeInQuint, easeOutQuint, easeInOutQuint, easeInSine, easeOutSine, easeInOutSine, easeInExpo, easeOutExpo, easeInOutExpo, easeInCirc, easeOutCirc, easeInOutCirc, easeInBack, easeOutBack, easeInOutBack, easeInElastic, easeOutElastic, easeInOutElastic, easeInBounce, easeOutBounce, easeInOutBounce.

Example freedraw element carrying `customData.strokeOptions`:
```json
{"type":"excalidraw/clipboard","elements":[{"id":"...","type":"freedraw","strokeColor":"#3E6F8D","backgroundColor":"transparent","fillStyle":"hachure","strokeWidth":0.5,"roughness":0,"customData":{"strokeOptions":{"highlighter":false,"hasOutline":false,"outlineWidth":0,"constantPressure":true,"options":{"smoothing":0.4,"thinning":-0.5,"streamline":0.4,"easing":"linear","start":{"taper":5,"cap":false,"easing":"linear"},"end":{"taper":5,"cap":false,"easing":"linear"}}}}}],"files":{}}
```

#### **9. Text Element**
*   There are three text properties.
    *   **textElement.text** holds the wrapped, rendered text. This is what is displayed in the view. Excalidraw adds '\n' linebreaks during dynamic wrapping.
    *   **textElement.originalText** holds the rendered, but unwrapped text. Any '\n' character in originalText is an intentional linebreak by the user. Rendered means that for example [[wiki links]] are rendered without the square brackets.
    *   **textElement.rawText** holds the original raw text including intentional new line characters and the full markdown markup (thought currently only links are rendered, so markdown support is limited to these)
*   When modifying element text from script, typically all 3 of these properties must be updated, though in case textElement.autoresize === true, or when a text element is bound in a container, excalidraw will update textElement.text following the size of the text element or the container.


## References
The `references/` directory contains supporting documentation necessary for writing scripts:
- [type-definitions.md](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/docs/AITrainingData/excalidraw-automate/references/type-definitions.md): Core type definitions for ExcalidrawAutomate.
- [excalidraw-lib-functions.md](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/docs/AITrainingData/excalidraw-automate/references/excalidraw-lib-functions.md): Function signatures for `window.ExcalidrawLib`.
- [startup-scripts.md](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/docs/AITrainingData/excalidraw-automate/references/startup-scripts.md): ExcalidrawStartup script template and examples.
- [api-usage-index.md](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/docs/AITrainingData/excalidraw-automate/references/api-usage-index.md): A highly useful index mapping every API method (ea.*, api.*, ExcalidrawLib.*) to the specific example scripts that utilize them.
- [scripts/](https://github.com/zsviczian/obsidian-excalidraw-plugin/tree/master/docs/AITrainingData/excalidraw-automate/references/scripts): A folder containing all the raw, real-world example scripts.

## Publishing Workflow
Use the normal repository contribution flow when publishing or updating scripts.
The AI training material is maintained independently from publishing PRs; do not bundle regenerated training artifacts into the script PR.
- Preview images must follow `scripts-{slug}.{ext}`, where `slug` uses lowercase `a-z`, `0-9`, and hyphens only.

- Add or update the script under [ea-scripts](https://github.com/zsviczian/obsidian-excalidraw-plugin/tree/master/ea-scripts).
- Add or update the preview image under [images](https://github.com/zsviczian/obsidian-excalidraw-plugin/tree/master/images).
- Keep [ea-scripts/index-new.md](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/index-new.md) manually curated; do not automate it.
- Update [ea-scripts/directory-info.json](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/directory-info.json) in the same PR.
- For script updates, refresh the matching entry's `mtime` in [ea-scripts/directory-info.json](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/ea-scripts/directory-info.json) so the plugin can detect the newer local version.
- Keep the PR focused on the script and its generated references.

### How to use the Script Examples
If you need to implement a specific function (e.g., `ea.addElementsToView`), do NOT guess its implementation context. Instead:
1. Open `references/api-usage-index.md`.
2. Find the function name.
3. Note the scripts listed next to it.
4. Read the corresponding script inside the `references/scripts/` directory to see a complete, working example of how the function is used in context.
