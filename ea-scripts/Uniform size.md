/*

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-uniform-size.jpg)

The script will standardize the sizes of rectangles, diamonds and ellipses adjusting all the elements to match the largest width and height within the group.

```javascript
*/
const boxShapesDispaly=["○ ellipse","□ rectangle","◇ diamond"];
const boxShapes=["ellipse","rectangle","diamond"];

let editedElements = [];

const elements = ea.getViewSelectedElements().filter(el=>boxShapes.contains(el.type));
if(elements.length===0) {
  new Notice("No rectangle, or diamond or ellipse elements are selected. Please select some elements");
  return;
}

const typeSet = new Set();
elements.forEach(el=>typeSet.add(el.type));

const elementType = await utils.suggester(
  Array.from(typeSet).map((item) => { 
    switch(item) {
      case "ellipse": return "○ ellipse";
	  case "rectangle": return "□ rectangle";
	  case "diamond": return "◇ diamond";
      default: return item;
    }
  }),
  Array.from(typeSet),
  "Select element types to resize"
);

if(!elementType) return;

ea.copyViewElementsToEAforEditing(elements.filter(el=>el.type===elementType));
let width = height = 0;
ea.getElements().forEach(el=>{
  if(el.width>width) width = el.width;
  if(el.height>height) height = el.height;
})

ea.getElements().forEach(el=>{
  el.width = width;
  el.height = height;
})

const ids = ea.getElements().map(el=>el.id);
await ea.addElementsToView(false,true);
ea.getExcalidrawAPI().updateContainerSize(ea.getViewElements().filter(el=>ids.contains(el.id)));
