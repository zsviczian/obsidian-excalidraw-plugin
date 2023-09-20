/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-grid.jpg)

The default grid size in Excalidraw is 20. Currently there is no way to change the grid size via the user interface. This script offers a way to bridge this gap.

See documentation for more details:
https://zsviczian.github.io/obsidian-excalidraw-plugin/ExcalidrawScriptsEngine.html

```javascript
*/
if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.9.19")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

const api = ea.getExcalidrawAPI();
let appState = api.getAppState();
const gridColor = appState.gridColor;
let gridFrequency = gridColor?.MajorGridFrequency ?? 5;

const customControls =  (container) => {
  new ea.obsidian.Setting(container)
    .setName(`Major grid frequency`)
    .addDropdown(dropdown => {
      [2,3,4,5,6,7,8,9,10].forEach(grid=>dropdown.addOption(grid,grid));
      dropdown
        .setValue(gridFrequency)
        .onChange(value => {
           gridFrequency = value;
        })
    })
}

const grid = parseInt(await utils.inputPrompt(
  "Grid size?",
  null,
  appState.previousGridSize?.toString()??"20",
  null,
  1,
  false,
  customControls
));
if(isNaN(grid)) return; //this is to avoid passing an illegal value to Excalidraw

appState.gridSize = grid;
appState.previousGridSize = grid;
if(gridColor) gridColor.MajorGridFrequency = parseInt(gridFrequency);
api.updateScene({
  appState : {gridSize: grid, previousGridSize: grid, gridColor},
  commitToHistory:false
});