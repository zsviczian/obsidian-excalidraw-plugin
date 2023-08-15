/*
Toggles the grid on and off. Especially useful when drawing with just a pen without a mouse or keyboard, as toggling the grid by left-clicking with the pen is sometimes quite tedious.

See documentation for more details:
https://zsviczian.github.io/obsidian-excalidraw-plugin/ExcalidrawScriptsEngine.html

```javascript
*/
if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.8.11")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}
const api = ea.getExcalidrawAPI();
let {gridSize, previousGridSize} = api.getAppState();

if (!previousGridSize) {
  previousGridSize = 20
}
if (!gridSize) {
  gridSize = previousGridSize;
}
else
{
  previousGridSize = gridSize;
  gridSize = null;
}
ea.viewUpdateScene({
  appState:{
    gridSize,
    previousGridSize
  },
  commitToHistory:false
});