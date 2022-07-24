/*

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-download-raw.jpg)

Download this file and save to your Obsidian Vault including the first line, or open it in "Raw" and copy the entire contents to Obsidian.

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-expand-rectangles.gif)

This script expands the height of the selected rectangles until they are all the same height.

```javascript
*/

const elements = ea.getViewSelectedElements();
const topGroups = ea.getMaximumGroups(elements);
const allLines = ea.getViewElements().filter(el => el.type === 'arrow' || el.type === 'line');
const allIndividualArrows = ea.getMaximumGroups(ea.getViewElements())
	.reduce((result, group) => (group.length === 1 && (group[0].type === 'arrow' || group[0].type === 'line')) ? 
			[...result, group[0]] : result, []);

const groupHeights = topGroups
  .map((g) => {
    if(g.length === 1 && (g[0].type === 'arrow' || g[0].type === 'line')) {
      // ignore individual lines
      return { minTop: 0, maxBottom: 0 };
    }
    return g.reduce(
      (pre, cur, i) => {
        if (i === 0) {
          return {
            minTop: cur.y,
            maxBottom: cur.y + cur.height,
            index: i,
          };
        } else {
          return {
            minTop: cur.y < pre.minTop ? cur.y : pre.minTop,
            maxBottom:
              cur.y + cur.height > pre.maxBottom
                ? cur.y + cur.height
                : pre.maxBottom,
            index: i,
          };
        }
      },
      { minTop: 0, maxBottom: 0 }
    );
  })
  .map((r) => {
    r.height = r.maxBottom - r.minTop;
    return r;
  });

const maxGroupHeight = Math.max(...groupHeights.map((g) => g.height));

for (var i = 0; i < topGroups.length; i++) {
  const rects = topGroups[i]
    .filter((el) => el.type === "rectangle")
    .sort((lha, rha) => lha.y - rha.y);
    
  const groupWidth = groupHeights[i].height;
  if (groupWidth < maxGroupHeight) {
    const distance = maxGroupHeight - groupWidth;
    const perRectDistance = distance / rects.length;
    for (var j = 0; j < rects.length; j++) {
      const rect = rects[j];
      rect.y = rect.y + perRectDistance * j;
      rect.height += perRectDistance;

      // recalculate the position of the points
      const startBindingLines = allIndividualArrows.filter(el => (el.startBinding||{}).elementId === rect.id);
     	for(startBindingLine of startBindingLines) {
     		recalculateStartPointOfLine(startBindingLine, rect);
     	}
     
     	const endBindingLines = allIndividualArrows.filter(el => (el.endBinding||{}).elementId === rect.id);
     	for(endBindingLine of endBindingLines) {
     		recalculateEndPointOfLine(endBindingLine, rect);
     	}
    }
  }
}

ea.copyViewElementsToEAforEditing(elements);
await ea.addElementsToView(false, false);

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
