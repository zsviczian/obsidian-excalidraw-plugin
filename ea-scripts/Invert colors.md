/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-invert-colors.jpg)

The script inverts the colors on the canvas including the color palette in Element Properties.

```javascript
*/
const defaultColorPalette = { // https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.6.8
  elementStroke:["#000000","#343a40","#495057","#c92a2a","#a61e4d","#862e9c","#5f3dc4","#364fc7","#1864ab","#0b7285","#087f5b","#2b8a3e","#5c940d","#e67700","#d9480f"],
  elementBackground:["transparent","#ced4da","#868e96","#fa5252","#e64980","#be4bdb","#7950f2","#4c6ef5","#228be6","#15aabf","#12b886","#40c057","#82c91e","#fab005","#fd7e14"],
  canvasBackground:["#ffffff","#f8f9fa","#f1f3f5","#fff5f5","#fff0f6","#f8f0fc","#f3f0ff","#edf2ff","#e7f5ff","#e3fafc","#e6fcf5","#ebfbee","#f4fce3","#fff9db","#fff4e6"]
};

const api = ea.getExcalidrawAPI();
const st = api.getAppState();

let colorPalette = st.colorPalette ?? defaultColorPalette;
if (Object.entries(colorPalette).length === 0) colorPalette = defaultColorPalette;
if(!colorPalette.elementStroke || Object.entries(colorPalette.elementStroke).length === 0) colorPalette.elementStroke = defaultColorPalette.elementStroke;
if(!colorPalette.elementBackground || Object.entries(colorPalette.elementBackground).length === 0) colorPalette.elementBackground = defaultColorPalette.elementBackground;
if(!colorPalette.canvasBackground || Object.entries(colorPalette.canvasBackground).length === 0) colorPalette.canvasBackground = defaultColorPalette.canvasBackground;

const invertColor = (color) => {
	if(color.toLowerCase()==="transparent") return color;
	const cm = ea.getCM(color);
	const lightness = cm.lightness;
	cm.lightnessTo(Math.abs(lightness-100));
	switch (cm.format) {
		case "hsl": return cm.stringHSL();
		case "rgb": return cm.stringRGB();
		case "hsv": return cm.stringHSV();
		default: return cm.stringHEX({alpha: false});
	}
}

function invertColorsRecursively(obj) {
  if (typeof obj === 'string') {
    return invertColor(obj);
  } else if (Array.isArray(obj)) {
    return obj.map(item => invertColorsRecursively(item));
  } else if (typeof obj === 'object' && obj !== null) {
    const result = {};
    Object.keys(obj).forEach(key => result[key] = invertColorsRecursively(obj[key]));
    return result;
  } else {
    return obj;
  }
}
colorPalette = invertColorsRecursively(colorPalette);

ea.copyViewElementsToEAforEditing(ea.getViewElements());
ea.getElements().forEach(el=>{
	el.strokeColor = invertColor(el.strokeColor);
	el.backgroundColor = invertColor(el.backgroundColor);
});

ea.viewUpdateScene({
  appState:{
	  colorPalette,
	  viewBackgroundColor: invertColor(st.viewBackgroundColor),
	  currentItemStrokeColor: invertColor(st.currentItemStrokeColor),
	  currentItemBackgroundColor: invertColor(st.currentItemBackgroundColor)
  },
  elements: ea.getElements()
});
