import { FileId } from "@zsviczian/excalidraw/types/element/types";
import { BinaryFileData, DataURL } from "@zsviczian/excalidraw/types/types";
import { App, Notice, TFile } from "obsidian";
import { fileid, IMAGE_TYPES } from "./constants";
import { ExcalidrawData } from "./ExcalidrawData";
import ExcalidrawView, { ExportSettings } from "./ExcalidrawView";
import { tex2dataURL } from "./LaTeX";
import ExcalidrawPlugin from "./main";
import {getImageSize, svgToBase64 } from "./Utils";

export declare type MimeType = "image/svg+xml" | "image/png" | "image/jpeg" | "image/gif" | "application/octet-stream";

export class EmbeddedFilesLoader {
  private plugin:ExcalidrawPlugin;
  private processedFiles: Set<string> = new Set<string>();

  constructor(plugin: ExcalidrawPlugin) {
    this.plugin = plugin;
  }

  public async getObsidianImage (file: TFile)//,theme:string)
  :Promise<{
      mimeType: MimeType,
      fileId: FileId, 
      dataURL: DataURL,
      created: number,
    size: {height: number, width: number},
  }> {
    if(!this.plugin || !file) return null;
    //to block infinite loop of recursive loading of images
    if((file.extension==="md" || file.extension === "excalidraw") && this.processedFiles.has(file.path)) {
      new Notice("Stopped loading infinite image embed loop at repeated instance of " + file.path,6000);
      return null;
    }
    this.processedFiles.add(file.path);

    const app = this.plugin.app;
    const isExcalidrawFile = this.plugin.ea.isExcalidrawFile(file);
    if (!(IMAGE_TYPES.contains(file.extension) || isExcalidrawFile)) {
      return null;
    }
    const ab = await app.vault.readBinary(file);

    const getExcalidrawSVG = async () => {
      const exportSettings:ExportSettings = {
        withBackground: false,
        withTheme: false
      };
      this.plugin.ea.reset();
      const svg = await this.plugin.ea.createSVG(file.path,true,exportSettings,this);     
      const dURL = svgToBase64(svg.outerHTML) as DataURL;
      return dURL as DataURL;
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
    const dataURL = excalidrawSVG ?? (file.extension==="svg" ? await getSVGData(app,file) : await getDataURL(ab,mimeType));
    const size = await getImageSize(excalidrawSVG??app.vault.getResourcePath(file));
    return {
        mimeType: mimeType,
        fileId: await generateIdFromFile(ab),
        dataURL: dataURL,
        created: file.stat.mtime,
        size: size
    }
  }

  public async loadSceneFiles ( 
    excalidrawData: ExcalidrawData,
    view: ExcalidrawView,
    addFiles:Function, 
    sourcePath:string,
    //theme: string,
  ) {
      const app = this.plugin.app;
      let entries = excalidrawData.getFileEntries(); 
      let entry;
      let files:BinaryFileData[] = [];
      while(!(entry = entries.next()).done) {
        const file = app.metadataCache.getFirstLinkpathDest(entry.value[1],sourcePath);
        if(file && file instanceof TFile) {
          const data = await this.getObsidianImage(file);//,theme);
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
      }
    
      entries = excalidrawData.getEquationEntries(); 
      while(!(entry = entries.next()).done) {
        const tex = entry.value[1];
        const data = await tex2dataURL(tex, this.plugin);
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
