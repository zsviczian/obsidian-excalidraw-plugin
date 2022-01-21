/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-textelement-to-transparent-stickynote.png)

Converts selected plain text elements to sticky notes with transparent background and transparent stroke color. Essentially converts text element into a wrappable format.

```javascript
*/
elements = ea.getViewSelectedElements()
             .filter((el)=>(el.type==="text")&&(el.containerId===null));
if(elements.length===0) return;
ea.style.strokeColor = "transparent";
ea.style.backgroundColor = "transparent"
const padding = 5;
elements.forEach((el)=>{
  const id = ea.addRect(el.x-padding,el.y-padding,el.width+2*padding,el.height+2*padding);
  ea.getElement(id).boundElements=[{type:"text",id:el.id}];
  el.containerId = id;
});
ea.copyViewElementsToEAforEditing(elements);
ea.addElementsToView();