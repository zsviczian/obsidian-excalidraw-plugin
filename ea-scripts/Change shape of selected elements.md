/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-change-shape.jpg)

The script allows you to change the shape and fill style of selected Rectangles, Diamonds, Ellipses, Lines, Arrows and Freedraw. 

```javascript
*/
const fillStylesDispaly=["Dots (⚠ VERY SLOW performance on large objects!)","Zigzag","Zigzag-line", "Dashed", "Hachure", "Cross-hatch", "Solid"];
const fillStyles=["dots","zigzag","zigzag-line", "dashed", "hachure", "cross-hatch", "solid"];
const fillShapes=["ellipse","rectangle","diamond", "freedraw", "line"];
const boxShapesDispaly=["○ ellipse","□ rectangle","◇ diamond"];
const boxShapes=["ellipse","rectangle","diamond"];
const lineShapesDispaly=["- line","⭢ arrow"];
const lineShapes=["line","arrow"];

let editedElements = [];

let elements = ea.getViewSelectedElements().filter(el=>boxShapes.contains(el.type));
if (elements.length>0) {
  newShape = await utils.suggester(boxShapesDispaly, boxShapes, "Change shape of 'box' type elements in selection, press ESC to skip");
  if(newShape) {
	editedElements = elements;
    elements.forEach(el=>el.type = newShape);
  }
}

elements = ea.getViewSelectedElements().filter(el=>fillShapes.contains(el.type));
if (elements.length>0) {
  newFillStyle = await utils.suggester(fillStylesDispaly, fillStyles, "Change the fill style of elements in selection, press ESC to skip");
  if(newFillStyle) {
	editedElements = editedElements.concat(elements.filter(e=>!editedElements.some(el=>el.id===e.id)));
    elements.forEach(el=>el.fillStyle = newFillStyle);
  }
}

elements = ea.getViewSelectedElements().filter(el=>lineShapes.contains(el.type));
if (elements.length>0) {
  newShape = await utils.suggester(lineShapesDispaly, lineShapes, "Change shape of 'line' type elements in selection, press ESC to skip");
  if(newShape) {
	editedElements = editedElements.concat(elements.filter(e=>!editedElements.some(el=>el.id===e.id)));
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
