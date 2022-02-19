/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-download-raw.jpg)

Download this file and save to your Obsidian Vault including the first line, or open it in "Raw" and copy the entire contents to Obsidian.

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-box-each-selected-groups.png)

This script will add encapsulating boxes around each of the currently selected groups in Excalidraw.

You can focus on content creation first, and then batch add consistent style boxes to each group of text.

Tips 1: You can copy the desired style to the global state using script `Copy Selected Element Style to Global`, then add boxes with the same global style using script `Box Each Selected Groups`.

Tips 2: Next you can use scripts `Expand rectangles horizontally keep text centered` and `Expand rectangles vertically keep text centered` to make the boxes the same size, if you wish.

Tips 3: If you want the left and right margins to be different from the top and bottom margins, input something like `32,16`, this will create a box with left and right margins of `32` and top and bottom margins of `16`.

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
		  description: "Padding between the bounding box of the selected elements, and the box the script creates"
	  },
	  "Remember last padding?": false
	};
	ea.setScriptSettings(settings);
}

let paddingStr = settings["Default padding"].value.toString();
const rememberLastPadding = settings["Remember last padding?"];

if(settings["Prompt for padding?"]) {
	paddingStr = await utils.inputPrompt("padding?","string",paddingStr);
}
if(!paddingStr) {
	return;
}
if(rememberLastPadding) {
	settings["Default padding"].value = paddingStr;
	ea.setScriptSettings(settings);
}
var paddingLR = 0;
var paddingTB = 0;
if(paddingStr.indexOf(',') > 0) {
	const paddingParts = paddingStr.split(',');
	paddingLR = parseInt(paddingParts[0]);
	paddingTB = parseInt(paddingParts[1]);
}
else {
	paddingLR = paddingTB = parseInt(paddingStr);
}

if(isNaN(paddingLR) || isNaN(paddingTB)) {
	return;
}

const selectedElements = ea.getViewSelectedElements();
const groups = ea.getMaximumGroups(selectedElements);
const allIndividualArrows = ea.getMaximumGroups(ea.getViewElements())
	.reduce((result, group) => (group.length === 1 && (group[0].type === 'arrow' || group[0].type === 'line')) ? 
			[...result, group[0]] : result, []);
for(const elements of groups) {
	if(elements.length === 1 && elements[0].type ==="arrow" || elements[0].type==="line") {
		// individual arrows or lines are not affected
		continue;
	}
	const box = ea.getBoundingBox(elements);
	color = ea
			.getExcalidrawAPI()
			.getAppState()
			.currentItemStrokeColor;
	// use current stroke with and style
	const appState = ea.getExcalidrawAPI().getAppState();
	const strokeWidth = appState.currentItemStrokeWidth;
	const strokeStyle = appState.currentItemStrokeStyle;
	const strokeSharpness = appState.currentItemStrokeSharpness;
	const roughness = appState.currentItemRoughness;
	const fillStyle = appState.currentItemFillStyle;
	const backgroundColor = appState.currentItemBackgroundColor;
	ea.style.strokeWidth = strokeWidth;
	ea.style.strokeStyle = strokeStyle;
	ea.style.strokeSharpness = strokeSharpness;
	ea.style.roughness = roughness;
	ea.style.fillStyle = fillStyle;
	ea.style.backgroundColor = backgroundColor;	
	ea.style.strokeColor = color;

	const id = ea.addRect(
		box.topX - paddingLR,
		box.topY - paddingTB,
		box.width + 2*paddingLR,
		box.height + 2*paddingTB
	);

	// Change the join point in the group to the new box
	const elementsWithBounded = elements.filter(el => (el.boundElements || []).length > 0);
	const boundedElementsCollection = elementsWithBounded.reduce((result, el) => [...result, ...el.boundElements], []);
	for(const el of elementsWithBounded) {
		el.boundElements = [];
	}

	const newRect = ea.getElement(id);
	newRect.boundElements = boundedElementsCollection;

    const elementIds = elements.map(el => el.id);

	const startBindingLines = allIndividualArrows.filter(el => elementIds.includes((el.startBinding||{}).elementId));
	for(startBindingLine of startBindingLines) {
		startBindingLine.startBinding.elementId = id;
		recalculateStartPointOfLine(startBindingLine, newRect);
	}

	const endBindingLines = allIndividualArrows.filter(el => elementIds.includes((el.endBinding||{}).elementId));
	for(endBindingLine of endBindingLines) {
		endBindingLine.endBinding.elementId = id;
		recalculateEndPointOfLine(endBindingLine, newRect);
	}

	ea.copyViewElementsToEAforEditing(elements);
	ea.addToGroup([id].concat(elements.map((el)=>el.id)));
}

await ea.addElementsToView(false,false);

function recalculateStartPointOfLine(line, el) {
	const aX = el.x + el.width/2;
    const bX = line.x + line.points[1][0];
    const aY = el.y + el.height/2;
    const bY = line.y + line.points[1][1];

	line.startBinding.gap = 8;
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

function recalculateEndPointOfLine(line, el) {
	const aX = el.x + el.width/2;
    const bX = line.x + line.points[line.points.length-2][0];
    const aY = el.y + el.height/2;
    const bY = line.y + line.points[line.points.length-2][1];

	line.endBinding.gap = 8;
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
