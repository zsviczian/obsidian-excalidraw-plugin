/*
#exclude
```js*/
// -----------------------------
// -----------------------------
// Icon Library / Bases Search
// -----------------------------
// -----------------------------
const IMAGE_LIBRARY_FOLDER = ea.obsidian.normalizePath("Assets/nosync");
const IMAGE_LIBRARY_FILENAME = "Image Library.base"
const ICONTYPES = [
  {name: "Icon", pattern: "icon"},
  {name: "Stickfigure", pattern: "stickfigure"},
  {name: "Logo", pattern: "logo"}
];

const IMAGE_LIBRARY_PATH = ea.obsidian.normalizePath(IMAGE_LIBRARY_FOLDER + "/" + IMAGE_LIBRARY_FILENAME);
async function initializeImageLibrary() {
  await ea.checkAndCreateFolder(IMAGE_LIBRARY_FOLDER);
  const syncPlugin = app.internalPlugins.plugins["sync"]?.instance;
  if(syncPlugin && !syncPlugin.ignoreFolders.includes(IMAGE_LIBRARY_FOLDER)) {
    syncPlugin.setIgnoreFolders(syncPlugin.ignoreFolders.concat(IMAGE_LIBRARY_FOLDER));
  }
  const imgLibFile = app.vault.getFileByPath(IMAGE_LIBRARY_PATH);
  if(!imgLibFile) {
    //The bases file is very sensitive to spaces, indents, and formatting
    //take care when modifying this
    const baseTemplate = `formulas:\n` +
      `  Icon: image(file.path)\n` +
      `  keywords: file.name.split(" - ")[1]\n` +
      `  icon-path: link(if(file.ext == "md", "Assets/" + file.name.split(" - ")[0] + "s/" + file.name + ".svg", file.path))\n` +
      `views:\n` +
      `  - type: cards\n` +
      `    name: View\n` +
      `    filters:\n` +
      `      and:\n` +
      `        - /^(icon|stickfigure|logo) \\- /i.matches(file.name.lower())\n` +
      `        - '!file.path.startsWith("Assets/")'\n` +
      `        - /./i.matches(formula.keywords)\n` +
      `    order:\n` +
      `      - formula.keywords\n` +
      `    sort:\n` +
      `      - property: formula.keywords\n` +
      `        direction: ASC\n` +
      `    cardSize: 130\n` +
      `    imageFit: contain\n` +
      `    image: formula.icon-path\n` +
      `    imageAspectRatio: 0.8\n`;
    await app.vault.create(IMAGE_LIBRARY_PATH, baseTemplate);
  }
}

initializeImageLibrary();

async function revealIconLibrary() {
  const file = app.vault.getFileByPath(IMAGE_LIBRARY_PATH);
  if(!file) return;
  let leaf;
  app.workspace.iterateAllLeaves(l=>{
    if(leaf) return;
    if(l.view?.getViewType() === "bases" && l.view.getState().file === file.path) leaf = l;
  });
  if(leaf) {
    app.workspace.revealLeaf(leaf);
    return file;
  }
  
  leaf = app.workspace.getRightLeaf();
  await leaf.openFile(file);
  app.workspace.revealLeaf(leaf);
  return file;
}

if(ea.verifyMinimumPluginVersion("2.13.2")) {
  ea.plugin.addCommand({
    id: "base-filter-keywords",
    name: "Icon Library",
    icon: "images",
    callback: async () => {
      // Check if the active file is a .base file
      const file = await revealIconLibrary();
      if(!file) return false;
  
      let baseContent = await app.vault.read(file);
      // Check if the file has the specific patterns for filtering
      if (!baseContent.includes(".matches(formula.keywords)")) return;
      
      // Create a modal using Obsidian's Modal class
      const Modal = ea.FloatingModal;
      const modal = new Modal(app);
      const { contentEl } = modal;
      
      contentEl.createEl("style", {
        text: `
          input[type="checkbox"]:focus-visible {
            outline: 2px solid ${app.getAccentColor()} !important;
            outline-offset: 2px !important;
          }
        `
      });
      
      // Set title
      contentEl.createEl("h3", {
        text: "Icon Library"
      });
      
      // ---------------------
      // Create keyword filter
      // ---------------------
      const inputContainer = contentEl.createDiv();
      inputContainer.style.margin = "20px 0";
      const input = contentEl.createEl("input", {
        type: "text",
        placeholder: "Enter filter term (leave empty for wildcard, you may use regular expression)",
      });
      input.style.width = "100%";
      input.style.padding = "8px";
      // Extract current keyword filter
      const keywordFilterRegex = /(- +)\/(.*?)\/i?\.matches\(formula\.keywords\)/;
      const keywordMatch = baseContent.match(keywordFilterRegex);
      if (keywordMatch && keywordMatch[2] && keywordMatch[2] !== ".") {
        input.value = keywordMatch[2];
      }
      // Set focus on the input
      setTimeout(() => input.focus(), 50);
      
      // ------------------
      // Create toggle switches for file type filters
      // ------------------
      const toggleContainer = contentEl.createDiv();
      toggleContainer.style.margin = "20px 0";
      toggleContainer.style.display = "flex";
      toggleContainer.style.gap = "15px";
      toggleContainer.style.flexWrap = "wrap";
      // Get current filter pattern to determine initial toggle states
      const fileNameFilterRegex = /\/\^(.*?) \\- \/i?\.matches\(file\.name\.lower\(\)\)/;
      const match = baseContent.match(fileNameFilterRegex);
      let currentFilters = [];
      if (match && match[1]) {
        currentFilters = match[1].replace(/[\(\)]/g, '').split('|');
      }
  
      // Create toggle function
      const createToggle = (label, value) => {
        const toggleWrapper = toggleContainer.createDiv();
        toggleWrapper.style.display = "flex";
        toggleWrapper.style.alignItems = "center";
        
        const checkbox = toggleWrapper.createEl("input", {
          type: "checkbox",
          attr: { id: `toggle-${value}` }
        });
        checkbox.checked = currentFilters.includes(value);
        
        const labelEl = toggleWrapper.createEl("label", {
          text: label,
          attr: { for: `toggle-${value}` }
        });
        labelEl.style.marginLeft = "5px";
        
        return checkbox;
      };
      
      // Create toggles dynamically based on ICONTYPES array
      const typeToggles = {};
      ICONTYPES.forEach(iconType => {
        typeToggles[iconType.pattern] = createToggle(iconType.name, iconType.pattern);
      });
  
      // Function to apply the filter
      const applyFilter = async () => {
        // Get selected file types
        const selectedTypes = [];
        ICONTYPES.forEach(iconType => {
          if (typeToggles[iconType.pattern].checked) selectedTypes.push(iconType.pattern);
        });
        // Build file type filter pattern
        const fileTypePattern = selectedTypes.length > 0 
          ? `/^(${selectedTypes.join('|')}) \\- /i`
          : `/^() \\- /i`; // Empty pattern if none selected
        
        // Get keyword filter
        const keywordTerm = input.value.trim() || ".";
        
        // Update both filter patterns in the base file
        let updatedContent = baseContent;
        
        // Update file name filter
        updatedContent = updatedContent.replace(
          /\/\^.*? \\\- \/i?\.matches\(file\.name\.lower\(\)\)/,
          `${fileTypePattern}.matches(file.name.lower())`
        );
        
        // Update keyword filter
        updatedContent = updatedContent.replace(
          /(- +)\/.*\/i?\.matches\(formula\.keywords\)/g,
          `$1/${keywordTerm}/i.matches(formula.keywords)`
        );
        
        // Save the updated file
        if (updatedContent !== baseContent) {
          await app.vault.modify(file, updatedContent);
          baseContent = updatedContent; // Update base content to prevent duplicate updates
        }
      };
      
      // -------------------
      // Add event listeners for input changes to apply filter immediately
      // -------------------
      contentEl.querySelectorAll("input").forEach(el => {
        el.addEventListener("input", applyFilter);
      });
      
      // Handle Enter key in the input field
      contentEl.querySelectorAll("input").forEach(el => {
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            modal.close();
          }
        });
      });
      modal.open();
    },
  });
} else {
  new Notice("Icon Library not initialized. Please update to the latest Excalidraw Plugin version", 0);
}

// -----------------
// -----------------
// Throttle Sync
// -----------------
// -----------------
const sync = app.internalPlugins.plugins["sync"]?.instance

function throttleSync() {
  function setPause(newState) {
    if (newState && sync.getStatus() !== "synced") {
      setTimeout(() => setPause(true), 10000) //20 seconds
      return;
    }
    sync.setPause(newState);
    //console.log(`${moment().format("HH:mm:ss")} - ${sync.getStatus()}`);
    if (newState) {
      //unpause after 2 minutes
      setTimeout(() => setPause(false), 120000) //2 minutes
    } else {
      //pause after 20 seconds of sync
      setTimeout(() => setPause(true), 20000) //20 seconds
    }
  }

  if (sync) {
    if (ea.DEVICE.isDesktop) {
      setPause(false);
      console.log("Sync throttle started");
    } else {
      sync.setPause(false);
    }
  }
}
if (sync) {
  sync.setPause(false);
}
//throttleSync();

// ----------------------
// ----------------------
// Move settings button
// ----------------------
// ----------------------
try {
  if (ea.DEVICE.isDesktop) {
    const actions = document.querySelector(".workspace-drawer-vault-actions");
    actions.style.display = "none";
    const setting = actions.children[1];
    const header = document.querySelector(".workspace-tab-header-container");
    const toggle = document.querySelector(".sidebar-toggle-button.mod-left");
    header.appendChild(setting);
    if (header === toggle.parentElement) header.insertBefore(setting, toggle);
  }
} catch (e) {
  console.log("Excalidraw Startup Move Settings Button", e);
}

// --------------
// --------------
// Debug logger
// --------------
// --------------
window.logger = (label, values) => {
  if (!window.log) window.log = [];
  window.log.push({
    label,
    timestamp: performance.now(),
    stack: new Error().stack,
    values,
  });
  return false;
}

window.printLog = () => {
  console.log(window.log.map(l => {
    return `${moment(l.timestamp).format("HH:mm:ss.SSS")} ${
      l.label}\n${l.stack.split("\n").slice(3).map(x=>x.trim()).join("\n")
      }\n------------------------`;
  }).join("\n"))
}

if (window.electron) {
  const alignElectronSpellcheckWithObsidianSettings = () => {
    const session = window.electron.remote.getCurrentWebContents().session;
    session.setSpellCheckerEnabled(app.vault.config.spellcheck);
    if (app.vault.config.spellcheck) {
      session.setSpellCheckerLanguages(navigator.languages);
    }
  };

  const body = document.body;
  const observer = new MutationObserver((mutationsList, observer) => {
    for (let mutation of mutationsList) {
      if (mutation.type === 'childList') {
        mutation.removedNodes.forEach(node => {
          if (node.classList && node.classList.contains('modal-container')) {
            alignElectronSpellcheckWithObsidianSettings();
          }
        });
      }
    }
  });
  const config = {
    childList: true
  };
  observer.observe(body, config);
  alignElectronSpellcheckWithObsidianSettings();
}

// ------------------------
// ------------------------
// Excalidraw Event Hooks
// ------------------------
// ------------------------
/**
 * If set, this callback is triggered when the user closes an Excalidraw view.
 *   onViewUnloadHook: (view: ExcalidrawView) => void = null;
 */
//ea.onViewUnloadHook = (view) => {};

/**
 * If set, this callback is triggered, when the user changes the view mode.
 * You can use this callback in case you want to do something additional when the user switches to view mode and back.
 *   onViewModeChangeHook: (isViewModeEnabled:boolean, view: ExcalidrawView, ea: ExcalidrawAutomate) => void = null;
 */
//ea.onViewModeChangeHook = (isViewModeEnabled, view, ea) => {};

/**
 * If set, this callback is triggered, when the user hovers a link in the scene.
 * You can use this callback in case you want to do something additional when the onLinkHover event occurs.
 * This callback must return a boolean value.
 * In case you want to prevent the excalidraw onLinkHover action you must return false, it will stop the native excalidraw onLinkHover management flow.
 *   onLinkHoverHook: (
 *     element: NonDeletedExcalidrawElement,
 *     linkText: string,
 *     view: ExcalidrawView,
 *     ea: ExcalidrawAutomate
 *   ) => boolean = null;
 */
//ea.onLinkHoverHook = (element, linkText, view, ea) => {};

/**
 * If set, this callback is triggered, when the user clicks a link in the scene.
 * You can use this callback in case you want to do something additional when the onLinkClick event occurs.
 * This callback must return a boolean value.
 * In case you want to prevent the excalidraw onLinkClick action you must return false, it will stop the native excalidraw onLinkClick management flow.
 *   onLinkClickHook:(
 *     element: ExcalidrawElement,
 *     linkText: string,
 *     event: MouseEvent,
 *     view: ExcalidrawView,
 *     ea: ExcalidrawAutomate
 *   ) => boolean = null;
 */
//ea.onLinkClickHook = (element,linkText,event, view, ea) => {};

/**
 * If set, this callback is triggered, when Excalidraw receives an onDrop event. 
 * You can use this callback in case you want to do something additional when the onDrop event occurs.
 * This callback must return a boolean value.
 * In case you want to prevent the excalidraw onDrop action you must return false, it will stop the native excalidraw onDrop management flow.
 *   onDropHook: (data: {
 *     ea: ExcalidrawAutomate;
 *     event: React.DragEvent<HTMLDivElement>;
 *     draggable: any; //Obsidian draggable object
 *     type: "file" | "text" | "unknown";
 *     payload: {
 *       files: TFile[]; //TFile[] array of dropped files
 *       text: string; //string
 *     };
 *     excalidrawFile: TFile; //the file receiving the drop event
 *     view: ExcalidrawView; //the excalidraw view receiving the drop
 *     pointerPosition: { x: number; y: number }; //the pointer position on canvas at the time of drop
 *   }) => boolean = null;
 */
ea.onDropHook = (data) => {
  const {view,draggable} = data;
  if(!draggable) return;

  const {file, type} = draggable;
  if(!file || type !== "link") return;

  const {extension} = file;
  if(!(
    data.ea.isExcalidrawFile(file) ||
    ["jpeg", "jpg", "png", "gif", "svg", "webp", "bmp", "ico", "jtif", "tif", "jfif", "avif"].contains(extension)
  )) return;

  const ea = data.ea.getAPI(view);
  const idBefore = new Set(ea.getViewElements().map(el=>el.id));

  setTimeout(()=>{
    const newElements = ea.getViewElements().filter(el=>!idBefore.has(el.id));
    if(newElements.length !== 1 || newElements[0].type !== "image") return;

    const f = ea.getViewFileForImageElement(newElements[0]);
    if(f !== file) return;

    ea.copyViewElementsToEAforEditing(newElements);
    ea.getElements().forEach(el=>{
      const l = Math.max(el.width, el.height);
      el.width = Math.round(el.width * 180/l);
      el.height = Math.round(el.height * 180/l);
    });
    ea.addElementsToView();
  },100);
}

/**
 * If set, this callback is triggered, when Excalidraw receives an onPaste event.
 * You can use this callback in case you want to do something additional when the
 * onPaste event occurs.
 * This callback must return a boolean value.
 * In case you want to prevent the excalidraw onPaste action you must return false,
 * it will stop the native excalidraw onPaste management flow.
 *   onPasteHook: (data: {
 *     ea: ExcalidrawAutomate;
 *     payload: ClipboardData;
 *     event: ClipboardEvent;
 *     excalidrawFile: TFile; //the file receiving the paste event
 *     view: ExcalidrawView; //the excalidraw view receiving the paste
 *     pointerPosition: { x: number; y: number }; //the pointer position on canvas
 *   }) => boolean = null;
 */
ea.onPasteHook = (data) => {
  const {ea,payload} = data;
  if (payload?.elements) {
    payload.elements.filter(el => el.locked).forEach(el => {
      el.locked = false;
    });
    /*    data.payload.elements
          .filter(el=>el.type==="text" && !el.hasOwnProperty("rawText"))
          .forEach(el=>el.rawText = el.originalText);*/
  }
  /*
  const getFileFromObsidianURL = (data) => {
    if(!data) return null;
    if(!data.startsWith("obsidian://")) return null;
  
    try {
      const url = new URL(data);
      const fileParam = url.searchParams.get("file");
      if(!fileParam) return null;
    
      return decodeURIComponent(fileParam);
    } catch {
      return null;
    }
  }
  
  if(payload.text) {
    link = getFileFromObsidianURL(payload.text);
     await ea.addImage(0,0,link);
    await ea.addElementsToView(true,true,true);
    return false;
  }
  */
};

/**
 * if set, this callback is triggered, when an Excalidraw file is opened
 * You can use this callback in case you want to do something additional when the file is opened.
 * This will run before the file level script defined in the `excalidraw-onload-script` frontmatter.
 *   onFileOpenHook: (data: {
 *     ea: ExcalidrawAutomate;
 *     excalidrawFile: TFile; //the file being loaded
 *     view: ExcalidrawView;
 *   }) => Promise<void>;
 */
//ea.onFileOpenHook = (data) => {};

/**
 * if set, this callback is triggered, when an Excalidraw file is created
 * see also: https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1124
 *   onFileCreateHook: (data: {
 *     ea: ExcalidrawAutomate;
 *     excalidrawFile: TFile; //the file being created
 *     view: ExcalidrawView;
 *   }) => Promise<void>;
 */
/*ea.onFileCreateHook = (data) => {
  app.fileManager.promptForFileRename(data.excalidrawFile);
};*/

/**
 * If set, this callback is triggered when a image is being saved in Excalidraw.
 * You can use this callback to customize the naming and path of pasted images to avoid
 * default names like "Pasted image 123147170.png" being saved in the attachments folder,
 * and instead use more meaningful names based on the Excalidraw file or other criteria,
 * plus save the image in a different folder.
 * 
 * If the function returns null or undefined, the normal Excalidraw operation will continue
 * with the excalidraw generated name and default path.
 * If a filepath is returned, that will be used. Include the full Vault filepath and filename
 * with the file extension.
 * The currentImageName is the name of the image generated by excalidraw or provided during paste.
 * 
 * @param data - An object containing the following properties:
 *   @property {string} [currentImageName] - Default name for the image.
 *   @property {string} drawingFilePath - The file path of the Excalidraw file where the image is being used.
 * 
 * @returns {string} - The new filepath for the image including full vault path and extension.
 * 
 * Example usage:
 * ```
 * onImageFilePathHook: (data) => {
 *   const { currentImageName, drawingFilePath } = data;
 *   const ext = currentImageName.split('.').pop();
 *   // Generate a new filepath based on the drawing file name and other criteria
 *   return `${drawingFileName} - ${currentImageName || 'image'}.${ext}`;
 * }
 * ```
 *  onImageFilePathHook: (data: {
 *   currentImageName: string; // Excalidraw generated name of the image, or the name received from the file system.
 *   drawingFilePath: string; // The full filepath of the Excalidraw file where the image is being used.
 * }) => string = null;  
 */
// ea.onImageFilePathHook = (data) => { console.log(data); };

/**
 * If set, this callback is triggered when the Excalidraw image is being exported to 
 * .svg, .png, or .excalidraw.
 * You can use this callback to customize the naming and path of the images. This allows
 * you to place images into an assets folder.
 * 
 * If the function returns null or undefined, the normal Excalidraw operation will continue
 * with the currentImageName and in the same folder as the Excalidraw file
 * If a filepath is returned, that will be used. Include the full Vault filepath and filename
 * with the file extension.
 * !!!! If an image already exists on the path, that will be overwritten. When returning
 * your own image path, you must take care of unique filenames (if that is a requirement) !!!!
 * The current image name is the name generated by Excalidraw:
 * - my-drawing.png
 * - my-drawing.svg
 * - my-drawing.excalidraw
 * - my-drawing.dark.svg
 * - my-drawing.light.svg
 * - my-drawing.dark.png
 * - my-drawing.light.png
 * 
 * @param data - An object containing the following properties:
 *   @property {string} exportFilepath - Default export filepath for the image.
 *   @property {string} excalidrawFile - TFile: The Excalidraw file being exported.
 *   @property {ExcalidrawAutomate} ea - The ExcalidrawAutomate instance associated with the hook.
 *   @property {string} [oldExcalidrawPath] - If action === "move" The old path of the Excalidraw file, else undefined
 *   @property {string} action - The action being performed: "export", "move", or "delete". move and delete reference the change to the Excalidraw  file.
 * 
 * @returns {string} - The new filepath for the image including full vault path and extension.
 * 
 * action === "move" || action === "delete" is only possible if "keep in sync" is enabled
 *   in plugin export settings
 *
 * Example usage:
 * ```
 * onImageFilePathHook: (data) => {
 *   const { currentImageName, drawingFilePath, frontmatter } = data;
 *   // Generate a new filepath based on the drawing file name and other criteria
 *   const ext = currentImageName.split('.').pop();
 *   if(frontmatter && frontmatter["my-custom-field"]) {
 *   }
 *   return `${drawingFileName} - ${currentImageName || 'image'}.${ext}`;
 * }
 * ```
 */
ea.onImageExportPathHook = (data) => {
  //debugger; //remove comment to debug using Developer Console

  let {
    excalidrawFile,
    exportFilepath,
    exportExtension,
    oldExcalidrawPath,
    action
  } = data;
  const frontmatter = app.metadataCache.getFileCache(excalidrawFile)?.frontmatter;
  //console.log(data, frontmatter);

  const excalidrawFilename = action === "move" ?
    ea.splitFolderAndFilename(excalidrawFile.name).filename :
    excalidrawFile.name

  if (excalidrawFilename.match(/^icon - /i)) {
    const {
      folderpath,
      filename,
      basename,
      extension
    } = ea.splitFolderAndFilename(exportFilepath);
    exportFilepath = "Assets/icons/" + filename;
    return exportFilepath;
  }

  if (excalidrawFilename.match(/^stickfigure - /i)) {
    const {
      folderpath,
      filename,
      basename,
      extension
    } = ea.splitFolderAndFilename(exportFilepath);
    exportFilepath = "Assets/stickfigures/" + filename;
    return exportFilepath;
  }

  if (excalidrawFilename.match(/^logo - /i)) {
    const {
      folderpath,
      filename,
      basename,
      extension
    } = ea.splitFolderAndFilename(exportFilepath);
    exportFilepath = "Assets/logos/" + filename;
    return exportFilepath;
  }


  // !!!! frontmatter will be undefined when action === "delete"
  // this means if you base your logic on frontmatter properties, then 
  // plugin settings keep files in sync will break for those files when
  // deleting the Excalidraw file. The images will not be deleted, or worst
  // your logic might result in deleting other files. This hook gives you
  // powerful control, but the hook function logic requires careful testing
  // on your part.
  //if(frontmatter && frontmatter["is-asset"]) { //custom frontmatter property
  //  exportFilepath = ea.obsidian.normalizePath("assets/" + exportFilepath);
  //  return exportFilepath;
  //}

  return exportFilepath;
};

/**
 * Excalidraw supports auto-export of Excalidraw files to .png, .svg, and .excalidraw formats.
 * 
 * Auto-export of Excalidraw files can be controlled at multiple levels.
 * 1) In plugin settings where you can set up default auto-export applicable to all your Excalidraw files.
 * 2) However, if you do not want to auto-export every file, you can also control auto-export
 *    at the file level using the 'excalidraw-autoexport' frontmatter property.
 * 3) This hook gives you an additional layer of control over the auto-export process.
 * 
 * This hook is triggered when an Excalidraw file is being saved.
 * 
 * interface AutoexportConfig {
 *   png: boolean; // Whether to auto-export to PNG
 *   svg: boolean; // Whether to auto-export to SVG
 *   excalidraw: boolean; // Whether to auto-export to Excalidraw format
 *   theme: "light" | "dark" | "both"; // The theme to use for the export
 * }
 *
 * @param {Object} data - The data for the hook.
 * @param {AutoexportConfig} data.autoexportConfig - The current autoexport configuration.
 * @param {TFile} data.excalidrawFile - The Excalidraw file being auto-exported.
 * @returns {AutoexportConfig | null} - Return a modified AutoexportConfig to override the export behavior, or null to use the default.
 */
ea.onTriggerAutoexportHook = (data) => {
  let {
    autoexportConfig,
    excalidrawFile
  } = data;
  //const frontmatter = app.metadataCache.getFileCache(excalidrawFile)?.frontmatter;
  //console.log(data, frontmatter);
  //logic based on filepath and frontmatter

  if (excalidrawFile.name.match(/^(?:icon|stickfigure|logo) - /i)) {
    autoexportConfig.theme = "light";
    autoexportConfig.svg = true;
    autoexportConfig.png = false;
    autoexportConfig.excalidraw = false;
    return autoexportConfig;
  }
  return autoexportConfig;
};

/**
 * If set, this callback is triggered whenever the active canvas color changes
 *   onCanvasColorChangeHook: (
 *     ea: ExcalidrawAutomate,
 *     view: ExcalidrawView, //the excalidraw view 
 *     color: string,
 *   ) => void = null;
 */
//ea.onCanvasColorChangeHook = (ea, view, color) => {};

/**
 * If set, this callback is triggered whenever a drawing is exported to SVG.
 * The string returned will replace the link in the exported SVG.
 * The hook is only executed if the link is to a file internal to Obsidian
 * see: https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1605
 *  onUpdateElementLinkForExportHook: (data: {
 *    originalLink: string,
 *    obsidianLink: string,
 *    linkedFile: TFile | null,
 *    hostFile: TFile,
 *  }) => string = null;
 */
//ea.onUpdateElementLinkForExportHook = (data) => {
//  const decodedObsidianURI = decodeURIComponent(data.obsidianLink);
//};

