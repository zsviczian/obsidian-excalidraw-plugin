/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-download-raw.jpg)

Download this file and save to your Obsidian Vault including the first line, or open it in "Raw" and copy the entire contents to Obsidian.

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-text-to-metadata.jpg)

The script will delete the selected text elements from the canvas and will copy the text from these text elements into the Excalidraw markdown file as metadata. This means, that the text will no longer be visible in the drawing, however you will be able to search for the text in Obsidian and find the drawing containing this image.

See ScriptEngine documentation for more details:
https://zsviczian.github.io/obsidian-excalidraw-plugin/ExcalidrawScriptsEngine.html

```javascript
*/
//get text elements

const textElements = ea.getViewSelectedElements().filter((el)=>el.type==="text");

if(textElements.length===0) {
  notice("No text elements were selected")
  return;
}

metadata = "# Metadata\n" + textElements
           .map((el)=>el.rawText.replaceAll(/%|\^/g,"_")) //cleaning these characters for safety, might not be needed
           .join("/n") + "\n";

ea.deleteViewElements(textElements);
await ea.targetView.save();
data = await app.vault.read(ea.targetView.file);
splitAfterFrontmatter = data.split(/(^---[\w\W]*?---\n)/);
if(splitAfterFrontmatter.length !== 3) {
  notice("Error locating frontmatter in markdown file");
  console.log({file:ea.targetView.file});
  return;
}
newData = splitAfterFrontmatter[1]+metadata+splitAfterFrontmatter[2]
await app.vault.modify(ea.targetView.file,newData);

//utility function
function notice(message) {
  new Notice(message);
  console.log(message);
}
