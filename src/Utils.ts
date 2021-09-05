import {  normalizePath, TAbstractFile, TFolder, Vault } from "obsidian";
import { Random } from "roughjs/bin/math";
import { Zoom } from "@zsviczian/excalidraw/types/types";

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
  return outstring;
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