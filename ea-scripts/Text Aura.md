/* 
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-text-aura.jpg)
Select a single text element, or a text element in a container. The container must have a transparent background.
The script will add an aura to the text by adding 4 copies of the text each with the inverted stroke color of the original text element and with a very small X and Y offset. The resulting 4 + 1 (original) text elements or containers will be grouped.

If you copy a color string on the clipboard before running the script, the script will use that color instead of the inverted color.

```js*/
els = ea.getViewSelectedElements();
const isText = (els.length === 1) && els[0].type === "text";
const isContainer = (els.length === 2) &&
  ((els[0].type === "text" && els[1].id === els[0].containerId && els[1].backgroundColor.toLowerCase() === "transparent") ||
    (els[1].type === "text" && els[0].id === els[1].containerId && els[0].backgroundColor.toLowerCase() === "transparent"));

if (!(isText || isContainer)) {
  new Notice ("Select a single text element, or a container with a text element and with transparent background color",10000);
  return;
}

let strokeColor = ea
  .getCM(els.filter(el=>el.type === "text")[0].strokeColor)
  .invert({alpha: false})
  .stringHEX({alpha: false});
clipboardText = await navigator.clipboard.readText();
if(clipboardText) {
  const cm1 = ea.getCM(clipboardText);
  if(cm1.format !== "invalid") {
	strokeColor = cm1.stringHEX();
  } else {
    const cm2 = ea.getCM("#"+clipboardText);
    if(cm2.format !== "invalid") {
      strokeColor = cm2.stringHEX();
    }
  }
}

const offset = els.filter(el=>el.type === "text")[0].fontSize/24;

let ids = [];

const addClone = (offsetX, offsetY) => {
  els.forEach(el=>{
    const clone = ea.cloneElement(el);
    ids.push(clone.id);
    clone.x += offsetX;
	clone.y += offsetY;
	if(offsetX!==0 || offsetY!==0) {
	  switch (clone.type) {
	    case "text":
		  clone.strokeColor = strokeColor; 
		  break;
	    default:
		  clone.strokeColor = "transparent";
		  break;
	  }
	}
    ea.elementsDict[clone.id] = clone;
  })
}

addClone(-offset,0);
addClone(offset,0);
addClone(0,offset);
addClone(0,-offset);
addClone(0,0);
ea.copyViewElementsToEAforEditing(els);
els.forEach(el=>ea.elementsDict[el.id].isDeleted = true);

ea.addToGroup(ids);
ea.addElementsToView(false, true, true);