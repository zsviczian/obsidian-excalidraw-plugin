import {
  TFile,
  Plugin,
  WorkspaceLeaf,
  addIcon,
  App,
  PluginManifest,
  MarkdownView,
  normalizePath,
  Menu,
  MenuItem,
  ViewState,
  Notice,
  request,
  MetadataCache,
  Command,
  Workspace,
  Editor,
  MarkdownFileInfo,
} from "obsidian";
import {
  VIEW_TYPE_EXCALIDRAW,
  EXCALIDRAW_ICON,
  ICON_NAME,
  SCRIPTENGINE_ICON,
  SCRIPTENGINE_ICON_NAME,
  RERENDER_EVENT,
  FRONTMATTER_KEYS,
  FRONTMATTER,
  JSON_parse,
  SCRIPT_INSTALL_CODEBLOCK,
  SCRIPT_INSTALL_FOLDER,
  EXPORT_TYPES,
  EXPORT_IMG_ICON_NAME,
  EXPORT_IMG_ICON,
  LOCALE,
  IMAGE_TYPES,
  setExcalidrawPlugin,
  DEVICE,
  sceneCoordsToViewportCoords,
  FONTS_STYLE_ID,
  CJK_STYLE_ID,
  updateExcalidrawLib,
} from "./constants/constants";
import ExcalidrawView, { TextMode } from "./ExcalidrawView";
import {
  REGEX_LINK,
} from "./ExcalidrawData";
import {
  ExcalidrawSettings,
  DEFAULT_SETTINGS,
  ExcalidrawSettingTab,
} from "./settings";
import { openDialogAction, OpenFileDialog } from "./dialogs/OpenDrawing";
import { InsertLinkDialog } from "./dialogs/InsertLinkDialog";
import { InsertCommandDialog } from "./dialogs/InsertCommandDialog";
import { InsertImageDialog } from "./dialogs/InsertImageDialog";
import { ImportSVGDialog } from "./dialogs/ImportSVGDialog";
import { InsertMDDialog } from "./dialogs/InsertMDDialog";
import {
  initExcalidrawAutomate,
  ExcalidrawAutomate,
  insertLaTeXToView,
  search,
} from "./ExcalidrawAutomate";
import { templatePromt } from "./dialogs/Prompt";
import { around, dedupe } from "monkey-around";
import { t } from "./lang/helpers";
import {
  checkAndCreateFolder,
  fileShouldDefaultAsExcalidraw,
  getAliasWithSize,
  getAnnotationFileNameAndFolder,
  getCropFileNameAndFolder,
  getDrawingFilename,
  getEmbedFilename,
  getIMGFilename,
  getLink,
  getListOfTemplateFiles,
  getNewUniqueFilepath,
  getURLImageExtension,
} from "./utils/FileUtils";
import {
  getFontDataURL,
  errorlog,
  setLeftHandedMode,
  sleep,
  isVersionNewerThanOther,
  isCallerFromTemplaterPlugin,
  decompress,
  getImageSize,
  versionUpdateCheckTimer,
  getFontMetrics,
} from "./utils/Utils";
import { editorInsertText, extractSVGPNGFileName, foldExcalidrawSection, getActivePDFPageNumberFromPDFView, getAttachmentsFolderAndFilePath, getExcalidrawViews, getNewOrAdjacentLeaf, getParentOfClass, isObsidianThemeDark, mergeMarkdownFiles, openLeaf, setExcalidrawView } from "./utils/ObsidianUtils";
import { ExcalidrawElement, ExcalidrawEmbeddableElement, ExcalidrawImageElement, ExcalidrawTextElement, FileId } from "@zsviczian/excalidraw/types/excalidraw/element/types";
import { ScriptEngine } from "./Scripts";
import {
  hoverEvent,
  initializeMarkdownPostProcessor,
  markdownPostProcessor,
  legacyExcalidrawPopoverObserver,
} from "./MarkdownPostProcessor";

import { FieldSuggester } from "./Components/Suggesters/FieldSuggester";
import { ReleaseNotes } from "./dialogs/ReleaseNotes";
import { Packages } from "./types/types";
import { PreviewImageType } from "./utils/UtilTypes";
import { ScriptInstallPrompt } from "./dialogs/ScriptInstallPrompt";
import Taskbone from "./ocr/Taskbone";
import { emulateCTRLClickForLinks, linkClickModifierType, PaneTarget } from "./utils/ModifierkeyHelper";
import { InsertPDFModal } from "./dialogs/InsertPDFModal";
import { ExportDialog } from "./dialogs/ExportDialog";
import { UniversalInsertFileModal } from "./dialogs/UniversalInsertFileModal";
import { imageCache } from "./utils/ImageCache";
import { StylesManager } from "./utils/StylesManager";
import { PublishOutOfDateFilesDialog } from "./dialogs/PublishOutOfDateFiles";
import { EmbeddableSettings } from "./dialogs/EmbeddableSettings";
import { processLinkText } from "./utils/CustomEmbeddableUtils";
import { getEA } from "src";
import { ExcalidrawImperativeAPI } from "@zsviczian/excalidraw/types/excalidraw/types";
import { Mutable } from "@zsviczian/excalidraw/types/excalidraw/utility-types";
import { CustomMutationObserver, debug, log, DEBUGGING, setDebugging } from "./utils/DebugHelper";
import { carveOutImage, carveOutPDF, createImageCropperFile } from "./utils/CarveOut";
import { ExcalidrawConfig } from "./utils/ExcalidrawConfig";
import { EditorHandler } from "./CodeMirrorExtension/EditorHandler";
import { showFrameSettings } from "./dialogs/FrameSettings";
import { ExcalidrawLib } from "./ExcalidrawLib";
import { Rank, SwordColors } from "./menu/ActionIcons";
import { RankMessage } from "./dialogs/RankMessage";
import { initCompressionWorker, terminateCompressionWorker } from "./workers/compression-worker";
import { WeakArray } from "./utils/WeakArray";
import { getCJKDataURLs } from "./utils/CJKLoader";
import { ExcalidrawLoading, switchToExcalidraw } from "./dialogs/ExcalidrawLoading";
import { insertImageToView } from "./utils/ExcalidrawViewUtils";
import { clearMathJaxVariables } from "./LaTeX";
import { PluginFileManager } from "./Managers/FileManager";
import { ObserverManager } from "./Managers/ObserverManager";


declare let REACT_PACKAGES:string;
//declare let EXCALIDRAW_PACKAGE:string;
declare const unpackExcalidraw: Function;
declare let react:any;
declare let reactDOM:any;
declare let excalidrawLib: typeof ExcalidrawLib;
declare const PLUGIN_VERSION:string;
declare const INITIAL_TIMESTAMP: number;

export default class ExcalidrawPlugin extends Plugin {
  public fileManager: PluginFileManager;
  public observerManager: ObserverManager;
  private EXCALIDRAW_PACKAGE: string;
  public eaInstances = new WeakArray<ExcalidrawAutomate>();
  public fourthFontLoaded: boolean = false;
  public excalidrawConfig: ExcalidrawConfig;
  public taskbone: Taskbone;
  public excalidrawFileModes: { [file: string]: string } = {};
  private _loaded: boolean = false;
  public settings: ExcalidrawSettings;
  private openDialog: OpenFileDialog;
  public insertLinkDialog: InsertLinkDialog;
  public insertCommandDialog: InsertCommandDialog;
  public insertImageDialog: InsertImageDialog;
  public importSVGDialog: ImportSVGDialog;
  public insertMDDialog: InsertMDDialog;
  public activeExcalidrawView: ExcalidrawView = null;
  public lastActiveExcalidrawFilePath: string = null;
  public hover: { linkText: string; sourcePath: string } = {
    linkText: null,
    sourcePath: null,
  };
  private legacyExcalidrawPopoverObserver: MutationObserver | CustomMutationObserver;
  private themeObserver: MutationObserver | CustomMutationObserver;
  private fileExplorerObserver: MutationObserver | CustomMutationObserver;
  private modalContainerObserver: MutationObserver | CustomMutationObserver;
  private workspaceDrawerLeftObserver: MutationObserver | CustomMutationObserver;
  private workspaceDrawerRightObserver: MutationObserver  | CustomMutationObserver;
  public opencount: number = 0;
  public ea: ExcalidrawAutomate;
  //A master list of fileIds to facilitate copy / paste
  public filesMaster: Map<FileId, { isHyperLink: boolean; isLocalLink: boolean; path: string; hasSVGwithBitmap: boolean; blockrefData: string, colorMapJSON?: string}> =
    null; //fileId, path
  public equationsMaster: Map<FileId, string> = null; //fileId, formula
  public mermaidsMaster: Map<FileId, string> = null; //fileId, mermaidText
  public scriptEngine: ScriptEngine;
  private packageMap: Map<Window,Packages> = new Map<Window,Packages>();
  public leafChangeTimeout: number = null;
  private forceSaveCommand:Command;
  private removeEventLisnters:(()=>void)[] = [];
  private stylesManager:StylesManager;
  public editorHandler: EditorHandler;
  //if set, the next time this file is opened it will be opened as markdown
  public forceToOpenInMarkdownFilepath: string = null;
  //private slob:string;
  public loadTimestamp:number;
  private isLocalCJKFontAvailabe:boolean = undefined
  public isReady = false;
  private startupAnalytics: string[] = [];
  private lastLogTimestamp: number;
  private settingsReady: boolean = false;
  public wasPenModeActivePreviously: boolean = false;

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    this.fileManager = new PluginFileManager(this);
    this.loadTimestamp = INITIAL_TIMESTAMP;
    this.lastLogTimestamp = this.loadTimestamp;
    this.packageMap.set(window,{react, reactDOM, excalidrawLib});
    this.filesMaster = new Map<
      FileId,
      { isHyperLink: boolean; isLocalLink: boolean; path: string; hasSVGwithBitmap: boolean; blockrefData: string; colorMapJSON?: string }
    >();
    this.equationsMaster = new Map<FileId, string>();
    this.mermaidsMaster = new Map<FileId, string>();
    setExcalidrawPlugin(this);
    /*if((process.env.NODE_ENV === 'development')) {
      this.slob = new Array(200 * 1024 * 1024 + 1).join('A'); // Create a 200MB blob
    }*/
  }

  private logStartupEvent(message:string) {
    const timestamp = Date.now();
    this.startupAnalytics.push(`${message}\nTotal: ${timestamp - this.loadTimestamp}ms Delta: ${timestamp - this.lastLogTimestamp}ms\n`);
    this.lastLogTimestamp = timestamp;
  }

  public printStarupBreakdown() {
    console.log(`Excalidraw ${PLUGIN_VERSION} startup breakdown:\n`+this.startupAnalytics.join("\n"));
  }

  get locale() {
    return LOCALE;
  }

  get window(): Window {
    return window;
  };

  get document(): Document {
    return document;
  };

  public deletePackage(win:Window) {
    //window.console.log("ExcalidrawPlugin.deletePackage",win, this.packageMap.has(win));
    const {react, reactDOM, excalidrawLib} = this.getPackage(win);
    
    //@ts-ignore
    if(win.ExcalidrawLib === excalidrawLib) {
    excalidrawLib.destroyObsidianUtils();
    //@ts-ignore
    delete win.ExcalidrawLib;
    }

    //@ts-ignore
    if(win.React === react) {
      //@ts-ignore
      Object.keys(win.React).forEach((key) => {
        //@ts-ignore
        delete win.React[key];
      });
      //@ts-ignore
      delete win.React;
    }
    //@ts-ignore
    if(win.ReactDOM === reactDOM) {
      //@ts-ignore
      Object.keys(win.ReactDOM).forEach((key) => {
        //@ts-ignore    
        delete win.ReactDOM[key];
      });
      //@ts-ignore
      delete win.ReactDOM;
    }
    if(this.packageMap.has(win)) {
      this.packageMap.delete(win);
    }
  }

  public getPackage(win:Window):Packages {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.getPackage, `ExcalidrawPlugin.getPackage`, win);

    if(this.packageMap.has(win)) {
      return this.packageMap.get(win);
    }
    
    //@ts-ignore
    const {react:r, reactDOM:rd, excalidrawLib:e} = win.eval.call(win,
      `(function() {
        ${REACT_PACKAGES + this.EXCALIDRAW_PACKAGE};
        return {react:React,reactDOM:ReactDOM,excalidrawLib:ExcalidrawLib};
       })()`);
    this.packageMap.set(win,{react:r, reactDOM:rd, excalidrawLib:e});
    return {react:r, reactDOM:rd, excalidrawLib:e};
    
  }

  // by adding the wrapper like this, likely in debug mode I am leaking memory because my code removes
  // the original event handlers, not the wrapped ones. I will only uncomment this if I need to debug
  /*public registerEvent(event: any) {
    if (process.env.NODE_ENV !== 'development') {
      super.registerEvent(event);
      return;
    } else {
      if(!DEBUGGING) {
        super.registerEvent(event);
        return;
      }
      const originalHandler = event.fn;

      // Wrap the original event handler
      const wrappedHandler = async (...args: any[]) => {
        const startTime = performance.now(); // Get start time
    
        // Invoke the original event handler
        const result = await originalHandler(...args);
    
        const endTime = performance.now(); // Get end time
        const executionTime = endTime - startTime;
    
        if(executionTime > durationTreshold) {
          console.log(`Excalidraw Event '${event.name}' took ${executionTime}ms to execute`);
        }
    
        return result;
      }
  
      // Replace the original event handler with the wrapped one
      event.fn = wrappedHandler;
    
      // Register the modified event
      super.registerEvent(event);
    };
  }*/

  public isPenMode() {
    return this.wasPenModeActivePreviously ||
      (this.settings.defaultPenMode === "always") ||
      (this.settings.defaultPenMode === "mobile" && DEVICE.isMobile);
  }
  
  public getCJKFontSettings() {
    const assetsFoler = this.settings.fontAssetsPath;
    if(typeof this.isLocalCJKFontAvailabe === "undefined") {
      this.isLocalCJKFontAvailabe = this.app.vault.getFiles().some(f=>f.path.startsWith(assetsFoler));
    }
    if(!this.isLocalCJKFontAvailabe) {
      return { c: false, j: false, k: false };
    }
    return {
      c: this.settings.loadChineseFonts,
      j: this.settings.loadJapaneseFonts,
      k: this.settings.loadKoreanFonts,
    }
  }

  public async loadFontFromFile(fontName: string): Promise<ArrayBuffer|undefined> {
    const assetsFoler = this.settings.fontAssetsPath;

    if(!this.isLocalCJKFontAvailabe) {
      return;
    }
    const file = this.app.vault.getAbstractFileByPath(normalizePath(assetsFoler + "/" + fontName));
    if(!file || !(file instanceof TFile)) {
      return;
    }
    return await this.app.vault.readBinary(file);
  }

  async onload() {
    this.logStartupEvent("Plugin Constructor ready, starting onload()");
    this.registerView(
      VIEW_TYPE_EXCALIDRAW,
      (leaf: WorkspaceLeaf) => {
        if(this.isReady) {
          return new ExcalidrawView(leaf, this);
        } else {
          return new ExcalidrawLoading(leaf, this);
        }
      },
    );
    //Compatibility mode with .excalidraw files
    this.registerExtensions(["excalidraw"], VIEW_TYPE_EXCALIDRAW);

    addIcon(ICON_NAME, EXCALIDRAW_ICON);
    addIcon(SCRIPTENGINE_ICON_NAME, SCRIPTENGINE_ICON);
    addIcon(EXPORT_IMG_ICON_NAME, EXPORT_IMG_ICON);
    this.addRibbonIcon(ICON_NAME, t("CREATE_NEW"), this.actionRibbonClick.bind(this));

    try {
      this.loadSettings({reEnableAutosave:true})
        .then(this.onloadCheckForOnceOffSettingsUpdates.bind(this));
    } catch (e) {
      new Notice("Error loading plugin settings", 6000);
      console.error("Error loading plugin settings", e);
    }
    this.logStartupEvent("Settings loaded");

    try {
      // need it her for ExcaliBrain
      this.ea = initExcalidrawAutomate(this);
    } catch (e) {
      new Notice("Error initializing Excalidraw Automate", 6000);
      console.error("Error initializing Excalidraw Automate", e);
    }
    this.logStartupEvent("Excalidraw Automate initialized");

    try {
      //Licat: Are you registering your post processors in onLayoutReady? You should register them in onload instead
      this.addMarkdownPostProcessor();
    } catch (e) {
      new Notice("Error adding markdown post processor", 6000);
      console.error("Error adding markdown post processor", e);
    }
    this.logStartupEvent("Markdown post processor added");

    this.app.workspace.onLayoutReady(this.onloadOnLayoutReady.bind(this));
    this.logStartupEvent("Workspace ready event handler added");
  }

  private async onloadCheckForOnceOffSettingsUpdates() {
    const updateSettings = !this.settings.onceOffCompressFlagReset || !this.settings.onceOffGPTVersionReset;
    if(!this.settings.onceOffCompressFlagReset) {
      this.settings.compress = true;
      this.settings.onceOffCompressFlagReset = true;
    }
    if(!this.settings.onceOffGPTVersionReset) {
      this.settings.onceOffGPTVersionReset = true;
      if(this.settings.openAIDefaultVisionModel === "gpt-4-vision-preview") {
        this.settings.openAIDefaultVisionModel = "gpt-4o";
      }
    }
    if(updateSettings) {
      await this.saveSettings();
    }
    this.addSettingTab(new ExcalidrawSettingTab(this.app, this));
    this.settingsReady = true;
  }

  private async onloadOnLayoutReady() {
    this.loadTimestamp = Date.now();
    this.lastLogTimestamp = this.loadTimestamp;
    this.logStartupEvent("\n----------------------------------\nWorkspace onLayoutReady event fired (these actions are outside the plugin initialization)");
    await this.awaitSettings();
    this.logStartupEvent("Settings awaited");
    try {
      this.EXCALIDRAW_PACKAGE = unpackExcalidraw();
      excalidrawLib = window.eval.call(window,`(function() {${this.EXCALIDRAW_PACKAGE};return ExcalidrawLib;})()`);
      this.packageMap.set(window,{react, reactDOM, excalidrawLib});
      updateExcalidrawLib();
    } catch (e) {
      new Notice("Error loading the Excalidraw package", 6000);
      console.error("Error loading the Excalidraw package", e);
    }
    this.logStartupEvent("Excalidraw package unpacked");

    try {
      initCompressionWorker();
    } catch (e) {
      new Notice("Error initializing compression worker", 6000);
      console.error("Error initializing compression worker", e);
    }
    this.logStartupEvent("Compression worker initialized");

    try {
      this.excalidrawConfig = new ExcalidrawConfig(this);
    } catch (e) {
      new Notice("Error initializing Excalidraw config", 6000);
      console.error("Error initializing Excalidraw config", e);
    }
    this.logStartupEvent("Excalidraw config initialized");

    try {
      this.observerManager = new ObserverManager(this);
    } catch (e) {
      new Notice("Error adding ObserverManager", 6000);
      console.error("Error adding ObserverManager", e);
    }
    this.logStartupEvent("ObserverManager added");

    try {
      //inspiration taken from kanban:
      //https://github.com/mgmeyers/obsidian-kanban/blob/44118e25661bff9ebfe54f71ae33805dc88ffa53/src/main.ts#L267
      this.registerMonkeyPatches();
    } catch (e) {
      new Notice("Error registering monkey patches", 6000);
      console.error("Error registering monkey patches", e);
    }
    this.logStartupEvent("Monkey patches registered");

    try {
      this.stylesManager = new StylesManager(this);
    } catch (e) {
      new Notice("Error initializing styles manager", 6000);
      console.error("Error initializing styles manager", e);
    }
    this.logStartupEvent("Styles manager initialized");

    try {
      this.scriptEngine = new ScriptEngine(this);
    } catch (e) {
      new Notice("Error initializing script engine", 6000);
      console.error("Error initializing script engine", e);
    }
    this.logStartupEvent("Script engine initialized");

    try {
      await this.initializeFonts();
    } catch (e) {
      new Notice("Error initializing fonts", 6000);
      console.error("Error initializing fonts", e);
    }
    this.logStartupEvent("Fonts initialized");

    try {
      imageCache.initializeDB(this);
    } catch (e) {
      new Notice("Error initializing image cache", 6000);
      console.error("Error initializing image cache", e);
    }
    this.logStartupEvent("Image cache initialized");

    try {
      this.isReady = true;
      switchToExcalidraw(this.app);
      this.switchToExcalidarwAfterLoad();
    } catch (e) {
      new Notice("Error switching views to Excalidraw", 6000);
      console.error("Error switching views to Excalidraw", e);
    }
    this.logStartupEvent("Switched to Excalidraw views");

    try {
      if (this.settings.showReleaseNotes) {
        //I am repurposing imageElementNotice, if the value is true, this means the plugin was just newly installed to Obsidian.
        const obsidianJustInstalled = (this.settings.previousRelease === "0.0.0") || !this.settings.previousRelease;

        if (isVersionNewerThanOther(PLUGIN_VERSION, this.settings.previousRelease ?? "0.0.0")) {
          new ReleaseNotes(
            this.app,
            this,
            obsidianJustInstalled ? null : PLUGIN_VERSION,
          ).open();
        }
      }
    } catch (e) {
      new Notice("Error opening release notes", 6000);
      console.error("Error opening release notes", e);
    }
    this.logStartupEvent("Release notes opened");

    //---------------------------------------------------------------------
    //initialization that can happen after Excalidraw views are initialized
    //---------------------------------------------------------------------      
    try {
      this.registerEventListeners();
    } catch (e) {
      new Notice("Error registering event listeners", 6000);
      console.error("Error registering event listeners", e);
    }
    this.logStartupEvent("Event listeners registered");

    try { 
      this.runStartupScript();
    } catch (e) {
      new Notice("Error running startup script", 6000);
      console.error("Error running startup script", e);
    }
    this.logStartupEvent("Startup script run");

    try {
      this.editorHandler = new EditorHandler(this);
      this.editorHandler.setup();
    } catch (e) {
      new Notice("Error setting up editor handler", 6000);
      console.error("Error setting up editor handler", e);
    }
    this.logStartupEvent("Editor handler initialized");

    try {
      this.registerInstallCodeblockProcessor();
    } catch (e) {
      new Notice("Error registering script install-codeblock processor", 6000);
      console.error("Error registering script install-codeblock processor", e);
    }
    this.logStartupEvent("Script install-codeblock processor registered");

    try {
      this.registerCommands();
    } catch (e) {
      new Notice("Error registering commands", 6000);
      console.error("Error registering commands", e);
    }
    this.logStartupEvent("Commands registered");

    try {
      this.registerEditorSuggest(new FieldSuggester(this));
    } catch (e) {
      new Notice("Error registering editor suggester", 6000);
      console.error("Error registering editor suggester", e);
    }
    this.logStartupEvent("Editor suggester registered");

    try {
      this.setPropertyTypes();
    } catch (e) {
      new Notice("Error setting up property types", 6000);
      console.error("Error setting up property types", e);
    }
    this.logStartupEvent("Property types set");

    try {
      this.taskbone = new Taskbone(this);
    } catch (e) {
      new Notice("Error setting up taskbone", 6000);
      console.error("Error setting up taskbone", e);
    }
    this.logStartupEvent("Taskbone set up");
  }

  public async awaitSettings() {
    let counter = 0;
    while(!this.settingsReady && counter < 150) {
      await sleep(20);
    }
  }

  public async awaitInit() {
    let counter = 0;
    while(!this.isReady && counter < 150) {
      await sleep(50);
    }
  }

  /**
   * Loads the Excalidraw frontmatter tags to Obsidian property suggester so people can more easily find relevant front matter switches
   * Must run after the workspace is ready
   * @returns 
   */
  private async setPropertyTypes() {
    if(!this.settings.loadPropertySuggestions) return;
    const app = this.app;
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.setPropertyTypes, `ExcalidrawPlugin.setPropertyTypes`);
    Object.keys(FRONTMATTER_KEYS).forEach((key) => {
      if(FRONTMATTER_KEYS[key].depricated === true) return;
      const {name, type} = FRONTMATTER_KEYS[key];
      app.metadataTypeManager.setType(name,type);
    });
  }

  public async initializeFonts() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.initializeFonts, `ExcalidrawPlugin.initializeFonts`);
    const cjkFontDataURLs = await getCJKDataURLs(this);
    if(typeof cjkFontDataURLs === "boolean" && !cjkFontDataURLs) {
      new Notice(t("FONTS_LOAD_ERROR") + this.settings.fontAssetsPath,6000);
    }

    if(typeof cjkFontDataURLs === "object") {
      const fontDeclarations = cjkFontDataURLs.map(dataURL => 
        `@font-face { font-family: 'Xiaolai'; src: url("${dataURL}"); font-display: swap; font-weight: 400; }`
      );
      for(const ownerDocument of this.getOpenObsidianDocuments()) {
        await this.addFonts(fontDeclarations, ownerDocument, CJK_STYLE_ID);
      };
      new Notice(t("FONTS_LOADED"));
    }

    const font = await getFontDataURL(
      this.app,
      this.settings.experimantalFourthFont,
      "",
      "Local Font",
    );
    
    if(font.dataURL === "") {
      this.fourthFontLoaded = true;
      return;
    }
    
    const fourthFontDataURL = font.dataURL;

    const f = this.app.metadataCache.getFirstLinkpathDest(this.settings.experimantalFourthFont, "");
    // Call getFontMetrics with the fourthFontDataURL
    let fontMetrics = f.extension.startsWith("woff") ? undefined : await getFontMetrics(fourthFontDataURL, "Local Font");
    
    if (!fontMetrics) {
      console.log("Font Metrics not found, using default");
      fontMetrics = {
        unitsPerEm: 1000,
        ascender: 750,
        descender: -250,
        lineHeight: 1.2,
        fontName: "Local Font",
      }
    }
    this.packageMap.forEach(({excalidrawLib}) => {
      (excalidrawLib as typeof ExcalidrawLib).registerLocalFont({metrics: fontMetrics as any, icon: null}, fourthFontDataURL);
    });
    // Add fonts to open Obsidian documents
    for(const ownerDocument of this.getOpenObsidianDocuments()) {
      await this.addFonts([
        `@font-face{font-family:'Local Font';src:url("${fourthFontDataURL}");font-display: swap;font-weight: 400;`,
      ], ownerDocument);
    };
    if(!this.fourthFontLoaded) setTimeout(()=>{this.fourthFontLoaded = true},100);
  }

  public async addFonts(declarations: string[],ownerDocument:Document = document, styleId:string = FONTS_STYLE_ID) {
    // replace the old local font <style> element with the one we just created
    const newStylesheet = ownerDocument.createElement("style");
    newStylesheet.id = styleId;
    newStylesheet.textContent = declarations.join("");
    const oldStylesheet = ownerDocument.getElementById(styleId);
    ownerDocument.head.appendChild(newStylesheet);
    if (oldStylesheet) {
      ownerDocument.head.removeChild(oldStylesheet);
    }
    await ownerDocument.fonts.load('20px Local Font');
  }

  public removeFonts() {
    this.getOpenObsidianDocuments().forEach((ownerDocument) => {
      const oldCustomFontStylesheet = ownerDocument.getElementById(FONTS_STYLE_ID);
      if (oldCustomFontStylesheet) {
        ownerDocument.head.removeChild(oldCustomFontStylesheet);
      }
      const oldCJKFontStylesheet = ownerDocument.getElementById(CJK_STYLE_ID);
      if (oldCJKFontStylesheet) {
        ownerDocument.head.removeChild(oldCJKFontStylesheet);
      }
    });
  }
  
  private getOpenObsidianDocuments(): Document[] {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.getOpenObsidianDocuments,`ExcalidrawPlugin.getOpenObsidianDocuments`);
    const visitedDocs = new Set<Document>();
    this.app.workspace.iterateAllLeaves((leaf)=>{
      const ownerDocument = DEVICE.isMobile?document:leaf.view.containerEl.ownerDocument;   
      if(!ownerDocument) return;        
      if(visitedDocs.has(ownerDocument)) return;
      visitedDocs.add(ownerDocument);
    });
    return Array.from(visitedDocs);
  }

  /**
   * Must be called after the workspace is ready
   */
  private switchToExcalidarwAfterLoad() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.switchToExcalidarwAfterLoad, `ExcalidrawPlugin.switchToExcalidarwAfterLoad`);
    let leaf: WorkspaceLeaf;
    for (leaf of this.app.workspace.getLeavesOfType("markdown")) {
      if ( leaf.view instanceof MarkdownView && this.isExcalidrawFile(leaf.view.file)) {
        if (fileShouldDefaultAsExcalidraw(leaf.view.file?.path, this.app)) {
          this.excalidrawFileModes[(leaf as any).id || leaf.view.file.path] =
            VIEW_TYPE_EXCALIDRAW;
          setExcalidrawView(leaf);
        } else {
          foldExcalidrawSection(leaf.view);
        }
      }
    }
  }

  private forceSaveActiveView(checking:boolean):boolean {
    if (checking) {
      return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView));
    }
    const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
    if (view) {
      view.forceSave();
      return true;
    }
    return false;
  }

  private registerInstallCodeblockProcessor() {
    const codeblockProcessor = async (source: string, el: HTMLElement) => {
      //Button next to the "List of available scripts" at the top
      //In try/catch block because this approach is very error prone, depends on
      //MarkdownRenderer() and index.md structure, in case these are not as
      //expected this code will break
      let button2: HTMLButtonElement = null;
      try {
        const link: HTMLElement = el.parentElement.querySelector(
          `a[href="#${el.previousElementSibling.getAttribute(
            "data-heading",
          )}"]`,
        );
        link.style.paddingRight = "10px";
        button2 = link.parentElement.createEl("button", null, (b) => {
          b.setText(t("UPDATE_SCRIPT"));
          b.addClass("mod-muted");
          b.style.backgroundColor = "var(--interactive-success)";
          b.style.display = "none";
        });
      } catch (e) {
        errorlog({
          where: "this.registerInstallCodeblockProcessor",
          source,
          error: e,
        });
      }

      source = source.trim();
      el.createEl("button", null, async (button) => {
        const setButtonText = (
          text: "CHECKING" | "INSTALL" | "UPTODATE" | "UPDATE" | "ERROR",
        ) => {
          if (button2) {
            button2.style.display = "none";
          }
          switch (text) {
            case "CHECKING":
              button.setText(t("CHECKING_SCRIPT"));
              button.style.backgroundColor = "var(--interactive-normal)";
              break;
            case "INSTALL":
              button.setText(t("INSTALL_SCRIPT"));
              button.style.backgroundColor = "var(--interactive-accent)";
              break;
            case "UPTODATE":
              button.setText(t("UPTODATE_SCRIPT"));
              button.style.backgroundColor = "var(--interactive-normal)";
              break;
            case "UPDATE":
              button.setText(t("UPDATE_SCRIPT"));
              button.style.backgroundColor = "var(--interactive-success)";
              if (button2) {
                button2.style.display = null;
              }
              break;
            case "ERROR":
              button.setText(t("UNABLETOCHECK_SCRIPT"));
              button.style.backgroundColor = "var(--interactive-normal)";
              break;
          }
        };
        button.addClass("mod-muted");
        let decodedURI = source;
        try {
          decodedURI = decodeURI(source);
        } catch (e) {
          errorlog({
            where:
              "ExcalidrawPlugin.registerInstallCodeblockProcessor.codeblockProcessor.onClick",
            source,
            error: e,
          });
        }
        const fname = decodedURI.substring(decodedURI.lastIndexOf("/") + 1);
        const folder = `${this.settings.scriptFolderPath}/${SCRIPT_INSTALL_FOLDER}`;
        const downloaded = app.vault.getFiles().filter(f=>f.path.startsWith(folder) && f.name === fname).sort((a,b)=>a.path>b.path?1:-1);
        let scriptFile = downloaded[0]; 
        const scriptPath = scriptFile?.path ?? `${folder}/${fname}`;
        const svgPath = getIMGFilename(scriptPath, "svg");
        let svgFile = this.app.vault.getAbstractFileByPath(svgPath);
        setButtonText(scriptFile ? "CHECKING" : "INSTALL");
        button.onclick = async () => {
          const download = async (
            url: string,
            file: TFile,
            localPath: string,
          ): Promise<TFile> => {
            const data = await request({ url });
            if (!data || data.startsWith("404: Not Found")) {
              return null;
            }
            if (file) {
              await this.app.vault.modify(file as TFile, data);
            } else {
              await checkAndCreateFolder(folder);
              file = await this.app.vault.create(localPath, data);
            }
            return file;
          };

          try {
            scriptFile = await download(
              source,
              scriptFile as TFile,
              scriptPath,
            );
            if (!scriptFile) {
              setButtonText("ERROR");
              throw "File not found";
            }
            svgFile = await download(
              getIMGFilename(source, "svg"),
              svgFile as TFile,
              svgPath,
            );
            setButtonText("UPTODATE");
            if(Object.keys(this.scriptEngine.scriptIconMap).length === 0) {
              this.scriptEngine.loadScripts();
            }
            new Notice(`Installed: ${(scriptFile as TFile).basename}`);
          } catch (e) {
            new Notice(`Error installing script: ${fname}`);
            errorlog({
              where:
                "ExcalidrawPlugin.registerInstallCodeblockProcessor.codeblockProcessor.onClick",
              error: e,
            });
          }
        };
        if (button2) {
          button2.onclick = button.onclick;
        }

        //check modified date on github
        //https://superuser.com/questions/1406875/how-to-get-the-latest-commit-date-of-a-file-from-a-given-github-reposotiry
        if (!scriptFile || !(scriptFile instanceof TFile)) {
          return;
        }

        const files = new Map<string, number>();
        JSON.parse(
          await request({
            url: "https://raw.githubusercontent.com/zsviczian/obsidian-excalidraw-plugin/master/ea-scripts/directory-info.json",
          }),
        ).forEach((f: any) => files.set(f.fname, f.mtime));

        const checkModifyDate = (
          gitFilename: string,
          file: TFile,
        ): "ERROR" | "UPDATE" | "UPTODATE" => {
          if (files.size === 0 || !files.has(gitFilename)) {
            //setButtonText("ERROR");
            return "ERROR";
          }
          const mtime = files.get(gitFilename);
          if (!file || mtime > file.stat.mtime) {
            //setButtonText("UPDATE");
            return "UPDATE";
          }
          return "UPTODATE";
        };

        const scriptButtonText = checkModifyDate(fname, scriptFile);
        const svgButtonText = checkModifyDate(
          getIMGFilename(fname, "svg"),
          !svgFile || !(svgFile instanceof TFile) ? null : svgFile,
        );

        setButtonText(
          scriptButtonText === "UPTODATE" && svgButtonText === "UPTODATE"
            ? "UPTODATE"
            : scriptButtonText === "UPTODATE" && svgButtonText === "ERROR"
            ? "UPTODATE"
            : scriptButtonText === "ERROR"
            ? "ERROR"
            : scriptButtonText === "UPDATE" || svgButtonText === "UPDATE"
            ? "UPDATE"
            : "UPTODATE",
        );
      });
    };

    this.registerMarkdownCodeBlockProcessor(
      SCRIPT_INSTALL_CODEBLOCK,
      async (source, el) => {
        el.addEventListener(RERENDER_EVENT, async (e) => {
          e.stopPropagation();
          el.empty();
          codeblockProcessor(source, el);
        });
        codeblockProcessor(source, el);
      },
    );
  }

  /**
   * Displays a transcluded .excalidraw image in markdown preview mode
   */
  private addMarkdownPostProcessor() {
    //Licat: Are you registering your post processors in onLayoutReady? You should register them in onload instead
    initializeMarkdownPostProcessor(this);
    this.registerMarkdownPostProcessor(markdownPostProcessor);
    
    this.app.workspace.onLayoutReady(async () => {
      (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.addMarkdownPostProcessor, `ExcalidrawPlugin.addMarkdownPostProcessor > app.workspace.onLayoutReady`);
      await this.awaitInit();
      // internal-link quick preview
      this.registerEvent(this.app.workspace.on("hover-link", hoverEvent));

      //only add the legacy file observer if there are legacy files in the vault
      if(this.app.vault.getFiles().some(f=>f.extension === "excalidraw")) {
        this.enableLegacyFilePopoverObserver();
      }
    });
  }

  public enableLegacyFilePopoverObserver() {
    if(!this.legacyExcalidrawPopoverObserver) {
      (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.enableLegacyFilePopoverObserver, `ExcalidrawPlugin.enableLegacyFilePopoverObserver > enabling`)
      //monitoring for div.popover.hover-popover.file-embed.is-loaded to be added to the DOM tree
      this.legacyExcalidrawPopoverObserver = legacyExcalidrawPopoverObserver;
      this.legacyExcalidrawPopoverObserver.observe(document.body, { childList: true, subtree: false });
    }
  }

  private async actionRibbonClick(e: MouseEvent)  {
    this.createAndOpenDrawing(
      getDrawingFilename(this.settings),
      linkClickModifierType(emulateCTRLClickForLinks(e)),
    ); 
  }

  private registerCommands() {
    this.openDialog = new OpenFileDialog(this.app, this);
    this.insertLinkDialog = new InsertLinkDialog(this);
    this.insertCommandDialog = new InsertCommandDialog(this.app);
    this.insertImageDialog = new InsertImageDialog(this);
    this.importSVGDialog = new ImportSVGDialog(this);
    this.insertMDDialog = new InsertMDDialog(this);

    const createNewAction = (e: MouseEvent | KeyboardEvent, file: TFile) => {
      let folderpath = file.path;
      if (file instanceof TFile) {
        folderpath = normalizePath(
          file.path.substr(0, file.path.lastIndexOf(file.name)),
        );
      }
      this.createAndOpenDrawing(
        getDrawingFilename(this.settings),
        linkClickModifierType(emulateCTRLClickForLinks(e)),
        folderpath,
      );
    }

    const fileMenuHandlerCreateNew = (menu: Menu, file: TFile) => {
      menu.addItem((item: MenuItem) => {
        item
          .setTitle(t("CREATE_NEW"))
          .setIcon(ICON_NAME)
          .onClick((e) => {createNewAction(e, file)});
      });
    };

    this.registerEvent(
      this.app.workspace.on("file-menu", fileMenuHandlerCreateNew),
    );

    const fileMenuHandlerConvertKeepExtension = (menu: Menu, file: TFile) => {
      if (file instanceof TFile && file.extension == "excalidraw") {
        menu.addItem((item: MenuItem) => {
          item.setTitle(t("CONVERT_FILE_KEEP_EXT")).onClick(() => {
            this.convertSingleExcalidrawToMD(file, false, false);
          });
        });
      }
    };

    this.registerEvent(
      this.app.workspace.on("file-menu", fileMenuHandlerConvertKeepExtension),
    );

    const fileMenuHandlerConvertReplaceExtension = (
      menu: Menu,
      file: TFile,
    ) => {
      if (file instanceof TFile && file.extension == "excalidraw") {
        menu.addItem((item: MenuItem) => {
          item.setTitle(t("CONVERT_FILE_REPLACE_EXT")).onClick(() => {
            this.convertSingleExcalidrawToMD(file, true, true);
          });
        });
      }
    };

    this.registerEvent(
      this.app.workspace.on(
        "file-menu",
        fileMenuHandlerConvertReplaceExtension,
      ),
    );

    this.addCommand({
      id: "excalidraw-convert-image-from-url-to-local-file",
      name: t("CONVERT_URL_TO_FILE"),
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if(!view) return false;
        const img = view.getSingleSelectedImage();
        if(!img || !img.embeddedFile?.isHyperLink) return false;
        if(checking) return true;
        view.convertImageElWithURLToLocalFile(img);
      },
    });

    this.addCommand({
      id: "excalidraw-unzip-file",
      name: t("UNZIP_CURRENT_FILE"),
      checkCallback: (checking: boolean) => {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
          return false;
        }
        const fileIsExcalidraw = this.isExcalidrawFile(activeFile);
        if (!fileIsExcalidraw) {
          return false;
        }

        const excalidrawView = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (excalidrawView) {
          return false;
        }

        if (checking) {
          return true;
        }

        (async () => {
          const data = await this.app.vault.read(activeFile);
          const parts = data.split("\n## Drawing\n```compressed-json\n");
          if(parts.length!==2) return;
          const header = parts[0] + "\n## Drawing\n```json\n";
          const compressed = parts[1].split("\n```\n%%");
          if(compressed.length!==2) return;
          const decompressed = decompress(compressed[0]);
          if(!decompressed) {
            new Notice("The compressed string is corrupted. Unable to decompress data.");
            return;
          }
          await this.app.vault.modify(activeFile,header + decompressed + "\n```\n%%" + compressed[1]);
        })();

      }
    })

    this.addCommand({
      id: "excalidraw-publish-svg-check",
      name: t("PUBLISH_SVG_CHECK"),
      checkCallback: (checking: boolean) => {
        const publish = app.internalPlugins.plugins["publish"].instance;
        if (!publish) {
          return false;
        }
        if (checking) {
          return true;
        }
        (new PublishOutOfDateFilesDialog(this)).open();
      }
    })

    this.addCommand({
      id: "excalidraw-embeddable-poroperties",
      name: t("EMBEDDABLE_PROPERTIES"),
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if(!view) return false;
        if(!view.excalidrawAPI) return false;
        const els = view.getViewSelectedElements().filter(el=>el.type==="embeddable") as ExcalidrawEmbeddableElement[];
        if(els.length !== 1) {
          if(checking) return false;
          new Notice("Select a single embeddable element and try again");
          return false;
        }
        if(checking) return true;
        const getFile = (el:ExcalidrawEmbeddableElement):TFile => {
          const res = REGEX_LINK.getRes(el.link).next();
          if(!res || (!res.value && res.done)) {
            return null;
          }
          const link = REGEX_LINK.getLink(res);
          const { file } = processLinkText(link, view);
          return file;
        }
        new EmbeddableSettings(view.plugin,view,getFile(els[0]),els[0]).open();
      }
    })

    this.addCommand({
      id: "excalidraw-embeddables-relative-scale",
      name: t("EMBEDDABLE_RELATIVE_ZOOM"),
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if(!view) return false;
        if(!view.excalidrawAPI) return false;
        const els = view.getViewSelectedElements().filter(el=>el.type==="embeddable") as ExcalidrawEmbeddableElement[];
        if(els.length === 0) {
          if(checking) return false;
          new Notice("Select at least one embeddable element and try again");
          return false;
        }
        if(checking) return true;
        const ea = getEA(view) as ExcalidrawAutomate;
        const api = ea.getExcalidrawAPI() as ExcalidrawImperativeAPI;
        ea.copyViewElementsToEAforEditing(els);
        const scale = 1/api.getAppState().zoom.value;
        ea.getElements().forEach((el: Mutable<ExcalidrawEmbeddableElement>)=>{
          el.scale = [scale,scale];
        })
        ea.addElementsToView().then(()=>ea.destroy());
      }
    })

    this.addCommand({
      id: "open-image-excalidraw-source",
      name: t("OPEN_IMAGE_SOURCE"),
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if(!view) return false;
        if(view.leaf !== this.app.workspace.activeLeaf) return false;
        const editor = view.editor;
        if(!editor) return false;
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        const fname = extractSVGPNGFileName(line);
        if(!fname) return false;
        const imgFile = this.app.metadataCache.getFirstLinkpathDest(fname, view.file.path);
        if(!imgFile) return false;
        const excalidrawFname = getIMGFilename(imgFile.path, "md");
        let excalidrawFile = this.app.metadataCache.getFirstLinkpathDest(excalidrawFname, view.file.path);
        if(!excalidrawFile) {
          if(excalidrawFname.endsWith(".dark.md")) {
            excalidrawFile = this.app.metadataCache.getFirstLinkpathDest(excalidrawFname.replace(/\.dark\.md$/,".md"), view.file.path);
          }
          if(excalidrawFname.endsWith(".light.md")) {
            excalidrawFile = this.app.metadataCache.getFirstLinkpathDest(excalidrawFname.replace(/\.light\.md$/,".md"), view.file.path);
          }
          if(!excalidrawFile) return false;
        }
        if(checking) return true;
        this.fileManager.openDrawing(excalidrawFile, "new-tab", true);
      }
    });

    this.addCommand({
      id: "excalidraw-disable-autosave",
      name: t("TEMPORARY_DISABLE_AUTOSAVE"),
      checkCallback: (checking) => {
        if(!this.settings.autosave) return false; //already disabled
        if(checking) return true;
        this.settings.autosave = false;
        return true;
      }
    })

    this.addCommand({
      id: "excalidraw-enable-autosave",
      name: t("TEMPORARY_ENABLE_AUTOSAVE"),
      checkCallback: (checking) => {
        if(this.settings.autosave) return false; //already enabled
        if(checking) return true;
        this.settings.autosave = true;
        return true;
      }
    })    

    this.addCommand({
      id: "excalidraw-download-lib",
      name: t("DOWNLOAD_LIBRARY"),
      callback: ()=>this.fileManager.exportLibrary(),
    });

    this.addCommand({
      id: "excalidraw-open",
      name: t("OPEN_EXISTING_NEW_PANE"),
      callback: () => {
        this.openDialog.start(openDialogAction.openFile, true);
      },
    });

    this.addCommand({
      id: "excalidraw-open-on-current",
      name: t("OPEN_EXISTING_ACTIVE_PANE"),
      callback: () => {
        this.openDialog.start(openDialogAction.openFile, false);
      },
    });

    this.addCommand({
      id: "excalidraw-insert-transclusion",
      name: t("TRANSCLUDE"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(MarkdownView)) 
        }
        this.openDialog.start(openDialogAction.insertLinkToDrawing, false);
        return true;
      },
    });

    this.addCommand({
      id: "excalidraw-insert-last-active-transclusion",
      name: t("TRANSCLUDE_MOST_RECENT"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (
            Boolean(this.app.workspace.getActiveViewOfType(MarkdownView)) &&
            this.lastActiveExcalidrawFilePath !== null
          );
        }
        const file = this.app.vault.getAbstractFileByPath(
          this.lastActiveExcalidrawFilePath,
        );
        if (!(file instanceof TFile)) {
          return false;
        }
        this.fileManager.embedDrawing(file);
        return true;
      },
    });

    this.addCommand({
      id: "excalidraw-autocreate",
      name: t("NEW_IN_NEW_PANE"),
      callback: () => {
        this.createAndOpenDrawing(getDrawingFilename(this.settings), "new-pane");
      },
    });

    this.addCommand({
      id: "excalidraw-autocreate-newtab",
      name: t("NEW_IN_NEW_TAB"),
      callback: () => {
        this.createAndOpenDrawing(getDrawingFilename(this.settings), "new-tab");
      },
    });

    this.addCommand({
      id: "excalidraw-autocreate-on-current",
      name: t("NEW_IN_ACTIVE_PANE"),
      callback: () => {
        this.createAndOpenDrawing(getDrawingFilename(this.settings), "active-pane");
      },
    });

    this.addCommand({
      id: "excalidraw-autocreate-popout",
      name: t("NEW_IN_POPOUT_WINDOW"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return !DEVICE.isMobile;
        }
        this.createAndOpenDrawing(getDrawingFilename(this.settings), "popout-window");
      },
    });

    const insertDrawingToDoc = async (
      location: PaneTarget
    ) => {
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!activeView) {
        return;
      }
      const filename = getEmbedFilename(
        activeView.file.basename,
        this.settings,
      );
      const folder = this.settings.embedUseExcalidrawFolder
        ? null
        : (
            await getAttachmentsFolderAndFilePath(
              this.app,
              activeView.file.path,
              filename,
            )
          ).folder;
      const file = await this.createDrawing(filename, folder);
      await this.fileManager.embedDrawing(file);
      this.fileManager.openDrawing(file, location, true, undefined, true);
    };

    this.addCommand({
      id: "excalidraw-autocreate-and-embed",
      name: t("NEW_IN_NEW_PANE_EMBED"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(MarkdownView));
        }
        insertDrawingToDoc("new-pane");
        return true;
      },
    });

    this.addCommand({
      id: "excalidraw-autocreate-and-embed-new-tab",
      name: t("NEW_IN_NEW_TAB_EMBED"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(MarkdownView));
        }
        insertDrawingToDoc("new-tab");
        return true;
      },
    });

    this.addCommand({
      id: "excalidraw-autocreate-and-embed-on-current",
      name: t("NEW_IN_ACTIVE_PANE_EMBED"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(MarkdownView));
        }
        insertDrawingToDoc("active-pane");
        return true;
      },
    });

    this.addCommand({
      id: "excalidraw-autocreate-and-embed-popout",
      name: t("NEW_IN_POPOUT_WINDOW_EMBED"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return !DEVICE.isMobile && Boolean(this.app.workspace.getActiveViewOfType(MarkdownView));
        }
        insertDrawingToDoc("popout-window");
        return true;
      },
    });    

    this.addCommand({
      id: "run-ocr",
      name: t("RUN_OCR"),
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (checking) {
          return (
            Boolean(view)
          );
        }
        if (view) {
          if(!this.settings.taskboneEnabled) {
            new Notice("Taskbone OCR is not enabled. Please go to plugins settings to enable it.",4000);
            return true;
          }
          this.taskbone.getTextForView(view, {forceReScan: false});
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "rerun-ocr",
      name: t("RERUN_OCR"),
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (checking) {
          return (
            Boolean(view)
          );
        }
        if (view) {
          if(!this.settings.taskboneEnabled) {
            new Notice("Taskbone OCR is not enabled. Please go to plugins settings to enable it.",4000);
            return true;
          }
          this.taskbone.getTextForView(view, {forceReScan: true});
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "run-ocr-selectedelements",
      name: t("RUN_OCR_ELEMENTS"),
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (checking) {
          return (
            Boolean(view)
          );
        }
        if (view) {
          if(!this.settings.taskboneEnabled) {
            new Notice("Taskbone OCR is not enabled. Please go to plugins settings to enable it.",4000);
            return true;
          }
          this.taskbone.getTextForView(view, {forceReScan: false, selectedElementsOnly: true, addToFrontmatter: false});
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "search-text",
      name: t("SEARCH"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (
            Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
          );
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          search(view);
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "fullscreen",
      name: t("TOGGLE_FULLSCREEN"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (
            Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
          );
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          if (view.isFullscreen()) {
            view.exitFullscreen();
          } else {
            view.gotoFullscreen();
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "disable-binding",
      name: t("TOGGLE_DISABLEBINDING"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (
            Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
          );
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          view.toggleDisableBinding();
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "disable-framerendering",
      name: t("TOGGLE_FRAME_RENDERING"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (
            Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
          );
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          view.toggleFrameRendering();
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "frame-settings",
      name: t("FRAME_SETTINGS_TITLE"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (
            Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
          );
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          showFrameSettings(getEA(view));
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "copy-link-to-drawing",
      name: t("COPY_DRAWING_LINK"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (
            Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
          );
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          navigator.clipboard.writeText(`![[${view.file.path}]]`);
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "disable-frameclipping",
      name: t("TOGGLE_FRAME_CLIPPING"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (
            Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
          );
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          view.toggleFrameClipping();
          return true;
        }
        return false;
      },
    });


    this.addCommand({
      id: "export-image",
      name: t("EXPORT_IMAGE"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (
            Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
          );
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          if(!view.exportDialog) {
            view.exportDialog = new ExportDialog(this, view,view.file);
            view.exportDialog.createForm();
          }
          view.exportDialog.open();
          return true;
        }
        return false;
      },
    });

    this.forceSaveCommand = this.addCommand({
      id: "save",
      hotkeys: [{modifiers: ["Ctrl"], key:"s"}], //See also Poposcope
      name: t("FORCE_SAVE"),
      checkCallback: (checking:boolean) => this.forceSaveActiveView(checking),
    })

    this.addCommand({
      id: "toggle-lock",
      name: t("TOGGLE_LOCK"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          if (
            Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
          ) {
            return !(this.app.workspace.getActiveViewOfType(ExcalidrawView))
              .compatibilityMode;
          }
          return false;
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view && !view.compatibilityMode) {
          view.changeTextMode(
            view.textMode === TextMode.parsed ? TextMode.raw : TextMode.parsed,
          );
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "scriptengine-store",
      name: t("INSTALL_SCRIPT_BUTTON"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (
            Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
          );
        }
        new ScriptInstallPrompt(this).open();
        return true;
      },
    });

    this.addCommand({
      id: "delete-file",
      name: t("DELETE_FILE"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          this.ea.reset();
          this.ea.setView(view);
          const el = this.ea.getViewSelectedElement();
          if (el.type !== "image") {
            new Notice(
              "Please select an image or embedded markdown document",
              4000,
            );
            return true;
          }
          const file = this.ea.getViewFileForImageElement(el);
          if (!file) {
            new Notice(
              "Please select an image or embedded markdown document",
              4000,
            );
            return true;
          }
          this.app.vault.delete(file);
          this.ea.deleteViewElements([el]);
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "convert-text2MD",
      name: t("CONVERT_TO_MARKDOWN"),
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView)
        if(!view) return false;
        const selectedTextElements = view.getViewSelectedElements().filter(el=>el.type === "text");
        if(selectedTextElements.length !==1 ) return false;
        const selectedTextElement = selectedTextElements[0] as ExcalidrawTextElement;
        const containerElement = (view.getViewElements() as ExcalidrawElement[]).find(el=>el.id === selectedTextElement.containerId);
        if(containerElement && containerElement.type === "arrow") return false;
        if(checking) return true;
        view.convertTextElementToMarkdown(selectedTextElement, containerElement);
      }
    })

    this.addCommand({
      id: "insert-link",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "k" }],
      name: t("INSERT_LINK"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          this.insertLinkDialog.start(view.file.path, (markdownlink: string, path:string, alias:string) => view.addLink(markdownlink, path, alias));
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "insert-command",
      name: t("INSERT_COMMAND"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          this.insertCommandDialog.start((text: string, fontFamily?: 1 | 2 | 3 | 4, save?: boolean) => view.addText(text, fontFamily, save));
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "insert-link-to-element",
      name: t("INSERT_LINK_TO_ELEMENT_NORMAL"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          view.copyLinkToSelectedElementToClipboard("");
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "insert-link-to-element-group",
      name: t("INSERT_LINK_TO_ELEMENT_GROUP"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          view.copyLinkToSelectedElementToClipboard("group=");
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "insert-link-to-element-frame",
      name: t("INSERT_LINK_TO_ELEMENT_FRAME"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView));
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          view.copyLinkToSelectedElementToClipboard("frame=");
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "insert-link-to-element-frame-clipped",
      name: t("INSERT_LINK_TO_ELEMENT_FRAME_CLIPPED"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView));
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          view.copyLinkToSelectedElementToClipboard("clippedframe=");
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "insert-link-to-element-area",
      name: t("INSERT_LINK_TO_ELEMENT_AREA"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          view.copyLinkToSelectedElementToClipboard("area=");
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "toggle-lefthanded-mode",
      name: t("TOGGLE_LEFTHANDED_MODE"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          if(this.app.workspace.getActiveViewOfType(ExcalidrawView)) {
            const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
            const api = view?.excalidrawAPI;
            if(!api) return false;
            const st = api.getAppState();
            if(!st.trayModeEnabled) return false;
            return true;
          }
          return false;
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        (async()=>{
          const isLeftHanded = this.settings.isLeftHanded;
          await this.loadSettings({applyLefthandedMode: false});
          this.settings.isLeftHanded = !isLeftHanded;
          this.saveSettings();
          //not clear why I need to do this. If I don't double apply the stylesheet changes 
          //then the style won't be applied in the popout windows
          setLeftHandedMode(!isLeftHanded);
          setTimeout(()=>setLeftHandedMode(!isLeftHanded));
        })()
        return true;
      },
    });

    this.addCommand({
      id: "flip-image",
      name: t("FLIP_IMAGE"),
      checkCallback: (checking:boolean) => {
        if (!DEVICE.isDesktop) return;
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if(!view) return false;
        if(!view.excalidrawAPI) return false;
        const els = view
          .getViewSelectedElements()
          .filter(el=>{
            if(el.type==="image") {
              const ef = view.excalidrawData.getFile(el.fileId);
              if(!ef) {
                return false;
              }
              return this.isExcalidrawFile(ef.file);
            }
            return false;
          });
        if(els.length !== 1) {
          return false;
        }
        if(checking) return true;
        const el = els[0] as ExcalidrawImageElement;
        let ef = view.excalidrawData.getFile(el.fileId);
        this.forceToOpenInMarkdownFilepath = ef.file?.path;
        const appState = view.excalidrawAPI.getAppState();
        const {x:centerX,y:centerY} = sceneCoordsToViewportCoords({sceneX:el.x+el.width/2,sceneY:el.y+el.height/2},appState);
        const {width, height} = {width:600, height:600};
        const {x,y} = {
          x:Math.max(0,centerX - width/2 + view.ownerWindow.screenX),
          y:Math.max(0,centerY - height/2 + view.ownerWindow.screenY),
        }
      
        this.fileManager.openDrawing(ef.file, DEVICE.isMobile ? "new-tab":"popout-window", true, undefined, false, {x,y,width,height});
      }
    })

    this.addCommand({
      id: "reset-image-to-100",
      name: t("RESET_IMG_TO_100"),
      checkCallback: (checking:boolean) => {
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if(!view) return false;
        if(!view.excalidrawAPI) return false;
        const els = view.getViewSelectedElements().filter(el=>el.type==="image");
        if(els.length !== 1) {
          if(checking) return false;
          new Notice("Select a single image element and try again");
          return false;
        }
        if(checking) return true;
        
        (async () => {
          const el = els[0] as ExcalidrawImageElement;
          let ef = view.excalidrawData.getFile(el.fileId);
          if(!ef) {
            await view.forceSave();
            let ef = view.excalidrawData.getFile(el.fileId);
            new Notice("Select a single image element and try again");
            return false;
          }
  
          const ea = new ExcalidrawAutomate(this,view);
          const size = await ea.getOriginalImageSize(el);
          if(size) {
            ea.copyViewElementsToEAforEditing(els);
            const eaEl = ea.getElement(el.id) as Mutable<ExcalidrawImageElement>;
            if(eaEl.crop) {
              eaEl.width = eaEl.crop.width;
              eaEl.height = eaEl.crop.height;
            } else {
              eaEl.width = size.width; eaEl.height = size.height;
            }
            await ea.addElementsToView(false,false,false);
          }
          ea.destroy();
        })()
      }
    })

    this.addCommand({
      id: "reset-image-ar",
      name: t("RESET_IMG_ASPECT_RATIO"),
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (!view) return false;
        if (!view.excalidrawAPI) return false;
        const els = view.getViewSelectedElements().filter(el => el.type === "image");
        if (els.length !== 1) {
          if (checking) return false;
          new Notice("Select a single image element and try again");
          return false;
        }
        if (checking) return true;
    
        (async () => {
          const el = els[0] as ExcalidrawImageElement;
          let ef = view.excalidrawData.getFile(el.fileId);
          if (!ef) {
            await view.forceSave();
            let ef = view.excalidrawData.getFile(el.fileId);
            new Notice("Select a single image element and try again");
            return false;
          }
    
          const ea = new ExcalidrawAutomate(this, view);
          if (await ea.resetImageAspectRatio(el)) {
            await ea.addElementsToView(false, false, false);
          }
          ea.destroy();
        })();
      }
    });
    
    this.addCommand({
      id: "open-link-props",
      name: t("OPEN_LINK_PROPS"),
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (!view) return false;
        if (!view.excalidrawAPI) return false;
        const els = view.getViewSelectedElements().filter(el => el.type === "image");
        if (els.length !== 1) {
          if (checking) return false;
          new Notice("Select a single image element and try again");
          return false;
        }
        if (checking) return true;

        const el = els[0] as ExcalidrawImageElement;
        let ef = view.excalidrawData.getFile(el.fileId);
        let eq = view.excalidrawData.getEquation(el.fileId);
        if (!ef && !eq) {
          view.forceSave();
          new Notice("Please try again.");
          return false;
        }

        if(ef) {
          view.openEmbeddedLinkEditor(el.id);
        }
        if(eq) {
          view.openLaTeXEditor(el.id);
        }
      }
    });

    this.addCommand({
      id: "convert-card-to-file",
      name: t("CONVERT_CARD_TO_FILE"),
      checkCallback: (checking:boolean) => {
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if(!view) return false;
        if(!view.excalidrawAPI) return false;
        const els = view.getViewSelectedElements().filter(el=>el.type==="embeddable");
        if(els.length !== 1) {
          if(checking) return false;
          new Notice("Select a single back-of-the-note card and try again");
          return false;
        }
        const embeddableData = view.getEmbeddableLeafElementById(els[0].id);
        const child = embeddableData?.node?.child;
        if(!child || (child.file !== view.file)) {
          if(checking) return false;
          new Notice("The selected embeddable is not a back-of-the-note card.");
          return false;
        }
        if(checking) return true;
        view.moveBackOfTheNoteCardToFile();
      }
    })

    this.addCommand({
      id: "insert-active-pdfpage",
      name: t("INSERT_ACTIVE_PDF_PAGE_AS_IMAGE"),
      checkCallback: (checking:boolean) => {
        const excalidrawView = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if(!excalidrawView) return false;
        const embeddables = excalidrawView.getViewSelectedElements().filter(el=>el.type==="embeddable");
        if(embeddables.length !== 1) {
          if(checking) return false;
          new Notice("Select a single PDF embeddable and try again");
          return false;
        }
        const isPDF = excalidrawView.getEmbeddableLeafElementById(embeddables[0].id)?.leaf?.view?.getViewType() === "pdf"
        if(!isPDF) return false;
        const page = getActivePDFPageNumberFromPDFView(excalidrawView.getEmbeddableLeafElementById(embeddables[0].id)?.leaf?.view);
        if(!page) return false;
        if(checking) return true;

        const embeddableEl = embeddables[0] as ExcalidrawEmbeddableElement;
        const ea = new ExcalidrawAutomate(this,excalidrawView);
        //@ts-ignore
        const pdfFile: TFile = excalidrawView.getEmbeddableLeafElementById(embeddableEl.id)?.leaf?.view?.file;
        (async () => {
          const imgID = await ea.addImage(embeddableEl.x + embeddableEl.width + 10, embeddableEl.y, `${pdfFile?.path}#page=${page}`, false, false);
          const imgEl = ea.getElement(imgID) as Mutable<ExcalidrawImageElement>;
          const imageAspectRatio = imgEl.width / imgEl.height;
          if(imageAspectRatio > 1) {
            imgEl.width = embeddableEl.width;
            imgEl.height = embeddableEl.width / imageAspectRatio;
          } else {
            imgEl.height = embeddableEl.height;
            imgEl.width = embeddableEl.height * imageAspectRatio;
          }
          ea.addElementsToView(false, true, true);
        })()
      }
    })

    this.addCommand({
      id: "crop-image",
      name: t("CROP_IMAGE"),
      checkCallback: (checking:boolean) => {
        const excalidrawView = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
        const canvasView:any = this.app.workspace.activeLeaf?.view;
        const isCanvas = canvasView && canvasView.getViewType() === "canvas";
        if(!excalidrawView && !markdownView && !isCanvas) return false;

        if(excalidrawView) {
          if(!excalidrawView.excalidrawAPI) return false;
          const embeddables = excalidrawView.getViewSelectedElements().filter(el=>el.type==="embeddable");
          const imageEls = excalidrawView.getViewSelectedElements().filter(el=>el.type==="image");
          const isPDF = (imageEls.length === 0 && embeddables.length === 1 && excalidrawView.getEmbeddableLeafElementById(embeddables[0].id)?.leaf?.view?.getViewType() === "pdf")
          const isImage = (imageEls.length === 1 && embeddables.length === 0)

          if(!isPDF && !isImage) {
            if(checking) return false;
            new Notice("Select a single image element or single PDF embeddable and try again");
            return false;
          }

          //@ts-ignore
          const page = isPDF ? getActivePDFPageNumberFromPDFView(excalidrawView.getEmbeddableLeafElementById(embeddables[0].id)?.leaf?.view) : undefined;
          if(isPDF && !page) {
            return false;
          }

          if(checking) return true;

          if(isPDF) {
            const embeddableEl = embeddables[0] as ExcalidrawEmbeddableElement;
            const ea = new ExcalidrawAutomate(this,excalidrawView);
            //@ts-ignore
            const pdfFile: TFile = excalidrawView.getEmbeddableLeafElementById(embeddableEl.id)?.leaf?.view?.file;
            carveOutPDF(ea, embeddableEl, `${pdfFile?.path}#page=${page}`, pdfFile);
            return;
          }

          const imageEl = imageEls[0] as ExcalidrawImageElement;
          (async () => {
            let ef = excalidrawView.excalidrawData.getFile(imageEl.fileId);

            if(!ef) {
              await excalidrawView.save();
              await sleep(500);
              ef = excalidrawView.excalidrawData.getFile(imageEl.fileId);
              if(!ef) {             
                new Notice("Select a single image element and try again");
                return false;
              }
            }
            const ea = new ExcalidrawAutomate(this,excalidrawView);
            carveOutImage(ea, imageEl);
          })();
        }

        const carveout = async (isFile: boolean, sourceFile: TFile, imageFile: TFile, imageURL: string, replacer: Function, ref?: string) => {
          const ea = getEA() as ExcalidrawAutomate;
          const imageID = await ea.addImage(
            0, 0,
            isFile
              ? ((isFile && imageFile.extension === "pdf" && ref) ? `${imageFile.path}#${ref}` : imageFile)
              : imageURL,
            false, false
          );
          if(!imageID) {
            new Notice(`Can't load image\n\n${imageURL}`);
            return;
          }
          
          let fnBase = "";
          let imageLink = "";
          if(isFile) {
            fnBase = imageFile.basename;
            imageLink = ref
              ? `[[${imageFile.path}#${ref}]]`
              : `[[${imageFile.path}]]`;
          } else {
            imageLink = imageURL;
            const imagename = imageURL.match(/^.*\/([^?]*)\??.*$/)?.[1];
            fnBase = imagename.substring(0,imagename.lastIndexOf("."));
          }
          
          const {folderpath, filename} = await getCropFileNameAndFolder(this,sourceFile.path,fnBase)
          const newFile = await createImageCropperFile(ea,imageID,imageLink,folderpath,filename);
          ea.destroy();
          if(!newFile) return;
          const link = this.app.metadataCache.fileToLinktext(newFile,sourceFile.path, true);
          replacer(link, newFile);
        }

        if(isCanvas) {
          const selectedNodes:any = [];
          canvasView.canvas.nodes.forEach((node:any) => {
            if(node.nodeEl.hasClass("is-focused")) selectedNodes.push(node);
          })
          if(selectedNodes.length !== 1) return false;
          const node = selectedNodes[0];
          let extension = "";
          let isExcalidraw = false;
          if(node.file) {
            extension = node.file.extension;
            isExcalidraw = this.isExcalidrawFile(node.file);
          }
          if(node.url) {
            extension = getURLImageExtension(node.url);
          }
          const page = extension === "pdf" ? getActivePDFPageNumberFromPDFView(node?.child) : undefined;
          if(!page && !IMAGE_TYPES.contains(extension) && !isExcalidraw) return false;
          if(checking) return true;

          const replacer = (link:string, file: TFile) => {
            if(node.file) {
              (node.file.extension === "pdf")
                ? node.canvas.createFileNode({pos:{x:node.x + node.width + 10,y: node.y}, file})
                : node.setFile(file);
            }
            if(node.url) {
              node.canvas.createFileNode({pos:{x:node.x + 20,y: node.y+20}, file});
            }
          }
          carveout(Boolean(node.file), canvasView.file, node.file, node.url, replacer, page ? `page=${page}` : undefined);
        }

        if (markdownView) {
          const editor = markdownView.editor;
          const cursor = editor.getCursor();
          const line = editor.getLine(cursor.line);
          const parts = REGEX_LINK.getResList(line);
          if(parts.length === 0) return false;
          let imgpath = REGEX_LINK.getLink(parts[0]);
          const isWikilink = REGEX_LINK.isWikiLink(parts[0]);
          let alias = REGEX_LINK.getAliasOrLink(parts[0]);
          if(alias === imgpath) alias = null;
          imgpath = decodeURI(imgpath);
          const imagePathParts = imgpath.split("#");
          const hasRef = imagePathParts.length === 2;
          const imageFile = this.app.metadataCache.getFirstLinkpathDest(
            hasRef ? imagePathParts[0] : imgpath,
            markdownView.file.path
          );
          const isFile = (imageFile && imageFile instanceof TFile);
          const isExcalidraw = isFile ? this.isExcalidrawFile(imageFile) : false;
          let imagepath = isFile ? imageFile.path : "";
          let extension = isFile ? imageFile.extension : "";
          if(imgpath.match(/^https?|file/)) {
            imagepath = imgpath;
            extension = getURLImageExtension(imgpath);
          }
          if(imagepath === "") return false;
          if(extension !== "pdf" && !IMAGE_TYPES.contains(extension) && !isExcalidraw) return false;
          if(checking) return true;
          const ref = imagePathParts[1];
          const replacer = (link:string) => {
            const lineparts = line.split(parts[0].value[0]) 
            const pdfLink = isFile && ref 
              ? "\n" + getLink(this ,{
                  embed: false,
                  alias: alias ?? `${imageFile.basename}, ${ref.replace("="," ")}`,
                  path:`${imageFile.path}#${ref}`
                }, isWikilink) 
              : "";
            editor.setLine(cursor.line,lineparts[0] + getLink(this ,{embed: true, path:link, alias}, isWikilink) + pdfLink + lineparts[1]);
          }
          carveout(isFile, markdownView.file, imageFile, imagepath, replacer, ref);
        }
      }
    })

    this.addCommand({
      id: "annotate-image",
      name: t("ANNOTATE_IMAGE"),
      checkCallback: (checking:boolean) => {
        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
        const canvasView:any = this.app.workspace.activeLeaf?.view;
        const isCanvas = canvasView && canvasView.getViewType() === "canvas";
        if(!markdownView && !isCanvas) return false;

        const carveout = async (isFile: boolean, sourceFile: TFile, imageFile: TFile, imageURL: string, replacer: Function, ref?: string) => {
          const ea = getEA() as ExcalidrawAutomate;
          const imageID = await ea.addImage(
            0, 0,
            isFile
              ? ((isFile && imageFile.extension === "pdf" && ref) ? `${imageFile.path}#${ref}` : imageFile)
              : imageURL,
            false, false
          );
          if(!imageID) {
            new Notice(`Can't load image\n\n${imageURL}`);
            ea.destroy();
            return;
          }
          const el = ea.getElement(imageID) as Mutable<ExcalidrawImageElement>;
          el.locked = true;
          const size = this.settings.annotatePreserveSize
            ? await getImageSize(ea.imagesDict[el.fileId].dataURL)
            : null;
          let fnBase = "";
          let imageLink = "";
          if(isFile) {
            fnBase = imageFile.basename;
            imageLink = ref
              ? `[[${imageFile.path}#${ref}]]`
              : `[[${imageFile.path}]]`;
          } else {
            imageLink = imageURL;
            const imagename = imageURL.match(/^.*\/([^?]*)\??.*$/)?.[1];
            fnBase = imagename.substring(0,imagename.lastIndexOf("."));
          }
          
          let template:TFile;
          const templates = getListOfTemplateFiles(this);
          if(templates) {
            template = await templatePromt(templates, this.app);
          }

          const {folderpath, filename} = await getAnnotationFileNameAndFolder(this,sourceFile.path,fnBase)
          const newPath = await ea.create ({
            templatePath: template?.path,
            filename,
            foldername: folderpath,
            onNewPane: true,
            frontmatterKeys: {
              ...this.settings.matchTheme ? {"excalidraw-export-dark": isObsidianThemeDark()} : {},
              ...(imageFile.extension === "pdf") ? {"cssclasses": "excalidraw-cropped-pdfpage"} : {},
            }
          });
          ea.destroy();

          //wait for file to be created/indexed by Obsidian
          let newFile = this.app.vault.getAbstractFileByPath(newPath);
          let counter = 0;
          while((!newFile || !this.isExcalidrawFile(newFile as TFile)) && counter < 50) {
            await sleep(100);
            newFile = this.app.vault.getAbstractFileByPath(newPath);
            counter++;
          }
          //console.log({counter, file});
          if(!newFile || !(newFile instanceof TFile)) {
            new Notice("File not found. NewExcalidraw Drawing is taking too long to create. Please try again.");
            return;
          }

          if(!newFile) return;
          const link = this.app.metadataCache.fileToLinktext(newFile,sourceFile.path, true);
          replacer(link, newFile, size ? `${size.width}` : null);
        }

        if(isCanvas) {
          const selectedNodes:any = [];
          canvasView.canvas.nodes.forEach((node:any) => {
            if(node.nodeEl.hasClass("is-focused")) selectedNodes.push(node);
          })
          if(selectedNodes.length !== 1) return false;
          const node = selectedNodes[0];
          let extension = "";
          let isExcalidraw = false;
          if(node.file) {
            extension = node.file.extension;
            isExcalidraw = this.isExcalidrawFile(node.file);
          }
          if(node.url) {
            extension = getURLImageExtension(node.url);
          }
          const page = extension === "pdf" ? getActivePDFPageNumberFromPDFView(node?.child) : undefined;
          if(!page && !IMAGE_TYPES.contains(extension) && !isExcalidraw) return false;
          if(checking) return true;

          const replacer = (link:string, file: TFile) => {
            if(node.file) {
              (node.file.extension === "pdf")
                ? node.canvas.createFileNode({pos:{x:node.x + node.width + 10,y: node.y}, file})
                : node.setFile(file);
            }
            if(node.url) {
              node.canvas.createFileNode({pos:{x:node.x + 20,y: node.y+20}, file});
            }
          }
          carveout(Boolean(node.file), canvasView.file, node.file, node.url, replacer, page ? `page=${page}` : undefined);
        }

        if (markdownView) {
          const editor = markdownView.editor;
          const cursor = editor.getCursor();
          const line = editor.getLine(cursor.line);
          const parts = REGEX_LINK.getResList(line);
          if(parts.length === 0) return false;
          let imgpath = REGEX_LINK.getLink(parts[0]);
          const isWikilink = REGEX_LINK.isWikiLink(parts[0]);
          let alias = REGEX_LINK.getAliasOrLink(parts[0]);
          if(alias === imgpath) alias = null;
          imgpath = decodeURI(imgpath);
          const imagePathParts = imgpath.split("#");
          const hasRef = imagePathParts.length === 2;
          const imageFile = this.app.metadataCache.getFirstLinkpathDest(
            hasRef ? imagePathParts[0] : imgpath,
            markdownView.file.path
          );
          const isFile = (imageFile && imageFile instanceof TFile);
          const isExcalidraw = isFile ? this.isExcalidrawFile(imageFile) : false;
          let imagepath = isFile ? imageFile.path : "";
          let extension = isFile ? imageFile.extension : "";
          if(imgpath.match(/^https?|file/)) {
            imagepath = imgpath;
            extension = getURLImageExtension(imgpath);
          }
          if(imagepath === "") return false;
          if(extension !== "pdf" && !IMAGE_TYPES.contains(extension) && !isExcalidraw) return false;
          if(checking) return true;
          const ref = imagePathParts[1];
          const replacer = (link:string, _:TFile, size:string) => {
            const lineparts = line.split(parts[0].value[0]) 
            const pdfLink = isFile && ref 
              ? "\n" + getLink(this ,{
                  embed: false,
                  alias: getAliasWithSize(alias ?? `${imageFile.basename}, ${ref.replace("="," ")}`,size),
                  path:`${imageFile.path}#${ref}`
                }, isWikilink) 
              : "";
            editor.setLine(
              cursor.line,
              lineparts[0] + getLink(this ,{embed: true, path:link, alias: getAliasWithSize(alias,size)}, isWikilink) + pdfLink + lineparts[1]
            );
          }
          carveout(isFile, markdownView.file, imageFile, imagepath, replacer, ref);
        }
      }
    })

    this.addCommand({
      id: "insert-image",
      name: t("INSERT_IMAGE"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          this.insertImageDialog.start(view);
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "import-svg",
      name: t("IMPORT_SVG"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          this.importSVGDialog.start(view);
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "release-notes",
      name: t("READ_RELEASE_NOTES"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
        }
        new ReleaseNotes(this.app, this, PLUGIN_VERSION).open();
        return true;
      },
    });

    this.addCommand({
      id: "tray-mode",
      name: t("TRAY_MODE"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
          if (!view || !view.excalidrawAPI) {
            return false;
          }
          const st = view.excalidrawAPI.getAppState();
          if (st.zenModeEnabled || st.viewModeEnabled) {
            return false;
          }
          return true;
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view && view.excalidrawAPI) {
          view.toggleTrayMode();
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "insert-md",
      name: t("INSERT_MD"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          this.insertMDDialog.start(view);
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "insert-pdf",
      name: t("INSERT_PDF"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          const insertPDFModal = new InsertPDFModal(this, view);
          insertPDFModal.open();
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "insert-pdf",
      name: t("INSERT_LAST_ACTIVE_PDF_PAGE_AS_IMAGE"),
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if(!Boolean(view)) return false;
        const PDFLink = this.getLastActivePDFPageLink(view.file);
        if(!PDFLink) return false;
        if(checking) return true;
        const ea = getEA(view);
        insertImageToView(
          ea,
          view.currentPosition,
          PDFLink,
          undefined,
          undefined,
          true,
        );
      },
    });

    this.addCommand({
      id: "universal-add-file",
      name: t("UNIVERSAL_ADD_FILE"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          const insertFileModal = new UniversalInsertFileModal(this, view);
          insertFileModal.open();
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "universal-card",
      name: t("INSERT_CARD"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          view.insertBackOfTheNoteCard();
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "insert-LaTeX-symbol",
      name: t("INSERT_LATEX"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView));
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          insertLaTeXToView(view);
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "toggle-excalidraw-view",
      name: t("TOGGLE_MODE"),
      checkCallback: (checking) => {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
          return false;
        }
        const fileIsExcalidraw = this.isExcalidrawFile(activeFile);

        if (checking) {
          if (
            Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
          ) {
            return !(this.app.workspace.getActiveViewOfType(ExcalidrawView))
              .compatibilityMode;
          }
          return fileIsExcalidraw;
        }

        const excalidrawView = this.app.workspace.getActiveViewOfType(ExcalidrawView)
        if (excalidrawView) {
          excalidrawView.openAsMarkdown();
          return;
        }

        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView)
        if (markdownView && fileIsExcalidraw) {
          (async()=>{
            await markdownView.save();
            const activeLeaf = markdownView.leaf;
            this.excalidrawFileModes[(activeLeaf as any).id || activeFile.path] =
              VIEW_TYPE_EXCALIDRAW;
            setExcalidrawView(activeLeaf);
          })()
          return;
        }
      },
    });

    this.addCommand({
      id: "convert-to-excalidraw",
      name: t("CONVERT_NOTE_TO_EXCALIDRAW"),
      checkCallback: (checking) => {
        const activeFile = this.app.workspace.getActiveFile();
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);

        if (!activeFile || !activeView) {
          return false;
        }

        if(this.isExcalidrawFile(activeFile)) {
          return false;
        }

        if(checking) {
          return true;
        }

        (async () => {
          await activeView.save();
          const template = await this.getBlankDrawing();
          const target = await this.app.vault.read(activeFile);
          const mergedTarget = mergeMarkdownFiles(template, target);
          await this.app.vault.modify(
            activeFile,
            mergedTarget,
          );
          setExcalidrawView(activeView.leaf);
        })();
      },
    });

    this.addCommand({
      id: "convert-excalidraw",
      name: t("CONVERT_EXCALIDRAW"),
      checkCallback: (checking) => {
        if (checking) {
          const files = this.app.vault
            .getFiles()
            .filter((f) => f.extension == "excalidraw");
          return files.length > 0;
        }
        this.convertExcalidrawToMD();
        return true;
      },
    });
  }

  public async convertSingleExcalidrawToMD(
    file: TFile,
    replaceExtension: boolean = false,
    keepOriginal: boolean = false,
  ): Promise<TFile> {
    const data = await this.app.vault.read(file);
    const filename =
      file.name.substring(0, file.name.lastIndexOf(".excalidraw")) +
      (replaceExtension ? ".md" : ".excalidraw.md");
    const fname = getNewUniqueFilepath(
      this.app.vault,
      filename,
      normalizePath(file.path.substring(0, file.path.lastIndexOf(file.name))),
    );
    log(fname);
    const result = await this.app.vault.create(
      fname,
      FRONTMATTER + (await this.fileManager.exportSceneToMD(data, false)),
    );
    if (this.settings.keepInSync) {
      EXPORT_TYPES.forEach((ext: string) => {
        const oldIMGpath =
          file.path.substring(0, file.path.lastIndexOf(".excalidraw")) + ext;
        const imgFile = this.app.vault.getAbstractFileByPath(
          normalizePath(oldIMGpath),
        );
        if (imgFile && imgFile instanceof TFile) {
          const newIMGpath = fname.substring(0, fname.lastIndexOf(".md")) + ext;
          this.app.fileManager.renameFile(imgFile, newIMGpath);
        }
      });
    }
    if (!keepOriginal) {
      this.app.vault.delete(file);
    }
    return result;
  }

  public async convertExcalidrawToMD(
    replaceExtension: boolean = false,
    keepOriginal: boolean = false,
  ) {
    const files = this.app.vault
      .getFiles()
      .filter((f) => f.extension == "excalidraw");
    for (const file of files) {
      this.convertSingleExcalidrawToMD(file, replaceExtension, keepOriginal);
    }
    new Notice(`Converted ${files.length} files.`);
  }

  private registerMonkeyPatches() {
    const key = "https://github.com/zsviczian/obsidian-excalidraw-plugin/issues";

    this.register(
      around(Workspace.prototype, {
        getActiveViewOfType(old) {
          return dedupe(key, old, function(...args) {
            (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.registerMonkeyPatches, `ExcalidrawPlugin.MonkeyPatch >getActiveViewOfType`, key, old, ...args);
            const result = old && old.apply(this, args);
            const maybeEAView = self.app?.workspace?.activeLeaf?.view;
            if(!maybeEAView || !(maybeEAView instanceof ExcalidrawView)) return result;
            const error = new Error();
            const stackTrace = error.stack;
            if(!isCallerFromTemplaterPlugin(stackTrace)) return result;
            const leafOrNode = maybeEAView.getActiveEmbeddable();
            if(leafOrNode) {
              if(leafOrNode.node && leafOrNode.node.isEditing) {
                return {file: leafOrNode.node.file, editor: leafOrNode.node.child.editor};
              }
            }
            return result;
        });
       }
      })
    );
    //@ts-ignore
    if(!this.app.plugins?.plugins?.["obsidian-hover-editor"]) {
      this.register( //stolen from hover editor
        around(WorkspaceLeaf.prototype, {
          getRoot(old) {
            return function () {
              const top = old.call(this);
              return top.getRoot === this.getRoot ? top : top.getRoot();
            };
          }
        }));
    }
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor, view) => {
        if(!view || !(view instanceof MarkdownView)) return;
        const file = view.file;
        const leaf = view.leaf;
        if (!view.file) return;
        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache?.frontmatter || !cache.frontmatter[FRONTMATTER_KEYS["plugin"].name]) return;
        
        menu.addItem(item => item
          .setTitle(t("OPEN_AS_EXCALIDRAW"))
          .setIcon(ICON_NAME)
          .setSection("excalidraw")
          .onClick(async () => {
            await view.save();
            //@ts-ignore
            this.excalidrawFileModes[leaf.id || file.path] = VIEW_TYPE_EXCALIDRAW;
            setExcalidrawView(leaf);
          }));
        },
      ),
    );

    this.registerEvent(      
      this.app.workspace.on("file-menu", (menu, file, source, leaf) => {
        (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.registerMonkeyPatches, `ExcalidrawPlugin.MonkeyPatch > file-menu`, file, source, leaf);
        if (!leaf) return;
        const view = leaf.view;
        if(!view || !(view instanceof MarkdownView)) return;
        if (!(file instanceof TFile)) return;
        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache?.frontmatter || !cache.frontmatter[FRONTMATTER_KEYS["plugin"].name]) return;
        
        menu.addItem(item => {
          item
          .setTitle(t("OPEN_AS_EXCALIDRAW"))
          .setIcon(ICON_NAME)
          .setSection("pane")
          .onClick(async () => {
            await view.save();
            //@ts-ignore
            this.excalidrawFileModes[leaf.id || file.path] = VIEW_TYPE_EXCALIDRAW;
            setExcalidrawView(leaf);
          })});
        //@ts-ignore
        menu.items.unshift(menu.items.pop());
        },
      ),
    );
    
    const self = this;
    // Monkey patch WorkspaceLeaf to open Excalidraw drawings with ExcalidrawView by default
    this.register(
      around(WorkspaceLeaf.prototype, {
        // Drawings can be viewed as markdown or Excalidraw, and we keep track of the mode
        // while the file is open. When the file closes, we no longer need to keep track of it.
        detach(next) {
          return function () {
            const state = this.view?.getState();

            if (
              state?.file &&
              self.excalidrawFileModes[this.id || state.file]
            ) {
              delete self.excalidrawFileModes[this.id || state.file];
            }

            return next.apply(this);
          };
        },

        setViewState(next) {
          return function (state: ViewState, ...rest: any[]) {
            (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.registerMonkeyPatches, `ExcalidrawPlugin.MonkeyPatch > setViewState`, next);
            const markdownViewLoaded = 
              self._loaded && // Don't force excalidraw mode during shutdown
              state.type === "markdown" && // If we have a markdown file
              state.state?.file;
            if (
              markdownViewLoaded &&
              self.excalidrawFileModes[this.id || state.state.file] !== "markdown"
            ) {
              const file = state.state.file;
              if ((self.forceToOpenInMarkdownFilepath !== file)  && fileShouldDefaultAsExcalidraw(file,this.app)) {
                // If we have it, force the view type to excalidraw
                const newState = {
                  ...state,
                  type: VIEW_TYPE_EXCALIDRAW,
                };

                self.excalidrawFileModes[file] =
                  VIEW_TYPE_EXCALIDRAW;

                return next.apply(this, [newState, ...rest]);
              }
              self.forceToOpenInMarkdownFilepath = null;
            }

            if(markdownViewLoaded) {
              const leaf = this;
              setTimeout(async ()=> {
                if(!leaf || !leaf.view || !(leaf.view instanceof MarkdownView) || 
                  !leaf.view.file || !self.isExcalidrawFile(leaf.view.file)
                ) return;
                foldExcalidrawSection(leaf.view)
              },500);
            }

            return next.apply(this, [state, ...rest]);
          };
        },
      }),
    );
  }

  /**
   * Loads the startup script that will add event hooks to ExcalidrawAutomate (if provided by the user)
   * Because of file operations, this must be run after the Obsidian Layout is ready
   * @returns 
   */
  private async runStartupScript() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.runStartupScript, `ExcalidrawPlugin.runStartupScript`);
    if(!this.settings.startupScriptPath || this.settings.startupScriptPath === "") {
      return;
    }
    const path = this.settings.startupScriptPath.endsWith(".md")
      ? this.settings.startupScriptPath
      : `${this.settings.startupScriptPath}.md`;
    const f = this.app.vault.getAbstractFileByPath(path);
    if (!f || !(f instanceof TFile)) {
      new Notice(`Startup script not found: ${path}`);
      return;
    }
    const script = await this.app.vault.read(f);
    const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
    try {
      await new AsyncFunction("ea", script)(this.ea);
    } catch (e) {
      new Notice(`Error running startup script: ${e}`);
    }
  }

  private lastPDFLeafID: string = null;

  public getLastActivePDFPageLink(requestorFile: TFile): string {
    if(!this.lastPDFLeafID) return;
    const leaf = this.app.workspace.getLeafById(this.lastPDFLeafID);
    //@ts-ignore
    if(!leaf || !leaf.view || leaf.view.getViewType() !== "pdf") return;
    const view:any = leaf.view;
    const file = view.file;
    const page = view.viewer.child.pdfViewer.page;
    if(!file || !page) return;
    return this.app.metadataCache.fileToLinktext(
      file,
      requestorFile?.path,
      false,
    ) + `#page=${page}`;
  }

  public async activeLeafChangeEventHandler (leaf: WorkspaceLeaf) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.activeLeafChangeEventHandler,`ExcalidrawPlugin.activeLeafChangeEventHandler`, leaf);
    //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/723

    if (leaf.view && leaf.view.getViewType() === "pdf") {
      //@ts-ignore
      this.lastPDFLeafID = leaf.id;
    }

    if(this.leafChangeTimeout) {
      window.clearTimeout(this.leafChangeTimeout);
    }
    this.leafChangeTimeout = window.setTimeout(()=>{this.leafChangeTimeout = null;},1000);

    if(this.settings.overrideObsidianFontSize) {
      if(leaf.view && (leaf.view.getViewType() === VIEW_TYPE_EXCALIDRAW)) {
        document.documentElement.style.fontSize = "";
      } 
    }

    const previouslyActiveEV = this.activeExcalidrawView;
    const newActiveviewEV: ExcalidrawView =
      leaf.view instanceof ExcalidrawView ? leaf.view : null;
    this.activeExcalidrawView = newActiveviewEV;

    if (newActiveviewEV) {
      this.observerManager.addModalContainerObserver();
      this.lastActiveExcalidrawFilePath = newActiveviewEV.file?.path;
    } else {
      this.observerManager.removeModalContainerObserver();
    }

    //!Temporary hack
    //https://discord.com/channels/686053708261228577/817515900349448202/1031101635784613968
    if (DEVICE.isMobile && newActiveviewEV && !previouslyActiveEV) {
      const navbar = document.querySelector("body>.app-container>.mobile-navbar");
      if(navbar && navbar instanceof HTMLDivElement) {
        navbar.style.position="relative";
      }
    }

    if (DEVICE.isMobile && !newActiveviewEV && previouslyActiveEV) {
      const navbar = document.querySelector("body>.app-container>.mobile-navbar");
      if(navbar && navbar instanceof HTMLDivElement) {
        navbar.style.position="";
      }
    }

    //----------------------
    //----------------------

    if (previouslyActiveEV && previouslyActiveEV !== newActiveviewEV) {
      if (previouslyActiveEV.leaf !== leaf) {
        //if loading new view to same leaf then don't save. Excalidarw view will take care of saving anyway.
        //avoid double saving
        if(previouslyActiveEV?.isDirty() && !previouslyActiveEV.semaphores?.viewunload) {
          await previouslyActiveEV.save(true); //this will update transclusions in the drawing
        }
      }
      if (previouslyActiveEV.file) {
        this.triggerEmbedUpdates(previouslyActiveEV.file.path);
      }
    }

    if (
      newActiveviewEV &&
      (!previouslyActiveEV || previouslyActiveEV.leaf !== leaf)
    ) {
      //the user switched to a new leaf
      //timeout gives time to the view being exited to finish saving
      const f = newActiveviewEV.file;
      if (newActiveviewEV.file) {
        setTimeout(() => {
          //@ts-ignore
          if (!newActiveviewEV || !newActiveviewEV._loaded) {
            return;
          }
          if (newActiveviewEV.file?.path !== f?.path) {
            return;
          }
          if (newActiveviewEV.activeLoader) {
            return;
          }
          newActiveviewEV.loadSceneFiles();
        }, 2000);
      } //refresh embedded files
    }

    
    if ( //@ts-ignore
      newActiveviewEV && newActiveviewEV._loaded &&
      newActiveviewEV.isLoaded && newActiveviewEV.excalidrawAPI &&
      this.ea.onCanvasColorChangeHook
    ) {
      this.ea.onCanvasColorChangeHook(
        this.ea,
        newActiveviewEV,
        newActiveviewEV.excalidrawAPI.getAppState().viewBackgroundColor
      );
    }

    //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/300
    if (this.popScope) {
      this.popScope();
      this.popScope = null;
    }
    if (newActiveviewEV) {
      this.registerHotkeyOverrides();
    }
  }

  public registerHotkeyOverrides() {
    //this is repeated here because the same function is called when settings is closed after hotkeys have changed
    if (this.popScope) {
      this.popScope();
      this.popScope = null;
    }

    if(!this.activeExcalidrawView) {
      return;
    }

    const scope = this.app.keymap.getRootScope();
    // Register overrides from settings
    const overrideHandlers = this.settings.modifierKeyOverrides.map(override => {
      return scope.register(override.modifiers, override.key, () => true);
    });
    // Force handlers to the front of the list
    overrideHandlers.forEach(() => scope.keys.unshift(scope.keys.pop()));

    const handler_ctrlF = scope.register(["Mod"], "f", () => true);
    scope.keys.unshift(scope.keys.pop()); // Force our handler to the front of the list
    const overridSaveShortcut = (
      this.forceSaveCommand &&
      this.forceSaveCommand.hotkeys[0].key === "s" &&
      this.forceSaveCommand.hotkeys[0].modifiers.includes("Ctrl")
    )
    const saveHandler = overridSaveShortcut
     ? scope.register(["Ctrl"], "s", () => this.forceSaveActiveView(false))
     : undefined;
    if(saveHandler) {
      scope.keys.unshift(scope.keys.pop()); // Force our handler to the front of the list
    }
    this.popScope = () => {
      overrideHandlers.forEach(handler => scope.unregister(handler));
      scope.unregister(handler_ctrlF);
      Boolean(saveHandler) && scope.unregister(saveHandler);
    }
  }

  private popScope: Function = null;


  /**
   * Registers event listeners for the plugin
   * Must be called after the workspace is read (onLayoutReady) 
   * Intended to be called from onLayoutReady in onload()
   */
  private async registerEventListeners() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.registerEventListeners,`ExcalidrawPlugin.registerEventListeners`);
    await this.awaitInit();
    const onPasteHandler = (
      evt: ClipboardEvent,
      editor: Editor,
      info: MarkdownView | MarkdownFileInfo
    ) => {
      if(evt.defaultPrevented) return
      const data = evt.clipboardData.getData("text/plain");
      if (!data) return;
      if (data.startsWith(`{"type":"excalidraw/clipboard"`)) {
        evt.preventDefault();
        try {
          const drawing = JSON.parse(data);
          const hasOneTextElement = drawing.elements.filter((el:ExcalidrawElement)=>el.type==="text").length === 1;
          if (!(hasOneTextElement || drawing.elements?.length === 1)) {
            return;
          }
          const element = hasOneTextElement
            ? drawing.elements.filter((el:ExcalidrawElement)=>el.type==="text")[0]
            : drawing.elements[0];
          if (element.type === "image") {
            const fileinfo = this.filesMaster.get(element.fileId);
            if(fileinfo && fileinfo.path) {
              let path = fileinfo.path;
              const sourceFile = info.file;
              const imageFile = this.app.vault.getAbstractFileByPath(path);
              if(sourceFile && imageFile && imageFile instanceof TFile) {
                path = this.app.metadataCache.fileToLinktext(imageFile,sourceFile.path);
              }
              editorInsertText(editor, getLink(this, {path}));
            }
            return;
          }
          if (element.type === "text") {
            editorInsertText(editor, element.rawText);
            return;
          }
          if (element.link) {
            editorInsertText(editor, `${element.link}`);
            return;
          }
        } catch (e) {
        }
      }
    };
    this.registerEvent(this.app.workspace.on("editor-paste", (evt, editor,info) => onPasteHandler(evt, editor, info)));

    this.registerEvent(this.app.vault.on("rename", (file,oldPath) => this.fileManager.renameEventHandler(file,oldPath)));
    this.registerEvent(this.app.vault.on("modify", (file:TFile) => this.fileManager.modifyEventHandler(file)));
    this.registerEvent(this.app.vault.on("delete", (file:TFile) => this.fileManager.deleteEventHandler(file)));

    //save Excalidraw leaf and update embeds when switching to another leaf
    this.registerEvent(
      this.app.workspace.on(
        "active-leaf-change",
        (leaf: WorkspaceLeaf) => this.activeLeafChangeEventHandler(leaf),
      ),
    );

    this.addFileSaveTriggerEventHandlers();

    const metaCache: MetadataCache = this.app.metadataCache;
    //@ts-ignore
    metaCache.getCachedFiles().forEach((filename: string) => {
      const fm = metaCache.getCache(filename)?.frontmatter;
      if (
        (fm && typeof fm[FRONTMATTER_KEYS["plugin"].name] !== "undefined") ||
        filename.match(/\.excalidraw$/)
      ) {
        this.fileManager.updateFileCache(
          this.app.vault.getAbstractFileByPath(filename) as TFile,
          fm,
        );
      }
    });
    this.registerEvent(
      metaCache.on("changed", (file, _, cache) =>
        this.fileManager.updateFileCache(file, cache?.frontmatter),
      ),
    );
  }

  //Save the drawing if the user clicks outside the canvas
  public addFileSaveTriggerEventHandlers() {
    //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/551
    const onClickEventSaveActiveDrawing = (e: PointerEvent) => {
      if (
        !this.activeExcalidrawView ||
        !this.activeExcalidrawView?.isDirty() ||
        //@ts-ignore
        e.target && (e.target.className === "excalidraw__canvas" ||
        //@ts-ignore
        getParentOfClass(e.target,"excalidraw-wrapper"))
      ) {
        return;
      }
      this.activeExcalidrawView.save();
    };
    this.app.workspace.containerEl.addEventListener("click", onClickEventSaveActiveDrawing)
    this.removeEventLisnters.push(() => {
      this.app.workspace.containerEl.removeEventListener("click", onClickEventSaveActiveDrawing)
    });

    const onFileMenuEventSaveActiveDrawing = () => {
      (process.env.NODE_ENV === 'development') && DEBUGGING && debug(onFileMenuEventSaveActiveDrawing,`ExcalidrawPlugin.onFileMenuEventSaveActiveDrawing`);
      if (
        !this.activeExcalidrawView ||
        !this.activeExcalidrawView?.isDirty()
      ) {
        return;
      }
      this.activeExcalidrawView.save();
    };
    this.registerEvent(
      this.app.workspace.on("file-menu", onFileMenuEventSaveActiveDrawing),
    );

    //when the user activates the sliding drawers on Obsidian Mobile
    const leftWorkspaceDrawer = document.querySelector(
      ".workspace-drawer.mod-left",
    );
    const rightWorkspaceDrawer = document.querySelector(
      ".workspace-drawer.mod-right",
    );
    if (leftWorkspaceDrawer || rightWorkspaceDrawer) {
      const action = async (m: MutationRecord[]) => {
        if (
          m[0].oldValue !== "display: none;" ||
          !this.activeExcalidrawView ||
          !this.activeExcalidrawView?.isDirty()
        ) {
          return;
        }
        this.activeExcalidrawView.save();
      };
      const options = {
        attributeOldValue: true,
        attributeFilter: ["style"],
      };

      if (leftWorkspaceDrawer) {
        this.workspaceDrawerLeftObserver = DEBUGGING
          ? new CustomMutationObserver(action, "slidingDrawerLeftObserver")
          : new MutationObserver(action);
        this.workspaceDrawerLeftObserver.observe(leftWorkspaceDrawer, options);
      }

      if (rightWorkspaceDrawer) {
        this.workspaceDrawerRightObserver = DEBUGGING
          ? new CustomMutationObserver(action, "slidingDrawerRightObserver")
          : new MutationObserver(action);
        this.workspaceDrawerRightObserver.observe(
          rightWorkspaceDrawer,
          options,
        );
      }
    }
  }

  onunload() {
    const excalidrawViews = getExcalidrawViews(this.app);
    excalidrawViews.forEach(({leaf}) => {
      this.setMarkdownView(leaf);
    });
    
    if(versionUpdateCheckTimer) {
      window.clearTimeout(versionUpdateCheckTimer);
    }

    if(this.scriptEngine) {
      this.scriptEngine.destroy();
      this.scriptEngine = null;
    }

    if(imageCache) {
      imageCache.destroy();
    }

    this.stylesManager.destroy();
    this.stylesManager = null;

    this.removeFonts();
    this.removeEventLisnters.forEach((removeEventListener) =>
      removeEventListener(),
    );
    this.removeEventLisnters = [];

    this.eaInstances.forEach((ea) => ea?.destroy());
    this.eaInstances.clear();
    this.eaInstances = null;

    this.ea.destroy();
    this.ea = null;
    
    window.ExcalidrawAutomate?.destroy();
    delete window.ExcalidrawAutomate;
  
    if (this.popScope) {
      this.popScope();
      this.popScope = null;
    }
    if(this.legacyExcalidrawPopoverObserver) {
      this.legacyExcalidrawPopoverObserver.disconnect();
    }
    this.observerManager.destroy();
    if (this.workspaceDrawerLeftObserver) {
      this.workspaceDrawerLeftObserver.disconnect();
    }
    if (this.workspaceDrawerRightObserver) {
      this.workspaceDrawerRightObserver.disconnect();
    }
    if (this.fileExplorerObserver) {
      this.fileExplorerObserver.disconnect();
    }
    if (this.taskbone) {
      this.taskbone.destroy();
      this.taskbone = null;
    }
    Object.values(this.packageMap).forEach((p:Packages)=>{
      delete p.excalidrawLib;
      delete p.reactDOM;
      delete p.react;
    });

    this.excalidrawConfig = null;

    this.openDialog.destroy();
    this.openDialog = null;

    this.insertLinkDialog.destroy();
    this.insertLinkDialog = null;

    this.insertCommandDialog.destroy();
    this.insertCommandDialog = null;

    this.importSVGDialog.destroy();
    this.importSVGDialog = null;

    this.insertImageDialog.destroy();
    this.insertImageDialog = null;

    this.insertMDDialog.destroy();
    this.insertMDDialog = null;

    this.forceSaveCommand = null;

    this.editorHandler.destroy();
    this.editorHandler = null;

    this.hover = {linkText: null, sourcePath:null};

    this.fileManager.destroy();
    this.equationsMaster.clear();
    this.filesMaster.clear();
    this.mermaidsMaster.clear();

    this.activeExcalidrawView = null;
    this.lastActiveExcalidrawFilePath = null;

    if(this.leafChangeTimeout) {
      window.clearTimeout(this.leafChangeTimeout);
      this.leafChangeTimeout = null;
    }

    this.settings = null;
    clearMathJaxVariables();
    this.EXCALIDRAW_PACKAGE = "";
    REACT_PACKAGES = "";
    //pluginPackages = null;
    //PLUGIN_VERSION = null;
    //@ts-ignore
    delete window.PolyBool;
    this.deletePackage(window);
    react = null;
    reactDOM = null;
    excalidrawLib = null;
    terminateCompressionWorker();
  }

  public async loadSettings(opts: {
    applyLefthandedMode?: boolean,
    reEnableAutosave?: boolean
  } = {applyLefthandedMode: true, reEnableAutosave: false}
  ) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.loadSettings,`ExcalidrawPlugin.loadSettings`, opts);
    if(typeof opts.applyLefthandedMode === "undefined") opts.applyLefthandedMode = true;
    if(typeof opts.reEnableAutosave === "undefined") opts.reEnableAutosave = false;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if(!this.settings.previewImageType) { //migration 1.9.13
      if(typeof this.settings.displaySVGInPreview === "undefined") {
        this.settings.previewImageType = PreviewImageType.SVGIMG;
      } else {
        this.settings.previewImageType = this.settings.displaySVGInPreview
          ? PreviewImageType.SVGIMG
          : PreviewImageType.PNG; 
      }
    }
    if(opts.applyLefthandedMode) setLeftHandedMode(this.settings.isLeftHanded);
    if(opts.reEnableAutosave) this.settings.autosave = true;
    setDebugging(this.settings.isDebugMode);
  }

  async saveSettings() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.saveSettings,`ExcalidrawPlugin.saveSettings`);
    await this.saveData(this.settings);
  }

  public getStencilLibrary(): {} {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.getStencilLibrary,`ExcalidrawPlugin.getStencilLibrary`);
    if (
      this.settings.library === "" ||
      this.settings.library === "deprecated"
    ) {
      return this.settings.library2;
    }
    return JSON_parse(this.settings.library);
  }

  public setStencilLibrary(library: {}) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.setStencilLibrary,`ExcalidrawPlugin.setStencilLibrary`, library);
    this.settings.library = "deprecated";
    this.settings.library2 = library;
  }

  public triggerEmbedUpdates(filepath?: string) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.triggerEmbedUpdates,`ExcalidrawPlugin.triggerEmbedUpdates`, filepath);
    const visitedDocs = new Set<Document>();
    this.app.workspace.getLeavesOfType("markdown").forEach((leaf) => {
//    this.app.workspace.iterateAllLeaves((leaf)=>{
      const ownerDocument = DEVICE.isMobile?document:leaf.view.containerEl.ownerDocument;
      if(!ownerDocument) return;
      if(visitedDocs.has(ownerDocument)) return;
      visitedDocs.add(ownerDocument);
      const e = ownerDocument.createEvent("Event");
      e.initEvent(RERENDER_EVENT, true, false);
      ownerDocument
        .querySelectorAll(
          `.excalidraw-embedded-img${
            filepath ? `[fileSource='${filepath.replaceAll("'", "\\'")}']` : ""
          }`,
        )
        .forEach((el) => el.dispatchEvent(e));  
    })
  }

  //retained because some scripts make use of it
  public async getBlankDrawing(): Promise<string> {
    return await this.fileManager.getBlankDrawing();
  }

  public async createDrawing(
    filename: string,
    foldername?: string,
    initData?: string,
  ): Promise<TFile> {
    const file = await this.fileManager.createDrawing(filename, foldername, initData);

    if(Date.now() - this.loadTimestamp > 1){//2000) {     
      const filecount = this.app.vault.getFiles().filter(f=>this.isExcalidrawFile(f)).length;
      const rank:Rank = filecount < 200 ? "Bronze" : filecount < 750 ? "Silver" : filecount < 2000 ? "Gold" : "Platinum";
      const {grip, decoration, blade} = SwordColors[rank];
      if(this.settings.rank !== rank) {
        //in case the message was already displayed on another device and it was synced in the mean time
        await this.loadSettings();
        if(this.settings.rank !== rank) {
          this.settings.rank = rank;
          await this.saveSettings();
          new RankMessage(this.app, this, filecount, rank, decoration, blade, grip).open();
        }
      }
    }

    return file;
  }

  public async createAndOpenDrawing(
    filename: string,
    location: PaneTarget,
    foldername?: string,
    initData?: string,
  ): Promise<string> {
    const file = await this.createDrawing(filename, foldername, initData);
    this.fileManager.openDrawing(file, location, true, undefined, true);
    return file.path;
  }

  public async setMarkdownView(leaf: WorkspaceLeaf, eState?: any) {
    const state = leaf.view.getState();

    //Note v2.0.19: I have absolutely no idea why I thought this is necessary. Removing this.
    //This was added in 1.4.2 but there is no hint in Release notes why.
    /*await leaf.setViewState({
      type: VIEW_TYPE_EXCALIDRAW,
      state: { file: null },
    });*/

    await leaf.setViewState(
      {
        type: "markdown",
        state,
        popstate: true,
      } as ViewState,
      eState ? eState : { focus: true },
    );

    const mdView = leaf.view;
    if(mdView instanceof MarkdownView) {
      foldExcalidrawSection(mdView);
    }

  }

  public isExcalidrawFile(f: TFile) {
    return this.fileManager.isExcalidrawFile(f);
  }

}
