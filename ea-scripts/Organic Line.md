/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-organic-line.jpg)

Converts selected freedraw lines such that pencil pressure will decrease from maximum to minimum from the beginning of the line to its end. The resulting line is placed at the back of the layers, under all other items. Helpful when drawing organic mindmaps.

```javascript
*/

if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.8.8")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

let elements = ea.getViewSelectedElements().filter((el)=>["freedraw","line","arrow"].includes(el.type));

//if nothing is selected find the last element that was drawn and use it if it is the right element type
if(elements.length === 0) {
  elements = ea.getViewSelectedElements();
  const len = elements.length;
  if(len === 0 || ["freedraw","line","arrow"].includes(elements[len].type)) {
    return;
  }
  elements = [elements[len]];
} 

const lineType = await utils.suggester(["Thick to thin", "Thin to thick to thin"],["l1","l2"],"Select the type of line");
if(!lineType) return;

ea.copyViewElementsToEAforEditing(elements);

ea.getElements().forEach((el)=>{
  el.simulatePressure = false;
  el.type = "freedraw";
  el.pressures = Array(el.points.length).fill(1);
  el.customData = {
    strokeOptions: {
      ... lineType === "l1"
      ? {
          options: {
            thinning: 1,
            smoothing: 0.5,
            streamline: 0.5,
            easing: "linear",
            start: {
              taper: 0,
              cap: true
            },
            end: {
              taper: true,
              easing: "linear",
              cap: false
            }
          }
        }
      : {
          options: {
            thinning: 4,
            smoothing: 0.5,
            streamline: 0.5,
            easing: "linear",
            start: {
              taper: true,
              easing: "linear",
              cap: true
            },
            end: {
              taper: true,
              easing: "linear",
              cap: false
            }
          }
        }
    }
  };
});

await ea.addElementsToView(false,true);
elements.forEach((el)=>ea.moveViewElementToZIndex(el.id,0));
const ids=ea.getElements().map(el=>el.id);
ea.selectElementsInView(ea.getViewElements().filter(el=>ids.contains(el.id)));