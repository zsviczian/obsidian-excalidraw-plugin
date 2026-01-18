/**

Issues:
- if a node is grouped folding hides the node as well
- with some layout changes the boundary got completely misplaced (look for hard coded constants)

 

# Mind Map Builder: Technical Specification & User Guide

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
- `arrowType`, `fontsizeScale`, `multicolor`, `boxChildren`, `roundedCorners`, `maxWrapWidth`, `isSolidArrow`, `centerText`: Stored on the Root node to persist display preferences per map.
- `isPinned`: Stored on individual nodes (boolean) to bypass the layout engine.
- `isBranch`: Stored on arrows (boolean) to distinguish Mind Map connectors from standard annotations.
- `mindmapOrder`: Stored on nodes (number) to maintain manual sort order of siblings.
- `mindmapNew`: Stored on nodes (boolean) to tag freshly added items so new siblings append after existing order; cleared after layout.
- `isFolded`: Stored on nodes (boolean) to collapse a branch and hide its descendants.
- `foldIndicatorId`: Stored on nodes to track the ephemeral "…" indicator element that signals a folded branch.
- `foldState`: Stored on nodes and branch arrows to cache their opacity/lock state while hidden so it can be restored when unfolded.
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

### Smart Decoration Scaling (Edge Anchoring)
When nodes resize (e.g. text edit), the script intelligently re-positions grouped elements:
- **Inside Elements**: Scale relative to the center (e.g. text inside a box).
- **Outside Elements**: Anchor to the nearest edge (e.g. icons above a node) to preserve visual gaps, preventing them from "flying away" during expansion.

### Copy/Paste & Cross-linking
- **Hierarchy**: Markdown lists are parsed into the mind map structure.
- **Cross-links**: The script preserves non-structural connections by generating internal block references (`^blockId`) and valid wikilinks (`[[#^blockId]]`) when copying branches to markdown.

### Link suggester keydown events (Enter, Escape)
- **Key-safe integration**: The suggester implements the `KeyBlocker` interface so the script's own key handlers pause while the suggester is active, preventing shortcut collisions during link insertion.

**/
/* --- Initialization Logic --- */

if (!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("2.19.0")) {
  new Notice("Please update the Excalidraw Plugin to version 2.19.0 or higher.");
  return;
}

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

/**
 * Cleans up previous keydown handlers to prevent duplicates.
 */
const removeKeydownHandlers = () => {
  if (!window.MindmapBuilder) return;
  window.MindmapBuilder.keydownHandlers.forEach((f)=>{
    try {
      f();
    } catch(e) {
      console.error("Mindmap Builder: Error removing keydown handler:", e);
    }
  });
  window.MindmapBuilder.keydownHandlers = [];
};

/**
 * Removes all event listeners and specific hooks attached to the window or workspace.
 */
const removeEventListeners = () => {
  removeKeydownHandlers();
  try {
    window.MindmapBuilder?.popObsidianHotkeyScope?.();
  } catch (e) {
    console.error("Mindmap Builder: Error popping hotkey scope:", e);
  }
  try {
    window.MindmapBuilder?.removePointerDownHandler?.();
  } catch (e) {
    console.error("Mindmap Builder: Error removing pointerdown handler:", e);
  }
  try {
    window.MindmapBuilder?.removeActiveLeafListener?.();
  } catch (e) {
    console.error("Mindmap Builder: Error removing active-leaf-change listener:", e);
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
    NOTICE_NO_HEADINGS: "No headings found in the linked file.",
    NOTICE_CANNOT_EDIT_MULTILINE: "Cannot edit multi-line nodes directly.\nDouble-click the element in Excalidraw to edit, then run auto re-arrange map to update the layout.",
    NOTICE_CANNOT_MOVE_PINNED: "Cannot move pinned nodes. Unpin the node first.",
    NOTICE_CANNOT_MOVE_ROOT: "Cannot move the root node.",
    NOTICE_CANNOT_PRMOTE_L1: "Cannot promote Level 1 nodes.",
    NOTICE_CANNOT_DEMOTE: "Cannot demote node. No previous sibling to attach to.",
    NOTICE_CANNOT_MOVE_AUTO_LAYOUT_DISABLED: "Cannot move nodes when Auto-Layout is disabled. Enable Auto-Layout first.",

    // Action labels (display only)
    ACTION_LABEL_ADD: "Add Child",
    ACTION_LABEL_ADD_SIBLING_AFTER: "Add Next Sibling",
    ACTION_LABEL_ADD_SIBLING_BEFORE: "Add Prev Sibling",
    ACTION_LABEL_ADD_FOLLOW: "Add + follow",
    ACTION_LABEL_ADD_FOLLOW_FOCUS: "Add + follow + focus",
    ACTION_LABEL_ADD_FOLLOW_ZOOM: "Add + follow + zoom",
    ACTION_LABEL_SORT_ORDER: "Change Order/Promote Node",
    ACTION_LABEL_EDIT: "Edit node",
    ACTION_LABEL_PIN: "Pin/Unpin",
    ACTION_LABEL_BOX: "Box/Unbox",
    ACTION_LABEL_TOGGLE_GROUP: "Group/Ungroup Single Branch",
    ACTION_LABEL_COPY: "Copy",
    ACTION_LABEL_CUT: "Cut",
    ACTION_LABEL_PASTE: "Paste",
    ACTION_LABEL_IMPORT_OUTLINE: "Import Outline",
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
    TOOLTIP_CONFIGURE_LAYOUT: "Configure layout settings",
    TOOLTIP_MOVE_UP: "Move Up",
    TOOLTIP_MOVE_DOWN: "Move Down",
    TOOLTIP_EDIT_COLOR: "Edit",
    TOOLTIP_DELETE_COLOR: "Delete",
    TOOLTIP_OPEN_PALETTE_PICKER: "Open Palette Picker",
    TOOLTIP_FOLD_BRANCH: "Fold/Unfold selected branch",
    TOOLTIP_FOLD_L1_BRANCH: "Fold/Unfold children (Level 1)",
    TOOLTIP_UNFOLD_BRANCH_ALL: "Unfold branch recursively",
    TOOLTIP_IMPORT_OUTLINE: "Import headings from linked file as child nodes",

    // Buttons and labels
    DOCK_TITLE: "Mind Map Builder",
    HELP_SUMMARY: "Instructions & Shortcuts",
    INPUT_PLACEHOLDER: "Concept... type [[ to insert link",
    BUTTON_COPY: "Copy",
    BUTTON_CUT: "Cut",
    BUTTON_PASTE: "Paste",
    TITLE_ADD_SIBLING: `Add sibling with ${ea.DEVICE.isMacOS || ea.DEVICE.isIOS ? "OPT" : "ALT"}+Enter`,
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
    HOTKEY_HINT: "These hotkeys may override some Obsidian defaults. They're Local (⌨️) by default, active only when the MindMap input field is focused. Use the 🌐/🎨/⌨️ toggle to change hotkey scope: 🌐 Overrides Obsidian hotkeys whenever an Excalidraw tab is visible, 🎨 Overrides Obsidian hotkeys whenever Excalidraw is focused, ⌨️ Local (input focused).",
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
    // Section Headers
    SECTION_GENERAL: "General Spacing",
    SECTION_RADIAL: "Radial Layout (Clockwise)",
    SECTION_DIRECTIONAL: "Directional Layout (Left/Right)",
    SECTION_VISUALS: "Visual Elements",
    SECTION_MANUAL: "Manual Mode Behavior",
    // Radial Strings
    RADIAL_ASPECT_RATIO: "Ellipse Aspect Ratio",
    DESC_RADIAL_ASPECT_RATIO: "Controls the shape. < 1.0 is tall/narrow (0.7 = portrait). 1.0 is circular. > 1.0 is wide (landscape).",
    RADIAL_POLE_GAP_BONUS: "Pole Gap Bonus",
    DESC_RADIAL_POLE_GAP_BONUS: "Increases spacing between nodes at the Top and Bottom. Higher values push nodes further along the arc.",
    RADIAL_START_ANGLE: "Start Angle",
    DESC_RADIAL_START_ANGLE: "Where the first node appears (Degrees). 270 is North, 0 is East, 90 is South.",
    RADIAL_MAX_SWEEP: "Max Sweep Angle",
    DESC_RADIAL_MAX_SWEEP: "Total arc available to fill. 360 uses full circle. Lower values leave a gap between the first and last node.",
    // Others
    GAP_X:  "Gap X",
    DESC_LAYOUT_GAP_X: "Horizontal distance between parent and child nodes.",
    GAP_Y:  "Gap Y",
    DESC_LAYOUT_GAP_Y: "Vertical distance between sibling nodes. Also used as the base gap for Radial layouts.",
    GAP_MULTIPLIER:  "Gap Multiplier",
    DESC_LAYOUT_GAP_MULTIPLIER: "Vertical spacing for 'leaf' nodes (no children), relative to font size. Low: list-like stacking. High: standard tree spacing.",
    DIRECTIONAL_ARC_SPAN_RADIANS:  "Directional Arc-span Radians",
    DESC_LAYOUT_ARC_SPAN: "Curvature of the child list. Low (0.5): Flatter, list-like. High (2.0): Curved, organic, but risk of overlap.",
    ROOT_RADIUS_FACTOR:  "Root Radius Factor",
    DESC_LAYOUT_ROOT_RADIUS: "Multiplier for the Root node's bounding box to determine initial radius.",
    MIN_RADIUS:  "Minimum Radius",
    DESC_LAYOUT_MIN_RADIUS: "The absolute minimum distance from the root center to the first level of nodes.",
    RADIUS_PADDING_PER_NODE:  "Radius Padding per Node",
    DESC_LAYOUT_RADIUS_PADDING: "Extra radius added per child node to accommodate dense maps.",
    GAP_MULTIPLIER_RADIAL:  "Radial-layout Gap Multiplier",
    DESC_LAYOUT_GAP_RADIAL: "Angular spacing multiplier for Radial mode.",
    GAP_MULTIPLIER_DIRECTIONAL:  "Vertical-layout Gap Multiplier",
    DESC_LAYOUT_GAP_DIRECTIONAL: "Spacing multiplier for Right-facing and Left-facing top level branches",
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
  ARROW: Object.freeze(["curved", "straight"]),
});

const FONT_SCALE_TYPES = VALUE_SETS.FONT_SCALE;
const GROWTH_TYPES = VALUE_SETS.GROWTH;
const ZOOM_TYPES = VALUE_SETS.ZOOM;
const SCOPE = VALUE_SETS.SCOPE;
const ARROW_TYPES = VALUE_SETS.ARROW;
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
  // --- General ---
  GAP_X: {
    section: "SECTION_GENERAL",
    def: 120, min: 50, max: 400, step: 10,
    desc: t("DESC_LAYOUT_GAP_X"),
    name: t("GAP_X"),
  },
  GAP_Y: {
    section: "SECTION_GENERAL",
    def: 25, min: 10, max: 150, step: 5,
    desc: t("DESC_LAYOUT_GAP_Y"),
    name: t("GAP_Y"),
  },
  GAP_MULTIPLIER: {
    section: "SECTION_GENERAL",
    def: 0.6, min: 0.1, max: 3.0, step: 0.1,
    desc: t("DESC_LAYOUT_GAP_MULTIPLIER"),
    name: t("GAP_MULTIPLIER"),
  },

  // --- Radial (New & Updated) ---
  ROOT_RADIUS_FACTOR: {
    section: "SECTION_RADIAL",
    def: 0.8, min: 0.5, max: 2.0, step: 0.1,
    desc: t("DESC_LAYOUT_ROOT_RADIUS"),
    name: t("ROOT_RADIUS_FACTOR"),
  },
  MIN_RADIUS: {
    section: "SECTION_RADIAL",
    def: 350, min: 150, max: 800, step: 10,
    desc: t("DESC_LAYOUT_MIN_RADIUS"),
    name: t("MIN_RADIUS"),
  },
  RADIAL_ASPECT_RATIO: {
    section: "SECTION_RADIAL",
    def: 0.7, min: 0.5, max: 2.0, step: 0.1,
    desc: t("DESC_RADIAL_ASPECT_RATIO"),
    name: t("RADIAL_ASPECT_RATIO"),
  },
  RADIAL_POLE_GAP_BONUS: {
    section: "SECTION_RADIAL",
    def: 2.0, min: 0.0, max: 5.0, step: 0.1,
    desc: t("DESC_RADIAL_POLE_GAP_BONUS"),
    name: t("RADIAL_POLE_GAP_BONUS"),
  },
  RADIAL_START_ANGLE: {
    section: "SECTION_RADIAL",
    def: 280, min: 0, max: 360, step: 10,
    desc: t("DESC_RADIAL_START_ANGLE"),
    name: t("RADIAL_START_ANGLE"),
  },
  RADIAL_MAX_SWEEP: {
    section: "SECTION_RADIAL",
    def: 340, min: 180, max: 360, step: 10,
    desc: t("DESC_RADIAL_MAX_SWEEP"),
    name: t("RADIAL_MAX_SWEEP"),
  },

  // --- Directional ---
  DIRECTIONAL_ARC_SPAN_RADIANS: {
    section: "SECTION_DIRECTIONAL",
    def: 1.0, min: 0.1, max: 3.14, step: 0.1,
    desc: t("DESC_LAYOUT_ARC_SPAN"),
    name: t("DIRECTIONAL_ARC_SPAN_RADIANS"),
  },
  GAP_MULTIPLIER_DIRECTIONAL: {
    section: "SECTION_DIRECTIONAL",
    def: 1.5, min: 1.0, max: 3.0, step: 0.1,
    desc: t("DESC_LAYOUT_GAP_DIRECTIONAL"),
    name: t("GAP_MULTIPLIER_DIRECTIONAL"),
  },
  RADIUS_PADDING_PER_NODE: {
    section: "SECTION_DIRECTIONAL",
    def: 7, min: 0, max: 20, step: 1,
    desc: t("DESC_LAYOUT_RADIUS_PADDING"),
    name: t("RADIUS_PADDING_PER_NODE"),
  },

  // --- Visuals ---
  INDICATOR_OFFSET: {
    section: "SECTION_VISUALS",
    def: 10, min: 5, max: 50, step: 5,
    desc: t("DESC_LAYOUT_INDICATOR_OFFSET"),
    name: t("INDICATOR_OFFSET"),
  },
  INDICATOR_OPACITY: {
    section: "SECTION_VISUALS",
    def: 40, min: 10, max: 100, step: 10,
    desc: t("DESC_LAYOUT_INDICATOR_OPACITY"),
    name: t("INDICATOR_OPACITY"),
  },
  CONTAINER_PADDING: {
    section: "SECTION_VISUALS",
    def: 10, min: 0, max: 50, step: 2,
    desc: t("DESC_LAYOUT_CONTAINER_PADDING"),
    name: t("CONTAINER_PADDING"),
  },

  // --- Manual Mode ---
  MANUAL_GAP_MULTIPLIER: {
    section: "SECTION_MANUAL",
    def: 1.3, min: 1.0, max: 2.0, step: 0.1,
    desc: t("DESC_LAYOUT_MANUAL_GAP"),
    name: t("MANUAL_GAP_MULTIPLIER"),
  },
  MANUAL_JITTER_RANGE: {
    section: "SECTION_MANUAL",
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

let arrowType = getVal(K_ARROW_TYPE, {value: "curved", valueset: ARROW_TYPES});
let maxWidth = parseInt(getVal(K_WIDTH, 450));
let fontsizeScale = getVal(K_FONTSIZE, {value: "Normal Scale", valueset: FONT_SCALE_TYPES});
let boxChildren = getVal(K_BOX, false);
let roundedCorners = getVal(K_ROUND, false);
let multicolor = getVal(K_MULTICOLOR, true);
let groupBranches = getVal(K_GROUP, false);
let currentModalGrowthMode = getVal(K_GROWTH, {value: "Right-Left", valueset: GROWTH_TYPES});
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

if (!ea.getScriptSettingValue(K_GROWTH, {value: "Right-Left", valueset: GROWTH_TYPES}).hasOwnProperty("valueset")) {
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

  let imageFile = file = null;
  let isImagePath = false;

  const PDF_RECT_LINK_REGEX = /^[^#]*#page=\d*(&\w*=[^&]+){0,}&rect=\d*,\d*,\d*,\d*/;
  if (path.match(PDF_RECT_LINK_REGEX)) {
    isImagePath = true;
  } else {
    const pathParts = path.split("#");
    imageFile = file = app.metadataCache.getFirstLinkpathDest(pathParts[0], ea.targetView.file.path);
    if (imageFile) {
      const isEx = imageFile.extension === "md" && ea.isExcalidrawFile(imageFile);
      if (!IMAGE_TYPES.includes(imageFile.extension.toLowerCase()) && !isEx) {
        imageFile = null;
      }
      if (isEx && pathParts.length === 2) {
        isImagePath = true;
        imageFile = null;
      }
    }
  }

  return { path, width, imageFile, isImagePath, file};
};

const parseEmbeddableInput = (input, imageInfo) => {
  const trimmed = input.trim();
  const match = trimmed.match(/^!\[\]\((https?:\/\/[^)]+)\)$/);
  if (match) return match[1];
  const pathSplit = imageInfo?.path?.split("#");
  if (imageInfo && imageInfo.file && imageInfo.file.extension === "md" &&
    // Not an Excalidraw File or maybe an Excalidraw file with a back-of-the-card note reference 
    (!ea.isExcalidrawFile(imageInfo.file) || pathSplit?.[1] && !pathSplit[1].startsWith("^"))
  ) {
    imageInfo.isImagePath = false;
    return `[[${imageInfo.path}]]`;
  }
  return null;
};

// ------------------------------------------------
// HOTKEY SUPPORT FUNCTIONS
// ------------------------------------------------
const ACTION_ADD = "Add";
const ACTION_ADD_SIBLING_AFTER = "Add Next Sibling";
const ACTION_ADD_SIBLING_BEFORE = "Add Prev Sibling";
const ACTION_ADD_FOLLOW = "Add + follow";
const ACTION_ADD_FOLLOW_FOCUS = "Add + follow + focus";
const ACTION_ADD_FOLLOW_ZOOM = "Add + follow + zoom";
const ACTION_SORT_ORDER = "Change Order/Promote Node";
const ACTION_EDIT = "Edit node";
const ACTION_PIN = "Pin/Unpin";
const ACTION_BOX = "Box/Unbox";
const ACTION_TOGGLE_GROUP = "Group/Ungroup Single Branch";

const ACTION_COPY = "Copy";
const ACTION_CUT = "Cut";
const ACTION_PASTE = "Paste";
const ACTION_IMPORT_OUTLINE = "Import Outline from Linked File";

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
  [ACTION_ADD_SIBLING_AFTER]: "ACTION_LABEL_ADD_SIBLING_AFTER",
  [ACTION_ADD_SIBLING_BEFORE]: "ACTION_LABEL_ADD_SIBLING_BEFORE",
  [ACTION_ADD_FOLLOW]: "ACTION_LABEL_ADD_FOLLOW",
  [ACTION_ADD_FOLLOW_FOCUS]: "ACTION_LABEL_ADD_FOLLOW_FOCUS",
  [ACTION_ADD_FOLLOW_ZOOM]: "ACTION_LABEL_ADD_FOLLOW_ZOOM",
  [ACTION_SORT_ORDER]: "ACTION_LABEL_SORT_ORDER",
  [ACTION_EDIT]: "ACTION_LABEL_EDIT",
  [ACTION_PIN]: "ACTION_LABEL_PIN",
  [ACTION_BOX]: "ACTION_LABEL_BOX",
  [ACTION_TOGGLE_GROUP]: "ACTION_LABEL_TOGGLE_GROUP",
  [ACTION_COPY]: "ACTION_LABEL_COPY",
  [ACTION_CUT]: "ACTION_LABEL_CUT",
  [ACTION_PASTE]: "ACTION_LABEL_PASTE",
  [ACTION_IMPORT_OUTLINE]: "ACTION_LABEL_IMPORT_OUTLINE",
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
  { action: ACTION_ADD, key: "Enter", modifiers: [], scope: SCOPE.input, isInputOnly: true },
  { action: ACTION_ADD_SIBLING_AFTER, key: "Enter", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: true },
  { action: ACTION_ADD_SIBLING_BEFORE, key: "Enter", modifiers: ["Alt", "Shift"], scope: SCOPE.input, isInputOnly: true },
  { action: ACTION_ADD_FOLLOW, key: "Enter", modifiers: ["Mod", "Alt"], scope: SCOPE.input, isInputOnly: true },
  { action: ACTION_ADD_FOLLOW_FOCUS, key: "Enter", modifiers: ["Mod"], scope: SCOPE.input, isInputOnly: true },
  { action: ACTION_ADD_FOLLOW_ZOOM, key: "Enter", modifiers: ["Mod", "Shift"], scope: SCOPE.input, isInputOnly: true },
  
  //Window
  { action: ACTION_DOCK_UNDOCK, key: "Enter", modifiers: ["Shift"], scope: SCOPE.input, isInputOnly: true },
  { action: ACTION_HIDE, key: "Escape", modifiers: [], scope: SCOPE.excalidraw, isInputOnly: true },

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
  { action: ACTION_IMPORT_OUTLINE, code: "KeyI", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false },

  // View Actions
  { action: ACTION_REARRANGE, code: "KeyR", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false },
  { action: ACTION_ZOOM, code: "KeyZ", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false },
  { action: ACTION_FOCUS, code: "KeyF", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false },

  //Navigation
  { action: ACTION_NAVIGATE, key: "ArrowKeys", modifiers: ["Alt"], isNavigation: true, scope: SCOPE.input, isInputOnly: false },
  { action: ACTION_NAVIGATE_ZOOM, key: "ArrowKeys", modifiers: ["Alt", "Shift"], isNavigation: true, scope: SCOPE.input, isInputOnly: false },
  { action: ACTION_NAVIGATE_FOCUS, key: "ArrowKeys", modifiers: ["Alt", "Mod"], isNavigation: true, scope: SCOPE.input, isInputOnly: false },
  { action: ACTION_SORT_ORDER, code: "ArrowKeys", modifiers: ["Mod"], isNavigation: true, scope: SCOPE.input, isInputOnly: false },
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
  if (!leaf) return SCOPE.none;
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
    shouldSleep = false,
  } = {}
) => {
  if (!ea.targetView) return;
  await ea.addElementsToView(repositionToCursor, save, newElementsOnTop, shouldRestoreElements);
  ea.clear();
  if (shouldSleep) await sleep(10); // Allow Excalidraw to process the new elements
}

// ---------------------------------------------------------------------------
// 2. Traversal & Geometry Helpers
// ---------------------------------------------------------------------------

const getBoundaryHost = (selectedElements) => {
  if (
    selectedElements.length === 1 && selectedElements[0].type === "line" &&
    selectedElements[0].customData?.hasOwnProperty("isBoundary")
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
  const selectedElements = ea.getViewSelectedElements().filter(el => el.customData && (
    el.customData.hasOwnProperty("mindmapOrder") || el.customData.hasOwnProperty("isBranch") ||
    el.customData.hasOwnProperty("growthMode") || el.customData.hasOwnProperty("isBoundary")
  ));
  if (selectedElements.length === 0) return;

  const owner = getBoundaryHost(selectedElements);
  if (owner) {
    return owner;
  }

  if (
      selectedElements.length === 1 && (
      selectedElements[0].customData.hasOwnProperty("mindmapOrder") ||
      selectedElements[0].customData.hasOwnProperty("growthMode")
  )) {
    if (selectedElements[0].type === "text" && selectedElements[0].boundElements.length === 0 && !!selectedElements[0].containerId) {
      return ea.getViewElements().find((el) => el.id === selectedElements[0].containerId);
    }
    return selectedElements[0];
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

  // Possibly Text + Container Selection
  if (selectedElements.length === 2) {
    const textEl = selectedElements.find((el) => el.type === "text");
    if (textEl && textEl.boundElements.length > 0 && textEl.customData.hasOwnProperty("mindmapOrder")) {
      return textEl;
    } else if (textEl) {
      const containerId = textEl.containerId;
      if (containerId) {
        const container = selectedElements.find((el) => el.id === containerId);
        if (container && container.boundElements.length > 0 && container.customData.hasOwnProperty("mindmapOrder")) {
          return container;
        }
      }
    }
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

const buildElementMap = (allElements) => {
  const map = new Map();
  allElements.forEach((el) => map.set(el.id, el));
  return map;
};

const buildChildrenMap = (allElements, elementById) => {
  const childrenByParent = new Map();
  const byId = elementById || buildElementMap(allElements);

  allElements.forEach((el) => {
    if (el.type === "arrow" && el.customData?.isBranch && el.startBinding?.elementId) {
      const parentId = el.startBinding.elementId;
      const child = byId.get(el.endBinding?.elementId);
      if (!child) return;
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId).push(child);
    }
  });

  return childrenByParent;
};

const getChildrenNodes = (id, allElements) => {
  const arrows = allElements.filter(
    (el) => el.type === "arrow" && el.customData?.isBranch && el.startBinding?.elementId === id,
  );
  return arrows.map((a) => allElements.find((el) => el.id === a.endBinding?.elementId)).filter(Boolean);
};

const buildGroupToNodes = (branchIds, allElements) => {
  const branchIdSet = new Set(branchIds);
  const groupToNodes = new Map();

  allElements.forEach(el => {
    if (branchIdSet.has(el.id) && el.type !== "arrow" && el.groupIds) {
      el.groupIds.forEach(gid => {
        if (!groupToNodes.has(gid)) groupToNodes.set(gid, new Set());
        groupToNodes.get(gid).add(el);
      });
    }
  });

  return groupToNodes;
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

/**
 * Manages the "..." fold indicator text element.
 * Creates it if missing and show=true, hides it if show=false.
 * Updates its position relative to the parent node.
 * 
 * @param {ExcalidrawElement} node - The parent node.
 * @param {boolean} show - Whether to show the fold indicator.
 * @param {ExcalidrawElement[]} allElements - All elements in the scene.
 */
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
      const fontSize = ea.getBoundTextElement(node).eaElement?.fontSize || 20;
      const id = ea.addText(0, 0, "...");
      ind = ea.getElement(id);
      ind.fontSize = fontSize;
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
    ind.y = node.y + node.height - ind.fontSize;
  } else {
    // Hide/Delete indicator
    if (existingId) {
      const ind = allElements.find(el => el.id === existingId);
      if (ind) ind.isDeleted = true;
      ea.addAppendUpdateCustomData(node.id, { foldIndicatorId: undefined });
    }
  }
};

/**
 * Toggles visibility of an element by manipulating opacity and locked state.
 * Saves the original state to customData for restoration.
 * 
 * @param {ExcalidrawElement} el - The element to update.
 * @param {boolean} hide - Whether to hide the element.
 */
const setElementVisibility = (el, hide) => {
  if (hide) {
    // Only save state if not already saved to avoid overwriting original state with hidden state
    if (!el.customData?.foldState) {
      // Safety: If for some reason opacity is already 0, assume 100 to avoid locking it invisible forever
      const safeOpacity = el.opacity === 0 ? 100 : el.opacity;
      ea.addAppendUpdateCustomData(el.id, {
        foldState: { opacity: safeOpacity, locked: el.locked }
      });
    }
    el.opacity = 0;
    el.locked = true;
  } else {
    // Restore original state
    if (el.customData?.foldState) {
      el.opacity = el.customData.foldState.opacity;
      el.locked = el.customData.foldState.locked;
      const d = { ...el.customData
      };
      delete d.foldState;
      el.customData = d;
    } else {
      // Default fallback if no state was saved but we need to show
      if (el.opacity === 0) el.opacity = 100;
      el.locked = false;
    }
  }
  const boundTextElement = ea.getBoundTextElement(el);
  if (boundTextElement.eaElement && boundTextElement.eaElement !== el) {
    setElementVisibility(boundTextElement?.eaElement, hide);
  }
};

/**
 * Recursively updates the visibility of a branch based on fold state.
 * Handles nodes, connectors, grouped decorations, cross-links, and boundaries.
 * 
 * @param {string} nodeId - The ID of the current node.
 * @param {boolean} parentHidden - Whether the parent is hidden (inherited visibility).
 * @param {ExcalidrawElement[]} allElements - All elements in the scene.
 * @param {boolean} isRootOfFold - Whether this node is the root of the fold operation (always visible itself).
 */
const updateBranchVisibility = (nodeId, parentHidden, allElements, isRootOfFold) => {
  const node = allElements.find(el => el.id === nodeId);
  if (!node) return;

  const isFolded = node.customData?.isFolded === true;

  // The root of the fold operation stays visible unless its parent was already hidden
  const shouldHideThis = parentHidden && !isRootOfFold;

  setElementVisibility(node, shouldHideThis);

  // Set to track the ID of the main node AND any decorations grouped with it
  // This allows us to detect crosslinks attached to decorations, not just the main node
  const localNodeIds = new Set([node.id]);

  // Handle Decorations (Grouped elements like boxes, icons, stickers)
  if (node.groupIds && node.groupIds.length > 0) {

    const groupElements = ea.getElementsInTheSameGroupWithElement(node, allElements);
    
    const childrenIds = getChildrenNodes(nodeId, allElements).map(c => c.id);
    
    groupElements.forEach(el => {
      if (el.id === node.id) return;
      if (el.customData?.isBranch) return;
      if (el.customData?.isBoundary) return;
      if (el.id === node.customData?.foldIndicatorId) return;
      if (childrenIds.includes(el.id)) return;

      setElementVisibility(el, shouldHideThis);
      localNodeIds.add(el.id);
    });
  }

  // Handle Crosslinks (Non-structural arrows connected to this node OR its decorations)
  const crossLinks = allElements.filter(el => 
    el.type === "arrow" && 
    !el.customData?.isBranch && 
    (
      (el.startBinding && localNodeIds.has(el.startBinding.elementId)) || 
      (el.endBinding && localNodeIds.has(el.endBinding.elementId))
    )
  );

  crossLinks.forEach(arrow => {
    if (shouldHideThis) {
      setElementVisibility(arrow, true);
    } else {
      // Determine which end is the "other" node
      const isStartLocal = arrow.startBinding && localNodeIds.has(arrow.startBinding.elementId);
      
      const otherId = isStartLocal
        ? arrow.endBinding?.elementId 
        : arrow.startBinding?.elementId;
      
      const otherNode = allElements.find(e => e.id === otherId);
      
      if (otherNode && !otherNode.isDeleted && otherNode.opacity > 0) {
         setElementVisibility(arrow, false);
      }
    }
  });

  // Handle Boundary Visibility
  if (node.customData?.boundaryId) {
    const boundEl = allElements.find(el => el.id === node.customData.boundaryId);
    if (boundEl) {
      if (shouldHideThis || isFolded) {
        boundEl.opacity = 0;
        boundEl.locked = true;
      } else {
        boundEl.opacity = 30;
        boundEl.locked = false;
      }
    }
  }

  // Manage Indicator
  const showIndicator = !shouldHideThis && isFolded;
  manageFoldIndicator(node, showIndicator, allElements);

  // Process Children
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
      setElementVisibility(arrow, childrenHidden);
    }

    // Recurse
    updateBranchVisibility(child.id, childrenHidden, allElements, false);
  });
};

/**
 * Toggles the folded state of the selected node's branch.
 * Supports different modes: L0 (direct children), L1 (grandchildren), ALL (recursive).
 * 
 * @param {string} mode - "L0" | "L1" | "ALL"
 */
const toggleFold = async (mode = "L0") => {
  if (!ea.targetView) return;
  const sel = getMindmapNodeFromSelection();
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

  ea.viewUpdateScene({appState: {selectedGroupIds: {}}});
  focusSelected();
};

// ---------------------------------------------------------------------------
// 3. Layout & Grouping Engine
// ---------------------------------------------------------------------------
const moveCrossLinks = (allElements, originalPositions) => {
  const crossLinkArrows = allElements.filter(el =>
    el.type === "arrow" &&
    !el.customData?.isBranch &&
    el.startBinding?.elementId &&
    el.endBinding?.elementId
  );

  const touched = new Set();

  crossLinkArrows.forEach(arrow => {
    const startId = arrow.startBinding.elementId;
    const endId = arrow.endBinding.elementId;
    const startNodeOld = originalPositions.get(startId);
    const endNodeOld = originalPositions.get(endId);
    const startNodeNew = ea.getElement(startId);
    const endNodeNew = ea.getElement(endId);

    if (startNodeOld && endNodeOld && startNodeNew && endNodeNew) {
      touched.add(arrow.id);
      const dsX = startNodeNew.x - startNodeOld.x;
      const dsY = startNodeNew.y - startNodeOld.y;
      const deX = endNodeNew.x - endNodeOld.x;
      const deY = endNodeNew.y - endNodeOld.y;
      if (dsX === 0 && dsY === 0 && deX === 0 && deY === 0) return;

      const eaArrow = ea.getElement(arrow.id);
      if (!eaArrow) return;
      
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
  return touched;
};

const moveDecorations = (allElements, originalPositions, groupToNodes) => {
  // Identify decoration elements (grouped but non-structural)
  const decorationsToUpdate = [];

  allElements.forEach(el => {
    // Skip structural elements (handled by main layout)
    const isStructural = isStructuralElement(el, allElements);
    const isCrossLink = el.type === "arrow" && !el.customData?.isBranch && el.startBinding?.elementId && el.endBinding?.elementId;
    
    // Decoration condition: Grouped, non-structural, not a cross-link
    const isDecoration = !isStructural && !isCrossLink && el.groupIds && el.groupIds.length > 0;

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
        
        let minXOld = Infinity, minYOld = Infinity, maxXOld = -Infinity, maxYOld = -Infinity;
        let minXNew = Infinity, minYNew = Infinity, maxXNew = -Infinity, maxYNew = -Infinity;
        
        let validHost = false;

        nodesArray.forEach(n => {
           const oldPos = originalPositions.get(n.id);
           const newEl = ea.getElement(n.id);
           
           if (oldPos && newEl) {
             validHost = true;
             // Old Box
             minXOld = Math.min(minXOld, oldPos.x);
             minYOld = Math.min(minYOld, oldPos.y);
             maxXOld = Math.max(maxXOld, oldPos.x + n.width);
             maxYOld = Math.max(maxYOld, oldPos.y + n.height);

             // New Box
             minXNew = Math.min(minXNew, newEl.x);
             minYNew = Math.min(minYNew, newEl.y);
             maxXNew = Math.max(maxXNew, newEl.x + newEl.width);
             maxYNew = Math.max(maxYNew, newEl.y + newEl.height);
           }
        });

        if (validHost) {
          const oldCx = minXOld + (maxXOld - minXOld) / 2;
          const oldCy = minYOld + (maxYOld - minYOld) / 2;
          const newCx = minXNew + (maxXNew - minXNew) / 2;
          const newCy = minYNew + (maxYNew - minYNew) / 2;

          decorationsToUpdate.push({
            elementId: el.id,
            dx: newCx - oldCx,
            dy: newCy - oldCy
          });
        }
      }
    }
  });

  decorationsToUpdate.forEach(item => {
    if (Math.abs(item.dx) > 0.01 || Math.abs(item.dy) > 0.01) {
      const decoration = ea.getElement(item.elementId);
      if (decoration) {
        decoration.x += item.dx;
        decoration.y += item.dy;
      }
    }
  });
  return new Set(decorationsToUpdate.map(d => d.elementId));
};

/**
 * Intelligent scaling for decorations when a node changes size.
 * Uses "Edge Anchoring":
 * - Elements inside the node (like text in a box) scale relative to the center.
 * - Elements outside the node (like stickers/icons above) anchor to the nearest edge 
 *   to preserve the visual gap, preventing them from flying away when the node grows significantly.
 */
const scaleDecorations = (oldNode, newNode, allElements) => {
  if (!oldNode.groupIds || oldNode.groupIds.length === 0) return;

  const groupElements = ea.getElementsInTheSameGroupWithElement(oldNode, allElements);
  // Filter out the node itself and structural elements
  const decorations = groupElements.filter(el => 
    el.id !== oldNode.id && 
    !isStructuralElement(el, allElements)
  );

  if (decorations.length === 0) return;

  const oldCx = oldNode.x + oldNode.width / 2;
  const oldCy = oldNode.y + oldNode.height / 2;
  const newCx = newNode.x + newNode.width / 2;
  const newCy = newNode.y + newNode.height / 2;

  // Ratios for "Inside" elements
  const ratioX = oldNode.width > 1 ? newNode.width / oldNode.width : 1;
  const ratioY = oldNode.height > 1 ? newNode.height / oldNode.height : 1;

  ea.copyViewElementsToEAforEditing(decorations);

  decorations.forEach(dec => {
    const el = ea.getElement(dec.id);
    if (!el) return;

    const decCx = dec.x + dec.width / 2;
    const decCy = dec.y + dec.height / 2;

    // Determine relative position (normalized -1 to 1)
    const relX = (decCx - oldCx) / (oldNode.width / 2);
    const relY = (decCy - oldCy) / (oldNode.height / 2);

    // Inside check: Scale relative to center if within bounds
    const isInside = Math.abs(relX) <= 1.05 && Math.abs(relY) <= 1.05;

    if (isInside) {
      const dx = decCx - oldCx;
      const dy = decCy - oldCy;
      const newDx = dx * ratioX;
      const newDy = dy * ratioY;
      el.x = (newCx + newDx) - el.width / 2;
      el.y = (newCy + newDy) - el.height / 2;
    } else {
      // Outside: Anchor to nearest edge to preserve gap
      // Determine primary axis of separation
      if (Math.abs(relX) > Math.abs(relY)) {
        // Horizontal (Left/Right)
        const sign = Math.sign(relX);
        const oldEdgeX = oldCx + (sign * oldNode.width / 2);
        const gapX = decCx - oldEdgeX; // Preserve this gap
        const newEdgeX = newCx + (sign * newNode.width / 2);
        const newDecCx = newEdgeX + gapX;
        
        el.x = newDecCx - el.width / 2;
        // For the minor axis (Y), scale relative to center to keep alignment
        el.y = (newCy + (decCy - oldCy) * ratioY) - el.height / 2;
      } else {
        // Vertical (Top/Bottom)
        const sign = Math.sign(relY);
        const oldEdgeY = oldCy + (sign * oldNode.height / 2);
        const gapY = decCy - oldEdgeY; // Preserve this gap
        const newEdgeY = newCy + (sign * newNode.height / 2);
        const newDecCy = newEdgeY + gapY;

        el.y = newDecCy - el.height / 2;
        // For the minor axis (X), scale relative to center
        el.x = (newCx + (decCx - oldCx) * ratioX) - el.width / 2;
      }
    }
  });
};

let storedZoom = {elementID: undefined, level: undefined}
const nextZoomLevel = (current) => {
  const idx = ZOOM_TYPES.indexOf(current);
  return idx === -1 ? ZOOM_TYPES[0] : ZOOM_TYPES[(idx + 1) % ZOOM_TYPES.length];
};

const zoomToFit = (mode) => {
  if (!ea.targetView) return;
  const sel = getMindmapNodeFromSelection();
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
  const sel = getMindmapNodeFromSelection();
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

const getSubtreeHeight = (nodeId, allElements, childrenByParent, heightCache, elementById) => {
  if (heightCache?.has(nodeId)) return heightCache.get(nodeId);

  const node = elementById?.get(nodeId) ?? allElements.find((el) => el.id === nodeId);
  if (!node) return 0;

  if (node.customData?.isFolded) {
    const foldedHeight = node.height;
    if (heightCache) heightCache.set(nodeId, foldedHeight);
    return foldedHeight;
  }

  const children = childrenByParent?.get(nodeId) ?? getChildrenNodes(nodeId, allElements);
  const unpinnedChildren = children.filter(child => !child.customData?.isPinned);

  let totalHeight = 0;

  if (unpinnedChildren.length === 0) {
    totalHeight = node.height;
  } else {
    let childrenHeight = 0;
    unpinnedChildren.forEach((child, index) => {
      childrenHeight += getSubtreeHeight(child.id, allElements, childrenByParent, heightCache, elementById);
      if (index < unpinnedChildren.length - 1) {
        const childNode = elementById?.get(child.id) ?? allElements.find((el) => el.id === child.id);

        // Check if child behaves as a leaf (ignoring pinned descendants)
        const grandChildren = childrenByParent?.get(child.id) ?? getChildrenNodes(child.id, allElements);
        const hasUnpinnedGrandChildren = grandChildren.some(gc => !gc.customData?.isPinned);

        const fontSize = childNode.fontSize ?? 20;
        const gap = !hasUnpinnedGrandChildren ? Math.round(fontSize * layoutSettings.GAP_MULTIPLIER) : layoutSettings.GAP_Y;
        childrenHeight += gap;
      }
    });
    totalHeight = Math.max(node.height, childrenHeight);
  }

  // Feature: Boundary Spacing
  // If the node has a visual boundary, add padding to the total subtree height
  // The boundary adds 15px padding on all sides (see updateNodeBoundary), so we add 2*15=30px
  if (node.customData?.boundaryId) {
    totalHeight += 30;
  }

  if (heightCache) heightCache.set(nodeId, totalHeight);
  return totalHeight;
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

const collectCrosslinkIds = (allElements) => new Set(
  allElements
    .filter(el => el.type === "arrow" && !el.customData?.isBranch && el.startBinding?.elementId && el.endBinding?.elementId)
    .map(el => el.id)
);

const collectDecorationIds = (allElements) => new Set(
  allElements
    .filter(el => el.groupIds && el.groupIds.length > 0 && !isStructuralElement(el, allElements))
    .map(el => el.id)
);

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

const addEmbeddableNode = ({px = 0, py = 0, url, depth}) => {
  isWikiLink = url.startsWith("[[");
  const width = isWikiLink
    ? (depth === 0 ? EMBEDED_OBJECT_WIDTH_ROOT : EMBEDED_OBJECT_WIDTH_CHILD)
    : EMBEDED_OBJECT_WIDTH_CHILD;
  const height = isWikiLink
    ? width / 2
    : 0; // Height 0 triggers auto-calculation based on aspect ratio
  const embeddableId = ea.addEmbeddable(px, py, width, height, url);
  if (isWikiLink) {
    ea.getElement(embeddableId).scale = depth === 0 ? [0.5, 0.5] : [0.3, 0.3];
  }
  return embeddableId;
}

const updateRootNodeCustomData = async (data) => {
  const sel = getMindmapNodeFromSelection();
  if (sel) {
    const info = getHierarchy(sel, ea.getViewElements());
    ea.copyViewElementsToEAforEditing(ea.getViewElements().filter((e) => e.id === info.rootId));
    ea.addAppendUpdateCustomData(info.rootId, { ...data });
    await addElementsToView();
    updateUI();
    return info;
  }
  return null;
}

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

const layoutSubtree = (nodeId, targetX, targetCenterY, side, allElements, hasGlobalFolds, childrenByParent, heightCache, elementById, mustHonorMindmapOrder = false) => {
  const node = elementById?.get(nodeId) ?? allElements.find((el) => el.id === nodeId);
  const eaNode = ea.getElement(nodeId);

  const isPinned = node.customData?.isPinned === true;

  if (!isPinned) {
    eaNode.x = side === 1 ? targetX : targetX - node.width;
    eaNode.y = targetCenterY - node.height / 2;
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

  // Handle Fold Indicator
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

  const children = childrenByParent?.get(nodeId) ?? getChildrenNodes(nodeId, allElements);
  const unpinnedChildren = children.filter(child => !child.customData?.isPinned);
  const pinnedChildren = children.filter(child => child.customData?.isPinned);

  if (unpinnedChildren.length > 0) {
    // SORTING LOGIC:
    // If mustHonorMindmapOrder is true: Explicitly sort by mindmapOrder to enforce the manual change.
    // If mustHonorMindmapOrder is false: Fallback to visual Y-position to keep map strictly ordered by position (auto-layout).
    unpinnedChildren.sort((a, b) => {
      if (mustHonorMindmapOrder) {
        return getMindmapOrder(a) - getMindmapOrder(b);
      }
      const dy = a.y - b.y;
      if (dy !== 0) return dy;
      return String(a.id).localeCompare(String(b.id));
    });

    // Only update mindmapOrder to match visual reality if we are NOT in a manual sort operation
    if (!mustHonorMindmapOrder) {
      unpinnedChildren.forEach((child, i) => {
        if (getMindmapOrder(child) !== i) {
          ea.addAppendUpdateCustomData(child.id, { mindmapOrder: i });
        }
      });
    }

    const subtreeHeight = getSubtreeHeight(nodeId, allElements, childrenByParent, heightCache, elementById);
    let currentY = currentYCenter - subtreeHeight / 2;
    const dynamicGapX = layoutSettings.GAP_X;

    unpinnedChildren.forEach((child) => {
      const childH = getSubtreeHeight(child.id, allElements, childrenByParent, heightCache, elementById);

      layoutSubtree(
        child.id,
        effectiveSide === 1 ? currentX + node.width + dynamicGapX : currentX - dynamicGapX,
        currentY + childH / 2,
        effectiveSide,
        allElements,
        hasGlobalFolds,
        childrenByParent,
        heightCache,
        elementById,
        mustHonorMindmapOrder, // Propagate the flag recursively
      );

      const childNode = elementById?.get(child.id) ?? allElements.find((el) => el.id === child.id);

      const grandChildren = childrenByParent?.get(child.id) ?? getChildrenNodes(child.id, allElements);
      const hasUnpinnedGrandChildren = grandChildren.some(gc => !gc.customData?.isPinned);

      const fontSize = childNode.fontSize ?? 20;
      const gap = !hasUnpinnedGrandChildren ? Math.round(fontSize * layoutSettings.GAP_MULTIPLIER) : layoutSettings.GAP_Y;

      currentY += childH + gap;
    });
  }

  pinnedChildren.forEach(child => layoutSubtree(
    child.id,
    child.x,
    child.y + child.height/2,
    effectiveSide,
    allElements,
    hasGlobalFolds,
    childrenByParent,
    heightCache,
    elementById,
    mustHonorMindmapOrder,
  ));

  // Update Arrows
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
  const { rootId, rootCenter, mode } = context;

  const arrow = ea.getElements().find(
    (a) =>
      a.type === "arrow" &&
      a.customData?.isBranch &&
      a.startBinding?.elementId === rootId &&
      a.endBinding?.elementId === node.id,
  );
  if (arrow) {
    const childNode = ea.getElement(node.id);
    const rootNode = ea.getElement(rootId);
    
    if (!childNode || !rootNode) return;

    const childCenterX = childNode.x + childNode.width / 2;
    const isChildRight = childCenterX > rootCenter.x;
    const isRadial = mode === "Radial";

    // In Radial mode, start arrow from the center of the root node
    const sX = isRadial ? rootCenter.x : (isChildRight ? rootNode.x + rootNode.width : rootNode.x);
    const sY = rootCenter.y;
    
    const eX = isChildRight ? childNode.x : childNode.x + childNode.width;
    const eY = childNode.y + childNode.height / 2;

    configureArrow({
      arrowId: arrow.id, isChildRight, startId: rootId, endId: node.id,
      coordinates: {sX, sY, eX, eY},
      isRadial
    });
  }
};

const radialL1Distribution = (nodes, context, l1Metrics, totalSubtreeHeight, mustHonorMindmapOrder = false) => {
  const { allElements, rootBox, rootCenter, hasGlobalFolds, childrenByParent, heightCache, elementById } = context;
  const count = nodes.length;

  // --- CONFIGURATION FROM SETTINGS ---
  const START_ANGLE = layoutSettings.RADIAL_START_ANGLE; 
  const MAX_SWEEP_DEG = Math.min(layoutSettings.RADIAL_MAX_SWEEP/8*count, layoutSettings.RADIAL_MAX_SWEEP); 
  const ASPECT_RATIO = layoutSettings.RADIAL_ASPECT_RATIO;
  const POLE_GAP_BONUS = layoutSettings.RADIAL_POLE_GAP_BONUS;
  
  const BASE_GAP = layoutSettings.GAP_Y * 2; 
  
  // 1. Determine Minimum Radius Baseline based on root node size
  // This avoids the previous hardcoded 1000px test radius which forced nodes too far out
  const minRadiusY = Math.max(
    Math.round(Math.max(rootBox.height, rootBox.width) * layoutSettings.ROOT_RADIUS_FACTOR * 1.5),
    layoutSettings.MIN_RADIUS
  );
  const minRadiusX = minRadiusY * ASPECT_RATIO;

  // 2. Simulation Pass: Calculate angular space needed at Minimum Radius
  let simAngle = START_ANGLE;
  let totalRequiredSpan = 0;

  // Temporary storage for node angular data calculated at minRadius
  const nodeSimData = nodes.map((node, i) => {
    const rad = simAngle * (Math.PI / 180);
    // Local Radius at this angle for ellipse
    const localR = (minRadiusX * minRadiusY) / Math.sqrt(
      Math.pow(minRadiusY * Math.cos(rad), 2) + 
      Math.pow(minRadiusX * Math.sin(rad), 2)
    );
    
    const sinComp = Math.abs(Math.sin(rad));
    const cosComp = Math.abs(Math.cos(rad));
    // Projected size of node at this angle
    const effSize = node.width * sinComp + l1Metrics[i] * cosComp;
    
    // Angular span of the node (degrees)
    const nodeSpan = (effSize / localR) * (180 / Math.PI);
    
    // Dynamic Gap: Increases at Poles
    const isLast = i === count - 1;
    const dynamicGapPx = isLast ? 0 : BASE_GAP * (1 + sinComp * POLE_GAP_BONUS);
    const gapSpan = (dynamicGapPx / localR) * (180 / Math.PI);

    const totalSpan = nodeSpan + gapSpan;
    
    // Advance simulation angle for next node
    simAngle += totalSpan;
    totalRequiredSpan += totalSpan;

    return { node, nodeSpan, gapSpan };
  });

  // 3. Determine Layout Strategy: Expand Radius OR Expand Angles
  let finalRadiusY = minRadiusY;
  let angleExpansionFactor = 1.0;

  if (totalRequiredSpan > MAX_SWEEP_DEG) {
    // Case A: Dense Map. Nodes don't fit in MAX_SWEEP at minRadius.
    // Increase Radius to accommodate nodes within MAX_SWEEP.
    // Logic: ArcLength = R * Theta. To reduce Theta sum to MAX_SWEEP, increase R proportionally.
    const radiusScale = totalRequiredSpan / MAX_SWEEP_DEG;
    finalRadiusY = minRadiusY * radiusScale;
    
    // Angles shrink proportionally to radius increase to maintain non-overlapping geometry
    angleExpansionFactor = 1 / radiusScale;
  } else {
    // Case B: Sparse Map (e.g. < 8 nodes). Nodes fit easily.
    // Keep Radius at Minimum to keep nodes close to root.
    // Increase angular spacing to fill the MAX_SWEEP.
    angleExpansionFactor = MAX_SWEEP_DEG / totalRequiredSpan;
  }

  const finalRadiusX = finalRadiusY * ASPECT_RATIO;

  // --- FINAL PLACEMENT ---
  let currentAngle = START_ANGLE;

  nodes.forEach((node, i) => {
    const isPinned = node.customData?.isPinned === true;
    const hasBoundary = !!node.customData?.boundaryId;
    const data = nodeSimData[i];

    // Apply the expansion/compression factor to spans
    const realNodeSpan = data.nodeSpan * angleExpansionFactor;
    const realGapSpan = data.gapSpan * angleExpansionFactor;

    // Center node in its slice
    const placementAngle = currentAngle + (realNodeSpan / 2);
    const normAngle = (placementAngle % 360 + 360) % 360;

    // Determine side for subtree layout direction
    const dynamicSide = (normAngle > 90 && normAngle < 270) ? -1 : 1;
    
    // Recalculate exact Cartesian coordinates at final radius
    const rad = placementAngle * (Math.PI / 180);
    
    const finalLocalR = (finalRadiusX * finalRadiusY) / Math.sqrt(
      Math.pow(finalRadiusY * Math.cos(rad), 2) + 
      Math.pow(finalRadiusX * Math.sin(rad), 2)
    );

    const placeR = hasBoundary ? finalLocalR * 1.0 : finalLocalR; 
    
    const tCX = rootCenter.x + placeR * Math.cos(rad);
    const tCY = rootCenter.y + placeR * Math.sin(rad);

    if (isPinned) {
      layoutSubtree(node.id, node.x, node.y + node.height / 2, dynamicSide, allElements, hasGlobalFolds, childrenByParent, heightCache, elementById, mustHonorMindmapOrder);
    } else {
      layoutSubtree(node.id, tCX, tCY, dynamicSide, allElements, hasGlobalFolds, childrenByParent, heightCache, elementById, mustHonorMindmapOrder);
    }

    // Advance
    currentAngle += realNodeSpan + realGapSpan;

    if (node.customData?.mindmapNew) {
      ea.addAppendUpdateCustomData(node.id, { mindmapNew: undefined });
    }
    updateL1Arrow(node, context);
    if (groupBranches) applyRecursiveGrouping(node.id, allElements);
  });
};

const verticalL1Distribution = (nodes, context, l1Metrics, totalSubtreeHeight, isLeftSide, centerAngle, gapMultiplier, mustHonorMindmapOrder = false) => {
  const { allElements, rootBox, rootCenter, hasGlobalFolds, childrenByParent, heightCache, elementById } = context;
  const count = nodes.length;

  // --- VERTICAL DIRECTIONAL LAYOUT (RIGHT/LEFT) ---
  const totalContentHeight = totalSubtreeHeight + (count - 1) * layoutSettings.GAP_Y;
  const radiusFromHeight = totalContentHeight / layoutSettings.DIRECTIONAL_ARC_SPAN_RADIANS;
  const radiusY = Math.max(Math.round(rootBox.height * layoutSettings.ROOT_RADIUS_FACTOR), layoutSettings.MIN_RADIUS, radiusFromHeight) + count * layoutSettings.RADIUS_PADDING_PER_NODE;
  const radiusX = Math.max(Math.round(rootBox.width * layoutSettings.ROOT_RADIUS_FACTOR), layoutSettings.MIN_RADIUS, radiusY * 0.2) + count * layoutSettings.RADIUS_PADDING_PER_NODE;

  const totalThetaDeg = (totalContentHeight / radiusY) * (180 / Math.PI);
  let currentAngle = isLeftSide ? centerAngle + totalThetaDeg / 2 : centerAngle - totalThetaDeg / 2;

  nodes.forEach((node, i) => {
    const nodeHeight = l1Metrics[i];
    const isPinned = node.customData?.isPinned === true;
    const side = isLeftSide ? -1 : 1;

    const getAngularInfo = (targetNode, height) => {
      const angleRad = Math.atan2((targetNode.y + targetNode.height / 2) - rootCenter.y, (targetNode.x + targetNode.width / 2) - rootCenter.x);
      const angleDeg = (angleRad * (180 / Math.PI)) + 90;
      const normAngle = angleDeg < 0 ? angleDeg + 360 : angleDeg;
      const spanDeg = (height / radiusY) * (180 / Math.PI);
      return { center: normAngle, span: spanDeg, start: normAngle - spanDeg / 2, end: normAngle + spanDeg / 2 };
    };

    const effectiveGap = layoutSettings.GAP_Y * gapMultiplier;
    const gapSpanDeg = (effectiveGap / radiusY) * (180 / Math.PI);
    const nodeSpanDeg = (nodeHeight / radiusY) * (180 / Math.PI);

    if (isPinned) {
      layoutSubtree(node.id, node.x, node.y + node.height / 2, side, allElements, hasGlobalFolds, childrenByParent, heightCache, elementById, mustHonorMindmapOrder);
      const info = getAngularInfo(node, nodeHeight);
      if (isLeftSide) {
        if (currentAngle > info.start - gapSpanDeg) currentAngle = info.start - gapSpanDeg;
      } else {
        if (currentAngle < info.end + gapSpanDeg) currentAngle = info.end + gapSpanDeg;
      }
    } else {
      const nextPinned = nodes.slice(i + 1).find(n => n.customData?.isPinned);
      if (nextPinned) {
        const nextInfo = getAngularInfo(nextPinned, getSubtreeHeight(nextPinned.id, allElements, childrenByParent, heightCache, elementById));
        if (isLeftSide) {
          if (currentAngle - nodeSpanDeg < nextInfo.end + gapSpanDeg) currentAngle = nextInfo.start - gapSpanDeg;
        } else {
          if (currentAngle + nodeSpanDeg > nextInfo.start - gapSpanDeg) currentAngle = nextInfo.end + gapSpanDeg;
        }
      }

      let angleDeg = isLeftSide ? currentAngle - nodeSpanDeg / 2 : currentAngle + nodeSpanDeg / 2;
      currentAngle = isLeftSide ? currentAngle - (nodeSpanDeg + gapSpanDeg) : currentAngle + (nodeSpanDeg + gapSpanDeg);

      const angleRad = (angleDeg - 90) * (Math.PI / 180);
      const tCX = rootCenter.x + radiusX * Math.cos(angleRad);
      const tCY = rootCenter.y + radiusY * Math.sin(angleRad);
      layoutSubtree(node.id, tCX, tCY, side, allElements, hasGlobalFolds, childrenByParent, heightCache, elementById, mustHonorMindmapOrder);
    }

    if (node.customData?.mindmapNew) {
      ea.addAppendUpdateCustomData(node.id, { mindmapNew: undefined });
    }
    updateL1Arrow(node, context);
    if (groupBranches) applyRecursiveGrouping(node.id, allElements);
  });
};

/**
 * Unified layout function for Level 1 nodes.
 * Uses a Vertical Ellipse for Radial mode. Ensures nodes are distributed across
 * the ellipse to prevent wrap-around overlap and maintain correct facing.
 */
const layoutL1Nodes = (nodes, options, context, mustHonorMindmapOrder = false) => {
  if (nodes.length === 0) return;
  const { allElements, childrenByParent, heightCache, elementById } = context;
  const { sortMethod, centerAngle, gapMultiplier } = options;

  // SORTING: Respect the established mindmapOrder (0..N)
  nodes.sort((a, b) => getMindmapOrder(a) - getMindmapOrder(b));

  const l1Metrics = nodes.map(node => getSubtreeHeight(node.id, allElements, childrenByParent, heightCache, elementById));
  const totalSubtreeHeight = l1Metrics.reduce((sum, h) => sum + h, 0);

  const isLeftSide = sortMethod === "vertical" && Math.abs((centerAngle ?? 0) - 270) < 1;

  if (sortMethod === "radial") {
    radialL1Distribution(nodes, context, l1Metrics, totalSubtreeHeight, mustHonorMindmapOrder);
  } else {
    verticalL1Distribution(nodes, context, l1Metrics, totalSubtreeHeight, isLeftSide, centerAngle, gapMultiplier, mustHonorMindmapOrder);
  }
};

/**
 * Sorts Level 1 nodes based on their current visual position and updates their mindmapOrder.
 * For Radial maps, sorting is done by angle. For others, by Y-coordinate.
 * Newly added nodes (mindmapNew) are always appended to the end of the visual sequence.
**/
const sortL1NodesBasedOnVisualSequence = (l1Nodes, mode, rootCenter) => {
  if (l1Nodes.length === 0) return;

  /** 
   * Helper to sort by Reading Order: Right-side Top-to-Bottom, then Left-side Top-to-Bottom.
   * This serves as our canonical sequence for all directional modes and mode-switching.
   */
  const sortByReadingOrder = (a, b) => {
    const aCX = a.x + a.width / 2;
    const bCX = b.x + b.width / 2;
    const aIsR = aCX > rootCenter.x;
    const bIsR = bCX > rootCenter.x;
    if (aIsR !== bIsR) return aIsR ? -1 : 1; 
    return a.y - b.y; 
  };

  /** Helper to sort by Angle: Clockwise around the root center. */
  const sortByAngle = (a, b) => {
    return getAngleFromCenter(rootCenter, { x: a.x + a.width / 2, y: a.y + a.height / 2 }) -
      getAngleFromCenter(rootCenter, { x: b.x + b.width / 2, y: b.y + b.height / 2 });
  };
     
  const sortFn = mode === "Radial" ? sortByAngle : sortByReadingOrder;
  const existingNodes = l1Nodes.filter(n => !n.customData?.mindmapNew);
  const newNodes = l1Nodes.filter(n => n.customData?.mindmapNew);
  existingNodes.sort(sortFn);

  // Freeze logic mindmapOrder based on final sort
  existingNodes.forEach((node, i) => {
    ea.addAppendUpdateCustomData(node.id, { mindmapOrder: i });
  });

  newNodes.forEach((node, i) => {
    ea.addAppendUpdateCustomData(node.id, { mindmapOrder: existingNodes.length + i });
  });
};

/**
 * Main layout execution function.
 * Calculates positions for a tree rooted at rootId and moves elements.
 * 
 * @param {string} rootId - ID of the root node.
 * @param {boolean} forceUngroup - Force ungrouping of branches before layout.
 * @param {boolean} mustHonorMindmapOrder - If true, enforces the current mindmapOrder over visual position.
 */
const triggerGlobalLayout = async (rootId, forceUngroup = false, mustHonorMindmapOrder = false) => {
  if (!ea.targetView) return;
  const selectedElement = getMindmapNodeFromSelection();
  if (!selectedElement) return;

  const run = async (allElements, mindmapIds, root, doVisualSort, sharedSets, mustHonorMindmapOrder = false) => {
    const oldMode = root.customData?.growthMode;
    const newMode = currentModalGrowthMode;
    
    // Snapshot positions
    const originalPositions = new Map();
    allElements.forEach(el => {
      originalPositions.set(el.id, { x: el.x, y: el.y });
    });

    const elementById = buildElementMap(allElements);
    const childrenByParent = buildChildrenMap(allElements, elementById);
    const heightCache = new Map();

    const branchIds = new Set(mindmapIds);
    const groupToNodes = buildGroupToNodes(branchIds, allElements);

    const hasGlobalFolds = allElements.some(el => el.customData?.isFolded === true);
    const l1Nodes = getChildrenNodes(rootId, allElements);
    if (l1Nodes.length === 0) return;

    if (groupBranches || forceUngroup) {
      mindmapIds.forEach((id) => {
        const el = ea.getElement(id);
        if (el && el.groupIds) {
          el.groupIds = el.groupIds.filter(gid => !isMindmapGroup(gid, allElements));
        }
      });
    }

    const rootBox = getNodeBox(root, allElements);
    const rootCenter = { x: rootBox.minX + rootBox.width / 2, y: rootBox.minY + rootBox.height / 2 };

    const layoutContext = {
      allElements,
      rootId,
      rootBox,
      rootCenter,
      hasGlobalFolds,
      mode: newMode,
      childrenByParent,
      heightCache,
      elementById,
    };

    const isModeSwitch = mustHonorMindmapOrder || oldMode && oldMode !== newMode;

    // Only sort by visual sequence if we aren't enforcing a new manual sort order
    // AND if we aren't switching modes (which might necessitate a specific rebalance)
    // Note: If mustHonorMindmapOrder is true, we explicitly rely on mindmapOrder set in changeNodeOrder
    if (!isModeSwitch && doVisualSort && !mustHonorMindmapOrder) {
      sortL1NodesBasedOnVisualSequence(l1Nodes, newMode, rootCenter);
    } else if (!mustHonorMindmapOrder) {
      // Just update the mode if we aren't re-sorting manually
      ea.addAppendUpdateCustomData(rootId, { growthMode: newMode });
    }

    // --- MAIN EXECUTION BLOCK ---
    if (newMode === "Radial") {
      layoutL1Nodes(l1Nodes, {
        sortMethod: "radial",
        centerAngle: null,
        gapMultiplier: layoutSettings.GAP_MULTIPLIER_RADIAL
      }, layoutContext, mustHonorMindmapOrder);
    } else {
      const leftNodes = [];
      const rightNodes = [];

      if (newMode === "Right-Left") {
        if (isModeSwitch && !mustHonorMindmapOrder) {
          // Switch (Auto-balance): Split evenly
          const splitIdx = Math.ceil(l1Nodes.length / 2);
          l1Nodes.forEach((node, i) => {
            if (i < splitIdx) rightNodes.push(node);
            else leftNodes.push(node);
          });
        } else {
          // Maintenance or Manual Sort: Respect the user's manual side-choice (via coordinates or order)
          // If mustHonorMindmapOrder is true, l1Nodes are already sorted by mindmapOrder.
          // We distribute them based on their current visual center relative to root.
          l1Nodes.forEach((node) => {
            const nodeCX = node.x + node.width / 2;
            if (nodeCX > rootCenter.x) rightNodes.push(node);
            else leftNodes.push(node);
          });
        }
      } else if (newMode === "Left-facing") {
        l1Nodes.forEach(node => leftNodes.push(node));
      } else {
        l1Nodes.forEach(node => rightNodes.push(node));
      }

      if (rightNodes.length > 0) {
        layoutL1Nodes(rightNodes, { sortMethod: "vertical", centerAngle: 90, gapMultiplier: layoutSettings.GAP_MULTIPLIER_DIRECTIONAL }, layoutContext, mustHonorMindmapOrder);
      }
      if (leftNodes.length > 0) {
        layoutL1Nodes(leftNodes, { sortMethod: "vertical", centerAngle: 270, gapMultiplier: layoutSettings.GAP_MULTIPLIER_DIRECTIONAL }, layoutContext, mustHonorMindmapOrder);
      }
    }

    const { mindmapIdsSet, crosslinkIdSet, decorationIdSet } = sharedSets;

    moveCrossLinks(ea.getElements(), originalPositions);
    moveDecorations(ea.getElements(), originalPositions, groupToNodes);

    ea.getElements().filter(el => !mindmapIdsSet.has(el.id) && !crosslinkIdSet.has(el.id) && !decorationIdSet.has(el.id)).forEach(el => {
      delete ea.elementsDict[el.id];
    });
  };

  ea.copyViewElementsToEAforEditing(ea.getViewElements());
  let allElements = ea.getElements();
  let root = allElements.find((el) => el.id === rootId);
  if (!root) return;
  
  const mindmapIds = getBranchElementIds(rootId, allElements);
  const structuralGroupId = getStructuralGroupForNode(mindmapIds, allElements);
  if (structuralGroupId) {
    removeGroupFromElements(structuralGroupId, allElements);
  }

  const mindmapIdsSet = new Set(mindmapIds);
  const crosslinkIdSet = collectCrosslinkIds(allElements);
  const decorationIdSet = collectDecorationIds(allElements);
  const sharedSets = { mindmapIdsSet, crosslinkIdSet, decorationIdSet };

  await run(allElements, mindmapIds, root, true, sharedSets, mustHonorMindmapOrder);
  await addElementsToView();

  // sometimes one pass is not enough to settle subtree positions and boundaries
  ea.copyViewElementsToEAforEditing(ea.getViewElements());
  allElements = ea.getElements();
  root = allElements.find((el) => el.id === rootId);
  await run(allElements, mindmapIds, root, false, sharedSets, mustHonorMindmapOrder);
  
  if (structuralGroupId) {
    ea.addToGroup(mindmapIds);
  }
  await addElementsToView();
  ea.selectElementsInView([selectedElement.id]);
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

const addImage = async ({pathOrFile, width, leftFacing = false, x=0, y=0, depth = 0} = {}) => {
  const newNodeId = await ea.addImage(x, y, pathOrFile);
  const el = ea.getElement(newNodeId);
  const targetWidth = width || (depth === 0 ? EMBEDED_OBJECT_WIDTH_ROOT : EMBEDED_OBJECT_WIDTH_CHILD);
  const ratio = el.width / el.height;
  el.width = targetWidth;
  el.height = targetWidth / ratio;
  if (leftFacing) el.x = x - el.width;
  return newNodeId;
}

const addNode = async (text, follow = false, skipFinalLayout = false, batchModeAllElements = null, batchModeParent = null, pos = null) => {
  if (!ea.targetView) return;
  if (!text || text.trim() === "") return;

  const st = getAppState();
  const isBatchMode = !!batchModeParent;

  let allElements = batchModeAllElements || ea.getViewElements();
  let parent = batchModeParent;

  // custom parent is a non-mindmap node selected by the user to add a child to
  // custom parents need to receive relevant mindmap customData later during the addNode process
  let usingCustomParent = false;

  if (!isBatchMode) {
    parent = getMindmapNodeFromSelection();
    if (!parent) {
      parent = ea.getViewSelectedElement();
      usingCustomParent = !!parent;
    }
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
  const embeddableUrl = parseEmbeddableInput(text, imageInfo);

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
  if (!isBatchMode) ea.clear();
  ea.style.fontFamily = st.currentItemFontFamily;
  ea.style.fontSize = fontScale[Math.min(depth, fontScale.length - 1)];
  ea.style.roundness = roundedCorners ? { type: 3 } : null;

  let curMaxW = depth === 0 ? Math.max(400, maxWidth) : maxWidth;
  const metrics = ea.measureText(renderLinksToText(text));
  const shouldWrap = metrics.width > curMaxW;
  if (shouldWrap) {
    curMaxW = getAdjustedMaxWidth(text, curMaxW).width;
  }

  if (!parent) {
    ea.style.strokeColor = multicolor ? defaultNodeColor : st.currentItemStrokeColor;

    if (imageInfo?.isImagePath) {
      newNodeId = await addImage({
        pathOrFile: imageInfo.path,
        width: imageInfo.width,
        depth
      });
    } else if (imageInfo?.imageFile) {
      newNodeId = await addImage({
        pathOrFile: imageInfo.imageFile,
        width: imageInfo.width,
        depth
      });
    } else if (embeddableUrl) {
      newNodeId = addEmbeddableNode({ url:embeddableUrl, depth:0 });
    } else {
      ea.style.fillStyle = "solid";
      ea.style.backgroundColor = st.viewBackgroundColor;
      ea.style.strokeWidth = STROKE_WIDTHS[Math.min(0, STROKE_WIDTHS.length - 1)]
      ea.style.roughness = getAppState().currentItemRoughness;
      newNodeId = ea.addText(0, 0, text, {
        box: "rectangle",
        textAlign: "center",
        textVerticalAlign: "middle",
        // Use a distinct color representation so the frame can be recolored separately from text
        boxStrokeColor: ea.getCM(ea.style.strokeColor).stringRGB(),
        width: shouldWrap ? curMaxW : undefined,
        autoResize: !shouldWrap,
      });
      ea.style.backgroundColor = "transparent";
    }

    ea.addAppendUpdateCustomData(newNodeId, {
      growthMode: currentModalGrowthMode,
      autoLayoutDisabled: false,
      arrowType: arrowType, // Save the arrow type on new root
      fontsizeScale,
      multicolor,
      boxChildren,
      roundedCorners,
      maxWrapWidth: maxWidth,
      isSolidArrow,
      centerText
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
    
    // Determine direction for initial offset to prevent visual jumping
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
        // Default to parent side or Right for Radial/Fallback layouts
        const parentCenterX = parentBox.minX + parentBox.width / 2;
        targetSide = parentCenterX > rootCenter.x ? 1 : -1;
      }
    } else {
       // Deep nodes follow parent's side
       const parentCenterX = parentBox.minX + parentBox.width / 2;
       targetSide = parentCenterX > rootCenter.x ? 1 : -1;
    }

    let side = targetSide;

    const offset = (mode === "Radial" || side === 1)
      ? rootBox.width * 2
      : -rootBox.width;
      
    let px = parentBox.minX + offset,
      py = parentBox.minY;

    // If pos is provided (e.g. from Add Sibling), override placement.
    // This maintains the "same side" logic because the originator's X is used.
    if (!autoLayoutDisabled && pos) {
      px = pos.x;
      py = pos.y;
      // Recalculate side based on provided position relative to root
      side = (px + (shouldWrap ? curMaxW : metrics.width) / 2 > rootCenter.x) ? 1 : -1;
    } else if (!autoLayoutDisabled) { // Ensure new node is placed below existing siblings to preserve visual order
      const siblings = getChildrenNodes(parent.id, allElements);
      if (siblings.length > 0) {
        const sortedSiblings = siblings.sort((a, b) => a.y - b.y);
        const lastSibling = sortedSiblings[sortedSiblings.length - 1];
        const lastSiblingBox = getNodeBox(lastSibling, allElements);
        py = lastSiblingBox.minY + lastSiblingBox.height + layoutSettings.GAP_Y;
      }
    } else if (autoLayoutDisabled) {
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

    if (imageInfo?.isImagePath) {
      newNodeId = await addImage({
        pathOrFile: imageInfo.path,
        width: imageInfo.width,
        leftFacing: side === -1 && !autoLayoutDisabled,
        x: px,
        y: py,
        depth
      });
    } else if (imageInfo?.imageFile) {
      newNodeId = await addImage({
        pathOrFile: imageInfo.imageFile,
        width: imageInfo.width,
        leftFacing: side === -1 && !autoLayoutDisabled,
        x: px,
        y: py,
        depth
      });
    } else if (embeddableUrl) {
      newNodeId = addEmbeddableNode({ px, py, url:embeddableUrl, depth });
      const el = ea.getElement(newNodeId);
      if (side === -1 && !autoLayoutDisabled) el.x = px - el.width;
    } else {
      ea.style.strokeWidth = STROKE_WIDTHS[Math.min(depth, STROKE_WIDTHS.length - 1)]
      ea.style.roughness = getAppState().currentItemRoughness;
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
        mindmapNew: !!pos ? false : true, // if position is provided a sibling is being added to a defined spot in the layout
        mindmapOrder: nextSiblingOrder,
      });
    } else {
      ea.addAppendUpdateCustomData(newNodeId, { mindmapOrder: nextSiblingOrder });
    }

    if (!ea.getElement(parent.id)) {
      ea.copyViewElementsToEAforEditing([parent]);
      parent = ea.getElement(parent.id);
    }

    // if the custom parent is already in a hierarchy, then formally make it the next sibling
    if (depth > 1 && usingCustomParent && !parent.customData?.mindmapOrder) {
      ea.addAppendUpdateCustomData(parent.id, { mindmapOrder: nextSiblingOrder });
    }

    // else make the customParent the root of the new mindmap
    if ((depth === 0 || usingCustomParent) && !parent.customData?.growthMode && !parent.customData?.mindmapOrder) {
      ea.addAppendUpdateCustomData(parent.id, {
        growthMode: currentModalGrowthMode,
        autoLayoutDisabled: false,
        arrowType: arrowType,
        fontsizeScale,
        multicolor,
        boxChildren,
        roundedCorners,
        maxWrapWidth: maxWidth,
        isSolidArrow,
        centerText
      });
    }

    if ((parent.type === "image" || parent.type === "embeddable") && typeof parent.customData?.mindmapOrder === "undefined") {
      ea.addAppendUpdateCustomData(parent.id, { mindmapOrder: 0 });
    }

    ea.style.strokeWidth = STROKE_WIDTHS[Math.min(depth, STROKE_WIDTHS.length - 1)];
    ea.style.roughness = getAppState().currentItemRoughness;
    ea.style.strokeStyle = isSolidArrow ? "solid" : getAppState().currentItemStrokeStyle;
    
    // Initial arrow creation (placeholder points)
    const startPoint = [parentBox.minX + parentBox.width / 2, parentBox.minY + parentBox.height / 2];
    arrowId = ea.addArrow([startPoint, startPoint], {
      startObjectId: parent.id,
      endObjectId: newNodeId,
      startArrowHead: null,
      endArrowHead: null,
    });
    const eaArrow = ea.getElement(arrowId);
    
    // Initialize Roundness based on arrow type
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

  if (isBatchMode) {
    return ea.getElement(newNodeId);
  }

  const hasImage = !!imageInfo?.imageFile || imageInfo?.isImagePath;

  await addElementsToView({
    repositionToCursor: !parent,
    save: hasImage,
    shouldSleep: hasImage, //to ensure images get properly loaded to excalidraw Files
  });

  if (rootId && (autoLayoutDisabled || skipFinalLayout) && parent) {
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
  await triggerGlobalLayout(rootId);
  return finalNode;
};

// ---------------------------------------------------------------------------
// 5. Copy & Paste Engine
// ---------------------------------------------------------------------------

/**
 * Checks if a node text contains exactly one wiki link to a markdown file and returns that TFile.
 */
const getNodeMarkdownFile = (nodeText) => {
  if(!nodeText || !ea.targetView || !ea.targetView.file) return null;
  // Match [[filename]] or [[filename|alias]] that takes up the whole string
  const parts = nodeText.trim().match(/^\[\[([^#\|\]]+)[^\]]*]]$/);
  if (!!parts?.[1]) {
    const file = app.metadataCache.getFirstLinkpathDest(parts[1], ea.targetView.file.path);
    return (file && file.extension === "md") ? file : null;
  }
  return null;
}

/**
 * Generates a hierarchy of links based on the headings in the target file.
 */
const importOutline = async () => {
  if (!ea.targetView) return;
  
  const sel = getMindmapNodeFromSelection();
  if (!sel) {
    new Notice("Select a node containing a link.");
    return;
  }

  const allElements = ea.getViewElements();
  const nodeText = getTextFromNode(allElements, sel, true, false); // Get raw text

  const markdownFile = getNodeMarkdownFile(nodeText);
  if (!markdownFile) {
    new Notice(t("NOTICE_NO_LINKED_FILE"));
    return;
  }

  const cache = await app.metadataCache.blockCache.getForFile({isCancelled: () => false}, markdownFile);
  if (!cache || !cache.blocks) {
    new Notice(t("NOTICE_NO_HEADINGS"));
    return;
  }

  const shortFilePath = app.metadataCache.fileToLinktext(markdownFile, ea.targetView.file.path, true);
  const outlines = [];

  for (const block of cache.blocks) {
    if (block.node.type === "heading") {
      const depth = block.node.depth;
      
      // Strip markdown heading markers (# ) from display text
      const rawHeadingText = block.display.replace(/^#+\s+/, "");

      if (rawHeadingText === "Excalidraw Data") break;
      
      // Format Alias: Replace pipe with space to prevent broken links
      const alias = rawHeadingText.replace(/\|/g, " ");
      
      // Format Anchor: replace specific chars (#|\:) with space for the link target
      const anchor = rawHeadingText.replace(/[|#\\:]/g, " ");
      
      const indent = "  ".repeat(Math.max(0, depth - 1));
      
      outlines.push(`${indent}- [[${shortFilePath}#${anchor}|${alias}]]`);
    }
  }

  if (outlines.length === 0) {
    new Notice(t("NOTICE_NO_HEADINGS"));
    return;
  }

  await importTextToMap(outlines.join("\n"));
};

/**
// Extracts text from a node, handling text elements, images, and embeddables.
**/
const getTextFromNode = (all, node, getRaw = false, shortPath = false) => {
  if (node.type === "embeddable") {
    return node.link.startsWith("[[") ? `!${node.link}` : `![](${node.link})`;
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

/**
// Copies the selected tree or branch to the clipboard as Markdown text.
**/
const copyMapAsText = async (cut = false) => {
  if (!ea.targetView) return;
  ensureNodeSelected();
  const sel = getMindmapNodeFromSelection();
  if (!sel) {
    new Notice(t("NOTICE_SELECT_NODE_TO_COPY"));
    return;
  }
  const all = ea.getViewElements();
  const info = getHierarchy(sel, all);

  const isRootSelected = info.rootId === sel.id;
  const parentNode = getParentNode(sel.id, all);

  // Retrieve root to determine growthMode for sorting logic
  const root = all.find(el => el.id === info.rootId);
  const mode = root?.customData?.growthMode || currentModalGrowthMode;

  const elementsToDelete = [];

  const useTab = app.vault.getConfig("useTab");
  const tabSize = app.vault.getConfig("tabSize");
  const indentVal = useTab ? "\t" : " ".repeat(tabSize);

  // --- Crosslink & Block Reference Logic ---
  const branchIds = new Set(getBranchElementIds(sel.id, all));
  
  const nodeBlockRefs = new Map(); // NodeID -> "^blockId"
  const nodeOutgoingLinks = new Map(); // NodeID -> ["^blockId", ...]

  // Find arrows within this branch that are NOT structural branch arrows
  const crossLinkArrows = all.filter(el => 
    el.type === "arrow" && 
    !el.customData?.isBranch && 
    branchIds.has(el.startBinding?.elementId) && 
    branchIds.has(el.endBinding?.elementId)
  );

  const hasCrosslinks = crossLinkArrows.length > 0;
  // Use Loose List (empty lines) if crosslinks exist to support block refs, else Tight List
  const lineSeparator = hasCrosslinks ? "\n\n" : "\n";

  if (hasCrosslinks) {
    crossLinkArrows.forEach(arrow => {
      const startId = arrow.startBinding.elementId;
      const endId = arrow.endBinding.elementId;

      // Generate block ref for destination if not exists
      if (!nodeBlockRefs.has(endId)) {
        nodeBlockRefs.set(endId, "^" + ea.generateElementId().substring(0, 8));
      }

      // Record outgoing link for source
      if (!nodeOutgoingLinks.has(startId)) {
        nodeOutgoingLinks.set(startId, []);
      }
      nodeOutgoingLinks.get(startId).push(nodeBlockRefs.get(endId));
      
      if (cut) elementsToDelete.push(arrow);
    });
  }

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
      
      // Remove boundary if cutting
      if (node.customData?.boundaryId) {
        const boundary = all.find(e => e.id === node.customData.boundaryId);
        if (boundary) elementsToDelete.push(boundary);
      }
    }

    // --- Visual Sorting Logic ---
    let children = getChildrenNodes(nodeId, all);
    const parentCenter = { x: node.x + node.width / 2, y: node.y + node.height / 2 };

    if (mode === "Radial") {
      // Radial: Clockwise starting from Top (12 o'clock)
      children.sort((a, b) => {
          const centerA = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
          const centerB = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
          return getAngleFromCenter(parentCenter, centerA) - getAngleFromCenter(parentCenter, centerB);
      });
    } else if (mode === "Right-Left" && nodeId === info.rootId) {
      // Right-Left Root: Right side (Top->Bottom) THEN Left side (Top->Bottom)
      const right = [];
      const left = [];
      
      children.forEach(child => {
          const childCx = child.x + child.width / 2;
          if (childCx > parentCenter.x) right.push(child);
          else left.push(child);
      });
      
      right.sort((a, b) => a.y - b.y);
      left.sort((a, b) => a.y - b.y);
      
      children = [...right, ...left];
    } else {
      // Linear Modes (Right, Left) or Sub-branches: Top to Bottom
      children.sort((a, b) => a.y - b.y);
    }

    let str = "";
    let text = getTextFromNode(all, node);

    // --- Append Metadata Suffixes ---
    
    // 1. Outgoing Crosslinks: [[#^ref|*]]
    if (nodeOutgoingLinks.has(nodeId)) {
      const links = nodeOutgoingLinks.get(nodeId).map(ref => `[[#${ref}|*]]`).join(" ");
      text += ` ${links}`;
    }

    // 2. Boundary Tag
    if (!!node.customData?.boundaryId) {
      text += " #boundary";
    }

    // 3. Incoming Block Reference (Must be last)
    if (nodeBlockRefs.has(nodeId)) {
      text += ` ${nodeBlockRefs.get(nodeId)}`;
    }

    if (depth === 0 && isRootSelected) {
      str += `# ${text}${lineSeparator}`;
    } else {
      str += `${indentVal.repeat(depth - (isRootSelected ? 1 : 0))}- ${text}${lineSeparator}`;
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

/**
// Core logic to parse a list string and add nodes to the map
**/
const importTextToMap = async (rawText) => {
  if (!ea.targetView) return;
  if (!rawText) return;

  const sel = getMindmapNodeFromSelection();
  let currentParent;

  const lines = rawText.split(/\r\n|\n|\r/).filter((l) => l.trim() !== "");

  if (lines.length === 0) return;

  if (lines.length === 1) {
    // Simple single line logic (existing behavior)
    let text = lines[0].replace(/^(\s*)(?:-|\*|\d+\.)\s+/, "").trim();
    
    // Cleanup tags for single line paste too
    text = text.replace(/\s#boundary\b/g, "");
    text = text.replace(/\s\^([a-zA-Z0-9]{8})$/, "");
    text = text.replace(/\[\[#\^([a-zA-Z0-9]{8})\|\*\]\]/g, "");

    if (text) {
      currentParent = await addNode(text.trim(), true, false);
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

  // Maps for crosslink reconstruction
  const blockRefToNodeId = new Map(); // ^12345678 -> newNodeId
  const nodeToOutgoingRefs = new Map(); // newNodeId -> [^12345678, ...]
  
  // Regex patterns
  const boundaryRegex = /\s#boundary\b/;
  const blockRefRegex = /\s\^([a-zA-Z0-9]{8})$/;
  const crossLinkRegex = /\[\[#\^([a-zA-Z0-9]{8})\|\*\]\]/g;

  lines.forEach((line) => {
    let text = "";
    let indent = 0;
    
    if (isHeader(line)) {
      indent = 0;
      text = line.replace(/^#+\s/, "").trim();
    } else {
      const match = isListItem(line);
      if (match) {
        indent = delta + match[1].length;
        text = match[2].trim();
      } else if (parsed.length > 0) {
        // multiline handling
        parsed[parsed.length - 1].text += "\n" + line.trim();
        return; // Skip the rest of processing for continuation lines
      }
    }

    if (text) {
      // 1. Check for Boundary
      const hasBoundary = boundaryRegex.test(text);
      text = text.replace(boundaryRegex, "");

      // 2. Check for Block Ref (ID)
      const refMatch = text.match(blockRefRegex);
      let blockRef = null;
      if (refMatch) {
        blockRef = refMatch[1];
        text = text.replace(blockRefRegex, "");
      }

      // 3. Check for Crosslinks (Outgoing)
      const outgoingRefs = [];
      let linkMatch;
      while ((linkMatch = crossLinkRegex.exec(text)) !== null) {
        outgoingRefs.push(linkMatch[1]);
      }
      text = text.replace(crossLinkRegex, "");

      parsed.push({ 
        indent, 
        text: text.trim(),
        hasBoundary,
        blockRef,
        outgoingRefs 
      });
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
    
    // Helper to process metadata on the root/first node
    const processRootMeta = (item, id) => {
        if(item.blockRef) blockRefToNodeId.set(item.blockRef, id);
        if(item.outgoingRefs.length > 0) nodeToOutgoingRefs.set(id, item.outgoingRefs);
        if(item.hasBoundary) createImportBoundary(id);
    };

    if (topLevelItems.length === 1) {
      currentParent = await addNode(topLevelItems[0].text, true, true, [], null);
      processRootMeta(topLevelItems[0], currentParent.id);
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
  
  // Helper to create boundary during import (mimics toggleBoundary logic)
  const createImportBoundary = (nodeId) => {
    const node = ea.getElement(nodeId);
    if (!node) return;
    
    const id = ea.generateElementId();
    const st = getAppState();
    const boundaryEl = {
        id: id,
        type: "line",
        x: node.x, y: node.y, width: 1, height: 1,
        angle: 0,
        roughness: st.currentItemRoughness,
        strokeColor: node.strokeColor,
        backgroundColor: node.strokeColor,
        fillStyle: "solid",
        strokeWidth: 2,
        strokeStyle: "solid",
        opacity: 30,
        points: [[0,0], [1,1], [0,0]],
        polygon: true,
        locked: false,
        groupIds: node.groupIds || [],
        customData: {isBoundary: true},
        roundness: arrowType === "curved" ? {type: 2} : null,
    };
    
    ea.elementsDict[id] = boundaryEl;
    ea.addAppendUpdateCustomData(nodeId, { boundaryId: id });
  };

  for (const item of parsed) {
    while (stack.length > 1 && item.indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const parentNode = stack[stack.length - 1].node;
    const currentAllElements = initialViewElements.concat(ea.getElements());
    const newNode = await addNode(item.text, false, true, currentAllElements, parentNode);
    
    // Process Metadata
    if (item.blockRef) blockRefToNodeId.set(item.blockRef, newNode.id);
    if (item.outgoingRefs.length > 0) nodeToOutgoingRefs.set(newNode.id, item.outgoingRefs);
    if (item.hasBoundary) createImportBoundary(newNode.id);
    
    stack.push({ indent: item.indent, node: newNode });
  }

  // -------------------------------------------------------------------------
  //  Generate Crosslinks
  // -------------------------------------------------------------------------
  nodeToOutgoingRefs.forEach((targetRefs, sourceId) => {
    targetRefs.forEach(ref => {
        const targetId = blockRefToNodeId.get(ref);
        if (targetId) {
            ea.connectObjects(
                sourceId, null, 
                targetId, null, 
                {
                    startArrowHead: null,
                    endArrowHead: "triangle"
                }
            );
            // Get the newly created arrow (last element) and style it
            const elements = ea.getElements();
            const arrow = elements[elements.length - 1];
            if (arrow && arrow.type === "arrow") {
                arrow.strokeStyle = "dashed";
            }
        }
    });
  });

  // -------------------------------------------------------------------------
  // "Right-Left" Balanced Layout Adjustment for Imported L1 Nodes
  // -------------------------------------------------------------------------
  const rootIdForImport = sel
    ? getHierarchy(sel, initialViewElements).rootId 
    : currentParent.id;

  const rootElForImport = sel 
    ? initialViewElements.find(e => e.id === rootIdForImport) 
    : currentParent;
    
  if (rootElForImport) {
    const mode = rootElForImport.customData?.growthMode || currentModalGrowthMode;
    if (mode === "Right-Left" && currentParent.id === rootIdForImport) {
      
      const eaElements = ea.getElements();
      const importedL1Nodes = eaElements.filter(el => 
        el.customData?.mindmapNew &&
        eaElements.some(arrow => 
           arrow.type === "arrow" && 
           arrow.customData?.isBranch && 
           arrow.startBinding?.elementId === currentParent.id && 
           arrow.endBinding?.elementId === el.id
        )
      );

      // Sort by assigned mindmapOrder to preserve import sequence
      importedL1Nodes.sort((a, b) => (a.customData?.mindmapOrder || 0) - (b.customData?.mindmapOrder || 0));

      if (importedL1Nodes.length > 0) {
        // Balanced Distribution:
        // First half -> Right
        // Second half -> Left
        // (If odd, Right gets one more)
        const splitIndex = Math.ceil(importedL1Nodes.length / 2);

        importedL1Nodes.forEach((node, i) => {
          // Remove mindmapNew flag to bypass alternating distribution in triggerGlobalLayout
          delete node.customData.mindmapNew;
          
          if (i < splitIndex) {
             // Right Side: Force position to the right of root
             node.x = rootElForImport.x + rootElForImport.width + 100;
          } else {
             // Left Side: Force position to the left of root
             node.x = rootElForImport.x - node.width - 100;
          }
        });
      }
    }
  }

  await addElementsToView({ shouldSleep: true }); // in case there are images in the imported map

  const rootId = sel
    ? getHierarchy(sel, ea.getViewElements()).rootId
    : currentParent.id;
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

/**
// Pastes a Markdown list from clipboard into the map, converting it to nodes.
**/
const pasteListToMap = async () => {
  const rawText = await navigator.clipboard.readText();
  if (!rawText) {
    new Notice(t("NOTICE_CLIPBOARD_EMPTY"));
    return;
  }
  await importTextToMap(rawText);
};

// ---------------------------------------------------------------------------
// 6. Map Actions
// ---------------------------------------------------------------------------

/**
 * Recursively updates the font size of a subtree based on the new depth level.
 * Only updates if the current font size matches the default for its *previous* depth,
 * preserving user customizations.
 */
const updateSubtreeFontSize = (nodeId, newDepth, allElements, rootFontScale) => {
  const fontScale = getFontScale(rootFontScale);
  
  const node = allElements.find(el => el.id === nodeId);
  if (!node) return;

  // Determine the node's *current* depth in the hierarchy to find its expected "old" font size
  const currentHierarchy = getHierarchy(node, allElements);
  const oldDepth = currentHierarchy.depth;

  // Calculate standard sizes
  const oldStandardSize = fontScale[Math.min(oldDepth, fontScale.length - 1)];
  const newStandardSize = fontScale[Math.min(newDepth, fontScale.length - 1)];

  // Update only if the user hasn't customized the font size
  if (node.fontSize === oldStandardSize) {
    const eaNode = ea.getElement(nodeId);
    eaNode.fontSize = newStandardSize;
    
    // Refresh dimensions to fit new font size
    if (eaNode.type === "text" || (eaNode.boundElements && eaNode.boundElements.some(b => b.type === "text"))) {
      ea.refreshTextElementSize(eaNode.id);
    }
  }

  // Recurse to children
  const children = getChildrenNodes(nodeId, allElements);
  children.forEach(child => {
    updateSubtreeFontSize(child.id, newDepth + 1, allElements, rootFontScale);
  });
};

const changeNodeOrder = async (key) => {
  if (!ea.targetView) return;
  const allElements = ea.getViewElements();
  const current = getMindmapNodeFromSelection();
  if (!current) return;
  
  const info = getHierarchy(current, allElements);
  const root = allElements.find((e) => e.id === info.rootId);
  const rootFontScale = root.customData?.fontsizeScale ?? fontsizeScale;

  if (current.id === root.id) {
    new Notice(t("NOTICE_CANNOT_MOVE_ROOT"));
    return; // cannot reorder root
  }
  if (root.customData?.autoLayoutDisabled) {
    new Notice(t("NOTICE_CANNOT_MOVE_AUTO_LAYOUT_DISABLED"));
    return; // cannot reorder in auto-layout disabled maps
  }
  if (current.customData?.isPinned) {
    new Notice(t("NOTICE_CANNOT_MOVE_PINNED"));
    return; // cannot reorder pinned nodes
  }
  
  const parent = getParentNode(current.id, allElements);
  if (!parent) return;

  const rootCenter = root.x + root.width / 2;
  const curCenter = current.x + current.width / 2;
  const isInRight = curCenter > rootCenter;

  // ---------------------------------------------------------
  // Feature: L1 Node Side Swap (Right-Left Map Exclusively)
  // ---------------------------------------------------------
  const isRightLeft = (root.customData?.growthMode === "Right-Left") || (!root.customData?.growthMode && currentModalGrowthMode === "Right-Left");
  
  if (parent.id === root.id && isRightLeft) {
     const moveRight = !isInRight && key === "ArrowRight"; // Left Node -> Right Side
     const moveLeft = isInRight && key === "ArrowLeft";    // Right Node -> Left Side

     if (moveRight || moveLeft) {
        // Calculate Delta to mirror across root center
        // TargetX = RootX + (RootX - CurX) => Delta = 2 * (RootX - CurX)
        const deltaX = 2 * (rootCenter - curCenter);
        
        // Gather all elements in branch + decorations
        const branchIds = getBranchElementIds(current.id, allElements);
        const elementsToMove = new Set();
        
        branchIds.forEach(id => {
           const el = allElements.find(x => x.id === id);
           if (el) {
             elementsToMove.add(el);
             // Include attached decorations (grouped elements)
             if (el.groupIds && el.groupIds.length > 0) {
                const groupEls = ea.getElementsInTheSameGroupWithElement(el, allElements);
                groupEls.forEach(gEl => elementsToMove.add(gEl));
             }
           }
        });
        
        const arr = Array.from(elementsToMove);
        ea.copyViewElementsToEAforEditing(arr);
        arr.forEach(el => {
            const eaEl = ea.getElement(el.id);
            eaEl.x += deltaX;
        });
        
        await addElementsToView();
        
        // Trigger layout. mustHonorMindmapOrder=false ensures the engine sorts based on the NEW visual position
        triggerGlobalLayout(root.id, false, false);
        return;
     }
  }

  // 1. Structural Promotion (Left/Right Arrows moving "Inward")
  // Selected node must be rewired to parent of current parent (Grandparent)
  const isPromote = (isInRight && key === "ArrowLeft") || (!isInRight && key === "ArrowRight");
  const isDemote = (isInRight && key === "ArrowRight") || (!isInRight && key === "ArrowLeft");
  
  if (isPromote) {
    if (parent.id === root.id) return; // Cannot promote L1 nodes (they are already attached to root)
    
    const grandParent = getParentNode(parent.id, allElements);
    if (!grandParent) return;

    // Find the arrow connecting Parent -> Current
    const arrow = allElements.find(
      (a) => a.type === "arrow" && 
      a.customData?.isBranch && 
      a.startBinding?.elementId === parent.id && 
      a.endBinding?.elementId === current.id
    );

    if (arrow) {
      ea.copyViewElementsToEAforEditing([arrow, current]);
      const eaArrow = ea.getElement(arrow.id);
      // Rewire to Grandparent
      eaArrow.startBinding.elementId = grandParent.id;
      
      // Determine new order: Place it after the old parent
      const parentOrder = getMindmapOrder(parent);
      ea.addAppendUpdateCustomData(current.id, { mindmapOrder: parentOrder + 0.5 });
      
      // Update font sizes for the promoted subtree
      // New depth is same as Parent's depth (since it becomes a sibling of Parent)
      const parentInfo = getHierarchy(parent, allElements);
      updateSubtreeFontSize(current.id, parentInfo.depth, allElements, rootFontScale);

      await addElementsToView();
      triggerGlobalLayout(root.id, false, true);
      return;
    }
  }

  if (isDemote) {
    // Demotion: Selected node becomes child of sibling of current parent
    const siblings = getChildrenNodes(parent.id, allElements);
    
    // Sort siblings to ensure we pick the correct visual neighbor based on mindmapOrder
    siblings.sort((a, b) => getMindmapOrder(a) - getMindmapOrder(b));
    
    if (siblings.length < 2) {
      new Notice("Cannot demote: No sibling found to accept this node.");
      return;
    }
    
    const currentIndex = siblings.findIndex(s => s.id === current.id);
    
    // Determine visual direction based on layout mode
    // Radial Left side is inverted (Clockwise vs Counter-Clockwise list order)
    const mirrorBehavior = isInRight || currentModalGrowthMode !== "Radial";
    
    // Attempt to move to sibling ABOVE first
    // Normal: Above is index-1. Radial Left: Above is index+1
    let targetIndex = mirrorBehavior ? currentIndex - 1 : currentIndex + 1;
    
    // Fallback: If no sibling above, move to sibling BELOW
    if (targetIndex < 0 || targetIndex >= siblings.length) {
      targetIndex = mirrorBehavior ? currentIndex + 1 : currentIndex - 1;
    }
    
    // Safety check
    if (targetIndex < 0 || targetIndex >= siblings.length) return;
    
    const newParent = siblings[targetIndex];
    
    // Find the arrow to update structural binding
    const arrow = allElements.find(
      (a) => a.type === "arrow" && 
      a.customData?.isBranch && 
      a.startBinding?.elementId === parent.id && 
      a.endBinding?.elementId === current.id
    );

    if (arrow) {
      ea.copyViewElementsToEAforEditing([arrow, current]);
      const eaArrow = ea.getElement(arrow.id);
      
      // Rewire arrow to new parent
      eaArrow.startBinding.elementId = newParent.id;
      
      // Determine new order: Append as last child of new parent
      const newParentChildren = getChildrenNodes(newParent.id, allElements);
      const nextOrder = newParentChildren.length > 0 
        ? Math.max(...newParentChildren.map(getMindmapOrder)) + 1 
        : 0;
        
      ea.addAppendUpdateCustomData(current.id, { mindmapOrder: nextOrder });

      // Update font sizes for the demoted subtree
      // New depth is Parent's Depth + 2 (Child of Sibling)
      const parentInfo = getHierarchy(parent, allElements);
      updateSubtreeFontSize(current.id, parentInfo.depth + 2, allElements, rootFontScale);
      
      await addElementsToView();
      triggerGlobalLayout(root.id, false, true);
    }
    return;
  }

  // 2. Sibling Reordering (Up/Down Arrows)
  if (key === "ArrowUp" || key === "ArrowDown") {
    const siblings = getChildrenNodes(parent.id, allElements);
    if (siblings.length < 2) return;

    // Ensure siblings are sorted by current order before swapping
    siblings.sort((a, b) => getMindmapOrder(a) - getMindmapOrder(b));
    
    const currentIndex = siblings.findIndex(s => s.id === current.id);
    if (currentIndex === -1) return;

    let swapIndex = -1;
    const mirrorBehavior = isInRight || currentModalGrowthMode !== "Radial";
    
    if (key === "ArrowUp") {
      swapIndex = mirrorBehavior ? currentIndex - 1 : currentIndex + 1;
    } else {
      swapIndex = mirrorBehavior ? currentIndex + 1 : currentIndex - 1;
    }

    // Boundary checks
    if (swapIndex >= 0 && swapIndex < siblings.length) {
      // Re-normalize all orders to clean integers to prevent drift
      ea.copyViewElementsToEAforEditing(siblings);
      
      siblings.forEach((sib, idx) => {
        let newOrder = idx;
        if (idx === currentIndex) newOrder = swapIndex;
        if (idx === swapIndex) newOrder = currentIndex;
        
        ea.addAppendUpdateCustomData(sib.id, { mindmapOrder: newOrder });
      });

      await addElementsToView();
      // Trigger layout specifically honoring the new sort order
      triggerGlobalLayout(root.id, false, true);
    }
  }
}


/**
 * Navigates the mindmap using arrow keys.
 * Handles different layout modes (Radial, Directional) and folds.
 * 
 * @param {object} params
 * @param {string} params.key - "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight"
 * @param {boolean} params.zoom - whether to zoom to the new node
 * @param {boolean} params.focus - whether to focus the new node
 */
const navigateMap = async ({key, zoom = false, focus = false} = {}) => {
  if(!key) return;
  if (!ea.targetView) return;
  let allElements = ea.getViewElements();
  const current = getMindmapNodeFromSelection();
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
      const ch = getChildrenNodes(current.id, allElements).sort((a, b) => (a.customData?.mindmapOrder ?? 100) - (b.customData?.mindmapOrder ?? 100));
      if (ch.length) ea.selectElementsInView([ch[0]]);
    }
  } else if (key === "ArrowUp" || key === "ArrowDown") {
    const parent = getParentNode(current.id, allElements);
    if (!parent) return;

    const siblings = getChildrenNodes(parent.id, allElements);

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
    const startIndex = (idx === -1 ? 0 : idx); // Start at 0 if current isn't found

    const mapMode = root.customData?.growthMode || currentModalGrowthMode;
    const currentIsLeftwardBranch = (current.x + current.width / 2) < (parent.x + parent.width / 2);
    
    // Reverse up/down for left-facing branches in directional modes
    const shouldReverseArrows = 
        ["Right-Left", "Left-facing", "Right-facing"].includes(mapMode) &&
        currentIsLeftwardBranch;

    let navigateForward; // true for next sibling (clockwise), false for previous (counter-clockwise)
    if (shouldReverseArrows) {
        navigateForward = (key === "ArrowUp"); // Reversed: Up moves forward, Down moves backward
    } else {
        navigateForward = (key === "ArrowDown"); // Normal: Down moves forward, Up moves backward
    }

    let nIdx;
    if (navigateForward) {
        nIdx = (startIndex + 1) % siblings.length;
    } else {
        nIdx = (startIndex - 1 + siblings.length) % siblings.length;
    }
    
    ea.selectElementsInView([siblings[nIdx]]);
  }

  if (zoom) zoomToFit();
  if (focus) focusSelected();
};

/**
 * Triggers a layout refresh for the tree containing the selected element.
 */
const refreshMapLayout = async () => {
  if (!ea.targetView) return;
  const sel = getMindmapNodeFromSelection();
  if (sel) {
    const info = getHierarchy(sel, ea.getViewElements());
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
 * 
 * @param {*} nodeId 
 * @param {*} workbenchEls ExcalidrawAutomate elements on the workbench
 * @returns the group ID if a structural mindmap group exists for the branch, else null
 */
const getStructuralGroupForNode = (branchIds, workbenchEls) => {
  const branchElementIds = workbenchEls.filter(el => branchIds.includes(el.id));
  const commonGroupId = ea.getCommonGroupForElements(branchElementIds);
  const structuralGroupId = (commonGroupId && isMindmapGroup(commonGroupId, workbenchEls)) ? commonGroupId : null;
  return structuralGroupId;
};

/**
 * 
 * @param {*} groupId 
 * @param {*} workbenchEls ExcalidrawAutomate elements on the workbench
 */
const removeGroupFromElements = (groupId, workbenchEls) => {
  workbenchEls.forEach(el => {
    if (el.groupIds) { 
      el.groupIds = el.groupIds.filter(g => g !== groupId);
    }
  });
}

/**
 * Toggles a single flat group for the selected branch.
**/
const toggleBranchGroup = async () => {
  if (!ea.targetView) return;
  const sel = getMindmapNodeFromSelection();
  if (!sel) return;

  const allElements = ea.getViewElements();
  const branchIds = getBranchElementIds(sel.id, allElements);

  if (branchIds.length <= 1) return;

  ea.copyViewElementsToEAforEditing(allElements.filter(el => branchIds.includes(el.id)));
  const workbenchEls = ea.getElements();

  let newGroupId;
  const structuralGroupId = getStructuralGroupForNode(branchIds, workbenchEls);
  if (structuralGroupId) {
    removeGroupFromElements(structuralGroupId, workbenchEls);
  } else {
    newGroupId = ea.addToGroup(branchIds);
  }

  await addElementsToView();

  if (newGroupId) {
    let selectedGroupIds = {};
    selectedGroupIds[newGroupId] = true;
    ea.viewUpdateScene({appState: {selectedGroupIds}})
  }

  updateUI();
};

/**
 * Toggles the pinned state of the selected node.
 * Pinned nodes are not moved by auto-layout.
 */
const togglePin = async () => {
  if (!ea.targetView) return;
  const sel = getMindmapNodeFromSelection();
  if (sel) {
    const boundTextElement = ea.getBoundTextElement(sel, true)?.sceneElement;
    const newPinnedState = !(sel.customData?.isPinned === true);
    ea.copyViewElementsToEAforEditing(boundTextElement ? [sel, boundTextElement] : [sel]);
    ea.addAppendUpdateCustomData(sel.id, { isPinned: newPinnedState });
    if (boundTextElement && !newPinnedState && boundTextElement.customData?.hasOwnProperty("isPinned")) {
      delete ea.getElement(boundTextElement.id).customData.isPinned;
    }
    await addElementsToView();
    if(!autoLayoutDisabled) await refreshMapLayout();
    ea.selectElementsInView([sel.id]);
    updateUI();
  }
};

const padding = layoutSettings.CONTAINER_PADDING;
/**
 * Toggles a bounding box around the selected text element (node).
 * Creates a rectangle container if one doesn't exist, or removes it if it does.
 */
const toggleBox = async () => {
  if (!ea.targetView) return;
  let sel = getMindmapNodeFromSelection();
  if (!sel) return;
  sel = ea.getBoundTextElement(sel, true).sceneElement;
  if (!sel) return;
  let oldBindId, newBindId, finalElId;

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
    finalElId = newBindId = sel.id;
    const container = allElements.find((el) => el.id === containerId);
    ea.copyViewElementsToEAforEditing(arrowsToUpdate.concat(sel, container));
    const textEl = ea.getElement(sel.id);
    ea.addAppendUpdateCustomData(textEl.id, { isPinned: !!container.customData?.isPinned, mindmapOrder: container.customData?.mindmapOrder });
    textEl.containerId = null;
    textEl.boundElements = []; //not null because I will add bound arrows a bit further down
    ea.getElement(containerId).isDeleted = true;
  } else {
    ea.copyViewElementsToEAforEditing(arrowsToUpdate.concat(sel));
    const depth = getHierarchy(sel, allElements)?.depth || 0;

    oldBindId = sel.id;
    const rectId = (finalElId = newBindId = ea.addRect(
      sel.x - padding,
      sel.y - padding,
      sel.width + padding * 2,
      sel.height + padding * 2,
    ));
    const rect = ea.getElement(rectId);
    ea.addAppendUpdateCustomData(rectId, { isPinned: !!sel.customData?.isPinned, mindmapOrder: sel.customData?.mindmapOrder });
    rect.strokeColor = ea.getCM(sel.strokeColor).stringRGB();
    rect.strokeWidth = STROKE_WIDTHS[Math.min(depth, STROKE_WIDTHS.length - 1)];
    rect.roughness = getAppState().currentItemRoughness;
    rect.roundness = roundedCorners ? { type: 3 } : null;
    rect.backgroundColor = "transparent";

    const textEl = ea.getElement(sel.id);
    textEl.containerId = rectId;
    textEl.boundElements = null;
    rect.boundElements = [{ type: "text", id: sel.id }];
    rect.groupIds = sel.groupIds ? [...sel.groupIds] : [];
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

  ea.getElement(oldBindId).boundElements = [];
  delete ea.getElement(oldBindId).customData;

  await addElementsToView();

  if (!hasContainer) {
    const textElement = ea.getViewElements().find((el) => el.id === sel.id);
    const idx = ea.getViewElements().indexOf(textElement);
    ea.moveViewElementToZIndex(textElement.containerId, idx);
  }

  if (!hasContainer) {
    api().updateContainerSize([ea.getViewElements().find((el) => el.id === newBindId)]);
  }
  ea.selectElementsInView([finalElId]);
  if(!autoLayoutDisabled) await refreshMapLayout();
  updateUI();
};

/**
 * Toggles a visual boundary polygon around the selected node's subtree.
 */
const toggleBoundary = async () => {
  if (!ea.targetView) return;
  const sel = getMindmapNodeFromSelection();
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
  updateUI();
};

// ---------------------------------------------------------------------------
// 7. UI Modal & Sidepanel Logic
// ---------------------------------------------------------------------------

let detailsEl, inputEl, inputRow, bodyContainer, strategyDropdown;
let autoLayoutToggle, linkSuggester, arrowTypeToggle;
let fontSizeDropdown, boxToggle, roundToggle, strokeToggle;
let colorToggle, widthSlider, centerToggle;
let pinBtn, refreshBtn, cutBtn, copyBtn, boxBtn, dockBtn, editBtn;
let toggleGroupBtn, zoomBtn, focusBtn, boundaryBtn;
let foldBtnL0, foldBtnL1, foldBtnAll;
let floatingGroupBtn, floatingBoxBtn, floatingZoomBtn;
let panelExpandBtn, importOutlineBtn;
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
  if (!window.MindmapBuilder) return; //Mindmap Builder has closed
  if (!window.MindmapBuilder.keydownHandlers) {
    window.MindmapBuilder.keydownHandlers = [];
  }
  host.addEventListener("keydown", handler, true);
  window.MindmapBuilder.keydownHandlers.push(()=>host.removeEventListener("keydown", handler, true))
};

const registerObsidianHotkeyOverrides = () => {
  window.MindmapBuilder?.popObsidianHotkeyScope?.();
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
    if (!window.MindmapBuilder?.popObsidianHotkeyScope) registerObsidianHotkeyOverrides();
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
  setButtonDisabled(importOutlineBtn, true);
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
  sel = sel ?? getMindmapNodeFromSelection();

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
    const nodeText = getTextFromNode(all, sel, true, false);
    const isLinkedFile = !!getNodeMarkdownFile(nodeText);

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
    setButtonDisabled(importOutlineBtn, !isLinkedFile);

    // NEW: Load settings from root customData if they exist, otherwise keep current global
    const cd = root.customData;
    
    const mapStrategy = cd?.growthMode;
    if (typeof mapStrategy === "string" && mapStrategy !== currentModalGrowthMode && GROWTH_TYPES.includes(mapStrategy)) {
      currentModalGrowthMode = mapStrategy;
      if (strategyDropdown) strategyDropdown.setValue(mapStrategy);
    }

    const mapLayoutPref = cd?.autoLayoutDisabled === true;
    if (mapLayoutPref !== autoLayoutDisabled) {
      autoLayoutDisabled = mapLayoutPref;
      if (autoLayoutToggle) autoLayoutToggle.setValue(mapLayoutPref);
    }

    const mapArrowType = cd?.arrowType;
    if (typeof mapArrowType === "string" && mapArrowType !== arrowType && ARROW_TYPES.includes(mapArrowType)) {
      arrowType = mapArrowType;
      if (arrowTypeToggle) arrowTypeToggle.setValue(arrowType === "curved");
    }

    if (cd?.fontsizeScale && cd.fontsizeScale !== fontsizeScale) {
        fontsizeScale = cd.fontsizeScale;
        if (fontSizeDropdown) fontSizeDropdown.setValue(fontsizeScale);
    }

    if (typeof cd?.multicolor === "boolean" && cd.multicolor !== multicolor) {
        multicolor = cd.multicolor;
        if (colorToggle) colorToggle.setValue(multicolor);
    }

    if (typeof cd?.boxChildren === "boolean" && cd.boxChildren !== boxChildren) {
        boxChildren = cd.boxChildren;
        if (boxToggle) boxToggle.setValue(boxChildren);
    }

    if (typeof cd?.roundedCorners === "boolean" && cd.roundedCorners !== roundedCorners) {
        roundedCorners = cd.roundedCorners;
        if (roundToggle) roundToggle.setValue(roundedCorners);
    }

    if (typeof cd?.maxWrapWidth === "number" && cd.maxWrapWidth !== maxWidth) {
        maxWidth = cd.maxWrapWidth;
        if (widthSlider) {
          widthSlider.setValue(maxWidth);
          if (widthSlider.valLabelEl) widthSlider.valLabelEl.setText(`${maxWidth}px`);
        }
    }

    if (typeof cd?.isSolidArrow === "boolean" && cd.isSolidArrow !== isSolidArrow) {
        isSolidArrow = cd.isSolidArrow;
        if (strokeToggle) strokeToggle.setValue(!isSolidArrow);
    }

    if (typeof cd?.centerText === "boolean" && cd.centerText !== centerText) {
        centerText = cd.centerText;
        if (centerToggle) centerToggle.setValue(centerText);
    }

  } else {
    disableUI();
  }
};

const startEditing = () => {
  const sel = getMindmapNodeFromSelection();
  if (!sel) return;
  const all = ea.getViewElements();
  const text = getTextFromNode(all, sel, true, true);
  if (text.match(/\n/)) {
    new Notice(`${t("NOTICE_CANNOT_EDIT_MULTILINE")} ${getActionHotkeyString(ACTION_REARRANGE)}`, 7000);
    return;
  }
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

  // Identify visual node (container or element) for positioning
  const visualNode = targetNode.containerId 
    ? all.find(el => el.id === targetNode.containerId) 
    : targetNode;

  // Identify text element within container
  let textElId = targetNode.id;
  if (targetNode.boundElements) {
    const boundText = targetNode.boundElements.find(be => be.type === "text");
    if (boundText) textElId = boundText.id;
  }
  const textEl = all.find(el => el.id === textElId && el.type === "text");
  const textInput = inputEl.value;
  const imageInfo = parseImageInput(textInput);
  const embeddableUrl = parseEmbeddableInput(textInput, imageInfo);

  let newType = "text";
  if (imageInfo?.isImagePath || imageInfo?.imageFile) newType = "image";
  else if (embeddableUrl) newType = "embeddable";

  // Check for type conversion (e.g. Text -> Image) or non-text update
  const isTypeChange = (textEl && newType !== "text") || (!textEl && newType !== targetNode.type);
  const isNonTextUpdate = !textEl && newType === targetNode.type;

  if (isTypeChange || isNonTextUpdate) {
    
    // 1. Calculate center position
    const cx = visualNode.x + visualNode.width / 2;
    const cy = visualNode.y + visualNode.height / 2;

    const info = getHierarchy(visualNode, all);
    const depth = info.depth;
    
    let newNodeId;

    // 2. Create new element based on type
    // store/restore strokeColor (even if element type doesn't normally have a stroke color)
    const st = getAppState();
    ea.style.strokeColor = targetNode.strokeColor ?? st.currentItemStrokeColor;
    if (newType === "image") {
      if (imageInfo?.isImagePath) {
        newNodeId = await addImage({
          pathOrFile: imageInfo.path,
          width: imageInfo.width,
          depth,
        });
      } else {
        newNodeId = await addImage({
          pathOrFile: imageInfo.imageFile,
          width: imageInfo.width,
          depth,
        });
      }
      const el = ea.getElement(newNodeId);
      el.x = cx - el.width / 2;
      el.y = cy - el.height / 2;
    } else if (newType === "embeddable") {
      newNodeId = addEmbeddableNode({ url:embeddableUrl, depth });
      const el = ea.getElement(newNodeId);
      el.x = cx - el.width / 2;
      el.y = cy - el.height / 2;
    } else {
      // Back to Text
      if (ea.style.strokeColor === "transparent") ea.style.strokeColor = "black";
      ea.style.fontFamily = st.currentItemFontFamily;
      const fontScale = getFontScale(fontsizeScale);
      ea.style.fontSize = fontScale[Math.min(depth, fontScale.length - 1)]; 
      ea.style.backgroundColor = "transparent";
      ea.style.strokeWidth = STROKE_WIDTHS[Math.min(depth, STROKE_WIDTHS.length - 1)];
      const incomingArrow = all.find (el => 
        el.type === "arrow" && visualNode.id === el.endBinding?.elementId);
      if (incomingArrow) {
        ea.style.strokeColor = incomingArrow.strokeColor;
      }
      ea.style.roughness = getAppState().currentItemRoughness;
      newNodeId = ea.addText(cx, cy, textInput, {
          textAlign: "center",
          textVerticalAlign: "middle",
          box: boxChildren ? "rectangle" : false
      });
    }

    const newNode = ea.getElement(newNodeId);

    // Scale decorations before deleting the old visual node
    scaleDecorations(visualNode, newNode, all);

    // 3. Migrate custom data fields
    const keysToCopy = [
      "mindmapOrder", "isPinned", "growthMode", "autoLayoutDisabled", 
      "isFolded", "foldIndicatorId", "foldState", "boundaryId",
      "fontsizeScale", "multicolor", "boxChildren", "roundedCorners", 
      "maxWrapWidth", "isSolidArrow", "centerText", "arrowType"
    ];
    const dataToCopy = {};
    keysToCopy.forEach(k => {
      if (visualNode.customData && visualNode.customData.hasOwnProperty(k)) {
        dataToCopy[k] = visualNode.customData[k];
      }
    });
    ea.addAppendUpdateCustomData(newNodeId, dataToCopy);

    // 4. Migrate Decorations
    if (visualNode.groupIds && visualNode.groupIds.length > 0) {
      newNode.groupIds = [...visualNode.groupIds];
    }

    // 5. Rewire arrows and adjust cross-links
    const idsToReplace = [visualNode.id];
    if (textEl) idsToReplace.push(textEl.id);

    const connectedArrows = all.filter(el => 
      el.type === "arrow" && 
      (idsToReplace.includes(el.startBinding?.elementId) || idsToReplace.includes(el.endBinding?.elementId))
    );

    if (connectedArrows.length > 0) {
      ea.copyViewElementsToEAforEditing(connectedArrows);
      const newBoundElements = [];
      
      connectedArrows.forEach(arrow => {
        const eaArrow = ea.getElement(arrow.id);
        let isConnected = false;
        
        // Calculate scale ratios for updating manual arrow points
        const ratioX = visualNode.width > 1 ? newNode.width / visualNode.width : 1;
        const ratioY = visualNode.height > 1 ? newNode.height / visualNode.height : 1;

        if (idsToReplace.includes(eaArrow.startBinding?.elementId)) {
          eaArrow.startBinding = { ...eaArrow.startBinding, elementId: newNodeId };
          isConnected = true;
          // Scale start point relative to center
          if (eaArrow.points.length > 0) {
            const absX = arrow.x + arrow.points[0][0];
            const absY = arrow.y + arrow.points[0][1];
            const dx = absX - cx;
            const dy = absY - cy;
            const newAbsX = cx + dx * ratioX;
            const newAbsY = cy + dy * ratioY;
            // Shift whole arrow if start moves? No, just the point relative to arrow.x
            // But dragging start point changes arrow.x/y usually. 
            // Simplest: Shift arrow.x/y, adjust all points back? 
            // Or just adjust points[0].
            eaArrow.points[0] = [eaArrow.points[0][0] + (newAbsX - absX), eaArrow.points[0][1] + (newAbsY - absY)];
          }
        }
        
        if (idsToReplace.includes(eaArrow.endBinding?.elementId)) {
          eaArrow.endBinding = { ...eaArrow.endBinding, elementId: newNodeId };
          isConnected = true;
          // Scale end point relative to center
          if (eaArrow.points.length > 0) {
            const lastIdx = eaArrow.points.length - 1;
            const absX = arrow.x + arrow.points[lastIdx][0];
            const absY = arrow.y + arrow.points[lastIdx][1];
            const dx = absX - cx;
            const dy = absY - cy;
            const newAbsX = cx + dx * ratioX;
            const newAbsY = cy + dy * ratioY;
            eaArrow.points[lastIdx] = [eaArrow.points[lastIdx][0] + (newAbsX - absX), eaArrow.points[lastIdx][1] + (newAbsY - absY)];
          }
        }
        
        if (isConnected) {
            newBoundElements.push({ type: "arrow", id: arrow.id });
        }
      });
      
      if (newBoundElements.length > 0) {
        newNode.boundElements = [...(newNode.boundElements || []), ...newBoundElements];
      }
    }

    // 6. Remove old elements
    ea.copyViewElementsToEAforEditing([visualNode]);
    ea.getElement(visualNode.id).isDeleted = true;
    if (textEl && textEl.id !== visualNode.id) {
       ea.copyViewElementsToEAforEditing([textEl]);
       ea.getElement(textEl.id).isDeleted = true;
    }

    await addElementsToView({
      shouldSleep: isTypeChange && (newType === "image"), //sleep if loading image
    });
    
    // Trigger global layout if enabled
    if (!autoLayoutDisabled) {
      const newViewElements = ea.getViewElements();
      const newViewNode = newViewElements.find(el => el.id === newNodeId);
      if(newViewNode) {
        ea.selectElementsInView([newViewNode]);
        const newInfo = getHierarchy(newViewNode, newViewElements);
        await triggerGlobalLayout(newInfo.rootId, false, true);
      }
    }

  } else if (textEl) {
    // Normal text update...
    ea.copyViewElementsToEAforEditing([textEl]);
    const eaEl = ea.getElement(textEl.id);
    eaEl.originalText = textInput;
    eaEl.rawText = textInput;
    ea.style.fontFamily = eaEl.fontFamily;
    ea.style.fontSize = eaEl.fontSize;

    if (eaEl.width <= maxWidth) {
      const textWidth = ea.measureText(renderLinksToText(textInput)).width;
      const shouldWrap = textWidth > maxWidth;
      if (!shouldWrap) {
        eaEl.autoResize = true;
        eaEl.width = Math.ceil(textWidth);
      } else {
        eaEl.autoResize = false;
        const res = getAdjustedMaxWidth(textInput, maxWidth);
        eaEl.width = res.width;
        eaEl.text = res.wrappedText;
      }
    }

    ea.refreshTextElementSize(eaEl.id);

    await addElementsToView({shouldSleep: true}); //in case text was changed to image

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

    /* --- Global Toggles --- */
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

      /* --- Color List --- */
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

    // Group keys by section
    const groupedKeys = {};
    Object.keys(LAYOUT_METADATA).forEach(key => {
      const section = LAYOUT_METADATA[key].section;
      if (!groupedKeys[section]) groupedKeys[section] = [];
      groupedKeys[section].push(key);
    });

    const renderSection = (sectionKey, title) => {
      if (!groupedKeys[sectionKey]) return;
      
      const details = container.createEl("details", { attr: { open: true } });
      details.style.marginBottom = "10px";
      details.style.border = "1px solid var(--background-modifier-border)";
      details.style.borderRadius = "5px";
      
      const summary = details.createEl("summary");
      summary.style.padding = "10px";
      summary.style.fontWeight = "bold";
      summary.style.cursor = "pointer";
      summary.style.backgroundColor = "var(--background-secondary)";
      summary.innerText = title;

      const content = details.createDiv();
      content.style.padding = "10px";

      groupedKeys[sectionKey].forEach(key => {
        const meta = LAYOUT_METADATA[key];
        const setting = new ea.obsidian.Setting(content)
          .setName(meta.name)
          .setDesc(meta.desc);

        let valLabel;
        setting.addSlider(slider => slider
          .setLimits(meta.min, meta.max, meta.step)
          .setValue(this.settings[key])
          .onChange(value => {
            this.settings[key] = value;
            valLabel.setText(String(value.toFixed(meta.step < 1 ? 1 : 0)));
          })
        );

        setting.settingEl.createDiv("", el => {
          valLabel = el;
          el.style.minWidth = "3em";
          el.style.textAlign = "right";
          el.innerText = String(this.settings[key].toFixed(meta.step < 1 ? 1 : 0));
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
    };

    // Render Sections in Order
    renderSection("SECTION_GENERAL", t("SECTION_GENERAL"));
    renderSection("SECTION_RADIAL", t("SECTION_RADIAL"));
    renderSection("SECTION_DIRECTIONAL", t("SECTION_DIRECTIONAL"));
    renderSection("SECTION_VISUALS", t("SECTION_VISUALS"));
    renderSection("SECTION_MANUAL", t("SECTION_MANUAL"));

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
  importOutlineBtn = null;

  inputRow = new ea.obsidian.Setting(container);
  let secondaryButtonContainer = null;

  if (!isFloating) {
    inputRow.settingEl.style.display = "block";
    inputRow.controlEl.style.display = "block";
    inputRow.controlEl.style.width = "100%";
    inputRow.controlEl.style.marginTop = "8px";
  } else {
    container.style.width = "70vw";
    container.style.maxWidth = "450px";
    inputRow.settingEl.style.border = "none";
    inputRow.settingEl.style.padding = "0";
    inputRow.infoEl.style.display = "none";

    // Expandable container for floating mode
    secondaryButtonContainer = container.createDiv();
    secondaryButtonContainer.style.display = isFloatingPanelExpanded ? "flex" : "none";
    secondaryButtonContainer.style.justifyContent = "flex-end";
    secondaryButtonContainer.style.flexWrap = "wrap";
    secondaryButtonContainer.style.gap = "0px";
    secondaryButtonContainer.style.marginTop = "6px";
    secondaryButtonContainer.style.flexWrap = "wrap";
  }

  inputRow.addText((text) => {
    inputEl = text.inputEl;
    linkSuggester = ea.attachInlineLinkSuggester(inputEl, inputRow.settingEl);
    inputEl.style.width = "100%";
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
      window.MindmapBuilder?.popObsidianHotkeyScope?.();
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
    btn.onClick(() => performAction(ACTION_EDIT));
  }, false);

  addButton((btn) => {
    pinBtn = btn;
    btn.setTooltip(`${t("TOOLTIP_PIN_INIT")} ${getActionHotkeyString(ACTION_PIN)}`)
    btn.extraSettingsEl.setAttr("action",ACTION_PIN);
    btn.onClick(() => performAction(ACTION_PIN));
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
      btn.onClick(() => performAction(ACTION_TOGGLE_FLOATING_EXTRAS));
    }, false);

    addButton((btn) => {
      floatingGroupBtn = btn;
      btn.setIcon("group");
      btn.extraSettingsEl.setAttr("action", ACTION_TOGGLE_GROUP);
      btn.onClick(() => performAction(ACTION_TOGGLE_GROUP));
    }, true);

    addButton((btn) => {
      floatingBoxBtn = btn;
      btn.setIcon("rectangle-horizontal");
      btn.setTooltip(`${t("TOOLTIP_TOGGLE_BOX")} ${getActionHotkeyString(ACTION_BOX)}`);
      btn.extraSettingsEl.setAttr("action", ACTION_BOX);
      btn.onClick(() => performAction(ACTION_BOX));
    }, true);

    addButton((btn) => {
      floatingZoomBtn = btn;
      btn.setIcon("scan-search");
      btn.setTooltip(`${t("TOOLTIP_ZOOM_CYCLE")} ${getActionHotkeyString(ACTION_ZOOM)}`);
      btn.extraSettingsEl.setAttr("action", ACTION_ZOOM);
      btn.onClick(() => performAction(ACTION_ZOOM));
    }, true);
  }

  addButton((btn) => {
    focusBtn = btn;
    btn.setIcon("scan-eye");
    btn.setTooltip(`${t("ACTION_LABEL_FOCUS")} ${getActionHotkeyString(ACTION_FOCUS)}`);
    btn.extraSettingsEl.setAttr("action", ACTION_FOCUS);
    btn.onClick(() => performAction(ACTION_FOCUS));
  }, true);

  addButton((btn) => {
    boundaryBtn = btn;
    btn.setIcon("cloud");
    btn.setTooltip(`${t("TOOLTIP_TOGGLE_BOUNDARY")} ${getActionHotkeyString(ACTION_TOGGLE_BOUNDARY)}`);
    btn.extraSettingsEl.setAttr("action", ACTION_TOGGLE_BOUNDARY);
    btn.onClick(() => performAction(ACTION_TOGGLE_BOUNDARY));
  }, true);

  addButton((btn) => {
    foldBtnL0 = btn;
    btn.setIcon("wifi-low");
    btn.setTooltip(`${t("TOOLTIP_FOLD_BRANCH")} ${getActionHotkeyString(ACTION_FOLD)}`);
    btn.extraSettingsEl.setAttr("action", ACTION_FOLD);
    btn.onClick(() => performAction(ACTION_FOLD));
  }, true);

  addButton((btn) => {
    foldBtnL1 = btn;
    btn.setIcon("wifi-high");
    btn.setTooltip(`${t("TOOLTIP_FOLD_L1_BRANCH")} ${getActionHotkeyString(ACTION_FOLD_L1)}`);
    btn.extraSettingsEl.setAttr("action", ACTION_FOLD_L1);
    btn.onClick(() => performAction(ACTION_FOLD_L1));
  }, true);

  addButton((btn) => {
    foldBtnAll = btn;
    btn.setIcon("wifi");
    btn.setTooltip(`${t("TOOLTIP_UNFOLD_BRANCH_ALL")} ${getActionHotkeyString(ACTION_FOLD_ALL)}`);
    btn.extraSettingsEl.setAttr("action", ACTION_FOLD_ALL);
    btn.onClick(() => performAction(ACTION_FOLD_ALL));
  }, true);

  addButton((btn) => {
    refreshBtn = btn;
    btn.setIcon("refresh-ccw");
    btn.setTooltip(t("TOOLTIP_REFRESH"));
    btn.extraSettingsEl.setAttr("action",ACTION_REARRANGE);
    btn.onClick(() => performAction(ACTION_REARRANGE));
  }, true);

  addButton((btn) => {
    copyBtn = btn;
    btn.setIcon("copy");
    btn.setTooltip(`${t("ACTION_COPY")} ${getActionHotkeyString(ACTION_COPY)}`);
    btn.extraSettingsEl.setAttr("action", ACTION_COPY);
    btn.onClick(() => performAction(ACTION_COPY));
  }, true);

  addButton((btn) => {
    cutBtn = btn;
    btn.setIcon("scissors");
    btn.setTooltip(`${t("ACTION_CUT")} ${getActionHotkeyString(ACTION_CUT)}`);
    btn.extraSettingsEl.setAttr("action", ACTION_CUT);
    btn.onClick(() => performAction(ACTION_CUT));
  }, true);

  addButton((btn) => {
    btn.setIcon("clipboard");
    btn.setTooltip(`${t("ACTION_PASTE")} ${getActionHotkeyString(ACTION_PASTE)}`);
    btn.extraSettingsEl.setAttr("action", ACTION_PASTE);
    btn.onClick(() => performAction(ACTION_PASTE));
  }, true);

  addButton((btn) => {
    importOutlineBtn = btn;
    btn.setIcon("list-tree");
    btn.setTooltip(`${t("TOOLTIP_IMPORT_OUTLINE")} ${getActionHotkeyString(ACTION_IMPORT_OUTLINE)}`);
    btn.extraSettingsEl.setAttr("action", ACTION_IMPORT_OUTLINE);
    btn.onClick(() => performAction(ACTION_IMPORT_OUTLINE));
  }, true);

  addButton((btn) => {
    dockBtn = btn;
    btn.setIcon(isFloating ? "dock" : "external-link");
    btn.extraSettingsEl.setAttr("action",ACTION_DOCK_UNDOCK);
    btn.setTooltip(
      `${isFloating ? t("TOOLTIP_DOCK") : t("TOOLTIP_UNDOCK")} ${getActionHotkeyString(ACTION_DOCK_UNDOCK)}`
    );
    btn.onClick(() => performAction(ACTION_DOCK_UNDOCK));
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
      .onClick(() => performAction(ACTION_ZOOM));
  });

  new ea.obsidian.Setting(bodyContainer).setName(t("LABEL_GROWTH_STRATEGY")).addDropdown((d) => {
    strategyDropdown = d;
    GROWTH_TYPES.forEach((key) => d.addOption(key, key));
    d.setValue(currentModalGrowthMode);
    d.onChange(async (v) => {
      currentModalGrowthMode = v;
      setVal(K_GROWTH, v);
      dirty = true;
      if (!ea.targetView) return;
      const sel = getMindmapNodeFromSelection();
      if (!sel) return;
      const info = getHierarchy(sel, ea.getViewElements());
      if (!!info && !autoLayoutDisabled) {
        triggerGlobalLayout(info.rootId);
      } else {
        await updateRootNodeCustomData({ growthMode: v });
      }
    });
  });

  new ea.obsidian.Setting(bodyContainer)
    .setName(t("LABEL_ARROW_TYPE"))
    .addToggle((t) => {
      arrowTypeToggle = t;
      t.setValue(arrowType === "curved")
       .onChange(async (v) => {
        arrowType = v ? "curved" : "straight";
        setVal(K_ARROW_TYPE, arrowType);
        dirty = true;
        if (!ea.targetView) return;
        await updateRootNodeCustomData({ arrowType });
        refreshMapLayout();
      })
    })

  autoLayoutToggle = new ea.obsidian.Setting(bodyContainer)
    .setName(t("LABEL_AUTO_LAYOUT"))
    .addToggle((t) => t
      .setValue(!autoLayoutDisabled)
      .onChange((v) => {
        autoLayoutDisabled = !v;
        updateRootNodeCustomData({ autoLayoutDisabled: enabled });
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
          if(!autoLayoutDisabled) refreshMapLayout();
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
      const sel = getMindmapNodeFromSelection() || ea.getViewElements().find(el => !getParentNode(el.id, ea.getViewElements()));
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
      btn.onClick(() => performAction(ACTION_TOGGLE_GROUP));
    });

  new ea.obsidian.Setting(bodyContainer)
    .setName(t("LABEL_BOX_CHILD_NODES"))
    .addToggle((t) => {
      boxToggle = t;
      t.setValue(boxChildren)
      .onChange((v) => {
        boxChildren = v;
        setVal(K_BOX, v);
        dirty = true;
        updateRootNodeCustomData({ boxChildren: v });
      })
    })
    .addButton((btn) => {
      boxBtn = btn;
      btn.setIcon("rectangle-horizontal");
      btn.setTooltip(`${t("TOOLTIP_TOGGLE_BOX")} ${getActionHotkeyString(ACTION_BOX)}`);
      btn.onClick(() => performAction(ACTION_BOX));
    });

  new ea.obsidian.Setting(bodyContainer).setName(t("LABEL_ROUNDED_CORNERS")).addToggle((t) => {
    roundToggle = t;
    t.setValue(roundedCorners)
    .onChange((v) => {
      roundedCorners = v;
      setVal(K_ROUND,  v);
      dirty = true;
      updateRootNodeCustomData({ roundedCorners: v });
    })
  });

  new ea.obsidian.Setting(bodyContainer)
    .setName(t("LABEL_USE_SCENE_STROKE"))
    .setDesc(
      t("DESC_USE_SCENE_STROKE"),
    )
    .addToggle((t) => {
      strokeToggle = t;
      t.setValue(!isSolidArrow).onChange((v) => {
        isSolidArrow = !v;
        setVal(K_ARROWSTROKE,  !v);
        dirty = true;
        updateRootNodeCustomData({ isSolidArrow: !v });
      })
    });

  new ea.obsidian.Setting(bodyContainer)
    .setName(t("LABEL_MULTICOLOR_BRANCHES"))
    .addToggle((t) => {
      colorToggle = t;
      t.setValue(multicolor).onChange((v) => {
        multicolor = v;
        setVal(K_MULTICOLOR, v);
        dirty = true;
        updateRootNodeCustomData({ multicolor: v });
      })
    })
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
  const sliderSetting = new ea.obsidian.Setting(bodyContainer).setName(t("LABEL_MAX_WRAP_WIDTH")).addSlider((s) => {
    widthSlider = s;
    s.setLimits(WRAP_WIDTH_MIN, WRAP_WIDTH_MAX, WRAP_WIDTH_STEP)
    .setValue(maxWidth)
    .onChange((v) => {
      maxWidth = v;
      sliderValDisplay.setText(`${v}px`);
      setVal(K_WIDTH, v);
      dirty = true;
      updateRootNodeCustomData({ maxWrapWidth: v });
    })
  });
  sliderValDisplay = sliderSetting.descEl.createSpan({
    text: `${maxWidth}px`,
    attr: { style: "margin-left:10px; font-weight:bold;" },
  });

  if(widthSlider) widthSlider.valLabelEl = sliderValDisplay;

  new ea.obsidian.Setting(bodyContainer)
    .setName(t("LABEL_CENTER_TEXT"))
    .setDesc(t("DESC_CENTER_TEXT"))
    .addToggle((t) => {
      centerToggle = t; // NEW: Capture UI
      t.setValue(centerText)
      .onChange((v) => {
        centerText = v;
        setVal(K_CENTERTEXT, v);
        dirty = true;
        updateRootNodeCustomData({ centerText: v }); // NEW: Update root
      })
    });

  new ea.obsidian.Setting(bodyContainer).setName(t("LABEL_FONT_SIZES")).addDropdown((d) => {
    fontSizeDropdown = d; // NEW: Capture UI
    FONT_SCALE_TYPES.forEach((key) => d.addOption(key, key));
    d.setValue(fontsizeScale);
    d.onChange((v) => {
      fontsizeScale = v;
      setVal(K_FONTSIZE, v);
      dirty = true;
      updateRootNodeCustomData({ fontsizeScale: v }); // NEW: Update root
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
    if (h.key === "Escape") {
      addBtn.style.opacity = 0;
      return;
    }
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
    ".modal.excalidraw-mindmap-ui {",
    " overflow: hidden;",
    " scrollbar-width: none;",
    "}",
    ".excalidraw-mindmap-ui button:focus-visible,",
    ".excalidraw-mindmap-ui .clickable-icon:focus-visible,",
    ".excalidraw-mindmap-ui [tabindex]:focus-visible {",
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

  // Check visibility if not silent
  if (!silent) {
    const isSidepanelVisible = ea.getSidepanelLeaf().isVisible();
    // Manage sidepanel visibility based on docking state
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

  // Update keyboard event routing
  updateKeyHandlerLocation();

  if (isUndocked) {
    // UNDOCK: Initialize floating modal
    floatingInputModal = new ea.FloatingModal(ea.plugin.app);
    const { contentEl, titleEl, modalEl, headerEl } = floatingInputModal;
    modalEl.classList.add("excalidraw-mindmap-ui");

    floatingInputModal.onOpen = () => {
      // Reparent modal to target view window
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
      window.MindmapBuilder?.popObsidianHotkeyScope?.();
      floatingInputModal = null;
      if (isUndocked) {
        // If closed manually (e.g. unexpected close), dock back silently
        isUndocked = false;
        setVal(K_UNDOCKED, false);
        updateKeyHandlerLocation(); // Restore listeners to sidepanel
        if (ea.sidepanelTab && inputContainer) renderInput(inputContainer, false);
      }
    };

    // Clear sidepanel input
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

/**
 * Resolves a keyboard event to a configured action depending on modifier keys and settings.
 * 
 * @param {KeyboardEvent} e - The keyboard event.
 * @returns {object} - { action, scope } or empty object if no match.
 */
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

/**
 * Main keydown handler.
 * Dispatches actions (add, edit, navigate, fold, etc.) based on hotkey settings.
 * 
 * @param {KeyboardEvent} e 
 */
const handleKeydown = (e) => {
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

  if (
    e.key === "Escape" && !isUndocked &&
    inputEl.ownerDocument.activeElement !== inputEl
  ) {
    return;
  }

  let {action, scope} = getActionFromEvent(e);
  let context = getHotkeyContext();

  // Local Tab handling for floating modal to keep focus cycling inside
  if (!action && isUndocked && floatingInputModal && e.key === "Tab") {
    const modalEl = floatingInputModal.modalEl;
    if (!modalEl) return;
    const activeEl = modalEl.ownerDocument.activeElement;
    if (!modalEl.contains(activeEl)) return;
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

  performAction(action, e);
}

const addSibling = async (event, insertAfter=true) => {
  if (!inputEl.value) return;
  const dir = insertAfter ? 1 : -1;
  const allElementsForSibling = ea.getViewElements();
  const selectedForSibling = getMindmapNodeFromSelection();
  
  if (!selectedForSibling) {
    await addNode(inputEl.value, true);
  } else {
    const info = getHierarchy(selectedForSibling, allElementsForSibling);
    const root = allElementsForSibling.find(el => el.id === info.rootId);
    const parentOfSelected = getParentNode(selectedForSibling.id, allElementsForSibling);
    
    // If parent exists, add to that parent (Sibling). 
    // If no parent (Root was selected), add to selected (Child).
    const targetParent = parentOfSelected ?? selectedForSibling;
    
    // Default position: slightly lower to ensure correct Y-sort order in directional maps
    let pos = {
      x: selectedForSibling.x,
      y: selectedForSibling.y + (insertAfter ? selectedForSibling.height : 0) + dir,
    };

    // Specific logic for Radial L1 nodes:
    // Position must be calculated via angle offset because triggerGlobalLayout sorts 
    // L1 nodes in Radial maps clockwise by angle, not by Y-coordinate.
    if (parentOfSelected && parentOfSelected.id === root.id && root.customData?.growthMode === "Radial") {
      const rb = getNodeBox(root, allElementsForSibling);
      const rc = { x: rb.minX + rb.width / 2, y: rb.minY + rb.height / 2 };
      const sc = { x: selectedForSibling.x + selectedForSibling.width / 2, y: selectedForSibling.y + selectedForSibling.height / 2 };
      
      // Calculate the current angle and distance, then increment angle slightly (~5.7 degrees)
      const angle = Math.atan2(sc.y - rc.y, sc.x - rc.x) + dir*0.2;
      const dist = Math.hypot(sc.x - rc.x, sc.y - rc.y);
      
      pos = {
        x: rc.x + Math.cos(angle) * dist - selectedForSibling.width / 2,
        y: rc.y + Math.sin(angle) * dist - selectedForSibling.height / 2
      };
    }

    ea.selectElementsInView([targetParent]);
    await addNode(inputEl.value, false, false, null, null, pos);
  }
  inputEl.value = "";
  updateUI();
  await performAction(ACTION_ADD, event); // Move selection to new node
}

const performAction = async (action, event) => {
  if (!action || !ea.targetView) return;
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
      break;

    case ACTION_BOX:
      await toggleBox();
      break;

    case ACTION_TOGGLE_BOUNDARY:
      await toggleBoundary();
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
      updateUI();
      break;

    case ACTION_PASTE:
      pasteListToMap();
      updateUI();
      break;

    case ACTION_IMPORT_OUTLINE:
      await importOutline();
      updateUI();
      break;

    case ACTION_ZOOM:
      zoomToFit(true);
      break;

    case ACTION_FOCUS:
      focusSelected();
      break;

    case ACTION_SORT_ORDER:
      changeNodeOrder(event?.key);
      updateUI();
      break;

    case ACTION_NAVIGATE:
      await navigateMap({key: event?.key, zoom: false, focus: false});
      updateUI();
      break;

    case ACTION_NAVIGATE_ZOOM:
      await navigateMap({key: event?.key, zoom: true, focus: false});
      updateUI();
      break;

    case ACTION_NAVIGATE_FOCUS:
      await navigateMap({key: event?.key, zoom: false, focus: true});
      updateUI();
      break;

    case ACTION_DOCK_UNDOCK:
      toggleDock({saveSetting: true});
      break;

    case ACTION_EDIT:
      startEditing();
      break;

    case ACTION_ADD_SIBLING_AFTER:
      addSibling(event, true);
      break;

    case ACTION_ADD_SIBLING_BEFORE:
      addSibling(event, false);
      break;

    case ACTION_ADD_FOLLOW:
    case ACTION_ADD_FOLLOW_FOCUS:
    case ACTION_ADD_FOLLOW_ZOOM:
      if (!inputEl.value) return;
      await addNode(inputEl.value, true);
      inputEl.value = "";
      updateUI();
      if (action === ACTION_ADD_FOLLOW_FOCUS) focusSelected();
      if (action === ACTION_ADD_FOLLOW_ZOOM) zoomToFit();
      break;
    case ACTION_ADD:
      const currentSel = getMindmapNodeFromSelection() ?? ea.getViewSelectedElement();
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
        } else {
          const sel = getMindmapNodeFromSelection();
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

/**
 * Throttled handler for canvas clicks (pointer down).
 * Updates the UI to reflect the new selection.
 * 
 * @param {PointerEvent} e 
 */
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

/* --- Initialization Logic --- */
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
      if (!window.MindmapBuilder?.popObsidianHotkeyScope) registerObsidianHotkeyOverrides();
    }
  };

  const setupEventListeners = (view) => {
    if (!view || !view.ownerWindow) return;
    window.MindmapBuilder?.removePointerDownHandler?.();
    const win = view.ownerWindow;

    win.addEventListener("pointerdown", handleCanvasPointerDown);
    window.MindmapBuilder.removePointerDownHandler = () => {
      if (win) win.removeEventListener("pointerdown", handleCanvasPointerDown);
      delete window.MindmapBuilder.removePointerDownHandler;
    }
    updateKeyHandlerLocation();
    
    if (!window.MindmapBuilder?.removeActiveLeafListener) {
      const leafChangeRef = app.workspace.on("active-leaf-change", onActiveLeafChange);
      window.MindmapBuilder.removeActiveLeafListener = () => {
        app.workspace.offref(leafChangeRef);
        delete window.MindmapBuilder.removeActiveLeafListener;
      };
    }
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

  tab.onClose = async () => {
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