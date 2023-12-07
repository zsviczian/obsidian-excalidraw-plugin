/*
The script will cycle through S, M, L, XL font sizes scaled to the current canvas zoom.
```js*/
const FONTSIZES = [16, 20, 28, 36];
const api = ea.getExcalidrawAPI();
const st = api.getAppState();
const zoom = st.zoom.value;
const currentItemFontSize = st.currentItemFontSize;

const fontsizes = FONTSIZES.map(s=>s/zoom);
const els = ea.getViewSelectedElements().filter(el=>el.type === "text");

const findClosestIndex = (val, list) => {
  let closestIndex = 0;
  let closestDifference = Math.abs(list[0] - val);
  for (let i = 1; i < list.length; i++) {
    const difference = Math.abs(list[i] - val);
    if (difference <= closestDifference) {
      closestDifference = difference;
      closestIndex = i;
    }
  }
  return closestIndex;
}

ea.viewUpdateScene({appState:{currentItemFontSize: fontsizes[(findClosestIndex(currentItemFontSize, fontsizes)+1) % fontsizes.length] }});

if(els.length>0) {
  ea.copyViewElementsToEAforEditing(els);
  ea.getElements().forEach(el=> {
    el.fontSize = fontsizes[(findClosestIndex(el.fontSize, fontsizes)+1) % fontsizes.length];
    const font = ExcalidrawLib.getFontString(el);
    const lineHeight = ExcalidrawLib.getDefaultLineHeight(el.fontFamily);
    const {width, height, baseline} = ExcalidrawLib.measureText(el.originalText, font, lineHeight);
    el.width = width;
    el.height = height;
    el.baseline = baseline;
  });
  ea.addElementsToView();
}