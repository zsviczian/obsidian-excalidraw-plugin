/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-organic-line-legacy.jpg)

Converts selected freedraw lines such that pencil pressure will decrease from maximum to minimum from the beginning of the line to its end. The resulting line is placed at the back of the layers, under all other items. Helpful when drawing organic mindmaps.

This is the old script from this [video](https://youtu.be/JMcNDdj_lPs?t=479). Since it's release this has been superseded by custom pens that you can enable in plugin settings. For more on custom pens, watch [this](https://youtu.be/OjNhjaH2KjI) 

The benefit of the approach in this implementation of custom pens is that it will look the same on excalidraw.com when you copy your drawing over for sharing with non-Obsidian users. Otherwise custom pens are faster to use and much more configurable.

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

ea.copyViewElementsToEAforEditing(elements);

ea.getElements().forEach((el)=>{
  el.simulatePressure = false;
  el.type = "freedraw";
  el.pressures = [];
  const len = el.points.length;
  for(i=0;i<len;i++)
    el.pressures.push((len-i)/len);
});

await ea.addElementsToView(false,true);
elements.forEach((el)=>ea.moveViewElementToZIndex(el.id,0));
const ids=ea.getElements().map(el=>el.id);
ea.selectElementsInView(ea.getViewElements().filter(el=>ids.contains(el.id)));