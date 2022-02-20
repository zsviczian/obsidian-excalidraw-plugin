/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-change-shape.jpg)

The script allows you to change the shape of selected Rectangles, Diamonds and Ellipses. 

```javascript
*/
const boxShapesDispaly=["○ ellipse","□ rectangle","◇ diamond"];
const boxShapes=["ellipse","rectangle","diamond"];
const lineShapesDispaly=["- line","⭢ arrow"];
const lineShapes=["line","arrow"];

let editedElements = [];

let elements = ea.getViewSelectedElements().filter(el=>boxShapes.contains(el.type));
if (elements.length>0) {
  newShape = await utils.suggester(boxShapesDispaly, boxShapes, "Change shape of 'box' type elements in selection");
  if(newShape) {
	editedElements = elements;
    elements.forEach(el=>el.type = newShape);
  }
}

elements = ea.getViewSelectedElements().filter(el=>lineShapes.contains(el.type));
if (elements.length>0) {
  newShape = await utils.suggester(lineShapesDispaly, lineShapes, "Change shape of 'line' type elements in selection");
  if(newShape) {
	editedElements = editedElements.concat(elements);
    elements.forEach((el)=>{
	  el.type = newShape;
	  if(newShape === "arrow") {
		el.endArrowhead = "triangle";
	  }
    });
  }
}

ea.copyViewElementsToEAforEditing(editedElements);

ea.addElementsToView(false,false);