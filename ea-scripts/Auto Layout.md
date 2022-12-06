/*

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-download-raw.jpg)

Download this file and save to your Obsidian Vault including the first line, or open it in "Raw" and copy the entire contents to Obsidian.

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-auto-layout.png)

This script performs automatic layout for the selected top-level grouping objects. It is powered by [elkjs](https://github.com/kieler/elkjs) and needs to be connected to the Internet.


See documentation for more details:
https://zsviczian.github.io/obsidian-excalidraw-plugin/ExcalidrawScriptsEngine.html

```javascript
*/

if (
  !ea.verifyMinimumPluginVersion ||
  !ea.verifyMinimumPluginVersion("1.5.21")
) {
  new Notice(
    "This script requires a newer version of Excalidraw. Please install the latest version."
  );
  return;
}

settings = ea.getScriptSettings();
//set default values on first run
if (!settings["Layout Options JSON"]) {
  settings = {
    "Layout Options JSON": {
      height: "450px",
      value: `{\n      "org.eclipse.elk.layered.crossingMinimization.semiInteractive": "true",\n      "org.eclipse.elk.layered.considerModelOrder.components": "FORCE_MODEL_ORDER"\n}`,
      description: `You can use layout options to configure the layout algorithm. A list of all options and further details of their exact effects is available in <a href="http://www.eclipse.org/elk/reference.html" rel="nofollow">ELK's documentation</a>.`,
    },
  };
  ea.setScriptSettings(settings);
} 

if (typeof ELK === "undefined") {
  loadELK(doAutoLayout);
} else {
  doAutoLayout();
}

async function doAutoLayout() {
  const selectedElements = ea.getViewSelectedElements();
  const groups = ea
    .getMaximumGroups(selectedElements)
    .map((g) => g.filter((el) => el.containerId == null)) // ignore text in stickynote
    .filter((els) => els.length > 0);

  const stickynotesMap = selectedElements
    .filter((el) => el.containerId != null)
    .reduce((result, el) => {
      result.set(el.containerId, el);
      return result;
    }, new Map());

  const elk = new ELK();
  const knownLayoutAlgorithms = await elk.knownLayoutAlgorithms();
  const layoutAlgorithms = knownLayoutAlgorithms
    .map((knownLayoutAlgorithm) => ({
      id: knownLayoutAlgorithm.id,
      displayText:
        knownLayoutAlgorithm.id === "org.eclipse.elk.layered" ||
        knownLayoutAlgorithm.id === "org.eclipse.elk.radial" ||
        knownLayoutAlgorithm.id === "org.eclipse.elk.mrtree"
          ? "* " +
            knownLayoutAlgorithm.name +
            ": " +
            knownLayoutAlgorithm.description
          : knownLayoutAlgorithm.name + ": " + knownLayoutAlgorithm.description,
    }))
    .sort((lha, rha) => lha.displayText.localeCompare(rha.displayText));

  const layoutAlgorithmsSimple = knownLayoutAlgorithms
    .map((knownLayoutAlgorithm) => ({
      id: knownLayoutAlgorithm.id,
      displayText:
        knownLayoutAlgorithm.id === "org.eclipse.elk.layered" ||
        knownLayoutAlgorithm.id === "org.eclipse.elk.radial" ||
        knownLayoutAlgorithm.id === "org.eclipse.elk.mrtree"
          ? "* " + knownLayoutAlgorithm.name
          : knownLayoutAlgorithm.name,
    }))
    .sort((lha, rha) => lha.displayText.localeCompare(rha.displayText));

  // const knownOptions = knownLayoutAlgorithms
  //   .reduce(
  //     (result, knownLayoutAlgorithm) => [
  //       ...result,
  //       ...knownLayoutAlgorithm.knownOptions,
  //     ],
  //     []
  //   )
  //   .filter((value, index, self) => self.indexOf(value) === index) // remove duplicates
  //   .sort((lha, rha) => lha.localeCompare(rha));
  // console.log("knownOptions", knownOptions);

  const selectedAlgorithm = await utils.suggester(
    layoutAlgorithms.map((algorithmInfo) => algorithmInfo.displayText),
    layoutAlgorithms.map((algorithmInfo) => algorithmInfo.id),
    "Layout algorithm"
  );

  const knownNodePlacementStrategy = [
    "SIMPLE",
    "INTERACTIVE",
    "LINEAR_SEGMENTS",
    "BRANDES_KOEPF",
    "NETWORK_SIMPLEX",
  ];

  const knownDirections = [
    "UNDEFINED",
    "RIGHT",
    "LEFT",
    "DOWN",
    "UP"
  ];

  let nodePlacementStrategy = "BRANDES_KOEPF";
  let componentComponentSpacing = "10";
  let nodeNodeSpacing = "100";
  let nodeNodeBetweenLayersSpacing = "100";
  let discoComponentLayoutAlgorithm = "org.eclipse.elk.layered";
  let direction = "UNDEFINED";

  if (selectedAlgorithm === "org.eclipse.elk.layered") {
    nodePlacementStrategy = await utils.suggester(
      knownNodePlacementStrategy,
      knownNodePlacementStrategy,
      "Node placement strategy"
    );

    selectedDirection = await utils.suggester(
      knownDirections,
      knownDirections,
      "Direction"
    );
    direction = selectedDirection??"UNDEFINED";
  } else if (selectedAlgorithm === "org.eclipse.elk.disco") {
    const componentLayoutAlgorithms = layoutAlgorithmsSimple.filter(al => al.id !== "org.eclipse.elk.disco");
    const selectedDiscoComponentLayoutAlgorithm = await utils.suggester(
      componentLayoutAlgorithms.map((algorithmInfo) => algorithmInfo.displayText),
      componentLayoutAlgorithms.map((algorithmInfo) => algorithmInfo.id),
      "Disco Connected Components Layout Algorithm"
    );
    discoComponentLayoutAlgorithm = selectedDiscoComponentLayoutAlgorithm??"org.eclipse.elk.layered";
  }

  if (
    selectedAlgorithm === "org.eclipse.elk.box" ||
    selectedAlgorithm === "org.eclipse.elk.rectpacking"
  ) {
    nodeNodeSpacing = await utils.inputPrompt("Node Spacing", "number", "10");
  } else {
    let userSpacingStr = await utils.inputPrompt(
      "Components Spacing, Node Spacing, Node Node Between Layers Spacing",
      "number, number, number",
      "10, 100, 100"
    );
    let userSpacingArr = (userSpacingStr??"").split(",");
    componentComponentSpacing = userSpacingArr[0] ?? "10";
    nodeNodeSpacing = userSpacingArr[1] ?? "100";
    nodeNodeBetweenLayersSpacing = userSpacingArr[2] ?? "100";
  }

  let layoutOptionsJson = {};
  try {
    layoutOptionsJson = JSON.parse(settings["Layout Options JSON"].value);
  } catch (e) {
    new Notice(
      "Error reading Layout Options JSON, see developer console for more information",
      4000
    );
    console.log(e);
  }

  layoutOptionsJson["elk.algorithm"] = selectedAlgorithm;
  layoutOptionsJson["org.eclipse.elk.spacing.componentComponent"] =
    componentComponentSpacing;
  layoutOptionsJson["org.eclipse.elk.spacing.nodeNode"] = nodeNodeSpacing;
  layoutOptionsJson["org.eclipse.elk.layered.spacing.nodeNodeBetweenLayers"] =
    nodeNodeBetweenLayersSpacing;
  layoutOptionsJson["org.eclipse.elk.layered.nodePlacement.strategy"] =
    nodePlacementStrategy;
  layoutOptionsJson["org.eclipse.elk.disco.componentCompaction.componentLayoutAlgorithm"] = 
    discoComponentLayoutAlgorithm;
  layoutOptionsJson["org.eclipse.elk.direction"] = direction;

  const graph = {
    id: "root",
    layoutOptions: layoutOptionsJson,
    children: [],
    edges: [],
  };

  let groupMap = new Map();
  let targetElkMap = new Map();
  let arrowEls = [];

  for (let i = 0; i < groups.length; i++) {
    const elements = groups[i];
    if (
      elements.length === 1 &&
      (elements[0].type === "arrow" || elements[0].type === "line")
    ) {
      if (
        elements[0].type === "arrow" &&
        elements[0].startBinding &&
        elements[0].endBinding
      ) {
        arrowEls.push(elements[0]);
      }
    } else {
      let elkId = "g" + i;
      elements.reduce((result, el) => {
        result.set(el.id, elkId);
        return result;
      }, targetElkMap);

      const box = ea.getBoundingBox(elements);
      groupMap.set(elkId, {
        elements: elements,
        boundingBox: box,
      });

      graph.children.push({
        id: elkId,
        width: box.width,
        height: box.height,
        x: box.topX,
        y: box.topY,
      });
    }
  }

  for (let i = 0; i < arrowEls.length; i++) {
    const arrowEl = arrowEls[i];
    const startElkId = targetElkMap.get(arrowEl.startBinding.elementId);
    const endElkId = targetElkMap.get(arrowEl.endBinding.elementId);

    graph.edges.push({
      id: "e" + i,
      sources: [startElkId],
      targets: [endElkId],
    });
  }

  const initTopX =
    Math.min(...Array.from(groupMap.values()).map((v) => v.boundingBox.topX)) -
    12;
  const initTopY =
    Math.min(...Array.from(groupMap.values()).map((v) => v.boundingBox.topY)) -
    12;

  elk
    .layout(graph)
    .then((resultGraph) => {
      for (const elkEl of resultGraph.children) {
        const group = groupMap.get(elkEl.id);
        for (const groupEl of group.elements) {
          const originalDistancX = groupEl.x - group.boundingBox.topX;
          const originalDistancY = groupEl.y - group.boundingBox.topY;
          const groupElDistanceX =
            elkEl.x + initTopX + originalDistancX - groupEl.x;
          const groupElDistanceY =
            elkEl.y + initTopY + originalDistancY - groupEl.y;

          groupEl.x = groupEl.x + groupElDistanceX;
          groupEl.y = groupEl.y + groupElDistanceY;

          if (stickynotesMap.has(groupEl.id)) {
            const stickynote = stickynotesMap.get(groupEl.id);
            stickynote.x = stickynote.x + groupElDistanceX;
            stickynote.y = stickynote.y + groupElDistanceY;
          }
        }
      }

      ea.copyViewElementsToEAforEditing(selectedElements);
      ea.addElementsToView(false, false);

      normalizeSelectedArrows();
    })
    .catch(console.error);
}

function loadELK(doAfterLoaded) {
  let script = document.createElement("script");
  script.onload = function () {
    if (typeof ELK !== "undefined") {
      doAfterLoaded();
    }
  };
  script.src =
    "https://cdn.jsdelivr.net/npm/elkjs@0.8.2/lib/elk.bundled.min.js";
  document.head.appendChild(script);
}

/*
 * Normalize Selected Arrows
 */

function normalizeSelectedArrows() {
  let gapValue = 2;

  const selectedIndividualArrows = ea.getMaximumGroups(ea.getViewSelectedElements())
    .reduce((result, g) => [...result, ...g.filter(el => el.type === 'arrow')], []);

  const allElements = ea.getViewElements();
  for (const arrow of selectedIndividualArrows) {
    const startBindingEl = allElements.filter(
      (el) => el.id === (arrow.startBinding || {}).elementId
    )[0];
    const endBindingEl = allElements.filter(
      (el) => el.id === (arrow.endBinding || {}).elementId
    )[0];

    if (startBindingEl) {
      recalculateStartPointOfLine(
        arrow,
        startBindingEl,
        endBindingEl,
        gapValue
      );
    }
    if (endBindingEl) {
      recalculateEndPointOfLine(arrow, endBindingEl, startBindingEl, gapValue);
    }
  }

  ea.copyViewElementsToEAforEditing(selectedIndividualArrows);
  ea.addElementsToView(false, false);
}

function recalculateStartPointOfLine(line, el, elB, gapValue) {
  const aX = el.x + el.width / 2;
  const bX =
    line.points.length <= 2 && elB
      ? elB.x + elB.width / 2
      : line.x + line.points[1][0];
  const aY = el.y + el.height / 2;
  const bY =
    line.points.length <= 2 && elB
      ? elB.y + elB.height / 2
      : line.y + line.points[1][1];

  line.startBinding.gap = gapValue;
  line.startBinding.focus = 0;
  const intersectA = ea.intersectElementWithLine(
    el,
    [bX, bY],
    [aX, aY],
    line.startBinding.gap
  );

  if (intersectA.length > 0) {
    line.points[0] = [0, 0];
    for (let i = 1; i < line.points.length; i++) {
      line.points[i][0] -= intersectA[0][0] - line.x;
      line.points[i][1] -= intersectA[0][1] - line.y;
    }
    line.x = intersectA[0][0];
    line.y = intersectA[0][1];
  }
}

function recalculateEndPointOfLine(line, el, elB, gapValue) {
  const aX = el.x + el.width / 2;
  const bX =
    line.points.length <= 2 && elB
      ? elB.x + elB.width / 2
      : line.x + line.points[line.points.length - 2][0];
  const aY = el.y + el.height / 2;
  const bY =
    line.points.length <= 2 && elB
      ? elB.y + elB.height / 2
      : line.y + line.points[line.points.length - 2][1];

  line.endBinding.gap = gapValue;
  line.endBinding.focus = 0;
  const intersectA = ea.intersectElementWithLine(
    el,
    [bX, bY],
    [aX, aY],
    line.endBinding.gap
  );

  if (intersectA.length > 0) {
    line.points[line.points.length - 1] = [
      intersectA[0][0] - line.x,
      intersectA[0][1] - line.y,
    ];
  }
}