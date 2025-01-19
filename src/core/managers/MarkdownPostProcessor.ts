import {
  App,
  MarkdownPostProcessorContext,
  MetadataCache,
  PaneType,
  TFile,
  Vault,
} from "obsidian";
import { DEVICE, RERENDER_EVENT } from "../../constants/constants";
import { EmbeddedFilesLoader } from "../../shared/EmbeddedFileLoader";
import { createPNG, createSVG } from "../../utils/excalidrawAutomateUtils";
import { ExportSettings } from "../../view/ExcalidrawView";
import ExcalidrawPlugin from "../main";
import {getIMGFilename,} from "../../utils/fileUtils";
import {
  getEmbeddedFilenameParts,
  getExportTheme,
  getQuickImagePreview,
  getExportPadding,
  getWithBackground,
  hasExportTheme,
  convertSVGStringToElement,
  isMaskFile,
} from "../../utils/utils";
import { getParentOfClass, isObsidianThemeDark, getFileCSSClasses } from "../../utils/obsidianUtils";
import { linkClickModifierType } from "../../utils/modifierkeyHelper";
import { ImageKey, imageCache } from "../../shared/ImageCache";
import { FILENAMEPARTS, PreviewImageType } from "../../types/utilTypes";
import { CustomMutationObserver, debug, DEBUGGING } from "../../utils/debugHelper";
import { getExcalidrawFileForwardLinks } from "../../utils/excalidrawViewUtils";
import { linkPrompt } from "../../shared/Dialogs/Prompt";
import { isHTMLElement } from "../../utils/typechecks";

interface imgElementAttributes {
  file?: TFile;
  fname: string; //Excalidraw filename
  fwidth: string; //Display width of image
  fheight: string; //Display height of image
  style: string[]; //css style to apply to IMG element
}

let plugin: ExcalidrawPlugin;
let app: App;
let vault: Vault;
let metadataCache: MetadataCache;
const DEBUGGING_MPP = false;


const getDefaultWidth = (plugin: ExcalidrawPlugin): string => {
  const width = parseInt(plugin.settings.width);
  if (isNaN(width) || width === 0 || width === null) {
    if(getDefaultHeight(plugin)!=="") return "";
    return "400";
  }
  return plugin.settings.width;
};

const getDefaultHeight = (plugin: ExcalidrawPlugin): string => {
  const height = parseInt(plugin.settings.height);
  if (isNaN(height) || height === 0 || height === null) {
    return "";
  }
  return plugin.settings.height;
};

export const initializeMarkdownPostProcessor = (p: ExcalidrawPlugin) => {
  plugin = p;
  app = plugin.app;
  vault = app.vault;
  metadataCache = app.metadataCache;
};

const _getPNG = async ({imgAttributes,filenameParts,theme,cacheReady,img,file,exportSettings,loader}:{
  imgAttributes: imgElementAttributes,
  filenameParts: FILENAMEPARTS,
  theme: string,
  cacheReady: boolean,
  img: HTMLImageElement,
  file: TFile,
  exportSettings: ExportSettings,
  loader: EmbeddedFilesLoader,
}):Promise<HTMLImageElement> => {
  (process.env.NODE_ENV === 'development') && DEBUGGING && debug(_getPNG, `MarkdownPostProcessor.ts > _getPNG`);
  const width = parseInt(imgAttributes.fwidth);
    const scale = width >= 2400
      ? 5
      : width >= 1800
        ? 4
        : width >= 1200
          ? 3
          : width >= 600
            ? 2
            : 1;
  
  const cacheKey = {
    ...filenameParts,
    isDark: theme==="dark",
    previewImageType: PreviewImageType.PNG,
    scale,
    isTransparent: !exportSettings.withBackground,
    inlineFonts: true, //though for PNG this makes no difference, but the key requires it
  };

  if(cacheReady) {      
    const src = await imageCache.getImageFromCache(cacheKey);
    //In case of PNG I cannot change the viewBox to select the area of the element
    //being referenced. For PNG only the group reference works
    if(src && typeof src === "string") {
      img.src = src;
      return img;
    }
  }

  const quickPNG = !(filenameParts.hasGroupref || filenameParts.hasFrameref)
    ? await getQuickImagePreview(plugin, file.path, "png")
    : undefined;

  const png =
    quickPNG ??
    (await createPNG(
      (filenameParts.hasGroupref || filenameParts.hasFrameref || filenameParts.hasClippedFrameref)
        ? filenameParts.filepath + filenameParts.linkpartReference
        : file.path,
      scale,
      filenameParts.hasClippedFrameref
      ? { ...exportSettings, frameRendering: { enabled: true, name: false, outline: false, clip: true}}
      : exportSettings,
      loader,
      theme,
      null,
      null,
      [],
      plugin,
      0
    ));
  if (!png) {
    return null;
  }
  img.src = URL.createObjectURL(png);
  cacheReady && imageCache.addImageToCache(cacheKey, img.src, png);
  return img;
}

const setStyle = ({element,imgAttributes,onCanvas}:{
  element: HTMLElement,
  imgAttributes: imgElementAttributes,
  onCanvas: boolean,
}
) => {
  (process.env.NODE_ENV === 'development') && DEBUGGING && debug(setStyle, `MarkdownPostProcessor.ts > setStyle`);
  let style = "";
  if(imgAttributes.fwidth) {
    style = `max-width:${imgAttributes.fwidth}${imgAttributes.fwidth.match(/\d$/) ? "px":""}; `; //width:100%;`; //removed !important https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/886
  } else {
    style = "width: fit-content;"
  }
  if (imgAttributes.fheight) {
    style += `${imgAttributes.fwidth?"min-":"max-"}height:${imgAttributes.fheight}px;`;
  }
  if(!onCanvas) element.setAttribute("style", style);
  element.classList.add(...Array.from(imgAttributes.style))
  if(!element.hasClass("excalidraw-embedded-img")) {
    element.addClass("excalidraw-embedded-img");
  }
  if(
    window?.ExcalidrawAutomate?.plugin?.settings?.canvasImmersiveEmbed &&
    !element.hasClass("excalidraw-canvas-immersive")
  ) {
    element.addClass("excalidraw-canvas-immersive");
  }
}

const _getSVGIMG = async ({filenameParts,theme,cacheReady,img,file,exportSettings,loader}:{
  filenameParts: FILENAMEPARTS,
  theme: string,
  cacheReady: boolean,
  img: HTMLImageElement,
  file: TFile,
  exportSettings: ExportSettings,
  loader: EmbeddedFilesLoader,
}):Promise<HTMLImageElement> => {
  (process.env.NODE_ENV === 'development') && DEBUGGING && debug(_getSVGIMG, `MarkdownPostProcessor.ts > _getSVGIMG`);
  exportSettings.skipInliningFonts = false;
  const cacheKey = {
    ...filenameParts,
    isDark: theme==="dark",
    previewImageType: PreviewImageType.SVGIMG,
    scale:1,
    isTransparent: !exportSettings.withBackground,
    inlineFonts: !exportSettings.skipInliningFonts,
  };

  if(cacheReady) {
    const src = await imageCache.getImageFromCache(cacheKey);
    if(src && typeof src === "string") {
      img.setAttribute("src", src);
      return img;
    }
  }

  if(!(filenameParts.hasBlockref || filenameParts.hasSectionref)) {
    const quickSVG = await getQuickImagePreview(plugin, file.path, "svg");
    if (quickSVG) {
      const svg = convertSVGStringToElement(quickSVG);
      if (svg) {
        return addSVGToImgSrc(img, svg, cacheReady, cacheKey);
      }
    }
  }
  
  const svg = convertSVGStringToElement((
    await createSVG(
      filenameParts.hasGroupref || filenameParts.hasBlockref || filenameParts.hasSectionref || filenameParts.hasFrameref || filenameParts.hasClippedFrameref
        ? filenameParts.filepath + filenameParts.linkpartReference
        : file.path,
      true,
      filenameParts?.hasClippedFrameref
      ? { ...exportSettings, frameRendering: { enabled: true, name: false, outline: false, clip: true}}
      : exportSettings,
      loader,
      theme,
      null,
      null,
      [],
      plugin,
      0,
      getExportPadding(plugin, file),
    )
  ).outerHTML);
  
  if (!svg) {
    return null;
  }

  //need to remove width and height attributes to support area= embeds
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  return addSVGToImgSrc(img, svg, cacheReady, cacheKey);
}

const _getSVGNative = async ({filenameParts,theme,cacheReady,containerElement,file,exportSettings,loader}:{
  filenameParts: FILENAMEPARTS,
  theme: string,
  cacheReady: boolean,
  containerElement: HTMLDivElement,
  file: TFile,
  exportSettings: ExportSettings,
  loader: EmbeddedFilesLoader,
}):Promise<HTMLDivElement> => {
  (process.env.NODE_ENV === 'development') && DEBUGGING && debug(_getSVGNative, `MarkdownPostProcessor.ts > _getSVGNative`);
  exportSettings.skipInliningFonts = false;
  const cacheKey = {
    ...filenameParts,
    isDark: theme==="dark",
    previewImageType: PreviewImageType.SVG,
    scale:1,
    isTransparent: !exportSettings.withBackground,
    inlineFonts: !exportSettings.skipInliningFonts,  
  };
  let maybeSVG;
  if(cacheReady) {
    maybeSVG = await imageCache.getImageFromCache(cacheKey);
  }

  const svg = (maybeSVG && (maybeSVG instanceof SVGSVGElement))
    ? maybeSVG
    : convertSVGStringToElement((await createSVG(
      filenameParts.hasGroupref || filenameParts.hasBlockref || filenameParts.hasSectionref || filenameParts.hasFrameref || filenameParts.hasClippedFrameref
        ? filenameParts.filepath + filenameParts.linkpartReference
        : file.path,
      false,
      filenameParts.hasClippedFrameref
      ? { ...exportSettings, frameRendering: { enabled: true, name: false, outline: false, clip: true}}
      : exportSettings,
      loader,
      theme,
      null,
      null,
      [],
      plugin,
      0,
      getExportPadding(plugin, file),
      undefined,
      true
    )).outerHTML);
  
  if (!svg) {
    return null;
  }

  //cache SVG should have the width and height parameters and not the embedded font
  if(!Boolean(maybeSVG)) {
    cacheReady && imageCache.addImageToCache(cacheKey,"", svg);
  }

  svg.removeAttribute("width");
  svg.removeAttribute("height");
  containerElement.append(svg);
  return containerElement;
}

/**
 * Generates an IMG or DIV element
 * - The IMG element will have the drawing encoded as a base64 SVG or a PNG (depending on settings)
 * - The DIV element will have the drawing as an SVG element
 * @param parts {imgElementAttributes} - display properties of the image
 * @returns {Promise<HTMLElement>} - the IMG HTML element containing the image
 */
const getIMG = async (
  imgAttributes: imgElementAttributes,
  onCanvas: boolean = false,
): Promise<HTMLImageElement | HTMLDivElement> => {
  (process.env.NODE_ENV === 'development') && DEBUGGING && debug(getIMG, `MarkdownPostProcessor.ts > getIMG`, imgAttributes);
  let file = imgAttributes.file;
  if (!imgAttributes.file) {
    const f = vault.getAbstractFileByPath(imgAttributes.fname?.split("#")[0]);
    if (!(f && f instanceof TFile)) {
      return null;
    }
    file = f;
  }

  const filenameParts = getEmbeddedFilenameParts(imgAttributes.fname);

  // https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/387
  imgAttributes.style = imgAttributes.style.map(s=>s.replaceAll(" ", "-"));

  const forceTheme = hasExportTheme(plugin, file)
    ? getExportTheme(plugin, file, "light")
    : undefined;

  const exportSettings: ExportSettings = {
    withBackground: getWithBackground(plugin, file),
    withTheme: forceTheme ? true : plugin.settings.exportWithTheme,
    isMask: isMaskFile(plugin, file),
  };

  const theme =
    forceTheme ??
    (plugin.settings.previewMatchObsidianTheme
      ? isObsidianThemeDark()
        ? "dark"
        : "light"
      : !plugin.settings.exportWithTheme
      ? "light"
      : undefined);
  if (theme) {
    exportSettings.withTheme = true;
  }
  const loader = new EmbeddedFilesLoader(
    plugin,
    theme ? theme === "dark" : undefined,
  );

  const cacheReady = imageCache.isReady();

  await plugin.awaitInit();
  switch (plugin.settings.previewImageType) {
    case PreviewImageType.PNG: {
      const img = createEl("img");
      setStyle({element:img,imgAttributes,onCanvas});
      return await _getPNG({imgAttributes,filenameParts,theme,cacheReady,img,file,exportSettings,loader});
    }
    case PreviewImageType.SVGIMG: {
      const img = createEl("img");
      setStyle({element:img,imgAttributes,onCanvas});
      return await _getSVGIMG({filenameParts,theme,cacheReady,img,file,exportSettings,loader});
    }
    case PreviewImageType.SVG:  {
      const img = createEl("div");
      setStyle({element:img,imgAttributes,onCanvas});
      return await _getSVGNative({filenameParts,theme,cacheReady,containerElement: img,file,exportSettings,loader});
    }
  }
};

const addSVGToImgSrc = (img: HTMLImageElement, svg: SVGSVGElement, cacheReady: boolean, cacheKey: ImageKey):HTMLImageElement => {
  (process.env.NODE_ENV === 'development') && DEBUGGING && debug(addSVGToImgSrc, `MarkdownPostProcessor.ts > addSVGToImgSrc`);
  //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2026
  //const svgString = new XMLSerializer().serializeToString(svg);
  const svgString = svg.outerHTML;
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const blobUrl = URL.createObjectURL(blob);
  img.setAttribute("src", blobUrl);
  cacheReady && imageCache.addImageToCache(cacheKey, blobUrl, blob);
  return img;
}

const createImgElement = async (
  attr: imgElementAttributes,
  onCanvas: boolean = false,
) :Promise<HTMLElement> => {
  (process.env.NODE_ENV === 'development') && DEBUGGING && debug(createImgElement, `MarkdownPostProcessor.ts > createImgElement`);
  const imgOrDiv = await getIMG(attr,onCanvas);
  if(!imgOrDiv) {
    return null;
  }
  imgOrDiv.setAttribute("fileSource", attr.fname);
  if (attr.fwidth) {
    imgOrDiv.setAttribute("w", attr.fwidth);
  }
  if (attr.fheight) {
    imgOrDiv.setAttribute("h", attr.fheight);
  }
  imgOrDiv.setAttribute("draggable","false");
  imgOrDiv.setAttribute("onCanvas",onCanvas?"true":"false");

  let timer:number;
  const clickEvent = (ev:PointerEvent) => {
    if (!isHTMLElement(ev.target)) {
      return;
    }
    const targetElement = ev.target as HTMLElement;
    const containerElement = targetElement.hasClass("excalidraw-embedded-img")
      ? ev.target
      : getParentOfClass(targetElement, "excalidraw-embedded-img");
    if (!containerElement) {
      return;
    }
    const src = imgOrDiv.getAttribute("fileSource");
    if (src) {
      const srcParts = src.match(/([^#]*)(.*)/);
      if(!srcParts) return;
        const f = vault.getAbstractFileByPath(srcParts[1]) as TFile;
        const linkModifier = linkClickModifierType(ev);
        if (plugin.isExcalidrawFile(f) && isMaskFile(plugin, f)) {
          (async () => {
              const linkString = `[[${f.path}${srcParts[2]?"#"+srcParts[2]:""}]] ${getExcalidrawFileForwardLinks(plugin.app, f, new Set<string>())}`;
              const result = await linkPrompt(linkString, plugin.app);
              if(!result) return;
              const [file, linkText, subpath] = result;
              if(plugin.isExcalidrawFile(file)) {
                plugin.openDrawing(file,linkModifier, true, subpath);
                return;
              }
              let paneType: boolean | PaneType = false;
              switch(linkModifier) {
                case "active-pane": paneType = false; break;
                case "new-pane": paneType = "split"; break;
                case "popout-window": paneType = "window"; break;
                case "new-tab": paneType = "tab"; break;
                case "md-properties": paneType = "tab"; break;
              }
              plugin.app.workspace.openLinkText(linkText,"",paneType,subpath ? {eState: {subpath}} : {});
          })()
          return;
        }
      plugin.openDrawing(f,linkModifier,true,srcParts[2]);
    } //.ctrlKey||ev.metaKey);
  };
  //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1003
  let pointerDownEvent:any;
  const eventElement = imgOrDiv as HTMLElement;
  
  /*plugin.settings.previewImageType === PreviewImageType.SVG
    ? imgOrDiv.firstElementChild as HTMLElement
    : imgOrDiv;*/

  eventElement.addEventListener("pointermove",(ev)=>{
    if(!timer) return;
    if(Math.abs(ev.screenX-pointerDownEvent.screenX)>10 || Math.abs(ev.screenY-pointerDownEvent.screenY)>10) {
      window.clearTimeout(timer);
      timer = null;
    }
  });  
  eventElement.addEventListener("pointerdown",(ev)=>{
    if(imgOrDiv?.parentElement?.hasClass("canvas-node-content")) return;
    //@ts-ignore
    const PLUGIN = app.plugins.plugins["obsidian-excalidraw-plugin"] as ExcalidrawPlugin;
    const timeoutValue = DEVICE.isDesktop ? PLUGIN.settings.longPressDesktop : PLUGIN.settings.longPressMobile;
    timer = window.setTimeout(()=>clickEvent(ev),timeoutValue);
    pointerDownEvent = ev;
  });
  eventElement.addEventListener("pointerup",()=>{
    if(timer) window.clearTimeout(timer);
    timer = null;
  })
  eventElement.addEventListener("dblclick",clickEvent);
  eventElement.addEventListener(RERENDER_EVENT, async (e) => {
    e.stopPropagation();
    const parent = imgOrDiv.parentElement;
    const imgMaxWidth = imgOrDiv.style.maxWidth;
    const imgMaxHeigth = imgOrDiv.style.maxHeight;
    const fileSource = imgOrDiv.getAttribute("fileSource");
    const onCanvas = imgOrDiv.getAttribute("onCanvas") === "true";
    const newImg = await createImgElement({
      fname: fileSource,
      fwidth: imgOrDiv.getAttribute("w"),
      fheight: imgOrDiv.getAttribute("h"),
      style: [...Array.from(imgOrDiv.classList)],
    }, onCanvas);
    if(!newImg) return;
    parent.empty();
    if(!onCanvas) {
      newImg.style.maxHeight = imgMaxHeigth;
      newImg.style.maxWidth = imgMaxWidth;
    }
    newImg.setAttribute("fileSource",fileSource);
    parent.append(newImg);
  });
  const cssClasses = getFileCSSClasses(attr.file);
  cssClasses.forEach((cssClass) => {
    if(imgOrDiv.hasClass(cssClass)) return;
    imgOrDiv.addClass(cssClass);
  });
  if(window?.ExcalidrawAutomate?.plugin?.settings?.canvasImmersiveEmbed) {
    if(!imgOrDiv.hasClass("excalidraw-canvas-immersive")) {
      imgOrDiv.addClass("excalidraw-canvas-immersive");
    }
  } else {
    if(imgOrDiv.hasClass("excalidraw-canvas-immersive")) {
      imgOrDiv.removeClass("excalidraw-canvas-immersive");
    }
  }
  return imgOrDiv;
}

const createImageDiv = async (
  attr: imgElementAttributes,
  onCanvas: boolean = false
): Promise<HTMLDivElement> => {
  (process.env.NODE_ENV === 'development') && DEBUGGING && debug(createImageDiv, `MarkdownPostProcessor.ts > createImageDiv`);
  const img = await createImgElement(attr, onCanvas);
  return createDiv(attr.style.join(" "), (el) => el.append(img));
};

const processReadingMode = async (
  embeddedItems: NodeListOf<Element> | [HTMLElement],
  ctx: MarkdownPostProcessorContext,
) => {
  (process.env.NODE_ENV === 'development') && DEBUGGING_MPP && debug(processReadingMode, `MarkdownPostProcessor.ts > processReadingMode`);
  //We are processing a non-excalidraw file in reading mode
  //Embedded files will be displayed in an .internal-embed container

  //Iterating all the containers in the file to check which one is an excalidraw drawing
  //This is a for loop instead of embeddedItems.forEach() because processInternalEmbed at the end
  //is awaited, otherwise excalidraw images would not display in the Kanban plugin
  for (const maybeDrawing of embeddedItems) {
    //check to see if the file in the src attribute exists
    const fname = maybeDrawing.getAttribute("src")?.split("#")[0];
    if(!fname) continue;

    const file = metadataCache.getFirstLinkpathDest(fname, ctx.sourcePath);

    //if the embeddedFile exits and it is an Excalidraw file
    //then lets replace the .internal-embed with the generated PNG or SVG image
    if (file && file instanceof TFile && plugin.isExcalidrawFile(file)) {
      if(isTextOnlyEmbed(maybeDrawing)) {
        //legacy reference to a block or section as text
        //should be embedded as legacy text
        continue;
      }
  
      maybeDrawing.parentElement.replaceChild(
        await processInternalEmbed(maybeDrawing,file),
        maybeDrawing
      );
    }
  }
};

const processInternalEmbed = async (internalEmbedEl: Element, file: TFile ):Promise<HTMLDivElement> => {
  (process.env.NODE_ENV === 'development') && DEBUGGING_MPP && debug(processInternalEmbed, `MarkdownPostProcessor.ts > processInternalEmbed`, internalEmbedEl);
  const attr: imgElementAttributes = {
    fname: "",
    fheight: "",
    fwidth: "",
    style: [],
  };

  const src = internalEmbedEl.getAttribute("src");
  if(!src) return;

  //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1059
  internalEmbedEl.removeClass("markdown-embed");
  internalEmbedEl.removeClass("inline-embed");
  internalEmbedEl.addClass("media-embed");
  internalEmbedEl.addClass("image-embed");

  attr.fwidth = internalEmbedEl.getAttribute("width")
    ? internalEmbedEl.getAttribute("width")
    : getDefaultWidth(plugin);
  attr.fheight = internalEmbedEl.getAttribute("height")
    ? internalEmbedEl.getAttribute("height")
    : getDefaultHeight(plugin);
  let alt = internalEmbedEl.getAttribute("alt");
  attr.style = ["excalidraw-svg"];
  processAltText(src.split("#")[0],alt,attr);
  const fnameParts = getEmbeddedFilenameParts(src);
  attr.fname = file?.path + (fnameParts.hasBlockref||fnameParts.hasSectionref?fnameParts.linkpartReference:"");
  attr.file = file;
  return await createImageDiv(attr);
}

function getDimensionsFromAliasString(data: string) {
  const dimensionRegex = /^(?<width>\d+%|\d+)(x(?<height>\d+%|\d+))?$/;
  const heightOnlyRegex = /^x(?<height>\d+%|\d+)$/;

  const match = data.match(dimensionRegex) || data.match(heightOnlyRegex);
  if (match) {
      const { width, height } = match.groups;

      // Ensure width and height do not start with '0'
      if ((width && width.startsWith('0') && width !== '0') || 
          (height && height.startsWith('0') && height !== '0')) {
          return null;
      }

      return {
          width: width || undefined,
          height: height || undefined,
      };
  }
  
  // If the input starts with a 0 or is a decimal, return null
  if (/^0\d|^\d+\.\d+/.test(data)) {
      return null;
  }
  return null;
}

type AliasParts = { alias?: string, width?: string, height?: string, style?: string };
function parseAlias(input: string):AliasParts {
  const result:AliasParts = {};
  const parts = input.split('|').map(part => part.trim());

  switch (parts.length) {
      case 1:
          const singleMatch = getDimensionsFromAliasString(parts[0]);
          if (singleMatch) {
              return singleMatch; // Return dimensions if valid
          }
          result.style = parts[0]; // Otherwise, return as style
          break;

      case 2:
          const firstDim = getDimensionsFromAliasString(parts[0]);
          const secondDim = getDimensionsFromAliasString(parts[1]);

          if (secondDim) {
              result.alias = parts[0];
              result.width = secondDim.width;
              result.height = secondDim.height;
          } else if (firstDim) {
              result.width = firstDim.width;
              result.height = firstDim.height;
              result.style = parts[1]; // Second part is style
          } else {
              result.alias = parts[0];
              result.style = parts[1]; // Assuming second part is style
          }
          break;

      case 3:
          const middleMatch = getDimensionsFromAliasString(parts[1]);
          if (middleMatch) {
              result.alias = parts[0];
              result.width = middleMatch.width;
              result.height = middleMatch.height;
              result.style = parts[2];
          } else {
              result.alias = parts[0];
              result.style = parts[2]; // Last part is style
          }
          break;

      default:
          const secondValue = getDimensionsFromAliasString(parts[1]);
          if (secondValue) {
              result.alias = parts[0];
              result.width = secondValue.width;
              result.height = secondValue.height;
              result.style = parts[parts.length - 1]; // Last part is style
          } else {
              result.alias = parts[0];
              result.style = parts[parts.length - 1]; // Last part is style
          }
          break;
  }

  // Clean up the result to remove undefined properties
  Object.keys(result).forEach((key: keyof AliasParts) => {
    if (result[key] === undefined) {
        delete result[key];
    }
  });

  return result;
}

const processAltText = (
  fname: string,
  alt:string,
  attr: imgElementAttributes
) => {
  (process.env.NODE_ENV === 'development') && DEBUGGING && debug(processAltText, `MarkdownPostProcessor.ts > processAltText`);
  if (alt && !alt.startsWith(fname)) {
    const aliasParts = parseAlias(alt);
    attr.fwidth = aliasParts.width ?? attr.fwidth;
    attr.fheight = aliasParts.height ?? attr.fheight;
    if (aliasParts.style && !aliasParts.style.startsWith(fname)) {
      attr.style = [`excalidraw-svg${`-${aliasParts.style}`}`];
    }
  }
}

const isTextOnlyEmbed = (internalEmbedEl: Element):boolean => {
  (process.env.NODE_ENV === 'development') && DEBUGGING && debug(isTextOnlyEmbed, `MarkdownPostProcessor.ts > isTextOnlyEmbed`);
  const src = internalEmbedEl.getAttribute("src");
  if(!src) return true; //technically this does not mean this is a text only embed, but still should abort further processing
  const fnameParts = getEmbeddedFilenameParts(src);
  return !(fnameParts.hasArearef || fnameParts.hasGroupref || fnameParts.hasFrameref || fnameParts.hasClippedFrameref) &&
    (fnameParts.hasBlockref || fnameParts.hasSectionref)
}

const tmpObsidianWYSIWYG = async (
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext,
  isPrinting: boolean,
  isMarkdownReadingMode: boolean,
  isHoverPopover: boolean,
) => {
  (process.env.NODE_ENV === 'development') && DEBUGGING_MPP && debug(tmpObsidianWYSIWYG, `MarkdownPostProcessor.ts > tmpObsidianWYSIWYG`);
  const file = app.vault.getAbstractFileByPath(ctx.sourcePath);
  if(!(file instanceof TFile)) return;
  if(!plugin.isExcalidrawFile(file)) return;

  //@ts-ignore
  if (ctx.remainingNestLevel < 4) {
    return;
  }

  //internal-embed: Excalidraw is embedded into a markdown document
  //markdown-reading-view: we are processing the markdown reading view of an actual Excalidraw file
  //markdown-embed: we are processing the hover preview of a markdown file
  //alt, width, and height attributes of .internal-embed to size and style the image
    
  //@ts-ignore
  const containerEl = ctx.containerEl;

  if(!plugin.settings.renderImageInMarkdownReadingMode && isMarkdownReadingMode) { // containerEl.parentElement?.parentElement?.hasClass("markdown-reading-view")) {
    return;
  }

  if(!plugin.settings.renderImageInMarkdownToPDF && isPrinting) { //containerEl.parentElement?.hasClass("print")) {
    return;
  }

  let internalEmbedDiv: HTMLElement = containerEl;
  while (
    !internalEmbedDiv.hasClass("print") &&
    !internalEmbedDiv.hasClass("dataview") &&
    !internalEmbedDiv.hasClass("cm-preview-code-block") &&
    !internalEmbedDiv.hasClass("cm-embed-block") &&
    !internalEmbedDiv.hasClass("internal-embed") &&
    !internalEmbedDiv.hasClass("markdown-reading-view") &&
    !internalEmbedDiv.hasClass("markdown-embed") &&
    internalEmbedDiv.parentElement
  ) {
    internalEmbedDiv = internalEmbedDiv.parentElement;
  }

  if(
    internalEmbedDiv.hasClass("dataview") ||
    internalEmbedDiv.hasClass("cm-preview-code-block") ||
    internalEmbedDiv.hasClass("cm-embed-block")
  ) { 
    return; //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/835
  }

  
  if(!plugin.settings.renderImageInHoverPreviewForMDNotes) {
    //const isHoverPopover = internalEmbedDiv.parentElement?.hasClass("hover-popover");
    const shouldOpenMD = Boolean(ctx.frontmatter?.["excalidraw-open-md"]);
    if(isHoverPopover && shouldOpenMD) {
      return;
    }
  }

  //const isPrinting = Boolean(internalEmbedDiv.hasClass("print"));

  const attr: imgElementAttributes = {
    fname: ctx.sourcePath,
    fheight: isPrinting ? "100%" : getDefaultHeight(plugin),
    fwidth: isPrinting ? "100%" : getDefaultWidth(plugin),
    style: ["excalidraw-svg"],
  };
  
  attr.file = file;

  const markdownEmbed = internalEmbedDiv.hasClass("markdown-embed");
  const markdownReadingView = isPrinting || isMarkdownReadingMode; //internalEmbedDiv.hasClass("markdown-reading-view")
  if (!internalEmbedDiv.hasClass("internal-embed") && (markdownEmbed || markdownReadingView)) {
    if(isPrinting) {
      internalEmbedDiv = containerEl;
    }
    //We are processing the markdown preview of an actual Excalidraw file
    //the excalidraw file in markdown preview mode
    const isFrontmatterDiv = Boolean(el.querySelector(".frontmatter"));
    let areaPreview = false;
    if(Boolean(ctx.frontmatter)) {
      el.empty();
    } else {
      //Obsidian changed this at some point from h3 to h5 and also the text...
      const warningEl = el.querySelector("div>*[data-heading^='Unable to find ");
      if(warningEl) {
        const dataHeading = warningEl.getAttr("data-heading");
        const ref = warningEl.getAttr("data-heading").match(/Unable to find[^^]+(\^(?:group=|area=|frame=|clippedframe=)[^ ”]+)/)?.[1];
        if(ref) {
          attr.fname = file.path + "#" +ref;
          areaPreview = true;
        }
      }
    }
    if(!isFrontmatterDiv && !areaPreview) {
      if(el.parentElement === containerEl) containerEl.removeChild(el);
      return;
    }
    internalEmbedDiv.empty();
    const onCanvas = internalEmbedDiv.hasClass("canvas-node-content");
    const imgDiv = await createImageDiv(attr, onCanvas);
    if(markdownEmbed) {
      //display image on canvas without markdown frame
      internalEmbedDiv.removeClass("markdown-embed");
      internalEmbedDiv.removeClass("inline-embed");
      internalEmbedDiv.addClass("media-embed");
      internalEmbedDiv.addClass("image-embed");
      if(!onCanvas && imgDiv.firstChild instanceof HTMLElement) {
        imgDiv.firstChild.style.maxHeight = "100%";
        imgDiv.firstChild.style.maxWidth = null;
      }
      internalEmbedDiv.appendChild(imgDiv.firstChild);
      return;
    }
    internalEmbedDiv.appendChild(imgDiv);
    return;
  }

  if(isTextOnlyEmbed(internalEmbedDiv)) {
    //legacy reference to a block or section as text
    //should be embedded as legacy text
    return;
  }

  el.empty();

  if(internalEmbedDiv.hasAttribute("ready")) {  
    return;
  }
  internalEmbedDiv.setAttribute("ready","");

  internalEmbedDiv.empty();
  const imgDiv = await processInternalEmbed(internalEmbedDiv,file);
  internalEmbedDiv.appendChild(imgDiv);

  //timer to avoid the image flickering when the user is typing
  let timer: number = null;
  const markdownObserverFn: MutationCallback = (m) => {
    if (!["alt", "width", "height"].contains(m[0]?.attributeName)) {
      return;
    }
    if (timer) {
      window.clearTimeout(timer);
    }
    timer = window.setTimeout(async () => {
      timer = null;
      internalEmbedDiv.empty();
      const imgDiv = await processInternalEmbed(internalEmbedDiv,file);
      internalEmbedDiv.appendChild(imgDiv);    
    }, 500);
  }
  const observer = DEBUGGING
    ? new CustomMutationObserver(markdownObserverFn, "markdowPostProcessorObserverFn")
    : new MutationObserver(markdownObserverFn);
  observer.observe(internalEmbedDiv, {
    attributes: true, //configure it to listen to attribute changes
  });
};

const docIDs = new Set<string>();
/**
 *
 * @param el
 * @param ctx
 */
export const markdownPostProcessor = async (
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext,
) => {
  await plugin.awaitSettings();
  const isPrinting = Boolean(document.body.querySelectorAll("body > .print").length>0);
  //firstElementChild: https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/1956
  const isFrontmatter = el.hasClass("mod-frontmatter") ||
    el.firstElementChild?.hasClass("frontmatter") ||
    el.firstElementChild?.hasClass("block-language-yaml");
  if(isPrinting && isFrontmatter) {
    //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2184
    const file = app.vault.getAbstractFileByPath(ctx.sourcePath);
    const isDrawing = file && file instanceof TFile && plugin.isExcalidrawFile(file);
    if(isDrawing) {
      return;
    }
  }
  
  //@ts-ignore
  const containerEl = ctx.containerEl;

  (process.env.NODE_ENV === 'development') && DEBUGGING_MPP && debug(markdownPostProcessor, `MarkdownPostProcessor.ts > markdownPostProcessor`, ctx, el);

  //check to see if we are rendering in editing mode or live preview
  //if yes, then there should be no .internal-embed containers  
  const isMarkdownReadingMode = Boolean(containerEl && getParentOfClass(containerEl, "markdown-reading-view"));
  const isHoverPopover = Boolean(containerEl && getParentOfClass(containerEl, "hover-popover"));
  const isPreview = (isHoverPopover && Boolean(ctx?.frontmatter?.["excalidraw-open-md"]) && !plugin.settings.renderImageInHoverPreviewForMDNotes);
  const embeddedItems = el.querySelectorAll(".internal-embed");
  
  if(isPrinting && plugin.settings.renderImageInMarkdownToPDF) {
    await tmpObsidianWYSIWYG(el, ctx, isPrinting, isMarkdownReadingMode, isHoverPopover);
    return;
  }

  if (!isPreview && embeddedItems.length === 0) {
    if(isFrontmatter) {
      docIDs.add(ctx.docId);
    } else {
      if(docIDs.has(ctx.docId) && !el.hasChildNodes()) {
        docIDs.delete(ctx.docId);
      }
      const isAreaGroupFrameRef = el.querySelectorAll('[data-heading^="Unable to find"]').length === 1;
      if(!isAreaGroupFrameRef) {
        return;
      }
    }
    await tmpObsidianWYSIWYG(el, ctx, isPrinting, isMarkdownReadingMode, isHoverPopover);
    return;
  }

  //If the file being processed is an excalidraw file,
  //then I want to hide all embedded items as these will be
  //transcluded text element or some other transcluded content inside the Excalidraw file
  //in reading mode these elements should be hidden
  const excalidrawFile = Boolean(ctx.frontmatter?.hasOwnProperty("excalidraw-plugin"));
  if (!(isPreview || isMarkdownReadingMode || isPrinting) && excalidrawFile) {
    el.style.display = "none";
    return;
  }

  await processReadingMode(embeddedItems, ctx);
};

/**
 * internal-link quick preview
 * @param e
 * @returns
 */
export const hoverEvent = (e: any) => {
  if (!e.linktext) {
    plugin.hover.linkText = null;
    return;
  }
  plugin.hover.linkText = e.linktext;
  plugin.hover.sourcePath = e.sourcePath;
};

//monitoring for div.popover.hover-popover.file-embed.is-loaded to be added to the DOM tree
const legacyExcalidrawPopoverObserverFn: MutationCallback = async (m) => {
  if (m.length === 0) {
    return;
  }
  if (!plugin.hover.linkText) {
    return;
  }
  if (!plugin.hover.linkText.endsWith("excalidraw")) {
    return;
  }
  const file = metadataCache.getFirstLinkpathDest(
    plugin.hover.linkText,
    plugin.hover.sourcePath ? plugin.hover.sourcePath : "",
  );
  if (!file) {
    return;
  }
  if (!(file instanceof TFile)) {
    return;
  }
  if (file.extension !== "excalidraw") {
    return;
  }

  const svgFileName = getIMGFilename(file.path, "svg");
  const svgFile = vault.getAbstractFileByPath(svgFileName);
  if (svgFile && svgFile instanceof TFile) {
    return;
  } //If auto export SVG or PNG is enabled it will be inserted at the top of the excalidraw file. No need to manually insert hover preview

  const pngFileName = getIMGFilename(file.path, "png");
  const pngFile = vault.getAbstractFileByPath(pngFileName);
  if (pngFile && pngFile instanceof TFile) {
    return;
  } //If auto export SVG or PNG is enabled it will be inserted at the top of the excalidraw file. No need to manually insert hover preview

  if (!plugin.hover.linkText) {
    return;
  }
  if (m.length !== 1) {
    return;
  }
  if (m[0].addedNodes.length !== 1) {
    return;
  }
  if (
    (m[0].addedNodes[0] as HTMLElement).className !== "popover hover-popover"
  ) {
    return;
  }
  const node = m[0].addedNodes[0];
  node.empty();

  //this div will be on top of original DIV. By stopping the propagation of the click
  //I prevent the default Obsidian feature of opening the link in the native app
  const img = await getIMG({
    file,
    fname: file.path,
    fwidth: "300",
    fheight: null,
    style: ["excalidraw-svg"],
  });
  const div = createDiv("", async (el) => {
    el.appendChild(img);
    el.setAttribute("src", file.path);
    el.onClickEvent((ev) => {
      ev.stopImmediatePropagation();
      const src = el.getAttribute("src");
      if (src) {
        plugin.openDrawing(
          vault.getAbstractFileByPath(src) as TFile,
          linkClickModifierType(ev)
        );
      } //.ctrlKey||ev.metaKey);
    });
  });
  node.appendChild(div);
};

export const legacyExcalidrawPopoverObserver = DEBUGGING
  ? new CustomMutationObserver(legacyExcalidrawPopoverObserverFn, "legacyExcalidrawPopoverObserverFn")
  : new MutationObserver(legacyExcalidrawPopoverObserverFn);

