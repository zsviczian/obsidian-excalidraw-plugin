//https://stackoverflow.com/questions/2068344/how-do-i-get-a-youtube-video-thumbnail-from-the-youtube-api
//https://img.youtube.com/vi/uZz5MgzWXiM/maxresdefault.jpg

import type {
  ExcalidrawElement,
  ExcalidrawImageElement,
  FileId,
} from "@zsviczian/excalidraw/types/element/src/types";
import { DataURL } from "@zsviczian/excalidraw/types/excalidraw/types";
import { App, Component, MarkdownRenderer, Notice, TFile } from "obsidian";
import {
  DEVICE,
  DEFAULT_MD_EMBED_CSS,
  fileid,
  IMAGE_TYPES,
  nanoid,
  THEME_FILTER,
  FRONTMATTER_KEYS,
  getCSSFontDefinition,
  MARKDOWN_TO_SVG_RENDER_CLASS,
} from "../constants/constants";
import { createSVG } from "src/utils/excalidrawAutomateUtils";
import { ExcalidrawData, getTransclusion } from "./ExcalidrawData";
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
import { setStyle } from "src/utils/styleUtils";
import {
  isInstanceOfHTMLImageElement,
  isInstanceOfSVGElement,
} from "src/utils/typechecks";
import { getSafeFrontmatter, strictArrayBuffer } from "src/utils/obsidianUtils";
import {
  MARKDOWN_IMAGE_CUSTOM_DATA_KEY,
  type MarkdownImageCustomData,
  type MarkdownImageRenderSettings,
} from "src/types/markdownImageTypes";
import { resolveMarkdownImageRenderSettings } from "src/utils/markdownImageUtils";
import { addAppendUpdateCustomData } from "src/utils/elementCustomDataUtils";

//declared in rollup.config.mjs
declare const deliberateFetch: (
  payload: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;
declare const deliberateCreateElement: (document: Document, tagName: string) => HTMLElement;
declare const mainDocument: Document;
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
  markdownTransclusionRender?: MarkdownImageRenderSettings;
};

type MarkdownRenderOverrides = {
  markdown: string;
  render: MarkdownImageRenderSettings;
  fullHeight: boolean;
  isTransclusion?: boolean;
};

const waitForMarkdownPostProcessors = (
  container: HTMLElement,
): Promise<void> => {
  if (
    !container.querySelector(
      ".mermaid, .dataview, [class*='block-language-']",
    )
  ) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const minimumWait = 250;
    const quietPeriod = 150;
    const maximumWait = 2000;
    let minimumElapsed = false;
    let quietElapsed = false;
    let quietTimer: number | null = null;
    let minimumTimer: number | null = null;
    let maximumTimer: number | null = null;

    const observer = new MutationObserver(() => {
      quietElapsed = false;
      if (quietTimer !== null) {
        window.clearTimeout(quietTimer);
      }
      quietTimer = window.setTimeout(() => {
        quietElapsed = true;
        finishIfReady();
      }, quietPeriod);
    });
    const cleanup = () => {
      observer.disconnect();
      [quietTimer, minimumTimer, maximumTimer].forEach((timer) => {
        if (timer !== null) {
          window.clearTimeout(timer);
        }
      });
    };
    const finish = () => {
      cleanup();
      resolve();
    };
    const finishIfReady = () => {
      if (minimumElapsed && quietElapsed) {
        finish();
      }
    };

    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    quietTimer = window.setTimeout(() => {
      quietElapsed = true;
      finishIfReady();
    }, quietPeriod);
    minimumTimer = window.setTimeout(() => {
      minimumElapsed = true;
      finishIfReady();
    }, minimumWait);
    maximumTimer = window.setTimeout(finish, maximumWait);
  });
};

const waitForDocumentFonts = async (doc: Document): Promise<void> => {
  const fontSet = doc.fonts;
  if (!fontSet) {
    return;
  }
  // FontFaceSet.ready can hang on some environments if a face stalls.
  await Promise.race([
    fontSet.ready,
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, 500);
    }),
  ]);
};

const measureElementHeight = (element: Element | null): number => {
  if (!element) {
    return 0;
  }
  const typedElement = element as HTMLElement;
  const rectHeight = Number(typedElement.getBoundingClientRect?.().height ?? 0);
  return Math.max(
    Number(typedElement.scrollHeight ?? 0),
    Number(typedElement.offsetHeight ?? 0),
    Number(typedElement.clientHeight ?? 0),
    Number.isFinite(rectHeight) ? rectHeight : 0,
  );
};

const getCssPixelValue = (value: string | null | undefined): number => {
  if (!value) {
    return 0;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const measureRenderedContentHeight = (element: Element | null): number => {
  if (!element) {
    return 0;
  }
  const typedElement = element as HTMLElement;
  const ownerWindow = typedElement.ownerDocument.defaultView;
  const hostRect = typedElement.getBoundingClientRect();
  let maxContentBottom = 0;

  typedElement.querySelectorAll("*").forEach((child) => {
    const childElement = child as HTMLElement;
    const childRect = childElement.getBoundingClientRect();
    if (!Number.isFinite(childRect.bottom)) {
      return;
    }
    maxContentBottom = Math.max(maxContentBottom, childRect.bottom - hostRect.top);
  });

  const lastChild = typedElement.lastElementChild as HTMLElement | null;
  const lastChildMarginBottom =
    ownerWindow && lastChild
      ? getCssPixelValue(ownerWindow.getComputedStyle(lastChild).marginBottom)
      : 0;
  const hostPaddingBottom = ownerWindow
    ? getCssPixelValue(ownerWindow.getComputedStyle(typedElement).paddingBottom)
    : 0;

  return Math.max(
    measureElementHeight(typedElement),
    maxContentBottom + lastChildMarginBottom,
    hostRect.height,
  ) + hostPaddingBottom;
};

const appendMarkdownBottomSpacer = (
  container: HTMLElement,
  paddingBottom: number,
): void => {
  const existingSpacer = container.querySelector(
    ".excalidraw-md-padding-spacer",
  );
  if (existingSpacer?.parentElement) {
    existingSpacer.parentElement.removeChild(existingSpacer);
  }
  if (!(paddingBottom > 0)) {
    return;
  }
  // FIX: WebKit/iOS will often return a 0 bounding client rect for completely empty divs.
  // We insert a zero-width space so the layout engine is forced to render the block and measure its height.
  const paddingSpacer = createDiv({text: "&#8203;"});
  paddingSpacer.setAttribute("class", "excalidraw-md-padding-spacer");
  
  setStyle(paddingSpacer, {
    display: "block",
    width: "100%",
    height: `${paddingBottom}px`,
    minHeight: `${paddingBottom}px`,
    color: "transparent",
    lineHeight: "0px"
  });
  container.appendChild(paddingSpacer);
};

const ISOLATED_MARKDOWN_RENDER_CSS = `
.excalidraw-md-host,
.excalidraw-md-host * {
  box-sizing: border-box;
}

.excalidraw-md-host {
  width: 100%;
  max-width: 100%;
  margin: 0;
  font-size: 16px;
  line-height: 24px;
  letter-spacing: 0px;
  word-spacing: 0px;
  text-rendering: geometricPrecision;
  -webkit-text-size-adjust: none;
  text-size-adjust: none;
  font-kerning: none;
  font-variant-ligatures: none;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow-wrap: break-word;
  word-break: break-word;
}
`;

const snapshotRenderedCanvases = (container: HTMLElement): void => {
  container.querySelectorAll("canvas").forEach((canvas) => {
    try {
      const image = deliberateCreateElement(canvas.ownerDocument, "img") as HTMLImageElement;
      image.src = canvas.toDataURL("image/png");
      image.width = canvas.width;
      image.height = canvas.height;
      image.alt = canvas.getAttribute("aria-label") ?? "Rendered chart";
      canvas.replaceWith(image);
    } catch {
      // Tainted or WebGL canvases cannot always be exported; retain the canvas.
    }
  });
};

const getTransclusionRenderSettings = (
  render: MarkdownImageRenderSettings,
): MarkdownImageRenderSettings =>
  render.transclusion.enabled
    ? {
        ...render,
        fontFamily: render.transclusion.fontFamily,
        fontColor: render.transclusion.fontColor,
        border: { ...render.transclusion.border },
        css: render.transclusion.css,
      }
    : render;

type LoadSceneEmitPolicy = "all" | "changed-only";

export type MarkdownSVGRenderResult = {
  dataURL: DataURL;
  hasSVGwithBitmap: boolean;
  size: Size;
};

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

  /**
   * Renders an in-memory Markdown fragment using the same SVG pipeline as
   * Markdown file embeds. Unlike ordinary embeds, the returned image is never
   * height-clipped.
   */
  public async renderMarkdownToSVG(
    sourceFile: TFile,
    markdown: string,
    render: MarkdownImageRenderSettings,
  ): Promise<MarkdownSVGRenderResult> {
    if (this.isDark !== false) {
      const lightThemeLoader = new EmbeddedFilesLoader(this.plugin, false);
      try {
        return await lightThemeLoader.renderMarkdownToSVG(
          sourceFile,
          markdown,
          render,
        );
      } finally {
        lightThemeLoader.terminate = true;
      }
    }
    try {
      const linkParts = getLinkParts(sourceFile.path);
      linkParts.width = render.width;
      linkParts.height = Number.MAX_SAFE_INTEGER;
      const result = await this.convertMarkdownToSVG(
        this.plugin,
        sourceFile,
        linkParts,
        { markdown, render, fullHeight: true },
      );
      return {
        ...result,
        size: result.dataURL
          ? await getImageSize(result.dataURL)
          : { width: render.width, height: 0 },
      };
    } finally {
      this.emptyPDFDocsMap();
    }
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
          const markdownTransclusionRender =
            options?.markdownTransclusionRender;
          const transclusion = markdownTransclusionRender
            ? await getTransclusion(linkParts, this.plugin.app, file)
            : null;
          const result = await this.convertMarkdownToSVG(
            this.plugin,
            file,
            linkParts,
            markdownTransclusionRender
              ? {
                  markdown:
                    (transclusion.leadingHashes ?? "") +
                    transclusion.contents,
                  render: markdownTransclusionRender,
                  fullHeight: true,
                  isTransclusion: true,
                }
              : undefined,
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
    sceneElements,
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
    sceneElements?: readonly ExcalidrawElement[];
  }) {
    if (depth > 7) {
      new Notice(t("INFINITE_LOOP_WARNING") + depth.toString(), 6000);
      return;
    }
    const entries = Array.from(excalidrawData.getFileEntries());
    const markdownImageElements = (
      sceneElements ?? excalidrawData.scene.elements
    ).filter(
      (element: ExcalidrawElement) =>
        element.type === "image" &&
        Boolean(element.customData?.[MARKDOWN_IMAGE_CUSTOM_DATA_KEY]),
    ) as ExcalidrawImageElement[];
    const markdownImageFileIds = new Set(
      markdownImageElements.map((element) => element.fileId),
    );
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
        if (markdownImageFileIds.has(entry[0])) {
          continue;
        }
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

      for (const element of markdownImageElements) {
        const id = element.fileId;
        if (fileIDWhiteList && !fileIDWhiteList.has(id)) {
          continue;
        }
        yield createSafeLoadTask(
          async () => {
            if (this.terminate) {
              return;
            }
            const customData = element.customData?.[
              MARKDOWN_IMAGE_CUSTOM_DATA_KEY
            ] as MarkdownImageCustomData | undefined;
            if (!customData) {
              return;
            }
            const render = resolveMarkdownImageRenderSettings(
              this.plugin.settings.markdownImageSettings.defaults,
              customData.render,
            );
            const legacyRender = customData.render as MarkdownImageRenderSettings & {
              theme?: unknown;
            };
            if ("theme" in legacyRender) {
              const migratedRender = { ...legacyRender };
              delete migratedRender.theme;
              addAppendUpdateCustomData(element, {
                [MARKDOWN_IMAGE_CUSTOM_DATA_KEY]: {
                  ...customData,
                  render: migratedRender as MarkdownImageRenderSettings,
                },
              });
            }
            if (
              typeof element.customData?.doNotInvertSVGInDarkMode !== "boolean"
            ) {
              addAppendUpdateCustomData(
                element,
                { doNotInvertSVGInDarkMode: false },
              );
            }
            let sourceFile = excalidrawData.file;
            let markdown: string | undefined;
            if (customData.source === "external") {
              const embeddedFile = excalidrawData.getFile(id);
              if (
                !embeddedFile?.file ||
                embeddedFile.file.extension.toLowerCase() !== "md"
              ) {
                return;
              }
              sourceFile = embeddedFile.file;
              const transclusion = await getTransclusion(
                embeddedFile.linkParts,
                this.plugin.app,
                sourceFile,
              );
              markdown =
                (transclusion.leadingHashes ?? "") + transclusion.contents;
            } else {
              markdown = excalidrawData.getMarkdownImage(id)?.markdown;
            }
            if (markdown === undefined) {
              return;
            }
            const rendered = await this.renderMarkdownToSVG(
              sourceFile,
              markdown,
              render,
            );
            if (!rendered.dataURL || this.terminate) {
              return;
            }
            files[batch].push({
              mimeType: "image/svg+xml",
              id,
              dataURL: rendered.dataURL,
              created: Date.now(),
              size: rendered.size,
              hasSVGwithBitmap: rendered.hasSVGwithBitmap,
              shouldScale: true,
            });
          },
          {
            phase: "markdown-image",
            fileId: id,
            elementId: element.id,
          },
        );
      }

      for (const [id, equation] of excalidrawData.getEquationEntries()) {
        if (fileIDWhiteList && !fileIDWhiteList.has(id)) {
          continue;
        }
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
                    ...(result.files as Record<string, { dataURL: string }>)[
                      key
                    ],
                    id: element.fileId,
                    created: Date.now(),
                    hasSVGwithBitmap: false,
                    shouldScale: true,
                    size: await getImageSize(
                      (result.files as Record<string, { dataURL: string }>)[key]
                        .dataURL,
                    ),
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
                  elements: result.elements as ExcalidrawElement[],
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
      } catch (e: unknown) {
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
      } catch (e: unknown) {
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
        let message = "";

        if (e instanceof Error) {
          // Standard JS Errors are guaranteed to have a string .message
          message = e.message;
        } else if (typeof e === "string") {
          // If someone threw a raw string
          message = e;
        } else if (e !== null && typeof e === "object" && "message" in e) {
          // If it's a custom object with a message property
          const maybeMessage = (e as { message?: unknown }).message;
          if (typeof maybeMessage === "string") {
            message = maybeMessage;
          }
        }

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
    overrides?: MarkdownRenderOverrides,
  ): Promise<{ dataURL: DataURL; hasSVGwithBitmap: boolean }> {
    if (this.terminate) {
      return { dataURL: "" as DataURL, hasSVGwithBitmap: false };
    }
    //1.
    //get the markdown text
    let hasSVGwithBitmap = false;
    const transclusion = overrides
      ? null
      : await getTransclusion(linkParts, plugin.app, file);
    if (this.terminate) {
      return { dataURL: "" as DataURL, hasSVGwithBitmap: false };
    }
    let text = overrides
      ? overrides.markdown
      : (transclusion.leadingHashes ?? "") + transclusion.contents;
    if (text === "") {
      text = overrides
        ? `*${t("MARKDOWN_IMAGE_EMPTY_PLACEHOLDER")}*`
        : "# Empty markdown file\nCTRL+Click here to open the file for editing in the current active pane, or CTRL+SHIFT+Click to open it in an adjacent pane.";
    }

    //2.
    //get styles

    const fileCache = plugin.app.metadataCache.getFileCache(file);
    let fontDef: string;
    let fontName = overrides?.render.fontFamily ?? plugin.settings.mdFont;
    const safeFrontmatter = getSafeFrontmatter(fileCache?.frontmatter);
    if (!overrides && safeFrontmatter[FRONTMATTER_KEYS.font.name]) {
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
    const fontColor =
      overrides?.render.fontColor ?? fmFontColor ?? plugin.settings.mdFontColor;
    const markdownImageThemeCSS = overrides
      ? `.excalidraw-md-host.theme-light{color-scheme:light;--background-primary:#ffffff;--background-secondary:#f5f5f5;--text-normal:#2e3338;--text-muted:#6b6b6b;--link-color:#086ddd}.excalidraw-md-host.theme-light a{color:var(--link-color)}.excalidraw-md-host.theme-light th{background-color:#dedede}.excalidraw-md-host.theme-light pre[class*=language-],.excalidraw-md-host.theme-light :not(pre)>code[class*=language-]{color:#393a34;background-color:#f5f5f5;border-color:#ddd}.excalidraw-md-host.theme-light blockquote{background-color:rgba(0,0,0,.06)}`
      : "";
    let style: string = overrides
      ? `${DEFAULT_MD_EMBED_CSS}\n${ISOLATED_MARKDOWN_RENDER_CSS}\n${markdownImageThemeCSS}\n${overrides.render.css}`
      : (safeFrontmatter[FRONTMATTER_KEYS["md-css"].name] ?? "");

    let frontmatterCSSisAfile = false;
    if (!overrides && style && style !== "") {
      const f = plugin.app.metadataCache.getFirstLinkpathDest(style, file.path);
      if (f) {
        style = await plugin.app.vault.read(f);
        frontmatterCSSisAfile = true;
      }
    }
    if (!overrides && !frontmatterCSSisAfile) {
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
    if (!style.includes(ISOLATED_MARKDOWN_RENDER_CSS)) {
      style = `${ISOLATED_MARKDOWN_RENDER_CSS}\n${style}`;
    }

    const borderColor: string = overrides
      ? overrides.render.border.enabled
        ? overrides.render.border.color
        : ""
      : (safeFrontmatter[FRONTMATTER_KEYS["border-color"].name] ??
        plugin.settings.mdBorderColor);
    const drawBorder = Boolean(
      borderColor && (overrides || !style.match(/svg/i)),
    );

    //3.
    //SVG helper functions
    //the SVG will first have ~infinite height. After sizing this will be reduced
    let svgHeight = 100000;
    const svg = (
      xml: string,
      xmlFooter: string,
      style?: string,
      includeBorder: boolean = false,
    ) => {
      const hasInsetBorder = includeBorder && drawBorder;
      const inset = hasInsetBorder ? 2 : 0;
      const width = Math.max(0, linkParts.width - inset * 2);
      const height = Math.max(0, svgHeight - inset * 2);
      const safeBorderColor = borderColor.replace(/[<>"']/g, "");
      const border = hasInsetBorder
        ? `<rect class="excalidraw-md-border" x="1" y="1" width="${Math.max(0, linkParts.width - 2)}" height="${Math.max(0, svgHeight - 2)}" fill="none" stroke="${safeBorderColor}" stroke-width="2"/>`
        : "";
      const svgClass = overrides?.isTransclusion
        ? ' class="excalidraw-md-transclusion"'
        : "";
      
      // FIX: Added viewBox="0 0 ${linkParts.width} ${svgHeight}" 
      // This is mandatory for Safari to respect the width/height of the SVG when loaded as an image.
      return `<svg xmlns="http://www.w3.org/2000/svg"${svgClass} width="${linkParts.width}px" height="${svgHeight}px" viewBox="0 0 ${linkParts.width} ${svgHeight}">${
        style ? `<style>${style}</style>` : ""
      }<foreignObject x="${inset}" y="${inset}" width="${width}px" height="${height}px">${xml}${
        xmlFooter 
      }</foreignObject>${border}${
        fontDef !== "" ? `<defs><style>${fontDef}</style></defs>` : ""
      }</svg>`;
    };

    //4.
    //create document div - this will be the contents of the foreign object
    let mdDIV = createDiv();
    mdDIV.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    mdDIV.setAttribute(
      "class",
      `excalidraw-md-host ${MARKDOWN_TO_SVG_RENDER_CLASS} ${this.isDark ? "theme-dark" : "theme-light"}`,
    );
    if (fontName !== "") {
      setStyle(mdDIV, { fontFamily: fontName });
    }
    const markdownImagePaddingBottom =
      overrides && !overrides.isTransclusion
        ? overrides.render.paddingBottom
        : 0;
    setStyle(mdDIV, {
      overflow: "hidden",
      display: "block",
      color: fontColor && fontColor !== "" ? fontColor : "initial",
      paddingBottom: undefined,
    });

    const renderHost = mainDocument.body.createDiv();
    renderHost.setAttribute("aria-hidden", "true");
    setStyle(renderHost, {
      position: "fixed",
      left: "-100000px",
      top: "0",
      width: `${linkParts.width}px`,
      opacity: "0",
      pointerEvents: "none",
      zIndex: "-1",
    });
    renderHost.appendChild(mdDIV);
    const isolatedRenderStyleEl = deliberateCreateElement(
      mainDocument,
      "style",
    ) as HTMLStyleElement;
    setStyleText(
      isolatedRenderStyleEl,
      ISOLATED_MARKDOWN_RENDER_CSS.replaceAll(
        ".excalidraw-md-host",
        `.${MARKDOWN_TO_SVG_RENDER_CLASS}`,
      ),
    );
    mainDocument.head.appendChild(isolatedRenderStyleEl);
    const isolatedFontStyleEl =
      fontDef !== ""
        ? (deliberateCreateElement(mainDocument, "style") as HTMLStyleElement)
        : null;
    if (isolatedFontStyleEl) {
      setStyleText(isolatedFontStyleEl, fontDef);
      mainDocument.head.appendChild(isolatedFontStyleEl);
      await waitForDocumentFonts(mainDocument);
    }
    const renderComponent = new Component();
    renderComponent.load();
    let renderedDIV: HTMLDivElement | null = null;
    try {
      //await MarkdownRenderer.renderMarkdown(text, mdDIV, file.path, plugin);
      await MarkdownRenderer.render(
        this.plugin.app,
        text,
        mdDIV,
        file.path,
        renderComponent,
      );
      await waitForMarkdownPostProcessors(mdDIV);
      snapshotRenderedCanvases(mdDIV);
      renderedDIV = mdDIV.cloneNode(true) as HTMLDivElement;
    } finally {
      renderComponent.unload();
      renderHost.remove();
      isolatedRenderStyleEl.remove();
      isolatedFontStyleEl?.remove();
    }
    if (renderedDIV) {
      mdDIV = renderedDIV;
    }
    appendMarkdownBottomSpacer(mdDIV, markdownImagePaddingBottom);
    if (this.terminate) {
      return { dataURL: "" as DataURL, hasSVGwithBitmap: false };
    }

    // MathJax typesetting may complete asynchronously after MarkdownRenderer.render() resolves.
    // Awaiting typesetPromise ensures all mjx-container elements are fully populated before
    // we clone the DOM into the iframe or serialize to SVG.
    const mjx = window.MathJax;
    if (mjx?.typesetPromise) {
      try {
        await mjx.typesetPromise([mdDIV]);
      } catch (e: unknown) {
        errorlog({
          where: "EmbeddedFileLoader.convertMarkdownToSVG",
          message:
            "Non-fatal: proceed with whatever state MathJax left the DOM in.",
          error: e,
        });
      }
    }

    // Capture the MathJax CHTML stylesheet AFTER typesetting so all per-glyph rules
    // are present. We pass the live <style> element (not textContent) because MathJax
    // adds rules via sheet.insertRule(), which updates sheet.cssRules but never
    // reflects in textContent — reading textContent would miss every glyph except
    // any that happened to be in the element's original authored content.
    const mjxCHtmlStyleContent = await scopeAndInlineMathJaxCSS(
      mainDocument.getElementById(
        "MJX-CHTML-styles",
      ) as HTMLStyleElement | null,
      ".excalidraw-md-host",
    );

    mdDIV
      .querySelectorAll(":scope > *[class^='frontmatter']")
      .forEach((el) => mdDIV.removeChild(el));

    await replaceBlobWithBase64(mdDIV); //because image cache returns a blob
    if (this.terminate) {
      return { dataURL: "" as DataURL, hasSVGwithBitmap: false };
    }
    const internalEmbeds = Array.from(
      mdDIV.querySelectorAll<HTMLElement>("span.internal-embed[src]"),
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
      const requestedWidth = width ? Number.parseFloat(width) : NaN;
      const requestedHeight = height ? Number.parseFloat(height) : NaN;
      const availableWidth = Math.max(1, linkParts.width - 20);
      const ef = new EmbeddedFile(plugin, file.path, src);
      //const f = app.metadataCache.getFirstLinkpathDest(src.split("#")[0],file.path);
      if (!ef.file) {
        continue;
      }
      const inheritMarkdownImageAppearance = Boolean(
        overrides &&
          ef.file.extension.toLowerCase() === "md" &&
          !plugin.isExcalidrawFile(ef.file),
      );
      if (inheritMarkdownImageAppearance) {
        ef.linkParts.width = Number.isFinite(requestedWidth)
          ? requestedWidth
          : availableWidth;
        ef.linkParts.height = Number.isFinite(requestedHeight)
          ? requestedHeight
          : Number.MAX_SAFE_INTEGER;
      }
      const embeddedFile = await this._getObsidianImage(
        ef,
        1,
        inheritMarkdownImageAppearance
          ? {
              markdownTransclusionRender: getTransclusionRenderSettings(
                overrides.render,
              ),
            }
          : undefined,
      );
      if (this.terminate) {
        return { dataURL: "" as DataURL, hasSVGwithBitmap: false };
      }
      if (!embeddedFile?.dataURL) {
        continue;
      }
      const img = createEl("img");
      const intrinsicWidth = embeddedFile.size?.width ?? 0;
      const intrinsicHeight = embeddedFile.size?.height ?? 0;
      const aspectRatio =
        intrinsicWidth > 0 && intrinsicHeight > 0
          ? intrinsicWidth / intrinsicHeight
          : 0;
      let renderedWidth = Number.isFinite(requestedWidth)
        ? requestedWidth
        : intrinsicWidth;
      let renderedHeight = Number.isFinite(requestedHeight)
        ? requestedHeight
        : intrinsicHeight;
      if (Number.isFinite(requestedWidth) && !Number.isFinite(requestedHeight)) {
        renderedHeight = aspectRatio > 0 ? requestedWidth / aspectRatio : 0;
      }
      if (Number.isFinite(requestedHeight) && !Number.isFinite(requestedWidth)) {
        renderedWidth = aspectRatio > 0 ? requestedHeight * aspectRatio : 0;
      }
      if (renderedWidth > availableWidth) {
        const scale = availableWidth / renderedWidth;
        renderedWidth = availableWidth;
        renderedHeight *= scale;
      }
      if (renderedWidth > 0) {
        img.setAttribute("width", String(Math.round(renderedWidth)));
      }
      if (renderedHeight > 0) {
        img.setAttribute("height", String(Math.round(renderedHeight)));
      }
      img.alt = el.getAttribute("alt") ?? ef.file.name;
      setStyle(img, {
        display: "block",
        maxWidth: "100%",
        objectFit: "contain",
      });
      img.src = embeddedFile.dataURL;
      try {
        await img.decode();
      } catch {
        // Explicit dimensions still make the image measurable if decode fails.
      }
      el.replaceWith(img);
    }
    await replaceBlobWithBase64(mdDIV);
    if (this.terminate) {
      return { dataURL: "" as DataURL, hasSVGwithBitmap: false };
    }

    //5.1
    //get SVG size.
    //First I need to create a fully self contained copy of the document to convert
    //blank styles into inline styles using computedStyle
    const iframeHost = mainDocument.body.createDiv();
    // Use a fixed off-screen container with STRICT width boundaries to defeat iOS iframe flattening.
    setStyle(iframeHost, {
      position: "fixed",
      left: "-100000px",
      top: "0",
      width: `${linkParts.width}px`,
      height: "10000px", // Give it plenty of room to render without scrollbars
      overflow: "hidden",
      visibility: "hidden",
      pointerEvents: "none",
    });
    let xmlINiframe = "";
    let xmlFooter = "";
    let iframeContentHeight = 0;
    let iframeFooterHeight = 0;
    try {
      const iframe = iframeHost.createEl("iframe");
      // FIX: Lock the iframe's internal dimensions
      setStyle(iframe, {
        width: `${linkParts.width}px`,
        height: "100%",
        border: "none",
        margin: "0",
        padding: "0"
      });

      const iframeDoc = iframe.contentWindow.document;
      const iframeWindow = iframe.contentWindow;

      // FIX: Force the iframe's body to respect the target width and prevent text inflation
      // Removed `overflow: hidden !important` so we don't accidentally clip valid heights on iOS measurement.
      const bodyReset = deliberateCreateElement(iframeDoc, "style") as HTMLStyleElement;
      setStyleText(bodyReset, `
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: ${linkParts.width}px !important;
          max-width: ${linkParts.width}px !important;
          overflow: visible !important;
          -webkit-text-size-adjust: none !important;
          text-size-adjust: none !important;
        }
      `);
      iframeDoc.head.appendChild(bodyReset);

      if (style) {
        // Obsidian style.css does not good in this case, yet the code scanner enforces it
        const styleEl = deliberateCreateElement(iframeDoc, "style") as HTMLStyleElement;
        setStyleText(styleEl, style);
        iframeDoc.head.appendChild(styleEl);
      }
      if (fontDef !== "") {
        const fontStyleEl = deliberateCreateElement(
          iframeDoc,
          "style",
        ) as HTMLStyleElement;
        setStyleText(fontStyleEl, fontDef);
        iframeDoc.head.appendChild(fontStyleEl);
      }
      // Inject the MathJax CHTML stylesheet into the iframe so that mjx-* custom elements
      // are styled correctly when measuring scroll height and computing inline styles.
      if (mjxCHtmlStyleContent) {
        const mjxStyleEl = deliberateCreateElement(iframeDoc, "style") as HTMLStyleElement;
        setStyleText(mjxStyleEl, mjxCHtmlStyleContent);
        iframeDoc.head.appendChild(mjxStyleEl);
      }
      const stylingDIV = iframeDoc.importNode(mdDIV, true);
      iframeDoc.body.appendChild(stylingDIV);
      const footerDIV = createDiv();
      footerDIV.setAttribute("class", "excalidraw-md-footer");
      iframeDoc.body.appendChild(footerDIV);
      await waitForDocumentFonts(iframeDoc);

      iframeDoc.body.querySelectorAll("*").forEach((el: HTMLElement) => {
        const elementStyle = el.style;
        const computedStyle = iframeWindow.getComputedStyle(el);
        let style = "";
        for (const [prop] of Object.entries(elementStyle)) {
          if (Object.hasOwn(elementStyle ?? {}, prop)) {
            const value = computedStyle.getPropertyValue(prop);
            style += `${prop}: ${value};`;
          }
        }
        el.setAttribute("style", style);
      });

      iframeContentHeight = measureRenderedContentHeight(stylingDIV);
      iframeFooterHeight = measureRenderedContentHeight(footerDIV);

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
      svg(
        xmlINiframe,
        xmlFooter,
        undefined,
        drawBorder,
      ),
      "image/svg+xml",
    );
    const svgEl = doc.firstElementChild;
    const host = createDiv();
    let footerHeight = 0;
    try {
      host.appendChild(svgEl);
      mainDocument.body.appendChild(host);
      footerHeight = Math.max(
        measureRenderedContentHeight(svgEl.querySelector(".excalidraw-md-footer")),
        iframeFooterHeight,
      );
      const contentHeight = Math.max(
        measureRenderedContentHeight(svgEl.querySelector(".excalidraw-md-host")),
        iframeContentHeight,
      );
      const borderHeight = drawBorder ? 4 : 0;
      // Safari on iOS under-reports foreignObject content height intermittently.
      const iOSSafetyPadding = DEVICE.isIOS ? 1 : 0;
      const measuredHeight = Math.ceil(
        contentHeight + footerHeight + borderHeight + iOSSafetyPadding,
      );
      svgHeight = overrides?.fullHeight
        ? measuredHeight
        : measuredHeight <= linkParts.height
          ? measuredHeight
          : linkParts.height;
    } finally {
      if (host.parentElement) {
        mainDocument.body.removeChild(host);
      }
    }

    //finalize SVG
    const borderHeight = drawBorder ? 4 : 0;
    setStyle(mdDIV, {
      height: `${Math.max(0, svgHeight - footerHeight - borderHeight)}px`,
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
    // Prepend the MathJax CHTML stylesheet to the SVG's embedded <style> block so that
    // mjx-container elements inside the <foreignObject> render correctly.
    const finalStyle = mjxCHtmlStyleContent
      ? mjxCHtmlStyleContent + "\n" + style
      : style;
    const finalSVG = svg(
      xml,
      '<div class="excalidraw-md-footer"></div>',
      finalStyle,
      true,
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

// ─── MathJax CHTML stylesheet helpers ────────────────────────────────────────

// Cache keyed by "<rule-count>:<last-rule-text>" — cheap to compute and sufficient
// for MathJax's append-only glyph stylesheet: every new character adds a new rule
// at the end, so a change in count or last entry signals a cache miss.
const mjxScopedStyleCache = new Map<string, Promise<string>>();

/**
 * Fetches a font file and returns it as a base64 data URI.
 * This is necessary because fonts referenced by relative/app:// URLs in
 * @font-face rules are blocked when the SVG is loaded as a data: URL.
 */
const fetchFontAsDataURI = async (url: string): Promise<string | null> => {
  if (url.startsWith("data:")) return url;
  try {
    const res = await deliberateFetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    // Build base64 in 8 KB chunks to avoid call-stack overflow on large fonts.
    let binary = "";
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
    const mime =
      ext === "woff2"
        ? "font/woff2"
        : ext === "woff"
          ? "font/woff"
          : ext === "ttf"
            ? "font/ttf"
            : ext === "otf"
              ? "font/otf"
              : "font/woff2";
    return `data:${mime};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
};

/**
 * Processes the live MathJax CHTML <style> element so it is safe to embed in the SVG.
 *
 * WHY we accept the element instead of its textContent: MathJax adds per-glyph CSS
 * rules via sheet.insertRule(), which updates sheet.cssRules but NOT the element's
 * textContent. Reading textContent would therefore miss every glyph rule added after
 * initial load, explaining why only the very last character in a formula appeared.
 *
 * What this function does:
 * 1. Scopes every style rule to `scope` (e.g. ".excalidraw-md-host") so that broad
 *    selectors cannot bleed outside the math container and underline regular text.
 * 2. Inlines every @font-face src URL as a base64 data URI so the mathematical fonts
 *    (needed for correct radical-bar vertical metrics) load inside a data: SVG, where
 *    the browser blocks all external URL references for security reasons.
 *
 * Results are cached by rule-count + last-rule text to avoid re-fetching fonts on
 * every embed of the same formula set.
 */
const scopeAndInlineMathJaxCSS = (
  styleEl: HTMLStyleElement | null,
  scope: string,
): Promise<string> => {
  const sheet = styleEl?.sheet;
  if (!sheet?.cssRules.length) return Promise.resolve("");

  // Cheap cache key: rule count + last rule text (MathJax only ever appends rules).
  const lastRule = sheet.cssRules[sheet.cssRules.length - 1]?.cssText ?? "";
  const cacheKey = `${sheet.cssRules.length}:${lastRule.slice(0, 80)}`;

  const cached = mjxScopedStyleCache.get(cacheKey) ?? null;
  if (cached !== null) return cached;

  const work = (async (): Promise<string> => {
    // Snapshot the live rules array before any await so we process the state
    // that existed when typesetPromise resolved, not a later state.
    const rules = Array.from(sheet.cssRules);
    let result = "";
    for (const rule of rules) {
      if (rule instanceof CSSFontFaceRule) {
        // Inline each src URL as base64 so fonts work inside data: SVGs.
        let ruleText = rule.cssText;
        const urlRe = /url\(["']?([^"')]+)["']?\)/g;
        for (const m of [...ruleText.matchAll(urlRe)]) {
          const dataURI = await fetchFontAsDataURI(m[1]);
          if (dataURI) ruleText = ruleText.replace(m[0], `url("${dataURI}")`);
        }
        result += ruleText + "\n";
      } else if (rule instanceof CSSStyleRule) {
        // Prefix every selector with `scope` so rules cannot bleed to elements
        // outside the math container (e.g. causing underlines on regular text).
        const sr = rule;
        const scoped = sr.selectorText
          .split(",")
          .map((s) => `${scope} ${s.trim()}`)
          .join(", ");
        result += `${scoped} { ${sr.style.cssText} }\n`;
      } else {
        // @media, @keyframes, @supports, etc. — pass through unchanged.
        result += rule.cssText + "\n";
      }
    }
    return result;
  })();

  mjxScopedStyleCache.set(cacheKey, work);
  return work;
};

// ─────────────────────────────────────────────────────────────────────────────

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
  } catch (error: unknown) {
    errorlog({
      where: "EmbeddedFileLoader.generateIdFromFile",
      error: error,
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
      const response = await deliberateFetch(blobUrl);
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
