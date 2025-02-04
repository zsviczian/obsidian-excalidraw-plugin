import ExcalidrawPlugin from "src/core/main";
import {
  FillStyle,
  StrokeStyle,
  ExcalidrawElement,
  ExcalidrawBindableElement,
  FileId,
  NonDeletedExcalidrawElement,
  ExcalidrawImageElement,
  ExcalidrawTextElement,
  StrokeRoundness,
  RoundnessType,
  ExcalidrawFrameElement,
  ExcalidrawTextContainer,
} from "@zsviczian/excalidraw/types/excalidraw/element/types";
import { ColorMap, MimeType } from "./EmbeddedFileLoader";
import { Editor,  Notice, OpenViewState, RequestUrlResponse, TFile, TFolder, WorkspaceLeaf } from "obsidian";
import * as obsidian_module from "obsidian";
import ExcalidrawView, { ExportSettings, TextMode } from "src/view/ExcalidrawView";
import { ExcalidrawData, getMarkdownDrawingSection } from "./ExcalidrawData";
import {
  FRONTMATTER,
  nanoid,
  MAX_IMAGE_SIZE,
  COLOR_NAMES,
  fileid,
  GITHUB_RELEASES,
  determineFocusDistance,
  getCommonBoundingBox,
  getLineHeight,
  getMaximumGroups,
  intersectElementWithLine,
  DEVICE,
  mermaidToExcalidraw,
  refreshTextDimensions,
} from "src/constants/constants";
import { blobToBase64, checkAndCreateFolder, getDrawingFilename, getExcalidrawEmbeddedFilesFiletree, getListOfTemplateFiles, getNewUniqueFilepath } from "src/utils/fileUtils";
import {
  //debug,
  getImageSize,
  isMaskFile,
  wrapTextAtCharLength,
  arrayToMap,
  addAppendUpdateCustomData,
  getSVG,
  getWithBackground,
} from "src/utils/utils";
import { getAttachmentsFolderAndFilePath, getExcalidrawViews, getLeaf, getNewOrAdjacentLeaf, isObsidianThemeDark, mergeMarkdownFiles, openLeaf } from "src/utils/obsidianUtils";
import { AppState, BinaryFileData,  DataURL,  ExcalidrawImperativeAPI } from "@zsviczian/excalidraw/types/excalidraw/types";
import { EmbeddedFile, EmbeddedFilesLoader } from "./EmbeddedFileLoader";
import { tex2dataURL } from "./LaTeX";
import { NewFileActions } from "src/shared/Dialogs/Prompt";
import { ConnectionPoint, DeviceType, Point  } from "src/types/types";
import CM, { ColorMaster, extendPlugins } from "@zsviczian/colormaster";
import HarmonyPlugin from "@zsviczian/colormaster/plugins/harmony";
import MixPlugin from "@zsviczian/colormaster/plugins/mix"
import A11yPlugin from "@zsviczian/colormaster/plugins/accessibility"
import NamePlugin from "@zsviczian/colormaster/plugins/name"
import LCHPlugin from "@zsviczian/colormaster/plugins/lch";
import LUVPlugin from "@zsviczian/colormaster/plugins/luv";
import LABPlugin from "@zsviczian/colormaster/plugins/lab";
import UVWPlugin from "@zsviczian/colormaster/plugins/uvw";
import XYZPlugin from "@zsviczian/colormaster/plugins/xyz";
import HWBPlugin from "@zsviczian/colormaster/plugins/hwb";
import HSVPlugin from "@zsviczian/colormaster/plugins/hsv";
import RYBPlugin from "@zsviczian/colormaster/plugins/ryb";
import CMYKPlugin from "@zsviczian/colormaster/plugins/cmyk";
import { TInput } from "@zsviczian/colormaster/types";
import {ConversionResult, svgToExcalidraw} from "src/shared/svgToExcalidraw/parser"
import { ROUNDNESS } from "src/constants/constants";
import { ClipboardData } from "@zsviczian/excalidraw/types/excalidraw/clipboard";
import { emulateKeysForLinkClick, PaneTarget } from "src/utils/modifierkeyHelper";
import { Mutable } from "@zsviczian/excalidraw/types/excalidraw/utility-types";
import PolyBool from "polybooljs";
import { EmbeddableMDCustomProps } from "./Dialogs/EmbeddableSettings";
import {
  AIRequest,
  postOpenAI as _postOpenAI,
  extractCodeBlocks as _extractCodeBlocks,
} from "../utils/AIUtils";
import { EXCALIDRAW_AUTOMATE_INFO, EXCALIDRAW_SCRIPTENGINE_INFO } from "./Dialogs/SuggesterInfo";
import { addBackOfTheNoteCard } from "../utils/excalidrawViewUtils";
import { log } from "../utils/debugHelper";
import { ExcalidrawLib } from "../types/excalidrawLib";
import { GlobalPoint } from "@zsviczian/excalidraw/types/math/types";
import { AddImageOptions, ImageInfo, SVGColorInfo } from "src/types/excalidrawAutomateTypes";
import { _measureText, cloneElement, createPNG, createSVG, errorMessage, filterColorMap, getEmbeddedFileForImageElment, getFontFamily, getLineBox, getTemplate, isColorStringTransparent, isSVGColorInfo, mergeColorMapIntoSVGColorInfo, normalizeLinePoints, repositionElementsToCursor, svgColorInfoToColorMap, updateOrAddSVGColorInfo, verifyMinimumPluginVersion } from "src/utils/excalidrawAutomateUtils";
import { exportToPDF, getMarginValue, getPageDimensions, PageDimensions, PageOrientation, PageSize, PDFExportScale, PDFPageProperties } from "src/utils/exportUtils";
import { FrameRenderingOptions } from "src/types/utilTypes";

extendPlugins([
  HarmonyPlugin,
  MixPlugin,
  A11yPlugin,
  NamePlugin,
  LCHPlugin,
  LUVPlugin,
  LABPlugin,
  UVWPlugin,
  XYZPlugin,
  HWBPlugin,
  HSVPlugin,
  RYBPlugin,
  CMYKPlugin
]);

declare const PLUGIN_VERSION:string;
declare var LZString: any;
declare const excalidrawLib: typeof ExcalidrawLib;

const GAP = 4;

/**
 * ExcalidrawAutomate is a utility class that provides a simplified API to interact with Excalidraw elements and the Excalidraw canvas.
 * Elements in the Excalidraw Scene are immutable. You should never directly change element properties in the scene object.
 * ExcalidrawAutomate provides a "workbench" where you can create, modify, and delete elements before committing them to the Excalidraw Scene.
 * The basic workflow is to create elements in ExcalidrawAutomate and once ready commit them to the Excalidraw Scene using addElementsToView().
 * To modify elements in the scene, you should first copy them over to EA using copyViewElementsToEAforEditing, make the necessary modifications,
 * then commit them back to the scene using addElementsToView().
 * To delete an element from the view set element.isDeleted = true and commit the changes to the scene using addElementsToView().
 * 
 * At a very high level, EA has 3 type of functions:
 * - functions that modify elements in the EA workbench
 * - functions that access elements and properties of the Scene
 *   - these only work if targetView is set using setView()
 *   - Scripts executed by the Excalidraw ScritpEngine will have the targetView set automatically
 *   - These functions include the word view in their name e.g. getViewSelectedElements()
 * - utility functions that do not modify eleeemnts in the EA workbench or access the scene e.g.
 *   - ea.obsidian is a utility function that returns the Obsidian Module object.
 *   - eg.getCM() returns the ColorMaster object for manipulationg colors,
 *   - ea.help() provides information about functions and properties in the ExcalidrawAutomate class intended for use in Developer Console
 *   - checkAndCreateFolder (thought this has been superceeded by app.vault.createFolder in the Obsidian API)
 *   - etc.
 * 
 * Note that some actions are asynchronous and require await to complete. e.g.: 
 *   - addImage()
 *   - convertStringToDataURL()
 *   - etc.
 * 
 * About the Excalidraw Automate Script Engine:
 * --------------------------------------------
 * Excalidraw Scripts utilize ExcalidrawAutomate. When the script is invoked Excalidraw passes an ExcalidrawAutomate instance to the script.
 * you may access this object via the variable `ea`. e.g. ea.addImage(); This ea object is already set to the targetView.
 * Through ea.obsidian all of the Obsidian API is available to the script. Thus you can create modal views, open files, etc.
 * You can access Obsidian type definitions here: https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts
 * In addition to the ea object, the script also receives the `utils` object. utils includes to utility functions: suggester and inputPrompt
 *   - inputPrompt(inputPrompt: (
 *       header: string,
 *       placeholder?: string,
 *       value?: string,
 *       buttons?: ButtonDefinition[],
 *       lines?: number,
 *       displayEditorButtons?: boolean,
 *       customComponents?: (container: HTMLElement) => void,
 *       blockPointerInputOutsideModal?: boolean,
 *     ) => Promise<string>;
 *   -  displayItems: string[],
 *       items: any[],
 *       hint?: string,
 *       instructions?: Instruction[],
 *     ) => Promise<any>;
 */
export class ExcalidrawAutomate {
  /**
   * Utility function that returns the Obsidian Module object.
   * @returns {typeof obsidian_module} The Obsidian module object.
   */
  get obsidian() {
    return obsidian_module;
  };

  /**
   * Retrieves the laser pointer settings from the plugin.
   * @returns {Object} The laser pointer settings.
   */
  get LASERPOINTER() {
    return this.plugin.settings.laserSettings;
  }

  /**
   * Retrieves the device type information.
   * @returns {DeviceType} The device type.
   */
  get DEVICE():DeviceType {
    return DEVICE;
  }

  /**
   * Prints a detailed breakdown of the startup time.
   */
  public printStartupBreakdown() {
    this.plugin.printStarupBreakdown();
  }

  /**
   * Add or modify keys in an element's customData while preserving existing keys.
   * Creates customData={} if it does not exist.
   * @param {string} id - The element ID in elementsDict to modify.
   * @param {Partial<Record<string, unknown>>} newData - Object containing key-value pairs to add/update. Set value to undefined to delete a key.
   * @returns {Mutable<ExcalidrawElement> | undefined} The modified element, or undefined if element does not exist.
   */
  public addAppendUpdateCustomData(id:string, newData: Partial<Record<string, unknown>>) {
    const el = this.elementsDict[id];
    if (!el) {
      return;
    }
    return addAppendUpdateCustomData(el,newData);
  }

  /**
   * Displays help information for EA functions and properties intended to be used in Obsidian developer console.
   * @param {Function | string} target - Function reference or property name as string.
   * Usage examples:
   * - ea.help(ea.functionName) 
   * - ea.help('propertyName')
   * - ea.help('utils.functionName')
   */
  public help(target: Function | string) {
    if (!target) {
      log("Usage: ea.help(ea.functionName) or ea.help('propertyName') or ea.help('utils.functionName') - notice property name and utils function name is in quotes");
      return;
    }
  
    let funcInfo;
  
    if (typeof target === 'function') {
      funcInfo = EXCALIDRAW_AUTOMATE_INFO.find((info) => info.field === target.name);
    } else if (typeof target === 'string') {
      let stringTarget:string = target;
      stringTarget = stringTarget.startsWith("utils.") ? stringTarget.substring(6) : stringTarget;
      stringTarget = stringTarget.startsWith("ea.") ? stringTarget.substring(3) : stringTarget;
      funcInfo = EXCALIDRAW_AUTOMATE_INFO.find((info) => info.field === stringTarget);
      if(!funcInfo) {
        funcInfo = EXCALIDRAW_SCRIPTENGINE_INFO.find((info) => info.field === stringTarget);
      }
    }
  
    if(!funcInfo) {
      log("Usage: ea.help(ea.functionName) or ea.help('propertyName') or ea.help('utils.functionName') - notice property name and utils function name is in quotes");
      return;
    }

    let isMissing = true;
    if (funcInfo.code) {
      isMissing = false;
      log(`Declaration: ${funcInfo.code}`);
    }
    if (funcInfo.desc) {
      isMissing = false;
      const formattedDesc = funcInfo.desc
        .replaceAll("<br>", "\n")
        .replace(/<code>(.*?)<\/code>/g, '%c\u200b$1%c') // Zero-width space
        .replace(/<b>(.*?)<\/b>/g, '%c\u200b$1%c')      // Zero-width space
        .replace(/<a onclick='window\.open\("(.*?)"\)'>(.*?)<\/a>/g, (_, href, text) => `%c\u200b${text}%c\u200b (link: ${href})`); // Zero-width non-joiner
  
      const styles = Array.from({ length: (formattedDesc.match(/%c/g) || []).length }, (_, i) => i % 2 === 0 ? 'color: #007bff;' : '');
      log(`Description: ${formattedDesc}`, ...styles);
    } 
    if (isMissing) {
      log("Description not available for this function.");
    }
  }

  /**
   * Posts an AI request to the OpenAI API and returns the response.
   * @param {AIRequest} request - The AI request configuration.
   * @returns {Promise<RequestUrlResponse>} Promise resolving to the API response.
   */
  public async postOpenAI(request: AIRequest): Promise<RequestUrlResponse> {
    return await _postOpenAI(request);
  } 

  /**
   * Extracts code blocks from markdown text.
   * @param {string} markdown - The markdown string to parse.
   * @returns {Array<{ data: string, type: string }>} Array of objects containing code block contents and types.
   */
  public extractCodeBlocks(markdown: string): { data: string, type: string }[] {
    return _extractCodeBlocks(markdown);
  }

  /**
   * Converts a string to a data URL with specified MIME type.
   * @param {string} data - The string to convert.
   * @param {string} [type="text/html"] - MIME type (default: "text/html").
   * @returns {Promise<string>} Promise resolving to the data URL string.
   */
  public async convertStringToDataURL(data:string, type: string = "text/html"): Promise<string> {
    // Create a blob from the HTML string
    const blob = new Blob([data], { type });
  
    // Read the blob as Data URL
    const base64String = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        if(typeof reader.result === "string") {
          const base64String = reader.result.split(',')[1];
          resolve(base64String);
        } else {
          resolve(null);
        }
      };
      reader.readAsDataURL(blob);
    });
    if(base64String) {
      return `data:${type};base64,${base64String}`;
    }
    return "about:blank";
  }

  /**
   * Creates a folder if it doesn't exist.
   * @param {string} folderpath - Path of folder to create.
   * @returns {Promise<TFolder>} Promise resolving to the created/existing TFolder.
   */
  public async checkAndCreateFolder(folderpath: string): Promise<TFolder> {
    return await checkAndCreateFolder(folderpath);
  }

  /**
   * Generates a unique filepath by appending a number if file already exists.
   * @param {string} filename - Base filename.
   * @param {string} folderpath - Target folder path.
   * @returns {string} Unique filepath string.
   */
  public getNewUniqueFilepath(filename: string, folderpath: string): string {
    return getNewUniqueFilepath(this.plugin.app.vault, filename, folderpath);
  }

  /**
   * Gets list of available Excalidraw template files.
   * @returns {TFile[] | null} Array of template TFiles or null if none found.
   */
  public getListOfTemplateFiles(): TFile[] | null {
    return getListOfTemplateFiles(this.plugin);
  }

  /**
   * Gets all embedded images in a drawing recursively.
   * @param {TFile} [excalidrawFile] - Optional file to check, defaults to ea.targetView.file.
   * @returns {TFile[]} Array of embedded image TFiles.
   */
  public getEmbeddedImagesFiletree(excalidrawFile?: TFile): TFile[] {
    if(!excalidrawFile && this.targetView && this.targetView.file) {
      excalidrawFile = this.targetView.file;
    }
    if(!excalidrawFile) {
      return [];
    }
    return getExcalidrawEmbeddedFilesFiletree(excalidrawFile, this.plugin);
  }

  /**
   * Returns a new unique attachment filepath for the filename provided based on Obsidian settings.
   * @param {string} filename - The filename for the attachment.
   * @returns {Promise<string>} Promise resolving to the unique attachment filepath.
   */
  public async getAttachmentFilepath(filename: string): Promise<string> {
    if (!this.targetView || !this.targetView?.file) {
      errorMessage("targetView not set", "getAttachmentFolderAndFilePath()");
      return null;
    }
    const folderAndPath = await getAttachmentsFolderAndFilePath(this.plugin.app,this.targetView.file.path, filename);
    return getNewUniqueFilepath(this.plugin.app.vault, filename, folderAndPath.folder);
  }

  /**
   * Compresses a string to base64 using LZString.
   * @param {string} str - The string to compress.
   * @returns {string} The compressed base64 string.
   */
  public compressToBase64(str:string): string {
    return LZString.compressToBase64(str);
  }

  /**
   * Decompresses a string from base64 using LZString.
   * @param {string} data - The base64 string to decompress.
   * @returns {string} The decompressed string.
   */
  public decompressFromBase64(data:string): string {
    if (!data) throw new Error("No input string provided for decompression.");
    let cleanedData = '';
    const length = data.length;
    for (let i = 0; i < length; i++) {
      const char = data[i];
      if (char !== '\\n' && char !== '\\r') {
        cleanedData += char;
      }
    }
    return LZString.decompressFromBase64(cleanedData);
  }

  /**
   * Prompts the user with a dialog to select new file action.
   * - create markdown file
   * - create excalidraw file
   * - cancel action
   * The new file will be relative to this.targetView.file.path, unless parentFile is provided.
   * If shouldOpenNewFile is true, the new file will be opened in a workspace leaf. 
   * targetPane control which leaf will be used for the new file.
   * Returns the TFile for the new file or null if the user cancelled the action.
   * @param {string} newFileNameOrPath - The new file name or path.
   * @param {boolean} shouldOpenNewFile - Whether to open the new file.
   * @param {PaneTarget} [targetPane] - The target pane for the new file.
   * @param {TFile} [parentFile] - The parent file for the new file.
   * @returns {Promise<TFile | null>} Promise resolving to the new TFile or null if cancelled.
   */
  public async newFilePrompt(
    newFileNameOrPath: string,
    shouldOpenNewFile: boolean,
    targetPane?: PaneTarget,
    parentFile?: TFile,
  ): Promise<TFile | null> {
    if (!this.targetView || !this.targetView?.file) {
      errorMessage("targetView not set", "newFileActions()");
      return null;
    }
    const modifierKeys = emulateKeysForLinkClick(targetPane);
    const newFilePrompt = new NewFileActions({
      plugin: this.plugin,
      path: newFileNameOrPath,
      keys: modifierKeys,
      view: this.targetView,
      openNewFile: shouldOpenNewFile,
      parentFile: parentFile
    })
    newFilePrompt.open();
    return await newFilePrompt.waitForClose;
  }

  /**
   * Generates a new Obsidian Leaf following Excalidraw plugin settings such as open in Main Workspace or not, open in adjacent pane if available, etc.
   * @param {WorkspaceLeaf} origo - The currently active leaf, the origin of the new leaf.
   * @param {PaneTarget} [targetPane] - The target pane for the new leaf.
   * @returns {WorkspaceLeaf} The new or adjacent workspace leaf.
   */
  public getLeaf (
    origo: WorkspaceLeaf,
    targetPane?: PaneTarget,
  ): WorkspaceLeaf {
    const modifierKeys = emulateKeysForLinkClick(targetPane??"new-tab");
    return getLeaf(this.plugin,origo,modifierKeys);
  }

  /**
   * Returns the editor or leaf.view of the currently active embedded obsidian file.
   * If view is not provided, ea.targetView is used.
   * If the embedded file is a markdown document the function will return
   * {file:TFile, editor:Editor} otherwise it will return {view:any}. You can check view type with view.getViewType();
   * @param {ExcalidrawView} [view] - The view to check.
   * @returns {{view:any}|{file:TFile, editor:Editor}|null} The active embeddable view or editor.
   */
  public getActiveEmbeddableViewOrEditor (view?:ExcalidrawView): {view:any}|{file:TFile, editor:Editor}|null {
    if (!this.targetView && !view) {
      return null;
    }
    view = view ?? this.targetView;
    const leafOrNode = view.getActiveEmbeddable();
    if(leafOrNode) {
      if(leafOrNode.node && leafOrNode.node.isEditing) {
        return {file: leafOrNode.node.file, editor: leafOrNode.node.child.editor};
      }
      if(leafOrNode.leaf && leafOrNode.leaf.view) {
        return {view: leafOrNode.leaf.view};
      }
    }
    return null;
  }

  /**
   * Checks if the Excalidraw File is a mask file.
   * @param {TFile} [file] - The file to check.
   * @returns {boolean} True if the file is a mask file, false otherwise.
   */
  public isExcalidrawMaskFile(file?:TFile): boolean {
    if(file) {
      return this.isExcalidrawFile(file) && isMaskFile(this.plugin, file);
    }
    if (!this.targetView || !this.targetView?.file) {
      errorMessage("targetView not set", "isMaskFile()");
      return null;
    }
    return isMaskFile(this.plugin, this.targetView.file);
  }

  plugin: ExcalidrawPlugin;
  elementsDict: {[key:string]:any}; //contains the ExcalidrawElements currently edited in Automate indexed by el.id
  imagesDict: {[key: FileId]: ImageInfo}; //the images files including DataURL, indexed by fileId
  mostRecentMarkdownSVG:SVGSVGElement = null; //Markdown renderer will drop a copy of the most recent SVG here for debugging purposes
  style: {
    strokeColor: string; //https://www.w3schools.com/colors/default.asp
    backgroundColor: string;
    angle: number; //radian
    fillStyle: FillStyle; //type FillStyle = "hachure" | "cross-hatch" | "solid"
    strokeWidth: number;
    strokeStyle: StrokeStyle; //type StrokeStyle = "solid" | "dashed" | "dotted"
    roughness: number;
    opacity: number;
    strokeSharpness?: StrokeRoundness; //defaults to undefined, use strokeRoundess and roundess instead. Only kept for legacy script compatibility type StrokeRoundness = "round" | "sharp"
    roundness: null | { type: RoundnessType; value?: number };
    fontFamily: number; //1: Virgil, 2:Helvetica, 3:Cascadia, 4:Local Font
    fontSize: number;
    textAlign: string; //"left"|"right"|"center"
    verticalAlign: string; //"top"|"bottom"|"middle" :for future use, has no effect currently
    startArrowHead: string; //"arrow"|"bar"|"circle"|"circle_outline"|"triangle"|"triangle_outline"|"diamond"|"diamond_outline"|null
    endArrowHead: string;
  };
  canvas: {
    theme: string; //"dark"|"light"
    viewBackgroundColor: string;
    gridSize: number;
  };
  colorPalette: {};

  constructor(plugin: ExcalidrawPlugin, view?: ExcalidrawView) {
    this.plugin = plugin;
    this.reset();
    this.targetView = view;
  }

  /**
   * Returns the last recorded pointer position on the Excalidraw canvas.
   * @returns {{x:number, y:number}} The last recorded pointer position.
   */
  public getViewLastPointerPosition(): {x:number, y:number} {
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "getExcalidrawAPI()");
      return null;
    }
    return this.targetView.currentPosition;
  }

  /**
   * Returns the Excalidraw API for the current view or the view provided.
   * @param {ExcalidrawView} [view] - The view to get the API for.
   * @returns {ExcalidrawAutomate} The Excalidraw API.
   */
  public getAPI(view?:ExcalidrawView):ExcalidrawAutomate {
    const ea = new ExcalidrawAutomate(this.plugin, view);
    this.plugin.eaInstances.push(ea);
    return ea;
  }

  /**
   * Sets the fill style for new elements.
   * @param {number} val - The fill style value (0: "hachure", 1: "cross-hatch", 2: "solid").
   * @returns {"hachure"|"cross-hatch"|"solid"} The fill style string.
   */
  setFillStyle(val: number):"hachure"|"cross-hatch"|"solid" {
    switch (val) {
      case 0:
        this.style.fillStyle = "hachure";
        return "hachure";
      case 1:
        this.style.fillStyle = "cross-hatch";
        return "cross-hatch";
      default:
        this.style.fillStyle = "solid";
        return "solid";
    }
  };

  /**
   * Sets the stroke style for new elements.
   * @param {number} val - The stroke style value (0: "solid", 1: "dashed", 2: "dotted").
   * @returns {"solid"|"dashed"|"dotted"} The stroke style string.
   */
  setStrokeStyle(val: number):"solid"|"dashed"|"dotted" {
    switch (val) {
      case 0:
        this.style.strokeStyle = "solid";
        return "solid";
      case 1:
        this.style.strokeStyle = "dashed";
        return "dashed";
      default:
        this.style.strokeStyle = "dotted";
        return "dotted";
    }
  };

  /**
   * Sets the stroke sharpness for new elements.
   * @param {number} val - The stroke sharpness value (0: "round", 1: "sharp").
   * @returns {"round"|"sharp"} The stroke sharpness string.
   */
  setStrokeSharpness(val: number):"round"|"sharp" {
    switch (val) {
      case 0:
        this.style.roundness = {
          type: ROUNDNESS.LEGACY
        }
        return "round";
      default:
        this.style.roundness = null; //sharp
        return "sharp";
    }
  };

  /**
   * Sets the font family for new text elements.
   * @param {number} val - The font family value (1: Virgil, 2: Helvetica, 3: Cascadia).
   * @returns {string} The font family string.
   */
  setFontFamily(val: number):string {
    switch (val) {
      case 1:
        this.style.fontFamily = 4;
        return getFontFamily(4);
      case 2:
        this.style.fontFamily = 2;
        return getFontFamily(2);
      case 3:
        this.style.fontFamily = 3;
        return getFontFamily(3);
      default:
        this.style.fontFamily = 1;
        return getFontFamily(1);
    }
  };

  /**
   * Sets the theme for the canvas.
   * @param {number} val - The theme value (0: "light", 1: "dark").
   * @returns {"light"|"dark"} The theme string.
   */
  setTheme(val: number):"light"|"dark" {
    switch (val) {
      case 0:
        this.canvas.theme = "light";
        return "light";
      default:
        this.canvas.theme = "dark";
        return "dark";
    }
  };

  /**
   * Generates a groupID and adds the groupId to all the elements in the objectIds array. Essentially grouping the elements in the view.
   * @param {string[]} objectIds - Array of element IDs to group.
   * @returns {string} The generated group ID.
   */
  addToGroup(objectIds: string[]): string {
    const id = nanoid();
    objectIds.forEach((objectId) => {
      this.elementsDict[objectId]?.groupIds?.push(id);
    });
    return id;
  };

  /**
   * Copies elements from ExcalidrawAutomate to the clipboard as a valid Excalidraw JSON string.
   * @param {string} [templatePath] - Optional template path to include in the clipboard data.
   */
  async toClipboard(templatePath?: string) {
    const template = templatePath
      ? await getTemplate(
          this.plugin,
          templatePath,
          false,
          new EmbeddedFilesLoader(this.plugin),
          0
        )
      : null;
    let elements = template ? template.elements : [];
    elements = elements.concat(this.getElements());
    navigator.clipboard.writeText(
      JSON.stringify({
        type: "excalidraw/clipboard",
        elements,
      }),
    );
  };

  /**
   * Extracts the Excalidraw Scene from an Excalidraw File.
   * @param {TFile} file - The Excalidraw file to extract the scene from.
   * @returns {Promise<{elements: ExcalidrawElement[]; appState: AppState;}>} Promise resolving to the Excalidraw scene.
   */
  async getSceneFromFile(file: TFile): Promise<{elements: ExcalidrawElement[]; appState: AppState;}> {
    if(!file) {
      errorMessage("file not found", "getScene()");
      return null;
    }
    if(!this.isExcalidrawFile(file)) {
      errorMessage("file is not an Excalidraw file", "getScene()");
      return null;
    }
    const template = await getTemplate(this.plugin,file.path,false,new EmbeddedFilesLoader(this.plugin),0);
    return {
      elements: template.elements,
      appState: template.appState
    }
  }

  /**
   * Gets all elements from ExcalidrawAutomate elementsDict.
   * @returns {Mutable<ExcalidrawElement>[]} Array of elements from elementsDict.
   */
  getElements(): Mutable<ExcalidrawElement>[] {
    const elements = [];
    const elementIds = Object.keys(this.elementsDict);
    for (let i = 0; i < elementIds.length; i++) {
      elements.push(this.elementsDict[elementIds[i]]);
    }
    return elements;
  };
  
  /**
   * Gets a single element from ExcalidrawAutomate elementsDict.
   * @param {string} id - The element ID to retrieve.
   * @returns {Mutable<ExcalidrawElement>} The element with the specified ID.
   */
  getElement(id: string): Mutable<ExcalidrawElement> {
    return this.elementsDict[id];
  };

  /**
   * Creates a drawing and saves it to the specified filename.
   * @param {Object} [params] - Parameters for creating the drawing.
   * @param {string} [params.filename] - The filename for the drawing. If null, default filename as defined in Excalidraw settings.
   * @param {string} [params.foldername] - The folder name for the drawing. If null, default folder as defined in Excalidraw settings.
   * @param {string} [params.templatePath] - The template path to use for the drawing.
   * @param {boolean} [params.onNewPane] - Whether to open the drawing in a new pane.
   * @param {boolean} [params.silent] - Whether to create the drawing silently.
   * @param {Object} [params.frontmatterKeys] - Frontmatter keys to include in the drawing.
   * @param {string} [params.plaintext] - Text to insert above the `# Text Elements` section.
   * @returns {Promise<string>} Promise resolving to the path of the created drawing.
   */
  async create(params?: {
    filename?: string;
    foldername?: string;
    templatePath?: string;
    onNewPane?: boolean;
    silent?: boolean;
    frontmatterKeys?: {
      "excalidraw-plugin"?: "raw" | "parsed";
      "excalidraw-link-prefix"?: string;
      "excalidraw-link-brackets"?: boolean;
      "excalidraw-url-prefix"?: string;
      "excalidraw-export-transparent"?: boolean;
      "excalidraw-export-dark"?: boolean;
      "excalidraw-export-padding"?: number;
      "excalidraw-export-pngscale"?: number;
      "excalidraw-export-embed-scene"?: boolean;
      "excalidraw-default-mode"?: "view" | "zen";
      "excalidraw-onload-script"?: string;
      "excalidraw-linkbutton-opacity"?: number;
      "excalidraw-autoexport"?: boolean;
      "excalidraw-mask"?: boolean;
      "excalidraw-open-md"?: boolean;
      "cssclasses"?: string;
    };
    plaintext?: string; //text to insert above the `# Text Elements` section
  }): Promise<string> {

    const template = params?.templatePath
      ? await getTemplate(
          this.plugin,
          params.templatePath,
          true,
          new EmbeddedFilesLoader(this.plugin),
          0
        )
      : null;
    if (template?.plaintext) {
      if(params.plaintext) {
        params.plaintext = params.plaintext + "\n\n" + template.plaintext;
      } else {
        params.plaintext = template.plaintext;
      }
    }
    let elements = template ? template.elements : [];
    elements = elements.concat(this.getElements());
    let frontmatter: string;
    if (params?.frontmatterKeys) {
      const keys = Object.keys(params.frontmatterKeys);
      if (!keys.includes("excalidraw-plugin")) {
        params.frontmatterKeys["excalidraw-plugin"] = "parsed";
      }
      frontmatter = "---\n\n";
      for (const key of Object.keys(params.frontmatterKeys)) {
        frontmatter += `${key}: ${
          //@ts-ignore
          params.frontmatterKeys[key] === ""
            ? '""'
            : //@ts-ignore
              params.frontmatterKeys[key]
        }\n`;
      }
      frontmatter += "\n---\n";
    } else {
      frontmatter = template?.frontmatter
        ? template.frontmatter
        : FRONTMATTER;
    }

    frontmatter += params.plaintext
      ? (params.plaintext.endsWith("\n\n")
        ? params.plaintext
        : (params.plaintext.endsWith("\n") 
          ? params.plaintext + "\n"
          : params.plaintext + "\n\n"))
      : "";
    if(template?.frontmatter && params?.frontmatterKeys) {
      //the frontmatter tags supplyed to create take priority
      frontmatter = mergeMarkdownFiles(template.frontmatter,frontmatter);
    }

    const scene = {
      type: "excalidraw",
      version: 2,
      source: GITHUB_RELEASES+PLUGIN_VERSION,
      elements,
      appState: {
        theme: template?.appState?.theme ?? this.canvas.theme,
        viewBackgroundColor:
          template?.appState?.viewBackgroundColor ??
          this.canvas.viewBackgroundColor,
        currentItemStrokeColor:
          template?.appState?.currentItemStrokeColor ??
          this.style.strokeColor,
        currentItemBackgroundColor:
          template?.appState?.currentItemBackgroundColor ??
          this.style.backgroundColor,
        currentItemFillStyle:
          template?.appState?.currentItemFillStyle ?? this.style.fillStyle,
        currentItemStrokeWidth:
          template?.appState?.currentItemStrokeWidth ??
          this.style.strokeWidth,
        currentItemStrokeStyle:
          template?.appState?.currentItemStrokeStyle ??
          this.style.strokeStyle,
        currentItemRoughness:
          template?.appState?.currentItemRoughness ?? this.style.roughness,
        currentItemOpacity:
          template?.appState?.currentItemOpacity ?? this.style.opacity,
        currentItemFontFamily:
          template?.appState?.currentItemFontFamily ?? this.style.fontFamily,
        currentItemFontSize:
          template?.appState?.currentItemFontSize ?? this.style.fontSize,
        currentItemTextAlign:
          template?.appState?.currentItemTextAlign ?? this.style.textAlign,
        currentItemStartArrowhead:
          template?.appState?.currentItemStartArrowhead ??
          this.style.startArrowHead,
        currentItemEndArrowhead:
          template?.appState?.currentItemEndArrowhead ??
          this.style.endArrowHead,
        currentItemRoundness: //type StrokeRoundness = "round" | "sharp"
          template?.appState?.currentItemLinearStrokeSharpness ?? //legacy compatibility
          template?.appState?.currentItemStrokeSharpness ?? //legacy compatibility
          template?.appState?.currentItemRoundness ??
          this.style.roundness ? "round":"sharp",
        gridSize: template?.appState?.gridSize ?? this.canvas.gridSize,
        colorPalette: template?.appState?.colorPalette ?? this.colorPalette,
        ...template?.appState?.frameRendering
          ? {frameRendering: template.appState.frameRendering}
          : {},
        ...template?.appState?.objectsSnapModeEnabled
          ? {objectsSnapModeEnabled: template.appState.objectsSnapModeEnabled}
          : {},
      },
      files: template?.files ?? {},
    };

    const generateMD = ():string => {
      const textElements = this.getElements().filter(el => el.type === "text") as ExcalidrawTextElement[];
      let outString = `# Excalidraw Data\n\n## Text Elements\n`;
      textElements.forEach(te=> {
        outString += `${te.rawText ?? (te.originalText ?? te.text)} ^${te.id}\n\n`;
      });

      const elementsWithLinks = this.getElements().filter( el => el.type !== "text" && el.link)
      elementsWithLinks.forEach(el=>{
        outString += `${el.link} ^${el.id}\n\n`;
      })
  
      outString += Object.keys(this.imagesDict).length > 0
        ? `\n## Embedded Files\n`
        : "\n";
        
      const embeddedFile = (key: FileId, path: string, colorMap?:ColorMap): string => {
        return `${key}: [[${path}]]${colorMap ? " " + JSON.stringify(colorMap): ""}\n\n`;
      }

      Object.keys(this.imagesDict).forEach((key: FileId)=> {
        const item = this.imagesDict[key];
        if(item.latex) {
          outString += `${key}: $$${item.latex.trim()}$$\n\n`;  
        } else {
          if(item.file) {
            if(item.file instanceof TFile) {
              outString += embeddedFile(key,item.file.path, item.colorMap);
            } else {
              outString += embeddedFile(key,item.file, item.colorMap);
            }
          } else {
            const hyperlinkSplit = item.hyperlink.split("#");
            const file = this.plugin.app.vault.getAbstractFileByPath(hyperlinkSplit[0]);
            if(file && file instanceof TFile) {
              const hasFileRef = hyperlinkSplit.length === 2
              outString += hasFileRef
                ? embeddedFile(key,`${file.path}#${hyperlinkSplit[1]}`, item.colorMap)
                : embeddedFile(key,file.path, item.colorMap);
            } else {
              outString += `${key}: ${item.hyperlink}\n\n`;
            }
          }
        }
      })
      return outString + "%%\n";
    }

    const filename = params?.filename
      ? params.filename + (params.filename.endsWith(".md") ? "": ".excalidraw.md")
      : getDrawingFilename(this.plugin.settings);
    const foldername = params?.foldername ? params.foldername : this.plugin.settings.folder;
    const initData = this.plugin.settings.compatibilityMode
      ? JSON.stringify(scene, null, "\t")
      : frontmatter + generateMD() +
        getMarkdownDrawingSection(JSON.stringify(scene, null, "\t"),this.plugin.settings.compress)

    if(params.silent) {
      return (await this.plugin.createDrawing(filename,foldername,initData)).path;
    } else {
      return this.plugin.createAndOpenDrawing(
        filename,
        (params?.onNewPane ? params.onNewPane : false)?"new-pane":"active-pane",
        foldername,
        initData
      );
    }
  };

  /**
   * Returns the dimensions of a standard page size in pixels.
   *
   * @param {PageSize} pageSize - The standard page size. Possible values are "A0", "A1", "A2", "A3", "A4", "A5", "Letter", "Legal", "Tabloid".
   * @param {PageOrientation} orientation - The orientation of the page. Possible values are "portrait" and "landscape".
   * @returns {PageDimensions} - An object containing the width and height of the page in pixels.
   *
   * @typedef {Object} PageDimensions
   * @property {number} width - The width of the page in pixels.
   * @property {number} height - The height of the page in pixels.
   *
   * @example
   * const dimensions = getPageDimensions("A4", "portrait");
   * console.log(dimensions); // { width: 794.56, height: 1122.56 }
  */
  getPagePDFDimensions(pageSize: PageSize, orientation: PageOrientation): PageDimensions {
    return getPageDimensions(pageSize, orientation);
  }

  /**
   * Creates a PDF from the provided SVG elements with specified scaling and page properties.
   *
   * @param {Object} params - The parameters for creating the PDF.
   * @param {SVGSVGElement[]} params.SVG - An array of SVG elements to be included in the PDF.
   * @param {PDFExportScale} [params.scale={ fitToPage: 1, zoom: 1 }] - The scaling options for the SVG elements.
   * @param {PDFPageProperties} [params.pageProps] - The properties for the PDF pages.
   * @returns {Promise<ArrayBuffer>} - A promise that resolves to an ArrayBuffer containing the PDF data.
   *
   * @example
   * const pdfData = await createToPDF({
   *   SVG: [svgElement1, svgElement2],
   *   scale: { fitToPage: 1 },
   *   pageProps: {
   *     dimensions: { width: 794.56, height: 1122.56 },
   *     backgroundColor: "#ffffff",
   *     margin: { left: 20, right: 20, top: 20, bottom: 20 },
   *     alignment: "center",
   *   }
   *   filename: "example.pdf",
   * });
  */
  async createPDF({
    SVG,
    scale = { fitToPage: 1, zoom: 1 },
    pageProps,
    filename,
  }: {
    SVG: SVGSVGElement[];
    scale?: PDFExportScale;
    pageProps?: PDFPageProperties;
    filename: string;
  }): Promise<void> {
    if(!pageProps) {
      pageProps = {
        alignment: this.plugin.settings.pdfSettings.alignment,
        margin: getMarginValue(this.plugin.settings.pdfSettings.margin),
      };
    }

    if(!pageProps.dimensions) {
      pageProps.dimensions = getPageDimensions(
        this.plugin.settings.pdfSettings.pageSize,
        this.plugin.settings.pdfSettings.pageOrientation
      )
    }
    if(!pageProps.backgroundColor) {
      pageProps.backgroundColor = "#ffffff";
    }
    
    await exportToPDF({SVG, scale, pageProps, filename});
  }

 /**
  * Creates an SVG representation of the current view.
  *
  * @param {Object} options - The options for creating the SVG.
  * @param {boolean} [options.withBackground=true] - Whether to include the background in the SVG.
  * @param {"light" | "dark"} [options.theme] - The theme to use for the SVG.
  * @param {FrameRenderingOptions} [options.frameRendering={enabled: true, name: true, outline: true, clip: true}] - The frame rendering options.
  * @param {number} [options.padding] - The padding to apply around the SVG.
  * @param {boolean} [options.selectedOnly=false] - Whether to include only the selected elements in the SVG.
  * @param {boolean} [options.skipInliningFonts=false] - Whether to skip inlining fonts in the SVG.
  * @param {boolean} [options.embedScene=false] - Whether to embed the scene in the SVG.
  * @returns {Promise<SVGSVGElement>} A promise that resolves to the SVG element.
 */
  async createViewSVG({
    withBackground = true,
    theme,
    frameRendering = {enabled: true, name: true, outline: true, clip: true},
    padding,
    selectedOnly = false,
    skipInliningFonts = false,
    embedScene = false,
  } : {
    withBackground?: boolean,
    theme?: "light" | "dark",
    frameRendering?: FrameRenderingOptions,
    padding?: number,
    selectedOnly?: boolean,
    skipInliningFonts?: boolean,
    embedScene?: boolean,
  }): Promise<SVGSVGElement> {
    if(!this.targetView || !this.targetView.file || !this.targetView._loaded) {
      console.log("No view loaded");
      return;
    }
    const view = this.targetView;
    const scene = this.targetView.getScene(selectedOnly);

    const exportSettings: ExportSettings = {
      withBackground: view.getViewExportWithBackground(withBackground),
      withTheme: true,
      isMask: isMaskFile(this.plugin, view.file),
      skipInliningFonts,
      frameRendering,
    };

    return await getSVG(
      {
        ...scene,
        ...{
          appState: {
            ...scene.appState,
            theme: view.getViewExportTheme(theme),
            exportEmbedScene: view.getViewExportEmbedScene(embedScene),
          },
        },
      },
      exportSettings,
      view.getViewExportPadding(padding),
      view.file,
    );
  }

  /**
   * Creates an SVG image from the ExcalidrawAutomate elements and the template provided.
   * @param {string} [templatePath] - The template path to use for the SVG.
   * @param {boolean} [embedFont=false] - Whether to embed the font in the SVG.
   * @param {ExportSettings} [exportSettings] - Export settings for the SVG.
   * @param {EmbeddedFilesLoader} [loader] - Embedded files loader for the SVG.
   * @param {string} [theme] - The theme to use for the SVG.
   * @param {number} [padding] - The padding to use for the SVG.
   * @returns {Promise<SVGSVGElement>} Promise resolving to the created SVG element.
   */
  async createSVG(
    templatePath?: string,
    embedFont: boolean = false,
    exportSettings?: ExportSettings, 
    loader?: EmbeddedFilesLoader,
    theme?: string,
    padding?: number,
  ): Promise<SVGSVGElement> {
    if (!theme) {
      theme = this.plugin.settings.previewMatchObsidianTheme
        ? isObsidianThemeDark()
          ? "dark"
          : "light"
        : !this.plugin.settings.exportWithTheme
        ? "light"
        : undefined;
    }
    if (theme && !exportSettings) {
      exportSettings = {
        withBackground: this.plugin.settings.exportWithBackground,
        withTheme: true,
        isMask: false,
      };
    }
    if (!loader) {
      loader = new EmbeddedFilesLoader(
        this.plugin,
        theme ? theme === "dark" : undefined,
      );
    }

    return await createSVG(
      templatePath,
      embedFont,
      exportSettings,
      loader,
      theme,
      this.canvas.theme,
      this.canvas.viewBackgroundColor,
      this.getElements(),
      this.plugin,
      0,
      padding,
      this.imagesDict
    );
  };

  
  /**
   * Creates a PNG image from the ExcalidrawAutomate elements and the template provided.
   * @param {string} [templatePath] - The template path to use for the PNG.
   * @param {number} [scale=1] - The scale factor for the PNG.
   * @param {ExportSettings} [exportSettings] - Export settings for the PNG.
   * @param {EmbeddedFilesLoader} [loader] - Embedded files loader for the PNG.
   * @param {string} [theme] - The theme to use for the PNG.
   * @param {number} [padding] - The padding to use for the PNG.
   * @returns {Promise<any>} Promise resolving to the created PNG image.
   */
  async createPNG(
    templatePath?: string,
    scale: number = 1,
    exportSettings?: ExportSettings,
    loader?: EmbeddedFilesLoader,
    theme?: string,
    padding?: number,
  ): Promise<any> {
    if (!theme) {
      theme = this.plugin.settings.previewMatchObsidianTheme
        ? isObsidianThemeDark()
          ? "dark"
          : "light"
        : !this.plugin.settings.exportWithTheme
        ? "light"
        : undefined;
    }
    if (theme && !exportSettings) {
      exportSettings = {
        withBackground: this.plugin.settings.exportWithBackground,
        withTheme: true,
        isMask: false,
      };
    }
    if (!loader) {
      loader = new EmbeddedFilesLoader(
        this.plugin,
        theme ? theme === "dark" : undefined,
      );
    }

    return await createPNG(
      templatePath,
      scale,
      exportSettings,
      loader,
      theme,
      this.canvas.theme,
      this.canvas.viewBackgroundColor,
      this.getElements(),
      this.plugin,
      0,
      padding,
      this.imagesDict,
    );
  };

  /**
   * Wrapper for createPNG() that returns a base64 encoded string designed to support LLM workflows.
   * @param {string} [templatePath] - The template path to use for the PNG.
   * @param {number} [scale=1] - The scale factor for the PNG.
   * @param {ExportSettings} [exportSettings] - Export settings for the PNG.
   * @param {EmbeddedFilesLoader} [loader] - Embedded files loader for the PNG.
   * @param {string} [theme] - The theme to use for the PNG.
   * @param {number} [padding] - The padding to use for the PNG.
   * @returns {Promise<string>} Promise resolving to the base64 encoded PNG string.
   */
  async createPNGBase64(
    templatePath?: string,
    scale: number = 1,
    exportSettings?: ExportSettings,
    loader?: EmbeddedFilesLoader,
    theme?: string,
    padding?: number,
  ): Promise<string> {
    const png = await this.createPNG(templatePath,scale,exportSettings,loader,theme,padding);
    return `data:image/png;base64,${await blobToBase64(png)}`
  }

  /**
   * Wraps text to a specified line length.
   * @param {string} text - The text to wrap.
   * @param {number} lineLen - The maximum line length.
   * @returns {string} The wrapped text.
   */
  wrapText(text: string, lineLen: number): string {
    return wrapTextAtCharLength(text, lineLen, this.plugin.settings.forceWrap);
  };

  /**
   * Utility function. Returns an element object using style settings and provided parameters.
   * @param {string} id - The element ID.
   * @param {string} eltype - The element type.
   * @param {number} x - The x-coordinate of the element.
   * @param {number} y - The y-coordinate of the element.
   * @param {number} w - The width of the element.
   * @param {number} h - The height of the element.
   * @param {string | null} [link=null] - The link associated with the element.
   * @param {[number, number]} [scale] - The scale of the element.
   * @returns {Object} The element object.
   */
  private boxedElement(
    id: string,
    eltype: any,
    x: number,
    y: number,
    w: number,
    h: number,
    link: string | null = null,
    scale?: [number, number],
  ) {
    return {
      id,
      type: eltype,
      x,
      y,
      width: w,
      height: h,
      angle: this.style.angle,
      strokeColor: this.style.strokeColor,
      backgroundColor: this.style.backgroundColor,
      fillStyle: this.style.fillStyle,
      strokeWidth: this.style.strokeWidth,
      strokeStyle: this.style.strokeStyle,
      roughness: this.style.roughness,
      opacity: this.style.opacity,
      roundness: this.style.strokeSharpness
        ? (this.style.strokeSharpness === "round"
          ? {type: ROUNDNESS.ADAPTIVE_RADIUS}
          : null)
        : this.style.roundness,
      seed: Math.floor(Math.random() * 100000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 1000000000),
      updated: Date.now(),
      isDeleted: false,
      groupIds: [] as any,
      boundElements: [] as any,
      link,
      locked: false,
      ...scale ? {scale} : {},
    };
  }

  /**
   * Deprecated. Use addEmbeddable() instead.
   * Retained for backward compatibility.
   * @param {number} topX - The x-coordinate of the top-left corner.
   * @param {number} topY - The y-coordinate of the top-left corner.
   * @param {number} width - The width of the iframe.
   * @param {number} height - The height of the iframe.
   * @param {string} [url] - The URL of the iframe.
   * @param {TFile} [file] - The file associated with the iframe.
   * @returns {string} The ID of the added iframe element.
   */
  addIFrame(topX: number, topY: number, width: number, height: number, url?: string, file?: TFile): string {
    return this.addEmbeddable(topX, topY, width, height, url, file);
  }

  /**
   * Adds an embeddable element to the ExcalidrawAutomate instance.
   * @param {number} topX - The x-coordinate of the top-left corner.
   * @param {number} topY - The y-coordinate of the top-left corner.
   * @param {number} width - The width of the embeddable element.
   * @param {number} height - The height of the embeddable element.
   * @param {string} [url] - The URL of the embeddable element.
   * @param {TFile} [file] - The file associated with the embeddable element.
   * @param {EmbeddableMDCustomProps} [embeddableCustomData] - Custom properties for the embeddable element.
   * @returns {string} The ID of the added embeddable element.
   */
  public addEmbeddable(
    topX: number,
    topY: number,
    width: number,
    height: number,
    url?: string,
    file?: TFile,
    embeddableCustomData?: EmbeddableMDCustomProps,
  ): string {
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "addEmbeddable()");
      return null;
    }

    if (!url && !file) {
      errorMessage("Either the url or the file must be set. If both are provided the URL takes precedence", "addEmbeddable()");
      return null;
    }

    const id = nanoid();
    this.elementsDict[id] = this.boxedElement(
      id,
      "embeddable",
      topX,
      topY,
      width,
      height,
      url ? url : file ? `[[${
        this.plugin.app.metadataCache.fileToLinktext(
          file,
          this.targetView.file.path,
          false, //file.extension === "md", //changed this to false because embedable link navigation in ExcaliBrain
        )
      }]]` : "",
      [1,1],
    );
    this.elementsDict[id].customData = {mdProps: embeddableCustomData ?? this.plugin.settings.embeddableMarkdownDefaults};
    return id;
  };

  /**
   * Add elements to frame.
   * @param {string} frameId - The ID of the frame element.
   * @param {string[]} elementIDs - Array of element IDs to add to the frame.
   */
  addElementsToFrame(frameId: string, elementIDs: string[]):void {
    if(!this.getElement(frameId)) return;
    elementIDs.forEach(elID => {
      const el = this.getElement(elID);
      if(el) {
        el.frameId = frameId;
      }
    });
  }

  /**
   * Adds a frame element to the ExcalidrawAutomate instance.
   * @param {number} topX - The x-coordinate of the top-left corner.
   * @param {number} topY - The y-coordinate of the top-left corner.
   * @param {number} width - The width of the frame.
   * @param {number} height - The height of the frame.
   * @param {string} [name] - The display name of the frame.
   * @returns {string} The ID of the added frame element.
   */
  addFrame(topX: number, topY: number, width: number, height: number, name?: string): string {
    const id = this.addRect(topX, topY, width, height);
    const frame = this.getElement(id) as Mutable<ExcalidrawFrameElement>;
    frame.type = "frame";
    frame.backgroundColor = "transparent";
    frame.strokeColor = "#000";
    frame.strokeStyle = "solid";
    frame.strokeWidth = 2;
    frame.roughness = 0;
    frame.roundness = null;
    if(name) frame.name = name;
    return id;
  }

  /**
   * Adds a rectangle element to the ExcalidrawAutomate instance.
   * @param {number} topX - The x-coordinate of the top-left corner.
   * @param {number} topY - The y-coordinate of the top-left corner.
   * @param {number} width - The width of the rectangle.
   * @param {number} height - The height of the rectangle.
   * @param {string} [id] - The ID of the rectangle element.
   * @returns {string} The ID of the added rectangle element.
   */
  addRect(topX: number, topY: number, width: number, height: number, id?: string): string {
    if(!id) id = nanoid();
    this.elementsDict[id] = this.boxedElement(
      id,
      "rectangle",
      topX,
      topY,
      width,
      height,
    );
    return id;
  };

  /**
   * Adds a diamond element to the ExcalidrawAutomate instance.
   * @param {number} topX - The x-coordinate of the top-left corner.
   * @param {number} topY - The y-coordinate of the top-left corner.
   * @param {number} width - The width of the diamond.
   * @param {number} height - The height of the diamond.
   * @param {string} [id] - The ID of the diamond element.
   * @returns {string} The ID of the added diamond element.
   */
  addDiamond(
    topX: number,
    topY: number,
    width: number,
    height: number,
    id?: string,
  ): string {
    if(!id) id = nanoid();
    this.elementsDict[id] = this.boxedElement(
      id,
      "diamond",
      topX,
      topY,
      width,
      height,
    );
    return id;
  };

  /**
   * Adds an ellipse element to the ExcalidrawAutomate instance.
   * @param {number} topX - The x-coordinate of the top-left corner.
   * @param {number} topY - The y-coordinate of the top-left corner.
   * @param {number} width - The width of the ellipse.
   * @param {number} height - The height of the ellipse.
   * @param {string} [id] - The ID of the ellipse element.
   * @returns {string} The ID of the added ellipse element.
   */
  addEllipse(
    topX: number,
    topY: number,
    width: number,
    height: number,
    id?: string,
  ): string {
    if(!id) id = nanoid();
    this.elementsDict[id] = this.boxedElement(
      id,
      "ellipse",
      topX,
      topY,
      width,
      height,
    );
    return id;
  };

  /**
   * Adds a blob element to the ExcalidrawAutomate instance.
   * @param {number} topX - The x-coordinate of the top-left corner.
   * @param {number} topY - The y-coordinate of the top-left corner.
   * @param {number} width - The width of the blob.
   * @param {number} height - The height of the blob.
   * @param {string} [id] - The ID of the blob element.
   * @returns {string} The ID of the added blob element.
   */
  addBlob(topX: number, topY: number, width: number, height: number, id?: string): string {
    const b = height * 0.5; //minor axis of the ellipsis
    const a = width * 0.5; //major axis of the ellipsis
    const sx = a / 9;
    const sy = b * 0.8;
    const step = 6;
    const p: any = [];
    const pushPoint = (i: number, dir: number) => {
      const x = i + Math.random() * sx - sx / 2;
      p.push([
        x + Math.random() * sx - sx / 2 + ((i % 2) * sx) / 6 + topX,
        dir * Math.sqrt(b * b * (1 - (x * x) / (a * a))) +
          Math.random() * sy -
          sy / 2 +
          ((i % 2) * sy) / 6 +
          topY,
      ]);
    };
    let i: number;
    for (i = -a + sx / 2; i <= a - sx / 2; i += a / step) {
      pushPoint(i, 1);
    }
    for (i = a - sx / 2; i >= -a + sx / 2; i -= a / step) {
      pushPoint(i, -1);
    }
    p.push(p[0]);
    const scale = (p: [[x: number, y: number]]): [[x: number, y: number]] => {
      const box = getLineBox(p);
      const scaleX = width / box.w;
      const scaleY = height / box.h;
      let i;
      for (i = 0; i < p.length; i++) {
        let [x, y] = p[i];
        x = (x - box.x) * scaleX + box.x;
        y = (y - box.y) * scaleY + box.y;
        p[i] = [x, y];
      }
      return p;
    };
    id = this.addLine(scale(p), id);
    this.elementsDict[id] = repositionElementsToCursor(
      [this.getElement(id)],
      { x: topX, y: topY },
      false,
    )[0];
    return id;
  };

  /**
   * Refreshes the size of a text element to fit its contents.
   * @param {string} id - The ID of the text element.
   */
  public refreshTextElementSize(id: string) {
    const element = this.getElement(id);
    if (element.type !== "text") {
      return;
    }
    const { w, h } = _measureText(
      element.text,
      element.fontSize,
      element.fontFamily,
      getLineHeight(element.fontFamily)
    );
    element.width = w;
    element.height = h;
  }

  /**
   * Adds a text element to the ExcalidrawAutomate instance.
   * @param {number} topX - The x-coordinate of the top-left corner.
   * @param {number} topY - The y-coordinate of the top-left corner.
   * @param {string} text - The text content of the element.
   * @param {Object} [formatting] - Formatting options for the text element.
   * @param {boolean} [formatting.autoResize=true] - Whether to auto-resize the text element.
   * @param {number} [formatting.wrapAt] - The character length to wrap the text at.
   * @param {number} [formatting.width] - The width of the text element.
   * @param {number} [formatting.height] - The height of the text element.
   * @param {"left" | "center" | "right"} [formatting.textAlign] - The text alignment.
   * @param {boolean | "box" | "blob" | "ellipse" | "diamond"} [formatting.box] - Whether to add a box around the text.
   * @param {number} [formatting.boxPadding] - The padding inside the box.
   * @param {string} [formatting.boxStrokeColor] - The stroke color of the box.
   * @param {"top" | "middle" | "bottom"} [formatting.textVerticalAlign] - The vertical alignment of the text.
   * @param {string} [id] - The ID of the text element.
   * @returns {string} The ID of the added text element.
   */
  addText(
    topX: number,
    topY: number,
    text: string,
    formatting?: {
      autoResize?: boolean; //Default is true. Setting this to false will wrap the text in the text element without the need for the containser. If set to false, you must set a width value as well.
      wrapAt?: number; //wrapAt is ignored if autoResize is set to false (and width is provided)
      width?: number;
      height?: number;
      textAlign?: "left" | "center" | "right";
      box?: boolean | "box" | "blob" | "ellipse" | "diamond";
      boxPadding?: number;
      boxStrokeColor?: string;
      textVerticalAlign?: "top" | "middle" | "bottom";
    },
    id?: string,
  ): string {
    id = id ?? nanoid();
    const originalText = text;
    const autoresize = ((typeof formatting?.width === "undefined") || formatting?.box)
      ? true
      : (formatting?.autoResize ?? true)
    text = (formatting?.wrapAt && autoresize) ? this.wrapText(text, formatting.wrapAt) : text;

    const { w, h } = _measureText(
      text,
      this.style.fontSize,
      this.style.fontFamily,
      getLineHeight(this.style.fontFamily)
    );
    const width = formatting?.width ? formatting.width : w;
    const height = formatting?.height ? formatting.height : h;

    let boxId: string = null;
    const strokeColor = this.style.strokeColor;
    this.style.strokeColor = formatting?.boxStrokeColor ?? strokeColor;
    const boxPadding = formatting?.boxPadding ?? 30;
    if (formatting?.box) {
      switch (formatting.box) {
        case "ellipse":
          boxId = this.addEllipse(
            topX - boxPadding,
            topY - boxPadding,
            width + 2 * boxPadding,
            height + 2 * boxPadding,
          );
          break;
        case "diamond":
          boxId = this.addDiamond(
            topX - boxPadding,
            topY - boxPadding,
            width + 2 * boxPadding,
            height + 2 * boxPadding,
          );
          break;
        case "blob":
          boxId = this.addBlob(
            topX - boxPadding,
            topY - boxPadding,
            width + 2 * boxPadding,
            height + 2 * boxPadding,
          );
          break;
        default:
          boxId = this.addRect(
            topX - boxPadding,
            topY - boxPadding,
            width + 2 * boxPadding,
            height + 2 * boxPadding,
          );
      }
    }
    this.style.strokeColor = strokeColor;
    const isContainerBound = boxId && formatting.box !== "blob";
    this.elementsDict[id] = {
      text,
      fontSize: this.style.fontSize,
      fontFamily: this.style.fontFamily,
      textAlign: formatting?.textAlign
        ? formatting.textAlign
        : this.style.textAlign ?? "left",
      verticalAlign: formatting?.textVerticalAlign ?? this.style.verticalAlign,
      ...this.boxedElement(id, "text", topX, topY, width, height),
      containerId: isContainerBound ? boxId : null,
      originalText: isContainerBound ? originalText : text,
      rawText: isContainerBound ? originalText : text,
      lineHeight: getLineHeight(this.style.fontFamily),
      autoResize: formatting?.box ? true : (formatting?.autoResize ?? true),
    };
    if (boxId && formatting?.box === "blob") {
      this.addToGroup([id, boxId]);
    }
    if (isContainerBound) {
      const box = this.elementsDict[boxId];
      if (!box.boundElements) {
        box.boundElements = [];
      }
      box.boundElements.push({ type: "text", id });
    }
    const textElement = this.getElement(id) as Mutable<ExcalidrawTextElement>;
    const container = (boxId && formatting.box !== "blob") ? this.getElement(boxId) as Mutable<ExcalidrawTextContainer>: undefined;
    const dimensions = refreshTextDimensions(
      textElement,
      container,
      arrayToMap(this.getElements()),
      originalText,
    );
    if(dimensions) {
      textElement.width = dimensions.width;
      textElement.height = dimensions.height;
      textElement.x = dimensions.x;
      textElement.y = dimensions.y;
      textElement.text = dimensions.text;
      if(container) {
        container.width = dimensions.width + 2 * boxPadding;
        container.height = dimensions.height + 2 * boxPadding;
      }
    }
    return boxId ?? id;
  };

  /**
   * Adds a line element to the ExcalidrawAutomate instance.
   * @param {[[x: number, y: number]]} points - Array of points defining the line.
   * @param {string} [id] - The ID of the line element.
   * @returns {string} The ID of the added line element.
   */
  addLine(points: [[x: number, y: number]], id?: string): string {
    const box = getLineBox(points);
    id = id ?? nanoid();
    this.elementsDict[id] = {
      points: normalizeLinePoints(points),
      lastCommittedPoint: null,
      startBinding: null,
      endBinding: null,
      startArrowhead: null,
      endArrowhead: null,
      ...this.boxedElement(id, "line", points[0][0], points[0][1], box.w, box.h),
    };
    return id;
  };

  /**
   * Adds an arrow element to the ExcalidrawAutomate instance.
   * @param {[x: number, y: number][]} points - Array of points defining the arrow.
   * @param {Object} [formatting] - Formatting options for the arrow element.
   * @param {"arrow"|"bar"|"circle"|"circle_outline"|"triangle"|"triangle_outline"|"diamond"|"diamond_outline"|null} [formatting.startArrowHead] - The start arrowhead type.
   * @param {"arrow"|"bar"|"circle"|"circle_outline"|"triangle"|"triangle_outline"|"diamond"|"diamond_outline"|null} [formatting.endArrowHead] - The end arrowhead type.
   * @param {string} [formatting.startObjectId] - The ID of the start object.
   * @param {string} [formatting.endObjectId] - The ID of the end object.
   * @param {string} [id] - The ID of the arrow element.
   * @returns {string} The ID of the added arrow element.
   */
  addArrow(
    points: [x: number, y: number][],
    formatting?: {
      startArrowHead?: "arrow"|"bar"|"circle"|"circle_outline"|"triangle"|"triangle_outline"|"diamond"|"diamond_outline"|null;
      endArrowHead?: "arrow"|"bar"|"circle"|"circle_outline"|"triangle"|"triangle_outline"|"diamond"|"diamond_outline"|null;
      startObjectId?: string;
      endObjectId?: string;
    },
    id?: string,
  ): string {
    const box = getLineBox(points);
    id = id ?? nanoid();
    const startPoint = points[0] as GlobalPoint;
    const endPoint = points[points.length - 1] as GlobalPoint;
    this.elementsDict[id] = {
      points: normalizeLinePoints(points),
      lastCommittedPoint: null,
      startBinding: {
        elementId: formatting?.startObjectId,
        focus: formatting?.startObjectId
          ? determineFocusDistance(
              this.getElement(formatting?.startObjectId) as ExcalidrawBindableElement,
              endPoint,
              startPoint,
            )
          : 0.1,
        gap: GAP,
      },
      endBinding: {
        elementId: formatting?.endObjectId,
        focus: formatting?.endObjectId
          ? determineFocusDistance(
              this.getElement(formatting?.endObjectId) as ExcalidrawBindableElement,
              startPoint,
              endPoint,
            )
          : 0.1,
        gap: GAP,
      },
      //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/388
      startArrowhead:
        typeof formatting?.startArrowHead !== "undefined"
          ? formatting.startArrowHead
          : this.style.startArrowHead,
      endArrowhead:
        typeof formatting?.endArrowHead !== "undefined"
          ? formatting.endArrowHead
          : this.style.endArrowHead,
      ...this.boxedElement(id, "arrow", points[0][0], points[0][1], box.w, box.h),
    };
    if (formatting?.startObjectId) {
      if (!this.elementsDict[formatting.startObjectId].boundElements) {
        this.elementsDict[formatting.startObjectId].boundElements = [];
      }
      this.elementsDict[formatting.startObjectId].boundElements.push({
        type: "arrow",
        id,
      });
    }
    if (formatting?.endObjectId) {
      if (!this.elementsDict[formatting.endObjectId].boundElements) {
        this.elementsDict[formatting.endObjectId].boundElements = [];
      }
      this.elementsDict[formatting.endObjectId].boundElements.push({
        type: "arrow",
        id,
      });
    }
    return id;
  };

  /**
   * Adds a mermaid diagram to ExcalidrawAutomate elements.
   * @param {string} diagram - The mermaid diagram string.
   * @param {boolean} [groupElements=true] - Whether to group the elements.
   * @returns {Promise<string[]|string>} Promise resolving to the IDs of the created elements or an error message.
   */
  async addMermaid(
    diagram: string,
    groupElements: boolean = true,
  ): Promise<string[]|string> {
    const result = await mermaidToExcalidraw(
      diagram, {
        themeVariables: {fontSize: `${this.style.fontSize}`},
        flowchart: {curve: this.style.roundness===null ? "linear" : "basis"},
      }
    );
    const ids:string[] = [];
    if(!result) return null;
    if(result?.error) return result.error;

    if(result?.elements) {
      result.elements.forEach(el=>{
        ids.push(el.id);
        this.elementsDict[el.id] = el;
      })
    }

    if(result?.files) {
      for (const key in result.files) {
        this.imagesDict[key as FileId] = {
          ...result.files[key],
          created: Date.now(),
          isHyperLink: false,
          hyperlink: null,
          file: null,
          hasSVGwithBitmap: false,
          latex: null,
        }
      } 
    }

    if(groupElements && result?.elements && ids.length > 1) {
      this.addToGroup(ids);
    }
    return ids;
  }

  /**
   * Adds an image element to the ExcalidrawAutomate instance.
   * @param {number | AddImageOptions} topXOrOpts - The x-coordinate of the top-left corner or an options object.
   * @param {number} topY - The y-coordinate of the top-left corner.
   * @param {TFile | string} imageFile - The image file or URL.
   * @param {boolean} [scale=true] - Whether to scale the image to MAX_IMAGE_SIZE.
   * @param {boolean} [anchor=true] - Whether to anchor the image at 100% size.
   * @returns {Promise<string>} Promise resolving to the ID of the added image element.
   */
  async addImage(
    topXOrOpts: number | AddImageOptions,
    topY: number,
    imageFile: TFile | string, //string may also be an Obsidian filepath with a reference such as folder/path/my.pdf#page=2
    scale: boolean = true, //default is true which will scale the image to MAX_IMAGE_SIZE, false will insert image at 100% of its size
    anchor: boolean = true, //only has effect if scale is false. If anchor is true the image path will include |100%, if false the image will be inserted at 100%, but if resized by the user it won't pop back to 100% the next time Excalidraw is opened.
  ): Promise<string> {

    let colorMap: ColorMap;
    let topX: number;
    if(typeof topXOrOpts === "number") {
      topX = topXOrOpts;
    } else {
      topY = topXOrOpts.topY;
      topX = topXOrOpts.topX;
      imageFile = topXOrOpts.imageFile;
      scale = topXOrOpts.scale ?? true;
      anchor = topXOrOpts.anchor ?? true;
      colorMap = topXOrOpts.colorMap;
    }

    const id = nanoid();
    const loader = new EmbeddedFilesLoader(
      this.plugin,
      this.canvas.theme === "dark",
    );
    const image = (typeof imageFile === "string")
      ? await loader.getObsidianImage(new EmbeddedFile(this.plugin, "", imageFile),0)
      : await loader.getObsidianImage(imageFile,0);
      
    if (!image) {
      return null;
    }
    const fileId = typeof imageFile === "string"
      ? image.fileId
      : imageFile.extension === "md" || imageFile.extension.toLowerCase() === "pdf" ? fileid() as FileId : image.fileId;
    this.imagesDict[fileId] = {
      mimeType: image.mimeType,
      id: fileId,
      dataURL: image.dataURL,
      created: image.created,
      isHyperLink: typeof imageFile === "string",
      hyperlink: typeof imageFile === "string"
        ? imageFile
        : null,
      file: typeof imageFile === "string"
        ? null
        : imageFile.path + (scale || !anchor ? "":"|100%"),
      hasSVGwithBitmap: image.hasSVGwithBitmap,
      latex: null,
      size: { //must have the natural size here (e.g. for PDF cropping)
        height: image.size.height,
        width: image.size.width,
      },
      colorMap,
      pdfPageViewProps: image.pdfPageViewProps,
    };
    if (scale && (Math.max(image.size.width, image.size.height) > MAX_IMAGE_SIZE)) {
      const scale =
        MAX_IMAGE_SIZE / Math.max(image.size.width, image.size.height);
      image.size.width = scale * image.size.width;
      image.size.height = scale * image.size.height;
    }
    this.elementsDict[id] = this.boxedElement(
      id,
      "image",
      topX,
      topY,
      image.size.width,
      image.size.height,
    );
    this.elementsDict[id].fileId = fileId;
    this.elementsDict[id].scale = [1, 1];
    if(!scale && anchor) {
      this.elementsDict[id].customData = {isAnchored: true}
    };
    return id;
  };

  /**
   * Adds a LaTeX equation as an image element to the ExcalidrawAutomate instance.
   * @param {number} topX - The x-coordinate of the top-left corner.
   * @param {number} topY - The y-coordinate of the top-left corner.
   * @param {string} tex - The LaTeX equation string.
   * @returns {Promise<string>} Promise resolving to the ID of the added LaTeX image element.
   */
  async addLaTex(topX: number, topY: number, tex: string): Promise<string> {
    const id = nanoid();
    const image = await tex2dataURL(tex, 4, this.plugin);
    if (!image) {
      return null;
    }
    this.imagesDict[image.fileId] = {
      mimeType: image.mimeType,
      id: image.fileId,
      dataURL: image.dataURL,
      created: image.created,
      file: null,
      hasSVGwithBitmap: false,
      latex: tex,
    };
    this.elementsDict[id] = this.boxedElement(
      id,
      "image",
      topX,
      topY,
      image.size.width,
      image.size.height,
    );
    this.elementsDict[id].fileId = image.fileId;
    this.elementsDict[id].scale = [1, 1];
    return id;
  };

  /**
   * Returns the base64 dataURL of the LaTeX equation rendered as an SVG.
   * @param {string} tex - The LaTeX equation string.
   * @param {number} [scale=4] - The scale factor for the image.
   * @returns {Promise<{mimeType: MimeType; fileId: FileId; dataURL: DataURL; created: number; size: { height: number; width: number };}>} Promise resolving to the LaTeX image data.
   */
  async tex2dataURL(
    tex: string,
    scale: number = 4 // Default scale value, adjust as needed
  ): Promise<{
    mimeType: MimeType;
    fileId: FileId;
    dataURL: DataURL;
    created: number;
    size: { height: number; width: number };
  }> {
    return await tex2dataURL(tex,scale, this.plugin);
  };

  /**
   * Connects two objects with an arrow.
   * @param {string} objectA - The ID of the first object.
   * @param {ConnectionPoint | null} connectionA - The connection point on the first object.
   * @param {string} objectB - The ID of the second object.
   * @param {ConnectionPoint | null} connectionB - The connection point on the second object.
   * @param {Object} [formatting] - Formatting options for the arrow.
   * @param {number} [formatting.numberOfPoints=0] - The number of points on the arrow.
   * @param {"arrow"|"bar"|"circle"|"circle_outline"|"triangle"|"triangle_outline"|"diamond"|"diamond_outline"|null} [formatting.startArrowHead] - The start arrowhead type.
   * @param {"arrow"|"bar"|"circle"|"circle_outline"|"triangle"|"triangle_outline"|"diamond"|"diamond_outline"|null} [formatting.endArrowHead] - The end arrowhead type.
   * @param {number} [formatting.padding=10] - The padding around the arrow.
   * @returns {string} The ID of the added arrow element.
   */
  connectObjects(
    objectA: string,
    connectionA: ConnectionPoint | null,
    objectB: string,
    connectionB: ConnectionPoint | null,
    formatting?: {
      numberOfPoints?: number;
      startArrowHead?: "arrow"|"bar"|"circle"|"circle_outline"|"triangle"|"triangle_outline"|"diamond"|"diamond_outline"|null;
      endArrowHead?: "arrow"|"bar"|"circle"|"circle_outline"|"triangle"|"triangle_outline"|"diamond"|"diamond_outline"|null;
      padding?: number;
    },
  ): string {
    if (!(this.elementsDict[objectA] && this.elementsDict[objectB])) {
      return;
    }

    if (
      ["line", "arrow", "freedraw"].includes(
        this.elementsDict[objectA].type,
      ) ||
      ["line", "arrow", "freedraw"].includes(this.elementsDict[objectB].type)
    ) {
      return;
    }

    const padding = formatting?.padding ? formatting.padding : 10;
    const numberOfPoints = formatting?.numberOfPoints
      ? formatting.numberOfPoints
      : 0;
    const getSidePoints = (side: string, el: any) => {
      switch (side) {
        case "bottom":
          return [(el.x + (el.x + el.width)) / 2, el.y + el.height + padding];
        case "left":
          return [el.x - padding, (el.y + (el.y + el.height)) / 2];
        case "right":
          return [el.x + el.width + padding, (el.y + (el.y + el.height)) / 2];
        default:
          //"top"
          return [(el.x + (el.x + el.width)) / 2, el.y - padding];
      }
    };
    let aX;
    let aY;
    let bX;
    let bY;
    const elA = this.elementsDict[objectA];
    const elB = this.elementsDict[objectB];
    if (!connectionA || !connectionB) {
      const aCenterX = elA.x + elA.width / 2;
      const bCenterX = elB.x + elB.width / 2;
      const aCenterY = elA.y + elA.height / 2;
      const bCenterY = elB.y + elB.height / 2;
      if (!connectionA) {
        const intersect = intersectElementWithLine(
          elA,
          [bCenterX, bCenterY] as GlobalPoint,
          [aCenterX, aCenterY] as GlobalPoint,
          GAP,
        );
        if (intersect.length === 0) {
          [aX, aY] = [aCenterX, aCenterY];
        } else {
          [aX, aY] = intersect[0];
        }
      }

      if (!connectionB) {
        const intersect = intersectElementWithLine(
          elB,
          [aCenterX, aCenterY] as GlobalPoint,
          [bCenterX, bCenterY] as GlobalPoint,
          GAP,
        );
        if (intersect.length === 0) {
          [bX, bY] = [bCenterX, bCenterY];
        } else {
          [bX, bY] = intersect[0];
        }
      }
    }
    if (connectionA) {
      [aX, aY] = getSidePoints(connectionA, this.elementsDict[objectA]);
    }
    if (connectionB) {
      [bX, bY] = getSidePoints(connectionB, this.elementsDict[objectB]);
    }
    const numAP = numberOfPoints + 2; //number of break points plus the beginning and the end
    const points:[x:number, y:number][] = [];
    for (let i = 0; i < numAP; i++) {
      points.push([
        aX + (i * (bX - aX)) / (numAP - 1),
        aY + (i * (bY - aY)) / (numAP - 1),
      ]);
    }
    return this.addArrow(points, {
      startArrowHead: formatting?.startArrowHead,
      endArrowHead: formatting?.endArrowHead,
      startObjectId: objectA,
      endObjectId: objectB,
    });
  };

  /**
   * Adds a text label to a line or arrow. Currently only works with a straight (2 point - start & end - line).
   * @param {string} lineId - The ID of the line or arrow object.
   * @param {string} label - The label text.
   * @returns {string} The ID of the added text element.
   */
  addLabelToLine(lineId: string, label: string): string {
    const line = this.elementsDict[lineId];
    if(!line || !["arrow","line"].includes(line.type) || line.points.length !== 2) {
      return;
    }

    let angle = Math.atan2(line.points[1][1],line.points[1][0]);

    const size = this.measureText(label);
    //let delta = size.height/6;

    if(angle < 0) {
      if(angle < -Math.PI/2) {
        angle+= Math.PI;
      } /*else {
        delta = -delta;
      } */
    } else {
      if(angle > Math.PI/2) {
        angle-= Math.PI;
        //delta = -delta;
      }
    }
    this.style.angle = angle;
    const id = this.addText(
      line.x+line.points[1][0]/2-size.width/2,//+delta,
      line.y+line.points[1][1]/2-size.height,//-5*size.height/6,
      label
    );
    this.style.angle = 0;
    return id;
  }

  /**
   * Clears elementsDict and imagesDict only.
   */
  clear():void {
    this.elementsDict = {};
    this.imagesDict = {};
  };

  /**
   * Clears elementsDict and imagesDict, and resets all style values to default.
   */
  reset():void {
    this.clear();
    this.activeScript = null;
    this.style = {
      strokeColor: "#000000",
      backgroundColor: "transparent",
      angle: 0,
      fillStyle: "hachure",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      roundness: null,
      fontFamily: 1,
      fontSize: 20,
      textAlign: "left",
      verticalAlign: "top",
      startArrowHead: null,
      endArrowHead: "arrow"
    };
    this.canvas = {
      theme: "light",
      viewBackgroundColor: "#FFFFFF",
      gridSize: 0
    };
  };

  /**
   * Returns true if the provided file is an Excalidraw file.
   * @param {TFile} f - The file to check.
   * @returns {boolean} True if the file is an Excalidraw file, false otherwise.
   */
  isExcalidrawFile(f: TFile): boolean {
    return this.plugin.isExcalidrawFile(f);
  };
  targetView: ExcalidrawView = null; //the view currently edited
  /**
   * Sets the target view for EA. All the view operations and the access to Excalidraw API will be performend on this view.
   * If view is null or undefined, the function will first try setView("active"), then setView("first").
   * @param {ExcalidrawView | "first" | "active"} [view] - The view to set as target.
   * @returns {ExcalidrawView} The target view.
   */
  setView(view?: ExcalidrawView | "first" | "active"): ExcalidrawView {
    if(!view) {
      const v = this.plugin.app.workspace.getActiveViewOfType(ExcalidrawView);
      if (v instanceof ExcalidrawView) {
        this.targetView = v;
      }
      else {
        this.targetView = getExcalidrawViews(this.plugin.app)[0];
      }
    }
    if (view == "active") {
      const v = this.plugin.app.workspace.getActiveViewOfType(ExcalidrawView);
      if (!(v instanceof ExcalidrawView)) {
        return;
      }
      this.targetView = v;
    }
    if (view == "first") {
      this.targetView = getExcalidrawViews(this.plugin.app)[0];
    }
    if (view instanceof ExcalidrawView) {
      this.targetView = view;
    }
    return this.targetView;
  };

  /**
   * Returns the Excalidraw API for the current view.
   * @returns {any} The Excalidraw API.
   */
  getExcalidrawAPI(): any {
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "getExcalidrawAPI()");
      return null;
    }
    return (this.targetView as ExcalidrawView).excalidrawAPI;
  };

  /**
   * Gets elements in the current view.
   * @returns {ExcalidrawElement[]} Array of elements in the view.
   */
  getViewElements(): ExcalidrawElement[] {
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "getViewElements()");
      return [];
    }
    return this.targetView.getViewElements();
  };

  /**
   * Deletes elements in the view by removing them from the scene (not by setting isDeleted to true).
   * @param {ExcalidrawElement[]} elToDelete - Array of elements to delete.
   * @returns {boolean} True if elements were deleted, false otherwise.
   */
  deleteViewElements(elToDelete: ExcalidrawElement[]): boolean {
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "deleteViewElements()");
      return false;
    }
    const api = this.targetView?.excalidrawAPI as ExcalidrawImperativeAPI;
    if (!api) {
      return false;
    }
    const ids = elToDelete.map((e: ExcalidrawElement) => e.id);
    const el: ExcalidrawElement[] = api.getSceneElements() as ExcalidrawElement[];
    const st: AppState = api.getAppState();
    this.targetView.updateScene({
      elements: el.filter((e: ExcalidrawElement) => !ids.includes(e.id)),
      appState: st,
      storeAction: "capture",
    });
    //this.targetView.save();
    return true;
  };

  /**
   * Adds a back of the note card to the current active view.
   * @param {string} sectionTitle - The title of the section.
   * @param {boolean} [activate=true] - Whether to activate the new Embedded Element after creation.
   * @param {string} [sectionBody] - The body of the section.
   * @param {EmbeddableMDCustomProps} [embeddableCustomData] - Custom properties for the embeddable element.
   * @returns {Promise<string>} Promise resolving to the ID of the embeddable element.
   */
  async addBackOfTheCardNoteToView(sectionTitle: string, activate: boolean = false, sectionBody?: string, embeddableCustomData?: EmbeddableMDCustomProps): Promise<string> {
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "addBackOfTheCardNoteToView()");
      return null;
    }
    await this.targetView.forceSave(true);
    return addBackOfTheNoteCard(this.targetView, sectionTitle, activate, sectionBody, embeddableCustomData);
  }

  /**
   * Gets the selected element in the view. If more are selected, gets the first.
   * @returns {any} The selected element or null if none selected.
   */
  getViewSelectedElement(): any {
    const elements = this.getViewSelectedElements();
    return elements ? elements[0] : null;
  };

  /**
   * Gets the selected elements in the view.
   * @param {boolean} [includeFrameChildren=true] - Whether to include frame children in the selection.
   * @returns {any[]} Array of selected elements.
   */
  getViewSelectedElements(includeFrameChildren:boolean = true): any[] {
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "getViewSelectedElements()");
      return [];
    }
    return this.targetView.getViewSelectedElements(includeFrameChildren);
  };

  /**
   * Gets the file associated with an image element in the view.
   * @param {ExcalidrawElement} el - The image element.
   * @returns {TFile | null} The file associated with the image element or null if not found.
   */
  getViewFileForImageElement(el: ExcalidrawElement): TFile | null {
    return getEmbeddedFileForImageElment(this,el)?.file;
  };

  /**
   * Gets the color map associated with an image element in the view.
   * @param {ExcalidrawElement} el - The image element.
   * @returns {ColorMap} The color map associated with the image element.
   */
  getColorMapForImageElement(el: ExcalidrawElement): ColorMap {
    const cm = getEmbeddedFileForImageElment(this,el)?.colorMap 
    if(!cm) {
      return {};
    }
    return cm;
  }

  /**
   * Updates the color map of SVG images in the view.
   * @param {ExcalidrawImageElement | ExcalidrawImageElement[]} elements - The image elements to update.
   * @param {ColorMap | SVGColorInfo | ColorMap[] | SVGColorInfo[]} colors - The new color map(s) for the images.
   * @returns {Promise<void>} Promise resolving when the update is complete.
   */
  async updateViewSVGImageColorMap(
    elements: ExcalidrawImageElement | ExcalidrawImageElement[],
    colors: ColorMap | SVGColorInfo | ColorMap[] | SVGColorInfo[]
  ): Promise<void> {
    const elementArray = Array.isArray(elements) ? elements : [elements];
    const colorArray = Array.isArray(colors) ? colors : [colors];
    let colorMaps: ColorMap[];

    if(colorArray.length !== elementArray.length) {
      errorMessage("Elements and colors arrays must have same length", "updateViewSVGImageColorMap()");
      return;
    }
    
    if (isSVGColorInfo(colorArray[0])) {
        colorMaps = (colors as SVGColorInfo[]).map(svgColorInfoToColorMap);
      } else {
        colorMaps = colors as ColorMap[];
      }

    const fileIDWhiteList = new Set<FileId>();
    for(let i = 0; i < elementArray.length; i++) {
      const el = elementArray[i];
      const colorMap = filterColorMap(colorMaps[i]);

      const ef = getEmbeddedFileForImageElment(this, el);
      if (!ef || !ef.file || !colorMap) {
        errorMessage("Must provide an image element and a colorMap as input", "updateViewSVGImageColorMap()");
        continue;
      }
      if (!colorMap || typeof colorMap !== 'object' || Object.keys(colorMap).length === 0) {
        ef.colorMap = null;
      } else {
        ef.colorMap = colorMap;
        //delete special mappings for default/SVG root color values
        if (ef.colorMap["fill"] === "black") {
          delete ef.colorMap["fill"];
        }
        if (ef.colorMap["stroke"] === "none") {
          delete ef.colorMap["stroke"];
        }
      }
      ef.resetImage(this.targetView.file.path, ef.linkParts.original);
      fileIDWhiteList.add(el.fileId);
    }

    if(fileIDWhiteList.size > 0) {
      this.targetView.setDirty();
      await new Promise<void>((resolve) => {
        this.targetView.loadSceneFiles(
          false,
          fileIDWhiteList,
          resolve
        );
      });
    }
    return;
  };

  /**
   * Gets the SVG color information for an image element in the view.
   * @param {ExcalidrawElement} el - The image element.
   * @returns {Promise<SVGColorInfo>} Promise resolving to the SVG color information.
   */
  async getSVGColorInfoForImgElement(el: ExcalidrawElement): Promise<SVGColorInfo> {
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "getViewFileForImageElement()");
      return;
    }

    if (!el || el.type !== "image") {
      errorMessage(
        "Must provide an image element as input",
        "getViewFileForImageElement()",
      );
      return;
    }
    const ef = getEmbeddedFileForImageElment(this, el);

    const file = ef?.file;
    if(!file || !(file.extension === "svg" || this.isExcalidrawFile(file))) {
      errorMessage("Must provide an SVG or nested Excalidraw image element as input", "getColorMapForImgElement()");
      return;
    }

    if (file.extension === "svg") {
      const svgString = await this.plugin.app.vault.cachedRead(file);
      const svgColors = this.getColorsFromSVGString(svgString);
      return mergeColorMapIntoSVGColorInfo(ef.colorMap, svgColors);
    }
    const svgColors = await this.getColosFromExcalidrawFile(file, el);
    return mergeColorMapIntoSVGColorInfo(ef.colorMap, svgColors);
  };

  /**
   * Gets the color information from an Excalidraw file.
   * @param {TFile} file - The Excalidraw file.
   * @param {ExcalidrawImageElement} img - The image element.
   * @returns {Promise<SVGColorInfo>} Promise resolving to the SVG color information.
   */
  async getColosFromExcalidrawFile(file:TFile, img: ExcalidrawImageElement): Promise<SVGColorInfo> {
    if(!file || !this.isExcalidrawFile(file)) {
      errorMessage("Must provide an Excalidraw file as input", "getColosFromExcalidrawFile()");
      return;
    }
    const ef = getEmbeddedFileForImageElment(this, img);

    const ed = new ExcalidrawData(this.plugin);
    if(file.extension === "excalidraw") {
      await ed.loadLegacyData(await this.plugin.app.vault.cachedRead(file), file);
    } else {  
      await ed.loadData(await this.plugin.app.vault.cachedRead(file), file,TextMode.raw);
    }
    const svgColors: SVGColorInfo = new Map();
    if (!ed.loaded) {
      return svgColors;
    }
    ed.scene.elements.forEach((el:ExcalidrawElement) => {
      if("strokeColor" in el) {
        updateOrAddSVGColorInfo(svgColors, el.strokeColor, {stroke: true});
      }
      if("backgroundColor" in el) {
        updateOrAddSVGColorInfo(svgColors, el.backgroundColor, {fill: true});
      }
    });
    return svgColors;
  }

  /**
   * Extracts color information from an SVG string.
   * @param {string} svgString - The SVG string.
   * @returns {SVGColorInfo} The extracted color information.
   */
  getColorsFromSVGString(svgString: string): SVGColorInfo {
    const colorMap = new Map<string, {mappedTo: string, fill: boolean, stroke: boolean}>();

    if(!svgString) {
      return colorMap;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    
    // Function to process an element and extract its colors
    function processElement(element: Element, isRoot = false) {
      // Check for fill attribute
      const fillColor = element.getAttribute("fill");
      if (fillColor !== "none") {
        if (fillColor) {
          updateOrAddSVGColorInfo(colorMap, fillColor, {fill: true});
        } else if (isRoot) {
          // If the root element has no fill, assume it is white
          updateOrAddSVGColorInfo(colorMap, "fill", {fill: true, mappedTo: "black"});
        }
      }
      
      // Check for stroke attribute
      const strokeColor = element.getAttribute("stroke");
      if (strokeColor && strokeColor !== "none") {
        updateOrAddSVGColorInfo(colorMap, strokeColor, {stroke: true});
      }
      
      // Check for style attribute that might contain fill or stroke
      const style = element.getAttribute("style");
      if (style) {
        // Extract fill from style
        const fillMatch = style.match(/fill:\s*([^;}\s]+)/);
        if (fillMatch && fillMatch[1] !== "none") {
          updateOrAddSVGColorInfo(colorMap, fillMatch[1], {fill: true});
        }
        
        // Extract stroke from style
        const strokeMatch = style.match(/stroke:\s*([^;}\s]+)/);
        if (strokeMatch && strokeMatch[1] !== "none") {
          updateOrAddSVGColorInfo(colorMap, strokeMatch[1], {stroke: true});
        }
      }
      
      // Recursively process child elements
      for (const child of Array.from(element.children)) {
        processElement(child);
      }
    }
    
    // Process the root SVG element
    const svgElement = doc.documentElement;
    processElement(svgElement, true);
    
    return colorMap;
  }

  /**
   * Copies elements from the view to elementsDict for editing.
   * @param {ExcalidrawElement[]} elements - Array of elements to copy.
   * @param {boolean} [copyImages=false] - Whether to copy images as well.
   */
  copyViewElementsToEAforEditing(elements: ExcalidrawElement[], copyImages: boolean = false): void {
    if(copyImages && elements.some(el=>el.type === "image")) {
      if (!this.targetView || !this.targetView?._loaded) {
        errorMessage("targetView not set", "copyViewElementsToEAforEditing()");
        return;
      }
      const sceneFiles = this.targetView.getScene().files;
      elements.forEach((el) => {
        this.elementsDict[el.id] = cloneElement(el);
        if(el.type === "image") {
          const ef = this.targetView.excalidrawData.getFile(el.fileId);
          const imageWithRef = ef && ef.file && ef.linkParts && ef.linkParts.ref;
          const equation = this.targetView.excalidrawData.getEquation(el.fileId);
          const sceneFile = sceneFiles?.[el.fileId];
          this.imagesDict[el.fileId] = {
            mimeType: sceneFile.mimeType,
            id: el.fileId,
            dataURL: sceneFile.dataURL,
            created: sceneFile.created,
            hasSVGwithBitmap: ef ? ef.isSVGwithBitmap : false,
            ...ef ? {
              isHyperLink: ef.isHyperLink || Boolean(imageWithRef),
              hyperlink: imageWithRef ? `${ef.file.path}#${ef.linkParts.ref}` : ef.hyperlink,
              file: imageWithRef ? null : ef.file,
              latex: null,
            } : {},
            ...equation ? {
              file: null,
              isHyperLink: false,
              hyperlink: null,
              latex: equation.latex,
            } : {},
          }
        }
      });
    } else {
      elements.forEach((el) => {
        this.elementsDict[el.id] = cloneElement(el);
      });
    }
  };

  /**
   * Toggles full screen mode for the target view.
   * @param {boolean} [forceViewMode=false] - Whether to force view mode.
   */
  viewToggleFullScreen(forceViewMode: boolean = false): void {
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "viewToggleFullScreen()");
      return;
    }
    const view = this.targetView as ExcalidrawView;
    const isFullscreen = view.isFullscreen();
    if (forceViewMode) {
      view.updateScene({
        //elements: ref.getSceneElements(),
        appState: {
          viewModeEnabled: !isFullscreen,
        },
        storeAction: "update",
      });
      this.targetView.toolsPanelRef?.current?.setExcalidrawViewMode(!isFullscreen);
    }
    
    if (isFullscreen) {
      view.exitFullscreen();
    } else {
      view.gotoFullscreen();
    }
  };

  /**
   * Sets view mode enabled or disabled for the target view.
   * @param {boolean} enabled - Whether to enable view mode.
   */
  setViewModeEnabled(enabled: boolean): void {
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "viewToggleFullScreen()");
      return;
    }
    const view = this.targetView as ExcalidrawView;
    view.updateScene({appState:{viewModeEnabled: enabled}, storeAction: "update"});
    view.toolsPanelRef?.current?.setExcalidrawViewMode(enabled);
  }

  /**
   * Updates the scene in the target view.
   * @param {Object} scene - The scene to load to Excalidraw.
   * @param {ExcalidrawElement[]} [scene.elements] - Array of elements in the scene.
   * @param {AppState} [scene.appState] - The app state of the scene.
   * @param {BinaryFileData} [scene.files] - The files in the scene.
   * @param {boolean} [scene.commitToHistory] - Whether to commit the scene to history.
   * @param {"capture" | "none" | "update"} [scene.storeAction] - The store action for the scene.
   * @param {boolean} [restore=false] - Whether to restore legacy elements in the scene.
   */
  viewUpdateScene (
    scene: {
      elements?: ExcalidrawElement[],
      appState?: AppState,
      files?: BinaryFileData,
      commitToHistory?: boolean,
      storeAction?: "capture" | "none" | "update",
    },
    restore: boolean = false,
  ):void {
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "viewToggleFullScreen()");
      return;
    }
    if (!Boolean(scene.storeAction)) {
      scene.storeAction = scene.commitToHistory ? "capture" : "update";  
    }

    this.targetView.updateScene({
      elements: scene.elements,
      appState: scene.appState,
      files: scene.files,
      storeAction: scene.storeAction,
    },restore);
  }

  /**
   * Connects an object to the selected element in the view.
   * @param {string} objectA - The ID of the first object.
   * @param {ConnectionPoint | null} connectionA - The connection point on the first object.
   * @param {ConnectionPoint | null} connectionB - The connection point on the selected element.
   * @param {Object} [formatting] - Formatting options for the arrow.
   * @param {number} [formatting.numberOfPoints=0] - The number of points on the arrow.
   * @param {"arrow"|"bar"|"circle"|"circle_outline"|"triangle"|"triangle_outline"|"diamond"|"diamond_outline"|null} [formatting.startArrowHead] - The start arrowhead type.
   * @param {"arrow"|"bar"|"circle"|"circle_outline"|"triangle"|"triangle_outline"|"diamond"|"diamond_outline"|null} [formatting.endArrowHead] - The end arrowhead type.
   * @param {number} [formatting.padding=10] - The padding around the arrow.
   * @returns {boolean} True if the connection was successful, false otherwise.
   */
  connectObjectWithViewSelectedElement(
    objectA: string,
    connectionA: ConnectionPoint | null,
    connectionB: ConnectionPoint | null,
    formatting?: {
      numberOfPoints?: number;
      startArrowHead?: "arrow"|"bar"|"circle"|"circle_outline"|"triangle"|"triangle_outline"|"diamond"|"diamond_outline"|null;
      endArrowHead?: "arrow"|"bar"|"circle"|"circle_outline"|"triangle"|"triangle_outline"|"diamond"|"diamond_outline"|null;
      padding?: number;
    },
  ): boolean {
    const el = this.getViewSelectedElement();
    if (!el) {
      return false;
    }
    const id = el.id;
    this.elementsDict[id] = el;
    this.connectObjects(objectA, connectionA, id, connectionB, formatting);
    delete this.elementsDict[id];
    return true;
  };

  /**
   * Zooms the target view to fit the specified elements.
   * @param {boolean} selectElements - Whether to select the elements after zooming.
   * @param {ExcalidrawElement[]} elements - Array of elements to zoom to.
   */
  viewZoomToElements(
    selectElements: boolean,
    elements: ExcalidrawElement[]
  ):void {
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "viewToggleFullScreen()");
      return;
    }
    this.targetView.zoomToElements(selectElements,elements);
  }

  /**
   * Adds elements from elementsDict to the current view.
   * @param {boolean} [repositionToCursor=false] - Whether to reposition the elements to the cursor.
   * @param {boolean} [save=true] - Whether to save the changes.
   * @param {boolean} [newElementsOnTop=false] - Whether to add new elements on top of existing elements.
   * @param {boolean} [shouldRestoreElements=false] - Whether to restore legacy elements in the scene.
   * @returns {Promise<boolean>} Promise resolving to true if elements were added, false otherwise.
   */
  async addElementsToView(
    repositionToCursor: boolean = false,
    save: boolean = true,
    newElementsOnTop: boolean = false,
    shouldRestoreElements: boolean = false,
  ): Promise<boolean> {
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "addElementsToView()");
      return false;
    }
    const elements = this.getElements();    
    return await this.targetView.addElements({
      newElements: elements,
      repositionToCursor,
      save,
      images: this.imagesDict,
      newElementsOnTop,
      shouldRestoreElements,
    });
  };

  /**
   * Registers this instance of EA to use for hooks with the target view.
   * By default, ExcalidrawViews will check window.ExcalidrawAutomate for event hooks.
   * Using this method, you can set a different instance of Excalidraw Automate for hooks.
   * @returns {boolean} True if successful, false otherwise.
   */
  registerThisAsViewEA():boolean {
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "addElementsToView()");
      return false;
    }
    this.targetView.setHookServer(this);
    return true;
  }

  /**
   * Sets the target view EA to window.ExcalidrawAutomate.
   * @returns {boolean} True if successful, false otherwise.
   */
  deregisterThisAsViewEA():boolean {
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "addElementsToView()");
      return false;
    }
    this.targetView.setHookServer(this);
    return true;
  }

  /**
   * If set, this callback is triggered when the user closes an Excalidraw view.
   */
  onViewUnloadHook: (view: ExcalidrawView) => void = null;

  /**
   * If set, this callback is triggered, when the user changes the view mode.
   * You can use this callback in case you want to do something additional when the user switches to view mode and back.
   */
  onViewModeChangeHook: (isViewModeEnabled:boolean, view: ExcalidrawView, ea: ExcalidrawAutomate) => void = null;

   /**
   * If set, this callback is triggered, when the user hovers a link in the scene.
   * You can use this callback in case you want to do something additional when the onLinkHover event occurs.
   * This callback must return a boolean value.
   * In case you want to prevent the excalidraw onLinkHover action you must return false, it will stop the native excalidraw onLinkHover management flow.
   */
  onLinkHoverHook: (
    element: NonDeletedExcalidrawElement,
    linkText: string,
    view: ExcalidrawView,
    ea: ExcalidrawAutomate
  ) => boolean = null;

   /**
   * If set, this callback is triggered, when the user clicks a link in the scene.
   * You can use this callback in case you want to do something additional when the onLinkClick event occurs.
   * This callback must return a boolean value.
   * In case you want to prevent the excalidraw onLinkClick action you must return false, it will stop the native excalidraw onLinkClick management flow.
   */
  onLinkClickHook:(
    element: ExcalidrawElement,
    linkText: string,
    event: MouseEvent,
    view: ExcalidrawView,
    ea: ExcalidrawAutomate
  ) => boolean = null;

  /**
   * If set, this callback is triggered, when Excalidraw receives an onDrop event. 
   * You can use this callback in case you want to do something additional when the onDrop event occurs.
   * This callback must return a boolean value.
   * In case you want to prevent the excalidraw onDrop action you must return false, it will stop the native excalidraw onDrop management flow.
   */
  onDropHook: (data: {
    ea: ExcalidrawAutomate;
    event: React.DragEvent<HTMLDivElement>;
    draggable: any; //Obsidian draggable object
    type: "file" | "text" | "unknown";
    payload: {
      files: TFile[]; //TFile[] array of dropped files
      text: string; //string
    };
    excalidrawFile: TFile; //the file receiving the drop event
    view: ExcalidrawView; //the excalidraw view receiving the drop
    pointerPosition: { x: number; y: number }; //the pointer position on canvas at the time of drop
  }) => boolean = null;
 
  /**
   * If set, this callback is triggered, when Excalidraw receives an onPaste event.
   * You can use this callback in case you want to do something additional when the
   * onPaste event occurs.
   * This callback must return a boolean value.
   * In case you want to prevent the excalidraw onPaste action you must return false,
   * it will stop the native excalidraw onPaste management flow.
   */
   onPasteHook: (data: {
    ea: ExcalidrawAutomate;
    payload: ClipboardData;
    event: ClipboardEvent;
    excalidrawFile: TFile; //the file receiving the paste event
    view: ExcalidrawView; //the excalidraw view receiving the paste
    pointerPosition: { x: number; y: number }; //the pointer position on canvas
   }) => boolean = null;

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
   *   // Generate a new filepath based on the drawing file name and other criteria
   *   const ext = currentImageName.split('.').pop();
   *   return `${drawingFileName} - ${currentImageName || 'image'}.${ext}`;
   * }
   * ```
   */
   onImageFilePathHook: (data: {
    currentImageName: string; // Excalidraw generated name of the image, or the name received from the file system.
    drawingFilePath: string; // The full filepath of the Excalidraw file where the image is being used.
  }) => string = null;  

  /**
   * if set, this callback is triggered, when an Excalidraw file is opened
   * You can use this callback in case you want to do something additional when the file is opened.
   * This will run before the file level script defined in the `excalidraw-onload-script` frontmatter.
   */
  onFileOpenHook: (data: {
    ea: ExcalidrawAutomate;
    excalidrawFile: TFile; //the file being loaded
    view: ExcalidrawView;
  }) => Promise<void>;


  /**
   * if set, this callback is triggered, when an Excalidraw file is created
   * see also: https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1124
   */
  onFileCreateHook: (data: {
    ea: ExcalidrawAutomate;
    excalidrawFile: TFile; //the file being created
    view: ExcalidrawView;
  }) => Promise<void>;
    

  /**
   * If set, this callback is triggered whenever the active canvas color changes.
   * @param {ExcalidrawAutomate} ea - The ExcalidrawAutomate instance.
   * @param {ExcalidrawView} view - The Excalidraw view.
   * @param {string} color - The new canvas color.
   */
  onCanvasColorChangeHook: (
    ea: ExcalidrawAutomate,
    view: ExcalidrawView, //the excalidraw view 
    color: string,
  ) => void = null;

  /**
   * If set, this callback is triggered whenever a drawing is exported to SVG.
   * The string returned will replace the link in the exported SVG.
   * The hook is only executed if the link is to a file internal to Obsidian.
   * @param {Object} data - The data for the hook.
   * @param {string} data.originalLink - The original link in the SVG.
   * @param {string} data.obsidianLink - The Obsidian link in the SVG.
   * @param {TFile | null} data.linkedFile - The linked file in Obsidian.
   * @param {TFile} data.hostFile - The host file in Obsidian.
   * @returns {string} The updated link for the SVG.
   */
  onUpdateElementLinkForExportHook: (data: {
    originalLink: string,
    obsidianLink: string,
    linkedFile: TFile | null,
    hostFile: TFile,
  }) => string = null;

  /**
   * Utility function to generate EmbeddedFilesLoader object.
   * @param {boolean} [isDark] - Whether to use dark mode.
   * @returns {EmbeddedFilesLoader} The EmbeddedFilesLoader object.
   */
  getEmbeddedFilesLoader(isDark?: boolean): EmbeddedFilesLoader {
    return new EmbeddedFilesLoader(this.plugin, isDark);
  };

  /**
   * Utility function to generate ExportSettings object.
   * @param {boolean} withBackground - Whether to include the background in the export.
   * @param {boolean} withTheme - Whether to include the theme in the export.
   * @param {boolean} [isMask=false] - Whether the export is a mask.
   * @returns {ExportSettings} The ExportSettings object.
   */
  getExportSettings(
    withBackground: boolean,
    withTheme: boolean,
    isMask: boolean = false,
  ): ExportSettings {
    return { withBackground, withTheme, isMask };
  };

  /**
   * Gets the bounding box of the specified elements.
   * The bounding box is the box encapsulating all of the elements completely.
   * @param {ExcalidrawElement[]} elements - Array of elements to get the bounding box for.
   * @returns {{topX: number; topY: number; width: number; height: number}} The bounding box of the elements.
   */
  getBoundingBox(elements: ExcalidrawElement[]): {
    topX: number; 
    topY: number;
    width: number;
    height: number;
  } {
    const bb = getCommonBoundingBox(elements);
    return {
      topX: bb.minX,
      topY: bb.minY,
      width: bb.maxX - bb.minX,
      height: bb.maxY - bb.minY,
    };
  };

  /**
   * Gets elements grouped by the highest level groups.
   * @param {ExcalidrawElement[]} elements - Array of elements to group.
   * @returns {ExcalidrawElement[][]} Array of arrays of grouped elements.
   */
  getMaximumGroups(elements: ExcalidrawElement[]): ExcalidrawElement[][] {
    return getMaximumGroups(elements, arrayToMap(elements));
  };

  /**
   * Gets the largest element from a group.
   * Useful when a text element is grouped with a box, and you want to connect an arrow to the box.
   * @param {ExcalidrawElement[]} elements - Array of elements in the group.
   * @returns {ExcalidrawElement} The largest element in the group.
   */
  getLargestElement(elements: ExcalidrawElement[]): ExcalidrawElement {
    if (!elements || elements.length === 0) {
      return null;
    }
    let largestElement = elements[0];
    const getSize = (el: ExcalidrawElement): Number => {
      return el.height * el.width;
    };
    let largetstSize = getSize(elements[0]);
    for (let i = 1; i < elements.length; i++) {
      const size = getSize(elements[i]);
      if (size > largetstSize) {
        largetstSize = size;
        largestElement = elements[i];
      }
    }
    return largestElement;
  };

  /**
   * Intersects an element with a line.
   * @param {ExcalidrawBindableElement} element - The element to intersect.
   * @param {readonly [number, number]} a - The start point of the line.
   * @param {readonly [number, number]} b - The end point of the line.
   * @param {number} [gap] - The gap between the element and the line.
   * @returns {Point[]} Array of intersection points (2 or 0).
   */
  intersectElementWithLine(
    element: ExcalidrawBindableElement,
    a: readonly [number, number],
    b: readonly [number, number],
    gap?: number,
  ): Point[] {
    return intersectElementWithLine(
      element,
      a as GlobalPoint,
      b as GlobalPoint,
      gap
    );
  };

  /**
   * Gets the groupId for the group that contains all the elements, or null if such a group does not exist.
   * @param {ExcalidrawElement[]} elements - Array of elements to check.
   * @returns {string | null} The groupId or null if not found.
   */
  getCommonGroupForElements(elements: ExcalidrawElement[]): string {
    const groupId = elements.map(el=>el.groupIds).reduce((prev,cur)=>cur.filter(v=>prev.includes(v)));
    return groupId.length > 0 ? groupId[0] : null;
  }

  /**
   * Gets all the elements from elements[] that share one or more groupIds with the specified element.
   * @param {ExcalidrawElement} element - The element to check.
   * @param {ExcalidrawElement[]} elements - Array of elements to search.
   * @param {boolean} [includeFrameElements=false] - Whether to include frame elements in the search.
   * @returns {ExcalidrawElement[]} Array of elements in the same group as the specified element.
   */
  getElementsInTheSameGroupWithElement(
    element: ExcalidrawElement,
    elements: ExcalidrawElement[],
    includeFrameElements: boolean = false,
  ): ExcalidrawElement[] {
    if(!element || !elements) return [];
    const container = (element.type === "text" && element.containerId)
      ? elements.filter(el=>el.id === element.containerId)
      : [];
    if(element.groupIds.length === 0) {
      if(includeFrameElements && element.type === "frame") {
        return this.getElementsInFrame(element,elements,true);
      }
      if(container.length === 1) return [element,container[0]];
      return [element];
    }

    const conditionFN = container.length === 1
      ? (el: ExcalidrawElement) => el.groupIds.some(id=>element.groupIds.includes(id)) || el === container[0]
      : (el: ExcalidrawElement) => el.groupIds.some(id=>element.groupIds.includes(id));

    if(!includeFrameElements) {
      return elements.filter(el=>conditionFN(el));
    } else {
      //I use the set and the filter at the end to preserve scene layer seqeuence
      //adding frames could potentially mess up the sequence otherwise
      const elementIDs = new Set<string>();
      elements
        .filter(el=>conditionFN(el))
        .forEach(el=>{
          if(el.type === "frame") {
            this.getElementsInFrame(el,elements,true).forEach(el=>elementIDs.add(el.id))
          } else {
            elementIDs.add(el.id);
          }
        });
      return elements.filter(el=>elementIDs.has(el.id));
    }
  }

  /**
   * Gets all the elements from elements[] that are contained in the specified frame.
   * @param {ExcalidrawElement} frameElement - The frame element.
   * @param {ExcalidrawElement[]} elements - Array of elements to search.
   * @param {boolean} [shouldIncludeFrame=false] - Whether to include the frame element in the result.
   * @returns {ExcalidrawElement[]} Array of elements contained in the frame.
   */
  getElementsInFrame(
    frameElement: ExcalidrawElement,
    elements: ExcalidrawElement[],
    shouldIncludeFrame: boolean = false,
  ): ExcalidrawElement[] {
    if(!frameElement || !elements || frameElement.type !== "frame") return [];
    return elements.filter(el=>(el.frameId === frameElement.id) || (shouldIncludeFrame && el.id === frameElement.id));
  } 

  /**
   * Sets the active script for the ScriptEngine.
   * @param {string} scriptName - The name of the active script.
   */
  activeScript: string = null; 

  /**
   * Gets the script settings for the active script.
   * Saves settings in plugin settings, under the activeScript key.
   * @returns {Object} The script settings.
   */
  getScriptSettings(): {} {
    if (!this.activeScript) {
      return null;
    }
    return this.plugin.settings.scriptEngineSettings[this.activeScript] ?? {};
  };

  /**
   * Sets the script settings for the active script.
   * @param {Object} settings - The script settings to set.
   * @returns {Promise<void>} Promise resolving when the settings are saved.
   */
  async setScriptSettings(settings: any): Promise<void> {
    if (!this.activeScript) {
      return null;
    }
    this.plugin.settings.scriptEngineSettings[this.activeScript] = settings;
    await this.plugin.saveSettings();
  };

  /**
   * Opens a file in a new workspace leaf or reuses an existing adjacent leaf depending on Excalidraw Plugin Settings.
   * @param {TFile} file - The file to open.
   * @param {OpenViewState} [openState] - The open state for the file.
   * @returns {WorkspaceLeaf} The new or adjacent workspace leaf.
   */
  openFileInNewOrAdjacentLeaf(file: TFile, openState?: OpenViewState): WorkspaceLeaf {
    if (!file || !(file instanceof TFile)) {
      return null;
    }
    if (!this.targetView) {
      return null;
    }

    const {leaf, promise} = openLeaf({
      plugin: this.plugin,
      fnGetLeaf: () => getNewOrAdjacentLeaf(this.plugin, this.targetView.leaf),
      file,
      openState: openState ?? {active: true}
    });
    return leaf;
  };

  /**
   * Measures the size of the specified text based on current style settings.
   * @param {string} text - The text to measure.
   * @returns {{width: number; height: number}} The width and height of the text.
   */
  measureText(text: string): { width: number; height: number } {
    const size = _measureText(
      text,
      this.style.fontSize,
      this.style.fontFamily,
      getLineHeight(this.style.fontFamily),
    );
    return { width: size.w ?? 0, height: size.h ?? 0 };
  };

  /**
   * Returns the size of the image element at 100% (i.e. the original size), or undefined if the data URL is not available.
   * @param {ExcalidrawImageElement} imageElement - The image element from the active scene on targetView.
   * @param {boolean} [shouldWaitForImage=false] - Whether to wait for the image to load before returning the size.
   * @returns {Promise<{width: number; height: number}>} Promise resolving to the original size of the image.
   */
  async getOriginalImageSize(imageElement: ExcalidrawImageElement, shouldWaitForImage: boolean=false): Promise<{width: number; height: number}> {
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "getOriginalImageSize()");
      return null;
    }
    if(!imageElement || imageElement.type !== "image") {
      errorMessage("Please provide a single image element as input", "getOriginalImageSize()");
      return null;
    }
    const ef = this.targetView.excalidrawData.getFile(imageElement.fileId);
    if(!ef) {
      errorMessage("Please provide a single image element as input", "getOriginalImageSize()");
      return null;
    }
    const isDark = this.getExcalidrawAPI().getAppState().theme === "dark";
    let dataURL = ef.getImage(isDark);
    if(!dataURL && !shouldWaitForImage) return;
    if(!dataURL) {
      let watchdog = 0;
      while(!dataURL && watchdog < 50) {
        await sleep(100);
        dataURL = ef.getImage(isDark);
        watchdog++;
      }
      if(!dataURL) return;
    }
    return await getImageSize(dataURL);
  }

  /**
   * Resets the image to its original aspect ratio.
   * If the image is resized then the function returns true.
   * If the image element is not in EA (only in the view), then if image is resized, the element is copied to EA for Editing using copyViewElementsToEAforEditing([imgEl]).
   * Note you need to run await ea.addElementsToView(false); to add the modified image to the view.
   * @param {ExcalidrawImageElement} imgEl - The EA image element to be resized.
   * @returns {Promise<boolean>} Promise resolving to true if the image was changed, false otherwise.
   */
  async resetImageAspectRatio(imgEl: ExcalidrawImageElement): Promise<boolean> {
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "resetImageAspectRatio()");
      return null;
    }

    let originalArea, originalAspectRatio;
    if(imgEl.crop) {
      originalArea = imgEl.width * imgEl.height;
      originalAspectRatio = imgEl.crop.width / imgEl.crop.height;
    } else {
      const size = await this.getOriginalImageSize(imgEl, true);
      if (!size) { return false; }
      originalArea = imgEl.width * imgEl.height;
      originalAspectRatio = size.width / size.height;
    }
    let newWidth = Math.sqrt(originalArea * originalAspectRatio);
    let newHeight = Math.sqrt(originalArea / originalAspectRatio);
    const centerX = imgEl.x + imgEl.width / 2;
    const centerY = imgEl.y + imgEl.height / 2;

    if (newWidth !== imgEl.width || newHeight !== imgEl.height) {
      if(!this.getElement(imgEl.id)) {
        this.copyViewElementsToEAforEditing([imgEl]);
      }
      const eaEl = this.getElement(imgEl.id);
      eaEl.width = newWidth;
      eaEl.height = newHeight;
      eaEl.x = centerX - newWidth / 2;
      eaEl.y = centerY - newHeight / 2;
      return true;
    }
    return false;
  }

  /**
   * Verifies if the plugin version is greater than or equal to the required version.
   * Excample usage in a script: if (!ea.verifyMinimumPluginVersion("1.5.20")) { console.error("Please update the Excalidraw Plugin to the latest version."); return; }
   * @param {string} requiredVersion - The required plugin version.
   * @returns {boolean} True if the plugin version is greater than or equal to the required version, false otherwise.
   */
  verifyMinimumPluginVersion(requiredVersion: string): boolean {
    return verifyMinimumPluginVersion(requiredVersion);
  };

  /**
   * Checks if the provided view is an instance of ExcalidrawView.
   * @param {any} view - The view to check.
   * @returns {boolean} True if the view is an instance of ExcalidrawView, false otherwise.
   */
  isExcalidrawView(view: any): boolean {
    return view instanceof ExcalidrawView;
  }

  /**
   * Sets the selection in the view.
   * @param {ExcalidrawElement[] | string[]} elements - Array of elements or element IDs to select.
   */
  selectElementsInView(elements: ExcalidrawElement[] | string[]): void {
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "selectElementsInView()");
      return;
    }
    if (!elements || elements.length === 0) {
      return;
    }
    const API: ExcalidrawImperativeAPI = this.getExcalidrawAPI();
    if(typeof elements[0] === "string") {
      const els = this.getViewElements().filter(el=>(elements as string[]).includes(el.id));
      API.selectElements(els);
    } else {
      API.selectElements(elements as ExcalidrawElement[]);
    }
  };

  /**
   * Generates a random 8-character long element ID.
   * @returns {string} The generated element ID.
   */
  generateElementId(): string {
    return nanoid();
  };

  /**
   * Clones the specified element with a new ID.
   * @param {ExcalidrawElement} element - The element to clone.
   * @returns {ExcalidrawElement} The cloned element with a new ID.
   */
  cloneElement(element: ExcalidrawElement): ExcalidrawElement {
    const newEl = JSON.parse(JSON.stringify(element));
    newEl.id = nanoid();
    return newEl;
  };

  /**
   * Moves the specified element to a specific position in the z-index.
   * @param {number} elementId - The ID of the element to move.
   * @param {number} newZIndex - The new z-index position for the element.
   */
  moveViewElementToZIndex(elementId: number, newZIndex: number): void {
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "moveViewElementToZIndex()");
      return;
    }
    const API = this.getExcalidrawAPI();
    const elements = this.getViewElements();
    const elementToMove = elements.filter((el: any) => el.id === elementId);
    if (elementToMove.length === 0) {
      errorMessage(
        `Element (id: ${elementId}) not found`,
        "moveViewElementToZIndex",
      );
      return;
    }
    if (newZIndex >= elements.length) {
      API.bringToFront(elementToMove);
      return;
    }
    if (newZIndex < 0) {
      API.sendToBack(elementToMove);
      return;
    }

    const oldZIndex = elements.indexOf(elementToMove[0]);
    elements.splice(newZIndex, 0, elements.splice(oldZIndex, 1)[0]);
    this.targetView.updateScene({
      elements,
      storeAction: "capture",
    });
  };

  /**
   * Converts a hex color string to an RGB array.
   * @deprecated Use getCM / ColorMaster instead.
   * @param {string} color - The hex color string.
   * @returns {number[]} The RGB array.
   */
  hexStringToRgb(color: string): number[] {
    const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
    return [parseInt(res[1], 16), parseInt(res[2], 16), parseInt(res[3], 16)];
  };

  /**
   * Converts an RGB array to a hex color string.
   * @deprecated Use getCM / ColorMaster instead.
   * @param {number[]} color - The RGB array.
   * @returns {string} The hex color string.
   */
  rgbToHexString(color: number[]): string {
    const cm = CM({r:color[0], g:color[1], b:color[2]});
    return cm.stringHEX({alpha: false});
  };

  /**
   * Converts an HSL array to an RGB array.
   * @deprecated Use getCM / ColorMaster instead.
   * @param {number[]} color - The HSL array.
   * @returns {number[]} The RGB array.
   */
  hslToRgb(color: number[]): number[] {
    const cm = CM({h:color[0], s:color[1], l:color[2]});
    return [cm.red, cm.green, cm.blue];
  };

  /**
   * Converts an RGB array to an HSL array.
   * @deprecated Use getCM / ColorMaster instead.
   * @param {number[]} color - The RGB array.
   * @returns {number[]} The HSL array.
   */
  rgbToHsl(color: number[]): number[] {
    const cm = CM({r:color[0], g:color[1], b:color[2]});
    return [cm.hue, cm.saturation, cm.lightness];
  };

  /**
   * Converts a color name to a hex color string.
   * @param {string} color - The color name.
   * @returns {string} The hex color string.
   */
  colorNameToHex(color: string): string {
    if (COLOR_NAMES.has(color.toLowerCase().trim())) {
      return COLOR_NAMES.get(color.toLowerCase().trim());
    }
    return color.trim();
  };

  /**
   * Creates a ColorMaster object for manipulating colors.
   * @param {TInput} color - The color input.
   * @returns {ColorMaster} The ColorMaster object.
   */
  getCM(color:TInput): ColorMaster {
    if(!color) {
      log("Creates a CM object. Visit https://github.com/lbragile/ColorMaster for documentation.");
      return;
    }
    if(typeof color === "string") {
      color = this.colorNameToHex(color);
    }
    
    const cm = CM(color);
    //ColorMaster converts #FFFFFF00 to #FFFFFF, which is not what we want
    //same is true for rgba and hsla transparent colors
    if(isColorStringTransparent(color as string)) {
      return cm.alphaTo(0);
    }
    return cm;
  }

  /**
   * Gets the PolyBool class from https://github.com/velipso/polybooljs.
   * @returns {PolyBool} The PolyBool class.
   */
  getPolyBool() {
    const defaultEpsilon = 0.0000000001;
    PolyBool.epsilon(defaultEpsilon);
    return PolyBool;
  }

  /**
   * Imports an SVG string into ExcalidrawAutomate elements.
   * @param {string} svgString - The SVG string to import.
   * @returns {boolean} True if the import was successful, false otherwise.
   */
  importSVG(svgString:string):boolean {
    const res:ConversionResult =  svgToExcalidraw(svgString);
    if(res.hasErrors) {
      new Notice (`There were errors while parsing the given SVG:\n${res.errors}`);
      return false;
    }
    this.copyViewElementsToEAforEditing(res.content);
    return true;
  }

  /**
   * Destroys the ExcalidrawAutomate instance, clearing all references and data.
   */
  destroy(): void {
    this.targetView = null;
    this.plugin = null;
    this.elementsDict = {};
    this.imagesDict = {};
    this.mostRecentMarkdownSVG = null;
    this.activeScript = null;
    //@ts-ignore
    this.style = {};
    //@ts-ignore
    this.canvas = {};
    this.colorPalette = {};
  }  
};
