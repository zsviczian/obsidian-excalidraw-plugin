import {
  MarkdownPostProcessorContext,
  MetadataCache,
  TFile,
  Vault,
} from "obsidian";
import { CTRL_OR_CMD, RERENDER_EVENT } from "./Constants";
import { EmbeddedFilesLoader } from "./EmbeddedFileLoader";
import { createPNG, createSVG } from "./ExcalidrawAutomate";
import { ExportSettings } from "./ExcalidrawView";
import ExcalidrawPlugin from "./main";
import {getIMGFilename,} from "./utils/FileUtils";
import {
  embedFontsInSVG,
  getEmbeddedFilenameParts,
  getExportTheme,
  getQuickImagePreview,
  getExportPadding,
  getWithBackground,
  hasExportTheme,
  svgToBase64,
} from "./utils/Utils";
import { isObsidianThemeDark } from "./utils/ObsidianUtils";

interface imgElementAttributes {
  file?: TFile;
  fname: string; //Excalidraw filename
  fwidth: string; //Display width of image
  fheight: string; //Display height of image
  style: string; //css style to apply to IMG element
}

let plugin: ExcalidrawPlugin;
let vault: Vault;
let metadataCache: MetadataCache;

const getDefaultWidth = (plugin: ExcalidrawPlugin): string => {
  const width = parseInt(plugin.settings.width);
  if (isNaN(width) || width === 0 || width === null) {
    return "400";
  }
  return plugin.settings.width;
};

export const initializeMarkdownPostProcessor = (p: ExcalidrawPlugin) => {
  plugin = p;
  vault = p.app.vault;
  metadataCache = p.app.metadataCache;
};

/**
 * Generates an img element with the drawing encoded as a base64 SVG or a PNG (depending on settings)
 * @param parts {imgElementAttributes} - display properties of the image
 * @returns {Promise<HTMLElement>} - the IMG HTML element containing the image
 */
const getIMG = async (
  imgAttributes: imgElementAttributes,
  onCanvas: boolean = false,
): Promise<HTMLElement> => {
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
  imgAttributes.style = imgAttributes.style.replaceAll(" ", "-");

  const forceTheme = hasExportTheme(plugin, file)
    ? getExportTheme(plugin, file, "light")
    : undefined;

  const exportSettings: ExportSettings = {
    withBackground: getWithBackground(plugin, file),
    withTheme: forceTheme ? true : plugin.settings.exportWithTheme,
  };
  const img = createEl("img");
  let style = `max-width:${imgAttributes.fwidth}${imgAttributes.fwidth.match(/\d$/) ? "px":""}; `; //width:100%;`; //removed !important https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/886
  if (imgAttributes.fheight) {
    style += `height:${imgAttributes.fheight}px;`;
  }
  if(!onCanvas) img.setAttribute("style", style);
  img.addClass(imgAttributes.style);

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

  if (!plugin.settings.displaySVGInPreview) {
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

    //In case of PNG I cannot change the viewBox to select the area of the element
    //being referenced. For PNG only the group reference works
    const quickPNG = !filenameParts.hasGroupref
      ? await getQuickImagePreview(plugin, file.path, "png")
      : undefined;

    const png =
      quickPNG ??
      (await createPNG(
        filenameParts.hasGroupref
          ? filenameParts.filepath + filenameParts.linkpartReference
          : file.path,
        scale,
        exportSettings,
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
    return img;
  }

  if(!(filenameParts.hasBlockref || filenameParts.hasSectionref)) {
    const quickSVG = await getQuickImagePreview(plugin, file.path, "svg");
    if (quickSVG) {
      img.setAttribute("src", svgToBase64(quickSVG));
      return img;
    }
  }
  const svgSnapshot = (
    await createSVG(
      filenameParts.hasGroupref || filenameParts.hasBlockref || filenameParts.hasSectionref
        ? filenameParts.filepath + filenameParts.linkpartReference
        : file.path,
      true,
      exportSettings,
      loader,
      theme,
      null,
      null,
      [],
      plugin,
      0,
      getExportPadding(plugin, file),
    )
  ).outerHTML;
  let svg: SVGSVGElement = null;
  const el = document.createElement("div");
  el.innerHTML = svgSnapshot;
  const firstChild = el.firstChild;
  if (firstChild instanceof SVGSVGElement) {
    svg = firstChild;
  }
  if (!svg) {
    return null;
  }
  svg = embedFontsInSVG(svg, plugin);
  //svg.removeAttribute("width");
  //svg.removeAttribute("height");
  img.setAttribute("src", svgToBase64(svg.outerHTML));
  return img;
};

const createImgElement = async (
  attr: imgElementAttributes,
  onCanvas: boolean = false,
) :Promise<HTMLElement> => {
  const img = await getIMG(attr,onCanvas);
  img.setAttribute("fileSource", attr.fname);
  if (attr.fwidth) {
    img.setAttribute("w", attr.fwidth);
  }
  if (attr.fheight) {
    img.setAttribute("h", attr.fheight);
  }
  img.setAttribute("draggable","false");
  img.setAttribute("onCanvas",onCanvas?"true":"false");

  let timer:NodeJS.Timeout;
  const clickEvent = (ev:PointerEvent) => {
    if (
      ev.target instanceof Element &&
      ev.target.tagName.toLowerCase() != "img"
    ) {
      return;
    }
    const src = img.getAttribute("fileSource");
    if (src) {
      const srcParts = src.match(/([^#]*)(.*)/);
      if(!srcParts) return;
      plugin.openDrawing(
        vault.getAbstractFileByPath(srcParts[1]) as TFile,
        ev[CTRL_OR_CMD]
          ? "new-pane"
          : (ev.metaKey && !app.isMobile)
            ? "popout-window"
            : "active-pane",
        true,
        srcParts[2],
      );
    } //.ctrlKey||ev.metaKey);
  };
  img.addEventListener("pointerdown",(ev)=>{
    if(img?.parentElement?.hasClass("canvas-node-content")) return;
    timer = setTimeout(()=>clickEvent(ev),500);
  });
  img.addEventListener("pointerup",()=>{
    if(timer) clearTimeout(timer);
    timer = null;
  })
  img.addEventListener("dblclick",clickEvent);
  img.addEventListener(RERENDER_EVENT, async (e) => {
    e.stopPropagation();
    const parent = img.parentElement;
    const imgMaxWidth = img.style.maxWidth;
    const imgMaxHeigth = img.style.maxHeight;
    const fileSource = img.getAttribute("fileSource");
    const onCanvas = img.getAttribute("onCanvas") === "true";
    const newImg = await createImgElement({
      fname: fileSource,
      fwidth: img.getAttribute("w"),
      fheight: img.getAttribute("h"),
      style: img.getAttribute("class"),
    }, onCanvas);
    parent.empty();
    if(!onCanvas) {
      newImg.style.maxHeight = imgMaxHeigth;
      newImg.style.maxWidth = imgMaxWidth;
    }
    newImg.setAttribute("fileSource",fileSource);
    parent.append(newImg);
  });
  return img;
}

const createImageDiv = async (
  attr: imgElementAttributes,
  onCanvas: boolean = false
): Promise<HTMLDivElement> => {
  const img = await createImgElement(attr, onCanvas);
  return createDiv(attr.style, (el) => el.append(img));
};

const processReadingMode = async (
  embeddedItems: NodeListOf<Element> | [HTMLElement],
  ctx: MarkdownPostProcessorContext,
) => {
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
  const attr: imgElementAttributes = {
    fname: "",
    fheight: "",
    fwidth: "",
    style: "",
  };

  const src = internalEmbedEl.getAttribute("src");
  if(!src) return;
  attr.fwidth = internalEmbedEl.getAttribute("width")
  ? internalEmbedEl.getAttribute("width")
  : getDefaultWidth(plugin);
  attr.fheight = internalEmbedEl.getAttribute("height");
  let alt = internalEmbedEl.getAttribute("alt");
  attr.style = "excalidraw-svg";
  processAltText(src.split("#")[0],alt,attr);
  const fnameParts = getEmbeddedFilenameParts(src);
  attr.fname = file?.path + (fnameParts.hasBlockref||fnameParts.hasSectionref?fnameParts.linkpartReference:"");
  attr.file = file;
  return await createImageDiv(attr);
}

const processAltText = (
  fname: string,
  alt:string,
  attr: imgElementAttributes
) => {
  if (alt && !alt.startsWith(fname)) {
    //2:width, 3:height, 4:style  12        3           4
    const parts = alt.match(/[^\|\d]*\|?((\d*%?)x?(\d*%?))?\|?(.*)/);
    attr.fwidth = parts[2] ?? attr.fwidth;
    attr.fheight = parts[3] ?? attr.fheight;
    if (parts[4] && !parts[4].startsWith(fname)) {
      attr.style = `excalidraw-svg${`-${parts[4]}`}`;
    }
    if (
      (!parts[4] || parts[4]==="") &&
      (!parts[2] || parts[2]==="") &&
      parts[0] && parts[0] !== ""
    ) {
      attr.style = `excalidraw-svg${`-${parts[0]}`}`;
    }
  }
}

const isTextOnlyEmbed = (internalEmbedEl: Element):boolean => {
  const src = internalEmbedEl.getAttribute("src");
  if(!src) return true; //technically this does not mean this is a text only embed, but still should abort further processing
  const fnameParts = getEmbeddedFilenameParts(src);
  return !(fnameParts.hasArearef || fnameParts.hasGroupref) &&
    (fnameParts.hasBlockref || fnameParts.hasSectionref)
}

const tmpObsidianWYSIWYG = async (
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext,
) => {
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
  let internalEmbedDiv: HTMLElement = containerEl;
  while (
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

  const attr: imgElementAttributes = {
    fname: ctx.sourcePath,
    fheight: "",
    fwidth: getDefaultWidth(plugin),
    style: "excalidraw-svg",
  };
  
  attr.file = file;

  const markdownEmbed = internalEmbedDiv.hasClass("markdown-embed");
  const markdownReadingView = internalEmbedDiv.hasClass("markdown-reading-view");
  if (!internalEmbedDiv.hasClass("internal-embed") && (markdownEmbed || markdownReadingView)) {
    //We are processing the markdown preview of an actual Excalidraw file
    //the excalidraw file in markdown preview mode
    const isFrontmatterDiv = Boolean(el.querySelector(".frontmatter"));
    el.empty();
    if(!isFrontmatterDiv) {
      if(el.parentElement === containerEl) containerEl.removeChild(el);
      return;
    }
    internalEmbedDiv.empty();
    const onCanvas = internalEmbedDiv.hasClass("canvas-node-content");
    const imgDiv = await createImageDiv(attr, onCanvas);
    if(markdownEmbed) {
      if(onCanvas) {
        internalEmbedDiv.removeClass("markdown-embed");
        internalEmbedDiv.addClass("media-embed");
        internalEmbedDiv.addClass("image-embed");
      }
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
  let timer: NodeJS.Timeout = null;
  const observer = new MutationObserver((m) => {
    if (!["alt", "width", "height"].contains(m[0]?.attributeName)) {
      return;
    }
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(async () => {
      timer = null;
      internalEmbedDiv.empty();
      const imgDiv = await processInternalEmbed(internalEmbedDiv,file);
      internalEmbedDiv.appendChild(imgDiv);    
    }, 500);
  });
  observer.observe(internalEmbedDiv, {
    attributes: true, //configure it to listen to attribute changes
  });
};

/**
 *
 * @param el
 * @param ctx
 */
export const markdownPostProcessor = async (
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext,
) => {

  //check to see if we are rendering in editing mode or live preview
  //if yes, then there should be no .internal-embed containers
  const embeddedItems = el.querySelectorAll(".internal-embed");
  if (embeddedItems.length === 0) {
    tmpObsidianWYSIWYG(el, ctx);
    return;
  }

  //If the file being processed is an excalidraw file,
  //then I want to hide all embedded items as these will be
  //transcluded text element or some other transcluded content inside the Excalidraw file
  //in reading mode these elements should be hidden
  const excalidrawFile = Boolean(ctx.frontmatter?.hasOwnProperty("excalidraw-plugin"));
  if (excalidrawFile) {
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
export const observer = new MutationObserver(async (m) => {
  if (m.length == 0) {
    return;
  }
  if (!plugin.hover.linkText) {
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
  if (m.length != 1) {
    return;
  }
  if (m[0].addedNodes.length != 1) {
    return;
  }
  if (
    //@ts-ignore
    !m[0].addedNodes[0].classNames !=
    "popover hover-popover file-embed is-loaded"
  ) {
    return;
  }
  const node = m[0].addedNodes[0];
  node.empty();

  //this div will be on top of original DIV. By stopping the propagation of the click
  //I prevent the default Obsidian feature of openning the link in the native app
  const img = await getIMG({
    file,
    fname: file.path,
    fwidth: "300",
    fheight: null,
    style: "excalidraw-svg",
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
          ev[CTRL_OR_CMD]
            ? "new-pane"
            : (ev.metaKey && !app.isMobile) 
              ? "popout-window"
              : "active-pane",
        );
      } //.ctrlKey||ev.metaKey);
    });
  });
  node.appendChild(div);
});
