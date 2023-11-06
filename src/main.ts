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
  TAbstractFile,
  ViewState,
  Notice,
  loadMathJax,
  request,
  MetadataCache,
  FrontMatterCache,
  Command,
  Workspace,
  Editor,
  MarkdownFileInfo,
  loadMermaid,
  moment,
} from "obsidian";
import {
  BLANK_DRAWING,
  VIEW_TYPE_EXCALIDRAW,
  EXCALIDRAW_ICON,
  ICON_NAME,
  SCRIPTENGINE_ICON,
  SCRIPTENGINE_ICON_NAME,
  RERENDER_EVENT,
  FRONTMATTER_KEY,
  FRONTMATTER,
  JSON_parse,
  nanoid,
  DARK_BLANK_DRAWING,
  SCRIPT_INSTALL_CODEBLOCK,
  SCRIPT_INSTALL_FOLDER,
  VIRGIL_FONT,
  VIRGIL_DATAURL,
  EXPORT_TYPES,
  EXPORT_IMG_ICON_NAME,
  EXPORT_IMG_ICON,
  LOCALE,
} from "./constants";
import ExcalidrawView, { TextMode, getTextMode } from "./ExcalidrawView";
import {
  changeThemeOfExcalidrawMD,
  getMarkdownDrawingSection,
  ExcalidrawData
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
  destroyExcalidrawAutomate,
  ExcalidrawAutomate,
  insertLaTeXToView,
  search,
} from "./ExcalidrawAutomate";
import { Prompt } from "./dialogs/Prompt";
import { around, dedupe } from "monkey-around";
import { t } from "./lang/helpers";
import {
  checkAndCreateFolder,
  download,
  getDrawingFilename,
  getEmbedFilename,
  getIMGFilename,
  getNewUniqueFilepath,
} from "./utils/FileUtils";
import {
  getFontDataURL,
  errorlog,
  log,
  setLeftHandedMode,
  sleep,
  isVersionNewerThanOther,
  getExportTheme,
  isCallerFromTemplaterPlugin,
} from "./utils/Utils";
import { getAttachmentsFolderAndFilePath, getNewOrAdjacentLeaf, getParentOfClass, isObsidianThemeDark } from "./utils/ObsidianUtils";
//import { OneOffs } from "./OneOffs";
import { ExcalidrawElement, ExcalidrawImageElement, ExcalidrawTextElement, FileId } from "@zsviczian/excalidraw/types/element/types";
import { ScriptEngine } from "./Scripts";
import {
  hoverEvent,
  initializeMarkdownPostProcessor,
  markdownPostProcessor,
  observer,
} from "./MarkdownPostProcessor";

import { FieldSuggester } from "./dialogs/FieldSuggester";
import { ReleaseNotes } from "./dialogs/ReleaseNotes";
import { decompressFromBase64 } from "lz-string";
import { Packages } from "./types";
import { PreviewImageType } from "./utils/UtilTypes";
import { ScriptInstallPrompt } from "./dialogs/ScriptInstallPrompt";
import Taskbone from "./ocr/Taskbone";
import { emulateCTRLClickForLinks, linkClickModifierType, PaneTarget } from "./utils/ModifierkeyHelper";
import { InsertPDFModal } from "./dialogs/InsertPDFModal";
import { ExportDialog } from "./dialogs/ExportDialog";
import { UniversalInsertFileModal } from "./dialogs/UniversalInsertFileModal";
import { imageCache } from "./utils/ImageCache";
import { StylesManager } from "./utils/StylesManager";
import { MATHJAX_SOURCE_LZCOMPRESSED } from "./constMathJaxSource";
import { getEA } from "src";

declare const EXCALIDRAW_PACKAGES:string;
declare const react:any;
declare const reactDOM:any;
declare const excalidrawLib: any;
declare const PLUGIN_VERSION:string;

export default class ExcalidrawPlugin extends Plugin {
  public taskbone: Taskbone;
  private excalidrawFiles: Set<TFile> = new Set<TFile>();
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
  private observer: MutationObserver;
  private themeObserver: MutationObserver;
  private fileExplorerObserver: MutationObserver;
  private modalContainerObserver: MutationObserver;
  private workspaceDrawerLeftObserver: MutationObserver;
  private workspaceDrawerRightObserver: MutationObserver;
  public opencount: number = 0;
  public ea: ExcalidrawAutomate;
  //A master list of fileIds to facilitate copy / paste
  public filesMaster: Map<FileId, { isHyperLink: boolean; isLocalLink: boolean; path: string; hasSVGwithBitmap: boolean; blockrefData: string, colorMapJSON?: string}> =
    null; //fileId, path
  public equationsMaster: Map<FileId, string> = null; //fileId, formula
  public mermaidsMaster: Map<FileId, string> = null; //fileId, mermaidText
  public mathjax: any = null;
  public mathjaxLoaderFinished: boolean = false;
  public scriptEngine: ScriptEngine;
  public fourthFontDef: string = VIRGIL_FONT;
  private packageMap: WeakMap<Window,Packages> = new WeakMap<Window,Packages>();
  public leafChangeTimeout: NodeJS.Timeout = null;
  private forceSaveCommand:Command;
  private removeEventLisnters:(()=>void)[] = [];
  private stylesManager:StylesManager;

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    this.filesMaster = new Map<
      FileId,
      { isHyperLink: boolean; isLocalLink: boolean; path: string; hasSVGwithBitmap: boolean; blockrefData: string; colorMapJSON?: string }
    >();
    this.equationsMaster = new Map<FileId, string>();
    this.mermaidsMaster = new Map<FileId, string>();
  }

  get locale() {
    return LOCALE;
  }

  public getPackage(win:Window):Packages {
    if(win===window) {
      return {react, reactDOM, excalidrawLib};
    }
    if(this.packageMap.has(win)) {
      return this.packageMap.get(win);
    }
    
    //@ts-ignore
    const {react:r, reactDOM:rd, excalidrawLib:e} = win.eval.call(win,
      `(function() {
        ${decompressFromBase64(EXCALIDRAW_PACKAGES)};
        return {react:React,reactDOM:ReactDOM,excalidrawLib:ExcalidrawLib};
       })()`);
    this.packageMap.set(win,{react:r, reactDOM:rd, excalidrawLib:e});
    return {react:r, reactDOM:rd, excalidrawLib:e};
  }

  async onload() {
    addIcon(ICON_NAME, EXCALIDRAW_ICON);
    addIcon(SCRIPTENGINE_ICON_NAME, SCRIPTENGINE_ICON);
    addIcon(EXPORT_IMG_ICON_NAME, EXPORT_IMG_ICON);

    await this.loadSettings({reEnableAutosave:true});
    await loadMermaid();
    
    this.addSettingTab(new ExcalidrawSettingTab(this.app, this));
    this.ea = await initExcalidrawAutomate(this);

    this.registerView(
      VIEW_TYPE_EXCALIDRAW,
      (leaf: WorkspaceLeaf) => new ExcalidrawView(leaf, this),
    );

    //Compatibility mode with .excalidraw files
    this.registerExtensions(["excalidraw"], VIEW_TYPE_EXCALIDRAW);

    this.addMarkdownPostProcessor();
    this.registerInstallCodeblockProcessor();
    this.addThemeObserver();
    this.experimentalFileTypeDisplayToggle(this.settings.experimentalFileType);
    this.registerCommands();
    this.registerEventListeners();
    this.initializeFourthFont();
    this.registerEditorSuggest(new FieldSuggester(this));

    //inspiration taken from kanban:
    //https://github.com/mgmeyers/obsidian-kanban/blob/44118e25661bff9ebfe54f71ae33805dc88ffa53/src/main.ts#L267
    this.registerMonkeyPatches();

    this.stylesManager = new StylesManager(this);

    //    const patches = new OneOffs(this);
    if (this.settings.showReleaseNotes) {
      //I am repurposing imageElementNotice, if the value is true, this means the plugin was just newly installed to Obsidian.
      const obsidianJustInstalled = this.settings.previousRelease === "0.0.0"

      if (isVersionNewerThanOther(PLUGIN_VERSION, this.settings.previousRelease)) {
        new ReleaseNotes(
          this.app,
          this,
          obsidianJustInstalled ? null : PLUGIN_VERSION,
        ).open();
      }
    }

    this.switchToExcalidarwAfterLoad();

    this.loadMathJax();

    const self = this;
    this.app.workspace.onLayoutReady(() => {
      this.scriptEngine = new ScriptEngine(self);
      imageCache.initializeDB(self);
    });
    this.taskbone = new Taskbone(this);
  }

  public initializeFourthFont() {
    this.app.workspace.onLayoutReady(async () => {
      const font = await getFontDataURL(
        this.app,
        this.settings.experimantalFourthFont,
        "",
        "LocalFont",
      );
      const fourthFontDataURL =
        font.dataURL === "" ? VIRGIL_DATAURL : font.dataURL;
      this.fourthFontDef = font.fontDef;
      
      const visitedDocs = new Set<Document>();
      app.workspace.iterateAllLeaves((leaf)=>{
        const ownerDocument = app.isMobile?document:leaf.view.containerEl.ownerDocument;   
        if(!ownerDocument) return;        
        if(visitedDocs.has(ownerDocument)) return;
        visitedDocs.add(ownerDocument);
        // replace the old local font <style> element with the one we just created
        const newStylesheet = ownerDocument.createElement("style");
        newStylesheet.id = "local-font-stylesheet";
        newStylesheet.textContent = `
          @font-face {
            font-family: 'LocalFont';
            src: url("${fourthFontDataURL}");
            font-display: swap;
          }
        `;  
        const oldStylesheet = ownerDocument.getElementById(newStylesheet.id);
        ownerDocument.head.appendChild(newStylesheet);
        if (oldStylesheet) {
          ownerDocument.head.removeChild(oldStylesheet);
        }
        ownerDocument.fonts.load('20px LocalFont');
      })
    });
  }

  private removeMathJax() {
    if("ExcalidrawMathJax" in window) {
      delete window.ExcalidrawMathJax;
    }
    const scriptElement = document.getElementById("ExcalidrawMathJax");
    if(scriptElement) {
      scriptElement.parentNode.removeChild(scriptElement);
    }
  }

  public loadMathJax() {
    const self = this;
    this.app.workspace.onLayoutReady(async () => {
      //loading Obsidian MathJax as fallback
      await loadMathJax();
      //@ts-ignore
      const backup = window.MathJax;
      try {
        this.removeMathJax();
        const script = document.createElement("script");
        script.setAttribute("id","ExcalidrawMathJax");
        script.type = "text/javascript";
        script.onload = () => {
          //@ts-ignore
          window.ExcalidrawMathJax.startup.pagePromise.then(async () => {

            // Set the 'all' package to load all MathJax modules
            const mathJaxConfig = {
              tex: {
                packages: { '[+]': ['all'] }, //this is required because during runtime loading fails due to the renaming of the package
                // Add any other configurations you need here
              },
            };

            // Set the MathJax configuration
            //@ts-ignore
            window.ExcalidrawMathJax = {
              //@ts-ignore
              ...window.ExcalidrawMathJax,
              options: {
                //@ts-ignore
                ...window.ExcalidrawMathJax.options,
                ...mathJaxConfig,
              },
            };
            
            //https://github.com/xldenis/obsidian-latex/blob/master/main.ts
            const file = this.app.vault.getAbstractFileByPath("preamble.sty");
            const preamble: string =
              file && file instanceof TFile
                ? await this.app.vault.read(file)
                : null;
            try {
              if (preamble) {
                //@ts-ignore
                await window.ExcalidrawMathJax.tex2svg(preamble);
              }
            } catch (e) {
              errorlog({
                where: self.loadMathJax,
                description: "Unexpected error while loading preamble.sty",
                error: e,
              });
            }
            //@ts-ignore
            self.mathjax = window.ExcalidrawMathJax;
            self.mathjaxLoaderFinished = true;
          });
        };
        script.src = "data:text/javascript;base64," + decompressFromBase64(MATHJAX_SOURCE_LZCOMPRESSED); //self.settings.mathjaxSourceURL; // "https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js";
        //script.src = MATHJAX_DATAURL;
        document.head.appendChild(script);
      } catch {
        new Notice("Excalidraw: Error initializing LaTeX support");
        self.mathjaxLoaderFinished = true;
      }
    });
  }

/*  public loadMathJax() {
    const self = this;
    this.app.workspace.onLayoutReady(async () => {
      //loading Obsidian MathJax as fallback
      await loadMathJax();
      //@ts-ignore
      try {
        if(self.mathjaxDiv) {
          document.body.removeChild(self.mathjaxDiv);
          self.mathjax = null;
          self.mathjaxLoaderFinished = false;
        }
        self.mathjaxDiv = document.body.createDiv();
        self.mathjaxDiv.title = "Excalidraw MathJax Support";
        self.mathjaxDiv.style.display = "none";

        const iframe = self.mathjaxDiv.createEl("iframe");
        iframe.title = "Excalidraw MathJax Support";
        const doc = iframe.contentWindow.document;

        const script = doc.createElement("script");
        script.type = "text/javascript";
        script.onload = () => {
          const win = iframe.contentWindow;
          //@ts-ignore
          win.MathJax.startup.pagePromise.then(async () => {
            //https://github.com/xldenis/obsidian-latex/blob/master/main.ts
            const file = this.app.vault.getAbstractFileByPath("preamble.sty");
            const preamble: string =
              file && file instanceof TFile
                ? await this.app.vault.read(file)
                : null;
            try {
              if (preamble) {
                //@ts-ignore
                await win.MathJax.tex2svg(preamble);
              }
            } catch (e) {
              errorlog({
                where: self.loadMathJax,
                description: "Unexpected error while loading preamble.sty",
                error: e,
              });
            }
            //@ts-ignore
            self.mathjax = win.MathJax;
            self.mathjaxLoaderFinished = true;
          });
        };
        script.src = "data:text/javascript;base64," + decompressFromBase64(MATHJAX_SOURCE_LZCOMPRESSED); //self.settings.mathjaxSourceURL; // "https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js";
        //script.src = MATHJAX_DATAURL;
        doc.head.appendChild(script);
      } catch {
        new Notice("Excalidraw: Error initializing LaTeX support");
        self.mathjaxLoaderFinished = true;
      }
    });
  }*/

  private switchToExcalidarwAfterLoad() {
    const self = this;
    this.app.workspace.onLayoutReady(() => {
      let leaf: WorkspaceLeaf;
      for (leaf of app.workspace.getLeavesOfType("markdown")) {
        if (
          leaf.view instanceof MarkdownView &&
          self.isExcalidrawFile(leaf.view.file)
        ) {
          self.excalidrawFileModes[(leaf as any).id || leaf.view.file.path] =
            VIEW_TYPE_EXCALIDRAW;
          self.setExcalidrawView(leaf);
        }
      }
    });
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
    initializeMarkdownPostProcessor(this);
    this.registerMarkdownPostProcessor(markdownPostProcessor);

    // internal-link quick preview
    this.registerEvent(this.app.workspace.on("hover-link", hoverEvent));

    //monitoring for div.popover.hover-popover.file-embed.is-loaded to be added to the DOM tree
    this.observer = observer;
    this.observer.observe(document, { childList: true, subtree: true });
  }

  private addThemeObserver() {
    this.themeObserver = new MutationObserver(async (m: MutationRecord[]) => {
      if (!this.settings.matchThemeTrigger) {
        return;
      }
      //@ts-ignore
      if (m[0]?.oldValue === m[0]?.target?.getAttribute("class")) {
        return;
      }
      if (
        m[0]?.oldValue?.includes("theme-dark") ===
        //@ts-ignore
        m[0]?.target?.classList?.contains("theme-dark")
      ) {
        return;
      }
      const theme = isObsidianThemeDark() ? "dark" : "light";
      const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);
      leaves.forEach((leaf: WorkspaceLeaf) => {
        const excalidrawView = leaf.view as ExcalidrawView;
        if (excalidrawView.file && excalidrawView.excalidrawRef) {
          excalidrawView.setTheme(theme);
        }
      });
    });
    this.themeObserver.observe(document.body, {
      attributeOldValue: true,
      attributeFilter: ["class"],
    });
  }

  public experimentalFileTypeDisplayToggle(enabled: boolean) {
    if (enabled) {
      this.experimentalFileTypeDisplay();
      return;
    }
    if (this.fileExplorerObserver) {
      this.fileExplorerObserver.disconnect();
    }
    this.fileExplorerObserver = null;
  }

  /**
   * Display characters configured in settings, in front of the filename, if the markdown file is an excalidraw drawing
   */
  private experimentalFileTypeDisplay() {
    const insertFiletype = (el: HTMLElement) => {
      if (el.childElementCount != 1) {
        return;
      }
      const filename = el.getAttribute("data-path");
      if (!filename) {
        return;
      }
      const f = this.app.vault.getAbstractFileByPath(filename);
      if (!f || !(f instanceof TFile)) {
        return;
      }
      if (this.isExcalidrawFile(f)) {
        el.insertBefore(
          createDiv({
            cls: "nav-file-tag",
            text: this.settings.experimentalFileTag,
          }),
          el.firstChild,
        );
      }
    };

    this.fileExplorerObserver = new MutationObserver((m) => {
      const mutationsWithNodes = m.filter((v) => v.addedNodes.length > 0);
      mutationsWithNodes.forEach((mu) => {
        mu.addedNodes.forEach((n) => {
          if (!(n instanceof Element)) {
            return;
          }
          n.querySelectorAll(".nav-file-title").forEach(insertFiletype);
        });
      });
    });

    const self = this;
    this.app.workspace.onLayoutReady(() => {
      document.querySelectorAll(".nav-file-title").forEach(insertFiletype); //apply filetype to files already displayed
      self.fileExplorerObserver.observe(document.querySelector(".workspace"), {
        childList: true,
        subtree: true,
      });
    });
  }

  private registerCommands() {
    this.openDialog = new OpenFileDialog(this.app, this);
    this.insertLinkDialog = new InsertLinkDialog(this.app);
    this.insertCommandDialog = new InsertCommandDialog(this.app);
    this.insertImageDialog = new InsertImageDialog(this);
    this.importSVGDialog = new ImportSVGDialog(this);
    this.insertMDDialog = new InsertMDDialog(this);

    this.addRibbonIcon(ICON_NAME, t("CREATE_NEW"), async (e) => {
      this.createAndOpenDrawing(
        getDrawingFilename(this.settings),
        linkClickModifierType(emulateCTRLClickForLinks(e)),
      ); 
    });

    const fileMenuHandlerCreateNew = (menu: Menu, file: TFile) => {
      menu.addItem((item: MenuItem) => {
        item
          .setTitle(t("CREATE_NEW"))
          .setIcon(ICON_NAME)
          .onClick((e) => {
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
          });
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
      callback: this.exportLibrary,
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
            this.lastActiveExcalidrawFilePath != null
          );
        }
        const file = this.app.vault.getAbstractFileByPath(
          this.lastActiveExcalidrawFilePath,
        );
        if (!(file instanceof TFile)) {
          return false;
        }
        this.embedDrawing(file);
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
          return !app.isMobile
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
      await this.embedDrawing(file);
      this.openDrawing(file, location, true, undefined, true);
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
          return !app.isMobile && Boolean(this.app.workspace.getActiveViewOfType(MarkdownView));
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
          this.taskbone.getTextForView(view, false);
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
      hotkeys: [{ modifiers: ["Ctrl" || "Meta", "Shift"], key: "e" }],
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
      hotkeys: [{ modifiers: ["Ctrl" || "Meta", "Shift"], key: "k" }],
      name: t("INSERT_LINK"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          this.insertLinkDialog.start(view.file.path, view.addLink);
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
          this.insertCommandDialog.start(view.addText);
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "insert-link-to-element",
      hotkeys: [{ modifiers: ["Ctrl" || "Meta", "Shift"], key: "k" }],
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
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
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
        const el = els[0] as ExcalidrawImageElement;
        const ef = view.excalidrawData.getFile(el.fileId);
        if(!ef) {
          if(checking) return false;
          new Notice("Select a single image element and try again");
          return false;
        }
        if(checking) return true;

        (async () => {
          const ea = new ExcalidrawAutomate(this,view);
          const size = await ea.getOriginalImageSize(el);
          if(size) {
            ea.copyViewElementsToEAforEditing(els);
            const eaEl = ea.getElement(el.id);
            //@ts-ignore
            eaEl.width = size.width; eaEl.height = size.height;
            ea.addElementsToView(false,false,false);
          }
        })()
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
          if (!view || !view.excalidrawRef) {
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
          const activeLeaf = excalidrawView.leaf;
          this.excalidrawFileModes[(activeLeaf as any).id || activeFile.path] =
            "markdown";
          this.setMarkdownView(activeLeaf);
          return;
        }

        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView)
        if (markdownView && fileIsExcalidraw) {
          const activeLeaf = markdownView.leaf;
          this.excalidrawFileModes[(activeLeaf as any).id || activeFile.path] =
            VIEW_TYPE_EXCALIDRAW;
          this.setExcalidrawView(activeLeaf);
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

        const isFileEmpty = activeFile.stat.size === 0;

        if (checking) {
          return isFileEmpty;
        }

        if (isFileEmpty) {
          (async () => {
            await this.app.vault.modify(
              activeFile,
              await this.getBlankDrawing(),
            );
            this.setExcalidrawView(activeView.leaf);
          })();
        }
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
      FRONTMATTER + (await this.exportSceneToMD(data)),
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
            const result = old && old.apply(this, args);
            const maybeEAView = app?.workspace?.activeLeaf?.view;
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
    if(!app.plugins?.plugins?.["obsidian-hover-editor"]) {
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
      app.workspace.on("editor-menu", (menu, editor, view) => {
        if(!view || !(view instanceof MarkdownView)) return;
        const file = view.file;
        const leaf = view.leaf;
        if (!view.file) return;
        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache?.frontmatter || !cache.frontmatter[FRONTMATTER_KEY]) return;
        
        menu.addItem(item => item
          .setTitle(t("OPEN_AS_EXCALIDRAW"))
          .setIcon(ICON_NAME)
          .setSection("excalidraw")
          .onClick(() => {
            //@ts-ignore
            this.excalidrawFileModes[leaf.id || file.path] = VIEW_TYPE_EXCALIDRAW;
            this.setExcalidrawView(leaf);
          }));
        },
      ),
    );

    this.registerEvent(      
      app.workspace.on("file-menu", (menu, file, source, leaf) => {
        if (!leaf || !(leaf.view instanceof MarkdownView)) return;
        if (!(file instanceof TFile)) return;
        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache?.frontmatter || !cache.frontmatter[FRONTMATTER_KEY]) return;
        
        menu.addItem(item => {
          item
          .setTitle(t("OPEN_AS_EXCALIDRAW"))
          .setIcon(ICON_NAME)
          .setSection("pane")
          .onClick(() => {
            //@ts-ignore
            this.excalidrawFileModes[leaf.id || file.path] = VIEW_TYPE_EXCALIDRAW;
            this.setExcalidrawView(leaf);
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
            if (
              // Don't force excalidraw mode during shutdown
              self._loaded &&
              // If we have a markdown file
              state.type === "markdown" &&
              state.state?.file &&
              // And the current mode of the file is not set to markdown
              self.excalidrawFileModes[this.id || state.state.file] !==
                "markdown"
            ) {
              // Then check for the excalidraw frontMatterKey
              const cache = app.metadataCache.getCache(state.state.file);

              if (cache?.frontmatter && cache.frontmatter[FRONTMATTER_KEY]) {
                // If we have it, force the view type to excalidraw
                const newState = {
                  ...state,
                  type: VIEW_TYPE_EXCALIDRAW,
                };

                self.excalidrawFileModes[state.state.file] =
                  VIEW_TYPE_EXCALIDRAW;

                return next.apply(this, [newState, ...rest]);
              }
            }

            return next.apply(this, [state, ...rest]);
          };
        },
      }),
    );
  }

  private popScope: Function = null;
  private registerEventListeners() {
    const self = this;
    this.app.workspace.onLayoutReady(async () => {
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
              const fileinfo = self.filesMaster.get(element.fileId);
              if(fileinfo && fileinfo.path) {
                let path = fileinfo.path;
                const sourceFile = info.file;
                const imageFile = self.app.vault.getAbstractFileByPath(path);
                if(sourceFile && imageFile && imageFile instanceof TFile) {
                  path = self.app.metadataCache.fileToLinktext(imageFile,sourceFile.path);
                }
                //@ts-ignore
                editor.insertText(self.getLink({path}));
              }
              return;
            }
            if (element.type === "text") {
              //@ts-ignore
              editor.insertText(element.text);
              return;
            }
            if (element.link) {
              //@ts-ignore
              editor.insertText(`${element.link}`);
              return;
            }
          } catch (e) {
          }
        }
      };
      self.registerEvent(self.app.workspace.on('editor-paste', onPasteHandler));

      //watch filename change to rename .svg, .png; to sync to .md; to update links
      const renameEventHandler = async (
        file: TAbstractFile,
        oldPath: string,
      ) => {
        if (!(file instanceof TFile)) {
          return;
        }
        if (!self.isExcalidrawFile(file)) {
          return;
        }
        if (!self.settings.keepInSync) {
          return;
        }
        [EXPORT_TYPES, "excalidraw"].flat().forEach(async (ext: string) => {
          const oldIMGpath = getIMGFilename(oldPath, ext);
          const imgFile = app.vault.getAbstractFileByPath(
            normalizePath(oldIMGpath),
          );
          if (imgFile && imgFile instanceof TFile) {
            const newIMGpath = getIMGFilename(file.path, ext);
            await app.fileManager.renameFile(imgFile, newIMGpath);
          }
        });
      };
      self.registerEvent(app.vault.on("rename", renameEventHandler));

      const modifyEventHandler = async (file: TFile) => {
        const leaves = app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);
        leaves.forEach(async (leaf: WorkspaceLeaf) => {
          const excalidrawView = leaf.view as ExcalidrawView;
          if (
            excalidrawView.file &&
            (excalidrawView.file.path === file.path ||
              (file.extension === "excalidraw" &&
                `${file.path.substring(
                  0,
                  file.path.lastIndexOf(".excalidraw"),
                )}.md` === excalidrawView.file.path))
          ) {
            if(excalidrawView.semaphores.preventReload) {
              excalidrawView.semaphores.preventReload = false;
              return;
            }
            //if the user hasn't touched the file for 5 minutes, don't synchronize, reload.
            //this is to avoid complex sync scenarios of multiple remote changes outside an active collaboration session
            if(excalidrawView.lastSaveTimestamp + 300000 < Date.now()) {
              excalidrawView.reload(true, excalidrawView.file);
              return;
            }           
            if(file.extension==="md") {
              const inData = new ExcalidrawData(self);
              const data = await app.vault.read(file);
              await inData.loadData(data,file,getTextMode(data));
              excalidrawView.synchronizeWithData(inData);
              if(excalidrawView.semaphores.dirty) {
                if(excalidrawView.autosaveTimer && excalidrawView.autosaveFunction) {
                  clearTimeout(excalidrawView.autosaveTimer);
                }
                if(excalidrawView.autosaveFunction) {
                  excalidrawView.autosaveFunction();
                }
              }
            } else {
              excalidrawView.reload(true, excalidrawView.file);
            }
          }
        });
      };
      self.registerEvent(app.vault.on("modify", modifyEventHandler));

      //watch file delete and delete corresponding .svg and .png
      const deleteEventHandler = async (file: TFile) => {
        if (!(file instanceof TFile)) {
          return;
        }

        const isExcalidarwFile = this.excalidrawFiles.has(file);
        this.updateFileCache(file, undefined, true);
        if (!isExcalidarwFile) {
          return;
        }

        //close excalidraw view where this file is open
        const leaves = app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);
        for (let i = 0; i < leaves.length; i++) {
          if ((leaves[i].view as ExcalidrawView).file.path == file.path) {
            await leaves[i].setViewState({
              type: VIEW_TYPE_EXCALIDRAW,
              state: { file: null },
            });
          }
        }

        //delete PNG and SVG files as well
        if (self.settings.keepInSync) {
          setTimeout(() => {
            [EXPORT_TYPES, "excalidraw"].flat().forEach(async (ext: string) => {
              const imgPath = getIMGFilename(file.path, ext);
              const imgFile = app.vault.getAbstractFileByPath(
                normalizePath(imgPath),
              );
              if (imgFile && imgFile instanceof TFile) {
                await app.vault.delete(imgFile);
              }
            });
          }, 500);
        }
      };
      self.registerEvent(app.vault.on("delete", deleteEventHandler));

      //save open drawings when user quits the application
      //Removing because it is not guaranteed to run, and frequently gets terminated mid flight, causing file consistency issues
      /*const quitEventHandler = async () => {
        const leaves = app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);
        for (let i = 0; i < leaves.length; i++) {
          await (leaves[i].view as ExcalidrawView).save(true);
        }
      };
      self.registerEvent(app.workspace.on("quit", quitEventHandler));*/

      //save Excalidraw leaf and update embeds when switching to another leaf
      const activeLeafChangeEventHandler = async (leaf: WorkspaceLeaf) => {
        //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/723
        if(self.leafChangeTimeout) {
          clearTimeout(self.leafChangeTimeout);
        }
        self.leafChangeTimeout = setTimeout(()=>{self.leafChangeTimeout = null;},1000);

        const previouslyActiveEV = self.activeExcalidrawView;
        const newActiveviewEV: ExcalidrawView =
          leaf.view instanceof ExcalidrawView ? leaf.view : null;
        self.activeExcalidrawView = newActiveviewEV;

        if (newActiveviewEV) {
          self.lastActiveExcalidrawFilePath = newActiveviewEV.file?.path;
        }

        //!Temporary hack
        //https://discord.com/channels/686053708261228577/817515900349448202/1031101635784613968
        if (app.isMobile && newActiveviewEV && !previouslyActiveEV) {
          const navbar = document.querySelector("body>.app-container>.mobile-navbar");
          if(navbar && navbar instanceof HTMLDivElement) {
            navbar.style.position="relative";
          }
        }

        if (app.isMobile && !newActiveviewEV && previouslyActiveEV) {
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
            if(previouslyActiveEV.semaphores.dirty && !previouslyActiveEV.semaphores.viewunload) {
              await previouslyActiveEV.save(true); //this will update transclusions in the drawing
            }
          }
          if (previouslyActiveEV.file) {
            self.triggerEmbedUpdates(previouslyActiveEV.file.path);
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
          self.ea.onCanvasColorChangeHook
        ) {
          self.ea.onCanvasColorChangeHook(
            self.ea,
            newActiveviewEV,
            newActiveviewEV.excalidrawAPI.getAppState().viewBackgroundColor
          );
        }

        //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/300
        if (self.popScope) {
          self.popScope();
          self.popScope = null;
        }
        if (newActiveviewEV) {
          const scope = self.app.keymap.getRootScope();
          const handler_ctrlEnter = scope.register(["Mod"], "Enter", () => true);
          scope.keys.unshift(scope.keys.pop()); // Force our handler to the front of the list
          const handler_ctrlK = scope.register(["Mod"], "k", () => {return true});
          scope.keys.unshift(scope.keys.pop()); // Force our handler to the front of the list
          const handler_ctrlF = scope.register(["Mod"], "f", () => {
            const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
            if (view) {
              search(view);
              return true;
            }
            return false;
          });
          scope.keys.unshift(scope.keys.pop()); // Force our handler to the front of the list
          const overridSaveShortcut = (
            self.forceSaveCommand &&
            self.forceSaveCommand.hotkeys[0].key === "s" &&
            self.forceSaveCommand.hotkeys[0].modifiers.includes("Ctrl")
          )
          const saveHandler = overridSaveShortcut
           ? scope.register(["Ctrl"], "s", () => self.forceSaveActiveView(false))
           : undefined;
          if(saveHandler) {
            scope.keys.unshift(scope.keys.pop()); // Force our handler to the front of the list
          }
          self.popScope = () => {
            scope.unregister(handler_ctrlEnter);
            scope.unregister(handler_ctrlK);
            scope.unregister(handler_ctrlF);
            Boolean(saveHandler) && scope.unregister(saveHandler);
          }
        }
      };
      self.registerEvent(
        app.workspace.on(
          "active-leaf-change",
          activeLeafChangeEventHandler,
        ),
      );

      self.addFileSaveTriggerEventHandlers();

      const metaCache: MetadataCache = app.metadataCache;
      //@ts-ignore
      metaCache.getCachedFiles().forEach((filename: string) => {
        const fm = metaCache.getCache(filename)?.frontmatter;
        if (
          (fm && typeof fm[FRONTMATTER_KEY] !== "undefined") ||
          filename.match(/\.excalidraw$/)
        ) {
          self.updateFileCache(
            app.vault.getAbstractFileByPath(filename) as TFile,
            fm,
          );
        }
      });
      this.registerEvent(
        metaCache.on("changed", (file, data, cache) =>
          this.updateFileCache(file, cache?.frontmatter),
        ),
      );
    });
  }

  //Save the drawing if the user clicks outside the canvas
  addFileSaveTriggerEventHandlers() {
    //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/551
    const onClickEventSaveActiveDrawing = (e: PointerEvent) => {
      if (
        !this.activeExcalidrawView ||
        !this.activeExcalidrawView.semaphores.dirty ||
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
      if (
        !this.activeExcalidrawView ||
        !this.activeExcalidrawView.semaphores.dirty
      ) {
        return;
      }
      this.activeExcalidrawView.save();
    };
    this.registerEvent(
      this.app.workspace.on("file-menu", onFileMenuEventSaveActiveDrawing),
    );

    //The user clicks settings, or "open another vault", or the command palette
    this.modalContainerObserver = new MutationObserver(
      async (m: MutationRecord[]) => {
        if (
          m.length !== 1 ||
          m[0].type !== "childList" ||
          m[0].addedNodes.length !== 1 ||
          !this.activeExcalidrawView ||
          !this.activeExcalidrawView.semaphores.dirty
        ) {
          return;
        }
        this.activeExcalidrawView.save();
      },
    );
    this.modalContainerObserver.observe(document.body, {
      childList: true,
    });

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
          !this.activeExcalidrawView.semaphores.dirty
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
        this.workspaceDrawerLeftObserver = new MutationObserver(action);
        this.workspaceDrawerLeftObserver.observe(leftWorkspaceDrawer, options);
      }

      if (rightWorkspaceDrawer) {
        this.workspaceDrawerRightObserver = new MutationObserver(action);
        this.workspaceDrawerRightObserver.observe(
          rightWorkspaceDrawer,
          options,
        );
      }
    }
  }

  updateFileCache(
    file: TFile,
    frontmatter?: FrontMatterCache,
    deleted: boolean = false,
  ) {
    if (frontmatter && typeof frontmatter[FRONTMATTER_KEY] !== "undefined") {
      this.excalidrawFiles.add(file);
      return;
    }
    if (!deleted && file.extension === "excalidraw") {
      this.excalidrawFiles.add(file);
      return;
    }
    this.excalidrawFiles.delete(file);
  }

  onunload() {
    this.stylesManager.unload();
    this.removeEventLisnters.forEach((removeEventListener) =>
      removeEventListener(),
    );
    destroyExcalidrawAutomate();
    if (this.popScope) {
      this.popScope();
      this.popScope = null;
    }
    this.observer.disconnect();
    this.themeObserver.disconnect();
    this.modalContainerObserver.disconnect();
    if (this.workspaceDrawerLeftObserver) {
      this.workspaceDrawerLeftObserver.disconnect();
    }
    if (this.workspaceDrawerRightObserver) {
      this.workspaceDrawerRightObserver.disconnect();
    }
    if (this.fileExplorerObserver) {
      this.fileExplorerObserver.disconnect();
    }
    const excalidrawLeaves =
      this.app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);
    excalidrawLeaves.forEach((leaf) => {
      this.setMarkdownView(leaf);
    });

    this.removeMathJax();
/*    if (this.mathjaxDiv) {
      document.body.removeChild(this.mathjaxDiv);
    }*/

    Object.values(this.packageMap).forEach((p:Packages)=>{
      delete p.excalidrawLib;
      delete p.reactDOM;
      delete p.react;
    })
  }

  public getLink(
    { embed = true, path, alias }: { embed?: boolean; path: string; alias?: string }
  ):string {
    return this.settings.embedWikiLink
      ? `${embed ? "!" : ""}[[${path}${alias ? `|${alias}` : ""}]]`
      : `${embed ? "!" : ""}[${alias ?? ""}](${encodeURI(path)})`
  }

  public async embedDrawing(file: TFile) {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView && activeView.file) {
      const excalidrawRelativePath = this.app.metadataCache.fileToLinktext(
        file,
        activeView.file.path,
        this.settings.embedType === "excalidraw",
      );
      const editor = activeView.editor;

      //embed Excalidraw
      if (this.settings.embedType === "excalidraw") {
        editor.replaceSelection(
          this.getLink({path: excalidrawRelativePath}),
        );
        editor.focus();
        return;
      }

      //embed image
      let theme = this.settings.autoExportLightAndDark
        ? getExportTheme (
          this,
          file,
          this.settings.exportWithTheme
            ? isObsidianThemeDark() ? "dark":"light"
            : "light"
          )
        : "";

      theme = theme===""?"":theme+".";

      const imageRelativePath = getIMGFilename(
        excalidrawRelativePath,
        theme+this.settings.embedType.toLowerCase(),
      );
      const imageFullpath = getIMGFilename(
        file.path,
        theme+this.settings.embedType.toLowerCase(),
      );
     
      //will hold incorrect value if theme==="", however in that case it won't be used
      const otherTheme = theme === "dark." ? "light.":"dark.";
      const otherImageRelativePath = getIMGFilename(
        excalidrawRelativePath,
        otherTheme+this.settings.embedType.toLowerCase(),
      );
      

      const imgFile = this.app.vault.getAbstractFileByPath(imageFullpath);
      if (!imgFile) {
        await this.app.vault.create(imageFullpath, "");
        await sleep(200); //wait for metadata cache to update
      }

      editor.replaceSelection(
        this.settings.embedWikiLink
          ? `![[${imageRelativePath}]]\n%%[[${excalidrawRelativePath}|🖋 Edit in Excalidraw]]${
            otherImageRelativePath ? ", and the [["+otherImageRelativePath+"|"+otherTheme.split(".")[0]+" exported image]]":""}%%`
          : `![](${encodeURI(imageRelativePath)})\n%%[🖋 Edit in Excalidraw](${encodeURI(
            excalidrawRelativePath,
            )})${otherImageRelativePath?", and the ["+otherTheme.split(".")[0]+" exported image]("+encodeURI(otherImageRelativePath)+")":""}%%`,
      );
      editor.focus();
    }
  }

  public async loadSettings(opts: {
    applyLefthandedMode?: boolean,
    reEnableAutosave?: boolean
  } = {applyLefthandedMode: true, reEnableAutosave: false}
  ) {
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
    this.settings.autosaveInterval = app.isMobile
    ? this.settings.autosaveIntervalMobile
    : this.settings.autosaveIntervalDesktop;
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  public getStencilLibrary(): {} {
    if (
      this.settings.library === "" ||
      this.settings.library === "deprecated"
    ) {
      return this.settings.library2;
    }
    return JSON_parse(this.settings.library);
  }

  public setStencilLibrary(library: {}) {
    this.settings.library = "deprecated";
    this.settings.library2 = library;
  }

  public triggerEmbedUpdates(filepath?: string) {
    const visitedDocs = new Set<Document>();
    app.workspace.iterateAllLeaves((leaf)=>{
      const ownerDocument = app.isMobile?document:leaf.view.containerEl.ownerDocument;
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

  public openDrawing(
    drawingFile: TFile,
    location: PaneTarget,
    active: boolean = false,
    subpath?: string,
    justCreated: boolean = false
  ) {
    if(location === "md-properties") {
      location = "new-tab";
    }
    let leaf: WorkspaceLeaf;
    if(location === "popout-window") {
      leaf = app.workspace.openPopoutLeaf();
    }
    if(location === "new-tab") {
      leaf = app.workspace.getLeaf('tab');
    }
    if(!leaf) {
      leaf = this.app.workspace.getLeaf(false);
      if ((leaf.view.getViewType() !== 'empty') && (location === "new-pane")) {
        leaf = getNewOrAdjacentLeaf(this, leaf)    
      }
    }

    leaf.openFile(
      drawingFile, 
      !subpath || subpath === "" 
        ? {active}
        : { active, eState: { subpath } }
    ).then(()=>{
      if(justCreated && this.ea.onFileCreateHook) {
        try {
          this.ea.onFileCreateHook({
            ea: this.ea,
            excalidrawFile: drawingFile,
            view: leaf.view as ExcalidrawView,
          });
        } catch(e) {
          console.error(e);
        }
      }
    })
  }

  public async getBlankDrawing(): Promise<string> {
    const template = this.app.metadataCache.getFirstLinkpathDest(
      normalizePath(this.settings.templateFilePath),
      "",
    );
    if (template && template instanceof TFile) {
      if (
        (template.extension == "md" && !this.settings.compatibilityMode) ||
        (template.extension == "excalidraw" && this.settings.compatibilityMode)
      ) {
        const data = await this.app.vault.read(template);
        if (data) {
          return this.settings.matchTheme
            ? changeThemeOfExcalidrawMD(data)
            : data;
        }
      }
    }
    if (this.settings.compatibilityMode) {
      return this.settings.matchTheme && isObsidianThemeDark()
        ? DARK_BLANK_DRAWING
        : BLANK_DRAWING;
    }
    const blank =
      this.settings.matchTheme && isObsidianThemeDark()
        ? DARK_BLANK_DRAWING
        : BLANK_DRAWING;
    return `${FRONTMATTER}\n${getMarkdownDrawingSection(
      blank,
      this.settings.compress,
    )}`;
  }

  /**
   * Extracts the text elements from an Excalidraw scene into a string of ids as headers followed by the text contents
   * @param {string} data - Excalidraw scene JSON string
   * @returns {string} - Text starting with the "# Text Elements" header and followed by each "## id-value" and text
   */
  public async exportSceneToMD(data: string): Promise<string> {
    if (!data) {
      return "";
    }
    const excalidrawData = JSON_parse(data);
    const textElements = excalidrawData.elements?.filter(
      (el: any) => el.type == "text",
    );
    let outString = "# Text Elements\n";
    let id: string;
    for (const te of textElements) {
      id = te.id;
      //replacing Excalidraw text IDs with my own, because default IDs may contain
      //characters not recognized by Obsidian block references
      //also Excalidraw IDs are inconveniently long
      if (te.id.length > 8) {
        id = nanoid();
        data = data.replaceAll(te.id, id); //brute force approach to replace all occurances.
      }
      outString += `${te.originalText ?? te.text} ^${id}\n\n`;
    }
    return (
      outString +
      getMarkdownDrawingSection(
        JSON.stringify(JSON_parse(data), null, "\t"),
        this.settings.compress,
      )
    );
  }

  public async createDrawing(
    filename: string,
    foldername?: string,
    initData?: string,
  ): Promise<TFile> {
    const folderpath = normalizePath(
      foldername ? foldername : this.settings.folder,
    );
    await checkAndCreateFolder(folderpath); //create folder if it does not exist
    const fname = getNewUniqueFilepath(this.app.vault, filename, folderpath);
    const file = await this.app.vault.create(
      fname,
      initData ?? (await this.getBlankDrawing()),
    );
    
    //wait for metadata cache
    let counter = 0;
    while(file instanceof TFile && !this.isExcalidrawFile(file) && counter++<10) {
      await sleep(50);
    }
    
    if(counter > 10) {
      errorlog({file, error: "new drawing not recognized as an excalidraw file", fn: this.createDrawing});
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
    this.openDrawing(file, location, true, undefined, true);
    return file.path;
  }

  public async setMarkdownView(leaf: WorkspaceLeaf) {
    const state = leaf.view.getState();

    await leaf.setViewState({
      type: VIEW_TYPE_EXCALIDRAW,
      state: { file: null },
    });

    await leaf.setViewState(
      {
        type: "markdown",
        state,
        popstate: true,
      } as ViewState,
      { focus: true },
    );
  }

  public async setExcalidrawView(leaf: WorkspaceLeaf) {
    await leaf.setViewState({
      type: VIEW_TYPE_EXCALIDRAW,
      state: leaf.view.getState(),
      popstate: true,
    } as ViewState);
  }

  public isExcalidrawFile(f: TFile) {
    if(!f) return false;
    if (f.extension === "excalidraw") {
      return true;
    }
    const fileCache = f ? this.app.metadataCache.getFileCache(f) : null;
    return !!fileCache?.frontmatter && !!fileCache.frontmatter[FRONTMATTER_KEY];
  }

  public async exportLibrary() {
    if (this.app.isMobile) {
      const prompt = new Prompt(
        this.app,
        "Please provide a filename",
        "my-library",
        "filename, leave blank to cancel action",
      );
      prompt.openAndGetValue(async (filename: string) => {
        if (!filename) {
          return;
        }
        filename = `${filename}.excalidrawlib`;
        const folderpath = normalizePath(this.settings.folder);
        await checkAndCreateFolder(folderpath); //create folder if it does not exist
        const fname = getNewUniqueFilepath(
          this.app.vault,
          filename,
          folderpath,
        );
        this.app.vault.create(fname, this.settings.library);
        new Notice(`Exported library to ${fname}`, 6000);
      });
      return;
    }
    download(
      "data:text/plain;charset=utf-8",
      encodeURIComponent(JSON.stringify(this.settings.library2, null, "\t")),
      "my-obsidian-library.excalidrawlib",
    );
  }
}
