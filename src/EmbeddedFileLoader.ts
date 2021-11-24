import { file } from "@babel/types";
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
  size: Size,
  hasSVGwithBitmap: boolean
};

export type Size = {
  height: number,
  width: number,
}

export class EmbeddedFile {
  public file:TFile = null;
  public isSVGwithBitmap: boolean = false;
  private img: string=""; //base64
  private imgInverted: string=""; //base64
  public mtime: number = 0; //modified time of the image
  private plugin: ExcalidrawPlugin;
  public mimeType: MimeType="application/octet-stream";
  public size: Size ={height:0,width:0};

  constructor(plugin: ExcalidrawPlugin, hostPath: string, imgPath:string) {
    this.file = plugin.app.metadataCache.getFirstLinkpathDest(imgPath,hostPath);
    this.plugin = plugin;
  }

  private fileChanged():boolean {
    return this.mtime !=this.file.stat.mtime;
  }

  setImage(imgBase64:string,mimeType:MimeType,size:Size,isDark:boolean,isSVGwithBitmap:boolean) {
    if(this.fileChanged()) this.imgInverted = this.img = ""; 
    this.mtime = this.file.stat.mtime;
    this.size = size;
    this.mimeType = mimeType;
    switch(isDark && isSVGwithBitmap) {
      case true: this.imgInverted = imgBase64;break;
      case false: this.img = imgBase64; break;
    }
    this.isSVGwithBitmap = isSVGwithBitmap;
    if(isSVGwithBitmap) this.loadImg(!isDark);
  }

  async loadImg(isDark:boolean) {
    const img = isDark ? this.imgInverted : this.img;
    if(img!=="") return; //already loaded
    const loader = new EmbeddedFilesLoader(this.plugin,isDark);
    const imgData = await loader.getObsidianImage(this.file);
    switch(isDark) {
      case true: this.imgInverted = imgData.dataURL;
      case false: this.img = imgData.dataURL;
    }
    this.size = imgData.size; //if file is pasted and saved to obsidian, if it is an SVG, size will be determined when the inverted version is loaded
    //see REF:addIMAGE in ExcalidrawData
  }

  public isLoaded(isDark:boolean):boolean {
    if(this.fileChanged()) return false;
    if (this.isSVGwithBitmap && isDark) return this.imgInverted !== "";
    return this.img !=="";
  }

  public getImage(isDark:boolean) {
    if(isDark && this.isSVGwithBitmap) return this.imgInverted;
    return this.img; //images that are not SVGwithBitmap, only the light string is stored, since inverted and non-inverted are ===
  }
  
}

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
    addFiles:Function
  ) {
      const app = this.plugin.app;
      const entries = excalidrawData.getFileEntries();
      if(this.isDark===undefined) {
        this.isDark = excalidrawData.scene.appState.theme==="dark";
      }
      let entry;
      let files:FileData[] = [];
      while(!this.terminate && !(entry = entries.next()).done) {
        const embeddedFile:EmbeddedFile = entry.value[1];
        const updateImage:boolean = !embeddedFile.isLoaded(this.isDark) || embeddedFile.isSVGwithBitmap;
        if(!embeddedFile.isLoaded(this.isDark)) {
          const data = await this.getObsidianImage(embeddedFile.file);
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
        } else if (embeddedFile.isSVGwithBitmap) {
          files.push({
            mimeType : embeddedFile.mimeType,
            id: entry.value[0],
            dataURL: embeddedFile.getImage(this.isDark) as DataURL,
            created: embeddedFile.mtime,
            size: embeddedFile.size,
            hasSVGwithBitmap: embeddedFile.isSVGwithBitmap
          });
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
