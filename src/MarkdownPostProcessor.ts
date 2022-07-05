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
  getExportTheme,
  getQuickImagePreview,
  getSVGPadding,
  getWithBackground,
  hasExportTheme,
  svgToBase64,
} from "./utils/Utils";
import { isObsidianThemeDark } from "./utils/ObsidianUtils";
import { splitFolderAndFilename } from "./utils/FileUtils";

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
): Promise<HTMLElement> => {
  let file = imgAttributes.file;
  if (!imgAttributes.file) {
    const f = vault.getAbstractFileByPath(imgAttributes.fname);
    if (!(f && f instanceof TFile)) {
      return null;
    }
    file = f;
  }

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
  let style = `max-width:${imgAttributes.fwidth}px !important; width:100%;`;
  if (imgAttributes.fheight) {
    style += `height:${imgAttributes.fheight}px;`;
  }
  img.setAttribute("style", style);
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
    let scale = 1;
    if (width >= 600) {
      scale = 2;
    }
    if (width >= 1200) {
      scale = 3;
    }
    if (width >= 1800) {
      scale = 4;
    }
    if (width >= 2400) {
      scale = 5;
    }

    const png =
      (await getQuickImagePreview(plugin, file.path, "png")) ??
      (await createPNG(
        file.path,
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
  const quickSVG = await getQuickImagePreview(plugin, file.path, "svg");
  if (quickSVG) {
    img.setAttribute("src", svgToBase64(quickSVG));
    return img;
  }
  const svgSnapshot = (
    await createSVG(
      file.path,
      true,
      exportSettings,
      loader,
      theme,
      null,
      null,
      [],
      plugin,
      0,
      getSVGPadding(plugin, file),
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
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  img.setAttribute("src", svgToBase64(svg.outerHTML));
  return img;
};

const createImageDiv = async (
  attr: imgElementAttributes,
): Promise<HTMLDivElement> => {
  const img = await getIMG(attr);
  return createDiv(attr.style, (el) => {
    el.append(img);
    el.setAttribute("src", attr.file.path);
    if (attr.fwidth) {
      el.setAttribute("w", attr.fwidth);
    }
    if (attr.fheight) {
      el.setAttribute("h", attr.fheight);
    }
    el.onClickEvent((ev) => {
      if (
        ev.target instanceof Element &&
        ev.target.tagName.toLowerCase() != "img"
      ) {
        return;
      }
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
    el.addEventListener(RERENDER_EVENT, async (e) => {
      e.stopPropagation();
      el.empty();
      const img = await getIMG({
        fname: el.getAttribute("src"),
        fwidth: el.getAttribute("w"),
        fheight: el.getAttribute("h"),
        style: el.getAttribute("class"),
      });
      el.append(img);
    });
  });
};

const processInternalEmbeds = async (
  embeddedItems: NodeListOf<Element> | [HTMLElement],
  ctx: MarkdownPostProcessorContext,
) => {
  //if not, then we are processing a non-excalidraw file in reading mode
  //in that cases embedded files will be displayed in an .internal-embed container
  const attr: imgElementAttributes = {
    fname: "",
    fheight: "",
    fwidth: "",
    style: "",
  };
  let alt: string;
  let parts;
  let file: TFile;

  //Iterating through all the containers to check which one is an excalidraw drawing
  //This is a for loop instead of embeddedItems.forEach() because createImageDiv at the end
  //is awaited, otherwise excalidraw images would not display in the Kanban plugin
  for (const maybeDrawing of embeddedItems) {
    //check to see if the file in the src attribute exists
    attr.fname = maybeDrawing.getAttribute("src");
    file = metadataCache.getFirstLinkpathDest(
      attr.fname?.split("#")[0],
      ctx.sourcePath,
    );

    //if the embeddedFile exits and it is an Excalidraw file
    //then lets replace the .internal-embed with the generated PNG or SVG image
    if (file && file instanceof TFile && plugin.isExcalidrawFile(file)) {
      attr.fwidth = maybeDrawing.getAttribute("width")
        ? maybeDrawing.getAttribute("width")
        : getDefaultWidth(plugin);
      attr.fheight = maybeDrawing.getAttribute("height");
      alt = maybeDrawing.getAttribute("alt");
      if (alt == attr.fname) {
        alt = "";
      } //when the filename starts with numbers followed by a space Obsidian recognizes the filename as alt-text
      attr.style = "excalidraw-svg";
      if (alt) {
        //for some reason Obsidian renders ![]() in a DIV and ![[]] in a SPAN
        //also the alt-text of the DIV does not include the alt-text of the image
        //thus need to add an additional "|" character when its a SPAN
        if (maybeDrawing.tagName.toLowerCase() == "span") {
          alt = `|${alt}`;
        }
        //1:width, 2:height, 3:style  1      2      3
        parts = alt.match(/[^\|]*\|?(\d*%?)x?(\d*%?)\|?(.*)/);
        attr.fwidth = parts[1] ? parts[1] : getDefaultWidth(plugin);
        attr.fheight = parts[2];
        if (parts[3] != attr.fname) {
          attr.style = `excalidraw-svg${parts[3] ? `-${parts[3]}` : ""}`;
        }
      }
      attr.fname = file?.path;
      attr.file = file;
      const div = await createImageDiv(attr);
      maybeDrawing.parentElement.replaceChild(div, maybeDrawing);
    }
  }
};

const tmpObsidianWYSIWYG = async (
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext,
) => {
  if (!ctx.frontmatter) {
    return;
  }
  if (!ctx.frontmatter.hasOwnProperty("excalidraw-plugin")) {
    return;
  }
  //@ts-ignore
  if (ctx.remainingNestLevel < 4) {
    return;
  }
  if (!el.querySelector(".frontmatter")) {
    el.style.display = "none";
    return;
  }
  const attr: imgElementAttributes = {
    fname: ctx.sourcePath,
    fheight: "",
    fwidth: getDefaultWidth(plugin),
    style: "excalidraw-svg",
  };

  attr.file = metadataCache.getFirstLinkpathDest(ctx.sourcePath, "");

  el.empty();

  if (!plugin.settings.experimentalLivePreview) {
    el.appendChild(await createImageDiv(attr));
    return;
  }

  const div = createDiv();
  el.appendChild(div);

  //The timeout gives time for obsidian to attach el to the displayed document
  //Once the element is attached, I can traverse up the dom tree to find .internal-embed
  //If internal embed is not found, it means the that the excalidraw.md file
  //is being rendered in "reading" mode. In that case, the image with the default width
  //specified in setting should be displayed
  //if .internal-embed is found, then contents is replaced with the image using the
  //alt, width, and height attributes of .internal-embed to size and style the image
  setTimeout(async () => {
    let internalEmbedDiv: HTMLElement = div;
    while (
      !internalEmbedDiv.hasClass("internal-embed") &&
      internalEmbedDiv.parentElement
    ) {
      internalEmbedDiv = internalEmbedDiv.parentElement;
    }

    if (!internalEmbedDiv.hasClass("internal-embed")) {
      el.empty();
      el.appendChild(await createImageDiv(attr));
      return;
    }

    internalEmbedDiv.empty();

    const basename = splitFolderAndFilename(attr.fname).basename;
    const setAttr = () => {
      const hasWidth = internalEmbedDiv.getAttribute("width") && (internalEmbedDiv.getAttribute("width") !== "");
      const hasHeight = internalEmbedDiv.getAttribute("height") && (internalEmbedDiv.getAttribute("height") !== "");
      if (hasWidth) {
        attr.fwidth = internalEmbedDiv.getAttribute("width");
      }
      if (hasHeight) {
        attr.fheight = internalEmbedDiv.getAttribute("height");
      }
      const alt = internalEmbedDiv.getAttribute("alt");
      const hasAttr =
        alt &&
        alt !== "" &&
        alt !== basename &&
        alt !== internalEmbedDiv.getAttribute("src");
      if (hasAttr) {
        //1:width, 2:height, 3:style  1      2      3
        const parts = alt.match(/(\d*%?)x?(\d*%?)\|?(.*)/);
        attr.fwidth = parts[1] ? parts[1] : getDefaultWidth(plugin);
        attr.fheight = parts[2];
        if (parts[3] != attr.fname) {
          attr.style = `excalidraw-svg${parts[3] ? `-${parts[3]}` : ""}`;
        }
      }
      if (!hasWidth && !hasHeight && !hasAttr) {
        attr.fheight = "";
        attr.fwidth = getDefaultWidth(plugin);
        attr.style = "excalidraw-svg";
      }
    };

    const createImgElement = async () => {
      setAttr();
      const imgDiv = await createImageDiv(attr);
      internalEmbedDiv.appendChild(imgDiv);
    };
    await createImgElement();

    //timer to avoid the image flickering when the user is typing
    let timer: NodeJS.Timeout = null;
    const observer = new MutationObserver((m) => {
      if (!["alt", "width", "height"].contains(m[0]?.attributeName)) {
        return;
      }
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = null;
        setAttr();
        internalEmbedDiv.empty();
        createImgElement();
      }, 500);
    });
    observer.observe(internalEmbedDiv, {
      attributes: true, //configure it to listen to attribute changes
    });
  }, 300);
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
  //check to see if we are rendering in editing mode of live preview
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
  if (ctx.frontmatter?.hasOwnProperty("excalidraw-plugin")) {
    el.style.display = "none";
    return;
  }

  await processInternalEmbeds(embeddedItems, ctx);
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
