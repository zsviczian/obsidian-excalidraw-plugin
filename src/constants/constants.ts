import { customAlphabet } from "nanoid";
import { ExcalidrawLib } from "../types/excalidrawLib";
import ExcalidrawPlugin from "src/core/main";
import { DeviceType } from "src/types/types";
import { errorHandler } from "../utils/ErrorHandler";
import { getLanguage } from "obsidian";
import { URLs } from "./safeUrls";
//This is only for backward compatibility because an early version of obsidian included an encoding to avoid fantom links from littering Obsidian graph view
declare const PLUGIN_VERSION: string;
export let EXCALIDRAW_PLUGIN: ExcalidrawPlugin = null;
export const mainDocument = document; //signals deliberate use of main document instead of activeDocument
export const setExcalidrawPlugin = (plugin: ExcalidrawPlugin) => {
  EXCALIDRAW_PLUGIN = plugin;
};
export const THEME = {
  LIGHT: "light",
  DARK: "dark",
} as const;

const MD_EXCALIDRAW = "# Excalidraw Data";
const MD_TEXTELEMENTS = "## Text Elements";
const MD_ELEMENTLINKS = "## Element Links";
const MD_EMBEDFILES = "## Embedded Files";
const MD_DRAWING = "## Drawing";

export const MD_EX_SECTIONS = [
  MD_EXCALIDRAW,
  MD_TEXTELEMENTS,
  MD_ELEMENTLINKS,
  MD_EMBEDFILES,
  MD_DRAWING,
];

export const ERROR_IFRAME_CONVERSION_CANCELED = "iframe conversion canceled";

declare const excalidrawLib: typeof ExcalidrawLib;

export const LOCALE = getLanguage().toLowerCase();
export const CJK_FONTS = "CJK Fonts";

export const obsidianToExcalidrawMap: { [key: string]: string } = {
  en: "en-US",
  af: "af-ZA", // Assuming South Africa for Afrikaans
  am: "am-ET", // Assuming Ethiopia for Amharic
  ar: "ar-SA",
  eu: "eu-ES",
  be: "be-BY", // Assuming Belarus for Belarusian
  bg: "bg-BG",
  bn: "bn-BD", // Assuming Bangladesh for Bengali
  ca: "ca-ES",
  cs: "cs-CZ",
  da: "da-DK", // Assuming Denmark for Danish
  de: "de-DE",
  el: "el-GR",
  eo: "eo-EO", // Esperanto doesn't have a country
  es: "es-ES",
  fa: "fa-IR",
  "fi-fi": "fi-FI",
  fr: "fr-FR",
  gl: "gl-ES",
  he: "he-IL",
  hi: "hi-IN",
  hu: "hu-HU",
  id: "id-ID",
  it: "it-IT",
  ja: "ja-JP",
  ko: "ko-KR",
  lv: "lv-LV",
  ml: "ml-IN", // Assuming India for Malayalam
  ms: "ms-MY", // Assuming Malaysia for Malay
  nl: "nl-NL",
  no: "nb-NO", // Using Norwegian Bokmål for Norwegian
  oc: "oc-FR", // Assuming France for Occitan
  pl: "pl-PL",
  pt: "pt-PT",
  "pt-BR": "pt-BR",
  ro: "ro-RO",
  ru: "ru-RU",
  sr: "sr-RS", // Assuming Serbia for Serbian
  se: "sv-SE", // Assuming Swedish for 'se'
  sk: "sk-SK",
  sq: "sq-AL", // Assuming Albania for Albanian
  ta: "ta-IN", // Assuming India for Tamil
  te: "te-IN", // Assuming India for Telugu
  th: "th-TH",
  tr: "tr-TR",
  uk: "uk-UA",
  ur: "ur-PK", // Assuming Pakistan for Urdu
  vi: "vi-VN",
  zh: "zh-CN",
  "zh-tw": "zh-TW",
};

export let {
  sceneCoordsToViewportCoords,
  viewportCoordsToSceneCoords,
  intersectElementWithLine,
  getCommonBoundingBox,
  getMaximumGroups,
  measureText,
  getLineHeight,
  wrapText,
  getFontString,
  getBoundTextMaxWidth,
  exportToSvg,
  exportToBlob,
  mutateElement,
  restoreElements,
  mermaidToExcalidraw,
  getFontFamilyString,
  getContainerElement,
  refreshTextDimensions,
  getCSSFontDefinition,
  loadSceneFonts,
  loadMermaid,
  syncInvalidIndices,
  getDefaultColorPalette,
} = excalidrawLib;

export function updateExcalidrawLib() {
  try {
    // First validate that excalidrawLib exists and has the expected methods
    if (!excalidrawLib) {
      throw new Error("excalidrawLib is undefined");
    }

    // Check that critical functions exist before assigning them
    const requiredFunctions = [
      "sceneCoordsToViewportCoords",
      "viewportCoordsToSceneCoords",
      "intersectElementWithLine",
      "getCommonBoundingBox",
      "measureText",
      "getLineHeight",
      "restoreElements",
    ];

    for (const fnName of requiredFunctions) {
      if (
        !(fnName in excalidrawLib) ||
        typeof excalidrawLib[fnName as keyof typeof excalidrawLib] !==
          "function"
      ) {
        throw new Error(
          `Required function ${fnName} is missing from excalidrawLib`,
        );
      }
    }

    // If validation passes, update the exported functions
    ({
      sceneCoordsToViewportCoords,
      viewportCoordsToSceneCoords,
      intersectElementWithLine,
      getCommonBoundingBox,
      getMaximumGroups,
      measureText,
      getLineHeight,
      wrapText,
      getFontString,
      getBoundTextMaxWidth,
      exportToSvg,
      exportToBlob,
      mutateElement,
      restoreElements,
      mermaidToExcalidraw,
      getFontFamilyString,
      getContainerElement,
      refreshTextDimensions,
      getCSSFontDefinition,
      loadSceneFonts,
      loadMermaid,
      syncInvalidIndices,
      getDefaultColorPalette,
    } = excalidrawLib);
  } catch (error) {
    errorHandler.handleError(error, "updateExcalidrawLib", true);
    // Don't throw here - we'll try to continue with potentially stale functions
    // but at least we won't crash
  }
}

export const FONTS_STYLE_ID = "excalidraw-custom-fonts";
export const CJK_STYLE_ID = "excalidraw-cjk-fonts";

export function JSON_parse<T>(x: string): T {
  return JSON.parse(x.replaceAll("&#91;", "[")) as T;
}

export const DEVICE: DeviceType = {
  isDesktop:
    !mainDocument.body.hasClass("is-tablet") &&
    !mainDocument.body.hasClass("is-mobile"),
  isPhone: mainDocument.body.hasClass("is-phone"),
  isTablet: mainDocument.body.hasClass("is-tablet"),
  isMobile: mainDocument.body.hasClass("is-mobile"), //running Obsidian Mobile, need to also check isTablet
  isLinux:
    mainDocument.body.hasClass("mod-linux") &&
    !mainDocument.body.hasClass("is-android"),
  isMacOS:
    mainDocument.body.hasClass("mod-macos") &&
    !mainDocument.body.hasClass("is-ios"),
  isWindows: mainDocument.body.hasClass("mod-windows"),
  isIOS: mainDocument.body.hasClass("is-ios"),
  isAndroid: mainDocument.body.hasClass("is-android"),
};

export let ROOTELEMENTSIZE: number = 16;
export function setRootElementSize(size?: number) {
  if (size) {
    ROOTELEMENTSIZE = size;
    return;
  }
  const tempElement = mainDocument.createElement("div");
  tempElement.style.fontSize = "1rem";
  tempElement.hidden = true;
  mainDocument.body.appendChild(tempElement);
  const computedStyle = getComputedStyle(tempElement);
  const pixelSize = parseFloat(computedStyle.fontSize);
  mainDocument.body.removeChild(tempElement);
  return pixelSize;
}

export const nanoid = customAlphabet(
  "1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  8,
);
export const KEYCODE = {
  ESC: 27,
};
export const ROUNDNESS = {
  //should at one point publish @zsviczian/excalidraw/types/constants
  LEGACY: 1,
  PROPORTIONAL_RADIUS: 2,
  ADAPTIVE_RADIUS: 3,
} as const;
export const THEME_FILTER = "invert(93%) hue-rotate(180deg) saturate(1.25)";
export const GITHUB_RELEASES =
  URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_RELEASES_TAG;
export const URLFETCHTIMEOUT = 3000;
export const PLUGIN_ID = "obsidian-excalidraw-plugin";
export const SCRIPT_INSTALL_CODEBLOCK = "excalidraw-script-install";
export const SCRIPT_INSTALL_FOLDER = "Downloaded";
export const fileid = customAlphabet("1234567890abcdef", 40);
export const REG_LINKINDEX_INVALIDCHARS = /[<>:"\\|?*#]/g;

//taken from Obsidian source code
export const REG_SECTION_REF_CLEAN = /([:#|^\\\r\n]|%%|\[\[|]])/g;
export const REG_BLOCK_REF_CLEAN = /[!"#$%&()*+,.:;<=>?@^`{|}~/[\]\\\r\n]/g;
//                                 /[!"#$%&()*+,.:;<=>?@^`{|}~/[\]\\]/g;
// https://discord.com/channels/686053708261228577/989603365606531104/1000128926619816048
// /\+|\/|~|=|%|\(|\)|{|}|,|&|\.|\$|!|\?|;|\[|]|\^|#|\*|<|>|&|@|\||\\|"|:|\s/g;
export const IMAGE_TYPES = [
  "jpeg",
  "jpg",
  "png",
  "gif",
  "svg",
  "webp",
  "bmp",
  "ico",
  "jtif",
  "tif",
  "jfif",
  "avif",
];
export const ANIMATED_IMAGE_TYPES = ["gif", "webp", "apng", "svg"];
export const EXPORT_TYPES = [
  "svg",
  "dark.svg",
  "light.svg",
  "png",
  "dark.png",
  "light.png",
];
export const MAX_IMAGE_SIZE = 500;
export const CARD_WIDTH = 400;
export const CARD_HEIGHT = 500;
export const VIDEO_TYPES = [
  "mp4",
  "webm",
  "ogv",
  "mov",
  "mkv",
  "avi",
  "m4v",
  "wmv",
];
export const AUDIO_TYPES = [
  "mp3",
  "wav",
  "m4a",
  "3gp",
  "flac",
  "ogg",
  "oga",
  "opus",
  "aac",
  "aiff",
  "aif",
  "mid",
  "midi",
];
export const CODE_TYPES = ["json", "css", "js"];

export const FRONTMATTER_KEYS = {
  plugin: { name: "excalidraw-plugin", type: "text", depricated: false },
  "export-transparent": {
    name: "excalidraw-export-transparent",
    type: "checkbox",
    depricated: false,
  },
  mask: { name: "excalidraw-mask", type: "checkbox", depricated: false },
  "export-dark": {
    name: "excalidraw-export-dark",
    type: "checkbox",
    depricated: false,
  },
  "export-svgpadding": {
    name: "excalidraw-export-svgpadding",
    type: "number",
    depricated: true,
  },
  "export-padding": {
    name: "excalidraw-export-padding",
    type: "number",
    depricated: false,
  },
  "export-pngscale": {
    name: "excalidraw-export-pngscale",
    type: "number",
    depricated: false,
  },
  "export-embed-scene": {
    name: "excalidraw-export-embed-scene",
    type: "checkbox",
    depricated: false,
  },
  "export-internal-links": {
    name: "excalidraw-export-internal-links",
    type: "checkbox",
    depricated: false,
  },
  "link-prefix": {
    name: "excalidraw-link-prefix",
    type: "text",
    depricated: false,
  },
  "url-prefix": {
    name: "excalidraw-url-prefix",
    type: "text",
    depricated: false,
  },
  "link-brackets": {
    name: "excalidraw-link-brackets",
    type: "checkbox",
    depricated: false,
  },
  "onload-script": {
    name: "excalidraw-onload-script",
    type: "text",
    depricated: false,
  },
  "linkbutton-opacity": {
    name: "excalidraw-linkbutton-opacity",
    type: "number",
    depricated: false,
  },
  "default-mode": {
    name: "excalidraw-default-mode",
    type: "text",
    depricated: false,
  },
  font: { name: "excalidraw-font", type: "text", depricated: false },
  "font-color": {
    name: "excalidraw-font-color",
    type: "text",
    depricated: false,
  },
  "border-color": {
    name: "excalidraw-border-color",
    type: "text",
    depricated: false,
  },
  "md-css": { name: "excalidraw-css", type: "text", depricated: false },
  autoexport: {
    name: "excalidraw-autoexport",
    type: "text",
    depricated: false,
  },
  "iframe-theme": {
    name: "excalidraw-iframe-theme",
    type: "text",
    depricated: true,
  },
  "embeddable-theme": {
    name: "excalidraw-embeddable-theme",
    type: "text",
    depricated: false,
  },
  "open-as-markdown": {
    name: "excalidraw-open-md",
    type: "checkbox",
    depricated: false,
  },
  "embed-as-markdown": {
    name: "excalidraw-embed-md",
    type: "checkbox",
    depricated: false,
  },
};

export const CaptureUpdateAction = {
  /**
   * Immediately undoable.
   *
   * Use for updates which should be captured.
   * Should be used for most of the local updates.
   *
   * These updates will _immediately_ make it to the local undo / redo stacks.
   */
  IMMEDIATELY: "IMMEDIATELY",
  /**
   * Never undoable.
   *
   * Use for updates which should never be recorded, such as remote updates
   * or scene initialization.
   *
   * These updates will _never_ make it to the local undo / redo stacks.
   */
  NEVER: "NEVER",
  /**
   * Eventually undoable.
   *
   * Use for updates which should not be captured immediately - likely
   * exceptions which are part of some async multi-step process. Otherwise, all
   * such updates would end up being captured with the next
   * `CaptureUpdateAction.IMMEDIATELY` - triggered either by the next `updateScene`
   * or internally by the editor.
   *
   * These updates will _eventually_ make it to the local undo / redo stacks.
   */
  EVENTUALLY: "EVENTUALLY",
} as const;

export const EMBEDDABLE_THEME_FRONTMATTER_VALUES = [
  "light",
  "dark",
  "auto",
  "dafault",
];
export const VIEW_TYPE_EXCALIDRAW = "excalidraw";
export const VIEW_TYPE_SIDEPANEL = "excalidraw-sidepanel";
export const VIEW_TYPE_EXCALIDRAW_LOADING = "excalidraw-loading";
export const ICON_NAME = "excalidraw-icon";
export const MAX_COLORS = 5;
export const COLOR_FREQ = 6;
export const RERENDER_EVENT = "excalidraw-embed-rerender";
export const BLANK_DRAWING = `{"type":"excalidraw","version":2,"source":"${GITHUB_RELEASES + PLUGIN_VERSION}","elements":[],"appState":{"gridSize":null,"viewBackgroundColor":"#ffffff"}}`;
export const DARK_BLANK_DRAWING = `{"type":"excalidraw","version":2,"source":"${GITHUB_RELEASES + PLUGIN_VERSION}","elements":[],"appState":{"theme":"dark","gridSize":null,"viewBackgroundColor":"#ffffff"}}`;
export const FRONTMATTER = [
  "---",
  "",
  `${FRONTMATTER_KEYS.plugin.name}: parsed`,
  "tags: [excalidraw]",
  "",
  "---",
  "==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠== You can decompress Drawing data with the command palette: 'Decompress current Excalidraw file'. For more info check in plugin settings under 'Saving'",
  "",
  "",
].join("\n");
export const EMPTY_MESSAGE = "Hit enter to create a new drawing";
export const TEXT_DISPLAY_PARSED_ICON_NAME = "quote-glyph";
export const TEXT_DISPLAY_RAW_ICON_NAME = "presentation";
/*export const FULLSCREEN_ICON_NAME = "fullscreen";
export const EXIT_FULLSCREEN_ICON_NAME = "exit-fullscreen";*/
export const SCRIPTENGINE_ICON_NAME = "ScriptEngine";

export const KEYBOARD_EVENT_TYPES = ["keydown", "keyup", "keypress"] as const;

export const EXTENDED_EVENT_TYPES = [
  /*  "pointerdown",
  "pointerup",
  "pointermove",
  "mousedown",
  "mouseup",
  "mousemove",
  "mouseover",
  "mouseout",
  "mouseenter",
  "mouseleave",
  "dblclick",
  "drag",
  "dragend",
  "dragenter",
  "dragexit",
  "dragleave",
  "dragover",
  "dragstart",
  "drop",*/
  "copy",
  "cut",
  "paste",
  /*"wheel",
  "touchstart",
  "touchend",
  "touchmove",*/
] as const;

//export const TWITTER_REG = /^(?:http(?:s)?:\/\/)?(?:(?:w){3}.)?twitter.com/;

export const COLOR_NAMES = new Map<string, string>();
COLOR_NAMES.set("aliceblue", "#f0f8ff");
COLOR_NAMES.set("antiquewhite", "#faebd7");
COLOR_NAMES.set("aqua", "#00ffff");
COLOR_NAMES.set("aquamarine", "#7fffd4");
COLOR_NAMES.set("azure", "#f0ffff");
COLOR_NAMES.set("beige", "#f5f5dc");
COLOR_NAMES.set("bisque", "#ffe4c4");
COLOR_NAMES.set("black", "#000000");
COLOR_NAMES.set("blanchedalmond", "#ffebcd");
COLOR_NAMES.set("blue", "#0000ff");
COLOR_NAMES.set("blueviolet", "#8a2be2");
COLOR_NAMES.set("brown", "#a52a2a");
COLOR_NAMES.set("burlywood", "#deb887");
COLOR_NAMES.set("cadetblue", "#5f9ea0");
COLOR_NAMES.set("chartreuse", "#7fff00");
COLOR_NAMES.set("chocolate", "#d2691e");
COLOR_NAMES.set("coral", "#ff7f50");
COLOR_NAMES.set("cornflowerblue", "#6495ed");
COLOR_NAMES.set("cornsilk", "#fff8dc");
COLOR_NAMES.set("crimson", "#dc143c");
COLOR_NAMES.set("cyan", "#00ffff");
COLOR_NAMES.set("darkblue", "#00008b");
COLOR_NAMES.set("darkcyan", "#008b8b");
COLOR_NAMES.set("darkgoldenrod", "#b8860b");
COLOR_NAMES.set("darkgray", "#a9a9a9");
COLOR_NAMES.set("darkgreen", "#006400");
COLOR_NAMES.set("darkkhaki", "#bdb76b");
COLOR_NAMES.set("darkmagenta", "#8b008b");
COLOR_NAMES.set("darkolivegreen", "#556b2f");
COLOR_NAMES.set("darkorange", "#ff8c00");
COLOR_NAMES.set("darkorchid", "#9932cc");
COLOR_NAMES.set("darkred", "#8b0000");
COLOR_NAMES.set("darksalmon", "#e9967a");
COLOR_NAMES.set("darkseagreen", "#8fbc8f");
COLOR_NAMES.set("darkslateblue", "#483d8b");
COLOR_NAMES.set("darkslategray", "#2f4f4f");
COLOR_NAMES.set("darkturquoise", "#00ced1");
COLOR_NAMES.set("darkviolet", "#9400d3");
COLOR_NAMES.set("deeppink", "#ff1493");
COLOR_NAMES.set("deepskyblue", "#00bfff");
COLOR_NAMES.set("dimgray", "#696969");
COLOR_NAMES.set("dodgerblue", "#1e90ff");
COLOR_NAMES.set("firebrick", "#b22222");
COLOR_NAMES.set("floralwhite", "#fffaf0");
COLOR_NAMES.set("forestgreen", "#228b22");
COLOR_NAMES.set("fuchsia", "#ff00ff");
COLOR_NAMES.set("gainsboro", "#dcdcdc");
COLOR_NAMES.set("ghostwhite", "#f8f8ff");
COLOR_NAMES.set("gold", "#ffd700");
COLOR_NAMES.set("goldenrod", "#daa520");
COLOR_NAMES.set("gray", "#808080");
COLOR_NAMES.set("green", "#008000");
COLOR_NAMES.set("greenyellow", "#adff2f");
COLOR_NAMES.set("honeydew", "#f0fff0");
COLOR_NAMES.set("hotpink", "#ff69b4");
COLOR_NAMES.set("indianred", "#cd5c5c");
COLOR_NAMES.set("indigo", "#4b0082");
COLOR_NAMES.set("ivory", "#fffff0");
COLOR_NAMES.set("khaki", "#f0e68c");
COLOR_NAMES.set("lavender", "#e6e6fa");
COLOR_NAMES.set("lavenderblush", "#fff0f5");
COLOR_NAMES.set("lawngreen", "#7cfc00");
COLOR_NAMES.set("lemonchiffon", "#fffacd");
COLOR_NAMES.set("lightblue", "#add8e6");
COLOR_NAMES.set("lightcoral", "#f08080");
COLOR_NAMES.set("lightcyan", "#e0ffff");
COLOR_NAMES.set("lightgoldenrodyellow", "#fafad2");
COLOR_NAMES.set("lightgrey", "#d3d3d3");
COLOR_NAMES.set("lightgreen", "#90ee90");
COLOR_NAMES.set("lightpink", "#ffb6c1");
COLOR_NAMES.set("lightsalmon", "#ffa07a");
COLOR_NAMES.set("lightseagreen", "#20b2aa");
COLOR_NAMES.set("lightskyblue", "#87cefa");
COLOR_NAMES.set("lightslategray", "#778899");
COLOR_NAMES.set("lightsteelblue", "#b0c4de");
COLOR_NAMES.set("lightyellow", "#ffffe0");
COLOR_NAMES.set("lime", "#00ff00");
COLOR_NAMES.set("limegreen", "#32cd32");
COLOR_NAMES.set("linen", "#faf0e6");
COLOR_NAMES.set("magenta", "#ff00ff");
COLOR_NAMES.set("maroon", "#800000");
COLOR_NAMES.set("mediumaquamarine", "#66cdaa");
COLOR_NAMES.set("mediumblue", "#0000cd");
COLOR_NAMES.set("mediumorchid", "#ba55d3");
COLOR_NAMES.set("mediumpurple", "#9370d8");
COLOR_NAMES.set("mediumseagreen", "#3cb371");
COLOR_NAMES.set("mediumslateblue", "#7b68ee");
COLOR_NAMES.set("mediumspringgreen", "#00fa9a");
COLOR_NAMES.set("mediumturquoise", "#48d1cc");
COLOR_NAMES.set("mediumvioletred", "#c71585");
COLOR_NAMES.set("midnightblue", "#191970");
COLOR_NAMES.set("mintcream", "#f5fffa");
COLOR_NAMES.set("mistyrose", "#ffe4e1");
COLOR_NAMES.set("moccasin", "#ffe4b5");
COLOR_NAMES.set("navajowhite", "#ffdead");
COLOR_NAMES.set("navy", "#000080");
COLOR_NAMES.set("oldlace", "#fdf5e6");
COLOR_NAMES.set("olive", "#808000");
COLOR_NAMES.set("olivedrab", "#6b8e23");
COLOR_NAMES.set("orange", "#ffa500");
COLOR_NAMES.set("orangered", "#ff4500");
COLOR_NAMES.set("orchid", "#da70d6");
COLOR_NAMES.set("palegoldenrod", "#eee8aa");
COLOR_NAMES.set("palegreen", "#98fb98");
COLOR_NAMES.set("paleturquoise", "#afeeee");
COLOR_NAMES.set("palevioletred", "#d87093");
COLOR_NAMES.set("papayawhip", "#ffefd5");
COLOR_NAMES.set("peachpuff", "#ffdab9");
COLOR_NAMES.set("peru", "#cd853f");
COLOR_NAMES.set("pink", "#ffc0cb");
COLOR_NAMES.set("plum", "#dda0dd");
COLOR_NAMES.set("powderblue", "#b0e0e6");
COLOR_NAMES.set("purple", "#800080");
COLOR_NAMES.set("rebeccapurple", "#663399");
COLOR_NAMES.set("red", "#ff0000");
COLOR_NAMES.set("rosybrown", "#bc8f8f");
COLOR_NAMES.set("royalblue", "#4169e1");
COLOR_NAMES.set("saddlebrown", "#8b4513");
COLOR_NAMES.set("salmon", "#fa8072");
COLOR_NAMES.set("sandybrown", "#f4a460");
COLOR_NAMES.set("seagreen", "#2e8b57");
COLOR_NAMES.set("seashell", "#fff5ee");
COLOR_NAMES.set("sienna", "#a0522d");
COLOR_NAMES.set("silver", "#c0c0c0");
COLOR_NAMES.set("skyblue", "#87ceeb");
COLOR_NAMES.set("slateblue", "#6a5acd");
COLOR_NAMES.set("slategray", "#708090");
COLOR_NAMES.set("snow", "#fffafa");
COLOR_NAMES.set("springgreen", "#00ff7f");
COLOR_NAMES.set("steelblue", "#4682b4");
COLOR_NAMES.set("tan", "#d2b48c");
COLOR_NAMES.set("teal", "#008080");
COLOR_NAMES.set("thistle", "#d8bfd8");
COLOR_NAMES.set("tomato", "#ff6347");
COLOR_NAMES.set("turquoise", "#40e0d0");
COLOR_NAMES.set("violet", "#ee82ee");
COLOR_NAMES.set("wheat", "#f5deb3");
COLOR_NAMES.set("white", "#ffffff");
COLOR_NAMES.set("whitesmoke", "#f5f5f5");
COLOR_NAMES.set("yellow", "#ffff00");
COLOR_NAMES.set("yellowgreen", "#9acd32");
export const DEFAULT_MD_EMBED_CSS = `.snw-reference{display: none;}.excalidraw-md-host{padding:0px 10px}.excalidraw-md-footer{height:5px}foreignObject{background-color:transparent}p{display:block;margin-block-start:1em;margin-block-end:1em;margin-inline-start:0px;margin-inline-end:0px;color:inherit}table,tr,th,td{color:inherit;border:1px solid;border-collapse:collapse;padding:3px}th{font-weight:bold;border-bottom:double;background-color:silver}.copy-code-button{display:none}code[class*=language-],pre[class*=language-]{color:#393a34;font-family:"Consolas","Bitstream Vera Sans Mono","Courier New",Courier,monospace;direction:ltr;text-align:left;white-space:pre;word-spacing:normal;word-break:normal;font-size:.9em;line-height:1.2em;-moz-tab-size:4;-o-tab-size:4;tab-size:4;-webkit-hyphens:none;-moz-hyphens:none;-ms-hyphens:none;hyphens:none}pre>code[class*=language-]{font-size:1em}pre[class*=language-]::-moz-selection,pre[class*=language-] ::-moz-selection,code[class*=language-]::-moz-selection,code[class*=language-] ::-moz-selection{background:#C1DEF1}pre[class*=language-]::selection,pre[class*=language-] ::selection,code[class*=language-]::selection,code[class*=language-] ::selection{background:#C1DEF1}pre[class*=language-]{padding:1em;margin:.5em 0;overflow:auto;background-color:#0000001a}:not(pre)>code[class*=language-]{padding:.2em;padding-top:1px;padding-bottom:1px;background:#f8f8f8;border:1px solid #dddddd}.token.comment,.token.prolog,.token.doctype,.token.cdata{color:green;font-style:italic}.token.namespace{opacity:.7}.token.string{color:#a31515}.token.punctuation,.token.operator{color:#393a34}.token.url,.token.symbol,.token.number,.token.boolean,.token.variable,.token.constant,.token.inserted{color:#36acaa}.token.atrule,.token.keyword,.token.attr-value,.language-autohotkey .token.selector,.language-json .token.boolean,.language-json .token.number,code[class*=language-css]{color:#00f}.token.function{color:#393a34}.token.deleted,.language-autohotkey .token.tag{color:#9a050f}.token.selector,.language-autohotkey .token.keyword{color:#00009f}.token.important{color:#e90}.token.important,.token.bold{font-weight:bold}.token.italic{font-style:italic}.token.class-name,.language-json .token.property{color:#2b91af}.token.tag,.token.selector{color:maroon}.token.attr-name,.token.property,.token.regex,.token.entity{color:red}.token.directive.tag .tag{background:#ffff00;color:#393a34}.line-numbers.line-numbers .line-numbers-rows{border-right-color:#a5a5a5}.line-numbers .line-numbers-rows>span:before{color:#2b91af}.line-highlight.line-highlight{background:rgba(193,222,241,.2);background:-webkit-linear-gradient(left,rgba(193,222,241,.2) 70%,rgba(221,222,241,0));background:linear-gradient(to right,rgba(193,222,241,.2) 70%,rgba(221,222,241,0))}blockquote{ font-style:italic;background-color:rgb(46,43,42,0.1);margin:0;margin-left:1em;border-radius:0 4px 4px 0;border:1px solid hsl(0,80%,32%);border-left-width:8px;border-top-width:0px;border-right-width:0px;border-bottom-width:0px;padding:10px 20px;margin-inline-start:30px;margin-inline-end:30px;}`;
export const SCRIPTENGINE_ICON = `<g transform="translate(-8,-8)"><path d="M24.318 37.983c-1.234-1.232-8.433-3.903-7.401-7.387 1.057-3.484 9.893-12.443 13.669-13.517 3.776-1.074 6.142 6.523 9.012 7.073 2.87.55 6.797-1.572 8.207-3.694 1.384-2.148-3.147-7.413.15-9.168 3.298-1.755 16.389-2.646 19.611-1.284 3.247 1.363-1.611 7.335-.151 9.483 1.46 2.148 6.067 3.746 8.836 3.38 2.769-.368 4.154-6.733 7.728-5.633 3.575 1.1 12.36 8.828 13.67 12.233 1.308 3.406-5.186 5.423-5.79 8.2-.58 2.75-.026 6.705 2.265 8.355 2.266 1.65 9.642-1.78 11.404 1.598 1.762 3.38 1.007 15.35-.806 18.651-1.787 3.353-7.753-.367-9.969 1.31-2.215 1.65-3.901 5.92-3.373 8.67.504 2.777 7.754 4.48 6.445 7.885C96.49 87.543 87.15 95.454 83.5 96.685c-3.65 1.231-4.96-4.741-7.577-5.16-2.593-.393-6.57.707-8.03 2.75-1.436 2.017 2.668 7.806-.63 9.483-3.323 1.676-15.759 2.226-19.157.655-3.373-1.598.554-7.964-1.108-10.138-1.687-2.174-6.394-3.431-9.012-2.907-2.643.55-3.273 7.282-6.747 6.103-3.499-1.126-12.788-9.535-14.172-13.019-1.36-3.484 5.437-5.108 5.966-7.858.529-2.777-.68-7.073-2.744-8.697-2.064-1.624-7.93 2.41-9.642-1.126-1.737-3.537-2.441-16.765-.654-20.118 1.787-3.3 9.062 1.598 11.429.183 2.366-1.44 2.316-7.282 2.769-8.749m.126-.104c-1.234-1.232-8.433-3.903-7.401-7.387 1.057-3.484 9.893-12.443 13.669-13.517 3.776-1.074 6.142 6.523 9.012 7.073 2.87.55 6.797-1.572 8.207-3.694 1.384-2.148-3.147-7.413.15-9.168 3.298-1.755 16.389-2.646 19.611-1.284 3.247 1.363-1.611 7.335-.151 9.483 1.46 2.148 6.067 3.746 8.836 3.38 2.769-.368 4.154-6.733 7.728-5.633 3.575 1.1 12.36 8.828 13.67 12.233 1.308 3.406-5.186 5.423-5.79 8.2-.58 2.75-.026 6.705 2.265 8.355 2.266 1.65 9.642-1.78 11.404 1.598 1.762 3.38 1.007 15.35-.806 18.651-1.787 3.353-7.753-.367-9.969 1.31-2.215 1.65-3.901 5.92-3.373 8.67.504 2.777 7.754 4.48 6.445 7.885C96.49 87.543 87.15 95.454 83.5 96.685c-3.65 1.231-4.96-4.741-7.577-5.16-2.593-.393-6.57.707-8.03 2.75-1.436 2.017 2.668 7.806-.63 9.483-3.323 1.676-15.759 2.226-19.157.655-3.373-1.598.554-7.964-1.108-10.138-1.687-2.174-6.394-3.431-9.012-2.907-2.643.55-3.273 7.282-6.747 6.103-3.499-1.126-12.788-9.535-14.172-13.019-1.36-3.484 5.437-5.108 5.966-7.858.529-2.777-.68-7.073-2.744-8.697-2.064-1.624-7.93 2.41-9.642-1.126-1.737-3.537-2.441-16.765-.654-20.118 1.787-3.3 9.062 1.598 11.429.183 2.366-1.44 2.316-7.282 2.769-8.749" fill="none" stroke-width="2" stroke-linecap="round" stroke="currentColor"/><path d="M81.235 56.502a23.3 23.3 0 0 1-1.46 8.068 20.785 20.785 0 0 1-1.762 3.72 24.068 24.068 0 0 1-5.337 6.26 22.575 22.575 0 0 1-3.449 2.358 23.726 23.726 0 0 1-7.803 2.803 24.719 24.719 0 0 1-8.333 0 24.102 24.102 0 0 1-4.028-1.074 23.71 23.71 0 0 1-3.776-1.729 23.259 23.259 0 0 1-6.369-5.265 23.775 23.775 0 0 1-2.416-3.353 24.935 24.935 0 0 1-1.762-3.72 23.765 23.765 0 0 1-1.083-3.981 23.454 23.454 0 0 1 0-8.173c.252-1.336.604-2.698 1.083-3.956a24.935 24.935 0 0 1 1.762-3.72 22.587 22.587 0 0 1 2.416-3.378c.881-1.048 1.888-2.017 2.946-2.908a24.38 24.38 0 0 1 3.423-2.357 23.71 23.71 0 0 1 3.776-1.73 21.74 21.74 0 0 1 4.028-1.047 23.437 23.437 0 0 1 8.333 0 24.282 24.282 0 0 1 7.803 2.777 26.198 26.198 0 0 1 3.45 2.357 24.62 24.62 0 0 1 5.336 6.287 20.785 20.785 0 0 1 1.762 3.72 21.32 21.32 0 0 1 1.083 3.955c.251 1.336.302 3.405.377 4.086.05.681.05-.68 0 0" fill="none" stroke-width="4" stroke-linecap="round" stroke="currentColor"/><path d="M69.404 56.633c-6.596-3.3-13.216-6.6-19.51-9.744m19.51 9.744c-6.747-3.379-13.493-6.758-19.51-9.744m0 0v19.489m0-19.49v19.49m0 0c4.355-2.148 8.71-4.322 19.51-9.745m-19.51 9.745c3.978-1.965 7.93-3.956 19.51-9.745m0 0h0m0 0h0" fill="currentColor" stroke-linecap="round" stroke="currentColor" stroke-width="4"/></g>`;
export const DISK_ICON_NAME = "save";
export const EXPORT_IMG_ICON = ` <g transform="scale(4.166)" strokeWidth="1.25" fill="none" stroke="currentColor"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M15 8h.01"></path><path d="M12 20h-5a3 3 0 0 1 -3 -3v-10a3 3 0 0 1 3 -3h10a3 3 0 0 1 3 3v5"></path><path d="M4 15l4 -4c.928 -.893 2.072 -.893 3 0l4 4"></path><path d="M14 14l1 -1c.617 -.593 1.328 -.793 2.009 -.598"></path><path d="M19 16v6"></path><path d="M22 19l-3 3l-3 -3"></path></g>`;
export const EXPORT_IMG_ICON_NAME = `export-img`;
export const EXCALIDRAW_ICON = `<path d="M24 17h121v121H24z" style="fill:none" transform="matrix(.8843 0 0 .83471 -21.223 -14.19)"/><path d="M119.81 105.98a.549.549 0 0 0-.53-.12c-4.19-6.19-9.52-12.06-14.68-17.73l-.85-.93c0-.11-.05-.21-.12-.3a.548.548 0 0 0-.34-.2l-.17-.18-.12-.09c-.15-.32-.53-.56-.95-.35-1.58.81-3 1.97-4.4 3.04-1.87 1.43-3.7 2.92-5.42 4.52-.7.65-1.39 1.33-1.97 2.09-.28.37-.07.72.27.87-1.22 1.2-2.45 2.45-3.68 3.74-.11.12-.17.28-.16.44.01.16.09.31.22.41l2.16 1.65s.01.03.03.04c3.09 3.05 8.51 7.28 14.25 11.76.85.67 1.71 1.34 2.57 2.01.39.47.76.94 1.12 1.4.19.25.55.3.8.11.13.1.26.21.39.31a.57.57 0 0 0 .8-.1c.07-.09.1-.2.11-.31.04 0 .07.03.1.03.15 0 .31-.06.42-.18l10.18-11.12a.56.56 0 0 0-.04-.8l.01-.01Zm-29.23-3.85c.07.09.14.17.21.25 1.16.98 2.4 2.04 3.66 3.12l-5.12-3.91s-.32-.22-.52-.36c-.11-.08-.21-.16-.31-.24l-.38-.32s.07-.07.1-.11l.35-.35c1.72-1.74 4.67-4.64 6.19-6.06-1.61 1.62-4.87 6.37-4.17 7.98h-.01Zm17.53 13.81-4.22-3.22c-1.65-1.71-3.43-3.4-5.24-5.03 2.28 1.76 4.23 3.25 4.52 3.51 2.21 1.97 2.11 1.61 3.63 2.91l1.83 1.33c-.18.16-.36.33-.53.49l.01.01Zm1.06.81-.08-.06c.16-.13.33-.25.49-.38l-.4.44h-.01Zm-66.93-65.3c.14.72.27 1.43.4 2.11.69 3.7 1.33 7.03 2.55 9.56l.48 1.92c.19.73.46 1.64.71 1.83 2.85 2.52 7.22 6.28 11.89 9.82.21.16.5.15.7-.01.01.02.03.03.04.04.11.1.24.15.38.15.16 0 .31-.06.42-.19 5.98-6.65 10.43-12.12 13.6-16.7.2-.25.3-.54.29-.84.2-.24.41-.48.6-.68a.558.558 0 0 0-.1-.86.578.578 0 0 0-.17-.36c-1.39-1.34-2.42-2.31-3.46-3.28-1.84-1.72-3.74-3.5-7.77-7.51-.02-.02-.05-.04-.07-.06a.555.555 0 0 0-.22-.14c-1.11-.39-3.39-.78-6.26-1.28-4.22-.72-10-1.72-15.2-3.27h-.04v-.01s-.02 0-.03.02h-.01l.04-.02s-.31.01-.37.04c-.08.04-.14.09-.19.15-.05.06-.09.12-.47.2-.38.08.08 0 .11 0h-.11v.03c.07.34.05.58.16.97-.02.1.21 1.02.24 1.11l1.83 7.26h.03Zm30.95 6.54s-.03.04-.04.05l-.64-.71c.22.21.44.42.68.66Zm-7.09 9.39s-.07.08-.1.12l-.02-.02c.04-.03.08-.07.13-.1h-.01Zm-7.07 8.47Zm3.02-28.57c.35.35 1.74 1.65 2.06 1.97-1.45-.66-5.06-2.34-6.74-2.88 1.65.29 3.93.66 4.68.91Zm-19.18-2.77c.84 1.44 1.5 6.49 2.16 11.4-.37-1.58-.69-3.12-.99-4.6-.52-2.56-1-4.85-1.67-6.88.14.01.31.03.49.05 0 .01 0 .02.02.03h-.01Zm-.29-1.21c-.23-.02-.44-.04-.62-.05-.02-.04-.03-.08-.04-.12l.66.18v-.01Zm-2.22.45v-.02.02Zm78.54-1.18c.04-.23-1.1-1.24-.74-1.26.85-.04.86-1.35 0-1.31-1.13.06-2.27.32-3.37.53-1.98.37-3.95.78-5.92 1.21-4.39.94-8.77 1.93-13.1 3.11-1.36.37-2.86.7-4.11 1.36-.42.22-.4.67-.17.95-.09.05-.18.08-.28.09-.37.07-.74.13-1.11.19a.566.566 0 0 0-.39.86c-2.32 3.1-4.96 6.44-7.82 9.95-2.81 3.21-5.73 6.63-8.72 10.14-9.41 11.06-20.08 23.6-31.9 34.64-.23.21-.24.57-.03.8.05.06.12.1.19.13-.16.15-.32.3-.48.44-.1.09-.14.2-.16.32-.08.08-.16.17-.23.25-.21.23-.2.59.03.8.23.21.59.2.8-.03.04-.04.08-.09.12-.13a.84.84 0 0 1 1.22 0c.69.74 1.34 1.44 1.95 2.09l-1.38-1.15a.57.57 0 0 0-.8.07c-.2.24-.17.6.07.8l14.82 12.43c.11.09.24.13.37.13.15 0 .29-.06.4-.17l.36-.36a.56.56 0 0 0 .63-.12c20.09-20.18 36.27-35.43 54.8-49.06.17-.12.25-.32.23-.51a.57.57 0 0 0 .48-.39c3.42-10.46 4.08-19.72 4.28-24.27 0-.03.01-.05.02-.07.02-.05.03-.1.04-.14.03-.11.05-.19.05-.19.26-.78.17-1.53-.15-2.15v.02ZM82.98 58.94c.9-1.03 1.79-2.04 2.67-3.02-5.76 7.58-15.3 19.26-28.81 33.14 9.2-10.18 18.47-20.73 26.14-30.12Zm-32.55 52.81-.03-.03c.11.02.19.04.2.04a.47.47 0 0 0-.17 0v-.01Zm6.9 6.42-.05-.04.03-.03c.02 0 .03.02.04.02 0 .02-.02.03-.03.05h.01Zm8.36-7.21 1.38-1.44c.01.01.02.03.03.05-.47.46-.94.93-1.42 1.39h.01Zm2.24-2.21c.26-.3.56-.65.87-1.02.01-.01.02-.03.04-.04 3.29-3.39 6.68-6.82 10.18-10.25.02-.02.05-.04.07-.06.86-.66 1.82-1.39 2.72-2.08-4.52 4.32-9.11 8.78-13.88 13.46v-.01Zm21.65-55.88c-1.86 2.42-3.9 5.56-5.63 8.07-5.46 7.91-23.04 27.28-23.43 27.65-2.71 2.62-10.88 10.46-16.09 15.37-.14.13-.25.24-.34.35a.794.794 0 0 1 .03-1.13c24.82-23.4 39.88-42.89 46-51.38-.13.33-.24.69-.55 1.09l.01-.02Zm16.51 7.1-.01.02c0-.02-.02-.07.01-.02Zm-.91-5.13Zm-5.89 9.45c-2.26-1.31-3.32-3.27-2.71-5.25l.19-.66c.08-.19.17-.38.28-.57.59-.98 1.49-1.85 2.52-2.36.05-.02.1-.03.15-.04a.795.795 0 0 1-.04-.43c.05-.31.25-.58.66-.58.67 0 2.75.62 3.54 1.3.24.19.47.4.68.63.3.35.74.92.96 1.33.13.06.23.62.38.91.14.46.2.93.18 1.4 0 .02 0 .02.01.03-.03.07 0 .37-.04.4-.1.72-.36 1.43-.75 2.05-.04.05-.07.11-.11.16 0 .01-.02.02-.03.04-.3.43-.65.83-1.08 1.13-1.26.89-2.73 1.16-4.2.79a6.33 6.33 0 0 1-.57-.25l-.02-.03Zm16.27-1.63c-.49 2.05-1.09 4.19-1.8 6.38-.03.08-.03.16-.03.23-.1.01-.19.05-.27.11-4.44 3.26-8.73 6.62-12.98 10.11 3.67-3.32 7.39-6.62 11.23-9.95a6.409 6.409 0 0 0 2.11-3.74l.56-3.37.03-.1c.25-.71 1.34-.4 1.17.33h-.02Z" style="fill:currentColor;fill-rule:nonzero" transform="translate(-26.41 -29.49)"/>`;

export const LOGO_EXCALIDRAW_MASTERY = `data:image/png;base64,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`;
