//import Excalidraw from "@zsviczian/excalidraw";
import {
  App,
  Notice,
  request,
  TFile,
} from "obsidian";
import { Random } from "roughjs/bin/math";
import { DataURL, Zoom } from "@zsviczian/excalidraw/types/types";
import {
  CASCADIA_FONT,
  REG_BLOCK_REF_CLEAN,
  VIRGIL_FONT,
  PLUGIN_ID,
  FRONTMATTER_KEY_EXPORT_DARK,
  FRONTMATTER_KEY_EXPORT_TRANSPARENT,
  FRONTMATTER_KEY_EXPORT_SVGPADDING,
  FRONTMATTER_KEY_EXPORT_PNGSCALE,
} from "../Constants";
import ExcalidrawPlugin from "../main";
import { ExcalidrawElement } from "@zsviczian/excalidraw/types/element/types";
import { ExportSettings } from "../ExcalidrawView";
import { compressToBase64, decompressFromBase64 } from "lz-string";
import { getIMGFilename } from "./FileUtils";

declare const PLUGIN_VERSION:string;

const {
  exportToSvg,
  exportToBlob,
//@ts-ignore
} = excalidrawLib;

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

    if (latestVersion > PLUGIN_VERSION) {
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
export function wrapText(
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

export const viewportCoordsToSceneCoords = (
  { clientX, clientY }: { clientX: number; clientY: number },
  {
    zoom,
    offsetLeft,
    offsetTop,
    scrollX,
    scrollY,
  }: {
    zoom: Zoom;
    offsetLeft: number;
    offsetTop: number;
    scrollX: number;
    scrollY: number;
  },
) => {
  const invScale = 1 / zoom.value;
  const x = (clientX - offsetLeft) * invScale - scrollX;
  const y = (clientY - offsetTop) * invScale - scrollY;

  return { x, y };
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
    fontDef = ` @font-face {font-family: "${fontName}";src: url("${dataURL}") format("${
      f.extension === "ttf" ? "truetype" : f.extension
    }");}`;
    const split = fontDef.split(";base64,", 2);
    fontDef = `${split[0]};charset=utf-8;base64,${split[1]}`;
  }
  return { fontDef, fontName, dataURL };
};

export const svgToBase64 = (svg: string): string => {
  return `data:image/svg+xml;base64,${btoa(
    unescape(encodeURIComponent(svg.replaceAll("&nbsp;", " "))),
  )}`;
};

export const getBinaryFileFromDataURL = (dataURL: string): ArrayBuffer => {
  if (!dataURL) {
    return null;
  }
  const parts = dataURL.matchAll(/base64,(.*)/g).next();
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
  try {
    return await exportToSvg({
      elements: scene.elements,
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

export const getPNG = async (
  scene: any,
  exportSettings: ExportSettings,
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
      files: scene.files,
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
): SVGSVGElement => {
  //replace font references with base64 fonts
  const includesVirgil =
    svg.querySelector("text[font-family^='Virgil']") != null;
  const includesCascadia =
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
    img.onload = () => resolve({ height: img.naturalHeight, width: img.naturalWidth });
    img.onerror = reject;
    img.src = src;
  });
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
      });
    return { dirty, scene };
  }
};

export const setLeftHandedMode = (isLeftHanded: boolean) => {
  const visitedDocs = new Set<Document>();
  app.workspace.iterateAllLeaves((leaf) => {
    const ownerDocument = app.isMobile?document:leaf.view.containerEl.ownerDocument;
    if(!ownerDocument) return;
    if(visitedDocs.has(ownerDocument)) return;
    visitedDocs.add(ownerDocument);
    const newStylesheet = ownerDocument.createElement("style");
    newStylesheet.id = "excalidraw-letf-handed";
    newStylesheet.textContent = `.excalidraw .App-bottom-bar{justify-content:flex-end;}`;
    const oldStylesheet = ownerDocument.getElementById(newStylesheet.id);
    if (oldStylesheet) {
      ownerDocument.head.removeChild(oldStylesheet);
    }
    if (isLeftHanded) {
      ownerDocument.head.appendChild(newStylesheet);
    }
  })
};

export type LinkParts = {
  original: string;
  path: string;
  isBlockRef: boolean;
  ref: string;
  width: number;
  height: number;
};

export const getLinkParts = (fname: string, file?: TFile): LinkParts => {
  const REG = /(^[^#\|]*)#?(\^)?([^\|]*)?\|?(\d*)x?(\d*)/;
  const parts = fname.match(REG);
  return {
    original: fname,
    path: file && parts[1] === "" ? file.path : parts[1],
    isBlockRef: parts[2] === "^",
    ref: parts[3]?.replaceAll(REG_BLOCK_REF_CLEAN, ""),
    width: parts[4] ? parseInt(parts[4]) : undefined,
    height: parts[5] ? parseInt(parts[5]) : undefined,
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

export const getSVGPadding = (
  plugin: ExcalidrawPlugin,
  file: TFile,
): number => {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEY_EXPORT_SVGPADDING] != null
    ) {
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

export const errorlog = (data: {}) => {
  console.error({ plugin: "Excalidraw", ...data });
};

export const sleep = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const log = console.log.bind(window.console);
export const debug = console.log.bind(window.console);
//export const debug = function(){};
