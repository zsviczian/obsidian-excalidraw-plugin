/**
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
const VERSION = "test";

if (!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("2.21.0")) {
  new Notice("Please update the Excalidraw Plugin to version 2.21.0 or higher.");
  return;
}

ea.skipSidepanelScriptRestore();

const existingTab = ea.checkForActiveSidepanelTabForScript();
if (existingTab) {
  const hostEA = existingTab.getHostEA();
  if (hostEA && hostEA !== ea) {
    hostEA.activateMindmap = true;
    hostEA.setView(ea.targetView);
    existingTab.open(false); // I will handle revealing in 
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

const api = () => ea?.getExcalidrawAPI();
const getAppState = () => api()?.getAppState();
const isViewSet = () => ea.targetView && ea.targetView._loaded;

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
    NOTICE_SELECT_NODE_CONTAINING_LINK: "Select a node containing a link.",
    NOTICE_CANNOT_DEMOTE_NO_SIBLING_TO_ACCEPT: "Cannot demote: No sibling found to accept this node.",
    NOTICE_CANNOT_DEMOTE_NO_VALID_SIBLING: "Cannot demote: No valid sibling to attach to.",
    NOTICE_CANNOT_DEMOTE_CROSS_SIDE_NOT_ALLOWED: "Cannot demote: Cross-side demotion is not allowed.",
    NOTICE_CANNOT_MOVE_AUTO_LAYOUT_DISABLED: "Cannot move nodes when Auto-Layout is disabled. Enable Auto-Layout first.",
    NOTICE_BRANCH_WIDTH_MANUAL_OVERRIDE: "Branch width were not updated because some branch widths were manually modified.",
    NOTICE_CANNOT_CHANGE_MASTER_ROOT: "The master root cannot be converted.",
    NOTICE_SUBMAP_ROOT_ADDED: "Submap root enabled.",
    NOTICE_SUBMAP_ROOT_REMOVED: "Submap root removed. Children now follow the parent map layout.",
    CONFIRM_REMOVE_SUBMAP_ROOT: "Change this submap root back to a normal node?\n\nIt will lose its local layout metadata, and its children will be rearranged by the parent root's layout logic.",

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
    ACTION_LABEL_REARRANGE: "Rearrange Map",
    ACTION_LABEL_TOGGLE_SUBMAP_ROOT: "Start/End Submap Root",
    ACTION_LABEL_TOGGLE_CHECKBOX: "Toggle Checkbox Status",
    ACTION_LABEL_TOGGLE_EMBED: "Toggle Embed/Link",

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
    TOOLTIP_FOLD_ALL: "Fold/Unfold Branch Recursively",
    TOOLTIP_IMPORT_OUTLINE: "Import headings from linked file as child nodes",
    TOOLTIP_RESET_TO_DEFAULT: "Reset to default",
    TOOLTIP_SUBMAP_ROOT_ADD: "Start submap from selected node",
    TOOLTIP_SUBMAP_ROOT_REMOVE: "Convert submap root back to a normal node",
    TOOLTIP_TOGGLE_CHECKBOX: "Toggle task checkbox status",
    TOOLTIP_TOGGLE_EMBED: "Toggle node between Embed and Link",

    // Buttons and labels
    DOCK_TITLE: "Mind Map Builder",
    HELP_SUMMARY: "Help",
    INPUT_PLACEHOLDER: "Concept... type [[ to insert link",
    ONTOLOGY_PLACEHOLDER: "Ontology (Arrow Label)",
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
    LABEL_FILL_SWEEP: "Fill Sweep Angle",
    DESC_FILL_SWEEP: "Distribute nodes across the full Max Sweep Angle immediately, rather than growing the arc gradually as nodes are added.",
    LABEL_ARROW_TYPE: "Curved Connectors",
    LABEL_AUTO_LAYOUT: "Auto-Layout",
    LABEL_GROUP_BRANCHES: "Group Branches",
    LABEL_BOX_CHILD_NODES: "Box Child Nodes",
    LABEL_ROUNDED_CORNERS: "Rounded Corners",
    LABEL_USE_SCENE_STROKE: "Use scene stroke style",
    DESC_USE_SCENE_STROKE: "Use the latest stroke style (solid, dashed, dotted) from the scene, or always use solid style for branches.",
    LABEL_BRANCH_SCALE: "Branch Scale",
    LABEL_BASE_WIDTH: "Base Thickness",
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
    SECTION_VERTICAL: "Vertical Maps (Up/Down)",
    SECTION_VISUALS: "Visual Elements",
    SECTION_MANUAL: "Manual Mode Behavior",
    LAYOUT_RESET: "Reset All to Default",
    LAYOUT_SAVE: "Save & Close",
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
    GAP_X: "Gap X",
    DESC_LAYOUT_GAP_X: "Horizontal distance between parent and child nodes.",
    GAP_Y: "Gap Y",
    DESC_LAYOUT_GAP_Y: "Vertical distance between sibling nodes. Also used as the base gap for Radial layouts.",
    GAP_MULTIPLIER: "Gap Multiplier",
    DESC_LAYOUT_GAP_MULTIPLIER: "Vertical spacing for 'leaf' nodes (no children), relative to font size. Low: list-like stacking. High: standard tree spacing.",
    DIRECTIONAL_ARC_SPAN_RADIANS: "Directional Arc-span Radians",
    DESC_LAYOUT_ARC_SPAN: "Curvature of the child list. Low (0.5): Flatter, list-like. High (2.0): Curved, organic, but risk of overlap.",
    ROOT_RADIUS_FACTOR: "Root Radius Factor",
    DESC_LAYOUT_ROOT_RADIUS: "Multiplier for the Root node's bounding box to determine initial radius.",
    MIN_RADIUS: "Minimum Radius",
    DESC_LAYOUT_MIN_RADIUS: "The absolute minimum distance from the root center to the first level of nodes.",
    RADIUS_PADDING_PER_NODE: "Radius Padding per Node",
    DESC_LAYOUT_RADIUS_PADDING: "Extra radius added per child node to accommodate dense maps.",
    GAP_MULTIPLIER_RADIAL: "Radial-layout Gap Multiplier",
    DESC_LAYOUT_GAP_RADIAL: "Angular spacing multiplier for Radial mode.",
    GAP_MULTIPLIER_DIRECTIONAL: "Vertical-layout Gap Multiplier",
    DESC_LAYOUT_GAP_DIRECTIONAL: "Spacing multiplier for Right-facing and Left-facing top level branches",
    INDICATOR_OFFSET: "Fold Indicator Offset",
    DESC_LAYOUT_INDICATOR_OFFSET: "Distance of the '...' fold indicator from the node.",
    INDICATOR_OPACITY: "Fold Indicator Opacity",
    DESC_LAYOUT_INDICATOR_OPACITY: "Opacity of the '...' fold indicator (0-100).",
    CONTAINER_PADDING: "Container Padding",
    DESC_LAYOUT_CONTAINER_PADDING: "Padding inside the box when 'Box Child Nodes' or 'Box/Unbox' is used.",
    MAX_SEGMENT_LENGTH: "Boundary Line Precision",
    DESC_LAYOUT_BOUNDARY_LINE_PRECISION: "Boundary smoothing precision. Smaller values are more precise (30 = Precise), larger values are rougher (200 = Rough).",
    VERTICAL_SUBTREE_WIDTH_BLEND_SINGLE: "Subtree Width Blend (Single-sided)",
    DESC_VERTICAL_SUBTREE_WIDTH_BLEND_SINGLE: "How strongly one-sided submaps (Right-facing / Left-facing) reserve horizontal sibling space in vertical maps. High impact.",
    VERTICAL_SUBTREE_WIDTH_BLEND_DUAL: "Subtree Width Blend (Dual-sided)",
    DESC_VERTICAL_SUBTREE_WIDTH_BLEND_DUAL: "How strongly dual-sided submaps (Right-Left) reserve horizontal sibling space in vertical maps. High impact.",
    VERTICAL_SUBTREE_SMOOTH_THRESHOLD_MULTIPLIER: "Subtree Smooth Threshold Multiplier",
    DESC_VERTICAL_SUBTREE_SMOOTH_THRESHOLD_MULTIPLIER: "Starts smooth compression after this multiple of Gap Y to avoid spacing jumps when adding more children. Usually subtle unless the map is large.",
    VERTICAL_SUBTREE_SMOOTH_MIN_SCALE: "Subtree Smooth Minimum Scale",
    DESC_VERTICAL_SUBTREE_SMOOTH_MIN_SCALE: "Minimum compression scale used by the vertical subtree width smoother. Higher values preserve more width. Usually subtle unless the map is large.",
    HORIZONTAL_L1_SOFTCAP_THRESHOLD: "Horizontal L1 Soft Cap Threshold",
    DESC_HORIZONTAL_L1_SOFTCAP_THRESHOLD: "Soft cap (px) before Up/Down Level-1 subtree widths are compressed. Medium to high impact on large maps.",
    HORIZONTAL_L1_COMPRESSION_MIN_SCALE: "Horizontal L1 Compression Min Scale",
    DESC_HORIZONTAL_L1_COMPRESSION_MIN_SCALE: "Minimum compression scale for Up/Down Level-1 width compression. Higher values preserve more width. Medium impact after soft cap is reached.",
    VERTICAL_COMPACT_PARENT_CHILD_GAP_RATIO: "Compact Parent-Child Gap Ratio",
    DESC_VERTICAL_COMPACT_PARENT_CHILD_GAP_RATIO: "In compact vertical subtrees, uses this fraction of Gap X for parent-child distance. Very high visible impact.",
    DIRECTIONAL_CROSS_AXIS_RATIO: "Directional Cross-axis Ratio",
    DESC_DIRECTIONAL_CROSS_AXIS_RATIO: "Cross-axis radius ratio for directional arc layouts (0.2 = flatter arcs, 1.0 = rounder arcs). High visual impact on L1 spread.",
    MANUAL_GAP_MULTIPLIER: "Manual-layout Gap Multiplier",
    DESC_LAYOUT_MANUAL_GAP: "Spacing multiplier when adding nodes while Auto-Layout is disabled.",
    MANUAL_JITTER_RANGE: "Manual-layout Jitter Range",
    DESC_LAYOUT_MANUAL_JITTER: "Random position offset when adding nodes while Auto-Layout is disabled.",

    // Misc
    INPUT_TITLE_PASTE_ROOT: "Mindmap Builder Paste",
    INSTRUCTIONS: "> [!Tip]\n" +
      ">🚀 Become a MindMap Builder Pro with the Official [MindMap Builder Course](https://www.visual-thinking-workshop.com/mindmap)!\n" +
      "\n" +
      "- **ENTER**: Add a child node and stay on the current parent for rapid entry. " +
      "If you press enter when the input field is empty the focus will move to the child node that was most recently added. " +
      "Pressing enter subsequent times will iterate through the new child's siblings\n" +
      "- **Hotkeys**: See configuration at the bottom of the sidepanel\n" +
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

/**
 * @param {String} lang {@link LOCALE}
 * @param {Object} content
 */
function addLocale(lang, content) {
  STRINGS[lang] = content
};

addLocale("zh", {
  // Notices
  NOTICE_SELECT_NODE_TO_COPY: "请选择要复制的节点。",
  NOTICE_MAP_CUT: "导图已剪切到剪贴板。",
  NOTICE_BRANCH_CUT: "分支已剪切到剪贴板。",
  NOTICE_MAP_COPIED: "导图已复制为 Markdown 格式。",
  NOTICE_BRANCH_COPIED: "分支已复制为列表格式。",
  NOTICE_CLIPBOARD_EMPTY: "剪贴板为空。",
  NOTICE_PASTE_ABORTED: "粘贴中止。剪贴板内容非 Markdown 列表或标题。",
  NOTICE_NO_LIST: "剪贴板中未发现有效的 Markdown 列表。",
  NOTICE_PASTE_START: "正在粘贴，请稍候，可能需要一些时间…",
  NOTICE_PASTE_COMPLETE: "粘贴完成。",
  NOTICE_ACTION_REQUIRES_ARROWS: "此操作需要方向键。仅可修改修饰键。",
  NOTICE_CONFLICT_WITH_ACTION: "与“{action}”操作冲突",
  NOTICE_OBSIDIAN_HOTKEY_CONFLICT: "⚠️ Obsidian 热键冲突！\n\n此按键将覆盖：\n“{command}”",
  NOTICE_GLOBAL_HOTKEY_CONFLICT: "⚠️ 全局热键冲突！\n\n此按键将覆盖：\n“{command}”",
  NOTICE_NO_HEADINGS: "链接文件中未发现小标题。",
  NOTICE_CANNOT_EDIT_MULTILINE: "无法直接编辑多行节点。\n请在 Excalidraw 中双击元素进行编辑，然后运行“自动重排导图”来更新布局。",
  NOTICE_CANNOT_MOVE_PINNED: "无法移动已锁定的节点。请先解锁。",
  NOTICE_CANNOT_MOVE_ROOT: "无法移动根节点。",
  NOTICE_CANNOT_PRMOTE_L1: "无法提升 1 级节点。",
  NOTICE_CANNOT_DEMOTE: "无法降级节点。没有可依附的前置同级节点。",
  NOTICE_SELECT_NODE_CONTAINING_LINK: "请选择包含链接的节点。",
  NOTICE_CANNOT_DEMOTE_NO_SIBLING_TO_ACCEPT: "无法降级：未找到可接收此节点的同级节点。",
  NOTICE_CANNOT_DEMOTE_NO_VALID_SIBLING: "无法降级：没有可附加的有效同级节点。",
  NOTICE_CANNOT_DEMOTE_CROSS_SIDE_NOT_ALLOWED: "无法降级：不允许跨侧降级。",
  NOTICE_CANNOT_MOVE_AUTO_LAYOUT_DISABLED: "禁用自动布局时无法移动节点。请先启用自动布局。",
  NOTICE_BRANCH_WIDTH_MANUAL_OVERRIDE: "分支粗细未更新，因为部分分支粗细已被手动修改。",
  NOTICE_CANNOT_CHANGE_MASTER_ROOT: "主根节点不能被转换。",
  NOTICE_SUBMAP_ROOT_ADDED: "已启用子图根节点。",
  NOTICE_SUBMAP_ROOT_REMOVED: "已移除子图根节点。其子节点将按亲代根节点布局重排。",
  CONFIRM_REMOVE_SUBMAP_ROOT: "恢复为普通节点吗？\n\n它将失去本地布局元数据，其子节点将按亲代根节点布局重排。",

  // Action labels (display only)
  ACTION_LABEL_ADD: "添加子节点",
  ACTION_LABEL_ADD_SIBLING_AFTER: "添加后置同级节点",
  ACTION_LABEL_ADD_SIBLING_BEFORE: "添加前置同级节点",
  ACTION_LABEL_ADD_FOLLOW: "添加 + 跟随",
  ACTION_LABEL_ADD_FOLLOW_FOCUS: "添加 + 跟随 + 聚焦",
  ACTION_LABEL_ADD_FOLLOW_ZOOM: "添加 + 跟随 + 缩放",
  ACTION_LABEL_SORT_ORDER: "更改顺序/提升节点",
  ACTION_LABEL_EDIT: "编辑节点",
  ACTION_LABEL_PIN: "锁定/解锁",
  ACTION_LABEL_BOX: "添加/移除边框",
  ACTION_LABEL_TOGGLE_GROUP: "编组/解除编组单分支",
  ACTION_LABEL_COPY: "复制",
  ACTION_LABEL_CUT: "剪切",
  ACTION_LABEL_PASTE: "粘贴",
  ACTION_LABEL_IMPORT_OUTLINE: "导入大纲",
  ACTION_LABEL_ZOOM: "循环缩放",
  ACTION_LABEL_FOCUS: "聚焦（并居中）节点",
  ACTION_LABEL_NAVIGATE: "导航",
  ACTION_LABEL_NAVIGATE_ZOOM: "导航 & 缩放",
  ACTION_LABEL_NAVIGATE_FOCUS: "导航 & 聚焦",
  ACTION_LABEL_FOLD: "折叠/展开分支",
  ACTION_LABEL_FOLD_L1: "折叠/展开 L1 子节点",
  ACTION_LABEL_FOLD_ALL: "递归折叠/展开分支",
  ACTION_LABEL_DOCK_UNDOCK: "停靠/取消停靠",
  ACTION_LABEL_HIDE: "停靠 & 隐藏",
  ACTION_LABEL_REARRANGE: "重排导图",
  ACTION_LABEL_TOGGLE_SUBMAP_ROOT: "开始/结束子图根节点",
  ACTION_LABEL_TOGGLE_CHECKBOX: "切换复选框状态",
  ACTION_LABEL_TOGGLE_EMBED: "切换嵌入/链接",

  // Tooltips (shared)
  PIN_TOOLTIP_PINNED: "此元素已锁定。点击解锁所选元素的位置。",
  PIN_TOOLTIP_UNPINNED: "此元素未锁定。点击锁定所选元素的位置。",
  TOGGLE_GROUP_TOOLTIP_GROUP: "编组此分支。仅在“分支编组”禁用时可用。",
  TOGGLE_GROUP_TOOLTIP_UNGROUP: "解除编组此分支。仅在“分支编组”禁用时可用。",
  TOOLTIP_EDIT_NODE: "编辑所选节点的文本",
  TOOLTIP_PIN_INIT: "锁定/解锁节点位置。锁定的节点不会被自动重排。",
  TOOLTIP_REFRESH: "自动重排导图",
  TOOLTIP_DOCK: "停靠到侧边面板",
  TOOLTIP_UNDOCK: "转为浮动窗口",
  TOOLTIP_ZOOM_CYCLE: "循环切换元素缩放级别",
  TOOLTIP_TOGGLE_GROUP_BTN: "切换分支的编组状态。仅在“分支编组”禁用时可用。",
  TOOLTIP_TOGGLE_BOX: "切换节点边框",
  TOOLTIP_TOGGLE_BOUNDARY: "切换子树边界",
  TOOLTIP_TOGGLE_FLOATING_EXTRAS: "切换额外控件",
  TOOLTIP_CONFIGURE_PALETTE: "为分支配置自定义调色板",
  TOOLTIP_CONFIGURE_LAYOUT: "配置布局设置",
  TOOLTIP_MOVE_UP: "上移",
  TOOLTIP_MOVE_DOWN: "下移",
  TOOLTIP_EDIT_COLOR: "编辑",
  TOOLTIP_DELETE_COLOR: "删除",
  TOOLTIP_OPEN_PALETTE_PICKER: "打开颜色选择器",
  TOOLTIP_FOLD_BRANCH: "折叠/展开所选分支",
  TOOLTIP_FOLD_L1_BRANCH: "折叠/展开 L1 子节点",
  TOOLTIP_FOLD_ALL: "递归折叠/展开分支",
  TOOLTIP_IMPORT_OUTLINE: "从链接文件中导入小标题作为子节点数据",
  TOOLTIP_RESET_TO_DEFAULT: "恢复默认",
  TOOLTIP_SUBMAP_ROOT_ADD: "从所选节点开始子图",
  TOOLTIP_SUBMAP_ROOT_REMOVE: "将子图根节点恢复为普通节点",
  TOOLTIP_TOGGLE_CHECKBOX: "切换任务复选框状态",
  TOOLTIP_TOGGLE_EMBED: "在嵌入和链接之间切换节点",

  // Buttons and labels
  DOCK_TITLE: "MindMap Builder",
  HELP_SUMMARY: "帮助",
  INPUT_PLACEHOLDER: "输入概念… 输入 [[ 插入链接",
  ONTOLOGY_PLACEHOLDER: "本体（箭头标签）",
  BUTTON_COPY: "复制",
  BUTTON_CUT: "剪切",
  BUTTON_PASTE: "粘贴",
  TITLE_ADD_SIBLING: `使用 ${ea.DEVICE.isMacOS || ea.DEVICE.isIOS ? "OPT" : "ALT"}+Enter 添加同级节点`,
  TITLE_ADD_FOLLOW: "添加并跟随",
  TITLE_COPY: "复制分支为文本",
  TITLE_CUT: "剪切分支为文本",
  TITLE_PASTE: "从剪贴板粘贴列表",
  LABEL_ZOOM_LEVEL: "缩放级别",
  LABEL_GROWTH_STRATEGY: "生长策略",
  LABEL_FILL_SWEEP: "填充扫过角度",
  DESC_FILL_SWEEP: "立即在整个“最大扫过角度”范围内分布节点，而不是随着节点数量增加逐渐扩大弧度。",
  LABEL_ARROW_TYPE: "曲线连接",
  LABEL_AUTO_LAYOUT: "自动布局",
  LABEL_GROUP_BRANCHES: "分支编组",
  LABEL_BOX_CHILD_NODES: "为子节点添加边框",
  LABEL_ROUNDED_CORNERS: "圆角",
  LABEL_USE_SCENE_STROKE: "使用场景线条样式",
  DESC_USE_SCENE_STROKE: "使用场景中最新的线条样式（实线、虚线、点线），否则分支将始终使用实线。",
  LABEL_BRANCH_SCALE: "分支粗细比例",
  LABEL_BASE_WIDTH: "基础粗细",
  LABEL_MULTICOLOR_BRANCHES: "多色分支",
  LABEL_MAX_WRAP_WIDTH: "最大折行宽度",
  LABEL_CENTER_TEXT: "文本居中",
  DESC_CENTER_TEXT: "关闭：根据位置左/右对齐；开启：文本强制居中。",
  LABEL_FONT_SIZES: "字体大小",
  HOTKEY_SECTION_TITLE: "热键配置",
  HOTKEY_HINT: "这些热键可能覆盖 Obsidian 默认设置。热键作用域默认为局部（⌨️），使用 🌐/🎨/⌨️ 切换作用域：🌐 Excalidraw 标签页可见即生效，🎨 Excalidraw 聚焦时生效，⌨️ 输入框聚焦时生效。",
  RECORD_HOTKEY_PROMPT: "按下热键…",
  ARIA_SCOPE_INPUT: "局部（Local）：仅在输入框聚焦时生效",
  ARIA_SCOPE_EXCALIDRAW: "Excalidraw：输入框或 Excalidraw 聚焦时生效",
  ARIA_SCOPE_GLOBAL: "全局（Global）：在 Obsidian 任何位置，Excalidraw 可见即生效",
  ARIA_RESTORE_DEFAULT: "恢复默认",
  ARIA_CUSTOMIZE_HOTKEY: "自定义此热键",
  ARIA_OVERRIDE_COMMAND: "将覆盖 Obsidian 命令：\n{command}",

  // Palette manager
  MODAL_PALETTE_TITLE: "导图分支调色板",
  LABEL_ENABLE_CUSTOM_PALETTE: "启用自定义调色板",
  DESC_ENABLE_CUSTOM_PALETTE: "使用以下颜色代替自动生成的颜色。",
  LABEL_RANDOMIZE_ORDER: "随机顺序",
  DESC_RANDOMIZE_ORDER: "随机选择颜色而非按顺序选择。",
  HEADING_ADD_NEW_COLOR: "添加新颜色",
  HEADING_EDIT_COLOR: "编辑颜色",
  LABEL_SELECT_COLOR: "选择颜色",
  BUTTON_CANCEL_EDIT: "取消编辑",
  BUTTON_ADD_COLOR: "添加颜色",
  BUTTON_UPDATE_COLOR: "更新颜色",

  // Layout configuration
  MODAL_LAYOUT_TITLE: "布局配置",
  // Section Headers
  SECTION_GENERAL: "常规间距",
  SECTION_RADIAL: "径向布局（顺时针）",
  SECTION_DIRECTIONAL: "定向布局（左/右）",
  SECTION_VERTICAL: "垂直导图（上/下）",
  SECTION_VISUALS: "视觉元素",
  SECTION_MANUAL: "手动模式行为",
  LAYOUT_RESET: "重置所有为默认值",
  LAYOUT_SAVE: "保存并关闭",
  // Radial Strings
  RADIAL_ASPECT_RATIO: "椭圆长宽比",
  DESC_RADIAL_ASPECT_RATIO: "控制形状。< 1.0 为瘦长（0.7 为纵向），1.0 为正圆，> 1.0 为宽扁（横向）。",
  RADIAL_POLE_GAP_BONUS: "极点间距补偿",
  DESC_RADIAL_POLE_GAP_BONUS: "增加椭圆南北两极区域内节点的间距。值越大，节点沿弧线推得越远。",
  RADIAL_START_ANGLE: "起始角度",
  DESC_RADIAL_START_ANGLE: "第一个节点出现的位置（度数）。270 为北，0 为东，90 为南。",
  RADIAL_MAX_SWEEP: "最大扫过角度",
  DESC_RADIAL_MAX_SWEEP: "分支可填充的弧范围。360 为全圆。较小的值会使圆不完整。",
  // Others
  GAP_X: "水平间距（Gap X）",
  DESC_LAYOUT_GAP_X: "亲代节点与子节点之间的水平距离。",
  GAP_Y: "垂直间距（Gap Y）",
  DESC_LAYOUT_GAP_Y: "同级节点之间的垂直距离。径向布局中的基础间距。",
  GAP_MULTIPLIER: "间距倍数",
  DESC_LAYOUT_GAP_MULTIPLIER: "叶节点（无子节点的节点）相对于字体大小的垂直间距。低：类似列表堆叠；高：标准树状间距。",
  DIRECTIONAL_ARC_SPAN_RADIANS: "定向张开弧度（Arc-span Radians）",
  DESC_LAYOUT_ARC_SPAN: "子节点排列的曲率。低（0.5）：较平，类似列表。高（2.0）：弯曲有机，但有重叠风险。",
  ROOT_RADIUS_FACTOR: "根节点半径系数",
  DESC_LAYOUT_ROOT_RADIUS: "相对于根节点边框的倍数，决定最初的半径。",
  MIN_RADIUS: "最小半径",
  DESC_LAYOUT_MIN_RADIUS: "从根节点中心到第一级节点的最小绝对距离。",
  RADIUS_PADDING_PER_NODE: "单节点径向空白边距",
  DESC_LAYOUT_RADIUS_PADDING: "每个子节点额外增加的半径，以适应密集型导图。",
  GAP_MULTIPLIER_RADIAL: "径向布局间距倍数",
  DESC_LAYOUT_GAP_RADIAL: "径向布局模式下的角度间距倍数。",
  GAP_MULTIPLIER_DIRECTIONAL: "垂直方向间距倍数",
  DESC_LAYOUT_GAP_DIRECTIONAL: "定向布局顶层分支之间的间距倍数。",
  INDICATOR_OFFSET: "折叠指示符偏移",
  DESC_LAYOUT_INDICATOR_OFFSET: "折叠指示符（三连点）距离节点的距离。",
  INDICATOR_OPACITY: "折叠指示符不透明度",
  DESC_LAYOUT_INDICATOR_OPACITY: "折叠指示符的不透明度（0-100）。",
  CONTAINER_PADDING: "容器内边距",
  DESC_LAYOUT_CONTAINER_PADDING: "使用边框样式时的内边距。",
  MAX_SEGMENT_LENGTH: "边界线精度",
  DESC_LAYOUT_BOUNDARY_LINE_PRECISION: "边界平滑精度。值越小越精细（30 = 精细），值越大越粗略（200 = 粗略）。",
  VERTICAL_SUBTREE_WIDTH_BLEND_SINGLE: "子树宽度参与度（单侧）",
  DESC_VERTICAL_SUBTREE_WIDTH_BLEND_SINGLE: "垂直导图中，单侧生长的子图占用（左/右）水平空间的强度。影响程度高。",
  VERTICAL_SUBTREE_WIDTH_BLEND_DUAL: "子树宽度参与度（双侧）",
  DESC_VERTICAL_SUBTREE_WIDTH_BLEND_DUAL: "垂直导图中，双侧生长的子图占用（左右）水平空间的强度。影响程度高。",
  VERTICAL_SUBTREE_SMOOTH_THRESHOLD_MULTIPLIER: "子树平滑压缩触发倍数",
  DESC_VERTICAL_SUBTREE_SMOOTH_THRESHOLD_MULTIPLIER: "超过 Gap Y 乘以该倍数后开始平滑压缩，避免新增子节点间距突变。通常在大导图中更明显。",
  VERTICAL_SUBTREE_SMOOTH_MIN_SCALE: "子树平滑压缩下限",
  DESC_VERTICAL_SUBTREE_SMOOTH_MIN_SCALE: "垂直子树宽度平滑压缩到的最小值。值越大越保留原宽度。通常在大导图中更明显。",
  HORIZONTAL_L1_SOFTCAP_THRESHOLD: "L1 水平方向软上限",
  DESC_HORIZONTAL_L1_SOFTCAP_THRESHOLD: "超过该 px 值后，上/下 L1 子树宽度开始压缩。对大导图影响程度中到高。",
  HORIZONTAL_L1_COMPRESSION_MIN_SCALE: "L1 水平方向压缩下限",
  DESC_HORIZONTAL_L1_COMPRESSION_MIN_SCALE: "上/下 L1 宽度压缩到的最小值。值越大越保留原宽度。达到软上限后影响中等。",
  VERTICAL_COMPACT_PARENT_CHILD_GAP_RATIO: "紧凑亲子间距比例",
  DESC_VERTICAL_COMPACT_PARENT_CHILD_GAP_RATIO: "紧凑垂直子树中，亲子间距使用 Gap X 乘以该比例。极大影响视觉效果。",
  DIRECTIONAL_CROSS_AXIS_RATIO: "正交轴之比",
  DESC_DIRECTIONAL_CROSS_AXIS_RATIO: "与垂直于生长方向的轴（Cross-axis）的半径之比（0.2 = 扁，1.0 = 圆）。极大影响 L1 展开形态。",
  MANUAL_GAP_MULTIPLIER: "手动布局间距倍数",
  DESC_LAYOUT_MANUAL_GAP: "禁用自动布局时添加节点的间距倍数。",
  MANUAL_JITTER_RANGE: "手动布局抖动范围",
  DESC_LAYOUT_MANUAL_JITTER: "禁用自动布局时添加节点的随机位置偏移。",

  // Misc
  INPUT_TITLE_PASTE_ROOT: "MindMap Builder 粘贴",
  INSTRUCTIONS: "> [!Tip]\n" +
    ">🚀 想要进阶？欢迎参加官方 [MindMap Builder 课程](https://www.visual-thinking-workshop.com/mindmap)！\n" +
    "\n" +
    "- **ENTER**：添加子节点并保留在当前亲代节点上，方便快速输入。" +
    "若输入框为空时按回车，焦点将移动到最新添加的子节点。" +
    "连续按回车将在该节点的同级节点间循环切换。\n" +
    "- **热键**：见侧边面板底部的配置选项。\n" +
    "- **停靠/取消停靠**：使用按钮或配置好的热键来切换输入框位置。\n" +
    "- **折叠**：仅在输入框停靠时显示按钮；取消停靠时请使用热键。\n" +
    "- **ESC**：将浮动输入框停靠，但不激活侧边面板。\n" +
    "- **着色**：顶层分支拥有独立颜色（多色模式），后代节点继承亲代颜色。\n" +
    "- **编组**：\n" +
    "  - 启用“分支编组”将递归地编组子树，从叶节点到顶层分支。\n" +
    "- **复制/粘贴**：导出/导入含缩进的 Markdown 列表。\n" +
    "\n" +
    "😍 如果你觉得这个脚本有用，欢迎 [请我喝杯咖啡 ☕](https://ko-fi.com/zsolt)。",
});

addLocale("zh-tw", {
  // Notices
  NOTICE_SELECT_NODE_TO_COPY: "請選擇要複製的節點。",
  NOTICE_MAP_CUT: "導圖已剪下到剪貼簿。",
  NOTICE_BRANCH_CUT: "分支已剪下到剪貼簿。",
  NOTICE_MAP_COPIED: "導圖已複製為 Markdown 格式。",
  NOTICE_BRANCH_COPIED: "分支已複製為列表格式。",
  NOTICE_CLIPBOARD_EMPTY: "剪貼簿為空。",
  NOTICE_PASTE_ABORTED: "貼上中止。剪貼簿內容非 Markdown 列表或標題。",
  NOTICE_NO_LIST: "剪貼簿中未發現有效的 Markdown 列表。",
  NOTICE_PASTE_START: "正在貼上，請稍候，可能需要一些時間…",
  NOTICE_PASTE_COMPLETE: "貼上完成。",
  NOTICE_ACTION_REQUIRES_ARROWS: "此操作需要方向鍵。僅可修改修飾鍵。",
  NOTICE_CONFLICT_WITH_ACTION: "與“{action}”操作衝突",
  NOTICE_OBSIDIAN_HOTKEY_CONFLICT: "⚠️ Obsidian 熱鍵衝突！\n\n此按鍵將覆蓋：\n“{command}”",
  NOTICE_GLOBAL_HOTKEY_CONFLICT: "⚠️ 全域性熱鍵衝突！\n\n此按鍵將覆蓋：\n“{command}”",
  NOTICE_NO_HEADINGS: "連結檔案中未發現小標題。",
  NOTICE_CANNOT_EDIT_MULTILINE: "無法直接編輯多行節點。\n請在 Excalidraw 中雙擊元素進行編輯，然後執行“自動重排導圖”來更新佈局。",
  NOTICE_CANNOT_MOVE_PINNED: "無法移動已鎖定的節點。請先解鎖。",
  NOTICE_CANNOT_MOVE_ROOT: "無法移動根節點。",
  NOTICE_CANNOT_PRMOTE_L1: "無法提升 1 級節點。",
  NOTICE_CANNOT_DEMOTE: "無法降級節點。沒有可依附的前置同級節點。",
  NOTICE_SELECT_NODE_CONTAINING_LINK: "請選擇包含連結的節點。",
  NOTICE_CANNOT_DEMOTE_NO_SIBLING_TO_ACCEPT: "無法降級：未找到可接收此節點的同級節點。",
  NOTICE_CANNOT_DEMOTE_NO_VALID_SIBLING: "無法降級：沒有可附加的有效同級節點。",
  NOTICE_CANNOT_DEMOTE_CROSS_SIDE_NOT_ALLOWED: "無法降級：不允許跨側降級。",
  NOTICE_CANNOT_MOVE_AUTO_LAYOUT_DISABLED: "停用自動佈局時無法移動節點。請先啟用自動佈局。",
  NOTICE_BRANCH_WIDTH_MANUAL_OVERRIDE: "分支粗細未更新，因為部分分支粗細已被手動修改。",
  NOTICE_CANNOT_CHANGE_MASTER_ROOT: "主根節點不能被轉換。",
  NOTICE_SUBMAP_ROOT_ADDED: "已啟用子圖根節點。",
  NOTICE_SUBMAP_ROOT_REMOVED: "已移除子圖根節點。其子節點將按親代根節點佈局重排。",
  CONFIRM_REMOVE_SUBMAP_ROOT: "恢復為普通節點嗎？\n\n它將失去本地佈局元資料，其子節點將按親代根節點佈局重排。",

  // Action labels (display only)
  ACTION_LABEL_ADD: "新增子節點",
  ACTION_LABEL_ADD_SIBLING_AFTER: "新增後置同級節點",
  ACTION_LABEL_ADD_SIBLING_BEFORE: "新增前置同級節點",
  ACTION_LABEL_ADD_FOLLOW: "新增 + 跟隨",
  ACTION_LABEL_ADD_FOLLOW_FOCUS: "新增 + 跟隨 + 聚焦",
  ACTION_LABEL_ADD_FOLLOW_ZOOM: "新增 + 跟隨 + 縮放",
  ACTION_LABEL_SORT_ORDER: "更改順序/提升節點",
  ACTION_LABEL_EDIT: "編輯節點",
  ACTION_LABEL_PIN: "鎖定/解鎖",
  ACTION_LABEL_BOX: "新增/移除邊框",
  ACTION_LABEL_TOGGLE_GROUP: "編組/解除編組單分支",
  ACTION_LABEL_COPY: "複製",
  ACTION_LABEL_CUT: "剪下",
  ACTION_LABEL_PASTE: "貼上",
  ACTION_LABEL_IMPORT_OUTLINE: "匯入大綱",
  ACTION_LABEL_ZOOM: "迴圈縮放",
  ACTION_LABEL_FOCUS: "聚焦（並居中）節點",
  ACTION_LABEL_NAVIGATE: "導航",
  ACTION_LABEL_NAVIGATE_ZOOM: "導航 & 縮放",
  ACTION_LABEL_NAVIGATE_FOCUS: "導航 & 聚焦",
  ACTION_LABEL_FOLD: "摺疊/展開分支",
  ACTION_LABEL_FOLD_L1: "摺疊/展開 L1 子節點",
  ACTION_LABEL_FOLD_ALL: "遞迴摺疊/展開分支",
  ACTION_LABEL_DOCK_UNDOCK: "停靠/取消停靠",
  ACTION_LABEL_HIDE: "停靠 & 隱藏",
  ACTION_LABEL_REARRANGE: "重排導圖",
  ACTION_LABEL_TOGGLE_SUBMAP_ROOT: "開始/結束子圖根節點",
  ACTION_LABEL_TOGGLE_CHECKBOX: "切換複選框狀態",
  ACTION_LABEL_TOGGLE_EMBED: "切換嵌入/連結",

  // Tooltips (shared)
  PIN_TOOLTIP_PINNED: "此元素已鎖定。點選解鎖所選元素的位置。",
  PIN_TOOLTIP_UNPINNED: "此元素未鎖定。點選鎖定所選元素的位置。",
  TOGGLE_GROUP_TOOLTIP_GROUP: "編組此分支。僅在“分支編組”停用時可用。",
  TOGGLE_GROUP_TOOLTIP_UNGROUP: "解除編組此分支。僅在“分支編組”停用時可用。",
  TOOLTIP_EDIT_NODE: "編輯所選節點的文字",
  TOOLTIP_PIN_INIT: "鎖定/解鎖節點位置。鎖定的節點不會被自動重排。",
  TOOLTIP_REFRESH: "自動重排導圖",
  TOOLTIP_DOCK: "停靠到側邊面板",
  TOOLTIP_UNDOCK: "轉為浮動視窗",
  TOOLTIP_ZOOM_CYCLE: "迴圈切換元素縮放級別",
  TOOLTIP_TOGGLE_GROUP_BTN: "切換分支的編組狀態。僅在“分支編組”停用時可用。",
  TOOLTIP_TOGGLE_BOX: "切換節點邊框",
  TOOLTIP_TOGGLE_BOUNDARY: "切換子樹邊界",
  TOOLTIP_TOGGLE_FLOATING_EXTRAS: "切換額外控制元件",
  TOOLTIP_CONFIGURE_PALETTE: "為分支配置自定義調色盤",
  TOOLTIP_CONFIGURE_LAYOUT: "配置佈局設定",
  TOOLTIP_MOVE_UP: "上移",
  TOOLTIP_MOVE_DOWN: "下移",
  TOOLTIP_EDIT_COLOR: "編輯",
  TOOLTIP_DELETE_COLOR: "刪除",
  TOOLTIP_OPEN_PALETTE_PICKER: "開啟顏色選擇器",
  TOOLTIP_FOLD_BRANCH: "摺疊/展開所選分支",
  TOOLTIP_FOLD_L1_BRANCH: "摺疊/展開 L1 子節點",
  TOOLTIP_FOLD_ALL: "遞迴摺疊/展開分支",
  TOOLTIP_IMPORT_OUTLINE: "從連結檔案中匯入小標題作為子節點資料",
  TOOLTIP_RESET_TO_DEFAULT: "恢復預設",
  TOOLTIP_SUBMAP_ROOT_ADD: "從所選節點開始子圖",
  TOOLTIP_SUBMAP_ROOT_REMOVE: "將子圖根節點恢復為普通節點",
  TOOLTIP_TOGGLE_CHECKBOX: "切換任務複選框狀態",
  TOOLTIP_TOGGLE_EMBED: "在嵌入和連結之間切換節點",

  // Buttons and labels
  DOCK_TITLE: "MindMap Builder",
  HELP_SUMMARY: "幫助",
  INPUT_PLACEHOLDER: "輸入概念… 輸入 [[ 插入連結",
  ONTOLOGY_PLACEHOLDER: "本體（箭頭標籤）",
  BUTTON_COPY: "複製",
  BUTTON_CUT: "剪下",
  BUTTON_PASTE: "貼上",
  TITLE_ADD_SIBLING: `使用 ${ea.DEVICE.isMacOS || ea.DEVICE.isIOS ? "OPT" : "ALT"}+Enter 新增同級節點`,
  TITLE_ADD_FOLLOW: "新增並跟隨",
  TITLE_COPY: "複製分支為文字",
  TITLE_CUT: "剪下分支為文字",
  TITLE_PASTE: "從剪貼簿貼上列表",
  LABEL_ZOOM_LEVEL: "縮放級別",
  LABEL_GROWTH_STRATEGY: "生長策略",
  LABEL_FILL_SWEEP: "填充掃過角度",
  DESC_FILL_SWEEP: "立即在整個“最大掃過角度”範圍內分佈節點，而不是隨著節點數量增加逐漸擴大弧度。",
  LABEL_ARROW_TYPE: "曲線連線",
  LABEL_AUTO_LAYOUT: "自動佈局",
  LABEL_GROUP_BRANCHES: "分支編組",
  LABEL_BOX_CHILD_NODES: "為子節點新增邊框",
  LABEL_ROUNDED_CORNERS: "圓角",
  LABEL_USE_SCENE_STROKE: "使用場景線條樣式",
  DESC_USE_SCENE_STROKE: "使用場景中最新的線條樣式（實線、虛線、點線），否則分支將始終使用實線。",
  LABEL_BRANCH_SCALE: "分支粗細比例",
  LABEL_BASE_WIDTH: "基礎粗細",
  LABEL_MULTICOLOR_BRANCHES: "多色分支",
  LABEL_MAX_WRAP_WIDTH: "最大折行寬度",
  LABEL_CENTER_TEXT: "文字居中",
  DESC_CENTER_TEXT: "關閉：根據位置左/右對齊；開啟：文字強制居中。",
  LABEL_FONT_SIZES: "字型大小",
  HOTKEY_SECTION_TITLE: "熱鍵配置",
  HOTKEY_HINT: "這些熱鍵可能覆蓋 Obsidian 預設設定。熱鍵作用域預設為區域性（⌨️），使用 🌐/🎨/⌨️ 切換作用域：🌐 Excalidraw 標籤頁可見即生效，🎨 Excalidraw 聚焦時生效，⌨️ 輸入框聚焦時生效。",
  RECORD_HOTKEY_PROMPT: "按下熱鍵…",
  ARIA_SCOPE_INPUT: "區域性（Local）：僅在輸入框聚焦時生效",
  ARIA_SCOPE_EXCALIDRAW: "Excalidraw：輸入框或 Excalidraw 聚焦時生效",
  ARIA_SCOPE_GLOBAL: "全域性（Global）：在 Obsidian 任何位置，Excalidraw 可見即生效",
  ARIA_RESTORE_DEFAULT: "恢復預設",
  ARIA_CUSTOMIZE_HOTKEY: "自定義此熱鍵",
  ARIA_OVERRIDE_COMMAND: "將覆蓋 Obsidian 命令：\n{command}",

  // Palette manager
  MODAL_PALETTE_TITLE: "導圖分支調色盤",
  LABEL_ENABLE_CUSTOM_PALETTE: "啟用自定義調色盤",
  DESC_ENABLE_CUSTOM_PALETTE: "使用以下顏色代替自動生成的顏色。",
  LABEL_RANDOMIZE_ORDER: "隨機順序",
  DESC_RANDOMIZE_ORDER: "隨機選擇顏色而非按順序選擇。",
  HEADING_ADD_NEW_COLOR: "新增新顏色",
  HEADING_EDIT_COLOR: "編輯顏色",
  LABEL_SELECT_COLOR: "選擇顏色",
  BUTTON_CANCEL_EDIT: "取消編輯",
  BUTTON_ADD_COLOR: "新增顏色",
  BUTTON_UPDATE_COLOR: "更新顏色",

  // Layout configuration
  MODAL_LAYOUT_TITLE: "佈局配置",
  // Section Headers
  SECTION_GENERAL: "常規間距",
  SECTION_RADIAL: "徑向佈局（順時針）",
  SECTION_DIRECTIONAL: "定向佈局（左/右）",
  SECTION_VERTICAL: "垂直導圖（上/下）",
  SECTION_VISUALS: "視覺元素",
  SECTION_MANUAL: "手動模式行為",
  LAYOUT_RESET: "重置所有為預設值",
  LAYOUT_SAVE: "儲存並關閉",
  // Radial Strings
  RADIAL_ASPECT_RATIO: "橢圓長寬比",
  DESC_RADIAL_ASPECT_RATIO: "控制形狀。< 1.0 為瘦長（0.7 為縱向），1.0 為正圓，> 1.0 為寬扁（橫向）。",
  RADIAL_POLE_GAP_BONUS: "極點間距補償",
  DESC_RADIAL_POLE_GAP_BONUS: "增加橢圓南北兩極區域內節點的間距。值越大，節點沿弧線推得越遠。",
  RADIAL_START_ANGLE: "起始角度",
  DESC_RADIAL_START_ANGLE: "第一個節點出現的位置（度數）。270 為北，0 為東，90 為南。",
  RADIAL_MAX_SWEEP: "最大掃過角度",
  DESC_RADIAL_MAX_SWEEP: "分支可填充的弧範圍。360 為全圓。較小的值會使圓不完整。",
  // Others
  GAP_X: "水平間距（Gap X）",
  DESC_LAYOUT_GAP_X: "親代節點與子節點之間的水平距離。",
  GAP_Y: "垂直間距（Gap Y）",
  DESC_LAYOUT_GAP_Y: "同級節點之間的垂直距離。徑向佈局中的基礎間距。",
  GAP_MULTIPLIER: "間距倍數",
  DESC_LAYOUT_GAP_MULTIPLIER: "葉節點（無子節點的節點）相對於字型大小的垂直間距。低：類似列表堆疊；高：標準樹狀間距。",
  DIRECTIONAL_ARC_SPAN_RADIANS: "定向張開弧度（Arc-span Radians）",
  DESC_LAYOUT_ARC_SPAN: "子節點排列的曲率。低（0.5）：較平，類似列表。高（2.0）：彎曲有機，但有重疊風險。",
  ROOT_RADIUS_FACTOR: "根節點半徑係數",
  DESC_LAYOUT_ROOT_RADIUS: "相對於根節點邊框的倍數，決定最初的半徑。",
  MIN_RADIUS: "最小半徑",
  DESC_LAYOUT_MIN_RADIUS: "從根節點中心到第一級節點的最小絕對距離。",
  RADIUS_PADDING_PER_NODE: "單節點徑向空白邊距",
  DESC_LAYOUT_RADIUS_PADDING: "每個子節點額外增加的半徑，以適應密集型導圖。",
  GAP_MULTIPLIER_RADIAL: "徑向佈局間距倍數",
  DESC_LAYOUT_GAP_RADIAL: "徑向佈局模式下的角度間距倍數。",
  GAP_MULTIPLIER_DIRECTIONAL: "垂直方向間距倍數",
  DESC_LAYOUT_GAP_DIRECTIONAL: "定向佈局頂層分支之間的間距倍數。",
  INDICATOR_OFFSET: "摺疊指示符偏移",
  DESC_LAYOUT_INDICATOR_OFFSET: "摺疊指示符（三連點）距離節點的距離。",
  INDICATOR_OPACITY: "摺疊指示符不透明度",
  DESC_LAYOUT_INDICATOR_OPACITY: "摺疊指示符的不透明度（0-100）。",
  CONTAINER_PADDING: "容器內邊距",
  DESC_LAYOUT_CONTAINER_PADDING: "使用邊框樣式時的內邊距。",
  MAX_SEGMENT_LENGTH: "邊界線精度",
  DESC_LAYOUT_BOUNDARY_LINE_PRECISION: "邊界平滑精度。值越小越精細（30 = 精細），值越大越粗略（200 = 粗略）。",
  VERTICAL_SUBTREE_WIDTH_BLEND_SINGLE: "子樹寬度參與度（單側）",
  DESC_VERTICAL_SUBTREE_WIDTH_BLEND_SINGLE: "垂直導圖中，單側生長的子圖佔用（左/右）水平空間的強度。影響程度高。",
  VERTICAL_SUBTREE_WIDTH_BLEND_DUAL: "子樹寬度參與度（雙側）",
  DESC_VERTICAL_SUBTREE_WIDTH_BLEND_DUAL: "垂直導圖中，雙側生長的子圖佔用（左右）水平空間的強度。影響程度高。",
  VERTICAL_SUBTREE_SMOOTH_THRESHOLD_MULTIPLIER: "子樹平滑壓縮觸發倍數",
  DESC_VERTICAL_SUBTREE_SMOOTH_THRESHOLD_MULTIPLIER: "超過 Gap Y 乘以該倍數後開始平滑壓縮，避免新增子節點間距突變。通常在大導圖中更明顯。",
  VERTICAL_SUBTREE_SMOOTH_MIN_SCALE: "子樹平滑壓縮下限",
  DESC_VERTICAL_SUBTREE_SMOOTH_MIN_SCALE: "垂直子樹寬度平滑壓縮到的最小值。值越大越保留原寬度。通常在大導圖中更明顯。",
  HORIZONTAL_L1_SOFTCAP_THRESHOLD: "L1 水平方向軟上限",
  DESC_HORIZONTAL_L1_SOFTCAP_THRESHOLD: "超過該 px 值後，上/下 L1 子樹寬度開始壓縮。對大導圖影響程度中到高。",
  HORIZONTAL_L1_COMPRESSION_MIN_SCALE: "L1 水平方向壓縮下限",
  DESC_HORIZONTAL_L1_COMPRESSION_MIN_SCALE: "上/下 L1 寬度壓縮到的最小值。值越大越保留原寬度。達到軟上限後影響中等。",
  VERTICAL_COMPACT_PARENT_CHILD_GAP_RATIO: "緊湊親子間距比例",
  DESC_VERTICAL_COMPACT_PARENT_CHILD_GAP_RATIO: "緊湊垂直子樹中，親子間距使用 Gap X 乘以該比例。極大影響視覺效果。",
  DIRECTIONAL_CROSS_AXIS_RATIO: "正交軸之比",
  DESC_DIRECTIONAL_CROSS_AXIS_RATIO: "與垂直於生長方向的軸（Cross-axis）的半徑之比（0.2 = 扁，1.0 = 圓）。極大影響 L1 展開形態。",
  MANUAL_GAP_MULTIPLIER: "手動佈局間距倍數",
  DESC_LAYOUT_MANUAL_GAP: "停用自動佈局時新增節點的間距倍數。",
  MANUAL_JITTER_RANGE: "手動佈局抖動範圍",
  DESC_LAYOUT_MANUAL_JITTER: "停用自動佈局時新增節點的隨機位置偏移。",

  // Misc
  INPUT_TITLE_PASTE_ROOT: "MindMap Builder 貼上",
  INSTRUCTIONS: "> [!Tip]\n" +
    ">🚀 想要進階？歡迎參加官方 [MindMap Builder 課程](https://www.visual-thinking-workshop.com/mindmap)！\n" +
    "\n" +
    "- **ENTER**：新增子節點並保留在當前親代節點上，方便快速輸入。" +
    "若輸入框為空時按回車，焦點將移動到最新新增的子節點。" +
    "連續按回車將在該節點的同級節點間迴圈切換。\n" +
    "- **熱鍵**：見側邊面板底部的配置選項。\n" +
    "- **停靠/取消停靠**：使用按鈕或配置好的熱鍵來切換輸入框位置。\n" +
    "- **摺疊**：僅在輸入框停靠時顯示按鈕；取消停靠時請使用熱鍵。\n" +
    "- **ESC**：將浮動輸入框停靠，但不啟用側邊面板。\n" +
    "- **著色**：頂層分支擁有獨立顏色（多色模式），後代節點繼承親代顏色。\n" +
    "- **編組**：\n" +
    "  - 啟用“分支編組”將遞迴地編組子樹，從葉節點到頂層分支。\n" +
    "- **複製/貼上**：匯出/匯入含縮排的 Markdown 列表。\n" +
    "\n" +
    "😍 如果你覺得這個指令碼有用，歡迎 [請我喝杯咖啡 ☕](https://ko-fi.com/zsolt)。",
});

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
  GROWTH: Object.freeze(["Radial", "Right-facing", "Left-facing", "Right-Left", "Up-facing", "Down-facing", "Up-Down"]),
  ZOOM: Object.freeze(["Low", "Medium", "High"]),
  ARROW: Object.freeze(["curved", "straight"]),
  BRANCH_SCALE: Object.freeze(["Hierarchical", "Uniform"]),
});

const FONT_SCALE_TYPES = VALUE_SETS.FONT_SCALE;
const GROWTH_TYPES = VALUE_SETS.GROWTH;
const ZOOM_TYPES = VALUE_SETS.ZOOM;
const SCOPE = VALUE_SETS.SCOPE;
const ARROW_TYPES = VALUE_SETS.ARROW;
const BRANCH_SCALE_TYPES = VALUE_SETS.BRANCH_SCALE;
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
const K_BRANCH_SCALE = "Branch Scale Style";
const K_BASE_WIDTH = "Base Stroke Width";
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
const K_FILL_SWEEP = "Fill Sweep";

// ---------------------------------------------------------------------------
// Layout & Geometry Settings
// ---------------------------------------------------------------------------
const LAYOUT_METADATA = {
  // --- General ---
  GAP_X: {
    section: "SECTION_GENERAL",
    def: 120, min: 10, max: 400, step: 10,
    desc: t("DESC_LAYOUT_GAP_X"),
    name: t("GAP_X"),
  },
  GAP_Y: {
    section: "SECTION_GENERAL",
    def: 25, min: 5, max: 150, step: 5,
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
    section: "SECTION_GENERAL",
    def: 0.8, min: 0.5, max: 2.0, step: 0.1,
    desc: t("DESC_LAYOUT_ROOT_RADIUS"),
    name: t("ROOT_RADIUS_FACTOR"),
  },
  MIN_RADIUS: {
    section: "SECTION_GENERAL",
    def: 350, min: 30, max: 800, step: 10,
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
    def: 340, min: 90, max: 360, step: 10,
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

  // --- Vertical Maps (Up/Down) ---
  VERTICAL_SUBTREE_WIDTH_BLEND_SINGLE: {
    section: "SECTION_VERTICAL",
    def: 0.35, min: 0.05, max: 1.2, step: 0.05,
    desc: t("DESC_VERTICAL_SUBTREE_WIDTH_BLEND_SINGLE"),
    name: t("VERTICAL_SUBTREE_WIDTH_BLEND_SINGLE"),
  },
  VERTICAL_SUBTREE_WIDTH_BLEND_DUAL: {
    section: "SECTION_VERTICAL",
    def: 0.6, min: 0.1, max: 1.4, step: 0.05,
    desc: t("DESC_VERTICAL_SUBTREE_WIDTH_BLEND_DUAL"),
    name: t("VERTICAL_SUBTREE_WIDTH_BLEND_DUAL"),
  },
  VERTICAL_SUBTREE_SMOOTH_THRESHOLD_MULTIPLIER: {
    section: "SECTION_VERTICAL",
    def: 6.0, min: 0.5, max: 20.0, step: 0.5,
    desc: t("DESC_VERTICAL_SUBTREE_SMOOTH_THRESHOLD_MULTIPLIER"),
    name: t("VERTICAL_SUBTREE_SMOOTH_THRESHOLD_MULTIPLIER"),
  },
  VERTICAL_SUBTREE_SMOOTH_MIN_SCALE: {
    section: "SECTION_VERTICAL",
    def: 240, min: 10, max: 1600, step: 10,
    desc: t("DESC_VERTICAL_SUBTREE_SMOOTH_MIN_SCALE"),
    name: t("VERTICAL_SUBTREE_SMOOTH_MIN_SCALE"),
  },
  HORIZONTAL_L1_SOFTCAP_THRESHOLD: {
    section: "SECTION_VERTICAL",
    def: 560, min: 20, max: 3000, step: 20,
    desc: t("DESC_HORIZONTAL_L1_SOFTCAP_THRESHOLD"),
    name: t("HORIZONTAL_L1_SOFTCAP_THRESHOLD"),
  },
  HORIZONTAL_L1_COMPRESSION_MIN_SCALE: {
    section: "SECTION_VERTICAL",
    def: 240, min: 10, max: 1600, step: 10,
    desc: t("DESC_HORIZONTAL_L1_COMPRESSION_MIN_SCALE"),
    name: t("HORIZONTAL_L1_COMPRESSION_MIN_SCALE"),
  },
  VERTICAL_COMPACT_PARENT_CHILD_GAP_RATIO: {
    section: "SECTION_VERTICAL",
    def: 0.55, min: 0.05, max: 1.3, step: 0.05,
    desc: t("DESC_VERTICAL_COMPACT_PARENT_CHILD_GAP_RATIO"),
    name: t("VERTICAL_COMPACT_PARENT_CHILD_GAP_RATIO"),
  },
  DIRECTIONAL_CROSS_AXIS_RATIO: {
    section: "SECTION_VERTICAL",
    def: 0.2, min: 0.05, max: 1.2, step: 0.05,
    desc: t("DESC_DIRECTIONAL_CROSS_AXIS_RATIO"),
    name: t("DIRECTIONAL_CROSS_AXIS_RATIO"),
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
  MAX_SEGMENT_LENGTH: {
    section: "SECTION_VISUALS",
    def: 80, min: 30, max: 200, step: 10,
    desc: t("DESC_LAYOUT_BOUNDARY_LINE_PRECISION"),
    name: t("MAX_SEGMENT_LENGTH"),
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
let layoutSettingsDirty = false;

Object.keys(LAYOUT_METADATA).forEach(k => {
  const val = layoutSettings[k];
  const def = LAYOUT_METADATA[k].def;
  if (val === undefined || val === null || typeof val !== "number" || !Number.isFinite(val)) {
    layoutSettings[k] = def;
    layoutSettingsDirty = true;
  }
});

if (layoutSettingsDirty) {
  setVal(K_LAYOUT, layoutSettings, true);
  dirty = true;
}

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
if(isNaN(maxWidth)) maxWidth = 450;
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
let fillSweep = getVal(K_FILL_SWEEP, false);
let editingNodeId = null;
let mostRecentlySelectedNodeID = null;

// Undo/Redo tracking
let currentTransactionAccumulator = 0;
let lastCommittedTransaction = null; // { steps: number, version: number }
let redoAvailable = null; // { steps: number, version: number } - state after a batched undo

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


let branchScale = getVal(K_BRANCH_SCALE, {value: "Hierarchical", valueset: BRANCH_SCALE_TYPES});
let baseStrokeWidth = parseFloat(getVal(K_BASE_WIDTH, {value: 6}));
if(isNaN(baseStrokeWidth)) baseStrokeWidth = 6;

/**
 * Pure calculation logic for stroke width.
 */
const calculateStrokeWidth = (depth, baseWidth, scaleMode) => {
  const base = Number.isFinite(baseWidth) ? baseWidth : 6;
  const clampedDepth = Math.max(0, Math.min(depth ?? 0, 4));

  if (scaleMode === "Uniform") return base;

  const min = Math.max(0.1, base * 0.1);
  const slope = (min - base) / 4;
  const val = slope * clampedDepth + base;
  return Math.round(val * 100) / 100;
}

/**
 * Calculates the stroke width for a branch based on depth and style.
 * Uses global settings.
 */
const getStrokeWidthForDepth = (depth) => {
  return calculateStrokeWidth(depth, baseStrokeWidth, branchScale);
};

const ownerWindow = ea.targetView?.ownerWindow;
const isMac = ea.DEVICE.isMacOS || ea.DEVICE.isIOS;
const IMAGE_TYPES = ["jpeg", "jpg", "png", "gif", "svg", "webp", "bmp", "ico", "jtif", "tif", "jfif", "avif"];
const EMBEDED_OBJECT_WIDTH_ROOT = 400;
const EMBEDED_OBJECT_WIDTH_CHILD = 180;

//special trim function that returns trimmed text, including trimming a bullet point of the bullet
const trimText = (text) => {
  if(!text) return text;
  return text.match(/^(?:[ \t]*[-\*][ \t])?(?:[ \t]*)(.*?)[ \t]*$/)[1];
}

const parseText = async (text) => {
  const trimmed = trimText(text);
  if (trimmed && (trimmed.startsWith("![[") || trimmed.match(/^[-*][ \t]+!\[\[/)) && trimmed.endsWith("]]")) {
    return text;
  }
  return await ea.parseText(text);
}

const parseImageInput = (input) => {
  const trimmed = trimText(input);

  // Check for external/local markdown image link: ![](http...) or ![](file...)
  const externalMatch = trimmed.match(/^!\[(.*?)\]\(((?:https?|file):\/\/[^)]+)\)$/i);
  if (externalMatch) {
    const altText = externalMatch[1];
    const url = externalMatch[2];
    
    let width = null;
    if (altText) {
      const parts = altText.split("|");
      const last = parts[parts.length - 1];
      if (/^\d+$/.test(last)) {
        width = parseInt(last);
      }
    }
    
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      // Heuristic: check if the URL points to a standard image file extension
      const isImageUrl = IMAGE_TYPES.some(ext => pathname.endsWith("." + ext));
      
      if (isImageUrl) {
        return {
          path: url,
          width,
          imageFile: null,
          isImagePath: true, // This triggers image addition in addNode
          file: null,
          isExternalImage: true // Flag to help direct link assignments later
        };
      }
    } catch (e) {}
    
    // If not matching an image extension, return null so parseEmbeddableInput takes over
    return null;
  }

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

  const PDF_RECT_LINK_REGEX = /^[^#]*#page=\d*/; //(&\w*=[^&]+){0,}&rect=\d*,\d*,\d*,\d*
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
  // Ensure we capture potential alt-text formatting so we gracefully match the pattern
  const match = trimmed.match(/^!\[(.*?)\]\(((?:https?|file):\/\/[^)]+)\)$/i);
  if (match) {
    // If parseImageInput already claimed this as an external image, do not override
    if (imageInfo && imageInfo.isExternalImage) return null;
    return match[2];
  }
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
const ACTION_TOGGLE_CHECKBOX = "Toggle Checkbox";
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
const ACTION_TOGGLE_SUBMAP_ROOT = "Toggle Submap Root";
const ACTION_TOGGLE_EMBED = "Toggle Embed/Link";

const ACTION_DOCK_UNDOCK = "Dock/Undock";
const ACTION_HIDE = "Dock & hide";
const ACTION_REARRANGE = "Rearrange Map";
const ACTION_TOGGLE_FLOATING_EXTRAS = "Toggle Floating Extra Buttons";

const ACTION_UNDO = "Undo";
const ACTION_REDO_Z = "Redo (Ctrl-Shift-Z)";
const ACTION_REDO_Y = "Redo (Ctrl-Y)";

const ACTION_LABEL_KEYS = {
  [ACTION_ADD]: "ACTION_LABEL_ADD",
  [ACTION_ADD_SIBLING_AFTER]: "ACTION_LABEL_ADD_SIBLING_AFTER",
  [ACTION_ADD_SIBLING_BEFORE]: "ACTION_LABEL_ADD_SIBLING_BEFORE",
  [ACTION_ADD_FOLLOW]: "ACTION_LABEL_ADD_FOLLOW",
  [ACTION_ADD_FOLLOW_FOCUS]: "ACTION_LABEL_ADD_FOLLOW_FOCUS",
  [ACTION_ADD_FOLLOW_ZOOM]: "ACTION_LABEL_ADD_FOLLOW_ZOOM",
  [ACTION_SORT_ORDER]: "ACTION_LABEL_SORT_ORDER",
  [ACTION_EDIT]: "ACTION_LABEL_EDIT",
  [ACTION_TOGGLE_CHECKBOX]: "ACTION_LABEL_TOGGLE_CHECKBOX",
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
  [ACTION_TOGGLE_SUBMAP_ROOT]: "ACTION_LABEL_TOGGLE_SUBMAP_ROOT",
  [ACTION_TOGGLE_EMBED]: "ACTION_LABEL_TOGGLE_EMBED",
  [ACTION_DOCK_UNDOCK]: "ACTION_LABEL_DOCK_UNDOCK",
  [ACTION_HIDE]: "ACTION_LABEL_HIDE",
  [ACTION_REARRANGE]: "ACTION_LABEL_REARRANGE",
  [ACTION_TOGGLE_FLOATING_EXTRAS]: "TOOLTIP_TOGGLE_FLOATING_EXTRAS",
  [ACTION_UNDO]: "Undo",
  [ACTION_REDO_Z]: "Redo",
  [ACTION_REDO_Y]: "Redo"
};

const getActionLabel = (action) => t(ACTION_LABEL_KEYS[action] ?? action);

// Default configuration
// scope may be "input" | "excalidraw" | "global"
// - input: the hotkey only works if the inputEl has focus
// - excalidraw: the hotkey works when either the inputEl has focus or the sidepanelView leaf or the Excalidraw leaf is active
// - global: the hotkey works across obsidian, when ever the Excalidraw view in ea.targetView is visible, i.e. the hotkey works even if the user is active in a leaf like pdf viewer, markdown note, open next to Excalidraw.
// - none: ea.targetView not set or Excalidraw leaf not visible
const DEFAULT_HOTKEYS =[
  // Creation - Enter based
  { action: ACTION_ADD, key: "Enter", modifiers: [], scope: SCOPE.input, isInputOnly: true, requiresNode: false },
  { action: ACTION_ADD_SIBLING_AFTER, key: "Enter", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: true, requiresNode: false },
  { action: ACTION_ADD_SIBLING_BEFORE, key: "Enter", modifiers: ["Alt", "Shift"], scope: SCOPE.input, isInputOnly: true, requiresNode: false },
  { action: ACTION_ADD_FOLLOW, key: "Enter", modifiers:["Mod", "Alt"], scope: SCOPE.input, isInputOnly: true, requiresNode: false },
  { action: ACTION_ADD_FOLLOW_FOCUS, key: "Enter", modifiers: ["Mod"], scope: SCOPE.input, isInputOnly: true, requiresNode: false },
  { action: ACTION_ADD_FOLLOW_ZOOM, key: "Enter", modifiers: ["Mod", "Shift"], scope: SCOPE.input, isInputOnly: true, requiresNode: false },
  
  //Window
  { action: ACTION_DOCK_UNDOCK, key: "Enter", modifiers: ["Shift"], scope: SCOPE.input, isInputOnly: true, requiresNode: false },
  { action: ACTION_HIDE, key: "Escape", modifiers:[], scope: SCOPE.excalidraw, isInputOnly: true, requiresNode: false },

  // Edit
  { action: ACTION_EDIT, code: "KeyE", modifiers: ["Mod"], scope: SCOPE.input, isInputOnly: false, requiresNode: true },

  // Structure Modifiers
  { action: ACTION_TOGGLE_CHECKBOX, code: "KeyL", modifiers: ["Mod"], scope: SCOPE.input, isInputOnly: false, requiresNode: true },
  { action: ACTION_PIN, code: "KeyP", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false, requiresNode: true },
  { action: ACTION_BOX, code: "KeyB", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false, requiresNode: true },
  { action: ACTION_TOGGLE_BOUNDARY, code: "KeyB", modifiers: ["Alt", "Shift"], scope: SCOPE.input, isInputOnly: false, requiresNode: true },
  { action: ACTION_TOGGLE_SUBMAP_ROOT, code: "KeyJ", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false, requiresNode: true },
  { action: ACTION_TOGGLE_GROUP, code: "KeyG", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false, requiresNode: true },
  { action: ACTION_TOGGLE_EMBED, code: "KeyE", modifiers:["Alt"], scope: SCOPE.input, isInputOnly: false, requiresNode: true },

  // Clipboard (Alt to distinguish from text editing)
  { action: ACTION_COPY, code: "KeyC", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false, requiresNode: true },
  { action: ACTION_CUT, code: "KeyX", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false, requiresNode: true },
  { action: ACTION_PASTE, code: "KeyV", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false, requiresNode: false },
  { action: ACTION_IMPORT_OUTLINE, code: "KeyI", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false, requiresNode: true },

  // View Actions
  { action: ACTION_REARRANGE, code: "KeyR", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false, requiresNode: true },
  { action: ACTION_ZOOM, code: "KeyZ", modifiers:["Alt"], scope: SCOPE.input, isInputOnly: false, requiresNode: true },
  { action: ACTION_FOCUS, code: "KeyF", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false, requiresNode: false },

  //Navigation
  { action: ACTION_NAVIGATE, key: "ArrowKeys", modifiers: ["Alt"], isNavigation: true, scope: SCOPE.input, isInputOnly: false, requiresNode: true },
  { action: ACTION_NAVIGATE_ZOOM, key: "ArrowKeys", modifiers: ["Alt", "Shift"], isNavigation: true, scope: SCOPE.input, isInputOnly: false, requiresNode: true },
  { action: ACTION_NAVIGATE_FOCUS, key: "ArrowKeys", modifiers: ["Alt", "Mod"], isNavigation: true, scope: SCOPE.input, isInputOnly: false, requiresNode: true },
  { action: ACTION_SORT_ORDER, code: "ArrowKeys", modifiers: ["Mod"], isNavigation: true, scope: SCOPE.input, isInputOnly: false, requiresNode: true },
  { action: ACTION_FOLD, code: "Digit1", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false, requiresNode: true },
  { action: ACTION_FOLD_L1, code: "Digit2", modifiers:["Alt"], scope: SCOPE.input, isInputOnly: false, requiresNode: true },
  { action: ACTION_FOLD_ALL, code: "Digit3", modifiers: ["Alt"], scope: SCOPE.input, isInputOnly: false, requiresNode: true },

  // Undo / Redo
  { action: ACTION_UNDO, key: "z", modifiers: ["Mod"], scope: SCOPE.excalidraw, isInputOnly: false, hidden: true, requiresNode: false },
  { action: ACTION_REDO_Z, key: "z", modifiers: ["Mod", "Shift"], scope: SCOPE.excalidraw, isInputOnly: false, hidden: true, requiresNode: false },
  { action: ACTION_REDO_Y, key: "y", modifiers: ["Mod"], scope: SCOPE.excalidraw, isInputOnly: false, hidden: true, requiresNode: false },
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
 * - Structural attributes (isInputOnly, requiresNode, isNavigation, hidden) 
 *   ALWAYS come from DEFAULT_HOTKEYS and are excluded from the saved state.
 * - For existing actions:
 *    - keeps user values for configurable keys (modifiers, key, code, scope)
 *    - adds missing keys from DEFAULT
 *    - removes keys not in DEFAULT
**/
function updateUserHotkeys() {
  let dirty = false;

  const defaultByAction = new Map(DEFAULT_HOTKEYS.map(d => [d.action, d]));
  // These properties dictate script logic and should never be overridden by user settings
  const structuralKeys =["isInputOnly", "requiresNode", "isNavigation", "hidden"];

  const userByAction = new Map();
  for (const u of userHotkeys) {
    if (u && typeof u.action === "string" && defaultByAction.has(u.action)) {
      userByAction.set(u.action, u);
    } else if (u && u.action) {
      // user action no longer exists in DEFAULT => dropped
      dirty = true;
    }
  }

  const next =[];

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

      // Always inherit structural properties directly from defaults
      if (structuralKeys.includes(key)) {
        cleaned[key] = d[key];
        continue; // Do NOT mark dirty just because this key is missing in the user config
      }

      if (Object.prototype.hasOwnProperty.call(u, key)) {
        cleaned[key] = u[key];
      } else {
        cleaned[key] = d[key];
        dirty = true;
      }
    }

    for (const key of Object.keys(u)) {
      if (key === "action") continue;
      // If the user object has a structural key (e.g. from an older version's save),
      // mark as dirty so we flush a cleaned version back to disk.
      if (structuralKeys.includes(key)) {
        dirty = true;
      } else if (!Object.prototype.hasOwnProperty.call(d, key)) {
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
        runtimeKeys.push({ action: h.action, key, modifiers: h.modifiers, scope: h.scope, requiresNode: h.requiresNode, isInputOnly: h.isInputOnly });
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
  if (!isViewSet()) return SCOPE.none;

  const currentWindow = isUndocked && floatingInputModal
    ? ea.targetView?.ownerWindow
    : sidepanelWindow;

  if (currentWindow.document?.activeElement === inputEl || currentWindow.document?.activeElement === ontologyEl) {
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

${t("INSTRUCTIONS")}

<div class="ex-coffee-div"><a href="https://ko-fi.com/zsolt"><img src="https://storage.ko-fi.com/cdn/kofi6.png?v=6" border="0" alt="Buy Me a Coffee at ko-fi.com"  height=45></a></div>

<a href="https://www.youtube.com/watch?v=5G9QF-u9w0Q" target="_blank"><img src ="https://i.ytimg.com/vi/5G9QF-u9w0Q/maxresdefault.jpg" style="max-width:560px; width:100%"></a>
`;

// addElementsToView with different defaults compared to EA
const addElementsToView = async (
  {
    repositionToCursor = false,
    save = false,
    newElementsOnTop = true,
    shouldRestoreElements = true,
    captureUpdate = "IMMEDIATELY",
  } = {}
) => {
  if (!isViewSet()) return;

  // Track transaction steps for Undo/Redo
  if (["EVENTUALLY", "IMMEDIATELY"].includes(captureUpdate)) {
    currentTransactionAccumulator++;
  }

  await ea.addElementsToView(repositionToCursor, save, newElementsOnTop, shouldRestoreElements, captureUpdate);
  const fileIds = new Set(ea.getElements().filter(el => el.fileId && !el.isDeleted).map(el => el.fileId));
  ea.clear();

  // Commit transaction logic
  if (captureUpdate === "IMMEDIATELY") {
    // We only record the undo checkpoint when a visual commit happens
    const currentSceneVersion = ExcalidrawLib.getSceneVersion(api().getSceneElements());
    lastCommittedTransaction = {
      steps: currentTransactionAccumulator,
      version: currentSceneVersion
    };
    // Reset accumulator and clear redo availability since we pushed a new action
    currentTransactionAccumulator = 0;
    redoAvailable = null;
  }

  if(fileIds.size === 0) return;
  const checker = () => {
    const loadedFiles = api().getFiles();
    const loadedKeys = Object.keys(loadedFiles).filter(f => loadedFiles[f].dataURL);
    for (const fileId of fileIds) {
      if (!loadedKeys.find(f => f.id === fileId)) return false;
    }
    return true;
  }
  
  let watchdog = 0;
  while (!checker() && watchdog++ < 20) {
    await sleep(15);
  }
}

const selectNodeInView = (node) => {
  if (!node) {
    mostRecentlySelectedNodeID = null;
    return;
  }
  const nodeId = typeof node === "string" ? node : node.id;
  ea.selectElementsInView([nodeId]);
  mostRecentlySelectedNodeID = nodeId;
};

const buildParentMap = (allElements, elementById) => {
  const parentMap = new Map();
  const byId = elementById || buildElementMap(allElements);

  allElements.forEach((el) => {
    if (el.type === "arrow" && el.customData?.isBranch && el.startBinding?.elementId && el.endBinding?.elementId) {
      const parent = byId.get(el.startBinding.elementId);
      const childId = el.endBinding.elementId;
      
      if (parent && childId) {
        // Handle container nodes if applicable
        const actualParent = parent.containerId ? byId.get(parent.containerId) : parent;
        if(actualParent) parentMap.set(childId, actualParent);
      }
    }
  });

  return parentMap;
};

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
  if (!isViewSet()) return;
  const selectedElements = ea.getViewSelectedElements().filter(el => el.customData && (
    el.customData.hasOwnProperty("mindmapOrder") || el.customData.hasOwnProperty("isBranch") ||
    el.customData.hasOwnProperty("growthMode") || el.customData.hasOwnProperty("isBoundary")
  ));
  if (selectedElements.length === 0) return;

  const owner = getBoundaryHost(selectedElements);
  if (owner) {
    mostRecentlySelectedNodeID = owner.id;
    return owner;
  }

  if (
      selectedElements.length === 1 && (
      selectedElements[0].customData.hasOwnProperty("mindmapOrder") ||
      selectedElements[0].customData.hasOwnProperty("growthMode")
  )) {
    if (selectedElements[0].type === "text" && selectedElements[0].boundElements.length === 0 && !!selectedElements[0].containerId) {
      const node = ea.getViewElements().find((el) => el.id === selectedElements[0].containerId);
      mostRecentlySelectedNodeID = node?.id;
      return node;
    }
    mostRecentlySelectedNodeID = selectedElements?.[0]?.id;
    return selectedElements[0];
  }

  // Handle Single Arrow Selection, deliberatly not filtering to el.customData?.isBranch
  if (selectedElements.length === 1 && selectedElements[0].type === "arrow") {
    const sel = selectedElements[0];
    const targetId = sel.startBinding?.elementId || sel.endBinding?.elementId;
    if (targetId) {
      const target = ea.getViewElements().find((el) => el.id === targetId);
      mostRecentlySelectedNodeID = target?.id;
      return target;
    }
    return;
  }

  // Possibly Text + Container Selection
  if (selectedElements.length === 2) {
    const textEl = selectedElements.find((el) => el.type === "text");
    if (textEl && textEl.boundElements.length > 0 && textEl.customData.hasOwnProperty("mindmapOrder")) {
      mostRecentlySelectedNodeID = textEl.id;
      return textEl;
    } else if (textEl) {
      const containerId = textEl.containerId;
      if (containerId) {
        const container = selectedElements.find((el) => el.id === containerId);
        if (container && container.boundElements.length > 0 && container.customData.hasOwnProperty("mindmapOrder")) {
          mostRecentlySelectedNodeID = container.id;
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
      mostRecentlySelectedNodeID = rootId;
      return selectedElements.find((el) => el.id === rootId);
    }
  }
}

const ensureNodeSelected = () => {
  const elementToSelect = getMindmapNodeFromSelection();
  if (elementToSelect) {
    selectNodeInView(elementToSelect);
  }
};

/**
 * Retrieves the parent node of a specific element.
 */
const getParentNode = (id, allElements, parentMap = null) => {
  if (parentMap && parentMap.has(id)) {
    return parentMap.get(id);
  }

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

/**
 * Returns the IDs of root nodes in the scene
 * - A root node is defined as a node with `growthMode` that has only outgoing branch arrows, or no branch arrows at all.
 * @returns {string[]} An array of root node IDs.
 */
const getMasterRoots = () => {
  const all = ea.getViewElements();
  const allMap = new Map(all.map((el) => [el.id, el]));
  const maybeRoots = all.filter((el) => el.customData?.growthMode);
  const roots = maybeRoots.filter((r) => {
    const notRoot = r.boundElements.some((be) => {
      if (be.type !== "arrow") return false;
      const arrow = allMap.get(be.id);
      if (!arrow) return false;
      if (!arrow.customData?.isBranch) return false;
      if (arrow.endBinding?.elementId === r.id) return true;
      return false;
    });
    return !notRoot;
  });

  return roots.map((r) => r.id);
};

/**
 * Traverses up the tree to find the root and depth.
 */
const getHierarchy = (el, allElements, elementById = null, parentMap = null) => {
  // Optimization: If we have an ID lookup, use it, otherwise perform search
  if(elementById) {
    el = getBoundaryHost([el]) ?? el;
  } else {
    // Legacy behavior for ad-hoc calls
    el = getBoundaryHost([el]) ?? el;
  }

  let depth = 0,
    curr = el,
    l1Id = el.id,
    rootId = el.id;
  const visited = new Set([el.id]);

  while (true) {
    let p = getParentNode(curr.id, allElements, parentMap);
    
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

/**
 * Returns the nearest configuration root for the selected node.
 * - Additional roots (`isAdditionalRoot`) act as local configuration roots.
 * - If none is found on the path, the master root is returned.
 */
const getSettingsRootNode = (el, allElements, elementById = null, parentMap = null) => {
  if (!el) return null;

  let curr = getBoundaryHost([el]) ?? el;
  let last = curr;
  const visited = new Set();

  while (curr && !visited.has(curr.id)) {
    visited.add(curr.id);
    last = curr;

    if (curr.customData?.isAdditionalRoot === true) {
      return curr;
    }

    const p = getParentNode(curr.id, allElements, parentMap);
    if (!p) {
      return curr; // master root
    }
    curr = p;
  }

  return last;
};

/**
 * Returns depth from a specific ancestor.
 * If the ancestor is not found, it safely falls back to absolute hierarchy depth.
 */
const getDepthFromAncestor = (nodeId, ancestorId, allElements, parentMap = null) => {
  const byId = buildElementMap(allElements);
  let curr = byId.get(nodeId);
  if (!curr) return 0;

  let depth = 0;
  const visited = new Set();
  while (curr && !visited.has(curr.id)) {
    if (curr.id === ancestorId) return depth;
    visited.add(curr.id);
    curr = getParentNode(curr.id, allElements, parentMap);
    depth++;
  }

  const fallbackNode = byId.get(nodeId);
  return fallbackNode ? getHierarchy(fallbackNode, allElements, byId, parentMap).depth : 0;
};

const MAP_ROOT_CUSTOMDATA_KEYS = [
  "isAdditionalRoot",
  "growthMode",
  "autoLayoutDisabled",
  "arrowType",
  "fontsizeScale",
  "multicolor",
  "boxChildren",
  "roundedCorners",
  "maxWrapWidth",
  "isSolidArrow",
  "centerText",
  "fillSweep",
  "branchScale",
  "baseStrokeWidth",
  "layoutSettings",
];

const inferDirectionalGrowthMode = (node, parent, sourceRoot = null, sourceMode = null) => {
  if (!node || !parent) return "Right-facing";

  const mode = sourceMode || sourceRoot?.customData?.growthMode || currentModalGrowthMode;
  const nodeCenter = { x: node.x + node.width / 2, y: node.y + node.height / 2 };

  const ref = sourceRoot
    ? { x: sourceRoot.x + sourceRoot.width / 2, y: sourceRoot.y + sourceRoot.height / 2 }
    : { x: parent.x + parent.width / 2, y: parent.y + parent.height / 2 };

  // Single-direction maps inherit their direction directly.
  if (mode === "Up-facing") return "Up-facing";
  if (mode === "Down-facing") return "Down-facing";
  if (mode === "Right-facing") return "Right-facing";
  if (mode === "Left-facing") return "Left-facing";

  // Dual-axis directional map: infer by vertical side relative to map root.
  if (mode === "Up-Down") {
    return nodeCenter.y < ref.y ? "Up-facing" : "Down-facing";
  }

  // Right-Left and Radial maps: infer by horizontal side relative to map root.
  if (mode === "Right-Left" || mode === "Radial") {
    return nodeCenter.x >= ref.x ? "Right-facing" : "Left-facing";
  }

  // Fallback to geometric heuristic.
  const dx = nodeCenter.x - ref.x;
  const dy = nodeCenter.y - ref.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "Right-facing" : "Left-facing";
  }
  return dy >= 0 ? "Down-facing" : "Up-facing";
};

const getRootConfigForNode = (rootNode) => {
  const cd = rootNode?.customData ?? {};
  const defaultLayout = layoutSettings || {};
  return {
    growthMode: cd?.growthMode || currentModalGrowthMode,
    autoLayoutDisabled: cd?.autoLayoutDisabled === true,
    arrowType: cd?.arrowType ?? arrowType,
    fontsizeScale: cd?.fontsizeScale ?? fontsizeScale,
    multicolor: typeof cd?.multicolor === "boolean" ? cd.multicolor : multicolor,
    boxChildren: typeof cd?.boxChildren === "boolean" ? cd.boxChildren : boxChildren,
    roundedCorners: typeof cd?.roundedCorners === "boolean" ? cd.roundedCorners : roundedCorners,
    maxWrapWidth: typeof cd?.maxWrapWidth === "number" ? cd.maxWrapWidth : maxWidth,
    isSolidArrow: typeof cd?.isSolidArrow === "boolean" ? cd.isSolidArrow : isSolidArrow,
    centerText: typeof cd?.centerText === "boolean" ? cd.centerText : centerText,
    fillSweep: typeof cd?.fillSweep === "boolean" ? cd.fillSweep : fillSweep,
    branchScale: cd?.branchScale ?? branchScale,
    baseStrokeWidth: typeof cd?.baseStrokeWidth === "number" ? cd.baseStrokeWidth : baseStrokeWidth,
    layoutSettings: JSON.parse(JSON.stringify(cd?.layoutSettings ?? defaultLayout)),
  };
};

/**
 * Temporarily applies map/root settings for layout calculations, then restores globals.
 * This allows nested additional roots to layout with their own strategy.
 */
const withRootLayoutContext = (rootNode, fn) => {
  const previous = {
    growthMode: currentModalGrowthMode,
    arrowType,
    centerText,
    fillSweep,
    layoutSettings: layoutSettings,
  };

  const cfg = getRootConfigForNode(rootNode);
  currentModalGrowthMode = cfg.growthMode;
  arrowType = cfg.arrowType;
  centerText = cfg.centerText;
  fillSweep = cfg.fillSweep;
  layoutSettings = JSON.parse(JSON.stringify(cfg.layoutSettings));

  try {
    return fn(cfg);
  } finally {
    currentModalGrowthMode = previous.growthMode;
    arrowType = previous.arrowType;
    centerText = previous.centerText;
    fillSweep = previous.fillSweep;
    layoutSettings = previous.layoutSettings;
  }
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
      ea.addAppendUpdateCustomData(el.id, { foldState: undefined });
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
const updateBranchVisibility = (nodeId, parentHidden, allElements, isRootOfFold, rootId) => {
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

      // Skip other structural elements (like parents or siblings in the same group).
      // This prevents a hidden child node from hiding its visible parent/siblings 
      // when "Group Branches" is active.
      if (isStructuralElement(el, allElements, rootId)) return;

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
    updateBranchVisibility(child.id, childrenHidden, allElements, false, rootId);
  });
};

/**
 * Toggles the folded state of the selected node's branch.
 * Supports different modes: L0 (direct children), L1 (grandchildren), ALL (recursive).
 * 
 * @param {string} mode - "L0" | "L1" | "ALL"
 */
const toggleFold = async (mode = "L0") => {
  if (!isViewSet()) return;
  const sel = getMindmapNodeFromSelection();
  if (!sel) return;

  const allViewElements = ea.getViewElements();
  const info = getHierarchy(sel, allViewElements);
  
  // Only target elements in the specific mindmap tree to avoid massive array loops 
  const projectElements = getMindmapProjectElements(info.rootId, allViewElements);
  ea.copyViewElementsToEAforEditing(projectElements);
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

  updateBranchVisibility(targetNode.id, false, wbElements, true, info.rootId);

  await addElementsToView({ captureUpdate: autoLayoutDisabled ? "IMMEDIATELY" : "EVENTUALLY" });

  if (!autoLayoutDisabled) {
    await triggerGlobalLayout(info.rootId);
  }

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

const moveDecorations = (allElements, originalPositions, groupToNodes, rootId, elementById, parentMap) => {
  const structuralIds = new Set();
  if (rootId) {
    allElements.forEach(el => {
      if (isStructuralElement(el, allElements, rootId, elementById, parentMap)) {
        structuralIds.add(el.id);
      }
    });
  }

  const decorationsToUpdate = [];

  allElements.forEach(el => {
    // Optimization: O(1) lookup instead of function call
    const isStructural = structuralIds.has(el.id); 
    const isCrossLink = el.type === "arrow" && !el.customData?.isBranch && el.startBinding?.elementId && el.endBinding?.elementId;
    
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
             minXOld = Math.min(minXOld, oldPos.x);
             minYOld = Math.min(minYOld, oldPos.y);
             maxXOld = Math.max(maxXOld, oldPos.x + n.width);
             maxYOld = Math.max(maxYOld, oldPos.y + n.height);

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
const scaleDecorations = (oldNode, newNode, allElements, rootId) => {
  if (!oldNode.groupIds || oldNode.groupIds.length === 0) return;

  const groupElements = ea.getElementsInTheSameGroupWithElement(oldNode, allElements);
  // Filter out the node itself and structural elements
  const decorations = groupElements.filter(el => 
    el.id !== oldNode.id && 
    !isStructuralElement(el, allElements, rootId)
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
  if (!isViewSet()) return;
  let sel = getMindmapNodeFromSelection();
  
  // Fallback to most recently selected if nothing is currently selected
  if (!sel && mostRecentlySelectedNodeID) {
    const fallback = ea.getViewElements().find(el => el.id === mostRecentlySelectedNodeID);
    if (fallback) {
      sel = fallback;
      selectNodeInView(sel);
      focusInputEl();
    } else {
      mostRecentlySelectedNodeID = null;
    }
  }
  
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
  if (!isViewSet()) return;
  let sel = getMindmapNodeFromSelection();
  
  // Fallback to most recently selected if nothing is currently selected
  if (!sel) {
    if (!mostRecentlySelectedNodeID) {
      const roots = getMasterRoots();
      if (roots.length > 0) {
        mostRecentlySelectedNodeID = roots[0];
      }
      if (!mostRecentlySelectedNodeID) return;
    }
    const fallback = ea.getViewElements().find(el => el.id === mostRecentlySelectedNodeID);
    if (fallback) {
      sel = fallback;
      selectNodeInView(sel);
      focusInputEl();
    } else {
      mostRecentlySelectedNodeID = null;
    }
  }

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

  // Bypass calculation and use the true visual bounding box for manual submaps
  if (node.customData?.isAdditionalRoot && node.customData?.autoLayoutDisabled) {
    const branchIds = getBranchElementIds(nodeId, allElements);
    const branchElements = allElements.filter(el => branchIds.includes(el.id) && el.opacity > 0 && !el.isDeleted);
    const bbox = ea.getBoundingBox(branchElements);
    const height = bbox.height;
    if (heightCache) heightCache.set(nodeId, height);
    return height;
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

const getSubtreeWidth = (nodeId, allElements, childrenByParent, widthCache, elementById) => {
  if (widthCache?.has(nodeId)) return widthCache.get(nodeId);

  const node = elementById?.get(nodeId) ?? allElements.find((el) => el.id === nodeId);
  if (!node) return 0;

  if (node.customData?.isFolded) {
    const foldedWidth = node.width;
    if (widthCache) widthCache.set(nodeId, foldedWidth);
    return foldedWidth;
  }

  const children = childrenByParent?.get(nodeId) ?? getChildrenNodes(nodeId, allElements);
  const unpinnedChildren = children.filter(child => !child.customData?.isPinned);

  let totalWidth = 0;

  if (unpinnedChildren.length === 0) {
    totalWidth = node.width;
  } else {
    let childrenWidth = 0;
    unpinnedChildren.forEach((child, index) => {
      childrenWidth += getSubtreeWidth(child.id, allElements, childrenByParent, widthCache, elementById);
      if (index < unpinnedChildren.length - 1) {
        const childNode = elementById?.get(child.id) ?? allElements.find((el) => el.id === child.id);

        // Check if child behaves as a leaf (ignoring pinned descendants)
        const grandChildren = childrenByParent?.get(child.id) ?? getChildrenNodes(child.id, allElements);
        const hasUnpinnedGrandChildren = grandChildren.some(gc => !gc.customData?.isPinned);

        const fontSize = childNode.fontSize ?? 20;
        // For vertical layouts, we reuse GAP_Y as the horizontal sibling gap to maintain proportion
        const gap = !hasUnpinnedGrandChildren ? Math.round(fontSize * layoutSettings.GAP_MULTIPLIER) : layoutSettings.GAP_Y;
        childrenWidth += gap;
      }
    });
    totalWidth = Math.max(node.width, childrenWidth);
  }

  // Feature: Boundary Spacing
  // If the node has a visual boundary, add padding to the total subtree height
  // The boundary adds 15px padding on all sides (see updateNodeBoundary), so we add 2*15=30px
  if (node.customData?.boundaryId) {
    totalWidth += 30;
  }

  if (widthCache) widthCache.set(nodeId, totalWidth);
  return totalWidth;
};

const getVerticalPlacementWidth = (nodeId, allElements, childrenByParent, widthCache, elementById, placementWidthCache = null) => {
  if (placementWidthCache?.has(nodeId)) return placementWidthCache.get(nodeId);

  const node = elementById?.get(nodeId) ?? allElements.find((el) => el.id === nodeId);
  if (!node) return 0;

  const baseWidth = getSubtreeWidth(nodeId, allElements, childrenByParent, widthCache, elementById);

  // Short-circuit if this is a manual submap
  if (node.customData?.isAdditionalRoot !== true || node.customData?.autoLayoutDisabled === true) {
    if (placementWidthCache) placementWidthCache.set(nodeId, baseWidth);
    return baseWidth;
  }

  const mode = node.customData?.growthMode;
  if (!["Right-facing", "Left-facing", "Right-Left"].includes(mode)) {
    if (placementWidthCache) placementWidthCache.set(nodeId, baseWidth);
    return baseWidth;
  }

  const children = childrenByParent?.get(nodeId) ?? getChildrenNodes(nodeId, allElements);
  const unpinnedChildren = children.filter(child => !child.customData?.isPinned);
  if (unpinnedChildren.length === 0) {
    if (placementWidthCache) placementWidthCache.set(nodeId, baseWidth);
    return baseWidth;
  }

  const childWidths = unpinnedChildren.map((child) =>
    getVerticalPlacementWidth(child.id, allElements, childrenByParent, widthCache, elementById, placementWidthCache)
  );

  const primaryGap = layoutSettings.GAP_X;
  const compactMinWidth = node.width + layoutSettings.GAP_Y * 2;
  let projectedWidth;

  if (mode === "Right-facing" || mode === "Left-facing") {
    const maxChildWidth = childWidths.reduce((max, width) => Math.max(max, width), 0);
    const directionalRawWidth = Math.max(node.width, node.width + primaryGap + maxChildWidth);
    // Single-sided directional submaps mostly expand away from siblings.
    // Compress their reserved slot width to avoid over-spacing in vertical parent layout.
    const singleSideBlend = layoutSettings.VERTICAL_SUBTREE_WIDTH_BLEND_SINGLE ?? LAYOUT_METADATA.VERTICAL_SUBTREE_WIDTH_BLEND_SINGLE.def;
    projectedWidth = Math.max(
      compactMinWidth,
      node.width + (directionalRawWidth - node.width) * singleSideBlend,
    );
  } else {
    const nodeCenterX = node.x + node.width / 2;
    let leftMax = 0;
    let rightMax = 0;

    unpinnedChildren.forEach((child, index) => {
      const childCenterX = child.x + child.width / 2;
      if (childCenterX < nodeCenterX) {
        leftMax = Math.max(leftMax, childWidths[index]);
      } else {
        rightMax = Math.max(rightMax, childWidths[index]);
      }
    });

    const directionalRawWidth = node.width +
      (leftMax > 0 ? primaryGap + leftMax : 0) +
      (rightMax > 0 ? primaryGap + rightMax : 0);
    // Dual-sided maps need more reserved width than single-sided ones, but still less than full bbox width.
    const dualSideBlend = layoutSettings.VERTICAL_SUBTREE_WIDTH_BLEND_DUAL ?? LAYOUT_METADATA.VERTICAL_SUBTREE_WIDTH_BLEND_DUAL.def;
    projectedWidth = Math.max(
      compactMinWidth,
      node.width + (Math.max(node.width, directionalRawWidth) - node.width) * dualSideBlend,
    );
  }

  if (node.customData?.boundaryId) {
    projectedWidth += 30;
  }

  const effectiveWidth = Math.min(baseWidth, projectedWidth);

  // Smooth width growth so adding the 2nd/3rd child does not suddenly blow up sibling spacing.
  const widthExtra = Math.max(0, effectiveWidth - node.width);
  const smoothThresholdMultiplier = layoutSettings.VERTICAL_SUBTREE_SMOOTH_THRESHOLD_MULTIPLIER ?? LAYOUT_METADATA.VERTICAL_SUBTREE_SMOOTH_THRESHOLD_MULTIPLIER.def;
  const softThreshold = Math.max(
    layoutSettings.GAP_X,
    layoutSettings.GAP_Y * smoothThresholdMultiplier,
  );

  let smoothedWidth = effectiveWidth;
  if (widthExtra > softThreshold) {
    const smoothMinScale = layoutSettings.VERTICAL_SUBTREE_SMOOTH_MIN_SCALE ?? LAYOUT_METADATA.VERTICAL_SUBTREE_SMOOTH_MIN_SCALE.def;
    const compressionScale = Math.max(smoothMinScale, layoutSettings.GAP_X * 2);
    const remaining = widthExtra - softThreshold;
    const compressedRemaining = compressionScale * Math.log1p(remaining / compressionScale);
    smoothedWidth = node.width + softThreshold + compressedRemaining;
  }

  if (placementWidthCache) placementWidthCache.set(nodeId, smoothedWidth);
  return smoothedWidth;
};

/**
 * Determines if an element is part of the mindmap structure.
 */
const isStructuralElement = (el, allElements, rootId = null, elementById = null, parentMap = null) => {
  const isStructuralType = el.customData?.isBranch || el.customData?.growthMode || el.customData?.isBoundary || typeof el.customData?.mindmapOrder !== "undefined";
  
  if (rootId && isStructuralType) {
    let targetEl = el;
    
    if (el.type === "arrow" && el.customData?.isBranch) {
      const targetId = el.endBinding?.elementId || el.startBinding?.elementId;
      if (targetId) {
        targetEl = elementById?.get(targetId) || allElements.find(e => e.id === targetId);
      }
    }
    
    if (!targetEl) return false;

    // Pass maps to getHierarchy to prevent O(N) lookups
    const info = getHierarchy(targetEl, allElements, elementById, parentMap);
    if (info?.rootId === rootId) return true;
    if (info?.rootId) return false; 
  }

  if (!rootId && isStructuralType) return true;

  const connectedArrow = allElements.find(a =>
    a.type === "arrow" &&
    a.customData?.isBranch &&
    (a.startBinding?.elementId === el.id || a.endBinding?.elementId === el.id)
  );
  return !!connectedArrow;
};

const getViewGroupElements = (groupID) => {
  return ea.getViewElements().filter( el => el.groupIds.includes(groupID) );
}

const getCommonGroupForElements = (elements) => {
  const groupIds = elements
    .map(el=>el.groupIds)
    .reduce((prev,cur)=>cur.filter(v=>prev.includes(v)));
  return groupIds;
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

const collectDecorationIds = (allElements, rootId) => new Set(
  allElements
    .filter(el => el.groupIds && el.groupIds.length > 0 && !isStructuralElement(el, allElements, rootId))
    .map(el => el.id)
);

/**
 * Finds the first group ID in the element's group stack that qualifies as a Mindmap Group.
 */
const getStructuralGroup = (element, allElements, rootId) => {
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

const updateNodeBoundary = (node, allElements, rootId) => {
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

  const root = allElements.find(el => el.id === rootId);
  const growthMode = root?.customData?.growthMode || currentModalGrowthMode;
  const isVerticalBoundaryMode = growthMode === "Up-facing" || growthMode === "Down-facing" || growthMode === "Up-Down";

  const padding = 15;
  let allPoints =[];

  branchElements.forEach(el => {
    if (isVerticalBoundaryMode && el.type === "arrow" && Array.isArray(el.points) && el.points.length > 0) {
      el.points.forEach(([px, py]) => {
        const x = el.x + px;
        const y = el.y + py;
        allPoints.push([x - padding, y - padding]);
        allPoints.push([x + padding, y - padding]);
        allPoints.push([x + padding, y + padding]);
        allPoints.push([x - padding, y + padding]);
      });
      return;
    }

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

  // Subdivide long segments to tame the bezier curve over-extension
  const subdividedPoints =[];
  const MAX_SEGMENT_LENGTH = layoutSettings.MAX_SEGMENT_LENGTH ?? LAYOUT_METADATA.MAX_SEGMENT_LENGTH.def;
  for (let i = 0; i < hullPoints.length; i++) {
    const p1 = hullPoints[i];
    const p2 = hullPoints[(i + 1) % hullPoints.length];
    subdividedPoints.push(p1);
    
    const dist = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    if (dist > MAX_SEGMENT_LENGTH) {
      const steps = Math.ceil(dist / MAX_SEGMENT_LENGTH);
      for (let j = 1; j < steps; j++) {
        subdividedPoints.push([
          p1[0] + (p2[0] - p1[0]) * (j / steps),
          p1[1] + (p2[1] - p1[1]) * (j / steps)
        ]);
      }
    }
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  // Calculate bounding box using the original hull points
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

  // Use the newly subdivided points for the final path
  const normalizedPoints = subdividedPoints.map(p => [p[0] - minX, p[1] - minY]);
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
     boundaryEl.groupIds =[];
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

const updateRootNodeCustomData = async (data, sel) => {
  if (!sel) sel = getMindmapNodeFromSelection();
  if (sel) {
    const allElements = ea.getViewElements();
    const settingsRoot = getSettingsRootNode(sel, allElements);
    if (!settingsRoot) return null;

    ea.copyViewElementsToEAforEditing(allElements.filter((e) => e.id === settingsRoot.id));
    ea.addAppendUpdateCustomData(settingsRoot.id, { ...data });
    await addElementsToView({ captureUpdate: "NEVER" });
    updateUI();
    const info = getHierarchy(settingsRoot, ea.getViewElements());
    return {
      ...info,
      rootId: settingsRoot.id,
      settingsRootId: settingsRoot.id,
    };
  }
  return null;
}

/**
 * Recursively updates the stroke width of a subtree.
 * Checks if the existing arrow matches the 'old' calculated width. 
 * If it does, updates to 'new' width. If not, assumes manual override and skips.
 */
const updateBranchStrokes = async (rootId, oldBaseWidth, oldScaleMode, newBaseWidth, newScaleMode) => {
  if (!isViewSet()) return;
  const allElements = ea.getViewElements();
  const root = allElements.find(el => el.id === rootId);
  if (!root) return;

  const elementsToUpdate = [];
  let manualOverrideFound = false;

  const traverse = (nodeId, depth) => {
    const children = getChildrenNodes(nodeId, allElements);
    
    children.forEach(child => {
      // Find the arrow connecting parent (nodeId) to child
      const arrow = allElements.find(
        a => a.type === "arrow" &&
        a.customData?.isBranch &&
        a.startBinding?.elementId === nodeId &&
        a.endBinding?.elementId === child.id
      );

      if (arrow) {
        // Calculate what the width *should* have been under old settings
        // Note: 'depth' is parent depth. Arrow depth in addNode logic was 'depth' (where parent is depth-1).
        // In addNode: 
        // if !parent (root), depth=0. 
        // if parent, info=getHierarchy(parent), depth = info.depth + 1. 
        // strokeWidth = getStrokeWidthForDepth(depth).
        // So the arrow leading TO the node at 'depth' uses 'depth' for calculation.
        // Here, 'child' is at depth + 1 relative to 'nodeId' (which is at 'depth').
        const childDepth = depth + 1;
        
        const expectedOldWidth = calculateStrokeWidth(childDepth, oldBaseWidth, oldScaleMode);
        
        // Allow a small floating point tolerance
        if (Math.abs(arrow.strokeWidth - expectedOldWidth) < 0.05) {
          const newWidth = calculateStrokeWidth(childDepth, newBaseWidth, newScaleMode);
          if (Math.abs(arrow.strokeWidth - newWidth) > 0.001) {
            elementsToUpdate.push({id: arrow.id, strokeWidth: newWidth});
          }
        } else {
          // If it doesn't match old width, check if it matches new width (already updated?)
          const expectedNewWidth = calculateStrokeWidth(childDepth, newBaseWidth, newScaleMode);
          if (Math.abs(arrow.strokeWidth - expectedNewWidth) >= 0.05) {
             manualOverrideFound = true;
          }
        }
      }

      traverse(child.id, depth + 1);
    });
  };

  traverse(rootId, 0);

  if (elementsToUpdate.length > 0) {
    ea.copyViewElementsToEAforEditing(elementsToUpdate.map(i => allElements.find(e => e.id === i.id)));
    elementsToUpdate.forEach(item => {
      const el = ea.getElement(item.id);
      if (el) el.strokeWidth = item.strokeWidth;
    });
    await addElementsToView({ captureUpdate: "IMMEDIATELY" });
  }

  if (manualOverrideFound) {
    new Notice(t("NOTICE_BRANCH_WIDTH_MANUAL_OVERRIDE"));
  }
};

const addUpdateArrowLabel = (arrow, text) => {
  if (!arrow) {
    return;
  }
  const maybeTextElement = ea.getBoundTextElement(arrow, true);
  let textElement = maybeTextElement.eaElement;
  if (!textElement && maybeTextElement.sceneElement) {
    ea.copyViewElementsToEAforEditing([maybeTextElement.sceneElement]);
    textElement = ea.getElement(maybeTextElement.sceneElement.id);
  }
  if (textElement) {
    if (!text) {
      textElement.isDeleted = true;
    } else {
      textElement.rawText = text;
      textElement.text = text;
      textElement.originalText = text;
    }
    return;
  }
  if (!text) {
    return;
  }
  const x = arrow.x + arrow.width/2;
  const y = arrow.y + arrow.height/2;
  const textId = ea.addText(x, y, text);
  const textEl = ea.getElement(textId);
  
  textEl.strokeColor = arrow.strokeColor;
  textEl.containerId = arrow.id;
  textEl.textAlign = "center";
  textEl.textVerticalAlign = "middle";
  textEl.fontSize = Math.floor(textEl.fontSize / 2);

  arrow.boundElements = [{ type: "text", id: textId }];
}

const configureArrow = (context) => {
  const {arrowId, isChildRight, isChildBelow, startId, endId, coordinates, isRadial, layoutDirection} = context;
  const {sX, sY, eX, eY} = coordinates;

  const eaArrow = ea.getElement(arrowId);
  const isVertical = layoutDirection === "vertical";

  if (isVertical) {
    // Configure Binding Points (using .0001/.9999 to avoid jumping effect)
    // In Radial mode, bind to the center (0.5) of the root node
    const startRatio = isRadial ? 0.50001 : (isChildBelow ? 0.9999 : 0.0001);
    const endRatio = isChildBelow ? 0.0001 : 0.9999;
    const centerRatio = 0.5001;

    eaArrow.startBinding = {
      ...eaArrow.startBinding,
      elementId: startId,
      mode: "orbit",
      fixedPoint: [centerRatio, startRatio]
    };

    eaArrow.endBinding = {
      ...eaArrow.endBinding,
      elementId: endId,
      mode: "orbit",
      fixedPoint: [centerRatio, endRatio]
    };

    eaArrow.x = sX;
    eaArrow.y = sY;

    const dx = eX - sX;
    const dy = eY - sY;

    if (arrowType === "straight") {
      eaArrow.roundness = null;
      eaArrow.points = [
        [0, 0],
        [dx, dy]
      ];
    } else {
      eaArrow.roundness = { type: 2 };
      if (isRadial) {
        // Swapped coefficients for vertical curve: Y progresses faster than X initially
        eaArrow.points = [
          [0, 0],[dx * 0.75, dy * 2 / 3],
          [dx, dy]
        ];
      } else {
        // Swapped coefficients for vertical curve: Y progresses faster than X initially
        // This ensures lines shoot out vertically first before fanning out horizontally
        eaArrow.points = [
          [0, 0],[dx * 0.25, dy / 3],[dx * 0.75, dy * 2 / 3],
          [dx, dy]
        ];
      }
    }
  } else {
    // Standard horizontal logic
    // Configure Binding Points (using .0001/.9999 to avoid jumping effect)
    // In Radial mode, bind to the center (0.5) of the root node
    const startRatio = isRadial ? 0.50001 : (isChildRight ? 0.9999 : 0.0001);
    const endRatio = isChildRight ? 0.0001 : 0.9999;
    const centerYRatio = 0.5001;

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
        [0, 0],[dx, dy]
      ];
    } else {
      eaArrow.roundness = { type: 2 };
      if (isRadial) {
        eaArrow.points = [
          [0, 0],
          [dx * 2 / 3, dy * 0.75],[dx, dy]
        ];
      } else {
        // Standard horizontal curve: X progresses faster than Y initially
        eaArrow.points = [
          [0, 0],[dx / 3, dy * 0.25],
          [dx * 2 / 3, dy * 0.75],[dx, dy]
        ];
      }
    }
  }
};

/**
 * Layout entrypoint for nodes marked as additional roots.
 * The node position itself is controlled by the parent/root layout pass.
 * Only its descendants are laid out using this node's local root settings.
 */
const layoutChildrenAsAdditionalRoot = (nodeId, allElements, hasGlobalFolds, childrenByParent, heightCache, widthCache, elementById, mustHonorMindmapOrder = false, parentMap = null) => {
  const node = elementById?.get(nodeId) ?? allElements.find((el) => el.id === nodeId);
  if (!node || node.customData?.isAdditionalRoot !== true) return false;

  const l1Nodes = getChildrenNodes(nodeId, allElements);
  if (l1Nodes.length === 0) return false;

  // Apply local submap settings for this subtree only.
  withRootLayoutContext(node, (cfg) => {
    const localHeightCache = heightCache ?? new Map();
    const localWidthCache = widthCache ?? new Map();
    const eaNode = ea.getElement(nodeId);
    if (!eaNode) return;

    const rootBox = getNodeBox(eaNode, allElements);
    const rootCenter = {
      x: rootBox.minX + rootBox.width / 2,
      y: rootBox.minY + rootBox.height / 2,
    };

    const mode = cfg.growthMode;
    const layoutContext = {
      allElements,
      rootId: nodeId,
      rootBox,
      rootCenter,
      hasGlobalFolds,
      mode,
      childrenByParent,
      heightCache: localHeightCache,
      widthCache: localWidthCache,
      elementById,
      parentMap,
    };

    // If order is not explicitly locked by an operation, sync to visual sequence.
    if (!mustHonorMindmapOrder) {
      sortL1NodesBasedOnVisualSequence(l1Nodes, mode, rootCenter);
    }

    if (mode === "Radial") {
      layoutL1Nodes(l1Nodes, {
        sortMethod: "radial",
        centerAngle: null,
        gapMultiplier: layoutSettings.GAP_MULTIPLIER_RADIAL,
        fillSweep: cfg.fillSweep,
      }, layoutContext, mustHonorMindmapOrder);
      return;
    }

    if (["Right-facing", "Left-facing", "Right-Left"].includes(mode)) {
      const leftNodes = [];
      const rightNodes = [];

      if (mode === "Right-Left") {
        l1Nodes.forEach((child) => {
          const childCX = child.x + child.width / 2;
          if (childCX > rootCenter.x) rightNodes.push(child);
          else leftNodes.push(child);
        });

        // If all children are on one side (e.g. after fresh conversion), balance using order.
        if ((leftNodes.length === 0 || rightNodes.length === 0) && l1Nodes.length > 1) {
          leftNodes.length = 0;
          rightNodes.length = 0;
          const splitIdx = Math.ceil(l1Nodes.length / 2);
          l1Nodes.forEach((child, i) => {
            if (i < splitIdx) rightNodes.push(child);
            else leftNodes.push(child);
          });
        }
      } else if (mode === "Left-facing") {
        l1Nodes.forEach((child) => leftNodes.push(child));
      } else {
        l1Nodes.forEach((child) => rightNodes.push(child));
      }

      if (rightNodes.length > 0) {
        layoutL1Nodes(rightNodes, { sortMethod: "vertical", centerAngle: 90, gapMultiplier: layoutSettings.GAP_MULTIPLIER_DIRECTIONAL }, layoutContext, mustHonorMindmapOrder);
      }
      if (leftNodes.length > 0) {
        layoutL1Nodes(leftNodes, { sortMethod: "vertical", centerAngle: 270, gapMultiplier: layoutSettings.GAP_MULTIPLIER_DIRECTIONAL }, layoutContext, mustHonorMindmapOrder);
      }
      return;
    }

    const upNodes = [];
    const downNodes = [];

    if (mode === "Up-Down") {
      l1Nodes.forEach((child) => {
        const childCY = child.y + child.height / 2;
        if (childCY > rootCenter.y) downNodes.push(child);
        else upNodes.push(child);
      });

      if ((upNodes.length === 0 || downNodes.length === 0) && l1Nodes.length > 1) {
        upNodes.length = 0;
        downNodes.length = 0;
        const splitIdx = Math.ceil(l1Nodes.length / 2);
        l1Nodes.forEach((child, i) => {
          if (i < splitIdx) downNodes.push(child);
          else upNodes.push(child);
        });
      }
    } else if (mode === "Up-facing") {
      l1Nodes.forEach((child) => upNodes.push(child));
    } else {
      l1Nodes.forEach((child) => downNodes.push(child));
    }

    layoutContext.widthCache = new Map();

    if (downNodes.length > 0) {
      layoutL1Nodes(downNodes, { sortMethod: "horizontal", centerAngle: 90, gapMultiplier: layoutSettings.GAP_MULTIPLIER_DIRECTIONAL }, layoutContext, mustHonorMindmapOrder);
    }
    if (upNodes.length > 0) {
      layoutL1Nodes(upNodes, { sortMethod: "horizontal", centerAngle: 270, gapMultiplier: layoutSettings.GAP_MULTIPLIER_DIRECTIONAL }, layoutContext, mustHonorMindmapOrder);
    }
  });

  return true;
};

const layoutSubtree = (nodeId, targetX, targetCenterY, side, allElements, hasGlobalFolds, childrenByParent, heightCache, elementById, mustHonorMindmapOrder = false, rootId, parentMap = null) => {
  const node = elementById?.get(nodeId) ?? allElements.find((el) => el.id === nodeId);
  const eaNode = ea.getElement(nodeId);

  const isPinned = node.customData?.isPinned === true;
  let dx = 0, dy = 0;

  if (!isPinned) {
    const newX = side === 1 ? targetX : targetX - node.width;
    const newY = targetCenterY - node.height / 2;
    dx = newX - eaNode.x;
    dy = newY - eaNode.y;
    eaNode.x = newX;
    eaNode.y = newY;
  }

  if (node.customData?.isFolded) return;

  const currentX = eaNode.x;
  const currentYCenter = eaNode.y + node.height / 2;

  let effectiveSide = side;
  const parent = getParentNode(nodeId, allElements, parentMap);

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

  const textElement = ea.getBoundTextElement(eaNode).eaElement;
  if (textElement && !centerText && textElement.textAlign !== "center") {
    textElement.textAlign = effectiveSide === 1 ? "left" : "right";
  }

  const children = childrenByParent?.get(nodeId) ?? getChildrenNodes(nodeId, allElements);

  // Additional roots are laid out as independent local maps for their descendants.
  // The additional-root node itself stays positioned by the parent layout pass.
  if (node.customData?.isAdditionalRoot === true) {
    if (node.customData?.autoLayoutDisabled) {
      // Shift all descendants to maintain manual layout relative to this root
      if (dx !== 0 || dy !== 0) {
        const branchIds = getBranchElementIds(nodeId, allElements);
        const descendants = branchIds.filter(id => id !== nodeId);
        descendants.forEach(descId => {
          const descNode = elementById?.get(descId) ?? allElements.find(e => e.id === descId);
          // Do not shift pinned elements
          if (descNode?.customData?.isPinned) return;
          // Do not shift non-branch arrows because moveCrossLinks automatically handles them
          if (descNode && descNode.type === "arrow" && !descNode.customData?.isBranch) return;
          
          if (!ea.getElement(descId)) {
             if (descNode) ea.copyViewElementsToEAforEditing([descNode]);
          }
          const descEl = ea.getElement(descId);
          if (descEl) {
             descEl.x += dx;
             descEl.y += dy;
          }
        });
      }
    } else {
      layoutChildrenAsAdditionalRoot(nodeId, allElements, hasGlobalFolds, childrenByParent, heightCache, null, elementById, mustHonorMindmapOrder, parentMap);
    }
    
    if (node.customData?.boundaryId) {
      updateNodeBoundary(node, ea.getElements(), rootId);
    }
    return;
  }

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
        mustHonorMindmapOrder,
        rootId,
        parentMap,
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
    rootId,
    parentMap,
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
     updateNodeBoundary(node, ea.getElements(), rootId);
  }
};

const updateL1Arrow = (node, context, layoutDirection = "horizontal") => {
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

    const isRadial = mode === "Radial";

    if (layoutDirection === "vertical") {
      const childCenterY = childNode.y + childNode.height / 2;
      const isChildBelow = childCenterY > rootCenter.y;

      // In Radial mode, start arrow from the center of the root node
      const sX = rootCenter.x;
      const sY = isRadial ? rootCenter.y : (isChildBelow ? rootNode.y + rootNode.height : rootNode.y);
      
      const eX = childNode.x + childNode.width / 2;
      const eY = isChildBelow ? childNode.y : childNode.y + childNode.height;

      configureArrow({
        arrowId: arrow.id, isChildBelow, startId: rootId, endId: node.id,
        coordinates: {sX, sY, eX, eY},
        isRadial, layoutDirection
      });
    } else {
      const childCenterX = childNode.x + childNode.width / 2;
      const isChildRight = childCenterX > rootCenter.x;

      // In Radial mode, start arrow from the center of the root node
      const sX = isRadial ? rootCenter.x : (isChildRight ? rootNode.x + rootNode.width : rootNode.x);
      const sY = rootCenter.y;
      
      const eX = isChildRight ? childNode.x : childNode.x + childNode.width;
      const eY = childNode.y + childNode.height / 2;

      configureArrow({
        arrowId: arrow.id, isChildRight, startId: rootId, endId: node.id,
        coordinates: {sX, sY, eX, eY},
        isRadial, layoutDirection
      });
    }
  }
};

const layoutSubtreeVertical = (nodeId, targetCenterX, targetY, side, allElements, hasGlobalFolds, childrenByParent, widthCache, elementById, mustHonorMindmapOrder = false, rootId, parentMap = null) => {
  const node = elementById?.get(nodeId) ?? allElements.find((el) => el.id === nodeId);
  const eaNode = ea.getElement(nodeId);

  const isPinned = node.customData?.isPinned === true;
  let dx = 0, dy = 0;

  if (!isPinned) {
    const newX = targetCenterX - node.width / 2;
    const newY = side === 1 ? targetY : targetY - node.height;
    dx = newX - eaNode.x;
    dy = newY - eaNode.y;
    eaNode.x = newX;
    eaNode.y = newY;
  }

  if (node.customData?.isFolded) return;

  const currentXCenter = eaNode.x + node.width / 2;
  const currentY = eaNode.y;

  let effectiveSide = side;
  const parent = getParentNode(nodeId, allElements, parentMap);

  if (parent) {
    const parentCenterY = parent.y + parent.height / 2;
    const nodeCenterY = currentY + node.height / 2;
    effectiveSide = nodeCenterY >= parentCenterY ? 1 : -1;
  }

  // Handle Fold Indicator
  if (node.customData?.foldIndicatorId) {
    const ind = ea.getElement(node.customData.foldIndicatorId);
    if(ind) {
      ind.x = eaNode.x + eaNode.width / 2 - ind.width / 2;
      if (effectiveSide === 1) {
          ind.y = eaNode.y + eaNode.height + layoutSettings.INDICATOR_OFFSET;
          ind.textAlign = "center";
      } else {
          ind.y = eaNode.y - layoutSettings.INDICATOR_OFFSET - ind.height;
          ind.textAlign = "center";
      }
    }
  }

  const textElement = ea.getBoundTextElement(eaNode).eaElement;
  if (textElement && !centerText && textElement.textAlign !== "center") {
    // In vertical mode, nodes usually look best centered, but we enforce it here
    textElement.textAlign = "center";
  }

  const children = childrenByParent?.get(nodeId) ?? getChildrenNodes(nodeId, allElements);

  // Additional roots are laid out as independent local maps for their descendants.
  // The additional-root node itself stays positioned by the parent layout pass.
  if (node.customData?.isAdditionalRoot === true) {
    if (node.customData?.autoLayoutDisabled) {
      // Shift all descendants to maintain manual layout relative to this root
      if (dx !== 0 || dy !== 0) {
        const branchIds = getBranchElementIds(nodeId, allElements);
        const descendants = branchIds.filter(id => id !== nodeId);
        descendants.forEach(descId => {
          const descNode = elementById?.get(descId) ?? allElements.find(e => e.id === descId);
          // Do not shift pinned elements
          if (descNode?.customData?.isPinned) return;
          // Do not shift non-branch arrows because moveCrossLinks automatically handles them
          if (descNode && descNode.type === "arrow" && !descNode.customData?.isBranch) return;
          
          if (!ea.getElement(descId)) {
             if (descNode) ea.copyViewElementsToEAforEditing([descNode]);
          }
          const descEl = ea.getElement(descId);
          if (descEl) {
             descEl.x += dx;
             descEl.y += dy;
          }
        });
      }
    } else {
      layoutChildrenAsAdditionalRoot(nodeId, allElements, hasGlobalFolds, childrenByParent, null, widthCache, elementById, mustHonorMindmapOrder, parentMap);
    }
    
    if (node.customData?.boundaryId) {
      updateNodeBoundary(node, ea.getElements(), rootId);
    }
    return;
  }

  const unpinnedChildren = children.filter(child => !child.customData?.isPinned);
  const pinnedChildren = children.filter(child => child.customData?.isPinned);

  if (unpinnedChildren.length > 0) {
    // SORTING LOGIC:
    // If mustHonorMindmapOrder is true: Explicitly sort by mindmapOrder to enforce the manual change.
    // If mustHonorMindmapOrder is false: Fallback to visual X-position to keep map strictly ordered by position (auto-layout).
    unpinnedChildren.sort((a, b) => {
      if (mustHonorMindmapOrder) {
        return getMindmapOrder(a) - getMindmapOrder(b);
      }
      const dx = a.x - b.x;
      if (dx !== 0) return dx;
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

    const placementWidthCache = new Map();
    const childWidths = unpinnedChildren.map((child) =>
      getVerticalPlacementWidth(child.id, allElements, childrenByParent, widthCache, elementById, placementWidthCache)
    );
    const childrenRowWidth = childWidths.reduce((sum, width, index) => {
      const childNode = elementById?.get(unpinnedChildren[index].id) ?? allElements.find((el) => el.id === unpinnedChildren[index].id);
      const grandChildren = childrenByParent?.get(unpinnedChildren[index].id) ?? getChildrenNodes(unpinnedChildren[index].id, allElements);
      const hasUnpinnedGrandChildren = grandChildren.some(gc => !gc.customData?.isPinned);
      const fontSize = childNode?.fontSize ?? 20;
      const gap = index < unpinnedChildren.length - 1
        ? (!hasUnpinnedGrandChildren ? Math.round(fontSize * layoutSettings.GAP_MULTIPLIER) : layoutSettings.GAP_Y)
        : 0;
      return sum + width + gap;
    }, 0);

    let currentX = currentXCenter - childrenRowWidth / 2;
    // Primary layout gap used for Parent-Child spacing (vertical)
    // Keep default spacing for larger branches, but tighten compact (1-2 child) subtrees.
    const allChildrenCompact = unpinnedChildren.every((child) => {
      const grandChildren = childrenByParent?.get(child.id) ?? getChildrenNodes(child.id, allElements);
      return !grandChildren.some(gc => !gc.customData?.isPinned);
    });
    const compactGap = Math.max(
      layoutSettings.GAP_Y,
      Math.round(layoutSettings.GAP_X * (layoutSettings.VERTICAL_COMPACT_PARENT_CHILD_GAP_RATIO ?? LAYOUT_METADATA.VERTICAL_COMPACT_PARENT_CHILD_GAP_RATIO.def)),
    );
    const dynamicGapPrimary = (unpinnedChildren.length <= 2 && allChildrenCompact)
      ? compactGap
      : layoutSettings.GAP_X;

    unpinnedChildren.forEach((child, index) => {
      const childW = childWidths[index];

      layoutSubtreeVertical(
        child.id,
        currentX + childW / 2,
        effectiveSide === 1 ? currentY + node.height + dynamicGapPrimary : currentY - dynamicGapPrimary,
        effectiveSide,
        allElements,
        hasGlobalFolds,
        childrenByParent,
        widthCache,
        elementById,
        mustHonorMindmapOrder,
        rootId,
        parentMap,
      );

      const childNode = elementById?.get(child.id) ?? allElements.find((el) => el.id === child.id);

      const grandChildren = childrenByParent?.get(child.id) ?? getChildrenNodes(child.id, allElements);
      const hasUnpinnedGrandChildren = grandChildren.some(gc => !gc.customData?.isPinned);

      const fontSize = childNode.fontSize ?? 20;
      // Reusing GAP_Y for the cross-axis (sibling) gap to maintain spacing proportionality
      const gap = !hasUnpinnedGrandChildren ? Math.round(fontSize * layoutSettings.GAP_MULTIPLIER) : layoutSettings.GAP_Y;

      currentX += childW + gap;
    });
  }

  pinnedChildren.forEach(child => layoutSubtreeVertical(
    child.id,
    child.x + child.width / 2,
    child.y + (effectiveSide === 1 ? 0 : child.height),
    effectiveSide,
    allElements,
    hasGlobalFolds,
    childrenByParent,
    widthCache,
    elementById,
    mustHonorMindmapOrder,
    rootId,
    parentMap,
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
      const childCenterY = eaChild.y + eaChild.height / 2;
      const parentCenterY = currentY + node.height / 2;
      const isChildBelow = childCenterY > parentCenterY;

      const sX = currentXCenter;
      const sY = isChildBelow ? currentY + node.height : currentY;
      
      const eX = eaChild.x + eaChild.width / 2;
      const eY = isChildBelow ? eaChild.y : eaChild.y + eaChild.height;

      configureArrow({
        arrowId: arrow.id, isChildBelow, startId:node.id, endId: child.id,
        coordinates: {sX, sY, eX, eY}, layoutDirection: "vertical"
      });
    }
  });

  if (node.customData?.boundaryId) {
     updateNodeBoundary(node, ea.getElements(), rootId);
  }
};

const radialL1Distribution = (nodes, context, l1Metrics, totalSubtreeHeight, options, mustHonorMindmapOrder = false) => {
  const { allElements, rootBox, rootCenter, hasGlobalFolds, childrenByParent, heightCache, elementById, rootId, parentMap } = context;
  const count = nodes.length;

  // --- CONFIGURATION FROM SETTINGS ---
  const START_ANGLE = layoutSettings.RADIAL_START_ANGLE; 
  
  // MODIFIED: Use options.fillSweep to force full sweep usage
  const MAX_SWEEP_DEG = options.fillSweep 
    ? layoutSettings.RADIAL_MAX_SWEEP 
    : Math.min(layoutSettings.RADIAL_MAX_SWEEP/8*count, layoutSettings.RADIAL_MAX_SWEEP); 
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
      layoutSubtree(node.id, node.x, node.y + node.height / 2, dynamicSide, allElements, hasGlobalFolds, childrenByParent, heightCache, elementById, mustHonorMindmapOrder, rootId, parentMap);
    } else {
      layoutSubtree(node.id, tCX, tCY, dynamicSide, allElements, hasGlobalFolds, childrenByParent, heightCache, elementById, mustHonorMindmapOrder, rootId, parentMap);
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
  const { allElements, rootBox, rootCenter, hasGlobalFolds, childrenByParent, heightCache, elementById, rootId, parentMap } = context;
  const count = nodes.length;

  // --- VERTICAL DIRECTIONAL LAYOUT (RIGHT/LEFT) ---
  const totalContentHeight = totalSubtreeHeight + (count - 1) * layoutSettings.GAP_Y;
  const radiusFromHeight = totalContentHeight / layoutSettings.DIRECTIONAL_ARC_SPAN_RADIANS;
  const radiusY = Math.max(Math.round(rootBox.height * layoutSettings.ROOT_RADIUS_FACTOR), layoutSettings.MIN_RADIUS, radiusFromHeight) + count * layoutSettings.RADIUS_PADDING_PER_NODE;
  const crossAxisRatio = layoutSettings.DIRECTIONAL_CROSS_AXIS_RATIO ?? LAYOUT_METADATA.DIRECTIONAL_CROSS_AXIS_RATIO.def;
  const radiusX = Math.max(Math.round(rootBox.width * layoutSettings.ROOT_RADIUS_FACTOR), layoutSettings.MIN_RADIUS, radiusY * crossAxisRatio) + count * layoutSettings.RADIUS_PADDING_PER_NODE;

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
      layoutSubtree(node.id, node.x, node.y + node.height / 2, side, allElements, hasGlobalFolds, childrenByParent, heightCache, elementById, mustHonorMindmapOrder, rootId, parentMap);
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
      layoutSubtree(node.id, tCX, tCY, side, allElements, hasGlobalFolds, childrenByParent, heightCache, elementById, mustHonorMindmapOrder, rootId, parentMap);
    }

    if (node.customData?.mindmapNew) {
      ea.addAppendUpdateCustomData(node.id, { mindmapNew: undefined });
    }
    updateL1Arrow(node, context);
    if (groupBranches) applyRecursiveGrouping(node.id, allElements);
  });
};

const horizontalL1Distribution = (nodes, context, l1Metrics, totalSubtreeWidth, isTopSide, centerAngle, gapMultiplier, mustHonorMindmapOrder = false) => {
  const { allElements, rootBox, rootCenter, hasGlobalFolds, childrenByParent, widthCache, elementById, rootId, parentMap } = context;
  const count = nodes.length;

  // --- HORIZONTAL DIRECTIONAL LAYOUT (UP/DOWN) ---
  const compressDirectionalWidth = (node, rawWidth) => {
    const nodeWidth = Math.max(node?.width ?? 0, 1);
    if (rawWidth <= nodeWidth) return rawWidth;

    const extra = rawWidth - nodeWidth;
    const softCapThreshold = layoutSettings.HORIZONTAL_L1_SOFTCAP_THRESHOLD ?? LAYOUT_METADATA.HORIZONTAL_L1_SOFTCAP_THRESHOLD.def;
    if (extra <= softCapThreshold) return rawWidth;

    // Preserve small/medium maps, compress only very large subtree footprints.
    const remaining = extra - softCapThreshold;
    const compressionMinScale = layoutSettings.HORIZONTAL_L1_COMPRESSION_MIN_SCALE ?? LAYOUT_METADATA.HORIZONTAL_L1_COMPRESSION_MIN_SCALE.def;
    const compressionScale = Math.max(compressionMinScale, (layoutSettings.GAP_X ?? LAYOUT_METADATA.GAP_X.def) * 2);
    // log1p keeps growth monotonic while guaranteeing compressedRemaining <= remaining.
    const compressedRemaining = compressionScale * Math.log1p(remaining / compressionScale);
    return nodeWidth + softCapThreshold + compressedRemaining;
  };

  const effectiveWidths = nodes.map((node, i) => compressDirectionalWidth(node, l1Metrics[i]));
  const effectiveWidthById = new Map(nodes.map((node, i) => [node.id, effectiveWidths[i]]));

  const totalEffectiveWidth = effectiveWidths.reduce((sum, width) => sum + width, 0);
  const effectiveGap = layoutSettings.GAP_Y * gapMultiplier;
  const totalContentWidth = totalEffectiveWidth + (count - 1) * effectiveGap;

  const baseArcSpan = layoutSettings.DIRECTIONAL_ARC_SPAN_RADIANS;
  const baselineRadius = Math.max(
    Math.round(rootBox.width * layoutSettings.ROOT_RADIUS_FACTOR),
    layoutSettings.MIN_RADIUS,
  ) + count * layoutSettings.RADIUS_PADDING_PER_NODE;
  const pressure = totalContentWidth / Math.max(1, baselineRadius * baseArcSpan);
  const adaptiveArcSpan = Math.min(Math.PI, Math.max(baseArcSpan, baseArcSpan * Math.sqrt(Math.max(1, pressure))));
  const radiusFromWidth = totalContentWidth / adaptiveArcSpan;
  
  // Notice axis swaps: Radius Y calculates based on Width
  const radiusX = Math.max(Math.round(rootBox.width * layoutSettings.ROOT_RADIUS_FACTOR), layoutSettings.MIN_RADIUS, radiusFromWidth) + count * layoutSettings.RADIUS_PADDING_PER_NODE;
  const crossAxisRatio = layoutSettings.DIRECTIONAL_CROSS_AXIS_RATIO ?? LAYOUT_METADATA.DIRECTIONAL_CROSS_AXIS_RATIO.def;
  const radiusY = Math.max(Math.round(rootBox.height * layoutSettings.ROOT_RADIUS_FACTOR), layoutSettings.MIN_RADIUS, radiusX * crossAxisRatio) + count * layoutSettings.RADIUS_PADDING_PER_NODE;

  const totalThetaDeg = (totalContentWidth / radiusX) * (180 / Math.PI);
  // Reversing the angle spread depending on side to maintain visual reading flow
  let currentAngle = isTopSide ? centerAngle - totalThetaDeg / 2 : centerAngle + totalThetaDeg / 2;

  nodes.forEach((node, i) => {
    const nodeWidth = effectiveWidths[i];
    const isPinned = node.customData?.isPinned === true;
    const side = isTopSide ? -1 : 1;

    const getAngularInfo = (targetNode, width) => {
      const angleRad = Math.atan2((targetNode.y + targetNode.height / 2) - rootCenter.y, (targetNode.x + targetNode.width / 2) - rootCenter.x);
      const angleDeg = angleRad * (180 / Math.PI);
      const normAngle = angleDeg < 0 ? angleDeg + 360 : angleDeg;
      const spanDeg = (width / radiusX) * (180 / Math.PI);
      return { center: normAngle, span: spanDeg, start: normAngle - spanDeg / 2, end: normAngle + spanDeg / 2 };
    };

    const gapSpanDeg = (effectiveGap / radiusX) * (180 / Math.PI);
    const nodeSpanDeg = (nodeWidth / radiusX) * (180 / Math.PI);

    if (isPinned) {
      layoutSubtreeVertical(node.id, node.x + node.width / 2, node.y, side, allElements, hasGlobalFolds, childrenByParent, widthCache, elementById, mustHonorMindmapOrder, rootId, parentMap);
      const info = getAngularInfo(node, nodeWidth);
      if (isTopSide) {
        if (currentAngle < info.start - gapSpanDeg) currentAngle = info.start - gapSpanDeg;
      } else {
        if (currentAngle > info.end + gapSpanDeg) currentAngle = info.end + gapSpanDeg;
      }
    } else {
      const nextPinned = nodes.slice(i + 1).find(n => n.customData?.isPinned);
      if (nextPinned) {
        const nextPinnedWidth = effectiveWidthById.get(nextPinned.id) ?? compressDirectionalWidth(nextPinned, getSubtreeWidth(nextPinned.id, allElements, childrenByParent, widthCache, elementById));
        const nextInfo = getAngularInfo(nextPinned, nextPinnedWidth);
        if (isTopSide) {
           if (currentAngle + nodeSpanDeg > nextInfo.start - gapSpanDeg) currentAngle = nextInfo.start - gapSpanDeg - nodeSpanDeg;
        } else {
           if (currentAngle - nodeSpanDeg < nextInfo.end + gapSpanDeg) currentAngle = nextInfo.end + gapSpanDeg + nodeSpanDeg;
        }
      }

      let angleDeg = isTopSide ? currentAngle + nodeSpanDeg / 2 : currentAngle - nodeSpanDeg / 2;
      currentAngle = isTopSide ? currentAngle + (nodeSpanDeg + gapSpanDeg) : currentAngle - (nodeSpanDeg + gapSpanDeg);

      const angleRad = angleDeg * (Math.PI / 180);
      const tCX = rootCenter.x + radiusX * Math.cos(angleRad);
      const tCY = rootCenter.y + radiusY * Math.sin(angleRad);
      layoutSubtreeVertical(node.id, tCX, tCY, side, allElements, hasGlobalFolds, childrenByParent, widthCache, elementById, mustHonorMindmapOrder, rootId, parentMap);
    }

    if (node.customData?.mindmapNew) {
      ea.addAppendUpdateCustomData(node.id, { mindmapNew: undefined });
    }
    updateL1Arrow(node, context, "vertical");
    if (groupBranches) applyRecursiveGrouping(node.id, allElements);
  });
};

/**
 * Unified layout function for Level 1 nodes.
 * Uses a Vertical Ellipse for Radial mode. Ensures nodes are distributed across
 * the ellipse to prevent wrap-around overlap and maintain correct facing.
 * Returns true if layout logic was executed.
 */
const layoutL1Nodes = (nodes, options, context, mustHonorMindmapOrder = false) => {
  if (nodes.length === 0) return false;
  const { allElements, childrenByParent, heightCache, widthCache, elementById } = context;
  const { sortMethod, centerAngle, gapMultiplier } = options;

  // SORTING: Respect the established mindmapOrder (0..N)
  nodes.sort((a, b) => getMindmapOrder(a) - getMindmapOrder(b));

  if (sortMethod === "radial") {
    const l1Metrics = nodes.map(node => getSubtreeHeight(node.id, allElements, childrenByParent, heightCache, elementById));
    const totalSubtreeHeight = l1Metrics.reduce((sum, h) => sum + h, 0);
    radialL1Distribution(nodes, context, l1Metrics, totalSubtreeHeight, options, mustHonorMindmapOrder);
  } else if (sortMethod === "horizontal") {
    const l1Metrics = nodes.map(node => getSubtreeWidth(node.id, allElements, childrenByParent, widthCache, elementById));
    const totalSubtreeWidth = l1Metrics.reduce((sum, w) => sum + w, 0);
    // 270 degrees represents the Top (Up-facing), 90 degrees represents the Bottom (Down-facing)
    const isTopSide = Math.abs((centerAngle ?? 0) - 270) < 1;
    horizontalL1Distribution(nodes, context, l1Metrics, totalSubtreeWidth, isTopSide, centerAngle, gapMultiplier, mustHonorMindmapOrder);
  } else {
    const l1Metrics = nodes.map(node => getSubtreeHeight(node.id, allElements, childrenByParent, heightCache, elementById));
    const totalSubtreeHeight = l1Metrics.reduce((sum, h) => sum + h, 0);
    const isLeftSide = sortMethod === "vertical" && Math.abs((centerAngle ?? 0) - 270) < 1;
    verticalL1Distribution(nodes, context, l1Metrics, totalSubtreeHeight, isLeftSide, centerAngle, gapMultiplier, mustHonorMindmapOrder);
  }
  
  return true;
};

/**
 * Sorts Level 1 nodes based on their current visual position and updates their mindmapOrder.
 * For Radial maps, sorting is done by angle. For others, by Y-coordinate.
 * Newly added nodes (mindmapNew) are always appended to the end of the visual sequence.
 * Returns true if any order was actually updated.
**/
const sortL1NodesBasedOnVisualSequence = (l1Nodes, mode, rootCenter) => {
  if (l1Nodes.length === 0) return false;

  let orderChanged = false;
  const isVerticalMode = ["Up-facing", "Down-facing", "Up-Down"].includes(mode);

  /** 
   * Helper to sort by Reading Order: Right-side Top-to-Bottom, then Left-side Top-to-Bottom.
   * This serves as our canonical sequence for all directional modes and mode-switching.
   */
  const sortByReadingOrder = (a, b) => {
    const aCX = a.x + a.width / 2;
    const bCX = b.x + b.width / 2;
    const aCY = a.y + a.height / 2;
    const bCY = b.y + b.height / 2;

    if (isVerticalMode) {
       // Vertical modes: Sort bottom-side (Left->Right) then top-side (Left->Right)
       const aIsBottom = aCY > rootCenter.y;
       const bIsBottom = bCY > rootCenter.y;
       if (aIsBottom !== bIsBottom) return aIsBottom ? -1 : 1; 
       return aCX - bCX; 
    } else {
       // Horizontal modes: Sort right-side (Top->Bottom) then left-side (Top->Bottom)
       const aIsR = aCX > rootCenter.x;
       const bIsR = bCX > rootCenter.x;
       if (aIsR !== bIsR) return aIsR ? -1 : 1; 
       return a.y - b.y; 
    }
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
    if (node.customData?.mindmapOrder !== i) {
      ea.addAppendUpdateCustomData(node.id, { mindmapOrder: i });
      orderChanged = true;
    }
  });

  // New nodes always need an update since they lack established order or have a temp one
  newNodes.forEach((node, i) => {
    const newOrder = existingNodes.length + i;
    ea.addAppendUpdateCustomData(node.id, { mindmapOrder: newOrder });
    orderChanged = true;
  });

  return orderChanged;
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
  if (!isViewSet()) return;
  const selectedElement = getMindmapNodeFromSelection();
  if (!selectedElement) return;

  const run = async (allElements, mindmapIds, root, doVisualSort, sharedSets, mustHonorMindmapOrder = false) => {
    return withRootLayoutContext(root, () => {
      const oldMode = root.customData?.growthMode;
      const newMode = root.customData?.growthMode || currentModalGrowthMode;
      
      // Track if any meaningful changes occur
      let orderChanged = false;
      let modeChanged = false;
      let visualChange = false;
      
      // Snapshot positions
      const originalPositions = new Map();
      allElements.forEach(el => {
        originalPositions.set(el.id, { x: el.x, y: el.y });
      });

      const elementById = buildElementMap(allElements);
      const parentMap = buildParentMap(allElements, elementById);
      const childrenByParent = buildChildrenMap(allElements, elementById);

      const heightCache = new Map();
      const widthCache = new Map();

      const branchIds = new Set(mindmapIds);
      const groupToNodes = buildGroupToNodes(branchIds, allElements);

      const hasGlobalFolds = allElements.some(el => el.customData?.isFolded === true);
      const l1Nodes = getChildrenNodes(rootId, allElements);
      if (l1Nodes.length === 0) return { structuralChange: false, visualChange: false };

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
        widthCache,
        elementById,
        parentMap,
      };

      const isModeSwitch = mustHonorMindmapOrder || (oldMode && oldMode !== newMode);

      if (!isModeSwitch && doVisualSort && !mustHonorMindmapOrder) {
        orderChanged = sortL1NodesBasedOnVisualSequence(l1Nodes, newMode, rootCenter);
      } else if (!mustHonorMindmapOrder) {
        if (oldMode !== newMode) {
          ea.addAppendUpdateCustomData(rootId, { growthMode: newMode });
          modeChanged = true;
        }
      }

      if (newMode === "Radial") {
        layoutL1Nodes(l1Nodes, {
          sortMethod: "radial",
          centerAngle: null,
          gapMultiplier: layoutSettings.GAP_MULTIPLIER_RADIAL,
          fillSweep: root.customData?.fillSweep ?? fillSweep,
        }, layoutContext, mustHonorMindmapOrder);
      } else if (["Right-facing", "Left-facing", "Right-Left"].includes(newMode)) {
        const leftNodes = [];
        const rightNodes =[];

        if (newMode === "Right-Left") {
          if (isModeSwitch && !mustHonorMindmapOrder) {
            const splitIdx = Math.ceil(l1Nodes.length / 2);
            l1Nodes.forEach((node, i) => {
              if (i < splitIdx) rightNodes.push(node);
              else leftNodes.push(node);
            });
          } else {
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
      } else if (["Up-facing", "Down-facing", "Up-Down"].includes(newMode)) {
        const upNodes =[];
        const downNodes =[];

        if (newMode === "Up-Down") {
          if (isModeSwitch && !mustHonorMindmapOrder) {
            const splitIdx = Math.ceil(l1Nodes.length / 2);
            l1Nodes.forEach((node, i) => {
              if (i < splitIdx) downNodes.push(node);
              else upNodes.push(node);
            });
          } else {
            l1Nodes.forEach((node) => {
              const nodeCY = node.y + node.height / 2;
              if (nodeCY > rootCenter.y) downNodes.push(node);
              else upNodes.push(node);
            });
          }
        } else if (newMode === "Up-facing") {
          l1Nodes.forEach(node => upNodes.push(node));
        } else {
          l1Nodes.forEach(node => downNodes.push(node));
        }

        // Initialize cache required for vertical mode width tracking
        layoutContext.widthCache = new Map();
        
        if (downNodes.length > 0) {
          layoutL1Nodes(downNodes, { sortMethod: "horizontal", centerAngle: 90, gapMultiplier: layoutSettings.GAP_MULTIPLIER_DIRECTIONAL }, layoutContext, mustHonorMindmapOrder);
        }
        if (upNodes.length > 0) {
          layoutL1Nodes(upNodes, { sortMethod: "horizontal", centerAngle: 270, gapMultiplier: layoutSettings.GAP_MULTIPLIER_DIRECTIONAL }, layoutContext, mustHonorMindmapOrder);
        }
      }

      const { mindmapIdsSet, crosslinkIdSet, decorationIdSet } = sharedSets;

      moveCrossLinks(ea.getElements(), originalPositions);
      moveDecorations(ea.getElements(), originalPositions, groupToNodes, rootId, elementById, parentMap);

      ea.getElements().filter(el => !mindmapIdsSet.has(el.id) && !crosslinkIdSet.has(el.id) && !decorationIdSet.has(el.id)).forEach(el => {
        delete ea.elementsDict[el.id];
      });

      // Detect Visual Changes
      for (const el of ea.getElements()) {
        const oldPos = originalPositions.get(el.id);
        if (oldPos) {
          if (Math.abs(el.x - oldPos.x) > 0.01 || Math.abs(el.y - oldPos.y) > 0.01) {
            visualChange = true;
            break;
          }
        }
      }

      return {
        structuralChange: orderChanged || modeChanged,
        visualChange
      };
    });
  };

  const viewElements = ea.getViewElements();
  const projectElements = getMindmapProjectElements(rootId, viewElements);

  ea.copyViewElementsToEAforEditing(projectElements);
  let allElements = ea.getElements();
  let root = allElements.find((el) => el.id === rootId);
  if (!root) return;

  if (root.customData?.autoLayoutDisabled) return;
  
  const mindmapIds = getBranchElementIds(rootId, allElements);
  const {structuralGroupId, groupedElementIds} = getStructuralGroupForNode(mindmapIds, allElements, rootId);
  if (structuralGroupId) {
    removeGroupFromElements(structuralGroupId, allElements);
  }

  const expandedMindmapIds = [...mindmapIds];
  mindmapIds.forEach(id => {
      const el = allElements.find(e => e.id === id);
      if (el && el.boundElements) {
          el.boundElements.forEach(be => expandedMindmapIds.push(be.id));
      }
  });

  const mindmapIdsSet = new Set(expandedMindmapIds);
  const crosslinkIdSet = collectCrosslinkIds(allElements);
  const decorationIdSet = collectDecorationIds(allElements, rootId);
  const sharedSets = { mindmapIdsSet, crosslinkIdSet, decorationIdSet };

  // --- Snapshot boundary nodes before Run 1 ---
  // We check for nodes that have a boundaryId defined
  const boundaryNodeSnapshot = new Map();
  allElements.forEach(el => {
    if (typeof el.customData?.mindmapOrder !== "undefined" && el.customData?.boundaryId) {
      boundaryNodeSnapshot.set(el.id, { x: el.x, y: el.y, width: el.width, height: el.height });
    }
  });

  const result1 = await run(allElements, mindmapIds, root, true, sharedSets, mustHonorMindmapOrder);

  // --- Check if any boundary node moved ---
  let boundaryMoved = false;
  if (boundaryNodeSnapshot.size > 0) {
    for (const [id, oldSnapshot] of boundaryNodeSnapshot) {
      const newEl = ea.getElement(id);
      if (newEl) {
         if (Math.abs(newEl.x - oldSnapshot.x) > 0.01 ||
             Math.abs(newEl.y - oldSnapshot.y) > 0.01 ||
             Math.abs(newEl.width - oldSnapshot.width) > 0.01 ||
             Math.abs(newEl.height - oldSnapshot.height) > 0.01) {
           boundaryMoved = true;
           break;
         }
      }
    }
  }

  if (result1.structuralChange || forceUngroup || boundaryMoved) {
    await addElementsToView({ captureUpdate: "EVENTUALLY" });

    // Isolate subset again for the second pass
    const viewElementsRun2 = ea.getViewElements();
    const projectElementsRun2 = getMindmapProjectElements(rootId, viewElementsRun2);

    ea.copyViewElementsToEAforEditing(projectElementsRun2);
    allElements = ea.getElements();
    root = allElements.find((el) => el.id === rootId);
    
    await run(allElements, mindmapIds, root, false, sharedSets, mustHonorMindmapOrder);
    
    if (structuralGroupId && !forceUngroup) {
      // Restore the exact same group ID instead of creating a new one
      // This prevents Excalidraw's editingGroupId from pointing to a deleted group,
      // which causes the 0x0 rendering artifact at the origin.
      groupedElementIds.forEach(id => {
        const el = ea.getElement(id);
        if (el && (!el.groupIds || !el.groupIds.includes(structuralGroupId))) {
          el.groupIds = [...(el.groupIds || []), structuralGroupId];
        }
      });
    }
    await addElementsToView({ captureUpdate: "IMMEDIATELY" });

  } else {
    // If only visual change (no struct change, no boundary move), commit Run 1
    if (result1.visualChange) {
      if (structuralGroupId && !forceUngroup) {
        // Restore the exact same group ID instead of creating a new one
        groupedElementIds.forEach(id => {
          const el = ea.getElement(id);
          if (el && (!el.groupIds || !el.groupIds.includes(structuralGroupId))) {
            el.groupIds = [...(el.groupIds || []), structuralGroupId];
          }
        });
      }
      await addElementsToView({ captureUpdate: "IMMEDIATELY" });
    } else {
      ea.clear();
    }
  }

  selectNodeInView(selectedElement);
};

// ---------------------------------------------------------------------------
// 4. Add Node Logic
// ---------------------------------------------------------------------------
let mostRecentlyAddedNodeID;
const getMostRecentlyAddedNode = () => {
  if (!mostRecentlyAddedNodeID) return null;
  return ea.getViewElements().find((el) => el.id === mostRecentlyAddedNodeID);
}

const getAdjustedMaxWidth = async (text, max) => {
  const fontString = `${ea.style.fontSize.toString()}px ${
    ExcalidrawLib.getFontFamilyString({fontFamily: ea.style.fontFamily})}`;

  const parsedText = (await parseText(text)) ?? text;
  
  const wrappedText = ExcalidrawLib.wrapText(parsedText, fontString, max);
  const metrics = ea.measureText(wrappedText);
  const optimalWidth = Math.ceil(metrics.width);
  return {
    width: Math.min(max, optimalWidth), 
    height: metrics.height, 
    wrappedText
  };
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

/**
 * Initializes the customData for a new Root node with the current global settings.
 */
const initializeRootCustomData = (nodeId) => {
  ea.addAppendUpdateCustomData(nodeId, {
    growthMode: currentModalGrowthMode,
    autoLayoutDisabled: false,
    arrowType: arrowType, // Save the arrow type on new root
    fontsizeScale,
    multicolor,
    boxChildren,
    roundedCorners,
    maxWrapWidth: maxWidth,
    isSolidArrow,
    centerText,
    fillSweep,
    branchScale,
    baseStrokeWidth,
    layoutSettings: JSON.parse(JSON.stringify(layoutSettings)),
  });
};

const addNode = async (text, follow = false, skipFinalLayout = false, batchModeAllElements = null, batchModeParent = null, pos = null, ontology = null) => {
  if (!isViewSet()) return;
  if (!text || text.trim() === "") return;

  const st = getAppState();
  const isBatchMode = batchModeAllElements !== null;

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
  let settingsRoot = null;
  let rootCfgForAdd = null;
  if (parent) {
    const siblings = getChildrenNodes(parent.id, allElements);
    nextSiblingOrder = Math.max(0, ...siblings.map(getMindmapOrder)) + 1;
    settingsRoot = getSettingsRootNode(parent, allElements) || allElements.find((e) => e.id === getHierarchy(parent, allElements).rootId);
    rootId = settingsRoot?.id;
    rootCfgForAdd = getRootConfigForNode(settingsRoot);
    const parentDepthFromSettingsRoot = getDepthFromAncestor(parent.id, rootId, allElements);
    depth = parentDepthFromSettingsRoot + 1;
    const rootEl = settingsRoot;

    if (depth === 1) {
      if (rootCfgForAdd.multicolor) {
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
        nodeColor = incomingArrow
          ? incomingArrow.strokeColor
          : (parent.strokeColor && parent.strokeColor.toLowerCase() !== "transparent" ? parent.strokeColor : defaultNodeColor);
      } else {
        nodeColor = parent.strokeColor;
      }
    }
  }

  const fontScale = getFontScale(rootCfgForAdd?.fontsizeScale ?? fontsizeScale);
  if (!isBatchMode) ea.clear();
  ea.style.fontFamily = st.currentItemFontFamily;
  ea.style.fontSize = fontScale[Math.min(depth, fontScale.length - 1)];
  ea.style.roundness = (rootCfgForAdd?.roundedCorners ?? roundedCorners) ? { type: 3 } : null;

  const effectiveMaxWrap = rootCfgForAdd?.maxWrapWidth ?? maxWidth;
  let curMaxW = depth === 0 ? Math.max(400, effectiveMaxWrap) : effectiveMaxWrap;
  
  let renderedText=text;
  let metrics = { w: 0, h: 0 };
  let shouldWrap = false;
  let curMaxH = 0;
  
  if (!imageInfo?.isImagePath && !imageInfo?.imageFile && !embeddableUrl) {
    renderedText = (await parseText(text)) ?? text;
    metrics = ea.measureText(renderedText);
    shouldWrap = metrics.width > curMaxW;
    curMaxH = metrics.height;

    if (shouldWrap) {
      const res = await getAdjustedMaxWidth(text, curMaxW);
      curMaxW = res.width;
      curMaxH = res.height;
    }
  } 

  if (!parent) {
    ea.style.strokeColor = multicolor ? defaultNodeColor : st.currentItemStrokeColor;

    if (imageInfo?.isImagePath) {
      newNodeId = await addImage({
        pathOrFile: imageInfo.path,
        width: imageInfo.width,
        depth
      });
      // Attach the URL to the element's link so we can trace it back
      if (imageInfo.isExternalImage && newNodeId) {
        const el = ea.getElement(newNodeId);
        if (el && !el.link) el.link = imageInfo.path;
      }
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
      ea.style.strokeWidth = getStrokeWidthForDepth(0);
      ea.style.roughness = getAppState().currentItemRoughness;
      newNodeId = ea.addText(0, 0, text, {
        box: "rectangle",
        textAlign: "center",
        textVerticalAlign: "middle",
        // Use a distinct color representation so the frame can be recolored separately from text
        boxStrokeColor: ea.getCM(ea.style.strokeColor).stringRGB(),
        width: shouldWrap ? curMaxW : undefined,
        height: shouldWrap ? curMaxH : undefined,
        autoResize: !shouldWrap,
      });
      ea.style.backgroundColor = "transparent";
    }

    initializeRootCustomData(newNodeId);
    rootId = newNodeId;
  } else {
    ea.style.strokeColor = nodeColor;
    const rootEl = allElements.find((e) => e.id === rootId);
    const rootBox = getNodeBox(rootEl, allElements);
    const mode = rootCfgForAdd?.growthMode || rootEl.customData?.growthMode || currentModalGrowthMode;
    const rootCenter = {
      x: rootBox.minX + rootBox.width / 2,
      y: rootBox.minY + rootBox.height / 2,
    };

    const parentBox = getNodeBox(parent, allElements);
    
    // Determine direction for initial offset to prevent visual jumping
    const isVerticalMode =["Up-facing", "Down-facing", "Up-Down"].includes(mode);

    let targetSide = 1; // 1 = Right/Down, -1 = Left/Up
    if (depth === 1) {
      if (mode === "Left-facing" || mode === "Up-facing") targetSide = -1;
      else if (mode === "Right-facing" || mode === "Down-facing") targetSide = 1;
      else if (mode === "Right-Left" || mode === "Up-Down") {
         const siblings = getChildrenNodes(parent.id, allElements);
         const idx = siblings.length; // Index of the new node being added
         if (idx < 2) targetSide = 1;
         else if (idx < 4) targetSide = -1;
         else targetSide = idx % 2 === 0 ? 1 : -1;
      } else {
        // Default to parent side or Right for Radial/Fallback layouts
        if (isVerticalMode) {
          const parentCenterY = parentBox.minY + parentBox.height / 2;
          targetSide = parentCenterY > rootCenter.y ? 1 : -1;
        } else {
          const parentCenterX = parentBox.minX + parentBox.width / 2;
          targetSide = parentCenterX > rootCenter.x ? 1 : -1;
        }
      }
    } else {
       // Deep nodes follow parent's side
       if (isVerticalMode) {
          const parentCenterY = parentBox.minY + parentBox.height / 2;
          targetSide = parentCenterY > rootCenter.y ? 1 : -1;
       } else {
          const parentCenterX = parentBox.minX + parentBox.width / 2;
          targetSide = parentCenterX > rootCenter.x ? 1 : -1;
       }
    }

    let side = targetSide;
    let px = parentBox.minX, py = parentBox.minY;

    if (isVerticalMode) {
      const offset = side === 1 ? rootBox.height * 2 : -rootBox.height;
      px = parentBox.minX + parentBox.width / 2 - (shouldWrap ? curMaxW : metrics.width) / 2;
      py = parentBox.minY + offset;

      // If pos is provided (e.g. from Add Sibling), override placement.
      // This maintains the "same side" logic because the originator's X is used.
      if (!autoLayoutDisabled && pos) {
        px = pos.x; py = pos.y;
        side = (py + metrics.height / 2 > rootCenter.y) ? 1 : -1;
      } else if (!autoLayoutDisabled) {
        // Ensure new node is placed below existing siblings to preserve visual order
        const siblings = getChildrenNodes(parent.id, allElements);
        if (siblings.length > 0) {
          const sortedSiblings = siblings.sort((a, b) => a.x - b.x);
          const lastSibling = sortedSiblings[sortedSiblings.length - 1];
          const lastSiblingBox = getNodeBox(lastSibling, allElements);
          px = lastSiblingBox.minX + lastSiblingBox.width + layoutSettings.GAP_Y; 
          py = parentBox.minY + (side === 1 ? parentBox.height + layoutSettings.GAP_X : -layoutSettings.GAP_X - metrics.height);
        }
      } else if (autoLayoutDisabled) {
        const manualGapY = Math.round(parentBox.height * layoutSettings.MANUAL_GAP_MULTIPLIER);
        const jitterX = (Math.random() - 0.5) * layoutSettings.MANUAL_JITTER_RANGE;
        const jitterY = (Math.random() - 0.5) * layoutSettings.MANUAL_JITTER_RANGE;
        px = parentBox.minX + parentBox.width / 2 - metrics.width / 2 + jitterX;
        py = side === 1 
          ? parentBox.minY + parentBox.height + manualGapY + jitterY
          : parentBox.minY - manualGapY - metrics.height + jitterY;
      }
    } else {
      const offset = (mode === "Radial" || side === 1) ? rootBox.width * 2 : -rootBox.width;
      px = parentBox.minX + offset;
      py = parentBox.minY;

      // If pos is provided (e.g. from Add Sibling), override placement.
      if (!autoLayoutDisabled && pos) {
        px = pos.x; py = pos.y;
        side = (px + (shouldWrap ? curMaxW : metrics.width) / 2 > rootCenter.x) ? 1 : -1;
      } else if (!autoLayoutDisabled) {
        // Ensure new node is placed below existing siblings to preserve visual order
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
    }

    const effectiveCenterText = rootCfgForAdd?.centerText ?? centerText;
    const effectiveBoxChildren = rootCfgForAdd?.boxChildren ?? boxChildren;
    const effectiveArrowType = rootCfgForAdd?.arrowType ?? arrowType;
    const effectiveIsSolidArrow = rootCfgForAdd?.isSolidArrow ?? isSolidArrow;
    const effectiveBranchScale = rootCfgForAdd?.branchScale ?? branchScale;
    const effectiveBaseStrokeWidth = rootCfgForAdd?.baseStrokeWidth ?? baseStrokeWidth;

    const textAlign = effectiveCenterText ? "center" : (isVerticalMode ? "center" : (side === 1 ? "left" : "right"));

    if (imageInfo?.isImagePath) {
      newNodeId = await addImage({
        pathOrFile: imageInfo.path,
        width: imageInfo.width,
        leftFacing: side === -1 && !autoLayoutDisabled,
        x: px,
        y: py,
        depth
      });
      // Attach the URL to the element's link so we can trace it back
      if (imageInfo.isExternalImage && newNodeId) {
        const el = ea.getElement(newNodeId);
        if (el && !el.link) el.link = imageInfo.path;
      }
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
      ea.style.strokeWidth = calculateStrokeWidth(depth, effectiveBaseStrokeWidth, effectiveBranchScale);
      ea.style.roughness = getAppState().currentItemRoughness;
      newNodeId = ea.addText(px, py, text, {
        box: effectiveBoxChildren ? "rectangle" : false,
        textAlign,
        textVerticalAlign: "middle",
        width: shouldWrap ? curMaxW : undefined,
        height: shouldWrap ? curMaxH : undefined,
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
      initializeRootCustomData(parent.id);
    }

    if ((parent.type === "image" || parent.type === "embeddable") && typeof parent.customData?.mindmapOrder === "undefined") {
      ea.addAppendUpdateCustomData(parent.id, { mindmapOrder: 0 });
    }

    ea.style.strokeWidth = calculateStrokeWidth(depth, effectiveBaseStrokeWidth, effectiveBranchScale);
    ea.style.roughness = getAppState().currentItemRoughness;
    ea.style.strokeStyle = effectiveIsSolidArrow ? "solid" : getAppState().currentItemStrokeStyle;
    
    // Initial arrow creation (placeholder points)
    const startPoint =[parentBox.minX + parentBox.width / 2, parentBox.minY + parentBox.height / 2];
    arrowId = ea.addArrow([startPoint, startPoint], {
      startObjectId: parent.id,
      endObjectId: newNodeId,
      startArrowHead: null,
      endArrowHead: null,
    });
    const eaArrow = ea.getElement(arrowId);
    
    // Initialize Roundness based on arrow type
     if(effectiveArrowType === "curved") {
       eaArrow.roundness = { type: 2 };
    } else {
       eaArrow.roundness = null;
    }
    
    ea.addAppendUpdateCustomData(arrowId, { isBranch: true });

    if (ontology) {
      addUpdateArrowLabel(eaArrow, ontology);
    }

    if (!groupBranches && parent.groupIds?.length > 0) {
      const mindmapIds = getBranchElementIds(parent.id, ea.getViewElements());
      const { structuralGroupId } = getStructuralGroupForNode(mindmapIds, allElements, rootId);
      if (structuralGroupId) {
        const newNode = ea.getElement(newNodeId);
        const newArrow = ea.getElement(arrowId);
        if(newNode) newNode.groupIds = [structuralGroupId];
        if(newArrow) newArrow.groupIds = [structuralGroupId];
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
    captureUpdate: "EVENTUALLY",
  });

  if (rootId && (autoLayoutDisabled || skipFinalLayout) && parent) {
    const allEls = ea.getViewElements();
    const node = allEls.find((el) => el.id === newNodeId);
    const arrow = allEls.find(
      (a) => a.type === "arrow" && a.customData?.isBranch && a.endBinding?.elementId === newNodeId,
    );

    ea.copyViewElementsToEAforEditing(groupBranches ? allEls : arrow ? [arrow] :[]);

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
        getStructuralGroup(el, allEls, rootId)
      );
      const commonGroupId = existingGroupedEl ? getStructuralGroup(existingGroupedEl, allEls, rootId) : null;

      if (commonGroupId) {
        const newIds = [newNodeId, arrowId].filter(Boolean);
        ea.copyViewElementsToEAforEditing(allEls.filter(el => newIds.includes(el.id)));
        newIds.forEach(id => {
          const el = ea.getElement(id);
          if (el) el.groupIds = [commonGroupId];
        });
      }
    }

    await addElementsToView({ captureUpdate: "EVENTUALLY" });
  }
  const finalNode = ea.getViewElements().find((el) => el.id === newNodeId);
  if (follow || !parent) {
    selectNodeInView(finalNode);
  } else if (parent) {
    selectNodeInView(parent);
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
  if (!isViewSet()) return;
  
  const sel = getMindmapNodeFromSelection();
  if (!sel) {
    new Notice(t("NOTICE_SELECT_NODE_CONTAINING_LINK"));
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
    const embeddedFile = ea.targetView?.excalidrawData?.getFile(node.fileId);    
    if (!embeddedFile) return "";
    
    const file = ea.getViewFileForImageElement(node);
    
    // Handle external image URLs or local file URIs saved in node.link
    if (!file && node.link && node.link.match(/^(https?|file):\/\//i)) {
      return `![image|${Math.round(node.width)}](${node.link})`;
    }

    if (shortPath) {
      const originalPath = embeddedFile.linkParts?.original;
      return `![[${originalPath}|${Math.round(node.width)}]]`;
    }
    
    if (file) {
      if (file.extension === "pdf" && node.link?.startsWith("[[")) {
        return `!${node.link.match(/^(.*?)\]\]/)[1]}|${Math.round(node.width)}]]`;
      }
      return  `![[${file.path}${embeddedFile.filenameparts?.linkpartReference || ""}|${Math.round(node.width)}]]`;
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
// Now supports extracting Submaps into separate ## Headings referenced by ![[#Links]]
**/
const copyMapAsText = async (cut = false, toClipboard = true) => {
  if (!isViewSet()) return;
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
  const defaultMode = root?.customData?.growthMode || currentModalGrowthMode;

  const elementsToDelete =[];

  const useTab = app.vault.getConfig("useTab");
  const tabSize = app.vault.getConfig("tabSize");
  const indentVal = useTab ? "\t" : " ".repeat(tabSize);

  // --- Crosslink & Block Reference Logic ---
  const branchIds = new Set(getBranchElementIds(sel.id, all));
  
  const nodeBlockRefs = new Map(); // NodeID -> "^blockId"
  const nodeOutgoingLinks = new Map(); // NodeID -> ["text representation", ...]

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
        nodeOutgoingLinks.set(startId,[]);
      }
      
      // Check for label on the arrow
      const boundTextId = arrow.boundElements?.find(be => be.type === "text")?.id;
      const labelTextElement = boundTextId ? all.find(el => el.id === boundTextId) : null;
      const refString = nodeBlockRefs.get(endId);
      
      let linkText;
      if (labelTextElement && labelTextElement.rawText) {
        // Replace newlines with spaces for inline dataview field compatibility
        const label = labelTextElement.rawText.replace(/\n/g, " ");
        linkText = `(${label}:: [[#${refString}|*]])`;
      } else {
        linkText = `[[#${refString}|*]]`;
      }

      nodeOutgoingLinks.get(startId).push(linkText);
      
      if (cut) elementsToDelete.push(arrow);
    });
  }

  const submapsQueue =[];

  const buildList = (nodeId, depth = 0, isSubmapChild = false, isPrintRoot = false) => {
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

    let str = "";
    let text = getTextFromNode(all, node, true);

    let ontologyStr = "";
    // Fetch ontology if it's not the absolute root, or if it's a child within a submap layout
    if ((!isRootSelected || depth > 0) || isSubmapChild) {
      const incomingArrow = all.find(
        (a) => a.type === "arrow" && a.customData?.isBranch && a.endBinding?.elementId === nodeId
      );
      if (incomingArrow) {
        const boundTextEl = ea.getBoundTextElement(incomingArrow,true).sceneElement;
        if (boundTextEl && boundTextEl.rawText) {
          // Replace newlines with spaces so it stays on one line
          ontologyStr = boundTextEl.rawText.replace(/\n/g, " ") + ":: ";
          if (cut) elementsToDelete.push(boundTextEl);
        }
      }
    }

    // --- Append Metadata Suffixes ---
    let refSuffixes = "";
    if (nodeOutgoingLinks.has(nodeId)) refSuffixes += ` ${nodeOutgoingLinks.get(nodeId).join(" ")}`;
    if (node.customData?.boundaryId) refSuffixes += " #boundary";
    if (nodeBlockRefs.has(nodeId)) refSuffixes += ` ${nodeBlockRefs.get(nodeId)}`;

    // --- Extract Task Info ---
    let isTask = false;
    let taskPrefix = "";
    const taskMatch = text.match(/^- \[[ xX]\] /);
    if (taskMatch) {
       isTask = true;
       taskPrefix = taskMatch[0]; // Retain "- [ ] " or "- [x] "
       text = text.substring(taskPrefix.length); // Strip it temporarily for clean assembly
    }

    // --- Submap Extraction Logic ---
    // If this node is an additional root AND it's not the immediate element we are printing the section for
    if (!isPrintRoot && node.customData?.isAdditionalRoot) {
      let submapTitle = text;
      // Clean up Image strings to use as clean anchor links
      if (submapTitle.startsWith("![[") && submapTitle.endsWith("]]")) {
          submapTitle = submapTitle.slice(3, -2).split("|")[0];
      } else if (submapTitle.startsWith("![") && submapTitle.endsWith(")")) {
          submapTitle = "Submap " + nodeId.substring(0, 4);
      }
      
      const linkText = `![[#${submapTitle}]]`;
      const repeatCount = Math.max(0, depth - (isRootSelected ? 1 : 0));
      let currentIndent = isSubmapChild ? indentVal.repeat(depth) : indentVal.repeat(repeatCount);

      // Inject task prefix if available
      if (isTask) {
        str += `${currentIndent}${taskPrefix}${ontologyStr}${linkText}${refSuffixes}${lineSeparator}`;
      } else {
        str += `${currentIndent}- ${ontologyStr}${linkText}${refSuffixes}${lineSeparator}`;
      }
      submapsQueue.push({ id: nodeId, title: submapTitle });
      
      return str; // Do not recurse into children here; they belong in the ## section
    }

    if (depth === 0 && isRootSelected && !isSubmapChild) {
      str += `# ${taskPrefix}${ontologyStr}${text}${refSuffixes}${lineSeparator}`;
    } else {
      const repeatCount = Math.max(0, depth - (isRootSelected ? 1 : 0));
      let currentIndent = isSubmapChild ? indentVal.repeat(depth) : indentVal.repeat(repeatCount);
      if (isTask) {
        str += `${currentIndent}${taskPrefix}${ontologyStr}${text}${refSuffixes}${lineSeparator}`;
      } else {
        str += `${currentIndent}- ${ontologyStr}${text}${refSuffixes}${lineSeparator}`;
      }
    }

    // --- Visual Sorting Logic ---
    let children = getChildrenNodes(nodeId, all);
    const parentCenter = { x: node.x + node.width / 2, y: node.y + node.height / 2 };
    
    // Honor local submap modes
    const mode = node.customData?.isAdditionalRoot ? node.customData.growthMode : defaultMode;

    if (mode === "Radial") {
      children.sort((a, b) => {
          const centerA = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
          const centerB = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
          return getAngleFromCenter(parentCenter, centerA) - getAngleFromCenter(parentCenter, centerB);
      });
    } else if (mode === "Right-Left" && nodeId === info.rootId) {
      const right = [];
      const left =[];
      children.forEach(child => {
          const childCx = child.x + child.width / 2;
          if (childCx > parentCenter.x) right.push(child);
          else left.push(child);
      });
      right.sort((a, b) => a.y - b.y);
      left.sort((a, b) => a.y - b.y);
      children = [...right, ...left];
    } else {
      children.sort((a, b) => a.y - b.y);
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
      // Children of a printRoot are not the printRoot
      str += buildList(c.id, depth + 1, isSubmapChild, false); 
    });
    return str;
  };

  let md = buildList(sel.id, 0, false, true);

  // --- Process Queued Submaps ---
  const processedSubmaps = new Set();

  // Add divider if submaps exist
  if (submapsQueue.length > 0) {
    md += `\n---\n`;
  }

  while (submapsQueue.length > 0) {
    const submapObj = submapsQueue.shift();
    if (processedSubmaps.has(submapObj.id)) continue;
    processedSubmaps.add(submapObj.id);

    md += `\n## ${submapObj.title}\n`;

    const submapNode = all.find(e => e.id === submapObj.id);
    let children = getChildrenNodes(submapObj.id, all);
    
    const parentCenter = { x: submapNode.x + submapNode.width / 2, y: submapNode.y + submapNode.height / 2 };
    const mode = submapNode.customData?.growthMode || defaultMode;

    if (mode === "Radial") {
      children.sort((a, b) => {
          const centerA = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
          const centerB = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
          return getAngleFromCenter(parentCenter, centerA) - getAngleFromCenter(parentCenter, centerB);
      });
    } else if (mode === "Right-Left") {
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
      children.sort((a, b) => a.y - b.y);
    }

    children.forEach((c) => {
      if (cut) {
        const arrow = all.find(
          (a) =>
            a.type === "arrow" &&
            a.customData?.isBranch &&
            a.startBinding?.elementId === submapObj.id &&
            a.endBinding?.elementId === c.id,
        );
        if (arrow) elementsToDelete.push(arrow);
      }
      md += buildList(c.id, 0, true, false);
    });
  }

  if(toClipboard) await navigator.clipboard.writeText(md);

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

        await addElementsToView({ captureUpdate: "EVENTUALLY" });
      }
      selectNodeInView(parentNode);
    }

    triggerGlobalLayout(info.rootId);
    new Notice(isRootSelected ? t("NOTICE_MAP_CUT") : t("NOTICE_BRANCH_CUT"));
  } else {
    new Notice(isRootSelected ? t("NOTICE_MAP_COPIED") : t("NOTICE_BRANCH_COPIED"));
  }
  return md;
};

/**
// Core logic to parse a list string and add nodes to the map.
// Now dynamically links "## Submap" definitions to their "![[#Submap]]" embed nodes.
**/
const importTextToMap = async (rawText) => {
  if (!isViewSet()) return;
  if (!rawText) return;

  let sel = getMindmapNodeFromSelection();
  let currentParent;

  // Filter out empty lines AND divider lines
  const lines = rawText.split(/\r\n|\n|\r/).filter((l) => {
    const trimmed = l.trim();
    return trimmed !== "" && !/^-{3,}$/.test(trimmed);
  });

  if (lines.length === 0) return;

  // Regex patterns
  const boundaryRegex = /\s#boundary\b/;
  const blockRefRegex = /\s\^([a-zA-Z0-9]{8})$/;
  const crossLinkRegex = /(?:\(([^):]+)::\s*)?\[\[#\^([a-zA-Z0-9]{8})\|\*\]\](?:\))?/g;
  const ontologyRegex = /^(.+?)::\s*(.*)$/;
  const submapRefRegex = /^!\[\[#([^\]]+)\]\]$/; // Matches ![[#Submap Name]]

  if (lines.length === 1) {
    let text = lines[0];
    const listMatch = text.match(/^(\s*)(?:-|\*|\d+\.)\s+(.*)$/);
    if (listMatch) {
      text = listMatch[2].trim();
      if (/^\[[ xX]\] /.test(text)) {
        // Retain task syntax if it was an imported list item
        text = "- " + text;
      }
    } else {
      text = text.trim();
    }
    
    text = text.replace(boundaryRegex, "");
    text = text.replace(blockRefRegex, "");

    const ontologyMatch = text.match(ontologyRegex);
    let ontology = null;
    if (ontologyMatch) {
      ontology = ontologyMatch[1].trim();
      text = ontologyMatch[2].trim();
    }

    let isSubmapRef = false;
    const submapRefMatch = text.match(submapRefRegex);
    if (submapRefMatch) {
        isSubmapRef = true;
        text = submapRefMatch[1].trim();
    }

    if (text) {
      currentParent = await addNode(text.trim(), true, false, null, null, null, ontology);
      if (isSubmapRef) {
          ea.addAppendUpdateCustomData(currentParent.id, { isAdditionalRoot: true });
      }
      if (sel) {
        selectNodeInView(sel);
      }
      return;
    }
  }

  let parsed =[];
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

  // Maps for crosslink & submap reconstruction
  const blockRefToNodeId = new Map(); // ^12345678 -> newNodeId
  const nodeToOutgoingRefs = new Map(); // newNodeId -> [{ref: string, label: string}, ...]
  
  lines.forEach((line, index) => {
    let text = "";
    let indent = 0;
    let isSubmapDef = false;
    
    if (isHeader(line)) {
      if (index === 0) {
        indent = 0;
        text = line.replace(/^#+\s/, "").trim();
      } else {
        // Subsequent headers signify details of a Submap
        isSubmapDef = true;
        text = line.replace(/^#+\s/, "").trim();
        indent = -1; // Special indent pushes it strictly below its parent in stack validation
      }
    } else {
      const match = isListItem(line);
      if (match) {
        indent = delta + match[1].length;
        let extractedText = match[2].trim();
        // Check if list item has task bracket syntax
        if (/^\[[ xX]\] /.test(extractedText)) {
            extractedText = "- " + extractedText;
        }
        text = extractedText;
      } else if (parsed.length > 0) {
        // multiline handling
        parsed[parsed.length - 1].text += "\n" + line.trim();
        return; 
      }
    }

    if (text || isSubmapDef) {
      const hasBoundary = boundaryRegex.test(text);
      text = text.replace(boundaryRegex, "");

      const refMatch = text.match(blockRefRegex);
      let blockRef = null;
      if (refMatch) {
        blockRef = refMatch[1];
        text = text.replace(blockRefRegex, "");
      }

      const outgoingRefs =[];
      crossLinkRegex.lastIndex = 0;
      text = text.replace(crossLinkRegex, (_match, label, ref) => {
        outgoingRefs.push({ ref: ref, label: label ? label.trim() : null });
        return "";
      });

      const ontologyMatch = text.match(ontologyRegex);
      let ontology = null;
      if (ontologyMatch) {
        ontology = ontologyMatch[1].trim();
        text = ontologyMatch[2].trim();
      }
      
      let isSubmapRef = false;
      text = text.trim();
      const submapRefMatch = text.match(submapRefRegex);
      if (submapRefMatch) {
          isSubmapRef = true;
          text = submapRefMatch[1].trim();
      }

      parsed.push({ 
        indent, 
        text,
        hasBoundary,
        blockRef,
        outgoingRefs,
        ontology,
        isSubmapDef,
        isSubmapRef
      });
    }
  });

  if (parsed.length === 0 && !rootTextFromHeader) {
    new Notice(t("NOTICE_NO_LIST"));
    return;
  }

  ea.clear();

  const rootSelected = !!sel;
  const createdBoundaries =[];

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
      groupIds: node.groupIds ||[],
      customData: {isBoundary: true},
      roundness: arrowType === "curved" ? {type: 2} : null,
    };
    
    ea.elementsDict[id] = boundaryEl;
    ea.addAppendUpdateCustomData(nodeId, { boundaryId: id });
    createdBoundaries.push({ nodeId, boundaryId: id });
  };

  const submapNodesByName = new Map();

  if (!sel) {
    // Filter out submap definitions (-1 indent) to accurately find the true top-level items
    const nonSubmapItems = parsed.filter((p) => !p.isSubmapDef);
    const minIndent = Math.min(...nonSubmapItems.map((p) => p.indent));
    const topLevelItems = nonSubmapItems.filter((p) => p.indent === minIndent);
    
    const processRootMeta = (item, id) => {
        if(item.blockRef) blockRefToNodeId.set(item.blockRef, id);
        if(item.outgoingRefs.length > 0) nodeToOutgoingRefs.set(id, item.outgoingRefs);
        if(item.hasBoundary) createImportBoundary(id);
        if(item.isSubmapRef) {
            ea.addAppendUpdateCustomData(id, { isAdditionalRoot: true });
            submapNodesByName.set(item.text, ea.getElement(id));
        }
    };

    // If there is exactly one top-level item, it becomes the new master root
    if (topLevelItems.length === 1) {
      const rootItem = topLevelItems[0];
      const rootIndex = parsed.indexOf(rootItem);
      
      sel = currentParent = await addNode(rootItem.text, true, true,[], null, null, rootItem.ontology);
      processRootMeta(rootItem, currentParent.id);
      
      // Safely extract the root item from the array so it isn't rendered twice
      if (rootIndex !== -1) {
          parsed.splice(rootIndex, 1);
      }
    } else {
      sel = currentParent = await addNode(t("INPUT_TITLE_PASTE_ROOT"), true, true,[], null);
    }
  } else {
    currentParent = sel;
    ea.copyViewElementsToEAforEditing([sel]);
    currentParent = ea.getElement(sel.id);
  }

  const stack = [{ indent: -1, node: currentParent }];

  if (rootSelected) {
    const allViewElements = ea.getViewElements();
    const info = getHierarchy(sel, allViewElements);
    const projectElements = getMindmapProjectElements(info.rootId, allViewElements);
    ea.copyViewElementsToEAforEditing(projectElements.filter(el => !ea.getElement(el.id))); 
  }
  
  for (const item of parsed) {
    // Relocate stack parser root when encountering a ## Submap Header
    if (item.isSubmapDef) {
        const targetNode = submapNodesByName.get(item.text);
        if (targetNode) {
            stack.length = 0;
            stack.push({ indent: -1, node: targetNode });
        } else {
            // Edge case: Submap def without embed. Create at root to salvage data.
            const currentAllElements = ea.getElements();
            const newNode = await addNode(item.text, false, true, currentAllElements, currentParent, null, null);
            ea.addAppendUpdateCustomData(newNode.id, { isAdditionalRoot: true });
            submapNodesByName.set(item.text, newNode);
            stack.length = 0;
            stack.push({ indent: -1, node: newNode });
        }
        continue;
    }

    while (stack.length > 1 && item.indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const parentNode = stack[stack.length - 1].node;
    const currentAllElements = ea.getElements();
    const newNode = await addNode(item.text, false, true, currentAllElements, parentNode, null, item.ontology);
    
    // Process Metadata
    if (item.blockRef) blockRefToNodeId.set(item.blockRef, newNode.id);
    if (item.outgoingRefs.length > 0) nodeToOutgoingRefs.set(newNode.id, item.outgoingRefs);
    if (item.hasBoundary) createImportBoundary(newNode.id);
    if (item.isSubmapRef) {
        ea.addAppendUpdateCustomData(newNode.id, { isAdditionalRoot: true });
        submapNodesByName.set(item.text, newNode);
    }
    
    stack.push({ indent: item.indent, node: newNode });
  }

  // -------------------------------------------------------------------------
  //  Generate Crosslinks
  // -------------------------------------------------------------------------
  nodeToOutgoingRefs.forEach((targetRefs, sourceId) => {
    targetRefs.forEach(targetObj => {
      const { ref, label } = targetObj;
      const targetId = blockRefToNodeId.get(ref);

      if (targetId) {
        const arrowId = ea.connectObjects(
          sourceId, null, 
          targetId, null, 
          {
            startArrowHead: null,
            endArrowHead: "triangle"
          }
        );

        const arrowEl = ea.getElement(arrowId);
        if (arrowEl) {
          arrowEl.strokeStyle = "dashed";
          addUpdateArrowLabel(arrowEl, label);
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // "Right-Left" Balanced Layout Adjustment for Imported L1 Nodes
  // -------------------------------------------------------------------------
  const rootIdForImport = sel
    ? getHierarchy(sel, ea.getElements()).rootId 
    : currentParent.id;

  const rootElForImport = sel 
    ? ea.getElement(rootIdForImport) 
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

      importedL1Nodes.sort((a, b) => (a.customData?.mindmapOrder || 0) - (b.customData?.mindmapOrder || 0));

      if (importedL1Nodes.length > 0) {
        const splitIndex = Math.ceil(importedL1Nodes.length / 2);

        importedL1Nodes.forEach((node, i) => {
          ea.addAppendUpdateCustomData(node.id, { mindmapNew: undefined });
          
          if (i < splitIndex) {
             node.x = rootElForImport.x + rootElForImport.width + 100;
          } else {
             node.x = rootElForImport.x - node.width - 100;
          }
        });
      }
    }
  }

  await addElementsToView({
    repositionToCursor: !rootSelected,
    captureUpdate: "EVENTUALLY"
  });

  // -------------------------------------------------------------------------
  //  Fix Z-Index for Created Boundaries (Parents Below Children)
  // -------------------------------------------------------------------------
  if (createdBoundaries.length > 0) {
    const allEls = ea.getViewElements();
    
    const boundariesWithDepth = createdBoundaries.map(b => {
      const node = allEls.find(e => e.id === b.nodeId);
      const depth = node ? getHierarchy(node, allEls).depth : 0;
      return { ...b, depth };
    });

    boundariesWithDepth.sort((a, b) => a.depth - b.depth);

    for (const b of boundariesWithDepth) {
      const currentEls = ea.getViewElements();
      
      let parentBoundaryIndex = -1;
      let curr = currentEls.find(e => e.id === b.nodeId);

      while (curr) {
        const parent = getParentNode(curr.id, currentEls);
        if (!parent) break;
        if (parent.customData?.boundaryId) {
          const pIndex = currentEls.findIndex(el => el.id === parent.customData.boundaryId);
          if (pIndex !== -1) {
            parentBoundaryIndex = pIndex;
            break;
          }
        }
        curr = parent;
      }
      
      const targetIndex = parentBoundaryIndex !== -1 ? parentBoundaryIndex + 1 : 0;
      ea.moveViewElementToZIndex(b.boundaryId, targetIndex);
    }
  }

  const allInView = ea.getViewElements();
  const targetToSelect = sel
    ? allInView.find((e) => e.id === sel.id)
    : allInView.find((e) => e.id === currentParent?.id);

  if (targetToSelect) {
    selectNodeInView(targetToSelect);
  }

  const rootId = sel
    ? getHierarchy(sel, allInView).rootId
    : currentParent.id;
  await triggerGlobalLayout(rootId);

  notice.setMessage(t("NOTICE_PASTE_COMPLETE"));
  notice.setAutoHide(4000);
};

/**
// Pastes a Markdown list from clipboard into the map, converting it to nodes.
**/
const pasteListToMap = async (contentToPaste = null) => {
  const rawText = contentToPaste || await navigator.clipboard.readText();
  if (!rawText) {
    new Notice(t("NOTICE_CLIPBOARD_EMPTY"));
    return;
  }
  await importTextToMap(rawText);
};

/**
 * Intelligent paste dispatcher. Parses clipboard for Element JSON / Raw Images,
 * translates them to Markdown strings, and passes them to `addNode()`.
 */
const pasteElementToMap = async () => {
  if (!isViewSet()) return;
  const sel = getMindmapNodeFromSelection();
  
  // Standard text-list paste handles root-level initialization better
  if (!sel) {
    await pasteListToMap();
    return;
  }

  let rawText = "";
  try {
    rawText = await navigator.clipboard.readText();
  } catch (e) {}

  let isSingleImageJSON = false;
  const excalidrawClipboardPayload = rawText && rawText.includes('"type":"excalidraw/clipboard"');

  // Scenario 1: Excalidraw Element JSON (Single Element or Container+Text)
  if (excalidrawClipboardPayload) {
    let clipboardData;
    try {
       clipboardData = JSON.parse(rawText);
    } catch (e) {}

    if (clipboardData && clipboardData.elements) {
      const els = clipboardData.elements.filter(e => !e.isDeleted);
      const isSingleElement = els.length === 1 && ["embeddable", "text"].includes(els[0].type);
      
      const textEl = els.find(e => e.type === "text");
      const containerEl = els.find(e =>["rectangle", "ellipse", "diamond"].includes(e.type));
      const isContainerText = els.length === 2 && textEl && containerEl && textEl.containerId === containerEl.id;
      
      isSingleImageJSON = els.length === 1 && els[0].type === "image";

      if (isSingleElement || isContainerText) {
        let textToPaste = "";
        let shapeToPaste = null;

        if (isContainerText) {
          textToPaste = textEl.rawText;
          shapeToPaste = containerEl.type;
        } else if (els[0].type === "text") {
          textToPaste = els[0].rawText;
        } else if (els[0].type === "embeddable") {
          const link = els[0].link;
          if (link.match(/^https?:\/\//i)) {
            textToPaste = `![](${link})`;
          } else {
            textToPaste = link.startsWith("[[") ? `!${link}` : `![[${link}]]`;
          }
          if (textToPaste) {
            pasteListToMap(textToPaste);
            return;
          }
        }

        if (textToPaste) {
          // Add as a normal node using central logic
          const newNode = await addNode(textToPaste, false, false, null, null, null, null);
          
          // Recreate the shape if it was inside a container
          if (shapeToPaste) {
             const isContainer = ["rectangle", "ellipse", "diamond"].includes(newNode.type);
             if (isContainer) {
                if (newNode.type !== shapeToPaste) {
                  selectNodeInView(newNode);
                  await toggleBox(); // Removes auto-added box of the wrong shape
                  await toggleBox(shapeToPaste); // Re-adds correct shape box
                }
             } else {
                selectNodeInView(newNode);
                await toggleBox(shapeToPaste);
             }
          }
          return;
        }
      }
    }
  }

  // Scenario 2: Native image payload intercepted from system clipboard or Single Image JSON
  let hasImageBlob = false;
  let blob = null;
  let mimeType = null;
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find(t => t.startsWith("image/"));
      if (imageType) {
        hasImageBlob = true;
        mimeType = imageType;
        blob = await item.getType(imageType);
        break;
      }
    }
  } catch (e) {}

  if (hasImageBlob || isSingleImageJSON) {
    const beforeIds = new Set(ea.getViewElements().map(e => e.id));
    
    // Trigger native paste via synthetic event so Excalidraw saves the file natively
    const dt = new DataTransfer();
    if (hasImageBlob && blob) {
      const file = new File([blob], `Pasted image.${mimeType.split("/")[1] || "png"}`, { type: mimeType });
      dt.items.add(file);
    } else if (isSingleImageJSON) {
      dt.setData("text/plain", rawText);
    }
    
    const pasteEvent = new ClipboardEvent("paste", {
      clipboardData: dt,
      bubbles: true,
      cancelable: true
    });
    
    const targetEl = ea.targetView.contentEl.querySelector(".excalidraw") || ea.targetView.contentEl;
    const originallySelectedElement = ea.getViewSelectedElement();
    targetEl.dispatchEvent(pasteEvent);
    
    let newImageEl = null;
    let file = null;
    let savedOnce = false;
    // Poll to wait for Excalidraw to assign a fileId to the new image
    for (let i = 0; i < 40; i++) {
      await sleep(50);
      const currentElements = ea.getViewElements();
      const added = currentElements.filter(e => !beforeIds.has(e.id) && e.type === "image");
      
      // Wait until Excalidraw has assigned a fileId to the new image
      if (added.length > 0) {
         const tmpNewImageEl = added[added.length - 1];
         if (!tmpNewImageEl.fileId) {
           continue; // Still waiting for fileId assignment
         }
         const sceneFiles = api().getFiles();
         if (!sceneFiles[tmpNewImageEl.fileId]) {
          continue; // fileId not yet recognized in scene
         }
         file = ea.getViewFileForImageElement(tmpNewImageEl);
         if (!file) {
           if (!savedOnce && ea.targetView.isDirty()) {
             savedOnce = true;
             await ea.targetView.save();
           }
           continue; // Excalidraw file retrieval not yet working
         }
         newImageEl = tmpNewImageEl;
         break;
      }
    }
    
    if (newImageEl && file) {
      // Silently delete the temporary pasted image
      await sleep(200); //likely unnecessary contingencey to ensure Excalidraw has finished processing the new image before we delete it
      const imageID = newImageEl.id;
      ea.clear();
      ea.copyViewElementsToEAforEditing([newImageEl]);
      ea.getElement(imageID).isDeleted = true;
      await addElementsToView({ captureUpdate: "EVENTUALLY", shouldRestoreElements: false });
      
      ea.selectElementsInView([originallySelectedElement.id]); // Reselect original node because paste image steals selection
      const imagePath = `![[${file.path}]]`;
      await pasteListToMap(imagePath);
    }
    return;
  }

  // Fallback to Outline parser
  if (!excalidrawClipboardPayload) {
    await pasteListToMap();
  } else {
    new Notice(t("NOTICE_PASTE_ABORTED"));
  }
};
// ---------------------------------------------------------------------------
// 6. Map Actions
// ---------------------------------------------------------------------------

/**
 * Reconnects an arrow from one element to another.
 * Updates the arrow's binding (start or end) and maintains the boundElements arrays
 * of both the old and new parent nodes to ensure consistency.
 * 
 * @param {ExcalidrawElement} currentBindingElement - The node to disconnect from.
 * @param {ExcalidrawElement} newBindingElement - The node to connect to.
 * @param {ExcalidrawElement} arrow - The arrow element to rewire.
 * @param {string} side - "start" or "end". Defaults to "start".
 */
const reconnectArrow = (currentBindingElement, newBindingElement, arrow, side = "start") => {
  // 1. Ensure all involved elements are in the EA workbench
  const elementsToCheck = [currentBindingElement, newBindingElement, arrow];
  const elementsToCopy = elementsToCheck.filter(el => !ea.getElement(el.id));
  
  if (elementsToCopy.length > 0) {
    ea.copyViewElementsToEAforEditing(elementsToCopy);
  }

  // 2. Retrieve mutable references from EA
  const oldNode = ea.getElement(currentBindingElement.id);
  const newNode = ea.getElement(newBindingElement.id);
  const targetArrow = ea.getElement(arrow.id);

  // 3. Update the Arrow's binding property
  const bindingKey = side === "start" ? "startBinding" : "endBinding";
  targetArrow[bindingKey] = {
    ...(targetArrow[bindingKey] || {}),
    elementId: newNode.id
  };

  // 4. Remove arrow reference from the Old Node's boundElements
  if (oldNode.boundElements) {
    oldNode.boundElements = oldNode.boundElements.filter(be => be.id !== targetArrow.id);
  }

  // 5. Add arrow reference to the New Node's boundElements
  if (!newNode.boundElements) newNode.boundElements = [];
  // Prevent duplicates
  if (!newNode.boundElements.some(be => be.id === targetArrow.id)) {
    newNode.boundElements.push({ type: "arrow", id: targetArrow.id });
  }
};

/**
 * Recursively updates the font size of a subtree based on the new depth level.
 * Only updates if the current font size matches the default for its *previous* depth,
 * preserving user customizations.
 * Also updates the ontology label (if present) on the incoming arrow to be half the node's new size.
 */
const updateSubtreeFontSize = (nodeId, newDepth, oldDepth, allElements, newFontScaleType, oldFontScaleType) => {
  const newFontScale = getFontScale(newFontScaleType);
  const oldFontScale = getFontScale(oldFontScaleType);
  
  const node = allElements.find(el => el.id === nodeId);
  if (!node) return;
  if (!ea.getElement(nodeId)) {
    ea.copyViewElementsToEAforEditing([node]);
  }

  // Calculate standard sizes based on the old and new contexts
  const oldStandardSize = oldFontScale[Math.min(oldDepth, oldFontScale.length - 1)];
  const newStandardSize = newFontScale[Math.min(newDepth, newFontScale.length - 1)];

  // Update only if the user hasn't customized the font size
  if (node.fontSize === oldStandardSize) {
    const eaNode = ea.getElement(nodeId);
    eaNode.fontSize = newStandardSize;
    
    // Refresh dimensions to fit new font size
    if (eaNode.type === "text" || (eaNode.boundElements && eaNode.boundElements.some(b => b.type === "text"))) {
      ea.refreshTextElementSize(eaNode.id);
    }
  }

  // Update Ontology (Arrow Label) size
  // Find the arrow pointing TO this node
  const incomingArrow = allElements.find(
    (a) => a.type === "arrow" &&
    a.customData?.isBranch &&
    a.endBinding?.elementId === nodeId
  );

  if (incomingArrow) {
    // Get the bound text element (ontology)
    const maybeTextElement = ea.getBoundTextElement(incomingArrow, true);
    let eaOntologyEl = maybeTextElement.eaElement;
    
    // If it exists in the scene but not yet in EA workbench, copy it
    if (!eaOntologyEl && maybeTextElement.sceneElement) {
      ea.copyViewElementsToEAforEditing([maybeTextElement.sceneElement]);
      eaOntologyEl = ea.getElement(maybeTextElement.sceneElement.id);
    }

    // Apply half-size logic
    if (eaOntologyEl && eaOntologyEl.fontSize === Math.floor(oldStandardSize / 2)) {
      eaOntologyEl.fontSize = Math.floor(newStandardSize / 2);
      ea.refreshTextElementSize(eaOntologyEl.id);
    }
  }

  // Stop recursion if this node is an additional root (submap). 
  // Its own node size updates to match the parent, but its children scale relative to IT.
  if (node.customData?.isAdditionalRoot === true) {
     return;
  }

  // Recurse to children
  const children = getChildrenNodes(nodeId, allElements);
  children.forEach(child => {
    updateSubtreeFontSize(child.id, newDepth + 1, oldDepth + 1, allElements, newFontScaleType, oldFontScaleType);
  });
};

/**
 * Recursively updates the stroke width of a subtree based on the new depth level.
 * Only updates if the current width matches the default for its *previous* depth.
 */
const updateSubtreeStrokeWidth = (nodeId, newDepth, oldDepth, allElements, newBaseWidth, newBranchScale, oldBaseWidth, oldBranchScale) => {
  const node = allElements.find(el => el.id === nodeId);
  if (!node) return;
  
  // Ensure mutable element exists
  if (!ea.getElement(nodeId)) {
    ea.copyViewElementsToEAforEditing([node]);
  }

  const oldStandardWidth = calculateStrokeWidth(oldDepth, oldBaseWidth, oldBranchScale);
  const newStandardWidth = calculateStrokeWidth(newDepth, newBaseWidth, newBranchScale);
  const tolerance = 0.05;

  // 1. Update the incoming arrow (the connector)
  const incomingArrow = allElements.find(
    (a) => a.type === "arrow" &&
    a.customData?.isBranch &&
    a.endBinding?.elementId === nodeId
  );

  if (incomingArrow) {
    if (!ea.getElement(incomingArrow.id)) ea.copyViewElementsToEAforEditing([incomingArrow]);
    const eaArrow = ea.getElement(incomingArrow.id);
    
    // Update if it matches old standard
    if (Math.abs(eaArrow.strokeWidth - oldStandardWidth) < tolerance) {
      eaArrow.strokeWidth = newStandardWidth;
    }
  }

  // 2. Update the Node itself (e.g. if it is a box)
  // Text elements don't have stroke width, but containers do.
  if (node.type !== "text" && Math.abs(node.strokeWidth - oldStandardWidth) < tolerance) {
    const eaNode = ea.getElement(nodeId);
    eaNode.strokeWidth = newStandardWidth;
  }

  // Stop recursion if this node is an additional root (submap).
  if (node.customData?.isAdditionalRoot === true) {
     return;
  }

  // Recurse to children
  const children = getChildrenNodes(nodeId, allElements);
  children.forEach(child => {
    updateSubtreeStrokeWidth(child.id, newDepth + 1, oldDepth + 1, allElements, newBaseWidth, newBranchScale, oldBaseWidth, oldBranchScale);
  });
};

/**
 * Recursively updates the color of a subtree.
 * Acts as a flood-fill: only updates children that matched the old parent color.
 * 
 * @param {string} nodeId - Current node ID
 * @param {string} oldColor - The color we are replacing (the color the branch used to be)
 * @param {string} newColor - The color we are applying
 * @param {ExcalidrawElement[]} allElements - Scene elements
 */
const updateSubtreeColor = (nodeId, oldColor, newColor, allElements) => {
  const node = allElements.find(el => el.id === nodeId);
  if (!node) return;

  // If the node's color doesn't match the old branch color, 
  // it implies a manual override or a sub-branch with a different color. Stop recursion.
  if (node.strokeColor !== oldColor) return;

  if (!ea.getElement(nodeId)) ea.copyViewElementsToEAforEditing([node]);
  const eaNode = ea.getElement(nodeId);
  eaNode.strokeColor = newColor;

  // Update boundary color to match if the node has one
  if (node.customData?.boundaryId) {
    const boundaryEl = allElements.find(e => e.id === node.customData.boundaryId);
    if (boundaryEl) {
      if (!ea.getElement(boundaryEl.id)) ea.copyViewElementsToEAforEditing([boundaryEl]);
      const eaBoundary = ea.getElement(boundaryEl.id);
      eaBoundary.strokeColor = newColor;
      eaBoundary.backgroundColor = newColor;
    }
  }

  // Update incoming arrow (Ontology/Connector)
  const incomingArrow = allElements.find(
    (a) => a.type === "arrow" &&
    a.customData?.isBranch &&
    a.endBinding?.elementId === nodeId
  );

  if (incomingArrow && incomingArrow.strokeColor === oldColor) {
    if (!ea.getElement(incomingArrow.id)) ea.copyViewElementsToEAforEditing([incomingArrow]);
    const eaArrow = ea.getElement(incomingArrow.id);
    eaArrow.strokeColor = newColor;

    // Update the Ontology label (bound text element) of the arrow
    const maybeTextElement = ea.getBoundTextElement(incomingArrow, true);
    let eaOntologyEl = maybeTextElement.eaElement;
    if (!eaOntologyEl && maybeTextElement.sceneElement) {
      ea.copyViewElementsToEAforEditing([maybeTextElement.sceneElement]);
      eaOntologyEl = ea.getElement(maybeTextElement.sceneElement.id);
    }
    if (eaOntologyEl) {
      eaOntologyEl.strokeColor = newColor;
    }
  }

  const children = getChildrenNodes(nodeId, allElements);
  children.forEach(child => {
    updateSubtreeColor(child.id, oldColor, newColor, allElements);
  });
};

/**
 * Toggles whether the selected node acts as an additional local root (submap root).
 * - Master root (no incoming isBranch connector) cannot be converted.
 * - Enabling submap root copies current map settings and assigns a directional growth mode
 *   inferred from the node position relative to its parent.
 * - Disabling submap root removes local layout metadata so descendants follow parent-root logic.
 */
const toggleSubmapRoot = async () => {
  if (!isViewSet()) return;
  const sel = getMindmapNodeFromSelection();
  if (!sel) return;

  const allElements = ea.getViewElements();
  const parent = getParentNode(sel.id, allElements);

  // Master root is the unique no-parent root and must remain a root.
  if (!parent) {
    new Notice(t("NOTICE_CANNOT_CHANGE_MASTER_ROOT"));
    return;
  }

  const isAdditionalRoot = sel.customData?.isAdditionalRoot === true;

  ea.copyViewElementsToEAforEditing([sel]);

  if (isAdditionalRoot) {
    const ok = await utils.suggester(
      ["Yes", "No"],
      [true, false],
      t("CONFIRM_REMOVE_SUBMAP_ROOT"),
    );
    if (!ok) {
      return;
    }

    const clearData = {};
    MAP_ROOT_CUSTOMDATA_KEYS.forEach((key) => {
      clearData[key] = undefined;
    });
    ea.addAppendUpdateCustomData(sel.id, clearData);
  } else {
    const sourceRoot = getSettingsRootNode(parent, allElements) || parent;
    const sourceCfg = getRootConfigForNode(sourceRoot);
    const inferredMode = inferDirectionalGrowthMode(sel, parent, sourceRoot, sourceCfg.growthMode);

    ea.addAppendUpdateCustomData(sel.id, {
      isAdditionalRoot: true,
      growthMode: inferredMode,
      autoLayoutDisabled: sourceCfg.autoLayoutDisabled,
      arrowType: sourceCfg.arrowType,
      fontsizeScale: sourceCfg.fontsizeScale,
      multicolor: sourceCfg.multicolor,
      boxChildren: sourceCfg.boxChildren,
      roundedCorners: sourceCfg.roundedCorners,
      maxWrapWidth: sourceCfg.maxWrapWidth,
      isSolidArrow: sourceCfg.isSolidArrow,
      centerText: sourceCfg.centerText,
      fillSweep: sourceCfg.fillSweep,
      branchScale: sourceCfg.branchScale,
      baseStrokeWidth: sourceCfg.baseStrokeWidth,
      layoutSettings: JSON.parse(JSON.stringify(sourceCfg.layoutSettings)),
    });
  }

  await addElementsToView({ captureUpdate: "EVENTUALLY" });
  const info = getHierarchy(sel, ea.getViewElements());
  await triggerGlobalLayout(info.rootId);

  new Notice(t(isAdditionalRoot ? "NOTICE_SUBMAP_ROOT_REMOVED" : "NOTICE_SUBMAP_ROOT_ADDED"));
  updateUI();
};

const changeNodeOrder = async (key) => {
  if (!isViewSet()) return;
  const allElements = ea.getViewElements();
  const current = getMindmapNodeFromSelection();
  if (!current) return;

  const parent = getParentNode(current.id, allElements);
  if (!parent) {
    new Notice(t("NOTICE_CANNOT_MOVE_ROOT"));
    return;
  }
  
  const info = getHierarchy(current, allElements);
  const currentSettingsRoot = getSettingsRootNode(current, allElements);
  const root = (current.customData?.isAdditionalRoot === true)
    ? (getSettingsRootNode(parent, allElements) || currentSettingsRoot || allElements.find((e) => e.id === info.rootId))
    : (currentSettingsRoot || allElements.find((e) => e.id === info.rootId));
  if (!root) return;

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

  const rootCenter = root.x + root.width / 2;
  const curCenter = current.x + current.width / 2;
  const rootCenterY = root.y + root.height / 2;
  const curCenterY = current.y + current.height / 2;
  
  const mapMode = root.customData?.growthMode || currentModalGrowthMode;
  const isVerticalMode =["Up-facing", "Down-facing", "Up-Down"].includes(mapMode);
  const isRadial = (mapMode === "Radial");

  const isInPositive = isVerticalMode ? (curCenterY > rootCenterY) : (curCenter > rootCenter);

  // --- GET OLD SETTINGS ROOT AND OLD DEPTH ---
  const oldSettingsRoot = getSettingsRootNode(parent, allElements) || allElements.find(e => e.id === info.rootId);
  const oldDepth = getDepthFromAncestor(current.id, oldSettingsRoot.id, allElements);
  const oldRootCfg = getRootConfigForNode(oldSettingsRoot);

  // ---------------------------------------------------------
  // Feature: L1 Node Side Swap 
  // ---------------------------------------------------------
  if (parent.id === root.id && ((!isVerticalMode && mapMode === "Right-Left") || (isVerticalMode && mapMode === "Up-Down"))) {
     const movePos = isVerticalMode ? (!isInPositive && key === "ArrowDown") : (!isInPositive && key === "ArrowRight"); // Negative Side -> Positive Side
     const moveNeg = isVerticalMode ? (isInPositive && key === "ArrowUp")   : (isInPositive && key === "ArrowLeft");    // Positive Side -> Negative Side

     if (movePos || moveNeg) {
        // Calculate Delta to mirror across root center
        const delta = isVerticalMode ? 2 * (rootCenterY - curCenterY) : 2 * (rootCenter - curCenter);
        
        // Gather all elements in branch + decorations
        const branchIds = getBranchElementIds(current.id, allElements);
        
        // Use the specialized function to get decorations and crosslinks 
        // to safely ignore structural groups that might encompass the entire map
        const decorationAndCrossLinkIds = getDecorationAndCrossLinkIdsForBranches(branchIds, allElements, info.rootId);
        
        const elementsToMove = new Set();
        
        branchIds.forEach(id => {
           const el = allElements.find(x => x.id === id);
           if (el) elementsToMove.add(el);
        });
        
        decorationAndCrossLinkIds.forEach(id => {
           const el = allElements.find(x => x.id === id);
           if (el) elementsToMove.add(el);
        });
        
        const arr = Array.from(elementsToMove);
        ea.copyViewElementsToEAforEditing(arr);
        arr.forEach(el => {
            const eaEl = ea.getElement(el.id);
            if (isVerticalMode) eaEl.y += delta;
            else eaEl.x += delta;
        });
        
        await addElementsToView({ captureUpdate: "EVENTUALLY" });
        
        // Trigger layout. mustHonorMindmapOrder=false ensures the engine sorts based on the NEW visual position
        triggerGlobalLayout(root.id, false, false);
        return;
     }
  }

  // 1. Structural Promotion / Demotion
  const isPromote = isVerticalMode
      ? ((isInPositive && key === "ArrowUp") || (!isInPositive && key === "ArrowDown"))
      : ((isInPositive && key === "ArrowLeft") || (!isInPositive && key === "ArrowRight"));
      
  const isDemote = isVerticalMode
      ? ((isInPositive && key === "ArrowDown") || (!isInPositive && key === "ArrowUp"))
      : ((isInPositive && key === "ArrowRight") || (!isInPositive && key === "ArrowLeft"));
  
  if (isPromote) {
    if (parent.id === root.id && root.customData?.isAdditionalRoot !== true) return; // Cannot promote L1 nodes under master map root
    
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
      // Find new settings root and depth relative to the target parent
      const newSettingsRoot = getSettingsRootNode(grandParent, allElements) || allElements.find(e => e.id === info.rootId);
      const newRootCfg = getRootConfigForNode(newSettingsRoot);
      const newDepth = getDepthFromAncestor(grandParent.id, newSettingsRoot.id, allElements) + 1;

      reconnectArrow(parent, grandParent, arrow, "start");
      const parentOrder = getMindmapOrder(parent);
      const promoteTargetRoot = parent.customData?.isAdditionalRoot === true
        ? newSettingsRoot
        : root;
      
      ea.copyViewElementsToEAforEditing([current]);
      ea.addAppendUpdateCustomData(current.id, {
        mindmapOrder: isRadial && !isInPositive ? parentOrder - 0.5 : parentOrder + 0.5
      });
      
      updateSubtreeFontSize(current.id, newDepth, oldDepth, allElements, newRootCfg.fontsizeScale, oldRootCfg.fontsizeScale);
      updateSubtreeStrokeWidth(current.id, newDepth, oldDepth, allElements, newRootCfg.baseStrokeWidth, newRootCfg.branchScale, oldRootCfg.baseStrokeWidth, oldRootCfg.branchScale);

      // --- Update Colors (Promotion) ---
      const isTargetL1 = (grandParent.id === promoteTargetRoot.id);
      let targetColor;
      
      if (isTargetL1) {
          if (newRootCfg.multicolor) {
              targetColor = current.customData?.previousL1Color;
              if (!targetColor) {
                  const existingL1Colors = getChildrenNodes(promoteTargetRoot.id, allElements).map(n => n.strokeColor);
                  targetColor = getDynamicColor(existingL1Colors);
              }
          } else {
              targetColor = promoteTargetRoot.strokeColor;
          }
      } else {
          targetColor = grandParent.strokeColor;
      }
      
      updateSubtreeColor(current.id, current.strokeColor, targetColor, allElements);

      await addElementsToView({ captureUpdate: "EVENTUALLY" });
      triggerGlobalLayout(promoteTargetRoot.id, false, true);
      return;
    }
  }

  if (isDemote) {
    // Demotion: Selected node becomes child of sibling of current parent
    const siblings = getChildrenNodes(parent.id, allElements);
    
    // Sort siblings to ensure we pick the correct visual neighbor based on mindmapOrder
    siblings.sort((a, b) => getMindmapOrder(a) - getMindmapOrder(b));
    
    if (siblings.length < 2) {
      new Notice(t("NOTICE_CANNOT_DEMOTE_NO_SIBLING_TO_ACCEPT"));
      return;
    }
    
    const currentIndex = siblings.findIndex(s => s.id === current.id);
    const mirrorBehavior = (isRadial && !isInPositive);
    
    let targetIndex = mirrorBehavior ? currentIndex + 1 : currentIndex - 1;
    
    // Prevent out-of-bounds demotion
    if (targetIndex < 0 || targetIndex >= siblings.length) {
      new Notice(t("NOTICE_CANNOT_DEMOTE_NO_VALID_SIBLING"));
      return;
    }
    
    const newParent = siblings[targetIndex];
    
    // Prevent cross-side demotion for L1 nodes
    if (parent.id === root.id) {
       const targetIsPos = isVerticalMode ? (newParent.y + newParent.height/2 > rootCenterY) : (newParent.x + newParent.width/2 > rootCenter);
       if (targetIsPos !== isInPositive) {
         new Notice(t("NOTICE_CANNOT_DEMOTE_CROSS_SIDE_NOT_ALLOWED"));
          return;
       }
    }
    
    // Find the arrow to update structural binding
    const arrow = allElements.find(
      (a) => a.type === "arrow" && 
      a.customData?.isBranch && 
      a.startBinding?.elementId === parent.id && 
      a.endBinding?.elementId === current.id
    );

    if (arrow) {
      // Find new settings root and calculate depth using the demoted parent context
      const newSettingsRoot = getSettingsRootNode(newParent, allElements) || allElements.find(e => e.id === info.rootId);
      const newRootCfg = getRootConfigForNode(newSettingsRoot);
      const newDepth = getDepthFromAncestor(newParent.id, newSettingsRoot.id, allElements) + 1;

      reconnectArrow(parent, newParent, arrow, "start");
      // Determine new order: Append as last child of new parent
      const newParentChildren = getChildrenNodes(newParent.id, allElements);
      const nextOrder = newParentChildren.length > 0 ? Math.max(...newParentChildren.map(getMindmapOrder)) + 1 : 0;
      
      ea.copyViewElementsToEAforEditing([current]);
      
      // Store previous L1 color if we are demoting from an L1 position
      if (parent.id === oldSettingsRoot.id) {
          ea.addAppendUpdateCustomData(current.id, { 
              mindmapOrder: nextOrder,
              previousL1Color: current.strokeColor
          });
      } else {
          ea.addAppendUpdateCustomData(current.id, { mindmapOrder: nextOrder });
      }
      
      updateSubtreeFontSize(current.id, newDepth, oldDepth, allElements, newRootCfg.fontsizeScale, oldRootCfg.fontsizeScale);
      updateSubtreeStrokeWidth(current.id, newDepth, oldDepth, allElements, newRootCfg.baseStrokeWidth, newRootCfg.branchScale, oldRootCfg.baseStrokeWidth, oldRootCfg.branchScale);

      // --- Update Colors (Demotion) ---
      // If the node we are attaching to IS a settings root, we are becoming an L1 of a submap.
      const isTargetL1 = (newParent.id === newSettingsRoot.id);
      let targetColor;
      
      if (isTargetL1) {
          if (newRootCfg.multicolor) {
              const existingL1Colors = getChildrenNodes(newSettingsRoot.id, allElements).map(n => n.strokeColor);
              targetColor = getDynamicColor(existingL1Colors);
          } else {
              targetColor = newSettingsRoot.strokeColor;
          }
      } else {
          targetColor = newParent.strokeColor;
      }

      updateSubtreeColor(current.id, current.strokeColor, targetColor, allElements);

      await addElementsToView({ captureUpdate: "EVENTUALLY" });
      triggerGlobalLayout(root.id, false, true);
    }
    return;
  }

  // 2. Sibling Reordering (Up/Down/Left/Right Arrows)
  const isReorderPos = isVerticalMode ? (key === "ArrowRight") : (key === "ArrowDown");
  const isReorderNeg = isVerticalMode ? (key === "ArrowLeft") : (key === "ArrowUp");

  if (isReorderPos || isReorderNeg) {
    const siblings = getChildrenNodes(parent.id, allElements);
    if (siblings.length < 2) return;

    // Ensure siblings are sorted by current order before swapping
    siblings.sort((a, b) => getMindmapOrder(a) - getMindmapOrder(b));
    
    const currentIndex = siblings.findIndex(s => s.id === current.id);
    if (currentIndex === -1) return;

    let swapIndex = -1;
    
    if (isVerticalMode) {
       // Up/Down facing uses Left/Right keys for siblings
       if (key === "ArrowRight") swapIndex = currentIndex + 1;
       if (key === "ArrowLeft") swapIndex = currentIndex - 1;
    } else {
       // Radial Left flips the interpretation of Up/Down since it generates from Bottom to Top
       if (isRadial && !isInPositive) {
         if (key === "ArrowUp") swapIndex = currentIndex + 1;
         if (key === "ArrowDown") swapIndex = currentIndex - 1;
       } else {
         if (key === "ArrowDown") swapIndex = currentIndex + 1;
         if (key === "ArrowUp") swapIndex = currentIndex - 1;
       }
    }

    // Apply circular wrapping for Radial mode (Level 1 nodes only)
    if (isRadial && parent.id === root.id) {
       swapIndex = (swapIndex + siblings.length) % siblings.length;
    }

    // Boundary checks
    if (swapIndex >= 0 && swapIndex < siblings.length) {
      const swapNode = siblings[swapIndex];
      
      // Prevent cross-side swapping for L1 nodes (Except for Radial maps, where we just wrapped)
      if (parent.id === root.id && !isRadial) {
         const swapIsPos = isVerticalMode ? (swapNode.y + swapNode.height/2 > rootCenterY) : (swapNode.x + swapNode.width/2 > rootCenter);
         if (swapIsPos !== isInPositive) {
            return; // Silently block cross-side reordering
         }
      }

      // Re-normalize all orders to clean integers to prevent drift
      ea.copyViewElementsToEAforEditing(siblings);
      
      siblings.forEach((sib, idx) => {
        let newOrder = idx;
        if (idx === currentIndex) newOrder = swapIndex;
        if (idx === swapIndex) newOrder = currentIndex;
        
        ea.addAppendUpdateCustomData(sib.id, { mindmapOrder: newOrder });
      });

      await addElementsToView({ captureUpdate: "EVENTUALLY" });
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
  if (!isViewSet()) return;
  let allElements = ea.getViewElements();
  const current = getMindmapNodeFromSelection();
  if (!current) return;

  const info = getHierarchy(current, allElements);
  const parent = getParentNode(current.id, allElements);
  const currentSettingsRoot = getSettingsRootNode(current, allElements);
  const root = (current.customData?.isAdditionalRoot === true && parent)
    ? (getSettingsRootNode(parent, allElements) || currentSettingsRoot || allElements.find((e) => e.id === info.rootId))
    : (currentSettingsRoot || allElements.find((e) => e.id === info.rootId));
  if (!root) return;
  const rootCenter = { x: root.x + root.width / 2, y: root.y + root.height / 2 };

  const mapMode = root.customData?.growthMode || currentModalGrowthMode;
  const isVerticalLayout = ["Up-facing", "Down-facing", "Up-Down"].includes(mapMode);

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

      if (isVerticalLayout) {
        if (key === "ArrowLeft") targetChild = children[0];
        else if (key === "ArrowRight") targetChild = children[children.length - 1];
        else {
          // Left/Right Logic
          // Calculate relative positions
          const childrenWithPos = children.map(c => ({
            node: c,
            dx: Math.abs((c.x + c.width/2) - rootCenter.x), // distance from vertical centerline
            dy: (c.y + c.height/2) - rootCenter.y 
          }));

          if (key === "ArrowDown") {
            // Find nodes below (dy > 0)
            const downNodes = childrenWithPos.filter(c => c.dy > 0).sort((a,b)=>a.dx - b.dx);
            targetChild = downNodes.length > 0 ? downNodes[0].node : children[0];
          } else if (key === "ArrowUp") {
             // Find nodes above (dy < 0)
            const upNodes = childrenWithPos.filter(c => c.dy < 0).sort((a,b)=>a.dx - b.dx);
            targetChild = upNodes.length > 0 ? upNodes[0].node : children[children.length - 1];
          }
        }
      } else {
        if (key === "ArrowUp") targetChild = children[0];
        else if (key === "ArrowDown") targetChild = children[children.length - 1];
        else {
          // Left/Right Logic
          // Calculate relative positions
          const childrenWithPos = children.map(c => ({
            node: c,
            dx: (c.x + c.width/2) - rootCenter.x,
            dy: Math.abs((c.y + c.height/2) - rootCenter.y) // distance from horizontal centerline
          }));

          if (key === "ArrowRight") {
            // Find nodes to the right (dx > 0)
            const rightNodes = childrenWithPos.filter(c => c.dx > 0).sort((a,b)=>a.dy - b.dy);
            targetChild = rightNodes.length > 0 ? rightNodes[0].node : children[0];
          } else if (key === "ArrowLeft") {
            // Find nodes to the left (dx < 0)
            const leftNodes = childrenWithPos.filter(c => c.dx < 0).sort((a,b)=>a.dy - b.dy);
            targetChild = leftNodes.length > 0 ? leftNodes[0].node : children[children.length - 1];
          }
        }
      }

      if (targetChild) {
        selectNodeInView(targetChild);
        if (zoom) zoomToFit();
        if (focus) focusSelected();
      }
    }
    return;
  }

  const isHierarchyNav = isVerticalLayout ? (key === "ArrowUp" || key === "ArrowDown") : (key === "ArrowLeft" || key === "ArrowRight");
  const isSiblingNav = isVerticalLayout ? (key === "ArrowLeft" || key === "ArrowRight") : (key === "ArrowUp" || key === "ArrowDown");

  if (isHierarchyNav) {
    const curCenter = { x: current.x + current.width / 2, y: current.y + current.height / 2 };
    const isInPositive = isVerticalLayout ? (curCenter.y > rootCenter.y) : (curCenter.x > rootCenter.x);
    
    let goIn = false;
    if (isVerticalLayout) {
        goIn = (key === "ArrowUp" && isInPositive) || (key === "ArrowDown" && !isInPositive);
    } else {
        goIn = (key === "ArrowLeft" && isInPositive) || (key === "ArrowRight" && !isInPositive);
    }

    if (goIn) {
      selectNodeInView(getParentNode(current.id, allElements));
    } else {
      if (current.customData?.isFolded) {
        await toggleFold("L0");
        allElements = ea.getViewElements();
      }
      const ch = getChildrenNodes(current.id, allElements).sort((a, b) => (a.customData?.mindmapOrder ?? 100) - (b.customData?.mindmapOrder ?? 100));
      if (ch.length) selectNodeInView(ch[0]);
    }
  } else if (isSiblingNav) {
    const parent = getParentNode(current.id, allElements);
    if (!parent) return;

    const siblings = getChildrenNodes(parent.id, allElements);

    // Calculate the immediate parent's center to sort siblings clockwise around it
    const parentCenter = { x: parent.x + parent.width / 2, y: parent.y + parent.height / 2 };

    // Always sort by angle from 12 o'clock (0 degrees) to ensure clockwise navigation
    // regardless of layout mode or hierarchy level.
    // We project the coordinates to neutralize width/height skewing the geometric center.
    siblings.sort((a, b) => {
      const aCX = a.x + a.width / 2;
      const aCY = a.y + a.height / 2;
      const bCX = b.x + b.width / 2;
      const bCY = b.y + b.height / 2;

      let aPoint = { x: aCX, y: aCY };
      let bPoint = { x: bCX, y: bCY };

      if (mapMode === "Radial") {
        // Use the edge closest to the parent to neutralize text width/height skew in Radial
        aPoint.x = aCX >= parentCenter.x ? a.x : a.x + a.width;
        aPoint.y = aCY >= parentCenter.y ? a.y : a.y + a.height;
        bPoint.x = bCX >= parentCenter.x ? b.x : b.x + b.width;
        bPoint.y = bCY >= parentCenter.y ? b.y : b.y + b.height;
      } else if (isVerticalLayout) {
        // Neutralize Y distance to sort strictly by X sequentially on each side
        aPoint.y = parentCenter.y + (aCY >= parentCenter.y ? 100000 : -100000);
        bPoint.y = parentCenter.y + (bCY >= parentCenter.y ? 100000 : -100000);
      } else {
        // Neutralize X distance to sort strictly by Y sequentially on each side
        aPoint.x = parentCenter.x + (aCX >= parentCenter.x ? 100000 : -100000);
        bPoint.x = parentCenter.x + (bCX >= parentCenter.x ? 100000 : -100000);
      }

      return getAngleFromCenter(parentCenter, aPoint) - getAngleFromCenter(parentCenter, bPoint);
    });

    const idx = siblings.findIndex((s) => s.id === current.id);
    const startIndex = (idx === -1 ? 0 : idx); // Start at 0 if current isn't found

    const currentIsNegativeBranch = isVerticalLayout 
         ? (current.y + current.height/2) < (parent.y + parent.height/2)
         : (current.x + current.width/2) < (parent.x + parent.width/2);

    // Reverse up/down for left-facing branches in directional modes
    let navigateForward; // true for next sibling (clockwise), false for previous (counter-clockwise)
    if (isVerticalLayout) {
      navigateForward = currentIsNegativeBranch ? (key === "ArrowRight") : (key === "ArrowLeft");
    } else {
      navigateForward = currentIsNegativeBranch ? (key === "ArrowUp") : (key === "ArrowDown");
    }

    let nIdx = navigateForward ? (startIndex + 1) % siblings.length : (startIndex - 1 + siblings.length) % siblings.length;
    selectNodeInView(siblings[nIdx]);
  }

  if (zoom) zoomToFit();
  if (focus) focusSelected();
};

/**
 * Triggers a layout refresh for the tree containing the selected element.
 */
const refreshMapLayout = async (sel) => {
  if (!isViewSet()) return;
  if (!sel) sel = getMindmapNodeFromSelection();
  if (sel) {
    const allElements = ea.getViewElements();
    const settingsRoot = getSettingsRootNode(sel, allElements);
    if (!settingsRoot) return;
    if (settingsRoot.customData?.autoLayoutDisabled === true) return;
    await triggerGlobalLayout(settingsRoot.id);
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
const getStructuralGroupForNode = (branchIds, workbenchEls, rootId) => {
  const decorationAndCrossLinkIds = getDecorationAndCrossLinkIdsForBranches(branchIds, workbenchEls, rootId);
  const elements = workbenchEls.filter(el => branchIds.includes(el.id) || decorationAndCrossLinkIds.includes(el.id));
  const commonGroupId = getCommonGroupForElements(elements)[0];
  const structuralGroupId = (commonGroupId && isMindmapGroup(commonGroupId, workbenchEls)) ? commonGroupId : null;
  return {structuralGroupId, groupedElementIds: structuralGroupId ? elements.map(e => e.id) : []};
};

/**
 * 
 * @param {*} nodeId 
 * @param {*} workbenchEls ExcalidrawAutomate elements on the workbench
 * @returns the group ID if a structural mindmap group exists for the branch, else null
 */
const getStructuralGroupsForNode = (branchIds, workbenchEls, rootId) => {
  const decorationAndCrossLinkIds = getDecorationAndCrossLinkIdsForBranches(branchIds, workbenchEls, rootId);
  const elements = workbenchEls.filter(el => branchIds.includes(el.id) || decorationAndCrossLinkIds.includes(el.id));
  const commonGroupIds = getCommonGroupForElements(elements);
  const structuralGroupIds = commonGroupIds.filter(commonGroupId => isMindmapGroup(commonGroupId, workbenchEls));
  return {structuralGroupIds, groupedElementIds: elements.map(e => e.id)};
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

const getDecorationAndCrossLinkIdsForBranches = (branchIds, allElements, rootId) => {
  const idsInBranch = new Set(branchIds);
  const decorationsAndCrossLInks = new Set();

  // Pre-index elements by ID and GroupID to avoid O(N*M) lookups
  const elementMap = new Map();
  const groupMap = new Map();

  for (const el of allElements) {
    elementMap.set(el.id, el);
    if (el.groupIds && el.groupIds.length > 0) {
      for (const gid of el.groupIds) {
        if (!groupMap.has(gid)) {
          groupMap.set(gid, []);
        }
        groupMap.get(gid).push(el);
      }
    }
  }

  // Track processed groups to avoid redundant checks if multiple branch nodes share a group
  const processedGroups = new Set();

  // Logic: Include elements that are grouped with our branch nodes, 
  // UNLESS that group also contains structural elements outside our branch (which would mean it's a parent group).
  for (const id of branchIds) {
    const el = elementMap.get(id);
    
    if (el && el.groupIds && el.groupIds.length > 0) {
      for (const gid of el.groupIds) {
        if (processedGroups.has(gid)) continue;
        processedGroups.add(gid);
        
        const groupMembers = groupMap.get(gid) || [];
        
        // Check if this group belongs *exclusively* to the branch (or is a local decoration group)
        // We do this by checking if any 'structural' member of the group is OUTSIDE our branch.
        let hasOutsider = false;
        const structuralMembers = [];
        
        for (const member of groupMembers) {
          if (idsInBranch.has(member.id) || isStructuralElement(member, allElements, rootId)) {
            structuralMembers.push(member);
            if (!idsInBranch.has(member.id)) {
              hasOutsider = true;
              break;
            }
          }
        }
        
        if (!hasOutsider) {
          const structuralMemberIds = new Set(structuralMembers.map(e => e.id));
          for (const member of groupMembers) {
            if (!structuralMemberIds.has(member.id)) {
              decorationsAndCrossLInks.add(member.id);
            }
          }
        }
      }
    }
  }

  // 3. Include Arrows (Structural & Crosslinks)
  // Condition: Start AND End are in the set.
  for (const el of allElements) {
    // Skip if already in branch or already identified as decoration
    if (idsInBranch.has(el.id) || decorationsAndCrossLInks.has(el.id)) continue;

    if (el.type === "arrow" && !el.customData?.isBranch) {
      if (el.startBinding?.elementId && el.endBinding?.elementId) {
        if (idsInBranch.has(el.startBinding.elementId) && idsInBranch.has(el.endBinding.elementId)) {
          decorationsAndCrossLInks.add(el.id);
          
          // Optimization: Check bound elements directly via elementMap instead of ea.getBoundTextElement (which might scan scene)
          if (el.boundElements && el.boundElements.length > 0) {
            for (const bound of el.boundElements) {
               if (bound.type === "text") decorationsAndCrossLInks.add(bound.id);
            }
          }
        }
      }
    }
  }

  return Array.from(decorationsAndCrossLInks);
};

/**
 * Identifies all elements belonging to a specific mindmap tree to optimize performance on large canvases.
 * This includes nodes, branch arrows, crosslinks, decorations, boundaries, and bound text.
 */
const getMindmapProjectElements = (rootId, allViewElements) => {
  // 1. Get core structural IDs
  const branchIds = getBranchElementIds(rootId, allViewElements);
  
  // 2. Get decorations and cross-links (requires scanning allViewElements for groups/arrows)
  const decorationAndCrossLinkIds = getDecorationAndCrossLinkIdsForBranches(branchIds, allViewElements, rootId);
  
  const projectElementIds = new Set([...branchIds, ...decorationAndCrossLinkIds]);
  const projectElements = [];
  const addedIds = new Set();
  
  const addWithDependencies = (id) => {
    if (addedIds.has(id)) return;
    const el = allViewElements.find(e => e.id === id);
    if (!el) return;
    
    projectElements.push(el);
    addedIds.add(id);
    
    // Include text inside containers or arrows
    if (el.boundElements) {
      el.boundElements.forEach(be => addWithDependencies(be.id));
    }
    // Include container of text
    if (el.containerId) {
      addWithDependencies(el.containerId);
    }
    // Include fold indicators
    if (el.customData?.foldIndicatorId) {
      addWithDependencies(el.customData.foldIndicatorId);
    }
    // Include boundaries
    if (el.customData?.boundaryId) {
      addWithDependencies(el.customData.boundaryId);
    }
  };
  
  projectElementIds.forEach(id => addWithDependencies(id));
  
  return projectElements;
};

/**
 * Toggles a single flat group for the selected branch.
**/
const toggleBranchGroup = async () => {
  if (!isViewSet()) return;
  const sel = getMindmapNodeFromSelection();
  if (!sel) return;

  const info = getHierarchy(sel, ea.getViewElements());
  if (!info || !info.rootId) return;

  const allElements = ea.getViewElements();
  const branchIds = getBranchElementIds(sel.id, allElements);
  const decorationAndCrossLinkIds = getDecorationAndCrossLinkIdsForBranches(branchIds, allElements, info.rootId);

  if (branchIds.length <= 1) return;

  ea.copyViewElementsToEAforEditing(allElements.filter(el => branchIds.includes(el.id) || decorationAndCrossLinkIds.includes(el.id)));
  const workbenchEls = ea.getElements();

  let newGroupId;
  let {structuralGroupIds, groupedElementIds} = getStructuralGroupsForNode(branchIds, workbenchEls, info.rootId);
  if (structuralGroupIds.length > 0) {
    //normally there should only be one structural group, however do to a bug in earlier MinMap Builder versions,
    //some branches may have multiple structural groups for the exact same set of nodes.
    structuralGroupIds.forEach(structuralGroupId => {
      if(getViewGroupElements(structuralGroupId).length === groupedElementIds.length) {
        removeGroupFromElements(structuralGroupId, workbenchEls);
      }
    });
  } else {
    newGroupId = ea.addToGroup([...branchIds, ...decorationAndCrossLinkIds]);
  }

  await addElementsToView({ captureUpdate: "IMMEDIATELY" });

  if (newGroupId) {
    let selectedGroupIds = {};
    selectedGroupIds[newGroupId] = true;
    ea.viewUpdateScene({appState: {selectedGroupIds, selectedElementIds: {}}});
  } else {
    ea.viewUpdateScene({appState: {selectedGroupIds: {}, selectedElementIds: {[sel.id]: true}}});
  }

  updateUI();
};

/**
 * Toggles the pinned state of the selected node.
 * Pinned nodes are not moved by auto-layout.
 */
const togglePin = async () => {
  if (!isViewSet()) return;
  const sel = getMindmapNodeFromSelection();
  if (sel) {
    const boundTextElement = ea.getBoundTextElement(sel, true)?.sceneElement;
    const newPinnedState = !(sel.customData?.isPinned === true);
    ea.copyViewElementsToEAforEditing(boundTextElement ? [sel, boundTextElement] : [sel]);
    ea.addAppendUpdateCustomData(sel.id, { isPinned: newPinnedState });
    if (boundTextElement && !newPinnedState && boundTextElement.customData?.hasOwnProperty("isPinned")) {
      ea.addAppendUpdateCustomData(boundTextElement.id, { isPinned: undefined });
    }
    await addElementsToView({ captureUpdate: autoLayoutDisabled ? "IMMEDIATELY" : "EVENTUALLY" });
    if(!autoLayoutDisabled) await refreshMapLayout();
    selectNodeInView(sel);
    updateUI();
  }
};

const toggleCheckboxStatus = async () => {
  if (!isViewSet()) return;
  const sel = getMindmapNodeFromSelection();
  if (!sel) return;

  const all = ea.getViewElements();
  // Find the text element specifically (if it's a container, grab its bound text)
  let textElId = sel.type === "text" ? sel.id : null;
  if (!textElId && sel.boundElements) {
    const boundText = sel.boundElements.find(be => be.type === "text");
    if (boundText) textElId = boundText.id;
  }
  if (!textElId) return;

  const textEl = all.find(el => el.id === textElId);
  if (!textEl) return;

  let rawText = textEl.rawText;
  const taskRegex = /^- \[([ xX])\] (.*)/s; // Regex to catch '- [ ] ' or '- [x] ' including newlines
  const match = rawText.match(taskRegex);

  let newText = "";
  if (match) {
    const status = match[1];
    const content = match[2];
    if (status === " ") {
      newText = `- [x] ${content}`; // Complete it
    } else {
      newText = `${content}`; // Remove task
    }
  } else {
    newText = `- [ ] ${rawText}`; // Not a task -> make it a task
  }

  ea.copyViewElementsToEAforEditing([textEl]);
  const eaEl = ea.getElement(textEl.id);
  eaEl.rawText = newText;
  eaEl.text = newText;
  eaEl.originalText = newText;
  ea.refreshTextElementSize(eaEl.id);

  await addElementsToView({ captureUpdate: autoLayoutDisabled ? "IMMEDIATELY" : "EVENTUALLY" });

  // Excalidraw dynamically updates the container size when text changes
  if (eaEl.containerId) {
     const updatedContainer = ea.getViewElements().find(el => el.id === eaEl.containerId);
     if(updatedContainer) api().updateContainerSize([updatedContainer]);
  }

  // Refresh Map layout in case the new checkbox padding alters the box width
  if (!autoLayoutDisabled) {
     const info = getHierarchy(sel, ea.getViewElements());
     await triggerGlobalLayout(info.rootId);
  }
};

/**
 * Toggles the selected node between an embed (![[...]]) and a link ([[...|alias]]).
 * Cleans the markdown '# ' characters when mapping the section name to the alias.
 */
const toggleEmbedStatus = async () => {
  if (!isViewSet()) return;
  const sel = getMindmapNodeFromSelection();
  if (!sel) return;

  const all = ea.getViewElements();
  const visualNode = sel.containerId ? all.find(el => el.id === sel.containerId) : sel;
  const nodeText = getTextFromNode(all, visualNode, true, true).trim();

  // Match: ! (optional) | [[ | NoteName#SectionName | | Alias (optional) | ]]
  const linkRegex = /^(!?)\[\[([^\]]+?#([^\]|]+))(?:\|[^\]]*)?\]\]$/;
  const match = nodeText.match(linkRegex);

  if (!match) return;

  const isEmbed = match[1] === "!";
  const linkCore = match[2]; 
  const sectionRef = match[3];

  let newText = "";
  if (isEmbed) {
    // Strip leading markdown heading characters (e.g. '### ') for the alias
    const alias = sectionRef.replace(/^#+\s*/, "").trim();
    newText = `[[${linkCore}|${alias}]]`;
  } else {
    newText = `![[${linkCore}]]`;
  }

  // Hack into the established edit flow
  editingNodeId = sel.id;
  inputEl.value = newText;
  
  // Preserve ontology 
  const incomingArrow = all.find(a => a.type === "arrow" && a.customData?.isBranch && a.endBinding?.elementId === sel.id);
  ontologyEl.value = incomingArrow ? (ea.getBoundTextElement(incomingArrow, true)?.sceneElement?.rawText || "") : "";

  // Delegate the heavy lifting of completely recreating elements & mappings to commitEdit()
  await commitEdit();
};

const padding = layoutSettings.CONTAINER_PADDING;
/**
 * Toggles a bounding box around the selected text element (node).
 * Creates a container if one doesn't exist, or removes it if it does.
 * @param {string} shape - "rectangle" | "ellipse" | "diamond"
 */
const toggleBox = async (shape = "rectangle") => {
  if (!isViewSet()) return;
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
      (ids.includes(el.startBinding?.elementId) || ids.includes(el.endBinding?.elementId)),
  );

  if (hasContainer) {
    const containerId = (oldBindId = sel.containerId);
    finalElId = newBindId = sel.id;
    const container = allElements.find((el) => el.id === containerId);
    ea.copyViewElementsToEAforEditing(arrowsToUpdate.concat(sel, container));
    const textEl = ea.getElement(sel.id);
    
    // Transfer all custom data from the container back to the text element
    const dataToCopy = { ...(container.customData || {}) };
    ea.addAppendUpdateCustomData(textEl.id, dataToCopy);
    
    textEl.containerId = null;
    textEl.boundElements =[]; //not null because I will add bound arrows a bit further down
    ea.getElement(containerId).isDeleted = true;
  } else {
    ea.copyViewElementsToEAforEditing(arrowsToUpdate.concat(sel));
    const depth = getHierarchy(sel, allElements)?.depth || 0;

    oldBindId = sel.id;
    
    let rectId;
    if (shape === "ellipse") {
      rectId = ea.addEllipse(sel.x - padding, sel.y - padding, sel.width + padding * 2, sel.height + padding * 2);
    } else if (shape === "diamond") {
      rectId = ea.addDiamond(sel.x - padding, sel.y - padding, sel.width + padding * 2, sel.height + padding * 2);
    } else {
      rectId = ea.addRect(sel.x - padding, sel.y - padding, sel.width + padding * 2, sel.height + padding * 2);
    }
    
    finalElId = newBindId = rectId;
    const rect = ea.getElement(rectId);
    
    // Transfer all custom data from the text element to the new container
    const dataToCopy = { ...(sel.customData || {}) };
    ea.addAppendUpdateCustomData(rectId, dataToCopy);
    
    rect.strokeColor = ea.getCM(sel.strokeColor).stringRGB();
    rect.strokeWidth = getStrokeWidthForDepth(depth);
    rect.roughness = getAppState().currentItemRoughness;
    rect.roundness = (roundedCorners) ? { type: 3 } : null;
    rect.backgroundColor = "transparent";

    const textEl = ea.getElement(sel.id);
    textEl.containerId = rectId;
    textEl.boundElements = null;
    rect.boundElements =[{ type: "text", id: sel.id }];
    rect.groupIds = sel.groupIds ? [...sel.groupIds] :[];
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

  ea.getElement(oldBindId).boundElements =[];
  delete ea.getElement(oldBindId).customData;

  await addElementsToView({ captureUpdate: autoLayoutDisabled ? "IMMEDIATELY" : "EVENTUALLY" });

  if (!hasContainer) {
    const textElement = ea.getViewElements().find((el) => el.id === sel.id);
    const idx = ea.getViewElements().indexOf(textElement);
    ea.moveViewElementToZIndex(textElement.containerId, idx);
  }

  if (!hasContainer) {
    api().updateContainerSize([ea.getViewElements().find((el) => el.id === newBindId)]);
  }
  selectNodeInView(finalElId);
  if(!autoLayoutDisabled) await refreshMapLayout();
  updateUI();
};

/**
 * Toggles a visual boundary polygon around the selected node's subtree.
 */
const toggleBoundary = async () => {
  if (!isViewSet()) return;
  const sel = getMindmapNodeFromSelection();
  if (sel) {
    const info = getHierarchy(sel, ea.getViewElements());
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

    await addElementsToView({ newElementsOnTop: false, captureUpdate: "EVENTUALLY" });

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

    await triggerGlobalLayout(info.rootId);
  }
  updateUI();
};

// ---------------------------------------------------------------------------
// 7. UI Modal & Sidepanel Logic
// ---------------------------------------------------------------------------

let detailsEl, inputEl, inputRow, bodyContainer, strategyDropdown;
let lastFocusedInput = null;
let isOntologyFocused = false;
let ignoreFocusChanges = false;
let autoLayoutToggle, linkSuggester, arrowTypeToggle;
let fontSizeDropdown, boxToggle, roundToggle, strokeToggle;
let branchScaleDropdown, baseWidthSlider;
let colorToggle, widthSlider, centerToggle;
let fillSweepToggleSetting, fillSweepToggle;
let pinBtn, refreshBtn, cutBtn, copyBtn, boxBtn, dockBtn, editBtn;
let toggleGroupBtn, zoomBtn, focusBtn, boundaryBtn;
let submapRootBtn;
let foldBtnL0, foldBtnL1, foldBtnAll;
let floatingGroupBtn, floatingBoxBtn, floatingZoomBtn;
let panelExpandBtn, importOutlineBtn, toggleCheckboxBtn, toggleEmbedBtn;
let isFloatingPanelExpanded = false;
let toggleFloatingExtras = null;
let inputContainer;
let helpContainer;
let floatingInputModal = null;
let sidepanelWindow;
let recordingScope = null;
let disableTabEvents = false;
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

const revealInputEl = () => {
  const undockPreference = getVal(K_UNDOCKED, false);
  if (undockPreference && !isUndocked) {
    toggleDock({saveSetting: false});
    return true;
  } else if (!undockPreference && !isUndocked && ea.sidepanelTab && !ea.sidepanelTab.isVisible()) {
    ea.sidepanelTab.reveal();
  }
  return false;
}

const focusInputEl = () => {
  revealInputEl();
  setTimeout(() => {
    if(isRecordingHotkey) return;
    const target = isOntologyFocused
      ? (ontologyEl.style.display === "none" ? inputEl : ontologyEl)
      : inputEl;
    if(!target || target.disabled) {
      return;
    }
    target.focus();
    if (!window.MindmapBuilder?.popObsidianHotkeyScope) registerObsidianHotkeyOverrides();
  }, 200);
}

const setButtonDisabled = (btn, disabled) => {
  if (!btn) return;
  btn.disabled = disabled;
  const btnEl = btn.extraSettingsEl ?? btn.buttonEl ?? btn.toggleEl;
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
  setButtonDisabled(submapRootBtn, true);
  setButtonDisabled(toggleCheckboxBtn, true);
  setButtonDisabled(toggleEmbedBtn, true);
  setButtonDisabled(floatingGroupBtn, true);
  setButtonDisabled(floatingBoxBtn, true);
  setButtonDisabled(floatingZoomBtn, true);
  setButtonDisabled(autoLayoutToggle, true);
  editingNodeId = null;
  if(editBtn) editBtn.extraSettingsEl.style.color = "";
};

const updateUI = (sel) => {
  if (!isViewSet()) {
    if(inputEl) inputEl.disabled = true;
    if(ontologyEl) ontologyEl.style.display = "none";
    disableUI();
    return;
  }
  if(inputEl) inputEl.disabled = false;
  const all = ea.getViewElements();
  sel = sel ?? getMindmapNodeFromSelection();
  if(ontologyEl) ontologyEl.style.display = sel ? "" : "none";

  if (sel) {
    disableTabEvents = true;

    const info = getHierarchy(sel, all);
    const isMasterRootSelected = info.rootId === sel.id;
    const root = getSettingsRootNode(sel, all) || all.find((e) => e.id === info.rootId);
    const isPinned = sel.customData?.isPinned === true;
    const isAdditionalRoot = sel.customData?.isAdditionalRoot === true;
    const isMasterRoot = !getParentNode(sel.id, all);
    const isEditing = editingNodeId && editingNodeId === sel.id;
    const branchIds = getBranchElementIds(sel.id, all);
    const children = getChildrenNodes(sel.id, all);
    const hasChildren = children.length > 0;
    const hasGrandChildren = hasChildren && children.some(child => getChildrenNodes(child.id, all).length > 0);
    const nodeText = getTextFromNode(all, sel, true, false);
    const isLinkedFile = !!getNodeMarkdownFile(nodeText);

    if (toggleCheckboxBtn) {
      const isTextNode = sel.type === "text" || (sel.boundElements && sel.boundElements.some(be => be.type === "text"));
      setButtonDisabled(toggleCheckboxBtn, !isTextNode);
    }

    if (toggleEmbedBtn) {
      const visualNode = sel.containerId ? all.find(el => el.id === sel.containerId) : sel;
      const nodeText = getTextFromNode(all, visualNode, true, true).trim();
      // Regex matches only exact format: [[NoteName#SectionName]] or ![[NoteName#SectionName]] with optional alias
      const linkRegex = /^!?\[\[([^\]]+?#[^\]|]+)(?:\|[^\]]*)?\]\]$/;
      setButtonDisabled(toggleEmbedBtn, !linkRegex.test(nodeText));
    }

    if (pinBtn) {
      pinBtn.setIcon(isPinned ? "pin" : "pin-off");
      pinBtn.setTooltip(
        `${isPinned ? t("PIN_TOOLTIP_PINNED") : t("PIN_TOOLTIP_UNPINNED")} ${getActionHotkeyString(ACTION_PIN)}`,
      );
      setButtonDisabled(pinBtn, false);
    }

    if (submapRootBtn) {
      submapRootBtn.setIcon(isAdditionalRoot ? "map-pin-minus-inside" : "map-pin-plus-inside");
      const submapTooltip = isAdditionalRoot ? t("TOOLTIP_SUBMAP_ROOT_REMOVE") : t("TOOLTIP_SUBMAP_ROOT_ADD");
      submapRootBtn.setTooltip(`${submapTooltip} ${getActionHotkeyString(ACTION_TOGGLE_SUBMAP_ROOT)}`);
      setButtonDisabled(submapRootBtn, isMasterRoot);
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
      const isGrouped = branchIds.length > 1 && !!getCommonGroupForElements(all.filter(el => branchIds.includes(el.id)))[0];
      btn.setIcon(isGrouped ? "ungroup" : "group");
      const groupTooltip = isGrouped ? t("TOGGLE_GROUP_TOOLTIP_UNGROUP") : t("TOGGLE_GROUP_TOOLTIP_GROUP");
      btn.setTooltip(`${groupTooltip} ${getActionHotkeyString(ACTION_TOGGLE_GROUP)}`);
      setButtonDisabled(btn, groupBranches || branchIds.length <= 1);
    }
    updateGroupBtn(toggleGroupBtn);
    updateGroupBtn(floatingGroupBtn);

    setButtonDisabled(boxBtn, false);
    setButtonDisabled(floatingBoxBtn, false);
    setButtonDisabled(foldBtnL0, !hasChildren);
    setButtonDisabled(foldBtnL1, !hasGrandChildren);
    setButtonDisabled(foldBtnAll, !hasGrandChildren);
    setButtonDisabled(zoomBtn, false);
    setButtonDisabled(focusBtn, false);
    setButtonDisabled(floatingZoomBtn, false);
    if (boundaryBtn) {
      boundaryBtn.setIcon(sel.customData?.boundaryId ? "cloud-off" : "cloud");
    }
    setButtonDisabled(boundaryBtn, isMasterRootSelected);
    setButtonDisabled(cutBtn, isMasterRootSelected);
    setButtonDisabled(copyBtn, false);
    setButtonDisabled(importOutlineBtn, !isLinkedFile);
    setButtonDisabled(autoLayoutToggle, false);

    // NEW: Load settings from root customData if they exist, otherwise keep current global
    const cd = root?.customData ?? {};
    
    const mapStrategy = cd?.growthMode;
    if (typeof mapStrategy === "string" && mapStrategy !== currentModalGrowthMode && GROWTH_TYPES.includes(mapStrategy)) {
      currentModalGrowthMode = mapStrategy;
      if (strategyDropdown) strategyDropdown.setValue(mapStrategy);
    }

    const mapLayoutPref = cd?.autoLayoutDisabled === true;
    if (mapLayoutPref !== autoLayoutDisabled) {
      autoLayoutDisabled = mapLayoutPref;
      if (autoLayoutToggle) autoLayoutToggle.setValue(!mapLayoutPref);
    }

    if (refreshBtn) {
      setButtonDisabled(refreshBtn, autoLayoutDisabled);
      refreshBtn.setTooltip(`${t("TOOLTIP_REFRESH")} ${getActionHotkeyString(ACTION_REARRANGE)}`);
    }

    const mapArrowType = cd?.arrowType ?? getVal(K_ARROW_TYPE, "curved");
    if (typeof mapArrowType === "string" && mapArrowType !== arrowType && ARROW_TYPES.includes(mapArrowType)) {
      arrowType = mapArrowType;
      if (arrowTypeToggle) arrowTypeToggle.setValue(arrowType === "curved");
    }

    const mapFontScale = cd?.fontsizeScale ?? getVal(K_FONTSIZE, "Normal Scale");
    if (mapFontScale !== fontsizeScale) {
        fontsizeScale = mapFontScale;
        if (fontSizeDropdown) fontSizeDropdown.setValue(fontsizeScale);
    }

    const mapMulticolor = typeof cd?.multicolor === "boolean" ? cd.multicolor : getVal(K_MULTICOLOR, true);
    if (mapMulticolor !== multicolor) {
        multicolor = mapMulticolor;
        if (colorToggle) colorToggle.setValue(multicolor);
    }

    const mapBoxChildren = typeof cd?.boxChildren === "boolean" ? cd.boxChildren : getVal(K_BOX, false);
    if (mapBoxChildren !== boxChildren) {
        boxChildren = mapBoxChildren;
        if (boxToggle) boxToggle.setValue(boxChildren);
    }

    const mapRounded = typeof cd?.roundedCorners === "boolean" ? cd.roundedCorners : getVal(K_ROUND, false);
    if (mapRounded !== roundedCorners) {
        roundedCorners = mapRounded;
        if (roundToggle) roundToggle.setValue(roundedCorners);
    }

    let defaultWidth = parseInt(getVal(K_WIDTH, 450));
    if (isNaN(defaultWidth)) defaultWidth = 450;

    const mapWidth = typeof cd?.maxWrapWidth === "number" ? cd.maxWrapWidth : defaultWidth;
    
    if (mapWidth !== maxWidth) {
        maxWidth = mapWidth;
        if (widthSlider) {
          widthSlider.setValue(maxWidth);
          if (widthSlider.valLabelEl) widthSlider.valLabelEl.setText(`${maxWidth}px`);
        }
    }

    const mapSolid = typeof cd?.isSolidArrow === "boolean" ? cd.isSolidArrow : getVal(K_ARROWSTROKE, true);
    if (mapSolid !== isSolidArrow) {
        isSolidArrow = mapSolid;
        if (strokeToggle) strokeToggle.setValue(!isSolidArrow);
    }

    const mapBranchScale = (cd?.branchScale && BRANCH_SCALE_TYPES.includes(cd.branchScale)) ? cd.branchScale : getVal(K_BRANCH_SCALE, "Hierarchical");
    if (mapBranchScale !== branchScale) {
      branchScale = mapBranchScale;
      if (branchScaleDropdown) branchScaleDropdown.setValue(branchScale);
    }

    let defaultBaseStroke = parseFloat(getVal(K_BASE_WIDTH, 6));
    if (isNaN(defaultBaseStroke)) defaultBaseStroke = 6;
    
    const mapBaseStroke = typeof cd?.baseStrokeWidth === "number" ? cd.baseStrokeWidth : defaultBaseStroke;

    if (mapBaseStroke !== baseStrokeWidth) {
      baseStrokeWidth = mapBaseStroke;
      if (baseWidthSlider) {
        baseWidthSlider.setValue(baseStrokeWidth);
        if (baseWidthSlider.valLabelEl) baseWidthSlider.valLabelEl.setText(`${baseStrokeWidth}`);
      }
    }

    const mapCenter = typeof cd?.centerText === "boolean" ? cd.centerText : getVal(K_CENTERTEXT, true);
    if (mapCenter !== centerText) {
        centerText = mapCenter;
        if (centerToggle) centerToggle.setValue(centerText);
    }

    const mapFillSweep = typeof cd?.fillSweep === "boolean" ? cd.fillSweep : getVal(K_FILL_SWEEP, false);
    if (mapFillSweep !== fillSweep) {
      fillSweep = mapFillSweep;
      if (fillSweepToggle) fillSweepToggle.setValue(fillSweep);
    }

    const mapLayoutSettings = cd?.layoutSettings;
    if (mapLayoutSettings && typeof mapLayoutSettings === "object") {
      layoutSettings = { ...layoutSettings, ...mapLayoutSettings };
    } else {
      const globalDefaults = getVal(K_LAYOUT, {});
      Object.keys(LAYOUT_METADATA).forEach(k => {
          layoutSettings[k] = globalDefaults[k] !== undefined ? globalDefaults[k] : LAYOUT_METADATA[k].def;
      });
    }

    if (fillSweepToggleSetting && fillSweepToggleSetting.settingEl) {
      const mode = cd?.growthMode || currentModalGrowthMode;
      fillSweepToggleSetting.settingEl.style.display = mode === "Radial" ? "" : "none";
    }
    disableTabEvents = false;
  } else {
    disableUI();
    // Re-enable navigation buttons if we have a history node
    if (mostRecentlySelectedNodeID) {
      setButtonDisabled(zoomBtn, false);
      setButtonDisabled(focusBtn, false);
      setButtonDisabled(floatingZoomBtn, false);
    }
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
  const didToggle = revealInputEl();

  setTimeout(() => {
    inputEl.value = text;
    
    // Populate Ontology (Arrow Label)
    // Find incoming arrow
    const incomingArrow = all.find(
      (a) => a.type === "arrow" && 
      a.customData?.isBranch && 
      a.endBinding?.elementId === sel.id
    );
    
    ontologyEl.value  = ea.getBoundTextElement(incomingArrow, true)?.sceneElement?.rawText || "";

    editingNodeId = sel.id;
    updateUI();
    inputEl.focus();
  }, didToggle ? 200 : 0);
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
  
  // Get values from BOTH inputs
  const textInput = inputEl.value;
  const ontologyInput = ontologyEl.value;
  
  // Retrieve current text representation (raw, short path for images) to compare against input
  const currentText = getTextFromNode(all, visualNode, true, true);
  
  // Find arrow pointing TO this node to check current ontology
  // We need this for diffing, and potentially for updating later
  const incomingArrow = all.find(
    (a) => a.type === "arrow" && 
    a.customData?.isBranch && 
    a.endBinding?.elementId === targetNode.id // Target node might be container
  );
  
  const currentOntology = incomingArrow 
    ? (ea.getBoundTextElement(incomingArrow, true)?.sceneElement?.rawText || "")
    : "";

  const textChanged = textInput !== currentText;
  const ontologyChanged = ontologyInput !== currentOntology;

  // If nothing changed, exit early without modifying scene
  if (!textChanged && !ontologyChanged) {
    editingNodeId = null;
    inputEl.value = "";
    ontologyEl.value = "";
    updateUI();
    return;
  }

  const imageInfo = parseImageInput(textInput);
  const embeddableUrl = parseEmbeddableInput(textInput, imageInfo);

  let newType = "text";
  if (imageInfo?.isImagePath || imageInfo?.imageFile) newType = "image";
  else if (embeddableUrl) newType = "embeddable";

  // Check for type conversion (e.g. Text -> Image) or non-text update
  const isTypeChange = (textEl && newType !== "text") || (!textEl && newType !== targetNode.type);
  
  // Only consider it a non-text update (which requires recreation) if the text/path actually changed.
  // If only ontology changed on an image node, we treat it as a standard update (else block).
  const isNonTextUpdate = !textEl && newType === targetNode.type && textChanged;
  let containerToUpdate = null;
  if (isTypeChange || isNonTextUpdate) {
    // ---------------------------------------------------------
    // Path A: Recreate Element (Type change or Image path change)
    // ---------------------------------------------------------
    
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
        // Check for external image flag and append to link to preserve routing
        if (imageInfo.isExternalImage && newNodeId) {
          const el = ea.getElement(newNodeId);
          if (el && !el.link) el.link = imageInfo.path;
        }
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
      ea.style.strokeWidth = getStrokeWidthForDepth(depth);
      if (incomingArrow) {
        ea.style.strokeColor = incomingArrow.strokeColor;
      }
      ea.style.roughness = getAppState().currentItemRoughness;

      const renderedText = await parseText(textInput);
      const metrics = ea.measureText(renderedText);
      const shouldWrap = metrics.width > maxWidth;
      
      let finalWidth = Math.ceil(metrics.width);
      let finalHeight = metrics.height;
      let finalWrappedText = renderedText;
      
      if (shouldWrap) {
        const res = await getAdjustedMaxWidth(textInput, maxWidth);
        finalWidth = res.width;
        finalHeight = res.height;
        finalWrappedText = res.wrappedText;
      }

      newNodeId = ea.addText(cx, cy, renderedText, {
          textAlign: "center",
          textVerticalAlign: "middle",
          box: boxChildren ? "rectangle" : false,
          width: shouldWrap ? finalWidth : undefined,
          height: shouldWrap ? finalHeight : undefined,
          autoResize: boxChildren ? false : !shouldWrap
      });

      const newElement = ea.getElement(newNodeId);
      containerToUpdate = boxChildren ? newElement : null;

      // Explicitly overwrite raw, original and text properties to handle links correctly
      newTextElement = boxChildren ? ea.getElement(containerToUpdate.boundElements[0].id) : newElement;
      newTextElement.rawText = textInput;
      newTextElement.originalText = renderedText;
      newTextElement.text = finalWrappedText;
      if (!shouldWrap) {
        newTextElement.width = finalWidth;
        newTextElement.height = finalHeight;
      }
    }

    const newNode = ea.getElement(newNodeId);

    // Scale decorations before deleting the old visual node
    scaleDecorations(visualNode, newNode, all, info.rootId);

    // 3. Migrate custom data fields
    const keysToCopy =[
      "mindmapOrder", "isPinned", "growthMode", "autoLayoutDisabled", 
      "isFolded", "foldIndicatorId", "foldState", "boundaryId",
      "fontsizeScale", "multicolor", "boxChildren", "roundedCorners", 
      "maxWrapWidth", "isSolidArrow", "centerText", "arrowType",
      "fillSweep", "branchScale", "baseStrokeWidth", "layoutSettings"
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
      newNode.groupIds =[...visualNode.groupIds];
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
      const newBoundElements =[];
      
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
            eaArrow.points[0] = [eaArrow.points[0][0] + (newAbsX - absX), eaArrow.points[0][1] + (newAbsY - absY)];
          }
        }
        
        if (idsToReplace.includes(eaArrow.endBinding?.elementId)) {
          eaArrow.endBinding = { ...eaArrow.endBinding, elementId: newNodeId };
          isConnected = true;
          
          // --- Update Ontology for incoming arrow ---
          // Since we are rewiring, this is the arrow pointing TO the new node
          addUpdateArrowLabel(eaArrow, ontologyInput);

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
      captureUpdate: autoLayoutDisabled ? "IMMEDIATELY" : "EVENTUALLY"
    });
    
    // Trigger global layout if enabled
    if (!autoLayoutDisabled) {
      const newViewElements = ea.getViewElements();
      const newViewNode = newViewElements.find(el => el.id === newNodeId);
      if(newViewNode) {
        selectNodeInView(newViewNode);
        const newInfo = getHierarchy(newViewNode, newViewElements);
        await triggerGlobalLayout(newInfo.rootId, false, true);
      }
    }

  } else {
    // ---------------------------------------------------------
    // Path B: Modify Existing Element
    // ---------------------------------------------------------

    // 1. Update Ontology (Incoming Arrow)
    // Only perform if ontology has changed and arrow exists
    if (ontologyChanged && incomingArrow) {
      ea.copyViewElementsToEAforEditing([incomingArrow]);
      addUpdateArrowLabel(ea.getElement(incomingArrow.id), ontologyInput);
    }
    
    // 2. Update Text Element Properties
    // Only perform if text has changed and it is a Text element (images/embeddables handled in Path A if content changes)
    if (textChanged && textEl) {
      ea.copyViewElementsToEAforEditing([textEl]);
      const eaEl = ea.getElement(textEl.id);
      
      const renderedText = await parseText(textInput);
      
      eaEl.rawText = textInput;
      eaEl.originalText = renderedText;
      
      // Refresh family/size in case global settings changed, though this is optional
      ea.style.fontFamily = eaEl.fontFamily;
      ea.style.fontSize = eaEl.fontSize;

      const metrics = ea.measureText(renderedText);
      const shouldWrap = metrics.width > maxWidth;
      
      if (!shouldWrap) {
        eaEl.autoResize = true;
        eaEl.width = Math.ceil(metrics.width);
        eaEl.height = metrics.height;
        eaEl.text = renderedText;
      } else {
        eaEl.autoResize = false;
        const res = await getAdjustedMaxWidth(textInput, maxWidth);
        eaEl.width = res.width;
        eaEl.height = res.height;
        eaEl.text = res.wrappedText;
      }

      ea.refreshTextElementSize(eaEl.id);
    }

    // 3. Save Changes
    const hierarchyNode = targetNode.containerId ? all.find(el => el.id === targetNode.containerId) : textEl;
    
    await addElementsToView({
      captureUpdate: !hierarchyNode || autoLayoutDisabled ? "IMMEDIATELY" : "EVENTUALLY"
    }); //in case text was changed to image

    // 4. Update Container Size (if text changed and container exists)
    if (textChanged && textEl && textEl.containerId) {
      const container = ea.getViewElements().find(el => el.id === textEl.containerId);
      if (container) {
        api().updateContainerSize([container]);
      }
    }

    if (containerToUpdate) {
      api().updateContainerSize([containerToUpdate]);
    }

    // 5. Trigger Layout (only if text changed, as that affects dimensions)
    if (textChanged && hierarchyNode && !autoLayoutDisabled) {
      const info = getHierarchy(hierarchyNode, ea.getViewElements());
      await triggerGlobalLayout(info.rootId);
    }
  }

  editingNodeId = null;
  inputEl.value = "";
  ontologyEl.value = "";
};

const renderHelp = (container) => {
  helpContainer = container.createDiv();
  detailsEl = helpContainer.createEl("details");
  const summary = detailsEl.createEl("summary", { 
    attr: { style: "cursor: pointer;" }
  });
  
  // Title
  summary.createSpan({ 
    text: t("HELP_SUMMARY"), 
    attr: { style: "font-weight: bold;" } 
  });
  
  // Version Number
  summary.createSpan({ 
    text: VERSION, 
    attr: { style: "float: right; color: var(--text-muted); font-size: 0.8em;" } 
  });
  
  ea.obsidian.MarkdownRenderer.render(app, getInstructions(), detailsEl.createDiv(), "", ea.plugin);
};

// ---------------------------------------------------------------------------
// 8. Custom Colors: Palette Manager Modal
// ---------------------------------------------------------------------------
class PaletteManagerModal extends ea.FloatingModal {
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
class LayoutConfigModal extends ea.FloatingModal {
  constructor(app, currentSettings, onUpdate) {
    super(app);
    this.settings = this.normalizeSettings(currentSettings);
    this.onUpdate = onUpdate;
    this.updateTimer = null;
    this.focusRefreshHandler = (evt) => this.handleFocusRefresh(evt);
    this.focusDoc = null;
  }

  normalizeSettings(settingsLike) {
    const normalized = {};
    Object.keys(LAYOUT_METADATA).forEach((key) => {
      const meta = LAYOUT_METADATA[key];
      const candidate = settingsLike?.[key];
      normalized[key] = typeof candidate === "number" && Number.isFinite(candidate) ? candidate : meta.def;
    });
    return normalized;
  }

  onOpen() {
    this.display({ preserveSectionState: false });
    this.focusDoc = this.contentEl?.ownerDocument ?? document;
    this.focusDoc.addEventListener("focusin", this.focusRefreshHandler, true);
  }

  onClose() {
    if (this.focusDoc) {
      this.focusDoc.removeEventListener("focusin", this.focusRefreshHandler, true);
      this.focusDoc = null;
    }
    if (this.updateTimer) clearTimeout(this.updateTimer);
    this.settings = this.normalizeSettings(this.settings);
    this.onUpdate(this.settings);
  }

  handleFocusRefresh(evt) {
    if (!isViewSet()) {
      this.close();
      return;
    }
    if (!this.contentEl || !(this.contentEl.contains(evt.target) || this.modalEl.contains(evt.target))) return;

    const sel = getMindmapNodeFromSelection();
    if (!sel) return;

    const allElements = ea.getViewElements();
    const settingsRoot = getSettingsRootNode(sel, allElements) ?? sel;
    const rootCfg = getRootConfigForNode(settingsRoot);
    const nextSettings = this.normalizeSettings(rootCfg?.layoutSettings);
    if (!nextSettings) return;

    const currentSig = JSON.stringify(this.settings);
    const nextSig = JSON.stringify(nextSettings);
    if (currentSig === nextSig) return;

    this.settings = nextSettings;
    this.display({ preserveSectionState: true });
  }

  triggerUpdate() {
    if (this.updateTimer) clearTimeout(this.updateTimer);
    this.updateTimer = setTimeout(() => {
      this.settings = this.normalizeSettings(this.settings);
      this.onUpdate(this.settings);
      this.updateTimer = null;
    }, 500);
  }

  display({ preserveSectionState = true } = {}) {
    const { contentEl } = this;

    let lastScrollPosition = 0;
    const previousSectionState = {};
    const existingContainer = contentEl.querySelector(".layout-settings-container");
    if (existingContainer) {
      lastScrollPosition = existingContainer.scrollTop;
      if (preserveSectionState) {
        existingContainer.querySelectorAll("details[data-layout-section]").forEach((detailsEl) => {
          const sectionKey = detailsEl.getAttribute("data-layout-section");
          if (sectionKey) previousSectionState[sectionKey] = detailsEl.open;
        });
      }
    }

    contentEl.empty();
    contentEl.createEl("h2", { text: t("MODAL_LAYOUT_TITLE") });

    const container = contentEl.createDiv();
    container.addClass("layout-settings-container");
    container.style.maxHeight = "70vh";
    container.style.overflowY = "auto";
    container.style.paddingRight = "10px";

    const groupedKeys = {};
    Object.keys(LAYOUT_METADATA).forEach(key => {
      const section = LAYOUT_METADATA[key].section;
      if (!groupedKeys[section]) groupedKeys[section] = [];
      groupedKeys[section].push(key);
    });

    const renderSection = (sectionKey, title) => {
      if (!groupedKeys[sectionKey]) return;

      const details = container.createEl("details", { attr: { "data-layout-section": sectionKey } });
      details.open = preserveSectionState ? (previousSectionState[sectionKey] ?? false) : false;
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
        let resetButtonComp;

        const updateResetButton = (val) => {
          if (!resetButtonComp) return;
          const isModified = Math.abs(val - meta.def) > 0.0001;
          const el = resetButtonComp.extraSettingsEl;
          
          el.style.opacity = isModified ? "1" : "0";
          el.style.pointerEvents = isModified ? "auto" : "none";
          el.style.cursor = isModified ? "pointer" : "default";
          if (isModified) el.setAttribute("tabindex", "0");
          else el.setAttribute("tabindex", "-1");
        };

        setting.addSlider(slider => slider
          .setLimits(meta.min, meta.max, meta.step)
          .setValue(this.settings[key] ?? meta.def)
          .onChange(value => {
            this.settings[key] = value;
            valLabel.setText(String(value.toFixed(meta.step < 1 ? 1 : 0)));
            updateResetButton(value);
            this.triggerUpdate();
          })
        );

        setting.settingEl.createDiv("", el => {
          valLabel = el;
          el.style.minWidth = "3em";
          el.style.textAlign = "right";
          el.innerText = String(this.settings[key].toFixed(meta.step < 1 ? 1 : 0));
        });

        setting.addExtraButton(btn => {
          resetButtonComp = btn;
          btn
            .setIcon("rotate-ccw")
            .setTooltip(t("TOOLTIP_RESET_TO_DEFAULT"))
            .onClick(() => {
              this.settings[key] = meta.def;
              this.triggerUpdate();
              this.display();
            });
          updateResetButton(this.settings[key]);
        });
      });
    };

    // Render Sections in Order
    renderSection("SECTION_GENERAL", t("SECTION_GENERAL"));
    renderSection("SECTION_RADIAL", t("SECTION_RADIAL"));
    renderSection("SECTION_DIRECTIONAL", t("SECTION_DIRECTIONAL"));
    renderSection("SECTION_VERTICAL", t("SECTION_VERTICAL"));
    renderSection("SECTION_VISUALS", t("SECTION_VISUALS"));
    renderSection("SECTION_MANUAL", t("SECTION_MANUAL"));

    const footer = contentEl.createDiv();
    footer.style.marginTop = "20px";
    footer.style.display = "flex";
    footer.style.justifyContent = "space-between";

    new ea.obsidian.Setting(footer)
      .addButton(btn => btn
        .setButtonText(t("LAYOUT_RESET"))
        .setWarning()
        .onClick(() => {
          Object.keys(LAYOUT_METADATA).forEach(k => {
            this.settings[k] = LAYOUT_METADATA[k].def;
          });
          this.triggerUpdate();
          this.display();
        })
      )
      .addButton(btn => btn
        .setButtonText(t("LAYOUT_SAVE"))
        .setCta()
        .onClick(() => {
          if (this.updateTimer) clearTimeout(this.updateTimer);
          this.onUpdate(this.settings);
          this.close();
        })
      );
    container.scrollTop = lastScrollPosition;
  }
}

// ---------------------------------------------------------------------------
// 10. Render Functions
// ---------------------------------------------------------------------------
const renderInput = (container, isFloating = false) => {
  ignoreFocusChanges = true;
  setTimeout(() => { 
    ignoreFocusChanges = false;
    lastFocusedInput.focus();
  }, 200);
  container.empty();

  pinBtn = submapRootBtn = refreshBtn = dockBtn = inputEl = ontologyEl = null;
  foldBtnL0 = foldBtnL1 = foldBtnAll = null;
  boundaryBtn = panelExpandBtn = null;
  floatingGroupBtn = floatingBoxBtn = floatingZoomBtn = null;
  importOutlineBtn = toggleCheckboxBtn = null;

  inputRow = new ea.obsidian.Setting(container);
  let secondaryButtonContainer = null;

  if (!isFloating) {
    inputRow.settingEl.style.display = "block";
    inputRow.controlEl.style.display = "block";
    inputRow.controlEl.style.width = "100%";
    inputRow.controlEl.style.marginTop = "8px";
  } else {
    container.style.width = "85vw";
    container.style.maxWidth = "calc((var(--icon-size) + 2 * var(--size-2-3)) * 17)";
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

  // Clear default control element to build custom two-input layout
  inputRow.controlEl.empty();
  
  const wrapper = inputRow.controlEl.createDiv("mindmap-input-wrapper");
  
  // --- Ontology Input ---
  ontologyEl = wrapper.createEl("input", {
    type: "text",
    cls: "mindmap-input-ontology",
    placeholder: t("ONTOLOGY_PLACEHOLDER")
  });
  
  // --- Main Input ---
  inputEl = wrapper.createEl("input", {
    type: "text",
    cls: "mindmap-input-main",
    placeholder: t("INPUT_PLACEHOLDER")
  });

  const updateFocusState = (focusedElement) => {
    if (ignoreFocusChanges) return;
    isOntologyFocused = (focusedElement === ontologyEl);
    lastFocusedInput = focusedElement;
    if (isOntologyFocused) {
      ontologyEl.addClass("is-focused");
      inputEl.addClass("is-shrunk");
    } else {
      ontologyEl.removeClass("is-focused");
      inputEl.removeClass("is-shrunk");
    }
  };

  const onFocus = (el) => {
    if (ignoreFocusChanges) return;
    updateFocusState(el);
    registerObsidianHotkeyOverrides();
    ensureNodeSelected();
    updateUI();
  }

  // --- Restore State to New DOM Elements ---
  // Apply the tracked focus state to the newly created elements immediately.
  // This ensures that when focusInputEl() runs (via setTimeout in toggleDock),
  // lastFocusedInput points to a valid, live DOM element.
  if (isOntologyFocused) {
    ontologyEl.addClass("is-focused");
    inputEl.addClass("is-shrunk");
    lastFocusedInput = ontologyEl;
  } else {
    ontologyEl.removeClass("is-focused");
    inputEl.removeClass("is-shrunk");
    lastFocusedInput = inputEl;
  }

  ontologyEl.addEventListener("focus", () => onFocus(ontologyEl));
  inputEl.addEventListener("focus", () => onFocus(inputEl));

  const onBlur = () => {
    if (ignoreFocusChanges) return;
    window.MindmapBuilder?.popObsidianHotkeyScope?.();
    saveSettings();
  };

  ontologyEl.addEventListener("blur", onBlur);
  inputEl.addEventListener("blur", onBlur);

  // Initialize Link Suggester on Main Input
  linkSuggester = ea.attachInlineLinkSuggester(inputEl, inputRow.settingEl);

  // Accessibility / ARIA labels
  const ariaHelp = [
    `${getActionLabel(ACTION_ADD)} (Enter)`,
    `${getActionLabel(ACTION_ADD_FOLLOW)} ${getActionHotkeyString(ACTION_ADD_FOLLOW)}`,
    `${getActionLabel(ACTION_ADD_FOLLOW_FOCUS)} ${getActionHotkeyString(ACTION_ADD_FOLLOW_FOCUS)}`,
    `${getActionLabel(ACTION_ADD_FOLLOW_ZOOM)} ${getActionHotkeyString(ACTION_ADD_FOLLOW_ZOOM)}`,
  ].join("\n");
  
  inputEl.ariaLabel = ariaHelp;


  let dockedButtonContainer;
  if (!isFloating) {
    dockedButtonContainer = inputRow.controlEl.createDiv();
    dockedButtonContainer.style.display = "flex";
    dockedButtonContainer.style.justifyContent = "flex-end";
    dockedButtonContainer.style.flexWrap = "wrap";
    dockedButtonContainer.style.gap = "2px";
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

  addButton((btn) => {
    toggleCheckboxBtn = btn;
    btn.setIcon("square-check-big");
    btn.setTooltip(`${t("TOOLTIP_TOGGLE_CHECKBOX")} ${getActionHotkeyString(ACTION_TOGGLE_CHECKBOX)}`);
    btn.extraSettingsEl.setAttr("action", ACTION_TOGGLE_CHECKBOX);
    btn.onClick(() => performAction(ACTION_TOGGLE_CHECKBOX));
  }, true);

  addButton((btn) => {
    toggleEmbedBtn = btn;
    btn.setIcon("file-sliders");
    btn.setTooltip(`${t("TOOLTIP_TOGGLE_EMBED")} ${getActionHotkeyString(ACTION_TOGGLE_EMBED)}`);
    btn.extraSettingsEl.setAttr("action", ACTION_TOGGLE_EMBED);
    btn.onClick(() => performAction(ACTION_TOGGLE_EMBED));
  }, true); 

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
    submapRootBtn = btn;
    btn.setIcon("map-pin-plus-inside");
    btn.extraSettingsEl.setAttr("action", ACTION_TOGGLE_SUBMAP_ROOT);
    btn.onClick(() => performAction(ACTION_TOGGLE_SUBMAP_ROOT));
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
    btn.setTooltip(`${t("TOOLTIP_FOLD_ALL")} ${getActionHotkeyString(ACTION_FOLD_ALL)}`);
    btn.extraSettingsEl.setAttr("action", ACTION_FOLD_ALL);
    btn.onClick(() => performAction(ACTION_FOLD_ALL));
  }, true);

  addButton((btn) => {
    refreshBtn = btn;
    btn.setIcon("refresh-ccw");
    btn.setTooltip(`${t("TOOLTIP_REFRESH")} ${getActionHotkeyString(ACTION_REARRANGE)}`);
    btn.extraSettingsEl.setAttr("action",ACTION_REARRANGE);
    btn.onClick(() => performAction(ACTION_REARRANGE));
  }, true);

  addButton((btn) => {
    copyBtn = btn;
    btn.setIcon("copy");
    btn.setTooltip(`${t("ACTION_LABEL_COPY")} ${getActionHotkeyString(ACTION_COPY)}`);
    btn.extraSettingsEl.setAttr("action", ACTION_COPY);
    btn.onClick(() => performAction(ACTION_COPY));
  }, true);

  addButton((btn) => {
    cutBtn = btn;
    btn.setIcon("scissors");
    btn.setTooltip(`${t("ACTION_LABEL_CUT")} ${getActionHotkeyString(ACTION_CUT)}`);
    btn.extraSettingsEl.setAttr("action", ACTION_CUT);
    btn.onClick(() => performAction(ACTION_CUT));
  }, true);

  addButton((btn) => {
    btn.setIcon("clipboard");
    btn.setTooltip(`${t("ACTION_LABEL_PASTE")} ${getActionHotkeyString(ACTION_PASTE)}`);
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

  bodyContainer.createEl("hr");

  const zoomSetting = new ea.obsidian.Setting(bodyContainer);
  zoomSetting.setName(t("LABEL_ZOOM_LEVEL")).addDropdown((d) => {
    ZOOM_TYPES.forEach((key) => d.addOption(key, key));
    d.setValue(zoomLevel);
    d.onChange((v) => {
        zoomLevel = v;
        if (disableTabEvents) return;

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
      if (disableTabEvents) return;

      setVal(K_GROWTH, v);
      dirty = true;
      if (fillSweepToggleSetting) {
        fillSweepToggleSetting.settingEl.style.display = v === "Radial" ? "" : "none";
      }
      if (!isViewSet()) return;
      const sel = getMindmapNodeFromSelection();
      if (!sel) return;
      await updateRootNodeCustomData({ growthMode: v }, sel);
      await refreshMapLayout(sel);
    });
  });

  fillSweepToggleSetting = new ea.obsidian.Setting(bodyContainer)
    .setName(t("LABEL_FILL_SWEEP"))
    .setDesc(t("DESC_FILL_SWEEP"))
    .addToggle((t) => {
      fillSweepToggle = t;
      t.setValue(fillSweep)
       .onChange(async (v) => {
        fillSweep = v;
        if (disableTabEvents) return;

        setVal(K_FILL_SWEEP, v);
        dirty = true;
        if (!isViewSet()) return;
        const sel = getMindmapNodeFromSelection();
        if (!sel) return;
        await updateRootNodeCustomData({ fillSweep: v }, sel);
        await refreshMapLayout(sel);
      })
    });
  if (currentModalGrowthMode !== "Radial") {
    fillSweepToggleSetting.settingEl.style.display = "none";
  }

  new ea.obsidian.Setting(bodyContainer)
    .setName(t("LABEL_AUTO_LAYOUT"))
    .addToggle((t) => {
      autoLayoutToggle = t;
      t.setValue(!autoLayoutDisabled)
      .onChange(async (v) => {
        const sel = getMindmapNodeFromSelection();
        if (!sel) return;
        autoLayoutDisabled = !v;
        if (disableTabEvents) return;
        await updateRootNodeCustomData({ autoLayoutDisabled }, sel);
        await refreshMapLayout(sel);
      });
    })
    .addExtraButton(btn=> btn
      .setIcon("pencil-ruler")
      .setTooltip(t("TOOLTIP_CONFIGURE_LAYOUT"))
      .onClick(() => {
        const modal = new LayoutConfigModal(app, layoutSettings, async (newSettings) => {
          layoutSettings = newSettings;
          setVal(K_LAYOUT, layoutSettings, true);
          dirty = true;
          const sel = getMindmapNodeFromSelection();
          if (!sel) return;
          await updateRootNodeCustomData({ layoutSettings: newSettings }, sel);
          const allElements = ea.getViewElements();
          const hierarchy = getHierarchy(sel, allElements);
          const masterRoot = allElements.find((el) => el.id === hierarchy.rootId) ?? sel;
          await refreshMapLayout(masterRoot);
        });
        modal.open();
      })
    )

  new ea.obsidian.Setting(bodyContainer)
    .setName(t("LABEL_GROUP_BRANCHES"))
    .addToggle((t) => t
    .setValue(groupBranches)
    .onChange(async (v) => {
      if (!isViewSet()) return;
      groupBranches = v;
      if (disableTabEvents) return;
      setVal(K_GROUP, v);
      dirty = true;
      await refreshMapLayout();
      updateUI();
    }))
    .addExtraButton((btn)=>{
      toggleGroupBtn = btn;
      btn.setIcon("group");
      btn.setTooltip(`${t("TOOLTIP_TOGGLE_GROUP_BTN")} ${getActionHotkeyString(ACTION_TOGGLE_GROUP)}`);
      btn.onClick(() => performAction(ACTION_TOGGLE_GROUP));
    });

  bodyContainer.createEl("hr");

  new ea.obsidian.Setting(bodyContainer)
    .setName(t("LABEL_BOX_CHILD_NODES"))
    .addToggle((t) => {
      boxToggle = t;
      t.setValue(boxChildren)
      .onChange(async (v) => {
        boxChildren = v;
        if (disableTabEvents) return;
        setVal(K_BOX, v);
        dirty = true;
        await updateRootNodeCustomData({ boxChildren: v });
      })
    })
    .addExtraButton((btn) => {
      boxBtn = btn;
      btn.setIcon("rectangle-horizontal");
      btn.setTooltip(`${t("TOOLTIP_TOGGLE_BOX")} ${getActionHotkeyString(ACTION_BOX)}`);
      btn.onClick(() => performAction(ACTION_BOX));
    });

  new ea.obsidian.Setting(bodyContainer).setName(t("LABEL_ROUNDED_CORNERS")).addToggle((t) => {
    roundToggle = t;
    t.setValue(roundedCorners)
    .onChange(async (v) => {
      roundedCorners = v;
      if (disableTabEvents) return;
      setVal(K_ROUND,  v);
      dirty = true;
      await updateRootNodeCustomData({ roundedCorners: v });
    })
  });

  bodyContainer.createEl("hr");

  new ea.obsidian.Setting(bodyContainer)
    .setName(t("LABEL_ARROW_TYPE"))
    .addToggle((t) => {
      arrowTypeToggle = t;
      t.setValue(arrowType === "curved")
       .onChange(async (v) => {
        arrowType = v ? "curved" : "straight";
        if (disableTabEvents) return;

        setVal(K_ARROW_TYPE, arrowType);
        dirty = true;
        if (!isViewSet()) return;
        const sel = getMindmapNodeFromSelection();
        if (!sel) return;
        await updateRootNodeCustomData({ arrowType }, sel);
        await refreshMapLayout(sel);
      })
    })

  new ea.obsidian.Setting(bodyContainer)
    .setName(t("LABEL_USE_SCENE_STROKE"))
    .setDesc(
      t("DESC_USE_SCENE_STROKE"),
    )
    .addToggle((t) => {
      strokeToggle = t;
      t.setValue(!isSolidArrow).onChange(async (v) => {
        isSolidArrow = !v;
        if (disableTabEvents) return;

        setVal(K_ARROWSTROKE,  !v);
        dirty = true;
        await updateRootNodeCustomData({ isSolidArrow: !v });
      })
    });

  new ea.obsidian.Setting(bodyContainer)
    .setName(t("LABEL_BRANCH_SCALE"))
    .addDropdown((d) => {
      branchScaleDropdown = d;
      BRANCH_SCALE_TYPES.forEach((key) => d.addOption(key, key));
      d.setValue(branchScale);
      d.onChange(async (v) => {
        const oldScale = branchScale;
        branchScale = v;
        if (disableTabEvents) return;

        setVal(K_BRANCH_SCALE, v);
        dirty = true;
        const info = await updateRootNodeCustomData({ branchScale: v });
        if(info) {
          await updateBranchStrokes(info.rootId, baseStrokeWidth, oldScale, baseStrokeWidth, branchScale);
        }
      });
    });

  let baseWidthDisplay;
  let baseWidthUpdateTimer = null;
  let baseWidthSnapshot = null;

  const baseWidthSetting = new ea.obsidian.Setting(bodyContainer)
    .setName(t("LABEL_BASE_WIDTH"))
    .addSlider((s) => {
      baseWidthSlider = s;
      s.setLimits(0.2, 16, 0.1)
       .setValue(baseStrokeWidth)
       .onChange((v) => {
         if (baseWidthUpdateTimer) clearTimeout(baseWidthUpdateTimer);
         if (!disableTabEvents &&baseWidthSnapshot === null) baseWidthSnapshot = baseStrokeWidth;
         baseStrokeWidth = v;
         baseWidthDisplay.setText(`${v}`);
        if (disableTabEvents) return;

         setVal(K_BASE_WIDTH, v);
         dirty = true;
         baseWidthUpdateTimer = setTimeout(async () => {
           const info = await updateRootNodeCustomData({ baseStrokeWidth: v });
           if(info) {
             await updateBranchStrokes(info.rootId, baseWidthSnapshot, branchScale, baseStrokeWidth, branchScale);
           }
           baseWidthSnapshot = null;
           baseWidthUpdateTimer = null;
         }, 500);
       });
    });
  baseWidthDisplay = baseWidthSetting.descEl.createSpan({
    text: `${baseStrokeWidth}`,
    attr: { style: "margin-left:10px; font-weight:bold;" },
  });
  if (baseWidthSlider) baseWidthSlider.valLabelEl = baseWidthDisplay;

  new ea.obsidian.Setting(bodyContainer)
    .setName(t("LABEL_MULTICOLOR_BRANCHES"))
    .addToggle((t) => {
      colorToggle = t;
      t.setValue(multicolor)
        .onChange(async (v) => {
          multicolor = v;
          if (disableTabEvents) return;

          setVal(K_MULTICOLOR, v);
          dirty = true;
          await updateRootNodeCustomData({ multicolor: v });
        })
    })
    .addExtraButton((btn) => btn
      .setIcon("palette")
      .setTooltip(t("TOOLTIP_CONFIGURE_PALETTE"))
      .onClick(() => {
        const modal = new PaletteManagerModal(app, customPalette, (newSettings) => {
          customPalette = newSettings;
          setVal(K_PALETTE, customPalette, true);
          dirty = true;
        });
        modal.open();
      })
    );

  bodyContainer.createEl("hr");

  let sliderValDisplay;
  const sliderSetting = new ea.obsidian.Setting(bodyContainer).setName(t("LABEL_MAX_WRAP_WIDTH")).addSlider((s) => {
    widthSlider = s;
    s.setLimits(WRAP_WIDTH_MIN, WRAP_WIDTH_MAX, WRAP_WIDTH_STEP)
    .setValue(maxWidth)
    .onChange(async (v) => {
      maxWidth = v;
      sliderValDisplay.setText(`${v}px`);
      if (disableTabEvents) return;

      setVal(K_WIDTH, v);
      dirty = true;
      await updateRootNodeCustomData({ maxWrapWidth: v });
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
      centerToggle = t;
      t.setValue(centerText)
      .onChange(async (v) => {
        centerText = v;
        if (disableTabEvents) return;

        setVal(K_CENTERTEXT, v);
        dirty = true;
        await updateRootNodeCustomData({ centerText: v });
      })
    });

  new ea.obsidian.Setting(bodyContainer).setName(t("LABEL_FONT_SIZES")).addDropdown((d) => {
    fontSizeDropdown = d;
    FONT_SCALE_TYPES.forEach((key) => d.addOption(key, key));
    d.setValue(fontsizeScale);
    d.onChange(async (v) => {
      fontsizeScale = v;
      if (disableTabEvents) return;

      setVal(K_FONTSIZE, v);
      dirty = true;
      await updateRootNodeCustomData({ fontsizeScale: v });
    });
  });

  // ------------------------------------
  // Hotkey Configuration Section
  // ------------------------------------
  bodyContainer.createEl("hr");

  const hkDetails = bodyContainer.createEl("details", {
    attr: { style: "margin-right: 5px; margin-left: 5px;" }
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
    // Strip out structural keys before saving to settings to maintain a single source of truth
    const hotkeysToSave = userHotkeys.map(h => {
      const { isInputOnly, requiresNode, isNavigation, hidden, ...configurableProps } = h;
      return configurableProps;
    });

    setVal(K_HOTKEYS, hotkeysToSave, true);
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
    if (h.hidden) return;
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
  // Remove existing styles first to ensure updates are applied immediately
  const existing = document.getElementById(MINDMAP_FOCUS_STYLE_ID);
  if (existing) existing.remove();

  const styleEl = document.createElement("style");
  styleEl.id = MINDMAP_FOCUS_STYLE_ID;
  styleEl.textContent = [
    ".modal.excalidraw-mindmap-ui {",
    " overflow: hidden;",
    " scrollbar-width: none;",
    "}",
    ".excalidraw-mindmap-ui .modal-header-button {display: none;}",
    // Focus styles
    ".excalidraw-mindmap-ui button:focus,",
    ".excalidraw-mindmap-ui .clickable-icon:focus,",
    ".excalidraw-mindmap-ui [tabindex]:focus,",
    ".excalidraw-mindmap-ui button:focus-visible,",
    ".excalidraw-mindmap-ui .clickable-icon:focus-visible,",
    ".excalidraw-mindmap-ui [tabindex]:focus-visible {",
    "  outline: 2px solid var(--interactive-accent) !important;",
    "  outline-offset: 2px;",
    "  background-color: var(--interactive-accent);",
    "  color: var(--background-primary);",
    "}",
    ...ea.DEVICE.isDesktop
      ? [".excalidraw-mindmap-ui hr {margin: 5px;}"]
      : [".excalidraw-mindmap-ui hr {margin: 15px 5px;}"],
    ".excalidraw-mindmap-ui .clickable-icon:focus svg,",
    ".excalidraw-mindmap-ui .clickable-icon:focus-visible svg {",
    "  color: inherit;",
    "}",
    // New Flex Input Styles
    ".mindmap-input-wrapper { display: flex; gap: 8px; width: 100%; transition: all 0.3s ease; }",
    ".mindmap-input-ontology { flex: 1; transition: flex-grow 0.3s ease; min-width: 0; }",
    ".mindmap-input-main { flex: 17; transition: flex-grow 0.3s ease; min-width: 0; }",
    ".mindmap-input-ontology.is-focused { flex: 17; }",
    ".mindmap-input-main.is-shrunk { flex: 1; }",
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
    const { contentEl, titleEl, modalEl, headerEl, bgEl } = floatingInputModal;
    modalEl.classList.add("excalidraw-mindmap-ui");
    if (bgEl) {
      bgEl.style.display="none";
    }
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
      setTimeout(() => {
        //the modalEl is repositioned after a delay
        //otherwise the event handlers in FloatingModal would override the move
        //leaving modalEl in the center of the view
        //modalEl.style.top and left must stay in the timeout call
        const {x, y} = ea.targetView.contentEl.getBoundingClientRect();
        const desktopShift = !!ea.targetView.contentEl.querySelector(".App-bottom-bar .App-toolbar")
          ? 0
          : (ea.targetView.contentEl.clientWidth < 1200 ? 36 : 0);
        modalEl.style.top = `${ y + FLOAT_MODAL_OFFSET + desktopShift}px`;
        modalEl.style.left = `${ x + FLOAT_MODAL_OFFSET }px`;
      }, ea.DEVICE.isMobile ? 400:150);
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
 * @returns {object} - { action, scope, requiresNode } or empty object if no match.
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

  return match ? { action: match.action, scope: match.scope ?? SCOPE.none, requiresNode: match.requiresNode } :  { };
};

/**
 * Main keydown handler.
 * Dispatches actions (add, edit, navigate, fold, etc.) based on hotkey settings.
 * 
 * @param {KeyboardEvent} e 
 */
const handleKeydown = (e) => {
  // Fix for IME (Korean, Chinese, Japanese, etc.) composition issues
  // Prevents "Enter" from triggering actions when it's just confirming a character selection
  if (e.isComposing || e.keyCode === 229) return;

  if (isRecordingHotkey) return;
  if (!ea.targetView || !ea.targetView.leaf.isVisible()) return;

  const currentWindow = isUndocked && floatingInputModal
    ? ea.targetView?.ownerWindow
    : sidepanelWindow;

  if (!currentWindow) return;

  const st = getAppState();
  if (!st || !!st.editingTextElement || !!st.selectedLinearElement?.isEditing || (st.showHyperlinkPopup === "editor")) return;

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

  let {action, scope, requiresNode} = getActionFromEvent(e);
  if (!action && !["Tab", "Enter"].includes(e.key)) return;

  let context = getHotkeyContext();

  // Local Tab handling for floating modal to keep focus cycling inside
  if (!action && isUndocked && floatingInputModal && e.key === "Tab") {
    const modalEl = floatingInputModal.modalEl;
    if (!modalEl) return;
    const activeEl = modalEl.ownerDocument.activeElement;
    if (!modalEl.contains(activeEl)) return;
    const selector =[
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

  // Verify active node requirement
  if (requiresNode && !getMindmapNodeFromSelection()) {
    return;
  }

  // Verify transaction state for Undo
  if (action === ACTION_UNDO && lastCommittedTransaction === null) {
    return;
  }

  // Verify transaction state for Redo
  if ((action === ACTION_REDO_Z || action === ACTION_REDO_Y) && redoAvailable === null) {
    return;
  }

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
    await addNode(inputEl.value, true, false, null, null, null, ontologyEl.value);
  } else {
    const info = getHierarchy(selectedForSibling, allElementsForSibling);
    const root = allElementsForSibling.find(el => el.id === info.rootId);
    const parentOfSelected = getParentNode(selectedForSibling.id, allElementsForSibling);
    const rootMode = root.customData?.growthMode || currentModalGrowthMode;
    const isVertical =["Up-facing", "Down-facing", "Up-Down"].includes(rootMode);
    
    // If parent exists, add to that parent (Sibling). 
    // If no parent (Root was selected), add to selected (Child).
    const targetParent = parentOfSelected ?? selectedForSibling;
    
    // Default position: slightly lower to ensure correct Y-sort order in directional maps
    let pos = {
      x: selectedForSibling.x + (isVertical && insertAfter ? selectedForSibling.width : 0) + (isVertical ? dir : 0),
      y: selectedForSibling.y + (!isVertical && insertAfter ? selectedForSibling.height : 0) + (!isVertical ? dir : 0),
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

    selectNodeInView(targetParent);
    await addNode(inputEl.value, false, false, null, null, pos, ontologyEl.value);
  }
  inputEl.value = "";
  ontologyEl.value = "";
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

    case ACTION_TOGGLE_CHECKBOX:
      await toggleCheckboxStatus();
      updateUI();
      break;

    case ACTION_TOGGLE_EMBED:
      await toggleEmbedStatus();
      updateUI();
    break;

    case ACTION_TOGGLE_SUBMAP_ROOT:
      await toggleSubmapRoot();
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
      await pasteElementToMap();
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
      await addNode(inputEl.value, true, false, null, null, null, ontologyEl.value);
      inputEl.value = "";
      ontologyEl.value = "";
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
          await addNode(inputEl.value, false, false, null, null, null, ontologyEl.value);
          inputEl.value = "";
          ontologyEl.value = "";
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
                selectNodeInView(mostRecentNode);
                handledRecent = true;
              }
            } else {
              mostRecentlyAddedNodeID = null;
            }
          }
          if (!handledRecent && sel) {
            const parent = getParentNode(sel.id, allElements);
            const siblings = parent ? getChildrenNodes(parent.id, allElements) :[];

            if (siblings.length > 1) {
              // Iterates forward continuously in logical index order, 
              // ignoring spatial/directional orientation bindings like ArrowDown
              siblings.sort((a, b) => getMindmapOrder(a) - getMindmapOrder(b));
              const idx = siblings.findIndex(s => s.id === sel.id);
              const nextIdx = (idx + 1) % siblings.length;
              selectNodeInView(siblings[nextIdx]);
            }
            else {
              const children = getChildrenNodes(sel.id, allElements);
              if (children.length > 0) {
                children.sort((a, b) => getMindmapOrder(a) - getMindmapOrder(b));
                selectNodeInView(children[0]);
              }
              else if (parent) {
                selectNodeInView(parent);
              }
            }
          }
        }
      }
      updateUI();
      break;

    case ACTION_UNDO:
      if (ea.targetView) {
        const currentVer = ExcalidrawLib.getSceneVersion(api().getSceneElements());
        if (lastCommittedTransaction && currentVer === lastCommittedTransaction.version && lastCommittedTransaction.steps > 0) {
          for(let i=0; i<=lastCommittedTransaction.steps; i++) { // <= to include the final select step
            api().history.undo();
          }
          const afterUndoVer = ExcalidrawLib.getSceneVersion(api().getSceneElements());
          redoAvailable = {
            steps: lastCommittedTransaction.steps,
            version: afterUndoVer
          };
          lastCommittedTransaction = null;
        } else {
          api().history.undo();
          lastCommittedTransaction = null;
          redoAvailable = null;
        }
      }
      break;

    case ACTION_REDO_Z:
    case ACTION_REDO_Y:
      if (ea.targetView) {
        const currentVer = ExcalidrawLib.getSceneVersion(api().getSceneElements());
        if (redoAvailable && currentVer === redoAvailable.version && redoAvailable.steps > 0) {
          for(let i=0; i<=redoAvailable.steps; i++) {
             api().history.redo();
          }
          const afterRedoVer = ExcalidrawLib.getSceneVersion(api().getSceneElements());
          lastCommittedTransaction = {
            steps: redoAvailable.steps,
            version: afterRedoVer
          };
          redoAvailable = null;
        } else {
          api().history.redo();
          lastCommittedTransaction = null;
          redoAvailable = null;
        }
      }
      break;
  }
};

// ---------------------------------------------------------------------------
// 11. Public Puppeteering API (minimal-impact wrappers)
// ---------------------------------------------------------------------------
(() => {
  const MMError = {
    NOT_READY: "NOT_READY",
    NO_VIEW: "NO_VIEW",
    INVALID_VIEW: "INVALID_VIEW",
    INVALID_NODE: "INVALID_NODE",
    NO_SELECTION: "NO_SELECTION",
    NO_ROOT: "NO_ROOT",
    AUTO_LAYOUT_DISABLED: "AUTO_LAYOUT_DISABLED",
    INVALID_ACTION: "INVALID_ACTION",
    INVALID_ARGUMENT: "INVALID_ARGUMENT",
    OPERATION_FAILED: "OPERATION_FAILED",
  };

  const mmOk = (data) => ({ ok: true, data });
  const mmErr = (code, message, details) => ({
    ok: false,
    error: details === undefined ? { code, message } : { code, message, details },
  });

  const requireView = () => {
    if (!isViewSet()) return mmErr(MMError.NO_VIEW, "No active ExcalidrawView");
    return null;
  };

  const findNodeById = (nodeId) => {
    const all = ea.getViewElements();
    return all.find((el) => el.id === nodeId);
  };

  const resolveNode = (nodeId) => {
    const viewErr = requireView();
    if (viewErr) return viewErr;

    if (nodeId) {
      const node = findNodeById(nodeId);
      if (!node) return mmErr(MMError.INVALID_NODE, `Node not found: ${nodeId}`);
      return mmOk(node);
    }

    const sel = getMindmapNodeFromSelection();
    if (!sel) return mmErr(MMError.NO_SELECTION, "No mindmap node selected");
    return mmOk(sel);
  };

  const getNodeOntology = (node, allElements) => {
    const incomingArrow = allElements.find(
      (a) => a.type === "arrow" && a.customData?.isBranch && a.endBinding?.elementId === node.id,
    );
    return incomingArrow
      ? (ea.getBoundTextElement(incomingArrow, true)?.sceneElement?.rawText || "")
      : "";
  };

  const extractMapConfig = (rootNode) => ({
    growthMode: rootNode.customData?.growthMode || currentModalGrowthMode,
    autoLayoutDisabled: rootNode.customData?.autoLayoutDisabled === true,
    arrowType: rootNode.customData?.arrowType ?? arrowType,
    fontsizeScale: rootNode.customData?.fontsizeScale ?? fontsizeScale,
    multicolor: typeof rootNode.customData?.multicolor === "boolean" ? rootNode.customData.multicolor : multicolor,
    boxChildren: typeof rootNode.customData?.boxChildren === "boolean" ? rootNode.customData.boxChildren : boxChildren,
    roundedCorners: typeof rootNode.customData?.roundedCorners === "boolean" ? rootNode.customData.roundedCorners : roundedCorners,
    maxWrapWidth: typeof rootNode.customData?.maxWrapWidth === "number" ? rootNode.customData.maxWrapWidth : maxWidth,
    isSolidArrow: typeof rootNode.customData?.isSolidArrow === "boolean" ? rootNode.customData.isSolidArrow : isSolidArrow,
    centerText: typeof rootNode.customData?.centerText === "boolean" ? rootNode.customData.centerText : centerText,
    fillSweep: typeof rootNode.customData?.fillSweep === "boolean" ? rootNode.customData.fillSweep : fillSweep,
    branchScale: rootNode.customData?.branchScale ?? branchScale,
    baseStrokeWidth:
      typeof rootNode.customData?.baseStrokeWidth === "number" ? rootNode.customData.baseStrokeWidth : baseStrokeWidth,
    layoutSettings: JSON.parse(JSON.stringify(rootNode.customData?.layoutSettings ?? layoutSettings)),
  });

  const API_ACTIONS = {
    ADD: ACTION_ADD,
    ADD_SIBLING_AFTER: ACTION_ADD_SIBLING_AFTER,
    ADD_SIBLING_BEFORE: ACTION_ADD_SIBLING_BEFORE,
    ADD_FOLLOW: ACTION_ADD_FOLLOW,
    ADD_FOLLOW_FOCUS: ACTION_ADD_FOLLOW_FOCUS,
    ADD_FOLLOW_ZOOM: ACTION_ADD_FOLLOW_ZOOM,
    EDIT: ACTION_EDIT,
    TOGGLE_CHECKBOX: ACTION_TOGGLE_CHECKBOX,
    PIN: ACTION_PIN,
    BOX: ACTION_BOX,
    TOGGLE_EMBED: ACTION_TOGGLE_EMBED,
    TOGGLE_BOUNDARY: ACTION_TOGGLE_BOUNDARY,
    TOGGLE_SUBMAP_ROOT: ACTION_TOGGLE_SUBMAP_ROOT,
    TOGGLE_GROUP: ACTION_TOGGLE_GROUP,
    FOLD: ACTION_FOLD,
    FOLD_L1: ACTION_FOLD_L1,
    FOLD_ALL: ACTION_FOLD_ALL,
    COPY: ACTION_COPY,
    CUT: ACTION_CUT,
    PASTE: ACTION_PASTE,
    ZOOM: ACTION_ZOOM,
    FOCUS: ACTION_FOCUS,
    NAVIGATE: ACTION_NAVIGATE,
    NAVIGATE_ZOOM: ACTION_NAVIGATE_ZOOM,
    NAVIGATE_FOCUS: ACTION_NAVIGATE_FOCUS,
    SORT_ORDER: ACTION_SORT_ORDER,
    REARRANGE: ACTION_REARRANGE,
    DOCK_UNDOCK: ACTION_DOCK_UNDOCK,
    HIDE: ACTION_HIDE,
    UNDO: ACTION_UNDO,
    REDO_Z: ACTION_REDO_Z,
    REDO_Y: ACTION_REDO_Y,
  };

  const API_ERROR_DOC = {
    [MMError.NOT_READY]: "MindMapBuilder runtime is not initialized",
    [MMError.NO_VIEW]: "No active ExcalidrawView is set",
    [MMError.INVALID_VIEW]: "The provided view is missing or not an ExcalidrawView",
    [MMError.INVALID_NODE]: "The provided node id does not exist in the active view",
    [MMError.NO_SELECTION]: "No mindmap node is currently selected",
    [MMError.NO_ROOT]: "Unable to resolve a root/settings root for the selected node",
    [MMError.AUTO_LAYOUT_DISABLED]: "The map has auto-layout disabled",
    [MMError.INVALID_ACTION]: "The provided action is unknown",
    [MMError.INVALID_ARGUMENT]: "One or more arguments are invalid",
    [MMError.OPERATION_FAILED]: "The underlying operation failed at runtime",
  };

  const API_METHOD_SPEC = {
    ready: {
      summary: "Returns whether the API runtime is initialized",
      params: [],
      returns: "boolean",
    },
    listMethods: {
      summary: "Returns the list of public method names",
      params: [],
      returns: "MMResult<{methods:string[]}>",
    },
    getErrorCodes: {
      summary: "Returns known error codes and their meaning",
      params: [],
      returns: "MMResult<{errors:Record<string,string>}>",
    },
    spec: {
      summary: "Returns machine-readable API metadata for agents",
      params: [],
      returns: "MMResult<{version:string,actions:string[],errors:Record<string,string>,methods:object}>",
    },
    help: {
      summary: "Returns method docs for one method or the full API",
      params: [
        { name: "method", type: "string", required: false },
        { name: "format", type: "string", required: false, enum: ["object", "text"] },
      ],
      returns: "MMResult<object|string>",
    },
    validate: {
      summary: "Validates arguments against the API method contract",
      params: [
        { name: "method", type: "string", required: true },
        { name: "args", type: "any", required: false },
      ],
      returns: "MMResult<{valid:boolean,errors:string[],normalizedArgs:object}>",
    },
    getCapabilities: {
      summary: "Returns available actions and methods",
      params: [],
      returns: "{actions:string[],methods:string[]}",
    },
    setView: {
      summary: "Sets the active ExcalidrawView context",
      params: [{ name: "view", type: "object", required: true }],
      returns: "MMResult<{view:ExcalidrawView|null,filePath:string|null}>",
    },
    getView: {
      summary: "Gets the current ExcalidrawView and filepath",
      params: [],
      returns: "MMResult<{view:ExcalidrawView|null,filePath:string|null}>",
    },
    getSelection: {
      summary: "Returns selected node id and selected element ids",
      params: [],
      returns: "MMResult<{nodeId:string|null,elementIds:string[]}>",
    },
    selectNode: {
      summary: "Selects a node by id or current selected node when omitted",
      params: [{ name: "nodeId", type: "string", required: false }],
      returns: "MMResult<{nodeId:string}>",
    },
    setInputFieldDockStatus: {
      summary: "Forces docked/undocked input mode and applies matching sidepanel visibility",
      params: [{ name: "isDocked", type: "boolean", required: true }],
      returns: "Promise<MMResult<{isDocked:boolean,isUndocked:boolean,sidepanelVisible:boolean}>>",
    },
    getMindMapRoots: {
      summary: "Returns top-level mindmap root node ids",
      params: [],
      returns: "MMResult<{rootIds:string[]}>",
    },
    getMapInfo: {
      summary: "Returns hierarchy info for a node or current selection",
      params: [{ name: "nodeId", type: "string", required: false }],
      returns: "MMResult<{nodeId:string,rootId:string,settingsRootId:string,depth:number}>",
    },
    getNodeText: {
      summary: "Returns node text and ontology",
      params: [{ name: "nodeId", type: "string", required: false }],
      returns: "MMResult<{nodeId:string,text:string,ontology:string}>",
    },
    performAction: {
      summary: "Runs one built-in mindmap action",
      params: [
        { name: "action", type: "string", required: true, enum: Object.values(API_ACTIONS) },
        { name: "event", type: "object", required: false },
      ],
      returns: "Promise<MMResult<void>>",
    },
    refreshMapLayout: {
      summary: "Refreshes map layout from the selected node or provided node id",
      params: [{ name: "nodeId", type: "string", required: false }],
      returns: "Promise<MMResult<{rootId:string}>>",
    },
    addNode: {
      summary: "Adds a node under selected node or a provided parent",
      params: [
        { name: "text", type: "string", required: true },
        { name: "parentId", type: "string", required: false },
        { name: "ontology", type: "string", required: false },
        { name: "follow", type: "boolean", required: false },
        { name: "position", type: "string", required: false },
      ],
      returns: "Promise<MMResult<{nodeId:string,arrowId:string|undefined,rootId:string}>>",
    },
    importMarkdown: {
      summary: "Imports markdown bullet hierarchy into map",
      params: [
        { name: "markdown", type: "string", required: true },
        { name: "parentId", type: "string", required: false },
      ],
      returns: "Promise<MMResult<{addedNodeIds:string[],rootId:string|null}>>",
    },
    exportMarkdown: {
      summary: "Exports selected branch to markdown through clipboard",
      params: [
        { name: "nodeId", type: "string", required: false },
        { name: "cut", type: "boolean", required: false },
      ],
      returns: "Promise<MMResult<{markdown:string}>>",
    },
    toggleSubmapRoot: {
      summary: "Toggles or forces additional-root state on node",
      params: [
        { name: "nodeId", type: "string", required: false },
        { name: "enabled", type: "boolean", required: false },
      ],
      returns: "Promise<MMResult<{nodeId:string,enabled:boolean}>>",
    },
    getMapConfig: {
      summary: "Returns effective map config for node/root",
      params: [{ name: "nodeId", type: "string", required: false }],
      returns: "MMResult<{rootId:string,settingsRootId:string,config:object}>",
    },
    setMapConfig: {
      summary: "Patches map config and optionally relayouts",
      params: [
        { name: "patch", type: "object", required: true },
        { name: "nodeId", type: "string", required: false },
        { name: "relayout", type: "boolean", required: false },
      ],
      returns: "Promise<MMResult<{rootId:string,settingsRootId:string}>>",
    },
    getBranchElementIds: {
      summary: "Returns branch element ids with optional decorations/crosslinks",
      params: [
        { name: "nodeId", type: "string", required: true },
        { name: "includeDecorations", type: "boolean", required: false },
        { name: "includeCrosslinks", type: "boolean", required: false },
      ],
      returns: "MMResult<{ids:string[]}>",
    },
    getProjectElementIds: {
      summary: "Returns all project element ids for a root",
      params: [{ name: "rootId", type: "string", required: true }],
      returns: "MMResult<{ids:string[]}>",
    },
    getElementIdsByRole: {
      summary: "Returns role-based element id groups for a root",
      params: [{ name: "rootId", type: "string", required: true }],
      returns: "MMResult<{nodes:string[],branchArrows:string[],crossLinks:string[],boundaries:string[],decorations:string[],boundTexts:string[]}>",
    },
  };

  const cloneJSON = (value) => JSON.parse(JSON.stringify(value));

  const normalizeValidationArgs = (method, args) => {
    const spec = API_METHOD_SPEC[method];
    if (!spec) return null;
    if (args === undefined || args === null) return {};
    if (Array.isArray(args)) {
      const out = {};
      spec.params.forEach((p, idx) => {
        if (idx < args.length) out[p.name] = args[idx];
      });
      return out;
    }
    if (typeof args === "object") return { ...args };
    if (spec.params.length === 1) return { [spec.params[0].name]: args };
    return null;
  };

  const isTypeMatch = (value, type) => {
    if (type === "any") return true;
    if (type === "array") return Array.isArray(value);
    if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
    return typeof value === type;
  };

  const validateMethodArgs = (method, args) => {
    const spec = API_METHOD_SPEC[method];
    if (!spec) {
      return { valid: false, errors: [`Unknown method: ${method}`], normalizedArgs: {} };
    }

    const normalizedArgs = normalizeValidationArgs(method, args);
    if (normalizedArgs === null) {
      return {
        valid: false,
        errors: ["Arguments must be an object, an array of positional values, or a single value for single-parameter methods"],
        normalizedArgs: {},
      };
    }

    const errors = [];
    spec.params.forEach((p) => {
      const v = normalizedArgs[p.name];
      if (p.required && (v === undefined || v === null || (p.type === "string" && v === ""))) {
        errors.push(`Missing required parameter: ${p.name}`);
        return;
      }
      if (v !== undefined && v !== null && !isTypeMatch(v, p.type)) {
        errors.push(`Invalid type for ${p.name}: expected ${p.type}, got ${Array.isArray(v) ? "array" : typeof v}`);
      }
      if (p.enum && v !== undefined && v !== null && !p.enum.includes(v)) {
        errors.push(`Invalid value for ${p.name}: ${v}`);
      }
    });

    return { valid: errors.length === 0, errors, normalizedArgs };
  };

  const buildHelpText = (methodName, doc) => {
    const params = doc.params.map((p) => {
      const req = p.required ? "required" : "optional";
      const enumValues = p.enum ? ` | enum: ${p.enum.join(", ")}` : "";
      return `- ${p.name}: ${p.type} (${req})${enumValues}`;
    });
    const paramsText = params.length ? params.join("\n") : "- (none)";
    return [
      `${methodName}`,
      `${doc.summary}`,
      "Parameters:",
      paramsText,
      `Returns: ${doc.returns}`,
    ].join("\n");
  };

  const API = {
    version: "1.0.0",
    Actions: Object.freeze(API_ACTIONS),
    Errors: Object.freeze(MMError),

    ready: () => !!ea,

    listMethods: () => mmOk({ methods: Object.keys(API_METHOD_SPEC) }),

    getErrorCodes: () => mmOk({ errors: cloneJSON(API_ERROR_DOC) }),

    spec: () =>
      mmOk({
        version: API.version,
        actions: Object.values(API_ACTIONS),
        errors: cloneJSON(API_ERROR_DOC),
        methods: cloneJSON(API_METHOD_SPEC),
      }),

    help: (method, format = "object") => {
      if (method !== undefined && (typeof method !== "string" || method.trim() === "")) {
        return mmErr(MMError.INVALID_ARGUMENT, "help expects method to be a non-empty string when provided");
      }
      if (!["object", "text"].includes(format)) {
        return mmErr(MMError.INVALID_ARGUMENT, "help format must be 'object' or 'text'");
      }

      if (!method) {
        if (format === "text") {
          const lines = Object.keys(API_METHOD_SPEC).map((name) => `${name}: ${API_METHOD_SPEC[name].summary}`);
          return mmOk([`MindMapBuilder API v${API.version}`, ...lines].join("\n"));
        }
        return mmOk({
          version: API.version,
          methods: cloneJSON(API_METHOD_SPEC),
          actions: Object.values(API_ACTIONS),
          errors: cloneJSON(API_ERROR_DOC),
        });
      }

      const doc = API_METHOD_SPEC[method];
      if (!doc) {
        return mmErr(MMError.INVALID_ARGUMENT, `Unknown method: ${method}`);
      }

      if (format === "text") return mmOk(buildHelpText(method, doc));
      return mmOk({ method, ...cloneJSON(doc) });
    },

    validate: (method, args) => {
      if (typeof method !== "string" || method.trim() === "") {
        return mmErr(MMError.INVALID_ARGUMENT, "validate requires a method name");
      }
      const result = validateMethodArgs(method, args);
      return mmOk(result);
    },

    getCapabilities: () => ({
      actions: Object.values(API_ACTIONS),
      methods: Object.keys(API),
    }),

    setView: (view) => {
      if (!view) return mmErr(MMError.INVALID_VIEW, "setView expects an ExcalidrawView object");

      const isValid = !!ea?.isExcalidrawView(view);

      if (!isValid) return mmErr(MMError.INVALID_VIEW, "setView expects an ExcalidrawView object");

      try {
        ea.setView(view);
        ea.clear();
        ensureNodeSelected();
        updateUI();
        return mmOk({ view: ea.targetView, filePath: ea.targetView?.file?.path || null });
      } catch (e) {
        return mmErr(MMError.OPERATION_FAILED, "Failed to set view", e);
      }
    },

    getView: () => mmOk({ view: ea.targetView || null, filePath: ea.targetView?.file?.path || null }),

    getSelection: () => {
      const viewErr = requireView();
      if (viewErr) return viewErr;
      return mmOk({
        nodeId: getMindmapNodeFromSelection()?.id || null,
        elementIds: ea.getViewSelectedElements().map((e) => e.id),
      });
    },

    selectNode: (nodeId) => {
      const nodeRes = resolveNode(nodeId);
      if (!nodeRes.ok) return nodeRes;
      selectNodeInView(nodeRes.data);
      performAction(ACTION_FOCUS);
      updateUI(nodeRes.data);
      return mmOk({ nodeId: nodeRes.data.id });
    },

    setInputFieldDockStatus: async ({ isDocked } = {}) => {
      const viewErr = requireView();
      if (viewErr) return viewErr;
      if (typeof isDocked !== "boolean") {
        return mmErr(MMError.INVALID_ARGUMENT, "setInputFieldDockStatus requires a boolean isDocked");
      }

      try {
        const sidepanelLeaf = ea.getSidepanelLeaf?.();
        const isSidepanelVisible = !!sidepanelLeaf?.isVisible?.();

        if (isDocked) {
          if (isUndocked) {
            await performAction(ACTION_DOCK_UNDOCK);
          } else if (!isSidepanelVisible && sidepanelLeaf) {
            app.workspace.revealLeaf(sidepanelLeaf);
          }
        } else {
          if (!isUndocked) {
            await performAction(ACTION_DOCK_UNDOCK);
          } else if (isSidepanelVisible) {
            ea.toggleSidepanelView();
          }
        }

        const finalSidepanelLeaf = ea.getSidepanelLeaf?.();
        const sidepanelVisible = !!finalSidepanelLeaf?.isVisible?.();
        return mmOk({ isDocked: !isUndocked, isUndocked, sidepanelVisible });
      } catch (e) {
        return mmErr(MMError.OPERATION_FAILED, "setInputFieldDockStatus failed", e);
      }
    },

    getMindMapRoots: () => {
      const viewErr = requireView();
      if (viewErr) return viewErr;
      return mmOk({ rootIds: getMasterRoots() });
    },

    getMapInfo: (nodeId) => {
      const nodeRes = resolveNode(nodeId);
      if (!nodeRes.ok) return nodeRes;
      const node = nodeRes.data;
      const all = ea.getViewElements();
      const info = getHierarchy(node, all);
      const settingsRoot = getSettingsRootNode(node, all);
      return mmOk({
        nodeId: node.id,
        rootId: info.rootId,
        settingsRootId: settingsRoot?.id || info.rootId,
        depth: info.depth,
      });
    },

    getNodeText: (nodeId) => {
      const nodeRes = resolveNode(nodeId);
      if (!nodeRes.ok) return nodeRes;
      const node = nodeRes.data;
      const all = ea.getViewElements();
      return mmOk({
        nodeId: node.id,
        text: getTextFromNode(all, node, true, true),
        ontology: getNodeOntology(node, all),
      });
    },

    performAction: async (action, event = {}) => {
      const viewErr = requireView();
      if (viewErr) return viewErr;
      if (!action || !Object.values(API_ACTIONS).includes(action)) {
        return mmErr(MMError.INVALID_ACTION, `Unknown action: ${action}`);
      }
      try {
        await performAction(action, event);
        return mmOk(undefined);
      } catch (e) {
        return mmErr(MMError.OPERATION_FAILED, "performAction failed", e);
      }
    },

    refreshMapLayout: async (nodeId) => {
      const viewErr = requireView();
      if (viewErr) return viewErr;

      let sel = null;
      if (nodeId) {
        const node = findNodeById(nodeId);
        if (!node) return mmErr(MMError.INVALID_NODE, `Node not found: ${nodeId}`);
        sel = node;
      }

      try {
        await refreshMapLayout(sel);
        const target = sel || getMindmapNodeFromSelection();
        if (!target) return mmErr(MMError.NO_SELECTION, "No selected node for layout refresh");
        const info = getHierarchy(target, ea.getViewElements());
        return mmOk({ rootId: info.rootId });
      } catch (e) {
        return mmErr(MMError.OPERATION_FAILED, "refreshMapLayout failed", e);
      }
    },

    addNode: async ({ text, parentId, ontology, follow = false, position } = {}) => {
      const viewErr = requireView();
      if (viewErr) return viewErr;
      if (!text || typeof text !== "string") {
        return mmErr(MMError.INVALID_ARGUMENT, "addNode requires non-empty text");
      }

      if (parentId) {
        const parent = findNodeById(parentId);
        if (!parent) return mmErr(MMError.INVALID_NODE, `Parent node not found: ${parentId}`);
        selectNodeInView(parent);
      }

      try {
        const node = await addNode(text, follow, false, null, null, position || null, ontology ?? null);
        if (!node) return mmErr(MMError.OPERATION_FAILED, "Failed to create node");

        const all = ea.getViewElements();
        const info = getHierarchy(node, all);
        const arrow = all.find(
          (a) => a.type === "arrow" && a.customData?.isBranch && a.endBinding?.elementId === node.id,
        );
        return mmOk({ nodeId: node.id, arrowId: arrow?.id, rootId: info.rootId });
      } catch (e) {
        return mmErr(MMError.OPERATION_FAILED, "addNode failed", e);
      }
    },

    importMarkdown: async ({ markdown, parentId } = {}) => {
      const viewErr = requireView();
      if (viewErr) return viewErr;
      if (typeof markdown !== "string" || markdown.trim() === "") {
        return mmErr(MMError.INVALID_ARGUMENT, "importMarkdown requires a non-empty markdown string");
      }

      if (parentId) {
        const parent = findNodeById(parentId);
        if (!parent) return mmErr(MMError.INVALID_NODE, `Parent node not found: ${parentId}`);
        selectNodeInView(parent);
      }

      const beforeIds = new Set(ea.getViewElements().map((e) => e.id));
      try {
        await importTextToMap(markdown);
        const after = ea.getViewElements();
        const addedNodeIds = after
          .filter((e) => !beforeIds.has(e.id) && e.type !== "arrow" && !e.customData?.isBoundary)
          .map((e) => e.id);

        let rootId = null;
        if (parentId) {
          const parent = after.find((e) => e.id === parentId);
          rootId = parent ? getHierarchy(parent, after).rootId : null;
        } else if (addedNodeIds.length > 0) {
          const n = after.find((e) => e.id === addedNodeIds[0]);
          rootId = n ? getHierarchy(n, after).rootId : null;
        }

        return mmOk({ addedNodeIds, rootId });
      } catch (e) {
        return mmErr(MMError.OPERATION_FAILED, "importMarkdown failed", e);
      }
    },

    exportMarkdown: async ({ nodeId, cut = false } = {}) => {
      const viewErr = requireView();
      if (viewErr) return viewErr;

      if (nodeId) {
        const node = findNodeById(nodeId);
        if (!node) return mmErr(MMError.INVALID_NODE, `Node not found: ${nodeId}`);
        selectNodeInView(node);
      }

      try {
        const markdown = await copyMapAsText(!!cut, false);
        return mmOk({ markdown });
      } catch (e) {
        return mmErr(MMError.OPERATION_FAILED, "exportMarkdown failed", e);
      }
    },

    toggleSubmapRoot: async ({ nodeId, enabled } = {}) => {
      const nodeRes = resolveNode(nodeId);
      if (!nodeRes.ok) return nodeRes;
      const node = nodeRes.data;

      const current = node.customData?.isAdditionalRoot === true;
      if (typeof enabled === "boolean" && enabled === current) {
        return mmOk({ nodeId: node.id, enabled: current });
      }

      selectNodeInView(node);
      try {
        await toggleSubmapRoot();
        const updated = findNodeById(node.id);
        return mmOk({ nodeId: node.id, enabled: updated?.customData?.isAdditionalRoot === true });
      } catch (e) {
        return mmErr(MMError.OPERATION_FAILED, "toggleSubmapRoot failed", e);
      }
    },

    getMapConfig: (nodeId) => {
      const nodeRes = resolveNode(nodeId);
      if (!nodeRes.ok) return nodeRes;
      const node = nodeRes.data;
      const all = ea.getViewElements();
      const info = getHierarchy(node, all);
      const settingsRoot = getSettingsRootNode(node, all);
      if (!settingsRoot) return mmErr(MMError.NO_ROOT, "Could not resolve settings root");

      return mmOk({
        rootId: info.rootId,
        settingsRootId: settingsRoot.id,
        config: extractMapConfig(settingsRoot),
      });
    },

    setMapConfig: async ({ patch, nodeId, relayout = true } = {}) => {
      const nodeRes = resolveNode(nodeId);
      if (!nodeRes.ok) return nodeRes;
      const node = nodeRes.data;
      if (!patch || typeof patch !== "object") {
        return mmErr(MMError.INVALID_ARGUMENT, "setMapConfig requires a patch object");
      }

      try {
        selectNodeInView(node);
        const info = await updateRootNodeCustomData({ ...patch }, node);
        if (!info) return mmErr(MMError.OPERATION_FAILED, "Failed to update map config");
        if (relayout) await refreshMapLayout(node);
        return mmOk({ rootId: info.rootId, settingsRootId: info.settingsRootId });
      } catch (e) {
        return mmErr(MMError.OPERATION_FAILED, "setMapConfig failed", e);
      }
    },

    getBranchElementIds: ({ nodeId, includeDecorations = true, includeCrosslinks = true } = {}) => {
      const viewErr = requireView();
      if (viewErr) return viewErr;
      if (!nodeId) return mmErr(MMError.INVALID_ARGUMENT, "getBranchElementIds requires nodeId");

      const node = findNodeById(nodeId);
      if (!node) return mmErr(MMError.INVALID_NODE, `Node not found: ${nodeId}`);

      const all = ea.getViewElements();
      let ids = getBranchElementIds(nodeId, all);
      if (includeDecorations || includeCrosslinks) {
        const info = getHierarchy(node, all);
        const extras = getDecorationAndCrossLinkIdsForBranches(ids, all, info.rootId);
        if (!includeDecorations || !includeCrosslinks) {
          const extraEls = extras.map((id) => all.find((e) => e.id === id)).filter(Boolean);
          const filteredExtra = extraEls.filter((e) => {
            if (e.type === "arrow") return includeCrosslinks;
            return includeDecorations;
          });
          ids = ids.concat(filteredExtra.map((e) => e.id));
        } else {
          ids = ids.concat(extras);
        }
      }
      return mmOk({ ids: Array.from(new Set(ids)) });
    },

    getProjectElementIds: (rootId) => {
      const viewErr = requireView();
      if (viewErr) return viewErr;
      if (!rootId) return mmErr(MMError.INVALID_ARGUMENT, "getProjectElementIds requires rootId");

      const all = ea.getViewElements();
      const root = all.find((e) => e.id === rootId);
      if (!root) return mmErr(MMError.INVALID_NODE, `Root not found: ${rootId}`);

      const project = getMindmapProjectElements(rootId, all);
      return mmOk({ ids: project.map((e) => e.id) });
    },

    getElementIdsByRole: (rootId) => {
      const viewErr = requireView();
      if (viewErr) return viewErr;
      if (!rootId) return mmErr(MMError.INVALID_ARGUMENT, "getElementIdsByRole requires rootId");

      const all = ea.getViewElements();
      const root = all.find((e) => e.id === rootId);
      if (!root) return mmErr(MMError.INVALID_NODE, `Root not found: ${rootId}`);

      const branchIds = getBranchElementIds(rootId, all);
      const decorationAndCrossLinkIds = getDecorationAndCrossLinkIdsForBranches(branchIds, all, rootId);
      const project = getMindmapProjectElements(rootId, all);

      const nodes = branchIds
        .map((id) => all.find((e) => e.id === id))
        .filter((e) => e && e.type !== "arrow" && !e.customData?.isBoundary)
        .map((e) => e.id);

      const boundaries = project.filter((e) => e.customData?.isBoundary).map((e) => e.id);
      const branchArrows = project.filter((e) => e.type === "arrow" && e.customData?.isBranch).map((e) => e.id);
      const crossLinks = project.filter((e) => e.type === "arrow" && !e.customData?.isBranch).map((e) => e.id);

      const boundTexts = project
        .filter((e) => e.type === "text")
        .filter((t) => {
          if (t.containerId) return true;
          return project.some((el) => el.boundElements?.some((be) => be.id === t.id));
        })
        .map((e) => e.id);

      const decorationSet = new Set(decorationAndCrossLinkIds);
      const roleSet = new Set([...nodes, ...boundaries, ...branchArrows, ...crossLinks, ...boundTexts]);
      const decorations = project
        .filter((e) => decorationSet.has(e.id) || (!roleSet.has(e.id) && !branchIds.includes(e.id)))
        .filter((e) => !crossLinks.includes(e.id) && !boundaries.includes(e.id))
        .map((e) => e.id);

      return mmOk({
        nodes: Array.from(new Set(nodes)),
        branchArrows: Array.from(new Set(branchArrows)),
        crossLinks: Array.from(new Set(crossLinks)),
        boundaries: Array.from(new Set(boundaries)),
        decorations: Array.from(new Set(decorations)),
        boundTexts: Array.from(new Set(boundTexts)),
      });
    },
  };

  window.MindMapBuilderAPI = API;
  console.log("window.MindMapBuilderAPI initialized. For documentation visit: https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/docs/ea-script-docs/MindMapBuilderAPI.md", API);
})();

let uiUpdateTimer = null;

/**
 * Throttled handler for canvas clicks (pointer down).
 * Updates the UI to reflect the new selection.
 * 
 * @param {PointerEvent} e 
 */
const handleCanvasPointerDown = (e) => {
  if (!isViewSet()) return;
  if (floatingInputModal && floatingInputModal.modalEl.contains(e.target)) return;

  if (uiUpdateTimer) {
    clearTimeout(uiUpdateTimer);
  }

  uiUpdateTimer = setTimeout(() => {
    if (!isViewSet()) return;
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
      mostRecentlySelectedNodeID = null;
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
      mostRecentlySelectedNodeID = null;
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
    delete window.MindMapBuilderAPI;
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