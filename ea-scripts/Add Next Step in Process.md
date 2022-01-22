/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-add-process-step.jpg)

This script will prompt you for the title of the process step, then will create a stick note with the text. If an element is selected then the script will connect this new step with an arrow to the previous step (the selected element). If no element is selected, then the script assumes this is the first step in the process and will only output the sticky note with the text that was entered.

```javascript
*/
const textPadding = 10;
const gapBetweenElements = 50;
const wrapLineLen = 25;
const text = await utils.inputPrompt("Text?");
const elements = ea.getViewSelectedElements();
const isFirst = (!elements || elements.length === 0);

if(!isFirst) {
  const fromElement = ea.getLargestElement(elements);
  ea.copyViewElementsToEAforEditing([fromElement]);

  const previousTextElements = elements.filter((el)=>el.type==="text");
  if(previousTextElements.length>0) {
    const el = previousTextElements[0];
    ea.style.strokeColor = el.strokeColor;
    ea.style.fontSize    = el.fontSize;
    ea.style.fontFamily  = el.fontFamily;
    ea.style.strokeWidth = el.strokeWidth;
    ea.style.strokeStyle = el.strokeStyle;
    ea.style.strokeSharpness = el.strokeSharpness;
  }

  const id = ea.addText(
    fromElement.x,
    fromElement.y+fromElement.height+gapBetweenElements,
    text,
    {
      wrapAt: wrapLineLen,
      textAlign: "center",
      box: "rectangle",
      boxPadding: textPadding
    }
  );

  ea.connectObjects(
    fromElement.id,
    null,
    id,
    null,
    {
	  endArrowHead: "triangle",
	  startArrowHead: null,
	  numberOfPoints: 0
    }
  );
  ea.addElementsToView(false);
} else {
  ea.addText(
    0,
    0,
    text,
    {
      wrapAt: wrapLineLen,
      textAlign: "center",
      box: "rectangle",
      boxPadding: textPadding
    }
  );
  ea.addElementsToView(true);
}
