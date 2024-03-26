/*
WRITTEN BY ZSOLT
ICON BY TOMASO TODOSI

See documentation for more details:
https://zsviczian.github.io/obsidian-excalidraw-plugin/ExcalidrawScriptsEngine.html

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-line-weight-cycle.jpg)
```js*/
const w = [0.5,1,2,4,8,12]; //change to [0,1,2] for the stroke style (roughness)
const els = ea.getViewSelectedElements().filter(el=>el.type !== "image"); //image elements don't have a stroke width
if(els.length === 0) return;
ea.copyViewElementsToEAforEditing(els);

const findClosestIndex = (val) => {
  let closestIndex = 0;
  let closestDifference = Math.abs(w[0] - val);
  for (let i = 1; i < w.length; i++) {
    const difference = Math.abs(w[i] - val);
    if (difference <= closestDifference) {
      closestDifference = difference;
      closestIndex = i;
    }
  }
  return closestIndex;
}

ea.getElements().forEach(el=>{
	el.strokeWidth = w[(findClosestIndex(el.strokeWidth)+1) % w.length];
})
ea.addElementsToView();

