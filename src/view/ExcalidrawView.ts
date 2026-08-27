import {
  Editor,
  TextFileView,
  WorkspaceLeaf,
  TFile,
  WorkspaceItem,
  Notice,
  Menu,
  MarkdownView,
  ViewStateResult,
  requireApiVersion,
  HoverParent,
  HoverPopover,
} from "obsidian";
import {
  ExcalidrawElement,
  ExcalidrawImageElement,
  ExcalidrawEmbeddableElement,
  ExcalidrawTextElement,
  FileId,
  NonDeletedExcalidrawElement,
  BoundElement,
  ElementsMap,
} from "@zsviczian/excalidraw/types/element/src/types";
import {
  AppState,
  BinaryFileData,
  BinaryFiles,
  DataURL,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
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
  IMAGE_TYPES,
  FRONTMATTER_KEYS,
  DEVICE,
  EXPORT_IMG_ICON_NAME,
  viewportCoordsToSceneCoords,
  ERROR_IFRAME_CONVERSION_CANCELED,
  restoreElements,
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
import { TextMode, getTextMode } from "../shared/TextMode";
import { ExcalidrawSidepanelView } from "./sidepanel/Sidepanel";
import {
  repositionElementsToCursor,
  cloneElement,
  getBoundTextElementId,
} from "../utils/excalidrawViewHelpers";
import { t } from "../lang/helpers";
import {
  ExcalidrawData,
  REG_LINKINDEX_HYPERLINK,
  REGEX_LINK,
  AutoexportPreference,
  getExcalidrawMarkdownHeaderSection,
  parseMarkdownImages,
  syncMarkdownImagesInHeader,
  unwrapMarkdownImageBlock,
} from "../shared/ExcalidrawData";
import {
  createFileAndAwaitMetacacheUpdate,
  createOrOverwriteFile,
  getDataURLFromURL,
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
import type {
  ExcalidrawImageWithCustomData,
  ExcalidrawLatexCustomData,
} from "../utils/elementCustomDataUtils";
import {
  closeLeafView,
  getExcalidraAndMarkdowViewsForFile,
  getLeaf,
  getParentOfClass,
  obsidianPDFQuoteWithRef,
  openLeaf,
  setExcalidrawView,
} from "../utils/obsidianUtils";
import {
  cleanBlockRef,
  cleanSectionHeading,
  getAttachmentsFolderAndFilePath,
} from "../utils/pathUtils";
import { splitFolderAndFilename } from "../utils/fileUtils";
import {
  GenericInputPrompt,
  LaTexPrompt,
  MultiOptionConfirmationPrompt,
  NewFileActions,
  linkPrompt,
} from "../shared/Dialogs/Prompt";
import {
  ClipboardData,
  ParsedDataTransferFile,
} from "@zsviczian/excalidraw/types/excalidraw/clipboard";
import { updateEquation } from "../shared/LaTeX";
import {
  EmbeddedFile,
  EmbeddedFilesLoader,
  generateIdFromFile,
} from "../shared/EmbeddedFileLoader";
import {
  convertEmbeddableElementToMarkdownImage,
  convertMarkdownImageElementToEmbeddable,
  getEmbeddableMarkdownImageSource,
  getLevelOneMarkdownHeadings,
  getMarkdownImageCustomData,
  getMarkdownImageSource,
  isMarkdownImageElement,
} from "../shared/MarkdownImage";
import {
  handleMarkdownImageEditorSelection,
  handleMarkdownImageEditorViewUnload,
  openMarkdownImageEditor as openMarkdownImageEditorSidepanel,
} from "./sidepanel/MarkdownImageEditor";
import { ScriptInstallPrompt } from "../shared/Dialogs/ScriptInstallPrompt";
import { ObsidianMenu } from "./components/menu/ObsidianMenu";
import { ToolsPanel } from "./components/menu/ToolsPanel";
import { SelectedElementActionsMenu } from "./components/menu/SelectedElementActionsMenu";
import { ScriptEngine } from "../shared/Scripts";
import {
  getTextElementAtPointer,
  getImageElementAtPointer,
  getElementWithLinkAtPointer,
} from "../utils/getElementAtPointer";
import { ExportDialog } from "../shared/Dialogs/ExportDialog";
import { FileAndFolderSelectorModal } from "../shared/Dialogs/FileAndFolderSelectorModal";
import { getEA } from "src/core";
import {
  anyModifierKeysPressed,
  emulateKeysForLinkClick,
  isWinALTorMacOPT,
  isWinCTRLorMacCMD,
  isWinMETAorMacCTRL,
  isSHIFT,
  linkClickModifierType,
  ModifierKeys,
} from "../utils/modifierkeyHelper";
import { setDynamicStyle } from "../utils/dynamicStyling";
import { CustomEmbeddable, renderWebView } from "./components/CustomEmbeddable";
import {
  addBackOfTheNoteCard,
  insertBackOfTheNoteContent,
  addTextWithOEmbed,
  deleteAppStateKeys,
  getExcalidrawFileForwardLinks,
  getFrameBasedOnFrameNameOrId,
  getLinkTextFromLink,
  insertEmbeddableToView,
  insertImageToView,
  isTextImageTransclusion,
  onLoadMessages,
  openExternalLink,
  parseObsidianLink,
  renderContextMenuAction,
  sceneRemoveInternalLinks,
  setMobileNavbarPosition,
  tmpBruteForceCleanup,
  toggleImageAnchoring,
} from "../utils/excalidrawViewUtils";
import { getImageCache } from "../shared/ImageCache";
import { CanvasNodeFactory } from "./managers/CanvasNodeFactory";
import { EmbeddableMenu } from "./components/menu/EmbeddableActionsMenu";
import { useDefaultExcalidrawFrame } from "../utils/customEmbeddableUtils";
import { UniversalInsertFileModal } from "../shared/Dialogs/UniversalInsertFileModal";
import { createExcalidrawRootElement } from "./components/ExcalidrawRoot";
import { nanoid } from "nanoid";
import { CustomMutationObserver, DEBUGGING } from "../utils/debugHelper";
import {
  errorHTML,
  extractCodeBlocks,
  generateAIText,
  getJsonErrorMessage,
} from "../utils/AIUtils";
import { Mutable } from "@zsviczian/excalidraw/types/common/src/utility-types";
import { SelectCard } from "../shared/Dialogs/SelectCard";
import { PackageLease, Packages } from "../types/types";
import React from "react";
import { diagramToHTML } from "../utils/matic";
import { IS_WORKER_SUPPORTED } from "../shared/Workers/compression-worker";
import {
  AutoexportConfig,
  EmbeddableLeafRef,
  ExcalidrawEphemeralState,
  ExcalidrawLinkOpenEvent,
  ExcalidrawViewScene,
  ExcalidrawViewUpdateScene,
  MarkdownBlockCacheEntry,
  MarkdownViewOpenState,
  Position,
  SelectedElementWithLink,
  SelectedImage,
  StencilLibraryData,
  ViewSemaphores,
} from "../types/excalidrawViewTypes";
import { DropManager } from "./managers/DropManager";
import { ViewExportManager } from "./managers/ViewExportManager";
import { ViewFullscreenManager } from "./managers/ViewFullscreenManager";
import { ViewLinkNavigationManager } from "./managers/ViewLinkNavigationManager";
import { ViewExcalidrawExtensionRenderer } from "./managers/ViewExcalidrawExtensionRenderer";
import { MarkdownImageController } from "./managers/MarkdownImageController";
import { ViewSceneFileManager } from "./managers/ViewSceneFileManager";
import {
  type SaveExecutionResult,
  type SaveSideEffectPolicy,
  ViewSaveCoordinator,
  WINDOW_BLUR_FORCE_SAVE_POLICY,
} from "./managers/ViewSaveCoordinator";
import type { ViewMigrationDrawingState } from "../core/managers/ViewMigrationHandoffManager";
import { ImageInfo } from "src/types/excalidrawAutomateTypes";
import { PageOrientation, PageSize } from "src/types/exportUtilTypes";
import { CaptureUpdateAction } from "src/constants/constants";
import { updateElementIdsInScene } from "src/utils/excalidrawSceneUtils";
import { FileData } from "src/types/embeddedFileLoaderTypes";
import { UIMode } from "src/shared/Dialogs/UIModeSettingComponent";
import { UIModeSettings } from "src/shared/Dialogs/UIModeSettings";
import { copyLinkToSelectedElementToClipboard } from "src/shared/Dialogs/copyLinkToSelectedElement";
import { getPDFCropRect } from "src/utils/PDFUtils";
import {
  CaptureUpdateActionType,
  DurableIncrement,
  EphemeralIncrement,
} from "@zsviczian/excalidraw/types/element/src";
import {
  getTextElementsMatchingQuery,
  getFrameElementsMatchingQuery,
  getElementsWithLinkMatchingQuery,
  getImagesMatchingQuery,
  getAppStateStrokeWidthEntry,
} from "src/utils/excalidrawAutomateUtils";
import { getYouTubeUrl, URLs } from "src/constants/safeUrls";
import { setStyle } from "src/utils/styleUtils";
import { isInstanceOfHTMLElement } from "src/utils/typechecks";
import { setElementDisplay } from "src/utils/htmlUtils";

const EMBEDDABLE_SEMAPHORE_TIMEOUT = 2000;
const PREVENT_RELOAD_TIMEOUT = 2000;
const RE_TAIL = /^## Drawing\n[\s\S]*\n%%$(.*)/ms;

declare const PLUGIN_VERSION: string;
declare const mainDocument: Document;

interface WorkspaceItemExt extends WorkspaceItem {
  containerEl: HTMLElement;
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
    isDark = s.scene.appState.theme === "dark";
  }
  // update element.crop naturalWidth and naturalHeight in case scale of PDF loading has changed
  // update crop.x crop.y, crop.width, crop.height according to the new scale
  files
    .filter(
      (f: FileData) =>
        view.excalidrawData.getFile(f.id)?.file?.extension === "pdf",
    )
    .forEach((f: FileData) => {
      s.scene.elements
        .filter(
          (el: ExcalidrawElement) =>
            el.type === "image" &&
            el.fileId === f.id &&
            ((el.crop && el.crop?.naturalWidth !== f.size.width) ||
              !el.customData?.pdfPageViewProps),
        )
        .forEach((el: Mutable<ExcalidrawImageElement>) => {
          if (el.crop) {
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
          if (!el.customData?.pdfPageViewProps) {
            s.dirty = true;
            addAppendUpdateCustomData(el, {
              pdfPageViewProps: f.pdfPageViewProps,
            });
          }
        });
    });

  if (s.dirty) {
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
        isDark: !!isDark,
        isSVGwithBitmap: f.hasSVGwithBitmap,
        pdfPageViewProps: f.pdfPageViewProps,
        renderScale: f.renderScale,
      });
    }
    if (view.excalidrawData.hasEquation(f.id)) {
      const latex = view.excalidrawData.getEquation(f.id).latex;
      view.excalidrawData.setEquation(f.id, { latex, isLoaded: true });
    }
  }
  const skipSvgNormalization = new Set<FileId>();
  for (const file of files) {
    const sourceFile = view.excalidrawData.getFile(file.id)?.file;
    if (
      file.mimeType === "image/svg+xml" &&
      sourceFile &&
      view.plugin.isExcalidrawFile(sourceFile)
    ) {
      skipSvgNormalization.add(file.id);
    }
  }
  if (
    view.excalidrawAPI !== api ||
    api.isDestroyed ||
    view.semaphores?.windowMigrating ||
    view.semaphores?.viewunload
  ) {
    return;
  }
  api.addFiles({ files, skipSvgNormalization });
};

const warningUnknowSeriousError = () => {
  new Notice(t("WARNING_SERIOUS_ERROR"), 60000);
};

type ActionButtons = "save" | "isRaw" | "link" | "scriptInstall";

let windowMigratedDisableZoomOnce = false;

export default class ExcalidrawView
  extends TextFileView
  implements HoverParent
{
  public dropManager: DropManager;
  private exportManager: ViewExportManager;
  private fullscreenManager: ViewFullscreenManager;
  private linkNavigationManager: ViewLinkNavigationManager;
  private excalidrawExtensionRenderer: ViewExcalidrawExtensionRenderer;
  private markdownImageController: MarkdownImageController;
  private sceneFileManager: ViewSceneFileManager;
  private saveCoordinator: ViewSaveCoordinator;
  public hoverPopover: HoverPopover | null = null;
  private freedrawLastActiveTimestamp: number = 0;
  public exportDialog: ExportDialog | null = null;
  public excalidrawData: ExcalidrawData;
  public excalidrawRoot: ReturnType<Packages["reactDOM"]["createRoot"]> | null =
    null;
  public excalidrawAPI: ExcalidrawImperativeAPI = null;
  private windowMigrationSaveSnapshot: {
    scene: NonNullable<ReturnType<ExcalidrawView["getScene"]>>;
    deletedElements: ExcalidrawElement[];
    selectedElementIds: AppState["selectedElementIds"];
  } | null = null;
  public excalidrawWrapperRef: React.RefObject<HTMLDivElement | null> | null =
    null;
  public toolsPanelRef: React.RefObject<ToolsPanel | null> | null = null;
  public embeddableMenuRef: React.RefObject<HTMLDivElement | null> | null =
    null;
  private parentMoveObserver: MutationObserver | CustomMutationObserver | null =
    null;
  public linksAlwaysOpenInANewPane: boolean = false; //override the need for SHIFT+CTRL+click (used by ExcaliBrain)
  public allowFrameButtonsInViewMode: boolean = false; //override for ExcaliBrain
  private _hookServer: ExcalidrawAutomate | null = null;
  public lastSaveTimestamp: number = 0; //used to validate if incoming file should sync with open file
  public lastSceneLoadTime: number = 0; //set when loadSceneFiles completes; used by leaf-switch change detection
  private lastLoadedFile: TFile | null = null;
  //store key state for view mode link resolution
  private modifierKeyDown: ModifierKeys = {
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
  };
  public currentPosition: Position = { x: 0, y: 0 }; //these are scene coord thus would be more apt to call them sceneX and sceneY, however due to scrits already using x and y, I will keep it as is
  //Obsidian 0.15.0
  public canvasNodeFactory: CanvasNodeFactory;
  private embeddableRefs = new Map<
    ExcalidrawElement["id"],
    HTMLIFrameElement | HTMLWebViewElement
  >();
  private embeddableLeafRefs = new Map<
    ExcalidrawElement["id"],
    EmbeddableLeafRef
  >();

  public semaphores: ViewSemaphores | null = {
    warnAboutLinearElementLinkClick: true,
    embeddableIsEditingSelf: false,
    popoutUnload: false,
    windowMigrating: false,
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
  public textMode: TextMode = TextMode.raw;
  private actionButtons: Record<ActionButtons, HTMLElement> = {} as Record<
    ActionButtons,
    HTMLElement
  >;
  public compatibilityMode: boolean = false;
  public obsidianMenu: ObsidianMenu | null = null;
  public embeddableMenu: EmbeddableMenu | null = null;
  public selectedElementActionsMenu: SelectedElementActionsMenu | null = null;
  private destroyers: Array<() => void> = [];
  private previousContentElHeight: number = 0;
  private resizeBatchTimer: number | null = null;
  private excalidrawInitializeTimer: number | null = null;
  private resizeBatchWindowStart: number = 0;
  private lastAggregatedDh = 0;
  private lastOffsetDriftCheck: number = 0;
  private oldKeyboardScroll: { scrollY: number; scrollX: number } | null = null;

  //https://stackoverflow.com/questions/27132796/is-there-any-javascript-event-fired-when-the-on-screen-keyboard-on-mobile-safari
  private isEditingTextResetTimer: number | null = null;
  private preventReloadResetTimer: number | null = null;
  private editingSelfResetTimer: number | null = null;
  private colorChangeTimer: number | null = null;
  private previousSceneVersion = 0;
  public previousBackgroundColor = "";
  public previousTheme = "";
  private pendingUIMode: UIMode | null = null;

  //variables used to handle click events in view mode
  private selectedTextElement: SelectedElementWithLink | null = null;
  private selectedImageElement: SelectedImage | null = null;
  private selectedElementWithLink: SelectedElementWithLink | null = null;
  private blockOnMouseButtonDown = false;
  private doubleClickTimestamp = Date.now();

  private hoverPoint = { x: 0, y: 0 };
  private hoverPreviewTarget: EventTarget | null = null;
  private viewModeEnabled: boolean = false;
  private lastMouseEvent:
    | MouseEvent
    | React.PointerEvent<HTMLCanvasElement>
    | null = null;
  private editingTextElementId: string | null = null; //storing to handle on-screen keyboard hide events

  id: string = this.leaf.id;
  public packages: Packages = {
    react: null,
    reactDOM: null,
    excalidrawLib: null,
  };
  private packageLease: PackageLease | null = null;
  private lastAppState: AppState | null = null;
  private lastElementsVersion: number = -1;
  private pendingMigrationHandoffToken: string | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: ExcalidrawPlugin) {
    super(leaf);
    this._plugin = plugin;
    this.excalidrawData = new ExcalidrawData(plugin, this);
    this.canvasNodeFactory = new CanvasNodeFactory(this);
    this.saveCoordinator = new ViewSaveCoordinator(this, {
      performSave: (
        preventReload,
        forcesave,
        overrideEmbeddableIsEditingSelfDebounce,
        sideEffectPolicy,
      ) =>
        this.performSaveWithSideEffectPolicy(
          preventReload,
          forcesave,
          overrideEmbeddableIsEditingSelfDebounce,
          sideEffectPolicy,
        ),
      requestSave: (
        preventReload,
        forcesave,
        overrideEmbeddableIsEditingSelfDebounce,
      ) =>
        this.save(
          preventReload,
          forcesave,
          overrideEmbeddableIsEditingSelfDebounce,
        ),
      isDirty: () => this.isDirty(),
      checkSceneVersion: () => {
        if (this.excalidrawAPI) {
          this.checkSceneVersion(this.excalidrawAPI.getSceneElements());
        }
      },
      refreshCanvasOffset: () => this.refreshCanvasOffset(),
      getFreedrawLastActiveTimestamp: () => this.freedrawLastActiveTimestamp,
      markDirtyVisuals: () => this.markDirtyVisuals(),
      clearDirtyVisuals: () => this.clearDirtyVisuals(),
    });
    this.exportManager = new ViewExportManager(this, {
      getOrCreateExportDialog: () => this.getOrCreateExportDialog(),
      createEmbeddedFilesLoader: (isDark) =>
        new EmbeddedFilesLoader(this.plugin, isDark),
      getExportInternalLinks,
      getExportPadding,
      getExportTheme,
      getPNG,
      getPNGScale,
      getSVG,
      getWithBackground,
      isMaskFile,
      sceneRemoveInternalLinks,
    });
    this.fullscreenManager = new ViewFullscreenManager(this);
    this.linkNavigationManager = new ViewLinkNavigationManager(this, {
      REGEX_LINK,
      REG_LINKINDEX_HYPERLINK,
      NewFileActions,
      linkPrompt,
      getMarkdownImageSource,
      isMarkdownImageElement,
      splitFolderAndFilename,
      getTextElementAtPointer,
      anyModifierKeysPressed,
      emulateKeysForLinkClick,
      linkClickModifierType,
      getLeaf,
      openLeaf,
      getExcalidrawFileForwardLinks,
      openExternalLink,
      parseObsidianLink,
      arrayToMap,
      errorlog,
      getContainerElementForText: (element) =>
        _getContainerElement(element, {
          elements: this.excalidrawAPI.getSceneElements(),
        }),
      getSelectedTextElement: () => this.getSelectedTextElement(),
      getSelectedImageElement: () => this.getSelectedImageElement(),
      getSelectedElementWithLink: () => this.getSelectedElementWithLink(),
      forceSaveIfRequired: () => this.forceSaveIfRequired(),
    });
    this.excalidrawExtensionRenderer = new ViewExcalidrawExtensionRenderer(
      this,
      {
        CustomEmbeddable,
        REGEX_LINK,
        REG_LINKINDEX_HYPERLINK,
        diagramToHTML,
        errorHTML,
        extractCodeBlocks,
        generateAIText,
        getJsonErrorMessage,
        openExternalLink,
        renderWebView,
        useDefaultExcalidrawFrame,
        openUIModeSettings: () => {
          const uiModes = new UIModeSettings(this.plugin);
          uiModes.open();
        },
        openScriptInstallPrompt: () => this.actionOpenScriptInstallPrompt(),
        openExportImageDialog: () => this.actionOpenExportImageDialog(),
      },
    );
    this.markdownImageController = new MarkdownImageController(this, {
      isMarkdownImageElement,
      getMarkdownImageCustomData,
      getEmbeddableMarkdownImageSource,
      convertEmbeddableElementToMarkdownImage,
      getMarkdownImageSource,
      convertMarkdownImageElementToEmbeddable,
      getLevelOneMarkdownHeadings,
      openMarkdownImageEditorSidepanel,
      parseMarkdownImages,
      unwrapMarkdownImageBlock,
      MultiOptionConfirmationPrompt,
      GenericInputPrompt,
      insertBackOfTheNoteContent,
      errorlog,
    });
    this.sceneFileManager = new ViewSceneFileManager(this, {
      createEmbeddedFilesLoader: (isDark) =>
        new EmbeddedFilesLoader(this.plugin, isDark),
      addFiles,
    });
    this.setHookServer();
    this.dropManager = new DropManager(this);
  }

  get hookServer(): ExcalidrawAutomate | null {
    return this._hookServer;
  }
  get plugin(): ExcalidrawPlugin {
    return this._plugin;
  }
  /** Read externally by `EventManager.ts` to skip scheduling deferred
   * validation while a scene-file load is already in flight. */
  get activeLoader(): EmbeddedFilesLoader {
    return this.sceneFileManager.activeLoader;
  }
  get excalidrawContainer(): HTMLDivElement {
    return this.excalidrawWrapperRef?.current?.firstElementChild as
      | HTMLDivElement
      | undefined;
  }
  get ownerDocument(): Document {
    return DEVICE.isMobile
      ? mainDocument
      : this.containerEl?.ownerDocument || mainDocument;
  }
  get ownerWindow(): Window | null {
    return this.ownerDocument?.defaultView || window;
  }

  get isInMainObsidianWorkspace(): boolean {
    return mainDocument === this.ownerDocument;
  }

  setHookServer(ea?: ExcalidrawAutomate) {
    if (ea) {
      this._hookServer = ea;
    } else {
      this._hookServer = this._plugin.ea;
    }
  }

  public getHookServer() {
    return this.hookServer ?? this.plugin.ea;
  }

  preventAutozoom() {
    if (this.semaphores) {
      this.semaphores.preventAutozoom = true;
    }
    window.setTimeout(() => {
      if (!this.semaphores) {
        return;
      }
      this.semaphores.preventAutozoom = false;
    }, 1500);
  }

  private getOrCreateExportDialog(): ExportDialog | null {
    if (!this.file || !this.excalidrawAPI) {
      return null;
    }
    if (!this.exportDialog) {
      this.exportDialog = new ExportDialog(this.plugin, this, this.file);
    }
    return this.exportDialog;
  }

  /** Preserves the public view API while delegating raw scene persistence. */
  public saveExcalidraw(scene?: ExcalidrawViewScene) {
    return this.exportManager.saveExcalidraw(scene);
  }

  /** Preserves the public view API while delegating raw scene export. */
  public async exportExcalidraw(selectedOnly?: boolean) {
    return this.exportManager.exportExcalidraw(selectedOnly);
  }

  /** Resolves export theme through the view-scoped export manager. */
  public getViewExportTheme(theme?: string): string {
    return this.exportManager.getViewExportTheme(theme);
  }

  /** Resolves embedded-scene export behavior through the export manager. */
  public getViewExportEmbedScene(embedScene?: boolean): boolean {
    return this.exportManager.getViewExportEmbedScene(embedScene);
  }

  /** Resolves export padding through the view-scoped export manager. */
  public getViewExportPadding(padding?: number): number {
    return this.exportManager.getViewExportPadding(padding);
  }

  /** Resolves PNG export scale through the view-scoped export manager. */
  public getViewExportScale(scale?: number): number {
    return this.exportManager.getViewExportScale(scale);
  }

  /** Resolves export background behavior through the export manager. */
  public getViewExportWithBackground(withBackground?: boolean) {
    return this.exportManager.getViewExportWithBackground(withBackground);
  }

  /** Resolves internal-link export behavior through the export manager. */
  public getViewExportIncludeInternalLinks(includeInternalLinks?: boolean) {
    return this.exportManager.getViewExportIncludeInternalLinks(
      includeInternalLinks,
    );
  }

  /** Creates an SVG while retaining the established public view signature. */
  public async svg(
    scene: ExcalidrawViewScene,
    theme?: string,
    embedScene?: boolean,
    embedFont: boolean = false,
  ): Promise<SVGSVGElement> {
    return this.exportManager.svg(scene, theme, embedScene, embedFont);
  }

  /** Saves SVG autoexports through the view-scoped export manager. */
  public async saveSVG(data: {
    scene?: ExcalidrawViewScene;
    embedScene?: boolean;
    autoexportConfig?: AutoexportConfig;
  }) {
    return this.exportManager.saveSVG(data);
  }

  /** Downloads an SVG through the view-scoped export manager. */
  public async exportSVG(
    embedScene?: boolean,
    selectedOnly?: boolean,
  ): Promise<void> {
    return this.exportManager.exportSVG(embedScene, selectedOnly);
  }

  /** Returns an SVG through the view-scoped export manager. */
  public async getSVG(
    embedScene?: boolean,
    selectedOnly?: boolean,
  ): Promise<SVGSVGElement> {
    return this.exportManager.getSVG(embedScene, selectedOnly);
  }

  /** Downloads a PDF through the view-scoped export manager. */
  public async exportPDF(
    selectedOnly?: boolean,
    pageSize: PageSize = "A4",
    orientation: PageOrientation = "portrait",
  ): Promise<void> {
    return this.exportManager.exportPDF(selectedOnly, pageSize, orientation);
  }

  /** Creates a PNG blob while retaining the established view signature. */
  public async png(
    scene: ExcalidrawViewScene,
    theme?: string,
    embedScene?: boolean,
  ): Promise<Blob> {
    return this.exportManager.png(scene, theme, embedScene);
  }

  /** Saves PNG autoexports through the view-scoped export manager. */
  public async savePNG(data: {
    scene?: ExcalidrawViewScene;
    embedScene?: boolean;
    autoexportConfig?: AutoexportConfig;
  }) {
    return this.exportManager.savePNG(data);
  }

  /** Copies a PNG through the view-scoped export manager. */
  public async exportPNGToClipboard(
    embedScene?: boolean,
    selectedOnly?: boolean,
  ) {
    return this.exportManager.exportPNGToClipboard(embedScene, selectedOnly);
  }

  /** Downloads a PNG through the view-scoped export manager. */
  public async exportPNG(
    embedScene?: boolean,
    selectedOnly?: boolean,
  ): Promise<void> {
    return this.exportManager.exportPNG(embedScene, selectedOnly);
  }

  public setPreventReload() {
    this.semaphores.preventReload = true;
    this.preventReloadResetTimer = window.setTimeout(
      () => (this.semaphores.preventReload = false),
      PREVENT_RELOAD_TIMEOUT,
    );
  }

  public clearPreventReloadTimer() {
    if (this.preventReloadResetTimer) {
      window.clearTimeout(this.preventReloadResetTimer);
      this.preventReloadResetTimer = null;
    }
  }

  public async setEmbeddableNodeIsEditing() {
    this.clearEmbeddableNodeIsEditingTimer();
    this.semaphores.embeddableIsEditingSelf = true;
    // Wait for any in-flight save (e.g. a Markdown-image editor flush) rather than silently
    // aborting: a same-file back-of-the-note embeddable is about to open its own editor on this
    // same file, so the disk copy must be current or the embeddable's editor will load a stale
    // version and a later save from it can clobber pending Markdown-image edits.
    await this.forceSave(true, true);
  }

  /** Debounces self-edit reloads without forcing a disk save. */
  public setMarkdownImageEditorIsEditing(): void {
    this.clearEmbeddableNodeIsEditingTimer();
    this.semaphores.embeddableIsEditingSelf = true;
    this.clearEmbeddableNodeIsEditing();
  }

  public clearEmbeddableNodeIsEditingTimer() {
    if (this.editingSelfResetTimer) {
      window.clearTimeout(this.editingSelfResetTimer);
      this.editingSelfResetTimer = null;
    }
  }

  public clearEmbeddableNodeIsEditing() {
    this.clearEmbeddableNodeIsEditingTimer();
    this.editingSelfResetTimer = window.setTimeout(
      () => (this.semaphores.embeddableIsEditingSelf = false),
      EMBEDDABLE_SEMAPHORE_TIMEOUT,
    );
  }

  async save(
    preventReload: boolean = true,
    forcesave: boolean = false,
    overrideEmbeddableIsEditingSelfDebounce: boolean = false,
  ): Promise<void> {
    await this.saveCoordinator.save(
      preventReload,
      forcesave,
      overrideEmbeddableIsEditingSelfDebounce,
    );
  }

  private async performSaveWithSideEffectPolicy(
    preventReload: boolean,
    forcesave: boolean,
    overrideEmbeddableIsEditingSelfDebounce: boolean,
    sideEffectPolicy: Readonly<SaveSideEffectPolicy>,
  ): Promise<SaveExecutionResult> {
    /*if(this.semaphores.viewunload && (this.ownerWindow !== window)) {
      return;
    }*/

    if (!this.isLoaded) {
      return { status: "skipped" };
    }
    if (this.markdownImageController.markdownImageDeletionPrompt !== null) {
      await this.markdownImageController.markdownImageDeletionPrompt;
    }
    if (
      !overrideEmbeddableIsEditingSelfDebounce &&
      this.semaphores.embeddableIsEditingSelf
    ) {
      return { status: "skipped" };
    }
    if (this.semaphores.saving) {
      return { status: "skipped" };
    }
    this.semaphores.saving = true;

    //if there were no changes to the file super save will not save
    //and consequently main.ts modifyEventHandler will not fire
    //this.reload will not be called
    //triggerReload is used to flag if there were no changes but file should be reloaded anyway
    let triggerReload: boolean = false;

    const windowMigrationSaveSnapshot = this.windowMigrationSaveSnapshot;
    if (
      (!this.excalidrawAPI && !windowMigrationSaveSnapshot) ||
      !this.isLoaded ||
      !this.file ||
      !this.app.vault.getAbstractFileByPath(this.file.path) //file was recently deleted
    ) {
      this.semaphores.saving = false;
      return { status: "skipped" };
    }

    const allowSave = this.isDirty() || forcesave; //removed this.semaphores.autosaving
    let executionStatus: SaveExecutionResult["status"] = allowSave
      ? "persisted"
      : "unchanged";
    try {
      if (allowSave) {
        const appStateSnapshot = windowMigrationSaveSnapshot
          ? null
          : this.excalidrawAPI.getAppState();
        const scene = windowMigrationSaveSnapshot
          ? windowMigrationSaveSnapshot.scene
          : this.getSceneWithAppState(undefined, appStateSnapshot);
        const deletedElements = windowMigrationSaveSnapshot
          ? windowMigrationSaveSnapshot.deletedElements
          : this.excalidrawAPI
              .getSceneElementsIncludingDeleted()
              .filter((element: ExcalidrawElement) => element.isDeleted);

        let syncChanged = false;
        if (this.compatibilityMode) {
          syncChanged = await this.excalidrawData.syncElements(scene);
        } else {
          syncChanged = await this.excalidrawData.syncElements(
            scene,
            windowMigrationSaveSnapshot?.selectedElementIds ??
              appStateSnapshot.selectedElementIds,
          );
        }

        if (
          !this.compatibilityMode &&
          syncChanged &&
          !this.semaphores.popoutUnload && //Obsidian going black after REACT 18 migration when closing last leaf on popout
          !this.semaphores.windowMigrating
        ) {
          await this.loadDrawing(false, deletedElements);
        }

        //reload() is triggered indirectly when saving by the modifyEventHandler in main.ts
        //prevent reload is set here to override reload when not wanted: typically when the user is editing
        //and we do not want to interrupt the flow by reloading the drawing into the canvas.
        this.clearPreventReloadTimer();

        this.semaphores.preventReload = preventReload;
        await this.prepareGetViewDataFromSnapshot(scene, deletedElements);

        // Persist from the plugin's main-window realm before closing a runtime
        // whose container moved between windows. Calling TextFileView.save()
        // from a migrated popout can retain the destroyed Electron window in
        // the Node file operation.
        if (this.semaphores?.windowMigrating) {
          const d = this.getViewData();
          const plugin = this.plugin;
          const file = this.file;
          const sourceWindow = this.packageLease?.window;
          if (sourceWindow && sourceWindow !== window) {
            plugin.registerViewMigrationPersistenceHandoff({
              leafId: this.leaf.id,
              filePath: file.path,
              data: d,
            });
            this.data = d;
            this.semaphores.saving = false;
            return { status: "window-migration-handed-off" };
          }
          await new Promise<void>((resolve, reject) => {
            window.setTimeout(() => {
              if (!d) {
                resolve();
                return;
              }
              void plugin.app.vault.modify(file, d).then(resolve, reject);
              // This is a shady edge case: do not sacrifice the BAK file in
              // case the drawing is empty.
              // await getImageCache().addBAKToCache(file.path, d);
            }, 200);
          });
          this.data = d;
          this.lastSavedData = d;
          this.lastSaveTimestamp = file.stat.mtime;
          this.semaphores.saving = false;
          return { status: "window-migration-persisted" };
        }

        // Existing delayed view-unload workaround for ordinary close/plugin
        // teardown. Migration takes the awaited branch above instead.
        if (this.semaphores?.viewunload) {
          await this.prepareGetViewDataFromSnapshot(scene, deletedElements);
          const d = this.getViewData();
          const plugin = this.plugin;
          const file = this.file;
          window.setTimeout(() => {
            void (async () => {
              if (!d) {
                return;
              }
              await plugin.app.vault.modify(file, d);
              // This is a shady edge case: do not sacrifice the BAK file in
              // case the drawing is empty.
              // await getImageCache().addBAKToCache(file.path, d);
            })();
          }, 200);
          this.semaphores.saving = false;
          return { status: "view-unload-scheduled" };
        }

        await super.save();

        //saving to backup with a delay in case application closes in the meantime, I want to avoid both save and backup corrupted.
        const path = this.file.path;
        const data = this.lastSavedData;
        //if the scene is empty, do not save to BAK (this could be due to a crash when the BAK should not be updated)
        if (scene && scene.elements && scene.elements.length > 0) {
          getImageCache().scheduleBAKToCache(path, data, 50);
        }
        triggerReload =
          this.lastSaveTimestamp === this.file.stat.mtime &&
          !preventReload &&
          forcesave;
        this.lastSaveTimestamp = this.file.stat.mtime;
        //this.clearDirty(); //moved to right after allow save, to avoid autosave collision with load drawing

        //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/629
        //there were odd cases when preventReload semaphore did not get cleared and consequently a synchronized image
        //did not update the open drawing
        if (preventReload) {
          this.setPreventReload();
        }
      }

      // !triggerReload means file has not changed. No need to re-export
      //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1209 (added popout unload to the condition)
      if (
        !this.semaphores.windowMigrating &&
        this.excalidrawAPI &&
        sideEffectPolicy.triggerAutoexport &&
        !triggerReload &&
        !this.semaphores.autosaving &&
        (!this.semaphores.viewunload || this.semaphores.popoutUnload)
      ) {
        const autoexportPreference = this.excalidrawData.autoexportPreference;
        let autoexportConfig: AutoexportConfig = {
          svg:
            (autoexportPreference === AutoexportPreference.inherit &&
              this.plugin.settings.autoexportSVG) ||
            autoexportPreference === AutoexportPreference.both ||
            autoexportPreference === AutoexportPreference.svg,
          png:
            (autoexportPreference === AutoexportPreference.inherit &&
              this.plugin.settings.autoexportPNG) ||
            autoexportPreference === AutoexportPreference.both ||
            autoexportPreference === AutoexportPreference.png,
          excalidraw:
            !this.compatibilityMode &&
            this.plugin.settings.autoexportExcalidraw,
          theme: this.plugin.settings.autoExportLightAndDark
            ? "both"
            : (this.getViewExportTheme() as "dark" | "light"),
        };
        if (this.getHookServer().onTriggerAutoexportHook) {
          try {
            autoexportConfig =
              this.getHookServer().onTriggerAutoexportHook({
                excalidrawFile: this.file,
                autoexportConfig,
              }) ?? autoexportConfig;
          } catch (e) {
            errorlog({
              where: "ExcalidrawView.save",
              fn: "getHookServer().onTriggerAutoexportHook",
              error: e,
            });
          }
        }

        if (autoexportConfig.svg) {
          void this.saveSVG({ autoexportConfig });
        }
        if (autoexportConfig.png) {
          void this.savePNG({ autoexportConfig });
        }
        if (autoexportConfig.excalidraw) {
          this.saveExcalidraw();
        }
      }
    } catch (e) {
      executionStatus = "failed";
      errorlog({
        where: "ExcalidrawView.save",
        fn: "save",
        error: e,
      });
      warningUnknowSeriousError();
    }
    this.semaphores.saving = false;
    if (triggerReload) {
      await this.reload(true, this.file);
    }
    this.saveCoordinator.resetAutosaveTimer(); //next autosave period starts after save
    return { status: executionStatus };
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
    await this.prepareGetViewDataFromSnapshot();
  }

  /** Serializes one save-owned scene/deletion snapshot when supplied. */
  private async prepareGetViewDataFromSnapshot(
    sceneSnapshot?: ReturnType<ExcalidrawView["getScene"]>,
    deletedElementsSnapshot?: ExcalidrawElement[],
  ): Promise<void> {
    if (
      (!this.excalidrawAPI && typeof sceneSnapshot === "undefined") ||
      !this.excalidrawData.loaded
    ) {
      this.viewSaveData = this.data;
      return;
    }

    const captureScene = typeof sceneSnapshot === "undefined";
    const scene = captureScene ? this.getScene() : sceneSnapshot;
    if (!scene) {
      this.viewSaveData = this.data;
      return;
    }

    //include deleted elements in save in case saving in markdown mode
    //deleted elements are only used if sync modifies files while Excalidraw is open
    //otherwise deleted elements are discarded when loading the scene
    if (!this.compatibilityMode) {
      const keys: [string, string][] =
        this.exportDialog?.dirty && this.exportDialog?.saveSettings
          ? [
              [
                FRONTMATTER_KEYS["export-padding"].name,
                this.exportDialog.padding.toString(),
              ],
              [
                FRONTMATTER_KEYS["export-pngscale"].name,
                this.exportDialog.scale.toString(),
              ],
              [
                FRONTMATTER_KEYS["export-dark"].name,
                this.exportDialog.theme === "dark" ? "true" : "false",
              ],
              [
                FRONTMATTER_KEYS["export-transparent"].name,
                this.exportDialog.transparent ? "true" : "false",
              ],
              [
                FRONTMATTER_KEYS.plugin.name,
                this.textMode === TextMode.raw ? "raw" : "parsed",
              ],
              [
                FRONTMATTER_KEYS["export-embed-scene"].name,
                this.exportDialog.embedScene ? "true" : "false",
              ],
              [
                FRONTMATTER_KEYS["export-internal-links"].name,
                this.exportDialog.exportInternalLinks ? "true" : "false",
              ],
            ]
          : [
              [
                FRONTMATTER_KEYS.plugin.name,
                this.textMode === TextMode.raw ? "raw" : "parsed",
              ],
            ];

      if (this.exportDialog?.dirty) {
        this.exportDialog.dirty = false;
      }

      const header = syncMarkdownImagesInHeader(
        getExcalidrawMarkdownHeaderSection(this.data, keys),
        this.excalidrawData.markdownImages,
      );
      const tail = this.plugin.settings.zoteroCompatibility
        ? (RE_TAIL.exec(this.data)?.[1] ?? "")
        : "";

      if (!this.excalidrawData.disableCompression) {
        this.excalidrawData.disableCompression =
          this.plugin.settings.decompressForMDView &&
          this.isEditedAsMarkdownInOtherView();
      }

      const captureDeletedElements =
        typeof deletedElementsSnapshot === "undefined";
      const deletedElements = captureDeletedElements
        ? this.excalidrawAPI
            .getSceneElementsIncludingDeleted()
            .filter((element: ExcalidrawElement) => element.isDeleted)
        : deletedElementsSnapshot;
      const generated = IS_WORKER_SUPPORTED
        ? await this.excalidrawData.generateMDAsync(deletedElements)
        : this.excalidrawData.generateMDSync(deletedElements);
      const result = header + generated + tail;

      this.excalidrawData.disableCompression = false;
      this.viewSaveData = result;
      return;
    }
    if (this.compatibilityMode) {
      this.viewSaveData = JSON.stringify(scene, null, "\t");
      return;
    }

    this.viewSaveData = this.data;
  }

  getViewData() {
    return this.viewSaveData ?? this.data;
  }

  private hiddenMobileLeaves: [WorkspaceLeaf, string][] = [];

  restoreMobileLeaves() {
    if (this.hiddenMobileLeaves.length > 0) {
      this.hiddenMobileLeaves.forEach((x: [WorkspaceLeaf, string]) => {
        setStyle(x[0].containerEl, { display: x[1] });
      });
      this.hiddenMobileLeaves = [];
    }
  }

  async openLaTeXEditor(eqId: string) {
    if (await this.excalidrawData.syncElements(this.getScene())) {
      //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1994
      await this.forceSave(true, false);
    }
    const el = this.getViewElements().find(
      (el: ExcalidrawElement) => el.id === eqId && el.type === "image",
    ) as ExcalidrawImageElement;
    if (!el) {
      return;
    }

    const fileId = el.fileId;

    let equation = this.excalidrawData.getEquation(fileId)?.latex;
    if (!equation) {
      await this.save(false);
      equation = this.excalidrawData.getEquation(fileId)?.latex;
      if (!equation) {
        return;
      }
    }

    LaTexPrompt.Prompt(this.plugin, this.app, t("ENTER_LATEX"), equation).then(
      (formula: string) => {
        void (async () => {
          if (!formula || formula === equation) {
            return;
          }
          this.excalidrawData.setEquation(fileId, {
            latex: formula,
            isLoaded: false,
          });
          const ea = getEA(this);
          ea.copyViewElementsToEAforEditing([el]);
          ea.addAppendUpdateCustomData(el.id, { latex: formula });
          const dataurl = await ea.tex2dataURL(equation);
          if (dataurl && dataurl.size.height > 0 && dataurl.size.width > 0) {
            ea.addAppendUpdateCustomData(el.id, {
              latexscale: {
                scaleX: el.width / dataurl.size.width,
                scaleY: el.height / dataurl.size.height,
              },
            });
          }
          await ea.addElementsToView(false, false, false, false);
          await this.save(false);
          await updateEquation(formula, fileId, this, (files, view) => {
            void addFiles(files, view);
          });
          this.setDirty();
        })();
      },
      () => {},
    );
  }

  async openEmbeddedLinkEditor(imgId: string) {
    const el = this.getViewElements().find(
      (el: ExcalidrawElement) => el.id === imgId && el.type === "image",
    ) as ExcalidrawImageElement;
    if (!el) {
      return;
    }
    const fileId = el.fileId;
    const ef = this.excalidrawData.getFile(fileId);
    if (!ef) {
      return;
    }
    if (!ef.isHyperLink && !ef.isLocalLink && ef.file) {
      const handler = async (link: string) => {
        if (!link || ef.linkParts.original === link) {
          return;
        }
        const originalAnchor = Boolean(ef.linkParts.original.endsWith("|100%"));
        const nextAnchor = Boolean(link.endsWith("|100%"));
        ef.resetImage(this.file.path, link);
        this.excalidrawData.setFile(fileId, ef);
        this.setDirty();

        await new Promise<void>((resolve) => {
          void this.loadSceneFiles(
            false,
            new Set([fileId]),
            resolve,
            new Set([fileId]),
          );
        });

        if (originalAnchor !== nextAnchor) {
          await toggleImageAnchoring(el, this, nextAnchor, ef);
        }

        if (!this.plugin.isExcalidrawFile(ef.file) && !link.endsWith("|100%")) {
          const ea = getEA(this);
          const imgEl = this.getViewElements().find(
            (x: ExcalidrawElement) => x.id === el.id,
          ) as ExcalidrawImageElement;
          if (!imgEl) {
            ea.destroy();
            return;
          }
          if (imgEl && (await ea.resetImageAspectRatio(imgEl))) {
            await ea.addElementsToView(false, false);
          }
          ea.destroy();
        }

        await this.save(false);
      };
      GenericInputPrompt.Prompt(
        this,
        this.plugin,
        this.app,
        t("MARKDOWN_EMBED_CUSTOMIZE_LINK_PROMPT_TITLE"),
        undefined,
        ef.linkParts.original,
        [
          {
            iconId: "check",
            caption: "",
            action: (x: string) => {
              x.replaceAll("\n", "").trim();
            },
          },
        ],
        3,
        false,
        (container) =>
          container.createEl("p", {
            text: fragWithHTML(t("MARKDOWN_EMBED_CUSTOMIZE_LINK_PROMPT")),
          }),
        false,
      ).then(handler.bind(this), () => {});
    }
  }

  toggleDisableBinding() {
    const newState =
      this.excalidrawAPI.getAppState().bindingPreference === "enabled"
        ? "disabled"
        : "enabled";
    this.updateScene({
      appState: { bindingPreference: newState },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    new Notice(
      newState === "disabled"
        ? t("ARROW_BINDING_INVERSE_MODE")
        : t("ARROW_BINDING_NORMAL_MODE"),
    );
  }

  toggleFrameRendering() {
    const frameRenderingSt = this.excalidrawAPI.getAppState().frameRendering;
    this.updateScene({
      appState: {
        frameRendering: {
          ...frameRenderingSt,
          enabled: !frameRenderingSt.enabled,
        },
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    new Notice(
      frameRenderingSt.enabled
        ? t("FRAME_CLIPPING_ENABLED")
        : t("FRAME_CLIPPING_DISABLED"),
    );
  }

  toggleFrameClipping() {
    const frameRenderingSt = this.excalidrawAPI.getAppState().frameRendering;
    this.updateScene({
      appState: {
        frameRendering: { ...frameRenderingSt, clip: !frameRenderingSt.clip },
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    new Notice(
      frameRenderingSt.clip
        ? "Frame Clipping: Enabled"
        : "Frame Clipping: Disabled",
    );
  }

  /** Enters fullscreen through the view-scoped fullscreen manager. */
  gotoFullscreen(): void {
    this.fullscreenManager.gotoFullscreen();
  }

  /** Reports fullscreen state through the view-scoped fullscreen manager. */
  isFullscreen(): boolean {
    return this.fullscreenManager.isFullscreen();
  }

  /** Exits fullscreen through the view-scoped fullscreen manager. */
  exitFullscreen(): void {
    this.fullscreenManager.exitFullscreen();
  }

  /** Removes the active link tooltip through the navigation manager. */
  removeLinkTooltip(): void {
    this.linkNavigationManager.removeLinkTooltip();
  }

  /** Invokes the link-click hook through the navigation manager. */
  handleLinkHookCall(
    element: ExcalidrawElement,
    link: string,
    event: MouseEvent | null,
  ): boolean {
    return this.linkNavigationManager.handleLinkHookCall(element, link, event);
  }

  private getLinkTextForElement(
    selectedText: SelectedElementWithLink,
    selectedElementWithLink?: SelectedElementWithLink,
    allowLinearElementClick: boolean = false,
  ): {
    linkText: string;
    selectedElement: ExcalidrawElement;
    isLinearElement: boolean;
  } {
    return this.linkNavigationManager.getLinkTextForElement(
      selectedText,
      selectedElementWithLink,
      allowLinearElementClick,
    );
  }

  /** Resolves raw element text through the navigation manager. */
  processLinkText(
    linkText: string,
    selectedTextElement: ExcalidrawTextElement,
    selectedElement: ExcalidrawElement,
    shouldOpenLink: boolean = true,
  ) {
    return this.linkNavigationManager.processLinkText(
      linkText,
      selectedTextElement,
      selectedElement,
      shouldOpenLink,
    );
  }

  /** Performs the configured link action through the navigation manager. */
  async linkClick(
    ev: MouseEvent | null,
    selectedText: SelectedElementWithLink,
    selectedImage: SelectedImage,
    selectedElementWithLink: SelectedElementWithLink,
    keys?: ModifierKeys,
    allowLinearElementClick: boolean = false,
  ): Promise<void> {
    return this.linkNavigationManager.linkClick(
      ev,
      selectedText,
      selectedImage,
      selectedElementWithLink,
      keys,
      allowLinearElementClick,
    );
  }

  /** Resolves the current selection through the navigation manager. */
  async handleLinkClick(
    ev: MouseEvent | ModifierKeys,
    allowLinearElementClick: boolean = false,
  ): Promise<void> {
    return this.linkNavigationManager.handleLinkClick(
      ev,
      allowLinearElementClick,
    );
  }

  onResize() {
    super.onResize();
    if (this.plugin.leafChangeTimeout) {
      return;
    } //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/723
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

  excalidrawHashElementsVersion: (
    elements: readonly ExcalidrawElement[],
  ) => number;
  getSceneVersion(elements: readonly ExcalidrawElement[]): number {
    if (!this.excalidrawHashElementsVersion) {
      this.excalidrawHashElementsVersion =
        this.packages.excalidrawLib.hashElementsVersion;
    }
    return this.excalidrawHashElementsVersion(
      elements.filter((el) => !el.isDeleted),
    );
  }

  /**
   * @param waitIfBusy - When true, waits (up to ~5s) for an in-flight save/autosave to clear
   * instead of immediately aborting. Callers that need a guaranteed fresh disk write before
   * handing off to a different editor of the same file (e.g. setEmbeddableNodeIsEditing) should
   * pass true; the default preserves the existing "abort and notify" behavior for callers such as
   * the manual save button, where an immediate abort is the expected feedback.
   */
  public async forceSave(
    silent: boolean = false,
    waitIfBusy: boolean = false,
  ): Promise<void> {
    await this.saveCoordinator.forceSave(silent, waitIfBusy);
  }

  addTabTitlebarButtons() {
    this.actionButtons = this.plugin.settings.showTabTitlebarButtons
      ? {
          scriptInstall: this.addAction(
            SCRIPTENGINE_ICON_NAME,
            !DEVICE.isMobile ? t("INSTALL_SCRIPT_BUTTON") : "",
            () => {
              new ScriptInstallPrompt(this.plugin).open();
            },
          ),
          save: this.addAction(
            DISK_ICON_NAME,
            !DEVICE.isMobile ? t("FORCE_SAVE") : "",
            async () => this.forceSave(false, false),
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
      : ({} as Record<ActionButtons, HTMLElement>);
  }

  removeTabTitlebarButtons() {
    if (this.actionButtons) {
      Object.values(this.actionButtons).forEach((el) => el.remove());
    }
    this.actionButtons = {} as Record<ActionButtons, HTMLElement>;
  }

  private displayLoadingText() {
    // Create a div element for displaying the text
    const loadingTextEl = this.contentEl.createDiv({
      text: `${t("INITIALIZATION_MESSAGE")} ${this.file?.basename ?? ""}`,
    });

    // Apply styling to center the text
    setElementDisplay(loadingTextEl, "flex");
    loadingTextEl.classList.add("excalidraw-loading");
  }

  onload() {
    super.onload();
    this.displayLoadingText();
    if (this.plugin.settings.overrideObsidianFontSize) {
      setStyle(mainDocument.documentElement, {
        fontSize: "",
      });
    }

    const apiMissing = Boolean(
      typeof this.containerEl.onWindowMigrated === "undefined",
    );
    this.packageLease = this.plugin.acquirePackage(this.ownerWindow);
    this.packages = this.packageLease.packages;

    if (DEVICE.isDesktop && !apiMissing) {
      if (this.ownerWindow !== window) {
        void this.plugin.initializeFonts();
      }
      this.destroyers.push(
        //this.containerEl.onWindowMigrated(this.leaf.rebuildView.bind(this))
        this.containerEl.onWindowMigrated(async () => {
          const f = this.file;
          const l = this.leaf;
          const plugin = this.plugin;
          // Obsidian may destroy the source Electron window before the normal
          // unload callbacks select detached-view persistence. Capture every
          // API-owned value synchronously, then unmount before the first await.
          this.semaphores.windowMigrating = true;
          this.clearExcalidrawInitializeTimer();
          this.sceneFileManager.terminateActiveLoaders();
          this.windowMigrationSaveSnapshot = null;
          const migrationSnapshot = this.captureWindowMigrationSnapshot();
          const migrationSaveRequired =
            this.windowMigrationSaveSnapshot !== null;
          this.unmountExcalidrawRoot();
          if (migrationSaveRequired) {
            await this.saveCoordinator.flush();
          }
          if (this.isDirty()) {
            this.semaphores.windowMigrating = false;
            warningUnknowSeriousError();
            return;
          }
          const migrationDrawingState = migrationSnapshot
            ? this.createWindowMigrationDrawingState(migrationSnapshot)
            : null;
          this.windowMigrationSaveSnapshot = null;
          try {
            await closeLeafView(l);
          } catch (error: unknown) {
            plugin.discardViewMigrationPersistenceHandoff(l.id);
            this.setDirty();
            this.semaphores.windowMigrating = false;
            throw error;
          }
          const handoffToken = migrationDrawingState
            ? plugin.registerViewMigrationHandoff({
                leafId: l.id,
                filePath: f.path,
                fileMtime: f.stat.mtime,
                drawing: migrationDrawingState,
              })
            : null;
          windowMigratedDisableZoomOnce = true;
          void l.setViewState({
            type: VIEW_TYPE_EXCALIDRAW,
            state: {
              file: f.path,
              ...(handoffToken ? { migrationHandoffToken: handoffToken } : {}),
            },
          });
        }),
      );
    }

    this.semaphores.scriptsReady = true;

    const wheelEvent = () => {
      if (this.semaphores.wheelTimeout) {
        window.clearTimeout(this.semaphores.wheelTimeout);
      }
      if (this.semaphores.hoverSleep && this.excalidrawAPI) {
        this.clearHoverPreview();
      }
      this.semaphores.wheelTimeout = window.setTimeout(() => {
        window.clearTimeout(this.semaphores.wheelTimeout);
        this.semaphores.wheelTimeout = null;
      }, 1000);
    };

    this.registerDomEvent(this.containerEl, "wheel", wheelEvent, {
      passive: false,
    });

    this.addTabTitlebarButtons();

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

    //Guard against stale canvas offsets. Excalidraw caches offsetLeft/offsetTop in
    //appState and only recalculates when its container RESIZES (its internal
    //ResizeObserver) or scrolls. When another plugin injects UI above the canvas
    //after view init (e.g. obsidian-editing-toolbar) or the tab header wraps,
    //.excalidraw-wrapper (height:100%) is pushed down WITHOUT a size change, so
    //neither Excalidraw's ResizeObserver nor the parentMoveObserver fires, and
    //pointer/selection events land a few pixels off the cursor until the next
    //autosave tick refreshes the offsets (up to 60s later).
    //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1544
    const offsetDriftGuard = (e: PointerEvent) => {
      const now = Date.now();
      if (now - this.lastOffsetDriftCheck < 250) {
        return;
      }
      this.lastOffsetDriftCheck = now;
      const api = this.excalidrawAPI;
      const container = this.excalidrawContainer;
      if (!api || !container) {
        return;
      }
      const { left, top } = container.getBoundingClientRect();
      const { offsetLeft, offsetTop } = api.getAppState();
      if (Math.abs(left - offsetLeft) <= 1 && Math.abs(top - offsetTop) <= 1) {
        return;
      }
      //On the pointerdown path the refresh must land BEFORE React processes
      //this same event, or the first click/stroke still uses the stale
      //offsets. This capture listener on an ancestor runs ahead of React's
      //delegated handlers, so flushSync commits the corrected offsets in
      //time. Legal here: we are in a native event listener, not a lifecycle.
      if (e.type === "pointerdown") {
        const { flushSync } = this.packages.reactDOM as unknown as {
          flushSync?: (fn: () => void) => void;
        };
        if (flushSync) {
          try {
            flushSync(() => this.refreshCanvasOffset());
            return;
          } catch {
            //fall through to the async refresh below
          }
        }
      }
      this.refreshCanvasOffset();
    };
    //pointerenter catches drift before the click lands (mouse); the capture-phase
    //pointerdown covers touch/pen where enter and down coincide, and flushes
    //synchronously so even the first tap after a layout shift lands true
    this.registerDomEvent(this.containerEl, "pointerenter", offsetDriftGuard);
    this.registerDomEvent(this.containerEl, "pointerdown", offsetDriftGuard, {
      capture: true,
    });

    this.app.workspace.onLayoutReady(async () => {
      //Leaf was moved to new window and ExcalidrawView was destructed.
      //Happens during Obsidian startup if View opens in new window.
      if (!this.plugin) {
        return;
      }
      await this.plugin.awaitInit();
      //implemented to overcome issue that activeLeafChangeEventHandler is not called when view is initialized from a saved workspace, since Obsidian 1.6.0
      let counter = 0;
      while (
        counter++ < 50 &&
        (!this?.plugin?.activeLeafChangeEventHandler || !this.canvasNodeFactory)
      ) {
        await sleep(50);
        if (!this?.plugin) {
          return;
        }
      }
      setMobileNavbarPosition(true);
      if (!this?.plugin?.activeLeafChangeEventHandler) {
        return;
      }
      if (
        Boolean(this.plugin.activeLeafChangeEventHandler.bind(this)) &&
        this?.app?.workspace?.getMostRecentLeaf() === this.leaf
      ) {
        await this.plugin.activeLeafChangeEventHandler(this.leaf);
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
          metaKey: e.metaKey,
        };
      };

      const onKeyDown = (e: KeyboardEvent) => {
        this.modifierKeyDown = {
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey,
          altKey: e.altKey,
          metaKey: e.metaKey,
        };
      };

      const onBlurOrLeave = () => {
        if (
          this.semaphores.windowMigrating ||
          !this.excalidrawAPI ||
          !this.excalidrawData.loaded ||
          !this.isDirty()
        ) {
          return;
        }
        const api = this.excalidrawAPI;
        const st = api.getAppState();
        if (
          st.activeTool.type !== "image" &&
          st.activeEmbeddable?.state !== "active"
        ) {
          void this.saveCoordinator.forceSaveWithPolicy(
            true,
            false,
            WINDOW_BLUR_FORCE_SAVE_POLICY,
          );
        }
      };

      this.registerDomEvent(this.ownerWindow, "keydown", onKeyDown, false);
      this.registerDomEvent(this.ownerWindow, "keyup", onKeyUp, false);
      //this.registerDomEvent(this.contentEl, "mouseleave", onBlurOrLeave, false); //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2004
      this.registerDomEvent(this.ownerWindow, "blur", onBlurOrLeave, false);
      this.semaphores.viewloaded = true;
    });

    this.setupAutosaveTimer();
  }

  //this is to solve sliding panes bug
  //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/9
  private slidingPanesListner: () => void;
  private async addSlidingPanesListner() {
    if (!this.plugin.settings.slidingPanesSupport) {
      return;
    }

    this.slidingPanesListner = () => {
      if (this.excalidrawAPI) {
        this.refreshCanvasOffset();
      }
    };
    let rootSplit = this.app.workspace
      .rootSplit as WorkspaceItem as WorkspaceItemExt;
    while (!rootSplit) {
      await sleep(50);
      rootSplit = this.app.workspace
        .rootSplit as WorkspaceItem as WorkspaceItemExt;
    }
    this.registerDomEvent(
      rootSplit.containerEl,
      "scroll",
      this.slidingPanesListner,
    );
  }

  private removeSlidingPanesListner() {
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
    const observerFn = (m: MutationRecord[]) => {
      const target = m[0].target;
      if (!isInstanceOfHTMLElement(target)) {
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
      : new MutationObserver(observerFn);

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
      this.parentMoveObserver = null;
    }
  }

  public setTheme(theme: "dark" | "light") {
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
    if (this.compatibilityMode) {
      return;
    }
    if (this.blockTextModeChange) {
      return;
    }
    this.blockTextModeChange = true;
    this.textMode = textMode;
    if (textMode === TextMode.parsed) {
      this.actionButtons?.isRaw?.hide();
    } else {
      this.actionButtons?.isRaw?.show();
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

  public get autosaveTimer(): number | null {
    return this.saveCoordinator.autosaveTimer;
  }

  public set autosaveTimer(timer: number | null) {
    this.saveCoordinator.autosaveTimer = timer;
  }

  public get autosaveFunction(): (() => void) | null {
    return this.saveCoordinator.autosaveFunction;
  }

  public set autosaveFunction(timer: (() => void) | null) {
    this.saveCoordinator.autosaveFunction = timer;
  }

  get autosaveInterval() {
    return DEVICE.isMobile
      ? this.plugin.settings.autosaveIntervalMobile
      : this.plugin.settings.autosaveIntervalDesktop;
  }

  public setupAutosaveTimer(): void {
    this.saveCoordinator.setupAutosaveTimer();
  }

  unload(): void {
    super.unload();
  }

  async onUnloadFile(): Promise<void> {
    //deliberately not calling super.onUnloadFile() to avoid autosave (saved in unload)
    await handleMarkdownImageEditorViewUnload(this);
    let counter = 0;
    while (this.semaphores.saving && counter++ < 200) {
      await sleep(50); //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1988
      if (counter++ === 15) {
        new Notice(t("SAVE_IS_TAKING_LONG"));
      }
      if (counter === 80) {
        new Notice(t("SAVE_IS_TAKING_VERY_LONG"));
      }
    }
    if (counter >= 200) {
      new Notice("Unknown error, save is taking too long");
      return;
    }
    if (!this.semaphores.windowMigrating) {
      await this.forceSaveIfRequired();
    }
  }

  private async forceSaveIfRequired(): Promise<boolean> {
    return this.saveCoordinator.forceSaveIfRequired();
  }

  /**
   * Captures all API-owned drawing and save inputs before window teardown.
   *
   * @remarks
   * The caller must unmount the source React root immediately after this
   * synchronous method returns and before its first `await`. Delaying unmount
   * until after synchronization, compression, or native file access can let
   * Electron destroy the source popout window first and freeze Obsidian.
   */
  private captureWindowMigrationSnapshot(): {
    scene: NonNullable<ReturnType<ExcalidrawView["getScene"]>>;
    files: BinaryFiles;
  } | null {
    const api = this.excalidrawAPI;
    if (!api) {
      return null;
    }
    this.checkSceneVersion(api.getSceneElements());
    const appState = api.getAppState();
    const scene = this.getSceneWithAppState(undefined, appState);
    if (!scene) {
      return null;
    }
    const files = { ...(scene.files ?? {}) };
    if (this.isDirty()) {
      this.windowMigrationSaveSnapshot = {
        scene,
        deletedElements: api
          .getSceneElementsIncludingDeleted()
          .filter((element: ExcalidrawElement) => element.isDeleted),
        selectedElementIds: appState.selectedElementIds,
      };
    }
    return {
      scene,
      files,
    };
  }

  /** Creates a transferable drawing after any required save has settled. */
  private createWindowMigrationDrawingState(snapshot: {
    scene: NonNullable<ReturnType<ExcalidrawView["getScene"]>>;
    files: BinaryFiles;
  }): ViewMigrationDrawingState | null {
    const excalidrawData = this.excalidrawData.exportMigrationState();
    const save = this.saveCoordinator.exportMigrationState();
    if (!excalidrawData || !save) {
      return null;
    }
    const scene = this.windowMigrationSaveSnapshot?.scene ?? snapshot.scene;
    return {
      elements: [...scene.elements],
      appState: { ...scene.appState } as AppState,
      files: { ...snapshot.files },
      textMode: this.textMode,
      compatibilityMode: this.compatibilityMode,
      excalidrawData,
      save,
    };
  }

  private unmountExcalidrawRoot(): void {
    if (!this.excalidrawRoot) {
      return;
    }
    this.excalidrawRoot.unmount();
    this.excalidrawRoot = null;
  }

  //onClose happens after onunload
  protected async onClose(): Promise<void> {
    //I noticed Obsidian calls this function twice when disabling the plugin
    //once from "unregisterView"
    //the from "detachLeavesOfType"
    this.clearPreventReloadTimer();
    this.clearEmbeddableNodeIsEditingTimer();
    this.clearExcalidrawInitializeTimer();
    if (!this.dropManager && !this.excalidrawRoot) {
      return;
    } //the view is already closed

    // This happens when the user right clicks a tab and selects delete
    // in this case the onDelete event handler tirggers, but then Obsidian's delete event handler reaches onclose first, and
    // when the function is called a second time via on delete an error is thrown.)
    if (!this.file) {
      return;
    }

    this.exitFullscreen();

    if (!this.semaphores.windowMigrating) {
      await this.forceSaveIfRequired();
    }
    this.unmountExcalidrawRoot();

    this.sceneFileManager.terminateActiveLoaders();
    if (this.plugin) {
      this.plugin.scriptEngine?.removeViewEAs(this);
      const sidepanel =
        this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE_SIDEPANEL)[0]?.view;
      if (sidepanel && sidepanel instanceof ExcalidrawSidepanelView) {
        sidepanel.removeViewEAs(this);
      }

      if (this.plugin.ea?.targetView === this) {
        this.plugin.ea.targetView = null;
      }
    }

    this.excalidrawAPI = null;

    if (this.dropManager) {
      this.dropManager.destroy();
      this.dropManager = null;
    }

    if (this.canvasNodeFactory) {
      this.canvasNodeFactory.destroy();
      this.canvasNodeFactory = null;
    }

    if (this.embeddableLeafRefs) {
      this.embeddableLeafRefs.clear();
      this.embeddableLeafRefs = null;
    }

    if (this.embeddableRefs) {
      this.embeddableRefs.clear();
      this.embeddableRefs = null;
    }

    if (this.actionButtons) {
      Object.values(this.actionButtons).forEach((el) => el.remove());
      this.actionButtons = null; //{} as Record<ActionButtons, HTMLElement>;
    }

    if (this.excalidrawData) {
      this.excalidrawData.destroy();
      this.excalidrawData = null;
    }

    if (this.exportDialog) {
      this.exportDialog.destroy();
      this.exportDialog = null;
    }

    this.hoverPreviewTarget = null;

    if (this._hookServer?.targetView === this) {
      this._hookServer.targetView = null;
    }
    this._hookServer = null;
    if (this.containerEl) {
      this.containerEl.onWindowMigrated = null;
    }

    this.packages = null; //{react:null, reactDOM:null, excalidrawLib:null};
    this.packageLease?.release();
    this.packageLease = null;

    this.lastMouseEvent = null;
    this.requestSave = null;
    setStyle(this.leaf.tabHeaderInnerTitleEl, {
      color: "",
    });

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
    this.semaphores.popoutUnload =
      this.ownerDocument !== mainDocument &&
      this.ownerDocument.body.querySelectorAll(".workspace-tab-header")
        .length === 0;

    if (this.shouldSaveImportedImageTimer) {
      window.clearTimeout(this.shouldSaveImportedImageTimer);
    }

    if (this.getHookServer().onViewUnloadHook) {
      try {
        this.getHookServer().onViewUnloadHook(this);
      } catch (e) {
        errorlog({
          where: "ExcalidrawView.onunload",
          fn: "getHookServer().onViewUnloadHook",
          error: e,
        });
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
    this.saveCoordinator.destroy();

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
    this.clearExcalidrawInitializeTimer();
    if (this.semaphores?.wheelTimeout) {
      window.clearTimeout(this.semaphores.wheelTimeout);
      this.semaphores.wheelTimeout = null;
    }
    this.sceneFileManager.terminateActiveLoaders();
  }

  /**
   * Reloads scene content after a rendering-related plugin setting changes,
   * while retaining the live viewport that is intentionally not persisted as
   * an ordinary drawing edit.
   */
  public async reloadAfterSettingsChange(): Promise<void> {
    await this.reload(true, undefined, true);
  }

  /**
   * Reloads an open drawing after a local save or an external file change.
   *
   * @param fullreload - Whether to parse the complete drawing data again.
   * @param file - Modified file when the reload originated from a file event.
   * @param preserveViewport - Whether to retain live scroll and zoom values.
   */
  public async reload(
    fullreload: boolean = false,
    file?: TFile,
    preserveViewport: boolean = false,
  ) {
    const loadOnModifyTrigger = file && file === this.file;

    //once you've finished editing the embeddable, the first time the file
    //reloads will be because of the embeddable changed the file,
    //there is a 2000 ms time window allowed for this, but typically this will
    //happen within 100 ms. When this happens the timer is cleared and the
    //next time reload triggers the file will be reloaded as normal.
    if (this.semaphores.embeddableIsEditingSelf) {
      if (this.editingSelfResetTimer) {
        this.clearEmbeddableNodeIsEditingTimer();
        this.semaphores.embeddableIsEditingSelf = false;
      }
      if (loadOnModifyTrigger) {
        this.data = await this.app.vault.read(this.file);
      }
      return;
    }

    if (this.semaphores.preventReload) {
      this.semaphores.preventReload = false;
      return;
    }
    if (this.semaphores.saving) {
      return;
    }
    this.lastLoadedFile = null;
    this.actionButtons?.save
      ?.querySelector("svg")
      .removeClass("excalidraw-dirty");
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
    await this.loadDrawing(
      loadOnModifyTrigger,
      undefined,
      true,
      preserveViewport,
    );
    this.clearDirty();
  }

  async zoomToElementId(id: string, hasGroupref: boolean) {
    let counter = 0;
    while (!this.excalidrawAPI && counter++ < 100) {
      await sleep(50);
    } //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/734
    const api = this.excalidrawAPI;
    if (!api) {
      return;
    }
    const sceneElements = api.getSceneElements();

    let elements: ExcalidrawElement[] = sceneElements.filter(
      (el: ExcalidrawElement) => el.id === id,
    );
    if (elements.length === 0) {
      const frame = getFrameBasedOnFrameNameOrId(id, sceneElements);
      if (frame) {
        elements = [frame];
      } else {
        return;
      }
    }
    if (hasGroupref) {
      const groupElements = this.plugin.ea.getElementsInTheSameGroupWithElement(
        elements[0],
        sceneElements,
      );
      if (groupElements.length > 0) {
        elements = groupElements;
      }
    }

    this.preventAutozoom();
    this.zoomToElements(!api.getAppState().viewModeEnabled, elements);
  }

  setEphemeralState(state: ExcalidrawEphemeralState): void {
    if (!state) {
      return;
    }

    if (state.rename === "all") {
      void this.app.fileManager.promptForFileRename(this.file);
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
        counter++ < 100
      ) {
        await sleep(50);
      } //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/734
    };

    const filenameParts = getEmbeddedFilenameParts(
      state.subpath &&
        state.subpath.startsWith("#^group") &&
        !state.subpath.startsWith("#^group=")
        ? `#^group=${state.subpath.substring(7)}`
        : state.subpath &&
            state.subpath.startsWith("#^area") &&
            !state.subpath.startsWith("#^area=")
          ? `#^area=${state.subpath.substring(6)}`
          : state.subpath,
    );
    if (filenameParts.hasBlockref) {
      window.setTimeout(() => {
        void (async () => {
          await waitForExcalidraw();
          if (filenameParts.blockref && !filenameParts.hasGroupref) {
            if (
              !this.getScene()?.elements.find(
                (el: ExcalidrawElement) => el.id === filenameParts.blockref,
              )
            ) {
              const cleanQuery = cleanSectionHeading(
                filenameParts.blockref,
              ).replaceAll(" ", "");
              const blocks = await this.getBackOfTheNoteBlocks();
              if (blocks.includes(cleanQuery)) {
                void this.setMarkdownView(state);
                return;
              }
            }
          }
          window.setTimeout(() => {
            void this.zoomToElementId(
              filenameParts.blockref,
              filenameParts.hasGroupref,
            );
          });
        })();
      });
    }

    if (filenameParts.hasSectionref) {
      query = [`# ${filenameParts.sectionref}`];
    } else if (state.line && state.line > 0) {
      query = [this.data.split("\n")[state.line]]; //was -1 https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2503
    }

    if (
      query &&
      query.length > 0 &&
      !(query.length === 1 && query[0].length === 0)
    ) {
      window.setTimeout(() => {
        void (async () => {
          await waitForExcalidraw();

          const api = this.excalidrawAPI;
          if (!api) {
            return;
          }
          if (api.getAppState().isLoading) {
            return;
          }

          const elements = api.getSceneElements() as ExcalidrawElement[];
          if (query.length === 1) {
            const elementId =
              query[0].match(/ \^([^ ]+)$/)?.[1] ??
              query[0].match(/^([^ :]+): \[\[[^\]]+]]$/)?.[1];
            if (elementId && elements.find((el) => el.id === elementId)) {
              this.preventAutozoom();
              window.setTimeout(() =>
                this.zoomToElements(!api.getAppState().viewModeEnabled, [
                  elements.find((el) => el.id === elementId),
                ]),
              );
              return;
            }
          }

          if (query.length === 1 && query[0].startsWith("[")) {
            const partsArray = REGEX_LINK.getResList(query[0]);
            const parts = partsArray[0];
            if (parts) {
              const linkText = REGEX_LINK.getLink(parts);
              if (linkText) {
                const file = this.plugin.app.metadataCache.getFirstLinkpathDest(
                  linkText,
                  this.file.path,
                );
                if (file) {
                  const fileId: FileId[] = [];
                  this.excalidrawData.files.forEach((ef, fileID) => {
                    if (ef.file?.path === file.path) {
                      fileId.push(fileID);
                    }
                  });
                  if (fileId.length > 0) {
                    const images = elements.filter(
                      (el) => el.type === "image" && fileId.includes(el.fileId),
                    );
                    if (images.length > 0) {
                      this.preventAutozoom();
                      window.setTimeout(() =>
                        this.zoomToElements(
                          !api.getAppState().viewModeEnabled,
                          images,
                        ),
                      );
                      return;
                    }
                  }
                }
              }
            }
          }

          if (
            !this.selectElementsMatchingQuery(
              elements,
              query,
              !api.getAppState().viewModeEnabled,
              filenameParts.hasSectionref,
              filenameParts.hasGroupref,
            )
          ) {
            const cleanQuery = cleanSectionHeading(query[0]);
            const sections = await this.getBackOfTheNoteSections();
            if (sections.includes(cleanQuery) || this.data.includes(query[0])) {
              void this.setMarkdownView(state);
            }
          }
        })();
      });
    }

    //super.setEphemeralState(state);
  }

  // clear the view content
  clear() {
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
    this.sceneFileManager.terminateActiveLoaders();
    this.lastSceneLoadTime = 0;
    (api.resetScene as () => void)();
    this.previousSceneVersion = 0;
  }

  public isLoaded: boolean = false;

  /** Captures the one-shot handoff token before the base view loads data. */
  public async setState(
    state: Record<string, unknown>,
    result: ViewStateResult,
  ): Promise<void> {
    this.pendingMigrationHandoffToken =
      typeof state?.migrationHandoffToken === "string"
        ? state.migrationHandoffToken
        : null;
    await super.setState(state, result);
  }

  setViewData(data: string, clear: boolean = false) {
    const migrationHandoffToken = this.pendingMigrationHandoffToken;
    this.pendingMigrationHandoffToken = null;
    //I am using last loaded file to control when the view reloads.
    //It seems text file view gets the modified file event after sync before the modifyEventHandler in main.ts
    //reload can only be triggered via reload()
    void (async () => {
      await this.plugin.awaitInit();
      if (this.lastLoadedFile === this.file) {
        return;
      }
      this.isLoaded = false;
      if (!this.file) {
        return;
      }
      const migrationDrawingHandoff = migrationHandoffToken
        ? this.plugin.consumeViewMigrationHandoff({
            token: migrationHandoffToken,
            leafId: this.leaf.id,
            filePath: this.file.path,
            fileMtime: this.file.stat.mtime,
          })
        : null;
      const migrationHandoffData = this.isInMainObsidianWorkspace
        ? this.plugin.consumeViewMigrationPersistenceHandoff(
            this.leaf.id,
            this.file.path,
          )
        : null;
      let migrationHandoffPersistenceFailed = false;
      if (migrationHandoffData !== null) {
        data = migrationHandoffData;
      }
      if (this.plugin.settings.compareManifestToPluginVersion) {
        void checkVersionMismatch(this.plugin);
      }
      if (this.plugin.settings.showNewVersionNotification) {
        void checkExcalidrawVersion();
      }
      if (isMaskFile(this.plugin, this.file)) {
        const notice = new Notice(t("MASK_FILE_NOTICE"), 5000);
        //add click and hold event listner to the notice
        let noticeTimeout: number;
        this.registerDomEvent(notice.messageEl, "pointerdown", () => {
          noticeTimeout = window.setTimeout(() => {
            window.open(getYouTubeUrl("uHFd0XoHRxE"));
          }, 1000);
        });
        this.registerDomEvent(notice.messageEl, "pointerup", () => {
          window.clearTimeout(noticeTimeout);
        });
      }
      if (clear) {
        this.clear();
      }
      this.lastSaveTimestamp = this.file.stat.mtime;
      this.lastLoadedFile = this.file;
      data = this.data = data.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
      if (migrationHandoffData !== null) {
        try {
          await this.app.vault.modify(this.file, data);
          this.viewSaveData = data;
          this.lastSavedData = data;
          this.lastSaveTimestamp = this.file.stat.mtime;
        } catch (error: unknown) {
          migrationHandoffPersistenceFailed = true;
          errorlog({
            where: "ExcalidrawView.setViewData",
            fn: "persistViewMigrationHandoff",
            error,
          });
          warningUnknowSeriousError();
        }
      }
      this.app.workspace.onLayoutReady(async () => {
        //the leaf moved to a window and ExcalidrawView was destructed
        //Happens during Obsidian startup if View opens in new window.
        if (!this?.app) {
          return;
        }
        await this.plugin.awaitInit();
        let counter = 0;
        while (
          (!this.semaphores.viewloaded ||
            !this.file ||
            !this.plugin.fourthFontLoaded) &&
          counter++ < 50
        ) {
          await sleep(50);
        }
        if (!this.file) {
          return;
        }
        this.compatibilityMode = this.file.extension === "excalidraw";
        let migrationDrawingAdopted = false;
        if (
          migrationDrawingHandoff &&
          migrationDrawingHandoff.compatibilityMode ===
            this.compatibilityMode &&
          this.excalidrawData.adoptMigrationState(
            migrationDrawingHandoff.excalidrawData,
            this.file,
          ) &&
          this.saveCoordinator.adoptMigrationState(
            migrationDrawingHandoff.save,
          )
        ) {
          this.excalidrawData.scene = {
            ...this.excalidrawData.scene,
            elements: [...migrationDrawingHandoff.elements],
            appState: {
              ...this.excalidrawData.scene.appState,
              ...migrationDrawingHandoff.appState,
            },
            files: { ...migrationDrawingHandoff.files },
          };
          this.textMode = migrationDrawingHandoff.textMode;
          this.prevTextMode =
            migrationDrawingHandoff.excalidrawData.scene.prevTextMode ??
            migrationDrawingHandoff.textMode;
          migrationDrawingAdopted = true;
        }
        //await this.plugin.loadSettings();
        if (migrationDrawingAdopted) {
          if (this.compatibilityMode) {
            this.plugin.enableLegacyFilePopoverObserver();
            this.actionButtons?.isRaw?.hide();
            this.actionButtons?.link?.hide();
            this.excalidrawData.disableCompression = true;
          } else {
            this.actionButtons?.link?.show();
            this.excalidrawData.disableCompression = false;
            if (this.textMode === TextMode.parsed) {
              this.actionButtons?.isRaw?.hide();
            } else {
              this.actionButtons?.isRaw?.show();
            }
          }
        } else if (this.compatibilityMode) {
          this.plugin.enableLegacyFilePopoverObserver();
          this.actionButtons?.isRaw?.hide();
          // this.actionButtons.isParsed.hide();
          this.actionButtons?.link?.hide();
          this.textMode = TextMode.raw;
          await this.excalidrawData.loadLegacyData(data, this.file);
          if (!this.plugin.settings.compatibilityMode) {
            new Notice(t("COMPATIBILITY_MODE"), 4000);
          }
          this.excalidrawData.disableCompression = true;
        } else {
          this.actionButtons?.link?.show();
          this.excalidrawData.disableCompression = false;
          const textMode = getTextMode(data);
          await this.changeTextMode(textMode, false);
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
          } catch (e: unknown) {
            errorlog({
              where: "ExcalidrawView.setViewData",
              error: e,
            });
            if (
              e instanceof Error &&
              e.message === ERROR_IFRAME_CONVERSION_CANCELED
            ) {
              await this.setMarkdownView();
              return;
            }
            const file = this.file;
            const plugin = this.plugin;
            const leaf = this.leaf;
            void (async () => {
              let confirmation: boolean | null = true;
              let counter = 0;
              const timestamp = Date.now();
              while (!getImageCache().isReady() && confirmation) {
                const message = `You've been now waiting for <b>${Math.round((Date.now() - timestamp) / 1000)}</b> seconds. `;
                getImageCache().initializationNotice = true;
                const confirmationPrompt = new MultiOptionConfirmationPrompt(
                  plugin,
                  `${
                    counter > 0
                      ? counter % 4 === 0
                        ? `${message}The CACHE is still loading.<br><br>`
                        : counter % 4 === 1
                          ? `${
                              message
                            }Watch the top right corner for the notification.<br><br>`
                          : counter % 4 === 2
                            ? `${
                                message
                              }I really, really hope the backup will work for you! <br><br>`
                            : `${
                                message
                              }I am sorry, it is taking a while, there is not much I can do... <br><br>`
                      : ""
                  }${t("CACHE_NOT_READY")}`,
                );
                confirmation = await confirmationPrompt.waitForClose;
                counter++;
              }

              const drawingBAK = await getImageCache().getBAKFromCache(
                file.path,
              );
              if (!drawingBAK) {
                new Notice(
                  `Error loading drawing:\n${(e as Error).message}${
                    (e as Error).message ===
                    "Cannot read property 'index' of undefined"
                      ? "\n'# Drawing' section is likely missing"
                      : ""
                  }\n\nTry manually fixing the file or restoring an earlier version from sync history.`,
                  10000,
                );
                return;
              }
              const confirmationPrompt = new MultiOptionConfirmationPrompt(
                plugin,
                t("BACKUP_AVAILABLE"),
              );
              void confirmationPrompt.waitForClose.then((confirmed) => {
                void (async () => {
                  if (confirmed) {
                    await this.app.vault.modify(file, drawingBAK);
                    plugin.excalidrawFileModes[leaf.id || file.path] =
                      VIEW_TYPE_EXCALIDRAW;
                    void setExcalidrawView(leaf);
                  }
                })();
              });
            })();
            void this.setMarkdownView();
            return;
          }
        }

        if (
          getImageCache().isReady() &&
          this.excalidrawData.scene &&
          this.excalidrawData.scene.elements &&
          this.excalidrawData.scene.elements.length === 0
        ) {
          const backup = await getImageCache().getBAKFromCache(this.file.path);
          if (backup && backup.length > data.length) {
            window.setTimeout(() => {
              void (async () => {
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
                if (result === 1) {
                  const path = getNewUniqueFilepath(
                    this.app.vault,
                    `${this.file.basename}.restored.${this.file.extension}`,
                    this.file.parent.path,
                  );
                  const backupFile = await createFileAndAwaitMetacacheUpdate(
                    this.app,
                    path,
                    backup,
                  );
                  await getImageCache().removeBAKFromCache(this.file.path);
                  this.plugin.openDrawing(backupFile, "new-tab");
                } else if (result === 2) {
                  await getImageCache().removeBAKFromCache(this.file.path);
                }
              })();
            });
          }
        }
        await this.loadDrawing(true);

        onLoadMessages(
          this.excalidrawData.scene as {
            elements: ExcalidrawElement[];
            appState: AppState;
          },
        );

        if (this.plugin.ea.onFileOpenHook) {
          const tempEA = getEA(this);
          try {
            await this.plugin.ea.onFileOpenHook({
              ea: tempEA,
              excalidrawFile: this.file,
              view: this,
            });
          } catch (e: unknown) {
            errorlog({
              where: "ExcalidrawView.setViewData.onFileOpenHook",
              error: e,
            });
          } finally {
            tempEA.destroy();
          }
        }

        const script = this.excalidrawData.getOnLoadScript();
        if (script) {
          const scriptname = `${this.file.basename}-onlaod-script`;
          const runScript = async () => {
            if (!this.excalidrawAPI) {
              //need to wait for Excalidraw to initialize
              window.setTimeout((): void => {
                void runScript();
              }, 200);
              return;
            }
            void this.plugin.scriptEngine.executeScript(
              this,
              script,
              scriptname,
              this.file,
            );
          };
          let allowOnloadScript: boolean | null =
            this.plugin.settings.enableOnloadScripts;
          if (!allowOnloadScript) {
            const onloadScriptPromptButtons = new Map<string, boolean | null>([
              [t("ENABLE_ONLOAD_SCRIPTS_CONFIRM_DENY"), null],
              [t("ENABLE_ONLOAD_SCRIPTS_CONFIRM_ENABLE"), true],
            ]);
            const confirmationPrompt = new MultiOptionConfirmationPrompt(
              this.plugin,
              `<strong>${t("ENABLE_ONLOAD_SCRIPTS_NAME")}</strong><br>${t("ENABLE_ONLOAD_SCRIPTS_CONFIRMATION")}` +
                `<br><br>${t("ENABLE_ONLOAD_SCRIPTS_DESC")}`,
              onloadScriptPromptButtons,
              t("ENABLE_ONLOAD_SCRIPTS_CONFIRM_DENY"),
            );
            allowOnloadScript = await confirmationPrompt.waitForClose;
            if (allowOnloadScript) {
              this.plugin.settings.enableOnloadScripts = true;
              await this.plugin.saveSettings();
            }
          }
          if (allowOnloadScript) {
            await runScript();
          }
        }
        this.isLoaded = true;
        if (migrationHandoffPersistenceFailed) {
          this.setDirty();
        }
      });
    })();
  }

  private getGridColor(bgColor: string): { Bold: string; Regular: string } {
    const cm = this.plugin.ea.getCM(bgColor);
    const isDark = cm.isDark();

    let Regular: string;
    let Bold: string;
    const opacity = this.plugin.settings.gridSettings.OPACITY / 100;

    if (this.plugin.settings.gridSettings.DYNAMIC_COLOR) {
      // Dynamic color: concatenate opacity to the RGB string  !!! Excalidraw expects an RGBA string !!!
      Regular = (isDark ? cm.lighterBy(10) : cm.darkerBy(10))
        .alphaTo(opacity)
        .stringRGB({ alpha: true });
      Bold = (isDark ? cm.lighterBy(5) : cm.darkerBy(5))
        .alphaTo(opacity)
        .stringRGB({ alpha: true });
    } else {
      // Custom color handling
      const customCM = this.plugin.ea.getCM(
        this.plugin.settings.gridSettings.COLOR,
      );
      const customIsDark = customCM.isDark();

      // Regular uses the custom color directly
      Regular = customCM.alphaTo(opacity).stringRGB({ alpha: true });

      // Bold is 10 shades lighter or darker based on the custom color's darkness
      Bold = (customIsDark ? customCM.lighterBy(10) : customCM.darkerBy(10))
        .alphaTo(opacity)
        .stringRGB({ alpha: true });
    }

    return { Bold, Regular };
  }

  /** Delegates to `ViewSceneFileManager`; called from `EventManager.ts` on leaf switch. */
  public scheduleSceneFileDeferredValidation(
    fileIDs: Set<FileId>,
    isThemeChange: boolean = false,
    forceEmitFromCache: boolean = false,
  ) {
    this.sceneFileManager.scheduleSceneFileDeferredValidation(
      fileIDs,
      isThemeChange,
      forceEmitFromCache,
    );
  }

  /** Delegates to `ViewSceneFileManager`; part of the ExcalidrawAutomate public
   * surface (`ExcalidrawAutomate.ts`'s `targetView.loadSceneFiles(...)`). */
  public async loadSceneFiles(
    isThemeChange: boolean = false,
    fileIDWhiteList?: Set<FileId>,
    callback?: () => void,
    forceReloadFileIDs?: Set<FileId>,
  ) {
    await this.sceneFileManager.loadSceneFiles(
      isThemeChange,
      fileIDWhiteList,
      callback,
      forceReloadFileIDs,
    );
  }

  public async synchronizeWithData(inData: ExcalidrawData) {
    if (
      this.semaphores.windowMigrating ||
      !this.excalidrawAPI ||
      this.semaphores.embeddableIsEditingSelf
    ) {
      return;
    }
    //check if saving, wait until not
    let counter = 0;
    while (this.semaphores.saving && counter++ < 30) {
      await sleep(100);
    }
    if (counter >= 30) {
      errorlog({
        where: "ExcalidrawView.synchronizeWithData",
        message: `Aborting sync with received file (${this.file.path}) because semaphores.saving remained true for ower 3 seconds`,
        fn: "synchronizeWithData",
      });
      return;
    }
    if (this.semaphores.windowMigrating || !this.excalidrawAPI) {
      return;
    }
    if (!inData.scene) {
      return;
    }
    this.semaphores.saving = true;
    const reloadFiles = new Set<FileId>();

    try {
      const syncMarkdownImageSource = (
        incomingElement: ExcalidrawImageElement,
      ): boolean => {
        const customData = getMarkdownImageCustomData(incomingElement);
        if (!customData) {
          return false;
        }
        if (customData.source === "local") {
          const incomingSource = inData.getMarkdownImage(
            incomingElement.fileId,
          );
          if (!incomingSource) {
            return false;
          }
          const currentSource = this.excalidrawData.getMarkdownImage(
            incomingElement.fileId,
          );
          if (currentSource?.markdown === incomingSource.markdown) {
            return false;
          }
          this.excalidrawData.setMarkdownImage(
            incomingElement.fileId,
            incomingSource,
          );
          return true;
        }

        const incomingFile = inData.getFile(incomingElement.fileId);
        if (!incomingFile) {
          return false;
        }
        const currentFile = this.excalidrawData.getFile(incomingElement.fileId);
        if (
          currentFile?.file === incomingFile.file &&
          currentFile?.hyperlink === incomingFile.hyperlink &&
          currentFile?.linkParts?.original === incomingFile.linkParts?.original
        ) {
          return false;
        }
        this.excalidrawData.setFile(incomingElement.fileId, incomingFile);
        return true;
      };

      const deletedIds = inData.deletedElements.map((el) => el.id);
      const sceneElements = this.excalidrawAPI
        .getSceneElementsIncludingDeleted()
        //remove deleted elements
        .filter((el: ExcalidrawElement) => !deletedIds.contains(el.id));
      const sceneElementIds = sceneElements.map(
        (el: ExcalidrawElement) => el.id,
      );

      const manageMapChanges = (incomingElement: ExcalidrawElement) => {
        switch (incomingElement.type) {
          case "text":
            this.excalidrawData.textElements.set(
              incomingElement.id,
              inData.textElements.get(incomingElement.id),
            );
            break;
          case "image":
            if (getMarkdownImageCustomData(incomingElement)) {
              syncMarkdownImageSource(incomingElement);
              reloadFiles.add(incomingElement.fileId);
            } else if (inData.getFile(incomingElement.fileId)) {
              this.excalidrawData.setFile(
                incomingElement.fileId,
                inData.getFile(incomingElement.fileId),
              );
              reloadFiles.add(incomingElement.fileId);
            } else if (inData.getEquation(incomingElement.fileId)) {
              this.excalidrawData.setEquation(
                incomingElement.fileId,
                inData.getEquation(incomingElement.fileId),
              );
              reloadFiles.add(incomingElement.fileId);
            }
            break;
        }

        if (inData.elementLinks.has(incomingElement.id)) {
          this.excalidrawData.elementLinks.set(
            incomingElement.id,
            inData.elementLinks.get(incomingElement.id),
          );
        }
      };

      //update items with higher version number then in scene
      inData.scene.elements.forEach(
        (
          incomingElement: ExcalidrawElement,
          idx: number,
          inElements: ExcalidrawElement[],
        ) => {
          const sceneElement: ExcalidrawElement = sceneElements.filter(
            (element: ExcalidrawElement) => element.id === incomingElement.id,
          )[0];
          if (
            sceneElement &&
            (sceneElement.version < incomingElement.version ||
              //in case of competing versions of the truth, the incoming version will be honored
              (sceneElement.version === incomingElement.version &&
                JSON.stringify(sceneElement) !==
                  JSON.stringify(incomingElement)))
          ) {
            manageMapChanges(incomingElement);
            //place into correct element layer sequence
            const currentLayer = sceneElementIds.indexOf(incomingElement.id);
            //remove current element from scene
            sceneElements.splice(currentLayer, 1);
            if (idx === 0) {
              sceneElements.splice(0, 0, incomingElement);
              if (currentLayer !== 0) {
                sceneElementIds.splice(currentLayer, 1);
                sceneElementIds.splice(0, 0, incomingElement.id);
              }
            } else {
              const prevId = inElements[idx - 1].id;
              const parentLayer = sceneElementIds.indexOf(prevId);
              sceneElements.splice(parentLayer + 1, 0, incomingElement);
              if (parentLayer !== currentLayer - 1) {
                sceneElementIds.splice(currentLayer, 1);
                sceneElementIds.splice(parentLayer + 1, 0, incomingElement.id);
              }
            }
          } else if (!sceneElement) {
            manageMapChanges(incomingElement);

            if (idx === 0) {
              sceneElements.splice(0, 0, incomingElement);
              sceneElementIds.splice(0, 0, incomingElement.id);
            } else {
              const prevId = inElements[idx - 1].id;
              const parentLayer = sceneElementIds.indexOf(prevId);
              sceneElements.splice(parentLayer + 1, 0, incomingElement);
              sceneElementIds.splice(parentLayer + 1, 0, incomingElement.id);
            }
          } else if (sceneElement && incomingElement.type === "image") {
            if (getMarkdownImageCustomData(incomingElement)) {
              if (
                syncMarkdownImageSource(incomingElement) ||
                !this.excalidrawAPI.getFiles()[incomingElement.fileId]
              ) {
                reloadFiles.add(incomingElement.fileId);
              }
              return;
            }
            //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/632
            const incomingFile = inData.getFile(incomingElement.fileId);
            const sceneFile = this.excalidrawData.getFile(
              incomingElement.fileId,
            );

            const shouldUpdate =
              Boolean(incomingFile) &&
              ((sceneElement as ExcalidrawImageElement).fileId !==
                incomingElement.fileId ||
                (incomingFile.file && sceneFile.file !== incomingFile.file) ||
                (incomingFile.hyperlink &&
                  sceneFile.hyperlink !== incomingFile.hyperlink) ||
                (incomingFile.linkParts?.original &&
                  sceneFile.linkParts?.original !==
                    incomingFile.linkParts?.original));
            if (shouldUpdate) {
              this.excalidrawData.setFile(
                incomingElement.fileId,
                inData.getFile(incomingElement.fileId),
              );
              reloadFiles.add(incomingElement.fileId);
            }
          }
        },
      );
      const loadedFiles = this.excalidrawAPI.getFiles();
      sceneElements.forEach((element) => {
        if (
          element.type === "image" &&
          getMarkdownImageCustomData(element) &&
          !loadedFiles[element.fileId]
        ) {
          syncMarkdownImageSource(element);
          reloadFiles.add(element.fileId);
        }
      });
      this.previousSceneVersion = this.getSceneVersion(sceneElements);
      //changing files could result in a race condition for sync. If at the end of sync there are differences
      //set dirty will trigger an autosave
      if (
        this.getSceneVersion(inData.scene.elements) !==
        this.previousSceneVersion
      ) {
        this.setDirty();
      }
      this.updateScene({
        elements: sceneElements,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      if (reloadFiles.size > 0) {
        await this.loadSceneFiles(false, reloadFiles, undefined, undefined);
      }
    } catch (e) {
      errorlog({
        where: "ExcalidrawView.synchronizeWithData",
        message: `Error during sync with received file (${this.file.path})`,
        fn: "synchronizeWithData",
        error: e,
      });
    }
    this.semaphores.saving = false;
  }

  /**
   * Loads the parsed scene into the Excalidraw runtime.
   *
   * @param justloaded - Whether to trigger initial-load behavior such as zoom to fit.
   * @param deletedElements - Deleted elements retained during save-related reloads.
   * @param isReloading - Whether this replaces an already loaded scene.
   * @param preserveViewport - Whether to omit persisted scroll and zoom state.
   */
  public async loadDrawing(
    justloaded: boolean,
    deletedElements?: ExcalidrawElement[],
    isReloading: boolean = false,
    preserveViewport: boolean = false,
  ) {
    const excalidrawData = this.excalidrawData.scene;
    const isOpenInMultipleLeaves =
      getExcalidraAndMarkdowViewsForFile(this.app, this.file).length > 1;
    const appState =
      isReloading && (isOpenInMultipleLeaves || preserveViewport)
        ? deleteAppStateKeys(excalidrawData.appState as AppState, [
            "scrollX",
            "scrollY",
            "zoom",
          ])
        : excalidrawData.appState;
    this.semaphores.justLoaded = justloaded;
    this.clearDirty();
    const om = this.excalidrawData.getOpenMode();
    this.semaphores.preventReload = false;
    const penEnabled = this.plugin.isPenMode();
    const api = this.excalidrawAPI;
    if (api) {
      //isLoaded flags that a new file is being loaded, isLoaded will be true after loadDrawing completes
      const viewModeEnabled = !this.isLoaded
        ? excalidrawData.elements.length > 0
          ? om.viewModeEnabled
          : false
        : api.getAppState().viewModeEnabled;
      const zenModeEnabled = !this.isLoaded
        ? om.zenModeEnabled
        : api.getAppState().zenModeEnabled;

      this.updateScene(
        {
          elements: excalidrawData.elements.concat(deletedElements ?? []), //need to preserve deleted elements during autosave if images, links, etc. are updated
          files: excalidrawData.files,
          captureUpdate: CaptureUpdateAction.NEVER,
        },
        justloaded,
      );
      this.updateScene({
        //elements: excalidrawData.elements.concat(deletedElements??[]), //need to preserve deleted elements during autosave if images, links, etc. are updated
        appState: {
          ...appState,
          ...(this.excalidrawData.selectedElementIds //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/609
            ? this.excalidrawData.selectedElementIds
            : {}),
          ...(excalidrawData.appState.frameRendering &&
          excalidrawData.appState.frameRendering.markerName === undefined
            ? {
                frameRendering: {
                  ...excalidrawData.appState.frameRendering,
                  markerName: true,
                  markerEnabled: true,
                },
              }
            : {}),
          zenModeEnabled,
          viewModeEnabled,
          linkOpacity: this.excalidrawData.getLinkOpacity(),
          penMode: penEnabled,
          penDetected: penEnabled,
          allowPinchZoom: this.plugin.settings.allowPinchZoom,
          allowWheelZoom: this.plugin.settings.allowWheelZoom,
          pinnedScripts: this.plugin.settings.pinnedScripts,
          customPens: this.plugin.settings.customPens.slice(
            0,
            this.plugin.settings.numberOfCustomPens,
          ),
          gridDirection: this.plugin.settings.gridSettings.GRID_DIRECTION ?? {
            horizontal: true,
            vertical: true,
          },
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      if (
        this.app.workspace.getActiveViewOfType(ExcalidrawView) ===
          this.leaf.view &&
        this.excalidrawWrapperRef
      ) {
        //.firstElmentChild solves this issue: https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/346
        (
          this.excalidrawWrapperRef.current
            ?.firstElementChild as HTMLElement | null
        )?.focus();
      }
      this.onAfterLoadScene(justloaded);
    } else {
      await this.instantiateExcalidraw({
        elements: excalidrawData.elements,
        appState: {
          ...appState,
          ...(excalidrawData.appState.frameRendering &&
          excalidrawData.appState.frameRendering.markerName === undefined
            ? {
                frameRendering: {
                  ...excalidrawData.appState.frameRendering,
                  markerName: true,
                  markerEnabled: true,
                },
              }
            : {}),
          zenModeEnabled: om.zenModeEnabled,
          viewModeEnabled:
            excalidrawData.elements.length > 0 ? om.viewModeEnabled : false,
          linkOpacity: this.excalidrawData.getLinkOpacity(),
          penMode: penEnabled,
          penDetected: penEnabled,
          allowPinchZoom: this.plugin.settings.allowPinchZoom,
          allowWheelZoom: this.plugin.settings.allowWheelZoom,
          pinnedScripts: this.plugin.settings.pinnedScripts,
          customPens: this.plugin.settings.customPens.slice(
            0,
            this.plugin.settings.numberOfCustomPens,
          ),
          gridDirection: this.plugin.settings.gridSettings.GRID_DIRECTION,
        },
        files: excalidrawData.files,
        libraryItems: await this.getLibrary(),
      });
      //files are loaded when excalidrawAPI is mounted
    }
    const isCompressed = this.data.match(/```compressed-json\n/gm) !== null;

    if (
      !this.compatibilityMode &&
      this.plugin.settings.compress !== isCompressed &&
      !this.isEditedAsMarkdownInOtherView()
    ) {
      this.setDirty();
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

  private onAfterLoadScene(justloaded: boolean) {
    const api = this.excalidrawAPI;
    if (
      !api ||
      api.isDestroyed ||
      this.semaphores?.windowMigrating ||
      this.semaphores?.viewunload
    ) {
      return;
    }
    void this.loadSceneFiles(false, undefined, undefined, undefined);
    this.updateContainerSize(null, true, justloaded);
    void this.initializeToolsIconPanelAfterLoading();
    const uiMode = calculateUIModeValue(this.plugin.settings);
    this.setUIMode(uiMode);
  }

  public setDirty(): void {
    this.saveCoordinator.setDirty();
  }

  private markDirtyVisuals(): void {
    this.actionButtons?.save?.querySelector("svg").addClass("excalidraw-dirty");
    if (!this.semaphores.viewunload && this.toolsPanelRef?.current) {
      this.toolsPanelRef.current.setDirty(true);
    }
    if (!DEVICE.isMobile) {
      if (requireApiVersion("0.16.0")) {
        setStyle(this.leaf.tabHeaderInnerIconEl, {
          color: "var(--color-accent)",
        });
        setStyle(this.leaf.tabHeaderInnerTitleEl, {
          color: "var(--color-accent)",
        });
      }
    }
  }

  public isDirty(): boolean {
    return this.saveCoordinator.isDirty();
  }

  public clearDirty(): void {
    this.saveCoordinator.clearDirty();
  }

  private clearDirtyVisuals(): void {
    const api = this.excalidrawAPI;
    if (!api) {
      return;
    }
    if (this.toolsPanelRef?.current) {
      this.toolsPanelRef.current.setDirty(false);
    }
    const el = api.getSceneElements();
    if (el) {
      this.previousSceneVersion = this.getSceneVersion(el);
    }
    this.actionButtons?.save
      ?.querySelector("svg")
      .removeClass("excalidraw-dirty");
    if (!DEVICE.isMobile) {
      if (requireApiVersion("0.16.0")) {
        setStyle(this.leaf.tabHeaderInnerIconEl, { color: "" });
        setStyle(this.leaf.tabHeaderInnerTitleEl, { color: "" });
      }
    }
  }

  public async initializeToolsIconPanelAfterLoading() {
    if (this.semaphores.viewunload) {
      return;
    }
    const api = this.excalidrawAPI;
    if (!api) {
      return;
    }
    const st = api.getAppState();
    //since Obsidian 1.6.0 onLayoutReady calls happen asynchronously compared to starting Excalidraw view
    //these validations are just to make sure that initialization is complete
    let counter = 0;
    while (!this.plugin.scriptEngine && counter++ < 50) {
      await sleep(50);
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
    if (this.file) {
      return this.file.basename;
    }
    return t("NOFILE");
  }

  private triggerSceneChangeHooks(
    et: readonly ExcalidrawElement[],
    st: AppState,
    files: BinaryFiles,
  ) {
    if (this.semaphores.viewunload) return;

    const hookServer = this.getHookServer();
    const sidepanel = ExcalidrawSidepanelView.getExisting(false);

    const currentVersion = this.getSceneVersion(et);

    if (
      !hookServer?.onSceneChangeHook &&
      !(sidepanel && sidepanel.hasEATargetingView(this))
    ) {
      this.lastAppState = st;
      this.lastElementsVersion = currentVersion;
      return;
    }

    const last = this.lastAppState;
    const elementsChanged = currentVersion !== this.lastElementsVersion;

    this.lastAppState = st;
    this.lastElementsVersion = currentVersion;

    if (!last && !elementsChanged) return;

    if (hookServer && hookServer.onSceneChangeHook) {
      this.evaluateSceneChangeHook(
        hookServer,
        et,
        st,
        last,
        files,
        elementsChanged,
      );
    }

    if (sidepanel) {
      sidepanel.forEachEATargetingView(this, (ea) => {
        if (ea.onSceneChangeHook) {
          this.evaluateSceneChangeHook(
            ea,
            et,
            st,
            last,
            files,
            elementsChanged,
          );
        }
      });
    }
  }

  private evaluateSceneChangeHook(
    ea: ExcalidrawAutomate,
    et: readonly ExcalidrawElement[],
    st: AppState,
    last: AppState | null,
    files: BinaryFiles,
    elementsChanged: boolean,
  ) {
    const hook = ea.onSceneChangeHook;

    // Strictly enforce appStateKeys or trackElements to protect performance
    if (!hook) return;
    if (
      !hook.trackElements &&
      (!hook.appStateKeys || hook.appStateKeys.length === 0)
    )
      return;

    const tab = ea.sidepanelTab;
    if (tab) {
      const isActiveAndVisible = tab.isActiveTab() && tab.isVisible();
      if (!isActiveAndVisible && !hook.triggerWhenInvisible) return;
    }

    let hasRelevantChange = false;

    if (hook.trackElements && elementsChanged) {
      hasRelevantChange = true;
    }

    if (!hasRelevantChange && hook.appStateKeys && last) {
      for (let i = 0; i < hook.appStateKeys.length; i++) {
        const key = hook.appStateKeys[i];
        if (st[key] !== last[key]) {
          hasRelevantChange = true;
          break;
        }
      }
    }

    if (!hasRelevantChange) return;

    try {
      hook.callback(et, st, files, this, ea);
    } catch (e: unknown) {
      errorlog({
        where: "ExcalidrawView.evaluateSceneChangeHook",
        fn: hook.callback,
        error: e,
      });
    }
  }

  // the view type name
  getViewType() {
    return VIEW_TYPE_EXCALIDRAW;
  }

  // icon for the view
  getIcon() {
    return ICON_NAME;
  }

  async setMarkdownView(eState?: MarkdownViewOpenState) {
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
    void this.plugin.setMarkdownView(
      this.leaf,
      eState as ViewStateResult | undefined,
    );
  }

  public async openAsMarkdown(eState?: MarkdownViewOpenState) {
    if (
      this.plugin.settings.compress &&
      this.plugin.settings.decompressForMDView
    ) {
      this.excalidrawData.disableCompression = true;
      await this.save(true, true, true);
    } else if (this.isDirty()) {
      await this.save(true, true, true);
    }
    void this.setMarkdownView(eState);
  }

  public async convertExcalidrawToMD() {
    await this.save();
    const file = await this.plugin.convertSingleExcalidrawToMD(this.file);
    await sleep(250); //dirty hack to wait for Obsidian metadata to be updated
    this.plugin.openDrawing(file, "active-pane", true);
  }

  public convertTextElementToMarkdown(
    textElement: ExcalidrawTextElement,
    containerElement: ExcalidrawElement,
  ) {
    if (!textElement) {
      return;
    }
    void (async () => {
      const location = await new FileAndFolderSelectorModal(this.app, {
        title: t("CONVERT_TO_MARKDOWN"),
        folderLabel: t("FILE_AND_FOLDER_SELECTOR_FOLDER"),
        fileNameLabel: t("FILE_AND_FOLDER_SELECTOR_FILENAME"),
        submitButtonText: t("PROMPT_BUTTON_CREATE_MARKDOWN"),
        folderPath: splitFolderAndFilename(this.file.path).folderpath,
        fileName: "",
      }).start();
      if (!location) {
        return;
      }
      const filename = location.fileName.toLowerCase().endsWith(".md")
        ? location.fileName
        : `${location.fileName}.md`;
      const fname = getNewUniqueFilepath(
        this.app.vault,
        filename,
        location.folderPath,
      );
      const text: string[] = [];
      if (containerElement && containerElement.link) {
        text.push(containerElement.link);
      }
      text.push(textElement.rawText);
      const f = await createOrOverwriteFile(this.app, fname, text.join("\n"));
      if (f) {
        const ea: ExcalidrawAutomate = getEA(this);
        const elements = containerElement
          ? [textElement, containerElement]
          : [textElement];
        ea.copyViewElementsToEAforEditing(elements);
        ea.getElements().forEach((el) => (el.isDeleted = true));
        const [x, y, w, h] = containerElement
          ? [
              containerElement.x,
              containerElement.y,
              containerElement.width,
              containerElement.height,
            ]
          : [textElement.x, textElement.y, MAX_IMAGE_SIZE, MAX_IMAGE_SIZE];
        const id = ea.addEmbeddable(x, y, w, h, undefined, f);
        if (containerElement) {
          const props: (keyof ExcalidrawElement)[] = [
            "backgroundColor",
            "fillStyle",
            "roughness",
            "roundness",
            "strokeColor",
            "strokeStyle",
            "strokeWidth",
          ];
          props.forEach((prop) => {
            const element = ea.getElement(id);
            if (prop in element) {
              const mutableElement = element as Mutable<ExcalidrawElement>;
              switch (prop) {
                case "backgroundColor":
                  mutableElement.backgroundColor =
                    containerElement.backgroundColor;
                  break;
                case "fillStyle":
                  mutableElement.fillStyle = containerElement.fillStyle;
                  break;
                case "roughness":
                  mutableElement.roughness = containerElement.roughness;
                  break;
                case "roundness":
                  mutableElement.roundness = containerElement.roundness;
                  break;
                case "strokeColor":
                  mutableElement.strokeColor = containerElement.strokeColor;
                  break;
                case "strokeStyle":
                  mutableElement.strokeStyle = containerElement.strokeStyle;
                  break;
                case "strokeWidth":
                  mutableElement.strokeWidth = containerElement.strokeWidth;
                  break;
              }
            }
          });
        }
        ea.getElement(id);
        await ea.addElementsToView();
        ea.destroy();
      }
    })();
  }

  async addYouTubeThumbnail(link: string) {
    const thumbnailLink = await getYouTubeThumbnailLink(link);
    const ea = getEA(this);
    const id = await ea.addImage(0, 0, thumbnailLink);
    ea.getElement(id).link = link;
    await ea.addElementsToView(true, true, true);
    ea.destroy();
  }

  async addImageWithURL(link: string) {
    const ea = getEA(this);
    await ea.addImage(0, 0, link);
    await ea.addElementsToView(true, true, true);
    ea.destroy();
  }

  async addImageSaveToVault(link: string) {
    const ea = getEA(this);
    const mimeType = getMimeType(getURLImageExtension(link));
    const dataURL = await getDataURLFromURL(link, mimeType, 3000);
    const fileId = await generateIdFromFile(
      new TextEncoder().encode(dataURL).buffer,
    );
    const file = await this.excalidrawData.saveDataURLtoVault(
      dataURL,
      mimeType,
      fileId,
    );
    if (!file) {
      new Notice(t("ERROR_SAVING_IMAGE"));
      ea.destroy();
      return;
    }
    await ea.addImage(0, 0, file);
    await ea.addElementsToView(true, true, true);
    ea.destroy();
  }

  async addTextWithOEmbed(text: string) {
    await addTextWithOEmbed(this, text);
  }

  onPaneMenu(menu: Menu, source: string): void {
    if (
      this.excalidrawAPI &&
      this.getViewSelectedElements().some((el) => el.type === "text")
    ) {
      menu.addItem((item) => {
        item
          .setTitle(t("OPEN_LINK"))
          .setIcon("external-link")
          .setSection("pane")
          .onClick((evt) => {
            void this.handleLinkClick(evt);
          });
      });
    }
    // Add a menu item to force the board to markdown view
    if (!this.compatibilityMode) {
      menu.addItem((item) => {
        item
          .setTitle(t("OPEN_AS_MD"))
          .setIcon("document")
          .onClick(() => {
            void this.openAsMarkdown();
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
          .setTitle(t("EXPORT_IMAGE"))
          .setIcon(EXPORT_IMG_ICON_NAME)
          .setSection("pane")
          .onClick(async () => {
            if (!this.excalidrawAPI || !this.file) {
              return;
            }
            if (!this.exportDialog) {
              this.exportDialog = new ExportDialog(
                this.plugin,
                this,
                this.file,
              );
            }
            this.exportDialog.open();
          })
          .setSection("pane");
      })
      .addItem((item) => {
        item
          .setTitle(t("INSTALL_SCRIPT_BUTTON"))
          .setIcon(SCRIPTENGINE_ICON_NAME)
          .setSection("pane")
          .onClick(() => {
            new ScriptInstallPrompt(this.plugin).open();
          });
      });
    super.onPaneMenu(menu, source);
  }

  async getLibrary(): Promise<LibraryItems> {
    const data = await this.plugin.getStencilLibrary();
    return data?.library ? data.library : (data?.libraryItems ?? []);
  }

  public setCurrentPositionToCenter() {
    const api = this.excalidrawAPI;
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
  }

  private getSelectedTextElement(): SelectedElementWithLink {
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
      return {
        id: selectedElement[0].id,
        text: (selectedElement[0] as ExcalidrawTextElement).text,
      };
    } //a text element was selected. Return text

    if (["image", "arrow"].contains(selectedElement[0].type)) {
      return { id: null, text: null };
    }

    const boundTextElements = selectedElement[0].boundElements?.filter(
      (be: BoundElement) => be.type === "text",
    );
    if (boundTextElements?.length > 0) {
      const textElement = api
        .getSceneElements()
        .filter((el: ExcalidrawElement) => el.id === boundTextElements[0].id);
      if (textElement.length > 0) {
        return {
          id: textElement[0].id,
          text: (textElement[0] as ExcalidrawTextElement).text,
        };
      }
    } //is a text container selected?

    if (selectedElement[0].groupIds.length === 0) {
      return { id: null, text: null };
    } //is the selected element part of a group?

    const group = selectedElement[0].groupIds[0]; //if yes, take the first group it is part of
    const textElement = api
      .getSceneElements()
      .filter((el: ExcalidrawElement) => el.groupIds?.includes(group))
      .filter((el: ExcalidrawElement) => el.type === "text"); //filter for text elements of the group
    if (textElement.length === 0) {
      return { id: null, text: null };
    } //the group had no text element member

    return {
      id: textElement[0].id,
      text: (textElement[0] as ExcalidrawTextElement).text,
    }; //return text element text
  }

  private getSelectedImageElement(): SelectedImage {
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
        (el: ExcalidrawElement) =>
          el.id == Object.keys(api.getAppState().selectedElementIds)[0],
      );
    if (selectedElement.length === 0) {
      return { id: null, fileId: null };
    }
    if (selectedElement[0].type == "image") {
      return {
        id: selectedElement[0].id,
        fileId: (selectedElement[0] as ExcalidrawImageElement).fileId,
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
      .filter((el: ExcalidrawElement) => el.groupIds?.includes(group))
      .filter((el: ExcalidrawElement) => el.type == "image"); //filter for Image elements of the group
    if (imageElement.length === 0) {
      return { id: null, fileId: null };
    } //the group had no image element member
    return {
      id: imageElement[0].id,
      fileId: (imageElement[0] as ExcalidrawImageElement).fileId,
    }; //return image element fileId
  }

  private getSelectedElementWithLink(): { id: string; text: string } {
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
        (el: ExcalidrawElement) =>
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
        .filter((el: ExcalidrawElement) => el.id === textId && el.link);
      if (textElement.length > 0) {
        return {
          id: textElement[0].id,
          text: (textElement[0] as ExcalidrawTextElement).text,
        };
      }
    }

    if (selectedElement[0].groupIds.length === 0) {
      return { id: null, text: null };
    } //is the selected element part of a group?
    const group = selectedElement[0].groupIds[0]; //if yes, take the first group it is part of
    const elementsWithLink = api
      .getSceneElements()
      .filter((el: ExcalidrawElement) => el.groupIds?.includes(group))
      .filter((el: ExcalidrawElement) => el.link); //filter for elements of the group that have a link
    if (elementsWithLink.length === 0) {
      return { id: null, text: null };
    } //the group had no image element member
    return { id: elementsWithLink[0].id, text: elementsWithLink[0].link }; //return image element fileId
  }

  public async addLink(
    markdownlink: string,
    path: string,
    alias: string,
    originalLink?: string,
  ) {
    const api = this.excalidrawAPI;
    const st = api.getAppState();
    if (
      !st.selectedElementIds ||
      (st.selectedElementIds && Object.keys(st.selectedElementIds).length !== 1)
    ) {
      await this.addText(markdownlink);
      return;
    }
    const selectedElementId = Object.keys(
      api.getAppState().selectedElementIds,
    )[0];
    const selectedElement = api
      .getSceneElements()
      .find((el) => el.id === selectedElementId);
    if (
      !selectedElement ||
      (!originalLink && selectedElement && selectedElement.link !== null)
    ) {
      if (selectedElement) {
        new Notice(
          "Selected element already has a link. Inserting link as text.",
        );
      }
      await this.addText(markdownlink);
      return;
    }
    const ea = getEA(this);
    ea.copyViewElementsToEAforEditing([selectedElement]);
    if (originalLink?.match(/\[\[(.*?)\]\]/)?.[1]) {
      markdownlink = originalLink.replace(/(\[\[.*?\]\])/, markdownlink);
    }
    ea.getElement(selectedElementId).link = markdownlink;
    await ea.addElementsToView(false, true);
    ea.destroy();
    if (originalLink) {
      this.updateScene({
        appState: {
          showHyperlinkPopup: {
            newValue: "info",
            oldValue: "editor",
          },
        },
      });
    }
  }

  public async addText(
    text: string,
    fontFamily?: 1 | 2 | 3 | 4,
    save: boolean = true,
  ): Promise<string> {
    const api = this.excalidrawAPI;
    if (!api) {
      return;
    }
    const st: AppState = api.getAppState();
    const ea = getEA(this);
    ea.setStyle({
      strokeColor: st.currentItemStrokeColor ?? "black",
      opacity: st.currentItemOpacity ?? 1,
      fontFamily: fontFamily ?? st.currentItemFontFamily ?? 1,
      fontSize: st.currentItemFontSize ?? 20,
      textAlign: st.currentItemTextAlign ?? "left",
    });

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
    const isPointerOutsideVisibleArea =
      top.x > this.currentPosition.x ||
      bottom.x < this.currentPosition.x ||
      top.y > this.currentPosition.y ||
      bottom.y < this.currentPosition.y;

    const id = ea.addText(this.currentPosition.x, this.currentPosition.y, text);
    await this.addElements({
      newElements: ea.getElements(),
      repositionToCursor: isPointerOutsideVisibleArea,
      save,
      newElementsOnTop: true,
    });
    ea.destroy();
    return id;
  }

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
    images?: { [key: FileId]: ImageInfo };
    newElementsOnTop?: boolean;
    shouldRestoreElements?: boolean;
    captureUpdate?: CaptureUpdateActionType;
  }): Promise<boolean> {
    const api = this.excalidrawAPI;
    if (!api) {
      return false;
    }
    const sceneElements = api.getSceneElements() as ExcalidrawElement[];
    const elementsMap = arrayToMap(sceneElements) as ElementsMap;
    const textElements = newElements.filter((el) => el.type == "text");
    let shouldRefreshArrows = false;
    for (let i = 0; i < textElements.length; i++) {
      const textElement = textElements[i] as Mutable<ExcalidrawTextElement>;
      const { parseResult, link } = await this.excalidrawData.addTextElement(
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
        const { text, x, y, width, height } = refreshTextDimensions(
          textElement,
          null,
          elementsMap,
          parseResult,
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
    const newElementsMap = new Map(
      newElements.map((element) => [element.id, element]),
    );
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
      shouldRefreshArrows = newElements.some(
        (e) =>
          ["arrow", "line", "freedraw", "elbow-arrow", "iframe"].includes(
            e.type,
          ) ||
          Boolean("boundElements" in e && e.boundElements?.length) ||
          Boolean("startBinding" in e && e.startBinding) ||
          Boolean("endBinding" in e && e.endBinding),
      );
    }

    const files: BinaryFileData[] = [];
    if (images && Object.keys(images).length > 0) {
      Object.keys(images).forEach((k: FileId) => {
        files.push({
          mimeType: images[k].mimeType,
          id: images[k].id,
          dataURL: images[k].dataURL,
          created: images[k].created,
        });
        if (images[k].file || images[k].isHyperLink) {
          //|| images[k].isLocalLink but isLocalLink was never passed
          const embeddedFile = new EmbeddedFile(
            this.plugin,
            this.file.path,
            images[k].isHyperLink //&& !images[k].isLocalLink local link is never passed to addElements
              ? images[k].hyperlink
              : typeof images[k].file === "string"
                ? images[k].file
                : images[k].file.path,
          );
          const st: AppState = api.getAppState();
          embeddedFile.setImage({
            imgBase64: images[k].dataURL,
            mimeType: images[k].mimeType,
            size: images[k].size,
            isDark: st.theme === "dark",
            isSVGwithBitmap: images[k].hasSVGwithBitmap,
            pdfPageViewProps: images[k].pdfPageViewProps,
            renderScale: images[k].renderScale,
          });
          this.excalidrawData.setFile(images[k].id, embeddedFile);
          if (images[k].pdfPageViewProps) {
            elements
              .filter((e) => e.type === "image" && e.fileId === images[k].id)
              .forEach((e) => {
                addAppendUpdateCustomData(e, {
                  pdfPageViewProps: images[k].pdfPageViewProps,
                });
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

    if (files.length > 0) {
      api.addFiles(files);
    }

    const newContainers = newElements.filter(isContainer);
    if (newContainers.length > 0) {
      api.updateContainerSize(newContainers as NonDeletedExcalidrawElement[]);
      shouldRefreshArrows = true;
    }
    if (shouldRefreshArrows) {
      api.refreshAllArrows();
    }
    if (save) {
      await this.save(false); //preventReload=false will ensure that markdown links are paresed and displayed correctly
    } else {
      this.setDirty();
    }
    return true;
  }

  public getScene(selectedOnly?: boolean) {
    return this.getSceneWithAppState(selectedOnly);
  }

  private getSceneWithAppState(
    selectedOnly?: boolean,
    appStateSnapshot?: AppState,
  ) {
    /*    if (this.lastSceneSnapshot) {
      return this.lastSceneSnapshot;
    }*/
    const api = this.excalidrawAPI;
    if (!api) {
      return null;
    }
    const el: readonly NonDeletedExcalidrawElement[] = selectedOnly
      ? (this.getViewSelectedElements() as NonDeletedExcalidrawElement[])
      : api.getSceneElements();
    const st = appStateSnapshot ?? api.getAppState();
    const files = { ...api.getFiles() };

    if (files) {
      const imageFileIds = new Set(
        el.filter((e) => e.type === "image").map((e) => e.fileId),
      );
      const toDelete = Object.keys(files).filter(
        (key) => !imageFileIds.has(key as FileId),
      );
      toDelete.forEach((k) => delete files[k]);
    }

    const activeTool = { ...st.activeTool };
    if (!["freedraw", "hand"].includes(activeTool.type)) {
      activeTool.type = "selection";
    }
    activeTool.customType = null;
    activeTool.lastActiveTool = null;

    return {
      type: "excalidraw",
      version: 2,
      source: `${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_RELEASES_TAG}/${PLUGIN_VERSION}`,
      elements: el,
      //see also ExcalidrawAutomate async create(
      appState: {
        theme: st.theme,
        viewBackgroundColor: st.viewBackgroundColor,
        currentItemStrokeColor: st.currentItemStrokeColor,
        currentItemBackgroundColor: st.currentItemBackgroundColor,
        currentItemFillStyle: st.currentItemFillStyle,
        ...getAppStateStrokeWidthEntry(
          st.currentItemStrokeWidthKey,
          st.currentItemStrokeWidth,
        ),
        currentItemStrokeVariability: st.currentItemStrokeVariability,
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
        colorTopPicks: st.colorTopPicks,
        currentStrokeOptions: st.currentStrokeOptions,
        frameRendering: st.frameRendering,
        objectsSnapModeEnabled: st.objectsSnapModeEnabled,
        activeTool,
        disableContextMenu: st.disableContextMenu,
        bindingPreference: st.bindingPreference,
        isBindingEnabled: st.isBindingEnabled,
        isMidpointSnappingEnabled: st.isMidpointSnappingEnabled,
        boxSelectionMode: st.boxSelectionMode,
      },
      prevTextMode: this.prevTextMode,
      files,
    };
  }

  /**
   * ExcalidrawAPI refreshes canvas offsets
   * @returns
   */
  private refreshCanvasOffset() {
    if (this.contentEl.clientWidth === 0 || this.contentEl.clientHeight === 0) {
      return;
    }
    const api = this.excalidrawAPI;
    if (!api) {
      return;
    }
    api.refresh();
  }

  // depricated. kept for backward compatibility. e.g. used by the Slideshow plugin
  // 2024.05.03
  public refresh() {
    this.refreshCanvasOffset();
  }

  private clearHoverPreview() {
    const hoverContainerEl = this.hoverPopover?.containerEl;
    //don't auto hide hover-editor
    if (
      this.hoverPopover &&
      !hoverContainerEl?.parentElement?.hasClass("hover-editor")
    ) {
      this.hoverPreviewTarget = null;
      if (this.hoverPopover.embed?.editor) {
        return;
      }
      this.hoverPopover?.hide();
    } else if (this.hoverPreviewTarget) {
      const event = new MouseEvent("click", {
        view: this.ownerWindow,
        bubbles: true,
        cancelable: true,
      });
      this.hoverPreviewTarget.dispatchEvent(event);
      this.hoverPreviewTarget = null;
    }
  }

  /**
   * identify which element to navigate to on click
   * @returns
   */
  private identifyElementClicked() {
    this.selectedTextElement = getTextElementAtPointer(
      this.currentPosition,
      this,
    );
    if (this.selectedTextElement && this.selectedTextElement.id) {
      const event = new MouseEvent("click", {
        ctrlKey:
          !(DEVICE.isIOS || DEVICE.isMacOS) || this.modifierKeyDown.ctrlKey,
        metaKey: DEVICE.isIOS || DEVICE.isMacOS || this.modifierKeyDown.metaKey,
        shiftKey: this.modifierKeyDown.shiftKey,
        altKey: this.modifierKeyDown.altKey,
      });
      void this.handleLinkClick(event);
      this.selectedTextElement = null;
      return;
    }
    this.selectedImageElement = getImageElementAtPointer(
      this.currentPosition,
      this,
    );
    if (this.selectedImageElement && this.selectedImageElement.id) {
      const event = new MouseEvent("click", {
        ctrlKey:
          !(DEVICE.isIOS || DEVICE.isMacOS) || this.modifierKeyDown.ctrlKey,
        metaKey: DEVICE.isIOS || DEVICE.isMacOS || this.modifierKeyDown.metaKey,
        shiftKey: this.modifierKeyDown.shiftKey,
        altKey: this.modifierKeyDown.altKey,
      });
      void this.handleLinkClick(event);
      this.selectedImageElement = null;
      return;
    }

    this.selectedElementWithLink = getElementWithLinkAtPointer(
      this.currentPosition,
      this,
    );
    if (this.selectedElementWithLink && this.selectedElementWithLink.id) {
      const event = new MouseEvent("click", {
        ctrlKey:
          !(DEVICE.isIOS || DEVICE.isMacOS) || this.modifierKeyDown.ctrlKey,
        metaKey: DEVICE.isIOS || DEVICE.isMacOS || this.modifierKeyDown.metaKey,
        shiftKey: this.modifierKeyDown.shiftKey,
        altKey: this.modifierKeyDown.altKey,
      });
      void this.handleLinkClick(event);
      this.selectedElementWithLink = null;
    }
  }

  private showHoverPreview(linktext?: string, element?: ExcalidrawElement) {
    if (this.hoverPreviewTarget) {
      return;
    } //hover preview is already shown
    if (!this.lastMouseEvent) {
      return;
    }
    const st = this.excalidrawAPI?.getAppState();
    if (st?.editingTextElement || st?.newElement) {
      return;
    } //should not activate hover preview when element is being edited or dragged
    if (this.semaphores.wheelTimeout) {
      return;
    }
    //if link text is not provided, try to get it from the element
    if (!linktext) {
      if (!this.currentPosition) {
        return;
      }
      linktext = "";
      const selectedEl = getTextElementAtPointer(this.currentPosition, this);
      if (!selectedEl || !selectedEl.text) {
        const selectedImgElement = getImageElementAtPointer(
          this.currentPosition,
          this,
        );
        const selectedElementWithLink =
          selectedImgElement?.id || selectedImgElement?.id
            ? null
            : getElementWithLinkAtPointer(this.currentPosition, this);
        element = this.excalidrawAPI
          .getSceneElements()
          .find((el: ExcalidrawElement) => el.id === selectedImgElement.id);
        if (
          (!selectedImgElement || !selectedImgElement.fileId) &&
          !selectedElementWithLink?.id
        ) {
          return;
        }
        if (selectedImgElement?.id) {
          if (!this.excalidrawData.hasFile(selectedImgElement.fileId)) {
            return;
          }
          const ef = this.excalidrawData.getFile(selectedImgElement.fileId);
          if (!ef.file) {
            return;
          }
          if (
            ef.isHyperLink ||
            ef.isLocalLink || //web images don't have a preview
            IMAGE_TYPES.contains(ef.file.extension) || //images don't have a preview
            ef.file.extension.toLowerCase() === "pdf" || //pdfs don't have a preview
            this.plugin.ea.isExcalidrawFile(ef.file)
          ) {
            //excalidraw files don't have a preview
            linktext = getLinkTextFromLink(element.link);
            if (!linktext) {
              return;
            }
          } else {
            const ref = ef.linkParts.ref
              ? `#${ef.linkParts.isBlockRef ? "^" : ""}${ef.linkParts.ref}`
              : "";
            linktext = ef.file.path + ref;
          }
        }
        if (selectedElementWithLink?.id) {
          linktext = getLinkTextFromLink(selectedElementWithLink.text);
          if (!linktext) {
            return;
          }
          if (
            this.app.metadataCache.getFirstLinkpathDest(
              linktext.split("#")[0],
              this.file.path,
            ) === this.file
          ) {
            return;
          }
        }
      } else {
        const { linkText, selectedElement } = this.getLinkTextForElement(
          selectedEl,
          selectedEl,
        );
        element = selectedElement;
        /*this.excalidrawAPI.getSceneElements().filter((el:ExcalidrawElement)=>el.id === selectedElement.id)[0];
          const text: string =
            this.textMode === TextMode.parsed
              ? this.excalidrawData.getRawText(selectedElement.id)
              : selectedElement.text;*/

        linktext = getLinkTextFromLink(linkText);
        if (!linktext) {
          return;
        }
      }
    }

    if (this.getHookServer().onLinkHoverHook && element && !element.isDeleted) {
      try {
        const hoveredElement = element;
        if (
          !this.getHookServer().onLinkHoverHook(
            hoveredElement,
            linktext,
            this,
            this.getHookServer(),
          )
        ) {
          return;
        }
      } catch (e) {
        errorlog({
          where: "ExcalidrawView.showHoverPreview",
          fn: "getHookServer().onLinkHoverHook",
          error: e,
        });
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
      this.ownerDocument.querySelector(
        `div.popover-title[data-path="${f.path}"]`,
      )
    ) {
      return;
    }

    this.semaphores.hoverSleep = true;
    window.setTimeout(() => (this.semaphores.hoverSleep = false), 500);
    const baseMouseEvent = this.lastMouseEvent as MouseEvent | null;
    const { x: sceneX, y: sceneY } = this.currentPosition;
    const { x: clientX, y: clientY } = sceneCoordsToViewportCoords(
      { sceneX, sceneY },
      this.excalidrawAPI?.getAppState(),
    );
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
          metaKey: DEVICE.isIOS || DEVICE.isMacOS,
          shiftKey: false,
          altKey: false,
        })
      : null;
    this.plugin.hover.linkText = linktext;
    this.plugin.hover.sourcePath = this.file.path;
    this.hoverPreviewTarget = this.lastMouseEvent?.target ?? this.contentEl; //e.target;
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
          this.ownerDocument.querySelector(
            `div.popover-title[data-path="${f.path}"]`,
          )?.parentElement?.parentElement?.parentElement ??
          this.ownerDocument.body.querySelector("div.popover");
        if (popover) {
          this.contentEl.append(popover);
        }
      }, 400);
    }
  }

  private isLinkSelected(): boolean {
    return Boolean(
      this.getSelectedTextElement().id ||
      this.getSelectedImageElement().id ||
      this.getSelectedElementWithLink().id,
    );
  }

  private lastKeyDownPosition: { x: number; y: number } = { x: 0, y: 0 };

  public excalidrawDIVonKeyUp = () => {
    this.lastKeyDownPosition = { x: 0, y: 0 };
  };

  public excalidrawDIVonKeyDown(event: KeyboardEvent) {
    if (this.semaphores?.viewunload) {
      return;
    }
    if (event.target === this.excalidrawWrapperRef.current) {
      return;
    } //event should originate from the canvas
    if (this.isFullscreen() && event.key === "Escape") {
      this.exitFullscreen();
    }
    if (
      isWinCTRLorMacCMD(event) &&
      !isSHIFT(event) &&
      !isWinALTorMacOPT(event)
    ) {
      const { x: lastX, y: lastY } = this.lastKeyDownPosition;
      const { x: currentX, y: currentY } = this.currentPosition;
      if (Math.abs(lastX - currentX) < 5 && Math.abs(lastY - currentY) < 5) {
        return;
      }
      this.lastKeyDownPosition = { ...this.currentPosition };
      this.showHoverPreview();
    }
  }

  public onPointerDown(e: PointerEvent) {
    if (!(isWinCTRLorMacCMD(e) || isWinMETAorMacCTRL(e))) {
      return;
    }
    if (!this.plugin.settings.allowCtrlClick && !isWinMETAorMacCTRL(e)) {
      return;
    }
    if (this.excalidrawAPI?.getAppState().contextMenu) {
      return;
    }
    //added setTimeout when I changed onClick(e: MouseEvent) to onPointerDown() in 1.7.9.
    //Timeout is required for Excalidraw to first complete the selection action before execution
    //of the link click continues
    window.setTimeout(() => {
      if (this.isLinkSelected()) {
        void this.handleLinkClick(e);
        return;
      }
      // When CTRL+ALT (or CMD+OPT on Mac) is pressed, Excalidraw switches to lasso select
      // mode instead of selecting the element under the pointer, so isLinkSelected() returns
      // false. Fall back to checking the element at the current pointer position.
      if (isWinCTRLorMacCMD(e) && isWinALTorMacOPT(e)) {
        const selectedText = getTextElementAtPointer(
          this.currentPosition,
          this,
        );
        const selectedImage = selectedText?.id
          ? null
          : getImageElementAtPointer(this.currentPosition, this);
        const selectedElementWithLink =
          selectedText?.id || selectedImage?.id
            ? null
            : getElementWithLinkAtPointer(this.currentPosition, this);
        if (
          selectedText?.id ||
          selectedImage?.id ||
          selectedElementWithLink?.id
        ) {
          this.removeLinkTooltip();
          void this.linkClick(
            e,
            selectedText,
            selectedImage,
            selectedElementWithLink,
          );
        }
      }
    });
  }

  public onMouseMove(e: MouseEvent | { nativeEvent: MouseEvent }) {
    this.lastMouseEvent = "nativeEvent" in e ? e.nativeEvent : e;
  }

  public onMouseOver() {
    this.clearHoverPreview();
  }

  public onPointerUpdate(p: {
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
      if (
        isWinCTRLorMacCMD(this.modifierKeyDown) ||
        isWinMETAorMacCTRL(this.modifierKeyDown)
      ) {
        this.identifyElementClicked();
        return;
      }

      if (this.plugin.settings.doubleClickLinkOpenViewMode) {
        //dobule click
        const now = Date.now();
        if (
          now - this.doubleClickTimestamp < 600 &&
          now - this.doubleClickTimestamp > 40
        ) {
          this.identifyElementClicked();
        }
        this.doubleClickTimestamp = now;
      }
      return;
    }
    if (p.button === "up") {
      this.blockOnMouseButtonDown = false;
    }
    if (
      isWinCTRLorMacCMD(this.modifierKeyDown) ||
      (this.excalidrawAPI.getAppState().viewModeEnabled &&
        this.plugin.settings.hoverPreviewWithoutCTRL)
    ) {
      this.showHoverPreview();
    }
  }

  public updateGridColor(canvasColor?: string, st?: AppState) {
    if (!canvasColor) {
      st = this.excalidrawAPI.getAppState();
      canvasColor =
        (canvasColor ?? st.viewBackgroundColor === "transparent")
          ? "white"
          : st.viewBackgroundColor;
    }
    window.setTimeout(() => {
      //migrate window scenario
      if (!this.plugin || !this.excalidrawAPI) {
        return;
      }
      this.updateScene({
        appState: {
          gridColor: this.getGridColor(canvasColor),
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    });
  }

  public updateGridDirection(gridDirection: {
    horizontal: boolean;
    vertical: boolean;
  }) {
    window.setTimeout(() =>
      this.updateScene({
        appState: {
          gridDirection: {
            horizontal: gridDirection.horizontal,
            vertical: gridDirection.vertical,
          },
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      }),
    );
  }

  private canvasColorChangeHook(st: AppState) {
    const canvasColor =
      st.viewBackgroundColor === "transparent"
        ? "white"
        : st.viewBackgroundColor;
    this.updateGridColor(canvasColor, st);
    setDynamicStyle(
      this.plugin.ea,
      this,
      canvasColor,
      this.plugin.settings.dynamicStyling,
    );
    if (this.plugin.ea.onCanvasColorChangeHook) {
      try {
        this.plugin.ea.onCanvasColorChangeHook(
          this.plugin.ea,
          this,
          st.viewBackgroundColor,
        );
      } catch (e: unknown) {
        errorlog({
          where: this.canvasColorChangeHook.bind(this) as unknown,
          source: this.plugin.ea.onCanvasColorChangeHook,
          error: e,
          message: "ea.onCanvasColorChangeHook exception",
        });
      }
    }
  }

  private checkSceneVersion(et: readonly ExcalidrawElement[]) {
    const sceneVersion = this.getSceneVersion(et);
    if (
      (sceneVersion > 0 || (sceneVersion === 0 && et.length > 0)) && //Addressing the rare case when the last element is deleted from the scene
      sceneVersion !== this.previousSceneVersion
    ) {
      this.previousSceneVersion = sceneVersion;
      this.setDirty();
    }
  }

  /**
   * Detects local Markdown-image elements that were just soft-deleted (isDeleted flipped to
   * true) in a durable Excalidraw history increment and queues them for the keep-or-delete-file
   * prompt. Unlike watching specific keyboard/pointer gestures, this catches every way an element
   * can be deleted - Backspace/Delete, Cut, the Excalidraw properties-panel trash icon, the
   * context menu, undo/redo, or a script - because they all funnel through the same durable
   * store increment.
   */
  public onExcalidrawIncrement(
    event: DurableIncrement | EphemeralIncrement,
  ): void {
    if (event.type !== "durable") {
      return;
    }
    // Durable increments are the precise edit boundary needed by the save
    // coordinator. Unlike the legacy dirty boolean, they continue to arrive
    // while compression or disk persistence is in flight.
    this.setDirty();
    Object.values(event.change.elements).forEach((element) => {
      if (element.type !== "image" || !element.isDeleted) {
        return;
      }
      if (
        getMarkdownImageCustomData(element)?.source !== "local" ||
        !this.excalidrawData.hasMarkdownImage(element.fileId)
      ) {
        return;
      }
      this.markdownImageController.queueMarkdownImageDeletion(element);
    });
  }

  public onChange(et: ExcalidrawElement[], st: AppState, files: BinaryFiles) {
    this.selectedElementActionsMenu?.update(et, st);
    if (st.activeTool?.type) {
      if (st.activeTool.type === "image") {
        if (
          st.selectedElementIds &&
          Object.keys(st.selectedElementIds).length === 1
        ) {
          const selectedElement = et.filter(
            (el) => el.id === Object.keys(st.selectedElementIds)[0],
          )[0];
          if (selectedElement && selectedElement.type === "image") {
            this.setShouldSaveImportedImageFlag();
          }
        }
      }
    }
    if (
      this.semaphores.shouldSaveImportedImage &&
      Object.values(files).some(
        (file) => !Object.hasOwn(file ?? {}, "hasSVGwithBitmap"),
      )
    ) {
      window.setTimeout(() => {
        void this.forceSave(true, false); //image is being added to the scene
      });
    }

    if ((st.newElement as ExcalidrawElement)?.type === "freedraw") {
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
      if (elcount > 0 && et.length === 0) {
        return;
      }
      this.semaphores.justLoaded = false;
      if (
        !this.semaphores.preventAutozoom &&
        this.plugin.settings.zoomToFitOnOpen
      ) {
        if (
          getExcalidraAndMarkdowViewsForFile(this.app, this.file).length === 1
        ) {
          this.zoomToFit(false, true);
        }
      }
      this.previousSceneVersion = this.getSceneVersion(et);
      this.previousBackgroundColor = st.viewBackgroundColor;
      this.previousTheme = st.theme;
      this.canvasColorChangeHook(st);
      return;
    }
    if (
      st.theme !== this.previousTheme &&
      this.file === this.excalidrawData.file
    ) {
      this.previousTheme = st.theme;
      this.setDirty();
    }
    if (
      st.viewBackgroundColor !== this.previousBackgroundColor &&
      this.file === this.excalidrawData.file
    ) {
      this.previousBackgroundColor = st.viewBackgroundColor;
      this.setDirty();
      if (this.colorChangeTimer) {
        window.clearTimeout(this.colorChangeTimer);
      }
      this.colorChangeTimer = window.setTimeout(() => {
        this.canvasColorChangeHook(st);
        this.colorChangeTimer = null;
      }, 50); //just enough time if the user is playing with color picker, the change is not too frequent.
    }
    if (
      !this.semaphores.dirty &&
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

    handleMarkdownImageEditorSelection(this, et, st.selectedElementIds);
    this.triggerSceneChangeHooks(et, st, files);
  }

  public onLibraryChange(items: LibraryItems) {
    void (async () => {
      const lib: StencilLibraryData = {
        type: "excalidrawlib",
        version: 2,
        source: `${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_RELEASES_TAG}/${PLUGIN_VERSION}`,
        libraryItems: items,
      };

      await this.plugin.setStencilLibrary(lib);
    })();
  }

  private shouldSaveImportedImageTimer: number = null;
  private setShouldSaveImportedImageFlag() {
    this.semaphores.shouldSaveImportedImage = true;
    if (this.shouldSaveImportedImageTimer) {
      window.clearTimeout(this.shouldSaveImportedImageTimer);
    }
    this.shouldSaveImportedImageTimer = window.setTimeout(
      () => (this.semaphores.shouldSaveImportedImage = false),
      3000,
    );
  }

  public onPaste(
    data: ClipboardData,
    event: ClipboardEvent | null,
    files: ParsedDataTransferFile[],
  ) {
    const api = this.excalidrawAPI;
    const ea = this.getHookServer();

    if (
      files?.length ||
      (data?.mixedContent &&
        data.mixedContent.some((d) => d.type === "imageUrl"))
    ) {
      this.setShouldSaveImportedImageFlag();
    }

    if (data?.elements) {
      data.elements
        .filter(
          (el) => el.type === "text" && !Object.hasOwn(el ?? {}, "rawText"),
        )
        .forEach(
          (el) =>
            ((el as Mutable<ExcalidrawTextElement>).rawText = (
              el as ExcalidrawTextElement
            ).originalText),
        );

      data.elements
        .filter(
          (el): el is Mutable<ExcalidrawImageElement> =>
            el.type === "image" &&
            Boolean(
              (el as ExcalidrawImageWithCustomData<ExcalidrawLatexCustomData>)
                .customData?.latex,
            ),
        )
        .forEach((image) => {
          const fileId = image.fileId;
          const embeddedFile = this.excalidrawData.getFile(fileId);
          const equation = this.excalidrawData.getEquation(fileId);
          const mermaid = this.excalidrawData.getMermaid(fileId);

          if (!embeddedFile && !equation && !mermaid) {
            this.excalidrawData.setEquation(image.fileId, {
              latex: (
                image as ExcalidrawImageWithCustomData<ExcalidrawLatexCustomData>
              ).customData?.latex,
              isLoaded: true,
            });
          }
        });
    }
    if (data && ea.onPasteHook) {
      try {
        const res = ea.onPasteHook({
          ea,
          payload: data,
          event,
          excalidrawFile: this.file,
          view: this,
          pointerPosition: this.currentPosition,
        });
        if (typeof res === "boolean" && res === false) {
          return false;
        }
      } catch (e) {
        errorlog({
          where: "ExcalidrawView.onPaste",
          fn: ea.onPasteHook,
          error: e,
        });
      }
    }

    // Disables Middle Mouse Button Paste Functionality on Linux
    if (
      !this.modifierKeyDown.ctrlKey &&
      typeof event !== "undefined" &&
      event !== null &&
      DEVICE.isLinux
    ) {
      return false;
    }

    if (data && data.text && hyperlinkIsImage(data.text)) {
      void this.addImageWithURL(data.text);
      return false;
    }

    const obsidianURLFilePath = getFilePathFromObsidianURL(data?.text);
    if (obsidianURLFilePath) {
      void this.addImageWithURL(obsidianURLFilePath);
      return false;
    }
    if (data && data.text && !this.modifierKeyDown.shiftKey) {
      const isCodeblock = Boolean(
        data.text
          .replaceAll("\r\n", "\n")
          .replaceAll("\r", "\n")
          .match(/^`{3}[^\n]*\n.+\n`{3}\s*$/ms),
      );
      if (isCodeblock) {
        const clipboardText = data.text;
        window.setTimeout(() => {
          void this.pasteCodeBlock(clipboardText);
        });
        return false;
      }

      if (
        isTextImageTransclusion(data.text, this, (link, file) => {
          void (async () => {
            const ea = getEA(this);
            if (IMAGE_TYPES.contains(file.extension)) {
              ea.selectElementsInView([
                await insertImageToView(ea, this.currentPosition, file),
              ]);
              ea.destroy();
            } else if (file.extension !== "pdf") {
              ea.selectElementsInView([
                await insertEmbeddableToView(
                  ea,
                  this.currentPosition,
                  file,
                  link,
                ),
              ]);
              ea.destroy();
            } else if (
              link.match(
                /^[^#]*#page=\d*(&\w*=[^&]+){0,}&rect=\d*,\d*,\d*,\d*/g,
              )
            ) {
              const ea = getEA(this);
              const imgID = await ea.addImage(
                this.currentPosition.x,
                this.currentPosition.y,
                link.split("&rect=")[0],
              );
              const el = ea.getElement(
                imgID,
              ) as Mutable<ExcalidrawImageElement>;
              const fd = ea.imagesDict[el.fileId];
              el.crop = getPDFCropRect({
                scale: this.plugin.settings.pdfScale,
                link,
                naturalHeight: fd.size.height,
                naturalWidth: fd.size.width,
                pdfPageViewProps: fd.pdfPageViewProps,
              });
              addAppendUpdateCustomData(el, {
                pdfPageViewProps: fd.pdfPageViewProps,
              });
              if (el.crop) {
                el.width = el.crop.width / this.plugin.settings.pdfScale;
                el.height = el.crop.height / this.plugin.settings.pdfScale;
              }
              el.link = `[[${link}]]`;
              await ea.addElementsToView(false, false).then(() => ea.destroy());
            } else {
              const modal = new UniversalInsertFileModal(this.plugin, this);
              modal.open(file, this.currentPosition);
            }
            this.setDirty();
          })();
        })
      ) {
        return false;
      }

      const quoteWithRef = obsidianPDFQuoteWithRef(data.text);
      if (quoteWithRef) {
        const ea = getEA(this);
        const st = api.getAppState();
        const strokeC = st.currentItemStrokeColor;
        const viewC = st.viewBackgroundColor;
        ea.setStyle({
          strokeColor:
            strokeC === "transparent"
              ? ea
                  .getCM(viewC === "transparent" ? "white" : viewC)
                  .invert()
                  .stringHEX({ alpha: false })
              : strokeC,
          fontFamily: st.currentItemFontFamily,
          fontSize: st.currentItemFontSize,
        });
        const textDims = ea.measureText(quoteWithRef.quote);
        const textWidth = textDims.width + 2 * 30; //default padding
        const id = ea.addText(
          this.currentPosition.x,
          this.currentPosition.y,
          quoteWithRef.quote,
          {
            box: true,
            boxStrokeColor: "transparent",
            width: Math.min(500, textWidth),
            height: textDims.height + 2 * 30,
          },
        );
        ea.elementsDict[id].link = `[[${quoteWithRef.link}]]`;
        void ea.addElementsToView(false, false).then(() => ea.destroy());

        return false;
      }
    }
    if (data.elements) {
      data.elements
        .filter((el) => el.type === "text" || el.link)
        .forEach((el) =>
          updateElementIdsInScene(
            { elements: data.elements as Mutable<ExcalidrawElement>[] },
            el,
            nanoid(),
          ),
        );
      window.setTimeout(() => {
        void this.save(false);
      }, 30); //removed prevent reload = false, as reload was triggered when pasted containers were processed and there was a conflict with the new elements
    }

    //process pasted text after it was processed into elements by Excalidraw
    //I let Excalidraw handle the paste first, e.g. to split text by lines
    //Only process text if it includes links or embeds that need to be parsed
    if (
      data &&
      data.text &&
      data.text.match(/(\[\[[^\]]*]])|(\[[^\]]*]\([^)]*\))/gm)
    ) {
      const prevElements = api
        .getSceneElements()
        .filter((el) => el.type === "text")
        .map((el) => el.id);

      window.setTimeout(() => {
        void (async () => {
          const sceneElements =
            api.getSceneElementsIncludingDeleted() as Mutable<ExcalidrawElement>[];
          const newElements = sceneElements.filter(
            (el) =>
              el.type === "text" &&
              !el.isDeleted &&
              !prevElements.includes(el.id),
          ) as ExcalidrawTextElement[];

          //collect would-be image elements and their corresponding files and links
          const imageElementsMap = new Map<
            ExcalidrawTextElement,
            [string, TFile]
          >();
          let element: ExcalidrawTextElement;
          const callback = (link: string, file: TFile) => {
            imageElementsMap.set(element, [link, file]);
          };
          newElements.forEach((el: ExcalidrawTextElement) => {
            element = el;
            isTextImageTransclusion(el.originalText, this, callback);
          });

          //if there are no image elements, save and return
          //Save will ensure links and embeds are parsed
          if (imageElementsMap.size === 0) {
            await this.save(false); //saving because there still may be text transclusions
            return;
          }

          //if there are image elements
          //first delete corresponding "old" text elements
          for (const [el] of imageElementsMap) {
            const clone = cloneElement(el);
            clone.isDeleted = true;
            this.excalidrawData.deleteTextElement(clone.id);
            sceneElements[sceneElements.indexOf(el)] = clone;
          }
          this.updateScene({
            elements: sceneElements,
            captureUpdate: CaptureUpdateAction.NEVER,
          });

          //then insert images and embeds
          //shift text elements down to make space for images and embeds
          const ea: ExcalidrawAutomate = getEA(this);
          let offset = 0;
          for (const el of newElements) {
            const topleft = { x: el.x, y: el.y + offset };
            if (imageElementsMap.has(el)) {
              const [link, file] = imageElementsMap.get(el);
              if (IMAGE_TYPES.contains(file.extension)) {
                const id = await insertImageToView(
                  ea,
                  topleft,
                  file,
                  undefined,
                  false,
                );
                offset += ea.getElement(id).height - el.height;
              } else if (file.extension !== "pdf") {
                //isTextImageTransclusion will not return text only markdowns, this is here
                //for the future when we may want to support other embeddables
                const id = await insertEmbeddableToView(
                  ea,
                  topleft,
                  file,
                  link,
                  false,
                );
                offset += ea.getElement(id).height - el.height;
              } else {
                const modal = new UniversalInsertFileModal(this.plugin, this);
                modal.open(file, topleft);
              }
            } else if (offset !== 0) {
              ea.copyViewElementsToEAforEditing([el]);
              ea.getElement(el.id).y = topleft.y;
            }
          }
          await ea.addElementsToView(false, true);
          ea.selectElementsInView(newElements.map((el) => el.id));
          ea.destroy();
        })();
      }, 200); //parse transclusion and links after paste
    }
    return true;
  }

  public async onThemeChange(newTheme: string) {
    this.excalidrawData.scene.appState.theme = newTheme as "dark" | "light";
    await this.loadSceneFiles(true, undefined, undefined, undefined);
    this.toolsPanelRef?.current?.setTheme(newTheme as "dark" | "light");
    //Timeout is to allow appState to update
    window.setTimeout(() =>
      setDynamicStyle(
        this.plugin.ea,
        this,
        this.previousBackgroundColor,
        this.plugin.settings.dynamicStyling,
      ),
    );
  }

  //returns the raw text of the element which is the original text without parsing
  //in compatibility mode, returns the original text, and for backward compatibility the text if originalText is not available
  public onBeforeTextEdit(
    textElement: ExcalidrawTextElement,
    isExistingElement: boolean,
  ): string {
    /*const api = this.excalidrawAPI;
    const st = api.getAppState();
    setDynamicStyle(
      this.plugin.ea,
      this,
      st.viewBackgroundColor === "transparent" ? "white" : st.viewBackgroundColor,
      this.plugin.settings.dynamicStyling,
      api.getColorAtScenePoint({sceneX: this.currentPosition.x, sceneY: this.currentPosition.y})
    );*/
    if (!isExistingElement) {
      return;
    }
    window.clearTimeout(this.isEditingTextResetTimer);
    this.isEditingTextResetTimer = null;
    this.semaphores.isEditingText = true; //to prevent autoresize on mobile when keyboard pops up
    if (this.compatibilityMode) {
      return textElement.originalText ?? textElement.text;
    }
    const raw = this.excalidrawData.getRawText(textElement.id);
    if (!raw) {
      return textElement.rawText;
    }
    return raw;
  }

  public onBeforeTextSubmit(
    textElement: ExcalidrawTextElement,
    nextText: string,
    nextOriginalText: string,
    isDeleted: boolean,
  ): { updatedNextOriginalText: string; nextLink: string } {
    const api = this.excalidrawAPI;
    if (!api) {
      return {
        updatedNextOriginalText: null,
        nextLink: textElement?.link ?? null,
      };
    }

    // 1. Set the isEditingText flag to true to prevent autoresize on mobile
    // 1500ms is an empirical number, the on-screen keyboard usually disappears in 1-2 seconds
    this.semaphores.isEditingText = true;
    if (this.isEditingTextResetTimer) {
      window.clearTimeout(this.isEditingTextResetTimer);
    }
    this.isEditingTextResetTimer = window.setTimeout(() => {
      if (typeof this.semaphores?.isEditingText !== "undefined") {
        this.semaphores.isEditingText = false;
      }
      this.isEditingTextResetTimer = null;
    }, 1500);

    // 2. If the text element is deleted, remove it from ExcalidrawData
    //    parsed textElements cache
    if (isDeleted) {
      this.excalidrawData.deleteTextElement(textElement.id);
      this.setDirty();
      return { updatedNextOriginalText: null, nextLink: null };
    }

    // 3. Check if the user accidently pasted Excalidraw data from the clipboard
    //    as text. If so, update the parsed link in ExcalidrawData
    //    textElements cache and update the text element in the scene with a warning.
    const FORBIDDEN_TEXT = `{"type":"excalidraw/clipboard","elements":[{"`;
    const WARNING = t("WARNING_PASTING_ELEMENT_AS_TEXT");
    if (nextOriginalText.startsWith(FORBIDDEN_TEXT)) {
      window.setTimeout(() => {
        const elements =
          this.excalidrawAPI.getSceneElements() as Mutable<ExcalidrawElement>[];
        const el = elements.filter(
          (el: ExcalidrawElement) => el.id === textElement.id,
        );
        if (el.length === 1) {
          const clone = cloneElement(el[0]) as Mutable<ExcalidrawTextElement>;
          clone.rawText = WARNING;
          elements[elements.indexOf(el[0])] = clone;
          this.excalidrawData.setTextElement(clone.id, WARNING, () => {});
          this.updateScene({
            elements,
            captureUpdate: CaptureUpdateAction.NEVER,
          });
          api.history.clear();
        }
      });
      return { updatedNextOriginalText: WARNING, nextLink: null };
    }

    const containerId = textElement.containerId;

    // 4. Check if the text matches the transclusion pattern and if so,
    //    check if the link in the transclusion can be resolved to a file in the vault.
    //    If the link is an image or a PDF file, replace the text element with the image or the PDF.
    //    If the link is an embedded markdown file, then display a message, but otherwise transclude the text step 5.
    //                              1                              2
    if (
      isTextImageTransclusion(nextOriginalText, this, (link, file) => {
        window.setTimeout(() => {
          void (async () => {
            const elements =
              this.excalidrawAPI.getSceneElements() as Mutable<ExcalidrawElement>[];
            const el = elements.filter(
              (el: ExcalidrawElement) => el.id === textElement.id,
            ) as ExcalidrawTextElement[];
            if (el.length === 1) {
              const center = { x: el[0].x, y: el[0].y };
              const clone = cloneElement(el[0]);
              clone.isDeleted = true;
              this.excalidrawData.deleteTextElement(clone.id);
              elements[elements.indexOf(el[0])] = clone;
              this.updateScene({
                elements,
                captureUpdate: CaptureUpdateAction.NEVER,
              });
              const ea: ExcalidrawAutomate = getEA(this);
              if (IMAGE_TYPES.contains(file.extension)) {
                ea.selectElementsInView([
                  await insertImageToView(ea, center, file),
                ]);
                ea.destroy();
              } else if (file.extension !== "pdf") {
                ea.selectElementsInView([
                  await insertEmbeddableToView(ea, center, file, link),
                ]);
                ea.destroy();
              } else {
                const linkParts = getLinkParts(link);
                if (linkParts.page) {
                  const path = `${file.path}#${link.split("#")[1]}`;
                  ea.selectElementsInView([
                    await insertImageToView(ea, center, path),
                  ]);
                } else {
                  const modal = new UniversalInsertFileModal(this.plugin, this);
                  modal.open(file, center);
                }
              }
              this.setDirty();
            }
          })();
        });
      })
    ) {
      return { updatedNextOriginalText: null, nextLink: textElement.link };
    }

    // 5. Check if the user made changes to the text, or
    //    the text is missing from ExcalidrawData textElements cache (recently copy/pasted)
    if (
      nextOriginalText !== textElement.originalText ||
      !this.excalidrawData.getRawText(textElement.id)
    ) {
      //the user made changes to the text or the text is missing from Excalidraw Data (recently copy/pasted)
      //setTextElement will attempt a quick parse (without processing transclusions)
      this.setDirty();

      // setTextElement will invoke this callback function in case quick parse was not possible, the parsed text contains transclusions
      // in this case I need to update the scene asynchronously when parsing is complete
      const callback = (parsedText: string) => {
        //this callback function will only be invoked if quick parse fails, i.e. there is a transclusion in the raw text
        if (this.textMode === TextMode.raw) {
          return;
        }

        const elements =
          this.excalidrawAPI.getSceneElements() as Mutable<ExcalidrawElement>[];
        const elementsMap = arrayToMap(elements) as ElementsMap;
        const el = elements.filter(
          (el: ExcalidrawElement) => el.id === textElement.id,
        );
        if (el.length === 1 && el[0].type === "text") {
          const container = getContainerElement(el[0], elementsMap);
          const clone = cloneElement(el[0]) as Mutable<ExcalidrawTextElement>;
          if (!el[0]?.isDeleted) {
            const { text, x, y, width, height } = refreshTextDimensions(
              el[0],
              container,
              elementsMap,
              parsedText,
            );

            clone.x = x;
            clone.y = y;
            clone.width = width;
            clone.height = height;
            clone.originalText = parsedText;
            clone.text = text;
          }

          elements[elements.indexOf(el[0])] = clone;
          this.updateScene({
            elements,
            captureUpdate: CaptureUpdateAction.NEVER,
          });
          if (clone.containerId) {
            this.updateContainerSize(clone.containerId);
          }
          this.setDirty();
        }
        api.history.clear();
      };

      const [parseResultOriginal, link] = this.excalidrawData.setTextElement(
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
          return { updatedNextOriginalText: nextOriginalText, nextLink: link };
        } //text is displayed in raw, no need to clear the history, undo will not create problems
        if (nextOriginalText === parseResultOriginal) {
          if (link) {
            //don't forget the case: link-prefix:"" && link-brackets:true
            return {
              updatedNextOriginalText: parseResultOriginal,
              nextLink: link,
            };
          }
          return { updatedNextOriginalText: null, nextLink: textElement.link };
        } //There were no links to parse, raw text and parsed text are equivalent
        api.history.clear();
        return { updatedNextOriginalText: parseResultOriginal, nextLink: link };
      }
      return { updatedNextOriginalText: null, nextLink: textElement.link };
    }
    // even if the text did not change, container sizes might need to be updated
    if (containerId) {
      this.updateContainerSize(containerId, true);
    }
    const parseResultOriginal = this.excalidrawData.getParsedResult(
      textElement.id,
    );
    if (this.textMode === TextMode.parsed) {
      return {
        updatedNextOriginalText: parseResultOriginal.parsed,
        nextLink: this.plugin.settings.syncElementLinkWithText
          ? textElement.link
          : parseResultOriginal.hasTextLink
            ? textElement.rawText
            : null,
      };
    }
    return {
      updatedNextOriginalText: null,
      nextLink: this.plugin.settings.syncElementLinkWithText
        ? textElement.link
        : parseResultOriginal.hasTextLink
          ? textElement.rawText
          : null,
    };
  }

  public async onLinkOpen(
    element: ExcalidrawElement,
    e: ExcalidrawLinkOpenEvent,
  ): Promise<void> {
    e.preventDefault();
    if (!element) {
      return;
    }

    let textLink = "";
    //if element is type text and element has multiple links, then submit the element text to linkClick to trigger link suggester
    if (element.type === "text") {
      const linkText = element.rawText.replaceAll("\n", ""); //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/187
      const partsArray = REGEX_LINK.getResList(linkText);
      if (partsArray.filter((p) => Boolean(p.value)).length >= 1) {
        textLink = linkText;
      }
    }

    let link = `${element.link ?? ""} ${textLink}`;
    link = link.trim();
    if (!link) {
      return;
    }
    window.setTimeout(() => this.removeLinkTooltip(), 500);

    let event = e?.detail?.nativeEvent;
    if (this.handleLinkHookCall(element, link, event as MouseEvent)) {
      return;
    }
    //if(openExternalLink(element.link, this.app, !isSHIFT(event) && !isWinCTRLorMacCMD(event) && !isWinMETAorMacCTRL(event) && !isWinALTorMacOPT(event) ? element : undefined)) return;
    if (openExternalLink(link, this.app)) {
      return;
    }

    if (!event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
      void this.linkClick(
        null,
        null,
        null,
        { id: element.id, text: link },
        emulateKeysForLinkClick("new-tab"),
        true,
      );
      return;
    }

    void this.linkClick(
      event as MouseEvent,
      null,
      null,
      { id: element.id, text: link },
      undefined,
      true,
    );
  }

  public onLinkHover(
    element: NonDeletedExcalidrawElement,
    event: React.PointerEvent<HTMLCanvasElement>,
  ): void {
    if (
      element &&
      (this.plugin.settings.hoverPreviewWithoutCTRL || isWinCTRLorMacCMD(event))
    ) {
      this.lastMouseEvent = event;
      this.lastMouseEvent.ctrlKey =
        !(DEVICE.isIOS || DEVICE.isMacOS) || this.lastMouseEvent.ctrlKey;
      this.lastMouseEvent.metaKey =
        DEVICE.isIOS || DEVICE.isMacOS || this.lastMouseEvent.metaKey;
      let textLink = "";
      //if element is type text and element has multiple links, then submit the element text to linkClick to trigger link suggester
      if (element.type === "text") {
        const linkText = element.rawText.replaceAll("\n", ""); //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/187
        const partsArray = REGEX_LINK.getResList(linkText);
        if (partsArray.filter((p) => Boolean(p.value)).length >= 1) {
          textLink = linkText;
        }
      }

      const link = element.link ?? textLink; //in case of hover, if the user hovers the link indicator then the element link has priority
      if (!link) {
        return;
      }
      const linkMatch = link.match(/\[\[(?<link>.*?)\]\]/);
      if (linkMatch) {
        const linkText = linkMatch.groups.link;
        this.showHoverPreview(linkText, element);
      }
    }
  }

  public onViewModeChange(isViewModeEnabled: boolean) {
    if (!this.semaphores.viewunload) {
      this.toolsPanelRef?.current?.setExcalidrawViewMode(isViewModeEnabled);
    }
    if (this.getHookServer().onViewModeChangeHook) {
      try {
        this.getHookServer().onViewModeChangeHook(
          isViewModeEnabled,
          this,
          this.getHookServer(),
        );
      } catch (e) {
        errorlog({
          where: "ExcalidrawView.onViewModeChange",
          fn: "getHookServer().onViewModeChangeHook",
          error: e,
        });
      }
    }
  }

  public async getBackOfTheNoteSections() {
    return (
      await this.app.metadataCache.blockCache.getForFile(
        { isCancelled: () => false },
        this.file,
      )
    ).blocks
      .filter(
        (b: MarkdownBlockCacheEntry) => b.display && b.node?.type === "heading",
      )
      .filter(
        (b: MarkdownBlockCacheEntry) => !MD_EX_SECTIONS.includes(b.display),
      )
      .map((b: MarkdownBlockCacheEntry) => cleanSectionHeading(b.display));
  }

  private async getBackOfTheNoteBlocks() {
    return (
      await this.app.metadataCache.blockCache.getForFile(
        { isCancelled: () => false },
        this.file,
      )
    ).blocks
      .filter(
        (b: MarkdownBlockCacheEntry) =>
          b.display &&
          b.node &&
          Object.hasOwn(b.node ?? {}, "type") &&
          Object.hasOwn(b.node ?? {}, "id"),
      )
      .map((b: MarkdownBlockCacheEntry) => cleanBlockRef(b.node.id));
  }

  public getSingleSelectedImage(): {
    imageEl: ExcalidrawImageElement;
    embeddedFile: EmbeddedFile;
  } {
    if (!this.excalidrawAPI) {
      return null;
    }
    const els = this.getViewSelectedElements().filter(
      (el) => el.type === "image",
    );
    if (els.length !== 1) {
      return null;
    }
    const el = els[0];
    const imageFile = this.excalidrawData.getFile(el.fileId);
    return { imageEl: el, embeddedFile: imageFile };
  }

  public async insertBackOfTheNoteCard(center: boolean = false) {
    await this.forceSave(true);
    const sections = await this.getBackOfTheNoteSections();
    const selectCardDialog = new SelectCard(this.app, this, sections);
    selectCardDialog.start(center);
  }

  /** Opens an image by ID for editing, or inserts a new Markdown image. */
  public async openMarkdownImageEditor(elementId?: string): Promise<void> {
    await this.markdownImageController.openMarkdownImageEditor(elementId);
  }

  /** Converts a Markdown embeddable without changing its scene identity. */
  public async convertEmbeddableToMarkdownImage(
    elementId: string,
  ): Promise<void> {
    await this.markdownImageController.convertEmbeddableToMarkdownImage(
      elementId,
    );
  }

  /** Converts a Markdown image to an external or back-of-note embeddable. */
  public async convertMarkdownImageToEmbeddable(
    elementId: string,
  ): Promise<void> {
    await this.markdownImageController.convertMarkdownImageToEmbeddable(
      elementId,
    );
  }

  public async moveBackOfTheNoteCardToFile(id?: string) {
    id =
      id ??
      this.getViewSelectedElements().filter((el) => el.type === "embeddable")[0]
        ?.id;
    const embeddableData = this.getEmbeddableLeafElementById(id);
    const child = embeddableData?.node?.child;
    if (!child || child.file !== this.file) {
      return;
    }

    if (child.lastSavedData !== this.data) {
      await this.forceSave(true);
      if (child.lastSavedData !== this.data) {
        new Notice(t("ERROR_TRY_AGAIN"));
        return;
      }
    }
    const { folder } = await getAttachmentsFolderAndFilePath(
      this.app,
      this.file.path,
      "dummy",
    );
    const filepath = getNewUniqueFilepath(
      this.app.vault,
      child.subpath.replaceAll("#", ""),
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
    if (!path) {
      return;
    }
    if (!path.endsWith(".md")) {
      path += ".md";
    }
    const { folderpath, filename } = splitFolderAndFilename(path);
    path = getNewUniqueFilepath(this.app.vault, filename, folderpath);
    try {
      const newFile = await createOrOverwriteFile(this.app, path, child.text);
      if (!newFile) {
        new Notice("Unexpected error");
        return;
      }
      const ea = getEA(this);
      ea.copyViewElementsToEAforEditing([
        this.getViewElements().find((el) => el.id === id),
      ]);
      ea.getElement(id).link = `[[${newFile.path}]]`;
      this.data = this.data.split(child.heading + child.text).join("");
      await ea.addElementsToView(false);
      ea.destroy();
      await this.forceSave(true);
    } catch (e) {
      new Notice(`Unexpected error: ${e.message}`);
    }
  }

  public async pasteCodeBlock(data: string) {
    try {
      data = data.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
      const isCodeblock = Boolean(data.match(/^`{3}[^\n]*\n.+\n`{3}\s*$/ms));
      if (!isCodeblock) {
        const codeblockType = await GenericInputPrompt.Prompt(
          this,
          this.plugin,
          this.app,
          "type codeblock type",
          "javascript, html, python, etc.",
          "",
        );
        data = `\`\`\`${codeblockType.trim()}\n${data}\n\`\`\``;
      }
      let title = (
        await GenericInputPrompt.Prompt(
          this,
          this.plugin,
          this.app,
          "Code Block Title",
          "Enter title or leave empty for automatic title",
          "",
        )
      ).trim();
      if (title === "") {
        title = "Code Block";
      }
      const sections = await this.getBackOfTheNoteSections();
      if (sections.includes(title)) {
        let i = 0;
        while (sections.includes(`${title} ${++i}`)) {
          // no-op
        }
        title = `${title} ${i}`;
      }
      await addBackOfTheNoteCard(this, title, false, data);
    } catch (error) {
      console.error(
        "unexpected error in pasteCodeBlock",
        this.pasteCodeBlock.bind(this),
        error,
      );
    }
  }

  public async convertImageElWithURLToLocalFile(data: {
    imageEl: ExcalidrawImageElement;
    embeddedFile: EmbeddedFile;
  }) {
    const { imageEl, embeddedFile } = data;
    const imageDataURL = embeddedFile.getImage(false);
    if (!imageDataURL && !imageDataURL.startsWith("data:")) {
      new Notice("Image not found");
      return false;
    }
    const ea = getEA(this);
    ea.copyViewElementsToEAforEditing([imageEl]);
    const eaEl = ea.getElement(imageEl.id) as Mutable<ExcalidrawImageElement>;
    eaEl.fileId = fileid() as FileId;
    if (!eaEl.link) {
      eaEl.link = embeddedFile.hyperlink;
    }
    let dataURL = embeddedFile.getImage(false);
    if (!dataURL.startsWith("data:")) {
      new Notice(
        "Attempting to download image from URL. This may take a long while. The operation will time out after max 1 minute",
      );
      dataURL = await getDataURLFromURL(dataURL, embeddedFile.mimeType, 30000);
      if (!dataURL.startsWith("data:")) {
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
    const api = this.excalidrawAPI;
    api.addFiles(files);
    await ea.addElementsToView(false, true);
    ea.destroy();
    new Notice("Image successfully converted to local file");
  }

  public insertLinkAction(linkVal: string) {
    let link = linkVal.match(/\[\[(.*?)\]\]/)?.[1];
    if (!link) {
      link = linkVal.replaceAll("[", "").replaceAll("]", "");
      link = link.split("|")[0].trim();
    }
    this.plugin.insertLinkDialog.start(
      this.file.path,
      (markdownlink: string, path: string, alias: string) => {
        void this.addLink(markdownlink, path, alias, linkVal);
      },
      link,
    );
  }

  public onContextMenu(
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    onClose: (callback?: () => void) => void,
  ) {
    const React = this.packages.react;
    const contextMenuActions = [];
    const api = this.excalidrawAPI;
    const selectedElementIds = Object.keys(
      api.getAppState().selectedElementIds,
    );
    const areElementsSelected = selectedElementIds.length > 0;

    if (this.isLinkSelected()) {
      const isFormula =
        !this.getSelectedTextElement()?.id &&
        this.excalidrawData.hasEquation(this.getSelectedImageElement()?.fileId);
      contextMenuActions.push([
        renderContextMenuAction(
          React,
          isFormula ? t("EDIT_LATEX") : t("OPEN_LINK_CLICK"),
          () => {
            const event = emulateKeysForLinkClick("new-tab");
            void this.handleLinkClick(event, true);
          },
          onClose,
          isFormula ? "editFormula" : "openLink",
        ),
      ]);
    }

    if (!appState.viewModeEnabled) {
      const selectedMarkdownImage =
        this.getViewSelectedElements().length === 1 &&
        this.getViewSelectedElements()[0].type === "image" &&
        isMarkdownImageElement(
          this,
          this.getViewSelectedElements()[0] as ExcalidrawImageElement,
        )
          ? (this.getViewSelectedElements()[0] as ExcalidrawImageElement)
          : null;
      if (selectedMarkdownImage) {
        contextMenuActions.push([
          renderContextMenuAction(
            React,
            t("EDIT_MARKDOWN_IMAGE"),
            () => {
              void this.openMarkdownImageEditor(selectedMarkdownImage.id);
            },
            onClose,
            "editMarkdownImage",
          ),
        ]);
        contextMenuActions.push([
          renderContextMenuAction(
            React,
            t("CONVERT_MARKDOWN_IMAGE_TO_EMBEDDABLE"),
            () => {
              void this.convertMarkdownImageToEmbeddable(
                selectedMarkdownImage.id,
              );
            },
            onClose,
            "convertMarkdownImageToEmbeddable",
          ),
        ]);
      }

      const selectedTextElements = this.getViewSelectedElements().filter(
        (el) => el.type === "text",
      );
      if (selectedTextElements.length === 1) {
        const selectedTextElement = selectedTextElements[0];
        const containerElement = (
          this.getViewElements() as ExcalidrawElement[]
        ).find((el) => el.id === selectedTextElement.containerId);

        //if the text element in the container no longer has a link associated with it...
        if (
          containerElement &&
          selectedTextElement.link &&
          this.excalidrawData.getParsedText(selectedTextElement.id) ===
            selectedTextElement.rawText
        ) {
          contextMenuActions.push([
            renderContextMenuAction(
              React,
              t("REMOVE_LINK"),
              () => {
                void (async () => {
                  const ea = getEA(this);
                  ea.copyViewElementsToEAforEditing([selectedTextElement]);
                  const el = ea.getElement(
                    selectedTextElement.id,
                  ) as Mutable<ExcalidrawTextElement>;
                  el.link = null;
                  await ea.addElementsToView(false);
                  ea.destroy();
                })();
              },
              onClose,
              "removeLink",
            ),
          ]);
        }

        if (containerElement) {
          contextMenuActions.push([
            renderContextMenuAction(
              React,
              t("SELECT_TEXTELEMENT_ONLY"),
              () => {
                window.setTimeout(() =>
                  this.excalidrawAPI.selectElements([selectedTextElement]),
                );
              },
              onClose,
              "selectTextWithoutContainer",
            ),
          ]);
        }

        if (
          !containerElement ||
          (containerElement && containerElement.type !== "arrow")
        ) {
          contextMenuActions.push([
            renderContextMenuAction(
              React,
              t("CONVERT_TO_MARKDOWN"),
              () => {
                this.convertTextElementToMarkdown(
                  selectedTextElement,
                  containerElement,
                );
              },
              onClose,
              "convertToMarkdown",
            ),
          ]);
        }
      }

      const img = this.getSingleSelectedImage();
      if (img?.embeddedFile?.isHyperLink) {
        contextMenuActions.push([
          renderContextMenuAction(
            React,
            t("CONVERT_URL_TO_FILE"),
            () => {
              window.setTimeout(() => {
                void this.convertImageElWithURLToLocalFile(img);
              });
            },
            onClose,
            "convertImgUrlToFile",
          ),
        ]);
      }

      if (
        img?.embeddedFile?.mimeType === "image/svg+xml" &&
        (!img.embeddedFile.file ||
          (img.embeddedFile.file &&
            !this.plugin.isExcalidrawFile(img.embeddedFile.file)))
      ) {
        contextMenuActions.push([
          renderContextMenuAction(
            React,
            t("IMPORT_SVG_CONTEXTMENU"),
            () => {
              void (async () => {
                const base64Content = img.embeddedFile
                  .getImage(false)
                  .split(",")[1];
                // Decoding the base64 content
                const svg = atob(base64Content);
                if (!svg || svg === "") {
                  return;
                }
                const ea = getEA(this);
                ea.importSVG(svg);
                ea.addToGroup(ea.getElements().map((el) => el.id));
                await ea.addElementsToView(true, true, true, true);
                ea.destroy();
              })();
            },
            onClose,
            "convertSvgToStrokes",
          ),
        ]);
      }

      const selectedImages = this.getViewSelectedElements().filter(
        (el) => el.type === "image",
      );
      if (selectedImages.length > 0) {
        type ImageType = "svg" | "pdf" | "bitmap" | "excalidraw";

        const getImageType = (
          imageEl: ExcalidrawImageElement,
          embeddedFile?: EmbeddedFile,
        ): ImageType | null => {
          if (isMarkdownImageElement(this, imageEl)) {
            return "svg";
          }
          if (!embeddedFile) {
            return null;
          }
          if (
            embeddedFile.file &&
            this.plugin.isExcalidrawFile(embeddedFile.file)
          ) {
            return "excalidraw";
          }
          if (
            embeddedFile.file?.extension?.toLowerCase?.() === "pdf" ||
            !!embeddedFile.pdfPageViewProps
          ) {
            return "pdf";
          }
          if (embeddedFile.mimeType === "image/svg+xml") {
            return "svg";
          }
          return "bitmap";
        };

        const getInvertInDarkMode = (
          imageEl: ExcalidrawImageElement,
          imageType: ImageType,
        ): boolean => {
          const invertBitmap = imageEl.customData?.invertBitmapInDarkmode;
          switch (imageType) {
            case "svg":
            case "excalidraw":
              return !imageEl.customData?.doNotInvertSVGInDarkMode;
            case "pdf":
              return invertBitmap ?? true;
          }
          return invertBitmap ?? false;
        };

        const imageMenuState = (() => {
          const ea = getEA(this);
          try {
            const imagesWithStatus = selectedImages
              .map((el) => {
                const embeddedFile = this.excalidrawData.getFile(el.fileId);
                const imageType = getImageType(el, embeddedFile);
                if (!imageType) {
                  return null;
                }
                return {
                  el,
                  imageType,
                  invertInDarkMode: getInvertInDarkMode(el, imageType),
                };
              })
              .filter(Boolean) as {
              el: ExcalidrawImageElement;
              imageType: ImageType;
              invertInDarkMode: boolean;
            }[];
            if (imagesWithStatus.length === 0) {
              return null;
            }
            const reference = imagesWithStatus[0].invertInDarkMode;
            if (
              !imagesWithStatus.every(
                (img) => img.invertInDarkMode === reference,
              )
            ) {
              return null;
            }
            return { imagesWithStatus, invertInDarkMode: reference };
          } finally {
            ea.destroy();
          }
        })();

        if (imageMenuState) {
          const { imagesWithStatus, invertInDarkMode } = imageMenuState;
          const newInvertState = !invertInDarkMode;
          contextMenuActions.push([
            renderContextMenuAction(
              React,
              t("INVERT_IMAGES_IN_DARK_MODE"),
              () => {
                void (async () => {
                  const ea = getEA(this);
                  ea.copyViewElementsToEAforEditing(
                    imagesWithStatus.map((img) => img.el),
                  );
                  imagesWithStatus.forEach((img) => {
                    const editableEl = ea.getElement(
                      img.el.id,
                    ) as Mutable<ExcalidrawImageElement>;
                    const embeddedFile = this.excalidrawData.getFile(
                      editableEl.fileId,
                    );
                    const imageType =
                      getImageType(editableEl, embeddedFile) ?? img.imageType;
                    if (imageType === "svg" || imageType === "excalidraw") {
                      const isMarkdownImage = isMarkdownImageElement(
                        this,
                        editableEl,
                      );
                      addAppendUpdateCustomData(editableEl, {
                        doNotInvertSVGInDarkMode: isMarkdownImage
                          ? !newInvertState
                          : newInvertState
                            ? undefined
                            : true,
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
                })();
              },
              onClose,
              "invertImageInDarkmode",
              invertInDarkMode,
            ),
          ]);
        }
      }

      if (areElementsSelected) {
        contextMenuActions.push([
          renderContextMenuAction(
            React,
            t("COPY_ELEMENT_LINK"),
            () => this.copyLinkToSelectedElementToClipboard(""),
            onClose,
            "copyElementLink",
          ),
        ]);
      } else {
        contextMenuActions.push([
          renderContextMenuAction(
            React,
            t("COPY_DRAWING_LINK"),
            () => {
              const path = this.file.path.match(/(.*)(\.md)$/)?.[1];
              void navigator.clipboard.writeText(
                `![[${path ?? this.file.path}]]`,
              );
            },
            onClose,
            "copyDrawingLink",
          ),
        ]);
      }

      if (
        this.getViewSelectedElements().filter((el) => el.type === "embeddable")
          .length === 1
      ) {
        const embeddableData = this.getEmbeddableLeafElementById(
          this.getViewSelectedElements().find((el) => el.type === "embeddable")
            .id,
        );
        if (embeddableData?.node?.child?.file === this.file) {
          contextMenuActions.push([
            renderContextMenuAction(
              React,
              t("CONVERT_CARD_TO_FILE"),
              () => {
                void this.moveBackOfTheNoteCardToFile();
              },
              onClose,
              "convertCardToFile",
            ),
          ]);
        }
      }

      contextMenuActions.push([
        renderContextMenuAction(
          React,
          t("INSERT_MARKDOWN_IMAGE"),
          () => {
            void this.openMarkdownImageEditor();
          },
          onClose,
          "insertMarkdownImage",
        ),
      ]);
      contextMenuActions.push([
        renderContextMenuAction(
          React,
          t("INSERT_CARD"),
          () => {
            void this.insertBackOfTheNoteCard();
          },
          onClose,
          "insertCard",
        ),
      ]);
      contextMenuActions.push([
        renderContextMenuAction(
          React,
          t("UNIVERSAL_ADD_FILE"),
          () => {
            const insertFileModal = new UniversalInsertFileModal(
              this.plugin,
              this,
            );
            insertFileModal.open();
          },
          onClose,
          "insertAnyFile",
        ),
      ]);
      if (DEVICE.isTablet || DEVICE.isMobile) {
        contextMenuActions.push([
          renderContextMenuAction(
            React,
            t("INSERT_LINK"),
            () => {
              this.plugin.insertLinkDialog.start(
                this.file.path,
                (markdownlink: string, path: string, alias: string) => {
                  void this.addLink(markdownlink, path, alias);
                },
              );
            },
            onClose,
            "insertLinkToFile",
          ),
          // Add more context menu actions here if needed
        ]);
      }
      contextMenuActions.push([
        renderContextMenuAction(
          React,
          t("PASTE_CODEBLOCK"),
          () => {
            void (async () => {
              const data = await navigator.clipboard?.readText();
              if (!data || data.trim() === "") {
                return;
              }
              void this.pasteCodeBlock(data);
            })();
          },
          onClose,
          "pasteCodeblock",
        ),
      ]);

      if (!areElementsSelected) {
        const { frameRendering } = appState;
        const enabled =
          frameRendering.markerEnabled &&
          frameRendering.enabled &&
          frameRendering.outline;
        contextMenuActions.push([
          renderContextMenuAction(
            React,
            t("MARKER_FRAME_SHOW"),
            () => {
              window.setTimeout(() =>
                this.updateScene({
                  appState: {
                    frameRendering: {
                      ...frameRendering,
                      ...(enabled ? {} : { enabled: true, outline: true }),
                      markerEnabled: !enabled,
                    },
                  },
                  captureUpdate: CaptureUpdateAction.NEVER,
                }),
              );
            },
            onClose,
            "toggleMarkerFrames",
            enabled,
          ),
        ]);
        if (
          frameRendering.markerEnabled &&
          frameRendering.enabled &&
          frameRendering.outline
        ) {
          contextMenuActions.push([
            renderContextMenuAction(
              React,
              t("MARKER_FRAME_TITLE_SHOW"),
              () => {
                window.setTimeout(() =>
                  this.updateScene({
                    appState: {
                      frameRendering: {
                        ...frameRendering,
                        markerName: !frameRendering.markerName,
                      },
                    },
                    captureUpdate: CaptureUpdateAction.NEVER,
                  }),
                );
              },
              onClose,
              "toggleMarkerFrameTitles",
              frameRendering.markerName,
            ),
          ]);
        }
      }
    }

    if (contextMenuActions.length === 0) {
      return;
    }
    return React.createElement(
      React.Fragment,
      {},
      ...contextMenuActions,
      React.createElement("hr", {
        key: nanoid(),
        className: "context-menu-item-separator",
      }),
    );
  }

  private actionOpenScriptInstallPrompt() {
    new ScriptInstallPrompt(this.plugin).open();
  }

  private actionOpenExportImageDialog() {
    if (!this.exportDialog) {
      this.exportDialog = new ExportDialog(this.plugin, this, this.file);
    }
    this.exportDialog.open();
  }

  public setExcalidrawAPI(api: ExcalidrawImperativeAPI | null) {
    this.excalidrawAPI = api;
    // Chasing ghosts: https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2810
    if (!api || this.pendingUIMode === null) {
      return;
    }
    api.setDesktopUIMode(this.pendingUIMode);
    this.pendingUIMode = null;
  }

  private clearExcalidrawInitializeTimer(): void {
    if (this.excalidrawInitializeTimer !== null) {
      window.clearTimeout(this.excalidrawInitializeTimer);
      this.excalidrawInitializeTimer = null;
    }
  }

  public onExcalidrawInitialize(api: ExcalidrawImperativeAPI) {
    // Ensure we keep the latest editor API reference before running scene-dependent setup.
    this.clearExcalidrawInitializeTimer();
    this.setExcalidrawAPI(api);
    const activeLeafMatches =
      this.app.workspace.getMostRecentLeaf() === this.leaf;
    const replacementLeafMatches =
      this.plugin.activeExcalidrawView?.leaf === this.leaf;
    if (activeLeafMatches || replacementLeafMatches) {
      // Rebuilding a view in the same leaf during window migration may not emit
      // active-leaf-change. Refresh the plugin's active instance and bind its
      // modal observer from the live destination document.
      this.plugin.activeExcalidrawView = this;
      this.plugin.addModalContainerObserver(this);
    }
    this.excalidrawInitializeTimer = window.setTimeout(() => {
      this.excalidrawInitializeTimer = null;
      // window migration scenario
      if (
        !this.plugin ||
        this.excalidrawAPI !== api ||
        api.isDestroyed ||
        this.semaphores?.windowMigrating ||
        this.semaphores?.viewunload
      ) {
        return;
      }
      this.onAfterLoadScene(true);
      this.excalidrawContainer?.focus();
    });
  }

  public ttdDialog() {
    return this.excalidrawExtensionRenderer.ttdDialog();
  }

  public diagramToCode() {
    return this.excalidrawExtensionRenderer.diagramToCode();
  }

  public ttdDialogTrigger() {
    return this.excalidrawExtensionRenderer.ttdDialogTrigger();
  }

  public renderWelcomeScreen() {
    return this.excalidrawExtensionRenderer.renderWelcomeScreen();
  }

  public renderCustomActionsMenu() {
    return this.excalidrawExtensionRenderer.renderCustomActionsMenu();
  }

  public renderEmbeddable(
    element: ExcalidrawEmbeddableElement,
    appState: UIAppState,
  ) {
    return this.excalidrawExtensionRenderer.renderEmbeddable(element, appState);
  }

  public renderEmbeddableMenu(appState: AppState) {
    return this.embeddableMenu?.renderButtons(appState);
  }

  public renderToolsPanel(observer: React.RefObject<ResizeObserver>) {
    const React = this.packages.react;

    return React.createElement(ToolsPanel, {
      ref: this.toolsPanelRef,
      visible: false,
      view: new WeakRef(this),
      centerPointer: () => this.setCurrentPositionToCenter(),
      observer: new WeakRef(observer.current),
    });
  }

  public renderTopRightUI(isMobile: boolean, appState: AppState) {
    if (!this.excalidrawAPI || !this.semaphores.viewloaded || !this.isLoaded) {
      return null;
    }
    if (this.excalidrawAPI.getAppState().isLoading) {
      return null;
    }
    return this.obsidianMenu?.renderButton(isMobile, appState);
  }

  private scheduleBatchedResize(currentDeltaHeight: number) {
    const api = this.excalidrawAPI;
    if (!api || !api.isTouchScreen) {
      return;
    }

    if (!this.resizeBatchTimer) {
      this.lastAggregatedDh = 0;
      this.resizeBatchWindowStart = Date.now();
    }

    this.lastAggregatedDh += currentDeltaHeight;

    if (this.resizeBatchTimer) {
      window.clearTimeout(this.resizeBatchTimer);
    }

    const elapsed = Date.now() - this.resizeBatchWindowStart;
    const absoluteDelta = Math.abs(this.lastAggregatedDh);
    const deltaExceeded = absoluteDelta >= 80; // lower threshold to catch multi-step keyboards
    const windowExceeded = elapsed > 2000; // hard stop if the keyboard resizes in many tiny steps
    const debounceDelay = deltaExceeded ? 60 : 200; // short delay once we see large movement
    const finalDelay = windowExceeded ? 0 : debounceDelay;

    this.resizeBatchTimer = window.setTimeout(() => {
      const dh = this.lastAggregatedDh;
      this.resizeBatchTimer = null;
      this.lastAggregatedDh = 0;
      this.resizeBatchWindowStart = 0;

      if (Math.abs(dh) > 60) {
        // slightly lower than previous 120 to react earlier
        this.onExcalidrawResize();
      }
    }, finalDelay);
  }

  private onExcalidrawResize() {
    try {
      const api = this.excalidrawAPI;
      if (!api) {
        return;
      }
      const width = this.contentEl.clientWidth;
      const height = this.contentEl.clientHeight;
      if (width === 0 || height === 0) {
        return;
      }

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
      const isEventOnSameElement =
        this.editingTextElementId === st.editingTextElement?.id;
      const isKeyboardOutEvent =
        !!st.editingTextElement && !isEventOnSameElement;
      const isKeyboardBackEvent =
        (this.semaphores.isEditingText || isEventOnSameElement) &&
        !isKeyboardOutEvent;
      this.editingTextElementId = isKeyboardOutEvent
        ? st.editingTextElement.id
        : null;

      if (isKeyboardOutEvent) {
        const elTop = st.editingTextElement.y;
        const elHeight = st.editingTextElement.height ?? 0;
        const elCenterY = elTop + elHeight / 2;

        const visibleHeight = st.height / st.zoom.value;
        // visibleTop is -scrollY in scene coords
        const visibleTop = -st.scrollY;
        const topThreeQuarterThreshold = visibleTop + visibleHeight * 0.75;

        // If the editing text element is in the top 3/4 of the visible screen, do not change scroll
        if (
          !(elCenterY >= visibleTop && elCenterY <= topThreeQuarterThreshold)
        ) {
          // Otherwise, vertically center the editing text element in the visible area
          const desiredVisibleTop = elCenterY - visibleHeight / 2;
          const newScrollY = -desiredVisibleTop;

          this.oldKeyboardScroll = { scrollY: st.scrollY, scrollX: st.scrollX };
          this.updateScene({
            appState: { scrollY: newScrollY },
            captureUpdate: CaptureUpdateAction.NEVER,
          });
        }

        this.containerEl.scrollIntoView();
      }
      if (isKeyboardBackEvent) {
        if (this.oldKeyboardScroll != null) {
          // Restore only vertical scroll; remove horizontal scroll completely
          this.updateScene({
            appState: { scrollY: this.oldKeyboardScroll.scrollY },
            captureUpdate: CaptureUpdateAction.NEVER,
          });
          this.oldKeyboardScroll = null;
          this.containerEl.scrollIntoView();
        }
      }
      //end of aweful hack

      if (this.toolsPanelRef && this.toolsPanelRef.current) {
        this.toolsPanelRef.current.updatePosition();
      }
      if (this.ownerDocument !== mainDocument) {
        this.refreshCanvasOffset(); //because resizeobserver in Excalidraw does not seem to work when in Obsidian Window
      }
    } catch (err) {
      errorlog({
        where: "Excalidraw React-Wrapper, onResize",
        error: err,
      });
    }
  }

  private async instantiateExcalidraw(initdata: ExcalidrawInitialDataState) {
    await this.plugin.awaitInit();
    let counter = 0;
    while (!this.semaphores.scriptsReady && counter++ < 20) {
      await sleep(50);
    }
    this.contentEl.empty();
    const React = this.packages.react;
    const ReactDOM = this.packages.reactDOM;
    this.clearDirty();

    // apply the handedness, settings were just reloaded in the calling method.
    this.setHandedness(this.plugin.settings.isLeftHanded);

    this.excalidrawRoot = ReactDOM.createRoot(this.contentEl);
    this.excalidrawRoot.render(
      React.createElement(
        createExcalidrawRootElement.bind(null, this, initdata),
      ),
    );
  }

  private updateContainerSize(
    containerId?: string,
    delay: boolean = false,
    justloaded: boolean = false,
  ) {
    const api = this.excalidrawAPI;
    if (!api) {
      return;
    }
    const update = () => {
      const containers = containerId
        ? api
            .getSceneElements()
            .filter(
              (el: ExcalidrawElement) =>
                el.id === containerId && el.type !== "arrow",
            )
        : api.getSceneElements().filter(isContainer);
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
    //view is closing via onWindowMigrated
    if (this.semaphores?.viewunload) {
      return;
    }
    const modalContainer = mainDocument.body.querySelector(
      "div.modal-container",
    );
    if (modalContainer) {
      return;
    } //do not autozoom when the command palette or other modal container is envoked on iPad
    const api = this.excalidrawAPI;
    if (
      !api ||
      this.semaphores.isEditingText ||
      this.semaphores.preventAutozoom
    ) {
      return;
    }
    if (windowMigratedDisableZoomOnce) {
      windowMigratedDisableZoomOnce = false;
      return;
    }
    const maxZoom = this.plugin.settings.zoomToFitMaxLevel;
    const elements = api
      .getSceneElements()
      .filter((el: ExcalidrawElement) => el.width < 10000 && el.height < 10000);
    if ((DEVICE.isMobile && elements.length > 1000) || elements.length > 2500) {
      if (justLoaded) {
        api.setViewport({ target: elements, fit: "contain" });
      }
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
    const api = this.excalidrawAPI;
    if (!api) {
      return false;
    }
    api.updateScene({
      appState: { pinnedScripts: this.plugin.settings.pinnedScripts },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }

  public updatePinnedCustomPens() {
    const api = this.excalidrawAPI;
    if (!api) {
      return false;
    }
    this.obsidianMenu?.invalidateCustomPenCache();
    api.updateScene({
      appState: {
        customPens: this.plugin.settings.customPens.slice(
          0,
          this.plugin.settings.numberOfCustomPens,
        ),
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }

  public updatePinchZoom() {
    const api = this.excalidrawAPI;
    if (!api) {
      return false;
    }
    api.updateScene({
      appState: { allowPinchZoom: this.plugin.settings.allowPinchZoom },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }

  public updateWheelZoom() {
    const api = this.excalidrawAPI;
    if (!api) {
      return false;
    }
    api.updateScene({
      appState: { allowWheelZoom: this.plugin.settings.allowWheelZoom },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }

  public toggleEnableContextMenu() {
    const api = this.excalidrawAPI;
    if (!api) {
      return;
    }
    const disableContextMenu = api.getAppState().disableContextMenu;
    this.updateScene({
      appState: { disableContextMenu: !disableContextMenu },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }

  public setUIMode(mode: UIMode) {
    const api = this.excalidrawAPI;
    if (!api) {
      this.pendingUIMode = mode;
      return;
    }
    api.setDesktopUIMode(mode);
    this.pendingUIMode = null;
  }

  /**
   * Applies the desired handedness to this `ExcalidrawView`.
   * @param isLeftHanded - the desired handedness
   */
  public setHandedness(isLeftHanded: boolean) {
    this.contentEl.toggleClass("excalidraw-left-handed", isLeftHanded);
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
  ): boolean {
    let match = getTextElementsMatchingQuery(
      elements.filter((el: ExcalidrawElement) => el.type === "text"),
      query,
      exactMatch,
    )
      .concat(
        getFrameElementsMatchingQuery(
          elements.filter((el: ExcalidrawElement) => el.type === "frame"),
          query,
          exactMatch,
        ),
      )
      .concat(
        getElementsWithLinkMatchingQuery(
          elements.filter((el: ExcalidrawElement) => el.link),
          query,
          exactMatch,
        ),
      )
      .concat(
        getImagesMatchingQuery(
          elements,
          query,
          this.excalidrawData,
          exactMatch,
        ),
      );

    if (match.length === 0) {
      new Notice(t("NO_SEARCH_RESULT"));
      return false;
    }

    if (selectGroup) {
      const groupElements = this.plugin.ea.getElementsInTheSameGroupWithElement(
        match[0],
        elements,
      );
      if (groupElements.length > 0) {
        match = groupElements;
      }
    }

    this.zoomToElements(selectResult, match);
    return true;
  }

  public zoomToElements(
    selectResult: boolean,
    elements: ExcalidrawElement[],
    margin: number = 0.05,
  ) {
    const api = this.excalidrawAPI;
    if (!api) {
      return;
    }

    const nonDeletedElements = elements.filter(
      (el): el is NonDeletedExcalidrawElement => !el.isDeleted,
    );
    if (nonDeletedElements.length === 0) {
      return;
    }

    const zoomLevel = this.plugin.settings.zoomToFitMaxLevel;
    if (selectResult) {
      api.selectElements(nonDeletedElements, true);
    }
    api.zoomToFit(nonDeletedElements, zoomLevel, margin);
  }

  public getViewElements(): readonly ExcalidrawElement[] {
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
  public getViewSelectedElements(
    includFrameChildren: boolean = true,
  ): ExcalidrawElement[] {
    const api = this.excalidrawAPI;
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
      .filter((e) => selectedElementsKeys.includes(e.id));

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

    if (includFrameChildren && elements.some((el) => el.type === "frame")) {
      elements
        .filter((el) => el.type === "frame")
        .forEach((frameEl) => {
          api
            .getSceneElements()
            .filter((el) => el.frameId === frameEl.id)
            .forEach((el) => elementIDs.add(el.id));
        });
    }

    elements.forEach((el) => elementIDs.add(el.id));
    containerBoundTextElmenetsReferencedInElements.forEach((id) =>
      elementIDs.add(id),
    );

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
    void copyLinkToSelectedElementToClipboard(this, prefix);
  }

  public updateScene(
    scene: ExcalidrawViewUpdateScene,
    shouldRestore: boolean = false,
  ) {
    const api = this.excalidrawAPI;
    if (!api) {
      return;
    }

    if (typeof scene.storeAction === "string") {
      switch (scene.storeAction) {
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
      scene.elements = restoreElements(scene.elements, null, {
        refreshDimensions: true,
        repairBindings: true,
      });
    }
    if (scene.appState) {
      scene.forceFlushSync = true;
    }
    if (scene.elements) {
      scene.elements = syncInvalidIndices(scene.elements);
    }
    try {
      api.updateScene(scene as Parameters<typeof api.updateScene>[0]);
    } catch (e) {
      errorlog({
        where: "ExcalidrawView.updateScene 1st attempt",
        fn: "updateScene",
        error: e,
        scene,
        willDoSecondAttempt: !shouldRestoreElements,
      });
      if (!shouldRestoreElements) {
        //second attempt
        try {
          scene.elements = restoreElements(scene.elements, null, {
            refreshDimensions: true,
            repairBindings: true,
          });
          api.updateScene(scene as Parameters<typeof api.updateScene>[0]);
        } catch (e) {
          errorlog({
            where: "ExcalidrawView.updateScene 2nd attempt",
            fn: "updateScene",
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
    if (ref) {
      this.embeddableRefs.set(elementId, ref);
    } else {
      this.embeddableRefs.delete(elementId);
    }
  }

  public getEmbeddableElementById(
    id: string,
  ): HTMLIFrameElement | HTMLWebViewElement | undefined {
    return this.embeddableRefs.get(id);
  }

  public updateEmbeddableLeafRef(elementId: string, ref?: EmbeddableLeafRef) {
    if (ref) {
      this.embeddableLeafRefs.set(elementId, ref);
    } else {
      this.embeddableLeafRefs.delete(elementId);
    }
  }

  public getEmbeddableLeafElementById(id: string): EmbeddableLeafRef | null {
    if (!id) {
      return null;
    }
    const ref = this.embeddableLeafRefs.get(id);
    if (!ref) {
      return null;
    }
    return ref;
  }

  public getActiveEmbeddable(): EmbeddableLeafRef | null {
    if (!this.excalidrawAPI) {
      return null;
    }
    const api = this.excalidrawAPI;
    const st = api.getAppState();
    if (!st.activeEmbeddable || st.activeEmbeddable.state !== "active") {
      return null;
    }
    return this.getEmbeddableLeafElementById(st.activeEmbeddable?.element?.id);
  }

  get editor(): Editor | null {
    const embeddable = this.getActiveEmbeddable();
    if (embeddable) {
      if (embeddable.node && embeddable.node.isEditing) {
        return embeddable.node.child.editor;
      }
      if (embeddable.leaf?.view instanceof MarkdownView) {
        return embeddable.leaf.view.editor;
      }
    }
    return null;
  }
}
