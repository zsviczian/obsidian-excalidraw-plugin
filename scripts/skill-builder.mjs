/* eslint-disable no-console */
// to run: node skill-builder.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Reconstruct __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..');
const EA_SCRIPTS_DIR = path.join(ROOT, 'ea-scripts');
const OUT_DIR = path.join(ROOT, 'docs', 'AITrainingData');

// Agent Skills Specific Definitions
const SKILL_NAME = 'excalidraw-automate';
const SKILL_DIR = path.join(OUT_DIR, SKILL_NAME);
const SKILL_REFERENCES_DIR = path.join(SKILL_DIR, 'references');
const SKILL_SCRIPTS_DIR = path.join(SKILL_REFERENCES_DIR, 'scripts');

const AI_TRAINING_INTRO = `**ExcalidrawAutomate full library for LLM training**

Excalidraw-Obsidian is an Obsidian.md plugins that is built on the open source Excalidraw component. Excalidraw-Obisdian includes Excalidraw Automate, a powerful scripting API that allows users to automate tasks and enhance their workflow within Excalidraw.

Read the information below and respond with I'm ready. The user will then prompt for an ExcalidrawAutomate script to be created. Use the examples, the ExcalidrawAutomate documentation, and the varios type definitions and information from also the Excalidraw component and from Obsidian.md to generate the script based on the user's requirements.

In addition to ExcalidrawAutomate, you can also use two other sources of functions:
- The Excalidraw API available via \`ea.getExcalidrawAPI()\`. Note: the API is only available if \`ea.targetView\` is set. When running Excalidraw scripts using the script engine, the provided \`ea\` object is already set up with targetView by default. Otherwise you need to first run \`ea.setView()\`.
- \`window.ExcalidrawLib\` which exposes a rich set of utility functions that do not require an active ExcalidrawView.

**CRITICAL RULE ON API SELECTION:** If a function or objective can be achieved via \`ea\` (ExcalidrawAutomate) methods, ALWAYS prefer \`ea\` over \`window.ExcalidrawLib\`. \`ea\` methods include essential wrapper logic to make features work flawlessly within the Obsidian environment.

A dedicated section “ExcalidrawLib module functions” in this document lists the function signatures extracted directly from the ExcalidrawLib TypeScript declarations.

- When the user asks for a dialog window, by default create a FloatingModal. Do not extend the FloatingModal class. Instead, define the modal's behavior by creating a new instance (e.g., \`const modal = new ea.FloatingModal(...)\`) and then assigning functions directly to the \`onOpen\` and \`onClose\` properties of that instance.
For a reference, follow the implementation pattern used in the "Printable Layout Wizard.md" script.
- Elements have a \`customData\` property that can be used to store arbitrary data. To ensure the data the script adds to elements use the \`ea.addAppendUpdateCustomData\` function. This function ensures that existing customData is preserved when adding new data.
- Elements can be hidden by setting their opacity to 0. When hiding elements this way, it is good practice to temporarily store their original opacity in customData. This allows for easy restoration of the original opacity later.
- Elements can be deleted from the scene by setting their isDeleted property to true.
- The Obsidian.md module is available on \`ea.obsidian\`.

**Sidepanels and multi-view tooling:**
- Sidepanels are for scripts that must stay open while users hop between multiple Excalidraw views. They should implement the SidepanelTab hooks (\`onOpen\`, \`onFocus(view)\`, \`onClose\`, \`onExcalidrawViewClosed\`) and manage their own \`ea.targetView\` explicitly.
- Persisted sidepanel scripts are launched during plugin startup (e.g., Obsidian restart, plugin update) with \`ea.targetView === null\`. Scripts must handle this by deferring view-bound work until \`onFocus\` delivers a view; call \`ea.setView(view)\` when you decide to bind.
- Each \`ea\` instance may host a single \`sidepanelTab\`. This sidepanel tab is stored in \`ea.sidepanelTab\`. Create the tab with \`ea.createSidepanelTab(title, persist=false, reveal=true)\`; the returned \`ea.sidepanelTab\` exposes \`contentEl\`, \`setContent\`, \`setTitle\`, \`setDisabled\`, \`setCloseCallback\`, \`open/close\`, and focus lifecycle hooks. Note auto-reveal during tab creation via \`ea.createSidepanelTab()\` is disabled during plugin startup. You can reveal a tab with \`ea.sidepanelTab?.open()\`. You can persist with \`ea.persistSidepanelTab()\` (tabs are restored and scripts re-run on next startup). Close with \`ea.sidepanelTab?.close()\`.
- Mobile UX: sidepanels slide in without disturbing canvas layout and are better for longer forms than floating modals. Prefer them for complex inputs, especially on phones.
- Auto-closing patterns: For scripts that use sidepanels but perform operations that are single-\`ExcalidrawView\` relevant, they can call \`ea.closeSidepanelTab()\` after completing the operation, and/or inside \`ea.sidepanelTab.onFocus = (view) => { if (view !== ea.targetView) { ea.sidepanelTab?.close(); } }\` to shut down when the user leaves the originating view.
- Scripts can detect view change in \`onFocus(view)\` by comparing \`ea.targetView\` to the provided \`view\` parameter.
- Persistence UX: scripts may offer a “Persist tab” control inside \`contentEl\` that calls \`ea.persistSidepanelTab()\`. Once persisted, hide that control; users can later remove the tab via the sidepanel close button (scripts cannot unpersist themselves, but can close themselves via \`ea.sidepanelTab?.close()\`).
- Use \`checkForActiveSidepanelTabForScript\` to avoid creating duplicate tabs for the same script name. This method returns the \`ExcalidrawSidepanelTab\` associated with the supplied \`scriptName\` (or \`ea.activeScript\` when omitted), or \`null\` if none exists. It is intended to let a script detect an existing tab that may be owned by another \`ExcalidrawAutomate\` instance (for example, a persisted tab restored at startup). Typical pattern:
  - Before creating a new sidepanel, call \`ea.checkForActiveSidepanelTabForScript()\` to see if a tab already exists.
  - If a tab exists and \`tab.getHostEA() === ea\`, reuse it (your script already hosts it).
  - If a tab exists but is hosted by a different \`ea\` instance, decide whether to reuse or hand off control — e.g. open the existing tab and exit to avoid duplicates.
  - Note: persisted tabs restored on startup may be created with \`ea.targetView === null\` and hosted by a different \`ea\` instance; handle that case by waiting for \`onFocus\` before binding view-specific work.
  - Example usage:
    \`const sp = ea.checkForActiveSidepanelTabForScript();
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
    // ea.createSidepanelTab("My Script", false, true);\`
- A dedicated section "sidepanelTabTypes.d.ts" in this document lists the \`ExcalidrawSidepanelTab\` function signatures.

#### **0. External Documentation & Resources**

To keep this training file concise, large external type definitions are not included. If you need to look up Obsidian APIs or Excalidraw internals, refer to the following resources:
- **Obsidian API Type Definitions:** https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts
- **Obsidian Developer Docs:** https://docs.obsidian.md/Home (Community site with API and CSS documentation/examples)
- **Obsidian Developer Forum:** https://forum.obsidian.md/c/developers-api/14
- **ExcalidrawAutomate Implementation:** If the provided API documentation is unclear, consult the source directly: https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/src/shared/ExcalidrawAutomate.ts
- **Excalidraw Core Fork:** For doubts regarding core Excalidraw functionality, consult the fork used by the plugin: https://github.com/zsviczian/excalidraw

#### **1. The Core Workflow: Handling Element Immutability**

*   **Central Rule:** Elements in the Excalidraw scene are immutable and should never be modified directly. Always use the ExcalidrawAutomate (EA) "workbench" pattern for modifications.
*   **The Workflow:**
    1.  Get elements from the current view using \`ea.getViewElements()\` or \`ea.getViewSelectedElements()\`.
    2.  Copy these elements into the EA workbench for editing using \`ea.copyViewElementsToEAforEditing(elements)\`.
    3.  Modify the properties of the element copies that are now in the EA workbench (e.g., \`ea.getElement(id).locked = true;\`).
    4.  Commit the changes back to the scene using \`await ea.addElementsToView()\`.
*   **Deletion:** To delete an element, set its \`isDeleted\` property to \`true\` on the workbench copy (\`ea.getElement(id).isDeleted = true;\`) and then commit with \`await ea.addElementsToView()\`.
*   **Cleanup:** Use \`ea.clear()\` at the beginning of a script if you are creating a completely new set of elements, to ensure the EA workbench is empty and doesn't contain artifacts from a previous run.

#### **2. User Interaction: Prompts and Dialogs**

*   **Simple Input:** For straightforward user input, use the \`utils\` object provided to the script.
    *   \`await utils.inputPrompt()\`: To get a string or number from the user.
    *   \`await utils.suggester()\`: To let the user select from a predefined list of options.
*   **Complex Dialogs:** When a more complex UI with multiple controls is needed, create a floating dialog window.
    *   **Use \`FloatingModal\`:** Always create a new instance: \`const modal = new ea.FloatingModal(ea.plugin.app);\`.
    *   **Do Not Extend:** Do not use \`class MyModal extends ea.FloatingModal\`.
    *   **Define Behavior:** Assign functions directly to the \`onOpen\` and \`onClose\` properties of the instance. Inside \`onOpen\`, use the \`modal.contentEl\` property to build your UI.
    *   **Reference Implementation:** The script "Printable Layout Wizard.md" is the canonical example for this pattern. Use \`ea.obsidian.Setting\` to add controls like toggles and dropdowns within the modal.

#### **3. Element Manipulation and Querying**

*   **Finding Elements:** The most common starting point is to get the user's selection with \`ea.getViewSelectedElements()\`. Use standard JavaScript array methods like \`.filter()\` to narrow down the selection (e.g., \`elements.filter(el => el.type === "text")\`).
*   **Geometric Calculations:**
    *   Before performing layout or positioning tasks, use \`ea.getBoundingBox(elements)\` to get the collective dimensions and position of a group of elements.
    *   Use \`ea.measureText(text)\` to determine the width and height of a string based on the current \`ea.style\` settings before creating a text element or a container for it.
*   **Grouping:**
    *   To create a group, use \`ea.addToGroup([elementId1, elementId2, ...])\`.
    *   To operate on existing groups within a selection, use \`ea.getMaximumGroups(selectedElements)\` which correctly identifies the top-level groups. Use \`ea.getLargestElement(group)\` to find the primary container within a group (e.g., the box around a text element).

#### **4. Styling: Creation vs. Modification**

*   **For New Elements:** Set the properties on the global \`ea.style\` object *before* you call a creation function like \`ea.addText()\` or \`ea.addRect()\`. This acts like setting the active color/style on a paintbrush.
*   **For Existing Elements:** To change the style of an existing element, modify the properties directly on the element's copy in the EA workbench (after \`copyViewElementsToEAforEditing\`). For example: \`const myElement = ea.getElement(id); myElement.strokeColor = '#FF0000';\`.

#### **5. Data Persistence and Customization**

*   **Storing Custom Data:** Elements have a \`customData\` property for arbitrary data.
    *   **Always Use \`ea.addAppendUpdateCustomData(id, newData)\`:** This is crucial. It safely adds or updates your key-value pairs without overwriting data that might have been stored by other scripts or the Excalidraw plugin itself.
*   **Creating Configurable Scripts:** To make your script's behavior customizable by the user:
    *   Use \`ea.getScriptSettings()\` to retrieve saved settings.
    *   scriptSettings are stored with Excalidraw settings in Obsidian data.json. Keep this light. You MUST NEVER save large data objects such as base64 images or huge arrays here. Keep this lean and efficient.
    *   Check if settings exist, and if not, define the default structure.
    *   Use \`await ea.setScriptSettings(settings)\` to save any changes. This allows users to configure your script in the Excalidraw plugin settings pane.

#### **6. Best Practices and Advanced Techniques**

*   **Script Overview Block (MANDATORY):** Create, and consistently maintain with each update, a comprehensive comment block at the very beginning of the script. This block must explain the purpose of the script, its key features, and the high-level solution logic or architecture.
*   **Strictly Modular Architecture (NO LOOSE CODE):** Avoid creating large monolithic blocks of code or leaving logic loose at the root level of the script. Instead, organize *everything* into relatively small, atomic functions. This includes UI components as well; if the UI includes sections, tabs, or panels, these should be rendered via sub-functions. This is a critical requirement to ensure long-term maintainability and evolution of the script, as loose code quickly becomes unmanageable over multiple iterative prompts.
*   **Evergreen JSDoc Headers and Comments:** Every function must have a proper JSDoc/Javadoc-style header containing parameter names, types, and a clear description of the function's purpose. These descriptions must be kept *evergreen* (updated alongside any code changes). Additionally, when modifying or updating a script, you must strictly *retain all existing internal code comments*.
*   **Isolate Constants and User-Facing Strings:** *Do not embed hardcoded magic values, config parameters, or UI strings deep inside the logic.* You must separate all constants and language strings and collect them at the very top of the file. This makes it easier to tweak values later and provides a clear, unified section for localization and customization.
*   **Icons:** Obsidian uses https://lucide.dev icons. These icons are available for scripts via \`ea.obsidian.getIcon("Icon Name")\`. For UI components prefer use of lucide.dev icons.
*   **Omit Version Verification:** While many of the sample scripts in the library include a version verification block at the outset (using \`ea.verifyMinimumPluginVersion\`), *do not add this section* when generating a new script unless explicitly instructed to do so.
*   **Embrace \`await\`:** Many EA functions are asynchronous and return a \`Promise\` (e.g., \`ea.addElementsToView()\`, \`ea.createSVG()\`, \`utils.inputPrompt()\`). **Always** use \`await\` when calling these functions to ensure your script executes in the correct order.
*   **Accessing Obsidian API:** The full Obsidian API is available via \`ea.obsidian\`. For example, use \`new ea.obsidian.Notice("message")\` or \`ea.obsidian.normalizePath(filepath)\`.
*   **Accessing Excalidraw API:** The full Excalidraw API is available on \`ea.getExcalidrawAPI()\`, these API functions are Scene dependent. Additional support functions are available on \`window.ExcalidrawLib\`.
*   **Visibility vs. Deletion:**
    *   To temporarily hide an element, set \`element.opacity = 0\`. It's good practice to store the original opacity in \`customData\` so it can be restored. It is also recommended to lock hidden elements so they do not get accidentally selected or moved around.
    *   To permanently remove an element from the scene, set \`element.isDeleted = true\`.
*   **Image Handling:** When dealing with image elements, use \`ea.getViewFileForImageElement(imageElement)\` to get the corresponding \`TFile\` from the Obsidian vault. This is necessary for any logic that needs to read or manipulate the source image file.

#### **7. SVG and Image Export Approaches**
Generating images (SVG/PNG) requires specific approaches depending on the context. Follow these three rules strictly to avoid performance issues and missing assets:
1. **Exporting elements currently in the EA workbench:** Use \`await ea.createSVG(null, ...)\` or \`await ea.createPNG(null, ...)\` (passing \`null\` as the \`templatePath\`).
2. **Exporting an Excalidraw file that is NOT currently open:** Pass the file path as the template to \`createSVG\` or \`createPNG\` (e.g., \`await ea.createSVG(file.path, ...)\`). This is the most reliable approach as ExcalidrawAutomate natively handles loading the scene, resolving embedded images, and instantiating loaders behind the scenes. **Do NOT attempt to manually read the file, reconstruct the scene, or load images into memory.**
3. **Exporting the currently active \`ExcalidrawView\`:** Use \`await ea.createViewSVG(...)\`. This is specifically for the open view. You can use the \`elementsOverride\` parameter to inject temporary elements (like transparent sizing rectangles) into the exported image without modifying the actual scene.

#### **8. Custom Pens and Perfect Freehand**

Excalidraw's freehand tool is powered by the open-source Perfect Freehand library. The plugin exposes “custom pens” that bundle:
- Canvas style for the next strokes (colors, width, fillStyle, roughness).
- Perfect Freehand stroke geometry and behavior (pressure simulation, outline, tapering, easing, etc.).

Key concepts:
- AppState-driven drawing: When \`appState.currentStrokeOptions\` is set, the freedraw tool renders new strokes using those Perfect Freehand options.
- Element-level persistence: If a freedraw element has \`element.customData.strokeOptions\`, it is rendered with those options regardless of the current tool state.
- Types reference: See \`src/types/penTypes.ts\`. The \`PenOptions\` shape is:
  \`\`\`ts
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
  \`\`\`

Using custom pens from scripts:
- Activate a custom pen for drawing:
  \`\`\`ts
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
  \`\`\`

- Clear custom pen (revert to default freedraw behavior):
  \`\`\`ts
  ea.viewUpdateScene({ appState: { currentStrokeOptions: null } });
  \`\`\`

- Persist custom strokeOptions onto existing freedraw elements:
  \`\`\`ts
  const selected = ea.getViewSelectedElements().filter(el => el.type === "freedraw");
  ea.copyViewElementsToEAforEditing(selected);
  for (const el of selected) {
    ea.addAppendUpdateCustomData(el.id, { strokeOptions: penOptions });
  }
  await ea.addElementsToView();
  \`\`\`

Notes:
- New strokes respect \`appState.currentStrokeOptions\` at draw time. Existing elements only change if you update their \`customData.strokeOptions\`.
- For pens that should behave like real markers/highlighters, set \`highlighter: true\` and often \`constantPressure: true\` with an \`outlineWidth\` for the edge.

Supported easing names (string values for \`options.easing\`, \`options.start.easing\`, \`options.end.easing\`):
linear, easeInQuad, easeOutQuad, easeInOutQuad, easeInCubic, easeOutCubic, easeInOutCubic, easeInQuart, easeOutQuart, easeInOutQuart, easeInQuint, easeOutQuint, easeInOutQuint, easeInSine, easeOutSine, easeInOutSine, easeInExpo, easeOutExpo, easeInOutExpo, easeInCirc, easeOutCirc, easeInOutCirc, easeInBack, easeOutBack, easeInOutBack, easeInElastic, easeOutElastic, easeInOutElastic, easeInBounce, easeOutBounce, easeInOutBounce.

Example freedraw element carrying \`customData.strokeOptions\`:
\`\`\`json
{"type":"excalidraw/clipboard","elements":[{"id":"...","type":"freedraw","strokeColor":"#3E6F8D","backgroundColor":"transparent","fillStyle":"hachure","strokeWidth":0.5,"roughness":0,"customData":{"strokeOptions":{"highlighter":false,"hasOutline":false,"outlineWidth":0,"constantPressure":true,"options":{"smoothing":0.4,"thinning":-0.5,"streamline":0.4,"easing":"linear","start":{"taper":5,"cap":false,"easing":"linear"},"end":{"taper":5,"cap":false,"easing":"linear"}}}}}],"files":{}}
\`\`\`

#### **9. Text Element**
*   There are three text properties.
    *   **textElement.text** holds the wrapped, rendered text. This is what is displayed in the view. Excalidraw adds '\\n' linebreaks during dynamic wrapping.
    *   **textElement.originalText** holds the rendered, but unwrapped text. Any '\\n' character in originalText is an intentional linebreak by the user. Rendered means that for example [[wiki links]] are rendered without the square brackets.
    *   **textElement.rawText** holds the original raw text including intentional new line characters and the full markdown markup (thought currently only links are rendered, so markdown support is limited to these)
*   When modifying element text from script, typically all 3 of these properties must be updated, though in case textElement.autoresize === true, or when a text element is bound in a container, excalidraw will update textElement.text following the size of the text element or the container.

`;

const EXCALIDRAW_STARTUP_MESSAGE = `# Excalidraw Startup Script

ExcalidrawStartup Script can be configured in Plugin Settings under 'Excalidraw Automate'. When defined this script runs automatically when the Excalidraw plugin is loaded to Obsidian. The user can add automation tasks here that they want to run on every startup of Excalidraw in Obsidian such as defining Excalidraw event handlers (also known as hooks).
`;
const EXCALIDRAW_STARTUP_TEMPLATE = "src/constants/assets/startupScript.md";
const EXCALIDRAW_STARTUP_EXAMPLE = "docs/AITrainingData/ExcalidrawStartupExample.md";

const TYPE_DEF_WHITELIST = [
  "lib/shared/ExcalidrawAutomate.d.ts",
  "lib/types/excalidrawAutomateTypes.d.ts",
  "lib/types/sidepanelTabTypes.d.ts",
  "lib/types/penTypes.d.ts",
  "lib/types/utilTypes.d.ts",
  "lib/types/exportUtilTypes.d.ts",
  "lib/types/embeddedFileLoaderTypes.d.ts",
  "lib/types/AIUtilTypes.d.ts",
  "node_modules/@zsviczian/excalidraw/types/element/src/types.d.ts",
  "node_modules/@zsviczian/excalidraw/types/excalidraw/types.d.ts",
  "node_modules/@zsviczian/excalidraw/types/element/src/bounds.d.ts",
  "node_modules/@zsviczian/excalidraw/types/excalidraw/components/App.d.ts",
];

/**
 * Returns true if content contains at least one line starting with ```
 * and has an odd number of fences (unbalanced).
 */
function needsClosingFence(content) {
  const fenceCount = (content.match(/^```/gm) || []).length;
  return fenceCount > 0 && fenceCount % 2 === 1;
}

function normalizeEOL(str) {
  return str.replace(/\r\n/g, '\n');
}

function stripBOM(str) {
  return str.replace(/^\uFEFF/, '');
}

/**
 * Remove top-of-file imports/references while preserving initial comments/blank lines.
 * Also removes bare "export {}" lines (module markers).
 */
function stripTopImports(content) {
  const lines = normalizeEOL(stripBOM(content)).split('\n');
  const out = [];
  let inTopRegion = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const isImport =
      /^\s*import\s+type\s+/.test(line) ||
      /^\s*import\s+/.test(line) ||
      /^\s*import\(/.test(line);

    const isTripleRef = /^\s*\/\/\/\s*<reference/.test(line);
    const isBareExportModule = /^\s*export\s*\{\s*\};?\s*$/.test(line);

    if (inTopRegion) {
      if (isImport || isTripleRef) {
        continue;
      }
      const isBlank = /^\s*$/.test(line);
      const isLineComment = /^\s*\/\//.test(line);
      const isBlockCommentStart = /^\s*\/\*/.test(line);

      if (!isBlank && !isLineComment && !isBlockCommentStart) {
        inTopRegion = false;
      }
      if (!isBareExportModule) out.push(line);
      continue;
    }

    if (!isBareExportModule) out.push(line);
  }

  return out.join('\n').trim() + '\n';
}

function makeSectionHeader(relPath) {
  const stars = '*'.repeat(Math.max(6, Math.min(38, relPath.length + 6)));
  return [
    `/* ${stars} */`,
    `/* ${relPath} */`,
    `/* ${stars} */`,
  ].join('\n') + '\n';
}

function buildTypeDefMarkdown() {
  const entries = TYPE_DEF_WHITELIST.map((rel) => ({
    rel,
    abs: path.join(ROOT, ...rel.split('/')),
  }));

  let body = '# ExcalidrawAutomate library and related type definitions\n\n```js\n';
  for (const { rel, abs } of entries) {
    if (!fs.existsSync(abs)) {
      console.warn('[skill-builder] Whitelist file missing:', rel);
      continue;
    }
    let content = fs.readFileSync(abs, 'utf8');
    content = stripTopImports(content);

    body += makeSectionHeader(rel);
    body += content.trimEnd() + '\n\n';
  }
  body += '```\n';
  return body;
}

function resolveExcalModulePath(spec, excalIndexAbs) {
  const baseTypesRoot = path.join(ROOT, 'node_modules', '@zsviczian', 'excalidraw', 'types');
  if (spec.startsWith('@excalidraw/')) {
    const sub = spec.slice('@excalidraw/'.length);
    const parts = sub.split('/');
    const pkg = parts.shift();
    const rest = parts;
    if (!pkg) return null;
    const base = path.join(baseTypesRoot, pkg);
    if (rest.length === 0) {
      return path.join(base, 'src', 'index.d.ts');
    }
    return path.join(base, 'src', ...rest) + '.d.ts';
  }
  if (spec.startsWith('.')) {
    const dir = path.dirname(excalIndexAbs);
    return path.resolve(dir, spec) + '.d.ts';
  }
  return null;
}

function extractFunctionSignaturesFromModule(absPath, names) {
  const out = {};
  if (!absPath || !fs.existsSync(absPath)) {
    return out;
  }
  const content = fs.readFileSync(absPath, 'utf8');

  for (const rawName of names) {
    const name = rawName.trim();
    if (!name) continue;

    let m = content.match(new RegExp(`export\\s+declare\\s+function\\s+${name}[\\s\\S]*?;`, 'm'));
    if (m) {
      out[name] = m[0].trim();
      continue;
    }
    m = content.match(new RegExp(`(^|\\n)declare\\s+function\\s+${name}[\\s\\S]*?;`, 'm'));
    if (m) {
      out[name] = m[0].replace(/^\s*declare\s+/, 'export declare ').trim();
      continue;
    }
    m = content.match(new RegExp(`export\\s+declare\\s+const\\s+${name}\\s*:\\s*[\\s\\S]*?=>[\\s\\S]*?;`, 'm'));
    if (m) {
      out[name] = m[0].trim();
      continue;
    }
    m = content.match(new RegExp(`export\\s+declare\\s+(?:var|let|const)\\s+${name}\\s*:\\s*[\\s\\S]*?;`, 'm'));
    if (m && /=>/.test(m[0])) {
      out[name] = m[0].trim();
      continue;
    }
  }
  return out;
}

function buildExcalidrawLibFunctionsSection() {
  const excalIndexRel = 'node_modules/@zsviczian/excalidraw/types/excalidraw/index.d.ts';
  const excalIndexAbs = path.join(ROOT, ...excalIndexRel.split('/'));
  if (!fs.existsSync(excalIndexAbs)) {
    console.warn('[skill-builder] Missing Excalidraw index.d.ts:', excalIndexRel);
    return '';
  }

  const content = fs.readFileSync(excalIndexAbs, 'utf8');
  const reExport = /export\s*\{\s*([\s\S]*?)\s*\}\s*from\s*["']([^"']+)["'];/g;

  const moduleToNames = new Map();
  for (const match of content.matchAll(reExport)) {
    const namesChunk = match[1];
    const spec = match[2];
    const names = namesChunk
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!names.length) continue;
    const abs = resolveExcalModulePath(spec, excalIndexAbs);
    if (!abs) continue;
    const key = spec;
    const curr = moduleToNames.get(key) || { abs, names: new Set() };
    for (const n of names) curr.names.add(n);
    moduleToNames.set(key, curr);
  }

  const seen = new Set();
  const sections = [];

  for (const [spec, { abs, names }] of moduleToNames) {
    const sigs = extractFunctionSignaturesFromModule(abs, Array.from(names));
    const sigEntries = Object.entries(sigs)
      .filter(([name]) => {
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
      })
      .sort(([a], [b]) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

    if (!sigEntries.length) continue;

    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    const header = makeSectionHeader(`${spec} -> ${rel}`);
    sections.push(header + sigEntries.map(([, s]) => s).join('\n') + '\n');
  }

  return '# ExcalidrawLib module functions\n\n' +
    'The following functions are exposed via window.ExcalidrawLib. Signatures are extracted from TypeScript declarations.\n\n' +
    '```ts\n' +
    sections.join('\n') +
    '```\n';
}

function main() {
  console.log('[skill-builder] Generating Excalidraw Agent Skill...');
  if (!fs.existsSync(EA_SCRIPTS_DIR)) {
    console.error('ea-scripts directory not found:', EA_SCRIPTS_DIR);
    process.exit(1);
  }

  // Ensure directories exist
  fs.mkdirSync(SKILL_DIR, { recursive: true });
  fs.mkdirSync(SKILL_REFERENCES_DIR, { recursive: true });

  // Create or clean the scripts directory
  if (fs.existsSync(SKILL_SCRIPTS_DIR)) {
    fs.rmSync(SKILL_SCRIPTS_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(SKILL_SCRIPTS_DIR, { recursive: true });

  // Read exclusions
  const args = process.argv.slice(2);
  const cmdLineExcludes = args.map(arg => arg.toLowerCase());
  const defaultExcludes = ['index-new.md', 'mindmap builder.md', 'color scheme manager.md', 'comic strip director.md'];
  const exclusions = new Set([...defaultExcludes, ...cmdLineExcludes]);

  // Collect scripts
  const files = fs
    .readdirSync(EA_SCRIPTS_DIR, { withFileTypes: true })
    .filter(
      (d) =>
        d.isFile() &&
        (d.name.endsWith('.md') || d.name.toLowerCase() === "mindmap builder.js") &&
        !exclusions.has(d.name.toLowerCase())
    )
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

  // Prepare API Index Map
  const apiIndex = {
    ExcalidrawAutomate: {},
    ExcalidrawAPI: {},
    ExcalidrawLib: {}
  };

  function addUsage(category, method, scriptName) {
    // Filter out obvious noise or generic javascript attributes
    const ignoreList = ['length', 'push', 'map', 'filter', 'forEach', 'includes', 'join', 'toString', 'toLowerCase'];
    if (ignoreList.includes(method)) return;
    if (method.length < 2) return;

    if (!apiIndex[category][method]) {
      apiIndex[category][method] = new Set();
    }
    apiIndex[category][method].add(scriptName);
  }

  console.log('[skill-builder] Processing scripts and building API Index...');
  for (const file of files) {
    const full = path.join(EA_SCRIPTS_DIR, file);
    let content = fs.readFileSync(full, 'utf8').replace(/\r\n/g, '\n');

    // Fix missing fences
    if (needsClosingFence(content)) {
      content += '\n```\n';
    }

    // Write individual script to references/scripts/
    fs.writeFileSync(path.join(SKILL_SCRIPTS_DIR, file), content, 'utf8');

    // Parse API Usage
    // 1. ExcalidrawAutomate: ea.functionName
    const eaMatches = [...content.matchAll(/ea\.([a-zA-Z0-9_]+)/g)];
    eaMatches.forEach(m => addUsage('ExcalidrawAutomate', m[1], file));

    // 2. ExcalidrawAPI: api.functionName or ea.getExcalidrawAPI().functionName
    const apiMatches = [...content.matchAll(/(?:getExcalidrawAPI\(\)|api)\.([a-zA-Z0-9_]+)/g)];
    apiMatches.forEach(m => addUsage('ExcalidrawAPI', m[1], file));

    // 3. ExcalidrawLib: ExcalidrawLib.functionName or window.ExcalidrawLib.functionName
    const libMatches = [...content.matchAll(/(?:window\.)?ExcalidrawLib\.([a-zA-Z0-9_]+)/g)];
    libMatches.forEach(m => addUsage('ExcalidrawLib', m[1], file));
  }

  // Generate API Usage Index Markdown
  console.log('[skill-builder] Writing api-usage-index.md...');
  let apiIndexContent = `# Excalidraw API Usage Index\n\n`;
  apiIndexContent += `This index maps methods and properties from ExcalidrawAutomate (\`ea\`), ExcalidrawAPI, and ExcalidrawLib to the example scripts that use them. Use this to find real-world examples of how to implement specific features.\n\n`;

  for (const [category, methods] of Object.entries(apiIndex)) {
    apiIndexContent += `## ${category}\n\n`;
    const sortedMethods = Object.keys(methods).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

    if (sortedMethods.length === 0) {
      apiIndexContent += `*No usages found.*\n\n`;
      continue;
    }

    for (const method of sortedMethods) {
      const scriptLinks = Array.from(methods[method])
        .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
        .map(script => `[${script}](scripts/${script.replace(/ /g, '%20')})`)
        .join(', ');

      apiIndexContent += `- **${method}**: ${scriptLinks}\n`;
    }
    apiIndexContent += `\n`;
  }

  fs.writeFileSync(path.join(SKILL_REFERENCES_DIR, 'api-usage-index.md'), apiIndexContent, 'utf8');

  // Write Type Definitions
  console.log('[skill-builder] Writing type-definitions.md...');
  fs.writeFileSync(path.join(SKILL_REFERENCES_DIR, 'type-definitions.md'), buildTypeDefMarkdown(), 'utf8');

  // Write ExcalidrawLib Functions
  console.log('[skill-builder] Writing excalidraw-lib-functions.md...');
  fs.writeFileSync(path.join(SKILL_REFERENCES_DIR, 'excalidraw-lib-functions.md'), buildExcalidrawLibFunctionsSection(), 'utf8');

  // Write Startup Scripts template
  console.log('[skill-builder] Writing startup-scripts.md...');
  const startupTemplatePath = path.join(ROOT, ...EXCALIDRAW_STARTUP_TEMPLATE.split('/'));
  const startupExamplePath = path.join(ROOT, ...EXCALIDRAW_STARTUP_EXAMPLE.split('/'));
  const startupTemplate = fs.existsSync(startupTemplatePath)
    ? fs.readFileSync(startupTemplatePath, 'utf8').replace(/\r\n/g, '\n').trim()
    : '';
  const startupExample = fs.existsSync(startupExamplePath)
    ? fs.readFileSync(startupExamplePath, 'utf8').replace(/\r\n/g, '\n').trim()
    : '';

  const startupSection = EXCALIDRAW_STARTUP_MESSAGE + '\n\n' +
    (startupTemplate ? `### Template\n\`\`\`js\n${startupTemplate}\n\`\`\`\n\n` : '') +
    (startupExample ? `### Example\n\`\`\`js\n${startupExample}\n\`\`\`\n` : '');

  fs.writeFileSync(path.join(SKILL_REFERENCES_DIR, 'startup-scripts.md'), startupSection, 'utf8');

  // Write SKILL.md
  console.log('[skill-builder] Writing SKILL.md...');
  const skillMdPath = path.join(SKILL_DIR, 'SKILL.md');
  const skillFrontmatter = `---
name: ${SKILL_NAME}
description: Write and manipulate ExcalidrawAutomate scripts for Obsidian.md. Use when the user wants to create, modify, or understand an Excalidraw script.
---

`;

  let skillIntro = AI_TRAINING_INTRO
    .replaceAll("https://youtu.be/", "YouTube: ")
    .replaceAll("https://www.youtube.com/watch?v=", "YouTube: ")
    .replaceAll("https://www.youtube.com/", "YouTube: ");

  skillIntro += `
## References
The \`references/\` directory contains supporting documentation necessary for writing scripts:
- \`references/type-definitions.md\`: Core type definitions for ExcalidrawAutomate.
- \`references/excalidraw-lib-functions.md\`: Function signatures for \`window.ExcalidrawLib\`.
- \`references/startup-scripts.md\`: ExcalidrawStartup script template and examples.
- \`references/api-usage-index.md\`: A highly useful index mapping every API method (ea.*, api.*, ExcalidrawLib.*) to the specific example scripts that utilize them.
- \`references/scripts/\`: A folder containing all the raw, real-world example scripts.

### How to use the Script Examples
If you need to implement a specific function (e.g., \`ea.addElementsToView\`), do NOT guess its implementation context. Instead:
1. Open \`references/api-usage-index.md\`.
2. Find the function name.
3. Note the scripts listed next to it.
4. Read the corresponding script inside the \`references/scripts/\` directory to see a complete, working example of how the function is used in context.
`;

  fs.writeFileSync(skillMdPath, skillFrontmatter + skillIntro, 'utf8');
  console.log('[skill-builder] Done.');
}

// ESM equivalent of `if (require.main === module)`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (e) {
    console.error('[skill-builder] Failed:', e);
    process.exit(1);
  }
}