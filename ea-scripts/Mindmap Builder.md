/*

# Mind Map Builder: Technical Specification & User Guide

![](https://youtu.be/qY66yoobaX4)

## 1. Overview
**Mind Map Builder** transforms the Obsidian-Excalidraw canvas into a rapid brainstorming environment, allowing users to build complex, structured, and visually organized mind maps using primarily keyboard shortcuts.

The script balances **automation** (auto-layout, recursive grouping, and contrast-aware coloring) with **explicit flexibility** (node pinning and redirection logic), ensuring that the mind map stays organized even as it grows to hundreds of nodes. It leverages the Excalidraw Sidepanel API to provide a persistent control interface utilizing the Obsidian sidepanel, that can also be undocked into a floating modal.

## 2. Core Purpose
The primary goal is to minimize the "friction of drawing." Instead of manually drawing boxes and arrows, the user focuses on the hierarchy of ideas. The script handles:
- **Spatial Arrangement**: Distributing nodes radially or directionally (Left/Right).
- **Visual Hierarchy**: Automatically adjusting font sizes and arrow thicknesses based on depth.
- **Selection Redirection**: Automatically shifting focus from connecting arrows to their associated nodes to ensure continuous workflow.
- **Data Portability**: Enabling seamless transition between visual diagrams and Markdown bullet lists via the clipboard.

## 3. Feature Set

### A. Intelligent Layout Engine
The script features a recursive spacing engine that calculates the "subtree height" of every branch.
- **Growth Modes**: Supports Radial (circular), Right-facing, and Left-facing layouts.
- **Radial Logic**: Distributes the first 6 nodes at 60° increments. Beyond 6 nodes, it compresses the arc to 320° to maintain a professional aesthetic and avoid overlapping the central node's vertical axis.
- **Recursive Re-balancing**: Coordinates are recalculated across the tree to prevent overlaps while maintaining the user's chosen growth direction.

### B. Pinning & Manual Placement
Nodes can be excluded from the auto-layout engine in two ways:
- **Explicit Pinning**: Users can toggle a "Pinned" state via UI or shortcut. Pinned nodes stay at their exact coordinates, while the engine still organizes their unpinned children relative to that fixed position.
- **Manual Break-out**: If a node is dragged significantly outside the calculated auto-layout radius (> 1.5x radius), the engine treats it as deliberately placed and stops moving it automatically.

### C. Import & Export (Markdown Sync)
- **Copy as Text**: Converts the visual map into an H1 header (Root) followed by an indented Markdown bullet list.
- **Paste from Text**: Parses an indented Markdown list. It supports appending to an existing node or generating a brand-new map from a clipboard list.

### D. Sidepanel & Docking
- **Persistent UI**: The script utilizes `ea.createSidepanelTab` to maintain state and controls alongside the drawing canvas.
- **Floating Mode**: The UI can be "undocked" (Shift+Enter) into a `FloatingModal` for a focus-mode experience or to move controls closer to the active drawing area on large screens.

### E. Inline Link Suggester
- **Contextual \[\[link\]\] autocomplete**: Input fields now use `ea.attachInlineLinkSuggester` so you can drop Obsidian links with in-line suggestions (supports aliases and unresolved links) without leaving the flow.

### F. Custom Palette & Contrast Colors
- **Custom palettes**: Define your own branch colors (ordered or random draw) with the palette manager; stored per-user in script settings.
- **Contrast-aware defaults**: When no custom palette is set, colors are generated to maximize contrast against the canvas and existing siblings.

## 4. UI and User Experience

### Zoom Management
The script includes "Preferred Zoom Level" settings (Low/Medium/High) to ensure the canvas automatically frames the active node comfortably during rapid entry, particularly useful on mobile devices vs desktop screens.

### Default Keyboard Shortcuts
| Shortcut | Action |
| :--- | :--- |
| **ENTER** | Add a sibling on the current parent; ENTER on empty input jumps to the most recent child/siblings. |
| **CTRL/CMD + ALT + ENTER** | Add child and follow (selection stays on the new node). |
| **CTRL/CMD + ENTER** | Add child, follow, and center the new node. |
| **CTRL/CMD + SHIFT + ENTER** | Add child, follow, and zoom to fit. |
| **SHIFT + ENTER** | Dock/Undock the input field. |
| **F2** | Edit the selected node. |
| **ALT + P** | Pin/Unpin the selected node. |
| **ALT + B** | Box/Unbox the selected node. |
| **ALT + C / X / V** | Copy, Cut, or Paste branches as Markdown. |
| **ALT + Z** | Cycle zoom to the selected element. |
| **ALT + F** | Focus (center) the selected node. |
| **ALT + ARROWS** | Navigate the mind map (parent/child/sibling). |
| **ALT + SHIFT + ARROWS** | Navigate and zoom to selection. |
| **ALT + CTRL/CMD + ARROWS** | Navigate and focus selection. |
| **ESC** | Dock and hide the floating input. |

## 5. Settings and Persistence

### Global Settings
Persisted across sessions via `ea.setScriptSettings`:
- **Max Text Width**: Point at which text wraps (Default: 450px).
- **Font Scales**: Choice of Normal, Fibonacci, or Scene-based sizes.
- **Multicolor Mode**: Toggle automatic branch coloring; optionally configure a custom palette (ordered or random).
- **Arrow Stroke Style**: Use scene stroke style or force solid branches.
- **Center Text**: Toggle centered text vs directional alignment.
- **Preferred Zoom Level**: Controls auto-zoom intensity (Low/Medium/High).
- **Recursive Grouping**: When enabled, groups sub-trees from the leaves upward.
- **Is Undocked**: Remembers if the user prefers the UI floating or docked.

### Map-Specific Persistence (customData)
The script uses `ea.addAppendUpdateCustomData` to store state on elements:
- `growthMode`: Stored on the Root node (Radial, Left, or Right).
- `autoLayoutDisabled`: Stored on the Root node to pause layout engine for specific maps (toggle from UI).
- `isPinned`: Stored on individual nodes (boolean) to bypass the layout engine.
- `isBranch`: Stored on arrows (boolean) to distinguish Mind Map connectors from standard annotations.
- `mindmapOrder`: Stored on nodes (number) to maintain manual sort order of siblings.

## 6. Special Logic Solutions

### The "mindmapNew" Tag & Order Stability
When a Level 1 node is created, it is temporarily tagged with `mindmapNew: true`. The layout engine uses this to separate "Existing" nodes from "New" nodes. Existing nodes are sorted by their `mindmapOrder` (or visual angle/Y-position if order is missing), while new nodes are appended to the end. This prevents new additions from scrambling the visual order of existing branches.

### Sidepanel Lifecycle Management
The script implements `SidepanelTab` hooks (`onFocus`, `onClose`, `onWindowMigrated`) to handle:
- **Context Switching**: Rebinding event listeners when the user switches between multiple Excalidraw views.
- **Window Migration**: Re-attaching keyboard handlers when the sidepanel moves between the main window and a popout window.
- **Auto-Docking**: Ensuring floating modals are docked back to the sidepanel when the view closes to prevent UI orphans.

### Recursive Grouping
When enabled, the script groups elements from the "leaves" upward. A leaf node is grouped with its parent and the connecting arrow. That group is then nested into the grandparent's group. The **Root Exception**: The root node is never part of an L1 group, allowing users to move the central idea or detach whole branches easily.

### Link suggester keydown events (Enter, Escape)
- **Key-safe integration**: The suggester implements the `KeyBlocker` interface so the script's own key handlers pause while the suggester is active, preventing shortcut collisions during link insertion.

```js
*/

if (!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("2.19.0")) {
  new Notice("Please update the Excalidraw Plugin to version 2.19.0 or higher.");
  return;
}

// --- Initialization Logic ---
// Check for existing tab
const existingTab = ea.checkForActiveSidepanelTabForScript();
if (existingTab) {
  const hostEA = existingTab.getHostEA();
  if (hostEA && hostEA !== ea) {
    hostEA.activateMindmap = true;
    hostEA.setView(ea.targetView);
    existingTab.open();
    return;
  }
}

// ---------------------------------------------------------------------------
// 1. Settings & Persistence Initialization
// ---------------------------------------------------------------------------
let dirty = false;
const K_WIDTH = "Max Text Width";
const K_FONTSIZE = "Font Sizes";
const K_BOX = "Box Children";
const K_ROUND = "Rounded Corners";
const K_GROWTH = "Growth Mode";
const K_MULTICOLOR = "Multicolor Mode";
const K_UNDOCKED = "Is Undocked";
const K_GROUP = "Group Branches";
const K_ARROWSTROKE = "Arrow Stroke Style";
const K_CENTERTEXT = "Center text in nodes?";
const K_ZOOM = "Preferred Zoom Level";
const K_HOTKEYS = "Hotkeys";
const K_PALETTE = "Custom Palette";

const FONT_SCALE_TYPES = ["Use scene fontsize", "Fibonacci Scale", "Normal Scale"];
const GROWTH_TYPES = ["Radial", "Right-facing", "Left-facing"];
const ZOOM_TYPES = ["Low","Medium","High"];

const api = () => ea.getExcalidrawAPI();
const appState = () => ea.getExcalidrawAPI().getAppState();
const getVal = (key, def) => ea.getScriptSettingValue(key, typeof def === "object" ? def: { value: def }).value;

const saveSettings = async () => {
  if (dirty) await ea.saveScriptSettings();
  dirty = false;
}

const setVal = (key, value, hidden = false) => {
  //value here is only a fallback
  //when updating a setting value, the full ScriptSettingValue should be there
  //as defined on the ScriptSettingValue type.
  const def = ea.getScriptSettingValue(key, {value, hidden});
  def.value = value;
  if(hidden) def.hidden = true;
  ea.setScriptSettingValue(key, def);
}

//Remove setting keys no longer used
const settingsTemp = ea.getScriptSettings();
if(settingsTemp && settingsTemp.hasOwnProperty("Is Minimized")) {
  delete settingsTemp["Is Minimized"];
  dirty = true;
}

let maxWidth = parseInt(getVal(K_WIDTH, 450));
let fontsizeScale = getVal(K_FONTSIZE, {value: "Normal Scale", valueset: FONT_SCALE_TYPES});
let boxChildren = getVal(K_BOX, false);
let roundedCorners = getVal(K_ROUND, false);
let multicolor = getVal(K_MULTICOLOR, true);
let groupBranches = getVal(K_GROUP, false);
let currentModalGrowthMode = getVal(K_GROWTH, {value: "Right-facing", valueset: GROWTH_TYPES});
let isUndocked = getVal(K_UNDOCKED, false);
let isSolidArrow = getVal(K_ARROWSTROKE, true);
let centerText = getVal(K_CENTERTEXT, true);
let autoLayoutDisabled = false;
let zoomLevel = getVal(K_ZOOM, {value: "Medium", valueset: ZOOM_TYPES});
let customPalette = getVal(K_PALETTE, {value : {enabled: false, random: false, colors: []}, hidden: true}); 
let editingNodeId = null;

//migrating old settings values. This must stay in the code so existing users have their dataset migrated
//when they first run the new version of the code
if (!ea.getScriptSettingValue(K_FONTSIZE, {value: "Normal Scale", valueset: FONT_SCALE_TYPES}).hasOwnProperty("valueset")) {
  ea.setScriptSettingValue (K_FONTSIZE, {value: fontsizeScale, valueset: FONT_SCALE_TYPES});
  dirty = true;
}

if (!ea.getScriptSettingValue(K_GROWTH, {value: "Right-facing", valueset: GROWTH_TYPES}).hasOwnProperty("valueset")) {
  ea.setScriptSettingValue (K_GROWTH, {value: currentModalGrowthMode, valueset: GROWTH_TYPES});
  dirty = true;
}

const getZoom = (level) => {
  switch (level ?? zoomLevel) {
    case "Low":
      return ea.DEVICE.isMobile ? 0.20 : 0.10;
    case "High":
      return ea.DEVICE.isMobile ? 0.60 : 0.50;
    default:
      return ea.DEVICE.isMobile ? 0.35 : 0.25;
  }
}

const fontScale = (type) => {
  switch (type) {
    case "Use scene fontsize":
      return Array(4).fill(appState().currentItemFontSize);
    case "Fibonacci Scale":
      return [68, 42, 26, 16];
    default: // "Normal Scale"
      return [36, 28, 20, 16];
  }
};

const getFontScale = (type) => fontScale(type) ?? fontScale("Normal Scale");

const STROKE_WIDTHS = [6, 4, 2, 1, 0.5];
const ownerWindow = ea.targetView?.ownerWindow;
const isMac = ea.DEVICE.isMacOS || ea.DEVICE.isIOS;
const IMAGE_TYPES = ["jpeg", "jpg", "png", "gif", "svg", "webp", "bmp", "ico", "jtif", "tif", "jfif", "avif"];
const EMBEDED_OBJECT_WIDTH_ROOT = 400;
const EMBEDED_OBJECT_WIDTH_CHILD = 180;

const parseImageInput = (input) => {
  const trimmed = input.trim();
  if (!trimmed.startsWith("![[") || !trimmed.endsWith("]]")) return null;
  
  const content = trimmed.slice(3, -2);
  const parts = content.split("|");
  const path = parts[0];
  
  let width = null;
  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    if (/^\d+$/.test(last)) {
      width = parseInt(last);
    }
  }
  
  return { path, width };
};

const parseEmbeddableInput = (input) => {
  const trimmed = input.trim();
  const match = trimmed.match(/^!\[\]\((https?:\/\/[^)]+)\)$/);
  return match ? match[1] : null;
};

// ------------------------------------------------
// ---------- HOTKEY SUPPORT FUNCTIONS ------------
const ACTION_ADD = "Add";
const ACTION_ADD_FOLLOW = "Add + follow";
const ACTION_ADD_FOLLOW_FOCUS = "Add + follow + focus";
const ACTION_ADD_FOLLOW_ZOOM = "Add + follow + zoom";
const ACTION_EDIT = "Edit node";
const ACTION_PIN = "Pin/Unpin";
const ACTION_BOX = "Box/Unbox";
const ACTION_TOGGLE_GROUP = "Group/Ungroup Single Branch";

const ACTION_COPY = "Copy";
const ACTION_CUT = "Cut";
const ACTION_PASTE = "Paste";

const ACTION_ZOOM = "Cycle Zoom";
const ACTION_FOCUS = "Focus (center) node";
const ACTION_NAVIGATE = "Navigate";
const ACTION_NAVIGATE_ZOOM = "Navigate & zoom";
const ACTION_NAVIGATE_FOCUS = "Navigate & focus";
const ACTION_FOLD = "Fold/Unfold Branch";
const ACTION_FOLD_L1 = "Fold/Unfold to Level 1";

const ACTION_DOCK_UNDOCK = "Dock/Undock";
const ACTION_HIDE = "Dock & hide";

// Default configuration
// scope may be "input" | "excalidraw" | "global"
// - input: the hotkey only works if the inputEl has focus
// - excalidraw: the hotkey works when either the inputEl has focus or the sidepanelView leaf or the Excalidraw leaf is active
// - global: the hotkey works across obsidian, when ever the Excalidraw view in ea.targetView is visible, i.e. the hotkey works even if the user is active in a leaf like pdf viewer, markdown note, open next to Excalidraw.
// - none: ea.targetView not set or Excalidraw leaf not visible
const SCOPE = {
  input: 3,
  excalidraw: 2,
  global: 1,
  none: 0,
}
const DEFAULT_HOTKEYS = [
  { action: ACTION_ADD, key: "Enter", modifiers: [], immutable: true, scope: SCOPE.input, isInputOnly: true }, // Logic relies on standard Enter behavior in input
  { action: ACTION_ADD_FOLLOW, key: "Enter", modifiers: ["Mod", "Alt"], scope: SCOPE.input, isInputOnly: true },
  { action: ACTION_ADD_FOLLOW_FOCUS, key: "Enter", modifiers: ["Mod"], scope: SCOPE.input, isInputOnly: true },
  { action: ACTION_ADD_FOLLOW_ZOOM, key: "Enter", modifiers: ["Mod", "Shift"], scope: SCOPE.input, isInputOnly: true },
  { action: ACTION_EDIT, code: "F2", modifiers: [], scope: SCOPE.input, isInputOnly: false },
  { action: ACTION_PIN, code: "KeyP", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false },
  { action: ACTION_BOX, code: "KeyB", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false },
  { action: ACTION_TOGGLE_GROUP, code: "KeyG", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false }, 
  { action: ACTION_COPY, code: "KeyC", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false },
  { action: ACTION_CUT, code: "KeyX", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false },
  { action: ACTION_PASTE, code: "KeyV", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false },
  { action: ACTION_ZOOM, code: "KeyZ", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false },
  { action: ACTION_FOCUS, code: "KeyF", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false },
  { action: ACTION_DOCK_UNDOCK, key: "Enter", modifiers: ["Shift"], scope: SCOPE.input, isInputOnly: true },
  { action: ACTION_HIDE, key: "Escape", modifiers: [], immutable: true , scope: SCOPE.excalidraw, isInputOnly: true },
  { action: ACTION_NAVIGATE, key: "ArrowKeys", modifiers: ["Alt"], isNavigation: true, scope: SCOPE.input, isInputOnly: false },
  { action: ACTION_NAVIGATE_ZOOM, key: "ArrowKeys", modifiers: ["Alt", "Shift"], isNavigation: true, scope: SCOPE.input, isInputOnly: false },
  { action: ACTION_NAVIGATE_FOCUS, key: "ArrowKeys", modifiers: ["Alt", "Mod"], isNavigation: true, scope: SCOPE.input, isInputOnly: false },
  { action: ACTION_FOLD, code: "KeyA", modifiers: ["Alt", "Shift"], scope: SCOPE.input, isInputOnly: false },
  { action: ACTION_FOLD_L1, code: "KeyA", modifiers: ["Ctrl", "Alt"], scope: SCOPE.input, isInputOnly: false },
];

// Load hotkeys from settings or use default
// IMPORTANT: Use JSON.parse/stringify to create a deep copy of defaults.
// Otherwise, modifying userHotkeys modifies DEFAULT_HOTKEYS in memory, breaking the isModified check until restart.
let userHotkeys = getVal(K_HOTKEYS, {value: JSON.parse(JSON.stringify(DEFAULT_HOTKEYS)), hidden: true});
let isRecordingHotkey = false;
let cancelHotkeyRecording = null;

const getObsidianConflict = (h) => {
  if (!h) return null;
  
  const normalize = (s) => s.toLowerCase().replace("key", "").replace("digit", "");
  const sortMods = (m) => [...m].sort().join(",");
  
  const keysToCheck = h.isNavigation 
    ? ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]
    : [h.code ? h.code : h.key];

  const targetMods = sortMods(h.modifiers);

  const commands = app.commands.listCommands();
  for (const cmd of commands) {
    const hotkeys = app.hotkeyManager.getHotkeys(cmd.id) || app.hotkeyManager.getDefaultHotkeys(cmd.id);
    if (!hotkeys) continue;

    for (const hk of hotkeys) {
      const hkKey = normalize(hk.key);
      const hkMods = sortMods(hk.modifiers);
      
      for (const targetKeyRaw of keysToCheck) {
        if (normalize(targetKeyRaw) === hkKey && targetMods === hkMods) {
          return cmd.name;
        }
      }
    }
  }
  return null;
};

/**
 * Sync userHotkeys to DEFAULT_HOTKEYS by action.
 * - Drops user actions not in DEFAULT
 * - Adds missing actions from DEFAULT
 * - For existing actions:
 *    - keeps user values for existing keys
 *    - adds missing keys from DEFAULT
 *    - removes keys not in DEFAULT
**/
function updateUserHotkeys() {
  let dirty = false;

  const defaultByAction = new Map(DEFAULT_HOTKEYS.map(d => [d.action, d]));

  const userByAction = new Map();
  for (const u of userHotkeys) {
    if (u && typeof u.action === "string" && defaultByAction.has(u.action)) {
      userByAction.set(u.action, u);
    } else if (u && u.action) {
      // user action no longer exists in DEFAULT => dropped
      dirty = true;
    }
  }

  const next = [];

  for (const d of DEFAULT_HOTKEYS) {
    const u = userByAction.get(d.action);

    if (!u) {
      next.push(structuredClone ? structuredClone(d) : JSON.parse(JSON.stringify(d)));
      dirty = true;
      continue;
    }

    const cleaned = { action: d.action };

    for (const key of Object.keys(d)) {
      if (key === "action") continue;

      if (Object.prototype.hasOwnProperty.call(u, key)) {
        cleaned[key] = u[key];
      } else {
        cleaned[key] = d[key];
        dirty = true;
      }
    }

    for (const key of Object.keys(u)) {
      if (key === "action") continue;
      if (!Object.prototype.hasOwnProperty.call(d, key)) {
        dirty = true;
        break;
      }
    }

    next.push(cleaned);
  }

  userHotkeys = next;
  return dirty;
}

dirty = updateUserHotkeys();



const getHotkeyDefByAction = (action) => userHotkeys.find((h)=>h.action === action);

const getHotkeyDisplayString = (h) => {
  const parts = [];
  if (h.modifiers.includes("Ctrl")) parts.push("Ctrl");
  if (h.modifiers.includes("Meta")) parts.push("Cmd");
  if (h.modifiers.includes("Mod")) parts.push(isMac ? "Cmd" : "Ctrl");
  if (h.modifiers.includes("Alt")) parts.push(isMac ? "Opt" : "Alt");
  if (h.modifiers.includes("Shift")) parts.push("Shift");
  
  if (h.code) parts.push(h.code.replace("Key", "").replace("Digit", ""));
  else if (h.key === "ArrowKeys") parts.push("Arrow");
  else if (h.key === " ") parts.push("Space");
  else parts.push(h.key);
  
  return parts.join(" + ");
};

const getActionHotkeyString = (action) => `(${getHotkeyDisplayString(getHotkeyDefByAction(action))})`;

// Merge defaults in case new actions were added in an update
if(userHotkeys.length !== DEFAULT_HOTKEYS.length) {
  const merged = [...userHotkeys];
  DEFAULT_HOTKEYS.forEach(d => {
    if(!merged.find(u => u.action === d.action)) merged.push(JSON.parse(JSON.stringify(d)));
  });
  userHotkeys = merged;
}

// Generate the runtime HOTKEYS array used by getActionFromEvent
const generateRuntimeHotkeys = () => {
  const runtimeKeys = [];
  userHotkeys.forEach(h => {
    if (h.isNavigation) {
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].forEach(key => {
        runtimeKeys.push({ action: h.action, key, modifiers: h.modifiers });
      });
    } else {
      runtimeKeys.push(h);
    }
  });
  return runtimeKeys;
};

let RUNTIME_HOTKEYS = generateRuntimeHotkeys();

/**
 * Returns the current scope context for the hotkey
**/
const getHotkeyContext = () => {
  if (!ea.targetView) return SCOPE.none;

  const currentWindow = isUndocked && floatingInputModal 
    ? ea.targetView?.ownerWindow 
    : sidepanelWindow;
  
  if (currentWindow.document?.activeElement === inputEl) {
    return SCOPE.input;
  }

  const leaf = app.workspace.activeLeaf;
  if (
    ea.targetView.leaf === leaf ||
    (ea.getSidepanelLeaf() === leaf && ea.sidepanelTab.isVisible())
  ) {
    return SCOPE.excalidraw;
  }

  if (ea.targetView.leaf.isVisible()) {
    return SCOPE.global;
  }

  return SCOPE.none;
}

const INSTRUCTIONS = `
<br>
<div class="ex-coffee-div"><a href="https://ko-fi.com/zsolt"><img src="https://storage.ko-fi.com/cdn/kofi6.png?v=6" border="0" alt="Buy Me a Coffee at ko-fi.com"  height=45></a></div>

- **ENTER**: Add a sibling node and stay on the current parent for rapid entry. If you press enter when the input field is empty the focus will move to the child node that was most recently added. Pressing enter subsequent times will iterate through the new child's siblings
- **Hotkeys**: See configuration at the bottom of the sidepanel
- **Global vs Local Hotkeys**: Use the 🌐/⌨️ toggle in configuration.
  - 🌐 **Global**: Works whenever Excalidraw is visible.
  - 🎨 **Excalidraw**: Works whenever Excalidraw is active.
  - ⌨️ **Local**: Works only when the MindMap input field is focused.
- **Dock/Undock**: You can dock/undock the input field using the dock/undock button or the configured hotkey
- **ESC**: Docks the floating input field without activating the side panel
- **Coloring**: First level branches get unique colors (Multicolor mode). Descendants inherit parent's color.
- **Grouping**:
  - Enabling "Group Branches" recursively groups sub-trees from leaves up to the first level.
- **Copy/Paste**: Export/Import indented Markdown lists.

😍 If you find this script helpful, please [buy me a coffee ☕](https://ko-fi.com/zsolt).

<a href="https://www.youtube.com/watch?v=qY66yoobaX4" target="_blank"><img src ="https://i.ytimg.com/vi/qY66yoobaX4/maxresdefault.jpg" style="max-width:560px; width:100%"></a>
`;

// ---------------------------------------------------------------------------
// 2. Traversal & Geometry Helpers
// ---------------------------------------------------------------------------

const ensureNodeSelected = () => {
  if (!ea.targetView) return;
  const selectedElements = ea.getViewSelectedElements();

  if (selectedElements.length === 0) return;

  // 1. Handle Single Arrow Selection, deliberatly not filtering to el.customData?.isBranch
  if (selectedElements.length === 1 && selectedElements[0].type === "arrow") {
    const sel = selectedElements[0];
    const targetId = sel.startBinding?.elementId || sel.endBinding?.elementId;
    if (targetId) {
      const target = ea.getViewElements().find((el) => el.id === targetId);
      if (target) ea.selectElementsInView([target]);
    } else {
      ea.selectElementsInView([]);
    }
    return;
  }

  // 2. Handle Group Selection (Find Highest Ranking Parent)
  // deliberatly not filtering to el.customData?.isBranch
  if (selectedElements.length > 1) {
    const selectedIds = new Set(selectedElements.map((el) => el.id));
    const arrows = selectedElements.filter((el) => el.type === "arrow");

    const sourceIds = new Set();
    const sinkIds = new Set();

    // Analyze arrows that connect elements WITHIN the current selection
    arrows.forEach((arrow) => {
      const startId = arrow.startBinding?.elementId;
      const endId = arrow.endBinding?.elementId;

      if (startId && selectedIds.has(startId)) sourceIds.add(startId);
      if (endId && selectedIds.has(endId)) sinkIds.add(endId);
    });

    // The "Highest Ranking Parent" is a source within the group
    // that is NOT a sink of any arrow within that same group.
    const rootId = Array.from(sourceIds).find((id) => !sinkIds.has(id));

    if (rootId) {
      const target = selectedElements.find((el) => el.id === rootId);
      if (target) ea.selectElementsInView([target]);
    }
  }
};

const getParentNode = (id, allElements) => {
  const arrow = allElements.find(
    (el) => el.type === "arrow" && el.customData?.isBranch && el.endBinding?.elementId === id,
  );
  if (!arrow) return null;
  const parent = allElements.find((el) => el.id === arrow.startBinding?.elementId);
  return parent?.containerId
    ? allElements.find((el) => el.id === parent.containerId)
    : parent;
};

const getChildrenNodes = (id, allElements) => {
  const arrows = allElements.filter(
    (el) => el.type === "arrow" && el.customData?.isBranch && el.startBinding?.elementId === id,
  );
  return arrows.map((a) => allElements.find((el) => el.id === a.endBinding?.elementId)).filter(Boolean);
};

const getHierarchy = (el, allElements) => {
  let depth = 0,
    curr = el,
    l1Id = el.id,
    rootId = el.id;
  const visited = new Set([el.id]);

  while (true) {
    let p = getParentNode(curr.id, allElements);
    if (!p || visited.has(p.id)) {
      rootId = curr.id;
      break;
    }
    visited.add(p.id);
    l1Id = curr.id;
    curr = p;
    depth++;
  }
  return { depth, l1AncestorId: l1Id, rootId };
};

const getAngleFromCenter = (center, point) => {
  let dx = point.x - center.x,
    dy = point.y - center.y;
  let angle = Math.atan2(dx, -dy) * (180 / Math.PI);
  return angle < 0 ? angle + 360 : angle;
};

const randInt = (range) => Math.round(Math.random()*range);

const getDynamicColor = (existingColors) => {
  if (multicolor && customPalette.enabled && customPalette.colors.length > 0) {
    if (customPalette.random) {
      return customPalette.colors[Math.floor(Math.random() * customPalette.colors.length)];
    }
    return customPalette.colors[existingColors.length % customPalette.colors.length];
  }
  const st = appState();
  const bg = st.viewBackgroundColor === "transparent" ? "#ffffff" : st.viewBackgroundColor;
  const bgCM = ea.getCM(bg);
  const isDarkBg = bgCM.isDark();

  // Heavier weight on Hue to ensure "different colors" rather than just "different shades"
  const getDist = (c1, c2) => {
    let dh = Math.abs(c1.hue - c2.hue);
    if (dh > 180) dh = 360 - dh;
    const hScore = (dh / 1.8); 
    return (hScore * 2) + Math.abs(c1.saturation - c2.saturation) + Math.abs(c1.lightness - c2.lightness);
  };

  let palette = st.colorPalette?.elementStroke || [];
  if (Array.isArray(palette)) palette = palette.flat(Infinity);
  
  const candidates = [];

  new Set(palette).forEach(hex => {
    if (hex && hex !== "transparent") candidates.push({ hex, isPalette: true });
  });

  for (let h = 0; h < 360; h +=15+randInt(4)) {
    const c = ea.getCM({ h: h, s: 75 + randInt(10), l: isDarkBg ? 65 + randInt(10) : 36 + randInt(8), a: 1 });
    candidates.push({ hex: c.stringHEX(), isPalette: false });
  }

  // Process Candidates
  const scored = candidates.map(c => {
    let cm = ea.getCM(c.hex);
    if (!cm) return null;
    
    // Auto-adjust for contrast if necessary
    // If yellow/orange is too light for white bg, darken it.
    let contrast = cm.contrast({ bgColor: bg });
    if (contrast < 3) {
      const originalL = cm.lightness;
      // Try darkening/lightening to meet WCAG AA (3.0 for graphics)
      const targetL = isDarkBg ? Math.min(originalL + 40, 90) : Math.max(originalL - 40, 20);
      cm = cm.lightnessTo(targetL);
      contrast = cm.contrast({ bgColor: bg });
      c.hex = cm.stringHEX({alpha: false}); // Update the hex to the readable version
    }

    // Calculate minimum distance to ANY existing color on canvas
    let minDiff = 1000;
    let closestColor = null;
    
    if (existingColors.length > 0) {
      existingColors.forEach(exHex => {
        const exCM = ea.getCM(exHex);
        if (exCM) {
          const d = getDist(cm, exCM);
          if (d < minDiff) {
            minDiff = d;
            closestColor = exHex;
          }
        }
      });
    }

    return { ...c, contrast, minDiff };
  }).filter(c => c && c.contrast >= 2.5); // Filter out absolute invisible colors

  // Sort Logic
  scored.sort((a, b) => {
    // Threshold for "This color is effectively the same as one already used"
    // Distance of ~30 usually means same Hue family and similar shade
    const threshold = 40; 
    const aIsDistinct = a.minDiff > threshold;
    const bIsDistinct = b.minDiff > threshold;

    // 1. Priority: Distinctness from existing canvas elements
    if (aIsDistinct && !bIsDistinct) return -1;
    if (!aIsDistinct && bIsDistinct) return 1;

    // 2. Priority: If both are distinct (or both are duplicates), prefer Palette
    if (a.isPalette !== b.isPalette) return a.isPalette ? -1 : 1;

    // 3. Priority: If both are palette (or both generated), pick the one most different from existing
    return b.minDiff - a.minDiff;
  });

  return scored[0]?.hex || "#000000";
};

const getReadableColor = (hex) => {
  const bg = appState().viewBackgroundColor;
  const cm = ea.getCM(hex);
  return ea.getCM(bg).isDark()
    ? cm.lightnessTo(80).stringHEX()
    : cm.lightnessTo(35).stringHEX();
};

// ---------------------------------------------------------------------------
// Folding Logic
// ---------------------------------------------------------------------------

const manageFoldIndicator = (node, show, allElements) => {
  if (show) {
    const children = getChildrenNodes(node.id, allElements);
    if (children.length === 0) show = false;
  }
  const existingId = node.customData?.foldIndicatorId;
  
  if (show) {
    if (existingId) {
      const ind = allElements.find(el => el.id === existingId);
      if (ind) {
        ind.isDeleted = false;
        ind.strokeColor = node.strokeColor;
        ind.opacity = 40;
        ind.x = node.x + node.width + 10;
        ind.y = node.y + node.height/2 - ind.height/2;
        return;
      }
    }
    
    // Create new indicator if none exists
    const id = ea.addText(node.x + node.width + 10, node.y, "...");
    const ind = ea.getElement(id);
    ind.fontSize = 20;
    ind.strokeColor = node.strokeColor;
    ind.opacity = 40;
    ind.textVerticalAlign = "middle";
    ind.textAlign = "left";
    ind.y = node.y + node.height/2 - ind.height/2;
    
    // Add to existing group if present
    if (node.groupIds && node.groupIds.length > 0) {
      ind.groupIds = [node.groupIds[0]];
    } else {
      // Or create a new group with the node
      ea.addToGroup([node.id, id]);
    }
    
    ea.addAppendUpdateCustomData(node.id, { foldIndicatorId: id });
  } else {
    // Hide/Delete indicator
    if (existingId) {
      const ind = allElements.find(el => el.id === existingId);
      if (ind) ind.isDeleted = true;
      ea.addAppendUpdateCustomData(node.id, { foldIndicatorId: undefined });
    }
  }
};

const updateBranchVisibility = (nodeId, parentHidden, allElements, isRootOfFold) => {
  const node = allElements.find(el => el.id === nodeId);
  if (!node) return;

  const isFolded = node.customData?.isFolded === true;
  
  // The root of the fold operation stays visible unless its parent was already hidden
  const shouldHideThis = parentHidden && !isRootOfFold;

  // 1. Update Node Visibility & Lock State
  if (shouldHideThis) {
    // Only save state if not already saved to avoid overwriting original state with hidden state
    if (!node.customData?.foldState) {
      // Safety: If for some reason opacity is already 0, assume 100 to avoid locking it invisible forever
      const safeOpacity = node.opacity === 0 ? 100 : node.opacity;
      ea.addAppendUpdateCustomData(nodeId, {
        foldState: { opacity: safeOpacity, locked: node.locked }
      });
    }
    node.opacity = 0;
    node.locked = true;
  } else {
    // Restore original state
    if (node.customData?.foldState) {
      node.opacity = node.customData.foldState.opacity;
      node.locked = node.customData.foldState.locked;
      const d = {...node.customData};
      delete d.foldState;
      node.customData = d;
    } else {
      // Default fallback if no state was saved but we need to show
      // Ensure we don't accidentally leave it at 0 if it was hidden
      if (node.opacity === 0) node.opacity = 100;
      node.locked = false;
    }
  }

  // 2. Manage Indicator
  // Show indicator if THIS node is visible, but it is folded (hiding its children)
  const showIndicator = !shouldHideThis && isFolded;
  manageFoldIndicator(node, showIndicator, allElements);

  // 3. Process Children
  // Children are hidden if THIS node is hidden OR if THIS node is marked folded
  const childrenHidden = shouldHideThis || isFolded;
  
  const children = getChildrenNodes(nodeId, allElements);
  
  children.forEach(child => {
    // Handle the connector arrow
    const arrow = allElements.find(
      a => a.type === "arrow" && 
      a.customData?.isBranch && 
      a.startBinding?.elementId === nodeId && 
      a.endBinding?.elementId === child.id
    );
    
    if (arrow) {
      if (childrenHidden) {
        if (!arrow.customData?.foldState) {
          const safeOpacity = arrow.opacity === 0 ? 100 : arrow.opacity;
          ea.addAppendUpdateCustomData(arrow.id, {
            foldState: { opacity: safeOpacity, locked: arrow.locked }
          });
        }
        arrow.opacity = 0;
        arrow.locked = true;
      } else {
        if (arrow.customData?.foldState) {
          arrow.opacity = arrow.customData.foldState.opacity;
          arrow.locked = arrow.customData.foldState.locked;
          const d = {...arrow.customData};
          delete d.foldState;
          arrow.customData = d;
        } else {
          if (arrow.opacity === 0) arrow.opacity = 100;
          arrow.locked = false;
        }
      }
    }
    
    // Recurse
    updateBranchVisibility(child.id, childrenHidden, allElements, false);
  });
};

const toggleFold = async (mode = "all") => {
  if (!ea.targetView) return;
  const sel = ea.getViewSelectedElement();
  if (!sel) return;

  const allElements = ea.getViewElements();
  ea.copyViewElementsToEAforEditing(allElements);
  const wbElements = ea.getElements();

  const targetNode = wbElements.find(el => el.id === sel.id);
  if (!targetNode) return;

  let isFoldAction = false; 
  
  if (mode === "all") {
    const isCurrentlyFolded = targetNode.customData?.isFolded === true;
    isFoldAction = !isCurrentlyFolded;
    ea.addAppendUpdateCustomData(targetNode.id, { isFolded: isFoldAction });
  } else if (mode === "l1") {
    ea.addAppendUpdateCustomData(targetNode.id, { isFolded: false });
    const children = getChildrenNodes(targetNode.id, wbElements);
    const anyChildFolded = children.some(child => child.customData?.isFolded === true);
    isFoldAction = !anyChildFolded;
    
    children.forEach(child => {
      ea.addAppendUpdateCustomData(child.id, { isFolded: isFoldAction });
    });
  }

  updateBranchVisibility(targetNode.id, false, wbElements, true);

  await ea.addElementsToView(false, false, true, true);
  ea.clear();
  
  if (!autoLayoutDisabled) {
    const info = getHierarchy(sel, ea.getViewElements());
    await triggerGlobalLayout(info.rootId);
  }

  const currentViewElements = ea.getViewElements();
  
  if (mode === "l1") {
    if (isFoldAction) {
      const children = getChildrenNodes(targetNode.id, currentViewElements);
    }
  } else {
    // Mode "all" (Single node toggle)
    const isPinned = targetNode.customData?.isPinned;
    
    if (isPinned) {
      if (isFoldAction) {
        const parent = getParentNode(targetNode.id, currentViewElements);
      } else {
        const children = getChildrenNodes(targetNode.id, currentViewElements);
      }
    } else {
    }
  }

  zoomToFit("Low");
};

// ---------------------------------------------------------------------------
// 3. Layout & Grouping Engine
// ---------------------------------------------------------------------------

const GAP_X = 140;
const GAP_Y = 30;

let storedZoom = {elementID: undefined, level: undefined}
const nextZoomLevel = (current) => {
  const idx = ZOOM_TYPES.indexOf(current);
  return idx === -1 ? ZOOM_TYPES[0] : ZOOM_TYPES[(idx + 1) % ZOOM_TYPES.length];
};

const zoomToFit = (mode) => {
  if (!ea.targetView) return;
  const sel = ea.getViewSelectedElement();
  if (sel) {
    let nextLevel = zoomLevel;
    if (typeof mode === "string") {
      nextLevel = mode;
    } else if (!!mode && storedZoom.elementID === sel.id) {
      nextLevel = nextZoomLevel(storedZoom.level ?? zoomLevel);
    }
    storedZoom = {elementID: sel.id, level: nextLevel}
    api().scrollToContent([sel], {
      fitToViewport: true,
      viewportZoomFactor: getZoom(nextLevel),
      animate: true
    });
  }
  focusInputEl();
}

const focusSelected = () => {
  if (!ea.targetView) return;
  const sel = ea.getViewSelectedElement();
  if (!sel) return;

  api().scrollToContent(sel,{ 
    fitToContent: false,
    animate: true,
  });

  focusInputEl();
};

const getMindmapOrder = (node) => {
  const o = node?.customData?.mindmapOrder;
  return typeof o === "number" && Number.isFinite(o) ? o : 0;
};

const sortChildrenStable = (children) => {
  children.sort((a, b) => {
    const ao = getMindmapOrder(a),
      bo = getMindmapOrder(b);
    if (ao !== bo) return ao - bo;
    const dy = a.y - b.y;
    if (dy !== 0) return dy;
    return String(a.id).localeCompare(String(b.id));
  });
};

const getSubtreeHeight = (nodeId, allElements) => {
  const node = allElements.find((el) => el.id === nodeId);
  if (node?.customData?.isFolded) {
    return node.height;
  }

  const children = getChildrenNodes(nodeId, allElements);
  if (children.length === 0) return allElements.find((el) => el.id === nodeId).height;
  const total = children.reduce((sum, child) => sum + getSubtreeHeight(child.id, allElements), 0);
  return Math.max(allElements.find((el) => el.id === nodeId).height, total + (children.length - 1) * GAP_Y);
};

// Recursive grouping logic
const applyRecursiveGrouping = (nodeId, allElements) => {
  const children = getChildrenNodes(nodeId, allElements);
  const nodeIdsInSubtree = [nodeId];

  children.forEach((child) => {
    const subtreeIds = applyRecursiveGrouping(child.id, allElements);
    nodeIdsInSubtree.push(...subtreeIds);

    // Find the arrow connecting nodeId to child
    const arrow = allElements.find(
      (a) =>
        a.type === "arrow" &&
        a.customData?.isBranch &&
        a.startBinding?.elementId === nodeId &&
        a.endBinding?.elementId === child.id,
    );
    if (arrow) {
      nodeIdsInSubtree.push(arrow.id);
    }
  });

  // Apply group in EA workbench
  if (nodeIdsInSubtree.length > 1) {
    ea.addToGroup(nodeIdsInSubtree);
  }

  return nodeIdsInSubtree;
};

const layoutSubtree = (nodeId, targetX, targetCenterY, side, allElements, hasGlobalFolds) => {
  const node = allElements.find((el) => el.id === nodeId);
  const eaNode = ea.getElement(nodeId);

  const isPinned = node.customData?.isPinned === true;

  if (!isPinned) {
    eaNode.x = side === 1 ? targetX : targetX - node.width;
    eaNode.y = targetCenterY - node.height / 2;
    
    if (node.customData?.originalY !== undefined) {
       ea.addAppendUpdateCustomData(nodeId, { originalY: undefined });
    }
  } else {
    if (hasGlobalFolds) {
      if (node.customData?.originalY === undefined) {
        ea.addAppendUpdateCustomData(nodeId, { originalY: node.y });
      }
      
      eaNode.y = targetCenterY - node.height / 2;      
    } else {
      if (node.customData?.originalY !== undefined) {
        eaNode.y = node.customData.originalY;
        ea.addAppendUpdateCustomData(nodeId, { originalY: undefined });
      }
    }
  }

  if (node.customData?.foldIndicatorId) {
    const ind = ea.getElement(node.customData.foldIndicatorId);
    if(ind) {
        ind.x = eaNode.x + eaNode.width + 10;
        ind.y = eaNode.y + eaNode.height/2 - ind.height/2;
    }
  }

  if (node.customData?.isFolded) return;

  const currentX = eaNode.x;
  const currentYCenter = eaNode.y + node.height / 2;

  let effectiveSide = side;
  const parent = getParentNode(nodeId, allElements);

  if (parent) {
    const parentCenterX = parent.x + parent.width / 2;
    const nodeCenterX = currentX + node.width / 2;
    effectiveSide = nodeCenterX >= parentCenterX ? 1 : -1;
  }

  if (!isPinned && eaNode.type === "text" && !eaNode.containerId && node.textAlign !== "center") {
    eaNode.textAlign = effectiveSide === 1 ? "left" : "right";
  }

  const children = getChildrenNodes(nodeId, allElements);
  
  children.sort((a, b) => {
    const dy = a.y - b.y;
    if (dy !== 0) return dy;
    return String(a.id).localeCompare(String(b.id));
  });

  children.forEach((child, i) => {
    if (getMindmapOrder(child) !== i) {
      ea.addAppendUpdateCustomData(child.id, { mindmapOrder: i });
    }
  });

  const subtreeHeight = getSubtreeHeight(nodeId, allElements);

  let currentY = currentYCenter - subtreeHeight / 2;
  const dynamicGapX = Math.max(GAP_X, subtreeHeight / 3);

  children.forEach((child) => {
    const childH = getSubtreeHeight(child.id, allElements);

    layoutSubtree(
      child.id,
      effectiveSide === 1 ? currentX + node.width + dynamicGapX : currentX - dynamicGapX,
      currentY + childH / 2,
      effectiveSide,
      allElements,
      hasGlobalFolds
    );

    currentY += childH + GAP_Y;

    const arrow = allElements.find(
      (a) =>
        a.type === "arrow" &&
        a.customData?.isBranch &&
        a.startBinding?.elementId === nodeId &&
        a.endBinding?.elementId === child.id,
    );

    if (arrow) {
      const eaArrow = ea.getElement(arrow.id);
      const eaChild = ea.getElement(child.id);
      const sX = currentX + node.width / 2;
      const sY = currentYCenter;
      const eX = eaChild.x + eaChild.width / 2;
      const eY = eaChild.y + eaChild.height / 2;
      eaArrow.x = sX;
      eaArrow.y = sY;
      eaArrow.points = [
        [0, 0],
        [eX - sX, eY - sY],
      ];
    }
  });
};

const triggerGlobalLayout = async (rootId, force = false, forceUngroup = false) => {
  if (!ea.targetView) return;
  const run = async () => {
    const allElements = ea.getViewElements();
    const root = allElements.find((el) => el.id === rootId);
    
    const hasGlobalFolds = allElements.some(el => el.customData?.isFolded === true);
    const l1Nodes = getChildrenNodes(rootId, allElements);
    if (l1Nodes.length === 0) return;

    ea.copyViewElementsToEAforEditing(allElements);

    const branchGroups = new Map();
    if (!groupBranches && !forceUngroup) {
      l1Nodes.forEach(l1 => {
        const bIds = getBranchElementIds(l1.id, allElements);
        // MODIFIED: Only look for common groups among elements that already belong to one
        const existingGroupedEls = allElements.filter(e => bIds.includes(e.id) && e.groupIds?.length > 0);
        if (existingGroupedEls.length > 0) {
          const gId = ea.getCommonGroupForElements(existingGroupedEls);
          if (gId) branchGroups.set(l1.id, gId);
        }
      });
    }

    const mindmapIds = getBranchElementIds(rootId, allElements);
    mindmapIds.forEach((id) => {
      const el = ea.getElement(id);
      if (el) el.groupIds = [];
    });

    const mode = root.customData?.growthMode || currentModalGrowthMode;
    const rootCenter = { x: root.x + root.width / 2, y: root.y + root.height / 2 };

    const existingL1 = l1Nodes.filter((n) => !n.customData?.mindmapNew);
    const newL1 = l1Nodes.filter((n) => n.customData?.mindmapNew);

    if (mode === "Radial") {
      existingL1.sort(
        (a, b) =>
          getAngleFromCenter(rootCenter, { x: a.x + a.width / 2, y: a.y + a.height / 2 }) -
          getAngleFromCenter(rootCenter, { x: b.x + b.width / 2, y: b.y + b.height / 2 }),
      );
    } else {
      existingL1.sort((a, b) => a.y - b.y);
    }

    const sortedL1 = [...existingL1, ...newL1];
    const count = sortedL1.length;

    const l1Metrics = sortedL1.map(node => getSubtreeHeight(node.id, allElements));
    const totalSubtreeHeight = l1Metrics.reduce((sum, h) => sum + h, 0);
    const totalGapHeight = (count - 1) * GAP_Y;
    const totalContentHeight = totalSubtreeHeight + totalGapHeight;

    const radiusFromHeight = totalContentHeight / 2.0;
    
    const radius = Math.max(
      Math.round(root.width * 0.9), 
      260, 
      radiusFromHeight
    ) + count * 5;

    const centerAngle = mode === "Left-facing" ? 270 : 90;
    const totalThetaDeg = (totalContentHeight / radius) * (180 / Math.PI);
    let currentAngleDirectional = centerAngle - totalThetaDeg / 2;
    let currentAngleRadial = count <= 6 ? 30 : 20;

    sortedL1.forEach((node, i) => {
      if (getMindmapOrder(node) !== i) {
        ea.addAppendUpdateCustomData(node.id, { mindmapOrder: i });
      }

      const nodeHeight = l1Metrics[i];
      const gapMultiplier = mode === "Radial" ? 2.5 : 1.0;
      const effectiveGap = GAP_Y * gapMultiplier;
      
      const nodeSpanRad = nodeHeight / radius;
      const gapSpanRad = effectiveGap / radius;
      
      const nodeSpanDeg = nodeSpanRad * (180 / Math.PI);
      const gapSpanDeg = gapSpanRad * (180 / Math.PI);

      let angleDeg;
      if (mode === "Radial") {
        angleDeg = currentAngleRadial + nodeSpanDeg / 2;
        currentAngleRadial += nodeSpanDeg + gapSpanDeg;
      } else {
        angleDeg = currentAngleDirectional + nodeSpanDeg / 2;
        currentAngleDirectional += nodeSpanDeg + gapSpanDeg;
      }

      const angleRad = (angleDeg - 90) * (Math.PI / 180);
      const tCX = rootCenter.x + radius * Math.cos(angleRad);
      const tCY = rootCenter.y + radius * Math.sin(angleRad);

      const currentDist = Math.hypot(
        node.x + node.width / 2 - rootCenter.x,
        node.y + node.height / 2 - rootCenter.y,
      );
      const isPinned =
        node.customData?.isPinned || (!force && !node.customData?.mindmapNew && currentDist > radius * 1.5);
      const side = (isPinned 
        ? (node.x + node.width / 2) > rootCenter.x
        : tCX > rootCenter.x
      ) ? 1 : -1;

      if (isPinned) {
        layoutSubtree(node.id, node.x, tCY, side, allElements, hasGlobalFolds);
      } else {
        layoutSubtree(node.id, tCX, tCY, side, allElements, hasGlobalFolds);
      }

      if (node.customData?.mindmapNew) {
        ea.addAppendUpdateCustomData(node.id, { mindmapNew: undefined });
      }

      const arrow = allElements.find(
        (a) =>
          a.type === "arrow" &&
          a.customData?.isBranch &&
          a.startBinding?.elementId === rootId &&
          a.endBinding?.elementId === node.id,
      );
      if (arrow) {
        const eaA = ea.getElement(arrow.id),
          eaC = ea.getElement(node.id);
        const eX = eaC.x + eaC.width / 2,
          eY = eaC.y + eaC.height / 2;
        eaA.x = rootCenter.x;
        eaA.y = rootCenter.y;
        eaA.points = [
          [0, 0],
          [eX - rootCenter.x, eY - rootCenter.y],
        ];
      }

      //Apply recursive grouping if enabled ---
      if (groupBranches) {
        applyRecursiveGrouping(node.id, allElements);
      } else if (branchGroups.has(node.id)) {
        // If recursive grouping is OFF, but this branch was previously grouped,
        // re-apply the common group ID to all elements in the branch
        const gId = branchGroups.get(node.id);
        const currentBranchIds = getBranchElementIds(node.id, ea.getElements());
        currentBranchIds.forEach(id => {
          const el = ea.getElement(id);
          if (el) el.groupIds = [gId];
        });
      }
    });
  };
  await run();
  await ea.addElementsToView(false, false, true, true);
  ea.clear();
};

// ---------------------------------------------------------------------------
// 4. Add Node Logic
// ---------------------------------------------------------------------------
let mostRecentlyAddedNodeID;
const getMostRecentlyAddedNode = () => {
  if (!mostRecentlyAddedNodeID) return null;
  return ea.getViewElements().find((el) => el.id === mostRecentlyAddedNodeID);
}

/**
 * Convert Obsidian wiki links + markdown links into display text.
 * Leaves other markdown markup intact.
**/
function renderLinksToText(input) {
  if (typeof input !== "string" || !input) return input;
  const isNumericOnly = (s) => /^\d+$/.test(s);
  input = input.replace(/\[\[([^\]]+?)\]\]/g, (_m, inner) => {
    const parts = String(inner).split("|");
    const target = (parts[0] ?? "").trim();
    if (!target) return _m;
    let alias = (parts[1] ?? "").trim();
    if (alias && isNumericOnly(alias)) alias = "";
    if (alias && alias.includes("|")) {
      alias = alias.split("|")[0].trim();
      if (isNumericOnly(alias)) alias = "";
    }
    const cleanedTarget = target.replace(/(#\^.*$|#.*$)/, "").trim();
    return alias || cleanedTarget || target;
  });

  input = input.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (_m, rawLabel, rawDest) => {
    const dest = String(rawDest ?? "").trim();
    let label = String(rawLabel ?? "").trim();
    if (!dest) return _m;
    if (!label) return dest;
    if (label.includes("|")) label = label.split("|")[0].trim();
    if (!label || isNumericOnly(label)) return dest;
    return label;
  });

  return input;
}

const getAdjustedMaxWidth = (text, max) => {
  const fontString = `${ea.style.fontSize.toString()}px ${
    ExcalidrawLib.getFontFamilyString({fontFamily: ea.style.fontFamily})}`;
  const wrappedText = ExcalidrawLib.wrapText(renderLinksToText(text), fontString, max);
  const optimalWidth = Math.ceil(ea.measureText(wrappedText).width);
  return {width: Math.min(max, optimalWidth), wrappedText};
}

const addNode = async (text, follow = false, skipFinalLayout = false) => {
  if (!ea.targetView) return;
  if (!text || text.trim() === "") return;
  
  let allElements = ea.getViewElements();
  const st = appState();
  let parent = ea.getViewSelectedElement();
  if (parent?.containerId) {
    parent = allElements.find((el) => el.id === parent.containerId);
  }

  if (parent && parent.customData?.isFolded) {
    await toggleFold("all");

    allElements = ea.getViewElements();
    parent = allElements.find((el) => el.id === parent.id);
  }

  let newNodeId;
  let arrowId; 

  // --- Image Detection ---
  const imageInfo = parseImageInput(text);
  let imageFile = null;
  let isPdfRectLink = false;

  if (imageInfo) {
    const pdfLinkRegex = /^[^#]*#page=\d*(&\w*=[^&]+){0,}&rect=\d*,\d*,\d*,\d*/;
    if (imageInfo.path.match(pdfLinkRegex)) {
        isPdfRectLink = true;
    } else {
        imageFile = app.metadataCache.getFirstLinkpathDest(imageInfo.path, ea.targetView.file.path);
        if (imageFile) {
            const isEx = imageFile.extension === "md" && ea.isExcalidrawFile(imageFile);
            if (!IMAGE_TYPES.includes(imageFile.extension.toLowerCase()) && !isEx) {
                imageFile = null; 
            }
        }
    }
  }

  const embeddableUrl = parseEmbeddableInput(text);

  const defaultNodeColor = ea.getCM(st.viewBackgroundColor).invert().stringHEX({alpha: false});

  let depth = 0,
    nodeColor = defaultNodeColor,
    rootId;
  let nextSiblingOrder = 0;
  if (parent) {
    const siblings = getChildrenNodes(parent.id, allElements);
    nextSiblingOrder = Math.max(0, ...siblings.map(getMindmapOrder)) + 1;
    const info = getHierarchy(parent, allElements);
    depth = info.depth + 1;
    rootId = info.rootId;
    const rootEl = allElements.find((e) => e.id === rootId);

    if (depth === 1) {
      if (multicolor) {
        const existingColors = getChildrenNodes(parent.id, allElements).map((n) => n.strokeColor);
        nodeColor = getDynamicColor(existingColors);
      } else {
        nodeColor = rootEl.strokeColor;
      }
    } else {
      if (parent.type === "image" || parent.type === "embeddable") {
        const incomingArrow = allElements.find(
          (a) => a.type === "arrow" && a.customData?.isBranch && a.endBinding?.elementId === parent.id,
        );
        nodeColor = incomingArrow ? incomingArrow.strokeColor : parent.strokeColor;
      } else {
        nodeColor = parent.strokeColor;
      }
    }
  }

  const fontScale = getFontScale(fontsizeScale);
  ea.clear();
  ea.style.fontFamily = st.currentItemFontFamily;
  ea.style.fontSize = fontScale[Math.min(depth, fontScale.length - 1)];
  ea.style.roundness = roundedCorners ? { type: 3 } : null;

  let curMaxW = depth === 0 ? Math.max(400, maxWidth) : maxWidth;
  const metrics = ea.measureText(text);
  const shouldWrap = metrics.width > curMaxW;
  if (shouldWrap) {
    curMaxW = getAdjustedMaxWidth(text, curMaxW).width;
  }

  if (!parent) {
    ea.style.strokeColor = multicolor ? defaultNodeColor : st.currentItemStrokeColor;
    
    if (isPdfRectLink) {
        newNodeId = await ea.addImage(0, 0, imageInfo.path);
        const el = ea.getElement(newNodeId);
        const targetWidth = imageInfo.width || EMBEDED_OBJECT_WIDTH_ROOT;
        const ratio = el.width / el.height;
        el.width = targetWidth;
        el.height = targetWidth / ratio;
    } else if (imageFile) {
        newNodeId = await ea.addImage(0, 0, imageFile);
        const el = ea.getElement(newNodeId);
        const targetWidth = imageInfo.width || EMBEDED_OBJECT_WIDTH_ROOT;
        const ratio = el.width / el.height;
        el.width = targetWidth;
        el.height = targetWidth / ratio;
    } else if (embeddableUrl) {
        // Height 0 triggers auto-calculation of height based on aspect ratio
        newNodeId = ea.addEmbeddable(0, 0, EMBEDED_OBJECT_WIDTH_ROOT, 0, embeddableUrl);
    } else {
        newNodeId = ea.addText(0, 0, text, {
          box: "rectangle",
          textAlign: "center",
          textVerticalAlign: "middle",
          width: shouldWrap ? curMaxW : undefined,
          autoResize: !shouldWrap,
        });
    }
    
    ea.addAppendUpdateCustomData(newNodeId, {
      growthMode: currentModalGrowthMode,
      autoLayoutDisabled: false,
    });
    rootId = newNodeId;
  } else {
    ea.style.strokeColor = nodeColor; //getReadableColor(nodeColor);
    const rootEl = allElements.find((e) => e.id === rootId);
    const mode = rootEl.customData?.growthMode || currentModalGrowthMode;
    const rootCenter = {
      x: rootEl.x + rootEl.width / 2,
      y: rootEl.y + rootEl.height / 2,
    };
    const side = parent.x + parent.width / 2 > rootCenter.x ? 1 : -1;

    const offset = mode === "Radial" || mode === "Right-facing"
      ? rootEl.width * 2
      : -rootEl.width;
    let px = parent.x + offset,
      py = parent.y;
    
    // Ensure new node is placed below existing siblings so visual sort preserves order
    if (!autoLayoutDisabled) {
      const siblings = getChildrenNodes(parent.id, allElements);
      if (siblings.length > 0) {
        const sortedSiblings = siblings.sort((a, b) => a.y - b.y);
        const lastSibling = sortedSiblings[sortedSiblings.length - 1];
        py = lastSibling.y + lastSibling.height + GAP_Y; 
      }
    }

    if (autoLayoutDisabled) {
      const manualGapX = Math.round(parent.width * 1.3);
      const jitterX = (Math.random() - 0.5) * 150;
      const jitterY = (Math.random() - 0.5) * 150;
      const nodeW = shouldWrap ? curMaxW : metrics.width;
      px = side === 1
        ? parent.x + parent.width + manualGapX + jitterX
        : parent.x - manualGapX - nodeW + jitterX;
      py = parent.y + parent.height / 2 - metrics.height / 2 + jitterY;
    }

    const textAlign = centerText
      ? "center"
      : side === 1 ? "left" : "right";

    if (isPdfRectLink) {
        newNodeId = await ea.addImage(px, py, imageInfo.path);
        const el = ea.getElement(newNodeId);
        const targetWidth = imageInfo.width || EMBEDED_OBJECT_WIDTH_CHILD;
        const ratio = el.width / el.height;
        el.width = targetWidth;
        el.height = targetWidth / ratio;
        if (side === -1 && !autoLayoutDisabled) el.x = px - el.width;
    } else if (imageFile) {
        newNodeId = await ea.addImage(px, py, imageFile);
        const el = ea.getElement(newNodeId);
        const targetWidth = imageInfo.width || EMBEDED_OBJECT_WIDTH_CHILD;
        const ratio = el.width / el.height;
        el.width = targetWidth;
        el.height = targetWidth / ratio;
        if (side === -1 && !autoLayoutDisabled) el.x = px - el.width;
    } else if (embeddableUrl) {
        newNodeId = ea.addEmbeddable(px, py, EMBEDED_OBJECT_WIDTH_CHILD, 0, embeddableUrl);
        const el = ea.getElement(newNodeId);
        if (side === -1 && !autoLayoutDisabled) el.x = px - el.width;
    } else {
        newNodeId = ea.addText(px, py, text, {
          box: boxChildren ? "rectangle" : false,
          textAlign,
          textVerticalAlign: "middle",
          width: shouldWrap ? curMaxW : undefined,
          autoResize: !shouldWrap,
        });
    }

    if (depth === 1) {
      ea.addAppendUpdateCustomData(newNodeId, {
        mindmapNew: true,
        mindmapOrder: nextSiblingOrder,
      });
    } else {
      ea.addAppendUpdateCustomData(newNodeId, { mindmapOrder: nextSiblingOrder });
    }

    ea.copyViewElementsToEAforEditing([parent]);
    
    if (depth === 0 && !parent.customData?.growthMode) {
      ea.addAppendUpdateCustomData(parent.id, {
        growthMode: currentModalGrowthMode,
        autoLayoutDisabled: false,
      });
    }
    
    if ((parent.type === "image" || parent.type === "embeddable") && typeof parent.customData?.mindmapOrder === "undefined") {
      ea.addAppendUpdateCustomData(parent.id, { mindmapOrder: 0 });
    }

    ea.style.strokeWidth = STROKE_WIDTHS[Math.min(depth, STROKE_WIDTHS.length - 1)];
    ea.style.roughness = appState().currentItemRoughness;
    ea.style.strokeStyle = isSolidArrow ? "solid" : appState().currentItemStrokeStyle;
    const startPoint = [parent.x + parent.width / 2, parent.y + parent.height / 2];
    arrowId = ea.addArrow([startPoint, startPoint], {
      startObjectId: parent.id,
      endObjectId: newNodeId,
      startArrowHead: null,
      endArrowHead: null,
    });
    ea.addAppendUpdateCustomData(arrowId, { isBranch: true });
  }

  await ea.addElementsToView(!parent, !!imageFile || isPdfRectLink, true, true);
  ea.clear();

  if (!skipFinalLayout && rootId && !autoLayoutDisabled) {
    await triggerGlobalLayout(rootId);
  } else if (rootId && (autoLayoutDisabled || skipFinalLayout) && parent) {
    const allEls = ea.getViewElements();
    const node = allEls.find((el) => el.id === newNodeId);
    const arrow = allEls.find(
      (a) => a.type === "arrow" && a.customData?.isBranch && a.endBinding?.elementId === newNodeId,
    );

    ea.copyViewElementsToEAforEditing(groupBranches ? allEls : arrow ? [arrow] : []);

    if (arrow) {
      const eaA = ea.getElement(arrow.id);
      const sX = parent.x + parent.width / 2,
        sY = parent.y + parent.height / 2;
      const eX = node.x + node.width / 2,
        eY = node.y + node.height / 2;
      eaA.x = sX;
      eaA.y = sY;
      eaA.points = [
        [0, 0],
        [eX - sX, eY - sY],
      ];
    }

    if (groupBranches) {
      ea.getElements().forEach((el) => {
        el.groupIds = [];
      });
      const l1Nodes = getChildrenNodes(rootId, allEls);
      l1Nodes.forEach((l1) => applyRecursiveGrouping(l1.id, allEls));
    } else {
      const { l1AncestorId } = getHierarchy(parent, allEls);
      const bIds = getBranchElementIds(l1AncestorId, allEls);
      
      // Look for an existing group ID among the OLD elements of the branch
      const existingGroupedEl = allEls.find(el => 
        bIds.includes(el.id) && 
        el.id !== newNodeId && 
        el.id !== arrowId && 
        el.groupIds?.length > 0
      );
      const commonGroupId = existingGroupedEl ? existingGroupedEl.groupIds[0] : null;
      
      if (commonGroupId) {
        const newIds = [newNodeId, arrowId].filter(Boolean);
        ea.copyViewElementsToEAforEditing(allEls.filter(el => newIds.includes(el.id)));
        newIds.forEach(id => {
          const el = ea.getElement(id);
          if (el) el.groupIds = [commonGroupId];
        });
      }
    }

    await ea.addElementsToView(false, false, true, true);
    ea.clear();
  }

  const finalNode = ea.getViewElements().find((el) => el.id === newNodeId);
  if (follow || !parent) {
    ea.selectElementsInView([finalNode]);
  } else if (parent) {
    ea.selectElementsInView([parent]);
  }
  if (!parent) {
    zoomToFit();
  }

  mostRecentlyAddedNodeID = finalNode.id; 
  return finalNode;
};

// ---------------------------------------------------------------------------
// 5. Copy & Paste Engine
// ---------------------------------------------------------------------------
const getTextFromNode = (all, node, getRaw = false, shortPath = false) => {
  if (node.type === "embeddable") {
    return `![](${node.link})`;
  }
  if (node.type === "image") {
    const file = ea.getViewFileForImageElement(node);
    if (file) {
      // We use the full path to avoid ambiguity
      return shortPath
        ? `![[${app.metadataCache.fileToLinktext(file,ea.targetView.file.path,true)}]]`
        : `![[${file.path}|${Math.round(node.width)}]]`;
    }
    return ""; 
  }
  if (node.type === "text") {
    return getRaw ? node.rawText : node.originalText;
  }
  const textId = node.boundElements?.find((be) => be.type === "text")?.id;
  if (!textId) return "";
  const textEl = all.find((el) => el.id === textId);
  return textEl ? (getRaw ? textEl.rawText : textEl.originalText) : "";
};

const copyMapAsText = async (cut = false) => {
  if (!ea.targetView) return;
  const sel = ea.getViewSelectedElement();
  if (!sel) {
    new Notice("Select a node to copy.");
    return;
  }
  const all = ea.getViewElements();
  const info = getHierarchy(sel, all);

  const isRootSelected = info.rootId === sel.id;
  const parentNode = getParentNode(sel.id, all);

  const elementsToDelete = [];

  // --- MODIFICATION START: Respect Obsidian Indentation Settings ---
  const useTab = app.vault.getConfig("useTab");
  const tabSize = app.vault.getConfig("tabSize");
  const indentVal = useTab ? "\t" : " ".repeat(tabSize);
  // --- MODIFICATION END ---

  const buildList = (nodeId, depth = 0) => {
    const node = all.find((e) => e.id === nodeId);
    if (!node) return "";

    if (cut) {
      elementsToDelete.push(node);
      node.boundElements?.forEach((be) => {
        const boundEl = all.find((e) => e.id === be.id);
        if (boundEl) elementsToDelete.push(boundEl);
      });

      if (node.customData?.foldIndicatorId) {
        const ind = all.find(e => e.id === node.customData.foldIndicatorId);
        if (ind) elementsToDelete.push(ind);
      }
    }

    const children = getChildrenNodes(nodeId, all);
    sortChildrenStable(children);
    let str = "";
    const text = getTextFromNode(all, node);
    if (depth === 0 && isRootSelected) {
      str += `# ${text}\n\n`;
    } else {
      str += `${indentVal.repeat(depth - (isRootSelected ? 1 : 0))}- ${text}\n`;
    }

    children.forEach((c) => {
      if (cut) {
        const arrow = all.find(
          (a) =>
            a.type === "arrow" &&
            a.customData?.isBranch &&
            a.startBinding?.elementId === nodeId &&
            a.endBinding?.elementId === c.id,
        );
        if (arrow) elementsToDelete.push(arrow);
      }
      str += buildList(c.id, depth + 1);
    });
    return str;
  };

  const md = buildList(sel.id);
  await navigator.clipboard.writeText(md);

  if (cut) {
    const incomingArrow = all.find(
      (a) => a.type === "arrow" && a.customData?.isBranch && a.endBinding?.elementId === sel.id,
    );
    if (incomingArrow) elementsToDelete.push(incomingArrow);

    ea.deleteViewElements(elementsToDelete);

    if (parentNode) {
      ea.selectElementsInView([parentNode]);
    }

    new Notice(isRootSelected ? "Map cut to clipboard." : "Branch cut to clipboard.");
  } else {
    new Notice(isRootSelected ? "Map copied as markdown." : "Branch copied as bullet list.");
  }
};

const pasteListToMap = async () => {
  if (!ea.targetView) return;
  const rawText = await navigator.clipboard.readText();
  if (!rawText) return;

  const sel = ea.getViewSelectedElement();
  let currentParent;

  const lines = rawText.split(/\r\n|\n|\r/).filter((l) => l.trim() !== "");

  if (lines.length === 0) {
    new Notice("Clipboard is empty.");
    return;
  }

  if (lines.length === 1) {
    const text = lines[0].replace(/^(\s*)(?:-|\*|\d+\.)\s+/, "").trim();
    
    if (text) {
      let currentParent = await addNode(text, true, false);
      if (sel) {
        ea.selectElementsInView([ea.getViewElements().find((el)=>el.id === sel.id)]);
      }
      return;
    }
  }

  let parsed = [];
  let rootTextFromHeader = null;

  const isHeader = (l) => l.match(/^#+\s/);
  const isListItem = (l) => l.match(/^(\s*)(?:-|\*|\d+\.)\s+(.*)$/);

  if (!isHeader(lines[0]) && !isListItem(lines[0])) {
    new Notice("Paste aborted. Clipboard does not start with a Markdown list or header.");
    return;
  }

  const delta = isHeader(lines[0]) ? 1 : 0;

  lines.forEach((line) => {
    if (isHeader(line)) {
      parsed.push({ indent: 0, text: line.replace(/^#+\s/, "").trim() });
    } else {
      const match = isListItem(line);
      if (match) {
        parsed.push({ indent: delta + match[1].length, text: match[2].trim() });
      } else if (parsed.length > 0) {
        parsed[parsed.length - 1].text += "\n" + line.trim();
      }
    }
  });

  if (parsed.length === 0 && !rootTextFromHeader) {
    new Notice("No valid Markdown list found on clipboard.");
    return;
  }

  if (!sel) {
    const minIndent = Math.min(...parsed.map((p) => p.indent));
    const topLevelItems = parsed.filter((p) => p.indent === minIndent);
    if (topLevelItems.length === 1) {
      currentParent = await addNode(topLevelItems[0].text, true, true);
      parsed.shift();
    } else {
      currentParent = await addNode("Mindmap Builder Paste", true, true);
    }
  } else {
    currentParent = sel;
  }

  const stack = [{ indent: -1, node: currentParent }];
  for (const item of parsed) {
    while (stack.length > 1 && item.indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const parentNode = stack[stack.length - 1].node;
    ea.selectElementsInView([parentNode]);
    const newNode = await addNode(item.text, false, true);
    stack.push({ indent: item.indent, node: newNode });
  }

  const info = getHierarchy(currentParent, ea.getViewElements());
  await triggerGlobalLayout(info.rootId);

  const allInView = ea.getViewElements();
  const targetToSelect = sel
    ? allInView.find((e) => e.id === sel.id)
    : allInView.find((e) => e.id === currentParent?.id);

  if (targetToSelect) {
    ea.selectElementsInView([targetToSelect]);
  }
  new Notice("Paste complete.");
};

// ---------------------------------------------------------------------------
// 6. Map Actions
// ---------------------------------------------------------------------------
const isNodeRightFromCenter = () => {
  if (!ea.targetView) return;
  const allElements = ea.getViewElements();
  const current = ea.getViewSelectedElement();
  if (!current) return;
  const info = getHierarchy(current, allElements);
  const root = allElements.find((e) => e.id === info.rootId);
  const rootCenter = { x: root.x + root.width / 2, y: root.y + root.height / 2 };
  const curCenter = { x: current.x + current.width / 2, y: current.y + current.height / 2 };
  return curCenter.x > rootCenter.x;
}


const navigateMap = async ({key, zoom = false, focus = false} = {}) => {
  if(!key) return;
  if (!ea.targetView) return;
  let allElements = ea.getViewElements();
  const current = ea.getViewSelectedElement();
  if (!current) return;

  const info = getHierarchy(current, allElements);
  const root = allElements.find((e) => e.id === info.rootId);
  const rootCenter = { x: root.x + root.width / 2, y: root.y + root.height / 2 };
  
  if (current.id === root.id) {
    if (current.customData?.isFolded) {
      await toggleFold("all");
      allElements = ea.getViewElements();
    }

    const children = getChildrenNodes(root.id, allElements);
    if (children.length) {
      // Sort by order/index first to establish the visual list sequence
      sortChildrenStable(children);

      let targetChild = null;

      if (key === "ArrowUp") {
        // First sibling
        targetChild = children[0];
      } else if (key === "ArrowDown") {
        // Last sibling
        targetChild = children[children.length - 1];
      } else {
        // Left/Right Logic
        // Calculate relative positions
        const childrenWithPos = children.map(c => {
          const cCenter = { x: c.x + c.width / 2, y: c.y + c.height / 2 };
          return {
            node: c,
            dx: cCenter.x - rootCenter.x,
            dy: Math.abs(cCenter.y - rootCenter.y) // distance from horizontal centerline
          };
        });

        if (key === "ArrowRight") {
          // Find nodes to the right (dx > 0)
          const rightNodes = childrenWithPos.filter(c => c.dx > 0);
          if (rightNodes.length > 0) {
            // Find the one closest to the middle (min dy)
            rightNodes.sort((a, b) => a.dy - b.dy);
            targetChild = rightNodes[0].node;
          } else {
            // Fallback if no nodes on right (e.g. Left-facing layout), select first in list
            targetChild = children[0];
          }
        } else if (key === "ArrowLeft") {
          // Find nodes to the left (dx < 0)
          const leftNodes = childrenWithPos.filter(c => c.dx < 0);
          if (leftNodes.length > 0) {
            // Find the one closest to the middle (min dy)
            leftNodes.sort((a, b) => a.dy - b.dy);
            targetChild = leftNodes[0].node;
          } else {
            // Fallback if no nodes on left (e.g. Right-facing layout), select last in list
            targetChild = children[children.length - 1];
          }
        }
      }

      if (targetChild) {
        ea.selectElementsInView([targetChild]);
        if (zoom) zoomToFit();
        if (focus) focusSelected();
      }
    }
    return;
  }

  if (key === "ArrowLeft" || key === "ArrowRight") {
    const curCenter = { x: current.x + current.width / 2, y: current.y + current.height / 2 };
    const isInRight = curCenter.x > rootCenter.x;
    const goIn = (key === "ArrowLeft" && isInRight) || (key === "ArrowRight" && !isInRight);
    if (goIn) {
      ea.selectElementsInView([getParentNode(current.id, allElements)]);
    } else {
      if (current.customData?.isFolded) {
        await toggleFold("all");
        allElements = ea.getViewElements();
      }
      const ch = getChildrenNodes(current.id, allElements);
      if (ch.length) ea.selectElementsInView([ch[0]]);
    }
  } else if (key === "ArrowUp" || key === "ArrowDown") {
    const parent = getParentNode(current.id, allElements),
      siblings = getChildrenNodes(parent.id, allElements);
    
    // Calculate the immediate parent's center to sort siblings clockwise around it
    const parentCenter = { x: parent.x + parent.width / 2, y: parent.y + parent.height / 2 };
    
    // Always sort by angle from 12 o'clock (0 degrees) to ensure clockwise navigation
    // regardless of layout mode or hierarchy level
    siblings.sort(
      (a, b) =>
        getAngleFromCenter(parentCenter, { x: a.x + a.width / 2, y: a.y + a.height / 2 }) -
        getAngleFromCenter(parentCenter, { x: b.x + b.width / 2, y: b.y + b.height / 2 }),
    );

    const idx = siblings.findIndex((s) => s.id === current.id);
    const nIdx = key === "ArrowUp" // Up = Counter-Clockwise (Previous), Down = Clockwise (Next)
      ? (idx - 1 + siblings.length) % siblings.length
      : (idx + 1) % siblings.length;
    ea.selectElementsInView([siblings[idx === -1 ? 0 : nIdx]]);
  }

  if (zoom) zoomToFit();
  if (focus) focusSelected(); 
};

const setMapAutolayout = async (endabled) => {
  if (!ea.targetView) return;
  const sel = ea.getViewSelectedElement();
  if (sel) {
    const info = getHierarchy(sel, ea.getViewElements());
    ea.copyViewElementsToEAforEditing(ea.getViewElements().filter((e) => e.id === info.rootId));
    ea.addAppendUpdateCustomData(info.rootId, { autoLayoutDisabled: endabled });
    await ea.addElementsToView(false, false, true, true);
    ea.clear();
  }
};

const refreshMapLayout = async () => {
  if (!ea.targetView) return;
  const sel = ea.getViewSelectedElement();
  if (sel) {
    const info = getHierarchy(sel, ea.getViewElements());
    await triggerGlobalLayout(info.rootId, true);
  }
};

/**
 * Collects all node IDs and arrow IDs belonging to a branch.
 * Includes "isBranch" arrows and internal non-mindmap arrows.
**/
const getBranchElementIds = (nodeId, allElements) => {

  const childMap = new Map();
  const allArrows = [];

  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    if (el.type === "arrow") {
      allArrows.push(el);
      if (el.customData?.isBranch && el.startBinding?.elementId && el.endBinding?.elementId) {
        const start = el.startBinding.elementId;
        const end = el.endBinding.elementId;
        
        if (!childMap.has(start)) {
          childMap.set(start, []);
        }
        childMap.get(start).push(end);
      }
    }
  }

  const branchNodes = new Set([nodeId]);
  const queue = [nodeId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    const children = childMap.get(currentId);
    
    if (children) {
      for (let i = 0; i < children.length; i++) {
        const childId = children[i];
        if (!branchNodes.has(childId)) {
          branchNodes.add(childId);
          queue.push(childId);
        }
      }
    }
  }

  const branchElementIds = Array.from(branchNodes);

  // 3. Identify all arrows (structural OR annotations) where BOTH ends are within the branch
  for (let i = 0; i < allArrows.length; i++) {
    const el = allArrows[i];
    const startId = el.startBinding?.elementId;
    const endId = el.endBinding?.elementId;
    // An arrow (isBranch or internal) is part of the group only if 
      // BOTH ends are nodes within the branch set.
    if (startId && endId && branchNodes.has(startId) && branchNodes.has(endId)) {
      branchElementIds.push(el.id);
    }
  }

  return branchElementIds;
};

/**
 * Toggles a single flat group for the selected branch
**/
const toggleBranchGroup = async () => {
  if (!ea.targetView) return;
  const sel = ea.getViewSelectedElement();
  if (!sel) return;

  const allElements = ea.getViewElements();
  const ids = getBranchElementIds(sel.id, allElements);
  
  if (ids.length <= 1) return;

  ea.copyViewElementsToEAforEditing(allElements.filter(el => ids.includes(el.id)));
  const workbenchEls = ea.getElements();
  
  let newGroupId;
  const commonGroupId = ea.getCommonGroupForElements(workbenchEls);

  if (commonGroupId) {
    workbenchEls.forEach(el => {
      el.groupIds = [];
    });
  } else {
    newGroupId = ea.addToGroup(ids);
  }

  await ea.addElementsToView(false, false, true, true);
  ea.clear();
  
  if (newGroupId) {
    let selectedGroupIds = {};
    selectedGroupIds[newGroupId] = true;
    ea.viewUpdateScene({appState: {selectedGroupIds}})
  }
  
  updateUI();
};

const togglePin = async () => {
  if (!ea.targetView) return;
  const sel = ea.getViewSelectedElement();
  if (sel) {
    const newPinnedState = !(sel.customData?.isPinned === true);
    ea.copyViewElementsToEAforEditing([sel]);
    ea.addAppendUpdateCustomData(sel.id, { isPinned: newPinnedState });
    await ea.addElementsToView(false, false, true, true);
    ea.clear();
    if(!autoLayoutDisabled) await refreshMapLayout();
  }
};

const padding = 10;
const toggleBox = async () => {
  if (!ea.targetView) return;
  let sel = ea.getViewSelectedElement();
  if (!sel) return;
  sel = ea.getBoundTextElement(sel, true).sceneElement;
  if (!sel) return;
  let oldBindId, newBindId;

  const hasContainer = !!sel.containerId;
  const ids = hasContainer ? [sel.id, sel.containerId] : [sel.id];
  const allElements = ea.getViewElements();
  const arrowsToUpdate = allElements.filter(
    (el) =>
      el.type === "arrow" &&
      (ids.contains(el.startBinding?.elementId) || ids.contains(el.endBinding?.elementId)),
  );

  if (hasContainer) {
    const containerId = (oldBindId = sel.containerId);
    newBindId = sel.id;
    const container = allElements.find((el) => el.id === containerId);
    ea.copyViewElementsToEAforEditing(arrowsToUpdate.concat(sel, container));
    const textEl = ea.getElement(sel.id);
    ea.addAppendUpdateCustomData(textEl.id, { isPinned: !!container.customData?.isPinned });
    textEl.containerId = null;
    textEl.boundElements = []; //not null because I will add bound arrows a bit further down
    ea.getElement(containerId).isDeleted = true;
  } else {
    ea.copyViewElementsToEAforEditing(arrowsToUpdate.concat(sel));

    oldBindId = sel.id;
    const rectId = (newBindId = ea.addRect(
      sel.x - padding,
      sel.y - padding,
      sel.width + padding * 2,
      sel.height + padding * 2,
    ));
    const rect = ea.getElement(rectId);
    ea.addAppendUpdateCustomData(rectId, { isPinned: !!sel.customData?.isPinned });
    rect.strokeColor = sel.strokeColor;
    rect.strokeWidth = 2;
    rect.roughness = appState().currentItemRoughness;
    rect.roundness = roundedCorners ? { type: 3 } : null;
    rect.backgroundColor = "transparent";

    const textEl = ea.getElement(sel.id);
    textEl.containerId = rectId;
    textEl.boundElements = null;
    rect.boundElements = [{ type: "text", id: sel.id }];
  }
  ea.getElements()
    .filter((el) => el.type === "arrow")
    .forEach((a) => {
      if (a.startBinding?.elementId === oldBindId) {
        a.startBinding.elementId = newBindId;
        ea.getElement(newBindId).boundElements.push({ type: "arrow", id: a.id });
      }
      if (a.endBinding?.elementId === oldBindId) {
        a.endBinding.elementId = newBindId;
        ea.getElement(newBindId).boundElements.push({ type: "arrow", id: a.id });
      }
    });

  await ea.addElementsToView(false, false);
  ea.clear();

  if (!hasContainer) {
    api().updateContainerSize([ea.getViewElements().find((el) => el.id === newBindId)]);
  }
  ea.selectElementsInView([newBindId]);
  if(!autoLayoutDisabled) await refreshMapLayout();
};

// ---------------------------------------------------------------------------
// 7. UI Modal & Sidepanel Logic
// ---------------------------------------------------------------------------

let detailsEl, inputEl, inputRow, bodyContainer, strategyDropdown, autoLayoutToggle, linkSuggester;
let pinBtn, refreshBtn, cutBtn, copyBtn, boxBtn, dockBtn, editBtn, toggleGroupBtn, zoomBtn;
let inputContainer;
let helpContainer;
let floatingInputModal = null;
let sidepanelWindow;
let popObsidianHotkeyScope = null;
let keydownHandlers = [];
let removePointerDownHandler = null;
let recordingScope = null;

const removeKeydownHandlers = () => {
  keydownHandlers.forEach((f)=>f());
  keydownHandlers = [];
}

const registerKeydownHandler = (host, handler) => {
  removeKeydownHandlers();
  host.addEventListener("keydown", handler, true);
  keydownHandlers.push(()=>host.removeEventListener("keydown", handler, true))
}

const registerObsidianHotkeyOverrides = () => {
  if (popObsidianHotkeyScope) popObsidianHotkeyScope();
  const scope = app.keymap.getRootScope();
  const handlers = [];
  const context = getHotkeyContext();

  if (context === SCOPE.none) return;
  const reg = (mods, key) => {
    const handler = scope.register(mods, key, (e) => true);
    handlers.push(handler);
    scope.keys.unshift(scope.keys.pop());
  };

  RUNTIME_HOTKEYS.forEach(h => {
    if (context < scope) return;
    if (h.key) reg(h.modifiers, h.key);
    if (h.code) {
      const char = h.code.replace("Key", "").replace("Digit", "").toLowerCase();
      reg(h.modifiers, char);
    }
  });

  if(handlers.length === 0) return;

  popObsidianHotkeyScope = () => {
    handlers.forEach(h => scope.unregister(h));
    popObsidianHotkeyScope = null;
  };
};

const focusInputEl = () => {
  setTimeout(() => {
    if(isRecordingHotkey) return;
    if(!inputEl || inputEl.disabled) return;
    inputEl.focus();
    if (!popObsidianHotkeyScope) registerObsidianHotkeyOverrides();
  }, 200);
}

const setButtonDisabled = (btn, disabled) => {
  if (!btn) return;
  btn.disabled = disabled;
  const btnEl = btn.extraSettingsEl ?? btn.buttonEl;
  if (!btnEl) return;
  btnEl.style.opacity = disabled ? "0.5" : "";
  btnEl.style.cursor = disabled ? "not-allowed" : "";
  if (disabled && btn.buttonEl) {
    btn.buttonEl.style.pointerEvents = "auto";
    btn.buttonEl.style.cursor = "not-allowed";
  }
};

const disableUI = () => {
  if (pinBtn) pinBtn.setIcon("pin-off");
  setButtonDisabled(pinBtn, true);
  setButtonDisabled(refreshBtn, true);
  setButtonDisabled(copyBtn, true);
  setButtonDisabled(cutBtn, true);
  setButtonDisabled(boxBtn, true);
  setButtonDisabled(editBtn, true);
  setButtonDisabled(toggleGroupBtn, true);
  setButtonDisabled(zoomBtn, true);
  editingNodeId = null;
  editBtn.extraSettingsEl.style.color = "";
};

const updateUI = () => {
  if (!ea.targetView) {
    inputEl.disabled = true;
    disableUI();
    return;
  }
  inputEl.disabled = false;
  const all = ea.getViewElements();
  const sel = ea.getViewSelectedElement();

  if (sel) {
    const isPinned = sel.customData?.isPinned === true;
    if (pinBtn) {
      pinBtn.setIcon(isPinned ? "pin" : "pin-off");
      pinBtn.setTooltip(
        `${isPinned
          ? "This element is pinned. Click to unpin"
          : "This element is not pinned. Click to pin"
        } the location of the selected element ${getActionHotkeyString(ACTION_PIN)}`,
      );
      setButtonDisabled(pinBtn, false);
    }
    const isEditing = editingNodeId && editingNodeId === sel.id;
    if (editBtn) {
      setButtonDisabled(editBtn, false);
      if (isEditing) {
        editBtn.extraSettingsEl.style.color = "var(--interactive-accent)";
      } else {
        editingNodeId = null;
        editBtn.extraSettingsEl.style.color = "";
      }
    }
    if (toggleGroupBtn) {
      const all = ea.getViewElements();
      const ids = getBranchElementIds(sel.id, all);
      const isGrouped = ids.length > 1 && !!ea.getCommonGroupForElements(all.filter(el => ids.includes(el.id)));

      toggleGroupBtn.setIcon(isGrouped ? "ungroup" : "group");
      toggleGroupBtn.setTooltip(`${isGrouped ? "Ungroup" : "Group"} this branch. Only available if "Group Branches" is disabled. ${getActionHotkeyString(ACTION_TOGGLE_GROUP)}`);
      setButtonDisabled(toggleGroupBtn, groupBranches || ids.length <= 1);
    }
    setButtonDisabled(boxBtn, false);
    setButtonDisabled(zoomBtn, false);
    setButtonDisabled(refreshBtn, false);

    const info = getHierarchy(sel, all);
    setButtonDisabled(cutBtn, info.rootId === sel.id);
    setButtonDisabled(copyBtn, false);

    const root = all.find((e) => e.id === info.rootId);
    const mapStrategy = root.customData?.growthMode;
    if (mapStrategy && mapStrategy !== currentModalGrowthMode) {
      currentModalGrowthMode = mapStrategy;
      if (strategyDropdown) strategyDropdown.setValue(mapStrategy);
    }
    const mapLayoutPref = root.customData?.autoLayoutDisabled === true;
    if (mapLayoutPref !== autoLayoutDisabled) {
      autoLayoutDisabled = mapLayoutPref;
      if (autoLayoutToggle) autoLayoutToggle.setValue(mapLayoutPref);
    }
  } else {
    disableUI();
  }
};

const startEditing = () => {
  const sel = ea.getViewSelectedElement();
  if (!sel) return;
  const all = ea.getViewElements();
  const text = getTextFromNode(all, sel, true, true);
  inputEl.value = text;
  editingNodeId = sel.id;
  updateUI();
  focusInputEl();
};

const commitEdit = async () => {
  if (!editingNodeId) return;
  const all = ea.getViewElements();
  
  let targetNode = all.find(el => el.id === editingNodeId);
  if (!targetNode) return;

  let textElId = targetNode.id;
  if (targetNode.boundElements) {
    const boundText = targetNode.boundElements.find(be => be.type === "text");
    if (boundText) textElId = boundText.id;
  }

  const textEl = all.find(el => el.id === textElId && el.type === "text");
  
  if (textEl) {
    ea.copyViewElementsToEAforEditing([textEl]);
    const eaEl = ea.getElement(textEl.id);
    const text = inputEl.value;
    eaEl.originalText = text;
    eaEl.rawText = text;
    ea.style.fontFamily = eaEl.fontFamily;
    ea.style.fontSize = eaEl.fontSize;

    if (eaEl.width <= maxWidth) {
      const textWidth = ea.measureText(text).width;
      const shouldWrap = textWidth > maxWidth;
      if (!shouldWrap) {
        eaEl.width = Math.ceil(textWidth)
      } else {
        const res = getAdjustedMaxWidth(text, maxWidth);
        eaEl.width = res.width;
        eaEl.text = res.wrappedText;
      }
    }
    
    ea.refreshTextElementSize(eaEl.id);
    
    await ea.addElementsToView(false, false);
    ea.clear();
    
    if (textEl.containerId) {
      const container = ea.getViewElements().find(el => el.id === textEl.containerId);
      if (container) {
        api().updateContainerSize([container]);
      }
    }

    const hierarchyNode = targetNode.containerId ? all.find(el => el.id === targetNode.containerId) : textEl;
    if (hierarchyNode && !autoLayoutDisabled) {
      const info = getHierarchy(hierarchyNode, ea.getViewElements());
      await triggerGlobalLayout(info.rootId);
    }
  }

  editingNodeId = null;
  inputEl.value = "";
};

const renderHelp = (container) => {
  helpContainer = container.createDiv();
  detailsEl = helpContainer.createEl("details");
  detailsEl.createEl("summary", { text: "Instructions & Shortcuts" });
  ea.obsidian.MarkdownRenderer.render(app, INSTRUCTIONS, detailsEl.createDiv(), "", ea.plugin);
};

// ---------------------------------------------------------------------------
// 8. Custom Colors: Palette Manager Modal
// ---------------------------------------------------------------------------
class PaletteManagerModal extends ea.obsidian.Modal {
  constructor(app, settings, onUpdate) {
    super(app);
    this.settings = JSON.parse(JSON.stringify(settings));
    this.onUpdate = onUpdate;
    this.editIndex = -1; // -1 means adding new, >=0 means editing existing
    this.tempColor = "#000000";
  }

  onOpen() {
    this.display();
  }

  display() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Mindmap Branch Palette" });

    // --- Global Toggles ---
    new ea.obsidian.Setting(contentEl)
      .setName("Enable Custom Palette")
      .setDesc("Use these colors instead of auto-generated ones.")
      .addToggle(t => t
        .setValue(this.settings.enabled)
        .onChange(v => {
          this.settings.enabled = v;
          this.save();
          this.display();
        }));

    if (this.settings.enabled) {
      new ea.obsidian.Setting(contentEl)
        .setName("Randomize Order")
        .setDesc("Pick colors randomly instead of sequentially.")
        .addToggle(t => t
          .setValue(this.settings.random)
          .onChange(v => {
            this.settings.random = v;
            this.save();
          }));

      contentEl.createEl("hr");

      // --- Color List ---
      const listContainer = contentEl.createDiv();
      this.settings.colors.forEach((color, index) => {
        const row = new ea.obsidian.Setting(listContainer);
        
        // Color Preview & Name
        const nameEl = row.nameEl;
        nameEl.style.display = "flex";
        nameEl.style.alignItems = "center";
        nameEl.style.gap = "10px";
        
        const preview = nameEl.createDiv();
        preview.style.width = "20px";
        preview.style.height = "20px";
        preview.style.backgroundColor = color;
        preview.style.border = "1px solid var(--background-modifier-border)";
        preview.style.borderRadius = "4px";
        
        nameEl.createSpan({ text: color });

        // Actions
        row
          .addExtraButton(btn => btn
            .setIcon("arrow-big-up")
            .setTooltip("Move Up")
            .setDisabled(index === 0)
            .onClick(() => {
              if (index === 0) return;
              [this.settings.colors[index - 1], this.settings.colors[index]] = 
              [this.settings.colors[index], this.settings.colors[index - 1]];
              this.save();
              this.display();
            }))
          .addExtraButton(btn => btn
            .setIcon("arrow-big-down")
            .setTooltip("Move Down")
            .setDisabled(index === this.settings.colors.length - 1)
            .onClick(() => {
              if (index === this.settings.colors.length - 1) return;
              [this.settings.colors[index + 1], this.settings.colors[index]] = 
              [this.settings.colors[index], this.settings.colors[index + 1]];
              this.save();
              this.display();
            }))
          .addExtraButton(btn => btn
            .setIcon("pencil")
            .setTooltip("Edit")
            .onClick(() => {
              this.editIndex = index;
              this.tempColor = color;
              this.display();
            }))
          .addExtraButton(btn => btn
            .setIcon("trash-2")
            .setTooltip("Delete")
            .onClick(() => {
              this.settings.colors.splice(index, 1);
              if(this.editIndex === index) this.editIndex = -1;
              this.save();
              this.display();
            }));
      });

      contentEl.createEl("hr");

      // --- Add/Edit Area ---
      contentEl.createEl("h4", { text: this.editIndex === -1 ? "Add New Color" : "Edit Color" });
      
      const getHex = (val) => {
        const cm = ea.getCM(val);
        return cm ? cm.stringHEX({alpha: false}) : "#000000";
      };

      const updateEditorState = (val, textComp, pickerComp) => {
        this.tempColor = val;
        if(textComp) textComp.inputEl.value = val;
        if(pickerComp) pickerComp.setValue(getHex(val));
      };

      let textComponent, pickerComponent;

      new ea.obsidian.Setting(contentEl)
        .setName("Select Color")
        .addText(text => {
          textComponent = text;
          text
            .setValue(this.tempColor)
            .onChange(value => {
              this.tempColor = value;
              pickerComponent.setValue(getHex(value));
            });
        })
        .addColorPicker(picker => {
          pickerComponent = picker;
          picker
            .setValue(getHex(this.tempColor))
            .onChange(value => {
              this.tempColor = value;
              textComponent.setValue(value);
            });
        })
        .addButton(btn => btn
          .setIcon("swatch-book")
          .setTooltip("Open Palette Picker")
          .onClick(async () => {
            const selected = await ea.showColorPicker(btn.buttonEl, "elementStroke");
            if (selected) {
              updateEditorState(selected, textComponent, pickerComponent);
            }
          }));

      const actionContainer = contentEl.createDiv();
      actionContainer.style.display = "flex";
      actionContainer.style.justifyContent = "flex-end";
      actionContainer.style.gap = "10px";
      actionContainer.style.marginTop = "10px";

      if (this.editIndex !== -1) {
        const cancelBtn = actionContainer.createEl("button", { text: "Cancel Edit" });
        cancelBtn.onclick = () => {
          this.editIndex = -1;
          this.tempColor = "#000000";
          this.display();
        };
      }

      const saveBtn = actionContainer.createEl("button", { 
        text: this.editIndex === -1 ? "Add Color" : "Update Color",
        cls: "mod-cta"
      });
      saveBtn.onclick = () => {
        if (this.editIndex === -1) {
          this.settings.colors.push(this.tempColor);
        } else {
          this.settings.colors[this.editIndex] = this.tempColor;
          this.editIndex = -1;
        }
        this.save();
        this.display();
      };
    }
  }

  save() {
    this.onUpdate(this.settings);
  }
}

// ---------------------------------------------------------------------------
// 9. Render Functions
// ---------------------------------------------------------------------------

const renderInput = (container, isFloating = false) => {
  container.empty();
  
  pinBtn = refreshBtn = dockBtn = inputEl = null;

  inputRow = new ea.obsidian.Setting(container);
  
  if (!isFloating) {
    inputRow.settingEl.style.display = "block";
    inputRow.controlEl.style.display = "block";
    inputRow.controlEl.style.width = "100%";
    inputRow.controlEl.style.marginTop = "8px";
  } else {
    inputRow.settingEl.style.border = "none";
    inputRow.settingEl.style.padding = "0";
    inputRow.infoEl.style.display = "none";
  }

  inputRow.addText((text) => {
    inputEl = text.inputEl;
    linkSuggester = ea.attachInlineLinkSuggester(inputEl, inputRow.settingEl);
    if (!isFloating) {
      inputEl.style.width = "100%";
    } else {
      inputEl.style.width = "70vw";
      inputEl.style.maxWidth = "350px";
    }
    inputEl.ariaLabel = `Add (Enter)\n` +
      `${ACTION_ADD_FOLLOW} ${getActionHotkeyString(ACTION_ADD_FOLLOW)}\n` +
      `${ACTION_ADD_FOLLOW_FOCUS} ${getActionHotkeyString(ACTION_ADD_FOLLOW_FOCUS)}\n` +
      `${ACTION_ADD_FOLLOW_ZOOM} ${getActionHotkeyString(ACTION_ADD_FOLLOW_ZOOM)}\n`;
    inputEl.placeholder = "Concept... type [[ to insert link";
    inputEl.addEventListener("focus", () => {
      registerObsidianHotkeyOverrides();
      ensureNodeSelected();
      updateUI();
    });
    inputEl.addEventListener("blur", () => {
      if (popObsidianHotkeyScope) popObsidianHotkeyScope();
      saveSettings();
    });
  });

  // Create a specific container for buttons when docked to ensure they sit in one row aligned right
  let buttonContainer;
  if (!isFloating) {
    buttonContainer = inputRow.controlEl.createDiv();
    buttonContainer.style.display = "flex";
    buttonContainer.style.justifyContent = "flex-end";
    buttonContainer.style.gap = "6px";
    buttonContainer.style.marginTop = "6px";
  }

  const addButton = (cb) => {
    inputRow.addExtraButton((btn) => {
      cb(btn);
      // If docked, move the button into our flex container
      if (!isFloating && buttonContainer && btn.extraSettingsEl) {
        buttonContainer.appendChild(btn.extraSettingsEl);
      }
    });
  };

  addButton((btn) => {
    editBtn = btn;
    btn.setIcon("pencil");
    btn.setTooltip(`Edit text of selected node ${getActionHotkeyString(ACTION_EDIT)}`);
    btn.onClick(() => {
      startEditing();
    });
  });

  addButton((btn) => {
    pinBtn = btn;
    btn.setTooltip("Pin/Unpin location of a node. When pinned nodes won't get auto-arranged.")
    btn.onClick(async () => {
      await togglePin();
      updateUI();
      focusInputEl();
    });
  });

  addButton((btn) => {
    refreshBtn = btn;
    btn.setIcon("refresh-ccw");
    btn.setTooltip("Force auto rearrange map.");
    btn.onClick(async () => {
      await refreshMapLayout();
      focusInputEl();
    });
  });

  addButton((btn) => {
    dockBtn = btn;
    btn.setIcon(isFloating ? "dock" : "external-link");
    btn.setTooltip(
      (isFloating ? "Dock to Sidepanel" : "Undock to Floating Modal") + ` ${getActionHotkeyString(ACTION_DOCK_UNDOCK)}`
    );
    btn.onClick(() => {
      toggleDock({silent: false, forceDock: false, saveSetting: true})
    });
  });
  
  updateUI();
};

const renderBody = (contentEl) => {
  bodyContainer = contentEl.createDiv();
  bodyContainer.style.width = "100%";

  const btnGrid = bodyContainer.createDiv({
    attr: {
      style: "display: grid; grid-template-columns: repeat(5, 1fr); gap:6px;",
    },
  });

  btnGrid.createEl("button", {
    text: "Add Sibling",
    cls: "mod-cta",
    attr: { style: "padding: 2px;", title: `(Enter)` },
  }).onclick = async () => {
    await addNode(inputEl.value, false);
    inputEl.value = "";
    if(!autoLayoutDisabled) await refreshMapLayout();
    updateUI();
    focusInputEl();
  };
  btnGrid.createEl("button", { text: "Add+Follow", attr: { style: "padding: 2px;", title: `${getActionHotkeyString(ACTION_ADD_FOLLOW)}`} }).onclick = async () => {
    await addNode(inputEl.value, true);
    inputEl.value = "";
    if(!autoLayoutDisabled) await refreshMapLayout();
    updateUI();
    focusInputEl();
  };
  copyBtn = btnGrid.createEl("button", {
    text: "Copy",
    attr: { style: "padding: 2px;", title: `Copy branch as text ${getActionHotkeyString(ACTION_COPY)}` },
  });
  copyBtn.onclick = copyMapAsText;

  cutBtn = btnGrid.createEl("button", {
    text: "Cut",
    attr: { style: "padding: 2px;", title: `Cut branch as text ${getActionHotkeyString(ACTION_CUT)}` },
  });
  cutBtn.onclick = () => copyMapAsText(true);

  btnGrid.createEl("button", {
    text: "Paste",
    attr: { style: "padding: 2px;", title: `Paste list from clipboard ${getActionHotkeyString(ACTION_PASTE)}` },
  }).onclick = pasteListToMap;

  const zoomSetting = new ea.obsidian.Setting(bodyContainer);
  zoomSetting.setName("Zoom Level").addDropdown((d) => {
    ZOOM_TYPES.forEach((key) => d.addOption(key, key));
    d.setValue(zoomLevel);
    d.onChange((v) => {
        zoomLevel = v;
        setVal(K_ZOOM, v);
        dirty = true;
        zoomToFit();
      });
  });
  zoomSetting.addExtraButton(btn=>{
    zoomBtn = btn;
    btn.setIcon("scan-search")
      .setTooltip(`Cycle element zoom ${getActionHotkeyString(ACTION_ZOOM)}`)
      .onClick(()=>{
        zoomToFit(true);
      })
  });

  new ea.obsidian.Setting(bodyContainer).setName("Growth Strategy").addDropdown((d) => {
    strategyDropdown = d;
    GROWTH_TYPES.forEach((key) => d.addOption(key, key));
    d.setValue(currentModalGrowthMode);
    d.onChange(async (v) => {
        if (!ea.targetView) return;
        currentModalGrowthMode = v;
        setVal(K_GROWTH, v);
        dirty = true;
        const sel = ea.getViewSelectedElement();
        if (sel) {
          const info = getHierarchy(sel, ea.getViewElements());
          ea.copyViewElementsToEAforEditing(ea.getViewElements().filter((e) => e.id === info.rootId));
          ea.addAppendUpdateCustomData(info.rootId, { growthMode: v });
          await ea.addElementsToView(false, false, true, true);
          ea.clear();
          if (!autoLayoutDisabled) {
            await triggerGlobalLayout(info.rootId, true);
          }
        }
      });
  });

  autoLayoutToggle = new ea.obsidian.Setting(bodyContainer)
    .setName("Disable Auto-Layout")
    .addToggle((t) => t
      .setValue(autoLayoutDisabled)
      .onChange(async (v) => {
        autoLayoutDisabled = v;
        setMapAutolayout(v);
      }),
    ).components[0];

  new ea.obsidian.Setting(bodyContainer)
    .setName("Group Branches")
    .addToggle((t) => t
    .setValue(groupBranches)
    .onChange(async (v) => {
      if (!ea.targetView) return;
      groupBranches = v;
      setVal(K_GROUP, v);
      dirty = true;
      const sel = ea.getViewSelectedElement() || ea.getViewElements().find(el => !getParentNode(el.id, ea.getViewElements()));
      if (sel) {
          const info = getHierarchy(sel, ea.getViewElements());
          await triggerGlobalLayout(info.rootId, true, true);
          updateUI();
        }
      })
    )
    .addButton((btn) => {
      toggleGroupBtn = btn;
      btn.setIcon("group");
      btn.setTooltip(`Toggle grouping/ungroupding of a branch. Only available if "Group Branches" is disabled. ${getActionHotkeyString(ACTION_TOGGLE_GROUP)}`);
      btn.onClick(async () => {
        await toggleBranchGroup();
        focusInputEl();
      });
    });

  new ea.obsidian.Setting(bodyContainer)
    .setName("Box Child Nodes")
    .addToggle((t) => t
      .setValue(boxChildren)
      .onChange((v) => {
        boxChildren = v;
        setVal(K_BOX, v);
        dirty = true;
      }),
    )
    .addButton((btn) => {
      boxBtn = btn;
      btn.setIcon("rectangle-horizontal");
      btn.setTooltip(`Toggle node box. ${getActionHotkeyString(ACTION_BOX)}`);
      btn.onClick(async () => {
        await toggleBox();
        focusInputEl();
      });
    });

  new ea.obsidian.Setting(bodyContainer).setName("Rounded Corners").addToggle((t) => t
    .setValue(roundedCorners)
    .onChange((v) => {
      roundedCorners = v;
      setVal(K_ROUND,  v);
      dirty = true;
    }),
  );

  new ea.obsidian.Setting(bodyContainer)
    .setName("Use scene stroke style")
    .setDesc(
      "Use the latest stroke style (solid, dashed, dotted) from the scene, or always use solid style for branches.",
    )
    .addToggle((t) =>
      t.setValue(!isSolidArrow).onChange((v) => {
        isSolidArrow = !v;
        setVal(K_ARROWSTROKE,  !v);
        dirty = true;
      }),
    );

  new ea.obsidian.Setting(bodyContainer)
    .setName("Multicolor Branches")
    .addToggle((t) =>
      t.setValue(multicolor).onChange((v) => {
        multicolor = v;
        setVal(K_MULTICOLOR, v);
        dirty = true;
      }),
    )
    .addButton(btn => 
      btn.setIcon("palette")
        .setTooltip("Configure custom color palette for branches")
        .onClick(() => {
          const modal = new PaletteManagerModal(app, customPalette, (newSettings) => {
            customPalette = newSettings;
            setVal(K_PALETTE, customPalette, true); // save to script settings
            dirty = true;
          });
          modal.open();
        })
    );

  let sliderValDisplay;
  const sliderSetting = new ea.obsidian.Setting(bodyContainer).setName("Max Wrap Width").addSlider((s) => s
    .setLimits(100, 600, 10)
    .setValue(maxWidth)
    .onChange(async (v) => {
      maxWidth = v;
      sliderValDisplay.setText(`${v}px`);
      setVal(K_WIDTH, v);
      dirty = true;
    }),
  );
  sliderValDisplay = sliderSetting.descEl.createSpan({
    text: `${maxWidth}px`,
    attr: { style: "margin-left:10px; font-weight:bold;" },
  });

  new ea.obsidian.Setting(bodyContainer)
    .setName("Center text")
    .setDesc("Toggle off: align nodes to rigth/left depending; Toggle on: center the text.")
    .addToggle((t) => t
      .setValue(centerText)
      .onChange((v) => {
        centerText = v;
        setVal(K_CENTERTEXT, v);
        dirty = true;
      }),
    );

  new ea.obsidian.Setting(bodyContainer).setName(K_FONTSIZE).addDropdown((d) => {
    FONT_SCALE_TYPES.forEach((key) => d.addOption(key, key));
    d.setValue(fontsizeScale);
    d.onChange((v) => {
      fontsizeScale = v;
      setVal(K_FONTSIZE, v);
      dirty = true;
    });
  });

  // ------------------------------------
  // Hotkey Configuration Section
  // ------------------------------------
  const hkDetails = bodyContainer.createEl("details", {
    attr: { style: "margin-top: 15px; border-top: 1px solid var(--background-modifier-border); padding-top: 10px;" }
  });
  hkDetails.createEl("summary", { text: "Hotkey Configuration", attr: { style: "cursor: pointer; font-weight: bold;" } });
  
  const hkContainer = hkDetails.createDiv();
  const hint = hkContainer.createEl("p", {
    text: "These hotkeys may override some Obsidian defaults. They’re Local (⌨️) by default, active only when the MindMap input field is focused. Use the 🌐/🎨/⌨️ toggle to change hotkey scope: 🌐 Overrides Obsidian hotkeys whenever an Excalidraw tab is visible, 🎨 Overrides Obsidian hotkeys whenever Excalidraw is focused, ⌨️ Local (input focused).",
    attr: { style: "color: var(--text-muted); font-size: 0.85em; margin-bottom: 10px;" }
  });

  const refreshHotkeys = () => {
    RUNTIME_HOTKEYS = generateRuntimeHotkeys();
    // Re-register scope if currently active
    registerObsidianHotkeyOverrides();
    // Ensure event listeners are attached to the correct window
    updateKeyHandlerLocation();
  };

  const saveHotkeys = () => {
    setVal(K_HOTKEYS, userHotkeys, true);
    dirty = true;
    refreshHotkeys();
  };

  const isModified = (current) => {
    const def = DEFAULT_HOTKEYS.find(d => d.action === current.action);
    if (!def) return false;
    
    const k1 = current.code || current.key;
    const k2 = def.code || def.key;
    if (k1 !== k2) return true;
    
    if (current.modifiers.length !== def.modifiers.length) return true;
    // Check if every modifier in current exists in def
    return !current.modifiers.every(m => def.modifiers.includes(m));
  };

  const recordHotkey = (btn, hIndex, onUpdate) => {
    const originalText = btn.innerHTML;
    const label = btn.parentElement.querySelector(".setting-hotkey");
    
    btn.innerHTML = `Press hotkey...`;
    btn.addClass("is-recording");
    isRecordingHotkey = true;
    
    recordingScope = new ea.obsidian.Scope();
    app.keymap.pushScope(recordingScope);

    const cleanup = () => {
      if (recordingScope) {
        app.keymap.popScope(recordingScope);
        recordingScope = null;
      }

      btn.innerHTML = originalText;
      btn.removeClass("is-recording");
      
      isRecordingHotkey = false;
      cancelHotkeyRecording = null;
    };

    cancelHotkeyRecording = cleanup;

    const handler = (e) => {
      if (e.key === "Escape") {
        cleanup();
        return false;
      }
      
      // Ignore modifier-only presses (but return false to block them from bubbling)
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return false;

      const mods = [];
      if (e.ctrlKey) mods.push("Ctrl");
      if (e.metaKey) mods.push("Meta");
      if (e.altKey) mods.push("Alt");
      if (e.shiftKey) mods.push("Shift");

      let key = e.key;
      let code = e.code;

      if (key === " ") key = "Space";
      
      const targetConfig = userHotkeys[hIndex];
      const isNav = targetConfig.isNavigation;

      // Validation
      if (isNav && !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) {
        new Notice("This action requires Arrow Keys. Only modifiers can be changed.");
        cleanup();
        return false;
      }

      // Check conflicts
      const conflict = userHotkeys.find((h, i) => {
        if (i === hIndex) return false;
        
        const sameMods = h.modifiers.length === mods.length && h.modifiers.every(m => mods.includes(m));
        if (!sameMods) return false;
        
        if (h.isNavigation && isNav) return true;
        if (h.isNavigation && key.startsWith("Arrow")) return true;
        
        const hKey = h.code ? h.code.replace("Key","").replace("Digit","") : h.key;
        const eKey = code ? code.replace("Key","").replace("Digit","") : key;
        return hKey.toLowerCase() === eKey.toLowerCase();
      });

      if (conflict) {
        label.style.color = "var(--text-error)";
        new Notice(`Conflict with "${conflict.action}"`, 6000);
        setTimeout(() => label.style.color = "", 4000);
      } else {
        if (isNav) {
          targetConfig.modifiers = mods.map(m => m === "Ctrl" || m === "Meta" ? "Mod" : m);
        } else {
          targetConfig.modifiers = mods.map(m => m === "Ctrl" || m === "Meta" ? "Mod" : m);
          if (code && (code.startsWith("Key") || code.startsWith("Digit"))) {
            targetConfig.code = code;
            delete targetConfig.key;
          } else {
            targetConfig.key = key;
            delete targetConfig.code;
          }
        }
        saveHotkeys();

        if (targetConfig.scope === SCOPE.global) {
          const obsConflict = getObsidianConflict(targetConfig);
          if (obsConflict) {
            new Notice(`⚠️ Obsidian Hotkey Conflict!\n\nThis key overrides:\n"${obsConflict}"`, 10000);
          }
        }

        if(onUpdate) onUpdate();
      }

      cleanup();
      // Return false to preventDefault and stop propagation within Obsidian's keymap
      return false;
    };

    recordingScope.register(null, null, handler);
  };

  userHotkeys.forEach((h, index) => {
    if (h.immutable) return;

    const setting = new ea.obsidian.Setting(hkContainer)
      .setName(h.action);
    setting.settingEl.style.paddingRight = "0";
    setting.settingEl.style.paddingLeft = "0";
    
    const controlDiv = setting.controlEl;
    controlDiv.addClass("setting-item-control");
    
    let scopeBtn = null;
    let updateScopeUI = null;

    const hotkeyDisplay = controlDiv.createDiv("setting-command-hotkeys");
    const span = hotkeyDisplay.createSpan("setting-hotkey");
    const restoreBtn = controlDiv.createSpan("clickable-icon setting-restore-hotkey-button");
    
    const updateRowUI = () => {
      span.textContent = getHotkeyDisplayString(userHotkeys[index]);
      restoreBtn.style.display = isModified(userHotkeys[index]) ? "" : "none";
      if (updateScopeUI) updateScopeUI();

      const existingAlert = hotkeyDisplay.querySelector(".hotkey-conflict-icon");
      if(existingAlert) existingAlert.remove();
      span.removeClass("has-conflict");
      span.style.color = "";

      if (userHotkeys[index].scope === SCOPE.global) {
        const conflict = getObsidianConflict(userHotkeys[index]);
        if (conflict) {
          span.addClass("has-conflict");
          
          const alert = hotkeyDisplay.createSpan("hotkey-conflict-icon");
          alert.innerHTML = ea.obsidian.getIcon("octagon-alert").outerHTML;
          alert.style.color = "var(--text-error)";
          alert.style.marginRight = "calc(-1 * var(--size-2-2))";
          alert.style.display = "inline-flex"; // Ensure it sits nicely next to text
          alert.style.cursor = "pointer";
          alert.ariaLabel = `Overrides Obsidian command:\n${conflict}`;
          alert.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            new Notice(`⚠️ Global Hotkey Conflict!\n\nThis key overrides:\n"${conflict}"`, 10000);
          };
        }
      }
    };

    if (!h.isInputOnly) {
      scopeBtn = controlDiv.createSpan("clickable-icon setting-global-hotkey-button");
      scopeBtn.style.marginRight = "calc(-1 * var(--size-2-2))";

      updateScopeUI = () => {
        const scope = userHotkeys[index].scope;
        switch (scope) {
          case SCOPE.input:
            scopeBtn.innerHTML = ea.obsidian.getIcon("keyboard").outerHTML;
            scopeBtn.ariaLabel = "Local: Active only when MindMap Input is focused";
            scopeBtn.style.color = "var(--text-muted)";
            break;
          case SCOPE.excalidraw:
            scopeBtn.innerHTML = ea.obsidian.getIcon("excalidraw-icon").outerHTML;
            scopeBtn.ariaLabel = "Excalidraw: Active whenever MindMap Input or Excalidraw is focused";
            scopeBtn.style.color = "var(--interactive-accent)";
            break;
          case SCOPE.global:
            scopeBtn.innerHTML = ea.obsidian.getIcon("globe").outerHTML;
            scopeBtn.ariaLabel = "Global: Active everywhere in Obsidian, whenever the Excalidraw view is visible";
            scopeBtn.style.color = "var(--text-error)";
            break;
        }
      };

      scopeBtn.onclick = () => {
        const current = userHotkeys[index].scope;
        let next = SCOPE.input;
        if (current === SCOPE.input) next = SCOPE.excalidraw;
        else if (current === SCOPE.excalidraw) next = SCOPE.global;
        else if (current === SCOPE.global) next = SCOPE.input;
        
        userHotkeys[index].scope = next;
        saveHotkeys();

        if (next === SCOPE.global) {
          const conflict = getObsidianConflict(userHotkeys[index]);
          if (conflict) {
            new Notice(`⚠️ Global Hotkey Conflict!\n\nThis key overrides:\n"${conflict}"`, 10000);
          }
        }        
        updateRowUI();
      };
      updateScopeUI();
    }

    restoreBtn.innerHTML = ea.obsidian.getIcon("rotate-ccw").outerHTML;
    restoreBtn.ariaLabel = "Restore default";
    restoreBtn.onclick = () => {
      const def = DEFAULT_HOTKEYS.find(d => d.action === userHotkeys[index].action);
      if (def) {
        userHotkeys[index] = JSON.parse(JSON.stringify(def));
        saveHotkeys();
        updateRowUI();
      }
    };

    updateRowUI();

    const addBtn = controlDiv.createSpan("clickable-icon setting-add-hotkey-button");
    addBtn.innerHTML = ea.obsidian.getIcon("plus-circle").outerHTML;
    addBtn.ariaLabel = "Customize this hotkey";
    addBtn.onclick = () => recordHotkey(addBtn, index, updateRowUI);
  });

  // Spacer to avoid overlap with Obsidian's status bar
  bodyContainer.createDiv({ attr: { style: "height: 40px;" } });
};

const updateKeyHandlerLocation = () => {
  // Attach to the appropriate window based on state
  if (isUndocked) {
    // Floating: Input is reparented to targetView's window
    if (ea.targetView && ea.targetView.ownerWindow) {
      registerKeydownHandler(ea.targetView.ownerWindow, keyHandler);
    }
  } else {
    // Docked: Input is in the sidepanel's window
    if (sidepanelWindow) {
      registerKeydownHandler(sidepanelWindow, keyHandler);
    }
  }
};

/**
 * silent === true: sidepanel is not revealed after docking
 * forceDock === true: if input is undocked, docking happens even if no ExcalidrawView is present
 * saveSetting === true: the dock/undock status is saved to settings. When input is docked because
 *   the ExcalidrawView was closed or when the user presses ESC to finish mindmapping, next time
 *   Mindmap Builder is started it should remember the user preference
 * 
**/ 
const toggleDock = async ({silent=false, forceDock=false, saveSetting=false} = {}) => {
  editingNodeId = null;
  if (!ea.targetView && !(forceDock && isUndocked)) return;
  
  // Only reveal/hide UI if not silent
  if (!silent) {
    const isSidepanelVisible = ea.getSidepanelLeaf().isVisible();
    // If undocking and sidepanel is hidden, leave it hidden (we want the float).
    // If docking and sidepanel is hidden, show it so we can see the input.
    // If undocking and sidepanel is visible, we might want to close it or keep it.
    // Logic from previous iteration:
    if (isUndocked && !isSidepanelVisible) {
      const leaf = ea.getSidepanelLeaf();
      if (leaf) app.workspace.revealLeaf(leaf);
    } else if (isSidepanelVisible && !isUndocked) {
      ea.toggleSidepanelView(); 
    }
    
    if (isUndocked) {
      // If we were undocked (now docking), focus the sidepanel
      app.workspace.setActiveLeaf(ea.getSidepanelLeaf(), {focus: true});
    } else {
      // If we were docked (now undocking), focus the main view
      app.workspace.setActiveLeaf(ea.targetView.leaf, {focus: true});
    }
  }

  isUndocked = !isUndocked;
  if(saveSetting) {
    setVal(K_UNDOCKED, isUndocked);
    dirty = true;
  }

  // Re-route keyboard events to the correct window
  updateKeyHandlerLocation();

  if (isUndocked) {
    // UNDOCK: Create floating modal
    floatingInputModal = new ea.FloatingModal(ea.plugin.app);
    const { contentEl, titleEl, modalEl, headerEl } = floatingInputModal;

    floatingInputModal.onOpen = () => {
      // Reparent the modal to the target view's window. 
      if (ea.targetView && modalEl.ownerDocument !== ea.targetView.ownerDocument) {
        ea.targetView.ownerDocument.body.appendChild(modalEl);
      }

      const {x, y} = ea.targetView.contentEl.getBoundingClientRect();
      contentEl.empty();
      
      const closeEl = modalEl.querySelector(".modal-close-button");
      if (closeEl) closeEl.style.display = "none";
      titleEl.style.display = "none";
      headerEl.style.display = "none";
      modalEl.style.opacity = "0.8";
      modalEl.style.padding = "6px";
      modalEl.style.minHeight = "0px";
      modalEl.style.width = "fit-content";
      modalEl.style.height = "auto";
      modalEl.style.maxHeight = "calc(2 * var(--size-4-4) + 12px + var(--input-height))";
      const container = floatingInputModal.contentEl.createDiv();
      renderInput(container, true);
      focusInputEl();
      setTimeout(() => {
        //the modalEl is repositioned after a delay
        //otherwise the event handlers in FloatingModal would override the move
        //leaving modalEl in the center of the view
        //modalEl.style.top and left must stay in the timeout call
        modalEl.style.top = `${ y + 5 }px`;
        modalEl.style.left = `${ x + 5 }px`;
      }, 100);
    };

    floatingInputModal.onClose = () => {
      if (popObsidianHotkeyScope) popObsidianHotkeyScope();
      floatingInputModal = null;
      if (isUndocked) {
        // If closed manually (e.g. unexpected close), dock back silently
        isUndocked = false;
        setVal(K_UNDOCKED, false);
        updateKeyHandlerLocation(); // Restore listeners to sidepanel
        if (ea.sidepanelTab && inputContainer) renderInput(inputContainer, false);
      }
    };
    
    // Clear input from sidepanel
    inputContainer.empty();
    floatingInputModal.open();
  } else {
    // DOCK: Close floating, render in sidepanel
    if (floatingInputModal) {
      if (floatingInputModal.modalEl && floatingInputModal.modalEl.parentElement) {
        floatingInputModal.modalEl.remove();
      }
      floatingInputModal.close(); 
      floatingInputModal = null;
    }
    renderInput(inputContainer, false);
    if (forceDock) return;
    if (!silent) {
      focusInputEl();
    }
  }
};

const getActionFromEvent = (e) => {
  const isMod = e.ctrlKey || e.metaKey;
  
  const match = RUNTIME_HOTKEYS.find(h => {
    const keyMatch = h.code ? (e.code === h.code) : (e.key === h.key);
    if (!keyMatch) return false;

    const hasMod = h.modifiers.includes("Mod") || h.modifiers.includes("Ctrl") || h.modifiers.includes("Meta");
    const hasShift = h.modifiers.includes("Shift");
    const hasAlt = h.modifiers.includes("Alt");

    return (isMod === hasMod) && 
          (e.shiftKey === hasShift) && 
          (e.altKey === hasAlt);
  });

  return match ? { action: match.action, scope: match.scope } :  { };
};

const keyHandler = async (e) => {
  if (isRecordingHotkey) return;
  if (!ea.targetView || !ea.targetView.leaf.isVisible()) return;

  const currentWindow = isUndocked && floatingInputModal 
    ? ea.targetView?.ownerWindow 
    : sidepanelWindow;

  if (!currentWindow) return;
  
  if (linkSuggester?.isBlockingKeys()) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
    }
    return;
  }
  
  const {action, scope} = getActionFromEvent(e);

  if (!action) return;

  if (getHotkeyContext() < scope) return;

  e.preventDefault();
  e.stopPropagation();

  switch (action) {
    case ACTION_TOGGLE_GROUP: // Handle Alt+G
      await toggleBranchGroup();
      break;
    case ACTION_HIDE:
      if (editingNodeId) {
        editingNodeId = null;
        updateUI();
      } else if (isUndocked) {
        toggleDock({silent: true, forceDock: true, saveSetting: false});
      }
      break;

    case ACTION_PIN:
      await togglePin();
      updateUI();
      focusInputEl();
      break;

    case ACTION_BOX:
      await toggleBox();
      focusInputEl();
      break;

    case ACTION_FOLD:
      await toggleFold("all");
      updateUI();
      focusInputEl();
      break;

    case ACTION_FOLD_L1:
      await toggleFold("l1");
      updateUI();
      focusInputEl();
      break;

    case ACTION_COPY:
      copyMapAsText(false);
      break;

    case ACTION_CUT:
      copyMapAsText(true);
      break;

    case ACTION_PASTE:
      pasteListToMap();
      break;

    case ACTION_ZOOM:
      zoomToFit(true);
      break;

    case ACTION_FOCUS:
      focusSelected();
      break;

    case ACTION_NAVIGATE:
      await navigateMap({key: e.key, zoom: false, focus: false});
      updateUI();
      break;

    case ACTION_NAVIGATE_ZOOM:
      await navigateMap({key: e.key, zoom: true, focus: false});
      updateUI();
      break;

    case ACTION_NAVIGATE_FOCUS:
      await navigateMap({key: e.key, zoom: false, focus: true});
      updateUI();
      break;

    case ACTION_DOCK_UNDOCK:
      toggleDock({saveSetting: true});
      break;

    case ACTION_EDIT:
      startEditing();
      break;

    case ACTION_ADD_FOLLOW:
    case ACTION_ADD_FOLLOW_FOCUS:
    case ACTION_ADD_FOLLOW_ZOOM:
      if (!inputEl.value) return;
      await addNode(inputEl.value, true);
      inputEl.value = "";
      if(!autoLayoutDisabled) await refreshMapLayout();
      updateUI();
      if (action === ACTION_ADD_FOLLOW_FOCUS) focusSelected();
      if (action === ACTION_ADD_FOLLOW_ZOOM) zoomToFit();
      break;
case ACTION_ADD:
      const currentSel = ea.getViewSelectedElement();
      if (
        editingNodeId && currentSel &&
        (currentSel.id === editingNodeId || currentSel.containerId === editingNodeId)
      ) {
        await commitEdit();
      } else {
        if (editingNodeId) {
          editingNodeId = null;
        }
        if (inputEl.value) {
          await addNode(inputEl.value, false);
          inputEl.value = "";
          if(!autoLayoutDisabled) await refreshMapLayout();
        } else {
          const sel = ea.getViewSelectedElement();
          const allElements = ea.getViewElements();

          let handledRecent = false;
          if(mostRecentlyAddedNodeID) {
            const mostRecentNode = getMostRecentlyAddedNode();
            if (mostRecentNode && sel) {
              const selParent = getParentNode(sel.id, allElements);
              const recentParent = getParentNode(mostRecentNode.id, allElements);
              const isSameOrSibling = (sel.id === mostRecentNode.id) || 
                (selParent && recentParent && selParent.id === recentParent.id);
              if(!isSameOrSibling) {
                ea.selectElementsInView([mostRecentNode]);
                handledRecent = true;
              } 
            } else {
              mostRecentlyAddedNodeID = null;
            }
          }
          if (!handledRecent && sel) {
            const parent = getParentNode(sel.id, allElements);
            const siblings = parent ? getChildrenNodes(parent.id, allElements) : [];

            if (siblings.length > 1) {
              await navigateMap({key: "ArrowDown", zoom: false, focus: false});
            }
            else {
              const children = getChildrenNodes(sel.id, allElements);
              if (children.length > 0) {
                sortChildrenStable(children);
                ea.selectElementsInView([children[0]]);
              } 
              else if (parent) {
                ea.selectElementsInView([parent]);
              }
            }
          }
        }
      }
      updateUI();
      break;
  }
};

const canvasPointerListener = (e) => {
  if (!ea.targetView) return;
  // If input is floating, check if click is inside it to avoid deselecting/updating UI prematurely
  if (floatingInputModal && floatingInputModal.modalEl.contains(e.target)) return;
  
  setTimeout(() => {
    if (!ea.targetView) return;
    const selection = ea.getViewSelectedElements();
    const isEligible = !!selection.find(el => el.customData && (
      el.customData.hasOwnProperty("mindmapOrder") || 
      el.customData.hasOwnProperty("isBranch") ||
      el.customData.hasOwnProperty("growthMode")
    ))

    if (isEligible) {
      updateUI();
    }
    
    if (!isEligible && !pinBtn.disabled) {
      updateUI();
    }
  }, 50);
};

// --- Initialization Logic ---
// 1. Checking for exsiting tab right at the beginning of the script (not needed here)
// 2. Create new Sidepanel Tab
ea.createSidepanelTab("Mind Map Builder", true, true).then((tab) => {
  if (!tab) return;

  tab.onWindowMigrated = (newWin) => {
    sidepanelWindow = newWin;
    // If we are docked, re-attach to the new window immediately
    if (!isUndocked && sidepanelWindow) {
      registerKeydownHandler(sidepanelWindow, keyHandler);
    }
  };

  // When the view closes, ensure we dock the input back so it's not lost in floating limbo
  tab.onExcalidrawViewClosed = () => {
    console.log("view closed");
    if (isUndocked) {
      toggleDock({silent: true, forceDock: true, saveSetting: false});
    }
  };

  tab.onOpen = () => {
    const contentEl = tab.contentEl;
    if (!contentEl.hasChildNodes()) {
      renderHelp(contentEl);
      inputContainer = contentEl.createDiv(); 
      renderBody(contentEl);

      sidepanelWindow = contentEl.ownerDocument.defaultView;

      if (isUndocked) {
        toggleDock({silent: true, forceDock: true, saveSetting: false});
      } else {
        renderInput(inputContainer, false);
      }
    }

    ensureNodeSelected();
    updateUI();
    focusInputEl();

    if (ea.activateMindmap) {
      ea.activateMindmap = false;
      const undockPreference = getVal(K_UNDOCKED, false);
      if (undockPreference && !isUndocked) {
        setTimeout(()=>toggleDock({saveSetting: false}));
      } else if (!undockPreference && isUndocked) {
        setTimeout(()=>toggleDock({saveSetting: false}));
        tab.reveal();
      } else if (!undockPreference) {
        tab.reveal();
      }
    }
  };

  const setupEventListeners = (view) => {
    if (!view || !view.ownerWindow) return;
    if(removePointerDownHandler) removePointerDownHandler();
    const win = view.ownerWindow;

    win.addEventListener("pointerdown", canvasPointerListener);
    removePointerDownHandler = () => {
      if (win) win.removeEventListener("pointerdown", canvasPointerListener);
      removePointerDownHandler = null;
    }
    updateKeyHandlerLocation();
  };

  const removeEventListeners = (view) => {
    removeKeydownHandlers();
    if (popObsidianHotkeyScope) popObsidianHotkeyScope();
    if (!view || !view.ownerWindow) return;
    if(removePointerDownHandler) removePointerDownHandler();
  };

  const onFocus = (view) => {
    if (!view) return;

    if (ea.targetView !== view) {
      if (ea.targetView) removeEventListeners(ea.targetView);
      ea.setView(view);
      ea.clear();
    }

    setupEventListeners(view);

    ensureNodeSelected();
    updateUI();
  };

  tab.onFocus = (view) => onFocus(view);

  const onActiveLeafChange = (leaf) => {
    if (cancelHotkeyRecording) cancelHotkeyRecording();

    if (ea.targetView !== leaf.view && ea.isExcalidrawView(leaf.view)) {
      if (ea.targetView) removeEventListeners(ea.targetView);
      ea.setView(leaf.view);
      ea.clear();
      setupEventListeners(leaf.view);
    }
    registerObsidianHotkeyOverrides();

    if(!isUndocked || !floatingInputModal || !leaf) {
      return;
    }

    if (ea.isExcalidrawView(leaf.view)) {
      ensureNodeSelected();
      updateUI();
      const { modalEl } = floatingInputModal
      if (modalEl.style.display === "none") {
        modalEl.style.display = "";
      }
      if (ea.targetView && modalEl.ownerDocument !== ea.targetView.ownerDocument) {
        ea.targetView.ownerDocument.body.appendChild(modalEl);
        linkSuggester?.close();
        linkSuggester = ea.attachInlineLinkSuggester(inputEl, inputRow?.settingEl);
      }
      const {x, y} = ea.targetView.contentEl.getBoundingClientRect();
      modalEl.style.top = `${ y + 5 }px`;
      modalEl.style.left = `${ x + 5 }px`;
    } else {
      if (leaf.view?.getViewType() === "excalidraw-sidepanel") return;
      const { modalEl } = floatingInputModal;
      if (modalEl.style.display !== "none") {
        modalEl.style.display = "none";
      }
    }
  };
  
  // Register the global listener
  const leafChangeRef = app.workspace.on("active-leaf-change", onActiveLeafChange);


  tab.onClose = async () => {
    app.workspace.offref(leafChangeRef);
    if (popObsidianHotkeyScope) popObsidianHotkeyScope();
    if (ea.targetView) {
      removeEventListeners(ea.targetView);
    }
    if (floatingInputModal) {
      if (floatingInputModal.modalEl && floatingInputModal.modalEl.parentElement) {
        floatingInputModal.modalEl.remove();
      }
      floatingInputModal.close();
      floatingInputModal = null;
    }
    await saveSettings();
  };

  // Initial setup if a view is already active
  if (ea.targetView) {
    setupEventListeners(ea.targetView);
  }
  tab.open();
});