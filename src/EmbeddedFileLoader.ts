import { FileId } from "@zsviczian/excalidraw/types/element/types";
import { BinaryFileData, DataURL } from "@zsviczian/excalidraw/types/types";
import { App, MarkdownRenderer, Notice, TFile } from "obsidian";
import {
  CASCADIA_FONT,
  DEFAULT_MD_EMBED_CSS,
  fileid,
  FRONTMATTER_KEY_BORDERCOLOR,
  FRONTMATTER_KEY_FONT,
  FRONTMATTER_KEY_FONTCOLOR,
  FRONTMATTER_KEY_MD_STYLE,
  IMAGE_TYPES,
  nanoid,
  VIRGIL_FONT,
} from "./Constants";
import { createSVG } from "./ExcalidrawAutomate";
import { ExcalidrawData, getTransclusion } from "./ExcalidrawData";
import { ExportSettings } from "./ExcalidrawView";
import { t } from "./lang/helpers";
import { tex2dataURL } from "./LaTeX";
import ExcalidrawPlugin from "./main";
import {
  errorlog,
  getDataURL,
  getExportTheme,
  getFontDataURL,
  getImageSize,
  getLinkParts,
  getSVGPadding,
  getWithBackground,
  hasExportBackground,
  hasExportTheme,
  LinkParts,
  svgToBase64,
} from "./utils/Utils";

const THEME_FILTER = "invert(100%) hue-rotate(180deg) saturate(1.25)";

export declare type MimeType =
  | "image/svg+xml"
  | "image/png"
  | "image/jpeg"
  | "image/gif"
  | "application/octet-stream";
export type FileData = BinaryFileData & {
  size: Size;
  hasSVGwithBitmap: boolean;
};

export type Size = {
  height: number;
  width: number;
};

export class EmbeddedFile {
  public file: TFile = null;
  public isSVGwithBitmap: boolean = false;
  private img: string = ""; //base64
  private imgInverted: string = ""; //base64
  public mtime: number = 0; //modified time of the image
  private plugin: ExcalidrawPlugin;
  public mimeType: MimeType = "application/octet-stream";
  public size: Size = { height: 0, width: 0 };
  public linkParts: LinkParts;
  private hostPath: string;
  public attemptCounter: number = 0;
  /*public isHyperlink: boolean = false;*/

  constructor(plugin: ExcalidrawPlugin, hostPath: string, imgPath: string) {
    this.plugin = plugin;
    this.resetImage(hostPath, imgPath);
  }

  public resetImage(hostPath: string, imgPath: string) {
    /*if(imgPath.startsWith("https://") || imgPath.startsWith("http://")) {
      this.img=imgPath;
      this.imgInverted=imgPath;
      this.isHyperlink = true;
      return;
    }*/
    this.imgInverted = this.img = "";
    this.mtime = 0;
    this.linkParts = getLinkParts(imgPath);
    this.hostPath = hostPath;
    if (!this.linkParts.path) {
      new Notice(`Excalidraw Error\nIncorrect embedded filename: ${imgPath}`);
      return;
    }
    if (!this.linkParts.width) {
      this.linkParts.width = this.plugin.settings.mdSVGwidth;
    }
    if (!this.linkParts.height) {
      this.linkParts.height = this.plugin.settings.mdSVGmaxHeight;
    }
    this.file = this.plugin.app.metadataCache.getFirstLinkpathDest(
      this.linkParts.path,
      hostPath,
    );
    if (!this.file) {
      if(this.attemptCounter++ === 0) {
        new Notice(
          `Excalidraw Warning: could not find image file: ${imgPath}`,
          5000,
        );
      }
    }
  }

  private fileChanged(): boolean {
    if (!this.file) {
      this.file = this.plugin.app.metadataCache.getFirstLinkpathDest(
        this.linkParts.path,
        this.hostPath,
      ); // maybe the file has synchronized in the mean time
      if(!this.file) {
        this.attemptCounter++;
        return false;
      }
    }
    return this.mtime != this.file.stat.mtime;
  }

  public setImage(
    imgBase64: string,
    mimeType: MimeType,
    size: Size,
    isDark: boolean,
    isSVGwithBitmap: boolean,
  ) {
    if (!this.file) {
      return;
    }
    if (this.fileChanged()) {
      this.imgInverted = this.img = "";
    }
    this.mtime = this.file.stat.mtime;
    this.size = size;
    this.mimeType = mimeType;
    switch (isDark && isSVGwithBitmap) {
      case true:
        this.imgInverted = imgBase64;
        break;
      case false:
        this.img = imgBase64;
        break; //bitmaps and SVGs without an embedded bitmap do not need a negative image
    }
    this.isSVGwithBitmap = isSVGwithBitmap;
  }

  public isLoaded(isDark: boolean): boolean {
    if (!this.file) {
      this.file = this.plugin.app.metadataCache.getFirstLinkpathDest(
        this.linkParts.path,
        this.hostPath,
      ); // maybe the file has synchronized in the mean time
      if(!this.file) {
        this.attemptCounter++;
        return true;
      }
    }
    if (this.fileChanged()) {
      return false;
    }
    if (this.isSVGwithBitmap && isDark) {
      return this.imgInverted !== "";
    }
    return this.img !== "";
  }

  public getImage(isDark: boolean) {
    /*if(this.isHyperlink) {
      return this.img;
    }*/
    if (!this.file) {
      return "";
    }
    if (isDark && this.isSVGwithBitmap) {
      return this.imgInverted;
    }
    return this.img; //images that are not SVGwithBitmap, only the light string is stored, since inverted and non-inverted are ===
  }
}

export class EmbeddedFilesLoader {
  private plugin: ExcalidrawPlugin;
  private isDark: boolean;
  public terminate = false;
  public uid: string;

  constructor(plugin: ExcalidrawPlugin, isDark?: boolean) {
    this.plugin = plugin;
    this.isDark = isDark;
    this.uid = nanoid();
  }

  public async getObsidianImage(inFile: TFile | EmbeddedFile, depth: number): Promise<{
    mimeType: MimeType;
    fileId: FileId;
    dataURL: DataURL;
    created: number;
    hasSVGwithBitmap: boolean;
    size: { height: number; width: number };
  }> {
    if (!this.plugin || !inFile) {
      return null;
    }
    const file: TFile = inFile instanceof EmbeddedFile ? inFile.file : inFile;
    const linkParts =
      inFile instanceof EmbeddedFile
        ? inFile.linkParts
        : {
            original: file.path,
            path: file.path,
            isBlockRef: false,
            ref: null,
            width: this.plugin.settings.mdSVGwidth,
            height: this.plugin.settings.mdSVGmaxHeight,
          };

    let hasSVGwithBitmap = false;
    const app = this.plugin.app;
    const isExcalidrawFile = this.plugin.isExcalidrawFile(file);
    if (
      !(
        IMAGE_TYPES.contains(file.extension) ||
        isExcalidrawFile ||
        file.extension === "md"
      )
    ) {
      return null;
    }
    const ab = await app.vault.readBinary(file);

    const getExcalidrawSVG = async (isDark: boolean) => {
      //debug({where:"EmbeddedFileLoader.getExcalidrawSVG",uid:this.uid,file:file.name});
      const forceTheme = hasExportTheme(this.plugin, file)
        ? getExportTheme(this.plugin, file, "light")
        : undefined;
      const exportSettings: ExportSettings = {
        withBackground: hasExportBackground(this.plugin, file)
          ? getWithBackground(this.plugin, file)
          : false,
        withTheme: !!forceTheme,
      };
      const svg = await createSVG(
        file.path,
        true,
        exportSettings,
        this,
        forceTheme,
        null,
        null,
        [],
        this.plugin,
        depth+1,
        getSVGPadding(this.plugin, file),
      );
      //https://stackoverflow.com/questions/51154171/remove-css-filter-on-child-elements
      const imageList = svg.querySelectorAll(
        "image:not([href^='data:image/svg'])",
      );
      if (imageList.length > 0) {
        hasSVGwithBitmap = true;
      }
      if (hasSVGwithBitmap && isDark) { 
        imageList.forEach((i) => {
          const id = i.parentElement?.id;
          svg.querySelectorAll(`use[href='#${id}']`).forEach((u) => {
            u.setAttribute("filter", THEME_FILTER);
          });
        });
      }
      if (!hasSVGwithBitmap && svg.getAttribute("hasbitmap")) {
        hasSVGwithBitmap = true;
      }
      const dURL = svgToBase64(svg.outerHTML) as DataURL;
      return dURL as DataURL;
    };

    const excalidrawSVG = isExcalidrawFile
      ? await getExcalidrawSVG(this.isDark)
      : null;
    let mimeType: MimeType = "image/svg+xml";
    if (!isExcalidrawFile) {
      switch (file.extension) {
        case "png":
          mimeType = "image/png";
          break;
        case "jpeg":
          mimeType = "image/jpeg";
          break;
        case "jpg":
          mimeType = "image/jpeg";
          break;
        case "gif":
          mimeType = "image/gif";
          break;
        case "svg":
        case "md":
          mimeType = "image/svg+xml";
          break;
        default:
          mimeType = "application/octet-stream";
      }
    }
    let dataURL =
      excalidrawSVG ??
      (file.extension === "svg"
        ? await getSVGData(app, file)
        : file.extension === "md"
        ? null
        : await getDataURL(ab, mimeType));

    if(!dataURL) {
      const result = await this.convertMarkdownToSVG(this.plugin, file, linkParts);
      dataURL = result.dataURL;
      hasSVGwithBitmap = result.hasSVGwithBitmap;
    }
    const size = await getImageSize(dataURL);
    return {
      mimeType,
      fileId: await generateIdFromFile(ab),
      dataURL,
      created: file.stat.mtime,
      hasSVGwithBitmap,
      size,
    };
  }

  public async loadSceneFiles(
    excalidrawData: ExcalidrawData,
    addFiles: Function,
    depth:number
  ) {
    if(depth > 4) {
      new Notice(t("INFINITE_LOOP_WARNING")+depth.toString(), 6000);
      return;
    }
    const entries = excalidrawData.getFileEntries();
    //debug({where:"EmbeddedFileLoader.loadSceneFiles",uid:this.uid,isDark:this.isDark,sceneTheme:excalidrawData.scene.appState.theme});
    if (this.isDark === undefined) {
      this.isDark = excalidrawData?.scene?.appState?.theme === "dark";
    }
    let entry;
    const files: FileData[] = [];
    while (!this.terminate && !(entry = entries.next()).done) {
      const embeddedFile: EmbeddedFile = entry.value[1];
      if (!embeddedFile.isLoaded(this.isDark)) {
        //debug({where:"EmbeddedFileLoader.loadSceneFiles",uid:this.uid,status:"embedded Files are not loaded"});
        const data = await this.getObsidianImage(embeddedFile, depth);
        if (data) {
          files.push({
            mimeType: data.mimeType,
            id: entry.value[0],
            dataURL: data.dataURL,
            created: data.created,
            size: data.size,
            hasSVGwithBitmap: data.hasSVGwithBitmap,
          });
        }
      } else if (embeddedFile.isSVGwithBitmap) {
        files.push({
          mimeType: embeddedFile.mimeType,
          id: entry.value[0],
          dataURL: embeddedFile.getImage(this.isDark) as DataURL,
          created: embeddedFile.mtime,
          size: embeddedFile.size,
          hasSVGwithBitmap: embeddedFile.isSVGwithBitmap,
        });
      }
    }

    let equation;
    const equations = excalidrawData.getEquationEntries();
    while (!this.terminate && !(equation = equations.next()).done) {
      if (!excalidrawData.getEquation(equation.value[0]).isLoaded) {
        const latex = equation.value[1].latex;
        const data = await tex2dataURL(latex, this.plugin);
        if (data) {
          files.push({
            mimeType: data.mimeType,
            id: equation.value[0],
            dataURL: data.dataURL,
            created: data.created,
            size: data.size,
            hasSVGwithBitmap: false,
          });
        }
      }
    }

    if (this.terminate) {
      return;
    }
    //debug({where:"EmbeddedFileLoader.loadSceneFiles",uid:this.uid,status:"add Files"});
    try {
      //in try block because by the time files are loaded the user may have closed the view
      addFiles(files, this.isDark);
    } catch (e) {
      errorlog({ where: "EmbeddedFileLoader.loadSceneFiles", error: e });
    }
  }

  private async convertMarkdownToSVG(
    plugin: ExcalidrawPlugin,
    file: TFile,
    linkParts: LinkParts,
  ): Promise<{dataURL: DataURL, hasSVGwithBitmap:boolean}> {
    //1.
    //get the markdown text
    let hasSVGwithBitmap = false;
    const transclusion = await getTransclusion(linkParts, plugin.app, file);
    let text = (transclusion.leadingHashes??"") + transclusion.contents;
    if (text === "") {
      text =
        "# Empty markdown file\nCTRL+Click here to open the file for editing in the current active pane, or CTRL+SHIFT+Click to open it in an adjacent pane.";
    }
  
    //2.
    //get styles
    const fileCache = plugin.app.metadataCache.getFileCache(file);
    let fontDef: string;
    let fontName = plugin.settings.mdFont;
    if (
      fileCache?.frontmatter &&
      fileCache.frontmatter[FRONTMATTER_KEY_FONT] != null
    ) {
      fontName = fileCache.frontmatter[FRONTMATTER_KEY_FONT];
    }
    switch (fontName) {
      case "Virgil":
        fontDef = VIRGIL_FONT;
        break;
      case "Cascadia":
        fontDef = CASCADIA_FONT;
        break;
      case "":
        fontDef = "";
        break;
      default:
        const font = await getFontDataURL(plugin.app, fontName, file.path);
        fontDef = font.fontDef;
        fontName = font.fontName;
    }
  
    const fontColor = fileCache?.frontmatter
      ? fileCache.frontmatter[FRONTMATTER_KEY_FONTCOLOR] ??
        plugin.settings.mdFontColor
      : plugin.settings.mdFontColor;
  
    let style = fileCache?.frontmatter
      ? fileCache.frontmatter[FRONTMATTER_KEY_MD_STYLE] ?? ""
      : "";
    let frontmatterCSSisAfile = false;
    if (style && style != "") {
      const f = plugin.app.metadataCache.getFirstLinkpathDest(style, file.path);
      if (f) {
        style = await plugin.app.vault.read(f);
        frontmatterCSSisAfile = true;
      }
    }
    if (!frontmatterCSSisAfile) {
      if (plugin.settings.mdCSS && plugin.settings.mdCSS !== "") {
        const f = plugin.app.metadataCache.getFirstLinkpathDest(
          plugin.settings.mdCSS,
          file.path,
        );
        style += f ? `\n${await plugin.app.vault.read(f)}` : DEFAULT_MD_EMBED_CSS;
      } else {
        style += DEFAULT_MD_EMBED_CSS;
      }
    }
  
    const borderColor = fileCache?.frontmatter
      ? fileCache.frontmatter[FRONTMATTER_KEY_BORDERCOLOR] ??
        plugin.settings.mdBorderColor
      : plugin.settings.mdBorderColor;
  
    if (borderColor && borderColor !== "" && !style.match(/svg/i)) {
      style += `svg{border:2px solid;color:${borderColor};transform:scale(.95)}`;
    }
  
    //3.
    //SVG helper functions
    //the SVG will first have ~infinite height. After sizing this will be reduced
    let svgStyle = ` width="${linkParts.width}px" height="100000"`;
    let foreignObjectStyle = ` width="${linkParts.width}px" height="100%"`;
  
    const svg = (xml: string, xmlFooter: string, style?: string) =>
      `<svg xmlns="http://www.w3.org/2000/svg"${svgStyle}>${
        style ? `<style>${style}</style>` : ""
      }<foreignObject x="0" y="0"${foreignObjectStyle}>${xml}${
        xmlFooter //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/286#issuecomment-982179639
      }</foreignObject>${
        fontDef !== "" ? `<defs><style>${fontDef}</style></defs>` : ""
      }</svg>`;
  
    //4.
    //create document div - this will be the contents of the foreign object
    const mdDIV = createDiv();
    mdDIV.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    mdDIV.setAttribute("class", "excalidraw-md-host");
    //  mdDIV.setAttribute("style",style);
    if (fontName !== "") {
      mdDIV.style.fontFamily = fontName;
    }
    mdDIV.style.overflow = "auto";
    mdDIV.style.display = "block";
    mdDIV.style.color = fontColor && fontColor !== "" ? fontColor : "initial";
  
    await MarkdownRenderer.renderMarkdown(text, mdDIV, file.path, plugin);
  
    mdDIV
      .querySelectorAll(":scope > *[class^='frontmatter']")
      .forEach((el) => mdDIV.removeChild(el));
  
    const internalEmbeds = Array.from(mdDIV.querySelectorAll("span[class='internal-embed']"))
    for(let i=0;i<internalEmbeds.length;i++) {
      const el = internalEmbeds[i];
      const src = el.getAttribute("src");
      if(!src) return;
      const width = el.getAttribute("width");
      const height = el.getAttribute("height");
      const f = app.metadataCache.getFirstLinkpathDest(src,file.path);
      if(!f) return;
      const embeddedFile = await this.getObsidianImage(f,1);
      const img = createEl("img");
      if(width) img.setAttribute("width", width);
      if(height) img.setAttribute("height", height);
      img.src = embeddedFile.dataURL;
      el.replaceWith(img);  
    }
  
    //5.1
    //get SVG size.
    //First I need to create a fully self contained copy of the document to convert
    //blank styles into inline styles using computedStyle
    const iframeHost = document.body.createDiv();
    iframeHost.style.display = "none";
    const iframe = iframeHost.createEl("iframe");
    const iframeDoc = iframe.contentWindow.document;
    if (style) {
      const styleEl = iframeDoc.createElement("style");
      styleEl.type = "text/css";
      styleEl.innerHTML = style;
      iframeDoc.head.appendChild(styleEl);
    }
    const stylingDIV = iframeDoc.importNode(mdDIV, true);
    iframeDoc.body.appendChild(stylingDIV);
    const footerDIV = createDiv();
    footerDIV.setAttribute("class", "excalidraw-md-footer");
    iframeDoc.body.appendChild(footerDIV);
  
    iframeDoc.body.querySelectorAll("*").forEach((el: HTMLElement) => {
      const elementStyle = el.style;
      const computedStyle = window.getComputedStyle(el);
      let style = "";
      for (const prop in elementStyle) {
        if (elementStyle.hasOwnProperty(prop)) {
          style += `${prop}: ${computedStyle[prop]};`;
        }
      }
      el.setAttribute("style", style);
    });
  
    const xmlINiframe = new XMLSerializer().serializeToString(stylingDIV);
    const xmlFooter = new XMLSerializer().serializeToString(footerDIV);
    document.body.removeChild(iframeHost);
  
    //5.2
    //get SVG size
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      svg(xmlINiframe, xmlFooter),
      "image/svg+xml",
    );
    const svgEl = doc.firstElementChild;
    const host = createDiv();
    host.appendChild(svgEl);
    document.body.appendChild(host);
    const footerHeight = svgEl.querySelector(
      ".excalidraw-md-footer",
    ).scrollHeight;
    const height =
      svgEl.querySelector(".excalidraw-md-host").scrollHeight + footerHeight;
    const svgHeight = height <= linkParts.height ? height : linkParts.height;
    document.body.removeChild(host);
  
    //finalize SVG
    svgStyle = ` width="${linkParts.width}px" height="${svgHeight}px"`;
    foreignObjectStyle = ` width="${linkParts.width}px" height="${svgHeight}px"`;
    mdDIV.style.height = `${svgHeight - footerHeight}px`;
    mdDIV.style.overflow = "hidden";

    const imageList = mdDIV.querySelectorAll(
      "img:not([src^='data:image/svg+xml'])",
    );
    if (imageList.length > 0) {
      hasSVGwithBitmap = true;
    }
    if (hasSVGwithBitmap && this.isDark) { 
      imageList.forEach(img => {
        if(img instanceof HTMLImageElement) {
          img.style.filter = THEME_FILTER;
        }
      });
    }

    const xml = new XMLSerializer().serializeToString(mdDIV);
    const finalSVG = svg(xml, '<div class="excalidraw-md-footer"></div>', style);
    plugin.ea.mostRecentMarkdownSVG = parser.parseFromString(
      finalSVG,
      "image/svg+xml",
    ).firstElementChild as SVGSVGElement;
    return {
      dataURL: svgToBase64(finalSVG) as DataURL,
      hasSVGwithBitmap
    };
  };
}

const getSVGData = async (app: App, file: TFile): Promise<DataURL> => {
  const svg = await app.vault.read(file);
  return svgToBase64(svg) as DataURL;
};

const generateIdFromFile = async (file: ArrayBuffer): Promise<FileId> => {
  let id: FileId;
  try {
    const hashBuffer = await window.crypto.subtle.digest("SHA-1", file);
    id =
      // convert buffer to byte array
      Array.from(new Uint8Array(hashBuffer))
        // convert to hex string
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("") as FileId;
  } catch (error) {
    errorlog({ where: "EmbeddedFileLoader.generateIdFromFile", error });
    id = fileid() as FileId;
  }
  return id;
};
