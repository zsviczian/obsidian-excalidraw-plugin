import { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";
import { BinaryFileData, DataURL } from "@zsviczian/excalidraw/types/excalidraw/types";
import ExcalidrawPlugin from "src/core/main";
import {
  ExcalidrawElement,
  ExcalidrawImageElement,
  FileId,
  FixedPoint,
} from "@zsviczian/excalidraw/types/element/src/types";
import { normalizePath, TFile } from "obsidian";

import ExcalidrawView, { getTextMode } from "src/view/ExcalidrawView";
import {
  GITHUB_RELEASES,
  getCommonBoundingBox,
  restoreElements,
  REG_LINKINDEX_INVALIDCHARS,
  THEME_FILTER,
  EXCALIDRAW_PLUGIN,
  getFontFamilyString,
  getLineHeight,
  measureText,
} from "src/constants/constants";
import {
  //debug,
  errorlog,
  getEmbeddedFilenameParts,
  getLinkParts,
  getPNG,
  getSVG,
  isVersionNewerThanOther,
  scaleLoadedImage,
} from "src/utils/utils";
import { GenericInputPrompt, LaTexPrompt, NewFileActions } from "src/shared/Dialogs/Prompt";
import { t } from "src/lang/helpers";
import { Mutable } from "@zsviczian/excalidraw/types/common/src/utility-types";
import {
  postOpenAI as _postOpenAI,
  extractCodeBlocks as _extractCodeBlocks,
} from "../utils/AIUtils";
import { EmbeddedFilesLoader } from "src/shared/EmbeddedFileLoader";
import { ScriptSettingValue, SVGColorInfo } from "src/types/excalidrawAutomateTypes";
import { ExcalidrawData, getExcalidrawMarkdownHeaderSection, REG_LINKINDEX_HYPERLINK, REGEX_LINK } from "src/shared/ExcalidrawData";
import { getFrameBasedOnFrameNameOrId, sceneRemoveInternalLinks } from "./excalidrawViewUtils";
import { ScriptEngine } from "src/shared/Scripts";
import { getEA } from "src/core";
import { ColorMap, FileData } from "src/types/embeddedFileLoaderTypes";
import { ExportSettings } from "src/types/exportUtilTypes";

declare const PLUGIN_VERSION:string;

export function isSVGColorInfo(obj: ColorMap | SVGColorInfo): boolean {
  return (
    typeof obj === 'object' && 
    obj !== null &&
    'stroke' in obj &&
    'fill' in obj &&
    'mappedTo' in obj
  );
}

export function mergeColorMapIntoSVGColorInfo(
  colorMap: ColorMap,
  svgColorInfo: SVGColorInfo
): SVGColorInfo {
  if(colorMap) {
    for(const key of Object.keys(colorMap)) {
      if(svgColorInfo.has(key)) {
        svgColorInfo.get(key).mappedTo = colorMap[key];
      }
    }
  }
  return svgColorInfo;
}
export function svgColorInfoToColorMap(svgColorInfo: SVGColorInfo): ColorMap {
  const colorMap: ColorMap = {};
  svgColorInfo.forEach((info, color) => {
    if (info.fill || info.stroke) {
      colorMap[color] = info.mappedTo;
    }
  });
  return colorMap;
}

//Remove identical key-value pairs from a ColorMap
export function filterColorMap(colorMap: ColorMap): ColorMap {
  return Object.fromEntries(
    Object.entries(colorMap).filter(([key, value]) => key.toLocaleLowerCase() !== value?.toLocaleLowerCase())
  );
}

export function updateOrAddSVGColorInfo(
  svgColorInfo: SVGColorInfo,
  color: string,
  info: {fill?: boolean, stroke?: boolean, mappedTo?: string}
): SVGColorInfo {
  const {fill, stroke, mappedTo} = info;
  color = color.toLocaleLowerCase();
  const colorData = svgColorInfo.get(color) || {mappedTo: color, fill: false, stroke: false};
  if(fill !== undefined) {
    colorData.fill = fill;
  }
  if(stroke !== undefined) {
    colorData.stroke = stroke;
  }
  if(mappedTo !== undefined) {
    colorData.mappedTo = mappedTo;
  }
  return svgColorInfo.set(color, colorData);
}

export function getEmbeddedFileForImageElment(ea: ExcalidrawAutomate, el: ExcalidrawElement) {
  if (!ea.targetView || !ea.targetView?._loaded) {
    errorMessage("targetView not set", "getViewFileForImageElement()");
    return null;
  }

  if (!el || el.type !== "image") {
    errorMessage(
      "Must provide an image element as input",
      "getViewFileForImageElement()",
    );
    return null;
  }
  return ea.targetView?.excalidrawData?.getFile(el.fileId);
}

export function errorMessage(message: string, source: string):void {
  switch (message) {
    case "targetView not set":
      errorlog({
        where: "ExcalidrawAutomate",
        source,
        message:
          "targetView not set, or no longer active. Use setView before calling this function",
      });
      break;
    case "mobile not supported":
      errorlog({
        where: "ExcalidrawAutomate",
        source,
        message: "this function is not available on Obsidian Mobile",
      });
      break;
    default:
      errorlog({
        where: "ExcalidrawAutomate",
        source,
        message: message??"unknown error",
      });
  }
}

export function isColorStringTransparent(color: string): boolean {
  const rgbaHslaTransparentRegex = /^(rgba|hsla)\(.*?,.*?,.*?,\s*0(\.0+)?\)$/i;
  const hexTransparentRegex = /^#[a-fA-F0-9]{6}00$/i;

  return rgbaHslaTransparentRegex.test(color) || hexTransparentRegex.test(color);
}

export function initExcalidrawAutomate(
  plugin: ExcalidrawPlugin,
): ExcalidrawAutomate {
  const ea = new ExcalidrawAutomate(plugin);
  //@ts-ignore
  window.ExcalidrawAutomate = ea;
  return ea;
}

export function normalizeLinePoints(
  points: [x: number, y: number][],
  //box: { x: number; y: number; w: number; h: number },
): number[][] {
  const p = [];
  const [x, y] = points[0];
  for (let i = 0; i < points.length; i++) {
    p.push([points[i][0] - x, points[i][1] - y]);
  }
  return p;
}

export function getLineBox(
  points: [x: number, y: number][]
):{x:number, y:number, w: number, h:number} {
  const [x1, y1, x2, y2] = estimateLineBound(points);
  return {
    x: x1,
    y: y1,
    w: x2 - x1, //Math.abs(points[points.length-1][0]-points[0][0]),
    h: y2 - y1, //Math.abs(points[points.length-1][1]-points[0][1])
  };
}

export function _measureText(
  newText: string,
  fontSize: number,
  fontFamily: number,
  lineHeight: number,
): {w: number, h:number} {
  //following odd error with mindmap on iPad while synchornizing with desktop.
  if (!fontSize) {
    fontSize = 20;
  }
  if (!fontFamily) {
    fontFamily = 1;
    lineHeight = getLineHeight(fontFamily);
  }
  const metrics = measureText(
    newText,
    `${fontSize.toString()}px ${getFontFamilyString({fontFamily})}` as any,
    lineHeight
  );
  return { w: metrics.width, h: metrics.height };
}

export async function getTemplate(
  plugin: ExcalidrawPlugin,
  fileWithPath: string,
  loadFiles: boolean = false,
  loader: EmbeddedFilesLoader,
  depth: number,
  convertMarkdownLinksToObsidianURLs: boolean = false,
): Promise<{
  elements: any;
  appState: any;
  frontmatter: string;
  files: any;
  hasSVGwithBitmap: boolean;
  plaintext: string; //markdown data above Excalidraw data and below YAML frontmatter
}> {
  const app = plugin.app;
  const vault = app.vault;
  const filenameParts = getEmbeddedFilenameParts(fileWithPath);
  const templatePath = normalizePath(filenameParts.filepath);
  const file = app.metadataCache.getFirstLinkpathDest(templatePath, "");
  let hasSVGwithBitmap = false;
  if (file && file instanceof TFile) {
    const data = (await vault.read(file))
      .replaceAll("\r\n", "\n")
      .replaceAll("\r", "\n");
    const excalidrawData: ExcalidrawData = new ExcalidrawData(plugin);

    if (file.extension === "excalidraw") {
      await excalidrawData.loadLegacyData(data, file);
      return {
        elements: convertMarkdownLinksToObsidianURLs
          ? updateElementLinksToObsidianLinks({
            elements: excalidrawData.scene.elements,
            hostFile: file,
          }) : excalidrawData.scene.elements,
        appState: excalidrawData.scene.appState,
        frontmatter: "",
        files: excalidrawData.scene.files,
        hasSVGwithBitmap,
        plaintext: "",
      };
    }

    const textMode = getTextMode(data);
    await excalidrawData.loadData(
      data,
      file,
      textMode,
    );

    let trimLocation = data.search(/^##? Text Elements$/m);
    if (trimLocation == -1) {
      trimLocation = data.search(/##? Drawing\n/);
    }

    let scene = excalidrawData.scene;

    let groupElements:ExcalidrawElement[] = scene.elements;
    if(filenameParts.hasGroupref) {
      const el = filenameParts.hasSectionref
      ? getTextElementsMatchingQuery(scene.elements,["# "+filenameParts.sectionref],true)
      : scene.elements.filter((el: ExcalidrawElement)=>el.id===filenameParts.blockref);
      if(el.length > 0) {
        groupElements = plugin.ea.getElementsInTheSameGroupWithElement(el[0],scene.elements,true)
      }
    }
    if(filenameParts.hasFrameref || filenameParts.hasClippedFrameref) {
      const el = getFrameBasedOnFrameNameOrId(filenameParts.blockref,scene.elements);
      if(el) {
        groupElements = el.frameRole === "marker"
        ? plugin.ea.getElementsInArea(scene.elements, el).concat(el)
        : plugin.ea.getElementsInFrame(el,scene.elements, filenameParts.hasClippedFrameref);
      }
    }
    if(filenameParts.hasArearef) {
      const el=scene.elements.find((el: ExcalidrawElement)=>el.id===filenameParts.blockref);
      if(el) {
        groupElements = plugin.ea.getElementsInArea(scene.elements, el);
      }
    }

    if(filenameParts.hasTaskbone) {
      groupElements = groupElements.filter( el => 
        el.type==="freedraw" || 
        ( el.type==="image" &&
          !plugin.isExcalidrawFile(excalidrawData.getFile(el.fileId)?.file)
        ));
    }

    let fileIDWhiteList:Set<FileId>;

    if(groupElements.length < scene.elements.length) {
      fileIDWhiteList = new Set<FileId>();
      groupElements.filter(el=>el.type==="image").forEach((el:ExcalidrawImageElement)=>fileIDWhiteList.add(el.fileId));
    }

    if (loadFiles) {
      //debug({where:"getTemplate",template:file.name,loader:loader.uid});
      await loader.loadSceneFiles({
        excalidrawData, 
        addFiles: (fileArray: FileData[]) => {
          //, isDark: boolean) => {
          if (!fileArray || fileArray.length === 0) {
            return;
          }
          for (const f of fileArray) {
            if (f.hasSVGwithBitmap) {
              hasSVGwithBitmap = true;
            }
            excalidrawData.scene.files[f.id] = {
              mimeType: f.mimeType,
              id: f.id,
              dataURL: f.dataURL,
              created: f.created,
            };
          }
          scene = scaleLoadedImage(excalidrawData.scene, fileArray).scene;
        },
        depth,
        fileIDWhiteList
      });
    }

    excalidrawData.destroy();
    const filehead = getExcalidrawMarkdownHeaderSection(data); // data.substring(0, trimLocation);
    let files:any = {};
    const sceneFilesSize = Object.values(scene.files).length;
    if (sceneFilesSize > 0) {
      if(fileIDWhiteList && (sceneFilesSize > fileIDWhiteList.size)) {
          Object.values(scene.files).filter((f: any) => fileIDWhiteList.has(f.id)).forEach((f: any) => {
            files[f.id] = f;
          });
      } else {
        files = scene.files;
      }
    }

    const frontmatter = filehead.match(/^---\n.*\n---\n/ms)?.[0] ?? filehead;
    return {
      elements: convertMarkdownLinksToObsidianURLs
        ? updateElementLinksToObsidianLinks({
          elements: groupElements,
          hostFile: file,
        }) : groupElements,
      appState: scene.appState,
      frontmatter,
      plaintext: frontmatter !== filehead
        ? (filehead.split(/^---\n.*\n---\n/ms)?.[1] ?? "")
        : "",
      files,
      hasSVGwithBitmap,
    };
  }
  return {
    elements: [],
    appState: {},
    frontmatter: null,
    files: [],
    hasSVGwithBitmap,
    plaintext: "",
  };
}

export const generatePlaceholderDataURL = (width: number, height: number): DataURL => {
  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#E7E7E7" /><text x="${width / 2}" y="${height / 2}" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="${Math.min(width, height) / 5}" fill="#888">Placeholder</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svgString)}` as DataURL;
};

export async function createPNG(
  templatePath: string = undefined,
  scale: number = 1,
  exportSettings: ExportSettings,
  loader: EmbeddedFilesLoader,
  forceTheme: string = undefined,
  canvasTheme: string = undefined,
  canvasBackgroundColor: string = undefined,
  automateElements: ExcalidrawElement[] = [],
  plugin: ExcalidrawPlugin,
  depth: number,
  padding?: number,
  imagesDict?: any,
  overrideFiles?: Record<ExcalidrawElement["id"], BinaryFileData>,
): Promise<Blob> {
  if (!loader) {
    loader = new EmbeddedFilesLoader(plugin);
  }
  padding = padding ?? plugin.settings.exportPaddingSVG;
  const template = templatePath
    ? await getTemplate(plugin, templatePath, true, loader, depth)
    : null;
  let elements = template?.elements ?? [];
  elements = elements.concat(automateElements);
  const files = imagesDict ?? {};
  if(template?.files) {
    Object.values(template.files).forEach((f:any)=>{
      if(!f.dataURL.startsWith("http")) {
        files[f.id]=f;
      };
    });
  }
  
  return await getPNG(
    {
      type: "excalidraw",
      version: 2,
      source: GITHUB_RELEASES+PLUGIN_VERSION,
      elements,
      appState: {
        theme: forceTheme ?? template?.appState?.theme ?? canvasTheme,
        viewBackgroundColor:
          template?.appState?.viewBackgroundColor ?? canvasBackgroundColor,
        ...template?.appState?.frameRendering ? {frameRendering: template.appState.frameRendering} : {},
      },
      files,
    },
    {
      withBackground:
        exportSettings?.withBackground ?? plugin.settings.exportWithBackground,
      withTheme: exportSettings?.withTheme ?? plugin.settings.exportWithTheme,
      isMask: exportSettings?.isMask ?? false,
    },
    padding,
    scale,
    overrideFiles,
  );
}

export const updateElementLinksToObsidianLinks = ({elements, hostFile}:{
  elements: ExcalidrawElement[];
  hostFile: TFile;
}): ExcalidrawElement[] => {
  return elements.map((el)=>{
    if(el.link && el.link.startsWith("[")) {
      const partsArray = REGEX_LINK.getResList(el.link)[0];
      if(!partsArray?.value) return el;
      let linkText = REGEX_LINK.getLink(partsArray);
      if (linkText.match(REG_LINKINDEX_HYPERLINK)) {
        if(linkText.startsWith("obsidian://") || linkText.startsWith("cmd://")) return el;
        const newElement: Mutable<ExcalidrawElement> = cloneElement(el);
        newElement.link = linkText;
        return newElement;
      }
      if (linkText.search("#") > -1) {
        const linkParts = getLinkParts(linkText, hostFile);
        linkText = linkParts.path;
      }
      if (linkText.match(REG_LINKINDEX_INVALIDCHARS)) {
        return el;
      }
      const file = EXCALIDRAW_PLUGIN.app.metadataCache.getFirstLinkpathDest(
        linkText,
        hostFile.path,
      );
      if(!file) {
        return el;
      }
      let link = EXCALIDRAW_PLUGIN.app.getObsidianUrl(file);
      if(window.ExcalidrawAutomate?.onUpdateElementLinkForExportHook) {
        try {
          link = window.ExcalidrawAutomate.onUpdateElementLinkForExportHook({
            originalLink: el.link,
            obsidianLink: link,
            linkedFile: file,
            hostFile: hostFile
          }) ?? link;
        } catch (e) {
          errorlog({where: "excalidrawAutomateUtils.updateElementLinksToObsidianLinks", fn: window.ExcalidrawAutomate.onUpdateElementLinkForExportHook, error: e});
        }
      }
      const newElement: Mutable<ExcalidrawElement> = cloneElement(el);
      newElement.link = link;
      return newElement;
    }
    return el;
  })
}

function addFilterToForeignObjects(svg:SVGSVGElement):void {
  const foreignObjects = svg.querySelectorAll("foreignObject");
  foreignObjects.forEach((foreignObject) => {
    foreignObject.setAttribute("filter", THEME_FILTER);
  });
}

export async function createSVG(
  templatePath: string = undefined,
  embedFont: boolean = false,
  exportSettings: ExportSettings,
  loader: EmbeddedFilesLoader,
  forceTheme: string = undefined,
  canvasTheme: string = undefined,
  canvasBackgroundColor: string = undefined,
  automateElements: ExcalidrawElement[] = [],
  plugin: ExcalidrawPlugin,
  depth: number,
  padding?: number,
  imagesDict?: any,
  convertMarkdownLinksToObsidianURLs: boolean = false,
  includeInternalLinks: boolean = true,
  overrideFiles?: Record<ExcalidrawElement["id"], BinaryFileData>,
): Promise<SVGSVGElement> {
  if (!loader) {
    loader = new EmbeddedFilesLoader(plugin);
  }
  if(typeof exportSettings.skipInliningFonts === "undefined") {
    exportSettings.skipInliningFonts = !embedFont;
  }
  const template = templatePath
    ? await getTemplate(plugin, templatePath, true, loader, depth, convertMarkdownLinksToObsidianURLs)
    : null;
  let elements = template?.elements ?? [];
  elements = elements.concat(automateElements);
  padding = padding ?? plugin.settings.exportPaddingSVG;
  const files = imagesDict ?? {};
  if(template?.files) {
    Object.values(template.files).forEach((f:any)=>{
      files[f.id]=f;
    });
  }

  const theme = forceTheme ?? template?.appState?.theme ?? canvasTheme;
  const withTheme = exportSettings?.withTheme ?? plugin.settings.exportWithTheme;

  const filenameParts = getEmbeddedFilenameParts(templatePath);
  const svg = await getSVG(
    {
      //createAndOpenDrawing
      type: "excalidraw",
      version: 2,
      source: GITHUB_RELEASES+PLUGIN_VERSION,
      elements: includeInternalLinks ? elements : sceneRemoveInternalLinks({elements}),
      appState: {
        theme,
        viewBackgroundColor:
          template?.appState?.viewBackgroundColor ?? canvasBackgroundColor,
        ...template?.appState?.frameRendering ? {frameRendering: template.appState.frameRendering} : {},
      },
      files,
    },
    {
      withBackground:
        exportSettings?.withBackground ?? plugin.settings.exportWithBackground,
      withTheme,
      isMask: exportSettings?.isMask ?? false,
      ...filenameParts?.hasClippedFrameref
      ? {frameRendering: {enabled: true, name: false, outline: false, clip: true}}
      : {},
    },
    padding,
    null,
    overrideFiles,
  );

  if (withTheme && theme === "dark") addFilterToForeignObjects(svg);

  if(
    !(filenameParts.hasGroupref || filenameParts.hasClippedFrameref) && 
    (filenameParts.hasBlockref || filenameParts.hasSectionref)
  ) {
    let el = filenameParts.hasSectionref
      ? getTextElementsMatchingQuery(elements,["# "+filenameParts.sectionref],true)
      : elements.filter((el: ExcalidrawElement)=>el.id===filenameParts.blockref);
    if(el.length === 0 && filenameParts.hasFrameref) {
      const frame = getFrameBasedOnFrameNameOrId(filenameParts.blockref, elements);
      if(frame) {
        el = [frame];
      }
    }
    const isNonMarkerFrameRef = filenameParts.hasFrameref && el.length === 1 && el[0].type === "frame" && el[0].frameRole !== "marker";

    if(el.length>0 && !isNonMarkerFrameRef) {
      const containerId = el[0].containerId;
      if(containerId) {
        el = el.concat(elements.filter((el: ExcalidrawElement)=>el.id === containerId));
      }
      const elBB = plugin.ea.getBoundingBox(el);
      const drawingBB = plugin.ea.getBoundingBox(elements);
      svg.viewBox.baseVal.x = elBB.topX - drawingBB.topX;
      svg.viewBox.baseVal.y = elBB.topY - drawingBB.topY;
      const width = elBB.width + 2*padding;
      svg.viewBox.baseVal.width = width;
      const height = elBB.height + 2*padding;
      svg.viewBox.baseVal.height = height;
      svg.setAttribute("width", `${width}`);
      svg.setAttribute("height", `${height}`);
    }
  }
  if (template?.hasSVGwithBitmap) {
    svg.setAttribute("hasbitmap", "true");
  }
  return svg;
}

function estimateLineBound(points: any): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return [minX, minY, maxX, maxY];
}

export function estimateBounds(
  elements: ExcalidrawElement[],
): [number, number, number, number] {
  const bb = getCommonBoundingBox(elements);
  return [bb.minX, bb.minY, bb.maxX, bb.maxY];
}

export function repositionElementsToCursor(
  elements: ExcalidrawElement[],
  newPosition: { x: number; y: number },
  center: boolean = false,
): ExcalidrawElement[] {
  const [x1, y1, x2, y2] = estimateBounds(elements);
  let [offsetX, offsetY] = [0, 0];
  if (center) {
    [offsetX, offsetY] = [
      newPosition.x - (x1 + x2) / 2,
      newPosition.y - (y1 + y2) / 2,
    ];
  } else {
    [offsetX, offsetY] = [newPosition.x - x1, newPosition.y - y1];
  }

  elements.forEach((element: any) => {
    //using any so I can write read-only propery x & y
    element.x = element.x + offsetX;
    element.y = element.y + offsetY;
  });
  
  return restoreElements(elements, null, {refreshDimensions: true, repairBindings: true});
}

export const insertLaTeXToView = (view: ExcalidrawView, center: boolean = false) => {
  const app = view.plugin.app;
  const ea = getEA(view) as ExcalidrawAutomate;
  const isLatexSuitAvailable = !!app.plugins.plugins["obsidian-latex-suite"];
  (isLatexSuitAvailable
    ? LaTexPrompt.Prompt(app, t("ENTER_LATEX"), view.plugin.settings.latexBoilerplate)
    : GenericInputPrompt.Prompt(
        view,
        view.plugin,
        app,
        t("ENTER_LATEX"),
        "\\color{red}\\oint_S {E_n dA = \\frac{1}{{\\varepsilon _0 }}} Q_{inside}",
        view.plugin.settings.latexBoilerplate,
        undefined,
        3
      )
  ).then(async (formula: string) => {
    const lastLatexEl = ea.getViewElements()
        .filter((el) => el.type === "image" && view.excalidrawData.hasEquation(el.fileId))
        .reduce(
          (maxel, curr) => (!maxel || curr.updated > maxel.updated) ? curr : maxel,
          undefined 
        ) as ExcalidrawImageElement;
    let scaleX = 1;
    let scaleY = 1;
    if (lastLatexEl) {
      const equation = view.excalidrawData.getEquation(lastLatexEl.fileId);
      const dataurl = await ea.tex2dataURL(equation.latex);
      if (dataurl.size.width > 0 && dataurl.size.height > 0) {
        scaleX = lastLatexEl.width/dataurl.size.width;
        scaleY = lastLatexEl.height/dataurl.size.height;
      }
    }
    if (formula) {
      const id = await ea.addLaTex(0, 0, formula, scaleX, scaleY);
      if(center) {
        const el = ea.getElement(id);
        let {width, height} = el;
        let {x, y} = ea.getViewCenterPosition();
        el.x = x - width / 2;
        el.y = y - height / 2;
      }
      await ea.addElementsToView(!center, false, true);
      ea.selectElementsInView([id]);
    }
    ea.destroy();
  }, () => {});
};

export const search = async (view: ExcalidrawView) => {
  const ea = view.plugin.ea;
  ea.reset();
  ea.setView(view);
  const elements = ea.getViewElements().filter((el) => el.type === "text" || el.type === "frame" || el.link || el.type === "image");
  if (elements.length === 0) {
    return;
  }
  let text = await ScriptEngine.inputPrompt(
    view,
    view.plugin,
    view.plugin.app,
    "Search for",
    "use quotation marks for exact match",
    "",
  );
  if (!text) {
    return;
  }
  const res = text.matchAll(/"(.*?)"/g);
  let query: string[] = [];
  let parts;
  while (!(parts = res.next()).done) {
    query.push(parts.value[1]);
  }
  text = text.replaceAll(/"(.*?)"/g, "");
  query = query.concat(text.split(" ").filter((s:string) => s.length !== 0));

  ea.targetView.selectElementsMatchingQuery(elements, query);
};

/**
 * 
 * @param elements 
 * @param query 
 * @param exactMatch - when searching for section header exactMatch should be set to true
 * @returns the elements matching the query
 */
export const getTextElementsMatchingQuery = (
  elements: ExcalidrawElement[],
  query: string[],
  exactMatch: boolean = false, //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/530
): ExcalidrawElement[] => {
  if (!elements || elements.length === 0 || !query || query.length === 0) {
    return [];
  }

  return elements.filter((el: any) =>
    el.type === "text" && 
    query.some((q) => {
      if (exactMatch) {
        const text = el.customData?.text2Path?.text ?? el.rawText.toLowerCase().split("\n")[0].trim();
        const m = text.match(/^#*(# .*)/);
        if (!m || m.length !== 2) {
          return false;
        }
        return m[1] === q.toLowerCase();
      }
      const text = el.customData?.text2Path?.text ?? el.rawText.toLowerCase().replaceAll("\n", " ").trim();
      return text.match(q.toLowerCase()); //to distinguish between "# frame" and "# frame 1" https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/530
    }));
}

/**
 * 
 * @param elements 
 * @param query 
 * @param exactMatch - when searching for section header exactMatch should be set to true
 * @returns the elements matching the query
 */
export const getFrameElementsMatchingQuery = (
  elements: ExcalidrawElement[],
  query: string[],
  exactMatch: boolean = false, //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/530
): ExcalidrawElement[] => {
  if (!elements || elements.length === 0 || !query || query.length === 0) {
    return [];
  }

  return elements.filter((el: any) =>
    el.type === "frame" && 
    query.some((q) => {
      if (exactMatch) {
        const text = el.name?.toLowerCase().split("\n")[0].trim() ?? "";
        const m = text.match(/^#*(# .*)/);
        if (!m || m.length !== 2) {
          return false;
        }
        return m[1] === q.toLowerCase();
      }
      const text = el.name
       ? el.name.toLowerCase().replaceAll("\n", " ").trim()
       : "";

      return text.match(q.toLowerCase()); //to distinguish between "# frame" and "# frame 1" https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/530
    }));
}

/**
 * 
 * @param elements 
 * @param query 
 * @param exactMatch - when searching for section header exactMatch should be set to true
 * @returns the elements matching the query
 */
export const getElementsWithLinkMatchingQuery = (
  elements: ExcalidrawElement[],
  query: string[],
  exactMatch: boolean = false, //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/530
): ExcalidrawElement[] => {
  if (!elements || elements.length === 0 || !query || query.length === 0) {
    return [];
  }

  return elements.filter((el: any) =>
    el.link && 
    query.some((q) => {
      const text = el.link.toLowerCase().trim();
      return exactMatch
        ? (text === q.toLowerCase())
        : text.match(q.toLowerCase());
    }));
}

/**
 * 
 * @param elements 
 * @param query 
 * @param exactMatch - when searching for section header exactMatch should be set to true
 * @returns the elements matching the query
 */
export const getImagesMatchingQuery = (
  elements: ExcalidrawElement[],
  query: string[],
  excalidrawData: ExcalidrawData,
  exactMatch: boolean = false, //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/530
): ExcalidrawElement[] => {
  if (!elements || elements.length === 0 || !query || query.length === 0) {
    return [];
  }

  return elements.filter((el: ExcalidrawElement) => 
    el.type === "image" &&
    query.some((q) => {
      const filename = excalidrawData.getFile(el.fileId)?.file?.basename.toLowerCase().trim();
      const equation = excalidrawData.getEquation(el.fileId)?.latex?.toLocaleLowerCase().trim();
      const text = filename ?? equation;
      if(!text) return false;
      return exactMatch
        ? (text === q.toLowerCase())
        : text.match(q.toLowerCase());
    }));
  }

export const cloneElement = (el: ExcalidrawElement):any => {
  const newEl = JSON.parse(JSON.stringify(el));
  newEl.version = el.version + 1;
  newEl.updated = Date.now();
  newEl.versionNonce = Math.floor(Math.random() * 1000000000);
  return newEl;
}

export const verifyMinimumPluginVersion = (requiredVersion: string): boolean => {
  return PLUGIN_VERSION.split("-")[0] === requiredVersion || isVersionNewerThanOther(PLUGIN_VERSION.split("-")[0],requiredVersion);
}

export const getBoundTextElementId = (container: ExcalidrawElement | null) => {
  return container?.boundElements?.length
    ? container?.boundElements?.find((ele) => ele.type === "text")?.id || null
    : null;
};

/**
 * 
 * FixedPoint represents the fixed point binding information in form of a vertical and
 * horizontal ratio (i.e. a percentage value in the 0.0-1.0 range). This ratio
 * gives the user selected fixed point by multiplying the bound element width
 * with fixedPoint[0] and the bound element height with fixedPoint[1] to get the
 * bound element-local point coordinate.
 */
export const normalizeFixedPoint = <T extends FixedPoint | null | undefined>(
  fixedPoint: T,
): T extends null ? null : FixedPoint => {
  if (!fixedPoint) {
    return [0.50001, 0.5001] as any as T extends null ? null : FixedPoint;
  }
  if (fixedPoint[0] < 0 || fixedPoint[0] > 1) {
    fixedPoint[0] = 0.5001;
  }
  if (fixedPoint[1] < 0 || fixedPoint[1] > 1) {
    fixedPoint[1] = 0.5001;
  }
  // Do not allow a precise 0.5 for fixed point ratio
  // to avoid jumping arrow heading due to floating point imprecision
  if (
    fixedPoint &&
    (Math.abs(fixedPoint[0] - 0.5) < 0.0001 ||
      Math.abs(fixedPoint[1] - 0.5) < 0.0001)
  ) {
    return fixedPoint.map((ratio) =>
      Math.abs(ratio - 0.5) < 0.0001 ? 0.5001 : ratio,
    ) as T extends null ? null : FixedPoint;
  }
  return fixedPoint as any as T extends null ? null : FixedPoint;
};

export const normalizeBindMode = (bindMode?: string): "orbit" | "inside" => {
  if (!bindMode || (bindMode !== "orbit" && bindMode !== "inside")) {
    return "orbit";
  }
  return bindMode;
};

/**
 * Ensures that plugin.settings.scriptEngineSettings and the active script's settings object exist.
 * Handles undefined/null during initialization.
 *
 * Note: kept in utils (not as an EA private method) so it won't be exposed on window.ExcalidrawAutomate.
 */
export function ensureActiveScriptSettingsObject(
  ea: ExcalidrawAutomate
): Record<string, ScriptSettingValue> | null {
  const activeScript = ea?.activeScript;
  const plugin = ea?.plugin;

  if (!activeScript || !plugin?.settings) {
    return null;
  }

  // Ensure the top-level container exists
  if (!plugin.settings.scriptEngineSettings || typeof plugin.settings.scriptEngineSettings !== "object") {
    plugin.settings.scriptEngineSettings = {};
  }

  // Ensure the per-script settings object exists (handle null/undefined)
  const current = plugin.settings.scriptEngineSettings[activeScript];
  if (!current || typeof current !== "object") {
    plugin.settings.scriptEngineSettings[activeScript] = {};
  }

  return plugin.settings.scriptEngineSettings[activeScript] as Record<string, ScriptSettingValue>;
}

export function getLastActiveExcalidrawView(plugin: ExcalidrawPlugin): ExcalidrawView | null {
  const leaf = plugin.app.workspace.getLeafById(plugin.lastActiveExcalidrawLeafID);
  if(leaf && leaf.view instanceof ExcalidrawView) {
    return leaf.view as ExcalidrawView;
  }
  return null;
}