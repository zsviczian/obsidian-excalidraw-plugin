import Excalidraw,{exportToSvg} from "@zsviczian/excalidraw";
import {  App, normalizePath, TAbstractFile, TFile, TFolder, Vault, WorkspaceLeaf } from "obsidian";
import { Random } from "roughjs/bin/math";
import { DataURL, Zoom } from "@zsviczian/excalidraw/types/types";
import { nanoid } from "nanoid";
import { IMAGE_TYPES } from "./constants";
import {ExcalidrawAutomate} from './ExcalidrawAutomate';
import ExcalidrawPlugin from "./main";
import { ExcalidrawElement, FileId } from "@zsviczian/excalidraw/types/element/types";
import { ExportSettings } from "./ExcalidrawView";
import { ExcalidrawSettings } from "./settings";
import { html_beautify } from "js-beautify"

declare module "obsidian" {
  interface Workspace {
    getAdjacentLeafInDirection(leaf: WorkspaceLeaf, direction: string): WorkspaceLeaf;
  }
  interface Vault {
    getConfig(option:"attachmentFolderPath"): string;
  }
}

declare let window: ExcalidrawAutomate;

export declare type MimeType = "image/svg+xml" | "image/png" | "image/jpeg" | "image/gif" | "application/octet-stream";

/**
 * Splits a full path including a folderpath and a filename into separate folderpath and filename components
 * @param filepath 
 */
export function splitFolderAndFilename(filepath: string):{folderpath: string, filename: string} {
  let folderpath: string, filename:string;
  const lastIndex = filepath.lastIndexOf("/");
  return {
    folderpath: normalizePath(filepath.substr(0,lastIndex)), 
    filename: lastIndex==-1 ? filepath : filepath.substr(lastIndex+1),
  };
}

/**
 * Download data as file from Obsidian, to store on local device
 * @param encoding 
 * @param data 
 * @param filename 
 */
export function download(encoding:string,data:any,filename:string) {
  let element = document.createElement('a');
  element.setAttribute('href', (encoding ? encoding + ',' : '') + data);
  element.setAttribute('download', filename);
  element.style.display = 'none';
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
export function getIMGPathFromExcalidrawFile (excalidrawPath:string,newExtension:string):string {
  const isLegacyFile:boolean = excalidrawPath.endsWith(".excalidraw");
  const replaceExtension:string = isLegacyFile ? ".excalidraw" : ".md";
  return excalidrawPath.substring(0,excalidrawPath.lastIndexOf(replaceExtension)) + newExtension;   
}

/**
 * Create new file, if file already exists find first unique filename by adding a number to the end of the filename
 * @param filename 
 * @param folderpath 
 * @returns 
 */
 export function getNewUniqueFilepath(vault:Vault, filename:string, folderpath:string):string {      
  let fname = normalizePath(folderpath +'/'+ filename); 
  let file:TAbstractFile = vault.getAbstractFileByPath(fname);
  let i = 0;
  while(file) {
    fname = normalizePath(folderpath + '/' + filename.slice(0,filename.lastIndexOf("."))+"_"+i+filename.slice(filename.lastIndexOf(".")));
    i++;
    file = vault.getAbstractFileByPath(fname);
  }
  return fname;
}

/**
* Open or create a folderpath if it does not exist
* @param folderpath 
*/
export async function checkAndCreateFolder(vault:Vault,folderpath:string) {
  folderpath = normalizePath(folderpath);
  let folder = vault.getAbstractFileByPath(folderpath);
  if(folder && folder instanceof TFolder) return;
  await vault.createFolder(folderpath);
}

let random = new Random(Date.now());
export const randomInteger = () => Math.floor(random.next() * 2 ** 31);

//https://macromates.com/blog/2006/wrapping-text-with-regular-expressions/
export function wrapText(text:string, lineLen:number, forceWrap:boolean=false):string {
  if(!lineLen) return text;
  let outstring = "";
  if(forceWrap) {
    for(const t of text.split("\n")) {
      const v = t.match(new RegExp('(.){1,'+lineLen+'}','g'));
      outstring += v ? v.join("\n")+"\n" : "\n";
    }
    return outstring.replace(/\n$/, '');
  }

  //                       1                2            3        4
  const reg = new RegExp(`(.{1,${lineLen}})(\\s+|$\\n?)|([^\\s]+)(\\s+|$\\n?)`,'gm');
  const res = text.matchAll(reg);
  let parts;
  while(!(parts = res.next()).done) {
    outstring += parts.value[1] ? parts.value[1].trimEnd() : parts.value[3].trimEnd();
    const newLine1 = parts.value[2]?.includes("\n");
    const newLine2 = parts.value[4]?.includes("\n");
    if(newLine1) outstring += parts.value[2];
    if(newLine2) outstring += parts.value[4];
    if(!(newLine1 || newLine2)) outstring += "\n";
  }
  return outstring.replace(/\n$/, '');
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
    (pointX - centerX) * Math.cos(angle) - (pointY - centerY) * Math.sin(angle) + centerX,
    (pointX - centerX) * Math.sin(angle) + (pointY - centerY) * Math.cos(angle) + centerY,
  ];

export const rotatedDimensions = (
  element: ExcalidrawElement
): [number, number, number, number] => {
  if(element.angle===0) [element.x,element.y,element.width,element.height];
  const centerX = element.x+element.width/2;
  const centerY = element.y+element.height/2;
  const [left,top] = rotate(element.x,element.y,centerX,centerY,element.angle);  
  const [right,bottom] = rotate(element.x+element.width,element.y+element.height,centerX,centerY,element.angle);
  return [ 
           left<right ? left : right,
           top<bottom ? top : bottom,
           Math.abs(left-right),
           Math.abs(top-bottom)
         ];
}
   

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
  const x = (clientX - zoom.translation.x - offsetLeft) * invScale - scrollX;
  const y = (clientY - zoom.translation.y - offsetTop) * invScale - scrollY;
  return { x, y };
};

export const getNewOrAdjacentLeaf = (plugin: ExcalidrawPlugin, leaf: WorkspaceLeaf):WorkspaceLeaf => {
  if(plugin.settings.openInAdjacentPane) {
    let leafToUse = plugin.app.workspace.getAdjacentLeafInDirection(leaf, "right");
    if(!leafToUse){leafToUse = plugin.app.workspace.getAdjacentLeafInDirection(leaf, "left");}
    if(!leafToUse){leafToUse = plugin.app.workspace.getAdjacentLeafInDirection(leaf, "bottom");}
    if(!leafToUse){leafToUse = plugin.app.workspace.getAdjacentLeafInDirection(leaf, "top");}
    if(!leafToUse){leafToUse = plugin.app.workspace.createLeafBySplit(leaf);}
    return leafToUse;
  } 
  return plugin.app.workspace.createLeafBySplit(leaf);
}

export const getObsidianImage = async (app: App, file: TFile)
  :Promise<{
    mimeType: MimeType,
    fileId: FileId, 
    dataURL: DataURL,
    created: number,
    size: {height: number, width: number},
  }> => {
  if(!app || !file) return null;
  const isExcalidrawFile = window.ExcalidrawAutomate.isExcalidrawFile(file);
  if (!(IMAGE_TYPES.contains(file.extension) || isExcalidrawFile)) {
    return null;
  }
  const ab = await app.vault.readBinary(file);
  const excalidrawSVG = isExcalidrawFile
              ? svgToBase64((await window.ExcalidrawAutomate.createSVG(file.path,true)).outerHTML) as DataURL
              : null;
  let mimeType:MimeType = "image/svg+xml";
  if (!isExcalidrawFile) {
    switch (file.extension) {
      case "png": mimeType = "image/png";break;
      case "jpeg":mimeType = "image/jpeg";break;
      case "jpg": mimeType = "image/jpeg";break;
      case "gif": mimeType = "image/gif";break;
      case "svg": mimeType = "image/svg+xml";break;
      default: mimeType = "application/octet-stream";
    }
  } 
  return {
    mimeType: mimeType,
    fileId: await generateIdFromFile(ab),
    dataURL: excalidrawSVG ?? (file.extension==="svg" ? await getSVGData(app,file) : await getDataURL(ab)),
    created: file.stat.mtime,
    size: await getImageSize(app,excalidrawSVG??app.vault.getResourcePath(file))
  }
}


const getSVGData = async (app: App, file: TFile): Promise<DataURL> => {
  const svg = await app.vault.read(file);
  return svgToBase64(svg) as DataURL;
}

export const svgToBase64 = (svg:string):string => {
  return "data:image/svg+xml;base64,"+btoa(unescape(encodeURIComponent(svg.replaceAll("&nbsp;"," "))));
}
const getDataURL = async (file: ArrayBuffer): Promise<DataURL> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataURL = reader.result as DataURL;
      resolve(dataURL);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(new Blob([new Uint8Array(file)]));
  });
};

const generateIdFromFile = async (file: ArrayBuffer):Promise<FileId> => {
  let id: FileId;
  try {
    const hashBuffer = await window.crypto.subtle.digest(
      "SHA-1",
      file,
    );
    id =
      // convert buffer to byte array
      Array.from(new Uint8Array(hashBuffer))
        // convert to hex string
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("") as FileId;
  } catch (error) {
    console.error(error);
    id = nanoid(40) as FileId;
  }
  return id;
};

const getImageSize = async (app: App, src:string):Promise<{height:number, width:number}> => {
  return new Promise((resolve, reject) => {
    let img = new Image()
    img.onload = () => resolve({height: img.height, width:img.width});
    img.onerror = reject;
    img.src = src;
    })
}

export const getBinaryFileFromDataURL = (dataURL:string):ArrayBuffer => {
  if(!dataURL) return null;
  const parts = dataURL.matchAll(/base64,(.*)/g).next();
  const binary_string = window.atob(parts.value[1]);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;  
}

export const getAttachmentsFolderAndFilePath = async (app:App, activeViewFilePath:string, newFileName:string):Promise<[string,string]> => {
  let folder = app.vault.getConfig("attachmentFolderPath");
  // folder == null: save to vault root
  // folder == "./" save to same folder as current file
  // folder == "folder" save to specific folder in vault
  // folder == "./folder" save to specific subfolder of current active folder
  if(folder && folder.startsWith("./")) { // folder relative to current file
      const activeFileFolder = splitFolderAndFilename(activeViewFilePath).folderpath + "/";
      folder = normalizePath(activeFileFolder + folder.substring(2));
  }
  if(!folder) folder = "";
  await checkAndCreateFolder(app.vault,folder);
  return [folder,normalizePath(folder + "/" + newFileName)];
}

export const getSVG = async (scene:any, exportSettings:ExportSettings):Promise<SVGSVGElement> => {
  try {
    return exportToSvg({
      elements: scene.elements,
      appState: {
        exportBackground: exportSettings.withBackground,
        exportWithDarkMode: exportSettings.withTheme ? (scene.appState?.theme=="light" ? false : true) : false,
        ... scene.appState,},
      files: scene.files,
      exportPadding:10,
    });
  } catch (error) {
    return null;
  }
}

export const generateSVGString = async (scene:any, settings: ExcalidrawSettings):Promise<string> => {
  const exportSettings: ExportSettings = {
    withBackground: settings.exportWithBackground, 
    withTheme: settings.exportWithTheme
  }
  const svg = await getSVG(scene,exportSettings);
  if(svg) {
    
    return html_beautify(svg.outerHTML,{"indent_with_tabs": true});
  }
  return null;
}

export const getPNG = async (scene:any, exportSettings:ExportSettings, scale:number = 1) => {
  try {
    return await Excalidraw.exportToBlob({
        elements: scene.elements,
        appState: {
          exportBackground: exportSettings.withBackground,
          exportWithDarkMode: exportSettings.withTheme ? (scene.appState?.theme=="light" ? false : true) : false,
          ... scene.appState,},
        files: scene.files,
        mimeType: "image/png",
        exportWithDarkMode: "true",
        metadata: "Generated by Excalidraw-Obsidian plugin",
        getDimensions: (width:number, height:number) => ({ width:width*scale, height:height*scale, scale:scale })
    });
  } catch (error) {
    return null;
  }
}