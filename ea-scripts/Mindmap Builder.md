/*

# Mind Map Builder: Technical Specification & User Guide

![](https://youtu.be/dZguonMP2KU)

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

## 4. UI and User Experience

### Zoom Management
The script includes "Preferred Zoom Level" settings (Low/Medium/High) to ensure the canvas automatically frames the active node comfortably during rapid entry, particularly useful on mobile devices vs desktop screens.

### Keyboard Shortcuts
| Shortcut | Action |
| :--- | :--- |
| **ENTER** | Add a sibling node (stay on current parent). |
| **CMD/CTRL + ENTER** | Add a child and "drill down" (select the new node). |
| **SHIFT + ENTER** | **Dock/Undock** the input field (toggle between Sidepanel and Floating Modal). |
| **CMD/CTRL + SHIFT + ENTER** | **Pin/Unpin** the location of the selected node. |
| **OPT/ALT + SHIFT + ENTER** | **Box/Unbox** the selected node. |
| **ALT/OPT + ARROWS** | Navigate the mind map structure (parent/child/sibling). |
| **ALT/OPT + SHIFT + ARROWS** | Navigate the mind map structure (parent/child/sibling) and zoom to selected element |
| **CMD/CTRL + SHIFT + ARROWS** | Navigate the mind map structure (parent/child/sibling) and focus to selected element |
| **ALT/OPT + Z** | Zoom to selected element |
| **ALT/OPT + C / X / V** | Copy, Cut, or Paste branches as Markdown. |

## 5. Settings and Persistence

### Global Settings
Persisted across sessions via `ea.setScriptSettings`:
- **Max Text Width**: Point at which text wraps (Default: 450px).
- **Font Scales**: Choice of Normal, Fibonacci, or Scene-based sizes.
- **Preferred Zoom Level**: Controls auto-zoom intensity (Low/Medium/High).
- **Recursive Grouping**: When enabled, groups sub-trees from the leaves upward.
- **Is Undocked**: Remembers if the user prefers the UI floating or docked.

### Map-Specific Persistence (customData)
The script uses `ea.addAppendUpdateCustomData` to store state on elements:
- `growthMode`: Stored on the Root node (Radial, Left, or Right).
- `autoLayoutDisabled`: Stored on the Root node to pause layout engine for specific maps.
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

if (!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("2.18.3")) {
  new Notice("Please update the Excalidraw Plugin to version 2.18.3 or higher.");
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
let boxChildren = getVal(K_BOX, false) === true;
let roundedCorners = getVal(K_ROUND, true) === true;
let multicolor = getVal(K_MULTICOLOR, true) === true;
let groupBranches = getVal(K_GROUP, true) === true;
let currentModalGrowthMode = getVal(K_GROWTH, {value: "Radial", valueset: GROWTH_TYPES});
let isUndocked = getVal(K_UNDOCKED, false) === true;
let isSolidArrow = getVal(K_ARROWSTROKE, true) === true;
let centerText = getVal(K_CENTERTEXT, true) === true;
let autoLayoutDisabled = false;
let zoomLevel = getVal(K_ZOOM, {value: "Medium", valueset: ZOOM_TYPES});
let editingNodeId = null;

//migrating old settings values. This must stay in the code so existing users have their dataset migrated
//when they first run the new version of the code
if (!ea.getScriptSettingValue(K_FONTSIZE, {value: "Normal Scale", valueset: FONT_SCALE_TYPES}).hasOwnProperty("valueset")) {
  ea.setScriptSettingValue (K_FONTSIZE, {value: fontsizeScale, valueset: FONT_SCALE_TYPES});
  dirty = true;
}

if (!ea.getScriptSettingValue(K_GROWTH, {value: "Radial", valueset: GROWTH_TYPES}).hasOwnProperty("valueset")) {
  ea.setScriptSettingValue (K_GROWTH, {value: currentModalGrowthMode, valueset: GROWTH_TYPES});
  dirty = true;
}

const getZoom = (level) => {
  switch (level ?? zoomLevel) {
    case "Low":
      return ea.DEVICE.isMobile ? 0.85 : 0.92;
    case "High":
      return ea.DEVICE.isMobile ? 0.50 : 0.60;
    default:
      return ea.DEVICE.isMobile ? 0.75 : 0.85;
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

const ACTION_ADD = "Add";
const ACTION_ADD_FOLLOW = "Add + follow";
const ACTION_ADD_FOLLOW_FOCUS = "Add + follow + focus";
const ACTION_ADD_FOLLOW_ZOOM = "Add + follow + zoom";
const ACTION_EDIT = "Edit node";
const ACTION_PIN = "Pin/Unpin";
const ACTION_BOX = "Box/Unbox";

const ACTION_COPY = "Copy";
const ACTION_CUT = "Cut";
const ACTION_PASTE = "Paste";

const ACTION_ZOOM = "Cycle Zoom";
const ACTION_FOCUS = "Focus (center) node";
const ACTION_NAVIGATE = "Navigate";
const ACTION_NAVIGATE_ZOOM = "Navigate & zoom";
const ACTION_NAVIGATE_FOCUS = "Navigate & focus";

const ACTION_DOCK_UNDOCK = "Dock/Undock";
const ACTION_HIDE = "Dock & hide";

// Default configuration
const DEFAULT_HOTKEYS = [
  { action: ACTION_ADD, key: "Enter", modifiers: [], immutable: true }, // Logic relies on standard Enter behavior in input
  { action: ACTION_ADD_FOLLOW, key: "Enter", modifiers: ["Mod", "Alt"] },
  { action: ACTION_ADD_FOLLOW_FOCUS, key: "Enter", modifiers: ["Mod"] },
  { action: ACTION_ADD_FOLLOW_ZOOM, key: "Enter", modifiers: ["Mod", "Shift"] },
  { action: ACTION_EDIT, code: "F2", modifiers: [] },
  { action: ACTION_PIN, key: "KeyP", modifiers: ["Alt"] },
  { action: ACTION_BOX, key: "KeyB", modifiers: ["Alt"] },
  { action: ACTION_COPY, code: "KeyC", modifiers: ["Alt"] },
  { action: ACTION_CUT, code: "KeyX", modifiers: ["Alt"] },
  { action: ACTION_PASTE, code: "KeyV", modifiers: ["Alt"] },
  { action: ACTION_ZOOM, code: "KeyZ", modifiers: ["Alt"] },
  { action: ACTION_FOCUS, code: "KeyF", modifiers: ["Alt"] },
  { action: ACTION_DOCK_UNDOCK, key: "Enter", modifiers: ["Shift"] },
  { action: ACTION_HIDE, key: "Escape", modifiers: [], immutable: true  },
  { action: ACTION_NAVIGATE, key: "ArrowKeys", modifiers: ["Alt"], isNavigation: true },
  { action: ACTION_NAVIGATE_ZOOM, key: "ArrowKeys", modifiers: ["Alt", "Shift"], isNavigation: true },
  { action: ACTION_NAVIGATE_FOCUS, key: "ArrowKeys", modifiers: ["Alt", "Mod"], isNavigation: true },
];

// Load hotkeys from settings or use default
// IMPORTANT: Use JSON.parse/stringify to create a deep copy of defaults.
// Otherwise, modifying userHotkeys modifies DEFAULT_HOTKEYS in memory, breaking the isModified check until restart.
let userHotkeys = getVal(K_HOTKEYS, {value: JSON.parse(JSON.stringify(DEFAULT_HOTKEYS)), hidden: true});

const getHotkeyDefByAction = (action) => userHotkeys.find((h)=>h.action === action);

const getHotkeyDisplayString = (h) => {
  const parts = [];
  if (h.modifiers.includes("Ctrl")) parts.push("Ctrl");
  if (h.modifiers.includes("Meta")) parts.push("Cmd");
  if (h.modifiers.includes("Mod")) parts.push(isMac ? "Cmd" : "Ctrl");
  if (h.modifiers.includes("Alt")) parts.push(isMac ? "Opt" : "Alt");
  if (h.modifiers.includes("Shift")) parts.push("Shift");
  
  if (h.code) parts.push(h.code.replace("Key", ""));
  else if (h.key === "ArrowKeys") parts.push("Arrow Keys");
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

const INSTRUCTIONS = `
- **ENTER**: Add a sibling node and stay on the current parent for rapid entry. If you press enter when the input field is empty the focus will move to the child node that was most recently added. Pressing enter subsequent times will iterate through the new child's siblings
- **Hotkeys**: See configuration at the bottom of the sidepanel
- **Dock/Undock**: You can dock/undock the input field using the dock/undock button or the configured hotkey
- **ESC**: Docks the floating input field without activating the side panel
- **Coloring**: First level branches get unique colors (Multicolor mode). Descendants inherit parent's color.
- **Grouping**: Enabling "Group Branches" recursively groups sub-trees from leaves up to the first level.
- **Copy/Paste**: Export/Import indented Markdown lists.

😍 If you find this script helpful, please [buy me a coffee ☕](https://ko-fi.com/zsolt).

<a href="https://www.youtube.com/watch?v=dZguonMP2KU" target="_blank"><img src ="https://i.ytimg.com/vi/dZguonMP2KU/maxresdefault.jpg" style="max-width:560px; width:100%"></a>
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
  while (true) {
    let p = getParentNode(curr.id, allElements);
    if (!p) {
      rootId = curr.id;
      break;
    }
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
// 3. Layout & Grouping Engine
// ---------------------------------------------------------------------------

const GAP_X = 140;
const GAP_Y = 30;

let storedZoom = {elementID: undefined, level: undefined}
const nextZoomLevel = (current) => {
  const idx = ZOOM_TYPES.indexOf(current);
  return idx === -1 ? ZOOM_TYPES[0] : ZOOM_TYPES[(idx + 1) % ZOOM_TYPES.length];
};

const zoomToFit = (isAltZ) => {
  if (!ea.targetView) return;
  const sel = ea.getViewSelectedElement();
  if (sel) {
    if (isAltZ && storedZoom.elementID === sel.id) {
      const nextLevel = nextZoomLevel(storedZoom.level ?? zoomLevel);
      storedZoom.level = nextLevel;
      api().zoomToFit([sel],10,getZoom(nextLevel));
    } else {
      api().zoomToFit([sel],10,getZoom());
      storedZoom = {elementID: sel.id, level: zoomLevel}
    }
  }
  focusInputEl();
}

const focusSelected = () => {
  if (!ea.targetView) return;
  const sel = ea.getViewSelectedElement();
  if (!sel) return;

  const { width, height, zoom } = appState();
  const cx = sel.x + sel.width / 2;
  const cy = sel.y + sel.height / 2;

  const scrollX = width / (2 * zoom.value) - cx;
  const scrollY = height / (2 * zoom.value) - cy;

  api().updateScene({
    appState: { scrollX, scrollY },
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

const layoutSubtree = (nodeId, targetX, targetCenterY, side, allElements) => {
  const node = allElements.find((el) => el.id === nodeId);
  const eaNode = ea.getElement(nodeId);

  const isPinned = node.customData?.isPinned === true;

  if (!isPinned) {
    eaNode.x = side === 1 ? targetX : targetX - node.width;
    eaNode.y = targetCenterY - node.height / 2;
  }

  const currentX = eaNode.x;
  const currentYCenter = eaNode.y + node.height / 2;

  let effectiveSide = side;
  const parent = getParentNode(nodeId, allElements);

  if (isPinned && parent) {
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

const triggerGlobalLayout = async (rootId, force = false) => {
  if (!ea.targetView) return;
  const run = async () => {
    const allElements = ea.getViewElements();
    const root = allElements.find((el) => el.id === rootId);
    ea.copyViewElementsToEAforEditing(allElements);

    // Clear existing grouping info for mindmap components before rebuilding
    if (groupBranches) {
      ea.getElements().forEach((el) => {
        el.groupIds = [];
      });
    }

    const l1Nodes = getChildrenNodes(rootId, allElements);
    if (l1Nodes.length === 0) return;

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
        ? node.x + node.width / 2 > rootCenter.x
        : tCX > rootCenter.x
      ) ? 1 : -1;

      if (isPinned) {
        layoutSubtree(node.id, node.x, node.y + node.height / 2, side, allElements);
      } else {
        layoutSubtree(node.id, tCX, tCY, side, allElements);
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

      if (groupBranches) {
        applyRecursiveGrouping(node.id, allElements);
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

const addNode = async (text, follow = false, skipFinalLayout = false) => {
  if (!ea.targetView) return;
  if (!text || text.trim() === "") return;
  const allElements = ea.getViewElements();
  const st = appState();
  let parent = ea.getViewSelectedElement();
  if (parent?.containerId) {
    parent = allElements.find((el) => el.id === parent.containerId);
  }

  let depth = 0,
    nodeColor = "black",
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
      nodeColor = parent.strokeColor;
    }
  }

  const fontScale = getFontScale(fontsizeScale);
  ea.clear();
  ea.style.fontFamily = st.currentItemFontFamily;
  ea.style.fontSize = fontScale[Math.min(depth, fontScale.length - 1)];
  ea.style.roundness = roundedCorners ? { type: 3 } : null;

  const curMaxW = depth === 0 ? Math.max(400, maxWidth) : maxWidth;
  const metrics = ea.measureText(text);
  const shouldWrap = metrics.width > curMaxW;

  let newNodeId;
  if (!parent) {
    ea.style.strokeColor = multicolor ? "black" : st.currentItemStrokeColor;
    newNodeId = ea.addText(0, 0, text, {
      box: "rectangle",
      textAlign: "center",
      textVerticalAlign: "middle",
      width: shouldWrap ? curMaxW : undefined,
      autoResize: !shouldWrap,
    });
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
      const nodeW = shouldWrap ? maxWidth : metrics.width;
      px = side === 1
        ? parent.x + parent.width + manualGapX + jitterX
        : parent.x - manualGapX - nodeW + jitterX;
      py = parent.y + parent.height / 2 - metrics.height / 2 + jitterY;
    }

    const textAlign = centerText
      ? "center"
      : side === 1 ? "left" : "right";

    newNodeId = ea.addText(px, py, text, {
      box: boxChildren ? "rectangle" : false,
      textAlign,
      textVerticalAlign: "middle",
      width: shouldWrap ? maxWidth : undefined,
      autoResize: !shouldWrap,
    });
    if (depth === 1) {
      ea.addAppendUpdateCustomData(newNodeId, {
        mindmapNew: true,
        mindmapOrder: nextSiblingOrder,
      });
    } else {
      ea.addAppendUpdateCustomData(newNodeId, { mindmapOrder: nextSiblingOrder });
    }

    ea.copyViewElementsToEAforEditing([parent]);
    ea.style.strokeWidth = STROKE_WIDTHS[Math.min(depth, STROKE_WIDTHS.length - 1)];
    ea.style.roughness = appState().currentItemRoughness;
    ea.style.strokeStyle = isSolidArrow ? "solid" : appState().currentItemStrokeStyle;
    const startPoint = [parent.x + parent.width / 2, parent.y + parent.height / 2];
    const arrowId = ea.addArrow([startPoint, startPoint], {
      startObjectId: parent.id,
      endObjectId: newNodeId,
      startArrowHead: null,
      endArrowHead: null,
    });
    ea.addAppendUpdateCustomData(arrowId, { isBranch: true });
  }

  await ea.addElementsToView(!parent, false, true, true);
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
const getTextFromNode = (all, node, getRaw = false) => {
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

  if (isRootSelected) {
    cut = false;
  }

  const elementsToDelete = [];

  const buildList = (nodeId, depth = 0) => {
    const node = all.find((e) => e.id === nodeId);
    if (!node) return "";

    if (cut) {
      elementsToDelete.push(node);
      node.boundElements?.forEach((be) => {
        const boundEl = all.find((e) => e.id === be.id);
        if (boundEl) elementsToDelete.push(boundEl);
      });
    }

    const children = getChildrenNodes(nodeId, all);
    sortChildrenStable(children);
    let str = "";
    const text = getTextFromNode(all, node);
    if (depth === 0 && isRootSelected) {
      str += `# ${text}\n\n`;
    } else {
      str += `${"  ".repeat(depth - (isRootSelected ? 1 : 0))}- ${text}\n`;
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

    new Notice("Branch cut to clipboard.");
  } else {
    new Notice("Branch copied as bullet list.");
  }
};

const pasteListToMap = async () => {
  if (!ea.targetView) return;
  const rawText = await navigator.clipboard.readText();
  if (!rawText) return;

  const lines = rawText.split(/\r\n|\n|\r/).filter((l) => l.trim() !== "");
  let parsed = [];
  let rootTextFromHeader = null;

  if (
    lines.length === 0 ||
    !lines[0].match(/^(#+\s|\s*(?:-|\*|\d+)\s)/) ||
    !lines.every((line, idx) => idx === 0 || line.match(/^\s*(?:-|\*|\d+)\s/))
  ) {
    new Notice("Paste aborted. Cliboard is not a bulleted list");
    return;
  }

  const delta = lines[0].match(/^#+\s/) ? 1 : 0;

  lines.forEach((line) => {
    if (line.match(/^#+\s/)) {
      parsed.push({ indent: 0, text: line.substring(2).trim() });
    } else {
      const match = line.match(/^(\s*)(?:-|\*|\d+\.)\s+(.*)$/);
      if (match) {
        parsed.push({ indent: delta + match[1].length, text: match[2].trim() });
      }
    }
  });

  if (parsed.length === 0 && !rootTextFromHeader) {
    new Notice("No valid Markdown list found on clipboard.");
    return;
  }

  const sel = ea.getViewSelectedElement();
  let currentParent;

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


const navigateMap = ({key, zoom = false, focus = false} = {}) => {
  if(!key) return;
  if (!ea.targetView) return;
  const allElements = ea.getViewElements();
  const current = ea.getViewSelectedElement();
  if (!current) return;
  const info = getHierarchy(current, allElements);
  const root = allElements.find((e) => e.id === info.rootId);
  const rootCenter = { x: root.x + root.width / 2, y: root.y + root.height / 2 };
  if (current.id === root.id) {
    const children = getChildrenNodes(root.id, allElements);
    if (children.length) {
      ea.selectElementsInView([children[0]]);
      if (zoom) zoomToFit();
      if (focus) focusSelected();
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

const padding = 30;
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
let pinBtn, refreshBtn, cutBtn, copyBtn, boxBtn, dockBtn, editBtn;
let inputContainer;
let helpContainer;
let floatingInputModal = null;
let sidepanelWindow;
let popScope = null;
let keydownHandlers = [];

const removeKeydownHandlers = () => {
  keydownHandlers.forEach((f)=>f());
  keydownHandlers = [];
}

const registerKeydownHandler = (host, handler) => {
  removeKeydownHandlers();
  host.addEventListener("keydown", handler, true);
  keydownHandlers.push(()=>host.removeEventListener("keydown", handler, true))
}

const registerMindmapHotkeys = () => {
  if (popScope) popScope();
  const scope = app.keymap.getRootScope();
  const handlers = [];

  const reg = (mods, key) => {
    const handler = scope.register(mods, key, (e) => true);
    handlers.push(handler);
    // Force the newly registered handler to the top of the stack
    scope.keys.unshift(scope.keys.pop());
  };

  RUNTIME_HOTKEYS.forEach(h => {
    if (h.key) reg(h.modifiers, h.key);
    if (h.code) {
      const char = h.code.replace("Key", "").toLowerCase();
      reg(h.modifiers, char);
    }
  });

  popScope = () => {
    handlers.forEach(h => scope.unregister(h));
    popScope = null;
  };
};

const focusInputEl = () => {
  setTimeout(() => {
    if(!inputEl || inputEl.disabled) return;
    inputEl.focus();
    if (!popScope) registerMindmapHotkeys();
  }, 200);
}

const setButtonDisabled = (btn, disabled) => {
  if (!btn) return;
  btn.disabled = disabled;
  if (!btn.extraSettingsEl) return;
  btn.extraSettingsEl.style.opacity = disabled ? "0.5" : "";
  btn.extraSettingsEl.style.pointerEvents = disabled ? "none" : "";
};

const disableUI = () => {
  if (pinBtn) pinBtn.setIcon("pin-off");
  setButtonDisabled(pinBtn, true);
  setButtonDisabled(refreshBtn, true);
  setButtonDisabled(copyBtn, true);
  setButtonDisabled(cutBtn, true);
  setButtonDisabled(boxBtn, true);
  setButtonDisabled(editBtn, true);
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
    if (boxBtn) {
      setButtonDisabled(boxBtn, false);
    }

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

const renderHelp = (container) => {
  helpContainer = container.createDiv();
  detailsEl = helpContainer.createEl("details");
  detailsEl.createEl("summary", { text: "Instructions & Shortcuts" });
  ea.obsidian.MarkdownRenderer.render(app, INSTRUCTIONS, detailsEl.createDiv(), "", ea.plugin);
};

const startEditing = () => {
  const sel = ea.getViewSelectedElement();
  if (!sel) return;
  const all = ea.getViewElements();
  const text = getTextFromNode(all, sel, true);
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
    eaEl.originalText = inputEl.value;
    eaEl.rawText = inputEl.value;
    
    ea.refreshTextElementSize(eaEl.id);
    
    await ea.addElementsToView(false, false);
    
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

const renderInput = (container, isFloating = false) => {
  container.empty();
  
  pinBtn = refreshBtn = boxBtn = dockBtn = inputEl = null;

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
    inputEl.placeholder = "Concept...";
    inputEl.addEventListener("focus", registerMindmapHotkeys);
    inputEl.addEventListener("blur", () => {
      if (popScope) popScope();
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
    btn.onClick(async () => {
      await togglePin();
      updateUI();
      focusInputEl();
    });
  });

  if (!isFloating) {
    addButton((btn) => {
      boxBtn = btn;
      btn.setIcon("rectangle-horizontal");
      btn.setTooltip(`Toggle node box. ${getActionHotkeyString(ACTION_BOX)}`);
      btn.onClick(async () => {
        await toggleBox();
        focusInputEl();
      });
    });
  };

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
    attr: { style: "padding: 2px;" },
  }).onclick = async () => {
    await addNode(inputEl.value, false);
    inputEl.value = "";
    if(!autoLayoutDisabled) await refreshMapLayout();
    updateUI();
    focusInputEl();
  };
  btnGrid.createEl("button", { text: "Add+Follow", attr: { style: "padding: 2px;" } }).onclick = async () => {
    await addNode(inputEl.value, true);
    inputEl.value = "";
    if(!autoLayoutDisabled) await refreshMapLayout();
    updateUI();
    focusInputEl();
  };
  copyBtn = btnGrid.createEl("button", {
    text: "Copy",
    attr: { style: "padding: 2px;", title: `Copy branch as text (${isMac ? "OPT" : "ALT"}+C)` },
  });
  copyBtn.onclick = copyMapAsText;

  cutBtn = btnGrid.createEl("button", {
    text: "Cut",
    attr: { style: "padding: 2px;", title: `Cut branch as text (${isMac ? "OPT" : "ALT"}+X)` },
  });
  cutBtn.onclick = () => copyMapAsText(true);

  btnGrid.createEl("button", {
    text: "Paste",
    attr: { style: "padding: 2px;", title: `Paste list from clipboard (${isMac ? "OPT" : "ALT"}+V)` },
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
  zoomSetting.addExtraButton(btn=>btn
    .setIcon("scan-search")
    .onClick(()=>{
      zoomToFit();
    })
  );

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

  autoLayoutToggle = new ea.obsidian.Setting(bodyContainer).setName("Disable Auto-Layout").addToggle((t) => t
    .setValue(autoLayoutDisabled)
    .onChange(async (v) => {
      autoLayoutDisabled = v;
      setMapAutolayout(v);
    }),
  ).components[0];

  new ea.obsidian.Setting(bodyContainer).setName("Group Branches").addToggle((t) => t
    .setValue(groupBranches)
    .onChange(async (v) => {
      if (!ea.targetView) return;
      groupBranches = v;
      setVal(K_GROUP, v);
      dirty = true;
      const sel = ea.getViewSelectedElement();
      if (sel) {
        const info = getHierarchy(sel, ea.getViewElements());
        await triggerGlobalLayout(info.rootId);
      }
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

  new ea.obsidian.Setting(bodyContainer).setName("Multicolor Branches").addToggle((t) =>
    t.setValue(multicolor).onChange((v) => {
      multicolor = v;
      setVal(K_MULTICOLOR, v);
      dirty = true;
    }),
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

  new ea.obsidian.Setting(bodyContainer).setName("Box Child Nodes").addToggle((t) => t
    .setValue(boxChildren)
    .onChange((v) => {
      boxChildren = v;
      setVal(K_BOX, v);
      dirty = true;
    }),
  );

  new ea.obsidian.Setting(bodyContainer).setName("Rounded Corners").addToggle((t) => t
    .setValue(roundedCorners)
    .onChange((v) => {
      roundedCorners = v;
      setVal(K_ROUND,  v);
      dirty = true;
    }),
  );

  // ------------------------------------
  // Hotkey Configuration Section
  // ------------------------------------
  const hkDetails = bodyContainer.createEl("details", {
    attr: { style: "margin-top: 15px; border-top: 1px solid var(--background-modifier-border); padding-top: 10px;" }
  });
  hkDetails.createEl("summary", { text: "Hotkey Configuration", attr: { style: "cursor: pointer; font-weight: bold;" } });
  
  const hkContainer = hkDetails.createDiv();
  hkContainer.createEl("p", {
    text: "While the Mindmap Builder input field is active, the following hotkeys override standard Obsidian behaviors.",
    attr: { style: "color: var(--text-muted); font-size: 0.85em; margin-bottom: 10px;" }
  });

  const refreshHotkeys = () => {
    RUNTIME_HOTKEYS = generateRuntimeHotkeys();
    // Re-register scope if currently active
    if (popScope) registerMindmapHotkeys();
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
    
    // Correctly identify the window where the settings UI resides
    const targetWindow = btn.ownerDocument.defaultView;

    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Ignore modifier-only presses
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;

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
        return;
      }

      // Check conflicts
      const conflict = userHotkeys.find((h, i) => {
        if (i === hIndex) return false;
        
        const sameMods = h.modifiers.length === mods.length && h.modifiers.every(m => mods.includes(m));
        if (!sameMods) return false;
        
        if (h.isNavigation && isNav) return true;
        if (h.isNavigation && key.startsWith("Arrow")) return true;
        
        const hKey = h.code ? h.code.replace("Key","") : h.key;
        const eKey = code ? code.replace("Key","") : key;
        return hKey.toLowerCase() === eKey.toLowerCase();
      });

      if (conflict) {
        label.style.color = "var(--text-error)";
        new Notice(`Conflict with "${conflict.action}"`);
        setTimeout(() => label.style.color = "", 2000);
      } else {
        // Update setting
        if (isNav) {
          targetConfig.modifiers = mods.map(m => m === "Ctrl" || m === "Meta" ? "Mod" : m);
        } else {
          targetConfig.modifiers = mods.map(m => m === "Ctrl" || m === "Meta" ? "Mod" : m);
          if (code && code.startsWith("Key")) {
            targetConfig.code = code;
            delete targetConfig.key;
          } else {
            targetConfig.key = key;
            delete targetConfig.code;
          }
        }
        saveHotkeys();
        if(onUpdate) onUpdate();
      }

      cleanup();
    };

    const cleanup = () => {
      btn.innerHTML = originalText;
      btn.removeClass("is-recording");
      targetWindow.removeEventListener("keydown", handler, true);
    };

    targetWindow.addEventListener("keydown", handler, true);
  };

  userHotkeys.forEach((h, index) => {
    if (h.immutable) return;

    const setting = new ea.obsidian.Setting(hkContainer)
      .setName(h.action);
    
    const controlDiv = setting.controlEl;
    controlDiv.addClass("setting-item-control");
    
    const hotkeyDisplay = controlDiv.createDiv("setting-command-hotkeys");
    const span = hotkeyDisplay.createSpan("setting-hotkey");
    
    // UI Update logic scoped to this specific row
    const restoreBtn = controlDiv.createSpan("clickable-icon setting-restore-hotkey-button");
    restoreBtn.innerHTML = ea.obsidian.getIcon("rotate-ccw").outerHTML;
    restoreBtn.ariaLabel = "Restore default";

    const updateRowUI = () => {
      span.textContent = getHotkeyDisplayString(userHotkeys[index]);
      restoreBtn.style.display = isModified(userHotkeys[index]) ? "" : "none";
    };

    // Initial render
    updateRowUI();

    restoreBtn.onclick = () => {
      const def = DEFAULT_HOTKEYS.find(d => d.action === userHotkeys[index].action);
      if (def) {
        userHotkeys[index] = JSON.parse(JSON.stringify(def));
        saveHotkeys();
        updateRowUI();
      }
    };

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
  if (!ea.targetView && !(forceDock && isUndocked)) return;
  
  // Only reveal/hide UI if not silent
  if (!silent) {
    const isSidepanelVisible = ea.getSidepanelLeaf().isVisible();
    // If undocking and sidepanel is hidden, leave it hidden (we want the float).
    // If docking and sidepanel is hidden, show it so we can see the input.
    // If undocking and sidepanel is visible, we might want to close it or keep it.
    // Logic from previous iteration:
    if (isUndocked && !isSidepanelVisible || isSidepanelVisible && !isUndocked) {
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
      setTimeout(() => {
        inputEl?.focus();
        //the modalEl is repositioned after a delay
        //otherwise the event handlers in FloatingModal would override the move
        //leaving modalEl in the center of the view
        //modalEl.style.top and left must stay in the timeout call
        modalEl.style.top = `${ y + 5 }px`;
        modalEl.style.left = `${ x + 5 }px`;
      }, 100);
    };

    floatingInputModal.onClose = () => {
      if (popScope) popScope();
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
      setTimeout(() => {
        inputEl?.focus();
      }, 100);
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

  return match ? match.action : null;
};

const keyHandler = async (e) => {
  // Determine which window the input is currently in
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
  
  // Check if the input element is actually focused
  if (currentWindow.document?.activeElement !== inputEl) return;

  const action = getActionFromEvent(e);

  if (!action) return;

  e.preventDefault();
  e.stopPropagation();

  switch (action) {
    case ACTION_HIDE:
      if (isUndocked) {
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
      navigateMap({key: e.key, zoom: false, focus: false});
      updateUI();
      break;

    case ACTION_NAVIGATE_ZOOM:
      navigateMap({key: e.key, zoom: true, focus: false});
      updateUI();
      break;

    case ACTION_NAVIGATE_FOCUS:
      navigateMap({key: e.key, zoom: false, focus: true});
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
          if(!mostRecentlyAddedNodeID) return;
          const mostRecentNode = getMostRecentlyAddedNode();
          const sel = ea.getViewSelectedElement();
          if(mostRecentNode !== sel) {
            ea.selectElementsInView([mostRecentNode]);
            mostRecentlyAddedNodeID = null;
          } else {
            navigateMap({key: "ArrowDown", zoom: false, focus: false});
            if(sel === ea.getViewSelectedElement()) {
              //if only a single child then navigate up
              navigateMap({
                key: isNodeRightFromCenter() ? "ArrowLeft" : "ArrowRight",
                zoom: false,
                focus: false
              });
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
    const textEl = selection.find(el => el.type === "text");
    let isEligible = false;

    if (selection.length === 1 && textEl) {
      isEligible = true;
    } else if (selection.length === 2 && textEl) {
      const other = selection.find(el => el.id !== textEl.id);
      if (other && textEl.containerId === other.id && other.type !== "arrow") {
        isEligible = true;
      }
    }

    if (isEligible) {
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
      const undocPreference = getVal(K_UNDOCKED, false) === true;
      if (undocPreference) {
        setTimeout(()=>toggleDock({saveSetting: false}));
      }
    }
  };

  const setupEventListeners = (view) => {
    if (!view || !view.ownerWindow) return;
    
    view.ownerWindow.addEventListener("pointerdown", canvasPointerListener);

    updateKeyHandlerLocation();
  };

  const removeEventListeners = (view) => {
    removeKeydownHandlers();
    if (popScope) popScope();
    if (!view || !view.ownerWindow) return;
    view.ownerWindow.removeEventListener("pointerdown", canvasPointerListener);
  };

  const onFocus = (view) => {
    if (!view) return;

    // Cleanup old view
    if (ea.targetView) {
      removeEventListeners(ea.targetView);
    }

    // Set new view
    ea.setView(view);

    // Setup new view
    setupEventListeners(view);
    
    // Update UI for new view selection
    ensureNodeSelected();
    updateUI();
    focusInputEl();
  };

  tab.onFocus = (view) => onFocus(view);

  const onActiveLeafChange = (leaf) => {
    if(!isUndocked || !floatingInputModal || !leaf) {
      return;
    }
    if (ea.isExcalidrawView(leaf.view)) {
      onFocus(leaf.view);
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
    if (popScope) popScope();
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