import { DataURL } from "@zsviczian/excalidraw/types/excalidraw/types";
import { loadPdfJs, normalizePath, Notice, requestUrl, RequestUrlResponse, TAbstractFile, TFile, TFolder, Vault } from "obsidian";
import { DEVICE, URLFETCHTIMEOUT } from "src/constants/constants";
import { IMAGE_MIME_TYPES, MimeType } from "src/EmbeddedFileLoader";
import { ExcalidrawSettings } from "src/settings";
import { errorlog, getDataURL } from "./Utils";
import ExcalidrawPlugin from "src/main";
import ExcalidrawView from "src/ExcalidrawView";
import { CROPPED_PREFIX } from "./CarveOut";
import { getAttachmentsFolderAndFilePath } from "./ObsidianUtils";

/**
 * Splits a full path including a folderpath and a filename into separate folderpath and filename components
 * @param filepath
 */
type ImageExtension = keyof typeof IMAGE_MIME_TYPES;

export function splitFolderAndFilename(filepath: string): {
  folderpath: string;
  filename: string;
  basename: string;
  extension: string;
} {
  const lastIndex = filepath.lastIndexOf("/");
  const filename = lastIndex == -1 ? filepath : filepath.substring(lastIndex + 1);
  return {
    folderpath: normalizePath(filepath.substring(0, lastIndex)),
    filename,
    basename: filename.replace(/\.[^/.]+$/, ""),
    extension: filename.substring(filename.lastIndexOf(".") + 1),
  };
}

/**
 * Download data as file from Obsidian, to store on local device
 * @param encoding
 * @param data
 * @param filename
 */
 export const download = (encoding: string, data: any, filename: string) => {
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
export async function checkAndCreateFolder(folderpath: string):Promise<TFolder> {
  const vault = app.vault;
  folderpath = normalizePath(folderpath);
  //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/658
  //@ts-ignore
  const folder = vault.getAbstractFileByPathInsensitive(folderpath);
  if (folder && folder instanceof TFolder) {
    return;
  }
  if (folder && folder instanceof TFile) {
    new Notice(`The folder cannot be created because it already exists as a file: ${folderpath}.`)
  }
  return await vault.createFolder(folderpath);
}

export const getURLImageExtension = (url: string):string => {
  const corelink = url.split("?")[0];
  return corelink.substring(corelink.lastIndexOf(".")+1);
} 

export const getMimeType = (extension: string):MimeType => {
  if(IMAGE_MIME_TYPES.hasOwnProperty(extension)) {
    return IMAGE_MIME_TYPES[extension as ImageExtension];
  };
  switch (extension) {
    case "md":   return "image/svg+xml";
    default:     return "application/octet-stream";
  }
}

// using fetch API
const getFileFromURL = async (url: string, mimeType: MimeType, timeout: number = URLFETCHTIMEOUT): Promise<RequestUrlResponse> => {
  try {
    const timeoutPromise = new Promise<Response>((resolve) =>
      setTimeout(() => resolve(null), timeout)
    );
    
    const response = await Promise.race([
      fetch(url, { mode: 'no-cors' }), //cors error cannot be caught
      timeoutPromise,
    ]);

    if (!response) {
      errorlog({ where: getFileFromURL, message: `URL did not load within the timeout period of ${timeout}ms.\n\nTry force-saving again in a few seconds.\n\n${url}`, url: url });
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();

    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      arrayBuffer: arrayBuffer,
      json: null,
      text: null,
    };
  } catch (e) {
    //errorlog({ where: getFileFromURL, message: e.message, url: url });
    return null;
  }
};

// using Obsidian requestUrl (this failed on a firebase link)
// https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2FJSG%2FfTMP6WGQRC.png?alt=media&token=6d2993b4-e629-46b6-98d1-133af7448c49
const getFileFromURLFallback = async (url: string, mimeType: MimeType, timeout: number = URLFETCHTIMEOUT):Promise<RequestUrlResponse> => {
  try {
    const timeoutPromise = new Promise<RequestUrlResponse | null>((resolve) =>
      setTimeout(() => resolve(null), timeout)
    );

    return await Promise.race([
      timeoutPromise,
      requestUrl({url: url, throw: false }), //if method: "get" is added it won't load images on Android, contentType: mimeType,
    ])
  } catch (e) {
    errorlog({where: getFileFromURLFallback, message: `URL did not load within timeout period of ${timeout}ms`, url: url});
    return null;
  }
}

export const getDataURLFromURL = async (url: string, mimeType: MimeType, timeout: number = URLFETCHTIMEOUT): Promise<DataURL> => {
  let response = await getFileFromURL(url, mimeType, timeout);
  if(!response || response?.status !== 200) {
    response = await getFileFromURLFallback(url, mimeType, timeout);
  }
  return response && response.status === 200
    ? await getDataURL(response.arrayBuffer, mimeType)
    : url as DataURL;
};

/*
const timeoutPromise = (timeout: number) => {
  return new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
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
  const arrayBuffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  let binary = '';
  let len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const getPDFDoc = async (f: TFile): Promise<any> => {
  //@ts-ignore
  if(typeof window.pdfjsLib === "undefined") await loadPdfJs();
  //@ts-ignore
  return await window.pdfjsLib.getDocument(app.vault.getResourcePath(f)).promise;
}

export const readLocalFile = async (filePath:string): Promise<string> => {
  if (!DEVICE.isDesktop) return null;
  return new Promise((resolve, reject) => {
    //@ts-ignore
    app.vault.adapter.fs.readFile(filePath, 'utf8', (err:any, data:any) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

export const readLocalFileBinary = async (filePath:string): Promise<ArrayBuffer> => {
  if (!DEVICE.isDesktop) return null;
  return new Promise((resolve, reject) => {
    const path = decodeURI(filePath);
    //@ts-ignore
    app.vault.adapter.fs.readFile(path, (err, data) => {
      if (err) {
        reject(err);
      } else {
        const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        resolve(arrayBuffer);
      }
    });
  });
}

export const getPathWithoutExtension = (f:TFile): string => {
  if(!f) return null;
  return f.path.substring(0, f.path.lastIndexOf("."));
}

const VAULT_BASE_URL = DEVICE.isDesktop
  ? app.vault.adapter.url.pathToFileURL(app.vault.adapter.basePath).toString()
  : "";
export const getInternalLinkOrFileURLLink = (
  path: string, plugin:ExcalidrawPlugin, alias?: string, sourceFile?: TFile
):{link: string, isInternal: boolean, file?: TFile, url?: string} => {
  if(!DEVICE.isDesktop) {
    //I've not tested this... don't even know if external drag and drop works on mobile
    //Added this for safety
    return {link: `[${alias??""}](${path})`, isInternal: false, url: path};  
  }
  const vault = plugin.app.vault;
  const fileURLString = vault.adapter.url.pathToFileURL(path).toString();
  if (fileURLString.startsWith(VAULT_BASE_URL)) {
    const internalPath = normalizePath(fileURLString.substring(VAULT_BASE_URL.length));
    const file = vault.getAbstractFileByPath(internalPath);
    if(file && file instanceof TFile) {
      const link = plugin.app.metadataCache.fileToLinktext(
        file,
        sourceFile?.path,
        true,
      );
      return {link: getLink(plugin, { embed: false, path: link, alias}), isInternal: true, file};
    };
  }
  return {link: `[${alias??""}](${fileURLString})`, isInternal: false, url: fileURLString};
}

/**
 * get markdown or wiki link
 * @param plugin 
 * @param param1: { embed = true, path, alias } 
 * @returns 
 */
export const getLink = ( 
  plugin: ExcalidrawPlugin,
  { embed = true, path, alias }: { embed?: boolean; path: string; alias?: string }
):string => {
  return plugin.settings.embedWikiLink
    ? `${embed ? "!" : ""}[[${path}${alias ? `|${alias}` : ""}]]`
    : `${embed ? "!" : ""}[${alias ?? ""}](${encodeURI(path)})`
}

export const getCropFileNameAndFolder = async (plugin: ExcalidrawPlugin, hostPath: string, baseNewFileName: string):Promise<{folderpath: string, filename: string}> => {
  let prefix = plugin.settings.cropPrefix;
  if(!prefix || prefix.trim() === "") prefix = CROPPED_PREFIX;
  const filename = prefix + baseNewFileName + ".md";
  if(!plugin.settings.cropFolder || plugin.settings.cropFolder.trim() === "") {
    const folderpath = (await getAttachmentsFolderAndFilePath(plugin.app, hostPath, filename)).folder;
    return {folderpath, filename};
  }
  const folderpath = normalizePath(plugin.settings.cropFolder);
  await checkAndCreateFolder(folderpath);
  return {folderpath, filename};
}