---
name: excalidraw-automate
description: Write and manipulate ExcalidrawAutomate scripts for Obsidian.md. Use when the user wants to create, modify, or understand an Excalidraw script.
---

**ExcalidrawAutomate full library for LLM training**

Excalidraw-Obsidian is an Obsidian.md plugin that is built on the open source Excalidraw component. Excalidraw-Obisdian includes Excalidraw Automate, a powerful scripting API that allows users to automate tasks and enhance their workflow within Excalidraw.

Read the information below to understand the capabilities. The user will prompt for an ExcalidrawAutomate script to be created. Use the examples, the ExcalidrawAutomate documentation, and the various type definitions to generate the script based on the user's requirements.

In addition to ExcalidrawAutomate, you can also use two other sources of functions:
- The Excalidraw API available via `ea.getExcalidrawAPI()`. Note: the API is only available if `ea.targetView` is set. When running Excalidraw scripts using the script engine, the provided `ea` object is already set up with targetView by default. Otherwise you need to first run `ea.setView()`.
- `window.ExcalidrawLib` which exposes a rich set of utility functions that do not require an active ExcalidrawView.

**CRITICAL RULE ON API SELECTION:** If a function or objective can be achieved via `ea` (ExcalidrawAutomate) methods, ALWAYS prefer `ea` over `window.ExcalidrawLib`. `ea` methods include essential wrapper logic to make features work flawlessly within the Obsidian environment.

- When the user asks for a dialog window, by default create a FloatingModal. Do not extend the FloatingModal class. Instead, define the modal's behavior by creating a new instance (e.g., `const modal = new ea.FloatingModal(...)`) and then assigning functions directly to the `onOpen` and `onClose` properties of that instance.
- Elements have a `customData` property that can be used to store arbitrary data. To ensure the data the script adds to elements use the `ea.addAppendUpdateCustomData` function. This function ensures that existing customData is preserved when adding new data.
- Elements can be hidden by setting their opacity to 0. When hiding elements this way, it is good practice to temporarily store their original opacity in customData. This allows for easy restoration of the original opacity later.
- Elements can be deleted from the scene by setting their isDeleted property to true.
- The Obsidian.md module is available on `ea.obsidian`.

**Sidepanels and multi-view tooling:**
- Sidepanels are for scripts that must stay open while users hop between multiple Excalidraw views. They should implement the SidepanelTab hooks (`onOpen`, `onFocus(view)`, `onClose`, `onExcalidrawViewClosed`) and manage their own `ea.targetView` explicitly.
- Persisted sidepanel scripts are launched during plugin startup (e.g., Obsidian restart, plugin update) with `ea.targetView === null`. Scripts must handle this by deferring view-bound work until `onFocus` delivers a view; call `ea.setView(view)` when you decide to bind.
- Each `ea` instance may host a single `sidepanelTab`. Create the tab with `ea.createSidepanelTab(title, persist=false, reveal=true)`; the returned `ea.sidepanelTab` exposes `contentEl`, `setContent`, `setTitle`, `setDisabled`, `setCloseCallback`, `open/close`, and focus lifecycle hooks.
- Use `checkForActiveSidepanelTabForScript` to avoid creating duplicate tabs for the same script name.

#### **1. The Core Workflow: Handling Element Immutability**

*   **Central Rule:** Elements in the Excalidraw scene are immutable and should never be modified directly. Always use the ExcalidrawAutomate (EA) "workbench" pattern for modifications.
*   **The Workflow:**
    1.  Get elements from the current view using `ea.getViewElements()` or `ea.getViewSelectedElements()`.
    2.  Copy these elements into the EA workbench for editing using `ea.copyViewElementsToEAforEditing(elements)`.
    3.  Modify the properties of the element copies that are now in the EA workbench (e.g., `ea.getElement(id).locked = true;`).
    4.  Commit the changes back to the scene using `await ea.addElementsToView()`.
*   **Deletion:** To delete an element, set its `isDeleted` property to `true` on the workbench copy (`ea.getElement(id).isDeleted = true;`) and then commit with `await ea.addElementsToView()`.

#### **2. User Interaction: Prompts and Dialogs**

*   **Simple Input:** For straightforward user input, use the `utils` object provided to the script.
    *   `await utils.inputPrompt()`: To get a string or number from the user.
    *   `await utils.suggester()`: To let the user select from a predefined list of options.
*   **Complex Dialogs:** When a more complex UI with multiple controls is needed, create a floating dialog window.
    *   **Use `FloatingModal`:** Always create a new instance: `const modal = new ea.FloatingModal(ea.plugin.app);`.

#### **3. Data Persistence and Customization**

*   **Storing Custom Data:** Elements have a `customData` property for arbitrary data.
    *   **Always Use `ea.addAppendUpdateCustomData(id, newData)`:** This is crucial. It safely adds or updates your key-value pairs without overwriting data that might have been stored by other scripts or the Excalidraw plugin itself.
*   **Creating Configurable Scripts:** To make your script's behavior customizable by the user:
    *   Use `ea.getScriptSettings()` to retrieve saved settings.
    *   Use `await ea.setScriptSettings(settings)` to save any changes.

#### **4. Best Practices and Advanced Techniques**

*   **Script Overview Block (MANDATORY):** Create, and consistently maintain with each update, a comprehensive comment block at the very beginning of the script. This block must explain the purpose of the script, its key features, and the high-level solution logic or architecture.
*   **Strictly Modular Architecture (NO LOOSE CODE):** Avoid creating large monolithic blocks of code or leaving logic loose at the root level of the script. Instead, organize *everything* into relatively small, atomic functions. This includes UI components as well.
*   **Evergreen JSDoc Headers and Comments:** Every function must have a proper JSDoc/Javadoc-style header containing parameter names, types, and a clear description of the function's purpose.
*   **Isolate Constants and User-Facing Strings:** *Do not embed hardcoded magic values, config parameters, or UI strings deep inside the logic.* You must separate all constants and language strings and collect them at the very top of the file.
*   **Icons:** Obsidian uses https://lucide.dev icons. These icons are available for scripts via `ea.obsidian.getIcon("Icon Name")`.
*   **Omit Version Verification:** *Do not add a version verification section* when generating a new script unless explicitly instructed to do so.
*   **Embrace `await`:** Many EA functions are asynchronous and return a `Promise` (e.g., `ea.addElementsToView()`, `ea.createSVG()`, `utils.inputPrompt()`). **Always** use `await` when calling these functions to ensure your script executes in the correct order.

## References
The `references/` directory contains supporting documentation necessary for writing scripts:
- `references/type-definitions.md`: Core type definitions for ExcalidrawAutomate.
- `references/excalidraw-lib-functions.md`: Function signatures for `window.ExcalidrawLib`.
- `references/startup-scripts.md`: ExcalidrawStartup script template and examples.
- `references/api-usage-index.md`: A highly useful index mapping every API method (ea.*, api.*, ExcalidrawLib.*) to the specific example scripts that utilize them.
- `references/scripts/`: A folder containing all the raw, real-world example scripts.

### How to use the Script Examples
If you need to implement a specific function (e.g., `ea.addElementsToView`), do NOT guess its implementation context. Instead:
1. Open `references/api-usage-index.md`.
2. Find the function name.
3. Note the scripts listed next to it.
4. Read the corresponding script inside the `references/scripts/` directory to see a complete, working example of how the function is used in context.
