/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-add-link-to-new-page-and-pen.jpg)

Prompts for filename. Offers option to create and open a new Markdown or Excalidraw document. Adds link pointing to the new file, to the selected objects in the drawing. You can control in settings to open the file in the current active pane or an adjacent pane.

```javascript
*/

if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.6.1")) {
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

const activeFile = ea.targetView.file;
const prefix = activeFile.basename;
const timestamp = moment(Date.now()).format(ea.plugin.settings.drawingFilenameDateTime);

let fileType = "";
const filename = await utils.inputPrompt (
  "Filename for new document",
  "",
  `${prefix} - ${timestamp}`,
  [
    {
      caption: "Markdown",
      action: ()=>{fileType="md";return;}
		},
    {
      caption: "Excalidraw",
      action: ()=>{fileType="ex";return;}
    }
  ]
);

if(!filename || filename === "") return;
const filepath = activeFile.path.replace(activeFile.name,`${filename}.md`);

const file = await app.fileManager.createNewMarkdownFileFromLinktext(filepath);
if(file && fileType==="ex") {
  const blank = await app.plugins.plugins["obsidian-excalidraw-plugin"].getBlankDrawing();
  await app.vault.modify(file,blank);
  await new Promise(r => setTimeout(r, 100)); //wait for metadata cache to update, so file opens as excalidraw
}

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
