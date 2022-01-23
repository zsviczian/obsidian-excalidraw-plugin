/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-add-process-step.jpg)

This script will prompt you for the title of the process step, then will create a stick note with the text. If an element is selected then the script will connect this new step with an arrow to the previous step (the selected element). If no element is selected, then the script assumes this is the first step in the process and will only output the sticky note with the text that was entered.

```javascript
*/

if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.5.21")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

settings = ea.getScriptSettings();
//set default values on first run
if(!settings["Starting arrowhead"]) {
	settings = {
	  "Starting arrowhead" : {
			value: "none",
      valueset: ["none","arrow","triangle","bar","dot"]
		},
		"Ending arrowhead" : {
			value: "triangle",
      valueset: ["none","arrow","triangle","bar","dot"]
		},
		"Line points" : {
			value: 0,
      description: "Number of line points between start and end"
		},
		"Gap between elements": {
			value: 100
		},
		"Wrap text at (number of characters)": {
			value: 25,
		},
		"Fix width": {
			value: true,
			description: "The object around the text should have fix width to fit the wrapped text"
		}
	};
	ea.setScriptSettings(settings);
}

const arrowStart = settings["Starting arrowhead"].value === "none" ? null : settings["Starting arrowhead"].value;
const arrowEnd = settings["Ending arrowhead"].value === "none" ? null : settings["Ending arrowhead"].value;
const linePoints = Math.floor(settings["Line points"].value);
const gapBetweenElements = Math.floor(settings["Gap between elements"].value);
const wrapLineLen = Math.floor(settings["Wrap text at (number of characters)"].value);
const fixWidth = settings["Fix width"];

const textPadding = 10;
const text = await utils.inputPrompt("Text?");
const elements = ea.getViewSelectedElements();
const isFirst = (!elements || elements.length === 0);

const width = ea.measureText("w".repeat(wrapLineLen)).width;

let id = "";

if(!isFirst) {
  const fromElement = ea.getLargestElement(elements);
  ea.copyViewElementsToEAforEditing([fromElement]);

  const previousTextElements = elements.filter((el)=>el.type==="text");
  if(previousTextElements.length>0) {
    const el = previousTextElements[0];
    ea.style.strokeColor = el.strokeColor;
    ea.style.fontSize    = el.fontSize;
    ea.style.fontFamily  = el.fontFamily;
    ea.style.strokeWidth = el.strokeWidth;
    ea.style.strokeStyle = el.strokeStyle;
    ea.style.strokeSharpness = el.strokeSharpness;
  }

	
  id = ea.addText(
    fromElement.x,
    fromElement.y+fromElement.height+gapBetweenElements,
    text,
    {
      wrapAt: wrapLineLen,
      textAlign: "center",
      box: "rectangle",
      ...fixWidth
      ? {width: width, boxPadding:0}
      : {boxPadding: textPadding}
    }
  );

  ea.connectObjects(
    fromElement.id,
    null,
    id,
    null,
    {
	  endArrowHead: arrowEnd,
	  startArrowHead: arrowStart,
	  numberOfPoints: linePoints
    }
  );
  await ea.addElementsToView(false);
} else {
  id = ea.addText(
    0,
    0,
    text,
    {
      wrapAt: wrapLineLen,
      textAlign: "center",
      box: "rectangle",
      boxPadding: textPadding,
		  ...fixWidth?{width: width}:null
    }
  );
  await ea.addElementsToView(true);
}

const API = ea.getExcalidrawAPI();
st = API.getAppState();
st.selectedElementIds = {};
st.selectedElementIds[id] = true;
API.updateScene({appState: st});
