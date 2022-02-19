/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-organic-line.jpg)

Converts selected freedraw lines such that pencil pressure will decrease from maximum to minimum from the beginning of the line to its end. The resulting line is placed at the back of the layers, under all other items. Helpful when drawing organic mindmaps.

```javascript
*/
let elements = ea.getViewSelectedElements().filter((el)=>["freedraw","line","arrow"].includes(el.type));
if(elements.length === 0) {
  elements = ea.getViewSelectedElements();
  const len = elements.length;
  if(len === 0 || ["freedraw","line","arrow"].includes(elements[len].type)) {
    return;
  }
  elements = [elements[len]];
} 
elements.forEach((el)=>{
  el.simulatePressure = false;
  el.type = "freedraw";
  el.pressures = [];
  const len = el.points.length;
  for(i=0;i<len;i++)
    el.pressures.push((len-i)/len);
});
ea.copyViewElementsToEAforEditing(elements);
await ea.addElementsToView(false,false);
elements.forEach((el)=>ea.moveViewElementToZIndex(el.id,0));