/*
Connects two lines. Lines may be type of arrow or line. The resulting line will carry the style of the line higher in the drawing layers (bring to front the one you want to control the look and feel). Arrows are connected intelligently.
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-concatenate-lines.png)
```js*/
const lines = ea.getViewSelectedElements().filter(el=>el.type==="line" || el.type==="arrow");
if(lines.length !== 2) {
  new Notice ("Select two lines or arrows");
  return;
}

//Same line but with angle=0
function getNormalizedLine(originalElement) {
  if(originalElement.angle === 0) return originalElement;
  
  const originalBB = ea.getBoundingBox([originalElement]);
  const centerX = originalBB.topX + originalBB.width/2;
  const centerY = originalBB.topY + originalBB.height/2;
  
  const rotate = (point, cx, cy, angle) => {
    const [x, y] = point;
    return [
      (x - cx) * Math.cos(angle) - (y - cy) * Math.sin(angle) + cx,
      (x - cx) * Math.sin(angle) + (y - cy) * Math.cos(angle) + cy
    ];
  };
  
  // Calculate absolute coordinates of all points
  const absolutePoints = originalElement.points.map(([x, y]) => [
    x + originalElement.x,
    y + originalElement.y
  ]);
  
  // Rotate all points around the bounding box center
  const rotatedPoints = absolutePoints.map(point => 
    rotate(point, centerX, centerY, originalElement.angle)
  );
  
  // Convert back to relative coordinates
  const newPoints = rotatedPoints.map(([x, y]) => [
    x - rotatedPoints[0][0],
    y - rotatedPoints[0][1]
  ]);
  
  // Create a new line element with angle 0
  ea.style = { ...ea.style, ...originalElement };
  ea.style.strokeColor = "red";
  ea.style.angle = 0;
  
  const newLineId = ea.addLine(newPoints);
  
  // Set the position of the new line to the first rotated point
  const newLine = ea.getElement(newLineId);
  newLine.x = rotatedPoints[0][0];
  newLine.y = rotatedPoints[0][1];
  delete ea.elementsDict[newLine.id];
  return newLine;
}

const points = lines.map(el=>getNormalizedLine(el)).map(
  el=>el.points.map(p=>[p[0]+el.x, p[1]+el.y])
);

const last = (p) => p[p.length-1];
const first = (p) => p[0];
const distance = (p1,p2) => Math.sqrt((p1[0]-p2[0])**2+(p1[1]-p2[1])**2);

const distances = [
	distance(first(points[0]),first(points[1])),
	distance(first(points[0]),last (points[1])),
	distance(last (points[0]),first(points[1])),
	distance(last (points[0]),last (points[1]))
];

const connectDirection = distances.indexOf(Math.min(...distances));

let newPoints = [];
switch(connectDirection) {
	case 0: //first-first
	  newPoints = [...points[0].reverse(),...points[1].slice(1)];
	  break;
	case 1: //first-last
	  newPoints = [...points[0].reverse(),...points[1].reverse().slice(1)];
	  break;	
	case 2: //last-first
	  newPoints = [...points[0],...points[1].slice(1)];
	  break;
  case 3: //last-last
	  newPoints = [...points[0],...points[1].reverse().slice(1)];
	  break;
}

["strokeColor", "backgrounColor", "fillStyle", "roundness", "roughness", "strokeWidth", "strokeStyle", "opacity"].forEach(prop=>{
	ea.style[prop] = lines[1][prop];
})

ea.style.startArrowHead = null;
ea.style.endArrowHead = null;

ea.copyViewElementsToEAforEditing(lines);
ea.getElements().forEach(el=>{el.isDeleted = true});

const lineTypes = parseInt(lines.map(line => line.type === "line" ? '1' : '0').join(''),2);

switch (lineTypes) {
  case 0: //arrow - arrow
    ea.addArrow(
      newPoints,
		  connectDirection === 0 //first-first
		  ? { startArrowHead: lines[0].endArrowhead, endArrowHead: lines[1].endArrowhead }
		  : connectDirection === 1 //first-last
		    ? { startArrowHead: lines[0].endArrowhead, endArrowHead: lines[1].startArrowhead }
		    : connectDirection === 2 //last-first
		      ? { startArrowHead: lines[0].startArrowhead, endArrowHead: lines[1].endArrowhead }
		      //3: last-last
		      : { startArrowHead: lines[0].startArrowhead, endArrowHead: lines[1].startArrowhead }
	  );
    break;
  case 1: //arrow - line
    reverse = connectDirection === 0 || connectDirection === 1;
    ea.addArrow(newPoints,{
      startArrowHead: reverse ? lines[0].endArrowhead : lines[0].startArrowhead,
      endArrowHead: reverse ? lines[0].startArrowhead : lines[0].endArrowhead
    });
    break;
  case 2: //line - arrow
    reverse = connectDirection === 1 || connectDirection === 3;
    ea.addArrow(newPoints,{
      startArrowHead: reverse ? lines[1].endArrowhead : lines[1].startArrowhead,
      endArrowHead: reverse ? lines[1].startArrowhead : lines[1].endArrowhead
    });
    break;
  case 3: //line - line
    ea.addLine(newPoints);
    break;
}


await ea.addElementsToView();