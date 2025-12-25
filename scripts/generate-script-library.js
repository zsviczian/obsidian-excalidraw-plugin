/* eslint-disable no-console */
// to run: npm run doc
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EA_SCRIPTS_DIR = path.join(ROOT, 'ea-scripts');
const INDEX_NEW = path.join(EA_SCRIPTS_DIR, 'index-new.md');
const OUT_DIR = path.join(path.join(ROOT, 'docs'), 'AITrainingData');
const SCRIPT_LIBRARY_OUT = path.join(OUT_DIR, 'Excalidraw Script Library.md');
const TYPE_DEF_OUT = path.join(OUT_DIR, 'Excalidraw Automate library and related type definitions.md');
const AI_TRAINING_OUT = path.join(OUT_DIR, 'ExcalidrawAutomate full library for LLM training.md');

const AI_TRAINING_INTRO = `**ExcalidrawAutomate full library for LLM training**

Excalidraw-Obsidian is an Obsidian.md plugins that is built on the open source Excalidraw component. Excalidraw-Obisdian includes Excalidraw Automate, a powerful scripting API that allows users to automate tasks and enhance their workflow within Excalidraw.

Read the information below and respond with I'm ready. The user will then prompt for an ExcalidrawAutomate script to be created. Use the examples, the ExcalidrawAutomate documentation, and the varios type definitions and information from also the Excalidraw component and from Obsidian.md to generate the script based on the user's requirements.

In addition to ExcalidrawAutomate, you can also use two other sources of functions:
- The Excalidraw API available via ea.getExcalidrawAPI(). Note: the API is only available if ea.targetView is set. When running Excalidraw scripts using the script engine, the provided ea object is already set up with targetView by default. Otherwise you need to first run ea.setView().
- window.ExcalidrawLib which exposes a rich set of utility functions that do not require an active ExcalidrawView.

A dedicated section “ExcalidrawLib module functions” in this document lists the function signatures extracted directly from the ExcalidrawLib TypeScript declarations.

- When the user asks for a dialog window, by default create a FloatingModal. Do not extend the FloatingModal class. Instead, define the modal's behavior by creating a new instance (e.g., const modal = new ea.FloatingModal(...)) and then assigning functions directly to the onOpen and onClose properties of that instance.
For a reference, follow the implementation pattern used in the "Printable Layout Wizard.md" script.
- Elements have a customData property that can be used to store arbitrary data. To ensure the data the script adds to elements use the ea.addAppendUpdateCustomData function. This function ensures that existing customData is preserved when adding new data.
- Elements can be hidden by setting their opacity to 0. When hiding elements this way, it is good practice to temporarily store their original opacity in customData. This allows for easy restoration of the original opacity later.
- Elements can be deleted from the scene by setting their isDeleted property to true.
- The Obsidian.md module is available on ea.obsidian.

**Sidepanels and multi-view tooling:**
- Sidepanels are for scripts that must stay open while users hop between multiple Excalidraw views. They should implement the SidepanelTab hooks (\`onOpen\`, \`onFocus(view)\`, \`onClose\`, \`onExcalidrawViewClosed\`) and manage their own \`ea.targetView\` explicitly.
- Persisted sidepanel scripts are launched during plugin startup (e.g., Obsidian restart, plugin update) with \`ea.targetView === null\`. Scripts must handle this by deferring view-bound work until \`onFocus\` delivers a view; call \`ea.setView(view)\` when you decide to bind.
- Each ea instance may host a single sidepanelTab. This sidepanel tab is stored in ea.sidepanelTab. Create the tab with \`ea.createSidepanelTab(title, persist?, options?)\`; the returned \`ea.sidepanelTab\` exposes \`contentEl\`, \`setContent\`, \`setTitle\`, \`setDisabled\`, \`setCloseCallback\`, \`open/close\`, and focus lifecycle hooks. Reveal with \`ea.revealSidepanelTab()\`. Persist with \`ea.persistSidepanelTab()\` (tabs are restored and scripts re-run on next startup). Close with \`ea.closeSidepanelTab()\`.
- Mobile UX: sidepanels slide in without disturbing canvas layout and are better for longer forms than floating modals. Prefer them for complex inputs, especially on phones.
- Auto-closing patterns: For scripts that use sidepanels, but perform operations that are single ExcalidrawView relevant, they can call \`ea.closeSidepanelTab()\` after completing the operation, and/or inside \`ea.sidepanelTab.onFocus = (view) => { if (view !== ea.targetView) { ea.closeSidepanelTab(); } }\` to shut down when the user leaves the originating view.
- Scripts can detect view change in \`onFocus(view)\` by comparing \`ea.targetView\` to the provided view parameter.
- Persistence UX: scripts may offer a “Persist tab” control inside \`contentEl\` that calls \`ea.persistSidepanelTab()\`. Once persisted, hide that control; users can later remove the tab via the sidepanel close button (scripts cannot unpersist themselves, but can close themselves via ea.closeSidepanelTab()).
- A dedicated section "sidepanelTabTypes.d.ts" in this document lists the ExcalidrawSidepanelTab function signatures.

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
    *   Check if settings exist, and if not, define the default structure.
    *   Use \`await ea.setScriptSettings(settings)\` to save any changes. This allows users to configure your script in the Excalidraw plugin settings pane.

#### **6. Best Practices and Advanced Techniques**

*   **Embrace \`await\`:** Many EA functions are asynchronous and return a \`Promise\` (e.g., \`ea.addElementsToView()\`, \`ea.createSVG()\`, \`utils.inputPrompt()\`). **Always** use \`await\` when calling these functions to ensure your script executes in the correct order.
*   **Version Checking:** At the beginning of your script, include a check like \`if(!ea.verifyMinimumPluginVersion("1.X.X")) { new Notice(...); return; }\` to ensure the user has a compatible version of the Excalidraw plugin, preventing errors from missing API functions.
*   **Accessing Obsidian API:** The full Obsidian API is available via \`ea.obsidian\`. For example, use \`new ea.obsidian.Notice("message")\` or \`ea.obsidian.normalizePath(filepath)\`.
*   **Visibility vs. Deletion:**
    *   To temporarily hide an element, set \`element.opacity = 0\`. It's good practice to store the original opacity in \`customData\` so it can be restored. It is also recommended to lock hidden elements so they do not get accidentally selected or moved around.
    *   To permanently remove an element from the scene, set \`element.isDeleted = true\`.
*   **Image Handling:** When dealing with image elements, use \`ea.getViewFileForImageElement(imageElement)\` to get the corresponding \`TFile\` from the Obsidian vault. This is necessary for any logic that needs to read or manipulate the source image file.

#### **7. Custom Pens and Perfect Freehand**

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

`;

const SCRIPT_INTRO = `# Excalidraw Script Library Examples

This is an automatically generated knowledge base intended for Retrieval Augmented Generation (RAG) and other AI-assisted workflows (e.g. NotebookLM or local embeddings tools).  
Its purpose:
- Provide a single, query-friendly corpus of all Excalidraw Automate scripts.
- Serve as a practical pattern and snippet library for developers learning Excalidraw Automate.
- Preserve original source side by side with the higher-level index (index-new.md) to improve semantic recall.
- Enable AI tools to answer questions about how to manipulate the Excalidraw canvas, elements, styling, or integration features by referencing real, working examples.

Content structure:
1. SCRIPT_INTRO (this section)
2. The curated script overview (index-new.md)
3. Raw source of every *.md script in /ea-scripts (each fenced code block is auto-closed to ensure well-formed aggregation)

Generated on: ${new Date().toISOString()}

---

`;

const TYPE_DEF_INTRO = `# ExcalidrawAutomate library and related type definitions

`;

const EXCALIDRAW_STARTUP_MESSAGE = `# Excalidraw Startup Script

ExcalidrawStartup Script can be configured in Plugin Settings under 'Excalidraw Automate'. When defined this script runs automatically when the Excalidraw plugin is loaded to Obsidian. The user can add automation tasks here that they want to run on every startup of Excalidraw in Obsidian such as defining Excalidraw event handlers (also known as hooks).

Two files follow. First the template startup script with documenation comments, then an actual startup script example with implemented functionality.
`;
const EXCALIDRAW_STARTUP_TEMPLATE = "src/constants/assets/startupScript.md";
const EXCALIDRAW_STARTUP_EXAMPLE = "docs/AITrainingData/ExcalidrawStartupExample.md";

const ADDITIONAL_TYPE_DEFS_FOR_AI_TRAINING = [
  "node_modules/obsidian/obsidian.d.ts",
];

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
];

/**
 * Returns true if content contains at least one line starting with ```
 * and has an odd number of fences (unbalanced).
 */
function needsClosingFence(content) {
  const fenceCount = (content.match(/^```/gm) || []).length;
  return fenceCount > 0 && fenceCount % 2 === 1;
}

// Add: helpers for type-def aggregation
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
        // drop
        continue;
      }
      // comments and blanks are kept, top-region continues until first code (non-comment/non-blank/non-import)
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

/**
 * Create a nice section header for the concatenated file.
 */
function makeSectionHeader(relPath) {
  const stars = '*'.repeat(Math.max(6, Math.min(38, relPath.length + 6)));
  return [
    `/* ${stars} */`,
    `/* ${relPath} */`,
    `/* ${stars} */`,
  ].join('\n') + '\n';
}

/**
 * Build the concatenated types markdown body from the whitelist only.
 * - Removes top-of-file imports
 * - Adds section headers with relative paths
 * - Wraps all in one ```js code fence
 */
function buildTypeDefMarkdown() {
  const entries = TYPE_DEF_WHITELIST.map((rel) => ({
    rel,
    abs: path.join(ROOT, ...rel.split('/')),
  }));

  let body = '```js\n';
  for (const { rel, abs } of entries) {
    if (!fs.existsSync(abs)) {
      console.warn('[script-library] Whitelist file missing:', rel);
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

/**
 * Build additional type defs used only in AI_TRAINING_OUT (e.g. obsidian.d.ts).
 */
function buildAdditionalTypeDefsMarkdown() {
  const entries = ADDITIONAL_TYPE_DEFS_FOR_AI_TRAINING.map((rel) => ({
    rel,
    abs: path.join(ROOT, ...rel.split('/')),
  }));

  let body = '```js\n';
  for (const { rel, abs } of entries) {
    if (!fs.existsSync(abs)) {
      console.warn('[script-library] Additional type def missing:', rel);
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

// NEW: Resolve module specifiers from types/excalidraw/index.d.ts to absolute .d.ts paths
function resolveExcalModulePath(spec, excalIndexAbs) {
  const baseTypesRoot = path.join(ROOT, 'node_modules', '@zsviczian', 'excalidraw', 'types');
  if (spec.startsWith('@excalidraw/')) {
    const sub = spec.slice('@excalidraw/'.length); // e.g. 'element', 'element/bounds'
    const parts = sub.split('/');
    const pkg = parts.shift(); // 'element' | 'common' | 'utils'
    const rest = parts;
    if (!pkg) return null;
    const base = path.join(baseTypesRoot, pkg);
    if (rest.length === 0) {
      return path.join(base, 'src', 'index.d.ts');
    }
    return path.join(base, 'src', ...rest) + '.d.ts';
  }
  // relative to the excalidraw index.d.ts
  if (spec.startsWith('.')) {
    const dir = path.dirname(excalIndexAbs);
    return path.resolve(dir, spec) + '.d.ts';
  }
  // anything else is not expected
  return null;
}

// NEW: Extract function signatures for a set of names from a .d.ts file
function extractFunctionSignaturesFromModule(absPath, names) {
  const out = {};
  if (!absPath || !fs.existsSync(absPath)) {
    return out;
  }
  const content = fs.readFileSync(absPath, 'utf8');

  for (const rawName of names) {
    const name = rawName.trim();
    if (!name) continue;

    // Try "export declare function NAME ..."
    let m = content.match(new RegExp(`export\\s+declare\\s+function\\s+${name}[\\s\\S]*?;`, 'm'));
    if (m) {
      out[name] = m[0].trim();
      continue;
    }

    // Try "declare function NAME ..." (re-exported later)
    m = content.match(new RegExp(`(^|\\n)declare\\s+function\\s+${name}[\\s\\S]*?;`, 'm'));
    if (m) {
      // Ensure it starts with export for readability
      out[name] = m[0].replace(/^\s*declare\s+/, 'export declare ').trim();
      continue;
    }

    // Try "export declare const NAME: (...args) => ...;"
    m = content.match(new RegExp(`export\\s+declare\\s+const\\s+${name}\\s*:\\s*[\\s\\S]*?=>[\\s\\S]*?;`, 'm'));
    if (m) {
      out[name] = m[0].trim();
      continue;
    }

    // Try "export declare function-type via type alias" (rare) - fallback to any const function shape
    m = content.match(new RegExp(`export\\s+declare\\s+(?:var|let|const)\\s+${name}\\s*:\\s*[\\s\\S]*?;`, 'm'));
    if (m && /=>/.test(m[0])) {
      out[name] = m[0].trim();
      continue;
    }
  }
  return out;
}

// NEW: Build "ExcalidrawLib module functions" section from index.d.ts
function buildExcalidrawLibFunctionsSection() {
  const excalIndexRel = 'node_modules/@zsviczian/excalidraw/types/excalidraw/index.d.ts';
  const excalIndexAbs = path.join(ROOT, ...excalIndexRel.split('/'));
  if (!fs.existsSync(excalIndexAbs)) {
    console.warn('[script-library] Missing Excalidraw index.d.ts:', excalIndexRel);
    return '';
  }

  const content = fs.readFileSync(excalIndexAbs, 'utf8');
  const reExport = /export\s*\{\s*([\s\S]*?)\s*\}\s*from\s*["']([^"']+)["'];/g;

  // Collect names by source module
  const moduleToNames = new Map();
  for (const match of content.matchAll(reExport)) {
    const namesChunk = match[1];
    const spec = match[2];
    // skip if the export list contains only types we know we shouldn't include? We'll filter later by signature detection.
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

  // Extract signatures
  const seen = new Set();
  const sections = [];
  let functionsFound = 0;

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
    const header = makeSectionHeader(`${spec} -> ${rel}`).replace(/\*\/\n\/\*/g, '*\/\n/*'); // keep style
    sections.push(header + sigEntries.map(([, s]) => s).join('\n') + '\n');
    functionsFound += sigEntries.length;
  }

  if (!sections.length) {
    console.warn('[script-library] No function signatures found in ExcalidrawLib exports.');
  }

  const body =
    '# ExcalidrawLib module functions\n\n' +
    'The following functions are exposed via window.ExcalidrawLib. Signatures are extracted from TypeScript declarations.\n\n' +
    '```ts\n' +
    sections.join('\n') +
    '```\n';

  console.log(`[script-library] Collected ${functionsFound} ExcalidrawLib function signatures`);
  return body;
}

function main() {
  console.log('[script-library] Generating Excalidraw Script Library...');
  if (!fs.existsSync(EA_SCRIPTS_DIR)) {
    console.error('ea-scripts directory not found:', EA_SCRIPTS_DIR);
    process.exit(1);
  }
  if (!fs.existsSync(INDEX_NEW)) {
    console.error('index-new.md not found:', INDEX_NEW);
    process.exit(1);
  }
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  let output = SCRIPT_INTRO;

  console.log('[script-library] Adding index-new.md');
  const indexNewContent = fs.readFileSync(INDEX_NEW, 'utf8');
  output += `<!-- BEGIN index-new.md -->\n${indexNewContent.trim()}\n<!-- END index-new.md -->\n\n`;
  output += `---\n\n# Script Sources\n`;

  // Collect *.md files (non-recursive) excluding index-new.md
  const files = fs
    .readdirSync(EA_SCRIPTS_DIR, { withFileTypes: true })
    .filter(
      (d) =>
        d.isFile() &&
        d.name.endsWith('.md') &&
        d.name.toLowerCase() !== 'index-new.md'
    )
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

  for (const file of files) {
    const full = path.join(EA_SCRIPTS_DIR, file);
    let content = fs.readFileSync(full, 'utf8');

    output += `\n---\n\n## ${file}\n`;
    output += `<!-- Source: ea-scripts/${file} -->\n\n`;

    // Normalize line endings
    content = content.replace(/\r\n/g, '\n');

    output += content.trimEnd() + '\n';

    if (needsClosingFence(content)) {
      output += '```\n';
      console.log(`[script-library] Added missing closing fence to ${file}`);
    } else {
      console.log(`[script-library] Added ${file} (no fence fix needed)`);
    }
  }

  fs.writeFileSync(SCRIPT_LIBRARY_OUT, output, 'utf8');
  console.log('[script-library] Wrote:', SCRIPT_LIBRARY_OUT);

  // Generate TYPE_DEF_OUT from whitelist
  try {
    console.log('[script-library] Generating Type Definition Library...');
    const typeDefs = TYPE_DEF_INTRO + '\n' + buildTypeDefMarkdown();
    fs.writeFileSync(TYPE_DEF_OUT, typeDefs, 'utf8');
    console.log('[script-library] Wrote:', TYPE_DEF_OUT);
  } catch (e) {
    console.error('[script-library] Failed to generate TYPE_DEF_OUT:', e);
  }

  // NEW: Generate AI_TRAINING_OUT
  try {
    console.log('[script-library] Generating AI Training bundle...');
    const typeDefContent = fs.existsSync(TYPE_DEF_OUT)
      ? fs.readFileSync(TYPE_DEF_OUT, 'utf8')
      : (TYPE_DEF_INTRO + '\n' + buildTypeDefMarkdown());
    const additionalTypeDefs = buildAdditionalTypeDefsMarkdown();
    const scriptLibContent = fs.existsSync(SCRIPT_LIBRARY_OUT)
      ? fs.readFileSync(SCRIPT_LIBRARY_OUT, 'utf8')
      : '';

    // NEW: load startup template and example
    const startupTemplatePath = path.join(ROOT, ...EXCALIDRAW_STARTUP_TEMPLATE.split('/'));
    const startupExamplePath = path.join(ROOT, ...EXCALIDRAW_STARTUP_EXAMPLE.split('/'));
    const startupTemplate = fs.existsSync(startupTemplatePath)
      ? fs.readFileSync(startupTemplatePath, 'utf8').replace(/\r\n/g, '\n').trim()
      : (console.warn('[script-library] Missing startup template:', EXCALIDRAW_STARTUP_TEMPLATE), '');
    const startupExample = fs.existsSync(startupExamplePath)
      ? fs.readFileSync(startupExamplePath, 'utf8').replace(/\r\n/g, '\n').trim()
      : (console.warn('[script-library] Missing startup example:', EXCALIDRAW_STARTUP_EXAMPLE), '');

    const startupSection =
      '\n---\n\n' +
      EXCALIDRAW_STARTUP_MESSAGE +
      '\n' +
      (startupTemplate
        ? `<!-- ${EXCALIDRAW_STARTUP_TEMPLATE} -->\n${startupTemplate}\n\n`
        : '') +
      (startupExample
        ? `<!-- ${EXCALIDRAW_STARTUP_EXAMPLE} -->\n${startupExample}\n`
        : '');

    // NEW: Build ExcalidrawLib functions section
    const excalidrawLibFunctionsSection = buildExcalidrawLibFunctionsSection();

    const combined =
      (AI_TRAINING_INTRO +
      '\n---\n\n' +
      typeDefContent.trim() +
      '\n\n---\n\n' +
      additionalTypeDefs +
      '\n\n---\n\n' +
      excalidrawLibFunctionsSection +
      '\n---\n\n' +
      scriptLibContent.trim() +
      startupSection +
      '\n')
      .replaceAll("https://youtu.be/", "YouTube: ")
      .replaceAll("https://www.youtube.com/watch?v=", "YouTube: ")
      .replaceAll("https://www.youtube.com/", "YouTube: "); // prevent accidental link triggering

    fs.writeFileSync(AI_TRAINING_OUT, combined, 'utf8');
    console.log('[script-library] Wrote:', AI_TRAINING_OUT);
  } catch (e) {
    console.error('[script-library] Failed to generate AI_TRAINING_OUT:', e);
  }

  console.log('[script-library] Done.');
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error('[script-library] Failed:', e);
    process.exit(1);
  }
}
