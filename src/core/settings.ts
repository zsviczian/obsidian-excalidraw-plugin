import {
  App,
  ButtonComponent,
  DropdownComponent,
  Modifier,
  normalizePath,
  PluginSettingTab,
  Setting,
  TextComponent,
  TFile,
} from "obsidian";
import {
  GITHUB_RELEASES,
  LOGO_EXCALIDRAW_MASTERY,
  mainDocument,
  setRootElementSize,
} from "src/constants/constants";
import { t } from "src/lang/helpers";
import type ExcalidrawPlugin from "src/core/main";
import { PenStyle } from "src/types/penTypes";
import { DynamicStyle, GridSettings } from "src/types/types";
import { PreviewImageType } from "src/types/utilTypes";
import { setDynamicStyle } from "src/utils/dynamicStyling";
import {
  createOrOverwriteFile,
  getDrawingFilename,
  getEmbedFilename,
} from "src/utils/fileUtils";
import { PENS } from "src/utils/pens";
import { addYouTubeThumbnail, fragWithHTML } from "src/utils/utils";
import { setElementIconAndText, setSanitizedHtml } from "src/utils/htmlUtils";
import { imageCache } from "src/shared/ImageCache";
import { MultiOptionConfirmationPrompt } from "src/shared/Dialogs/Prompt";
import { EmbeddableMDCustomProps } from "src/shared/Dialogs/EmbeddableSettings";
import { EmbeddalbeMDFileCustomDataSettingsComponent } from "src/shared/Dialogs/EmbeddableMDFileCustomDataSettingsComponent";
import { startupScript } from "src/constants/starutpscript";
import { ModifierKeySet, ModifierSetType } from "src/utils/modifierkeyHelper";
import { ModifierKeySettingsComponent } from "src/shared/Dialogs/ModifierKeySettings";
import { ANNOTATED_PREFIX, CROPPED_PREFIX } from "src/utils/carveout";
import { EDITOR_FADEOUT } from "src/core/editor/EditorHandler";
import { Rank } from "src/constants/actionIcons";
import {
  TAG_AUTOEXPORT,
  TAG_MDREADINGMODE,
  TAG_PDFEXPORT,
} from "src/constants/constSettingsTags";
import { HotkeyEditor } from "src/shared/Dialogs/HotkeyEditor";
import { getExcalidrawViews } from "src/utils/obsidianUtils";
import { createSliderWithText } from "src/utils/sliderUtils";
import {
  PDFExportSettingsComponent,
  PDFExportSettings,
} from "src/shared/Dialogs/PDFExportSettingsComponent";
import { ContentSearcher } from "src/shared/components/ContentSearcher";
import {
  UIMode,
  UIModeSettingsComponent,
} from "src/shared/Dialogs/UIModeSettingComponent";
import { ScriptSettingValue } from "src/types/excalidrawAutomateTypes";
import {
  AIImageModelCapability,
  AIImageModelConfig,
  AIModelConfig,
  AIProviderProfile,
} from "src/types/AIUtilTypes";
import { AIProviderProfileModal } from "src/shared/Dialogs/AIProviderProfileModal";
import { AIModelConfigModal } from "src/shared/Dialogs/AIModelConfigModal";
import { AIUsageModal } from "src/shared/Dialogs/AIUsageModal";
import { getAIUsage, formatAIUsageLabel } from "src/utils/AIUtils";
import { decryptProviderProfiles } from "src/utils/settingsKeyObfuscation";
import { getGeminiSupportedSizes } from "src/utils/geminiImageModelUtils";
import { URLs } from "src/constants/safeUrls";

export interface ExcalidrawSettings {
  showTabTitlebarButtons: boolean;
  copyLinkToElemenetAnchorTo100: boolean;
  copyFrameLinkByName: boolean;
  disableDoubleClickTextEditing: boolean;
  phoneFooterSafeAreaPadding: boolean;
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
  library2: object;
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
    [key: string]: {
      [key: string]: ScriptSettingValue | string | number | boolean;
    };
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
  aiVisionModelConfigs: Record<string, AIModelConfig>;
  aiImageModelConfigs: Record<string, AIImageModelConfig>;
  aiProvider: "openai" | "anthropic" | "google" | "xai" | "openai-compatible";
  aiAPIKey: string;
  aiBaseURL: string;
  aiTextEndpoint: string;
  aiImageGenerationEndpoint: string;
  aiImageEditsEndpoint: string;
  aiImageVariationsEndpoint: string;
  aiDefaultTextModel: string;
  aiDefaultMultimodalModel: string;
  aiDefaultVisionModel: string;
  aiDefaultImageGenerationModel: string;
  aiImageModelCapabilities: Record<string, AIImageModelCapability>;
  aiDefaultMaxOutgoingTokens: number;
  aiDefaultMaxResponseTokens: number;
  aiDefaultMaxTokens: number; //legacy migration source, do not use directly
  openAIAPIToken: string;
  openAIDefaultTextModel: string;
  openAIDefaultTextModelMaxTokens: number;
  openAIDefaultVisionModel: string;
  openAIDefaultImageGenerationModel: string;
  openAIURL: string;
  openAIImageGenerationURL: string;
  openAIImageEditsURL: string;
  openAIImageVariationURL: string;
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

declare const PLUGIN_VERSION: string;

const configurePasswordTextInput = (text: TextComponent) => {
  const { inputEl } = text;
  inputEl.type = "password";
  inputEl.autocomplete = "off";
  inputEl.spellcheck = false;
  inputEl.addEventListener("focus", () => {
    inputEl.type = "text";
  });
  inputEl.addEventListener("blur", () => {
    inputEl.type = "password";
  });
};

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

const cloneKnownAIImageModelCapabilities = () =>
  Object.fromEntries(
    Object.entries(KNOWN_AI_IMAGE_MODEL_CAPABILITIES).map(
      ([model, capability]) => [
        model,
        {
          supportedSizes: [...capability.supportedSizes],
          supportsPromptImageTransforms:
            capability.supportsPromptImageTransforms,
          supportsMaskImageEdits: capability.supportsMaskImageEdits,
        },
      ],
    ),
  );

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

export const KNOWN_AI_VISION_MODEL_CONFIGS: Record<string, AIModelConfig> =
  Object.fromEntries(
    Object.entries(KNOWN_AI_TEXT_MODEL_CONFIGS).map(([modelId, config]) => [
      modelId,
      { ...config },
    ]),
  );

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
    source: GITHUB_RELEASES + PLUGIN_VERSION,
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
  scriptEngineSettings: {},
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
  },
  markdownNodeOneClickEditing: false,
  canvasImmersiveEmbed: true,
  startupScriptPath: "",
  aiEnabled: true,
  aiVerboseLogging: false,
  aiProviderProfiles: cloneKnownAIProviderProfiles(),
  aiTextModelConfigs: cloneModelConfigs(KNOWN_AI_TEXT_MODEL_CONFIGS),
  aiVisionModelConfigs: cloneModelConfigs(KNOWN_AI_VISION_MODEL_CONFIGS),
  aiImageModelConfigs: cloneModelConfigs(KNOWN_AI_IMAGE_MODEL_CONFIGS),
  aiProvider: "openai",
  aiAPIKey: "",
  aiBaseURL: "",
  aiTextEndpoint: "",
  aiImageGenerationEndpoint: "",
  aiImageEditsEndpoint: "",
  aiImageVariationsEndpoint: "",
  aiDefaultTextModel: "gpt-5-mini",
  aiDefaultMultimodalModel: "gpt-5-mini",
  aiDefaultVisionModel: "gpt-5-mini",
  aiDefaultImageGenerationModel: "gpt-image-1",
  aiImageModelCapabilities: cloneKnownAIImageModelCapabilities(),
  aiDefaultMaxOutgoingTokens: 0,
  aiDefaultMaxResponseTokens: 0,
  aiDefaultMaxTokens: 0,
  openAIAPIToken: "",
  openAIDefaultTextModel: "gpt-5-mini",
  openAIDefaultTextModelMaxTokens: 4096,
  openAIDefaultVisionModel: "gpt-5-mini",
  openAIDefaultImageGenerationModel: "gpt-image-1",
  openAIURL: URLs.API_OPENAI_COM_V1_CHAT_COMPLETIONS,
  openAIImageGenerationURL: URLs.API_OPENAI_COM_V1_IMAGES_GENERATIONS,
  openAIImageEditsURL: URLs.API_OPENAI_COM_V1_IMAGES_EDITS,
  openAIImageVariationURL: URLs.API_OPENAI_COM_V1_IMAGES_VARIATIONS,
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

export class ExcalidrawSettingTab extends PluginSettingTab {
  plugin: ExcalidrawPlugin;
  private requestEmbedUpdate: boolean = false;
  private requestReloadDrawings: boolean = false;
  private requestUpdatePinnedPens: boolean = false;
  private requestUpdateDynamicStyling: boolean = false;
  private settingsDirty: boolean = false;
  private settingsRevision: number = 0;
  private isPersistingSettings: boolean = false;
  private settingsFocusoutHandler: ((event: FocusEvent) => void) | null = null;
  private hotkeyEditor: HotkeyEditor;
  //private reloadMathJax: boolean = false;
  //private applyDebounceTimer: number = 0;

  constructor(app: App, plugin: ExcalidrawPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  private markSettingsDirty() {
    this.settingsDirty = true;
    this.settingsRevision += 1;
  }

  private normalizeSettingsBeforeSave() {
    this.plugin.settings.scriptFolderPath = normalizePath(
      this.plugin.settings.scriptFolderPath,
    );
    if (
      this.plugin.settings.scriptFolderPath === "/" ||
      this.plugin.settings.scriptFolderPath === ""
    ) {
      this.plugin.settings.scriptFolderPath = "Excalidraw/Scripts";
    }
  }

  private async persistDirtySettings() {
    if (!this.settingsDirty || this.isPersistingSettings) {
      return;
    }

    this.isPersistingSettings = true;
    try {
      while (this.settingsDirty) {
        const revisionToSave = this.settingsRevision;
        this.normalizeSettingsBeforeSave();
        await this.plugin.saveSettings();
        if (this.settingsRevision === revisionToSave) {
          this.settingsDirty = false;
        }
      }
    } finally {
      this.isPersistingSettings = false;
    }
  }

  private detachSettingsFocusoutHandler() {
    if (!this.settingsFocusoutHandler) {
      return;
    }
    this.containerEl.removeEventListener(
      "focusout",
      this.settingsFocusoutHandler,
    );
    this.settingsFocusoutHandler = null;
  }

  private hasPendingActions(): boolean {
    return (
      this.requestUpdatePinnedPens ||
      this.requestUpdateDynamicStyling ||
      this.requestReloadDrawings ||
      this.requestEmbedUpdate
    );
  }

  private attachSettingsFocusoutHandler() {
    this.detachSettingsFocusoutHandler();
    this.settingsFocusoutHandler = (event: FocusEvent) => {
      window.setTimeout(() => {
        if (!this.containerEl?.isConnected) {
          return;
        }

        const nextFocusTarget =
          (event.relatedTarget as Node | null) ??
          this.containerEl.ownerDocument.activeElement;
        if (nextFocusTarget && this.containerEl.contains(nextFocusTarget)) {
          return;
        }

        // Execute pending actions if settings are dirty or if there are pending actions
        if (this.settingsDirty || this.hasPendingActions()) {
          void this.persistDirtySettings().then(() =>
            this.applyPendingActions(),
          );
        }
      }, 0);
    };
    this.containerEl.addEventListener("focusout", this.settingsFocusoutHandler);
  }

  private async applyPendingActions() {
    if (this.requestUpdatePinnedPens) {
      this.requestUpdatePinnedPens = false;
      getExcalidrawViews(this.app, true).forEach((excalidrawView) =>
        excalidrawView.updatePinnedCustomPens(),
      );
    }
    if (this.requestUpdateDynamicStyling) {
      this.requestUpdateDynamicStyling = false;
      getExcalidrawViews(this.app, true).forEach((excalidrawView) =>
        setDynamicStyle(
          this.plugin.ea,
          excalidrawView,
          excalidrawView.previousBackgroundColor,
          this.plugin.settings.dynamicStyling,
        ),
      );
    }
    if (this.requestReloadDrawings) {
      this.requestReloadDrawings = false;
      const excalidrawViews = getExcalidrawViews(this.app, true);
      for (const excalidrawView of excalidrawViews) {
        await excalidrawView.save(false);
        //debug({where:"ExcalidrawSettings.hide",file:v.view.file.name,before:"reload(true)"})
        await excalidrawView.reload(true);
      }
      this.requestEmbedUpdate = true;
    }
    if (this.requestEmbedUpdate) {
      this.requestEmbedUpdate = false;
      this.plugin.triggerEmbedUpdates();
    }
  }

  applySettingsUpdate(requestReloadDrawings: boolean = false) {
    this.markSettingsDirty();
    if (requestReloadDrawings) {
      this.requestReloadDrawings = true;
    }
  }

  async hide() {
    this.detachSettingsFocusoutHandler();
    if (this.plugin.settings.overrideObsidianFontSize) {
      mainDocument.documentElement.style.fontSize = "";
      setRootElementSize(16);
    } else if (!mainDocument.documentElement.style.fontSize) {
      mainDocument.documentElement.style.fontSize = getComputedStyle(
        mainDocument.body,
      ).getPropertyValue("--font-text-size");
      setRootElementSize();
    }

    await this.persistDirtySettings();
    await this.applyPendingActions();
    this.hotkeyEditor.unload();
    if (this.hotkeyEditor.isDirty) {
      this.plugin.registerHotkeyOverrides();
    }
    this.plugin.scriptEngine.updateScriptPath();
    /*    if(this.reloadMathJax) {
      this.plugin.loadMathJax();
    }*/
  }

  async display() {
    let detailsEl: HTMLElement;

    await this.plugin.loadSettings(); //in case sync loaded changed settings in the background
    this.settingsDirty = false;
    this.requestEmbedUpdate = false;
    this.requestReloadDrawings = false;
    const { containerEl } = this;
    containerEl.addClass("excalidraw-settings");
    this.containerEl.empty();
    this.attachSettingsFocusoutHandler();

    // ------------------------------------------------
    // Search and Settings to Clipboard
    // ------------------------------------------------

    const notebookLMLinkContainer = createDiv(
      "setting-item-description excalidraw-settings-links-container",
    );
    new ContentSearcher(containerEl, notebookLMLinkContainer);
    notebookLMLinkContainer.createEl(
      "a",
      {
        href: URLs.NOTEBOOKLM_GOOGLE_COM_NOTEBOOK_42D76A2F_C11D_4002_9286_1683C43D0AB0,
        attr: {
          "aria-label": t("NOTEBOOKLM_LINK_ARIA"),
          style: "margin: auto;",
        },
      },
      (a) => {
        setElementIconAndText(
          a,
          "message-circle-question-mark",
          t("NOTEBOOKLM_LINK_TEXT"),
        );
      },
    );

    const excalidrawMasteryPromo = containerEl.createEl("details", {
      cls: "setting-item-description excalidraw-mastery-promo",
    });
    excalidrawMasteryPromo.open =
      !this.plugin.settings.excalidrawMasteryPromoCollapsed;
    excalidrawMasteryPromo.classList.toggle(
      "is-collapsed",
      this.plugin.settings.excalidrawMasteryPromoCollapsed,
    );

    const excalidrawMasterySummary = excalidrawMasteryPromo.createEl(
      "summary",
      {
        cls: "excalidraw-mastery-promo__summary",
      },
    );
    const excalidrawMasterySummaryTitle = excalidrawMasterySummary.createEl(
      "span",
      {
        cls: "excalidraw-mastery-promo__summary-title",
        text: "Excalidraw Mastery",
      },
    );
    const excalidrawMasterySummaryState = excalidrawMasterySummary.createEl(
      "span",
      {
        cls: "excalidraw-mastery-promo__summary-state",
      },
    );

    const excalidrawMasteryLink = URLs.COMMUNITY_SKETCH_YOUR_MIND_COM_EM;
    const updateExcalidrawMasteryPromoState = (persist: boolean) => {
      const isCollapsed = !excalidrawMasteryPromo.open;
      this.plugin.settings.excalidrawMasteryPromoCollapsed = isCollapsed;
      excalidrawMasteryPromo.classList.toggle("is-collapsed", isCollapsed);
      excalidrawMasterySummaryTitle.classList.toggle("is-hidden", !isCollapsed);
      excalidrawMasterySummaryState.setText(
        isCollapsed
          ? t("EXCALIDRAW_MASTERY_PROMO_SHOW")
          : t("EXCALIDRAW_MASTERY_PROMO_HIDE"),
      );
      if (persist) {
        void this.plugin.saveSettings();
      }
    };

    excalidrawMasteryPromo.addEventListener("toggle", () =>
      updateExcalidrawMasteryPromoState(true),
    );
    updateExcalidrawMasteryPromoState(false);

    const excalidrawMasteryContent = excalidrawMasteryPromo.createDiv({
      cls: "excalidraw-mastery-promo__content",
    });
    const excalidrawMasteryImageLink = excalidrawMasteryContent.createEl("a", {
      cls: "excalidraw-mastery-promo__image-link",
      href: excalidrawMasteryLink,
      attr: {
        "aria-label": t("EXCALIDRAW_MASTERY_PROMO_ARIA"),
        target: "_blank",
        rel: "noopener noreferrer",
      },
    });
    excalidrawMasteryImageLink.createEl("img", {
      cls: "excalidraw-mastery-promo__image",
      attr: {
        src: LOGO_EXCALIDRAW_MASTERY,
        alt: "Excalidraw Mastery",
      },
    });

    const excalidrawMasteryText = excalidrawMasteryContent.createDiv({
      cls: "excalidraw-mastery-promo__text",
    });
    setSanitizedHtml(excalidrawMasteryText, t("EXCALIDRAW_MASTERY_PROMO_HTML"));
    excalidrawMasteryText
      .querySelectorAll("a")
      .forEach((anchor: HTMLAnchorElement) => {
        anchor.setAttribute("aria-label", t("EXCALIDRAW_MASTERY_PROMO_ARIA"));
        anchor.setAttribute("target", "_blank");
        anchor.setAttribute("rel", "noopener noreferrer");
      });

    // ------------------------------------------------
    // Promo links
    // ------------------------------------------------

    const coffeeDiv = containerEl.createDiv("coffee");
    coffeeDiv.addClass("ex-coffee-div");
    const coffeeLink = coffeeDiv.createEl("a", {
      href: URLs.KO_FI_COM_ZSOLT,
    });
    const coffeeImg = coffeeLink.createEl("img", {
      attr: {
        src: URLs.CDN_KO_FI_COM_CDN_KOFI3_PNG,
      },
    });
    coffeeImg.height = 45;

    const iconLinks = [
      {
        icon: "bug",
        href: URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_ISSUES,
        aria: t("LINKS_BUGS_ARIA"),
        text: t("LINKS_BUGS"),
      },
      {
        icon: "globe",
        href: URLs.COMMUNITY_SKETCH_YOUR_MIND_COM_WIKI,
        aria: t("LINKS_WIKI_ARIA"),
        text: t("LINKS_WIKI"),
      },
      {
        icon: "youtube",
        href: URLs.WWW_YOUTUBE_COM_VISUALPKM,
        aria: t("LINKS_YT_ARIA"),
        text: t("LINKS_YT"),
      },
      {
        icon: "graduation-cap",
        href: URLs.COMMUNITY_SKETCH_YOUR_MIND_COM_EE,
        aria: t("LINKS_JOIN_SYM_ARIA"),
        text: t("LINKS_JOIN_SYM"),
      },
      {
        icon: "twitter",
        href: URLs.TWITTER_COM_ZSVICZIAN,
        aria: t("LINKS_TWITTER"),
        text: t("LINKS_TWITTER"),
      },
      {
        icon: "book",
        href: URLs.COMMUNITY_SKETCH_YOUR_MIND_COM_SYM,
        aria: t("LINKS_BOOK_ARIA"),
        text: t("LINKS_BOOK"),
      },
    ];

    const linksEl = containerEl.createDiv(
      "setting-item-description excalidraw-settings-links-container",
    );
    iconLinks.forEach(({ icon, href, aria, text }) => {
      linksEl.createEl("a", { href, attr: { "aria-label": aria } }, (a) => {
        setElementIconAndText(a, icon, text);
      });
    });

    // ------------------------------------------------
    // Saving
    // ------------------------------------------------
    containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    containerEl.createDiv({
      text: t("BASIC_DESC"),
      cls: "setting-item-description",
    });
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
      .setName(t("WARN_ON_MANIFEST_MISMATCH_NAME"))
      .setDesc(fragWithHTML(t("WARN_ON_MANIFEST_MISMATCH_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.compareManifestToPluginVersion)
          .onChange(async (value) => {
            this.plugin.settings.compareManifestToPluginVersion = value;
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
      .setName(t("TOGGLE_SPLASHSCREEN"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showSplashscreen)
          .onChange((value) => {
            this.plugin.settings.showSplashscreen = value;
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
    addYouTubeThumbnail(detailsEl, "jgUpYznHP9A", 216);

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
    containerEl.createDiv({
      text: t("SAVING_DESC"),
      cls: "setting-item-description",
    });
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
      setSanitizedHtml(el, t("FILENAME_DESC"));
    });

    const getFilenameSample = () => {
      return `${t(
        "FILENAME_SAMPLE",
      )}<a href=${URLs.WWW_YOUTUBE_COM_VISUALPKM} target='_blank'>${getDrawingFilename(
        this.plugin.settings,
      )}</a></b><br>${t(
        "FILENAME_EMBED_SAMPLE",
      )}<a href=${URLs.WWW_YOUTUBE_COM_VISUALPKM} target='_blank'>${getEmbedFilename(
        "{NOTE_NAME}",
        this.plugin.settings,
      )}</a></b>`;
    };

    const filenameEl = detailsEl.createEl("p", { text: "" });
    setSanitizedHtml(filenameEl, getFilenameSample());

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
            setSanitizedHtml(filenameEl, getFilenameSample());
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
            setSanitizedHtml(filenameEl, getFilenameSample());
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
            setSanitizedHtml(filenameEl, getFilenameSample());
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
            setSanitizedHtml(filenameEl, getFilenameSample());
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
            setSanitizedHtml(filenameEl, getFilenameSample());
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("CROP_PREFIX_NAME"))
      .setDesc(fragWithHTML(t("CROP_PREFIX_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("e.g.: cropped_")
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
      .setName(t("CROP_SUFFIX_NAME"))
      .setDesc(fragWithHTML(t("CROP_SUFFIX_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("e.g.: _cropped")
          .setValue(this.plugin.settings.cropSuffix)
          .onChange(async (value) => {
            this.plugin.settings.cropSuffix = value.replaceAll(
              /[<>:"/\\|?*]/g,
              "_",
            );
            text.setValue(this.plugin.settings.cropSuffix);
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("ANNOTATE_PREFIX_NAME"))
      .setDesc(fragWithHTML(t("ANNOTATE_PREFIX_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("e.g.: annotated_")
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
      .setName(t("ANNOTATE_SUFFIX_NAME"))
      .setDesc(fragWithHTML(t("ANNOTATE_SUFFIX_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("e.g.: _annotated")
          .setValue(this.plugin.settings.annotateSuffix)
          .onChange(async (value) => {
            this.plugin.settings.annotateSuffix = value.replaceAll(
              /[<>:"/\\|?*]/g,
              "_",
            );
            text.setValue(this.plugin.settings.annotateSuffix);
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
    containerEl.createDiv({
      text: t("AI_DESC"),
      cls: "setting-item-description",
    });
    detailsEl = this.containerEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("AI_HEAD"),
      cls: "excalidraw-setting-h1",
    });

    new Setting(detailsEl)
      .setName(t("AI_ENABLED_NAME"))
      .setDesc(fragWithHTML(t("AI_ENABLED_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.aiEnabled ?? true)
          .onChange(async (value) => {
            aiEl.style.display = value ? "block" : "none";
            this.plugin.settings.aiEnabled = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("AI_USAGE_SETTINGS_BUTTON_NAME"))
      .setDesc(t("AI_USAGE_SETTINGS_BUTTON_DESC"))
      .addButton((button) => {
        const updateLabel = () => {
          button.setButtonText(formatAIUsageLabel());
        };
        updateLabel();
        button.onClick(() => {
          updateLabel();
          new AIUsageModal(this.app, getAIUsage()).open();
        });
      });

    new Setting(detailsEl)
      .setName(t("AI_VERBOSE_LOGGING_NAME"))
      .setDesc(fragWithHTML(t("AI_VERBOSE_LOGGING_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.aiVerboseLogging ?? false)
          .onChange(async (value) => {
            this.plugin.settings.aiVerboseLogging = value;
            this.applySettingsUpdate();
          }),
      );

    detailsEl = detailsEl.createDiv();
    const aiEl = detailsEl;
    if (!(this.plugin.settings.aiEnabled ?? true)) {
      detailsEl.style.display = "none";
    }

    let selectedProviderProfile =
      Object.keys(this.plugin.settings.aiProviderProfiles ?? {})[0] || "OpenAI";
    let selectedTextModelConfig =
      this.plugin.settings.aiDefaultTextModel?.trim() ||
      this.plugin.settings.aiDefaultVisionModel?.trim() ||
      Object.keys(this.plugin.settings.aiTextModelConfigs ?? {})[0] ||
      Object.keys(this.plugin.settings.aiVisionModelConfigs ?? {})[0] ||
      "gpt-5-mini";
    let selectedImageModelConfig =
      this.plugin.settings.aiDefaultImageGenerationModel?.trim() ||
      Object.keys(this.plugin.settings.aiImageModelConfigs ?? {})[0] ||
      "gpt-image-1";

    const getProviderProfiles = () => {
      const profiles =
        this.plugin.settings.aiProviderProfiles &&
        Object.keys(this.plugin.settings.aiProviderProfiles).length > 0
          ? this.plugin.settings.aiProviderProfiles
          : cloneKnownAIProviderProfiles();
      return decryptProviderProfiles(profiles);
    };

    const getModelConfigs = (kind: "text" | "image") => {
      if (kind === "text") {
        if (
          this.plugin.settings.aiTextModelConfigs &&
          Object.keys(this.plugin.settings.aiTextModelConfigs).length > 0
        ) {
          return this.plugin.settings.aiTextModelConfigs;
        }

        if (
          this.plugin.settings.aiVisionModelConfigs &&
          Object.keys(this.plugin.settings.aiVisionModelConfigs).length > 0
        ) {
          return Object.fromEntries(
            Object.entries(this.plugin.settings.aiVisionModelConfigs).map(
              ([modelId, config]) => [
                modelId,
                {
                  ...config,
                  multimodalSupport: config.multimodalSupport ?? true,
                },
              ],
            ),
          );
        }

        return cloneModelConfigs(KNOWN_AI_TEXT_MODEL_CONFIGS);
      }

      if (
        this.plugin.settings.aiImageModelConfigs &&
        Object.keys(this.plugin.settings.aiImageModelConfigs).length > 0
      ) {
        return this.plugin.settings.aiImageModelConfigs;
      }

      return cloneModelConfigs(KNOWN_AI_IMAGE_MODEL_CONFIGS);
    };

    const setProviderProfiles = (
      profiles: Record<string, AIProviderProfile>,
    ) => {
      this.plugin.settings.aiProviderProfiles = Object.fromEntries(
        Object.entries(profiles).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      );
    };

    const setModelConfigs = (
      kind: "text" | "image",
      configs:
        | Record<string, AIModelConfig>
        | Record<string, AIImageModelConfig>,
    ) => {
      const sorted = Object.fromEntries(
        Object.entries(configs).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      );
      if (kind === "text") {
        this.plugin.settings.aiTextModelConfigs = sorted;
      }
      if (kind === "image") {
        this.plugin.settings.aiImageModelConfigs = sorted as Record<
          string,
          AIImageModelConfig
        >;
      }
    };

    const getValidSelection = (kind: "text" | "image") => {
      const configs = getModelConfigs(kind);
      const optionValues = Object.keys(configs);
      const selectedValue =
        kind === "text" ? selectedTextModelConfig : selectedImageModelConfig;
      if (selectedValue && configs[selectedValue]) {
        return selectedValue;
      }
      return optionValues[0] ?? "";
    };

    const providerContainer = detailsEl.createDiv();
    providerContainer.addClass("excalidraw-ai-provider-table");
    const textModelContainer = detailsEl.createDiv();
    const imageModelContainer = detailsEl.createDiv();

    const getProviderTypeLabel = (
      provider: "openai" | "anthropic" | "google" | "xai" | "openai-compatible",
    ) => {
      switch (provider) {
        case "anthropic":
          return t("AI_PROVIDER_OPTION_ANTHROPIC");
        case "google":
          return t("AI_PROVIDER_OPTION_GOOGLE");
        case "xai":
          return t("AI_PROVIDER_OPTION_XAI");
        case "openai-compatible":
          return t("AI_PROVIDER_OPTION_OPENAI_COMPATIBLE");
        default:
          return t("AI_PROVIDER_OPTION_OPENAI");
      }
    };

    const getApiStatusMarkup = (isConfigured: boolean) => {
      const color = isConfigured ? "var(--text-accent)" : "var(--text-error)";
      const label = isConfigured
        ? t("AI_PROVIDER_API_KEY_SET")
        : t("AI_PROVIDER_API_KEY_NOT_SET");
      return `<span style="color: ${color}; font-weight: 600;">${label}</span>`;
    };

    const updateModelProviderReferences = (
      previousProviderId: string,
      nextProviderId: string,
    ) => {
      (["text", "image"] as const).forEach((kind) => {
        const updatedConfigs = { ...getModelConfigs(kind) };
        let changed = false;
        Object.values(updatedConfigs).forEach((config) => {
          if (config.providerId === previousProviderId) {
            config.providerId = nextProviderId;
            changed = true;
          }
        });
        if (changed) {
          setModelConfigs(kind, updatedConfigs);
        }
      });
    };

    const openProviderProfileModal = (profileId?: string) => {
      const profiles = getProviderProfiles();
      new AIProviderProfileModal(
        this.app,
        Object.keys(profiles),
        async (nextProfileId, nextProfile, previousProfileId) => {
          const updatedProfiles = { ...getProviderProfiles() };
          if (previousProfileId && previousProfileId !== nextProfileId) {
            delete updatedProfiles[previousProfileId];
            updateModelProviderReferences(previousProfileId, nextProfileId);
          }
          updatedProfiles[nextProfileId] = { ...nextProfile };
          setProviderProfiles(updatedProfiles);
          selectedProviderProfile = nextProfileId;
          renderAISettings();
          this.applySettingsUpdate();
        },
        {
          previousProfileId: profileId,
          initialProfileId: profileId,
          initialProfile: profileId ? profiles[profileId] : undefined,
        },
      ).open();
    };

    const openModelConfigModal = (kind: "text" | "image", modelId?: string) => {
      const configs = getModelConfigs(kind);
      new AIModelConfigModal(
        this.app,
        Object.keys(configs),
        async (nextModelId, nextConfig, previousModelId) => {
          const updatedConfigs = { ...getModelConfigs(kind) };
          if (previousModelId && previousModelId !== nextModelId) {
            delete updatedConfigs[previousModelId];
          }
          updatedConfigs[nextModelId] = { ...nextConfig };
          if (kind === "text") {
            setModelConfigs(kind, updatedConfigs);
            selectedTextModelConfig = nextModelId;
            this.plugin.settings.aiDefaultTextModel = nextModelId;
            this.plugin.settings.aiDefaultMultimodalModel = nextModelId;
          }
          if (kind === "image") {
            setModelConfigs(kind, updatedConfigs);
            selectedImageModelConfig = nextModelId;
            this.plugin.settings.aiDefaultImageGenerationModel = nextModelId;
          }
          renderAISettings();
          this.applySettingsUpdate();
        },
        {
          kind,
          providerIds: Object.keys(getProviderProfiles()),
          providerProfiles: getProviderProfiles(),
          previousModelId: modelId,
          initialModelId: modelId,
          initialConfig: modelId ? configs[modelId] : undefined,
        },
      ).open();
    };

    const renderProviderSetting = () => {
      providerContainer.empty();
      const profiles = getProviderProfiles();
      const optionValues = Object.keys(profiles).sort((left, right) =>
        left.localeCompare(right),
      );
      if (!selectedProviderProfile || !profiles[selectedProviderProfile]) {
        selectedProviderProfile = optionValues[0] ?? "OpenAI";
      }
      const headerSetting = new Setting(providerContainer)
        .setName(t("AI_PROVIDER_NAME"))
        .setDesc(fragWithHTML(t("AI_PROVIDER_DESC")))
        .addExtraButton((button) => {
          button
            .setIcon("circle-plus")
            .setTooltip(t("AI_PROVIDER_ADD"))
            .onClick(() => openProviderProfileModal());
        })
        .addExtraButton((button) => {
          button
            .setIcon("rotate-ccw")
            .setTooltip(t("AI_PROVIDER_RESTORE_DEFAULTS"))
            .onClick(async () => {
              const restoredProfiles = cloneKnownAIProviderProfiles();
              setProviderProfiles(restoredProfiles);
              const fallbackProviderId =
                Object.keys(restoredProfiles)[0] ?? "OpenAI";
              (["text", "image"] as const).forEach((kind) => {
                const updatedConfigs = { ...getModelConfigs(kind) };
                let changed = false;
                Object.values(updatedConfigs).forEach((config) => {
                  if (!restoredProfiles[config.providerId]) {
                    config.providerId = fallbackProviderId;
                    changed = true;
                  }
                });
                if (changed) {
                  setModelConfigs(kind, updatedConfigs);
                }
              });
              selectedProviderProfile = fallbackProviderId;
              renderAISettings();
              this.applySettingsUpdate();
            });
        });
      headerSetting.settingEl.addClass("excalidraw-ai-provider-table__header");

      optionValues.forEach((providerId) => {
        const profile = profiles[providerId];
        const apiStatus = getApiStatusMarkup(Boolean(profile.apiKey?.trim()));
        const providerSetting = new Setting(providerContainer)
          .setName(providerId)
          .setDesc(
            fragWithHTML(
              t("AI_PROVIDER_PROFILE_ROW_DESC")
                .replace(
                  "{{providerType}}",
                  getProviderTypeLabel(profile.provider),
                )
                .replace("{{apiKey}}", apiStatus),
            ),
          )
          .addExtraButton((button) => {
            button
              .setIcon("pencil")
              .setTooltip(t("AI_PROVIDER_EDIT"))
              .onClick(() => openProviderProfileModal(providerId));
          })
          .addExtraButton((button) => {
            button
              .setIcon("trash")
              .setTooltip(t("AI_PROVIDER_REMOVE"))
              .setDisabled(optionValues.length <= 1)
              .onClick(async () => {
                const replacementProfileId =
                  optionValues.find((value) => value !== providerId) ??
                  optionValues[0];
                const updatedProfiles = { ...profiles };
                delete updatedProfiles[providerId];
                setProviderProfiles(updatedProfiles);
                updateModelProviderReferences(providerId, replacementProfileId);
                selectedProviderProfile = replacementProfileId;
                renderAISettings();
                this.applySettingsUpdate();
              });
          });
        providerSetting.settingEl.addClass("excalidraw-ai-provider-table__row");
      });
    };

    const renderModelSetting = (kind: "text" | "image") => {
      const container =
        kind === "text" ? textModelContainer : imageModelContainer;
      container.empty();
      const configs = getModelConfigs(kind);
      const optionValues = Object.keys(configs).sort((left, right) =>
        left.localeCompare(right),
      );
      const selectedValue = getValidSelection(kind);
      const config = configs[selectedValue];
      const providerProfile = getProviderProfiles()[config.providerId];
      const apiStatus = getApiStatusMarkup(
        Boolean(providerProfile?.apiKey?.trim()),
      );
      const getBooleanLabel = (value: boolean) =>
        value
          ? t("AI_IMAGE_MODEL_CAPABILITIES_EDITS_YES")
          : t("AI_IMAGE_MODEL_CAPABILITIES_EDITS_NO");
      const supportedSizes =
        kind === "image"
          ? getGeminiSupportedSizes(providerProfile?.provider, config.model)
          : [];

      const description =
        kind === "image"
          ? t("AI_PROVIDER_DEFAULT_IMAGE_MODEL_DESC")
              .replace("{{provider}}", config.providerId)
              .replace(
                "{{providerType}}",
                providerProfile
                  ? getProviderTypeLabel(providerProfile.provider)
                  : "",
              )
              .replace("{{apiKey}}", apiStatus)
              .replace("{{model}}", config.model)
              .replace(
                "{{sizes}}",
                (supportedSizes.length > 0
                  ? supportedSizes
                  : (config as AIImageModelConfig).supportedSizes
                ).join(", "),
              )
              .replace(
                "{{supportsPromptImageTransforms}}",
                getBooleanLabel(
                  (config as AIImageModelConfig).supportsPromptImageTransforms,
                ),
              )
              .replace(
                "{{supportsMaskImageEdits}}",
                getBooleanLabel(
                  (config as AIImageModelConfig).supportsMaskImageEdits,
                ),
              )
          : t("AI_PROVIDER_DEFAULT_TEXT_MODEL_DESC")
              .replace("{{provider}}", config.providerId)
              .replace("{{apiKey}}", apiStatus)
              .replace("{{model}}", config.model)
              .replace(
                "{{endpoint}}",
                config.endpoint?.trim() ||
                  t("AI_MODEL_CONFIG_DERIVED_ENDPOINT"),
              )
              .replace(
                "{{providerType}}",
                providerProfile
                  ? getProviderTypeLabel(providerProfile.provider)
                  : "",
              )
              .replace(
                "{{multimodalSupport}}",
                getBooleanLabel(config.multimodalSupport !== false),
              );

      new Setting(container)
        .setName(
          kind === "image"
            ? t("AI_PROVIDER_DEFAULT_IMAGE_MODEL_NAME")
            : t("AI_PROVIDER_DEFAULT_TEXT_MODEL_NAME"),
        )
        .setDesc(fragWithHTML(description))
        .addDropdown((dropdown) => {
          optionValues.forEach((value) => dropdown.addOption(value, value));
          return dropdown.setValue(selectedValue).onChange(async (value) => {
            if (kind === "text") {
              selectedTextModelConfig = value;
              this.plugin.settings.aiDefaultTextModel = value;
              this.plugin.settings.aiDefaultMultimodalModel = value;
            }
            if (kind === "image") {
              selectedImageModelConfig = value;
              this.plugin.settings.aiDefaultImageGenerationModel = value;
            }
            renderAISettings();
            this.applySettingsUpdate();
          });
        })
        .addExtraButton((button) => {
          button
            .setIcon("pencil")
            .setTooltip(t("AI_MODEL_EDIT"))
            .onClick(() => openModelConfigModal(kind, selectedValue));
        })
        .addExtraButton((button) => {
          button
            .setIcon("circle-plus")
            .setTooltip(t("AI_MODEL_ADD"))
            .onClick(() => openModelConfigModal(kind));
        })
        .addExtraButton((button) => {
          button
            .setIcon("trash")
            .setTooltip(t("AI_MODEL_REMOVE"))
            .setDisabled(optionValues.length <= 1)
            .onClick(async () => {
              const updatedConfigs = { ...configs };
              delete updatedConfigs[selectedValue];
              setModelConfigs(kind, updatedConfigs);
              const nextSelection = Object.keys(getModelConfigs(kind))[0] ?? "";
              if (kind === "text") {
                selectedTextModelConfig = nextSelection;
                this.plugin.settings.aiDefaultTextModel = nextSelection;
                this.plugin.settings.aiDefaultMultimodalModel = nextSelection;
              }
              if (kind === "image") {
                selectedImageModelConfig = nextSelection;
                this.plugin.settings.aiDefaultImageGenerationModel =
                  nextSelection;
              }
              renderAISettings();
              this.applySettingsUpdate();
            });
        })
        .addExtraButton((button) => {
          button
            .setIcon("rotate-ccw")
            .setTooltip(t("AI_MODEL_RESTORE_DEFAULTS"))
            .onClick(async () => {
              if (kind === "text") {
                setModelConfigs(
                  kind,
                  cloneModelConfigs(KNOWN_AI_TEXT_MODEL_CONFIGS),
                );
              }
              if (kind === "image") {
                setModelConfigs(
                  kind,
                  cloneModelConfigs(KNOWN_AI_IMAGE_MODEL_CONFIGS),
                );
              }
              const nextSelection = Object.keys(getModelConfigs(kind))[0] ?? "";
              if (kind === "text") {
                selectedTextModelConfig = nextSelection;
                this.plugin.settings.aiDefaultTextModel = nextSelection;
                this.plugin.settings.aiDefaultMultimodalModel = nextSelection;
              }
              if (kind === "image") {
                selectedImageModelConfig = nextSelection;
                this.plugin.settings.aiDefaultImageGenerationModel =
                  nextSelection;
              }
              renderAISettings();
              this.applySettingsUpdate();
            });
        });
    };

    const renderAISettings = () => {
      renderProviderSetting();
      renderModelSetting("text");
      renderModelSetting("image");
    };

    const addNumberSetting = (
      parentEl: HTMLElement,
      name: string,
      desc: string,
      placeholder: string,
      getter: () => number,
      setter: (value: number) => void,
    ) => {
      new Setting(parentEl)
        .setName(name)
        .setDesc(fragWithHTML(desc))
        .addText((text) =>
          text
            .setPlaceholder(placeholder)
            .setValue(getter().toString())
            .onChange(async (value) => {
              const intVal = parseInt(value, 10);
              if (isNaN(intVal) && value !== "") {
                text.setValue(getter().toString());
                return;
              }
              if (value === "") {
                setter(0);
                text.setValue("0");
                this.applySettingsUpdate();
                return;
              }
              if (intVal < 0) {
                text.setValue(getter().toString());
                return;
              }
              setter(intVal);
              text.setValue(intVal.toString());
              this.applySettingsUpdate();
            }),
        );
    };

    renderAISettings();

    addNumberSetting(
      detailsEl,
      t("AI_PROVIDER_DEFAULT_MAX_OUTGOING_TOKENS_NAME"),
      t("AI_PROVIDER_DEFAULT_MAX_OUTGOING_TOKENS_DESC"),
      t("AI_PROVIDER_DEFAULT_MAX_OUTGOING_TOKENS_PLACEHOLDER"),
      () => this.plugin.settings.aiDefaultMaxOutgoingTokens,
      (value) => {
        this.plugin.settings.aiDefaultMaxOutgoingTokens = value;
      },
    );

    addNumberSetting(
      detailsEl,
      t("AI_PROVIDER_DEFAULT_MAX_RESPONSE_TOKENS_NAME"),
      t("AI_PROVIDER_DEFAULT_MAX_RESPONSE_TOKENS_DESC"),
      t("AI_PROVIDER_DEFAULT_MAX_RESPONSE_TOKENS_PLACEHOLDER"),
      () => this.plugin.settings.aiDefaultMaxResponseTokens,
      (value) => {
        this.plugin.settings.aiDefaultMaxResponseTokens = value;
      },
    );

    // ------------------------------------------------
    // Display
    // ------------------------------------------------
    containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    containerEl.createDiv({
      text: t("DISPLAY_DESC"),
      cls: "setting-item-description",
    });
    detailsEl = this.containerEl.createEl("details");
    const displayDetailsEl = detailsEl;
    detailsEl.createEl("summary", {
      text: t("DISPLAY_HEAD"),
      cls: "excalidraw-setting-h1",
    });

    new Setting(detailsEl)
      .setName(t("ENABLE_DOUBLE_CLICK_TEXT_EDITING_NAME"))
      .addToggle((toggle) =>
        toggle
          .setValue(!this.plugin.settings.disableDoubleClickTextEditing)
          .onChange(async (value) => {
            this.plugin.settings.disableDoubleClickTextEditing = !value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("DISABLE_CONTEXT_MENU_NAME"))
      .setDesc(t("DISABLE_CONTEXT_MENU_DESC"))
      .addToggle((toggle) =>
        toggle
          .setValue(!this.plugin.settings.disableContextMenu)
          .onChange(async (value) => {
            this.plugin.settings.disableContextMenu = !value;
            this.applySettingsUpdate();
          }),
      );

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
    readingModeEl.nameEl.setAttribute("id", TAG_MDREADINGMODE);

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

    detailsEl = displayDetailsEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("MODES_HEAD"),
      cls: "excalidraw-setting-h3",
    });

    new Setting(detailsEl)
      .setName(t("SHOW_TAB_TITLEBAR_BUTTONS"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showTabTitlebarButtons)
          .onChange(async (value) => {
            this.plugin.settings.showTabTitlebarButtons = value;
            this.applySettingsUpdate();
            getExcalidrawViews(this.app, true).forEach((excalidrawView) => {
              if (value) {
                excalidrawView.addTabTitlebarButtons();
              } else {
                excalidrawView.removeTabTitlebarButtons();
              }
            });
          }),
      );

    new UIModeSettingsComponent(detailsEl, this.plugin.settings, this.app, () =>
      this.applySettingsUpdate(),
    ).render();
    addYouTubeThumbnail(detailsEl, "H8Njp7ZXYag", 999);

    detailsEl = displayDetailsEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("HOTKEY_OVERRIDE_HEAD"),
      cls: "excalidraw-setting-h3",
    });
    detailsEl.createEl("span", {}, (el) => {
      setSanitizedHtml(el, t("HOTKEY_OVERRIDE_DESC"));
    });

    this.hotkeyEditor = new HotkeyEditor(
      detailsEl,
      this.plugin.settings,
      this.applySettingsUpdate,
    );
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
          .addOption("none", "Dynamic Styling OFF")
          .addOption("colorful", "Match color")
          .addOption("gray", "Gray, match tone")
          .setValue(this.plugin.settings.dynamicStyling)
          .onChange(async (value) => {
            this.requestUpdateDynamicStyling = true;
            this.plugin.settings.dynamicStyling = value as DynamicStyle;
            this.applySettingsUpdate();
          }),
      );
    addYouTubeThumbnail(detailsEl, "fypDth_-8q0");

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
    addYouTubeThumbnail(detailsEl, "ICpoyMv6KSs");

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
            if (value) {
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

    new Setting(detailsEl)
      .setName(t("PHONE_FOOTER_SAFE_AREA_PADDING_NAME"))
      .setDesc(fragWithHTML(t("PHONE_FOOTER_SAFE_AREA_PADDING_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.phoneFooterSafeAreaPadding)
          .onChange(async (value) => {
            this.plugin.settings.phoneFooterSafeAreaPadding = value;
            this.plugin.updatePhoneFooterSafeAreaPadding();
            this.applySettingsUpdate();
          }),
      );

    detailsEl = displayDetailsEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("ZOOM_AND_PAN_HEAD"), //mfuria #329
      cls: "excalidraw-setting-h3",
    });

    //mfuria #329. Added setting for right-click panning
    new Setting(detailsEl)
      .setName(t("PAN_WITH_RIGHT_MOUSE_BUTTON_NAME"))
      .setDesc(fragWithHTML(t("PAN_WITH_RIGHT_MOUSE_BUTTON_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.panWithRightMouseButton)
          .onChange(async (value) => {
            this.plugin.settings.panWithRightMouseButton = value;
            this.applySettingsUpdate(true);
          }),
      );

    new Setting(detailsEl)
      .setName(t("DEFAULT_PINCHZOOM_NAME"))
      .setDesc(fragWithHTML(t("DEFAULT_PINCHZOOM_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.allowPinchZoom)
          .onChange(async (value) => {
            this.plugin.settings.allowPinchZoom = value;
            getExcalidrawViews(this.app, true).forEach((excalidrawView) =>
              excalidrawView.updatePinchZoom(),
            );
            this.applySettingsUpdate();
          }),
      );
    addYouTubeThumbnail(detailsEl, "rBarRfcSxNo", 107);

    new Setting(detailsEl)
      .setName(t("DEFAULT_WHEELZOOM_NAME"))
      .setDesc(fragWithHTML(t("DEFAULT_WHEELZOOM_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.allowWheelZoom)
          .onChange(async (value) => {
            this.plugin.settings.allowWheelZoom = value;
            getExcalidrawViews(this.app, true).forEach((excalidrawView) =>
              excalidrawView.updateWheelZoom(),
            );
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
      },
    });

    createSliderWithText(detailsEl, {
      name: t("ZOOM_STEP_NAME"),
      desc: t("ZOOM_STEP_DESC"),
      value: this.plugin.settings.zoomStep * 100,
      min: 1,
      max: 25,
      step: 1,
      onChange: (value) => {
        this.plugin.settings.zoomStep = value / 100;
        this.applySettingsUpdate();
      },
    });

    createSliderWithText(detailsEl, {
      name: t("ZOOM_MIN_NAME"),
      desc: t("ZOOM_MIN_DESC"),
      value: this.plugin.settings.zoomMin * 100,
      min: 1,
      max: 50,
      step: 1,
      onChange: (value) => {
        this.plugin.settings.zoomMin = value / 100;
        this.applySettingsUpdate();
      },
    });

    createSliderWithText(detailsEl, {
      name: t("ZOOM_MAX_NAME"),
      desc: t("ZOOM_MAX_DESC"),
      value: this.plugin.settings.zoomMax * 100,
      min: 500,
      max: 6000,
      step: 100,
      onChange: (value) => {
        this.plugin.settings.zoomMax = value / 100;
        this.applySettingsUpdate();
      },
    });

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
      getExcalidrawViews(this.app, true).forEach((excalidrawView) =>
        excalidrawView.updateGridColor(),
      );
    };

    const updateGridDirection = () => {
      getExcalidrawViews(this.app, true).forEach((excalidrawView) =>
        excalidrawView.updateGridDirection(
          this.plugin.settings.gridSettings.GRID_DIRECTION,
        ),
      );
    };

    new Setting(detailsEl)
      .setName(t("GRID_DIRECTION_NAME"))
      .setDesc(t("GRID_DIRECTION_DESC"))
      .addToggle((toggle) =>
        toggle
          .setTooltip(t("GRID_HORIZONTAL"))
          .setValue(
            this.plugin.settings.gridSettings.GRID_DIRECTION?.horizontal ??
              true,
          )
          .onChange((value) => {
            if (!this.plugin.settings.gridSettings.GRID_DIRECTION) {
              this.plugin.settings.gridSettings.GRID_DIRECTION = {
                horizontal: true,
                vertical: true,
              };
            } //2.10.1 migration
            this.plugin.settings.gridSettings.GRID_DIRECTION.horizontal = value;
            this.applySettingsUpdate();
            updateGridDirection();
          }),
      )
      .addToggle((toggle) =>
        toggle
          .setTooltip(t("GRID_VERTICAL"))
          .setValue(
            this.plugin.settings.gridSettings.GRID_DIRECTION?.vertical ?? true,
          )
          .onChange((value) => {
            if (!this.plugin.settings.gridSettings.GRID_DIRECTION) {
              this.plugin.settings.gridSettings.GRID_DIRECTION = {
                horizontal: true,
                vertical: true,
              };
            } //2.10.1 migration
            this.plugin.settings.gridSettings.GRID_DIRECTION.vertical = value;
            this.applySettingsUpdate();
            updateGridDirection();
          }),
      );

    // Dynamic color toggle
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
    const gridColorSection = detailsEl.createDiv();
    gridColorSection.style.display = this.plugin.settings.gridSettings
      .DYNAMIC_COLOR
      ? "none"
      : "block";

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
    });

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
    });

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
    });

    detailsEl = displayDetailsEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("DRAG_MODIFIER_NAME"),
      cls: "excalidraw-setting-h3",
    });
    detailsEl.createDiv({
      text: t("DRAG_MODIFIER_DESC"),
      cls: "setting-item-description",
    });

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
    });

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
    });

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
      this.applySettingsUpdate.bind(this),
    ).render();

    // ------------------------------------------------
    // Links and Transclusions
    // ------------------------------------------------
    containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    containerEl.createDiv({
      text: t("LINKS_HEAD_DESC"),
      cls: "setting-item-description",
    });
    detailsEl = this.containerEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("LINKS_HEAD"),
      cls: "excalidraw-setting-h1",
    });

    detailsEl.createEl("span", undefined, (el) =>
      setSanitizedHtml(el, t("LINKS_DESC")),
    );

    new Setting(detailsEl)
      .setName(t("ELEMENT_LINK_SYNC_NAME"))
      .setDesc(fragWithHTML(t("ELEMENT_LINK_SYNC_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.syncElementLinkWithText)
          .onChange(async (value) => {
            this.plugin.settings.syncElementLinkWithText = value;
            this.applySettingsUpdate();
          }),
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
          .onChange((value) => {
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
          .onChange((value) => {
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
          .onChange((value) => {
            this.plugin.settings.urlPrefix = value;
            this.applySettingsUpdate(true);
          }),
      );

    let todoPrefixSetting: TextComponent;
    let donePrefixSetting: TextComponent;

    new Setting(detailsEl)
      .setName(t("PARSE_TODO_NAME"))
      .setDesc(fragWithHTML(t("PARSE_TODO_DESC")))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.parseTODO).onChange((value) => {
          this.plugin.settings.parseTODO = value;
          todoPrefixSetting.setDisabled(!value);
          donePrefixSetting.setDisabled(!value);
          this.applySettingsUpdate(true);
        }),
      );

    new Setting(detailsEl)
      .setName(t("TODO_NAME"))
      .setDesc(fragWithHTML(t("TODO_DESC")))
      .addText((text) => {
        todoPrefixSetting = text;
        text
          .setPlaceholder(t("INSERT_EMOJI"))
          .setValue(this.plugin.settings.todo)
          .onChange((value) => {
            this.plugin.settings.todo = value;
            this.applySettingsUpdate(true);
          });
      });
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
          .onChange((value) => {
            this.plugin.settings.done = value;
            this.applySettingsUpdate(true);
          });
      });
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
    setSanitizedHtml(
      s.descEl,
      `<code>![[doc#^ref]]{number}</code> ${t("TRANSCLUSION_WRAP_DESC")}`,
    );

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
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.removeTransclusionQuoteSigns)
          .onChange((value) => {
            this.plugin.settings.removeTransclusionQuoteSigns = value;
            this.requestEmbedUpdate = true;
            this.applySettingsUpdate(true);
          }),
      );

    new Setting(detailsEl)
      .setName(t("GET_URL_TITLE_NAME"))
      .setDesc(fragWithHTML(t("GET_URL_TITLE_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.oEmbedAllowed)
          .onChange(async (value) => {
            this.plugin.settings.oEmbedAllowed = value;
            this.applySettingsUpdate();
          }),
      );

    // ------------------------------------------------
    // Embed and Export
    // ------------------------------------------------
    containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    containerEl.createDiv({
      text: t("EMBED_DESC"),
      cls: "setting-item-description",
    });
    detailsEl = this.containerEl.createEl("details");
    const embedDetailsEl = detailsEl;
    detailsEl.createEl("summary", {
      text: t("EMBED_HEAD"),
      cls: "excalidraw-setting-h1",
    });

    new Setting(detailsEl)
      .setName(t("EMBED_PREVIEW_IMAGETYPE_NAME"))
      .setDesc(fragWithHTML(t("EMBED_PREVIEW_IMAGETYPE_DESC")))
      .addDropdown((dropdown) =>
        dropdown
          .addOption(PreviewImageType.PNG, "PNG Image")
          .addOption(PreviewImageType.SVG, "Native SVG")
          .addOption(PreviewImageType.SVGIMG, "SVG Image")
          .setValue(this.plugin.settings.previewImageType)
          .onChange((value) => {
            this.plugin.settings.previewImageType = value as PreviewImageType;
            this.requestEmbedUpdate = true;
            this.applySettingsUpdate();
          }),
      );
    addYouTubeThumbnail(detailsEl, "yZQoJg2RCKI");
    addYouTubeThumbnail(detailsEl, "opLd1SqaH_I", 8);

    let dropdown: DropdownComponent;
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
            this.plugin.settings.embedType =
              value as typeof this.plugin.settings.embedType;
            embedComment.settingEl.style.display =
              value === "excalidraw" ? "none" : "";
            this.applySettingsUpdate();
          });
      });

    const embedComment = new Setting(detailsEl)
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

    embedComment.settingEl.style.display =
      this.plugin.settings.embedType === "excalidraw" ? "none" : "";

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

    // Embed placeholder image setting
    new Setting(detailsEl)
      .setName(t("EMBED_PLACEHOLDER_NAME"))
      .setDesc(fragWithHTML(t("EMBED_PLACEHOLDER_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.embedPlaceholderImage)
          .onChange(async (value) => {
            this.plugin.settings.embedPlaceholderImage = value;
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
      },
    });

    createSliderWithText(detailsEl, {
      name: t("IMAGE_CACHE_RETENTION_DAYS_NAME"),
      desc: fragWithHTML(t("IMAGE_CACHE_RETENTION_DAYS_DESC")),
      min: 1,
      max: 365,
      step: 1,
      value: this.plugin.settings.imageCacheRetentionDays,
      onChange: (value) => {
        this.plugin.settings.imageCacheRetentionDays = value;
        this.applySettingsUpdate();
      },
      minWidth: "3em",
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
          }),
      );
    new Setting(detailsEl)
      .setName(t("SCENE_IMAGE_CACHE_NAME"))
      .setDesc(fragWithHTML(t("SCENE_IMAGE_CACHE_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.allowImageCacheInScene)
          .onChange((value) => {
            this.plugin.settings.allowImageCacheInScene = value;
            this.applySettingsUpdate();
          }),
      );
    new Setting(detailsEl)
      .setName(t("EMBED_IMAGE_CACHE_CLEAR"))
      .addButton((button) =>
        button.setButtonText(t("EMBED_IMAGE_CACHE_CLEAR")).onClick(() => {
          void imageCache.clearImageCache();
        }),
      );
    new Setting(detailsEl)
      .setName(t("BACKUP_CACHE_CLEAR"))
      .addButton((button) =>
        button.setButtonText(t("BACKUP_CACHE_CLEAR")).onClick(() => {
          const confirmationPrompt = new MultiOptionConfirmationPrompt(
            this.plugin,
            t("BACKUP_CACHE_CLEAR_CONFIRMATION"),
          );
          void confirmationPrompt.waitForClose.then((confirmed) => {
            if (confirmed) {
              void imageCache.clearBackupCache();
            }
          });
        }),
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
    addYouTubeThumbnail(detailsEl, "wTtaXmRJ7wg", 171);

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
    pdfExportEl.nameEl.setAttribute("id", TAG_PDFEXPORT);

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
      },
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
      },
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
      },
    ).render();

    detailsEl = exportDetailsEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("EXPORT_HEAD"),
      cls: "excalidraw-setting-h4",
    });
    detailsEl.setAttribute("id", TAG_AUTOEXPORT);

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
        if (dropdown.selectEl.item(i).label === opt) {
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
    containerEl.createDiv({
      text: t("EMBED_TOEXCALIDRAW_DESC"),
      cls: "setting-item-description",
    });

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

    addYouTubeThumbnail(detailsEl, "nB4cOfn0xAs");
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
          }),
      );

    detailsEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    detailsEl.createEl("span", {}, (el) => {
      setSanitizedHtml(el, t("MD_EMBED_CUSTOMDATA_HEAD_DESC"));
    });

    new EmbeddalbeMDFileCustomDataSettingsComponent(
      detailsEl,
      this.plugin.settings.embeddableMarkdownDefaults,
      (val?: boolean) => this.applySettingsUpdate(val),
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
        //I do not know why Lilita One and Nunito do not work. The font string is there, but it is not rendered
        d.addOption("Virgil", "Virgil");
        d.addOption("Cascadia", "Cascadia");
        d.addOption("Excalifont", "Excalifont");
        d.addOption("Comic Shanns", "Comic Shanns");
        d.addOption("Liberation Sans", "Liberation Sans");
        this.app.vault
          .getFiles()
          .filter(
            (f) =>
              ["ttf", "woff", "woff2", "otf"].contains(f.extension) &&
              !f.path.startsWith(this.plugin.settings.fontAssetsPath),
          )
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
    containerEl.createDiv({
      text: t("NONSTANDARD_DESC"),
      cls: "setting-item-description",
    });
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
    addYouTubeThumbnail(detailsEl, "OjNhjaH2KjI", 69);
    new Setting(detailsEl)
      .setName(t("CUSTOM_PEN_NAME"))
      .setDesc(t("CUSTOM_PEN_DESC"))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("0", "0")
          .addOption("1", "1")
          .addOption("2", "2")
          .addOption("3", "3")
          .addOption("4", "4")
          .addOption("5", "5")
          .addOption("6", "6")
          .addOption("7", "7")
          .addOption("8", "8")
          .addOption("9", "9")
          .addOption("10", "10")
          .setValue(this.plugin.settings.numberOfCustomPens.toString())
          .onChange((value) => {
            this.plugin.settings.numberOfCustomPens = parseInt(value);
            this.requestUpdatePinnedPens = true;
            this.applySettingsUpdate(false);
          }),
      );

    // ------------------------------------------------
    // Fonts supported features
    // ------------------------------------------------
    containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    containerEl.createDiv({
      text: t("FONTS_DESC"),
      cls: "setting-item-description",
    });
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
    addYouTubeThumbnail(detailsEl, "eKFmrSQhFA4");
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
            if (value) {
              await this.plugin.initializeFonts();
            }
          }),
      );

    new Setting(detailsEl)
      .setName(t("FOURTH_FONT_NAME"))
      .setDesc(fragWithHTML(t("FOURTH_FONT_DESC")))
      .addDropdown(async (d: DropdownComponent) => {
        d.addOption("Virgil", "Virgil");
        this.app.vault
          .getFiles()
          .filter(
            (f) =>
              ["ttf", "woff", "woff2", "otf"].contains(f.extension) &&
              !f.path.startsWith(this.plugin.settings.fontAssetsPath),
          )
          .forEach((f: TFile) => {
            d.addOption(f.path, f.name);
          });
        d.setValue(this.plugin.settings.experimantalFourthFont).onChange(
          (value) => {
            this.requestReloadDrawings = true;
            this.plugin.settings.experimantalFourthFont = value;
            this.applySettingsUpdate(true);
            void this.plugin.initializeFonts();
          },
        );
      });

    detailsEl = fontsDetailsEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("OFFLINE_CJK_NAME"),
      cls: "excalidraw-setting-h3",
    });

    const cjkdescdiv = detailsEl.createDiv({ cls: "setting-item-description" });
    setSanitizedHtml(cjkdescdiv, t("OFFLINE_CJK_DESC"));

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
    containerEl.createDiv({
      text: t("EXPERIMENTAL_DESC"),
      cls: "setting-item-description",
    });
    detailsEl = containerEl.createEl("details");
    const experimentalDetailsEl = detailsEl;
    detailsEl.createEl("summary", {
      text: t("EXPERIMENTAL_HEAD"),
      cls: "excalidraw-setting-h1",
    });

    addYouTubeThumbnail(detailsEl, "r08wk-58DPk");
    new Setting(detailsEl)
      .setName(t("LATEX_DEFAULT_NAME"))
      .setDesc(fragWithHTML(t("LATEX_DEFAULT_DESC")))
      .addText((text) =>
        text
          .setValue(this.plugin.settings.latexBoilerplate)
          .onChange((value) => {
            this.plugin.settings.latexBoilerplate = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("LATEX_PREAMBLE_NAME"))
      .setDesc(fragWithHTML(t("LATEX_PREAMBLE_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("e.g.: preamble.sty")
          .setValue(this.plugin.settings.latexPreambleLocation)
          .onChange(async (value) => {
            this.plugin.settings.latexPreambleLocation = value;
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
            this.plugin.editorHandler.updateCMExtensionState(
              EDITOR_FADEOUT,
              value,
            );
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

    detailsEl.createDiv({
      text: t("TASKBONE_DESC"),
      cls: "setting-item-description",
    });
    let taskboneAPIKeyText: TextComponent;

    addYouTubeThumbnail(detailsEl, "7gu4ETx7zro");
    new Setting(detailsEl)
      .setName(t("TASKBONE_ENABLE_NAME"))
      .setDesc(fragWithHTML(t("TASKBONE_ENABLE_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.taskboneEnabled)
          .onChange(async (value) => {
            taskboneAPIKeyText.setDisabled(!value);
            this.plugin.settings.taskboneEnabled = value;
            if (this.plugin.settings.taskboneAPIkey === "") {
              const apiKey = await this.plugin.taskbone.initialize(false);
              if (apiKey) {
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
        configurePasswordTextInput(taskboneAPIKeyText);
        taskboneAPIKeyText
          .setValue(this.plugin.settings.taskboneAPIkey)
          .onChange(async (value) => {
            this.plugin.settings.taskboneAPIkey = value;
            this.applySettingsUpdate();
          })
          .setDisabled(!this.plugin.settings.taskboneEnabled);
      });

    // ------------------------------------------------
    // ExcalidrawAutomate
    // ------------------------------------------------
    containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    containerEl.createDiv({ cls: "setting-item-description" }, (el) => {
      setSanitizedHtml(el, t("EA_DESC"));
    });
    detailsEl = containerEl.createEl("details");
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

    new Setting(detailsEl)
      .setName(t("ENABLE_ONLOAD_SCRIPTS_NAME"))
      .setDesc(fragWithHTML(t("ENABLE_ONLOAD_SCRIPTS_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableOnloadScripts)
          .onChange(async (value) => {
            this.plugin.settings.enableOnloadScripts = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("ENABLE_COMMAND_LINKS_NAME"))
      .setDesc(fragWithHTML(t("ENABLE_COMMAND_LINKS_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableCommandLinks)
          .onChange(async (value) => {
            this.plugin.settings.enableCommandLinks = value;
            this.applySettingsUpdate();
          }),
      );

    //STARTUP_SCRIPT_NAME
    //STARTUP_SCRIPT_BUTTON
    let startupScriptPathText: TextComponent;
    let startupScriptButton: ButtonComponent;
    const scriptExists = () => {
      const startupPath = normalizePath(
        this.plugin.settings.startupScriptPath.endsWith(".md")
          ? this.plugin.settings.startupScriptPath
          : `${this.plugin.settings.startupScriptPath}.md`,
      );
      return Boolean(this.app.vault.getAbstractFileByPath(startupPath));
    };
    new Setting(detailsEl)
      .setName(t("STARTUP_SCRIPT_NAME"))
      .setDesc(fragWithHTML(t("STARTUP_SCRIPT_DESC")))
      .addText((text) => {
        startupScriptPathText = text;
        text
          .setValue(this.plugin.settings.startupScriptPath)
          .onChange((value) => {
            this.plugin.settings.startupScriptPath = value;
            startupScriptButton.setButtonText(
              scriptExists()
                ? t("STARTUP_SCRIPT_BUTTON_OPEN")
                : t("STARTUP_SCRIPT_BUTTON_CREATE"),
            );
            this.applySettingsUpdate();
          });
      })
      .addButton((button) => {
        startupScriptButton = button;
        startupScriptButton
          .setButtonText(
            scriptExists()
              ? t("STARTUP_SCRIPT_BUTTON_OPEN")
              : t("STARTUP_SCRIPT_BUTTON_CREATE"),
          )
          .onClick(async () => {
            if (this.plugin.settings.startupScriptPath === "") {
              this.plugin.settings.startupScriptPath = normalizePath(
                `${normalizePath(
                  this.plugin.settings.folder,
                )}/ExcalidrawStartup`,
              );
              startupScriptPathText.setValue(
                this.plugin.settings.startupScriptPath,
              );
              this.applySettingsUpdate();
            }
            const startupPath = normalizePath(
              this.plugin.settings.startupScriptPath.endsWith(".md")
                ? this.plugin.settings.startupScriptPath
                : `${this.plugin.settings.startupScriptPath}.md`,
            );
            let f = this.app.vault.getAbstractFileByPath(startupPath);
            if (!f) {
              f = await createOrOverwriteFile(
                this.app,
                startupPath,
                startupScript(),
              );
            }
            startupScriptButton.setButtonText(t("STARTUP_SCRIPT_BUTTON_OPEN"));
            await this.app.workspace.openLinkText(f.path, "", true);
            await this.hide();
          });
      });

    // ------------------------------------------------
    // Compatibility
    // ------------------------------------------------
    containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    containerEl.createDiv({
      text: t("COMPATIBILITY_DESC"),
      cls: "setting-item-description",
    });
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
            setSanitizedHtml(filenameEl, getFilenameSample());
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
      const textAreaHeight = (
        scriptName: string,
        variableName: string,
      ): number | undefined | null => {
        const variable =
          this.plugin.settings.scriptEngineSettings[scriptName][variableName];
        switch (typeof variable) {
          case "object":
            return variable.height;
          default:
            return null;
        }
      };

      const getValue = (
        scriptName: string,
        variableName: string,
      ): string | number | boolean | undefined => {
        const variable =
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
        value: string | number | boolean | undefined,
      ) => {
        switch (
          typeof this.plugin.settings.scriptEngineSettings[scriptName][
            variableName
          ]
        ) {
          case "object":
            this.plugin.settings.scriptEngineSettings[scriptName][
              variableName
            ].value = value;
            break;
          default:
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
              .setValue(getValue(scriptName, variableName) as boolean)
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
        valueset?: string[],
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
              valueset.forEach((val: string) =>
                dropdown.addOption(val.toString(), val.toString()),
              );
              dropdown
                .setValue(getValue(scriptName, variableName) as string)
                .onChange(async (value) => {
                  setValue(scriptName, variableName, value);
                  this.applySettingsUpdate();
                });
            });
        } else if (textAreaHeight(scriptName, variableName)) {
          new Setting(detailsEl)
            .setName(variableName)
            .setDesc(fragWithHTML(description ?? ""))
            .addTextArea((text) => {
              text.inputEl.style.minHeight = textAreaHeight(
                scriptName,
                variableName,
              )
                ? `${textAreaHeight(scriptName, variableName)}px`
                : "";
              text.inputEl.style.minWidth = "400px";
              text.inputEl.style.width = "100%";
              text
                .setValue(getValue(scriptName, variableName) as string)
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
                .setValue(getValue(scriptName, variableName) as string)
                .onChange(async (value) => {
                  setValue(scriptName, variableName, value);
                  this.applySettingsUpdate();
                }),
            );
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
      containerEl.createDiv({
        text: t("SCRIPT_SETTINGS_DESC"),
        cls: "setting-item-description",
      });
      detailsEl = this.containerEl.createEl("details");
      const scriptDetailsEl = detailsEl;
      detailsEl.createEl("summary", {
        text: t("SCRIPT_SETTINGS_HEAD"),
        cls: "excalidraw-setting-h1",
      });

      addYouTubeThumbnail(detailsEl, "H8Njp7ZXYag", 52);
      Object.keys(this.plugin.settings.scriptEngineSettings)
        .filter((s) => scripts.contains(s))
        .forEach((scriptName: string) => {
          const settings =
            this.plugin.settings.scriptEngineSettings[scriptName];
          const values = Object.values(settings);
          if (
            values.length === 0 ||
            (values.length > 0 &&
              values
                .map((val: ScriptSettingValue): number => (val.hidden ? 0 : 1))
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
            const scriptSetting =
              typeof variable === "object" && variable !== null
                ? variable
                : null;
            const item = scriptSetting?.value ?? variable;
            switch (typeof item) {
              case "boolean":
                if (!scriptSetting?.hidden) {
                  addBooleanSetting(
                    scriptName,
                    variableName,
                    scriptSetting?.description,
                  );
                }
                break;
              case "string":
                if (!scriptSetting?.hidden) {
                  addStringSetting(
                    scriptName,
                    variableName,
                    scriptSetting?.description,
                    scriptSetting?.valueset,
                  );
                }
                break;
              case "number":
                if (!scriptSetting?.hidden) {
                  addNumberSetting(
                    scriptName,
                    variableName,
                    scriptSetting?.description,
                  );
                }
                break;
            }
          });
        });
    }
  }
}
