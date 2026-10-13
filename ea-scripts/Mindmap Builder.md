/*
# Mind Map Builder

![](https://youtu.be/5G9QF-u9w0Q)

Mind Map Builder turns the Obsidian Excalidraw canvas into a keyboard-driven brainstorming environment. Add children and siblings, arrange branches, pin nodes, fold subtrees, customize colors and grouping, and copy or paste Markdown outlines. Controls live in a persistent sidepanel and can be undocked into a floating input.

To reuse a branch with its links, images, and grouped notes, select the complete branch on the canvas and use native Excalidraw copy. Select a destination Mindmap node, then use the existing Builder **Paste** button or hotkey. The branch attaches as a child; with no destination selected, it becomes an independent map. Builder **Copy** continues to export Markdown outlines.

Pasted branches retain their styles, folds, pinned nodes, and nested submap settings. Copied whole maps become submaps when attached. Auto-layout remains disabled where you disabled it. Builder's input Undo/Redo groups a completed branch paste; the canvas Undo/Redo controls follow native paste, attachment, and layout history steps.

> [!Tip]
> Become a MindMap Builder Pro with the official [MindMap Builder course](https://www.visual-thinking-workshop.com/mindmap)!

Requires Excalidraw 2.23.4 or newer. Excalidraw 2.27.0 or newer caches compiled scripts, so repeated hotkey activation reuses compiled code and the existing sidepanel without rereading the script. This script is distributed as readable JavaScript, with no compressed executable payload.

[Modular source and authoring instructions](https://github.com/zsviczian/ea-scripts/tree/main/src/scripts/mindmap-builder) · [API documentation](https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/docs/ea-script-docs/MindMapBuilderAPI.md)

If you find MindMap Builder helpful, [buy me a coffee](https://ko-fi.com/zsolt).

Build version: 2026-10-13T15:29:25.764Z

```javascript
*/

// Configuration constants
const VERSION = "v26.10.13";

// Script bundle
/* EA Script — mindmap-builder | ea-scripts v1.0.0 */
(() => {
  // src/sharedUtils/i18n.ts
  function interpolateTranslation(template, params = {}) {
    return Object.entries(params).reduce(
      (result, [key, value]) => result.split(`{${key}}`).join(String(value)),
      template
    );
  }
  function createTranslator(requestedLocale, catalogs, fallbackLocale = "en") {
    const locale = requestedLocale.toLowerCase().replaceAll("_", "-");
    const baseLocale = locale.split("-")[0] ?? locale;
    return (key, params = {}) => {
      const template = catalogs[locale]?.[key] ?? catalogs[baseLocale]?.[key] ?? catalogs[fallbackLocale]?.[key] ?? key;
      return interpolateTranslation(template, params);
    };
  }

  // src/scripts/mindmap-builder/lang/de.ts
  var de = {};

  // src/scripts/mindmap-builder/lang/en.ts
  var en = {
    requiresNewerVersion: "Please update the Excalidraw plugin to version {version} or higher.",
    launchFailed: "Mindmap Builder could not start. See the developer console for details.",
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
    NOTICE_BRANCH_PASTE_INVALID: "Cannot paste this branch: its Mindmap connections are invalid.",
    NOTICE_BRANCH_PASTE_FAILED: "Branch paste could not finish. Any pasted elements remain in the drawing. Check the drawing before retrying.",
    NOTICE_ACTION_REQUIRES_ARROWS: "This action requires Arrow Keys. Only modifiers can be changed.",
    NOTICE_CONFLICT_WITH_ACTION: 'Conflict with "{action}"',
    NOTICE_OBSIDIAN_HOTKEY_CONFLICT: '\u26A0\uFE0F Obsidian Hotkey Conflict!\n\nThis key overrides:\n"{command}"',
    NOTICE_GLOBAL_HOTKEY_CONFLICT: '\u26A0\uFE0F Global Hotkey Conflict!\n\nThis key overrides:\n"{command}"',
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
    ACTION_LABEL_CALENDAR: "Task Calendar & Priority",
    ACTION_LABEL_TOGGLE_EMBED: "Toggle Embed/Link",
    // Tooltips (shared)
    PIN_TOOLTIP_PINNED: "This element is pinned. Click to unpin the location of the selected element",
    PIN_TOOLTIP_UNPINNED: "This element is not pinned. Click to pin the location of the selected element",
    TOGGLE_GROUP_TOOLTIP_GROUP: 'Group this branch. Only available if "Group Branches" is disabled',
    TOGGLE_GROUP_TOOLTIP_UNGROUP: 'Ungroup this branch. Only available if "Group Branches" is disabled',
    TOOLTIP_EDIT_NODE: "Edit text of selected node",
    TOOLTIP_PIN_INIT: "Pin/Unpin location of a node. When pinned nodes won't get auto-arranged",
    TOOLTIP_REFRESH: "Auto rearrange map",
    TOOLTIP_DOCK: "Dock to Sidepanel",
    TOOLTIP_UNDOCK: "Undock to Floating Modal",
    TOOLTIP_ZOOM_CYCLE: "Cycle element zoom",
    TOOLTIP_TOGGLE_GROUP_BTN: 'Toggle grouping/ungrouping of a branch. Only available if "Group Branches" is disabled.',
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
    TOOLTIP_CALENDAR: "Configure Task Date & Priority",
    TOOLTIP_TOGGLE_EMBED: "Toggle node between Embed and Link",
    // Buttons and labels
    DOCK_TITLE: "Mind Map Builder",
    HELP_SUMMARY: "Help",
    INPUT_PLACEHOLDER: "Concept... type [[ to insert link",
    ONTOLOGY_PLACEHOLDER: "Ontology (Arrow Label)",
    BUTTON_COPY: "Copy",
    BUTTON_CUT: "Cut",
    BUTTON_PASTE: "Paste",
    TITLE_ADD_SIBLING: `Add sibling with {modifier}+Enter`,
    TITLE_ADD_FOLLOW: "Add and follow",
    TITLE_COPY: "Copy branch as text",
    TITLE_CUT: "Cut branch as text",
    TITLE_PASTE: "Paste Markdown or a copied Mindmap branch",
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
    HOTKEY_HINT: "These hotkeys may override some Obsidian defaults. They're Local (\u2328\uFE0F) by default, active only when the MindMap input field is focused. Use the \u{1F310}/\u{1F3A8}/\u2328\uFE0F toggle to change hotkey scope: \u{1F310} Overrides Obsidian hotkeys whenever an Excalidraw tab is visible, \u{1F3A8} Overrides Obsidian hotkeys whenever Excalidraw is focused, \u2328\uFE0F Local (input focused).",
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
    CALENDAR_DATE_INDEX: "Date {index} of {total}",
    CALENDAR_DATE_LABEL: "Date",
    CALENDAR_DATE_TYPE: "Date Type",
    CALENDAR_PRIORITY: "Priority",
    CALENDAR_RECURRENCE: "Recurrence",
    CALENDAR_RECURRENCE_PLACEHOLDER: "every day",
    CALENDAR_RECURRENCE_DESC: `e.g., 'every day', 'every 2 weeks' <br><a href="https://publish.obsidian.md/tasks/Getting+Started/Recurring+Tasks" target="_blank" tabindex="-1">Tasks recurrence docs</a>`,
    CALENDAR_INJECT_LINK: "Inject node link",
    CALENDAR_INJECT_LINK_DESC: "Adds a link to the node at the end of the task.",
    CALENDAR_ALIAS_PLACEHOLDER: "Alias",
    CALENDAR_BTN_CANCEL: "Cancel",
    CALENDAR_BTN_TASK_ONLY: "Task Only",
    CALENDAR_BTN_ADD_DATE_TASK: "Add Date & Task",
    CALENDAR_PRIORITY_HIGHEST: "Highest",
    CALENDAR_PRIORITY_HIGH: "High",
    CALENDAR_PRIORITY_MEDIUM: "Medium",
    CALENDAR_PRIORITY_NORMAL: "Normal",
    CALENDAR_PRIORITY_LOW: "Low",
    CALENDAR_PRIORITY_LOWEST: "Lowest",
    CALENDAR_DATETYPE_DUE: "Due",
    CALENDAR_DATETYPE_START: "Start",
    CALENDAR_DATETYPE_SCHEDULED: "Scheduled",
    CALENDAR_DATETYPE_CREATED: "Created",
    CALENDAR_DATETYPE_DONE: "Done",
    CALENDAR_DATETYPE_CANCELLED: "Cancelled",
    // Presets
    PRESET_LABEL: "Preset",
    PRESET_DEFAULT: "Default",
    PRESET_UNSAVED: "Custom / Unlinked",
    PRESET_BTN_SAVE: "Save to Preset",
    PRESET_BTN_DELETE: "Delete Preset",
    PRESET_BTN_NEW: "Create New Preset",
    PRESET_BTN_APPLY: "Apply Preset to Map",
    PRESET_WARNING_MODIFIED: "Map settings differ from preset.",
    PROMPT_NEW_PRESET_NAME: "New preset name:",
    NOTICE_PRESET_DELETED: "Preset deleted.",
    NOTICE_PRESET_SAVED: "Preset saved.",
    NOTICE_PRESET_APPLIED: "Preset applied.",
    // Misc
    INPUT_TITLE_PASTE_ROOT: "Mindmap Builder Paste",
    INSTRUCTIONS: `> [!Tip]
>\u{1F680} Become a MindMap Builder Pro with the Official [MindMap Builder Course](https://www.visual-thinking-workshop.com/mindmap)!

- **ENTER**: Add a child node and stay on the current parent for rapid entry. If you press enter when the input field is empty the focus will move to the child node that was most recently added. Pressing enter subsequent times will iterate through the new child's siblings
- **Hotkeys**: See configuration at the bottom of the sidepanel
- **Dock/Undock**: You can dock/undock the input field using the dock/undock button or the configured hotkey
- **Folding**: Fold/Unfold buttons only appear when the input is docked; when undocked, use the folding hotkeys.
- **ESC**: Docks the floating input field without activating the side panel
- **Coloring**: First level branches get unique colors (Multicolor mode). Descendants inherit parent's color.
- **Grouping**:
  - Enabling "Group Branches" recursively groups sub-trees from leaves up to the first level.
- **Copy/Paste**: Builder Copy exports Markdown. To preserve links, images, and grouped notes, use native canvas copy, select the destination parent, then use Builder Paste. With no parent selected, the copied branch becomes an independent map.

\u{1F60D} If you find this script helpful, please [buy me a coffee \u2615](https://ko-fi.com/zsolt).`
  };

  // src/scripts/mindmap-builder/lang/es.ts
  var es = {};

  // src/scripts/mindmap-builder/lang/fr.ts
  var fr = {};

  // src/scripts/mindmap-builder/lang/ru.ts
  var ru = {};

  // src/scripts/mindmap-builder/lang/zh-cn.ts
  var zhCn = {
    // Notices
    NOTICE_SELECT_NODE_TO_COPY: "\u8BF7\u9009\u62E9\u8981\u590D\u5236\u7684\u8282\u70B9\u3002",
    NOTICE_MAP_CUT: "\u5BFC\u56FE\u5DF2\u526A\u5207\u5230\u526A\u8D34\u677F\u3002",
    NOTICE_BRANCH_CUT: "\u5206\u652F\u5DF2\u526A\u5207\u5230\u526A\u8D34\u677F\u3002",
    NOTICE_MAP_COPIED: "\u5BFC\u56FE\u5DF2\u590D\u5236\u4E3A Markdown \u683C\u5F0F\u3002",
    NOTICE_BRANCH_COPIED: "\u5206\u652F\u5DF2\u590D\u5236\u4E3A\u5217\u8868\u683C\u5F0F\u3002",
    NOTICE_CLIPBOARD_EMPTY: "\u526A\u8D34\u677F\u4E3A\u7A7A\u3002",
    NOTICE_PASTE_ABORTED: "\u7C98\u8D34\u4E2D\u6B62\u3002\u526A\u8D34\u677F\u5185\u5BB9\u975E Markdown \u5217\u8868\u6216\u6807\u9898\u3002",
    NOTICE_NO_LIST: "\u526A\u8D34\u677F\u4E2D\u672A\u53D1\u73B0\u6709\u6548\u7684 Markdown \u5217\u8868\u3002",
    NOTICE_PASTE_START: "\u6B63\u5728\u7C98\u8D34\uFF0C\u8BF7\u7A0D\u5019\uFF0C\u53EF\u80FD\u9700\u8981\u4E00\u4E9B\u65F6\u95F4\u2026",
    NOTICE_PASTE_COMPLETE: "\u7C98\u8D34\u5B8C\u6210\u3002",
    NOTICE_ACTION_REQUIRES_ARROWS: "\u6B64\u64CD\u4F5C\u9700\u8981\u65B9\u5411\u952E\u3002\u4EC5\u53EF\u4FEE\u6539\u4FEE\u9970\u952E\u3002",
    NOTICE_CONFLICT_WITH_ACTION: "\u4E0E\u201C{action}\u201D\u64CD\u4F5C\u51B2\u7A81",
    NOTICE_OBSIDIAN_HOTKEY_CONFLICT: "\u26A0\uFE0F Obsidian \u70ED\u952E\u51B2\u7A81\uFF01\n\n\u6B64\u6309\u952E\u5C06\u8986\u76D6\uFF1A\n\u201C{command}\u201D",
    NOTICE_GLOBAL_HOTKEY_CONFLICT: "\u26A0\uFE0F \u5168\u5C40\u70ED\u952E\u51B2\u7A81\uFF01\n\n\u6B64\u6309\u952E\u5C06\u8986\u76D6\uFF1A\n\u201C{command}\u201D",
    NOTICE_NO_HEADINGS: "\u94FE\u63A5\u6587\u4EF6\u4E2D\u672A\u53D1\u73B0\u5C0F\u6807\u9898\u3002",
    NOTICE_CANNOT_EDIT_MULTILINE: "\u65E0\u6CD5\u76F4\u63A5\u7F16\u8F91\u591A\u884C\u8282\u70B9\u3002\n\u8BF7\u5728 Excalidraw \u4E2D\u53CC\u51FB\u5143\u7D20\u8FDB\u884C\u7F16\u8F91\uFF0C\u7136\u540E\u8FD0\u884C\u201C\u81EA\u52A8\u91CD\u6392\u5BFC\u56FE\u201D\u6765\u66F4\u65B0\u5E03\u5C40\u3002",
    NOTICE_CANNOT_MOVE_PINNED: "\u65E0\u6CD5\u79FB\u52A8\u5DF2\u9501\u5B9A\u7684\u8282\u70B9\u3002\u8BF7\u5148\u89E3\u9501\u3002",
    NOTICE_CANNOT_MOVE_ROOT: "\u65E0\u6CD5\u79FB\u52A8\u6839\u8282\u70B9\u3002",
    NOTICE_CANNOT_PRMOTE_L1: "\u65E0\u6CD5\u63D0\u5347 1 \u7EA7\u8282\u70B9\u3002",
    NOTICE_CANNOT_DEMOTE: "\u65E0\u6CD5\u964D\u7EA7\u8282\u70B9\u3002\u6CA1\u6709\u53EF\u4F9D\u9644\u7684\u524D\u7F6E\u540C\u7EA7\u8282\u70B9\u3002",
    NOTICE_SELECT_NODE_CONTAINING_LINK: "\u8BF7\u9009\u62E9\u5305\u542B\u94FE\u63A5\u7684\u8282\u70B9\u3002",
    NOTICE_CANNOT_DEMOTE_NO_SIBLING_TO_ACCEPT: "\u65E0\u6CD5\u964D\u7EA7\uFF1A\u672A\u627E\u5230\u53EF\u63A5\u6536\u6B64\u8282\u70B9\u7684\u540C\u7EA7\u8282\u70B9\u3002",
    NOTICE_CANNOT_DEMOTE_NO_VALID_SIBLING: "\u65E0\u6CD5\u964D\u7EA7\uFF1A\u6CA1\u6709\u53EF\u9644\u52A0\u7684\u6709\u6548\u540C\u7EA7\u8282\u70B9\u3002",
    NOTICE_CANNOT_DEMOTE_CROSS_SIDE_NOT_ALLOWED: "\u65E0\u6CD5\u964D\u7EA7\uFF1A\u4E0D\u5141\u8BB8\u8DE8\u4FA7\u964D\u7EA7\u3002",
    NOTICE_CANNOT_MOVE_AUTO_LAYOUT_DISABLED: "\u7981\u7528\u81EA\u52A8\u5E03\u5C40\u65F6\u65E0\u6CD5\u79FB\u52A8\u8282\u70B9\u3002\u8BF7\u5148\u542F\u7528\u81EA\u52A8\u5E03\u5C40\u3002",
    NOTICE_BRANCH_WIDTH_MANUAL_OVERRIDE: "\u5206\u652F\u7C97\u7EC6\u672A\u66F4\u65B0\uFF0C\u56E0\u4E3A\u90E8\u5206\u5206\u652F\u7C97\u7EC6\u5DF2\u88AB\u624B\u52A8\u4FEE\u6539\u3002",
    NOTICE_CANNOT_CHANGE_MASTER_ROOT: "\u4E3B\u6839\u8282\u70B9\u4E0D\u80FD\u88AB\u8F6C\u6362\u3002",
    NOTICE_SUBMAP_ROOT_ADDED: "\u5DF2\u542F\u7528\u5B50\u56FE\u6839\u8282\u70B9\u3002",
    NOTICE_SUBMAP_ROOT_REMOVED: "\u5DF2\u79FB\u9664\u5B50\u56FE\u6839\u8282\u70B9\u3002\u5176\u5B50\u8282\u70B9\u5C06\u6309\u4EB2\u4EE3\u6839\u8282\u70B9\u5E03\u5C40\u91CD\u6392\u3002",
    CONFIRM_REMOVE_SUBMAP_ROOT: "\u6062\u590D\u4E3A\u666E\u901A\u8282\u70B9\u5417\uFF1F\n\n\u5B83\u5C06\u5931\u53BB\u672C\u5730\u5E03\u5C40\u5143\u6570\u636E\uFF0C\u5176\u5B50\u8282\u70B9\u5C06\u6309\u4EB2\u4EE3\u6839\u8282\u70B9\u5E03\u5C40\u91CD\u6392\u3002",
    // Action labels (display only)
    ACTION_LABEL_ADD: "\u6DFB\u52A0\u5B50\u8282\u70B9",
    ACTION_LABEL_ADD_SIBLING_AFTER: "\u6DFB\u52A0\u540E\u7F6E\u540C\u7EA7\u8282\u70B9",
    ACTION_LABEL_ADD_SIBLING_BEFORE: "\u6DFB\u52A0\u524D\u7F6E\u540C\u7EA7\u8282\u70B9",
    ACTION_LABEL_ADD_FOLLOW: "\u6DFB\u52A0 + \u8DDF\u968F",
    ACTION_LABEL_ADD_FOLLOW_FOCUS: "\u6DFB\u52A0 + \u8DDF\u968F + \u805A\u7126",
    ACTION_LABEL_ADD_FOLLOW_ZOOM: "\u6DFB\u52A0 + \u8DDF\u968F + \u7F29\u653E",
    ACTION_LABEL_SORT_ORDER: "\u66F4\u6539\u987A\u5E8F/\u63D0\u5347\u8282\u70B9",
    ACTION_LABEL_EDIT: "\u7F16\u8F91\u8282\u70B9",
    ACTION_LABEL_PIN: "\u9501\u5B9A/\u89E3\u9501",
    ACTION_LABEL_BOX: "\u6DFB\u52A0/\u79FB\u9664\u8FB9\u6846",
    ACTION_LABEL_TOGGLE_GROUP: "\u7F16\u7EC4/\u89E3\u9664\u7F16\u7EC4\u5355\u5206\u652F",
    ACTION_LABEL_COPY: "\u590D\u5236",
    ACTION_LABEL_CUT: "\u526A\u5207",
    ACTION_LABEL_PASTE: "\u7C98\u8D34",
    ACTION_LABEL_IMPORT_OUTLINE: "\u5BFC\u5165\u5927\u7EB2",
    ACTION_LABEL_ZOOM: "\u5FAA\u73AF\u7F29\u653E",
    ACTION_LABEL_FOCUS: "\u805A\u7126\uFF08\u5E76\u5C45\u4E2D\uFF09\u8282\u70B9",
    ACTION_LABEL_NAVIGATE: "\u5BFC\u822A",
    ACTION_LABEL_NAVIGATE_ZOOM: "\u5BFC\u822A & \u7F29\u653E",
    ACTION_LABEL_NAVIGATE_FOCUS: "\u5BFC\u822A & \u805A\u7126",
    ACTION_LABEL_FOLD: "\u6298\u53E0/\u5C55\u5F00\u5206\u652F",
    ACTION_LABEL_FOLD_L1: "\u6298\u53E0/\u5C55\u5F00 L1 \u5B50\u8282\u70B9",
    ACTION_LABEL_FOLD_ALL: "\u9012\u5F52\u6298\u53E0/\u5C55\u5F00\u5206\u652F",
    ACTION_LABEL_DOCK_UNDOCK: "\u505C\u9760/\u53D6\u6D88\u505C\u9760",
    ACTION_LABEL_HIDE: "\u505C\u9760 & \u9690\u85CF",
    ACTION_LABEL_REARRANGE: "\u91CD\u6392\u5BFC\u56FE",
    ACTION_LABEL_TOGGLE_SUBMAP_ROOT: "\u5F00\u59CB/\u7ED3\u675F\u5B50\u56FE\u6839\u8282\u70B9",
    ACTION_LABEL_TOGGLE_CHECKBOX: "\u5207\u6362\u590D\u9009\u6846\u72B6\u6001",
    ACTION_LABEL_CALENDAR: "\u4EFB\u52A1\u65E5\u5386\u4E0E\u4F18\u5148\u7EA7",
    ACTION_LABEL_TOGGLE_EMBED: "\u5207\u6362\u5D4C\u5165/\u94FE\u63A5",
    // Tooltips (shared)
    PIN_TOOLTIP_PINNED: "\u6B64\u5143\u7D20\u5DF2\u9501\u5B9A\u3002\u70B9\u51FB\u89E3\u9501\u6240\u9009\u5143\u7D20\u7684\u4F4D\u7F6E\u3002",
    PIN_TOOLTIP_UNPINNED: "\u6B64\u5143\u7D20\u672A\u9501\u5B9A\u3002\u70B9\u51FB\u9501\u5B9A\u6240\u9009\u5143\u7D20\u7684\u4F4D\u7F6E\u3002",
    TOGGLE_GROUP_TOOLTIP_GROUP: "\u7F16\u7EC4\u6B64\u5206\u652F\u3002\u4EC5\u5728\u201C\u5206\u652F\u7F16\u7EC4\u201D\u7981\u7528\u65F6\u53EF\u7528\u3002",
    TOGGLE_GROUP_TOOLTIP_UNGROUP: "\u89E3\u9664\u7F16\u7EC4\u6B64\u5206\u652F\u3002\u4EC5\u5728\u201C\u5206\u652F\u7F16\u7EC4\u201D\u7981\u7528\u65F6\u53EF\u7528\u3002",
    TOOLTIP_EDIT_NODE: "\u7F16\u8F91\u6240\u9009\u8282\u70B9\u7684\u6587\u672C",
    TOOLTIP_PIN_INIT: "\u9501\u5B9A/\u89E3\u9501\u8282\u70B9\u4F4D\u7F6E\u3002\u9501\u5B9A\u7684\u8282\u70B9\u4E0D\u4F1A\u88AB\u81EA\u52A8\u91CD\u6392\u3002",
    TOOLTIP_REFRESH: "\u81EA\u52A8\u91CD\u6392\u5BFC\u56FE",
    TOOLTIP_DOCK: "\u505C\u9760\u5230\u4FA7\u8FB9\u9762\u677F",
    TOOLTIP_UNDOCK: "\u8F6C\u4E3A\u6D6E\u52A8\u7A97\u53E3",
    TOOLTIP_ZOOM_CYCLE: "\u5FAA\u73AF\u5207\u6362\u5143\u7D20\u7F29\u653E\u7EA7\u522B",
    TOOLTIP_TOGGLE_GROUP_BTN: "\u5207\u6362\u5206\u652F\u7684\u7F16\u7EC4\u72B6\u6001\u3002\u4EC5\u5728\u201C\u5206\u652F\u7F16\u7EC4\u201D\u7981\u7528\u65F6\u53EF\u7528\u3002",
    TOOLTIP_TOGGLE_BOX: "\u5207\u6362\u8282\u70B9\u8FB9\u6846",
    TOOLTIP_TOGGLE_BOUNDARY: "\u5207\u6362\u5B50\u6811\u8FB9\u754C",
    TOOLTIP_TOGGLE_FLOATING_EXTRAS: "\u5207\u6362\u989D\u5916\u63A7\u4EF6",
    TOOLTIP_CONFIGURE_PALETTE: "\u4E3A\u5206\u652F\u914D\u7F6E\u81EA\u5B9A\u4E49\u8C03\u8272\u677F",
    TOOLTIP_CONFIGURE_LAYOUT: "\u914D\u7F6E\u5E03\u5C40\u8BBE\u7F6E",
    TOOLTIP_MOVE_UP: "\u4E0A\u79FB",
    TOOLTIP_MOVE_DOWN: "\u4E0B\u79FB",
    TOOLTIP_EDIT_COLOR: "\u7F16\u8F91",
    TOOLTIP_DELETE_COLOR: "\u5220\u9664",
    TOOLTIP_OPEN_PALETTE_PICKER: "\u6253\u5F00\u989C\u8272\u9009\u62E9\u5668",
    TOOLTIP_FOLD_BRANCH: "\u6298\u53E0/\u5C55\u5F00\u6240\u9009\u5206\u652F",
    TOOLTIP_FOLD_L1_BRANCH: "\u6298\u53E0/\u5C55\u5F00 L1 \u5B50\u8282\u70B9",
    TOOLTIP_FOLD_ALL: "\u9012\u5F52\u6298\u53E0/\u5C55\u5F00\u5206\u652F",
    TOOLTIP_IMPORT_OUTLINE: "\u4ECE\u94FE\u63A5\u6587\u4EF6\u4E2D\u5BFC\u5165\u5C0F\u6807\u9898\u4F5C\u4E3A\u5B50\u8282\u70B9\u6570\u636E",
    TOOLTIP_RESET_TO_DEFAULT: "\u6062\u590D\u9ED8\u8BA4",
    TOOLTIP_SUBMAP_ROOT_ADD: "\u4ECE\u6240\u9009\u8282\u70B9\u5F00\u59CB\u5B50\u56FE",
    TOOLTIP_SUBMAP_ROOT_REMOVE: "\u5C06\u5B50\u56FE\u6839\u8282\u70B9\u6062\u590D\u4E3A\u666E\u901A\u8282\u70B9",
    TOOLTIP_TOGGLE_CHECKBOX: "\u5207\u6362\u4EFB\u52A1\u590D\u9009\u6846\u72B6\u6001",
    TOOLTIP_CALENDAR: "\u914D\u7F6E\u4EFB\u52A1\u65E5\u671F\u4E0E\u4F18\u5148\u7EA7",
    TOOLTIP_TOGGLE_EMBED: "\u5728\u5D4C\u5165\u548C\u94FE\u63A5\u4E4B\u95F4\u5207\u6362\u8282\u70B9",
    // Buttons and labels
    DOCK_TITLE: "MindMap Builder",
    HELP_SUMMARY: "\u5E2E\u52A9",
    INPUT_PLACEHOLDER: "\u8F93\u5165\u6982\u5FF5\u2026 \u8F93\u5165 [[ \u63D2\u5165\u94FE\u63A5",
    ONTOLOGY_PLACEHOLDER: "\u672C\u4F53\uFF08\u7BAD\u5934\u6807\u7B7E\uFF09",
    BUTTON_COPY: "\u590D\u5236",
    BUTTON_CUT: "\u526A\u5207",
    BUTTON_PASTE: "\u7C98\u8D34",
    TITLE_ADD_SIBLING: `\u4F7F\u7528 {modifier}+Enter \u6DFB\u52A0\u540C\u7EA7\u8282\u70B9`,
    TITLE_ADD_FOLLOW: "\u6DFB\u52A0\u5E76\u8DDF\u968F",
    TITLE_COPY: "\u590D\u5236\u5206\u652F\u4E3A\u6587\u672C",
    TITLE_CUT: "\u526A\u5207\u5206\u652F\u4E3A\u6587\u672C",
    TITLE_PASTE: "\u4ECE\u526A\u8D34\u677F\u7C98\u8D34\u5217\u8868",
    LABEL_ZOOM_LEVEL: "\u7F29\u653E\u7EA7\u522B",
    LABEL_GROWTH_STRATEGY: "\u751F\u957F\u7B56\u7565",
    LABEL_FILL_SWEEP: "\u586B\u5145\u626B\u8FC7\u89D2\u5EA6",
    DESC_FILL_SWEEP: "\u7ACB\u5373\u5728\u6574\u4E2A\u201C\u6700\u5927\u626B\u8FC7\u89D2\u5EA6\u201D\u8303\u56F4\u5185\u5206\u5E03\u8282\u70B9\uFF0C\u800C\u4E0D\u662F\u968F\u7740\u8282\u70B9\u6570\u91CF\u589E\u52A0\u9010\u6E10\u6269\u5927\u5F27\u5EA6\u3002",
    LABEL_ARROW_TYPE: "\u66F2\u7EBF\u8FDE\u63A5",
    LABEL_AUTO_LAYOUT: "\u81EA\u52A8\u5E03\u5C40",
    LABEL_GROUP_BRANCHES: "\u5206\u652F\u7F16\u7EC4",
    LABEL_BOX_CHILD_NODES: "\u4E3A\u5B50\u8282\u70B9\u6DFB\u52A0\u8FB9\u6846",
    LABEL_ROUNDED_CORNERS: "\u5706\u89D2",
    LABEL_USE_SCENE_STROKE: "\u4F7F\u7528\u573A\u666F\u7EBF\u6761\u6837\u5F0F",
    DESC_USE_SCENE_STROKE: "\u4F7F\u7528\u573A\u666F\u4E2D\u6700\u65B0\u7684\u7EBF\u6761\u6837\u5F0F\uFF08\u5B9E\u7EBF\u3001\u865A\u7EBF\u3001\u70B9\u7EBF\uFF09\uFF0C\u5426\u5219\u5206\u652F\u5C06\u59CB\u7EC8\u4F7F\u7528\u5B9E\u7EBF\u3002",
    LABEL_BRANCH_SCALE: "\u5206\u652F\u7C97\u7EC6\u6BD4\u4F8B",
    LABEL_BASE_WIDTH: "\u57FA\u7840\u7C97\u7EC6",
    LABEL_MULTICOLOR_BRANCHES: "\u591A\u8272\u5206\u652F",
    LABEL_MAX_WRAP_WIDTH: "\u6700\u5927\u6298\u884C\u5BBD\u5EA6",
    LABEL_CENTER_TEXT: "\u6587\u672C\u5C45\u4E2D",
    DESC_CENTER_TEXT: "\u5173\u95ED\uFF1A\u6839\u636E\u4F4D\u7F6E\u5DE6/\u53F3\u5BF9\u9F50\uFF1B\u5F00\u542F\uFF1A\u6587\u672C\u5F3A\u5236\u5C45\u4E2D\u3002",
    LABEL_FONT_SIZES: "\u5B57\u4F53\u5927\u5C0F",
    HOTKEY_SECTION_TITLE: "\u70ED\u952E\u914D\u7F6E",
    HOTKEY_HINT: "\u8FD9\u4E9B\u70ED\u952E\u53EF\u80FD\u8986\u76D6 Obsidian \u9ED8\u8BA4\u8BBE\u7F6E\u3002\u70ED\u952E\u4F5C\u7528\u57DF\u9ED8\u8BA4\u4E3A\u5C40\u90E8\uFF08\u2328\uFE0F\uFF09\uFF0C\u4F7F\u7528 \u{1F310}/\u{1F3A8}/\u2328\uFE0F \u5207\u6362\u4F5C\u7528\u57DF\uFF1A\u{1F310} Excalidraw \u6807\u7B7E\u9875\u53EF\u89C1\u5373\u751F\u6548\uFF0C\u{1F3A8} Excalidraw \u805A\u7126\u65F6\u751F\u6548\uFF0C\u2328\uFE0F \u8F93\u5165\u6846\u805A\u7126\u65F6\u751F\u6548\u3002",
    RECORD_HOTKEY_PROMPT: "\u6309\u4E0B\u70ED\u952E\u2026",
    ARIA_SCOPE_INPUT: "\u5C40\u90E8\uFF08Local\uFF09\uFF1A\u4EC5\u5728\u8F93\u5165\u6846\u805A\u7126\u65F6\u751F\u6548",
    ARIA_SCOPE_EXCALIDRAW: "Excalidraw\uFF1A\u8F93\u5165\u6846\u6216 Excalidraw \u805A\u7126\u65F6\u751F\u6548",
    ARIA_SCOPE_GLOBAL: "\u5168\u5C40\uFF08Global\uFF09\uFF1A\u5728 Obsidian \u4EFB\u4F55\u4F4D\u7F6E\uFF0CExcalidraw \u53EF\u89C1\u5373\u751F\u6548",
    ARIA_RESTORE_DEFAULT: "\u6062\u590D\u9ED8\u8BA4",
    ARIA_CUSTOMIZE_HOTKEY: "\u81EA\u5B9A\u4E49\u6B64\u70ED\u952E",
    ARIA_OVERRIDE_COMMAND: "\u5C06\u8986\u76D6 Obsidian \u547D\u4EE4\uFF1A\n{command}",
    // Palette manager
    MODAL_PALETTE_TITLE: "\u5BFC\u56FE\u5206\u652F\u8C03\u8272\u677F",
    LABEL_ENABLE_CUSTOM_PALETTE: "\u542F\u7528\u81EA\u5B9A\u4E49\u8C03\u8272\u677F",
    DESC_ENABLE_CUSTOM_PALETTE: "\u4F7F\u7528\u4EE5\u4E0B\u989C\u8272\u4EE3\u66FF\u81EA\u52A8\u751F\u6210\u7684\u989C\u8272\u3002",
    LABEL_RANDOMIZE_ORDER: "\u968F\u673A\u987A\u5E8F",
    DESC_RANDOMIZE_ORDER: "\u968F\u673A\u9009\u62E9\u989C\u8272\u800C\u975E\u6309\u987A\u5E8F\u9009\u62E9\u3002",
    HEADING_ADD_NEW_COLOR: "\u6DFB\u52A0\u65B0\u989C\u8272",
    HEADING_EDIT_COLOR: "\u7F16\u8F91\u989C\u8272",
    LABEL_SELECT_COLOR: "\u9009\u62E9\u989C\u8272",
    BUTTON_CANCEL_EDIT: "\u53D6\u6D88\u7F16\u8F91",
    BUTTON_ADD_COLOR: "\u6DFB\u52A0\u989C\u8272",
    BUTTON_UPDATE_COLOR: "\u66F4\u65B0\u989C\u8272",
    // Layout configuration
    MODAL_LAYOUT_TITLE: "\u5E03\u5C40\u914D\u7F6E",
    // Section Headers
    SECTION_GENERAL: "\u5E38\u89C4\u95F4\u8DDD",
    SECTION_RADIAL: "\u5F84\u5411\u5E03\u5C40\uFF08\u987A\u65F6\u9488\uFF09",
    SECTION_DIRECTIONAL: "\u5B9A\u5411\u5E03\u5C40\uFF08\u5DE6/\u53F3\uFF09",
    SECTION_VERTICAL: "\u5782\u76F4\u5BFC\u56FE\uFF08\u4E0A/\u4E0B\uFF09",
    SECTION_VISUALS: "\u89C6\u89C9\u5143\u7D20",
    SECTION_MANUAL: "\u624B\u52A8\u6A21\u5F0F\u884C\u4E3A",
    LAYOUT_RESET: "\u91CD\u7F6E\u6240\u6709\u4E3A\u9ED8\u8BA4\u503C",
    LAYOUT_SAVE: "\u4FDD\u5B58\u5E76\u5173\u95ED",
    // Radial Strings
    RADIAL_ASPECT_RATIO: "\u692D\u5706\u957F\u5BBD\u6BD4",
    DESC_RADIAL_ASPECT_RATIO: "\u63A7\u5236\u5F62\u72B6\u3002< 1.0 \u4E3A\u7626\u957F\uFF080.7 \u4E3A\u7EB5\u5411\uFF09\uFF0C1.0 \u4E3A\u6B63\u5706\uFF0C> 1.0 \u4E3A\u5BBD\u6241\uFF08\u6A2A\u5411\uFF09\u3002",
    RADIAL_POLE_GAP_BONUS: "\u6781\u70B9\u95F4\u8DDD\u8865\u507F",
    DESC_RADIAL_POLE_GAP_BONUS: "\u589E\u52A0\u692D\u5706\u5357\u5317\u4E24\u6781\u533A\u57DF\u5185\u8282\u70B9\u7684\u95F4\u8DDD\u3002\u503C\u8D8A\u5927\uFF0C\u8282\u70B9\u6CBF\u5F27\u7EBF\u63A8\u5F97\u8D8A\u8FDC\u3002",
    RADIAL_START_ANGLE: "\u8D77\u59CB\u89D2\u5EA6",
    DESC_RADIAL_START_ANGLE: "\u7B2C\u4E00\u4E2A\u8282\u70B9\u51FA\u73B0\u7684\u4F4D\u7F6E\uFF08\u5EA6\u6570\uFF09\u3002270 \u4E3A\u5317\uFF0C0 \u4E3A\u4E1C\uFF0C90 \u4E3A\u5357\u3002",
    RADIAL_MAX_SWEEP: "\u6700\u5927\u626B\u8FC7\u89D2\u5EA6",
    DESC_RADIAL_MAX_SWEEP: "\u5206\u652F\u53EF\u586B\u5145\u7684\u5F27\u8303\u56F4\u3002360 \u4E3A\u5168\u5706\u3002\u8F83\u5C0F\u7684\u503C\u4F1A\u4F7F\u5706\u4E0D\u5B8C\u6574\u3002",
    // Others
    GAP_X: "\u6C34\u5E73\u95F4\u8DDD\uFF08Gap X\uFF09",
    DESC_LAYOUT_GAP_X: "\u4EB2\u4EE3\u8282\u70B9\u4E0E\u5B50\u8282\u70B9\u4E4B\u95F4\u7684\u6C34\u5E73\u8DDD\u79BB\u3002",
    GAP_Y: "\u5782\u76F4\u95F4\u8DDD\uFF08Gap Y\uFF09",
    DESC_LAYOUT_GAP_Y: "\u540C\u7EA7\u8282\u70B9\u4E4B\u95F4\u7684\u5782\u76F4\u8DDD\u79BB\u3002\u5F84\u5411\u5E03\u5C40\u4E2D\u7684\u57FA\u7840\u95F4\u8DDD\u3002",
    GAP_MULTIPLIER: "\u95F4\u8DDD\u500D\u6570",
    DESC_LAYOUT_GAP_MULTIPLIER: "\u53F6\u8282\u70B9\uFF08\u65E0\u5B50\u8282\u70B9\u7684\u8282\u70B9\uFF09\u76F8\u5BF9\u4E8E\u5B57\u4F53\u5927\u5C0F\u7684\u5782\u76F4\u95F4\u8DDD\u3002\u4F4E\uFF1A\u7C7B\u4F3C\u5217\u8868\u5806\u53E0\uFF1B\u9AD8\uFF1A\u6807\u51C6\u6811\u72B6\u95F4\u8DDD\u3002",
    DIRECTIONAL_ARC_SPAN_RADIANS: "\u5B9A\u5411\u5F20\u5F00\u5F27\u5EA6\uFF08Arc-span Radians\uFF09",
    DESC_LAYOUT_ARC_SPAN: "\u5B50\u8282\u70B9\u6392\u5217\u7684\u66F2\u7387\u3002\u4F4E\uFF080.5\uFF09\uFF1A\u8F83\u5E73\uFF0C\u7C7B\u4F3C\u5217\u8868\u3002\u9AD8\uFF082.0\uFF09\uFF1A\u5F2F\u66F2\u6709\u673A\uFF0C\u4F46\u6709\u91CD\u53E0\u98CE\u9669\u3002",
    ROOT_RADIUS_FACTOR: "\u6839\u8282\u70B9\u534A\u5F84\u7CFB\u6570",
    DESC_LAYOUT_ROOT_RADIUS: "\u76F8\u5BF9\u4E8E\u6839\u8282\u70B9\u8FB9\u6846\u7684\u500D\u6570\uFF0C\u51B3\u5B9A\u6700\u521D\u7684\u534A\u5F84\u3002",
    MIN_RADIUS: "\u6700\u5C0F\u534A\u5F84",
    DESC_LAYOUT_MIN_RADIUS: "\u4ECE\u6839\u8282\u70B9\u4E2D\u5FC3\u5230\u7B2C\u4E00\u7EA7\u8282\u70B9\u7684\u6700\u5C0F\u7EDD\u5BF9\u8DDD\u79BB\u3002",
    RADIUS_PADDING_PER_NODE: "\u5355\u8282\u70B9\u5F84\u5411\u7A7A\u767D\u8FB9\u8DDD",
    DESC_LAYOUT_RADIUS_PADDING: "\u6BCF\u4E2A\u5B50\u8282\u70B9\u989D\u5916\u589E\u52A0\u7684\u534A\u5F84\uFF0C\u4EE5\u9002\u5E94\u5BC6\u96C6\u578B\u5BFC\u56FE\u3002",
    GAP_MULTIPLIER_RADIAL: "\u5F84\u5411\u5E03\u5C40\u95F4\u8DDD\u500D\u6570",
    DESC_LAYOUT_GAP_RADIAL: "\u5F84\u5411\u5E03\u5C40\u6A21\u5F0F\u4E0B\u7684\u89D2\u5EA6\u95F4\u8DDD\u500D\u6570\u3002",
    GAP_MULTIPLIER_DIRECTIONAL: "\u5782\u76F4\u65B9\u5411\u95F4\u8DDD\u500D\u6570",
    DESC_LAYOUT_GAP_DIRECTIONAL: "\u5B9A\u5411\u5E03\u5C40\u9876\u5C42\u5206\u652F\u4E4B\u95F4\u7684\u95F4\u8DDD\u500D\u6570\u3002",
    INDICATOR_OFFSET: "\u6298\u53E0\u6307\u793A\u7B26\u504F\u79FB",
    DESC_LAYOUT_INDICATOR_OFFSET: "\u6298\u53E0\u6307\u793A\u7B26\uFF08\u4E09\u8FDE\u70B9\uFF09\u8DDD\u79BB\u8282\u70B9\u7684\u8DDD\u79BB\u3002",
    INDICATOR_OPACITY: "\u6298\u53E0\u6307\u793A\u7B26\u4E0D\u900F\u660E\u5EA6",
    DESC_LAYOUT_INDICATOR_OPACITY: "\u6298\u53E0\u6307\u793A\u7B26\u7684\u4E0D\u900F\u660E\u5EA6\uFF080-100\uFF09\u3002",
    CONTAINER_PADDING: "\u5BB9\u5668\u5185\u8FB9\u8DDD",
    DESC_LAYOUT_CONTAINER_PADDING: "\u4F7F\u7528\u8FB9\u6846\u6837\u5F0F\u65F6\u7684\u5185\u8FB9\u8DDD\u3002",
    MAX_SEGMENT_LENGTH: "\u8FB9\u754C\u7EBF\u7CBE\u5EA6",
    DESC_LAYOUT_BOUNDARY_LINE_PRECISION: "\u8FB9\u754C\u5E73\u6ED1\u7CBE\u5EA6\u3002\u503C\u8D8A\u5C0F\u8D8A\u7CBE\u7EC6\uFF0830 = \u7CBE\u7EC6\uFF09\uFF0C\u503C\u8D8A\u5927\u8D8A\u7C97\u7565\uFF08200 = \u7C97\u7565\uFF09\u3002",
    VERTICAL_SUBTREE_WIDTH_BLEND_SINGLE: "\u5B50\u6811\u5BBD\u5EA6\u53C2\u4E0E\u5EA6\uFF08\u5355\u4FA7\uFF09",
    DESC_VERTICAL_SUBTREE_WIDTH_BLEND_SINGLE: "\u5782\u76F4\u5BFC\u56FE\u4E2D\uFF0C\u5355\u4FA7\u751F\u957F\u7684\u5B50\u56FE\u5360\u7528\uFF08\u5DE6/\u53F3\uFF09\u6C34\u5E73\u7A7A\u95F4\u7684\u5F3A\u5EA6\u3002\u5F71\u54CD\u7A0B\u5EA6\u9AD8\u3002",
    VERTICAL_SUBTREE_WIDTH_BLEND_DUAL: "\u5B50\u6811\u5BBD\u5EA6\u53C2\u4E0E\u5EA6\uFF08\u53CC\u4FA7\uFF09",
    DESC_VERTICAL_SUBTREE_WIDTH_BLEND_DUAL: "\u5782\u76F4\u5BFC\u56FE\u4E2D\uFF0C\u53CC\u4FA7\u751F\u957F\u7684\u5B50\u56FE\u5360\u7528\uFF08\u5DE6\u53F3\uFF09\u6C34\u5E73\u7A7A\u95F4\u7684\u5F3A\u5EA6\u3002\u5F71\u54CD\u7A0B\u5EA6\u9AD8\u3002",
    VERTICAL_SUBTREE_SMOOTH_THRESHOLD_MULTIPLIER: "\u5B50\u6811\u5E73\u6ED1\u538B\u7F29\u89E6\u53D1\u500D\u6570",
    DESC_VERTICAL_SUBTREE_SMOOTH_THRESHOLD_MULTIPLIER: "\u8D85\u8FC7 Gap Y \u4E58\u4EE5\u8BE5\u500D\u6570\u540E\u5F00\u59CB\u5E73\u6ED1\u538B\u7F29\uFF0C\u907F\u514D\u65B0\u589E\u5B50\u8282\u70B9\u95F4\u8DDD\u7A81\u53D8\u3002\u901A\u5E38\u5728\u5927\u5BFC\u56FE\u4E2D\u66F4\u660E\u663E\u3002",
    VERTICAL_SUBTREE_SMOOTH_MIN_SCALE: "\u5B50\u6811\u5E73\u6ED1\u538B\u7F29\u4E0B\u9650",
    DESC_VERTICAL_SUBTREE_SMOOTH_MIN_SCALE: "\u5782\u76F4\u5B50\u6811\u5BBD\u5EA6\u5E73\u6ED1\u538B\u7F29\u5230\u7684\u6700\u5C0F\u503C\u3002\u503C\u8D8A\u5927\u8D8A\u4FDD\u7559\u539F\u5BBD\u5EA6\u3002\u901A\u5E38\u5728\u5927\u5BFC\u56FE\u4E2D\u66F4\u660E\u663E\u3002",
    HORIZONTAL_L1_SOFTCAP_THRESHOLD: "L1 \u6C34\u5E73\u65B9\u5411\u8F6F\u4E0A\u9650",
    DESC_HORIZONTAL_L1_SOFTCAP_THRESHOLD: "\u8D85\u8FC7\u8BE5 px \u503C\u540E\uFF0C\u4E0A/\u4E0B L1 \u5B50\u6811\u5BBD\u5EA6\u5F00\u59CB\u538B\u7F29\u3002\u5BF9\u5927\u5BFC\u56FE\u5F71\u54CD\u7A0B\u5EA6\u4E2D\u5230\u9AD8\u3002",
    HORIZONTAL_L1_COMPRESSION_MIN_SCALE: "L1 \u6C34\u5E73\u65B9\u5411\u538B\u7F29\u4E0B\u9650",
    DESC_HORIZONTAL_L1_COMPRESSION_MIN_SCALE: "\u4E0A/\u4E0B L1 \u5BBD\u5EA6\u538B\u7F29\u5230\u7684\u6700\u5C0F\u503C\u3002\u503C\u8D8A\u5927\u8D8A\u4FDD\u7559\u539F\u5BBD\u5EA6\u3002\u8F6F\u4E0A\u9650\u88AB\u8FBE\u5230\uFF08\u3001\u5F00\u59CB\u538B\u7F29\uFF09\u540E\u5F71\u54CD\u4E2D\u7B49\u3002",
    VERTICAL_COMPACT_PARENT_CHILD_GAP_RATIO: "\u7D27\u51D1\u4EB2\u5B50\u95F4\u8DDD\u6BD4\u4F8B",
    DESC_VERTICAL_COMPACT_PARENT_CHILD_GAP_RATIO: "\u7D27\u51D1\u5782\u76F4\u5B50\u6811\u4E2D\uFF0C\u4EB2\u5B50\u95F4\u8DDD\u4F7F\u7528 Gap X \u4E58\u4EE5\u8BE5\u6BD4\u4F8B\u3002\u6781\u5927\u5F71\u54CD\u89C6\u89C9\u6548\u679C\u3002",
    DIRECTIONAL_CROSS_AXIS_RATIO: "\u6B63\u4EA4\u8F74\u4E4B\u6BD4",
    DESC_DIRECTIONAL_CROSS_AXIS_RATIO: "\u4E0E\u5782\u76F4\u4E8E\u751F\u957F\u65B9\u5411\u7684\u8F74\uFF08Cross-axis\uFF09\u7684\u534A\u5F84\u4E4B\u6BD4\uFF080.2 = \u6241\uFF0C1.0 = \u5706\uFF09\u3002\u6781\u5927\u5F71\u54CD L1 \u5C55\u5F00\u5F62\u6001\u3002",
    MANUAL_GAP_MULTIPLIER: "\u624B\u52A8\u5E03\u5C40\u95F4\u8DDD\u500D\u6570",
    DESC_LAYOUT_MANUAL_GAP: "\u7981\u7528\u81EA\u52A8\u5E03\u5C40\u65F6\u6DFB\u52A0\u8282\u70B9\u7684\u95F4\u8DDD\u500D\u6570\u3002",
    MANUAL_JITTER_RANGE: "\u624B\u52A8\u5E03\u5C40\u6296\u52A8\u8303\u56F4",
    DESC_LAYOUT_MANUAL_JITTER: "\u7981\u7528\u81EA\u52A8\u5E03\u5C40\u65F6\u6DFB\u52A0\u8282\u70B9\u7684\u968F\u673A\u4F4D\u7F6E\u504F\u79FB\u3002",
    CALENDAR_DATE_INDEX: "\u7B2C {index} \u4E2A\u65E5\u671F\uFF0C\u5171 {total} \u4E2A",
    CALENDAR_DATE_LABEL: "\u65E5\u671F",
    CALENDAR_DATE_TYPE: "\u65E5\u671F\u7C7B\u578B",
    CALENDAR_PRIORITY: "\u4F18\u5148\u7EA7",
    CALENDAR_RECURRENCE: "\u91CD\u590D",
    CALENDAR_RECURRENCE_PLACEHOLDER: "every day",
    CALENDAR_RECURRENCE_DESC: `\u4F8B\u5982\uFF0C'every day'\uFF0C'every 2 weeks'<br><a href="https://publish.obsidian.md/tasks/Getting+Started/Recurring+Tasks" target="_blank" tabindex="-1">Tasks \u63D2\u4EF6\u91CD\u590D\u4EFB\u52A1\u6587\u6863</a>`,
    CALENDAR_INJECT_LINK: "\u63D2\u5165\u8282\u70B9\u94FE\u63A5",
    CALENDAR_INJECT_LINK_DESC: "\u5728\u4EFB\u52A1\u672B\u5C3E\u6DFB\u52A0\u6307\u5411\u8BE5\u8282\u70B9\u7684\u94FE\u63A5\u3002",
    CALENDAR_ALIAS_PLACEHOLDER: "\u522B\u540D",
    CALENDAR_BTN_CANCEL: "\u53D6\u6D88",
    CALENDAR_BTN_TASK_ONLY: "\u4EC5\u4EFB\u52A1",
    CALENDAR_BTN_ADD_DATE_TASK: "\u6DFB\u52A0\u65E5\u671F\u548C\u4EFB\u52A1",
    CALENDAR_PRIORITY_HIGHEST: "\u6700\u9AD8",
    CALENDAR_PRIORITY_HIGH: "\u9AD8",
    CALENDAR_PRIORITY_MEDIUM: "\u4E2D",
    CALENDAR_PRIORITY_NORMAL: "\u666E\u901A",
    CALENDAR_PRIORITY_LOW: "\u4F4E",
    CALENDAR_PRIORITY_LOWEST: "\u6700\u4F4E",
    CALENDAR_DATETYPE_DUE: "\u622A\u6B62",
    CALENDAR_DATETYPE_START: "\u5F00\u59CB",
    CALENDAR_DATETYPE_SCHEDULED: "\u8BA1\u5212",
    CALENDAR_DATETYPE_CREATED: "\u521B\u5EFA",
    CALENDAR_DATETYPE_DONE: "\u5B8C\u6210",
    CALENDAR_DATETYPE_CANCELLED: "\u53D6\u6D88",
    // Presets
    PRESET_LABEL: "\u9884\u8BBE",
    PRESET_UNSAVED: "\u81EA\u5B9A\u4E49 / \u672A\u5173\u8054",
    PRESET_BTN_SAVE: "\u4FDD\u5B58\u9884\u8BBE",
    PRESET_BTN_DELETE: "\u5220\u9664\u9884\u8BBE",
    PRESET_BTN_NEW: "\u65B0\u5EFA\u9884\u8BBE",
    PRESET_BTN_APPLY: "\u5E94\u7528\u9884\u8BBE\u5230\u5BFC\u56FE",
    PRESET_WARNING_MODIFIED: "\u5BFC\u56FE\u8BBE\u7F6E\u4E0E\u9884\u8BBE\u4E0D\u7B26\u3002",
    PROMPT_NEW_PRESET_NAME: "\u65B0\u9884\u8BBE\u540D\u79F0\uFF1A",
    NOTICE_PRESET_DELETED: "\u9884\u8BBE\u5DF2\u5220\u9664\u3002",
    NOTICE_PRESET_SAVED: "\u9884\u8BBE\u5DF2\u4FDD\u5B58\u3002",
    NOTICE_PRESET_APPLIED: "\u9884\u8BBE\u5DF2\u5E94\u7528\u3002",
    // Misc
    INPUT_TITLE_PASTE_ROOT: "MindMap Builder \u7C98\u8D34",
    INSTRUCTIONS: "> [!Tip]\n>\u{1F680} \u60F3\u8981\u8FDB\u9636\uFF1F\u6B22\u8FCE\u53C2\u52A0\u5B98\u65B9 [MindMap Builder \u8BFE\u7A0B](https://www.visual-thinking-workshop.com/mindmap)\uFF01\n\n- **ENTER**\uFF1A\u6DFB\u52A0\u5B50\u8282\u70B9\u5E76\u4FDD\u7559\u5728\u5F53\u524D\u4EB2\u4EE3\u8282\u70B9\u4E0A\uFF0C\u65B9\u4FBF\u5FEB\u901F\u8F93\u5165\u3002\u82E5\u8F93\u5165\u6846\u4E3A\u7A7A\u65F6\u6309\u56DE\u8F66\uFF0C\u7126\u70B9\u5C06\u79FB\u52A8\u5230\u6700\u65B0\u6DFB\u52A0\u7684\u5B50\u8282\u70B9\u3002\u8FDE\u7EED\u6309\u56DE\u8F66\u5C06\u5728\u8BE5\u8282\u70B9\u7684\u540C\u7EA7\u8282\u70B9\u95F4\u5FAA\u73AF\u5207\u6362\u3002\n- **\u70ED\u952E**\uFF1A\u89C1\u4FA7\u8FB9\u9762\u677F\u5E95\u90E8\u7684\u914D\u7F6E\u9009\u9879\u3002\n- **\u505C\u9760/\u53D6\u6D88\u505C\u9760**\uFF1A\u4F7F\u7528\u6309\u94AE\u6216\u914D\u7F6E\u597D\u7684\u70ED\u952E\u6765\u5207\u6362\u8F93\u5165\u6846\u4F4D\u7F6E\u3002\n- **\u6298\u53E0**\uFF1A\u4EC5\u5728\u8F93\u5165\u6846\u505C\u9760\u65F6\u663E\u793A\u6309\u94AE\uFF1B\u53D6\u6D88\u505C\u9760\u65F6\u8BF7\u4F7F\u7528\u70ED\u952E\u3002\n- **ESC**\uFF1A\u5C06\u6D6E\u52A8\u8F93\u5165\u6846\u505C\u9760\uFF0C\u4F46\u4E0D\u6FC0\u6D3B\u4FA7\u8FB9\u9762\u677F\u3002\n- **\u7740\u8272**\uFF1A\u9876\u5C42\u5206\u652F\u62E5\u6709\u72EC\u7ACB\u989C\u8272\uFF08\u591A\u8272\u6A21\u5F0F\uFF09\uFF0C\u540E\u4EE3\u8282\u70B9\u7EE7\u627F\u4EB2\u4EE3\u989C\u8272\u3002\n- **\u7F16\u7EC4**\uFF1A\n  - \u542F\u7528\u201C\u5206\u652F\u7F16\u7EC4\u201D\u5C06\u9012\u5F52\u5730\u7F16\u7EC4\u5B50\u6811\uFF0C\u4ECE\u53F6\u8282\u70B9\u5230\u9876\u5C42\u5206\u652F\u3002\n- **\u590D\u5236/\u7C98\u8D34**\uFF1A\u5BFC\u51FA/\u5BFC\u5165\u542B\u7F29\u8FDB\u7684 Markdown \u5217\u8868\u3002\n\n\u{1F60D} \u5982\u679C\u4F60\u89C9\u5F97\u8FD9\u4E2A\u811A\u672C\u6709\u7528\uFF0C\u6B22\u8FCE [\u8BF7\u6211\u559D\u676F\u5496\u5561 \u2615](https://ko-fi.com/zsolt)\u3002"
  };

  // src/scripts/mindmap-builder/lang/zh-tw.ts
  var zhTw = {
    // Notices
    NOTICE_SELECT_NODE_TO_COPY: "\u8ACB\u9078\u64C7\u8981\u8907\u88FD\u7684\u7BC0\u9EDE\u3002",
    NOTICE_MAP_CUT: "\u5C0E\u5716\u5DF2\u526A\u4E0B\u5230\u526A\u8CBC\u7C3F\u3002",
    NOTICE_BRANCH_CUT: "\u5206\u652F\u5DF2\u526A\u4E0B\u5230\u526A\u8CBC\u7C3F\u3002",
    NOTICE_MAP_COPIED: "\u5C0E\u5716\u5DF2\u8907\u88FD\u70BA Markdown \u683C\u5F0F\u3002",
    NOTICE_BRANCH_COPIED: "\u5206\u652F\u5DF2\u8907\u88FD\u70BA\u5217\u8868\u683C\u5F0F\u3002",
    NOTICE_CLIPBOARD_EMPTY: "\u526A\u8CBC\u7C3F\u70BA\u7A7A\u3002",
    NOTICE_PASTE_ABORTED: "\u8CBC\u4E0A\u4E2D\u6B62\u3002\u526A\u8CBC\u7C3F\u5167\u5BB9\u975E Markdown \u5217\u8868\u6216\u6A19\u984C\u3002",
    NOTICE_NO_LIST: "\u526A\u8CBC\u7C3F\u4E2D\u672A\u767C\u73FE\u6709\u6548\u7684 Markdown \u5217\u8868\u3002",
    NOTICE_PASTE_START: "\u6B63\u5728\u8CBC\u4E0A\uFF0C\u8ACB\u7A0D\u5019\uFF0C\u53EF\u80FD\u9700\u8981\u4E00\u4E9B\u6642\u9593\u2026",
    NOTICE_PASTE_COMPLETE: "\u8CBC\u4E0A\u5B8C\u6210\u3002",
    NOTICE_ACTION_REQUIRES_ARROWS: "\u6B64\u64CD\u4F5C\u9700\u8981\u65B9\u5411\u9375\u3002\u50C5\u53EF\u4FEE\u6539\u4FEE\u98FE\u9375\u3002",
    NOTICE_CONFLICT_WITH_ACTION: "\u8207\u201C{action}\u201D\u64CD\u4F5C\u885D\u7A81",
    NOTICE_OBSIDIAN_HOTKEY_CONFLICT: "\u26A0\uFE0F Obsidian \u71B1\u9375\u885D\u7A81\uFF01\n\n\u6B64\u6309\u9375\u5C07\u8986\u84CB\uFF1A\n\u201C{command}\u201D",
    NOTICE_GLOBAL_HOTKEY_CONFLICT: "\u26A0\uFE0F \u5168\u57DF\u6027\u71B1\u9375\u885D\u7A81\uFF01\n\n\u6B64\u6309\u9375\u5C07\u8986\u84CB\uFF1A\n\u201C{command}\u201D",
    NOTICE_NO_HEADINGS: "\u9023\u7D50\u6A94\u6848\u4E2D\u672A\u767C\u73FE\u5C0F\u6A19\u984C\u3002",
    NOTICE_CANNOT_EDIT_MULTILINE: "\u7121\u6CD5\u76F4\u63A5\u7DE8\u8F2F\u591A\u884C\u7BC0\u9EDE\u3002\n\u8ACB\u5728 Excalidraw \u4E2D\u96D9\u64CA\u5143\u7D20\u9032\u884C\u7DE8\u8F2F\uFF0C\u7136\u5F8C\u57F7\u884C\u201C\u81EA\u52D5\u91CD\u6392\u5C0E\u5716\u201D\u4F86\u66F4\u65B0\u4F48\u5C40\u3002",
    NOTICE_CANNOT_MOVE_PINNED: "\u7121\u6CD5\u79FB\u52D5\u5DF2\u9396\u5B9A\u7684\u7BC0\u9EDE\u3002\u8ACB\u5148\u89E3\u9396\u3002",
    NOTICE_CANNOT_MOVE_ROOT: "\u7121\u6CD5\u79FB\u52D5\u6839\u7BC0\u9EDE\u3002",
    NOTICE_CANNOT_PRMOTE_L1: "\u7121\u6CD5\u63D0\u5347 1 \u7D1A\u7BC0\u9EDE\u3002",
    NOTICE_CANNOT_DEMOTE: "\u7121\u6CD5\u964D\u7D1A\u7BC0\u9EDE\u3002\u6C92\u6709\u53EF\u4F9D\u9644\u7684\u524D\u7F6E\u540C\u7D1A\u7BC0\u9EDE\u3002",
    NOTICE_SELECT_NODE_CONTAINING_LINK: "\u8ACB\u9078\u64C7\u5305\u542B\u9023\u7D50\u7684\u7BC0\u9EDE\u3002",
    NOTICE_CANNOT_DEMOTE_NO_SIBLING_TO_ACCEPT: "\u7121\u6CD5\u964D\u7D1A\uFF1A\u672A\u627E\u5230\u53EF\u63A5\u6536\u6B64\u7BC0\u9EDE\u7684\u540C\u7D1A\u7BC0\u9EDE\u3002",
    NOTICE_CANNOT_DEMOTE_NO_VALID_SIBLING: "\u7121\u6CD5\u964D\u7D1A\uFF1A\u6C92\u6709\u53EF\u9644\u52A0\u7684\u6709\u6548\u540C\u7D1A\u7BC0\u9EDE\u3002",
    NOTICE_CANNOT_DEMOTE_CROSS_SIDE_NOT_ALLOWED: "\u7121\u6CD5\u964D\u7D1A\uFF1A\u4E0D\u5141\u8A31\u8DE8\u5074\u964D\u7D1A\u3002",
    NOTICE_CANNOT_MOVE_AUTO_LAYOUT_DISABLED: "\u505C\u7528\u81EA\u52D5\u4F48\u5C40\u6642\u7121\u6CD5\u79FB\u52D5\u7BC0\u9EDE\u3002\u8ACB\u5148\u555F\u7528\u81EA\u52D5\u4F48\u5C40\u3002",
    NOTICE_BRANCH_WIDTH_MANUAL_OVERRIDE: "\u5206\u652F\u7C97\u7D30\u672A\u66F4\u65B0\uFF0C\u56E0\u70BA\u90E8\u5206\u5206\u652F\u7C97\u7D30\u5DF2\u88AB\u624B\u52D5\u4FEE\u6539\u3002",
    NOTICE_CANNOT_CHANGE_MASTER_ROOT: "\u4E3B\u6839\u7BC0\u9EDE\u4E0D\u80FD\u88AB\u8F49\u63DB\u3002",
    NOTICE_SUBMAP_ROOT_ADDED: "\u5DF2\u555F\u7528\u5B50\u5716\u6839\u7BC0\u9EDE\u3002",
    NOTICE_SUBMAP_ROOT_REMOVED: "\u5DF2\u79FB\u9664\u5B50\u5716\u6839\u7BC0\u9EDE\u3002\u5176\u5B50\u7BC0\u9EDE\u5C07\u6309\u89AA\u4EE3\u6839\u7BC0\u9EDE\u4F48\u5C40\u91CD\u6392\u3002",
    CONFIRM_REMOVE_SUBMAP_ROOT: "\u6062\u5FA9\u70BA\u666E\u901A\u7BC0\u9EDE\u55CE\uFF1F\n\n\u5B83\u5C07\u5931\u53BB\u672C\u5730\u4F48\u5C40\u5143\u8CC7\u6599\uFF0C\u5176\u5B50\u7BC0\u9EDE\u5C07\u6309\u89AA\u4EE3\u6839\u7BC0\u9EDE\u4F48\u5C40\u91CD\u6392\u3002",
    // Action labels (display only)
    ACTION_LABEL_ADD: "\u65B0\u589E\u5B50\u7BC0\u9EDE",
    ACTION_LABEL_ADD_SIBLING_AFTER: "\u65B0\u589E\u5F8C\u7F6E\u540C\u7D1A\u7BC0\u9EDE",
    ACTION_LABEL_ADD_SIBLING_BEFORE: "\u65B0\u589E\u524D\u7F6E\u540C\u7D1A\u7BC0\u9EDE",
    ACTION_LABEL_ADD_FOLLOW: "\u65B0\u589E + \u8DDF\u96A8",
    ACTION_LABEL_ADD_FOLLOW_FOCUS: "\u65B0\u589E + \u8DDF\u96A8 + \u805A\u7126",
    ACTION_LABEL_ADD_FOLLOW_ZOOM: "\u65B0\u589E + \u8DDF\u96A8 + \u7E2E\u653E",
    ACTION_LABEL_SORT_ORDER: "\u66F4\u6539\u9806\u5E8F/\u63D0\u5347\u7BC0\u9EDE",
    ACTION_LABEL_EDIT: "\u7DE8\u8F2F\u7BC0\u9EDE",
    ACTION_LABEL_PIN: "\u9396\u5B9A/\u89E3\u9396",
    ACTION_LABEL_BOX: "\u65B0\u589E/\u79FB\u9664\u908A\u6846",
    ACTION_LABEL_TOGGLE_GROUP: "\u7DE8\u7D44/\u89E3\u9664\u7DE8\u7D44\u55AE\u5206\u652F",
    ACTION_LABEL_COPY: "\u8907\u88FD",
    ACTION_LABEL_CUT: "\u526A\u4E0B",
    ACTION_LABEL_PASTE: "\u8CBC\u4E0A",
    ACTION_LABEL_IMPORT_OUTLINE: "\u532F\u5165\u5927\u7DB1",
    ACTION_LABEL_ZOOM: "\u8FF4\u5708\u7E2E\u653E",
    ACTION_LABEL_FOCUS: "\u805A\u7126\uFF08\u4E26\u5C45\u4E2D\uFF09\u7BC0\u9EDE",
    ACTION_LABEL_NAVIGATE: "\u5C0E\u822A",
    ACTION_LABEL_NAVIGATE_ZOOM: "\u5C0E\u822A & \u7E2E\u653E",
    ACTION_LABEL_NAVIGATE_FOCUS: "\u5C0E\u822A & \u805A\u7126",
    ACTION_LABEL_FOLD: "\u647A\u758A/\u5C55\u958B\u5206\u652F",
    ACTION_LABEL_FOLD_L1: "\u647A\u758A/\u5C55\u958B L1 \u5B50\u7BC0\u9EDE",
    ACTION_LABEL_FOLD_ALL: "\u905E\u8FF4\u647A\u758A/\u5C55\u958B\u5206\u652F",
    ACTION_LABEL_DOCK_UNDOCK: "\u505C\u9760/\u53D6\u6D88\u505C\u9760",
    ACTION_LABEL_HIDE: "\u505C\u9760 & \u96B1\u85CF",
    ACTION_LABEL_REARRANGE: "\u91CD\u6392\u5C0E\u5716",
    ACTION_LABEL_TOGGLE_SUBMAP_ROOT: "\u958B\u59CB/\u7D50\u675F\u5B50\u5716\u6839\u7BC0\u9EDE",
    ACTION_LABEL_TOGGLE_CHECKBOX: "\u5207\u63DB\u8907\u9078\u6846\u72C0\u614B",
    ACTION_LABEL_CALENDAR: "\u4EFB\u52D9\u65E5\u66C6\u8207\u512A\u5148\u7D1A",
    ACTION_LABEL_TOGGLE_EMBED: "\u5207\u63DB\u5D4C\u5165/\u9023\u7D50",
    // Tooltips (shared)
    PIN_TOOLTIP_PINNED: "\u6B64\u5143\u7D20\u5DF2\u9396\u5B9A\u3002\u9EDE\u9078\u89E3\u9396\u6240\u9078\u5143\u7D20\u7684\u4F4D\u7F6E\u3002",
    PIN_TOOLTIP_UNPINNED: "\u6B64\u5143\u7D20\u672A\u9396\u5B9A\u3002\u9EDE\u9078\u9396\u5B9A\u6240\u9078\u5143\u7D20\u7684\u4F4D\u7F6E\u3002",
    TOGGLE_GROUP_TOOLTIP_GROUP: "\u7DE8\u7D44\u6B64\u5206\u652F\u3002\u50C5\u5728\u201C\u5206\u652F\u7DE8\u7D44\u201D\u505C\u7528\u6642\u53EF\u7528\u3002",
    TOGGLE_GROUP_TOOLTIP_UNGROUP: "\u89E3\u9664\u7DE8\u7D44\u6B64\u5206\u652F\u3002\u50C5\u5728\u201C\u5206\u652F\u7DE8\u7D44\u201D\u505C\u7528\u6642\u53EF\u7528\u3002",
    TOOLTIP_EDIT_NODE: "\u7DE8\u8F2F\u6240\u9078\u7BC0\u9EDE\u7684\u6587\u5B57",
    TOOLTIP_PIN_INIT: "\u9396\u5B9A/\u89E3\u9396\u7BC0\u9EDE\u4F4D\u7F6E\u3002\u9396\u5B9A\u7684\u7BC0\u9EDE\u4E0D\u6703\u88AB\u81EA\u52D5\u91CD\u6392\u3002",
    TOOLTIP_REFRESH: "\u81EA\u52D5\u91CD\u6392\u5C0E\u5716",
    TOOLTIP_DOCK: "\u505C\u9760\u5230\u5074\u908A\u9762\u677F",
    TOOLTIP_UNDOCK: "\u8F49\u70BA\u6D6E\u52D5\u8996\u7A97",
    TOOLTIP_ZOOM_CYCLE: "\u8FF4\u5708\u5207\u63DB\u5143\u7D20\u7E2E\u653E\u7D1A\u5225",
    TOOLTIP_TOGGLE_GROUP_BTN: "\u5207\u63DB\u5206\u652F\u7684\u7DE8\u7D44\u72C0\u614B\u3002\u50C5\u5728\u201C\u5206\u652F\u7DE8\u7D44\u201D\u505C\u7528\u6642\u53EF\u7528\u3002",
    TOOLTIP_TOGGLE_BOX: "\u5207\u63DB\u7BC0\u9EDE\u908A\u6846",
    TOOLTIP_TOGGLE_BOUNDARY: "\u5207\u63DB\u5B50\u6A39\u908A\u754C",
    TOOLTIP_TOGGLE_FLOATING_EXTRAS: "\u5207\u63DB\u984D\u5916\u63A7\u5236\u5143\u4EF6",
    TOOLTIP_CONFIGURE_PALETTE: "\u70BA\u5206\u652F\u914D\u7F6E\u81EA\u5B9A\u7FA9\u8ABF\u8272\u76E4",
    TOOLTIP_CONFIGURE_LAYOUT: "\u914D\u7F6E\u4F48\u5C40\u8A2D\u5B9A",
    TOOLTIP_MOVE_UP: "\u4E0A\u79FB",
    TOOLTIP_MOVE_DOWN: "\u4E0B\u79FB",
    TOOLTIP_EDIT_COLOR: "\u7DE8\u8F2F",
    TOOLTIP_DELETE_COLOR: "\u522A\u9664",
    TOOLTIP_OPEN_PALETTE_PICKER: "\u958B\u555F\u984F\u8272\u9078\u64C7\u5668",
    TOOLTIP_FOLD_BRANCH: "\u647A\u758A/\u5C55\u958B\u6240\u9078\u5206\u652F",
    TOOLTIP_FOLD_L1_BRANCH: "\u647A\u758A/\u5C55\u958B L1 \u5B50\u7BC0\u9EDE",
    TOOLTIP_FOLD_ALL: "\u905E\u8FF4\u647A\u758A/\u5C55\u958B\u5206\u652F",
    TOOLTIP_IMPORT_OUTLINE: "\u5F9E\u9023\u7D50\u6A94\u6848\u4E2D\u532F\u5165\u5C0F\u6A19\u984C\u4F5C\u70BA\u5B50\u7BC0\u9EDE\u8CC7\u6599",
    TOOLTIP_RESET_TO_DEFAULT: "\u6062\u5FA9\u9810\u8A2D",
    TOOLTIP_SUBMAP_ROOT_ADD: "\u5F9E\u6240\u9078\u7BC0\u9EDE\u958B\u59CB\u5B50\u5716",
    TOOLTIP_SUBMAP_ROOT_REMOVE: "\u5C07\u5B50\u5716\u6839\u7BC0\u9EDE\u6062\u5FA9\u70BA\u666E\u901A\u7BC0\u9EDE",
    TOOLTIP_TOGGLE_CHECKBOX: "\u5207\u63DB\u4EFB\u52D9\u8907\u9078\u6846\u72C0\u614B",
    TOOLTIP_CALENDAR: "\u914D\u7F6E\u4EFB\u52D9\u65E5\u671F\u8207\u512A\u5148\u7D1A",
    TOOLTIP_TOGGLE_EMBED: "\u5728\u5D4C\u5165\u548C\u9023\u7D50\u4E4B\u9593\u5207\u63DB\u7BC0\u9EDE",
    // Buttons and labels
    DOCK_TITLE: "MindMap Builder",
    HELP_SUMMARY: "\u5E6B\u52A9",
    INPUT_PLACEHOLDER: "\u8F38\u5165\u6982\u5FF5\u2026 \u8F38\u5165 [[ \u63D2\u5165\u9023\u7D50",
    ONTOLOGY_PLACEHOLDER: "\u672C\u9AD4\uFF08\u7BAD\u982D\u6A19\u7C64\uFF09",
    BUTTON_COPY: "\u8907\u88FD",
    BUTTON_CUT: "\u526A\u4E0B",
    BUTTON_PASTE: "\u8CBC\u4E0A",
    TITLE_ADD_SIBLING: `\u4F7F\u7528 {modifier}+Enter \u65B0\u589E\u540C\u7D1A\u7BC0\u9EDE`,
    TITLE_ADD_FOLLOW: "\u65B0\u589E\u4E26\u8DDF\u96A8",
    TITLE_COPY: "\u8907\u88FD\u5206\u652F\u70BA\u6587\u5B57",
    TITLE_CUT: "\u526A\u4E0B\u5206\u652F\u70BA\u6587\u5B57",
    TITLE_PASTE: "\u5F9E\u526A\u8CBC\u7C3F\u8CBC\u4E0A\u5217\u8868",
    LABEL_ZOOM_LEVEL: "\u7E2E\u653E\u7D1A\u5225",
    LABEL_GROWTH_STRATEGY: "\u751F\u9577\u7B56\u7565",
    LABEL_FILL_SWEEP: "\u586B\u5145\u6383\u904E\u89D2\u5EA6",
    DESC_FILL_SWEEP: "\u7ACB\u5373\u5728\u6574\u500B\u201C\u6700\u5927\u6383\u904E\u89D2\u5EA6\u201D\u7BC4\u570D\u5167\u5206\u4F48\u7BC0\u9EDE\uFF0C\u800C\u4E0D\u662F\u96A8\u8457\u7BC0\u9EDE\u6578\u91CF\u589E\u52A0\u9010\u6F38\u64F4\u5927\u5F27\u5EA6\u3002",
    LABEL_ARROW_TYPE: "\u66F2\u7DDA\u9023\u7DDA",
    LABEL_AUTO_LAYOUT: "\u81EA\u52D5\u4F48\u5C40",
    LABEL_GROUP_BRANCHES: "\u5206\u652F\u7DE8\u7D44",
    LABEL_BOX_CHILD_NODES: "\u70BA\u5B50\u7BC0\u9EDE\u65B0\u589E\u908A\u6846",
    LABEL_ROUNDED_CORNERS: "\u5713\u89D2",
    LABEL_USE_SCENE_STROKE: "\u4F7F\u7528\u5834\u666F\u7DDA\u689D\u6A23\u5F0F",
    DESC_USE_SCENE_STROKE: "\u4F7F\u7528\u5834\u666F\u4E2D\u6700\u65B0\u7684\u7DDA\u689D\u6A23\u5F0F\uFF08\u5BE6\u7DDA\u3001\u865B\u7DDA\u3001\u9EDE\u7DDA\uFF09\uFF0C\u5426\u5247\u5206\u652F\u5C07\u59CB\u7D42\u4F7F\u7528\u5BE6\u7DDA\u3002",
    LABEL_BRANCH_SCALE: "\u5206\u652F\u7C97\u7D30\u6BD4\u4F8B",
    LABEL_BASE_WIDTH: "\u57FA\u790E\u7C97\u7D30",
    LABEL_MULTICOLOR_BRANCHES: "\u591A\u8272\u5206\u652F",
    LABEL_MAX_WRAP_WIDTH: "\u6700\u5927\u6298\u884C\u5BEC\u5EA6",
    LABEL_CENTER_TEXT: "\u6587\u5B57\u5C45\u4E2D",
    DESC_CENTER_TEXT: "\u95DC\u9589\uFF1A\u6839\u64DA\u4F4D\u7F6E\u5DE6/\u53F3\u5C0D\u9F4A\uFF1B\u958B\u555F\uFF1A\u6587\u5B57\u5F37\u5236\u5C45\u4E2D\u3002",
    LABEL_FONT_SIZES: "\u5B57\u578B\u5927\u5C0F",
    HOTKEY_SECTION_TITLE: "\u71B1\u9375\u914D\u7F6E",
    HOTKEY_HINT: "\u9019\u4E9B\u71B1\u9375\u53EF\u80FD\u8986\u84CB Obsidian \u9810\u8A2D\u8A2D\u5B9A\u3002\u71B1\u9375\u4F5C\u7528\u57DF\u9810\u8A2D\u70BA\u5340\u57DF\u6027\uFF08\u2328\uFE0F\uFF09\uFF0C\u4F7F\u7528 \u{1F310}/\u{1F3A8}/\u2328\uFE0F \u5207\u63DB\u4F5C\u7528\u57DF\uFF1A\u{1F310} Excalidraw \u6A19\u7C64\u9801\u53EF\u898B\u5373\u751F\u6548\uFF0C\u{1F3A8} Excalidraw \u805A\u7126\u6642\u751F\u6548\uFF0C\u2328\uFE0F \u8F38\u5165\u6846\u805A\u7126\u6642\u751F\u6548\u3002",
    RECORD_HOTKEY_PROMPT: "\u6309\u4E0B\u71B1\u9375\u2026",
    ARIA_SCOPE_INPUT: "\u5340\u57DF\u6027\uFF08Local\uFF09\uFF1A\u50C5\u5728\u8F38\u5165\u6846\u805A\u7126\u6642\u751F\u6548",
    ARIA_SCOPE_EXCALIDRAW: "Excalidraw\uFF1A\u8F38\u5165\u6846\u6216 Excalidraw \u805A\u7126\u6642\u751F\u6548",
    ARIA_SCOPE_GLOBAL: "\u5168\u57DF\u6027\uFF08Global\uFF09\uFF1A\u5728 Obsidian \u4EFB\u4F55\u4F4D\u7F6E\uFF0CExcalidraw \u53EF\u898B\u5373\u751F\u6548",
    ARIA_RESTORE_DEFAULT: "\u6062\u5FA9\u9810\u8A2D",
    ARIA_CUSTOMIZE_HOTKEY: "\u81EA\u5B9A\u7FA9\u6B64\u71B1\u9375",
    ARIA_OVERRIDE_COMMAND: "\u5C07\u8986\u84CB Obsidian \u547D\u4EE4\uFF1A\n{command}",
    // Palette manager
    MODAL_PALETTE_TITLE: "\u5C0E\u5716\u5206\u652F\u8ABF\u8272\u76E4",
    LABEL_ENABLE_CUSTOM_PALETTE: "\u555F\u7528\u81EA\u5B9A\u7FA9\u8ABF\u8272\u76E4",
    DESC_ENABLE_CUSTOM_PALETTE: "\u4F7F\u7528\u4EE5\u4E0B\u984F\u8272\u4EE3\u66FF\u81EA\u52D5\u751F\u6210\u7684\u984F\u8272\u3002",
    LABEL_RANDOMIZE_ORDER: "\u96A8\u6A5F\u9806\u5E8F",
    DESC_RANDOMIZE_ORDER: "\u96A8\u6A5F\u9078\u64C7\u984F\u8272\u800C\u975E\u6309\u9806\u5E8F\u9078\u64C7\u3002",
    HEADING_ADD_NEW_COLOR: "\u65B0\u589E\u65B0\u984F\u8272",
    HEADING_EDIT_COLOR: "\u7DE8\u8F2F\u984F\u8272",
    LABEL_SELECT_COLOR: "\u9078\u64C7\u984F\u8272",
    BUTTON_CANCEL_EDIT: "\u53D6\u6D88\u7DE8\u8F2F",
    BUTTON_ADD_COLOR: "\u65B0\u589E\u984F\u8272",
    BUTTON_UPDATE_COLOR: "\u66F4\u65B0\u984F\u8272",
    // Layout configuration
    MODAL_LAYOUT_TITLE: "\u4F48\u5C40\u914D\u7F6E",
    // Section Headers
    SECTION_GENERAL: "\u5E38\u898F\u9593\u8DDD",
    SECTION_RADIAL: "\u5F91\u5411\u4F48\u5C40\uFF08\u9806\u6642\u91DD\uFF09",
    SECTION_DIRECTIONAL: "\u5B9A\u5411\u4F48\u5C40\uFF08\u5DE6/\u53F3\uFF09",
    SECTION_VERTICAL: "\u5782\u76F4\u5C0E\u5716\uFF08\u4E0A/\u4E0B\uFF09",
    SECTION_VISUALS: "\u8996\u89BA\u5143\u7D20",
    SECTION_MANUAL: "\u624B\u52D5\u6A21\u5F0F\u884C\u70BA",
    LAYOUT_RESET: "\u91CD\u7F6E\u6240\u6709\u70BA\u9810\u8A2D\u503C",
    LAYOUT_SAVE: "\u5132\u5B58\u4E26\u95DC\u9589",
    // Radial Strings
    RADIAL_ASPECT_RATIO: "\u6A62\u5713\u9577\u5BEC\u6BD4",
    DESC_RADIAL_ASPECT_RATIO: "\u63A7\u5236\u5F62\u72C0\u3002< 1.0 \u70BA\u7626\u9577\uFF080.7 \u70BA\u7E31\u5411\uFF09\uFF0C1.0 \u70BA\u6B63\u5713\uFF0C> 1.0 \u70BA\u5BEC\u6241\uFF08\u6A6B\u5411\uFF09\u3002",
    RADIAL_POLE_GAP_BONUS: "\u6975\u9EDE\u9593\u8DDD\u88DC\u511F",
    DESC_RADIAL_POLE_GAP_BONUS: "\u589E\u52A0\u6A62\u5713\u5357\u5317\u5169\u6975\u5340\u57DF\u5167\u7BC0\u9EDE\u7684\u9593\u8DDD\u3002\u503C\u8D8A\u5927\uFF0C\u7BC0\u9EDE\u6CBF\u5F27\u7DDA\u63A8\u5F97\u8D8A\u9060\u3002",
    RADIAL_START_ANGLE: "\u8D77\u59CB\u89D2\u5EA6",
    DESC_RADIAL_START_ANGLE: "\u7B2C\u4E00\u500B\u7BC0\u9EDE\u51FA\u73FE\u7684\u4F4D\u7F6E\uFF08\u5EA6\u6578\uFF09\u3002270 \u70BA\u5317\uFF0C0 \u70BA\u6771\uFF0C90 \u70BA\u5357\u3002",
    RADIAL_MAX_SWEEP: "\u6700\u5927\u6383\u904E\u89D2\u5EA6",
    DESC_RADIAL_MAX_SWEEP: "\u5206\u652F\u53EF\u586B\u5145\u7684\u5F27\u7BC4\u570D\u3002360 \u70BA\u5168\u5713\u3002\u8F03\u5C0F\u7684\u503C\u6703\u4F7F\u5713\u4E0D\u5B8C\u6574\u3002",
    // Others
    GAP_X: "\u6C34\u5E73\u9593\u8DDD\uFF08Gap X\uFF09",
    DESC_LAYOUT_GAP_X: "\u89AA\u4EE3\u7BC0\u9EDE\u8207\u5B50\u7BC0\u9EDE\u4E4B\u9593\u7684\u6C34\u5E73\u8DDD\u96E2\u3002",
    GAP_Y: "\u5782\u76F4\u9593\u8DDD\uFF08Gap Y\uFF09",
    DESC_LAYOUT_GAP_Y: "\u540C\u7D1A\u7BC0\u9EDE\u4E4B\u9593\u7684\u5782\u76F4\u8DDD\u96E2\u3002\u5F91\u5411\u4F48\u5C40\u4E2D\u7684\u57FA\u790E\u9593\u8DDD\u3002",
    GAP_MULTIPLIER: "\u9593\u8DDD\u500D\u6578",
    DESC_LAYOUT_GAP_MULTIPLIER: "\u8449\u7BC0\u9EDE\uFF08\u7121\u5B50\u7BC0\u9EDE\u7684\u7BC0\u9EDE\uFF09\u76F8\u5C0D\u65BC\u5B57\u578B\u5927\u5C0F\u7684\u5782\u76F4\u9593\u8DDD\u3002\u4F4E\uFF1A\u985E\u4F3C\u5217\u8868\u5806\u758A\uFF1B\u9AD8\uFF1A\u6A19\u6E96\u6A39\u72C0\u9593\u8DDD\u3002",
    DIRECTIONAL_ARC_SPAN_RADIANS: "\u5B9A\u5411\u5F35\u958B\u5F27\u5EA6\uFF08Arc-span Radians\uFF09",
    DESC_LAYOUT_ARC_SPAN: "\u5B50\u7BC0\u9EDE\u6392\u5217\u7684\u66F2\u7387\u3002\u4F4E\uFF080.5\uFF09\uFF1A\u8F03\u5E73\uFF0C\u985E\u4F3C\u5217\u8868\u3002\u9AD8\uFF082.0\uFF09\uFF1A\u5F4E\u66F2\u6709\u6A5F\uFF0C\u4F46\u6709\u91CD\u758A\u98A8\u96AA\u3002",
    ROOT_RADIUS_FACTOR: "\u6839\u7BC0\u9EDE\u534A\u5F91\u4FC2\u6578",
    DESC_LAYOUT_ROOT_RADIUS: "\u76F8\u5C0D\u65BC\u6839\u7BC0\u9EDE\u908A\u6846\u7684\u500D\u6578\uFF0C\u6C7A\u5B9A\u6700\u521D\u7684\u534A\u5F91\u3002",
    MIN_RADIUS: "\u6700\u5C0F\u534A\u5F91",
    DESC_LAYOUT_MIN_RADIUS: "\u5F9E\u6839\u7BC0\u9EDE\u4E2D\u5FC3\u5230\u7B2C\u4E00\u7D1A\u7BC0\u9EDE\u7684\u6700\u5C0F\u7D55\u5C0D\u8DDD\u96E2\u3002",
    RADIUS_PADDING_PER_NODE: "\u55AE\u7BC0\u9EDE\u5F91\u5411\u7A7A\u767D\u908A\u8DDD",
    DESC_LAYOUT_RADIUS_PADDING: "\u6BCF\u500B\u5B50\u7BC0\u9EDE\u984D\u5916\u589E\u52A0\u7684\u534A\u5F91\uFF0C\u4EE5\u9069\u61C9\u5BC6\u96C6\u578B\u5C0E\u5716\u3002",
    GAP_MULTIPLIER_RADIAL: "\u5F91\u5411\u4F48\u5C40\u9593\u8DDD\u500D\u6578",
    DESC_LAYOUT_GAP_RADIAL: "\u5F91\u5411\u4F48\u5C40\u6A21\u5F0F\u4E0B\u7684\u89D2\u5EA6\u9593\u8DDD\u500D\u6578\u3002",
    GAP_MULTIPLIER_DIRECTIONAL: "\u5782\u76F4\u65B9\u5411\u9593\u8DDD\u500D\u6578",
    DESC_LAYOUT_GAP_DIRECTIONAL: "\u5B9A\u5411\u4F48\u5C40\u9802\u5C64\u5206\u652F\u4E4B\u9593\u7684\u9593\u8DDD\u500D\u6578\u3002",
    INDICATOR_OFFSET: "\u647A\u758A\u6307\u793A\u7B26\u504F\u79FB",
    DESC_LAYOUT_INDICATOR_OFFSET: "\u647A\u758A\u6307\u793A\u7B26\uFF08\u4E09\u9023\u9EDE\uFF09\u8DDD\u96E2\u7BC0\u9EDE\u7684\u8DDD\u96E2\u3002",
    INDICATOR_OPACITY: "\u647A\u758A\u6307\u793A\u7B26\u4E0D\u900F\u660E\u5EA6",
    DESC_LAYOUT_INDICATOR_OPACITY: "\u647A\u758A\u6307\u793A\u7B26\u7684\u4E0D\u900F\u660E\u5EA6\uFF080-100\uFF09\u3002",
    CONTAINER_PADDING: "\u5BB9\u5668\u5167\u908A\u8DDD",
    DESC_LAYOUT_CONTAINER_PADDING: "\u4F7F\u7528\u908A\u6846\u6A23\u5F0F\u6642\u7684\u5167\u908A\u8DDD\u3002",
    MAX_SEGMENT_LENGTH: "\u908A\u754C\u7DDA\u7CBE\u5EA6",
    DESC_LAYOUT_BOUNDARY_LINE_PRECISION: "\u908A\u754C\u5E73\u6ED1\u7CBE\u5EA6\u3002\u503C\u8D8A\u5C0F\u8D8A\u7CBE\u7D30\uFF0830 = \u7CBE\u7D30\uFF09\uFF0C\u503C\u8D8A\u5927\u8D8A\u7C97\u7565\uFF08200 = \u7C97\u7565\uFF09\u3002",
    VERTICAL_SUBTREE_WIDTH_BLEND_SINGLE: "\u5B50\u6A39\u5BEC\u5EA6\u53C3\u8207\u5EA6\uFF08\u55AE\u5074\uFF09",
    DESC_VERTICAL_SUBTREE_WIDTH_BLEND_SINGLE: "\u5782\u76F4\u5C0E\u5716\u4E2D\uFF0C\u55AE\u5074\u751F\u9577\u7684\u5B50\u5716\u4F54\u7528\uFF08\u5DE6/\u53F3\uFF09\u6C34\u5E73\u7A7A\u9593\u7684\u5F37\u5EA6\u3002\u5F71\u97FF\u7A0B\u5EA6\u9AD8\u3002",
    VERTICAL_SUBTREE_WIDTH_BLEND_DUAL: "\u5B50\u6A39\u5BEC\u5EA6\u53C3\u8207\u5EA6\uFF08\u96D9\u5074\uFF09",
    DESC_VERTICAL_SUBTREE_WIDTH_BLEND_DUAL: "\u5782\u76F4\u5C0E\u5716\u4E2D\uFF0C\u96D9\u5074\u751F\u9577\u7684\u5B50\u5716\u4F54\u7528\uFF08\u5DE6\u53F3\uFF09\u6C34\u5E73\u7A7A\u9593\u7684\u5F37\u5EA6\u3002\u5F71\u97FF\u7A0B\u5EA6\u9AD8\u3002",
    VERTICAL_SUBTREE_SMOOTH_THRESHOLD_MULTIPLIER: "\u5B50\u6A39\u5E73\u6ED1\u58D3\u7E2E\u89F8\u767C\u500D\u6578",
    DESC_VERTICAL_SUBTREE_SMOOTH_THRESHOLD_MULTIPLIER: "\u8D85\u904E Gap Y \u4E58\u4EE5\u8A72\u500D\u6578\u5F8C\u958B\u59CB\u5E73\u6ED1\u58D3\u7E2E\uFF0C\u907F\u514D\u65B0\u589E\u5B50\u7BC0\u9EDE\u9593\u8DDD\u7A81\u8B8A\u3002\u901A\u5E38\u5728\u5927\u5C0E\u5716\u4E2D\u66F4\u660E\u986F\u3002",
    VERTICAL_SUBTREE_SMOOTH_MIN_SCALE: "\u5B50\u6A39\u5E73\u6ED1\u58D3\u7E2E\u4E0B\u9650",
    DESC_VERTICAL_SUBTREE_SMOOTH_MIN_SCALE: "\u5782\u76F4\u5B50\u6A39\u5BEC\u5EA6\u5E73\u6ED1\u58D3\u7E2E\u5230\u7684\u6700\u5C0F\u503C\u3002\u503C\u8D8A\u5927\u8D8A\u4FDD\u7559\u539F\u5BEC\u5EA6\u3002\u901A\u5E38\u5728\u5927\u5C0E\u5716\u4E2D\u66F4\u660E\u986F\u3002",
    HORIZONTAL_L1_SOFTCAP_THRESHOLD: "L1 \u6C34\u5E73\u65B9\u5411\u8EDF\u4E0A\u9650",
    DESC_HORIZONTAL_L1_SOFTCAP_THRESHOLD: "\u8D85\u904E\u8A72 px \u503C\u5F8C\uFF0C\u4E0A/\u4E0B L1 \u5B50\u6A39\u5BEC\u5EA6\u958B\u59CB\u58D3\u7E2E\u3002\u5C0D\u5927\u5C0E\u5716\u5F71\u97FF\u7A0B\u5EA6\u4E2D\u5230\u9AD8\u3002",
    HORIZONTAL_L1_COMPRESSION_MIN_SCALE: "L1 \u6C34\u5E73\u65B9\u5411\u58D3\u7E2E\u4E0B\u9650",
    DESC_HORIZONTAL_L1_COMPRESSION_MIN_SCALE: "\u4E0A/\u4E0B L1 \u5BEC\u5EA6\u58D3\u7E2E\u5230\u7684\u6700\u5C0F\u503C\u3002\u503C\u8D8A\u5927\u8D8A\u4FDD\u7559\u539F\u5BEC\u5EA6\u3002\u8EDF\u4E0A\u9650\u88AB\u9054\u5230\uFF08\u3001\u958B\u59CB\u58D3\u7E2E\uFF09\u5F8C\u5F71\u97FF\u4E2D\u7B49\u3002",
    VERTICAL_COMPACT_PARENT_CHILD_GAP_RATIO: "\u7DCA\u6E4A\u89AA\u5B50\u9593\u8DDD\u6BD4\u4F8B",
    DESC_VERTICAL_COMPACT_PARENT_CHILD_GAP_RATIO: "\u7DCA\u6E4A\u5782\u76F4\u5B50\u6A39\u4E2D\uFF0C\u89AA\u5B50\u9593\u8DDD\u4F7F\u7528 Gap X \u4E58\u4EE5\u8A72\u6BD4\u4F8B\u3002\u6975\u5927\u5F71\u97FF\u8996\u89BA\u6548\u679C\u3002",
    DIRECTIONAL_CROSS_AXIS_RATIO: "\u6B63\u4EA4\u8EF8\u4E4B\u6BD4",
    DESC_DIRECTIONAL_CROSS_AXIS_RATIO: "\u8207\u5782\u76F4\u65BC\u751F\u9577\u65B9\u5411\u7684\u8EF8\uFF08Cross-axis\uFF09\u7684\u534A\u5F91\u4E4B\u6BD4\uFF080.2 = \u6241\uFF0C1.0 = \u5713\uFF09\u3002\u6975\u5927\u5F71\u97FF L1 \u5C55\u958B\u5F62\u614B\u3002",
    MANUAL_GAP_MULTIPLIER: "\u624B\u52D5\u4F48\u5C40\u9593\u8DDD\u500D\u6578",
    DESC_LAYOUT_MANUAL_GAP: "\u505C\u7528\u81EA\u52D5\u4F48\u5C40\u6642\u65B0\u589E\u7BC0\u9EDE\u7684\u9593\u8DDD\u500D\u6578\u3002",
    MANUAL_JITTER_RANGE: "\u624B\u52D5\u4F48\u5C40\u6296\u52D5\u7BC4\u570D",
    DESC_LAYOUT_MANUAL_JITTER: "\u505C\u7528\u81EA\u52D5\u4F48\u5C40\u6642\u65B0\u589E\u7BC0\u9EDE\u7684\u96A8\u6A5F\u4F4D\u7F6E\u504F\u79FB\u3002",
    CALENDAR_DATE_INDEX: "\u7B2C {index} \u500B\u65E5\u671F\uFF0C\u5171 {total} \u500B",
    CALENDAR_DATE_LABEL: "\u65E5\u671F",
    CALENDAR_DATE_TYPE: "\u65E5\u671F\u985E\u578B",
    CALENDAR_PRIORITY: "\u512A\u5148\u7D1A",
    CALENDAR_RECURRENCE: "\u91CD\u8907",
    CALENDAR_RECURRENCE_PLACEHOLDER: "every day",
    CALENDAR_RECURRENCE_DESC: `\u4F8B\u5982\uFF0C'every day'\uFF0C'every 2 weeks'<br><a href="https://publish.obsidian.md/tasks/Getting+Started/Recurring+Tasks" target="_blank" tabindex="-1">Tasks \u5916\u639B\u91CD\u8907\u4EFB\u52D9\u6587\u4EF6</a>`,
    CALENDAR_INJECT_LINK: "\u63D2\u5165\u7BC0\u9EDE\u9023\u7D50",
    CALENDAR_INJECT_LINK_DESC: "\u5728\u4EFB\u52D9\u672B\u5C3E\u65B0\u589E\u6307\u5411\u8A72\u7BC0\u9EDE\u7684\u9023\u7D50\u3002",
    CALENDAR_ALIAS_PLACEHOLDER: "\u5225\u540D",
    CALENDAR_BTN_CANCEL: "\u53D6\u6D88",
    CALENDAR_BTN_TASK_ONLY: "\u50C5\u4EFB\u52D9",
    CALENDAR_BTN_ADD_DATE_TASK: "\u65B0\u589E\u65E5\u671F\u548C\u4EFB\u52D9",
    CALENDAR_PRIORITY_HIGHEST: "\u6700\u9AD8",
    CALENDAR_PRIORITY_HIGH: "\u9AD8",
    CALENDAR_PRIORITY_MEDIUM: "\u4E2D",
    CALENDAR_PRIORITY_NORMAL: "\u666E\u901A",
    CALENDAR_PRIORITY_LOW: "\u4F4E",
    CALENDAR_PRIORITY_LOWEST: "\u6700\u4F4E",
    CALENDAR_DATETYPE_DUE: "\u622A\u6B62",
    CALENDAR_DATETYPE_START: "\u958B\u59CB",
    CALENDAR_DATETYPE_SCHEDULED: "\u8A08\u756B",
    CALENDAR_DATETYPE_CREATED: "\u5EFA\u7ACB",
    CALENDAR_DATETYPE_DONE: "\u5B8C\u6210",
    CALENDAR_DATETYPE_CANCELLED: "\u53D6\u6D88",
    // Presets
    PRESET_LABEL: "\u9810\u8A2D",
    PRESET_UNSAVED: "\u81EA\u5B9A\u7FA9 / \u672A\u95DC\u806F",
    PRESET_BTN_SAVE: "\u5132\u5B58\u9810\u8A2D",
    PRESET_BTN_DELETE: "\u522A\u9664\u9810\u8A2D",
    PRESET_BTN_NEW: "\u65B0\u5EFA\u9810\u8A2D",
    PRESET_BTN_APPLY: "\u61C9\u7528\u9810\u8A2D\u5230\u5C0E\u5716",
    PRESET_WARNING_MODIFIED: "\u5C0E\u5716\u8A2D\u5B9A\u8207\u9810\u8A2D\u4E0D\u7B26\u3002",
    PROMPT_NEW_PRESET_NAME: "\u65B0\u9810\u8A2D\u540D\u7A31\uFF1A",
    NOTICE_PRESET_DELETED: "\u9810\u8A2D\u5DF2\u522A\u9664\u3002",
    NOTICE_PRESET_SAVED: "\u9810\u8A2D\u5DF2\u5132\u5B58\u3002",
    NOTICE_PRESET_APPLIED: "\u9810\u8A2D\u5DF2\u61C9\u7528\u3002",
    // Misc
    INPUT_TITLE_PASTE_ROOT: "MindMap Builder \u8CBC\u4E0A",
    INSTRUCTIONS: "> [!Tip]\n>\u{1F680} \u60F3\u8981\u9032\u968E\uFF1F\u6B61\u8FCE\u53C3\u52A0\u5B98\u65B9 [MindMap Builder \u8AB2\u7A0B](https://www.visual-thinking-workshop.com/mindmap)\uFF01\n\n- **ENTER**\uFF1A\u65B0\u589E\u5B50\u7BC0\u9EDE\u4E26\u4FDD\u7559\u5728\u7576\u524D\u89AA\u4EE3\u7BC0\u9EDE\u4E0A\uFF0C\u65B9\u4FBF\u5FEB\u901F\u8F38\u5165\u3002\u82E5\u8F38\u5165\u6846\u70BA\u7A7A\u6642\u6309\u56DE\u8ECA\uFF0C\u7126\u9EDE\u5C07\u79FB\u52D5\u5230\u6700\u65B0\u65B0\u589E\u7684\u5B50\u7BC0\u9EDE\u3002\u9023\u7E8C\u6309\u56DE\u8ECA\u5C07\u5728\u8A72\u7BC0\u9EDE\u7684\u540C\u7D1A\u7BC0\u9EDE\u9593\u8FF4\u5708\u5207\u63DB\u3002\n- **\u71B1\u9375**\uFF1A\u898B\u5074\u908A\u9762\u677F\u5E95\u90E8\u7684\u914D\u7F6E\u9078\u9805\u3002\n- **\u505C\u9760/\u53D6\u6D88\u505C\u9760**\uFF1A\u4F7F\u7528\u6309\u9215\u6216\u914D\u7F6E\u597D\u7684\u71B1\u9375\u4F86\u5207\u63DB\u8F38\u5165\u6846\u4F4D\u7F6E\u3002\n- **\u647A\u758A**\uFF1A\u50C5\u5728\u8F38\u5165\u6846\u505C\u9760\u6642\u986F\u793A\u6309\u9215\uFF1B\u53D6\u6D88\u505C\u9760\u6642\u8ACB\u4F7F\u7528\u71B1\u9375\u3002\n- **ESC**\uFF1A\u5C07\u6D6E\u52D5\u8F38\u5165\u6846\u505C\u9760\uFF0C\u4F46\u4E0D\u555F\u7528\u5074\u908A\u9762\u677F\u3002\n- **\u8457\u8272**\uFF1A\u9802\u5C64\u5206\u652F\u64C1\u6709\u7368\u7ACB\u984F\u8272\uFF08\u591A\u8272\u6A21\u5F0F\uFF09\uFF0C\u5F8C\u4EE3\u7BC0\u9EDE\u7E7C\u627F\u89AA\u4EE3\u984F\u8272\u3002\n- **\u7DE8\u7D44**\uFF1A\n  - \u555F\u7528\u201C\u5206\u652F\u7DE8\u7D44\u201D\u5C07\u905E\u8FF4\u5730\u7DE8\u7D44\u5B50\u6A39\uFF0C\u5F9E\u8449\u7BC0\u9EDE\u5230\u9802\u5C64\u5206\u652F\u3002\n- **\u8907\u88FD/\u8CBC\u4E0A**\uFF1A\u532F\u51FA/\u532F\u5165\u542B\u7E2E\u6392\u7684 Markdown \u5217\u8868\u3002\n\n\u{1F60D} \u5982\u679C\u4F60\u89BA\u5F97\u9019\u500B\u6307\u4EE4\u78BC\u6709\u7528\uFF0C\u6B61\u8FCE [\u8ACB\u6211\u559D\u676F\u5496\u5561 \u2615](https://ko-fi.com/zsolt)\u3002"
  };

  // src/scripts/mindmap-builder/lang/index.ts
  function createMindmapTranslator(locale, isAppleDevice = false) {
    const translate = createTranslator(locale, {
      en,
      de,
      es,
      fr,
      ru,
      zh: zhCn,
      "zh-cn": zhCn,
      "zh-tw": zhTw
    });
    return (key, params = {}) => translate(key, { modifier: isAppleDevice ? "OPT" : "ALT", ...params });
  }

  // src/scripts/mindmap-builder/settings.js
  function createSettings(runtimeContext) {
    const getZoom = (level) => {
      const target = runtimeContext.ZOOM_LEVELS[level ?? runtimeContext.zoomLevel] || runtimeContext.ZOOM_LEVELS.Medium;
      return runtimeContext.ea.DEVICE.isMobile ? target.mobile : target.desktop;
    };
    const fontScale = (type) => {
      switch (type) {
        case "Use scene fontsize":
          return Array(5).fill(runtimeContext.getAppState().currentItemFontSize);
        case "Fibonacci Scale":
          return [68, 42, 26, 16, 10];
        default:
          return [36, 28, 20, 16, 12];
      }
    };
    const getFontScale = (type) => fontScale(type) ?? fontScale("Normal Scale");
    const getVal = (key, def) => runtimeContext.ea.getScriptSettingValue(key, typeof def === "object" ? def : { value: def }).value;
    const saveSettings = async () => {
      if (runtimeContext.dirty) await runtimeContext.ea.saveScriptSettings();
      runtimeContext.dirty = false;
    };
    const setVal = (key, value, hidden = false) => {
      const def = runtimeContext.ea.getScriptSettingValue(key, { value, hidden });
      const isChanging = def.value !== value || def.hidden !== hidden;
      def.value = value;
      if (hidden) def.hidden = true;
      runtimeContext.ea.setScriptSettingValue(key, def);
      if (isChanging) {
        runtimeContext.dirty = true;
      }
    };
    const extractConfigFromGlobals = () => ({
      growthMode: runtimeContext.currentModalGrowthMode,
      arrowType: runtimeContext.arrowType,
      fontsizeScale: runtimeContext.fontsizeScale,
      multicolor: runtimeContext.multicolor,
      boxChildren: runtimeContext.boxChildren,
      roundedCorners: runtimeContext.roundedCorners,
      maxWrapWidth: runtimeContext.maxWidth,
      isSolidArrow: runtimeContext.isSolidArrow,
      centerText: runtimeContext.centerText,
      fillSweep: runtimeContext.fillSweep,
      branchScale: runtimeContext.branchScale,
      baseStrokeWidth: runtimeContext.baseStrokeWidth,
      customPalette: JSON.parse(
        JSON.stringify(runtimeContext.customPalette || { enabled: false, random: false, colors: [] })
      ),
      layoutSettings: JSON.parse(JSON.stringify(runtimeContext.layoutSettings || {}))
    });
    const normalizeMapConfig = (c) => {
      if (!c) {
        return {};
      }
      return {
        growthMode: c.growthMode ?? "Right-Left",
        arrowType: c.arrowType ?? "curved",
        fontsizeScale: c.fontsizeScale ?? "Normal Scale",
        multicolor: c.multicolor ?? true,
        boxChildren: c.boxChildren ?? false,
        roundedCorners: c.roundedCorners ?? false,
        maxWrapWidth: c.maxWrapWidth ?? 450,
        isSolidArrow: c.isSolidArrow ?? true,
        centerText: c.centerText ?? true,
        fillSweep: c.fillSweep ?? false,
        branchScale: c.branchScale ?? "Hierarchical",
        baseStrokeWidth: c.baseStrokeWidth ?? 6,
        customPalette: c.customPalette ?? { enabled: false, random: false, colors: [] },
        layoutSettings: { ...runtimeContext.LAYOUT_DEFAULTS, ...c.layoutSettings || {} }
      };
    };
    const diffMapConfig = (c1, c2) => {
      if (!c1 || !c2) {
        return true;
      }
      const n1 = normalizeMapConfig(c1);
      const n2 = normalizeMapConfig(c2);
      const keys = [
        "growthMode",
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
        "baseStrokeWidth"
      ];
      for (let k of keys) {
        if (n1[k] !== n2[k]) {
          return true;
        }
      }
      if (JSON.stringify(n1.customPalette) !== JSON.stringify(n2.customPalette)) {
        return true;
      }
      for (let k of Object.keys(runtimeContext.LAYOUT_DEFAULTS)) {
        const v1 = n1.layoutSettings[k];
        const v2 = n2.layoutSettings[k];
        if (typeof v1 === "number" && typeof v2 === "number") {
          if (Math.abs(v1 - v2) > 1e-4) {
            return true;
          }
        } else if (v1 !== v2) {
          return true;
        }
      }
      return false;
    };
    const applyPresetToGlobals = (presetName) => {
      const p = runtimeContext.mapPresets[presetName];
      if (!p) {
        return;
      }
      const n = normalizeMapConfig(p);
      runtimeContext.currentModalGrowthMode = n.growthMode;
      runtimeContext.arrowType = n.arrowType;
      runtimeContext.fontsizeScale = n.fontsizeScale;
      runtimeContext.multicolor = n.multicolor;
      runtimeContext.boxChildren = n.boxChildren;
      runtimeContext.roundedCorners = n.roundedCorners;
      runtimeContext.maxWidth = n.maxWrapWidth;
      runtimeContext.isSolidArrow = n.isSolidArrow;
      runtimeContext.centerText = n.centerText;
      runtimeContext.fillSweep = n.fillSweep;
      runtimeContext.branchScale = n.branchScale;
      runtimeContext.baseStrokeWidth = n.baseStrokeWidth;
      runtimeContext.customPalette = JSON.parse(
        JSON.stringify(n.customPalette || { enabled: false, random: false, colors: [] })
      );
      runtimeContext.layoutSettings = JSON.parse(JSON.stringify(n.layoutSettings || {}));
      setVal(runtimeContext.K_GROWTH, runtimeContext.currentModalGrowthMode);
      setVal(runtimeContext.K_ARROW_TYPE, runtimeContext.arrowType);
      setVal(runtimeContext.K_FONTSIZE, runtimeContext.fontsizeScale);
      setVal(runtimeContext.K_MULTICOLOR, runtimeContext.multicolor);
      setVal(runtimeContext.K_BOX, runtimeContext.boxChildren);
      setVal(runtimeContext.K_ROUND, runtimeContext.roundedCorners);
      setVal(runtimeContext.K_WIDTH, runtimeContext.maxWidth);
      setVal(runtimeContext.K_ARROWSTROKE, runtimeContext.isSolidArrow);
      setVal(runtimeContext.K_CENTERTEXT, runtimeContext.centerText);
      setVal(runtimeContext.K_FILL_SWEEP, runtimeContext.fillSweep);
      setVal(runtimeContext.K_BRANCH_SCALE, runtimeContext.branchScale);
      setVal(runtimeContext.K_BASE_WIDTH, runtimeContext.baseStrokeWidth);
      setVal(runtimeContext.K_PALETTE, runtimeContext.customPalette, true);
      setVal(runtimeContext.K_LAYOUT, runtimeContext.layoutSettings, true);
    };
    const applyPresetToMap = async (presetName, sel) => {
      applyPresetToGlobals(presetName);
      await updateRootNodeCustomData(
        {
          presetName,
          growthMode: runtimeContext.currentModalGrowthMode,
          arrowType: runtimeContext.arrowType,
          fontsizeScale: runtimeContext.fontsizeScale,
          multicolor: runtimeContext.multicolor,
          boxChildren: runtimeContext.boxChildren,
          roundedCorners: runtimeContext.roundedCorners,
          maxWrapWidth: runtimeContext.maxWidth,
          isSolidArrow: runtimeContext.isSolidArrow,
          centerText: runtimeContext.centerText,
          fillSweep: runtimeContext.fillSweep,
          branchScale: runtimeContext.branchScale,
          baseStrokeWidth: runtimeContext.baseStrokeWidth,
          layoutSettings: JSON.parse(JSON.stringify(runtimeContext.layoutSettings))
        },
        sel
      );
      await runtimeContext.refreshMapLayout(sel);
      runtimeContext.updateUI();
    };
    const refreshPresetDropdown = () => {
      if (!runtimeContext.presetDropdown) {
        return;
      }
      runtimeContext.presetDropdown.selectEl.innerHTML = "";
      Object.keys(runtimeContext.mapPresets).forEach(
        (k) => runtimeContext.presetDropdown.addOption(k, k)
      );
      runtimeContext.presetDropdown.setValue(runtimeContext.activePresetName);
    };
    const calculateStrokeWidth = (depth, baseWidth, scaleMode) => {
      const base = Number.isFinite(baseWidth) ? baseWidth : 6;
      const clampedDepth = Math.max(0, Math.min(depth ?? 0, 4));
      if (scaleMode === "Uniform") return base;
      const min = Math.max(0.1, base * 0.1);
      const slope = (min - base) / 4;
      const val = slope * clampedDepth + base;
      return Math.round(val * 100) / 100;
    };
    const getStrokeWidthForDepth = (depth) => {
      return calculateStrokeWidth(depth, runtimeContext.baseStrokeWidth, runtimeContext.branchScale);
    };
    const inferDirectionalGrowthMode = (node, parent, sourceRoot = null, sourceMode = null) => {
      if (!node || !parent) return "Right-facing";
      const mode = sourceMode || sourceRoot?.customData?.growthMode || runtimeContext.currentModalGrowthMode;
      const nodeCenter = {
        x: node.x + node.width / 2,
        y: node.y + node.height / 2
      };
      const ref = sourceRoot ? {
        x: sourceRoot.x + sourceRoot.width / 2,
        y: sourceRoot.y + sourceRoot.height / 2
      } : {
        x: parent.x + parent.width / 2,
        y: parent.y + parent.height / 2
      };
      if (mode === "Up-facing") return "Up-facing";
      if (mode === "Down-facing") return "Down-facing";
      if (mode === "Right-facing") return "Right-facing";
      if (mode === "Left-facing") return "Left-facing";
      if (mode === "Up-Down") {
        return nodeCenter.y < ref.y ? "Up-facing" : "Down-facing";
      }
      if (mode === "Right-Left" || mode === "Radial") {
        return nodeCenter.x >= ref.x ? "Right-facing" : "Left-facing";
      }
      const dx = nodeCenter.x - ref.x;
      const dy = nodeCenter.y - ref.y;
      if (Math.abs(dx) >= Math.abs(dy)) {
        return dx >= 0 ? "Right-facing" : "Left-facing";
      }
      return dy >= 0 ? "Down-facing" : "Up-facing";
    };
    const getRootConfigForNode = (rootNode) => {
      const cd = rootNode?.customData ?? {};
      const defaultLayout = runtimeContext.layoutSettings || {};
      return {
        growthMode: cd?.growthMode || runtimeContext.currentModalGrowthMode,
        autoLayoutDisabled: cd?.autoLayoutDisabled === true,
        arrowType: cd?.arrowType ?? runtimeContext.arrowType,
        fontsizeScale: cd?.fontsizeScale ?? runtimeContext.fontsizeScale,
        multicolor: typeof cd?.multicolor === "boolean" ? cd.multicolor : runtimeContext.multicolor,
        boxChildren: typeof cd?.boxChildren === "boolean" ? cd.boxChildren : runtimeContext.boxChildren,
        roundedCorners: typeof cd?.roundedCorners === "boolean" ? cd.roundedCorners : runtimeContext.roundedCorners,
        maxWrapWidth: typeof cd?.maxWrapWidth === "number" ? cd.maxWrapWidth : runtimeContext.maxWidth,
        isSolidArrow: typeof cd?.isSolidArrow === "boolean" ? cd.isSolidArrow : runtimeContext.isSolidArrow,
        centerText: typeof cd?.centerText === "boolean" ? cd.centerText : runtimeContext.centerText,
        fillSweep: typeof cd?.fillSweep === "boolean" ? cd.fillSweep : runtimeContext.fillSweep,
        branchScale: cd?.branchScale ?? runtimeContext.branchScale,
        baseStrokeWidth: typeof cd?.baseStrokeWidth === "number" ? cd.baseStrokeWidth : runtimeContext.baseStrokeWidth,
        layoutSettings: JSON.parse(JSON.stringify(cd?.layoutSettings ?? defaultLayout))
      };
    };
    const withRootLayoutContext = (rootNode, fn) => {
      const previous = {
        growthMode: runtimeContext.currentModalGrowthMode,
        arrowType: runtimeContext.arrowType,
        centerText: runtimeContext.centerText,
        fillSweep: runtimeContext.fillSweep,
        layoutSettings: runtimeContext.layoutSettings
      };
      const cfg = getRootConfigForNode(rootNode);
      runtimeContext.currentModalGrowthMode = cfg.growthMode;
      runtimeContext.arrowType = cfg.arrowType;
      runtimeContext.centerText = cfg.centerText;
      runtimeContext.fillSweep = cfg.fillSweep;
      runtimeContext.layoutSettings = JSON.parse(JSON.stringify(cfg.layoutSettings));
      try {
        return fn(cfg);
      } finally {
        runtimeContext.currentModalGrowthMode = previous.growthMode;
        runtimeContext.arrowType = previous.arrowType;
        runtimeContext.centerText = previous.centerText;
        runtimeContext.fillSweep = previous.fillSweep;
        runtimeContext.layoutSettings = previous.layoutSettings;
      }
    };
    const updateRootNodeCustomData = async (data, sel) => {
      if (!sel) sel = runtimeContext.getMindmapNodeFromSelection();
      if (sel) {
        const allElements = runtimeContext.ea.getViewElements();
        const settingsRoot = runtimeContext.getSettingsRootNode(sel, allElements);
        if (!settingsRoot) return null;
        runtimeContext.ea.copyViewElementsToEAforEditing(
          allElements.filter((e) => e.id === settingsRoot.id)
        );
        runtimeContext.ea.addAppendUpdateCustomData(settingsRoot.id, {
          ...data
        });
        await runtimeContext.addElementsToView({
          captureUpdate: "NEVER"
        });
        runtimeContext.updateUI();
        const info = runtimeContext.getHierarchy(settingsRoot, runtimeContext.ea.getViewElements());
        return {
          ...info,
          rootId: settingsRoot.id,
          settingsRootId: settingsRoot.id
        };
      }
      return null;
    };
    const updateBranchStrokes = async (rootId, oldBaseWidth, oldScaleMode, newBaseWidth, newScaleMode) => {
      if (!runtimeContext.isViewSet()) return;
      const allElements = runtimeContext.ea.getViewElements();
      const root = allElements.find((el) => el.id === rootId);
      if (!root) return;
      const elementsToUpdate = [];
      let manualOverrideFound = false;
      const traverse = (nodeId, depth) => {
        const children = runtimeContext.getChildrenNodes(nodeId, allElements);
        children.forEach((child) => {
          const arrow = allElements.find(
            (a) => a.type === "arrow" && a.customData?.isBranch && a.startBinding?.elementId === nodeId && a.endBinding?.elementId === child.id
          );
          if (arrow) {
            const childDepth = depth + 1;
            const expectedOldWidth = calculateStrokeWidth(childDepth, oldBaseWidth, oldScaleMode);
            if (Math.abs(arrow.strokeWidth - expectedOldWidth) < 0.05) {
              const newWidth = calculateStrokeWidth(childDepth, newBaseWidth, newScaleMode);
              if (Math.abs(arrow.strokeWidth - newWidth) > 1e-3) {
                elementsToUpdate.push({
                  id: arrow.id,
                  strokeWidth: newWidth
                });
              }
            } else {
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
        runtimeContext.ea.copyViewElementsToEAforEditing(
          elementsToUpdate.map((i) => allElements.find((e) => e.id === i.id))
        );
        elementsToUpdate.forEach((item) => {
          const el = runtimeContext.ea.getElement(item.id);
          if (el) el.strokeWidth = item.strokeWidth;
        });
        await runtimeContext.addElementsToView({
          captureUpdate: "IMMEDIATELY"
        });
      }
      if (manualOverrideFound) {
        new runtimeContext.Notice(runtimeContext.t("NOTICE_BRANCH_WIDTH_MANUAL_OVERRIDE"));
      }
    };
    return {
      getZoom,
      fontScale,
      getFontScale,
      getVal,
      saveSettings,
      setVal,
      extractConfigFromGlobals,
      normalizeMapConfig,
      diffMapConfig,
      applyPresetToGlobals,
      applyPresetToMap,
      refreshPresetDropdown,
      calculateStrokeWidth,
      getStrokeWidthForDepth,
      inferDirectionalGrowthMode,
      getRootConfigForNode,
      withRootLayoutContext,
      updateRootNodeCustomData,
      updateBranchStrokes
    };
  }

  // src/scripts/mindmap-builder/textParsing.js
  function createTextParsing(runtimeContext) {
    const trimText = (text) => {
      if (!text) return text;
      return text.match(/^(?:[ \t]*[-\*][ \t])?(?:[ \t]*)(.*?)[ \t]*$/)[1];
    };
    const parseText = async (text) => {
      const trimmed = trimText(text);
      if (trimmed && (trimmed.startsWith("![[") || trimmed.match(/^[-*][ \t]+!\[\[/)) && trimmed.endsWith("]]")) {
        return text;
      }
      return await runtimeContext.ea.parseText(text);
    };
    const parseImageInput = (input) => {
      const trimmed = trimText(input);
      const externalMatch = trimmed.match(/^!\[(.*?)\]\(((?:https?|file):\/\/[^)]+)\)$/i);
      if (externalMatch) {
        const altText = externalMatch[1];
        const url = externalMatch[2];
        let width2 = null;
        if (altText) {
          const parts2 = altText.split("|");
          const last = parts2[parts2.length - 1];
          if (/^\d+$/.test(last)) {
            width2 = parseInt(last);
          }
        }
        try {
          const urlObj = new URL(url);
          const pathname = urlObj.pathname.toLowerCase();
          const isImageUrl = runtimeContext.IMAGE_TYPES.some((ext) => pathname.endsWith("." + ext));
          if (isImageUrl) {
            return {
              path: url,
              width: width2,
              imageFile: null,
              isImagePath: true,
              // This triggers image addition in addNode
              file: null,
              isExternalImage: true
              // Flag to help direct link assignments later
            };
          }
        } catch (e) {
        }
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
      let imageFile = null, file = null;
      let isImagePath = false;
      const PDF_RECT_LINK_REGEX = /^[^#]*#page=\d*/;
      if (path.match(PDF_RECT_LINK_REGEX)) {
        isImagePath = true;
      } else {
        const pathParts = path.split("#");
        imageFile = file = app.metadataCache.getFirstLinkpathDest(
          pathParts[0],
          runtimeContext.ea.targetView.file.path
        );
        if (imageFile) {
          const isEx = imageFile.extension === "md" && runtimeContext.ea.isExcalidrawFile(imageFile);
          if (!runtimeContext.IMAGE_TYPES.includes(imageFile.extension.toLowerCase()) && !isEx) {
            if (file.extension === "md" && width !== null) {
              isImagePath = true;
            }
            imageFile = null;
          }
          if (isEx && pathParts.length === 2) {
            isImagePath = true;
            imageFile = null;
          }
        }
      }
      return {
        path,
        width,
        imageFile,
        isImagePath,
        file
      };
    };
    const parseEmbeddableInput = (input, imageInfo) => {
      const trimmed = input.trim();
      const match = trimmed.match(/^!\[(.*?)\]\(((?:https?|file):\/\/[^)]+)\)$/i);
      if (match) {
        if (imageInfo && imageInfo.isExternalImage) return null;
        return match[2];
      }
      const dataURL = trimmed.match(/^!\[\[(data:text\/html;base64.*)]]$/i);
      if (dataURL) {
        return dataURL[1];
      }
      if (imageInfo && imageInfo.isImagePath && imageInfo.width !== null) {
        return null;
      }
      const pathSplit = imageInfo?.path?.split("#");
      if (imageInfo && imageInfo.file && imageInfo.file.extension === "md" && // Not an Excalidraw File or maybe an Excalidraw file with a back-of-the-card note reference
      (!runtimeContext.ea.isExcalidrawFile(imageInfo.file) || pathSplit?.[1] && !pathSplit[1].startsWith("^"))) {
        imageInfo.isImagePath = false;
        return `[[${imageInfo.path}]]`;
      }
      return null;
    };
    const getAdjustedMaxWidth = async (text, max) => {
      const fontString = `${runtimeContext.ea.style.fontSize.toString()}px ${ExcalidrawLib.getFontFamilyString({ fontFamily: runtimeContext.ea.style.fontFamily })}`;
      const parsedText = await parseText(text) ?? text;
      const wrappedText = ExcalidrawLib.wrapText(parsedText, fontString, max);
      const metrics = runtimeContext.ea.measureText(wrappedText);
      const optimalWidth = Math.ceil(metrics.width);
      return {
        width: Math.min(max, optimalWidth),
        height: metrics.height,
        wrappedText
      };
    };
    const getNodeMarkdownFile = (nodeText) => {
      if (!nodeText || !runtimeContext.ea.targetView || !runtimeContext.ea.targetView.file)
        return null;
      const parts = nodeText.trim().match(/^\[\[([^#\|\]]+)[^\]]*]]$/);
      if (!!parts?.[1]) {
        const file = app.metadataCache.getFirstLinkpathDest(
          parts[1],
          runtimeContext.ea.targetView.file.path
        );
        return file && file.extension === "md" ? file : null;
      }
      return null;
    };
    const getTextFromNode = (all, node, getRaw = false, shortPath = false) => {
      if (node.type === "embeddable") {
        return node.link.startsWith("[[") ? `!${node.link}` : `![](${node.link})`;
      }
      if (node.type === "image") {
        const embeddedFile = runtimeContext.ea.targetView?.excalidrawData?.getFile(node.fileId);
        if (!embeddedFile) return "";
        const file = runtimeContext.ea.getViewFileForImageElement(node);
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
          return `![[${file.path}${embeddedFile.filenameparts?.linkpartReference || ""}|${Math.round(node.width)}]]`;
        }
        return "";
      }
      if (node.type === "text") {
        return getRaw ? node.rawText : node.originalText;
      }
      const textId = node.boundElements?.find((be) => be.type === "text")?.id;
      if (!textId) return "";
      const textEl = all.find((el) => el.id === textId);
      return textEl ? getRaw ? textEl.rawText : textEl.originalText : "";
    };
    return {
      trimText,
      parseText,
      parseImageInput,
      parseEmbeddableInput,
      getAdjustedMaxWidth,
      getNodeMarkdownFile,
      getTextFromNode
    };
  }

  // src/scripts/mindmap-builder/graph.js
  function createGraph(runtimeContext) {
    const buildParentMap = (allElements, elementById) => {
      const parentMap = /* @__PURE__ */ new Map();
      const byId = elementById || buildElementMap(allElements);
      allElements.forEach((el) => {
        if (el.type === "arrow" && el.customData?.isBranch && el.startBinding?.elementId && el.endBinding?.elementId) {
          const parent = byId.get(el.startBinding.elementId);
          const childId = el.endBinding.elementId;
          if (parent && childId) {
            const actualParent = parent.containerId ? byId.get(parent.containerId) : parent;
            if (actualParent) parentMap.set(childId, actualParent);
          }
        }
      });
      return parentMap;
    };
    const getParentNode = (id, allElements, parentMap = null) => {
      if (parentMap && parentMap.has(id)) {
        return parentMap.get(id);
      }
      const arrow = allElements.find(
        (el) => el.type === "arrow" && el.customData?.isBranch && el.endBinding?.elementId === id
      );
      if (!arrow) return null;
      const parent = allElements.find((el) => el.id === arrow.startBinding?.elementId);
      return parent?.containerId ? allElements.find((el) => el.id === parent.containerId) : parent;
    };
    const buildElementMap = (allElements) => {
      const map = /* @__PURE__ */ new Map();
      allElements.forEach((el) => map.set(el.id, el));
      return map;
    };
    const buildChildrenMap = (allElements, elementById) => {
      const childrenByParent = /* @__PURE__ */ new Map();
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
        (el) => el.type === "arrow" && el.customData?.isBranch && el.startBinding?.elementId === id
      );
      return arrows.map((a) => allElements.find((el) => el.id === a.endBinding?.elementId)).filter(Boolean);
    };
    const buildGroupToNodes = (branchIds, allElements) => {
      const branchIdSet = new Set(branchIds);
      const groupToNodes = /* @__PURE__ */ new Map();
      allElements.forEach((el) => {
        if (branchIdSet.has(el.id) && el.type !== "arrow" && el.groupIds) {
          el.groupIds.forEach((gid) => {
            if (!groupToNodes.has(gid)) groupToNodes.set(gid, /* @__PURE__ */ new Set());
            groupToNodes.get(gid).add(el);
          });
        }
      });
      return groupToNodes;
    };
    const getMasterRoots = () => {
      const all = runtimeContext.ea.getViewElements();
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
    const getHierarchy = (el, allElements, elementById = null, parentMap = null) => {
      if (elementById) {
        el = runtimeContext.getBoundaryHost([el]) ?? el;
      } else {
        el = runtimeContext.getBoundaryHost([el]) ?? el;
      }
      let depth = 0, curr = el, l1Id = el.id, rootId = el.id;
      const visited = /* @__PURE__ */ new Set([el.id]);
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
      return {
        depth,
        l1AncestorId: l1Id,
        rootId
      };
    };
    const getSettingsRootNode = (el, allElements, elementById = null, parentMap = null) => {
      if (!el) return null;
      let curr = runtimeContext.getBoundaryHost([el]) ?? el;
      let last = curr;
      const visited = /* @__PURE__ */ new Set();
      while (curr && !visited.has(curr.id)) {
        visited.add(curr.id);
        last = curr;
        if (curr.customData?.isAdditionalRoot === true) {
          return curr;
        }
        const p = getParentNode(curr.id, allElements, parentMap);
        if (!p) {
          return curr;
        }
        curr = p;
      }
      return last;
    };
    const getDepthFromAncestor = (nodeId, ancestorId, allElements, parentMap = null) => {
      const byId = buildElementMap(allElements);
      let curr = byId.get(nodeId);
      if (!curr) return 0;
      let depth = 0;
      const visited = /* @__PURE__ */ new Set();
      while (curr && !visited.has(curr.id)) {
        if (curr.id === ancestorId) return depth;
        visited.add(curr.id);
        curr = getParentNode(curr.id, allElements, parentMap);
        depth++;
      }
      const fallbackNode = byId.get(nodeId);
      return fallbackNode ? getHierarchy(fallbackNode, allElements, byId, parentMap).depth : 0;
    };
    const getBranchElementIds = (nodeId, allElements) => {
      const childMap = /* @__PURE__ */ new Map();
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
      const branchNodes = /* @__PURE__ */ new Set([nodeId]);
      const queue = [nodeId];
      while (queue.length > 0) {
        const currentId = queue.shift();
        const currentNode = allElements.find((el) => el.id === currentId);
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
      for (let i = 0; i < allArrows.length; i++) {
        const el = allArrows[i];
        const startId = el.startBinding?.elementId;
        const endId = el.endBinding?.elementId;
        if (startId && endId && branchNodes.has(startId) && branchNodes.has(endId)) {
          branchElementIds.push(el.id);
        }
      }
      return branchElementIds;
    };
    const getMindmapProjectElements = (rootId, allViewElements) => {
      const branchIds = getBranchElementIds(rootId, allViewElements);
      const decorationAndCrossLinkIds = runtimeContext.getDecorationAndCrossLinkIdsForBranches(
        branchIds,
        allViewElements,
        rootId
      );
      const projectElementIds = /* @__PURE__ */ new Set([...branchIds, ...decorationAndCrossLinkIds]);
      const projectElements = [];
      const addedIds = /* @__PURE__ */ new Set();
      const addWithDependencies = (id) => {
        if (addedIds.has(id)) return;
        const el = allViewElements.find((e) => e.id === id);
        if (!el) return;
        projectElements.push(el);
        addedIds.add(id);
        if (el.boundElements) {
          el.boundElements.forEach((be) => addWithDependencies(be.id));
        }
        if (el.containerId) {
          addWithDependencies(el.containerId);
        }
        if (el.customData?.foldIndicatorId) {
          addWithDependencies(el.customData.foldIndicatorId);
        }
        if (el.customData?.boundaryId) {
          addWithDependencies(el.customData.boundaryId);
        }
      };
      projectElementIds.forEach((id) => addWithDependencies(id));
      return projectElements;
    };
    return {
      buildParentMap,
      getParentNode,
      buildElementMap,
      buildChildrenMap,
      getChildrenNodes,
      buildGroupToNodes,
      getMasterRoots,
      getHierarchy,
      getSettingsRootNode,
      getDepthFromAncestor,
      getBranchElementIds,
      getMindmapProjectElements
    };
  }

  // src/scripts/mindmap-builder/selection.js
  function createSelection(runtimeContext) {
    const selectNodeInView = (node) => {
      if (!node) {
        runtimeContext.mostRecentlySelectedNodeID = null;
        return;
      }
      const nodeId = typeof node === "string" ? node : node.id;
      runtimeContext.ea.selectElementsInView([nodeId]);
      runtimeContext.mostRecentlySelectedNodeID = nodeId;
    };
    const getBoundaryHost = (selectedElements) => {
      if (selectedElements.length === 1 && selectedElements[0].type === "line" && selectedElements[0].customData?.hasOwnProperty("isBoundary")) {
        const sel = selectedElements[0];
        const allElements = runtimeContext.ea.getViewElements();
        const owner = allElements.find((el) => el.customData?.boundaryId === sel.id);
        return owner;
      }
    };
    const getMindmapNodeFromSelection = () => {
      if (!runtimeContext.isViewSet()) return;
      const selectedElements = runtimeContext.ea.getViewSelectedElements().filter(
        (el) => el.customData && (el.customData.hasOwnProperty("mindmapOrder") || el.customData.hasOwnProperty("isBranch") || el.customData.hasOwnProperty("growthMode") || el.customData.hasOwnProperty("isBoundary"))
      );
      if (selectedElements.length === 0) return;
      const owner = getBoundaryHost(selectedElements);
      if (owner) {
        runtimeContext.mostRecentlySelectedNodeID = owner.id;
        return owner;
      }
      if (selectedElements.length === 1 && (selectedElements[0].customData.hasOwnProperty("mindmapOrder") || selectedElements[0].customData.hasOwnProperty("growthMode"))) {
        if (selectedElements[0].type === "text" && selectedElements[0].boundElements.length === 0 && !!selectedElements[0].containerId) {
          const node = runtimeContext.ea.getViewElements().find((el) => el.id === selectedElements[0].containerId);
          runtimeContext.mostRecentlySelectedNodeID = node?.id;
          return node;
        }
        runtimeContext.mostRecentlySelectedNodeID = selectedElements?.[0]?.id;
        return selectedElements[0];
      }
      if (selectedElements.length === 1 && selectedElements[0].type === "arrow") {
        const sel = selectedElements[0];
        const targetId = sel.startBinding?.elementId || sel.endBinding?.elementId;
        if (targetId) {
          const target = runtimeContext.ea.getViewElements().find((el) => el.id === targetId);
          runtimeContext.mostRecentlySelectedNodeID = target?.id;
          return target;
        }
        return;
      }
      if (selectedElements.length === 2) {
        const textEl = selectedElements.find((el) => el.type === "text");
        if (textEl && textEl.boundElements.length > 0 && textEl.customData.hasOwnProperty("mindmapOrder")) {
          runtimeContext.mostRecentlySelectedNodeID = textEl.id;
          return textEl;
        } else if (textEl) {
          const containerId = textEl.containerId;
          if (containerId) {
            const container = selectedElements.find((el) => el.id === containerId);
            if (container && container.boundElements.length > 0 && container.customData.hasOwnProperty("mindmapOrder")) {
              runtimeContext.mostRecentlySelectedNodeID = container.id;
              return container;
            }
          }
        }
      }
      if (selectedElements.length > 1) {
        const selectedIds = new Set(selectedElements.map((el) => el.id));
        const arrows = selectedElements.filter((el) => el.type === "arrow");
        const sourceIds = /* @__PURE__ */ new Set();
        const sinkIds = /* @__PURE__ */ new Set();
        arrows.forEach((arrow) => {
          const startId = arrow.startBinding?.elementId;
          const endId = arrow.endBinding?.elementId;
          if (startId && selectedIds.has(startId)) sourceIds.add(startId);
          if (endId && selectedIds.has(endId)) sinkIds.add(endId);
        });
        const rootId = Array.from(sourceIds).find((id) => !sinkIds.has(id));
        if (rootId) {
          runtimeContext.mostRecentlySelectedNodeID = rootId;
          return selectedElements.find((el) => el.id === rootId);
        }
      }
    };
    const ensureNodeSelected = () => {
      const elementToSelect = getMindmapNodeFromSelection();
      if (elementToSelect) {
        selectNodeInView(elementToSelect);
      }
    };
    const getMostRecentlyAddedNode = () => {
      if (!runtimeContext.mostRecentlyAddedNodeID) return null;
      return runtimeContext.ea.getViewElements().find((el) => el.id === runtimeContext.mostRecentlyAddedNodeID);
    };
    return {
      selectNodeInView,
      getBoundaryHost,
      getMindmapNodeFromSelection,
      ensureNodeSelected,
      getMostRecentlyAddedNode
    };
  }

  // src/scripts/mindmap-builder/colors.js
  function createColors(runtimeContext) {
    const randInt = (range) => Math.round(Math.random() * range);
    const getDynamicColor = (existingColors) => {
      if (runtimeContext.multicolor && runtimeContext.customPalette.enabled && runtimeContext.customPalette.colors.length > 0) {
        if (runtimeContext.customPalette.random) {
          return runtimeContext.customPalette.colors[Math.floor(Math.random() * runtimeContext.customPalette.colors.length)];
        }
        return runtimeContext.customPalette.colors[existingColors.length % runtimeContext.customPalette.colors.length];
      }
      const st = runtimeContext.getAppState();
      const bg = st.viewBackgroundColor === "transparent" ? "#ffffff" : st.viewBackgroundColor;
      const bgCM = runtimeContext.ea.getCM(bg);
      const isDarkBg = bgCM.isDark();
      const getDist = (c1, c2) => {
        let dh = Math.abs(c1.hue - c2.hue);
        if (dh > 180) dh = 360 - dh;
        const hScore = dh / 1.8;
        return hScore * 2 + Math.abs(c1.saturation - c2.saturation) + Math.abs(c1.lightness - c2.lightness);
      };
      let palette = st.colorPalette?.elementStroke || [];
      if (Array.isArray(palette)) palette = palette.flat(Infinity);
      const candidates = [];
      new Set(palette).forEach((hex) => {
        if (hex && hex !== "transparent")
          candidates.push({
            hex,
            isPalette: true
          });
      });
      for (let h = 0; h < 360; h += runtimeContext.HUE_STEP_BASE + randInt(runtimeContext.HUE_STEP_JITTER)) {
        const c = runtimeContext.ea.getCM({
          h,
          s: runtimeContext.SAT_BASE + randInt(runtimeContext.SAT_JITTER),
          l: isDarkBg ? runtimeContext.LIGHT_BASE_DARK + randInt(runtimeContext.LIGHT_JITTER_DARK) : runtimeContext.LIGHT_BASE_LIGHT + randInt(runtimeContext.LIGHT_JITTER_LIGHT),
          a: 1
        });
        candidates.push({
          hex: c.stringHEX(),
          isPalette: false
        });
      }
      const scored = candidates.map((c) => {
        let cm = runtimeContext.ea.getCM(c.hex);
        if (!cm) return null;
        let contrast = cm.contrast({
          bgColor: bg
        });
        if (contrast < 3) {
          const originalL = cm.lightness;
          const targetL = isDarkBg ? Math.min(originalL + 40, 90) : Math.max(originalL - 40, 20);
          cm = cm.lightnessTo(targetL);
          contrast = cm.contrast({
            bgColor: bg
          });
          c.hex = cm.stringHEX({
            alpha: false
          });
        }
        let minDiff = 1e3;
        let closestColor = null;
        if (existingColors.length > 0) {
          existingColors.forEach((exHex) => {
            const exCM = runtimeContext.ea.getCM(exHex);
            if (exCM) {
              const d = getDist(cm, exCM);
              if (d < minDiff) {
                minDiff = d;
                closestColor = exHex;
              }
            }
          });
        }
        return {
          ...c,
          contrast,
          minDiff
        };
      }).filter((c) => c && c.contrast >= runtimeContext.COLOR_CONTRAST_MIN);
      scored.sort((a, b) => {
        const threshold = runtimeContext.COLOR_DISTINCT_THRESHOLD;
        const aIsDistinct = a.minDiff > threshold;
        const bIsDistinct = b.minDiff > threshold;
        if (aIsDistinct && !bIsDistinct) return -1;
        if (!aIsDistinct && bIsDistinct) return 1;
        if (a.isPalette !== b.isPalette) return a.isPalette ? -1 : 1;
        return b.minDiff - a.minDiff;
      });
      return scored[0]?.hex || "#000000";
    };
    return { randInt, getDynamicColor };
  }

  // src/scripts/mindmap-builder/folding.js
  function createFolding(runtimeContext) {
    const manageFoldIndicator = (node, show, allElements) => {
      if (show) {
        const children = runtimeContext.getChildrenNodes(node.id, allElements);
        if (children.length === 0) show = false;
      }
      const existingId = node.customData?.foldIndicatorId;
      let side = 1;
      const parent = runtimeContext.getParentNode(node.id, allElements);
      if (parent) {
        const parentCenter = parent.x + parent.width / 2;
        const nodeCenter = node.x + node.width / 2;
        side = nodeCenter < parentCenter ? -1 : 1;
      }
      if (show) {
        let ind;
        if (existingId) {
          ind = allElements.find((el) => el.id === existingId);
          if (ind) {
            ind.isDeleted = false;
            ind.strokeColor = node.strokeColor;
            ind.opacity = runtimeContext.layoutSettings.INDICATOR_OPACITY;
          }
        }
        if (!ind) {
          const fontSize = runtimeContext.ea.getBoundTextElement(node).eaElement?.fontSize || 20;
          const id = runtimeContext.ea.addText(0, 0, "...");
          ind = runtimeContext.ea.getElement(id);
          ind.fontSize = fontSize;
          ind.strokeColor = node.strokeColor;
          ind.opacity = runtimeContext.layoutSettings.INDICATOR_OPACITY;
          ind.textVerticalAlign = "middle";
          if (node.groupIds && node.groupIds.length > 0) {
            ind.groupIds = [node.groupIds[0]];
          } else {
            runtimeContext.ea.addToGroup([node.id, id]);
          }
          runtimeContext.ea.addAppendUpdateCustomData(node.id, {
            foldIndicatorId: id
          });
        }
        if (side === 1) {
          ind.x = node.x + node.width + runtimeContext.layoutSettings.INDICATOR_OFFSET;
          ind.textAlign = "left";
        } else {
          ind.x = node.x - runtimeContext.layoutSettings.INDICATOR_OFFSET - ind.width;
          ind.textAlign = "right";
        }
        ind.y = node.y + node.height - ind.fontSize;
      } else {
        if (existingId) {
          const ind = allElements.find((el) => el.id === existingId);
          if (ind) ind.isDeleted = true;
          runtimeContext.ea.addAppendUpdateCustomData(node.id, {
            foldIndicatorId: void 0
          });
        }
      }
    };
    const setElementVisibility = (el, hide) => {
      if (hide) {
        if (!el.customData?.foldState) {
          const safeOpacity = el.opacity === 0 ? 100 : el.opacity;
          runtimeContext.ea.addAppendUpdateCustomData(el.id, {
            foldState: {
              opacity: safeOpacity,
              locked: el.locked
            }
          });
        }
        el.opacity = 0;
        el.locked = true;
      } else {
        if (el.customData?.foldState) {
          el.opacity = el.customData.foldState.opacity;
          el.locked = el.customData.foldState.locked;
          runtimeContext.ea.addAppendUpdateCustomData(el.id, {
            foldState: void 0
          });
        } else {
          if (el.opacity === 0) el.opacity = 100;
          el.locked = false;
        }
      }
      const boundTextElement = runtimeContext.ea.getBoundTextElement(el);
      if (boundTextElement.eaElement && boundTextElement.eaElement !== el) {
        setElementVisibility(boundTextElement?.eaElement, hide);
      }
    };
    const updateBranchVisibility = (nodeId, parentHidden, allElements, isRootOfFold, rootId) => {
      const node = allElements.find((el) => el.id === nodeId);
      if (!node) return;
      const isFolded = node.customData?.isFolded === true;
      const shouldHideThis = parentHidden && !isRootOfFold;
      setElementVisibility(node, shouldHideThis);
      const localNodeIds = /* @__PURE__ */ new Set([node.id]);
      if (node.groupIds && node.groupIds.length > 0) {
        const groupElements = runtimeContext.ea.getElementsInTheSameGroupWithElement(
          node,
          allElements
        );
        const childrenIds = runtimeContext.getChildrenNodes(nodeId, allElements).map((c) => c.id);
        groupElements.forEach((el) => {
          if (el.id === node.id) return;
          if (el.customData?.isBranch) return;
          if (el.customData?.isBoundary) return;
          if (el.id === node.customData?.foldIndicatorId) return;
          if (childrenIds.includes(el.id)) return;
          if (runtimeContext.isStructuralElement(el, allElements, rootId)) return;
          setElementVisibility(el, shouldHideThis);
          localNodeIds.add(el.id);
        });
      }
      const crossLinks = allElements.filter(
        (el) => el.type === "arrow" && !el.customData?.isBranch && (el.startBinding && localNodeIds.has(el.startBinding.elementId) || el.endBinding && localNodeIds.has(el.endBinding.elementId))
      );
      crossLinks.forEach((arrow) => {
        if (shouldHideThis) {
          setElementVisibility(arrow, true);
        } else {
          const isStartLocal = arrow.startBinding && localNodeIds.has(arrow.startBinding.elementId);
          const otherId = isStartLocal ? arrow.endBinding?.elementId : arrow.startBinding?.elementId;
          const otherNode = allElements.find((e) => e.id === otherId);
          if (otherNode && !otherNode.isDeleted && otherNode.opacity > 0) {
            setElementVisibility(arrow, false);
          }
        }
      });
      if (node.customData?.boundaryId) {
        const boundEl = allElements.find((el) => el.id === node.customData.boundaryId);
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
      const showIndicator = !shouldHideThis && isFolded;
      manageFoldIndicator(node, showIndicator, allElements);
      const childrenHidden = shouldHideThis || isFolded;
      const children = runtimeContext.getChildrenNodes(nodeId, allElements);
      children.forEach((child) => {
        const arrow = allElements.find(
          (a) => a.type === "arrow" && a.customData?.isBranch && a.startBinding?.elementId === nodeId && a.endBinding?.elementId === child.id
        );
        if (arrow) {
          setElementVisibility(arrow, childrenHidden);
        }
        updateBranchVisibility(child.id, childrenHidden, allElements, false, rootId);
      });
    };
    const toggleFold = async (mode = "L0") => {
      if (!runtimeContext.isViewSet()) return;
      const sel = runtimeContext.getMindmapNodeFromSelection();
      if (!sel) return;
      const allViewElements = runtimeContext.ea.getViewElements();
      const info = runtimeContext.getHierarchy(sel, allViewElements);
      const projectElements = runtimeContext.getMindmapProjectElements(info.rootId, allViewElements);
      runtimeContext.ea.copyViewElementsToEAforEditing(projectElements);
      const wbElements = runtimeContext.ea.getElements();
      const targetNode = wbElements.find((el) => el.id === sel.id);
      if (!targetNode) return;
      const children = runtimeContext.getChildrenNodes(targetNode.id, wbElements);
      if (children.length === 0) return;
      if (mode === "L1") {
        const hasGrandChildren = children.some(
          (child) => runtimeContext.getChildrenNodes(child.id, wbElements).length > 0
        );
        if (!hasGrandChildren) return;
      }
      let isFoldAction = false;
      if (mode === "L0") {
        const isCurrentlyFolded = targetNode.customData?.isFolded === true;
        isFoldAction = !isCurrentlyFolded;
        runtimeContext.ea.addAppendUpdateCustomData(targetNode.id, {
          isFolded: isFoldAction
        });
      } else if (mode === "L1") {
        runtimeContext.ea.addAppendUpdateCustomData(targetNode.id, {
          isFolded: false
        });
        const anyChildFolded = children.some((child) => child.customData?.isFolded === true);
        isFoldAction = !anyChildFolded;
        children.forEach((child) => {
          runtimeContext.ea.addAppendUpdateCustomData(child.id, {
            isFolded: isFoldAction
          });
        });
      } else if (mode === "ALL") {
        runtimeContext.ea.addAppendUpdateCustomData(targetNode.id, {
          isFolded: false
        });
        const nonLeafDescendants = [];
        const stack = [...children];
        while (stack.length) {
          const node = stack.pop();
          const nodeChildren = runtimeContext.getChildrenNodes(node.id, wbElements);
          if (nodeChildren.length > 0) {
            nonLeafDescendants.push(node);
            nodeChildren.forEach((child) => stack.push(child));
          }
        }
        const anyDescendantFolded = nonLeafDescendants.some(
          (node) => node.customData?.isFolded === true
        );
        isFoldAction = !anyDescendantFolded;
        nonLeafDescendants.forEach((node) => {
          runtimeContext.ea.addAppendUpdateCustomData(node.id, {
            isFolded: isFoldAction
          });
        });
      }
      updateBranchVisibility(targetNode.id, false, wbElements, true, info.rootId);
      await runtimeContext.addElementsToView({
        captureUpdate: runtimeContext.autoLayoutDisabled ? "IMMEDIATELY" : "EVENTUALLY"
      });
      if (!runtimeContext.autoLayoutDisabled) {
        await runtimeContext.triggerGlobalLayout(info.rootId);
      }
      runtimeContext.ea.viewUpdateScene({
        appState: {
          selectedGroupIds: {}
        }
      });
      runtimeContext.focusSelected();
    };
    return { manageFoldIndicator, setElementVisibility, updateBranchVisibility, toggleFold };
  }

  // src/scripts/mindmap-builder/decorations.js
  function createDecorations(runtimeContext) {
    const moveCrossLinks = (allElements, originalPositions) => {
      const crossLinkArrows = allElements.filter(
        (el) => el.type === "arrow" && !el.customData?.isBranch && el.startBinding?.elementId && el.endBinding?.elementId
      );
      const touched = /* @__PURE__ */ new Set();
      crossLinkArrows.forEach((arrow) => {
        const startId = arrow.startBinding.elementId;
        const endId = arrow.endBinding.elementId;
        const startNodeOld = originalPositions.get(startId);
        const endNodeOld = originalPositions.get(endId);
        const startNodeNew = runtimeContext.ea.getElement(startId);
        const endNodeNew = runtimeContext.ea.getElement(endId);
        if (startNodeOld && endNodeOld && startNodeNew && endNodeNew) {
          touched.add(arrow.id);
          const dsX = startNodeNew.x - startNodeOld.x;
          const dsY = startNodeNew.y - startNodeOld.y;
          const deX = endNodeNew.x - endNodeOld.x;
          const deY = endNodeNew.y - endNodeOld.y;
          if (dsX === 0 && dsY === 0 && deX === 0 && deY === 0) return;
          const eaArrow = runtimeContext.ea.getElement(arrow.id);
          if (!eaArrow) return;
          eaArrow.x += dsX;
          eaArrow.y += dsY;
          const diffX = deX - dsX;
          const diffY = deY - dsY;
          const len = eaArrow.points.length;
          if (len > 0) {
            eaArrow.points = eaArrow.points.map((p, i) => {
              const t = i / (len - 1);
              return [p[0] + diffX * t, p[1] + diffY * t];
            });
          }
        }
      });
      return touched;
    };
    const moveDecorations = (allElements, originalPositions, groupToNodes, rootId, elementById, parentMap) => {
      const structuralIds = /* @__PURE__ */ new Set();
      if (rootId) {
        allElements.forEach((el) => {
          if (runtimeContext.isStructuralElement(el, allElements, rootId, elementById, parentMap)) {
            structuralIds.add(el.id);
          }
        });
      }
      const decorationsToUpdate = [];
      allElements.forEach((el) => {
        const isStructural = structuralIds.has(el.id);
        const isCrossLink = el.type === "arrow" && !el.customData?.isBranch && el.startBinding?.elementId && el.endBinding?.elementId;
        const isDecoration = !isStructural && !isCrossLink && el.groupIds && el.groupIds.length > 0;
        if (isDecoration) {
          const hostNodes = /* @__PURE__ */ new Set();
          el.groupIds.forEach((gid) => {
            const nodesInGroup = groupToNodes.get(gid);
            if (nodesInGroup) {
              nodesInGroup.forEach((node) => hostNodes.add(node));
            }
          });
          if (hostNodes.size > 0) {
            const nodesArray = Array.from(hostNodes);
            let minXOld = Infinity, minYOld = Infinity, maxXOld = -Infinity, maxYOld = -Infinity;
            let minXNew = Infinity, minYNew = Infinity, maxXNew = -Infinity, maxYNew = -Infinity;
            let validHost = false;
            nodesArray.forEach((n) => {
              const oldPos = originalPositions.get(n.id);
              const newEl = runtimeContext.ea.getElement(n.id);
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
      decorationsToUpdate.forEach((item) => {
        if (Math.abs(item.dx) > 0.01 || Math.abs(item.dy) > 0.01) {
          const decoration = runtimeContext.ea.getElement(item.elementId);
          if (decoration) {
            decoration.x += item.dx;
            decoration.y += item.dy;
          }
        }
      });
      return new Set(decorationsToUpdate.map((d) => d.elementId));
    };
    const scaleDecorations = (oldNode, newNode, allElements, rootId) => {
      if (!oldNode.groupIds || oldNode.groupIds.length === 0) return;
      const groupElements = runtimeContext.ea.getElementsInTheSameGroupWithElement(
        oldNode,
        allElements
      );
      const decorations = groupElements.filter(
        (el) => el.id !== oldNode.id && !runtimeContext.isStructuralElement(el, allElements, rootId)
      );
      if (decorations.length === 0) return;
      const oldCx = oldNode.x + oldNode.width / 2;
      const oldCy = oldNode.y + oldNode.height / 2;
      const newCx = newNode.x + newNode.width / 2;
      const newCy = newNode.y + newNode.height / 2;
      const ratioX = oldNode.width > 1 ? newNode.width / oldNode.width : 1;
      const ratioY = oldNode.height > 1 ? newNode.height / oldNode.height : 1;
      runtimeContext.ea.copyViewElementsToEAforEditing(decorations);
      decorations.forEach((dec) => {
        const el = runtimeContext.ea.getElement(dec.id);
        if (!el) return;
        const decCx = dec.x + dec.width / 2;
        const decCy = dec.y + dec.height / 2;
        const relX = (decCx - oldCx) / (oldNode.width / 2);
        const relY = (decCy - oldCy) / (oldNode.height / 2);
        const isInside = Math.abs(relX) <= 1.05 && Math.abs(relY) <= 1.05;
        if (isInside) {
          const dx = decCx - oldCx;
          const dy = decCy - oldCy;
          const newDx = dx * ratioX;
          const newDy = dy * ratioY;
          el.x = newCx + newDx - el.width / 2;
          el.y = newCy + newDy - el.height / 2;
        } else {
          if (Math.abs(relX) > Math.abs(relY)) {
            const sign = Math.sign(relX);
            const oldEdgeX = oldCx + sign * oldNode.width / 2;
            const gapX = decCx - oldEdgeX;
            const newEdgeX = newCx + sign * newNode.width / 2;
            const newDecCx = newEdgeX + gapX;
            el.x = newDecCx - el.width / 2;
            el.y = newCy + (decCy - oldCy) * ratioY - el.height / 2;
          } else {
            const sign = Math.sign(relY);
            const oldEdgeY = oldCy + sign * oldNode.height / 2;
            const gapY = decCy - oldEdgeY;
            const newEdgeY = newCy + sign * newNode.height / 2;
            const newDecCy = newEdgeY + gapY;
            el.y = newDecCy - el.height / 2;
            el.x = newCx + (decCx - oldCx) * ratioX - el.width / 2;
          }
        }
      });
    };
    return { moveCrossLinks, moveDecorations, scaleDecorations };
  }

  // src/scripts/mindmap-builder/navigation.js
  function createNavigation(runtimeContext) {
    const nextZoomLevel = (current) => {
      const idx = runtimeContext.ZOOM_TYPES.indexOf(current);
      return idx === -1 ? runtimeContext.ZOOM_TYPES[0] : runtimeContext.ZOOM_TYPES[(idx + 1) % runtimeContext.ZOOM_TYPES.length];
    };
    const zoomToFit = (mode) => {
      if (!runtimeContext.isViewSet()) return;
      let sel = runtimeContext.getMindmapNodeFromSelection();
      if (!sel && runtimeContext.mostRecentlySelectedNodeID) {
        const fallback = runtimeContext.ea.getViewElements().find((el) => el.id === runtimeContext.mostRecentlySelectedNodeID);
        if (fallback) {
          sel = fallback;
          runtimeContext.selectNodeInView(sel);
          runtimeContext.focusInputEl();
        } else {
          runtimeContext.mostRecentlySelectedNodeID = null;
        }
      }
      if (sel) {
        let nextLevel = runtimeContext.zoomLevel;
        if (typeof mode === "string") {
          nextLevel = mode;
        } else if (!!mode && runtimeContext.storedZoom.elementID === sel.id) {
          nextLevel = nextZoomLevel(runtimeContext.storedZoom.level ?? runtimeContext.zoomLevel);
        }
        runtimeContext.storedZoom = {
          elementID: sel.id,
          level: nextLevel
        };
        const targetZoom = runtimeContext.getZoom(nextLevel);
        if (!runtimeContext.ea.verifyMinimumPluginVersion("2.26.0")) {
          runtimeContext.api().scrollToContent([sel], {
            fitToViewport: true,
            viewportZoomFactor: targetZoom,
            animate: true
          });
        } else {
          const appState = runtimeContext.api().getAppState();
          const targetW = appState.width / targetZoom;
          const targetH = appState.height / targetZoom;
          const cx = sel.x + sel.width / 2;
          const cy = sel.y + sel.height / 2;
          runtimeContext.api().setViewport({
            target: {
              x: cx - targetW / 2,
              y: cy - targetH / 2,
              width: targetW,
              height: targetH
            },
            fit: "contain",
            animation: true
          });
        }
      }
    };
    const focusSelected = () => {
      if (!runtimeContext.isViewSet()) return;
      let sel = runtimeContext.getMindmapNodeFromSelection();
      if (!sel) {
        if (!runtimeContext.mostRecentlySelectedNodeID) {
          const roots = runtimeContext.getMasterRoots();
          if (roots.length > 0) {
            runtimeContext.mostRecentlySelectedNodeID = roots[0];
          }
          if (!runtimeContext.mostRecentlySelectedNodeID) return;
        }
        const fallback = runtimeContext.ea.getViewElements().find((el) => el.id === runtimeContext.mostRecentlySelectedNodeID);
        if (fallback) {
          sel = fallback;
          runtimeContext.selectNodeInView(sel);
          runtimeContext.focusInputEl();
        } else {
          runtimeContext.mostRecentlySelectedNodeID = null;
        }
      }
      if (!sel) return;
      if (!runtimeContext.ea.verifyMinimumPluginVersion("2.26.0")) {
        runtimeContext.api().scrollToContent(sel, {
          fitToContent: false,
          animate: true
        });
      } else {
        runtimeContext.api().setViewport({
          target: [sel],
          fit: "none",
          animation: true
        });
      }
    };
    const navigateMap = async ({ key, zoom = false, focus = false } = {}) => {
      if (!key) return;
      if (!runtimeContext.isViewSet()) return;
      let allElements = runtimeContext.ea.getViewElements();
      const current = runtimeContext.getMindmapNodeFromSelection();
      if (!current) return;
      const info = runtimeContext.getHierarchy(current, allElements);
      const parent = runtimeContext.getParentNode(current.id, allElements);
      const currentSettingsRoot = runtimeContext.getSettingsRootNode(current, allElements);
      const root = current.customData?.isAdditionalRoot === true && parent ? runtimeContext.getSettingsRootNode(parent, allElements) || currentSettingsRoot || allElements.find((e) => e.id === info.rootId) : currentSettingsRoot || allElements.find((e) => e.id === info.rootId);
      if (!root) return;
      const rootCenter = {
        x: root.x + root.width / 2,
        y: root.y + root.height / 2
      };
      const mapMode = root.customData?.growthMode || runtimeContext.currentModalGrowthMode;
      const isVerticalLayout = ["Up-facing", "Down-facing", "Up-Down"].includes(mapMode);
      if (current.id === root.id) {
        if (current.customData?.isFolded) {
          await runtimeContext.toggleFold("L0");
          allElements = runtimeContext.ea.getViewElements();
        }
        const children = runtimeContext.getChildrenNodes(root.id, allElements);
        if (children.length) {
          runtimeContext.sortChildrenStable(children);
          let targetChild = null;
          if (isVerticalLayout) {
            if (key === "ArrowLeft") targetChild = children[0];
            else if (key === "ArrowRight") targetChild = children[children.length - 1];
            else {
              const childrenWithPos = children.map((c) => ({
                node: c,
                dx: Math.abs(c.x + c.width / 2 - rootCenter.x),
                // distance from vertical centerline
                dy: c.y + c.height / 2 - rootCenter.y
              }));
              if (key === "ArrowDown") {
                const downNodes = childrenWithPos.filter((c) => c.dy > 0).sort((a, b) => a.dx - b.dx);
                targetChild = downNodes.length > 0 ? downNodes[0].node : children[0];
              } else if (key === "ArrowUp") {
                const upNodes = childrenWithPos.filter((c) => c.dy < 0).sort((a, b) => a.dx - b.dx);
                targetChild = upNodes.length > 0 ? upNodes[0].node : children[children.length - 1];
              }
            }
          } else {
            if (key === "ArrowUp") targetChild = children[0];
            else if (key === "ArrowDown") targetChild = children[children.length - 1];
            else {
              const childrenWithPos = children.map((c) => ({
                node: c,
                dx: c.x + c.width / 2 - rootCenter.x,
                dy: Math.abs(c.y + c.height / 2 - rootCenter.y)
                // distance from horizontal centerline
              }));
              if (key === "ArrowRight") {
                const rightNodes = childrenWithPos.filter((c) => c.dx > 0).sort((a, b) => a.dy - b.dy);
                targetChild = rightNodes.length > 0 ? rightNodes[0].node : children[0];
              } else if (key === "ArrowLeft") {
                const leftNodes = childrenWithPos.filter((c) => c.dx < 0).sort((a, b) => a.dy - b.dy);
                targetChild = leftNodes.length > 0 ? leftNodes[0].node : children[children.length - 1];
              }
            }
          }
          if (targetChild) {
            runtimeContext.selectNodeInView(targetChild);
            if (zoom) zoomToFit();
            if (focus) focusSelected();
          }
        }
        return;
      }
      const isHierarchyNav = isVerticalLayout ? key === "ArrowUp" || key === "ArrowDown" : key === "ArrowLeft" || key === "ArrowRight";
      const isSiblingNav = isVerticalLayout ? key === "ArrowLeft" || key === "ArrowRight" : key === "ArrowUp" || key === "ArrowDown";
      if (isHierarchyNav) {
        const curCenter = {
          x: current.x + current.width / 2,
          y: current.y + current.height / 2
        };
        const isInPositive = isVerticalLayout ? curCenter.y > rootCenter.y : curCenter.x > rootCenter.x;
        let goIn = false;
        if (isVerticalLayout) {
          goIn = key === "ArrowUp" && isInPositive || key === "ArrowDown" && !isInPositive;
        } else {
          goIn = key === "ArrowLeft" && isInPositive || key === "ArrowRight" && !isInPositive;
        }
        if (goIn) {
          runtimeContext.selectNodeInView(runtimeContext.getParentNode(current.id, allElements));
        } else {
          if (current.customData?.isFolded) {
            await runtimeContext.toggleFold("L0");
            allElements = runtimeContext.ea.getViewElements();
          }
          const ch = runtimeContext.getChildrenNodes(current.id, allElements).sort(
            (a, b) => (a.customData?.mindmapOrder ?? 100) - (b.customData?.mindmapOrder ?? 100)
          );
          if (ch.length) runtimeContext.selectNodeInView(ch[0]);
        }
      } else if (isSiblingNav) {
        const parent2 = runtimeContext.getParentNode(current.id, allElements);
        if (!parent2) return;
        const siblings = runtimeContext.getChildrenNodes(parent2.id, allElements);
        const parentCenter = {
          x: parent2.x + parent2.width / 2,
          y: parent2.y + parent2.height / 2
        };
        siblings.sort((a, b) => {
          const aCX = a.x + a.width / 2;
          const aCY = a.y + a.height / 2;
          const bCX = b.x + b.width / 2;
          const bCY = b.y + b.height / 2;
          let aPoint = {
            x: aCX,
            y: aCY
          };
          let bPoint = {
            x: bCX,
            y: bCY
          };
          if (mapMode === "Radial") {
            aPoint.x = aCX >= parentCenter.x ? a.x : a.x + a.width;
            aPoint.y = aCY >= parentCenter.y ? a.y : a.y + a.height;
            bPoint.x = bCX >= parentCenter.x ? b.x : b.x + b.width;
            bPoint.y = bCY >= parentCenter.y ? b.y : b.y + b.height;
          } else if (isVerticalLayout) {
            aPoint.y = parentCenter.y + (aCY >= parentCenter.y ? 1e5 : -1e5);
            bPoint.y = parentCenter.y + (bCY >= parentCenter.y ? 1e5 : -1e5);
          } else {
            aPoint.x = parentCenter.x + (aCX >= parentCenter.x ? 1e5 : -1e5);
            bPoint.x = parentCenter.x + (bCX >= parentCenter.x ? 1e5 : -1e5);
          }
          return runtimeContext.getAngleFromCenter(parentCenter, aPoint) - runtimeContext.getAngleFromCenter(parentCenter, bPoint);
        });
        const idx = siblings.findIndex((s) => s.id === current.id);
        const startIndex = idx === -1 ? 0 : idx;
        const currentIsNegativeBranch = isVerticalLayout ? current.y + current.height / 2 < parent2.y + parent2.height / 2 : current.x + current.width / 2 < parent2.x + parent2.width / 2;
        let navigateForward;
        if (isVerticalLayout) {
          navigateForward = currentIsNegativeBranch ? key === "ArrowRight" : key === "ArrowLeft";
        } else {
          navigateForward = currentIsNegativeBranch ? key === "ArrowUp" : key === "ArrowDown";
        }
        let nIdx = navigateForward ? (startIndex + 1) % siblings.length : (startIndex - 1 + siblings.length) % siblings.length;
        runtimeContext.selectNodeInView(siblings[nIdx]);
      }
      if (zoom) zoomToFit();
      if (focus) focusSelected();
    };
    return { nextZoomLevel, zoomToFit, focusSelected, navigateMap };
  }

  // src/scripts/mindmap-builder/layoutMetrics.js
  function createLayoutMetrics(runtimeContext) {
    const getMindmapOrder = (node) => {
      const o = node?.customData?.mindmapOrder;
      return typeof o === "number" && Number.isFinite(o) ? o : 0;
    };
    const getNodeBox = (node, allElements) => {
      if (node.groupIds && node.groupIds.length > 0) {
        const groupElements = runtimeContext.ea.getElementsInTheSameGroupWithElement(
          node,
          allElements
        );
        if (groupElements.length > 1) {
          const box = ExcalidrawLib.getCommonBoundingBox(groupElements);
          return {
            ...box,
            elements: groupElements,
            isGroup: true
          };
        }
      }
      return {
        minX: node.x,
        minY: node.y,
        width: node.width,
        height: node.height,
        elements: [node],
        isGroup: false
      };
    };
    const sortChildrenStable = (children, allElements) => {
      children.sort((a, b) => {
        const ao = getMindmapOrder(a), bo = getMindmapOrder(b);
        if (ao !== bo) return ao - bo;
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
      if (node.customData?.isAdditionalRoot && node.customData?.autoLayoutDisabled) {
        const branchIds = runtimeContext.getBranchElementIds(nodeId, allElements);
        const branchElements = allElements.filter(
          (el) => branchIds.includes(el.id) && el.opacity > 0 && !el.isDeleted
        );
        const bbox = runtimeContext.ea.getBoundingBox(branchElements);
        const height = bbox.height;
        if (heightCache) heightCache.set(nodeId, height);
        return height;
      }
      const children = childrenByParent?.get(nodeId) ?? runtimeContext.getChildrenNodes(nodeId, allElements);
      const unpinnedChildren = children.filter((child) => !child.customData?.isPinned);
      let totalHeight = 0;
      if (unpinnedChildren.length === 0) {
        totalHeight = node.height;
      } else {
        let childrenHeight = 0;
        unpinnedChildren.forEach((child, index) => {
          childrenHeight += getSubtreeHeight(
            child.id,
            allElements,
            childrenByParent,
            heightCache,
            elementById
          );
          if (index < unpinnedChildren.length - 1) {
            const childNode = elementById?.get(child.id) ?? allElements.find((el) => el.id === child.id);
            const grandChildren = childrenByParent?.get(child.id) ?? runtimeContext.getChildrenNodes(child.id, allElements);
            const hasUnpinnedGrandChildren = grandChildren.some((gc) => !gc.customData?.isPinned);
            const fontSize = childNode.fontSize ?? 20;
            const gap = !hasUnpinnedGrandChildren ? Math.round(fontSize * runtimeContext.layoutSettings.GAP_MULTIPLIER) : runtimeContext.layoutSettings.GAP_Y;
            childrenHeight += gap;
          }
        });
        totalHeight = Math.max(node.height, childrenHeight);
      }
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
      const children = childrenByParent?.get(nodeId) ?? runtimeContext.getChildrenNodes(nodeId, allElements);
      const unpinnedChildren = children.filter((child) => !child.customData?.isPinned);
      let totalWidth = 0;
      if (unpinnedChildren.length === 0) {
        totalWidth = node.width;
      } else {
        let childrenWidth = 0;
        unpinnedChildren.forEach((child, index) => {
          childrenWidth += getSubtreeWidth(
            child.id,
            allElements,
            childrenByParent,
            widthCache,
            elementById
          );
          if (index < unpinnedChildren.length - 1) {
            const childNode = elementById?.get(child.id) ?? allElements.find((el) => el.id === child.id);
            const grandChildren = childrenByParent?.get(child.id) ?? runtimeContext.getChildrenNodes(child.id, allElements);
            const hasUnpinnedGrandChildren = grandChildren.some((gc) => !gc.customData?.isPinned);
            const fontSize = childNode.fontSize ?? 20;
            const gap = !hasUnpinnedGrandChildren ? Math.round(fontSize * runtimeContext.layoutSettings.GAP_MULTIPLIER) : runtimeContext.layoutSettings.GAP_Y;
            childrenWidth += gap;
          }
        });
        totalWidth = Math.max(node.width, childrenWidth);
      }
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
      const baseWidth = getSubtreeWidth(
        nodeId,
        allElements,
        childrenByParent,
        widthCache,
        elementById
      );
      if (node.customData?.isAdditionalRoot !== true || node.customData?.autoLayoutDisabled === true) {
        if (placementWidthCache) placementWidthCache.set(nodeId, baseWidth);
        return baseWidth;
      }
      const mode = node.customData?.growthMode;
      if (!["Right-facing", "Left-facing", "Right-Left"].includes(mode)) {
        if (placementWidthCache) placementWidthCache.set(nodeId, baseWidth);
        return baseWidth;
      }
      const children = childrenByParent?.get(nodeId) ?? runtimeContext.getChildrenNodes(nodeId, allElements);
      const unpinnedChildren = children.filter((child) => !child.customData?.isPinned);
      if (unpinnedChildren.length === 0) {
        if (placementWidthCache) placementWidthCache.set(nodeId, baseWidth);
        return baseWidth;
      }
      const childWidths = unpinnedChildren.map(
        (child) => getVerticalPlacementWidth(
          child.id,
          allElements,
          childrenByParent,
          widthCache,
          elementById,
          placementWidthCache
        )
      );
      const primaryGap = runtimeContext.layoutSettings.GAP_X;
      const compactMinWidth = node.width + runtimeContext.layoutSettings.GAP_Y * 2;
      let projectedWidth;
      if (mode === "Right-facing" || mode === "Left-facing") {
        const maxChildWidth = childWidths.reduce((max, width) => Math.max(max, width), 0);
        const directionalRawWidth = Math.max(node.width, node.width + primaryGap + maxChildWidth);
        const singleSideBlend = runtimeContext.layoutSettings.VERTICAL_SUBTREE_WIDTH_BLEND_SINGLE ?? runtimeContext.LAYOUT_METADATA.VERTICAL_SUBTREE_WIDTH_BLEND_SINGLE.def;
        projectedWidth = Math.max(
          compactMinWidth,
          node.width + (directionalRawWidth - node.width) * singleSideBlend
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
        const directionalRawWidth = node.width + (leftMax > 0 ? primaryGap + leftMax : 0) + (rightMax > 0 ? primaryGap + rightMax : 0);
        const dualSideBlend = runtimeContext.layoutSettings.VERTICAL_SUBTREE_WIDTH_BLEND_DUAL ?? runtimeContext.LAYOUT_METADATA.VERTICAL_SUBTREE_WIDTH_BLEND_DUAL.def;
        projectedWidth = Math.max(
          compactMinWidth,
          node.width + (Math.max(node.width, directionalRawWidth) - node.width) * dualSideBlend
        );
      }
      if (node.customData?.boundaryId) {
        projectedWidth += 30;
      }
      const effectiveWidth = Math.min(baseWidth, projectedWidth);
      const widthExtra = Math.max(0, effectiveWidth - node.width);
      const smoothThresholdMultiplier = runtimeContext.layoutSettings.VERTICAL_SUBTREE_SMOOTH_THRESHOLD_MULTIPLIER ?? runtimeContext.LAYOUT_METADATA.VERTICAL_SUBTREE_SMOOTH_THRESHOLD_MULTIPLIER.def;
      const softThreshold = Math.max(
        runtimeContext.layoutSettings.GAP_X,
        runtimeContext.layoutSettings.GAP_Y * smoothThresholdMultiplier
      );
      let smoothedWidth = effectiveWidth;
      if (widthExtra > softThreshold) {
        const smoothMinScale = runtimeContext.layoutSettings.VERTICAL_SUBTREE_SMOOTH_MIN_SCALE ?? runtimeContext.LAYOUT_METADATA.VERTICAL_SUBTREE_SMOOTH_MIN_SCALE.def;
        const compressionScale = Math.max(smoothMinScale, runtimeContext.layoutSettings.GAP_X * 2);
        const remaining = widthExtra - softThreshold;
        const compressedRemaining = compressionScale * Math.log1p(remaining / compressionScale);
        smoothedWidth = node.width + softThreshold + compressedRemaining;
      }
      if (placementWidthCache) placementWidthCache.set(nodeId, smoothedWidth);
      return smoothedWidth;
    };
    return {
      getMindmapOrder,
      getNodeBox,
      sortChildrenStable,
      getSubtreeHeight,
      getSubtreeWidth,
      getVerticalPlacementWidth
    };
  }

  // src/scripts/mindmap-builder/grouping.js
  function createGrouping(runtimeContext) {
    const isStructuralElement = (el, allElements, rootId = null, elementById = null, parentMap = null) => {
      const isStructuralType = el.customData?.isBranch || el.customData?.growthMode || el.customData?.isBoundary || typeof el.customData?.mindmapOrder !== "undefined";
      if (rootId && isStructuralType) {
        let targetEl = el;
        if (el.type === "arrow" && el.customData?.isBranch) {
          const targetId = el.endBinding?.elementId || el.startBinding?.elementId;
          if (targetId) {
            targetEl = elementById?.get(targetId) || allElements.find((e) => e.id === targetId);
          }
        }
        if (!targetEl) return false;
        const info = runtimeContext.getHierarchy(targetEl, allElements, elementById, parentMap);
        if (info?.rootId === rootId) return true;
        if (info?.rootId) return false;
      }
      if (!rootId && isStructuralType) return true;
      const connectedArrow = allElements.find(
        (a) => a.type === "arrow" && a.customData?.isBranch && (a.startBinding?.elementId === el.id || a.endBinding?.elementId === el.id)
      );
      return !!connectedArrow;
    };
    const getViewGroupElements = (groupID) => {
      return runtimeContext.ea.getViewElements().filter((el) => el.groupIds.includes(groupID));
    };
    const getCommonGroupForElements = (elements) => {
      const groupIds = elements.map((el) => el.groupIds).reduce((prev, cur) => cur.filter((v) => prev.includes(v)));
      return groupIds;
    };
    const isMindmapGroup = (groupId, allElements) => {
      const groupEls = allElements.filter((el) => el.groupIds?.includes(groupId));
      const structuralCount = groupEls.filter((el) => isStructuralElement(el, allElements)).length;
      return structuralCount >= 2;
    };
    const collectCrosslinkIds = (allElements) => new Set(
      allElements.filter(
        (el) => el.type === "arrow" && !el.customData?.isBranch && el.startBinding?.elementId && el.endBinding?.elementId
      ).map((el) => el.id)
    );
    const collectDecorationIds = (allElements, rootId) => new Set(
      allElements.filter(
        (el) => el.groupIds && el.groupIds.length > 0 && !isStructuralElement(el, allElements, rootId)
      ).map((el) => el.id)
    );
    const getStructuralGroup = (element, allElements, rootId) => {
      if (!element.groupIds || element.groupIds.length === 0) return null;
      return element.groupIds.find((gid) => isMindmapGroup(gid, allElements));
    };
    const applyRecursiveGrouping = (nodeId, allElements) => {
      const children = runtimeContext.getChildrenNodes(nodeId, allElements);
      const nodeIdsInSubtree = [nodeId];
      const node = allElements.find((el) => el.id === nodeId);
      if (node?.customData?.boundaryId) {
        nodeIdsInSubtree.push(node.customData.boundaryId);
      }
      children.forEach((child) => {
        const subtreeIds = applyRecursiveGrouping(child.id, allElements);
        nodeIdsInSubtree.push(...subtreeIds);
        const arrow = allElements.find(
          (a) => a.type === "arrow" && a.customData?.isBranch && a.startBinding?.elementId === nodeId && a.endBinding?.elementId === child.id
        );
        if (arrow) {
          nodeIdsInSubtree.push(arrow.id);
        }
      });
      if (nodeIdsInSubtree.length > 1) {
        runtimeContext.ea.addToGroup(nodeIdsInSubtree);
      }
      return nodeIdsInSubtree;
    };
    const getStructuralGroupForNode = (branchIds, workbenchEls, rootId) => {
      const decorationAndCrossLinkIds = getDecorationAndCrossLinkIdsForBranches(
        branchIds,
        workbenchEls,
        rootId
      );
      const elements = workbenchEls.filter(
        (el) => branchIds.includes(el.id) || decorationAndCrossLinkIds.includes(el.id)
      );
      const commonGroupId = getCommonGroupForElements(elements)[0];
      const structuralGroupId = commonGroupId && isMindmapGroup(commonGroupId, workbenchEls) ? commonGroupId : null;
      return {
        structuralGroupId,
        groupedElementIds: structuralGroupId ? elements.map((e) => e.id) : []
      };
    };
    const getStructuralGroupsForNode = (branchIds, workbenchEls, rootId) => {
      const decorationAndCrossLinkIds = getDecorationAndCrossLinkIdsForBranches(
        branchIds,
        workbenchEls,
        rootId
      );
      const elements = workbenchEls.filter(
        (el) => branchIds.includes(el.id) || decorationAndCrossLinkIds.includes(el.id)
      );
      const commonGroupIds = getCommonGroupForElements(elements);
      const structuralGroupIds = commonGroupIds.filter(
        (commonGroupId) => isMindmapGroup(commonGroupId, workbenchEls)
      );
      return {
        structuralGroupIds,
        groupedElementIds: elements.map((e) => e.id)
      };
    };
    const removeGroupFromElements = (groupId, workbenchEls) => {
      workbenchEls.forEach((el) => {
        if (el.groupIds) {
          el.groupIds = el.groupIds.filter((g) => g !== groupId);
        }
      });
    };
    const getDecorationAndCrossLinkIdsForBranches = (branchIds, allElements, rootId) => {
      const idsInBranch = new Set(branchIds);
      const decorationsAndCrossLInks = /* @__PURE__ */ new Set();
      const elementMap = /* @__PURE__ */ new Map();
      const groupMap = /* @__PURE__ */ new Map();
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
      const processedGroups = /* @__PURE__ */ new Set();
      for (const id of branchIds) {
        const el = elementMap.get(id);
        if (el && el.groupIds && el.groupIds.length > 0) {
          for (const gid of el.groupIds) {
            if (processedGroups.has(gid)) continue;
            processedGroups.add(gid);
            const groupMembers = groupMap.get(gid) || [];
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
              const structuralMemberIds = new Set(structuralMembers.map((e) => e.id));
              for (const member of groupMembers) {
                if (!structuralMemberIds.has(member.id)) {
                  decorationsAndCrossLInks.add(member.id);
                }
              }
            }
          }
        }
      }
      for (const el of allElements) {
        if (idsInBranch.has(el.id) || decorationsAndCrossLInks.has(el.id)) continue;
        if (el.type === "arrow" && !el.customData?.isBranch) {
          if (el.startBinding?.elementId && el.endBinding?.elementId) {
            if (idsInBranch.has(el.startBinding.elementId) && idsInBranch.has(el.endBinding.elementId)) {
              decorationsAndCrossLInks.add(el.id);
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
    const toggleBranchGroup = async () => {
      if (!runtimeContext.isViewSet()) return;
      const sel = runtimeContext.getMindmapNodeFromSelection();
      if (!sel) return;
      const info = runtimeContext.getHierarchy(sel, runtimeContext.ea.getViewElements());
      if (!info || !info.rootId) return;
      const allElements = runtimeContext.ea.getViewElements();
      const branchIds = runtimeContext.getBranchElementIds(sel.id, allElements);
      const decorationAndCrossLinkIds = getDecorationAndCrossLinkIdsForBranches(
        branchIds,
        allElements,
        info.rootId
      );
      if (branchIds.length <= 1) return;
      runtimeContext.ea.copyViewElementsToEAforEditing(
        allElements.filter(
          (el) => branchIds.includes(el.id) || decorationAndCrossLinkIds.includes(el.id)
        )
      );
      const workbenchEls = runtimeContext.ea.getElements();
      let newGroupId;
      let { structuralGroupIds, groupedElementIds } = getStructuralGroupsForNode(
        branchIds,
        workbenchEls,
        info.rootId
      );
      if (structuralGroupIds.length > 0) {
        structuralGroupIds.forEach((structuralGroupId) => {
          if (getViewGroupElements(structuralGroupId).length === groupedElementIds.length) {
            removeGroupFromElements(structuralGroupId, workbenchEls);
          }
        });
      } else {
        newGroupId = runtimeContext.ea.addToGroup([...branchIds, ...decorationAndCrossLinkIds]);
      }
      await runtimeContext.addElementsToView({
        captureUpdate: "IMMEDIATELY"
      });
      if (newGroupId) {
        let selectedGroupIds = {};
        selectedGroupIds[newGroupId] = true;
        runtimeContext.ea.viewUpdateScene({
          appState: {
            selectedGroupIds,
            selectedElementIds: {}
          }
        });
      } else {
        runtimeContext.ea.viewUpdateScene({
          appState: {
            selectedGroupIds: {},
            selectedElementIds: {
              [sel.id]: true
            }
          }
        });
      }
      runtimeContext.updateUI();
    };
    return {
      isStructuralElement,
      getViewGroupElements,
      getCommonGroupForElements,
      isMindmapGroup,
      collectCrosslinkIds,
      collectDecorationIds,
      getStructuralGroup,
      applyRecursiveGrouping,
      getStructuralGroupForNode,
      getStructuralGroupsForNode,
      removeGroupFromElements,
      getDecorationAndCrossLinkIdsForBranches,
      toggleBranchGroup
    };
  }

  // src/scripts/mindmap-builder/boundaries.js
  function createBoundaries(runtimeContext) {
    const getAngleFromCenter = (center, point) => {
      let dx = point.x - center.x, dy = point.y - center.y;
      let angle = Math.atan2(dx, -dy) * (180 / Math.PI);
      return angle < 0 ? angle + 360 : angle;
    };
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
      const ids = runtimeContext.getBranchElementIds(node.id, allElements);
      const branchElements = allElements.filter(
        (el) => ids.includes(el.id) && el.id !== boundaryId && el.opacity > 0 && !el.isDeleted
      );
      if (branchElements.length === 0) return;
      const root = allElements.find((el) => el.id === rootId);
      const growthMode = root?.customData?.growthMode || runtimeContext.currentModalGrowthMode;
      const isVerticalBoundaryMode = growthMode === "Up-facing" || growthMode === "Down-facing" || growthMode === "Up-Down";
      const padding = 15;
      let allPoints = [];
      branchElements.forEach((el) => {
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
      const subdividedPoints = [];
      const MAX_SEGMENT_LENGTH = runtimeContext.layoutSettings.MAX_SEGMENT_LENGTH ?? runtimeContext.LAYOUT_METADATA.MAX_SEGMENT_LENGTH.def;
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
      hullPoints.forEach((p) => {
        if (p[0] < minX) minX = p[0];
        if (p[1] < minY) minY = p[1];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] > maxY) maxY = p[1];
      });
      const w = maxX - minX;
      const h = maxY - minY;
      let boundaryEl = runtimeContext.ea.getElement(boundaryId);
      if (!boundaryEl) return;
      boundaryEl.x = minX;
      boundaryEl.y = minY;
      boundaryEl.width = w;
      boundaryEl.height = h;
      const normalizedPoints = subdividedPoints.map((p) => [p[0] - minX, p[1] - minY]);
      normalizedPoints.push([normalizedPoints[0][0], normalizedPoints[0][1]]);
      boundaryEl.points = normalizedPoints;
      boundaryEl.roundness = runtimeContext.arrowType === "curved" ? {
        type: 2
      } : null;
      boundaryEl.polygon = true;
      boundaryEl.locked = false;
      if (node.groupIds.length > 0 && runtimeContext.isMindmapGroup(node.groupIds[0], allElements)) {
        if (!boundaryEl.groupIds || boundaryEl.groupIds.length === 0 || boundaryEl.groupIds[0] !== node.groupIds[0]) {
          boundaryEl.groupIds = [node.groupIds[0]];
        }
      } else {
        boundaryEl.groupIds = [];
      }
    };
    const toggleBoundary = async () => {
      if (!runtimeContext.isViewSet()) return;
      const sel = runtimeContext.getMindmapNodeFromSelection();
      if (sel) {
        const info = runtimeContext.getHierarchy(sel, runtimeContext.ea.getViewElements());
        runtimeContext.ea.copyViewElementsToEAforEditing([sel]);
        const eaSel = runtimeContext.ea.getElement(sel.id);
        let newBoundaryId = null;
        if (eaSel.customData?.boundaryId) {
          const b = runtimeContext.ea.getViewElements().find((el) => el.id === eaSel.customData.boundaryId);
          if (b) {
            runtimeContext.ea.copyViewElementsToEAforEditing([b]);
            runtimeContext.ea.getElement(b.id).isDeleted = true;
          }
          runtimeContext.ea.addAppendUpdateCustomData(sel.id, {
            boundaryId: void 0
          });
        } else {
          const id = runtimeContext.ea.generateElementId();
          newBoundaryId = id;
          const st = runtimeContext.getAppState();
          const boundaryEl = {
            id,
            type: "line",
            x: sel.x,
            y: sel.y,
            width: 1,
            height: 1,
            angle: 0,
            roughness: st.currentItemRoughness,
            strokeColor: sel.strokeColor,
            backgroundColor: sel.strokeColor,
            fillStyle: "solid",
            strokeWidth: 2,
            strokeStyle: "solid",
            opacity: 30,
            points: [
              [0, 0],
              [1, 1],
              [0, 0]
            ],
            polygon: true,
            locked: false,
            groupIds: sel.groupIds || [],
            customData: {
              isBoundary: true
            },
            roundness: runtimeContext.arrowType === "curved" ? {
              type: 2
            } : null
          };
          if (sel.groupIds.length > 0 && runtimeContext.isMindmapGroup(sel.groupIds[0], runtimeContext.ea.getViewElements())) {
            boundaryEl.groupIds = [sel.groupIds[0]];
          } else {
            boundaryEl.groupIds = [];
          }
          runtimeContext.ea.elementsDict[id] = boundaryEl;
          runtimeContext.ea.addAppendUpdateCustomData(sel.id, {
            boundaryId: id
          });
        }
        await runtimeContext.addElementsToView({
          newElementsOnTop: false,
          captureUpdate: "EVENTUALLY"
        });
        if (newBoundaryId) {
          const els = runtimeContext.ea.getViewElements();
          let parentBoundaryIndex = -1;
          let curr = sel;
          while (curr) {
            const parent = runtimeContext.getParentNode(curr.id, els);
            if (!parent) break;
            if (parent.customData?.boundaryId) {
              const pIndex = els.findIndex((el) => el.id === parent.customData.boundaryId);
              if (pIndex !== -1) {
                parentBoundaryIndex = pIndex;
                break;
              }
            }
            curr = parent;
          }
          const targetIndex = parentBoundaryIndex !== -1 ? parentBoundaryIndex + 1 : 0;
          runtimeContext.ea.moveViewElementToZIndex(newBoundaryId, targetIndex);
        }
        await runtimeContext.triggerGlobalLayout(info.rootId);
      }
      runtimeContext.updateUI();
    };
    return { getAngleFromCenter, getConvexHull, updateNodeBoundary, toggleBoundary };
  }

  // src/scripts/mindmap-builder/arrows.js
  function createArrows(runtimeContext) {
    const addUpdateArrowLabel = (arrow, text) => {
      if (!arrow) {
        return;
      }
      const maybeTextElement = runtimeContext.ea.getBoundTextElement(arrow, true);
      let textElement = maybeTextElement.eaElement;
      if (!textElement && maybeTextElement.sceneElement) {
        runtimeContext.ea.copyViewElementsToEAforEditing([maybeTextElement.sceneElement]);
        textElement = runtimeContext.ea.getElement(maybeTextElement.sceneElement.id);
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
      const x = arrow.x + arrow.width / 2;
      const y = arrow.y + arrow.height / 2;
      const textId = runtimeContext.ea.addText(x, y, text);
      const textEl = runtimeContext.ea.getElement(textId);
      textEl.strokeColor = arrow.strokeColor;
      textEl.containerId = arrow.id;
      textEl.textAlign = "center";
      textEl.textVerticalAlign = "middle";
      textEl.fontSize = Math.floor(textEl.fontSize / 2);
      arrow.boundElements = [
        {
          type: "text",
          id: textId
        }
      ];
    };
    const configureArrow = (context) => {
      const {
        arrowId,
        isChildRight,
        isChildBelow,
        startId,
        endId,
        coordinates,
        isRadial,
        layoutDirection
      } = context;
      const { sX, sY, eX, eY } = coordinates;
      const eaArrow = runtimeContext.ea.getElement(arrowId);
      const isVertical = layoutDirection === "vertical";
      if (isVertical) {
        const startRatio = isRadial ? 0.50001 : isChildBelow ? 0.9999 : 1e-4;
        const endRatio = isChildBelow ? 1e-4 : 0.9999;
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
        if (runtimeContext.arrowType === "straight") {
          eaArrow.roundness = null;
          eaArrow.points = [
            [0, 0],
            [dx, dy]
          ];
        } else {
          eaArrow.roundness = {
            type: 2
          };
          if (isRadial) {
            eaArrow.points = [
              [0, 0],
              [dx * 0.75, dy * 2 / 3],
              [dx, dy]
            ];
          } else {
            eaArrow.points = [
              [0, 0],
              [dx * 0.25, dy / 3],
              [dx * 0.75, dy * 2 / 3],
              [dx, dy]
            ];
          }
        }
      } else {
        const startRatio = isRadial ? 0.50001 : isChildRight ? 0.9999 : 1e-4;
        const endRatio = isChildRight ? 1e-4 : 0.9999;
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
        if (runtimeContext.arrowType === "straight") {
          eaArrow.roundness = null;
          eaArrow.points = [
            [0, 0],
            [dx, dy]
          ];
        } else {
          eaArrow.roundness = {
            type: 2
          };
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
      }
    };
    const updateL1Arrow = (node, context, layoutDirection = "horizontal") => {
      const { rootId, rootCenter, mode } = context;
      const arrow = runtimeContext.ea.getElements().find(
        (a) => a.type === "arrow" && a.customData?.isBranch && a.startBinding?.elementId === rootId && a.endBinding?.elementId === node.id
      );
      if (arrow) {
        const childNode = runtimeContext.ea.getElement(node.id);
        const rootNode = runtimeContext.ea.getElement(rootId);
        if (!childNode || !rootNode) return;
        const isRadial = mode === "Radial";
        if (layoutDirection === "vertical") {
          const childCenterY = childNode.y + childNode.height / 2;
          const isChildBelow = childCenterY > rootCenter.y;
          const sX = rootCenter.x;
          const sY = isRadial ? rootCenter.y : isChildBelow ? rootNode.y + rootNode.height : rootNode.y;
          const eX = childNode.x + childNode.width / 2;
          const eY = isChildBelow ? childNode.y : childNode.y + childNode.height;
          configureArrow({
            arrowId: arrow.id,
            isChildBelow,
            startId: rootId,
            endId: node.id,
            coordinates: {
              sX,
              sY,
              eX,
              eY
            },
            isRadial,
            layoutDirection
          });
        } else {
          const childCenterX = childNode.x + childNode.width / 2;
          const isChildRight = childCenterX > rootCenter.x;
          const sX = isRadial ? rootCenter.x : isChildRight ? rootNode.x + rootNode.width : rootNode.x;
          const sY = rootCenter.y;
          const eX = isChildRight ? childNode.x : childNode.x + childNode.width;
          const eY = childNode.y + childNode.height / 2;
          configureArrow({
            arrowId: arrow.id,
            isChildRight,
            startId: rootId,
            endId: node.id,
            coordinates: {
              sX,
              sY,
              eX,
              eY
            },
            isRadial,
            layoutDirection
          });
        }
      }
    };
    const reconnectArrow = (currentBindingElement, newBindingElement, arrow, side = "start") => {
      const elementsToCheck = [currentBindingElement, newBindingElement, arrow];
      const elementsToCopy = elementsToCheck.filter((el) => !runtimeContext.ea.getElement(el.id));
      if (elementsToCopy.length > 0) {
        runtimeContext.ea.copyViewElementsToEAforEditing(elementsToCopy);
      }
      const oldNode = runtimeContext.ea.getElement(currentBindingElement.id);
      const newNode = runtimeContext.ea.getElement(newBindingElement.id);
      const targetArrow = runtimeContext.ea.getElement(arrow.id);
      const bindingKey = side === "start" ? "startBinding" : "endBinding";
      targetArrow[bindingKey] = {
        ...targetArrow[bindingKey] || {},
        elementId: newNode.id
      };
      if (oldNode.boundElements) {
        oldNode.boundElements = oldNode.boundElements.filter((be) => be.id !== targetArrow.id);
      }
      if (!newNode.boundElements) newNode.boundElements = [];
      if (!newNode.boundElements.some((be) => be.id === targetArrow.id)) {
        newNode.boundElements.push({
          type: "arrow",
          id: targetArrow.id
        });
      }
    };
    return { addUpdateArrowLabel, configureArrow, updateL1Arrow, reconnectArrow };
  }

  // src/scripts/mindmap-builder/horizontalLayout.js
  function createHorizontalLayout(runtimeContext) {
    const layoutChildrenAsAdditionalRoot = (nodeId, allElements, hasGlobalFolds, childrenByParent, heightCache, widthCache, elementById, mustHonorMindmapOrder = false, parentMap = null) => {
      const node = elementById?.get(nodeId) ?? allElements.find((el) => el.id === nodeId);
      if (!node || node.customData?.isAdditionalRoot !== true) return false;
      const l1Nodes = runtimeContext.getChildrenNodes(nodeId, allElements);
      if (l1Nodes.length === 0) return false;
      runtimeContext.withRootLayoutContext(node, (cfg) => {
        const localHeightCache = heightCache ?? /* @__PURE__ */ new Map();
        const localWidthCache = widthCache ?? /* @__PURE__ */ new Map();
        const eaNode = runtimeContext.ea.getElement(nodeId);
        if (!eaNode) return;
        const rootBox = runtimeContext.getNodeBox(eaNode, allElements);
        const rootCenter = {
          x: rootBox.minX + rootBox.width / 2,
          y: rootBox.minY + rootBox.height / 2
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
          parentMap
        };
        if (!mustHonorMindmapOrder) {
          runtimeContext.sortL1NodesBasedOnVisualSequence(l1Nodes, mode, rootCenter);
        }
        if (mode === "Radial") {
          runtimeContext.layoutL1Nodes(
            l1Nodes,
            {
              sortMethod: "radial",
              centerAngle: null,
              gapMultiplier: runtimeContext.layoutSettings.GAP_MULTIPLIER_RADIAL,
              fillSweep: cfg.fillSweep
            },
            layoutContext,
            mustHonorMindmapOrder
          );
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
            runtimeContext.layoutL1Nodes(
              rightNodes,
              {
                sortMethod: "vertical",
                centerAngle: 90,
                gapMultiplier: runtimeContext.layoutSettings.GAP_MULTIPLIER_DIRECTIONAL
              },
              layoutContext,
              mustHonorMindmapOrder
            );
          }
          if (leftNodes.length > 0) {
            runtimeContext.layoutL1Nodes(
              leftNodes,
              {
                sortMethod: "vertical",
                centerAngle: 270,
                gapMultiplier: runtimeContext.layoutSettings.GAP_MULTIPLIER_DIRECTIONAL
              },
              layoutContext,
              mustHonorMindmapOrder
            );
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
        layoutContext.widthCache = /* @__PURE__ */ new Map();
        if (downNodes.length > 0) {
          runtimeContext.layoutL1Nodes(
            downNodes,
            {
              sortMethod: "horizontal",
              centerAngle: 90,
              gapMultiplier: runtimeContext.layoutSettings.GAP_MULTIPLIER_DIRECTIONAL
            },
            layoutContext,
            mustHonorMindmapOrder
          );
        }
        if (upNodes.length > 0) {
          runtimeContext.layoutL1Nodes(
            upNodes,
            {
              sortMethod: "horizontal",
              centerAngle: 270,
              gapMultiplier: runtimeContext.layoutSettings.GAP_MULTIPLIER_DIRECTIONAL
            },
            layoutContext,
            mustHonorMindmapOrder
          );
        }
      });
      return true;
    };
    const layoutSubtree = (nodeId, targetX, targetCenterY, side, allElements, hasGlobalFolds, childrenByParent, heightCache, elementById, mustHonorMindmapOrder = false, rootId, parentMap = null) => {
      const node = elementById?.get(nodeId) ?? allElements.find((el) => el.id === nodeId);
      const eaNode = runtimeContext.ea.getElement(nodeId);
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
      const parent = runtimeContext.getParentNode(nodeId, allElements, parentMap);
      if (parent) {
        const parentCenterX = parent.x + parent.width / 2;
        const nodeCenterX = currentX + node.width / 2;
        effectiveSide = nodeCenterX >= parentCenterX ? 1 : -1;
      }
      if (node.customData?.foldIndicatorId) {
        const ind = runtimeContext.ea.getElement(node.customData.foldIndicatorId);
        if (ind) {
          if (effectiveSide === 1) {
            ind.x = eaNode.x + eaNode.width + runtimeContext.layoutSettings.INDICATOR_OFFSET;
            ind.textAlign = "left";
          } else {
            ind.x = eaNode.x - runtimeContext.layoutSettings.INDICATOR_OFFSET - ind.width;
            ind.textAlign = "right";
          }
          ind.y = eaNode.y + eaNode.height / 2 - ind.height / 2;
        }
      }
      const textElement = runtimeContext.ea.getBoundTextElement(eaNode).eaElement;
      if (textElement && !runtimeContext.centerText && textElement.textAlign !== "center") {
        textElement.textAlign = effectiveSide === 1 ? "left" : "right";
      }
      const children = childrenByParent?.get(nodeId) ?? runtimeContext.getChildrenNodes(nodeId, allElements);
      if (node.customData?.isAdditionalRoot === true) {
        if (node.customData?.autoLayoutDisabled) {
          if (dx !== 0 || dy !== 0) {
            const branchIds = runtimeContext.getBranchElementIds(nodeId, allElements);
            const descendants = branchIds.filter((id) => id !== nodeId);
            descendants.forEach((descId) => {
              const descNode = elementById?.get(descId) ?? allElements.find((e) => e.id === descId);
              if (descNode?.customData?.isPinned) return;
              if (descNode && descNode.type === "arrow" && !descNode.customData?.isBranch) return;
              if (!runtimeContext.ea.getElement(descId)) {
                if (descNode) runtimeContext.ea.copyViewElementsToEAforEditing([descNode]);
              }
              const descEl = runtimeContext.ea.getElement(descId);
              if (descEl) {
                descEl.x += dx;
                descEl.y += dy;
              }
            });
          }
        } else {
          layoutChildrenAsAdditionalRoot(
            nodeId,
            allElements,
            hasGlobalFolds,
            childrenByParent,
            heightCache,
            null,
            elementById,
            mustHonorMindmapOrder,
            parentMap
          );
        }
        if (node.customData?.boundaryId) {
          runtimeContext.updateNodeBoundary(node, runtimeContext.ea.getElements(), rootId);
        }
        return;
      }
      const unpinnedChildren = children.filter((child) => !child.customData?.isPinned);
      const pinnedChildren = children.filter((child) => child.customData?.isPinned);
      if (unpinnedChildren.length > 0) {
        unpinnedChildren.sort((a, b) => {
          if (mustHonorMindmapOrder) {
            return runtimeContext.getMindmapOrder(a) - runtimeContext.getMindmapOrder(b);
          }
          const dy2 = a.y - b.y;
          if (dy2 !== 0) return dy2;
          return String(a.id).localeCompare(String(b.id));
        });
        if (!mustHonorMindmapOrder) {
          unpinnedChildren.forEach((child, i) => {
            if (runtimeContext.getMindmapOrder(child) !== i) {
              runtimeContext.ea.addAppendUpdateCustomData(child.id, {
                mindmapOrder: i
              });
            }
          });
        }
        const subtreeHeight = runtimeContext.getSubtreeHeight(
          nodeId,
          allElements,
          childrenByParent,
          heightCache,
          elementById
        );
        let currentY = currentYCenter - subtreeHeight / 2;
        const dynamicGapX = runtimeContext.layoutSettings.GAP_X;
        unpinnedChildren.forEach((child) => {
          const childH = runtimeContext.getSubtreeHeight(
            child.id,
            allElements,
            childrenByParent,
            heightCache,
            elementById
          );
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
            parentMap
          );
          const childNode = elementById?.get(child.id) ?? allElements.find((el) => el.id === child.id);
          const grandChildren = childrenByParent?.get(child.id) ?? runtimeContext.getChildrenNodes(child.id, allElements);
          const hasUnpinnedGrandChildren = grandChildren.some((gc) => !gc.customData?.isPinned);
          const fontSize = childNode.fontSize ?? 20;
          const gap = !hasUnpinnedGrandChildren ? Math.round(fontSize * runtimeContext.layoutSettings.GAP_MULTIPLIER) : runtimeContext.layoutSettings.GAP_Y;
          currentY += childH + gap;
        });
      }
      pinnedChildren.forEach(
        (child) => layoutSubtree(
          child.id,
          child.x,
          child.y + child.height / 2,
          effectiveSide,
          allElements,
          hasGlobalFolds,
          childrenByParent,
          heightCache,
          elementById,
          mustHonorMindmapOrder,
          rootId,
          parentMap
        )
      );
      children.forEach((child) => {
        const arrow = allElements.find(
          (a) => a.type === "arrow" && a.customData?.isBranch && a.startBinding?.elementId === nodeId && a.endBinding?.elementId === child.id
        );
        if (arrow) {
          const eaChild = runtimeContext.ea.getElement(child.id);
          const childCenterX = eaChild.x + eaChild.width / 2;
          const parentCenterX = currentX + node.width / 2;
          const isChildRight = childCenterX > parentCenterX;
          const sX = isChildRight ? currentX + node.width : currentX;
          const sY = currentYCenter;
          const eX = isChildRight ? eaChild.x : eaChild.x + eaChild.width;
          const eY = eaChild.y + eaChild.height / 2;
          runtimeContext.configureArrow({
            arrowId: arrow.id,
            isChildRight,
            startId: node.id,
            endId: child.id,
            coordinates: {
              sX,
              sY,
              eX,
              eY
            }
          });
        }
      });
      if (node.customData?.boundaryId) {
        runtimeContext.updateNodeBoundary(node, runtimeContext.ea.getElements(), rootId);
      }
    };
    return { layoutChildrenAsAdditionalRoot, layoutSubtree };
  }

  // src/scripts/mindmap-builder/verticalLayout.js
  function createVerticalLayout(runtimeContext) {
    const layoutSubtreeVertical = (nodeId, targetCenterX, targetY, side, allElements, hasGlobalFolds, childrenByParent, widthCache, elementById, mustHonorMindmapOrder = false, rootId, parentMap = null) => {
      const node = elementById?.get(nodeId) ?? allElements.find((el) => el.id === nodeId);
      const eaNode = runtimeContext.ea.getElement(nodeId);
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
      const parent = runtimeContext.getParentNode(nodeId, allElements, parentMap);
      if (parent) {
        const parentCenterY = parent.y + parent.height / 2;
        const nodeCenterY = currentY + node.height / 2;
        effectiveSide = nodeCenterY >= parentCenterY ? 1 : -1;
      }
      if (node.customData?.foldIndicatorId) {
        const ind = runtimeContext.ea.getElement(node.customData.foldIndicatorId);
        if (ind) {
          ind.x = eaNode.x + eaNode.width / 2 - ind.width / 2;
          if (effectiveSide === 1) {
            ind.y = eaNode.y + eaNode.height + runtimeContext.layoutSettings.INDICATOR_OFFSET;
            ind.textAlign = "center";
          } else {
            ind.y = eaNode.y - runtimeContext.layoutSettings.INDICATOR_OFFSET - ind.height;
            ind.textAlign = "center";
          }
        }
      }
      const textElement = runtimeContext.ea.getBoundTextElement(eaNode).eaElement;
      if (textElement && !runtimeContext.centerText && textElement.textAlign !== "center") {
        textElement.textAlign = "center";
      }
      const children = childrenByParent?.get(nodeId) ?? runtimeContext.getChildrenNodes(nodeId, allElements);
      if (node.customData?.isAdditionalRoot === true) {
        if (node.customData?.autoLayoutDisabled) {
          if (dx !== 0 || dy !== 0) {
            const branchIds = runtimeContext.getBranchElementIds(nodeId, allElements);
            const descendants = branchIds.filter((id) => id !== nodeId);
            descendants.forEach((descId) => {
              const descNode = elementById?.get(descId) ?? allElements.find((e) => e.id === descId);
              if (descNode?.customData?.isPinned) return;
              if (descNode && descNode.type === "arrow" && !descNode.customData?.isBranch) return;
              if (!runtimeContext.ea.getElement(descId)) {
                if (descNode) runtimeContext.ea.copyViewElementsToEAforEditing([descNode]);
              }
              const descEl = runtimeContext.ea.getElement(descId);
              if (descEl) {
                descEl.x += dx;
                descEl.y += dy;
              }
            });
          }
        } else {
          runtimeContext.layoutChildrenAsAdditionalRoot(
            nodeId,
            allElements,
            hasGlobalFolds,
            childrenByParent,
            null,
            widthCache,
            elementById,
            mustHonorMindmapOrder,
            parentMap
          );
        }
        if (node.customData?.boundaryId) {
          runtimeContext.updateNodeBoundary(node, runtimeContext.ea.getElements(), rootId);
        }
        return;
      }
      const unpinnedChildren = children.filter((child) => !child.customData?.isPinned);
      const pinnedChildren = children.filter((child) => child.customData?.isPinned);
      if (unpinnedChildren.length > 0) {
        unpinnedChildren.sort((a, b) => {
          if (mustHonorMindmapOrder) {
            return runtimeContext.getMindmapOrder(a) - runtimeContext.getMindmapOrder(b);
          }
          const dx2 = a.x - b.x;
          if (dx2 !== 0) return dx2;
          return String(a.id).localeCompare(String(b.id));
        });
        if (!mustHonorMindmapOrder) {
          unpinnedChildren.forEach((child, i) => {
            if (runtimeContext.getMindmapOrder(child) !== i) {
              runtimeContext.ea.addAppendUpdateCustomData(child.id, {
                mindmapOrder: i
              });
            }
          });
        }
        const placementWidthCache = /* @__PURE__ */ new Map();
        const childWidths = unpinnedChildren.map(
          (child) => runtimeContext.getVerticalPlacementWidth(
            child.id,
            allElements,
            childrenByParent,
            widthCache,
            elementById,
            placementWidthCache
          )
        );
        const childrenRowWidth = childWidths.reduce((sum, width, index) => {
          const childNode = elementById?.get(unpinnedChildren[index].id) ?? allElements.find((el) => el.id === unpinnedChildren[index].id);
          const grandChildren = childrenByParent?.get(unpinnedChildren[index].id) ?? runtimeContext.getChildrenNodes(unpinnedChildren[index].id, allElements);
          const hasUnpinnedGrandChildren = grandChildren.some((gc) => !gc.customData?.isPinned);
          const fontSize = childNode?.fontSize ?? 20;
          const gap = index < unpinnedChildren.length - 1 ? !hasUnpinnedGrandChildren ? Math.round(fontSize * runtimeContext.layoutSettings.GAP_MULTIPLIER) : runtimeContext.layoutSettings.GAP_Y : 0;
          return sum + width + gap;
        }, 0);
        let currentX = currentXCenter - childrenRowWidth / 2;
        const allChildrenCompact = unpinnedChildren.every((child) => {
          const grandChildren = childrenByParent?.get(child.id) ?? runtimeContext.getChildrenNodes(child.id, allElements);
          return !grandChildren.some((gc) => !gc.customData?.isPinned);
        });
        const compactGap = Math.max(
          runtimeContext.layoutSettings.GAP_Y,
          Math.round(
            runtimeContext.layoutSettings.GAP_X * (runtimeContext.layoutSettings.VERTICAL_COMPACT_PARENT_CHILD_GAP_RATIO ?? runtimeContext.LAYOUT_METADATA.VERTICAL_COMPACT_PARENT_CHILD_GAP_RATIO.def)
          )
        );
        const dynamicGapPrimary = unpinnedChildren.length <= 2 && allChildrenCompact ? compactGap : runtimeContext.layoutSettings.GAP_X;
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
            parentMap
          );
          const childNode = elementById?.get(child.id) ?? allElements.find((el) => el.id === child.id);
          const grandChildren = childrenByParent?.get(child.id) ?? runtimeContext.getChildrenNodes(child.id, allElements);
          const hasUnpinnedGrandChildren = grandChildren.some((gc) => !gc.customData?.isPinned);
          const fontSize = childNode.fontSize ?? 20;
          const gap = !hasUnpinnedGrandChildren ? Math.round(fontSize * runtimeContext.layoutSettings.GAP_MULTIPLIER) : runtimeContext.layoutSettings.GAP_Y;
          currentX += childW + gap;
        });
      }
      pinnedChildren.forEach(
        (child) => layoutSubtreeVertical(
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
          parentMap
        )
      );
      children.forEach((child) => {
        const arrow = allElements.find(
          (a) => a.type === "arrow" && a.customData?.isBranch && a.startBinding?.elementId === nodeId && a.endBinding?.elementId === child.id
        );
        if (arrow) {
          const eaChild = runtimeContext.ea.getElement(child.id);
          const childCenterY = eaChild.y + eaChild.height / 2;
          const parentCenterY = currentY + node.height / 2;
          const isChildBelow = childCenterY > parentCenterY;
          const sX = currentXCenter;
          const sY = isChildBelow ? currentY + node.height : currentY;
          const eX = eaChild.x + eaChild.width / 2;
          const eY = isChildBelow ? eaChild.y : eaChild.y + eaChild.height;
          runtimeContext.configureArrow({
            arrowId: arrow.id,
            isChildBelow,
            startId: node.id,
            endId: child.id,
            coordinates: {
              sX,
              sY,
              eX,
              eY
            },
            layoutDirection: "vertical"
          });
        }
      });
      if (node.customData?.boundaryId) {
        runtimeContext.updateNodeBoundary(node, runtimeContext.ea.getElements(), rootId);
      }
    };
    return { layoutSubtreeVertical };
  }

  // src/scripts/mindmap-builder/firstLevelLayout.js
  function createFirstLevelLayout(runtimeContext) {
    const radialL1Distribution = (nodes, context, l1Metrics, totalSubtreeHeight, options, mustHonorMindmapOrder = false) => {
      const {
        allElements,
        rootBox,
        rootCenter,
        hasGlobalFolds,
        childrenByParent,
        heightCache,
        elementById,
        rootId,
        parentMap
      } = context;
      const count = nodes.length;
      const START_ANGLE = runtimeContext.layoutSettings.RADIAL_START_ANGLE;
      const MAX_SWEEP_DEG = options.fillSweep ? runtimeContext.layoutSettings.RADIAL_MAX_SWEEP : Math.min(
        runtimeContext.layoutSettings.RADIAL_MAX_SWEEP / 8 * count,
        runtimeContext.layoutSettings.RADIAL_MAX_SWEEP
      );
      const ASPECT_RATIO = runtimeContext.layoutSettings.RADIAL_ASPECT_RATIO;
      const POLE_GAP_BONUS = runtimeContext.layoutSettings.RADIAL_POLE_GAP_BONUS;
      const BASE_GAP = runtimeContext.layoutSettings.GAP_Y * 2;
      const minRadiusY = Math.max(
        Math.round(
          Math.max(rootBox.height, rootBox.width) * runtimeContext.layoutSettings.ROOT_RADIUS_FACTOR * 1.5
        ),
        runtimeContext.layoutSettings.MIN_RADIUS
      );
      const minRadiusX = minRadiusY * ASPECT_RATIO;
      let simAngle = START_ANGLE;
      let totalRequiredSpan = 0;
      const nodeSimData = nodes.map((node, i) => {
        const rad = simAngle * (Math.PI / 180);
        const localR = minRadiusX * minRadiusY / Math.sqrt(
          Math.pow(minRadiusY * Math.cos(rad), 2) + Math.pow(minRadiusX * Math.sin(rad), 2)
        );
        const sinComp = Math.abs(Math.sin(rad));
        const cosComp = Math.abs(Math.cos(rad));
        const effSize = node.width * sinComp + l1Metrics[i] * cosComp;
        const nodeSpan = effSize / localR * (180 / Math.PI);
        const isLast = i === count - 1;
        const dynamicGapPx = isLast ? 0 : BASE_GAP * (1 + sinComp * POLE_GAP_BONUS);
        const gapSpan = dynamicGapPx / localR * (180 / Math.PI);
        const totalSpan = nodeSpan + gapSpan;
        simAngle += totalSpan;
        totalRequiredSpan += totalSpan;
        return {
          node,
          nodeSpan,
          gapSpan
        };
      });
      let finalRadiusY = minRadiusY;
      let angleExpansionFactor = 1;
      if (totalRequiredSpan > MAX_SWEEP_DEG) {
        const radiusScale = totalRequiredSpan / MAX_SWEEP_DEG;
        finalRadiusY = minRadiusY * radiusScale;
        angleExpansionFactor = 1 / radiusScale;
      } else {
        angleExpansionFactor = MAX_SWEEP_DEG / totalRequiredSpan;
      }
      const finalRadiusX = finalRadiusY * ASPECT_RATIO;
      let currentAngle = START_ANGLE;
      nodes.forEach((node, i) => {
        const isPinned = node.customData?.isPinned === true;
        const hasBoundary = !!node.customData?.boundaryId;
        const data = nodeSimData[i];
        const realNodeSpan = data.nodeSpan * angleExpansionFactor;
        const realGapSpan = data.gapSpan * angleExpansionFactor;
        const placementAngle = currentAngle + realNodeSpan / 2;
        const normAngle = (placementAngle % 360 + 360) % 360;
        const dynamicSide = normAngle > 90 && normAngle < 270 ? -1 : 1;
        const rad = placementAngle * (Math.PI / 180);
        const finalLocalR = finalRadiusX * finalRadiusY / Math.sqrt(
          Math.pow(finalRadiusY * Math.cos(rad), 2) + Math.pow(finalRadiusX * Math.sin(rad), 2)
        );
        const placeR = hasBoundary ? finalLocalR * 1 : finalLocalR;
        const tCX = rootCenter.x + placeR * Math.cos(rad);
        const tCY = rootCenter.y + placeR * Math.sin(rad);
        if (isPinned) {
          runtimeContext.layoutSubtree(
            node.id,
            node.x,
            node.y + node.height / 2,
            dynamicSide,
            allElements,
            hasGlobalFolds,
            childrenByParent,
            heightCache,
            elementById,
            mustHonorMindmapOrder,
            rootId,
            parentMap
          );
        } else {
          runtimeContext.layoutSubtree(
            node.id,
            tCX,
            tCY,
            dynamicSide,
            allElements,
            hasGlobalFolds,
            childrenByParent,
            heightCache,
            elementById,
            mustHonorMindmapOrder,
            rootId,
            parentMap
          );
        }
        currentAngle += realNodeSpan + realGapSpan;
        if (node.customData?.mindmapNew) {
          runtimeContext.ea.addAppendUpdateCustomData(node.id, {
            mindmapNew: void 0
          });
        }
        runtimeContext.updateL1Arrow(node, context);
        if (runtimeContext.groupBranches) runtimeContext.applyRecursiveGrouping(node.id, allElements);
      });
    };
    const verticalL1Distribution = (nodes, context, l1Metrics, totalSubtreeHeight, isLeftSide, centerAngle, gapMultiplier, mustHonorMindmapOrder = false) => {
      const {
        allElements,
        rootBox,
        rootCenter,
        hasGlobalFolds,
        childrenByParent,
        heightCache,
        elementById,
        rootId,
        parentMap
      } = context;
      const count = nodes.length;
      const totalContentHeight = totalSubtreeHeight + (count - 1) * runtimeContext.layoutSettings.GAP_Y;
      const radiusFromHeight = totalContentHeight / runtimeContext.layoutSettings.DIRECTIONAL_ARC_SPAN_RADIANS;
      const radiusY = Math.max(
        Math.round(rootBox.height * runtimeContext.layoutSettings.ROOT_RADIUS_FACTOR),
        runtimeContext.layoutSettings.MIN_RADIUS,
        radiusFromHeight
      ) + count * runtimeContext.layoutSettings.RADIUS_PADDING_PER_NODE;
      const crossAxisRatio = runtimeContext.layoutSettings.DIRECTIONAL_CROSS_AXIS_RATIO ?? runtimeContext.LAYOUT_METADATA.DIRECTIONAL_CROSS_AXIS_RATIO.def;
      const radiusX = Math.max(
        Math.round(rootBox.width * runtimeContext.layoutSettings.ROOT_RADIUS_FACTOR),
        runtimeContext.layoutSettings.MIN_RADIUS,
        radiusY * crossAxisRatio
      ) + count * runtimeContext.layoutSettings.RADIUS_PADDING_PER_NODE;
      const totalThetaDeg = totalContentHeight / radiusY * (180 / Math.PI);
      let currentAngle = isLeftSide ? centerAngle + totalThetaDeg / 2 : centerAngle - totalThetaDeg / 2;
      nodes.forEach((node, i) => {
        const nodeHeight = l1Metrics[i];
        const isPinned = node.customData?.isPinned === true;
        const side = isLeftSide ? -1 : 1;
        const getAngularInfo = (targetNode, height) => {
          const angleRad = Math.atan2(
            targetNode.y + targetNode.height / 2 - rootCenter.y,
            targetNode.x + targetNode.width / 2 - rootCenter.x
          );
          const angleDeg = angleRad * (180 / Math.PI) + 90;
          const normAngle = angleDeg < 0 ? angleDeg + 360 : angleDeg;
          const spanDeg = height / radiusY * (180 / Math.PI);
          return {
            center: normAngle,
            span: spanDeg,
            start: normAngle - spanDeg / 2,
            end: normAngle + spanDeg / 2
          };
        };
        const effectiveGap = runtimeContext.layoutSettings.GAP_Y * gapMultiplier;
        const gapSpanDeg = effectiveGap / radiusY * (180 / Math.PI);
        const nodeSpanDeg = nodeHeight / radiusY * (180 / Math.PI);
        if (isPinned) {
          runtimeContext.layoutSubtree(
            node.id,
            node.x,
            node.y + node.height / 2,
            side,
            allElements,
            hasGlobalFolds,
            childrenByParent,
            heightCache,
            elementById,
            mustHonorMindmapOrder,
            rootId,
            parentMap
          );
          const info = getAngularInfo(node, nodeHeight);
          if (isLeftSide) {
            if (currentAngle > info.start - gapSpanDeg) currentAngle = info.start - gapSpanDeg;
          } else {
            if (currentAngle < info.end + gapSpanDeg) currentAngle = info.end + gapSpanDeg;
          }
        } else {
          const nextPinned = nodes.slice(i + 1).find((n) => n.customData?.isPinned);
          if (nextPinned) {
            const nextInfo = getAngularInfo(
              nextPinned,
              runtimeContext.getSubtreeHeight(
                nextPinned.id,
                allElements,
                childrenByParent,
                heightCache,
                elementById
              )
            );
            if (isLeftSide) {
              if (currentAngle - nodeSpanDeg < nextInfo.end + gapSpanDeg)
                currentAngle = nextInfo.start - gapSpanDeg;
            } else {
              if (currentAngle + nodeSpanDeg > nextInfo.start - gapSpanDeg)
                currentAngle = nextInfo.end + gapSpanDeg;
            }
          }
          let angleDeg = isLeftSide ? currentAngle - nodeSpanDeg / 2 : currentAngle + nodeSpanDeg / 2;
          currentAngle = isLeftSide ? currentAngle - (nodeSpanDeg + gapSpanDeg) : currentAngle + (nodeSpanDeg + gapSpanDeg);
          const angleRad = (angleDeg - 90) * (Math.PI / 180);
          const tCX = rootCenter.x + radiusX * Math.cos(angleRad);
          const tCY = rootCenter.y + radiusY * Math.sin(angleRad);
          runtimeContext.layoutSubtree(
            node.id,
            tCX,
            tCY,
            side,
            allElements,
            hasGlobalFolds,
            childrenByParent,
            heightCache,
            elementById,
            mustHonorMindmapOrder,
            rootId,
            parentMap
          );
        }
        if (node.customData?.mindmapNew) {
          runtimeContext.ea.addAppendUpdateCustomData(node.id, {
            mindmapNew: void 0
          });
        }
        runtimeContext.updateL1Arrow(node, context);
        if (runtimeContext.groupBranches) runtimeContext.applyRecursiveGrouping(node.id, allElements);
      });
    };
    const horizontalL1Distribution = (nodes, context, l1Metrics, totalSubtreeWidth, isTopSide, centerAngle, gapMultiplier, mustHonorMindmapOrder = false) => {
      const {
        allElements,
        rootBox,
        rootCenter,
        hasGlobalFolds,
        childrenByParent,
        widthCache,
        elementById,
        rootId,
        parentMap
      } = context;
      const count = nodes.length;
      const compressDirectionalWidth = (node, rawWidth) => {
        const nodeWidth = Math.max(node?.width ?? 0, 1);
        if (rawWidth <= nodeWidth) return rawWidth;
        const extra = rawWidth - nodeWidth;
        const softCapThreshold = runtimeContext.layoutSettings.HORIZONTAL_L1_SOFTCAP_THRESHOLD ?? runtimeContext.LAYOUT_METADATA.HORIZONTAL_L1_SOFTCAP_THRESHOLD.def;
        if (extra <= softCapThreshold) return rawWidth;
        const remaining = extra - softCapThreshold;
        const compressionMinScale = runtimeContext.layoutSettings.HORIZONTAL_L1_COMPRESSION_MIN_SCALE ?? runtimeContext.LAYOUT_METADATA.HORIZONTAL_L1_COMPRESSION_MIN_SCALE.def;
        const compressionScale = Math.max(
          compressionMinScale,
          (runtimeContext.layoutSettings.GAP_X ?? runtimeContext.LAYOUT_METADATA.GAP_X.def) * 2
        );
        const compressedRemaining = compressionScale * Math.log1p(remaining / compressionScale);
        return nodeWidth + softCapThreshold + compressedRemaining;
      };
      const effectiveWidths = nodes.map((node, i) => compressDirectionalWidth(node, l1Metrics[i]));
      const effectiveWidthById = new Map(nodes.map((node, i) => [node.id, effectiveWidths[i]]));
      const totalEffectiveWidth = effectiveWidths.reduce((sum, width) => sum + width, 0);
      const effectiveGap = runtimeContext.layoutSettings.GAP_Y * gapMultiplier;
      const totalContentWidth = totalEffectiveWidth + (count - 1) * effectiveGap;
      const baseArcSpan = runtimeContext.layoutSettings.DIRECTIONAL_ARC_SPAN_RADIANS;
      const baselineRadius = Math.max(
        Math.round(rootBox.width * runtimeContext.layoutSettings.ROOT_RADIUS_FACTOR),
        runtimeContext.layoutSettings.MIN_RADIUS
      ) + count * runtimeContext.layoutSettings.RADIUS_PADDING_PER_NODE;
      const pressure = totalContentWidth / Math.max(1, baselineRadius * baseArcSpan);
      const adaptiveArcSpan = Math.min(
        Math.PI,
        Math.max(baseArcSpan, baseArcSpan * Math.sqrt(Math.max(1, pressure)))
      );
      const radiusFromWidth = totalContentWidth / adaptiveArcSpan;
      const radiusX = Math.max(
        Math.round(rootBox.width * runtimeContext.layoutSettings.ROOT_RADIUS_FACTOR),
        runtimeContext.layoutSettings.MIN_RADIUS,
        radiusFromWidth
      ) + count * runtimeContext.layoutSettings.RADIUS_PADDING_PER_NODE;
      const crossAxisRatio = runtimeContext.layoutSettings.DIRECTIONAL_CROSS_AXIS_RATIO ?? runtimeContext.LAYOUT_METADATA.DIRECTIONAL_CROSS_AXIS_RATIO.def;
      const radiusY = Math.max(
        Math.round(rootBox.height * runtimeContext.layoutSettings.ROOT_RADIUS_FACTOR),
        runtimeContext.layoutSettings.MIN_RADIUS,
        radiusX * crossAxisRatio
      ) + count * runtimeContext.layoutSettings.RADIUS_PADDING_PER_NODE;
      const totalThetaDeg = totalContentWidth / radiusX * (180 / Math.PI);
      let currentAngle = isTopSide ? centerAngle - totalThetaDeg / 2 : centerAngle + totalThetaDeg / 2;
      nodes.forEach((node, i) => {
        const nodeWidth = effectiveWidths[i];
        const isPinned = node.customData?.isPinned === true;
        const side = isTopSide ? -1 : 1;
        const getAngularInfo = (targetNode, width) => {
          const angleRad = Math.atan2(
            targetNode.y + targetNode.height / 2 - rootCenter.y,
            targetNode.x + targetNode.width / 2 - rootCenter.x
          );
          const angleDeg = angleRad * (180 / Math.PI);
          const normAngle = angleDeg < 0 ? angleDeg + 360 : angleDeg;
          const spanDeg = width / radiusX * (180 / Math.PI);
          return {
            center: normAngle,
            span: spanDeg,
            start: normAngle - spanDeg / 2,
            end: normAngle + spanDeg / 2
          };
        };
        const gapSpanDeg = effectiveGap / radiusX * (180 / Math.PI);
        const nodeSpanDeg = nodeWidth / radiusX * (180 / Math.PI);
        if (isPinned) {
          runtimeContext.layoutSubtreeVertical(
            node.id,
            node.x + node.width / 2,
            node.y,
            side,
            allElements,
            hasGlobalFolds,
            childrenByParent,
            widthCache,
            elementById,
            mustHonorMindmapOrder,
            rootId,
            parentMap
          );
          const info = getAngularInfo(node, nodeWidth);
          if (isTopSide) {
            if (currentAngle < info.start - gapSpanDeg) currentAngle = info.start - gapSpanDeg;
          } else {
            if (currentAngle > info.end + gapSpanDeg) currentAngle = info.end + gapSpanDeg;
          }
        } else {
          const nextPinned = nodes.slice(i + 1).find((n) => n.customData?.isPinned);
          if (nextPinned) {
            const nextPinnedWidth = effectiveWidthById.get(nextPinned.id) ?? compressDirectionalWidth(
              nextPinned,
              runtimeContext.getSubtreeWidth(
                nextPinned.id,
                allElements,
                childrenByParent,
                widthCache,
                elementById
              )
            );
            const nextInfo = getAngularInfo(nextPinned, nextPinnedWidth);
            if (isTopSide) {
              if (currentAngle + nodeSpanDeg > nextInfo.start - gapSpanDeg)
                currentAngle = nextInfo.start - gapSpanDeg - nodeSpanDeg;
            } else {
              if (currentAngle - nodeSpanDeg < nextInfo.end + gapSpanDeg)
                currentAngle = nextInfo.end + gapSpanDeg + nodeSpanDeg;
            }
          }
          let angleDeg = isTopSide ? currentAngle + nodeSpanDeg / 2 : currentAngle - nodeSpanDeg / 2;
          currentAngle = isTopSide ? currentAngle + (nodeSpanDeg + gapSpanDeg) : currentAngle - (nodeSpanDeg + gapSpanDeg);
          const angleRad = angleDeg * (Math.PI / 180);
          const tCX = rootCenter.x + radiusX * Math.cos(angleRad);
          const tCY = rootCenter.y + radiusY * Math.sin(angleRad);
          runtimeContext.layoutSubtreeVertical(
            node.id,
            tCX,
            tCY,
            side,
            allElements,
            hasGlobalFolds,
            childrenByParent,
            widthCache,
            elementById,
            mustHonorMindmapOrder,
            rootId,
            parentMap
          );
        }
        if (node.customData?.mindmapNew) {
          runtimeContext.ea.addAppendUpdateCustomData(node.id, {
            mindmapNew: void 0
          });
        }
        runtimeContext.updateL1Arrow(node, context, "vertical");
        if (runtimeContext.groupBranches) runtimeContext.applyRecursiveGrouping(node.id, allElements);
      });
    };
    const layoutL1Nodes = (nodes, options, context, mustHonorMindmapOrder = false) => {
      if (nodes.length === 0) return false;
      const { allElements, childrenByParent, heightCache, widthCache, elementById } = context;
      const { sortMethod, centerAngle, gapMultiplier } = options;
      nodes.sort((a, b) => runtimeContext.getMindmapOrder(a) - runtimeContext.getMindmapOrder(b));
      if (sortMethod === "radial") {
        const l1Metrics = nodes.map(
          (node) => runtimeContext.getSubtreeHeight(
            node.id,
            allElements,
            childrenByParent,
            heightCache,
            elementById
          )
        );
        const totalSubtreeHeight = l1Metrics.reduce((sum, h) => sum + h, 0);
        radialL1Distribution(
          nodes,
          context,
          l1Metrics,
          totalSubtreeHeight,
          options,
          mustHonorMindmapOrder
        );
      } else if (sortMethod === "horizontal") {
        const l1Metrics = nodes.map(
          (node) => runtimeContext.getSubtreeWidth(
            node.id,
            allElements,
            childrenByParent,
            widthCache,
            elementById
          )
        );
        const totalSubtreeWidth = l1Metrics.reduce((sum, w) => sum + w, 0);
        const isTopSide = Math.abs((centerAngle ?? 0) - 270) < 1;
        horizontalL1Distribution(
          nodes,
          context,
          l1Metrics,
          totalSubtreeWidth,
          isTopSide,
          centerAngle,
          gapMultiplier,
          mustHonorMindmapOrder
        );
      } else {
        const l1Metrics = nodes.map(
          (node) => runtimeContext.getSubtreeHeight(
            node.id,
            allElements,
            childrenByParent,
            heightCache,
            elementById
          )
        );
        const totalSubtreeHeight = l1Metrics.reduce((sum, h) => sum + h, 0);
        const isLeftSide = sortMethod === "vertical" && Math.abs((centerAngle ?? 0) - 270) < 1;
        verticalL1Distribution(
          nodes,
          context,
          l1Metrics,
          totalSubtreeHeight,
          isLeftSide,
          centerAngle,
          gapMultiplier,
          mustHonorMindmapOrder
        );
      }
      return true;
    };
    const sortL1NodesBasedOnVisualSequence = (l1Nodes, mode, rootCenter) => {
      if (l1Nodes.length === 0) return false;
      let orderChanged = false;
      const isVerticalMode = ["Up-facing", "Down-facing", "Up-Down"].includes(mode);
      const sortByReadingOrder = (a, b) => {
        const aCX = a.x + a.width / 2;
        const bCX = b.x + b.width / 2;
        const aCY = a.y + a.height / 2;
        const bCY = b.y + b.height / 2;
        if (isVerticalMode) {
          const aIsBottom = aCY > rootCenter.y;
          const bIsBottom = bCY > rootCenter.y;
          if (aIsBottom !== bIsBottom) return aIsBottom ? -1 : 1;
          return aCX - bCX;
        } else {
          const aIsR = aCX > rootCenter.x;
          const bIsR = bCX > rootCenter.x;
          if (aIsR !== bIsR) return aIsR ? -1 : 1;
          return a.y - b.y;
        }
      };
      const sortByAngle = (a, b) => {
        return runtimeContext.getAngleFromCenter(rootCenter, {
          x: a.x + a.width / 2,
          y: a.y + a.height / 2
        }) - runtimeContext.getAngleFromCenter(rootCenter, {
          x: b.x + b.width / 2,
          y: b.y + b.height / 2
        });
      };
      const sortFn = mode === "Radial" ? sortByAngle : sortByReadingOrder;
      const existingNodes = l1Nodes.filter((n) => !n.customData?.mindmapNew);
      const newNodes = l1Nodes.filter((n) => n.customData?.mindmapNew);
      existingNodes.sort(sortFn);
      existingNodes.forEach((node, i) => {
        if (node.customData?.mindmapOrder !== i) {
          runtimeContext.ea.addAppendUpdateCustomData(node.id, {
            mindmapOrder: i
          });
          orderChanged = true;
        }
      });
      newNodes.forEach((node, i) => {
        const newOrder = existingNodes.length + i;
        runtimeContext.ea.addAppendUpdateCustomData(node.id, {
          mindmapOrder: newOrder
        });
        orderChanged = true;
      });
      return orderChanged;
    };
    return {
      radialL1Distribution,
      verticalL1Distribution,
      horizontalL1Distribution,
      layoutL1Nodes,
      sortL1NodesBasedOnVisualSequence
    };
  }

  // src/scripts/mindmap-builder/layout.js
  function createLayout(runtimeContext) {
    const triggerGlobalLayout = async (rootId, forceUngroup = false, mustHonorMindmapOrder = false) => {
      if (!runtimeContext.isViewSet()) return;
      const selectedElement = runtimeContext.getMindmapNodeFromSelection();
      if (!selectedElement) return;
      const run = async (allElements2, mindmapIds2, root2, doVisualSort, sharedSets2, mustHonorMindmapOrder2 = false) => {
        return runtimeContext.withRootLayoutContext(root2, () => {
          const oldMode = root2.customData?.growthMode;
          const newMode = root2.customData?.growthMode || runtimeContext.currentModalGrowthMode;
          let orderChanged = false;
          let modeChanged = false;
          let visualChange = false;
          const originalPositions = /* @__PURE__ */ new Map();
          allElements2.forEach((el) => {
            originalPositions.set(el.id, {
              x: el.x,
              y: el.y
            });
          });
          const elementById = runtimeContext.buildElementMap(allElements2);
          const parentMap = runtimeContext.buildParentMap(allElements2, elementById);
          const childrenByParent = runtimeContext.buildChildrenMap(allElements2, elementById);
          const heightCache = /* @__PURE__ */ new Map();
          const widthCache = /* @__PURE__ */ new Map();
          const branchIds = new Set(mindmapIds2);
          const groupToNodes = runtimeContext.buildGroupToNodes(branchIds, allElements2);
          const hasGlobalFolds = allElements2.some((el) => el.customData?.isFolded === true);
          const l1Nodes = runtimeContext.getChildrenNodes(rootId, allElements2);
          if (l1Nodes.length === 0)
            return {
              structuralChange: false,
              visualChange: false
            };
          if (runtimeContext.groupBranches || forceUngroup) {
            mindmapIds2.forEach((id) => {
              const el = runtimeContext.ea.getElement(id);
              if (el && el.groupIds) {
                el.groupIds = el.groupIds.filter(
                  (gid) => !runtimeContext.isMindmapGroup(gid, allElements2)
                );
              }
            });
          }
          const rootBox = runtimeContext.getNodeBox(root2, allElements2);
          const rootCenter = {
            x: rootBox.minX + rootBox.width / 2,
            y: rootBox.minY + rootBox.height / 2
          };
          const layoutContext = {
            allElements: allElements2,
            rootId,
            rootBox,
            rootCenter,
            hasGlobalFolds,
            mode: newMode,
            childrenByParent,
            heightCache,
            widthCache,
            elementById,
            parentMap
          };
          const isModeSwitch = mustHonorMindmapOrder2 || oldMode && oldMode !== newMode;
          if (!isModeSwitch && doVisualSort && !mustHonorMindmapOrder2) {
            orderChanged = runtimeContext.sortL1NodesBasedOnVisualSequence(
              l1Nodes,
              newMode,
              rootCenter
            );
          } else if (!mustHonorMindmapOrder2) {
            if (oldMode !== newMode) {
              runtimeContext.ea.addAppendUpdateCustomData(rootId, {
                growthMode: newMode
              });
              modeChanged = true;
            }
          }
          if (newMode === "Radial") {
            runtimeContext.layoutL1Nodes(
              l1Nodes,
              {
                sortMethod: "radial",
                centerAngle: null,
                gapMultiplier: runtimeContext.layoutSettings.GAP_MULTIPLIER_RADIAL,
                fillSweep: root2.customData?.fillSweep ?? runtimeContext.fillSweep
              },
              layoutContext,
              mustHonorMindmapOrder2
            );
          } else if (["Right-facing", "Left-facing", "Right-Left"].includes(newMode)) {
            const leftNodes = [];
            const rightNodes = [];
            if (newMode === "Right-Left") {
              if (isModeSwitch && !mustHonorMindmapOrder2) {
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
              l1Nodes.forEach((node) => leftNodes.push(node));
            } else {
              l1Nodes.forEach((node) => rightNodes.push(node));
            }
            if (rightNodes.length > 0) {
              runtimeContext.layoutL1Nodes(
                rightNodes,
                {
                  sortMethod: "vertical",
                  centerAngle: 90,
                  gapMultiplier: runtimeContext.layoutSettings.GAP_MULTIPLIER_DIRECTIONAL
                },
                layoutContext,
                mustHonorMindmapOrder2
              );
            }
            if (leftNodes.length > 0) {
              runtimeContext.layoutL1Nodes(
                leftNodes,
                {
                  sortMethod: "vertical",
                  centerAngle: 270,
                  gapMultiplier: runtimeContext.layoutSettings.GAP_MULTIPLIER_DIRECTIONAL
                },
                layoutContext,
                mustHonorMindmapOrder2
              );
            }
          } else if (["Up-facing", "Down-facing", "Up-Down"].includes(newMode)) {
            const upNodes = [];
            const downNodes = [];
            if (newMode === "Up-Down") {
              if (isModeSwitch && !mustHonorMindmapOrder2) {
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
              l1Nodes.forEach((node) => upNodes.push(node));
            } else {
              l1Nodes.forEach((node) => downNodes.push(node));
            }
            layoutContext.widthCache = /* @__PURE__ */ new Map();
            if (downNodes.length > 0) {
              runtimeContext.layoutL1Nodes(
                downNodes,
                {
                  sortMethod: "horizontal",
                  centerAngle: 90,
                  gapMultiplier: runtimeContext.layoutSettings.GAP_MULTIPLIER_DIRECTIONAL
                },
                layoutContext,
                mustHonorMindmapOrder2
              );
            }
            if (upNodes.length > 0) {
              runtimeContext.layoutL1Nodes(
                upNodes,
                {
                  sortMethod: "horizontal",
                  centerAngle: 270,
                  gapMultiplier: runtimeContext.layoutSettings.GAP_MULTIPLIER_DIRECTIONAL
                },
                layoutContext,
                mustHonorMindmapOrder2
              );
            }
          }
          const { mindmapIdsSet: mindmapIdsSet2, crosslinkIdSet: crosslinkIdSet2, decorationIdSet: decorationIdSet2 } = sharedSets2;
          runtimeContext.moveCrossLinks(runtimeContext.ea.getElements(), originalPositions);
          runtimeContext.moveDecorations(
            runtimeContext.ea.getElements(),
            originalPositions,
            groupToNodes,
            rootId,
            elementById,
            parentMap
          );
          runtimeContext.ea.getElements().filter(
            (el) => !mindmapIdsSet2.has(el.id) && !crosslinkIdSet2.has(el.id) && !decorationIdSet2.has(el.id)
          ).forEach((el) => {
            delete runtimeContext.ea.elementsDict[el.id];
          });
          for (const el of runtimeContext.ea.getElements()) {
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
      const viewElements = runtimeContext.ea.getViewElements();
      const projectElements = runtimeContext.getMindmapProjectElements(rootId, viewElements);
      runtimeContext.ea.copyViewElementsToEAforEditing(projectElements);
      let allElements = runtimeContext.ea.getElements();
      let root = allElements.find((el) => el.id === rootId);
      if (!root) return;
      if (root.customData?.autoLayoutDisabled) return;
      const mindmapIds = runtimeContext.getBranchElementIds(rootId, allElements);
      const { structuralGroupId, groupedElementIds } = runtimeContext.getStructuralGroupForNode(
        mindmapIds,
        allElements,
        rootId
      );
      if (structuralGroupId) {
        runtimeContext.removeGroupFromElements(structuralGroupId, allElements);
      }
      const expandedMindmapIds = [...mindmapIds];
      mindmapIds.forEach((id) => {
        const el = allElements.find((e) => e.id === id);
        if (el && el.boundElements) {
          el.boundElements.forEach((be) => expandedMindmapIds.push(be.id));
        }
      });
      const mindmapIdsSet = new Set(expandedMindmapIds);
      const crosslinkIdSet = runtimeContext.collectCrosslinkIds(allElements);
      const decorationIdSet = runtimeContext.collectDecorationIds(allElements, rootId);
      const sharedSets = {
        mindmapIdsSet,
        crosslinkIdSet,
        decorationIdSet
      };
      const boundaryNodeSnapshot = /* @__PURE__ */ new Map();
      allElements.forEach((el) => {
        if (typeof el.customData?.mindmapOrder !== "undefined" && el.customData?.boundaryId) {
          boundaryNodeSnapshot.set(el.id, {
            x: el.x,
            y: el.y,
            width: el.width,
            height: el.height
          });
        }
      });
      const result1 = await run(
        allElements,
        mindmapIds,
        root,
        true,
        sharedSets,
        mustHonorMindmapOrder
      );
      let boundaryMoved = false;
      if (boundaryNodeSnapshot.size > 0) {
        for (const [id, oldSnapshot] of boundaryNodeSnapshot) {
          const newEl = runtimeContext.ea.getElement(id);
          if (newEl) {
            if (Math.abs(newEl.x - oldSnapshot.x) > 0.01 || Math.abs(newEl.y - oldSnapshot.y) > 0.01 || Math.abs(newEl.width - oldSnapshot.width) > 0.01 || Math.abs(newEl.height - oldSnapshot.height) > 0.01) {
              boundaryMoved = true;
              break;
            }
          }
        }
      }
      if (result1.structuralChange || forceUngroup || boundaryMoved) {
        await runtimeContext.addElementsToView({
          captureUpdate: "EVENTUALLY"
        });
        const viewElementsRun2 = runtimeContext.ea.getViewElements();
        const projectElementsRun2 = runtimeContext.getMindmapProjectElements(
          rootId,
          viewElementsRun2
        );
        runtimeContext.ea.copyViewElementsToEAforEditing(projectElementsRun2);
        allElements = runtimeContext.ea.getElements();
        root = allElements.find((el) => el.id === rootId);
        await run(allElements, mindmapIds, root, false, sharedSets, mustHonorMindmapOrder);
        if (structuralGroupId && !forceUngroup) {
          groupedElementIds.forEach((id) => {
            const el = runtimeContext.ea.getElement(id);
            if (el && (!el.groupIds || !el.groupIds.includes(structuralGroupId))) {
              el.groupIds = [...el.groupIds || [], structuralGroupId];
            }
          });
        }
        await runtimeContext.addElementsToView({
          captureUpdate: "IMMEDIATELY"
        });
      } else {
        if (result1.visualChange) {
          if (structuralGroupId && !forceUngroup) {
            groupedElementIds.forEach((id) => {
              const el = runtimeContext.ea.getElement(id);
              if (el && (!el.groupIds || !el.groupIds.includes(structuralGroupId))) {
                el.groupIds = [...el.groupIds || [], structuralGroupId];
              }
            });
          }
          await runtimeContext.addElementsToView({
            captureUpdate: "IMMEDIATELY"
          });
        } else {
          runtimeContext.ea.clear();
        }
      }
      runtimeContext.selectNodeInView(selectedElement);
    };
    const refreshMapLayout = async (sel) => {
      if (!runtimeContext.isViewSet()) return;
      if (!sel) sel = runtimeContext.getMindmapNodeFromSelection();
      if (sel) {
        const allElements = runtimeContext.ea.getViewElements();
        const settingsRoot = runtimeContext.getSettingsRootNode(sel, allElements);
        if (!settingsRoot) return;
        if (settingsRoot.customData?.autoLayoutDisabled === true) return;
        await triggerGlobalLayout(settingsRoot.id);
      }
    };
    return { triggerGlobalLayout, refreshMapLayout };
  }

  // src/scripts/mindmap-builder/nodes.js
  function createNodes(runtimeContext) {
    const addEmbeddableNode = ({ px = 0, py = 0, url, depth }) => {
      isWikiLink = url.startsWith("[[");
      const width = isWikiLink ? depth === 0 ? runtimeContext.EMBEDED_OBJECT_WIDTH_ROOT : runtimeContext.EMBEDED_OBJECT_WIDTH_CHILD : runtimeContext.EMBEDED_OBJECT_WIDTH_CHILD;
      const height = isWikiLink ? width / 2 : 0;
      const embeddableId = runtimeContext.ea.addEmbeddable(px, py, width, height, url);
      if (isWikiLink) {
        runtimeContext.ea.getElement(embeddableId).scale = depth === 0 ? [0.5, 0.5] : [0.3, 0.3];
      }
      return embeddableId;
    };
    const addImage = async ({
      pathOrFile,
      width,
      leftFacing = false,
      x = 0,
      y = 0,
      depth = 0
    } = {}) => {
      const newNodeId = await runtimeContext.ea.addImage(x, y, pathOrFile);
      const el = runtimeContext.ea.getElement(newNodeId);
      const targetWidth = width || (depth === 0 ? runtimeContext.EMBEDED_OBJECT_WIDTH_ROOT : runtimeContext.EMBEDED_OBJECT_WIDTH_CHILD);
      const ratio = el.width / el.height;
      el.width = targetWidth;
      el.height = targetWidth / ratio;
      if (leftFacing) el.x = x - el.width;
      return newNodeId;
    };
    const initializeRootCustomData = (nodeId) => {
      runtimeContext.ea.addAppendUpdateCustomData(nodeId, {
        presetName: runtimeContext.activePresetName,
        growthMode: runtimeContext.currentModalGrowthMode,
        autoLayoutDisabled: false,
        arrowType: runtimeContext.arrowType,
        fontsizeScale: runtimeContext.fontsizeScale,
        multicolor: runtimeContext.multicolor,
        boxChildren: runtimeContext.boxChildren,
        roundedCorners: runtimeContext.roundedCorners,
        maxWrapWidth: runtimeContext.maxWidth,
        isSolidArrow: runtimeContext.isSolidArrow,
        centerText: runtimeContext.centerText,
        fillSweep: runtimeContext.fillSweep,
        branchScale: runtimeContext.branchScale,
        baseStrokeWidth: runtimeContext.baseStrokeWidth,
        layoutSettings: JSON.parse(JSON.stringify(runtimeContext.layoutSettings))
      });
    };
    const addNode = async (text, follow = false, skipFinalLayout = false, batchModeAllElements = null, batchModeParent = null, pos = null, ontology = null) => {
      if (!runtimeContext.isViewSet()) return;
      if (!text || text.trim() === "") return;
      const preGenTextId = runtimeContext.ea.generateElementId();
      if (text.includes("__NODE_LINK_PLACEHOLDER__")) {
        const file = app.workspace.getActiveFile();
        const fileName = file ? file.basename : "";
        const linkStr = `[[${fileName}#^group=${preGenTextId}|${runtimeContext.nodeLinkAlias}]]`;
        text = text.replace("__NODE_LINK_PLACEHOLDER__", linkStr);
      }
      const st = runtimeContext.getAppState();
      const isBatchMode = batchModeAllElements !== null;
      let allElements = batchModeAllElements || runtimeContext.ea.getViewElements();
      let parent = batchModeParent;
      let usingCustomParent = false;
      if (!isBatchMode) {
        parent = runtimeContext.getMindmapNodeFromSelection();
        if (!parent) {
          parent = runtimeContext.ea.getViewSelectedElement();
          usingCustomParent = !!parent;
        }
        if (parent?.containerId) {
          parent = allElements.find((el) => el.id === parent.containerId);
        }
        if (parent && parent.customData?.isFolded) {
          await runtimeContext.toggleFold("L0");
          allElements = runtimeContext.ea.getViewElements();
          parent = allElements.find((el) => el.id === parent.id);
        }
      }
      let newNodeId;
      let arrowId;
      const imageInfo = runtimeContext.parseImageInput(text);
      const embeddableUrl = runtimeContext.parseEmbeddableInput(text, imageInfo);
      const defaultNodeColor = runtimeContext.ea.getCM(st.viewBackgroundColor).invert().stringHEX({
        alpha: false
      });
      let depth = 0, nodeColor = defaultNodeColor, rootId, nextSiblingOrder = 0;
      let settingsRoot = null;
      let rootCfgForAdd = null;
      if (parent) {
        const siblings = runtimeContext.getChildrenNodes(parent.id, allElements);
        nextSiblingOrder = Math.max(0, ...siblings.map(runtimeContext.getMindmapOrder)) + 1;
        settingsRoot = runtimeContext.getSettingsRootNode(parent, allElements) || allElements.find((e) => e.id === runtimeContext.getHierarchy(parent, allElements).rootId);
        rootId = settingsRoot?.id;
        rootCfgForAdd = runtimeContext.getRootConfigForNode(settingsRoot);
        const parentDepthFromSettingsRoot = runtimeContext.getDepthFromAncestor(
          parent.id,
          rootId,
          allElements
        );
        depth = parentDepthFromSettingsRoot + 1;
        const rootEl = settingsRoot;
        if (depth === 1) {
          if (rootCfgForAdd.multicolor) {
            const existingColors = runtimeContext.getChildrenNodes(parent.id, allElements).map((n) => n.strokeColor);
            nodeColor = runtimeContext.getDynamicColor(existingColors);
          } else {
            nodeColor = rootEl.strokeColor;
          }
        } else {
          if (parent.type === "image" || parent.type === "embeddable") {
            const incomingArrow = allElements.find(
              (a) => a.type === "arrow" && a.customData?.isBranch && a.endBinding?.elementId === parent.id
            );
            nodeColor = incomingArrow ? incomingArrow.strokeColor : parent.strokeColor && parent.strokeColor.toLowerCase() !== "transparent" ? parent.strokeColor : defaultNodeColor;
          } else {
            nodeColor = parent.strokeColor;
          }
        }
        const effectiveMulticolor = rootCfgForAdd?.multicolor ?? runtimeContext.multicolor;
        const effectiveIsSolidArrow = rootCfgForAdd?.isSolidArrow ?? runtimeContext.isSolidArrow;
        if (!effectiveMulticolor && !effectiveIsSolidArrow) {
          const parentStrokeColor = (parent.strokeColor || "transparent").toLowerCase();
          const isTransparent = parentStrokeColor === "transparent";
          let isSameAsBg = false;
          if (!isTransparent) {
            const parentColorCM = runtimeContext.ea.getCM(parent.strokeColor);
            const bgColorCM = runtimeContext.ea.getCM(st.viewBackgroundColor);
            if (parentColorCM && bgColorCM && parentColorCM.stringHEX() === bgColorCM.stringHEX()) {
              isSameAsBg = true;
            }
          }
          if (isTransparent || isSameAsBg) {
            nodeColor = runtimeContext.ea.getCM(st.viewBackgroundColor).invert().stringHEX({ alpha: false });
          }
        }
      }
      const fontScale = runtimeContext.getFontScale(
        rootCfgForAdd?.fontsizeScale ?? runtimeContext.fontsizeScale
      );
      if (!isBatchMode) runtimeContext.ea.clear();
      runtimeContext.ea.style.fontFamily = st.currentItemFontFamily;
      runtimeContext.ea.style.fontSize = fontScale[Math.min(depth, fontScale.length - 1)];
      runtimeContext.ea.style.roundness = rootCfgForAdd?.roundedCorners ?? runtimeContext.roundedCorners ? {
        type: 3
      } : null;
      const effectiveMaxWrap = rootCfgForAdd?.maxWrapWidth ?? runtimeContext.maxWidth;
      let curMaxW = depth === 0 ? Math.max(400, effectiveMaxWrap) : effectiveMaxWrap;
      let renderedText = text;
      let metrics = {
        w: 0,
        h: 0
      };
      let shouldWrap = false;
      let curMaxH = 0;
      if (!imageInfo?.isImagePath && !imageInfo?.imageFile && !embeddableUrl) {
        renderedText = await runtimeContext.parseText(text) ?? text;
        metrics = runtimeContext.ea.measureText(renderedText);
        shouldWrap = metrics.width > curMaxW;
        curMaxH = metrics.height;
        if (shouldWrap) {
          const res = await runtimeContext.getAdjustedMaxWidth(text, curMaxW);
          curMaxW = res.width;
          curMaxH = res.height;
        }
      }
      if (!parent) {
        runtimeContext.ea.style.strokeColor = runtimeContext.multicolor ? defaultNodeColor : st.currentItemStrokeColor;
        if (imageInfo?.isImagePath) {
          newNodeId = await addImage({
            pathOrFile: imageInfo.path,
            width: imageInfo.width,
            depth
          });
          if (imageInfo.isExternalImage && newNodeId) {
            const el = runtimeContext.ea.getElement(newNodeId);
            if (el && !el.link) el.link = imageInfo.path;
          }
        } else if (imageInfo?.imageFile) {
          newNodeId = await addImage({
            pathOrFile: imageInfo.imageFile,
            width: imageInfo.width,
            depth
          });
        } else if (embeddableUrl) {
          newNodeId = addEmbeddableNode({
            url: embeddableUrl,
            depth: 0
          });
        } else {
          runtimeContext.ea.style.fillStyle = "solid";
          runtimeContext.ea.style.backgroundColor = st.viewBackgroundColor;
          runtimeContext.ea.style.strokeWidth = runtimeContext.getStrokeWidthForDepth(0);
          runtimeContext.ea.style.roughness = runtimeContext.getAppState().currentItemRoughness;
          newNodeId = runtimeContext.ea.addText(
            0,
            0,
            text,
            {
              box: "rectangle",
              textAlign: "center",
              textVerticalAlign: "middle",
              // Use a distinct color representation so the frame can be recolored separately from text
              boxStrokeColor: runtimeContext.ea.getCM(runtimeContext.ea.style.strokeColor).stringRGB(),
              width: shouldWrap ? curMaxW : void 0,
              height: shouldWrap ? curMaxH : void 0,
              autoResize: !shouldWrap
            },
            preGenTextId
          );
          runtimeContext.ea.style.backgroundColor = "transparent";
        }
        initializeRootCustomData(newNodeId);
        rootId = newNodeId;
      } else {
        runtimeContext.ea.style.strokeColor = nodeColor;
        const rootEl = allElements.find((e) => e.id === rootId);
        const rootBox = runtimeContext.getNodeBox(rootEl, allElements);
        const mode = rootCfgForAdd?.growthMode || rootEl.customData?.growthMode || runtimeContext.currentModalGrowthMode;
        const rootCenter = {
          x: rootBox.minX + rootBox.width / 2,
          y: rootBox.minY + rootBox.height / 2
        };
        const parentBox = runtimeContext.getNodeBox(parent, allElements);
        const isVerticalMode = ["Up-facing", "Down-facing", "Up-Down"].includes(mode);
        let targetSide = 1;
        if (depth === 1) {
          if (mode === "Left-facing" || mode === "Up-facing") targetSide = -1;
          else if (mode === "Right-facing" || mode === "Down-facing") targetSide = 1;
          else if (mode === "Right-Left" || mode === "Up-Down") {
            const siblings = runtimeContext.getChildrenNodes(parent.id, allElements);
            const idx = siblings.length;
            if (idx < 2) targetSide = 1;
            else if (idx < 4) targetSide = -1;
            else targetSide = idx % 2 === 0 ? 1 : -1;
          } else {
            if (isVerticalMode) {
              const parentCenterY = parentBox.minY + parentBox.height / 2;
              targetSide = parentCenterY > rootCenter.y ? 1 : -1;
            } else {
              const parentCenterX = parentBox.minX + parentBox.width / 2;
              targetSide = parentCenterX > rootCenter.x ? 1 : -1;
            }
          }
        } else {
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
          if (!runtimeContext.autoLayoutDisabled && pos) {
            px = pos.x;
            py = pos.y;
            side = py + metrics.height / 2 > rootCenter.y ? 1 : -1;
          } else if (!runtimeContext.autoLayoutDisabled) {
            const siblings = runtimeContext.getChildrenNodes(parent.id, allElements);
            if (siblings.length > 0) {
              const sortedSiblings = siblings.sort((a, b) => a.x - b.x);
              const lastSibling = sortedSiblings[sortedSiblings.length - 1];
              const lastSiblingBox = runtimeContext.getNodeBox(lastSibling, allElements);
              px = lastSiblingBox.minX + lastSiblingBox.width + runtimeContext.layoutSettings.GAP_Y;
              py = parentBox.minY + (side === 1 ? parentBox.height + runtimeContext.layoutSettings.GAP_X : -runtimeContext.layoutSettings.GAP_X - metrics.height);
            }
          } else if (runtimeContext.autoLayoutDisabled) {
            const manualGapY = Math.round(
              parentBox.height * runtimeContext.layoutSettings.MANUAL_GAP_MULTIPLIER
            );
            const jitterX = (Math.random() - 0.5) * runtimeContext.layoutSettings.MANUAL_JITTER_RANGE;
            const jitterY = (Math.random() - 0.5) * runtimeContext.layoutSettings.MANUAL_JITTER_RANGE;
            px = parentBox.minX + parentBox.width / 2 - metrics.width / 2 + jitterX;
            py = side === 1 ? parentBox.minY + parentBox.height + manualGapY + jitterY : parentBox.minY - manualGapY - metrics.height + jitterY;
          }
        } else {
          const offset = mode === "Radial" || side === 1 ? rootBox.width * 2 : -rootBox.width;
          px = parentBox.minX + offset;
          py = parentBox.minY;
          if (!runtimeContext.autoLayoutDisabled && pos) {
            px = pos.x;
            py = pos.y;
            side = px + (shouldWrap ? curMaxW : metrics.width) / 2 > rootCenter.x ? 1 : -1;
          } else if (!runtimeContext.autoLayoutDisabled) {
            const siblings = runtimeContext.getChildrenNodes(parent.id, allElements);
            if (siblings.length > 0) {
              const sortedSiblings = siblings.sort((a, b) => a.y - b.y);
              const lastSibling = sortedSiblings[sortedSiblings.length - 1];
              const lastSiblingBox = runtimeContext.getNodeBox(lastSibling, allElements);
              py = lastSiblingBox.minY + lastSiblingBox.height + runtimeContext.layoutSettings.GAP_Y;
            }
          } else if (runtimeContext.autoLayoutDisabled) {
            const manualGapX = Math.round(
              parentBox.width * runtimeContext.layoutSettings.MANUAL_GAP_MULTIPLIER
            );
            const jitterX = (Math.random() - 0.5) * runtimeContext.layoutSettings.MANUAL_JITTER_RANGE;
            const jitterY = (Math.random() - 0.5) * runtimeContext.layoutSettings.MANUAL_JITTER_RANGE;
            const nodeW = shouldWrap ? curMaxW : metrics.width;
            px = side === 1 ? parentBox.minX + parentBox.width + manualGapX + jitterX : parentBox.minX - manualGapX - nodeW + jitterX;
            py = parentBox.minY + parentBox.height / 2 - metrics.height / 2 + jitterY;
          }
        }
        const effectiveCenterText = rootCfgForAdd?.centerText ?? runtimeContext.centerText;
        const effectiveBoxChildren = rootCfgForAdd?.boxChildren ?? runtimeContext.boxChildren;
        const effectiveArrowType = rootCfgForAdd?.arrowType ?? runtimeContext.arrowType;
        const effectiveIsSolidArrow = rootCfgForAdd?.isSolidArrow ?? runtimeContext.isSolidArrow;
        const effectiveBranchScale = rootCfgForAdd?.branchScale ?? runtimeContext.branchScale;
        const effectiveBaseStrokeWidth = rootCfgForAdd?.baseStrokeWidth ?? runtimeContext.baseStrokeWidth;
        const textAlign = effectiveCenterText ? "center" : isVerticalMode ? "center" : side === 1 ? "left" : "right";
        if (imageInfo?.isImagePath) {
          newNodeId = await addImage({
            pathOrFile: imageInfo.path,
            width: imageInfo.width,
            leftFacing: side === -1 && !runtimeContext.autoLayoutDisabled,
            x: px,
            y: py,
            depth
          });
          if (imageInfo.isExternalImage && newNodeId) {
            const el = runtimeContext.ea.getElement(newNodeId);
            if (el && !el.link) el.link = imageInfo.path;
          }
        } else if (imageInfo?.imageFile) {
          newNodeId = await addImage({
            pathOrFile: imageInfo.imageFile,
            width: imageInfo.width,
            leftFacing: side === -1 && !runtimeContext.autoLayoutDisabled,
            x: px,
            y: py,
            depth
          });
        } else if (embeddableUrl) {
          newNodeId = addEmbeddableNode({
            px,
            py,
            url: embeddableUrl,
            depth
          });
          const el = runtimeContext.ea.getElement(newNodeId);
          if (side === -1 && !runtimeContext.autoLayoutDisabled) el.x = px - el.width;
        } else {
          runtimeContext.ea.style.strokeWidth = runtimeContext.calculateStrokeWidth(
            depth,
            effectiveBaseStrokeWidth,
            effectiveBranchScale
          );
          runtimeContext.ea.style.roughness = runtimeContext.getAppState().currentItemRoughness;
          newNodeId = runtimeContext.ea.addText(
            px,
            py,
            text,
            {
              box: effectiveBoxChildren ? "rectangle" : false,
              textAlign,
              textVerticalAlign: "middle",
              width: shouldWrap ? curMaxW : void 0,
              height: shouldWrap ? curMaxH : void 0,
              autoResize: !shouldWrap
            },
            preGenTextId
          );
        }
        if (depth === 1) {
          runtimeContext.ea.addAppendUpdateCustomData(newNodeId, {
            mindmapNew: !!pos ? false : true,
            // if position is provided a sibling is being added to a defined spot in the layout
            mindmapOrder: nextSiblingOrder
          });
        } else {
          runtimeContext.ea.addAppendUpdateCustomData(newNodeId, {
            mindmapOrder: nextSiblingOrder
          });
        }
        if (!runtimeContext.ea.getElement(parent.id)) {
          runtimeContext.ea.copyViewElementsToEAforEditing([parent]);
          parent = runtimeContext.ea.getElement(parent.id);
        }
        if (depth > 1 && usingCustomParent && !parent.customData?.mindmapOrder) {
          runtimeContext.ea.addAppendUpdateCustomData(parent.id, {
            mindmapOrder: nextSiblingOrder
          });
        }
        if ((depth === 0 || usingCustomParent) && !parent.customData?.growthMode && !parent.customData?.mindmapOrder) {
          initializeRootCustomData(parent.id);
        }
        if ((parent.type === "image" || parent.type === "embeddable") && typeof parent.customData?.mindmapOrder === "undefined") {
          runtimeContext.ea.addAppendUpdateCustomData(parent.id, {
            mindmapOrder: 0
          });
        }
        runtimeContext.ea.style.strokeWidth = runtimeContext.calculateStrokeWidth(
          depth,
          effectiveBaseStrokeWidth,
          effectiveBranchScale
        );
        runtimeContext.ea.style.roughness = runtimeContext.getAppState().currentItemRoughness;
        runtimeContext.ea.style.strokeStyle = effectiveIsSolidArrow ? "solid" : runtimeContext.getAppState().currentItemStrokeStyle;
        const startPoint = [
          parentBox.minX + parentBox.width / 2,
          parentBox.minY + parentBox.height / 2
        ];
        arrowId = runtimeContext.ea.addArrow([startPoint, startPoint], {
          startObjectId: parent.id,
          endObjectId: newNodeId,
          startArrowHead: null,
          endArrowHead: null
        });
        const eaArrow = runtimeContext.ea.getElement(arrowId);
        if (effectiveArrowType === "curved") {
          eaArrow.roundness = {
            type: 2
          };
        } else {
          eaArrow.roundness = null;
        }
        runtimeContext.ea.addAppendUpdateCustomData(arrowId, {
          isBranch: true
        });
        if (ontology) {
          runtimeContext.addUpdateArrowLabel(eaArrow, ontology);
        }
        if (!runtimeContext.groupBranches && parent.groupIds?.length > 0) {
          const mindmapIds = runtimeContext.getBranchElementIds(
            parent.id,
            runtimeContext.ea.getViewElements()
          );
          const { structuralGroupId } = runtimeContext.getStructuralGroupForNode(
            mindmapIds,
            allElements,
            rootId
          );
          if (structuralGroupId) {
            const newNode = runtimeContext.ea.getElement(newNodeId);
            const newArrow = runtimeContext.ea.getElement(arrowId);
            if (newNode) newNode.groupIds = [structuralGroupId];
            if (newArrow) newArrow.groupIds = [structuralGroupId];
          }
        }
      }
      if (isBatchMode) {
        return runtimeContext.ea.getElement(newNodeId);
      }
      const hasImage = !!imageInfo?.imageFile || imageInfo?.isImagePath;
      await runtimeContext.addElementsToView({
        repositionToCursor: !parent,
        save: hasImage,
        captureUpdate: "EVENTUALLY"
      });
      if (rootId && (runtimeContext.autoLayoutDisabled || skipFinalLayout) && parent) {
        const allEls = runtimeContext.ea.getViewElements();
        const node = allEls.find((el) => el.id === newNodeId);
        const arrow = allEls.find(
          (a) => a.type === "arrow" && a.customData?.isBranch && a.endBinding?.elementId === newNodeId
        );
        runtimeContext.ea.copyViewElementsToEAforEditing(
          runtimeContext.groupBranches ? allEls : arrow ? [arrow] : []
        );
        if (arrow) {
          const parentCenterX = parent.x + parent.width / 2;
          const childCenterX = node.x + node.width / 2;
          const isChildRight = childCenterX > parentCenterX;
          const sX = isChildRight ? parent.x + parent.width : parent.x;
          const sY = parent.y + parent.height / 2;
          const eX = isChildRight ? node.x : node.x + node.width;
          const eY = node.y + node.height / 2;
          runtimeContext.configureArrow({
            arrowId: arrow.id,
            isChildRight,
            startId: parent.id,
            endId: node.id,
            coordinates: {
              sX,
              sY,
              eX,
              eY
            }
          });
        }
        if (runtimeContext.groupBranches) {
          runtimeContext.ea.getElements().forEach((el) => {
            if (el.groupIds) {
              el.groupIds = el.groupIds.filter((gid) => !runtimeContext.isMindmapGroup(gid, allEls));
            }
          });
          const l1Nodes = runtimeContext.getChildrenNodes(rootId, allEls);
          l1Nodes.forEach((l1) => runtimeContext.applyRecursiveGrouping(l1.id, allEls));
        } else {
          const { l1AncestorId } = runtimeContext.getHierarchy(parent, allEls);
          const bIds = runtimeContext.getBranchElementIds(l1AncestorId, allEls);
          const existingGroupedEl = allEls.find(
            (el) => bIds.includes(el.id) && el.id !== newNodeId && el.id !== arrowId && runtimeContext.getStructuralGroup(el, allEls, rootId)
          );
          const commonGroupId = existingGroupedEl ? runtimeContext.getStructuralGroup(existingGroupedEl, allEls, rootId) : null;
          if (commonGroupId) {
            const newIds = [newNodeId, arrowId].filter(Boolean);
            runtimeContext.ea.copyViewElementsToEAforEditing(
              allEls.filter((el) => newIds.includes(el.id))
            );
            newIds.forEach((id) => {
              const el = runtimeContext.ea.getElement(id);
              if (el) el.groupIds = [commonGroupId];
            });
          }
        }
        await runtimeContext.addElementsToView({
          captureUpdate: "EVENTUALLY"
        });
      }
      const finalNode = runtimeContext.ea.getViewElements().find((el) => el.id === newNodeId);
      if (follow || !parent) {
        runtimeContext.selectNodeInView(finalNode);
      } else if (parent) {
        runtimeContext.selectNodeInView(parent);
      }
      if (!parent) {
        runtimeContext.zoomToFit();
      }
      runtimeContext.mostRecentlyAddedNodeID = finalNode.id;
      runtimeContext.focusInputEl();
      await runtimeContext.triggerGlobalLayout(rootId);
      return finalNode;
    };
    return { addEmbeddableNode, addImage, initializeRootCustomData, addNode };
  }

  // src/scripts/mindmap-builder/markdownExport.js
  function createMarkdownExport(runtimeContext) {
    const copyMapAsText = async (cut = false, toClipboard = true) => {
      if (!runtimeContext.isViewSet()) return;
      runtimeContext.ensureNodeSelected();
      const sel = runtimeContext.getMindmapNodeFromSelection();
      if (!sel) {
        new runtimeContext.Notice(runtimeContext.t("NOTICE_SELECT_NODE_TO_COPY"));
        return;
      }
      const all = runtimeContext.ea.getViewElements();
      const info = runtimeContext.getHierarchy(sel, all);
      const isRootSelected = info.rootId === sel.id;
      const parentNode = runtimeContext.getParentNode(sel.id, all);
      const root = all.find((el) => el.id === info.rootId);
      const defaultMode = root?.customData?.growthMode || runtimeContext.currentModalGrowthMode;
      const elementsToDelete = [];
      const useTab = app.vault.getConfig("useTab");
      const tabSize = app.vault.getConfig("tabSize");
      const indentVal = useTab ? "	" : " ".repeat(tabSize);
      const branchIds = new Set(runtimeContext.getBranchElementIds(sel.id, all));
      const nodeBlockRefs = /* @__PURE__ */ new Map();
      const nodeOutgoingLinks = /* @__PURE__ */ new Map();
      const crossLinkArrows = all.filter(
        (el) => el.type === "arrow" && !el.customData?.isBranch && branchIds.has(el.startBinding?.elementId) && branchIds.has(el.endBinding?.elementId)
      );
      const hasCrosslinks = crossLinkArrows.length > 0;
      const lineSeparator = hasCrosslinks ? "\n\n" : "\n";
      if (hasCrosslinks) {
        crossLinkArrows.forEach((arrow) => {
          const startId = arrow.startBinding.elementId;
          const endId = arrow.endBinding.elementId;
          if (!nodeBlockRefs.has(endId)) {
            nodeBlockRefs.set(endId, "^" + runtimeContext.ea.generateElementId().substring(0, 8));
          }
          if (!nodeOutgoingLinks.has(startId)) {
            nodeOutgoingLinks.set(startId, []);
          }
          const boundTextId = arrow.boundElements?.find((be) => be.type === "text")?.id;
          const labelTextElement = boundTextId ? all.find((el) => el.id === boundTextId) : null;
          const refString = nodeBlockRefs.get(endId);
          let linkText;
          if (labelTextElement && labelTextElement.rawText) {
            const label = labelTextElement.rawText.replace(/\n/g, " ");
            linkText = `(${label}:: [[#${refString}|*]])`;
          } else {
            linkText = `[[#${refString}|*]]`;
          }
          nodeOutgoingLinks.get(startId).push(linkText);
          if (cut) elementsToDelete.push(arrow);
        });
      }
      const submapsQueue = [];
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
            const ind = all.find((e) => e.id === node.customData.foldIndicatorId);
            if (ind) elementsToDelete.push(ind);
          }
          if (node.customData?.boundaryId) {
            const boundary = all.find((e) => e.id === node.customData.boundaryId);
            if (boundary) elementsToDelete.push(boundary);
          }
        }
        let str = "";
        let text = runtimeContext.getTextFromNode(all, node, true);
        let ontologyStr = "";
        if (!isRootSelected || depth > 0 || isSubmapChild) {
          const incomingArrow = all.find(
            (a) => a.type === "arrow" && a.customData?.isBranch && a.endBinding?.elementId === nodeId
          );
          if (incomingArrow) {
            const boundTextEl = runtimeContext.ea.getBoundTextElement(
              incomingArrow,
              true
            ).sceneElement;
            if (boundTextEl && boundTextEl.rawText) {
              ontologyStr = boundTextEl.rawText.replace(/\n/g, " ") + ":: ";
              if (cut) elementsToDelete.push(boundTextEl);
            }
          }
        }
        let refSuffixes = "";
        if (nodeOutgoingLinks.has(nodeId))
          refSuffixes += ` ${nodeOutgoingLinks.get(nodeId).join(" ")}`;
        if (node.customData?.boundaryId) refSuffixes += " #boundary";
        if (nodeBlockRefs.has(nodeId)) refSuffixes += ` ${nodeBlockRefs.get(nodeId)}`;
        let isTask = false;
        let taskPrefix = "";
        const taskMatch = text.match(/^- \[[ xX]\] /);
        if (taskMatch) {
          isTask = true;
          taskPrefix = taskMatch[0];
          text = text.substring(taskPrefix.length);
        }
        if (!isPrintRoot && node.customData?.isAdditionalRoot) {
          let submapTitle = text;
          if (submapTitle.startsWith("![[") && submapTitle.endsWith("]]")) {
            submapTitle = submapTitle.slice(3, -2).split("|")[0];
          } else if (submapTitle.startsWith("![") && submapTitle.endsWith(")")) {
            submapTitle = "Submap " + nodeId.substring(0, 4);
          }
          const linkText = `![[#${submapTitle}]]`;
          const repeatCount = Math.max(0, depth - (isRootSelected ? 1 : 0));
          let currentIndent = isSubmapChild ? indentVal.repeat(depth) : indentVal.repeat(repeatCount);
          if (isTask) {
            str += `${currentIndent}${taskPrefix}${ontologyStr}${linkText}${refSuffixes}${lineSeparator}`;
          } else {
            str += `${currentIndent}- ${ontologyStr}${linkText}${refSuffixes}${lineSeparator}`;
          }
          submapsQueue.push({
            id: nodeId,
            title: submapTitle
          });
          return str;
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
        let children = runtimeContext.getChildrenNodes(nodeId, all);
        const parentCenter = {
          x: node.x + node.width / 2,
          y: node.y + node.height / 2
        };
        const mode = node.customData?.isAdditionalRoot ? node.customData.growthMode : defaultMode;
        if (mode === "Radial") {
          children.sort((a, b) => {
            const centerA = {
              x: a.x + a.width / 2,
              y: a.y + a.height / 2
            };
            const centerB = {
              x: b.x + b.width / 2,
              y: b.y + b.height / 2
            };
            return runtimeContext.getAngleFromCenter(parentCenter, centerA) - runtimeContext.getAngleFromCenter(parentCenter, centerB);
          });
        } else if (mode === "Right-Left" && nodeId === info.rootId) {
          const right = [];
          const left = [];
          children.forEach((child) => {
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
              (a) => a.type === "arrow" && a.customData?.isBranch && a.startBinding?.elementId === nodeId && a.endBinding?.elementId === c.id
            );
            if (arrow) elementsToDelete.push(arrow);
          }
          str += buildList(c.id, depth + 1, isSubmapChild, false);
        });
        return str;
      };
      let md = buildList(sel.id, 0, false, true);
      const processedSubmaps = /* @__PURE__ */ new Set();
      if (submapsQueue.length > 0) {
        md += `
---
`;
      }
      while (submapsQueue.length > 0) {
        const submapObj = submapsQueue.shift();
        if (processedSubmaps.has(submapObj.id)) continue;
        processedSubmaps.add(submapObj.id);
        md += `
## ${submapObj.title}
`;
        const submapNode = all.find((e) => e.id === submapObj.id);
        let children = runtimeContext.getChildrenNodes(submapObj.id, all);
        const parentCenter = {
          x: submapNode.x + submapNode.width / 2,
          y: submapNode.y + submapNode.height / 2
        };
        const mode = submapNode.customData?.growthMode || defaultMode;
        if (mode === "Radial") {
          children.sort((a, b) => {
            const centerA = {
              x: a.x + a.width / 2,
              y: a.y + a.height / 2
            };
            const centerB = {
              x: b.x + b.width / 2,
              y: b.y + b.height / 2
            };
            return runtimeContext.getAngleFromCenter(parentCenter, centerA) - runtimeContext.getAngleFromCenter(parentCenter, centerB);
          });
        } else if (mode === "Right-Left") {
          const right = [];
          const left = [];
          children.forEach((child) => {
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
              (a) => a.type === "arrow" && a.customData?.isBranch && a.startBinding?.elementId === submapObj.id && a.endBinding?.elementId === c.id
            );
            if (arrow) elementsToDelete.push(arrow);
          }
          md += buildList(c.id, 0, true, false);
        });
      }
      if (toClipboard) await navigator.clipboard.writeText(md);
      if (cut) {
        const incomingArrow = all.find(
          (a) => a.type === "arrow" && a.customData?.isBranch && a.endBinding?.elementId === sel.id
        );
        if (incomingArrow) elementsToDelete.push(incomingArrow);
        runtimeContext.ea.deleteViewElements(elementsToDelete);
        if (parentNode) {
          const remainingChildren = runtimeContext.getChildrenNodes(
            parentNode.id,
            runtimeContext.ea.getViewElements()
          );
          if (remainingChildren.length === 0) {
            runtimeContext.ea.copyViewElementsToEAforEditing([parentNode]);
            runtimeContext.ea.addAppendUpdateCustomData(parentNode.id, {
              isFolded: false,
              foldIndicatorId: void 0
            });
            if (parentNode.customData?.foldIndicatorId) {
              const indicator = runtimeContext.ea.getViewElements().find((el) => el.id === parentNode.customData.foldIndicatorId);
              if (indicator) runtimeContext.ea.deleteViewElements([indicator]);
            }
            await runtimeContext.addElementsToView({
              captureUpdate: "EVENTUALLY"
            });
          }
          runtimeContext.selectNodeInView(parentNode);
        }
        runtimeContext.triggerGlobalLayout(info.rootId);
        new runtimeContext.Notice(
          isRootSelected ? runtimeContext.t("NOTICE_MAP_CUT") : runtimeContext.t("NOTICE_BRANCH_CUT")
        );
      } else {
        new runtimeContext.Notice(
          isRootSelected ? runtimeContext.t("NOTICE_MAP_COPIED") : runtimeContext.t("NOTICE_BRANCH_COPIED")
        );
      }
      return md;
    };
    return { copyMapAsText };
  }

  // src/scripts/mindmap-builder/branchClipboard.ts
  var nodeTypes = /* @__PURE__ */ new Set(["text", "rectangle", "ellipse", "diamond", "image", "embeddable"]);
  function isTaggedNode(element) {
    if (element.containerId || !nodeTypes.has(element.type)) return false;
    const data = element.customData;
    return !!data && (data.mindmapOrder !== void 0 || !!data.growthMode || data.isAdditionalRoot === true);
  }
  function hasParentCycle(nodes, incoming) {
    const checked = /* @__PURE__ */ new Set();
    for (const id of nodes) {
      const path = /* @__PURE__ */ new Set();
      let current = id;
      while (current && !checked.has(current)) {
        if (path.has(current)) return true;
        path.add(current);
        current = incoming.get(current);
      }
      path.forEach((n) => checked.add(n));
    }
    return false;
  }
  function branchEndpoints(arrow, normalize) {
    const start = normalize(arrow.startBinding?.elementId);
    const end = normalize(arrow.endBinding?.elementId);
    return start && end ? { start, end } : null;
  }
  function excludeConnector(element, excluded) {
    excluded.add(element.id);
    for (const bound of element.boundElements ?? []) {
      if (bound.type === "text") excluded.add(bound.id);
    }
  }
  function supportsBranchEndpoints(start, end) {
    return nodeTypes.has(start.type) && nodeTypes.has(end.type);
  }
  function parseBranchClipboard(text) {
    try {
      const data = JSON.parse(text);
      if (data?.type !== "excalidraw/clipboard" || !Array.isArray(data.elements)) return null;
      if (!data.elements.every((e) => e && typeof e.id === "string" && typeof e.type === "string"))
        return null;
      return data;
    } catch {
      return null;
    }
  }
  function analyzeBranchClipboard(payload) {
    const elements = payload.elements.filter((e) => !e.isDeleted);
    const byId = new Map(elements.map((e) => [e.id, e]));
    if (byId.size !== elements.length) return { kind: "invalid" };
    const normalize = (id) => {
      const e = id ? byId.get(id) : void 0;
      return e?.containerId ? byId.get(e.containerId) : e;
    };
    const nodes = /* @__PURE__ */ new Map();
    elements.forEach((e) => {
      if (isTaggedNode(e)) nodes.set(e.id, e);
    });
    const incoming = /* @__PURE__ */ new Map();
    const excluded = /* @__PURE__ */ new Set();
    const branches = elements.filter((e) => e.type === "arrow" && e.customData?.isBranch);
    for (const e of branches) {
      const endpoints = branchEndpoints(e, normalize);
      if (!endpoints) {
        excludeConnector(e, excluded);
        continue;
      }
      const { start, end } = endpoints;
      if (!supportsBranchEndpoints(start, end) || incoming.has(end.id)) return { kind: "invalid" };
      nodes.set(start.id, start);
      nodes.set(end.id, end);
      incoming.set(end.id, start.id);
    }
    if (!nodes.size) return { kind: "none" };
    if (hasParentCycle(nodes.keys(), incoming)) return { kind: "invalid" };
    const rootIds = [...nodes.keys()].filter((id) => !incoming.has(id));
    return { kind: "branch", elements: elements.filter((e) => !excluded.has(e.id)), rootIds };
  }
  function markBranchClipboard(payload, elements, marker) {
    const copy = JSON.parse(JSON.stringify({ ...payload, elements }));
    const kept = new Set(elements.map((e) => e.id));
    copy.elements.forEach((e) => {
      e.customData = { ...e.customData, [marker]: e.id };
      if (e.boundElements) e.boundElements = e.boundElements.filter((b) => kept.has(b.id));
    });
    return copy;
  }
  function remapBranchMetadata(element, source, idMap, marker) {
    const customData = { ...element.customData };
    delete customData[marker];
    for (const key of ["boundaryId", "foldIndicatorId"]) {
      if (typeof source.customData?.[key] === "string") {
        const id = idMap.get(source.customData[key]);
        if (id) customData[key] = id;
        else delete customData[key];
      }
    }
    return customData;
  }

  // src/scripts/mindmap-builder/pasteMetadata.js
  function createPasteMetadataCleanup() {
    const registrations = /* @__PURE__ */ new Map();
    const dispose = () => {
      registrations.forEach(({ unsubscribe, operations, repair: repair2 }) => {
        operations.forEach((op) => {
          op.transportActive = false;
        });
        repair2();
        unsubscribe();
      });
      registrations.clear();
    };
    const track = (api, marker, operation) => {
      registrations.forEach((registration2, oldApi) => {
        if (oldApi.isDestroyed) {
          registration2.unsubscribe();
          registrations.delete(oldApi);
        }
      });
      let registration = registrations.get(api);
      if (!registration) {
        registration = { operations: /* @__PURE__ */ new Map(), unsubscribe: () => {
        } };
        registrations.set(api, registration);
        registration.repair = () => {
          if (api.isDestroyed) return;
          const elements = api.getSceneElementsIncludingDeleted();
          if (!elements.some(
            (e) => e.customData && Object.keys(e.customData).some(
              (key) => key.startsWith("__mindmapPaste_") && registration.operations.get(key)?.transportActive !== true
            )
          ))
            return;
          let changed = false;
          const repaired = elements.map((e) => {
            if (!e.customData) return e;
            let customData;
            for (const key of Object.keys(e.customData)) {
              if (!key.startsWith("__mindmapPaste_")) continue;
              let operation2 = registration.operations.get(key);
              if (!operation2) {
                operation2 = { transportActive: false, idMap: /* @__PURE__ */ new Map() };
                registration.operations.set(key, operation2);
              }
              if (operation2.transportActive) continue;
              customData ??= { ...e.customData };
              delete customData[key];
              if (!operation2.idMap.size)
                operation2.idMap = new Map(
                  api.getSceneElementsIncludingDeleted().filter((e2) => e2.customData?.[key]).map((e2) => [e2.customData[key], e2.id])
                );
              const mapping = operation2.idMap;
              for (const ref of ["boundaryId", "foldIndicatorId"]) {
                const oldId = customData[ref];
                if (typeof oldId === "string") {
                  if (mapping.has(oldId)) customData[ref] = mapping.get(oldId);
                  else if (![...mapping.values()].includes(oldId)) delete customData[ref];
                }
              }
            }
            if (!customData) return e;
            changed = true;
            return ExcalidrawLib.newElementWith(e, { customData });
          });
          if (changed && !api.isDestroyed)
            api.updateScene({ elements: repaired, captureUpdate: "NEVER" });
        };
        registration.unsubscribe = api.onChange(registration.repair);
      }
      if (marker) registration.operations.set(marker, operation);
    };
    const repair = (api) => registrations.get(api)?.repair();
    const watch = (api) => {
      if (!api || api.isDestroyed) return;
      track(api, null, null);
      repair(api);
    };
    return { track, dispose, repair, watch };
  }

  // src/scripts/mindmap-builder/branchPaste.js
  function createBranchPaste(ctx) {
    let pending = null;
    const metadata = createPasteMetadataCleanup();
    const cancelBranchPaste = () => pending?.cancel();
    const disposeBranchPaste = () => {
      cancelBranchPaste();
      metadata.dispose();
    };
    ctx.ea.registerCleanup?.(disposeBranchPaste);
    const watchPasteMetadata = () => metadata.watch(ctx.api());
    watchPasteMetadata();
    const isBranchPasteBusy = () => pending !== null;
    const pasteBranch = async (payload, parent) => {
      const analysis = analyzeBranchClipboard(payload);
      if (analysis.kind === "none") return false;
      if (pending) return true;
      if (analysis.kind === "invalid") {
        new ctx.Notice(ctx.t("NOTICE_BRANCH_PASTE_INVALID"));
        return true;
      }
      const view = ctx.ea.targetView;
      const api = ctx.api();
      const filePath = view.file?.path;
      const win = view.ownerWindow;
      const marker = `__mindmapPaste_${ctx.ea.generateElementId()}`;
      const transport = markBranchClipboard(payload, analysis.elements, marker);
      const sources = new Map(analysis.elements.map((e) => [e.id, e]));
      const op = { cancelled: false, cancel: () => {
      }, transportActive: true, idMap: /* @__PURE__ */ new Map() };
      pending = op;
      const alive = () => !op.cancelled && ctx.isViewSet() && ctx.ea.sidepanelTab && ctx.ea.targetView === view && view.file?.path === filePath && ctx.api() === api && !api.isDestroyed;
      let pasted = [];
      const gestureDocuments = new Set(
        [view.ownerDocument, ctx.sidepanelWindow?.document].filter(Boolean)
      );
      gestureDocuments.forEach(
        (doc) => doc.addEventListener?.("pointerdown", cancelBranchPaste, true)
      );
      try {
        metadata.track(api, marker, op);
        if (!alive() || api.getAppState().viewModeEnabled || api.getAppState().editingTextElement)
          throw new Error("paste unavailable");
        if (parent) {
          const all2 = ctx.ea.getViewElements();
          const seen = /* @__PURE__ */ new Set();
          let cursor = parent;
          while (cursor) {
            if (seen.has(cursor.id)) throw new Error("cyclic destination");
            seen.add(cursor.id);
            const incoming = all2.filter(
              (e) => e.type === "arrow" && e.customData?.isBranch && e.endBinding?.elementId === cursor.id
            );
            if (incoming.length > 1) throw new Error("multiple destination parents");
            cursor = incoming.length ? all2.find((e) => e.id === incoming[0].startBinding?.elementId) : null;
          }
        }
        const container = view.contentEl.querySelector(".excalidraw");
        const canvas = container?.querySelector("canvas.excalidraw__canvas.interactive") ?? container?.querySelector("canvas");
        if (!container || !canvas) throw new Error("canvas unavailable");
        const rect = canvas.getBoundingClientRect();
        let point = null;
        for (const [rx, ry] of [
          [0.5, 0.5],
          [0.75, 0.5],
          [0.25, 0.5],
          [0.5, 0.75]
        ]) {
          const x = rect.left + rect.width * rx, y = rect.top + rect.height * ry;
          if (view.ownerDocument.elementFromPoint(x, y) === canvas) {
            point = { x, y };
            break;
          }
        }
        if (!point) throw new Error("canvas obscured");
        ctx.linkSuggester?.close();
        container.focus({ preventScroll: true });
        container.dispatchEvent(
          new win.PointerEvent("pointermove", {
            bubbles: true,
            clientX: point.x,
            clientY: point.y,
            pointerType: "mouse"
          })
        );
        const data = new win.DataTransfer();
        data.setData("text/plain", JSON.stringify(transport));
        const event = new win.ClipboardEvent("paste", {
          clipboardData: data,
          bubbles: true,
          cancelable: true
        });
        pasted = await new Promise((resolve, reject) => {
          let unsubscribe = () => {
          };
          let timer;
          let settled = false;
          const finish = (elements, error) => {
            if (settled) return;
            settled = true;
            unsubscribe();
            win.clearTimeout(timer);
            if (error) reject(error);
            else resolve(elements);
          };
          op.cancel = () => {
            op.cancelled = true;
            finish([], new Error("paste cancelled"));
          };
          unsubscribe = api.onChange((elements) => {
            if (!alive()) {
              op.cancel();
              return;
            }
            const inserted = elements.filter((e) => !e.isDeleted && e.customData?.[marker]);
            if (inserted.length === transport.elements.length) finish(inserted);
          });
          timer = win.setTimeout(() => finish([], new Error("native paste timeout")), 5e3);
          try {
            container.dispatchEvent(event);
          } catch (error) {
            finish([], error);
          }
        });
        op.cancel = () => {
          op.cancelled = true;
        };
        if (!alive()) throw new Error("drawing changed");
        const idMap = op.idMap = new Map(pasted.map((e) => [e.customData[marker], e.id]));
        if (idMap.size !== transport.elements.length) throw new Error("ambiguous pasted IDs");
        const all = ctx.ea.getViewElements();
        const destination = parent ? all.find((e) => e.id === parent.id && !e.isDeleted) : null;
        if (parent && !destination) throw new Error("destination removed");
        ctx.ea.clear();
        ctx.ea.copyViewElementsToEAforEditing(pasted);
        for (const e of pasted) {
          const source = sources.get(e.customData[marker]);
          ctx.ea.getElement(e.id).customData = remapBranchMetadata(e, source, idMap, marker);
        }
        const roots = analysis.rootIds.map((id) => ctx.ea.getElement(idMap.get(id)));
        if (destination) {
          ctx.ea.copyViewElementsToEAforEditing([destination]);
          const editedParent = ctx.ea.getElement(destination.id);
          const settingsRoot = ctx.getSettingsRootNode(destination, all);
          const cfg = ctx.getRootConfigForNode(settingsRoot);
          const depth = ctx.getDepthFromAncestor(destination.id, settingsRoot.id, all) + 1;
          const siblings = ctx.getChildrenNodes(destination.id, all);
          let order = Math.max(0, ...siblings.map(ctx.getMindmapOrder)) + 1;
          if (editedParent.customData?.isFolded) {
            ctx.ea.addAppendUpdateCustomData(destination.id, { isFolded: false });
          }
          for (const root of roots) {
            if (root.customData?.growthMode) root.customData.isAdditionalRoot = true;
            root.customData = { ...root.customData, mindmapOrder: order++ };
            ctx.ea.style.strokeColor = root.strokeColor && root.strokeColor !== "transparent" ? root.strokeColor : destination.strokeColor;
            ctx.ea.style.strokeWidth = ctx.calculateStrokeWidth(
              depth,
              cfg.baseStrokeWidth,
              cfg.branchScale
            );
            ctx.ea.style.strokeStyle = cfg.isSolidArrow ? "solid" : ctx.getAppState().currentItemStrokeStyle;
            ctx.ea.style.roughness = destination.roughness;
            const arrowId = ctx.ea.addArrow(
              [
                [destination.x + destination.width / 2, destination.y + destination.height / 2],
                [root.x + root.width / 2, root.y + root.height / 2]
              ],
              {
                startObjectId: destination.id,
                endObjectId: root.id,
                startArrowHead: null,
                endArrowHead: null
              }
            );
            const arrow = ctx.ea.getElement(arrowId);
            arrow.customData = { ...arrow.customData, isBranch: true };
            for (const node of [editedParent, root]) {
              node.boundElements = [
                ...(node.boundElements || []).filter((b) => b.id !== arrowId),
                { id: arrowId, type: "arrow" }
              ];
            }
            const vertical = ["Up-facing", "Down-facing", "Up-Down"].includes(cfg.growthMode);
            const radial = cfg.growthMode === "Radial" && destination.id === settingsRoot.id;
            const right = root.x + root.width / 2 >= destination.x + destination.width / 2;
            const below = root.y + root.height / 2 >= destination.y + destination.height / 2;
            ctx.withRootLayoutContext(
              settingsRoot,
              () => ctx.configureArrow({
                arrowId,
                startId: destination.id,
                endId: root.id,
                isChildRight: root.x + root.width / 2 >= destination.x + destination.width / 2,
                isChildBelow: root.y + root.height / 2 >= destination.y + destination.height / 2,
                layoutDirection: vertical ? "vertical" : "horizontal",
                isRadial: radial,
                coordinates: {
                  sX: vertical || radial ? destination.x + destination.width / 2 : destination.x + (right ? destination.width : 0),
                  sY: vertical ? destination.y + (below ? destination.height : 0) : destination.y + destination.height / 2,
                  eX: vertical ? root.x + root.width / 2 : root.x + (right ? 0 : root.width),
                  eY: vertical ? root.y + (below ? 0 : root.height) : root.y + root.height / 2
                }
              })
            );
          }
        } else {
          for (const root of roots) {
            if (!root.customData?.growthMode) ctx.initializeRootCustomData(root.id);
          }
        }
        ctx.currentTransactionAccumulator = 0;
        ctx.lastCommittedTransaction = null;
        ctx.redoAvailable = null;
        await ctx.addElementsToView({ captureUpdate: "IMMEDIATELY" });
        if (!alive()) return true;
        if (destination) {
          ctx.selectNodeInView(destination);
          const elements = ctx.ea.getViewElements();
          if (destination.customData?.isFolded) {
            const pastedIds = new Set(pasted.map((e) => e.id));
            ctx.ea.copyViewElementsToEAforEditing(
              ctx.getMindmapProjectElements(ctx.getHierarchy(destination, elements).rootId, elements).filter((e) => !pastedIds.has(e.id))
            );
            ctx.updateBranchVisibility(
              destination.id,
              false,
              ctx.ea.getElements(),
              true,
              ctx.getHierarchy(destination, elements).rootId
            );
            await ctx.addElementsToView({ captureUpdate: "EVENTUALLY" });
          }
          if (alive() && !ctx.getRootConfigForNode(ctx.getSettingsRootNode(destination, elements)).autoLayoutDisabled)
            await ctx.triggerGlobalLayout(
              ctx.getHierarchy(destination, elements).rootId,
              false,
              true
            );
        } else {
          ctx.selectNodeInView(roots[0]);
        }
        new ctx.Notice(ctx.t("NOTICE_PASTE_COMPLETE"));
        ctx.currentTransactionAccumulator = 0;
        ctx.lastCommittedTransaction = {
          steps: 0,
          branchPasteIds: roots.map((root) => root.id),
          version: ExcalidrawLib.getSceneVersion(api.getSceneElements())
        };
        ctx.redoAvailable = null;
      } catch (error) {
        if (!op.cancelled && ctx.ea.targetView === view) {
          console.error("Mindmap Builder branch paste:", error);
          new ctx.Notice(ctx.t("NOTICE_BRANCH_PASTE_FAILED"));
        }
      } finally {
        gestureDocuments.forEach(
          (doc) => doc.removeEventListener?.("pointerdown", cancelBranchPaste, true)
        );
        op.transportActive = false;
        op.cancel = () => {
        };
        metadata.repair(api);
        if (pending === op) pending = null;
        if (!op.cancelled && ctx.ea.targetView === view && ctx.api() === api && ctx.ea.sidepanelTab && !api.isDestroyed) {
          ctx.ea.clear();
          ctx.focusInputEl();
        }
      }
      return true;
    };
    return {
      pasteBranch,
      cancelBranchPaste,
      disposeBranchPaste,
      isBranchPasteBusy,
      watchPasteMetadata
    };
  }

  // src/scripts/mindmap-builder/markdownImport.js
  function createMarkdownImport(runtimeContext) {
    const {
      pasteBranch,
      cancelBranchPaste,
      disposeBranchPaste,
      isBranchPasteBusy,
      watchPasteMetadata
    } = createBranchPaste(runtimeContext);
    const importOutline = async () => {
      if (!runtimeContext.isViewSet()) return;
      const sel = runtimeContext.getMindmapNodeFromSelection();
      if (!sel) {
        new runtimeContext.Notice(runtimeContext.t("NOTICE_SELECT_NODE_CONTAINING_LINK"));
        return;
      }
      const allElements = runtimeContext.ea.getViewElements();
      const nodeText = runtimeContext.getTextFromNode(allElements, sel, true, false);
      const markdownFile = runtimeContext.getNodeMarkdownFile(nodeText);
      if (!markdownFile) {
        new runtimeContext.Notice(runtimeContext.t("NOTICE_NO_LINKED_FILE"));
        return;
      }
      const cache = await app.metadataCache.blockCache.getForFile(
        {
          isCancelled: () => false
        },
        markdownFile
      );
      if (!cache || !cache.blocks) {
        new runtimeContext.Notice(runtimeContext.t("NOTICE_NO_HEADINGS"));
        return;
      }
      const shortFilePath = app.metadataCache.fileToLinktext(
        markdownFile,
        runtimeContext.ea.targetView.file.path,
        true
      );
      const outlines = [];
      for (const block of cache.blocks) {
        if (block.node.type === "heading") {
          const depth = block.node.depth;
          const rawHeadingText = block.display.replace(/^#+\s+/, "");
          if (rawHeadingText === "Excalidraw Data") break;
          const alias = rawHeadingText.replace(/\|/g, " ");
          const anchor = rawHeadingText.replace(/[|#\\:]/g, " ");
          const indent = "  ".repeat(Math.max(0, depth - 1));
          outlines.push(`${indent}- [[${shortFilePath}#${anchor}|${alias}]]`);
        }
      }
      if (outlines.length === 0) {
        new runtimeContext.Notice(runtimeContext.t("NOTICE_NO_HEADINGS"));
        return;
      }
      await importTextToMap(outlines.join("\n"));
    };
    const importTextToMap = async (rawText) => {
      if (!runtimeContext.isViewSet()) return;
      if (!rawText) return;
      let sel = runtimeContext.getMindmapNodeFromSelection();
      let currentParent;
      const lines = rawText.split(/\r\n|\n|\r/).filter((l) => {
        const trimmed = l.trim();
        return trimmed !== "" && !/^-{3,}$/.test(trimmed);
      });
      if (lines.length === 0) return;
      const boundaryRegex = /\s#boundary\b/;
      const blockRefRegex = /\s\^([a-zA-Z0-9]{8})$/;
      const crossLinkRegex = /(?:\(([^):]+)::\s*)?\[\[#\^([a-zA-Z0-9]{8})\|\*\]\](?:\))?/g;
      const ontologyRegex = /^(.+?)::\s*(.*)$/;
      const submapRefRegex = /^!\[\[#([^\]]+)\]\]$/;
      if (lines.length === 1) {
        let text = lines[0];
        const listMatch = text.match(/^(\s*)(?:-|\*|\d+\.)\s+(.*)$/);
        if (listMatch) {
          text = listMatch[2].trim();
          if (/^\[[ xX]\] /.test(text)) {
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
          currentParent = await runtimeContext.addNode(
            text.trim(),
            true,
            false,
            null,
            null,
            null,
            ontology
          );
          if (isSubmapRef) {
            runtimeContext.ea.addAppendUpdateCustomData(currentParent.id, {
              isAdditionalRoot: true
            });
          }
          if (sel) {
            runtimeContext.selectNodeInView(sel);
          }
          return;
        }
      }
      let parsed = [];
      let rootTextFromHeader = null;
      const isHeader = (l) => l.match(/^#+\s/);
      const isListItem = (l) => l.match(/^(\s*)(?:-|\*|\d+\.)\s+(.*)$/);
      if (!isHeader(lines[0]) && !isListItem(lines[0])) {
        new runtimeContext.Notice(runtimeContext.t("NOTICE_PASTE_ABORTED"));
        return;
      }
      const delta = isHeader(lines[0]) ? 1 : 0;
      const notice = new runtimeContext.Notice(runtimeContext.t("NOTICE_PASTE_START"), 0);
      await sleep(10);
      const blockRefToNodeId = /* @__PURE__ */ new Map();
      const nodeToOutgoingRefs = /* @__PURE__ */ new Map();
      lines.forEach((line, index) => {
        let text = "";
        let indent = 0;
        let isSubmapDef = false;
        if (isHeader(line)) {
          if (index === 0) {
            indent = 0;
            text = line.replace(/^#+\s/, "").trim();
          } else {
            isSubmapDef = true;
            text = line.replace(/^#+\s/, "").trim();
            indent = -1;
          }
        } else {
          const match = isListItem(line);
          if (match) {
            indent = delta + match[1].length;
            let extractedText = match[2].trim();
            if (/^\[[ xX]\] /.test(extractedText)) {
              extractedText = "- " + extractedText;
            }
            text = extractedText;
          } else if (parsed.length > 0) {
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
          const outgoingRefs = [];
          crossLinkRegex.lastIndex = 0;
          text = text.replace(crossLinkRegex, (_match, label, ref) => {
            outgoingRefs.push({
              ref,
              label: label ? label.trim() : null
            });
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
        new runtimeContext.Notice(runtimeContext.t("NOTICE_NO_LIST"));
        return;
      }
      runtimeContext.ea.clear();
      const rootSelected = !!sel;
      const createdBoundaries = [];
      const createImportBoundary = (nodeId) => {
        const node = runtimeContext.ea.getElement(nodeId);
        if (!node) return;
        const id = runtimeContext.ea.generateElementId();
        const st = runtimeContext.getAppState();
        const boundaryEl = {
          id,
          type: "line",
          x: node.x,
          y: node.y,
          width: 1,
          height: 1,
          angle: 0,
          roughness: st.currentItemRoughness,
          strokeColor: node.strokeColor,
          backgroundColor: node.strokeColor,
          fillStyle: "solid",
          strokeWidth: 2,
          strokeStyle: "solid",
          opacity: 30,
          points: [
            [0, 0],
            [1, 1],
            [0, 0]
          ],
          polygon: true,
          locked: false,
          groupIds: node.groupIds || [],
          customData: {
            isBoundary: true
          },
          roundness: runtimeContext.arrowType === "curved" ? {
            type: 2
          } : null
        };
        runtimeContext.ea.elementsDict[id] = boundaryEl;
        runtimeContext.ea.addAppendUpdateCustomData(nodeId, {
          boundaryId: id
        });
        createdBoundaries.push({
          nodeId,
          boundaryId: id
        });
      };
      const submapNodesByName = /* @__PURE__ */ new Map();
      if (!sel) {
        const nonSubmapItems = parsed.filter((p) => !p.isSubmapDef);
        const minIndent = Math.min(...nonSubmapItems.map((p) => p.indent));
        const topLevelItems = nonSubmapItems.filter((p) => p.indent === minIndent);
        const processRootMeta = (item, id) => {
          if (item.blockRef) blockRefToNodeId.set(item.blockRef, id);
          if (item.outgoingRefs.length > 0) nodeToOutgoingRefs.set(id, item.outgoingRefs);
          if (item.hasBoundary) createImportBoundary(id);
          if (item.isSubmapRef) {
            runtimeContext.ea.addAppendUpdateCustomData(id, {
              isAdditionalRoot: true
            });
            submapNodesByName.set(item.text, runtimeContext.ea.getElement(id));
          }
        };
        if (topLevelItems.length === 1) {
          const rootItem = topLevelItems[0];
          const rootIndex = parsed.indexOf(rootItem);
          sel = currentParent = await runtimeContext.addNode(
            rootItem.text,
            true,
            true,
            [],
            null,
            null,
            rootItem.ontology
          );
          processRootMeta(rootItem, currentParent.id);
          if (rootIndex !== -1) {
            parsed.splice(rootIndex, 1);
          }
        } else {
          sel = currentParent = await runtimeContext.addNode(
            runtimeContext.t("INPUT_TITLE_PASTE_ROOT"),
            true,
            true,
            [],
            null
          );
        }
      } else {
        currentParent = sel;
        runtimeContext.ea.copyViewElementsToEAforEditing([sel]);
        currentParent = runtimeContext.ea.getElement(sel.id);
      }
      const stack = [
        {
          indent: -1,
          node: currentParent
        }
      ];
      if (rootSelected) {
        const allViewElements = runtimeContext.ea.getViewElements();
        const info = runtimeContext.getHierarchy(sel, allViewElements);
        const projectElements = runtimeContext.getMindmapProjectElements(
          info.rootId,
          allViewElements
        );
        runtimeContext.ea.copyViewElementsToEAforEditing(
          projectElements.filter((el) => !runtimeContext.ea.getElement(el.id))
        );
      }
      for (const item of parsed) {
        if (item.isSubmapDef) {
          const targetNode = submapNodesByName.get(item.text);
          if (targetNode) {
            stack.length = 0;
            stack.push({
              indent: -1,
              node: targetNode
            });
          } else {
            const currentAllElements2 = runtimeContext.ea.getElements();
            const newNode2 = await runtimeContext.addNode(
              item.text,
              false,
              true,
              currentAllElements2,
              currentParent,
              null,
              null
            );
            runtimeContext.ea.addAppendUpdateCustomData(newNode2.id, {
              isAdditionalRoot: true
            });
            submapNodesByName.set(item.text, newNode2);
            stack.length = 0;
            stack.push({
              indent: -1,
              node: newNode2
            });
          }
          continue;
        }
        while (stack.length > 1 && item.indent <= stack[stack.length - 1].indent) {
          stack.pop();
        }
        const parentNode = stack[stack.length - 1].node;
        const currentAllElements = runtimeContext.ea.getElements();
        const newNode = await runtimeContext.addNode(
          item.text,
          false,
          true,
          currentAllElements,
          parentNode,
          null,
          item.ontology
        );
        if (item.blockRef) blockRefToNodeId.set(item.blockRef, newNode.id);
        if (item.outgoingRefs.length > 0) nodeToOutgoingRefs.set(newNode.id, item.outgoingRefs);
        if (item.hasBoundary) createImportBoundary(newNode.id);
        if (item.isSubmapRef) {
          runtimeContext.ea.addAppendUpdateCustomData(newNode.id, {
            isAdditionalRoot: true
          });
          submapNodesByName.set(item.text, newNode);
        }
        stack.push({
          indent: item.indent,
          node: newNode
        });
      }
      nodeToOutgoingRefs.forEach((targetRefs, sourceId) => {
        targetRefs.forEach((targetObj) => {
          const { ref, label } = targetObj;
          const targetId = blockRefToNodeId.get(ref);
          if (targetId) {
            const arrowId = runtimeContext.ea.connectObjects(sourceId, null, targetId, null, {
              startArrowHead: null,
              endArrowHead: "triangle"
            });
            const arrowEl = runtimeContext.ea.getElement(arrowId);
            if (arrowEl) {
              arrowEl.strokeStyle = "dashed";
              runtimeContext.addUpdateArrowLabel(arrowEl, label);
            }
          }
        });
      });
      const rootIdForImport = sel ? runtimeContext.getHierarchy(sel, runtimeContext.ea.getElements()).rootId : currentParent.id;
      const rootElForImport = sel ? runtimeContext.ea.getElement(rootIdForImport) : currentParent;
      if (rootElForImport) {
        const mode = rootElForImport.customData?.growthMode || runtimeContext.currentModalGrowthMode;
        if (mode === "Right-Left" && currentParent.id === rootIdForImport) {
          const eaElements = runtimeContext.ea.getElements();
          const importedL1Nodes = eaElements.filter(
            (el) => el.customData?.mindmapNew && eaElements.some(
              (arrow) => arrow.type === "arrow" && arrow.customData?.isBranch && arrow.startBinding?.elementId === currentParent.id && arrow.endBinding?.elementId === el.id
            )
          );
          importedL1Nodes.sort(
            (a, b) => (a.customData?.mindmapOrder || 0) - (b.customData?.mindmapOrder || 0)
          );
          if (importedL1Nodes.length > 0) {
            const splitIndex = Math.ceil(importedL1Nodes.length / 2);
            importedL1Nodes.forEach((node, i) => {
              runtimeContext.ea.addAppendUpdateCustomData(node.id, {
                mindmapNew: void 0
              });
              if (i < splitIndex) {
                node.x = rootElForImport.x + rootElForImport.width + 100;
              } else {
                node.x = rootElForImport.x - node.width - 100;
              }
            });
          }
        }
      }
      await runtimeContext.addElementsToView({
        repositionToCursor: !rootSelected,
        captureUpdate: "EVENTUALLY"
      });
      if (createdBoundaries.length > 0) {
        const allEls = runtimeContext.ea.getViewElements();
        const boundariesWithDepth = createdBoundaries.map((b) => {
          const node = allEls.find((e) => e.id === b.nodeId);
          const depth = node ? runtimeContext.getHierarchy(node, allEls).depth : 0;
          return {
            ...b,
            depth
          };
        });
        boundariesWithDepth.sort((a, b) => a.depth - b.depth);
        for (const b of boundariesWithDepth) {
          const currentEls = runtimeContext.ea.getViewElements();
          let parentBoundaryIndex = -1;
          let curr = currentEls.find((e) => e.id === b.nodeId);
          while (curr) {
            const parent = runtimeContext.getParentNode(curr.id, currentEls);
            if (!parent) break;
            if (parent.customData?.boundaryId) {
              const pIndex = currentEls.findIndex((el) => el.id === parent.customData.boundaryId);
              if (pIndex !== -1) {
                parentBoundaryIndex = pIndex;
                break;
              }
            }
            curr = parent;
          }
          const targetIndex = parentBoundaryIndex !== -1 ? parentBoundaryIndex + 1 : 0;
          runtimeContext.ea.moveViewElementToZIndex(b.boundaryId, targetIndex);
        }
      }
      const allInView = runtimeContext.ea.getViewElements();
      const targetToSelect = sel ? allInView.find((e) => e.id === sel.id) : allInView.find((e) => e.id === currentParent?.id);
      if (targetToSelect) {
        runtimeContext.selectNodeInView(targetToSelect);
      }
      const rootId = sel ? runtimeContext.getHierarchy(sel, allInView).rootId : currentParent.id;
      await runtimeContext.triggerGlobalLayout(rootId);
      notice.setMessage(runtimeContext.t("NOTICE_PASTE_COMPLETE"));
      notice.setAutoHide(4e3);
    };
    const pasteListToMap = async (contentToPaste = null) => {
      const rawText = contentToPaste || await navigator.clipboard.readText();
      if (!rawText) {
        new runtimeContext.Notice(runtimeContext.t("NOTICE_CLIPBOARD_EMPTY"));
        return;
      }
      await importTextToMap(rawText);
    };
    const pasteElementToMap = async () => {
      if (!runtimeContext.isViewSet()) return;
      if (isBranchPasteBusy()) return;
      const sel = runtimeContext.getMindmapNodeFromSelection();
      let rawText = "";
      try {
        rawText = await navigator.clipboard.readText();
      } catch (e) {
      }
      const clipboardPayload = parseBranchClipboard(rawText);
      if (clipboardPayload && await pasteBranch(clipboardPayload, sel)) return;
      if (!sel) {
        await pasteListToMap(rawText);
        return;
      }
      const excalidrawClipboardPayload = !!clipboardPayload;
      if (excalidrawClipboardPayload) {
        const clipboardData = clipboardPayload;
        if (clipboardData && clipboardData.elements) {
          const els = clipboardData.elements.filter((e) => !e.isDeleted);
          const isSingleElement = els.length === 1 && ["embeddable", "text"].includes(els[0].type);
          const textEl = els.find((e) => e.type === "text");
          const containerEl = els.find((e) => ["rectangle", "ellipse", "diamond"].includes(e.type));
          const isContainerText = els.length === 2 && textEl && containerEl && textEl.containerId === containerEl.id;
          const isSingleImageJSON = els.length === 1 && els[0].type === "image";
          if (isSingleImageJSON) {
            const fileId = els[0].fileId;
            const imagePathResolved = runtimeContext.ea.getPathForImageFileId(fileId);
            if (imagePathResolved) {
              if (app.vault.getFileByPath(imagePathResolved)) {
                await pasteListToMap(`![[${imagePathResolved}]]`);
              } else {
                await pasteListToMap(`![pasted image](${imagePathResolved})`);
              }
              return;
            }
          } else if (isSingleElement || isContainerText) {
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
              const newNode = await runtimeContext.addNode(
                textToPaste,
                false,
                false,
                null,
                null,
                null,
                null
              );
              if (newNode && textEl && textEl.link) {
                const freshNode = runtimeContext.ea.getViewElements().find((el) => el.id === newNode.id);
                if (freshNode) {
                  runtimeContext.ea.copyViewElementsToEAforEditing([freshNode]);
                  runtimeContext.ea.getElement(freshNode.id).link = textEl.link;
                  await runtimeContext.addElementsToView({
                    captureUpdate: "EVENTUALLY"
                  });
                }
              }
              if (shapeToPaste) {
                const isContainer = ["rectangle", "ellipse", "diamond"].includes(newNode.type);
                if (isContainer) {
                  if (newNode.type !== shapeToPaste) {
                    runtimeContext.selectNodeInView(newNode);
                    await runtimeContext.toggleBox();
                    await runtimeContext.toggleBox(shapeToPaste);
                  }
                } else {
                  runtimeContext.selectNodeInView(newNode);
                  await runtimeContext.toggleBox(shapeToPaste);
                }
              }
              return;
            }
          }
        }
      }
      let hasImageBlob = false;
      let blob = null;
      let mimeType = null;
      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find((t) => t.startsWith("image/"));
          if (imageType) {
            hasImageBlob = true;
            mimeType = imageType;
            blob = await item.getType(imageType);
            break;
          }
        }
      } catch (e) {
      }
      if (hasImageBlob) {
        const beforeIds = new Set(runtimeContext.ea.getViewElements().map((e) => e.id));
        const dt = new DataTransfer();
        if (hasImageBlob && blob) {
          const file = new File([blob], `Pasted image.${mimeType.split("/")[1] || "png"}`, {
            type: mimeType
          });
          dt.items.add(file);
        }
        const pasteEvent = new ClipboardEvent("paste", {
          clipboardData: dt,
          bubbles: true,
          cancelable: true
        });
        const targetEl = runtimeContext.ea.targetView.contentEl.querySelector(".excalidraw") || runtimeContext.ea.targetView.contentEl;
        const originallySelectedElement = runtimeContext.ea.getViewSelectedElement();
        targetEl.dispatchEvent(pasteEvent);
        let newImageEl = null;
        for (let i = 0; i < 40; i++) {
          await sleep(50);
          const currentElements = runtimeContext.ea.getViewElements();
          const added = currentElements.filter((e) => !beforeIds.has(e.id) && e.type === "image");
          if (added.length > 0) {
            const tmpNewImageEl = added[added.length - 1];
            if (!tmpNewImageEl.fileId) continue;
            const path = runtimeContext.ea.getPathForImageFileId(tmpNewImageEl.fileId);
            if (!path) continue;
            newImageEl = tmpNewImageEl;
            break;
          }
        }
        if (newImageEl) {
          await sleep(200);
          const imageID = newImageEl.id;
          const imagePathResolved = runtimeContext.ea.getPathForImageFileId(newImageEl.fileId);
          runtimeContext.ea.clear();
          runtimeContext.ea.copyViewElementsToEAforEditing([newImageEl]);
          runtimeContext.ea.getElement(imageID).isDeleted = true;
          await runtimeContext.addElementsToView({
            captureUpdate: "EVENTUALLY",
            shouldRestoreElements: false
          });
          if (originallySelectedElement) {
            runtimeContext.ea.selectElementsInView([originallySelectedElement.id]);
          }
          if (imagePathResolved) {
            await pasteListToMap(`![pasted image](${imagePathResolved})`);
          }
        }
        return;
      }
      if (!excalidrawClipboardPayload) {
        await pasteListToMap();
      } else {
        new runtimeContext.Notice(runtimeContext.t("NOTICE_PASTE_ABORTED"));
      }
    };
    return {
      importOutline,
      importTextToMap,
      pasteListToMap,
      pasteElementToMap,
      cancelBranchPaste,
      disposeBranchPaste,
      isBranchPasteBusy,
      watchPasteMetadata
    };
  }

  // src/scripts/mindmap-builder/nodeOrder.js
  function createNodeOrder(runtimeContext) {
    const updateSubtreeFontSize = (nodeId, newDepth, oldDepth, allElements, newFontScaleType, oldFontScaleType) => {
      const newFontScale = runtimeContext.getFontScale(newFontScaleType);
      const oldFontScale = runtimeContext.getFontScale(oldFontScaleType);
      const node = allElements.find((el) => el.id === nodeId);
      if (!node) return;
      if (!runtimeContext.ea.getElement(nodeId)) {
        runtimeContext.ea.copyViewElementsToEAforEditing([node]);
      }
      const oldStandardSize = oldFontScale[Math.min(oldDepth, oldFontScale.length - 1)];
      const newStandardSize = newFontScale[Math.min(newDepth, newFontScale.length - 1)];
      if (node.fontSize === oldStandardSize) {
        const eaNode = runtimeContext.ea.getElement(nodeId);
        eaNode.fontSize = newStandardSize;
        if (eaNode.type === "text" || eaNode.boundElements && eaNode.boundElements.some((b) => b.type === "text")) {
          runtimeContext.ea.refreshTextElementSize(eaNode.id);
        }
      }
      const incomingArrow = allElements.find(
        (a) => a.type === "arrow" && a.customData?.isBranch && a.endBinding?.elementId === nodeId
      );
      if (incomingArrow) {
        const maybeTextElement = runtimeContext.ea.getBoundTextElement(incomingArrow, true);
        let eaOntologyEl = maybeTextElement.eaElement;
        if (!eaOntologyEl && maybeTextElement.sceneElement) {
          runtimeContext.ea.copyViewElementsToEAforEditing([maybeTextElement.sceneElement]);
          eaOntologyEl = runtimeContext.ea.getElement(maybeTextElement.sceneElement.id);
        }
        if (eaOntologyEl && eaOntologyEl.fontSize === Math.floor(oldStandardSize / 2)) {
          eaOntologyEl.fontSize = Math.floor(newStandardSize / 2);
          runtimeContext.ea.refreshTextElementSize(eaOntologyEl.id);
        }
      }
      if (node.customData?.isAdditionalRoot === true) {
        return;
      }
      const children = runtimeContext.getChildrenNodes(nodeId, allElements);
      children.forEach((child) => {
        updateSubtreeFontSize(
          child.id,
          newDepth + 1,
          oldDepth + 1,
          allElements,
          newFontScaleType,
          oldFontScaleType
        );
      });
    };
    const updateSubtreeStrokeWidth = (nodeId, newDepth, oldDepth, allElements, newBaseWidth, newBranchScale, oldBaseWidth, oldBranchScale) => {
      const node = allElements.find((el) => el.id === nodeId);
      if (!node) return;
      if (!runtimeContext.ea.getElement(nodeId)) {
        runtimeContext.ea.copyViewElementsToEAforEditing([node]);
      }
      const oldStandardWidth = runtimeContext.calculateStrokeWidth(
        oldDepth,
        oldBaseWidth,
        oldBranchScale
      );
      const newStandardWidth = runtimeContext.calculateStrokeWidth(
        newDepth,
        newBaseWidth,
        newBranchScale
      );
      const tolerance = 0.05;
      const incomingArrow = allElements.find(
        (a) => a.type === "arrow" && a.customData?.isBranch && a.endBinding?.elementId === nodeId
      );
      if (incomingArrow) {
        if (!runtimeContext.ea.getElement(incomingArrow.id))
          runtimeContext.ea.copyViewElementsToEAforEditing([incomingArrow]);
        const eaArrow = runtimeContext.ea.getElement(incomingArrow.id);
        if (Math.abs(eaArrow.strokeWidth - oldStandardWidth) < tolerance) {
          eaArrow.strokeWidth = newStandardWidth;
        }
      }
      if (node.type !== "text" && Math.abs(node.strokeWidth - oldStandardWidth) < tolerance) {
        const eaNode = runtimeContext.ea.getElement(nodeId);
        eaNode.strokeWidth = newStandardWidth;
      }
      if (node.customData?.isAdditionalRoot === true) {
        return;
      }
      const children = runtimeContext.getChildrenNodes(nodeId, allElements);
      children.forEach((child) => {
        updateSubtreeStrokeWidth(
          child.id,
          newDepth + 1,
          oldDepth + 1,
          allElements,
          newBaseWidth,
          newBranchScale,
          oldBaseWidth,
          oldBranchScale
        );
      });
    };
    const updateSubtreeColor = (nodeId, oldColor, newColor, allElements) => {
      const node = allElements.find((el) => el.id === nodeId);
      if (!node) return;
      if (node.strokeColor !== oldColor) return;
      if (!runtimeContext.ea.getElement(nodeId))
        runtimeContext.ea.copyViewElementsToEAforEditing([node]);
      const eaNode = runtimeContext.ea.getElement(nodeId);
      eaNode.strokeColor = newColor;
      if (node.customData?.boundaryId) {
        const boundaryEl = allElements.find((e) => e.id === node.customData.boundaryId);
        if (boundaryEl) {
          if (!runtimeContext.ea.getElement(boundaryEl.id))
            runtimeContext.ea.copyViewElementsToEAforEditing([boundaryEl]);
          const eaBoundary = runtimeContext.ea.getElement(boundaryEl.id);
          eaBoundary.strokeColor = newColor;
          eaBoundary.backgroundColor = newColor;
        }
      }
      const incomingArrow = allElements.find(
        (a) => a.type === "arrow" && a.customData?.isBranch && a.endBinding?.elementId === nodeId
      );
      if (incomingArrow && incomingArrow.strokeColor === oldColor) {
        if (!runtimeContext.ea.getElement(incomingArrow.id))
          runtimeContext.ea.copyViewElementsToEAforEditing([incomingArrow]);
        const eaArrow = runtimeContext.ea.getElement(incomingArrow.id);
        eaArrow.strokeColor = newColor;
        const maybeTextElement = runtimeContext.ea.getBoundTextElement(incomingArrow, true);
        let eaOntologyEl = maybeTextElement.eaElement;
        if (!eaOntologyEl && maybeTextElement.sceneElement) {
          runtimeContext.ea.copyViewElementsToEAforEditing([maybeTextElement.sceneElement]);
          eaOntologyEl = runtimeContext.ea.getElement(maybeTextElement.sceneElement.id);
        }
        if (eaOntologyEl) {
          eaOntologyEl.strokeColor = newColor;
        }
      }
      const children = runtimeContext.getChildrenNodes(nodeId, allElements);
      children.forEach((child) => {
        updateSubtreeColor(child.id, oldColor, newColor, allElements);
      });
    };
    const toggleSubmapRoot = async () => {
      if (!runtimeContext.isViewSet()) return;
      const sel = runtimeContext.getMindmapNodeFromSelection();
      if (!sel) return;
      const allElements = runtimeContext.ea.getViewElements();
      const parent = runtimeContext.getParentNode(sel.id, allElements);
      if (!parent) {
        new runtimeContext.Notice(runtimeContext.t("NOTICE_CANNOT_CHANGE_MASTER_ROOT"));
        return;
      }
      const isAdditionalRoot = sel.customData?.isAdditionalRoot === true;
      runtimeContext.ea.copyViewElementsToEAforEditing([sel]);
      if (isAdditionalRoot) {
        const ok = await runtimeContext.utils.suggester(
          ["Yes", "No"],
          [true, false],
          runtimeContext.t("CONFIRM_REMOVE_SUBMAP_ROOT")
        );
        if (!ok) {
          return;
        }
        const clearData = {};
        runtimeContext.MAP_ROOT_CUSTOMDATA_KEYS.forEach((key) => {
          clearData[key] = void 0;
        });
        clearData.presetName = void 0;
        runtimeContext.ea.addAppendUpdateCustomData(sel.id, clearData);
      } else {
        const sourceRoot = runtimeContext.getSettingsRootNode(parent, allElements) || parent;
        const sourceCfg = runtimeContext.getRootConfigForNode(sourceRoot);
        const inferredMode = runtimeContext.inferDirectionalGrowthMode(
          sel,
          parent,
          sourceRoot,
          sourceCfg.growthMode
        );
        runtimeContext.ea.addAppendUpdateCustomData(sel.id, {
          isAdditionalRoot: true,
          presetName: sourceRoot.customData?.presetName || runtimeContext.activePresetName,
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
          layoutSettings: JSON.parse(JSON.stringify(sourceCfg.layoutSettings))
        });
      }
      await runtimeContext.addElementsToView({
        captureUpdate: "EVENTUALLY"
      });
      const info = runtimeContext.getHierarchy(sel, runtimeContext.ea.getViewElements());
      await runtimeContext.triggerGlobalLayout(info.rootId);
      new runtimeContext.Notice(
        runtimeContext.t(
          isAdditionalRoot ? "NOTICE_SUBMAP_ROOT_REMOVED" : "NOTICE_SUBMAP_ROOT_ADDED"
        )
      );
      runtimeContext.updateUI();
    };
    const changeNodeOrder = async (key) => {
      if (!runtimeContext.isViewSet()) return;
      const allElements = runtimeContext.ea.getViewElements();
      const current = runtimeContext.getMindmapNodeFromSelection();
      if (!current) return;
      const parent = runtimeContext.getParentNode(current.id, allElements);
      if (!parent) {
        new runtimeContext.Notice(runtimeContext.t("NOTICE_CANNOT_MOVE_ROOT"));
        return;
      }
      const info = runtimeContext.getHierarchy(current, allElements);
      const currentSettingsRoot = runtimeContext.getSettingsRootNode(current, allElements);
      const root = current.customData?.isAdditionalRoot === true ? runtimeContext.getSettingsRootNode(parent, allElements) || currentSettingsRoot || allElements.find((e) => e.id === info.rootId) : currentSettingsRoot || allElements.find((e) => e.id === info.rootId);
      if (!root) return;
      if (current.id === root.id) {
        new runtimeContext.Notice(runtimeContext.t("NOTICE_CANNOT_MOVE_ROOT"));
        return;
      }
      if (root.customData?.autoLayoutDisabled) {
        new runtimeContext.Notice(runtimeContext.t("NOTICE_CANNOT_MOVE_AUTO_LAYOUT_DISABLED"));
        return;
      }
      if (current.customData?.isPinned) {
        new runtimeContext.Notice(runtimeContext.t("NOTICE_CANNOT_MOVE_PINNED"));
        return;
      }
      const rootCenter = root.x + root.width / 2;
      const curCenter = current.x + current.width / 2;
      const rootCenterY = root.y + root.height / 2;
      const curCenterY = current.y + current.height / 2;
      const mapMode = root.customData?.growthMode || runtimeContext.currentModalGrowthMode;
      const isVerticalMode = ["Up-facing", "Down-facing", "Up-Down"].includes(mapMode);
      const isRadial = mapMode === "Radial";
      const isInPositive = isVerticalMode ? curCenterY > rootCenterY : curCenter > rootCenter;
      const oldSettingsRoot = runtimeContext.getSettingsRootNode(parent, allElements) || allElements.find((e) => e.id === info.rootId);
      const oldDepth = runtimeContext.getDepthFromAncestor(
        current.id,
        oldSettingsRoot.id,
        allElements
      );
      const oldRootCfg = runtimeContext.getRootConfigForNode(oldSettingsRoot);
      if (parent.id === root.id && (!isVerticalMode && mapMode === "Right-Left" || isVerticalMode && mapMode === "Up-Down")) {
        const movePos = isVerticalMode ? !isInPositive && key === "ArrowDown" : !isInPositive && key === "ArrowRight";
        const moveNeg = isVerticalMode ? isInPositive && key === "ArrowUp" : isInPositive && key === "ArrowLeft";
        if (movePos || moveNeg) {
          const delta = isVerticalMode ? 2 * (rootCenterY - curCenterY) : 2 * (rootCenter - curCenter);
          const branchIds = runtimeContext.getBranchElementIds(current.id, allElements);
          const decorationAndCrossLinkIds = runtimeContext.getDecorationAndCrossLinkIdsForBranches(
            branchIds,
            allElements,
            info.rootId
          );
          const elementsToMove = /* @__PURE__ */ new Set();
          branchIds.forEach((id) => {
            const el = allElements.find((x) => x.id === id);
            if (el) elementsToMove.add(el);
          });
          decorationAndCrossLinkIds.forEach((id) => {
            const el = allElements.find((x) => x.id === id);
            if (el) elementsToMove.add(el);
          });
          const arr = Array.from(elementsToMove);
          runtimeContext.ea.copyViewElementsToEAforEditing(arr);
          arr.forEach((el) => {
            const eaEl = runtimeContext.ea.getElement(el.id);
            if (isVerticalMode) eaEl.y += delta;
            else eaEl.x += delta;
          });
          await runtimeContext.addElementsToView({
            captureUpdate: "EVENTUALLY"
          });
          runtimeContext.triggerGlobalLayout(root.id, false, false);
          return;
        }
      }
      const isPromote = isVerticalMode ? isInPositive && key === "ArrowUp" || !isInPositive && key === "ArrowDown" : isInPositive && key === "ArrowLeft" || !isInPositive && key === "ArrowRight";
      const isDemote = isVerticalMode ? isInPositive && key === "ArrowDown" || !isInPositive && key === "ArrowUp" : isInPositive && key === "ArrowRight" || !isInPositive && key === "ArrowLeft";
      if (isPromote) {
        if (parent.id === root.id && root.customData?.isAdditionalRoot !== true) return;
        const grandParent = runtimeContext.getParentNode(parent.id, allElements);
        if (!grandParent) return;
        const arrow = allElements.find(
          (a) => a.type === "arrow" && a.customData?.isBranch && a.startBinding?.elementId === parent.id && a.endBinding?.elementId === current.id
        );
        if (arrow) {
          const newSettingsRoot = runtimeContext.getSettingsRootNode(grandParent, allElements) || allElements.find((e) => e.id === info.rootId);
          const newRootCfg = runtimeContext.getRootConfigForNode(newSettingsRoot);
          const newDepth = runtimeContext.getDepthFromAncestor(grandParent.id, newSettingsRoot.id, allElements) + 1;
          runtimeContext.reconnectArrow(parent, grandParent, arrow, "start");
          const parentOrder = runtimeContext.getMindmapOrder(parent);
          const promoteTargetRoot = parent.customData?.isAdditionalRoot === true ? newSettingsRoot : root;
          runtimeContext.ea.copyViewElementsToEAforEditing([current]);
          runtimeContext.ea.addAppendUpdateCustomData(current.id, {
            mindmapOrder: isRadial && !isInPositive ? parentOrder - 0.5 : parentOrder + 0.5
          });
          updateSubtreeFontSize(
            current.id,
            newDepth,
            oldDepth,
            allElements,
            newRootCfg.fontsizeScale,
            oldRootCfg.fontsizeScale
          );
          updateSubtreeStrokeWidth(
            current.id,
            newDepth,
            oldDepth,
            allElements,
            newRootCfg.baseStrokeWidth,
            newRootCfg.branchScale,
            oldRootCfg.baseStrokeWidth,
            oldRootCfg.branchScale
          );
          const isTargetL1 = grandParent.id === promoteTargetRoot.id;
          let targetColor;
          if (isTargetL1) {
            if (newRootCfg.multicolor) {
              targetColor = current.customData?.previousL1Color;
              if (!targetColor) {
                const existingL1Colors = runtimeContext.getChildrenNodes(promoteTargetRoot.id, allElements).map((n) => n.strokeColor);
                targetColor = runtimeContext.getDynamicColor(existingL1Colors);
              }
            } else {
              targetColor = promoteTargetRoot.strokeColor;
            }
          } else {
            targetColor = grandParent.strokeColor;
          }
          updateSubtreeColor(current.id, current.strokeColor, targetColor, allElements);
          await runtimeContext.addElementsToView({
            captureUpdate: "EVENTUALLY"
          });
          runtimeContext.triggerGlobalLayout(promoteTargetRoot.id, false, true);
          return;
        }
      }
      if (isDemote) {
        const siblings = runtimeContext.getChildrenNodes(parent.id, allElements);
        siblings.sort(
          (a, b) => runtimeContext.getMindmapOrder(a) - runtimeContext.getMindmapOrder(b)
        );
        if (siblings.length < 2) {
          new runtimeContext.Notice(runtimeContext.t("NOTICE_CANNOT_DEMOTE_NO_SIBLING_TO_ACCEPT"));
          return;
        }
        const currentIndex = siblings.findIndex((s) => s.id === current.id);
        const mirrorBehavior = isRadial && !isInPositive;
        let targetIndex = mirrorBehavior ? currentIndex + 1 : currentIndex - 1;
        if (targetIndex < 0 || targetIndex >= siblings.length) {
          new runtimeContext.Notice(runtimeContext.t("NOTICE_CANNOT_DEMOTE_NO_VALID_SIBLING"));
          return;
        }
        const newParent = siblings[targetIndex];
        if (parent.id === root.id) {
          const targetIsPos = isVerticalMode ? newParent.y + newParent.height / 2 > rootCenterY : newParent.x + newParent.width / 2 > rootCenter;
          if (targetIsPos !== isInPositive) {
            new runtimeContext.Notice(
              runtimeContext.t("NOTICE_CANNOT_DEMOTE_CROSS_SIDE_NOT_ALLOWED")
            );
            return;
          }
        }
        const arrow = allElements.find(
          (a) => a.type === "arrow" && a.customData?.isBranch && a.startBinding?.elementId === parent.id && a.endBinding?.elementId === current.id
        );
        if (arrow) {
          const newSettingsRoot = runtimeContext.getSettingsRootNode(newParent, allElements) || allElements.find((e) => e.id === info.rootId);
          const newRootCfg = runtimeContext.getRootConfigForNode(newSettingsRoot);
          const newDepth = runtimeContext.getDepthFromAncestor(newParent.id, newSettingsRoot.id, allElements) + 1;
          runtimeContext.reconnectArrow(parent, newParent, arrow, "start");
          const newParentChildren = runtimeContext.getChildrenNodes(newParent.id, allElements);
          const nextOrder = newParentChildren.length > 0 ? Math.max(...newParentChildren.map(runtimeContext.getMindmapOrder)) + 1 : 0;
          runtimeContext.ea.copyViewElementsToEAforEditing([current]);
          if (parent.id === oldSettingsRoot.id) {
            runtimeContext.ea.addAppendUpdateCustomData(current.id, {
              mindmapOrder: nextOrder,
              previousL1Color: current.strokeColor
            });
          } else {
            runtimeContext.ea.addAppendUpdateCustomData(current.id, {
              mindmapOrder: nextOrder
            });
          }
          updateSubtreeFontSize(
            current.id,
            newDepth,
            oldDepth,
            allElements,
            newRootCfg.fontsizeScale,
            oldRootCfg.fontsizeScale
          );
          updateSubtreeStrokeWidth(
            current.id,
            newDepth,
            oldDepth,
            allElements,
            newRootCfg.baseStrokeWidth,
            newRootCfg.branchScale,
            oldRootCfg.baseStrokeWidth,
            oldRootCfg.branchScale
          );
          const isTargetL1 = newParent.id === newSettingsRoot.id;
          let targetColor;
          if (isTargetL1) {
            if (newRootCfg.multicolor) {
              const existingL1Colors = runtimeContext.getChildrenNodes(newSettingsRoot.id, allElements).map((n) => n.strokeColor);
              targetColor = runtimeContext.getDynamicColor(existingL1Colors);
            } else {
              targetColor = newSettingsRoot.strokeColor;
            }
          } else {
            targetColor = newParent.strokeColor;
          }
          updateSubtreeColor(current.id, current.strokeColor, targetColor, allElements);
          await runtimeContext.addElementsToView({
            captureUpdate: "EVENTUALLY"
          });
          runtimeContext.triggerGlobalLayout(root.id, false, true);
        }
        return;
      }
      const isReorderPos = isVerticalMode ? key === "ArrowRight" : key === "ArrowDown";
      const isReorderNeg = isVerticalMode ? key === "ArrowLeft" : key === "ArrowUp";
      if (isReorderPos || isReorderNeg) {
        const siblings = runtimeContext.getChildrenNodes(parent.id, allElements);
        if (siblings.length < 2) return;
        siblings.sort(
          (a, b) => runtimeContext.getMindmapOrder(a) - runtimeContext.getMindmapOrder(b)
        );
        const currentIndex = siblings.findIndex((s) => s.id === current.id);
        if (currentIndex === -1) return;
        let swapIndex = -1;
        if (isVerticalMode) {
          if (key === "ArrowRight") swapIndex = currentIndex + 1;
          if (key === "ArrowLeft") swapIndex = currentIndex - 1;
        } else {
          if (isRadial && !isInPositive) {
            if (key === "ArrowUp") swapIndex = currentIndex + 1;
            if (key === "ArrowDown") swapIndex = currentIndex - 1;
          } else {
            if (key === "ArrowDown") swapIndex = currentIndex + 1;
            if (key === "ArrowUp") swapIndex = currentIndex - 1;
          }
        }
        if (isRadial && parent.id === root.id) {
          swapIndex = (swapIndex + siblings.length) % siblings.length;
        }
        if (swapIndex >= 0 && swapIndex < siblings.length) {
          const swapNode = siblings[swapIndex];
          if (parent.id === root.id && !isRadial) {
            const swapIsPos = isVerticalMode ? swapNode.y + swapNode.height / 2 > rootCenterY : swapNode.x + swapNode.width / 2 > rootCenter;
            if (swapIsPos !== isInPositive) {
              return;
            }
          }
          runtimeContext.ea.copyViewElementsToEAforEditing(siblings);
          siblings.forEach((sib, idx) => {
            let newOrder = idx;
            if (idx === currentIndex) newOrder = swapIndex;
            if (idx === swapIndex) newOrder = currentIndex;
            runtimeContext.ea.addAppendUpdateCustomData(sib.id, {
              mindmapOrder: newOrder
            });
          });
          await runtimeContext.addElementsToView({
            captureUpdate: "EVENTUALLY"
          });
          runtimeContext.triggerGlobalLayout(root.id, false, true);
        }
      }
    };
    return {
      updateSubtreeFontSize,
      updateSubtreeStrokeWidth,
      updateSubtreeColor,
      toggleSubmapRoot,
      changeNodeOrder
    };
  }

  // src/scripts/mindmap-builder/nodeStyles.js
  function createNodeStyles(runtimeContext) {
    const togglePin = async () => {
      if (!runtimeContext.isViewSet()) return;
      const sel = runtimeContext.getMindmapNodeFromSelection();
      if (sel) {
        const boundTextElement = runtimeContext.ea.getBoundTextElement(sel, true)?.sceneElement;
        const newPinnedState = !(sel.customData?.isPinned === true);
        runtimeContext.ea.copyViewElementsToEAforEditing(
          boundTextElement ? [sel, boundTextElement] : [sel]
        );
        runtimeContext.ea.addAppendUpdateCustomData(sel.id, {
          isPinned: newPinnedState
        });
        if (boundTextElement && !newPinnedState && boundTextElement.customData?.hasOwnProperty("isPinned")) {
          runtimeContext.ea.addAppendUpdateCustomData(boundTextElement.id, {
            isPinned: void 0
          });
        }
        await runtimeContext.addElementsToView({
          captureUpdate: runtimeContext.autoLayoutDisabled ? "IMMEDIATELY" : "EVENTUALLY"
        });
        if (!runtimeContext.autoLayoutDisabled) await runtimeContext.refreshMapLayout();
        runtimeContext.selectNodeInView(sel);
        runtimeContext.updateUI();
      }
    };
    const toggleCheckboxStatus = async () => {
      if (!runtimeContext.isViewSet()) return;
      let targetText = "";
      let isInputEl = false;
      let textElId = null;
      let sel = null;
      if (runtimeContext.inputEl && runtimeContext.inputEl.value.trim() !== "") {
        targetText = runtimeContext.inputEl.value;
        isInputEl = true;
      } else {
        sel = runtimeContext.getMindmapNodeFromSelection();
        if (!sel) return;
        const all = runtimeContext.ea.getViewElements();
        const info = runtimeContext.getHierarchy(sel, all);
        if (info.rootId === sel.id) return;
        textElId = sel.type === "text" ? sel.id : null;
        if (!textElId && sel.boundElements) {
          const boundText = sel.boundElements.find((be) => be.type === "text");
          if (boundText) textElId = boundText.id;
        }
        if (!textElId) return;
        const textEl = all.find((el) => el.id === textElId);
        if (!textEl) return;
        targetText = textEl.rawText;
      }
      const taskRegex = /^- \[([ xX])\] (.*)/s;
      const match = targetText.match(taskRegex);
      let newText = "";
      if (match) {
        const status = match[1];
        const content = match[2];
        if (status === " ") {
          newText = `- [x] ${content}`;
        } else {
          newText = `${content}`;
        }
      } else {
        newText = `- [ ] ${targetText}`;
      }
      if (isInputEl) {
        runtimeContext.inputEl.value = newText;
        runtimeContext.updateUI();
      } else {
        const all = runtimeContext.ea.getViewElements();
        const textEl = all.find((el) => el.id === textElId);
        runtimeContext.ea.copyViewElementsToEAforEditing([textEl]);
        const eaEl = runtimeContext.ea.getElement(textEl.id);
        eaEl.rawText = newText;
        eaEl.text = newText;
        eaEl.originalText = newText;
        runtimeContext.ea.refreshTextElementSize(eaEl.id);
        await runtimeContext.addElementsToView({
          captureUpdate: runtimeContext.autoLayoutDisabled ? "IMMEDIATELY" : "EVENTUALLY"
        });
        if (eaEl.containerId) {
          const updatedContainer = runtimeContext.ea.getViewElements().find((el) => el.id === eaEl.containerId);
          if (updatedContainer) runtimeContext.api().updateContainerSize([updatedContainer]);
        }
        if (!runtimeContext.autoLayoutDisabled) {
          const info = runtimeContext.getHierarchy(sel, runtimeContext.ea.getViewElements());
          await runtimeContext.triggerGlobalLayout(info.rootId);
        }
      }
    };
    const toggleEmbedStatus = async () => {
      if (!runtimeContext.isViewSet()) return;
      const sel = runtimeContext.getMindmapNodeFromSelection();
      if (!sel) return;
      const all = runtimeContext.ea.getViewElements();
      const visualNode = sel.containerId ? all.find((el) => el.id === sel.containerId) : sel;
      const nodeText = runtimeContext.getTextFromNode(all, visualNode, true, true).trim();
      const linkRegex = /^(!?)\[\[([^\]]+?#([^\]|]+))(?:\|[^\]]*)?\]\]$/;
      const match = nodeText.match(linkRegex);
      if (!match) return;
      const isEmbed = match[1] === "!";
      const linkCore = match[2];
      const sectionRef = match[3];
      let newText = "";
      if (isEmbed) {
        const alias = sectionRef.replace(/^#+\s*/, "").trim();
        newText = `[[${linkCore}|${alias}]]`;
      } else {
        newText = `![[${linkCore}]]`;
      }
      runtimeContext.editingNodeId = sel.id;
      runtimeContext.inputEl.value = newText;
      const incomingArrow = all.find(
        (a) => a.type === "arrow" && a.customData?.isBranch && a.endBinding?.elementId === sel.id
      );
      runtimeContext.ontologyEl.value = incomingArrow ? runtimeContext.ea.getBoundTextElement(incomingArrow, true)?.sceneElement?.rawText || "" : "";
      await runtimeContext.commitEdit();
    };
    const toggleBox = async (shape = "rectangle") => {
      if (!runtimeContext.isViewSet()) return;
      let sel = runtimeContext.getMindmapNodeFromSelection();
      if (!sel) return;
      sel = runtimeContext.ea.getBoundTextElement(sel, true).sceneElement;
      if (!sel) return;
      let oldBindId, newBindId, finalElId;
      const hasContainer = !!sel.containerId;
      const ids = hasContainer ? [sel.id, sel.containerId] : [sel.id];
      const allElements = runtimeContext.ea.getViewElements();
      const arrowsToUpdate = allElements.filter(
        (el) => el.type === "arrow" && (ids.includes(el.startBinding?.elementId) || ids.includes(el.endBinding?.elementId))
      );
      if (hasContainer) {
        const containerId = oldBindId = sel.containerId;
        finalElId = newBindId = sel.id;
        const container = allElements.find((el) => el.id === containerId);
        runtimeContext.ea.copyViewElementsToEAforEditing(arrowsToUpdate.concat(sel, container));
        const textEl = runtimeContext.ea.getElement(sel.id);
        const dataToCopy = {
          ...container.customData || {}
        };
        runtimeContext.ea.addAppendUpdateCustomData(textEl.id, dataToCopy);
        textEl.containerId = null;
        textEl.boundElements = [];
        runtimeContext.ea.getElement(containerId).isDeleted = true;
      } else {
        runtimeContext.ea.copyViewElementsToEAforEditing(arrowsToUpdate.concat(sel));
        const depth = runtimeContext.getHierarchy(sel, allElements)?.depth || 0;
        oldBindId = sel.id;
        let rectId;
        if (shape === "ellipse") {
          rectId = runtimeContext.ea.addEllipse(
            sel.x - runtimeContext.padding,
            sel.y - runtimeContext.padding,
            sel.width + runtimeContext.padding * 2,
            sel.height + runtimeContext.padding * 2
          );
        } else if (shape === "diamond") {
          rectId = runtimeContext.ea.addDiamond(
            sel.x - runtimeContext.padding,
            sel.y - runtimeContext.padding,
            sel.width + runtimeContext.padding * 2,
            sel.height + runtimeContext.padding * 2
          );
        } else {
          rectId = runtimeContext.ea.addRect(
            sel.x - runtimeContext.padding,
            sel.y - runtimeContext.padding,
            sel.width + runtimeContext.padding * 2,
            sel.height + runtimeContext.padding * 2
          );
        }
        finalElId = newBindId = rectId;
        const rect = runtimeContext.ea.getElement(rectId);
        const dataToCopy = {
          ...sel.customData || {}
        };
        runtimeContext.ea.addAppendUpdateCustomData(rectId, dataToCopy);
        rect.strokeColor = runtimeContext.ea.getCM(sel.strokeColor).stringRGB();
        rect.strokeWidth = runtimeContext.getStrokeWidthForDepth(depth);
        rect.roughness = runtimeContext.getAppState().currentItemRoughness;
        rect.roundness = runtimeContext.roundedCorners ? {
          type: 3
        } : null;
        rect.backgroundColor = "transparent";
        const textEl = runtimeContext.ea.getElement(sel.id);
        textEl.containerId = rectId;
        textEl.boundElements = null;
        rect.boundElements = [
          {
            type: "text",
            id: sel.id
          }
        ];
        rect.groupIds = sel.groupIds ? [...sel.groupIds] : [];
      }
      runtimeContext.ea.getElements().filter((el) => el.type === "arrow").forEach((a) => {
        if (a.startBinding?.elementId === oldBindId) {
          a.startBinding.elementId = newBindId;
          runtimeContext.ea.getElement(newBindId).boundElements.push({
            type: "arrow",
            id: a.id
          });
        }
        if (a.endBinding?.elementId === oldBindId) {
          a.endBinding.elementId = newBindId;
          runtimeContext.ea.getElement(newBindId).boundElements.push({
            type: "arrow",
            id: a.id
          });
        }
      });
      runtimeContext.ea.getElement(oldBindId).boundElements = [];
      delete runtimeContext.ea.getElement(oldBindId).customData;
      await runtimeContext.addElementsToView({
        captureUpdate: runtimeContext.autoLayoutDisabled ? "IMMEDIATELY" : "EVENTUALLY"
      });
      if (!hasContainer) {
        const textElement = runtimeContext.ea.getViewElements().find((el) => el.id === sel.id);
        const idx = runtimeContext.ea.getViewElements().indexOf(textElement);
        runtimeContext.ea.moveViewElementToZIndex(textElement.containerId, idx);
      }
      if (!hasContainer) {
        runtimeContext.api().updateContainerSize([
          runtimeContext.ea.getViewElements().find((el) => el.id === newBindId)
        ]);
      }
      runtimeContext.selectNodeInView(finalElId);
      if (!runtimeContext.autoLayoutDisabled) await runtimeContext.refreshMapLayout();
      runtimeContext.updateUI();
    };
    return { togglePin, toggleCheckboxStatus, toggleEmbedStatus, toggleBox };
  }

  // src/scripts/mindmap-builder/keyboard.js
  function createKeyboard(runtimeContext) {
    let disposed = false;
    let popRootScope = () => {
    };
    const ownedKeydownCleanups = /* @__PURE__ */ new Set();
    const removeObsidianHotkeyOverrides = () => popRootScope();
    const disposeKeyboard = () => {
      disposed = true;
      removeObsidianHotkeyOverrides();
      ownedKeydownCleanups.forEach((cleanup) => cleanup());
    };
    const getObsidianConflict = (h) => {
      if (!h) return null;
      const normalize = (s) => s.toLowerCase().replace("key", "").replace("digit", "");
      const sortMods = (m) => [...m].sort().join(",");
      const keysToCheck = h.isNavigation ? ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"] : [h.code ? h.code : h.key];
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
    function updateUserHotkeys() {
      let dirty = false;
      const defaultByAction = new Map(runtimeContext.DEFAULT_HOTKEYS.map((d) => [d.action, d]));
      const structuralKeys = ["isInputOnly", "requiresNode", "isNavigation", "hidden"];
      const userByAction = /* @__PURE__ */ new Map();
      for (const u of runtimeContext.userHotkeys) {
        if (u && typeof u.action === "string" && defaultByAction.has(u.action)) {
          userByAction.set(u.action, u);
        } else if (u && u.action) {
          dirty = true;
        }
      }
      const next = [];
      for (const d of runtimeContext.DEFAULT_HOTKEYS) {
        const u = userByAction.get(d.action);
        if (!u) {
          next.push(structuredClone ? structuredClone(d) : JSON.parse(JSON.stringify(d)));
          dirty = true;
          continue;
        }
        const cleaned = {
          action: d.action
        };
        for (const key of Object.keys(d)) {
          if (key === "action") continue;
          if (structuralKeys.includes(key)) {
            cleaned[key] = d[key];
            continue;
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
          if (structuralKeys.includes(key)) {
            dirty = true;
          } else if (!Object.prototype.hasOwnProperty.call(d, key)) {
            dirty = true;
            break;
          }
        }
        next.push(cleaned);
      }
      runtimeContext.userHotkeys = next;
      return dirty;
    }
    const getHotkeyDefByAction = (action) => runtimeContext.userHotkeys.find((h) => h.action === action);
    const getHotkeyDisplayString = (h) => {
      const parts = [];
      if (h.modifiers.includes("Ctrl")) parts.push("Ctrl");
      if (h.modifiers.includes("Meta")) parts.push("Cmd");
      if (h.modifiers.includes("Mod")) parts.push(runtimeContext.isMac ? "Cmd" : "Ctrl");
      if (h.modifiers.includes("Alt")) parts.push(runtimeContext.isMac ? "Opt" : "Alt");
      if (h.modifiers.includes("Shift")) parts.push("Shift");
      if (h.code) parts.push(h.code.replace("Key", "").replace("Digit", ""));
      else if (h.key === "ArrowKeys") parts.push("Arrow");
      else if (h.key === " ") parts.push("Space");
      else parts.push(h.key);
      return parts.join(" + ");
    };
    const getActionHotkeyString = (action) => `(${getHotkeyDisplayString(getHotkeyDefByAction(action))})`;
    const generateRuntimeHotkeys = () => {
      const runtimeKeys = [];
      runtimeContext.userHotkeys.forEach((h) => {
        if (h.isNavigation) {
          ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].forEach((key) => {
            runtimeKeys.push({
              action: h.action,
              key,
              modifiers: h.modifiers,
              scope: h.scope,
              requiresNode: h.requiresNode,
              isInputOnly: h.isInputOnly
            });
          });
        } else {
          runtimeKeys.push(h);
        }
      });
      return runtimeKeys;
    };
    const getHotkeyContext = (event) => {
      if (disposed || !runtimeContext.ea.sidepanelTab || !runtimeContext.isViewSet()) {
        return runtimeContext.SCOPE.none;
      }
      const currentWindow = runtimeContext.isUndocked && runtimeContext.floatingInputModal ? runtimeContext.ea.targetView?.ownerWindow : runtimeContext.sidepanelWindow;
      const activeElement = event?.target ?? currentWindow?.document?.activeElement;
      if (runtimeContext.inputEl && activeElement === runtimeContext.inputEl || runtimeContext.ontologyEl && activeElement === runtimeContext.ontologyEl) {
        return runtimeContext.SCOPE.input;
      }
      const leaf = app.workspace.activeLeaf;
      if (!leaf) return runtimeContext.SCOPE.none;
      if (runtimeContext.ea.targetView.leaf === leaf || runtimeContext.ea.getSidepanelLeaf() === leaf && runtimeContext.ea.sidepanelTab.isVisible()) {
        return runtimeContext.SCOPE.excalidraw;
      }
      if (runtimeContext.ea.targetView.leaf.isVisible()) {
        return runtimeContext.SCOPE.global;
      }
      return runtimeContext.SCOPE.none;
    };
    const registerKeydownHandler = (host, handler) => {
      if (disposed || !runtimeContext.ea.sidepanelTab) return;
      runtimeContext.removeKeydownHandlers();
      if (!window.MindmapBuilder) return;
      if (!window.MindmapBuilder.keydownHandlers) {
        window.MindmapBuilder.keydownHandlers = [];
      }
      host.addEventListener("keydown", handler, true);
      const cleanup = () => {
        host.removeEventListener("keydown", handler, true);
        ownedKeydownCleanups.delete(cleanup);
      };
      ownedKeydownCleanups.add(cleanup);
      window.MindmapBuilder.keydownHandlers.push(cleanup);
    };
    const registerObsidianHotkeyOverrides = () => {
      removeObsidianHotkeyOverrides();
      if (disposed || !runtimeContext.ea.sidepanelTab) return;
      const keymapScope = app.keymap.getRootScope();
      if (getHotkeyContext() === runtimeContext.SCOPE.none) return;
      const handler = keymapScope.register(
        null,
        null,
        (event) => canOverrideObsidianHotkey(event) ? true : void 0
      );
      const registry = window.MindmapBuilder;
      const release = () => {
        keymapScope.unregister(handler);
        if (registry?.popObsidianHotkeyScope === release) {
          delete registry.popObsidianHotkeyScope;
        }
        if (popRootScope === release) popRootScope = () => {
        };
      };
      popRootScope = release;
      try {
        const index = keymapScope.keys.indexOf(handler);
        if (index !== -1) keymapScope.keys.splice(index, 1);
        keymapScope.keys.unshift(handler);
        if (registry) registry.popObsidianHotkeyScope = release;
      } catch (error) {
        release();
        throw error;
      }
    };
    const updateKeyHandlerLocation = () => {
      if (runtimeContext.isUndocked) {
        if (runtimeContext.ea.targetView && runtimeContext.ea.targetView.ownerWindow) {
          registerKeydownHandler(runtimeContext.ea.targetView.ownerWindow, handleKeydown);
        }
      } else {
        if (runtimeContext.sidepanelWindow) {
          registerKeydownHandler(runtimeContext.sidepanelWindow, handleKeydown);
        }
      }
    };
    const getActionFromEvent = (e) => {
      const isMod = e.ctrlKey || e.metaKey;
      const match = runtimeContext.RUNTIME_HOTKEYS.find((h) => {
        const keyMatch = h.code ? e.code === h.code : e.key === h.key;
        if (!keyMatch) return false;
        const hasMod = h.modifiers.includes("Mod") || h.modifiers.includes("Ctrl") || h.modifiers.includes("Meta");
        const hasShift = h.modifiers.includes("Shift");
        const hasAlt = h.modifiers.includes("Alt");
        return isMod === hasMod && e.shiftKey === hasShift && e.altKey === hasAlt;
      });
      return match ? {
        action: match.action,
        scope: match.scope ?? runtimeContext.SCOPE.none,
        requiresNode: match.requiresNode,
        isInputOnly: match.isInputOnly
      } : {};
    };
    const canOverrideObsidianHotkey = (event) => {
      if (disposed || event.isComposing || event.keyCode === 229 || runtimeContext.isRecordingHotkey)
        return false;
      if (!runtimeContext.ea.targetView?.leaf.isVisible()) return false;
      const state = runtimeContext.getAppState();
      if (!state || state.editingTextElement || state.selectedLinearElement?.isEditing || state.showHyperlinkPopup === "editor")
        return false;
      if (runtimeContext.linkSuggester?.isBlockingKeys()) return false;
      const { action, scope, requiresNode, isInputOnly } = getActionFromEvent(event);
      const context = getHotkeyContext(event);
      if (!action || context < scope || isInputOnly && context !== runtimeContext.SCOPE.input)
        return false;
      if (requiresNode && !runtimeContext.getMindmapNodeFromSelection()) return false;
      if (action === runtimeContext.ACTION_UNDO && runtimeContext.lastCommittedTransaction === null)
        return false;
      if ((action === runtimeContext.ACTION_REDO_Z || action === runtimeContext.ACTION_REDO_Y) && runtimeContext.redoAvailable === null)
        return false;
      return true;
    };
    const handleKeydown = (e) => {
      if (disposed || !runtimeContext.ea.sidepanelTab) return;
      if (e.isComposing || e.keyCode === 229) return;
      if (runtimeContext.isRecordingHotkey) return;
      if (!runtimeContext.ea.targetView || !runtimeContext.ea.targetView.leaf.isVisible()) return;
      const currentWindow = runtimeContext.isUndocked && runtimeContext.floatingInputModal ? runtimeContext.ea.targetView?.ownerWindow : runtimeContext.sidepanelWindow;
      if (!currentWindow) return;
      const st = runtimeContext.getAppState();
      if (!st || !!st.editingTextElement || !!st.selectedLinearElement?.isEditing || st.showHyperlinkPopup === "editor")
        return;
      if (runtimeContext.linkSuggester?.isBlockingKeys()) {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      if (e.key === "Escape" && !runtimeContext.isUndocked && runtimeContext.inputEl.ownerDocument.activeElement !== runtimeContext.inputEl) {
        return;
      }
      let { action, scope, requiresNode, isInputOnly } = getActionFromEvent(e);
      if (!action && !["Tab", "Enter"].includes(e.key)) return;
      let context = getHotkeyContext(e);
      if (!action && runtimeContext.isUndocked && runtimeContext.floatingInputModal && e.key === "Tab") {
        const modalEl = runtimeContext.floatingInputModal.modalEl;
        if (!modalEl) return;
        const activeEl = modalEl.ownerDocument.activeElement;
        if (!modalEl.contains(activeEl)) return;
        const selector = ["input:not([disabled])", "div:not([style*='not-allowed'])"].join(",");
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
          idx = e.shiftKey ? idx === 0 ? focusables.length - 1 : idx - 1 : idx === focusables.length - 1 ? 0 : idx + 1;
          focusables[idx].focus();
        }
        return;
      }
      if (e.key === "Enter" && context === runtimeContext.SCOPE.excalidraw && (runtimeContext.isUndocked && runtimeContext.floatingInputModal || !runtimeContext.isUndocked)) {
        const modalEl = runtimeContext.isUndocked ? runtimeContext.floatingInputModal.modalEl : runtimeContext.ea.sidepanelTab.containerEl;
        const activeEl = modalEl?.ownerDocument.activeElement;
        action = activeEl?.getAttribute("action");
        if (!action) return;
        context = runtimeContext.SCOPE.input;
      }
      if (!action || context < scope || isInputOnly && context !== runtimeContext.SCOPE.input)
        return;
      if (requiresNode && !runtimeContext.getMindmapNodeFromSelection()) {
        return;
      }
      if (action === runtimeContext.ACTION_UNDO && runtimeContext.lastCommittedTransaction === null) {
        return;
      }
      if ((action === runtimeContext.ACTION_REDO_Z || action === runtimeContext.ACTION_REDO_Y) && runtimeContext.redoAvailable === null) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      runtimeContext.performAction(action, e);
    };
    const addSibling = async (event, insertAfter = true) => {
      if (!runtimeContext.inputEl.value) return;
      const dir = insertAfter ? 1 : -1;
      const allElementsForSibling = runtimeContext.ea.getViewElements();
      const selectedForSibling = runtimeContext.getMindmapNodeFromSelection();
      if (!selectedForSibling) {
        await runtimeContext.addNode(
          runtimeContext.inputEl.value,
          true,
          false,
          null,
          null,
          null,
          runtimeContext.ontologyEl.value
        );
      } else {
        const info = runtimeContext.getHierarchy(selectedForSibling, allElementsForSibling);
        const root = allElementsForSibling.find((el) => el.id === info.rootId);
        const parentOfSelected = runtimeContext.getParentNode(
          selectedForSibling.id,
          allElementsForSibling
        );
        const rootMode = root.customData?.growthMode || runtimeContext.currentModalGrowthMode;
        const isVertical = ["Up-facing", "Down-facing", "Up-Down"].includes(rootMode);
        const targetParent = parentOfSelected ?? selectedForSibling;
        let pos = {
          x: selectedForSibling.x + (isVertical && insertAfter ? selectedForSibling.width : 0) + (isVertical ? dir : 0),
          y: selectedForSibling.y + (!isVertical && insertAfter ? selectedForSibling.height : 0) + (!isVertical ? dir : 0)
        };
        if (parentOfSelected && parentOfSelected.id === root.id && root.customData?.growthMode === "Radial") {
          const rb = runtimeContext.getNodeBox(root, allElementsForSibling);
          const rc = {
            x: rb.minX + rb.width / 2,
            y: rb.minY + rb.height / 2
          };
          const sc = {
            x: selectedForSibling.x + selectedForSibling.width / 2,
            y: selectedForSibling.y + selectedForSibling.height / 2
          };
          const angle = Math.atan2(sc.y - rc.y, sc.x - rc.x) + dir * 0.2;
          const dist = Math.hypot(sc.x - rc.x, sc.y - rc.y);
          pos = {
            x: rc.x + Math.cos(angle) * dist - selectedForSibling.width / 2,
            y: rc.y + Math.sin(angle) * dist - selectedForSibling.height / 2
          };
        }
        runtimeContext.selectNodeInView(targetParent);
        await runtimeContext.addNode(
          runtimeContext.inputEl.value,
          false,
          false,
          null,
          null,
          pos,
          runtimeContext.ontologyEl.value
        );
      }
      runtimeContext.inputEl.value = "";
      runtimeContext.ontologyEl.value = "";
      runtimeContext.updateUI();
      await runtimeContext.performAction(runtimeContext.ACTION_ADD, event);
    };
    runtimeContext.ea.registerCleanup?.(disposeKeyboard);
    return {
      removeObsidianHotkeyOverrides,
      disposeKeyboard,
      getObsidianConflict,
      updateUserHotkeys,
      getHotkeyDefByAction,
      getHotkeyDisplayString,
      getActionHotkeyString,
      generateRuntimeHotkeys,
      getHotkeyContext,
      registerKeydownHandler,
      registerObsidianHotkeyOverrides,
      updateKeyHandlerLocation,
      getActionFromEvent,
      handleKeydown,
      addSibling
    };
  }

  // src/scripts/mindmap-builder/inputUi.js
  function createInputUi(runtimeContext) {
    const revealInputEl = () => {
      const undockPreference = runtimeContext.getVal(runtimeContext.K_UNDOCKED, false);
      if (undockPreference && !runtimeContext.isUndocked) {
        runtimeContext.toggleDock({
          saveSetting: false
        });
        return true;
      } else if (!undockPreference && !runtimeContext.isUndocked && runtimeContext.ea.sidepanelTab && !runtimeContext.ea.sidepanelTab.isVisible()) {
        runtimeContext.ea.sidepanelTab.reveal();
      }
      return false;
    };
    const focusInputEl = () => {
      revealInputEl();
      setTimeout(() => {
        if (runtimeContext.isRecordingHotkey) return;
        const target = runtimeContext.isOntologyFocused ? runtimeContext.ontologyEl.style.display === "none" ? runtimeContext.inputEl : runtimeContext.ontologyEl : runtimeContext.inputEl;
        if (!target || target.disabled) {
          return;
        }
        target.focus();
        if (!window.MindmapBuilder?.popObsidianHotkeyScope)
          runtimeContext.registerObsidianHotkeyOverrides();
      }, 200);
    };
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
      if (runtimeContext.pinBtn) runtimeContext.pinBtn.setIcon("pin-off");
      setButtonDisabled(runtimeContext.pinBtn, true);
      setButtonDisabled(runtimeContext.refreshBtn, true);
      setButtonDisabled(runtimeContext.copyBtn, true);
      setButtonDisabled(runtimeContext.cutBtn, true);
      setButtonDisabled(runtimeContext.importOutlineBtn, true);
      setButtonDisabled(runtimeContext.boxBtn, true);
      setButtonDisabled(runtimeContext.foldBtnL0, true);
      setButtonDisabled(runtimeContext.foldBtnL1, true);
      setButtonDisabled(runtimeContext.foldBtnAll, true);
      setButtonDisabled(runtimeContext.editBtn, true);
      setButtonDisabled(runtimeContext.toggleGroupBtn, true);
      setButtonDisabled(runtimeContext.zoomBtn, true);
      setButtonDisabled(runtimeContext.focusBtn, true);
      setButtonDisabled(runtimeContext.boundaryBtn, true);
      setButtonDisabled(runtimeContext.submapRootBtn, true);
      setButtonDisabled(runtimeContext.toggleCheckboxBtn, true);
      setButtonDisabled(runtimeContext.calendarBtn, true);
      setButtonDisabled(runtimeContext.toggleEmbedBtn, true);
      setButtonDisabled(runtimeContext.floatingGroupBtn, true);
      setButtonDisabled(runtimeContext.floatingBoxBtn, true);
      setButtonDisabled(runtimeContext.floatingZoomBtn, true);
      setButtonDisabled(runtimeContext.autoLayoutToggle, true);
      runtimeContext.editingNodeId = null;
      if (runtimeContext.editBtn) runtimeContext.editBtn.extraSettingsEl.style.color = "";
    };
    const updateUI = (sel) => {
      if (!runtimeContext.isViewSet()) {
        if (runtimeContext.inputEl) {
          runtimeContext.inputEl.disabled = true;
        }
        if (runtimeContext.ontologyEl) {
          runtimeContext.ontologyEl.style.display = "none";
        }
        disableUI();
        return;
      }
      if (runtimeContext.inputEl) {
        runtimeContext.inputEl.disabled = false;
      }
      const all = runtimeContext.ea.getViewElements();
      sel = sel ?? runtimeContext.getMindmapNodeFromSelection();
      if (runtimeContext.ontologyEl) {
        runtimeContext.ontologyEl.style.display = sel ? "" : "none";
      }
      let cd = {};
      const isMapSelected = !!sel;
      if (isMapSelected) {
        runtimeContext.disableTabEvents = true;
        const info = runtimeContext.getHierarchy(sel, all);
        const isMasterRootSelected = info.rootId === sel.id;
        const root = runtimeContext.getSettingsRootNode(sel, all) || all.find((e) => e.id === info.rootId);
        const isPinned = sel.customData?.isPinned === true;
        const isAdditionalRoot = sel.customData?.isAdditionalRoot === true;
        const isMasterRoot = !runtimeContext.getParentNode(sel.id, all);
        const isEditing = runtimeContext.editingNodeId && runtimeContext.editingNodeId === sel.id;
        const branchIds = runtimeContext.getBranchElementIds(sel.id, all);
        const children = runtimeContext.getChildrenNodes(sel.id, all);
        const hasChildren = children.length > 0;
        const hasGrandChildren = hasChildren && children.some((child) => runtimeContext.getChildrenNodes(child.id, all).length > 0);
        const nodeText = runtimeContext.getTextFromNode(all, sel, true, false);
        const isLinkedFile = !!runtimeContext.getNodeMarkdownFile(nodeText);
        cd = root?.customData ?? {};
        if (runtimeContext.toggleCheckboxBtn) {
          const isTextNode = sel.type === "text" || sel.boundElements && sel.boundElements.some((be) => be.type === "text");
          const canEditTask = isTextNode && !isMasterRootSelected || runtimeContext.inputEl && runtimeContext.inputEl.value.trim() !== "";
          setButtonDisabled(runtimeContext.toggleCheckboxBtn, !canEditTask);
        }
        if (runtimeContext.calendarBtn) {
          const isTextNode = sel.type === "text" || sel.boundElements && sel.boundElements.some((be) => be.type === "text");
          const canEditTask = isTextNode && !isMasterRootSelected || runtimeContext.inputEl && runtimeContext.inputEl.value.trim() !== "";
          setButtonDisabled(runtimeContext.calendarBtn, !canEditTask);
        }
        if (runtimeContext.toggleEmbedBtn) {
          const visualNode = sel.containerId ? all.find((el) => el.id === sel.containerId) : sel;
          const nodeTextForEmbed = runtimeContext.getTextFromNode(all, visualNode, true, true).trim();
          const linkRegex = /^!?\[\[([^\]]+?#[^\]|]+)(?:\|[^\]]*)?\]\]$/;
          setButtonDisabled(runtimeContext.toggleEmbedBtn, !linkRegex.test(nodeTextForEmbed));
        }
        if (runtimeContext.pinBtn) {
          runtimeContext.pinBtn.setIcon(isPinned ? "pin" : "pin-off");
          runtimeContext.pinBtn.setTooltip(
            `${isPinned ? runtimeContext.t("PIN_TOOLTIP_PINNED") : runtimeContext.t("PIN_TOOLTIP_UNPINNED")} ${runtimeContext.getActionHotkeyString(runtimeContext.ACTION_PIN)}`
          );
          setButtonDisabled(runtimeContext.pinBtn, false);
        }
        if (runtimeContext.submapRootBtn) {
          runtimeContext.submapRootBtn.setIcon(
            isAdditionalRoot ? "map-pin-minus-inside" : "map-pin-plus-inside"
          );
          runtimeContext.submapRootBtn.setTooltip(
            `${isAdditionalRoot ? runtimeContext.t("TOOLTIP_SUBMAP_ROOT_REMOVE") : runtimeContext.t("TOOLTIP_SUBMAP_ROOT_ADD")} ${runtimeContext.getActionHotkeyString(runtimeContext.ACTION_TOGGLE_SUBMAP_ROOT)}`
          );
          setButtonDisabled(runtimeContext.submapRootBtn, isMasterRoot);
        }
        if (runtimeContext.editBtn) {
          setButtonDisabled(runtimeContext.editBtn, false);
          if (isEditing) {
            runtimeContext.editBtn.extraSettingsEl.style.color = "var(--interactive-accent)";
          } else {
            runtimeContext.editingNodeId = null;
            runtimeContext.editBtn.extraSettingsEl.style.color = "";
          }
        }
        const updateGroupBtn = (btn) => {
          if (!btn) {
            return;
          }
          const isGrouped = branchIds.length > 1 && !!runtimeContext.getCommonGroupForElements(
            all.filter((el) => branchIds.includes(el.id))
          )[0];
          btn.setIcon(isGrouped ? "ungroup" : "group");
          btn.setTooltip(
            `${isGrouped ? runtimeContext.t("TOGGLE_GROUP_TOOLTIP_UNGROUP") : runtimeContext.t("TOGGLE_GROUP_TOOLTIP_GROUP")} ${runtimeContext.getActionHotkeyString(runtimeContext.ACTION_TOGGLE_GROUP)}`
          );
          setButtonDisabled(btn, runtimeContext.groupBranches || branchIds.length <= 1);
        };
        updateGroupBtn(runtimeContext.toggleGroupBtn);
        updateGroupBtn(runtimeContext.floatingGroupBtn);
        setButtonDisabled(runtimeContext.boxBtn, false);
        setButtonDisabled(runtimeContext.floatingBoxBtn, false);
        setButtonDisabled(runtimeContext.foldBtnL0, !hasChildren);
        setButtonDisabled(runtimeContext.foldBtnL1, !hasGrandChildren);
        setButtonDisabled(runtimeContext.foldBtnAll, !hasGrandChildren);
        setButtonDisabled(runtimeContext.zoomBtn, false);
        setButtonDisabled(runtimeContext.focusBtn, false);
        setButtonDisabled(runtimeContext.floatingZoomBtn, false);
        if (runtimeContext.boundaryBtn) {
          runtimeContext.boundaryBtn.setIcon(sel.customData?.boundaryId ? "cloud-off" : "cloud");
        }
        setButtonDisabled(runtimeContext.boundaryBtn, isMasterRootSelected);
        setButtonDisabled(runtimeContext.cutBtn, isMasterRootSelected);
        setButtonDisabled(runtimeContext.copyBtn, false);
        setButtonDisabled(runtimeContext.importOutlineBtn, !isLinkedFile);
        if (runtimeContext.refreshBtn) {
          setButtonDisabled(runtimeContext.refreshBtn, cd.autoLayoutDisabled === true);
          runtimeContext.refreshBtn.setTooltip(
            `${runtimeContext.t("TOOLTIP_REFRESH")} ${runtimeContext.getActionHotkeyString(runtimeContext.ACTION_REARRANGE)}`
          );
        }
      } else {
        disableUI();
        if (runtimeContext.mostRecentlySelectedNodeID) {
          setButtonDisabled(runtimeContext.zoomBtn, false);
          setButtonDisabled(runtimeContext.focusBtn, false);
          setButtonDisabled(runtimeContext.floatingZoomBtn, false);
        }
        if (runtimeContext.inputEl && runtimeContext.inputEl.value.trim() !== "") {
          if (runtimeContext.toggleCheckboxBtn) {
            setButtonDisabled(runtimeContext.toggleCheckboxBtn, false);
          }
          if (runtimeContext.calendarBtn) {
            setButtonDisabled(runtimeContext.calendarBtn, false);
          }
        }
        setButtonDisabled(runtimeContext.autoLayoutToggle, false);
      }
      const mapPresetName = cd?.presetName;
      if (isMapSelected) {
        runtimeContext.activePresetName = mapPresetName || "Default";
        runtimeContext.setVal(runtimeContext.K_ACTIVE_PRESET, runtimeContext.activePresetName);
      } else {
        runtimeContext.activePresetName = runtimeContext.getVal(
          runtimeContext.K_ACTIVE_PRESET,
          "Default"
        );
      }
      if (runtimeContext.presetDropdown) {
        runtimeContext.presetDropdown.setValue(runtimeContext.activePresetName);
      }
      let showWarning = false;
      if (isMapSelected) {
        const presetConfig = runtimeContext.mapPresets[runtimeContext.activePresetName];
        const currentMapConfig = {
          growthMode: cd?.growthMode ?? runtimeContext.currentModalGrowthMode,
          arrowType: cd?.arrowType ?? runtimeContext.arrowType,
          fontsizeScale: cd?.fontsizeScale ?? runtimeContext.fontsizeScale,
          multicolor: typeof cd?.multicolor === "boolean" ? cd.multicolor : runtimeContext.multicolor,
          boxChildren: typeof cd?.boxChildren === "boolean" ? cd.boxChildren : runtimeContext.boxChildren,
          roundedCorners: typeof cd?.roundedCorners === "boolean" ? cd.roundedCorners : runtimeContext.roundedCorners,
          maxWrapWidth: typeof cd?.maxWrapWidth === "number" ? cd.maxWrapWidth : runtimeContext.maxWidth,
          isSolidArrow: typeof cd?.isSolidArrow === "boolean" ? cd.isSolidArrow : runtimeContext.isSolidArrow,
          centerText: typeof cd?.centerText === "boolean" ? cd.centerText : runtimeContext.centerText,
          fillSweep: typeof cd?.fillSweep === "boolean" ? cd.fillSweep : runtimeContext.fillSweep,
          branchScale: cd?.branchScale ?? runtimeContext.branchScale,
          baseStrokeWidth: typeof cd?.baseStrokeWidth === "number" ? cd.baseStrokeWidth : runtimeContext.baseStrokeWidth,
          customPalette: cd?.customPalette ?? runtimeContext.customPalette,
          layoutSettings: cd?.layoutSettings ?? runtimeContext.layoutSettings
        };
        showWarning = runtimeContext.diffMapConfig(presetConfig, currentMapConfig);
      }
      if (runtimeContext.presetWarningEl) {
        runtimeContext.presetWarningEl.style.display = showWarning ? "block" : "none";
      }
      if (runtimeContext.presetApplyBtn) {
        setButtonDisabled(runtimeContext.presetApplyBtn, !isMapSelected);
      }
      if (runtimeContext.presetTrashBtn) {
        setButtonDisabled(
          runtimeContext.presetTrashBtn,
          runtimeContext.activePresetName === "Default"
        );
      }
      if (runtimeContext.presetSaveBtn) {
        setButtonDisabled(runtimeContext.presetSaveBtn, false);
      }
      if (isMapSelected) {
        runtimeContext.currentModalGrowthMode = typeof cd.growthMode === "string" && runtimeContext.GROWTH_TYPES.includes(cd.growthMode) ? cd.growthMode : runtimeContext.getVal(runtimeContext.K_GROWTH, "Right-Left");
        runtimeContext.setVal(runtimeContext.K_GROWTH, runtimeContext.currentModalGrowthMode);
        runtimeContext.autoLayoutDisabled = cd.autoLayoutDisabled === true;
        runtimeContext.arrowType = typeof cd.arrowType === "string" && runtimeContext.ARROW_TYPES.includes(cd.arrowType) ? cd.arrowType : runtimeContext.getVal(runtimeContext.K_ARROW_TYPE, "curved");
        runtimeContext.setVal(runtimeContext.K_ARROW_TYPE, runtimeContext.arrowType);
        runtimeContext.fontsizeScale = cd.fontsizeScale ?? runtimeContext.getVal(runtimeContext.K_FONTSIZE, "Normal Scale");
        runtimeContext.setVal(runtimeContext.K_FONTSIZE, runtimeContext.fontsizeScale);
        runtimeContext.multicolor = typeof cd.multicolor === "boolean" ? cd.multicolor : runtimeContext.getVal(runtimeContext.K_MULTICOLOR, true);
        runtimeContext.setVal(runtimeContext.K_MULTICOLOR, runtimeContext.multicolor);
        runtimeContext.boxChildren = typeof cd.boxChildren === "boolean" ? cd.boxChildren : runtimeContext.getVal(runtimeContext.K_BOX, false);
        runtimeContext.setVal(runtimeContext.K_BOX, runtimeContext.boxChildren);
        runtimeContext.roundedCorners = typeof cd.roundedCorners === "boolean" ? cd.roundedCorners : runtimeContext.getVal(runtimeContext.K_ROUND, false);
        runtimeContext.setVal(runtimeContext.K_ROUND, runtimeContext.roundedCorners);
        runtimeContext.maxWidth = typeof cd.maxWrapWidth === "number" ? cd.maxWrapWidth : parseInt(runtimeContext.getVal(runtimeContext.K_WIDTH, 450)) || 450;
        runtimeContext.setVal(runtimeContext.K_WIDTH, runtimeContext.maxWidth);
        runtimeContext.isSolidArrow = typeof cd.isSolidArrow === "boolean" ? cd.isSolidArrow : runtimeContext.getVal(runtimeContext.K_ARROWSTROKE, true);
        runtimeContext.setVal(runtimeContext.K_ARROWSTROKE, runtimeContext.isSolidArrow);
        runtimeContext.centerText = typeof cd.centerText === "boolean" ? cd.centerText : runtimeContext.getVal(runtimeContext.K_CENTERTEXT, true);
        runtimeContext.setVal(runtimeContext.K_CENTERTEXT, runtimeContext.centerText);
        runtimeContext.fillSweep = typeof cd.fillSweep === "boolean" ? cd.fillSweep : runtimeContext.getVal(runtimeContext.K_FILL_SWEEP, false);
        runtimeContext.setVal(runtimeContext.K_FILL_SWEEP, runtimeContext.fillSweep);
        runtimeContext.branchScale = cd.branchScale && runtimeContext.BRANCH_SCALE_TYPES.includes(cd.branchScale) ? cd.branchScale : runtimeContext.getVal(runtimeContext.K_BRANCH_SCALE, "Hierarchical");
        runtimeContext.setVal(runtimeContext.K_BRANCH_SCALE, runtimeContext.branchScale);
        runtimeContext.baseStrokeWidth = typeof cd.baseStrokeWidth === "number" ? cd.baseStrokeWidth : parseFloat(runtimeContext.getVal(runtimeContext.K_BASE_WIDTH, 6)) || 6;
        runtimeContext.setVal(runtimeContext.K_BASE_WIDTH, runtimeContext.baseStrokeWidth);
        if (cd.customPalette) {
          runtimeContext.customPalette = JSON.parse(JSON.stringify(cd.customPalette));
        } else {
          runtimeContext.customPalette = runtimeContext.getVal(runtimeContext.K_PALETTE, {
            enabled: false,
            random: false,
            colors: []
          }) || { enabled: false, random: false, colors: [] };
        }
        runtimeContext.setVal(runtimeContext.K_PALETTE, runtimeContext.customPalette, true);
        if (cd.layoutSettings && typeof cd.layoutSettings === "object") {
          runtimeContext.layoutSettings = { ...runtimeContext.layoutSettings, ...cd.layoutSettings };
        } else {
          const globalDefaults = runtimeContext.getVal(runtimeContext.K_LAYOUT, {});
          Object.keys(runtimeContext.LAYOUT_METADATA).forEach((k) => {
            runtimeContext.layoutSettings[k] = globalDefaults[k] !== void 0 ? globalDefaults[k] : runtimeContext.LAYOUT_METADATA[k].def;
          });
        }
        runtimeContext.setVal(runtimeContext.K_LAYOUT, runtimeContext.layoutSettings, true);
      }
      if (runtimeContext.strategyDropdown) {
        runtimeContext.strategyDropdown.setValue(runtimeContext.currentModalGrowthMode);
      }
      if (runtimeContext.autoLayoutToggle) {
        runtimeContext.autoLayoutToggle.setValue(!runtimeContext.autoLayoutDisabled);
      }
      if (runtimeContext.arrowTypeToggle) {
        runtimeContext.arrowTypeToggle.setValue(runtimeContext.arrowType === "curved");
      }
      if (runtimeContext.fontSizeDropdown) {
        runtimeContext.fontSizeDropdown.setValue(runtimeContext.fontsizeScale);
      }
      if (runtimeContext.colorToggle) {
        runtimeContext.colorToggle.setValue(runtimeContext.multicolor);
      }
      if (runtimeContext.boxToggle) {
        runtimeContext.boxToggle.setValue(runtimeContext.boxChildren);
      }
      if (runtimeContext.roundToggle) {
        runtimeContext.roundToggle.setValue(runtimeContext.roundedCorners);
      }
      if (runtimeContext.widthSlider) {
        runtimeContext.widthSlider.setValue(runtimeContext.maxWidth);
        if (runtimeContext.widthSlider.valLabelEl) {
          runtimeContext.widthSlider.valLabelEl.setText(`${runtimeContext.maxWidth}px`);
        }
      }
      if (runtimeContext.strokeToggle) {
        runtimeContext.strokeToggle.setValue(!runtimeContext.isSolidArrow);
      }
      if (runtimeContext.centerToggle) {
        runtimeContext.centerToggle.setValue(runtimeContext.centerText);
      }
      if (runtimeContext.fillSweepToggle) {
        runtimeContext.fillSweepToggle.setValue(runtimeContext.fillSweep);
      }
      if (runtimeContext.branchScaleDropdown) {
        runtimeContext.branchScaleDropdown.setValue(runtimeContext.branchScale);
      }
      if (runtimeContext.baseWidthSlider) {
        runtimeContext.baseWidthSlider.setValue(runtimeContext.baseStrokeWidth);
        if (runtimeContext.baseWidthSlider.valLabelEl) {
          runtimeContext.baseWidthSlider.valLabelEl.setText(`${runtimeContext.baseStrokeWidth}`);
        }
      }
      if (runtimeContext.fillSweepToggleSetting && runtimeContext.fillSweepToggleSetting.settingEl) {
        runtimeContext.fillSweepToggleSetting.settingEl.style.display = runtimeContext.currentModalGrowthMode === "Radial" ? "" : "none";
      }
      runtimeContext.disableTabEvents = false;
    };
    return { revealInputEl, focusInputEl, setButtonDisabled, disableUI, updateUI };
  }

  // src/scripts/mindmap-builder/nodeEditing.js
  function createNodeEditing(runtimeContext) {
    const startEditing = () => {
      const sel = runtimeContext.getMindmapNodeFromSelection();
      if (!sel) return;
      const all = runtimeContext.ea.getViewElements();
      const text = runtimeContext.getTextFromNode(all, sel, true, true);
      if (text.match(/\n/)) {
        new runtimeContext.Notice(
          `${runtimeContext.t("NOTICE_CANNOT_EDIT_MULTILINE")} ${runtimeContext.getActionHotkeyString(runtimeContext.ACTION_REARRANGE)}`,
          7e3
        );
        return;
      }
      const didToggle = runtimeContext.revealInputEl();
      setTimeout(
        () => {
          runtimeContext.inputEl.value = text;
          const incomingArrow = all.find(
            (a) => a.type === "arrow" && a.customData?.isBranch && a.endBinding?.elementId === sel.id
          );
          runtimeContext.ontologyEl.value = runtimeContext.ea.getBoundTextElement(incomingArrow, true)?.sceneElement?.rawText || "";
          runtimeContext.editingNodeId = sel.id;
          runtimeContext.updateUI();
          runtimeContext.inputEl.focus();
        },
        didToggle ? 200 : 0
      );
    };
    const commitEdit = async () => {
      if (!runtimeContext.editingNodeId) return;
      const all = runtimeContext.ea.getViewElements();
      let targetNode = all.find((el) => el.id === runtimeContext.editingNodeId);
      if (!targetNode) return;
      const visualNode = targetNode.containerId ? all.find((el) => el.id === targetNode.containerId) : targetNode;
      let textElId = targetNode.id;
      if (targetNode.boundElements) {
        const boundText = targetNode.boundElements.find((be) => be.type === "text");
        if (boundText) textElId = boundText.id;
      }
      const textEl = all.find((el) => el.id === textElId && el.type === "text");
      const textInput = runtimeContext.inputEl.value;
      const ontologyInput = runtimeContext.ontologyEl.value;
      const currentText = runtimeContext.getTextFromNode(all, visualNode, true, true);
      const incomingArrow = all.find(
        (a) => a.type === "arrow" && a.customData?.isBranch && a.endBinding?.elementId === targetNode.id
        // Target node might be container
      );
      const currentOntology = incomingArrow ? runtimeContext.ea.getBoundTextElement(incomingArrow, true)?.sceneElement?.rawText || "" : "";
      const textChanged = textInput !== currentText;
      const ontologyChanged = ontologyInput !== currentOntology;
      if (!textChanged && !ontologyChanged) {
        runtimeContext.editingNodeId = null;
        runtimeContext.inputEl.value = "";
        runtimeContext.ontologyEl.value = "";
        runtimeContext.updateUI();
        return;
      }
      const imageInfo = runtimeContext.parseImageInput(textInput);
      const embeddableUrl = runtimeContext.parseEmbeddableInput(textInput, imageInfo);
      let newType = "text";
      if (imageInfo?.isImagePath || imageInfo?.imageFile) newType = "image";
      else if (embeddableUrl) newType = "embeddable";
      const isTypeChange = textEl && newType !== "text" || !textEl && newType !== targetNode.type;
      const isNonTextUpdate = !textEl && newType === targetNode.type && textChanged;
      let containerToUpdate = null;
      if (isTypeChange || isNonTextUpdate) {
        const cx = visualNode.x + visualNode.width / 2;
        const cy = visualNode.y + visualNode.height / 2;
        const info = runtimeContext.getHierarchy(visualNode, all);
        const depth = info.depth;
        let newNodeId;
        const st = runtimeContext.getAppState();
        runtimeContext.ea.style.strokeColor = targetNode.strokeColor ?? st.currentItemStrokeColor;
        if (newType === "image") {
          if (imageInfo?.isImagePath) {
            newNodeId = await runtimeContext.addImage({
              pathOrFile: imageInfo.path,
              width: imageInfo.width,
              depth
            });
            if (imageInfo.isExternalImage && newNodeId) {
              const el2 = runtimeContext.ea.getElement(newNodeId);
              if (el2 && !el2.link) el2.link = imageInfo.path;
            }
          } else {
            newNodeId = await runtimeContext.addImage({
              pathOrFile: imageInfo.imageFile,
              width: imageInfo.width,
              depth
            });
          }
          const el = runtimeContext.ea.getElement(newNodeId);
          el.x = cx - el.width / 2;
          el.y = cy - el.height / 2;
        } else if (newType === "embeddable") {
          newNodeId = runtimeContext.addEmbeddableNode({
            url: embeddableUrl,
            depth
          });
          const el = runtimeContext.ea.getElement(newNodeId);
          el.x = cx - el.width / 2;
          el.y = cy - el.height / 2;
        } else {
          if (runtimeContext.ea.style.strokeColor === "transparent")
            runtimeContext.ea.style.strokeColor = "black";
          runtimeContext.ea.style.fontFamily = st.currentItemFontFamily;
          const fontScale = runtimeContext.getFontScale(runtimeContext.fontsizeScale);
          runtimeContext.ea.style.fontSize = fontScale[Math.min(depth, fontScale.length - 1)];
          runtimeContext.ea.style.backgroundColor = "transparent";
          runtimeContext.ea.style.strokeWidth = runtimeContext.getStrokeWidthForDepth(depth);
          if (incomingArrow) {
            runtimeContext.ea.style.strokeColor = incomingArrow.strokeColor;
          }
          runtimeContext.ea.style.roughness = runtimeContext.getAppState().currentItemRoughness;
          const renderedText = await runtimeContext.parseText(textInput);
          const metrics = runtimeContext.ea.measureText(renderedText);
          const shouldWrap = metrics.width > runtimeContext.maxWidth;
          let finalWidth = Math.ceil(metrics.width);
          let finalHeight = metrics.height;
          let finalWrappedText = renderedText;
          if (shouldWrap) {
            const res = await runtimeContext.getAdjustedMaxWidth(textInput, runtimeContext.maxWidth);
            finalWidth = res.width;
            finalHeight = res.height;
            finalWrappedText = res.wrappedText;
          }
          newNodeId = runtimeContext.ea.addText(cx, cy, renderedText, {
            textAlign: "center",
            textVerticalAlign: "middle",
            box: runtimeContext.boxChildren ? "rectangle" : false,
            width: shouldWrap ? finalWidth : void 0,
            height: shouldWrap ? finalHeight : void 0,
            autoResize: runtimeContext.boxChildren ? false : !shouldWrap
          });
          const newElement = runtimeContext.ea.getElement(newNodeId);
          containerToUpdate = runtimeContext.boxChildren ? newElement : null;
          newTextElement = runtimeContext.boxChildren ? runtimeContext.ea.getElement(containerToUpdate.boundElements[0].id) : newElement;
          newTextElement.rawText = textInput;
          newTextElement.originalText = renderedText;
          newTextElement.text = finalWrappedText;
          if (!shouldWrap) {
            newTextElement.width = finalWidth;
            newTextElement.height = finalHeight;
          }
        }
        const newNode = runtimeContext.ea.getElement(newNodeId);
        runtimeContext.scaleDecorations(visualNode, newNode, all, info.rootId);
        const keysToCopy = [
          "mindmapOrder",
          "isPinned",
          "growthMode",
          "autoLayoutDisabled",
          "isFolded",
          "foldIndicatorId",
          "foldState",
          "boundaryId",
          "fontsizeScale",
          "multicolor",
          "boxChildren",
          "roundedCorners",
          "maxWrapWidth",
          "isSolidArrow",
          "centerText",
          "arrowType",
          "fillSweep",
          "branchScale",
          "baseStrokeWidth",
          "layoutSettings"
        ];
        const dataToCopy = {};
        keysToCopy.forEach((k) => {
          if (visualNode.customData && visualNode.customData.hasOwnProperty(k)) {
            dataToCopy[k] = visualNode.customData[k];
          }
        });
        runtimeContext.ea.addAppendUpdateCustomData(newNodeId, dataToCopy);
        if (visualNode.groupIds && visualNode.groupIds.length > 0) {
          newNode.groupIds = [...visualNode.groupIds];
        }
        const idsToReplace = [visualNode.id];
        if (textEl) idsToReplace.push(textEl.id);
        const connectedArrows = all.filter(
          (el) => el.type === "arrow" && (idsToReplace.includes(el.startBinding?.elementId) || idsToReplace.includes(el.endBinding?.elementId))
        );
        if (connectedArrows.length > 0) {
          runtimeContext.ea.copyViewElementsToEAforEditing(connectedArrows);
          const newBoundElements = [];
          connectedArrows.forEach((arrow) => {
            const eaArrow = runtimeContext.ea.getElement(arrow.id);
            let isConnected = false;
            const ratioX = visualNode.width > 1 ? newNode.width / visualNode.width : 1;
            const ratioY = visualNode.height > 1 ? newNode.height / visualNode.height : 1;
            if (idsToReplace.includes(eaArrow.startBinding?.elementId)) {
              eaArrow.startBinding = {
                ...eaArrow.startBinding,
                elementId: newNodeId
              };
              isConnected = true;
              if (eaArrow.points.length > 0) {
                const absX = arrow.x + arrow.points[0][0];
                const absY = arrow.y + arrow.points[0][1];
                const dx = absX - cx;
                const dy = absY - cy;
                const newAbsX = cx + dx * ratioX;
                const newAbsY = cy + dy * ratioY;
                eaArrow.points[0] = [
                  eaArrow.points[0][0] + (newAbsX - absX),
                  eaArrow.points[0][1] + (newAbsY - absY)
                ];
              }
            }
            if (idsToReplace.includes(eaArrow.endBinding?.elementId)) {
              eaArrow.endBinding = {
                ...eaArrow.endBinding,
                elementId: newNodeId
              };
              isConnected = true;
              runtimeContext.addUpdateArrowLabel(eaArrow, ontologyInput);
              if (eaArrow.points.length > 0) {
                const lastIdx = eaArrow.points.length - 1;
                const absX = arrow.x + arrow.points[lastIdx][0];
                const absY = arrow.y + arrow.points[lastIdx][1];
                const dx = absX - cx;
                const dy = absY - cy;
                const newAbsX = cx + dx * ratioX;
                const newAbsY = cy + dy * ratioY;
                eaArrow.points[lastIdx] = [
                  eaArrow.points[lastIdx][0] + (newAbsX - absX),
                  eaArrow.points[lastIdx][1] + (newAbsY - absY)
                ];
              }
            }
            if (isConnected) {
              newBoundElements.push({
                type: "arrow",
                id: arrow.id
              });
            }
          });
          if (newBoundElements.length > 0) {
            newNode.boundElements = [...newNode.boundElements || [], ...newBoundElements];
          }
        }
        runtimeContext.ea.copyViewElementsToEAforEditing([visualNode]);
        runtimeContext.ea.getElement(visualNode.id).isDeleted = true;
        if (textEl && textEl.id !== visualNode.id) {
          runtimeContext.ea.copyViewElementsToEAforEditing([textEl]);
          runtimeContext.ea.getElement(textEl.id).isDeleted = true;
        }
        await runtimeContext.addElementsToView({
          captureUpdate: runtimeContext.autoLayoutDisabled ? "IMMEDIATELY" : "EVENTUALLY"
        });
        if (!runtimeContext.autoLayoutDisabled) {
          const newViewElements = runtimeContext.ea.getViewElements();
          const newViewNode = newViewElements.find((el) => el.id === newNodeId);
          if (newViewNode) {
            runtimeContext.selectNodeInView(newViewNode);
            const newInfo = runtimeContext.getHierarchy(newViewNode, newViewElements);
            await runtimeContext.triggerGlobalLayout(newInfo.rootId, false, true);
          }
        }
      } else {
        if (ontologyChanged && incomingArrow) {
          runtimeContext.ea.copyViewElementsToEAforEditing([incomingArrow]);
          runtimeContext.addUpdateArrowLabel(
            runtimeContext.ea.getElement(incomingArrow.id),
            ontologyInput
          );
        }
        if (textChanged && textEl) {
          runtimeContext.ea.copyViewElementsToEAforEditing([textEl]);
          const eaEl = runtimeContext.ea.getElement(textEl.id);
          const renderedText = await runtimeContext.parseText(textInput);
          eaEl.rawText = textInput;
          eaEl.originalText = renderedText;
          runtimeContext.ea.style.fontFamily = eaEl.fontFamily;
          runtimeContext.ea.style.fontSize = eaEl.fontSize;
          const metrics = runtimeContext.ea.measureText(renderedText);
          const shouldWrap = metrics.width > runtimeContext.maxWidth;
          if (!shouldWrap) {
            eaEl.autoResize = true;
            eaEl.width = Math.ceil(metrics.width);
            eaEl.height = metrics.height;
            eaEl.text = renderedText;
          } else {
            eaEl.autoResize = false;
            const res = await runtimeContext.getAdjustedMaxWidth(textInput, runtimeContext.maxWidth);
            eaEl.width = res.width;
            eaEl.height = res.height;
            eaEl.text = res.wrappedText;
          }
          runtimeContext.ea.refreshTextElementSize(eaEl.id);
        }
        const hierarchyNode = targetNode.containerId ? all.find((el) => el.id === targetNode.containerId) : textEl;
        await runtimeContext.addElementsToView({
          captureUpdate: !hierarchyNode || runtimeContext.autoLayoutDisabled ? "IMMEDIATELY" : "EVENTUALLY"
        });
        if (textChanged && textEl && textEl.containerId) {
          const container = runtimeContext.ea.getViewElements().find((el) => el.id === textEl.containerId);
          if (container) {
            runtimeContext.api().updateContainerSize([container]);
          }
        }
        if (containerToUpdate) {
          runtimeContext.api().updateContainerSize([containerToUpdate]);
        }
        if (textChanged && hierarchyNode && !runtimeContext.autoLayoutDisabled) {
          const info = runtimeContext.getHierarchy(
            hierarchyNode,
            runtimeContext.ea.getViewElements()
          );
          await runtimeContext.triggerGlobalLayout(info.rootId);
        }
      }
      runtimeContext.editingNodeId = null;
      runtimeContext.inputEl.value = "";
      runtimeContext.ontologyEl.value = "";
    };
    return { startEditing, commitEdit };
  }

  // src/scripts/mindmap-builder/helpUi.js
  function createHelpUi(runtimeContext) {
    const getInstructions = () => `
<br>

${runtimeContext.t("INSTRUCTIONS")}

<div class="ex-coffee-div"><a href="https://ko-fi.com/zsolt"><img src="https://storage.ko-fi.com/cdn/kofi6.png?v=6" border="0" alt="Buy Me a Coffee at ko-fi.com"  height=45></a></div>

<a href="https://www.youtube.com/watch?v=5G9QF-u9w0Q" target="_blank"><img src ="https://i.ytimg.com/vi/5G9QF-u9w0Q/maxresdefault.jpg" style="max-width:560px; width:100%"></a>
`;
    const renderHelp = (container) => {
      runtimeContext.helpContainer = container.createDiv();
      runtimeContext.detailsEl = runtimeContext.helpContainer.createEl("details");
      const summary = runtimeContext.detailsEl.createEl("summary", {
        attr: {
          style: "cursor: pointer;"
        }
      });
      summary.createSpan({
        text: runtimeContext.t("HELP_SUMMARY"),
        attr: {
          style: "font-weight: bold;"
        }
      });
      summary.createSpan({
        text: runtimeContext.VERSION,
        attr: {
          style: "float: right; color: var(--text-muted); font-size: 0.8em;"
        }
      });
      runtimeContext.ea.obsidian.MarkdownRenderer.render(
        app,
        getInstructions(),
        runtimeContext.detailsEl.createDiv(),
        "",
        runtimeContext.ea.plugin
      );
    };
    return { getInstructions, renderHelp };
  }

  // src/scripts/mindmap-builder/PaletteManagerModal.js
  function createPaletteManagerModal(runtimeContext) {
    class PaletteManagerModal extends runtimeContext.ea.FloatingModal {
      constructor(app2, settings, onUpdate) {
        super(app2);
        this.settings = JSON.parse(JSON.stringify(settings));
        this.onUpdate = onUpdate;
        this.editIndex = -1;
        this.tempColor = "#000000";
      }
      onOpen() {
        this.display();
      }
      display() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", {
          text: runtimeContext.t("MODAL_PALETTE_TITLE")
        });
        new runtimeContext.ea.obsidian.Setting(contentEl).setName(runtimeContext.t("LABEL_ENABLE_CUSTOM_PALETTE")).setDesc(runtimeContext.t("DESC_ENABLE_CUSTOM_PALETTE")).addToggle(
          (t) => t.setValue(this.settings.enabled).onChange((v) => {
            this.settings.enabled = v;
            this.save();
            this.display();
          })
        );
        if (this.settings.enabled) {
          new runtimeContext.ea.obsidian.Setting(contentEl).setName(runtimeContext.t("LABEL_RANDOMIZE_ORDER")).setDesc(runtimeContext.t("DESC_RANDOMIZE_ORDER")).addToggle(
            (t) => t.setValue(this.settings.random).onChange((v) => {
              this.settings.random = v;
              this.save();
            })
          );
          contentEl.createEl("hr");
          const listContainer = contentEl.createDiv();
          this.settings.colors.forEach((color, index) => {
            const row = new runtimeContext.ea.obsidian.Setting(listContainer);
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
            nameEl.createSpan({
              text: color
            });
            row.addExtraButton(
              (btn) => btn.setIcon("arrow-big-up").setTooltip(runtimeContext.t("TOOLTIP_MOVE_UP")).setDisabled(index === 0).onClick(() => {
                if (index === 0) return;
                [this.settings.colors[index - 1], this.settings.colors[index]] = [
                  this.settings.colors[index],
                  this.settings.colors[index - 1]
                ];
                this.save();
                this.display();
              })
            ).addExtraButton(
              (btn) => btn.setIcon("arrow-big-down").setTooltip(runtimeContext.t("TOOLTIP_MOVE_DOWN")).setDisabled(index === this.settings.colors.length - 1).onClick(() => {
                if (index === this.settings.colors.length - 1) return;
                [this.settings.colors[index + 1], this.settings.colors[index]] = [
                  this.settings.colors[index],
                  this.settings.colors[index + 1]
                ];
                this.save();
                this.display();
              })
            ).addExtraButton(
              (btn) => btn.setIcon("pencil").setTooltip(runtimeContext.t("TOOLTIP_EDIT_COLOR")).onClick(() => {
                this.editIndex = index;
                this.tempColor = color;
                this.display();
              })
            ).addExtraButton(
              (btn) => btn.setIcon("trash-2").setTooltip(runtimeContext.t("TOOLTIP_DELETE_COLOR")).onClick(() => {
                this.settings.colors.splice(index, 1);
                if (this.editIndex === index) this.editIndex = -1;
                this.save();
                this.display();
              })
            );
          });
          contentEl.createEl("hr");
          contentEl.createEl("h4", {
            text: this.editIndex === -1 ? runtimeContext.t("HEADING_ADD_NEW_COLOR") : runtimeContext.t("HEADING_EDIT_COLOR")
          });
          const getHex = (val) => {
            const cm = runtimeContext.ea.getCM(val);
            return cm ? cm.stringHEX({
              alpha: false
            }) : "#000000";
          };
          const updateEditorState = (val, textComp, pickerComp) => {
            this.tempColor = val;
            if (textComp) textComp.inputEl.value = val;
            if (pickerComp) pickerComp.setValue(getHex(val));
          };
          let textComponent, pickerComponent;
          new runtimeContext.ea.obsidian.Setting(contentEl).setName(runtimeContext.t("LABEL_SELECT_COLOR")).addText((text) => {
            textComponent = text;
            text.setValue(this.tempColor).onChange((value) => {
              this.tempColor = value;
              pickerComponent.setValue(getHex(value));
            });
          }).addColorPicker((picker) => {
            pickerComponent = picker;
            picker.setValue(getHex(this.tempColor)).onChange((value) => {
              this.tempColor = value;
              textComponent.setValue(value);
            });
          }).addButton(
            (btn) => btn.setIcon("swatch-book").setTooltip(runtimeContext.t("TOOLTIP_OPEN_PALETTE_PICKER")).onClick(async () => {
              const selected = await runtimeContext.ea.showColorPicker(
                btn.buttonEl,
                "elementStroke"
              );
              if (selected) {
                updateEditorState(selected, textComponent, pickerComponent);
              }
            })
          );
          const actionContainer = contentEl.createDiv();
          actionContainer.style.display = "flex";
          actionContainer.style.justifyContent = "flex-end";
          actionContainer.style.gap = "10px";
          actionContainer.style.marginTop = "10px";
          if (this.editIndex !== -1) {
            const cancelBtn = actionContainer.createEl("button", {
              text: runtimeContext.t("BUTTON_CANCEL_EDIT")
            });
            cancelBtn.onclick = () => {
              this.editIndex = -1;
              this.tempColor = "#000000";
              this.display();
            };
          }
          const saveBtn = actionContainer.createEl("button", {
            text: this.editIndex === -1 ? runtimeContext.t("BUTTON_ADD_COLOR") : runtimeContext.t("BUTTON_UPDATE_COLOR"),
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
    return { PaletteManagerModal };
  }

  // src/scripts/mindmap-builder/LayoutConfigModal.js
  function createLayoutConfigModal(runtimeContext) {
    class LayoutConfigModal extends runtimeContext.ea.FloatingModal {
      constructor(app2, currentSettings, onUpdate) {
        super(app2);
        this.settings = this.normalizeSettings(currentSettings);
        this.onUpdate = onUpdate;
        this.updateTimer = null;
        this.focusRefreshHandler = (evt) => this.handleFocusRefresh(evt);
        this.focusDoc = null;
      }
      normalizeSettings(settingsLike) {
        const normalized = {};
        Object.keys(runtimeContext.LAYOUT_METADATA).forEach((key) => {
          const meta = runtimeContext.LAYOUT_METADATA[key];
          const candidate = settingsLike?.[key];
          normalized[key] = typeof candidate === "number" && Number.isFinite(candidate) ? candidate : meta.def;
        });
        return normalized;
      }
      onOpen() {
        this.display({
          preserveSectionState: false
        });
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
        if (!runtimeContext.isViewSet()) {
          this.close();
          return;
        }
        if (!this.contentEl || !(this.contentEl.contains(evt.target) || this.modalEl.contains(evt.target)))
          return;
        const sel = runtimeContext.getMindmapNodeFromSelection();
        if (!sel) return;
        const allElements = runtimeContext.ea.getViewElements();
        const settingsRoot = runtimeContext.getSettingsRootNode(sel, allElements) ?? sel;
        const rootCfg = runtimeContext.getRootConfigForNode(settingsRoot);
        const nextSettings = this.normalizeSettings(rootCfg?.layoutSettings);
        if (!nextSettings) return;
        const currentSig = JSON.stringify(this.settings);
        const nextSig = JSON.stringify(nextSettings);
        if (currentSig === nextSig) return;
        this.settings = nextSettings;
        this.display({
          preserveSectionState: true
        });
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
        contentEl.createEl("h2", {
          text: runtimeContext.t("MODAL_LAYOUT_TITLE")
        });
        const container = contentEl.createDiv();
        container.addClass("layout-settings-container");
        container.style.maxHeight = "70vh";
        container.style.overflowY = "auto";
        container.style.paddingRight = "10px";
        const groupedKeys = {};
        Object.keys(runtimeContext.LAYOUT_METADATA).forEach((key) => {
          const section = runtimeContext.LAYOUT_METADATA[key].section;
          if (!groupedKeys[section]) groupedKeys[section] = [];
          groupedKeys[section].push(key);
        });
        const renderSection = (sectionKey, title) => {
          if (!groupedKeys[sectionKey]) return;
          const details = container.createEl("details", {
            attr: {
              "data-layout-section": sectionKey
            }
          });
          details.open = preserveSectionState ? previousSectionState[sectionKey] ?? false : false;
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
          groupedKeys[sectionKey].forEach((key) => {
            const meta = runtimeContext.LAYOUT_METADATA[key];
            const setting = new runtimeContext.ea.obsidian.Setting(content).setName(meta.name).setDesc(meta.desc);
            let valLabel;
            let resetButtonComp;
            const updateResetButton = (val) => {
              if (!resetButtonComp) return;
              const isModified = Math.abs(val - meta.def) > 1e-4;
              const el = resetButtonComp.extraSettingsEl;
              el.style.opacity = isModified ? "1" : "0";
              el.style.pointerEvents = isModified ? "auto" : "none";
              el.style.cursor = isModified ? "pointer" : "default";
              if (isModified) el.setAttribute("tabindex", "0");
              else el.setAttribute("tabindex", "-1");
            };
            setting.addSlider(
              (slider) => slider.setLimits(meta.min, meta.max, meta.step).setValue(this.settings[key] ?? meta.def).onChange((value) => {
                this.settings[key] = value;
                valLabel.setText(String(value.toFixed(meta.step < 1 ? 1 : 0)));
                updateResetButton(value);
                this.triggerUpdate();
              })
            );
            setting.settingEl.createDiv("", (el) => {
              valLabel = el;
              el.style.minWidth = "3em";
              el.style.textAlign = "right";
              el.innerText = String(this.settings[key].toFixed(meta.step < 1 ? 1 : 0));
            });
            setting.addExtraButton((btn) => {
              resetButtonComp = btn;
              btn.setIcon("rotate-ccw").setTooltip(runtimeContext.t("TOOLTIP_RESET_TO_DEFAULT")).onClick(() => {
                this.settings[key] = meta.def;
                this.triggerUpdate();
                this.display();
              });
              updateResetButton(this.settings[key]);
            });
          });
        };
        renderSection("SECTION_GENERAL", runtimeContext.t("SECTION_GENERAL"));
        renderSection("SECTION_RADIAL", runtimeContext.t("SECTION_RADIAL"));
        renderSection("SECTION_DIRECTIONAL", runtimeContext.t("SECTION_DIRECTIONAL"));
        renderSection("SECTION_VERTICAL", runtimeContext.t("SECTION_VERTICAL"));
        renderSection("SECTION_VISUALS", runtimeContext.t("SECTION_VISUALS"));
        renderSection("SECTION_MANUAL", runtimeContext.t("SECTION_MANUAL"));
        const footer = contentEl.createDiv();
        footer.style.marginTop = "20px";
        footer.style.display = "flex";
        footer.style.justifyContent = "space-between";
        new runtimeContext.ea.obsidian.Setting(footer).addButton(
          (btn) => btn.setButtonText(runtimeContext.t("LAYOUT_RESET")).setWarning().onClick(() => {
            Object.keys(runtimeContext.LAYOUT_METADATA).forEach((k) => {
              this.settings[k] = runtimeContext.LAYOUT_METADATA[k].def;
            });
            this.triggerUpdate();
            this.display();
          })
        ).addButton(
          (btn) => btn.setButtonText(runtimeContext.t("LAYOUT_SAVE")).setCta().onClick(() => {
            if (this.updateTimer) clearTimeout(this.updateTimer);
            this.onUpdate(this.settings);
            this.close();
          })
        );
        container.scrollTop = lastScrollPosition;
      }
    }
    return { LayoutConfigModal };
  }

  // src/scripts/mindmap-builder/inputControls.js
  function createInputControls(runtimeContext) {
    const renderInput = (container, isFloating = false) => {
      runtimeContext.linkSuggester?.close();
      runtimeContext.linkSuggester = null;
      runtimeContext.ignoreFocusChanges = true;
      setTimeout(() => {
        runtimeContext.ignoreFocusChanges = false;
        if (runtimeContext.lastFocusedInput) runtimeContext.lastFocusedInput.focus();
      }, 200);
      container.empty();
      runtimeContext.pinBtn = runtimeContext.submapRootBtn = runtimeContext.refreshBtn = runtimeContext.dockBtn = runtimeContext.inputEl = runtimeContext.ontologyEl = null;
      runtimeContext.foldBtnL0 = runtimeContext.foldBtnL1 = runtimeContext.foldBtnAll = null;
      runtimeContext.boundaryBtn = runtimeContext.panelExpandBtn = null;
      runtimeContext.floatingGroupBtn = runtimeContext.floatingBoxBtn = runtimeContext.floatingZoomBtn = null;
      runtimeContext.importOutlineBtn = runtimeContext.toggleCheckboxBtn = null;
      runtimeContext.calendarBtn = null;
      runtimeContext.inputRow = new runtimeContext.ea.obsidian.Setting(container);
      let secondaryButtonContainer = null;
      if (!isFloating) {
        runtimeContext.inputRow.settingEl.style.display = "block";
        runtimeContext.inputRow.controlEl.style.display = "block";
        runtimeContext.inputRow.controlEl.style.width = "100%";
        runtimeContext.inputRow.controlEl.style.marginTop = "8px";
      } else {
        container.style.width = "85vw";
        container.style.maxWidth = "calc((var(--icon-size) + 2 * var(--size-2-3)) * 18)";
        runtimeContext.inputRow.settingEl.style.border = "none";
        runtimeContext.inputRow.settingEl.style.padding = "0";
        runtimeContext.inputRow.infoEl.style.display = "none";
        secondaryButtonContainer = container.createDiv();
        secondaryButtonContainer.style.display = runtimeContext.isFloatingPanelExpanded ? "flex" : "none";
        secondaryButtonContainer.style.justifyContent = "flex-end";
        secondaryButtonContainer.style.flexWrap = "wrap";
        secondaryButtonContainer.style.gap = "0px";
        secondaryButtonContainer.style.marginTop = "6px";
      }
      runtimeContext.inputRow.controlEl.empty();
      const wrapper = runtimeContext.inputRow.controlEl.createDiv("mindmap-input-wrapper");
      runtimeContext.ontologyEl = wrapper.createEl("input", {
        type: "text",
        cls: "mindmap-input-ontology",
        placeholder: runtimeContext.t("ONTOLOGY_PLACEHOLDER")
      });
      runtimeContext.inputEl = wrapper.createEl("input", {
        type: "text",
        cls: "mindmap-input-main",
        placeholder: runtimeContext.t("INPUT_PLACEHOLDER")
      });
      runtimeContext.inputEl.addEventListener("input", () => runtimeContext.updateUI());
      runtimeContext.ontologyEl.addEventListener("input", () => runtimeContext.updateUI());
      const updateFocusState = (focusedElement) => {
        if (runtimeContext.ignoreFocusChanges) return;
        runtimeContext.isOntologyFocused = focusedElement === runtimeContext.ontologyEl;
        runtimeContext.lastFocusedInput = focusedElement;
        if (runtimeContext.isOntologyFocused) {
          runtimeContext.ontologyEl.addClass("is-focused");
          runtimeContext.inputEl.addClass("is-shrunk");
        } else {
          runtimeContext.ontologyEl.removeClass("is-focused");
          runtimeContext.inputEl.removeClass("is-shrunk");
        }
      };
      const onFocus = (el) => {
        if (runtimeContext.ignoreFocusChanges) return;
        updateFocusState(el);
        runtimeContext.registerObsidianHotkeyOverrides();
        runtimeContext.ensureNodeSelected();
        runtimeContext.updateUI();
      };
      if (runtimeContext.isOntologyFocused) {
        runtimeContext.ontologyEl.addClass("is-focused");
        runtimeContext.inputEl.addClass("is-shrunk");
        runtimeContext.lastFocusedInput = runtimeContext.ontologyEl;
      } else {
        runtimeContext.ontologyEl.removeClass("is-focused");
        runtimeContext.inputEl.removeClass("is-shrunk");
        runtimeContext.lastFocusedInput = runtimeContext.inputEl;
      }
      runtimeContext.ontologyEl.addEventListener("focus", () => onFocus(runtimeContext.ontologyEl));
      runtimeContext.inputEl.addEventListener("focus", () => onFocus(runtimeContext.inputEl));
      const onBlur = () => {
        if (runtimeContext.ignoreFocusChanges) return;
        runtimeContext.removeObsidianHotkeyOverrides();
        runtimeContext.saveSettings();
      };
      runtimeContext.ontologyEl.addEventListener("blur", onBlur);
      runtimeContext.inputEl.addEventListener("blur", onBlur);
      runtimeContext.linkSuggester = runtimeContext.ea.attachInlineLinkSuggester(
        runtimeContext.inputEl,
        runtimeContext.inputRow.settingEl
      );
      if (runtimeContext.linkSuggester) {
        runtimeContext.linkSuggester.modifyInput = (input) => input.replace(/\./g, " ");
      }
      const ariaHelp = [
        `${runtimeContext.getActionLabel(runtimeContext.ACTION_ADD)} (Enter)`,
        `${runtimeContext.getActionLabel(runtimeContext.ACTION_ADD_FOLLOW)} ${runtimeContext.getActionHotkeyString(runtimeContext.ACTION_ADD_FOLLOW)}`,
        `${runtimeContext.getActionLabel(runtimeContext.ACTION_ADD_FOLLOW_FOCUS)} ${runtimeContext.getActionHotkeyString(runtimeContext.ACTION_ADD_FOLLOW_FOCUS)}`,
        `${runtimeContext.getActionLabel(runtimeContext.ACTION_ADD_FOLLOW_ZOOM)} ${runtimeContext.getActionHotkeyString(runtimeContext.ACTION_ADD_FOLLOW_ZOOM)}`
      ].join("\n");
      runtimeContext.inputEl.ariaLabel = ariaHelp;
      let dockedButtonContainer;
      if (!isFloating) {
        dockedButtonContainer = runtimeContext.inputRow.controlEl.createDiv();
        dockedButtonContainer.style.display = "flex";
        dockedButtonContainer.style.justifyContent = "flex-end";
        dockedButtonContainer.style.flexWrap = "wrap";
        dockedButtonContainer.style.gap = "2px";
        dockedButtonContainer.style.marginTop = "6px";
      }
      const addButton = (cb, moveToSecondary = false) => {
        runtimeContext.inputRow.addExtraButton((btn) => {
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
        runtimeContext.editBtn = btn;
        btn.setIcon("pencil");
        btn.setTooltip(
          `${runtimeContext.t("TOOLTIP_EDIT_NODE")} ${runtimeContext.getActionHotkeyString(runtimeContext.ACTION_EDIT)}`
        );
        btn.extraSettingsEl.setAttr("action", runtimeContext.ACTION_EDIT);
        btn.onClick(() => runtimeContext.performAction(runtimeContext.ACTION_EDIT));
      }, false);
      addButton((btn) => {
        runtimeContext.pinBtn = btn;
        btn.setTooltip(
          `${runtimeContext.t("TOOLTIP_PIN_INIT")} ${runtimeContext.getActionHotkeyString(runtimeContext.ACTION_PIN)}`
        );
        btn.extraSettingsEl.setAttr("action", runtimeContext.ACTION_PIN);
        btn.onClick(() => runtimeContext.performAction(runtimeContext.ACTION_PIN));
      }, false);
      addButton((btn) => {
        runtimeContext.toggleCheckboxBtn = btn;
        btn.setIcon("square-check-big");
        btn.setTooltip(
          `${runtimeContext.t("TOOLTIP_TOGGLE_CHECKBOX")} ${runtimeContext.getActionHotkeyString(runtimeContext.ACTION_TOGGLE_CHECKBOX)}`
        );
        btn.extraSettingsEl.setAttr("action", runtimeContext.ACTION_TOGGLE_CHECKBOX);
        btn.onClick(() => runtimeContext.performAction(runtimeContext.ACTION_TOGGLE_CHECKBOX));
      }, true);
      addButton((btn) => {
        runtimeContext.calendarBtn = btn;
        btn.setIcon("calendar");
        btn.setTooltip(
          `${runtimeContext.t("TOOLTIP_CALENDAR")} ${runtimeContext.getActionHotkeyString(runtimeContext.ACTION_CALENDAR)}`
        );
        btn.extraSettingsEl.setAttr("action", runtimeContext.ACTION_CALENDAR);
        btn.onClick(() => runtimeContext.performAction(runtimeContext.ACTION_CALENDAR));
      }, true);
      addButton((btn) => {
        runtimeContext.toggleEmbedBtn = btn;
        btn.setIcon("file-sliders");
        btn.setTooltip(
          `${runtimeContext.t("TOOLTIP_TOGGLE_EMBED")} ${runtimeContext.getActionHotkeyString(runtimeContext.ACTION_TOGGLE_EMBED)}`
        );
        btn.extraSettingsEl.setAttr("action", runtimeContext.ACTION_TOGGLE_EMBED);
        btn.onClick(() => runtimeContext.performAction(runtimeContext.ACTION_TOGGLE_EMBED));
      }, true);
      runtimeContext.toggleFloatingExtras = null;
      if (isFloating) {
        runtimeContext.toggleFloatingExtras = () => {
          runtimeContext.isFloatingPanelExpanded = !runtimeContext.isFloatingPanelExpanded;
          runtimeContext.panelExpandBtn.setIcon(
            runtimeContext.isFloatingPanelExpanded ? "panel-bottom-open" : "panel-top-open"
          );
          if (secondaryButtonContainer) {
            secondaryButtonContainer.style.display = runtimeContext.isFloatingPanelExpanded ? "flex" : "none";
            if (runtimeContext.floatingInputModal && runtimeContext.floatingInputModal.modalEl) {
              runtimeContext.floatingInputModal.modalEl.style.maxHeight = runtimeContext.isFloatingPanelExpanded ? "unset" : runtimeContext.FLOAT_MODAL_MAX_HEIGHT;
            }
          }
        };
        addButton((btn) => {
          runtimeContext.panelExpandBtn = btn;
          btn.setIcon(
            runtimeContext.isFloatingPanelExpanded ? "panel-bottom-open" : "panel-top-open"
          );
          btn.setTooltip(runtimeContext.t("TOOLTIP_TOGGLE_FLOATING_EXTRAS"));
          btn.extraSettingsEl.setAttr("action", runtimeContext.ACTION_TOGGLE_FLOATING_EXTRAS);
          btn.onClick(
            () => runtimeContext.performAction(runtimeContext.ACTION_TOGGLE_FLOATING_EXTRAS)
          );
        }, false);
        addButton((btn) => {
          runtimeContext.floatingGroupBtn = btn;
          btn.setIcon("group");
          btn.extraSettingsEl.setAttr("action", runtimeContext.ACTION_TOGGLE_GROUP);
          btn.onClick(() => runtimeContext.performAction(runtimeContext.ACTION_TOGGLE_GROUP));
        }, true);
        addButton((btn) => {
          runtimeContext.floatingBoxBtn = btn;
          btn.setIcon("rectangle-horizontal");
          btn.setTooltip(
            `${runtimeContext.t("TOOLTIP_TOGGLE_BOX")} ${runtimeContext.getActionHotkeyString(runtimeContext.ACTION_BOX)}`
          );
          btn.extraSettingsEl.setAttr("action", runtimeContext.ACTION_BOX);
          btn.onClick(() => runtimeContext.performAction(runtimeContext.ACTION_BOX));
        }, true);
        addButton((btn) => {
          runtimeContext.floatingZoomBtn = btn;
          btn.setIcon("scan-search");
          btn.setTooltip(
            `${runtimeContext.t("TOOLTIP_ZOOM_CYCLE")} ${runtimeContext.getActionHotkeyString(runtimeContext.ACTION_ZOOM)}`
          );
          btn.extraSettingsEl.setAttr("action", runtimeContext.ACTION_ZOOM);
          btn.onClick(() => runtimeContext.performAction(runtimeContext.ACTION_ZOOM));
        }, true);
      }
      addButton((btn) => {
        runtimeContext.focusBtn = btn;
        btn.setIcon("scan-eye");
        btn.setTooltip(
          `${runtimeContext.t("ACTION_LABEL_FOCUS")} ${runtimeContext.getActionHotkeyString(runtimeContext.ACTION_FOCUS)}`
        );
        btn.extraSettingsEl.setAttr("action", runtimeContext.ACTION_FOCUS);
        btn.onClick(() => runtimeContext.performAction(runtimeContext.ACTION_FOCUS));
      }, true);
      addButton((btn) => {
        runtimeContext.boundaryBtn = btn;
        btn.setIcon("cloud");
        btn.setTooltip(
          `${runtimeContext.t("TOOLTIP_TOGGLE_BOUNDARY")} ${runtimeContext.getActionHotkeyString(runtimeContext.ACTION_TOGGLE_BOUNDARY)}`
        );
        btn.extraSettingsEl.setAttr("action", runtimeContext.ACTION_TOGGLE_BOUNDARY);
        btn.onClick(() => runtimeContext.performAction(runtimeContext.ACTION_TOGGLE_BOUNDARY));
      }, true);
      addButton((btn) => {
        runtimeContext.submapRootBtn = btn;
        btn.setIcon("map-pin-plus-inside");
        btn.extraSettingsEl.setAttr("action", runtimeContext.ACTION_TOGGLE_SUBMAP_ROOT);
        btn.onClick(() => runtimeContext.performAction(runtimeContext.ACTION_TOGGLE_SUBMAP_ROOT));
      }, true);
      addButton((btn) => {
        runtimeContext.foldBtnL0 = btn;
        btn.setIcon("wifi-low");
        btn.setTooltip(
          `${runtimeContext.t("TOOLTIP_FOLD_BRANCH")} ${runtimeContext.getActionHotkeyString(runtimeContext.ACTION_FOLD)}`
        );
        btn.extraSettingsEl.setAttr("action", runtimeContext.ACTION_FOLD);
        btn.onClick(() => runtimeContext.performAction(runtimeContext.ACTION_FOLD));
      }, true);
      addButton((btn) => {
        runtimeContext.foldBtnL1 = btn;
        btn.setIcon("wifi-high");
        btn.setTooltip(
          `${runtimeContext.t("TOOLTIP_FOLD_L1_BRANCH")} ${runtimeContext.getActionHotkeyString(runtimeContext.ACTION_FOLD_L1)}`
        );
        btn.extraSettingsEl.setAttr("action", runtimeContext.ACTION_FOLD_L1);
        btn.onClick(() => runtimeContext.performAction(runtimeContext.ACTION_FOLD_L1));
      }, true);
      addButton((btn) => {
        runtimeContext.foldBtnAll = btn;
        btn.setIcon("wifi");
        btn.setTooltip(
          `${runtimeContext.t("TOOLTIP_FOLD_ALL")} ${runtimeContext.getActionHotkeyString(runtimeContext.ACTION_FOLD_ALL)}`
        );
        btn.extraSettingsEl.setAttr("action", runtimeContext.ACTION_FOLD_ALL);
        btn.onClick(() => runtimeContext.performAction(runtimeContext.ACTION_FOLD_ALL));
      }, true);
      addButton((btn) => {
        runtimeContext.refreshBtn = btn;
        btn.setIcon("refresh-ccw");
        btn.setTooltip(
          `${runtimeContext.t("TOOLTIP_REFRESH")} ${runtimeContext.getActionHotkeyString(runtimeContext.ACTION_REARRANGE)}`
        );
        btn.extraSettingsEl.setAttr("action", runtimeContext.ACTION_REARRANGE);
        btn.onClick(() => runtimeContext.performAction(runtimeContext.ACTION_REARRANGE));
      }, true);
      addButton((btn) => {
        runtimeContext.copyBtn = btn;
        btn.setIcon("copy");
        btn.setTooltip(
          `${runtimeContext.t("ACTION_LABEL_COPY")} ${runtimeContext.getActionHotkeyString(runtimeContext.ACTION_COPY)}`
        );
        btn.extraSettingsEl.setAttr("action", runtimeContext.ACTION_COPY);
        btn.onClick(() => runtimeContext.performAction(runtimeContext.ACTION_COPY));
      }, true);
      addButton((btn) => {
        runtimeContext.cutBtn = btn;
        btn.setIcon("scissors");
        btn.setTooltip(
          `${runtimeContext.t("ACTION_LABEL_CUT")} ${runtimeContext.getActionHotkeyString(runtimeContext.ACTION_CUT)}`
        );
        btn.extraSettingsEl.setAttr("action", runtimeContext.ACTION_CUT);
        btn.onClick(() => runtimeContext.performAction(runtimeContext.ACTION_CUT));
      }, true);
      addButton((btn) => {
        btn.setIcon("clipboard");
        btn.setTooltip(
          `${runtimeContext.t("ACTION_LABEL_PASTE")} ${runtimeContext.getActionHotkeyString(runtimeContext.ACTION_PASTE)}`
        );
        btn.extraSettingsEl.setAttr("action", runtimeContext.ACTION_PASTE);
        btn.onClick(() => runtimeContext.performAction(runtimeContext.ACTION_PASTE));
      }, true);
      addButton((btn) => {
        runtimeContext.importOutlineBtn = btn;
        btn.setIcon("list-tree");
        btn.setTooltip(
          `${runtimeContext.t("TOOLTIP_IMPORT_OUTLINE")} ${runtimeContext.getActionHotkeyString(runtimeContext.ACTION_IMPORT_OUTLINE)}`
        );
        btn.extraSettingsEl.setAttr("action", runtimeContext.ACTION_IMPORT_OUTLINE);
        btn.onClick(() => runtimeContext.performAction(runtimeContext.ACTION_IMPORT_OUTLINE));
      }, true);
      addButton((btn) => {
        runtimeContext.dockBtn = btn;
        btn.setIcon(isFloating ? "dock" : "external-link");
        btn.extraSettingsEl.setAttr("action", runtimeContext.ACTION_DOCK_UNDOCK);
        btn.setTooltip(
          `${isFloating ? runtimeContext.t("TOOLTIP_DOCK") : runtimeContext.t("TOOLTIP_UNDOCK")} ${runtimeContext.getActionHotkeyString(runtimeContext.ACTION_DOCK_UNDOCK)}`
        );
        btn.onClick(() => runtimeContext.performAction(runtimeContext.ACTION_DOCK_UNDOCK));
      }, true);
      runtimeContext.updateUI();
    };
    return { renderInput };
  }

  // src/scripts/mindmap-builder/HotkeyRecorder.ts
  var HotkeyRecorder = class {
    constructor(keymap, createScope) {
      this.keymap = keymap;
      this.createScope = createScope;
    }
    keymap;
    createScope;
    finish = null;
    /** Starts one recording, releasing the previous session before pushing a new scope. */
    start(onKey, onFinish) {
      this.cancel();
      const scope = this.createScope();
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        if (this.finish === finish) this.finish = null;
        try {
          this.keymap.popScope(scope);
        } finally {
          onFinish();
        }
      };
      this.finish = finish;
      try {
        scope.register(null, null, (event) => {
          if (finished) return void 0;
          if (["Control", "Shift", "Alt", "Meta"].includes(event.key)) return false;
          try {
            onKey(event);
          } finally {
            finish();
          }
          return false;
        });
        this.keymap.pushScope(scope);
      } catch (error) {
        finish();
        throw error;
      }
    }
    /** Idempotently releases the recording scope from its original window's stack. */
    cancel() {
      this.finish?.();
    }
  };

  // src/scripts/mindmap-builder/sidepanelControls.js
  function createSidepanelControls(runtimeContext) {
    const hotkeyRecorder = new HotkeyRecorder(
      app.keymap,
      () => new runtimeContext.ea.obsidian.Scope()
    );
    runtimeContext.ea.registerCleanup?.(() => hotkeyRecorder.cancel());
    const renderBody = (contentEl) => {
      runtimeContext.bodyContainer = contentEl.createDiv();
      runtimeContext.bodyContainer.style.width = "100%";
      runtimeContext.bodyContainer.createEl("hr");
      const presetSetting = new runtimeContext.ea.obsidian.Setting(runtimeContext.bodyContainer).setName(runtimeContext.t("PRESET_LABEL")).addDropdown((d) => {
        runtimeContext.presetDropdown = d;
        runtimeContext.refreshPresetDropdown();
        d.onChange(async (v) => {
          runtimeContext.activePresetName = v;
          runtimeContext.setVal(runtimeContext.K_ACTIVE_PRESET, v);
          const sel = runtimeContext.getMindmapNodeFromSelection();
          if (sel) {
            await runtimeContext.applyPresetToMap(v, sel);
            new runtimeContext.Notice(runtimeContext.t("NOTICE_PRESET_APPLIED"));
          } else {
            runtimeContext.applyPresetToGlobals(v);
            runtimeContext.updateUI();
          }
        });
      });
      presetSetting.addExtraButton((btn) => {
        runtimeContext.presetSaveBtn = btn;
        btn.setIcon("save").setTooltip(runtimeContext.t("PRESET_BTN_SAVE")).onClick(async () => {
          if (!runtimeContext.activePresetName) return;
          runtimeContext.mapPresets[runtimeContext.activePresetName] = runtimeContext.extractConfigFromGlobals();
          runtimeContext.setVal(runtimeContext.K_PRESETS, runtimeContext.mapPresets, true);
          new runtimeContext.Notice(runtimeContext.t("NOTICE_PRESET_SAVED"));
          runtimeContext.updateUI();
        });
      });
      presetSetting.addExtraButton((btn) => {
        runtimeContext.presetTrashBtn = btn;
        btn.setIcon("trash-2").setTooltip(runtimeContext.t("PRESET_BTN_DELETE")).onClick(async () => {
          if (!runtimeContext.activePresetName || runtimeContext.activePresetName === "Default")
            return;
          delete runtimeContext.mapPresets[runtimeContext.activePresetName];
          runtimeContext.activePresetName = "Default";
          runtimeContext.setVal(runtimeContext.K_PRESETS, runtimeContext.mapPresets, true);
          runtimeContext.setVal(runtimeContext.K_ACTIVE_PRESET, runtimeContext.activePresetName);
          new runtimeContext.Notice(runtimeContext.t("NOTICE_PRESET_DELETED"));
          runtimeContext.refreshPresetDropdown();
          runtimeContext.updateUI();
        });
      });
      presetSetting.addExtraButton((btn) => {
        runtimeContext.presetPlusBtn = btn;
        btn.setIcon("plus").setTooltip(runtimeContext.t("PRESET_BTN_NEW")).onClick(async () => {
          const name = await runtimeContext.utils.inputPrompt(
            runtimeContext.t("PROMPT_NEW_PRESET_NAME")
          );
          if (name && name.trim()) {
            const trimmed = name.trim();
            runtimeContext.mapPresets[trimmed] = runtimeContext.extractConfigFromGlobals();
            runtimeContext.activePresetName = trimmed;
            runtimeContext.setVal(runtimeContext.K_PRESETS, runtimeContext.mapPresets, true);
            runtimeContext.setVal(runtimeContext.K_ACTIVE_PRESET, runtimeContext.activePresetName);
            runtimeContext.refreshPresetDropdown();
            const sel = runtimeContext.getMindmapNodeFromSelection();
            if (sel) {
              await runtimeContext.updateRootNodeCustomData(
                { presetName: runtimeContext.activePresetName },
                sel
              );
            }
            new runtimeContext.Notice(runtimeContext.t("NOTICE_PRESET_SAVED"));
            runtimeContext.updateUI();
          }
        });
      });
      presetSetting.addExtraButton((btn) => {
        runtimeContext.presetApplyBtn = btn;
        btn.setIcon("refresh-cw").setTooltip(runtimeContext.t("PRESET_BTN_APPLY")).onClick(async () => {
          const sel = runtimeContext.getMindmapNodeFromSelection();
          if (sel && runtimeContext.activePresetName) {
            await runtimeContext.applyPresetToMap(runtimeContext.activePresetName, sel);
            new runtimeContext.Notice(runtimeContext.t("NOTICE_PRESET_APPLIED"));
          }
        });
      });
      runtimeContext.presetWarningEl = runtimeContext.bodyContainer.createEl("div", {
        text: runtimeContext.t("PRESET_WARNING_MODIFIED"),
        cls: "mod-warning",
        attr: {
          style: "font-size: 0.85em; margin-top: -10px; margin-bottom: 10px; display: none; text-align: right;"
        }
      });
      runtimeContext.bodyContainer.createEl("hr");
      const zoomSetting = new runtimeContext.ea.obsidian.Setting(runtimeContext.bodyContainer);
      zoomSetting.setName(runtimeContext.t("LABEL_ZOOM_LEVEL")).addDropdown((d) => {
        runtimeContext.ZOOM_TYPES.forEach((key) => d.addOption(key, key));
        d.setValue(runtimeContext.zoomLevel);
        d.onChange((v) => {
          runtimeContext.zoomLevel = v;
          if (runtimeContext.disableTabEvents) return;
          runtimeContext.setVal(runtimeContext.K_ZOOM, v);
          runtimeContext.zoomToFit();
        });
      });
      zoomSetting.addExtraButton((btn) => {
        runtimeContext.zoomBtn = btn;
        btn.setIcon("scan-search").setTooltip(
          `${runtimeContext.t("TOOLTIP_ZOOM_CYCLE")} ${runtimeContext.getActionHotkeyString(runtimeContext.ACTION_ZOOM)}`
        ).onClick(() => runtimeContext.performAction(runtimeContext.ACTION_ZOOM));
      });
      new runtimeContext.ea.obsidian.Setting(runtimeContext.bodyContainer).setName(runtimeContext.t("LABEL_GROWTH_STRATEGY")).addDropdown((d) => {
        runtimeContext.strategyDropdown = d;
        runtimeContext.GROWTH_TYPES.forEach((key) => d.addOption(key, key));
        d.setValue(runtimeContext.currentModalGrowthMode);
        d.onChange(async (v) => {
          runtimeContext.currentModalGrowthMode = v;
          if (runtimeContext.disableTabEvents) return;
          runtimeContext.setVal(runtimeContext.K_GROWTH, v);
          if (runtimeContext.fillSweepToggleSetting) {
            runtimeContext.fillSweepToggleSetting.settingEl.style.display = v === "Radial" ? "" : "none";
          }
          if (!runtimeContext.isViewSet()) return;
          const sel = runtimeContext.getMindmapNodeFromSelection();
          if (!sel) return;
          await runtimeContext.updateRootNodeCustomData(
            {
              growthMode: v
            },
            sel
          );
          await runtimeContext.refreshMapLayout(sel);
        });
      });
      runtimeContext.fillSweepToggleSetting = new runtimeContext.ea.obsidian.Setting(
        runtimeContext.bodyContainer
      ).setName(runtimeContext.t("LABEL_FILL_SWEEP")).setDesc(runtimeContext.t("DESC_FILL_SWEEP")).addToggle((t) => {
        runtimeContext.fillSweepToggle = t;
        t.setValue(runtimeContext.fillSweep).onChange(async (v) => {
          runtimeContext.fillSweep = v;
          if (runtimeContext.disableTabEvents) return;
          runtimeContext.setVal(runtimeContext.K_FILL_SWEEP, v);
          if (!runtimeContext.isViewSet()) return;
          const sel = runtimeContext.getMindmapNodeFromSelection();
          if (!sel) return;
          await runtimeContext.updateRootNodeCustomData(
            {
              fillSweep: v
            },
            sel
          );
          await runtimeContext.refreshMapLayout(sel);
        });
      });
      if (runtimeContext.currentModalGrowthMode !== "Radial") {
        runtimeContext.fillSweepToggleSetting.settingEl.style.display = "none";
      }
      new runtimeContext.ea.obsidian.Setting(runtimeContext.bodyContainer).setName(runtimeContext.t("LABEL_AUTO_LAYOUT")).addToggle((t) => {
        runtimeContext.autoLayoutToggle = t;
        t.setValue(!runtimeContext.autoLayoutDisabled).onChange(async (v) => {
          const sel = runtimeContext.getMindmapNodeFromSelection();
          if (!sel) return;
          runtimeContext.autoLayoutDisabled = !v;
          if (runtimeContext.disableTabEvents) return;
          await runtimeContext.updateRootNodeCustomData(
            {
              autoLayoutDisabled: runtimeContext.autoLayoutDisabled
            },
            sel
          );
          await runtimeContext.refreshMapLayout(sel);
        });
      }).addExtraButton(
        (btn) => btn.setIcon("pencil-ruler").setTooltip(runtimeContext.t("TOOLTIP_CONFIGURE_LAYOUT")).onClick(() => {
          const modal = new runtimeContext.LayoutConfigModal(
            app,
            runtimeContext.layoutSettings,
            async (newSettings) => {
              runtimeContext.layoutSettings = newSettings;
              runtimeContext.setVal(runtimeContext.K_LAYOUT, runtimeContext.layoutSettings, true);
              const sel = runtimeContext.getMindmapNodeFromSelection();
              if (!sel) return;
              await runtimeContext.updateRootNodeCustomData(
                {
                  layoutSettings: newSettings
                },
                sel
              );
              const allElements = runtimeContext.ea.getViewElements();
              const hierarchy = runtimeContext.getHierarchy(sel, allElements);
              const masterRoot = allElements.find((el) => el.id === hierarchy.rootId) ?? sel;
              await runtimeContext.refreshMapLayout(masterRoot);
            }
          );
          modal.open();
        })
      );
      new runtimeContext.ea.obsidian.Setting(runtimeContext.bodyContainer).setName(runtimeContext.t("LABEL_GROUP_BRANCHES")).addToggle(
        (t) => t.setValue(runtimeContext.groupBranches).onChange(async (v) => {
          if (!runtimeContext.isViewSet()) return;
          runtimeContext.groupBranches = v;
          if (runtimeContext.disableTabEvents) return;
          runtimeContext.setVal(runtimeContext.K_GROUP, v);
          await runtimeContext.refreshMapLayout();
          runtimeContext.updateUI();
        })
      ).addExtraButton((btn) => {
        runtimeContext.toggleGroupBtn = btn;
        btn.setIcon("group");
        btn.setTooltip(
          `${runtimeContext.t("TOOLTIP_TOGGLE_GROUP_BTN")} ${runtimeContext.getActionHotkeyString(runtimeContext.ACTION_TOGGLE_GROUP)}`
        );
        btn.onClick(() => runtimeContext.performAction(runtimeContext.ACTION_TOGGLE_GROUP));
      });
      runtimeContext.bodyContainer.createEl("hr");
      new runtimeContext.ea.obsidian.Setting(runtimeContext.bodyContainer).setName(runtimeContext.t("LABEL_BOX_CHILD_NODES")).addToggle((t) => {
        runtimeContext.boxToggle = t;
        t.setValue(runtimeContext.boxChildren).onChange(async (v) => {
          runtimeContext.boxChildren = v;
          if (runtimeContext.disableTabEvents) return;
          runtimeContext.setVal(runtimeContext.K_BOX, v);
          await runtimeContext.updateRootNodeCustomData({
            boxChildren: v
          });
        });
      }).addExtraButton((btn) => {
        runtimeContext.boxBtn = btn;
        btn.setIcon("rectangle-horizontal");
        btn.setTooltip(
          `${runtimeContext.t("TOOLTIP_TOGGLE_BOX")} ${runtimeContext.getActionHotkeyString(runtimeContext.ACTION_BOX)}`
        );
        btn.onClick(() => runtimeContext.performAction(runtimeContext.ACTION_BOX));
      });
      new runtimeContext.ea.obsidian.Setting(runtimeContext.bodyContainer).setName(runtimeContext.t("LABEL_ROUNDED_CORNERS")).addToggle((t) => {
        runtimeContext.roundToggle = t;
        t.setValue(runtimeContext.roundedCorners).onChange(async (v) => {
          runtimeContext.roundedCorners = v;
          if (runtimeContext.disableTabEvents) return;
          runtimeContext.setVal(runtimeContext.K_ROUND, v);
          await runtimeContext.updateRootNodeCustomData({
            roundedCorners: v
          });
        });
      });
      runtimeContext.bodyContainer.createEl("hr");
      new runtimeContext.ea.obsidian.Setting(runtimeContext.bodyContainer).setName(runtimeContext.t("LABEL_ARROW_TYPE")).addToggle((t) => {
        runtimeContext.arrowTypeToggle = t;
        t.setValue(runtimeContext.arrowType === "curved").onChange(async (v) => {
          runtimeContext.arrowType = v ? "curved" : "straight";
          if (runtimeContext.disableTabEvents) return;
          runtimeContext.setVal(runtimeContext.K_ARROW_TYPE, runtimeContext.arrowType);
          if (!runtimeContext.isViewSet()) return;
          const sel = runtimeContext.getMindmapNodeFromSelection();
          if (!sel) return;
          await runtimeContext.updateRootNodeCustomData(
            {
              arrowType: runtimeContext.arrowType
            },
            sel
          );
          await runtimeContext.refreshMapLayout(sel);
        });
      });
      new runtimeContext.ea.obsidian.Setting(runtimeContext.bodyContainer).setName(runtimeContext.t("LABEL_USE_SCENE_STROKE")).setDesc(runtimeContext.t("DESC_USE_SCENE_STROKE")).addToggle((t) => {
        runtimeContext.strokeToggle = t;
        t.setValue(!runtimeContext.isSolidArrow).onChange(async (v) => {
          runtimeContext.isSolidArrow = !v;
          if (runtimeContext.disableTabEvents) return;
          runtimeContext.setVal(runtimeContext.K_ARROWSTROKE, !v);
          await runtimeContext.updateRootNodeCustomData({
            isSolidArrow: !v
          });
        });
      });
      new runtimeContext.ea.obsidian.Setting(runtimeContext.bodyContainer).setName(runtimeContext.t("LABEL_BRANCH_SCALE")).addDropdown((d) => {
        runtimeContext.branchScaleDropdown = d;
        runtimeContext.BRANCH_SCALE_TYPES.forEach((key) => d.addOption(key, key));
        d.setValue(runtimeContext.branchScale);
        d.onChange(async (v) => {
          const oldScale = runtimeContext.branchScale;
          runtimeContext.branchScale = v;
          if (runtimeContext.disableTabEvents) return;
          runtimeContext.setVal(runtimeContext.K_BRANCH_SCALE, v);
          const info = await runtimeContext.updateRootNodeCustomData({
            branchScale: v
          });
          if (info) {
            await runtimeContext.updateBranchStrokes(
              info.rootId,
              runtimeContext.baseStrokeWidth,
              oldScale,
              runtimeContext.baseStrokeWidth,
              runtimeContext.branchScale
            );
          }
        });
      });
      let baseWidthDisplay;
      let baseWidthUpdateTimer = null;
      let baseWidthSnapshot = null;
      const baseWidthSetting = new runtimeContext.ea.obsidian.Setting(runtimeContext.bodyContainer).setName(runtimeContext.t("LABEL_BASE_WIDTH")).addSlider((s) => {
        runtimeContext.baseWidthSlider = s;
        s.setLimits(0.2, 16, 0.1).setValue(runtimeContext.baseStrokeWidth).onChange((v) => {
          if (baseWidthUpdateTimer) clearTimeout(baseWidthUpdateTimer);
          if (!runtimeContext.disableTabEvents && baseWidthSnapshot === null)
            baseWidthSnapshot = runtimeContext.baseStrokeWidth;
          runtimeContext.baseStrokeWidth = v;
          baseWidthDisplay.setText(`${v}`);
          if (runtimeContext.disableTabEvents) return;
          runtimeContext.setVal(runtimeContext.K_BASE_WIDTH, v);
          baseWidthUpdateTimer = setTimeout(async () => {
            const info = await runtimeContext.updateRootNodeCustomData({
              baseStrokeWidth: v
            });
            if (info) {
              await runtimeContext.updateBranchStrokes(
                info.rootId,
                baseWidthSnapshot,
                runtimeContext.branchScale,
                runtimeContext.baseStrokeWidth,
                runtimeContext.branchScale
              );
            }
            baseWidthSnapshot = null;
            baseWidthUpdateTimer = null;
          }, 500);
        });
      });
      baseWidthDisplay = baseWidthSetting.descEl.createSpan({
        text: `${runtimeContext.baseStrokeWidth}`,
        attr: {
          style: "margin-left:10px; font-weight:bold;"
        }
      });
      if (runtimeContext.baseWidthSlider)
        runtimeContext.baseWidthSlider.valLabelEl = baseWidthDisplay;
      new runtimeContext.ea.obsidian.Setting(runtimeContext.bodyContainer).setName(runtimeContext.t("LABEL_MULTICOLOR_BRANCHES")).addToggle((t) => {
        runtimeContext.colorToggle = t;
        t.setValue(runtimeContext.multicolor).onChange(async (v) => {
          runtimeContext.multicolor = v;
          if (runtimeContext.disableTabEvents) return;
          runtimeContext.setVal(runtimeContext.K_MULTICOLOR, v);
          await runtimeContext.updateRootNodeCustomData({
            multicolor: v
          });
        });
      }).addExtraButton(
        (btn) => btn.setIcon("palette").setTooltip(runtimeContext.t("TOOLTIP_CONFIGURE_PALETTE")).onClick(() => {
          const modal = new runtimeContext.PaletteManagerModal(
            app,
            runtimeContext.customPalette,
            (newSettings) => {
              runtimeContext.customPalette = newSettings;
              runtimeContext.setVal(runtimeContext.K_PALETTE, runtimeContext.customPalette, true);
            }
          );
          modal.open();
        })
      );
      runtimeContext.bodyContainer.createEl("hr");
      let sliderValDisplay;
      const sliderSetting = new runtimeContext.ea.obsidian.Setting(runtimeContext.bodyContainer).setName(runtimeContext.t("LABEL_MAX_WRAP_WIDTH")).addSlider((s) => {
        runtimeContext.widthSlider = s;
        s.setLimits(
          runtimeContext.WRAP_WIDTH_MIN,
          runtimeContext.WRAP_WIDTH_MAX,
          runtimeContext.WRAP_WIDTH_STEP
        ).setValue(runtimeContext.maxWidth).onChange(async (v) => {
          runtimeContext.maxWidth = v;
          sliderValDisplay.setText(`${v}px`);
          if (runtimeContext.disableTabEvents) return;
          runtimeContext.setVal(runtimeContext.K_WIDTH, v);
          await runtimeContext.updateRootNodeCustomData({
            maxWrapWidth: v
          });
        });
      });
      sliderValDisplay = sliderSetting.descEl.createSpan({
        text: `${runtimeContext.maxWidth}px`,
        attr: {
          style: "margin-left:10px; font-weight:bold;"
        }
      });
      if (runtimeContext.widthSlider) runtimeContext.widthSlider.valLabelEl = sliderValDisplay;
      new runtimeContext.ea.obsidian.Setting(runtimeContext.bodyContainer).setName(runtimeContext.t("LABEL_CENTER_TEXT")).setDesc(runtimeContext.t("DESC_CENTER_TEXT")).addToggle((t) => {
        runtimeContext.centerToggle = t;
        t.setValue(runtimeContext.centerText).onChange(async (v) => {
          runtimeContext.centerText = v;
          if (runtimeContext.disableTabEvents) return;
          runtimeContext.setVal(runtimeContext.K_CENTERTEXT, v);
          await runtimeContext.updateRootNodeCustomData({
            centerText: v
          });
        });
      });
      new runtimeContext.ea.obsidian.Setting(runtimeContext.bodyContainer).setName(runtimeContext.t("LABEL_FONT_SIZES")).addDropdown((d) => {
        runtimeContext.fontSizeDropdown = d;
        runtimeContext.FONT_SCALE_TYPES.forEach((key) => d.addOption(key, key));
        d.setValue(runtimeContext.fontsizeScale);
        d.onChange(async (v) => {
          runtimeContext.fontsizeScale = v;
          if (runtimeContext.disableTabEvents) return;
          runtimeContext.setVal(runtimeContext.K_FONTSIZE, v);
          await runtimeContext.updateRootNodeCustomData({
            fontsizeScale: v
          });
        });
      });
      runtimeContext.bodyContainer.createEl("hr");
      const hkDetails = runtimeContext.bodyContainer.createEl("details", {
        attr: {
          style: "margin-right: 5px; margin-left: 5px;"
        }
      });
      hkDetails.createEl("summary", {
        text: runtimeContext.t("HOTKEY_SECTION_TITLE"),
        attr: {
          style: "cursor: pointer; font-weight: bold;"
        }
      });
      const hkContainer = hkDetails.createDiv();
      const hint = hkContainer.createEl("p", {
        text: runtimeContext.t("HOTKEY_HINT"),
        attr: {
          style: "color: var(--text-muted); font-size: 0.85em; margin-bottom: 10px;"
        }
      });
      const refreshHotkeys = () => {
        runtimeContext.RUNTIME_HOTKEYS = runtimeContext.generateRuntimeHotkeys();
        runtimeContext.registerObsidianHotkeyOverrides();
        runtimeContext.updateKeyHandlerLocation();
      };
      const saveHotkeys = () => {
        const hotkeysToSave = runtimeContext.userHotkeys.map((h) => {
          const { isInputOnly, requiresNode, isNavigation, hidden, ...configurableProps } = h;
          return configurableProps;
        });
        runtimeContext.setVal(runtimeContext.K_HOTKEYS, hotkeysToSave, true);
        refreshHotkeys();
      };
      const isModified = (current) => {
        const def = runtimeContext.DEFAULT_HOTKEYS.find((d) => d.action === current.action);
        if (!def) return false;
        const k1 = current.code || current.key;
        const k2 = def.code || def.key;
        if (k1 !== k2) return true;
        if (current.modifiers.length !== def.modifiers.length) return true;
        return !current.modifiers.every((m) => def.modifiers.includes(m));
      };
      const recordHotkey = (btn, hIndex, onUpdate) => {
        hotkeyRecorder.cancel();
        const originalText = btn.innerHTML;
        const label = btn.parentElement.querySelector(".setting-hotkey");
        btn.innerHTML = runtimeContext.t("RECORD_HOTKEY_PROMPT");
        btn.addClass("is-recording");
        runtimeContext.isRecordingHotkey = true;
        const cancel = () => hotkeyRecorder.cancel();
        const cleanup = () => {
          btn.innerHTML = originalText;
          btn.removeClass("is-recording");
          if (runtimeContext.cancelHotkeyRecording === cancel) {
            runtimeContext.isRecordingHotkey = false;
            runtimeContext.cancelHotkeyRecording = null;
          }
        };
        runtimeContext.cancelHotkeyRecording = cancel;
        const handler = (e) => {
          if (e.key === "Escape") {
            return false;
          }
          if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return false;
          const mods = [];
          if (e.ctrlKey) mods.push("Ctrl");
          if (e.metaKey) mods.push("Meta");
          if (e.altKey) mods.push("Alt");
          if (e.shiftKey) mods.push("Shift");
          let key = e.key;
          let code = e.code;
          if (key === " ") key = "Space";
          const targetConfig = runtimeContext.userHotkeys[hIndex];
          const isNav = targetConfig.isNavigation;
          if (isNav && !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) {
            new runtimeContext.Notice(runtimeContext.t("NOTICE_ACTION_REQUIRES_ARROWS"));
            return false;
          }
          const conflict = runtimeContext.userHotkeys.find((h, i) => {
            if (i === hIndex) return false;
            const sameMods = h.modifiers.length === mods.length && h.modifiers.every((m) => mods.includes(m));
            if (!sameMods) return false;
            if (h.isNavigation && isNav) return true;
            if (h.isNavigation && key.startsWith("Arrow")) return true;
            const hKey = h.code ? h.code.replace("Key", "").replace("Digit", "") : h.key;
            const eKey = code ? code.replace("Key", "").replace("Digit", "") : key;
            return hKey.toLowerCase() === eKey.toLowerCase();
          });
          if (conflict) {
            label.style.color = "var(--text-error)";
            new runtimeContext.Notice(
              runtimeContext.t("NOTICE_CONFLICT_WITH_ACTION", {
                action: runtimeContext.getActionLabel(conflict.action)
              }),
              runtimeContext.NOTICE_DURATION_CONFLICT
            );
            setTimeout(() => label.style.color = "", 4e3);
          } else {
            if (isNav) {
              targetConfig.modifiers = mods.map((m) => m === "Ctrl" || m === "Meta" ? "Mod" : m);
            } else {
              targetConfig.modifiers = mods.map((m) => m === "Ctrl" || m === "Meta" ? "Mod" : m);
              if (code && (code.startsWith("Key") || code.startsWith("Digit"))) {
                targetConfig.code = code;
                delete targetConfig.key;
              } else {
                targetConfig.key = key;
                delete targetConfig.code;
              }
            }
            saveHotkeys();
            if (targetConfig.scope === runtimeContext.SCOPE.global) {
              const obsConflict = runtimeContext.getObsidianConflict(targetConfig);
              if (obsConflict) {
                new runtimeContext.Notice(
                  runtimeContext.t("NOTICE_OBSIDIAN_HOTKEY_CONFLICT", {
                    command: obsConflict
                  }),
                  runtimeContext.NOTICE_DURATION_GLOBAL_CONFLICT
                );
              }
            }
            if (onUpdate) onUpdate();
          }
          return false;
        };
        hotkeyRecorder.start(handler, cleanup);
      };
      runtimeContext.userHotkeys.forEach((h, index) => {
        if (h.hidden) return;
        const setting = new runtimeContext.ea.obsidian.Setting(hkContainer).setName(
          runtimeContext.getActionLabel(h.action)
        );
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
          span.textContent = runtimeContext.getHotkeyDisplayString(runtimeContext.userHotkeys[index]);
          restoreBtn.style.display = isModified(runtimeContext.userHotkeys[index]) ? "" : "none";
          if (updateScopeUI) updateScopeUI();
          const existingAlert = hotkeyDisplay.querySelector(".hotkey-conflict-icon");
          if (existingAlert) existingAlert.remove();
          span.removeClass("has-conflict");
          span.style.color = "";
          if (runtimeContext.userHotkeys[index].scope === runtimeContext.SCOPE.global) {
            const conflict = runtimeContext.getObsidianConflict(runtimeContext.userHotkeys[index]);
            if (conflict) {
              span.addClass("has-conflict");
              const alert = hotkeyDisplay.createSpan("hotkey-conflict-icon");
              alert.innerHTML = runtimeContext.ea.obsidian.getIcon("octagon-alert").outerHTML;
              alert.style.color = "var(--text-error)";
              alert.style.marginRight = "calc(-1 * var(--size-2-2))";
              alert.style.display = "inline-flex";
              alert.style.cursor = "pointer";
              alert.ariaLabel = runtimeContext.t("ARIA_OVERRIDE_COMMAND", {
                command: conflict
              });
              alert.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                new runtimeContext.Notice(
                  runtimeContext.t("NOTICE_GLOBAL_HOTKEY_CONFLICT", {
                    command: conflict
                  }),
                  runtimeContext.NOTICE_DURATION_GLOBAL_CONFLICT
                );
              };
            }
          }
        };
        if (!h.isInputOnly) {
          scopeBtn = controlDiv.createSpan("clickable-icon setting-global-hotkey-button");
          scopeBtn.style.marginRight = "calc(-1 * var(--size-2-2))";
          updateScopeUI = () => {
            const scope = runtimeContext.userHotkeys[index].scope;
            switch (scope) {
              case runtimeContext.SCOPE.input:
                scopeBtn.innerHTML = runtimeContext.ea.obsidian.getIcon("keyboard").outerHTML;
                scopeBtn.ariaLabel = runtimeContext.t("ARIA_SCOPE_INPUT");
                scopeBtn.style.color = "var(--text-muted)";
                break;
              case runtimeContext.SCOPE.excalidraw:
                scopeBtn.innerHTML = runtimeContext.ea.obsidian.getIcon("excalidraw-icon").outerHTML;
                scopeBtn.ariaLabel = runtimeContext.t("ARIA_SCOPE_EXCALIDRAW");
                scopeBtn.style.color = "var(--interactive-accent)";
                break;
              case runtimeContext.SCOPE.global:
                scopeBtn.innerHTML = runtimeContext.ea.obsidian.getIcon("globe").outerHTML;
                scopeBtn.ariaLabel = runtimeContext.t("ARIA_SCOPE_GLOBAL");
                scopeBtn.style.color = "var(--text-error)";
                break;
            }
          };
          scopeBtn.onclick = () => {
            const current = runtimeContext.userHotkeys[index].scope;
            let next = runtimeContext.SCOPE.input;
            if (current === runtimeContext.SCOPE.input) next = runtimeContext.SCOPE.excalidraw;
            else if (current === runtimeContext.SCOPE.excalidraw) next = runtimeContext.SCOPE.global;
            else if (current === runtimeContext.SCOPE.global) next = runtimeContext.SCOPE.input;
            runtimeContext.userHotkeys[index].scope = next;
            saveHotkeys();
            if (next === runtimeContext.SCOPE.global) {
              const conflict = runtimeContext.getObsidianConflict(runtimeContext.userHotkeys[index]);
              if (conflict) {
                new runtimeContext.Notice(
                  runtimeContext.t("NOTICE_GLOBAL_HOTKEY_CONFLICT", {
                    command: conflict
                  }),
                  runtimeContext.NOTICE_DURATION_GLOBAL_CONFLICT
                );
              }
            }
            updateRowUI();
          };
          updateScopeUI();
        }
        restoreBtn.innerHTML = runtimeContext.ea.obsidian.getIcon("rotate-ccw").outerHTML;
        restoreBtn.ariaLabel = runtimeContext.t("ARIA_RESTORE_DEFAULT");
        restoreBtn.onclick = () => {
          const def = runtimeContext.DEFAULT_HOTKEYS.find(
            (d) => d.action === runtimeContext.userHotkeys[index].action
          );
          if (def) {
            runtimeContext.userHotkeys[index] = JSON.parse(JSON.stringify(def));
            saveHotkeys();
            updateRowUI();
          }
        };
        updateRowUI();
        const addBtn = controlDiv.createSpan("clickable-icon setting-add-hotkey-button");
        addBtn.innerHTML = runtimeContext.ea.obsidian.getIcon("plus-circle").outerHTML;
        if (h.key === "Escape") {
          addBtn.style.opacity = 0;
          return;
        }
        addBtn.ariaLabel = runtimeContext.t("ARIA_CUSTOMIZE_HOTKEY");
        addBtn.onclick = () => recordHotkey(addBtn, index, updateRowUI);
      });
      runtimeContext.bodyContainer.createDiv({
        attr: {
          style: "height: 40px;"
        }
      });
    };
    return { renderBody };
  }

  // src/scripts/mindmap-builder/styles.js
  function createStyles(runtimeContext) {
    const registerStyles = () => {
      const existing = document.getElementById(runtimeContext.MINDMAP_FOCUS_STYLE_ID);
      if (existing) existing.remove();
      const styleEl = document.createElement("style");
      styleEl.id = runtimeContext.MINDMAP_FOCUS_STYLE_ID;
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
        "}",
        ...runtimeContext.ea.DEVICE.isDesktop ? [".excalidraw-mindmap-ui hr {margin: 5px;}"] : [".excalidraw-mindmap-ui hr {margin: 15px 5px;}"],
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
        // Drag Handle Styles
        ".excalidraw-mindmap-ui .mindmap-drag-handle {",
        "  position: absolute;",
        "  right: 0;",
        "  top: 0;",
        "  bottom: 0;",
        "  width: 20px;",
        "  cursor: grab;",
        "  display: flex;",
        "  align-items: center;",
        "  justify-content: center;",
        "  opacity: 0.4;",
        "  color: var(--text-muted);",
        "  transition: opacity 0.2s ease, color 0.2s ease;",
        "  background: var(--background-secondary);",
        "  border-left: 1px solid var(--background-modifier-border);",
        "  border-top-right-radius: 6px;",
        "  border-bottom-right-radius: 6px;",
        "}",
        ".excalidraw-mindmap-ui:focus-within .mindmap-drag-handle,",
        ".excalidraw-mindmap-ui .mindmap-drag-handle:hover,",
        ".excalidraw-mindmap-ui .mindmap-drag-handle:active {",
        "  opacity: 1;",
        "  color: var(--text-normal);",
        "}",
        ".excalidraw-mindmap-ui.is-dragging .mindmap-drag-handle {",
        "  cursor: grabbing;",
        "}"
      ].join("\n");
      document.head.appendChild(styleEl);
    };
    const removeStyles = () => {
      const styleEl = document.getElementById(runtimeContext.MINDMAP_FOCUS_STYLE_ID);
      if (styleEl) styleEl.remove();
    };
    return { registerStyles, removeStyles };
  }

  // src/scripts/mindmap-builder/floatingInput.js
  function createFloatingInput(runtimeContext) {
    const toggleDock = async ({ silent = false, forceDock = false, saveSetting = false } = {}) => {
      runtimeContext.editingNodeId = null;
      if (!runtimeContext.ea.targetView && !(forceDock && runtimeContext.isUndocked)) return;
      if (!silent) {
        const isSidepanelVisible = runtimeContext.ea.getSidepanelLeaf().isVisible();
        if (runtimeContext.isUndocked && !isSidepanelVisible) {
          const leaf = runtimeContext.ea.getSidepanelLeaf();
          if (leaf) app.workspace.revealLeaf(leaf);
        } else if (isSidepanelVisible && !runtimeContext.isUndocked) {
          runtimeContext.ea.toggleSidepanelView();
        }
        if (runtimeContext.isUndocked) {
          app.workspace.setActiveLeaf(runtimeContext.ea.getSidepanelLeaf(), {
            focus: true
          });
        } else {
          app.workspace.setActiveLeaf(runtimeContext.ea.targetView.leaf, {
            focus: true
          });
        }
      }
      runtimeContext.isUndocked = !runtimeContext.isUndocked;
      if (saveSetting) {
        runtimeContext.setVal(runtimeContext.K_UNDOCKED, runtimeContext.isUndocked);
      }
      runtimeContext.updateKeyHandlerLocation();
      if (runtimeContext.isUndocked) {
        runtimeContext.floatingInputModal = new runtimeContext.ea.FloatingModal(
          runtimeContext.ea.plugin.app
        );
        const { contentEl, titleEl, modalEl, headerEl, bgEl } = runtimeContext.floatingInputModal;
        modalEl.classList.add("excalidraw-mindmap-ui");
        if (bgEl) {
          bgEl.style.display = "none";
        }
        runtimeContext.floatingInputModal.onOpen = () => {
          if (runtimeContext.ea.targetView && modalEl.ownerDocument !== runtimeContext.ea.targetView.ownerDocument) {
            runtimeContext.ea.targetView.ownerDocument.body.appendChild(modalEl);
          }
          const { x, y } = runtimeContext.ea.targetView.contentEl.getBoundingClientRect();
          contentEl.empty();
          const closeEl = modalEl.querySelector(".modal-close-button");
          if (closeEl) closeEl.style.display = "none";
          titleEl.style.display = "none";
          headerEl.style.display = "none";
          modalEl.style.opacity = `${runtimeContext.FLOAT_MODAL_OPACITY}`;
          modalEl.style.padding = "6px";
          modalEl.style.paddingRight = "26px";
          modalEl.style.minHeight = "0px";
          modalEl.style.width = "fit-content";
          modalEl.style.height = "auto";
          modalEl.style.maxHeight = runtimeContext.FLOAT_MODAL_MAX_HEIGHT;
          if (runtimeContext.isExcaliBrainView()) {
            modalEl.style.display = "none";
          }
          const container = runtimeContext.floatingInputModal.contentEl.createDiv();
          runtimeContext.renderInput(container, true);
          const dragHandle = modalEl.createDiv("mindmap-drag-handle");
          dragHandle.innerHTML = runtimeContext.ea.obsidian.getIcon("grip-vertical").outerHTML;
          let isDragging = false;
          let startX, startY, initialLeft, initialTop;
          dragHandle.addEventListener("pointerdown", (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = modalEl.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;
            dragHandle.setPointerCapture(e.pointerId);
            modalEl.classList.add("is-dragging");
            e.preventDefault();
          });
          dragHandle.addEventListener("pointermove", (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            modalEl.style.left = `${initialLeft + dx}px`;
            modalEl.style.top = `${initialTop + dy}px`;
          });
          dragHandle.addEventListener("pointerup", (e) => {
            isDragging = false;
            dragHandle.releasePointerCapture(e.pointerId);
            modalEl.classList.remove("is-dragging");
          });
          dragHandle.addEventListener("dblclick", (e) => {
            const { x: x2, y: y2 } = runtimeContext.ea.targetView.contentEl.getBoundingClientRect();
            const desktopShift = !!runtimeContext.ea.targetView.contentEl.querySelector(
              ".App-bottom-bar .App-toolbar"
            ) ? 0 : runtimeContext.ea.targetView.contentEl.clientWidth < 1200 ? 36 : 0;
            modalEl.style.top = `${y2 + runtimeContext.FLOAT_MODAL_OFFSET + desktopShift}px`;
            modalEl.style.left = `${x2 + runtimeContext.FLOAT_MODAL_OFFSET}px`;
          });
          setTimeout(
            () => {
              const { x: x2, y: y2 } = runtimeContext.ea.targetView.contentEl.getBoundingClientRect();
              const desktopShift = !!runtimeContext.ea.targetView.contentEl.querySelector(
                ".App-bottom-bar .App-toolbar"
              ) ? 0 : runtimeContext.ea.targetView.contentEl.clientWidth < 1200 ? 36 : 0;
              modalEl.style.top = `${y2 + runtimeContext.FLOAT_MODAL_OFFSET + desktopShift}px`;
              modalEl.style.left = `${x2 + runtimeContext.FLOAT_MODAL_OFFSET}px`;
            },
            runtimeContext.ea.DEVICE.isMobile ? 400 : 150
          );
        };
        runtimeContext.floatingInputModal.onClose = () => {
          runtimeContext.removeObsidianHotkeyOverrides();
          runtimeContext.floatingInputModal = null;
          if (runtimeContext.isUndocked) {
            runtimeContext.isUndocked = false;
            runtimeContext.setVal(runtimeContext.K_UNDOCKED, false);
            runtimeContext.updateKeyHandlerLocation();
            if (runtimeContext.ea.sidepanelTab && runtimeContext.inputContainer)
              runtimeContext.renderInput(runtimeContext.inputContainer, false);
          }
        };
        runtimeContext.linkSuggester?.close();
        runtimeContext.inputContainer.empty();
        runtimeContext.floatingInputModal.open();
      } else {
        if (runtimeContext.floatingInputModal) {
          runtimeContext.linkSuggester?.close();
          if (runtimeContext.floatingInputModal.modalEl && runtimeContext.floatingInputModal.modalEl.parentElement) {
            runtimeContext.floatingInputModal.modalEl.remove();
          }
          runtimeContext.floatingInputModal.close();
          runtimeContext.floatingInputModal = null;
        }
        runtimeContext.renderInput(runtimeContext.inputContainer, false);
        if (forceDock) return;
        if (!silent) {
          runtimeContext.focusInputEl();
        }
      }
    };
    return { toggleDock };
  }

  // src/scripts/mindmap-builder/tasks.js
  function createTasks(runtimeContext) {
    const getTasksUiOptions = () => {
      const tasksPlugin = app.plugins.getPlugin("obsidian-tasks-plugin");
      const mode = tasksPlugin?.configuration?.taskFormat || "emoji";
      let dateFields = [];
      if (mode === "dataview") {
        dateFields = [
          "\u{1F4C5} [due:: ]",
          "\u{1F6EB} [start:: ]",
          "\u23F3 [scheduled:: ]",
          "\u2795 [created:: ]",
          "\u2705 [done:: ]",
          "\u274C [cancelled:: ]"
        ];
      } else {
        dateFields = ["\u{1F4C5} Due", "\u{1F6EB} Start", "\u23F3 Scheduled", "\u2795 Created", "\u2705 Done", "\u274C Cancelled"];
      }
      const priorities = ["\u{1F53A} Highest", "\u23EB High", "\u{1F53C} Medium", " Normal", "\u{1F53D} Low", "\u23EC Lowest"];
      return {
        mode,
        dateFields,
        priorities
      };
    };
    const parseTasksData = (text, mode) => {
      const priorityMap = {
        "\u{1F53A}": "highest",
        "\u23EB": "high",
        "\u{1F53C}": "medium",
        "\u{1F53D}": "low",
        "\u23EC": "lowest"
      };
      let priority = "normal";
      for (const [emoji, val] of Object.entries(priorityMap)) {
        if (text.includes(emoji)) {
          priority = val;
          break;
        }
      }
      let recurrence = "";
      let dates = [];
      if (mode === "dataview") {
        const recMatch = text.match(/\[recurrence:: ([^\]]+)\]/i);
        if (recMatch) recurrence = recMatch[1];
        const dateFields = ["due", "start", "scheduled", "created", "done", "cancelled"];
        for (const field of dateFields) {
          const regex = new RegExp(`\\[${field}:: (\\d{4}-\\d{2}-\\d{2})\\]`, "gi");
          let match;
          while ((match = regex.exec(text)) !== null) {
            dates.push({
              type: field,
              date: match[1]
            });
          }
        }
      } else {
        const recMatch = text.match(/🔁\s*([a-zA-Z0-9 ,]+)/i);
        if (recMatch) recurrence = recMatch[1].trim();
        const emojiFields = {
          "\u{1F4C5}": "due",
          "\u{1F6EB}": "start",
          "\u23F3": "scheduled",
          "\u2795": "created",
          "\u2705": "done",
          "\u274C": "cancelled"
        };
        for (const [emoji, field] of Object.entries(emojiFields)) {
          const regex = new RegExp(`${emoji}\\s*(\\d{4}-\\d{2}-\\d{2})`, "g");
          let match;
          while ((match = regex.exec(text)) !== null) {
            dates.push({
              type: field,
              date: match[1]
            });
          }
        }
      }
      return {
        priority,
        recurrence,
        dates
      };
    };
    const cleanTasksString = (text) => {
      let cleaned = text;
      cleaned = cleaned.replace(
        /\[(due|start|scheduled|created|done|cancelled|recurrence)::\s*[^\]]+\]/gi,
        ""
      );
      cleaned = cleaned.replace(/[📅🛫⏳➕✅❌]\s*\d{4}-\d{2}-\d{2}/g, "");
      cleaned = cleaned.replace(/🔁\s*[a-zA-Z0-9 ,]+/g, "");
      cleaned = cleaned.replace(/[🔺⏫🔼🔽⏬]/g, "");
      cleaned = cleaned.replace(/  +/g, " ").trim();
      return cleaned;
    };
    const openCalendarModal = async () => {
      let targetText = "";
      let isInputEl = false;
      let textElId = null;
      let sel = null;
      if (runtimeContext.inputEl && runtimeContext.inputEl.value.trim() !== "") {
        targetText = runtimeContext.inputEl.value;
        isInputEl = true;
      } else {
        sel = runtimeContext.getMindmapNodeFromSelection();
        if (!sel) return;
        const all = runtimeContext.ea.getViewElements();
        const info = runtimeContext.getHierarchy(sel, all);
        if (info.rootId === sel.id) return;
        textElId = sel.type === "text" ? sel.id : null;
        if (!textElId && sel.boundElements) {
          const boundText = sel.boundElements.find((be) => be.type === "text");
          if (boundText) textElId = boundText.id;
        }
        if (!textElId) return;
        const textEl = all.find((el) => el.id === textElId);
        if (!textEl) return;
        targetText = textEl.rawText;
      }
      const uiOpts = getTasksUiOptions();
      const parsed = parseTasksData(targetText, uiOpts.mode);
      let dates = parsed.dates.length > 0 ? parsed.dates : [
        {
          type: "due",
          date: window.moment().format("YYYY-MM-DD")
        }
      ];
      let activeDateIndex = 0;
      let priority = parsed.priority;
      let recurrence = parsed.recurrence;
      const modal = new runtimeContext.ea.obsidian.Modal(app);
      modal.titleEl.setText(runtimeContext.t("ACTION_LABEL_CALENDAR"));
      let dateInputComp, typeDropdownComp;
      const renderContent = () => {
        const { contentEl } = modal;
        contentEl.empty();
        const navRow = contentEl.createDiv({
          attr: {
            style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;"
          }
        });
        const leftNav = navRow.createDiv({
          attr: {
            style: "display: flex; align-items: center; gap: 10px;"
          }
        });
        const prevBtn = leftNav.createEl("button");
        prevBtn.innerHTML = runtimeContext.ea.obsidian.getIcon("chevron-left").outerHTML;
        prevBtn.disabled = activeDateIndex === 0;
        prevBtn.onclick = () => {
          activeDateIndex--;
          renderContent();
        };
        leftNav.createSpan({
          text: runtimeContext.t("CALENDAR_DATE_INDEX", {
            index: activeDateIndex + 1,
            total: dates.length
          })
        });
        const nextBtn = leftNav.createEl("button");
        nextBtn.innerHTML = runtimeContext.ea.obsidian.getIcon("chevron-right").outerHTML;
        nextBtn.onclick = () => {
          if (activeDateIndex === dates.length - 1) {
            dates.push({
              type: "due",
              date: window.moment().format("YYYY-MM-DD")
            });
          }
          activeDateIndex++;
          renderContent();
        };
        const delBtn = navRow.createEl("button");
        delBtn.innerHTML = runtimeContext.ea.obsidian.getIcon("trash-2").outerHTML;
        delBtn.disabled = dates.length === 1 && !dates[0].date;
        delBtn.onclick = () => {
          dates.splice(activeDateIndex, 1);
          if (dates.length === 0) {
            dates.push({
              type: "due",
              date: window.moment().format("YYYY-MM-DD")
            });
          }
          if (activeDateIndex >= dates.length) activeDateIndex = dates.length - 1;
          renderContent();
        };
        const activeDateObj = dates[activeDateIndex];
        new runtimeContext.ea.obsidian.Setting(contentEl).setName(runtimeContext.t("CALENDAR_DATE_LABEL")).addText((text) => {
          dateInputComp = text;
          text.inputEl.type = "date";
          text.setValue(activeDateObj.date);
          text.onChange((val) => {
            activeDateObj.date = val;
          });
          text.inputEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (typeDropdownComp && typeDropdownComp.selectEl) {
                typeDropdownComp.selectEl.focus();
              }
            }
          });
          text.inputEl.addEventListener("change", (e) => {
            if (document.activeElement === text.inputEl && typeDropdownComp && typeDropdownComp.selectEl) {
              typeDropdownComp.selectEl.focus();
            }
          });
        });
        new runtimeContext.ea.obsidian.Setting(contentEl).setName(runtimeContext.t("CALENDAR_DATE_TYPE")).addDropdown((dropdown) => {
          typeDropdownComp = dropdown;
          if (uiOpts.mode === "dataview") {
            dropdown.addOption("due", "\u{1F4C5} [due:: ]");
            dropdown.addOption("start", "\u{1F6EB} [start:: ]");
            dropdown.addOption("scheduled", "\u23F3 [scheduled:: ]");
            dropdown.addOption("created", "\u2795 [created:: ]");
            dropdown.addOption("done", "\u2705 [done:: ]");
            dropdown.addOption("cancelled", "\u274C [cancelled:: ]");
          } else {
            dropdown.addOption("due", `\u{1F4C5} ${runtimeContext.t("CALENDAR_DATETYPE_DUE")}`);
            dropdown.addOption("start", `\u{1F6EB} ${runtimeContext.t("CALENDAR_DATETYPE_START")}`);
            dropdown.addOption(
              "scheduled",
              `\u23F3 ${runtimeContext.t("CALENDAR_DATETYPE_SCHEDULED")}`
            );
            dropdown.addOption("created", `\u2795 ${runtimeContext.t("CALENDAR_DATETYPE_CREATED")}`);
            dropdown.addOption("done", `\u2705 ${runtimeContext.t("CALENDAR_DATETYPE_DONE")}`);
            dropdown.addOption(
              "cancelled",
              `\u274C ${runtimeContext.t("CALENDAR_DATETYPE_CANCELLED")}`
            );
          }
          dropdown.setValue(activeDateObj.type);
          dropdown.onChange((val) => {
            activeDateObj.type = val;
          });
        });
        new runtimeContext.ea.obsidian.Setting(contentEl).setName(runtimeContext.t("CALENDAR_PRIORITY")).addDropdown((dropdown) => {
          dropdown.addOption("highest", `\u{1F53A} ${runtimeContext.t("CALENDAR_PRIORITY_HIGHEST")}`);
          dropdown.addOption("high", `\u23EB ${runtimeContext.t("CALENDAR_PRIORITY_HIGH")}`);
          dropdown.addOption("medium", `\u{1F53C} ${runtimeContext.t("CALENDAR_PRIORITY_MEDIUM")}`);
          dropdown.addOption("normal", `  ${runtimeContext.t("CALENDAR_PRIORITY_NORMAL")}`);
          dropdown.addOption("low", `\u{1F53D} ${runtimeContext.t("CALENDAR_PRIORITY_LOW")}`);
          dropdown.addOption("lowest", `\u23EC ${runtimeContext.t("CALENDAR_PRIORITY_LOWEST")}`);
          dropdown.setValue(priority);
          dropdown.onChange((val) => {
            priority = val;
          });
        });
        const recSetting = new runtimeContext.ea.obsidian.Setting(contentEl).setName(runtimeContext.t("CALENDAR_RECURRENCE")).addText((text) => {
          text.setPlaceholder(runtimeContext.t("CALENDAR_RECURRENCE_PLACEHOLDER")).setValue(recurrence).onChange((val) => {
            recurrence = val;
          });
        });
        recSetting.descEl.innerHTML = runtimeContext.t("CALENDAR_RECURRENCE_DESC");
        const linkSettingsRow = new runtimeContext.ea.obsidian.Setting(contentEl).setName(runtimeContext.t("CALENDAR_INJECT_LINK")).setDesc(runtimeContext.t("CALENDAR_INJECT_LINK_DESC"));
        let aliasTextComp;
        linkSettingsRow.addToggle((toggle) => {
          toggle.setValue(runtimeContext.injectNodeLink).onChange((val) => {
            runtimeContext.injectNodeLink = val;
            runtimeContext.setVal(runtimeContext.K_INJECT_LINK, val);
            aliasTextComp.inputEl.style.display = val ? "" : "none";
          });
        });
        linkSettingsRow.addText((text) => {
          aliasTextComp = text;
          text.setPlaceholder(runtimeContext.t("CALENDAR_ALIAS_PLACEHOLDER")).setValue(runtimeContext.nodeLinkAlias).onChange((val) => {
            runtimeContext.nodeLinkAlias = val || "link";
            runtimeContext.setVal(runtimeContext.K_LINK_ALIAS, runtimeContext.nodeLinkAlias);
          });
          text.inputEl.style.display = runtimeContext.injectNodeLink ? "" : "none";
          text.inputEl.style.width = "100px";
          text.inputEl.style.marginLeft = "10px";
        });
        const btnContainer = contentEl.createDiv({
          attr: {
            style: "display: flex; gap: 10px; justify-content: flex-end; margin-top: 15px;"
          }
        });
        const cancelBtn = btnContainer.createEl("button", {
          text: runtimeContext.t("CALENDAR_BTN_CANCEL")
        });
        cancelBtn.onclick = () => modal.close();
        const taskOnlyBtn = btnContainer.createEl("button", {
          text: runtimeContext.t("CALENDAR_BTN_TASK_ONLY")
        });
        taskOnlyBtn.onclick = () => handleSave(false);
        const saveBtn = btnContainer.createEl("button", {
          text: runtimeContext.t("CALENDAR_BTN_ADD_DATE_TASK"),
          cls: "mod-cta"
        });
        saveBtn.onclick = () => handleSave(true);
        setTimeout(() => {
          if (dateInputComp && dateInputComp.inputEl) {
            dateInputComp.inputEl.focus();
            if (typeof dateInputComp.inputEl.showPicker === "function") {
              try {
                dateInputComp.inputEl.showPicker();
              } catch (e) {
              }
            }
          }
        }, 50);
      };
      const handleSave = async (includeDate = true) => {
        modal.close();
        let tasksString = "";
        if (includeDate) {
          const validDates = dates.filter((d) => d.date);
          if (uiOpts.mode === "dataview") {
            let priorityStr = "";
            const priorityMap = {
              highest: "\u{1F53A}",
              high: "\u23EB",
              medium: "\u{1F53C}",
              normal: "",
              low: "\u{1F53D}",
              lowest: "\u23EC"
            };
            if (priority !== "normal") priorityStr = priorityMap[priority];
            let dateStrs = validDates.map((d) => `[${d.type}:: ${d.date}]`);
            let recStr = recurrence ? `[recurrence:: ${recurrence}]` : "";
            const parts = [priorityStr, ...dateStrs, recStr].filter(Boolean);
            if (parts.length > 0) tasksString = " " + parts.join("  ");
          } else {
            let priorityStr = "";
            const priorityMap = {
              highest: " \u{1F53A}",
              high: " \u23EB",
              medium: " \u{1F53C}",
              normal: "",
              low: " \u{1F53D}",
              lowest: " \u23EC"
            };
            priorityStr = priorityMap[priority] || "";
            const emojiMap = {
              due: "\u{1F4C5}",
              start: "\u{1F6EB}",
              scheduled: "\u23F3",
              created: "\u2795",
              done: "\u2705",
              cancelled: "\u274C"
            };
            let dateStrs = validDates.map((d) => ` ${emojiMap[d.type]} ${d.date}`);
            let recStr = recurrence ? ` \u{1F501} ${recurrence}` : "";
            tasksString = `${priorityStr}${dateStrs.join("")}${recStr}`;
          }
        }
        const taskRegex = /^- \[([ xX])\] (.*)/s;
        const match = targetText.match(taskRegex);
        let cleanText = cleanTasksString(match ? match[2] : targetText);
        const linkRegex = /\s*\(\[\[[^\]]+#\^group=[a-zA-Z0-9_-]+\|[^\]]+\]\]\)$/;
        if (linkRegex.test(cleanText)) {
          cleanText = cleanText.replace(linkRegex, "");
        }
        let finalPrefix = match ? `- [${match[1]}] ` : "- [ ] ";
        let newText = `${finalPrefix}${cleanText}`;
        if (runtimeContext.injectNodeLink) {
          if (isInputEl) {
            newText += ` __NODE_LINK_PLACEHOLDER__`;
          } else {
            const file = app.workspace.getActiveFile();
            const fileName = file ? file.basename : "";
            newText += ` ([[${fileName}#^group=${textElId}|${runtimeContext.nodeLinkAlias}]])`;
          }
        }
        newText += tasksString;
        if (isInputEl) {
          runtimeContext.inputEl.value = newText;
          runtimeContext.updateUI();
        } else {
          const all = runtimeContext.ea.getViewElements();
          const textEl = all.find((el) => el.id === textElId);
          runtimeContext.ea.copyViewElementsToEAforEditing([textEl]);
          const eaEl = runtimeContext.ea.getElement(textEl.id);
          eaEl.rawText = newText;
          eaEl.text = newText;
          eaEl.originalText = newText;
          runtimeContext.ea.refreshTextElementSize(eaEl.id);
          await runtimeContext.addElementsToView({
            captureUpdate: runtimeContext.autoLayoutDisabled ? "IMMEDIATELY" : "EVENTUALLY"
          });
          if (eaEl.containerId) {
            const updatedContainer = runtimeContext.ea.getViewElements().find((el) => el.id === eaEl.containerId);
            if (updatedContainer) runtimeContext.api().updateContainerSize([updatedContainer]);
          }
          if (!runtimeContext.autoLayoutDisabled) {
            const info = runtimeContext.getHierarchy(sel, runtimeContext.ea.getViewElements());
            await runtimeContext.triggerGlobalLayout(info.rootId);
          }
          runtimeContext.updateUI();
        }
      };
      modal.onOpen = () => {
        renderContent();
        modal.modalEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            e.stopPropagation();
            handleSave(true);
          }
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            modal.close();
          }
        });
      };
      modal.open();
    };
    return { getTasksUiOptions, parseTasksData, cleanTasksString, openCalendarModal };
  }

  // src/scripts/mindmap-builder/branchHistory.ts
  async function undoPastedBranch(api, rootIds, waitForCommit) {
    const roots = new Set(rootIds);
    let steps = 0;
    while (!api.isDestroyed && api.getSceneElements().some((e) => roots.has(e.id)) && steps < 64) {
      api.history.undo();
      steps++;
      await waitForCommit();
    }
    return steps;
  }

  // src/scripts/mindmap-builder/actions.js
  function createActions(runtimeContext) {
    let historyBusy = false;
    const performAction = async (action, event) => {
      if (!action || !runtimeContext.ea.targetView || historyBusy) return;
      if (runtimeContext.isBranchPasteBusy?.()) return;
      switch (action) {
        case runtimeContext.ACTION_CALENDAR:
          await runtimeContext.openCalendarModal();
          break;
        case runtimeContext.ACTION_TOGGLE_FLOATING_EXTRAS:
          runtimeContext.toggleFloatingExtras?.();
          break;
        case runtimeContext.ACTION_REARRANGE:
          await runtimeContext.refreshMapLayout();
          break;
        case runtimeContext.ACTION_TOGGLE_GROUP:
          await runtimeContext.toggleBranchGroup();
          break;
        case runtimeContext.ACTION_HIDE:
          if (runtimeContext.editingNodeId) {
            runtimeContext.editingNodeId = null;
            runtimeContext.updateUI();
          } else if (runtimeContext.isUndocked) {
            runtimeContext.toggleDock({
              silent: true,
              forceDock: true,
              saveSetting: false
            });
          }
          break;
        case runtimeContext.ACTION_PIN:
          await runtimeContext.togglePin();
          break;
        case runtimeContext.ACTION_TOGGLE_CHECKBOX:
          await runtimeContext.toggleCheckboxStatus();
          runtimeContext.updateUI();
          break;
        case runtimeContext.ACTION_TOGGLE_EMBED:
          await runtimeContext.toggleEmbedStatus();
          runtimeContext.updateUI();
          break;
        case runtimeContext.ACTION_TOGGLE_SUBMAP_ROOT:
          await runtimeContext.toggleSubmapRoot();
          break;
        case runtimeContext.ACTION_BOX:
          await runtimeContext.toggleBox();
          break;
        case runtimeContext.ACTION_TOGGLE_BOUNDARY:
          await runtimeContext.toggleBoundary();
          break;
        case runtimeContext.ACTION_FOLD:
          await runtimeContext.toggleFold("L0");
          runtimeContext.updateUI();
          break;
        case runtimeContext.ACTION_FOLD_L1:
          await runtimeContext.toggleFold("L1");
          runtimeContext.updateUI();
          break;
        case runtimeContext.ACTION_FOLD_ALL:
          await runtimeContext.toggleFold("ALL");
          runtimeContext.updateUI();
          break;
        case runtimeContext.ACTION_COPY:
          runtimeContext.copyMapAsText(false);
          break;
        case runtimeContext.ACTION_CUT:
          runtimeContext.copyMapAsText(true);
          runtimeContext.updateUI();
          break;
        case runtimeContext.ACTION_PASTE:
          await runtimeContext.pasteElementToMap();
          runtimeContext.updateUI();
          break;
        case runtimeContext.ACTION_IMPORT_OUTLINE:
          await runtimeContext.importOutline();
          runtimeContext.updateUI();
          break;
        case runtimeContext.ACTION_ZOOM:
          runtimeContext.zoomToFit(true);
          break;
        case runtimeContext.ACTION_FOCUS:
          runtimeContext.focusSelected();
          break;
        case runtimeContext.ACTION_SORT_ORDER:
          runtimeContext.changeNodeOrder(event?.key);
          runtimeContext.updateUI();
          break;
        case runtimeContext.ACTION_NAVIGATE:
          await runtimeContext.navigateMap({
            key: event?.key,
            zoom: false,
            focus: false
          });
          runtimeContext.updateUI();
          break;
        case runtimeContext.ACTION_NAVIGATE_ZOOM:
          await runtimeContext.navigateMap({
            key: event?.key,
            zoom: true,
            focus: false
          });
          runtimeContext.updateUI();
          break;
        case runtimeContext.ACTION_NAVIGATE_FOCUS:
          await runtimeContext.navigateMap({
            key: event?.key,
            zoom: false,
            focus: true
          });
          runtimeContext.updateUI();
          break;
        case runtimeContext.ACTION_DOCK_UNDOCK:
          runtimeContext.toggleDock({
            saveSetting: true
          });
          break;
        case runtimeContext.ACTION_EDIT:
          runtimeContext.startEditing();
          break;
        case runtimeContext.ACTION_ADD_SIBLING_AFTER:
          runtimeContext.addSibling(event, true);
          break;
        case runtimeContext.ACTION_ADD_SIBLING_BEFORE:
          runtimeContext.addSibling(event, false);
          break;
        case runtimeContext.ACTION_ADD_FOLLOW:
        case runtimeContext.ACTION_ADD_FOLLOW_FOCUS:
        case runtimeContext.ACTION_ADD_FOLLOW_ZOOM:
          if (!runtimeContext.inputEl.value) return;
          await runtimeContext.addNode(
            runtimeContext.inputEl.value,
            true,
            false,
            null,
            null,
            null,
            runtimeContext.ontologyEl.value
          );
          runtimeContext.inputEl.value = "";
          runtimeContext.ontologyEl.value = "";
          runtimeContext.updateUI();
          if (action === runtimeContext.ACTION_ADD_FOLLOW_FOCUS) runtimeContext.focusSelected();
          if (action === runtimeContext.ACTION_ADD_FOLLOW_ZOOM) runtimeContext.zoomToFit();
          break;
        case runtimeContext.ACTION_ADD:
          const currentSel = runtimeContext.getMindmapNodeFromSelection() ?? runtimeContext.ea.getViewSelectedElement();
          if (runtimeContext.editingNodeId && currentSel && (currentSel.id === runtimeContext.editingNodeId || currentSel.containerId === runtimeContext.editingNodeId)) {
            await runtimeContext.commitEdit();
          } else {
            if (runtimeContext.editingNodeId) {
              runtimeContext.editingNodeId = null;
            }
            if (runtimeContext.inputEl.value) {
              await runtimeContext.addNode(
                runtimeContext.inputEl.value,
                false,
                false,
                null,
                null,
                null,
                runtimeContext.ontologyEl.value
              );
              runtimeContext.inputEl.value = "";
              runtimeContext.ontologyEl.value = "";
            } else {
              const sel = runtimeContext.getMindmapNodeFromSelection();
              const allElements = runtimeContext.ea.getViewElements();
              let handledRecent = false;
              if (runtimeContext.mostRecentlyAddedNodeID) {
                const mostRecentNode = runtimeContext.getMostRecentlyAddedNode();
                if (mostRecentNode && sel) {
                  const selParent = runtimeContext.getParentNode(sel.id, allElements);
                  const recentParent = runtimeContext.getParentNode(mostRecentNode.id, allElements);
                  const isSameOrSibling = sel.id === mostRecentNode.id || selParent && recentParent && selParent.id === recentParent.id;
                  if (!isSameOrSibling) {
                    runtimeContext.selectNodeInView(mostRecentNode);
                    handledRecent = true;
                  }
                } else {
                  runtimeContext.mostRecentlyAddedNodeID = null;
                }
              }
              if (!handledRecent && sel) {
                const parent = runtimeContext.getParentNode(sel.id, allElements);
                const siblings = parent ? runtimeContext.getChildrenNodes(parent.id, allElements) : [];
                if (siblings.length > 1) {
                  siblings.sort(
                    (a, b) => runtimeContext.getMindmapOrder(a) - runtimeContext.getMindmapOrder(b)
                  );
                  const idx = siblings.findIndex((s) => s.id === sel.id);
                  const nextIdx = (idx + 1) % siblings.length;
                  runtimeContext.selectNodeInView(siblings[nextIdx]);
                } else {
                  const children = runtimeContext.getChildrenNodes(sel.id, allElements);
                  if (children.length > 0) {
                    children.sort(
                      (a, b) => runtimeContext.getMindmapOrder(a) - runtimeContext.getMindmapOrder(b)
                    );
                    runtimeContext.selectNodeInView(children[0]);
                  } else if (parent) {
                    runtimeContext.selectNodeInView(parent);
                  }
                }
              }
            }
          }
          runtimeContext.updateUI();
          break;
        case runtimeContext.ACTION_UNDO:
          if (runtimeContext.ea.targetView) {
            const currentVer = ExcalidrawLib.getSceneVersion(runtimeContext.api().getSceneElements());
            const transaction = runtimeContext.lastCommittedTransaction;
            if (transaction?.branchPasteIds && currentVer === transaction.version) {
              const api = runtimeContext.api();
              let steps;
              historyBusy = true;
              try {
                steps = await undoPastedBranch(api, transaction.branchPasteIds, () => sleep(0));
              } finally {
                historyBusy = false;
              }
              if (api.isDestroyed || runtimeContext.api() !== api) {
                runtimeContext.redoAvailable = null;
                runtimeContext.lastCommittedTransaction = null;
                break;
              }
              runtimeContext.redoAvailable = {
                steps: Math.max(0, steps - 1),
                branchPasteIds: transaction.branchPasteIds,
                version: ExcalidrawLib.getSceneVersion(api.getSceneElements())
              };
              runtimeContext.lastCommittedTransaction = null;
              break;
            }
            if (runtimeContext.lastCommittedTransaction && currentVer === runtimeContext.lastCommittedTransaction.version && runtimeContext.lastCommittedTransaction.steps > 0) {
              for (let i = 0; i <= runtimeContext.lastCommittedTransaction.steps; i++) {
                runtimeContext.api().history.undo();
              }
              const afterUndoVer = ExcalidrawLib.getSceneVersion(
                runtimeContext.api().getSceneElements()
              );
              runtimeContext.redoAvailable = {
                steps: runtimeContext.lastCommittedTransaction.steps,
                version: afterUndoVer
              };
              runtimeContext.lastCommittedTransaction = null;
            } else {
              runtimeContext.api().history.undo();
              runtimeContext.lastCommittedTransaction = null;
              runtimeContext.redoAvailable = null;
            }
          }
          break;
        case runtimeContext.ACTION_REDO_Z:
        case runtimeContext.ACTION_REDO_Y:
          if (runtimeContext.ea.targetView) {
            const currentVer = ExcalidrawLib.getSceneVersion(runtimeContext.api().getSceneElements());
            if (runtimeContext.redoAvailable && currentVer === runtimeContext.redoAvailable.version && runtimeContext.redoAvailable.steps > 0) {
              const api = runtimeContext.api();
              historyBusy = !!runtimeContext.redoAvailable.branchPasteIds;
              try {
                for (let i = 0; i <= runtimeContext.redoAvailable.steps; i++) {
                  if (api.isDestroyed || runtimeContext.api() !== api) break;
                  api.history.redo();
                  if (runtimeContext.redoAvailable.branchPasteIds) await sleep(0);
                }
              } finally {
                historyBusy = false;
              }
              if (api.isDestroyed || runtimeContext.api() !== api) {
                runtimeContext.redoAvailable = null;
                runtimeContext.lastCommittedTransaction = null;
                break;
              }
              const afterRedoVer = ExcalidrawLib.getSceneVersion(
                runtimeContext.api().getSceneElements()
              );
              runtimeContext.lastCommittedTransaction = {
                steps: runtimeContext.redoAvailable.steps,
                version: afterRedoVer,
                ...runtimeContext.redoAvailable.branchPasteIds ? { branchPasteIds: runtimeContext.redoAvailable.branchPasteIds } : {}
              };
              runtimeContext.redoAvailable = null;
            } else {
              runtimeContext.api().history.redo();
              runtimeContext.lastCommittedTransaction = null;
              runtimeContext.redoAvailable = null;
            }
          }
          break;
      }
    };
    return { performAction };
  }

  // src/scripts/mindmap-builder/lifecycle.js
  function createLifecycle(runtimeContext) {
    const removeKeydownHandlers = () => {
      if (!window.MindmapBuilder) return;
      window.MindmapBuilder.keydownHandlers.forEach((f) => {
        try {
          f();
        } catch (e) {
          console.error("Mindmap Builder: Error removing keydown handler:", e);
        }
      });
      window.MindmapBuilder.keydownHandlers = [];
    };
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
    const handleCanvasPointerDown = (e) => {
      if (!runtimeContext.isViewSet()) return;
      if (runtimeContext.floatingInputModal && runtimeContext.floatingInputModal.modalEl.contains(e.target))
        return;
      if (runtimeContext.uiUpdateTimer) {
        clearTimeout(runtimeContext.uiUpdateTimer);
      }
      runtimeContext.uiUpdateTimer = setTimeout(() => {
        if (!runtimeContext.isViewSet()) return;
        const selection = runtimeContext.getMindmapNodeFromSelection();
        runtimeContext.updateUI(selection);
        runtimeContext.uiUpdateTimer = null;
      }, 50);
    };
    return { removeKeydownHandlers, removeEventListeners, handleCanvasPointerDown };
  }

  // src/scripts/mindmap-builder/transactions.js
  function createTransactions(runtimeContext) {
    const addElementsToView = async ({
      repositionToCursor = false,
      save = false,
      newElementsOnTop = true,
      shouldRestoreElements = true,
      captureUpdate = "IMMEDIATELY"
    } = {}) => {
      if (!runtimeContext.isViewSet()) return;
      if (["EVENTUALLY", "IMMEDIATELY"].includes(captureUpdate)) {
        runtimeContext.currentTransactionAccumulator++;
      }
      await runtimeContext.ea.addElementsToView(
        repositionToCursor,
        save,
        newElementsOnTop,
        shouldRestoreElements,
        captureUpdate
      );
      const fileIds = new Set(
        runtimeContext.ea.getElements().filter((el) => el.fileId && !el.isDeleted).map((el) => el.fileId)
      );
      runtimeContext.ea.clear();
      if (captureUpdate === "IMMEDIATELY") {
        const currentSceneVersion = ExcalidrawLib.getSceneVersion(
          runtimeContext.api().getSceneElements()
        );
        runtimeContext.lastCommittedTransaction = {
          steps: runtimeContext.currentTransactionAccumulator,
          version: currentSceneVersion
        };
        runtimeContext.currentTransactionAccumulator = 0;
        runtimeContext.redoAvailable = null;
      }
      if (fileIds.size === 0) return;
      const checker = () => {
        const loadedFiles = runtimeContext.api().getFiles();
        const loadedKeys = Object.keys(loadedFiles).filter((f) => loadedFiles[f].dataURL);
        for (const fileId of fileIds) {
          if (!loadedKeys.find((f) => f.id === fileId)) return false;
        }
        return true;
      };
      let watchdog = 0;
      while (!checker() && watchdog++ < 20) {
        await sleep(15);
      }
    };
    return { addElementsToView };
  }

  // src/scripts/mindmap-builder/configuration.js
  function createConfiguration(runtimeContext) {
    const VALUE_SETS = Object.freeze({
      SCOPE: Object.freeze({
        input: 3,
        excalidraw: 2,
        global: 1,
        none: 0
      }),
      FONT_SCALE: Object.freeze(["Use scene fontsize", "Fibonacci Scale", "Normal Scale"]),
      GROWTH: Object.freeze([
        "Radial",
        "Right-facing",
        "Left-facing",
        "Right-Left",
        "Up-facing",
        "Down-facing",
        "Up-Down"
      ]),
      ZOOM: Object.freeze(["Low", "Medium", "High"]),
      ARROW: Object.freeze(["curved", "straight"]),
      BRANCH_SCALE: Object.freeze(["Hierarchical", "Uniform"])
    });
    const FONT_SCALE_TYPES = VALUE_SETS.FONT_SCALE;
    const GROWTH_TYPES = VALUE_SETS.GROWTH;
    const ZOOM_TYPES = VALUE_SETS.ZOOM;
    const SCOPE = VALUE_SETS.SCOPE;
    const ARROW_TYPES = VALUE_SETS.ARROW;
    const BRANCH_SCALE_TYPES = VALUE_SETS.BRANCH_SCALE;
    const ZOOM_LEVELS = Object.freeze({
      Low: { desktop: 0.1, mobile: 0.2 },
      Medium: { desktop: 0.25, mobile: 0.35 },
      High: { desktop: 0.5, mobile: 0.6 }
    });
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
    const K_INJECT_LINK = "Inject Node Link";
    const K_LINK_ALIAS = "Node Link Alias";
    const K_PRESETS = "Map Presets";
    const K_ACTIVE_PRESET = "Active Preset";
    const LAYOUT_METADATA = {
      // --- General ---
      GAP_X: {
        section: "SECTION_GENERAL",
        def: 120,
        min: 10,
        max: 400,
        step: 10,
        desc: runtimeContext.t("DESC_LAYOUT_GAP_X"),
        name: runtimeContext.t("GAP_X")
      },
      GAP_Y: {
        section: "SECTION_GENERAL",
        def: 25,
        min: 5,
        max: 150,
        step: 5,
        desc: runtimeContext.t("DESC_LAYOUT_GAP_Y"),
        name: runtimeContext.t("GAP_Y")
      },
      GAP_MULTIPLIER: {
        section: "SECTION_GENERAL",
        def: 0.6,
        min: 0.1,
        max: 3,
        step: 0.1,
        desc: runtimeContext.t("DESC_LAYOUT_GAP_MULTIPLIER"),
        name: runtimeContext.t("GAP_MULTIPLIER")
      },
      // --- Radial (New & Updated) ---
      ROOT_RADIUS_FACTOR: {
        section: "SECTION_GENERAL",
        def: 0.8,
        min: 0.5,
        max: 2,
        step: 0.1,
        desc: runtimeContext.t("DESC_LAYOUT_ROOT_RADIUS"),
        name: runtimeContext.t("ROOT_RADIUS_FACTOR")
      },
      MIN_RADIUS: {
        section: "SECTION_GENERAL",
        def: 350,
        min: 30,
        max: 800,
        step: 10,
        desc: runtimeContext.t("DESC_LAYOUT_MIN_RADIUS"),
        name: runtimeContext.t("MIN_RADIUS")
      },
      RADIAL_ASPECT_RATIO: {
        section: "SECTION_RADIAL",
        def: 0.7,
        min: 0.5,
        max: 2,
        step: 0.1,
        desc: runtimeContext.t("DESC_RADIAL_ASPECT_RATIO"),
        name: runtimeContext.t("RADIAL_ASPECT_RATIO")
      },
      RADIAL_POLE_GAP_BONUS: {
        section: "SECTION_RADIAL",
        def: 2,
        min: 0,
        max: 5,
        step: 0.1,
        desc: runtimeContext.t("DESC_RADIAL_POLE_GAP_BONUS"),
        name: runtimeContext.t("RADIAL_POLE_GAP_BONUS")
      },
      RADIAL_START_ANGLE: {
        section: "SECTION_RADIAL",
        def: 280,
        min: 0,
        max: 360,
        step: 10,
        desc: runtimeContext.t("DESC_RADIAL_START_ANGLE"),
        name: runtimeContext.t("RADIAL_START_ANGLE")
      },
      RADIAL_MAX_SWEEP: {
        section: "SECTION_RADIAL",
        def: 340,
        min: 90,
        max: 360,
        step: 10,
        desc: runtimeContext.t("DESC_RADIAL_MAX_SWEEP"),
        name: runtimeContext.t("RADIAL_MAX_SWEEP")
      },
      // --- Directional ---
      DIRECTIONAL_ARC_SPAN_RADIANS: {
        section: "SECTION_DIRECTIONAL",
        def: 1,
        min: 0.1,
        max: 3.14,
        step: 0.1,
        desc: runtimeContext.t("DESC_LAYOUT_ARC_SPAN"),
        name: runtimeContext.t("DIRECTIONAL_ARC_SPAN_RADIANS")
      },
      GAP_MULTIPLIER_DIRECTIONAL: {
        section: "SECTION_DIRECTIONAL",
        def: 1.5,
        min: 1,
        max: 3,
        step: 0.1,
        desc: runtimeContext.t("DESC_LAYOUT_GAP_DIRECTIONAL"),
        name: runtimeContext.t("GAP_MULTIPLIER_DIRECTIONAL")
      },
      RADIUS_PADDING_PER_NODE: {
        section: "SECTION_DIRECTIONAL",
        def: 7,
        min: 0,
        max: 20,
        step: 1,
        desc: runtimeContext.t("DESC_LAYOUT_RADIUS_PADDING"),
        name: runtimeContext.t("RADIUS_PADDING_PER_NODE")
      },
      // --- Vertical Maps (Up/Down) ---
      VERTICAL_SUBTREE_WIDTH_BLEND_SINGLE: {
        section: "SECTION_VERTICAL",
        def: 0.35,
        min: 0.05,
        max: 1.2,
        step: 0.05,
        desc: runtimeContext.t("DESC_VERTICAL_SUBTREE_WIDTH_BLEND_SINGLE"),
        name: runtimeContext.t("VERTICAL_SUBTREE_WIDTH_BLEND_SINGLE")
      },
      VERTICAL_SUBTREE_WIDTH_BLEND_DUAL: {
        section: "SECTION_VERTICAL",
        def: 0.6,
        min: 0.1,
        max: 1.4,
        step: 0.05,
        desc: runtimeContext.t("DESC_VERTICAL_SUBTREE_WIDTH_BLEND_DUAL"),
        name: runtimeContext.t("VERTICAL_SUBTREE_WIDTH_BLEND_DUAL")
      },
      VERTICAL_SUBTREE_SMOOTH_THRESHOLD_MULTIPLIER: {
        section: "SECTION_VERTICAL",
        def: 6,
        min: 0.5,
        max: 20,
        step: 0.5,
        desc: runtimeContext.t("DESC_VERTICAL_SUBTREE_SMOOTH_THRESHOLD_MULTIPLIER"),
        name: runtimeContext.t("VERTICAL_SUBTREE_SMOOTH_THRESHOLD_MULTIPLIER")
      },
      VERTICAL_SUBTREE_SMOOTH_MIN_SCALE: {
        section: "SECTION_VERTICAL",
        def: 240,
        min: 10,
        max: 1600,
        step: 10,
        desc: runtimeContext.t("DESC_VERTICAL_SUBTREE_SMOOTH_MIN_SCALE"),
        name: runtimeContext.t("VERTICAL_SUBTREE_SMOOTH_MIN_SCALE")
      },
      HORIZONTAL_L1_SOFTCAP_THRESHOLD: {
        section: "SECTION_VERTICAL",
        def: 560,
        min: 20,
        max: 3e3,
        step: 20,
        desc: runtimeContext.t("DESC_HORIZONTAL_L1_SOFTCAP_THRESHOLD"),
        name: runtimeContext.t("HORIZONTAL_L1_SOFTCAP_THRESHOLD")
      },
      HORIZONTAL_L1_COMPRESSION_MIN_SCALE: {
        section: "SECTION_VERTICAL",
        def: 240,
        min: 10,
        max: 1600,
        step: 10,
        desc: runtimeContext.t("DESC_HORIZONTAL_L1_COMPRESSION_MIN_SCALE"),
        name: runtimeContext.t("HORIZONTAL_L1_COMPRESSION_MIN_SCALE")
      },
      VERTICAL_COMPACT_PARENT_CHILD_GAP_RATIO: {
        section: "SECTION_VERTICAL",
        def: 0.55,
        min: 0.05,
        max: 1.3,
        step: 0.05,
        desc: runtimeContext.t("DESC_VERTICAL_COMPACT_PARENT_CHILD_GAP_RATIO"),
        name: runtimeContext.t("VERTICAL_COMPACT_PARENT_CHILD_GAP_RATIO")
      },
      DIRECTIONAL_CROSS_AXIS_RATIO: {
        section: "SECTION_VERTICAL",
        def: 0.2,
        min: 0.05,
        max: 1.2,
        step: 0.05,
        desc: runtimeContext.t("DESC_DIRECTIONAL_CROSS_AXIS_RATIO"),
        name: runtimeContext.t("DIRECTIONAL_CROSS_AXIS_RATIO")
      },
      // --- Visuals ---
      INDICATOR_OFFSET: {
        section: "SECTION_VISUALS",
        def: 10,
        min: 5,
        max: 50,
        step: 5,
        desc: runtimeContext.t("DESC_LAYOUT_INDICATOR_OFFSET"),
        name: runtimeContext.t("INDICATOR_OFFSET")
      },
      INDICATOR_OPACITY: {
        section: "SECTION_VISUALS",
        def: 40,
        min: 10,
        max: 100,
        step: 10,
        desc: runtimeContext.t("DESC_LAYOUT_INDICATOR_OPACITY"),
        name: runtimeContext.t("INDICATOR_OPACITY")
      },
      CONTAINER_PADDING: {
        section: "SECTION_VISUALS",
        def: 10,
        min: 0,
        max: 50,
        step: 2,
        desc: runtimeContext.t("DESC_LAYOUT_CONTAINER_PADDING"),
        name: runtimeContext.t("CONTAINER_PADDING")
      },
      MAX_SEGMENT_LENGTH: {
        section: "SECTION_VISUALS",
        def: 80,
        min: 30,
        max: 200,
        step: 10,
        desc: runtimeContext.t("DESC_LAYOUT_BOUNDARY_LINE_PRECISION"),
        name: runtimeContext.t("MAX_SEGMENT_LENGTH")
      },
      // --- Manual Mode ---
      MANUAL_GAP_MULTIPLIER: {
        section: "SECTION_MANUAL",
        def: 1.3,
        min: 1,
        max: 2,
        step: 0.1,
        desc: runtimeContext.t("DESC_LAYOUT_MANUAL_GAP"),
        name: runtimeContext.t("MANUAL_GAP_MULTIPLIER")
      },
      MANUAL_JITTER_RANGE: {
        section: "SECTION_MANUAL",
        def: 300,
        min: 0,
        max: 400,
        step: 10,
        desc: runtimeContext.t("DESC_LAYOUT_MANUAL_JITTER"),
        name: runtimeContext.t("MANUAL_JITTER_RANGE")
      }
    };
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
    const WRAP_WIDTH_MIN = 100;
    const WRAP_WIDTH_MAX = 600;
    const WRAP_WIDTH_STEP = 10;
    const FLOAT_MODAL_OPACITY = 0.8;
    const FLOAT_MODAL_OFFSET = 5;
    const FLOAT_MODAL_MAX_HEIGHT = "calc(2 * var(--size-4-4) + 12px + var(--input-height))";
    const NOTICE_DURATION_CONFLICT = 6e3;
    const NOTICE_DURATION_GLOBAL_CONFLICT = 1e4;
    const LAYOUT_DEFAULTS = {};
    const IMAGE_TYPES = [
      "jpeg",
      "jpg",
      "png",
      "gif",
      "svg",
      "webp",
      "bmp",
      "ico",
      "jtif",
      "tif",
      "jfif",
      "avif"
    ];
    const EMBEDED_OBJECT_WIDTH_ROOT = 400;
    const EMBEDED_OBJECT_WIDTH_CHILD = 180;
    const ACTION_ADD = "Add";
    const ACTION_ADD_SIBLING_AFTER = "Add Next Sibling";
    const ACTION_ADD_SIBLING_BEFORE = "Add Prev Sibling";
    const ACTION_ADD_FOLLOW = "Add + follow";
    const ACTION_ADD_FOLLOW_FOCUS = "Add + follow + focus";
    const ACTION_ADD_FOLLOW_ZOOM = "Add + follow + zoom";
    const ACTION_SORT_ORDER = "Change Order/Promote Node";
    const ACTION_EDIT = "Edit node";
    const ACTION_TOGGLE_CHECKBOX = "Toggle Checkbox";
    const ACTION_CALENDAR = "Calendar";
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
      [ACTION_CALENDAR]: "ACTION_LABEL_CALENDAR",
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
    const DEFAULT_HOTKEYS = [
      // Creation - Enter based
      {
        action: ACTION_ADD,
        key: "Enter",
        modifiers: [],
        scope: SCOPE.input,
        isInputOnly: true,
        requiresNode: false
      },
      {
        action: ACTION_ADD_SIBLING_AFTER,
        key: "Enter",
        modifiers: ["Alt"],
        scope: SCOPE.input,
        isInputOnly: true,
        requiresNode: false
      },
      {
        action: ACTION_ADD_SIBLING_BEFORE,
        key: "Enter",
        modifiers: ["Alt", "Shift"],
        scope: SCOPE.input,
        isInputOnly: true,
        requiresNode: false
      },
      {
        action: ACTION_ADD_FOLLOW,
        key: "Enter",
        modifiers: ["Mod", "Alt"],
        scope: SCOPE.input,
        isInputOnly: true,
        requiresNode: false
      },
      {
        action: ACTION_ADD_FOLLOW_FOCUS,
        key: "Enter",
        modifiers: ["Mod"],
        scope: SCOPE.input,
        isInputOnly: true,
        requiresNode: false
      },
      {
        action: ACTION_ADD_FOLLOW_ZOOM,
        key: "Enter",
        modifiers: ["Mod", "Shift"],
        scope: SCOPE.input,
        isInputOnly: true,
        requiresNode: false
      },
      //Window
      {
        action: ACTION_DOCK_UNDOCK,
        key: "Enter",
        modifiers: ["Shift"],
        scope: SCOPE.input,
        isInputOnly: true,
        requiresNode: false
      },
      {
        action: ACTION_HIDE,
        key: "Escape",
        modifiers: [],
        scope: SCOPE.excalidraw,
        isInputOnly: true,
        requiresNode: false
      },
      // Edit
      {
        action: ACTION_EDIT,
        code: "KeyE",
        modifiers: ["Mod"],
        scope: SCOPE.input,
        isInputOnly: false,
        requiresNode: true
      },
      // Structure Modifiers
      {
        action: ACTION_TOGGLE_CHECKBOX,
        code: "KeyL",
        modifiers: ["Mod"],
        scope: SCOPE.input,
        isInputOnly: false,
        requiresNode: true
      },
      {
        action: ACTION_CALENDAR,
        code: "KeyD",
        modifiers: ["Alt", "Mod"],
        scope: SCOPE.input,
        isInputOnly: false,
        requiresNode: false
      },
      {
        action: ACTION_PIN,
        code: "KeyP",
        modifiers: ["Alt"],
        scope: SCOPE.input,
        isInputOnly: false,
        requiresNode: true
      },
      {
        action: ACTION_BOX,
        code: "KeyB",
        modifiers: ["Alt"],
        scope: SCOPE.input,
        isInputOnly: false,
        requiresNode: true
      },
      {
        action: ACTION_TOGGLE_BOUNDARY,
        code: "KeyB",
        modifiers: ["Alt", "Shift"],
        scope: SCOPE.input,
        isInputOnly: false,
        requiresNode: true
      },
      {
        action: ACTION_TOGGLE_SUBMAP_ROOT,
        code: "KeyJ",
        modifiers: ["Alt"],
        scope: SCOPE.input,
        isInputOnly: false,
        requiresNode: true
      },
      {
        action: ACTION_TOGGLE_GROUP,
        code: "KeyG",
        modifiers: ["Alt"],
        scope: SCOPE.input,
        isInputOnly: false,
        requiresNode: true
      },
      {
        action: ACTION_TOGGLE_EMBED,
        code: "KeyE",
        modifiers: ["Alt"],
        scope: SCOPE.input,
        isInputOnly: false,
        requiresNode: true
      },
      // Clipboard (Alt to distinguish from text editing)
      {
        action: ACTION_COPY,
        code: "KeyC",
        modifiers: ["Alt"],
        scope: SCOPE.input,
        isInputOnly: false,
        requiresNode: true
      },
      {
        action: ACTION_CUT,
        code: "KeyX",
        modifiers: ["Alt"],
        scope: SCOPE.input,
        isInputOnly: false,
        requiresNode: true
      },
      {
        action: ACTION_PASTE,
        code: "KeyV",
        modifiers: ["Alt"],
        scope: SCOPE.input,
        isInputOnly: false,
        requiresNode: false
      },
      {
        action: ACTION_IMPORT_OUTLINE,
        code: "KeyI",
        modifiers: ["Alt"],
        scope: SCOPE.input,
        isInputOnly: false,
        requiresNode: true
      },
      // View Actions
      {
        action: ACTION_REARRANGE,
        code: "KeyR",
        modifiers: ["Alt"],
        scope: SCOPE.input,
        isInputOnly: false,
        requiresNode: true
      },
      {
        action: ACTION_ZOOM,
        code: "KeyZ",
        modifiers: ["Alt"],
        scope: SCOPE.input,
        isInputOnly: false,
        requiresNode: true
      },
      {
        action: ACTION_FOCUS,
        code: "KeyF",
        modifiers: ["Alt"],
        scope: SCOPE.input,
        isInputOnly: false,
        requiresNode: false
      },
      //Navigation
      {
        action: ACTION_NAVIGATE,
        key: "ArrowKeys",
        modifiers: ["Alt"],
        isNavigation: true,
        scope: SCOPE.input,
        isInputOnly: false,
        requiresNode: true
      },
      {
        action: ACTION_NAVIGATE_ZOOM,
        key: "ArrowKeys",
        modifiers: ["Alt", "Shift"],
        isNavigation: true,
        scope: SCOPE.input,
        isInputOnly: false,
        requiresNode: true
      },
      {
        action: ACTION_NAVIGATE_FOCUS,
        key: "ArrowKeys",
        modifiers: ["Alt", "Mod"],
        isNavigation: true,
        scope: SCOPE.input,
        isInputOnly: false,
        requiresNode: true
      },
      {
        action: ACTION_SORT_ORDER,
        code: "ArrowKeys",
        modifiers: ["Mod"],
        isNavigation: true,
        scope: SCOPE.input,
        isInputOnly: false,
        requiresNode: true
      },
      {
        action: ACTION_FOLD,
        code: "Digit1",
        modifiers: ["Alt"],
        scope: SCOPE.input,
        isInputOnly: false,
        requiresNode: true
      },
      {
        action: ACTION_FOLD_L1,
        code: "Digit2",
        modifiers: ["Alt"],
        scope: SCOPE.input,
        isInputOnly: false,
        requiresNode: true
      },
      {
        action: ACTION_FOLD_ALL,
        code: "Digit3",
        modifiers: ["Alt"],
        scope: SCOPE.input,
        isInputOnly: false,
        requiresNode: true
      },
      // Undo / Redo
      {
        action: ACTION_UNDO,
        key: "z",
        modifiers: ["Mod"],
        scope: SCOPE.excalidraw,
        isInputOnly: false,
        hidden: true,
        requiresNode: false
      },
      {
        action: ACTION_REDO_Z,
        key: "z",
        modifiers: ["Mod", "Shift"],
        scope: SCOPE.excalidraw,
        isInputOnly: false,
        hidden: true,
        requiresNode: false
      },
      {
        action: ACTION_REDO_Y,
        key: "y",
        modifiers: ["Mod"],
        scope: SCOPE.excalidraw,
        isInputOnly: false,
        hidden: true,
        requiresNode: false
      }
    ];
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
      "layoutSettings"
    ];
    const MINDMAP_FOCUS_STYLE_ID = "excalidraw-mindmap-focus-style";
    return {
      VALUE_SETS,
      FONT_SCALE_TYPES,
      GROWTH_TYPES,
      ZOOM_TYPES,
      SCOPE,
      ARROW_TYPES,
      BRANCH_SCALE_TYPES,
      ZOOM_LEVELS,
      K_WIDTH,
      K_FONTSIZE,
      K_BOX,
      K_ROUND,
      K_BRANCH_SCALE,
      K_BASE_WIDTH,
      K_GROWTH,
      K_MULTICOLOR,
      K_UNDOCKED,
      K_GROUP,
      K_ARROWSTROKE,
      K_CENTERTEXT,
      K_ZOOM,
      K_HOTKEYS,
      K_PALETTE,
      K_LAYOUT,
      K_ARROW_TYPE,
      K_FILL_SWEEP,
      K_INJECT_LINK,
      K_LINK_ALIAS,
      K_PRESETS,
      K_ACTIVE_PRESET,
      LAYOUT_METADATA,
      COLOR_CONTRAST_MIN,
      COLOR_DISTINCT_THRESHOLD,
      HUE_STEP_BASE,
      HUE_STEP_JITTER,
      SAT_BASE,
      SAT_JITTER,
      LIGHT_BASE_DARK,
      LIGHT_JITTER_DARK,
      LIGHT_BASE_LIGHT,
      LIGHT_JITTER_LIGHT,
      WRAP_WIDTH_MIN,
      WRAP_WIDTH_MAX,
      WRAP_WIDTH_STEP,
      FLOAT_MODAL_OPACITY,
      FLOAT_MODAL_OFFSET,
      FLOAT_MODAL_MAX_HEIGHT,
      NOTICE_DURATION_CONFLICT,
      NOTICE_DURATION_GLOBAL_CONFLICT,
      LAYOUT_DEFAULTS,
      IMAGE_TYPES,
      EMBEDED_OBJECT_WIDTH_ROOT,
      EMBEDED_OBJECT_WIDTH_CHILD,
      ACTION_ADD,
      ACTION_ADD_SIBLING_AFTER,
      ACTION_ADD_SIBLING_BEFORE,
      ACTION_ADD_FOLLOW,
      ACTION_ADD_FOLLOW_FOCUS,
      ACTION_ADD_FOLLOW_ZOOM,
      ACTION_SORT_ORDER,
      ACTION_EDIT,
      ACTION_TOGGLE_CHECKBOX,
      ACTION_CALENDAR,
      ACTION_PIN,
      ACTION_BOX,
      ACTION_TOGGLE_GROUP,
      ACTION_COPY,
      ACTION_CUT,
      ACTION_PASTE,
      ACTION_IMPORT_OUTLINE,
      ACTION_ZOOM,
      ACTION_FOCUS,
      ACTION_NAVIGATE,
      ACTION_NAVIGATE_ZOOM,
      ACTION_NAVIGATE_FOCUS,
      ACTION_FOLD,
      ACTION_FOLD_L1,
      ACTION_FOLD_ALL,
      ACTION_TOGGLE_BOUNDARY,
      ACTION_TOGGLE_SUBMAP_ROOT,
      ACTION_TOGGLE_EMBED,
      ACTION_DOCK_UNDOCK,
      ACTION_HIDE,
      ACTION_REARRANGE,
      ACTION_TOGGLE_FLOATING_EXTRAS,
      ACTION_UNDO,
      ACTION_REDO_Z,
      ACTION_REDO_Y,
      ACTION_LABEL_KEYS,
      DEFAULT_HOTKEYS,
      MAP_ROOT_CUSTOMDATA_KEYS,
      MINDMAP_FOCUS_STYLE_ID
    };
  }

  // src/scripts/mindmap-builder/publicApi.js
  function installMindmapPublicApi(runtimeContext) {
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
        OPERATION_FAILED: "OPERATION_FAILED"
      };
      const mmOk = (data) => ({
        ok: true,
        data
      });
      const mmErr = (code, message, details) => ({
        ok: false,
        error: details === void 0 ? {
          code,
          message
        } : {
          code,
          message,
          details
        }
      });
      const requireView = () => {
        if (!runtimeContext.isViewSet()) return mmErr(MMError.NO_VIEW, "No active ExcalidrawView");
        return null;
      };
      const findNodeById = (nodeId) => {
        const all = runtimeContext.ea.getViewElements();
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
        const sel = runtimeContext.getMindmapNodeFromSelection();
        if (!sel) return mmErr(MMError.NO_SELECTION, "No mindmap node selected");
        return mmOk(sel);
      };
      const getNodeOntology = (node, allElements) => {
        const incomingArrow = allElements.find(
          (a) => a.type === "arrow" && a.customData?.isBranch && a.endBinding?.elementId === node.id
        );
        return incomingArrow ? runtimeContext.ea.getBoundTextElement(incomingArrow, true)?.sceneElement?.rawText || "" : "";
      };
      const extractMapConfig = (rootNode) => ({
        growthMode: rootNode.customData?.growthMode || runtimeContext.currentModalGrowthMode,
        autoLayoutDisabled: rootNode.customData?.autoLayoutDisabled === true,
        arrowType: rootNode.customData?.arrowType ?? runtimeContext.arrowType,
        fontsizeScale: rootNode.customData?.fontsizeScale ?? runtimeContext.fontsizeScale,
        multicolor: typeof rootNode.customData?.multicolor === "boolean" ? rootNode.customData.multicolor : runtimeContext.multicolor,
        boxChildren: typeof rootNode.customData?.boxChildren === "boolean" ? rootNode.customData.boxChildren : runtimeContext.boxChildren,
        roundedCorners: typeof rootNode.customData?.roundedCorners === "boolean" ? rootNode.customData.roundedCorners : runtimeContext.roundedCorners,
        maxWrapWidth: typeof rootNode.customData?.maxWrapWidth === "number" ? rootNode.customData.maxWrapWidth : runtimeContext.maxWidth,
        isSolidArrow: typeof rootNode.customData?.isSolidArrow === "boolean" ? rootNode.customData.isSolidArrow : runtimeContext.isSolidArrow,
        centerText: typeof rootNode.customData?.centerText === "boolean" ? rootNode.customData.centerText : runtimeContext.centerText,
        fillSweep: typeof rootNode.customData?.fillSweep === "boolean" ? rootNode.customData.fillSweep : runtimeContext.fillSweep,
        branchScale: rootNode.customData?.branchScale ?? runtimeContext.branchScale,
        baseStrokeWidth: typeof rootNode.customData?.baseStrokeWidth === "number" ? rootNode.customData.baseStrokeWidth : runtimeContext.baseStrokeWidth,
        layoutSettings: JSON.parse(
          JSON.stringify(rootNode.customData?.layoutSettings ?? runtimeContext.layoutSettings)
        )
      });
      const API_ACTIONS = {
        ADD: runtimeContext.ACTION_ADD,
        ADD_SIBLING_AFTER: runtimeContext.ACTION_ADD_SIBLING_AFTER,
        ADD_SIBLING_BEFORE: runtimeContext.ACTION_ADD_SIBLING_BEFORE,
        ADD_FOLLOW: runtimeContext.ACTION_ADD_FOLLOW,
        ADD_FOLLOW_FOCUS: runtimeContext.ACTION_ADD_FOLLOW_FOCUS,
        ADD_FOLLOW_ZOOM: runtimeContext.ACTION_ADD_FOLLOW_ZOOM,
        EDIT: runtimeContext.ACTION_EDIT,
        TOGGLE_CHECKBOX: runtimeContext.ACTION_TOGGLE_CHECKBOX,
        PIN: runtimeContext.ACTION_PIN,
        BOX: runtimeContext.ACTION_BOX,
        TOGGLE_EMBED: runtimeContext.ACTION_TOGGLE_EMBED,
        TOGGLE_BOUNDARY: runtimeContext.ACTION_TOGGLE_BOUNDARY,
        TOGGLE_SUBMAP_ROOT: runtimeContext.ACTION_TOGGLE_SUBMAP_ROOT,
        TOGGLE_GROUP: runtimeContext.ACTION_TOGGLE_GROUP,
        FOLD: runtimeContext.ACTION_FOLD,
        FOLD_L1: runtimeContext.ACTION_FOLD_L1,
        FOLD_ALL: runtimeContext.ACTION_FOLD_ALL,
        COPY: runtimeContext.ACTION_COPY,
        CUT: runtimeContext.ACTION_CUT,
        PASTE: runtimeContext.ACTION_PASTE,
        ZOOM: runtimeContext.ACTION_ZOOM,
        FOCUS: runtimeContext.ACTION_FOCUS,
        NAVIGATE: runtimeContext.ACTION_NAVIGATE,
        NAVIGATE_ZOOM: runtimeContext.ACTION_NAVIGATE_ZOOM,
        NAVIGATE_FOCUS: runtimeContext.ACTION_NAVIGATE_FOCUS,
        SORT_ORDER: runtimeContext.ACTION_SORT_ORDER,
        REARRANGE: runtimeContext.ACTION_REARRANGE,
        DOCK_UNDOCK: runtimeContext.ACTION_DOCK_UNDOCK,
        HIDE: runtimeContext.ACTION_HIDE,
        UNDO: runtimeContext.ACTION_UNDO,
        REDO_Z: runtimeContext.ACTION_REDO_Z,
        REDO_Y: runtimeContext.ACTION_REDO_Y
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
        [MMError.OPERATION_FAILED]: "The underlying operation failed at runtime"
      };
      const API_METHOD_SPEC = {
        ready: {
          summary: "Returns whether the API runtime is initialized",
          params: [],
          returns: "boolean"
        },
        listMethods: {
          summary: "Returns the list of public method names",
          params: [],
          returns: "MMResult<{methods:string[]}>"
        },
        getErrorCodes: {
          summary: "Returns known error codes and their meaning",
          params: [],
          returns: "MMResult<{errors:Record<string,string>}>"
        },
        spec: {
          summary: "Returns machine-readable API metadata for agents",
          params: [],
          returns: "MMResult<{version:string,actions:string[],errors:Record<string,string>,methods:object}>"
        },
        help: {
          summary: "Returns method docs for one method or the full API",
          params: [
            {
              name: "method",
              type: "string",
              required: false
            },
            {
              name: "format",
              type: "string",
              required: false,
              enum: ["object", "text"]
            }
          ],
          returns: "MMResult<object|string>"
        },
        validate: {
          summary: "Validates arguments against the API method contract",
          params: [
            {
              name: "method",
              type: "string",
              required: true
            },
            {
              name: "args",
              type: "any",
              required: false
            }
          ],
          returns: "MMResult<{valid:boolean,errors:string[],normalizedArgs:object}>"
        },
        getCapabilities: {
          summary: "Returns available actions and methods",
          params: [],
          returns: "{actions:string[],methods:string[]}"
        },
        setView: {
          summary: "Sets the active ExcalidrawView context",
          params: [
            {
              name: "view",
              type: "object",
              required: true
            }
          ],
          returns: "MMResult<{view:ExcalidrawView|null,filePath:string|null}>"
        },
        getView: {
          summary: "Gets the current ExcalidrawView and filepath",
          params: [],
          returns: "MMResult<{view:ExcalidrawView|null,filePath:string|null}>"
        },
        getSelection: {
          summary: "Returns selected node id and selected element ids",
          params: [],
          returns: "MMResult<{nodeId:string|null,elementIds:string[]}>"
        },
        selectNode: {
          summary: "Selects a node by id or current selected node when omitted",
          params: [
            {
              name: "nodeId",
              type: "string",
              required: false
            }
          ],
          returns: "MMResult<{nodeId:string}>"
        },
        setInputFieldDockStatus: {
          summary: "Forces docked/undocked input mode and applies matching sidepanel visibility",
          params: [
            {
              name: "isDocked",
              type: "boolean",
              required: true
            }
          ],
          returns: "Promise<MMResult<{isDocked:boolean,isUndocked:boolean,sidepanelVisible:boolean}>>"
        },
        getMindMapRoots: {
          summary: "Returns top-level mindmap root node ids",
          params: [],
          returns: "MMResult<{rootIds:string[]}>"
        },
        getMapInfo: {
          summary: "Returns hierarchy info for a node or current selection",
          params: [
            {
              name: "nodeId",
              type: "string",
              required: false
            }
          ],
          returns: "MMResult<{nodeId:string,rootId:string,settingsRootId:string,depth:number}>"
        },
        getNodeText: {
          summary: "Returns node text and ontology",
          params: [
            {
              name: "nodeId",
              type: "string",
              required: false
            }
          ],
          returns: "MMResult<{nodeId:string,text:string,ontology:string}>"
        },
        performAction: {
          summary: "Runs one built-in mindmap action",
          params: [
            {
              name: "action",
              type: "string",
              required: true,
              enum: Object.values(API_ACTIONS)
            },
            {
              name: "event",
              type: "object",
              required: false
            }
          ],
          returns: "Promise<MMResult<void>>"
        },
        refreshMapLayout: {
          summary: "Refreshes map layout from the selected node or provided node id",
          params: [
            {
              name: "nodeId",
              type: "string",
              required: false
            }
          ],
          returns: "Promise<MMResult<{rootId:string}>>"
        },
        addNode: {
          summary: "Adds a node under selected node or a provided parent",
          params: [
            {
              name: "text",
              type: "string",
              required: true
            },
            {
              name: "parentId",
              type: "string",
              required: false
            },
            {
              name: "ontology",
              type: "string",
              required: false
            },
            {
              name: "follow",
              type: "boolean",
              required: false
            },
            {
              name: "position",
              type: "string",
              required: false
            }
          ],
          returns: "Promise<MMResult<{nodeId:string,arrowId:string|undefined,rootId:string}>>"
        },
        importMarkdown: {
          summary: "Imports markdown bullet hierarchy into map",
          params: [
            {
              name: "markdown",
              type: "string",
              required: true
            },
            {
              name: "parentId",
              type: "string",
              required: false
            }
          ],
          returns: "Promise<MMResult<{addedNodeIds:string[],rootId:string|null}>>"
        },
        exportMarkdown: {
          summary: "Exports selected branch to markdown through clipboard",
          params: [
            {
              name: "nodeId",
              type: "string",
              required: false
            },
            {
              name: "cut",
              type: "boolean",
              required: false
            }
          ],
          returns: "Promise<MMResult<{markdown:string}>>"
        },
        toggleSubmapRoot: {
          summary: "Toggles or forces additional-root state on node",
          params: [
            {
              name: "nodeId",
              type: "string",
              required: false
            },
            {
              name: "enabled",
              type: "boolean",
              required: false
            }
          ],
          returns: "Promise<MMResult<{nodeId:string,enabled:boolean}>>"
        },
        getMapConfig: {
          summary: "Returns effective map config for node/root",
          params: [
            {
              name: "nodeId",
              type: "string",
              required: false
            }
          ],
          returns: "MMResult<{rootId:string,settingsRootId:string,config:object}>"
        },
        setMapConfig: {
          summary: "Patches map config and optionally relayouts",
          params: [
            {
              name: "patch",
              type: "object",
              required: true
            },
            {
              name: "nodeId",
              type: "string",
              required: false
            },
            {
              name: "relayout",
              type: "boolean",
              required: false
            }
          ],
          returns: "Promise<MMResult<{rootId:string,settingsRootId:string}>>"
        },
        getBranchElementIds: {
          summary: "Returns branch element ids with optional decorations/crosslinks",
          params: [
            {
              name: "nodeId",
              type: "string",
              required: true
            },
            {
              name: "includeDecorations",
              type: "boolean",
              required: false
            },
            {
              name: "includeCrosslinks",
              type: "boolean",
              required: false
            }
          ],
          returns: "MMResult<{ids:string[]}>"
        },
        getProjectElementIds: {
          summary: "Returns all project element ids for a root",
          params: [
            {
              name: "rootId",
              type: "string",
              required: true
            }
          ],
          returns: "MMResult<{ids:string[]}>"
        },
        getElementIdsByRole: {
          summary: "Returns role-based element id groups for a root",
          params: [
            {
              name: "rootId",
              type: "string",
              required: true
            }
          ],
          returns: "MMResult<{nodes:string[],branchArrows:string[],crossLinks:string[],boundaries:string[],decorations:string[],boundTexts:string[]}>"
        },
        getGlobalConfig: {
          summary: "Returns the global map and layout configurations, including custom color palette",
          params: [],
          returns: "MMResult<{config:object}>"
        },
        setGlobalConfig: {
          summary: "Updates the global map and layout configurations and persists them",
          params: [
            {
              name: "patch",
              type: "object",
              required: true
            }
          ],
          returns: "Promise<MMResult<{success:boolean}>>"
        },
        getConfigSchema: {
          summary: "Returns the schema, allowed values, and definitions for map configurations",
          params: [],
          returns: "MMResult<{schema:object}>"
        }
      };
      const cloneJSON = (value) => JSON.parse(JSON.stringify(value));
      const normalizeValidationArgs = (method, args) => {
        const spec = API_METHOD_SPEC[method];
        if (!spec) return null;
        if (args === void 0 || args === null) return {};
        if (Array.isArray(args)) {
          const out = {};
          spec.params.forEach((p, idx) => {
            if (idx < args.length) out[p.name] = args[idx];
          });
          return out;
        }
        if (typeof args === "object")
          return {
            ...args
          };
        if (spec.params.length === 1)
          return {
            [spec.params[0].name]: args
          };
        return null;
      };
      const isTypeMatch = (value, type) => {
        if (type === "any") return true;
        if (type === "array") return Array.isArray(value);
        if (type === "object")
          return value !== null && typeof value === "object" && !Array.isArray(value);
        return typeof value === type;
      };
      const validateMethodArgs = (method, args) => {
        const spec = API_METHOD_SPEC[method];
        if (!spec) {
          return {
            valid: false,
            errors: [`Unknown method: ${method}`],
            normalizedArgs: {}
          };
        }
        const normalizedArgs = normalizeValidationArgs(method, args);
        if (normalizedArgs === null) {
          return {
            valid: false,
            errors: [
              "Arguments must be an object, an array of positional values, or a single value for single-parameter methods"
            ],
            normalizedArgs: {}
          };
        }
        const errors = [];
        spec.params.forEach((p) => {
          const v = normalizedArgs[p.name];
          if (p.required && (v === void 0 || v === null || p.type === "string" && v === "")) {
            errors.push(`Missing required parameter: ${p.name}`);
            return;
          }
          if (v !== void 0 && v !== null && !isTypeMatch(v, p.type)) {
            errors.push(
              `Invalid type for ${p.name}: expected ${p.type}, got ${Array.isArray(v) ? "array" : typeof v}`
            );
          }
          if (p.enum && v !== void 0 && v !== null && !p.enum.includes(v)) {
            errors.push(`Invalid value for ${p.name}: ${v}`);
          }
        });
        return {
          valid: errors.length === 0,
          errors,
          normalizedArgs
        };
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
          `Returns: ${doc.returns}`
        ].join("\n");
      };
      const API = {
        version: "1.0.0",
        Actions: Object.freeze(API_ACTIONS),
        Errors: Object.freeze(MMError),
        ready: () => !!runtimeContext.ea,
        listMethods: () => mmOk({
          methods: Object.keys(API_METHOD_SPEC)
        }),
        getErrorCodes: () => mmOk({
          errors: cloneJSON(API_ERROR_DOC)
        }),
        spec: () => mmOk({
          version: API.version,
          actions: Object.values(API_ACTIONS),
          errors: cloneJSON(API_ERROR_DOC),
          methods: cloneJSON(API_METHOD_SPEC)
        }),
        help: (method, format = "object") => {
          if (method !== void 0 && (typeof method !== "string" || method.trim() === "")) {
            return mmErr(
              MMError.INVALID_ARGUMENT,
              "help expects method to be a non-empty string when provided"
            );
          }
          if (!["object", "text"].includes(format)) {
            return mmErr(MMError.INVALID_ARGUMENT, "help format must be 'object' or 'text'");
          }
          if (!method) {
            if (format === "text") {
              const lines = Object.keys(API_METHOD_SPEC).map(
                (name) => `${name}: ${API_METHOD_SPEC[name].summary}`
              );
              return mmOk([`MindMapBuilder API v${API.version}`, ...lines].join("\n"));
            }
            return mmOk({
              version: API.version,
              methods: cloneJSON(API_METHOD_SPEC),
              actions: Object.values(API_ACTIONS),
              errors: cloneJSON(API_ERROR_DOC)
            });
          }
          const doc = API_METHOD_SPEC[method];
          if (!doc) {
            return mmErr(MMError.INVALID_ARGUMENT, `Unknown method: ${method}`);
          }
          if (format === "text") return mmOk(buildHelpText(method, doc));
          return mmOk({
            method,
            ...cloneJSON(doc)
          });
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
          methods: Object.keys(API)
        }),
        setView: (view) => {
          if (!view) return mmErr(MMError.INVALID_VIEW, "setView expects an ExcalidrawView object");
          const isValid = !!runtimeContext.ea?.isExcalidrawView(view);
          if (!isValid)
            return mmErr(MMError.INVALID_VIEW, "setView expects an ExcalidrawView object");
          try {
            runtimeContext.ea.setView(view);
            runtimeContext.ea.clear();
            runtimeContext.ensureNodeSelected();
            runtimeContext.updateUI();
            return mmOk({
              view: runtimeContext.ea.targetView,
              filePath: runtimeContext.ea.targetView?.file?.path || null
            });
          } catch (e) {
            return mmErr(MMError.OPERATION_FAILED, "Failed to set view", e);
          }
        },
        getView: () => mmOk({
          view: runtimeContext.ea.targetView || null,
          filePath: runtimeContext.ea.targetView?.file?.path || null
        }),
        getSelection: () => {
          const viewErr = requireView();
          if (viewErr) return viewErr;
          return mmOk({
            nodeId: runtimeContext.getMindmapNodeFromSelection()?.id || null,
            elementIds: runtimeContext.ea.getViewSelectedElements().map((e) => e.id)
          });
        },
        selectNode: (nodeId) => {
          const nodeRes = resolveNode(nodeId);
          if (!nodeRes.ok) return nodeRes;
          runtimeContext.selectNodeInView(nodeRes.data);
          runtimeContext.performAction(runtimeContext.ACTION_FOCUS);
          runtimeContext.updateUI(nodeRes.data);
          return mmOk({
            nodeId: nodeRes.data.id
          });
        },
        setInputFieldDockStatus: async ({ isDocked } = {}) => {
          const viewErr = requireView();
          if (viewErr) return viewErr;
          if (typeof isDocked !== "boolean") {
            return mmErr(
              MMError.INVALID_ARGUMENT,
              "setInputFieldDockStatus requires a boolean isDocked"
            );
          }
          try {
            const sidepanelLeaf = runtimeContext.ea.getSidepanelLeaf?.();
            const isSidepanelVisible = !!sidepanelLeaf?.isVisible?.();
            if (isDocked) {
              if (runtimeContext.isUndocked) {
                await runtimeContext.performAction(runtimeContext.ACTION_DOCK_UNDOCK);
              } else if (!isSidepanelVisible && sidepanelLeaf) {
                app.workspace.revealLeaf(sidepanelLeaf);
              }
            } else {
              if (!runtimeContext.isUndocked) {
                await runtimeContext.performAction(runtimeContext.ACTION_DOCK_UNDOCK);
              } else if (isSidepanelVisible) {
                runtimeContext.ea.toggleSidepanelView();
              }
            }
            const finalSidepanelLeaf = runtimeContext.ea.getSidepanelLeaf?.();
            const sidepanelVisible = !!finalSidepanelLeaf?.isVisible?.();
            return mmOk({
              isDocked: !runtimeContext.isUndocked,
              isUndocked: runtimeContext.isUndocked,
              sidepanelVisible
            });
          } catch (e) {
            return mmErr(MMError.OPERATION_FAILED, "setInputFieldDockStatus failed", e);
          }
        },
        getMindMapRoots: () => {
          const viewErr = requireView();
          if (viewErr) return viewErr;
          return mmOk({
            rootIds: runtimeContext.getMasterRoots()
          });
        },
        getMapInfo: (nodeId) => {
          const nodeRes = resolveNode(nodeId);
          if (!nodeRes.ok) return nodeRes;
          const node = nodeRes.data;
          const all = runtimeContext.ea.getViewElements();
          const info = runtimeContext.getHierarchy(node, all);
          const settingsRoot = runtimeContext.getSettingsRootNode(node, all);
          return mmOk({
            nodeId: node.id,
            rootId: info.rootId,
            settingsRootId: settingsRoot?.id || info.rootId,
            depth: info.depth
          });
        },
        getNodeText: (nodeId) => {
          const nodeRes = resolveNode(nodeId);
          if (!nodeRes.ok) return nodeRes;
          const node = nodeRes.data;
          const all = runtimeContext.ea.getViewElements();
          return mmOk({
            nodeId: node.id,
            text: runtimeContext.getTextFromNode(all, node, true, true),
            ontology: getNodeOntology(node, all)
          });
        },
        performAction: async (action, event = {}) => {
          const viewErr = requireView();
          if (viewErr) return viewErr;
          if (!action || !Object.values(API_ACTIONS).includes(action)) {
            return mmErr(MMError.INVALID_ACTION, `Unknown action: ${action}`);
          }
          try {
            await runtimeContext.performAction(action, event);
            return mmOk(void 0);
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
            await runtimeContext.refreshMapLayout(sel);
            const target = sel || runtimeContext.getMindmapNodeFromSelection();
            if (!target) return mmErr(MMError.NO_SELECTION, "No selected node for layout refresh");
            const info = runtimeContext.getHierarchy(target, runtimeContext.ea.getViewElements());
            return mmOk({
              rootId: info.rootId
            });
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
            runtimeContext.selectNodeInView(parent);
          }
          try {
            const node = await runtimeContext.addNode(
              text,
              follow,
              false,
              null,
              null,
              position || null,
              ontology ?? null
            );
            if (!node) return mmErr(MMError.OPERATION_FAILED, "Failed to create node");
            const all = runtimeContext.ea.getViewElements();
            const info = runtimeContext.getHierarchy(node, all);
            const arrow = all.find(
              (a) => a.type === "arrow" && a.customData?.isBranch && a.endBinding?.elementId === node.id
            );
            return mmOk({
              nodeId: node.id,
              arrowId: arrow?.id,
              rootId: info.rootId
            });
          } catch (e) {
            return mmErr(MMError.OPERATION_FAILED, "addNode failed", e);
          }
        },
        importMarkdown: async ({ markdown, parentId } = {}) => {
          const viewErr = requireView();
          if (viewErr) return viewErr;
          if (typeof markdown !== "string" || markdown.trim() === "") {
            return mmErr(
              MMError.INVALID_ARGUMENT,
              "importMarkdown requires a non-empty markdown string"
            );
          }
          if (parentId) {
            const parent = findNodeById(parentId);
            if (!parent) return mmErr(MMError.INVALID_NODE, `Parent node not found: ${parentId}`);
            runtimeContext.selectNodeInView(parent);
          }
          const beforeIds = new Set(runtimeContext.ea.getViewElements().map((e) => e.id));
          try {
            await runtimeContext.importTextToMap(markdown);
            const after = runtimeContext.ea.getViewElements();
            const addedNodeIds = after.filter((e) => !beforeIds.has(e.id) && e.type !== "arrow" && !e.customData?.isBoundary).map((e) => e.id);
            let rootId = null;
            if (parentId) {
              const parent = after.find((e) => e.id === parentId);
              rootId = parent ? runtimeContext.getHierarchy(parent, after).rootId : null;
            } else if (addedNodeIds.length > 0) {
              const n = after.find((e) => e.id === addedNodeIds[0]);
              rootId = n ? runtimeContext.getHierarchy(n, after).rootId : null;
            }
            return mmOk({
              addedNodeIds,
              rootId
            });
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
            runtimeContext.selectNodeInView(node);
          }
          try {
            const markdown = await runtimeContext.copyMapAsText(!!cut, false);
            return mmOk({
              markdown
            });
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
            return mmOk({
              nodeId: node.id,
              enabled: current
            });
          }
          runtimeContext.selectNodeInView(node);
          try {
            await runtimeContext.toggleSubmapRoot();
            const updated = findNodeById(node.id);
            return mmOk({
              nodeId: node.id,
              enabled: updated?.customData?.isAdditionalRoot === true
            });
          } catch (e) {
            return mmErr(MMError.OPERATION_FAILED, "toggleSubmapRoot failed", e);
          }
        },
        getMapConfig: (nodeId) => {
          const nodeRes = resolveNode(nodeId);
          if (!nodeRes.ok) return nodeRes;
          const node = nodeRes.data;
          const all = runtimeContext.ea.getViewElements();
          const info = runtimeContext.getHierarchy(node, all);
          const settingsRoot = runtimeContext.getSettingsRootNode(node, all);
          if (!settingsRoot) return mmErr(MMError.NO_ROOT, "Could not resolve settings root");
          return mmOk({
            rootId: info.rootId,
            settingsRootId: settingsRoot.id,
            config: extractMapConfig(settingsRoot)
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
            runtimeContext.selectNodeInView(node);
            const info = await runtimeContext.updateRootNodeCustomData(
              {
                ...patch
              },
              node
            );
            if (!info) return mmErr(MMError.OPERATION_FAILED, "Failed to update map config");
            if (relayout) await runtimeContext.refreshMapLayout(node);
            return mmOk({
              rootId: info.rootId,
              settingsRootId: info.settingsRootId
            });
          } catch (e) {
            return mmErr(MMError.OPERATION_FAILED, "setMapConfig failed", e);
          }
        },
        getBranchElementIds: ({
          nodeId,
          includeDecorations = true,
          includeCrosslinks = true
        } = {}) => {
          const viewErr = requireView();
          if (viewErr) return viewErr;
          if (!nodeId) return mmErr(MMError.INVALID_ARGUMENT, "getBranchElementIds requires nodeId");
          const node = findNodeById(nodeId);
          if (!node) return mmErr(MMError.INVALID_NODE, `Node not found: ${nodeId}`);
          const all = runtimeContext.ea.getViewElements();
          let ids = runtimeContext.getBranchElementIds(nodeId, all);
          if (includeDecorations || includeCrosslinks) {
            const info = runtimeContext.getHierarchy(node, all);
            const extras = runtimeContext.getDecorationAndCrossLinkIdsForBranches(
              ids,
              all,
              info.rootId
            );
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
          return mmOk({
            ids: Array.from(new Set(ids))
          });
        },
        getProjectElementIds: (rootId) => {
          const viewErr = requireView();
          if (viewErr) return viewErr;
          if (!rootId) return mmErr(MMError.INVALID_ARGUMENT, "getProjectElementIds requires rootId");
          const all = runtimeContext.ea.getViewElements();
          const root = all.find((e) => e.id === rootId);
          if (!root) return mmErr(MMError.INVALID_NODE, `Root not found: ${rootId}`);
          const project = runtimeContext.getMindmapProjectElements(rootId, all);
          return mmOk({
            ids: project.map((e) => e.id)
          });
        },
        getElementIdsByRole: (rootId) => {
          const viewErr = requireView();
          if (viewErr) return viewErr;
          if (!rootId) return mmErr(MMError.INVALID_ARGUMENT, "getElementIdsByRole requires rootId");
          const all = runtimeContext.ea.getViewElements();
          const root = all.find((e) => e.id === rootId);
          if (!root) return mmErr(MMError.INVALID_NODE, `Root not found: ${rootId}`);
          const branchIds = runtimeContext.getBranchElementIds(rootId, all);
          const decorationAndCrossLinkIds = runtimeContext.getDecorationAndCrossLinkIdsForBranches(
            branchIds,
            all,
            rootId
          );
          const project = runtimeContext.getMindmapProjectElements(rootId, all);
          const nodes = branchIds.map((id) => all.find((e) => e.id === id)).filter((e) => e && e.type !== "arrow" && !e.customData?.isBoundary).map((e) => e.id);
          const boundaries = project.filter((e) => e.customData?.isBoundary).map((e) => e.id);
          const branchArrows = project.filter((e) => e.type === "arrow" && e.customData?.isBranch).map((e) => e.id);
          const crossLinks = project.filter((e) => e.type === "arrow" && !e.customData?.isBranch).map((e) => e.id);
          const boundTexts = project.filter((e) => e.type === "text").filter((t) => {
            if (t.containerId) return true;
            return project.some((el) => el.boundElements?.some((be) => be.id === t.id));
          }).map((e) => e.id);
          const decorationSet = new Set(decorationAndCrossLinkIds);
          const roleSet = /* @__PURE__ */ new Set([
            ...nodes,
            ...boundaries,
            ...branchArrows,
            ...crossLinks,
            ...boundTexts
          ]);
          const decorations = project.filter(
            (e) => decorationSet.has(e.id) || !roleSet.has(e.id) && !branchIds.includes(e.id)
          ).filter((e) => !crossLinks.includes(e.id) && !boundaries.includes(e.id)).map((e) => e.id);
          return mmOk({
            nodes: Array.from(new Set(nodes)),
            branchArrows: Array.from(new Set(branchArrows)),
            crossLinks: Array.from(new Set(crossLinks)),
            boundaries: Array.from(new Set(boundaries)),
            decorations: Array.from(new Set(decorations)),
            boundTexts: Array.from(new Set(boundTexts))
          });
        },
        getGlobalConfig: () => {
          return mmOk({
            config: {
              growthMode: runtimeContext.currentModalGrowthMode,
              autoLayoutDisabled: runtimeContext.autoLayoutDisabled,
              arrowType: runtimeContext.arrowType,
              fontsizeScale: runtimeContext.fontsizeScale,
              multicolor: runtimeContext.multicolor,
              boxChildren: runtimeContext.boxChildren,
              roundedCorners: runtimeContext.roundedCorners,
              maxWrapWidth: runtimeContext.maxWidth,
              isSolidArrow: runtimeContext.isSolidArrow,
              centerText: runtimeContext.centerText,
              fillSweep: runtimeContext.fillSweep,
              branchScale: runtimeContext.branchScale,
              baseStrokeWidth: runtimeContext.baseStrokeWidth,
              customPalette: cloneJSON(runtimeContext.customPalette),
              layoutSettings: cloneJSON(runtimeContext.layoutSettings)
            }
          });
        },
        setGlobalConfig: async ({ patch } = {}) => {
          if (!patch || typeof patch !== "object") {
            return mmErr(MMError.INVALID_ARGUMENT, "setGlobalConfig requires a patch object");
          }
          try {
            let requiresSave = false;
            if (patch.growthMode && runtimeContext.GROWTH_TYPES.includes(patch.growthMode)) {
              runtimeContext.currentModalGrowthMode = patch.growthMode;
              runtimeContext.setVal(runtimeContext.K_GROWTH, patch.growthMode);
              requiresSave = true;
            }
            if (typeof patch.autoLayoutDisabled === "boolean") {
              runtimeContext.autoLayoutDisabled = patch.autoLayoutDisabled;
            }
            if (patch.arrowType && runtimeContext.ARROW_TYPES.includes(patch.arrowType)) {
              runtimeContext.arrowType = patch.arrowType;
              runtimeContext.setVal(runtimeContext.K_ARROW_TYPE, patch.arrowType);
              requiresSave = true;
            }
            if (patch.fontsizeScale && runtimeContext.FONT_SCALE_TYPES.includes(patch.fontsizeScale)) {
              runtimeContext.fontsizeScale = patch.fontsizeScale;
              runtimeContext.setVal(runtimeContext.K_FONTSIZE, patch.fontsizeScale);
              requiresSave = true;
            }
            if (patch.branchScale && runtimeContext.BRANCH_SCALE_TYPES.includes(patch.branchScale)) {
              runtimeContext.branchScale = patch.branchScale;
              runtimeContext.setVal(runtimeContext.K_BRANCH_SCALE, patch.branchScale);
              requiresSave = true;
            }
            if (typeof patch.multicolor === "boolean") {
              runtimeContext.multicolor = patch.multicolor;
              runtimeContext.setVal(runtimeContext.K_MULTICOLOR, patch.multicolor);
              requiresSave = true;
            }
            if (typeof patch.boxChildren === "boolean") {
              runtimeContext.boxChildren = patch.boxChildren;
              runtimeContext.setVal(runtimeContext.K_BOX, patch.boxChildren);
              requiresSave = true;
            }
            if (typeof patch.roundedCorners === "boolean") {
              runtimeContext.roundedCorners = patch.roundedCorners;
              runtimeContext.setVal(runtimeContext.K_ROUND, patch.roundedCorners);
              requiresSave = true;
            }
            if (typeof patch.maxWrapWidth === "number") {
              runtimeContext.maxWidth = patch.maxWrapWidth;
              runtimeContext.setVal(runtimeContext.K_WIDTH, patch.maxWrapWidth);
              requiresSave = true;
            }
            if (typeof patch.isSolidArrow === "boolean") {
              runtimeContext.isSolidArrow = patch.isSolidArrow;
              runtimeContext.setVal(runtimeContext.K_ARROWSTROKE, patch.isSolidArrow);
              requiresSave = true;
            }
            if (typeof patch.centerText === "boolean") {
              runtimeContext.centerText = patch.centerText;
              runtimeContext.setVal(runtimeContext.K_CENTERTEXT, patch.centerText);
              requiresSave = true;
            }
            if (typeof patch.fillSweep === "boolean") {
              runtimeContext.fillSweep = patch.fillSweep;
              runtimeContext.setVal(runtimeContext.K_FILL_SWEEP, patch.fillSweep);
              requiresSave = true;
            }
            if (typeof patch.baseStrokeWidth === "number") {
              runtimeContext.baseStrokeWidth = patch.baseStrokeWidth;
              runtimeContext.setVal(runtimeContext.K_BASE_WIDTH, patch.baseStrokeWidth);
              requiresSave = true;
            }
            if (patch.customPalette && typeof patch.customPalette === "object") {
              runtimeContext.customPalette = {
                ...runtimeContext.customPalette,
                ...patch.customPalette
              };
              runtimeContext.setVal(runtimeContext.K_PALETTE, runtimeContext.customPalette, true);
              requiresSave = true;
            }
            if (patch.layoutSettings && typeof patch.layoutSettings === "object") {
              runtimeContext.layoutSettings = {
                ...runtimeContext.layoutSettings,
                ...patch.layoutSettings
              };
              runtimeContext.setVal(runtimeContext.K_LAYOUT, runtimeContext.layoutSettings, true);
              requiresSave = true;
            }
            if (requiresSave) {
              await runtimeContext.saveSettings();
              runtimeContext.updateUI();
            }
            return mmOk({ success: true });
          } catch (e) {
            return mmErr(MMError.OPERATION_FAILED, "setGlobalConfig failed", e);
          }
        },
        getConfigSchema: () => {
          const schema = {
            growthMode: { type: "string", valueset: runtimeContext.GROWTH_TYPES },
            autoLayoutDisabled: { type: "boolean" },
            arrowType: { type: "string", valueset: runtimeContext.ARROW_TYPES },
            fontsizeScale: { type: "string", valueset: runtimeContext.FONT_SCALE_TYPES },
            branchScale: { type: "string", valueset: runtimeContext.BRANCH_SCALE_TYPES },
            multicolor: { type: "boolean" },
            boxChildren: { type: "boolean" },
            roundedCorners: { type: "boolean" },
            maxWrapWidth: { type: "number" },
            isSolidArrow: { type: "boolean" },
            centerText: { type: "boolean" },
            fillSweep: { type: "boolean" },
            baseStrokeWidth: { type: "number" },
            customPalette: {
              type: "object",
              properties: {
                enabled: { type: "boolean" },
                random: { type: "boolean" },
                colors: { type: "array", items: "string (hex color)" }
              }
            },
            layoutSettings: {}
          };
          Object.keys(runtimeContext.LAYOUT_METADATA).forEach((key) => {
            const meta = runtimeContext.LAYOUT_METADATA[key];
            schema.layoutSettings[key] = {
              type: "number",
              default: meta.def,
              min: meta.min,
              max: meta.max,
              step: meta.step,
              description: meta.desc
            };
          });
          return mmOk({ schema });
        }
      };
      window.MindMapBuilderAPI = API;
      console.log(
        "window.MindMapBuilderAPI initialized. For documentation visit: https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/docs/ea-script-docs/MindMapBuilderAPI.md",
        API
      );
    })();
  }

  // src/scripts/mindmap-builder/sidepanelLifecycle.js
  async function openMindmapSidepanel(runtimeContext) {
    return runtimeContext.ea.createSidepanelTab(runtimeContext.t("DOCK_TITLE"), true, true).then((tab) => {
      if (!tab) return;
      runtimeContext.registerStyles();
      tab.onWindowMigrated = (newWin) => {
        runtimeContext.cancelBranchPaste?.();
        runtimeContext.cancelHotkeyRecording?.();
        runtimeContext.linkSuggester?.close();
        runtimeContext.sidepanelWindow = newWin;
        if (!runtimeContext.isUndocked && runtimeContext.sidepanelWindow) {
          runtimeContext.registerKeydownHandler(
            runtimeContext.sidepanelWindow,
            runtimeContext.handleKeydown
          );
        }
      };
      tab.onExcalidrawViewClosed = () => {
        if (runtimeContext.isUndocked) {
          runtimeContext.toggleDock({
            silent: true,
            forceDock: true,
            saveSetting: false
          });
        }
      };
      tab.onOpen = () => {
        const contentEl = tab.contentEl;
        contentEl.classList.add("excalidraw-mindmap-ui");
        if (!contentEl.hasChildNodes()) {
          runtimeContext.renderHelp(contentEl);
          runtimeContext.inputContainer = contentEl.createDiv();
          runtimeContext.renderBody(contentEl);
          runtimeContext.sidepanelWindow = contentEl.ownerDocument.defaultView;
          if (runtimeContext.isUndocked) {
            runtimeContext.toggleDock({
              silent: true,
              forceDock: true,
              saveSetting: false
            });
          } else {
            runtimeContext.renderInput(runtimeContext.inputContainer, false);
          }
        }
        runtimeContext.ensureNodeSelected();
        runtimeContext.updateUI();
        runtimeContext.focusInputEl();
        if (runtimeContext.ea.activateMindmap) {
          runtimeContext.ea.activateMindmap = false;
          const undockPreference = runtimeContext.getVal(runtimeContext.K_UNDOCKED, false);
          if (undockPreference && !runtimeContext.isUndocked) {
            setTimeout(
              () => runtimeContext.toggleDock({
                saveSetting: false
              })
            );
          } else if (!undockPreference && runtimeContext.isUndocked) {
            setTimeout(
              () => runtimeContext.toggleDock({
                saveSetting: false
              })
            );
            tab.reveal();
          } else if (!undockPreference) {
            tab.reveal();
          }
        } else {
          setupEventListeners(runtimeContext.ea.targetView);
          if (!window.MindmapBuilder?.popObsidianHotkeyScope)
            runtimeContext.registerObsidianHotkeyOverrides();
        }
      };
      const setupEventListeners = (view) => {
        if (!view || !view.ownerWindow) return;
        window.MindmapBuilder?.removePointerDownHandler?.();
        const win = view.ownerWindow;
        win.addEventListener("pointerdown", runtimeContext.handleCanvasPointerDown);
        window.MindmapBuilder.removePointerDownHandler = () => {
          if (win) win.removeEventListener("pointerdown", runtimeContext.handleCanvasPointerDown);
          delete window.MindmapBuilder.removePointerDownHandler;
        };
        runtimeContext.updateKeyHandlerLocation();
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
        if (runtimeContext.ea.targetView !== view) {
          runtimeContext.mostRecentlySelectedNodeID = null;
          if (runtimeContext.ea.targetView)
            runtimeContext.removeEventListeners(runtimeContext.ea.targetView);
          runtimeContext.ea.setView(view);
          runtimeContext.ea.clear();
        }
        setupEventListeners(view);
        runtimeContext.watchPasteMetadata?.();
        runtimeContext.ensureNodeSelected();
        runtimeContext.updateUI();
      };
      tab.onFocus = (view) => onFocus(view);
      const onActiveLeafChange = (leaf) => {
        if (runtimeContext.cancelHotkeyRecording) runtimeContext.cancelHotkeyRecording();
        if (runtimeContext.ea.targetView !== leaf.view && runtimeContext.ea.isExcalidrawView(leaf.view)) {
          runtimeContext.mostRecentlySelectedNodeID = null;
          if (runtimeContext.ea.targetView)
            runtimeContext.removeEventListeners(runtimeContext.ea.targetView);
          runtimeContext.ea.setView(leaf.view);
          runtimeContext.ea.clear();
          setupEventListeners(leaf.view);
        }
        runtimeContext.registerObsidianHotkeyOverrides();
        if (!runtimeContext.isUndocked || !runtimeContext.floatingInputModal || !leaf) {
          return;
        }
        if (runtimeContext.ea.isExcalidrawView(leaf.view)) {
          runtimeContext.ensureNodeSelected();
          runtimeContext.updateUI();
          const { modalEl } = runtimeContext.floatingInputModal;
          if (runtimeContext.isExcaliBrainView()) {
            modalEl.style.display = "none";
          } else {
            if (modalEl.style.display === "none") {
              modalEl.style.display = "";
            }
          }
          if (runtimeContext.ea.targetView && modalEl.ownerDocument !== runtimeContext.ea.targetView.ownerDocument) {
            runtimeContext.ea.targetView.ownerDocument.body.appendChild(modalEl);
            runtimeContext.linkSuggester?.close();
            runtimeContext.linkSuggester = runtimeContext.ea.attachInlineLinkSuggester(
              runtimeContext.inputEl,
              runtimeContext.inputRow?.settingEl
            );
          }
          const { x, y } = runtimeContext.ea.targetView.contentEl.getBoundingClientRect();
          modalEl.style.top = `${y + 5}px`;
          modalEl.style.left = `${x + 5}px`;
        } else {
          if (leaf.view?.getViewType() === "excalidraw-sidepanel") return;
          const { modalEl } = runtimeContext.floatingInputModal;
          if (modalEl.style.display !== "none") {
            modalEl.style.display = "none";
          }
        }
      };
      tab.onClose = async () => {
        runtimeContext.disposeBranchPaste?.();
        runtimeContext.cancelHotkeyRecording?.();
        runtimeContext.linkSuggester?.close();
        runtimeContext.disposeKeyboard();
        runtimeContext.removeEventListeners();
        delete window.MindmapBuilder;
        delete window.MindMapBuilderAPI;
        runtimeContext.removeStyles();
        if (runtimeContext.floatingInputModal) {
          if (runtimeContext.floatingInputModal.modalEl && runtimeContext.floatingInputModal.modalEl.parentElement) {
            runtimeContext.floatingInputModal.modalEl.remove();
          }
          runtimeContext.floatingInputModal.close();
          runtimeContext.floatingInputModal = null;
        }
        await runtimeContext.saveSettings();
      };
      if (runtimeContext.ea.targetView) {
        setupEventListeners(runtimeContext.ea.targetView);
      }
      tab.open();
    });
  }

  // src/scripts/mindmap-builder/runtime.js
  async function initializeMindmapBuilder(ea2, utils2, VERSION2, t) {
    const { Notice } = ea2.obsidian;
    const runtimeContext = {
      get ACTION_ADD() {
        return ACTION_ADD;
      },
      get ACTION_ADD_FOLLOW() {
        return ACTION_ADD_FOLLOW;
      },
      get ACTION_ADD_FOLLOW_FOCUS() {
        return ACTION_ADD_FOLLOW_FOCUS;
      },
      get ACTION_ADD_FOLLOW_ZOOM() {
        return ACTION_ADD_FOLLOW_ZOOM;
      },
      get ACTION_ADD_SIBLING_AFTER() {
        return ACTION_ADD_SIBLING_AFTER;
      },
      get ACTION_ADD_SIBLING_BEFORE() {
        return ACTION_ADD_SIBLING_BEFORE;
      },
      get ACTION_BOX() {
        return ACTION_BOX;
      },
      get ACTION_CALENDAR() {
        return ACTION_CALENDAR;
      },
      get ACTION_COPY() {
        return ACTION_COPY;
      },
      get ACTION_CUT() {
        return ACTION_CUT;
      },
      get ACTION_DOCK_UNDOCK() {
        return ACTION_DOCK_UNDOCK;
      },
      get ACTION_EDIT() {
        return ACTION_EDIT;
      },
      get ACTION_FOCUS() {
        return ACTION_FOCUS;
      },
      get ACTION_FOLD() {
        return ACTION_FOLD;
      },
      get ACTION_FOLD_ALL() {
        return ACTION_FOLD_ALL;
      },
      get ACTION_FOLD_L1() {
        return ACTION_FOLD_L1;
      },
      get ACTION_HIDE() {
        return ACTION_HIDE;
      },
      get ACTION_IMPORT_OUTLINE() {
        return ACTION_IMPORT_OUTLINE;
      },
      get ACTION_NAVIGATE() {
        return ACTION_NAVIGATE;
      },
      get ACTION_NAVIGATE_FOCUS() {
        return ACTION_NAVIGATE_FOCUS;
      },
      get ACTION_NAVIGATE_ZOOM() {
        return ACTION_NAVIGATE_ZOOM;
      },
      get ACTION_PASTE() {
        return ACTION_PASTE;
      },
      get ACTION_PIN() {
        return ACTION_PIN;
      },
      get ACTION_REARRANGE() {
        return ACTION_REARRANGE;
      },
      get ACTION_REDO_Y() {
        return ACTION_REDO_Y;
      },
      get ACTION_REDO_Z() {
        return ACTION_REDO_Z;
      },
      get ACTION_SORT_ORDER() {
        return ACTION_SORT_ORDER;
      },
      get ACTION_TOGGLE_BOUNDARY() {
        return ACTION_TOGGLE_BOUNDARY;
      },
      get ACTION_TOGGLE_CHECKBOX() {
        return ACTION_TOGGLE_CHECKBOX;
      },
      get ACTION_TOGGLE_EMBED() {
        return ACTION_TOGGLE_EMBED;
      },
      get ACTION_TOGGLE_FLOATING_EXTRAS() {
        return ACTION_TOGGLE_FLOATING_EXTRAS;
      },
      get ACTION_TOGGLE_GROUP() {
        return ACTION_TOGGLE_GROUP;
      },
      get ACTION_TOGGLE_SUBMAP_ROOT() {
        return ACTION_TOGGLE_SUBMAP_ROOT;
      },
      get ACTION_UNDO() {
        return ACTION_UNDO;
      },
      get ACTION_ZOOM() {
        return ACTION_ZOOM;
      },
      get activePresetName() {
        return activePresetName;
      },
      set activePresetName(value) {
        activePresetName = value;
      },
      get addElementsToView() {
        return addElementsToView;
      },
      get addEmbeddableNode() {
        return addEmbeddableNode;
      },
      get addImage() {
        return addImage;
      },
      get addNode() {
        return addNode;
      },
      get addSibling() {
        return addSibling;
      },
      get addUpdateArrowLabel() {
        return addUpdateArrowLabel;
      },
      get api() {
        return api;
      },
      get applyPresetToGlobals() {
        return applyPresetToGlobals;
      },
      get applyPresetToMap() {
        return applyPresetToMap;
      },
      get applyRecursiveGrouping() {
        return applyRecursiveGrouping;
      },
      get ARROW_TYPES() {
        return ARROW_TYPES;
      },
      get arrowType() {
        return arrowType;
      },
      set arrowType(value) {
        arrowType = value;
      },
      get arrowTypeToggle() {
        return arrowTypeToggle;
      },
      set arrowTypeToggle(value) {
        arrowTypeToggle = value;
      },
      get autoLayoutDisabled() {
        return autoLayoutDisabled;
      },
      set autoLayoutDisabled(value) {
        autoLayoutDisabled = value;
      },
      get autoLayoutToggle() {
        return autoLayoutToggle;
      },
      set autoLayoutToggle(value) {
        autoLayoutToggle = value;
      },
      get baseStrokeWidth() {
        return baseStrokeWidth;
      },
      set baseStrokeWidth(value) {
        baseStrokeWidth = value;
      },
      get baseWidthSlider() {
        return baseWidthSlider;
      },
      set baseWidthSlider(value) {
        baseWidthSlider = value;
      },
      get bodyContainer() {
        return bodyContainer;
      },
      set bodyContainer(value) {
        bodyContainer = value;
      },
      get boundaryBtn() {
        return boundaryBtn;
      },
      set boundaryBtn(value) {
        boundaryBtn = value;
      },
      get boxBtn() {
        return boxBtn;
      },
      set boxBtn(value) {
        boxBtn = value;
      },
      get boxChildren() {
        return boxChildren;
      },
      set boxChildren(value) {
        boxChildren = value;
      },
      get boxToggle() {
        return boxToggle;
      },
      set boxToggle(value) {
        boxToggle = value;
      },
      get BRANCH_SCALE_TYPES() {
        return BRANCH_SCALE_TYPES;
      },
      get branchScale() {
        return branchScale;
      },
      set branchScale(value) {
        branchScale = value;
      },
      get branchScaleDropdown() {
        return branchScaleDropdown;
      },
      set branchScaleDropdown(value) {
        branchScaleDropdown = value;
      },
      get buildChildrenMap() {
        return buildChildrenMap;
      },
      get buildElementMap() {
        return buildElementMap;
      },
      get buildGroupToNodes() {
        return buildGroupToNodes;
      },
      get buildParentMap() {
        return buildParentMap;
      },
      get calculateStrokeWidth() {
        return calculateStrokeWidth;
      },
      get calendarBtn() {
        return calendarBtn;
      },
      set calendarBtn(value) {
        calendarBtn = value;
      },
      get cancelHotkeyRecording() {
        return cancelHotkeyRecording;
      },
      set cancelHotkeyRecording(value) {
        cancelHotkeyRecording = value;
      },
      get centerText() {
        return centerText;
      },
      set centerText(value) {
        centerText = value;
      },
      get centerToggle() {
        return centerToggle;
      },
      set centerToggle(value) {
        centerToggle = value;
      },
      get changeNodeOrder() {
        return changeNodeOrder;
      },
      get collectCrosslinkIds() {
        return collectCrosslinkIds;
      },
      get collectDecorationIds() {
        return collectDecorationIds;
      },
      get COLOR_CONTRAST_MIN() {
        return COLOR_CONTRAST_MIN;
      },
      get COLOR_DISTINCT_THRESHOLD() {
        return COLOR_DISTINCT_THRESHOLD;
      },
      get colorToggle() {
        return colorToggle;
      },
      set colorToggle(value) {
        colorToggle = value;
      },
      get commitEdit() {
        return commitEdit;
      },
      get configureArrow() {
        return configureArrow;
      },
      get copyBtn() {
        return copyBtn;
      },
      set copyBtn(value) {
        copyBtn = value;
      },
      get copyMapAsText() {
        return copyMapAsText;
      },
      get currentModalGrowthMode() {
        return currentModalGrowthMode;
      },
      set currentModalGrowthMode(value) {
        currentModalGrowthMode = value;
      },
      get currentTransactionAccumulator() {
        return currentTransactionAccumulator;
      },
      set currentTransactionAccumulator(value) {
        currentTransactionAccumulator = value;
      },
      get customPalette() {
        return customPalette;
      },
      set customPalette(value) {
        customPalette = value;
      },
      get cutBtn() {
        return cutBtn;
      },
      set cutBtn(value) {
        cutBtn = value;
      },
      get DEFAULT_HOTKEYS() {
        return DEFAULT_HOTKEYS;
      },
      get detailsEl() {
        return detailsEl;
      },
      set detailsEl(value) {
        detailsEl = value;
      },
      get diffMapConfig() {
        return diffMapConfig;
      },
      get dirty() {
        return dirty;
      },
      set dirty(value) {
        dirty = value;
      },
      get disableTabEvents() {
        return disableTabEvents;
      },
      set disableTabEvents(value) {
        disableTabEvents = value;
      },
      get dockBtn() {
        return dockBtn;
      },
      set dockBtn(value) {
        dockBtn = value;
      },
      get ea() {
        return ea2;
      },
      get editBtn() {
        return editBtn;
      },
      set editBtn(value) {
        editBtn = value;
      },
      get editingNodeId() {
        return editingNodeId;
      },
      set editingNodeId(value) {
        editingNodeId = value;
      },
      get EMBEDED_OBJECT_WIDTH_CHILD() {
        return EMBEDED_OBJECT_WIDTH_CHILD;
      },
      get EMBEDED_OBJECT_WIDTH_ROOT() {
        return EMBEDED_OBJECT_WIDTH_ROOT;
      },
      get ensureNodeSelected() {
        return ensureNodeSelected;
      },
      get extractConfigFromGlobals() {
        return extractConfigFromGlobals;
      },
      get fillSweep() {
        return fillSweep;
      },
      set fillSweep(value) {
        fillSweep = value;
      },
      get fillSweepToggle() {
        return fillSweepToggle;
      },
      set fillSweepToggle(value) {
        fillSweepToggle = value;
      },
      get fillSweepToggleSetting() {
        return fillSweepToggleSetting;
      },
      set fillSweepToggleSetting(value) {
        fillSweepToggleSetting = value;
      },
      get FLOAT_MODAL_MAX_HEIGHT() {
        return FLOAT_MODAL_MAX_HEIGHT;
      },
      get FLOAT_MODAL_OFFSET() {
        return FLOAT_MODAL_OFFSET;
      },
      get FLOAT_MODAL_OPACITY() {
        return FLOAT_MODAL_OPACITY;
      },
      get floatingBoxBtn() {
        return floatingBoxBtn;
      },
      set floatingBoxBtn(value) {
        floatingBoxBtn = value;
      },
      get floatingGroupBtn() {
        return floatingGroupBtn;
      },
      set floatingGroupBtn(value) {
        floatingGroupBtn = value;
      },
      get floatingInputModal() {
        return floatingInputModal;
      },
      set floatingInputModal(value) {
        floatingInputModal = value;
      },
      get floatingZoomBtn() {
        return floatingZoomBtn;
      },
      set floatingZoomBtn(value) {
        floatingZoomBtn = value;
      },
      get focusBtn() {
        return focusBtn;
      },
      set focusBtn(value) {
        focusBtn = value;
      },
      get focusInputEl() {
        return focusInputEl;
      },
      get focusSelected() {
        return focusSelected;
      },
      get foldBtnAll() {
        return foldBtnAll;
      },
      set foldBtnAll(value) {
        foldBtnAll = value;
      },
      get foldBtnL0() {
        return foldBtnL0;
      },
      set foldBtnL0(value) {
        foldBtnL0 = value;
      },
      get foldBtnL1() {
        return foldBtnL1;
      },
      set foldBtnL1(value) {
        foldBtnL1 = value;
      },
      get FONT_SCALE_TYPES() {
        return FONT_SCALE_TYPES;
      },
      get fontSizeDropdown() {
        return fontSizeDropdown;
      },
      set fontSizeDropdown(value) {
        fontSizeDropdown = value;
      },
      get fontsizeScale() {
        return fontsizeScale;
      },
      set fontsizeScale(value) {
        fontsizeScale = value;
      },
      get generateRuntimeHotkeys() {
        return generateRuntimeHotkeys;
      },
      get getActionHotkeyString() {
        return getActionHotkeyString;
      },
      get getActionLabel() {
        return getActionLabel;
      },
      get getAdjustedMaxWidth() {
        return getAdjustedMaxWidth;
      },
      get getAngleFromCenter() {
        return getAngleFromCenter;
      },
      get getAppState() {
        return getAppState;
      },
      get getBoundaryHost() {
        return getBoundaryHost;
      },
      get getBranchElementIds() {
        return getBranchElementIds;
      },
      get getChildrenNodes() {
        return getChildrenNodes;
      },
      get getCommonGroupForElements() {
        return getCommonGroupForElements;
      },
      get getDecorationAndCrossLinkIdsForBranches() {
        return getDecorationAndCrossLinkIdsForBranches;
      },
      get getDepthFromAncestor() {
        return getDepthFromAncestor;
      },
      get getDynamicColor() {
        return getDynamicColor;
      },
      get getFontScale() {
        return getFontScale;
      },
      get getHierarchy() {
        return getHierarchy;
      },
      get getHotkeyDisplayString() {
        return getHotkeyDisplayString;
      },
      get getMasterRoots() {
        return getMasterRoots;
      },
      get getMindmapNodeFromSelection() {
        return getMindmapNodeFromSelection;
      },
      get getMindmapOrder() {
        return getMindmapOrder;
      },
      get getMindmapProjectElements() {
        return getMindmapProjectElements;
      },
      get getMostRecentlyAddedNode() {
        return getMostRecentlyAddedNode;
      },
      get getNodeBox() {
        return getNodeBox;
      },
      get getNodeMarkdownFile() {
        return getNodeMarkdownFile;
      },
      get getObsidianConflict() {
        return getObsidianConflict;
      },
      get getParentNode() {
        return getParentNode;
      },
      get getRootConfigForNode() {
        return getRootConfigForNode;
      },
      get getSettingsRootNode() {
        return getSettingsRootNode;
      },
      get initializeRootCustomData() {
        return initializeRootCustomData;
      },
      get updateBranchVisibility() {
        return updateBranchVisibility;
      },
      get getStrokeWidthForDepth() {
        return getStrokeWidthForDepth;
      },
      get getStructuralGroup() {
        return getStructuralGroup;
      },
      get getStructuralGroupForNode() {
        return getStructuralGroupForNode;
      },
      get getSubtreeHeight() {
        return getSubtreeHeight;
      },
      get getSubtreeWidth() {
        return getSubtreeWidth;
      },
      get getTextFromNode() {
        return getTextFromNode;
      },
      get getVal() {
        return getVal;
      },
      get getVerticalPlacementWidth() {
        return getVerticalPlacementWidth;
      },
      get getZoom() {
        return getZoom;
      },
      get groupBranches() {
        return groupBranches;
      },
      set groupBranches(value) {
        groupBranches = value;
      },
      get GROWTH_TYPES() {
        return GROWTH_TYPES;
      },
      get handleCanvasPointerDown() {
        return handleCanvasPointerDown;
      },
      get handleKeydown() {
        return handleKeydown;
      },
      get helpContainer() {
        return helpContainer;
      },
      set helpContainer(value) {
        helpContainer = value;
      },
      get HUE_STEP_BASE() {
        return HUE_STEP_BASE;
      },
      get HUE_STEP_JITTER() {
        return HUE_STEP_JITTER;
      },
      get ignoreFocusChanges() {
        return ignoreFocusChanges;
      },
      set ignoreFocusChanges(value) {
        ignoreFocusChanges = value;
      },
      get IMAGE_TYPES() {
        return IMAGE_TYPES;
      },
      get importOutline() {
        return importOutline;
      },
      get importOutlineBtn() {
        return importOutlineBtn;
      },
      set importOutlineBtn(value) {
        importOutlineBtn = value;
      },
      get importTextToMap() {
        return importTextToMap;
      },
      get inferDirectionalGrowthMode() {
        return inferDirectionalGrowthMode;
      },
      get injectNodeLink() {
        return injectNodeLink;
      },
      set injectNodeLink(value) {
        injectNodeLink = value;
      },
      get inputContainer() {
        return inputContainer;
      },
      set inputContainer(value) {
        inputContainer = value;
      },
      get ontologyEl() {
        return ontologyEl;
      },
      set ontologyEl(value) {
        ontologyEl = value;
      },
      get inputEl() {
        return inputEl;
      },
      set inputEl(value) {
        inputEl = value;
      },
      get inputRow() {
        return inputRow;
      },
      set inputRow(value) {
        inputRow = value;
      },
      get isExcaliBrainView() {
        return isExcaliBrainView;
      },
      get isFloatingPanelExpanded() {
        return isFloatingPanelExpanded;
      },
      set isFloatingPanelExpanded(value) {
        isFloatingPanelExpanded = value;
      },
      get isMac() {
        return isMac;
      },
      get isMindmapGroup() {
        return isMindmapGroup;
      },
      get isOntologyFocused() {
        return isOntologyFocused;
      },
      set isOntologyFocused(value) {
        isOntologyFocused = value;
      },
      get isRecordingHotkey() {
        return isRecordingHotkey;
      },
      set isRecordingHotkey(value) {
        isRecordingHotkey = value;
      },
      get isSolidArrow() {
        return isSolidArrow;
      },
      set isSolidArrow(value) {
        isSolidArrow = value;
      },
      get isStructuralElement() {
        return isStructuralElement;
      },
      get isUndocked() {
        return isUndocked;
      },
      set isUndocked(value) {
        isUndocked = value;
      },
      get isViewSet() {
        return isViewSet;
      },
      get K_ACTIVE_PRESET() {
        return K_ACTIVE_PRESET;
      },
      get K_ARROW_TYPE() {
        return K_ARROW_TYPE;
      },
      get K_ARROWSTROKE() {
        return K_ARROWSTROKE;
      },
      get K_BASE_WIDTH() {
        return K_BASE_WIDTH;
      },
      get K_BOX() {
        return K_BOX;
      },
      get K_BRANCH_SCALE() {
        return K_BRANCH_SCALE;
      },
      get K_CENTERTEXT() {
        return K_CENTERTEXT;
      },
      get K_FILL_SWEEP() {
        return K_FILL_SWEEP;
      },
      get K_FONTSIZE() {
        return K_FONTSIZE;
      },
      get K_GROUP() {
        return K_GROUP;
      },
      get K_GROWTH() {
        return K_GROWTH;
      },
      get K_HOTKEYS() {
        return K_HOTKEYS;
      },
      get K_INJECT_LINK() {
        return K_INJECT_LINK;
      },
      get K_LAYOUT() {
        return K_LAYOUT;
      },
      get K_LINK_ALIAS() {
        return K_LINK_ALIAS;
      },
      get K_MULTICOLOR() {
        return K_MULTICOLOR;
      },
      get K_PALETTE() {
        return K_PALETTE;
      },
      get K_PRESETS() {
        return K_PRESETS;
      },
      get K_ROUND() {
        return K_ROUND;
      },
      get K_UNDOCKED() {
        return K_UNDOCKED;
      },
      get K_WIDTH() {
        return K_WIDTH;
      },
      get K_ZOOM() {
        return K_ZOOM;
      },
      get lastCommittedTransaction() {
        return lastCommittedTransaction;
      },
      set lastCommittedTransaction(value) {
        lastCommittedTransaction = value;
      },
      get lastFocusedInput() {
        return lastFocusedInput;
      },
      set lastFocusedInput(value) {
        lastFocusedInput = value;
      },
      get LAYOUT_DEFAULTS() {
        return LAYOUT_DEFAULTS;
      },
      get LAYOUT_METADATA() {
        return LAYOUT_METADATA;
      },
      get layoutChildrenAsAdditionalRoot() {
        return layoutChildrenAsAdditionalRoot;
      },
      get LayoutConfigModal() {
        return LayoutConfigModal;
      },
      get layoutL1Nodes() {
        return layoutL1Nodes;
      },
      get layoutSettings() {
        return layoutSettings;
      },
      set layoutSettings(value) {
        layoutSettings = value;
      },
      get layoutSubtree() {
        return layoutSubtree;
      },
      get layoutSubtreeVertical() {
        return layoutSubtreeVertical;
      },
      get LIGHT_BASE_DARK() {
        return LIGHT_BASE_DARK;
      },
      get LIGHT_BASE_LIGHT() {
        return LIGHT_BASE_LIGHT;
      },
      get LIGHT_JITTER_DARK() {
        return LIGHT_JITTER_DARK;
      },
      get LIGHT_JITTER_LIGHT() {
        return LIGHT_JITTER_LIGHT;
      },
      get linkSuggester() {
        return linkSuggester;
      },
      set linkSuggester(value) {
        linkSuggester = value;
      },
      get MAP_ROOT_CUSTOMDATA_KEYS() {
        return MAP_ROOT_CUSTOMDATA_KEYS;
      },
      get mapPresets() {
        return mapPresets;
      },
      set mapPresets(value) {
        mapPresets = value;
      },
      get maxWidth() {
        return maxWidth;
      },
      set maxWidth(value) {
        maxWidth = value;
      },
      get MINDMAP_FOCUS_STYLE_ID() {
        return MINDMAP_FOCUS_STYLE_ID;
      },
      get mostRecentlyAddedNodeID() {
        return mostRecentlyAddedNodeID;
      },
      set mostRecentlyAddedNodeID(value) {
        mostRecentlyAddedNodeID = value;
      },
      get mostRecentlySelectedNodeID() {
        return mostRecentlySelectedNodeID;
      },
      set mostRecentlySelectedNodeID(value) {
        mostRecentlySelectedNodeID = value;
      },
      get moveCrossLinks() {
        return moveCrossLinks;
      },
      get moveDecorations() {
        return moveDecorations;
      },
      get multicolor() {
        return multicolor;
      },
      set multicolor(value) {
        multicolor = value;
      },
      get navigateMap() {
        return navigateMap;
      },
      get nodeLinkAlias() {
        return nodeLinkAlias;
      },
      set nodeLinkAlias(value) {
        nodeLinkAlias = value;
      },
      get Notice() {
        return Notice;
      },
      get NOTICE_DURATION_CONFLICT() {
        return NOTICE_DURATION_CONFLICT;
      },
      get NOTICE_DURATION_GLOBAL_CONFLICT() {
        return NOTICE_DURATION_GLOBAL_CONFLICT;
      },
      get openCalendarModal() {
        return openCalendarModal;
      },
      get padding() {
        return padding;
      },
      get PaletteManagerModal() {
        return PaletteManagerModal;
      },
      get panelExpandBtn() {
        return panelExpandBtn;
      },
      set panelExpandBtn(value) {
        panelExpandBtn = value;
      },
      get parseEmbeddableInput() {
        return parseEmbeddableInput;
      },
      get parseImageInput() {
        return parseImageInput;
      },
      get parseText() {
        return parseText;
      },
      get pasteElementToMap() {
        return pasteElementToMap;
      },
      get cancelBranchPaste() {
        return cancelBranchPaste;
      },
      get disposeBranchPaste() {
        return disposeBranchPaste;
      },
      get watchPasteMetadata() {
        return watchPasteMetadata;
      },
      get isBranchPasteBusy() {
        return isBranchPasteBusy;
      },
      get performAction() {
        return performAction;
      },
      get pinBtn() {
        return pinBtn;
      },
      set pinBtn(value) {
        pinBtn = value;
      },
      get presetApplyBtn() {
        return presetApplyBtn;
      },
      set presetApplyBtn(value) {
        presetApplyBtn = value;
      },
      get presetDropdown() {
        return presetDropdown;
      },
      set presetDropdown(value) {
        presetDropdown = value;
      },
      get presetPlusBtn() {
        return presetPlusBtn;
      },
      set presetPlusBtn(value) {
        presetPlusBtn = value;
      },
      get presetSaveBtn() {
        return presetSaveBtn;
      },
      set presetSaveBtn(value) {
        presetSaveBtn = value;
      },
      get presetTrashBtn() {
        return presetTrashBtn;
      },
      set presetTrashBtn(value) {
        presetTrashBtn = value;
      },
      get presetWarningEl() {
        return presetWarningEl;
      },
      set presetWarningEl(value) {
        presetWarningEl = value;
      },
      get reconnectArrow() {
        return reconnectArrow;
      },
      get redoAvailable() {
        return redoAvailable;
      },
      set redoAvailable(value) {
        redoAvailable = value;
      },
      get refreshBtn() {
        return refreshBtn;
      },
      set refreshBtn(value) {
        refreshBtn = value;
      },
      get refreshMapLayout() {
        return refreshMapLayout;
      },
      get refreshPresetDropdown() {
        return refreshPresetDropdown;
      },
      get registerKeydownHandler() {
        return registerKeydownHandler;
      },
      get registerObsidianHotkeyOverrides() {
        return registerObsidianHotkeyOverrides;
      },
      get removeObsidianHotkeyOverrides() {
        return removeObsidianHotkeyOverrides;
      },
      get disposeKeyboard() {
        return disposeKeyboard;
      },
      get registerStyles() {
        return registerStyles;
      },
      get removeEventListeners() {
        return removeEventListeners;
      },
      get removeGroupFromElements() {
        return removeGroupFromElements;
      },
      get removeKeydownHandlers() {
        return removeKeydownHandlers;
      },
      get removeStyles() {
        return removeStyles;
      },
      get renderBody() {
        return renderBody;
      },
      get renderHelp() {
        return renderHelp;
      },
      get renderInput() {
        return renderInput;
      },
      get revealInputEl() {
        return revealInputEl;
      },
      get roundedCorners() {
        return roundedCorners;
      },
      set roundedCorners(value) {
        roundedCorners = value;
      },
      get roundToggle() {
        return roundToggle;
      },
      set roundToggle(value) {
        roundToggle = value;
      },
      get RUNTIME_HOTKEYS() {
        return RUNTIME_HOTKEYS;
      },
      set RUNTIME_HOTKEYS(value) {
        RUNTIME_HOTKEYS = value;
      },
      get SAT_BASE() {
        return SAT_BASE;
      },
      get SAT_JITTER() {
        return SAT_JITTER;
      },
      get saveSettings() {
        return saveSettings;
      },
      get scaleDecorations() {
        return scaleDecorations;
      },
      get SCOPE() {
        return SCOPE;
      },
      get selectNodeInView() {
        return selectNodeInView;
      },
      get setVal() {
        return setVal;
      },
      get sidepanelWindow() {
        return sidepanelWindow;
      },
      set sidepanelWindow(value) {
        sidepanelWindow = value;
      },
      get sortChildrenStable() {
        return sortChildrenStable;
      },
      get sortL1NodesBasedOnVisualSequence() {
        return sortL1NodesBasedOnVisualSequence;
      },
      get startEditing() {
        return startEditing;
      },
      get storedZoom() {
        return storedZoom;
      },
      set storedZoom(value) {
        storedZoom = value;
      },
      get strategyDropdown() {
        return strategyDropdown;
      },
      set strategyDropdown(value) {
        strategyDropdown = value;
      },
      get strokeToggle() {
        return strokeToggle;
      },
      set strokeToggle(value) {
        strokeToggle = value;
      },
      get submapRootBtn() {
        return submapRootBtn;
      },
      set submapRootBtn(value) {
        submapRootBtn = value;
      },
      get t() {
        return t;
      },
      get toggleBoundary() {
        return toggleBoundary;
      },
      get toggleBox() {
        return toggleBox;
      },
      get toggleBranchGroup() {
        return toggleBranchGroup;
      },
      get toggleCheckboxBtn() {
        return toggleCheckboxBtn;
      },
      set toggleCheckboxBtn(value) {
        toggleCheckboxBtn = value;
      },
      get toggleCheckboxStatus() {
        return toggleCheckboxStatus;
      },
      get toggleDock() {
        return toggleDock;
      },
      get toggleEmbedBtn() {
        return toggleEmbedBtn;
      },
      set toggleEmbedBtn(value) {
        toggleEmbedBtn = value;
      },
      get toggleEmbedStatus() {
        return toggleEmbedStatus;
      },
      get toggleFloatingExtras() {
        return toggleFloatingExtras;
      },
      set toggleFloatingExtras(value) {
        toggleFloatingExtras = value;
      },
      get toggleFold() {
        return toggleFold;
      },
      get toggleGroupBtn() {
        return toggleGroupBtn;
      },
      set toggleGroupBtn(value) {
        toggleGroupBtn = value;
      },
      get togglePin() {
        return togglePin;
      },
      get toggleSubmapRoot() {
        return toggleSubmapRoot;
      },
      get triggerGlobalLayout() {
        return triggerGlobalLayout;
      },
      get uiUpdateTimer() {
        return uiUpdateTimer;
      },
      set uiUpdateTimer(value) {
        uiUpdateTimer = value;
      },
      get updateBranchStrokes() {
        return updateBranchStrokes;
      },
      get updateKeyHandlerLocation() {
        return updateKeyHandlerLocation;
      },
      get updateL1Arrow() {
        return updateL1Arrow;
      },
      get updateNodeBoundary() {
        return updateNodeBoundary;
      },
      get updateRootNodeCustomData() {
        return updateRootNodeCustomData;
      },
      get updateUI() {
        return updateUI;
      },
      get userHotkeys() {
        return userHotkeys;
      },
      set userHotkeys(value) {
        userHotkeys = value;
      },
      get utils() {
        return utils2;
      },
      get VERSION() {
        return VERSION2;
      },
      get widthSlider() {
        return widthSlider;
      },
      set widthSlider(value) {
        widthSlider = value;
      },
      get withRootLayoutContext() {
        return withRootLayoutContext;
      },
      get WRAP_WIDTH_MAX() {
        return WRAP_WIDTH_MAX;
      },
      get WRAP_WIDTH_MIN() {
        return WRAP_WIDTH_MIN;
      },
      get WRAP_WIDTH_STEP() {
        return WRAP_WIDTH_STEP;
      },
      get ZOOM_LEVELS() {
        return ZOOM_LEVELS;
      },
      get ZOOM_TYPES() {
        return ZOOM_TYPES;
      },
      get zoomBtn() {
        return zoomBtn;
      },
      set zoomBtn(value) {
        zoomBtn = value;
      },
      get zoomLevel() {
        return zoomLevel;
      },
      set zoomLevel(value) {
        zoomLevel = value;
      },
      get zoomToFit() {
        return zoomToFit;
      }
    };
    const { removeKeydownHandlers, removeEventListeners, handleCanvasPointerDown } = createLifecycle(runtimeContext);
    if (!window.MindmapBuilder) {
      window.MindmapBuilder = {
        keydownHandlers: []
      };
    } else {
      removeEventListeners();
    }
    const api = () => ea2?.getExcalidrawAPI();
    const getAppState = () => api()?.getAppState();
    const isViewSet = () => ea2.targetView && ea2.targetView._loaded;
    const {
      VALUE_SETS,
      FONT_SCALE_TYPES,
      GROWTH_TYPES,
      ZOOM_TYPES,
      SCOPE,
      ARROW_TYPES,
      BRANCH_SCALE_TYPES,
      ZOOM_LEVELS,
      K_WIDTH,
      K_FONTSIZE,
      K_BOX,
      K_ROUND,
      K_BRANCH_SCALE,
      K_BASE_WIDTH,
      K_GROWTH,
      K_MULTICOLOR,
      K_UNDOCKED,
      K_GROUP,
      K_ARROWSTROKE,
      K_CENTERTEXT,
      K_ZOOM,
      K_HOTKEYS,
      K_PALETTE,
      K_LAYOUT,
      K_ARROW_TYPE,
      K_FILL_SWEEP,
      K_INJECT_LINK,
      K_LINK_ALIAS,
      K_PRESETS,
      K_ACTIVE_PRESET,
      LAYOUT_METADATA,
      COLOR_CONTRAST_MIN,
      COLOR_DISTINCT_THRESHOLD,
      HUE_STEP_BASE,
      HUE_STEP_JITTER,
      SAT_BASE,
      SAT_JITTER,
      LIGHT_BASE_DARK,
      LIGHT_JITTER_DARK,
      LIGHT_BASE_LIGHT,
      LIGHT_JITTER_LIGHT,
      WRAP_WIDTH_MIN,
      WRAP_WIDTH_MAX,
      WRAP_WIDTH_STEP,
      FLOAT_MODAL_OPACITY,
      FLOAT_MODAL_OFFSET,
      FLOAT_MODAL_MAX_HEIGHT,
      NOTICE_DURATION_CONFLICT,
      NOTICE_DURATION_GLOBAL_CONFLICT,
      LAYOUT_DEFAULTS,
      IMAGE_TYPES,
      EMBEDED_OBJECT_WIDTH_ROOT,
      EMBEDED_OBJECT_WIDTH_CHILD,
      ACTION_ADD,
      ACTION_ADD_SIBLING_AFTER,
      ACTION_ADD_SIBLING_BEFORE,
      ACTION_ADD_FOLLOW,
      ACTION_ADD_FOLLOW_FOCUS,
      ACTION_ADD_FOLLOW_ZOOM,
      ACTION_SORT_ORDER,
      ACTION_EDIT,
      ACTION_TOGGLE_CHECKBOX,
      ACTION_CALENDAR,
      ACTION_PIN,
      ACTION_BOX,
      ACTION_TOGGLE_GROUP,
      ACTION_COPY,
      ACTION_CUT,
      ACTION_PASTE,
      ACTION_IMPORT_OUTLINE,
      ACTION_ZOOM,
      ACTION_FOCUS,
      ACTION_NAVIGATE,
      ACTION_NAVIGATE_ZOOM,
      ACTION_NAVIGATE_FOCUS,
      ACTION_FOLD,
      ACTION_FOLD_L1,
      ACTION_FOLD_ALL,
      ACTION_TOGGLE_BOUNDARY,
      ACTION_TOGGLE_SUBMAP_ROOT,
      ACTION_TOGGLE_EMBED,
      ACTION_DOCK_UNDOCK,
      ACTION_HIDE,
      ACTION_REARRANGE,
      ACTION_TOGGLE_FLOATING_EXTRAS,
      ACTION_UNDO,
      ACTION_REDO_Z,
      ACTION_REDO_Y,
      ACTION_LABEL_KEYS,
      DEFAULT_HOTKEYS,
      MAP_ROOT_CUSTOMDATA_KEYS,
      MINDMAP_FOCUS_STYLE_ID
    } = createConfiguration(runtimeContext);
    const {
      getZoom,
      fontScale,
      getFontScale,
      getVal,
      saveSettings,
      setVal,
      extractConfigFromGlobals,
      normalizeMapConfig,
      diffMapConfig,
      applyPresetToGlobals,
      applyPresetToMap,
      refreshPresetDropdown,
      calculateStrokeWidth,
      getStrokeWidthForDepth,
      inferDirectionalGrowthMode,
      getRootConfigForNode,
      withRootLayoutContext,
      updateRootNodeCustomData,
      updateBranchStrokes
    } = createSettings(runtimeContext);
    let dirty = false;
    let injectNodeLink = getVal(K_INJECT_LINK, true);
    let nodeLinkAlias = getVal(K_LINK_ALIAS, "(\u2026)");
    const isExcaliBrainView = () => {
      if (!ea2.targetView || !ea2.targetView.file) return false;
      const eb = app.plugins.plugins["excalibrain"];
      return eb && eb.settings?.excalibrainFilepath === ea2.targetView.file.path;
    };
    let layoutSettings = getVal(K_LAYOUT, {
      value: {},
      hidden: true
    });
    let layoutSettingsDirty = false;
    Object.keys(LAYOUT_METADATA).forEach((k) => {
      const val = layoutSettings[k];
      const def = LAYOUT_METADATA[k].def;
      if (val === void 0 || val === null || typeof val !== "number" || !Number.isFinite(val)) {
        layoutSettings[k] = def;
        layoutSettingsDirty = true;
      }
    });
    if (layoutSettingsDirty) {
      setVal(K_LAYOUT, layoutSettings, true);
    }
    let arrowType = getVal(K_ARROW_TYPE, {
      value: "curved",
      valueset: ARROW_TYPES
    });
    let maxWidth = parseInt(getVal(K_WIDTH, 450));
    if (isNaN(maxWidth)) maxWidth = 450;
    let fontsizeScale = getVal(K_FONTSIZE, {
      value: "Normal Scale",
      valueset: FONT_SCALE_TYPES
    });
    let boxChildren = getVal(K_BOX, false);
    let roundedCorners = getVal(K_ROUND, false);
    let multicolor = getVal(K_MULTICOLOR, true);
    let groupBranches = getVal(K_GROUP, false);
    let currentModalGrowthMode = getVal(K_GROWTH, {
      value: "Right-Left",
      valueset: GROWTH_TYPES
    });
    let isUndocked = getVal(K_UNDOCKED, false);
    let isSolidArrow = getVal(K_ARROWSTROKE, true);
    let centerText = getVal(K_CENTERTEXT, true);
    let autoLayoutDisabled = false;
    let zoomLevel = getVal(K_ZOOM, {
      value: "Medium",
      valueset: ZOOM_TYPES
    });
    let customPalette = getVal(K_PALETTE, {
      value: {
        enabled: false,
        random: false,
        colors: []
      },
      hidden: true
    });
    let fillSweep = getVal(K_FILL_SWEEP, false);
    let editingNodeId = null;
    let mostRecentlySelectedNodeID = null;
    let currentTransactionAccumulator = 0;
    let lastCommittedTransaction = null;
    let redoAvailable = null;
    if (!ea2.getScriptSettingValue(K_FONTSIZE, {
      value: "Normal Scale",
      valueset: FONT_SCALE_TYPES
    }).hasOwnProperty("valueset")) {
      ea2.setScriptSettingValue(K_FONTSIZE, {
        value: fontsizeScale,
        valueset: FONT_SCALE_TYPES
      });
      dirty = true;
    }
    if (!ea2.getScriptSettingValue(K_GROWTH, {
      value: "Right-Left",
      valueset: GROWTH_TYPES
    }).hasOwnProperty("valueset")) {
      ea2.setScriptSettingValue(K_GROWTH, {
        value: currentModalGrowthMode,
        valueset: GROWTH_TYPES
      });
      dirty = true;
    }
    const settingsTemp = ea2.getScriptSettings();
    if (settingsTemp && settingsTemp.hasOwnProperty("Is Minimized")) {
      delete settingsTemp["Is Minimized"];
      dirty = true;
    }
    let branchScale = getVal(K_BRANCH_SCALE, {
      value: "Hierarchical",
      valueset: BRANCH_SCALE_TYPES
    });
    let baseStrokeWidth = parseFloat(
      getVal(K_BASE_WIDTH, {
        value: 6
      })
    );
    if (isNaN(baseStrokeWidth)) baseStrokeWidth = 6;
    Object.keys(LAYOUT_METADATA).forEach((k) => LAYOUT_DEFAULTS[k] = LAYOUT_METADATA[k].def);
    let mapPresets = getVal(K_PRESETS, {
      value: {
        Default: extractConfigFromGlobals()
      },
      hidden: true
    });
    if (!mapPresets || typeof mapPresets !== "object") {
      mapPresets = {};
    }
    let activePresetName = getVal(K_ACTIVE_PRESET, "Default");
    if (!mapPresets["Default"]) {
      mapPresets["Default"] = extractConfigFromGlobals();
      setVal(K_PRESETS, mapPresets, true);
    }
    const ownerWindow = ea2.targetView?.ownerWindow;
    const isMac = ea2.DEVICE.isMacOS || ea2.DEVICE.isIOS;
    const {
      trimText,
      parseText,
      parseImageInput,
      parseEmbeddableInput,
      getAdjustedMaxWidth,
      getNodeMarkdownFile,
      getTextFromNode
    } = createTextParsing(runtimeContext);
    const getActionLabel = (action) => t(ACTION_LABEL_KEYS[action] ?? action);
    let userHotkeys = getVal(K_HOTKEYS, {
      value: JSON.parse(JSON.stringify(DEFAULT_HOTKEYS)),
      hidden: true
    });
    let isRecordingHotkey = false;
    let cancelHotkeyRecording = null;
    const {
      getObsidianConflict,
      updateUserHotkeys,
      getHotkeyDefByAction,
      getHotkeyDisplayString,
      getActionHotkeyString,
      generateRuntimeHotkeys,
      getHotkeyContext,
      registerKeydownHandler,
      registerObsidianHotkeyOverrides,
      removeObsidianHotkeyOverrides,
      disposeKeyboard,
      updateKeyHandlerLocation,
      getActionFromEvent,
      handleKeydown,
      addSibling
    } = createKeyboard(runtimeContext);
    dirty = updateUserHotkeys();
    if (userHotkeys.length !== DEFAULT_HOTKEYS.length) {
      const merged = [...userHotkeys];
      DEFAULT_HOTKEYS.forEach((d) => {
        if (!merged.find((u) => u.action === d.action)) merged.push(JSON.parse(JSON.stringify(d)));
      });
      userHotkeys = merged;
    }
    let RUNTIME_HOTKEYS = generateRuntimeHotkeys();
    const { getInstructions, renderHelp } = createHelpUi(runtimeContext);
    const { addElementsToView } = createTransactions(runtimeContext);
    const {
      selectNodeInView,
      getBoundaryHost,
      getMindmapNodeFromSelection,
      ensureNodeSelected,
      getMostRecentlyAddedNode
    } = createSelection(runtimeContext);
    const {
      buildParentMap,
      getParentNode,
      buildElementMap,
      buildChildrenMap,
      getChildrenNodes,
      buildGroupToNodes,
      getMasterRoots,
      getHierarchy,
      getSettingsRootNode,
      getDepthFromAncestor,
      getBranchElementIds,
      getMindmapProjectElements
    } = createGraph(runtimeContext);
    const { getAngleFromCenter, getConvexHull, updateNodeBoundary, toggleBoundary } = createBoundaries(runtimeContext);
    const { randInt, getDynamicColor } = createColors(runtimeContext);
    const { manageFoldIndicator, setElementVisibility, updateBranchVisibility, toggleFold } = createFolding(runtimeContext);
    const { moveCrossLinks, moveDecorations, scaleDecorations } = createDecorations(runtimeContext);
    let storedZoom = {
      elementID: void 0,
      level: void 0
    };
    const { nextZoomLevel, zoomToFit, focusSelected, navigateMap } = createNavigation(runtimeContext);
    const {
      getMindmapOrder,
      getNodeBox,
      sortChildrenStable,
      getSubtreeHeight,
      getSubtreeWidth,
      getVerticalPlacementWidth
    } = createLayoutMetrics(runtimeContext);
    const {
      isStructuralElement,
      getViewGroupElements,
      getCommonGroupForElements,
      isMindmapGroup,
      collectCrosslinkIds,
      collectDecorationIds,
      getStructuralGroup,
      applyRecursiveGrouping,
      getStructuralGroupForNode,
      getStructuralGroupsForNode,
      removeGroupFromElements,
      getDecorationAndCrossLinkIdsForBranches,
      toggleBranchGroup
    } = createGrouping(runtimeContext);
    const { addEmbeddableNode, addImage, initializeRootCustomData, addNode } = createNodes(runtimeContext);
    const { addUpdateArrowLabel, configureArrow, updateL1Arrow, reconnectArrow } = createArrows(runtimeContext);
    const { layoutChildrenAsAdditionalRoot, layoutSubtree } = createHorizontalLayout(runtimeContext);
    const { layoutSubtreeVertical } = createVerticalLayout(runtimeContext);
    const {
      radialL1Distribution,
      verticalL1Distribution,
      horizontalL1Distribution,
      layoutL1Nodes,
      sortL1NodesBasedOnVisualSequence
    } = createFirstLevelLayout(runtimeContext);
    const { triggerGlobalLayout, refreshMapLayout } = createLayout(runtimeContext);
    let mostRecentlyAddedNodeID;
    const {
      importOutline,
      importTextToMap,
      pasteListToMap,
      pasteElementToMap,
      cancelBranchPaste,
      disposeBranchPaste,
      watchPasteMetadata,
      isBranchPasteBusy
    } = createMarkdownImport(runtimeContext);
    const { copyMapAsText } = createMarkdownExport(runtimeContext);
    const {
      updateSubtreeFontSize,
      updateSubtreeStrokeWidth,
      updateSubtreeColor,
      toggleSubmapRoot,
      changeNodeOrder
    } = createNodeOrder(runtimeContext);
    const { togglePin, toggleCheckboxStatus, toggleEmbedStatus, toggleBox } = createNodeStyles(runtimeContext);
    const padding = layoutSettings.CONTAINER_PADDING;
    let detailsEl, inputEl, ontologyEl, inputRow, bodyContainer, strategyDropdown;
    let lastFocusedInput = null;
    let isOntologyFocused = false;
    let ignoreFocusChanges = false;
    let autoLayoutToggle, linkSuggester, arrowTypeToggle;
    let fontSizeDropdown, boxToggle, roundToggle, strokeToggle;
    let branchScaleDropdown, baseWidthSlider;
    let colorToggle, widthSlider, centerToggle;
    let fillSweepToggleSetting, fillSweepToggle;
    let pinBtn, refreshBtn, cutBtn, copyBtn, boxBtn, dockBtn, editBtn;
    let toggleGroupBtn, zoomBtn, focusBtn, boundaryBtn, calendarBtn;
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
    let disableTabEvents = false;
    let presetDropdown, presetWarningEl, presetSaveBtn, presetTrashBtn, presetPlusBtn, presetApplyBtn;
    const { revealInputEl, focusInputEl, setButtonDisabled, disableUI, updateUI } = createInputUi(runtimeContext);
    const { startEditing, commitEdit } = createNodeEditing(runtimeContext);
    const { PaletteManagerModal } = createPaletteManagerModal(runtimeContext);
    const { LayoutConfigModal } = createLayoutConfigModal(runtimeContext);
    const { renderInput } = createInputControls(runtimeContext);
    const { renderBody } = createSidepanelControls(runtimeContext);
    const { registerStyles, removeStyles } = createStyles(runtimeContext);
    const { toggleDock } = createFloatingInput(runtimeContext);
    const { getTasksUiOptions, parseTasksData, cleanTasksString, openCalendarModal } = createTasks(runtimeContext);
    const { performAction } = createActions(runtimeContext);
    installMindmapPublicApi(runtimeContext);
    let uiUpdateTimer = null;
    ea2.registerCleanup?.(() => {
      cancelHotkeyRecording?.();
      linkSuggester?.close();
      disposeKeyboard();
      removeEventListeners();
      if (uiUpdateTimer) clearTimeout(uiUpdateTimer);
    });
    return openMindmapSidepanel(runtimeContext);
  }

  // src/scripts/mindmap-builder/run.ts
  var minimumPluginVersion = "2.23.4";
  function getTranslator(ea2) {
    return createMindmapTranslator(
      localStorage.getItem("language") ?? "en",
      ea2.DEVICE.isMacOS || ea2.DEVICE.isIOS
    );
  }
  async function runMindmapBuilder(ea2, utils2, version) {
    const t = getTranslator(ea2);
    if (!ea2.verifyMinimumPluginVersion?.(minimumPluginVersion)) {
      new ea2.obsidian.Notice(t("requiresNewerVersion", { version: minimumPluginVersion }));
      return;
    }
    ea2.skipSidepanelScriptRestore();
    const existingTab = ea2.checkForActiveSidepanelTabForScript();
    const hostEA = existingTab?.getHostEA();
    if (existingTab && hostEA && hostEA !== ea2) {
      const mindmapHost = hostEA;
      mindmapHost.activateMindmap = true;
      hostEA.setView(ea2.targetView);
      existingTab.open(false);
      return;
    }
    await initializeMindmapBuilder(ea2, utils2, version, t);
  }
  function reportMindmapLaunchError(ea2, error) {
    console.error("Mindmap Builder could not start", error);
    const t = getTranslator(ea2);
    new ea2.obsidian.Notice(t("launchFailed"));
  }

  // src/scripts/mindmap-builder/main.ts
  void runMindmapBuilder(ea, utils, VERSION).catch((error) => {
    reportMindmapLaunchError(ea, error);
  });
})();

/* end of bundle */
