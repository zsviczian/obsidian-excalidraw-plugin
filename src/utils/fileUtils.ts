import { DataURL } from "@zsviczian/excalidraw/types/excalidraw/types";
import {
  App,
  DataAdapter,
  loadPdfJs,
  MetadataCache,
  normalizePath,
  Notice,
  requestUrl,
  RequestUrlResponse,
  TAbstractFile,
  TFile,
  TFolder,
  Vault,
} from "obsidian";
import {
  DEVICE,
  EXCALIDRAW_PLUGIN,
  FRONTMATTER_KEYS,
  mainDocument,
  URLFETCHTIMEOUT,
} from "src/constants/constants";
import { ExcalidrawSettings } from "src/core/settings";
import { errorlog, getDataURL } from "./coreUtils";
import ExcalidrawPlugin from "src/core/main";
import {
  getAttachmentsFolderAndFilePath,
  splitFolderAndFilename,
} from "./pathUtils";
import type ExcalidrawView from "src/view/ExcalidrawView";
import { IMAGE_MIME_TYPES, MimeType } from "src/types/embeddedFileLoaderTypes";
import type { PdfJsDocumentProxy } from "src/types/pdfJsTypes";
import { setElementDisplay } from "./htmlUtils";
export { splitFolderAndFilename } from "./pathUtils";

type ImageExtension = keyof typeof IMAGE_MIME_TYPES;

type NodeFsDataAdapter = DataAdapter & {
  fs: {
    readFile(
      path: string,
      encoding: BufferEncoding,
      callback: (err: NodeJS.ErrnoException | null, data: string) => void,
    ): void;
    readFile(
      path: string,
      callback: (err: NodeJS.ErrnoException | null, data: Buffer) => void,
    ): void;
  };
};

/**
 * Download data as file from Obsidian, to store on local device
 * @param encoding
 * @param data
 * @param filename
 */
export const download = (
  encoding: string | null,
  data: string | ArrayBuffer | null,
  filename: string,
) => {
  if (typeof data !== "string") {
    return;
  }
  const element = mainDocument.createElement("a");
  element.setAttribute("href", (encoding ? `${encoding},` : "") + data);
  element.setAttribute("download", filename);
  setElementDisplay(element, "none");
  mainDocument.body.appendChild(element);
  element.click();
  mainDocument.body.removeChild(element);
};

/**
 * Generates the image filename based on the excalidraw filename
 * @param excalidrawPath - Full filepath of ExclidrawFile
 * @param newExtension - extension of IMG file in ".extension" format
 * @returns
 */
/*export function getIMGPathFromExcalidrawFile(
  excalidrawPath: string,
  newExtension: string,
): string {
  const isLegacyFile: boolean = excalidrawPath.endsWith(".excalidraw");
  const replaceExtension: string = isLegacyFile ? ".excalidraw" : ".md";
  return (
    excalidrawPath.substring(0, excalidrawPath.lastIndexOf(replaceExtension)) +
    newExtension
  );
}*/

/**
 * Generates the image filename based on the excalidraw filename
 * @param path - path to the excalidraw file
 * @param extension - extension without the preceeding "."
 * @returns
 */
export function getIMGFilename(path: string, extension: string): string {
  return `${path.substring(0, path.lastIndexOf("."))}.${extension}`;
}

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
    : filename.slice(filename.lastIndexOf("."));
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

export function getDrawingFilename(settings: ExcalidrawSettings): string {
  return (
    settings.drawingFilenamePrefix +
    (settings.drawingFilenameDateTime !== ""
      ? window.moment().format(settings.drawingFilenameDateTime)
      : "") +
    (settings.compatibilityMode
      ? ".excalidraw"
      : settings.useExcalidrawExtension
        ? ".excalidraw.md"
        : ".md")
  );
}

export function getEmbedFilename(
  notename: string,
  settings: ExcalidrawSettings,
): string {
  return (
    (settings.drawingEmbedPrefixWithFilename ? notename : "") +
    settings.drawingFilnameEmbedPostfix +
    (settings.drawingFilenameDateTime !== ""
      ? window.moment().format(settings.drawingFilenameDateTime)
      : "") +
    (settings.compatibilityMode
      ? ".excalidraw"
      : settings.useExcalidrawExtension
        ? ".excalidraw.md"
        : ".md")
  ).trim();
}

/**
 * Open or create a folderpath if it does not exist
 * @param folderpath
 */
export async function checkAndCreateFolder(
  folderpath: string,
): Promise<TFolder> {
  const vault = EXCALIDRAW_PLUGIN.app.vault;
  folderpath = normalizePath(folderpath);
  //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/658
  const folder = vault.getAbstractFileByPathInsensitive(folderpath);
  if (folder && folder instanceof TFolder) {
    return folder;
  }
  if (folder && folder instanceof TFile) {
    new Notice(
      `The folder cannot be created because it already exists as a file: ${folderpath}.`,
    );
  }
  return await vault.createFolder(folderpath);
}

export const getURLImageExtension = (url: string): string => {
  const corelink = url.split("?")[0];
  return corelink.substring(corelink.lastIndexOf(".") + 1);
};

export const getMimeType = (extension: string): MimeType => {
  if (IMAGE_MIME_TYPES.hasOwnProperty(extension)) {
    return IMAGE_MIME_TYPES[extension as ImageExtension];
  }
  switch (extension) {
    case "md":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
};

// Using fetch as primary for maximum compatibility with CORS/image endpoints.
// fetch is used here because requestUrl sometimes fails for certain endpoints (e.g. Firebase Storage, see comment below).
// This is a network request, not a vault or blob:app:// read.
const getFileFromURL = async (
  url: string,
  mimeType: MimeType,
  timeout: number = URLFETCHTIMEOUT,
): Promise<RequestUrlResponse> => {
  try {
    const timeoutPromise = new Promise<Response>((resolve) =>
      window.setTimeout(() => resolve(null), timeout),
    );

    // fetch is used here for broad compatibility with image endpoints, including those that fail with requestUrl.
    const response = await Promise.race([
      fetch(url, { mode: "no-cors" }), // CORS error cannot be caught
      timeoutPromise,
    ]);

    if (!response) {
      errorlog({
        where: getFileFromURL,
        message: `URL did not load within the timeout period of ${timeout}ms.\n\nTry force-saving again in a few seconds.\n\n${url}`,
        url,
      });
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();

    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      arrayBuffer,
      json: null,
      text: null,
    };
  } catch (_) {
    //errorlog({ where: getFileFromURL, message: e.message, url: url });
    return null;
  }
};

// Using requestUrl as a fallback for endpoints where fetch fails (e.g. CORS/network restrictions).
// This is a network request, not a vault or blob:app:// read.
// Note: requestUrl sometimes fails for Firebase Storage and similar endpoints (see above), so fetch is preferred as primary.
// example: https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2FJSG%2FfTMP6WGQRC.png?alt=media&token=6d2993b4-e629-46b6-98d1-133af7448c49
const getFileFromURLFallback = async (
  url: string,
  mimeType: MimeType,
  timeout: number = URLFETCHTIMEOUT,
): Promise<RequestUrlResponse> => {
  try {
    const timeoutPromise = new Promise<RequestUrlResponse | null>((resolve) =>
      window.setTimeout(() => resolve(null), timeout),
    );

    return await Promise.race([
      timeoutPromise,
      requestUrl({ url, throw: false }), // if method: "get" is added it won't load images on Android, contentType: mimeType
    ]);
  } catch (_) {
    errorlog({
      where: getFileFromURLFallback,
      message: `URL did not load within timeout period of ${timeout}ms`,
      url,
    });
    return null;
  }
};

export const getDataURLFromURL = async (
  url: string,
  mimeType: MimeType,
  timeout: number = URLFETCHTIMEOUT,
): Promise<DataURL> => {
  let response = await getFileFromURL(url, mimeType, timeout);
  if (!response || response?.status !== 200) {
    response = await getFileFromURLFallback(url, mimeType, timeout);
  }
  return response && response.status === 200
    ? await getDataURL(response.arrayBuffer, mimeType)
    : (url as DataURL);
};

/*
const timeoutPromise = (timeout: number) => {
  return new Promise<never>((_, reject) =>
    window.setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
  );
};

export const getDataURLFromURL = async (
  url: string,
  mimeType: MimeType,
  timeout: number = URLFETCHTIMEOUT
): Promise<DataURL> => {
  return Promise.race([
    new Promise<DataURL>((resolve, reject) => {
      const img = new Image();

      // Add an 'onload' event listener to handle image loading success
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Canvas context is not supported.'));
          return;
        }

        // Draw the image on the canvas.
        ctx.drawImage(img, 0, 0);

        // Get the image data from the canvas.
        const dataURL = canvas.toDataURL(mimeType) as DataURL;
        resolve(dataURL);
      };

      // Add an 'onerror' event listener to handle image loading failure
      img.onerror = () => {
        reject(new Error('Failed to load image: ' + url));
      };

      // Set the 'src' attribute to the image URL to start loading the image.
      img.src = url;
    }),
    timeoutPromise(timeout)
  ]);
};*/

export const blobToBase64 = async (blob: Blob): Promise<string> => {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const arrayBufferToBase64 = (arrayBuffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
};

export const getPDFDoc = async (f: TFile): Promise<PdfJsDocumentProxy> => {
  if (typeof window.pdfjsLib === "undefined") {
    await loadPdfJs();
  }

  const pdfjs = window.pdfjsLib;
  const url = EXCALIDRAW_PLUGIN.app.vault.getResourcePath(f);

  const workerSrc = pdfjs.GlobalWorkerOptions.workerSrc;
  const workerDir = workerSrc?.replace(/pdf\.worker(\.min)?\.m?js$/, "");
  const wasmUrl = workerDir ? `${workerDir}wasm/` : undefined;

  return await pdfjs.getDocument({
    url,
    wasmUrl,
    cMapUrl: "/lib/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/lib/pdfjs/standard_fonts/",
    iccUrl: "/lib/pdfjs/iccs/",
  }).promise;
};

export const readLocalFile = async (filePath: string): Promise<string> => {
  if (!DEVICE.isDesktop) {
    return null;
  }
  return new Promise((resolve, reject) => {
    const adapter = app.vault.adapter as NodeFsDataAdapter;
    adapter.fs.readFile(filePath, "utf8", (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

export const readLocalFileBinary = async (
  filePath: string,
): Promise<ArrayBuffer> => {
  if (!DEVICE.isDesktop) {
    return null;
  }
  return new Promise((resolve, reject) => {
    const path = decodeURI(filePath);
    const adapter = app.vault.adapter as NodeFsDataAdapter;
    adapter.fs.readFile(path, (err, data) => {
      if (err) {
        reject(err);
      } else {
        const arrayBuffer = data.buffer.slice(
          data.byteOffset,
          data.byteOffset + data.byteLength,
        ) as ArrayBuffer;
        resolve(arrayBuffer);
      }
    });
  });
};

export const getPathWithoutExtension = (f: TFile): string => {
  if (!f) {
    return null;
  }
  return f.path.substring(0, f.path.lastIndexOf("."));
};

let _VAULT_BASE_URL: string = null;
const VAULT_BASE_URL = () => {
  if (_VAULT_BASE_URL) {
    return _VAULT_BASE_URL;
  }
  _VAULT_BASE_URL = DEVICE.isDesktop
    ? EXCALIDRAW_PLUGIN.app.vault.adapter.url
        .pathToFileURL(EXCALIDRAW_PLUGIN.app.vault.adapter.basePath)
        .toString()
    : "";
  return _VAULT_BASE_URL;
};

export const getInternalLinkOrFileURLLink = (
  path: string,
  plugin: ExcalidrawPlugin,
  alias?: string,
  sourceFile?: TFile,
): { link: string; isInternal: boolean; file?: TFile; url?: string } => {
  if (!DEVICE.isDesktop) {
    //I've not tested this... don't even know if external drag and drop works on mobile
    //Added this for safety
    return { link: `[${alias ?? ""}](${path})`, isInternal: false, url: path };
  }
  const vault = plugin.app.vault;
  const fileURLString = vault.adapter.url.pathToFileURL(path).toString();
  if (fileURLString.startsWith(VAULT_BASE_URL())) {
    const internalPath = normalizePath(
      decodeURIComponent(fileURLString.substring(VAULT_BASE_URL().length)),
    );
    const file = vault.getAbstractFileByPath(internalPath);
    if (file && file instanceof TFile) {
      const link = plugin.app.metadataCache.fileToLinktext(
        file,
        sourceFile?.path,
        true,
      );
      return {
        link: getLink(plugin, { embed: false, path: link, alias }),
        isInternal: true,
        file,
      };
    }
  }
  return {
    link: `[${alias ?? ""}](${fileURLString})`,
    isInternal: false,
    url: fileURLString,
  };
};

/**
 * get markdown or wiki link
 * @param plugin
 * @param param1: { embed = true, path, alias }
 * @returns
 */
export const getLink = (
  plugin: ExcalidrawPlugin,
  {
    embed = true,
    path,
    alias,
  }: { embed?: boolean; path: string; alias?: string },
  wikilinkOverride?: boolean,
): string => {
  const isWikiLink =
    typeof wikilinkOverride !== "undefined"
      ? wikilinkOverride
      : plugin.settings.embedWikiLink;
  return isWikiLink
    ? `${embed ? "!" : ""}[[${path}${alias ? `|${alias}` : ""}]]`
    : `${embed ? "!" : ""}[${alias ?? ""}](${encodeURI(path)})`;
};

export const getAliasWithSize = (alias: string, size: string): string => {
  if (alias && alias !== "") {
    return `${alias}${size ? `|${size}` : ""}`;
  }
  return size;
};

export const getCropFileNameAndFolder = async (
  plugin: ExcalidrawPlugin,
  hostPath: string,
  baseNewFileName: string,
): Promise<{ folderpath: string; filename: string }> => {
  const prefix = plugin.settings.cropPrefix || "";
  const suffix = plugin.settings.cropSuffix || "";
  const filename = `${prefix + baseNewFileName + suffix}.md`;
  if (!plugin.settings.cropFolder || plugin.settings.cropFolder.trim() === "") {
    const folderpath = (
      await getAttachmentsFolderAndFilePath(plugin.app, hostPath, filename)
    ).folder;
    return { folderpath, filename };
  }
  const folderpath = normalizePath(plugin.settings.cropFolder);
  await checkAndCreateFolder(folderpath);
  return { folderpath, filename };
};

export const getAnnotationFileNameAndFolder = async (
  plugin: ExcalidrawPlugin,
  hostPath: string,
  baseNewFileName: string,
): Promise<{ folderpath: string; filename: string }> => {
  const prefix = plugin.settings.annotatePrefix || "";
  const suffix = plugin.settings.annotateSuffix || "";
  const filename = `${prefix + baseNewFileName + suffix}.md`;
  if (
    !plugin.settings.annotateFolder ||
    plugin.settings.annotateFolder.trim() === ""
  ) {
    const folderpath = (
      await getAttachmentsFolderAndFilePath(plugin.app, hostPath, filename)
    ).folder;
    return { folderpath, filename };
  }
  const folderpath = normalizePath(plugin.settings.annotateFolder);
  await checkAndCreateFolder(folderpath);
  return { folderpath, filename };
};

export const getListOfTemplateFiles = (
  plugin: ExcalidrawPlugin,
): TFile[] | null => {
  const normalizedTemplatePath = normalizePath(
    plugin.settings.templateFilePath,
  );
  const template = plugin.app.vault.getAbstractFileByPath(
    normalizedTemplatePath,
  );
  if (template && template instanceof TFolder) {
    return plugin.app.vault
      .getFiles()
      .filter((f) => f.path.startsWith(template.path))
      .filter((f) => plugin.isExcalidrawFile(f))
      .sort((a, b) => a.path.localeCompare(b.path));
  }
  if (template && template instanceof TFile) {
    return [template];
  }
  const templateFile = plugin.app.metadataCache.getFirstLinkpathDest(
    normalizedTemplatePath,
    "",
  );
  if (templateFile) {
    return [templateFile];
  }
  return null;
};

export const fileShouldDefaultAsExcalidraw = (
  path: string,
  app: App,
): boolean => {
  if (!path) {
    return false;
  }
  const cache = app.metadataCache.getCache(path);
  return (
    cache?.frontmatter &&
    cache.frontmatter[FRONTMATTER_KEYS.plugin.name] &&
    !cache.frontmatter[FRONTMATTER_KEYS["open-as-markdown"].name]
  );
};

export const getExcalidrawEmbeddedFilesFiletree = (
  sourceFile: TFile,
  plugin: ExcalidrawPlugin,
): TFile[] => {
  if (!sourceFile || !plugin.isExcalidrawFile(sourceFile)) {
    return [];
  }

  const fileList = new Set<TFile>();
  const app = plugin.app;

  const addAttachedImages = (f: TFile) =>
    Object.keys(app.metadataCache.resolvedLinks[f.path]).forEach((path) => {
      const file = app.vault.getAbstractFileByPath(path);
      if (!file || !(file instanceof TFile)) {
        return;
      }
      const isExcalidraw = plugin.isExcalidrawFile(file);
      if (
        (file.extension === "md" && !isExcalidraw) ||
        fileList.has(file) //avoid infinite loops
      ) {
        return;
      }
      fileList.add(file);
      if (isExcalidraw) {
        addAttachedImages(file);
      }
    });

  addAttachedImages(sourceFile);
  return Array.from(fileList);
};

export const hasExcalidrawEmbeddedImagesTreeChanged = (
  sourceFile: TFile,
  mtime: number,
  plugin: ExcalidrawPlugin,
): boolean => {
  if (!sourceFile || !plugin.isExcalidrawFile(sourceFile)) {
    return false;
  }

  const visited = new Set<TFile>();
  const stack: TFile[] = [sourceFile];
  const app = plugin.app;

  while (stack.length > 0) {
    const currentFile = stack.pop();
    const resolvedLinks = app.metadataCache.resolvedLinks[currentFile.path];
    if (!resolvedLinks) {
      continue;
    }

    const paths = Object.keys(resolvedLinks);
    for (let i = paths.length - 1; i >= 0; i--) {
      const file = app.vault.getAbstractFileByPath(paths[i]);
      if (!file || !(file instanceof TFile)) {
        continue;
      }

      const isExcalidraw = plugin.isExcalidrawFile(file);
      if ((file.extension === "md" && !isExcalidraw) || visited.has(file)) {
        continue;
      }

      visited.add(file);
      if (file.stat.mtime > mtime) {
        return true;
      }

      if (isExcalidraw) {
        stack.push(file);
      }
    }
  }

  return false;
};

export async function exportImageToFile(
  view: ExcalidrawView,
  path: string,
  content: string | ArrayBuffer | Blob,
  extension: string,
): Promise<TFile> {
  const ea = view?.getHookServer();
  if (ea?.onImageExportPathHook) {
    try {
      path =
        ea.onImageExportPathHook({
          exportFilepath: path,
          exportExtension: extension,
          excalidrawFile: view.file,
          action: "export",
        }) ?? path;
    } catch (e) {
      errorlog({
        where: "fileUtils.exportImageToFile",
        fn: ea.onImageExportPathHook,
        error: e,
      });
    }
  }
  return await createOrOverwriteFile(view.app, path, content);
}

export async function importFileToVault(
  app: App,
  fname: string,
  content: string | ArrayBuffer | Blob,
  excalidrawFile: TFile,
  view?: ExcalidrawView,
): Promise<TFile> {
  let hookFilepath: string;
  const ea = view?.getHookServer();
  if (ea?.onImageFilePathHook) {
    try {
      hookFilepath = ea.onImageFilePathHook({
        currentImageName: fname,
        drawingFilePath: excalidrawFile.path,
      });
    } catch (e) {
      errorlog({
        where: "fileUtils.importFileToVault",
        fn: ea.onImageFilePathHook,
        error: e,
      });
    }
  }

  let filepath: string;
  if (hookFilepath) {
    const { folderpath, filename } = splitFolderAndFilename(hookFilepath);
    await checkAndCreateFolder(folderpath);
    filepath = getNewUniqueFilepath(app.vault, filename, folderpath);
  } else {
    const { folder } = await getAttachmentsFolderAndFilePath(
      app,
      excalidrawFile.path,
      fname,
    );
    filepath = getNewUniqueFilepath(app.vault, fname, folder);
  }

  return await createOrOverwriteFile(app, filepath, content);
}

export async function createOrOverwriteFile(
  app: App,
  path: string,
  content: string | ArrayBuffer | Blob,
): Promise<TFile> {
  const { folderpath } = splitFolderAndFilename(path);
  if (folderpath) {
    await checkAndCreateFolder(folderpath);
  }
  const file = app.vault.getAbstractFileByPath(normalizePath(path));
  if (content instanceof Blob) {
    content = await content.arrayBuffer();
  }
  if (content instanceof ArrayBuffer) {
    if (file && file instanceof TFile) {
      await app.vault.modifyBinary(file, content);
      return file;
    }
    return await app.vault.createBinary(path, content);
  }

  if (file && file instanceof TFile) {
    await app.vault.modify(file, content);
    return file;
  }
  return await app.vault.create(path, content);
}

export async function createFileAndAwaitMetacacheUpdate(
  app: App,
  path: string,
  content: string | ArrayBuffer | Blob,
): Promise<TFile> {
  path = normalizePath(path);
  let ready = false;
  const extension = path.substring(path.lastIndexOf(".") + 1);

  //metadataCache.on("changed", (file:TFile) => void) does not fire for non-markdown files
  if (extension === "md") {
    const metaCache: MetadataCache = app.metadataCache;
    const handler = (file: TFile) => {
      if (file.path === path) {
        metaCache.off("changed", handler);
        ready = true;
      }
    };
    metaCache.on("changed", handler);

    const file = await createOrOverwriteFile(app, path, content);

    if (!file) {
      ready = true; //if file is null, it means it was not created, so we can skip waiting
      metaCache.off("changed", handler);
    }

    let attempts = 0;
    while (!ready && attempts++ < 15) {
      await sleep(50);
    }
    if (!ready) {
      metaCache.off("changed", handler); //if we timed out, remove the handler
    }
    return file;
  }
  return await createOrOverwriteFile(app, path, content);
}
