import { exportToSvg, exportToBlob } from "@zsviczian/excalidraw";
import {
  App,
  normalizePath,
  Notice,
  request,
  TAbstractFile,
  TFile,
  TFolder,
  Vault,
  WorkspaceLeaf,
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
} from "./Constants";
import ExcalidrawPlugin from "./main";
import { ExcalidrawElement } from "@zsviczian/excalidraw/types/element/types";
import { ExportSettings } from "./ExcalidrawView";
import { compressToBase64, decompressFromBase64 } from "lz-string";
import { ExcalidrawSettings } from "./Settings";

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
  //@ts-ignore
  const manifest = app.plugins.manifests[PLUGIN_ID];

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

    if (latestVersion > manifest.version) {
      new Notice(
        `A newer version of Excalidraw is available in Community Plugins.\n\nYou are using ${manifest.version}.\nThe latest is ${latestVersion}`,
      );
    }
  } catch (e) {
    errorlog({ where: "Utils/checkExcalidrawVersion", error: e });
  }
  setTimeout(() => (versionUpdateChecked = false), 28800000); //reset after 8 hours
};

/**
 * Splits a full path including a folderpath and a filename into separate folderpath and filename components
 * @param filepath
 */
export function splitFolderAndFilename(filepath: string): {
  folderpath: string;
  filename: string;
  basename: string;
} {
  const lastIndex = filepath.lastIndexOf("/");
  const filename =
    lastIndex == -1 ? filepath : filepath.substring(lastIndex + 1);
  return {
    folderpath: normalizePath(filepath.substring(0, lastIndex)),
    filename,
    basename: filename.replace(/\.[^/.]+$/, ""),
  };
}

/**
 * Download data as file from Obsidian, to store on local device
 * @param encoding
 * @param data
 * @param filename
 */
export function download(encoding: string, data: any, filename: string) {
  const element = document.createElement("a");
  element.setAttribute("href", (encoding ? `${encoding},` : "") + data);
  element.setAttribute("download", filename);
  element.style.display = "none";
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

/**
 * Generates the image filename based on the excalidraw filename
 * @param excalidrawPath - Full filepath of ExclidrawFile
 * @param newExtension - extension of IMG file in ".extension" format
 * @returns
 */
export function getIMGPathFromExcalidrawFile(
  excalidrawPath: string,
  newExtension: string,
): string {
  const isLegacyFile: boolean = excalidrawPath.endsWith(".excalidraw");
  const replaceExtension: string = isLegacyFile ? ".excalidraw" : ".md";
  return (
    excalidrawPath.substring(0, excalidrawPath.lastIndexOf(replaceExtension)) +
    newExtension
  );
}

/*export function getBakPath(file:TFile):string {
  const re = new RegExp(`${file.name}$`,"g");
  return file.path.replace(re,`.${file.name}.bak`);
}*/

/**
 * Create new file, if file already exists find first unique filename by adding a number to the end of the filename
 * @param filename
 * @param folderpath
 * @returns
 */
export function getNewUniqueFilepath(
  vault: Vault,
  filename: string,
  folderpath: string,
): string {
  let fname = normalizePath(`${folderpath}/${filename}`);
  let file: TAbstractFile = vault.getAbstractFileByPath(fname);
  let i = 0;
  const extension = filename.endsWith(".excalidraw.md") 
    ? ".excalidraw.md"
    : filename.slice(filename.lastIndexOf("."))
  while (file) {
    fname = normalizePath(
      `${folderpath}/${filename.slice(
        0,
        filename.lastIndexOf(extension),
      )}_${i}${extension}`,
    );
    i++;
    file = vault.getAbstractFileByPath(fname);
  }
  return fname;
}

export function getDrawingFilename(settings:ExcalidrawSettings):string {
  return settings.drawingFilenamePrefix +
    (settings.drawingFilenameDateTime !== ""
      ? window.moment().format(settings.drawingFilenameDateTime)
      : "") + 
    (settings.compatibilityMode 
      ? ".excalidraw"
      : settings.useExcalidrawExtension
        ? ".excalidraw.md"
        : ".md")
}

export function getEmbedFilename(notename: string, settings:ExcalidrawSettings):string {
  return (
    settings.drawingEmbedPrefixWithFilename
      ? notename
      : "") +
    settings.drawingFilnameEmbedPostfix +
    (settings.drawingFilenameDateTime !== ""
      ? window.moment().format(settings.drawingFilenameDateTime)
      : "") + 
    (settings.compatibilityMode 
      ? ".excalidraw"
      : settings.useExcalidrawExtension
        ? ".excalidraw.md"
        : ".md")
}

/**
 * Open or create a folderpath if it does not exist
 * @param folderpath
 */
export async function checkAndCreateFolder(vault: Vault, folderpath: string) {
  folderpath = normalizePath(folderpath);
  const folder = vault.getAbstractFileByPath(folderpath);
  if (folder && folder instanceof TFolder) {
    return;
  }
  await vault.createFolder(folderpath);
}

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

export const getNewOrAdjacentLeaf = (
  plugin: ExcalidrawPlugin,
  leaf: WorkspaceLeaf,
): WorkspaceLeaf => {
  if (plugin.settings.openInAdjacentPane) {
    let leafToUse = plugin.app.workspace.getAdjacentLeafInDirection(
      leaf,
      "right",
    );
    if (!leafToUse) {
      leafToUse = plugin.app.workspace.getAdjacentLeafInDirection(leaf, "left");
    }
    if (!leafToUse) {
      leafToUse = plugin.app.workspace.getAdjacentLeafInDirection(
        leaf,
        "bottom",
      );
    }
    if (!leafToUse) {
      leafToUse = plugin.app.workspace.getAdjacentLeafInDirection(leaf, "top");
    }
    if (!leafToUse) {
      leafToUse = plugin.app.workspace.createLeafBySplit(leaf);
    }
    return leafToUse;
  }
  return plugin.app.workspace.createLeafBySplit(leaf);
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

export const getAttachmentsFolderAndFilePath = async (
  app: App,
  activeViewFilePath: string,
  newFileName: string,
): Promise<{ folder: string; filepath: string }> => {
  let folder = app.vault.getConfig("attachmentFolderPath");
  // folder == null: save to vault root
  // folder == "./" save to same folder as current file
  // folder == "folder" save to specific folder in vault
  // folder == "./folder" save to specific subfolder of current active folder
  if (folder && folder.startsWith("./")) {
    // folder relative to current file
    const activeFileFolder = `${
      splitFolderAndFilename(activeViewFilePath).folderpath
    }/`;
    folder = normalizePath(activeFileFolder + folder.substring(2));
  }
  if (!folder) {
    folder = "";
  }
  await checkAndCreateFolder(app.vault, folder);
  return {
    folder,
    filepath: normalizePath(
      folder === "" ? newFileName : `${folder}/${newFileName}`,
    ),
  };
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
    img.onload = () => resolve({ height: img.height, width: img.width });
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
  const newStylesheet = document.createElement("style");
  newStylesheet.id = "excalidraw-letf-handed";
  newStylesheet.textContent = `.excalidraw .App-bottom-bar{justify-content:flex-end;}`;
  const oldStylesheet = document.getElementById(newStylesheet.id);
  if (oldStylesheet) {
    document.head.removeChild(oldStylesheet);
  }
  if(isLeftHanded)
    document.head.appendChild(newStylesheet);
}

export const isObsidianThemeDark = () =>
  document.body.classList.contains("theme-dark");

export function getIMGFilename(path: string, extension: string): string {
  return `${path.substring(0, path.lastIndexOf("."))}.${extension}`;
}

export type LinkParts = {
  original: string;
  path: string;
  isBlockRef: boolean;
  ref: string;
  width: number;
  height: number;
};

export const getLinkParts = (fname: string, file?:TFile): LinkParts => {
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

export const hasExportTheme = (plugin: ExcalidrawPlugin, file: TFile):boolean => {
  if(file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEY_EXPORT_DARK] != null
    ) {
      return true;
    }
  }
  return false;
}

export const getExportTheme = (plugin: ExcalidrawPlugin, file: TFile, theme: string):string => {
  if(file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEY_EXPORT_DARK] != null
    ) {
      return fileCache.frontmatter[FRONTMATTER_KEY_EXPORT_DARK]
        ? "dark"
        : "light"
    }
  }
  return plugin.settings.exportWithTheme ? theme : "light";
}

export const hasExportBackground = (plugin: ExcalidrawPlugin, file: TFile):boolean => {
  if(file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEY_EXPORT_TRANSPARENT] != null
    ) {
      return true;
    }
  }
  return false;
}

export const getWithBackground = (plugin: ExcalidrawPlugin, file: TFile):boolean => {
  if(file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEY_EXPORT_TRANSPARENT] != null
    ) {
      return fileCache.frontmatter[FRONTMATTER_KEY_EXPORT_TRANSPARENT]
        ? false
        : true
    }
  }
  return plugin.settings.exportWithBackground;
}

export const getSVGPadding = (plugin: ExcalidrawPlugin, file: TFile):number => {
  if(file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEY_EXPORT_SVGPADDING] != null
    ) {
      const val = parseInt(fileCache.frontmatter[FRONTMATTER_KEY_EXPORT_SVGPADDING]);
      if(!isNaN(val)) {
        return val;
      }
    }
  }
  return plugin.settings.exportPaddingSVG;  
}

export const getPNGScale = (plugin: ExcalidrawPlugin, file: TFile):number => {
  if(file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEY_EXPORT_PNGSCALE] != null
    ) {
      const val = parseFloat(fileCache.frontmatter[FRONTMATTER_KEY_EXPORT_PNGSCALE]);
      if(!isNaN(val) && val>0) {
        return val;
      }
    }
  }
  return plugin.settings.pngExportScale;  
}

export const errorlog = (data: {}) => {
  console.error({ plugin: "Excalidraw", ...data });
};

export const sleep = async (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const log = console.log.bind(window.console);
export const debug = console.log.bind(window.console);
//export const debug = function(){};
