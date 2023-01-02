/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-deconstruct.jpg)

Select some elements in the scene. The script will take these elements and move them into a new Excalidraw file, and open that file. The selected elements will also be replaced in your original drawing with the embedded Excalidraw file (the one that was just created). You will be prompted for the file name of the new deconstructed image. The script is useful if you want to break a larger drawing into smaller reusable parts that you want to reference in multiple drawings.

```javascript
*/
if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.7.29")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

const els = ea.getViewSelectedElements();
if (els.length === 0) {
  new Notice("You must select elements first")
  return;
}

const bb = ea.getBoundingBox(els);
ea.copyViewElementsToEAforEditing(els);

ea.getElements().filter(el=>el.type==="image").forEach(el=>{
    const img = ea.targetView.excalidrawData.getFile(el.fileId);
    const path = (img?.linkParts?.original)??(img?.file?.path);
    if(img && path) {
	    ea.imagesDict[el.fileId] = {
	      mimeType: img.mimeType,
	      id: el.fileId,
	      dataURL: img.img,
	      created: img.mtime,
	      file: path,
	      hasSVGwithBitmap: img.isSVGwithBitmap,
	      latex: null,
	    };
	    return;
	}
	const equation = ea.targetView.excalidrawData.getEquation(el.fileId);
	eqImg = ea.targetView.getScene()?.files[el.fileId]
	if(equation && eqImg) {
          ea.imagesDict[el.fileId] = {
	      mimeType: eqImg.mimeType,
	      id: el.fileId,
	      dataURL: eqImg.dataURL,
	      created: eqImg.created,
	      file: null,
	      hasSVGwithBitmap: null,
	      latex: equation.latex,
	    };
	    return;
	}
});

let folder = ea.targetView.file.path;
folder = folder.lastIndexOf("/")===-1?"":folder.substring(0,folder.lastIndexOf("/"))+"/";
const fname = await utils.inputPrompt("Filename for new file","Filename","");
const template = app.metadataCache.getFirstLinkpathDest(ea.plugin.settings.templateFilePath,"");

const newPath = await ea.create ({
  filename: fname + ".md",
  foldername: folder,
  templatePath: template?.path,
  onNewPane: true
});

setTimeout(async ()=>{
  const file = app.metadataCache.getFirstLinkpathDest(newPath,"")
  ea.deleteViewElements(els);
  ea.clear();
  await ea.addImage(bb.topX,bb.topY,file,false);
  await ea.addElementsToView(false, true, true);
  ea.getExcalidrawAPI().history.clear(); //to avoid undo/redo messing up the decomposition
},1000);
