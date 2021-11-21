import { exportToBlob } from "@zsviczian/excalidraw";
import { FileId } from "@zsviczian/excalidraw/types/element/types";
import { BinaryFileData, DataURL } from "@zsviczian/excalidraw/types/types";
import { App, Notice, TFile } from "obsidian";
import { fileid, IMAGE_TYPES } from "./constants";
import { ExcalidrawData } from "./ExcalidrawData";
import ExcalidrawView, { ExportSettings } from "./ExcalidrawView";
import { t } from "./lang/helpers";
import { tex2dataURL } from "./LaTeX";
import ExcalidrawPlugin from "./main";
import {errorlog, getImageSize, svgToBase64 } from "./Utils";

export declare type MimeType = "image/svg+xml" | "image/png" | "image/jpeg" | "image/gif" | "application/octet-stream";
export type FileData = BinaryFileData & {
  size: {
    height: number;
    width: number;
  },
  hasSVGwithBitmap: boolean
};

export class EmbeddedFilesLoader {
  private plugin:ExcalidrawPlugin;
  private processedFiles: Map<string,number> = new Map<string,number>();
  private isDark:boolean;
  public terminate=false;

  constructor(plugin: ExcalidrawPlugin, isDark?:boolean) {
    this.plugin = plugin;
    this.isDark = isDark;
  }

  public async getObsidianImage (
    file: TFile
  ):Promise<{
    mimeType: MimeType,
    fileId: FileId, 
    dataURL: DataURL,
    created: number,
    hasSVGwithBitmap: boolean,
    size: {height: number, width: number},
  }> {
    if(!this.plugin || !file) return null;
    //to block infinite loop of recursive loading of images
    let count=this.processedFiles.has(file.path) ? this.processedFiles.get(file.path):0;
    if(file.extension==="md" && count>2) {
      new Notice(t("INFINITE_LOOP_WARNING") + file.path,6000);
      return null;
    }
    this.processedFiles.set(file.path,count+1);
    let hasSVGwithBitmap = false;
    const app = this.plugin.app;
    const isExcalidrawFile = this.plugin.ea.isExcalidrawFile(file);
    if (!(IMAGE_TYPES.contains(file.extension) || isExcalidrawFile)) {
      return null;
    }
    const ab = await app.vault.readBinary(file);

    const getExcalidrawSVG = async (isDark:boolean) => {
      const exportSettings:ExportSettings = {
        withBackground: false,
        withTheme: false, 
      };
      this.plugin.ea.reset();
      const svg = await this.plugin.ea.createSVG(file.path,true,exportSettings,this,null);    
      //https://stackoverflow.com/questions/51154171/remove-css-filter-on-child-elements
      const imageList = svg.querySelectorAll("image:not([href^='data:image/svg'])");
      if(imageList.length>0) hasSVGwithBitmap = true;
      if(hasSVGwithBitmap && isDark) {
        const THEME_FILTER = "invert(100%) hue-rotate(180deg) saturate(1.25)";
        imageList.forEach((i) => {
          const id = i.parentElement?.id;
            svg.querySelectorAll(`use[href='#${id}']`).forEach((u) => {
              u.setAttribute("filter", THEME_FILTER);
            });
        });
      }
      if(!hasSVGwithBitmap && svg.getAttribute("hasbitmap")) hasSVGwithBitmap=true;
      const dURL = svgToBase64(svg.outerHTML) as DataURL;
      return dURL as DataURL;
    }
    
    const excalidrawSVG = isExcalidrawFile
                ? await getExcalidrawSVG(this.isDark)
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
    const dataURL = excalidrawSVG ?? (file.extension==="svg" ? await getSVGData(app,file) : await getDataURL(ab,mimeType));
    const size = await getImageSize(excalidrawSVG??app.vault.getResourcePath(file));
    return {
        mimeType,
        fileId: await generateIdFromFile(ab),
        dataURL,
        created: file.stat.mtime,
        hasSVGwithBitmap,
        size
    }
  }

  public async loadSceneFiles ( 
    excalidrawData: ExcalidrawData,
    view: ExcalidrawView,
    addFiles:Function, 
    sourcePath:string,
  ) {
      const app = this.plugin.app;
      const entries = excalidrawData.getFileEntries();
      if(this.isDark===undefined) {
        this.isDark = excalidrawData.scene.appState.theme==="dark";
      }
      let entry;
      let files:FileData[] = [];
      while(!this.terminate && !(entry = entries.next()).done) {
        if(!entry.value[1].isLoaded || entry.value[1].hasSVGwithBitmap) {
          const file = app.metadataCache.getFirstLinkpathDest(entry.value[1].path,sourcePath);
          if(file && file instanceof TFile) {
            const data = await this.getObsidianImage(file);//,theme);
            if(data) {
              files.push({
                mimeType : data.mimeType,
                id: entry.value[0],
                dataURL: data.dataURL,
                created: data.created,
                size: data.size,
                hasSVGwithBitmap: data.hasSVGwithBitmap
              });
            }
          }
        }
      }
    
      let equation;
      const equations = excalidrawData.getEquationEntries(); 
      while(!this.terminate  && !(equation = equations.next()).done) {
        if(!excalidrawData.getEquation(equation.value[0]).isLoaded) {
          const latex = equation.value[1].latex;
          const data = await tex2dataURL(latex, this.plugin);
          if(data) {
            files.push({
              mimeType : data.mimeType,
              id: equation.value[0],
              dataURL: data.dataURL,
              created: data.created,
              size: data.size,
              hasSVGwithBitmap: false
            });
          }
        }
      }
    
      if(this.terminate) return;
      try { //in try block because by the time files are loaded the user may have closed the view
        addFiles(files,view);
      } catch(e) {
        errorlog({where:"EmbeddedFileLoader.loadSceneFiles", error: e});
      }
    }
}

const getSVGData = async (app: App, file: TFile): Promise<DataURL> => {
  const svg = await app.vault.read(file);
  return svgToBase64(svg) as DataURL;
}

const getDataURL = async (file: ArrayBuffer,mimeType: string): Promise<DataURL> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataURL = reader.result as DataURL;
      resolve(dataURL);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(new Blob([new Uint8Array(file)],{type:'mimeType'}));
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
