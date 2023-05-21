/*

format **the left to right** mind map

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-mindmap-format-1.png)

# tree

Mind map is actually a tree, so you must have a **root node**. The script will determine **the leftmost element** of the selected element as the root element (node is excalidraw element, e.g. rectangle, diamond, ellipse, text, image, but it can't be arrow, line, freedraw, **group**)

The element connecting node and node must be an **arrow** and  have the correct direction, e.g. **parent node -> children node**

# sort

The order of nodes in the Y axis or vertical direction is determined by **the creation time** of the arrow connecting it

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-mindmap-format-2.png)

So if you want to readjust the order, you can **delete arrows and reconnect them**

# setting

Script provides options to adjust the style of mind map, The option is at the bottom of the option of the exalidraw plugin(e.g. Settings -> Community plugins -> Excalidraw -> drag to bottom)

# problem

1. since the start bingding and end bingding of the arrow are easily disconnected from the node, so if there are unformatted parts, please **check the connection** and use the script to **reformat**

```javascript
*/

let settings = ea.getScriptSettings();
//set default values on first run
if (!settings["MindMap Format"]) {
  settings = {
    "MindMap Format": {
      value: "Excalidraw/MindMap Format",
      description:
        "This is prepared for the namespace of MindMap Format and does not need to be modified",
    },
    "default gap": {
      value: 10,
      description: "Interval size of element",
    },
    "curve length": {
      value: 40,
      description: "The length of the curve part in the mind map line",
    },
    "length between element and line": {
      value: 50,
      description:
        "The distance between the tail of the connection and the connecting elements of the mind map",
    },
  };
  ea.setScriptSettings(settings);
}

const sceneElements = ea.getExcalidrawAPI().getSceneElements();

// default X coordinate of the middle point of the arc
const defaultDotX = Number(settings["curve length"].value);
// The default length from the middle point of the arc on the X axis
const defaultLengthWithCenterDot = Number(
  settings["length between element and line"].value
);
// Initial trimming distance of the end point on the Y axis
const initAdjLength = 4;
// default gap
const defaultGap = Number(settings["default gap"].value);

const setCenter = (parent, line) => {
  // Focus and gap need the api calculation of excalidraw
  // e.g. determineFocusDistance, but they are not available now
  // so they are uniformly set to 0/1
  line.startBinding.focus = 0;
  line.startBinding.gap = 1;
  line.endBinding.focus = 0;
  line.endBinding.gap = 1;
  line.x = parent.x + parent.width;
  line.y = parent.y + parent.height / 2;
};

/**
 * set the middle point of curve
 * @param {any} lineEl the line element of excalidraw
 * @param {number} height height of dot on Y axis
 * @param {number} [ratio=1] ，coefficient of the initial trimming distance of the end point on the Y axis, default is 1
 */
const setTopCurveDotOnLine = (lineEl, height, ratio = 1) => {
  if (lineEl.points.length < 3) {
    lineEl.points.splice(1, 0, [defaultDotX, lineEl.points[0][1] - height]);
  } else if (lineEl.points.length === 3) {
    lineEl.points[1] = [defaultDotX, lineEl.points[0][1] - height];
  } else {
    lineEl.points.splice(2, lineEl.points.length - 3);
    lineEl.points[1] = [defaultDotX, lineEl.points[0][1] - height];
  }
  lineEl.points[2][0] = lineEl.points[1][0] + defaultLengthWithCenterDot;
  // adjust the curvature of the second line segment
  lineEl.points[2][1] = lineEl.points[1][1] - initAdjLength * ratio * 0.8;
};

const setMidCurveDotOnLine = (lineEl) => {
  if (lineEl.points.length < 3) {
    lineEl.points.splice(1, 0, [defaultDotX, lineEl.points[0][1]]);
  } else if (lineEl.points.length === 3) {
    lineEl.points[1] = [defaultDotX, lineEl.points[0][1]];
  } else {
    lineEl.points.splice(2, lineEl.points.length - 3);
    lineEl.points[1] = [defaultDotX, lineEl.points[0][1]];
  }
  lineEl.points[2][0] = lineEl.points[1][0] + defaultLengthWithCenterDot;
  lineEl.points[2][1] = lineEl.points[1][1];
};

/**
 * set the middle point of curve
 * @param {any} lineEl the line element of excalidraw
 * @param {number} height height of dot on Y axis
 * @param {number} [ratio=1] ，coefficient of the initial trimming distance of the end point on the Y axis, default is 1
 */
const setBottomCurveDotOnLine = (lineEl, height, ratio = 1) => {
  if (lineEl.points.length < 3) {
    lineEl.points.splice(1, 0, [defaultDotX, lineEl.points[0][1] + height]);
  } else if (lineEl.points.length === 3) {
    lineEl.points[1] = [defaultDotX, lineEl.points[0][1] + height];
  } else {
    lineEl.points.splice(2, lineEl.points.length - 3);
    lineEl.points[1] = [defaultDotX, lineEl.points[0][1] + height];
  }
  lineEl.points[2][0] = lineEl.points[1][0] + defaultLengthWithCenterDot;
  // adjust the curvature of the second line segment
  lineEl.points[2][1] = lineEl.points[1][1] + initAdjLength * ratio * 0.8;
};

const setTextXY = (rect, text) => {
  text.x = rect.x + (rect.width - text.width) / 2;
  text.y = rect.y + (rect.height - text.height) / 2;
};

const setChildrenXY = (parent, children, line, elementsMap) => {
  x = parent.x + parent.width + line.points[2][0];
  y = parent.y + parent.height / 2 + line.points[2][1] - children.height / 2;
  distX = children.x - x;
  distY = children.y - y;

  ea.getElementsInTheSameGroupWithElement(children, sceneElements).forEach((el) => {
    el.x = el.x - distX;
    el.y = el.y - distY;
  });

  if (
    ["rectangle", "diamond", "ellipse"].includes(children.type) &&
    ![null, undefined].includes(children.boundElements)
  ) {
    const textDesc = children.boundElements.filter(
      (el) => el.type === "text"
    )[0];
    if (textDesc !== undefined) {
      const textEl = elementsMap.get(textDesc.id);
      setTextXY(children, textEl);
    }
  }
};

/**
 * returns the height of the upper part of all child nodes
 * and the height of the lower part of all child nodes
 * @param {Number[]} childrenTotalHeightArr
 * @returns {Number[]} [topHeight, bottomHeight]
 */
const getNodeCurrentHeight = (childrenTotalHeightArr) => {
  if (childrenTotalHeightArr.length <= 0) return [0, 0];
  else if (childrenTotalHeightArr.length === 1)
    return [childrenTotalHeightArr[0] / 2, childrenTotalHeightArr[0] / 2];
  const heightArr = childrenTotalHeightArr;
  let topHeight = 0,
    bottomHeight = 0;
  const isEven = heightArr.length % 2 === 0;
  const mid = Math.floor(heightArr.length / 2);
  const topI = mid - 1;
  const bottomI = isEven ? mid : mid + 1;
  topHeight = isEven ? 0 : heightArr[mid] / 2;
  for (let i = topI; i >= 0; i--) {
    topHeight += heightArr[i];
  }
  bottomHeight = isEven ? 0 : heightArr[mid] / 2;
  for (let i = bottomI; i < heightArr.length; i++) {
    bottomHeight += heightArr[i];
  }
  return [topHeight, bottomHeight];
};

/**
 * handle the height of each point in the single-level tree
 * @param {Array} lines
 * @param {Map} elementsMap
 * @param {Boolean} isEven
 * @param {Number} mid 'lines' array midpoint index
 * @returns {Array} height array corresponding to 'lines'
 */
const handleDotYValue = (lines, elementsMap, isEven, mid) => {
  const getTotalHeight = (line, elementsMap) => {
    return elementsMap.get(line.endBinding.elementId).totalHeight;
  };
  const getTopHeight = (line, elementsMap) => {
    return elementsMap.get(line.endBinding.elementId).topHeight;
  };
  const getBottomHeight = (line, elementsMap) => {
    return elementsMap.get(line.endBinding.elementId).bottomHeight;
  };
  const heightArr = new Array(lines.length).fill(0);
  const upI = mid === 0 ? 0 : mid - 1;
  const bottomI = isEven ? mid : mid + 1;
  let initHeight = isEven ? 0 : getTopHeight(lines[mid], elementsMap);
  for (let i = upI; i >= 0; i--) {
    heightArr[i] = initHeight + getBottomHeight(lines[i], elementsMap);
    initHeight += getTotalHeight(lines[i], elementsMap);
  }
  initHeight = isEven ? 0 : getBottomHeight(lines[mid], elementsMap);
  for (let i = bottomI; i < lines.length; i++) {
    heightArr[i] = initHeight + getTopHeight(lines[i], elementsMap);
    initHeight += getTotalHeight(lines[i], elementsMap);
  }
  return heightArr;
};

/**
 * format single-level tree
 * @param {any} parent
 * @param {Array} lines
 * @param {Map} childrenDescMap
 * @param {Map} elementsMap
 */
const formatTree = (parent, lines, childrenDescMap, elementsMap) => {
  lines.forEach((item) => setCenter(parent, item));

  const isEven = lines.length % 2 === 0;
  const mid = Math.floor(lines.length / 2);
  const heightArr = handleDotYValue(lines, childrenDescMap, isEven, mid);
  lines.forEach((item, index) => {
    if (isEven) {
      if (index < mid) setTopCurveDotOnLine(item, heightArr[index], index + 1);
      else setBottomCurveDotOnLine(item, heightArr[index], index - mid + 1);
    } else {
      if (index < mid) setTopCurveDotOnLine(item, heightArr[index], index + 1);
      else if (index === mid) setMidCurveDotOnLine(item);
      else setBottomCurveDotOnLine(item, heightArr[index], index - mid);
    }
  });
  lines.forEach((item) => {
    if (item.endBinding !== null) {
      setChildrenXY(
        parent,
        elementsMap.get(item.endBinding.elementId),
        item,
        elementsMap
      );
    }
  });
};

const generateTree = (elements) => {
  const elIdMap = new Map([[elements[0].id, elements[0]]]);
  let minXEl = elements[0];
  for (let i = 1; i < elements.length; i++) {
    elIdMap.set(elements[i].id, elements[i]);
    if (
      !(elements[i].type === "arrow" || elements[i].type === "line") &&
      elements[i].x < minXEl.x
    ) {
      minXEl = elements[i];
    }
  }
  const root = {
    el: minXEl,
    totalHeight: minXEl.height,
    topHeight: 0,
    bottomHeight: 0,
    linkChildrensLines: [],
    isLeafNode: false,
    children: [],
  };
  const preIdSet = new Set(); // The id_set of Elements that is already in the tree, avoid a dead cycle
  const dfsForTreeData = (root) => {
    if (preIdSet.has(root.el.id)) {
      return 0;
    }
    preIdSet.add(root.el.id);
    let lines = root.el.boundElements.filter(
      (el) =>
        el.type === "arrow" &&
        !preIdSet.has(el.id) &&
        elIdMap.get(el.id)?.startBinding?.elementId === root.el.id
    );
    if (lines.length === 0) {
      root.isLeafNode = true;
      root.totalHeight = root.el.height + 2 * defaultGap;
      [root.topHeight, root.bottomHeight] = [
        root.totalHeight / 2,
        root.totalHeight / 2,
      ];
      return root.totalHeight;
    } else {
      lines = lines.map((elementDesc) => {
        preIdSet.add(elementDesc.id);
        return elIdMap.get(elementDesc.id);
      });
    }

    const linkChildrensLines = [];
    lines.forEach((el) => {
      const line = el;
      if (
        line &&
        line.endBinding !== null &&
        line.endBinding !== undefined &&
        !preIdSet.has(elIdMap.get(line.endBinding.elementId).id)
      ) {
        const children = elIdMap.get(line.endBinding.elementId);
        linkChildrensLines.push(line);
        root.children.push({
          el: children,
          totalHeight: 0,
          topHeight: 0,
          bottomHeight: 0,
          linkChildrensLines: [],
          isLeafNode: false,
          children: [],
        });
      }
    });

    let totalHeight = 0;
    root.children.forEach((el) => (totalHeight += dfsForTreeData(el)));

    root.linkChildrensLines = linkChildrensLines;
    if (root.children.length === 0) {
      root.isLeafNode = true;
      root.totalHeight = root.el.height + 2 * defaultGap;
      [root.topHeight, root.bottomHeight] = [
        root.totalHeight / 2,
        root.totalHeight / 2,
      ];
    } else if (root.children.length > 0) {
      root.totalHeight = Math.max(root.el.height + 2 * defaultGap, totalHeight);
      [root.topHeight, root.bottomHeight] = getNodeCurrentHeight(
        root.children.map((item) => item.totalHeight)
      );
    }

    return totalHeight;
  };
  dfsForTreeData(root);
  const dfsForFormat = (root) => {
    if (root.isLeafNode) return;
    const childrenDescMap = new Map(
      root.children.map((item) => [item.el.id, item])
    );
    formatTree(root.el, root.linkChildrensLines, childrenDescMap, elIdMap);
    root.children.forEach((el) => dfsForFormat(el));
  };
  dfsForFormat(root);
};

const elements = ea.getViewSelectedElements();
generateTree(elements);

ea.copyViewElementsToEAforEditing(elements);
await ea.addElementsToView(false, false);
