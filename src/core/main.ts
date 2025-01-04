import {
  TFile,
  Plugin,
  WorkspaceLeaf,
  addIcon,
  App,
  PluginManifest,
  MarkdownView,
  normalizePath,
  ViewState,
  Notice,
  request,
  MetadataCache,
  Workspace,
  TAbstractFile,
  FrontMatterCache,
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
  setExcalidrawPlugin,
  DEVICE,
  FONTS_STYLE_ID,
  CJK_STYLE_ID,
  loadMermaid,
  setRootElementSize,
} from "../constants/constants";
import { ExcalidrawSettings, DEFAULT_SETTINGS, ExcalidrawSettingTab } from "./settings";
import { ExcalidrawAutomate } from "../shared/ExcalidrawAutomate";
import { initExcalidrawAutomate } from "src/utils/excalidrawAutomateUtils";
import { around, dedupe } from "monkey-around";
import { t } from "../lang/helpers";
import {
  checkAndCreateFolder,
  fileShouldDefaultAsExcalidraw,
  getDrawingFilename,
  getIMGFilename,
  getNewUniqueFilepath,
} from "../utils/fileUtils";
import {
  getFontDataURL,
  errorlog,
  setLeftHandedMode,
  sleep,
  isVersionNewerThanOther,
  isCallerFromTemplaterPlugin,
  versionUpdateCheckTimer,
  getFontMetrics,
} from "../utils/utils";
import { foldExcalidrawSection, getExcalidrawViews, setExcalidrawView } from "../utils/obsidianUtils";
import { FileId } from "@zsviczian/excalidraw/types/excalidraw/element/types";
import { ScriptEngine } from "../shared/Scripts";
import { hoverEvent, initializeMarkdownPostProcessor, markdownPostProcessor, legacyExcalidrawPopoverObserver } from "./managers/MarkdownPostProcessor";
import { FieldSuggester } from "../shared/Suggesters/FieldSuggester";
import { ReleaseNotes } from "../shared/Dialogs/ReleaseNotes";
import { Packages } from "../types/types";
import { PreviewImageType } from "../types/utilTypes";
import { emulateCTRLClickForLinks, linkClickModifierType, PaneTarget } from "../utils/modifierkeyHelper";
import { imageCache } from "../shared/ImageCache";
import { StylesManager } from "./managers/StylesManager";
import { CustomMutationObserver, debug, log, DEBUGGING, setDebugging, ts } from "../utils/debugHelper";
import { ExcalidrawConfig } from "../shared/ExcalidrawConfig";
import { EditorHandler } from "./editor/EditorHandler";
import { ExcalidrawLib } from "../types/excalidrawLib";
import { Rank, SwordColors } from "../constants/actionIcons";
import { RankMessage } from "../shared/Dialogs/RankMessage";
import { initCompressionWorker, terminateCompressionWorker } from "../shared/Workers/compression-worker";
import { WeakArray } from "../shared/WeakArray";
import { getCJKDataURLs } from "../utils/CJKLoader";
import { ExcalidrawLoading, switchToExcalidraw } from "../view/ExcalidrawLoading";
import { clearMathJaxVariables } from "../shared/LaTeX";
import { PluginFileManager } from "./managers/FileManager";
import { ObserverManager } from "./managers/ObserverManager";
import { PackageManager } from "./managers/PackageManager";
import ExcalidrawView from "../view/ExcalidrawView";
import { CommandManager } from "./managers/CommandManager";
import { EventManager } from "./managers/EventManager";

declare const PLUGIN_VERSION:string;
declare const INITIAL_TIMESTAMP: number;

type FileMasterInfo = {
  isHyperLink: boolean;
  isLocalLink: boolean;
  path: string;
  hasSVGwithBitmap: boolean;
  blockrefData: string,
  colorMapJSON?: string
}

export default class ExcalidrawPlugin extends Plugin {
  private fileManager: PluginFileManager;
  private observerManager: ObserverManager;
  private packageManager: PackageManager;
  private commandManager: CommandManager;
  private eventManager: EventManager;
  public eaInstances = new WeakArray<ExcalidrawAutomate>();
  public fourthFontLoaded: boolean = false;
  public excalidrawConfig: ExcalidrawConfig;
  public excalidrawFileModes: { [file: string]: string } = {};
  public settings: ExcalidrawSettings;
  public activeExcalidrawView: ExcalidrawView = null;
  public lastActiveExcalidrawFilePath: string = null;
  public hover: { linkText: string; sourcePath: string } = {
    linkText: null,
    sourcePath: null,
  };
  private legacyExcalidrawPopoverObserver: MutationObserver | CustomMutationObserver;
  private fileExplorerObserver: MutationObserver | CustomMutationObserver;
  public opencount: number = 0;
  public ea: ExcalidrawAutomate;
  //A master list of fileIds to facilitate copy / paste
  public filesMaster: Map<FileId, FileMasterInfo> =
    null; //fileId, path
  public equationsMaster: Map<FileId, string> = null; //fileId, formula
  public mermaidsMaster: Map<FileId, string> = null; //fileId, mermaidText
  public scriptEngine: ScriptEngine;
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
  public popScope: Function = null;
  public lastPDFLeafID: string = null;

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    this.loadTimestamp = INITIAL_TIMESTAMP;
    this.lastLogTimestamp = this.loadTimestamp;
    this.filesMaster = new Map<
      FileId,
      { isHyperLink: boolean; isLocalLink: boolean; path: string; hasSVGwithBitmap: boolean; blockrefData: string; colorMapJSON?: string }
    >();
    this.equationsMaster = new Map<FileId, string>();
    this.mermaidsMaster = new Map<FileId, string>();

    //isExcalidraw function is used already is already used by MarkdownPostProcessor in onLoad before onLayoutReady
    this.fileManager = new PluginFileManager(this);
    
    setExcalidrawPlugin(this);
    /*if((process.env.NODE_ENV === 'development')) {
      this.slob = new Array(200 * 1024 * 1024 + 1).join('A'); // Create a 200MB blob
    }*/
  }

  public logStartupEvent(message:string) {
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

  /**
   * used by Excalidraw to getSharedMermaidInstance
   * @returns shared mermaid instance
   */
  public async getMermaid() {
    return await loadMermaid();
  }

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
    if(!this.settings.overrideObsidianFontSize) {
      setRootElementSize();
    }

    this.packageManager = new PackageManager(this);
    this.eventManager = new EventManager(this);
    this.observerManager = new ObserverManager(this);
    this.commandManager = new CommandManager(this);

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

    this.observerManager.initialize();

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

    this.fileManager.initialize(); //fileManager will preLoad the filecache
    this.eventManager.initialize(); //eventManager also adds event listner to filecache

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

    this.commandManager.initialize();

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
    this.packageManager.getPackageMap().forEach(({excalidrawLib}) => {
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

  public forceSaveActiveView(checking:boolean):boolean {
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
        const downloaded = this.app.vault.getFiles().filter(f=>f.path.startsWith(folder) && f.name === fname).sort((a,b)=>a.path>b.path?1:-1);
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
    if(!this.app.plugins.plugins?.["obsidian-hover-editor"]) {
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
              const filepath:string = state.state.file as string;
              if ((self.forceToOpenInMarkdownFilepath !== filepath)  && fileShouldDefaultAsExcalidraw(filepath,this.app)) {
                // If we have it, force the view type to excalidraw
                const newState = {
                  ...state,
                  type: VIEW_TYPE_EXCALIDRAW,
                };

                self.excalidrawFileModes[filepath] =
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

  public getLastActivePDFPageLink(requestorFile: TFile): string {
    if(!this.lastPDFLeafID) return;
    const leaf = this.app.workspace.getLeafById(this.lastPDFLeafID);
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
    this.eventManager.onActiveLeafChangeHandler(leaf);
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
    const forceSaveCommand = this.commandManager?.forceSaveCommand;
    const overridSaveShortcut = (
      forceSaveCommand &&
      forceSaveCommand.hotkeys[0].key === "s" &&
      forceSaveCommand.hotkeys[0].modifiers.includes("Ctrl")
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

  /**
   * Registers event listeners for the plugin
   * Must be called after the workspace is read (onLayoutReady) 
   * Intended to be called from onLayoutReady in onload()
   */
  private async registerEventListeners() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.registerEventListeners,`ExcalidrawPlugin.registerEventListeners`);
    await this.awaitInit();

    const metaCache: MetadataCache = this.app.metadataCache;
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

    if (this.fileExplorerObserver) {
      this.fileExplorerObserver.disconnect();
    }

    this.excalidrawConfig = null;

    this.editorHandler.destroy();
    this.editorHandler = null;

    this.hover = {linkText: null, sourcePath:null};

    this.fileManager.destroy();
    this.equationsMaster.clear();
    this.filesMaster.clear();
    this.mermaidsMaster.clear();

    this.activeExcalidrawView = null;
    this.lastActiveExcalidrawFilePath = null;

    this.settings = null;
    clearMathJaxVariables();
    //pluginPackages = null;
    //PLUGIN_VERSION = null;
    //@ts-ignore
    delete window.PolyBool;
    this.packageManager.destroy();
    this.commandManager?.destroy();
    this.eventManager.destroy();
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

  public openDrawing(
    drawingFile: TFile,
    location: PaneTarget,
    active: boolean = false,
    subpath?: string,
    justCreated: boolean = false,
    popoutLocation?: {x?: number, y?: number, width?: number, height?: number},
  ) {
    this.fileManager.openDrawing(drawingFile, location, active, subpath, justCreated, popoutLocation);
  }

  public async embedDrawing(file: TFile) {
    return await this.fileManager.embedDrawing(file);
  }

  public async exportLibrary() {
    return await this.fileManager.exportLibrary();
  }

  public async renameEventHandler (file: TAbstractFile, oldPath: string) {
    this.fileManager.renameEventHandler(file, oldPath);
  }

  public async modifyEventHandler (file: TFile) {
    this.fileManager.modifyEventHandler(file);
  }

  public async deleteEventHandler (file: TFile) {
    this.fileManager.deleteEventHandler(file);
  }

  public addThemeObserver() {
    this.observerManager.addThemeObserver();
  }

  public removeThemeObserver() {
    this.observerManager.removeThemeObserver();
  }

  public addModalContainerObserver() {
    this.observerManager.addModalContainerObserver();
  }

  public removeModalContainerObserver() {
    this.observerManager.removeModalContainerObserver();
  }

  public experimentalFileTypeDisplayToggle(enabled: boolean) {
    this.observerManager.experimentalFileTypeDisplayToggle(enabled);
  }

  public getPackage(win:Window):Packages {
    return this.packageManager.getPackage(win);
  }

  public deletePackage(win: Window) {
    this.packageManager.deletePackage(win);
  }

  get taskbone() {
    return this.commandManager?.taskbone;
  }

  get insertImageDialog() {
    return this.commandManager?.insertImageDialog;
  }

  get insertMDDialog() {
    return this.commandManager?.insertMDDialog;
  }

  get insertLinkDialog() {
    return this.commandManager?.insertLinkDialog;
  }

  get importSVGDialog() {
    return this.commandManager?.importSVGDialog;
  }

  public isRecentSplitViewSwitch():boolean {
    return this.eventManager.isRecentSplitViewSwitch();
  }

  get leafChangeTimeout() {
    return this.eventManager.leafChangeTimeout;
  }

  public clearLeafChangeTimeout() {
    this.eventManager.leafChangeTimeout = null;
  }

  public updateFileCache(file: TFile, frontmatter: FrontMatterCache) {
    this.fileManager.updateFileCache(file, frontmatter);
  }
}