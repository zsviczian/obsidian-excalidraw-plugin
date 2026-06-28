//https://stackoverflow.com/questions/2068344/how-do-i-get-a-youtube-video-thumbnail-from-the-youtube-api
//https://img.youtube.com/vi/uZz5MgzWXiM/maxresdefault.jpg

import {
  ExcalidrawElement,
  FileId,
} from "@zsviczian/excalidraw/types/element/src/types";
import { DataURL } from "@zsviczian/excalidraw/types/excalidraw/types";
import { App, Component, MarkdownRenderer, Notice, TFile } from "obsidian";
import {
  DEFAULT_MD_EMBED_CSS,
  fileid,
  IMAGE_TYPES,
  nanoid,
  THEME_FILTER,
  FRONTMATTER_KEYS,
  getCSSFontDefinition,
  mainDocument,
} from "../constants/constants";
import { createSVG } from "src/utils/excalidrawAutomateUtils";
import {
  EquationItem,
  ExcalidrawData,
  getTransclusion,
} from "./ExcalidrawData";
import { t } from "../lang/helpers";
import { tex2dataURL } from "./LaTeX";
import ExcalidrawPlugin from "../core/main";
import type { PdfJsDocumentProxy } from "src/types/pdfJsTypes";
import {
  blobToBase64,
  getDataURLFromURL,
  getMimeType,
  getPDFDoc,
  getURLImageExtension,
  readLocalFileBinary,
} from "../utils/fileUtils";
import { errorlog, getDataURL } from "../utils/coreUtils";
import {
  getExportTheme,
  getLinkParts,
  hasExportTheme,
  LinkParts,
} from "../utils/sceneDataUtils";
import {
  cropCanvas,
  getEmbeddedFilenameParts,
  getExportPadding,
  getFontDataURL,
  getImageSize,
  getWithBackground,
  hasExportBackground,
  isMaskFile,
  promiseTry,
  PromisePool,
  svgToBase64,
} from "../utils/embeddedAssetUtils";
import {
  getMermaidImageElements,
  getMermaidText,
  shouldRenderMermaid,
} from "../utils/mermaidUtils";
import { mermaidToExcalidraw } from "src/constants/constants";
import { ImageKey, getImageCache } from "./ImageCache";
import { FILENAMEPARTS, PreviewImageType } from "../types/utilTypes";
import {
  ColorMap,
  ImgData,
  PDFPageViewProps,
  Size,
  MimeType,
  FileData,
} from "src/types/embeddedFileLoaderTypes";
import { ExportSettings } from "src/types/exportUtilTypes";
import { setStyleText } from "src/utils/htmlUtils";
import { hideElement, setStyle } from "src/utils/styleUtils";
import {
  isInstanceOfHTMLImageElement,
  isInstanceOfSVGElement,
} from "src/utils/typechecks";
import { getSafeFrontmatter, strictArrayBuffer } from "src/utils/obsidianUtils";

//An ugly workaround for the following situation.
//File A is a markdown file that has an embedded Excalidraw file B
//Later file A is embedded into file B as a Markdown embed
//Because MarkdownRenderer.renderMarkdown does not take a depth parameter as input
//EmbeddedFileLoader cannot track the recursion depth (as it can when Excalidraw drawings are embedded)
//For this reason, the markdown TFile is added to the Watchdog when rendering starts
//and getObsidianImage is aborted if the file is already in the Watchdog stack
const markdownRendererRecursionWatcthdog = new Set<TFile>();

type CacheValidationMode = "validated" | "stale-first";

type LoadImageOptions = {
  cacheValidation?: CacheValidationMode;
  onStaleCacheHit?: () => void;
};

type LoadSceneEmitPolicy = "all" | "changed-only";

const getPDFCacheId = (linkParts: LinkParts, pageNum: number): string => {
  // Different crops of the same PDF page must not overwrite each other in cache,
  // so the cache key uses the full PDF page/reference fragment when present.
  const pdfRef = linkParts.original?.match(/#([^|]*)/)?.[1];
  return pdfRef && pdfRef !== "" ? pdfRef : `page=${pageNum}`;
};

/**
 * Function takes an SVG and replaces all fill and stroke colors with the ones in the colorMap
 * @param svg: SVGSVGElement
 * @param colorMap: {[color: string]: string;} | null
 * @returns svg with colors replaced
 */
const replaceSVGColors = (
  svg: SVGSVGElement | string,
  colorMap: ColorMap | null,
): SVGSVGElement | string => {
  if (!colorMap) {
    return svg;
  }

  if (typeof svg === "string") {
    // Replace colors in the SVG string
    for (const [oldColor, newColor] of Object.entries(colorMap)) {
      if (oldColor === "stroke" || oldColor === "fill") {
        const [svgTag, prefix, suffix] = (svg.match(/(<svg[^>]*)(>)/i) ||
          []) as string[];
        if (!svgTag) {
          continue;
        }

        svg = svg.replace(
          svgTag,
          svgTag.match(new RegExp(`${oldColor}=["'][^"']*["']`))
            ? prefix.replace(
                new RegExp(`${oldColor}=["'][^"']*["']`, "i"),
                `${oldColor}="${newColor}"`,
              ) + suffix
            : `${prefix} ${oldColor}="${newColor}"${suffix}`,
        );
        continue;
      }
      const fillRegex = new RegExp(`fill="${oldColor}"`, "gi");
      svg = svg.replaceAll(fillRegex, `fill="${newColor}"`);
      const fillStyleRegex = new RegExp(`fill:${oldColor}`, "gi");
      svg = svg.replaceAll(fillStyleRegex, `fill:${newColor}`);
      const strokeRegex = new RegExp(`stroke="${oldColor}"`, "gi");
      svg = svg.replaceAll(strokeRegex, `stroke="${newColor}"`);
      const strokeStyleRegex = new RegExp(`stroke:${oldColor}`, "gi");
      svg = svg.replaceAll(strokeStyleRegex, `stroke:${newColor}`);
    }
    return svg;
  }

  // Modify the fill and stroke attributes of child nodes
  const childNodes = (node: ChildNode) => {
    if (isInstanceOfSVGElement(node)) {
      const oldFill = node.getAttribute("fill")?.toLocaleLowerCase();
      const oldStroke = node.getAttribute("stroke")?.toLocaleLowerCase();

      if (oldFill && colorMap[oldFill]) {
        node.setAttribute("fill", colorMap[oldFill]);
      }
      if (oldStroke && colorMap[oldStroke]) {
        node.setAttribute("stroke", colorMap[oldStroke]);
      }
    }
    for (const child of node.childNodes) {
      childNodes(child);
    }
  };

  if ("fill" in colorMap) {
    svg.setAttribute("fill", colorMap.fill);
  }
  if ("stroke" in colorMap) {
    svg.setAttribute("stroke", colorMap.stroke);
  }
  for (const child of svg.childNodes) {
    childNodes(child);
  }

  return svg;
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
  public filenameparts: FILENAMEPARTS;
  private hostPath: string;
  public attemptCounter: number = 0;
  public isHyperLink: boolean = false;
  public isLocalLink: boolean = false;
  public isMarkdownSection: boolean = false;
  public hyperlink: DataURL;
  public colorMap: ColorMap | null = null;
  public pdfPageViewProps: PDFPageViewProps;
  public renderScale: number = 0;

  constructor(
    plugin: ExcalidrawPlugin,
    hostPath: string,
    imgPath: string,
    colorMapJSON?: string,
  ) {
    this.plugin = plugin;
    this.resetImage(hostPath, imgPath);
    if (
      this.file &&
      (this.plugin.isExcalidrawFile(this.file) ||
        this.file.extension.toLowerCase() === "svg")
    ) {
      try {
        this.colorMap = (
          colorMapJSON ? JSON.parse(colorMapJSON.toLocaleLowerCase()) : null
        ) as ColorMap | null;
      } catch (error: unknown) {
        errorlog({
          message: `Error parsing colorMap for file ${imgPath}`,
          context: this.constructor,
          error,
        });
        this.colorMap = null;
      }
    }
  }

  get hasSeparateDarkAndLightVersion(): boolean {
    return (
      this.isSVGwithBitmap || this.file?.extension?.toLowerCase?.() === "pdf"
    );
  }

  public resetImage(hostPath: string, imgPath: string) {
    this.imgInverted = this.img = "";
    this.mtime = 0;
    this.renderScale = 0;

    if (
      imgPath.startsWith("https://") ||
      imgPath.startsWith("http://") ||
      imgPath.startsWith("ftp://") ||
      imgPath.startsWith("ftps://")
    ) {
      this.isHyperLink = true;
      this.hyperlink = imgPath as DataURL;
      return;
    }

    if (imgPath.startsWith("file://")) {
      this.isLocalLink = true;
      this.hyperlink = imgPath as DataURL;
      return;
    }

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
      if (this.attemptCounter++ === 0) {
        new Notice(
          `Excalidraw Warning: could not find image file: ${imgPath}`,
          5000,
        );
      }
    } else {
      this.filenameparts = getEmbeddedFilenameParts(imgPath);
      this.isMarkdownSection =
        (this.filenameparts.hasBlockref || this.filenameparts.hasSectionref) &&
        !(
          this.filenameparts.hasGroupref ||
          this.filenameparts.hasArearef ||
          this.filenameparts.hasFrameref ||
          this.filenameparts.hasClippedFrameref
        );
      this.filenameparts.filepath = this.file.path;
    }
  }

  private fileChanged(): boolean {
    if (this.isHyperLink || this.isLocalLink) {
      return false;
    }
    if (!this.file) {
      this.file = this.plugin.app.metadataCache.getFirstLinkpathDest(
        this.linkParts.path,
        this.hostPath,
      ); // maybe the file has synchronized in the mean time
      if (!this.file) {
        this.attemptCounter++;
        return false;
      }
    }
    return this.mtime !== this.file.stat.mtime;
  }

  public setImage({
    imgBase64,
    mimeType,
    size,
    isDark,
    isSVGwithBitmap,
    pdfPageViewProps,
    renderScale,
  }: {
    imgBase64: string;
    mimeType: MimeType;
    size: Size;
    isDark: boolean;
    isSVGwithBitmap: boolean;
    pdfPageViewProps?: PDFPageViewProps;
    renderScale?: number;
  }) {
    if (!this.file && !this.isHyperLink && !this.isLocalLink) {
      return;
    }
    if (this.fileChanged()) {
      this.imgInverted = this.img = "";
    }
    this.isSVGwithBitmap = isSVGwithBitmap;
    this.mtime =
      this.isHyperLink || this.isLocalLink ? 0 : this.file.stat.mtime;
    this.pdfPageViewProps = pdfPageViewProps;
    this.renderScale = renderScale ?? 0;
    this.size = size;
    this.mimeType = mimeType;
    switch (isDark && this.hasSeparateDarkAndLightVersion) {
      case true:
        this.imgInverted = imgBase64;
        break;
      case false:
        this.img = imgBase64;
        break; //bitmaps and SVGs without an embedded bitmap do not need a negative image
    }
  }

  public isLoaded(isDark: boolean): boolean {
    if (!this.isHyperLink && !this.isLocalLink) {
      if (!this.file) {
        this.file = this.plugin.app.metadataCache.getFirstLinkpathDest(
          this.linkParts.path,
          this.hostPath,
        ); // maybe the file has synchronized in the mean time
        if (!this.file) {
          this.attemptCounter++;
          return true;
        }
      }
      if (this.fileChanged()) {
        return false;
      }
      if (
        this.file.extension?.toLowerCase?.() === "pdf" &&
        this.renderScale > 0
      ) {
        const hasImageForTheme =
          this.hasSeparateDarkAndLightVersion && isDark
            ? this.imgInverted !== ""
            : this.img !== "";
        return (
          hasImageForTheme && this.renderScale >= this.plugin.settings.pdfScale
        );
      }
    }
    if (this.hasSeparateDarkAndLightVersion && isDark) {
      return this.imgInverted !== "";
    }
    return this.img !== "";
  }

  public getImage(isDark: boolean) {
    if (!this.file && !this.isHyperLink && !this.isLocalLink) {
      return "";
    }
    if (this.hasSeparateDarkAndLightVersion && isDark) {
      return this.imgInverted;
    }
    return this.img; //images that are not SVGwithBitmap, only the light string is stored, since inverted and non-inverted are ===
  }

  /**
   *
   * @returns true if image should scale such as the updated images has the same area as the previous images, false if the image should be displayed at 100%
   */
  public shouldScale() {
    return (
      this.isHyperLink ||
      this.isLocalLink ||
      !(
        this.linkParts &&
        this.linkParts.original &&
        this.linkParts.original.endsWith("|100%")
      )
    );
  }
}

export class EmbeddedFilesLoader {
  private pdfDocsMap: Map<string, PdfJsDocumentProxy> = new Map();
  private pdfDocs: Set<PdfJsDocumentProxy> = new Set();
  private plugin: ExcalidrawPlugin;
  private isDark: boolean;
  public terminate = false;
  public uid: string;

  constructor(plugin: ExcalidrawPlugin, isDark?: boolean) {
    this.plugin = plugin;
    this.isDark = isDark;
    this.uid = nanoid();
  }

  public emptyPDFDocsMap() {
    this.pdfDocs.forEach((pdfDoc) => {
      try {
        pdfDoc.destroy();
      } catch (e: unknown) {
        errorlog({ where: "EmbeddedFileLoader.emptyPDFDocsMap", error: e });
      }
    });
    this.pdfDocs.clear();
    this.pdfDocsMap.clear();
  }

  public async getObsidianImage(
    inFile: TFile | EmbeddedFile,
    depth: number,
  ): Promise<{
    mimeType: MimeType;
    fileId: FileId;
    dataURL: DataURL;
    created: number;
    hasSVGwithBitmap: boolean;
    size: { height: number; width: number };
    pdfPageViewProps?: PDFPageViewProps;
  }> {
    try {
      return await this._getObsidianImage(inFile, depth);
    } finally {
      this.emptyPDFDocsMap();
    }
  }

  private async getExcalidrawSVG({
    isDark,
    file,
    depth,
    inFile,
    hasSVGwithBitmap,
    elements = [],
    cacheValidation = "validated",
    onStaleCacheHit,
  }: {
    isDark: boolean;
    file: TFile;
    depth: number;
    inFile: TFile | EmbeddedFile;
    hasSVGwithBitmap: boolean;
    elements?: ExcalidrawElement[];
    cacheValidation?: CacheValidationMode;
    onStaleCacheHit?: () => void;
  }): Promise<{
    dataURL: DataURL;
    hasSVGwithBitmap: boolean;
    loadedFromCache?: boolean;
  }> {
    if (this.terminate) {
      return { dataURL: "" as DataURL, hasSVGwithBitmap: false };
    }
    //debug({where:"EmbeddedFileLoader.getExcalidrawSVG",uid:this.uid,file:file.name});
    const isMask = isMaskFile(this.plugin, file);
    const forceTheme = hasExportTheme(this.plugin, file)
      ? getExportTheme(this.plugin, file, "light")
      : undefined;
    const exportSettings: ExportSettings = {
      withBackground: hasExportBackground(this.plugin, file)
        ? getWithBackground(this.plugin, file)
        : false,
      withTheme: !!forceTheme,
      isMask,
      skipInliningFonts: false,
    };

    const hasColorMap = Boolean(
      inFile instanceof EmbeddedFile ? inFile.colorMap : null,
    );
    const shouldUseCache =
      !hasColorMap &&
      this.plugin.settings.allowImageCacheInScene &&
      file &&
      getImageCache().isReady();
    const hasFilenameParts = Boolean(
      inFile instanceof EmbeddedFile && inFile.filenameparts,
    );
    const filenameParts = hasFilenameParts
      ? (inFile as EmbeddedFile).filenameparts
      : null;
    const cacheKey: ImageKey = {
      ...(hasFilenameParts
        ? {
            ...filenameParts,
            inlineFonts: !exportSettings.skipInliningFonts,
          }
        : {
            filepath: file.path,
            hasBlockref: false,
            hasGroupref: false,
            hasTaskbone: false,
            hasArearef: false,
            hasFrameref: false,
            hasClippedFrameref: false,
            hasSectionref: false,
            inlineFonts: !exportSettings.skipInliningFonts,
            blockref: null,
            sectionref: null,
            linkpartReference: null,
            linkpartAlias: null,
          }),
      isDark,
      previewImageType: PreviewImageType.SVG,
      scale: 1,
      isTransparent: !exportSettings.withBackground,
    };

    const maybeSVG = shouldUseCache
      ? await getImageCache().getImageFromCache(cacheKey, {
          skipDependencyCheck: cacheValidation === "stale-first",
        })
      : undefined;

    if (this.terminate) {
      return { dataURL: "" as DataURL, hasSVGwithBitmap: false };
    }

    if (maybeSVG && cacheValidation === "stale-first") {
      onStaleCacheHit?.();
    }

    const svg =
      maybeSVG && maybeSVG instanceof SVGSVGElement
        ? maybeSVG
        : (replaceSVGColors(
            await createSVG(
              hasFilenameParts
                ? filenameParts.hasGroupref ||
                  filenameParts.hasBlockref ||
                  filenameParts.hasSectionref ||
                  filenameParts.hasFrameref ||
                  filenameParts.hasClippedFrameref
                  ? filenameParts.filepath + filenameParts.linkpartReference
                  : file.path
                : file?.path,
              false, //false
              hasFilenameParts && filenameParts.hasClippedFrameref
                ? {
                    ...exportSettings,
                    frameRendering: {
                      enabled: true,
                      name: false,
                      outline: false,
                      clip: true,
                    },
                  }
                : exportSettings,
              this,
              forceTheme,
              null,
              null,
              elements,
              this.plugin,
              depth + 1,
              getExportPadding(this.plugin, file),
            ),
            inFile instanceof EmbeddedFile ? inFile.colorMap : null,
          ) as SVGSVGElement);

    if (this.terminate) {
      return { dataURL: "" as DataURL, hasSVGwithBitmap: false };
    }

    //https://stackoverflow.com/questions/51154171/remove-css-filter-on-child-elements
    const imageList = svg.querySelectorAll(
      "image:not([href^='data:image/svg'])",
    );
    if (imageList.length > 0) {
      hasSVGwithBitmap = true;
    }

    if (hasSVGwithBitmap && isDark && !maybeSVG) {
      imageList.forEach((i) => {
        const id = i.parentElement?.id;
        if (id.endsWith("-invert-bitmap")) {
          return;
        }
        svg.querySelectorAll(`use[href='#${id}']`).forEach((u) => {
          u.setAttribute("filter", THEME_FILTER);
        });
      });
    }

    const svgsToInvert = svg.querySelectorAll("symbol[id$='-no-invert-svg']");

    if (svgsToInvert.length > 0) {
      hasSVGwithBitmap = true;
    }

    if (svgsToInvert.length > 0 && isDark && !maybeSVG) {
      svgsToInvert.forEach((i) => {
        const id = i.id;
        svg.querySelectorAll(`use[href='#${id}']`).forEach((u) => {
          u.setAttribute("filter", THEME_FILTER);
        });
      });
    }

    if (!hasSVGwithBitmap && svg.getAttribute("hasbitmap")) {
      hasSVGwithBitmap = true;
    }
    if (shouldUseCache && !maybeSVG) {
      //cache SVG should have the width and height parameters and not the embedded font
      //see svgWithFont below
      getImageCache().addImageToCache(cacheKey, "", svg);
    }

    if (!svg.hasAttribute("width") && svg.hasAttribute("viewBox")) {
      //2024.06.09
      //this addresses backward compatibility issues where the cache does not have the width and height attributes
      //this should be removed in the future
      const vb = svg.getAttr("viewBox").split(" ");
      if (vb[2]) {
        svg.setAttribute("width", vb[2]);
      }
      if (vb[3]) {
        svg.setAttribute("height", vb[3]);
      }
    }
    const dURL = svgToBase64(svg.outerHTML) as DataURL;
    return {
      dataURL: dURL,
      hasSVGwithBitmap,
      loadedFromCache: Boolean(maybeSVG),
    };
  }

  //this is a fix for backward compatibility - I messed up with generating the local link
  private getLocalPath(path: string) {
    const localPath = path.split("file://")[1];
    if (localPath.startsWith("/")) {
      return localPath.substring(1);
    }
    return localPath;
  }

  private async _getObsidianImage(
    inFile: TFile | EmbeddedFile,
    depth: number,
    options?: LoadImageOptions,
  ): Promise<ImgData> {
    if (!this.plugin || !inFile) {
      return null;
    }

    try {
      const app = this.plugin.app;

      const isHyperLink =
        inFile instanceof EmbeddedFile ? inFile.isHyperLink : false;
      const isLocalLink =
        inFile instanceof EmbeddedFile ? inFile.isLocalLink : false;
      const isMarkdownSection =
        inFile instanceof EmbeddedFile ? inFile.isMarkdownSection : false;
      const hyperlink = inFile instanceof EmbeddedFile ? inFile.hyperlink : "";
      const file: TFile = inFile instanceof EmbeddedFile ? inFile.file : inFile;
      if (file && markdownRendererRecursionWatcthdog.has(file)) {
        new Notice(
          `Loading of ${file.path}. Please check if there is an inifinite loop of one file embedded in the other.`,
        );
        return null;
      }

      const linkParts = isHyperLink
        ? null
        : inFile instanceof EmbeddedFile
          ? inFile.linkParts
          : {
              original: file.path,
              path: file.path,
              isBlockRef: false,
              ref: null,
              width: this.plugin.settings.mdSVGwidth,
              height: this.plugin.settings.mdSVGmaxHeight,
              page: null,
            };

      let hasSVGwithBitmap = false;
      const isExcalidrawFile =
        !isMarkdownSection &&
        !isHyperLink &&
        !isLocalLink &&
        this.plugin.isExcalidrawFile(file);
      const isPDF =
        !isHyperLink && !isLocalLink && file.extension.toLowerCase() === "pdf";

      if (
        !isHyperLink &&
        !isPDF &&
        !isLocalLink &&
        !(
          IMAGE_TYPES.contains(file.extension) ||
          isExcalidrawFile ||
          file.extension === "md"
        )
      ) {
        return null;
      }
      const ab =
        isHyperLink || isPDF || isExcalidrawFile
          ? null
          : isLocalLink
            ? await readLocalFileBinary(
                this.getLocalPath((inFile as EmbeddedFile).hyperlink),
              )
            : await app.vault.readBinary(file);

      if (this.terminate) {
        return null;
      }

      let dURL: DataURL = null;
      let excalidrawLoadedFromCache = false;
      if (isExcalidrawFile) {
        const res = await this.getExcalidrawSVG({
          isDark: this.isDark,
          file,
          depth,
          inFile,
          hasSVGwithBitmap,
          cacheValidation: options?.cacheValidation,
          onStaleCacheHit: options?.onStaleCacheHit,
        });

        if (this.terminate) {
          return null;
        }
        dURL = res.dataURL;
        hasSVGwithBitmap = res.hasSVGwithBitmap;
        excalidrawLoadedFromCache = !!res.loadedFromCache;
      }

      const excalidrawSVG = isExcalidrawFile ? dURL : null;

      const [
        pdfDataURL,
        pdfSize,
        pdfPageViewProps,
        pdfRenderScale,
        pdfLoadedFromCache,
      ] = isPDF
        ? await this.pdfToDataURL(file, linkParts, options)
        : [null, null, null, null, false];

      if (this.terminate) {
        return null;
      }

      let mimeType: MimeType = isPDF ? "image/png" : "image/svg+xml";

      const extension =
        isHyperLink || isLocalLink
          ? getURLImageExtension(hyperlink)
          : file.extension;
      if (!isExcalidrawFile && !isPDF) {
        mimeType = getMimeType(extension);
      }

      let dataURL = isHyperLink
        ? inFile instanceof EmbeddedFile
          ? await getDataURLFromURL(inFile.hyperlink, mimeType)
          : null
        : (excalidrawSVG ??
          pdfDataURL ??
          (file?.extension === "svg"
            ? await getSVGData(
                app,
                file,
                inFile instanceof EmbeddedFile ? inFile.colorMap : null,
              )
            : file?.extension === "md"
              ? null
              : await getDataURL(ab, mimeType)));

      if (this.terminate) {
        return null;
      }

      if (!isHyperLink && !dataURL && !isLocalLink) {
        markdownRendererRecursionWatcthdog.add(file);
        try {
          const result = await this.convertMarkdownToSVG(
            this.plugin,
            file,
            linkParts,
          );
          dataURL = result.dataURL;
          hasSVGwithBitmap = result.hasSVGwithBitmap;
        } finally {
          markdownRendererRecursionWatcthdog.delete(file);
        }
      }

      const size = isPDF ? pdfSize : await getImageSize(dataURL);

      if (this.terminate) {
        return null;
      }

      return {
        mimeType,
        fileId: await generateIdFromFile(
          isHyperLink || isPDF || isExcalidrawFile
            ? new TextEncoder().encode(dataURL).buffer
            : ab,
          inFile instanceof EmbeddedFile
            ? inFile.filenameparts?.linkpartReference
            : undefined,
        ),
        dataURL,
        created: isHyperLink || isLocalLink ? 0 : file.stat.mtime,
        loadedFromCache: isExcalidrawFile
          ? excalidrawLoadedFromCache
          : pdfLoadedFromCache,
        hasSVGwithBitmap,
        size,
        pdfPageViewProps,
        renderScale: pdfRenderScale,
      };
    } catch (error: unknown) {
      errorlog({
        where: "EmbeddedFileLoader._getObsidianImage",
        uid: this.uid,
        file:
          inFile instanceof EmbeddedFile
            ? (inFile.file?.path ?? inFile.hyperlink)
            : inFile?.path,
        depth,
        error,
      });
      return null;
    }
  }

  public async loadSceneFiles({
    excalidrawData,
    addFiles,
    depth,
    isThemeChange = false,
    // the fileIDWhitelist is designed to support partial loading of Excalidraw drawings.
    // See getTemplate in excalidrawAutomateUtils. By providing the whitelist loading the scene will skip images
    // not on the list (e.g. when rendering an image fragment based on a groupID or frame reference)
    fileIDWhiteList,
    forceReloadFileIDs,
    cacheValidation = "validated",
    validationConcurrency,
    emitPolicy = "all",
    onDeferredValidationCandidates,
  }: {
    excalidrawData: ExcalidrawData;
    addFiles: (files: FileData[], isDark: boolean, final?: boolean) => void;
    depth: number;
    isThemeChange?: boolean;
    fileIDWhiteList?: Set<FileId>;
    forceReloadFileIDs?: Set<FileId>;
    cacheValidation?: CacheValidationMode;
    validationConcurrency?: number;
    emitPolicy?: LoadSceneEmitPolicy;
    onDeferredValidationCandidates?: (fileIds: Set<FileId>) => void;
  }) {
    if (depth > 7) {
      new Notice(t("INFINITE_LOOP_WARNING") + depth.toString(), 6000);
      return;
    }
    const entries = Array.from(excalidrawData.getFileEntries());
    //debug({where:"EmbeddedFileLoader.loadSceneFiles",uid:this.uid,isDark:this.isDark,sceneTheme:excalidrawData.scene.appState.theme});
    if (this.isDark === undefined) {
      this.isDark = excalidrawData?.scene?.appState?.theme === "dark";
    }
    const createSafeLoadTask = (
      task: () => Promise<void>,
      context: Record<string, unknown>,
    ) =>
      promiseTry(async () => {
        try {
          await task();
        } catch (error: unknown) {
          errorlog({
            where: "EmbeddedFileLoader.loadSceneFiles",
            uid: this.uid,
            ...context,
            error,
          });
        }
      });
    const files: FileData[][] = [];
    files.push([]);
    let batch = 0;
    // Only stale-first cache hits are queued for the cheap second pass.
    const deferredValidationFileIds = new Set<FileId>();

    function* loadIterator(
      this: EmbeddedFilesLoader,
    ): Generator<Promise<void>> {
      for (const entry of entries) {
        if (fileIDWhiteList && !fileIDWhiteList.has(entry[0])) {
          continue;
        }
        const embeddedFile: EmbeddedFile = entry[1];
        const id = entry[0];
        yield createSafeLoadTask(
          async () => {
            if (this.terminate) {
              return;
            }
            const shouldForceReload = forceReloadFileIDs?.has(id);
            if (shouldForceReload || !embeddedFile.isLoaded(this.isDark)) {
              //debug({where:"EmbeddedFileLoader.loadSceneFiles",uid:this.uid,status:"embedded Files are not loaded"});
              const data = await this._getObsidianImage(embeddedFile, depth, {
                cacheValidation,
                onStaleCacheHit:
                  cacheValidation === "stale-first"
                    ? () => deferredValidationFileIds.add(id)
                    : undefined,
              });
              if (this.terminate) {
                return null;
              }

              if (data) {
                const fileData: FileData = {
                  mimeType: data.mimeType,
                  id,
                  dataURL: data.dataURL,
                  created: data.created,
                  loadedFromCache: data.loadedFromCache,
                  size: data.size,
                  hasSVGwithBitmap: data.hasSVGwithBitmap,
                  shouldScale: embeddedFile.shouldScale(),
                  pdfPageViewProps: data.pdfPageViewProps,
                  renderScale: data.renderScale,
                };
                files[batch].push(fileData);
              }
            } else if (
              embeddedFile.hasSeparateDarkAndLightVersion &&
              (depth !== 0 || isThemeChange)
            ) {
              //this will reload the image in light/dark mode when switching themes
              const fileData: FileData = {
                mimeType: embeddedFile.mimeType,
                id,
                dataURL: embeddedFile.getImage(this.isDark) as DataURL,
                created: embeddedFile.mtime,
                size: embeddedFile.size,
                hasSVGwithBitmap: embeddedFile.isSVGwithBitmap,
                shouldScale: embeddedFile.shouldScale(),
                pdfPageViewProps: embeddedFile.pdfPageViewProps,
                renderScale: embeddedFile.renderScale,
              };
              files[batch].push(fileData);
            }
          },
          {
            phase: "embedded-file",
            fileId: id,
            filepath: embeddedFile.file?.path ?? embeddedFile.hyperlink,
            depth,
          },
        );
      }

      let equationItem;
      const equations = excalidrawData.getEquationEntries();
      while (!(equationItem = equations.next()).done) {
        const eiValue = equationItem.value as [FileId, EquationItem];
        if (fileIDWhiteList && !fileIDWhiteList.has(eiValue[0])) {
          continue;
        }
        const equation = eiValue[1];
        const id = eiValue[0];
        yield createSafeLoadTask(
          async () => {
            if (this.terminate) {
              return;
            }
            if (!excalidrawData.getEquation(id).isLoaded) {
              const latex = equation.latex;
              const data = await tex2dataURL(latex, 4, this.plugin);
              if (this.terminate) {
                return null;
              }
              if (data) {
                const fileData = {
                  mimeType: data.mimeType,
                  id,
                  dataURL: data.dataURL,
                  created: data.created,
                  size: data.size,
                  hasSVGwithBitmap: false,
                  shouldScale: true,
                };
                files[batch].push(fileData);
              }
            }
          },
          {
            phase: "equation",
            fileId: id,
            latex: equation?.latex,
          },
        );
      }

      if (shouldRenderMermaid()) {
        const mermaidElements = getMermaidImageElements(
          excalidrawData.scene.elements,
        );
        for (const element of mermaidElements) {
          yield createSafeLoadTask(
            async () => {
              if (this.terminate) {
                return;
              }
              const data = getMermaidText(element);
              const result = await mermaidToExcalidraw(data, {
                themeVariables: { fontSize: "20" },
              });
              if (!result || this.terminate) {
                return;
              }
              if (result?.files) {
                for (const key in result.files) {
                  const fileData = {
                    ...result.files[key],
                    id: element.fileId,
                    created: Date.now(),
                    hasSVGwithBitmap: false,
                    shouldScale: true,
                    size: await getImageSize(result.files[key].dataURL),
                  } as FileData;
                  files[batch].push(fileData);
                }
                return;
              }
              if (result?.elements) {
                //handle case that mermaidToExcalidraw has implemented this type of diagram in the mean time
                if (this.terminate) {
                  return;
                }
                const res = await this.getExcalidrawSVG({
                  isDark: this.isDark,
                  file: null,
                  depth,
                  inFile: null,
                  hasSVGwithBitmap: false,
                  elements: result.elements,
                });
                if (this.terminate) {
                  return;
                }
                if (res?.dataURL) {
                  const size = await getImageSize(res.dataURL);
                  const fileData: FileData = {
                    mimeType: "image/svg+xml",
                    id: element.fileId,
                    dataURL: res.dataURL,
                    created: Date.now(),
                    hasSVGwithBitmap: res.hasSVGwithBitmap,
                    size,
                    shouldScale: true,
                  };
                  files[batch].push(fileData);
                }
              }
            },
            {
              phase: "mermaid",
              fileId: element.fileId,
              elementId: element.id,
            },
          );
        }
      }
    }

    const addFilesTimer = window.setInterval(() => {
      if (this.terminate) {
        window.clearInterval(addFilesTimer);
        return;
      }
      if (files[batch].length === 0) {
        return;
      }
      // During deferred validation, only regenerated results should reach addFiles.
      const batchFiles = files[batch].filter(
        (f) => emitPolicy === "all" || !f.loadedFromCache,
      );
      try {
        addFiles(batchFiles, this.isDark, false);
      } catch (e) {
        errorlog({ where: "EmbeddedFileLoader.loadSceneFiles", error: e });
      }
      files.push([]);
      batch++;
    }, 1200);

    try {
      const iterator = loadIterator.bind(this)();
      const concurency =
        validationConcurrency ?? this.plugin.settings.renderingConcurrency;
      if (!this.terminate) {
        await new PromisePool(iterator, concurency).all();
      }

      if (this.terminate) {
        addFiles(undefined, this.isDark, true);
        return;
      }
      //debug({where:"EmbeddedFileLoader.loadSceneFiles",uid:this.uid,status:"add Files"});
      if (deferredValidationFileIds.size > 0) {
        onDeferredValidationCandidates?.(deferredValidationFileIds);
      }
      // Same filter for the final flush so validated cache hits remain a no-op.
      const batchFiles = files[batch].filter(
        (f) => emitPolicy === "all" || !f.loadedFromCache,
      );
      try {
        //in try block because by the time files are loaded the user may have closed the view
        addFiles(batchFiles, this.isDark, true);
      } catch (e) {
        errorlog({ where: "EmbeddedFileLoader.loadSceneFiles", error: e });
      }
    } finally {
      window.clearInterval(addFilesTimer);
      this.emptyPDFDocsMap();
    }
  }

  private async pdfToDataURL(
    file: TFile,
    linkParts: LinkParts,
    options?: LoadImageOptions,
  ): Promise<[DataURL, Size, PDFPageViewProps, number, boolean]> {
    try {
      let width = 0;
      let height = 0;
      const pageNum = isNaN(linkParts.page) ? 1 : (linkParts.page ?? 1);
      const requestedScale = this.plugin.settings.pdfScale;
      const shouldUseCache =
        getImageCache().isReady() &&
        (!options || this.plugin.settings.allowImageCacheInScene);
      const cacheKey: ImageKey = {
        filepath: file.path,
        cacheId: getPDFCacheId(linkParts, pageNum),
        hasBlockref: false,
        hasGroupref: false,
        hasTaskbone: false,
        hasArearef: false,
        hasFrameref: false,
        hasClippedFrameref: false,
        hasSectionref: false,
        blockref: null,
        sectionref: null,
        linkpartReference: null,
        linkpartAlias: null,
        isDark: !!this.isDark,
        previewImageType: PreviewImageType.PNG,
        scale: 0,
        isTransparent: false,
        inlineFonts: false,
      };
      const cachedData = shouldUseCache
        ? await getImageCache().getImageCacheData(cacheKey, {
            skipDependencyCheck: options?.cacheValidation === "stale-first",
            minRenderScale:
              options?.cacheValidation === "stale-first"
                ? undefined
                : requestedScale,
          })
        : undefined;

      if (cachedData?.blob) {
        const cachedScale = cachedData.renderScale ?? requestedScale;
        // Stale-first accepts an older PDF raster immediately, but still marks it
        // for deferred validation when the requested scale has increased.
        if (
          options?.cacheValidation === "stale-first" &&
          cachedScale < requestedScale
        ) {
          options?.onStaleCacheHit?.();
        }
        return [
          `data:image/png;base64,${await blobToBase64(cachedData.blob)}` as DataURL,
          cachedData.size,
          cachedData.pdfPageViewProps,
          cachedScale,
          true,
        ];
      }

      let pdfDoc = this.pdfDocsMap.get(file.path);
      if (!pdfDoc) {
        pdfDoc = await getPDFDoc(file);
        if (!pdfDoc) {
          return [null, null, null, null, false];
        }
        this.pdfDocs.add(pdfDoc);
        if (!this.pdfDocsMap.has(file.path)) {
          this.pdfDocsMap.set(file.path, pdfDoc);
        }
      } else {
        this.pdfDocs.add(pdfDoc);
      }

      const scale = requestedScale;
      const cropRect = linkParts.ref
        .split("rect=")[1]
        ?.split(",")
        .map((x) => parseInt(x));
      const validRect =
        cropRect && cropRect.length === 4 && cropRect.every((x) => !isNaN(x));
      let viewProps: PDFPageViewProps;

      const shouldRetryWithFreshDoc = (e: unknown): boolean => {
        const message = `${
          typeof e === "object" && e !== null && "message" in e
            ? String((e as { message?: unknown }).message ?? "")
            : String(e ?? "")
        }`;
        return (
          message.includes("sendWithPromise") ||
          message.includes("WorkerTransport") ||
          message.includes("Cannot read properties of null")
        );
      };

      // Render the page
      const renderPage = async (num: number) => {
        //when obsidian loads there seems to be an occasional race condition where the rendering is cancelled
        //this is a workaround for that
        const maxRetries = 4;
        for (let i = 0; i < maxRetries; i++) {
          const canvas = createEl("canvas");
          try {
            if (this.terminate) {
              return null;
            }

            const ctx = canvas.getContext("2d");
            // Get page
            const page = await pdfDoc.getPage(num);
            // Set scale
            const viewport = page.getViewport({ scale });
            height = canvas.height = Math.round(viewport.height);
            width = canvas.width = Math.round(viewport.width);

            const renderCtx = {
              canvasContext: ctx,
              background: "rgba(0,0,0,0)",
              viewport,
            };

            await page.render(renderCtx).promise;

            const [left, bottom, right, top] = page.view;
            viewProps = { left, bottom, right, top };
            viewProps.rotate = page.rotate;

            if (validRect) {
              const pageHeight = top - bottom;
              const pageWidth = right - left;

              if (!page.rotate || page.rotate === 0) {
                width = (cropRect[2] - cropRect[0]) * scale;
                height = (cropRect[3] - cropRect[1]) * scale;

                const crop = {
                  left: (cropRect[0] - left) * scale,
                  top: (bottom + pageHeight - cropRect[3]) * scale,
                  width,
                  height,
                };
                return cropCanvas(canvas, crop);
              }
              if (page.rotate === 90) {
                width = (cropRect[3] - cropRect[1]) * scale;
                height = (cropRect[2] - cropRect[0]) * scale;
                const crop = {
                  left: cropRect[1] * scale,
                  top: (pageHeight - cropRect[2]) * scale,
                  width,
                  height,
                };
                return cropCanvas(canvas, crop);
              }

              if (page.rotate === 180) {
                width = (cropRect[2] - cropRect[0]) * scale;
                height = (cropRect[3] - cropRect[1]) * scale;
                const crop = {
                  left: (pageWidth - cropRect[2]) * scale,
                  top: cropRect[1] * scale,
                  width,
                  height,
                };
                return cropCanvas(canvas, crop);
              }

              if (page.rotate === 270) {
                width = (cropRect[3] - cropRect[1]) * scale;
                height = (cropRect[2] - cropRect[0]) * scale;
                const crop = {
                  left: (pageWidth - cropRect[3]) * scale,
                  top: cropRect[0] * scale,
                  width,
                  height,
                };
                return cropCanvas(canvas, crop);
              }
            }

            return canvas;
          } catch (e) {
            canvas.width = 0;
            canvas.height = 0;

            if (i === maxRetries - 1) {
              throw e;
            } // Throw on last retry

            if (shouldRetryWithFreshDoc(e)) {
              const previousDoc = pdfDoc;
              const freshDoc = await getPDFDoc(file);
              if (freshDoc) {
                pdfDoc = freshDoc;
                this.pdfDocs.add(freshDoc);
                if (this.pdfDocsMap.get(file.path) === previousDoc) {
                  this.pdfDocsMap.set(file.path, freshDoc);
                }
              }
            }

            await sleep(50 * (i + 1));
            continue;
          }
        }
        return null;
      };

      const canvas = await renderPage(pageNum);
      if (this.terminate) {
        return [null, null, null, null, false];
      }
      if (canvas) {
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((pngBlob) => {
            if (!pngBlob) {
              reject(new Error("Failed to convert PDF canvas to blob."));
              return;
            }
            resolve(pngBlob);
          });
        });
        const base64 = await blobToBase64(blob);
        if (shouldUseCache) {
          getImageCache().addImageToCache(cacheKey, "", blob, {
            renderScale: requestedScale,
            size: { width, height },
            pdfPageViewProps: viewProps,
          });
        }
        const result: [DataURL, Size, PDFPageViewProps, number, boolean] = [
          `data:image/png;base64,${base64}` as DataURL,
          { width, height },
          viewProps,
          requestedScale,
          false,
        ];
        canvas.width = 0; //free memory iOS bug
        canvas.height = 0;
        return result;
      }
    } catch (e: unknown) {
      errorlog({
        where: "EmbeddedFileLoader.pdfToDataURL",
        uid: this.uid,
        error: e,
      });
      return [null, null, null, null, false];
    }
  }

  private async convertMarkdownToSVG(
    plugin: ExcalidrawPlugin,
    file: TFile,
    linkParts: LinkParts,
  ): Promise<{ dataURL: DataURL; hasSVGwithBitmap: boolean }> {
    if (this.terminate) {
      return { dataURL: "" as DataURL, hasSVGwithBitmap: false };
    }
    //1.
    //get the markdown text
    let hasSVGwithBitmap = false;
    const transclusion = await getTransclusion(linkParts, plugin.app, file);
    if (this.terminate) {
      return { dataURL: "" as DataURL, hasSVGwithBitmap: false };
    }
    let text = (transclusion.leadingHashes ?? "") + transclusion.contents;
    if (text === "") {
      text =
        "# Empty markdown file\nCTRL+Click here to open the file for editing in the current active pane, or CTRL+SHIFT+Click to open it in an adjacent pane.";
    }

    //2.
    //get styles

    const fileCache = plugin.app.metadataCache.getFileCache(file);
    let fontDef: string;
    let fontName = plugin.settings.mdFont;
    const safeFrontmatter = getSafeFrontmatter(fileCache?.frontmatter);
    if (safeFrontmatter[FRONTMATTER_KEYS.font.name]) {
      fontName = safeFrontmatter[FRONTMATTER_KEYS.font.name];
    }
    switch (fontName) {
      case "Virgil":
        fontDef = await getCSSFontDefinition(1);
        break;
      case "Cascadia":
        fontDef = await getCSSFontDefinition(3);
        break;
      case "Assistant":
      case "Helvetica":
        fontDef = await getCSSFontDefinition(2); //retruns empty string
        break;
      case "Excalifont":
        fontDef = await getCSSFontDefinition(5);
        break;
      case "Nunito":
        fontDef = await getCSSFontDefinition(6);
        break;
      case "Lilita One":
        fontDef = await getCSSFontDefinition(7);
        break;
      case "Comic Shanns":
        fontDef = await getCSSFontDefinition(8);
        break;
      case "Liberation Sans":
        fontDef = await getCSSFontDefinition(9);
        break;
      case "":
        fontDef = "";
        break;
      default: {
        const font = await getFontDataURL(plugin.app, fontName, file.path);
        fontDef = font.fontDef;
        fontName = font.fontName;
      }
    }

    if (fileCache?.frontmatter && fileCache.frontmatter.banner !== null) {
      text = text.replace(/banner:\s*.*/, ""); //patch https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/814
    }

    const fmFontColor = safeFrontmatter[FRONTMATTER_KEYS["font-color"].name];
    const fontColor = fmFontColor ?? plugin.settings.mdFontColor;
    let style: string = safeFrontmatter[FRONTMATTER_KEYS["md-css"].name] ?? "";

    let frontmatterCSSisAfile = false;
    if (style && style !== "") {
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
        style += f
          ? `\n${await plugin.app.vault.read(f)}`
          : DEFAULT_MD_EMBED_CSS;
      } else {
        style += DEFAULT_MD_EMBED_CSS;
      }
    }

    const borderColor: string =
      safeFrontmatter[FRONTMATTER_KEYS["border-color"].name] ??
      plugin.settings.mdBorderColor;

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
    if (fontName !== "") {
      setStyle(mdDIV, { fontFamily: fontName });
    }
    setStyle(mdDIV, {
      overflow: "auto",
      display: "block",
      color: fontColor && fontColor !== "" ? fontColor : "initial",
    });

    const renderComponent = new Component();
    renderComponent.load();
    try {
      //await MarkdownRenderer.renderMarkdown(text, mdDIV, file.path, plugin);
      await MarkdownRenderer.render(
        this.plugin.app,
        text,
        mdDIV,
        file.path,
        renderComponent,
      );
    } finally {
      renderComponent.unload();
    }
    if (this.terminate) {
      return { dataURL: "" as DataURL, hasSVGwithBitmap: false };
    }

    mdDIV
      .querySelectorAll(":scope > *[class^='frontmatter']")
      .forEach((el) => mdDIV.removeChild(el));

    await replaceBlobWithBase64(mdDIV); //because image cache returns a blob
    if (this.terminate) {
      return { dataURL: "" as DataURL, hasSVGwithBitmap: false };
    }
    const internalEmbeds = Array.from(
      mdDIV.querySelectorAll("span[class='internal-embed']"),
    );
    for (let i = 0; i < internalEmbeds.length; i++) {
      if (this.terminate) {
        return { dataURL: "" as DataURL, hasSVGwithBitmap: false };
      }
      const el = internalEmbeds[i];
      const src = el.getAttribute("src");
      if (!src) {
        continue;
      }
      const width = el.getAttribute("width");
      const height = el.getAttribute("height");
      const ef = new EmbeddedFile(plugin, file.path, src);
      //const f = app.metadataCache.getFirstLinkpathDest(src.split("#")[0],file.path);
      if (!ef.file) {
        continue;
      }
      const embeddedFile = await this._getObsidianImage(ef, 1);
      if (this.terminate) {
        return { dataURL: "" as DataURL, hasSVGwithBitmap: false };
      }
      const img = createEl("img");
      if (width) {
        img.setAttribute("width", width);
      }
      if (height) {
        img.setAttribute("height", height);
      }
      img.src = embeddedFile.dataURL;
      el.replaceWith(img);
    }

    //5.1
    //get SVG size.
    //First I need to create a fully self contained copy of the document to convert
    //blank styles into inline styles using computedStyle
    const iframeHost = mainDocument.body.createDiv();
    hideElement(iframeHost);
    let xmlINiframe = "";
    let xmlFooter = "";
    try {
      const iframe = iframeHost.createEl("iframe");
      const iframeDoc = iframe.contentWindow.document;
      if (style) {
        const styleEl = iframeDoc.createElement("style");
        setStyleText(styleEl, style);
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
        for (const [prop] of Object.entries(elementStyle)) {
          if (Object.hasOwn(elementStyle ?? {}, prop)) {
            const value = computedStyle.getPropertyValue(prop);
            style += `${prop}: ${value};`;
          }
        }
        el.setAttribute("style", style);
      });

      xmlINiframe = new XMLSerializer().serializeToString(stylingDIV);
      xmlFooter = new XMLSerializer().serializeToString(footerDIV);
    } finally {
      if (iframeHost.parentElement) {
        mainDocument.body.removeChild(iframeHost);
      }
    }

    //5.2
    //get SVG size
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      svg(xmlINiframe, xmlFooter),
      "image/svg+xml",
    );
    const svgEl = doc.firstElementChild;
    const host = createDiv();
    let svgHeight = 0;
    let footerHeight = 0;
    try {
      host.appendChild(svgEl);
      mainDocument.body.appendChild(host);
      footerHeight = svgEl.querySelector(".excalidraw-md-footer").scrollHeight;
      const height =
        svgEl.querySelector(".excalidraw-md-host").scrollHeight + footerHeight;
      svgHeight = height <= linkParts.height ? height : linkParts.height;
    } finally {
      if (host.parentElement) {
        mainDocument.body.removeChild(host);
      }
    }

    //finalize SVG
    svgStyle = ` width="${linkParts.width}px" height="${svgHeight}px"`;
    foreignObjectStyle = ` width="${linkParts.width}px" height="${svgHeight}px"`;
    setStyle(mdDIV, {
      height: `${svgHeight - footerHeight}px`,
      overflow: "hidden",
    });

    const imageList = mdDIV.querySelectorAll(
      "img:not([src^='data:image/svg+xml'])",
    );
    if (imageList.length > 0) {
      hasSVGwithBitmap = true;
    }
    if (hasSVGwithBitmap && this.isDark) {
      imageList.forEach((img) => {
        if (isInstanceOfHTMLImageElement(img)) {
          setStyle(img, { filter: THEME_FILTER });
        }
      });
    }

    const xml = new XMLSerializer().serializeToString(mdDIV);
    const finalSVG = svg(
      xml,
      '<div class="excalidraw-md-footer"></div>',
      style,
    );
    plugin.ea.mostRecentMarkdownSVG = parser.parseFromString(
      finalSVG,
      "image/svg+xml",
    ).firstElementChild as SVGSVGElement;
    return {
      dataURL: svgToBase64(finalSVG) as DataURL,
      hasSVGwithBitmap,
    };
  }
}

const getSVGData = async (
  app: App,
  file: TFile,
  colorMap: ColorMap | null,
): Promise<DataURL> => {
  const svgString = replaceSVGColors(
    await app.vault.read(file),
    colorMap,
  ) as string;
  return svgToBase64(svgString) as DataURL;
};

export const generateIdFromFile = async (
  file: ArrayBuffer,
  key?: string,
): Promise<FileId> => {
  let id: FileId;
  try {
    // Convert the file ArrayBuffer to a Uint8Array
    const fileArray = new Uint8Array(file);

    // If a key is provided, concatenate it to the file data
    let dataToHash: Uint8Array;
    if (key) {
      const encoder = new TextEncoder();
      const keyArray = encoder.encode(key);
      dataToHash = new Uint8Array(fileArray.length + keyArray.length);
      dataToHash.set(fileArray);
      dataToHash.set(keyArray, fileArray.length);
    } else {
      dataToHash = fileArray;
    }

    // Hash the combined data (file and key, if provided)
    // Ensure we pass an ArrayBuffer (not ArrayBufferLike) to subtle.digest
    const buffer = strictArrayBuffer(
      dataToHash.buffer.slice(
        dataToHash.byteOffset,
        dataToHash.byteOffset + dataToHash.byteLength,
      ),
    );
    const hashBuffer = await window.crypto.subtle.digest("SHA-1", buffer);
    id = Array.from(new Uint8Array(hashBuffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("") as FileId;
  } catch (error) {
    errorlog({
      where: "EmbeddedFileLoader.generateIdFromFile",
      error: error as unknown,
    });
    id = fileid() as FileId;
  }
  return id;
};

// This function is for converting blob:app://obsidian.md image URLs (from Obsidian's image cache) to base64 data URLs.
// fetch is used here because requestUrl does not support blob: URLs, and fetch is the only browser API that can read them directly.
const replaceBlobWithBase64 = async (
  divElement: HTMLDivElement,
): Promise<void> => {
  const images = divElement.querySelectorAll<HTMLImageElement>(
    'img[src^="blob:app://obsidian.md"]',
  );

  for (const img of images) {
    const blobUrl = img.src;
    try {
      // fetch is the only way to read blob: URLs in browser/Obsidian context.
      const response = await fetch(blobUrl);
      const blob = await response.blob();
      const base64 = await blobToBase64(blob);
      img.src = `data:${blob.type};base64,${base64}`;
    } catch (error) {
      // fallback: use canvas if fetch fails (should be rare)
      const canvas = createEl("canvas");
      const width = img.naturalWidth || img.width || 0;
      const height = img.naturalHeight || img.height || 0;
      if (width > 0 && height > 0) {
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          img.src = canvas.toDataURL();
        }
        canvas.width = 0;
        canvas.height = 0;
      }
      console.error(`Failed to fetch or convert blob: ${blobUrl}`, error);
    }
  }
};
