import {
  TextFileView,
  WorkspaceLeaf,
  normalizePath,
  TFile,
  WorkspaceItem,
  Notice,
  Menu,
  MarkdownView,
  request,
} from "obsidian";
//import * as React from "react";
//import * as ReactDOM from "react-dom";
//import Excalidraw from "@zsviczian/excalidraw";
import {
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
} from "@zsviczian/excalidraw/types/element/types";
import {
  AppState,
  BinaryFileData,
  ExcalidrawImperativeAPI,
  LibraryItems,
} from "@zsviczian/excalidraw/types/types";
import {
  VIEW_TYPE_EXCALIDRAW,
  ICON_NAME,
  DISK_ICON_NAME,
  SCRIPTENGINE_ICON_NAME,
  PNG_ICON_NAME,
  SVG_ICON_NAME,
  FRONTMATTER_KEY,
  TEXT_DISPLAY_RAW_ICON_NAME,
  TEXT_DISPLAY_PARSED_ICON_NAME,
  FULLSCREEN_ICON_NAME,
  IMAGE_TYPES,
  CTRL_OR_CMD,
  REG_LINKINDEX_INVALIDCHARS,
  KEYCODE,
  LOCAL_PROTOCOL,
} from "./Constants";
import ExcalidrawPlugin from "./main";
import { repositionElementsToCursor, ExcalidrawAutomate } from "./ExcalidrawAutomate";
import { t } from "./lang/helpers";
import {
  ExcalidrawData,
  REG_LINKINDEX_HYPERLINK,
  REGEX_LINK,
} from "./ExcalidrawData";
import {
  checkAndCreateFolder,
  download,
  getIMGFilename,
  getNewUniqueFilepath,
} from "./utils/FileUtils";
import {
  checkExcalidrawVersion,
  debug,
  embedFontsInSVG,
  errorlog,
  getExportTheme,
  getLinkParts,
  getPNG,
  getPNGScale,
  getSVG,
  getSVGPadding,
  getWithBackground,
  hasExportTheme,
  scaleLoadedImage,
  svgToBase64,
  viewportCoordsToSceneCoords,
} from "./utils/Utils";
import { getNewOrAdjacentLeaf, getParentOfClass } from "./utils/ObsidianUtils";
import { splitFolderAndFilename } from "./utils/FileUtils";
import { NewFileActions, Prompt } from "./dialogs/Prompt";
import { ClipboardData } from "@zsviczian/excalidraw/types/clipboard";
import { updateEquation } from "./LaTeX";
import {
  EmbeddedFile,
  EmbeddedFilesLoader,
  FileData,
} from "./EmbeddedFileLoader";
import { ScriptInstallPrompt } from "./dialogs/ScriptInstallPrompt";
import { ObsidianMenu } from "./menu/ObsidianMenu";
import { ToolsPanel } from "./menu/ToolsPanel";
import { ScriptEngine } from "./Scripts";
import { getTextElementAtPointer, getImageElementAtPointer, getElementWithLinkAtPointer } from "./utils/GetElementAtPointer";


export enum TextMode {
  parsed,
  raw,
}

interface WorkspaceItemExt extends WorkspaceItem {
  containerEl: HTMLElement;
}

export interface ExportSettings {
  withBackground: boolean;
  withTheme: boolean;
}

export const addFiles = async (
  files: FileData[],
  view: ExcalidrawView,
  isDark?: boolean,
) => {
  if (!files || files.length === 0 || !view) {
    return;
  }
  const api = view.excalidrawAPI;
  if (!api) {
    return;
  }

  //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/544
  files = files.filter(
    (f) => f && f.size && f.size.height > 0 && f.size.width > 0,
  ); //height will be zero when file does not exisig in case of broken embedded file links
  if (files.length === 0) {
    return;
  }
  const s = scaleLoadedImage(view.getScene(), files);
  if (isDark === undefined) {
    isDark = s.scene.appState.theme;
  }
  if (s.dirty) {
    //debug({where:"ExcalidrawView.addFiles",file:view.file.name,dataTheme:view.excalidrawData.scene.appState.theme,before:"updateScene",state:scene.appState})
    view.updateScene({
      elements: s.scene.elements,
      appState: s.scene.appState,
      commitToHistory: false,
    });
  }
  for (const f of files) {
    if (view.excalidrawData.hasFile(f.id)) {
      const embeddedFile = view.excalidrawData.getFile(f.id);

      embeddedFile.setImage(
        f.dataURL,
        f.mimeType,
        f.size,
        isDark,
        f.hasSVGwithBitmap,
      );
    }
    if (view.excalidrawData.hasEquation(f.id)) {
      const latex = view.excalidrawData.getEquation(f.id).latex;
      view.excalidrawData.setEquation(f.id, { latex, isLoaded: true });
    }
  }
  api.addFiles(files);
};

const warningUnknowSeriousError = () => {
  new Notice(
    "WARNING: Excalidraw ran into an unknown problem!\n\n" +
      "There is a risk that your most recent changes cannot be saved.\n\n" +
      "To be on the safe side...\n" +
      "1) Please select your drawing using CTRL/CMD+A and make a copy with CTRL/CMD+C.\n" +
      "2) Then create an empty drawing in a new pane by CTRL/CMD+clicking the Excalidraw ribbon button,\n" +
      "3) and paste your work to the new document with CTRL/CMD+V.",
    60000,
  );
};

export default class ExcalidrawView extends TextFileView {
  public excalidrawData: ExcalidrawData;
  public getScene: Function = null;
  public addElements: Function = null; //add elements to the active Excalidraw drawing
  private getSelectedTextElement: Function = null;
  private getSelectedImageElement: Function = null;
  private getSelectedElementWithLink: Function = null;
  public addText: Function = null;
  private refresh: Function = null;
  public excalidrawRef: React.MutableRefObject<any> = null;
  public excalidrawAPI: any = null;
  public excalidrawWrapperRef: React.MutableRefObject<any> = null;
  public toolsPanelRef: React.MutableRefObject<any> = null;
  private parentMoveObserver: MutationObserver;
  public linksAlwaysOpenInANewPane: boolean = false; //override the need for SHIFT+CTRL+click
  private hookServer: ExcalidrawAutomate;
  public lastSaveTimestamp: number = 0; //used to validate if incoming file should sync with open file
  private onKeyUp: (e: KeyboardEvent) => void;
  private onKeyDown:(e: KeyboardEvent) => void;
  //store key state for view mode link resolution
  private metaKeyDown: boolean = false;
  private ctrlKeyDown: boolean = false;
  private shiftKeyDown: boolean = false;
  private altKeyDown: boolean = false;
  //Obsidian 0.15.0
  public ownerWindow: Window;
  public ownerDocument: Document;

  public semaphores: {
    viewunload: boolean;
    //first time initialization of the view
    scriptsReady: boolean;

    //The role of justLoaded is to capture the Excalidraw.onChange event that fires right after the canvas was loaded for the first time to
    //- prevent the first onChange event to mark the file as dirty and to consequently cause a save right after load, causing sync issues in turn
    //- trigger autozoom (in conjunction with preventAutozoomOnLoad)
    justLoaded: boolean;

    //the modifyEventHandler in main.ts will fire when an Excalidraw file has changed (e.g. due to sync)
    //when a drawing that is currently open in a view receives a sync update, excalidraw reload() is triggered
    //the preventAutozoomOnLoad flag will prevent the open drawing from autozooming when it is reloaded
    preventAutozoom: boolean;

    autosaving: boolean; //flags that autosaving is in progress. Autosave is an async timer, the flag prevents collision with force save
    forceSaving: boolean; //flags that forcesaving is in progress. The flag prevents collision with autosaving
    dirty: string; //null if there are no changes to be saved, the path of the file if the drawing has unsaved changes

    //reload() is triggered by modifyEventHandler in main.ts. preventReload is a one time flag to abort reloading
    //to avoid interrupting the flow of drawing by the user.
    preventReload: boolean;

    isEditingText: boolean; //https://stackoverflow.com/questions/27132796/is-there-any-javascript-event-fired-when-the-on-screen-keyboard-on-mobile-safari

    //Save is triggered by multiple threads when an Excalidraw pane is terminated
    //- by the view itself
    //- by the activeLeafChangeEventHandler change event handler
    //- by monkeypatches on detach(next)
    //This semaphore helps avoid collision of saves
    saving: boolean;
    hoverSleep: boolean; //flag with timer to prevent hover preview from being triggered dozens of times
  } = {
    viewunload: false,
    scriptsReady: false,
    justLoaded: false,
    preventAutozoom: false,
    autosaving: false,
    dirty: null,
    preventReload: false,
    isEditingText: false,
    saving: false,
    forceSaving: false,
    hoverSleep: false,
  };

  public plugin: ExcalidrawPlugin;
  public autosaveTimer: any = null;
  public textMode: TextMode = TextMode.raw;
  private textIsParsed_Element: HTMLElement;
  private textIsRaw_Element: HTMLElement;
  public compatibilityMode: boolean = false;
  private obsidianMenu: ObsidianMenu;

  //https://stackoverflow.com/questions/27132796/is-there-any-javascript-event-fired-when-the-on-screen-keyboard-on-mobile-safari
  private isEditingTextResetTimer: NodeJS.Timeout = null;

  id: string = (this.leaf as any).id;

  constructor(leaf: WorkspaceLeaf, plugin: ExcalidrawPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.excalidrawData = new ExcalidrawData(plugin);
    this.hookServer = plugin.ea;
  }

  setHookServer(ea:ExcalidrawAutomate) {
    if(ea) {
      this.hookServer = ea;
    } else {
      this.hookServer = this.plugin.ea;
    }
  }

  getHookServer = () => this.hookServer ?? this.plugin.ea;

  preventAutozoom() {
    this.semaphores.preventAutozoom = true;
    setTimeout(() => (this.semaphores.preventAutozoom = false), 2000);
  }

  public saveExcalidraw(scene?: any) {
    if (!scene) {
      if (!this.getScene) {
        return false;
      }
      scene = this.getScene();
    }
    const filepath = `${this.file.path.substring(
      0,
      this.file.path.lastIndexOf(".md"),
    )}.excalidraw`;
    const file = this.app.vault.getAbstractFileByPath(normalizePath(filepath));
    if (file && file instanceof TFile) {
      this.app.vault.modify(file, JSON.stringify(scene, null, "\t"));
    } else {
      this.app.vault.create(filepath, JSON.stringify(scene, null, "\t"));
    }
  }

  public async exportExcalidraw() {
    if (!this.getScene || !this.file) {
      return;
    }
    //@ts-ignore
    if (this.app.isMobile) {
      const prompt = new Prompt(
        this.app,
        "Please provide filename",
        this.file.basename,
        "filename, leave blank to cancel action",
      );
      prompt.openAndGetValue(async (filename: string) => {
        if (!filename) {
          return;
        }
        filename = `${filename}.excalidraw`;
        const folderpath = splitFolderAndFilename(this.file.path).folderpath;
        await checkAndCreateFolder(this.app.vault, folderpath); //create folder if it does not exist
        const fname = getNewUniqueFilepath(
          this.app.vault,
          filename,
          folderpath,
        );
        this.app.vault.create(
          fname,
          JSON.stringify(this.getScene(), null, "\t"),
        );
        new Notice(`Exported to ${fname}`, 6000);
      });
      return;
    }
    download(
      "data:text/plain;charset=utf-8",
      encodeURIComponent(JSON.stringify(this.getScene(), null, "\t")),
      `${this.file.basename}.excalidraw`,
    );
  }

  public async svg(scene: any): Promise<SVGSVGElement> {
    const exportSettings: ExportSettings = {
      withBackground: getWithBackground(this.plugin, this.file),
      withTheme: true,
    };
    return await getSVG(
      {
        ...scene,
        ...{
          appState: {
            ...scene.appState,
            theme: getExportTheme(this.plugin, this.file, scene.appState.theme),
          },
        },
      },
      exportSettings,
      getSVGPadding(this.plugin, this.file),
    );
  }

  public async saveSVG(scene?: any) {
    if (!scene) {
      if (!this.getScene) {
        return false;
      }
      scene = this.getScene();
    }
    const filepath = getIMGFilename(this.file.path, "svg"); //.substring(0,this.file.path.lastIndexOf(this.compatibilityMode ? '.excalidraw':'.md')) + '.svg';
    const file = this.app.vault.getAbstractFileByPath(normalizePath(filepath));

    const svg = await this.svg(scene);
    if (!svg) {
      return;
    }
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(
      embedFontsInSVG(svg, this.plugin),
    );
    if (file && file instanceof TFile) {
      await this.app.vault.modify(file, svgString);
    } else {
      await this.app.vault.create(filepath, svgString);
    }
  }

  public async png(scene: any): Promise<Blob> {
    const exportSettings: ExportSettings = {
      withBackground: getWithBackground(this.plugin, this.file),
      withTheme: true,
    };
    return await getPNG(
      {
        ...scene,
        ...{
          appState: {
            ...scene.appState,
            theme: getExportTheme(this.plugin, this.file, scene.appState.theme),
          },
        },
      },
      exportSettings,
      getPNGScale(this.plugin, this.file),
    );
  }

  public async savePNG(scene?: any) {
    if (!scene) {
      if (!this.getScene) {
        return false;
      }
      scene = this.getScene();
    }

    const filepath = getIMGFilename(this.file.path, "png"); //this.file.path.substring(0,this.file.path.lastIndexOf(this.compatibilityMode ? '.excalidraw':'.md')) + '.png';
    const file = this.app.vault.getAbstractFileByPath(normalizePath(filepath));

    const png = await this.png(scene);
    if (!png) {
      return;
    }
    if (file && file instanceof TFile) {
      await this.app.vault.modifyBinary(file, await png.arrayBuffer());
    } else {
      await this.app.vault.createBinary(filepath, await png.arrayBuffer());
    }
  }

  private preventReloadResetTimer: NodeJS.Timeout = null;
  async save(preventReload: boolean = true, forcesave: boolean = false) {
    //debug({where:"save", preventReload, forcesave, semaphores:this.semaphores});
    if (this.semaphores.saving) {
      return;
    }
    this.semaphores.saving = true;

    if (
      !this.getScene ||
      !this.excalidrawAPI ||
      !this.isLoaded ||
      !this.file ||
      !this.app.vault.getAbstractFileByPath(this.file.path) //file was recently deleted
    ) {
      this.semaphores.saving = false;
      return;
    }

    try {
      const allowSave = Boolean (
        (this.semaphores.dirty !== null && this.semaphores.dirty) ||
        this.semaphores.autosaving ||
        forcesave
      ); //dirty == false when view.file == null;
      const scene = this.getScene();

      if (this.compatibilityMode) {
        await this.excalidrawData.syncElements(scene);
      } else if (
        await this.excalidrawData.syncElements(scene, this.excalidrawAPI.getAppState().selectedElementIds)
        //&& !this.semaphores.autosaving
      ) {
        await this.loadDrawing(
          false,
          this.excalidrawAPI.getSceneElementsIncludingDeleted().filter((el:ExcalidrawElement)=>el.isDeleted)
        );
      }

      if (allowSave) {
        //reload() is triggered indirectly when saving by the modifyEventHandler in main.ts
        //prevent reload is set here to override reload when not wanted: typically when the user is editing
        //and we do not want to interrupt the flow by reloading the drawing into the canvas.
        if(this.preventReloadResetTimer) {
          clearTimeout(this.preventReloadResetTimer);
          this.preventReloadResetTimer = null;
        }

        this.semaphores.preventReload = preventReload;
        await super.save();
        this.lastSaveTimestamp = this.file.stat.mtime;
        this.clearDirty();
        
        //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/629
        //there were odd cases when preventReload semaphore did not get cleared and consequently a synchronized image
        //did not update the open drawing
        if(preventReload) {
          const self = this;
          this.preventReloadResetTimer = setTimeout(()=>self.semaphores.preventReload = false,2000);
        }
      }

      if (!this.semaphores.autosaving && !this.semaphores.viewunload) {
        if (this.plugin.settings.autoexportSVG) {
          await this.saveSVG();
        }
        if (this.plugin.settings.autoexportPNG) {
          await this.savePNG();
        }
        if (
          !this.compatibilityMode &&
          this.plugin.settings.autoexportExcalidraw
        ) {
          this.saveExcalidraw();
        }
      }
    } catch (e) {
      errorlog({
        where: "ExcalidrawView.save",
        fn: this.save,
        error: e,
      });
      warningUnknowSeriousError();
    }
    this.semaphores.saving = false;
  }

  // get the new file content
  // if drawing is in Text Element Edit Lock, then everything should be parsed and in sync
  // if drawing is in Text Element Edit Unlock, then everything is raw and parse and so an async function is not required here
  getViewData() {
    //debug({where:"getViewData",semaphores:this.semaphores});
    if (!this.getScene) {
      return this.data;
    }
    if (!this.excalidrawData.loaded) {
      return this.data;
    }
    //include deleted elements in save in case saving in markdown mode
    //deleted elements are only used if sync modifies files while Excalidraw is open
    //otherwise deleted elements are discarded when loading the scene
    const scene = this.getScene();
    if (!this.compatibilityMode) {
      let trimLocation = this.data.search(/(^%%\n)?# Text Elements\n/m);
      if (trimLocation == -1) {
        trimLocation = this.data.search(/(%%\n)?# Drawing\n/);
      }
      if (trimLocation == -1) {
        return this.data;
      }

      let header = this.data
        .substring(0, trimLocation)
        .replace(
          /excalidraw-plugin:\s.*\n/,
          `${FRONTMATTER_KEY}: ${
            this.textMode === TextMode.raw ? "raw\n" : "parsed\n"
          }`,
        );

      //this should be removed at a later time. Left it here to remediate 1.4.9 mistake
      const REG_IMG = /(^---[\w\W]*?---\n)(!\[\[.*?]]\n(%%\n)?)/m; //(%%\n)? because of 1.4.8-beta... to be backward compatible with anyone who installed that version
      if (header.match(REG_IMG)) {
        header = header.replace(REG_IMG, "$1");
      }
      //end of remove
      if (!this.excalidrawData.disableCompression) {
        this.excalidrawData.disableCompression =
          this.isEditedAsMarkdownInOtherView();
      }
      const reuslt = header + this.excalidrawData.generateMD(
        this.excalidrawAPI.getSceneElementsIncludingDeleted().filter((el:ExcalidrawElement)=>el.isDeleted) //will be concatenated to scene.elements
      );
      this.excalidrawData.disableCompression = false;
      return reuslt;
    }
    if (this.compatibilityMode) {
      return JSON.stringify(scene, null, "\t");
    }
    return this.data;
  }

  addFullscreenchangeEvent() {
    //excalidrawWrapperRef.current
    this.contentEl.onfullscreenchange = () => {
      if (this.plugin.settings.zoomToFitOnResize) {
        this.zoomToFit();
      }
      if (!this.isFullscreen()) {
        this.clearFullscreenObserver();
        this.contentEl.removeAttribute("style");
      }
      if (this.toolsPanelRef && this.toolsPanelRef.current) {
        this.toolsPanelRef.current.setFullscreen(this.isFullscreen());
      }
    };
  }

  fullscreenModalObserver: MutationObserver = null;
  gotoFullscreen() {
    if (!this.excalidrawWrapperRef) {
      return;
    }
    if (this.toolsPanelRef && this.toolsPanelRef.current) {
      this.toolsPanelRef.current.setFullscreen(true);
    }
    if (this.app.isMobile) {
      const newStylesheet = document.createElement("style");
      newStylesheet.id = "excalidraw-full-screen";
      newStylesheet.textContent = `
        .workspace-leaf-content .view-content {
          padding: 0px !important;
        }
        .view-header {
          height: 1px !important;
        }
        .status-bar {
          display: none !important;
        }`;

      const oldStylesheet = document.getElementById(newStylesheet.id);
      if (oldStylesheet) {
        document.head.removeChild(oldStylesheet);
      }
      document.head.appendChild(newStylesheet);
      return;
    }
    this.contentEl.requestFullscreen(); //{navigationUI: "hide"});
    this.excalidrawWrapperRef.current.firstElementChild?.focus();
    this.contentEl.setAttribute("style", "padding:0px;margin:0px;");

    this.fullscreenModalObserver = new MutationObserver((m) => {
      if (m.length !== 1) {
        return;
      }
      if (!m[0].addedNodes || m[0].addedNodes.length !== 1) {
        return;
      }
      const node: Node = m[0].addedNodes[0];
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }
      const element = node as HTMLElement;
      if (!element.classList.contains("modal-container")) {
        return;
      }
      this.contentEl.appendChild(element);
      element.querySelector("input").focus();
    });

    this.fullscreenModalObserver.observe(this.ownerDocument.body, {
      childList: true,
      subtree: false,
    });
  }

  clearFullscreenObserver() {
    if (this.fullscreenModalObserver) {
      this.fullscreenModalObserver.disconnect();
      this.fullscreenModalObserver = null;
    }
  }

  isFullscreen(): boolean {
    return (
      this.ownerDocument.fullscreenEnabled &&
      this.ownerDocument.fullscreenElement === this.contentEl // excalidrawWrapperRef?.current
    ); //this.contentEl;
  }

  exitFullscreen() {
    if (this.toolsPanelRef && this.toolsPanelRef.current) {
      this.toolsPanelRef.current.setFullscreen(false);
    }
    if (this.app.isMobile) {
      const oldStylesheet = document.getElementById("excalidraw-full-screen");
      if (oldStylesheet) {
        document.head.removeChild(oldStylesheet);
      }
      return;
    }
    this.ownerDocument.exitFullscreen();
  }

  async handleLinkClick(view: ExcalidrawView, ev: MouseEvent) {
    const tooltip = this.ownerDocument.body.querySelector(
      "body>div.excalidraw-tooltip,div.excalidraw-tooltip--visible",
    );
    if (tooltip) {
      this.ownerDocument.body.removeChild(tooltip);
    }

    const selectedText = this.getSelectedTextElement();
    const selectedImage = selectedText?.id
      ? null
      : this.getSelectedImageElement();
    const selectedElementWithLink =
      selectedImage?.id || selectedText?.id
        ? null
        : this.getSelectedElementWithLink();

    let file = null;
    //let lineNum = 0;
    let subpath: string = null;
    let linkText: string = null;

    if (selectedText?.id || selectedElementWithLink?.id) {
      linkText =
        selectedElementWithLink?.text ??
        (this.textMode === TextMode.parsed
          ? this.excalidrawData.getRawText(selectedText.id)
          : selectedText.text);

      if (!linkText) {
        return;
      }
      linkText = linkText.replaceAll("\n", ""); //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/187

      if(this.getHookServer().onLinkClickHook) {
        const id = selectedText.id??selectedElementWithLink.id;
        const el = this.excalidrawAPI.getSceneElements().filter((el:ExcalidrawElement)=>el.id === id)[0];
        try {
          if(!this.getHookServer().onLinkClickHook(
            el,
            linkText,
            ev,
            this,
            this.getHookServer()
          )) {
            return;
          }
        } catch (e) {
          errorlog({where: "ExcalidrawView.handleLinkClick selectedText.id!==null", fn: this.getHookServer().onLinkClickHook, error: e});
        }
      }

      if (linkText.match(REG_LINKINDEX_HYPERLINK)) {
        window.open(linkText, "_blank");
        return;
      }

      const parts = REGEX_LINK.getRes(linkText).next();
      if (!parts.value) {
        const tags = linkText
          .matchAll(/#([\p{Letter}\p{Emoji_Presentation}\p{Number}\/_-]+)/gu)
          .next();
        if (!tags.value || tags.value.length < 2) {
          return;
        }
        const search = this.app.workspace.getLeavesOfType("search");
        if (search.length == 0) {
          return;
        }
        //@ts-ignore
        search[0].view.setQuery(`tag:${tags.value[1]}`);
        this.app.workspace.revealLeaf(search[0]);

        if (this.isFullscreen()) {
          this.exitFullscreen();
        }
        return;
      }

      linkText = REGEX_LINK.getLink(parts);

      if (linkText.match(REG_LINKINDEX_HYPERLINK)) {
        window.open(linkText, "_blank");
        return;
      }

      if (linkText.search("#") > -1) {
        const linkParts = getLinkParts(linkText, this.file);
        subpath = `#${linkParts.isBlockRef ? "^" : ""}${linkParts.ref}`;
        linkText = linkParts.path;
        //lineNum = (await this.excalidrawData.getTransclusion(linkText)).lineNum;
        //linkText = linkText.substring(0, linkText.search("#"));
      }
      if (linkText.match(REG_LINKINDEX_INVALIDCHARS)) {
        new Notice(t("FILENAME_INVALID_CHARS"), 4000);
        return;
      }
      file = view.app.metadataCache.getFirstLinkpathDest(
        linkText,
        view.file.path,
      );
    }
    if (selectedImage?.id) {
      if (this.excalidrawData.hasEquation(selectedImage.fileId)) {
        const equation = this.excalidrawData.getEquation(
          selectedImage.fileId,
        ).latex;
        const prompt = new Prompt(this.app, t("ENTER_LATEX"), equation, "");
        prompt.openAndGetValue(async (formula: string) => {
          if (!formula || formula === equation) {
            return;
          }
          this.excalidrawData.setEquation(selectedImage.fileId, {
            latex: formula,
            isLoaded: false,
          });
          await this.save(false);
          await updateEquation(
            formula,
            selectedImage.fileId,
            this,
            addFiles,
            this.plugin,
          );
          this.setDirty(1);
        });
        return;
      }
      await this.save(false); //in case pasted images haven't been saved yet
      if (this.excalidrawData.hasFile(selectedImage.fileId)) {
        if (ev.altKey) {
          const ef = this.excalidrawData.getFile(selectedImage.fileId);
          if (
            ef.file.extension === "md" &&
            !this.plugin.isExcalidrawFile(ef.file)
          ) {
            const prompt = new Prompt(
              this.app,
              "Customize the link",
              ef.linkParts.original,
              "",
              "Do not add [[square brackets]] around the filename!<br>Follow this format when editing your link:<br><mark>filename#^blockref|WIDTHxMAXHEIGHT</mark>",
            );
            prompt.openAndGetValue(async (link: string) => {
              if (!link || ef.linkParts.original === link) {
                return;
              }
              ef.resetImage(this.file.path, link);
              await this.save(false);
              await this.loadSceneFiles();
              this.setDirty(2);
            });
            return;
          }
        }
        linkText = this.excalidrawData.getFile(selectedImage.fileId).file.path;
        file = this.excalidrawData.getFile(selectedImage.fileId).file;
      }
    }

    if (!linkText) {
      new Notice(t("LINK_BUTTON_CLICK_NO_TEXT"), 20000);
      return;
    }

    if(this.getHookServer().onLinkClickHook) {
      const id = selectedImage.id??selectedText.id??selectedElementWithLink.id;
      const el = this.excalidrawAPI.getSceneElements().filter((el:ExcalidrawElement)=>el.id === id)[0];
      try {
        if(!this.getHookServer().onLinkClickHook(
          el,
          linkText,
          ev,
          this,
          this.getHookServer()
        )) {
          return;
        }
      } catch (e) {
        errorlog({where: "ExcalidrawView.handleLinkClick selectedText.id===null", fn: this.getHookServer().onLinkClickHook, error: e});
      }
    }

    try {
      if (ev.shiftKey && this.isFullscreen()) {
        this.exitFullscreen();
      }
      if (!file) {
        new NewFileActions(this.plugin, linkText, ev.shiftKey, !app.isMobile && ev.metaKey, view).open();
        return;
      }
      const leaf =
        (!app.isMobile && ((ev.metaKey && this.linksAlwaysOpenInANewPane) || ev.metaKey))
        //@ts-ignore
        ? app.workspace.openPopoutLeaf()
        : (ev.shiftKey || this.linksAlwaysOpenInANewPane)
          ? getNewOrAdjacentLeaf(this.plugin, view.leaf)
          : view.leaf;
      await leaf.openFile(file, subpath ? { active: false, eState: { subpath } } : undefined); //if file exists open file and jump to reference
      //view.app.workspace.setActiveLeaf(leaf, true, true); //0.15.4 ExcaliBrain focus issue
    } catch (e) {
      new Notice(e, 4000);
    }
  }

  onResize() {
    const api = this.excalidrawAPI;
    if (
      !this.plugin.settings.zoomToFitOnResize ||
      !this.excalidrawRef ||
      this.semaphores.isEditingText ||
      !api
    ) {
      return;
    }

    //final fallback to prevent resizing when text element is in edit mode
    //this is to prevent jumping text due to on-screen keyboard popup
    if (api.getAppState()?.editingElement?.type === "text") {
      return;
    }
    this.zoomToFit(false);
  }

  diskIcon: HTMLElement;

  excalidrawGetSceneVersion: (elements: ExcalidrawElement[]) => number;
  getSceneVersion (elements: ExcalidrawElement[]):number {
    if(!this.excalidrawGetSceneVersion) {
      this.excalidrawGetSceneVersion = this.plugin.getPackage(this.ownerWindow).excalidrawLib.getSceneVersion;
    }
    return this.excalidrawGetSceneVersion(elements.filter(el=>!el.isDeleted));
  }

  onload() {
    const apiMissing = Boolean(typeof this.containerEl.onWindowMigrated === "undefined")
    //@ts-ignore
    if(!app.isMobile && !apiMissing) this.containerEl.onWindowMigrated(()=>this.leaf.rebuildView());
    const doc = app.isMobile?document:this.containerEl.ownerDocument;
    this.ownerDocument = doc;
    this.ownerWindow = this.ownerDocument.defaultView;
    this.plugin.getPackage(this.ownerWindow);
    this.semaphores.scriptsReady = true;

    this.addAction(SCRIPTENGINE_ICON_NAME, t("INSTALL_SCRIPT_BUTTON"), () => {
      new ScriptInstallPrompt(this.plugin).open();
    });

    this.diskIcon = this.addAction(
      DISK_ICON_NAME,
      t("FORCE_SAVE"),
      async () => {
        if (this.semaphores.autosaving) {
          return;
        }
        this.semaphores.forceSaving = true;
        await this.save(false, true);
        this.plugin.triggerEmbedUpdates();
        this.loadSceneFiles();
        this.semaphores.forceSaving = false;
        new Notice("Save successful", 1000);
      },
    );

    this.textIsRaw_Element = this.addAction(
      TEXT_DISPLAY_RAW_ICON_NAME,
      t("RAW"),
      () => this.changeTextMode(TextMode.parsed),
    );
    this.textIsParsed_Element = this.addAction(
      TEXT_DISPLAY_PARSED_ICON_NAME,
      t("PARSED"),
      () => this.changeTextMode(TextMode.raw),
    );

    this.addAction("link", t("OPEN_LINK"), (ev) =>
      this.handleLinkClick(this, ev),
    );

    if (!this.app.isMobile) {
      this.addAction(
        FULLSCREEN_ICON_NAME,
        "Press ESC to exit fullscreen mode",
        () => this.gotoFullscreen(),
      );
    }

    const self = this;
    this.app.workspace.onLayoutReady(async () => {
      self.contentEl.addClass("excalidraw-view");
      //https://github.com/zsviczian/excalibrain/issues/28
      await self.addSlidingPanesListner(); //awaiting this because when using workspaces, onLayoutReady comes too early
      self.addParentMoveObserver();

      self.onKeyUp = (e: KeyboardEvent) => {
        self.ctrlKeyDown = e[CTRL_OR_CMD];
        self.shiftKeyDown = e.shiftKey;
        self.altKeyDown = e.altKey;
        self.metaKeyDown = e.metaKey;
      };

      self.onKeyDown = (e: KeyboardEvent) => {
        this.ctrlKeyDown = e[CTRL_OR_CMD];
        this.shiftKeyDown = e.shiftKey;
        this.altKeyDown = e.altKey;
        this.metaKeyDown = e.metaKey;
      };

      self.ownerWindow.addEventListener("keydown", self.onKeyDown, false);
      self.ownerWindow.addEventListener("keyup", self.onKeyUp, false);
    });

    this.setupAutosaveTimer();
  }

  //this is to solve sliding panes bug
  //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/9
  private slidingPanesListner: any;
  private async addSlidingPanesListner() {
    const self = this;
    this.slidingPanesListner = () => {
      if (self.refresh) {
        self.refresh();
      }
    };
    let rootSplit = this.app.workspace.rootSplit as WorkspaceItem as WorkspaceItemExt;
    while(!rootSplit) {
      await sleep(50);
      rootSplit = this.app.workspace.rootSplit as WorkspaceItem as WorkspaceItemExt;
    }
    rootSplit.containerEl.addEventListener("scroll", this.slidingPanesListner);
  }

  private removeSlidingPanesListner() {
    if (this.slidingPanesListner) {
      (
        this.app.workspace.rootSplit as WorkspaceItem as WorkspaceItemExt
      ).containerEl?.removeEventListener("scroll", this.slidingPanesListner);
    }
  }

  //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/572
  private offsetLeft: number = 0;
  private offsetTop: number = 0;
  private addParentMoveObserver() {
    
    const parent =
      getParentOfClass(this.containerEl, "popover") ??
      getParentOfClass(this.containerEl, "workspace-leaf");
    if (!parent) {
      return;
    }

    const inHoverEditorLeaf = parent.classList.contains("popover");

    this.offsetLeft = parent.offsetLeft;
    this.offsetTop = parent.offsetTop;
    const self = this;
    this.parentMoveObserver = new MutationObserver(
      async (m: MutationRecord[]) => {
        const target = m[0].target;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        const { offsetLeft, offsetTop } = target;
        if (offsetLeft !== self.offsetLeft || offsetTop != self.offsetTop) {
          if (self.refresh) {
            self.refresh();
          }
          self.offsetLeft = offsetLeft;
          self.offsetTop = offsetTop;
        }
      },
    );

    this.parentMoveObserver.observe(parent, {
      attributeOldValue: true,
      attributeFilter: inHoverEditorLeaf
        ? ["data-x", "data-y"]
        : ["class", "style"],
    });
  }

  private removeParentMoveObserver() {
    if (this.parentMoveObserver) {
      this.parentMoveObserver.disconnect();
    }
  }

  public setTheme(theme: string) {
    const api = this.excalidrawAPI;
    if (!this.excalidrawRef || !api) {
      return;
    }
    if (this.file) {
      //if there is an export theme set, override the theme change
      if (hasExportTheme(this.plugin, this.file)) {
        return;
      }
    }
    const st: AppState = api.getAppState();
    this.excalidrawData.scene.theme = theme;
    //debug({where:"ExcalidrawView.setTheme",file:this.file.name,dataTheme:this.excalidrawData.scene.appState.theme,before:"updateScene"});
    this.updateScene({
      appState: {
        ...st,
        theme,
      },
      commitToHistory: false,
    });
  }

  public async changeTextMode(textMode: TextMode, reload: boolean = true) {
    this.textMode = textMode;
    if (textMode === TextMode.parsed) {
      this.textIsRaw_Element.hide();
      this.textIsParsed_Element.show();
    } else {
      this.textIsRaw_Element.show();
      this.textIsParsed_Element.hide();
    }
    if (this.toolsPanelRef && this.toolsPanelRef.current) {
      this.toolsPanelRef.current.setPreviewMode(textMode === TextMode.parsed);
    }
    if (reload) {
      await this.save(false, true);
      this.updateContainerSize();
      const api = this.excalidrawAPI;
      if (!api) {
        return;
      }
      api.history.clear(); //to avoid undo replacing links with parsed text
    }
  }

  public setupAutosaveTimer() {
    const timer = async () => {
      const api = this.excalidrawAPI;
      if (!api) {
        warningUnknowSeriousError();
        return;
      }
      const st = api.getAppState();
      const editing = st.editingElement !== null;
      //this will reset positioning of the cursor in case due to the popup keyboard,
      //or the command palette, or some other unexpected reason the onResize would not fire...
      this.refresh();
      if (
        this.isLoaded &&
        this.semaphores.dirty &&
        this.semaphores.dirty == this.file?.path &&
        this.plugin.settings.autosave &&
        !this.semaphores.forceSaving &&
        !editing &&
        st.draggingElement === null //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/630
      ) {
        this.autosaveTimer = null;
        this.semaphores.autosaving = true;
        if (this.excalidrawRef) {
          await this.save();
        }
        this.semaphores.autosaving = false;
        this.autosaveTimer = setTimeout(
          timer,
          this.plugin.settings.autosaveInterval,
        );
      } else {
        this.autosaveTimer = setTimeout(
          timer,
          this.isLoaded &&
            this.plugin.activeExcalidrawView === this &&
            this.semaphores.dirty
            ? 1000 //try again in 1 second
            : this.plugin.settings.autosaveInterval,
        );
      }
    };
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    } // clear previous timer if one exists
    if (this.plugin.settings.autosave) {
      this.autosaveTimer = setTimeout(
        timer,
        this.plugin.settings.autosaveInterval,
      );
    }
  }

  //save current drawing when user closes workspace leaf
  onunload() {
    this.semaphores.viewunload = true;
    this.ownerWindow?.removeEventListener("keydown", this.onKeyDown, false);
    this.ownerWindow?.removeEventListener("keyup", this.onKeyUp, false);

    if(this.getHookServer().onViewUnloadHook) {
      try {
        this.getHookServer().onViewUnloadHook(this);
      } catch(e) {
        errorlog({where: "ExcalidrawView.onunload", fn: this.getHookServer().onViewUnloadHook, error: e});
      }
    }
    const tooltip = this.containerEl?.ownerDocument?.body.querySelector(
      "body>div.excalidraw-tooltip,div.excalidraw-tooltip--visible",
    );
    if (tooltip) {
      this.containerEl?.ownerDocument?.body.removeChild(tooltip);
    }
    this.removeParentMoveObserver();
    this.removeSlidingPanesListner();
    if (this.autosaveTimer) {
      clearInterval(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    if (this.fullscreenModalObserver) {
      this.fullscreenModalObserver.disconnect();
      this.fullscreenModalObserver = null;
    }
  }

  /**
   * reload is triggered by the modifyEventHandler in main.ts when ever an excalidraw drawing that is currently open
   * in a workspace leaf is modified. There can be two reasons for the file change:
   * - The user saves the drawing in the active view (either force-save or autosave)
   * - The file is modified by some other process, typically as a result of background sync, or because the drawing is open
   *   side by side, e.g. the canvas in one view and markdown view in the other.
   * @param fullreload
   * @param file
   * @returns
   */
  public async reload(fullreload: boolean = false, file?: TFile) {
    if (this.semaphores.preventReload) {
      this.semaphores.preventReload = false;
      return;
    }
    if (this.semaphores.saving) return;
    this.diskIcon.querySelector("svg").removeClass("excalidraw-dirty");
    if (this.compatibilityMode) {
      this.clearDirty();
      return;
    }
    const api = this.excalidrawAPI;
    if (!this.excalidrawRef || !this.file || !api) {
      return;
    }
    const loadOnModifyTrigger = file && file === this.file;
    if (loadOnModifyTrigger) {
      this.data = await this.app.vault.read(file);
      this.preventAutozoom();
    }
    if (fullreload) {
      await this.excalidrawData.loadData(this.data, this.file, this.textMode);
    } else {
      await this.excalidrawData.setTextMode(this.textMode);
    }
    this.excalidrawData.scene.appState.theme = api.getAppState().theme;
    await this.loadDrawing(loadOnModifyTrigger);
    this.clearDirty();
  }

  zoomToElementId(id: string) {
    const api = this.excalidrawAPI;
    if (!api) {
      return;
    }
    const elements = api
      .getSceneElements()
      .filter((el: ExcalidrawElement) => el.id === id);
    if (elements.length === 0) {
      return;
    }
    if (!api.getAppState().viewModeEnabled) {
      api.selectElements(elements);
    }
    api.zoomToFit(elements, this.plugin.settings.zoomToFitMaxLevel, 0.05);
  }

  setEphemeralState(state: any): void {
    if (!state) {
      return;
    }
    const self = this;
    let query: string[] = null;

    if (
      state.match &&
      state.match.content &&
      state.match.matches &&
      state.match.matches.length === 1 &&
      state.match.matches[0].length === 2
    ) {
      query = [
        state.match.content.substring(
          state.match.matches[0][0],
          state.match.matches[0][1],
        ),
      ];
    }

    if (state.subpath && state.subpath.length > 2) {
      if (state.subpath[1] === "^") {
        const id = state.subpath.substring(2);
        setTimeout(() => self.zoomToElementId(id), 300);
      } else {
        query = [`# ${state.subpath.substring(1)}`];
      }
    }

    if (state.line && state.line > 0) {
      query = [this.data.split("\n")[state.line - 1]];
    }

    if (query) {
      setTimeout(() => {
        const api = self.excalidrawAPI;
        if (!api) {
          return;
        }
        const elements = api
          .getSceneElements()
          .filter((el: ExcalidrawElement) => el.type === "text");
        self.selectElementsMatchingQuery(
          elements,
          query,
          !api.getAppState().viewModeEnabled,
          true,
        );
      }, 300);
    }

    super.setEphemeralState(state);
  }

  // clear the view content
  clear() {
    const api = this.excalidrawAPI;
    if (!this.excalidrawRef || !api) {
      return;
    }
    if (this.activeLoader) {
      this.activeLoader.terminate = true;
      this.activeLoader = null;
    }
    this.nextLoader = null;
    api.resetScene();
    api.history.clear();
    this.previousSceneVersion = 0;
  }

  private isLoaded: boolean = false;
  async setViewData(data: string, clear: boolean = false) {
    checkExcalidrawVersion(this.app);
    this.isLoaded = false;
    if (clear) {
      this.clear();
    }
    this.lastSaveTimestamp = this.file.stat.mtime;
    data = this.data = data.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
    this.app.workspace.onLayoutReady(async () => {
      this.compatibilityMode = this.file.extension === "excalidraw";
      await this.plugin.loadSettings();
      if (this.compatibilityMode) {
        this.textIsRaw_Element.hide();
        this.textIsParsed_Element.hide();
        await this.excalidrawData.loadLegacyData(data, this.file);
        if (!this.plugin.settings.compatibilityMode) {
          new Notice(t("COMPATIBILITY_MODE"), 4000);
        }
        this.excalidrawData.disableCompression = true;
      } else {
        this.excalidrawData.disableCompression = false;
        const textMode = getTextMode(data);
        this.changeTextMode(textMode, false);
        try {
          if (
            !(await this.excalidrawData.loadData(
              data,
              this.file,
              this.textMode,
            ))
          ) {
            return;
          }
        } catch (e) {
          errorlog({ where: "ExcalidrawView.setViewData", error: e });
          new Notice(
            `Error loading drawing:\n${e.message}${
              e.message === "Cannot read property 'index' of undefined"
                ? "\n'# Drawing' section is likely missing"
                : ""
            }\n\nTry manually fixing the file or restoring an earlier version from sync history.`,
            10000,
          );
          this.setMarkdownView();
          return;
        }
      }
      await this.loadDrawing(true);
      const script = this.excalidrawData.getOnLoadScript();
      if(script) {
        const self = this;
        const scriptname = this.file.basename+ "-onlaod-script";
        const runScript = () => {
          if(!self.excalidrawAPI) { //need to wait for Excalidraw to initialize
            setTimeout(runScript,200);
            return;
          }
          self.plugin.scriptEngine.executeScript(self,script,scriptname);
        }
        runScript();
      }
      this.isLoaded = true;
    });
  }

  public activeLoader: EmbeddedFilesLoader = null;
  private nextLoader: EmbeddedFilesLoader = null;
  public async loadSceneFiles() {
    if (!this.excalidrawAPI) {
      return;
    }
    const loader = new EmbeddedFilesLoader(this.plugin);

    const runLoader = (l: EmbeddedFilesLoader) => {
      this.nextLoader = null;
      this.activeLoader = l;
      l.loadSceneFiles(
        this.excalidrawData,
        (files: FileData[], isDark: boolean) => {
          if (!files) {
            return;
          }
          addFiles(files, this, isDark);
          this.activeLoader = null;
          if (this.nextLoader) {
            runLoader(this.nextLoader);
          } else {
            //in case one or more files have not loaded retry later hoping that sync has delivered the file in the mean time.
            this.excalidrawData.getFiles().some(ef=>{
              if(ef && !ef.file && ef.attemptCounter<30) {
                const self = this;
                const currentFile = this.file.path;
                setTimeout(async ()=>{
                  if(self && self.excalidrawAPI && currentFile === self.file.path) {
                    self.loadSceneFiles();
                  }
                },2000)
                return true;
              }
              return false;
            })
          }
        },0
      );
    };
    if (!this.activeLoader) {
      runLoader(loader);
    } else {
      this.nextLoader = loader;
    }
  }

  public async synchronizeWithData(inData: ExcalidrawData) {
    //check if saving, wait until not
    let counter = 0;
    while(this.semaphores.saving && counter++<30) {
      await sleep(100);
    }
    if(counter>=30) {
      errorlog({
        where:"ExcalidrawView.synchronizeWithData",
        message:`Aborting sync with received file (${this.file.path}) because semaphores.saving remained true for ower 3 seconds`, 
        "fn": this.synchronizeWithData
      });
      return;
    }
    this.semaphores.saving = true;
    let reloadFiles = false;

    try {
      const deletedIds = inData.deletedElements.map(el=>el.id);
      const sceneElements = this.excalidrawAPI.getSceneElements()
        //remove deleted elements
        .filter((el: ExcalidrawElement)=>!deletedIds.contains(el.id));
      const sceneElementIds = sceneElements.map((el:ExcalidrawElement)=>el.id);

      const manageMapChanges = (incomingElement: ExcalidrawElement ) => {
        switch(incomingElement.type) {
          case "text":
            this.excalidrawData.textElements.set(
              incomingElement.id,
              inData.textElements.get(incomingElement.id)
            );
            break;
          case "image":
            if(inData.getFile(incomingElement.fileId)) {
              this.excalidrawData.setFile(
                incomingElement.fileId,
                inData.getFile(incomingElement.fileId)
              );
              reloadFiles = true;
            } else if (inData.getEquation(incomingElement.fileId)) {
              this.excalidrawData.setEquation(
                incomingElement.fileId,
                inData.getEquation(incomingElement.fileId)
              )
              reloadFiles = true;
            }
          break;
        }

        if(inData.elementLinks.has(incomingElement.id)) {
          this.excalidrawData.elementLinks.set(
            incomingElement.id,
            inData.elementLinks.get(incomingElement.id)
          )
        }

      }

      //update items with higher version number then in scene
      inData.scene.elements.forEach((
        incomingElement:ExcalidrawElement,
        idx: number,
        inElements: ExcalidrawElement[]
      )=>{
        const sceneElement:ExcalidrawElement = sceneElements.filter(
          (element:ExcalidrawElement)=>element.id === incomingElement.id
        )[0];
        if(
          sceneElement && 
          (sceneElement.version < incomingElement.version || 
            //in case of competing versions of the truth, the incoming version will be honored
            (sceneElement.version === incomingElement.version &&
             JSON.stringify(sceneElement) !== JSON.stringify(incomingElement))
          )
        ) {
          manageMapChanges(incomingElement);
          //place into correct element layer sequence
          const currentLayer = sceneElementIds.indexOf(incomingElement.id);
          //remove current element from scene
          const elToMove = sceneElements.splice(currentLayer,1);
          if(idx === 0) {
            sceneElements.splice(0,0,incomingElement);
            if(currentLayer!== 0) {
              sceneElementIds.splice(currentLayer,1);
              sceneElementIds.splice(0,0,incomingElement.id);
            } 
          } else {
            const prevId = inElements[idx-1].id;
            const parentLayer = sceneElementIds.indexOf(prevId);
            sceneElements.splice(parentLayer+1,0,incomingElement);
            if(parentLayer!==currentLayer-1) {
              sceneElementIds.splice(currentLayer,1)
              sceneElementIds.splice(parentLayer+1,0,incomingElement.id);
            }
          }
          return;
        } else if(!sceneElement) {
          manageMapChanges(incomingElement);

          if(idx === 0) {
            sceneElements.splice(0,0,incomingElement);
            sceneElementIds.splice(0,0,incomingElement.id);
          } else {
            const prevId = inElements[idx-1].id;
            const parentLayer = sceneElementIds.indexOf(prevId);
            sceneElements.splice(parentLayer+1,0,incomingElement);
            sceneElementIds.splice(parentLayer+1,0,incomingElement.id);
          }
        } else if(sceneElement && incomingElement.type === "image") { //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/632
          if(inData.getFile(incomingElement.fileId)) {
            this.excalidrawData.setFile(
              incomingElement.fileId,
              inData.getFile(incomingElement.fileId)
            );
            reloadFiles = true;
          }
        }
      })
      this.previousSceneVersion = this.getSceneVersion(sceneElements);
      //changing files could result in a race condition for sync. If at the end of sync there are differences
      //set dirty will trigger an autosave
      if(this.getSceneVersion(inData.scene.elements) !== this.previousSceneVersion) {
        this.setDirty(3);
      }
      this.excalidrawAPI.updateScene({elements: sceneElements});
      if(reloadFiles) this.loadSceneFiles();
    } catch(e) {
      errorlog({
        where:"ExcalidrawView.synchronizeWithData",
        message:`Error during sync with received file (${this.file.path})`, 
        "fn": this.synchronizeWithData,
        error: e
      });
    }
    this.semaphores.saving = false;
  }

  initialContainerSizeUpdate = false;
  /**
   *
   * @param justloaded - a flag to trigger zoom to fit after the drawing has been loaded
   */
  private async loadDrawing(justloaded: boolean, deletedElements?: ExcalidrawElement[]) {
    const excalidrawData = this.excalidrawData.scene;
    this.semaphores.justLoaded = justloaded;
    this.initialContainerSizeUpdate = justloaded;
    this.clearDirty();
    const om = this.excalidrawData.getOpenMode();
    this.semaphores.preventReload = false;
    const penEnabled =
      this.plugin.settings.defaultPenMode === "always" ||
      (this.plugin.settings.defaultPenMode === "mobile" && this.app.isMobile);
    const api = this.excalidrawAPI;
    if (api) {
      //isLoaded flags that a new file is being loaded, isLoaded will be true after loadDrawing completes
      const viewModeEnabled = !this.isLoaded
        ? om.viewModeEnabled
        : api.getAppState().viewModeEnabled;
      const zenModeEnabled = !this.isLoaded
        ? om.zenModeEnabled
        : api.getAppState().zenModeEnabled;
      //debug({where:"ExcalidrawView.loadDrawing",file:this.file.name,dataTheme:excalidrawData.appState.theme,before:"updateScene"})
      api.setLocalFont(this.plugin.settings.experimentalEnableFourthFont);

      this.updateScene(
        {
          elements: excalidrawData.elements.concat(deletedElements??[]), //need to preserve deleted elements during autosave if images, links, etc. are updated
          appState: {
            ...excalidrawData.appState,
            ...this.excalidrawData.selectedElementIds !== {} //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/609
              ? this.excalidrawData.selectedElementIds
              : {},
            zenModeEnabled,
            viewModeEnabled,
            linkOpacity: this.excalidrawData.getLinkOpacity(),
            trayModeEnabled: this.plugin.settings.defaultTrayMode,
            penMode: penEnabled,
            penDetected: penEnabled,
          },
          files: excalidrawData.files,
          commitToHistory: true,
        },
        justloaded,
      );
      if (
        this.app.workspace.getActiveViewOfType(ExcalidrawView) === this.leaf.view &&
        this.excalidrawWrapperRef
      ) {
        //.firstElmentChild solves this issue: https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/346
        this.excalidrawWrapperRef.current?.firstElementChild?.focus();
      }
      //debug({where:"ExcalidrawView.loadDrawing",file:this.file.name,before:"this.loadSceneFiles"});
      this.loadSceneFiles();
      this.updateContainerSize(null, true);
      this.initializeToolsIconPanelAfterLoading();
    } else {
      this.instantiateExcalidraw({
        elements: excalidrawData.elements,
        appState: {
          ...excalidrawData.appState,
          zenModeEnabled: om.zenModeEnabled,
          viewModeEnabled: om.viewModeEnabled,
          linkOpacity: this.excalidrawData.getLinkOpacity(),
          trayModeEnabled: this.plugin.settings.defaultTrayMode,
          penMode: penEnabled,
          penDetected: penEnabled,
        },
        files: excalidrawData.files,
        libraryItems: await this.getLibrary(),
      });
      //files are loaded on excalidrawRef readyPromise
    }
    const isCompressed = this.data.match(/```compressed\-json\n/gm) !== null;

    if (
      !this.compatibilityMode &&
      this.plugin.settings.compress !== isCompressed &&
      !this.isEditedAsMarkdownInOtherView()
    ) {
      this.setDirty(4);
    }
  }

  isEditedAsMarkdownInOtherView(): boolean {
    //if the user is editing the same file in markdown mode, do not compress it
    const leaves = this.app.workspace.getLeavesOfType("markdown");
    return (
      leaves.filter((leaf) => (leaf.view as MarkdownView).file === this.file)
        .length > 0
    );
  }

  public setDirty(debug?:number) {
    //console.log(debug);
    this.semaphores.dirty = this.file?.path;
    this.diskIcon.querySelector("svg").addClass("excalidraw-dirty");
  }

  public clearDirty() {
    const api = this.excalidrawAPI;
    if (!api) {
      return;
    }
    this.semaphores.dirty = null;
    const el = api.getSceneElements();
    if (el) {
      this.previousSceneVersion = this.getSceneVersion(el);
    }
    this.diskIcon.querySelector("svg").removeClass("excalidraw-dirty");
  }

  public initializeToolsIconPanelAfterLoading() {
    const api = this.excalidrawAPI;
    if (!api) {
      return;
    }
    const st = api.getAppState();
    const panel = this.toolsPanelRef?.current;
    if (!panel) {
      return;
    }
    panel.setTheme(st.theme);
    panel.setExcalidrawViewMode(st.viewModeEnabled);
    panel.setPreviewMode(
      this.compatibilityMode ? null : this.textMode === TextMode.parsed,
    );
    panel.updateScriptIconMap(this.plugin.scriptEngine.scriptIconMap);
  }

  //Compatibility mode with .excalidraw files
  canAcceptExtension(extension: string) {
    return extension === "excalidraw"; //["excalidraw","md"].includes(extension);
  }

  // gets the title of the document
  getDisplayText() {
    if (this.file) {
      return this.file.basename;
    }
    return t("NOFILE");
  }

  // the view type name
  getViewType() {
    return VIEW_TYPE_EXCALIDRAW;
  }

  // icon for the view
  getIcon() {
    return ICON_NAME;
  }

  setMarkdownView() {
    this.plugin.excalidrawFileModes[this.id || this.file.path] = "markdown";
    this.plugin.setMarkdownView(this.leaf);
  }

  public async openAsMarkdown() {
    if (this.plugin.settings.compress === true) {
      this.excalidrawData.disableCompression = true;
      await this.save(true, true);
    }
    this.setMarkdownView();
  }

  public async convertExcalidrawToMD() {
    await this.save();
    this.plugin.openDrawing(
      await this.plugin.convertSingleExcalidrawToMD(this.file),
      "active-pane",
    );
  }

  onPaneMenu(menu: Menu, source: string): void {
    // Add a menu item to force the board to markdown view
    if (!this.compatibilityMode) {
      menu
        .addItem((item) => {
          item
            .setTitle(t("OPEN_AS_MD"))
            .setIcon("document")
            .onClick(() => {
              this.openAsMarkdown();
            })
            .setSection("pane");
        })
        .addItem((item) => {
          item
            .setTitle(t("EXPORT_EXCALIDRAW"))
            .setIcon(ICON_NAME)
            .onClick(async () => {
              this.exportExcalidraw();
            })
            .setSection("pane");
        });
    } else {
      menu.addItem((item) => {
        item
          .setTitle(t("CONVERT_FILE"))
          .onClick(() => this.convertExcalidrawToMD())
          .setSection("pane");
      });
    }
    menu
      .addItem((item) => {
        item
          .setTitle(t("SAVE_AS_PNG"))
          .setIcon(PNG_ICON_NAME)
          .setSection("pane")
          .onClick(async (ev) => {
            if (!this.getScene || !this.file) {
              return;
            }
            if (ev[CTRL_OR_CMD]) {
              const png = await this.png(this.getScene());
              if (!png) {
                return;
              }
              const reader = new FileReader();
              reader.readAsDataURL(png);
              const self = this;
              reader.onloadend = function () {
                const base64data = reader.result;
                download(null, base64data, `${self.file.basename}.png`);
              };
              return;
            }
            this.savePNG();
          })
          .setSection("pane");
      })
      .addItem((item) => {
        item
          .setTitle(t("SAVE_AS_SVG"))
          .setIcon(SVG_ICON_NAME)
          .setSection("pane")
          .onClick(async (ev) => {
            if (!this.getScene || !this.file) {
              return;
            }
            if (ev[CTRL_OR_CMD]) {
              let svg = await this.svg(this.getScene());
              if (!svg) {
                return null;
              }
              svg = embedFontsInSVG(svg, this.plugin);
              download(
                null,
                svgToBase64(svg.outerHTML),
                `${this.file.basename}.svg`,
              );
              return;
            }
            this.saveSVG();
          });
      })
      .addSeparator();
    super.onPaneMenu(menu, source);
  }

  async getLibrary() {
    const data: any = this.plugin.getStencilLibrary();
    return data?.library ? data.library : data?.libraryItems ?? [];
  }

  private previousSceneVersion = 0;
  private previousBackgroundColor = "";
  private async instantiateExcalidraw(initdata: any) {
    while(!this.semaphores.scriptsReady) {
      await sleep(50);
    }
    const React = this.plugin.getPackage(this.ownerWindow).react;
    const ReactDOM = this.plugin.getPackage(this.ownerWindow).reactDOM;
    //console.log("ExcalidrawView.instantiateExcalidraw()");
    this.clearDirty();
    const reactElement = React.createElement(() => {
      let currentPosition = { x: 0, y: 0 };
      const excalidrawWrapperRef = React.useRef(null);
      const toolsPanelRef = React.useRef(null);
      const [dimensions, setDimensions] = React.useState({
        width: undefined,
        height: undefined,
      });

      //variables used to handle click events in view mode
      let selectedTextElement: { id: string; text: string } = null;
      let selectedImageElement: { id: string; fileId: string } = null;
      let selectedElementWithLink: { id: string; text: string } = null;
      let timestamp = 0;
      let blockOnMouseButtonDown = false;

      this.toolsPanelRef = toolsPanelRef;
      this.obsidianMenu = new ObsidianMenu(this.plugin, toolsPanelRef);

      //excalidrawRef readypromise based on
      //https://codesandbox.io/s/eexcalidraw-resolvable-promise-d0qg3?file=/src/App.js:167-760
      const resolvablePromise = () => {
        let resolve;
        let reject;
        const promise = new Promise((_resolve, _reject) => {
          resolve = _resolve;
          reject = _reject;
        });
        //@ts-ignore
        promise.resolve = resolve;
        //@ts-ignore
        promise.reject = reject;
        return promise;
      };

      // To memoize value between rerenders
      const excalidrawRef = React.useMemo(
        () => ({
          current: {
            readyPromise: resolvablePromise(),
          },
        }),
        [],
      );

      React.useEffect(() => {
        excalidrawRef.current.readyPromise.then(
          (api: ExcalidrawImperativeAPI) => {
            this.excalidrawAPI = api;
            api.setLocalFont(this.plugin.settings.experimentalEnableFourthFont);
            this.loadSceneFiles();
            this.updateContainerSize(null, true);
            this.excalidrawWrapperRef.current.firstElementChild?.focus();
            this.addFullscreenchangeEvent();
            this.initializeToolsIconPanelAfterLoading();
          },
        );
      }, [excalidrawRef]);

      this.excalidrawRef = excalidrawRef;
      this.excalidrawWrapperRef = excalidrawWrapperRef;

      const setCurrentPositionToCenter = () => {
        const api = this.excalidrawAPI;
        if (!excalidrawRef || !excalidrawRef.current || !api) {
          return;
        }
        const st = api.getAppState();
        const { width, height } = st;
        currentPosition = viewportCoordsToSceneCoords(
          {
            clientX: width / 2,
            clientY: height / 2,
          },
          st,
        );
      };

      React.useEffect(() => {
        setDimensions({
          width: this.contentEl.clientWidth,
          height: this.contentEl.clientHeight,
        });

        const onResize = () => {
          try {
            setDimensions({
              width: this.contentEl.clientWidth,
              height: this.contentEl.clientHeight,
            });
            if (this.toolsPanelRef && this.toolsPanelRef.current) {
              this.toolsPanelRef.current.updatePosition();
            }
            if(this.ownerDocument !== document) {
              this.refresh(); //because resizeobserver in Excalidraw does not seem to work when in Obsidian Window
            }
          } catch (err) {
            errorlog({
              where: "Excalidraw React-Wrapper, onResize",
              error: err,
            });
          }
        };
        this.ownerWindow.addEventListener("resize", onResize);
        return () => this.ownerWindow?.removeEventListener("resize", onResize);
      }, [excalidrawWrapperRef]);

      this.getSelectedTextElement = (): { id: string; text: string } => {
        const api = this.excalidrawAPI;
        if (!excalidrawRef?.current || !api) {
          return { id: null, text: null };
        }
        if (api.getAppState().viewModeEnabled) {
          if (selectedTextElement) {
            const retval = selectedTextElement;
            selectedTextElement = null;
            return retval;
          }
          return { id: null, text: null };
        }
        const selectedElement = api
          .getSceneElements()
          .filter(
            (el: ExcalidrawElement) =>
              el.id === Object.keys(api.getAppState().selectedElementIds)[0],
          );
        if (selectedElement.length === 0) {
          return { id: null, text: null };
        }

        if (selectedElement[0].type === "text") {
          return { id: selectedElement[0].id, text: selectedElement[0].text };
        } //a text element was selected. Return text

        if (selectedElement[0].type === "image") {
          return { id: null, text: null };
        }

        const boundTextElements = selectedElement[0].boundElements?.filter(
          (be: any) => be.type === "text",
        );
        if (boundTextElements?.length > 0) {
          const textElement = api
            .getSceneElements()
            .filter(
              (el: ExcalidrawElement) => el.id === boundTextElements[0].id,
            );
          if (textElement.length > 0) {
            return { id: textElement[0].id, text: textElement[0].text };
          }
        } //is a text container selected?

        if (selectedElement[0].groupIds.length === 0) {
          return { id: null, text: null };
        } //is the selected element part of a group?

        const group = selectedElement[0].groupIds[0]; //if yes, take the first group it is part of
        const textElement = api
          .getSceneElements()
          .filter((el: any) => el.groupIds?.includes(group))
          .filter((el: any) => el.type === "text"); //filter for text elements of the group
        if (textElement.length === 0) {
          return { id: null, text: null };
        } //the group had no text element member

        return { id: selectedElement[0].id, text: selectedElement[0].text }; //return text element text
      };

      this.getSelectedImageElement = (): { id: string; fileId: string } => {
        const api = this.excalidrawAPI;
        if (!api) {
          return { id: null, fileId: null };
        }
        if (api.getAppState().viewModeEnabled) {
          if (selectedImageElement) {
            const retval = selectedImageElement;
            selectedImageElement = null;
            return retval;
          }
          return { id: null, fileId: null };
        }
        const selectedElement = api
          .getSceneElements()
          .filter(
            (el: any) =>
              el.id == Object.keys(api.getAppState().selectedElementIds)[0],
          );
        if (selectedElement.length === 0) {
          return { id: null, fileId: null };
        }
        if (selectedElement[0].type == "image") {
          return {
            id: selectedElement[0].id,
            fileId: selectedElement[0].fileId,
          };
        } //an image element was selected. Return fileId

        if (selectedElement[0].type === "text") {
          return { id: null, fileId: null };
        }

        if (selectedElement[0].groupIds.length === 0) {
          return { id: null, fileId: null };
        } //is the selected element part of a group?
        const group = selectedElement[0].groupIds[0]; //if yes, take the first group it is part of
        const imageElement = api
          .getSceneElements()
          .filter((el: any) => el.groupIds?.includes(group))
          .filter((el: any) => el.type == "image"); //filter for Image elements of the group
        if (imageElement.length === 0) {
          return { id: null, fileId: null };
        } //the group had no image element member
        return { id: imageElement[0].id, fileId: imageElement[0].fileId }; //return image element fileId
      };

      this.getSelectedElementWithLink = (): { id: string; text: string } => {
        const api = this.excalidrawAPI;
        if (!api) {
          return { id: null, text: null };
        }
        if (api.getAppState().viewModeEnabled) {
          if (selectedElementWithLink) {
            const retval = selectedElementWithLink;
            selectedElementWithLink = null;
            return retval;
          }
          return { id: null, text: null };
        }
        const selectedElement = api
          .getSceneElements()
          .filter(
            (el: any) =>
              el.id == Object.keys(api.getAppState().selectedElementIds)[0],
          );
        if (selectedElement.length === 0) {
          return { id: null, text: null };
        }
        if (selectedElement[0].link) {
          return {
            id: selectedElement[0].id,
            text: selectedElement[0].link,
          };
        }

        if (selectedElement[0].groupIds.length === 0) {
          return { id: null, text: null };
        } //is the selected element part of a group?
        const group = selectedElement[0].groupIds[0]; //if yes, take the first group it is part of
        const elementsWithLink = api
          .getSceneElements()
          .filter((el: any) => el.groupIds?.includes(group))
          .filter((el: any) => el.link); //filter for elements of the group that have a link
        if (elementsWithLink.length === 0) {
          return { id: null, text: null };
        } //the group had no image element member
        return { id: elementsWithLink[0].id, text: elementsWithLink[0].link }; //return image element fileId
      };

      this.addText = async (
        text: string,
        fontFamily?: 1 | 2 | 3 | 4,
        save: boolean = true
      ): Promise<string> => {
        const api = this.excalidrawAPI;
        if (!excalidrawRef?.current || !api) {
          return;
        }
        const st: AppState = api.getAppState();
        const ea = this.plugin.ea;
        ea.reset();
        ea.style.strokeColor = st.currentItemStrokeColor ?? "black";
        ea.style.opacity = st.currentItemOpacity ?? 1;
        ea.style.fontFamily = fontFamily ?? st.currentItemFontFamily ?? 1;
        ea.style.fontSize = st.currentItemFontSize ?? 20;
        ea.style.textAlign = st.currentItemTextAlign ?? "left";
        const id = ea.addText(currentPosition.x, currentPosition.y, text);
        await this.addElements(ea.getElements(), false, save);
        return id;
      };

      this.addElements = async (
        newElements: ExcalidrawElement[],
        repositionToCursor: boolean = false,
        save: boolean = false,
        images: any,
        newElementsOnTop: boolean = false,
      ): Promise<boolean> => {
        const api = this.excalidrawAPI;
        if (!excalidrawRef?.current || !api) {
          return false;
        }
        const textElements = newElements.filter((el) => el.type == "text");
        for (let i = 0; i < textElements.length; i++) {
          const [parseResultWrapped, parseResult, link] =
            await this.excalidrawData.addTextElement(
              textElements[i].id,
              //@ts-ignore
              textElements[i].text,
              //@ts-ignore
              textElements[i].rawText, //TODO: implement originalText support in ExcalidrawAutomate
            );
          if (link) {
            //@ts-ignore
            textElements[i].link = link;
          }
          if (this.textMode == TextMode.parsed) {
            this.excalidrawData.updateTextElement(
              textElements[i],
              parseResultWrapped,
              parseResult,
            );
          }
        }

        if (repositionToCursor) {
          newElements = repositionElementsToCursor(
            newElements,
            currentPosition,
            true,
          );
        }

        const newIds = newElements.map((e) => e.id);
        const el: ExcalidrawElement[] = api.getSceneElements();
        const removeList: string[] = [];

        //need to update elements in scene.elements to maintain sequence of layers
        for (let i = 0; i < el.length; i++) {
          const id = el[i].id;
          if (newIds.includes(id)) {
            el[i] = newElements.filter((ne) => ne.id === id)[0];
            removeList.push(id);
          }
        }

        const elements = newElementsOnTop
          ? el.concat(newElements.filter((e) => !removeList.includes(e.id)))
          : newElements.filter((e) => !removeList.includes(e.id)).concat(el);
        this.updateScene({
          elements,
          commitToHistory: true,
        });

        if (images) {
          const files: BinaryFileData[] = [];
          Object.keys(images).forEach((k) => {
            files.push({
              mimeType: images[k].mimeType,
              id: images[k].id,
              dataURL: images[k].dataURL,
              created: images[k].created,
            });
            if (images[k].file) {
              const embeddedFile = new EmbeddedFile(
                this.plugin,
                this.file.path,
                images[k].file,
              );
              const st: AppState = api.getAppState();
              embeddedFile.setImage(
                images[k].dataURL,
                images[k].mimeType,
                images[k].size,
                st.theme === "dark",
                images[k].hasSVGwithBitmap,
              );
              this.excalidrawData.setFile(images[k].id, embeddedFile);
            }
            if (images[k].latex) {
              this.excalidrawData.setEquation(images[k].id, {
                latex: images[k].latex,
                isLoaded: true,
              });
            }
          });
          api.addFiles(files);
        }
        if (save) {
          await this.save(false); //preventReload=false will ensure that markdown links are paresed and displayed correctly
        } else {
          this.setDirty(5);
        }
        return true;
      };

      this.getScene = () => {
        const api = this.excalidrawAPI;
        if (!excalidrawRef?.current || !api) {
          return null;
        }
        const el: ExcalidrawElement[] = api.getSceneElements();
        const st: AppState = api.getAppState();
        const files = api.getFiles();

        if (files) {
          const imgIds = el
            .filter((e) => e.type === "image")
            .map((e: any) => e.fileId);
          const toDelete = Object.keys(files).filter(
            (k) => !imgIds.contains(k),
          );
          toDelete.forEach((k) => delete files[k]);
        }

        return {
          type: "excalidraw",
          version: 2,
          source: "https://excalidraw.com",
          elements: el,
          appState: {
            theme: st.theme,
            viewBackgroundColor: st.viewBackgroundColor,
            currentItemStrokeColor: st.currentItemStrokeColor,
            currentItemBackgroundColor: st.currentItemBackgroundColor,
            currentItemFillStyle: st.currentItemFillStyle,
            currentItemStrokeWidth: st.currentItemStrokeWidth,
            currentItemStrokeStyle: st.currentItemStrokeStyle,
            currentItemRoughness: st.currentItemRoughness,
            currentItemOpacity: st.currentItemOpacity,
            currentItemFontFamily: st.currentItemFontFamily,
            currentItemFontSize: st.currentItemFontSize,
            currentItemTextAlign: st.currentItemTextAlign,
            currentItemStrokeSharpness: st.currentItemStrokeSharpness,
            currentItemStartArrowhead: st.currentItemStartArrowhead,
            currentItemEndArrowhead: st.currentItemEndArrowhead,
            currentItemLinearStrokeSharpness:
              st.currentItemLinearStrokeSharpness,
            gridSize: st.gridSize,
            colorPalette: st.colorPalette,
          },
          files,
        };
      };

      this.refresh = () => {
        const api = this.excalidrawAPI;
        if (!excalidrawRef?.current || !api) {
          return;
        }
        api.refresh();
      };

      let hoverPoint = { x: 0, y: 0 };
      let hoverPreviewTarget: EventTarget = null;
      const clearHoverPreview = () => {
        if (hoverPreviewTarget) {
          const event = new MouseEvent("click", {
            view: this.ownerWindow,
            bubbles: true,
            cancelable: true,
          });
          hoverPreviewTarget.dispatchEvent(event);
          hoverPreviewTarget = null;
        }
      };

      const dropAction = (transfer: DataTransfer) => {
        // Return a 'copy' or 'link' action according to the content types, or undefined if no recognized type
        const files = (this.app as any).dragManager.draggable?.files;
        if (files) {
          if (files[0] == this.file) {
            files.shift();
            (
              this.app as any
            ).dragManager.draggable.title = `${files.length} files`;
          }
        }
        if (
          ["file", "files"].includes(
            (this.app as any).dragManager.draggable?.type,
          )
        ) {
          return "link";
        }
        if (
          transfer.types?.includes("text/html") ||
          transfer.types?.includes("text/plain") ||
          transfer.types?.includes("Files")
        ) {
          return "copy";
        }
      };

      let viewModeEnabled = false;
      const handleLinkClick = () => {
        selectedTextElement = getTextElementAtPointer(currentPosition, this);
        if (selectedTextElement && selectedTextElement.id) {
          const event = new MouseEvent("click", {
            ctrlKey: true,
            metaKey: this.metaKeyDown,
            shiftKey: this.shiftKeyDown,
            altKey: this.altKeyDown,
          });
          this.handleLinkClick(this, event);
          selectedTextElement = null;
          return;
        }
        selectedImageElement = getImageElementAtPointer(currentPosition, this);
        if (selectedImageElement && selectedImageElement.id) {
          const event = new MouseEvent("click", {
            ctrlKey: true,
            metaKey: this.metaKeyDown,
            shiftKey: this.shiftKeyDown,
            altKey: this.altKeyDown,
          });
          this.handleLinkClick(this, event);
          selectedImageElement = null;
          return;
        }

        selectedElementWithLink = getElementWithLinkAtPointer(currentPosition, this);
        if (selectedElementWithLink && selectedElementWithLink.id) {
          const event = new MouseEvent("click", {
            ctrlKey: true,
            metaKey: this.metaKeyDown,
            shiftKey: this.shiftKeyDown,
            altKey: this.altKeyDown,
          });
          this.handleLinkClick(this, event);
          selectedElementWithLink = null;
          return;
        }
      };

      let mouseEvent: any = null;

      const showHoverPreview = (linktext?: string, element?: ExcalidrawElement) => {
        if(!mouseEvent) return;
        if (!linktext) {
          if(!currentPosition) return;
          linktext = "";
          const selectedElement = getTextElementAtPointer(currentPosition, this);
          if (!selectedElement || !selectedElement.text) {
            const selectedImgElement =
              getImageElementAtPointer(currentPosition, this);
            element = this.excalidrawAPI.getSceneElements().filter((el:ExcalidrawElement)=>el.id === selectedImgElement.id)[0];
            if (!selectedImgElement || !selectedImgElement.fileId) {
              return;
            }
            if (!this.excalidrawData.hasFile(selectedImgElement.fileId)) {
              return;
            }
            const ef = this.excalidrawData.getFile(selectedImgElement.fileId);
            const ref = ef.linkParts.ref
              ? `#${ef.linkParts.isBlockRef ? "^" : ""}${ef.linkParts.ref}`
              : "";
            linktext =
              this.excalidrawData.getFile(selectedImgElement.fileId).file.path +
              ref;
          } else {
            element = this.excalidrawAPI.getSceneElements().filter((el:ExcalidrawElement)=>el.id === selectedElement.id)[0];
            const text: string =
              this.textMode === TextMode.parsed
                ? this.excalidrawData.getRawText(selectedElement.id)
                : selectedElement.text;

            if (!text) {
              return;
            }
            if (text.match(REG_LINKINDEX_HYPERLINK)) {
              return;
            }

            const parts = REGEX_LINK.getRes(text).next();
            if (!parts.value) {
              return;
            }
            linktext = REGEX_LINK.getLink(parts); //parts.value[2] ? parts.value[2]:parts.value[6];
            if (linktext.match(REG_LINKINDEX_HYPERLINK)) {
              return;
            }
          }
        }

        if(this.getHookServer().onLinkHoverHook) {
          try {
            if(!this.getHookServer().onLinkHoverHook(
              element,
              linktext,
              this,
              this.getHookServer()
            )) {
              return;
            }
          } catch (e) {
            errorlog({where: "ExcalidrawView.showHoverPreview", fn: this.getHookServer().onLinkHoverHook, error: e});
          }
        }

        if (this.semaphores.hoverSleep) {
          return;
        }

        const f = this.app.metadataCache.getFirstLinkpathDest(
          linktext.split("#")[0],
          this.file.path,
        );
        if (!f) {
          return;
        }

        if (
          this.ownerDocument.querySelector(`div.popover-title[data-path="${f.path}"]`)
        ) {
          return;
        }

        this.semaphores.hoverSleep = true;
        const self = this;
        setTimeout(() => (self.semaphores.hoverSleep = false), 500);
        this.plugin.hover.linkText = linktext;
        this.plugin.hover.sourcePath = this.file.path;
        hoverPreviewTarget = this.contentEl; //e.target;
        this.app.workspace.trigger("hover-link", {
          event: mouseEvent,
          source: VIEW_TYPE_EXCALIDRAW,
          hoverParent: hoverPreviewTarget,
          targetEl: hoverPreviewTarget, //null //0.15.0 hover editor!!
          linktext: this.plugin.hover.linkText,
          sourcePath: this.plugin.hover.sourcePath,
        });
        hoverPoint = currentPosition;
        if (this.isFullscreen()) {
          const self = this;
          setTimeout(() => {
            const popover =
              this.ownerDocument.querySelector(`div.popover-title[data-path="${f.path}"]`)
                ?.parentElement?.parentElement?.parentElement ??
              this.ownerDocument.body.querySelector("div.popover");
            if (popover) {
              self.contentEl.append(popover);
            }
          }, 400);
        }
      };

      const {
        Excalidraw,
      } = this.plugin.getPackage(this.ownerWindow).excalidrawLib;

      const excalidrawDiv = React.createElement(
        "div",
        {
          className: "excalidraw-wrapper",
          ref: excalidrawWrapperRef,
          key: "abc",
          tabIndex: 0,
          onKeyDown: (e: any) => {
            //@ts-ignore
            if (e.target === excalidrawDiv.ref.current) {
              return;
            } //event should originate from the canvas
            if (this.isFullscreen() && e.keyCode === KEYCODE.ESC) {
              this.exitFullscreen();
            }

            if (e[CTRL_OR_CMD] && !e.shiftKey && !e.altKey) {
              showHoverPreview();
            }
          },
          onClick: (e: MouseEvent): any => {
            if (!(e[CTRL_OR_CMD]||e.metaKey)) {
              return;
            } 
            if (!this.plugin.settings.allowCtrlClick && !e.metaKey) {
              return;
            }
            if (
              !(
                this.getSelectedTextElement().id ||
                this.getSelectedImageElement().id ||
                this.getSelectedElementWithLink().id
              )
            ) {
              return;
            }
            this.handleLinkClick(this, e);
          },
          onMouseMove: (e: MouseEvent) => {
            //@ts-ignore
            mouseEvent = e.nativeEvent;
          },
          onMouseOver: () => {
            clearHoverPreview();
          },
          onDragOver: (e: any) => {
            const action = dropAction(e.dataTransfer);
            if (action) {
              e.dataTransfer.dropEffect = action;
              e.preventDefault();
              return false;
            }
          },
          onDragLeave: () => {},
        },
        React.createElement(Excalidraw, {
          ref: excalidrawRef,
          width: dimensions.width,
          height: dimensions.height,
          UIOptions: {
            canvasActions: {
              loadScene: false,
              saveScene: false,
              saveAsScene: false,
              export: { saveFileToDisk: false },
              saveAsImage: false,
              saveToActiveFile: false,
            },
          },
          initialData: initdata,
          detectScroll: true,
          onPointerUpdate: (p: any) => {
            currentPosition = p.pointer;
            if (
              hoverPreviewTarget &&
              (Math.abs(hoverPoint.x - p.pointer.x) > 50 ||
                Math.abs(hoverPoint.y - p.pointer.y) > 50)
            ) {
              clearHoverPreview();
            }
            if (!viewModeEnabled) {
              return;
            }

            const buttonDown = !blockOnMouseButtonDown && p.button === "down";
            if (buttonDown) {
              blockOnMouseButtonDown = true;

              //ctrl click
              if (this.ctrlKeyDown || this.metaKeyDown) {
                handleLinkClick();
                return;
              }

              //dobule click
              const now = new Date().getTime();
              if (now - timestamp < 600) {
                handleLinkClick();
              }
              timestamp = now;
              return;
            }
            if (p.button === "up") {
              blockOnMouseButtonDown = false;
            }
            if (this.ctrlKeyDown || 
              (this.excalidrawAPI.getAppState().isViewModeEnabled && 
              this.plugin.settings.hoverPreviewWithoutCTRL)) {
              
              showHoverPreview();
            }
          },
          libraryReturnUrl: "app://obsidian.md",
          autoFocus: true,
          onChange: (et: ExcalidrawElement[], st: AppState) => {
            viewModeEnabled = st.viewModeEnabled;
            if (this.semaphores.justLoaded) {
              this.semaphores.justLoaded = false;
              if (!this.semaphores.preventAutozoom) {
                this.zoomToFit(false);
              }
              this.previousSceneVersion = this.getSceneVersion(et);
              this.previousBackgroundColor = st.viewBackgroundColor;
              return;
            }
            if (this.semaphores.dirty) {
              return;
            }
            if (
              st.editingElement === null &&
              //Removed because of
              //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/565
              /*st.resizingElement === null && 
              st.draggingElement === null &&
              st.editingGroupId === null &&*/
              st.editingLinearElement === null
            ) {
              const sceneVersion = this.getSceneVersion(et);
              if (
                ((sceneVersion > 0 || 
                  (sceneVersion === 0 && et.length > 0)) && //Addressing the rare case when the last element is deleted from the scene
                  sceneVersion !== this.previousSceneVersion) ||
                st.viewBackgroundColor !== this.previousBackgroundColor
              ) {
                this.previousSceneVersion = sceneVersion;
                this.previousBackgroundColor = st.viewBackgroundColor;
                this.setDirty(6);
              }
            }
          },
          onLibraryChange: (items: LibraryItems) => {
            (async () => {
              const lib = {
                type: "excalidrawlib",
                version: 2,
                source: "https://excalidraw.com",
                libraryItems: items,
              };
              this.plugin.setStencilLibrary(lib);
              await this.plugin.saveSettings();
            })();
          },
          renderTopRightUI: this.obsidianMenu.renderButton,
          onPaste: (data: ClipboardData) => {
            //, event: ClipboardEvent | null
            if (data.elements) {
              const self = this;
              setTimeout(() => self.save(false), 300);
            }
            return true;
          },
          onThemeChange: async (newTheme: string) => {
            //debug({where:"ExcalidrawView.onThemeChange",file:this.file.name,before:"this.loadSceneFiles",newTheme});
            this.excalidrawData.scene.appState.theme = newTheme;
            this.loadSceneFiles();
            toolsPanelRef?.current?.setTheme(newTheme);
          },
          ownerDocument: this.ownerDocument,
          ownerWindow: this.ownerWindow,
          onDrop: (event: React.DragEvent<HTMLDivElement>): boolean => {
            const api = this.excalidrawAPI;
            if (!api) {
              return false;
            }
            const st: AppState = api.getAppState();
            currentPosition = viewportCoordsToSceneCoords(
              { clientX: event.clientX, clientY: event.clientY },
              st,
            );

            const draggable = (this.app as any).dragManager.draggable;
            const onDropHook = (
              type: "file" | "text" | "unknown",
              files: TFile[],
              text: string,
            ): boolean => {
              if (this.getHookServer().onDropHook) {
                try {
                  return this.getHookServer().onDropHook({
                    //@ts-ignore
                    ea: this.getHookServer(), //the ExcalidrawAutomate object
                    event, //React.DragEvent<HTMLDivElement>
                    draggable, //Obsidian draggable object
                    type, //"file"|"text"
                    payload: {
                      files, //TFile[] array of dropped files
                      text, //string
                    },
                    excalidrawFile: this.file, //the file receiving the drop event
                    view: this, //the excalidraw view receiving the drop
                    pointerPosition: currentPosition, //the pointer position on canvas at the time of drop
                  });
                } catch (e) {
                  new Notice("on drop hook error. See console log for details");
                  errorlog({ where: "ExcalidrawView.onDrop", error: e });
                  return false;
                }
              } else {
                return false;
              }
            };

            //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/468
            event[CTRL_OR_CMD] = event.shiftKey || event[CTRL_OR_CMD];
            switch (draggable?.type) {
              case "file":
                if (!onDropHook("file", [draggable.file], null)) {
                  //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/422
                  if (draggable.file.path.match(REG_LINKINDEX_INVALIDCHARS)) {
                    new Notice(t("FILENAME_INVALID_CHARS"), 4000);
                    return false;
                  }
                  if (
                    event[CTRL_OR_CMD] && 
                    (IMAGE_TYPES.contains(draggable.file.extension) ||
                      draggable.file.extension === "md")
                  ) {
                    const ea = this.plugin.ea;
                    ea.reset();
                    ea.setView(this);
                    (async () => {
                      ea.canvas.theme = api.getAppState().theme;
                      await ea.addImage(
                        currentPosition.x,
                        currentPosition.y,
                        draggable.file,
                      );
                      ea.addElementsToView(false, false, true);
                    })();
                    return false;
                  }
                  this.addText(
                    `[[${this.app.metadataCache.fileToLinktext(
                      draggable.file,
                      this.file.path,
                      true,
                    )}]]`,
                  );
                }
                return false;
              case "files":
                if (!onDropHook("file", draggable.files, null)) {
                  (async () => {
                    if (event[CTRL_OR_CMD]) {
                      const ea = this.plugin.ea;
                      ea.reset();
                      ea.setView(this);
                      ea.canvas.theme = api.getAppState().theme;
                      let counter:number = 0;
                      for (const f of draggable.files) {
                        if ((IMAGE_TYPES.contains(f.extension) || f.extension === "md")) {
                          await ea.addImage(
                            currentPosition.x + counter*50,
                            currentPosition.y + counter*50,
                            f,
                          );
                          counter++;
                          await ea.addElementsToView(false, false, true);
                        }
                      }
                      return;
                    }
                    for (const f of draggable.files) {
                      await this.addText(
                        `[[${this.app.metadataCache.fileToLinktext(
                          f,
                          this.file.path,
                          true,
                        )}]]`, undefined,false
                      );
                      currentPosition.y += st.currentItemFontSize * 2;
                    }
                    this.save(false);
                  })();
                }
                return false;
            }
            if (event.dataTransfer.types.includes("text/plain")) {
              const text: string = event.dataTransfer.getData("text");
              if (!text) {
                return true;
              }
              if (!onDropHook("text", null, text)) {
                if (
                  this.plugin.settings.iframelyAllowed &&
                  text.match(/^https?:\/\/\S*$/)
                ) {
                  (async () => {
                    const id = await this.addText(text);
                    const url = `http://iframely.server.crestify.com/iframely?url=${text}`;
                    const data = JSON.parse(await request({ url }));
                    if (!data || data.error || !data.meta?.title) {
                      return false;
                    }
                    const ea = this.plugin.ea;
                    ea.reset();
                    ea.setView(this);
                    const el = ea
                      .getViewElements()
                      .filter((el) => el.id === id);
                    if (el.length === 1) {
                      //@ts-ignore
                      el[0].text = el[0].originalText = el[0].rawText =
                          `[${data.meta.title}](${text})`;
                      ea.copyViewElementsToEAforEditing(el);
                      ea.addElementsToView(false, false, false);
                    }
                    return false;
                  })();
                  return false;
                }
                //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/599
                if(text.startsWith("obsidian://open?vault=")) {
                  const html = event.dataTransfer.getData("text/html");
                  if(html) {
                    const path = html.match(/href="app:\/\/obsidian\.md\/(.*?)"/);
                    if(path.length === 2) {
                      const link = decodeURIComponent(path[1]).split("#");
                      const f = app.vault.getAbstractFileByPath(link[0]);
                      if(f && f instanceof TFile) {
                        const path = app.metadataCache.fileToLinktext(f,this.file.path);
                        this.addText(`[[${
                           path +
                          (link.length>1 ? "#" + link[1] + "|" + path : "")
                        }]]`);
                        return;
                      }
                      this.addText(`[[${decodeURIComponent(path[1])}]]`);
                      return false;  
                    }
                  }
                  const path = text.split("file=");
                  if(path.length === 2) {
                    this.addText(`[[${decodeURIComponent(path[1])}]]`);
                    return false;
                  }
                }
                this.addText(text.replace(/(!\[\[.*#[^\]]*\]\])/g, "$1{40}"));
              }
              return false;
            }
            if (onDropHook("unknown", null, null)) {
              return false;
            }
            return true;
          },
          onBeforeTextEdit: (textElement: ExcalidrawTextElement) => {
            clearTimeout(this.isEditingTextResetTimer);
            this.isEditingTextResetTimer = null;
            this.semaphores.isEditingText = true; //to prevent autoresize on mobile when keyboard pops up
            const raw = this.excalidrawData.getRawText(textElement.id);
            if (!raw) {
              return textElement.rawText;
            }
            return raw;
          },
          onBeforeTextSubmit: (
            textElement: ExcalidrawTextElement,
            text: string,
            originalText: string,
            isDeleted: boolean,
          ): [string, string, string] => {
            const api = this.excalidrawAPI;
            if (!api) {
              return [null, null, null];
            }
            this.semaphores.isEditingText = true;
            this.isEditingTextResetTimer = setTimeout(() => {
              this.semaphores.isEditingText = false;
              this.isEditingTextResetTimer = null;
            }, 1500); // to give time for the onscreen keyboard to disappear

            if (isDeleted) {
              this.excalidrawData.deleteTextElement(textElement.id);
              this.setDirty(7);
              return [null, null, null];
            }

            const containerId = textElement.containerId;

            //If the parsed text is different than the raw text, and if View is in TextMode.parsed
            //Then I need to clear the undo history to avoid overwriting raw text with parsed text and losing links
            if (
              text !== textElement.text ||
              originalText !== textElement.originalText ||
              !this.excalidrawData.getRawText(textElement.id)
            ) {
              //the user made changes to the text or the text is missing from Excalidraw Data (recently copy/pasted)
              //setTextElement will attempt a quick parse (without processing transclusions)
              this.setDirty(8);
              const [parseResultWrapped, parseResultOriginal, link] =
                this.excalidrawData.setTextElement(
                  textElement.id,
                  text,
                  originalText,
                  async () => {
                    await this.save(false);
                    //save preventReload==false, it will reload and update container sizes
                    //this callback function will only be invoked if quick parse fails, i.e. there is a transclusion in the raw text
                    //thus I only check if TextMode.parsed, text is always != with parseResult
                    if (this.textMode === TextMode.parsed) {
                      api.history.clear();
                    }
                  },
                );
              if (parseResultWrapped) {
                //there were no transclusions in the raw text, quick parse was successful
                if (containerId) {
                  this.updateContainerSize(containerId, true);
                }
                if (this.textMode === TextMode.raw) {
                  return [text, originalText, link];
                } //text is displayed in raw, no need to clear the history, undo will not create problems
                if (text === parseResultWrapped) {
                  if (link) {
                    //don't forget the case: link-prefix:"" && link-brackets:true
                    return [parseResultWrapped, parseResultOriginal, link];
                  }
                  return [null, null, null];
                } //There were no links to parse, raw text and parsed text are equivalent
                api.history.clear();
                return [parseResultWrapped, parseResultOriginal, link];
              }
              return [null, null, null];
            }
            if (containerId) {
              this.updateContainerSize(containerId, true);
            }
            if (this.textMode === TextMode.parsed) {
              return this.excalidrawData.getParsedText(textElement.id);
            }
            return [null, null, null];
          },
          onLinkOpen: async (
            element: ExcalidrawElement,
            e: any,
          ): Promise<void> => {
            e.preventDefault();
            if (!element) {
              return;
            }
            const link = element.link;
            if (!link || link === "") {
              return;
            }
            const tooltip = this.ownerDocument.body.querySelector(
              "body>div.excalidraw-tooltip,div.excalidraw-tooltip--visible",
            );
            if (tooltip) {
              this.ownerDocument.body.removeChild(tooltip);
            }
            const event = e?.detail?.nativeEvent;
            if(this.getHookServer().onLinkClickHook) {
              try {
                if(!this.getHookServer().onLinkClickHook(
                  element,
                  element.link,
                  event,
                  this,
                  this.getHookServer()
                )) {
                  return;
                }
              } catch (e) {
                errorlog({where: "ExcalidrawView.onLinkOpen", fn: this.getHookServer().onLinkClickHook, error: e});
              }
            }
            if (link.startsWith(LOCAL_PROTOCOL) || link.startsWith("[[")) {
              (async () => {
                const linkMatch = link.match(/(md:\/\/)?\[\[(?<link>.*?)\]\]/);
                if (!linkMatch) {
                  return;
                }
                let linkText = linkMatch.groups.link;

                let subpath: string = null;
                if (linkText.search("#") > -1) {
                  const linkParts = getLinkParts(linkText, this.file);
                  subpath = `#${linkParts.isBlockRef ? "^" : ""}${
                    linkParts.ref
                  }`;
                  linkText = linkParts.path;
                }

                if (linkText.match(REG_LINKINDEX_INVALIDCHARS)) {
                  new Notice(t("FILENAME_INVALID_CHARS"), 4000);
                  return;
                }

                const file = this.app.metadataCache.getFirstLinkpathDest(
                  linkText,
                  this.file.path,
                );

                const useNewLeaf =
                  event.shiftKey ||
                  event[CTRL_OR_CMD] ||
                  this.linksAlwaysOpenInANewPane ||
                  event.metaKey;

                if (useNewLeaf && this.isFullscreen()) {
                  this.exitFullscreen();
                }
                if (!file) {
                  new NewFileActions(
                    this.plugin,
                    linkText,
                    useNewLeaf,
                    !app.isMobile && event.metaKey,
                    this,
                  ).open();
                  return;
                }
                if (file === this.file) {
                  if (subpath) {
                    this.setEphemeralState({ subpath });
                    return;
                  }
                  this.zoomToFit(false);
                } else {
                  try {
                    const leaf = useNewLeaf
                      ? (event.metaKey && !app.isMobile)
                        //@ts-ignore
                        ? app.workspace.openPopoutLeaf()
                        : getNewOrAdjacentLeaf(this.plugin, this.leaf)
                      : this.leaf;
                    await leaf.openFile(
                      file,
                      subpath ? { active: false, eState: { subpath } } : {active:false},
                    ); //if file exists open file and jump to reference
                    //this.app.workspace.setActiveLeaf(leaf, true, true); //0.15.4 ExcaliBrain focus issue
                  } catch (e) {
                    new Notice(e, 4000);
                  }
                }
              })();
              return;
            }
            window.open(link);
          },
          onLinkHover: (
            element: NonDeletedExcalidrawElement,
            event: React.PointerEvent<HTMLCanvasElement>,
          ): void => {
            if (
              element &&
              (this.plugin.settings.hoverPreviewWithoutCTRL ||
                event[CTRL_OR_CMD])
            ) {
              mouseEvent = event;
              mouseEvent.ctrlKey = true;
              const link = element.link;
              if (!link || link === "") {
                return;
              }
              if (link.startsWith(LOCAL_PROTOCOL) || link.startsWith("[[")) {
                const linkMatch = link.match(/(md:\/\/)?\[\[(?<link>.*?)\]\]/);
                if (!linkMatch) {
                  return;
                }
                let linkText = linkMatch.groups.link;
                showHoverPreview(linkText, element);
              }
            }
          },
          onViewModeChange: (isViewModeEnabled: boolean) => {
            this.toolsPanelRef?.current?.setExcalidrawViewMode(
              isViewModeEnabled,
            );
            if(this.getHookServer().onViewModeChangeHook) {
              try {
                this.getHookServer().onViewModeChangeHook(isViewModeEnabled,this,this.getHookServer());
              } catch(e) {
                errorlog({where: "ExcalidrawView.onViewModeChange", fn: this.getHookServer().onViewModeChangeHook, error: e});
              }
              
            }
          },
        }),
        React.createElement(ToolsPanel, {
          ref: toolsPanelRef,
          visible: false,
          view: this,
          centerPointer: setCurrentPositionToCenter,
        }),
      );

      const observer = React.useRef(
        new ResizeObserver((entries) => {
          const { width, height } = entries[0].contentRect;
          const dx = toolsPanelRef.current.onRightEdge
            ? toolsPanelRef.current.previousWidth - width
            : 0;
          const dy = toolsPanelRef.current.onBottomEdge
            ? toolsPanelRef.current.previousHeight - height
            : 0;
          toolsPanelRef.current.updatePosition(dy, dx);
        }),
      );
      React.useEffect(() => {
        if (toolsPanelRef.current) {
          observer.current.observe(toolsPanelRef.current.containerRef.current);
        }
        return () => {
          observer.current.unobserve(
            toolsPanelRef.current.containerRef.current,
          );
        };
      }, [toolsPanelRef, observer]);

      return React.createElement(React.Fragment, null, excalidrawDiv);
    });
    ReactDOM.render(reactElement, this.contentEl, () => {});
  }

  private updateContainerSize(containerId?: string, delay: boolean = false) {
    const api = this.excalidrawAPI;
    if (!api) {
      return;
    }
    const update = () => {
      const containers = containerId
        ? api
            .getSceneElements()
            .filter((el: ExcalidrawElement) => el.id === containerId)
        : api
            .getSceneElements()
            .filter((el: ExcalidrawElement) =>
              el.boundElements?.map((e) => e.type).includes("text"),
            );
      if (containers.length > 0) {
        if (this.initialContainerSizeUpdate) {
          //updateContainerSize will bump scene version which will trigger a false autosave
          //after load, which will lead to a ping-pong between two syncronizing devices
          this.semaphores.justLoaded = true;
        }
        api.updateContainerSize(containers);
      }
      this.initialContainerSizeUpdate = false;
    };
    if (delay) {
      setTimeout(() => update(), 50);
    } else {
      update();
    }
  }

  public zoomToFit(delay: boolean = true) {
    const api = this.excalidrawAPI;
    if (!api || !this.excalidrawRef || this.semaphores.isEditingText) {
      return;
    }
    const maxZoom = this.plugin.settings.zoomToFitMaxLevel;
    const elements = api.getSceneElements();
    if (delay) {
      //time for the DOM to render, I am sure there is a more elegant solution
      setTimeout(
        () => api.zoomToFit(elements, maxZoom, this.isFullscreen() ? 0 : 0.05),
        100,
      );
    } else {
      api.zoomToFit(elements, maxZoom, this.isFullscreen() ? 0 : 0.05);
    }
  }

  public async toggleTrayMode() {
    const api = this.excalidrawAPI;
    if (!api) {
      return false;
    }
    const st = api.getAppState();
    api.updateScene({
      appState: { trayModeEnabled: !st.trayModeEnabled },
    });

    //just in case settings were updated via Obsidian sync
    await this.plugin.loadSettings();
    this.plugin.settings.defaultTrayMode = !st.trayModeEnabled;
    this.plugin.saveSettings();
  }

  public selectElementsMatchingQuery(
    elements: ExcalidrawElement[],
    query: string[],
    selectResult: boolean = true,
    exactMatch: boolean = false, //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/530
  ) {
    if (!elements || elements.length === 0 || !query || query.length === 0) {
      return;
    }

    const match = elements.filter((el: any) =>
      query.some((q) => {
        if (exactMatch) {
          const text = el.rawText.toLowerCase().split("\n")[0].trim();
          const m = text.match(/^#*(# .*)/);
          if (!m || m.length !== 2) {
            return false;
          }
          return m[1] === q.toLowerCase();
        }
        const text = el.rawText.toLowerCase().replaceAll("\n", " ").trim();
        return text.match(q.toLowerCase()); //to distinguish between "# frame" and "# frame 1"
      }),
    );
    if (match.length === 0) {
      new Notice("I could not find a matching text element");
      return;
    }

    const api = this.excalidrawAPI;
    if (!api) {
      return;
    }
    if (selectResult) {
      api.selectElements(match);
    }
    api.zoomToFit(match, this.plugin.settings.zoomToFitMaxLevel, 0.05);
  }

  public getViewSelectedElements(): ExcalidrawElement[] {
    const api = this.excalidrawAPI;
    if (!api) {
      return;
    }
    const selectedElements = api.getAppState()?.selectedElementIds;
    if (!selectedElements) {
      return [];
    }
    const selectedElementsKeys = Object.keys(selectedElements);
    if (!selectedElementsKeys) {
      return [];
    }
    const elements: ExcalidrawElement[] = api
      .getSceneElements()
      .filter((e: any) => selectedElementsKeys.includes(e.id));

    const containerBoundTextElmenetsReferencedInElements = elements
      .filter(
        (el) =>
          el.boundElements &&
          el.boundElements.filter((be) => be.type === "text").length > 0,
      )
      .map(
        (el) =>
          el.boundElements
            .filter((be) => be.type === "text")
            .map((be) => be.id)[0],
      );

    const elementIDs = elements
      .map((el) => el.id)
      .concat(containerBoundTextElmenetsReferencedInElements);

    return api
      .getSceneElements()
      .filter((el: ExcalidrawElement) => elementIDs.contains(el.id));
  }

  public async copyLinkToSelectedElementToClipboard() {
    const elements = this.getViewSelectedElements();
    if (elements.length !== 1) {
      new Notice(t("INSERT_LINK_TO_ELEMENT_ERROR"));
      return;
    }
    const alias = await ScriptEngine.inputPrompt(
      this.app,
      "Set link alias",
      "Leave empty if you do not want to set an alias",
      "",
    );
    navigator.clipboard.writeText(
      `[[${this.file.path}#^${elements[0].id}${alias ? `|${alias}` : ``}]]`,
    );
    new Notice(t("INSERT_LINK_TO_ELEMENT_READY"));
  }

  public updateScene(
    scene: {
      elements?: ExcalidrawElement[];
      appState?: any;
      files?: any;
      commitToHistory?: boolean;
    },
    restore: boolean = false,
  ) {
    const api = this.excalidrawAPI;
    if (!api) {
      return;
    }
    const shouldRestoreElements = scene.elements && restore;
    if (shouldRestoreElements) {
      scene.elements = api.restore(scene).elements;
    }
    try {
      api.updateScene(scene);
    } catch (e) {
      errorlog({
        where: "ExcalidrawView.updateScene 1st attempt",
        fn: this.updateScene,
        error: e,
        scene,
        willDoSecondAttempt: !shouldRestoreElements,
      });
      if (!shouldRestoreElements) {
        //second attempt
        try {
          scene.elements = api.restore(scene).elements;
          api.updateScene(scene);
        } catch (e) {
          errorlog({
            where: "ExcalidrawView.updateScene 2nd attempt",
            fn: this.updateScene,
            error: e,
            scene,
          });
          warningUnknowSeriousError();
        }
      } else {
        warningUnknowSeriousError();
      }
    }
  }
}

export function getTextMode(data: string): TextMode {
  const parsed =
    data.search("excalidraw-plugin: parsed\n") > -1 ||
    data.search("excalidraw-plugin: locked\n") > -1; //locked for backward compatibility
  return parsed ? TextMode.parsed : TextMode.raw;
}
