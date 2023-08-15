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
let appState = api.getAppState();

if (!appState.previousGridSize) {
  appState.previousGridSize = 20
}
if (!appState.gridSize) {
  appState.gridSize = appState.previousGridSize;
}
else
{
  appState.previousGridSize = appState.gridSize;
  appState.gridSize = null;
}
api.updateScene({
  appState,
  commitToHistory:false
});