/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-grid.jpg)

The default grid size in Excalidraw is 20. Currently there is no way to change the grid size via the user interface. This script offers a way to bridge this gap.

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
const grid = parseInt(await utils.inputPrompt("Grid size?",null,appState.previousGridSize?.toString()??"20"));
if(isNaN(grid)) return; //this is to avoid passing an illegal value to Excalidraw
appState.gridSize = grid;
appState.previousGridSize = grid;
api.updateScene({
  appState,
  commitToHistory:false
});