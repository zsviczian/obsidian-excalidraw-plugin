/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-ellipse-elements.png)

This script will add an encapsulating ellipse around the currently selected elements in Excalidraw.

See documentation for more details:
https://zsviczian.github.io/obsidian-excalidraw-plugin/ExcalidrawScriptsEngine.html

```javascript
*/
if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.5.21")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}
settings = ea.getScriptSettings();
//set default values on first run
if(!settings["Default padding"]) {
	settings = {
		"Prompt for padding?": true,
	  "Default padding" : {
			value: 10,
		  description: "Padding between the bounding box of the selected elements, and the ellipse the script creates"
		}
	};
	ea.setScriptSettings(settings);
}

let padding = settings["Default padding"].value;

if(settings["Prompt for padding?"]) {
	padding = parseInt (await utils.inputPrompt("padding?","number",padding.toString()));
}

if(isNaN(padding)) {
  new Notice("The padding value provided is not a number");
  return;
}
elements = ea.getViewSelectedElements();
const box = ea.getBoundingBox(elements);
color = ea
        .getExcalidrawAPI()
        .getAppState()
        .currentItemStrokeColor;
//uncomment for random color:
//color = '#'+(Math.random()*0xFFFFFF<<0).toString(16).padStart(6,"0");
ea.style.strokeColor = color;

const ellipseWidth = box.width/Math.sqrt(2);
const ellipseHeight = box.height/Math.sqrt(2);

const topX = box.topX - (ellipseWidth - box.width/2);
const topY = box.topY - (ellipseHeight - box.height/2);
id = ea.addEllipse(
	topX - padding,
	topY - padding,
	2*ellipseWidth + 2*padding,
	2*ellipseHeight + 2*padding
);
ea.copyViewElementsToEAforEditing(elements);
ea.addToGroup([id].concat(elements.map((el)=>el.id)));
ea.addElementsToView(false,false);
