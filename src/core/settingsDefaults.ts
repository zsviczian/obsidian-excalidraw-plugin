/**
 * Plugin settings data model: the persisted-settings interface and its
 * default values, decoupled from `src/core/settings.ts`'s
 * `ExcalidrawSettingTab` UI class.
 *
 * Kept separate so that files needing only the settings shape/defaults
 * (e.g. `PluginSettingsManager`) don't statically pull in the settings-tab
 * UI class and its ~50 dialog/component imports. This is also the natural
 * home for a future declarative `getSettingDefinitions()` array, since that
 * array binds directly against these same keys and defaults.
 */
import { Modifier } from "obsidian";
import { PenStyle } from "src/types/penTypes";
import { DynamicStyle, GridSettings } from "src/types/types";
import { PreviewImageType } from "src/types/utilTypes";
import { PENS } from "src/utils/pens";
import { EmbeddableMDCustomProps } from "src/shared/Dialogs/EmbeddableSettings";
import type { MarkdownImageSettings } from "src/types/markdownImageTypes";
import { ModifierKeySet, ModifierSetType } from "src/utils/modifierkeyHelper";
import { ANNOTATED_PREFIX, CROPPED_PREFIX } from "src/utils/carveout";
import { Rank } from "src/constants/actionIcons";
import { PDFExportSettings } from "src/shared/Dialogs/PDFExportSettingsComponent";
import { UIMode } from "src/shared/Dialogs/UIModeSettingComponent";
import { ScriptSettingValue } from "src/types/excalidrawAutomateTypes";
import {
  AIImageModelCapability,
  AIImageModelConfig,
  AIModelConfig,
  AIProviderProfile,
} from "src/types/AIUtilTypes";
import { getGeminiSupportedSizes } from "src/utils/geminiImageModelUtils";
import { URLs } from "src/constants/safeUrls";
import type {
  StencilLibraryData,
  StencilLibraryMigrationStatus,
  StencilLibraryStorageMode,
} from "src/types/stencilLibraryTypes";

declare const PLUGIN_VERSION: string;

export interface ExcalidrawSettings {
  showTabTitlebarButtons: boolean;
  copyLinkToElemenetAnchorTo100: boolean;
  copyFrameLinkByName: boolean;
  disableDoubleClickTextEditing: boolean;
  phoneFooterSafeAreaPadding: boolean;
  tabletFooterSafeAreaPadding: boolean;
  folder: string;
  libraryFolderPath: string;
  libraryFileName: string;
  libraryStorageMode: StencilLibraryStorageMode;
  libraryMigrationStatus: StencilLibraryMigrationStatus;
  libraryMigrationSnoozeUntil: number;
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
  autosaveIntervalDesktop: number;
  autosaveIntervalMobile: number;
  drawingFilenamePrefix: string;
  drawingEmbedPrefixWithFilename: boolean;
  drawingFilnameEmbedPostfix: string;
  drawingFilenameDateTime: string;
  useExcalidrawExtension: boolean;
  cropSuffix: string;
  cropPrefix: string;
  annotateSuffix: string;
  annotatePrefix: string;
  annotatePreserveSize: boolean;
  displaySVGInPreview: boolean; //No longer used since 1.9.13
  previewImageType: PreviewImageType; //Introduced with 1.9.13
  renderingConcurrency: number;
  imageCacheRetentionDays: number;
  allowImageCache: boolean;
  allowImageCacheInScene: boolean;
  displayExportedImageIfAvailable: boolean;
  previewMatchObsidianTheme: boolean;
  width: string;
  height: string;
  overrideObsidianFontSize: boolean;
  dynamicStyling: DynamicStyle;
  isLeftHanded: boolean;
  desktopUIMode: UIMode;
  tabletUIMode: UIMode;
  phoneUIMode: UIMode;
  iframeMatchExcalidrawTheme: boolean;
  matchTheme: boolean;
  matchThemeAlways: boolean;
  matchThemeTrigger: boolean;
  defaultMode: string;
  defaultPenMode: "never" | "mobile" | "always";
  penModeDoubleTapEraser: boolean;
  penModeSingleFingerPanning: boolean;
  penModeCrosshairVisible: boolean;
  panWithRightMouseButton: boolean; //mfuria #329
  renderImageInMarkdownReadingMode: boolean;
  renderImageInHoverPreviewForMDNotes: boolean;
  renderImageInMarkdownToPDF: boolean;
  allowPinchZoom: boolean;
  allowWheelZoom: boolean;
  zoomToFitOnOpen: boolean;
  zoomToFitOnResize: boolean;
  zoomToFitMaxLevel: number;
  zoomStep: number; // % increment per zoom action (e.g. mouse wheel)
  zoomMin: number; // minimum zoom percentage
  zoomMax: number; // maximum zoom percentage
  openInAdjacentPane: boolean;
  showSecondOrderLinks: boolean;
  focusOnFileTab: boolean;
  openInMainWorkspace: boolean;
  showLinkBrackets: boolean;
  syncElementLinkWithText: boolean;
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
  oEmbedAllowed: boolean;
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
  /**
   * If true, embed a placeholder image when no drawing is present. If false, do not embed any image.
   */
  embedPlaceholderImage: boolean;
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
  enableOnloadScripts: boolean;
  enableCommandLinks: boolean;
  //loadCount: number; //version 1.2 migration counter
  drawingOpenCount: number;
  library: string;
  library2: StencilLibraryData;
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
  markdownImageSettings: MarkdownImageSettings;
  scriptEngineSettings: {
    [key: string]: {
      [key: string]: ScriptSettingValue | string | number | boolean;
    };
  };
  //autostart permission registry for scripts calling ExcalidrawAutomate.registerAutostart();
  //deliberately a sibling of scriptEngineSettings, not reused, because this is
  //plugin/user-trusted permission state a script must not be able to silently flip
  autostartScripts: {
    [scriptName: string]: "allow" | "deny" | "unknown";
  };
  previousRelease: string;
  showReleaseNotes: boolean;
  excalidrawMasteryPromoCollapsed: boolean;
  compareManifestToPluginVersion: boolean;
  showNewVersionNotification: boolean;
  //mathjaxSourceURL: string;
  latexBoilerplate: string;
  latexPreambleLocation: string;
  taskboneEnabled: boolean;
  taskboneAPIkey: string;
  pinnedScripts: string[];
  sidepanelTabs: string[];
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
    DECAY_TIME: number;
    DECAY_LENGTH: number;
    COLOR: string;
  };
  embeddableMarkdownDefaults: EmbeddableMDCustomProps;
  markdownNodeOneClickEditing: boolean;
  canvasImmersiveEmbed: boolean;
  startupScriptPath: string;
  aiEnabled: boolean;
  aiVerboseLogging: boolean;
  aiProviderProfiles: Record<string, AIProviderProfile>;
  aiTextModelConfigs: Record<string, AIModelConfig>;
  aiImageModelConfigs: Record<string, AIImageModelConfig>;
  aiDefaultTextModel: string;
  aiDefaultMultimodalModel: string;
  aiDefaultImageGenerationModel: string;
  aiDefaultMaxOutgoingTokens: number;
  aiDefaultMaxResponseTokens: number;
  modifierKeyConfig: {
    Mac: Record<ModifierSetType, ModifierKeySet>;
    Win: Record<ModifierSetType, ModifierKeySet>;
  };
  slidingPanesSupport: boolean;
  areaZoomLimit: number;
  longPressDesktop: number;
  longPressMobile: number;
  doubleClickLinkOpenViewMode: boolean;
  rank: Rank;
  modifierKeyOverrides: { modifiers: Modifier[]; key: string }[];
  showSplashscreen: boolean;
  pdfSettings: PDFExportSettings;
  disableContextMenu: boolean;
}

const KNOWN_AI_IMAGE_MODEL_CAPABILITIES: Record<
  string,
  AIImageModelCapability
> = {
  "dall-e-2": {
    supportedSizes: ["256x256", "512x512", "1024x1024"],
    supportsPromptImageTransforms: true,
    supportsMaskImageEdits: true,
  },
  "dall-e-3": {
    supportedSizes: ["1024x1024", "1792x1024", "1024x1792"],
    supportsPromptImageTransforms: false,
    supportsMaskImageEdits: false,
  },
  "gpt-image-1": {
    supportedSizes: ["1024x1024", "1536x1024", "1024x1536"],
    supportsPromptImageTransforms: true,
    supportsMaskImageEdits: true,
  },
  "gpt-image-1-mini": {
    supportedSizes: ["1024x1024", "1536x1024", "1024x1536"],
    supportsPromptImageTransforms: true,
    supportsMaskImageEdits: true,
  },
  "gpt-image-1.5": {
    supportedSizes: ["1024x1024", "1536x1024", "1024x1536"],
    supportsPromptImageTransforms: true,
    supportsMaskImageEdits: true,
  },
  "gpt-image-2": {
    supportedSizes: ["1024x1024", "1536x1024", "1024x1536", "2048x2048"],
    supportsPromptImageTransforms: true,
    supportsMaskImageEdits: true,
  },
  "gemini-2.5-flash-image": {
    supportedSizes: getGeminiSupportedSizes("google", "gemini-2.5-flash-image"),
    supportsPromptImageTransforms: true,
    supportsMaskImageEdits: false,
  },
  "gemini-3.1-flash-image-preview": {
    supportedSizes: getGeminiSupportedSizes(
      "google",
      "gemini-3.1-flash-image-preview",
    ),
    supportsPromptImageTransforms: true,
    supportsMaskImageEdits: false,
  },
  "gemini-3-pro-image-preview": {
    supportedSizes: getGeminiSupportedSizes(
      "google",
      "gemini-3-pro-image-preview",
    ),
    supportsPromptImageTransforms: true,
    supportsMaskImageEdits: false,
  },
  "grok-imagine-image-quality": {
    supportedSizes: ["1024x1024"],
    supportsPromptImageTransforms: true,
    supportsMaskImageEdits: false,
  },
  "grok-imagine-image-pro": {
    supportedSizes: ["1024x1024"],
    supportsPromptImageTransforms: true,
    supportsMaskImageEdits: false,
  },
};

export const KNOWN_AI_PROVIDER_PROFILES: Record<string, AIProviderProfile> = {
  OpenAI: {
    provider: "openai",
    apiKey: "",
    baseURL: URLs.API_OPENAI_COM_V1,
  },
  Anthropic: {
    provider: "anthropic",
    apiKey: "",
    baseURL: URLs.API_ANTHROPIC_COM_V1,
  },
  "Google Gemini": {
    provider: "google",
    apiKey: "",
    baseURL: URLs.GENERATIVELANGUAGE_GOOGLEAPIS_COM_V1BETA,
  },
  xAI: {
    provider: "xai",
    apiKey: "",
    baseURL: URLs.API_X_AI_V1,
  },
  "OpenAI-compatible": {
    provider: "openai-compatible",
    apiKey: "",
    baseURL: URLs.API_OPENAI_COM_V1,
  },
};

export const cloneKnownAIProviderProfiles = () =>
  Object.fromEntries(
    Object.entries(KNOWN_AI_PROVIDER_PROFILES).map(([profileId, profile]) => [
      profileId,
      { ...profile },
    ]),
  );

export const KNOWN_AI_TEXT_MODEL_CONFIGS: Record<string, AIModelConfig> = {
  "gpt-5-mini": {
    providerId: "OpenAI",
    model: "gpt-5-mini",
    endpoint: "",
    multimodalSupport: true,
  },
  "claude-sonnet-4-5": {
    providerId: "Anthropic",
    model: "claude-sonnet-4-5",
    endpoint: "",
    multimodalSupport: true,
  },
  "gemini-2.5-pro": {
    providerId: "Google Gemini",
    model: "gemini-2.5-pro",
    endpoint: "",
    multimodalSupport: true,
  },
  "grok-4-fast": {
    providerId: "xAI",
    model: "grok-4-fast",
    endpoint: "",
    multimodalSupport: true,
  },
};

export const KNOWN_AI_IMAGE_MODEL_CONFIGS: Record<string, AIImageModelConfig> =
  {
    "dall-e-2": {
      providerId: "OpenAI",
      model: "dall-e-2",
      ...KNOWN_AI_IMAGE_MODEL_CAPABILITIES["dall-e-2"],
    },
    "dall-e-3": {
      providerId: "OpenAI",
      model: "dall-e-3",
      ...KNOWN_AI_IMAGE_MODEL_CAPABILITIES["dall-e-3"],
    },
    "gpt-image-1": {
      providerId: "OpenAI",
      model: "gpt-image-1",
      ...KNOWN_AI_IMAGE_MODEL_CAPABILITIES["gpt-image-1"],
    },
    "gpt-image-1-mini": {
      providerId: "OpenAI",
      model: "gpt-image-1-mini",
      ...KNOWN_AI_IMAGE_MODEL_CAPABILITIES["gpt-image-1-mini"],
    },
    "gpt-image-1.5": {
      providerId: "OpenAI",
      model: "gpt-image-1.5",
      ...KNOWN_AI_IMAGE_MODEL_CAPABILITIES["gpt-image-1.5"],
    },
    "gpt-image-2": {
      providerId: "OpenAI",
      model: "gpt-image-2",
      ...KNOWN_AI_IMAGE_MODEL_CAPABILITIES["gpt-image-2"],
    },
    "gemini-2.5-flash-image": {
      providerId: "Google Gemini",
      model: "gemini-2.5-flash-image",
      ...KNOWN_AI_IMAGE_MODEL_CAPABILITIES["gemini-2.5-flash-image"],
    },
    "gemini-3.1-flash-image-preview": {
      providerId: "Google Gemini",
      model: "gemini-3.1-flash-image-preview",
      ...KNOWN_AI_IMAGE_MODEL_CAPABILITIES["gemini-3.1-flash-image-preview"],
    },
    "gemini-3-pro-image-preview": {
      providerId: "Google Gemini",
      model: "gemini-3-pro-image-preview",
      ...KNOWN_AI_IMAGE_MODEL_CAPABILITIES["gemini-3-pro-image-preview"],
    },
    "grok-imagine-image-quality": {
      providerId: "xAI",
      model: "grok-imagine-image-quality",
      ...KNOWN_AI_IMAGE_MODEL_CAPABILITIES["grok-imagine-image-quality"],
    },
    "grok-imagine-image-pro": {
      providerId: "xAI",
      model: "grok-imagine-image-pro",
      ...KNOWN_AI_IMAGE_MODEL_CAPABILITIES["grok-imagine-image-pro"],
    },
  };

export const cloneModelConfigs = <TConfig extends AIModelConfig>(
  configs: Record<string, TConfig>,
) =>
  Object.fromEntries(
    Object.entries(configs).map(([configId, config]) => [
      configId,
      {
        ...config,
        ...((config as AIModelConfig).multimodalSupport !== undefined
          ? { multimodalSupport: (config as AIModelConfig).multimodalSupport }
          : {}),
        ...("supportedSizes" in config
          ? {
              supportedSizes: [
                ...((config as unknown as AIImageModelConfig).supportedSizes ??
                  []),
              ],
            }
          : {}),
        ...((config as unknown as AIImageModelConfig)
          .supportsPromptImageTransforms !== undefined
          ? {
              supportsPromptImageTransforms: (
                config as unknown as AIImageModelConfig
              ).supportsPromptImageTransforms,
            }
          : {}),
        ...((config as unknown as AIImageModelConfig).supportsMaskImageEdits !==
        undefined
          ? {
              supportsMaskImageEdits: (config as unknown as AIImageModelConfig)
                .supportsMaskImageEdits,
            }
          : {}),
      },
    ]),
  ) as Record<string, TConfig>;

export const DEFAULT_SETTINGS: ExcalidrawSettings = {
  showTabTitlebarButtons: true,
  copyLinkToElemenetAnchorTo100: false,
  copyFrameLinkByName: false,
  disableDoubleClickTextEditing: false,
  phoneFooterSafeAreaPadding: false,
  tabletFooterSafeAreaPadding: false,
  folder: "Excalidraw",
  libraryFolderPath: "Excalidraw/Libraries",
  libraryFileName: "local-library",
  libraryStorageMode: "vault",
  libraryMigrationStatus: "not-required",
  libraryMigrationSnoozeUntil: 0,
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
  autosaveIntervalDesktop: 60000,
  autosaveIntervalMobile: 30000,
  drawingFilenamePrefix: "Drawing ",
  drawingEmbedPrefixWithFilename: true,
  drawingFilnameEmbedPostfix: " ",
  drawingFilenameDateTime: "YYYY-MM-DD HH.mm.ss",
  useExcalidrawExtension: true,
  cropSuffix: "",
  cropPrefix: CROPPED_PREFIX,
  annotateSuffix: "",
  annotatePrefix: ANNOTATED_PREFIX,
  annotatePreserveSize: false,
  displaySVGInPreview: false,
  previewImageType: PreviewImageType.SVG,
  renderingConcurrency: 3,
  imageCacheRetentionDays: 30,
  allowImageCache: true,
  allowImageCacheInScene: true,
  displayExportedImageIfAvailable: false,
  previewMatchObsidianTheme: false,
  width: "400",
  height: "",
  overrideObsidianFontSize: false,
  dynamicStyling: "colorful",
  isLeftHanded: false,
  desktopUIMode: "tray",
  tabletUIMode: "compact",
  phoneUIMode: "mobile",
  iframeMatchExcalidrawTheme: true,
  matchTheme: false,
  matchThemeAlways: false,
  matchThemeTrigger: false,
  defaultMode: "normal",
  defaultPenMode: "never",
  penModeDoubleTapEraser: true,
  penModeSingleFingerPanning: true,
  penModeCrosshairVisible: true,
  panWithRightMouseButton: false, //mfuria #329
  renderImageInMarkdownReadingMode: false,
  renderImageInHoverPreviewForMDNotes: false,
  renderImageInMarkdownToPDF: false,
  allowPinchZoom: false,
  allowWheelZoom: false,
  zoomToFitOnOpen: true,
  zoomToFitOnResize: false,
  zoomToFitMaxLevel: 2,
  zoomStep: 0.05,
  zoomMin: 0.1,
  zoomMax: 30,
  linkPrefix: "",
  urlPrefix: "",
  parseTODO: false,
  todo: "☐",
  done: "🗹",
  hoverPreviewWithoutCTRL: false,
  linkOpacity: 1,
  openInAdjacentPane: true,
  showSecondOrderLinks: true,
  focusOnFileTab: true,
  openInMainWorkspace: true,
  showLinkBrackets: false,
  syncElementLinkWithText: false,
  allowCtrlClick: true,
  forceWrap: false,
  pageTransclusionCharLimit: 200,
  wordWrappingDefault: 0,
  removeTransclusionQuoteSigns: true,
  oEmbedAllowed: false,
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
  embedPlaceholderImage: true,
  syncExcalidraw: false,
  experimentalFileType: false,
  experimentalFileTag: "✏️",
  experimentalLivePreview: true,
  fadeOutExcalidrawMarkup: false,
  loadPropertySuggestions: false,
  experimentalEnableFourthFont: false,
  experimantalFourthFont: "Virgil",
  addDummyTextElement: false,
  zoteroCompatibility: false,
  fieldSuggester: true,
  enableOnloadScripts: false,
  enableCommandLinks: false,
  compatibilityMode: false,
  //loadCount: 0,
  drawingOpenCount: 0,
  library: `deprecated`,
  library2: {
    type: "excalidrawlib",
    version: 2,
    source: `${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_RELEASES_TAG}/${PLUGIN_VERSION}`,
    libraryItems: [],
  },
  //patchCommentBlock: true,
  imageElementNotice: true,
  //runWYSIWYGpatch: true,
  //fixInfinitePreviewLoop: true,
  mdSVGwidth: 500,
  mdSVGmaxHeight: 800,
  mdFont: "Cascadia",
  mdFontColor: "Black",
  mdBorderColor: "Black",
  mdCSS: "",
  markdownImageSettings: {
    defaults: {
      width: 500,
      paddingBottom: 10,
      fontFamily: "Cascadia",
      fontColor: "Black",
      border: {
        enabled: false,
        color: "Black",
      },
      css: "",
      transclusion: {
        enabled: false,
        fontFamily: "Cascadia",
        fontColor: "Black",
        border: {
          enabled: false,
          color: "Black",
        },
        css: "",
      },
    },
  },
  scriptEngineSettings: {},
  autostartScripts: {},
  previousRelease: "0.0.0",
  showReleaseNotes: true,
  excalidrawMasteryPromoCollapsed: false,
  compareManifestToPluginVersion: true,
  showNewVersionNotification: true,
  latexBoilerplate: "\\color{green}e=mc^2",
  latexPreambleLocation: "preamble.sty",
  taskboneEnabled: false,
  taskboneAPIkey: "",
  pinnedScripts: [],
  sidepanelTabs: [],
  customPens: [
    { ...PENS.default },
    { ...PENS.highlighter },
    { ...PENS.finetip },
    { ...PENS.fountain },
    { ...PENS.marker },
    { ...PENS["thick-thin"] },
    { ...PENS["thin-thick-thin"] },
    { ...PENS.default },
    { ...PENS.default },
    { ...PENS.default },
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
    GRID_DIRECTION: { horizontal: true, vertical: true },
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
    lockedReadingMode: false,
  },
  markdownNodeOneClickEditing: false,
  canvasImmersiveEmbed: true,
  startupScriptPath: "",
  aiEnabled: true,
  aiVerboseLogging: false,
  aiProviderProfiles: cloneKnownAIProviderProfiles(),
  aiTextModelConfigs: cloneModelConfigs(KNOWN_AI_TEXT_MODEL_CONFIGS),
  aiImageModelConfigs: cloneModelConfigs(KNOWN_AI_IMAGE_MODEL_CONFIGS),
  aiDefaultTextModel: "gpt-5-mini",
  aiDefaultMultimodalModel: "gpt-5-mini",
  aiDefaultImageGenerationModel: "gpt-image-1",
  aiDefaultMaxOutgoingTokens: 0,
  aiDefaultMaxResponseTokens: 0,
  modifierKeyConfig: {
    Mac: {
      LocalFileDragAction: {
        defaultAction: "image-import",
        rules: [
          {
            shift: false,
            ctrl_cmd: false,
            alt_opt: false,
            meta_ctrl: false,
            result: "image-import",
          },
          {
            shift: true,
            ctrl_cmd: false,
            alt_opt: true,
            meta_ctrl: false,
            result: "link",
          },
          {
            shift: true,
            ctrl_cmd: false,
            alt_opt: false,
            meta_ctrl: false,
            result: "image-url",
          },
          {
            shift: false,
            ctrl_cmd: false,
            alt_opt: true,
            meta_ctrl: false,
            result: "embeddable",
          },
        ],
      },
      WebBrowserDragAction: {
        defaultAction: "image-url",
        rules: [
          {
            shift: false,
            ctrl_cmd: false,
            alt_opt: false,
            meta_ctrl: false,
            result: "image-url",
          },
          {
            shift: true,
            ctrl_cmd: false,
            alt_opt: true,
            meta_ctrl: false,
            result: "link",
          },
          {
            shift: false,
            ctrl_cmd: false,
            alt_opt: true,
            meta_ctrl: false,
            result: "embeddable",
          },
          {
            shift: true,
            ctrl_cmd: false,
            alt_opt: false,
            meta_ctrl: false,
            result: "image-import",
          },
        ],
      },
      InternalDragAction: {
        defaultAction: "link",
        rules: [
          {
            shift: false,
            ctrl_cmd: false,
            alt_opt: false,
            meta_ctrl: false,
            result: "link",
          },
          {
            shift: false,
            ctrl_cmd: false,
            alt_opt: false,
            meta_ctrl: true,
            result: "embeddable",
          },
          {
            shift: true,
            ctrl_cmd: false,
            alt_opt: false,
            meta_ctrl: false,
            result: "image",
          },
          {
            shift: true,
            ctrl_cmd: false,
            alt_opt: false,
            meta_ctrl: true,
            result: "image-fullsize",
          },
        ],
      },
      LinkClickAction: {
        defaultAction: "new-tab",
        rules: [
          {
            shift: true,
            ctrl_cmd: true,
            alt_opt: false,
            meta_ctrl: false,
            result: "active-pane",
          },
          {
            shift: false,
            ctrl_cmd: true,
            alt_opt: false,
            meta_ctrl: false,
            result: "new-tab",
          },
          {
            shift: false,
            ctrl_cmd: true,
            alt_opt: true,
            meta_ctrl: false,
            result: "new-pane",
          },
          {
            shift: true,
            ctrl_cmd: true,
            alt_opt: true,
            meta_ctrl: false,
            result: "popout-window",
          },
          {
            shift: false,
            ctrl_cmd: true,
            alt_opt: false,
            meta_ctrl: true,
            result: "md-properties",
          },
        ],
      },
    },
    Win: {
      LocalFileDragAction: {
        defaultAction: "image-import",
        rules: [
          {
            shift: false,
            ctrl_cmd: false,
            alt_opt: false,
            meta_ctrl: false,
            result: "image-import",
          },
          {
            shift: false,
            ctrl_cmd: true,
            alt_opt: false,
            meta_ctrl: false,
            result: "link",
          },
          {
            shift: true,
            ctrl_cmd: false,
            alt_opt: false,
            meta_ctrl: false,
            result: "image-url",
          },
          {
            shift: true,
            ctrl_cmd: true,
            alt_opt: false,
            meta_ctrl: false,
            result: "embeddable",
          },
        ],
      },
      WebBrowserDragAction: {
        defaultAction: "image-url",
        rules: [
          {
            shift: false,
            ctrl_cmd: false,
            alt_opt: false,
            meta_ctrl: false,
            result: "image-url",
          },
          {
            shift: false,
            ctrl_cmd: true,
            alt_opt: false,
            meta_ctrl: false,
            result: "link",
          },
          {
            shift: true,
            ctrl_cmd: true,
            alt_opt: false,
            meta_ctrl: false,
            result: "embeddable",
          },
          {
            shift: true,
            ctrl_cmd: false,
            alt_opt: false,
            meta_ctrl: false,
            result: "image-import",
          },
        ],
      },
      InternalDragAction: {
        defaultAction: "link",
        rules: [
          {
            shift: false,
            ctrl_cmd: false,
            alt_opt: false,
            meta_ctrl: false,
            result: "link",
          },
          {
            shift: true,
            ctrl_cmd: true,
            alt_opt: false,
            meta_ctrl: false,
            result: "embeddable",
          },
          {
            shift: true,
            ctrl_cmd: false,
            alt_opt: false,
            meta_ctrl: false,
            result: "image",
          },
          {
            shift: false,
            ctrl_cmd: true,
            alt_opt: true,
            meta_ctrl: false,
            result: "image-fullsize",
          },
        ],
      },
      LinkClickAction: {
        defaultAction: "new-tab",
        rules: [
          {
            shift: false,
            ctrl_cmd: false,
            alt_opt: false,
            meta_ctrl: false,
            result: "active-pane",
          },
          {
            shift: false,
            ctrl_cmd: true,
            alt_opt: false,
            meta_ctrl: false,
            result: "new-tab",
          },
          {
            shift: false,
            ctrl_cmd: true,
            alt_opt: true,
            meta_ctrl: false,
            result: "new-pane",
          },
          {
            shift: true,
            ctrl_cmd: true,
            alt_opt: true,
            meta_ctrl: false,
            result: "popout-window",
          },
          {
            shift: false,
            ctrl_cmd: true,
            alt_opt: false,
            meta_ctrl: true,
            result: "md-properties",
          },
        ],
      },
    },
  },
  slidingPanesSupport: false,
  areaZoomLimit: 1,
  longPressDesktop: 500,
  longPressMobile: 500,
  doubleClickLinkOpenViewMode: true,
  rank: "Bronze",
  modifierKeyOverrides: [
    { modifiers: ["Mod"], key: "Enter" },
    { modifiers: ["Mod"], key: "k" },
    { modifiers: ["Mod"], key: "G" },
  ],
  showSplashscreen: true,
  pdfSettings: {
    pageSize: "A4",
    pageOrientation: "portrait",
    fitToPage: 1,
    paperColor: "white",
    customPaperColor: "#ffffff",
    alignment: "center",
    margin: "normal",
  },
  disableContextMenu: false,
};
