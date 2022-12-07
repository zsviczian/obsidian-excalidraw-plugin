/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-normalize-selected-arrows.png)

This script will reset the start and end positions of the selected arrows. The arrow will point to the center of the connected box and will have a gap of 8px from the box.

Tips: If you are drawing a flowchart, you can use `Normalize Selected Arrows` script to correct the position of the start and end points of the arrows, then use `Elbow connectors` script, and you will get the perfect connecting line!

```javascript
*/
if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.5.21")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}
settings = ea.getScriptSettings();
//set default values on first run
if(!settings["Gap"]) {
	settings = {
	  "Gap" : {
			value: 8,
		  description: "The value of the gap between the connection line and the element, which must be greater than 0. If you want the connector to be next to the element, set it to 1."
		}
	};
	ea.setScriptSettings(settings);
}

let gapValue = settings["Gap"].value;

const selectedIndividualArrows = ea.getMaximumGroups(ea.getViewSelectedElements())
    .reduce((result, g) => [...result, ...g.filter(el => el.type === 'arrow')], []);

const allElements = ea.getViewElements();
for(const arrow of selectedIndividualArrows) {
	const startBindingEl = allElements.filter(el => el.id === (arrow.startBinding||{}).elementId)[0];
	const endBindingEl = allElements.filter(el => el.id === (arrow.endBinding||{}).elementId)[0];

	if(startBindingEl) {
		recalculateStartPointOfLine(arrow, startBindingEl, endBindingEl, gapValue);
	}
	if(endBindingEl) {
		recalculateEndPointOfLine(arrow, endBindingEl, startBindingEl, gapValue);
	}
}

ea.copyViewElementsToEAforEditing(selectedIndividualArrows);
await ea.addElementsToView(false,false);

function recalculateStartPointOfLine(line, el, elB, gapValue) {
	const aX = el.x + el.width/2;
    const bX = (line.points.length <=2 && elB) ? elB.x + elB.width/2 : line.x + line.points[1][0];
    const aY = el.y + el.height/2;
    const bY = (line.points.length <=2 && elB) ? elB.y + elB.height/2 : line.y + line.points[1][1];

	line.startBinding.gap = gapValue;
	line.startBinding.focus = 0;
	const intersectA = ea.intersectElementWithLine(
            	el,
				[bX, bY],
            	[aX, aY],
            	line.startBinding.gap
          	);

    if(intersectA.length > 0) {
		line.points[0] = [0, 0];
		for(var i = 1; i<line.points.length; i++) {
			line.points[i][0] -= intersectA[0][0] - line.x;
			line.points[i][1] -= intersectA[0][1] - line.y;
		}
		line.x = intersectA[0][0];
		line.y = intersectA[0][1];
	}
}

function recalculateEndPointOfLine(line, el, elB, gapValue) {
	const aX = el.x + el.width/2;
    const bX = (line.points.length <=2 && elB) ? elB.x + elB.width/2 : line.x + line.points[line.points.length-2][0];
    const aY = el.y + el.height/2;
    const bY = (line.points.length <=2 && elB) ? elB.y + elB.height/2 : line.y + line.points[line.points.length-2][1];

	line.endBinding.gap = gapValue;
	line.endBinding.focus = 0;
	const intersectA = ea.intersectElementWithLine(
            	el,
				[bX, bY],
            	[aX, aY],
            	line.endBinding.gap
          	);

    if(intersectA.length > 0) {
    	line.points[line.points.length - 1] = [intersectA[0][0] - line.x, intersectA[0][1] - line.y];
	}
}