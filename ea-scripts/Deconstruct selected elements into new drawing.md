/*
![](https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/images/scripts-deconstruct.jpg)

Select some elements in the scene. The script will take these elements and move them into a new Excalidraw file, and open that file. The selected elements will also be replaced in your original drawing with the embedded Excalidraw file (the one that was just created). You will be prompted for the file name of the new deconstructed image. The script is useful if you want to break a larger drawing into smaller reusable parts that you want to reference in multiple drawings.

<a href="https://www.youtube.com/watch?v=HRtaaD34Zzg" target="_blank"><img src ="https://i.ytimg.com/vi/HRtaaD34Zzg/maxresdefault.jpg" style="width:560px;"></a>

<a href="https://www.youtube.com/watch?v=mvMQcz401yo" target="_blank"><img src ="https://i.ytimg.com/vi/mvMQcz401yo/maxresdefault.jpg" style="width:560px;"></a>

```js
*/

if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("2.7.3")) {
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
    reuseTab: true,
    templatePath: excalidrawTemplates?.[0]?.path??""
  };
} else if (typeof window.ExcalidrawDeconstructElements.reuseTab === "undefined") {
  window.ExcalidrawDeconstructElements.reuseTab = true;
}

// Helper class for Folder Autocomplete
class FolderSuggest extends ea.obsidian.AbstractInputSuggest {
  constructor(app, inputEl) {
    super(app, inputEl);
    this.inputEl = inputEl;
  }

  getSuggestions(query) {
    const folders = app.vault.getAllLoadedFiles().filter(f => f instanceof ea.obsidian.TFolder);
    const lowerQuery = query.toLowerCase();
    
    // Filter folders that match the query
    const matches = folders.filter(f => f.path.toLowerCase().includes(lowerQuery));
    
    // Custom Sort
    matches.sort((a, b) => {
        const aPath = a.path;
        const bPath = b.path;
        const aLower = aPath.toLowerCase();
        const bLower = bPath.toLowerCase();
        
        // Priority 1: Starts with query (e.g. "Projects" comes before "Hobbies/Projects")
        const aStarts = aLower.startsWith(lowerQuery);
        const bStarts = bLower.startsWith(lowerQuery);
        
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        // Priority 2: Alphabetical
        return aPath.localeCompare(bPath);
    });
    
    return matches.map(f => f.path);
  }

  renderSuggestion(value, el) {
    el.setText(value);
  }

  selectSuggestion(value, evt) {
      this.inputEl.value = value;
      this.inputEl.dispatchEvent(new Event('input'));
      this.close();
  }
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

// Handle Image elements logic from original script
ea.getElements().filter(el=>el.type==="image").forEach(el=>{
  const img = ea.targetView.excalidrawData.getFile(el.fileId);
  const path = (img?.linkParts?.original)??(img?.file?.path);
  const hyperlink = img?.hyperlink;
  if(img && (path || hyperlink)) {
    const colorMap = ea.getColorMapForImageElement(el);
    ea.imagesDict[el.fileId] = {
      mimeType: img.mimeType,
      id: el.fileId,
      dataURL: img.img,
      created: img.mtime,
      file: path,
      hyperlink,
      hasSVGwithBitmap: img.isSVGwithBitmap,
      latex: null,
      colorMap,
    };
    return;
  }
  const equation = ea.targetView.excalidrawData.getEquation(el.fileId);
  const eqImg = ea.targetView.getScene()?.files[el.fileId]
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


// ----------------------
// Execution Logic
// ----------------------
const executeDeconstruction = async (folderPath, fileName, shouldAnchor) => {
  // Ensure filename has extension
  if (!fileName.endsWith(".md")) fileName += ".md";
  
  // Construct full path
  // normalizePath handles cases where folderPath might be empty or root
  const fullPath = ea.obsidian.normalizePath(`${folderPath}/${fileName}`);
  
  // Separate back into folder and filename for ea.create
  const pathParts = fullPath.split("/");
  const finalFileName = pathParts.pop();
  const finalFolderName = pathParts.join("/");

  // We use silent: true to prevent ea.create from opening the file automatically.
  // We handle opening manually based on user preference.
  const newPath = await ea.create ({
    filename: finalFileName,
    foldername: finalFolderName,
    templatePath: window.ExcalidrawDeconstructElements.templatePath,
    onNewPane: true, 
    silent: true
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

  // Remove elements from current view and replace with image of new file
  ea.getElements().forEach(el=>el.isDeleted = true);
  await ea.addImage(bb.topX-padding, bb.topY-padding, f, false, shouldAnchor);
  await ea.addElementsToView(false, true, true);
  ea.getExcalidrawAPI().history.clear();
  
  if(window.ExcalidrawDeconstructElements.openDeconstructedImage) {
    const reuse = window.ExcalidrawDeconstructElements.reuseTab;
    if (reuse) {
      ea.openFileInNewOrAdjacentLeaf(f);
    } else {
      // Force new tab
      await app.workspace.getLeaf('tab').openFile(f);
    }
  } else {
    new Notice("Deconstruction ready");
  }
};


// ----------------------
// Floating Modal UI
// ----------------------

const modal = new ea.FloatingModal(ea.plugin.app);
modal.titleEl.setText("Deconstruct Elements");

modal.onOpen = () => {
  const content = modal.contentEl;
  content.empty();
  
  // -- Folder Path Input --
  const folderDiv = content.createDiv({ cls: "setting-item" });
  folderDiv.createDiv({ cls: "setting-item-info" }).createEl("label", { text: "Folder path" });
  const folderControl = folderDiv.createDiv({ cls: "setting-item-control" });
  const folderInput = new ea.obsidian.TextComponent(folderControl);
  
  // Set default folder to current file's parent
  const currentFolder = ea.targetView.file.parent.path;
  folderInput.setValue(currentFolder);
  folderInput.inputEl.style.width = "100%";
  
  // Attach Autocomplete
  new FolderSuggest(ea.plugin.app, folderInput.inputEl);

  // -- Filename Input --
  const fileDiv = content.createDiv({ cls: "setting-item" });
  fileDiv.createDiv({ cls: "setting-item-info" }).createEl("label", { text: "File name" });
  const fileControl = fileDiv.createDiv({ cls: "setting-item-control" });
  const fileInput = new ea.obsidian.TextComponent(fileControl);
  fileInput.setValue(DEFAULT_FILENAME);
  fileInput.inputEl.style.width = "100%";
  
  // Set focus to file input
  setTimeout(() => fileInput.inputEl.focus(), 50);

  // -- Template Dropdown --
  new ea.obsidian.Setting(content)
    .setName(`Select template`)
    .addDropdown(dropdown => {
      templates.forEach(file => dropdown.addOption(file.path, file.basename));
      if(templates.length === 0) dropdown.addOption(null, "none");
      dropdown
        .setValue(window.ExcalidrawDeconstructElements.templatePath)
        .onChange(value => {
           window.ExcalidrawDeconstructElements.templatePath = value;
        })
    });

  // -- Open Toggle --
  new ea.obsidian.Setting(content)
    .setName(`Open deconstructed image`)
    .addToggle((toggle) => toggle
      .setValue(window.ExcalidrawDeconstructElements.openDeconstructedImage)
      .onChange(value => {
        window.ExcalidrawDeconstructElements.openDeconstructedImage = value;
        // Update visibility of the sub-toggle
        reuseSetting.settingEl.style.display = value ? "" : "none";
      })
    );

  // -- Reuse Tab Toggle --
  const reuseSetting = new ea.obsidian.Setting(content)
    .setName(`Reuse existing tab`)
    .setDesc("If available, open in an adjacent tab. Otherwise open in a new tab.")
    .setClass("reuse-tab-setting")
    .addToggle((toggle) => toggle
      .setValue(window.ExcalidrawDeconstructElements.reuseTab)
      .onChange(value => {
        window.ExcalidrawDeconstructElements.reuseTab = value;
      })
    );
  
  // Initialize visibility and style
  reuseSetting.settingEl.style.display = window.ExcalidrawDeconstructElements.openDeconstructedImage ? "" : "none";
  reuseSetting.settingEl.style.borderTop = "none";
  
  // -- Buttons --
  const buttonContainer = content.createDiv({ cls: "excalidraw-dialog-buttons", style: "margin-top: 20px; display: flex; gap: 12px; justify-content: flex-end;" });
  
  const btnInsert = new ea.obsidian.ButtonComponent(buttonContainer)
    .setButtonText("Insert")
    .setTooltip("Insert without anchoring")
    .onClick(async () => {
      const folder = folderInput.getValue();
      const filename = fileInput.getValue();
      if (!filename) {
        new Notice("Filename is required");
        return;
      }
      modal.close();
      await executeDeconstruction(folder, filename, false);
    });

  const btnInsertAnchor = new ea.obsidian.ButtonComponent(buttonContainer)
    .setButtonText("Insert @100%")
    .setTooltip("Anchor to 100% size")
    .setCta()
    .onClick(async () => {
      const folder = folderInput.getValue();
      const filename = fileInput.getValue();
      if (!filename) {
        new Notice("Filename is required");
        return;
      }
      modal.close();
      await executeDeconstruction(folder, filename, true);
    });
};

modal.open();