/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-sticky-note-matrix.jpg)

Converts selected plain text element to sticky notes by dividing the text element line by line into separate sticky notes. The color of the stikcy note as well as the arrangement of the grid can be configured in plugin settings.

```javascript
*/
if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.5.21")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}
let settings = ea.getScriptSettings();
//set default values on first run
if(!settings["Border color"]) {
	settings = {
	  "Border color" : {
			value: "black",
      description: "Any legal HTML color (#000000, rgb, color-name, etc.). Set to 'transparent' for transparent color."
		},
		"Background color" : {
			value: "gold",
      description: "Background color of the sticky note. Set to 'transparent' for transparent color."
		},
		"Background fill style" : {
			value: "solid",
      description: "Fill style of the sticky note",
		  valueset: ["hachure","cross-hatch","solid"]
		}
	};
	await ea.setScriptSettings(settings);
}

if(!settings["Max sticky note width"]) {
  settings["Max sticky note width"] = {
    value: "600",
    description: "Maximum width of new sticky note. If text is longer, it will be wrapped",
	  valueset: ["400","600","800","1000","1200","1400","2000"]
  }
  await ea.setScriptSettings(settings);
}

if(!settings["Sticky note width"]) {
  settings["Sticky note width"] = {
    value: "100",
    description: "Preferred width of the sticky note. Set to 0 if unset.",
  }
  settings["Sticky note height"] = {
    value: "120",
    description: "Preferred height of the sticky note. Set to 0 if unset.",
  }
  settings["Rows per column"] = {
    value: "3",
    description: "If multiple text elements are converted to sticky notes in one step, how many rows before a next column is created. Only effective if fixed width & height are given. 0 for unset.",
  }
  settings["Gap"] = {
    value: "10",
    description: "Gap between rows and columns",
  }
  await ea.setScriptSettings(settings);
}

const pref_width = parseInt(settings["Sticky note width"].value);
const pref_height = parseInt(settings["Sticky note height"].value);
const pref_rows = parseInt(settings["Rows per column"].value);
const pref_gap = parseInt(settings["Gap"].value);

const maxWidth = parseInt(settings["Max sticky note width"].value);
const strokeColor = settings["Border color"].value;
const backgroundColor = settings["Background color"].value;
const fillStyle = settings["Background fill style"].value;

elements = ea.getViewSelectedElements().filter((el)=>el.type==="text");
elements.forEach((el)=>{
  ea.style.strokeColor = el.strokeColor;
  ea.style.fontFamily  = el.fontFamily;
  ea.style.fontSize    = el.fontSize;
  const text = el.text.split("\n");
  for(i=0;i<text.length;i++) {
	  ea.addText(el.x,el.y+i*el.height/text.length,text[i].trim());
  }
});
ea.deleteViewElements(elements);

ea.style.strokeColor = strokeColor;
ea.style.backgroundColor = backgroundColor;
ea.style.fillStyle = fillStyle;
const padding = 6;
const boxes = [];

const doMatrix = pref_width > 0 && pref_height > 0 && pref_rows > 0 && pref_gap > 0;
let row = 0;
let col = doMatrix ? -1 : 0;

ea.getElements().forEach((el, idx)=>{
  if(doMatrix) {
		if(idx % pref_rows === 0) {
			row=0;
			col++;
		} else {
			row++;
		}
	}
  const width = pref_width > 0 ? pref_width : el.width+2*padding;
  const widthOK = pref_width > 0 || width<=maxWidth;
  const id = ea.addRect(
    (doMatrix?col*pref_width+col*pref_gap:0)+el.x-padding,
    (doMatrix?row*pref_height+row*pref_gap:0),
    widthOK?width:maxWidth,pref_height > 0 ? pref_height : el.height+2*padding
  );
  boxes.push(id);
  ea.getElement(id).boundElements=[{type:"text",id:el.id}];
  el.containerId = id;
});

const els = Object.entries(ea.elementsDict);
let newEls = [];
for(i=0;i<els.length/2;i++) {
	newEls.push(els[els.length/2+i]);
	newEls.push(els[i])
}
ea.elementsDict = Object.fromEntries(newEls);

await ea.addElementsToView(false,true);
const containers = ea.getViewElements().filter(el=>boxes.includes(el.id));
ea.getExcalidrawAPI().updateContainerSize(containers);
ea.selectElementsInView(containers);