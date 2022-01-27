/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-add-link-and-open.jpg)

Prompt for a file in the vault. Add a link above or below (based on settings) the selected element, to the selected file. If no file is selected then the script creates a new file following the default filename defined for excalidraw embeds. Creates empty markdown file by default, this can be changed to creating a drawing by default via settings.

```javascript
*/

if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.5.21")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

const BLANK_DRAWING = ["---","","excalidraw-plugin: parsed","","---","==⚠ Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠==","","","%%","# Drawing","\x60\x60\x60json",'{"type":"excalidraw","version":2,"source":"https://excalidraw.com","elements":[],"appState":{"gridSize":null,"viewBackgroundColor":"#ffffff"}}',"\x60\x60\x60","%%"].join("\n");

settings = ea.getScriptSettings();
//set default values on first run
if(!settings["Link position"]) {
  settings = {
    "Link position" : {
      value: "below",
      valueset: ["above","below"],
      description: "Add link below or above the selected object?"
    },
	"Link font size" : {
      value: 12
    }
  };
  ea.setScriptSettings(settings);
}

if(!settings["New document should be an Excalidraw drawing"]) {
  settings = {
    "New document should be an Excalidraw drawing": {
      value: false,
      description: "When adding a new document, should the new document be a blank markdown document (toggle == off) or a blank Excalidraw drawing (toggle=on)?"
	},
    ...settings
  };
  ea.setScriptSettings(settings);
}


const below = settings["Link position"].value === "below";
const newDocExcalidraw = settings["New document should be an Excalidraw drawing"].value;
const fontSize = Math.floor(settings["Link font size"].value);

elements = ea.getViewSelectedElements();
if(elements.length === 0) {
  new Notice("No selected elements");
  return;
}

const files = app.vault.getFiles()
const filePaths = files.map((f)=>f.path);
file = await utils.suggester(filePaths,files,"Select file or press ESC to create a new document");

alias = null;
if(file) {
  alias = file.basename;
} else {
  const prefix = ea.targetView.file.path.substring(0,ea.targetView.file.path.length-3);
  const timestamp = moment(Date.now()).format(ea.plugin.settings.drawingFilenameDateTime);
  file = await app.vault.create(`${prefix} ${timestamp}.md`,newDocExcalidraw?BLANK_DRAWING:"");
  if(newDocExcalidraw) await new Promise(r => setTimeout(r, 100)); //wait for metadata cache to update, so file opens as excalidraw
}

const filepath = app.metadataCache.fileToLinktext(file,ea.targetView.file.path,true);

ea.style.textAlign = "center";
ea.style.fontSize = fontSize;
const textElementsIfAny = elements.filter(el=>el.type==="text");
if(textElementsIfAny.length>0) ea.style.fontFamily = textElementsIfAny[0].fontFamily;
ea.style.strokeColor = elements[0].strokeColor;


const box = ea.getBoundingBox(elements);
const linkText = `[[${filepath}${alias?"|"+alias:""}]]`;
const size = ea.measureText(alias?ea.plugin.settings.linkPrefix+alias:linkText);
const id = ea.addText(
  box.topX+(box.width-size.width)/2,
  below ? box.topY + box.height + size.height : box.topY - size.height - 3,
  linkText
);
ea.copyViewElementsToEAforEditing(elements);
ea.addToGroup(elements.map((e)=>e.id).concat([id]));
ea.addElementsToView(false,true,true);
ea.openFileInNewOrAdjacentLeaf(file);
