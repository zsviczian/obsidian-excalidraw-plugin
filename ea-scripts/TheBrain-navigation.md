/*

An Excalidraw based graph user interface for your Vault. Requires the [Breadcrumbs plugin](https://github.com/SkepticMystic/breadcrumbs) to be installed and configured as well. Generates a user interface similar to that of [TheBrain](https://TheBrain.com).

Watch introduction to this script on [YouTube](https://youtu.be/J4T5KHERH_o).

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/TheBrain.jpg)

```javascript
*/

if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.6.24")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

if(!BCAPI) {
  new Notice("Breadcrumbs API not found! Install and activate the Breadcrumbs plugin",4000);
  return;
}

const EVENT = "active-leaf-change";

const removeEventHandler = () => {
  app.workspace.off(EVENT,window.brainGraphEventHandler);
  if(isBoolean(window.excalidrawView?.linksAlwaysOpenInANewPane)) {
    window.excalidrawView.linksAlwaysOpenInANewPane = false;
    const ea = ExcalidrawAutomate;
    ea.setView(window.excalidrawView);
    if(ea.targetView?.getExcalidrawAPI) {
      ea.getExcalidrawAPI().updateScene({appState:{viewModeEnabled:false}});
    }
  }
  delete window.excalidrawView;
  delete window.excalidrawFile;
  delete window.lastfilePath;
  new Notice("Brain Graph Off")
  setTimeout(()=>delete window.brainGraphEventHandler);
}

//Turn off event handler if it is already running
if(window.brainGraphEventHandler) {
  removeEventHandler();
  return;
}

//-------------------------------------------------------
// Settings
//-------------------------------------------------------

settings = ea.getScriptSettings();
//set default values on first run
if(!settings["Max number of nodes/domain"]) {
  settings = {
	"Confirmation prompt at startup": {
	  value: true,
	  description: "Prompt me to confirm starting of the script because it will overwrite the current active drawing. " +
	    "You can disable this warning by turning off this switch"
	},
    "Max number of nodes/domain": {
      value: 40,
      description: "Maximum number of items to show in each domain: parents, children, siblings, jumps."
    },
    "Infer non-Breadcrumbs links": {
      value: true,
      description: "Links on the page are children, backlinks to the page are parents. Breadcrumbs take priority."
    },
    "Hide attachments": {
      value: true,
      description: "Hide attachments. Will only have an effect if Infer non-Breadcrumbs links is turned on."
    },
    "Font family": {
    value: "Code",
    valueset: ["Hand-drawn","Normal","Code","Fourth (custom) Font"]
    },
    "Stroke roughness": {
      value: "Architect",
      valueset: ["Architect", "Artist", "Cartoonist"]
    },
    "Rectangle stroke sharpness": {
      value: "round",
      valueset: ["sharp", "round"]
    },
    "Central font size": {
      value: 30,
      description: "Font size of the central node"
    },
    "Font size": {
      value: 20,
      description: "Font size of jumps, children and parents"
    },
    "Siblings font size": {
      value: 15,
      description: "Font size of siblings"
    },
    "Max label length": {
      value: 30,
      description: "Maximum number of characters to display from node title. Longer nodes will end with '...'"
    },
    "Padding": {
      value: 10,
      description: "Padding of the node rectangle"
    },
    "Gate offset": {
      value: 15,
      description: "The offset to the left and right of the parent and child gates."
    },  
    "Gate radius": {
      value: 5,
      description: "The radius of the 3 small circles (alias: gates) serving as connection points for nodes"
    },
    "Canvas color": {
      value: "hsl(208, 80%, 23%)",
      description: "Any legal HTML color (#000000, rgb, color-name, etc.)."
    },
    "Gate color": {
      value: "white",
      description: "Any legal HTML color (#000000, rgb, color-name, etc.)."
    },
    "Link color": {
      value: "hsl(0, 0%, 41%)",
      description: "Any legal HTML color (#000000, rgb, color-name, etc.)."
    },
    "Central-node background color": {
      value: "#dfaf16",
      description: "Any legal HTML color (#000000, rgb, color-name, etc.)."
    },
    "Central-node color": {
      value: "black",
      description: "Any legal HTML color (#000000, rgb, color-name, etc.)."
    },
    "Breadcrumbs-node background color": {
      value: "rgba(0,0,0,0.4)",
      description: "Any legal HTML color (#000000, rgb, color-name, etc.)."
    },
    "Breadcrumbs-node color": {
      value: "white",
      description: "Any legal HTML color (#000000, rgb, color-name, etc.)."
    },
    "Non-breadcrumbs-node background color": {
      value: "rgba(0,0,5,0.7)",
      description: "Any legal HTML color (#000000, rgb, color-name, etc.)."
    },
    "Non-breadcrumbs-node color": {
      value: "hsl(208, 80%, 77%)",
      description: "Any legal HTML color (#000000, rgb, color-name, etc.)."
    },
    "Virtual-node background color": {
      value: "rgba(255,0,0,0.4)",
      description: "Any legal HTML color (#000000, rgb, color-name, etc.)."
    },
    "Virtual-node color": {
      value: "white",
      description: "Any legal HTML color (#000000, rgb, color-name, etc.)."
    }
  };
};
ea.setScriptSettings(settings);

const SHOW_CONFIRMATION_PROMPT = settings["Confirmation prompt at startup"].value;
const MAX_ITEMS = Math.floor(settings["Max number of nodes/domain"].value)??40;
const INCLUDE_OBSIDIAN_LINKS = settings["Infer non-Breadcrumbs links"].value;
const HIDE_ATTACHMENTS = settings["Hide attachments"].value;
const FONT_FAMILY = settings["Font family"].value === "Hand-drawn" 
  ? 1
  : settings["Font family"].value === "Normal"
    ? 2
    : settings["Font family"].value === "Code"
      ? 3
      : 4;
const STROKE_ROUGHNESS = settings["Stroke roughness"].value === "Architect"
  ? 0
  : settings["Stroke roughness"].value === "Artist"
    ? 1
    : 2;    
const STROKE_SHARPNESS = settings["Rectangle stroke sharpness"].value;
const CENTRAL_FONT_SIZE = Math.floor(settings["Central font size"].value)??30;
const FONT_SIZE = Math.floor(settings["Font size"].value)??20;
const DISTANT_FONT_SIZE = Math.floor(settings["Siblings font size"].value)??15;
const MAX_LABEL_LENGTH = Math.floor(settings["Max label length"].value)??30;
const PADDING = Math.floor(settings["Padding"].value)??10;
const GATE_OFFSET = Math.floor(settings["Gate offset"].value)??15;
const GATE_RADIUS = Math.floor(settings["Gate radius"].value)??5;
const BG_COLOR = settings["Canvas color"].value;
const GATE_COLOR = settings["Gate color"].value;
const LINK_COLOR = settings["Link color"].value;
const CENTRAL_NODE_BG_COLOR = settings["Central-node background color"].value;
const CENTRAL_NODE_COLOR = settings["Central-node color"].value;
const NODE_BG_COLOR = settings["Breadcrumbs-node background color"].value;
const NODE_COLOR = settings["Breadcrumbs-node color"].value;
const OBSIDIAN_NODE_BG_COLOR = settings["Non-breadcrumbs-node background color"].value;
const OBSIDIAN_NODE_COLOR = settings["Non-breadcrumbs-node color"].value;
const VIRTUAL_NODE_BG_COLOR = settings["Virtual-node background color"].value;
const VIRTUAL_NODE_COLOR = settings["Virtual-node color"].value;

//-------------------------------------------------------
// Initialization
//-------------------------------------------------------

if(SHOW_CONFIRMATION_PROMPT) {
  const result = await utils.inputPrompt("This will overwrite the current active drawing","type: 'ok' to Continue");
  if(result !== "ok") return;
}

const measureText = (text,fontSize) => {
  ea.style.fontSize = fontSize;
  return ea.measureText(text);
}

ea.style.fontFamily = FONT_FAMILY;
const TEXT_SIZE = measureText("m".repeat(MAX_LABEL_LENGTH+3),FONT_SIZE);
const NODE_WIDTH = TEXT_SIZE.width + 3 * PADDING;
const NODE_HEIGHT = 2 * (TEXT_SIZE.height + 2 * PADDING);

ea.getExcalidrawAPI().updateScene({
  appState: {
    viewModeEnabled:true,
    theme: "light",
  viewBackgroundColor: BG_COLOR
  },
  elements:[]
});

ea.style.strokeColor = NODE_COLOR;
ea.addText(0,0,"Open a document in another pane and click it to get started.\n\nIf you do not see the Breadcrumbs as expected,\ntry refreshing the index in BC matrix view.\n\nFor best experience enable 'Open in adjacent pane'\nin Excalidraw settings under 'Links and Transclusion'.", {textAlign:"center"});
await ea.addElementsToView();
ea.getExcalidrawAPI().zoomToFit();

window.excalidrawView = ea.targetView;
window.excalidrawFile = ea.targetView.file;

ea.targetView.linksAlwaysOpenInANewPane = true;

new Notice("Brain Graph On");

//-------------------------------------------------------
// Supporting functions and classes
//-------------------------------------------------------
const getMatrixNeighbours = (node) => {
  try {
    return BCAPI.getMatrixNeighbours(node);
  } catch {
    return null
  }
}

const joinRealsAndImplieds = (data) => {
  result = new Set();
  data.reals.forEach(i=>result.add(i.to));
  data.implieds.forEach(i=>result.add(i.to));
  return Array.from(result);
}

const distinct = (data) => Array.from(new Set(data));  

class Layout {
  constructor(spec) {
    this.spec = spec;
  this.nodes = [];
  this.renderedNodes = [];
  }

  layout(columns = this.spec.columns) {
    const generateLayoutVector = (pattern) => {
    const res = [];
    let cur = 1;
    let state = true;
    pattern
      .map(p => Math.floor(p))
      .forEach(cnt => {
        for(let i=0;i<cnt;i++) res.push(state ? null : cur++);
        state = !state;
      });
    return res;
  }
  
  const getRowLayout = (items) => items%2
    ? generateLayoutVector([(columns-items)/2,items,(columns-items)/2])
    : generateLayoutVector([(columns-items)/2,items/2,1,items/2,(columns-items)/2]);
    
  const sortedNodes = this.nodes.sort((a,b) => a.label.toLowerCase() < b.label.toLowerCase() ? -1 : 1)
  const itemCount = sortedNodes.length;
  if(itemCount === 0) return;
  const rowCount = Math.ceil(itemCount / columns);
  this.renderedNodes = Array(rowCount).fill().map((_,i) =>
    (i+1 < rowCount) || (itemCount % columns === 0)
      ? Array(columns).fill().map((_,j) => sortedNodes[i*columns+j]) //full row
      : getRowLayout(itemCount % columns).map(idx => idx ? sortedNodes[i*columns+idx-1]:null));
  }

  render() {
    this.layout();
    const rows = this.renderedNodes.length;
    const height = rows * this.spec.rowHeight;
    const top = (this.spec.top === null && this.spec.bottom === null) //unconstrained
      ? this.spec.origoY - height/2
      : this.spec.top !== null 
        ? (this.spec.origoY - height/2) < this.spec.top //top constrained
          ? this.spec.top
          : this.spec.origoY - height/2
        : (this.spec.origoY + height/2) > this.spec.bottom  //bottom constrained
          ? this.spec.bottom - height
          : this.spec.origoY - height/2;
    const center00 = {
      x: this.spec.origoX - (this.spec.columns === 1 ? 0 : (this.spec.columns-1)/2*this.spec.columnWidth),
      y: top
    };
    this.renderedNodes.forEach((nodes,row) =>
    nodes.forEach((node,idx) => {
      if(!node) return;
      node.setCenter({
        x: center00.x + idx*this.spec.columnWidth,
        y: center00.y + row*this.spec.rowHeight
      });
      node.render();
    })
    );
  }
}

class Node {
  constructor(spec) {
    this.spec = spec;
    const label = spec.file?.basename??spec.nodeTitle;
    this.label = label.length > spec.maxLabelLength
      ? label.substring(0,spec.maxLabelLength-1) + "..."
      : label;
    this.labelSize = measureText(this.label, spec.fontSize);
  }

  setCenter(center) {
    this.center = center;
  }
  
  render() {
    ea.style.fontSize = this.spec.fontSize;
    ea.style.strokeColor = this.spec.file
      ? this.spec.nodeColor
      : this.spec.virtualNodeColor;
    ea.style.backgroundColor = "transparent";
    this.id = ea.addText(
      this.center.x - this.labelSize.width / 2, 
      this.center.y - this.labelSize.height / 2,
      this.label,
      {
        wrapAt: this.spec.maxLabelLength+5,
        textAlign: "center",
        box: true,
        boxPadding: this.spec.padding
      }
    );
    const box = ea.getElement(this.id);
    box.link = `[[${this.spec.file?.path??this.spec.nodeTitle}]]`;
    box.backgroundColor = this.spec.file
      ? this.spec.backgroundColor
      : this.spec.virtualNodeBGColor;
    box.strokeColor = this.spec.borderColor;

    ea.style.strokeColor = this.spec.gateColor;
    ea.style.backgroundColor =  this.spec.hasJumps ? this.spec.gateColor : "transparent";
    this.jumpGateId = ea.addEllipse(
      this.spec.jumpOnLeft
        ? this.center.x - this.spec.gateRadius * 2 - this.spec.padding - this.labelSize.width / 2
        : this.center.x + this.spec.padding + this.labelSize.width / 2,
      this.center.y - this.spec.gateRadius,
      this.spec.gateRadius * 2,
      this.spec.gateRadius * 2
    );
    ea.style.backgroundColor =  this.spec.hasParents ? this.spec.gateColor : "transparent";
    this.parentGateId = ea.addEllipse(
      this.center.x - this.spec.gateRadius - this.spec.gateOffset,
      this.center.y - 2 * this.spec.gateRadius - this.spec.padding - this.labelSize.height / 2,
      this.spec.gateRadius * 2,
      this.spec.gateRadius * 2
    );
    ea.style.backgroundColor =  this.spec.hasChildren ? this.spec.gateColor : "transparent";
    this.childGateId = ea.addEllipse(
      this.center.x - this.spec.gateRadius + this.spec.gateOffset,
      this.center.y + this.spec.padding + this.labelSize.height / 2,
      this.spec.gateRadius * 2,
      this.spec.gateRadius * 2
    );
    
    ea.addToGroup([this.jumpGateId,this.parentGateId,this.childGateId,this.id, box.boundElements[0].id]);
  }
}

const addNodes = (nodesMap, root, nodes, layout, options) => {
  nodes.forEach(nodeTitle => {
    const node = new Node({
      nodeTitle,
      file: app.metadataCache.getFirstLinkpathDest(nodeTitle,root.path),
      hasChildren: false,
      hasParents: false,
      hasJumps: false,
      ...options
    });
    nodesMap.set(nodeTitle,node);
    layout.nodes.push(node);
  });
}

//-------------------------------------------------------
// Event handler
//-------------------------------------------------------
window.brainGraphEventHandler = async (leaf) => {
  //sleep for 100ms
  await new Promise((resolve) => setTimeout(resolve, 100));

  //terminate event handler if view no longer exists or file has changed
  if(!window.excalidrawView?.file || window.excalidrawView.file.path !== window.excalidrawFile?.path) {
    removeEventHandler();
    return;
  }

  //need to reinitialize ea because in the event handler ea provided by the script engine will no longer be available
  ea = ExcalidrawAutomate;
  ea.reset();
  ea.setView(window.excalidrawView);
  ea.style.fontFamily = FONT_FAMILY;
  ea.style.roughness = STROKE_ROUGHNESS;
  ea.style.strokeSharpness = STROKE_SHARPNESS;
  
  if(!leaf?.view?.file) return;
  const file = leaf.view.file;
  
  if (file.path === window.excalidrawFile.path) return; //brainview drawing is active

  if(window.lastfilePath && window.lastfilePath === file.path) return; //don't reload the file if it has not changed
  window.lastfilePath = file.path;

  ea.getExcalidrawAPI().updateScene({elements:[]});
  const centralNodeTitle = file.extension === "md" ? file.basename : file.name;

  ea.style.verticalAlign = "middle";
  ea.style.strokeSharpness = "round";
  ea.style.fillStyle = "solid";
  
  const rootFile = app.metadataCache.getFirstLinkpathDest(centralNodeTitle,"")
  const bc = getMatrixNeighbours(centralNodeTitle);
  
  const parents = bc ? joinRealsAndImplieds(bc.up).filter(n=>n!==centralNodeTitle).slice(0,MAX_ITEMS) : [];
  const children = bc ? joinRealsAndImplieds(bc.down).filter(n=>n!==centralNodeTitle).slice(0,MAX_ITEMS) : [];
  const jumps = bc ? distinct(
    joinRealsAndImplieds(bc.next)
      .concat(joinRealsAndImplieds(bc.prev))
  ).filter(n=>n!==centralNodeTitle)
  .slice(0,MAX_ITEMS) : [];
  const siblings = bc ? joinRealsAndImplieds(bc.same).filter(n=>n!==centralNodeTitle).slice(0,MAX_ITEMS) : []; //see breadcrumbs settings to finetune siblings

  bclinks = new Set(parents.concat(children).concat(jumps).concat(siblings).concat([centralNodeTitle]));
  //adding links from the document, not explicitly declared as a breadcrumbs
  //this code assumes unique filenames (like breadcrumbs, thus will not handle non unique files well)
  const forwardLinks = INCLUDE_OBSIDIAN_LINKS 
    ? distinct(app.metadataCache
        .getLinks()[rootFile.path]?.map(l=>app.metadataCache.getFirstLinkpathDest(l.link,rootFile.path))
        .filter(f=>f && (!HIDE_ATTACHMENTS || f.extension === "md"))
        .map(f=>f.extension === "md" ? f.basename : f.name)
        .filter(l=>!bclinks.has(l))??[].slice(0,MAX_ITEMS))
    : [];
  const forwardLinksSet = new Set(forwardLinks);
  const backLinks = INCLUDE_OBSIDIAN_LINKS
    ? distinct(Object
        .keys(app.metadataCache.getBacklinksForFile(rootFile)?.data??{})
        .map(l=>app.metadataCache.getFirstLinkpathDest(l,rootFile.path))
        .filter(f=>f && f.path !== window.excalidrawFile.path && (!HIDE_ATTACHMENTS || f.extension === "md"))
        .map(f=>f.extension === "md" ? f.basename : f.name)
        .filter(l=>!bclinks.has(l) && !forwardLinksSet.has(l))
        .slice(0,MAX_ITEMS))
    : [];
  const backLinksSet = new Set(backLinks);

  const nodesMap = new Map();
  const linksMap = new Map();

  const lCenter = new Layout({
    origoX: 0,
    origoY: 0,
    top: null,
    bottom: null,
    columns: 1,
    columnWidth: NODE_WIDTH,
    rowHeight: NODE_HEIGHT
  });

  const manyChildren = (children.length + forwardLinks.length) >10;
  const manySiblings = siblings.length > 10;
  const singleParent = (parents.length + backLinks.length) <= 1
  
  const lChildren = new Layout({
    origoX: 0,
    origoY: 2.5 * NODE_HEIGHT,
    top: 2.5 * NODE_HEIGHT - NODE_HEIGHT/2,
    bottom: null,
    columns: manyChildren ? 5 : 3,
    columnWidth: NODE_WIDTH,
    rowHeight: NODE_HEIGHT
  });

  const lJumps = new Layout({
    origoX: (manyChildren ? -3 : -2)  * NODE_WIDTH,
    origoY: 0,
    top: null,
    bottom: null,
    columns: 1,
    columnWidth: NODE_WIDTH,
    rowHeight: NODE_HEIGHT
  });

  const lParents = new Layout({
    origoX: 0,
    origoY: -2.5 * NODE_HEIGHT,
    top: null,
    bottom: -2.5 * NODE_HEIGHT + NODE_HEIGHT/2,
    columns: 3,
    columnWidth: NODE_WIDTH,
    rowHeight: NODE_HEIGHT
  });

  const lSiblings = new Layout({
    origoX: NODE_WIDTH * ((singleParent ? 0 : 1) + (manySiblings ? 2 : 1)),
    origoY: -2.5 * NODE_HEIGHT,
    top: null,
    bottom: NODE_HEIGHT,
    columns: (manySiblings ? 3 : 1),
    columnWidth: NODE_WIDTH,
    rowHeight: NODE_HEIGHT
  })

  const rootNode = new Node({
    file: rootFile,
    hasChildren: false,
    hasParents: false,
    hasJumps: false,
    fontSize: CENTRAL_FONT_SIZE,
    jumpOnLeft: true,
    maxLabelLength: 2*MAX_LABEL_LENGTH,
    gateRadius: GATE_RADIUS,
    gateOffset: GATE_OFFSET,
    padding: PADDING,
    nodeColor: CENTRAL_NODE_COLOR,
    gateColor: GATE_COLOR,
    borderColor: CENTRAL_NODE_COLOR,
    backgroundColor: CENTRAL_NODE_BG_COLOR,
    virtualNodeBGColor: VIRTUAL_NODE_BG_COLOR
  });
  nodesMap.set(rootFile.basename,rootNode);
  lCenter.nodes.push(rootNode);

  addNodes(
    nodesMap,
    rootFile,
    parents,
    lParents,
    {
      fontSize: FONT_SIZE,
      jumpOnLeft: true,
      maxLabelLength: MAX_LABEL_LENGTH,
      gateRadius: GATE_RADIUS,
      gateOffset: GATE_OFFSET,
      padding: PADDING,
      nodeColor: NODE_COLOR,
      gateColor: GATE_COLOR,
      borderColor: "transparent",
      backgroundColor: NODE_BG_COLOR,
      virtualNodeColor: VIRTUAL_NODE_COLOR,
      virtualNodeBGColor: VIRTUAL_NODE_BG_COLOR
    }
  );

  addNodes(
    nodesMap,
    rootFile,
    backLinks,
    lParents,
    {
      fontSize: FONT_SIZE,
      jumpOnLeft: true,
      maxLabelLength: MAX_LABEL_LENGTH,
      gateRadius: GATE_RADIUS,
      gateOffset: GATE_OFFSET,
      padding: PADDING,
      nodeColor: OBSIDIAN_NODE_COLOR,
      gateColor: GATE_COLOR,
      borderColor: "transparent",
      backgroundColor: OBSIDIAN_NODE_BG_COLOR,
      virtualNodeColor: VIRTUAL_NODE_COLOR,
      virtualNodeBGColor: VIRTUAL_NODE_BG_COLOR
    }
  );


  addNodes(
    nodesMap,
    rootFile,
    children,
    lChildren,
    {
      fontSize: FONT_SIZE,
      jumpOnLeft: true,
      maxLabelLength: MAX_LABEL_LENGTH,
      gateRadius: GATE_RADIUS,
      gateOffset: GATE_OFFSET,
      padding: PADDING,
      nodeColor: NODE_COLOR,
      gateColor: GATE_COLOR,
      borderColor: "transparent",
      backgroundColor: NODE_BG_COLOR,
      virtualNodeColor: VIRTUAL_NODE_COLOR,
      virtualNodeBGColor: VIRTUAL_NODE_BG_COLOR
    }
  );

  addNodes(
    nodesMap,
    rootFile,
    forwardLinks,
    lChildren,
    {
      fontSize: FONT_SIZE,
      jumpOnLeft: true,
      maxLabelLength: MAX_LABEL_LENGTH,
      gateRadius: GATE_RADIUS,
      gateOffset: GATE_OFFSET,
      padding: PADDING,
      nodeColor: OBSIDIAN_NODE_COLOR,
      gateColor: GATE_COLOR,
      borderColor: "transparent",
      backgroundColor: OBSIDIAN_NODE_BG_COLOR,
      virtualNodeColor: VIRTUAL_NODE_COLOR,
      virtualNodeBGColor: VIRTUAL_NODE_BG_COLOR
    }
  );


  addNodes(
    nodesMap,
    rootFile,
    jumps,
    lJumps,
    {
      fontSize: FONT_SIZE,
      jumpOnLeft: false,
      maxLabelLength: MAX_LABEL_LENGTH,
      gateRadius: GATE_RADIUS,
      gateOffset: GATE_OFFSET,
      padding: PADDING,
      nodeColor: NODE_COLOR,
      gateColor: GATE_COLOR,
      borderColor: "transparent",
      backgroundColor: NODE_BG_COLOR,
      virtualNodeColor: VIRTUAL_NODE_COLOR,
      virtualNodeBGColor: VIRTUAL_NODE_BG_COLOR
    }
  );

  addNodes(
    nodesMap,
    rootFile,
    siblings,
    lSiblings,
    {
      fontSize: DISTANT_FONT_SIZE,
      jumpOnLeft: true,
      maxLabelLength: MAX_LABEL_LENGTH,
      gateRadius: GATE_RADIUS,
      gateOffset: GATE_OFFSET,
      padding: PADDING,
      nodeColor: NODE_COLOR,
      gateColor: GATE_COLOR,
      borderColor: "transparent",
      backgroundColor: NODE_BG_COLOR,
      virtualNodeColor: VIRTUAL_NODE_COLOR,
      virtualNodeBGColor: VIRTUAL_NODE_BG_COLOR
    }
  );

  Array.from(nodesMap.keys()).forEach(nodeTitle => {
    const node = nodesMap.get(nodeTitle);
    const bc = getMatrixNeighbours(nodeTitle);
    const parent = forwardLinksSet.has(nodeTitle) ? [rootFile.basename] : [];
    const parents = bc ? joinRealsAndImplieds(bc.up).concat(parent) : parent;
    const child = backLinksSet.has(nodeTitle) ? [rootFile.basename] : []
    const children = bc ? joinRealsAndImplieds(bc.down).concat(child) : child;
    const jumps = bc ? distinct(joinRealsAndImplieds(bc.next).concat(joinRealsAndImplieds(bc.prev))) : [];
    //siblings are left out in this case on purpose

    node.spec.hasChildren = children.length>0;
    node.spec.hasParents = parents.length>0;
    node.spec.hasJumps = jumps.length>0;

    const addLinks = (nodes,relation) => nodes.forEach(n => {
      if(!nodesMap.has(n)) return;
      if(linksMap.has(`${nodeTitle}/${n}`)) return;
    linksMap.set(`${nodeTitle}/${n}`,relation);
    linksMap.set(`${n}/${nodeTitle}`,null);
    });

    addLinks(parents,["parent","child"]);
    addLinks(children, ["child","parent"]);
    addLinks(jumps, ["jump","jump"]);
  });

  lCenter.render();
  lParents.render();
  lChildren.render();
  lJumps.render();
  lSiblings.render();

  const getGate = (key,value) => (value === "parent")
    ? nodesMap.get(key).parentGateId
    : (value === "child")
      ? nodesMap.get(key).childGateId
      : nodesMap.get(key).jumpGateId;

  ea.style.strokeColor = LINK_COLOR;
  for([key,value] of linksMap) {
    if(value) {
    const k=key.split("/");
      const gate1 = getGate(k[0],value[0]);
      const gate2 = getGate(k[1],value[1]);
    ea.connectObjects(gate1, null, gate2, null, { startArrowHead: null, endArrowHead: null });
    }
  }

  elements = ea.getElements();
  ea.getExcalidrawAPI().updateScene({
    elements: elements.filter(
      el=>el.type==="arrow"
    ).concat(elements.filter(el=>el.type!=="arrow"))
  })
  ea.getExcalidrawAPI().zoomToFit();
}

app.workspace.on(EVENT, window.brainGraphEventHandler);

const mdLeaf = app.workspace.getLeavesOfType("markdown");
if(mdLeaf.length>0) {
  window.brainGraphEventHandler(mdLeaf[0]);
  return;
}

const mdExcalidrawLeaf = app.workspace.getLeavesOfType("excalidraw").filter(l=>l!==ea.targetView.leaf);
if(mdExcalidrawLeaf.length>0) {
  window.brainGraphEventHandler(mdExcalidrawLeaf[0]);
  return;
}

const mdImageLeaf = app.workspace.getLeavesOfType("image");
if(mdImageLeaf.length>0) {
  window.brainGraphEventHandler(mdImageLeaf[0]);
  return;
}