/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-stroke-width.jpg)

This script will set the stroke width of selected elements. This is helpful, for example, when you scale freedraw sketches and want to reduce or increase their line width.

See documentation for more details:
https://zsviczian.github.io/obsidian-excalidraw-plugin/ExcalidrawScriptsEngine.html

```javascript
*/
let width = (ea.getViewSelectedElement().strokeWidth??1).toString();
width = parseFloat(await utils.inputPrompt("Width?","number",width));
if(isNaN(width)) {
  new Notice("Invalid number");
  return;
}
const elements=ea.getViewSelectedElements();
ea.copyViewElementsToEAforEditing(elements);
ea.getElements().forEach((el)=>el.strokeWidth=width);
await ea.addElementsToView(false,false);
ea.viewUpdateScene({appState: {currentItemStrokeWidth: width}});
