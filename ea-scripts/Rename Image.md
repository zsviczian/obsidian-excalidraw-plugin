/*

![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/rename-image.png)

Select an image on the canvas and run the script. You will be prompted to provide a new filename / filepath. This cuts down the time to name images you paste from the web or drag and drop from your file system.

```javascript
*/
await ea.addElementsToView(); //to ensure all images are saved into the file

const img = ea.getViewSelectedElements().filter(el=>el.type === "image");
if(img.length === 0) {
  new Notice("No image is selected");
  return;
}

for(i of img) {
  const currentPath = ea.plugin.filesMaster.get(i.fileId).path;
  const file = app.vault.getAbstractFileByPath(currentPath);
  if(!file) {
	  new Notice("Can't find file: " + currentPath);
	  continue;
  }
  const pathNoExtension = file.path.substring(0,file.path.length-file.extension.length-1);
  const newPath = await utils.inputPrompt("Please provide the filename","file path",pathNoExtension);
  if(newPath && newPath !== pathNoExtension) {
	  await app.fileManager.renameFile(file,`${newPath}.${file.extension}`);
  }
}
