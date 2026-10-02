/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-toggle-selection.webp)
<!--![](images/scripts-toggle-selection.webp)-->

Especially useful when binded to a hotkey e.g. ALT+C, as changing this preference through the menu can be tedious.
- There is a setting to show a "Notice" after changing the selection mode.

```js */
const api = ea.getExcalidrawAPI();
const appState = api.getAppState();
let settings = ea.getScriptSettings() || {};

// Add the optional Notice setting to Excalidraw settings on first run.
if (!settings["Show selection mode notice?"]) {
    settings["Show selection mode notice?"] = {
        value: false,
        description: "Show a Notice after changing the selection mode",
    };
    await ea.setScriptSettings(settings);
}

// Enable the selection tool before changing its box-selection preference.
if (appState.activeTool.type !== "selection" && appState.activeTool.type !== "lasso") {
    api.setActiveTool({ type: "selection" });
    return;
}

// Toggle the Preferences > Select on setting between overlap and containment.
const boxSelectionMode = appState.boxSelectionMode === "overlap"
    ? "contain"
    : "overlap";

api.updateScene({
    appState: {
        boxSelectionMode,
    },
    commitToHistory: false,
});

if (settings["Show selection mode notice?"].value) {
    new Notice(`Select on: ${boxSelectionMode}`);
}
