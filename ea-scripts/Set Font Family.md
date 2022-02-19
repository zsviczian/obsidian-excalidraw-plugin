/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-font-family.jpg)

Sets font family of the text block (Virgil, Helvetica, Cascadia). Useful if you want to set a keyboard shortcut for selecting font family.

See documentation for more details:
https://zsviczian.github.io/obsidian-excalidraw-plugin/ExcalidrawScriptsEngine.html

```javascript
*/
elements = ea.getViewSelectedElements().filter((el)=>el.type==="text");
if(elements.length===0) return;
let font = ["Virgil","Helvetica","Cascadia"];
font = parseInt(await utils.suggester(font,["1","2","3"]));
if (isNaN(font)) return;
elements.forEach((el)=>el.fontFamily = font);
ea.copyViewElementsToEAforEditing(elements);
ea.addElementsToView(false,false);