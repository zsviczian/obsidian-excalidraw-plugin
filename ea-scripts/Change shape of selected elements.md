/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-change-shape.jpg)

The script allows you to change the shape of selected Rectangles, Diamonds and Ellipses. 

```javascript
*/
const shapes=["ellipse","rectangle","diamond"];
elements = ea.getViewSelectedElements().filter(el=>shapes.contains(el.type));
newShape = await utils.suggester(shapes, shapes);
if(!newShape) return;

elements.forEach(el=>el.type = newShape);
ea.copyViewElementsToEAforEditing(elements);
ea.addElementsToView();