/*
You can set a custom zoom level with this script. This allows you to set a zoom level below 10% or set the zoom level to a specific value.  Note however, that Excalidraw has a bug under 10% zoom, and a phantom copy of your image may appear on screen. If this happens, increase the zoom and the phantom should disappear, if it doesn't then close and open the drawing.

```js*/
const api = ea.getExcalidrawAPI();
const appState = api.getAppState();
const zoomStr = await utils.inputPrompt("Zoom [%]",null,`${appState.zoom.value*100}%`);
if(!zoomStr) return;
const zoomNum = parseFloat(zoomStr.match(/^\d*/)[0]);
if(isNaN(zoomNum)) {
  new Notice("You must provide a number");
  return;
}

ea.getExcalidrawAPI().updateScene({appState:{zoom:{value: zoomNum/100 }}});