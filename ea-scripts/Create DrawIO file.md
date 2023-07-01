/*
Creates a new draw.io diagram file and opens the file in the [Diagram plugin](https://github.com/zapthedingbat/drawio-obsidian) in a new tab.
```js*/

if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.9.7")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

const drawIO = app.plugins.plugins["drawio-obsidian"];
if(!drawIO || !drawIO?._loaded) {
  new Notice("Can't find the draw.io diagram plugin");
}

filename = await utils.inputPrompt("Diagram name?");
if(!filename) return;
filename = filename.toLowerCase().endsWith(".svg") ? filename : filename + ".svg";
const filepath = await ea.getAttachmentFilepath(filename);
if(!filepath) return;
const leaf = app.workspace.getLeaf('tab')
if(!leaf) return;

const file = await this.app.vault.create(filepath, `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><!--${ea.generateElementId()}--><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="300px" height="300px" viewBox="-0.5 -0.5 1 1" content="&lt;mxGraphModel&gt;&lt;root&gt;&lt;mxCell id=&quot;0&quot;/&gt;&lt;mxCell id=&quot;1&quot; parent=&quot;0&quot;/&gt;&lt;/root&gt;&lt;/mxGraphModel&gt;"></svg>`);

await ea.addImage(0,0,file);
await ea.addElementsToView(true,true);

leaf.setViewState({
  type: "diagram-edit",
  state: {
    file: filepath
  }
});
