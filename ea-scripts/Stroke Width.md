/*
Download this file and save to your Obsidian Vault, or open it in "Raw" and copy to Obsidian.

This script will set the stroke width of selected elements. This is helpful, for example, when you scale freedraw sketches and want to reduce or increase their line width.

See documentation for more details:
https://zsviczian.github.io/obsidian-excalidraw-plugin/ExcalidrawScriptsEngine.html

```javascript
*/
width = await utils.inputPrompt("Width?");
const elements=ea.getViewSelectedElements();
ea.copyViewElementsToEAforEditing(elements);
ea.getElements().forEach((el)=>el.strokeWidth=width);
ea.addElementsToView();