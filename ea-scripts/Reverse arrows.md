/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-download-raw.jpg)

Download this file and save to your Obsidian Vault including the first line, or open it in "Raw" and copy the entire contents to Obsidian.

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-reverse-arrow.jpg)

Reverse the direction of **arrows** within the scope of selected elements.

See documentation for more details:
https://zsviczian.github.io/obsidian-excalidraw-plugin/ExcalidrawScriptsEngine.html

```javascript
*/
elements = ea.getViewSelectedElements().filter((el)=>el.type==="arrow");
if(!elements || elements.length===0) return;
elements.forEach((el)=>{
	const start = el.startArrowhead;
	el.startArrowhead = el.endArrowhead;
	el.endArrowhead = start;
});
ea.copyViewElementsToEAforEditing(elements);
ea.addElementsToView(false,false);