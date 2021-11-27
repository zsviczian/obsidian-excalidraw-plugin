import { FileId } from "@zsviczian/excalidraw/types/element/types";
import { BinaryFileData, DataURL } from "@zsviczian/excalidraw/types/types";
import { link } from "fs";
import { App, MarkdownRenderer, Notice, TFile } from "obsidian";
import { CASCADIA_FONT, fileid, FRONTMATTER_KEY_CSS, FRONTMATTER_KEY_FONT, FRONTMATTER_KEY_FONTCOLOR, IMAGE_TYPES, nanoid, VIRGIL_FONT } from "./constants";
import { createSVG } from "./ExcalidrawAutomate";
import { ExcalidrawData, getTransclusion } from "./ExcalidrawData";
import ExcalidrawView, { ExportSettings } from "./ExcalidrawView";
import { t } from "./lang/helpers";
import de from "./lang/locale/de";
import { tex2dataURL } from "./LaTeX";
import ExcalidrawPlugin from "./main";
import {debug, errorlog, getImageSize, getLinkParts, LinkParts, svgToBase64 } from "./Utils";

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
  public linkParts: LinkParts;

  constructor(plugin: ExcalidrawPlugin, hostPath: string, imgPath:string) {
    this.plugin = plugin;
    this.resetImage(hostPath,imgPath);
  }

  public resetImage(hostPath: string, imgPath:string) {
    this.imgInverted = this.img = ""; 
    this.mtime = 0;
    this.linkParts = getLinkParts(imgPath);
    if(!this.linkParts.path) {
      new Notice("Excalidraw Error\nIncorrect embedded filename: "+imgPath);
      return;
    }
    if(!this.linkParts.width) this.linkParts.width = this.plugin.settings.mdSVGwidth;
    if(!this.linkParts.height) this.linkParts.height = this.plugin.settings.mdSVGmaxHeight;
    this.file = this.plugin.app.metadataCache.getFirstLinkpathDest(this.linkParts.path,hostPath);
  }

  private fileChanged():boolean {
    return this.mtime !=this.file.stat.mtime;
  }

  setImage(imgBase64:string,mimeType:MimeType,size:Size,isDark:boolean,isSVGwithBitmap:boolean) {
    if(!this.file) return;
    if(this.fileChanged()) this.imgInverted = this.img = ""; 
    this.mtime = this.file.stat.mtime;
    this.size = size;
    this.mimeType = mimeType;
    switch(isDark && isSVGwithBitmap) {
      case true: this.imgInverted = imgBase64;break;
      case false: this.img = imgBase64; break;
    }
    this.isSVGwithBitmap = isSVGwithBitmap;
  }

  async loadImg(isDark:boolean) {
    if(!this.file) return;
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
    if(!this.file) return true;
    if(this.fileChanged()) return false;
    if (this.isSVGwithBitmap && isDark) return this.imgInverted !== "";
    return this.img !=="";
  }

  public getImage(isDark:boolean) {
    if(!this.file) return "";
    if(isDark && this.isSVGwithBitmap) return this.imgInverted;
    return this.img; //images that are not SVGwithBitmap, only the light string is stored, since inverted and non-inverted are ===
  }
  
}

export class EmbeddedFilesLoader {
  private plugin:ExcalidrawPlugin;
  private processedFiles: Map<string,number> = new Map<string,number>();
  private isDark:boolean;
  public terminate=false;
  public uid:string;

  constructor(plugin: ExcalidrawPlugin, isDark?:boolean) {
    this.plugin = plugin;
    this.isDark = isDark;
    this.uid = nanoid();
  }

  public async getObsidianImage (
    inFile: TFile | EmbeddedFile
  ):Promise<{
    mimeType: MimeType,
    fileId: FileId, 
    dataURL: DataURL,
    created: number,
    hasSVGwithBitmap: boolean,
    size: {height: number, width: number},
  }> {
    if(!this.plugin || !inFile) return null;
    const file:TFile = inFile instanceof EmbeddedFile ? inFile.file : inFile;
    const linkParts = inFile instanceof EmbeddedFile 
                      ? inFile.linkParts 
                      : {
                        original: file.path,
                        path: file.path,
                        isBlockRef: false,
                        ref: null,
                        width: this.plugin.settings.mdSVGwidth,
                        height: this.plugin.settings.mdSVGmaxHeight
                      } 
    //to block infinite loop of recursive loading of images
    let count=this.processedFiles.has(file.path) ? this.processedFiles.get(file.path):0;
    if(file.extension==="md" && count>2) {
      new Notice(t("INFINITE_LOOP_WARNING") + file.path,6000);
      return null;
    }
    this.processedFiles.set(file.path,count+1);
    let hasSVGwithBitmap = false;
    const app = this.plugin.app;
    const isExcalidrawFile = this.plugin.isExcalidrawFile(file);
    if (!(IMAGE_TYPES.contains(file.extension) || isExcalidrawFile || file.extension==="md")) {
      return null;
    }
    const ab = await app.vault.readBinary(file);

    const getExcalidrawSVG = async (isDark:boolean) => {
      debug({where:"EmbeddedFileLoader.getExcalidrawSVG",uid:this.uid,file:file.name});
      const exportSettings:ExportSettings = {
        withBackground: false,
        withTheme: false, 
      };
      const svg = await createSVG(
        file.path,
        true,
        exportSettings,
        this,
        null,
        null,
        null,
        [],
        this.plugin
      );    
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
        case "svg":
        case "md" : mimeType = "image/svg+xml";break;
        default: mimeType = "application/octet-stream";
      }
    } 
    const dataURL = excalidrawSVG 
                    ?? (file.extension==="svg" 
                        ? await getSVGData(app,file) 
                        : (file.extension==="md" 
                           ? await convertMarkdownToSVG(this.plugin,file,linkParts) 
                           : await getDataURL(ab,mimeType)
                      ));
    const size = await getImageSize(excalidrawSVG 
                                    ?? (file.extension==="md" 
                                        ? dataURL
                                        : app.vault.getResourcePath(file)
                                    ));
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
    addFiles:Function
  ) {
      const app = this.plugin.app;
      const entries = excalidrawData.getFileEntries();
      debug({where:"EmbeddedFileLoader.loadSceneFiles",uid:this.uid,isDark:this.isDark,sceneTheme:excalidrawData.scene.appState.theme});
      if(this.isDark===undefined) {
        this.isDark = excalidrawData.scene.appState.theme==="dark";
      }
      let entry;
      let files:FileData[] = [];
      while(!this.terminate && !(entry = entries.next()).done) {
        const embeddedFile:EmbeddedFile = entry.value[1];
        const updateImage:boolean = !embeddedFile.isLoaded(this.isDark) || embeddedFile.isSVGwithBitmap;
        if(!embeddedFile.isLoaded(this.isDark)) {
          debug({where:"EmbeddedFileLoader.loadSceneFiles",uid:this.uid,status:"embedded Files are not loaded"});
          const data = await this.getObsidianImage(embeddedFile);
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
      debug({where:"EmbeddedFileLoader.loadSceneFiles",uid:this.uid,status:"add Files"});
      try { //in try block because by the time files are loaded the user may have closed the view
        addFiles(files);
      } catch(e) {
        errorlog({where:"EmbeddedFileLoader.loadSceneFiles", error: e});
      }
    }
}

const getSVGData = async (app: App, file: TFile): Promise<DataURL> => {
  const svg = await app.vault.read(file);
  return svgToBase64(svg) as DataURL;
}

const convertMarkdownToSVG = async (plugin: ExcalidrawPlugin, file: TFile, linkParts: LinkParts): Promise<DataURL> => {
  
  //const text = await plugin.app.vault.cachedRead(file);
  const [text,line] = await getTransclusion(linkParts,plugin.app,file);
  const fileCache = plugin.app.metadataCache.getFileCache(file);
  
  //get styles
  let fontName:string;
  let fontDef:string;
  let font = plugin.settings.mdFont;
  if (fileCache?.frontmatter && fileCache.frontmatter[FRONTMATTER_KEY_FONT]!=null) {
    font = fileCache.frontmatter[FRONTMATTER_KEY_FONT];
  }
  switch(font){
    case "Virgil": fontName = "Virgil";fontDef = VIRGIL_FONT; break;
    case "Cascadia": fontName = "Cascadia";fontDef = CASCADIA_FONT; break;
    default: 
      const f = plugin.app.metadataCache.getFirstLinkpathDest(font,file.path);
      if(f) {
        const ab = await plugin.app.vault.readBinary(f);
        const mimeType=f.extension.startsWith("woff")?"application/font-woff":"font/truetype";
        fontName = f.basename;
        fontDef = ` @font-face {font-family: "${fontName}";src: url("${await getDataURL(ab,mimeType)}") format("${f.extension==="ttf"?"truetype":f.extension}");}`;
        const split = fontDef.split(";base64,",2);
        fontDef = split[0]+";charset=utf-8;base64,"+split[1];
      } else {
        fontName = "Virgil";fontDef = VIRGIL_FONT;
      }
  }
  
  const fontColor = fileCache?.frontmatter ? fileCache.frontmatter[FRONTMATTER_KEY_FONTCOLOR] : plugin.settings.mdFontColor;

  //construct SVG
  const div = createDiv();
  div.setAttribute("xmlns","http://www.w3.org/1999/xhtml");
  div.style.fontFamily = fontName;
  if(fontColor) div.style.color = fontColor;
  div.style.fontSize = "initial";
  await MarkdownRenderer.renderMarkdown(text,div,file.path,plugin);
  div.querySelectorAll(":scope > *[class^='frontmatter']").forEach((el)=>div.removeChild(el));
  //brute force to swap <a> to <u> because links anyway don't work when the foreignObject is
  //encapsulated in an img element. <a> does not render with an underline, <u> will.
  const xml = (new XMLSerializer().serializeToString(div)).replaceAll("<a ","<u ").replaceAll("</a>","</u>");
  let svgStyle = ' width="'+linkParts.width+'px" height="100%"';
  let foreignObjectStyle = ' width="'+linkParts.width+'px" height="100%"';

  const svg = () => '<svg xmlns="http://www.w3.org/2000/svg"'+svgStyle+'>' 
    + '<foreignObject x="0" y="0"'+foreignObjectStyle+'>' 
    + xml
    + '</foreignObject><defs><style>'
    + fontDef 
    + '</style></defs></svg>';

  //get SVG size
  const parser = new DOMParser();
  const doc = parser.parseFromString(svg(),"image/svg+xml");
  const svgEl = doc.firstElementChild;
  const host = createDiv();
  host.appendChild(svgEl);
  document.body.appendChild(host);
  const height = svgEl.firstElementChild.firstElementChild.scrollHeight;
  const svgHeight = height <= linkParts.height ? height : linkParts.height;
  document.body.removeChild(host);

  //finalize SVG
  svgStyle = ' width="'+linkParts.width+'px" height="'+svgHeight+'px"';
  foreignObjectStyle = ' width="'+linkParts.width+'px" height="'+svgHeight+'px"';
  return svgToBase64(svg()) as DataURL;
}

const getDataURL = async (file: ArrayBuffer,mimeType: string): Promise<DataURL> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataURL = reader.result as DataURL;
      resolve(dataURL);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(new Blob([new Uint8Array(file)],{type:mimeType}));
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
