/*
```js
MINDMAP Builder
==========================
Shortcuts (when input is focused):
- ENTER: Add sibling
- CTRL/CMD + ENTER: Drill down (follow new node)
- SHIFT + ENTER: Add and Close
- ALT/OPT + ARROWS: Navigate map nodes
*/

if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("2.18.3")) {
  new Notice("Please update the Excalidraw Plugin to version 2.18.3 or higher.");
  return;
}

// ---------------------------------------------------------------------------
// 1. Settings & Persistence Initialization
// ---------------------------------------------------------------------------
let dirty = false;
const K_WIDTH = "Max Text Width";
const K_FIBO = "Use Fibonacci";
const K_BOX = "Box Children";
const K_ROUND = "Rounded Corners";
const K_GROWTH = "Growth Mode";
const K_MULTICOLOR = "Multicolor Mode";

const getVal = (key, def) => ea.getScriptSettingValue(key, { value: def }).value;

let maxWidth = parseInt(getVal(K_WIDTH, 200));
let useFibonacci = getVal(K_FIBO, false) === true;
let boxChildren = getVal(K_BOX, false) === true;
let roundedCorners = getVal(K_ROUND, true) === true;
let multicolor = getVal(K_MULTICOLOR, true) === true;
let currentModalGrowthMode = getVal(K_GROWTH, "Radial");
let autoLayoutDisabled = false;

const NORMAL_SIZES = [36, 28, 20, 16]; 
const FIBO_SIZES = [68, 42, 26, 16];
const STROKE_WIDTHS = [4, 4, 2, 1, 0.5]; 
const ownerWindow = ea.targetView.ownerWindow;
const isMac = ea.DEVICE.isMacOS || ea.DEVICE.isIOS;

const INSTRUCTIONS = `
- **ENTER**: Add a sibling node and stay on the current parent for rapid entry.
- **${isMac ? "CMD" : "CTRL"} + ENTER**: Add a child node and "drill down" (automatically select the new node).
- **SHIFT + ENTER**: Add the node and close the modeler.
- **${isMac ? "OPT" : "ALT"} + Arrows**: Navigate through the mindmap nodes on the canvas.
- **Coloring**: L1 branches get unique colors (Multicolor mode). Descendants (L2+) always inherit their parent's color.
- **Growth Strategy**: Stored in the central node. Existing maps maintain their style automatically.
- **Copy/Paste**: Export/Import indented Markdown lists.
`;

// ---------------------------------------------------------------------------
// 2. Traversal & Geometry Helpers
// ---------------------------------------------------------------------------

const getParentNode = (id, allElements) => {
  const arrow = allElements.find(el => el.type === "arrow" && el.endBinding?.elementId === id);
  if (!arrow) return null;
  const parent = allElements.find(el => el.id === arrow.startBinding?.elementId);
  return parent?.containerId ? allElements.find(el => el.id === parent.containerId) : parent;
};

const getChildrenNodes = (id, allElements) => {
  const arrows = allElements.filter(el => el.type === "arrow" && el.startBinding?.elementId === id);
  return arrows.map(a => allElements.find(el => el.id === a.endBinding?.elementId)).filter(Boolean);
};

const getHierarchy = (el, allElements) => {
  let depth = 0, curr = el, l1Id = el.id, rootId = el.id;
  while (true) {
    let p = getParentNode(curr.id, allElements);
    if (!p) { rootId = curr.id; break; }
    l1Id = curr.id;
    curr = p;
    depth++;
  }
  return { depth, l1AncestorId: l1Id, rootId };
};

const getAngleFromCenter = (center, point) => {
  let dx = point.x - center.x, dy = point.y - center.y;
  let angle = Math.atan2(dx, -dy) * (180 / Math.PI);
  return (angle < 0) ? angle + 360 : angle;
};

const getDynamicColor = (existingColors) => {
  const st = ea.getExcalidrawAPI().getAppState();
  const bg = st.viewBackgroundColor === "transparent" ? "#ffffff" : st.viewBackgroundColor;
  const candidates = [];
  for (let i = 0; i < 10; i++) {
    const hex = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    const cm = ea.getCM(hex);
    const contrast = cm.contrast({ bgColor: bg });
    let minDiff = 1000;
    existingColors.forEach(exHex => {
      const exCM = ea.getCM(exHex);
      const d = Math.abs(cm.hue - exCM.hue) + Math.abs(cm.saturation - exCM.saturation) + Math.abs(cm.lightness - exCM.lightness);
      if (d < minDiff) minDiff = d;
    });
    candidates.push({ hex: cm.stringHEX(), contrast, diff: minDiff });
  }
  let viable = candidates.filter(c => c.contrast >= 3);
  if (viable.length === 0) viable = candidates; 
  viable.sort((a, b) => (b.diff + b.contrast * 10) - (a.diff + a.contrast * 10));
  return viable[0].hex;
};

const getReadableColor = (hex) => {
  const bg = ea.getExcalidrawAPI().getAppState().viewBackgroundColor;
  const cm = ea.getCM(hex);
  return ea.getCM(bg).isDark() ? cm.lightnessTo(80).stringHEX() : cm.lightnessTo(35).stringHEX();
};

// ---------------------------------------------------------------------------
// 3. Layout Engine
// ---------------------------------------------------------------------------

const GAP_X = 140, GAP_Y = 30;

const getSubtreeHeight = (nodeId, allElements) => {
  const children = getChildrenNodes(nodeId, allElements);
  if (children.length === 0) return allElements.find(el => el.id === nodeId).height;
  const total = children.reduce((sum, child) => sum + getSubtreeHeight(child.id, allElements), 0);
  return Math.max(allElements.find(el => el.id === nodeId).height, total + (children.length - 1) * GAP_Y);
};

const layoutSubtree = (nodeId, x, centerY, side, allElements) => {
  const node = allElements.find(el => el.id === nodeId);
  const eaNode = ea.getElement(nodeId);
  eaNode.x = side === 1 ? x : x - node.width;
  eaNode.y = centerY - node.height / 2;
  const children = getChildrenNodes(nodeId, allElements);
  children.sort((a, b) => a.y - b.y);
  const subtreeHeight = getSubtreeHeight(nodeId, allElements);
  let currentY = centerY - subtreeHeight / 2;
  children.forEach(child => {
    const childH = getSubtreeHeight(child.id, allElements);
    layoutSubtree(child.id, side === 1 ? eaNode.x + node.width + GAP_X : eaNode.x - GAP_X, currentY + childH / 2, side, allElements);
    currentY += childH + GAP_Y;
    const arrow = allElements.find(a => a.type === "arrow" && a.startBinding?.elementId === nodeId && a.endBinding?.elementId === child.id);
    if (arrow) {
      const eaArrow = ea.getElement(arrow.id), eaChild = ea.getElement(child.id);
      const sX = eaNode.x + eaNode.width/2, sY = eaNode.y + eaNode.height/2;
      const eX = eaChild.x + eaChild.width/2, eY = eaChild.y + eaChild.height/2;
      eaArrow.x = sX; eaArrow.y = sY;
      eaArrow.points = [[0, 0], [eX - sX, eY - sY]];
    }
  });
};

const triggerGlobalLayout = (rootId) => {
  const allElements = ea.getViewElements();
  const root = allElements.find(el => el.id === rootId);
  ea.copyViewElementsToEAforEditing(allElements);

  const l1Nodes = getChildrenNodes(rootId, allElements);
  if (l1Nodes.length === 0) return;

  const mode = root.customData?.growthMode || currentModalGrowthMode;
  const rootCenter = { x: root.x + root.width / 2, y: root.y + root.height / 2 };
  
  const existingL1 = l1Nodes.filter(n => !n.customData?.mindmapNew);
  const newL1 = l1Nodes.filter(n => n.customData?.mindmapNew);
  
  if (mode === "Radial") {
    existingL1.sort((a, b) => getAngleFromCenter(rootCenter, {x: a.x + a.width/2, y: a.y + a.height/2}) - getAngleFromCenter(rootCenter, {x: b.x + b.width/2, y: b.y + b.height/2}));
  } else {
    existingL1.sort((a, b) => a.y - b.y);
  }
  
  const sortedL1 = [...existingL1, ...newL1];
  const count = sortedL1.length;
  const radius = 260 + (count * 12);
  
  let startAngle, angleStep;
  if (mode === "Right-facing") { startAngle = 20; angleStep = count <= 1 ? 0 : 140 / (count - 1); }
  else if (mode === "Left-facing") { startAngle = 340; angleStep = count <= 1 ? 0 : -140 / (count - 1); }
  else { startAngle = count <= 6 ? 30 : 20; angleStep = count <= 6 ? 60 : (320 / (count - 1)); }

  sortedL1.forEach((node, i) => {
    const angleRad = (startAngle + (i * angleStep) - 90) * (Math.PI / 180);
    const tCX = rootCenter.x + radius * Math.cos(angleRad);
    const tCY = rootCenter.y + radius * Math.sin(angleRad);
    
    const currentDist = Math.hypot((node.x + node.width/2) - rootCenter.x, (node.y + node.height/2) - rootCenter.y);
    const isPinned = !node.customData?.mindmapNew && currentDist > radius * 1.5;
    const side = (isPinned ? (node.x + node.width/2 > rootCenter.x) : (tCX > rootCenter.x)) ? 1 : -1;
    
    if (isPinned) layoutSubtree(node.id, node.x, node.y + node.height/2, side, allElements);
    else layoutSubtree(node.id, tCX - node.width/2, tCY, side, allElements);

    if (node.customData?.mindmapNew) ea.addAppendUpdateCustomData(node.id, { mindmapNew: undefined });

    const arrow = allElements.find(a => a.type === "arrow" && a.startBinding?.elementId === rootId && a.endBinding?.elementId === node.id);
    if (arrow) {
      const eaA = ea.getElement(arrow.id), eaC = ea.getElement(node.id);
      const eX = eaC.x + eaC.width/2, eY = eaC.y + eaC.height/2;
      eaA.x = rootCenter.x; eaA.y = rootCenter.y; eaA.points = [[0, 0], [eX - rootCenter.x, eY - rootCenter.y]];
    }
  });
};

// ---------------------------------------------------------------------------
// 4. Add Node Logic
// ---------------------------------------------------------------------------

const addNode = async (text, follow = false) => {
  if (!text || text.trim() === "") return;
  const allElements = ea.getViewElements();
  const st = ea.getExcalidrawAPI().getAppState();
  let parent = ea.getViewSelectedElement();
  if (parent?.containerId) parent = allElements.find(el => el.id === parent.containerId);

  let depth = 0, nodeColor = "black", rootId;
  if (parent) {
    const info = getHierarchy(parent, allElements);
    depth = info.depth + 1; rootId = info.rootId;
    const rootEl = allElements.find(e => e.id === rootId);
    
    if (depth === 1) {
        if (multicolor) {
            const existingColors = getChildrenNodes(parent.id, allElements).map(n => n.strokeColor);
            nodeColor = getDynamicColor(existingColors);
        } else {
            nodeColor = rootEl.strokeColor;
        }
    } else {
        nodeColor = parent.strokeColor;
    }
  }

  const fontScale = useFibonacci ? FIBO_SIZES : NORMAL_SIZES;
  ea.clear();
  ea.style.fontFamily = st.currentItemFontFamily; 
  ea.style.fontSize = fontScale[Math.min(depth, fontScale.length - 1)];
  ea.style.roundness = roundedCorners ? { type: 3 } : null;

  const curMaxW = depth === 0 ? 400 : maxWidth;
  const metrics = ea.measureText(text);
  const shouldWrap = metrics.width > curMaxW;

  let newNodeId;
  if (!parent) {
    ea.style.strokeColor = multicolor ? "black" : st.currentItemStrokeColor;
    newNodeId = ea.addText(0, 0, text, { box: "rectangle", textAlign: "center", textVerticalAlign: "middle", width: shouldWrap ? curMaxW : undefined, autoResize: !shouldWrap });
    ea.addAppendUpdateCustomData(newNodeId, { growthMode: currentModalGrowthMode, autoLayoutDisabled: false });
    rootId = newNodeId;
  } else {
    ea.style.strokeColor = getReadableColor(nodeColor);
    
    // Positioning for Manual Mode (No Auto Layout)
    let px = parent.x, py = parent.y;
    if (autoLayoutDisabled) {
      const rootEl = allElements.find(e => e.id === rootId);
      const rootCenter = { x: rootEl.x + rootEl.width / 2, y: rootEl.y + rootEl.height / 2 };
      const side = (parent.x + parent.width/2 > rootCenter.x) ? 1 : -1;
      const manualGapX = 220; 
      const jitterX = (Math.random() - 0.5) * 100;
      const jitterY = (Math.random() - 0.5) * 100;
      const nodeW = shouldWrap ? maxWidth : metrics.width;
      px = side === 1 ? parent.x + parent.width + manualGapX + jitterX : parent.x - manualGapX - nodeW + jitterX;
      py = (parent.y + parent.height/2) - (metrics.height / 2) + jitterY;
    }

    newNodeId = ea.addText(px, py, text, { box: boxChildren ? "rectangle" : false, textAlign: boxChildren ? "center" : "left", textVerticalAlign: "middle", width: shouldWrap ? maxWidth : undefined, autoResize: !shouldWrap });
    if (depth === 1) ea.addAppendUpdateCustomData(newNodeId, { mindmapNew: true });
    
    ea.copyViewElementsToEAforEditing([parent]);
    ea.style.strokeWidth = STROKE_WIDTHS[Math.min(depth, STROKE_WIDTHS.length - 1)];
    const startPoint = [parent.x + parent.width/2, parent.y + parent.height/2];
    ea.addArrow([startPoint, startPoint], { startObjectId: parent.id, endObjectId: newNodeId, startArrowHead: null, endArrowHead: null });
  }

  await ea.addElementsToView(!parent, false, true, true);
  
  if (rootId && !autoLayoutDisabled) { 
    triggerGlobalLayout(rootId); 
    await ea.addElementsToView(false, false, true, true); 
  } else if (rootId && autoLayoutDisabled && parent) {
    const allEls = ea.getViewElements();
    const node = allEls.find(el => el.id === newNodeId);
    const arrow = allEls.find(a => a.type === "arrow" && a.endBinding?.elementId === newNodeId);
    if (arrow) {
      ea.copyViewElementsToEAforEditing([arrow]);
      const eaA = ea.getElement(arrow.id);
      const sX = parent.x + parent.width/2, sY = parent.y + parent.height/2;
      const eX = node.x + node.width/2, eY = node.y + node.height/2;
      eaA.x = sX; eaA.y = sY;
      eaA.points = [[0, 0], [eX - sX, eY - sY]];
      await ea.addElementsToView(false, false, true, true);
    }
  }

  const finalNode = ea.getViewElements().find(el => el.id === newNodeId);
  if (follow || !parent) ea.selectElementsInView([finalNode]);
  else if (parent) ea.selectElementsInView([parent]);
  return finalNode;
};

// ---------------------------------------------------------------------------
// 5. Copy & Paste Engine
// ---------------------------------------------------------------------------
const getText = (all, node) => {
  if (node.type === "text") return node.originalText;
  const textId = node.boundElements.find(be => be.type==="text")?.id;
  if (!textId) return "";
  textEl = all.find(el=>el.id === textId);
  if (!textEl) return "";
  return textEl.originalText;
}

const copyMapAsText = async () => {
  const sel = ea.getViewSelectedElement();
  if (!sel) return;
  const all = ea.getViewElements();
  const info = getHierarchy(sel, all);
  const rootNode = all.find(e => e.id === info.rootId);
  
  const buildList = (nodeId, depth = 0) => {
    const node = all.find(e => e.id === nodeId);
    const children = getChildrenNodes(nodeId, all);
    // Sort visually for export
    children.sort((a,b) => a.y - b.y);
    
    let str = "";
    const text = getText(all,node);
    if (depth === 0) str += `# ${text}\n\n`;
    else str += `${"  ".repeat(depth - 1)}- ${text}\n`;
    
    children.forEach(c => { str += buildList(c.id, depth + 1); });
    return str;
  };

  const md = buildList(rootNode.id);
  await navigator.clipboard.writeText(md);
  new Notice("Mindmap copied to clipboard as list.");
};

const pasteListToMap = async () => {
  const text = await navigator.clipboard.readText();
  if (!text) return;

  const lines = text
    .split(/\r\n|\n|\r/)
    .map(l => l.trimEnd())
    .filter(l => l.trim() !== "");

  let parsed = [];
  let rootText = null;

  lines.forEach(line => {
    if (line.startsWith("# ")) {
      rootText = line.substring(2).trim();
    } else {
      const match = line.match(/^(\s*)(?:-|\*|\d+\.)\s+(.*)$/);
      if (match) {
        parsed.push({ indent: match[1].length, text: match[2].trim() });
      }
    }
  });

  if (parsed.length === 0 && !rootText) return;

  const sel = ea.getViewSelectedElement();
  let currentParentId = sel?.id;

  // Handle root creation if no selection
  if (!currentParentId) {
    if (rootText) {
      const root = await addNode(rootText, true);
      currentParentId = root.id;
    } else if (parsed.length > 0) {
      // Check if there is only one top-level item
      const topLevel = parsed.filter(p => p.indent === parsed[0].indent);
      if (topLevel.length === 1) {
        const root = await addNode(topLevel[0].text, true);
        currentParentId = root.id;
        parsed.shift();
      } else {
        const root = await addNode("Mindmap Builder Paste", true);
        currentParentId = root.id;
      }
    }
  }

  // Recursive paste
  const stack = [{ id: currentParentId, indent: -1 }];
  for (const item of parsed) {
    while (stack.length > 1 && item.indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const newNode = await addNode(item.text, false);
    stack.push({ id: newNode.id, indent: item.indent });
    // This is batch adding, so we need to sync parent for each iteration
    const arrows = ea.getViewElements().filter(el => el.type === "arrow");
    const arrow = arrows.find(a => a.endBinding?.elementId === newNode.id);
    if (arrow) {
      ea.copyViewElementsToEAforEditing([arrow]);
      const eaA = ea.getElement(arrow.id);
      const pNode = ea.getViewElements().find(e => e.id === stack[stack.length-2].id);
      const sX = pNode.x + pNode.width/2, sY = pNode.y + pNode.height/2;
      const eX = newNode.x + newNode.width/2, eY = newNode.y + newNode.height/2;
      eaA.x = sX; eaA.y = sY; eaA.points = [[0, 0], [eX - sX, eY - sY]];
      await ea.addElementsToView(false, false, true, true);
    }
  }
  new Notice("Paste complete.");
};

// ---------------------------------------------------------------------------
// 6. Navigation & Modal UI
// ---------------------------------------------------------------------------

const navigateMap = (key) => {
  const allElements = ea.getViewElements();
  const current = ea.getViewSelectedElement();
  if (!current) return;
  const info = getHierarchy(current, allElements);
  const root = allElements.find(e => e.id === info.rootId);
  const rootCenter = { x: root.x + root.width/2, y: root.y + root.height/2 };
  if (current.id === root.id) {
    const children = getChildrenNodes(root.id, allElements);
    if (children.length) ea.selectElementsInView([children[0]]);
    return;
  }
  if (key === "ArrowLeft" || key === "ArrowRight") {
    const curCenter = { x: current.x + current.width/2, y: current.y + current.height/2 };
    const isInRight = curCenter.x > rootCenter.x;
    const goIn = (key === "ArrowLeft" && isInRight) || (key === "ArrowRight" && !isInRight);
    if (goIn) ea.selectElementsInView([getParentNode(current.id, allElements)]);
    else { const ch = getChildrenNodes(current.id, allElements); if (ch.length) ea.selectElementsInView([ch[0]]); }
  } else if (key === "ArrowUp" || key === "ArrowDown") {
    const parent = getParentNode(current.id, allElements), siblings = getChildrenNodes(parent.id, allElements);
    const mode = root.customData?.growthMode || currentModalGrowthMode;
    if (mode === "Radial") {
        siblings.sort((a, b) => getAngleFromCenter(rootCenter, {x: a.x + a.width/2, y: a.y + a.height/2}) - getAngleFromCenter(rootCenter, {x: b.x + b.width/2, y: b.y + b.height/2}));
    } else {
        siblings.sort((a, b) => a.y - b.y);
    }
    const idx = siblings.findIndex(s => s.id === current.id);
    const nIdx = key === "ArrowUp" ? (idx - 1 + siblings.length) % siblings.length : (idx + 1) % siblings.length;
    ea.selectElementsInView([siblings[idx === -1 ? 0 : nIdx]]);
  }
};

const modal = new ea.FloatingModal(app);
modal.onOpen = () => {
  const { contentEl } = modal; contentEl.empty(); modal.titleEl.setText("Mind Map Builder");
  
  const details = contentEl.createEl("details");
  details.createEl("summary", { text: "Instructions & Shortcuts" });
  ea.obsidian.MarkdownRenderer.render(app, INSTRUCTIONS, details.createDiv(), "", ea.plugin);

  const statusEl = contentEl.createDiv({ attr: { style: "font-size:0.85em; color:var(--text-accent); font-weight:bold; margin:12px 0; border-bottom:1px solid var(--background-modifier-border); padding-bottom:5px;" }});
  
  let strategyDropdown, autoLayoutToggle;
  const updateStatus = () => {
    const all = ea.getViewElements();
    const sel = ea.getViewSelectedElement();
    const name = sel?.text || (sel?.type === "rectangle" ? "Root" : null);
    statusEl.setText(name ? `Targeting: ${name.substring(0,30)}` : "Target: New Central Node");
    
    if (sel) {
        const info = getHierarchy(sel, all);
        const root = all.find(e => e.id === info.rootId);
        const mapStrategy = root.customData?.growthMode;
        if (mapStrategy && mapStrategy !== currentModalGrowthMode) {
            currentModalGrowthMode = mapStrategy;
            strategyDropdown.setValue(mapStrategy);
        }
        const mapLayoutPref = root.customData?.autoLayoutDisabled === true;
        if (mapLayoutPref !== autoLayoutDisabled) {
          autoLayoutDisabled = mapLayoutPref;
          autoLayoutToggle.setValue(mapLayoutPref);
        }
    }
  };

  let inputEl;
  new ea.obsidian.Setting(contentEl).setName("Node Text").addText(text => {
      inputEl = text.inputEl; inputEl.style.width = "100%"; inputEl.placeholder = "Enter concept...";
  }).settingEl.style.display = "block";

  new ea.obsidian.Setting(contentEl).setName("Growth Strategy").addDropdown(d => {
    strategyDropdown = d;
    d.addOptions({ "Radial": "Radial", "Right-facing": "Right-facing", "Left-facing": "Left-facing" })
    .setValue(currentModalGrowthMode)
    .onChange(async v => { 
      currentModalGrowthMode = v;
      ea.setScriptSettingValue(K_GROWTH, { value: v }); dirty = true; 
      const sel = ea.getViewSelectedElement();
      if (sel) {
        const info = getHierarchy(sel, ea.getViewElements());
        ea.copyViewElementsToEAforEditing(ea.getViewElements().filter(e => e.id === info.rootId));
        ea.addAppendUpdateCustomData(info.rootId, { growthMode: v });
        await ea.addElementsToView(false, false, true, true);
        if (!autoLayoutDisabled) {
          triggerGlobalLayout(info.rootId);
          await ea.addElementsToView(false, false, true, true);
        }
      }
    });
  });

  autoLayoutToggle = new ea.obsidian.Setting(contentEl).setName("Disable Auto-Layout").addToggle(t => t
    .setValue(autoLayoutDisabled)
    .onChange(async v => {
      autoLayoutDisabled = v;
      const sel = ea.getViewSelectedElement();
      if (sel) {
        const info = getHierarchy(sel, ea.getViewElements());
        ea.copyViewElementsToEAforEditing(ea.getViewElements().filter(e => e.id === info.rootId));
        ea.addAppendUpdateCustomData(info.rootId, { autoLayoutDisabled: v });
        await ea.addElementsToView(false, false, true, true);
      }
    })
  ).components[0];

  new ea.obsidian.Setting(contentEl).setName("Multicolor Branches").addToggle(t => t.setValue(multicolor).onChange(v => { multicolor = v; ea.setScriptSettingValue(K_MULTICOLOR, { value: v }); dirty = true; }));

  let sliderValDisplay;
  const sliderSetting = new ea.obsidian.Setting(contentEl).setName("Max Wrap Width").addSlider(s => s.setLimits(100, 600, 10).setValue(maxWidth).onChange(async (v) => {
        maxWidth = v; sliderValDisplay.setText(`${v}px`); ea.setScriptSettingValue(K_WIDTH, { value: v }); dirty = true;
  }));
  sliderValDisplay = sliderSetting.descEl.createSpan({ text: `${maxWidth}px`, attr: { style: "margin-left:10px; font-weight:bold;" }});

  new ea.obsidian.Setting(contentEl).setName("Fibonacci Scale").addToggle(t => t.setValue(useFibonacci).onChange(v => { useFibonacci = v; ea.setScriptSettingValue(K_FIBO, { value: v }); dirty = true; }));
  new ea.obsidian.Setting(contentEl).setName("Box Child Nodes").addToggle(t => t.setValue(boxChildren).onChange(v => { boxChildren = v; ea.setScriptSettingValue(K_BOX, { value: v }); dirty = true; }));
  new ea.obsidian.Setting(contentEl).setName("Rounded Corners").addToggle(t => t.setValue(roundedCorners).onChange(v => { roundedCorners = v; ea.setScriptSettingValue(K_ROUND, { value: v }); dirty = true; }));

  const btnGrid = contentEl.createDiv({ attr: { style: "display: grid; grid-template-columns: repeat(5, 1fr); gap:6px; margin-top:20px;" }});
  btnGrid.createEl("button", { text: "Sibling", cls: "mod-cta" }).onclick = async () => { await addNode(inputEl.value, false); inputEl.value = ""; inputEl.focus(); updateStatus(); };
  btnGrid.createEl("button", { text: "Follow" }).onclick = async () => { await addNode(inputEl.value, true); inputEl.value = ""; inputEl.focus(); updateStatus(); };
  btnGrid.createEl("button", { text: "Close" }).onclick = async () => { await addNode(inputEl.value, false); modal.close(); };
  btnGrid.createEl("button", { text: "Copy" }).onclick = copyMapAsText;
  btnGrid.createEl("button", { text: "Paste" }).onclick = pasteListToMap;

  const keyHandler = async (e) => {
    if (ownerWindow.document.activeElement !== inputEl) return;
    if (e.altKey) { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) { e.preventDefault(); navigateMap(e.key); updateStatus(); return; }}
    if (e.key === "Enter") {
      e.preventDefault(); e.stopPropagation();
      if (!inputEl.value) return;
      if (e.shiftKey) { await addNode(inputEl.value, false); modal.close(); }
      else if (e.ctrlKey || e.metaKey) { await addNode(inputEl.value, true); inputEl.value = ""; updateStatus(); }
      else { await addNode(inputEl.value, false); inputEl.value = ""; updateStatus(); }
    }
  };

  ownerWindow.addEventListener("keydown", keyHandler, true);
  updateStatus();
  const monitor = setInterval(updateStatus, 1000);
  modal.onClose = async () => { clearInterval(monitor); ownerWindow.removeEventListener("keydown", keyHandler, true); if (dirty) await ea.saveScriptSettings(); };
  setTimeout(() => inputEl.focus(), 200);
};

modal.open();