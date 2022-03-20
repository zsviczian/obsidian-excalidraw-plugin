/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-add-link-and-open.jpg)

Prompts for a file from the vault. Adds a link to the selected element pointing to the selected file. You can control in settings to open the file in the current active pane or an adjacent pane.

```javascript
*/

if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.5.21")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

settings = ea.getScriptSettings();

if(!settings["Open link in active pane"]) {
  settings = {
    "Open link in active pane": {
      value: false,
      description: "Open the link in the current active pane (on) or a new pane (off)."
	},
    ...settings
  };
  ea.setScriptSettings(settings);
}

const openInCurrentPane = settings["Open link in active pane"].value;

elements = ea.getViewSelectedElements();
if(elements.length === 0) {
  new Notice("No selected elements");
  return;
}

const files = app.vault.getFiles()
const filePaths = files.map((f)=>f.path);
file = await utils.suggester(filePaths,files,"Select a file");

if(!file) return;

const link = `[[${app.metadataCache.fileToLinktext(file,ea.targetView.file.path,true)}]]`;

ea.style.backgroundColor = "transparent";
ea.style.strokeColor = "rgba(70,130,180,0.05)"
ea.style.strokeWidth = 2;
ea.style.roughness = 0;

if(elements.length===1 && elements[0].type !== "text") {
  ea.copyViewElementsToEAforEditing(elements);
	ea.getElements()[0].link = link;
} else {
  const b = ea.getBoundingBox(elements);
  const id = ea.addEllipse(b.topX+b.width-5, b.topY, 5, 5);
  ea.getElement(id).link = link;
  ea.copyViewElementsToEAforEditing(elements);
  ea.addToGroup(elements.map((e)=>e.id).concat([id]));
}
await ea.addElementsToView(false,true,true);
ea.selectElementsInView(ea.getElements());

if(openInCurrentPane) {
	app.workspace.openLinkText(file.path,ea.targetView.file.path,false);
  return;
}
ea.openFileInNewOrAdjacentLeaf(file);
