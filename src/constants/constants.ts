import { customAlphabet } from "nanoid";
import { DeviceType } from "../types";
import { ExcalidrawLib } from "../ExcalidrawLib";
import { moment } from "obsidian";
//This is only for backward compatibility because an early version of obsidian included an encoding to avoid fantom links from littering Obsidian graph view
declare const PLUGIN_VERSION:string;

export const ERROR_IFRAME_CONVERSION_CANCELED = "iframe conversion canceled";

declare const excalidrawLib: typeof ExcalidrawLib;

export const LOCALE = moment.locale();

export const obsidianToExcalidrawMap: { [key: string]: string } = {
  'en': 'en-US',
  'af': 'af-ZA', // Assuming South Africa for Afrikaans
  'am': 'am-ET', // Assuming Ethiopia for Amharic
  'ar': 'ar-SA',
  'eu': 'eu-ES',
  'be': 'be-BY', // Assuming Belarus for Belarusian
  'bg': 'bg-BG',
  'bn': 'bn-BD', // Assuming Bangladesh for Bengali
  'ca': 'ca-ES',
  'cs': 'cs-CZ',
  'da': 'da-DK', // Assuming Denmark for Danish
  'de': 'de-DE',
  'el': 'el-GR',
  'eo': 'eo-EO', // Esperanto doesn't have a country
  'es': 'es-ES',
  'fa': 'fa-IR',
  'fi-fi': 'fi-FI',
  'fr': 'fr-FR',
  'gl': 'gl-ES',
  'he': 'he-IL',
  'hi': 'hi-IN',
  'hu': 'hu-HU',
  'id': 'id-ID',
  'it': 'it-IT',
  'ja': 'ja-JP',
  'ko': 'ko-KR',
  'lv': 'lv-LV',
  'ml': 'ml-IN', // Assuming India for Malayalam
  'ms': 'ms-MY', // Assuming Malaysia for Malay
  'nl': 'nl-NL',
  'no': 'nb-NO', // Using Norwegian Bokmål for Norwegian
  'oc': 'oc-FR', // Assuming France for Occitan
  'pl': 'pl-PL',
  'pt': 'pt-PT',
  'pt-BR': 'pt-BR',
  'ro': 'ro-RO',
  'ru': 'ru-RU',
  'sr': 'sr-RS', // Assuming Serbia for Serbian
  'se': 'sv-SE', // Assuming Swedish for 'se'
  'sk': 'sk-SK',
  'sq': 'sq-AL', // Assuming Albania for Albanian
  'ta': 'ta-IN', // Assuming India for Tamil
  'te': 'te-IN', // Assuming India for Telugu
  'th': 'th-TH',
  'tr': 'tr-TR',
  'uk': 'uk-UA',
  'ur': 'ur-PK', // Assuming Pakistan for Urdu
  'vi': 'vi-VN',
  'zh': 'zh-CN',
  'zh-TW': 'zh-TW',
};


export const {
  sceneCoordsToViewportCoords,
  viewportCoordsToSceneCoords,
  determineFocusDistance,
  intersectElementWithLine,
  getCommonBoundingBox,
  getMaximumGroups,
  measureText,
  getDefaultLineHeight,
  wrapText, 
  getFontString, 
  getBoundTextMaxWidth, 
  exportToSvg,
  exportToBlob,
  mutateElement,
  restore,
  mermaidToExcalidraw,
} = excalidrawLib;

export function JSON_parse(x: string): any {
  return JSON.parse(x.replaceAll("&#91;", "["));
}
export const isDarwin = /Mac|iPod|iPhone|iPad/.test(window.navigator.platform);

export const DEVICE: DeviceType = {
  isDesktop: !document.body.hasClass("is-tablet") && !document.body.hasClass("is-mobile"),
  isPhone: document.body.hasClass("is-phone"),
  isTablet: document.body.hasClass("is-tablet"),
  isMobile: document.body.hasClass("is-mobile"), //running Obsidian Mobile, need to also check isTablet
  isLinux: document.body.hasClass("mod-linux") && ! document.body.hasClass("is-android"),
  isMacOS: document.body.hasClass("mod-macos") && ! document.body.hasClass("is-ios"),
  isWindows: document.body.hasClass("mod-windows"),
  isIOS: document.body.hasClass("is-ios"),
  isAndroid: document.body.hasClass("is-android")
};

export const ROOTELEMENTSIZE = (() => {
  const tempElement = document.createElement('div');
  tempElement.style.fontSize = '1rem';
  tempElement.style.display = 'none'; // Hide the element
  document.body.appendChild(tempElement);
  const computedStyle = getComputedStyle(tempElement);
  const pixelSize = parseFloat(computedStyle.fontSize);
  document.body.removeChild(tempElement);
  return pixelSize;
})();

export const nanoid = customAlphabet(
  "1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  8,
);
export const KEYCODE = {
  ESC: 27,
};
export const ROUNDNESS = { //should at one point publish @zsviczian/excalidraw/types/constants
  LEGACY: 1,
  PROPORTIONAL_RADIUS: 2,
  ADAPTIVE_RADIUS: 3,
} as const;
export const THEME_FILTER = "invert(100%) hue-rotate(180deg) saturate(1.25)";
export const GITHUB_RELEASES = "https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/";
export const URLFETCHTIMEOUT = 3000;
export const PLUGIN_ID = "obsidian-excalidraw-plugin";
export const SCRIPT_INSTALL_CODEBLOCK = "excalidraw-script-install";
export const SCRIPT_INSTALL_FOLDER = "Downloaded";
export const fileid = customAlphabet("1234567890abcdef", 40);
export const REG_LINKINDEX_INVALIDCHARS = /[<>:"\\|?*#]/g;

//taken from Obsidian source code
export const REG_SECTION_REF_CLEAN = /([:#|^\\\r\n]|%%|\[\[|]])/g;
export const REG_BLOCK_REF_CLEAN = /[!"#$%&()*+,.:;<=>?@^`{|}~\/\[\]\\\r\n]/g;
//                                 /[!"#$%&()*+,.:;<=>?@^`{|}~\/\[\]\\]/g; 
// https://discord.com/channels/686053708261228577/989603365606531104/1000128926619816048
// /\+|\/|~|=|%|\(|\)|{|}|,|&|\.|\$|!|\?|;|\[|]|\^|#|\*|<|>|&|@|\||\\|"|:|\s/g;
export const IMAGE_TYPES = ["jpeg", "jpg", "png", "gif", "svg", "webp", "bmp", "ico", "jtif", "tif"];
export const ANIMATED_IMAGE_TYPES = ["gif", "webp", "apng", "svg"];
export const EXPORT_TYPES = ["svg", "dark.svg", "light.svg", "png", "dark.png", "light.png"];
export const MAX_IMAGE_SIZE = 500;

export const FRONTMATTER_KEYS:{[key:string]: {name: string, type: string, depricated?:boolean}} = {
  "plugin": {name: "excalidraw-plugin", type: "text"},
  "export-transparent": {name: "excalidraw-export-transparent", type: "checkbox"},
  "mask": {name: "excalidraw-mask", type: "checkbox"},
  "export-dark": {name: "excalidraw-export-dark", type: "checkbox"},
  "export-svgpadding": {name: "excalidraw-export-svgpadding", type: "number", depricated: true},
  "export-padding": {name: "excalidraw-export-padding", type: "number"},
  "export-pngscale": {name: "excalidraw-export-pngscale", type: "number"},
  "link-prefix": {name: "excalidraw-link-prefix", type: "text"},
  "url-prefix": {name: "excalidraw-url-prefix", type: "text"},
  "link-brackets": {name: "excalidraw-link-brackets", type: "checkbox"},
  "onload-script": {name: "excalidraw-onload-script", type: "text"},
  "linkbutton-opacity": {name: "excalidraw-linkbutton-opacity", type: "number"},
  "default-mode": {name: "excalidraw-default-mode", type: "text"},
  "font": {name: "excalidraw-font", type: "text"},
  "font-color": {name: "excalidraw-font-color", type: "text"},
  "border-color": {name: "excalidraw-border-color", type: "text"},
  "md-css": {name: "excalidraw-css", type: "text"},
  "autoexport": {name: "excalidraw-autoexport", type: "checkbox"},
  "iframe-theme": {name: "excalidraw-iframe-theme", type: "text"}, 
};

export const EMBEDDABLE_THEME_FRONTMATTER_VALUES = ["light", "dark", "auto", "dafault"];
export const VIEW_TYPE_EXCALIDRAW = "excalidraw";
export const ICON_NAME = "excalidraw-icon";
export const MAX_COLORS = 5;
export const COLOR_FREQ = 6;
export const RERENDER_EVENT = "excalidraw-embed-rerender";
export const BLANK_DRAWING =
  `{"type":"excalidraw","version":2,"source":"${GITHUB_RELEASES+PLUGIN_VERSION}","elements":[],"appState":{"gridSize":null,"viewBackgroundColor":"#ffffff"}}`;
export const DARK_BLANK_DRAWING =
  `{"type":"excalidraw","version":2,"source":"${GITHUB_RELEASES+PLUGIN_VERSION}","elements":[],"appState":{"theme":"dark","gridSize":null,"viewBackgroundColor":"#ffffff"}}`;
export const FRONTMATTER = [
  "---",
  "",
  `${FRONTMATTER_KEYS["plugin"].name}: parsed`,
  "tags: [excalidraw]",
  "",
  "---",
  "==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠==",
  "",
  "",
].join("\n");
export const EMPTY_MESSAGE = "Hit enter to create a new drawing";
export const TEXT_DISPLAY_PARSED_ICON_NAME = "quote-glyph";
export const TEXT_DISPLAY_RAW_ICON_NAME = "presentation";
/*export const FULLSCREEN_ICON_NAME = "fullscreen";
export const EXIT_FULLSCREEN_ICON_NAME = "exit-fullscreen";*/
export const SCRIPTENGINE_ICON_NAME = "ScriptEngine";

export const KEYBOARD_EVENT_TYPES = [
  "keydown",
  "keyup",
  "keypress"
];

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
];

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