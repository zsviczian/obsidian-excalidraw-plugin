/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-normalize-selected-arrows.png)

This script will reset the start and end positions of the selected arrows. The arrow will point to the center of the connected box and will have a gap of 8px from the box.

Tips: If you are drawing a flowchart, you can use `Normalize Selected Arrows` script to correct the position of the start and end points of the arrows, then use `Elbow connectors` script, and you will get the perfect connecting line!

```javascript
*/
const selectedIndividualArrows = ea.getMaximumGroups(ea.getViewSelectedElements())
	.reduce((result, group) => (group.length === 1 && (group[0].type === 'arrow' || group[0].type === 'line')) ? 
			[...result, group[0]] : result, []);

const allElements = ea.getViewElements();
for(const arrow of selectedIndividualArrows) {
	const startBindingEl = allElements.filter(el => el.id === (arrow.startBinding||{}).elementId)[0];
	const endBindingEl = allElements.filter(el => el.id === (arrow.endBinding||{}).elementId)[0];

	if(startBindingEl) {
		recalculateStartPointOfLine(arrow, startBindingEl, endBindingEl);
	}
	if(endBindingEl) {
		recalculateEndPointOfLine(arrow, endBindingEl, startBindingEl);
	}
}

ea.copyViewElementsToEAforEditing(selectedIndividualArrows);
ea.addElementsToView();

function recalculateStartPointOfLine(line, el, elB) {
	const aX = el.x + el.width/2;
    const bX = (line.points.length <=2 && elB) ? elB.x + elB.width/2 : line.x + line.points[1][0];
    const aY = el.y + el.height/2;
    const bY = (line.points.length <=2 && elB) ? elB.y + elB.height/2 : line.y + line.points[1][1];

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

function recalculateEndPointOfLine(line, el, elB) {
	const aX = el.x + el.width/2;
    const bX = (line.points.length <=2 && elB) ? elB.x + elB.width/2 : line.x + line.points[line.points.length-2][0];
    const aY = el.y + el.height/2;
    const bY = (line.points.length <=2 && elB) ? elB.y + elB.height/2 : line.y + line.points[line.points.length-2][1];

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