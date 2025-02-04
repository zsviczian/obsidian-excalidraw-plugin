import {
  App,
  Notice,
  request,requestUrl,
  TFile,
  TFolder,
} from "obsidian";
import { Random } from "roughjs/bin/math";
import { BinaryFileData, DataURL} from "@zsviczian/excalidraw/types/excalidraw/types";
import {
  exportToSvg,
  exportToBlob,
  IMAGE_TYPES,
  FRONTMATTER_KEYS,
  EXCALIDRAW_PLUGIN,
  getCommonBoundingBox,
  DEVICE,
  getContainerElement,
} from "../constants/constants";
import ExcalidrawPlugin from "../core/main";
import { ExcalidrawElement, ExcalidrawImageElement, ExcalidrawTextElement, ImageCrop } from "@zsviczian/excalidraw/types/excalidraw/element/types";
import { ExportSettings } from "../view/ExcalidrawView";
import { getDataURLFromURL, getIMGFilename, getMimeType, getURLImageExtension } from "./fileUtils";
import { generateEmbeddableLink } from "./customEmbeddableUtils";
import { FILENAMEPARTS } from "../types/utilTypes";
import { Mutable } from "@zsviczian/excalidraw/types/excalidraw/utility-types";
import { cleanBlockRef, cleanSectionHeading, getFileCSSClasses } from "./obsidianUtils";
import { updateElementLinksToObsidianLinks } from "./excalidrawAutomateUtils";
import { CropImage } from "../shared/CropImage";
import opentype from 'opentype.js';
import { runCompressionWorker } from "src/shared/Workers/compression-worker";
import Pool from "es6-promise-pool";
import { FileData } from "../shared/EmbeddedFileLoader";
import { t } from "src/lang/helpers";
import ExcalidrawScene from "src/shared/svgToExcalidraw/elements/ExcalidrawScene";

declare const PLUGIN_VERSION:string;
declare var LZString: any;

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

export let versionUpdateCheckTimer: number = null;
let versionUpdateChecked = false;
export async function checkExcalidrawVersion() {
  if (versionUpdateChecked) {
    return;
  }
  versionUpdateChecked = true;

  try {
    const gitAPIrequest = async () => {
      return JSON.parse(
        await request({
          url: `https://api.github.com/repos/zsviczian/obsidian-excalidraw-plugin/releases?per_page=15&page=1`,
        }),
      );
    };

    const latestVersion = (await gitAPIrequest())
      .filter((el: any) => !el.draft && !el.prerelease)
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
        t("UPDATE_AVAILABLE") + ` ${latestVersion}`,
      );
    }
  } catch (e) {
    errorlog({ where: "Utils/checkExcalidrawVersion", error: e });
  }
  versionUpdateCheckTimer = window.setTimeout(() => {
    versionUpdateChecked = false;
    versionUpdateCheckTimer = null;
  }, 28800000); //reset after 8 hours
};


const random = new Random(Date.now());
export function randomInteger () {
  return Math.floor(random.next() * 2 ** 31)
};

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

export function rotatedDimensions (
  element: ExcalidrawElement,
): [number, number, number, number] {
  const bb = getCommonBoundingBox([element]);
  return [bb.minX, bb.minY, bb.maxX - bb.minX, bb.maxY - bb.minY];
};

export async function getDataURL(
  file: ArrayBuffer,
  mimeType: string,
): Promise<DataURL> {
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

export async function getFontDataURL (
  app: App,
  fontFileName: string,
  sourcePath: string,
  name?: string,
): Promise<{ fontDef: string; fontName: string; dataURL: string }> {
  let fontDef: string = "";
  let fontName = "";
  let dataURL = "";
  const f = app.metadataCache.getFirstLinkpathDest(fontFileName, sourcePath);
  if (f) {
    const ab = await app.vault.readBinary(f);
    let mimeType = "";
    let format = "";
    
    switch (f.extension) {
      case "woff":
        mimeType = "application/font-woff";
        format = "woff";
        break;
      case "woff2":
        mimeType = "font/woff2";
        format = "woff2";
        break;
      case "ttf":
        mimeType = "font/ttf";
        format = "truetype";
        break;
      case "otf":
        mimeType = "font/otf";
        format = "opentype";
        break;
      default:
        mimeType = "application/octet-stream"; // Fallback if file type is unexpected
    }
    fontName = name ?? f.basename;
    dataURL = await getDataURL(ab, mimeType);
    const split = dataURL.split(";base64,", 2);
    dataURL = `${split[0]};charset=utf-8;base64,${split[1]}`;
    fontDef = ` @font-face {font-family: "${fontName}";src: url("${dataURL}") format("${format}")}`;
  }
  return { fontDef, fontName, dataURL };
};

export function base64StringToBlob (base64String: string, mimeType: string): Blob {
  const buffer = Buffer.from(base64String, 'base64');
  return new Blob([buffer], { type: mimeType });
};

export function svgToBase64(svg: string): string {
  const cleanSvg = svg.replaceAll("&nbsp;", " ");
  
  // Convert the string to UTF-8 and handle non-Latin1 characters
  const encodedData = encodeURIComponent(cleanSvg)
    .replace(/%([0-9A-F]{2})/g,
      (match, p1) => String.fromCharCode(parseInt(p1, 16))
    );
    
  return `data:image/svg+xml;base64,${btoa(encodedData)}`;
}

export async function getBinaryFileFromDataURL (dataURL: string): Promise<ArrayBuffer> {
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

export async function getSVG (
  scene: any,
  exportSettings: ExportSettings,
  padding: number,
  srcFile: TFile|null, //if set, will replace markdown links with obsidian links
): Promise<SVGSVGElement> {
  let elements:ExcalidrawElement[] = scene.elements;
  if(elements.some(el => el.type === "embeddable")) {
    elements = JSON.parse(JSON.stringify(elements));
    elements.filter(el => el.type === "embeddable").forEach((el:any) => {
      el.link = generateEmbeddableLink(el.link, scene.appState?.theme ?? "light");
    });
  }

  elements = srcFile
    ? updateElementLinksToObsidianLinks({
        elements,
        hostFile: srcFile,
    })
    : elements;

  try {
    let svg: SVGSVGElement;
    if(exportSettings.isMask) {
      const cropObject = new CropImage(elements, scene.files);
      svg = await cropObject.getCroppedSVG();
      cropObject.destroy();
    } else {
      svg = await exportToSvg({
        elements: elements.filter((el:ExcalidrawElement)=>el.isDeleted !== true),
        appState: {
          ...scene.appState,
          exportBackground: exportSettings.withBackground,
          exportWithDarkMode: exportSettings.withTheme
            ? scene.appState?.theme !== "light"
            : false,
          ...exportSettings.frameRendering
          ? {frameRendering: exportSettings.frameRendering}
          : {},
        },
        files: scene.files,
        exportPadding: exportSettings.frameRendering?.enabled ? 0 : padding,
        exportingFrame: null,
        renderEmbeddables: true,
        skipInliningFonts: exportSettings.skipInliningFonts,
      });
    }
    if(svg) {
      svg.addClass("excalidraw-svg");
      if(srcFile instanceof TFile) {
        const cssClasses = getFileCSSClasses(srcFile);
        cssClasses.forEach((cssClass) => svg.addClass(cssClass));      
      }
    }
    return svg;
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

export async function getPNG (
  scene: any,
  exportSettings: ExportSettings,
  padding: number,
  scale: number = 1,
): Promise<Blob> {
  try {
    if(exportSettings.isMask) {
      const cropObject = new CropImage(scene.elements, scene.files);
      const blob = await cropObject.getCroppedPNG();
      cropObject.destroy();
      return blob;
    }

    return await exportToBlob({
      elements: scene.elements.filter((el:ExcalidrawElement)=>el.isDeleted !== true),
      appState: {
        ...scene.appState,
        exportBackground: exportSettings.withBackground,
        exportWithDarkMode: exportSettings.withTheme
          ? scene.appState?.theme !== "light"
          : false,
        ...exportSettings.frameRendering
        ? {frameRendering: exportSettings.frameRendering}
        : {},
      },
      files: filterFiles(scene.files),
      exportPadding: exportSettings.frameRendering?.enabled ? 0 : padding,
      mimeType: "image/png",
      getDimensions: (width: number, height: number) => ({
        width: width * scale,
        height: height * scale,
        scale,
      }),
    });
  } catch (error) {
    new Notice(t("ERROR_PNG_TOO_LARGE"));
    errorlog({ where: "Utils.getPNG", error });
    return null;
  }
};

export async function getQuickImagePreview (
  plugin: ExcalidrawPlugin,
  path: string,
  extension: "png" | "svg",
): Promise<any> {
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


export async function getImageSize (
  src: string,
): Promise<{ height: number; width: number }> {
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

export function addAppendUpdateCustomData (
  el: Mutable<ExcalidrawElement>,
  newData: Partial<Record<string, unknown>>
): ExcalidrawElement {
  if(!newData) return el;
  if(!el.customData) el.customData = {};
  for (const key in newData) {
    if(typeof newData[key] === "undefined") {
      delete el.customData[key];
      continue;
    }
    el.customData[key] = newData[key];
  }
  return el;
};

export function scaleLoadedImage (
  scene: any,
  files: FileData[],
): { dirty: boolean; scene: any } {
  let dirty = false;
  if (!files || !scene) {
    return { dirty, scene };
  }

  for (const img of files.filter((f:any)=>{
    if(!Boolean(EXCALIDRAW_PLUGIN)) return true; //this should never happen
    const ef = EXCALIDRAW_PLUGIN.filesMaster.get(f.id);
    if(!ef) return true; //mermaid SVG or equation
    const file = EXCALIDRAW_PLUGIN.app.vault.getAbstractFileByPath(ef.path.replace(/#.*$/,"").replace(/\|.*$/,""));
    if(!file || (file instanceof TFolder)) return false;
    return (file as TFile).extension==="md" || EXCALIDRAW_PLUGIN.isExcalidrawFile(file as TFile)
  })) {
    const [imgWidth, imgHeight] = [img.size.width, img.size.height];
    const imgAspectRatio = imgWidth / imgHeight;

    scene.elements
      .filter((e: any) => e.type === "image" && e.fileId === img.id)
      .forEach((el: Mutable<ExcalidrawImageElement>) => {
        const [elWidth, elHeight] = [el.width, el.height];
        const maintainArea = img.shouldScale; //true if image should maintain its area, false if image should display at 100% its size
        const elCrop: ImageCrop = el.crop;
        const isCropped = Boolean(elCrop);

  
        if(el.customData?.isAnchored && img.shouldScale || !el.customData?.isAnchored && !img.shouldScale) {
          //customData.isAnchored is used by the Excalidraw component to disable resizing of anchored images
          //customData.isAnchored has no direct role in the calculation in the scaleLoadedImage function
          addAppendUpdateCustomData(el, img.shouldScale ? {isAnchored: false} : {isAnchored: true});
          dirty = true;
        }

        if(isCropped) {
          if(elCrop.naturalWidth !== imgWidth || elCrop.naturalHeight !== imgHeight) {
            dirty = true;
            //the current crop area may be maintained, need to calculate the new crop.x, crop.y offsets            
            el.crop.y += (imgHeight - elCrop.naturalHeight)/2;
            if(imgWidth < elCrop.width) {
              const scaleX = el.width / elCrop.width;
              el.crop.x = 0;
              el.crop.width = imgWidth;
              el.width = imgWidth * scaleX;
            } else {
              const ratioX = elCrop.x / (elCrop.naturalWidth - elCrop.x - elCrop.width);
              const gapX = imgWidth - elCrop.width;
              el.crop.x = ratioX * gapX / (1 + ratioX);
              if(el.crop.x + elCrop.width > imgWidth) {
                el.crop.x = (imgWidth - elCrop.width) / 2;
              }
            }
            if(imgHeight < elCrop.height) {
              const scaleY = el.height / elCrop.height;
              el.crop.y = 0;
              el.crop.height = imgHeight;
              el.height = imgHeight * scaleY;
            } else {
              const ratioY = elCrop.y / (elCrop.naturalHeight - elCrop.y - elCrop.height);
              const gapY = imgHeight - elCrop.height;
              el.crop.y = ratioY * gapY / (1 + ratioY);
              if(el.crop.y + elCrop.height > imgHeight) {
                el.crop.y = (imgHeight - elCrop.height)/2;
              }
            }
            el.crop.naturalWidth = imgWidth;
            el.crop.naturalHeight = imgHeight;
            const noCrop = el.crop.width === imgWidth && el.crop.height === imgHeight;
            if(noCrop) {
              el.crop = null;
            }
          }
        } else if(maintainArea) {
          const elAspectRatio = elWidth / elHeight;
          if (imgAspectRatio !== elAspectRatio) {
            dirty = true;
            const elNewHeight = Math.sqrt((elWidth * elHeight * imgHeight) / imgWidth);
            const elNewWidth = Math.sqrt((elWidth * elHeight * imgWidth) / imgHeight);
            el.height = elNewHeight;
            el.width = elNewWidth;
            el.y += (elHeight - elNewHeight) / 2;
            el.x += (elWidth - elNewWidth) / 2;
          } 
        } else { //100% size
          if(elWidth !== imgWidth || elHeight !== imgHeight) {
            dirty = true;
            el.height = imgHeight;
            el.width = imgWidth;
            el.y += (elHeight - imgHeight) / 2;
            el.x += (elWidth - imgWidth) / 2;         
          }
        }
      });
  }
  return { dirty, scene };
};

export function setDocLeftHandedMode(isLeftHanded: boolean, ownerDocument:Document) {
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

export function setLeftHandedMode (isLeftHanded: boolean) {
  const visitedDocs = new Set<Document>();
  EXCALIDRAW_PLUGIN.app.workspace.iterateAllLeaves((leaf) => {
    const ownerDocument = DEVICE.isMobile?document:leaf.view.containerEl.ownerDocument;
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

export function getLinkParts (fname: string, file?: TFile): LinkParts {
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

export async function compressAsync (data: string): Promise<string> {
  return await runCompressionWorker(data, "compress");
} 

export function compress (data: string): string {
  const compressed = LZString.compressToBase64(data);
  let result = '';
  const chunkSize = 256;
  for (let i = 0; i < compressed.length; i += chunkSize) {
    result += compressed.slice(i, i + chunkSize) + '\n\n';
  }

  return result.trim();
};

export async function decompressAsync (data: string): Promise<string> {
  return await runCompressionWorker(data, "decompress");
};

export function decompress (data: string, isAsync:boolean = false): string {
  let cleanedData = '';
  const length = data.length;
  
  for (let i = 0; i < length; i++) {
      const char = data[i];
      if (char !== '\n' && char !== '\r') {
          cleanedData += char;
      }
  }

  return LZString.decompressFromBase64(cleanedData);
};

export function isMaskFile (
  plugin: ExcalidrawPlugin,
  file: TFile,
): boolean {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEYS["mask"].name] !== null &&
      (typeof fileCache.frontmatter[FRONTMATTER_KEYS["mask"].name] !== "undefined")
    ) {
      return Boolean(fileCache.frontmatter[FRONTMATTER_KEYS["mask"].name]);
    }
  }
  return false;
};

export function hasExportTheme (
  plugin: ExcalidrawPlugin,
  file: TFile,
): boolean {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEYS["export-dark"].name] !== null &&
      (typeof fileCache.frontmatter[FRONTMATTER_KEYS["export-dark"].name] !== "undefined")
    ) {
      return true;
    }
  }
  return false;
};

export function getExportTheme (
  plugin: ExcalidrawPlugin,
  file: TFile,
  theme: string,
): string {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEYS["export-dark"].name] !== null &&
      (typeof fileCache.frontmatter[FRONTMATTER_KEYS["export-dark"].name] !== "undefined")
    ) {
      return fileCache.frontmatter[FRONTMATTER_KEYS["export-dark"].name]
        ? "dark"
        : "light";
    }
  }
  return plugin.settings.exportWithTheme ? theme : "light";
};

export function shouldEmbedScene (
  plugin: ExcalidrawPlugin,
  file: TFile
): boolean {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEYS["export-embed-scene"].name] !== null &&
      (typeof fileCache.frontmatter[FRONTMATTER_KEYS["export-embed-scene"].name] !== "undefined")
    ) {
      return fileCache.frontmatter[FRONTMATTER_KEYS["export-embed-scene"].name];
    }
  }
  return plugin.settings.exportEmbedScene;
};

export function hasExportBackground (
  plugin: ExcalidrawPlugin,
  file: TFile,
): boolean {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEYS["export-transparent"].name] !== null &&
      (typeof fileCache.frontmatter[FRONTMATTER_KEYS["export-transparent"].name] !== "undefined")
    ) {
      return true;
    }
  }
  return false;
};

export function getWithBackground (
  plugin: ExcalidrawPlugin,
  file: TFile,
): boolean {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEYS["export-transparent"].name] !== null &&
      (typeof fileCache.frontmatter[FRONTMATTER_KEYS["export-transparent"].name] !== "undefined")
    ) {
      return !fileCache.frontmatter[FRONTMATTER_KEYS["export-transparent"].name];
    }
  }
  return plugin.settings.exportWithBackground;
};

export function getExportPadding (
  plugin: ExcalidrawPlugin,
  file: TFile,
): number {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if(!fileCache?.frontmatter) return plugin.settings.exportPaddingSVG;

    if (
      fileCache.frontmatter[FRONTMATTER_KEYS["export-padding"].name] !== null &&
      (typeof fileCache.frontmatter[FRONTMATTER_KEYS["export-padding"].name] !== "undefined")
    ) {
      const val = parseInt(
        fileCache.frontmatter[FRONTMATTER_KEYS["export-padding"].name],
      );
      if (!isNaN(val)) {
        return val;
      }
    }

    //deprecated. Retained for backward compatibility
    if (
      fileCache.frontmatter[FRONTMATTER_KEYS["export-svgpadding"].name] !== null &&
      (typeof fileCache.frontmatter[FRONTMATTER_KEYS["export-svgpadding"].name] !== "undefined")
    ) {
      const val = parseInt(
        fileCache.frontmatter[FRONTMATTER_KEYS["export-svgpadding"].name],
      );
      if (!isNaN(val)) {
        return val;
      }
    }
    
  }
  return plugin.settings.exportPaddingSVG;
};

export function getPNGScale (plugin: ExcalidrawPlugin, file: TFile): number {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEYS["export-pngscale"].name] !== null &&
      (typeof fileCache.frontmatter[FRONTMATTER_KEYS["export-pngscale"].name] !== "undefined")
    ) {
      const val = parseFloat(
        fileCache.frontmatter[FRONTMATTER_KEYS["export-pngscale"].name],
      );
      if (!isNaN(val) && val > 0) {
        return val;
      }
    }
  }
  return plugin.settings.pngExportScale;
};

export function isVersionNewerThanOther (version: string, otherVersion: string): boolean {
  if(!version || !otherVersion) return true;

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

export function getEmbeddedFilenameParts (fname:string): FILENAMEPARTS {
  //                        0 1        23    4                               5         6  7                             8          9
  const parts = fname?.match(/([^#\^]*)((#\^)(group=|area=|frame=|clippedframe=|taskbone)?([^\|]*)|(#)(group=|area=|frame=|clippedframe=|taskbone)?([^\^\|]*))(.*)/);
  if(!parts) {
    return {
      filepath: fname,
      hasBlockref: false,
      hasGroupref: false,
      hasTaskbone: false,
      hasArearef: false,
      hasFrameref: false,
      hasClippedFrameref: false,
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
    hasClippedFrameref: (parts[4]==="clippedframe=") || (parts[7]==="clippedframe="),
    blockref: parts[5],
    hasSectionref: Boolean(parts[6]),
    sectionref: parts[8],
    linkpartReference: parts[2],
    linkpartAlias: parts[9]
  }
}

export function isImagePartRef (parts: FILENAMEPARTS): boolean {
  return (parts.hasGroupref || parts.hasArearef || parts.hasFrameref || parts.hasClippedFrameref);
}

export function fragWithHTML (html: string) {
  return createFragment((frag) => (frag.createDiv().innerHTML = html));
}

export function errorlog (data: {}) {
  console.error({ plugin: "Excalidraw", ...data });
};

export async function sleep (ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**REACT 18 
  //see also: https://github.com/zsviczian/obsidian-excalidraw-plugin/commit/b67d70c5196f30e2968f9da919d106ee66f2a5eb
  //https://github.com/zsviczian/obsidian-excalidraw-plugin/commit/cc9d7828c7ee7755c1ef942519c43df32eae249f
export const awaitNextAnimationFrame = async () => new Promise(requestAnimationFrame);
*/

//export const debug = function(){};


export function _getContainerElement (
  element:
    | (ExcalidrawElement & { containerId: ExcalidrawElement["id"] | null })
    | null,
  scene: any,
) {
  if (!element || !scene?.elements || element.type !== "text") {
    return null;
  }
  if (element.containerId) {
    return getContainerElement(element as ExcalidrawTextElement, arrayToMap(scene.elements))
    //return scene.elements.find((el:ExcalidrawElement)=>el.id === element.containerId) ?? null;
  }
  return null;
};

/**
 * Transforms array of objects containing `id` attribute,
 * or array of ids (strings), into a Map, keyd by `id`.
 */
export function arrayToMap <T extends { id: string } | string>(
  items: readonly T[] | Map<string, T>,
) {
  if (items instanceof Map) {
    return items;
  }
  return items.reduce((acc: Map<string, T>, element) => {
    acc.set(typeof element === "string" ? element : element.id, element);
    return acc;
  }, new Map());
};

export function updateFrontmatterInString(data:string, keyValuePairs?: [string,string][]):string {
  if(!data || !keyValuePairs) return data;
  for(const kvp of keyValuePairs) {
    const r = new RegExp(`${kvp[0]}:\\s.*\\n`,"g");
    data = data.match(r) 
      ? data.replaceAll(r,`${kvp[0]}: ${kvp[1]}\n`)
      : data.replace(/^---\n/,`---\n${kvp[0]}: ${kvp[1]}\n`);
  }
  return data;
}

function isHyperLink (link:string) {
  return link && !link.includes("\n") && !link.includes("\r") && link.match(/^https?:(\d*)?\/\/[^\s]*$/);
}

export function isContainer (el: ExcalidrawElement) {
  return el.type!=="arrow" && el.boundElements?.map((e) => e.type).includes("text");
}

export function hyperlinkIsImage (data: string):boolean {
  if(!isHyperLink(data)) false;
  const corelink = data.split("?")[0];
  return IMAGE_TYPES.contains(corelink.substring(corelink.lastIndexOf(".")+1));
}

export function hyperlinkIsYouTubeLink (link:string): boolean { 
  return isHyperLink(link) &&
  (link.startsWith("https://youtu.be") || link.startsWith("https://www.youtube.com") || link.startsWith("https://youtube.com") || link.startsWith("https//www.youtu.be")) &&
  link.match(/(youtu.be\/|v=)([^?\/\&]*)/)!==null
}

export async function getYouTubeThumbnailLink (youtubelink: string):Promise<string> {
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

export function isCallerFromTemplaterPlugin (stackTrace:string) {
  const lines = stackTrace.split("\n");
  for (const line of lines) {
    if (line.trim().startsWith("at Templater.")) {
      return true;
    }
  }
  return false;
}

export function convertSVGStringToElement (svg: string): SVGSVGElement {
  const divElement = document.createElement("div");
  divElement.innerHTML = svg;
  const firstChild = divElement.firstChild;
  if (firstChild instanceof SVGSVGElement) {
    return firstChild;
  }
  return;
}

export function escapeRegExp (str:string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export function addIframe (containerEl: HTMLElement, link:string, startAt?: number, style:string = "settings") {
  const wrapper = containerEl.createDiv({cls: `excalidraw-videoWrapper ${style}`})
  wrapper.createEl("iframe", {
    attr: {
      allowfullscreen: true,
      allow: "encrypted-media;picture-in-picture",
      frameborder: "0",
      title: "YouTube video player",
      src: "https://www.youtube.com/embed/" + link + (startAt ? "?start=" + startAt : ""),
      sandbox: "allow-forms allow-presentation allow-same-origin allow-scripts allow-modals",
    },
  });
}

export interface FontMetrics {
  unitsPerEm: number;
  ascender: number;
  descender: number;
  lineHeight: number;
  fontName: string;
}

export async function getFontMetrics(fontUrl: string, name: string): Promise<FontMetrics | null> {
  try {
    const font = await opentype.load(fontUrl);
    const unitsPerEm = font.unitsPerEm;
    const ascender = font.ascender;
    const descender = font.descender;
    const lineHeight = (ascender - descender) / unitsPerEm;
    const fontName = font.names.fontFamily.en ?? name;

    return {
      unitsPerEm,
      ascender,
      descender,
      lineHeight,
      fontName,
    };
  } catch (error) {
    console.error('Error loading font:', error);
    return null;
  }
}

// Thanks https://stackoverflow.com/a/54555834
export function cropCanvas(
  srcCanvas: HTMLCanvasElement,
  crop: { left: number, top: number, width: number, height: number },
  output: { width: number, height: number } = { width: crop.width, height: crop.height }) 
{
  const dstCanvas = createEl('canvas');
  dstCanvas.width = output.width;
  dstCanvas.height = output.height;
  dstCanvas.getContext('2d')!.drawImage(
      srcCanvas,
      crop.left, crop.top, crop.width, crop.height,
      0, 0, output.width, output.height
  );
  return dstCanvas;
}

// Promise.try, adapted from https://github.com/sindresorhus/p-try
export async function promiseTry <TValue, TArgs extends unknown[]>(
  fn: (...args: TArgs) => PromiseLike<TValue> | TValue,
  ...args: TArgs
): Promise<TValue> {
  return new Promise((resolve) => {
    resolve(fn(...args));
  });
};

// extending the missing types
// relying on the [Index, T] to keep a correct order
type TPromisePool<T, Index = number> = Pool<[Index, T][]> & {
  addEventListener: (
    type: "fulfilled",
    listener: (event: { data: { result: [Index, T] } }) => void,
  ) => (event: { data: { result: [Index, T] } }) => void;
  removeEventListener: (
    type: "fulfilled",
    listener: (event: { data: { result: [Index, T] } }) => void,
  ) => void;
};

export class PromisePool<T> {
  private readonly pool: TPromisePool<T>;
  private readonly entries: Record<number, T> = {};

  constructor(
    source: IterableIterator<Promise<void | readonly [number, T]>>,
    concurrency: number,
  ) {
    this.pool = new Pool(
      source as unknown as () => void | PromiseLike<[number, T][]>,
      concurrency,
    ) as TPromisePool<T>;
  }

  public all() {
    const listener = (event: { data: { result: void | [number, T] } }) => {
      if (event.data.result) {
        // by default pool does not return the results, so we are gathering them manually
        // with the correct call order (represented by the index in the tuple)
        const [index, value] = event.data.result;
        this.entries[index] = value;
      }
    };

    this.pool.addEventListener("fulfilled", listener);

    return this.pool.start().then(() => {
      setTimeout(() => {
        this.pool.removeEventListener("fulfilled", listener);
      });

      return Object.values(this.entries);
    });
  }
}