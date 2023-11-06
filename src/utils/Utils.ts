//import Excalidraw from "@zsviczian/excalidraw";
import {
  App,
  Notice,
  parseFrontMatterEntry,
  request,
  requestUrl,
  TFile,
} from "obsidian";
import { Random } from "roughjs/bin/math";
import { BinaryFileData, DataURL} from "@zsviczian/excalidraw/types/types";
import {
  CASCADIA_FONT,
  VIRGIL_FONT,
  FRONTMATTER_KEY_EXPORT_DARK,
  FRONTMATTER_KEY_EXPORT_TRANSPARENT,
  FRONTMATTER_KEY_EXPORT_SVGPADDING,
  FRONTMATTER_KEY_EXPORT_PNGSCALE,
  FRONTMATTER_KEY_EXPORT_PADDING,
  exportToSvg,
  exportToBlob,
  IMAGE_TYPES
} from "../constants";
import ExcalidrawPlugin from "../main";
import { ExcalidrawElement } from "@zsviczian/excalidraw/types/element/types";
import { ExportSettings } from "../ExcalidrawView";
import { compressToBase64, decompressFromBase64 } from "lz-string";
import { getDataURLFromURL, getIMGFilename, getMimeType, getURLImageExtension } from "./FileUtils";
import { generateEmbeddableLink } from "./CustomEmbeddableUtils";
import ExcalidrawScene from "src/svgToExcalidraw/elements/ExcalidrawScene";
import { FILENAMEPARTS } from "./UtilTypes";
import { Mutable } from "@zsviczian/excalidraw/types/utility-types";
import { cleanBlockRef, cleanSectionHeading } from "./ObsidianUtils";


declare const PLUGIN_VERSION:string;

declare module "obsidian" {
  interface Workspace {
    getAdjacentLeafInDirection(
      leaf: WorkspaceLeaf,
      direction: string,
    ): WorkspaceLeaf;
  }
  interface Vault {
    getConfig(option: "attachmentFolderPath"): string;
  }
}

let versionUpdateChecked = false;
export const checkExcalidrawVersion = async (app: App) => {
  if (versionUpdateChecked) {
    return;
  }
  versionUpdateChecked = true;

  try {
    const gitAPIrequest = async () => {
      return JSON.parse(
        await request({
          url: `https://api.github.com/repos/zsviczian/obsidian-excalidraw-plugin/releases?per_page=5&page=1`,
        }),
      );
    };

    const latestVersion = (await gitAPIrequest())
      .map((el: any) => {
        return {
          version: el.tag_name,
          published: new Date(el.published_at),
        };
      })
      .filter((el: any) => el.version.match(/^\d+\.\d+\.\d+$/))
      .sort((el1: any, el2: any) => el2.published - el1.published)[0].version;

    if (isVersionNewerThanOther(latestVersion,PLUGIN_VERSION)) {
      new Notice(
        `A newer version of Excalidraw is available in Community Plugins.\n\nYou are using ${PLUGIN_VERSION}.\nThe latest is ${latestVersion}`,
      );
    }
  } catch (e) {
    errorlog({ where: "Utils/checkExcalidrawVersion", error: e });
  }
  setTimeout(() => (versionUpdateChecked = false), 28800000); //reset after 8 hours
};


const random = new Random(Date.now());
export const randomInteger = () => Math.floor(random.next() * 2 ** 31);

//https://macromates.com/blog/2006/wrapping-text-with-regular-expressions/
export function wrapTextAtCharLength(
  text: string,
  lineLen: number,
  forceWrap: boolean = false,
  tolerance: number = 0,
): string {
  if (!lineLen) {
    return text;
  }
  let outstring = "";
  if (forceWrap) {
    for (const t of text.split("\n")) {
      const v = t.match(new RegExp(`(.){1,${lineLen}}`, "g"));
      outstring += v ? `${v.join("\n")}\n` : "\n";
    }
    return outstring.replace(/\n$/, "");
  }

  //  1                2            3                               4
  const reg = new RegExp(
    `(.{1,${lineLen}})(\\s+|$\\n?)|([^\\s]{1,${
      lineLen + tolerance
    }})(\\s+|$\\n?)?`,
    //`(.{1,${lineLen}})(\\s+|$\\n?)|([^\\s]+)(\\s+|$\\n?)`,
    "gm",
  );
  const res = text.matchAll(reg);
  let parts;
  while (!(parts = res.next()).done) {
    outstring += parts.value[1]
      ? parts.value[1].trimEnd()
      : parts.value[3].trimEnd();
    const newLine =
      (parts.value[2] ? parts.value[2].split("\n").length - 1 : 0) +
      (parts.value[4] ? parts.value[4].split("\n").length - 1 : 0);
    outstring += "\n".repeat(newLine);
    if (newLine === 0) {
      outstring += "\n";
    }
  }
  return outstring.replace(/\n$/, "");
}

const rotate = (
  pointX: number,
  pointY: number,
  centerX: number,
  centerY: number,
  angle: number,
): [number, number] =>
  // 𝑎′𝑥=(𝑎𝑥−𝑐𝑥)cos𝜃−(𝑎𝑦−𝑐𝑦)sin𝜃+𝑐𝑥
  // 𝑎′𝑦=(𝑎𝑥−𝑐𝑥)sin𝜃+(𝑎𝑦−𝑐𝑦)cos𝜃+𝑐𝑦.
  // https://math.stackexchange.com/questions/2204520/how-do-i-rotate-a-line-segment-in-a-specific-point-on-the-line
  [
    (pointX - centerX) * Math.cos(angle) -
      (pointY - centerY) * Math.sin(angle) +
      centerX,
    (pointX - centerX) * Math.sin(angle) +
      (pointY - centerY) * Math.cos(angle) +
      centerY,
  ];

export const rotatedDimensions = (
  element: ExcalidrawElement,
): [number, number, number, number] => {
  if (element.angle === 0) {
    return [element.x, element.y, element.width, element.height];
  }
  const centerX = element.x + element.width / 2;
  const centerY = element.y + element.height / 2;
  const [left, top] = rotate(
    element.x,
    element.y,
    centerX,
    centerY,
    element.angle,
  );
  const [right, bottom] = rotate(
    element.x + element.width,
    element.y + element.height,
    centerX,
    centerY,
    element.angle,
  );
  return [
    left < right ? left : right,
    top < bottom ? top : bottom,
    Math.abs(left - right),
    Math.abs(top - bottom),
  ];
};

export const getDataURL = async (
  file: ArrayBuffer,
  mimeType: string,
): Promise<DataURL> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataURL = reader.result as DataURL;
      resolve(dataURL);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(new Blob([new Uint8Array(file)], { type: mimeType }));
  });
};

export const getFontDataURL = async (
  app: App,
  fontFileName: string,
  sourcePath: string,
  name?: string,
): Promise<{ fontDef: string; fontName: string; dataURL: string }> => {
  let fontDef: string = "";
  let fontName = "";
  let dataURL = "";
  const f = app.metadataCache.getFirstLinkpathDest(fontFileName, sourcePath);
  if (f) {
    const ab = await app.vault.readBinary(f);
    const mimeType = f.extension.startsWith("woff")
      ? "application/font-woff"
      : "font/truetype";
    fontName = name ?? f.basename;
    dataURL = await getDataURL(ab, mimeType);
    fontDef = ` @font-face {font-family: "${fontName}";src: url("${dataURL}")}`;
     //format("${f.extension === "ttf" ? "truetype" : f.extension}");}`;
    const split = fontDef.split(";base64,", 2);
    fontDef = `${split[0]};charset=utf-8;base64,${split[1]}`;
  }
  return { fontDef, fontName, dataURL };
};

export const base64StringToBlob = (base64String: string, mimeType: string): Blob => {
  const buffer = Buffer.from(base64String, 'base64');
  return new Blob([buffer], { type: mimeType });
};

export const svgToBase64 = (svg: string): string => {
  return `data:image/svg+xml;base64,${btoa(
    unescape(encodeURIComponent(svg.replaceAll("&nbsp;", " "))),
  )}`;
};

export const getBinaryFileFromDataURL = async (dataURL: string): Promise<ArrayBuffer> => {
  if (!dataURL) {
    return null;
  }
  if(dataURL.match(/^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i)) {
    const hyperlink  = dataURL;
    const extension = getURLImageExtension(hyperlink)
    const mimeType = getMimeType(extension);
    dataURL = await getDataURLFromURL(hyperlink, mimeType)
  }
  const parts = dataURL.matchAll(/base64,(.*)/g).next();
  if (!parts.value) {
    return null;
  }
  const binary_string = window.atob(parts.value[1]);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
};

export const getSVG = async (
  scene: any,
  exportSettings: ExportSettings,
  padding: number,
): Promise<SVGSVGElement> => {
  let elements:ExcalidrawElement[] = scene.elements;
  if(elements.some(el => el.type === "embeddable")) {
    elements = JSON.parse(JSON.stringify(elements));
    elements.filter(el => el.type === "embeddable").forEach((el:any) => {
      el.link = generateEmbeddableLink(el.link, scene.appState?.theme ?? "light");
    });
  }

  try {
    return await exportToSvg({
      elements,
      appState: {
        exportBackground: exportSettings.withBackground,
        exportWithDarkMode: exportSettings.withTheme
          ? scene.appState?.theme != "light"
          : false,
        ...scene.appState,
      },
      files: scene.files,
      exportPadding: padding,
    });
  } catch (error) {
    return null;
  }
};

export function filterFiles(files: Record<ExcalidrawElement["id"], BinaryFileData>): Record<ExcalidrawElement["id"], BinaryFileData> {
  let filteredFiles: Record<ExcalidrawElement["id"], BinaryFileData> = {};

  Object.entries(files).forEach(([key, value]) => {
    if (!value.dataURL.startsWith("http")) {
      filteredFiles[key] = value;
    }
  });

  return filteredFiles;
}

export const getPNG = async (
  scene: any,
  exportSettings: ExportSettings,
  padding: number,
  scale: number = 1,
) => {
  try {
    return await exportToBlob({
      elements: scene.elements,
      appState: {
        exportBackground: exportSettings.withBackground,
        exportWithDarkMode: exportSettings.withTheme
          ? scene.appState?.theme != "light"
          : false,
        ...scene.appState,
      },
      files: filterFiles(scene.files),
      exportPadding: padding,
      mimeType: "image/png",
      getDimensions: (width: number, height: number) => ({
        width: width * scale,
        height: height * scale,
        scale,
      }),
    });
  } catch (error) {
    errorlog({ where: "Utils.getPNG", error });
    return null;
  }
};

export const getQuickImagePreview = async (
  plugin: ExcalidrawPlugin,
  path: string,
  extension: "png" | "svg",
): Promise<any> => {
  if (!plugin.settings.displayExportedImageIfAvailable) {
    return null;
  }
  const imagePath = getIMGFilename(path, extension);
  const file = plugin.app.vault.getAbstractFileByPath(imagePath);
  if (!file || !(file instanceof TFile)) {
    return null;
  }
  switch (extension) {
    case "png":
      return await plugin.app.vault.readBinary(file);
    default:
      return await plugin.app.vault.read(file);
  }
};

export const embedFontsInSVG = (
  svg: SVGSVGElement,
  plugin: ExcalidrawPlugin,
  localOnly: boolean = false,
): SVGSVGElement => {
  //replace font references with base64 fonts)
  const includesVirgil = !localOnly &&
    svg.querySelector("text[font-family^='Virgil']") != null;
  const includesCascadia = !localOnly &&
    svg.querySelector("text[font-family^='Cascadia']") != null;
  const includesLocalFont =
    svg.querySelector("text[font-family^='LocalFont']") != null;
  const defs = svg.querySelector("defs");
  if (defs && (includesCascadia || includesVirgil || includesLocalFont)) {
    defs.innerHTML = `<style>${includesVirgil ? VIRGIL_FONT : ""}${
      includesCascadia ? CASCADIA_FONT : ""
    }${includesLocalFont ? plugin.fourthFontDef : ""}</style>`;
  }
  return svg;
};

export const getImageSize = async (
  src: string,
): Promise<{ height: number; width: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      //console.log({ height: img.naturalHeight, width: img.naturalWidth, img});
      resolve({ height: img.naturalHeight, width: img.naturalWidth });
    };
    img.onerror = reject;
    img.src = src;
  });
};

export const addAppendUpdateCustomData = (el: Mutable<ExcalidrawElement>, newData: any): ExcalidrawElement => {
  if(!newData) return el;
  if(!el.customData) el.customData = {};
  for (const key in newData) {
    if(typeof newData[key] === "undefined") continue;
    el.customData[key] = newData[key];
  }
  return el;
};

export const scaleLoadedImage = (
  scene: any,
  files: any,
): { dirty: boolean; scene: any } => {
  let dirty = false;
  if (!files || !scene) {
    return { dirty, scene };
  }
  for (const f of files) {
    const [w_image, h_image] = [f.size.width, f.size.height];
    const imageAspectRatio = f.size.width / f.size.height;
    scene.elements
      .filter((e: any) => e.type === "image" && e.fileId === f.id)
      .forEach((el: any) => {
        const [w_old, h_old] = [el.width, el.height];
        if(el.customData?.isAnchored && f.shouldScale || !el.customData?.isAnchored && !f.shouldScale) {
          addAppendUpdateCustomData(el, f.shouldScale ? {isAnchored: false} : {isAnchored: true});
          dirty = true;
        }
        if(f.shouldScale) {
          const elementAspectRatio = w_old / h_old;
          if (imageAspectRatio != elementAspectRatio) {
            dirty = true;
            const h_new = Math.sqrt((w_old * h_old * h_image) / w_image);
            const w_new = Math.sqrt((w_old * h_old * w_image) / h_image);
            el.height = h_new;
            el.width = w_new;
            el.y += (h_old - h_new) / 2;
            el.x += (w_old - w_new) / 2;
          }
        } else {
          if(w_old !== w_image || h_old !== h_image) {
            dirty = true;
            el.height = h_image;
            el.width = w_image;
            el.y += (h_old - h_image) / 2;
            el.x += (w_old - w_image) / 2;         
          }
        }
      });
  }
  return { dirty, scene };
};

export const setDocLeftHandedMode = (isLeftHanded: boolean, ownerDocument:Document) => {
  const newStylesheet = ownerDocument.createElement("style");
  newStylesheet.id = "excalidraw-left-handed";
  newStylesheet.textContent = `.excalidraw .App-bottom-bar{justify-content:flex-end;}`;
  const oldStylesheet = ownerDocument.getElementById(newStylesheet.id);
  if (oldStylesheet) {
    ownerDocument.head.removeChild(oldStylesheet);
  }
  if (isLeftHanded) {
    ownerDocument.head.appendChild(newStylesheet);
  }
}

export const setLeftHandedMode = (isLeftHanded: boolean) => {
  const visitedDocs = new Set<Document>();
  app.workspace.iterateAllLeaves((leaf) => {
    const ownerDocument = app.isMobile?document:leaf.view.containerEl.ownerDocument;
    if(!ownerDocument) return;
    if(visitedDocs.has(ownerDocument)) return;
    visitedDocs.add(ownerDocument);
    setDocLeftHandedMode(isLeftHanded,ownerDocument);
  })  
};

export type LinkParts = {
  original: string;
  path: string;
  isBlockRef: boolean;
  ref: string;
  width: number;
  height: number;
  page: number;
};

export const getLinkParts = (fname: string, file?: TFile): LinkParts => {
  //            1           2    3           4      5
  const REG = /(^[^#\|]*)#?(\^)?([^\|]*)?\|?(\d*)x?(\d*)/;
  const parts = fname.match(REG);
  const isBlockRef = parts[2] === "^";
  return {
    original: fname,
    path: file && (parts[1] === "") ? file.path : parts[1],
    isBlockRef,
    ref: parts[3]?.match(/^page=\d*$/i)
      ? parts[3]
      : isBlockRef ? cleanBlockRef(parts[3]) : cleanSectionHeading(parts[3]),
    width: parts[4] ? parseInt(parts[4]) : undefined,
    height: parts[5] ? parseInt(parts[5]) : undefined,
    page: parseInt(parts[3]?.match(/page=(\d*)/)?.[1])
  };
};

export const compress = (data: string): string => {
  return compressToBase64(data).replace(/(.{64})/g, "$1\n\n");
};

export const decompress = (data: string): string => {
  return decompressFromBase64(data.replaceAll("\n", "").replaceAll("\r", ""));
};

export const hasExportTheme = (
  plugin: ExcalidrawPlugin,
  file: TFile,
): boolean => {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEY_EXPORT_DARK] != null
    ) {
      return true;
    }
  }
  return false;
};

export const getExportTheme = (
  plugin: ExcalidrawPlugin,
  file: TFile,
  theme: string,
): string => {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEY_EXPORT_DARK] != null
    ) {
      return fileCache.frontmatter[FRONTMATTER_KEY_EXPORT_DARK]
        ? "dark"
        : "light";
    }
  }
  return plugin.settings.exportWithTheme ? theme : "light";
};

export const hasExportBackground = (
  plugin: ExcalidrawPlugin,
  file: TFile,
): boolean => {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEY_EXPORT_TRANSPARENT] != null
    ) {
      return true;
    }
  }
  return false;
};

export const getWithBackground = (
  plugin: ExcalidrawPlugin,
  file: TFile,
): boolean => {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEY_EXPORT_TRANSPARENT] != null
    ) {
      return !fileCache.frontmatter[FRONTMATTER_KEY_EXPORT_TRANSPARENT];
    }
  }
  return plugin.settings.exportWithBackground;
};

export const getExportPadding = (
  plugin: ExcalidrawPlugin,
  file: TFile,
): number => {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if(!fileCache?.frontmatter) return plugin.settings.exportPaddingSVG;

    if (fileCache.frontmatter[FRONTMATTER_KEY_EXPORT_PADDING] != null) {
      const val = parseInt(
        fileCache.frontmatter[FRONTMATTER_KEY_EXPORT_PADDING],
      );
      if (!isNaN(val)) {
        return val;
      }
    }

    //depricated. Retained for backward compatibility
    if (fileCache.frontmatter[FRONTMATTER_KEY_EXPORT_SVGPADDING] != null) {
      const val = parseInt(
        fileCache.frontmatter[FRONTMATTER_KEY_EXPORT_SVGPADDING],
      );
      if (!isNaN(val)) {
        return val;
      }
    }
    
  }
  return plugin.settings.exportPaddingSVG;
};

export const getFileCSSClasses = (
  plugin: ExcalidrawPlugin,
  file: TFile,
): string[] => {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if(!fileCache?.frontmatter) return [];
    const x = parseFrontMatterEntry(fileCache.frontmatter, "cssclasses");
    if (Array.isArray(x)) return x
    if (typeof x === "string") return Array.from(new Set(x.split(/[, ]+/).filter(Boolean)));
    return [];
  }
  return [];
}

export const getPNGScale = (plugin: ExcalidrawPlugin, file: TFile): number => {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEY_EXPORT_PNGSCALE] != null
    ) {
      const val = parseFloat(
        fileCache.frontmatter[FRONTMATTER_KEY_EXPORT_PNGSCALE],
      );
      if (!isNaN(val) && val > 0) {
        return val;
      }
    }
  }
  return plugin.settings.pngExportScale;
};

export const isVersionNewerThanOther = (version: string, otherVersion: string): boolean => {
  const v = version.match(/(\d*)\.(\d*)\.(\d*)/);
  const o = otherVersion.match(/(\d*)\.(\d*)\.(\d*)/);
  
  return Boolean(v && v.length === 4 && o && o.length === 4 &&
    !(isNaN(parseInt(v[1])) || isNaN(parseInt(v[2])) || isNaN(parseInt(v[3]))) &&
    !(isNaN(parseInt(o[1])) || isNaN(parseInt(o[2])) || isNaN(parseInt(o[3]))) && 
    (
      parseInt(v[1])>parseInt(o[1]) ||
      (parseInt(v[1]) >= parseInt(o[1]) && parseInt(v[2]) > parseInt(o[2])) ||
      (parseInt(v[1]) >= parseInt(o[1]) && parseInt(v[2]) >= parseInt(o[2]) && parseInt(v[3]) > parseInt(o[3]))
    )
  ) 
}

export const getEmbeddedFilenameParts = (fname:string): FILENAMEPARTS => {
  //                        0 1        23    4                               5         6  7                             8          9
  const parts = fname?.match(/([^#\^]*)((#\^)(group=|area=|frame=|taskbone)?([^\|]*)|(#)(group=|area=|frame=|taskbone)?([^\^\|]*))(.*)/);
  if(!parts) {
    return {
      filepath: fname,
      hasBlockref: false,
      hasGroupref: false,
      hasTaskbone: false,
      hasArearef: false,
      hasFrameref: false,
      blockref: "",
      hasSectionref: false,
      sectionref: "",
      linkpartReference: "",
      linkpartAlias: ""
    }
  }
  return {
    filepath: parts[1],
    hasBlockref: Boolean(parts[3]),
    hasGroupref: (parts[4]==="group=") || (parts[7]==="group="),
    hasTaskbone: (parts[4]==="taskbone") || (parts[7]==="taskbone"),
    hasArearef: (parts[4]==="area=") || (parts[7]==="area="),
    hasFrameref: (parts[4]==="frame=") || (parts[7]==="frame="),
    blockref: parts[5],
    hasSectionref: Boolean(parts[6]),
    sectionref: parts[8],
    linkpartReference: parts[2],
    linkpartAlias: parts[9]
  }
}

export const fragWithHTML = (html: string) =>
  createFragment((frag) => (frag.createDiv().innerHTML = html));

export const errorlog = (data: {}) => {
  console.error({ plugin: "Excalidraw", ...data });
};

export const sleep = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**REACT 18 
  //see also: https://github.com/zsviczian/obsidian-excalidraw-plugin/commit/b67d70c5196f30e2968f9da919d106ee66f2a5eb
  //https://github.com/zsviczian/obsidian-excalidraw-plugin/commit/cc9d7828c7ee7755c1ef942519c43df32eae249f
export const awaitNextAnimationFrame = async () => new Promise(requestAnimationFrame);
*/

export const log = console.log.bind(window.console);
export const debug = console.log.bind(window.console);
//export const debug = function(){};


export const getContainerElement = (
  element:
    | (ExcalidrawElement & { containerId: ExcalidrawElement["id"] | null })
    | null,
  scene: ExcalidrawScene,
) => {
  if (!element) {
    return null;
  }
  if (element.containerId) {
    return scene.elements.filter(el=>el.id === element.containerId)[0] ?? null;
  }
  return null;
};

export const updateFrontmatterInString = (data:string, keyValuePairs: [string,string][]):string => {
  if(!data) return data;
  for(const kvp of keyValuePairs) {
    const r = new RegExp(`${kvp[0]}:\\s.*\\n`,"g");
    data = data.match(r) 
      ? data.replaceAll(r,`${kvp[0]}: ${kvp[1]}\n`)
      : data.replace(/^---\n/,`---\n${kvp[0]}: ${kvp[1]}\n`);
  }
  return data;
}

const isHyperLink = (link:string) => link && !link.includes("\n") && !link.includes("\r") && link.match(/^https?:(\d*)?\/\/[^\s]*$/);

export const isContainer = (el: ExcalidrawElement) => el.type!=="arrow" && el.boundElements?.map((e) => e.type).includes("text");

export const hyperlinkIsImage = (data: string):boolean => {
  if(!isHyperLink(data)) false;
  const corelink = data.split("?")[0];
  return IMAGE_TYPES.contains(corelink.substring(corelink.lastIndexOf(".")+1));
}

export const hyperlinkIsYouTubeLink = (link:string): boolean => 
  isHyperLink(link) &&
  (link.startsWith("https://youtu.be") || link.startsWith("https://www.youtube.com") || link.startsWith("https://youtube.com") || link.startsWith("https//www.youtu.be")) &&
  link.match(/(youtu.be\/|v=)([^?\/\&]*)/)!==null

export const getYouTubeThumbnailLink = async (youtubelink: string):Promise<string> => {
  //https://stackoverflow.com/questions/2068344/how-do-i-get-a-youtube-video-thumbnail-from-the-youtube-api
  //https://youtu.be/z8UkHGpykYU?t=60
  //https://www.youtube.com/watch?v=z8UkHGpykYU&ab_channel=VerbaltoVisual
  const parsed = youtubelink.match(/(youtu.be\/|v=)([^?\/\&]*)/);
  if(!parsed || !parsed[2]) return null;
  const videoId = parsed[2];
  
  let url = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  let response = await requestUrl({url, method: "get", contentType: "image/jpeg", throw: false });
  if(response && response.status === 200) return url;

  url = `https://i.ytimg.com/vi/${videoId}/hq720.jpg`;
  response = await requestUrl({url, method: "get", contentType: "image/jpeg", throw: false });
  if(response && response.status === 200) return url;

  url = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
  response = await requestUrl({url, method: "get", contentType: "image/jpeg", throw: false });
  if(response && response.status === 200) return url;


  return `https://i.ytimg.com/vi/${videoId}/default.jpg`;
}

export const isCallerFromTemplaterPlugin = (stackTrace:string) => {
  const lines = stackTrace.split("\n");
  for (const line of lines) {
    if (line.trim().startsWith("at Templater.")) {
      return true;
    }
  }
  return false;
}

export const convertSVGStringToElement = (svg: string): SVGSVGElement => {
  const divElement = document.createElement("div");
  divElement.innerHTML = svg;
  const firstChild = divElement.firstChild;
  if (firstChild instanceof SVGSVGElement) {
    return firstChild;
  }
  return;
}

export const escapeRegExp = (str:string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
