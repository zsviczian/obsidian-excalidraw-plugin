/*
Download this file and save to your Obsidian Vault, or open it in "Raw" and copy to Obsidian.

This script will add an encapsulating box around the currently selected elements in Excalidraw.

See documentation for more details:
https://zsviczian.github.io/obsidian-excalidraw-plugin/ExcalidrawScriptsEngine.html

```javascript
*/
//const padding = parseInt (await utils.inputPrompt("padding?"));
const padding = 10
elements = ea.getViewSelectedElements();
const box = ea.getBoundingBox(elements);
const rndColor = '#'+(Math.random()*0xFFFFFF<<0).toString(16).padStart(6,"0");
ea.style.strokeColor = rndColor;
id = ea.addRect(
	box.topX - padding,
	box.topY - padding,
	box.width + 2*padding,
	box.height + 2*padding
);
ea.copyViewElementsToEAforEditing(elements);
ea.addToGroup([id].concat(elements.map((el)=>el.id)));
ea.addElementsToView(false);