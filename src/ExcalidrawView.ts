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
  requireApiVersion,
} from "obsidian";
//import * as React from "react";
//import * as ReactDOM from "react-dom";
//import Excalidraw from "@zsviczian/excalidraw";
import {
  ExcalidrawElement,
  ExcalidrawImageElement,
  ExcalidrawTextElement,
  FileId,
  NonDeletedExcalidrawElement,
} from "@zsviczian/excalidraw/types/excalidraw/element/types";
import {
  AppState,
  BinaryFileData,
  DataURL,
  ExcalidrawImperativeAPI,
  Gesture,
  LibraryItems,
  UIAppState,
} from "@zsviczian/excalidraw/types/excalidraw/types";
import {
  VIEW_TYPE_EXCALIDRAW,
  ICON_NAME,
  DISK_ICON_NAME,
  SCRIPTENGINE_ICON_NAME,
  TEXT_DISPLAY_RAW_ICON_NAME,
  TEXT_DISPLAY_PARSED_ICON_NAME,
  IMAGE_TYPES,
  REG_LINKINDEX_INVALIDCHARS,
  KEYCODE,
  FRONTMATTER_KEYS,
  DEVICE,
  GITHUB_RELEASES,
  EXPORT_IMG_ICON_NAME,
  viewportCoordsToSceneCoords,
  ERROR_IFRAME_CONVERSION_CANCELED,
  restore,
  obsidianToExcalidrawMap,
  MAX_IMAGE_SIZE,
  fileid,
  sceneCoordsToViewportCoords,
  MD_EX_SECTIONS,
  refreshTextDimensions,
  getContainerElement,
} from "./constants/constants";
import ExcalidrawPlugin from "./main";
import { 
  repositionElementsToCursor,
  ExcalidrawAutomate,
  getTextElementsMatchingQuery,
  cloneElement,
  getFrameElementsMatchingQuery,
  getElementsWithLinkMatchingQuery
} from "./ExcalidrawAutomate";
import { t } from "./lang/helpers";
import {
  ExcalidrawData,
  REG_LINKINDEX_HYPERLINK,
  REGEX_LINK,
  AutoexportPreference,
  getExcalidrawMarkdownHeaderSection,
} from "./ExcalidrawData";
import {
  checkAndCreateFolder,
  download,
  getDataURLFromURL,
  getIMGFilename,
  getInternalLinkOrFileURLLink,
  getMimeType,
  getNewUniqueFilepath,
  getURLImageExtension,
} from "./utils/FileUtils";
import {
  checkExcalidrawVersion,
  errorlog,
  getEmbeddedFilenameParts,
  getExportTheme,
  getPNG,
  getPNGScale,
  getSVG,
  getExportPadding,
  getWithBackground,
  hasExportTheme,
  scaleLoadedImage,
  svgToBase64,
  hyperlinkIsImage,
  hyperlinkIsYouTubeLink,
  getYouTubeThumbnailLink,
  isContainer,
  fragWithHTML,
  isMaskFile,
  shouldEmbedScene,
  _getContainerElement,
  arrayToMap,
} from "./utils/Utils";
import { cleanBlockRef, cleanSectionHeading, closeLeafView, getAttachmentsFolderAndFilePath, getLeaf, getParentOfClass, obsidianPDFQuoteWithRef, openLeaf, setExcalidrawView } from "./utils/ObsidianUtils";
import { splitFolderAndFilename } from "./utils/FileUtils";
import { ConfirmationPrompt, GenericInputPrompt, NewFileActions, Prompt, linkPrompt } from "./dialogs/Prompt";
import { ClipboardData } from "@zsviczian/excalidraw/types/excalidraw/clipboard";
import { updateEquation } from "./LaTeX";
import {
  EmbeddedFile,
  EmbeddedFilesLoader,
  FileData,
  generateIdFromFile,
} from "./EmbeddedFileLoader";
import { ScriptInstallPrompt } from "./dialogs/ScriptInstallPrompt";
import { ObsidianMenu } from "./menu/ObsidianMenu";
import { ToolsPanel } from "./menu/ToolsPanel";
import { ScriptEngine } from "./Scripts";
import { getTextElementAtPointer, getImageElementAtPointer, getElementWithLinkAtPointer } from "./utils/GetElementAtPointer";
import { excalidrawSword, ICONS, LogoWrapper, Rank, saveIcon, SwordColors } from "./menu/ActionIcons";
import { ExportDialog } from "./dialogs/ExportDialog";
import { getEA } from "src"
import { anyModifierKeysPressed, emulateKeysForLinkClick, webbrowserDragModifierType, internalDragModifierType, isWinALTorMacOPT, isWinCTRLorMacCMD, isWinMETAorMacCTRL, isSHIFT, linkClickModifierType, localFileDragModifierType, ModifierKeys, modifierKeyTooltipMessages } from "./utils/ModifierkeyHelper";
import { setDynamicStyle } from "./utils/DynamicStyling";
import { InsertPDFModal } from "./dialogs/InsertPDFModal";
import { CustomEmbeddable, renderWebView } from "./customEmbeddable";
import { addBackOfTheNoteCard, getExcalidrawFileForwardLinks, getFrameBasedOnFrameNameOrId, getLinkTextFromLink, insertEmbeddableToView, insertImageToView, isTextImageTransclusion, openExternalLink, parseObsidianLink, renderContextMenuAction, tmpBruteForceCleanup } from "./utils/ExcalidrawViewUtils";
import { imageCache } from "./utils/ImageCache";
import { CanvasNodeFactory, ObsidianCanvasNode } from "./utils/CanvasNodeFactory";
import { EmbeddableMenu } from "./menu/EmbeddableActionsMenu";
import { useDefaultExcalidrawFrame } from "./utils/CustomEmbeddableUtils";
import { UniversalInsertFileModal } from "./dialogs/UniversalInsertFileModal";
import { getMermaidText, shouldRenderMermaid } from "./utils/MermaidUtils";
import { nanoid } from "nanoid";
import { CustomMutationObserver, DEBUGGING, debug, log} from "./utils/DebugHelper";
import { extractCodeBlocks, postOpenAI } from "./utils/AIUtils";
import { Mutable } from "@zsviczian/excalidraw/types/excalidraw/utility-types";
import { SelectCard } from "./dialogs/SelectCard";
import { Packages } from "./types/types";
import React from "react";

const EMBEDDABLE_SEMAPHORE_TIMEOUT = 2000;
const PREVENT_RELOAD_TIMEOUT = 2000;
const RE_TAIL = /^## Drawing\n.*```\n%%$(.*)/ms;

declare const PLUGIN_VERSION:string;

declare module "obsidian" {
  interface Workspace {
    floatingSplit: any;
  }

  interface WorkspaceSplit {
    containerEl: HTMLDivElement;
  }
}

type SelectedElementWithLink = { id: string; text: string };
type SelectedImage = { id: string; fileId: FileId };

export enum TextMode {
  parsed = "parsed",
  raw = "raw",
}

interface WorkspaceItemExt extends WorkspaceItem {
  containerEl: HTMLElement;
}

export interface ExportSettings {
  withBackground: boolean;
  withTheme: boolean;
  isMask: boolean;
  frameRendering?: { //optional, overrides relevant appState settings for rendering the frame
    enabled: boolean;
    name: boolean;
    outline: boolean;
    clip: boolean;
  };
  skipInliningFonts?: boolean;
}

const HIDE = "excalidraw-hidden";
const SHOW = "excalidraw-visible";

export const addFiles = async (
  files: FileData[],
  view: ExcalidrawView,
  isDark?: boolean,
) => {
  (process.env.NODE_ENV === 'development') && DEBUGGING && debug(addFiles, "ExcalidrawView.addFiles", files, view, isDark);
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
      storeAction: "update",
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
  new Notice(t("WARNING_SERIOUS_ERROR"),60000);
};

type ActionButtons = "save" | "isParsed" | "isRaw" | "link" | "scriptInstall";

let windowMigratedDisableZoomOnce = false;

export default class ExcalidrawView extends TextFileView {
  public exportDialog: ExportDialog;
  public excalidrawData: ExcalidrawData;
  //public excalidrawRef: React.MutableRefObject<any> = null;
  public excalidrawRoot: any;
  public excalidrawAPI:any = null;
  public excalidrawWrapperRef: React.MutableRefObject<any> = null;
  public toolsPanelRef: React.MutableRefObject<any> = null;
  public embeddableMenuRef: React.MutableRefObject<any> = null;
  private parentMoveObserver: MutationObserver | CustomMutationObserver;
  public linksAlwaysOpenInANewPane: boolean = false; //override the need for SHIFT+CTRL+click (used by ExcaliBrain)
  public allowFrameButtonsInViewMode: boolean = false;  //override for ExcaliBrain
  private _hookServer: ExcalidrawAutomate;
  public lastSaveTimestamp: number = 0; //used to validate if incoming file should sync with open file
  private lastLoadedFile: TFile = null;
  //store key state for view mode link resolution
  private modifierKeyDown: ModifierKeys = {shiftKey:false, metaKey: false, ctrlKey: false, altKey: false}
  public currentPosition: {x:number,y:number} = { x: 0, y: 0 };
  //Obsidian 0.15.0
  private draginfoDiv: HTMLDivElement;
  public canvasNodeFactory: CanvasNodeFactory;
  private embeddableRefs = new Map<ExcalidrawElement["id"], HTMLIFrameElement | HTMLWebViewElement>();
  private embeddableLeafRefs = new Map<ExcalidrawElement["id"], any>();

  public semaphores: {
    //flag to prevent overwriting the changes the user makes in an embeddable view editing the back side of the drawing
    embeddableIsEditingSelf: boolean;
    popoutUnload: boolean; //the unloaded Excalidraw view was the last leaf in the popout window
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
    wheelTimeout:number; //used to avoid hover preview while zooming
  } | null = {
    embeddableIsEditingSelf: false,
    popoutUnload: false,
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
    wheelTimeout: null,
  };

  public _plugin: ExcalidrawPlugin;
  public autosaveTimer: any = null;
  public textMode: TextMode = TextMode.raw;
  private actionButtons: Record<ActionButtons, HTMLElement> = {} as Record<ActionButtons, HTMLElement>;
  public compatibilityMode: boolean = false;
  private obsidianMenu: ObsidianMenu;
  private embeddableMenu: EmbeddableMenu;
  private destroyers: Function[] = [];

  //https://stackoverflow.com/questions/27132796/is-there-any-javascript-event-fired-when-the-on-screen-keyboard-on-mobile-safari
  private isEditingTextResetTimer: number = null;
  private preventReloadResetTimer: number = null;
  private editingSelfResetTimer: number = null;
  private colorChangeTimer:number = null;
  private previousSceneVersion = 0;
  public previousBackgroundColor = "";
  public previousTheme = "";

  //variables used to handle click events in view mode
  private selectedTextElement: SelectedElementWithLink = null;
  private selectedImageElement: SelectedImage = null;
  private selectedElementWithLink: SelectedElementWithLink = null;
  private blockOnMouseButtonDown = false;
  private doubleClickTimestamp = Date.now();

  private hoverPoint = { x: 0, y: 0 };
  private hoverPreviewTarget: EventTarget = null;
  private viewModeEnabled:boolean = false;
  private lastMouseEvent: any = null;
  private editingTextElementId: string = null; //storing to handle on-screen keyboard hide events
/*  private lastSceneSnapshot: any = null;
  private lastViewDataSnapshot: any = null;*/

  id: string = (this.leaf as any).id;
  public packages: Packages = {react: null, reactDOM: null, excalidrawLib: null};

  constructor(leaf: WorkspaceLeaf, plugin: ExcalidrawPlugin) {
    super(leaf);
    this._plugin = plugin;
    this.excalidrawData = new ExcalidrawData(plugin);
    this.canvasNodeFactory = new CanvasNodeFactory(this);
    this.setHookServer();
  }

  get hookServer (): ExcalidrawAutomate {
    return this._hookServer;
  }
  get plugin(): ExcalidrawPlugin {
    return this._plugin;
  }
  get excalidrawContainer(): HTMLDivElement {
    return this.excalidrawWrapperRef?.current?.firstElementChild;
  }  
  get ownerDocument(): Document {
    return DEVICE.isMobile?document:this.containerEl.ownerDocument;
  }
  get ownerWindow(): Window {
    return this.ownerDocument.defaultView;
  }

  setHookServer(ea?:ExcalidrawAutomate) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.setHookServer, "ExcalidrawView.setHookServer", ea);
    if(ea) {
      this._hookServer = ea;
    } else {
      this._hookServer = this._plugin.ea;
    }
  }

  private getHookServer () {
    return this.hookServer ?? this.plugin.ea;
  }

  preventAutozoom() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.preventAutozoom, "ExcalidrawView.preventAutozoom");
    this.semaphores.preventAutozoom = true;
    window.setTimeout(() => (this.semaphores.preventAutozoom = false), 1500);
  }

  public saveExcalidraw(scene?: any) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.saveExcalidraw, "ExcalidrawView.saveExcalidraw", scene);
    if (!scene) {
      if(!this.excalidrawAPI) {
        return;
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

  public async exportExcalidraw(selectedOnly?: boolean) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.exportExcalidraw, "ExcalidrawView.exportExcalidraw", selectedOnly);
    if (!this.excalidrawAPI || !this.file) {
      return;
    }
    if (DEVICE.isMobile) {
      const prompt = new Prompt(
        this.app,
        t("EXPORT_FILENAME_PROMPT"),
        this.file.basename,
        t("EXPORT_FILENAME_PROMPT_PLACEHOLDER"),
      );
      prompt.openAndGetValue(async (filename: string) => {
        if (!filename) {
          return;
        }
        filename = `${filename}.excalidraw`;
        const folderpath = splitFolderAndFilename(this.file.path).folderpath;
        await checkAndCreateFolder(folderpath); //create folder if it does not exist
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
      encodeURIComponent(JSON.stringify(this.getScene(selectedOnly), null, "\t")),
      `${this.file.basename}.excalidraw`,
    );
  }

  public async svg(scene: any, theme?:string, embedScene?: boolean, embedFont: boolean = false): Promise<SVGSVGElement> {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.svg, "ExcalidrawView.svg", scene, theme, embedScene);
    const ed = this.exportDialog;

    const exportSettings: ExportSettings = {
      withBackground: ed ? !ed.transparent : getWithBackground(this.plugin, this.file),
      withTheme: true,
      isMask: isMaskFile(this.plugin, this.file),
      skipInliningFonts: !embedFont,
    };

    if(typeof embedScene === "undefined") {
      embedScene = shouldEmbedScene(this.plugin, this.file);
    }

    return await getSVG(
      {
        ...scene,
        ...{
          appState: {
            ...scene.appState,
            theme: theme ?? (ed ? ed.theme : getExportTheme(this.plugin, this.file, scene.appState.theme)),
            exportEmbedScene: typeof embedScene === "undefined"
              ? (ed ? ed.embedScene : false)
              : embedScene,
          },
        },
      },
      exportSettings,
      ed ? ed.padding : getExportPadding(this.plugin, this.file),
      this.file,
    );
  }

  public async saveSVG(scene?: any, embedScene?: boolean) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.saveSVG, "ExcalidrawView.saveSVG", scene, embedScene);
    if (!scene) {
      if (!this.excalidrawAPI) {
        return false;
      }
      scene = this.getScene();
    }

    const exportImage = async (filepath:string, theme?:string) => {
      const file = this.app.vault.getAbstractFileByPath(normalizePath(filepath));

      const svg = await this.svg(scene,theme, embedScene, true);
      if (!svg) {
        return;
      }
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svg);
      if (file && file instanceof TFile) {
        await this.app.vault.modify(file, svgString);
      } else {
        await this.app.vault.create(filepath, svgString);
      }
    }

    if(this.plugin.settings.autoExportLightAndDark) {
      await exportImage(getIMGFilename(this.file.path, "dark.svg"),"dark");
      await exportImage(getIMGFilename(this.file.path, "light.svg"),"light");
    } else {
      await exportImage(getIMGFilename(this.file.path, "svg"));
    } 
  }

  public async exportSVG(embedScene?: boolean, selectedOnly?: boolean):Promise<void> {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.exportSVG, "ExcalidrawView.exportSVG", embedScene, selectedOnly);
    if (!this.excalidrawAPI || !this.file) {
      return;
    }

    const svg = await this.svg(this.getScene(selectedOnly),undefined,embedScene, true);
    if (!svg) {
      return;
    }
    download(
      null,
      svgToBase64(svg.outerHTML),
      `${this.file.basename}.svg`,
    );
  }

  public async png(scene: any, theme?:string, embedScene?: boolean): Promise<Blob> {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.png, "ExcalidrawView.png", scene, theme, embedScene);
    const ed = this.exportDialog;

    const exportSettings: ExportSettings = {
      withBackground: ed ? !ed.transparent : getWithBackground(this.plugin, this.file),
      withTheme: true,
      isMask: isMaskFile(this.plugin, this.file),
    };

    if(typeof embedScene === "undefined") {
      embedScene = shouldEmbedScene(this.plugin, this.file);
    }

    return await getPNG(
      {
        ...scene,
        ...{
          appState: {
            ...scene.appState,
            theme: theme ?? (ed ? ed.theme : getExportTheme(this.plugin, this.file, scene.appState.theme)),
            exportEmbedScene: typeof embedScene === "undefined"
              ? (ed ? ed.embedScene : false)
              : embedScene,
          },
        },
      },
      exportSettings,
      ed ? ed.padding : getExportPadding(this.plugin, this.file),
      ed ? ed.scale : getPNGScale(this.plugin, this.file),
    );
  }

  public async savePNG(scene?: any, embedScene?: boolean) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.savePNG, "ExcalidrawView.savePNG", scene, embedScene);
    if (!scene) {
      if (!this.excalidrawAPI) {
        return false;
      }
      scene = this.getScene();
    }

    const exportImage = async (filepath:string, theme?:string) => {
      const file = this.app.vault.getAbstractFileByPath(normalizePath(filepath));

      const png = await this.png(scene, theme, embedScene);
      if (!png) {
        return;
      }
      if (file && file instanceof TFile) {
        await this.app.vault.modifyBinary(file, await png.arrayBuffer());
      } else {
        await this.app.vault.createBinary(filepath, await png.arrayBuffer());
      }
    }

    if(this.plugin.settings.autoExportLightAndDark) {
      await exportImage(getIMGFilename(this.file.path, "dark.png"),"dark");
      await exportImage(getIMGFilename(this.file.path, "light.png"),"light");
    } else {
      await exportImage(getIMGFilename(this.file.path, "png"));
    }
  }

  public async exportPNGToClipboard(embedScene?:boolean, selectedOnly?: boolean) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.exportPNGToClipboard, "ExcalidrawView.exportPNGToClipboard", embedScene, selectedOnly);
    if (!this.excalidrawAPI || !this.file) {
      return;
    }

    const png = await this.png(this.getScene(selectedOnly), undefined, embedScene);
    if (!png) {
      return;
    }
   
    // in Safari so far we need to construct the ClipboardItem synchronously
    // (i.e. in the same tick) otherwise browser will complain for lack of
    // user intent. Using a Promise ClipboardItem constructor solves this.
    // https://bugs.webkit.org/show_bug.cgi?id=222262
    //
    // not await so that we can detect whether the thrown error likely relates
    // to a lack of support for the Promise ClipboardItem constructor
    await navigator.clipboard.write([
      new window.ClipboardItem({
        "image/png": png,
      }),
    ]);
  }

  public async exportPNG(embedScene?:boolean, selectedOnly?: boolean):Promise<void> {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.exportPNG, "ExcalidrawView.exportPNG", embedScene, selectedOnly);
    if (!this.excalidrawAPI || !this.file) {
      return;
    }
    
    const png = await this.png(this.getScene(selectedOnly), undefined, embedScene);
    if (!png) {
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(png);
    reader.onloadend = () => {
      const base64data = reader.result;
      download(null, base64data, `${this.file.basename}.png`);
    };
  }

  public setPreventReload() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.setPreventReload, "ExcalidrawView.setPreventReload");
    this.semaphores.preventReload = true;
    this.preventReloadResetTimer = window.setTimeout(()=>this.semaphores.preventReload = false,PREVENT_RELOAD_TIMEOUT);
  }

  public clearPreventReloadTimer() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.clearPreventReloadTimer, "ExcalidrawView.clearPreventReloadTimer");
    if(this.preventReloadResetTimer) {
      window.clearTimeout(this.preventReloadResetTimer);
      this.preventReloadResetTimer = null;
    }
  }

  public async setEmbeddableIsEditingSelf() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.setEmbeddableIsEditingSelf, "ExcalidrawView.setEmbeddableIsEditingSelf");
    this.clearEmbeddableIsEditingSelfTimer();
    await this.forceSave(true);
    this.semaphores.embeddableIsEditingSelf = true;
  }

  public clearEmbeddableIsEditingSelfTimer () {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.clearEmbeddableIsEditingSelfTimer, "ExcalidrawView.clearEmbeddableIsEditingSelfTimer");
    if(this.editingSelfResetTimer) {
      window.clearTimeout(this.editingSelfResetTimer);
      this.editingSelfResetTimer = null;
    }
  }

  public clearEmbeddableIsEditingSelf() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.clearEmbeddableIsEditingSelf, "ExcalidrawView.clearEmbeddableIsEditingSelf");
    this.clearEmbeddableIsEditingSelfTimer();
    this.editingSelfResetTimer = window.setTimeout(()=>this.semaphores.embeddableIsEditingSelf = false,EMBEDDABLE_SEMAPHORE_TIMEOUT);
  }

  async save(preventReload: boolean = true, forcesave: boolean = false, overrideEmbeddableIsEditingSelfDebounce: boolean = false) {
    if ((process.env.NODE_ENV === 'development')) {
      if (DEBUGGING) {
        debug(this.save, "ExcalidrawView.save, enter", preventReload, forcesave);
        console.trace();
      }
    }
    /*if(this.semaphores.viewunload && (this.ownerWindow !== window)) {
      (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.save, `ExcalidrawView.save, view is unloading, aborting save`);
      return;
    }*/
    
    if(!this.isLoaded) {
      return;
    }
    if (!overrideEmbeddableIsEditingSelfDebounce && this.semaphores.embeddableIsEditingSelf) {
      return;
    }
    //console.log("saving - embeddable not editing")
    //debug({where:"save", preventReload, forcesave, semaphores:this.semaphores});
    if (this.semaphores.saving) {
      return;
    }
    this.semaphores.saving = true;
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.save, `ExcalidrawView.save, saving, dirty:${this.isDirty()}, preventReload:${preventReload}, forcesave:${forcesave}`);
    
    //if there were no changes to the file super save will not save 
    //and consequently main.ts modifyEventHandler will not fire
    //this.reload will not be called
    //triggerReload is used to flag if there were no changes but file should be reloaded anyway
    let triggerReload:boolean = false;

    if (
      !this.excalidrawAPI ||
      !this.isLoaded ||
      !this.file ||
      !this.app.vault.getAbstractFileByPath(this.file.path) //file was recently deleted
    ) {
      this.semaphores.saving = false;
      return;
    }

    try {
      const allowSave = this.isDirty() || forcesave; //removed this.semaphores.autosaving
      (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.save, `ExcalidrawView.save, try saving, allowSave:${allowSave}, isDirty:${this.isDirty()}, isAutosaving:${this.semaphores.autosaving}, isForceSaving:${forcesave}`);

      if (allowSave) {
        const scene = this.getScene();

        if (this.compatibilityMode) {
          await this.excalidrawData.syncElements(scene);
        } else if (
          await this.excalidrawData.syncElements(scene, this.excalidrawAPI.getAppState().selectedElementIds)
          && !this.semaphores.popoutUnload //Obsidian going black after REACT 18 migration when closing last leaf on popout
        ) {
          await this.loadDrawing(
            false,
            this.excalidrawAPI.getSceneElementsIncludingDeleted().filter((el:ExcalidrawElement)=>el.isDeleted)
          );
        }

        //reload() is triggered indirectly when saving by the modifyEventHandler in main.ts
        //prevent reload is set here to override reload when not wanted: typically when the user is editing
        //and we do not want to interrupt the flow by reloading the drawing into the canvas.
        this.clearDirty();
        this.clearPreventReloadTimer();

        this.semaphores.preventReload = preventReload;
        //added this to avoid Electron crash when terminating a popout window and saving the drawing, need to check back
        //can likely be removed once this is resolved: https://github.com/electron/electron/issues/40607
        if(this.semaphores?.viewunload) {
          const d = this.getViewData();
          const plugin = this.plugin;
          const file = this.file;
          window.setTimeout(async ()=>{
            await plugin.app.vault.modify(file,d);
            await imageCache.addBAKToCache(file.path,d);                        
          },200)
          return;
        }

        await super.save();
        if (process.env.NODE_ENV === 'development') {
          if (DEBUGGING) {
            debug(this.save, `ExcalidrawView.save, super.save finished`, this.file);
            console.trace();
          }
        }
        //saving to backup with a delay in case application closes in the meantime, I want to avoid both save and backup corrupted.
        const path = this.file.path;
        //@ts-ignore
        const data = this.lastSavedData;
        window.setTimeout(()=>imageCache.addBAKToCache(path,data),50);
        triggerReload = (this.lastSaveTimestamp === this.file.stat.mtime) &&
          !preventReload && forcesave;
        this.lastSaveTimestamp = this.file.stat.mtime;
        //this.clearDirty(); //moved to right after allow save, to avoid autosave collision with load drawing
        
        //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/629
        //there were odd cases when preventReload semaphore did not get cleared and consequently a synchronized image
        //did not update the open drawing
        if(preventReload) {
          this.setPreventReload();
        }
      }

      // !triggerReload means file has not changed. No need to re-export
      //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1209 (added popout unload to the condition)
      if (!triggerReload && !this.semaphores.autosaving && (!this.semaphores.viewunload || this.semaphores.popoutUnload)) {
        const autoexportPreference = this.excalidrawData.autoexportPreference;
        if (
          (autoexportPreference === AutoexportPreference.inherit && this.plugin.settings.autoexportSVG) ||
          autoexportPreference === AutoexportPreference.both || autoexportPreference === AutoexportPreference.svg
        ) {
          this.saveSVG();
        }
        if (
          (autoexportPreference === AutoexportPreference.inherit && this.plugin.settings.autoexportPNG) ||
          autoexportPreference === AutoexportPreference.both || autoexportPreference === AutoexportPreference.png
        ) {
          this.savePNG();
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
    if(triggerReload) {
      this.reload(true, this.file);
    }
  }

  // get the new file content
  // if drawing is in Text Element Edit Lock, then everything should be parsed and in sync
  // if drawing is in Text Element Edit Unlock, then everything is raw and parse and so an async function is not required here
  
  getViewData() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.getViewData, "ExcalidrawView.getViewData");
    if (!this.excalidrawAPI || !this.excalidrawData.loaded) {
      return this.data;
    }

    const scene = this.getScene();
    if(!scene) { 
      return this.data;
    }

    //include deleted elements in save in case saving in markdown mode
    //deleted elements are only used if sync modifies files while Excalidraw is open
    //otherwise deleted elements are discarded when loading the scene
    if (!this.compatibilityMode) {

      const keys:[string,string][] = this.exportDialog?.dirty && this.exportDialog?.saveSettings
        ? [
            [FRONTMATTER_KEYS["export-padding"].name, this.exportDialog.padding.toString()],
            [FRONTMATTER_KEYS["export-pngscale"].name, this.exportDialog.scale.toString()],
            [FRONTMATTER_KEYS["export-dark"].name, this.exportDialog.theme === "dark" ? "true" : "false"],
            [FRONTMATTER_KEYS["export-transparent"].name, this.exportDialog.transparent ? "true" : "false"],
            [FRONTMATTER_KEYS["plugin"].name, this.textMode === TextMode.raw ? "raw" : "parsed"],
            [FRONTMATTER_KEYS["export-embed-scene"].name, this.exportDialog.embedScene ? "true" : "false"], 
          ]
        : [
            [FRONTMATTER_KEYS["plugin"].name, this.textMode === TextMode.raw ? "raw" : "parsed"]
          ];

      if(this.exportDialog?.dirty) {
        this.exportDialog.dirty = false;
      }

      const header = getExcalidrawMarkdownHeaderSection(this.data, keys);
      const tail = this.plugin.settings.zoteroCompatibility ? (RE_TAIL.exec(this.data)?.[1] ?? "") : "";

      if (!this.excalidrawData.disableCompression) {
        this.excalidrawData.disableCompression = this.plugin.settings.decompressForMDView &&
          this.isEditedAsMarkdownInOtherView();
      }
      const result = header + this.excalidrawData.generateMD(
        this.excalidrawAPI.getSceneElementsIncludingDeleted().filter((el:ExcalidrawElement)=>el.isDeleted) //will be concatenated to scene.elements
      ) + tail;
      this.excalidrawData.disableCompression = false;
      return result;
    }
    if (this.compatibilityMode) {
      return JSON.stringify(scene, null, "\t");
    }

    return this.data;
  }

  private hiddenMobileLeaves:[WorkspaceLeaf,string][] = [];

  restoreMobileLeaves() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.restoreMobileLeaves, "ExcalidrawView.restoreMobileLeaves");
    if(this.hiddenMobileLeaves.length>0) {
      this.hiddenMobileLeaves.forEach((x:[WorkspaceLeaf,string])=>{
        //@ts-ignore
        x[0].containerEl.style.display = x[1];
      })
      this.hiddenMobileLeaves = [];
    }
  }

  async openLaTeXEditor(eqId: string) {
    const el = this.getViewElements().find((el:ExcalidrawElement)=>el.id === eqId && el.type==="image") as ExcalidrawImageElement;
    if(!el) {
      return;
    }
  
    const fileId = el.fileId;

    let equation = this.excalidrawData.getEquation(fileId)?.latex;
    if(!equation) {
      await this.save(false);
      equation = this.excalidrawData.getEquation(fileId)?.latex;
      if(!equation) return;
    }

    GenericInputPrompt.Prompt(this,this.plugin,this.app,t("ENTER_LATEX"),undefined,equation, undefined, 3).then(async (formula: string) => {
      if (!formula || formula === equation) {
        return;
      }
      this.excalidrawData.setEquation(fileId, {
        latex: formula,
        isLoaded: false,
      });
      await this.save(false);
      await updateEquation(
        formula,
        fileId,
        this,
        addFiles,
      );
      this.setDirty(1);
    });  
  }

  async openEmbeddedLinkEditor(imgId:string) {
    const el = this.getViewElements().find((el:ExcalidrawElement)=>el.id === imgId && el.type==="image") as ExcalidrawImageElement;
    if(!el) {
      return;
    }
    const fileId = el.fileId;
    const ef = this.excalidrawData.getFile(fileId);
    if(!ef) {
      return
    }
    if (!ef.isHyperLink && !ef.isLocalLink && ef.file) {
      const handler = async (link:string) => {
        if (!link || ef.linkParts.original === link) {
          return;
        }
        ef.resetImage(this.file.path, link);
        this.excalidrawData.setFile(fileId, ef);
        this.setDirty(2);
        await this.save(false);
        await sleep(100);
        if(!this.plugin.isExcalidrawFile(ef.file) && !link.endsWith("|100%")) {
          const ea = getEA(this) as ExcalidrawAutomate;
          let imgEl = this.getViewElements().find((x:ExcalidrawElement)=>x.id === el.id) as ExcalidrawImageElement;
          if(!imgEl) {
            ea.destroy();
            return;
          }
          if(imgEl && await ea.resetImageAspectRatio(imgEl)) {
            await ea.addElementsToView(false);
          }
          ea.destroy();
        }
      }
      GenericInputPrompt.Prompt(
        this,
        this.plugin,
        this.app,
        t("MARKDOWN_EMBED_CUSTOMIZE_LINK_PROMPT_TITLE"),
        undefined,
        ef.linkParts.original,
        [{caption: "✅", action: (x:string)=>{x.replaceAll("\n","").trim()}}],
        3,
        false,
        (container) => container.createEl("p",{text: fragWithHTML(t("MARKDOWN_EMBED_CUSTOMIZE_LINK_PROMPT"))}),
        false
      ).then(handler.bind(this),()=>{});
      return;
    }
  }

  toggleDisableBinding() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.toggleDisableBinding, "ExcalidrawView.toggleDisableBinding");
    const newState = !this.excalidrawAPI.getAppState().invertBindingBehaviour;
    this.updateScene({appState: {invertBindingBehaviour:newState}, storeAction: "update"});
    new Notice(newState ? t("ARROW_BINDING_INVERSE_MODE") : t("ARROW_BINDING_NORMAL_MODE"));
  }

  toggleFrameRendering() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.toggleFrameRendering, "ExcalidrawView.toggleFrameRendering");
    const frameRenderingSt = (this.excalidrawAPI as ExcalidrawImperativeAPI).getAppState().frameRendering;
    this.updateScene({appState: {frameRendering: {...frameRenderingSt, enabled: !frameRenderingSt.enabled}}, storeAction: "update"});
    new Notice(frameRenderingSt.enabled ? t("FRAME_CLIPPING_ENABLED") : t("FRAME_CLIPPING_DISABLED"));
  }

  toggleFrameClipping() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.toggleFrameClipping, "ExcalidrawView.toggleFrameClipping");
    const frameRenderingSt = (this.excalidrawAPI as ExcalidrawImperativeAPI).getAppState().frameRendering;
    this.updateScene({appState: {frameRendering: {...frameRenderingSt, clip: !frameRenderingSt.clip}}, storeAction: "update"});
    new Notice(frameRenderingSt.clip ? "Frame Clipping: Enabled" : "Frame Clipping: Disabled");
  }

  gotoFullscreen() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.gotoFullscreen, "ExcalidrawView.gotoFullscreen");
    if(this.plugin.leafChangeTimeout) {
      window.clearTimeout(this.plugin.leafChangeTimeout); //leafChangeTimeout is created on window in main.ts!!!
      this.plugin.leafChangeTimeout = null;
    }
    if (!this.excalidrawWrapperRef) {
      return;
    }
    if (this.toolsPanelRef && this.toolsPanelRef.current) {
      this.toolsPanelRef.current.setFullscreen(true);
    }

    const hide = (el:HTMLElement) => {
      let tmpEl = el;
      while(tmpEl && !tmpEl.hasClass("workspace-split")) {
        el.addClass(SHOW);
        el = tmpEl;
        tmpEl = el.parentElement;
      }
      if(el) {
        el.addClass(SHOW);
        el.querySelectorAll(`div.workspace-split:not(.${SHOW})`).forEach(node=>{
          if(node !== el) node.addClass(SHOW);
        });
        el.querySelector(`div.workspace-leaf-content.${SHOW} > .view-header`).addClass(SHOW);
        el.querySelectorAll(`div.workspace-tab-container.${SHOW} > div.workspace-leaf:not(.${SHOW})`).forEach(node=>node.addClass(SHOW));
        el.querySelectorAll(`div.workspace-tabs.${SHOW} > div.workspace-tab-header-container`).forEach(node=>node.addClass(SHOW));
        el.querySelectorAll(`div.workspace-split.${SHOW} > div.workspace-tabs:not(.${SHOW})`).forEach(node=>node.addClass(SHOW));
      }
      const doc = this.ownerDocument;
      doc.body.querySelectorAll(`div.workspace-split:not(.${SHOW})`).forEach(node=>{
        if(node !== tmpEl) {
          node.addClass(HIDE);
        } else {
          node.addClass(SHOW);
        }
      });
      doc.body.querySelector(`div.workspace-leaf-content.${SHOW} > .view-header`).addClass(HIDE);
      doc.body.querySelectorAll(`div.workspace-tab-container.${SHOW} > div.workspace-leaf:not(.${SHOW})`).forEach(node=>node.addClass(HIDE));
      doc.body.querySelectorAll(`div.workspace-tabs.${SHOW} > div.workspace-tab-header-container`).forEach(node=>node.addClass(HIDE));
      doc.body.querySelectorAll(`div.workspace-split.${SHOW} > div.workspace-tabs:not(.${SHOW})`).forEach(node=>node.addClass(HIDE));
      doc.body.querySelectorAll(`div.workspace-ribbon`).forEach(node=>node.addClass(HIDE));
      doc.body.querySelectorAll(`div.mobile-navbar`).forEach(node=>node.addClass(HIDE));
      doc.body.querySelectorAll(`div.status-bar`).forEach(node=>node.addClass(HIDE));
    }

    hide(this.contentEl);
  }


  isFullscreen(): boolean {
    //(process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.isFullscreen, "ExcalidrawView.isFullscreen");
    return Boolean(document.body.querySelector(".excalidraw-hidden"));
  }

  exitFullscreen() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.exitFullscreen, "ExcalidrawView.exitFullscreen");
    if (this.toolsPanelRef && this.toolsPanelRef.current) {
      this.toolsPanelRef.current.setFullscreen(false);
    }
    const doc = this.ownerDocument;
    doc.querySelectorAll(".excalidraw-hidden").forEach(el=>el.removeClass(HIDE));
    doc.querySelectorAll(".excalidraw-visible").forEach(el=>el.removeClass(SHOW));
  }

  removeLinkTooltip() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.removeLinkTooltip, "ExcalidrawView.removeLinkTooltip");
    //.classList.remove("excalidraw-tooltip--visible");document.querySelector(".excalidraw-tooltip",);
    const tooltip = this.ownerDocument.body.querySelector(
      "body>div.excalidraw-tooltip,div.excalidraw-tooltip--visible",
    );
    if (tooltip) {
      tooltip.classList.remove("excalidraw-tooltip--visible")
      //this.ownerDocument.body.removeChild(tooltip);
    }
  }

  handleLinkHookCall(element:ExcalidrawElement,link:string, event:any):boolean {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.handleLinkHookCall, "ExcalidrawView.handleLinkHookCall", element, link, event);
    if(this.getHookServer().onLinkClickHook) {
      try {
        if(!this.getHookServer().onLinkClickHook(
          element,
          link,
          event,
          this,
          this.getHookServer()
        )) {
          return true;
        }
      } catch (e) {
        errorlog({where: "ExcalidrawView.onLinkOpen", fn: this.getHookServer().onLinkClickHook, error: e});
      }
    }
    return false;
  }

  private getLinkTextForElement(
    selectedText:SelectedElementWithLink,
    selectedElementWithLink?:SelectedElementWithLink
  ): {
    linkText: string,
    selectedElement: ExcalidrawElement,
  } {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.getLinkTextForElement, "ExcalidrawView.getLinkTextForElement", selectedText, selectedElementWithLink);
    if (selectedText?.id || selectedElementWithLink?.id) {
      const selectedTextElement: ExcalidrawTextElement = selectedText.id
      ? this.excalidrawAPI.getSceneElements().find((el:ExcalidrawElement)=>el.id === selectedText.id)
      : null;

      const selectedElement = selectedElementWithLink.id
      ? this.excalidrawAPI.getSceneElements().find((el:ExcalidrawElement)=>el.id === selectedElementWithLink.id)
      : null;

      let linkText =
        selectedElementWithLink?.text ??
        (this.textMode === TextMode.parsed
          ? this.excalidrawData.getRawText(selectedText.id)
          : selectedText.text);

      if(linkText.startsWith("#")) {
        return {linkText, selectedElement: selectedTextElement ?? selectedElement};
      }

      const maybeObsidianLink = parseObsidianLink(linkText, this.app);
      if(typeof maybeObsidianLink === "string") {
        linkText = maybeObsidianLink;
      }

      const partsArray = REGEX_LINK.getResList(linkText);
      if (!linkText || partsArray.length === 0) {
        //the container link takes precedence over the text link
        if(selectedTextElement?.containerId) {
          const container = _getContainerElement(selectedTextElement, {elements: this.excalidrawAPI.getSceneElements()});
          if(container) {
            linkText = container.link;
            
            if(linkText.startsWith("#")) {
              return {linkText, selectedElement: selectedTextElement ?? selectedElement};
            }

            const maybeObsidianLink = parseObsidianLink(linkText, this.app);
            if(typeof maybeObsidianLink === "string") {
              linkText = maybeObsidianLink;
            }
          }
        }
        if(!linkText || partsArray.length === 0) {
          linkText = selectedTextElement?.link;
        }
      }
      return {linkText, selectedElement: selectedTextElement ?? selectedElement};
    }
    return {linkText: null, selectedElement: null};
  }

  async linkClick(
    ev: MouseEvent | null,
    selectedText: SelectedElementWithLink,
    selectedImage: SelectedImage,
    selectedElementWithLink: SelectedElementWithLink,
    keys?: ModifierKeys
  ) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.linkClick, "ExcalidrawView.linkClick", ev, selectedText, selectedImage, selectedElementWithLink, keys);
    if(!selectedText) selectedText = {id:null, text: null};
    if(!selectedImage) selectedImage = {id:null, fileId: null};
    if(!selectedElementWithLink) selectedElementWithLink = {id:null, text:null};
    if(!ev && !keys) keys = emulateKeysForLinkClick("new-tab");
    if( ev && !keys) keys = {shiftKey: ev.shiftKey, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey};

    const linkClickType = linkClickModifierType(keys);

    let file = null;
    let subpath: string = null;
    let {linkText, selectedElement} = this.getLinkTextForElement(selectedText, selectedElementWithLink);

    //if (selectedText?.id || selectedElementWithLink?.id) {
    if (selectedElement) {
      if (!linkText) {
          return;
      }
      linkText = linkText.replaceAll("\n", ""); //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/187

      if(this.handleLinkHookCall(selectedElement,linkText,ev)) return;
      if(openExternalLink(linkText, this.app)) return;

      const maybeObsidianLink = parseObsidianLink(linkText,this.app);
      if (typeof maybeObsidianLink === "boolean" && maybeObsidianLink) return;
      if (typeof maybeObsidianLink === "string") {
        linkText = maybeObsidianLink;
      }

      const result = await linkPrompt(linkText, this.app, this);
      if(!result) return;
      [file, linkText, subpath] = result;
    }
    if (selectedImage?.id) {
      const imageElement = this.getScene().elements.find((el:ExcalidrawElement)=>el.id === selectedImage.id) as ExcalidrawImageElement;
      if (this.excalidrawData.hasEquation(selectedImage.fileId)) {
        this.updateScene({appState: {contextMenu: null}});
        this.openLaTeXEditor(selectedImage.id);
        return;
      }
      if (this.excalidrawData.hasMermaid(selectedImage.fileId) || getMermaidText(imageElement)) {
        if(shouldRenderMermaid) {
          const api = this.excalidrawAPI as ExcalidrawImperativeAPI;
          api.updateScene({appState: {openDialog: { name: "ttd", tab: "mermaid" }}, storeAction: "update"})
        }
        return;
      }
      
      await this.save(false); //in case pasted images haven't been saved yet
      if (this.excalidrawData.hasFile(selectedImage.fileId)) {
        const fileId = selectedImage.fileId;
        const ef = this.excalidrawData.getFile(fileId);
        if (!ef.isHyperLink && !ef.isLocalLink && ef.file && linkClickType === "md-properties") {
          this.updateScene({appState: {contextMenu: null}});
          this.openEmbeddedLinkEditor(selectedImage.id);
          return;
        }
        let secondOrderLinks: string = " ";
        
        const backlinks = this.app.metadataCache?.getBacklinksForFile(ef.file)?.data;
        const secondOrderLinksSet = new Set<string>();
        if(backlinks && this.plugin.settings.showSecondOrderLinks) {
          const linkPaths = Object.keys(backlinks)
            .filter(path => (path !== this.file.path) && (path !== ef.file.path))
            .map(path => {
              const filepathParts = splitFolderAndFilename(path);
              if(secondOrderLinksSet.has(path)) return "";
              secondOrderLinksSet.add(path);
              return `[[${path}|${t("LINKLIST_SECOND_ORDER_LINK")}: ${filepathParts.basename}]]`;
            });
          secondOrderLinks += linkPaths.join(" ");
        }

        if(this.plugin.settings.showSecondOrderLinks && this.plugin.isExcalidrawFile(ef.file)) {
          secondOrderLinks += getExcalidrawFileForwardLinks(this.app, ef.file, secondOrderLinksSet);             
        }

        const linkString = (ef.isHyperLink || ef.isLocalLink
          ? `[](${ef.hyperlink}) `
          : `[[${ef.linkParts.original}]] `
        ) + (imageElement.link
          ? (imageElement.link.match(/$cmd:\/\/.*/) || imageElement.link.match(REG_LINKINDEX_HYPERLINK))
            ? `[](${imageElement.link})`
            : imageElement.link
          : "");
        
        const result = await linkPrompt(linkString + secondOrderLinks, this.app, this);
        if(!result) return;
        [file, linkText, subpath] = result;
      }
    }

    if (!linkText) {
      new Notice(t("LINK_BUTTON_CLICK_NO_TEXT"), 20000);
      return;
    }

    const id = selectedImage.id??selectedText.id??selectedElementWithLink.id;
    const el = this.excalidrawAPI.getSceneElements().filter((el:ExcalidrawElement)=>el.id === id)[0];
    if(this.handleLinkHookCall(el,linkText,ev)) return;

    try {
      if (linkClickType !== "active-pane" && this.isFullscreen()) {
        this.exitFullscreen();
      }
      if (!file) {
        new NewFileActions({
          plugin: this.plugin,
          path: linkText,
          keys,
          view: this,
          sourceElement: el
        }).open();
        return;
      }
      if(this.linksAlwaysOpenInANewPane && !anyModifierKeysPressed(keys)) {
        keys = emulateKeysForLinkClick("new-pane");
      }
      
      try {
        //@ts-ignore
        const drawIO = this.app.plugins.plugins["drawio-obsidian"];
        if(drawIO && drawIO._loaded) {
          if(file.extension === "svg") {
            const svg = await this.app.vault.cachedRead(file);
            if(/(&lt;|\<)(mxfile|mxgraph)/i.test(svg)) {
              const leaf = getLeaf(this.plugin,this.leaf,keys);
              leaf.setViewState({
                type: "diagram-edit",
                state: {
                  file: file.path
                }
              });
              return;
            }
          }
        }
      } catch(e) {
        console.error(e);
      }
      
      //if link will open in the same pane I want to save the drawing before opening the link
      await this.forceSaveIfRequired();
      const {leaf, promise} = openLeaf({
        plugin: this.plugin,
        fnGetLeaf: () => getLeaf(this.plugin,this.leaf,keys),
        file,
        openState: {
          active: !this.linksAlwaysOpenInANewPane,
          ...subpath ? { eState: { subpath } } : {}
        }
      }); //if file exists open file and jump to reference
      await promise;
      //view.app.workspace.setActiveLeaf(leaf, true, true); //0.15.4 ExcaliBrain focus issue
    } catch (e) {
      new Notice(e, 4000);
    }
  }
  
  async handleLinkClick(ev: MouseEvent | ModifierKeys) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.handleLinkClick, "ExcalidrawView.handleLinkClick", ev);
    this.removeLinkTooltip();

    const selectedText = this.getSelectedTextElement();
    const selectedImage = selectedText?.id
      ? null
      : this.getSelectedImageElement();
    const selectedElementWithLink =
      (selectedImage?.id || selectedText?.id)
        ? null
        : this.getSelectedElementWithLink();
    this.linkClick(
      ev instanceof MouseEvent ? ev : null,
      selectedText,
      selectedImage,
      selectedElementWithLink,
      ev instanceof MouseEvent ? null : ev,
    );
  }

  onResize() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.onResize, "ExcalidrawView.onResize");
    super.onResize();
    if(this.plugin.leafChangeTimeout) return; //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/723
    const api = this.excalidrawAPI;
    if (
      !this.plugin.settings.zoomToFitOnResize ||
      !this.excalidrawAPI ||
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

  excalidrawGetSceneVersion: (elements: ExcalidrawElement[]) => number;
  getSceneVersion (elements: ExcalidrawElement[]):number {
    if(!this.excalidrawGetSceneVersion) {
      this.excalidrawGetSceneVersion = this.packages.excalidrawLib.getSceneVersion;
    }
    return this.excalidrawGetSceneVersion(elements.filter(el=>!el.isDeleted));
  }

  public async forceSave(silent:boolean=false) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.forceSave, "ExcalidrawView.forceSave");
    if (this.semaphores.autosaving || this.semaphores.saving) {
      if(!silent) new Notice(t("FORCE_SAVE_ABORTED"))
      return;
    }
    if(this.preventReloadResetTimer) {
      window.clearTimeout(this.preventReloadResetTimer);
      this.preventReloadResetTimer = null;
    }
    this.semaphores.preventReload = false;
    this.semaphores.forceSaving = true;
    await this.save(false, true, true);
    this.plugin.triggerEmbedUpdates();
    this.loadSceneFiles();
    this.semaphores.forceSaving = false;
    if(!silent) new Notice("Save successful", 1000);
  }


  onload() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.onload, "ExcalidrawView.onload");
    const apiMissing = Boolean(typeof this.containerEl.onWindowMigrated === "undefined")
    this.packages = this.plugin.getPackage(this.ownerWindow);

    if(DEVICE.isDesktop && !apiMissing) {
      this.destroyers.push(
        //@ts-ignore 
        //this.containerEl.onWindowMigrated(this.leaf.rebuildView.bind(this))
        this.containerEl.onWindowMigrated(async() => {
          (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.onload, "ExcalidrawView.onWindowMigrated");
          const f = this.file;
          const l = this.leaf;
          await closeLeafView(l);
          windowMigratedDisableZoomOnce = true;
          l.setViewState({
            type: VIEW_TYPE_EXCALIDRAW,
            state: {
              file: f.path,
            }
          });
        })
      );
    }
    
    this.semaphores.scriptsReady = true;
    
    const wheelEvent = (ev:WheelEvent) => {
      if(this.semaphores.wheelTimeout) window.clearTimeout(this.semaphores.wheelTimeout);
      if(this.semaphores.hoverSleep && this.excalidrawAPI) this.clearHoverPreview();
      this.semaphores.wheelTimeout = window.setTimeout(()=>{
        window.clearTimeout(this.semaphores.wheelTimeout);
        this.semaphores.wheelTimeout = null;
      },1000);
    }

    this.registerDomEvent(this.containerEl,"wheel",wheelEvent, {passive: false});

    this.actionButtons['scriptInstall'] = this.addAction(SCRIPTENGINE_ICON_NAME, t("INSTALL_SCRIPT_BUTTON"), () => {
      new ScriptInstallPrompt(this.plugin).open();
    });

    this.actionButtons['save'] = this.addAction(
      DISK_ICON_NAME,
      t("FORCE_SAVE"),
      async () => this.forceSave(),
    );

    this.actionButtons['isRaw'] = this.addAction(
      TEXT_DISPLAY_RAW_ICON_NAME,
      t("RAW"),
      () => this.changeTextMode(TextMode.parsed),
    );
    this.actionButtons['isParsed'] = this.addAction(
      TEXT_DISPLAY_PARSED_ICON_NAME,
      t("PARSED"),
      () => this.changeTextMode(TextMode.raw),
    );
    
    this.actionButtons['link'] = this.addAction("link", t("OPEN_LINK"), (ev) =>
      this.handleLinkClick(ev),
    );

    this.registerDomEvent(this.ownerWindow, "resize", this.onExcalidrawResize.bind(this));

    this.app.workspace.onLayoutReady(async () => {
      (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.onload,`ExcalidrawView.onload > app.workspace.onLayoutReady, file:${this.file?.name}, isActiveLeaf:${this?.app?.workspace?.activeLeaf === this.leaf}, is activeExcalidrawView set:${Boolean(this?.plugin?.activeExcalidrawView)}`);
      //Leaf was moved to new window and ExcalidrawView was destructed.
      //Happens during Obsidian startup if View opens in new window.
      if(!this.plugin) {
        return;
      }
      //implemented to overcome issue that activeLeafChangeEventHandler is not called when view is initialized from a saved workspace, since Obsidian 1.6.0
      let counter = 0;
      while(counter++<50 && (!Boolean(this?.plugin?.activeLeafChangeEventHandler) || !Boolean(this.canvasNodeFactory))) {
        await(sleep(50));
        if(!this?.plugin) return;
      }
      if(!Boolean(this?.plugin?.activeLeafChangeEventHandler)) return;
      if (Boolean(this.plugin.activeLeafChangeEventHandler) && (this?.app?.workspace?.activeLeaf === this.leaf)) {
        this.plugin.activeLeafChangeEventHandler(this.leaf);
      }
      this.canvasNodeFactory.initialize();
      this.contentEl.addClass("excalidraw-view");
      //https://github.com/zsviczian/excalibrain/issues/28
      await this.addSlidingPanesListner(); //awaiting this because when using workspaces, onLayoutReady comes too early
      this.addParentMoveObserver();

      const onKeyUp = (e: KeyboardEvent) => {
        this.modifierKeyDown = {
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey,
          altKey: e.altKey,
          metaKey: e.metaKey
        }
      };

      const onKeyDown = (e: KeyboardEvent) => {
        this.modifierKeyDown = {
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey,
          altKey: e.altKey,
          metaKey: e.metaKey
        }
      };

      this.registerDomEvent(this.ownerWindow, "keydown", onKeyDown, false);
      this.registerDomEvent(this.ownerWindow, "keyup", onKeyUp, false);
    });

    this.setupAutosaveTimer();
    super.onload();
  }

  //this is to solve sliding panes bug
  //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/9
  private slidingPanesListner: ()=>void;
  private async addSlidingPanesListner() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.addSlidingPanesListner, "ExcalidrawView.addSlidingPanesListner");
    if(!this.plugin.settings.slidingPanesSupport) {
      return;
    }

    this.slidingPanesListner = () => {
      if (this.excalidrawAPI) {
        this.refreshCanvasOffset();
      }
    };
    let rootSplit = this.app.workspace.rootSplit as WorkspaceItem as WorkspaceItemExt;
    while(!rootSplit) {
      await sleep(50);
      rootSplit = this.app.workspace.rootSplit as WorkspaceItem as WorkspaceItemExt;
    }
    this.registerDomEvent(rootSplit.containerEl,"scroll",this.slidingPanesListner);
  }

  private removeSlidingPanesListner() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.removeSlidingPanesListner, "ExcalidrawView.removeSlidingPanesListner");
    if (this.slidingPanesListner) {
      (
        this.app.workspace.rootSplit as WorkspaceItem as WorkspaceItemExt
      ).containerEl?.removeEventListener("scroll", this.slidingPanesListner);
      this.slidingPanesListner = null;
    }
  }

  //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/572
  private offsetLeft: number = 0;
  private offsetTop: number = 0;
  private addParentMoveObserver() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.addParentMoveObserver, "ExcalidrawView.addParentMoveObserver");
    
    const parent =
      getParentOfClass(this.containerEl, "popover") ??
      getParentOfClass(this.containerEl, "workspace-leaf");
    if (!parent) {
      return;
    }

    const inHoverEditorLeaf = parent.classList.contains("popover");

    this.offsetLeft = parent.offsetLeft;
    this.offsetTop = parent.offsetTop;

    //triggers when the leaf is moved in the workspace
    const observerFn = async (m: MutationRecord[]) => {
      (process.env.NODE_ENV === 'development') && DEBUGGING && debug(observerFn, `ExcalidrawView.parentMoveObserver, file:${this.file?.name}`);
      const target = m[0].target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const { offsetLeft, offsetTop } = target;
      if (offsetLeft !== this.offsetLeft || offsetTop !== this.offsetTop) {
        if (this.excalidrawAPI) {
          this.refreshCanvasOffset();
        }
        this.offsetLeft = offsetLeft;
        this.offsetTop = offsetTop;
      }
    };
    this.parentMoveObserver = DEBUGGING
      ? new CustomMutationObserver(observerFn, "parentMoveObserver")
      : new MutationObserver(observerFn)

    this.parentMoveObserver.observe(parent, {
      attributeOldValue: true,
      attributeFilter: inHoverEditorLeaf
        ? ["data-x", "data-y"]
        : ["class", "style"],
    });
  }

  private removeParentMoveObserver() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.removeParentMoveObserver, "ExcalidrawView.removeParentMoveObserver");
    if (this.parentMoveObserver) {
      this.parentMoveObserver.disconnect();
      this.parentMoveObserver = null;
    }
  }

  public setTheme(theme: string) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.setTheme, "ExcalidrawView.setTheme", theme);
    const api = this.excalidrawAPI;
    if (!api) {
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
      storeAction: "update",
    });
  }

  private prevTextMode: TextMode;
  private blockTextModeChange: boolean = false;
  public async changeTextMode(textMode: TextMode, reload: boolean = true) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.changeTextMode, "ExcalidrawView.changeTextMode", textMode, reload);
    if(this.compatibilityMode) return;
    if(this.blockTextModeChange) return;
    this.blockTextModeChange = true;
    this.textMode = textMode;
    if (textMode === TextMode.parsed) {
      this.actionButtons['isRaw'].hide();
      this.actionButtons['isParsed'].show();
    } else {
      this.actionButtons['isRaw'].show();
      this.actionButtons['isParsed'].hide();
    }
    if (this.toolsPanelRef && this.toolsPanelRef.current) {
      this.toolsPanelRef.current.setPreviewMode(textMode === TextMode.parsed);
    }
    const api = this.excalidrawAPI;
    if (api && reload) {
      await this.save();
      this.preventAutozoom();
      await this.excalidrawData.loadData(this.data, this.file, this.textMode);
      this.excalidrawData.scene.appState.theme = api.getAppState().theme;
      await this.loadDrawing(false);
      api.history.clear(); //to avoid undo replacing links with parsed text
    }
    this.prevTextMode = this.textMode;
    this.blockTextModeChange = false;
  }

  public autosaveFunction: Function;
  get autosaveInterval() {
    return DEVICE.isMobile ? this.plugin.settings.autosaveIntervalMobile : this.plugin.settings.autosaveIntervalDesktop;
  }

  public setupAutosaveTimer() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.setupAutosaveTimer, "ExcalidrawView.setupAutosaveTimer");

    const timer = async () => {
      if(!this.isLoaded) {
        this.autosaveTimer = window.setTimeout(
          timer,
          this.autosaveInterval,
        );
        return;
      }

      const api = this.excalidrawAPI;
      if (!api) {
        warningUnknowSeriousError();
        return;
      }
      const st = api.getAppState();
      const isEditing = st.editingElement !== null;
      const isDragging = st.newElement !== null;
      //this will reset positioning of the cursor in case due to the popup keyboard,
      //or the command palette, or some other unexpected reason the onResize would not fire...
      this.refreshCanvasOffset();
      if (
        this.isDirty() &&
        this.plugin.settings.autosave &&
        !this.semaphores.forceSaving &&
        !this.semaphores.autosaving &&
        !this.semaphores.embeddableIsEditingSelf &&
        !isEditing &&
        !isDragging //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/630
      ) {
        //console.log("autosave");
        this.autosaveTimer = null;
        if (this.excalidrawAPI) {
          this.semaphores.autosaving = true;
          //changed from await to then to avoid lag during saving of large file
          this.save().then(()=>this.semaphores.autosaving = false);
        } 
        this.autosaveTimer = window.setTimeout(
          timer,
          this.autosaveInterval,
        );
      } else {
        this.autosaveTimer = window.setTimeout(
          timer,
          this.plugin.activeExcalidrawView === this &&
            this.semaphores.dirty &&
            this.plugin.settings.autosave
            ? 1000 //try again in 1 second
            : this.autosaveInterval,
        );
      }
    };

    this.autosaveFunction = timer;
    this.resetAutosaveTimer();
  }


  private resetAutosaveTimer() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.resetAutosaveTimer, "ExcalidrawView.resetAutosaveTimer");
    if(!this.autosaveFunction) return;

    if (this.autosaveTimer) {
      window.clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    } // clear previous timer if one exists
    this.autosaveTimer = window.setTimeout(
      this.autosaveFunction,
      this.autosaveInterval,
    );

  }

  unload(): void {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.unload,`ExcalidrawView.unload, file:${this.file?.name}`);
    super.unload();
  }

  async onUnloadFile(file: TFile): Promise<void> {
    //deliberately not calling super.onUnloadFile() to avoid autosave (saved in unload)
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.onUnloadFile,`ExcalidrawView.onUnloadFile, file:${this.file?.name}`);   
  }

  private async forceSaveIfRequired():Promise<boolean> {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.forceSaveIfRequired,`ExcalidrawView.forceSaveIfRequired`);
    let watchdog = 0;
    let dirty = false;
    //if saving was already in progress
    //the function awaits the save to finish.
    while (this.semaphores.saving && watchdog++ < 10) {
      dirty = true;
      await sleep(20);
    }
    if(this.excalidrawAPI) {
      this.checkSceneVersion(this.excalidrawAPI.getSceneElements());
      if(this.isDirty()) {
        const path = this.file?.path;
        const plugin = this.plugin;
        window.setTimeout(() => {
          plugin.triggerEmbedUpdates(path)
        },400);
        dirty = true;
        await this.save(true,true,true);
      }
    }
    return dirty;
  }

  //onClose happens after onunload
  protected async onClose(): Promise<void> {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.onClose,`ExcalidrawView.onClose, file:${this.file?.name}`);

    await this.forceSaveIfRequired();
    if (this.excalidrawRoot) {
      this.excalidrawRoot.unmount();
      this.excalidrawRoot = null;
    }

    this.clearPreventReloadTimer();
    this.clearEmbeddableIsEditingSelfTimer();
    this.plugin.scriptEngine?.removeViewEAs(this);
    this.excalidrawAPI = null;
    if(this.draginfoDiv) {
      this.ownerDocument.body.removeChild(this.draginfoDiv);
      delete this.draginfoDiv;
    }
    if(this.canvasNodeFactory) {
      this.canvasNodeFactory.destroy();
    }
    this.canvasNodeFactory = null;
    this.embeddableLeafRefs.clear();
    this.embeddableRefs.clear();
    Object.values(this.actionButtons).forEach((el) => el.remove());
    this.actionButtons = {} as Record<ActionButtons, HTMLElement>;
    if (this.excalidrawData) {
      this.excalidrawData.destroy();
      this.excalidrawData = null;
    };
    if(this.exportDialog) {
      this.exportDialog.destroy();
      this.exportDialog = null;
    }
    this.hoverPreviewTarget = null;
    if(this.plugin.ea?.targetView === this) {
      this.plugin.ea.targetView = null;
    }
    if(this._hookServer?.targetView === this) {
      this._hookServer.targetView = null;
    }
    this._hookServer = null;
    this.containerEl.onWindowMigrated = null;
    this.packages = {react:null, reactDOM:null, excalidrawLib:null};

    let leafcount = 0;
    this.app.workspace.iterateAllLeaves(l=>{
      if(l === this.leaf) return;
      //@ts-ignore
      if(l.containerEl?.ownerDocument.defaultView === this.ownerWindow) {
        leafcount++;
      }
    })
    if(leafcount === 0) {
      this.plugin.deletePackage(this.ownerWindow);
    }

    this.lastMouseEvent = null;
    this.requestSave = null;
    //@ts-ignore
    this.leaf.tabHeaderInnerTitleEl.style.color = "";

    //super.onClose will unmount Excalidraw, need to save before that
    await super.onClose();
    tmpBruteForceCleanup(this);
  }

  //onunload is called first
  onunload() {
    super.onunload();
    this.destroyers.forEach((destroyer) => destroyer());
    this.restoreMobileLeaves();
    this.semaphores.viewunload = true;
    this.semaphores.popoutUnload = (this.ownerDocument !== document) && (this.ownerDocument.body.querySelectorAll(".workspace-tab-header").length === 0);

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
      window.clearInterval(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    this.autosaveFunction = null;

    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.onunload,`ExcalidrawView.onunload, completed`);
  }

  /**
   * reload is triggered by the modifyEventHandler in main.ts whenever an excalidraw drawing that is currently open
   * in a workspace leaf is modified. There can be two reasons for the file change:
   * - The user saves the drawing in the active view (either force-save or autosave)
   * - The file is modified by some other process, typically as a result of background sync, or because the drawing is open
   *   side by side, e.g. the canvas in one view and markdown view in the other.
   * @param fullreload
   * @param file
   * @returns
   */
  public async reload(fullreload: boolean = false, file?: TFile) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.reload,`ExcalidrawView.reload, file:${this.file?.name}, fullreload:${fullreload}, file:${file?.name}`);
    const loadOnModifyTrigger = file && file === this.file;

    //once you've finished editing the embeddable, the first time the file
    //reloads will be because of the embeddable changed the file,
    //there is a 2000 ms time window allowed for this, but typically this will
    //happen within 100 ms. When this happens the timer is cleared and the
    //next time reload triggers the file will be reloaded as normal.
    if (this.semaphores.embeddableIsEditingSelf) {
      //console.log("reload - embeddable is editing")
      if(this.editingSelfResetTimer) {
        this.clearEmbeddableIsEditingSelfTimer();
        this.semaphores.embeddableIsEditingSelf = false;
      }
      if(loadOnModifyTrigger) {
        this.data = await this.app.vault.read(this.file);
      }
      return;
    }
    //console.log("reload - embeddable is not editing")

    if (this.semaphores.preventReload) {
      this.semaphores.preventReload = false;
      return;
    }
    if (this.semaphores.saving) return;
    this.lastLoadedFile = null;
    this.actionButtons['save'].querySelector("svg").removeClass("excalidraw-dirty");
    if (this.compatibilityMode) {
      this.clearDirty();
      return;
    }
    const api = this.excalidrawAPI;
    if (!this.file || !api) {
      return;
    }
    
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

  async zoomToElementId(id: string, hasGroupref:boolean) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.zoomToElementId, "ExcalidrawView.zoomToElementId", id, hasGroupref);
    let counter = 0;
    while (!this.excalidrawAPI && counter++<100) await sleep(50); //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/734
    const api = this.excalidrawAPI;
    if (!api) {
      return;
    }
    const sceneElements = api.getSceneElements();

    let elements = sceneElements.filter((el: ExcalidrawElement) => el.id === id);
    if(elements.length === 0) {
      const frame = getFrameBasedOnFrameNameOrId(id, sceneElements);
      if (frame) {
        elements = [frame];
      } else {
        return;
      }
    }
    if(hasGroupref) {
      const groupElements = this.plugin.ea.getElementsInTheSameGroupWithElement(elements[0],sceneElements)
      if(groupElements.length>0) {
        elements = groupElements;
      }
    }

    this.preventAutozoom();
    this.zoomToElements(!api.getAppState().viewModeEnabled, elements);
  }

  setEphemeralState(state: any): void {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.setEphemeralState, "ExcalidrawView.setEphemeralState", state);
    if (!state) {
      return;
    }

    if (state.rename === "all") {
      //@ts-ignore
      this.app.fileManager.promptForFileRename(this.file);
      return;
    }

    let query: string[] = null;

    if (
      state.match &&
      state.match.content &&
      state.match.matches &&
      state.match.matches.length >= 1 &&
      state.match.matches[0].length === 2
    ) {
      query = [
        state.match.content.substring(
          state.match.matches[0][0],
          state.match.matches[0][1],
        ),
      ];
    }

    const waitForExcalidraw = async () => {
      let counter = 0;
      while (
        (this.semaphores.justLoaded ||
        !this.isLoaded ||
        !this.excalidrawAPI ||
        this.excalidrawAPI?.getAppState()?.isLoading) &&
        counter++<100
      ) await sleep(50); //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/734
    }

    const filenameParts = getEmbeddedFilenameParts(
      (state.subpath && state.subpath.startsWith("#^group") && !state.subpath.startsWith("#^group="))
        ? "#^group=" + state.subpath.substring(7)
        : (state.subpath && state.subpath.startsWith("#^area") && !state.subpath.startsWith("#^area="))
          ? "#^area=" + state.subpath.substring(6)
          : state.subpath
    );
    if(filenameParts.hasBlockref) {
      window.setTimeout(async () => {
        await waitForExcalidraw();
        if(filenameParts.blockref && !filenameParts.hasGroupref) {
          if(!this.getScene()?.elements.find((el:ExcalidrawElement)=>el.id === filenameParts.blockref)) {
            const cleanQuery = cleanSectionHeading(filenameParts.blockref).replaceAll(" ","");
            const blocks = await this.getBackOfTheNoteBlocks();
            if(blocks.includes(cleanQuery)) {
              this.setMarkdownView(state);
              return;
            }
          }
        }
        window.setTimeout(()=>this.zoomToElementId(filenameParts.blockref, filenameParts.hasGroupref));
      });
    }

    if(filenameParts.hasSectionref) {
      query = [`# ${filenameParts.sectionref}`]
    } else if (state.line && state.line > 0) {
      query = [this.data.split("\n")[state.line - 1]];
    }

    if (query) {
      window.setTimeout(async () => {
        await waitForExcalidraw();

        const api = this.excalidrawAPI;
        if (!api) return;
        if (api.getAppState().isLoading) return;
        
        const elements = api.getSceneElements() as ExcalidrawElement[];

        if(query.length === 1 && query[0].startsWith("[")) {
          const partsArray = REGEX_LINK.getResList(query[0]);
          let parts = partsArray[0];     
          if(parts) {
            const linkText = REGEX_LINK.getLink(parts);
            if(linkText) {
              const file = this.plugin.app.metadataCache.getFirstLinkpathDest(linkText, this.file.path);
              if(file) {
                let fileId:FileId[] = [];
                this.excalidrawData.files.forEach((ef,fileID) => {
                  if(ef.file?.path === file.path) fileId.push(fileID);
                });
                if(fileId.length>0) {
                  const images = elements.filter(el=>el.type === "image" && fileId.includes(el.fileId));
                  if(images.length>0) {
                    this.preventAutozoom();
                    window.setTimeout(()=>this.zoomToElements(!api.getAppState().viewModeEnabled, images));
                  }
                }
              }
            }
          }
        }
  
        if(!this.selectElementsMatchingQuery(
          elements,
          query,
          !api.getAppState().viewModeEnabled,
          filenameParts.hasSectionref,
          filenameParts.hasGroupref
        )) {
          const cleanQuery = cleanSectionHeading(query[0]);
          const sections = await this.getBackOfTheNoteSections();
          if(sections.includes(cleanQuery) || this.data.includes(query[0])) {
            this.setMarkdownView(state);
            return;
          }
        }
      });
    }

    //super.setEphemeralState(state);
  }

  // clear the view content
  clear() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.clear, "ExcalidrawView.clear");
    this.canvasNodeFactory.purgeNodes();
    this.embeddableRefs.clear();
    this.embeddableLeafRefs.clear();
    
    delete this.exportDialog;
    const api = this.excalidrawAPI;
    if (!api) {
      return;
    }
    if (this.activeLoader) {
      this.activeLoader.terminate = true;
      this.activeLoader = null;
    }
    this.nextLoader = null;
    api.resetScene();
    this.previousSceneVersion = 0;
  }

  public isLoaded: boolean = false;
  async setViewData(data: string, clear: boolean = false) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.setViewData, "ExcalidrawView.setViewData", data, clear);
    //I am using last loaded file to control when the view reloads.
    //It seems text file view gets the modified file event after sync before the modifyEventHandler in main.ts
    //reload can only be triggered via reload()
    if(this.lastLoadedFile === this.file) return;
    this.isLoaded = false;
    if(!this.file) return;
    if(this.plugin.settings.showNewVersionNotification) checkExcalidrawVersion();
    if(isMaskFile(this.plugin,this.file)) {
      const notice = new Notice(t("MASK_FILE_NOTICE"), 5000);
      //add click and hold event listner to the notice
      let noticeTimeout:number;
      this.registerDomEvent(notice.noticeEl,"pointerdown", (ev:MouseEvent) => {
        noticeTimeout = window.setTimeout(()=>{
          window.open("https://youtu.be/uHFd0XoHRxE");
        },1000);
      })
      this.registerDomEvent(notice.noticeEl,"pointerup", (ev:MouseEvent) => {
        window.clearTimeout(noticeTimeout);
      })
    }
    if (clear) {
      this.clear();
    }
    this.lastSaveTimestamp = this.file.stat.mtime;
    this.lastLoadedFile = this.file;
    data = this.data = data.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
    this.app.workspace.onLayoutReady(async () => {
      (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.setViewData, `ExcalidrawView.setViewData > app.workspace.onLayoutReady, file:${this.file?.name}, isActiveLeaf:${this?.app?.workspace?.activeLeaf === this.leaf}`);
      //the leaf moved to a window and ExcalidrawView was destructed
      //Happens during Obsidian startup if View opens in new window.
      if(!this?.app) {
        return;
      }
      let counter = 0;
      while ((!this.file || !this.plugin.fourthFontLoaded) && counter++<50) await sleep(50);
      if(!this.file) return;
      this.compatibilityMode = this.file.extension === "excalidraw";
      await this.plugin.loadSettings();
      if (this.compatibilityMode) {
        this.plugin.enableLegacyFilePopoverObserver();
        this.actionButtons['isRaw'].hide();
        this.actionButtons['isParsed'].hide();
        this.actionButtons['link'].hide();
        this.textMode = TextMode.raw;
        await this.excalidrawData.loadLegacyData(data, this.file);
        if (!this.plugin.settings.compatibilityMode) {
          new Notice(t("COMPATIBILITY_MODE"), 4000);
        }
        this.excalidrawData.disableCompression = true;
      } else {
        this.actionButtons['link'].show();
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
          if(e.message === ERROR_IFRAME_CONVERSION_CANCELED) {
            this.setMarkdownView();
            return;
          } 
          const file = this.file;
          const plugin = this.plugin;
          const leaf = this.leaf;
          (async () => {
            let confirmation:boolean = true;
            let counter = 0;
            const timestamp = Date.now();
            while (!imageCache.isReady() && confirmation) {
              const message = `You've been now waiting for <b>${Math.round((Date.now()-timestamp)/1000)}</b> seconds. `
              imageCache.initializationNotice = true;
              const confirmationPrompt = new ConfirmationPrompt(plugin,
                `${counter>0
                  ? counter%4 === 0
                    ? message + "The CACHE is still loading.<br><br>"
                    : counter%4 === 1
                      ? message + "Watch the top right corner for the notification.<br><br>"
                      : counter%4 === 2
                        ? message + "I really, really hope the backup will work for you! <br><br>"
                        : message + "I am sorry, it is taking a while, there is not much I can do... <br><br>"
                  : ""}${t("CACHE_NOT_READY")}`);
              confirmation = await confirmationPrompt.waitForClose
              counter++;
            }

            const drawingBAK = await imageCache.getBAKFromCache(file.path);
            if (!drawingBAK) {
              new Notice(
                `Error loading drawing:\n${e.message}${
                  e.message === "Cannot read property 'index' of undefined"
                    ? "\n'# Drawing' section is likely missing"
                    : ""
                }\n\nTry manually fixing the file or restoring an earlier version from sync history.`,
                10000,
              );
              return;
            }
            const confirmationPrompt = new ConfirmationPrompt(plugin,t("BACKUP_AVAILABLE"));
            confirmationPrompt.waitForClose.then(async (confirmed) => {
              if (confirmed) {
                await this.app.vault.modify(file, drawingBAK);
                //@ts-ignore
                plugin.excalidrawFileModes[leaf.id || file.path] = VIEW_TYPE_EXCALIDRAW;
                setExcalidrawView(leaf);
              } 
            });


          })();
          this.setMarkdownView();
          return;
        }
      }
      await this.loadDrawing(true);

      if(this.plugin.ea.onFileOpenHook) {
        const tempEA = getEA(this);
        try {
        await this.plugin.ea.onFileOpenHook({
          ea: tempEA,
          excalidrawFile: this.file,
          view: this, 
        });
        } catch(e) {
          errorlog({ where: "ExcalidrawView.setViewData.onFileOpenHook", error: e });
        } finally {
          tempEA.destroy();
        }
      }

      const script = this.excalidrawData.getOnLoadScript();
      if(script) {
        const scriptname = this.file.basename+ "-onlaod-script";
        const runScript = () => {
          if(!this.excalidrawAPI) { //need to wait for Excalidraw to initialize
            window.setTimeout(runScript.bind(this),200);
            return;
          }
          this.plugin.scriptEngine.executeScript(this,script,scriptname,this.file);
        }
        runScript();
      }
      this.isLoaded = true;
    });
  }

  private getGridColor(bgColor: string, st: AppState):{Bold: string, Regular: string} {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.getGridColor, "ExcalidrawView.getGridColor", bgColor, st);
    const cm = this.plugin.ea.getCM(bgColor);
    const isDark = cm.isDark();
    const Regular = (isDark ? cm.lighterBy(7) : cm.darkerBy(7)).stringHEX({alpha: false});
    const Bold = (isDark ? cm.lighterBy(14) : cm.darkerBy(14)).stringHEX({alpha: false});
    return {Bold, Regular};
  }

  public activeLoader: EmbeddedFilesLoader = null;
  private nextLoader: EmbeddedFilesLoader = null;
  public async loadSceneFiles(isThemeChange: boolean = false) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.loadSceneFiles, "ExcalidrawView.loadSceneFiles", isThemeChange);
    if (!this.excalidrawAPI) {
      return;
    }
    const loader = new EmbeddedFilesLoader(this.plugin);

    const runLoader = (l: EmbeddedFilesLoader) => {
      this.nextLoader = null;
      this.activeLoader = l;
      l.loadSceneFiles(
        this.excalidrawData,
        (files: FileData[], isDark: boolean, final:boolean = true) => {
          if (!files) {
            return;
          }          
          addFiles(files, this, isDark);
          if(!final) return;
          this.activeLoader = null;
          if (this.nextLoader) {
            runLoader(this.nextLoader);
          } else {
            //in case one or more files have not loaded retry later hoping that sync has delivered the file in the mean time.
            this.excalidrawData.getFiles().some(ef=>{
              if(ef && !ef.file && ef.attemptCounter<30) {
                const currentFile = this.file.path;
                window.setTimeout(async ()=>{
                  if(this && this.excalidrawAPI && currentFile === this.file.path) {
                    this.loadSceneFiles();
                  }
                },2000)
                return true;
              }
              return false;
            })
          }
        },0,isThemeChange,
      );
    };
    if (!this.activeLoader) {
      runLoader(loader);
    } else {
      this.nextLoader = loader;
    }
  }

  public async synchronizeWithData(inData: ExcalidrawData) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.synchronizeWithData, "ExcalidrawView.synchronizeWithData", inData);
    if(this.semaphores.embeddableIsEditingSelf) {
      return;
    }
    //console.log("synchronizeWithData - embeddable is not editing");
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
      const sceneElements = this.excalidrawAPI.getSceneElementsIncludingDeleted()
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
      this.updateScene({elements: sceneElements, storeAction: "capture"});
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

  /**
   *
   * @param justloaded - a flag to trigger zoom to fit after the drawing has been loaded
   */
  private async loadDrawing(justloaded: boolean, deletedElements?: ExcalidrawElement[]) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.loadDrawing, "ExcalidrawView.loadDrawing", justloaded, deletedElements);
    const excalidrawData = this.excalidrawData.scene;
    this.semaphores.justLoaded = justloaded;
    this.clearDirty();
    const om = this.excalidrawData.getOpenMode();
    this.semaphores.preventReload = false;
    const penEnabled =
      this.plugin.settings.defaultPenMode === "always" ||
      (this.plugin.settings.defaultPenMode === "mobile" && DEVICE.isMobile);
    const api = this.excalidrawAPI;
    if (api) {
      //isLoaded flags that a new file is being loaded, isLoaded will be true after loadDrawing completes
      const viewModeEnabled = !this.isLoaded
        ? (excalidrawData.elements.length > 0 ? om.viewModeEnabled : false)
        : api.getAppState().viewModeEnabled;
      const zenModeEnabled = !this.isLoaded
        ? om.zenModeEnabled
        : api.getAppState().zenModeEnabled;
      //debug({where:"ExcalidrawView.loadDrawing",file:this.file.name,dataTheme:excalidrawData.appState.theme,before:"updateScene"})
      //api.setLocalFont(this.plugin.settings.experimentalEnableFourthFont);

      this.updateScene(
        {
          elements: excalidrawData.elements.concat(deletedElements??[]), //need to preserve deleted elements during autosave if images, links, etc. are updated
          files: excalidrawData.files,
          storeAction: justloaded ? "update" : "update", //was none, but I think based on a false understanding of none
        },
        justloaded
      );
      this.updateScene(
        {
          //elements: excalidrawData.elements.concat(deletedElements??[]), //need to preserve deleted elements during autosave if images, links, etc. are updated
          appState: {
            ...excalidrawData.appState,
            ...this.excalidrawData.selectedElementIds //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/609
              ? this.excalidrawData.selectedElementIds
              : {},
            zenModeEnabled,
            viewModeEnabled,
            linkOpacity: this.excalidrawData.getLinkOpacity(),
            trayModeEnabled: this.plugin.settings.defaultTrayMode,
            penMode: penEnabled,
            penDetected: penEnabled,
            allowPinchZoom: this.plugin.settings.allowPinchZoom,
            allowWheelZoom: this.plugin.settings.allowWheelZoom,
            pinnedScripts: this.plugin.settings.pinnedScripts,
            customPens: this.plugin.settings.customPens.slice(0,this.plugin.settings.numberOfCustomPens),
          },
          storeAction: justloaded ? "update" : "update", //was none, but I think based on a false understanding of none
        },
      );
      if (
        this.app.workspace.getActiveViewOfType(ExcalidrawView) === this.leaf.view &&
        this.excalidrawWrapperRef
      ) {
        //.firstElmentChild solves this issue: https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/346
        this.excalidrawWrapperRef.current?.firstElementChild?.focus();
      }
      //debug({where:"ExcalidrawView.loadDrawing",file:this.file.name,before:"this.loadSceneFiles"});
      this.onAfterLoadScene(justloaded);
    } else {
      this.instantiateExcalidraw({
        elements: excalidrawData.elements,
        appState: {
          ...excalidrawData.appState,
          zenModeEnabled: om.zenModeEnabled,
          viewModeEnabled: excalidrawData.elements.length > 0 ? om.viewModeEnabled : false,
          linkOpacity: this.excalidrawData.getLinkOpacity(),
          trayModeEnabled: this.plugin.settings.defaultTrayMode,
          penMode: penEnabled,
          penDetected: penEnabled,
          allowPinchZoom: this.plugin.settings.allowPinchZoom,
          allowWheelZoom: this.plugin.settings.allowWheelZoom,
          pinnedScripts: this.plugin.settings.pinnedScripts,
          customPens: this.plugin.settings.customPens.slice(0,this.plugin.settings.numberOfCustomPens),
        },
        files: excalidrawData.files,
        libraryItems: await this.getLibrary(),
      });
      //files are loaded when excalidrawAPI is mounted
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
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.isEditedAsMarkdownInOtherView, "ExcalidrawView.isEditedAsMarkdownInOtherView");
    //if the user is editing the same file in markdown mode, do not compress it
    const leaves = app.workspace.getLeavesOfType("markdown");
    return (
      leaves.filter((leaf) => (leaf.view as MarkdownView).file === this.file)
        .length > 0
    );
  }

  private onAfterLoadScene(justloaded: boolean) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.onAfterLoadScene, "ExcalidrawView.onAfterLoadScene");
    this.loadSceneFiles();
    this.updateContainerSize(null, true, justloaded);
    this.initializeToolsIconPanelAfterLoading();
  }

  public setDirty(location?:number) {
    if(this.semaphores.saving) return; //do not set dirty if saving
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.setDirty,`ExcalidrawView.setDirty, location:${location}`);
    this.semaphores.dirty = this.file?.path;
    this.actionButtons['save'].querySelector("svg").addClass("excalidraw-dirty");
    if(!this.semaphores.viewunload && this.toolsPanelRef?.current) {
      this.toolsPanelRef.current.setDirty(true);
    }
    if(!DEVICE.isMobile) {
      if(requireApiVersion("0.16.0")) {
        //@ts-ignore
        this.leaf.tabHeaderInnerTitleEl.style.color="var(--color-accent)"
      }
    }
  }

  public isDirty() {
    return Boolean(this.semaphores?.dirty) && (this.semaphores.dirty === this.file?.path);
  }

  public clearDirty() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.clearDirty,`ExcalidrawView.clearDirty`);
    if(this.semaphores.viewunload) return;
    const api = this.excalidrawAPI;
    if (!api) {
      return;
    }
    this.semaphores.dirty = null;
    if(this.toolsPanelRef?.current) {
      this.toolsPanelRef.current.setDirty(false);
    }
    const el = api.getSceneElements();
    if (el) {
      this.previousSceneVersion = this.getSceneVersion(el);
    }
    this.actionButtons['save'].querySelector("svg").removeClass("excalidraw-dirty");
    if(!DEVICE.isMobile) {
      if(requireApiVersion("0.16.0")) {
        //@ts-ignore
        this.leaf.tabHeaderInnerTitleEl.style.color=""
      }
    }
  }

  public async initializeToolsIconPanelAfterLoading() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.initializeToolsIconPanelAfterLoading,`ExcalidrawView.initializeToolsIconPanelAfterLoading`);
    if(this.semaphores.viewunload) return;
    const api = this.excalidrawAPI;
    if (!api) {
      return;
    }
    const st = api.getAppState();
    //since Obsidian 1.6.0 onLayoutReady calls happen asynchronously compared to starting Excalidraw view
    //these validations are just to make sure that initialization is complete
    let counter = 0;
    while(!this.plugin.scriptEngine && counter++<50) {
      sleep(50);
    }

    const panel = this.toolsPanelRef?.current;
    if (!panel || !this.plugin.scriptEngine) {
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
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.getDisplayText, "ExcalidrawView.getDisplayText", this.file?.basename ?? "NOFILE");
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

  async setMarkdownView(eState?: any) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.setMarkdownView, "ExcalidrawView.setMarkdownView", eState);
    //save before switching to markdown view.
    //this would also happen onClose, but it does not hurt to save it here
    //this way isDirty() will return false in onClose, thuse
    //saving here will not result in double save
    //there was a race condition when clicking a link with a section or block reference to the back-of-the-note
    //that resulted in a call to save after the view has been destroyed
    //The sleep is required for metadata cache to be updated with the location of the block or section
    await this.forceSaveIfRequired();
    await sleep(200); //dirty hack to wait for Obsidian metadata to be updated, note that save may have been triggered elsewhere already
    this.plugin.excalidrawFileModes[this.id || this.file.path] = "markdown";
    this.plugin.setMarkdownView(this.leaf, eState);
  }

  public async openAsMarkdown(eState?: any) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.openAsMarkdown, "ExcalidrawView.openAsMarkdown", eState);
    if (this.plugin.settings.compress && this.plugin.settings.decompressForMDView) {
      this.excalidrawData.disableCompression = true;
      await this.save(true, true, true);
    } else if (this.isDirty()) {
      await this.save(true, true, true);
    }
    this.setMarkdownView(eState);
  }

  public async convertExcalidrawToMD() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.convertExcalidrawToMD, "ExcalidrawView.convertExcalidrawToMD");
    await this.save();
    const file = await this.plugin.convertSingleExcalidrawToMD(this.file);
    await sleep(250); //dirty hack to wait for Obsidian metadata to be updated
    this.plugin.openDrawing(
      file,
      "active-pane",
      true
    );
  }

  public convertTextElementToMarkdown(textElement: ExcalidrawTextElement, containerElement: ExcalidrawElement) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.convertTextElementToMarkdown, "ExcalidrawView.convertTextElementToMarkdown", textElement, containerElement);
    if(!textElement) return;
    const prompt = new Prompt(
      this.app,
      "Filename",
      "",
      "Leave blank to cancel this action",
    );
    prompt.openAndGetValue(async (filename: string) => {
      if (!filename) {
        return;
      }
      filename = `${filename}.md`;
      const folderpath = splitFolderAndFilename(this.file.path).folderpath;
      await checkAndCreateFolder(folderpath); //create folder if it does not exist
      const fname = getNewUniqueFilepath(
        this.app.vault,
        filename,
        folderpath,
      );
      const text:string[] = [];
      if(containerElement && containerElement.link) text.push(containerElement.link);
      text.push(textElement.rawText);
      const f = await this.app.vault.create(
        fname,
        text.join("\n"),
      );
      if(f) {
        const ea:ExcalidrawAutomate = getEA(this);
        const elements = containerElement ? [textElement,containerElement] : [textElement];
        ea.copyViewElementsToEAforEditing(elements);
        ea.getElements().forEach(el=>el.isDeleted = true);
        const [x,y,w,h] = containerElement
          ? [containerElement.x,containerElement.y,containerElement.width,containerElement.height]
          : [textElement.x, textElement.y, MAX_IMAGE_SIZE,MAX_IMAGE_SIZE];
        const id = ea.addEmbeddable(x,y,w,h, undefined,f);
        if(containerElement) {
          ["backgroundColor", "fillStyle","roughness","roundness","strokeColor","strokeStyle","strokeWidth"].forEach((prop)=>{
            //@ts-ignore
            ea.getElement(id)[prop] = containerElement[prop];
          });
        }
        ea.getElement(id)
        await ea.addElementsToView();
        ea.destroy();
      }
    });
  }
  
  async addYouTubeThumbnail(link:string) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.addYouTubeThumbnail, "ExcalidrawView.addYouTubeThumbnail", link);
    const thumbnailLink = await getYouTubeThumbnailLink(link);
    const ea = getEA(this) as ExcalidrawAutomate;
    const id = await ea.addImage(0,0,thumbnailLink);
    //@ts-ignore
    ea.getElement(id).link = link;
    await ea.addElementsToView(true,true,true)
    ea.destroy();

  }

  async addImageWithURL(link:string) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.addImageWithURL, "ExcalidrawView.addImageWithURL", link);
    const ea = getEA(this) as ExcalidrawAutomate;
    await ea.addImage(0,0,link);
    await ea.addElementsToView(true,true,true);
    ea.destroy();
  }

  async addImageSaveToVault(link:string) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.addImageSaveToVault, "ExcalidrawView.addImageSaveToVault", link);
    const ea = getEA(this) as ExcalidrawAutomate;
    const mimeType = getMimeType(getURLImageExtension(link));
    const dataURL = await getDataURLFromURL(link,mimeType,3000);
    const fileId = await generateIdFromFile((new TextEncoder()).encode(dataURL as string))
    const file = await this.excalidrawData.saveDataURLtoVault(dataURL,mimeType,fileId);
    if(!file) {
      new Notice(t("ERROR_SAVING_IMAGE"));
      ea.destroy();
      return;
    }
    await ea.addImage(0,0,file);
    await ea.addElementsToView(true,true,true);
    ea.destroy();
  }

  async addTextWithIframely(text:string) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.addTextWithIframely, "ExcalidrawView.addTextWithIframely", text);
    const id = await this.addText(text);
    const url = `http://iframely.server.crestify.com/iframely?url=${text}`;
    try {
      const data = JSON.parse(await request({ url }));
      if (!data || data.error || !data.meta?.title) {
        return;
      }
      const ea = getEA(this) as ExcalidrawAutomate;
      const el = ea
        .getViewElements()
        .filter((el) => el.id === id);
      if (el.length === 1) {
        //@ts-ignore
        el[0].text = el[0].originalText = el[0].rawText =
            `[${data.meta.title}](${text})`;
        ea.copyViewElementsToEAforEditing(el);
        await ea.addElementsToView(false, false, false);
        ea.destroy();
      }
    } catch(e) {
    };
  }

  onPaneMenu(menu: Menu, source: string): void {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.onPaneMenu, "ExcalidrawView.onPaneMenu", menu, source);
    if(this.excalidrawAPI && this.getViewSelectedElements().some(el=>el.type==="text")) {
      menu.addItem(item => {
        item
          .setTitle(t("OPEN_LINK"))
          .setIcon("external-link")
          .setSection("pane")
          .onClick(evt => {
            this.handleLinkClick(evt as MouseEvent);
          });
      })
    }
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
          .setTitle(t("EXPORT_IMAGE"))
          .setIcon(EXPORT_IMG_ICON_NAME)
          .setSection("pane")
          .onClick(async (ev) => {
            if (!this.excalidrawAPI || !this.file) {
              return;
            }
            if(!this.exportDialog) {
              this.exportDialog = new ExportDialog(this.plugin, this,this.file);
              this.exportDialog.createForm();
            }
            this.exportDialog.open();
          })
          .setSection("pane");
      })
      .addItem(item => {
        item
          .setTitle(t("INSTALL_SCRIPT_BUTTON"))
          .setIcon(SCRIPTENGINE_ICON_NAME)
          .setSection("pane")
          .onClick(()=>{
            new ScriptInstallPrompt(this.plugin).open();
          })
      })
    super.onPaneMenu(menu, source);
  }

  async getLibrary() {
    const data: any = this.plugin.getStencilLibrary();
    return data?.library ? data.library : data?.libraryItems ?? [];
  }
  
  public setCurrentPositionToCenter(){
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.setCurrentPositionToCenter, "ExcalidrawView.setCurrentPositionToCenter");
    const api = this.excalidrawAPI as ExcalidrawImperativeAPI;
    if (!api) {
      return;
    }
    const st = api.getAppState();
    const { width, height, offsetLeft, offsetTop } = st;
    this.currentPosition = viewportCoordsToSceneCoords(
      {
        clientX: width / 2 + offsetLeft,
        clientY: height / 2 + offsetTop,
      },
      st,
    );
  };

  private getSelectedTextElement(): SelectedElementWithLink{
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.getSelectedTextElement, "ExcalidrawView.getSelectedTextElement");
    const api = this.excalidrawAPI;
    if (!api) {
      return { id: null, text: null };
    }
    if (api.getAppState().viewModeEnabled) {
      if (this.selectedTextElement) {
        const retval = this.selectedTextElement;
        this.selectedTextElement = null;
        return retval;
      }
      //return { id: null, text: null };
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

    if (["image","arrow"].contains(selectedElement[0].type)) {
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

  private getSelectedImageElement(): SelectedImage {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.getSelectedImageElement, "ExcalidrawView.getSelectedImageElement");
    const api = this.excalidrawAPI;
    if (!api) {
      return { id: null, fileId: null };
    }
    if (api.getAppState().viewModeEnabled) {
      if (this.selectedImageElement) {
        const retval = this.selectedImageElement;
        this.selectedImageElement = null;
        return retval;
      }
      //return { id: null, fileId: null };
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

  private getSelectedElementWithLink(): { id: string; text: string } {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.getSelectedElementWithLink, "ExcalidrawView.getSelectedElementWithLink");
    const api = this.excalidrawAPI;
    if (!api) {
      return { id: null, text: null };
    }
    if (api.getAppState().viewModeEnabled) {
      if (this.selectedElementWithLink) {
        const retval = this.selectedElementWithLink;
        this.selectedElementWithLink = null;
        return retval;
      }
      //return { id: null, text: null };
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

  public async addLink(
    markdownlink: string,
    path: string,
    alias: string,
  ) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.addLink, "ExcalidrawView.addLink", markdownlink, path, alias);
    const api = this.excalidrawAPI as ExcalidrawImperativeAPI;
    const st = api.getAppState();
    if(
      !st.selectedElementIds ||
      (st.selectedElementIds && Object.keys(st.selectedElementIds).length !== 1)
    ) {
      this.addText(markdownlink);
      return;
    }
    const selectedElementId = Object.keys(api.getAppState().selectedElementIds)[0];
    const selectedElement = api.getSceneElements().find(el=>el.id === selectedElementId);
    if(!selectedElement || (selectedElement && selectedElement.link !== null)) {
      if(selectedElement) new Notice("Selected element already has a link. Inserting link as text.");
      this.addText(markdownlink);
      return;
    }
    const ea = getEA(this) as ExcalidrawAutomate;
    ea.copyViewElementsToEAforEditing([selectedElement]);
    ea.getElement(selectedElementId).link = markdownlink;
    await ea.addElementsToView(false, true);
    ea.destroy();
  }

  public async addText (
    text: string,
    fontFamily?: 1 | 2 | 3 | 4,
    save: boolean = true
  ): Promise<string> {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.addText, "ExcalidrawView.addText", text, fontFamily, save);
    const api = this.excalidrawAPI as ExcalidrawImperativeAPI;
    if (!api) {
      return;
    }
    const st: AppState = api.getAppState();
    const ea = getEA(this);
    ea.style.strokeColor = st.currentItemStrokeColor ?? "black";
    ea.style.opacity = st.currentItemOpacity ?? 1;
    ea.style.fontFamily = fontFamily ?? st.currentItemFontFamily ?? 1;
    ea.style.fontSize = st.currentItemFontSize ?? 20;
    ea.style.textAlign = st.currentItemTextAlign ?? "left";
    
    const { width, height } = st;

    const top = viewportCoordsToSceneCoords(
      {
        clientX: 0,
        clientY: 0,
      },
      st,
    );
    const bottom = viewportCoordsToSceneCoords(
      {
        clientX: width,
        clientY: height,
      },
      st,
    );
    const isPointerOutsideVisibleArea = top.x>this.currentPosition.x || bottom.x<this.currentPosition.x || top.y>this.currentPosition.y || bottom.y<this.currentPosition.y;

    const id = ea.addText(this.currentPosition.x, this.currentPosition.y, text);
    await this.addElements(ea.getElements(), isPointerOutsideVisibleArea, save, undefined, true);
    ea.destroy();
    return id;
  };

  public async addElements(
    newElements: ExcalidrawElement[],
    repositionToCursor: boolean = false,
    save: boolean = false,
    images: any,
    newElementsOnTop: boolean = false,
    shouldRestoreElements: boolean = false,
  ): Promise<boolean> {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.addElements, "ExcalidrawView.addElements", newElements, repositionToCursor, save, images, newElementsOnTop, shouldRestoreElements);
    const api = this.excalidrawAPI as ExcalidrawImperativeAPI;
    if (!api) {
      return false;
    }
    const elementsMap = arrayToMap(api.getSceneElements());
    const textElements = newElements.filter((el) => el.type == "text");
    for (let i = 0; i < textElements.length; i++) {
      const textElement = textElements[i] as Mutable<ExcalidrawTextElement>;
      const {parseResult, link} =
        await this.excalidrawData.addTextElement(
          textElement.id,
          //@ts-ignore
          textElement.text,
          //@ts-ignore
          textElement.rawText, //TODO: implement originalText support in ExcalidrawAutomate
        );
      if (link) {
        //@ts-ignore
        textElement.link = link;
      }
      if (this.textMode === TextMode.parsed && !textElement?.isDeleted) {
        const {text, x, y, width, height} = refreshTextDimensions(
          textElement,null,elementsMap,parseResult
        );
        textElement.text = text;
        textElement.originalText = parseResult;
        textElement.x = x;
        textElement.y = y;
        textElement.width = width;
        textElement.height = height;
      }
    }

    if (repositionToCursor) {
      newElements = repositionElementsToCursor(
        newElements,
        this.currentPosition,
        true,
      );
    }

    const newIds = newElements.map((e) => e.id);
    const el: ExcalidrawElement[] = api.getSceneElements() as ExcalidrawElement[];
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
    
    this.updateScene(
      {
        elements,
        storeAction: "capture",
      },
      shouldRestoreElements,
    );

    if (images && Object.keys(images).length >0) {
      const files: BinaryFileData[] = [];
      Object.keys(images).forEach((k) => {
        files.push({
          mimeType: images[k].mimeType,
          id: images[k].id,
          dataURL: images[k].dataURL,
          created: images[k].created,
        });
        if (images[k].file || images[k].isHyperLink || images[k].isLocalLink) {
          const embeddedFile = new EmbeddedFile(
            this.plugin,
            this.file.path,
            images[k].isHyperLink && !images[k].isLocalLink
              ? images[k].hyperlink
              : images[k].file,
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
    api.updateContainerSize(api.getSceneElements().filter(el => newIds.includes(el.id)).filter(isContainer));
    if (save) {
      await this.save(false); //preventReload=false will ensure that markdown links are paresed and displayed correctly
    } else {
      this.setDirty(5);
    }
    return true;
  };

  public getScene (selectedOnly?: boolean) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.getScene, "ExcalidrawView.getScene", selectedOnly);
/*    if (this.lastSceneSnapshot) {
      return this.lastSceneSnapshot;
    }*/
    const api = this.excalidrawAPI;
    if (!api) {
      return null;
    }
    const el: ExcalidrawElement[] = selectedOnly ? this.getViewSelectedElements() : api.getSceneElements();
    const st: AppState = api.getAppState();
    const files = {...api.getFiles()};

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
      source: GITHUB_RELEASES+PLUGIN_VERSION,
      elements: el,
      //see also ExcalidrawAutomate async create(
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
        currentItemStartArrowhead: st.currentItemStartArrowhead,
        currentItemEndArrowhead: st.currentItemEndArrowhead,
        scrollX: st.scrollX,
        scrollY: st.scrollY,
        zoom: st.zoom,
        currentItemRoundness: st.currentItemRoundness,
        gridSize: st.gridSize,
        gridStep: st.gridStep,
        gridModeEnabled: st.gridModeEnabled,
        gridColor: st.gridColor,
        colorPalette: st.colorPalette,
        currentStrokeOptions: st.currentStrokeOptions,
        frameRendering: st.frameRendering,
        objectsSnapModeEnabled: st.objectsSnapModeEnabled,
      },
      prevTextMode: this.prevTextMode,
      files,
    };
  };

  /**
   * ExcalidrawAPI refreshes canvas offsets
   * @returns 
   */
  private refreshCanvasOffset() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.refreshCanvasOffset, "ExcalidrawView.refreshCanvasOffset");
    if(this.contentEl.clientWidth === 0 || this.contentEl.clientHeight === 0) return;
    const api = this.excalidrawAPI;
    if (!api) {
      return;
    }
    api.refresh();
  };

  // depricated. kept for backward compatibility. e.g. used by the Slideshow plugin
  // 2024.05.03
  public refresh() {
    this.refreshCanvasOffset();
  }

  private clearHoverPreview() {
    if (this.hoverPreviewTarget) {
      (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.clearHoverPreview, "ExcalidrawView.clearHoverPreview", this);
      const event = new MouseEvent("click", {
        view: this.ownerWindow,
        bubbles: true,
        cancelable: true,
      });
      this.hoverPreviewTarget.dispatchEvent(event);
      this.hoverPreviewTarget = null;
    }
  };

  private dropAction(transfer: DataTransfer) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.dropAction, "ExcalidrawView.dropAction");
    // Return a 'copy' or 'link' action according to the content types, or undefined if no recognized type
    const files = (app as any).dragManager.draggable?.files;
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
  
  /**
   * identify which element to navigate to on click
   * @returns 
   */
  private identifyElementClicked () {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.identifyElementClicked, "ExcalidrawView.identifyElementClicked");
    this.selectedTextElement = getTextElementAtPointer(this.currentPosition, this);
    if (this.selectedTextElement && this.selectedTextElement.id) {
      const event = new MouseEvent("click", {
        ctrlKey: !(DEVICE.isIOS || DEVICE.isMacOS) || this.modifierKeyDown.ctrlKey,
        metaKey:  (DEVICE.isIOS || DEVICE.isMacOS) || this.modifierKeyDown.metaKey,
        shiftKey: this.modifierKeyDown.shiftKey,
        altKey: this.modifierKeyDown.altKey,
      });
      this.handleLinkClick(event);
      this.selectedTextElement = null;
      return;
    }
    this.selectedImageElement = getImageElementAtPointer(this.currentPosition, this);
    if (this.selectedImageElement && this.selectedImageElement.id) {
      const event = new MouseEvent("click", {
        ctrlKey: !(DEVICE.isIOS || DEVICE.isMacOS) || this.modifierKeyDown.ctrlKey,
        metaKey:  (DEVICE.isIOS || DEVICE.isMacOS) || this.modifierKeyDown.metaKey,
        shiftKey: this.modifierKeyDown.shiftKey,
        altKey: this.modifierKeyDown.altKey,
      });
      this.handleLinkClick(event);
      this.selectedImageElement = null;
      return;
    }

    this.selectedElementWithLink = getElementWithLinkAtPointer(this.currentPosition, this);
    if (this.selectedElementWithLink && this.selectedElementWithLink.id) {
      const event = new MouseEvent("click", {
        ctrlKey: !(DEVICE.isIOS || DEVICE.isMacOS) || this.modifierKeyDown.ctrlKey,
        metaKey:  (DEVICE.isIOS || DEVICE.isMacOS) || this.modifierKeyDown.metaKey,
        shiftKey: this.modifierKeyDown.shiftKey,
        altKey: this.modifierKeyDown.altKey,
      });
      this.handleLinkClick(event);
      this.selectedElementWithLink = null;
      return;
    }
  };

  private showHoverPreview(linktext?: string, element?: ExcalidrawElement) {
    //(process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.showHoverPreview, "ExcalidrawView.showHoverPreview", linktext, element);
    if(!this.lastMouseEvent) return;
    const st = this.excalidrawAPI?.getAppState();
    if(st?.editingElement || st?.newElement) return; //should not activate hover preview when element is being edited or dragged
    if(this.semaphores.wheelTimeout) return;
    //if link text is not provided, try to get it from the element
    if (!linktext) {
      if(!this.currentPosition) return;
      linktext = "";
      const selectedEl = getTextElementAtPointer(this.currentPosition, this);
      if (!selectedEl || !selectedEl.text) {
        const selectedImgElement =
          getImageElementAtPointer(this.currentPosition, this);
        const selectedElementWithLink = (selectedImgElement?.id || selectedImgElement?.id)
          ? null
          : getElementWithLinkAtPointer(this.currentPosition, this);
        element = this.excalidrawAPI.getSceneElements().find((el:ExcalidrawElement)=>el.id === selectedImgElement.id);
        if ((!selectedImgElement || !selectedImgElement.fileId) && !selectedElementWithLink?.id) {
          return;
        }
        if (selectedImgElement?.id) {
          if (!this.excalidrawData.hasFile(selectedImgElement.fileId)) {
            return;
          }
          const ef = this.excalidrawData.getFile(selectedImgElement.fileId);
          if (
            (ef.isHyperLink || ef.isLocalLink) || //web images don't have a preview
            (IMAGE_TYPES.contains(ef.file.extension)) || //images don't have a preview
            (ef.file.extension.toLowerCase() === "pdf") || //pdfs don't have a preview
            (this.plugin.ea.isExcalidrawFile(ef.file)) 
          ) {//excalidraw files don't have a preview
            linktext = getLinkTextFromLink(element.link);
            if(!linktext) return;
          } else {
            const ref = ef.linkParts.ref
              ? `#${ef.linkParts.isBlockRef ? "^" : ""}${ef.linkParts.ref}`
              : "";
            linktext =
              ef.file.path + ref;
          }
        }
        if (selectedElementWithLink?.id) {
          linktext = getLinkTextFromLink(selectedElementWithLink.text);
          if(!linktext) return;
        }
      } else {
        const {linkText, selectedElement} = this.getLinkTextForElement(selectedEl, selectedEl);
        element = selectedElement; 
        /*this.excalidrawAPI.getSceneElements().filter((el:ExcalidrawElement)=>el.id === selectedElement.id)[0];
          const text: string =
            this.textMode === TextMode.parsed
              ? this.excalidrawData.getRawText(selectedElement.id)
              : selectedElement.text;*/

        linktext = getLinkTextFromLink(linkText);
        if(!linktext) return;
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

    const f = app.metadataCache.getFirstLinkpathDest(
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
    window.setTimeout(() => (this.semaphores.hoverSleep = false), 500);
    this.plugin.hover.linkText = linktext;
    this.plugin.hover.sourcePath = this.file.path;
    this.hoverPreviewTarget = this.contentEl; //e.target;
    this.app.workspace.trigger("hover-link", {
      event: this.lastMouseEvent,
      source: VIEW_TYPE_EXCALIDRAW,
      hoverParent: this.hoverPreviewTarget,
      targetEl: this.hoverPreviewTarget, //null //0.15.0 hover editor!!
      linktext: this.plugin.hover.linkText,
      sourcePath: this.plugin.hover.sourcePath,
    });
    this.hoverPoint = this.currentPosition;
    if (this.isFullscreen()) {
      window.setTimeout(() => {
        const popover =
          this.ownerDocument.querySelector(`div.popover-title[data-path="${f.path}"]`)
            ?.parentElement?.parentElement?.parentElement ??
          this.ownerDocument.body.querySelector("div.popover");
        if (popover) {
          this.contentEl.append(popover);
        }
      }, 400);
    }
  };

  private isLinkSelected():boolean {
    return Boolean (
      this.getSelectedTextElement().id ||
      this.getSelectedImageElement().id ||
      this.getSelectedElementWithLink().id
    )
  };

  private excalidrawDIVonKeyDown(event: KeyboardEvent) {
    //(process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.excalidrawDIVonKeyDown, "ExcalidrawView.excalidrawDIVonKeyDown", event);
    if (event.target === this.excalidrawWrapperRef.current) {
      return;
    } //event should originate from the canvas
    if (this.isFullscreen() && event.keyCode === KEYCODE.ESC) {
      this.exitFullscreen();
    }
    if (isWinCTRLorMacCMD(event) && !isSHIFT(event) && !isWinALTorMacOPT(event)) {
      this.showHoverPreview();
    }
  };

  private onPointerDown(e: PointerEvent) {
    if (!(isWinCTRLorMacCMD(e)||isWinMETAorMacCTRL(e))) {
      return;
    } 
    if (!this.plugin.settings.allowCtrlClick && !isWinMETAorMacCTRL(e)) {
      return;
    }
    //added setTimeout when I changed onClick(e: MouseEvent) to onPointerDown() in 1.7.9. 
    //Timeout is required for Excalidraw to first complete the selection action before execution
    //of the link click continues
    window.setTimeout(()=>{ 
      if (!this.isLinkSelected()) return;
      this.handleLinkClick(e);
    });
  }

  private onMouseMove(e: MouseEvent) {
    //@ts-ignore
    this.lastMouseEvent = e.nativeEvent;
  }

  private onMouseOver() {
    this.clearHoverPreview();
  }

  private onDragOver(e: any) {
    const action = this.dropAction(e.dataTransfer);
    if (action) {
      if(!this.draginfoDiv) {
        this.draginfoDiv = createDiv({cls:"excalidraw-draginfo"});
        this.ownerDocument.body.appendChild(this.draginfoDiv);
      }
      let msg: string = "";
      if((this.app as any).dragManager.draggable) {
        //drag from Obsidian file manager
        msg = modifierKeyTooltipMessages().InternalDragAction[internalDragModifierType(e)];
      } else if(e.dataTransfer.types.length === 1 && e.dataTransfer.types.includes("Files")) {
        //drag from OS file manager
        msg = modifierKeyTooltipMessages().LocalFileDragAction[localFileDragModifierType(e)];
        if(DEVICE.isMacOS && isWinCTRLorMacCMD(e)) {
          msg = "CMD is reserved by MacOS for file system drag actions.\nCan't use it in Obsidian.\nUse a combination of SHIFT, CTRL, OPT instead."
        }
      } else {
        //drag from Internet
        msg = modifierKeyTooltipMessages().WebBrowserDragAction[webbrowserDragModifierType(e)];
      }
      if(!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        msg += DEVICE.isMacOS || DEVICE.isIOS
        ? "\nTry SHIFT, OPT, CTRL combinations for other drop actions" 
        : "\nTry SHIFT, CTRL, ALT, Meta combinations for other drop actions";
      }
      if(this.draginfoDiv.innerText !== msg) this.draginfoDiv.innerText = msg;
      const top = `${e.clientY-parseFloat(getComputedStyle(this.draginfoDiv).fontSize)*8}px`;
      const left = `${e.clientX-this.draginfoDiv.clientWidth/2}px`;
      if(this.draginfoDiv.style.top !== top) this.draginfoDiv.style.top = top;
      if(this.draginfoDiv.style.left !== left) this.draginfoDiv.style.left = left;
      e.dataTransfer.dropEffect = action;
      e.preventDefault();
      return false;
    }
  }

  private onDragLeave() {
    if(this.draginfoDiv) {
      this.ownerDocument.body.removeChild(this.draginfoDiv);
      delete this.draginfoDiv;
    }
  }

  private onPointerUpdate(p: {
    pointer: { x: number; y: number; tool: "pointer" | "laser" };
    button: "down" | "up";
    pointersMap: Gesture["pointers"];
  }) {
    this.currentPosition = p.pointer;
    if (
      this.hoverPreviewTarget &&
      (Math.abs(this.hoverPoint.x - p.pointer.x) > 50 ||
        Math.abs(this.hoverPoint.y - p.pointer.y) > 50)
    ) {
      this.clearHoverPreview();
    }
    if (!this.viewModeEnabled) {
      return;
    }

    const buttonDown = !this.blockOnMouseButtonDown && p.button === "down";
    if (buttonDown) {
      this.blockOnMouseButtonDown = true;

      //ctrl click
      if (isWinCTRLorMacCMD(this.modifierKeyDown) || isWinMETAorMacCTRL(this.modifierKeyDown)) {
        this.identifyElementClicked();
        return;
      }

      //dobule click
      const now = Date.now();
      if ((now - this.doubleClickTimestamp) < 600 && (now - this.doubleClickTimestamp) > 40) {
        this.identifyElementClicked();
      }
      this.doubleClickTimestamp = now;
      return;
    }
    if (p.button === "up") {
      this.blockOnMouseButtonDown = false;
    }
    if (isWinCTRLorMacCMD(this.modifierKeyDown) || 
      (this.excalidrawAPI.getAppState().isViewModeEnabled && 
      this.plugin.settings.hoverPreviewWithoutCTRL)) {
      
      this.showHoverPreview();
    }
  }

  private canvasColorChangeHook(st: AppState) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.canvasColorChangeHook, "ExcalidrawView.canvasColorChangeHook", st);
    const canvasColor = st.viewBackgroundColor === "transparent" ? "white" : st.viewBackgroundColor;
    window.setTimeout(()=>this.updateScene({appState:{gridColor: this.getGridColor(canvasColor, st)}, storeAction: "update"}));
    setDynamicStyle(this.plugin.ea,this,canvasColor,this.plugin.settings.dynamicStyling);
    if(this.plugin.ea.onCanvasColorChangeHook) {
      try {
        this.plugin.ea.onCanvasColorChangeHook(
          this.plugin.ea,
          this,
          st.viewBackgroundColor
        )
      } catch (e) {
        errorlog({
          where: this.canvasColorChangeHook,
          source: this.plugin.ea.onCanvasColorChangeHook,
          error: e,
          message: "ea.onCanvasColorChangeHook exception"
        })
      }
    }
  }

  private checkSceneVersion(et: ExcalidrawElement[]) {
    const sceneVersion = this.getSceneVersion(et);
    if (
      ((sceneVersion > 0 || 
        (sceneVersion === 0 && et.length > 0)) && //Addressing the rare case when the last element is deleted from the scene
        sceneVersion !== this.previousSceneVersion)
    ) {
      this.previousSceneVersion = sceneVersion;
      this.setDirty(6.1);
    }
  }

  private onChange (et: ExcalidrawElement[], st: AppState) {
    this.viewModeEnabled = st.viewModeEnabled;
    if (this.semaphores.justLoaded) {
      const elcount = this.excalidrawData?.scene?.elements?.length ?? 0;
      if( elcount>0 && et.length===0 ) return;
      this.semaphores.justLoaded = false;
      if (!this.semaphores.preventAutozoom && this.plugin.settings.zoomToFitOnOpen) {
        this.zoomToFit(false,true);
      }
      this.previousSceneVersion = this.getSceneVersion(et);
      this.previousBackgroundColor = st.viewBackgroundColor;
      this.previousTheme = st.theme;
      this.canvasColorChangeHook(st);
      return;
    }
    if(st.theme !== this.previousTheme && this.file === this.excalidrawData.file) {
      this.previousTheme = st.theme;
      this.setDirty(5.1);
    }
    if(st.viewBackgroundColor !== this.previousBackgroundColor && this.file === this.excalidrawData.file) {
      this.previousBackgroundColor = st.viewBackgroundColor;
      this.setDirty(6);
      if(this.colorChangeTimer) {
        window.clearTimeout(this.colorChangeTimer);
      }
      this.colorChangeTimer = window.setTimeout(()=>{
        this.canvasColorChangeHook(st);
        this.colorChangeTimer = null;
      },50); //just enough time if the user is playing with color picker, the change is not too frequent.
    }
    if (this.semaphores.dirty) {
      return;
    }
    if (
      st.editingElement === null &&
      //Removed because of
      //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/565
      /*st.resizingElement === null && 
      st.newElement === null &&
      st.editingGroupId === null &&*/
      st.editingLinearElement === null
    ) {
      this.checkSceneVersion(et);
    }
  }

  private onLibraryChange(items: LibraryItems) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.onLibraryChange, "ExcalidrawView.onLibraryChange", items);
    (async () => {
      const lib = {
        type: "excalidrawlib",
        version: 2,
        source: GITHUB_RELEASES+PLUGIN_VERSION,
        libraryItems: items,
      };
      this.plugin.setStencilLibrary(lib);
      await this.plugin.saveSettings();
    })();
  }

  private onPaste (data: ClipboardData, event: ClipboardEvent | null) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.onPaste, "ExcalidrawView.onPaste", data, event);
    const ea = this.getHookServer();
    if(data && ea.onPasteHook) {
      const res = ea.onPasteHook({
        ea,
        payload: data,
        event,
        excalidrawFile: this.file,
        view: this,
        pointerPosition: this.currentPosition,
      });
      if(typeof res === "boolean" && res === false) return false;
    }

    // Disables Middle Mouse Button Paste Functionality on Linux
    if(
      !this.modifierKeyDown.ctrlKey 
      && typeof event !== "undefined"
      && event !== null 
      && DEVICE.isLinux
    ) {
      (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.onPaste,`ExcalidrawView.onPaste, Prevented what is likely middle mouse button paste.`);
      return false;
    };

    if(data && data.text && hyperlinkIsImage(data.text)) {
      this.addImageWithURL(data.text);
      return false;
    }
    if(data && data.text && !this.modifierKeyDown.shiftKey) {
      const isCodeblock = Boolean(data.text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").match(/^`{3}[^\n]*\n.+\n`{3}\s*$/ms));
      if(isCodeblock) {
        const clipboardText = data.text;
        window.setTimeout(()=>this.pasteCodeBlock(clipboardText));
        return false;
      }

      if(isTextImageTransclusion(data.text,this, async (link, file)=>{
        const ea = getEA(this) as ExcalidrawAutomate;
          if(IMAGE_TYPES.contains(file.extension)) {
            ea.selectElementsInView([await insertImageToView (ea, this.currentPosition, file)]);
            ea.destroy();
          } else if(file.extension !== "pdf") {
            ea.selectElementsInView([await insertEmbeddableToView (ea, this.currentPosition, file, link)]);
            ea.destroy();
          } else {
            if(link.match(/^[^#]*#page=\d*(&\w*=[^&]+){0,}&rect=\d*,\d*,\d*,\d*/g)) {
              const ea = getEA(this) as ExcalidrawAutomate;
              await ea.addImage(this.currentPosition.x, this.currentPosition.y,link);
              ea.addElementsToView(false,false).then(()=>ea.destroy());
            } else {
              const modal = new UniversalInsertFileModal(this.plugin, this);
              modal.open(file, this.currentPosition);
            }
          }
          this.setDirty(9);
      })) {
        return false;
      }

      const quoteWithRef = obsidianPDFQuoteWithRef(data.text);
      if(quoteWithRef) {                  
        const ea = getEA(this) as ExcalidrawAutomate;
        const api = this.excalidrawAPI as ExcalidrawImperativeAPI;
        const st = api.getAppState();
        const strokeC = st.currentItemStrokeColor;
        const viewC = st.viewBackgroundColor;
        ea.style.strokeColor = strokeC === "transparent"
          ? ea.getCM(viewC === "transparent" ? "white" : viewC)
              .invert()
              .stringHEX({alpha: false})
          : strokeC;
        ea.style.fontFamily = st.currentItemFontFamily;
        ea.style.fontSize = st.currentItemFontSize;
        const textDims = ea.measureText(quoteWithRef.quote);
        const textWidth = textDims.width + 2*30; //default padding
        const id = ea.addText(this.currentPosition.x, this.currentPosition.y, quoteWithRef.quote, {
          box: true,
          boxStrokeColor: "transparent",
          width: Math.min(500,textWidth),
          height: textDims.height + 2*30,
        })
        ea.elementsDict[id].link = `[[${quoteWithRef.link}]]`;
        ea.addElementsToView(false,false).then(()=>ea.destroy());

        return false;
      }
    }
    if (data.elements) {
      window.setTimeout(() => this.save(), 30); //removed prevent reload = false, as reload was triggered when pasted containers were processed and there was a conflict with the new elements
    }
    return true;
  }

  private async onThemeChange (newTheme: string) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.onThemeChange, "ExcalidrawView.onThemeChange", newTheme);
    //debug({where:"ExcalidrawView.onThemeChange",file:this.file.name,before:"this.loadSceneFiles",newTheme});
    this.excalidrawData.scene.appState.theme = newTheme;
    this.loadSceneFiles(true);
    this.toolsPanelRef?.current?.setTheme(newTheme);
    //Timeout is to allow appState to update
    window.setTimeout(()=>setDynamicStyle(this.plugin.ea,this,this.previousBackgroundColor,this.plugin.settings.dynamicStyling));
  }

  private onDrop (event: React.DragEvent<HTMLDivElement>): boolean {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.onDrop, "ExcalidrawView.onDrop", event);
    if(this.draginfoDiv) {
      this.ownerDocument.body.removeChild(this.draginfoDiv);
      delete this.draginfoDiv;
    }
    const api = this.excalidrawAPI;
    if (!api) {
      return false;
    }
    const st: AppState = api.getAppState();
    this.currentPosition = viewportCoordsToSceneCoords(
      { clientX: event.clientX, clientY: event.clientY },
      st,
    );
    const draggable = (this.app as any).dragManager.draggable;
    const internalDragAction = internalDragModifierType(event);
    const externalDragAction = webbrowserDragModifierType(event);
    const localFileDragAction = localFileDragModifierType(event);

    //Call Excalidraw Automate onDropHook
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
            pointerPosition: this.currentPosition, //the pointer position on canvas at the time of drop
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

    //---------------------------------------------------------------------------------
    // Obsidian internal drag event
    //---------------------------------------------------------------------------------
    switch (draggable?.type) {
      case "file":
        if (!onDropHook("file", [draggable.file], null)) {
          const file:TFile = draggable.file;
          //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/422
          if (file.path.match(REG_LINKINDEX_INVALIDCHARS)) {
            new Notice(t("FILENAME_INVALID_CHARS"), 4000);
            return false;
          }
          if (
            ["image", "image-fullsize"].contains(internalDragAction) && 
            (IMAGE_TYPES.contains(file.extension) ||
              file.extension === "md"  ||
              file.extension.toLowerCase() === "pdf" )
          ) {
            if(file.extension.toLowerCase() === "pdf") {
              const insertPDFModal = new InsertPDFModal(this.plugin, this);
              insertPDFModal.open(file);
            } else {
              (async () => {
                const ea: ExcalidrawAutomate = getEA(this);
                ea.selectElementsInView([
                  await insertImageToView(
                    ea,
                    this.currentPosition,
                    file,
                    !(internalDragAction==="image-fullsize")
                  )
                ]);
                ea.destroy();
              })();
            }
            return false;
          }
          
          if (internalDragAction === "embeddable") {
            (async () => {
              const ea: ExcalidrawAutomate = getEA(this);
              ea.selectElementsInView([
                await insertEmbeddableToView(
                  ea,
                  this.currentPosition,
                  file,
                )
              ]);
              ea.destroy();
            })();
            return false;
          }

          //internalDragAction === "link"
          this.addText(
            `[[${app.metadataCache.fileToLinktext(
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
            if (["image", "image-fullsize"].contains(internalDragAction)) {
              const ea:ExcalidrawAutomate = getEA(this);
              ea.canvas.theme = api.getAppState().theme;
              let counter:number = 0;
              const ids:string[] = [];
              for (const f of draggable.files) {
                if ((IMAGE_TYPES.contains(f.extension) || f.extension === "md")) {
                  ids.push(await ea.addImage(
                    this.currentPosition.x + counter*50,
                    this.currentPosition.y + counter*50,
                    f,
                    !(internalDragAction==="image-fullsize"),
                  ));
                  counter++;
                  await ea.addElementsToView(false, false, true);
                  ea.selectElementsInView(ids);
                }
                if (f.extension.toLowerCase() === "pdf") {
                  const insertPDFModal = new InsertPDFModal(this.plugin, this);
                  insertPDFModal.open(f);
                }
              }
              ea.destroy();
              return;
            }

            if (internalDragAction === "embeddable") {
              const ea:ExcalidrawAutomate = getEA(this);
              let column:number = 0;
              let row:number = 0;
              const ids:string[] = [];
              for (const f of draggable.files) {
                ids.push(await insertEmbeddableToView(
                  ea,
                  {
                    x:this.currentPosition.x + column*500,
                    y:this.currentPosition.y + row*550
                  },
                  f,
                ));
                column = (column + 1) % 3;
                if(column === 0) {
                  row++;
                }
              }
              ea.destroy();
              return false;
            }

            //internalDragAction === "link"
            for (const f of draggable.files) {
              await this.addText(
                `[[${app.metadataCache.fileToLinktext(
                  f,
                  this.file.path,
                  true,
                )}]]`, undefined,false
              );
              this.currentPosition.y += st.currentItemFontSize * 2;
            }
            this.save(false);
          })();
        }
        return false;
    }

    //---------------------------------------------------------------------------------
    // externalDragAction
    //---------------------------------------------------------------------------------
    if (event.dataTransfer.types.includes("Files")) {
      if (event.dataTransfer.types.includes("text/plain")) {
        const text: string = event.dataTransfer.getData("text");
        if (text && onDropHook("text", null, text)) {
          return false;
        }
        if(text && (externalDragAction === "image-url") && hyperlinkIsImage(text)) {
          this.addImageWithURL(text);
          return false;
        }
        if(text && (externalDragAction === "link")) {
          if (
            this.plugin.settings.iframelyAllowed &&
            text.match(/^https?:\/\/\S*$/)
          ) {
            this.addTextWithIframely(text);
            return false;
          } else {
            this.addText(text);
            return false;
          }
        }
        if(text && (externalDragAction === "embeddable")) {
          const ea = getEA(this) as ExcalidrawAutomate;
          insertEmbeddableToView(
            ea,
            this.currentPosition,
            undefined,
            text,
          ).then(()=>ea.destroy());
          return false;
        }
      }

      if(event.dataTransfer.types.includes("text/html")) {
        const html = event.dataTransfer.getData("text/html");
        const src = html.match(/src=["']([^"']*)["']/)
        if(src && (externalDragAction === "image-url") && hyperlinkIsImage(src[1])) {
          this.addImageWithURL(src[1]);
          return false;
        }
        if(src && (externalDragAction === "link")) {
          if (
            this.plugin.settings.iframelyAllowed &&
            src[1].match(/^https?:\/\/\S*$/)
          ) {
            this.addTextWithIframely(src[1]);
            return false;
          } else {
            this.addText(src[1]);
            return false;
          }
        }
        if(src && (externalDragAction === "embeddable")) {
          const ea = getEA(this) as ExcalidrawAutomate;
          insertEmbeddableToView(
            ea,
            this.currentPosition,
            undefined,
            src[1],
          ).then(ea.destroy);
          return false;
        }
      }
      
      if (event.dataTransfer.types.length >= 1 && ["image-url","image-import","embeddable"].contains(localFileDragAction)) {
        for(let i=0;i<event.dataTransfer.files.length;i++) {
          //@ts-ignore
          const path = event.dataTransfer.files[i].path;
          if(!path) return true; //excalidarw to continue processing
          const link = getInternalLinkOrFileURLLink(path, this.plugin, event.dataTransfer.files[i].name, this.file);
          const {x,y} = this.currentPosition;
          const pos = {x:x+i*300, y:y+i*300};
          if(link.isInternal) {
            if(localFileDragAction === "embeddable") {
              const ea = getEA(this) as ExcalidrawAutomate;
              insertEmbeddableToView(ea, pos, link.file).then(()=>ea.destroy());
            } else {
              if(link.file.extension === "pdf") {
                const insertPDFModal = new InsertPDFModal(this.plugin, this);
                insertPDFModal.open(link.file);
                //return false;
              }
              const ea = getEA(this) as ExcalidrawAutomate;
              insertImageToView(ea, pos, link.file).then(()=>ea.destroy()) ;
            }
          } else {
            const extension = getURLImageExtension(link.url);
            if(localFileDragAction === "image-import") {
              if (IMAGE_TYPES.contains(extension)) {
                (async () => {
                  const droppedFilename = event.dataTransfer.files[i].name;
                  const fileToImport = await event.dataTransfer.files[i].arrayBuffer();
                  let {folder:_, filepath} = await getAttachmentsFolderAndFilePath(this.app, this.file.path, droppedFilename);
                  const maybeFile = this.app.vault.getAbstractFileByPath(filepath);
                  if(maybeFile && maybeFile instanceof TFile) {
                    const action = await ScriptEngine.suggester(
                      this.app,[
                        "Use the file already in the Vault instead of importing",
                        "Overwrite existing file in the Vault",
                        "Import the file with a new name",
                      ],[
                        "Use",
                        "Overwrite",
                        "Import",
                      ],
                      "A file with the same name/path already exists in the Vault",
                    );
                    switch(action) {
                      case "Import":
                        const {folderpath,filename,basename:_,extension:__} = splitFolderAndFilename(filepath);
                        filepath = getNewUniqueFilepath(this.app.vault, filename, folderpath);
                        break;
                        case "Overwrite":
                          await this.app.vault.modifyBinary(maybeFile, fileToImport);
                          // there is deliberately no break here
                      case "Use":
                      default:
                        const ea = getEA(this) as ExcalidrawAutomate;
                        await insertImageToView(ea, pos, maybeFile);
                        ea.destroy();
                        return;
                    }
                  }
                  const file = await this.app.vault.createBinary(filepath, fileToImport)
                  const ea = getEA(this) as ExcalidrawAutomate;
                  await insertImageToView(ea, pos, file);
                  ea.destroy();
                })();
                //return false;
              } else if(extension === "excalidraw") {
                return true; //excalidarw to continue processing
              } else {
                (async () => {
                  const {folder:_, filepath} = await getAttachmentsFolderAndFilePath(this.app, this.file.path,event.dataTransfer.files[i].name);
                  const file = await this.app.vault.createBinary(filepath, await event.dataTransfer.files[i].arrayBuffer());
                  const modal = new UniversalInsertFileModal(this.plugin, this);
                  modal.open(file, pos);
                  //insertEmbeddableToView(getEA(this), pos, file);
                })();
                //return false;
              }
            }
            else if(localFileDragAction === "embeddable" || !IMAGE_TYPES.contains(extension)) {
              const ea = getEA(this) as ExcalidrawAutomate;
              insertEmbeddableToView(ea, pos, null, link.url).then(()=>ea.destroy());
              if(localFileDragAction !== "embeddable") {
                new Notice("Not imported to Vault. Embedded with local URI");
              }
            } else {
              const ea = getEA(this) as ExcalidrawAutomate;
              insertImageToView(ea, pos, link.url).then(()=>ea.destroy());
            }
          }
        };
        return false;
      }

      if(event.dataTransfer.types.length >= 1 && localFileDragAction === "link") {
        const ea = getEA(this) as ExcalidrawAutomate;
        for(let i=0;i<event.dataTransfer.files.length;i++) {
          //@ts-ignore
          const path = event.dataTransfer.files[i].path;
          const name = event.dataTransfer.files[i].name;
          if(!path || !name) return true; //excalidarw to continue processing
          const link = getInternalLinkOrFileURLLink(path, this.plugin, name, this.file);
          const id = ea.addText(
            this.currentPosition.x+i*40,
            this.currentPosition.y+i*20,
            link.isInternal ? link.link :`📂 ${name}`);
          if(!link.isInternal) {
            ea.getElement(id).link = link.link;
          }
        }
        ea.addElementsToView().then(()=>ea.destroy());
        return false;
      }

      return true;
    }

    if (event.dataTransfer.types.includes("text/plain") || event.dataTransfer.types.includes("text/uri-list") || event.dataTransfer.types.includes("text/html")) {

      const html = event.dataTransfer.getData("text/html");
      const src = html.match(/src=["']([^"']*)["']/);
      const htmlText = src ? src[1] : "";
      const textText = event.dataTransfer.getData("text");
      const uriText = event.dataTransfer.getData("text/uri-list");

      let text: string = src ? htmlText : textText;
      if (!text || text === "") {
        text = uriText
      }
      if (!text || text === "") {
        return true;
      }
      if (!onDropHook("text", null, text)) {
        if(text && (externalDragAction==="embeddable") && /^(blob:)?(http|https):\/\/[^\s/$.?#].[^\s]*$/.test(text)) {
          return true;
        }
        if(text && (externalDragAction==="image-url") && hyperlinkIsYouTubeLink(text)) {
          this.addYouTubeThumbnail(text);
          return false;
        }
        if(uriText && (externalDragAction==="image-url") && hyperlinkIsYouTubeLink(uriText)) {
          this.addYouTubeThumbnail(uriText);
          return false;
        }
        if(text && (externalDragAction==="image-url") && hyperlinkIsImage(text)) {
          this.addImageWithURL(text);
          return false;
        }
        if(uriText && (externalDragAction==="image-url") && hyperlinkIsImage(uriText)) {
          this.addImageWithURL(uriText);
          return false;
        }
        if(text && (externalDragAction==="image-import") && hyperlinkIsImage(text)) {
          this.addImageSaveToVault(text);
          return false;
        }
        if(uriText && (externalDragAction==="image-import") && hyperlinkIsImage(uriText)) {
          this.addImageSaveToVault(uriText);
          return false;
        }
        if (
          this.plugin.settings.iframelyAllowed &&
          text.match(/^https?:\/\/\S*$/)
        ) {
          this.addTextWithIframely(text);
          return false;
        }
        //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/599
        if(text.startsWith("obsidian://open?vault=")) {
          const html = event.dataTransfer.getData("text/html");
          if(html) {
            const path = html.match(/href="app:\/\/obsidian\.md\/(.*?)"/);
            if(path.length === 2) {
              const link = decodeURIComponent(path[1]).split("#");
              const f = this.app.vault.getAbstractFileByPath(link[0]);
              if(f && f instanceof TFile) {
                const path = this.app.metadataCache.fileToLinktext(f,this.file.path);
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
  }

  //returns the raw text of the element which is the original text without parsing
  //in compatibility mode, returns the original text, and for backward compatibility the text if originalText is not available
  private onBeforeTextEdit (textElement: ExcalidrawTextElement) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.onBeforeTextEdit, "ExcalidrawView.onBeforeTextEdit", textElement);
    window.clearTimeout(this.isEditingTextResetTimer);
    this.isEditingTextResetTimer = null;
    this.semaphores.isEditingText = true; //to prevent autoresize on mobile when keyboard pops up
    if(this.compatibilityMode) {
      return textElement.originalText ?? textElement.text;
    }
    const raw = this.excalidrawData.getRawText(textElement.id);
    if (!raw) {
      return textElement.rawText;
    }
    return raw;
  }


  private onBeforeTextSubmit (
    textElement: ExcalidrawTextElement,
    nextText: string,
    nextOriginalText: string,
    isDeleted: boolean,
  ): {updatedNextOriginalText: string, nextLink: string} {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.onBeforeTextSubmit, "ExcalidrawView.onBeforeTextSubmit", textElement, nextText, nextOriginalText, isDeleted);
    const api = this.excalidrawAPI;
    if (!api) {
      return {updatedNextOriginalText: null, nextLink: textElement?.link ?? null};
    }

    // 1. Set the isEditingText flag to true to prevent autoresize on mobile
    // 1500ms is an empirical number, the on-screen keyboard usually disappears in 1-2 seconds
    this.semaphores.isEditingText = true;
    if(this.isEditingTextResetTimer) {
      window.clearTimeout(this.isEditingTextResetTimer);
    }
    this.isEditingTextResetTimer = window.setTimeout(() => {
      if(typeof this.semaphores?.isEditingText !== "undefined") {
        this.semaphores.isEditingText = false;
      }
      this.isEditingTextResetTimer = null;
    }, 1500);

    // 2. If the text element is deleted, remove it from ExcalidrawData
    //    parsed textElements cache
    if (isDeleted) {
      this.excalidrawData.deleteTextElement(textElement.id);
      this.setDirty(7);
      return {updatedNextOriginalText: null, nextLink: null};
    }

    // 3. Check if the user accidently pasted Excalidraw data from the clipboard
    //    as text. If so, update the parsed link in ExcalidrawData
    //    textElements cache and update the text element in the scene with a warning.
    const FORBIDDEN_TEXT = `{"type":"excalidraw/clipboard","elements":[{"`;
    const WARNING = t("WARNING_PASTING_ELEMENT_AS_TEXT");
    if(nextOriginalText.startsWith(FORBIDDEN_TEXT)) {
      window.setTimeout(()=>{
        const elements = this.excalidrawAPI.getSceneElements();
        const el = elements.filter((el:ExcalidrawElement)=>el.id === textElement.id);
        if(el.length === 1) {
          const clone = cloneElement(el[0]);
          clone.rawText = WARNING;
          elements[elements.indexOf(el[0])] = clone;
          this.excalidrawData.setTextElement(clone.id,WARNING,()=>{});
          this.updateScene({elements, storeAction: "update"});
          api.history.clear();
        }
      });
      return {updatedNextOriginalText:WARNING, nextLink:null};
    }

    const containerId = textElement.containerId;

    // 4. Check if the text matches the transclusion pattern and if so,
    //    check if the link in the transclusion can be resolved to a file in the vault.
    //    If the link is an image or a PDF file, replace the text element with the image or the PDF.
    //    If the link is an embedded markdown file, then display a message, but otherwise transclude the text step 5.
    //                              1                              2
    if(isTextImageTransclusion(nextOriginalText, this, (link, file)=>{
      window.setTimeout(async ()=>{
        const elements = this.excalidrawAPI.getSceneElements();
        const el = elements.filter((el:ExcalidrawElement)=>el.id === textElement.id) as ExcalidrawTextElement[];
        if(el.length === 1) {
          const center = {x: el[0].x, y: el[0].y };
          const clone = cloneElement(el[0]);
          clone.isDeleted = true;
          this.excalidrawData.deleteTextElement(clone.id);
          elements[elements.indexOf(el[0])] = clone;
          this.updateScene({elements, storeAction: "update"});
          const ea:ExcalidrawAutomate = getEA(this);
          if(IMAGE_TYPES.contains(file.extension)) {
            ea.selectElementsInView([await insertImageToView (ea, center, file)]);
            ea.destroy();
          } else if(file.extension !== "pdf") {
            ea.selectElementsInView([await insertEmbeddableToView (ea, center, file, link)]);
            ea.destroy();
          } else {
            const modal = new UniversalInsertFileModal(this.plugin, this);
            modal.open(file, center);
          }
          this.setDirty(9);
        }
      });
    })) {
      return {updatedNextOriginalText: null, nextLink: textElement.link};
    }

    // 5. Check if the user made changes to the text, or
    //    the text is missing from ExcalidrawData textElements cache (recently copy/pasted)
    if (
      nextOriginalText !== textElement.originalText ||
      !this.excalidrawData.getRawText(textElement.id)
    ) {
      //the user made changes to the text or the text is missing from Excalidraw Data (recently copy/pasted)
      //setTextElement will attempt a quick parse (without processing transclusions)
      this.setDirty(8);

      // setTextElement will invoke this callback function in case quick parse was not possible, the parsed text contains transclusions
      // in this case I need to update the scene asynchronously when parsing is complete
      const callback = async (parsedText:string) => {
        //this callback function will only be invoked if quick parse fails, i.e. there is a transclusion in the raw text
        if(this.textMode === TextMode.raw) return;
        
        const elements = this.excalidrawAPI.getSceneElements();
        const elementsMap = arrayToMap(elements);
        const el = elements.filter((el:ExcalidrawElement)=>el.id === textElement.id);
        if(el.length === 1) {
          const container = getContainerElement(el[0],elementsMap);
          const clone = cloneElement(el[0]);
          if(!el[0]?.isDeleted) {
            const {text, x, y, width, height} = refreshTextDimensions(el[0], container, elementsMap, parsedText);

            clone.x = x;
            clone.y = y;
            clone.width = width;
            clone.height = height;
            clone.originalText = parsedText;
            clone.text = text;
          }

          elements[elements.indexOf(el[0])] = clone;
          this.updateScene({elements, storeAction: "update"});
          if(clone.containerId) this.updateContainerSize(clone.containerId);
          this.setDirty(8.1);
        }
        api.history.clear();
      };

      const [parseResultOriginal, link] =
        this.excalidrawData.setTextElement(
          textElement.id,
          nextOriginalText,
          callback,
        );

      // if quick parse was successful, 
      //  - check if textElement is in a container and update the container size,
      //    because the parsed text will have a different size than the raw text had
      //  - depending on the textMode, return the text with markdown markup or the parsed text
      // if quick parse was not successful return [null, null, null] to indicate that the no changes were made to the text element
      if (parseResultOriginal) {
        //there were no transclusions in the raw text, quick parse was successful
        if (containerId) {
          this.updateContainerSize(containerId, true);
        }
        if (this.textMode === TextMode.raw) {
          return {updatedNextOriginalText: nextOriginalText, nextLink: link};
        } //text is displayed in raw, no need to clear the history, undo will not create problems
        if (nextOriginalText === parseResultOriginal) {
          if (link) {
            //don't forget the case: link-prefix:"" && link-brackets:true
            return {updatedNextOriginalText: parseResultOriginal, nextLink: link};
          }
          return {updatedNextOriginalText: null, nextLink: textElement.link};
        } //There were no links to parse, raw text and parsed text are equivalent
        api.history.clear();
        return {updatedNextOriginalText: parseResultOriginal, nextLink:link};
      }
      return {updatedNextOriginalText: null, nextLink: textElement.link};
    }
    // even if the text did not change, container sizes might need to be updated 
    if (containerId) {
      this.updateContainerSize(containerId, true);
    }
    if (this.textMode === TextMode.parsed) {
      const parseResultOriginal = this.excalidrawData.getParsedText(textElement.id);
      return {updatedNextOriginalText: parseResultOriginal, nextLink: textElement.link};
    }
    return {updatedNextOriginalText: null, nextLink: textElement.link};
  }

  private async onLinkOpen(element: ExcalidrawElement, e: any): Promise<void> {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.onLinkOpen, "ExcalidrawView.onLinkOpen", element, e);
    e.preventDefault();
    if (!element) {
      return;
    }
    let link = element.link;
    if (!link || link === "") {
      return;
    }
    window.setTimeout(()=>this.removeLinkTooltip(),500);

    let event = e?.detail?.nativeEvent;
    if(this.handleLinkHookCall(element,element.link,event)) return;
    //if(openExternalLink(element.link, this.app, !isSHIFT(event) && !isWinCTRLorMacCMD(event) && !isWinMETAorMacCTRL(event) && !isWinALTorMacOPT(event) ? element : undefined)) return;
    if(openExternalLink(element.link, this.app)) return;

    //if element is type text and element has multiple links, then submit the element text to linkClick to trigger link suggester
    if(element.type === "text") {
      const linkText = element.rawText.replaceAll("\n", ""); //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/187
      const partsArray = REGEX_LINK.getResList(linkText);
      if(partsArray.filter(p=>Boolean(p.value)).length > 1) {
        link = linkText;
      }
    }

    if (!event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event = emulateKeysForLinkClick("new-tab");
    }

    this.linkClick(
      event,
      null,
      null,
      {id: element.id, text: link},
      event,
    );
    return;
  }

  private onLinkHover(element: NonDeletedExcalidrawElement, event: React.PointerEvent<HTMLCanvasElement>): void {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.onLinkHover, "ExcalidrawView.onLinkHover", element, event);
    if (
      element &&
      (this.plugin.settings.hoverPreviewWithoutCTRL ||
        isWinCTRLorMacCMD(event))
    ) {
      this.lastMouseEvent = event;
      this.lastMouseEvent.ctrlKey = !(DEVICE.isIOS || DEVICE.isMacOS) || this.lastMouseEvent.ctrlKey;
      this.lastMouseEvent.metaKey = (DEVICE.isIOS || DEVICE.isMacOS) || this.lastMouseEvent.metaKey;
      const link = element.link;
      if (!link || link === "") {
        return;
      }
      if (link.startsWith("[[")) {
        const linkMatch = link.match(/\[\[(?<link>.*?)\]\]/);
        if (!linkMatch) {
          return;
        }
        let linkText = linkMatch.groups.link;
        this.showHoverPreview(linkText, element);
      }
    }
  }

  private onViewModeChange(isViewModeEnabled: boolean) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.onViewModeChange, "ExcalidrawView.onViewModeChange", isViewModeEnabled);
    if(!this.semaphores.viewunload) {
      this.toolsPanelRef?.current?.setExcalidrawViewMode(
        isViewModeEnabled,
      );
    }
    if(this.getHookServer().onViewModeChangeHook) {
      try {
        this.getHookServer().onViewModeChangeHook(isViewModeEnabled,this,this.getHookServer());
      } catch(e) {
        errorlog({where: "ExcalidrawView.onViewModeChange", fn: this.getHookServer().onViewModeChangeHook, error: e});
      }
      
    }
  }  

  private async getBackOfTheNoteSections() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.getBackOfTheNoteSections, "ExcalidrawView.getBackOfTheNoteSections");
    return (await this.app.metadataCache.blockCache.getForFile({ isCancelled: () => false },this.file))
      .blocks.filter((b: any) => b.display && b.node?.type === "heading")
      .filter((b: any) => !MD_EX_SECTIONS.includes(b.display))
      .map((b: any) => cleanSectionHeading(b.display));
  }

  private async getBackOfTheNoteBlocks() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.getBackOfTheNoteBlocks, "ExcalidrawView.getBackOfTheNoteBlocks");
    return (await this.app.metadataCache.blockCache.getForFile({ isCancelled: () => false },this.file))
      .blocks.filter((b:any) => b.display && b.node && b.node.hasOwnProperty("type") && b.node.hasOwnProperty("id"))
      .map((b:any) => cleanBlockRef(b.node.id));
  }

  public getSingleSelectedImage(): {imageEl: ExcalidrawImageElement, embeddedFile: EmbeddedFile}  {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.getSingleSelectedImage, "ExcalidrawView.getSingleSelectedImage");
    if(!this.excalidrawAPI) return null;
    const els = this.getViewSelectedElements().filter(el=>el.type==="image");
    if(els.length !== 1) {
      return null;
    }
    const el = els[0] as ExcalidrawImageElement;
    const imageFile = this.excalidrawData.getFile(el.fileId);
    return {imageEl: el, embeddedFile: imageFile};
  }

  public async insertBackOfTheNoteCard() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.insertBackOfTheNoteCard, "ExcalidrawView.insertBackOfTheNoteCard");
    const sections = await this.getBackOfTheNoteSections(); 
    const selectCardDialog = new SelectCard(this.app,this,sections);
    selectCardDialog.start();
  }

  public async moveBackOfTheNoteCardToFile(id?: string) {
    id = id ?? this.getViewSelectedElements().filter(el=>el.type==="embeddable")[0]?.id;
    const embeddableData = this.getEmbeddableLeafElementById(id);
    const child = embeddableData?.node?.child;
    if(!child || (child.file !== this.file)) return;

    if(child.lastSavedData !== this.data) {
      await this.forceSave(true);
      if(child.lastSavedData !== this.data) {
        new Notice(t("ERROR_TRY_AGAIN"));
        return;
      }
    }
    const {folder, filepath:_} = await getAttachmentsFolderAndFilePath(
      this.app,
      this.file.path, 
      "dummy",
    );
    const filepath = getNewUniqueFilepath(
      this.app.vault,
      child.subpath.replaceAll("#",""),
      folder,
    );
    let path = await ScriptEngine.inputPrompt(
      this,
      this.plugin,
      this.app,
      "Set filename",
      "Enter filename",
      filepath,
      undefined,
      3,
    );
    if(!path) return;
    if(!path.endsWith(".md")) {
      path += ".md";
    }
    const {folderpath, filename} = splitFolderAndFilename(path);
    path = getNewUniqueFilepath(this.app.vault, filename, folderpath);
    try {
      const newFile = await this.app.vault.create(path, child.text);
      if(!newFile) {
        new Notice("Unexpected error");
        return;
      }
      const ea = getEA(this) as ExcalidrawAutomate;
      ea.copyViewElementsToEAforEditing([this.getViewElements().find(el=>el.id === id)]);
      ea.getElement(id).link = `[[${newFile.path}]]`;
      this.data = this.data.split(child.heading+child.text).join("");
      await ea.addElementsToView(false);
      ea.destroy();
      await this.forceSave(true);
    } catch(e) {
      new Notice(`Unexpected error: ${e.message}`);
      return;
    }
  }

  public async pasteCodeBlock(data: string) {
    try {
      data = data.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
      const isCodeblock = Boolean(data.match(/^`{3}[^\n]*\n.+\n`{3}\s*$/ms));
      if(!isCodeblock) {
        const codeblockType = await GenericInputPrompt.Prompt(this,this.plugin,this.app,"type codeblock type","javascript, html, python, etc.","");
        data = "```"+codeblockType.trim()+"\n"+data+"\n```";
      }
      let title = (await GenericInputPrompt.Prompt(this,this.plugin,this.app,"Code Block Title","Enter title or leave empty for automatic title","")).trim();
      if (title === "") {title = "Code Block";};
      const sections = await this.getBackOfTheNoteSections(); 
      if (sections.includes(title)) {
        let i=0;
        while (sections.includes(`${title} ${++i}`)) {};
        title = `${title} ${i}`;
      }
      addBackOfTheNoteCard(this, title, false, data);
    } catch (e) {
    }
  }

  public async convertImageElWithURLToLocalFile(data: {imageEl: ExcalidrawImageElement, embeddedFile: EmbeddedFile}) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.convertImageElWithURLToLocalFile, "ExcalidrawView.convertImageElWithURLToLocalFile", data);
    const {imageEl, embeddedFile} = data;
    const imageDataURL = embeddedFile.getImage(false);
    if(!imageDataURL && !imageDataURL.startsWith("data:")) {
      new Notice("Image not found");
      return false;
    }
    const ea = getEA(this) as ExcalidrawAutomate;
    ea.copyViewElementsToEAforEditing([imageEl]);
    const eaEl = ea.getElement(imageEl.id) as Mutable<ExcalidrawImageElement>;
    eaEl.fileId = fileid() as FileId;
    if(!eaEl.link) {eaEl.link = embeddedFile.hyperlink};
    let dataURL = embeddedFile.getImage(false);
    if(!dataURL.startsWith("data:")) {
      new Notice("Attempting to download image from URL. This may take a long while. The operation will time out after max 1 minute");
      dataURL = await getDataURLFromURL(dataURL, embeddedFile.mimeType, 30000);
      if(!dataURL.startsWith("data:")) {
        new Notice("Failed. Could not download image!");
        return false;
      }
    }
    const files: BinaryFileData[] = [];
    files.push({
      mimeType: embeddedFile.mimeType,
      id: eaEl.fileId,
      dataURL: dataURL as DataURL,
      created: embeddedFile.mtime,
    });
    const api = this.excalidrawAPI as ExcalidrawImperativeAPI;
    api.addFiles(files);
    await ea.addElementsToView(false,true);
    ea.destroy();
    new Notice("Image successfully converted to local file");
  }

  private onContextMenu(elements: readonly ExcalidrawElement[], appState: AppState, onClose: (callback?: () => void) => void) {
    const React = this.packages.react;
    const contextMenuActions = [];
    const api = this.excalidrawAPI as ExcalidrawImperativeAPI;
    const selectedElementIds = Object.keys(api.getAppState().selectedElementIds);
    const areElementsSelected = selectedElementIds.length > 0;

    if(this.isLinkSelected()) {
      contextMenuActions.push([
        renderContextMenuAction(
          React,
          t("OPEN_LINK_CLICK"),
          () => {
            const event = emulateKeysForLinkClick("new-tab");
            this.handleLinkClick(event);
          },
          onClose
        ),
      ]);
    }

    if(appState.viewModeEnabled) {
      const isLaserOn = appState.activeTool?.type === "laser";
      contextMenuActions.push([
        renderContextMenuAction(
          React,
          isLaserOn ? t("LASER_OFF") : t("LASER_ON"),
          () => {
            api.setActiveTool({type: isLaserOn ? "selection" : "laser"});
          },
          onClose
        ),
      ]);  
    }

    if(!appState.viewModeEnabled) {
      const selectedTextElements = this.getViewSelectedElements().filter(el=>el.type === "text");
      if(selectedTextElements.length===1) {
        const selectedTextElement = selectedTextElements[0] as ExcalidrawTextElement;
        const containerElement = (this.getViewElements() as ExcalidrawElement[]).find(el=>el.id === selectedTextElement.containerId);
        
        //if the text element in the container no longer has a link associated with it...
        if(
          containerElement &&
          selectedTextElement.link &&
          this.excalidrawData.getParsedText(selectedTextElement.id) === selectedTextElement.rawText
        ) {
          contextMenuActions.push([
            renderContextMenuAction(
              React,
              t("REMOVE_LINK"),
              async () => {
                const ea = getEA(this) as ExcalidrawAutomate;
                ea.copyViewElementsToEAforEditing([selectedTextElement]);
                const el = ea.getElement(selectedTextElement.id) as Mutable<ExcalidrawTextElement>;
                el.link = null;
                await ea.addElementsToView(false);
                ea.destroy();
              },
              onClose
            ),
          ]);
        }

        if(containerElement) {
          contextMenuActions.push([
            renderContextMenuAction(
              React,
              t("SELECT_TEXTELEMENT_ONLY"),
              () => {
                window.setTimeout(()=>
                  (this.excalidrawAPI as ExcalidrawImperativeAPI).selectElements([selectedTextElement])
                );
              },
              onClose
            ),
          ]);            
        }

        if(!containerElement || (containerElement && containerElement.type !== "arrow")) {
          contextMenuActions.push([
            renderContextMenuAction(
              React,
              t("CONVERT_TO_MARKDOWN"),
              () => {
                this.convertTextElementToMarkdown(selectedTextElement, containerElement);
              },
              onClose
            ),
          ]);  
        }
      }

      const img = this.getSingleSelectedImage();
      if(img &&  img.embeddedFile?.isHyperLink) {
        contextMenuActions.push([
          renderContextMenuAction(
            React,
            t("CONVERT_URL_TO_FILE"),
            () => {
              window.setTimeout(()=>this.convertImageElWithURLToLocalFile(img));
            },
            onClose
          ),
        ]);  
      }

      if(
        img && img.embeddedFile && img.embeddedFile.mimeType === "image/svg+xml" &&
        (!img.embeddedFile.file || (img.embeddedFile.file && !this.plugin.isExcalidrawFile(img.embeddedFile.file)))
       ) {
        contextMenuActions.push([
          renderContextMenuAction(
            React,
            t("IMPORT_SVG_CONTEXTMENU"),
            async () => {
              const base64Content = img.embeddedFile.getImage(false).split(',')[1];
              // Decoding the base64 content
              const svg = atob(base64Content);
              if(!svg || svg === "") return;
              const ea = getEA(this) as ExcalidrawAutomate;
              ea.importSVG(svg);
              ea.addToGroup(ea.getElements().map(el=>el.id));
              await ea.addElementsToView(true, true, true,true);
              ea.destroy();
            },
            onClose
          ),
        ]);
      }

      if(areElementsSelected) {
        contextMenuActions.push([
          renderContextMenuAction(
            React,
            t("COPY_ELEMENT_LINK"),
            () => {
              this.copyLinkToSelectedElementToClipboard("");
            },
            onClose
          ),
        ]);
      } else {
        contextMenuActions.push([
          renderContextMenuAction(
            React,
            t("COPY_DRAWING_LINK"),
            () => {
              navigator.clipboard.writeText(`![[${this.file.path}]]`);
            },
            onClose
          ),
        ]);
      }

      if(this.getViewSelectedElements().filter(el=>el.type==="embeddable").length === 1) {
        const embeddableData = this.getEmbeddableLeafElementById(
          this.getViewSelectedElements().filter(el=>el.type==="embeddable")[0].id
        );
        const child = embeddableData?.node?.child;
        if(child && (child.file === this.file)) {
          contextMenuActions.push([
            renderContextMenuAction(
              React,
              t("CONVERT_CARD_TO_FILE"),
              () => {
                this.moveBackOfTheNoteCardToFile();
              },
              onClose
            ),
          ]);
        }
      }

      contextMenuActions.push([
        renderContextMenuAction(
          React,
          t("INSERT_CARD"),
          () => {
            this.insertBackOfTheNoteCard();
          },
          onClose
        ),
      ]);
      contextMenuActions.push([
        renderContextMenuAction(
          React,
          t("UNIVERSAL_ADD_FILE"),
          () => {
            const insertFileModal = new UniversalInsertFileModal(this.plugin, this);
            insertFileModal.open();
          },
          onClose
        ),
      ]);
      contextMenuActions.push([
        renderContextMenuAction(
          React,
          t("INSERT_LINK"),
          () => {
            this.plugin.insertLinkDialog.start(this.file.path, (markdownlink: string, path:string, alias:string) => this.addLink(markdownlink, path, alias));
          },
          onClose
        ),
        // Add more context menu actions here if needed
      ]);
      contextMenuActions.push([
        renderContextMenuAction(
          React,
          t("PASTE_CODEBLOCK"),
          async () => {
            const data = await navigator.clipboard?.readText();
            if(!data || data.trim() === "") return;
            this.pasteCodeBlock(data);
          },
          onClose
        ),
      ])
    }

    if(contextMenuActions.length === 0) return;
    return React.createElement (
      "div",
      {},
      ...contextMenuActions,
      React.createElement(
        "hr",
        {
          key: nanoid(),
          className: "context-menu-item-separator",
        },
      )
    );
  }

  private actionOpenScriptInstallPrompt() {
    new ScriptInstallPrompt(this.plugin).open();
  }

  private actionOpenExportImageDialog() {
    if(!this.exportDialog) {
      this.exportDialog = new ExportDialog(this.plugin, this,this.file);
      this.exportDialog.createForm();
    }
    this.exportDialog.open();
  }

  private setExcalidrawAPI (api: ExcalidrawImperativeAPI) {
    this.excalidrawAPI = api;
    //api.setLocalFont(this.plugin.settings.experimentalEnableFourthFont);
    window.setTimeout(() => {
      this.onAfterLoadScene(true);
      this.excalidrawContainer?.focus();
    });
  };

  private ttdDialog() {
    return this.packages.react.createElement(
      this.packages.excalidrawLib.TTDDialog,
      {
        onTextSubmit: async (input:string) => {
          try {
            const response = await postOpenAI({
              systemPrompt: "The user will provide you with a text prompt. Your task is to generate a mermaid diagram based on the prompt. Use the graph, sequenceDiagram, flowchart or classDiagram types based on what best fits the request. Return a single message containing only the mermaid diagram in a codeblock. Avoid the use of `()` parenthesis in the mermaid script.",
              text: input,
              instruction: "Return a single message containing only the mermaid diagram in a codeblock.",
            })

            if(!response) {
              return {
                error: new Error("Request failed"),
              };
            }

            const json = response.json;
            (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.ttdDialog, `ExcalidrawView.ttdDialog > onTextSubmit, openAI response`, response);

            if (json?.error) {
              log(response);
              return {
                error: new Error(json.error.message),
              };
            }

            if(!json?.choices?.[0]?.message?.content) {
              log(response);
              return {
                error: new Error("Generation failed... see console log for details"),
              };
            }

            let generatedResponse = extractCodeBlocks(json.choices[0]?.message?.content)[0]?.data;

            if(!generatedResponse) {
              log(response);
              return {
                error: new Error("Generation failed... see console log for details"),
              };
            }

            if(generatedResponse.startsWith("mermaid")) {
              generatedResponse = generatedResponse.replace(/^mermaid/,"").trim();
            }
            
            return { generatedResponse, rateLimit:100, rateLimitRemaining:100 };
          } catch (err: any) {
            throw new Error("Request failed");
          }
        },
      }
    );
  };

  private ttdDialogTrigger() {
    return this.packages.react.createElement(
      this.packages.excalidrawLib.TTDDialogTrigger,
      {},
    );
  }

  private renderWelcomeScreen () {
    const React = this.packages.react;
    const {WelcomeScreen} = this.packages.excalidrawLib;
    const filecount = this.app.vault.getFiles().filter(f=>this.plugin.isExcalidrawFile(f)).length;
    const rank = filecount < 200 ? "Bronze" : filecount < 750 ? "Silver" : filecount < 2000 ? "Gold" : "Platinum";
    const nextRankDelta = filecount < 200 ? 200 - filecount : filecount < 750 ? 750 - filecount : filecount < 2000 ? 2000 - filecount : 0;
    const {decoration, title} = SwordColors[rank as Rank];
    return React.createElement(
      WelcomeScreen,
      {},
      React.createElement(
        WelcomeScreen.Center,
        {},
        React.createElement(
          WelcomeScreen.Center.Logo,
          {},
          React.createElement(
            LogoWrapper,
            {},
            excalidrawSword(rank as Rank),
          ),
        ),
        React.createElement(
          WelcomeScreen.Center.Heading,
          {
            color: decoration,
            message: nextRankDelta > 0 ? `${rank}: ${nextRankDelta} more drawings until the next rank!` : `${rank}: You're at the top. Keep on being legendary!`,
          },
          title,
        ),
        React.createElement(
          WelcomeScreen.Center.Heading,
          {},
          "Type \"Excalidraw\" in the Command Palette",
          React.createElement("br"),
          "Explore the Obsidian Menu in the top right",
          React.createElement("br"),
          "Visit the Script Library",
          React.createElement("br"),
          "Find help in the hamburger-menu",
        ),
        React.createElement(
          WelcomeScreen.Center.Menu,
          {},
          React.createElement(
            WelcomeScreen.Center.MenuItemLink,
            {
              icon: ICONS.YouTube,
              href: "https://www.youtube.com/@VisualPKM",
              shortcut: null,
              "aria-label": "Visual PKM YouTube Channel",  
            },
            " Check out the Visual PKM YouTube channel."
          ),
          React.createElement(
            WelcomeScreen.Center.MenuItemLink,
            {
              icon: ICONS.Discord,
              href: "https://discord.gg/DyfAXFwUHc",
              shortcut: null,
              "aria-label": "Join the Discord Server",
            },
            " Join the Discord Server"
          ),
          React.createElement(
            WelcomeScreen.Center.MenuItemLink,
            {
              icon: ICONS.twitter,
              href: "https://twitter.com/zsviczian",
              shortcut: null,
              "aria-label": "Follow me on Twitter",
            },
            " Follow me on Twitter"
          ),
          React.createElement(
            WelcomeScreen.Center.MenuItemLink,
            {
              icon: ICONS.Learn,
              href: "https://visual-thinking-workshop.com",
              shortcut: null,
              "aria-label": "Learn Visual PKM",
            },
            " Sign up for the Visual Thinking Workshop"
          ),
          React.createElement(
            WelcomeScreen.Center.MenuItemLink,
            {
              icon: ICONS.heart,
              href: "https://ko-fi.com/zsolt",
              shortcut: null,
              "aria-label": "Donate to support Excalidraw-Obsidian",    
            },
            " Say \"Thank You\" & support the plugin."
          ),
        )
      )
    );
  }

  private renderCustomActionsMenu () {
    const React = this.packages.react;
    const {MainMenu} = this.packages.excalidrawLib;

    return React.createElement(
      MainMenu,          
      {},
      React.createElement(MainMenu.DefaultItems.ChangeCanvasBackground),
      React.createElement(MainMenu.DefaultItems.ToggleTheme),
      React.createElement(MainMenu.Separator),
      !DEVICE.isPhone ? React.createElement(
        MainMenu.Item,
        {              
          icon: ICONS.trayMode,
          "aria-label": t("ARIA_LABEL_TRAY_MODE"),
          onSelect: ()=> this.toggleTrayMode(),
        },
        "Toggle tray-mode"
      ) : null,
      React.createElement(
        MainMenu.Item,
        {              
          icon: saveIcon(false),
          "aria-label": t("FORCE_SAVE"),
          onSelect: ()=> this.forceSave(),
        },
        "Save"
      ),
      React.createElement(
        MainMenu.Item,
        {              
          icon: ICONS.scriptEngine,
          "aria-label": "Explore the Excalidraw Script Library",
          onSelect: ()=> this.actionOpenScriptInstallPrompt(),
        },
        "Script Library"
      ),
      React.createElement(
        MainMenu.Item,
        {              
          icon: ICONS.ExportImage,
          "aria-label": "Export image as PNG, SVG, or Excalidraw file",
          onSelect: ()=> this.actionOpenExportImageDialog(),
        },
        "Export Image..."
      ),
      React.createElement(
        MainMenu.Item,
        {              
          icon: ICONS.switchToMarkdown,
          "aria-label": "Switch to markdown view",
          onSelect: ()=> this.openAsMarkdown(),
        },
        "Open as Markdown"
      ),
      React.createElement(MainMenu.Separator),
      React.createElement(MainMenu.DefaultItems.Help),
      React.createElement(MainMenu.DefaultItems.ClearCanvas),
    );
  }

  private renderEmbeddable (element: NonDeletedExcalidrawElement, appState: UIAppState) {
    const React = this.packages.react;
    try {
      const useExcalidrawFrame = useDefaultExcalidrawFrame(element);

      if(!this.file || !element || !element.link || element.link.length === 0 || useExcalidrawFrame) {
        return null;
      }

      if(element.link.match(REG_LINKINDEX_HYPERLINK) || element.link.startsWith("data:")) {
        if(!useExcalidrawFrame) {
          return renderWebView(element.link, this, element.id, appState);
        } else {
          return null;
        }
      }

      const res = REGEX_LINK.getRes(element.link).next();
      if(!res || (!res.value && res.done)) {
        return null;
      }
    
      let linkText = REGEX_LINK.getLink(res);
    
      if(linkText.match(REG_LINKINDEX_HYPERLINK)) {
        if(!useExcalidrawFrame) {
          return renderWebView(linkText, this, element.id, appState);
        } else {
          return null;
        }
      }
      
      return React.createElement(CustomEmbeddable, {element,view:this, appState, linkText});
    } catch(e) {
      return null;
    }
  }

  private renderEmbeddableMenu(appState: AppState) {
    return this.embeddableMenu?.renderButtons(appState);
  }

  private renderToolsPanel(observer: any) {
    const React = this.packages.react;

    return React.createElement(
      ToolsPanel, 
      {
        ref: this.toolsPanelRef,
        visible: false,
        view: new WeakRef(this),
        centerPointer: ()=>this.setCurrentPositionToCenter(),
        observer: new WeakRef(observer.current),
      }
    );
  }

  private renderTopRightUI (isMobile: boolean, appState: AppState) {
    return this.obsidianMenu?.renderButton (isMobile, appState);
  }

  private onExcalidrawResize () {
    try {
      const api = this.excalidrawAPI as ExcalidrawImperativeAPI;
      if(!api) return;
      const width = this.contentEl.clientWidth;
      const height = this.contentEl.clientHeight;
      if(width === 0 || height === 0) return;
      
      //this is an aweful hack to prevent the on-screen keyboard pushing the canvas out of view.
      //The issue is that contrary to Excalidraw.com where the page is simply pushed up, in 
      //Obsidian the leaf has a fixed top. As a consequence the top of excalidrawWrapperDiv does not get pushed out of view
      //but shirnks. But the text area is positioned relative to excalidrawWrapperDiv and consequently does not fit, which
      //the distorts the whole layout.
      //I hope to grow up one day and clean up this mess of a workaround, that resets the top of excalidrawWrapperDiv
      //to a negative value, and manually scrolls back elements that were scrolled off screen
      //I tried updating setDimensions with the value for top... but setting top and height using setDimensions did not do the trick
      //I found that adding and removing this style solves the issue.
      //...again, just aweful, but works.
      const st = api.getAppState();
      //isEventOnSameElement attempts to solve https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1729
      //the issue is that when the user hides the keyboard with the keyboard hide button and not tapping on the screen, then editingElement is not null
      const isEventOnSameElement = this.editingTextElementId === st.editingElement?.id;
      const isKeyboardOutEvent:Boolean = st.editingElement && st.editingElement.type === "text" && !isEventOnSameElement;
      const isKeyboardBackEvent:Boolean = (this.semaphores.isEditingText || isEventOnSameElement) && !isKeyboardOutEvent;
      this.editingTextElementId = isKeyboardOutEvent ? st.editingElement.id : null;
      if(isKeyboardOutEvent) {
        const appToolHeight = (this.contentEl.querySelector(".Island.App-toolbar") as HTMLElement)?.clientHeight ?? 0;
        const editingElViewY = sceneCoordsToViewportCoords({sceneX:0, sceneY:st.editingElement.y}, st).y;
        const scrollViewY = sceneCoordsToViewportCoords({sceneX:0, sceneY:-st.scrollY}, st).y;
        const delta = editingElViewY - scrollViewY;
        const isElementAboveKeyboard = height > (delta + appToolHeight*2)
        const excalidrawWrapper = this.excalidrawWrapperRef.current;
        //console.log({isElementAboveKeyboard});
        if(excalidrawWrapper && !isElementAboveKeyboard) {
          excalidrawWrapper.style.top = `${-(st.height - height)}px`;
          excalidrawWrapper.style.height = `${st.height}px`;
          this.excalidrawContainer?.querySelector(".App-bottom-bar")?.scrollIntoView();
          //@ts-ignore
          this.headerEl?.scrollIntoView();
        }
      }
      if(isKeyboardBackEvent) {
        const excalidrawWrapper = this.excalidrawWrapperRef.current;
        const appButtonBar = this.excalidrawContainer?.querySelector(".App-bottom-bar");
        //@ts-ignore
        const headerEl = this.headerEl;
        if(excalidrawWrapper) {
          excalidrawWrapper.style.top = "";
          excalidrawWrapper.style.height = "";
          appButtonBar?.scrollIntoView();
          headerEl?.scrollIntoView();
        }
      }
      //end of aweful hack
      
      if (this.toolsPanelRef && this.toolsPanelRef.current) {
        this.toolsPanelRef.current.updatePosition();
      }
      if(this.ownerDocument !== document) {
        this.refreshCanvasOffset(); //because resizeobserver in Excalidraw does not seem to work when in Obsidian Window
      }
    } catch (err) {
      errorlog({
        where: "Excalidraw React-Wrapper, onResize",
        error: err,
      });
    }
  };

  private excalidrawRootElement(
    initdata: {
      elements: any,
      appState: any,
      files: any,
      libraryItems: any
    },
  ) {
    const React = this.packages.react;
    const {Excalidraw} = this.packages.excalidrawLib;

    const excalidrawWrapperRef = React.useRef(null);
    const toolsPanelRef = React.useRef(null);
    const embeddableMenuRef = React.useRef(null);
    this.toolsPanelRef = toolsPanelRef;
    // const [dimensions, setDimensions] = React.useState({
    //   width: undefined,
    //   height: undefined,
    // });

    React.useEffect(() => {
      this.embeddableMenuRef = embeddableMenuRef;
      this.obsidianMenu = new ObsidianMenu(this.plugin, toolsPanelRef, this);
      this.embeddableMenu = new EmbeddableMenu(this, embeddableMenuRef);
      this.excalidrawWrapperRef = excalidrawWrapperRef;
      return () => {
        this.obsidianMenu.destroy();
        this.obsidianMenu = null;
        this.embeddableMenu.destroy();
        this.embeddableMenu = null;
        this.toolsPanelRef.current = null;
        this.embeddableMenuRef.current = null;
        this.excalidrawWrapperRef.current = null;
      }
    }, []);

    //React.useEffect(() => {
    //   setDimensions({
    //     width: this.contentEl.clientWidth,
    //     height: this.contentEl.clientHeight,
    //   });

    //   const onResize = () => {
    //     const width = this.contentEl.clientWidth;
    //     const height = this.contentEl.clientHeight;
    //     setDimensions({ width, height });
    //   };

    //   this.ownerWindow.addEventListener("resize", onResize);
    //   return () => {
    //     this.ownerWindow.removeEventListener("resize", onResize);
    //   };
    // }, [excalidrawWrapperRef]);

    const observer = React.useRef(
      new ResizeObserver((entries) => {
        if(!toolsPanelRef || !toolsPanelRef.current) return;
        const { width, height } = entries[0].contentRect;
        if(width===0 || height ===0) return;
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
      if (toolsPanelRef?.current) {
        observer.current.observe(toolsPanelRef.current.containerRef.current);
      }
      return () => {
        //unobserve is done in ToolsPanel componentWillUnmount
      };
    }, [toolsPanelRef, observer]);

    //---------------------------------------------------------------------------------
    //---------------------------------------------------------------------------------
    // Render Excalidraw DIV
    //---------------------------------------------------------------------------------
    //---------------------------------------------------------------------------------
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(
        "div",
        {
          className: "excalidraw-wrapper",
          ref: excalidrawWrapperRef,
          key: "abc",
          tabIndex: 0,
          onKeyDown: this.excalidrawDIVonKeyDown.bind(this),
          onPointerDown: this.onPointerDown.bind(this),
          onMouseMove: this.onMouseMove.bind(this),
          onMouseOver: this.onMouseOver.bind(this),
          onDragOver : this.onDragOver.bind(this),
          onDragLeave: this.onDragLeave.bind(this),
        },
        React.createElement(
          Excalidraw,
          {
            excalidrawAPI: (this.setExcalidrawAPI.bind(this)),
            width: "100%", //dimensions.width,
            height: "100%", //dimensions.height,
            UIOptions:
            {
              canvasActions:
              {
                loadScene: false,
                saveScene: false,
                saveAsScene: false,
                export: false,
                saveAsImage: false,
                saveToActiveFile: false,
              },
            },
            initState: initdata?.appState,
            initialData: initdata,
            detectScroll: true,
            onPointerUpdate: this.onPointerUpdate.bind(this),
            libraryReturnUrl: "app://obsidian.md",
            autoFocus: true,
            langCode: obsidianToExcalidrawMap[this.plugin.locale]??"en-EN",
            aiEnabled: true,
            onChange: this.onChange.bind(this),
            onLibraryChange: this.onLibraryChange.bind(this),
            renderTopRightUI: this.renderTopRightUI.bind(this), //(isMobile: boolean, appState: AppState) => this.obsidianMenu.renderButton (isMobile, appState),
            renderEmbeddableMenu: this.renderEmbeddableMenu.bind(this),
            onPaste: this.onPaste.bind(this),
            onThemeChange: this.onThemeChange.bind(this),
            onDrop: this.onDrop.bind(this),
            onBeforeTextEdit: this.onBeforeTextEdit.bind(this),
            onBeforeTextSubmit: this.onBeforeTextSubmit.bind(this),
            onLinkOpen: this.onLinkOpen.bind(this),
            onLinkHover: this.onLinkHover.bind(this),
            onContextMenu: this.onContextMenu.bind(this),
            onViewModeChange: this.onViewModeChange.bind(this),
            validateEmbeddable: true,
            renderWebview: DEVICE.isDesktop,
            renderEmbeddable: this.renderEmbeddable.bind(this),
            renderMermaid: shouldRenderMermaid,
            obsidianHostPlugin: new WeakRef(this.plugin),
            showDeprecatedFonts: true,
          },
          this.renderCustomActionsMenu(),
          this.renderWelcomeScreen(),
          this.ttdDialog(),
          this.ttdDialogTrigger(),
        ),
        this.renderToolsPanel(observer),
      ),
    );
  }

  private async instantiateExcalidraw(
    initdata: {
      elements: any,
      appState: any,
      files: any,
      libraryItems: any
    }
  ) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.instantiateExcalidraw, "ExcalidrawView.instantiateExcalidraw", initdata);
    while(!this.semaphores.scriptsReady) {
      await sleep(50);
    }
    const React = this.packages.react;
    const ReactDOM = this.packages.reactDOM;
    //console.log("ExcalidrawView.instantiateExcalidraw()");
    this.clearDirty();

    this.excalidrawRoot = ReactDOM.createRoot(this.contentEl);
    this.excalidrawRoot.render(React.createElement(this.excalidrawRootElement.bind(this,initdata)));
  }

  private updateContainerSize(containerId?: string, delay: boolean = false, justloaded: boolean = false) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.updateContainerSize, "ExcalidrawView.updateContainerSize", containerId, delay);
    const api = this.excalidrawAPI;
    if (!api) {
      return;
    }
    const update = () => {
      const containers = containerId
        ? api
            .getSceneElements()
            .filter((el: ExcalidrawElement) => el.id === containerId && el.type!=="arrow")
        : api
            .getSceneElements()
            .filter(isContainer);
      if (containers.length > 0) {
        if (justloaded) {
          //updateContainerSize will bump scene version which will trigger a false autosave
          //after load, which will lead to a ping-pong between two synchronizing devices
          this.semaphores.justLoaded = true;
        }
        api.updateContainerSize(containers);
      }
    };
    if (delay) {
      window.setTimeout(() => update(), 50);
    } else {
      update();
    }
  }

  public zoomToFit(delay: boolean = true, justLoaded: boolean = false) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.zoomToFit, "ExcalidrawView.zoomToFit", delay, justLoaded);
    //view is closing via onWindowMigrated
    if(this.semaphores?.viewunload) {
      return;
    }
    const modalContainer = document.body.querySelector("div.modal-container");
    if(modalContainer) return; //do not autozoom when the command palette or other modal container is envoked on iPad
    const api = this.excalidrawAPI;
    if (!api || this.semaphores.isEditingText || this.semaphores.preventAutozoom) {
      return;
    }
    if (windowMigratedDisableZoomOnce) {
      windowMigratedDisableZoomOnce = false;
      return;
    }
    const maxZoom = this.plugin.settings.zoomToFitMaxLevel;
    const elements = api.getSceneElements().filter((el:ExcalidrawElement)=>el.width<10000 && el.height<10000);
    if((DEVICE.isMobile && elements.length>1000) || elements.length>2500) {
      if(justLoaded) api.scrollToContent();
      return;
    }
    if (delay) {
      //time for the DOM to render, I am sure there is a more elegant solution
      window.setTimeout(
        () => api.zoomToFit(elements, maxZoom, this.isFullscreen() ? 0 : 0.05),
        100,
      );
    } else {
      api.zoomToFit(elements, maxZoom, this.isFullscreen() ? 0 : 0.05);
    }
  }

  public updatePinnedScripts() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.updatePinnedScripts, "ExcalidrawView.updatePinnedScripts");
    const api = this.excalidrawAPI as ExcalidrawImperativeAPI;
    if (!api) {
      return false;
    }
    api.updateScene({
      appState: { pinnedScripts: this.plugin.settings.pinnedScripts },
      storeAction: "update",
    });
  }

  public updatePinnedCustomPens() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.updatePinnedCustomPens, "ExcalidrawView.updatePinnedCustomPens");
    const api = this.excalidrawAPI as ExcalidrawImperativeAPI;
    if (!api) {
      return false;
    }
    api.updateScene({
      appState: { 
        customPens: this.plugin.settings.customPens.slice(0,this.plugin.settings.numberOfCustomPens),
      },
      storeAction: "update",
    });
  }

  public updatePinchZoom() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.updatePinchZoom, "ExcalidrawView.updatePinchZoom");
    const api = this.excalidrawAPI as ExcalidrawImperativeAPI;
    if (!api) {
      return false;
    }
    api.updateScene({
      appState: { allowPinchZoom: this.plugin.settings.allowPinchZoom },
      storeAction: "update",
    });
  }

  public updateWheelZoom() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.updateWheelZoom, "ExcalidrawView.updateWheelZoom");
    const api = this.excalidrawAPI as ExcalidrawImperativeAPI;
    if (!api) {
      return false;
    }
    api.updateScene({
      appState: { allowWheelZoom: this.plugin.settings.allowWheelZoom },
      storeAction: "update",
    });
  }

  public async toggleTrayMode() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.toggleTrayMode, "ExcalidrawView.toggleTrayMode");
    const api = this.excalidrawAPI as ExcalidrawImperativeAPI;
    if (!api) {
      return false;
    }
    const st = api.getAppState();
    api.updateScene({
      appState: { trayModeEnabled: !st.trayModeEnabled },
      storeAction: "update",
    });

    //just in case settings were updated via Obsidian sync
    await this.plugin.loadSettings();
    this.plugin.settings.defaultTrayMode = !st.trayModeEnabled;
    this.plugin.saveSettings();
  }

  /**
   * 
   * @param elements 
   * @param query 
   * @param selectResult 
   * @param exactMatch 
   * @param selectGroup 
   * @returns true if element found, false if no element is found.
   */

  public selectElementsMatchingQuery(
    elements: ExcalidrawElement[],
    query: string[],
    selectResult: boolean = true,
    exactMatch: boolean = false, //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/530
    selectGroup: boolean = false,
  ):boolean {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.selectElementsMatchingQuery, "ExcalidrawView.selectElementsMatchingQuery", query, selectResult, exactMatch, selectGroup);
    let match = getTextElementsMatchingQuery(
      elements.filter((el: ExcalidrawElement) => el.type === "text"),
      query,
      exactMatch
    ).concat(getFrameElementsMatchingQuery(
      elements.filter((el: ExcalidrawElement) => el.type === "frame"),
      query,
      exactMatch
    )).concat(getElementsWithLinkMatchingQuery(
      elements.filter((el: ExcalidrawElement) => el.link),
      query,
      exactMatch
    ));

    if (match.length === 0) {
      new Notice(t("NO_SEARCH_RESULT"));
      return false;
    }

    if(selectGroup) {
      const groupElements = this.plugin.ea.getElementsInTheSameGroupWithElement(match[0],elements)
      if(groupElements.length>0) {
        match = groupElements;
      }
    }

    this.zoomToElements(selectResult,match);
    return true;
  }

  public zoomToElements(
    selectResult: boolean,
    elements: ExcalidrawElement[]
  ) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.zoomToElements, "ExcalidrawView.zoomToElements", selectResult, elements);
    const api = this.excalidrawAPI;
    if (!api) return;

    const zoomLevel = this.plugin.settings.zoomToFitMaxLevel;
    if (selectResult) {
      api.selectElements(elements, true);
    }
    api.zoomToFit(elements, zoomLevel, 0.05);
  }

  public getViewElements(): ExcalidrawElement[] {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.getViewElements, "ExcalidrawView.getViewElements");
    const api = this.excalidrawAPI;
    if (!api) {
      return [];
    }
    return api.getSceneElements();
  }

  /**
   * 
   * @param deepSelect: if set to true, child elements of the selected frame will also be selected
   * @returns 
   */
  public getViewSelectedElements(includFrameChildren: boolean = true): ExcalidrawElement[] {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.getViewSelectedElements, "ExcalidrawView.getViewSelectedElements");
    const api = this.excalidrawAPI as ExcalidrawImperativeAPI;
    if (!api) {
      return [];
    }
    const selectedElements = api.getAppState()?.selectedElementIds;
    if (!selectedElements) {
      return [];
    }
    const selectedElementsKeys = Object.keys(selectedElements);
    if (!selectedElementsKeys) {
      return [];
    }

    const elementIDs = new Set<string>();

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

    if(includFrameChildren && elements.some(el=>el.type === "frame")) {
      elements.filter(el=>el.type === "frame").forEach(frameEl => {
        api.getSceneElements()
          .filter(el=>el.frameId === frameEl.id)
          .forEach(el=>elementIDs.add(el.id))
      })
    }

    elements.forEach(el=>elementIDs.add(el.id));
    containerBoundTextElmenetsReferencedInElements.forEach(id=>elementIDs.add(id));

    return api
      .getSceneElements()
      .filter((el: ExcalidrawElement) => elementIDs.has(el.id));
  }

  /**
   * 
   * @param prefix - defines the default button. 
   * @returns 
   */
  public async copyLinkToSelectedElementToClipboard(prefix:string) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.copyLinkToSelectedElementToClipboard, "ExcalidrawView.copyLinkToSelectedElementToClipboard", prefix);
    const elements = this.getViewSelectedElements();
    if (elements.length < 1) {
      new Notice(t("INSERT_LINK_TO_ELEMENT_ERROR"));
      return;
    }

    let elementId:string = undefined;

    if(elements.length === 2) {
      const textEl = elements.filter(el=>el.type==="text");
      if(textEl.length===1 && (textEl[0] as ExcalidrawTextElement).containerId) {
        const container = elements.filter(el=>el.boundElements.some(be=>be.type==="text"))
        if(container.length===1) {
          elementId = textEl[0].id;
        }
      }
    }

    if(!elementId) {
      elementId = elements.length === 1 
        ? elements[0].id
        : this.plugin.ea.getLargestElement(elements).id;
    }

    const frames = elements.filter(el=>el.type==="frame");
    const hasFrame = frames.length === 1;
    const hasGroup = elements.some(el=>el.groupIds && el.groupIds.length>0);

    let button = {
      area: {caption: "Area", action:()=>{prefix="area="; return;}},
      link: {caption: "Link", action:()=>{prefix="";return}},
      group: {caption: "Group", action:()=>{prefix="group="; return;}},
      frame: {caption: "Frame", action:()=>{prefix="frame="; elementId = frames[0].id; return;}},
      clippedframe: {caption: "Clipped Frame", action:()=>{prefix="clippedframe="; ; elementId = frames[0].id; return;}},
    }

    let buttons = [];
    switch(prefix) {
      case "area=":
        buttons = [
          button.area,
          button.link,
          ...hasGroup ? [button.group] : [],
          ...hasFrame ? [button.frame, button.clippedframe] : [],
        ];
        break;  
      case "group=":
        buttons = [
          ...hasGroup ? [button.group] : [],
          button.link,
          button.area,
          ...hasFrame ? [button.frame, button.clippedframe] : [],
        ];
        break;
      case "frame=":
        buttons = [
          ...hasFrame ? [button.frame, button.clippedframe] : [],
          ...hasGroup ? [button.group] : [],
          button.link,
          button.area,
        ];
        break;
      case "clippedframe=":
        buttons = [
          ...hasFrame ? [button.clippedframe, button.frame] : [],
          ...hasGroup ? [button.group] : [],
          button.link,
          button.area,
        ];
        break;
      default:
        buttons = [
          {caption: "Link", action:()=>{prefix="";return}},
          {caption: "Area", action:()=>{prefix="area="; return;}},
          {caption: "Group", action:()=>{prefix="group="; return;}},
          ...hasFrame ? [button.frame, button.clippedframe] : [],
        ]
    }

    const alias = await ScriptEngine.inputPrompt(
      this,
      this.plugin,
      this.app,
      "Set link alias",
      "Leave empty if you do not want to set an alias",
      "",
      buttons,
    );
    navigator.clipboard.writeText(
      `${prefix.length>0?"!":""}[[${this.file.path}#^${prefix}${elementId}${alias ? `|${alias}` : ``}]]`,
    );
    new Notice(t("INSERT_LINK_TO_ELEMENT_READY"));
  }

  public updateScene(
    scene: {
      elements?: ExcalidrawElement[];
      appState?: any;
      files?: any;
      storeAction?: "capture" | "none" | "update"; //https://github.com/excalidraw/excalidraw/pull/7898
    },
    shouldRestore: boolean = false,
  ) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.updateScene, "ExcalidrawView.updateScene", scene, shouldRestore);
    const api = this.excalidrawAPI;
    if (!api) {
      return;
    }
    const shouldRestoreElements = scene.elements && shouldRestore;
    if (shouldRestoreElements) {
      scene.elements = restore(scene, null, null).elements;
    }
    if(Boolean(scene.appState)) {
      //@ts-ignore
      scene.forceFlushSync = true;
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
          scene.elements = restore(scene, null, null).elements;
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

  public updateEmbeddableRef(id: string, ref: HTMLIFrameElement | HTMLWebViewElement | null) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.updateEmbeddableRef, "ExcalidrawView.updateEmbeddableRef", id, ref);
    if (ref) {
      this.embeddableRefs.set(id, ref);
    }
  }

  public getEmbeddableElementById(id: string): HTMLIFrameElement | HTMLWebViewElement | undefined {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.getEmbeddableElementById, "ExcalidrawView.getEmbeddableElementById", id);
    return this.embeddableRefs.get(id);
  }

  public updateEmbeddableLeafRef(id: string, ref: any) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.updateEmbeddableLeafRef, "ExcalidrawView.updateEmbeddableLeafRef", id, ref);
    if(ref) {
      this.embeddableLeafRefs.set(id, ref);
    }
  }

  public getEmbeddableLeafElementById(id: string): {leaf: WorkspaceLeaf; node?: ObsidianCanvasNode; editNode?: Function} | null {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.getEmbeddableLeafElementById, "ExcalidrawView.getEmbeddableLeafElementById", id);
    if(!id) return null;
    const ref = this.embeddableLeafRefs.get(id);
    if(!ref) {
      return null;
    }
    return ref as {leaf: WorkspaceLeaf; node?: ObsidianCanvasNode; editNode?: Function};
  }

  public getActiveEmbeddable ():{leaf: WorkspaceLeaf; node?: ObsidianCanvasNode; editNode?: Function}|null {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.getActiveEmbeddable, "ExcalidrawView.getActiveEmbeddable");
    if(!this.excalidrawAPI) return null;
    const api = this.excalidrawAPI as ExcalidrawImperativeAPI;
    const st = api.getAppState();
    if(!st.activeEmbeddable || st.activeEmbeddable.state !== "active" ) return null;
    return this.getEmbeddableLeafElementById(st.activeEmbeddable?.element?.id);
  }

  get editor(): any {
    const embeddable = this.getActiveEmbeddable();
    if(embeddable) {
      if(embeddable.node && embeddable.node.isEditing) {
        return embeddable.node.child.editor;
      }
      if(embeddable.leaf?.view instanceof MarkdownView) {
        return embeddable.leaf.view.editor;
      }
    }
    return null;
  }
}

export function getTextMode(data: string): TextMode {
  (process.env.NODE_ENV === 'development') && DEBUGGING && debug(getTextMode, "ExcalidrawView.getTextMode", data);
  const parsed =
    data.search("excalidraw-plugin: parsed\n") > -1 ||
    data.search("excalidraw-plugin: locked\n") > -1; //locked for backward compatibility
  return parsed ? TextMode.parsed : TextMode.raw;
}
