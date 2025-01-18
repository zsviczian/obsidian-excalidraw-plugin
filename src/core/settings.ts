import {
  App,
  ButtonComponent,
  DropdownComponent,
  getIcon,
  Modifier,
  normalizePath,
  PluginSettingTab,
  Setting,
  TextComponent,
  TFile,
} from "obsidian";
import { GITHUB_RELEASES, setRootElementSize } from "src/constants/constants";
import { t } from "src/lang/helpers";
import type ExcalidrawPlugin from "src/core/main";
import { PenStyle } from "src/types/penTypes";
import { DynamicStyle, GridSettings } from "src/types/types";
import { PreviewImageType } from "src/types/utilTypes";
import { setDynamicStyle } from "src/utils/dynamicStyling";
import {
  getDrawingFilename,
  getEmbedFilename,
} from "src/utils/fileUtils";
import { PENS } from "src/utils/pens";
import {
  addIframe,
  fragWithHTML,
  setLeftHandedMode,
} from "src/utils/utils";
import { imageCache } from "src/shared/ImageCache";
import { ConfirmationPrompt } from "src/shared/Dialogs/Prompt";
import { EmbeddableMDCustomProps } from "src/shared/Dialogs/EmbeddableSettings";
import { EmbeddalbeMDFileCustomDataSettingsComponent } from "src/shared/Dialogs/EmbeddableMDFileCustomDataSettingsComponent";
import { startupScript } from "src/constants/starutpscript";
import { ModifierKeySet, ModifierSetType } from "src/utils/modifierkeyHelper";
import { ModifierKeySettingsComponent } from "src/shared/Dialogs/ModifierKeySettings";
import { ANNOTATED_PREFIX, CROPPED_PREFIX } from "src/utils/carveout";
import { EDITOR_FADEOUT } from "src/core/editor/EditorHandler";
import { setDebugging } from "src/utils/debugHelper";
import { Rank } from "src/constants/actionIcons";
import { TAG_AUTOEXPORT, TAG_MDREADINGMODE, TAG_PDFEXPORT } from "src/constants/constSettingsTags";
import { HotkeyEditor } from "src/shared/Dialogs/HotkeyEditor";
import { getExcalidrawViews } from "src/utils/obsidianUtils";
import { createSliderWithText } from "src/utils/sliderUtils";
import { PDFExportSettingsComponent, PDFExportSettings } from "src/shared/Dialogs/PDFExportSettingsComponent";

export interface ExcalidrawSettings {
  folder: string;
  cropFolder: string;
  annotateFolder: string;
  embedUseExcalidrawFolder: boolean;
  templateFilePath: string;
  scriptFolderPath: string;
  fontAssetsPath: string;
  loadChineseFonts: boolean;
  loadJapaneseFonts: boolean;
  loadKoreanFonts: boolean;
  compress: boolean;
  decompressForMDView: boolean;
  onceOffCompressFlagReset: boolean; //used to reset compress to true in 2.2.0
  onceOffGPTVersionReset: boolean; //used to reset GPT version in 2.2.11
  autosave: boolean;
  autosaveIntervalDesktop: number;
  autosaveIntervalMobile: number;
  drawingFilenamePrefix: string;
  drawingEmbedPrefixWithFilename: boolean;
  drawingFilnameEmbedPostfix: string;
  drawingFilenameDateTime: string;
  useExcalidrawExtension: boolean;
  cropPrefix: string;
  annotatePrefix: string;
  annotatePreserveSize: boolean;
  displaySVGInPreview: boolean; //No longer used since 1.9.13
  previewImageType: PreviewImageType; //Introduced with 1.9.13
  renderingConcurrency: number;
  allowImageCache: boolean;
  allowImageCacheInScene: boolean;
  displayExportedImageIfAvailable: boolean;
  previewMatchObsidianTheme: boolean;
  width: string;
  height: string;
  overrideObsidianFontSize: boolean;
  dynamicStyling: DynamicStyle;
  isLeftHanded: boolean;
  iframeMatchExcalidrawTheme: boolean;
  matchTheme: boolean;
  matchThemeAlways: boolean;
  matchThemeTrigger: boolean;
  defaultMode: string;
  defaultPenMode: "never" | "mobile" | "always";
  penModeDoubleTapEraser: boolean;
  penModeSingleFingerPanning: boolean;
  penModeCrosshairVisible: boolean;
  renderImageInMarkdownReadingMode: boolean,
  renderImageInHoverPreviewForMDNotes: boolean,
  renderImageInMarkdownToPDF: boolean,
  allowPinchZoom: boolean;
  allowWheelZoom: boolean;
  zoomToFitOnOpen: boolean;
  zoomToFitOnResize: boolean;
  zoomToFitMaxLevel: number;
  openInAdjacentPane: boolean;
  showSecondOrderLinks: boolean;
  focusOnFileTab: boolean;
  openInMainWorkspace: boolean;
  showLinkBrackets: boolean;
  linkPrefix: string;
  urlPrefix: string;
  parseTODO: boolean;
  todo: string;
  done: string;
  hoverPreviewWithoutCTRL: boolean;
  linkOpacity: number;
  allowCtrlClick: boolean; //if disabled only the link button in the view header will open links
  forceWrap: boolean;
  pageTransclusionCharLimit: number;
  wordWrappingDefault: number;
  removeTransclusionQuoteSigns: boolean;
  iframelyAllowed: boolean;
  pngExportScale: number;
  exportWithTheme: boolean;
  exportWithBackground: boolean;
  exportPaddingSVG: number;
  exportEmbedScene: boolean;
  keepInSync: boolean;
  autoexportSVG: boolean;
  autoexportPNG: boolean;
  autoExportLightAndDark: boolean;
  autoexportExcalidraw: boolean;
  embedType: "excalidraw" | "PNG" | "SVG";
  embedMarkdownCommentLinks: boolean;
  embedWikiLink: boolean;
  syncExcalidraw: boolean;
  compatibilityMode: boolean;
  experimentalFileType: boolean;
  experimentalFileTag: string;
  experimentalLivePreview: boolean;
  fadeOutExcalidrawMarkup: boolean;
  loadPropertySuggestions: boolean;
  experimentalEnableFourthFont: boolean;
  experimantalFourthFont: string;
  addDummyTextElement: boolean;
  zoteroCompatibility: boolean;
  fieldSuggester: boolean;
  //loadCount: number; //version 1.2 migration counter
  drawingOpenCount: number;
  library: string;
  library2: {};
  //patchCommentBlock: boolean; //1.3.12
  imageElementNotice: boolean; //1.4.0
  //runWYSIWYGpatch: boolean; //1.4.9
  //fixInfinitePreviewLoop: boolean; //1.4.10
  mdSVGwidth: number;
  mdSVGmaxHeight: number;
  mdFont: string;
  mdFontColor: string;
  mdBorderColor: string;
  mdCSS: string;
  scriptEngineSettings: {
    [key:string]: {
      [key:string]: {
        value?:string,
        hidden?: boolean,
        description?: string,
        valueset?: string[],
        height?: number,
      }
    }
  };
  defaultTrayMode: boolean;
  previousRelease: string;
  showReleaseNotes: boolean;
  showNewVersionNotification: boolean;
  //mathjaxSourceURL: string;
  latexBoilerplate: string;
  taskboneEnabled: boolean;
  taskboneAPIkey: string;
  pinnedScripts: string[];
  customPens: PenStyle[];
  numberOfCustomPens: number;
  pdfScale: number;
  pdfBorderBox: boolean;
  pdfFrame: boolean;
  pdfGapSize: number;
  pdfGroupPages: boolean;
  pdfLockAfterImport: boolean;
  pdfNumColumns: number;
  pdfNumRows: number;
  pdfDirection: "down" | "right";
  pdfImportScale: number;
  gridSettings: GridSettings;
  laserSettings: {
    DECAY_TIME: number,
    DECAY_LENGTH: number,
    COLOR: string,
  };
  embeddableMarkdownDefaults: EmbeddableMDCustomProps;
  markdownNodeOneClickEditing: boolean;
  canvasImmersiveEmbed: boolean,
  startupScriptPath: string,
  openAIAPIToken: string,
  openAIDefaultTextModel: string,
  openAIDefaultVisionModel: string,
  openAIDefaultImageGenerationModel: string,
  openAIURL: string,
  openAIImageGenerationURL: string,
  openAIImageEditsURL: string,
  openAIImageVariationURL: string,
  modifierKeyConfig: {
    Mac: Record<ModifierSetType, ModifierKeySet>,
    Win: Record<ModifierSetType, ModifierKeySet>,
  },
  slidingPanesSupport: boolean;
  areaZoomLimit: number;
  longPressDesktop: number;
  longPressMobile: number;
  doubleClickLinkOpenViewMode: boolean;
  isDebugMode: boolean;
  rank: Rank;
  modifierKeyOverrides: {modifiers: Modifier[], key: string}[];
  showSplashscreen: boolean;
  pdfSettings: PDFExportSettings;
}

declare const PLUGIN_VERSION:string;

export const DEFAULT_SETTINGS: ExcalidrawSettings = {
  folder: "Excalidraw",
  cropFolder: "",
  annotateFolder: "",
  embedUseExcalidrawFolder: false,
  templateFilePath: "Excalidraw/Template.excalidraw",
  scriptFolderPath: "Excalidraw/Scripts",
  fontAssetsPath: "Excalidraw/CJK Fonts",
  loadChineseFonts: false,
  loadJapaneseFonts: false,
  loadKoreanFonts: false,
  compress: true,
  decompressForMDView: false,
  onceOffCompressFlagReset: false,
  onceOffGPTVersionReset: false,
  autosave: true,
  autosaveIntervalDesktop: 60000,
  autosaveIntervalMobile: 30000,
  drawingFilenamePrefix: "Drawing ",
  drawingEmbedPrefixWithFilename: true,
  drawingFilnameEmbedPostfix: " ",
  drawingFilenameDateTime: "YYYY-MM-DD HH.mm.ss",
  useExcalidrawExtension: true,
  cropPrefix: CROPPED_PREFIX,
  annotatePrefix: ANNOTATED_PREFIX,
  annotatePreserveSize: false,
  displaySVGInPreview: undefined,
  previewImageType: undefined,
  renderingConcurrency: 3,
  allowImageCache: true,
  allowImageCacheInScene: true,
  displayExportedImageIfAvailable: false,
  previewMatchObsidianTheme: false,
  width: "400",
  height: "",
  overrideObsidianFontSize: false,
  dynamicStyling: "colorful",
  isLeftHanded: false,
  iframeMatchExcalidrawTheme: true,
  matchTheme: false,
  matchThemeAlways: false,
  matchThemeTrigger: false,
  defaultMode: "normal",
  defaultPenMode: "never",
  penModeDoubleTapEraser: true,
  penModeSingleFingerPanning: true,
  penModeCrosshairVisible: true,
  renderImageInMarkdownReadingMode: false,
  renderImageInHoverPreviewForMDNotes: false,
  renderImageInMarkdownToPDF: false,
  allowPinchZoom: false,
  allowWheelZoom: false,
  zoomToFitOnOpen: true,
  zoomToFitOnResize: true,
  zoomToFitMaxLevel: 2,
  linkPrefix: "📍",
  urlPrefix: "🌐",
  parseTODO: false,
  todo: "☐",
  done: "🗹",
  hoverPreviewWithoutCTRL: false,
  linkOpacity: 1,
  openInAdjacentPane: true,
  showSecondOrderLinks: true,
  focusOnFileTab: true,
  openInMainWorkspace: true,
  showLinkBrackets: true,
  allowCtrlClick: true,
  forceWrap: false,
  pageTransclusionCharLimit: 200,
  wordWrappingDefault: 0,
  removeTransclusionQuoteSigns: true,
  iframelyAllowed: true,
  pngExportScale: 1,
  exportWithTheme: true,
  exportWithBackground: true,
  exportPaddingSVG: 10, //since 1.6.17, not only SVG but also PNG
  exportEmbedScene: false,
  keepInSync: false,
  autoexportSVG: false,
  autoexportPNG: false,
  autoExportLightAndDark: false,
  autoexportExcalidraw: false,
  embedType: "excalidraw",
  embedMarkdownCommentLinks: true,
  embedWikiLink: true,
  syncExcalidraw: false,
  experimentalFileType: false,
  experimentalFileTag: "✏️",
  experimentalLivePreview: true,
  fadeOutExcalidrawMarkup: false,
  loadPropertySuggestions: true,
  experimentalEnableFourthFont: false,
  experimantalFourthFont: "Virgil",
  addDummyTextElement: false,
  zoteroCompatibility: false,
  fieldSuggester: true,
  compatibilityMode: false,
  //loadCount: 0,
  drawingOpenCount: 0,
  library: `deprecated`,
  library2: {
    type: "excalidrawlib",
    version: 2,
    source: GITHUB_RELEASES+PLUGIN_VERSION,
    libraryItems: [],
  },
  //patchCommentBlock: true,
  imageElementNotice: true,
  //runWYSIWYGpatch: true,
  //fixInfinitePreviewLoop: true,
  mdSVGwidth: 500,
  mdSVGmaxHeight: 800,
  mdFont: "Virgil",
  mdFontColor: "Black",
  mdBorderColor: "Black",
  mdCSS: "",
  scriptEngineSettings: {},
  defaultTrayMode: true,
  previousRelease: "0.0.0",
  showReleaseNotes: true,
  showNewVersionNotification: true,
  //mathjaxSourceURL: "https://cdn.jsdelivr.net/npm/mathjax@3.2.1/es5/tex-svg.js",
  latexBoilerplate: "\\color{blue}",
  taskboneEnabled: false,
  taskboneAPIkey: "",
  pinnedScripts: [],
  customPens: [
    {...PENS["default"]},
    {...PENS["highlighter"]},
    {...PENS["finetip"]},
    {...PENS["fountain"]},
    {...PENS["marker"]},
    {...PENS["thick-thin"]},
    {...PENS["thin-thick-thin"]},
    {...PENS["default"]},
    {...PENS["default"]},
    {...PENS["default"]}
  ],
  numberOfCustomPens: 0,
  pdfScale: 4,
  pdfBorderBox: true,
  pdfFrame: false,
  pdfGapSize: 20,
  pdfGroupPages: false,
  pdfLockAfterImport: true,
  pdfNumColumns: 1,
  pdfNumRows: 1,
  pdfDirection: "right",
  pdfImportScale: 0.3,
  gridSettings: {
    DYNAMIC_COLOR: true,
    COLOR: "#000000",
    OPACITY: 50,
  },
  laserSettings: {
    DECAY_LENGTH: 50,
    DECAY_TIME: 1000,
    COLOR: "#ff0000",
  },
  embeddableMarkdownDefaults: {
    useObsidianDefaults: false,
    backgroundMatchCanvas: false,
    backgroundMatchElement: true,
    backgroundColor: "#fff",
    backgroundOpacity: 60,
    borderMatchElement: true,
    borderColor: "#fff",
    borderOpacity: 0,
    filenameVisible: false,
  },
  markdownNodeOneClickEditing: false,
  canvasImmersiveEmbed: true,
  startupScriptPath: "",
  openAIAPIToken: "",
  openAIDefaultTextModel: "gpt-3.5-turbo-1106",
  openAIDefaultVisionModel: "gpt-4o",
  openAIDefaultImageGenerationModel: "dall-e-3",
  openAIURL: "https://api.openai.com/v1/chat/completions",
  openAIImageGenerationURL: "https://api.openai.com/v1/images/generations",
  openAIImageEditsURL: "https://api.openai.com/v1/images/edits",
  openAIImageVariationURL: "https://api.openai.com/v1/images/variations",
  modifierKeyConfig: {
    Mac: {
      LocalFileDragAction:{
        defaultAction: "image-import",
        rules: [
          { shift: false, ctrl_cmd: false, alt_opt: false, meta_ctrl: false, result: "image-import" },
          { shift: true , ctrl_cmd: false, alt_opt: true , meta_ctrl: false, result: "link" },
          { shift: true , ctrl_cmd: false, alt_opt: false, meta_ctrl: false, result: "image-url" },
          { shift: false, ctrl_cmd: false, alt_opt: true , meta_ctrl: false, result: "embeddable" },
        ],
      },
      WebBrowserDragAction: {
        defaultAction: "image-url",
        rules: [
          { shift: false, ctrl_cmd: false, alt_opt: false, meta_ctrl: false, result: "image-url" },
          { shift: true , ctrl_cmd: false, alt_opt: true , meta_ctrl: false, result: "link" },
          { shift: false, ctrl_cmd: false, alt_opt: true , meta_ctrl: false, result: "embeddable" },
          { shift: true , ctrl_cmd: false, alt_opt: false, meta_ctrl: false, result: "image-import" },
        ],
      },
      InternalDragAction: {
        defaultAction: "link",
        rules: [
          { shift: false, ctrl_cmd: false, alt_opt: false, meta_ctrl: false, result: "link" },
          { shift: false, ctrl_cmd: false, alt_opt: false, meta_ctrl: true , result: "embeddable" },
          { shift: true , ctrl_cmd: false, alt_opt: false, meta_ctrl: false, result: "image" },
          { shift: true , ctrl_cmd: false, alt_opt: false, meta_ctrl: true , result: "image-fullsize" },
        ],
      },
      LinkClickAction: {
        defaultAction: "new-tab",
        rules: [
          { shift: false, ctrl_cmd: false, alt_opt: false, meta_ctrl: false, result: "active-pane" },
          { shift: false, ctrl_cmd: true , alt_opt: false, meta_ctrl: false, result: "new-tab" },
          { shift: false, ctrl_cmd: true , alt_opt: true , meta_ctrl: false, result: "new-pane" },
          { shift: true , ctrl_cmd: true , alt_opt: true , meta_ctrl: false, result: "popout-window" },
          { shift: false, ctrl_cmd: true , alt_opt: false, meta_ctrl: true , result: "md-properties" },
        ],
      },
    },
    Win: {
      LocalFileDragAction:{
        defaultAction: "image-import",
        rules: [
          { shift: false, ctrl_cmd: false, alt_opt: false, meta_ctrl: false, result: "image-import" },
          { shift: false, ctrl_cmd: true , alt_opt: false, meta_ctrl: false, result: "link" },
          { shift: true , ctrl_cmd: false, alt_opt: false, meta_ctrl: false, result: "image-url" },
          { shift: true , ctrl_cmd: true , alt_opt: false, meta_ctrl: false, result: "embeddable" },
        ],
      },
      WebBrowserDragAction: {
        defaultAction: "image-url",
        rules: [
          { shift: false, ctrl_cmd: false, alt_opt: false, meta_ctrl: false, result: "image-url" },
          { shift: false, ctrl_cmd: true , alt_opt: false, meta_ctrl: false, result: "link" },
          { shift: true , ctrl_cmd: true , alt_opt: false, meta_ctrl: false, result: "embeddable" },
          { shift: true , ctrl_cmd: false, alt_opt: false, meta_ctrl: false, result: "image-import" },
        ],
      },
      InternalDragAction: {
        defaultAction: "link",
        rules: [
          { shift: false, ctrl_cmd: false, alt_opt: false, meta_ctrl: false, result: "link" },
          { shift: true , ctrl_cmd: true , alt_opt: false, meta_ctrl: false, result: "embeddable" },
          { shift: true , ctrl_cmd: false, alt_opt: false, meta_ctrl: false, result: "image" },
          { shift: false, ctrl_cmd: true , alt_opt: true , meta_ctrl: false, result: "image-fullsize" },
        ],
      },
      LinkClickAction: {
        defaultAction: "new-tab",
        rules: [
          { shift: false, ctrl_cmd: false, alt_opt: false, meta_ctrl: false, result: "active-pane" },
          { shift: false, ctrl_cmd: true , alt_opt: false, meta_ctrl: false, result: "new-tab" },
          { shift: false, ctrl_cmd: true , alt_opt: true , meta_ctrl: false, result: "new-pane" },
          { shift: true , ctrl_cmd: true , alt_opt: true , meta_ctrl: false, result: "popout-window" },
          { shift: false, ctrl_cmd: true , alt_opt: false, meta_ctrl: true , result: "md-properties" },
        ],
      },
    },
  },
  slidingPanesSupport: false,
  areaZoomLimit: 1,
  longPressDesktop: 500,
  longPressMobile: 500,
  doubleClickLinkOpenViewMode: true,
  isDebugMode: false,
  rank: "Bronze",
  modifierKeyOverrides: [
    {modifiers: ["Mod"], key:"Enter"},
    {modifiers: ["Mod"], key:"k"},
    {modifiers: ["Mod"], key:"G"},
  ],
  showSplashscreen: true,
  pdfSettings: {
    pageSize: "A4",
    pageOrientation: "portrait",
    fitToPage: true,
    paperColor: "white",
    customPaperColor: "#ffffff",
    alignment: "center",
    margin: "normal"
  },
};

export class ExcalidrawSettingTab extends PluginSettingTab {
  plugin: ExcalidrawPlugin;
  private requestEmbedUpdate: boolean = false;
  private requestReloadDrawings: boolean = false;
  private requestUpdatePinnedPens: boolean = false;
  private requestUpdateDynamicStyling: boolean = false;
  private hotkeyEditor: HotkeyEditor;
  //private reloadMathJax: boolean = false;
  //private applyDebounceTimer: number = 0;

  constructor(app: App, plugin: ExcalidrawPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  applySettingsUpdate(requestReloadDrawings: boolean = false) {
    if (requestReloadDrawings) {
      this.requestReloadDrawings = true;
    }
  }

  async hide() {
    if(this.plugin.settings.overrideObsidianFontSize) {
      document.documentElement.style.fontSize = "";
      setRootElementSize(16);
    } else if(!document.documentElement.style.fontSize) {
      document.documentElement.style.fontSize = getComputedStyle(document.body).getPropertyValue("--font-text-size");
      setRootElementSize();
    }
    
    this.plugin.settings.scriptFolderPath = normalizePath(
      this.plugin.settings.scriptFolderPath,
    );
    if (
      this.plugin.settings.scriptFolderPath === "/" ||
      this.plugin.settings.scriptFolderPath === ""
    ) {
      this.plugin.settings.scriptFolderPath = "Excalidraw/Scripts";
    }
    this.plugin.saveSettings();
    if (this.requestUpdatePinnedPens) {
      getExcalidrawViews(this.app).forEach(excalidrawView =>
        excalidrawView.updatePinnedCustomPens()
      )
    }
    if (this.requestUpdateDynamicStyling) {
      getExcalidrawViews(this.app).forEach(excalidrawView =>
          setDynamicStyle(this.plugin.ea,excalidrawView,excalidrawView.previousBackgroundColor,this.plugin.settings.dynamicStyling)
      )
    }
    this.hotkeyEditor.unload();
    if (this.hotkeyEditor.isDirty) {
      this.plugin.registerHotkeyOverrides();
    }
    if (this.requestReloadDrawings) {
      const excalidrawViews = getExcalidrawViews(this.app);
      for (const excalidrawView of excalidrawViews) {
        await excalidrawView.save(false);
        //debug({where:"ExcalidrawSettings.hide",file:v.view.file.name,before:"reload(true)"})
        await excalidrawView.reload(true);
      }
      this.requestEmbedUpdate = true;
    }
    if (this.requestEmbedUpdate) {
      this.plugin.triggerEmbedUpdates();
    }
    this.plugin.scriptEngine.updateScriptPath();
/*    if(this.reloadMathJax) {
      this.plugin.loadMathJax();
    }*/
  }

  async display() {
    let detailsEl: HTMLElement;

    await this.plugin.loadSettings(); //in case sync loaded changed settings in the background
    this.requestEmbedUpdate = false;
    this.requestReloadDrawings = false;
    const { containerEl } = this;
    containerEl.addClass("excalidraw-settings");
    this.containerEl.empty();

    const coffeeDiv = containerEl.createDiv("coffee");
    coffeeDiv.addClass("ex-coffee-div");
    const coffeeLink = coffeeDiv.createEl("a", {
      href: "https://ko-fi.com/zsolt",
    });
    const coffeeImg = coffeeLink.createEl("img", {
      attr: {
        src: "https://cdn.ko-fi.com/cdn/kofi3.png?v=3",
      },
    });
    coffeeImg.height = 45;
    
    const iconLinks = [
      { 
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path><path d="M9 18c-4.51 2-5-2-7-2"></path></svg>`,
        href: "https://github.com/zsviczian/obsidian-excalidraw-plugin/issues",
        aria: "Report bugs and raise feature requsts on the plugin's GitHub page",
        text: "Bugs and Feature Requests",
      },
      { 
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19c-2.3 0-6.4-.2-8.1-.6-.7-.2-1.2-.7-1.4-1.4-.3-1.1-.5-3.4-.5-5s.2-3.9.5-5c.2-.7.7-1.2 1.4-1.4C5.6 5.2 9.7 5 12 5s6.4.2 8.1.6c.7.2 1.2.7 1.4 1.4.3 1.1.5 3.4.5 5s-.2 3.9-.5 5c-.2.7-.7 1.2-1.4 1.4-1.7.4-5.8.6-8.1.6 0 0 0 0 0 0z"></path><polygon points="10 15 15 12 10 9"></polygon></svg>`,
        href: "https://www.youtube.com/@VisualPKM",
        aria: "Check out my YouTube channel to learn about Visual Thinking and Excalidraw",
        text: "Visual PKM on YouTube",
      },
      { 
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" stroke="none" strokeWidth="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 640 512"><path d="M524.531,69.836a1.5,1.5,0,0,0-.764-.7A485.065,485.065,0,0,0,404.081,32.03a1.816,1.816,0,0,0-1.923.91,337.461,337.461,0,0,0-14.9,30.6,447.848,447.848,0,0,0-134.426,0,309.541,309.541,0,0,0-15.135-30.6,1.89,1.89,0,0,0-1.924-.91A483.689,483.689,0,0,0,116.085,69.137a1.712,1.712,0,0,0-.788.676C39.068,183.651,18.186,294.69,28.43,404.354a2.016,2.016,0,0,0,.765,1.375A487.666,487.666,0,0,0,176.02,479.918a1.9,1.9,0,0,0,2.063-.676A348.2,348.2,0,0,0,208.12,430.4a1.86,1.86,0,0,0-1.019-2.588,321.173,321.173,0,0,1-45.868-21.853,1.885,1.885,0,0,1-.185-3.126c3.082-2.309,6.166-4.711,9.109-7.137a1.819,1.819,0,0,1,1.9-.256c96.229,43.917,200.41,43.917,295.5,0a1.812,1.812,0,0,1,1.924.233c2.944,2.426,6.027,4.851,9.132,7.16a1.884,1.884,0,0,1-.162,3.126,301.407,301.407,0,0,1-45.89,21.83,1.875,1.875,0,0,0-1,2.611,391.055,391.055,0,0,0,30.014,48.815,1.864,1.864,0,0,0,2.063.7A486.048,486.048,0,0,0,610.7,405.729a1.882,1.882,0,0,0,.765-1.352C623.729,277.594,590.933,167.465,524.531,69.836ZM222.491,337.58c-28.972,0-52.844-26.587-52.844-59.239S193.056,219.1,222.491,219.1c29.665,0,53.306,26.82,52.843,59.239C275.334,310.993,251.924,337.58,222.491,337.58Zm195.38,0c-28.971,0-52.843-26.587-52.843-59.239S388.437,219.1,417.871,219.1c29.667,0,53.307,26.82,52.844,59.239C470.715,310.993,447.538,337.58,417.871,337.58Z"/></svg>`,
        href: "https://discord.gg/DyfAXFwUHc",
        aria: "Join the Visual Thinking Workshop Discord Server",
        text: "Community on Discord",
      },
      { 
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path></svg>`,
        href: "https://twitter.com/zsviczian",
        aria: "Follow me on Twitter",
        text: "Follow me on Twitter",
      },
      { 
        icon: getIcon("graduation-cap").outerHTML,
        href: "https://visual-thinking-workshop.com",
        aria: "Learn about Visual PKM, Excalidraw, Obsidian, ExcaliBrain and more",
        text: "Join the Visual Thinking Workshop",
      }
    ];

    const linksEl = containerEl.createDiv("setting-item-description excalidraw-settings-links-container");
    iconLinks.forEach(({ icon, href, aria, text }) => {
      linksEl.createEl("a",{href, attr: { "aria-label": aria }}, (a)=> {
        a.innerHTML = icon  + text;
      });
    });

    // ------------------------------------------------
    // Saving
    // ------------------------------------------------  
    containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    containerEl.createDiv({ text: t("BASIC_DESC"), cls: "setting-item-description" });
    detailsEl = this.containerEl.createEl("details");
    detailsEl.createEl("summary", { 
      text: t("BASIC_HEAD"),
      cls: "excalidraw-setting-h1",
    });
    new Setting(detailsEl)
      .setName(t("RELEASE_NOTES_NAME"))
      .setDesc(fragWithHTML(t("RELEASE_NOTES_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showReleaseNotes)
          .onChange(async (value) => {
            this.plugin.settings.showReleaseNotes = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
    .setName(t("NEWVERSION_NOTIFICATION_NAME"))
    .setDesc(fragWithHTML(t("NEWVERSION_NOTIFICATION_DESC")))
    .addToggle((toggle) =>
      toggle
        .setValue(this.plugin.settings.showNewVersionNotification)
        .onChange(async (value) => {
          this.plugin.settings.showNewVersionNotification = value;
          this.applySettingsUpdate();
        }),
    );

    new Setting(detailsEl)
      .setName(t("FOLDER_NAME"))
      .setDesc(fragWithHTML(t("FOLDER_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("e.g.: Excalidraw")
          .setValue(this.plugin.settings.folder)
          .onChange(async (value) => {
            this.plugin.settings.folder = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("FOLDER_EMBED_NAME"))
      .setDesc(fragWithHTML(t("FOLDER_EMBED_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.embedUseExcalidrawFolder)
          .onChange(async (value) => {
            this.plugin.settings.embedUseExcalidrawFolder = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("CROP_FOLDER_NAME"))
      .setDesc(fragWithHTML(t("CROP_FOLDER_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("e.g.: Excalidraw/Cropped")
          .setValue(this.plugin.settings.cropFolder)
          .onChange(async (value) => {
            this.plugin.settings.cropFolder = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("ANNOTATE_FOLDER_NAME"))
      .setDesc(fragWithHTML(t("ANNOTATE_FOLDER_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("e.g.: Excalidraw/Annotations")
          .setValue(this.plugin.settings.annotateFolder)
          .onChange(async (value) => {
            this.plugin.settings.annotateFolder = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("TEMPLATE_NAME"))
      .setDesc(fragWithHTML(t("TEMPLATE_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("e.g.: Excalidraw/Template")
          .setValue(this.plugin.settings.templateFilePath)
          .onChange(async (value) => {
            this.plugin.settings.templateFilePath = value;
            this.applySettingsUpdate();
          }),
      );
    addIframe(detailsEl, "jgUpYznHP9A",216);

    new Setting(detailsEl)
      .setName(t("SCRIPT_FOLDER_NAME"))
      .setDesc(fragWithHTML(t("SCRIPT_FOLDER_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("e.g.: Excalidraw/Scripts")
          .setValue(this.plugin.settings.scriptFolderPath)
          .onChange(async (value) => {
            this.plugin.settings.scriptFolderPath = value;
            this.applySettingsUpdate();
          }),
      );

    // ------------------------------------------------
    // Saving
    // ------------------------------------------------  
    containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    containerEl.createDiv({ text: t("SAVING_DESC"), cls: "setting-item-description"  });
    detailsEl = this.containerEl.createEl("details");
    const savingDetailsEl = detailsEl;
    detailsEl.createEl("summary", { 
      text: t("SAVING_HEAD"),
      cls: "excalidraw-setting-h1",
    });

    new Setting(detailsEl)
      .setName(t("COMPRESS_NAME"))
      .setDesc(fragWithHTML(t("COMPRESS_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.compress)
          .onChange(async (value) => {
            this.plugin.settings.compress = value;
            this.applySettingsUpdate();
          }),
    );

    new Setting(detailsEl)
      .setName(t("DECOMPRESS_FOR_MD_NAME"))
      .setDesc(fragWithHTML(t("DECOMPRESS_FOR_MD_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.decompressForMDView)
          .onChange(async (value) => {
            this.plugin.settings.decompressForMDView = value;
            this.applySettingsUpdate();
          }),
    );

    new Setting(detailsEl)
    .setName(t("AUTOSAVE_INTERVAL_DESKTOP_NAME"))
    .setDesc(fragWithHTML(t("AUTOSAVE_INTERVAL_DESKTOP_DESC")))
    .addDropdown((dropdown) =>
      dropdown
        .addOption("15000", "Very frequent (every 15 seconds)")
        .addOption("30000", "Frequent (every 30 seconds)")
        .addOption("60000", "Moderate (every 60 seconds)")
        .addOption("300000", "Rare (every 5 minutes)")
        .addOption("900000", "Practically never (every 15 minutes)")
        .setValue(this.plugin.settings.autosaveIntervalDesktop.toString())
        .onChange(async (value) => {
          this.plugin.settings.autosaveIntervalDesktop = parseInt(value);
          this.applySettingsUpdate();
        }),
    );

    new Setting(detailsEl)
    .setName(t("AUTOSAVE_INTERVAL_MOBILE_NAME"))
    .setDesc(fragWithHTML(t("AUTOSAVE_INTERVAL_MOBILE_DESC")))
    .addDropdown((dropdown) =>
      dropdown
        .addOption("10000", "Very frequent (every 10 seconds)")
        .addOption("20000", "Frequent (every 20 seconds)")
        .addOption("30000", "Moderate (every 30 seconds)")
        .addOption("60000", "Rare (every 1 minute)")
        .addOption("300000", "Practically never (every 5 minutes)")
        .setValue(this.plugin.settings.autosaveIntervalMobile.toString())
        .onChange(async (value) => {
          this.plugin.settings.autosaveIntervalMobile = parseInt(value);
          this.applySettingsUpdate();
        }),
    );

    detailsEl = savingDetailsEl.createEl("details");
    detailsEl.createEl("summary", { 
      text: t("FILENAME_HEAD"),
      cls: "excalidraw-setting-h3",
    });

    detailsEl.createDiv("", (el) => {
      el.innerHTML = t("FILENAME_DESC");
    });

    const getFilenameSample = () => {
      return `${t(
        "FILENAME_SAMPLE",
      )}<a href='https://www.youtube.com/channel/UCC0gns4a9fhVkGkngvSumAQ' target='_blank'>${getDrawingFilename(
        this.plugin.settings,
      )}</a></b><br>${t(
        "FILENAME_EMBED_SAMPLE",
      )}<a href='https://www.youtube.com/channel/UCC0gns4a9fhVkGkngvSumAQ' target='_blank'>${getEmbedFilename(
        "{NOTE_NAME}",
        this.plugin.settings,
      )}</a></b>`;
    };

    const filenameEl = detailsEl.createEl("p", { text: "" });
    filenameEl.innerHTML = getFilenameSample();

    new Setting(detailsEl)
      .setName(t("FILENAME_PREFIX_NAME"))
      .setDesc(fragWithHTML(t("FILENAME_PREFIX_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("e.g.: Drawing ")
          .setValue(this.plugin.settings.drawingFilenamePrefix)
          .onChange(async (value) => {
            this.plugin.settings.drawingFilenamePrefix = value.replaceAll(
              /[<>:"/\\|?*]/g,
              "_",
            );
            text.setValue(this.plugin.settings.drawingFilenamePrefix);
            filenameEl.innerHTML = getFilenameSample();
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("FILENAME_PREFIX_EMBED_NAME"))
      .setDesc(fragWithHTML(t("FILENAME_PREFIX_EMBED_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.drawingEmbedPrefixWithFilename)
          .onChange(async (value) => {
            this.plugin.settings.drawingEmbedPrefixWithFilename = value;
            filenameEl.innerHTML = getFilenameSample();
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("FILENAME_POSTFIX_NAME"))
      .setDesc(fragWithHTML(t("FILENAME_POSTFIX_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("")
          .setValue(this.plugin.settings.drawingFilnameEmbedPostfix)
          .onChange(async (value) => {
            this.plugin.settings.drawingFilnameEmbedPostfix = value.replaceAll(
              /[<>:"/\\|?*]/g,
              "_",
            );
            text.setValue(this.plugin.settings.drawingFilnameEmbedPostfix);
            filenameEl.innerHTML = getFilenameSample();
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("FILENAME_DATE_NAME"))
      .setDesc(fragWithHTML(t("FILENAME_DATE_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("YYYY-MM-DD HH.mm.ss")
          .setValue(this.plugin.settings.drawingFilenameDateTime)
          .onChange(async (value) => {
            this.plugin.settings.drawingFilenameDateTime = value.replaceAll(
              /[<>:"/\\|?*]/g,
              "_",
            );
            text.setValue(this.plugin.settings.drawingFilenameDateTime);
            filenameEl.innerHTML = getFilenameSample();
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("FILENAME_EXCALIDRAW_EXTENSION_NAME"))
      .setDesc(fragWithHTML(t("FILENAME_EXCALIDRAW_EXTENSION_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.useExcalidrawExtension)
          .onChange(async (value) => {
            this.plugin.settings.useExcalidrawExtension = value;
            filenameEl.innerHTML = getFilenameSample();
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("CROP_PREFIX_NAME"))
      .setDesc(fragWithHTML(t("CROP_PREFIX_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("e.g.: Cropped_ ")
          .setValue(this.plugin.settings.cropPrefix)
          .onChange(async (value) => {
            this.plugin.settings.cropPrefix = value.replaceAll(
              /[<>:"/\\|?*]/g,
              "_",
            );
            text.setValue(this.plugin.settings.cropPrefix);
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("ANNOTATE_PREFIX_NAME"))
      .setDesc(fragWithHTML(t("ANNOTATE_PREFIX_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("e.g.: Annotated_ ")
          .setValue(this.plugin.settings.annotatePrefix)
          .onChange(async (value) => {
            this.plugin.settings.annotatePrefix = value.replaceAll(
              /[<>:"/\\|?*]/g,
              "_",
            );
            text.setValue(this.plugin.settings.annotatePrefix);
            this.applySettingsUpdate();
          }),
      );
    
    new Setting(detailsEl)
      .setName(t("ANNOTATE_PRESERVE_SIZE_NAME"))
      .setDesc(fragWithHTML(t("ANNOTATE_PRESERVE_SIZE_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.annotatePreserveSize)
          .onChange(async (value) => {
            this.plugin.settings.annotatePreserveSize = value;
            this.applySettingsUpdate();
          }),
      );

    //------------------------------------------------
    // AI Settings
    //------------------------------------------------
    containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    containerEl.createDiv({ text: t("AI_DESC"), cls: "setting-item-description"  });
    detailsEl = this.containerEl.createEl("details");
    const aiDetailsEl = detailsEl;
    detailsEl.createEl("summary", { 
      text: t("AI_HEAD"),
      cls: "excalidraw-setting-h1",
    });

    new Setting(detailsEl)
      .setName(t("AI_OPENAI_TOKEN_NAME"))
      .setDesc(fragWithHTML(t("AI_OPENAI_TOKEN_DESC")))
      .addText((text) =>
        text
          .setPlaceholder(t("AI_OPENAI_TOKEN_PLACEHOLDER"))
          .setValue(this.plugin.settings.openAIAPIToken)
          .onChange(async (value) => {
            this.plugin.settings.openAIAPIToken = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("AI_OPENAI_DEFAULT_MODEL_NAME"))
      .setDesc(fragWithHTML(t("AI_OPENAI_DEFAULT_MODEL_DESC")))
      .addText((text) =>
        text
          .setPlaceholder(t("AI_OPENAI_DEFAULT_MODEL_PLACEHOLDER"))
          .setValue(this.plugin.settings.openAIDefaultTextModel)
          .onChange(async (value) => {
            this.plugin.settings.openAIDefaultTextModel = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("AI_OPENAI_DEFAULT_VISION_MODEL_NAME"))
      .setDesc(fragWithHTML(t("AI_OPENAI_DEFAULT_VISION_MODEL_DESC")))
      .addText((text) =>
        text
          .setPlaceholder(t("AI_OPENAI_DEFAULT_VISION_MODEL_PLACEHOLDER"))
          .setValue(this.plugin.settings.openAIDefaultVisionModel)
          .onChange(async (value) => {
            this.plugin.settings.openAIDefaultVisionModel = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("AI_OPENAI_DEFAULT_IMAGE_MODEL_NAME"))
      .setDesc(fragWithHTML(t("AI_OPENAI_DEFAULT_IMAGE_MODEL_DESC")))
      .addText((text) =>
        text
          .setPlaceholder(t("AI_OPENAI_DEFAULT_IMAGE_MODEL_PLACEHOLDER"))
          .setValue(this.plugin.settings.openAIDefaultImageGenerationModel)
          .onChange(async (value) => {
            this.plugin.settings.openAIDefaultImageGenerationModel = value;
            this.applySettingsUpdate();
          }),
      );
      
    new Setting(detailsEl)
      .setName(t("AI_OPENAI_DEFAULT_API_URL_NAME"))
      .setDesc(fragWithHTML(t("AI_OPENAI_DEFAULT_API_URL_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("e.g.: https://api.openai.com/v1/chat/completions")
          .setValue(this.plugin.settings.openAIURL)
          .onChange(async (value) => {
            this.plugin.settings.openAIURL = value;
            this.applySettingsUpdate();
          }),
      );

    // ------------------------------------------------
    // Display
    // ------------------------------------------------
    containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    containerEl.createDiv({ text: t("DISPLAY_DESC"), cls: "setting-item-description"  });
    detailsEl = this.containerEl.createEl("details");
    const displayDetailsEl = detailsEl;
    detailsEl.createEl("summary", { 
      text: t("DISPLAY_HEAD"),
      cls: "excalidraw-setting-h1",
    });

    const readingModeEl = new Setting(detailsEl)
      .setName(t("SHOW_DRAWING_OR_MD_IN_READING_MODE_NAME"))
      .setDesc(fragWithHTML(t("SHOW_DRAWING_OR_MD_IN_READING_MODE_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.renderImageInMarkdownReadingMode)
          .onChange(async (value) => {
            this.plugin.settings.renderImageInMarkdownReadingMode = value;
            this.applySettingsUpdate();
          }),
      );
    readingModeEl.nameEl.setAttribute("id",TAG_MDREADINGMODE);

    new Setting(detailsEl)
      .setName(t("SHOW_DRAWING_OR_MD_IN_HOVER_PREVIEW_NAME"))
      .setDesc(fragWithHTML(t("SHOW_DRAWING_OR_MD_IN_HOVER_PREVIEW_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.renderImageInHoverPreviewForMDNotes)
          .onChange(async (value) => {
            this.plugin.settings.renderImageInHoverPreviewForMDNotes = value;
            this.applySettingsUpdate();
          }),
      );
      
    new Setting(detailsEl)
      .setName(t("LEFTHANDED_MODE_NAME"))
      .setDesc(fragWithHTML(t("LEFTHANDED_MODE_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.isLeftHanded)
          .onChange(async (value) => {
            this.plugin.settings.isLeftHanded = value;
            //not clear why I need to do this. If I don't double apply the stylesheet changes 
            //then the style won't be applied in the popout windows
            setLeftHandedMode(value); 
            setTimeout(()=>setLeftHandedMode(value));
            this.applySettingsUpdate();
          }),
      );
    addIframe(detailsEl, "H8Njp7ZXYag",999);

    new Setting(detailsEl)
      .setName(t("TOGGLE_SPLASHSCREEN"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showSplashscreen)
          .onChange((value)=> {
            this.plugin.settings.showSplashscreen = value;
            this.applySettingsUpdate();
          })
      )

    detailsEl = displayDetailsEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("HOTKEY_OVERRIDE_HEAD"),
      cls: "excalidraw-setting-h3",
    });
    detailsEl.createEl("span", {}, (el) => {
      el.innerHTML = t("HOTKEY_OVERRIDE_DESC");
    });

    this.hotkeyEditor = new HotkeyEditor(detailsEl, this.plugin.settings, this.applySettingsUpdate);
    this.hotkeyEditor.onload();

    detailsEl = displayDetailsEl.createEl("details");
    detailsEl.createEl("summary", { 
      text: t("THEME_HEAD"),
      cls: "excalidraw-setting-h3",
    });
    
    new Setting(detailsEl)
      .setName(t("OVERRIDE_OBSIDIAN_FONT_SIZE_NAME"))
      .setDesc(fragWithHTML(t("OVERRIDE_OBSIDIAN_FONT_SIZE_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.overrideObsidianFontSize)
          .onChange((value) => {
            this.plugin.settings.overrideObsidianFontSize = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("DYNAMICSTYLE_NAME"))
      .setDesc(fragWithHTML(t("DYNAMICSTYLE_DESC")))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("none","Dynamic Styling OFF")
          .addOption("colorful","Match color")
          .addOption("gray","Gray, match tone")
          .setValue(this.plugin.settings.dynamicStyling)
          .onChange(async (value) => {
            this.requestUpdateDynamicStyling = true;
            this.plugin.settings.dynamicStyling = value as DynamicStyle;
            this.applySettingsUpdate();
          }),
      );
    addIframe(detailsEl, "fypDth_-8q0");

    new Setting(detailsEl)
    .setName(t("IFRAME_MATCH_THEME_NAME"))
    .setDesc(fragWithHTML(t("IFRAME_MATCH_THEME_DESC")))
    .addToggle((toggle) =>
      toggle
        .setValue(this.plugin.settings.iframeMatchExcalidrawTheme)
        .onChange(async (value) => {
          this.plugin.settings.iframeMatchExcalidrawTheme = value;
          this.applySettingsUpdate(true);
        }),
    );
    addIframe(detailsEl, "ICpoyMv6KSs");

    new Setting(detailsEl)
      .setName(t("MATCH_THEME_NAME"))
      .setDesc(fragWithHTML(t("MATCH_THEME_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.matchTheme)
          .onChange(async (value) => {
            this.plugin.settings.matchTheme = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("MATCH_THEME_ALWAYS_NAME"))
      .setDesc(fragWithHTML(t("MATCH_THEME_ALWAYS_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.matchThemeAlways)
          .onChange(async (value) => {
            this.plugin.settings.matchThemeAlways = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("MATCH_THEME_TRIGGER_NAME"))
      .setDesc(fragWithHTML(t("MATCH_THEME_TRIGGER_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.matchThemeTrigger)
          .onChange(async (value) => {
            this.plugin.settings.matchThemeTrigger = value;
            if(value) {
              this.plugin.addThemeObserver();
            } else {
              this.plugin.removeThemeObserver();
            }
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("DEFAULT_OPEN_MODE_NAME"))
      .setDesc(fragWithHTML(t("DEFAULT_OPEN_MODE_DESC")))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("normal", "Always in normal-mode")
          .addOption("zen", "Always in zen-mode")
          .addOption("view", "Always in view-mode")
          .addOption("view-mobile", "Usually normal, but view-mode on Phone")
          .setValue(this.plugin.settings.defaultMode)
          .onChange(async (value) => {
            this.plugin.settings.defaultMode = value;
            this.applySettingsUpdate();
          }),
      );

    detailsEl = displayDetailsEl.createEl("details");
    detailsEl.createEl("summary", { 
      text: t("ZOOM_HEAD"),
      cls: "excalidraw-setting-h3",
    });
    new Setting(detailsEl)
      .setName(t("DEFAULT_PINCHZOOM_NAME"))
      .setDesc(fragWithHTML(t("DEFAULT_PINCHZOOM_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.allowPinchZoom)
          .onChange(async (value) => {
            this.plugin.settings.allowPinchZoom = value;
            getExcalidrawViews(this.app).forEach(excalidrawView=>excalidrawView.updatePinchZoom())
            this.applySettingsUpdate();
          }),
      );
    addIframe(detailsEl, "rBarRfcSxNo",107);

    new Setting(detailsEl)
      .setName(t("DEFAULT_WHEELZOOM_NAME"))
      .setDesc(fragWithHTML(t("DEFAULT_WHEELZOOM_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.allowWheelZoom)
          .onChange(async (value) => {
            this.plugin.settings.allowWheelZoom = value;
            getExcalidrawViews(this.app).forEach(excalidrawView=>excalidrawView.updateWheelZoom());
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("ZOOM_TO_FIT_ONOPEN_NAME"))
      .setDesc(fragWithHTML(t("ZOOM_TO_FIT_ONOPEN_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.zoomToFitOnOpen)
          .onChange(async (value) => {
            this.plugin.settings.zoomToFitOnOpen = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("ZOOM_TO_FIT_NAME"))
      .setDesc(fragWithHTML(t("ZOOM_TO_FIT_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.zoomToFitOnResize)
          .onChange(async (value) => {
            this.plugin.settings.zoomToFitOnResize = value;
            this.applySettingsUpdate();
          }),
      );


    createSliderWithText(detailsEl, {
      name: t("ZOOM_TO_FIT_MAX_LEVEL_NAME"),
      desc: t("ZOOM_TO_FIT_MAX_LEVEL_DESC"),
      value: this.plugin.settings.zoomToFitMaxLevel,
      min: 0.5,
      max: 10,
      step: 0.5,
      onChange: (value) => {
        this.plugin.settings.zoomToFitMaxLevel = value;
        this.applySettingsUpdate();
      }
    })

      // ------------------------------------------------
      // Pen
      // ------------------------------------------------
      detailsEl = displayDetailsEl.createEl("details");
      detailsEl.createEl("summary", {
        text: t("PEN_HEAD"),
        cls: "excalidraw-setting-h3",
      });

      new Setting(detailsEl)
      .setName(t("DEFAULT_PEN_MODE_NAME"))
      .setDesc(fragWithHTML(t("DEFAULT_PEN_MODE_DESC")))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("never", "Never")
          .addOption("mobile", "On Obsidian Mobile")
          .addOption("always", "Always")
          .setValue(this.plugin.settings.defaultPenMode)
          .onChange(async (value: "never" | "always" | "mobile") => {
            this.plugin.settings.defaultPenMode = value;
            this.applySettingsUpdate();
          }),
      );
  
      new Setting(detailsEl)
        .setName(t("DISABLE_DOUBLE_TAP_ERASER_NAME"))
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.penModeDoubleTapEraser)
            .onChange(async (value) => {
              this.plugin.settings.penModeDoubleTapEraser = value;
              this.applySettingsUpdate();
            }),
        );
      
      new Setting(detailsEl)
        .setName(t("DISABLE_SINGLE_FINGER_PANNING_NAME"))
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.penModeSingleFingerPanning)
            .onChange(async (value) => {
              this.plugin.settings.penModeSingleFingerPanning = value;
              this.applySettingsUpdate();
            }),
        );
  
      new Setting(detailsEl)
        .setName(t("SHOW_PEN_MODE_FREEDRAW_CROSSHAIR_NAME"))
        .setDesc(fragWithHTML(t("SHOW_PEN_MODE_FREEDRAW_CROSSHAIR_DESC")))
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.penModeCrosshairVisible)
            .onChange(async (value) => {
              this.plugin.settings.penModeCrosshairVisible = value;
              this.applySettingsUpdate();
            }),
        );

      // ------------------------------------------------
      // Grid
      // ------------------------------------------------
      detailsEl = displayDetailsEl.createEl("details");
      detailsEl.createEl("summary", {
        text: t("GRID_HEAD"),
        cls: "excalidraw-setting-h3",
      });

      const updateGridColor = () => {
        getExcalidrawViews(this.app).forEach(excalidrawView=>excalidrawView.updateGridColor());
      };

      // Dynamic color toggle
      let gridColorSection: HTMLDivElement;
      new Setting(detailsEl)
        .setName(t("GRID_DYNAMIC_COLOR_NAME"))
        .setDesc(fragWithHTML(t("GRID_DYNAMIC_COLOR_DESC")))
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.gridSettings.DYNAMIC_COLOR)
            .onChange(async (value) => {
              this.plugin.settings.gridSettings.DYNAMIC_COLOR = value;
              gridColorSection.style.display = value ? "none" : "block";
              this.applySettingsUpdate();
              updateGridColor();
            }),
        );

      // Create a div to contain color and opacity settings
      gridColorSection = detailsEl.createDiv();
      gridColorSection.style.display = this.plugin.settings.gridSettings.DYNAMIC_COLOR ? "none" : "block";

      // Grid color picker
      new Setting(gridColorSection)
        .setName(t("GRID_COLOR_NAME"))
        .addColorPicker((colorPicker) =>
          colorPicker
            .setValue(this.plugin.settings.gridSettings.COLOR)
            .onChange(async (value) => {
              this.plugin.settings.gridSettings.COLOR = value;
              this.applySettingsUpdate();
              updateGridColor();
            }),
        );

      // Grid opacity slider (hex value between 00 and FF)
      createSliderWithText(detailsEl, {
        name: t("GRID_OPACITY_NAME"),
        desc: t("GRID_OPACITY_DESC"),
        value: this.plugin.settings.gridSettings.OPACITY,
        min: 0,
        max: 100,
        step: 1,
        onChange: (value) => {
          this.plugin.settings.gridSettings.OPACITY = value;
          this.applySettingsUpdate();
          updateGridColor();
        },
        minWidth: "3em",
      })

    // ------------------------------------------------
    // Laser Pointer
    // ------------------------------------------------
    detailsEl = displayDetailsEl.createEl("details");
    detailsEl.createEl("summary", { 
      text: t("LASER_HEAD"),
      cls: "excalidraw-setting-h3",
    });
    new Setting(detailsEl)
      .setName(t("LASER_COLOR"))
      .addColorPicker((colorPicker) =>
        colorPicker
          .setValue(this.plugin.settings.laserSettings.COLOR)
          .onChange(async (value) => {
            this.plugin.settings.laserSettings.COLOR = value;
            this.applySettingsUpdate();
          }),
      );
    
    createSliderWithText(detailsEl, {
      name: t("LASER_DECAY_TIME_NAME"),
      desc: t("LASER_DECAY_TIME_DESC"),
      value: this.plugin.settings.laserSettings.DECAY_TIME,
      min: 500,
      max: 20000,
      step: 500,
      onChange: (value) => {
        this.plugin.settings.laserSettings.DECAY_TIME = value;
        this.applySettingsUpdate();
      },
      minWidth: "3em",
    })

    createSliderWithText(detailsEl, {
      name: t("LASER_DECAY_LENGTH_NAME"),
      desc: t("LASER_DECAY_LENGTH_DESC"),
      value: this.plugin.settings.laserSettings.DECAY_LENGTH,
      min: 25,
      max: 2000,
      step: 25,
      onChange: (value) => {
        this.plugin.settings.laserSettings.DECAY_LENGTH = value;
        this.applySettingsUpdate();
      },
      minWidth: "3em",
    })

    detailsEl = displayDetailsEl.createEl("details");
    detailsEl.createEl("summary", { 
      text: t("DRAG_MODIFIER_NAME"),
      cls: "excalidraw-setting-h3",
    });
    detailsEl.createDiv({ text: t("DRAG_MODIFIER_DESC"), cls: "setting-item-description" });

    createSliderWithText(detailsEl, {
      name: t("LONG_PRESS_DESKTOP_NAME"),
      desc: t("LONG_PRESS_DESKTOP_DESC"),
      value: this.plugin.settings.longPressDesktop,
      min: 300,
      max: 3000,
      step: 100,
      onChange: (value) => {
        this.plugin.settings.longPressDesktop = value;
        this.applySettingsUpdate(true);
      },
    })

    createSliderWithText(detailsEl, {
      name: t("LONG_PRESS_MOBILE_NAME"),
      desc: t("LONG_PRESS_MOBILE_DESC"),
      value: this.plugin.settings.longPressMobile,
      min: 300,
      max: 3000,
      step: 100,
      onChange: (value) => {
        this.plugin.settings.longPressMobile = value;
        this.applySettingsUpdate(true);
      },
    })

    new Setting(detailsEl)
      .setName(t("DOUBLE_CLICK_LINK_OPEN_VIEW_MODE"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.doubleClickLinkOpenViewMode)
          .onChange(async (value) => {
            this.plugin.settings.doubleClickLinkOpenViewMode = value;
            this.applySettingsUpdate();
          }),
      );


    new ModifierKeySettingsComponent(
      detailsEl,
      this.plugin.settings.modifierKeyConfig,
      this.applySettingsUpdate,
    ).render();

    // ------------------------------------------------
    // Links and Transclusions
    // ------------------------------------------------
    containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    containerEl.createDiv({ text: t("LINKS_HEAD_DESC"), cls: "setting-item-description" });
    detailsEl = this.containerEl.createEl("details");
    detailsEl.createEl("summary", { 
      text: t("LINKS_HEAD"),
      cls: "excalidraw-setting-h1",
    });

    detailsEl.createEl(
      "span",
      undefined,
      (el) => (el.innerHTML = t("LINKS_DESC")),
    );

    new Setting(detailsEl)
    .setName(t("SECOND_ORDER_LINKS_NAME"))
    .setDesc(fragWithHTML(t("SECOND_ORDER_LINKS_DESC")))
    .addToggle((toggle) =>
      toggle
        .setValue(this.plugin.settings.showSecondOrderLinks)
        .onChange(async (value) => {
          this.plugin.settings.showSecondOrderLinks = value;
          this.applySettingsUpdate();
        }),
    );

    new Setting(detailsEl)
      .setName(t("ADJACENT_PANE_NAME"))
      .setDesc(fragWithHTML(t("ADJACENT_PANE_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.openInAdjacentPane)
          .onChange(async (value) => {
            this.plugin.settings.openInAdjacentPane = value;
            this.applySettingsUpdate();
          }),
      );
    
    new Setting(detailsEl)
      .setName(t("FOCUS_ON_EXISTING_TAB_NAME"))
      .setDesc(fragWithHTML(t("FOCUS_ON_EXISTING_TAB_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.focusOnFileTab)
          .onChange(async (value) => {
            this.plugin.settings.focusOnFileTab = value;
            this.applySettingsUpdate();
          }),
      );
    
    new Setting(detailsEl)
      .setName(t("MAINWORKSPACE_PANE_NAME"))
      .setDesc(fragWithHTML(t("MAINWORKSPACE_PANE_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.openInMainWorkspace)
          .onChange(async (value) => {
            this.plugin.settings.openInMainWorkspace = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(fragWithHTML(t("LINK_BRACKETS_NAME")))
      .setDesc(fragWithHTML(t("LINK_BRACKETS_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showLinkBrackets)
          .onChange(value => {
            this.plugin.settings.showLinkBrackets = value;
            this.applySettingsUpdate(true);
          }),
      );

    new Setting(detailsEl)
      .setName(t("LINK_PREFIX_NAME"))
      .setDesc(fragWithHTML(t("LINK_PREFIX_DESC")))
      .addText((text) =>
        text
          .setPlaceholder(t("INSERT_EMOJI"))
          .setValue(this.plugin.settings.linkPrefix)
          .onChange(value => {
            this.plugin.settings.linkPrefix = value;
            this.applySettingsUpdate(true);
          }),
      );

    new Setting(detailsEl)
      .setName(t("URL_PREFIX_NAME"))
      .setDesc(fragWithHTML(t("URL_PREFIX_DESC")))
      .addText((text) =>
        text
          .setPlaceholder(t("INSERT_EMOJI"))
          .setValue(this.plugin.settings.urlPrefix)
          .onChange(value => {
            this.plugin.settings.urlPrefix = value;
            this.applySettingsUpdate(true);
          }),
      );

    let todoPrefixSetting:TextComponent, donePrefixSetting:TextComponent;
    
    new Setting(detailsEl)
      .setName(t("PARSE_TODO_NAME"))
      .setDesc(fragWithHTML(t("PARSE_TODO_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.parseTODO)
          .onChange(value => {
            this.plugin.settings.parseTODO = value;
            todoPrefixSetting.setDisabled(!value);
            donePrefixSetting.setDisabled(!value);
            this.applySettingsUpdate(true);
          })
      );

    new Setting(detailsEl)
      .setName(t("TODO_NAME"))
      .setDesc(fragWithHTML(t("TODO_DESC")))
      .addText((text) => {
        todoPrefixSetting = text;
        text
          .setPlaceholder(t("INSERT_EMOJI"))
          .setValue(this.plugin.settings.todo)
          .onChange(value => {
            this.plugin.settings.todo = value;
            this.applySettingsUpdate(true);
          })
        }
      );
    todoPrefixSetting.setDisabled(!this.plugin.settings.parseTODO);

    new Setting(detailsEl)
      .setName(t("DONE_NAME"))
      .setDesc(fragWithHTML(t("DONE_DESC")))
      .setDisabled(!this.plugin.settings.parseTODO)
      .addText((text) => {
        donePrefixSetting = text;
        text
          .setPlaceholder(t("INSERT_EMOJI"))
          .setValue(this.plugin.settings.done)
          .onChange(value => {
            this.plugin.settings.done = value;
            this.applySettingsUpdate(true);
          })
        }
      );
    donePrefixSetting.setDisabled(!this.plugin.settings.parseTODO);

    createSliderWithText(detailsEl, {
      name: t("LINKOPACITY_NAME"),
      desc: t("LINKOPACITY_DESC"),
      value: this.plugin.settings.linkOpacity,
      min: 0,
      max: 1,
      step: 0.05,
      onChange: (value) => {
        this.plugin.settings.linkOpacity = value;
        this.applySettingsUpdate(true);
      },
    });

    new Setting(detailsEl)
      .setName(t("HOVERPREVIEW_NAME"))
      .setDesc(fragWithHTML(t("HOVERPREVIEW_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.hoverPreviewWithoutCTRL)
          .onChange(async (value) => {
            this.plugin.settings.hoverPreviewWithoutCTRL = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("LINK_CTRL_CLICK_NAME"))
      .setDesc(fragWithHTML(t("LINK_CTRL_CLICK_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.allowCtrlClick)
          .onChange(async (value) => {
            this.plugin.settings.allowCtrlClick = value;
            this.applySettingsUpdate();
          }),
      );

    const s = new Setting(detailsEl)
      .setName(t("TRANSCLUSION_WRAP_NAME"))
      .setDesc(fragWithHTML(t("TRANSCLUSION_WRAP_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.forceWrap)
          .onChange(async (value) => {
            this.plugin.settings.forceWrap = value;
            this.applySettingsUpdate(true);
          }),
      );
    s.descEl.innerHTML = `<code>![[doc#^ref]]{number}</code> ${t(
      "TRANSCLUSION_WRAP_DESC",
    )}`;

    new Setting(detailsEl)
      .setName(t("PAGE_TRANSCLUSION_CHARCOUNT_NAME"))
      .setDesc(fragWithHTML(t("PAGE_TRANSCLUSION_CHARCOUNT_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("Enter a number")
          .setValue(this.plugin.settings.pageTransclusionCharLimit.toString())
          .onChange(async (value) => {
            const intVal = parseInt(value);
            if (isNaN(intVal) && value !== "") {
              text.setValue(
                this.plugin.settings.pageTransclusionCharLimit.toString(),
              );
              return;
            }
            this.requestEmbedUpdate = true;
            if (value === "") {
              this.plugin.settings.pageTransclusionCharLimit = 10;
              this.applySettingsUpdate(true);
              return;
            }
            this.plugin.settings.pageTransclusionCharLimit = intVal;
            text.setValue(
              this.plugin.settings.pageTransclusionCharLimit.toString(),
            );
            this.applySettingsUpdate(true);
          }),
      );

    new Setting(detailsEl)
      .setName(t("TRANSCLUSION_DEFAULT_WRAP_NAME"))
      .setDesc(fragWithHTML(t("TRANSCLUSION_DEFAULT_WRAP_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("Enter a number")
          .setValue(this.plugin.settings.wordWrappingDefault.toString())
          .onChange(async (value) => {
            const intVal = parseInt(value);
            if (isNaN(intVal) && value !== "") {
              text.setValue(
                this.plugin.settings.wordWrappingDefault.toString(),
              );
              return;
            }
            this.requestEmbedUpdate = true;
            if (value === "") {
              this.plugin.settings.wordWrappingDefault = 0;
              this.applySettingsUpdate(true);
              return;
            }
            this.plugin.settings.wordWrappingDefault = intVal;
            text.setValue(this.plugin.settings.wordWrappingDefault.toString());
            this.applySettingsUpdate(true);
          }),
      );

    new Setting(detailsEl)
      .setName(t("QUOTE_TRANSCLUSION_REMOVE_NAME"))
      .setDesc(fragWithHTML(t("QUOTE_TRANSCLUSION_REMOVE_DESC")))
      .addToggle(toggle => 
        toggle
          .setValue(this.plugin.settings.removeTransclusionQuoteSigns)
          .onChange(value => {
            this.plugin.settings.removeTransclusionQuoteSigns = value;
            this.requestEmbedUpdate = true;
            this.applySettingsUpdate(true);
          })
      );

    new Setting(detailsEl)
      .setName(t("GET_URL_TITLE_NAME"))
      .setDesc(fragWithHTML(t("GET_URL_TITLE_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.iframelyAllowed)
          .onChange(async (value) => {
            this.plugin.settings.iframelyAllowed = value;
            this.applySettingsUpdate();
          }),
      );




    // ------------------------------------------------
    // Embed and Export
    // ------------------------------------------------
    containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    containerEl.createDiv({ text: t("EMBED_DESC"), cls: "setting-item-description"  });
    detailsEl = this.containerEl.createEl("details");
    const embedDetailsEl = detailsEl;
    detailsEl.createEl("summary", { 
      text: t("EMBED_HEAD"),
      cls: "excalidraw-setting-h1",
    });
    
    new Setting(detailsEl)
    .setName(t("EMBED_PREVIEW_IMAGETYPE_NAME"))
    .setDesc(fragWithHTML(t("EMBED_PREVIEW_IMAGETYPE_DESC")))
    .addDropdown((dropdown) => dropdown
      .addOption(PreviewImageType.PNG, "PNG Image")
      .addOption(PreviewImageType.SVG, "Native SVG")
      .addOption(PreviewImageType.SVGIMG, "SVG Image")
      .setValue(this.plugin.settings.previewImageType)
      .onChange((value) => {
        this.plugin.settings.previewImageType = value as PreviewImageType;
        this.requestEmbedUpdate=true;
        this.applySettingsUpdate();
      })
    );
    addIframe(detailsEl, "yZQoJg2RCKI");
    addIframe(detailsEl, "opLd1SqaH_I",8);

    let dropdown: DropdownComponent;
    let embedComment: Setting;
    new Setting(detailsEl)
      .setName(t("EMBED_TYPE_NAME"))
      .setDesc(fragWithHTML(t("EMBED_TYPE_DESC")))
      .addDropdown(async (d: DropdownComponent) => {
        dropdown = d;
        dropdown.addOption("excalidraw", "excalidraw");
        if (this.plugin.settings.autoexportPNG) {
          dropdown.addOption("PNG", "PNG");
        } else if (this.plugin.settings.embedType === "PNG") {
          this.plugin.settings.embedType = "excalidraw";
          this.applySettingsUpdate();
        }
        if (this.plugin.settings.autoexportSVG) {
          dropdown.addOption("SVG", "SVG");
        } else if (this.plugin.settings.embedType === "SVG") {
          this.plugin.settings.embedType = "excalidraw";
          this.applySettingsUpdate();
        }
        dropdown
          .setValue(this.plugin.settings.embedType)
          .onChange(async (value) => {
            //@ts-ignore
            this.plugin.settings.embedType = value;
            embedComment.settingEl.style.display = value === "excalidraw" ? "none":"";
            this.applySettingsUpdate();
          });
      });
    
    embedComment = new Setting(detailsEl)
      .setName(t("EMBED_MARKDOWN_COMMENT_NAME"))
      .setDesc(fragWithHTML(t("EMBED_MARKDOWN_COMMENT_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.embedMarkdownCommentLinks)
          .onChange(async (value) => {
            this.plugin.settings.embedMarkdownCommentLinks = value;
            this.applySettingsUpdate();
          }),
      );

    embedComment.settingEl.style.display = this.plugin.settings.embedType === "excalidraw" ? "none":"";

    new Setting(detailsEl)
    .setName(t("EMBED_WIKILINK_NAME"))
    .setDesc(fragWithHTML(t("EMBED_WIKILINK_DESC")))
    .addToggle((toggle) =>
      toggle
        .setValue(this.plugin.settings.embedWikiLink)
        .onChange(async (value) => {
          this.plugin.settings.embedWikiLink = value;
          this.applySettingsUpdate();
        }),
    );

    detailsEl = embedDetailsEl.createEl("details");
    detailsEl.createEl("summary", { 
      text: t("EMBED_CANVAS"),
      cls: "excalidraw-setting-h3",
    });

    new Setting(detailsEl)
      .setName(t("EMBED_CANVAS_NAME"))
      .setDesc(fragWithHTML(t("EMBED_CANVAS_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.canvasImmersiveEmbed)
          .onChange(async (value) => {
            this.plugin.settings.canvasImmersiveEmbed = value;
            this.applySettingsUpdate();
          }),
      );

    detailsEl = embedDetailsEl.createEl("details");
    detailsEl.createEl("summary", { 
      text: t("EMBED_CACHING"),
      cls: "excalidraw-setting-h3",
    });

    createSliderWithText(detailsEl, {
      name: t("RENDERING_CONCURRENCY_NAME"),
      desc: t("RENDERING_CONCURRENCY_DESC"),
      min: 1,
      max: 5,
      step: 1,
      value: this.plugin.settings.renderingConcurrency,
      onChange: (value) => {
        this.plugin.settings.renderingConcurrency = value;
        this.applySettingsUpdate();
      }
    });

    new Setting(detailsEl)
      .setName(t("EMBED_IMAGE_CACHE_NAME"))
      .setDesc(fragWithHTML(t("EMBED_IMAGE_CACHE_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.allowImageCache)
          .onChange((value) => {
            this.plugin.settings.allowImageCache = value;
            this.applySettingsUpdate();
          })
      )
    new Setting(detailsEl)
      .setName(t("SCENE_IMAGE_CACHE_NAME"))
      .setDesc(fragWithHTML(t("SCENE_IMAGE_CACHE_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.allowImageCacheInScene)
          .onChange((value) => {
            this.plugin.settings.allowImageCacheInScene = value;
            this.applySettingsUpdate();
          })
      )
    new Setting(detailsEl)
      .setName(t("EMBED_IMAGE_CACHE_CLEAR"))
      .addButton((button) =>
        button
          .setButtonText(t("EMBED_IMAGE_CACHE_CLEAR"))
          .onClick(() => {
            imageCache.clearImageCache();
          })
      )
    new Setting(detailsEl)
      .setName(t("BACKUP_CACHE_CLEAR"))
      .addButton((button) =>
        button
          .setButtonText(t("BACKUP_CACHE_CLEAR"))
          .onClick(() => {
            const confirmationPrompt = new ConfirmationPrompt(this.plugin,t("BACKUP_CACHE_CLEAR_CONFIRMATION"));
            confirmationPrompt.waitForClose.then((confirmed) => {
              if (confirmed) {
                imageCache.clearBackupCache();
              } 
            });
          })
      );

    new Setting(detailsEl)
      .setName(t("EMBED_REUSE_EXPORTED_IMAGE_NAME"))
      .setDesc(fragWithHTML(t("EMBED_REUSE_EXPORTED_IMAGE_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.displayExportedImageIfAvailable)
          .onChange(async (value) => {
            this.plugin.settings.displayExportedImageIfAvailable = value;
            this.applySettingsUpdate();
          }),
      );

    detailsEl = embedDetailsEl.createEl("details");
    const exportDetailsEl = detailsEl;
    detailsEl.createEl("summary", { 
      text: t("EXPORT_SUBHEAD"),
      cls: "excalidraw-setting-h3",
    });
    addIframe(detailsEl, "wTtaXmRJ7wg",171);

    const pdfExportEl = new Setting(detailsEl)
    .setName(t("SHOW_DRAWING_OR_MD_IN_EXPORTPDF_NAME"))
    .setDesc(fragWithHTML(t("SHOW_DRAWING_OR_MD_IN_EXPORTPDF_DESC")))
    .addToggle((toggle) =>
      toggle
        .setValue(this.plugin.settings.renderImageInMarkdownToPDF)
        .onChange(async (value) => {
          this.plugin.settings.renderImageInMarkdownToPDF = value;
          this.applySettingsUpdate();
        }),
    );
    pdfExportEl.nameEl.setAttribute("id",TAG_PDFEXPORT);

    new Setting(detailsEl)
      .setName(t("EXPORT_EMBED_SCENE_NAME"))
      .setDesc(fragWithHTML(t("EXPORT_EMBED_SCENE_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.exportEmbedScene)
          .onChange(async (value) => {
            this.plugin.settings.exportEmbedScene = value;
            this.applySettingsUpdate();
          }),
      );

    detailsEl = exportDetailsEl.createEl("details");
    detailsEl.createEl("summary", { 
      text: t("EMBED_SIZING"),
      cls: "excalidraw-setting-h4",
    });
    new Setting(detailsEl)
      .setName(t("EMBED_WIDTH_NAME"))
      .setDesc(fragWithHTML(t("EMBED_WIDTH_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("e.g.: 400")
          .setValue(this.plugin.settings.width)
          .onChange(async (value) => {
            this.plugin.settings.width = value;
            this.applySettingsUpdate();
            this.requestEmbedUpdate = true;
          }),
      );

    new Setting(detailsEl)
      .setName(t("EMBED_HEIGHT_NAME"))
      .setDesc(fragWithHTML(t("EMBED_HEIGHT_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("e.g.: 400")
          .setValue(this.plugin.settings.height)
          .onChange(async (value) => {
            this.plugin.settings.height = value;
            this.applySettingsUpdate();
            this.requestEmbedUpdate = true;
          }),
      );

    createSliderWithText(detailsEl, {
      name: t("EXPORT_PNG_SCALE_NAME"),
      desc: t("EXPORT_PNG_SCALE_DESC"),
      value: this.plugin.settings.pngExportScale,
      min: 1,
      max: 5,
      step: 0.5,
      onChange: (value) => {
        this.plugin.settings.pngExportScale = value;
        this.applySettingsUpdate();
      }
    });

    createSliderWithText(detailsEl, {
      name: t("EXPORT_PADDING_NAME"),
      desc: fragWithHTML(t("EXPORT_PADDING_DESC")),
      value: this.plugin.settings.exportPaddingSVG,
      min: 0,
      max: 50,
      step: 5,
      onChange: (value) => {
        this.plugin.settings.exportPaddingSVG = value;
        this.applySettingsUpdate();
      }
    });

    detailsEl = exportDetailsEl.createEl("details");
    detailsEl.createEl("summary", { 
      text: t("EMBED_THEME_BACKGROUND"),
      cls: "excalidraw-setting-h4",
    });
    
    new Setting(detailsEl)
    .setName(t("EXPORT_BACKGROUND_NAME"))
    .setDesc(fragWithHTML(t("EXPORT_BACKGROUND_DESC")))
    .addToggle((toggle) =>
      toggle
        .setValue(this.plugin.settings.exportWithBackground)
        .onChange(async (value) => {
          this.plugin.settings.exportWithBackground = value;
          this.applySettingsUpdate();
          this.requestEmbedUpdate = true;
        }),
    );

    new Setting(detailsEl)
      .setName(t("EXPORT_THEME_NAME"))
      .setDesc(fragWithHTML(t("EXPORT_THEME_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.exportWithTheme)
          .onChange(async (value) => {
            this.plugin.settings.exportWithTheme = value;
            this.applySettingsUpdate();
            this.requestEmbedUpdate = true;
          }),
      );

    new Setting(detailsEl)
      .setName(t("PREVIEW_MATCH_OBSIDIAN_NAME"))
      .setDesc(fragWithHTML(t("PREVIEW_MATCH_OBSIDIAN_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.previewMatchObsidianTheme)
          .onChange(async (value) => {
            this.plugin.settings.previewMatchObsidianTheme = value;
            this.applySettingsUpdate();
          }),
      );

    detailsEl = exportDetailsEl.createEl("details");
    detailsEl.createEl("summary", { 
      text: t("PDF_EXPORT_SETTINGS"),
      cls: "excalidraw-setting-h4",
    });

    new PDFExportSettingsComponent(
      detailsEl,
      this.plugin.settings.pdfSettings,
      () => {
        this.applySettingsUpdate();
      }
    ).render();

    detailsEl = exportDetailsEl.createEl("details");
    detailsEl.createEl("summary", { 
      text: t("EXPORT_HEAD"),
      cls: "excalidraw-setting-h4",
    });
    detailsEl.setAttribute("id",TAG_AUTOEXPORT);

    new Setting(detailsEl)
      .setName(t("EXPORT_SYNC_NAME"))
      .setDesc(fragWithHTML(t("EXPORT_SYNC_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.keepInSync)
          .onChange(async (value) => {
            this.plugin.settings.keepInSync = value;
            this.applySettingsUpdate();
          }),
      );

    const removeDropdownOption = (opt: string) => {
      let i = 0;
      for (i = 0; i < dropdown.selectEl.options.length; i++) {
        if ((dropdown.selectEl.item(i) as HTMLOptionElement).label === opt) {
          dropdown.selectEl.item(i).remove();
        }
      }
    };

    new Setting(detailsEl)
      .setName(t("EXPORT_SVG_NAME"))
      .setDesc(fragWithHTML(t("EXPORT_SVG_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoexportSVG)
          .onChange(async (value) => {
            if (value) {
              dropdown.addOption("SVG", "SVG");
            } else {
              if (this.plugin.settings.embedType === "SVG") {
                dropdown.setValue("excalidraw");
                this.plugin.settings.embedType = "excalidraw";
              }
              removeDropdownOption("SVG");
            }
            this.plugin.settings.autoexportSVG = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("EXPORT_PNG_NAME"))
      .setDesc(fragWithHTML(t("EXPORT_PNG_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoexportPNG)
          .onChange(async (value) => {
            if (value) {
              dropdown.addOption("PNG", "PNG");
            } else {
              if (this.plugin.settings.embedType === "PNG") {
                dropdown.setValue("excalidraw");
                this.plugin.settings.embedType = "excalidraw";
              }
              removeDropdownOption("PNG");
            }
            this.plugin.settings.autoexportPNG = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("EXPORT_BOTH_DARK_AND_LIGHT_NAME"))
      .setDesc(fragWithHTML(t("EXPORT_BOTH_DARK_AND_LIGHT_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoExportLightAndDark)
          .onChange(async (value) => {
            this.plugin.settings.autoExportLightAndDark = value;
            this.applySettingsUpdate();
          }),
      );      

    // ------------------------------------------------
    // Embedding settings
    // ------------------------------------------------   
    containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    containerEl.createDiv({ text: t("EMBED_TOEXCALIDRAW_DESC"), cls: "setting-item-description"  });

    detailsEl = this.containerEl.createEl("details");
    const embedFilesDetailsEl = detailsEl;
    detailsEl.createEl("summary", { 
      text: t("EMBED_TOEXCALIDRAW_HEAD"),
      cls: "excalidraw-setting-h1",
    });

    detailsEl = embedFilesDetailsEl.createEl("details");
    detailsEl.createEl("summary", { 
      text: t("PDF_TO_IMAGE"),
      cls: "excalidraw-setting-h3",
    });
  
    addIframe(detailsEl, "nB4cOfn0xAs");
    new Setting(detailsEl)
      .setName(t("PDF_TO_IMAGE_SCALE_NAME"))
      .setDesc(fragWithHTML(t("PDF_TO_IMAGE_SCALE_DESC")))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("0.5", "0.5")
          .addOption("1", "1")
          .addOption("2", "2")
          .addOption("3", "3")
          .addOption("4", "4")
          .addOption("5", "5")
          .addOption("6", "6")
          .setValue(`${this.plugin.settings.pdfScale}`)
          .onChange((value) => {
            this.plugin.settings.pdfScale = parseFloat(value);
            this.applySettingsUpdate();
          }),
        );

    detailsEl = embedFilesDetailsEl.createEl("details");
    detailsEl.createEl("summary", { 
      text: t("MD_EMBED_CUSTOMDATA_HEAD_NAME"),
      cls: "excalidraw-setting-h3",
    });

    new Setting(detailsEl)
    .setName(t("MD_EMBED_SINGLECLICK_EDIT_NAME"))
    .setDesc(fragWithHTML(t("MD_EMBED_SINGLECLICK_EDIT_DESC")))
    .addToggle((toggle) =>
      toggle
        .setValue(this.plugin.settings.markdownNodeOneClickEditing)
        .onChange(async (value) => {
          this.plugin.settings.markdownNodeOneClickEditing = value;
          this.applySettingsUpdate();
        })
    );

    detailsEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    detailsEl.createEl("span", {}, (el) => {
      el.innerHTML = t("MD_EMBED_CUSTOMDATA_HEAD_DESC");
    });

    new EmbeddalbeMDFileCustomDataSettingsComponent(
      detailsEl,
      this.plugin.settings.embeddableMarkdownDefaults,
      this.applySettingsUpdate,
    ).render();

    detailsEl = embedFilesDetailsEl.createEl("details");
    detailsEl.createEl("summary", { 
      text: t("MD_HEAD"),
      cls: "excalidraw-setting-h3",
    });



    new Setting(detailsEl)
      .setName(t("MD_TRANSCLUDE_WIDTH_NAME"))
      .setDesc(fragWithHTML(t("MD_TRANSCLUDE_WIDTH_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("Enter a number e.g. 500")
          .setValue(this.plugin.settings.mdSVGwidth.toString())
          .onChange(async (value) => {
            const intVal = parseInt(value);
            if (isNaN(intVal) && value !== "") {
              text.setValue(this.plugin.settings.mdSVGwidth.toString());
              return;
            }
            this.requestEmbedUpdate = true;
            if (value === "") {
              this.plugin.settings.mdSVGwidth = 500;
              this.applySettingsUpdate(true);
              return;
            }
            this.plugin.settings.mdSVGwidth = intVal;
            this.requestReloadDrawings = true;
            text.setValue(this.plugin.settings.mdSVGwidth.toString());
            this.applySettingsUpdate(true);
          }),
      );

    new Setting(detailsEl)
      .setName(t("MD_TRANSCLUDE_HEIGHT_NAME"))
      .setDesc(fragWithHTML(t("MD_TRANSCLUDE_HEIGHT_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("Enter a number e.g. 800")
          .setValue(this.plugin.settings.mdSVGmaxHeight.toString())
          .onChange(async (value) => {
            const intVal = parseInt(value);
            if (isNaN(intVal) && value !== "") {
              text.setValue(this.plugin.settings.mdSVGmaxHeight.toString());
              return;
            }
            this.requestEmbedUpdate = true;
            if (value === "") {
              this.plugin.settings.mdSVGmaxHeight = 800;
              this.applySettingsUpdate(true);
              return;
            }
            this.plugin.settings.mdSVGmaxHeight = intVal;
            this.requestReloadDrawings = true;
            text.setValue(this.plugin.settings.mdSVGmaxHeight.toString());
            this.applySettingsUpdate(true);
          }),
      );

    new Setting(detailsEl)
      .setName(t("MD_DEFAULT_FONT_NAME"))
      .setDesc(fragWithHTML(t("MD_DEFAULT_FONT_DESC")))
      .addDropdown(async (d: DropdownComponent) => {
        d.addOption("Virgil", "Virgil");
        d.addOption("Cascadia", "Cascadia");
        d.addOption("Assistant", "Assistant");
        this.app.vault
          .getFiles()
          .filter((f) => ["ttf", "woff", "woff2", "otf"].contains(f.extension) && !f.path.startsWith(this.plugin.settings.fontAssetsPath))
          .forEach((f: TFile) => {
            d.addOption(f.path, f.name);
          });
        d.setValue(this.plugin.settings.mdFont).onChange((value) => {
          this.requestReloadDrawings = true;
          this.plugin.settings.mdFont = value;
          this.applySettingsUpdate(true);
        });
      });

    new Setting(detailsEl)
      .setName(t("MD_DEFAULT_COLOR_NAME"))
      .setDesc(fragWithHTML(t("MD_DEFAULT_COLOR_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("CSS Color-name|RGB-HEX")
          .setValue(this.plugin.settings.mdFontColor)
          .onChange((value) => {
            this.requestReloadDrawings = true;
            this.plugin.settings.mdFontColor = value;
            this.applySettingsUpdate(true);
          }),
      );

    new Setting(detailsEl)
      .setName(t("MD_DEFAULT_BORDER_COLOR_NAME"))
      .setDesc(fragWithHTML(t("MD_DEFAULT_BORDER_COLOR_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("CSS Color-name|RGB-HEX")
          .setValue(this.plugin.settings.mdBorderColor)
          .onChange((value) => {
            this.requestReloadDrawings = true;
            this.plugin.settings.mdBorderColor = value;
            this.applySettingsUpdate(true);
          }),
      );

    new Setting(detailsEl)
      .setName(t("MD_CSS_NAME"))
      .setDesc(fragWithHTML(t("MD_CSS_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("filename of css file in vault")
          .setValue(this.plugin.settings.mdCSS)
          .onChange((value) => {
            this.requestReloadDrawings = true;
            this.plugin.settings.mdCSS = value;
            this.applySettingsUpdate(true);
          }),
      );



    // ------------------------------------------------
    // Non-excalidraw.com supported features
    // ------------------------------------------------
    containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    containerEl.createDiv({ text: t("NONSTANDARD_DESC"), cls: "setting-item-description"  });
    detailsEl = this.containerEl.createEl("details");
    const nonstandardDetailsEl = detailsEl;
    detailsEl.createEl("summary", { 
      text: t("NONSTANDARD_HEAD"),
      cls: "excalidraw-setting-h1",
    });

    detailsEl = nonstandardDetailsEl.createEl("details");
    detailsEl.createEl("summary", { 
      text: t("RENDER_TWEAK_HEAD"),
      cls: "excalidraw-setting-h3",
    });
    

    createSliderWithText(detailsEl, {
      name: t("MAX_IMAGE_ZOOM_IN_NAME"),
      desc: fragWithHTML(t("MAX_IMAGE_ZOOM_IN_DESC")),
      value: this.plugin.settings.areaZoomLimit,
      min: 1,
      max: 10,
      step: 0.5,
      onChange: (value) => {
        this.plugin.settings.areaZoomLimit = value;
        this.applySettingsUpdate();
        this.plugin.excalidrawConfig.updateValues(this.plugin);
      },
    });

    detailsEl = nonstandardDetailsEl.createEl("details");
    detailsEl.createEl("summary", { 
      text: t("CUSTOM_PEN_HEAD"),
      cls: "excalidraw-setting-h3",
    });
    addIframe(detailsEl, "OjNhjaH2KjI",69);
    new Setting(detailsEl)
      .setName(t("CUSTOM_PEN_NAME"))
      .setDesc(t("CUSTOM_PEN_DESC"))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("0","0")
          .addOption("1","1")
          .addOption("2","2")
          .addOption("3","3")
          .addOption("4","4")
          .addOption("5","5")
          .addOption("6","6")
          .addOption("7","7")
          .addOption("8","8")
          .addOption("9","9")
          .addOption("10","10")
          .setValue(this.plugin.settings.numberOfCustomPens.toString())
          .onChange((value)=>{
            this.plugin.settings.numberOfCustomPens = parseInt(value);
            this.requestUpdatePinnedPens = true;
            this.applySettingsUpdate(false);
          })
      )

    // ------------------------------------------------
    // Fonts supported features
    // ------------------------------------------------
    containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    containerEl.createDiv({ text: t("FONTS_DESC"), cls: "setting-item-description"  });
    detailsEl = this.containerEl.createEl("details");
    const fontsDetailsEl = detailsEl;
    detailsEl.createEl("summary", { 
      text: t("FONTS_HEAD"),
      cls: "excalidraw-setting-h1",
    });
    
    detailsEl = fontsDetailsEl.createEl("details");
    detailsEl.createEl("summary", { 
      text: t("CUSTOM_FONT_HEAD"),
      cls: "excalidraw-setting-h3",
    });
    addIframe(detailsEl, "eKFmrSQhFA4");
    new Setting(detailsEl)
      .setName(t("ENABLE_FOURTH_FONT_NAME"))
      .setDesc(fragWithHTML(t("ENABLE_FOURTH_FONT_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.experimentalEnableFourthFont)
          .onChange(async (value) => {
            this.requestReloadDrawings = true;
            this.plugin.settings.experimentalEnableFourthFont = value;
            this.applySettingsUpdate();
          }),
      );
    

    new Setting(detailsEl)
      .setName(t("FOURTH_FONT_NAME"))
      .setDesc(fragWithHTML(t("FOURTH_FONT_DESC")))
      .addDropdown(async (d: DropdownComponent) => {
        d.addOption("Virgil", "Virgil");
        this.app.vault
          .getFiles()
          .filter((f) => ["ttf", "woff", "woff2", "otf"].contains(f.extension) && !f.path.startsWith(this.plugin.settings.fontAssetsPath))
          .forEach((f: TFile) => {
            d.addOption(f.path, f.name);
          });
        d.setValue(this.plugin.settings.experimantalFourthFont).onChange(
          (value) => {
            this.requestReloadDrawings = true;
            this.plugin.settings.experimantalFourthFont = value;
            this.applySettingsUpdate(true);
            this.plugin.initializeFonts();
          },
        );
      });

      detailsEl = fontsDetailsEl.createEl("details");
      detailsEl.createEl("summary", { 
        text: t("OFFLINE_CJK_NAME"),
        cls: "excalidraw-setting-h3",
      });
  
      const cjkdescdiv = detailsEl.createDiv({ cls: "setting-item-description"  });
      cjkdescdiv.innerHTML = t("OFFLINE_CJK_DESC");

      new Setting(detailsEl)
      .setName(t("CJK_ASSETS_FOLDER_NAME"))
      .setDesc(fragWithHTML(t("CJK_ASSETS_FOLDER_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("e.g.: Excalidraw/FontAssets")
          .setValue(this.plugin.settings.fontAssetsPath)
          .onChange(async (value) => {
            this.plugin.settings.fontAssetsPath = value;
            this.applySettingsUpdate();
          }),
      );
    
      new Setting(detailsEl)
        .setName(t("LOAD_CHINESE_FONTS_NAME"))
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.loadChineseFonts)
            .onChange(async (value) => {
              this.plugin.settings.loadChineseFonts = value;
              this.applySettingsUpdate();
            }),
        );

    new Setting(detailsEl)
      .setName(t("LOAD_JAPANESE_FONTS_NAME"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.loadJapaneseFonts)
          .onChange(async (value) => {
            this.plugin.settings.loadJapaneseFonts = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("LOAD_KOREAN_FONTS_NAME"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.loadKoreanFonts)
          .onChange(async (value) => {
            this.plugin.settings.loadKoreanFonts = value;
            this.applySettingsUpdate();
          }),
      );

    // ------------------------------------------------
    // Experimental features
    // ------------------------------------------------
    containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    containerEl.createDiv( { text: t("EXPERIMENTAL_DESC"), cls: "setting-item-description"  });
    detailsEl = containerEl.createEl("details");
    const experimentalDetailsEl = detailsEl;
    detailsEl.createEl("summary", { 
      text: t("EXPERIMENTAL_HEAD"),
      cls: "excalidraw-setting-h1",
    });
  
    addIframe(detailsEl, "r08wk-58DPk");
    new Setting(detailsEl)
      .setName(t("LATEX_DEFAULT_NAME"))
      .setDesc(fragWithHTML(t("LATEX_DEFAULT_DESC")))
      .addText((text) =>
        text
          .setValue(this.plugin.settings.latexBoilerplate)
          .onChange( (value) => {
            this.plugin.settings.latexBoilerplate = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("FILETYPE_NAME"))
      .setDesc(fragWithHTML(t("FILETYPE_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.experimentalFileType)
          .onChange(async (value) => {
            this.plugin.settings.experimentalFileType = value;
            this.plugin.experimentalFileTypeDisplayToggle(value);
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("FILETAG_NAME"))
      .setDesc(fragWithHTML(t("FILETAG_DESC")))
      .addText((text) =>
        text
          .setPlaceholder(t("INSERT_EMOJI"))
          .setValue(this.plugin.settings.experimentalFileTag)
          .onChange(async (value) => {
            this.plugin.settings.experimentalFileTag = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("LIVEPREVIEW_NAME"))
      .setDesc(fragWithHTML(t("LIVEPREVIEW_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.experimentalLivePreview)
          .onChange(async (value) => {
            this.plugin.settings.experimentalLivePreview = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("FADE_OUT_EXCALIDRAW_MARKUP_NAME"))
      .setDesc(fragWithHTML(t("FADE_OUT_EXCALIDRAW_MARKUP_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.fadeOutExcalidrawMarkup)
          .onChange(async (value) => {
            this.plugin.settings.fadeOutExcalidrawMarkup = value;
            this.plugin.editorHandler.updateCMExtensionState(EDITOR_FADEOUT, value)
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("EXCALIDRAW_PROPERTIES_NAME"))
      .setDesc(fragWithHTML(t("EXCALIDRAW_PROPERTIES_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.loadPropertySuggestions)
          .onChange(async (value) => {
            this.plugin.settings.loadPropertySuggestions = value;
            this.applySettingsUpdate();
          }),
      );

    detailsEl = experimentalDetailsEl.createEl("details");
    detailsEl.createEl("summary", { 
      text: t("TASKBONE_HEAD"),
      cls: "excalidraw-setting-h3",
    });

    detailsEl.createDiv( { text: t("TASKBONE_DESC"), cls: "setting-item-description"  });
    let taskboneAPIKeyText: TextComponent;

    addIframe(detailsEl, "7gu4ETx7zro");
    new Setting(detailsEl)
    .setName(t("TASKBONE_ENABLE_NAME"))
    .setDesc(fragWithHTML(t("TASKBONE_ENABLE_DESC")))
    .addToggle((toggle) =>
      toggle
        .setValue(this.plugin.settings.taskboneEnabled)
        .onChange(async (value) => {
          taskboneAPIKeyText.setDisabled(!value);
          this.plugin.settings.taskboneEnabled = value;
          if(this.plugin.settings.taskboneAPIkey === "") {
            const apiKey = await this.plugin.taskbone.initialize(false);
            if(apiKey) {
              taskboneAPIKeyText.setValue(apiKey);
            }
          }
          this.applySettingsUpdate();
        }),
    );

    new Setting(detailsEl)
    .setName(t("TASKBONE_APIKEY_NAME"))
    .setDesc(fragWithHTML(t("TASKBONE_APIKEY_DESC")))
    .addText((text) => {
      taskboneAPIKeyText = text;
      taskboneAPIKeyText
        .setValue(this.plugin.settings.taskboneAPIkey)
        .onChange(async (value) => {
          this.plugin.settings.taskboneAPIkey = value;
          this.applySettingsUpdate();
        })
        .setDisabled(!this.plugin.settings.taskboneEnabled);
      }
    );

    // ------------------------------------------------
    // ExcalidrawAutomate
    // ------------------------------------------------
    containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    containerEl.createDiv( { cls: "setting-item-description"  }, (el)=>{
      el.innerHTML = t("EA_DESC");
    });
    detailsEl = containerEl.createEl("details");
    const eaDetailsEl = detailsEl;
    detailsEl.createEl("summary", { 
      text: t("EA_HEAD"),
      cls: "excalidraw-setting-h1",
    });

    new Setting(detailsEl)
    .setName(t("FIELD_SUGGESTER_NAME"))
    .setDesc(fragWithHTML(t("FIELD_SUGGESTER_DESC")))
    .addToggle((toggle) =>
      toggle
        .setValue(this.plugin.settings.fieldSuggester)
        .onChange(async (value) => {
          this.plugin.settings.fieldSuggester = value;
          this.applySettingsUpdate();
        }),
    );

    //STARTUP_SCRIPT_NAME
    //STARTUP_SCRIPT_BUTTON
    let startupScriptPathText: TextComponent;
    let startupScriptButton: ButtonComponent;
    const scriptExists = () => {
      const startupPath = normalizePath(this.plugin.settings.startupScriptPath.endsWith(".md")
              ? this.plugin.settings.startupScriptPath
              : this.plugin.settings.startupScriptPath + ".md");
      return Boolean(this.app.vault.getAbstractFileByPath(startupPath));
    }
    new Setting(detailsEl)
      .setName(t("STARTUP_SCRIPT_NAME"))
      .setDesc(fragWithHTML(t("STARTUP_SCRIPT_DESC")))
      .addText((text) => {
        startupScriptPathText = text;
        text
          .setValue(this.plugin.settings.startupScriptPath)
          .onChange( (value) => {
            this.plugin.settings.startupScriptPath = value;
            startupScriptButton.setButtonText(scriptExists() ? t("STARTUP_SCRIPT_BUTTON_OPEN") : t("STARTUP_SCRIPT_BUTTON_CREATE"));
            this.applySettingsUpdate();
          });
        })
      .addButton((button) => {
        startupScriptButton = button;
        startupScriptButton
          .setButtonText(scriptExists() ? t("STARTUP_SCRIPT_BUTTON_OPEN") : t("STARTUP_SCRIPT_BUTTON_CREATE"))
          .onClick(async () => {
            if(this.plugin.settings.startupScriptPath === "") {
              this.plugin.settings.startupScriptPath = normalizePath(normalizePath(this.plugin.settings.folder) + "/ExcalidrawStartup");
              startupScriptPathText.setValue(this.plugin.settings.startupScriptPath);
              this.applySettingsUpdate();
            }
            const startupPath = normalizePath(this.plugin.settings.startupScriptPath.endsWith(".md")
              ? this.plugin.settings.startupScriptPath
              : this.plugin.settings.startupScriptPath + ".md");
            let f = this.app.vault.getAbstractFileByPath(startupPath);
            if(!f) {
              f = await this.app.vault.create(startupPath, startupScript());  
            }
            startupScriptButton.setButtonText(t("STARTUP_SCRIPT_BUTTON_OPEN"));
            this.app.workspace.openLinkText(f.path,"",true);
            this.hide();
          })
      });


    // ------------------------------------------------
    // Compatibility
    // ------------------------------------------------
    containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    containerEl.createDiv( { text: t("COMPATIBILITY_DESC"), cls: "setting-item-description"  });
    detailsEl = this.containerEl.createEl("details");
    detailsEl.createEl("summary", { 
      text: t("COMPATIBILITY_HEAD"),
      cls: "excalidraw-setting-h1",
    });


    new Setting(detailsEl)
    .setName(t("DUMMY_TEXT_ELEMENT_LINT_SUPPORT_NAME"))
    .setDesc(fragWithHTML(t("DUMMY_TEXT_ELEMENT_LINT_SUPPORT_DESC")))
    .addToggle((toggle) =>
      toggle
        .setValue(this.plugin.settings.addDummyTextElement)
        .onChange((value) => {
          this.plugin.settings.addDummyTextElement = value;
          this.applySettingsUpdate();
        }),
    );

    new Setting(detailsEl)
    .setName(t("PRESERVE_TEXT_AFTER_DRAWING_NAME"))
    .setDesc(fragWithHTML(t("PRESERVE_TEXT_AFTER_DRAWING_DESC")))
    .addToggle((toggle) =>
      toggle
        .setValue(this.plugin.settings.zoteroCompatibility)
        .onChange((value) => {
          this.plugin.settings.zoteroCompatibility = value;
          this.applySettingsUpdate();
        }),
    );

    if (process.env.NODE_ENV === 'development') {
      new Setting(detailsEl)
      .setName(t("DEBUGMODE_NAME"))
      .setDesc(fragWithHTML(t("DEBUGMODE_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.isDebugMode)
          .onChange((value) => {
            this.plugin.settings.isDebugMode = value;
            setDebugging(value);
            this.applySettingsUpdate();
          }),
      );
    }


    new Setting(detailsEl)
      .setName(t("SLIDING_PANES_NAME"))
      .setDesc(fragWithHTML(t("SLIDING_PANES_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.slidingPanesSupport)
          .onChange((value) => {
            this.plugin.settings.slidingPanesSupport = value;
            this.applySettingsUpdate();
          }),
      );


    new Setting(detailsEl)
      .setName(t("COMPATIBILITY_MODE_NAME"))
      .setDesc(fragWithHTML(t("COMPATIBILITY_MODE_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.compatibilityMode)
          .onChange(async (value) => {
            this.plugin.settings.compatibilityMode = value;
            filenameEl.innerHTML = getFilenameSample();
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("EXPORT_EXCALIDRAW_NAME"))
      .setDesc(fragWithHTML(t("EXPORT_EXCALIDRAW_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoexportExcalidraw)
          .onChange(async (value) => {
            this.plugin.settings.autoexportExcalidraw = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("SYNC_EXCALIDRAW_NAME"))
      .setDesc(fragWithHTML(t("SYNC_EXCALIDRAW_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.syncExcalidraw)
          .onChange(async (value) => {
            this.plugin.settings.syncExcalidraw = value;
            this.applySettingsUpdate();
          }),
      );



    //-------------------------------------
    //Script settings
    //-------------------------------------
    const scripts = this.plugin.scriptEngine
      .getListofScripts()
      ?.map((f) => this.plugin.scriptEngine.getScriptName(f));
    if (
      Object.keys(this.plugin.settings.scriptEngineSettings).length > 0 &&
      scripts
    ) {
      const textAreaHeight = (scriptName: string, variableName: string): any => {
        const variable =
          //@ts-ignore
          this.plugin.settings.scriptEngineSettings[scriptName][variableName];
        switch (typeof variable) {
          case "object":
            return variable.height;
          default:
            return null;
        }
      };

      const getValue = (scriptName: string, variableName: string): any => {
        const variable =
          //@ts-ignore
          this.plugin.settings.scriptEngineSettings[scriptName][variableName];
        switch (typeof variable) {
          case "object":
            return variable.value;
          default:
            return variable;
        }
      };

      const setValue = (
        scriptName: string,
        variableName: string,
        value: any,
      ) => {
        switch (
          //@ts-ignore
          typeof this.plugin.settings.scriptEngineSettings[scriptName][
            variableName
          ]
        ) {
          case "object":
            //@ts-ignore
            this.plugin.settings.scriptEngineSettings[scriptName][
              variableName
            ].value = value;
            break;
          default:
            //@ts-ignore
            this.plugin.settings.scriptEngineSettings[scriptName][
              variableName
            ] = value;
        }
      };

      const addBooleanSetting = (
        scriptName: string,
        variableName: string,
        description?: string,
      ) => {
        new Setting(detailsEl)
          .setName(variableName)
          .setDesc(fragWithHTML(description ?? ""))
          .addToggle((toggle) =>
            toggle
              .setValue(getValue(scriptName, variableName))
              .onChange(async (value) => {
                setValue(scriptName, variableName, value);
                this.applySettingsUpdate();
              }),
          );
      };

      const addStringSetting = (
        scriptName: string,
        variableName: string,
        description?: string,
        valueset?: any,
      ) => {
        if (
          valueset &&
          Object.prototype.toString.call(valueset) === "[object Array]" &&
          valueset.length > 0
        ) {
          new Setting(detailsEl)
            .setName(variableName)
            .setDesc(fragWithHTML(description ?? ""))
            .addDropdown((dropdown) => {
              valueset.forEach((val: any) =>
                dropdown.addOption(val.toString(), val.toString()),
              );
              dropdown
                .setValue(getValue(scriptName, variableName))
                .onChange(async (value) => {
                  setValue(scriptName, variableName, value);
                  this.applySettingsUpdate();
                });
            });
        } else {
          if(textAreaHeight(scriptName, variableName)) {
            new Setting(detailsEl)
              .setName(variableName)
              .setDesc(fragWithHTML(description ?? ""))
              .addTextArea((text) => {
                text.inputEl.style.minHeight = textAreaHeight(scriptName, variableName);
                text.inputEl.style.minWidth = "400px";
                text.inputEl.style.width = "100%";
                text
                  .setValue(getValue(scriptName, variableName))
                  .onChange(async (value) => {
                    setValue(scriptName, variableName, value);
                    this.applySettingsUpdate();
                  });
              });
          } else {
            new Setting(detailsEl)
              .setName(variableName)
              .setDesc(fragWithHTML(description ?? ""))
              .addText((text) =>
                text
                  .setValue(getValue(scriptName, variableName))
                  .onChange(async (value) => {
                    setValue(scriptName, variableName, value);
                    this.applySettingsUpdate();
                  }),
              );
          }
        }
      };

      const addNumberSetting = (
        scriptName: string,
        variableName: string,
        description?: string,
      ) => {
        new Setting(detailsEl)
          .setName(variableName)
          .setDesc(fragWithHTML(description ?? ""))
          .addText((text) =>
            text
              .setPlaceholder("Enter a number")
              .setValue(getValue(scriptName, variableName).toString())
              .onChange(async (value) => {
                const numVal = parseFloat(value);
                if (isNaN(numVal) && value !== "") {
                  text.setValue(getValue(scriptName, variableName).toString());
                  return;
                }
                setValue(scriptName, variableName, isNaN(numVal) ? 0 : numVal);
                this.applySettingsUpdate();
              }),
          );
      };

      containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
      containerEl.createDiv( { text: t("SCRIPT_SETTINGS_DESC"), cls: "setting-item-description"  });
      detailsEl = this.containerEl.createEl("details");
      const scriptDetailsEl = detailsEl;
      detailsEl.createEl("summary", { 
        text: t("SCRIPT_SETTINGS_HEAD"),
        cls: "excalidraw-setting-h1",
      });

      addIframe(detailsEl, "H8Njp7ZXYag",52);
      Object.keys(this.plugin.settings.scriptEngineSettings)
        .filter((s) => scripts.contains(s))
        .forEach((scriptName: string) => {
          const settings =
            //@ts-ignore
            this.plugin.settings.scriptEngineSettings[scriptName];
          const values = Object.values(settings);
          if (
            values.length === 0 ||
            (values.length > 0 &&
              values
                .map((val: any): number => (val.hidden ? 0 : 1))
                .reduce((prev, cur) => prev + cur) === 0)
          ) {
            return;
          }
          detailsEl = scriptDetailsEl.createEl("details");
          detailsEl.createEl("summary", { 
            text: scriptName,
            cls: "excalidraw-setting-h3",
          });

          Object.keys(settings).forEach((variableName) => {
            const variable = settings[variableName];
            const item = variable.value ?? variable;
            switch (typeof item) {
              case "boolean":
                if (!variable.hidden) {
                  addBooleanSetting(
                    scriptName,
                    variableName,
                    variable.description,
                  );
                }
                break;
              case "string":
                if (!variable.hidden) {
                  addStringSetting(
                    scriptName,
                    variableName,
                    variable.description,
                    variable.valueset,
                  );
                }
                break;
              case "number":
                if (!variable.hidden) {
                  addNumberSetting(
                    scriptName,
                    variableName,
                    variable.description,
                  );
                }
                break;
            }
          });
        });
    }
  }
}
