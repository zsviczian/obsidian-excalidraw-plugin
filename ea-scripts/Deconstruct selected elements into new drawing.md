/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-deconstruct.jpg)

Select some elements in the scene. The script will take these elements and move them into a new Excalidraw file, and open that file. The selected elements will also be replaced in your original drawing with the embedded Excalidraw file (the one that was just created). You will be prompted for the file name of the new deconstructed image. The script is useful if you want to break a larger drawing into smaller reusable parts that you want to reference in multiple drawings.

<iframe width="560" height="315" src="https://www.youtube.com/embed/HRtaaD34Zzg" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

<iframe width="560" height="315" src="https://www.youtube.com/embed/mvMQcz401yo" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

```javascript
*/
if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("2.0.25")) {
  new Notice("This script requires a newer version of Excalidraw. Please install the latest version.");
  return;
}

// -------------------------------
// Utility variables and functions
// -------------------------------
const excalidrawTemplates = ea.getListOfTemplateFiles();
if(typeof window.ExcalidrawDeconstructElements === "undefined") {
	window.ExcalidrawDeconstructElements = {
	  openDeconstructedImage: true,
	  templatePath: excalidrawTemplates?.[0].path??""
	};
}

const splitFolderAndFilename = (filepath) => {
  const lastIndex = filepath.lastIndexOf("/");
  return {
    foldername: ea.obsidian.normalizePath(filepath.substring(0, lastIndex)),
    filename: (lastIndex == -1 ? filepath : filepath.substring(lastIndex + 1)) + ".md"
  };
}

let settings = ea.getScriptSettings();
//set default values on first run
if(!settings["Templates"]) {
	settings = {
	  "Templates" : {
			value: "",
      description: "Comma-separated list of template filepaths"
		}
	};
	await ea.setScriptSettings(settings);
}

if(!settings["Default file name"]) {
  settings["Default file name"] = {
    value: "deconstructed",
    description: "The default filename to use when deconstructing elements."
  };
  await ea.setScriptSettings(settings);
}

const DEFAULT_FILENAME = settings["Default file name"].value;

const templates = settings["Templates"]
  .value
  .split(",")
  .map(p=>app.metadataCache.getFirstLinkpathDest(p.trim(),""))
  .concat(excalidrawTemplates)
  .filter(f=>Boolean(f))
  .sort((a,b) => a.basename.localeCompare(b.basename));


// ------------------------------------
// Prepare elements to be deconstructed
// ------------------------------------
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


// ------------
// Input prompt
// ------------
let shouldAnchor = false;
const actionButtons = [
  {
    caption: "Insert @100%",
    tooltip: "Anchor to 100% size",
    action: () => {
      shouldAnchor = true;
    }
  },
  {
    caption: "Insert",
    tooltip: "Insert without anchoring",
    action: () => {
      shouldAnchor = false;
    }
  }];

const customControls =  (container) => {
  new ea.obsidian.Setting(container)
    .setName(`Select template`)
    .addDropdown(dropdown => {
      templates.forEach(file => dropdown.addOption(file.path, file.basename));
      if(templates.length === 0) dropdown.addOption(null, "none");
      dropdown
        .setValue(window.ExcalidrawDeconstructElements.templatePath)
        .onChange(value => {
           window.ExcalidrawDeconstructElements.templatePath = value;
        })
    })

  new ea.obsidian.Setting(container)
    .setName(`Open deconstructed image`)
    .addToggle((toggle) => toggle
      .setValue(window.ExcalidrawDeconstructElements.openDeconstructedImage)
      .onChange(value => {
        window.ExcalidrawDeconstructElements.openDeconstructedImage = value;
      })
    )
}

const path = await utils.inputPrompt(
  "Filename for new file",
  "Filename",
  await ea.getAttachmentFilepath(DEFAULT_FILENAME),
  actionButtons,
  2,
  false,
  customControls
);

if(!path) return;

// ----------------------
// Execute deconstruction
// ----------------------
const {foldername, filename} = splitFolderAndFilename(path);

const newPath = await ea.create ({
  filename,
  foldername,
  templatePath: window.ExcalidrawDeconstructElements.templatePath,
  onNewPane: true,
  silent: !window.ExcalidrawDeconstructElements.openDeconstructedImage
});

let f = app.vault.getAbstractFileByPath(newPath);
let counter = 0;
while((!f || !ea.isExcalidrawFile(f)) && counter++<100) {
  await sleep(50);
  f = app.vault.getAbstractFileByPath(newPath);
}

if(!f || !ea.isExcalidrawFile(f)) {
  new Notice("Something went wrong");
  return;
}

let padding = parseFloat(app.metadataCache.getCache(f.path)?.frontmatter["excalidraw-export-padding"]);
if(isNaN(padding)) {
  padding = ea.plugin.settings.exportPaddingSVG;
}

ea.getElements().forEach(el=>el.isDeleted = true);
await ea.addImage(bb.topX-padding,bb.topY-padding,f,false, shouldAnchor);
await ea.addElementsToView(false, true, true);
ea.getExcalidrawAPI().history.clear();
if(!window.ExcalidrawDeconstructElements.openDeconstructedImage) {
  new Notice("Deconstruction ready");
}
