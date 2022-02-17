/* 
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/ea-toggle-fullscreen.jpg)

Hides Obsidian workspace leaf padding and header (based on option in settings, default is "hide header" = true) which will take Excalidraw to full screen.

```javascript
*/
if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.5.21")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

settings = ea.getScriptSettings();

if(!settings["Hide header"]) {
  settings = {
    "Hide header": {
      value: false,
	},
    ...settings
  };
  ea.setScriptSettings(settings);
}
const hideHeader = settings["Hide header"].value;

const newStylesheet = document.createElement("style");
newStylesheet.id = "excalidraw-full-screen";
newStylesheet.textContent = `
  .workspace-leaf-content .view-content {
    padding: 0 !important;
  }
  ${hideHeader?`
  .view-header {
    display: none !important;
  }`:""}
  .status-bar {
    display: none !important;
  }
`;

const oldStylesheet = document.getElementById(newStylesheet.id);
if(oldStylesheet) document.head.removeChild(oldStylesheet);	
else document.head.appendChild(newStylesheet);