/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-set-background-color-of-unclosed-line.jpg)

Use this script to set the background color of unclosed (i.e. open) line, arrow and freedraw objects by creating a clone of the object. The script will set the stroke color of the clone to transparent and will add a straight line to close the object. Use settings to define the default background color, the fill style, and the strokeWidth of the clone. By default the clone will be grouped with the original object, you can disable this also in settings.

```javascript
*/

if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.5.26")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

settings = ea.getScriptSettings();
//set default values on first run
if(!settings["Background Color"]) {
  settings = {
    "Background Color" : {
      value: "DimGray",
      description: "Default background color of the 'shadow' object. Any valid html css color value",
    },
	  "Fill Style": {
		  value: "hachure",
			valueset: ["hachure","cross-hatch","solid"],
			description: "Default fill style of the 'shadow' object."
		},
	  "Inherit fill stroke width": {
		  value: true,
			description: "This will impact the densness of the hachure or cross-hatch fill. Use the stroke width of the line object for which the shadow is created. If set to false, the script will use a stroke width of 2."
		},
		"Group 'shadow' with original": {
		  value: true,
			description: "If the toggle is on then the shadow object that is created will be grouped with the unclosed original object."
		}
  };
  ea.setScriptSettings(settings);
}

const inheritStrokeWidth = settings["Inherit fill stroke width"].value;
const backgroundColor = settings["Background Color"].value;
const fillStyle = settings["Fill Style"].value;
const shouldGroup = settings["Group 'shadow' with original"].value;

const elements = ea.getViewSelectedElements().filter(el=>el.type==="line" || el.type==="freedraw" || el.type==="arrow");
if(elements.length === 0) {
  new Notice("No line or freedraw object is selected");
}

ea.copyViewElementsToEAforEditing(elements);
elementsToMove = [];

elements.forEach((el)=>{
  const newEl = ea.cloneElement(el);
  ea.elementsDict[newEl.id] = newEl;
  newEl.roughness = 1;
  if(!inheritStrokeWidth) newEl.strokeWidth = 2;
  newEl.strokeColor = "transparent";
  newEl.backgroundColor = backgroundColor;
  newEl.fillStyle = fillStyle;
  if (newEl.type === "arrow") newEl.type = "line";
  const i = el.points.length-1;
  newEl.points.push([ 
  //adding an extra point close to the last point in case distance is long from last point to origin and there is a sharp bend. This will avoid a spike due to a tight curve.
    el.points[i][0]*0.9,
    el.points[i][1]*0.9,
  ]);
  newEl.points.push([0,0]);
  if(shouldGroup) ea.addToGroup([el.id,newEl.id]);
  elementsToMove.push({fillId: newEl.id, shapeId: el.id});
});

await ea.addElementsToView(false,false);
elementsToMove.forEach((x)=>{
  const viewElements = ea.getViewElements();
  ea.moveViewElementToZIndex(
    x.fillId,
    viewElements.indexOf(viewElements.filter(el=>el.id === x.shapeId)[0])-1
  )
});

ea.selectElementsInView(ea.getElements());