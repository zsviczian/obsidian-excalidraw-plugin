import { App, Notice, request, requestUrl, TFile } from "obsidian";
import { Random } from "roughjs/bin/math";
import {
  AppState,
  BinaryFileData,
  BinaryFiles,
} from "@zsviczian/excalidraw/types/excalidraw/types";
import { errorlog, getDataURL } from "./coreUtils";
import {
  exportToSvg,
  exportToBlob,
  IMAGE_TYPES,
  FRONTMATTER_KEYS,
  EXCALIDRAW_PLUGIN,
  getCommonBoundingBox,
  DEVICE,
  getContainerElement,
  SCRIPT_INSTALL_FOLDER,
  VIEW_TYPE_EXCALIDRAW,
} from "../constants/constants";
import ExcalidrawPlugin from "../core/main";
import {
  ElementsMap,
  ExcalidrawElement,
  ExcalidrawImageElement,
  ImageCrop,
} from "@zsviczian/excalidraw/types/element/src/types";
import {
  getDataURLFromURL,
  getIMGFilename,
  getMimeType,
  getURLImageExtension,
} from "./fileUtils";
import { FILENAMEPARTS } from "../types/utilTypes";
import { Mutable } from "@zsviczian/excalidraw/types/common/src/utility-types";
import { getExcalidrawViews, getFileCSSClasses } from "./obsidianUtils";
import { cleanBlockRef, cleanSectionHeading } from "./pathUtils";
import { addAppendUpdateCustomData } from "./elementCustomDataUtils";
import { updateElementLinksToObsidianLinks } from "./excalidrawAutomateUtils";
import { CropImage } from "../shared/CropImage";
import opentype from "opentype.js";
import Pool from "es6-promise-pool";
import { t } from "src/lang/helpers";
import { log } from "./debugHelper";
import { VersionMismatchPrompt } from "src/shared/Dialogs/VersionMismatch";
import { ExcalidrawSettings } from "src/core/settings";
import { FileData } from "src/types/embeddedFileLoaderTypes";
import { ExportSettings } from "src/types/exportUtilTypes";
import { RemoteDirectoryInfo } from "src/types/githubTypes";
import { UIMode } from "src/shared/Dialogs/UIModeSettingComponent";
import ExcalidrawView from "../view/ExcalidrawView";
import { getEmptyDrawingElementsRuntime } from "src/constants/emptydrawing";
import { makeEntitiesXmlSafe, sanitizedFragment } from "./htmlUtils";
import { URLs } from "src/constants/safeUrls";
import { isInstanceOfSVGSVGElement } from "./typechecks";
export { errorlog, getDataURL } from "./coreUtils";
export { addAppendUpdateCustomData } from "./elementCustomDataUtils";

declare const PLUGIN_VERSION: string;

type GitHubReleaseInfo = {
  draft: boolean;
  prerelease: boolean;
  tag_name: string;
  published_at: string;
};

type PublishedReleaseInfo = {
  version: string;
  published: Date;
};

type SceneForExport = {
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  files?: BinaryFiles;
};

type SceneWithElements = Pick<SceneForExport, "elements">;

let versionMismatchChecked = false;
export async function checkVersionMismatch(plugin: ExcalidrawPlugin) {
  if (!versionMismatchChecked && plugin.manifest.version !== PLUGIN_VERSION) {
    versionMismatchChecked = true;
    const versionMismatchPrompt = new VersionMismatchPrompt(plugin);
    const result = await versionMismatchPrompt.start();
    if (result) {
      plugin.manifest.version = PLUGIN_VERSION;
      await plugin.app.setting.open();
      plugin.app.setting.openTabById("community-plugins");
    }
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
          url: URLs.API_GITHUB_COM_REPOS_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_RELEASES,
        }),
      ) as GitHubReleaseInfo[];
    };

    const latestVersion = (await gitAPIrequest())
      .filter((el: GitHubReleaseInfo) => !el.draft && !el.prerelease)
      .map((el: GitHubReleaseInfo): PublishedReleaseInfo => {
        return {
          version: el.tag_name,
          published: new Date(el.published_at),
        };
      })
      .filter((el: PublishedReleaseInfo) => el.version.match(/^\d+\.\d+\.\d+$/))
      .sort(
        (el1: PublishedReleaseInfo, el2: PublishedReleaseInfo) =>
          el2.published.getTime() - el1.published.getTime(),
      )[0].version;

    if (isVersionNewerThanOther(latestVersion, PLUGIN_VERSION)) {
      new Notice(`${t("UPDATE_AVAILABLE")} ${latestVersion}`);
    }

    // Check for script updates
    await checkScriptUpdates();
  } catch (e) {
    console.log({ where: "Utils/checkExcalidrawVersion", error: e });
  }
  versionUpdateCheckTimer = window.setTimeout(() => {
    versionUpdateChecked = false;
    versionUpdateCheckTimer = null;
  }, 28800000); //reset after 8 hours
}

async function checkScriptUpdates() {
  try {
    if (!EXCALIDRAW_PLUGIN?.settings?.scriptFolderPath) {
      return;
    }

    const folder = `${EXCALIDRAW_PLUGIN.settings.scriptFolderPath}/${SCRIPT_INSTALL_FOLDER}/`;
    const installedScripts = EXCALIDRAW_PLUGIN.app.vault
      .getFiles()
      .filter((f) => f.path.startsWith(folder) && f.extension === "md");

    if (installedScripts.length === 0) {
      return;
    }

    // Get directory info from GitHub
    const files = new Map<string, number>();
    const directoryInfo = JSON.parse(
      await request({
        url: URLs.RAW_GITHUBUSERCONTENT_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_MASTER_EA_SCRIPTS_DIRECTORY_INFO_JSON,
      }),
    ) as RemoteDirectoryInfo[];
    directoryInfo.forEach((f: RemoteDirectoryInfo) =>
      files.set(f.fname, f.mtime),
    );

    if (files.size === 0) {
      return;
    }

    // Check if any installed scripts have updates
    const updates: string[] = [];
    let hasUpdates = false;
    for (const scriptFile of installedScripts) {
      const filename = scriptFile.name;
      if (files.has(filename)) {
        const mtime = files.get(filename);
        if (mtime > scriptFile.stat.mtime) {
          updates.push(scriptFile.path.split(folder)?.[1]?.split(".md")[0]);
          hasUpdates = true;
        }
      }
    }

    if (hasUpdates) {
      const message = `${t("SCRIPT_UPDATES_AVAILABLE")}\n\n${updates.sort().join("\n")}`;
      new Notice(message, 8000 + updates.length * 1000);
      log(message);
    }
  } catch (e) {
    console.log({ where: "Utils/checkScriptUpdates", error: e });
  }
}

const random = new Random(Date.now());
export function randomInteger() {
  return Math.floor(random.next() * 2 ** 31);
}

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

export function rotatedDimensions(
  element: ExcalidrawElement,
): [number, number, number, number] {
  const bb = getCommonBoundingBox([element]);
  return [bb.minX, bb.minY, bb.maxX - bb.minX, bb.maxY - bb.minY];
}

export async function getFontDataURL(
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
}

export function base64StringToBlob(
  base64String: string,
  mimeType: string,
): Blob {
  const buffer = Buffer.from(base64String, "base64");
  return new Blob([buffer], { type: mimeType });
}

export function svgToBase64(svg: string): string {
  const cleanSvg = svg.replaceAll("&nbsp;", " ");

  // Convert the string to UTF-8 and handle non-Latin1 characters
  const encodedData = encodeURIComponent(cleanSvg).replace(
    /%([0-9A-F]{2})/g,
    (match, p1) => String.fromCharCode(parseInt(p1, 16)),
  );

  return `data:image/svg+xml;base64,${btoa(encodedData)}`;
}

export async function getBinaryFileFromDataURL(
  dataURL: string,
): Promise<ArrayBuffer> {
  if (!dataURL) {
    return null;
  }
  if (dataURL.match(/^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i)) {
    const hyperlink = dataURL;
    const extension = getURLImageExtension(hyperlink);
    const mimeType = getMimeType(extension);
    dataURL = await getDataURLFromURL(hyperlink, mimeType);
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
}

export async function getSVG<TScene extends SceneForExport>(
  scene: TScene,
  exportSettings: ExportSettings,
  padding: number,
  srcFile: TFile | null, //if set, will replace markdown links with obsidian links
  overrideFiles?: Record<ExcalidrawElement["id"], BinaryFileData>,
): Promise<SVGSVGElement> {
  let elements: ExcalidrawElement[] = [...scene.elements];
  if (elements.some((el) => el.type === "embeddable")) {
    elements = JSON.parse(JSON.stringify(elements));
  }

  elements = srcFile
    ? updateElementLinksToObsidianLinks({
        elements,
        hostFile: srcFile,
      })
    : elements;

  const baseFiles = scene.files ?? {};
  const files = overrideFiles ? { ...baseFiles, ...overrideFiles } : baseFiles;

  elements = elements.filter((el: ExcalidrawElement) => el.isDeleted !== true);

  try {
    let svg: SVGSVGElement;
    if (exportSettings.isMask) {
      const cropObject = new CropImage(
        elements,
        files as unknown as ConstructorParameters<typeof CropImage>[1],
      );
      svg = await cropObject.getCroppedSVG();
      cropObject.destroy();
    } else {
      if (elements.length === 0) {
        elements = getEmptyDrawingElementsRuntime();
      }
      svg = await exportToSvg({
        elements,
        appState: {
          ...scene.appState,
          exportBackground: exportSettings.withBackground,
          exportWithDarkMode: exportSettings.withTheme
            ? scene.appState?.theme !== "light"
            : false,
          ...(exportSettings.frameRendering
            ? { frameRendering: exportSettings.frameRendering }
            : {}),
        } as AppState,
        files,
        exportPadding: exportSettings.frameRendering?.enabled ? 0 : padding,
        exportingFrame: null,
        renderEmbeddables: true,
        skipInliningFonts: exportSettings.skipInliningFonts,
      });
    }
    if (svg) {
      svg.addClass("excalidraw-svg");
      if (srcFile instanceof TFile) {
        const cssClasses = getFileCSSClasses(srcFile);
        cssClasses.forEach((cssClass) => svg.addClass(cssClass));
      }
    }
    return svg;
  } catch (error) {
    console.error("unexpected error in getSVG", getSVG, error);
    return null;
  }
}

export function filterFiles(
  files: Record<ExcalidrawElement["id"], BinaryFileData>,
): Record<ExcalidrawElement["id"], BinaryFileData> {
  const filteredFiles: Record<ExcalidrawElement["id"], BinaryFileData> = {};

  Object.entries(files).forEach(([key, value]) => {
    if (!value.dataURL.startsWith("http")) {
      filteredFiles[key] = value;
    }
  });

  return filteredFiles;
}

export async function getPNG<TScene extends SceneForExport>(
  scene: TScene,
  exportSettings: ExportSettings,
  padding: number,
  scale: number = 1,
  overrideFiles?: Record<ExcalidrawElement["id"], BinaryFileData>,
): Promise<Blob> {
  try {
    const baseFiles = scene.files ?? {};
    const files = overrideFiles
      ? { ...baseFiles, ...overrideFiles }
      : baseFiles;

    let elements = scene.elements.filter(
      (el: ExcalidrawElement) => el.isDeleted !== true,
    );

    if (exportSettings.isMask) {
      const cropObject = new CropImage(
        elements,
        files as unknown as ConstructorParameters<typeof CropImage>[1],
      );
      const blob = await cropObject.getCroppedPNG();
      cropObject.destroy();
      return blob;
    }

    if (elements.length === 0) {
      elements = getEmptyDrawingElementsRuntime();
    }

    return await exportToBlob({
      elements,
      appState: {
        ...scene.appState,
        exportBackground: exportSettings.withBackground,
        exportWithDarkMode: exportSettings.withTheme
          ? scene.appState?.theme !== "light"
          : false,
        ...(exportSettings.frameRendering
          ? { frameRendering: exportSettings.frameRendering }
          : {}),
      } as AppState,
      files: filterFiles(files),
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
}

export async function getQuickImagePreview(
  plugin: ExcalidrawPlugin,
  path: string,
  extension: "png",
): Promise<Blob | null>;
export async function getQuickImagePreview(
  plugin: ExcalidrawPlugin,
  path: string,
  extension: "svg",
): Promise<string | null>;
export async function getQuickImagePreview(
  plugin: ExcalidrawPlugin,
  path: string,
  extension: "png" | "svg",
): Promise<Blob | string | null> {
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
      return new Blob([await plugin.app.vault.readBinary(file)], {
        type: "image/png",
      });
    default:
      return await plugin.app.vault.read(file);
  }
}

export async function getImageSize(
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
}

export function scaleLoadedImage<T extends SceneWithElements>(
  scene: T,
  files: FileData[],
): {
  dirty: boolean;
  scene: Omit<T, "elements"> & { elements: Mutable<ExcalidrawElement>[] };
} {
  let dirty = false;
  if (!files || !scene) {
    return {
      dirty,
      scene: scene as unknown as Omit<T, "elements"> & {
        elements: Mutable<ExcalidrawElement>[];
      },
    };
  }

  const sceneElements = scene.elements as Mutable<ExcalidrawElement>[];

  for (const img of files.filter((f: FileData) => {
    if (!EXCALIDRAW_PLUGIN) {
      return true;
    } //this should never happen
    const ef = EXCALIDRAW_PLUGIN.filesMaster.get(f.id);
    if (!ef) {
      return true;
    } //mermaid SVG or equation
    const file = EXCALIDRAW_PLUGIN.app.vault.getAbstractFileByPath(
      ef.path.replace(/#.*$/, "").replace(/\|.*$/, ""),
    );
    if (file && file instanceof TFile) {
      return (
        file.extension === "md" || EXCALIDRAW_PLUGIN.isExcalidrawFile(file)
      );
    }
    return false;
  })) {
    const [imgWidth, imgHeight] = [img.size.width, img.size.height];
    const imgAspectRatio = imgWidth / imgHeight;

    sceneElements
      .filter(
        (e: ExcalidrawElement) => e.type === "image" && e.fileId === img.id,
      )
      .forEach((el: Mutable<ExcalidrawImageElement>) => {
        const [elWidth, elHeight] = [el.width, el.height];
        const maintainArea = img.shouldScale; //true if image should maintain its area, false if image should display at 100% its size
        const elCrop: ImageCrop = el.crop;
        const isCropped = Boolean(elCrop);

        if (
          (el.customData?.isAnchored && img.shouldScale) ||
          (!el.customData?.isAnchored && !img.shouldScale)
        ) {
          //customData.isAnchored is used by the Excalidraw component to disable resizing of anchored images
          //customData.isAnchored has no direct role in the calculation in the scaleLoadedImage function
          addAppendUpdateCustomData(
            el,
            img.shouldScale ? { isAnchored: false } : { isAnchored: true },
          );
          dirty = true;
        }

        if (isCropped) {
          if (
            elCrop.naturalWidth !== imgWidth ||
            elCrop.naturalHeight !== imgHeight
          ) {
            dirty = true;
            //the current crop area may be maintained, need to calculate the new crop.x, crop.y offsets
            el.crop.y += (imgHeight - elCrop.naturalHeight) / 2;
            if (imgWidth < elCrop.width) {
              const scaleX = el.width / elCrop.width;
              el.crop.x = 0;
              el.crop.width = imgWidth;
              el.width = imgWidth * scaleX;
            } else {
              const ratioX =
                elCrop.x / (elCrop.naturalWidth - elCrop.x - elCrop.width);
              const gapX = imgWidth - elCrop.width;
              el.crop.x = (ratioX * gapX) / (1 + ratioX);
              if (el.crop.x + elCrop.width > imgWidth) {
                el.crop.x = (imgWidth - elCrop.width) / 2;
              }
            }
            if (imgHeight < elCrop.height) {
              const scaleY = el.height / elCrop.height;
              el.crop.y = 0;
              el.crop.height = imgHeight;
              el.height = imgHeight * scaleY;
            } else {
              const ratioY =
                elCrop.y / (elCrop.naturalHeight - elCrop.y - elCrop.height);
              const gapY = imgHeight - elCrop.height;
              el.crop.y = (ratioY * gapY) / (1 + ratioY);
              if (el.crop.y + elCrop.height > imgHeight) {
                el.crop.y = (imgHeight - elCrop.height) / 2;
              }
            }
            el.crop.naturalWidth = imgWidth;
            el.crop.naturalHeight = imgHeight;
            const noCrop =
              el.crop.width === imgWidth && el.crop.height === imgHeight;
            if (noCrop) {
              el.crop = null;
            }
          }
        } else if (el?.customData?.latexscale) {
          // scale latex
          const scale = el?.customData?.latexscale;
          dirty = true;
          const elNewHeight = imgHeight * scale.scaleY;
          const elNewWidth = imgWidth * scale.scaleX;
          el.height = elNewHeight;
          el.width = elNewWidth;
          // we won't need the latexscale anymore
          // if we don't delete it, it will (maybe wrongfully) scale it back when reloading the view
          addAppendUpdateCustomData(el, { latexscale: undefined });
        } else if (maintainArea) {
          const elAspectRatio = elWidth / elHeight;
          if (imgAspectRatio !== elAspectRatio) {
            dirty = true;
            const elNewHeight = Math.sqrt(
              (elWidth * elHeight * imgHeight) / imgWidth,
            );
            const elNewWidth = Math.sqrt(
              (elWidth * elHeight * imgWidth) / imgHeight,
            );
            el.height = elNewHeight;
            el.width = elNewWidth;
            el.y += (elHeight - elNewHeight) / 2;
            el.x += (elWidth - elNewWidth) / 2;
          }
        } else {
          //100% size
          if (elWidth !== imgWidth || elHeight !== imgHeight) {
            dirty = true;
            el.height = imgHeight;
            el.width = imgWidth;
            el.y += (elHeight - imgHeight) / 2;
            el.x += (elWidth - imgWidth) / 2;
          }
        }
      });
  }
  return {
    dirty,
    scene: scene as unknown as Omit<T, "elements"> & {
      elements: Mutable<ExcalidrawElement>[];
    },
  };
}

export function setLeftHandedMode(isLeftHanded: boolean) {
  if (DEVICE.isPhone) {
    return;
  } // no left-handed mode on phones
  EXCALIDRAW_PLUGIN.app.workspace
    .getLeavesOfType(VIEW_TYPE_EXCALIDRAW)
    .forEach((leaf) => {
      if (leaf.view instanceof ExcalidrawView) {
        leaf.view.setHandedness(isLeftHanded);
      }
    });
}

export function calculateUIModeValue(settings: ExcalidrawSettings): UIMode {
  const phoneMode = settings.phoneUIMode ?? "mobile";
  const tabletMode = settings.tabletUIMode ?? "compact";
  const desktopMode = settings.desktopUIMode ?? "tray";

  return DEVICE.isPhone
    ? phoneMode
    : DEVICE.isTablet
      ? tabletMode
      : DEVICE.isDesktop
        ? desktopMode
        : "tray";
}

export function setUIMode(app: App, settings: ExcalidrawSettings) {
  const uiMode = calculateUIModeValue(settings);
  getExcalidrawViews(app, true).forEach((view: ExcalidrawView) =>
    view.setUIMode(uiMode),
  );
}

export type LinkParts = {
  original: string;
  path: string;
  isBlockRef: boolean;
  ref: string;
  width: number;
  height: number;
  page: number;
};

export function getLinkParts(fname: string, file?: TFile): LinkParts {
  //            1           2    3           4      5
  const REG = /(^[^#|]*)#?(\^)?([^|]*)?\|?(\d*)x?(\d*)/;
  const parts = fname.match(REG);
  const isBlockRef = parts[2] === "^";
  let page = parseInt(parts[3]?.match(/page=(\d*)/)?.[1]);
  page = isNaN(page) ? null : page;
  return {
    original: fname,
    path: file && parts[1] === "" ? file.path : parts[1],
    isBlockRef,
    ref: parts[3]?.match(/^page=\d*$/i)
      ? parts[3]
      : isBlockRef
        ? cleanBlockRef(parts[3])
        : cleanSectionHeading(parts[3]),
    width: parts[4] ? parseInt(parts[4]) : undefined,
    height: parts[5] ? parseInt(parts[5]) : undefined,
    page,
  };
}

export function isMaskFile(
  plugin: ExcalidrawPlugin,
  file: TFile | null,
): boolean {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEYS.mask.name] !== null &&
      typeof fileCache.frontmatter[FRONTMATTER_KEYS.mask.name] !== "undefined"
    ) {
      return Boolean(fileCache.frontmatter[FRONTMATTER_KEYS.mask.name]);
    }
  }
  return false;
}

export function hasExportTheme(
  plugin: ExcalidrawPlugin,
  file: TFile | null,
): boolean {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEYS["export-dark"].name] !== null &&
      typeof fileCache.frontmatter[FRONTMATTER_KEYS["export-dark"].name] !==
        "undefined"
    ) {
      return true;
    }
  }
  return false;
}

export function getExportTheme(
  plugin: ExcalidrawPlugin,
  file: TFile | null,
  theme: string,
): string {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEYS["export-dark"].name] !== null &&
      typeof fileCache.frontmatter[FRONTMATTER_KEYS["export-dark"].name] !==
        "undefined"
    ) {
      return fileCache.frontmatter[FRONTMATTER_KEYS["export-dark"].name]
        ? "dark"
        : "light";
    }
  }
  return plugin.settings.exportWithTheme ? theme : "light";
}

export function shouldEmbedScene(
  plugin: ExcalidrawPlugin,
  file: TFile | null,
): boolean {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEYS["export-embed-scene"].name] !==
        null &&
      typeof fileCache.frontmatter[
        FRONTMATTER_KEYS["export-embed-scene"].name
      ] !== "undefined"
    ) {
      return fileCache.frontmatter[FRONTMATTER_KEYS["export-embed-scene"].name];
    }
  }
  return plugin.settings.exportEmbedScene;
}

export function hasExportBackground(
  plugin: ExcalidrawPlugin,
  file: TFile | null,
): boolean {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEYS["export-transparent"].name] !==
        null &&
      typeof fileCache.frontmatter[
        FRONTMATTER_KEYS["export-transparent"].name
      ] !== "undefined"
    ) {
      return true;
    }
  }
  return false;
}

export function getWithBackground(
  plugin: ExcalidrawPlugin,
  file: TFile | null,
): boolean {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEYS["export-transparent"].name] !==
        null &&
      typeof fileCache.frontmatter[
        FRONTMATTER_KEYS["export-transparent"].name
      ] !== "undefined"
    ) {
      return !fileCache.frontmatter[
        FRONTMATTER_KEYS["export-transparent"].name
      ];
    }
  }
  return plugin.settings.exportWithBackground;
}

export function getExportInternalLinks(
  plugin: ExcalidrawPlugin,
  file: TFile | null,
): boolean {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEYS["export-internal-links"].name] !==
        null &&
      typeof fileCache.frontmatter[
        FRONTMATTER_KEYS["export-internal-links"].name
      ] !== "undefined"
    ) {
      return fileCache.frontmatter[
        FRONTMATTER_KEYS["export-internal-links"].name
      ];
    }
  }
  return true;
}

export function getExportPadding(
  plugin: ExcalidrawPlugin,
  file: TFile | null,
): number {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (!fileCache?.frontmatter) {
      return plugin.settings.exportPaddingSVG;
    }

    if (
      fileCache.frontmatter[FRONTMATTER_KEYS["export-padding"].name] !== null &&
      typeof fileCache.frontmatter[FRONTMATTER_KEYS["export-padding"].name] !==
        "undefined"
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
      fileCache.frontmatter[FRONTMATTER_KEYS["export-svgpadding"].name] !==
        null &&
      typeof fileCache.frontmatter[
        FRONTMATTER_KEYS["export-svgpadding"].name
      ] !== "undefined"
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
}

export function getPNGScale(
  plugin: ExcalidrawPlugin,
  file: TFile | null,
): number {
  if (file) {
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEYS["export-pngscale"].name] !==
        null &&
      typeof fileCache.frontmatter[FRONTMATTER_KEYS["export-pngscale"].name] !==
        "undefined"
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
}

export function isVersionNewerThanOther(
  version: string,
  otherVersion: string,
): boolean {
  if (!version || !otherVersion) {
    return true;
  }

  const v = version.match(/(\d*)\.(\d*)\.(\d*)/);
  const o = otherVersion.match(/(\d*)\.(\d*)\.(\d*)/);

  return Boolean(
    v &&
    v.length === 4 &&
    o &&
    o.length === 4 &&
    !(
      isNaN(parseInt(v[1])) ||
      isNaN(parseInt(v[2])) ||
      isNaN(parseInt(v[3]))
    ) &&
    !(
      isNaN(parseInt(o[1])) ||
      isNaN(parseInt(o[2])) ||
      isNaN(parseInt(o[3]))
    ) &&
    (parseInt(v[1]) > parseInt(o[1]) ||
      (parseInt(v[1]) >= parseInt(o[1]) && parseInt(v[2]) > parseInt(o[2])) ||
      (parseInt(v[1]) >= parseInt(o[1]) &&
        parseInt(v[2]) >= parseInt(o[2]) &&
        parseInt(v[3]) > parseInt(o[3]))),
  );
}

export function getEmbeddedFilenameParts(fname: string): FILENAMEPARTS {
  //                        0 1        23    4                               5         6  7                             8          9
  const parts = fname?.match(
    /([^#^]*)((#\^)(group=|area=|frame=|clippedframe=|taskbone)?([^|]*)|(#)(group=|area=|frame=|clippedframe=|taskbone)?([^^|]*))(.*)/,
  );
  if (!parts) {
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
      linkpartAlias: "",
    };
  }
  return {
    filepath: parts[1],
    hasBlockref: Boolean(parts[3]),
    hasGroupref: parts[4] === "group=" || parts[7] === "group=",
    hasTaskbone: parts[4] === "taskbone" || parts[7] === "taskbone",
    hasArearef: parts[4] === "area=" || parts[7] === "area=",
    hasFrameref: parts[4] === "frame=" || parts[7] === "frame=",
    hasClippedFrameref:
      parts[4] === "clippedframe=" || parts[7] === "clippedframe=",
    blockref: parts[5],
    hasSectionref: Boolean(parts[6]),
    sectionref: parts[8],
    linkpartReference: parts[2],
    linkpartAlias: parts[9],
  };
}

export function isImagePartRef(parts: FILENAMEPARTS): boolean {
  return (
    parts.hasGroupref ||
    parts.hasArearef ||
    parts.hasFrameref ||
    parts.hasClippedFrameref
  );
}

export function fragWithHTML(html: string) {
  return createFragment((frag) => frag.appendChild(sanitizedFragment(html)));
}

export async function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**REACT 18 
  //see also: https://github.com/zsviczian/obsidian-excalidraw-plugin/commit/b67d70c5196f30e2968f9da919d106ee66f2a5eb
  //https://github.com/zsviczian/obsidian-excalidraw-plugin/commit/cc9d7828c7ee7755c1ef942519c43df32eae249f
export const awaitNextAnimationFrame = async () => new Promise(requestAnimationFrame);
*/

//export const debug = function(){};

export function _getContainerElement(
  element:
    | (ExcalidrawElement & { containerId: ExcalidrawElement["id"] | null })
    | null,
  scene: SceneWithElements | null,
) {
  if (!element || !scene?.elements || element.type !== "text") {
    return null;
  }
  if (element.containerId) {
    return (
      getContainerElement(element, arrayToMap(scene.elements) as ElementsMap) ??
      null
    );
    //return scene.elements.find((el:ExcalidrawElement)=>el.id === element.containerId) ?? null;
  }
  return null;
}

/**
 * Transforms array of objects containing `id` attribute,
 * or array of ids (strings), into a Map, keyd by `id`.
 */
export function arrayToMap<T extends { id: string } | string>(
  items: readonly T[] | Map<string, T>,
) {
  if (items instanceof Map) {
    return items;
  }
  return items.reduce((acc: Map<string, T>, element) => {
    acc.set(typeof element === "string" ? element : element.id, element);
    return acc;
  }, new Map());
}

export function updateFrontmatterInString(
  data: string,
  keyValuePairs?: [string, string][],
): string {
  if (!data || !keyValuePairs) {
    return data;
  }
  for (const kvp of keyValuePairs) {
    const r = new RegExp(`${kvp[0]}:\\s.*\\n`, "g");
    data = data.match(r)
      ? data.replaceAll(r, `${kvp[0]}: ${kvp[1]}\n`)
      : data.replace(/^---\n/, `---\n${kvp[0]}: ${kvp[1]}\n`);
  }
  return data;
}

function isHyperLink(link: string) {
  return (
    link &&
    !link.includes("\n") &&
    !link.includes("\r") &&
    link.match(/^https?:(\d*)?\/\/[^\s]*$/)
  );
}

export function isContainer(el: ExcalidrawElement) {
  return (
    el.type !== "arrow" && el.boundElements?.map((e) => e.type).includes("text")
  );
}

export function hyperlinkIsImage(data: string): boolean {
  if (!isHyperLink(data)) {
    return false;
  }
  const corelink = data.split("?")[0];
  return IMAGE_TYPES.contains(
    corelink.substring(corelink.lastIndexOf(".") + 1),
  );
}

export function getFilePathFromObsidianURL(data: string): string {
  if (!data) {
    return null;
  }
  if (!data.startsWith("obsidian://")) {
    return null;
  }

  try {
    const url = new URL(data);
    const fileParam = url.searchParams.get("file");
    if (!fileParam) {
      return null;
    }

    return decodeURIComponent(fileParam);
  } catch {
    return null;
  }
}

export function obsidianURLIsImage(data: string): boolean {
  if (!data) {
    return false;
  }
  if (!data.startsWith("obsidian://")) {
    return false;
  }

  try {
    const url = new URL(data);
    const fileParam = url.searchParams.get("file");
    if (!fileParam) {
      return false;
    }

    const decodedFile = decodeURIComponent(fileParam);
    const lastDotIndex = decodedFile.lastIndexOf(".");
    if (lastDotIndex === -1) {
      return false;
    }

    const extension = decodedFile.substring(lastDotIndex + 1);
    return IMAGE_TYPES.contains(extension);
  } catch {
    return false;
  }
}

export function hyperlinkIsYouTubeLink(link: string): boolean {
  return (
    isHyperLink(link) &&
    (link.startsWith(URLs.YOUTU_BE) ||
      link.startsWith(URLs.WWW_YOUTUBE_COM) ||
      link.startsWith(URLs.YOUTUBE_COM) ||
      link.startsWith("https//www.youtu.be")) &&
    link.match(/(youtu.be\/|v=)([^?/&]*)/) !== null
  );
}

export async function getYouTubeThumbnailLink(
  youtubelink: string,
): Promise<string> {
  //https://stackoverflow.com/questions/2068344/how-do-i-get-a-youtube-video-thumbnail-from-the-youtube-api
  //https://youtu.be/z8UkHGpykYU?t=60
  //https://www.youtube.com/watch?v=z8UkHGpykYU&ab_channel=VerbaltoVisual
  const parsed = youtubelink.match(/(youtu.be\/|v=)([^?/&]*)/);
  if (!parsed || !parsed[2]) {
    return null;
  }
  const videoId = parsed[2];

  let url = `${URLs.I_YTIMG_COM}/${videoId}/maxresdefault.jpg`;
  let response = await requestUrl({
    url,
    method: "get",
    contentType: "image/jpeg",
    throw: false,
  });
  if (response && response.status === 200) {
    return url;
  }

  url = `${URLs.I_YTIMG_COM}/${videoId}/hq720.jpg`;
  response = await requestUrl({
    url,
    method: "get",
    contentType: "image/jpeg",
    throw: false,
  });
  if (response && response.status === 200) {
    return url;
  }

  url = `${URLs.I_YTIMG_COM}/${videoId}/mqdefault.jpg`;
  response = await requestUrl({
    url,
    method: "get",
    contentType: "image/jpeg",
    throw: false,
  });
  if (response && response.status === 200) {
    return url;
  }

  return `${URLs.I_YTIMG_COM}/${videoId}/default.jpg`;
}

export function isCallerFromTemplaterPlugin(stackTrace: string) {
  const lines = stackTrace.split("\n");
  for (const line of lines) {
    if (line.trim().startsWith("at Templater.")) {
      return true;
    }
  }
  return false;
}

export function convertSVGStringToElement(svg: string): SVGSVGElement {
  const parser = new DOMParser();
  const doc = parser.parseFromString(makeEntitiesXmlSafe(svg), "image/svg+xml");

  if (doc.querySelector("parsererror")) {
    return;
  }

  const root = doc.documentElement;
  if (isInstanceOfSVGSVGElement(root)) {
    return root;
  }

  const nestedSvg = doc.querySelector("svg");
  if (isInstanceOfSVGSVGElement(nestedSvg)) {
    return nestedSvg;
  }
}

export function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

export function addYouTubeThumbnail(
  containerEl: HTMLElement,
  link: string,
  startAt?: number,
  style: string = "settings",
) {
  const wrapper = containerEl.createDiv({
    cls: `excalidraw-videoWrapper ${style}`,
  });

  const thumbnailUrl = `https://i.ytimg.com/vi/${link}/maxresdefault.jpg`;

  const anchor = wrapper.createEl("a", {
    attr: {
      href: `https://www.youtube.com/watch?v=${
        link
      }${startAt ? `&t=${startAt}` : ""}`,
      target: "_blank",
      rel: "noopener noreferrer",
    },
  });

  anchor.createEl("img", {
    attr: {
      src: thumbnailUrl || `https://i.ytimg.com/vi/${link}/default.jpg`,
      alt: "YouTube video thumbnail",
      style: "width: 100%; height: auto; cursor: pointer;",
    },
  });
}

export interface FontMetrics {
  unitsPerEm: 1000 | 1024 | 2048;
  ascender: number;
  descender: number;
  lineHeight: number;
  fontName: string;
}

export async function getFontMetrics(
  fontUrl: string,
  name: string,
): Promise<FontMetrics | null> {
  try {
    const font = await opentype.load(fontUrl);
    const unitsPerEm = font.unitsPerEm as 1000 | 1024 | 2048;
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
    console.error("Error loading font:", error);
    return null;
  }
}

// Thanks https://stackoverflow.com/a/54555834
export function cropCanvas(
  srcCanvas: HTMLCanvasElement,
  crop: { left: number; top: number; width: number; height: number },
  output: { width: number; height: number } = {
    width: crop.width,
    height: crop.height,
  },
) {
  const dstCanvas = createEl("canvas");
  dstCanvas.width = output.width;
  dstCanvas.height = output.height;
  dstCanvas
    .getContext("2d")
    .drawImage(
      srcCanvas,
      crop.left,
      crop.top,
      crop.width,
      crop.height,
      0,
      0,
      output.width,
      output.height,
    );
  return dstCanvas;
}

// Promise.try, adapted from https://github.com/sindresorhus/p-try
export async function promiseTry<TValue, TArgs extends unknown[]>(
  fn: (...args: TArgs) => PromiseLike<TValue> | TValue,
  ...args: TArgs
): Promise<TValue> {
  return new Promise((resolve) => {
    resolve(fn(...args));
  });
}

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
    try {
      if (!this.pool) {
        return Promise.resolve(Object.values(this.entries));
      }

      const listener = (event: { data: { result: void | [number, T] } }) => {
        if (event.data.result) {
          // by default pool does not return the results, so we are gathering them manually
          // with the correct call order (represented by the index in the tuple)
          const [index, value] = event.data.result;
          this.entries[index] = value;
        }
      };

      this.pool.addEventListener("fulfilled", listener);

      return Promise.resolve(this.pool.start()).then(
        () => {
          window.setTimeout(() => {
            this.pool?.removeEventListener("fulfilled", listener);
          });
          return Object.values(this.entries);
        },
        () => {
          this.pool?.removeEventListener("fulfilled", listener);
          // return partial results if the pool was aborted/destroyed
          return Object.values(this.entries);
        },
      );
    } catch (error) {
      console.log("Error in PromisePool.all:", error);
      return Promise.resolve(Object.values(this.entries));
    }
  }
}
