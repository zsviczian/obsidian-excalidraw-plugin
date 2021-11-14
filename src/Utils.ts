import Excalidraw,{exportToSvg} from "@zsviczian/excalidraw";
import {  App, normalizePath, TAbstractFile, TFile, TFolder, Vault, WorkspaceLeaf } from "obsidian";
import { Random } from "roughjs/bin/math";
import { BinaryFileData, DataURL, Zoom } from "@zsviczian/excalidraw/types/types";
import { CASCADIA_FONT, fileid, IMAGE_TYPES, VIRGIL_FONT } from "./constants";
import ExcalidrawPlugin from "./main";
import { ExcalidrawElement, FileId } from "@zsviczian/excalidraw/types/element/types";
import ExcalidrawView, { ExportSettings } from "./ExcalidrawView";
import { ExcalidrawSettings } from "./settings";
import { html_beautify } from "js-beautify";
import html2canvas from "html2canvas";
import { ExcalidrawData } from "./ExcalidrawData";

declare module "obsidian" {
  interface Workspace {
    getAdjacentLeafInDirection(leaf: WorkspaceLeaf, direction: string): WorkspaceLeaf;
  }
  interface Vault {
    getConfig(option:"attachmentFolderPath"): string;
  }
}

declare let window: any;

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

export const getObsidianImage = async (plugin: ExcalidrawPlugin, file: TFile)
  :Promise<{
      mimeType: MimeType,
      fileId: FileId, 
      dataURL: DataURL,
      created: number,
    size: {height: number, width: number},
  }> => {
  if(!plugin || !file) return null;
  const app = plugin.app;
  const isExcalidrawFile = plugin.ea.isExcalidrawFile(file);
  if (!(IMAGE_TYPES.contains(file.extension) || isExcalidrawFile)) {
    return null;
  }
  const ab = await app.vault.readBinary(file);

  const getExcalidrawSVG = async () => {
    const exportSettings:ExportSettings = {
      withBackground: false,
      withTheme: false
    };
    plugin.ea.reset();
    return svgToBase64((await plugin.ea.createSVG(file.path,true,exportSettings)).outerHTML) as DataURL;
  }
  
  const excalidrawSVG = isExcalidrawFile
              ? await getExcalidrawSVG()
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
      size: await getImageSize(excalidrawSVG??app.vault.getResourcePath(file))
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
    id = fileid() as FileId;
  }
  return id;
};

const getImageSize = async (src:string):Promise<{height:number, width:number}> => {
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

export const embedFontsInSVG = (svg:SVGSVGElement):SVGSVGElement => {
  //replace font references with base64 fonts
  const includesVirgil = svg.querySelector("text[font-family^='Virgil']") != null;
  const includesCascadia = svg.querySelector("text[font-family^='Cascadia']") != null; 
  const defs = svg.querySelector("defs");
  if (defs && (includesCascadia || includesVirgil)) {
    defs.innerHTML = "<style>" + (includesVirgil ? VIRGIL_FONT : "") + (includesCascadia ? CASCADIA_FONT : "")+"</style>";
  }
  return svg;
}


export const loadSceneFiles = async (
  plugin:ExcalidrawPlugin, 
  excalidrawData: ExcalidrawData,
  view: ExcalidrawView,
  addFiles:Function, 
  sourcePath:string
) => {
  const app = plugin.app;
  let entries = excalidrawData.getFileEntries(); 
  let entry;
  let files:BinaryFileData[] = [];
  while(!(entry = entries.next()).done) {
    const file = app.metadataCache.getFirstLinkpathDest(entry.value[1],sourcePath);
    if(file && file instanceof TFile) {
      const data = await getObsidianImage(plugin,file);
      files.push({
        mimeType : data.mimeType,
        id: entry.value[0],
        dataURL: data.dataURL,
        created: data.created,
        //@ts-ignore
        size: data.size,
      });
    }
  }

  entries = excalidrawData.getEquationEntries(); 
  while(!(entry = entries.next()).done) {
    const tex = entry.value[1];
    const data = await tex2dataURL(tex, plugin);
    if(data) {
      files.push({
        mimeType : data.mimeType,
        id: entry.value[0],
        dataURL: data.dataURL,
        created: data.created,
        //@ts-ignore
        size: data.size,
      });
    }
  }

  try { //in try block because by the time files are loaded the user may have closed the view
    addFiles(files,view);
  } catch(e) {

  }
}

export const updateEquation = async (
  equation: string,
  fileId: string,
  view: ExcalidrawView,
  addFiles:Function,
  plugin: ExcalidrawPlugin
) => {
  const data = await tex2dataURL(equation, plugin);
  if(data) {
    let files:BinaryFileData[] = [];
    files.push({
      mimeType : data.mimeType,
      id: fileId as FileId,
      dataURL: data.dataURL,
      created: data.created,
      //@ts-ignore
      size: data.size,
    });
    addFiles(files,view);
  }
}

export const scaleLoadedImage = (scene:any, files:any):[boolean,any] => {
  let dirty = false;
  for(const f of files) {
    const [w_image,h_image] = [f.size.width,f.size.height];
    const imageAspectRatio = f.size.width/f.size.height;
    scene
    .elements
    .filter((e:any)=>(e.type === "image" && e.fileId === f.id))
    .forEach((el:any)=>{
      const [w_old,h_old] = [el.width,el.height];
      const elementAspectRatio = w_old/h_old;
      if(imageAspectRatio != elementAspectRatio) {
        dirty = true;
        const h_new = Math.sqrt(w_old*h_old*h_image/w_image);
        const w_new = Math.sqrt(w_old*h_old*w_image/h_image);
        el.height = h_new;
        el.width = w_new;
        el.y += (h_old-h_new)/2;
        el.x += (w_old-w_new)/2;
      }
    });
    return [dirty,scene];
  }
}

export const isObsidianThemeDark = () => document.body.classList.contains("theme-dark");

export async function tex2dataURL(tex:string, plugin:ExcalidrawPlugin):Promise<{
  mimeType: MimeType,
  fileId: FileId, 
  dataURL: DataURL,
  created: number,
  size: {height: number, width: number},
}> {

  //if network is slow, or not available, or mathjax has not yet fully loaded
  try {
    return await mathjaxSVG(tex, plugin);
  } catch(e) {
    //fallback
    return await mathjaxImage2html(tex);
  }

}

async function mathjaxSVG (tex:string, plugin:ExcalidrawPlugin):Promise<{
  mimeType: MimeType,
  fileId: FileId, 
  dataURL: DataURL,
  created: number,
  size: {height: number, width: number},
}> {
  const eq = plugin.mathjax.tex2svg(tex,{display: true, scale: 4});
  const svg = eq.querySelector("svg");
  if(svg) { 
    const dataURL = svgToBase64(svg.outerHTML);
    return {
      mimeType: "image/svg+xml",
      fileId: fileid() as FileId,
      dataURL: dataURL as DataURL,
      created: Date.now(),
      size: await getImageSize(dataURL)
    }
  }
  return null;
}

async function mathjaxImage2html(tex:string):Promise<{
  mimeType: MimeType,
  fileId: FileId, 
  dataURL: DataURL,
  created: number,
  size: {height: number, width: number},
}> {
  const div = document.body.createDiv();
  div.style.display = "table"; //this will ensure div fits width of formula exactly
  //@ts-ignore
  
  const eq = window.MathJax.tex2chtml(tex,{display: true, scale: 4}); //scale to ensure good resolution
  eq.style.margin = "3px";
  eq.style.color = "black";

  //ipad support - removing mml as that was causing phantom double-image blur.
  const el = eq.querySelector("mjx-assistive-mml");
  if(el) {
    el.parentElement.removeChild(el);
  }
  div.appendChild(eq);
  window.MathJax.typeset();
  const canvas = await html2canvas(div, {backgroundColor:null}); //transparent
  document.body.removeChild(div);
  return {
    mimeType: "image/png",
    fileId: fileid() as FileId,
    dataURL: canvas.toDataURL() as DataURL,
    created: Date.now(),
    size: {height: canvas.height, width: canvas.width}
  }
}

export function getIMGFilename(path:string,extension:string):string {
  return path.substring(0,path.lastIndexOf('.')) + '.' + extension;
}