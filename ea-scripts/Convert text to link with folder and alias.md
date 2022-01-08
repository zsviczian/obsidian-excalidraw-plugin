/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-download-raw.jpg)

Download this file and save to your Obsidian Vault including the first line, or open it in "Raw" and copy the entire contents to Obsidian.

Converts text elements to links pointing to a file in a selected folder and with the alias set as the original text. The script will prompt the user to select an existing folder from the vault.
`original text` => `[[selected folder/original text|original text]]`

See documentation for more details:
https://zsviczian.github.io/obsidian-excalidraw-plugin/ExcalidrawScriptsEngine.html

```javascript
*/
folders = new Set();
app.vault.getFiles().forEach((f)=>
  folders.add(f.path.substring(0,f.path.lastIndexOf("/")))
);

f = Array.from(folders);
folder = await utils.suggester(f,f);
folder = folder??""; //if exiting suggester with ESC
folder = folder === "" ? folder : folder + "/";

elements = ea.getViewSelectedElements().filter((el)=>el.type==="text");

elements.forEach((el)=>{
  el.rawText = "[["+folder+el.rawText+"|"+el.rawText+"]]";
  el.text = "[["+folder+el.text+"|"+el.text+"]]";
  el.originalText = "[["+folder+el.originalText+"|"+el.originalText+"]]";
})
ea.copyViewElementsToEAforEditing(elements);
ea.addElementsToView();