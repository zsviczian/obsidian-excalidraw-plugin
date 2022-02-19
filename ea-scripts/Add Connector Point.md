/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-bullet-point.jpg)

This script will add a small circle to the top left of each text element in the selection and add the text and the "bullet point" into a group.

See documentation for more details:
https://zsviczian.github.io/obsidian-excalidraw-plugin/ExcalidrawScriptsEngine.html

```javascript
*/
elements = ea.getViewSelectedElements().filter((el)=>el.type==="text");
ea.copyViewElementsToEAforEditing(elements);
const padding = 10;
elements.forEach((el)=>{
  ea.style.strokeColor = el.strokeColor;
  const size = el.fontSize/2;
  const ellipseId = ea.addEllipse(
    el.x-padding-size,
    el.y+size/2,
    size,
    size
  );
  ea.addToGroup([el.id,ellipseId]);
});
ea.addElementsToView(false,false);