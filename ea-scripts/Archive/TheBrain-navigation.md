/*
An Excalidraw based graph user interface for your Vault. Requires the [Dataview plugin](https://github.com/blacksmithgu/obsidian-dataview). Generates a graph view similar to that of [TheBrain](https://TheBrain.com) plex.

Watch introduction to this script on [YouTube](https://youtu.be/plYobK-VufM).

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/TheBrain.jpg)

```javascript
*/

if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.6.25")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

if(!window.DataviewAPI) {
  new Notice ("Some features will only work if you have the Dataview plugin installed and enabled", 4000);
  return;
}

const EVENT = "active-leaf-change";

const removeEventHandler = () => {
  app.workspace.off(EVENT,window.brainGraphEventHandler);
  if(isBoolean(window.excalidrawView?.linksAlwaysOpenInANewPane)) {
    window.excalidrawView.linksAlwaysOpenInANewPane = false;
  }
  const ea = ExcalidrawAutomate;
  ea.setView(window.excalidrawView);
  if(ea.targetView?.excalidrawAPI) {
    try {
      ea.targetView.semaphores.saving = false;
      ea.getExcalidrawAPI().updateScene({appState:{viewModeEnabled:false}});
    } catch {}
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
// Load Settings
//-------------------------------------------------------
let saveSettings = false;
settings = ea.getScriptSettings();
//set default values on first run
if(!settings["Max number of nodes/domain"]) {
  settings = {
	"Confirmation prompt at startup": {
	  value: true,
	  description: "Prompt me to confirm starting of the script because " +
	    "it will overwrite the current active drawing. " +
	    "You can disable this warning by turning off this switch"
	},
    "Max number of nodes/domain": {
      value: 30,
      description: "Maximum number of items to show in each domain: parents, children, siblings, jumps."
    },
    "Infer non-Breadcrumbs links": {
      value: true,
      description: "Links on the page are children, backlinks to the page are " +
        "parents. Breadcrumbs take priority. Inferred nodes have a dashed border."
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
      value: "#C49A13",
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
  saveSettings = true;
}
if(!settings["Display alias if available"]) {
  settings["Display alias if available"] = {
	value: true,
	description: "Displays the page alias instead of the " +
	  "filename if it is specified in the page's front matter. "
  };
  saveSettings = true;
}
if(!settings["Graph settings JSON"]) {
  settings["Graph settings JSON"] = {
    height: "450px",
	value: `{\n  "breadcrumbs": {\n    "down": ["children", "child"],\n    "up": ["parents", "parent"],\n    "jump": ["jump", "jumps"]\n  },\n  "tags": {\n    "#excalidraw": {\n      "nodeColor": "hsl(59, 80%, 77%)",\n	  "gateColor": "#fd7e14",\n	  "borderColor": "black",\n	  "backgroundColor": "rgba(50,50,50,0.5)",\n	  "prefix": "🎨 "\n    },\n    "#dnp": {\n      "prefix": "🗓 "\n    }\n  }\n}`,
	description: `This may contain two elements:
	<ol>
	  <li>A specification of your breadcrumbs hierarchy. Note, that if you have the Breadcrumbs plugin installed and enabled then <code>TheBrain-navigation</code> script will take your hierarchy settings from Breadcrumbs. If Breadcrumbs is disabled, this specification will be used.</li>
	  <li>Formatting of nodes based on page tags. You can specify special formatting rules for tags. If multiple tags are present on the page the first matching a specification will be used. You may provide partial specifications as well. e.g. if you only specify <code>prefix</code>, the other attributes will follow your default settings.</li>
    </ol>
	<div style="user-select: text;background: #202020; overflow:auto;width:auto;border:solid gray;border-width:.1em .1em .1em .8em;padding:.2em .6em;"><pre style="margin: 0; line-height: 125%"><span style="color: #d0d0d0">{</span>
  <span style="color: #6ab825; font-weight: bold">&quot;breadcrumbs&quot;</span><span style="color: #d0d0d0">:</span> <span style="color: #d0d0d0">{</span>
    <span style="color: #6ab825; font-weight: bold">&quot;down&quot;</span><span style="color: #d0d0d0">:</span> <span style="color: #d0d0d0">[</span><span style="color: #ed9d13">&quot;children&quot;</span><span style="color: #d0d0d0">,</span> <span style="color: #ed9d13">&quot;child&quot;</span><span style="color: #d0d0d0">],</span>
    <span style="color: #6ab825; font-weight: bold">&quot;up&quot;</span><span style="color: #d0d0d0">:</span> <span style="color: #d0d0d0">[</span><span style="color: #ed9d13">&quot;parents&quot;</span><span style="color: #d0d0d0">,</span> <span style="color: #ed9d13">&quot;parent&quot;</span><span style="color: #d0d0d0">],</span>
    <span style="color: #6ab825; font-weight: bold">&quot;jump&quot;</span><span style="color: #d0d0d0">:</span> <span style="color: #d0d0d0">[</span><span style="color: #ed9d13">&quot;jump&quot;</span><span style="color: #d0d0d0">,</span> <span style="color: #ed9d13">&quot;jumps&quot;</span><span style="color: #d0d0d0">]</span>
  <span style="color: #d0d0d0">},</span>
  <span style="color: #6ab825; font-weight: bold">&quot;tags&quot;</span><span style="color: #d0d0d0">:</span> <span style="color: #d0d0d0">{</span>
    <span style="color: #6ab825; font-weight: bold">&quot;#excalidraw&quot;</span><span style="color: #d0d0d0">:</span> <span style="color: #d0d0d0">{</span>
      <span style="color: #6ab825; font-weight: bold">&quot;nodeColor&quot;</span><span style="color: #d0d0d0">:</span> <span style="color: #ed9d13">&quot;hsl(59, 80%, 77%)&quot;</span><span style="color: #d0d0d0">,</span>
      <span style="color: #6ab825; font-weight: bold">&quot;gateColor&quot;</span><span style="color: #d0d0d0">:</span> <span style="color: #ed9d13">&quot;#fd7e14&quot;</span><span style="color: #d0d0d0">,</span>
      <span style="color: #6ab825; font-weight: bold">&quot;borderColor&quot;</span><span style="color: #d0d0d0">:</span> <span style="color: #ed9d13">&quot;black&quot;</span><span style="color: #d0d0d0">,</span>
      <span style="color: #6ab825; font-weight: bold">&quot;backgroundColor&quot;</span><span style="color: #d0d0d0">:</span> <span style="color: #ed9d13">&quot;rgba(50,50,50,0.5)&quot;</span><span style="color: #d0d0d0">,</span>
      <span style="color: #6ab825; font-weight: bold">&quot;prefix&quot;</span><span style="color: #d0d0d0">:</span> <span style="color: #ed9d13">&quot;🎨 &quot;</span>
    <span style="color: #d0d0d0">},</span>
    <span style="color: #6ab825; font-weight: bold">&quot;#dnp&quot;</span><span style="color: #d0d0d0">:</span> <span style="color: #d0d0d0">{</span>
      <span style="color: #6ab825; font-weight: bold">&quot;prefix&quot;</span><span style="color: #d0d0d0">:</span> <span style="color: #ed9d13">&quot;🗓 &quot;</span>
    <span style="color: #d0d0d0">}</span>
  <span style="color: #d0d0d0">}</span>
<span style="color: #d0d0d0">}</span>
</pre></div>`
  };
  saveSettings = true;
}

if(saveSettings) {
  ea.setScriptSettings(settings);
}

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
const USE_ALIAS = settings["Display alias if available"].value;
let formattingJSON = {};
try {
  formattingJSON = JSON.parse(settings["Graph settings JSON"].value);
} catch (e) {
  new Notice("Error reading graph settings JSON, see developer console for more information",4000);
  console.log(e);
};
const NODE_FORMATTING = formattingJSON?.tags??{};
const FORMATTED_TAGS = Object.keys(NODE_FORMATTING);

//-------------------------------------------------------
// Load breadcrumbs hierarchies
const HIERARCHIES = new Map();
if(window.BCAPI) { //read breadcrumbs if available
  const getHierarchyFields = (direction) => {
    const values = new Set(direction);
    direction.forEach(
      d => BCAPI.plugin.settings.userHiers.forEach(
        h => h[d].forEach(
          x => values.add(x)
        )
      )
    );
    return Array.from(values);
  }
  HIERARCHIES.set("down",getHierarchyFields(["down"]));
  HIERARCHIES.set("up",getHierarchyFields(["up"]));
  HIERARCHIES.set("jump",getHierarchyFields(["prev","next"]));
} else {
  HIERARCHIES.set("down",formattingJSON?.breadcrumbs?.down??["down","child","children"]);
  HIERARCHIES.set("up",formattingJSON?.breadcrumbs?.up??["up", "parent","parents"]);
  HIERARCHIES.set("jump",formattingJSON?.breadcrumbs?.jump??["jump", "jumps", "next", "previous"]);
}

//-------------------------------------------------------
// Initialization
//-------------------------------------------------------
if(SHOW_CONFIRMATION_PROMPT) {
  const result = await utils.inputPrompt(
    "This will overwrite the current active drawing",
    "type: 'ok' to Continue"
  );
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
ea.addText(0,0,"Open a document in another pane and click it to get started.\n\n" +
  "For the best experience enable 'Open in adjacent pane'\nin Excalidraw settings " +
  "under 'Links and Transclusion'.", {textAlign:"center"});
await ea.addElementsToView();
ea.getExcalidrawAPI().zoomToFit();

window.excalidrawView = ea.targetView;
window.excalidrawFile = ea.targetView.file;

ea.targetView.linksAlwaysOpenInANewPane = true;

new Notice("Brain Graph On");

//-------------------------------------------------------
// Supporting functions and classes
//-------------------------------------------------------
const getFilenameFromPath = (path) => {
  const mdFile = path.endsWith(".md");
  const filename = path.substring(path.lastIndexOf("/")+1);
  return mdFile ? filename.slice(0,-3) : filename;
}

const getExtension = (path) => {
  const lastDot = path.lastIndexOf(".");
  if(lastDot === -1) return "md";
  return path.slice(lastDot+1);
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
    const dvPage = spec.file ? DataviewAPI?.page(spec.file.path) : null;
	const tag = (dvPage?.file?.tags?.values??[]).filter(t=>FORMATTED_TAGS.some(x=>t.startsWith(x)))[0];
	if(tag) {
      const format = NODE_FORMATTING[FORMATTED_TAGS.filter(x=>tag.startsWith(x))[0]];
      spec.gateColor = format.gateColor ?? spec.gateColor;
      spec.backgroundColor = format.backgroundColor ?? spec.backgroundColor;
      spec.nodeColor = format.nodeColor ?? spec.nodeColor;
      spec.borderColor = format.borderColor ?? spec.borderColor;
      spec.prefix = format.prefix;
	}
	this.spec = spec;

    const aliases = (spec.file && USE_ALIAS)
      ? (dvPage?.file?.aliases?.values??[])
      : [];
    const label = (spec.prefix??"") + (aliases.length > 0 
      ? aliases[0] 
      : (spec.file
        ? (spec.file.extension === "md" ? spec.file.basename : spec.file.name)
        : spec.nodeTitle));
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
    box.strokeStyle = this.spec.strokeStyle??"solid";

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
  nodes.forEach(filePath => {
    const node = new Node({
      nodeTitle: getFilenameFromPath(filePath),
      file: app.vault.getAbstractFileByPath(filePath),
      hasChildren: false,
      hasParents: false,
      hasJumps: false,
      ...options
    });
    nodesMap.set(filePath,node);
    layout.nodes.push(node);
  });
}

//-------------------------------------------------------
// Breadcrumbs workaround to handle full filepath
//-------------------------------------------------------
const getPathOrSelf = (link,host) => {
  return (app.metadataCache.getFirstLinkpathDest(link,host)?.path)??link;
}

const readDVField = (field,file) => {
  const res = new Set();
  if(field.values) {
    field.values.forEach(l=>{
      if(l.type === "file") res.add(getPathOrSelf(l.path,file.path));
    });
    return Array.from(res);
  }
  if(field.path) {
    return [getPathOrSelf(field.path,file.path)];
  }
  const m = field.matchAll(/[^[]*\[\[([^#\]\|]*)[^\]]*]]/g);
  while(!(r=m.next()).done) {
	if(r.value[1]) {
	  res.add(getPathOrSelf(r.value[1],file.path));
	}
  }
  return Array.from(res);
}

const getDVFieldLinks = (page,dir,retSet=false) => {
  const fields = HIERARCHIES.get(dir);
  const links = new Set();
  const processed = new Set();
  fields.forEach(f => {
    if(page[f] && !processed.has(f)) {
      processed.add(f);
      readDVField(page[f],page.file).forEach(l=>links.add(l))
    };
  });
  return retSet ? links : Array.from(links);
}

//-------------------------------------------------------
// Event handler
//-------------------------------------------------------
window.brainGraphEventHandler = async (leaf) => {
  //sleep for 100ms to give time for leaf.view.file to be set
  await new Promise((resolve) => setTimeout(resolve, 100));
  
  //-------------------------------------------------------
  //terminate event handler if view no longer exists or file has changed
  if(!window.excalidrawView?.file || window.excalidrawView.file.path !== window.excalidrawFile?.path) {
    removeEventHandler();
    return;
  }
  
  if(!leaf?.view?.file) return;
  const rootFile = leaf.view.file;
  
  if (rootFile.path === window.excalidrawFile.path) return; //brainview drawing is active

  if(window.lastfilePath && window.lastfilePath === rootFile.path) return; //don't reload the file if it has not changed
  window.lastfilePath = rootFile.path;

  //-------------------------------------------------------
  //I must reinitialize ea because in the event handler the script engine ea will no longer be available
  ea = ExcalidrawAutomate;
  ea.reset();
  ea.setView(window.excalidrawView);
  ea.style.fontFamily = FONT_FAMILY;
  ea.style.roughness = STROKE_ROUGHNESS;
  ea.style.strokeSharpness = STROKE_SHARPNESS;
  ea.getExcalidrawAPI().updateScene({elements:[]});
  ea.style.verticalAlign = "middle";
  ea.style.strokeSharpness = "round";
  ea.style.fillStyle = "solid";

  //-------------------------------------------------------
  //build list of nodes
  const dvPage = DataviewAPI.page(rootFile.path); //workaround because 
  const parentsSet = dvPage
    ? getDVFieldLinks(dvPage,"up",true)
    : new Set();
  parentsSet.delete(rootFile.path);
  
  const childrenSet = dvPage
    ? getDVFieldLinks(dvPage,"down",true)
    : new Set();
  childrenSet.delete(rootFile.path);

  const jumpsSet = dvPage
    ? getDVFieldLinks(dvPage,"jump",true)
    : new Set();
  jumpsSet.delete(rootFile.path);

  let backlinksSet = new Set(
    Object.keys((app.metadataCache.getBacklinksForFile(rootFile)?.data)??{})
    .map(l=>app.metadataCache.getFirstLinkpathDest(l,rootFile.path)?.path??l)
  );
  
  backlinksSet.forEach(l=>{
    const page = DataviewAPI.page(l);
    if(page) {
      if(getDVFieldLinks(page,"down",true).has(rootFile.path)) {
        parentsSet.add(l);
        backlinksSet.delete(l);
        return;
      }
      if(getDVFieldLinks(page,"up",true).has(rootFile.path)) {
        childrenSet.add(l);
        backlinksSet.delete(l);
        return;
      }
      if(getDVFieldLinks(page,"jump", true).has(rootFile.path)) {
        jumpsSet.add(l);
        backlinksSet.delete(l);
        return;
      }
    }
  })

  const parents = Array.from(parentsSet).slice(0,MAX_ITEMS);
  const children = Array.from(childrenSet).slice(0,MAX_ITEMS);
  const jumps = Array.from(jumpsSet).slice(0,MAX_ITEMS);
  
  //adding links from the document, not explicitly declared as a breadcrumb
  const forwardLinks = INCLUDE_OBSIDIAN_LINKS 
    ? distinct(app.metadataCache
        .getLinks()[rootFile.path]?.map(
          l=>app.metadataCache.getFirstLinkpathDest(l.link.match(/[^#]*/)[0],rootFile.path)??l.link.match(/[^#]*/)[0]
        ).filter(f=>f && (!HIDE_ATTACHMENTS || (f.extension??getExtension(f)) === "md"))
        .map(f=>f.path??f)
        .filter(l=>!parentsSet.has(l) && !childrenSet.has(l) && !jumpsSet.has(l) && l!==rootFile.path && !backlinksSet.has(l))
        .slice(0,Math.max(MAX_ITEMS-children.length))
      )
    : [];
  const forwardlinksSet = new Set(forwardLinks);
  
  const backLinks = INCLUDE_OBSIDIAN_LINKS
	? Array.from(backlinksSet)
	  .filter(l=>!parentsSet.has(l) && !childrenSet.has(l) &&
        !jumpsSet.has(l) && l!==rootFile.path && !forwardlinksSet.has(l))
	  .slice(0,Math.max(MAX_ITEMS-parents.length))
	: [];
  backlinksSet = new Set(backLinks);

  const sharedParents = INCLUDE_OBSIDIAN_LINKS
    ? backLinks.concat(parents)
    : parents;
    
  const siblings = distinct(
    sharedParents.map(p=>{
      const page = DataviewAPI.page(p);
      return page
        ? getDVFieldLinks(page,"down")
          .filter(l=>!parentsSet.has(l) && !childrenSet.has(l) &&
            !jumpsSet.has(l) && l!==rootFile.path &&
            !forwardlinksSet.has(l) && !backlinksSet.has(l))
        : [];
    }).flat()
  ).slice(0,MAX_ITEMS);
  const siblingsSet = new Set(siblings);

  const inverseInferredSiblingsMap = new Map();
  const inferredSiblings = INCLUDE_OBSIDIAN_LINKS
    ? distinct(
      sharedParents.map(p=>{
        f = app.vault.getAbstractFileByPath(p);  //app.metadataCache.getFirstLinkpathDest(p,rootFile.path);
        if(!f) {
          return [];
        }
        const res = Object.keys((app.metadataCache.getBacklinksForFile(f)?.data)??{})
        .map(l=>app.metadataCache.getFirstLinkpathDest(l,rootFile.path)?.path??l)
        .filter(l=>!parentsSet.has(l) && !childrenSet.has(l) && !jumpsSet.has(l) &&
          l!==rootFile.path && !forwardlinksSet.has(l) && !backlinksSet.has(l) && !siblingsSet.has(l));
        res.forEach(r=>inverseInferredSiblingsMap.set(r,p));
        return res;
      }).flat()
    ).slice(0,Math.max(MAX_ITEMS-siblings.length))
    : [];
  const inferredSiblingsSet = new Set(inferredSiblings);

  //-------------------------------------------------------
  // Generate layout and nodes
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
  const manySiblings = (siblings.length + inferredSiblings.length) > 10;
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
  nodesMap.set(rootFile.path,rootNode);
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
      borderColor: OBSIDIAN_NODE_BG_COLOR,
      strokeStyle: "dotted",
      strokeWidth: 3,
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
      borderColor: OBSIDIAN_NODE_BG_COLOR,
      strokeStyle: "dotted",
      strokeWidth: 3,
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

  addNodes(
    nodesMap,
    rootFile,
    inferredSiblings,
    lSiblings,
    {
      fontSize: DISTANT_FONT_SIZE,
      jumpOnLeft: true,
      maxLabelLength: MAX_LABEL_LENGTH,
      gateRadius: GATE_RADIUS,
      gateOffset: GATE_OFFSET,
      padding: PADDING,
      nodeColor: OBSIDIAN_NODE_COLOR,
      gateColor: GATE_COLOR,
      borderColor: OBSIDIAN_NODE_BG_COLOR,
      strokeStyle: "dotted",
      strokeWidth: 3,
      backgroundColor: OBSIDIAN_NODE_BG_COLOR,
      virtualNodeColor: VIRTUAL_NODE_COLOR,
      virtualNodeBGColor: VIRTUAL_NODE_BG_COLOR
    }
  );
  
  //-------------------------------------------------------
  // Generate links for all displayed nodes
  const separator = "?"; //any character disallowed in filenames
  Array.from(nodesMap.keys()).forEach(filePath => {
    const node = nodesMap.get(filePath);
	const dvPage = DataviewAPI.page(filePath);

    //-------------------------------------------------------
    // Add links originating from node
    const parent = forwardlinksSet.has(filePath) 
      ? rootFile.path
      : inverseInferredSiblingsMap.get(filePath);
    const parents = dvPage
      ? (parent ? getDVFieldLinks(dvPage,"up",true).add(parent) : getDVFieldLinks(dvPage,"up",true))
      : (parent ? new Set([parent]) : new Set());

    const child = backlinksSet.has(filePath) ? rootFile.path : null
    const children = dvPage
      ? (child ? getDVFieldLinks(dvPage,"down", true).add(child) : getDVFieldLinks(dvPage,"down", true))
      : (child ? new Set([child]) : new Set());

    const jumps = dvPage
      ? getDVFieldLinks(dvPage,"jump", true)
      : new Set();
    
    //siblings are left out in this case on purpose

    const addLinks = (nodes,relation) => nodes.forEach(n => {
      if(!nodesMap.has(n)) return;
      if(linksMap.has(filePath + separator + n)) return;
      linksMap.set(filePath + separator + n,relation);
      linksMap.set(n + separator + filePath,null);
    });

    addLinks(parents,["parent","child"]);
    addLinks(children, ["child","parent"]);
    addLinks(jumps, ["jump","jump"]);

    //-------------------------------------------------------
    //Set gate fill 
    //- if node has outgoing links
    node.spec.hasChildren = node.spec.hasChildren || children.size>0;
    node.spec.hasParents = node.spec.hasParents || parents.size>0;
    node.spec.hasJumps = node.spec.hasJumps || jumps.size>0;

    //- of the nodes on the other end of outgoing links
    //  this is required on top of backlinks, to handle
    //  nodes for referenced but not yet created pages
    parents.forEach(p=>{
      const n = nodesMap.get(p);
      if(n) n.spec.hasChildren = true;
    });
    
    children.forEach(p=>{
      const n = nodesMap.get(p);
      if(n) n.spec.hasParents = true;
    });

    jumps.forEach(p=>{
      const n = nodesMap.get(p);
      if(n) n.spec.hasJumps = true;
    });

    //- if node has an incoming link from a node outside the visible graph
	if(node.spec.file && !(node.spec.hasParents && node.spec.hasChildren && node.hasJumps)) {
      const nodeBacklinks = new Set(
        Object.keys((app.metadataCache.getBacklinksForFile(node.spec.file)?.data)??{})
        .map(l=>app.metadataCache.getFirstLinkpathDest(l,filePath)?.path??l)
      );

      nodeBacklinks.forEach(l=>{
        if(node.spec.hasParents && node.spec.hasChildren && node.hasJumps) return;
        const page = DataviewAPI.page(l);
        if(page) {
          if(getDVFieldLinks(page,"down",true).has(filePath)) {
            node.spec.hasParents = true;
            return;
          }
          if(getDVFieldLinks(page,"up",true).has(filePath)) {
            node.spec.hasChildren = true;
            return;
          }
          if(getDVFieldLinks(page,"jump",true).has(filePath)) {
            node.spec.hasJumps = true;
            return;
          }
          if(INCLUDE_OBSIDIAN_LINKS) {
            node.spec.hasParents = true;
            return;
          }
        }
      });
    }
    
    if(!node.spec.hasChildren && INCLUDE_OBSIDIAN_LINKS && node.spec.file) {
      const forwardLinks = app.metadataCache
        .getLinks()[filePath]?.map(
          l=>app.metadataCache.getFirstLinkpathDest(l.link.match(/[^#]*/)[0],rootFile.path)??l.link.match(/[^#]*/)[0]
        ).filter(f=>f && (!HIDE_ATTACHMENTS || (f.extension??getExtension(f)) === "md"))
        .map(f=>f.path??f)
        .filter(l=>!parents.has(l) && !children.has(l) && !jumps.has(l) && l!==rootFile.path);        
      if(forwardLinks.length > 0) {
        node.spec.hasChildren = true;
      }
    }
  });

  //-------------------------------------------------------
  // Render
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
    const k=key.split(separator);
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

//-------------------------------------------------------
// Initiate event listner and trigger plex if file is open
//-------------------------------------------------------
app.workspace.on(EVENT, window.brainGraphEventHandler);

ea.targetView.semaphores.saving = true; //disable saving by setting this Excalidraw flag (not published API)

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