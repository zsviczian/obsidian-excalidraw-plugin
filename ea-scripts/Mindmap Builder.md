/*

# Mind Map Builder: Technical Specification & User Guide

![](https://youtu.be/qY66yoobaX4)

## Overview
**Mind Map Builder** transforms the Obsidian-Excalidraw canvas into a rapid brainstorming environment, allowing users to build complex, structured, and visually organized mind maps using primarily keyboard shortcuts.

The script balances **automation** (auto-layout, recursive grouping, and contrast-aware coloring) with **explicit flexibility** (node pinning and redirection logic), ensuring that the mind map stays organized even as it grows to hundreds of nodes. It leverages the Excalidraw Sidepanel API to provide a persistent control interface utilizing the Obsidian sidepanel, that can also be undocked into a floating modal.

## Technical notes

### Sidepanel & Docking
- **Persistent UI**: The script utilizes `ea.createSidepanelTab` to maintain state and controls alongside the drawing canvas.
- **Floating Mode**: The UI can be "undocked" (Shift+Enter) into a `FloatingModal` for a focus-mode experience or to move controls closer to the active drawing area on large screens.

### Map-Specific Persistence (customData)
The script uses `ea.addAppendUpdateCustomData` to store state on elements:
- `growthMode`: Stored on the Root node (Radial, Left, or Right).
- `autoLayoutDisabled`: Stored on the Root node to pause layout engine for specific maps (toggle from UI).
- `isPinned`: Stored on individual nodes (boolean) to bypass the layout engine.
- `isBranch`: Stored on arrows (boolean) to distinguish Mind Map connectors from standard annotations.
- `mindmapOrder`: Stored on nodes (number) to maintain manual sort order of siblings.
- `mindmapNew`: Stored on nodes (boolean) to tag freshly added items so new siblings append after existing order; cleared after layout.
- `isFolded`: Stored on nodes (boolean) to collapse a branch and hide its descendants.
- `foldIndicatorId`: Stored on nodes to track the ephemeral "…" indicator element that signals a folded branch.
- `foldState`: Stored on nodes and branch arrows to cache their opacity/lock state while hidden so it can be restored when unfolded.
- `originalY`: Stored on pinned nodes during global folds to remember their pre-fold Y coordinate for restoration when folds are removed.
- `boundaryId`: Stored on nodes to track the ID of the boundary element (a closed polygon line) that visually encompasses the node's subtree.
- `isBoundary`: Stored on the line polygon to mark it is a boundary for a node.

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
// ---------------------------------------------------------------------------
// Initialization logic
// ---------------------------------------------------------------------------

if (!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("2.19.0")) {
  new Notice("Please update the Excalidraw Plugin to version 2.19.0 or higher.");
  return;
}

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

// Clean up previous event listeners if re-initializing
const removeKeydownHandlers = () => {
  window.MindmapBuilder.keydownHandlers.forEach((f)=>{
    try {
      f();
    } catch(e) {
      console.error("Mindmap Builder: Error removing keydown handler:", e);
    }
  });
  window.MindmapBuilder.keydownHandlers = [];
};

const removeEventListeners = () => {
  removeKeydownHandlers();
  try {
    if (window.MindmapBuilder.popObsidianHotkeyScope) window.MindmapBuilder.popObsidianHotkeyScope();
  } catch (e) {
    console.error("Mindmap Builder: Error popping hotkey scope:", e);
  }
  try {
    if(window.MindmapBuilder.removePointerDownHandler) window.MindmapBuilder.removePointerDownHandler();
  } catch (e) {
    console.error("Mindmap Builder: Error removing pointerdown handler:", e);
  }
};

if(!window.MindmapBuilder) {
  window.MindmapBuilder = {
    keydownHandlers: [],
  }
} else {
  removeEventListeners();
}

const api = () => ea.getExcalidrawAPI();
const getAppState = () => ea.getExcalidrawAPI().getAppState();

// ---------------------------------------------------------------------------
// LOCALIZATION
// ---------------------------------------------------------------------------
const LOCALE = (localStorage.getItem("language") || "en").toLowerCase();

const STRINGS = {
  en: {
    // Notices
    NOTICE_SELECT_NODE_TO_COPY: "Select a node to copy.",
    NOTICE_MAP_CUT: "Map cut to clipboard.",
    NOTICE_BRANCH_CUT: "Branch cut to clipboard.",
    NOTICE_MAP_COPIED: "Map copied as markdown.",
    NOTICE_BRANCH_COPIED: "Branch copied as bullet list.",
    NOTICE_CLIPBOARD_EMPTY: "Clipboard is empty.",
    NOTICE_PASTE_ABORTED: "Paste aborted. Clipboard does not start with a Markdown list or header.",
    NOTICE_NO_LIST: "No valid Markdown list found on clipboard.",
    NOTICE_PASTE_START: "Pasiting, please wait, this can take a while...",
    NOTICE_PASTE_COMPLETE: "Paste complete.",
    NOTICE_ACTION_REQUIRES_ARROWS: "This action requires Arrow Keys. Only modifiers can be changed.",
    NOTICE_CONFLICT_WITH_ACTION: "Conflict with \"{action}\"",
    NOTICE_OBSIDIAN_HOTKEY_CONFLICT: "⚠️ Obsidian Hotkey Conflict!\n\nThis key overrides:\n\"{command}\"",
    NOTICE_GLOBAL_HOTKEY_CONFLICT: "⚠️ Global Hotkey Conflict!\n\nThis key overrides:\n\"{command}\"",

    // Action labels (display only)
    ACTION_LABEL_ADD: "Add",
    ACTION_LABEL_ADD_FOLLOW: "Add + follow",
    ACTION_LABEL_ADD_FOLLOW_FOCUS: "Add + follow + focus",
    ACTION_LABEL_ADD_FOLLOW_ZOOM: "Add + follow + zoom",
    ACTION_LABEL_EDIT: "Edit node",
    ACTION_LABEL_PIN: "Pin/Unpin",
    ACTION_LABEL_BOX: "Box/Unbox",
    ACTION_LABEL_TOGGLE_GROUP: "Group/Ungroup Single Branch",
    ACTION_LABEL_COPY: "Copy",
    ACTION_LABEL_CUT: "Cut",
    ACTION_LABEL_PASTE: "Paste",
    ACTION_LABEL_ZOOM: "Cycle Zoom",
    ACTION_LABEL_FOCUS: "Focus (center) node",
    ACTION_LABEL_NAVIGATE: "Navigate",
    ACTION_LABEL_NAVIGATE_ZOOM: "Navigate & zoom",
    ACTION_LABEL_NAVIGATE_FOCUS: "Navigate & focus",
    ACTION_LABEL_FOLD: "Fold/Unfold Branch",
    ACTION_LABEL_FOLD_L1: "Fold/Unfold to Level 1",
    ACTION_LABEL_FOLD_ALL: "Fold/Unfold Branch Recursively",
    ACTION_LABEL_DOCK_UNDOCK: "Dock/Undock",
    ACTION_LABEL_HIDE: "Dock & hide",

    // Tooltips (shared)
    PIN_TOOLTIP_PINNED: "This element is pinned. Click to unpin the location of the selected element",
    PIN_TOOLTIP_UNPINNED: "This element is not pinned. Click to pin the location of the selected element",
    TOGGLE_GROUP_TOOLTIP_GROUP: "Group this branch. Only available if \"Group Branches\" is disabled",
    TOGGLE_GROUP_TOOLTIP_UNGROUP: "Ungroup this branch. Only available if \"Group Branches\" is disabled",
    TOOLTIP_EDIT_NODE: "Edit text of selected node",
    TOOLTIP_PIN_INIT: "Pin/Unpin location of a node. When pinned nodes won't get auto-arranged",
    TOOLTIP_REFRESH: "Auto rearrange map",
    TOOLTIP_DOCK: "Dock to Sidepanel",
    TOOLTIP_UNDOCK: "Undock to Floating Modal",
    TOOLTIP_ZOOM_CYCLE: "Cycle element zoom",
    TOOLTIP_TOGGLE_GROUP_BTN: "Toggle grouping/ungrouping of a branch. Only available if \"Group Branches\" is disabled.",
    TOOLTIP_TOGGLE_BOX: "Toggle node box",
    TOOLTIP_TOGGLE_BOUNDARY: "Toggle subtree boundary",
    TOOLTIP_TOGGLE_FLOATING_EXTRAS: "Toggle extra controls",
    TOOLTIP_CONFIGURE_PALETTE: "Configure custom color palette for branches",
    TOOLTIP_MOVE_UP: "Move Up",
    TOOLTIP_MOVE_DOWN: "Move Down",
    TOOLTIP_EDIT_COLOR: "Edit",
    TOOLTIP_DELETE_COLOR: "Delete",
    TOOLTIP_OPEN_PALETTE_PICKER: "Open Palette Picker",
    TOOLTIP_FOLD_BRANCH: "Fold/Unfold selected branch",
    TOOLTIP_FOLD_L1_BRANCH: "Fold/Unfold children (Level 1)",
    TOOLTIP_UNFOLD_BRANCH_ALL: "Unfold branch recursively",

    // Buttons and labels
    DOCK_TITLE: "Mind Map Builder",
    HELP_SUMMARY: "Instructions & Shortcuts",
    INPUT_PLACEHOLDER: "Concept... type [[ to insert link",
    BUTTON_ADD_SIBLING: "Add Sibling",
    BUTTON_ADD_FOLLOW: "Add+Follow",
    BUTTON_COPY: "Copy",
    BUTTON_CUT: "Cut",
    BUTTON_PASTE: "Paste",
    TITLE_ADD_SIBLING: "Add sibling with Enter",
    TITLE_ADD_FOLLOW: "Add and follow",
    TITLE_COPY: "Copy branch as text",
    TITLE_CUT: "Cut branch as text",
    TITLE_PASTE: "Paste list from clipboard",
    LABEL_ZOOM_LEVEL: "Zoom Level",
    LABEL_GROWTH_STRATEGY: "Growth Strategy",
    LABEL_ARROW_TYPE: "Curved Connectors",
    LABEL_AUTO_LAYOUT: "Auto-Layout",
    LABEL_GROUP_BRANCHES: "Group Branches",
    LABEL_BOX_CHILD_NODES: "Box Child Nodes",
    LABEL_ROUNDED_CORNERS: "Rounded Corners",
    LABEL_USE_SCENE_STROKE: "Use scene stroke style",
    DESC_USE_SCENE_STROKE: "Use the latest stroke style (solid, dashed, dotted) from the scene, or always use solid style for branches.",
    LABEL_MULTICOLOR_BRANCHES: "Multicolor Branches",
    LABEL_MAX_WRAP_WIDTH: "Max Wrap Width",
    LABEL_CENTER_TEXT: "Center text",
    DESC_CENTER_TEXT: "Toggle off: align nodes to right/left depending; Toggle on: center the text.",
    LABEL_FONT_SIZES: "Font Sizes",
    HOTKEY_SECTION_TITLE: "Hotkey Configuration",
    HOTKEY_HINT: "These hotkeys may override some Obsidian defaults. They’re Local (⌨️) by default, active only when the MindMap input field is focused. Use the 🌐/🎨/⌨️ toggle to change hotkey scope: 🌐 Overrides Obsidian hotkeys whenever an Excalidraw tab is visible, 🎨 Overrides Obsidian hotkeys whenever Excalidraw is focused, ⌨️ Local (input focused).",
    RECORD_HOTKEY_PROMPT: "Press hotkey...",
    ARIA_SCOPE_INPUT: "Local: Active only when MindMap Input is focused",
    ARIA_SCOPE_EXCALIDRAW: "Excalidraw: Active whenever MindMap Input or Excalidraw is focused",
    ARIA_SCOPE_GLOBAL: "Global: Active everywhere in Obsidian, whenever the Excalidraw view is visible",
    ARIA_RESTORE_DEFAULT: "Restore default",
    ARIA_CUSTOMIZE_HOTKEY: "Customize this hotkey",
    ARIA_OVERRIDE_COMMAND: "Overrides Obsidian command:\n{command}",

    // Palette manager
    MODAL_PALETTE_TITLE: "Mindmap Branch Palette",
    LABEL_ENABLE_CUSTOM_PALETTE: "Enable Custom Palette",
    DESC_ENABLE_CUSTOM_PALETTE: "Use these colors instead of auto-generated ones.",
    LABEL_RANDOMIZE_ORDER: "Randomize Order",
    DESC_RANDOMIZE_ORDER: "Pick colors randomly instead of sequentially.",
    HEADING_ADD_NEW_COLOR: "Add New Color",
    HEADING_EDIT_COLOR: "Edit Color",
    LABEL_SELECT_COLOR: "Select Color",
    BUTTON_CANCEL_EDIT: "Cancel Edit",
    BUTTON_ADD_COLOR: "Add Color",
    BUTTON_UPDATE_COLOR: "Update Color",

    // Layout configuration
    MODAL_LAYOUT_TITLE: "Layout Configuration",
    GAP_X:  "Gap X",
    DESC_LAYOUT_GAP_X: "Horizontal distance between a parent and its children. Low: compact width. High: wide diagram.",
    GAP_Y:  "Gap Y",
    DESC_LAYOUT_GAP_Y: "Vertical distance between sibling branches. Low: compact height. High: airy separation.",
    GAP_MULTIPLIER:  "Gap Multiplier",
    DESC_LAYOUT_GAP_MULTIPLIER: "Vertical spacing for 'leaf' nodes (no children), relative to font size. Low: list-like stacking. High: standard tree spacing.",
    DIRECTIONAL_ARC_SPAN_RADIANS:  "Directional Arc-span Radians",
    DESC_LAYOUT_ARC_SPAN: "Curvature of the child list. Low (0.5): Flatter, list-like. High (2.0): Curved, organic, but risk of overlap.",
    ROOT_RADIUS_FACTOR:  "Root Radius Factor",
    DESC_LAYOUT_ROOT_RADIUS: "Multiplier for the Root node's bounding box to determine initial radius.",
    MIN_RADIUS:  "Minimum Radius",
    DESC_LAYOUT_MIN_RADIUS: "Minimum distance of Level 1 nodes from the Root center.",
    RADIUS_PADDING_PER_NODE:  "Radius Padding per Node",
    DESC_LAYOUT_RADIUS_PADDING: "Extra radius added per child node to accommodate dense maps.",
    GAP_MULTIPLIER_RADIAL:  "Radial-layout Gap Multiplier",
    DESC_LAYOUT_GAP_RADIAL: "Angular spacing multiplier for Radial mode.",
    GAP_MULTIPLIER_DIRECTIONAL:  "Directional-layout Gap Multiplier",
    DESC_LAYOUT_GAP_DIRECTIONAL: "Angular spacing multiplier for Left/Right modes.",
    INDICATOR_OFFSET:  "Fold Indicator Offset",
    DESC_LAYOUT_INDICATOR_OFFSET: "Distance of the '...' fold indicator from the node.",
    INDICATOR_OPACITY:  "Fold Indicator Opacity",
    DESC_LAYOUT_INDICATOR_OPACITY: "Opacity of the '...' fold indicator (0-100).",
    CONTAINER_PADDING:  "Container Padding",
    DESC_LAYOUT_CONTAINER_PADDING: "Padding inside the box when 'Box Child Nodes' or 'Box/Unbox' is used.",
    MANUAL_GAP_MULTIPLIER:  "Manual-layout Gap Multiplier",
    DESC_LAYOUT_MANUAL_GAP: "Spacing multiplier when adding nodes while Auto-Layout is disabled.",
    MANUAL_JITTER_RANGE: "Manual-layout Jitter Range",
    DESC_LAYOUT_MANUAL_JITTER: "Random position offset when adding nodes while Auto-Layout is disabled.",

    // Misc
    INPUT_TITLE_PASTE_ROOT: "Mindmap Builder Paste",
    INSTRUCTIONS: "- **ENTER**: Add a sibling node and stay on the current parent for rapid entry. "+
      "If you press enter when the input field is empty the focus will move to the child node that was most recently added. " +
      "Pressing enter subsequent times will iterate through the new child's siblings\n" +
      "- **Hotkeys**: See configuration at the bottom of the sidepanel\n" +
      "- **Global vs Local Hotkeys**: Use the 🌐/⌨️ toggle in configuration.\n" +
      "  - 🌐 **Global**: Works whenever Excalidraw is visible.\n" +
      "  - 🎨 **Excalidraw**: Works whenever Excalidraw is active.\n" +
      "  - ⌨️ **Local**: Works only when the MindMap input field is focused.\n" +
      "- **Dock/Undock**: You can dock/undock the input field using the dock/undock button or the configured hotkey\n" +
      "- **Folding**: Fold/Unfold buttons only appear when the input is docked; when undocked, use the folding hotkeys.\n" +
      "- **ESC**: Docks the floating input field without activating the side panel\n" +
      "- **Coloring**: First level branches get unique colors (Multicolor mode). Descendants inherit parent's color.\n" +
      "- **Grouping**:\n" +
      "  - Enabling \"Group Branches\" recursively groups sub-trees from leaves up to the first level.\n" +
      "- **Copy/Paste**: Export/Import indented Markdown lists.\n" +
      "\n" +
      "😍 If you find this script helpful, please [buy me a coffee ☕](https://ko-fi.com/zsolt).",
  },
};

const t = (key, params = {}) => {
  const str = STRINGS[LOCALE]?.[key] ?? STRINGS.en[key] ?? key;
  return Object.keys(params).reduce((acc, pKey) => acc.replace(new RegExp(`{${pKey}}`, "g"), params[pKey]), str);
};

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
const VALUE_SETS = Object.freeze({
  SCOPE: Object.freeze({
    input: 3,
    excalidraw: 2,
    global: 1,
    none: 0,
  }),
  FONT_SCALE: Object.freeze(["Use scene fontsize", "Fibonacci Scale", "Normal Scale"]),
  GROWTH: Object.freeze(["Radial", "Right-facing", "Left-facing", "Right-Left"]),
  ZOOM: Object.freeze(["Low", "Medium", "High"]),
});

const FONT_SCALE_TYPES = VALUE_SETS.FONT_SCALE;
const GROWTH_TYPES = VALUE_SETS.GROWTH;
const ZOOM_TYPES = VALUE_SETS.ZOOM;
const SCOPE = VALUE_SETS.SCOPE;

const ZOOM_LEVELS = Object.freeze({
  Low: { desktop: 0.10, mobile: 0.20 },
  Medium: { desktop: 0.25, mobile: 0.35 },
  High: { desktop: 0.50, mobile: 0.60 },
});

const getZoom = (level) => {
  const target = ZOOM_LEVELS[level ?? zoomLevel] || ZOOM_LEVELS.Medium;
  return ea.DEVICE.isMobile ? target.mobile : target.desktop;
};

const fontScale = (type) => {
  switch (type) {
    case "Use scene fontsize":
      return Array(4).fill(getAppState().currentItemFontSize);
    case "Fibonacci Scale":
      return [68, 42, 26, 16];
    default: // "Normal Scale"
      return [36, 28, 20, 16];
  }
};

const getFontScale = (type) => fontScale(type) ?? fontScale("Normal Scale");

let dirty = false;
const getVal = (key, def) => ea.getScriptSettingValue(key, typeof def === "object" ? def: { value: def }).value;
const saveSettings = async () => {
  if (dirty) await ea.saveScriptSettings();
  dirty = false;
}
const setVal = (key, value, hidden = false) => {
  const def = ea.getScriptSettingValue(key, {value, hidden});
  def.value = value;
  if(hidden) def.hidden = true;
  ea.setScriptSettingValue(key, def);
}

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
const K_LAYOUT = "Layout Config";
const K_ARROW_TYPE = "Arrow Type";

// ---------------------------------------------------------------------------
// Layout & Geometry Settings
// ---------------------------------------------------------------------------
const LAYOUT_METADATA = {
  GAP_X: {
    def: 120, min: 50, max: 400, step: 10,
    desc: t("DESC_LAYOUT_GAP_X"),
    name: t("GAP_X"),
  },
  GAP_Y: {
    def: 25, min: 10, max: 150, step: 5,
    desc: t("DESC_LAYOUT_GAP_Y"),
    name: t("GAP_Y"),
  },
  GAP_MULTIPLIER: {
    def: 0.6, min: 0.1, max: 3.0, step: 0.1,
    desc: t("DESC_LAYOUT_GAP_MULTIPLIER"),
    name: t("GAP_MULTIPLIER"),
  },
  DIRECTIONAL_ARC_SPAN_RADIANS: {
    def: 1.0, min: 0.1, max: 3.14, step: 0.1,
    desc: t("DESC_LAYOUT_ARC_SPAN"),
    name: t("DIRECTIONAL_ARC_SPAN_RADIANS"),
  },
  ROOT_RADIUS_FACTOR: {
    def: 0.8, min: 0.5, max: 2.0, step: 0.1,
    desc: t("DESC_LAYOUT_ROOT_RADIUS"),
    name: t("ROOT_RADIUS_FACTOR"),
  },
  MIN_RADIUS: {
    def: 350, min: 150, max: 600, step: 10,
    desc: t("DESC_LAYOUT_MIN_RADIUS"),
    name: t("MIN_RADIUS"),
  },
  RADIUS_PADDING_PER_NODE: {
    def: 7, min: 0, max: 20, step: 1,
    desc: t("DESC_LAYOUT_RADIUS_PADDING"),
    name: t("RADIUS_PADDING_PER_NODE"),
  },
  GAP_MULTIPLIER_RADIAL: {
    def: 3.1, min: 1.0, max: 5.0, step: 0.1,
    desc: t("DESC_LAYOUT_GAP_RADIAL"),
    name: t("GAP_MULTIPLIER_RADIAL"),
  },
  GAP_MULTIPLIER_DIRECTIONAL: {
    def: 1.5, min: 1.0, max: 3.0, step: 0.1,
    desc: t("DESC_LAYOUT_GAP_DIRECTIONAL"),
    name: t("GAP_MULTIPLIER_DIRECTIONAL"),
  },
  INDICATOR_OFFSET: {
    def: 10, min: 5, max: 50, step: 5,
    desc: t("DESC_LAYOUT_INDICATOR_OFFSET"),
    name: t("INDICATOR_OFFSET"),
  },
  INDICATOR_OPACITY: {
    def: 40, min: 10, max: 100, step: 10,
    desc: t("DESC_LAYOUT_INDICATOR_OPACITY"),
    name: t("INDICATOR_OPACITY"),
  },
  CONTAINER_PADDING: {
    def: 10, min: 0, max: 50, step: 2,
    desc: t("DESC_LAYOUT_CONTAINER_PADDING"),
    name: t("CONTAINER_PADDING"),
  },
  MANUAL_GAP_MULTIPLIER: {
    def: 1.3, min: 1.0, max: 2.0, step: 0.1,
    desc: t("DESC_LAYOUT_MANUAL_GAP"),
    name: t("MANUAL_GAP_MULTIPLIER"),
  },
  MANUAL_JITTER_RANGE: {
    def: 300, min: 0, max: 400, step: 10,
    desc: t("DESC_LAYOUT_MANUAL_JITTER"),
    name: t("MANUAL_JITTER_RANGE"),
  }
};

let layoutSettings = getVal(K_LAYOUT, {value: {}, hidden: true});

Object.keys(LAYOUT_METADATA).forEach(k => {
  if (layoutSettings[k] === undefined) layoutSettings[k] = LAYOUT_METADATA[k].def;
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const COLOR_CONTRAST_MIN = 2.5;
const COLOR_DISTINCT_THRESHOLD = 40;
const HUE_STEP_BASE = 15;
const HUE_STEP_JITTER = 4;
const SAT_BASE = 75;
const SAT_JITTER = 10;
const LIGHT_BASE_DARK = 65;
const LIGHT_JITTER_DARK = 10;
const LIGHT_BASE_LIGHT = 36;
const LIGHT_JITTER_LIGHT = 8;

// ---------------------------------------------------------------------------
// UI & Interaction Constants
// ---------------------------------------------------------------------------
const WRAP_WIDTH_MIN = 100;
const WRAP_WIDTH_MAX = 600;
const WRAP_WIDTH_STEP = 10;
const FLOAT_MODAL_OPACITY = 0.8;
const FLOAT_MODAL_OFFSET = 5;
const FLOAT_MODAL_MAX_HEIGHT = "calc(2 * var(--size-4-4) + 12px + var(--input-height))";
const NOTICE_DURATION_CONFLICT = 6000;
const NOTICE_DURATION_GLOBAL_CONFLICT = 10000;

let arrowType = getVal(K_ARROW_TYPE, {value: "curved", valueset: ["curved", "straight"]});
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

// -----------------------------------------------------------
// Cleanup an migration of old settings values
// -----------------------------------------------------------
if (!ea.getScriptSettingValue(K_FONTSIZE, {value: "Normal Scale", valueset: FONT_SCALE_TYPES}).hasOwnProperty("valueset")) {
  ea.setScriptSettingValue (K_FONTSIZE, {value: fontsizeScale, valueset: FONT_SCALE_TYPES});
  dirty = true;
}

if (!ea.getScriptSettingValue(K_GROWTH, {value: "Right-facing", valueset: GROWTH_TYPES}).hasOwnProperty("valueset")) {
  ea.setScriptSettingValue (K_GROWTH, {value: currentModalGrowthMode, valueset: GROWTH_TYPES});
  dirty = true;
}

const settingsTemp = ea.getScriptSettings();
if(settingsTemp && settingsTemp.hasOwnProperty("Is Minimized")) {
  delete settingsTemp["Is Minimized"];
  dirty = true;
}


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
// HOTKEY SUPPORT FUNCTIONS
// ------------------------------------------------
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
const ACTION_FOLD_ALL = "Fold/Unfold Branch Recursively";
const ACTION_TOGGLE_BOUNDARY = "Toggle Boundary";

const ACTION_DOCK_UNDOCK = "Dock/Undock";
const ACTION_HIDE = "Dock & hide";
const ACTION_REARRANGE = "Rearrange Map";
const ACTION_TOGGLE_FLOATING_EXTRAS = "Toggle Floating Extra Buttons";

const ACTION_LABEL_KEYS = {
  [ACTION_ADD]: "ACTION_LABEL_ADD",
  [ACTION_ADD_FOLLOW]: "ACTION_LABEL_ADD_FOLLOW",
  [ACTION_ADD_FOLLOW_FOCUS]: "ACTION_LABEL_ADD_FOLLOW_FOCUS",
  [ACTION_ADD_FOLLOW_ZOOM]: "ACTION_LABEL_ADD_FOLLOW_ZOOM",
  [ACTION_EDIT]: "ACTION_LABEL_EDIT",
  [ACTION_PIN]: "ACTION_LABEL_PIN",
  [ACTION_BOX]: "ACTION_LABEL_BOX",
  [ACTION_TOGGLE_GROUP]: "ACTION_LABEL_TOGGLE_GROUP",
  [ACTION_COPY]: "ACTION_LABEL_COPY",
  [ACTION_CUT]: "ACTION_LABEL_CUT",
  [ACTION_PASTE]: "ACTION_LABEL_PASTE",
  [ACTION_ZOOM]: "ACTION_LABEL_ZOOM",
  [ACTION_FOCUS]: "ACTION_LABEL_FOCUS",
  [ACTION_NAVIGATE]: "ACTION_LABEL_NAVIGATE",
  [ACTION_NAVIGATE_ZOOM]: "ACTION_LABEL_NAVIGATE_ZOOM",
  [ACTION_NAVIGATE_FOCUS]: "ACTION_LABEL_NAVIGATE_FOCUS",
  [ACTION_FOLD]: "ACTION_LABEL_FOLD",
  [ACTION_FOLD_L1]: "ACTION_LABEL_FOLD_L1",
  [ACTION_FOLD_ALL]: "ACTION_LABEL_FOLD_ALL",
  [ACTION_TOGGLE_BOUNDARY]: "TOOLTIP_TOGGLE_BOUNDARY",
  [ACTION_DOCK_UNDOCK]: "ACTION_LABEL_DOCK_UNDOCK",
  [ACTION_HIDE]: "ACTION_LABEL_HIDE",
  [ACTION_TOGGLE_FLOATING_EXTRAS]: "TOOLTIP_TOGGLE_FLOATING_EXTRAS",
};

const getActionLabel = (action) => t(ACTION_LABEL_KEYS[action] ?? action);

// Default configuration
// scope may be "input" | "excalidraw" | "global"
// - input: the hotkey only works if the inputEl has focus
// - excalidraw: the hotkey works when either the inputEl has focus or the sidepanelView leaf or the Excalidraw leaf is active
// - global: the hotkey works across obsidian, when ever the Excalidraw view in ea.targetView is visible, i.e. the hotkey works even if the user is active in a leaf like pdf viewer, markdown note, open next to Excalidraw.
// - none: ea.targetView not set or Excalidraw leaf not visible
const DEFAULT_HOTKEYS = [
  // Creation - Enter based
  { action: ACTION_ADD, key: "Enter", modifiers: [], immutable: true, scope: SCOPE.input, isInputOnly: true },
  { action: ACTION_ADD_FOLLOW, key: "Enter", modifiers: ["Mod", "Alt"], scope: SCOPE.input, isInputOnly: true },
  { action: ACTION_ADD_FOLLOW_FOCUS, key: "Enter", modifiers: ["Mod"], scope: SCOPE.input, isInputOnly: true },
  { action: ACTION_ADD_FOLLOW_ZOOM, key: "Enter", modifiers: ["Mod", "Shift"], scope: SCOPE.input, isInputOnly: true },

  // Edit
  { action: ACTION_EDIT, code: "KeyE", modifiers: ["Mod"], scope: SCOPE.input, isInputOnly: false },

  // Structure Modifiers
  { action: ACTION_PIN, code: "KeyP", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false },
  { action: ACTION_BOX, code: "KeyB", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false },
  { action: ACTION_TOGGLE_BOUNDARY, code: "KeyB", modifiers: ["Alt", "Shift"], scope: SCOPE.input, inputOnly: false },
  { action: ACTION_TOGGLE_GROUP, code: "KeyG", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false },

  // Clipboard (Alt to distinguish from text editing)
  { action: ACTION_COPY, code: "KeyC", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false },
  { action: ACTION_CUT, code: "KeyX", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false },
  { action: ACTION_PASTE, code: "KeyV", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false },

  // View Actions
  { action: ACTION_REARRANGE, code: "KeyR", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false },
  { action: ACTION_ZOOM, code: "KeyZ", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false },
  { action: ACTION_FOCUS, code: "KeyF", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false },

  //Window
  { action: ACTION_DOCK_UNDOCK, key: "Enter", modifiers: ["Shift"], scope: SCOPE.input, isInputOnly: true },
  { action: ACTION_HIDE, key: "Escape", modifiers: [], immutable: true , scope: SCOPE.excalidraw, isInputOnly: true },

  //Navigation
  { action: ACTION_NAVIGATE, key: "ArrowKeys", modifiers: ["Alt"], isNavigation: true, scope: SCOPE.input, isInputOnly: false },
  { action: ACTION_NAVIGATE_ZOOM, key: "ArrowKeys", modifiers: ["Alt", "Shift"], isNavigation: true, scope: SCOPE.input, isInputOnly: false },
  { action: ACTION_NAVIGATE_FOCUS, key: "ArrowKeys", modifiers: ["Alt", "Mod"], isNavigation: true, scope: SCOPE.input, isInputOnly: false },
  { action: ACTION_FOLD, code: "Digit1", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false },
  { action: ACTION_FOLD_L1, code: "Digit2", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false },
  { action: ACTION_FOLD_ALL, code: "Digit3", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false },
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

const getInstructions = () => `
<br>
<div class="ex-coffee-div"><a href="https://ko-fi.com/zsolt"><img src="https://storage.ko-fi.com/cdn/kofi6.png?v=6" border="0" alt="Buy Me a Coffee at ko-fi.com"  height=45></a></div>

${t("INSTRUCTIONS")}

<a href="https://www.youtube.com/watch?v=qY66yoobaX4" target="_blank"><img src ="https://i.ytimg.com/vi/qY66yoobaX4/maxresdefault.jpg" style="max-width:560px; width:100%"></a>
`;

// addElementsToView with different defaults compared to EA
const addElementsToView = async (
  {
    repositionToCursor = false,
    save = false,
    newElementsOnTop = true,
    shouldRestoreElements = true,
  } = {}
) => {
  if (!ea.targetView) return;
  await ea.addElementsToView(repositionToCursor, save, newElementsOnTop, shouldRestoreElements);
  ea.clear();
  await sleep(10); // Allow Excalidraw to process the new elements
}

// ---------------------------------------------------------------------------
// 2. Traversal & Geometry Helpers
// ---------------------------------------------------------------------------

const getBoundaryHost = (selectedElements) => {
  if (
    selectedElements.length === 1 && selectedElements[0].type === "line" &&
    selectedElements[0].customData.hasOwnProperty("isBoundary")
  ) {
    const sel = selectedElements[0];
    // Check if this line is referenced as a boundaryId by any other element
    const allElements = ea.getViewElements();
    const owner = allElements.find(el => el.customData?.boundaryId === sel.id);
    return owner;
  }
}

const getMindmapNodeFromSelection = () => {
  if (!ea.targetView) return;
  const selectedElements = ea.getViewSelectedElements();

  if (selectedElements.length === 0) return;

  const owner = getBoundaryHost(selectedElements);
  if (owner) {
    return owner;
  }

  // Handle Single Arrow Selection, deliberatly not filtering to el.customData?.isBranch
  if (selectedElements.length === 1 && selectedElements[0].type === "arrow") {
    const sel = selectedElements[0];
    const targetId = sel.startBinding?.elementId || sel.endBinding?.elementId;
    if (targetId) {
      return ea.getViewElements().find((el) => el.id === targetId);
    }
    return;
  }

  // Handle Group Selection (Find Highest Ranking Parent)
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
      return selectedElements.find((el) => el.id === rootId);
    }
  }
}

const ensureNodeSelected = () => {
  const elementToSelect = getMindmapNodeFromSelection();
  if (elementToSelect) {
    ea.selectElementsInView([elementToSelect]);
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
  el = getBoundaryHost([el]) ?? el;

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
  const st = getAppState();
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

  for (let h = 0; h < 360; h += HUE_STEP_BASE + randInt(HUE_STEP_JITTER)) {
    const c = ea.getCM({
      h,
      s: SAT_BASE + randInt(SAT_JITTER),
      l: isDarkBg
        ? LIGHT_BASE_DARK + randInt(LIGHT_JITTER_DARK)
        : LIGHT_BASE_LIGHT + randInt(LIGHT_JITTER_LIGHT),
      a: 1
    });
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
  }).filter(c => c && c.contrast >= COLOR_CONTRAST_MIN); // Filter out absolute invisible colors

  // Sort Logic
  scored.sort((a, b) => {
    // Threshold for "This color is effectively the same as one already used"
    // Distance of ~30 usually means same Hue family and similar shade
    const threshold = COLOR_DISTINCT_THRESHOLD;
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

// ---------------------------------------------------------------------------
// Folding Logic
// ---------------------------------------------------------------------------

const manageFoldIndicator = (node, show, allElements) => {
  if (show) {
    const children = getChildrenNodes(node.id, allElements);
    if (children.length === 0) show = false;
  }
  const existingId = node.customData?.foldIndicatorId;

  let side = 1;
  const parent = getParentNode(node.id, allElements);
  if (parent) {
    const parentCenter = parent.x + parent.width / 2;
    const nodeCenter = node.x + node.width / 2;
    side = nodeCenter < parentCenter ? -1 : 1;
  }

  if (show) {
    let ind;
    if (existingId) {
      ind = allElements.find(el => el.id === existingId);
      if (ind) {
        ind.isDeleted = false;
        ind.strokeColor = node.strokeColor;
        ind.opacity = layoutSettings.INDICATOR_OPACITY;
      }
    }

    // Create new indicator if none exists or wasn't found
    if (!ind) {
      const id = ea.addText(0, 0, "...");
      ind = ea.getElement(id);
      ind.fontSize = node.fontSize;
      ind.strokeColor = node.strokeColor;
      ind.opacity = layoutSettings.INDICATOR_OPACITY;
      ind.textVerticalAlign = "middle";

      if (node.groupIds && node.groupIds.length > 0) {
        ind.groupIds = [node.groupIds[0]];
      } else {
        ea.addToGroup([node.id, id]);
      }
      ea.addAppendUpdateCustomData(node.id, { foldIndicatorId: id });
    }

    if (side === 1) {
        ind.x = node.x + node.width + layoutSettings.INDICATOR_OFFSET;
        ind.textAlign = "left";
    } else {
        ind.x = node.x - layoutSettings.INDICATOR_OFFSET - ind.width;
        ind.textAlign = "right";
    }
    ind.y = node.y + node.height/2 - ind.height/2;
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

  // Handle Boundary Visibility
  // Boundary is hidden if the node itself is hidden OR if the node is folded (hiding children)
if (node.customData?.boundaryId) {
    const boundEl = allElements.find(el => el.id === node.customData.boundaryId);
    if (boundEl) {
      if (shouldHideThis || isFolded) {
        boundEl.opacity = 0;
        boundEl.locked = true;
      } else {
        boundEl.opacity = 30;
        boundEl.locked = false; // Ensure it's unlocked when visible per request
      }
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

const toggleFold = async (mode = "L0") => {
  if (!ea.targetView) return;
  const sel = ea.getViewSelectedElement();
  if (!sel) return;

  const allElements = ea.getViewElements();
  ea.copyViewElementsToEAforEditing(allElements);
  const wbElements = ea.getElements();

  const targetNode = wbElements.find(el => el.id === sel.id);
  if (!targetNode) return;

  const children = getChildrenNodes(targetNode.id, wbElements);
  if (children.length === 0) return;

  if (mode === "L1") {
    const hasGrandChildren = children.some(child => getChildrenNodes(child.id, wbElements).length > 0);
    if (!hasGrandChildren) return;
  }

  let isFoldAction = false;

  if (mode === "L0") {
    const isCurrentlyFolded = targetNode.customData?.isFolded === true;
    isFoldAction = !isCurrentlyFolded;
    ea.addAppendUpdateCustomData(targetNode.id, { isFolded: isFoldAction });
  } else if (mode === "L1") {
    ea.addAppendUpdateCustomData(targetNode.id, { isFolded: false });
    const anyChildFolded = children.some(child => child.customData?.isFolded === true);
    isFoldAction = !anyChildFolded;

    children.forEach(child => {
      ea.addAppendUpdateCustomData(child.id, { isFolded: isFoldAction });
    });
  } else if (mode === "ALL") {
    ea.addAppendUpdateCustomData(targetNode.id, { isFolded: false });
    const nonLeafDescendants = [];
    const stack = [...children];
    
    while (stack.length) {
      const node = stack.pop();
      const nodeChildren = getChildrenNodes(node.id, wbElements);
      
      if (nodeChildren.length > 0) {
        nonLeafDescendants.push(node);
        nodeChildren.forEach(child => stack.push(child));
      }
    }

    const anyDescendantFolded = nonLeafDescendants.some(node => node.customData?.isFolded === true);
    isFoldAction = !anyDescendantFolded;

    nonLeafDescendants.forEach(node => {
      ea.addAppendUpdateCustomData(node.id, { isFolded: isFoldAction });
    });
  }

  updateBranchVisibility(targetNode.id, false, wbElements, true);

  await addElementsToView();

  if (!autoLayoutDisabled) {
    const info = getHierarchy(sel, ea.getViewElements());
    await triggerGlobalLayout(info.rootId);
  }

  const currentViewElements = ea.getViewElements();

  if (mode === "L1") {
    if (isFoldAction) {
      getChildrenNodes(targetNode.id, currentViewElements);
    }
  } else if (mode === "L0") {
    // Mode "L0" (Single node toggle)
    const isPinned = targetNode.customData?.isPinned;

    if (isPinned) {
      if (isFoldAction) {
        const parent = getParentNode(targetNode.id, currentViewElements);
      } else {
        const currentChildren = getChildrenNodes(targetNode.id, currentViewElements);
      }
    } else {
    }
  }
  ea.viewUpdateScene({appState: {selectedGroupIds: {}}});
  focusSelected();
};

// ---------------------------------------------------------------------------
// 3. Layout & Grouping Engine
// ---------------------------------------------------------------------------

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
}

const focusSelected = () => {
  if (!ea.targetView) return;
  const sel = ea.getViewSelectedElement();
  if (!sel) return;

  api().scrollToContent(sel,{
    fitToContent: false,
    animate: true,
  });
};

const getMindmapOrder = (node) => {
  const o = node?.customData?.mindmapOrder;
  return typeof o === "number" && Number.isFinite(o) ? o : 0;
};

const getNodeBox = (node, allElements) => {
  if (node.groupIds && node.groupIds.length > 0) {
    const groupElements = ea.getElementsInTheSameGroupWithElement(node, allElements);
    if(groupElements.length > 1) {
       const box = ExcalidrawLib.getCommonBoundingBox(groupElements);
       return { ...box, elements: groupElements, isGroup: true };
    }
  }
  return { minX: node.x, minY: node.y, width: node.width, height: node.height, elements: [node], isGroup: false };
};

const sortChildrenStable = (children, allElements) => {
  children.sort((a, b) => {
    const ao = getMindmapOrder(a),
      bo = getMindmapOrder(b);
    if (ao !== bo) return ao - bo;
    // Fallback sort by Y position (visual order)
    const ya = allElements ? getNodeBox(a, allElements).minY : a.y;
    const yb = allElements ? getNodeBox(b, allElements).minY : b.y;
    const dy = ya - yb;
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

  const unpinnedChildren = children.filter(child => !child.customData?.isPinned);

  if (unpinnedChildren.length === 0) return node.height;

  let childrenHeight = 0;
  unpinnedChildren.forEach((child, index) => {
    childrenHeight += getSubtreeHeight(child.id, allElements);
    if (index < unpinnedChildren.length - 1) {
      const childNode = allElements.find((el) => el.id === child.id);

      // Check if this child is a leaf in the context of auto-layout (ignoring its pinned children)
      const grandChildren = getChildrenNodes(child.id, allElements);
      const hasUnpinnedGrandChildren = grandChildren.some(gc => !gc.customData?.isPinned);

      const fontSize = childNode.fontSize ?? 20;
      const gap = !hasUnpinnedGrandChildren ? Math.round(fontSize * layoutSettings.GAP_MULTIPLIER) : layoutSettings.GAP_Y;
      childrenHeight += gap;
    }
  });

  return Math.max(node.height, childrenHeight);
};

/**
 * Determines if an element is part of the mindmap structure (Node, Branch Arrow, Boundary).
 */
const isStructuralElement = (el, allElements) => {
  if (el.customData?.isBranch) return true;
  if (el.customData?.growthMode) return true;
  if (el.customData?.isBoundary) return true;
  if (typeof el.customData?.mindmapOrder !== "undefined") return true;

  const connectedArrow = allElements.find(a =>
    a.type === "arrow" &&
    a.customData?.isBranch &&
    (a.startBinding?.elementId === el.id || a.endBinding?.elementId === el.id)
  );
  return !!connectedArrow;
};

/**
 * A group is considered a "Mindmap Group" if it contains at least 2 structural elements.
 * Groups with only 1 structural element (e.g. a Node grouped with a Sticker) are treated as decoration.
 */
const isMindmapGroup = (groupId, allElements) => {
  const groupEls = allElements.filter(el => el.groupIds?.includes(groupId));
  const structuralCount = groupEls.filter(el => isStructuralElement(el, allElements)).length;
  return structuralCount >= 2;
};

/**
 * Finds the first group ID in the element's group stack that qualifies as a Mindmap Group.
 */
const getStructuralGroup = (element, allElements) => {
  if (!element.groupIds || element.groupIds.length === 0) return null;
  return element.groupIds.find(gid => isMindmapGroup(gid, allElements));
};

const applyRecursiveGrouping = (nodeId, allElements) => {
  const children = getChildrenNodes(nodeId, allElements);
  const nodeIdsInSubtree = [nodeId];

  const node = allElements.find(el => el.id === nodeId);
  if (node?.customData?.boundaryId) {
    nodeIdsInSubtree.push(node.customData.boundaryId);
  }

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

// Monotone Chain Convex Hull Algorithm
const getConvexHull = (points) => {
  points.sort((a, b) => a[0] != b[0] ? a[0] - b[0] : a[1] - b[1]);

  const n = points.length;
  if (n <= 2) return points;

  const cross = (a, b, o) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  const lower = [];
  for (let i = 0; i < n; i++) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], points[i]) <= 0) {
      lower.pop();
    }
    lower.push(points[i]);
  }

  const upper = [];
  for (let i = n - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], points[i]) <= 0) {
      upper.pop();
    }
    upper.push(points[i]);
  }

  upper.pop();
  lower.pop();
  return lower.concat(upper);
};

const updateNodeBoundary = (node, allElements) => {
  const boundaryId = node.customData?.boundaryId;

  if (!boundaryId) {
    return;
  }

  if (node.opacity === 0) return;

  const ids = getBranchElementIds(node.id, allElements);

  const branchElements = allElements.filter(el =>
    ids.includes(el.id) &&
    el.id !== boundaryId &&
    el.opacity > 0 &&
    !el.isDeleted
  );

  if (branchElements.length === 0) return;

  const padding = 15;
  let allPoints = [];

  branchElements.forEach(el => {
    const x1 = el.x - padding;
    const y1 = el.y - padding;
    const x2 = el.x + el.width + padding;
    const y2 = el.y + el.height + padding;

    allPoints.push([x1, y1]);
    allPoints.push([x2, y1]);
    allPoints.push([x2, y2]);
    allPoints.push([x1, y2]);
  });

  const hullPoints = getConvexHull(allPoints);

  if (hullPoints.length < 3) return;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  hullPoints.forEach(p => {
    if (p[0] < minX) minX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] > maxY) maxY = p[1];
  });

  const w = maxX - minX;
  const h = maxY - minY;

  let boundaryEl = ea.getElement(boundaryId);

  if (!boundaryEl) return;

  boundaryEl.x = minX;
  boundaryEl.y = minY;
  boundaryEl.width = w;
  boundaryEl.height = h;

  const normalizedPoints = hullPoints.map(p => [p[0] - minX, p[1] - minY]);
  normalizedPoints.push([normalizedPoints[0][0], normalizedPoints[0][1]]); // Close loop
  boundaryEl.points = normalizedPoints;

  boundaryEl.roundness = arrowType === "curved" ? {type: 2} : null;
  boundaryEl.polygon = true;
  boundaryEl.locked = false;

  if (node.groupIds.length > 0 && isMindmapGroup(node.groupIds[0], allElements)) {
     if (!boundaryEl.groupIds || boundaryEl.groupIds.length === 0 || boundaryEl.groupIds[0] !== node.groupIds[0]) {
         boundaryEl.groupIds = [node.groupIds[0]];
     }
  } else {
     boundaryEl.groupIds = [];
  }
};

const configureArrow = (context) => {
  const {arrowId, isChildRight, startId, endId, coordinates, isRadial} = context;
  const {sX, sY, eX, eY} = coordinates;

  // Configure Binding Points (using .0001/.9999 to avoid jumping effect)
  // In Radial mode, bind to the center (0.5) of the root node
  const startRatio = isRadial ? 0.50001 : (isChildRight ? 0.9999 : 0.0001);
  const endRatio = isChildRight ? 0.0001 : 0.9999;
  const centerYRatio = 0.5001;

  const eaArrow = ea.getElement(arrowId);

  eaArrow.startBinding = {
    ...eaArrow.startBinding,
    elementId: startId,
    mode: "orbit",
    fixedPoint: [startRatio, centerYRatio]
  };

  eaArrow.endBinding = {
    ...eaArrow.endBinding,
    elementId: endId,
    mode: "orbit",
    fixedPoint: [endRatio, centerYRatio]
  };

  eaArrow.x = sX;
  eaArrow.y = sY;

  const dx = eX - sX;
  const dy = eY - sY;

  if (arrowType === "straight") {
    eaArrow.roundness = null;
    eaArrow.points = [
      [0, 0],
      [dx, dy],
    ];
  } else {
    eaArrow.roundness = { type: 2 };
    if (isRadial) {
      eaArrow.points = [
        [0, 0],
        [dx * 2 / 3, dy * 0.75],
        [dx, dy]
      ];
    } else {
      eaArrow.points = [
        [0, 0],
        [dx / 3, dy * 0.25],
        [dx * 2 / 3, dy * 0.75],
        [dx, dy]
      ];
    }
  }
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

  if (node.customData?.foldIndicatorId) {
    const ind = ea.getElement(node.customData.foldIndicatorId);
    if(ind) {
      if (effectiveSide === 1) {
          ind.x = eaNode.x + eaNode.width + layoutSettings.INDICATOR_OFFSET;
          ind.textAlign = "left";
      } else {
          ind.x = eaNode.x - layoutSettings.INDICATOR_OFFSET - ind.width;
          ind.textAlign = "right";
      }
      ind.y = eaNode.y + eaNode.height/2 - ind.height/2;
    }
  }

  if (!isPinned && eaNode.type === "text" && !eaNode.containerId && node.textAlign !== "center") {
    eaNode.textAlign = effectiveSide === 1 ? "left" : "right";
  }

  const children = getChildrenNodes(nodeId, allElements);

  const unpinnedChildren = children.filter(child => !child.customData?.isPinned);
  const pinnedChildren = children.filter(child => child.customData?.isPinned);


  if (unpinnedChildren.length > 0) {
    unpinnedChildren.sort((a, b) => {
      const dy = a.y - b.y;
      if (dy !== 0) return dy;
      return String(a.id).localeCompare(String(b.id));
    });

    unpinnedChildren.forEach((child, i) => {
      if (getMindmapOrder(child) !== i) {
        ea.addAppendUpdateCustomData(child.id, { mindmapOrder: i });
      }
    });

    const subtreeHeight = getSubtreeHeight(nodeId, allElements);
    let currentY = currentYCenter - subtreeHeight / 2;
    const dynamicGapX = layoutSettings.GAP_X;

    unpinnedChildren.forEach((child) => {
      const childH = getSubtreeHeight(child.id, allElements);

      layoutSubtree(
        child.id,
        effectiveSide === 1 ? currentX + node.width + dynamicGapX : currentX - dynamicGapX,
        currentY + childH / 2,
        effectiveSide,
        allElements,
        hasGlobalFolds
      );

      const childNode = allElements.find((el) => el.id === child.id);

      const grandChildren = getChildrenNodes(child.id, allElements);
      const hasUnpinnedGrandChildren = grandChildren.some(gc => !gc.customData?.isPinned);

      const fontSize = childNode.fontSize ?? 20;
      const gap = !hasUnpinnedGrandChildren ? Math.round(fontSize * layoutSettings.GAP_MULTIPLIER) : layoutSettings.GAP_Y;

      currentY += childH + gap;
    });
  }

  pinnedChildren.forEach(child => {
    layoutSubtree(
      child.id,
      child.x,
      child.y + child.height/2,
      effectiveSide,
      allElements,
      hasGlobalFolds
    );
  });

  children.forEach(child => {
    const arrow = allElements.find(
      (a) =>
        a.type === "arrow" &&
        a.customData?.isBranch &&
        a.startBinding?.elementId === nodeId &&
        a.endBinding?.elementId === child.id,
    );

    if (arrow) {
      const eaChild = ea.getElement(child.id);

      // Determine relative position
      const childCenterX = eaChild.x + eaChild.width / 2;
      const parentCenterX = currentX + node.width / 2;
      const isChildRight = childCenterX > parentCenterX;

      const sX = isChildRight ? currentX + node.width : currentX;
      const sY = currentYCenter;
      
      const eX = isChildRight ? eaChild.x : eaChild.x + eaChild.width;
      const eY = eaChild.y + eaChild.height / 2;

      configureArrow({
        arrowId: arrow.id, isChildRight, startId:node.id, endId: child.id,
        coordinates: {sX, sY, eX, eY},
      });
    }
  });

  if (node.customData?.boundaryId) {
     updateNodeBoundary(node, ea.getElements());
  }
};

const updateL1Arrow = (node, context) => {
  const { allElements, rootId, rootBox, rootCenter, mode } = context;

  const arrow = allElements.find(
    (a) =>
      a.type === "arrow" &&
      a.customData?.isBranch &&
      a.startBinding?.elementId === rootId &&
      a.endBinding?.elementId === node.id,
  );
  if (arrow) {
    const childBox = getNodeBox(ea.getElement(node.id), ea.getElements());

    const childCenterX = childBox.minX + childBox.width / 2;
    const isChildRight = childCenterX > rootCenter.x;
    const isRadial = mode === "Radial";

    // In Radial mode, start arrow from the center of the root node
    const sX = isRadial ? rootCenter.x : (isChildRight ? rootBox.minX + rootBox.width : rootBox.minX);
    const sY = rootCenter.y;
    
    const eX = isChildRight ? childBox.minX : childBox.minX + childBox.width;
    const eY = childBox.minY + childBox.height / 2;

    configureArrow({
      arrowId: arrow.id, isChildRight, startId:rootId, endId: node.id,
      coordinates: {sX, sY, eX, eY},
      isRadial
    });
  }
};

/**
 * Unified layout function for Level 1 nodes.
 * Handles both Radial (sorted by angle) and Directional (sorted by Y, centered arc).
 */
const layoutL1Nodes = (nodes, options, context) => {
  if (nodes.length === 0) return;
  const { allElements, rootBox, rootCenter, hasGlobalFolds } = context;
  const { sortMethod, centerAngle, gapMultiplier } = options;

  const unpinnedNodes = nodes.filter(n => !n.customData?.isPinned);
  const pinnedNodes = nodes.filter(n => n.customData?.isPinned);

  if (unpinnedNodes.length > 0) {
    const existingNodes = unpinnedNodes.filter((n) => !n.customData?.mindmapNew);
    const newNodes = unpinnedNodes.filter((n) => n.customData?.mindmapNew);

    // SORTING LOGIC:
    // Always sort by current visual position to respect manual user reordering.
    // We update mindmapOrder immediately after to freeze this state.
    if (sortMethod === "vertical") {
      existingNodes.sort((a, b) => a.y - b.y);
    } else {
      // Radial: Sort by current angle to maintain rotational order
      existingNodes.sort((a, b) => {
        return getAngleFromCenter(rootCenter, { x: a.x + a.width / 2, y: a.y + a.height / 2 }) -
          getAngleFromCenter(rootCenter, { x: b.x + b.width / 2, y: b.y + b.height / 2 });
      });
    }

    const sortedNodes = [...existingNodes, ...newNodes];
    const count = sortedNodes.length;
    
    // Persist the visual order immediately so it sticks
    sortedNodes.forEach((node, i) => {
        ea.addAppendUpdateCustomData(node.id, { mindmapOrder: i });
    });

    // METRICS & RADIUS CALCULATION
    const l1Metrics = sortedNodes.map(node => getSubtreeHeight(node.id, allElements));
    const totalSubtreeHeight = l1Metrics.reduce((sum, h) => sum + h, 0);
    const totalGapHeight = (count - 1) * layoutSettings.GAP_Y;
    const totalContentHeight = totalSubtreeHeight + totalGapHeight;

    let radiusY, radiusX, currentAngle;

    // Check if this is the Left side of a directional map (Center approx 270 degrees)
    const isLeftSide = sortMethod === "vertical" && Math.abs(centerAngle - 270) < 1;

    if (sortMethod === "radial") {
      // RADIAL MODE: Distribute around full circle (2PI)
      const radiusFromHeight = totalContentHeight / (2 * Math.PI); 
      
      radiusY = Math.max(
        Math.round(rootBox.height * layoutSettings.ROOT_RADIUS_FACTOR),
        layoutSettings.MIN_RADIUS,
        radiusFromHeight
      ) + count * layoutSettings.RADIUS_PADDING_PER_NODE;

      radiusX = Math.max(
        Math.round(rootBox.width * layoutSettings.ROOT_RADIUS_FACTOR),
        layoutSettings.MIN_RADIUS,
        radiusY // Keep circular
      ) + count * layoutSettings.RADIUS_PADDING_PER_NODE;
      
      // Start fixed at 20 degrees
      currentAngle = 20;

    } else {
      // VERTICAL (Directional) MODE
      const radiusFromHeight = totalContentHeight / layoutSettings.DIRECTIONAL_ARC_SPAN_RADIANS;

      radiusY = Math.max(
        Math.round(rootBox.height * layoutSettings.ROOT_RADIUS_FACTOR),
        layoutSettings.MIN_RADIUS,
        radiusFromHeight
      ) + count * layoutSettings.RADIUS_PADDING_PER_NODE;

      radiusX = Math.max(
        Math.round(rootBox.width * layoutSettings.ROOT_RADIUS_FACTOR),
        layoutSettings.MIN_RADIUS,
        radiusY * 0.2
      ) + count * layoutSettings.RADIUS_PADDING_PER_NODE;

      // Center the arc around the provided centerAngle (90 or 270)
      const totalThetaDeg = (totalContentHeight / radiusY) * (180 / Math.PI);
      
      if (isLeftSide) {
        // Left Side: Iterate Top -> Bottom visually.
        // On the left circle (180-360), Top is ~315 deg, Bottom is ~225 deg.
        // Since we sort nodes Top->Bottom (Y ascending), we must start at the higher angle and decrement.
        currentAngle = centerAngle + totalThetaDeg / 2;
      } else {
        // Right Side: Top is ~45 deg, Bottom is ~135 deg.
        // We start at lower angle and increment.
        currentAngle = centerAngle - totalThetaDeg / 2;
      }
    }

    // PLACEMENT LOOP
    sortedNodes.forEach((node, i) => {
      const nodeHeight = l1Metrics[i];
      let angleStep;

      if (sortMethod === "radial") {
        // Calculate the angular span of the node itself
        const nodeSpanDeg = (nodeHeight / radiusY) * (180 / Math.PI);
        const gapSpanDeg = (layoutSettings.GAP_Y * gapMultiplier / radiusY) * (180 / Math.PI);
        
        // Dynamic Sector Sizing:
        // Ensure at least 8 nodes fit perfectly (360/8 = 45deg). 
        // If count > 8, shrink sector to fit (e.g. 360/10 = 36deg).
        // Also ensure we never overlap large subtrees by taking the max of sector vs actual size.
        const minSectorAngle = 360 / Math.max(count, 8);
        angleStep = Math.max(minSectorAngle, nodeSpanDeg + gapSpanDeg);

        const angleRad = (currentAngle - 90) * (Math.PI / 180);
        const tCX = rootCenter.x + radiusX * Math.cos(angleRad);
        const tCY = rootCenter.y + radiusY * Math.sin(angleRad);
        const side = tCX > rootCenter.x ? 1 : -1;
        
        layoutSubtree(node.id, tCX, tCY, side, allElements, hasGlobalFolds);
        
        // Advance angle
        currentAngle += angleStep;

      } else {
        // Directional Logic (Left/Right)
        const effectiveGap = layoutSettings.GAP_Y * gapMultiplier;
        const nodeSpanRad = nodeHeight / radiusY;
        const gapSpanRad = effectiveGap / radiusY;
        const nodeSpanDeg = nodeSpanRad * (180 / Math.PI);
        const gapSpanDeg = gapSpanRad * (180 / Math.PI);

        let angleDeg;

        if (isLeftSide) {
           // Left side: Move Top -> Bottom (Decrease Angle)
           // Center node in its span: Current (Top Edge) - Half Span
           angleDeg = currentAngle - nodeSpanDeg / 2;
           // Move cursor down: Current - (Full Span + Gap)
           currentAngle -= (nodeSpanDeg + gapSpanDeg);
        } else {
           // Right side: Move Top -> Bottom (Increase Angle)
           // Center node in its span: Current (Top Edge) + Half Span
           angleDeg = currentAngle + nodeSpanDeg / 2;
           // Move cursor down: Current + (Full Span + Gap)
           currentAngle += (nodeSpanDeg + gapSpanDeg);
        }

        const angleRad = (angleDeg - 90) * (Math.PI / 180);
        const tCX = rootCenter.x + radiusX * Math.cos(angleRad);
        const tCY = rootCenter.y + radiusY * Math.sin(angleRad);
        const side = isLeftSide ? -1 : 1;

        layoutSubtree(node.id, tCX, tCY, side, allElements, hasGlobalFolds);
      }

      if (node.customData?.mindmapNew) {
        ea.addAppendUpdateCustomData(node.id, { mindmapNew: undefined });
      }
      updateL1Arrow(node, context);
      if (groupBranches) applyRecursiveGrouping(node.id, allElements);
    });
  }

  // PINNED NODES
  pinnedNodes.forEach(node => {
    const nodeBox = getNodeBox(node, allElements);
    const side = (nodeBox.minX + nodeBox.width / 2) > rootCenter.x ? 1 : -1;
    layoutSubtree(node.id, node.x, node.y + node.height/2, side, allElements, hasGlobalFolds);

    if (node.customData?.mindmapNew) {
      ea.addAppendUpdateCustomData(node.id, { mindmapNew: undefined });
    }
    updateL1Arrow(node, context);
    if (groupBranches) applyRecursiveGrouping(node.id, allElements);
  });
};

const triggerGlobalLayout = async (rootId, force = false, forceUngroup = false) => {
  if (!ea.targetView) return;
  const run = async () => {
    const allElements = ea.getViewElements();
    const root = allElements.find((el) => el.id === rootId);

    // Snapshot positions and identify cross-link arrows
    const originalPositions = new Map();
    allElements.forEach(el => {
      originalPositions.set(el.id, { x: el.x, y: el.y });
    });

    const crossLinkArrows = allElements.filter(el =>
      el.type === "arrow" &&
      !el.customData?.isBranch &&
      el.startBinding?.elementId &&
      el.endBinding?.elementId
    );

    const branchIds = new Set(getBranchElementIds(rootId, allElements));
    const groupToNodes = new Map();

    allElements.forEach(el => {
      if (branchIds.has(el.id) && el.type !== "arrow" && el.groupIds) {
        el.groupIds.forEach(gid => {
          if (!groupToNodes.has(gid)) groupToNodes.set(gid, new Set());
          groupToNodes.get(gid).add(el);
        });
      }
    });

    const decorationsToUpdate = [];

    allElements.forEach(el => {
      const isCrossLink = el.type === "arrow" && el.startBinding?.elementId && el.endBinding?.elementId;
      const isBoundary = el.customData?.isBoundary;
      const isDecoration = !branchIds.has(el.id) && !isCrossLink && !isBoundary && el.groupIds && el.groupIds.length > 0;

      if (isDecoration) {
        const hostNodes = new Set();
        el.groupIds.forEach(gid => {
          const nodesInGroup = groupToNodes.get(gid);
          if (nodesInGroup) {
            nodesInGroup.forEach(node => hostNodes.add(node));
          }
        });

        if (hostNodes.size > 0) {
          const nodesArray = Array.from(hostNodes);
          const box = ExcalidrawLib.getCommonBoundingBox(nodesArray);

          decorationsToUpdate.push({
            elementId: el.id,
            hostNodeIds: nodesArray.map(n => n.id),
            oldCx: box.minX + (box.width / 2),
            oldCy: box.minY + (box.height / 2)
          });
        }
      }
    });

    const hasGlobalFolds = allElements.some(el => el.customData?.isFolded === true);
    const l1Nodes = getChildrenNodes(rootId, allElements);
    if (l1Nodes.length === 0) return;

    ea.copyViewElementsToEAforEditing(allElements);

    if (groupBranches || forceUngroup) {
      const mindmapIds = getBranchElementIds(rootId, allElements);
      mindmapIds.forEach((id) => {
        const el = ea.getElement(id);
        if (el && el.groupIds) {
          el.groupIds = el.groupIds.filter(gid => !isMindmapGroup(gid, allElements));
        }
      });
    }

    const mode = root.customData?.growthMode || currentModalGrowthMode;
    const rootBox = getNodeBox(root, allElements);
    const rootCenter = { x: rootBox.minX + rootBox.width / 2, y: rootBox.minY + rootBox.height / 2 };

    const layoutContext = {
      allElements,
      rootId,
      rootBox,
      rootCenter,
      hasGlobalFolds,
      mode
    };

    // --- MAIN EXECUTION BLOCK ---
    if (mode === "Radial") {
      layoutL1Nodes(l1Nodes, {
        sortMethod: "radial",
        centerAngle: null,
        gapMultiplier: layoutSettings.GAP_MULTIPLIER_RADIAL
      }, layoutContext);
    } else {
      const leftNodes = [];
      const rightNodes = [];

      // Determine which list nodes currently belong to based on their position
      // This is crucial for Right-Left mode to maintain the user's intent if they drag a node across the center
      l1Nodes.forEach((node, index) => {
        if (mode === "Right-facing") {
          rightNodes.push(node);
        } else if (mode === "Left-facing") {
          leftNodes.push(node);
        } else if (mode === "Right-Left") {
          if (node.customData?.mindmapNew) {
             if (index < 2) rightNodes.push(node);
             else if (index < 4) leftNodes.push(node);
             else if (index % 2 === 0) rightNodes.push(node);
             else leftNodes.push(node);
          } else {
             const nodeCenter = node.x + node.width / 2;
             if (nodeCenter < rootCenter.x) leftNodes.push(node);
             else rightNodes.push(node);
          }
        } else {
          rightNodes.push(node);
        }
      });

      layoutL1Nodes(rightNodes, {
        sortMethod: "vertical",
        centerAngle: 90,
        gapMultiplier: layoutSettings.GAP_MULTIPLIER_DIRECTIONAL
      }, layoutContext);

      layoutL1Nodes(leftNodes, {
        sortMethod: "vertical",
        centerAngle: 270,
        gapMultiplier: layoutSettings.GAP_MULTIPLIER_DIRECTIONAL
      }, layoutContext);
    }

    crossLinkArrows.forEach(arrow => {
      const startId = arrow.startBinding.elementId;
      const endId = arrow.endBinding.elementId;
      const startNodeOld = originalPositions.get(startId);
      const endNodeOld = originalPositions.get(endId);
      const startNodeNew = ea.getElement(startId);
      const endNodeNew = ea.getElement(endId);

      if (startNodeOld && endNodeOld && startNodeNew && endNodeNew) {
        const dsX = startNodeNew.x - startNodeOld.x;
        const dsY = startNodeNew.y - startNodeOld.y;
        const deX = endNodeNew.x - endNodeOld.x;
        const deY = endNodeNew.y - endNodeOld.y;
        if (dsX === 0 && dsY === 0 && deX === 0 && deY === 0) return;

        const eaArrow = ea.getElement(arrow.id);
        eaArrow.x += dsX;
        eaArrow.y += dsY;

        const diffX = deX - dsX;
        const diffY = deY - dsY;

        const len = eaArrow.points.length;
        if (len > 0) {
          eaArrow.points = eaArrow.points.map((p, i) => {
            const t = i / (len - 1);
            return [
              p[0] + diffX * t,
              p[1] + diffY * t
            ];
          });
        }
      }
    });

    decorationsToUpdate.forEach(item => {
      const currentHostNodes = item.hostNodeIds.map(id => ea.getElement(id) || allElements.find(x => x.id === id));
      const box = ExcalidrawLib.getCommonBoundingBox(currentHostNodes);
      const newCx = box.minX + (box.width / 2);
      const newCy = box.minY + (box.height / 2);
      const dx = newCx - item.oldCx;
      const dy = newCy - item.oldCy;

      if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
        const decoration = ea.getElement(item.elementId);
        if (decoration) {
          decoration.x += dx;
          decoration.y += dy;
        }
      }
    });
  };
  await run();
  await addElementsToView();
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

const addNode = async (text, follow = false, skipFinalLayout = false, manualAllElements = null, manualParent = null) => {
  if (!ea.targetView) return;
  if (!text || text.trim() === "") return;

  const st = getAppState();
  const isManualMode = !!manualParent;

  let allElements = manualAllElements || ea.getViewElements();
  let parent = manualParent;

  if (!isManualMode) {
    parent = ea.getViewSelectedElement();
    if (parent?.containerId) {
      parent = allElements.find((el) => el.id === parent.containerId);
    }

    if (parent && parent.customData?.isFolded) {
      await toggleFold("L0");
      allElements = ea.getViewElements();
      parent = allElements.find((el) => el.id === parent.id);
    }
  }

  let newNodeId;
  let arrowId;

  // --- Image Detection ---
  const imageInfo = parseImageInput(text);
  let imageFile = null;
  let isPdfRectLink = false;
  
  if (imageInfo) {
    const PDF_RECT_LINK_REGEX = /^[^#]*#page=\d*(&\w*=[^&]+){0,}&rect=\d*,\d*,\d*,\d*/;
    if (imageInfo.path.match(PDF_RECT_LINK_REGEX)) {
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

  let depth = 0, nodeColor = defaultNodeColor, rootId, nextSiblingOrder = 0;
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
  if (!isManualMode) ea.clear();
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
        ea.style.fillStyle = "solid";
        ea.style.backgroundColor = st.viewBackgroundColor;
        newNodeId = ea.addText(0, 0, text, {
          box: "rectangle",
          textAlign: "center",
          textVerticalAlign: "middle",
          //using different color reprsentation so frame can be easily
          //recolored separately from text in Excalidraw UI
          boxStrokeColor: ea.getCM(ea.style.strokeColor).stringRGB(),
          width: shouldWrap ? curMaxW : undefined,
          autoResize: !shouldWrap,
        });
        ea.style.backgroundColor = "transparent";
    }

    ea.addAppendUpdateCustomData(newNodeId, {
      growthMode: currentModalGrowthMode,
      autoLayoutDisabled: false,
    });
    rootId = newNodeId;
  } else {
    ea.style.strokeColor = nodeColor;
    const rootEl = allElements.find((e) => e.id === rootId);
    const rootBox = getNodeBox(rootEl, allElements);
    const mode = rootEl.customData?.growthMode || currentModalGrowthMode;
    const rootCenter = {
      x: rootBox.minX + rootBox.width / 2,
      y: rootBox.minY + rootBox.height / 2,
    };

    const parentBox = getNodeBox(parent, allElements);
    
    // Determine the likely direction of the new node to set initial offset correctly
    // avoiding visual jumping when layout runs.
    let targetSide = 1; // 1 = Right, -1 = Left
    if (depth === 1) {
      if (mode === "Left-facing") targetSide = -1;
      else if (mode === "Right-facing") targetSide = 1;
      else if (mode === "Right-Left") {
         const siblings = getChildrenNodes(parent.id, allElements);
         const idx = siblings.length; // Index of the new node being added
         if (idx < 2) targetSide = 1;
         else if (idx < 4) targetSide = -1;
         else targetSide = idx % 2 === 0 ? 1 : -1;
      } else {
        // Radial or fallback -> Default to parent's relative side or Right
        const parentCenterX = parentBox.minX + parentBox.width / 2;
        targetSide = parentCenterX > rootCenter.x ? 1 : -1;
      }
    } else {
       // Deep nodes follow parent's side
       const parentCenterX = parentBox.minX + parentBox.width / 2;
       targetSide = parentCenterX > rootCenter.x ? 1 : -1;
    }

    const side = targetSide;

    const offset = (mode === "Radial" || side === 1)
      ? rootBox.width * 2
      : -rootBox.width;
      
    let px = parentBox.minX + offset,
      py = parentBox.minY;

    // Ensure new node is placed below existing siblings so visual sort preserves order
    if (!autoLayoutDisabled) {
      const siblings = getChildrenNodes(parent.id, allElements);
      if (siblings.length > 0) {
        const sortedSiblings = siblings.sort((a, b) => a.y - b.y);
        const lastSibling = sortedSiblings[sortedSiblings.length - 1];
        const lastSiblingBox = getNodeBox(lastSibling, allElements);
        py = lastSiblingBox.minY + lastSiblingBox.height + layoutSettings.GAP_Y;
      }
    }

    if (autoLayoutDisabled) {
      const manualGapX = Math.round(parentBox.width * layoutSettings.MANUAL_GAP_MULTIPLIER);
      const jitterX = (Math.random() - 0.5) * layoutSettings.MANUAL_JITTER_RANGE;
      const jitterY = (Math.random() - 0.5) * layoutSettings.MANUAL_JITTER_RANGE;
      const nodeW = shouldWrap ? curMaxW : metrics.width;
      px = side === 1
        ? parentBox.minX + parentBox.width + manualGapX + jitterX
        : parentBox.minX - manualGapX - nodeW + jitterX;
      py = parentBox.minY + parentBox.height / 2 - metrics.height / 2 + jitterY;
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

    if (!ea.getElement(parent.id)) {
      ea.copyViewElementsToEAforEditing([parent]);
    }

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
    ea.style.roughness = getAppState().currentItemRoughness;
    ea.style.strokeStyle = isSolidArrow ? "solid" : getAppState().currentItemStrokeStyle;
    
    // Initial arrow creation with placeholder points
    const startPoint = [parentBox.minX + parentBox.width / 2, parentBox.minY + parentBox.height / 2];
    arrowId = ea.addArrow([startPoint, startPoint], {
      startObjectId: parent.id,
      endObjectId: newNodeId,
      startArrowHead: null,
      endArrowHead: null,
    });
    const eaArrow = ea.getElement(arrowId);
    
    // Initialize Roundness based on Type
    if(arrowType === "curved") {
       eaArrow.roundness = { type: 2 };
    } else {
       eaArrow.roundness = null;
    }
    
    ea.addAppendUpdateCustomData(arrowId, { isBranch: true });

    if (!groupBranches && parent.groupIds?.length > 0) {
      const pGroup = parent.groupIds[0];
      if (isMindmapGroup(pGroup, allElements)) {
        const newNode = ea.getElement(newNodeId);
        const newArrow = ea.getElement(arrowId);
        if(newNode) newNode.groupIds = [pGroup];
        if(newArrow) newArrow.groupIds = [pGroup];
      }
    }
  }

  if (isManualMode) {
    return ea.getElement(newNodeId);
  }

  await addElementsToView({
    repositionToCursor: !parent,
    save: !!imageFile || isPdfRectLink
  });

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
      const parentCenterX = parent.x + parent.width / 2;
      const childCenterX = node.x + node.width / 2;
      const isChildRight = childCenterX > parentCenterX;

      const sX = isChildRight ? parent.x + parent.width : parent.x;
      const sY = parent.y + parent.height / 2;
      
      const eX = isChildRight ? node.x : node.x + node.width;
      const eY = node.y + node.height / 2;

      configureArrow({
        arrowId: arrow.id, isChildRight, startId:parent.id, endId: node.id,
        coordinates: {sX, sY, eX, eY},
      });
    }

    if (groupBranches) {
      ea.getElements().forEach((el) => {
        if (el.groupIds) {
          el.groupIds = el.groupIds.filter(gid => !isMindmapGroup(gid, allEls));
        }
      });
      const l1Nodes = getChildrenNodes(rootId, allEls);
      l1Nodes.forEach((l1) => applyRecursiveGrouping(l1.id, allEls));
    } else {
      const { l1AncestorId } = getHierarchy(parent, allEls);
      const bIds = getBranchElementIds(l1AncestorId, allEls);

      const existingGroupedEl = allEls.find(el =>
        bIds.includes(el.id) &&
        el.id !== newNodeId &&
        el.id !== arrowId &&
        getStructuralGroup(el, allEls)
      );
      const commonGroupId = existingGroupedEl ? getStructuralGroup(existingGroupedEl, allEls) : null;

      if (commonGroupId) {
        const newIds = [newNodeId, arrowId].filter(Boolean);
        ea.copyViewElementsToEAforEditing(allEls.filter(el => newIds.includes(el.id)));
        newIds.forEach(id => {
          const el = ea.getElement(id);
          if (el) el.groupIds = [commonGroupId];
        });
      }
    }

    await addElementsToView();
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
  focusInputEl();
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
  ensureNodeSelected();
  const sel = ea.getViewSelectedElement();
  if (!sel) {
    new Notice(t("NOTICE_SELECT_NODE_TO_COPY"));
    return;
  }
  const all = ea.getViewElements();
  const info = getHierarchy(sel, all);

  const isRootSelected = info.rootId === sel.id;
  const parentNode = getParentNode(sel.id, all);

  const elementsToDelete = [];

  const useTab = app.vault.getConfig("useTab");
  const tabSize = app.vault.getConfig("tabSize");
  const indentVal = useTab ? "\t" : " ".repeat(tabSize);

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
      const remainingChildren = getChildrenNodes(parentNode.id, ea.getViewElements());

      if (remainingChildren.length === 0) {
        ea.copyViewElementsToEAforEditing([parentNode]);
        ea.addAppendUpdateCustomData(parentNode.id, {
          isFolded: false,
          foldIndicatorId: undefined
        });

        if (parentNode.customData?.foldIndicatorId) {
          const indicator = ea.getViewElements().find(el => el.id === parentNode.customData.foldIndicatorId);
          if (indicator) ea.deleteViewElements([indicator]);
        }

        await addElementsToView();
      }
      ea.selectElementsInView([parentNode]);
    }

    triggerGlobalLayout(info.rootId);
    new Notice(isRootSelected ? t("NOTICE_MAP_CUT") : t("NOTICE_BRANCH_CUT"));
  } else {
    new Notice(isRootSelected ? t("NOTICE_MAP_COPIED") : t("NOTICE_BRANCH_COPIED"));
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
    new Notice(t("NOTICE_CLIPBOARD_EMPTY"));
    return;
  }

  if (lines.length === 1) {
    const text = lines[0].replace(/^(\s*)(?:-|\*|\d+\.)\s+/, "").trim();

    if (text) {
      currentParent = await addNode(text, true, false);
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
    new Notice(t("NOTICE_PASTE_ABORTED"));
    return;
  }

  const delta = isHeader(lines[0]) ? 1 : 0;
  
  const notice = new Notice(t("NOTICE_PASTE_START"), 0);
  await sleep(10);
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
    new Notice(t("NOTICE_NO_LIST"));
    return;
  }

  ea.clear();

  if (!sel) {
    const minIndent = Math.min(...parsed.map((p) => p.indent));
    const topLevelItems = parsed.filter((p) => p.indent === minIndent);
    if (topLevelItems.length === 1) {
      currentParent = await addNode(topLevelItems[0].text, true, true, [], null);
      parsed.shift();
    } else {
      currentParent = await addNode(t("INPUT_TITLE_PASTE_ROOT"), true, true, [], null);
    }
  } else {
    currentParent = sel;
    ea.copyViewElementsToEAforEditing([sel]);
    currentParent = ea.getElement(sel.id);
  }

  const stack = [{ indent: -1, node: currentParent }];
  const initialViewElements = ea.getViewElements();
  for (const item of parsed) {
    while (stack.length > 1 && item.indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const parentNode = stack[stack.length - 1].node;
    const currentAllElements = initialViewElements.concat(ea.getElements());
    const newNode = await addNode(item.text, false, true, currentAllElements, parentNode);
    stack.push({ indent: item.indent, node: newNode });
  }

  await addElementsToView();

  const rootId = sel
    ? getHierarchy(sel, ea.getViewElements()).rootId
    : currentParent.id;
  await triggerGlobalLayout(rootId);
  //when rendered text element, image elements, etc. have their sizes recalculated, a second round layout fixes resulting issues
  await triggerGlobalLayout(rootId);

  const allInView = ea.getViewElements();
  const targetToSelect = sel
    ? allInView.find((e) => e.id === sel.id)
    : allInView.find((e) => e.id === currentParent?.id);

  if (targetToSelect) {
    ea.selectElementsInView([targetToSelect]);
  }
  notice.setMessage(t("NOTICE_PASTE_COMPLETE"));
  notice.setAutoHide(4000);
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
      await toggleFold("L0");
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
        await toggleFold("L0");
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

const setMapAutolayout = async (enabled) => {
  if (!ea.targetView) return;
  const sel = ea.getViewSelectedElement();
  if (sel) {
    const info = getHierarchy(sel, ea.getViewElements());
    ea.copyViewElementsToEAforEditing(ea.getViewElements().filter((e) => e.id === info.rootId));
    ea.addAppendUpdateCustomData(info.rootId, { autoLayoutDisabled: enabled });
    await addElementsToView();
  }
};

const refreshMapLayout = async () => {
  if (!ea.targetView) return;
  const sel = ea.getViewSelectedElement();
  if (sel) {
    const info = getHierarchy(sel, ea.getViewElements());
    await triggerGlobalLayout(info.rootId);
    await triggerGlobalLayout(info.rootId);
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

    const currentNode = allElements.find(el => el.id === currentId);
    if (currentNode?.customData?.boundaryId) {
        branchNodes.add(currentNode.customData.boundaryId);
    }

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
  const structuralGroupId = (commonGroupId && isMindmapGroup(commonGroupId, allElements)) ? commonGroupId : null;

  if (structuralGroupId) {
    workbenchEls.forEach(el => {
      if (el.groupIds) {
        el.groupIds = el.groupIds.filter(g => g !== structuralGroupId);
      }
    });
  } else {
    newGroupId = ea.addToGroup(ids);
  }

  await addElementsToView();

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
    await addElementsToView();
    if(!autoLayoutDisabled) await refreshMapLayout();
  }
};

const padding = layoutSettings.CONTAINER_PADDING;
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
    rect.strokeColor = ea.getCM(sel.strokeColor).stringRGB();
    rect.strokeWidth = 2;
    rect.roughness = getAppState().currentItemRoughness;
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

  await addElementsToView();

  if (!hasContainer) {
    api().updateContainerSize([ea.getViewElements().find((el) => el.id === newBindId)]);
  }
  ea.selectElementsInView([newBindId]);
  if(!autoLayoutDisabled) await refreshMapLayout();
};

const toggleBoundary = async () => {
  if (!ea.targetView) return;
  const sel = ea.getViewSelectedElement();
  if (sel) {
    ea.copyViewElementsToEAforEditing([sel]);
    const eaSel = ea.getElement(sel.id);
    let newBoundaryId = null;

    if (eaSel.customData?.boundaryId) {
      const b = ea.getViewElements().find(el => el.id === eaSel.customData.boundaryId);
      if(b) {
        ea.copyViewElementsToEAforEditing([b]);
        ea.getElement(b.id).isDeleted = true;
      }
      ea.addAppendUpdateCustomData(sel.id, { boundaryId: undefined });
    } else {
      const id = ea.generateElementId();
      newBoundaryId = id;
      const st = getAppState();
      const boundaryEl = {
        id: id,
        type: "line",
        x: sel.x, y: sel.y, width: 1, height: 1,
        angle: 0,
        roughness: st.currentItemRoughness,
        strokeColor: sel.strokeColor,
        backgroundColor: sel.strokeColor,
        fillStyle: "solid",
        strokeWidth: 2,
        strokeStyle: "solid",
        opacity: 30,
        points: [[0,0], [1,1], [0,0]],
        polygon: true,
        locked: false,
        groupIds: sel.groupIds || [],
        customData: {isBoundary: true},
        roundness: arrowType === "curved" ? {type: 2} : null,
      };

      if (sel.groupIds.length > 0 && isMindmapGroup(sel.groupIds[0], ea.getViewElements())) {
        boundaryEl.groupIds = [sel.groupIds[0]];
      } else {
        boundaryEl.groupIds = [];
      }

      ea.elementsDict[id] = boundaryEl;
      ea.addAppendUpdateCustomData(sel.id, { boundaryId: id });
    }

    await addElementsToView({newElementsOnTop: false});

    if (newBoundaryId) {
      const els = ea.getViewElements();
      let parentBoundaryIndex = -1;
      let curr = sel;

      while (curr) {
        const parent = getParentNode(curr.id, els);
        if (!parent) break;
        if (parent.customData?.boundaryId) {
          const pIndex = els.findIndex(el => el.id === parent.customData.boundaryId);
          if (pIndex !== -1) {
            parentBoundaryIndex = pIndex;
            break;
          }
        }
        curr = parent;
      }
      const targetIndex = parentBoundaryIndex !== -1 ? parentBoundaryIndex + 1 : 0;
      ea.moveViewElementToZIndex(newBoundaryId, targetIndex);
    }

    const info = getHierarchy(sel, ea.getViewElements());
    await triggerGlobalLayout(info.rootId);
  }
};

// ---------------------------------------------------------------------------
// 7. UI Modal & Sidepanel Logic
// ---------------------------------------------------------------------------

let detailsEl, inputEl, inputRow, bodyContainer, strategyDropdown, autoLayoutToggle, linkSuggester;
let pinBtn, refreshBtn, cutBtn, copyBtn, boxBtn, dockBtn, editBtn, toggleGroupBtn, zoomBtn, focusBtn, boundaryBtn;
let foldBtnL0, foldBtnL1, foldBtnAll;
let floatingGroupBtn, floatingBoxBtn, floatingZoomBtn;
let panelExpandBtn;
let isFloatingPanelExpanded = false;
let toggleFloatingExtras = null;
let inputContainer;
let helpContainer;
let floatingInputModal = null;
let sidepanelWindow;
let recordingScope = null;

// ---------------------------------------------------------------------------
// Focus Management & UI State
// ---------------------------------------------------------------------------
const registerKeydownHandler = (host, handler) => {
  removeKeydownHandlers();
  host.addEventListener("keydown", handler, true);
  window.MindmapBuilder.keydownHandlers.push(()=>host.removeEventListener("keydown", handler, true))
};

const registerObsidianHotkeyOverrides = () => {
  if (window.MindmapBuilder.popObsidianHotkeyScope) window.MindmapBuilder.popObsidianHotkeyScope();
  const keymapScope = app.keymap.getRootScope();
  const handlers = [];
  const context = getHotkeyContext();

  if (context === SCOPE.none) return;
  const reg = (mods, key) => {
    const handler = keymapScope.register(mods, key, (e) => true);
    handlers.push(handler);
    keymapScope.keys.unshift(keymapScope.keys.pop());
  };

  RUNTIME_HOTKEYS.forEach(h => {
    if (context < h.scope) return;
    if (h.key) reg(h.modifiers, h.key);
    if (h.code) {
      const char = h.code.replace("Key", "").replace("Digit", "").toLowerCase();
      reg(h.modifiers, char);
    }
  });

  if(handlers.length === 0) return;

  window.MindmapBuilder.popObsidianHotkeyScope = () => {
    handlers.forEach(h => keymapScope.unregister(h));
    delete window.MindmapBuilder.popObsidianHotkeyScope;
  };
};

const focusInputEl = () => {
  setTimeout(() => {
    if(isRecordingHotkey) return;
    if(!inputEl || inputEl.disabled) return;
    inputEl.focus();
    if (!window.MindmapBuilder.popObsidianHotkeyScope) registerObsidianHotkeyOverrides();
  }, 200);
}

const setButtonDisabled = (btn, disabled) => {
  if (!btn) return;
  btn.disabled = disabled;
  const btnEl = btn.extraSettingsEl ?? btn.buttonEl;
  if (!btnEl) return;
  btnEl.tabIndex = disabled ? -1 : 0;
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
  setButtonDisabled(foldBtnL0, true);
  setButtonDisabled(foldBtnL1, true);
  setButtonDisabled(foldBtnAll, true);
  setButtonDisabled(editBtn, true);
  setButtonDisabled(toggleGroupBtn, true);
  setButtonDisabled(zoomBtn, true);
  setButtonDisabled(focusBtn, true);
  setButtonDisabled(boundaryBtn, true);
  setButtonDisabled(floatingGroupBtn, true);
  setButtonDisabled(floatingBoxBtn, true);
  setButtonDisabled(floatingZoomBtn, true);
  editingNodeId = null;
  if(editBtn) editBtn.extraSettingsEl.style.color = "";
};

const updateUI = (sel) => {
  if (!ea.targetView) {
    if(inputEl) inputEl.disabled = true;
    disableUI();
    return;
  }
  if(inputEl) inputEl.disabled = false;
  const all = ea.getViewElements();
  sel = sel ?? ea.getViewSelectedElement();

  if (sel) {
    const info = getHierarchy(sel, all);
    const isRootSelected = info.rootId === sel.id;
    const root = all.find((e) => e.id === info.rootId);
    const isPinned = sel.customData?.isPinned === true;
    const isEditing = editingNodeId && editingNodeId === sel.id;
    const branchIds = getBranchElementIds(sel.id, all);
    const children = getChildrenNodes(sel.id, all);
    const hasChildren = children.length > 0;
    const hasGrandChildren = hasChildren && children.some(child => getChildrenNodes(child.id, all).length > 0);

    if (pinBtn) {
      pinBtn.setIcon(isPinned ? "pin" : "pin-off");
      pinBtn.setTooltip(
        `${isPinned ? t("PIN_TOOLTIP_PINNED") : t("PIN_TOOLTIP_UNPINNED")} ${getActionHotkeyString(ACTION_PIN)}`,
      );
      setButtonDisabled(pinBtn, false);
    }

    if (editBtn) {
      setButtonDisabled(editBtn, false);
      if (isEditing) {
        editBtn.extraSettingsEl.style.color = "var(--interactive-accent)";
      } else {
        editingNodeId = null;
        editBtn.extraSettingsEl.style.color = "";
      }
    }

    const updateGroupBtn = (btn) => {
      if (!btn) return;
      const isGrouped = branchIds.length > 1 && !!ea.getCommonGroupForElements(all.filter(el => branchIds.includes(el.id)));
      btn.setIcon(isGrouped ? "ungroup" : "group");
      const groupTooltip = isGrouped ? t("TOGGLE_GROUP_TOOLTIP_UNGROUP") : t("TOGGLE_GROUP_TOOLTIP_GROUP");
      btn.setTooltip(`${groupTooltip} ${getActionHotkeyString(ACTION_TOGGLE_GROUP)}`);
      setButtonDisabled(btn, groupBranches || branchIds.length <= 1);
    }
    updateGroupBtn(toggleGroupBtn);
    updateGroupBtn(floatingGroupBtn);

    if (refreshBtn) {
      setButtonDisabled(refreshBtn, false);
      refreshBtn.setTooltip(`${t("TOOLTIP_REFRESH")} ${getActionHotkeyString(ACTION_REARRANGE)}`);
    }

    setButtonDisabled(boxBtn, false);
    setButtonDisabled(floatingBoxBtn, false);
    setButtonDisabled(foldBtnL0, !hasChildren);
    setButtonDisabled(foldBtnL1, !hasGrandChildren);
    setButtonDisabled(foldBtnAll, !hasGrandChildren);
    setButtonDisabled(zoomBtn, false);
    setButtonDisabled(focusBtn, false);
    setButtonDisabled(floatingZoomBtn, false);
    setButtonDisabled(boundaryBtn, isRootSelected);
    setButtonDisabled(cutBtn, isRootSelected);
    setButtonDisabled(copyBtn, false);

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
        eaEl.autoResize = true;
        eaEl.width = Math.ceil(textWidth);
      } else {
        eaEl.autoResize = false;
        const res = getAdjustedMaxWidth(text, maxWidth);
        eaEl.width = res.width;
        eaEl.text = res.wrappedText;
      }
    }

    ea.refreshTextElementSize(eaEl.id);

    await addElementsToView();

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
  detailsEl.createEl("summary", { text: t("HELP_SUMMARY") });
  ea.obsidian.MarkdownRenderer.render(app, getInstructions(), detailsEl.createDiv(), "", ea.plugin);
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
    contentEl.createEl("h2", { text: t("MODAL_PALETTE_TITLE") });

    // --- Global Toggles ---
    new ea.obsidian.Setting(contentEl)
      .setName(t("LABEL_ENABLE_CUSTOM_PALETTE"))
      .setDesc(t("DESC_ENABLE_CUSTOM_PALETTE"))
      .addToggle(t => t
        .setValue(this.settings.enabled)
        .onChange(v => {
          this.settings.enabled = v;
          this.save();
          this.display();
        }));

    if (this.settings.enabled) {
      new ea.obsidian.Setting(contentEl)
        .setName(t("LABEL_RANDOMIZE_ORDER"))
        .setDesc(t("DESC_RANDOMIZE_ORDER"))
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
            .setTooltip(t("TOOLTIP_MOVE_UP"))
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
            .setTooltip(t("TOOLTIP_MOVE_DOWN"))
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
            .setTooltip(t("TOOLTIP_EDIT_COLOR"))
            .onClick(() => {
              this.editIndex = index;
              this.tempColor = color;
              this.display();
            }))
          .addExtraButton(btn => btn
            .setIcon("trash-2")
            .setTooltip(t("TOOLTIP_DELETE_COLOR"))
            .onClick(() => {
              this.settings.colors.splice(index, 1);
              if(this.editIndex === index) this.editIndex = -1;
              this.save();
              this.display();
            }));
      });

      contentEl.createEl("hr");

      // --- Add/Edit Area ---
      contentEl.createEl("h4", { text: this.editIndex === -1 ? t("HEADING_ADD_NEW_COLOR") : t("HEADING_EDIT_COLOR") });

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
        .setName(t("LABEL_SELECT_COLOR"))
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
          .setTooltip(t("TOOLTIP_OPEN_PALETTE_PICKER"))
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
        const cancelBtn = actionContainer.createEl("button", { text: t("BUTTON_CANCEL_EDIT") });
        cancelBtn.onclick = () => {
          this.editIndex = -1;
          this.tempColor = "#000000";
          this.display();
        };
      }

      const saveBtn = actionContainer.createEl("button", {
        text: this.editIndex === -1 ? t("BUTTON_ADD_COLOR") : t("BUTTON_UPDATE_COLOR"),
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
// 9. Layout Configuration Manager
// ---------------------------------------------------------------------------
class LayoutConfigModal extends ea.obsidian.Modal {
  constructor(app, currentSettings, onUpdate) {
    super(app);
    this.settings = JSON.parse(JSON.stringify(currentSettings));
    this.onUpdate = onUpdate;
  }

  onOpen() {
    this.display();
  }

  display() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: t("MODAL_LAYOUT_TITLE") });

    const container = contentEl.createDiv();
    container.style.maxHeight = "70vh";
    container.style.overflowY = "auto";
    container.style.paddingRight = "10px";

    Object.keys(LAYOUT_METADATA).forEach(key => {
      const meta = LAYOUT_METADATA[key];
      const setting = new ea.obsidian.Setting(container)
        .setName(meta.name)
        .setDesc(meta.desc);

      let valLabel;
      setting.addSlider(slider => slider
        .setLimits(meta.min, meta.max, meta.step)
        .setValue(this.settings[key])
        .onChange(value => {
          this.settings[key] = value;
          valLabel.setText(String(value));
        })
      );

      setting.settingEl.createDiv("", el => {
        valLabel = el;
        el.style.minWidth = "3em";
        el.style.textAlign = "right";
        el.innerText = String(this.settings[key]);
      });

      setting.addExtraButton(btn => btn
        .setIcon("rotate-ccw")
        .setTooltip("Reset to default")
        .onClick(() => {
          this.settings[key] = meta.def;
          this.display();
        })
      );
    });

    const footer = contentEl.createDiv();
    footer.style.marginTop = "20px";
    footer.style.display = "flex";
    footer.style.justifyContent = "space-between";

    new ea.obsidian.Setting(footer)
      .addButton(btn => btn
        .setButtonText("Reset All to Defaults")
        .setWarning()
        .onClick(() => {
          Object.keys(LAYOUT_METADATA).forEach(k => {
            this.settings[k] = LAYOUT_METADATA[k].def;
          });
          this.display();
        })
      )
      .addButton(btn => btn
        .setButtonText("Save & Close")
        .setCta()
        .onClick(() => {
          this.onUpdate(this.settings);
          this.close();
        })
      );
  }
}

// ---------------------------------------------------------------------------
// 10. Render Functions
// ---------------------------------------------------------------------------

const renderInput = (container, isFloating = false) => {
  container.empty();

  pinBtn = refreshBtn = dockBtn = inputEl = null;
  foldBtnL0 = foldBtnL1 = foldBtnAll = null;
  boundaryBtn = panelExpandBtn = null;
  floatingGroupBtn, floatingBoxBtn, floatingZoomBtn = null;

  inputRow = new ea.obsidian.Setting(container);
  let secondaryButtonContainer = null;

  if (!isFloating) {
    inputRow.settingEl.style.display = "block";
    inputRow.controlEl.style.display = "block";
    inputRow.controlEl.style.width = "100%";
    inputRow.controlEl.style.marginTop = "8px";
  } else {
    inputRow.settingEl.style.border = "none";
    inputRow.settingEl.style.padding = "0";
    inputRow.infoEl.style.display = "none";

    // Expandable container for floating mode
    secondaryButtonContainer = container.createDiv();
    secondaryButtonContainer.style.display = isFloatingPanelExpanded ? "flex" : "none";
    secondaryButtonContainer.style.justifyContent = "flex-end";
    secondaryButtonContainer.style.flexWrap = "wrap";
    secondaryButtonContainer.style.gap = "4px";
    secondaryButtonContainer.style.marginTop = "6px";
    secondaryButtonContainer.style.flexWrap = "wrap";
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
    inputEl.ariaLabel = [
      `${getActionLabel(ACTION_ADD)} (Enter)`,
      `${getActionLabel(ACTION_ADD_FOLLOW)} ${getActionHotkeyString(ACTION_ADD_FOLLOW)}`,
      `${getActionLabel(ACTION_ADD_FOLLOW_FOCUS)} ${getActionHotkeyString(ACTION_ADD_FOLLOW_FOCUS)}`,
      `${getActionLabel(ACTION_ADD_FOLLOW_ZOOM)} ${getActionHotkeyString(ACTION_ADD_FOLLOW_ZOOM)}`,
    ].join("\n");
    inputEl.placeholder = t("INPUT_PLACEHOLDER");
    inputEl.addEventListener("focus", () => {
      registerObsidianHotkeyOverrides();
      ensureNodeSelected();
      updateUI();
    });
    inputEl.addEventListener("blur", () => {
      if (window.MindmapBuilder.popObsidianHotkeyScope) window.MindmapBuilder.popObsidianHotkeyScope();
      saveSettings();
    });
  });

  let dockedButtonContainer;
  if (!isFloating) {
    dockedButtonContainer = inputRow.controlEl.createDiv();
    dockedButtonContainer.style.display = "flex";
    dockedButtonContainer.style.justifyContent = "flex-end";
    dockedButtonContainer.style.flexWrap = "wrap";
    dockedButtonContainer.style.gap = "4px";
    dockedButtonContainer.style.marginTop = "6px";
  }

  const addButton = (cb, moveToSecondary = false) => {
    inputRow.addExtraButton((btn) => {
      cb(btn);
      if (btn.buttonEl) btn.buttonEl.tabIndex = 0;
      if (btn.extraSettingsEl) btn.extraSettingsEl.tabIndex = 0;

      const el = btn.extraSettingsEl;
      if (!el) return;

      if (!isFloating && dockedButtonContainer) {
        dockedButtonContainer.appendChild(el);
      } else if (isFloating && moveToSecondary && secondaryButtonContainer) {
        secondaryButtonContainer.appendChild(el);
      }
    });
  };

  addButton((btn) => {
    editBtn = btn;
    btn.setIcon("pencil");
    btn.setTooltip(`${t("TOOLTIP_EDIT_NODE")} ${getActionHotkeyString(ACTION_EDIT)}`);
    btn.extraSettingsEl.setAttr("action",ACTION_EDIT);
    btn.onClick(() => {
      startEditing();
    });
  }, false);

  addButton((btn) => {
    pinBtn = btn;
    btn.setTooltip(`${t("TOOLTIP_PIN_INIT")} ${getActionHotkeyString(ACTION_PIN)}`)
    btn.extraSettingsEl.setAttr("action",ACTION_PIN);
    btn.onClick(async () => {
      await togglePin();
      updateUI();
    });
  }, false);

  toggleFloatingExtras = null;

  if (isFloating) {
    toggleFloatingExtras = () => {
      isFloatingPanelExpanded = !isFloatingPanelExpanded;
      panelExpandBtn.setIcon(isFloatingPanelExpanded ? "panel-bottom-open" : "panel-top-open");

      if (secondaryButtonContainer) {
        secondaryButtonContainer.style.display = isFloatingPanelExpanded ? "flex" : "none";
        if (floatingInputModal && floatingInputModal.modalEl) {
            floatingInputModal.modalEl.style.maxHeight = isFloatingPanelExpanded ? "unset" : FLOAT_MODAL_MAX_HEIGHT;
        }
      }
    };

    addButton((btn) => {
      panelExpandBtn = btn;
      btn.setIcon(isFloatingPanelExpanded ? "panel-bottom-open" : "panel-top-open");
      btn.setTooltip(t("TOOLTIP_TOGGLE_FLOATING_EXTRAS"));
      btn.extraSettingsEl.setAttr("action", ACTION_TOGGLE_FLOATING_EXTRAS);
      btn.onClick(toggleFloatingExtras);
    }, false);

    addButton((btn) => {
      floatingGroupBtn = btn;
      btn.setIcon("group");
      btn.extraSettingsEl.setAttr("action", ACTION_TOGGLE_GROUP);
      btn.onClick(async () => {
        await toggleBranchGroup();
      });
    }, true);

    addButton((btn) => {
      floatingBoxBtn = btn;
      btn.setIcon("rectangle-horizontal");
      btn.setTooltip(`${t("TOOLTIP_TOGGLE_BOX")} ${getActionHotkeyString(ACTION_BOX)}`);
      btn.extraSettingsEl.setAttr("action", ACTION_BOX);
      btn.onClick(async () => {
        await toggleBox();
      });
    }, true);

    addButton((btn) => {
      floatingZoomBtn = btn;
      btn.setIcon("scan-search");
      btn.setTooltip(`${t("TOOLTIP_ZOOM_CYCLE")} ${getActionHotkeyString(ACTION_ZOOM)}`);
      btn.extraSettingsEl.setAttr("action", ACTION_ZOOM);
      btn.onClick(() => {
        zoomToFit(true);
      });
    }, true);
  }

  addButton((btn) => {
    focusBtn = btn;
    btn.setIcon("scan-eye");
    btn.setTooltip(`${t("ACTION_LABEL_FOCUS")} ${getActionHotkeyString(ACTION_FOCUS)}`);
    btn.extraSettingsEl.setAttr("action", ACTION_FOCUS);
    btn.onClick(async () => {
      focusSelected();
    });
  }, true);

  addButton((btn) => {
    boundaryBtn = btn;
    btn.setIcon("cloud");
    btn.setTooltip(`${t("TOOLTIP_TOGGLE_BOUNDARY")} ${getActionHotkeyString(ACTION_TOGGLE_BOUNDARY)}`);
    btn.extraSettingsEl.setAttr("action", ACTION_TOGGLE_BOUNDARY);
    btn.onClick(async () => {
      await toggleBoundary();
      updateUI();
    });
  }, true);

  addButton((btn) => {
    foldBtnL0 = btn;
    btn.setIcon("wifi-low");
    btn.setTooltip(`${t("TOOLTIP_FOLD_BRANCH")} ${getActionHotkeyString(ACTION_FOLD)}`);
    btn.extraSettingsEl.setAttr("action", ACTION_FOLD);
    btn.onClick(async () => {
      await toggleFold("L0");
      updateUI();
    });
  }, true);

  addButton((btn) => {
    foldBtnL1 = btn;
    btn.setIcon("wifi-high");
    btn.setTooltip(`${t("TOOLTIP_FOLD_L1_BRANCH")} ${getActionHotkeyString(ACTION_FOLD_L1)}`);
    btn.extraSettingsEl.setAttr("action", ACTION_FOLD_L1);
    btn.onClick(async () => {
      await toggleFold("L1");
      updateUI();
    });
  }, true);

  addButton((btn) => {
    foldBtnAll = btn;
    btn.setIcon("wifi");
    btn.setTooltip(`${t("TOOLTIP_UNFOLD_BRANCH_ALL")} ${getActionHotkeyString(ACTION_FOLD_ALL)}`);
    btn.extraSettingsEl.setAttr("action", ACTION_FOLD_ALL);
    btn.onClick(async () => {
      await toggleFold("ALL");
      updateUI();
    });
  }, true);

  addButton((btn) => {
    refreshBtn = btn;
    btn.setIcon("refresh-ccw");
    btn.setTooltip(t("TOOLTIP_REFRESH"));
    btn.extraSettingsEl.setAttr("action",ACTION_REARRANGE);
    btn.onClick(async () => {
      await refreshMapLayout();
    });
  }, true);

  addButton((btn) => {
    copyBtn = btn;
    btn.setIcon("copy");
    btn.setTooltip(`${t("ACTION_COPY")} ${getActionHotkeyString(ACTION_COPY)}`);
    btn.extraSettingsEl.setAttr("action", ACTION_COPY);
    btn.onClick(async () => {
      copyMapAsText();
      updateUI();
    });
  }, true);

  addButton((btn) => {
    cutBtn = btn;
    btn.setIcon("scissors");
    btn.setTooltip(`${t("ACTION_CUT")} ${getActionHotkeyString(ACTION_CUT)}`);
    btn.extraSettingsEl.setAttr("action", ACTION_CUT);
    btn.onClick(async () => {
      copyMapAsText(true);
      updateUI();
    });
  }, true);

  addButton((btn) => {
    btn.setIcon("clipboard");
    btn.setTooltip(`${t("ACTION_PASTE")} ${getActionHotkeyString(ACTION_PASTE)}`);
    btn.extraSettingsEl.setAttr("action", ACTION_PASTE);
    btn.onClick(async () => {
      pasteListToMap();
      updateUI();
    });
  }, true);

  addButton((btn) => {
    dockBtn = btn;
    btn.setIcon(isFloating ? "dock" : "external-link");
    btn.extraSettingsEl.setAttr("action",ACTION_DOCK_UNDOCK);
    btn.setTooltip(
      `${isFloating ? t("TOOLTIP_DOCK") : t("TOOLTIP_UNDOCK")} ${getActionHotkeyString(ACTION_DOCK_UNDOCK)}`
    );
    btn.onClick(() => {
      toggleDock({silent: false, forceDock: false, saveSetting: true})
    });
  }, true);

  updateUI();
};

const renderBody = (contentEl) => {
  bodyContainer = contentEl.createDiv();
  bodyContainer.style.width = "100%";

  const zoomSetting = new ea.obsidian.Setting(bodyContainer);
  zoomSetting.setName(t("LABEL_ZOOM_LEVEL")).addDropdown((d) => {
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
      .setTooltip(`${t("TOOLTIP_ZOOM_CYCLE")} ${getActionHotkeyString(ACTION_ZOOM)}`)
      .onClick(()=>{
        zoomToFit(true);
      })
  });

  new ea.obsidian.Setting(bodyContainer).setName(t("LABEL_GROWTH_STRATEGY")).addDropdown((d) => {
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
          await addElementsToView();
          if (!autoLayoutDisabled) {
            await triggerGlobalLayout(info.rootId);
          }
        }
      });
  });

  new ea.obsidian.Setting(bodyContainer)
    .setName(t("LABEL_ARROW_TYPE"))
    .addToggle((t) => t
      .setValue(arrowType === "curved")
      .onChange(async (v) => {
        arrowType = v ? "curved" : "straight";
        setVal(K_ARROW_TYPE, arrowType);
        dirty = true;
        refreshMapLayout();
      }),
    )

  autoLayoutToggle = new ea.obsidian.Setting(bodyContainer)
    .setName(t("LABEL_AUTO_LAYOUT"))
    .addToggle((t) => t
      .setValue(!autoLayoutDisabled)
      .onChange(async (v) => {
        autoLayoutDisabled = !v;
        setMapAutolayout(!v);
      }),
    )
    .addButton(btn => btn
      .setIcon("pencil-ruler")
      .setTooltip(t("TOOLTIP_CONFIGURE_LAYOUT"))
      .onClick(() => {
        const modal = new LayoutConfigModal(app, layoutSettings, (newSettings) => {
          layoutSettings = newSettings;
          setVal(K_LAYOUT, layoutSettings, true);
          dirty = true;
          if(!autoLayoutDisabled) refreshMapLayout(); // Auto-refresh if layout is active
        });
        modal.open();
      })
    ).components[0];

  new ea.obsidian.Setting(bodyContainer)
    .setName(t("LABEL_GROUP_BRANCHES"))
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
        await triggerGlobalLayout(info.rootId, true);
        updateUI();
      }
    }))
    .addButton((btn) => {
      toggleGroupBtn = btn;
      btn.setIcon("group");
      btn.setTooltip(`${t("TOOLTIP_TOGGLE_GROUP_BTN")} ${getActionHotkeyString(ACTION_TOGGLE_GROUP)}`);
      btn.onClick(async () => {
        await toggleBranchGroup();
      });
    });

  new ea.obsidian.Setting(bodyContainer)
    .setName(t("LABEL_BOX_CHILD_NODES"))
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
      btn.setTooltip(`${t("TOOLTIP_TOGGLE_BOX")} ${getActionHotkeyString(ACTION_BOX)}`);
      btn.onClick(async () => {
        await toggleBox();
      });
    });

  new ea.obsidian.Setting(bodyContainer).setName(t("LABEL_ROUNDED_CORNERS")).addToggle((t) => t
    .setValue(roundedCorners)
    .onChange((v) => {
      roundedCorners = v;
      setVal(K_ROUND,  v);
      dirty = true;
    }),
  );

  new ea.obsidian.Setting(bodyContainer)
    .setName(t("LABEL_USE_SCENE_STROKE"))
    .setDesc(
      t("DESC_USE_SCENE_STROKE"),
    )
    .addToggle((t) =>
      t.setValue(!isSolidArrow).onChange((v) => {
        isSolidArrow = !v;
        setVal(K_ARROWSTROKE,  !v);
        dirty = true;
      }),
    );

  new ea.obsidian.Setting(bodyContainer)
    .setName(t("LABEL_MULTICOLOR_BRANCHES"))
    .addToggle((t) =>
      t.setValue(multicolor).onChange((v) => {
        multicolor = v;
        setVal(K_MULTICOLOR, v);
        dirty = true;
      }),
    )
    .addButton(btn =>
      btn.setIcon("palette")
        .setTooltip(t("TOOLTIP_CONFIGURE_PALETTE"))
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
  const sliderSetting = new ea.obsidian.Setting(bodyContainer).setName(t("LABEL_MAX_WRAP_WIDTH")).addSlider((s) => s
    .setLimits(WRAP_WIDTH_MIN, WRAP_WIDTH_MAX, WRAP_WIDTH_STEP)
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
    .setName(t("LABEL_CENTER_TEXT"))
    .setDesc(t("DESC_CENTER_TEXT"))
    .addToggle((t) => t
      .setValue(centerText)
      .onChange((v) => {
        centerText = v;
        setVal(K_CENTERTEXT, v);
        dirty = true;
      }),
    );

  new ea.obsidian.Setting(bodyContainer).setName(t("LABEL_FONT_SIZES")).addDropdown((d) => {
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
  hkDetails.createEl("summary", { text: t("HOTKEY_SECTION_TITLE"), attr: { style: "cursor: pointer; font-weight: bold;" } });

  const hkContainer = hkDetails.createDiv();
  const hint = hkContainer.createEl("p", {
    text: t("HOTKEY_HINT"),
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

    btn.innerHTML = t("RECORD_HOTKEY_PROMPT");
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
        new Notice(t("NOTICE_ACTION_REQUIRES_ARROWS"));
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
        new Notice(t("NOTICE_CONFLICT_WITH_ACTION", { action: getActionLabel(conflict.action) }), NOTICE_DURATION_CONFLICT);
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
            new Notice(t("NOTICE_OBSIDIAN_HOTKEY_CONFLICT", { command: obsConflict }), NOTICE_DURATION_GLOBAL_CONFLICT);
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
      .setName(getActionLabel(h.action));
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
          alert.ariaLabel = t("ARIA_OVERRIDE_COMMAND", { command: conflict });
          alert.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            new Notice(t("NOTICE_GLOBAL_HOTKEY_CONFLICT", { command: conflict }), NOTICE_DURATION_GLOBAL_CONFLICT);
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
            scopeBtn.ariaLabel = t("ARIA_SCOPE_INPUT");
            scopeBtn.style.color = "var(--text-muted)";
            break;
          case SCOPE.excalidraw:
            scopeBtn.innerHTML = ea.obsidian.getIcon("excalidraw-icon").outerHTML;
            scopeBtn.ariaLabel = t("ARIA_SCOPE_EXCALIDRAW");
            scopeBtn.style.color = "var(--interactive-accent)";
            break;
          case SCOPE.global:
            scopeBtn.innerHTML = ea.obsidian.getIcon("globe").outerHTML;
            scopeBtn.ariaLabel = t("ARIA_SCOPE_GLOBAL");
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
            new Notice(t("NOTICE_GLOBAL_HOTKEY_CONFLICT", { command: conflict }), NOTICE_DURATION_GLOBAL_CONFLICT);
          }
        }
        updateRowUI();
      };
      updateScopeUI();
    }

    restoreBtn.innerHTML = ea.obsidian.getIcon("rotate-ccw").outerHTML;
    restoreBtn.ariaLabel = t("ARIA_RESTORE_DEFAULT");
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
    addBtn.ariaLabel = t("ARIA_CUSTOMIZE_HOTKEY");
    addBtn.onclick = () => recordHotkey(addBtn, index, updateRowUI);
  });

  // Spacer to avoid overlap with Obsidian's status bar
  bodyContainer.createDiv({ attr: { style: "height: 40px;" } });
};

const MINDMAP_FOCUS_STYLE_ID = "excalidraw-mindmap-focus-style";

const registerStyles = () => {
  if (document.getElementById(MINDMAP_FOCUS_STYLE_ID)) return;
  const styleEl = document.createElement("style");
  styleEl.id = MINDMAP_FOCUS_STYLE_ID;
  styleEl.textContent = [
    ".excalidraw-mindmap-ui button:focus-visible,",
    ".excalidraw-mindmap-ui .clickable-icon:focus-visible,",
    ".excalidraw-mindmap-ui [tabindex]:focus-visible {",
    " overflow: hidden;",
    " scrollbar-width: none;",
    "  outline: 2px solid var(--interactive-accent) !important;",
    "  outline-offset: 2px;",
    "  background-color: var(--interactive-accent);",
    "  color: var(--background-primary);",
    "}",
    ".excalidraw-mindmap-ui .clickable-icon:focus-visible svg {",
    "  color: inherit;",
    "}",
  ].join("\n");
  document.head.appendChild(styleEl);
};

const removeStyles = () => {
  const styleEl = document.getElementById(MINDMAP_FOCUS_STYLE_ID);
  if (styleEl) styleEl.remove();
};

const updateKeyHandlerLocation = () => {
  // Attach to the appropriate window based on state
  if (isUndocked) {
    // Floating: Input is reparented to targetView's window
    if (ea.targetView && ea.targetView.ownerWindow) {
      registerKeydownHandler(ea.targetView.ownerWindow, handleKeydown);
    }
  } else {
    // Docked: Input is in the sidepanel's window
    if (sidepanelWindow) {
      registerKeydownHandler(sidepanelWindow, handleKeydown);
    }
  }
};

// ---------------------------------------------------------------------------
// Docking & Floating Input Management
// ---------------------------------------------------------------------------
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
    modalEl.classList.add("excalidraw-mindmap-ui");

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
      modalEl.style.opacity = `${FLOAT_MODAL_OPACITY}`;
      modalEl.style.padding = "6px";
      modalEl.style.minHeight = "0px";
      modalEl.style.width = "fit-content";
      modalEl.style.height = "auto";
      modalEl.style.maxHeight = FLOAT_MODAL_MAX_HEIGHT;
      const container = floatingInputModal.contentEl.createDiv();
      renderInput(container, true);
      focusInputEl();
      setTimeout(() => {
        //the modalEl is repositioned after a delay
        //otherwise the event handlers in FloatingModal would override the move
        //leaving modalEl in the center of the view
        //modalEl.style.top and left must stay in the timeout call
        modalEl.style.top = `${ y + FLOAT_MODAL_OFFSET }px`;
        modalEl.style.left = `${ x + FLOAT_MODAL_OFFSET }px`;
      }, 100);
    };

    floatingInputModal.onClose = () => {
      if (window.MindmapBuilder.popObsidianHotkeyScope) window.MindmapBuilder.popObsidianHotkeyScope();
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

const handleKeydown = async (e) => {
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

  let {action, scope} = getActionFromEvent(e);
  let context = getHotkeyContext();

  // Local Tab handling for floating modal to keep focus cycling inside
  if (!action && isUndocked && floatingInputModal && e.key === "Tab") {
    const modalEl = floatingInputModal.modalEl;
    if (modalEl) {
      const selector = [
        "input:not([disabled])",
        "div:not([style*='not-allowed'])",
      ].join(",");

      const focusables = Array.from(modalEl.querySelectorAll(selector)).filter((el) => {
        if (el.tabIndex === -1 || el.hidden) return false;
        return el.offsetParent !== null || el.getClientRects().length > 0;
      });

      if (focusables.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        const active = modalEl.ownerDocument.activeElement;
        let idx = focusables.indexOf(active);
        if (idx === -1) idx = 0;
        idx = e.shiftKey
          ? (idx === 0 ? focusables.length - 1 : idx - 1)
          : (idx === focusables.length - 1 ? 0 : idx + 1);
        focusables[idx].focus();
      }
    }
    return;
  }

  if (
    e.key === "Enter" && context === SCOPE.excalidraw &&
    ((isUndocked && floatingInputModal) || !isUndocked)
   ) {
    const modalEl = isUndocked ?floatingInputModal.modalEl : ea.sidepanelTab.containerEl;
    const activeEl = modalEl?.ownerDocument.activeElement;
    action = activeEl?.getAttribute("action");
    if (!action) return;
    context = SCOPE.input;
  }

  if (!action || context < scope) return;

  e.preventDefault();
  e.stopPropagation();

  switch (action) {
    case ACTION_TOGGLE_FLOATING_EXTRAS:
      toggleFloatingExtras?.();
      break;
    case ACTION_REARRANGE:
      await refreshMapLayout();
      break;
    case ACTION_TOGGLE_GROUP:
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
      break;

    case ACTION_BOX:
      await toggleBox();
      break;

    case ACTION_TOGGLE_BOUNDARY:
      await toggleBoundary();
      updateUI();
      break;

    case ACTION_FOLD:
      await toggleFold("L0");
      updateUI();
      break;

    case ACTION_FOLD_L1:
      await toggleFold("L1");
      updateUI();
      break;

    case ACTION_FOLD_ALL:
      await toggleFold("ALL");
      updateUI();
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

let uiUpdateTimer = null;

const handleCanvasPointerDown = (e) => {
  if (!ea.targetView) return;
  if (floatingInputModal && floatingInputModal.modalEl.contains(e.target)) return;

  if (uiUpdateTimer) {
    clearTimeout(uiUpdateTimer);
  }

  uiUpdateTimer = setTimeout(() => {
    if (!ea.targetView) return;
    const selection = getMindmapNodeFromSelection();
    updateUI(selection);
    uiUpdateTimer = null;
  }, 50);
};

// --- Initialization Logic ---
// 1. Checking for exsiting tab right at the beginning of the script (not needed here)
// 2. Create new Sidepanel Tab
ea.createSidepanelTab(t("DOCK_TITLE"), true, true).then((tab) => {
  if (!tab) return;
  registerStyles();
  tab.onWindowMigrated = (newWin) => {
    sidepanelWindow = newWin;
    // If we are docked, re-attach to the new window immediately
    if (!isUndocked && sidepanelWindow) {
      registerKeydownHandler(sidepanelWindow, handleKeydown);
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
    contentEl.classList.add("excalidraw-mindmap-ui");
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
    } else {
      setupEventListeners(ea.targetView);
      if (!window.MindmapBuilder.popObsidianHotkeyScope) registerObsidianHotkeyOverrides();
    }
  };

  const setupEventListeners = (view) => {
    if (!view || !view.ownerWindow) return;
    if(window.MindmapBuilder.removePointerDownHandler) window.MindmapBuilder.removePointerDownHandler();
    const win = view.ownerWindow;

    win.addEventListener("pointerdown", handleCanvasPointerDown);
    window.MindmapBuilder.removePointerDownHandler = () => {
      if (win) win.removeEventListener("pointerdown", handleCanvasPointerDown);
      delete window.MindmapBuilder.removePointerDownHandler;
    }
    updateKeyHandlerLocation();
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
    removeEventListeners();
    delete window.MindmapBuilder;
    removeStyles();
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