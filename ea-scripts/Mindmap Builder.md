/*

# Mind Map Builder: Technical Specification & User Guide

![](https://youtu.be/dZguonMP2KU)

## 1. Overview
**Mind Map Builder** transforms the Obsidian-Excalidraw canvas into a rapid brainstorming environment, allowing users to build complex, structured, and visually organized mind maps using primarily keyboard shortcuts.

The script balances **automation** (auto-layout, recursive grouping, and contrast-aware coloring) with **explicit flexibility** (node pinning and redirection logic), ensuring that the mind map stays organized even as it grows to hundreds of nodes.

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

### D. Visual Styling & Accessibility
- **Dynamic Contrast-Aware Coloring**: In "Multicolor Mode," Level 1 branches receive random colors validated for a minimum 3:1 contrast ratio against the current canvas background.
- **Stroke Styles**: Users can choose to inherit the **Scene Stroke Style** (Solid, Dashed, Dotted) or force an **Always Solid** style for branch connectors to maintain a clean appearance.

## 4. UI and User Experience

### Focus Mode (Minimized UI)
By clicking the **Minimize** icon, the modal collapses into a minimal input bar, hiding settings to maximize canvas visibility for power users.

### Keyboard Shortcuts
| Shortcut | Action |
| :--- | :--- |
| **ENTER** | Add a sibling node (stay on current parent). |
| **CMD/CTRL + ENTER** | Add a child and "drill down" (select the new node). |
| **CMD/CTRL + SHIFT + ENTER** | **Pin/Unpin** the location of the selected node. |
| **SHIFT + ENTER** | Add node and close the modal. |
| **ALT/OPT + ARROWS** | Navigate the mind map structure (parent/child/sibling). |

## 5. Settings and Persistence

### Global Settings
Persisted across sessions:
- **Max Text Width**: Point at which text wraps (Default: 450px).
- **Font Scales**: Choice of Normal, Fibonacci, or Scene-based sizes.
- **Recursive Grouping**: When enabled, groups sub-trees from the leaves upward.

### Map-Specific Persistence (customData)
- `growthMode`: Stored on the Root node (Radial, Left, or Right).
- `isPinned`: Stored on individual nodes to bypass the layout engine.
- `isBranch`: Stored on arrows to distinguish Mind Map connectors from standard annotations.

## 6. Special Logic Solutions

### The "mindmapNew" Tag
When a Level 1 node is created, it is temporarily tagged with `mindmapNew: true`. During the next layout cycle, the engine separates "Existing" nodes (which are sorted by their visual angle to allow manual re-ordering) from "New" nodes. New nodes are always appended to the end of the clockwise sequence. This prevents new nodes from "jumping" into the middle of an established branch order.

### Arrow Focus Redirection
When the script starts or the modal is re-activated, if an arrow is selected, the script automatically redirects selection to the `startBinding` node (or `endBinding`). If no bindings exist, it clears the selection. This prevents "Target: null" errors when the user accidentally clicks a connector.

### Recursive Grouping
When enabled, the script groups elements from the "leaves" upward. A leaf node is grouped with its parent and the connecting arrow. That group is then nested into the grandparent's group. The **Root Exception**: The root node is never part of an L1 group, allowing users to move the central idea or detach whole branches easily.

### Vertical Centering
All nodes use `textVerticalAlign: "middle"`. This ensures that connecting arrows always point to the geometric center of the text, maintaining visual alignment regardless of how many lines of text a node contains.

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

const FONT_SCALE_TYPES = ["Use scene fontsize", "Fibonacci Scale", "Normal Scale"];
const GROWTH_TYPES = ["Radial", "Right-facing", "Left-facing"];
const ZOOM_TYPES = ["Low","Medium","High"];

const api = () => ea.getExcalidrawAPI();
const appState = () => ea.getExcalidrawAPI().getAppState();
const getVal = (key, def) => ea.getScriptSettingValue(key, typeof def === "object" ? def: { value: def }).value;

const setVal = (key, value) => {
  //value here is only a fallback
  //when updating a setting value, the full ScriptSettingValue should be there
  //as defined on the ScriptSettingValue type.
  const def = ea.getScriptSettingValue(key, {value});
  def.value = value;
  ea.setScriptSettingValue(key, def);
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

const getZoom = () => {
  switch (zoomLevel) {
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

const INSTRUCTIONS = `
- **ENTER**: Add a sibling node and stay on the current parent for rapid entry.
- **${isMac ? "CMD" : "CTRL"} + ENTER**: Add a child node and "drill down" (follow the new node).
- **SHIFT + ENTER**: Dock/Undock floating input field.
- **${isMac ? "OPT" : "ALT"} + SHIFT + ENTER**: Box/Unbox selected node.
- **${isMac ? "CMD" : "CTRL"} + SHIFT + ENTER**: Pin/Unpin location of a node. Pinned nodes will not be touched by auto layout.
- **${isMac ? "OPT" : "ALT"} + Arrows**: Navigate through the mindmap nodes on the canvas.
- **${isMac ? "OPT" : "ALT"} + SHIFT + Arrows**: Navigate through the mindmap nodes on the canvas and zoom to element.
- **${isMac ? "OPT" : "ALT"} + C / X / V**: Copy, Cut, or Paste branches.
- **${isMac ? "OPT" : "ALT"} + Z**: Zoom to selected element.
- **ESC**: If input field is floating, closes Mindmap Builder
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

const getDynamicColor = (existingColors) => {
  const st = appState();
  const bg = st.viewBackgroundColor === "transparent" ? "#ffffff" : st.viewBackgroundColor;
  const candidates = [];
  for (let i = 0; i < 10; i++) {
    const hex =
      "#" +
      Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, "0");
    const cm = ea.getCM(hex);
    const contrast = cm.contrast({ bgColor: bg });
    let minDiff = 1000;
    existingColors.forEach((exHex) => {
      const exCM = ea.getCM(exHex);
      const d =
        Math.abs(cm.hue - exCM.hue) +
        Math.abs(cm.saturation - exCM.saturation) +
        Math.abs(cm.lightness - exCM.lightness);
      if (d < minDiff) {
        minDiff = d;
      }
    });
    candidates.push({ hex: cm.stringHEX(), contrast, diff: minDiff });
  }
  let viable = candidates.filter((c) => c.contrast >= 3);
  if (viable.length === 0) {
    viable = candidates;
  }
  viable.sort((a, b) => b.diff + b.contrast * 10 - (a.diff + a.contrast * 10));
  return viable[0].hex;
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

const zoomToFit = (pushUp = false) => {
  if (!ea.targetView) return;
  const sel = ea.getViewSelectedElement();
  if (sel) api().zoomToFit([sel],10,getZoom());
  if (pushUp) {
    setTimeout(() => {
      const st = appState();
      const zoom = st.zoom.value;
      const offset = (st.height / 4) / zoom;
      ea.viewUpdateScene({
        appState: {
          scrollY: st.scrollY - offset,
        }
      });
    });
  }
}

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
  sortChildrenStable(children);
  const subtreeHeight = getSubtreeHeight(nodeId, allElements);

  let currentY = currentYCenter - subtreeHeight / 2;

  children.forEach((child) => {
    const childH = getSubtreeHeight(child.id, allElements);

    layoutSubtree(
      child.id,
      effectiveSide === 1 ? currentX + node.width + GAP_X : currentX - GAP_X,
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
    const radius = Math.max(Math.round(root.width * 0.9), 260) + count * 12;

    let startAngle, angleStep;
    if (mode === "Right-facing") {
      // Range starts at 30 deg span (75 to 105) and expands by 30 each step
      const span = count <= 2 ? 30 : Math.min(120, 60 + (count - 3) * 30);
      startAngle = 90 - span / 2;
      angleStep = count <= 1 ? 0 : span / (count - 1);
    } else if (mode === "Left-facing") {
      // Mirror of Right-facing (centered at 270)
      const span = count <= 2 ? 30 : Math.min(120, 60 + (count - 3) * 30);
      startAngle = 270 + span / 2;
      angleStep = count <= 1 ? 0 : -span / (count - 1);
    } else {
      startAngle = count <= 6 ? 30 : 20;
      angleStep = count <= 6 ? 60 : 320 / (count - 1);
    }

    sortedL1.forEach((node, i) => {
      const angleRad = (startAngle + i * angleStep - 90) * (Math.PI / 180);
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

      // Apply recursive grouping to this L1 branch
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
    ea.style.strokeColor = getReadableColor(nodeColor);
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
    zoomToFit(ea.DEVICE.isMobile);
  }
  return finalNode;
};

// ---------------------------------------------------------------------------
// 5. Copy & Paste Engine
// ---------------------------------------------------------------------------
const getTextFromNode = (all, node) => {
  if (node.type === "text") return node.originalText;
  const textId = node.boundElements?.find((be) => be.type === "text")?.id;
  if (!textId) return "";
  const textEl = all.find((el) => el.id === textId);
  return textEl ? textEl.originalText : "";
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
const navigateMap = (key, zoom = false) => {
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
    const mode = root.customData?.growthMode || currentModalGrowthMode;
    if (mode === "Radial" && parent.id === root.id) {
      siblings.sort(
        (a, b) =>
          getAngleFromCenter(rootCenter, { x: a.x + a.width / 2, y: a.y + a.height / 2 }) -
          getAngleFromCenter(rootCenter, { x: b.x + b.width / 2, y: b.y + b.height / 2 }),
      );
    } else {
      sortChildrenStable(siblings);
    }
    const idx = siblings.findIndex((s) => s.id === current.id);
    const nIdx = key === "ArrowUp"
      ? (idx - 1 + siblings.length) % siblings.length
      : (idx + 1) % siblings.length;
    ea.selectElementsInView([siblings[idx === -1 ? 0 : nIdx]]);
  }
  if (zoom) zoomToFit();
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
    await refreshMapLayout();
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
  await refreshMapLayout();
};

// ---------------------------------------------------------------------------
// 7. UI Modal & Sidepanel Logic
// ---------------------------------------------------------------------------

let detailsEl, inputEl, bodyContainer, strategyDropdown, autoLayoutToggle;
let pinBtn, refreshBtn, cutBtn, copyBtn, boxBtn, dockBtn;
let inputContainer;
let helpContainer;
let floatingInputModal = null;
let sidepanelWindow;
let popScope = null;

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

  reg(["Mod"], "Enter");
  reg(["Shift"], "Enter");
  reg(["Mod", "Shift"], "Enter");
  reg(["Alt", "Shift"], "Enter");

  ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].forEach(k => {
    reg(["Alt"], k);
    reg(["Alt", "Shift"], k);
  });

  ["c", "x", "v", "z"].forEach(k => reg(["Alt"], k));

  popScope = () => {
    handlers.forEach(h => scope.unregister(h));
    popScope = null;
  };
};


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
        } the location of the selected element (${isMac ? "CMD" : "CTRL"}+SHIFT+Enter)`,
      );
      setButtonDisabled(pinBtn, false);
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

const renderInput = (container, isFloating = false) => {
  container.empty();
  
  pinBtn = refreshBtn = boxBtn = dockBtn = inputEl = null;

  let inputRow = new ea.obsidian.Setting(container);
  
  if (!isFloating) {
    inputRow.setName("Node Text");
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
    if (!isFloating) {
      inputEl.style.width = "100%";
    } else {
      inputEl.style.width = "70vw";
      inputEl.style.maxWidth = "350px";
    }
    inputEl.placeholder = "Concept...";

    inputEl.addEventListener("focus", registerMindmapHotkeys);
    inputEl.addEventListener("blur", () => {
      if (popScope) popScope();
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
    pinBtn = btn;
    btn.onClick(async () => {
      await togglePin();
      updateUI();
      inputEl.focus();
    });
  });

  addButton((btn) => {
    boxBtn = btn;
    btn.setIcon("rectangle-horizontal");
    btn.setTooltip(`Toggle node box. (${isMac ? "OPT" : "ALT"}+SHIFT+Enter)`);
    btn.onClick(async () => {
      await toggleBox();
      inputEl.focus();
    });
  });

  addButton((btn) => {
    refreshBtn = btn;
    btn.setIcon("refresh-ccw");
    btn.setTooltip("Force auto rearrange map.");
    btn.onClick(async () => {
      await refreshMapLayout();
      inputEl.focus();
    });
  });

  addButton((btn) => {
    dockBtn = btn;
    btn.setIcon(isFloating ? "dock" : "external-link");
    btn.setTooltip(
      (isFloating ? "Dock to Sidepanel" : "Undock to Floating Modal") + " (SHIFT+Enter)"
    );
    btn.onClick(async () => {
      await toggleDock();
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
    inputEl.focus();
    updateUI();
  };
  btnGrid.createEl("button", { text: "Add+Follow", attr: { style: "padding: 2px;" } }).onclick = async () => {
    await addNode(inputEl.value, true);
    inputEl.value = "";
    inputEl.focus();
    updateUI();
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
        zoomToFit(ea.DEVICE.isMobile);
      });
  });
  zoomSetting.addExtraButton(btn=>btn
    .setIcon("scan-search")
    .onClick(()=>{
      zoomToFit(ea.DEVICE.isMobile);
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
};

const updateKeyHandlerLocation = () => {
  // Remove listener from both potential sources to ensure no duplication
  if (sidepanelWindow) {
    sidepanelWindow.removeEventListener("keydown", keyHandler, true);
  }
  if (ea.targetView && ea.targetView.ownerWindow) {
    ea.targetView.ownerWindow.removeEventListener("keydown", keyHandler, true);
  }

  // Attach to the appropriate window based on state
  if (isUndocked) {
    // Floating: Input is reparented to targetView's window
    if (ea.targetView && ea.targetView.ownerWindow) {
      ea.targetView.ownerWindow.addEventListener("keydown", keyHandler, true);
    }
  } else {
    // Docked: Input is in the sidepanel's window
    if (sidepanelWindow) {
      sidepanelWindow.addEventListener("keydown", keyHandler, true);
    }
  }
};

const toggleDock = async (silent = false, forceDock = false) => {
  if (!ea.targetView && !forceDock) return;
  
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
  setVal(K_UNDOCKED, isUndocked);
  dirty = true;

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

const keyHandler = async (e) => {
  // Determine which window the input is currently in
  const currentWindow = isUndocked && floatingInputModal 
    ? ea.targetView?.ownerWindow 
    : sidepanelWindow;

  if (!currentWindow) return;
  
  // Check if the input element is actually focused
  if (currentWindow.document?.activeElement !== inputEl) return;

  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    if (isUndocked) {
      // Dock silently (don't reveal sidepanel)
      toggleDock(true);
    }
    return;
  }

  if (e.key === "Enter" && e.shiftKey && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    e.stopPropagation();
    await togglePin();
    updateUI();
    inputEl.focus();
    return;
  }

  if (e.key === "Enter" && e.shiftKey && e.altKey) {
    e.preventDefault();
    e.stopPropagation();
    await toggleBox();
    inputEl.focus();
    return;
  }

  if (e.altKey) {
    if (e.code === "KeyC") {
      e.preventDefault();
      copyMapAsText(false);
      return;
    }
    if (e.code === "KeyX") {
      e.preventDefault();
      copyMapAsText(true);
      return;
    }
    if (e.code === "KeyV") {
      e.preventDefault();
      pasteListToMap();
      return;
    }
    if (e.code === "KeyZ") {
      e.preventDefault();
      zoomToFit();
      return;
    }

    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault();
      navigateMap(e.key, e.shiftKey);
      updateUI();
      return;
    }
  }
  if (e.key === "Enter") {
    e.preventDefault();
    e.stopPropagation();
    if (e.shiftKey) {
      if (inputEl.value) {
        await addNode(inputEl.value, false);
      }
      toggleDock();
      return;
    }
    if (!inputEl.value) return;
    if (e.ctrlKey || e.metaKey) {
      await addNode(inputEl.value, true);
      inputEl.value = "";
      updateUI();
    } else {
      await addNode(inputEl.value, false);
      inputEl.value = "";
      updateUI();
    }
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
    if (sidepanelWindow && sidepanelWindow !== newWin) {
      sidepanelWindow.removeEventListener("keydown", keyHandler, true);
    }
    sidepanelWindow = newWin;
    // If we are docked, re-attach to the new window immediately
    if (!isUndocked && sidepanelWindow) {
      sidepanelWindow.addEventListener("keydown", keyHandler, true);
    }
  };

  // When the view closes, ensure we dock the input back so it's not lost in floating limbo
  tab.onExcalidrawViewClosed = () => {
    if (isUndocked) {
      toggleDock(true, true); // Silent dock
    }
  };

  tab.onOpen = () => {
    const contentEl = tab.contentEl;
    contentEl.empty();
    
    renderHelp(contentEl);
    inputContainer = contentEl.createDiv(); 
    renderBody(contentEl);

    sidepanelWindow = contentEl.ownerDocument.defaultView;

    if (isUndocked) {
      toggleDock(); 
    } else {
      renderInput(inputContainer, false);
    }

    ensureNodeSelected();
    updateUI();
    setTimeout(() => inputEl?.focus(), 200);
  };

  const setupEventListeners = (view) => {
    if (!view || !view.ownerWindow) return;
    
    view.ownerWindow.addEventListener("pointerdown", canvasPointerListener);

    updateKeyHandlerLocation();
  };

  const removeEventListeners = (view) => {
    if (!view || !view.ownerWindow) return;
    view.ownerWindow.removeEventListener("pointerdown", canvasPointerListener);

    if (sidepanelWindow) {
      sidepanelWindow.removeEventListener("keydown", keyHandler, true);
    }
    // Clean up view window listener
    if (view.ownerWindow && view.ownerWindow !== sidepanelWindow) {
      view.ownerWindow.removeEventListener("keydown", keyHandler, true);
    }
  };

  tab.onFocus = (view) => {
    if (!view) return;
    if (view === ea.targetView) return;

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
  };

  tab.onClose = async () => {
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
    if (dirty) {
      await ea.saveScriptSettings();
    }
  };

  // Initial setup if a view is already active
  if (ea.targetView) {
    setupEventListeners(ea.targetView);
  }
  tab.open();
});