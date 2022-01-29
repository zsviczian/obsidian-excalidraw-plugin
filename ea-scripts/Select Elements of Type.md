/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-select-element-of-type.jpg)
Prompts you with a list of the different element types in the active image. Only elements of the selected type will be selected on the canvas. If nothing is selected when running the script, then the script will process all the elements on the canvas. If some elements are selected when the script is executed, then the script will only process the selected elements.

The script is useful when, for example, you want to bring to front all the arrows, or want to change the color of all the text elements, etc.

```javascript
*/

if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.5.24")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

let elements = ea.getViewSelectedElements();
if(elements.length === 0) elements = ea.getViewElements();
if(elements.length === 0) {
  new Notice("There are no elements in the view");
  return;
}

typeSet = new Set();
elements.forEach(el=>typeSet.add(el.type));
let elementType = Array.from(typeSet)[0];
		
if(typeSet.size > 1) {
	elementType = await utils.suggester(
	  Array.from(typeSet).map((item) => { 
		  switch(item) {
				case "line": return "— line";
				case "ellipse": return "○ ellipse";
	      case "rectangle": return "□ rectangle";
	      case "diamond": return "◇ diamond";
	      case "arrow": return "→ arrow";
	      case "freedraw": return "✎ freedraw";
	      case "image": return "🖼 image";
	      case "text": return "A text";
	      default: return item;
	    }
		}),
	  Array.from(typeSet)
	);
} 

if(!elementType) return;

ea.selectElementsInView(elements.filter(el=>el.type === elementType));