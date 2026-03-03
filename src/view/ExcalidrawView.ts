import {
  TextFileView,
  WorkspaceLeaf,
  TFile,
  WorkspaceItem,
  Notice,
  Menu,
  MarkdownView,
  request,
  requireApiVersion,
  HoverParent,
  HoverPopover,
} from "obsidian";
//import * as React from "react";
//import * as ReactDOM from "react-dom";
//import Excalidraw from "@zsviczian/excalidraw";
import {
  ExcalidrawElement,
  ExcalidrawImageElement,
  ExcalidrawMagicFrameElement,
  ExcalidrawTextElement,
  FileId,
  NonDeletedExcalidrawElement,
} from "@zsviczian/excalidraw/types/element/src/types";
import {
  AppState,
  BinaryFileData,
  DataURL,
  ExcalidrawImperativeAPI,
  Gesture,
  LibraryItems,
  SceneData,
  UIAppState,
} from "@zsviczian/excalidraw/types/excalidraw/types";
import {
  VIEW_TYPE_EXCALIDRAW,
  ICON_NAME,
  DISK_ICON_NAME,
  SCRIPTENGINE_ICON_NAME,
  TEXT_DISPLAY_RAW_ICON_NAME,
  IMAGE_TYPES,
  KEYCODE,
  FRONTMATTER_KEYS,
  DEVICE,
  GITHUB_RELEASES,
  EXPORT_IMG_ICON_NAME,
  viewportCoordsToSceneCoords,
  ERROR_IFRAME_CONVERSION_CANCELED,
  restoreElements,
  obsidianToExcalidrawMap,
  MAX_IMAGE_SIZE,
  fileid,
  MD_EX_SECTIONS,
  refreshTextDimensions,
  getContainerElement,
  syncInvalidIndices,
  VIEW_TYPE_SIDEPANEL,
  sceneCoordsToViewportCoords,
} from "../constants/constants";
import ExcalidrawPlugin from "../core/main";
import { ExcalidrawAutomate } from "../shared/ExcalidrawAutomate";
import { ExcalidrawSidepanelView } from "./sidepanel/Sidepanel";
import { 
  repositionElementsToCursor,
  getTextElementsMatchingQuery,
  cloneElement,
  getFrameElementsMatchingQuery,
  getElementsWithLinkMatchingQuery,
  getImagesMatchingQuery,
  getBoundTextElementId,
  getEmbeddedFileForImageElment
} from "../utils/excalidrawAutomateUtils";
import { t } from "../lang/helpers";
import {
  ExcalidrawData,
  REG_LINKINDEX_HYPERLINK,
  REGEX_LINK,
  AutoexportPreference,
  getExcalidrawMarkdownHeaderSection,
} from "../shared/ExcalidrawData";
import {
  checkAndCreateFolder,
  createFileAndAwaitMetacacheUpdate,
  createOrOverwriteFile,
  download,
  exportImageToFile,
  getDataURLFromURL,
  getIMGFilename,
  getMimeType,
  getNewUniqueFilepath,
  getURLImageExtension,
} from "../utils/fileUtils";
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
  hyperlinkIsImage,
  getYouTubeThumbnailLink,
  isContainer,
  fragWithHTML,
  isMaskFile,
  _getContainerElement,
  arrayToMap,
  addAppendUpdateCustomData,
  getFilePathFromObsidianURL,
  getLinkParts,
  checkVersionMismatch,
  calculateUIModeValue,
  getExportInternalLinks,
} from "../utils/utils";
import { cleanBlockRef, cleanSectionHeading, closeLeafView, getAttachmentsFolderAndFilePath, getExcalidraAndMarkdowViewsForFile, getLeaf, getParentOfClass, obsidianPDFQuoteWithRef, openLeaf, setExcalidrawView } from "../utils/obsidianUtils";
import { splitFolderAndFilename } from "../utils/fileUtils";
import { GenericInputPrompt, LaTexPrompt, MultiOptionConfirmationPrompt, NewFileActions, Prompt, linkPrompt } from "../shared/Dialogs/Prompt";
import { ClipboardData, ParsedDataTransferFile } from "@zsviczian/excalidraw/types/excalidraw/clipboard";
import { updateEquation } from "../shared/LaTeX";
import {
  EmbeddedFile,
  EmbeddedFilesLoader,
  generateIdFromFile,
} from "../shared/EmbeddedFileLoader";
import { ScriptInstallPrompt } from "../shared/Dialogs/ScriptInstallPrompt";
import { ObsidianMenu } from "./components/menu/ObsidianMenu";
import { ToolsPanel } from "./components/menu/ToolsPanel";
import { ScriptEngine } from "../shared/Scripts";
import { getTextElementAtPointer, getImageElementAtPointer, getElementWithLinkAtPointer } from "../utils/getElementAtPointer";
import { excalidrawSword, getTrayIcon, ICONS, LogoWrapper, Rank, saveIcon, SwordColors } from "../constants/actionIcons";
import { ExportDialog } from "../shared/Dialogs/ExportDialog";
import { getEA } from "src/core"
import { anyModifierKeysPressed, emulateKeysForLinkClick, isWinALTorMacOPT, isWinCTRLorMacCMD, isWinMETAorMacCTRL, isSHIFT, linkClickModifierType, ModifierKeys } from "../utils/modifierkeyHelper";
import { setDynamicStyle } from "../utils/dynamicStyling";
import { CustomEmbeddable, renderWebView } from "./components/CustomEmbeddable";
import { addBackOfTheNoteCard, deleteAppStateKeys, getExcalidrawFileForwardLinks, getFrameBasedOnFrameNameOrId, getLinkTextFromLink, insertEmbeddableToView, insertImageToView, isTextImageTransclusion, onLoadMessages, openExternalLink, parseObsidianLink, renderContextMenuAction, sceneRemoveInternalLinks, setMobileNavbarPosition, tmpBruteForceCleanup, toggleImageAnchoring } from "../utils/excalidrawViewUtils";
import { imageCache } from "../shared/ImageCache";
import { CanvasNodeFactory, ObsidianCanvasNode } from "./managers/CanvasNodeFactory";
import { EmbeddableMenu } from "./components/menu/EmbeddableActionsMenu";
import { useDefaultExcalidrawFrame } from "../utils/customEmbeddableUtils";
import { UniversalInsertFileModal } from "../shared/Dialogs/UniversalInsertFileModal";
import { getMermaidText, shouldRenderMermaid } from "../utils/mermaidUtils";
import { nanoid } from "nanoid";
import { CustomMutationObserver, DEBUGGING, debug, log} from "../utils/debugHelper";
import { errorHTML, extractCodeBlocks } from "../utils/AIUtils";
import { Mutable } from "@zsviczian/excalidraw/types/common/src/utility-types";
import { SelectCard } from "../shared/Dialogs/SelectCard";
import { Packages } from "../types/types";
import React from "react";
import { diagramToHTML } from "../utils/matic";
import { IS_WORKER_SUPPORTED } from "../shared/Workers/compression-worker";
import { AutoexportConfig, Position, ViewSemaphores } from "../types/excalidrawViewTypes";
import { DropManager } from "./managers/DropManager";
import { ImageInfo } from "src/types/excalidrawAutomateTypes";
import { exportPNG, exportPNGToClipboard, exportSVG, exportToPDF, getMarginValue, getPageDimensions } from "src/utils/exportUtils";
import { PageOrientation, PageSize, ExportSettings } from "src/types/exportUtilTypes";
import { CaptureUpdateAction } from "src/constants/constants";
import { updateElementIdsInScene } from "src/utils/excalidrawSceneUtils";
import { FileData } from "src/types/embeddedFileLoaderTypes";
import { UIMode } from "src/shared/Dialogs/UIModeSettingComponent";
import { UIModeSettings } from "src/shared/Dialogs/UIModeSettings";
import { copyLinkToSelectedElementToClipboard } from "src/shared/Dialogs/copyLinkToSelectedElement";
import { getPDFCropRect } from "src/utils/PDFUtils";
import { ttdPersistenceAdapter } from "src/shared/TTDDialogPersistanceAdater";
import { CaptureUpdateActionType } from "@zsviczian/excalidraw/types/element/src";

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
  // update element.crop naturalWidth and naturalHeight in case scale of PDF loading has changed
  // update crop.x crop.y, crop.width, crop.height according to the new scale
  files
    .filter((f:FileData) => view.excalidrawData.getFile(f.id)?.file?.extension === "pdf")
    .forEach((f:FileData) => {
      s.scene.elements
        .filter((el:ExcalidrawElement)=>el.type === "image" && el.fileId === f.id && (
          (el.crop && el.crop?.naturalWidth !== f.size.width) || !el.customData?.pdfPageViewProps
        ))
        .forEach((el:Mutable<ExcalidrawImageElement>) => {
          if(el.crop) {
            s.dirty = true;
            const scale = f.size.width / el.crop.naturalWidth;
            el.crop = {
              x: el.crop.x * scale,
              y: el.crop.y * scale,
              width: el.crop.width * scale,
              height: el.crop.height * scale,
              naturalWidth: f.size.width,
              naturalHeight: f.size.height,
            };
          }
          if(!el.customData?.pdfPageViewProps) {
            s.dirty = true;
            addAppendUpdateCustomData(el, { pdfPageViewProps: f.pdfPageViewProps});
          }
        });
    });

  if (s.dirty) {
    //debug({where:"ExcalidrawView.addFiles",file:view.file.name,dataTheme:view.excalidrawData.scene.appState.theme,before:"updateScene",state:scene.appState})
    view.updateScene({
      elements: s.scene.elements,
      appState: s.scene.appState,
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }
  for (const f of files) {
    if (view.excalidrawData.hasFile(f.id)) {
      const embeddedFile = view.excalidrawData.getFile(f.id);

      embeddedFile.setImage({
        imgBase64: f.dataURL,
        mimeType: f.mimeType,
        size: f.size,
        isDark,
        isSVGwithBitmap: f.hasSVGwithBitmap,
        pdfPageViewProps: f.pdfPageViewProps,
      });
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

type ActionButtons = "save" | "isRaw" | "link" | "scriptInstall";

let windowMigratedDisableZoomOnce = false;

export default class ExcalidrawView extends TextFileView implements HoverParent{
  private dropManager: DropManager;
  public hoverPopover: HoverPopover;
  private freedrawLastActiveTimestamp: number = 0;
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
  public currentPosition: Position = { x: 0, y: 0 }; //these are scene coord thus would be more apt to call them sceneX and sceneY, however due to scrits already using x and y, I will keep it as is
  //Obsidian 0.15.0
  public canvasNodeFactory: CanvasNodeFactory;
  private embeddableRefs = new Map<ExcalidrawElement["id"], HTMLIFrameElement | HTMLWebViewElement>();
  private embeddableLeafRefs = new Map<ExcalidrawElement["id"], any>();

  public semaphores: ViewSemaphores | null = {
    warnAboutLinearElementLinkClick: true,
    embeddableIsEditingSelf: false,
    popoutUnload: false,
    viewloaded: false,
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
    shouldSaveImportedImage: false,
  };

  public _plugin: ExcalidrawPlugin;
  public autosaveTimer: any = null;
  public textMode: TextMode = TextMode.raw;
  private actionButtons: Record<ActionButtons, HTMLElement> = {} as Record<ActionButtons, HTMLElement>;
  public compatibilityMode: boolean = false;
  private obsidianMenu: ObsidianMenu;
  private embeddableMenu: EmbeddableMenu;
  private destroyers: Function[] = [];
  private previousContentElHeight: number = 0;
  private resizeBatchTimer: number = null;
  private resizeBatchWindowStart: number = 0;
  private lastAggregatedDh = 0;
  private oldKeyboardScroll:{scrollY:number, scrollX:number}|null = null;

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
    this.excalidrawData = new ExcalidrawData(plugin, this);
    this.canvasNodeFactory = new CanvasNodeFactory(this);
    this.setHookServer();
    this.dropManager = new DropManager(this);
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

  get isInMainObsidianWorkspace(): boolean {
    return document === this.ownerDocument;
  }

  setHookServer(ea?:ExcalidrawAutomate) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.setHookServer, "ExcalidrawView.setHookServer", ea);
    if(ea) {
      this._hookServer = ea;
    } else {
      this._hookServer = this._plugin.ea;
    }
  }

  public getHookServer () {
    return this.hookServer ?? this.plugin.ea;
  }

  preventAutozoom() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.preventAutozoom, "ExcalidrawView.preventAutozoom");
    this.semaphores.preventAutozoom = true;
    window.setTimeout(() => {
      if(!this.semaphores) return;
      this.semaphores.preventAutozoom = false;
    }, 1500);
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
    exportImageToFile(this, filepath, JSON.stringify(scene, null, "\t"), ".excalidraw");
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
        const path = getNewUniqueFilepath(
          this.app.vault,
          filename,
          folderpath,
        );
        const file = await exportImageToFile(
          this,
          path,
          JSON.stringify(this.getScene(), null, "\t"),
          ".excalidraw",
        );
        new Notice(`Exported to ${file?.name}`, 6000);
      });
      return;
    }
    download(
      "data:text/plain;charset=utf-8",
      encodeURIComponent(JSON.stringify(this.getScene(selectedOnly), null, "\t")),
      `${this.file.basename}.excalidraw`,
    );
  }

  public getViewExportTheme(theme?:string):string {
    if(theme) return theme;
    if(!this.exportDialog) {
      this.exportDialog = new ExportDialog(this.plugin, this,this.file);
    }
    const ed = this.exportDialog;
    return ed ? ed.theme : getExportTheme(this.plugin, this.file, this.excalidrawAPI.getAppState().theme)
  }

  public getViewExportEmbedScene(embedScene?:boolean):boolean {
    if(!this.exportDialog) {
      this.exportDialog = new ExportDialog(this.plugin, this,this.file);
    }
    const ed = this.exportDialog;
    return typeof embedScene === "undefined"
      ? (ed ? ed.embedScene : false)
      : embedScene;
  }

  public getViewExportPadding(padding?: number): number {
    if(typeof padding !== "undefined") return padding;
    if(!this.exportDialog) {
      this.exportDialog = new ExportDialog(this.plugin, this,this.file);
    }
    const ed = this.exportDialog;
    return ed ? ed.padding : getExportPadding(this.plugin, this.file)
  }

  public getViewExportScale(scale?: number): number {
    if(typeof scale !== "undefined") return scale;
    if(!this.exportDialog) {
      this.exportDialog = new ExportDialog(this.plugin, this,this.file);
    }
    const ed = this.exportDialog;
    return ed ? ed.scale : getPNGScale(this.plugin, this.file);
  }

  public getViewExportWithBackground(withBackground?:boolean) {
    if(typeof withBackground !== "undefined") return withBackground;
    if(!this.exportDialog) {
      this.exportDialog = new ExportDialog(this.plugin, this,this.file);
    }
    const ed = this.exportDialog;
    return ed ? !ed.transparent : getWithBackground(this.plugin, this.file)
  }

  public getViewExportIncludeInternalLinks(includeInternalLinks?:boolean) {
    if(typeof includeInternalLinks !== "undefined") return includeInternalLinks;
    if(!this.exportDialog) {
      this.exportDialog = new ExportDialog(this.plugin, this,this.file);
    }
    const ed = this.exportDialog;
    return ed ? ed.exportInternalLinks : getExportInternalLinks(this.plugin, this.file)
  }

  private async loadFilesForExport(exportTheme: string): Promise<Record<FileId, BinaryFileData> | null> {
    const api = this.excalidrawAPI as ExcalidrawImperativeAPI;
    if (!api || !this.excalidrawData) {
      return null;
    }

    const viewTheme = api.getAppState().theme;
    if (!exportTheme || exportTheme === viewTheme) {
      return null;
    }

    const loader = new EmbeddedFilesLoader(this.plugin, exportTheme === "dark");
    const collected: Record<FileId, BinaryFileData> = {};
    let resolved = false;

    await new Promise<void>((resolve) => {
      loader.loadSceneFiles({
        excalidrawData: this.excalidrawData,
        addFiles: (files: FileData[], _isDark: boolean, final: boolean = true) => {
          if (files && files.length > 0) {
            files.forEach((f) => {
              collected[f.id] = { ...f } as BinaryFileData;
            });
          }
          if (final && !resolved) {
            resolved = true;
            resolve();
          }
        },
        depth: 0,
        isThemeChange: true,
      });
    });

    return Object.keys(collected).length ? collected : null;
  }
  
  public async svg(scene: any, theme?:string, embedScene?: boolean, embedFont: boolean = false): Promise<SVGSVGElement> {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.svg, "ExcalidrawView.svg", scene, theme, embedScene);

    const exportSettings: ExportSettings = {
      withBackground: this.getViewExportWithBackground(),
      withTheme: true,
      isMask: isMaskFile(this.plugin, this.file),
      skipInliningFonts: !embedFont,
    };

    const exportTheme = this.getViewExportTheme(theme);
    const overrideFiles = await this.loadFilesForExport(exportTheme);

    return await getSVG(
      {
        ...scene,
        ...{
          appState: {
            ...scene.appState,
            theme: exportTheme,
            exportEmbedScene: this.getViewExportEmbedScene(embedScene),
          },
        },
      },
      exportSettings,
      this.getViewExportPadding(),
      this.file,
      overrideFiles ?? undefined,
    );
  }

  public async saveSVG(data:{scene?: any, embedScene?: boolean, autoexportConfig?: AutoexportConfig }) {
    if(!data) {
      data = {};
    }
    let { scene, embedScene, autoexportConfig } = data;
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.saveSVG, "ExcalidrawView.saveSVG", scene, embedScene);
    if (!scene) {
      if (!this.excalidrawAPI) {
        return false;
      }
      scene = this.getScene();
    }

    const exportImage = async (filepath:string, theme?:string) => {
      const svg = await this.svg(scene,theme, embedScene, true);
      if (!svg) {
        return;
      }
      //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2026
      const svgString = svg.outerHTML;
      await exportImageToFile(this, filepath, svgString,
        theme === "dark" ? ".dark.svg" : theme === "light" ? ".light.svg" : ".svg");
    }

    if(autoexportConfig?.theme ? autoexportConfig.theme  === "both" : this.plugin.settings.autoExportLightAndDark) {
      await exportImage(getIMGFilename(this.file.path, "dark.svg"),"dark");
      await exportImage(getIMGFilename(this.file.path, "light.svg"),"light");
    } else {
      await exportImage(getIMGFilename(this.file.path, "svg"), autoexportConfig?.theme);
    } 
  }

  public async exportSVG(embedScene?: boolean, selectedOnly?: boolean):Promise<void> {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.exportSVG, "ExcalidrawView.exportSVG", embedScene, selectedOnly);
    if (!this.excalidrawAPI || !this.file) {
      return;
    }

    const scene = this.getScene(selectedOnly);
    if(!this.getViewExportIncludeInternalLinks()) {
      scene.elements = sceneRemoveInternalLinks(scene);
    }
    const svg = await this.svg(scene, undefined, embedScene, true);
    if (!svg) {
      return;
    }
    exportSVG(svg, this.file.basename);
  }

  public async getSVG(embedScene?: boolean, selectedOnly?: boolean):Promise<SVGSVGElement> {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.getSVG, "ExcalidrawView.getSVG", embedScene, selectedOnly);
    if (!this.excalidrawAPI || !this.file) {
      return;
    }

    const svg = await this.svg(this.getScene(selectedOnly),undefined,embedScene, true);
    if (!svg) {
      return;
    }
    return svg;
  }

  public async exportPDF(
    selectedOnly?: boolean,
    pageSize: PageSize = "A4",
    orientation: PageOrientation = "portrait"
  ): Promise<void> {
    if (!this.excalidrawAPI || !this.file) {
      return;
    }
  
    const scene = this.getScene(selectedOnly);
    if(!this.getViewExportIncludeInternalLinks()) {
      scene.elements = sceneRemoveInternalLinks(scene);
    }

    const svg = await this.svg(
      scene,
      undefined,
      false,
      true
    );
  
    if (!svg) {
      return;
    }

    const boundingBox = this.plugin.ea.getBoundingBox(scene.elements);
    const margin = getMarginValue(this.exportDialog.margin);
    const [width, height] = [boundingBox.width, boundingBox.height];

    exportToPDF({
      SVG: [svg],
      scale: {
        zoom: this.exportDialog.scale,
        fitToPage: pageSize === "MATCH IMAGE" || pageSize === "HD Screen"
          ? 1
          : this.exportDialog.fitToPage
      },
      pageProps: {
        dimensions: getPageDimensions(pageSize, orientation, {width, height}),
        backgroundColor: this.exportDialog.getPaperColor(),
        margin,
        alignment: this.exportDialog.alignment,
      },
      filename: this.file.basename+".pdf",
    });
  }

  public async png(scene: any, theme?:string, embedScene?: boolean): Promise<Blob> {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.png, "ExcalidrawView.png", scene, theme, embedScene);

    const exportSettings: ExportSettings = {
      withBackground: this.getViewExportWithBackground(),
      withTheme: true,
      isMask: isMaskFile(this.plugin, this.file),
    };

    const exportTheme = this.getViewExportTheme(theme);
    const overrideFiles = await this.loadFilesForExport(exportTheme);

    return await getPNG(
      {
        ...scene,
        ...{
          appState: {
            ...scene.appState,
            theme: exportTheme,
            exportEmbedScene: this.getViewExportEmbedScene(embedScene),
          },
        },
      },
      exportSettings,
      this.getViewExportPadding(),
      this.getViewExportScale(),
      overrideFiles ?? undefined,
    );
  }

  public async savePNG(data: {scene?: any, embedScene?: boolean, autoexportConfig?: AutoexportConfig}) {
    if(!data) {
      data = {};
    }
    let { scene, embedScene, autoexportConfig } = data;
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.savePNG, "ExcalidrawView.savePNG", scene, embedScene);
    if (!scene) {
      if (!this.excalidrawAPI) {
        return false;
      }
      scene = this.getScene();
    }

    const exportImage = async (filepath:string, theme?:string) => {
      const png = await this.png(scene, theme, embedScene);
      if (!png) {
        return;
      }
      await exportImageToFile(this, filepath, png,
        theme === "dark" ? ".dark.png" : theme === "light" ? ".light.png" : ".png");
    }

    if(autoexportConfig?.theme ? autoexportConfig.theme  === "both" : this.plugin.settings.autoExportLightAndDark) {
      await exportImage(getIMGFilename(this.file.path, "dark.png"),"dark");
      await exportImage(getIMGFilename(this.file.path, "light.png"),"light");
    } else {
      await exportImage(getIMGFilename(this.file.path, "png"), autoexportConfig?.theme);
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
    await exportPNGToClipboard(png);
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
    exportPNG(png, this.file.basename);
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

  public async setEmbeddableNodeIsEditing() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.setEmbeddableNodeIsEditing, "ExcalidrawView.setEmbeddableNodeIsEditing");
    this.clearEmbeddableNodeIsEditingTimer();
    this.semaphores.embeddableIsEditingSelf = true;
    await this.forceSave(true);
  }

  public clearEmbeddableNodeIsEditingTimer () {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.clearEmbeddableNodeIsEditingTimer, "ExcalidrawView.clearEmbeddableNodeIsEditingTimer");
    if(this.editingSelfResetTimer) {
      window.clearTimeout(this.editingSelfResetTimer);
      this.editingSelfResetTimer = null;
    }
  }

  public clearEmbeddableNodeIsEditing() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.clearEmbeddableNodeIsEditing, "ExcalidrawView.clearEmbeddableNodeIsEditing");
    this.clearEmbeddableNodeIsEditingTimer();
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

    const allowSave = this.isDirty() || forcesave; //removed this.semaphores.autosaving
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.save, `ExcalidrawView.save, try saving, allowSave:${allowSave}, isDirty:${this.isDirty()}, isAutosaving:${this.semaphores.autosaving}, isForceSaving:${forcesave}`);
    try {
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
        await this.prepareGetViewData();

        //added this to avoid Electron crash when terminating a popout window and saving the drawing, need to check back
        //can likely be removed once this is resolved: https://github.com/electron/electron/issues/40607
        if(this.semaphores?.viewunload) {
          await this.prepareGetViewData();
          const d = this.getViewData();
          const plugin = this.plugin;
          const file = this.file;
          window.setTimeout(async ()=>{
            if(!d) return;
            await plugin.app.vault.modify(file,d);
            //this is a shady edge case, don't scrifice the BAK file in case the drawing is empty
            //await imageCache.addBAKToCache(file.path,d);                        
          },200)
          this.semaphores.saving = false;
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
        const data = this.lastSavedData;
        //if the scene is empty, do not save to BAK (this could be due to a crash when the BAK should not be updated)
        if(scene && scene.elements && scene.elements.length > 0) {
          window.setTimeout(()=>imageCache.addBAKToCache(path,data),50);
        }
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
        let autoexportConfig: AutoexportConfig = {
          svg: (autoexportPreference === AutoexportPreference.inherit && this.plugin.settings.autoexportSVG) ||
            autoexportPreference === AutoexportPreference.both || autoexportPreference === AutoexportPreference.svg,
          png: (autoexportPreference === AutoexportPreference.inherit && this.plugin.settings.autoexportPNG) ||
            autoexportPreference === AutoexportPreference.both || autoexportPreference === AutoexportPreference.png,
          excalidraw: !this.compatibilityMode && this.plugin.settings.autoexportExcalidraw,
          theme: this.plugin.settings.autoExportLightAndDark ? "both" : this.getViewExportTheme() as "dark" | "light",
        }
        if (this.getHookServer().onTriggerAutoexportHook) {
          try {
            autoexportConfig = this.getHookServer().onTriggerAutoexportHook({
              excalidrawFile: this.file, autoexportConfig}) ?? autoexportConfig;
          } catch (e) {
            errorlog({where: "ExcalidrawView.save", fn: this.getHookServer().onTriggerAutoexportHook, error: e});
          }
        }
        
        if (autoexportConfig.svg) {
          this.saveSVG({autoexportConfig});
        }
        if (autoexportConfig.png) {
          this.savePNG({autoexportConfig});
        }
        if (autoexportConfig.excalidraw) {
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
    this.resetAutosaveTimer(); //next autosave period starts after save
  }

  // get the new file content
  // if drawing is in Text Element Edit Lock, then everything should be parsed and in sync
  // if drawing is in Text Element Edit Unlock, then everything is raw and parse and so an async function is not required here
  /**
   * I moved the logic from getViewData to prepareGetViewData because getViewData is Sync and prepareGetViewData is async
   * prepareGetViewData is async because of moving compression to a worker thread in 2.4.0
   */
  private viewSaveData: string = "";

  async prepareGetViewData(): Promise<void> {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.prepareGetViewData, "ExcalidrawView.prepareGetViewData");
    if (!this.excalidrawAPI || !this.excalidrawData.loaded) {
      this.viewSaveData = this.data;
      return;
    }

    const scene = this.getScene();
    if(!scene) { 
      this.viewSaveData = this.data;
      return;
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
            [FRONTMATTER_KEYS["export-internal-links"].name, this.exportDialog.exportInternalLinks ? "true" : "false"],
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
      const result = IS_WORKER_SUPPORTED
        ? (header + (await this.excalidrawData.generateMDAsync(
            this.excalidrawAPI.getSceneElementsIncludingDeleted().filter((el:ExcalidrawElement)=>el.isDeleted) //will be concatenated to scene.elements
          )) + tail)
        : (header + (this.excalidrawData.generateMDSync(
            this.excalidrawAPI.getSceneElementsIncludingDeleted().filter((el:ExcalidrawElement)=>el.isDeleted) //will be concatenated to scene.elements
          )) + tail)

      this.excalidrawData.disableCompression = false;
      this.viewSaveData = result;
      return;
    }
    if (this.compatibilityMode) {
      this.viewSaveData = JSON.stringify(scene, null, "\t");
      return;
    }

    this.viewSaveData = this.data;
    return;
  }

  getViewData() {
    return this.viewSaveData ?? this.data;
  }

  private hiddenMobileLeaves:[WorkspaceLeaf,string][] = [];

  restoreMobileLeaves() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.restoreMobileLeaves, "ExcalidrawView.restoreMobileLeaves");
    if(this.hiddenMobileLeaves.length>0) {
      this.hiddenMobileLeaves.forEach((x:[WorkspaceLeaf,string])=>{
        x[0].containerEl.style.display = x[1];
      })
      this.hiddenMobileLeaves = [];
    }
  }

  async openLaTeXEditor(eqId: string) {
    if(await this.excalidrawData.syncElements(this.getScene())) {
      //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1994
      await this.forceSave(true);
    }
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

    const isLatexSuitAvailable = !!this.app.plugins.plugins["obsidian-latex-suite"];
    (isLatexSuitAvailable
      ? LaTexPrompt.Prompt(this.app, t("ENTER_LATEX"), equation)
      : GenericInputPrompt.Prompt(
        this,this.plugin,this.app,t("ENTER_LATEX"),undefined,equation, undefined, 3)
    ).then(async (formula: string) => {
      if (!formula || formula === equation) {
        return;
      }
      this.excalidrawData.setEquation(fileId, {
        latex: formula,
        isLoaded: false,
      });
      const ea = getEA(this) as ExcalidrawAutomate;
      ea.copyViewElementsToEAforEditing([el]);
      ea.addAppendUpdateCustomData(el.id, {latex: formula});
      const dataurl = await ea.tex2dataURL(equation);
      if (dataurl && dataurl.size.height > 0 && dataurl.size.width > 0) {
        ea.addAppendUpdateCustomData(el.id, {
          latexscale: {scaleX: el.width/dataurl.size.width, scaleY: el.height/dataurl.size.height}
        });
      }
      await ea.addElementsToView(false, false, false, false);
      await this.save(false);
      await updateEquation(
        formula,
        fileId,
        this,
        addFiles,
      );
      this.setDirty(1);
    }, () => {} );
  };

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
        const originalAnchor = Boolean(ef.linkParts.original.endsWith("|100%"));
        const nextAnchor = Boolean(link.endsWith("|100%"));
        ef.resetImage(this.file.path, link);
        this.excalidrawData.setFile(fileId, ef);
        this.setDirty(2);
        if(originalAnchor !== nextAnchor) {
          await toggleImageAnchoring(el, this, nextAnchor, ef)
        }
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
        [{iconId: "check", caption: "", action: (x:string)=>{x.replaceAll("\n","").trim()}}],
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
    this.updateScene({appState: {invertBindingBehaviour:newState}, captureUpdate: CaptureUpdateAction.NEVER,});
    new Notice(newState ? t("ARROW_BINDING_INVERSE_MODE") : t("ARROW_BINDING_NORMAL_MODE"));
  }

  toggleFrameRendering() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.toggleFrameRendering, "ExcalidrawView.toggleFrameRendering");
    const frameRenderingSt = (this.excalidrawAPI as ExcalidrawImperativeAPI).getAppState().frameRendering;
    this.updateScene({appState: {frameRendering: {...frameRenderingSt, enabled: !frameRenderingSt.enabled}}, captureUpdate: CaptureUpdateAction.NEVER,});
    new Notice(frameRenderingSt.enabled ? t("FRAME_CLIPPING_ENABLED") : t("FRAME_CLIPPING_DISABLED"));
  }

  toggleFrameClipping() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.toggleFrameClipping, "ExcalidrawView.toggleFrameClipping");
    const frameRenderingSt = (this.excalidrawAPI as ExcalidrawImperativeAPI).getAppState().frameRendering;
    this.updateScene({appState: {frameRendering: {...frameRenderingSt, clip: !frameRenderingSt.clip}}, captureUpdate: CaptureUpdateAction.NEVER,});
    new Notice(frameRenderingSt.clip ? "Frame Clipping: Enabled" : "Frame Clipping: Disabled");
  }

  gotoFullscreen() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.gotoFullscreen, "ExcalidrawView.gotoFullscreen");
    if(this.plugin.leafChangeTimeout) {
      window.clearTimeout(this.plugin.leafChangeTimeout); //leafChangeTimeout is created on window in main.ts!!!
      this.plugin.clearLeafChangeTimeout();
    }
    if (!this.excalidrawWrapperRef) {
      return;
    }
    if (this.toolsPanelRef && this.toolsPanelRef.current) {
      this.toolsPanelRef.current.setFullscreen(true);
    }

    const hide = (el:HTMLElement) => {
      el.style.marginTop = "0px";
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
      doc.body.querySelectorAll(`div.titlebar`).forEach(node=>node.addClass(HIDE));
      const topPadding = doc.body.querySelector(".is-mobile .workspace > .mod-root");
      if(topPadding && topPadding instanceof HTMLElement) {
        topPadding.style.paddingTop = "0px";
      }
    }

    hide(this.contentEl);
  }


  isFullscreen(): boolean {
    //(process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.isFullscreen, "ExcalidrawView.isFullscreen");
    return Boolean(this.ownerDocument.body.querySelector(".excalidraw-hidden"));
  }

  exitFullscreen() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.exitFullscreen, "ExcalidrawView.exitFullscreen");
    if (this.toolsPanelRef && this.toolsPanelRef.current) {
      this.toolsPanelRef.current.setFullscreen(false);
    }
    const doc = this.ownerDocument;
    doc.querySelectorAll(".excalidraw-hidden").forEach(el=>el.removeClass(HIDE));
    doc.querySelectorAll(".excalidraw-visible").forEach(el=>el.removeClass(SHOW));
    const topPadding = doc.body.querySelector(".is-mobile .workspace > .mod-root");
    if(topPadding && topPadding instanceof HTMLElement) {
      topPadding.style.paddingTop = "";
    }
    this.contentEl.style.marginTop = "";
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
    selectedElementWithLink?:SelectedElementWithLink,
    allowLinearElementClick: boolean = false,
  ): {
    linkText: string,
    selectedElement: ExcalidrawElement,
    isLinearElement: boolean,
  } {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.getLinkTextForElement, "ExcalidrawView.getLinkTextForElement", selectedText, selectedElementWithLink);
    if (selectedText?.id || selectedElementWithLink?.id) {
      let selectedTextElement: ExcalidrawTextElement = selectedText.id
      ? this.excalidrawAPI.getSceneElements().find((el:ExcalidrawElement)=>el.id === selectedText.id)
      : null;

      let selectedElement = selectedElementWithLink.id
      ? this.excalidrawAPI.getSceneElements().find((el:ExcalidrawElement)=>
          el.id === selectedElementWithLink.id)
      : null;

      //if the user clicked on the label of an arrow then the label will be captured in selectedElement, because
      //Excalidraw returns the container as the selected element. But in this case we want this to be treated as the
      //text element, as the assumption is, if the user wants to invoke the linear element editor for an arrow that has
      //a label with a link, then he/she should rather CTRL+click on the arrow line, not the label. CTRL+Click on
      //the label is an indication of wanting to navigate.
      if (!Boolean(selectedTextElement) && selectedElement?.type === "text") {
        const container = getContainerElement(selectedElement, arrayToMap(this.excalidrawAPI.getSceneElements()));
        if(container?.type === "arrow") {
          const x = getTextElementAtPointer(this.currentPosition,this);
          if(x?.id === selectedElement.id) {
            selectedTextElement = selectedElement;
            selectedElement = null;
          }
        }
      }
      
      //CTRL click on a linear element with a link will navigate instead of line editor
      if(!allowLinearElementClick && ["arrow", "line"].includes(selectedElement?.type)) {
        return {linkText: selectedElement.link, selectedElement: selectedElement, isLinearElement: true};
      }

      if (!selectedTextElement && selectedElement?.type === "text") {
        if(!allowLinearElementClick) {
          //CTRL click on a linear element with a link will navigate instead of line editor
          const container = getContainerElement(selectedElement, arrayToMap(this.excalidrawAPI.getSceneElements()));
          if(container?.type !== "arrow") {
            selectedTextElement = selectedElement as ExcalidrawTextElement;
            selectedElement = null;
          } else {
            const x = this.processLinkText(selectedElement.rawText, selectedElement as ExcalidrawTextElement, container, false);
            return {linkText: x.linkText, selectedElement: container, isLinearElement: true};
          }
        } else {
          selectedTextElement = selectedElement as ExcalidrawTextElement;
          selectedElement = null;
        }
      }

      const linkCandidates: string[] = [];
      const addCandidate = (value?: string | null) => {
        if (value && value.trim().length > 0) {
          linkCandidates.push(value);
        }
      };

      if (selectedTextElement) {
        const textBody =
          this.textMode === TextMode.parsed
            ? this.excalidrawData.getRawText(selectedTextElement.id)
            : selectedTextElement.rawText ?? selectedTextElement.text ?? selectedText.text;
        addCandidate(textBody);
        addCandidate(selectedTextElement.link);

        if (!selectedElement && selectedTextElement.containerId) {
          const container = _getContainerElement(selectedTextElement, {elements: this.excalidrawAPI.getSceneElements()});
          addCandidate(container?.link);
        }
      } else {
        const rawTextCandidate = selectedText?.id
          ? (this.textMode === TextMode.parsed
              ? this.excalidrawData.getRawText(selectedText.id)
              : selectedText.text)
          : selectedText?.text;
        addCandidate(rawTextCandidate);
      }

      addCandidate(selectedElement?.link ?? selectedElementWithLink?.text);

      const linkText = Array.from(new Set(linkCandidates)).join(" ");

      return {
        linkText: linkText || null,
        selectedElement: selectedElement ?? selectedTextElement,
        isLinearElement: false,
      };
    }
    return {linkText: null, selectedElement: null, isLinearElement: false};
  }

  
  processLinkText(linkText: string, selectedTextElement: ExcalidrawTextElement, selectedElement: ExcalidrawElement, shouldOpenLink: boolean = true) {
    if(!linkText) {
      return {linkText: null, selectedElement: null};
    }

    if(linkText.startsWith("#")) {
      return {linkText, selectedElement: selectedTextElement ?? selectedElement};
    }

    const maybeObsidianLink = parseObsidianLink(linkText, this.app, shouldOpenLink);
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
          
          if(linkText?.startsWith("#")) {
            return {linkText, selectedElement: selectedTextElement ?? selectedElement};
          }

          const maybeObsidianLink = parseObsidianLink(linkText, this.app, shouldOpenLink);
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

  async linkClick(
    ev: MouseEvent | null,
    selectedText: SelectedElementWithLink,
    selectedImage: SelectedImage,
    selectedElementWithLink: SelectedElementWithLink,
    keys?: ModifierKeys,
    allowLinearElementClick: boolean = false,
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
    let {linkText, selectedElement, isLinearElement} = this.getLinkTextForElement(selectedText, selectedElementWithLink, allowLinearElementClick);

    //if (selectedText?.id || selectedElementWithLink?.id) {
    if (selectedElement) {
      if (!allowLinearElementClick && linkText && isLinearElement) {
        if(this.semaphores.warnAboutLinearElementLinkClick) {
          new Notice(t("LINEAR_ELEMENT_LINK_CLICK_ERROR"), 20000);
          this.semaphores.warnAboutLinearElementLinkClick = false;
        }
        return;
      }
      if (!linkText) {
          return;
      }
      linkText = linkText.replaceAll("\n", ""); //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/187

      if(openExternalLink(linkText, this.app)) return;

      const maybeObsidianLink = parseObsidianLink(linkText,this.app);
      if (typeof maybeObsidianLink === "boolean" && maybeObsidianLink) return;
      if (typeof maybeObsidianLink === "string") {
        linkText = maybeObsidianLink;
      }

      const result = await linkPrompt(linkText, this.app, this);
      if(!result) return;
      [file, linkText, subpath] = result;

      if(this.handleLinkHookCall(selectedElement,linkText,ev)) return;
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
          api.updateScene({appState: {openDialog: { name: "ttd", tab: "mermaid" }}, captureUpdate: CaptureUpdateAction.NEVER })
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
      if(allowLinearElementClick) {
        return;
      }
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
      const { promise } = openLeaf({
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
  
  async handleLinkClick(ev: MouseEvent | ModifierKeys, allowLinearElementClick: boolean = false) {
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
      allowLinearElementClick,
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
    if (api.getAppState()?.editingTextElement) {
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
    if(this.plugin.settings.overrideObsidianFontSize) {
      document.documentElement.style.fontSize = "";
    }
  
    const apiMissing = Boolean(typeof this.containerEl.onWindowMigrated === "undefined")
    this.packages = this.plugin.getPackage(this.ownerWindow);

    if(DEVICE.isDesktop && !apiMissing) {
      if(this.ownerWindow !== window) {
        this.plugin.initializeFonts();
      }
      this.destroyers.push(
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

    this.actionButtons = {
      scriptInstall: this.addAction(
        SCRIPTENGINE_ICON_NAME,
        !DEVICE.isMobile ? t("INSTALL_SCRIPT_BUTTON") : "",
        () => {
          new ScriptInstallPrompt(this.plugin).open();
      }),
      save: this.addAction(
        DISK_ICON_NAME,
        !DEVICE.isMobile ? t("FORCE_SAVE") : "",
        async () => this.forceSave(),
      ),
      isRaw: this.addAction(
        TEXT_DISPLAY_RAW_ICON_NAME,
        !DEVICE.isMobile ? t("RAW") : "",
        () => this.changeTextMode(TextMode.parsed),
      ),
      link: this.addAction(
        "link",
        !DEVICE.isMobile ? t("OPEN_LINK") : "",
        (ev) => this.handleLinkClick(ev),
      ),
    }
   /*this.actionButtons['isParsed'] = this.addAction(
      TEXT_DISPLAY_PARSED_ICON_NAME,
      t("PARSED"),
      () => this.changeTextMode(TextMode.raw),
    );*/

    const ro = new ResizeObserver(() => {
      const height = this.contentEl.clientHeight;
      const prevHeight = this.previousContentElHeight;
      const dh = prevHeight ? height - prevHeight : 0;
      this.previousContentElHeight = height;
      this.scheduleBatchedResize(dh);
    });
    this.previousContentElHeight = this.contentEl.clientHeight;
    ro.observe(this.contentEl);
    this.destroyers.push(() => ro.disconnect());

    this.app.workspace.onLayoutReady(async () => {
      (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.onload,`ExcalidrawView.onload > app.workspace.onLayoutReady, file:${this.file?.name}, isActiveLeaf:${this?.app?.workspace?.activeLeaf === this.leaf}, is activeExcalidrawView set:${Boolean(this?.plugin?.activeExcalidrawView)}`);
      //Leaf was moved to new window and ExcalidrawView was destructed.
      //Happens during Obsidian startup if View opens in new window.
      if(!this.plugin) {
        return;
      }
      await this.plugin.awaitInit();
      //implemented to overcome issue that activeLeafChangeEventHandler is not called when view is initialized from a saved workspace, since Obsidian 1.6.0
      let counter = 0;
      while(counter++<50 && (!Boolean(this?.plugin?.activeLeafChangeEventHandler) || !Boolean(this.canvasNodeFactory))) {
        await(sleep(50));
        if(!this?.plugin) return;
      }
      setMobileNavbarPosition(true);
      if(!Boolean(this?.plugin?.activeLeafChangeEventHandler)) return;
      if (Boolean(this.plugin.activeLeafChangeEventHandler) && (this?.app?.workspace?.activeLeaf === this.leaf)) {
        this.plugin.activeLeafChangeEventHandler(this.leaf);
      }      
      await this.canvasNodeFactory.initialize();
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

      const onBlurOrLeave = () => {
        if(!this.excalidrawAPI || !this.excalidrawData.loaded || !this.isDirty()) {
          return;
        }
        const api = this.excalidrawAPI as ExcalidrawImperativeAPI;
        const st = api.getAppState();
        if(st.activeTool.type !== "image" && st.activeEmbeddable?.state !== "active") {
          this.forceSave(true);
        }
      };

      this.registerDomEvent(this.ownerWindow, "keydown", onKeyDown, false);
      this.registerDomEvent(this.ownerWindow, "keyup", onKeyUp, false);
      //this.registerDomEvent(this.contentEl, "mouseleave", onBlurOrLeave, false); //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2004
      this.registerDomEvent(this.ownerWindow, "blur", onBlurOrLeave, false);
      this.semaphores.viewloaded = true;
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
      captureUpdate: CaptureUpdateAction.NEVER,
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
      //this.actionButtons['isParsed'].hide();
    } else {
      this.actionButtons['isRaw'].show();
      //this.actionButtons['isParsed'].hide();
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
      const st = api.getAppState() as AppState;
      const isFreedrawActive = (st.activeTool?.type === "freedraw") && (this.freedrawLastActiveTimestamp > (Date.now()-2000));
      const isEditingText = st.editingTextElement !== null;
      const isEditingNewElement = st.newElement !== null;
      //this will reset positioning of the cursor in case due to the popup keyboard,
      //or the command palette, or some other unexpected reason the onResize would not fire...
      this.refreshCanvasOffset();
      if (
        this.isDirty() &&
        this.plugin.settings.autosave &&
        !this.semaphores.forceSaving &&
        !this.semaphores.autosaving &&
        !this.semaphores.embeddableIsEditingSelf &&
        !isFreedrawActive &&
        !isEditingText &&
        !isEditingNewElement //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/630
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
    let counter = 0;
    while (this.semaphores.saving && (counter++ < 200)) {
      await sleep(50); //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1988
      if(counter++ === 15) {
        new Notice(t("SAVE_IS_TAKING_LONG"));
      }
      if(counter === 80) {
        new Notice(t("SAVE_IS_TAKING_VERY_LONG"));
      }
    }
    if(counter >= 200) {
      new Notice("Unknown error, save is taking too long");
      return;
    }
    await this.forceSaveIfRequired();
  }

  private async forceSaveIfRequired():Promise<boolean> {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.forceSaveIfRequired,`ExcalidrawView.forceSaveIfRequired`);
    let watchdog = 0;
    let dirty = false;
    //if saving was already in progress
    //the function awaits the save to finish.
    if(!this.excalidrawAPI) {
      return false;
    }
    this.checkSceneVersion(this.excalidrawAPI.getSceneElements());
    if(!this.isDirty()) {
      if(!this.semaphores.saving) {
        return false;
      }
      //check for Excalibrain view
      if (this.hookServer && this.hookServer.onViewUnloadHook?.toString() === "e=>{this.scene&&this.scene.leaf===e.leaf&&this.stop()}") {
        return false;
      }
    }
    while (this.semaphores.saving && watchdog++ < 200) {
      dirty = true;
      await sleep(40);
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
    //I noticed Obsidian calls this function twice when disabling the plugin
    //once from "unregisterView"
    //the from "detachLeavesOfType"
    if(!this.dropManager && !this.excalidrawRoot) return; //the view is already closed

    // This happens when the user right clicks a tab and selects delete
    // in this case the onDelete event handler tirggers, but then Obsidian's delete event handler reaches onclose first, and
    // when the function is called a second time via on delete an error is thrown.)
    if(!this.file) return; 

    this.exitFullscreen();

    await this.forceSaveIfRequired();
    if (this.excalidrawRoot) {
      this.excalidrawRoot.unmount();
      this.excalidrawRoot = null;
    }

    this.clearPreventReloadTimer();
    this.clearEmbeddableNodeIsEditingTimer();
    if (this.activeLoader) {
      this.activeLoader.terminate = true;
      this.activeLoader = null;
    }
    if (this.nextLoader) {
      this.nextLoader.terminate = true;
      this.nextLoader = null;
    }
    if (this.plugin) {
      this.plugin.scriptEngine?.removeViewEAs(this);
      const sidepanel = this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE_SIDEPANEL)[0]?.view;
      if (sidepanel && sidepanel instanceof ExcalidrawSidepanelView) {
        sidepanel.removeViewEAs(this);
      }
      
      if(this.plugin.ea?.targetView === this) {
        this.plugin.ea.targetView = null;
      }
    }

    this.excalidrawAPI = null;
    
    if (this.dropManager) {
      this.dropManager.destroy();
      this.dropManager = null;
    }

    if(this.canvasNodeFactory) {
      this.canvasNodeFactory.destroy();
      this.canvasNodeFactory = null;
    }

    if(this.embeddableLeafRefs) {
      this.embeddableLeafRefs.clear();
      this.embeddableLeafRefs = null;
    }
    
    if(this.embeddableRefs) {
      this.embeddableRefs.clear();
      this.embeddableRefs = null;
    }

    if(this.actionButtons) {
      Object.values(this.actionButtons).forEach((el) => el.remove());
      this.actionButtons = null; //{} as Record<ActionButtons, HTMLElement>;
    }

    if (this.excalidrawData) {
      this.excalidrawData.destroy();
      this.excalidrawData = null;
    };

    if(this.exportDialog) {
      this.exportDialog.destroy();
      this.exportDialog = null;
    }

    this.hoverPreviewTarget = null;

    if(this._hookServer?.targetView === this) {
      this._hookServer.targetView = null;
    }
    this._hookServer = null;
    if(this.containerEl) {
      this.containerEl.onWindowMigrated = null;
    }

    this.packages = null; //{react:null, reactDOM:null, excalidrawLib:null};

    let leafcount = 0;
    this.app.workspace.iterateAllLeaves(l=>{
      if(l === this.leaf) return;

      if(l.containerEl?.ownerDocument.defaultView === this.ownerWindow) {
        leafcount++;
      }
    })
    if(leafcount === 0 && this.plugin) {
      this.plugin.deletePackage(this.ownerWindow);
    }

    this.lastMouseEvent = null;
    this.requestSave = null;
    this.leaf.tabHeaderInnerTitleEl.style.color = "";

    //super.onClose will unmount Excalidraw, need to save before that
    await super.onClose();
    this._plugin = null;
    this._hookServer = null;
    this.excalidrawData = null;
    this.canvasNodeFactory = null;

    tmpBruteForceCleanup(this);
  }

  //onunload is called first
  onunload() {
    super.onunload();
    this.destroyers.forEach((destroyer) => destroyer());
    this.restoreMobileLeaves();
    setMobileNavbarPosition(false);
    this.semaphores.viewunload = true;
    this.semaphores.popoutUnload = (this.ownerDocument !== document) && (this.ownerDocument.body.querySelectorAll(".workspace-tab-header").length === 0);

    if(this.shouldSaveImportedImageTimer) {
      window.clearTimeout(this.shouldSaveImportedImageTimer);
    }

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
      window.clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    this.autosaveFunction = null;

    if (this.dropManager) {
      this.dropManager.destroy();
      this.dropManager = null;
    }

    // Clear all other timers
    if (this.isEditingTextResetTimer) {
      window.clearTimeout(this.isEditingTextResetTimer);
      this.isEditingTextResetTimer = null;
    }
    if (this.preventReloadResetTimer) {
      window.clearTimeout(this.preventReloadResetTimer);
      this.preventReloadResetTimer = null;
    }
    if (this.editingSelfResetTimer) {
      window.clearTimeout(this.editingSelfResetTimer);
      this.editingSelfResetTimer = null;
    }
    if (this.resizeBatchTimer) {
      window.clearTimeout(this.resizeBatchTimer);
      this.resizeBatchTimer = null;
    }
    if (this.colorChangeTimer) {
      window.clearTimeout(this.colorChangeTimer);
      this.colorChangeTimer = null;
    }
    if (this.semaphores?.wheelTimeout) {
      window.clearTimeout(this.semaphores.wheelTimeout);
      this.semaphores.wheelTimeout = null;
    }

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
        this.clearEmbeddableNodeIsEditingTimer();
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
    await this.loadDrawing(loadOnModifyTrigger, undefined, true);
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
      query = [this.data.split("\n")[state.line]]; //was -1 https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2503
    }

    if (query && query.length > 0 && !(query.length === 1 && query[0].length === 0)) {
      window.setTimeout(async () => {
        await waitForExcalidraw();

        const api = this.excalidrawAPI;
        if (!api) return;
        if (api.getAppState().isLoading) return;
        
        const elements = api.getSceneElements() as ExcalidrawElement[];
        if(query.length === 1) {
          const elementId = query[0].match(/ \^([^ ]+)$/)?.[1] ?? query[0].match(/^([^ :]+): \[\[[^\]]+]]$/)?.[1];
          if(elementId && elements.find((el)=>el.id === elementId)) {
            this.preventAutozoom();
            window.setTimeout(()=>this.zoomToElements(!api.getAppState().viewModeEnabled, [elements.find((el)=>el.id === elementId)]));
            return;
          }

        }

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
                    return;
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
    this.semaphores.warnAboutLinearElementLinkClick = true;
    this.viewSaveData = "";
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
    await this.plugin.awaitInit();
    if(this.lastLoadedFile === this.file) return;
    this.isLoaded = false;
    if(!this.file) return;
    if(this.plugin.settings.compareManifestToPluginVersion) checkVersionMismatch(this.plugin);
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
      await this.plugin.awaitInit();
      let counter = 0;
      while ((!this.semaphores.viewloaded || !this.file || !this.plugin.fourthFontLoaded) && counter++<50) await sleep(50);
      if(!this.file) return;
      this.compatibilityMode = this.file.extension === "excalidraw";
      await this.plugin.loadSettings();
      if (this.compatibilityMode) {
        this.plugin.enableLegacyFilePopoverObserver();
        this.actionButtons['isRaw'].hide();
        // this.actionButtons['isParsed'].hide();
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
              const confirmationPrompt = new MultiOptionConfirmationPrompt(plugin,
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
            const confirmationPrompt = new MultiOptionConfirmationPrompt(plugin,t("BACKUP_AVAILABLE"));
            confirmationPrompt.waitForClose.then(async (confirmed) => {
              if (confirmed) {
                await this.app.vault.modify(file, drawingBAK);
                plugin.excalidrawFileModes[leaf.id || file.path] = VIEW_TYPE_EXCALIDRAW;
                setExcalidrawView(leaf);
              } 
            });


          })();
          this.setMarkdownView();
          return;
        }
      }

      if(imageCache.isReady() && this.excalidrawData.scene && this.excalidrawData.scene.elements && this.excalidrawData.scene.elements.length === 0) {
        const backup = await imageCache.getBAKFromCache(this.file.path);
        if(backup && backup.length > data.length) {
          window.setTimeout(async () => {
            const confirmationPrompt = new MultiOptionConfirmationPrompt(
                this.plugin,
                t("BACKUP_SAVE_AS_FILE"),
                new Map([
                  [t("BACKUP_CANCEL"), 0],
                  [t("BACKUP_DELETE"), 2],
                  [t("BACKUP_SAVE"), 1],
                ]),
                t("BACKUP_SAVE"),
              );
            const result = await confirmationPrompt.waitForClose;
            if(result === 1) {
              const path = getNewUniqueFilepath(this.app.vault, `${this.file.basename}.restored.${this.file.extension}`, this.file.parent.path);
              const backupFile = await createFileAndAwaitMetacacheUpdate(this.app,path, backup);
              await imageCache.removeBAKFromCache(this.file.path);
              this.plugin.openDrawing(backupFile,"new-tab");
            } else if (result === 2) {
              await imageCache.removeBAKFromCache(this.file.path);
            }
          });
        }
      }
      await this.loadDrawing(true);

      onLoadMessages(this.plugin, this.excalidrawData.scene,this.data);

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

  private getGridColor(bgColor: string, st: AppState): { Bold: string, Regular: string } {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.getGridColor, "ExcalidrawView.getGridColor", bgColor, st);
    
    const cm = this.plugin.ea.getCM(bgColor);
    const isDark = cm.isDark();
  
    let Regular: string;
    let Bold: string;
    const opacity = this.plugin.settings.gridSettings.OPACITY/100;

    if (this.plugin.settings.gridSettings.DYNAMIC_COLOR) {
      // Dynamic color: concatenate opacity to the RGB string  !!! Excalidraw expects an RGBA string !!!
      Regular = (isDark ? cm.lighterBy(10) : cm.darkerBy(10)).alphaTo(opacity).stringRGB({ alpha: true });
      Bold = (isDark ? cm.lighterBy(5) : cm.darkerBy(5)).alphaTo(opacity).stringRGB({ alpha: true });
    } else {
      // Custom color handling
      const customCM = this.plugin.ea.getCM(this.plugin.settings.gridSettings.COLOR);
      const customIsDark = customCM.isDark();
      
      // Regular uses the custom color directly
      Regular = customCM.alphaTo(opacity).stringRGB({ alpha: true });
      
      // Bold is 10 shades lighter or darker based on the custom color's darkness
      Bold = (customIsDark ? customCM.lighterBy(10) : customCM.darkerBy(10)).alphaTo(opacity).stringRGB({ alpha: true });
    }
  
    return { Bold, Regular };
  }
  

  public activeLoader: EmbeddedFilesLoader = null;
  private nextLoader: EmbeddedFilesLoader = null;
  public async loadSceneFiles(isThemeChange: boolean = false, fileIDWhiteList?: Set<FileId>, callback?: Function) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.loadSceneFiles, "ExcalidrawView.loadSceneFiles", isThemeChange);
    if (!this.excalidrawAPI) {
      return;
    }
    
    const loader = new EmbeddedFilesLoader(this.plugin);

    const runLoader = (l: EmbeddedFilesLoader) => {
      this.nextLoader = null;
      this.activeLoader = l;
      l.loadSceneFiles({
        excalidrawData: this.excalidrawData,
        addFiles: (files: FileData[], isDark: boolean, final:boolean = true) => {
          if(callback && final) {
            callback();
          }
          if(!this.file || !this.excalidrawAPI) {
            return; //The view was closed in the mean time
          }
          if (files && files.length > 0) {
            addFiles(files, this, isDark);
          }
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
        },
        depth: 0,
        isThemeChange,
        fileIDWhiteList,
      });
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
    let reloadFiles = new Set<FileId>();

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
              reloadFiles.add(incomingElement.fileId);
            } else if (inData.getEquation(incomingElement.fileId)) {
              this.excalidrawData.setEquation(
                incomingElement.fileId,
                inData.getEquation(incomingElement.fileId)
              )
              reloadFiles.add(incomingElement.fileId);
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
          const incomingFile = inData.getFile(incomingElement.fileId);
          const sceneFile = this.excalidrawData.getFile(incomingElement.fileId);

          const shouldUpdate = Boolean(incomingFile) && (
            ((sceneElement as ExcalidrawImageElement).fileId !== incomingElement.fileId) ||
            (incomingFile.file && (sceneFile.file !== incomingFile.file)) ||
            (incomingFile.hyperlink && (sceneFile.hyperlink !== incomingFile.hyperlink)) ||
            (incomingFile.linkParts?.original && (sceneFile.linkParts?.original !== incomingFile.linkParts?.original))
          )
          if(shouldUpdate) {
            this.excalidrawData.setFile(
              incomingElement.fileId,
              inData.getFile(incomingElement.fileId)
            );
            reloadFiles.add(incomingElement.fileId);
          }
        }
      })
      this.previousSceneVersion = this.getSceneVersion(sceneElements);
      //changing files could result in a race condition for sync. If at the end of sync there are differences
      //set dirty will trigger an autosave
      if(this.getSceneVersion(inData.scene.elements) !== this.previousSceneVersion) {
        this.setDirty(3);
      }
      this.updateScene({elements: sceneElements, captureUpdate: CaptureUpdateAction.IMMEDIATELY});
      if(reloadFiles.size>0) {
        this.loadSceneFiles(false,reloadFiles);
      }
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
  public async loadDrawing(justloaded: boolean, deletedElements?: ExcalidrawElement[], isReloading: boolean = false) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.loadDrawing, "ExcalidrawView.loadDrawing", justloaded, deletedElements);
    const excalidrawData = this.excalidrawData.scene;
    const isOpenInMultipleLeaves = getExcalidraAndMarkdowViewsForFile(this.app,this.file).length > 1;
    this.semaphores.justLoaded = justloaded;
    this.clearDirty();
    const om = this.excalidrawData.getOpenMode();
    this.semaphores.preventReload = false;
    const penEnabled = this.plugin.isPenMode();
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
          captureUpdate: CaptureUpdateAction.NEVER,
        },
        justloaded
      );
      this.updateScene(
        {
          //elements: excalidrawData.elements.concat(deletedElements??[]), //need to preserve deleted elements during autosave if images, links, etc. are updated
          appState: {
            ...isReloading && isOpenInMultipleLeaves
              ? deleteAppStateKeys(excalidrawData.appState, ["scrollX","scrollY","zoom"])
              : excalidrawData.appState,
            ...this.excalidrawData.selectedElementIds //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/609
              ? this.excalidrawData.selectedElementIds
              : {},
            ...excalidrawData.appState.frameRendering && excalidrawData.appState.frameRendering.markerName === undefined
              ? { frameRendering: {...excalidrawData.appState.frameRendering, markerName: true, markerEnabled: true } }
              : {},
            zenModeEnabled,
            viewModeEnabled,
            linkOpacity: this.excalidrawData.getLinkOpacity(),
            penMode: penEnabled,
            penDetected: penEnabled,
            allowPinchZoom: this.plugin.settings.allowPinchZoom,
            allowWheelZoom: this.plugin.settings.allowWheelZoom,
            pinnedScripts: this.plugin.settings.pinnedScripts,
            customPens: this.plugin.settings.customPens.slice(0,this.plugin.settings.numberOfCustomPens),
            gridDirection: this.plugin.settings.gridSettings.GRID_DIRECTION ?? {horizontal: true, vertical: true},
          },
          captureUpdate: CaptureUpdateAction.NEVER,
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
          ...isReloading && isOpenInMultipleLeaves
            ? deleteAppStateKeys(excalidrawData.appState, ["scrollX","scrollY","zoom"])
            : excalidrawData.appState,
          ...excalidrawData.appState.frameRendering && excalidrawData.appState.frameRendering.markerName === undefined
            ? { frameRendering: {...excalidrawData.appState.frameRendering, markerName: true, markerEnabled: true } }
            : {},
          zenModeEnabled: om.zenModeEnabled,
          viewModeEnabled: excalidrawData.elements.length > 0 ? om.viewModeEnabled : false,
          linkOpacity: this.excalidrawData.getLinkOpacity(),
          penMode: penEnabled,
          penDetected: penEnabled,
          allowPinchZoom: this.plugin.settings.allowPinchZoom,
          allowWheelZoom: this.plugin.settings.allowWheelZoom,
          pinnedScripts: this.plugin.settings.pinnedScripts,
          customPens: this.plugin.settings.customPens.slice(0,this.plugin.settings.numberOfCustomPens),
          gridDirection: this.plugin.settings.gridSettings.GRID_DIRECTION,
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
    const leaves = this.app.workspace.getLeavesOfType("markdown");
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
    const uiMode = calculateUIModeValue(this.plugin.settings);
    this.setUIMode(uiMode);
  }

  public setDirty(location?:number) {
    if(this.semaphores.saving) return; //do not set dirty if saving
    if(!this.isDirty()) {
      //the autosave timer should start when the first stroke was made... thus avoiding an immediate impact by saving right then
      this.resetAutosaveTimer();
    }
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.setDirty,`ExcalidrawView.setDirty, location:${location}`);
    this.semaphores.dirty = this.file?.path;
    this.actionButtons['save'].querySelector("svg").addClass("excalidraw-dirty");
    if(!this.semaphores.viewunload && this.toolsPanelRef?.current) {
      this.toolsPanelRef.current.setDirty(true);
    }
    if(!DEVICE.isMobile) {
      if(requireApiVersion("0.16.0")) {
        this.leaf.tabHeaderInnerIconEl.style.color="var(--color-accent)"
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
        this.leaf.tabHeaderInnerIconEl.style.color=""
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
    //this way isDirty() will return false in onClose, thus
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
      const f = await createOrOverwriteFile(this.app, fname, text.join("\n"));
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
          const props:(keyof ExcalidrawElement)[] = ["backgroundColor", "fillStyle","roughness","roundness","strokeColor","strokeStyle","strokeWidth"];
          props.forEach((prop)=>{
            const element = ea.getElement(id);
            if (prop in element) {
              (element as any)[prop] = containerElement[prop];
            }
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
    const fileId = await generateIdFromFile((new TextEncoder()).encode(dataURL as string).buffer)
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
        .filter((el) => el.type==="text" && el.id === id);
      if (el.length === 1) {
        ea.copyViewElementsToEAforEditing(el);
        const textElement = ea.getElement(el[0].id) as Mutable<ExcalidrawTextElement>;
        textElement.text = textElement.originalText = textElement.rawText =
            `[${data.meta.title}](${text})`;
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

    const textId = getBoundTextElementId(selectedElement[0]);
    if (textId) {
      const textElement = api
        .getSceneElements()
        .filter((el: any) => el.id === textId && el.link);
      if (textElement.length > 0) {
        return { id: textElement[0].id, text: textElement[0].text };
      }
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
    originalLink?: string,
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
    if(!selectedElement || (!Boolean(originalLink) && (selectedElement && selectedElement.link !== null) )) {
      if(selectedElement) new Notice("Selected element already has a link. Inserting link as text.");
      this.addText(markdownlink);
      return;
    }
    const ea = getEA(this) as ExcalidrawAutomate;
    ea.copyViewElementsToEAforEditing([selectedElement]);
    if(originalLink?.match(/\[\[(.*?)\]\]/)?.[1]) {
      markdownlink = originalLink.replace(/(\[\[.*?\]\])/,markdownlink);
    }
    ea.getElement(selectedElementId).link = markdownlink;
    await ea.addElementsToView(false, true);
    ea.destroy();
    if(Boolean(originalLink)) {
      this.updateScene({
        appState: {
          showHyperlinkPopup: {
            newValue : "info", oldValue : "editor"
          }
        }
      });
    }
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
    await this.addElements({
      newElements: ea.getElements(),
      repositionToCursor: isPointerOutsideVisibleArea,
      save: save,
      newElementsOnTop: true
    });
    ea.destroy();
    return id;
  };

  public async addElements({
    newElements,
    repositionToCursor = false,
    save = false,
    images,
    newElementsOnTop = false,
    shouldRestoreElements = false,
    captureUpdate = CaptureUpdateAction.IMMEDIATELY,
  }: {
    newElements: ExcalidrawElement[];
    repositionToCursor?: boolean;
    save?: boolean;
    images?: {[key: FileId]: ImageInfo};
    newElementsOnTop?: boolean;
    shouldRestoreElements?: boolean;
    captureUpdate?: CaptureUpdateActionType;
  }): Promise<boolean> {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.addElements, "ExcalidrawView.addElements", newElements, repositionToCursor, save, images, newElementsOnTop, shouldRestoreElements);
    const api = this.excalidrawAPI as ExcalidrawImperativeAPI;
    if (!api) {
      return false;
    }
    const sceneElements = api.getSceneElements() as ExcalidrawElement[];
    const elementsMap = arrayToMap(sceneElements);
    const textElements = newElements.filter((el) => el.type == "text");
    let shouldRefreshArrows = false;
    for (let i = 0; i < textElements.length; i++) {
      const textElement = textElements[i] as Mutable<ExcalidrawTextElement>;
      const {parseResult, link} =
        await this.excalidrawData.addTextElement(
          textElement.id,
          textElement.text,
          textElement.rawText, //TODO: implement originalText support in ExcalidrawAutomate
        );
      if (link) {
        if (this.plugin.settings.syncElementLinkWithText) {
          textElement.link = link;
        } else {
          textElement.hasTextLink = true;
        }
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
      if (textElement.containerId) {
        shouldRefreshArrows = true;
      }
    }

    if (repositionToCursor) {
      newElements = repositionElementsToCursor(
        newElements,
        this.currentPosition,
        true,
      );
    }

    const newIds = new Set(newElements.map((e) => e.id));
    const newElementsMap = new Map(newElements.map((element) => [element.id, element]));
    const removeSet = new Set<string>();
    const updatedSceneElements: ExcalidrawElement[] = [...sceneElements];

    //need to update elements in scene.elements to maintain sequence of layers
    for (let i = 0; i < updatedSceneElements.length; i++) {
      const id = updatedSceneElements[i].id;
      if (newIds.has(id)) {
        updatedSceneElements[i] = newElementsMap.get(id);
        removeSet.add(id);
      }
    }

    const newElementsToInsert = newElements.filter((e) => !removeSet.has(e.id));
    const elements = newElementsOnTop
      ? updatedSceneElements.concat(newElementsToInsert)
      : newElementsToInsert.concat(updatedSceneElements);

    if (!shouldRefreshArrows) {
      shouldRefreshArrows = newElements.some((e) =>
        ["arrow", "line", "freedraw", "elbow-arrow", "iframe"].includes(e.type)
        || Boolean((e as any).boundElements?.length)
        || Boolean((e as any).startBinding)
        || Boolean((e as any).endBinding)
      );
    }
    
    const files: BinaryFileData[] = [];
    if (images && Object.keys(images).length >0) {  
      Object.keys(images).forEach((k: FileId) => {
        files.push({
          mimeType: images[k].mimeType,
          id: images[k].id,
          dataURL: images[k].dataURL,
          created: images[k].created,
        });
        if (images[k].file || images[k].isHyperLink) { //|| images[k].isLocalLink but isLocalLink was never passed
          const embeddedFile = new EmbeddedFile(
            this.plugin,
            this.file.path,
            images[k].isHyperLink //&& !images[k].isLocalLink local link is never passed to addElements
              ? images[k].hyperlink
              : (typeof images[k].file === "string" ? images[k].file : images[k].file.path),
          );
          const st: AppState = api.getAppState();
          embeddedFile.setImage({
            imgBase64: images[k].dataURL,
            mimeType: images[k].mimeType,
            size: images[k].size,
            isDark: st.theme === "dark",
            isSVGwithBitmap: images[k].hasSVGwithBitmap,
            pdfPageViewProps: images[k].pdfPageViewProps,
          });
          this.excalidrawData.setFile(images[k].id, embeddedFile);
          if(images[k].pdfPageViewProps) {
            elements.filter((e) => e.type === "image" && e.fileId === images[k].id).forEach((e) => {
              addAppendUpdateCustomData(e, {pdfPageViewProps: images[k].pdfPageViewProps});
            });
          }
        }
        if (images[k].latex) {
          this.excalidrawData.setEquation(images[k].id, {
            latex: images[k].latex,
            isLoaded: true,
          });
        }
      });
    }

    this.updateScene(
      {
        elements,
        captureUpdate,
      },
      shouldRestoreElements,
    );

    if(files.length > 0) {
      api.addFiles(files);
    }

    const newContainers = newElements.filter(isContainer);
    if (newContainers.length > 0) {
      api.updateContainerSize(newContainers);
      shouldRefreshArrows = true;
    }
    if (shouldRefreshArrows) {
      api.refreshAllArrows();
    }
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

    const activeTool = {...st.activeTool};
    if(!["freedraw","hand"].includes(activeTool.type)) {
      activeTool.type = "selection";
    }
    activeTool.customType = null;
    activeTool.lastActiveTool = null;

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
        currentItemArrowType: st.currentItemArrowType,
        currentItemFrameRole: st.currentItemFrameRole,
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
        activeTool,
        disableContextMenu: st.disableContextMenu,
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
    const hoverContainerEl = this.hoverPopover?.containerEl;
    //don't auto hide hover-editor
    if (this.hoverPopover && !hoverContainerEl?.parentElement?.hasClass("hover-editor")) {
      this.hoverPreviewTarget = null;
      //@ts-ignore
      if(this.hoverPopover.embed?.editor) {
        return;
      }
      this.hoverPopover?.hide();
    } else if (this.hoverPreviewTarget) {
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
    if(this.hoverPreviewTarget) return; //hover preview is already shown
    //(process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.showHoverPreview, "ExcalidrawView.showHoverPreview", linktext, element);
    if(!this.lastMouseEvent) return;
    const st = this.excalidrawAPI?.getAppState();
    if(st?.editingTextElement || st?.newElement) return; //should not activate hover preview when element is being edited or dragged
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
          if(!ef.file) {
            return;
          }
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
          if(this.app.metadataCache.getFirstLinkpathDest(linktext.split("#")[0],this.file.path) === this.file) return;
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
    window.setTimeout(() => (this.semaphores.hoverSleep = false), 500);
    const baseMouseEvent = this.lastMouseEvent as MouseEvent | null;
    const {x: sceneX, y: sceneY} = this.currentPosition;
    const {x: clientX, y: clientY} = sceneCoordsToViewportCoords({sceneX, sceneY}, this.excalidrawAPI?.getAppState());
    const normalizedMouseEvent = baseMouseEvent
      ? new MouseEvent(baseMouseEvent.type || "mousemove", {
          bubbles: true,
          cancelable: true,
          view: this.ownerWindow,
          clientX,
          clientY,
          button: baseMouseEvent.button ?? 0,
          buttons: baseMouseEvent.buttons ?? 0,
          ctrlKey: !(DEVICE.isIOS || DEVICE.isMacOS),
          metaKey: (DEVICE.isIOS || DEVICE.isMacOS),
          shiftKey: false,
          altKey: false,
        })
      : null;
    this.plugin.hover.linkText = linktext;
    this.plugin.hover.sourcePath = this.file.path;
    this.hoverPreviewTarget = (this.lastMouseEvent?.target as HTMLElement) ?? this.contentEl; //e.target;
    this.hoverPoint = this.currentPosition;
    this.app.workspace.trigger("hover-link", {
      event: normalizedMouseEvent ?? this.lastMouseEvent,
      source: VIEW_TYPE_EXCALIDRAW,
      hoverParent: this,
      //https://discord.com/channels/686053708261228577/989603365606531104/1386783538795249715
      //targetEl: this.hoverPreviewTarget, //null //0.15.0 hover editor!!
      linktext: this.plugin.hover.linkText,
      sourcePath: this.plugin.hover.sourcePath,
    });
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

  private lastKeyDownPosition: {x: number, y: number} = {x: 0, y: 0};
  
  private excalidrawDIVonKeyUp = (event: KeyboardEvent) => {
    this.lastKeyDownPosition = {x: 0, y: 0};
  };

  private excalidrawDIVonKeyDown(event: KeyboardEvent) {
    //(process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.excalidrawDIVonKeyDown, "ExcalidrawView.excalidrawDIVonKeyDown", event);
    if (this.semaphores?.viewunload) return;
    if (event.target === this.excalidrawWrapperRef.current) {
      return;
    } //event should originate from the canvas
    if (this.isFullscreen() && event.keyCode === KEYCODE.ESC) {
      this.exitFullscreen();
    }
    if (isWinCTRLorMacCMD(event) && !isSHIFT(event) && !isWinALTorMacOPT(event)) {
      const {x: lastX, y: lastY} = this.lastKeyDownPosition;
      const {x: currentX, y: currentY} = this.currentPosition;
      if (Math.abs(lastX - currentX) < 5 && Math.abs(lastY - currentY) < 5) {
        return;
      }
      this.lastKeyDownPosition = {...this.currentPosition};
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
    if (Boolean((this.excalidrawAPI as ExcalidrawImperativeAPI)?.getAppState().contextMenu)) {
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

      if(this.plugin.settings.doubleClickLinkOpenViewMode) {
        //dobule click
        const now = Date.now();
        if ((now - this.doubleClickTimestamp) < 600 && (now - this.doubleClickTimestamp) > 40) {
          this.identifyElementClicked();
        }
        this.doubleClickTimestamp = now;
      }
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

  public updateGridColor(canvasColor?: string, st?: any) {
    if(!canvasColor) {
      st = (this.excalidrawAPI as ExcalidrawImperativeAPI).getAppState();
      canvasColor = canvasColor ?? st.viewBackgroundColor === "transparent" ? "white" : st.viewBackgroundColor;
    }
    window.setTimeout(()=>{
      //migrate window scenario
      if (!this.plugin || !this.excalidrawAPI) {
        return;
      }
      this.updateScene(
        {
          appState:{
            gridColor: this.getGridColor(canvasColor, st),
          },
          captureUpdate: CaptureUpdateAction.NEVER
        })
    });
  }

  public updateGridDirection(gridDirection: {horizontal: boolean, vertical: boolean}) {
    window.setTimeout(()=>this.updateScene({appState:{gridDirection: {
      horizontal: gridDirection.horizontal,
      vertical: gridDirection.vertical}
    }, captureUpdate: CaptureUpdateAction.NEVER}));
  }

  private canvasColorChangeHook(st: AppState) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.canvasColorChangeHook, "ExcalidrawView.canvasColorChangeHook", st);
    const canvasColor = st.viewBackgroundColor === "transparent" ? "white" : st.viewBackgroundColor;
    this.updateGridColor(canvasColor,st);
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

  private onChange (et: ExcalidrawElement[], st: AppState, files: BinaryFileData[]) {
    if(st.activeTool?.type) {
      if(st.activeTool.type === "image") {
        if(st.selectedElementIds && Object.keys(st.selectedElementIds).length === 1) {
          const selectedElement = et.filter(el=>el.id === Object.keys(st.selectedElementIds)[0])[0];
          if(selectedElement && selectedElement.type === "image") {
            this.setShouldSaveImportedImageFlag();
          }
        }
      }
    }
    if(
      this.semaphores.shouldSaveImportedImage &&
      Object.values(files).some(file=> !file.hasOwnProperty("hasSVGwithBitmap"))
    ) {
      window.setTimeout(()=>this.forceSave(true)); //image is being added to the scene
    }

    if(st.newElement?.type === "freedraw") {
      this.freedrawLastActiveTimestamp = Date.now();
    }
    if (
      st.newElement ||
      st.editingTextElement ||
      (st.selectedLinearElement && st.selectedLinearElement.isEditing)
    ) {
      this.plugin.wasPenModeActivePreviously = st.penMode;
    }
    this.viewModeEnabled = st.viewModeEnabled;
    if (this.semaphores.justLoaded) {
      const elcount = this.excalidrawData?.scene?.elements?.length ?? 0;
      if( elcount>0 && et.length===0 ) return;
      this.semaphores.justLoaded = false;
      if (!this.semaphores.preventAutozoom && this.plugin.settings.zoomToFitOnOpen) {
        if(getExcalidraAndMarkdowViewsForFile(this.app, this.file).length === 1) {
          this.zoomToFit(false,true);
        }
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
      st.editingTextElement === null &&
      //Removed because of
      //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/565
      /*st.resizingElement === null && 
      st.newElement === null &&
      st.editingGroupId === null &&*/
      (st.selectedLinearElement === null || !st.selectedLinearElement.isEditing)
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

      await this.plugin.setStencilLibrary(lib)
    })();
  }

  private shouldSaveImportedImageTimer: number = null;
  private setShouldSaveImportedImageFlag() {
    this.semaphores.shouldSaveImportedImage = true;
    if(this.shouldSaveImportedImageTimer) {
      window.clearTimeout(this.shouldSaveImportedImageTimer);
    }
    this.shouldSaveImportedImageTimer = window.setTimeout(()=>this.semaphores.shouldSaveImportedImage = false, 3000);
  }

  private onPaste (data: ClipboardData, event: ClipboardEvent | null, files: ParsedDataTransferFile[]) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.onPaste, "ExcalidrawView.onPaste", data, event);
    const api = this.excalidrawAPI as ExcalidrawImperativeAPI;
    const ea = this.getHookServer();

    if (files?.length || (data?.mixedContent && data.mixedContent.some(d=>d.type==="imageUrl"))) {
      this.setShouldSaveImportedImageFlag();
    }

    if(data?.elements) {
      data.elements
        .filter(el=>el.type==="text" && !el.hasOwnProperty("rawText"))
        .forEach(el=>(el as Mutable<ExcalidrawTextElement>).rawText = (el as ExcalidrawTextElement).originalText);

      data.elements
        .filter((el): el is Mutable<ExcalidrawImageElement> => el.type === "image" && Boolean((el as any).customData?.latex))
        .forEach((image) => {
          const fileId = image.fileId;
          const embeddedFile = this.excalidrawData.getFile(fileId);
          const equation = this.excalidrawData.getEquation(fileId);
          const mermaid = this.excalidrawData.getMermaid(fileId);

          if (!embeddedFile && !equation && !mermaid) {
            this.excalidrawData.setEquation(image.fileId, { latex: (image as any).customData.latex, isLoaded: true });
          }
        });
    };
    if(data && ea.onPasteHook) {
      try {
        const res = ea.onPasteHook({
          ea,
          payload: data,
          event,
          excalidrawFile: this.file,
          view: this,
          pointerPosition: this.currentPosition,
        });
        if(typeof res === "boolean" && res === false) return false;
      } catch (e) {
        errorlog({where: "ExcalidrawView.onPaste", fn: ea.onPasteHook, error: e});
      }
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

    const obsidianURLFilePath = getFilePathFromObsidianURL(data?.text);
    if(obsidianURLFilePath) {
      this.addImageWithURL(obsidianURLFilePath);
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
              const imgID = await ea.addImage(this.currentPosition.x, this.currentPosition.y,link.split("&rect=")[0]);
              const el = ea.getElement(imgID) as Mutable<ExcalidrawImageElement>;
              const fd = ea.imagesDict[el.fileId] as FileData;
              el.crop = getPDFCropRect({
                scale: this.plugin.settings.pdfScale,
                link,
                naturalHeight: fd.size.height,
                naturalWidth: fd.size.width,
                pdfPageViewProps: fd.pdfPageViewProps,
              });
              addAppendUpdateCustomData(el, {pdfPageViewProps: fd.pdfPageViewProps});
              if(el.crop) {
                el.width = el.crop.width/this.plugin.settings.pdfScale;
                el.height = el.crop.height/this.plugin.settings.pdfScale;
              }
              el.link = `[[${link}]]`;
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
      //const onlyImages = data.elements.length > 0 && data.elements.every((el) => el.type === "image");
      //const preventReload = !onlyImages;
      data.elements.filter(el=>el.type==="text" || el.link).forEach(el=>
        updateElementIdsInScene({elements: data.elements as Mutable<ExcalidrawElement>[]},el, nanoid())
      );
      window.setTimeout(() => this.save(false), 30); //removed prevent reload = false, as reload was triggered when pasted containers were processed and there was a conflict with the new elements
    }

    //process pasted text after it was processed into elements by Excalidraw
    //I let Excalidraw handle the paste first, e.g. to split text by lines
    //Only process text if it includes links or embeds that need to be parsed
    if(data && data.text && data.text.match(/(\[\[[^\]]*]])|(\[[^\]]*]\([^)]*\))/gm)) {
      const prevElements = api.getSceneElements().filter(el=>el.type === "text").map(el=>el.id);

      window.setTimeout(async ()=>{
        const sceneElements = api.getSceneElementsIncludingDeleted() as Mutable<ExcalidrawElement>[];
        const newElements = sceneElements.filter(el=>el.type === "text" && !el.isDeleted && !prevElements.includes(el.id)) as ExcalidrawTextElement[];

        //collect would-be image elements and their corresponding files and links
        const imageElementsMap = new Map<ExcalidrawTextElement, [string, TFile]>();
        let element: ExcalidrawTextElement;
        const callback = (link: string, file: TFile) => {
          imageElementsMap.set(element, [link, file]);
        }
        newElements.forEach((el:ExcalidrawTextElement)=>{
          element = el;
          isTextImageTransclusion(el.originalText,this,callback);
        });

        //if there are no image elements, save and return
        //Save will ensure links and embeds are parsed
        if(imageElementsMap.size === 0) {
          this.save(false); //saving because there still may be text transclusions
          return;
        };
        
        //if there are image elements
        //first delete corresponding "old" text elements
        for(const [el, [link, file]] of imageElementsMap) {
          const clone = cloneElement(el);
          clone.isDeleted = true;
          this.excalidrawData.deleteTextElement(clone.id);
          sceneElements[sceneElements.indexOf(el)] = clone;
        }
        this.updateScene({elements: sceneElements, captureUpdate: CaptureUpdateAction.NEVER});

        //then insert images and embeds
        //shift text elements down to make space for images and embeds
        const ea:ExcalidrawAutomate = getEA(this);
        let offset = 0;
        for(const el of newElements) {
          const topleft = {x: el.x, y: el.y+offset};
          if(imageElementsMap.has(el)) {
            const [link, file] = imageElementsMap.get(el);
            if(IMAGE_TYPES.contains(file.extension)) {
              const id = await insertImageToView (ea, topleft, file, undefined, false);
              offset += ea.getElement(id).height - el.height;
            } else if(file.extension !== "pdf") {
              //isTextImageTransclusion will not return text only markdowns, this is here
              //for the future when we may want to support other embeddables
              const id = await insertEmbeddableToView (ea, topleft, file, link, false);
              offset += ea.getElement(id).height - el.height;
            } else {
              const modal = new UniversalInsertFileModal(this.plugin, this);
              modal.open(file, topleft);
            }
          } else {
            if(offset !== 0) {
              ea.copyViewElementsToEAforEditing([el]);
              ea.getElement(el.id).y = topleft.y;
            }
          }
        }
        await ea.addElementsToView(false,true);
        ea.selectElementsInView(newElements.map(el=>el.id));
        ea.destroy();
      },200) //parse transclusion and links after paste
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

  //returns the raw text of the element which is the original text without parsing
  //in compatibility mode, returns the original text, and for backward compatibility the text if originalText is not available
  private onBeforeTextEdit (textElement: ExcalidrawTextElement, isExistingElement: boolean): string {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.onBeforeTextEdit, "ExcalidrawView.onBeforeTextEdit", textElement);
    /*const api = this.excalidrawAPI as ExcalidrawImperativeAPI;
    const st = api.getAppState();
    setDynamicStyle(
      this.plugin.ea,
      this,
      st.viewBackgroundColor === "transparent" ? "white" : st.viewBackgroundColor,
      this.plugin.settings.dynamicStyling,
      api.getColorAtScenePoint({sceneX: this.currentPosition.x, sceneY: this.currentPosition.y})
    );*/
    if(!isExistingElement) {
      return;
    }
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
          this.updateScene({elements, captureUpdate: CaptureUpdateAction.NEVER});
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
          this.updateScene({elements, captureUpdate: CaptureUpdateAction.NEVER});
          const ea:ExcalidrawAutomate = getEA(this);
          if(IMAGE_TYPES.contains(file.extension)) {
            ea.selectElementsInView([await insertImageToView (ea, center, file)]);
            ea.destroy();
          } else if(file.extension !== "pdf") {
            ea.selectElementsInView([await insertEmbeddableToView (ea, center, file, link)]);
            ea.destroy();
          } else {
            const linkParts = getLinkParts(link);
            if(linkParts.page) {
              const path = file.path + "#" + link.split("#")[1];
              ea.selectElementsInView([await insertImageToView (ea, center, path)]);
            } else {
              const modal = new UniversalInsertFileModal(this.plugin, this);
              modal.open(file, center);
            }
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
          this.updateScene({elements, captureUpdate: CaptureUpdateAction.NEVER});
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
    const parseResultOriginal = this.excalidrawData.getParsedResult(textElement.id);
    if (this.textMode === TextMode.parsed) {
      return {
        updatedNextOriginalText: parseResultOriginal.parsed,
        nextLink: this.plugin.settings.syncElementLinkWithText
        ? textElement.link
        : (parseResultOriginal.hasTextLink ? textElement.rawText : null)
      };
    }
    return {
      updatedNextOriginalText: null,
      nextLink: this.plugin.settings.syncElementLinkWithText
      ? textElement.link
      : (parseResultOriginal.hasTextLink ? textElement.rawText : null)
    };
  }

  private async onLinkOpen(element: ExcalidrawElement, e: any): Promise<void> {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.onLinkOpen, "ExcalidrawView.onLinkOpen", element, e);
    e.preventDefault();
    if (!element) {
      return;
    }

    let textLink = "";
    //if element is type text and element has multiple links, then submit the element text to linkClick to trigger link suggester
    if(element.type === "text") {
      const linkText = element.rawText.replaceAll("\n", ""); //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/187
      const partsArray = REGEX_LINK.getResList(linkText);
      if(partsArray.filter(p=>Boolean(p.value)).length >= 1) {
        textLink = linkText;
      }
    }

    let link = (element.link ?? "") + " " + textLink;
    link = link.trim();
    if (!link) {
      return;
    }
    window.setTimeout(()=>this.removeLinkTooltip(),500);

    let event = e?.detail?.nativeEvent;
    if(this.handleLinkHookCall(element,link,event)) return;
    //if(openExternalLink(element.link, this.app, !isSHIFT(event) && !isWinCTRLorMacCMD(event) && !isWinMETAorMacCTRL(event) && !isWinALTorMacOPT(event) ? element : undefined)) return;
    if(openExternalLink(link, this.app)) return;

    if (!event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event = emulateKeysForLinkClick("new-tab");
    }

    this.linkClick(
      event,
      null,
      null,
      {id: element.id, text: link},
      event,
      true,
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
      let textLink = "";
      //if element is type text and element has multiple links, then submit the element text to linkClick to trigger link suggester
      if(element.type === "text") {
        const linkText = element.rawText.replaceAll("\n", ""); //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/187
        const partsArray = REGEX_LINK.getResList(linkText);
        if(partsArray.filter(p=>Boolean(p.value)).length >= 1) {
          textLink = linkText;
        }
      }

      const link = element.link ?? textLink; //in case of hover, if the user hovers the link indicator then the element link has priority
      if (!link) {
        return;
      }
      const linkMatch = link.match(/\[\[(?<link>.*?)\]\]/);
      if (linkMatch) {
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

  public async insertBackOfTheNoteCard(center: boolean = false) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.insertBackOfTheNoteCard, "ExcalidrawView.insertBackOfTheNoteCard");
    await this.forceSave(true);
    const sections = await this.getBackOfTheNoteSections(); 
    const selectCardDialog = new SelectCard(this.app,this,sections);
    selectCardDialog.start(center);
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
      const newFile = await createOrOverwriteFile(this.app, path, child.text);
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

  private insertLinkAction(linkVal: string) {
    let link = linkVal.match(/\[\[(.*?)\]\]/)?.[1];
    if(!link) {
      link = linkVal.replaceAll("[","").replaceAll("]","");
      link = link.split("|")[0].trim();
    }
    this.plugin.insertLinkDialog.start(this.file.path, (markdownlink: string, path:string, alias:string) => this.addLink(markdownlink, path, alias, linkVal), link);
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
            this.handleLinkClick(event, true);
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

      const selectedImages = this.getViewSelectedElements().filter(el => el.type === "image") as ExcalidrawImageElement[];
      if(selectedImages.length > 0) {
        type ImageType = "svg" | "pdf" | "bitmap" | "excalidraw";

        const getImageType = (embeddedFile: EmbeddedFile | null | undefined): ImageType | null => {
          if(!embeddedFile) return null;
          if(embeddedFile.file && this.plugin.isExcalidrawFile(embeddedFile.file)) return "excalidraw";
          if(embeddedFile.file?.extension?.toLowerCase?.() === "pdf" || !!embeddedFile.pdfPageViewProps) return "pdf";
          if(embeddedFile.mimeType === "image/svg+xml") return "svg";
          return "bitmap";
        };

        const getInvertInDarkMode = (
          imageEl: ExcalidrawImageElement,
          embeddedFile: EmbeddedFile,
          imageType: ImageType,
        ): boolean => {
          const invertBitmap = imageEl.customData?.invertBitmapInDarkmode;
          if(imageType === "svg" || imageType === "excalidraw") {
            return imageEl.customData?.doNotInvertSVGInDarkMode ? false : true;
          }
          if(imageType === "pdf") {
            return typeof invertBitmap === "boolean" ? invertBitmap : true;
          }
          return typeof invertBitmap === "boolean" ? invertBitmap : false;
        };

        const imageMenuState = (() => {
          const ea = getEA(this) as ExcalidrawAutomate;
          try {
            const imagesWithStatus = selectedImages
              .map(el => {
                const embeddedFile = getEmbeddedFileForImageElment(ea, el);
                const imageType = getImageType(embeddedFile);
                if(!embeddedFile || !imageType) return null;
                return {
                  el,
                  imageType,
                  invertInDarkMode: getInvertInDarkMode(el, embeddedFile, imageType),
                };
              })
              .filter(Boolean) as { el: ExcalidrawImageElement; imageType: ImageType; invertInDarkMode: boolean; }[];
            if(imagesWithStatus.length === 0) return null;
            const reference = imagesWithStatus[0].invertInDarkMode;
            if(!imagesWithStatus.every(img => img.invertInDarkMode === reference)) return null;
            return { imagesWithStatus, invertInDarkMode: reference };
          } finally {
            ea.destroy();
          }
        })();

        if(imageMenuState) {
          const { imagesWithStatus, invertInDarkMode } = imageMenuState;
          const newInvertState = !invertInDarkMode;
          contextMenuActions.push([
            renderContextMenuAction(
              React,
              newInvertState ? t("INVERT_IMAGES_IN_DARK_MODE") : t("DO_NOT_INVERT_IMAGES_IN_DARK_MODE"),
              async () => {
                const ea = getEA(this) as ExcalidrawAutomate;
                ea.copyViewElementsToEAforEditing(imagesWithStatus.map(img => img.el));
                imagesWithStatus.forEach(img => {
                  const editableEl = ea.getElement(img.el.id) as Mutable<ExcalidrawImageElement>;
                  const embeddedFile = getEmbeddedFileForImageElment(ea, editableEl);
                  const imageType = getImageType(embeddedFile) ?? img.imageType;
                  if(imageType === "svg" || imageType === "excalidraw") {
                    addAppendUpdateCustomData(editableEl, {
                      doNotInvertSVGInDarkMode: newInvertState ? undefined : true,
                      invertBitmapInDarkmode: undefined,
                    });
                  } else {
                    addAppendUpdateCustomData(editableEl, {
                      invertBitmapInDarkmode: newInvertState,
                      doNotInvertSVGInDarkMode: undefined,
                    });
                  }
                });
                await ea.addElementsToView(false);
                ea.destroy();
              },
              onClose
            ),
          ]);
        }
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
              const path = this.file.path.match(/(.*)(\.md)$/)?.[1];
              navigator.clipboard.writeText(`![[${path ?? this.file.path}]]`);
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
      if (DEVICE.isTablet || DEVICE.isMobile) {
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
      }
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

      if(
        !areElementsSelected &&
        elements.some(el=>el.type === "frame" && el.frameRole === "marker")
      ) {
        const {frameRendering} = appState;
        contextMenuActions.push([
          renderContextMenuAction(
            React,
            frameRendering.markerEnabled && frameRendering.enabled && frameRendering.outline
            ? t("MARKER_FRAME_HIDE")
            : t("MARKER_FRAME_SHOW"),
            () => {
              const markerEnabled = !(frameRendering.markerEnabled && frameRendering.enabled && frameRendering.outline);
              if(markerEnabled) {
                window.setTimeout(() => this.updateScene({appState: {frameRendering: {...frameRendering, enabled: true, outline: true, markerEnabled}}, captureUpdate: CaptureUpdateAction.NEVER}));
              } else {
                window.setTimeout(() => this.updateScene({appState: {frameRendering: {...frameRendering, markerEnabled}}, captureUpdate: CaptureUpdateAction.NEVER}));
              }
            },
            onClose
          ),
        ]);
        if(frameRendering.markerEnabled && frameRendering.enabled && frameRendering.outline) {
          contextMenuActions.push([
            renderContextMenuAction(
              React,
              frameRendering.markerName
              ? t("MARKER_FRAME_TITLE_HIDE")
              : t("MARKER_FRAME_TITLE_SHOW"),
              () => {
                window.setTimeout(() => this.updateScene({appState: {frameRendering: {...frameRendering, markerName: !frameRendering.markerName}}, captureUpdate: CaptureUpdateAction.NEVER}));
              },
              onClose
            ),
          ]);
        }
      }
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
    }
    this.exportDialog.open();
  }

  private setExcalidrawAPI (api: ExcalidrawImperativeAPI) {
    this.excalidrawAPI = api;
    //api.setLocalFont(this.plugin.settings.experimentalEnableFourthFont);
    window.setTimeout(() => {
      // window migration scenario
      if (!this.plugin) return;
      this.onAfterLoadScene(true);
      this.excalidrawContainer?.focus();
    });
  };

  private ttdDialog() {
    const systemPrompt = "The user will provide you with a text prompt. Your task is to generate a mermaid diagram based on the prompt. Use the graph, sequenceDiagram, flowchart or classDiagram types based on what best fits the request. Return a single message containing only the mermaid diagram in a codeblock. Avoid the use of `()` parenthesis in the mermaid script.";
    const instruction = "Return a single message containing only the mermaid diagram in a codeblock.";

    return this.packages.react.createElement(
      this.packages.excalidrawLib.TTDDialog,
      {
        persistenceAdapter: ttdPersistenceAdapter,
        onTextSubmit: async (props: any) => {
          const { messages = [], onChunk, onStreamCreated, signal } = props ?? {};
          const {
            openAIAPIToken,
            openAIDefaultTextModel,
            openAIDefaultTextModelMaxTokens,
            openAIURL,
          } = this.plugin.settings;

          if (!openAIAPIToken) {
            return {
              error: new Error("OpenAI API Token is not set. Please set it in plugin settings."),
            };
          }

          const requestMessages = [
            { role: "system", content: systemPrompt },
            ...messages,
            { role: "user", content: instruction },
          ];

          // Determine which token limit parameter to use based on model
          // Newer models (gpt-4o, gpt-5, o1, o3) use max_completion_tokens
          // Older models use max_tokens
          const useMaxCompletionTokens = openAIDefaultTextModel && 
            (openAIDefaultTextModel.includes("gpt-4o") || 
             openAIDefaultTextModel.includes("gpt-5") || 
             openAIDefaultTextModel.includes("o1") || 
             openAIDefaultTextModel.includes("o3"));
          
          const tokenLimitParam = openAIDefaultTextModelMaxTokens > 0 
            ? (useMaxCompletionTokens 
                ? { max_completion_tokens: openAIDefaultTextModelMaxTokens }
                : { max_tokens: openAIDefaultTextModelMaxTokens })
            : {};

          try {
            const resp = await fetch(openAIURL, {
              method: "post",
              body: JSON.stringify({
                model: openAIDefaultTextModel,
                ...tokenLimitParam,
                messages: requestMessages,
              }),
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${openAIAPIToken}`,
              },
              signal,
            });

            onStreamCreated?.();

            if (!resp) {
              return { error: new Error("Request failed") };
            }

            const rateLimitHeader = resp.headers.get("x-ratelimit-limit");
            const rateLimitRemainingHeader = resp.headers.get("x-ratelimit-remaining");
            const rateLimit = rateLimitHeader && !Number.isNaN(Number(rateLimitHeader)) ? Number(rateLimitHeader) : null;
            const rateLimitRemaining = rateLimitRemainingHeader && !Number.isNaN(Number(rateLimitRemainingHeader)) ? Number(rateLimitRemainingHeader) : null;

            const json = await resp.json();
            (process.env.NODE_ENV === "development") && DEBUGGING && debug(this.ttdDialog, `ExcalidrawView.ttdDialog > onTextSubmit, openAI response`, json);

            if (!resp.ok || json?.error) {
              log(json);
              return {
                error: new Error(json?.error?.message ?? `Request failed with status ${resp.status}`),
                rateLimit,
                rateLimitRemaining,
              };
            }

            const content = json?.choices?.[0]?.message?.content;
            if (!content) {
              log(json);
              return {
                error: new Error("Generation failed... see console log for details"),
                rateLimit,
                rateLimitRemaining,
              };
            }

            let generatedResponse = extractCodeBlocks(content)[0]?.data ?? content.trim();

            if (!generatedResponse) {
              log(json);
              return {
                error: new Error("Generation failed... see console log for details"),
                rateLimit,
                rateLimitRemaining,
              };
            }

            if (generatedResponse.startsWith("mermaid")) {
              generatedResponse = generatedResponse.replace(/^mermaid/, "").trim();
            }

            onChunk?.(generatedResponse);

            return { generatedResponse, rateLimit, rateLimitRemaining };
          } catch (err: any) {
            if (err?.name === "AbortError") {
              return { error: new Error("Request aborted") };
            }
            console.log(err);
            return { error: new Error("Request failed") };
          }
        },
      }
    );
  };

  private diagramToCode() {
    return this.packages.react.createElement(
      this.packages.excalidrawLib.DiagramToCodePlugin,
      {
        generate: async ({ frame, children }: 
          {frame: ExcalidrawMagicFrameElement, children: readonly ExcalidrawElement[]}) => {
          const appState = this.excalidrawAPI.getAppState();
          try {
            const blob = await this.packages.excalidrawLib.exportToBlob({
              elements: children,
              appState: {
                ...appState,
                exportBackground: true,
                viewBackgroundColor: appState.viewBackgroundColor,
              },
              exportingFrame: frame,
              files: this.excalidrawAPI.getFiles(),
              mimeType: "image/jpeg",
            });
  
            const dataURL = await this.packages.excalidrawLib.getDataURL(blob);
            const textFromFrameChildren = this.packages.excalidrawLib.getTextFromElements(children);
  
            const response = await diagramToHTML ({
              image:dataURL,
              apiKey: this.plugin.settings.openAIAPIToken,
              text: textFromFrameChildren,
              theme: appState.theme,
              openAIURL: this.plugin.settings.openAIURL,
            });
  
            if (!response.ok) {
              const json = await response.json();
              const text = json.error?.message || "Unknown error during generation";
              return {
                html: errorHTML(text),
              };
            }
  
            const json = await response.json();
            if(json.choices[0].message.content == null) {
              return {
                html: errorHTML("Nothing generated"),
              };
            }

            const message = json.choices[0].message.content;  
                
            const html = message.slice(  
              message.indexOf("<!DOCTYPE html>"),  
              message.indexOf("</html>") + "</html>".length,  
            );
  
            return { html };
          } catch (err: any) {
            return {
              html: errorHTML("Request failed"),
            };
          }
        },
      }
    );
  }
  

  private ttdDialogTrigger() {
    return this.packages.react.createElement(
      this.packages.excalidrawLib.TTDDialogTrigger,
      {},
    );
  }

  private renderWelcomeScreen() {
    if (!this.plugin.settings.showSplashscreen) return null;
    const React = this.packages.react;
    const { WelcomeScreen } = this.packages.excalidrawLib;
    const filecount = this.app.vault.getFiles().filter(f => this.plugin.isExcalidrawFile(f)).length;
    const rank = filecount < 200 ? "Bronze" : filecount < 750 ? "Silver" : filecount < 2000 ? "Gold" : "Platinum";
    const nextRankDelta = filecount < 200 ? 200 - filecount : filecount < 750 ? 750 - filecount : filecount < 2000 ? 2000 - filecount : 0;
    const { decoration, title } = SwordColors[rank as Rank];
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
            message: nextRankDelta > 0 
              ? `${rank}: ${nextRankDelta} ${t("WELCOME_RANK_NEXT")}` 
              : `${rank}: ${t("WELCOME_RANK_LEGENDARY")}`,
          },
          title,
        ),
        React.createElement(
          WelcomeScreen.Center.Heading,
          {},
          t("WELCOME_COMMAND_PALETTE"),
          React.createElement("br"),
          t("WELCOME_OBSIDIAN_MENU"),
          React.createElement("br"),
          t("WELCOME_SCRIPT_LIBRARY"),
          React.createElement("br"),
          t("WELCOME_HELP_MENU"),
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
              "aria-label": t("WELCOME_YOUTUBE_ARIA"),
            },
            t("WELCOME_YOUTUBE_LINK")
          ),
          React.createElement(
            WelcomeScreen.Center.MenuItemLink,
            {
              icon: ICONS.Discord,
              href: "https://discord.gg/DyfAXFwUHc",
              shortcut: null,
              "aria-label": t("WELCOME_DISCORD_ARIA"),
            },
            t("WELCOME_DISCORD_LINK")
          ),
          React.createElement(
            WelcomeScreen.Center.MenuItemLink,
            {
              icon: ICONS.twitter,
              href: "https://twitter.com/zsviczian",
              shortcut: null,
              "aria-label": t("WELCOME_TWITTER_ARIA"),
            },
            t("WELCOME_TWITTER_LINK")
          ),
          React.createElement(
            WelcomeScreen.Center.MenuItemLink,
            {
              icon: ICONS.Learn,
              href: "https://visual-thinking-workshop.com",
              shortcut: null,
              "aria-label": t("WELCOME_LEARN_ARIA"),
            },
            t("WELCOME_LEARN_LINK")
          ),
          React.createElement(
            WelcomeScreen.Center.MenuItemLink,
            {
              icon: ICONS.heart,
              href: "https://ko-fi.com/zsolt",
              shortcut: null,
              "aria-label": t("WELCOME_DONATE_ARIA"),
            },
            t("WELCOME_DONATE_LINK")
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
      React.createElement(
        MainMenu.Item,
        {              
          icon: getTrayIcon(),
          "aria-label": t("ARIA_LABEL_TRAY_MODE"),
          onSelect: ()=> {
            const uiModes = new UIModeSettings(this.plugin);
            uiModes.open();
          },
        },
        t("TRAY_TRAY_MODE")
      ),
      React.createElement(
        MainMenu.Item,
        {              
          icon: saveIcon(false),
          "aria-label": t("FORCE_SAVE"),
          onSelect: ()=> this.forceSave(),
        },
        t("TRAY_SAVE")
      ),
      React.createElement(
        MainMenu.Item,
        {              
          icon: ICONS.scriptEngine,
          "aria-label": t("TRAY_SCRIPT_LIBRARY_ARIA"),
          onSelect: ()=> this.actionOpenScriptInstallPrompt(),
        },
        t("TRAY_SCRIPT_LIBRARY")
      ),
      React.createElement(
        MainMenu.Item,
        {              
          icon: ICONS.ExportImage,
          "aria-label": t("TRAY_EXPORT_ARIA"),
          onSelect: ()=> this.actionOpenExportImageDialog(),
        },
        t("TRAY_EXPORT")
      ),
      React.createElement(
        MainMenu.Item,
        {              
          icon: ICONS.switchToMarkdown,
          "aria-label": t("TRAY_SWITCH_TO_MD_ARIA"),
          onSelect: ()=> this.openAsMarkdown(),
        },
        t("TRAY_SWITCH_TO_MD")
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

  private scheduleBatchedResize(currentDeltaHeight: number) {
    const api = this.excalidrawAPI as ExcalidrawImperativeAPI;
    if (!api || !api.isTouchScreen) return;

    if (!this.resizeBatchTimer) {
      this.lastAggregatedDh = 0;
      this.resizeBatchWindowStart = Date.now();
    }

    this.lastAggregatedDh += currentDeltaHeight;

    if (this.resizeBatchTimer) window.clearTimeout(this.resizeBatchTimer);

    const elapsed = Date.now() - this.resizeBatchWindowStart;
    const absoluteDelta = Math.abs(this.lastAggregatedDh);
    const deltaExceeded = absoluteDelta >= 80;          // lower threshold to catch multi-step keyboards
    const windowExceeded = elapsed > 2000;              // hard stop if the keyboard resizes in many tiny steps
    const debounceDelay = deltaExceeded ? 60 : 200;     // short delay once we see large movement
    const finalDelay = windowExceeded ? 0 : debounceDelay;

    this.resizeBatchTimer = window.setTimeout(() => {
      const dh = this.lastAggregatedDh;
      this.resizeBatchTimer = null;
      this.lastAggregatedDh = 0;
      this.resizeBatchWindowStart = 0;

      if (Math.abs(dh) > 60) {                          // slightly lower than previous 120 to react earlier
        this.onExcalidrawResize();
      }
    }, finalDelay);
  }

  private onExcalidrawResize() {
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
      //the issue is that when the user hides the keyboard with the keyboard hide button and not tapping on the screen, then editingTextElement is not null
      const isEventOnSameElement = this.editingTextElementId === st.editingTextElement?.id;
      const isKeyboardOutEvent:Boolean = st.editingTextElement && !isEventOnSameElement;
      const isKeyboardBackEvent:Boolean = (this.semaphores.isEditingText || isEventOnSameElement) && !isKeyboardOutEvent;
      this.editingTextElementId = isKeyboardOutEvent ? st.editingTextElement.id : null;

      if(isKeyboardOutEvent) {
          const elTop = st.editingTextElement.y;
          const elHeight = (st.editingTextElement as any).height ?? 0;
          const elCenterY = elTop + elHeight / 2;

          const visibleHeight = st.height / st.zoom.value;
          // visibleTop is -scrollY in scene coords
          const visibleTop = -st.scrollY;
          const topThreeQuarterThreshold = visibleTop + visibleHeight * 0.75;

          // If the editing text element is in the top 3/4 of the visible screen, do not change scroll
          if (!(elCenterY >= visibleTop && elCenterY <= topThreeQuarterThreshold)) {
            // Otherwise, vertically center the editing text element in the visible area
            const desiredVisibleTop = elCenterY - visibleHeight / 2;
            const newScrollY = -desiredVisibleTop;

            this.oldKeyboardScroll = {scrollY: st.scrollY, scrollX: st.scrollX};
            this.updateScene({appState: {scrollY: newScrollY}, captureUpdate: CaptureUpdateAction.NEVER});
          }

          this.containerEl.scrollIntoView();
      }
      if (isKeyboardBackEvent) {
        if(this.oldKeyboardScroll != null) {
          // Restore only vertical scroll; remove horizontal scroll completely
          this.updateScene({
            appState: {scrollY: this.oldKeyboardScroll.scrollY},
            captureUpdate: CaptureUpdateAction.NEVER
          });
          this.oldKeyboardScroll = null;
          this.containerEl.scrollIntoView();
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
          onKeyUp: this.excalidrawDIVonKeyUp.bind(this),
          onPointerDown: this.onPointerDown.bind(this),
          onMouseMove: this.onMouseMove.bind(this),
          onMouseOver: this.onMouseOver.bind(this),
          onDragOver : this.dropManager?.onDragOver.bind(this.dropManager),
          onDragLeave: this.dropManager?.onDragLeave.bind(this.dropManager),
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
              desktopUIMode: calculateUIModeValue(this.plugin.settings),
              //formFactor: DEVICE.isMobile ? "phone" : DEVICE.isTablet ? "tablet" : "desktop",
            },
            initState: initdata?.appState,
            initialData: initdata,
            detectScroll: true,
            onPointerUpdate: this.onPointerUpdate.bind(this),
            libraryReturnUrl: "app://obsidian.md",
            autoFocus: true,
            langCode: obsidianToExcalidrawMap[this.plugin.locale]??"en-EN",
            aiEnabled: this.plugin.settings.aiEnabled??true,
            onChange: this.onChange.bind(this),
            onLibraryChange: this.onLibraryChange.bind(this),
            renderTopRightUI: this.renderTopRightUI.bind(this), //(isMobile: boolean, appState: AppState) => this.obsidianMenu.renderButton (isMobile, appState),
            renderEmbeddableMenu: this.renderEmbeddableMenu.bind(this),
            onPaste: this.onPaste.bind(this),
            onThemeChange: this.onThemeChange.bind(this),
            onDrop: this.dropManager?.onDrop.bind(this.dropManager),
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
            showDeprecatedFonts: true,
            insertLinkAction: DEVICE.isDesktop ? undefined : this.insertLinkAction.bind(this),
          },
          this.renderCustomActionsMenu(),
          this.renderWelcomeScreen(),
          this.ttdDialog(),
          this.diagramToCode(),
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
    await this.plugin.awaitInit();
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
      captureUpdate: CaptureUpdateAction.NEVER,
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
      captureUpdate: CaptureUpdateAction.NEVER,
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
      captureUpdate: CaptureUpdateAction.NEVER,
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
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }

  public toggleEnableContextMenu() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.toggleEnableContextMenu, "ExcalidrawView.toggleEnableContextMenu");
    const api = this.excalidrawAPI as ExcalidrawImperativeAPI;
    if (!api) {
      return;
    }
    const disableContextMenu = api.getAppState().disableContextMenu;
    this.updateScene({appState: {disableContextMenu: !disableContextMenu}, captureUpdate: CaptureUpdateAction.NEVER});
  }

  public setUIMode(mode: UIMode) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.setUIMode, "ExcalidrawView.setDesktopUIMode");
    const api = this.excalidrawAPI as ExcalidrawImperativeAPI;
    api.setDesktopUIMode(mode);
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
      exactMatch,
    ).concat(getFrameElementsMatchingQuery(
      elements.filter((el: ExcalidrawElement) => el.type === "frame"),
      query,
      exactMatch,
    )).concat(getElementsWithLinkMatchingQuery(
      elements.filter((el: ExcalidrawElement) => el.link),
      query,
      exactMatch,
    )).concat(getImagesMatchingQuery(
      elements,
      query,
      this.excalidrawData,
      exactMatch,
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
    const api = this.excalidrawAPI as ExcalidrawImperativeAPI;
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
  public copyLinkToSelectedElementToClipboard(prefix: string) {
    (process.env.NODE_ENV === "development") &&
      DEBUGGING &&
      debug(
        this.copyLinkToSelectedElementToClipboard,
        "ExcalidrawView.copyLinkToSelectedElementToClipboard",
        prefix,
      );
    copyLinkToSelectedElementToClipboard(this, prefix);
  }

  public updateScene(
    scene: {
      elements?: ExcalidrawElement[];
      appState?: any;
      files?: any;
      storeAction?: "capture" | "none" | "update"; //https://github.com/excalidraw/excalidraw/pull/7898
      captureUpdate?: SceneData["captureUpdate"];
    },
    shouldRestore: boolean = false,
  ) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.updateScene, "ExcalidrawView.updateScene", scene, shouldRestore);
    const api = this.excalidrawAPI as ExcalidrawImperativeAPI;
    if (!api) {
      return;
    }

    if(typeof scene.storeAction === "string") {
      switch(scene.storeAction) {
        case "capture":
          scene.captureUpdate = CaptureUpdateAction.IMMEDIATELY;
          break;
        case "none":
          scene.captureUpdate = CaptureUpdateAction.EVENTUALLY;
          break;
        default:
          scene.captureUpdate = CaptureUpdateAction.NEVER;
      }
      delete scene.storeAction;
    }
    const shouldRestoreElements = scene.elements && shouldRestore;
    if (shouldRestoreElements) {
      scene.elements = restoreElements(scene.elements, null, {refreshDimensions: true, repairBindings: true});
    }
    if(Boolean(scene.appState)) {
      //@ts-ignore
      scene.forceFlushSync = true;
    }
    if(scene.elements) {
      scene.elements = syncInvalidIndices(scene.elements);
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
          scene.elements = restoreElements(scene.elements, null, {refreshDimensions: true, repairBindings: true});
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

  public updateEmbeddableRef(
    elementId: string,
    ref: HTMLIFrameElement | HTMLWebViewElement | null,
  ) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.updateEmbeddableRef, "ExcalidrawView.updateEmbeddableRef", elementId, ref);
    if (ref) {
      this.embeddableRefs.set(elementId, ref);
    } else {
      this.embeddableRefs.delete(elementId);
    }
  }

  public getEmbeddableElementById(id: string): HTMLIFrameElement | HTMLWebViewElement | undefined {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.getEmbeddableElementById, "ExcalidrawView.getEmbeddableElementById", id);
    return this.embeddableRefs.get(id);
  }

  public updateEmbeddableLeafRef(
    elementId: string,
    ref?: any
  ) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.updateEmbeddableLeafRef, "ExcalidrawView.updateEmbeddableLeafRef", elementId, ref);
    if(ref) {
      this.embeddableLeafRefs.set(elementId, ref);
    } else {
      this.embeddableLeafRefs.delete(elementId);
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
