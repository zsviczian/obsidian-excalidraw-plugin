import ExcalidrawPlugin from "./main";
import {
  FillStyle,
  StrokeStyle,
  StrokeSharpness,
  ExcalidrawElement,
  ExcalidrawBindableElement,
  FileId,
  NonDeletedExcalidrawElement,
} from "@zsviczian/excalidraw/types/element/types";
import { normalizePath, TFile, WorkspaceLeaf } from "obsidian";
import ExcalidrawView, { ExportSettings, TextMode } from "./ExcalidrawView";
import { ExcalidrawData } from "./ExcalidrawData";
import {
  FRONTMATTER,
  nanoid,
  VIEW_TYPE_EXCALIDRAW,
  MAX_IMAGE_SIZE,
  PLUGIN_ID,
  COLOR_NAMES,
  fileid,
} from "./Constants";
import { getDrawingFilename, } from "./utils/FileUtils";
import {
  //debug,
  embedFontsInSVG,
  errorlog,
  getPNG,
  getSVG,
  scaleLoadedImage,
  wrapText,
} from "./utils/Utils";
import { getNewOrAdjacentLeaf, isObsidianThemeDark } from "./utils/ObsidianUtils";
import { AppState, Point } from "@zsviczian/excalidraw/types/types";
import { EmbeddedFilesLoader, FileData } from "./EmbeddedFileLoader";
import { tex2dataURL } from "./LaTeX";
//import Excalidraw from "@zsviczian/excalidraw";
import { Prompt } from "./dialogs/Prompt";
import { t } from "./lang/helpers";
import { ScriptEngine } from "./Scripts";
import { ConnectionPoint, ExcalidrawAutomateInterface } from "./types";

declare const PLUGIN_VERSION:string;

const {
  determineFocusDistance,
  intersectElementWithLine,
  getCommonBoundingBox,
  getMaximumGroups,
  measureText,
  //@ts-ignore
} = excalidrawLib;

const GAP = 4;

declare global {
  interface Window {
    ExcalidrawAutomate: ExcalidrawAutomateInterface;
  }
}

export class ExcalidrawAutomate implements ExcalidrawAutomateInterface {
  plugin: ExcalidrawPlugin;
  targetView: ExcalidrawView = null; //the view currently edited
  elementsDict: {[key:string]:any}; //contains the ExcalidrawElements currently edited in Automate indexed by el.id
  imagesDict: {[key: FileId]: any}; //the images files including DataURL, indexed by fileId
  mostRecentMarkdownSVG:SVGSVGElement = null; //Markdown renderer will drop a copy of the most recent SVG here for debugging purposes
  style: {
    strokeColor: string; //https://www.w3schools.com/colors/default.asp
    backgroundColor: string;
    angle: number; //radian
    fillStyle: FillStyle; //type FillStyle = "hachure" | "cross-hatch" | "solid"
    strokeWidth: number;
    strokeStyle: StrokeStyle; //type StrokeStyle = "solid" | "dashed" | "dotted"
    roughness: number;
    opacity: number;
    strokeSharpness: StrokeSharpness; //type StrokeSharpness = "round" | "sharp"
    fontFamily: number; //1: Virgil, 2:Helvetica, 3:Cascadia, 4:LocalFont
    fontSize: number;
    textAlign: string; //"left"|"right"|"center"
    verticalAlign: string; //"top"|"bottom"|"middle" :for future use, has no effect currently
    startArrowHead: string; //"triangle"|"dot"|"arrow"|"bar"|null
    endArrowHead: string;
  };
  canvas: {
    theme: string; //"dark"|"light"
    viewBackgroundColor: string;
    gridSize: number;
  };

  constructor(plugin: ExcalidrawPlugin, view?: ExcalidrawView) {
    this.plugin = plugin;
    this.reset();
    this.targetView = view;
  }

  /**
   * 
   * @returns 
   */
  public getAPI(view?:ExcalidrawView):ExcalidrawAutomate {
    return new ExcalidrawAutomate(this.plugin, view);
  }

  /**
   * @param val //0:"hachure", 1:"cross-hatch" 2:"solid"
   * @returns 
   */
  setFillStyle(val: number) {
    switch (val) {
      case 0:
        this.style.fillStyle = "hachure";
        return "hachure";
      case 1:
        this.style.fillStyle = "cross-hatch";
        return "cross-hatch";
      default:
        this.style.fillStyle = "solid";
        return "solid";
    }
  };

  /**
   * @param val //0:"solid", 1:"dashed", 2:"dotted"
   * @returns 
   */
  setStrokeStyle(val: number) {
    switch (val) {
      case 0:
        this.style.strokeStyle = "solid";
        return "solid";
      case 1:
        this.style.strokeStyle = "dashed";
        return "dashed";
      default:
        this.style.strokeStyle = "dotted";
        return "dotted";
    }
  };

  /**
   * @param val //0:"round", 1:"sharp"
   * @returns 
   */
  setStrokeSharpness(val: number) {
    switch (val) {
      case 0:
        this.style.strokeSharpness = "round";
        return "round";
      default:
        this.style.strokeSharpness = "sharp";
        return "sharp";
    }
  };

  /**
   * @param val //1: Virgil, 2:Helvetica, 3:Cascadia
   * @returns 
   */
  setFontFamily(val: number) {
    switch (val) {
      case 1:
        this.style.fontFamily = 4;
        return getFontFamily(4);
      case 2:
        this.style.fontFamily = 2;
        return getFontFamily(2);
      case 3:
        this.style.fontFamily = 3;
        return getFontFamily(3);
      default:
        this.style.fontFamily = 1;
        return getFontFamily(1);
    }
  };

  /**
   * @param val //0:"light", 1:"dark"
   * @returns 
   */
  setTheme(val: number) {
    switch (val) {
      case 0:
        this.canvas.theme = "light";
        return "light";
      default:
        this.canvas.theme = "dark";
        return "dark";
    }
  };

  /**
   * @param objectIds 
   * @returns 
   */
  addToGroup(objectIds: string[]): string {
    const id = nanoid();
    objectIds.forEach((objectId) => {
      this.elementsDict[objectId]?.groupIds?.push(id);
    });
    return id;
  };

  /**
   * @param templatePath 
   */
  async toClipboard(templatePath?: string) {
    const template = templatePath
      ? await getTemplate(
          this.plugin,
          templatePath,
          false,
          new EmbeddedFilesLoader(this.plugin),
          0
        )
      : null;
    let elements = template ? template.elements : [];
    elements = elements.concat(this.getElements());
    navigator.clipboard.writeText(
      JSON.stringify({
        type: "excalidraw/clipboard",
        elements,
      }),
    );
  };

  /**
   * get all elements from ExcalidrawAutomate elementsDict
   * @returns elements from elemenetsDict
   */
  getElements(): ExcalidrawElement[] {
    const elements = [];
    const elementIds = Object.keys(this.elementsDict);
    for (let i = 0; i < elementIds.length; i++) {
      elements.push(this.elementsDict[elementIds[i]]);
    }
    return elements;
  };
  
  /**
   * get single element from ExcalidrawAutomate elementsDict
   * @param id 
   * @returns 
   */
  getElement(id: string): ExcalidrawElement {
    return this.elementsDict[id];
  };

  /**
   * create a drawing and save it to filename
   * @param params 
   *   filename: if null, default filename as defined in Excalidraw settings
   *   foldername: if null, default folder as defined in Excalidraw settings
   * @returns 
   */
  async create(params?: {
    filename?: string;
    foldername?: string;
    templatePath?: string;
    onNewPane?: boolean;
    frontmatterKeys?: {
      "excalidraw-plugin"?: "raw" | "parsed";
      "excalidraw-link-prefix"?: string;
      "excalidraw-link-brackets"?: boolean;
      "excalidraw-url-prefix"?: string;
      "excalidraw-export-transparent"?: boolean;
      "excalidraw-export-dark"?: boolean;
      "excalidraw-export-svgpadding"?: number;
      "excalidraw-export-pngscale"?: number;
      "excalidraw-default-mode"?: "view" | "zen";
    };
  }): Promise<string> {
    const template = params?.templatePath
      ? await getTemplate(
          this.plugin,
          params.templatePath,
          true,
          new EmbeddedFilesLoader(this.plugin),
          0
        )
      : null;
    let elements = template ? template.elements : [];
    elements = elements.concat(this.getElements());
    let frontmatter: string;
    if (params?.frontmatterKeys) {
      const keys = Object.keys(params.frontmatterKeys);
      if (!keys.includes("excalidraw-plugin")) {
        params.frontmatterKeys["excalidraw-plugin"] = "parsed";
      }
      frontmatter = "---\n\n";
      for (const key of Object.keys(params.frontmatterKeys)) {
        frontmatter += `${key}: ${
          //@ts-ignore
          params.frontmatterKeys[key] === ""
            ? '""'
            : //@ts-ignore
              params.frontmatterKeys[key]
        }\n`;
      }
      frontmatter += "\n---\n";
    } else {
      frontmatter = template?.frontmatter
        ? template.frontmatter
        : FRONTMATTER;
    }

    const scene = {
      type: "excalidraw",
      version: 2,
      source: "https://excalidraw.com",
      elements,
      appState: {
        theme: template?.appState?.theme ?? this.canvas.theme,
        viewBackgroundColor:
          template?.appState?.viewBackgroundColor ??
          this.canvas.viewBackgroundColor,
        currentItemStrokeColor:
          template?.appState?.currentItemStrokeColor ??
          this.style.strokeColor,
        currentItemBackgroundColor:
          template?.appState?.currentItemBackgroundColor ??
          this.style.backgroundColor,
        currentItemFillStyle:
          template?.appState?.currentItemFillStyle ?? this.style.fillStyle,
        currentItemStrokeWidth:
          template?.appState?.currentItemStrokeWidth ??
          this.style.strokeWidth,
        currentItemStrokeStyle:
          template?.appState?.currentItemStrokeStyle ??
          this.style.strokeStyle,
        currentItemRoughness:
          template?.appState?.currentItemRoughness ?? this.style.roughness,
        currentItemOpacity:
          template?.appState?.currentItemOpacity ?? this.style.opacity,
        currentItemFontFamily:
          template?.appState?.currentItemFontFamily ?? this.style.fontFamily,
        currentItemFontSize:
          template?.appState?.currentItemFontSize ?? this.style.fontSize,
        currentItemTextAlign:
          template?.appState?.currentItemTextAlign ?? this.style.textAlign,
        currentItemStrokeSharpness:
          template?.appState?.currentItemStrokeSharpness ??
          this.style.strokeSharpness,
        currentItemStartArrowhead:
          template?.appState?.currentItemStartArrowhead ??
          this.style.startArrowHead,
        currentItemEndArrowhead:
          template?.appState?.currentItemEndArrowhead ??
          this.style.endArrowHead,
        currentItemLinearStrokeSharpness:
          template?.appState?.currentItemLinearStrokeSharpness ??
          this.style.strokeSharpness,
        gridSize: template?.appState?.gridSize ?? this.canvas.gridSize,
      },
      files: template?.files ?? {},
    };

    return this.plugin.createAndOpenDrawing(
      params?.filename
        ? params.filename + (params.filename.endsWith(".md") ? "": ".excalidraw.md")
        : getDrawingFilename(this.plugin.settings),
      (params?.onNewPane ? params.onNewPane : false)?"new-pane":"active-pane",
      params?.foldername ? params.foldername : this.plugin.settings.folder,
      this.plugin.settings.compatibilityMode
        ? JSON.stringify(scene, null, "\t")
        : frontmatter +
            (await this.plugin.exportSceneToMD(JSON.stringify(scene, null, "\t"))),
    );
  };

  /**
   * 
   * @param templatePath 
   * @param embedFont 
   * @param exportSettings use ExcalidrawAutomate.getExportSettings(boolean,boolean)
   * @param loader use ExcalidrawAutomate.getEmbeddedFilesLoader(boolean?)
   * @param theme 
   * @returns 
   */
  async createSVG(
    templatePath?: string,
    embedFont: boolean = false,
    exportSettings?: ExportSettings, 
    loader?: EmbeddedFilesLoader,
    theme?: string,
    padding?: number,
  ): Promise<SVGSVGElement> {
    if (!theme) {
      theme = this.plugin.settings.previewMatchObsidianTheme
        ? isObsidianThemeDark()
          ? "dark"
          : "light"
        : !this.plugin.settings.exportWithTheme
        ? "light"
        : undefined;
    }
    if (theme && !exportSettings) {
      exportSettings = {
        withBackground: this.plugin.settings.exportWithBackground,
        withTheme: true,
      };
    }
    if (!loader) {
      loader = new EmbeddedFilesLoader(
        this.plugin,
        theme ? theme === "dark" : undefined,
      );
    }

    return await createSVG(
      templatePath,
      embedFont,
      exportSettings,
      loader,
      theme,
      this.canvas.theme,
      this.canvas.viewBackgroundColor,
      this.getElements(),
      this.plugin,
      0,
      padding
    );
  };

  /**
   * 
   * @param templatePath 
   * @param scale 
   * @param exportSettings use ExcalidrawAutomate.getExportSettings(boolean,boolean)
   * @param loader use ExcalidrawAutomate.getEmbeddedFilesLoader(boolean?)
   * @param theme 
   * @returns 
   */
  async createPNG(
    templatePath?: string,
    scale: number = 1,
    exportSettings?: ExportSettings,
    loader?: EmbeddedFilesLoader,
    theme?: string,
  ) {
    if (!theme) {
      theme = this.plugin.settings.previewMatchObsidianTheme
        ? isObsidianThemeDark()
          ? "dark"
          : "light"
        : !this.plugin.settings.exportWithTheme
        ? "light"
        : undefined;
    }
    if (theme && !exportSettings) {
      exportSettings = {
        withBackground: this.plugin.settings.exportWithBackground,
        withTheme: true,
      };
    }
    if (!loader) {
      loader = new EmbeddedFilesLoader(
        this.plugin,
        theme ? theme === "dark" : undefined,
      );
    }

    return await createPNG(
      templatePath,
      scale,
      exportSettings,
      loader,
      theme,
      this.canvas.theme,
      this.canvas.viewBackgroundColor,
      this.getElements(),
      this.plugin,
      0
    );
  };

  /**
   * 
   * @param text 
   * @param lineLen 
   * @returns 
   */
  wrapText(text: string, lineLen: number): string {
    return wrapText(text, lineLen, this.plugin.settings.forceWrap);
  };

  private boxedElement(
    id: string,
    eltype: any,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    return {
      id,
      type: eltype,
      x,
      y,
      width: w,
      height: h,
      angle: this.style.angle,
      strokeColor: this.style.strokeColor,
      backgroundColor: this.style.backgroundColor,
      fillStyle: this.style.fillStyle,
      strokeWidth: this.style.strokeWidth,
      strokeStyle: this.style.strokeStyle,
      roughness: this.style.roughness,
      opacity: this.style.opacity,
      strokeSharpness: this.style.strokeSharpness,
      seed: Math.floor(Math.random() * 100000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 1000000000),
      updated: Date.now(),
      isDeleted: false,
      groupIds: [] as any,
      boundElements: [] as any,
      link: null as string,
      locked: false,
    };
  }

  /**
   * 
   * @param topX 
   * @param topY 
   * @param width 
   * @param height 
   * @returns 
   */
  addRect(topX: number, topY: number, width: number, height: number): string {
    const id = nanoid();
    this.elementsDict[id] = this.boxedElement(
      id,
      "rectangle",
      topX,
      topY,
      width,
      height,
    );
    return id;
  };

  /**
   * 
   * @param topX 
   * @param topY 
   * @param width 
   * @param height 
   * @returns 
   */
  addDiamond(
    topX: number,
    topY: number,
    width: number,
    height: number,
  ): string {
    const id = nanoid();
    this.elementsDict[id] = this.boxedElement(
      id,
      "diamond",
      topX,
      topY,
      width,
      height,
    );
    return id;
  };

  /**
   * 
   * @param topX 
   * @param topY 
   * @param width 
   * @param height 
   * @returns 
   */
  addEllipse(
    topX: number,
    topY: number,
    width: number,
    height: number,
  ): string {
    const id = nanoid();
    this.elementsDict[id] = this.boxedElement(
      id,
      "ellipse",
      topX,
      topY,
      width,
      height,
    );
    return id;
  };

  /**
   * 
   * @param topX 
   * @param topY 
   * @param width 
   * @param height 
   * @returns 
   */
  addBlob(topX: number, topY: number, width: number, height: number): string {
    const b = height * 0.5; //minor axis of the ellipsis
    const a = width * 0.5; //major axis of the ellipsis
    const sx = a / 9;
    const sy = b * 0.8;
    const step = 6;
    const p: any = [];
    const pushPoint = (i: number, dir: number) => {
      const x = i + Math.random() * sx - sx / 2;
      p.push([
        x + Math.random() * sx - sx / 2 + ((i % 2) * sx) / 6 + topX,
        dir * Math.sqrt(b * b * (1 - (x * x) / (a * a))) +
          Math.random() * sy -
          sy / 2 +
          ((i % 2) * sy) / 6 +
          topY,
      ]);
    };
    let i: number;
    for (i = -a + sx / 2; i <= a - sx / 2; i += a / step) {
      pushPoint(i, 1);
    }
    for (i = a - sx / 2; i >= -a + sx / 2; i -= a / step) {
      pushPoint(i, -1);
    }
    p.push(p[0]);
    const scale = (p: [[x: number, y: number]]): [[x: number, y: number]] => {
      const box = getLineBox(p);
      const scaleX = width / box.w;
      const scaleY = height / box.h;
      let i;
      for (i = 0; i < p.length; i++) {
        let [x, y] = p[i];
        x = (x - box.x) * scaleX + box.x;
        y = (y - box.y) * scaleY + box.y;
        p[i] = [x, y];
      }
      return p;
    };
    const id = this.addLine(scale(p));
    this.elementsDict[id] = repositionElementsToCursor(
      [this.getElement(id)],
      { x: topX, y: topY },
      false,
    )[0];
    return id;
  };

  /**
   * 
   * @param topX 
   * @param topY 
   * @param text 
   * @param formatting 
   *   box: if !null, text will be boxed
   * @param id 
   * @returns 
   */
  addText(
    topX: number,
    topY: number,
    text: string,
    formatting?: {
      wrapAt?: number;
      width?: number;
      height?: number;
      textAlign?: string;
      box?: boolean | "box" | "blob" | "ellipse" | "diamond";
      boxPadding?: number;
    },
    id?: string,
  ): string {
    id = id ?? nanoid();
    const originalText = text;
    text = formatting?.wrapAt ? this.wrapText(text, formatting.wrapAt) : text;
    const { w, h, baseline } = _measureText(
      text,
      this.style.fontSize,
      this.style.fontFamily,
    );
    const width = formatting?.width ? formatting.width : w;
    const height = formatting?.height ? formatting.height : h;

    let boxId: string = null;
    const boxPadding = formatting?.boxPadding ?? 30;
    if (formatting?.box) {
      switch (formatting.box) {
        case "ellipse":
          boxId = this.addEllipse(
            topX - boxPadding,
            topY - boxPadding,
            width + 2 * boxPadding,
            height + 2 * boxPadding,
          );
          break;
        case "diamond":
          boxId = this.addDiamond(
            topX - boxPadding,
            topY - boxPadding,
            width + 2 * boxPadding,
            height + 2 * boxPadding,
          );
          break;
        case "blob":
          boxId = this.addBlob(
            topX - boxPadding,
            topY - boxPadding,
            width + 2 * boxPadding,
            height + 2 * boxPadding,
          );
          break;
        default:
          boxId = this.addRect(
            topX - boxPadding,
            topY - boxPadding,
            width + 2 * boxPadding,
            height + 2 * boxPadding,
          );
      }
    }
    const isContainerBound = boxId && formatting.box !== "blob";
    this.elementsDict[id] = {
      text,
      fontSize: this.style.fontSize,
      fontFamily: this.style.fontFamily,
      textAlign: formatting?.textAlign
        ? formatting.textAlign
        : this.style.textAlign ?? "left",
      verticalAlign: this.style.verticalAlign,
      baseline,
      ...this.boxedElement(id, "text", topX, topY, width, height),
      containerId: isContainerBound ? boxId : null,
      originalText: isContainerBound ? originalText : text,
      rawText: isContainerBound ? originalText : text,
    };
    if (boxId && formatting?.box === "blob") {
      this.addToGroup([id, boxId]);
    }
    if (isContainerBound) {
      const box = this.elementsDict[boxId];
      if (!box.boundElements) {
        box.boundElements = [];
      }
      box.boundElements.push({ type: "text", id });
    }
    return boxId ?? id;
  };

  /**
   * 
   * @param points 
   * @returns 
   */
  addLine(points: [[x: number, y: number]]): string {
    const box = getLineBox(points);
    const id = nanoid();
    this.elementsDict[id] = {
      points: normalizeLinePoints(points),
      lastCommittedPoint: null,
      startBinding: null,
      endBinding: null,
      startArrowhead: null,
      endArrowhead: null,
      ...this.boxedElement(id, "line", points[0][0], points[0][1], box.w, box.h),
    };
    return id;
  };

  /**
   * 
   * @param points 
   * @param formatting 
   * @returns 
   */
  addArrow(
    points: [x: number, y: number][],
    formatting?: {
      startArrowHead?: string;
      endArrowHead?: string;
      startObjectId?: string;
      endObjectId?: string;
    },
  ): string {
    const box = getLineBox(points);
    const id = nanoid();
    const startPoint = points[0];
    const endPoint = points[points.length - 1];
    this.elementsDict[id] = {
      points: normalizeLinePoints(points),
      lastCommittedPoint: null,
      startBinding: {
        elementId: formatting?.startObjectId,
        focus: formatting?.startObjectId
          ? determineFocusDistance(
              this.getElement(formatting?.startObjectId) as ExcalidrawBindableElement,
              endPoint,
              startPoint,
            )
          : 0.1,
        gap: GAP,
      },
      endBinding: {
        elementId: formatting?.endObjectId,
        focus: formatting?.endObjectId
          ? determineFocusDistance(
              this.getElement(formatting?.endObjectId) as ExcalidrawBindableElement,
              startPoint,
              endPoint,
            )
          : 0.1,
        gap: GAP,
      },
      //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/388
      startArrowhead:
        typeof formatting?.startArrowHead !== "undefined"
          ? formatting.startArrowHead
          : this.style.startArrowHead,
      endArrowhead:
        typeof formatting?.endArrowHead !== "undefined"
          ? formatting.endArrowHead
          : this.style.endArrowHead,
      ...this.boxedElement(id, "arrow", points[0][0], points[0][1], box.w, box.h),
    };
    if (formatting?.startObjectId) {
      if (!this.elementsDict[formatting.startObjectId].boundElements) {
        this.elementsDict[formatting.startObjectId].boundElements = [];
      }
      this.elementsDict[formatting.startObjectId].boundElements.push({
        type: "arrow",
        id,
      });
    }
    if (formatting?.endObjectId) {
      if (!this.elementsDict[formatting.endObjectId].boundElements) {
        this.elementsDict[formatting.endObjectId].boundElements = [];
      }
      this.elementsDict[formatting.endObjectId].boundElements.push({
        type: "arrow",
        id,
      });
    }
    return id;
  };

  /**
   * 
   * @param topX 
   * @param topY 
   * @param imageFile 
   * @returns 
   */
  async addImage(
    topX: number,
    topY: number,
    imageFile: TFile,
  ): Promise<string> {
    const id = nanoid();
    const loader = new EmbeddedFilesLoader(
      this.plugin,
      this.canvas.theme === "dark",
    );
    const image = await loader.getObsidianImage(imageFile,0);
    if (!image) {
      return null;
    }
    const fileId = imageFile.extension === "md" ? fileid() as FileId : image.fileId;
    this.imagesDict[fileId] = {
      mimeType: image.mimeType,
      id: fileId,
      dataURL: image.dataURL,
      created: image.created,
      file: imageFile.path,
      hasSVGwithBitmap: image.hasSVGwithBitmap,
      latex: null,
    };
    if (Math.max(image.size.width, image.size.height) > MAX_IMAGE_SIZE) {
      const scale =
        MAX_IMAGE_SIZE / Math.max(image.size.width, image.size.height);
      image.size.width = scale * image.size.width;
      image.size.height = scale * image.size.height;
    }
    this.elementsDict[id] = this.boxedElement(
      id,
      "image",
      topX,
      topY,
      image.size.width,
      image.size.height,
    );
    this.elementsDict[id].fileId = fileId;
    this.elementsDict[id].scale = [1, 1];
    return id;
  };

  /**
   * 
   * @param topX 
   * @param topY 
   * @param tex 
   * @returns 
   */
  async addLaTex(topX: number, topY: number, tex: string): Promise<string> {
    const id = nanoid();
    const image = await tex2dataURL(tex, this.plugin);
    if (!image) {
      return null;
    }
    this.imagesDict[image.fileId] = {
      mimeType: image.mimeType,
      id: image.fileId,
      dataURL: image.dataURL,
      created: image.created,
      file: null,
      hasSVGwithBitmap: false,
      latex: tex,
    };
    this.elementsDict[id] = this.boxedElement(
      id,
      "image",
      topX,
      topY,
      image.size.width,
      image.size.height,
    );
    this.elementsDict[id].fileId = image.fileId;
    this.elementsDict[id].scale = [1, 1];
    return id;
  };

  /**
   * 
   * @param objectA 
   * @param connectionA type ConnectionPoint = "top" | "bottom" | "left" | "right" | null
   * @param objectB 
   * @param connectionB when passed null, Excalidraw will automatically decide
   * @param formatting 
   *   numberOfPoints: points on the line. Default is 0 ie. line will only have a start and end point
   *   startArrowHead: "triangle"|"dot"|"arrow"|"bar"|null
   *   endArrowHead: "triangle"|"dot"|"arrow"|"bar"|null
   *   padding:
   * @returns 
   */
  connectObjects(
    objectA: string,
    connectionA: ConnectionPoint | null,
    objectB: string,
    connectionB: ConnectionPoint | null,
    formatting?: {
      numberOfPoints?: number;
      startArrowHead?: "triangle"|"dot"|"arrow"|"bar"|null;
      endArrowHead?: "triangle"|"dot"|"arrow"|"bar"|null;
      padding?: number;
    },
  ): string {
    if (!(this.elementsDict[objectA] && this.elementsDict[objectB])) {
      return;
    }

    if (
      ["line", "arrow", "freedraw"].includes(
        this.elementsDict[objectA].type,
      ) ||
      ["line", "arrow", "freedraw"].includes(this.elementsDict[objectB].type)
    ) {
      return;
    }

    const padding = formatting?.padding ? formatting.padding : 10;
    const numberOfPoints = formatting?.numberOfPoints
      ? formatting.numberOfPoints
      : 0;
    const getSidePoints = (side: string, el: any) => {
      switch (side) {
        case "bottom":
          return [(el.x + (el.x + el.width)) / 2, el.y + el.height + padding];
        case "left":
          return [el.x - padding, (el.y + (el.y + el.height)) / 2];
        case "right":
          return [el.x + el.width + padding, (el.y + (el.y + el.height)) / 2];
        default:
          //"top"
          return [(el.x + (el.x + el.width)) / 2, el.y - padding];
      }
    };
    let aX;
    let aY;
    let bX;
    let bY;
    const elA = this.elementsDict[objectA];
    const elB = this.elementsDict[objectB];
    if (!connectionA || !connectionB) {
      const aCenterX = elA.x + elA.width / 2;
      const bCenterX = elB.x + elB.width / 2;
      const aCenterY = elA.y + elA.height / 2;
      const bCenterY = elB.y + elB.height / 2;
      if (!connectionA) {
        const intersect = intersectElementWithLine(
          elA,
          [bCenterX, bCenterY],
          [aCenterX, aCenterY],
          GAP,
        );
        if (intersect.length === 0) {
          [aX, aY] = [aCenterX, aCenterY];
        } else {
          [aX, aY] = intersect[0];
        }
      }

      if (!connectionB) {
        const intersect = intersectElementWithLine(
          elB,
          [aCenterX, aCenterY],
          [bCenterX, bCenterY],
          GAP,
        );
        if (intersect.length === 0) {
          [bX, bY] = [bCenterX, bCenterY];
        } else {
          [bX, bY] = intersect[0];
        }
      }
    }
    if (connectionA) {
      [aX, aY] = getSidePoints(connectionA, this.elementsDict[objectA]);
    }
    if (connectionB) {
      [bX, bY] = getSidePoints(connectionB, this.elementsDict[objectB]);
    }
    const numAP = numberOfPoints + 2; //number of break points plus the beginning and the end
    const points:[x:number, y:number][] = [];
    for (let i = 0; i < numAP; i++) {
      points.push([
        aX + (i * (bX - aX)) / (numAP - 1),
        aY + (i * (bY - aY)) / (numAP - 1),
      ]);
    }
    return this.addArrow(points, {
      startArrowHead: formatting?.startArrowHead,
      endArrowHead: formatting?.endArrowHead,
      startObjectId: objectA,
      endObjectId: objectB,
    });
  };

  /**
   * Adds a text label to a line or arrow. Currently only works with a straight (2 point - start & end - line)
   * @param lineId id of the line or arrow object in elementsDict
   * @param label the label text
   * @returns undefined (if unsuccessful) or the id of the new text element
   */
  addLabelToLine(lineId: string, label: string): string {
    const line = this.elementsDict[lineId];
    if(!line || !["arrow","line"].includes(line.type) || line.points.length !== 2) {
      return;
    }

    let angle = Math.atan2(line.points[1][1],line.points[1][0]);

    const size = this.measureText(label);
    //let delta = size.height/6;

    if(angle < 0) {
      if(angle < -Math.PI/2) {
        angle+= Math.PI;
      } /*else {
        delta = -delta;
      } */
    } else {
      if(angle > Math.PI/2) {
        angle-= Math.PI;
        //delta = -delta;
      }
    }
    this.style.angle = angle;
    const id = this.addText(
      line.x+line.points[1][0]/2-size.width/2,//+delta,
      line.y+line.points[1][1]/2-size.height,//-5*size.height/6,
      label
    );
    this.style.angle = 0;
    return id;
  }

  /**
   * clear elementsDict and imagesDict only
   */
  clear() {
    this.elementsDict = {};
    this.imagesDict = {};
  };

  /**
   * clear() + reset all style values to default
   */
  reset() {
    this.clear();
    this.activeScript = null;
    this.style = {
      strokeColor: "#000000",
      backgroundColor: "transparent",
      angle: 0,
      fillStyle: "hachure",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      strokeSharpness: "sharp",
      fontFamily: 1,
      fontSize: 20,
      textAlign: "left",
      verticalAlign: "top",
      startArrowHead: null,
      endArrowHead: "arrow"
    };
    this.canvas = {
      theme: "light",
      viewBackgroundColor: "#FFFFFF",
      gridSize: 0
    };
  }; 

  /**
   * returns true if MD file is an Excalidraw file
   * @param f 
   * @returns 
   */
  isExcalidrawFile(f: TFile): boolean {
    return this.plugin.isExcalidrawFile(f);
  };

  /**
   * 
   * @param view 
   * @returns 
   */
  setView(view: ExcalidrawView | "first" | "active"): ExcalidrawView {
    if (view == "active") {
      const v = this.plugin.app.workspace.getActiveViewOfType(ExcalidrawView);
      if (!(v instanceof ExcalidrawView)) {
        return;
      }
      this.targetView = v;
    }
    if (view == "first") {
      const leaves =
        this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);
      if (!leaves || leaves.length == 0) {
        return;
      }
      this.targetView = leaves[0].view as ExcalidrawView;
    }
    if (view instanceof ExcalidrawView) {
      this.targetView = view;
    }
    return this.targetView;
  };

  /**
   * 
   * @returns https://github.com/excalidraw/excalidraw/tree/master/src/packages/excalidraw#ref
   */
  getExcalidrawAPI(): any {
    //@ts-ignore
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "getExcalidrawAPI()");
      return null;
    }
    return (this.targetView as ExcalidrawView).excalidrawAPI;
  };

  /**
   * get elements in View
   * @returns 
   */
  getViewElements(): ExcalidrawElement[] {
    //@ts-ignore
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "getViewSelectedElements()");
      return [];
    }
    const current = this.targetView?.excalidrawRef?.current;
    if (!current) {
      return [];
    }
    return current?.getSceneElements();
  };

  /**
   * 
   * @param elToDelete 
   * @returns 
   */
  deleteViewElements(elToDelete: ExcalidrawElement[]): boolean {
    //@ts-ignore
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "getViewSelectedElements()");
      return false;
    }
    const current = this.targetView?.excalidrawRef?.current;
    if (!current) {
      return false;
    }
    const el: ExcalidrawElement[] = current.getSceneElements();
    const st: AppState = current.getAppState();
    this.targetView.updateScene({
      elements: el.filter((e: ExcalidrawElement) => !elToDelete.includes(e)),
      appState: st,
      commitToHistory: true,
    });
    //this.targetView.save();
    return true;
  };

  /**
   * get the selected element in the view, if more are selected, get the first
   * @returns 
   */
  getViewSelectedElement(): any {
    const elements = this.getViewSelectedElements();
    return elements ? elements[0] : null;
  };

  /**
   * 
   * @returns 
   */
  getViewSelectedElements(): any[] {
    //@ts-ignore
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "getViewSelectedElements()");
      return [];
    }
    return this.targetView.getViewSelectedElements();
  };

  /**
   * 
   * @param el 
   * @returns TFile file handle for the image element
   */
  getViewFileForImageElement(el: ExcalidrawElement): TFile | null {
    //@ts-ignore
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "getViewSelectedElements()");
      return null;
    }
    if (!el || el.type !== "image") {
      errorMessage(
        "Must provide an image element as input",
        "getViewFileForImageElement()",
      );
      return null;
    }
    return (this.targetView as ExcalidrawView)?.excalidrawData?.getFile(
      el.fileId,
    )?.file;
  };

  /**
   * copies elements from view to elementsDict for editing
   * @param elements 
   */
  copyViewElementsToEAforEditing(elements: ExcalidrawElement[]): void {
    elements.forEach((el) => {
      this.elementsDict[el.id] = {
        ...el,
        version: el.version + 1,
        updated: Date.now(),
        versionNonce: Math.floor(Math.random() * 1000000000),
      };
    });
  };

  /**
   * 
   * @param forceViewMode 
   * @returns 
   */
  viewToggleFullScreen(forceViewMode: boolean = false): void {
    if (this.plugin.app.isMobile) {
      errorMessage("mobile not supported", "viewToggleFullScreen()");
      return;
    }
    //@ts-ignore
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "viewToggleFullScreen()");
      return;
    }
    if (forceViewMode) {
      const ref = this.getExcalidrawAPI();
      this.targetView.updateScene({
        //elements: ref.getSceneElements(),
        appState: {
          viewModeEnabled: true,
          ...ref.appState,
        },
        commitToHistory: false,
      });
    }
    const view = this.targetView as ExcalidrawView;
    if (view.isFullscreen()) {
      view.exitFullscreen();
    } else {
      view.gotoFullscreen();
    }
  };

  /**
   * connect an object to the selected element in the view
   * @param objectA ID of the element
   * @param connectionA 
   * @param connectionB 
   * @param formatting 
   * @returns 
   */
  connectObjectWithViewSelectedElement(
    objectA: string,
    connectionA: ConnectionPoint | null,
    connectionB: ConnectionPoint | null,
    formatting?: {
      numberOfPoints?: number;
      startArrowHead?: "triangle"|"dot"|"arrow"|"bar"|null;
      endArrowHead?: "triangle"|"dot"|"arrow"|"bar"|null;
      padding?: number;
    },
  ): boolean {
    const el = this.getViewSelectedElement();
    if (!el) {
      return false;
    }
    const id = el.id;
    this.elementsDict[id] = el;
    this.connectObjects(objectA, connectionA, id, connectionB, formatting);
    delete this.elementsDict[id];
    return true;
  };

  /**
   * Adds elements from elementsDict to the current view
   * @param repositionToCursor default is false
   * @param save default is true
   * @param newElementsOnTop controls whether elements created with ExcalidrawAutomate
   *   are added at the bottom of the stack or the top of the stack of elements already in the view
   *   Note that elements copied to the view with copyViewElementsToEAforEditing retain their
   *   position in the stack of elements in the view even if modified using EA
   *   default is false, i.e. the new elements get to the bottom of the stack
   * @returns 
   */
  async addElementsToView(
    repositionToCursor: boolean = false,
    save: boolean = true,
    newElementsOnTop: boolean = false,
  ): Promise<boolean> {
    //@ts-ignore
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "addElementsToView()");
      return false;
    }
    const elements = this.getElements();
    return await this.targetView.addElements(
      elements,
      repositionToCursor,
      save,
      this.imagesDict,
      newElementsOnTop,
    );
  };

  /**
   * Register instance of EA to use for hooks with TargetView
   * By default ExcalidrawViews will check window.ExcalidrawAutomate for event hooks.
   * Using this event you can set a different instance of Excalidraw Automate for hooks
   * @returns true if successful
   */
  registerThisAsViewEA():boolean {
    //@ts-ignore
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "addElementsToView()");
      return false;
    }
    this.targetView.setHookServer(this);
    return true;
  }

  /**
   * Sets the targetView EA to window.ExcalidrawAutomate
   * @returns true if successful
   */
  deregisterThisAsViewEA():boolean {
    //@ts-ignore
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "addElementsToView()");
      return false;
    }
    this.targetView.setHookServer(this);
    return true;
  }

  /**
   * If set, this callback is triggered when the user closes an Excalidraw view.
   */
  onViewUnloadHook: (view: ExcalidrawView) => void = null;

  /**
   * If set, this callback is triggered, when the user changes the view mode.
   * You can use this callback in case you want to do something additional when the user switches to view mode and back.
   */
  onViewModeChangeHook: (isViewModeEnabled:boolean, view: ExcalidrawView, ea: ExcalidrawAutomate) => void = null;

   /**
   * If set, this callback is triggered, when the user hovers a link in the scene.
   * You can use this callback in case you want to do something additional when the onLinkHover event occurs.
   * This callback must return a boolean value.
   * In case you want to prevent the excalidraw onLinkHover action you must return false, it will stop the native excalidraw onLinkHover management flow.
   */
  onLinkHoverHook: (
    element: NonDeletedExcalidrawElement,
    linkText: string,
    view: ExcalidrawView,
    ea: ExcalidrawAutomate
  ) => boolean = null;

   /**
   * If set, this callback is triggered, when the user clicks a link in the scene.
   * You can use this callback in case you want to do something additional when the onLinkClick event occurs.
   * This callback must return a boolean value.
   * In case you want to prevent the excalidraw onLinkClick action you must return false, it will stop the native excalidraw onLinkClick management flow.
   */
  onLinkClickHook:(
    element: ExcalidrawElement,
    linkText: string,
    event: MouseEvent,
    view: ExcalidrawView,
    ea: ExcalidrawAutomate
  ) => boolean = null;

  /**
   * If set, this callback is triggered, when Excalidraw receives an onDrop event. 
   * You can use this callback in case you want to do something additional when the onDrop event occurs.
   * This callback must return a boolean value.
   * In case you want to prevent the excalidraw onDrop action you must return false, it will stop the native excalidraw onDrop management flow.
   */
  onDropHook: (data: {
    ea: ExcalidrawAutomate;
    event: React.DragEvent<HTMLDivElement>;
    draggable: any; //Obsidian draggable object
    type: "file" | "text" | "unknown";
    payload: {
      files: TFile[]; //TFile[] array of dropped files
      text: string; //string
    };
    excalidrawFile: TFile; //the file receiving the drop event
    view: ExcalidrawView; //the excalidraw view receiving the drop
    pointerPosition: { x: number; y: number }; //the pointer position on canvas at the time of drop
  }) => boolean = null;
 
  /**
   * utility function to generate EmbeddedFilesLoader object
   * @param isDark 
   * @returns 
   */
  getEmbeddedFilesLoader(isDark?: boolean): EmbeddedFilesLoader {
    return new EmbeddedFilesLoader(this.plugin, isDark);
  };

  /**
   * utility function to generate ExportSettings object
   * @param withBackground 
   * @param withTheme 
   * @returns 
   */
  getExportSettings(
    withBackground: boolean,
    withTheme: boolean,
  ): ExportSettings {
    return { withBackground, withTheme };
  };

  /**
   * get bounding box of elements
   * bounding box is the box encapsulating all of the elements completely
   * @param elements 
   * @returns 
   */
  getBoundingBox(elements: ExcalidrawElement[]): {
    topX: number; 
    topY: number;
    width: number;
    height: number;
  } {
    const bb = getCommonBoundingBox(elements);
    return {
      topX: bb.minX,
      topY: bb.minY,
      width: bb.maxX - bb.minX,
      height: bb.maxY - bb.minY,
    };
  };

  /**
   * elements grouped by the highest level groups
   * @param elements 
   * @returns 
   */
  getMaximumGroups(elements: ExcalidrawElement[]): ExcalidrawElement[][] {
    return getMaximumGroups(elements);
  };

  /**
   * gets the largest element from a group. useful when a text element is grouped with a box, and you want to connect an arrow to the box
   * @param elements 
   * @returns 
   */
  getLargestElement(elements: ExcalidrawElement[]): ExcalidrawElement {
    if (!elements || elements.length === 0) {
      return null;
    }
    let largestElement = elements[0];
    const getSize = (el: ExcalidrawElement): Number => {
      return el.height * el.width;
    };
    let largetstSize = getSize(elements[0]);
    for (let i = 1; i < elements.length; i++) {
      const size = getSize(elements[i]);
      if (size > largetstSize) {
        largetstSize = size;
        largestElement = elements[i];
      }
    }
    return largestElement;
  };

  /**
   * @param element 
   * @param a 
   * @param b 
   * @param gap 
   * @returns 2 or 0 intersection points between line going through `a` and `b`
   *   and the `element`, in ascending order of distance from `a`.
   */
  intersectElementWithLine(
    element: ExcalidrawBindableElement,
    a: readonly [number, number],
    b: readonly [number, number],
    gap?: number,
  ): Point[] {
    return intersectElementWithLine(element, a, b, gap);
  };

  /**
   * See OCR plugin for example on how to use scriptSettings
   * Set by the ScriptEngine
   */
  activeScript: string = null; 

  /**
   * 
   * @returns script settings. Saves settings in plugin settings, under the activeScript key
   */
  getScriptSettings(): {} {
    if (!this.activeScript) {
      return null;
    }
    return this.plugin.settings.scriptEngineSettings[this.activeScript] ?? {};
  };

  /**
   * sets script settings.
   * @param settings 
   * @returns 
   */
  async setScriptSettings(settings: any): Promise<void> {
    if (!this.activeScript) {
      return null;
    }
    this.plugin.settings.scriptEngineSettings[this.activeScript] = settings;
    await this.plugin.saveSettings();
  };

  /**
   * Open a file in a new workspaceleaf or reuse an existing adjacent leaf depending on Excalidraw Plugin Settings
   * @param file 
   * @returns 
   */
  openFileInNewOrAdjacentLeaf(file: TFile): WorkspaceLeaf {
    if (!file || !(file instanceof TFile)) {
      return null;
    }
    if (!this.targetView) {
      return null;
    }
    const leaf = getNewOrAdjacentLeaf(this.plugin, this.targetView.leaf);
    leaf.openFile(file, {active: false});
    return leaf;
  };

  /**
   * measure text size based on current style settings
   * @param text 
   * @returns 
   */
  measureText(text: string): { width: number; height: number } {
    const size = _measureText(
      text,
      this.style.fontSize,
      this.style.fontFamily,
    );
    return { width: size.w ?? 0, height: size.h ?? 0 };
  };

  /**
   * verifyMinimumPluginVersion returns true if plugin version is >= than required
   * recommended use:
   * if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.5.20")) {new Notice("message");return;}
   * @param requiredVersion 
   * @returns 
   */
  verifyMinimumPluginVersion(requiredVersion: string): boolean {
    return PLUGIN_VERSION >= requiredVersion;
  };

  /**
   * Check if view is instance of ExcalidrawView
   * @param view 
   * @returns 
   */
  isExcalidrawView(view: any): boolean {
    return view instanceof ExcalidrawView;
  }

  /**
   * sets selection in view
   * @param elements 
   * @returns 
   */
  selectElementsInView(elements: ExcalidrawElement[]): void {
    //@ts-ignore
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "selectElementsInView()");
      return;
    }
    if (!elements || elements.length === 0) {
      return;
    }
    const API = this.getExcalidrawAPI();
    API.selectElements(elements);
  };

  /**
   * @returns an 8 character long random id
   */
  generateElementId(): string {
    return nanoid();
  };

  /**
   * @param element 
   * @returns a clone of the element with a new id
   */
  cloneElement(element: ExcalidrawElement): ExcalidrawElement {
    const newEl = JSON.parse(JSON.stringify(element));
    newEl.id = nanoid();
    return newEl;
  };

  /**
   * Moves the element to a specific position in the z-index
   */
  moveViewElementToZIndex(elementId: number, newZIndex: number): void {
    //@ts-ignore
    if (!this.targetView || !this.targetView?._loaded) {
      errorMessage("targetView not set", "moveViewElementToZIndex()");
      return;
    }
    const API = this.getExcalidrawAPI();
    const elements = this.getViewElements();
    const elementToMove = elements.filter((el: any) => el.id === elementId);
    if (elementToMove.length === 0) {
      errorMessage(
        `Element (id: ${elementId}) not found`,
        "moveViewElementToZIndex",
      );
      return;
    }
    if (newZIndex >= elements.length) {
      API.bringToFront(elementToMove);
      return;
    }
    if (newZIndex < 0) {
      API.sendToBack(elementToMove);
      return;
    }

    const oldZIndex = elements.indexOf(elementToMove[0]);
    elements.splice(newZIndex, 0, elements.splice(oldZIndex, 1)[0]);
    this.targetView.updateScene({
      elements,
      commitToHistory: true,
    });
  };

  /**
   * 
   * @param color 
   * @returns 
   */
  hexStringToRgb(color: string): number[] {
    const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
    return [parseInt(res[1], 16), parseInt(res[2], 16), parseInt(res[3], 16)];
  };

  /**
   * 
   * @param color 
   * @returns 
   */
  rgbToHexString(color: number[]): string {
    const colorInt =
      ((Math.round(color[0]) & 0xff) << 16) +
      ((Math.round(color[1]) & 0xff) << 8) +
      (Math.round(color[2]) & 0xff);
    const colorStr = colorInt.toString(16).toLowerCase();
    return `#${"000000".substring(colorStr.length)}${colorStr}`;
  };

  /**
   * 
   * @param color 
   * @returns 
   */
  hslToRgb(color: number[]): number[] {
    const h = color[0] / 360;
    const s = color[1] / 100;
    const l = color[2] / 100;
    let t2;
    let t3;
    let val;

    if (s === 0) {
      val = l * 255;
      return [val, val, val];
    }

    if (l < 0.5) {
      t2 = l * (1 + s);
    } else {
      t2 = l + s - l * s;
    }

    const t1 = 2 * l - t2;

    const rgb = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      t3 = h + (1 / 3) * -(i - 1);
      if (t3 < 0) {
        t3++;
      }

      if (t3 > 1) {
        t3--;
      }

      if (6 * t3 < 1) {
        val = t1 + (t2 - t1) * 6 * t3;
      } else if (2 * t3 < 1) {
        val = t2;
      } else if (3 * t3 < 2) {
        val = t1 + (t2 - t1) * (2 / 3 - t3) * 6;
      } else {
        val = t1;
      }

      rgb[i] = val * 255;
    }
    return rgb;
  };

  /**
   * 
   * @param color 
   * @returns 
   */
  rgbToHsl(color: number[]): number[] {
    const r = color[0] / 255;
    const g = color[1] / 255;
    const b = color[2] / 255;
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    const delta = max - min;
    let h;
    let s;

    if (max === min) {
      h = 0;
    } else if (r === max) {
      h = (g - b) / delta;
    } else if (g === max) {
      h = 2 + (b - r) / delta;
    } else if (b === max) {
      h = 4 + (r - g) / delta;
    }

    h = Math.min(h * 60, 360);

    if (h < 0) {
      h += 360;
    }

    const l = (min + max) / 2;

    if (max === min) {
      s = 0;
    } else if (l <= 0.5) {
      s = delta / (max + min);
    } else {
      s = delta / (2 - max - min);
    }

    return [h, s * 100, l * 100];
  };

  /**
   * 
   * @param color 
   * @returns 
   */
  colorNameToHex(color: string): string {
    if (COLOR_NAMES.has(color.toLowerCase().trim())) {
      return COLOR_NAMES.get(color.toLowerCase().trim());
    }
    return color.trim();
  };
};

export async function initExcalidrawAutomate(
  plugin: ExcalidrawPlugin,
): Promise<ExcalidrawAutomate> {
  await initFonts();
  const ea = new ExcalidrawAutomate(plugin);
  window.ExcalidrawAutomate = ea;
  return ea;
}

export function destroyExcalidrawAutomate() {
  delete window.ExcalidrawAutomate;
}

function normalizeLinePoints(
  points: [x: number, y: number][],
  //box: { x: number; y: number; w: number; h: number },
) {
  const p = [];
  const [x, y] = points[0];
  for (let i = 0; i < points.length; i++) {
    p.push([points[i][0] - x, points[i][1] - y]);
  }
  return p;
}

function getLineBox(points: [x: number, y: number][]) {
  const [x1, y1, x2, y2] = estimateLineBound(points);
  return {
    x: x1,
    y: y1,
    w: x2 - x1, //Math.abs(points[points.length-1][0]-points[0][0]),
    h: y2 - y1, //Math.abs(points[points.length-1][1]-points[0][1])
  };
}

function getFontFamily(id: number) {
  switch (id) {
    case 1:
      return "Virgil, Segoe UI Emoji";
    case 2:
      return "Helvetica, Segoe UI Emoji";
    case 3:
      return "Cascadia, Segoe UI Emoji";
    case 4:
      return "LocalFont";
  }
}

async function initFonts() {
  for (let i = 1; i <= 3; i++) {
    await (document as any).fonts.load(`20px ${getFontFamily(i)}`);
  }
}

export function _measureText(
  newText: string,
  fontSize: number,
  fontFamily: number,
) {
  //following odd error with mindmap on iPad while synchornizing with desktop.
  if (!fontSize) {
    fontSize = 20;
  }
  if (!fontFamily) {
    fontFamily = 1;
  }
  const metrics = measureText(
    newText,
    `${fontSize.toString()}px ${getFontFamily(fontFamily)}` as any,
  );
  return { w: metrics.width, h: metrics.height, baseline: metrics.baseline };
}

async function getTemplate(
  plugin: ExcalidrawPlugin,
  fileWithPath: string,
  loadFiles: boolean = false,
  loader: EmbeddedFilesLoader,
  depth: number
): Promise<{
  elements: any;
  appState: any;
  frontmatter: string;
  files: any;
  hasSVGwithBitmap: boolean;
}> {
  const app = plugin.app;
  const vault = app.vault;
  const templatePath = normalizePath(fileWithPath);
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
        elements: excalidrawData.scene.elements,
        appState: excalidrawData.scene.appState,
        frontmatter: "",
        files: excalidrawData.scene.files,
        hasSVGwithBitmap,
      };
    }

    const parsed =
      data.search("excalidraw-plugin: parsed\n") > -1 ||
      data.search("excalidraw-plugin: locked\n") > -1; //locked for backward compatibility
    await excalidrawData.loadData(
      data,
      file,
      parsed ? TextMode.parsed : TextMode.raw,
    );

    let trimLocation = data.search("# Text Elements\n");
    if (trimLocation == -1) {
      trimLocation = data.search("# Drawing\n");
    }

    let scene = excalidrawData.scene;
    if (loadFiles) {
      //debug({where:"getTemplate",template:file.name,loader:loader.uid});
      await loader.loadSceneFiles(excalidrawData, (fileArray: FileData[]) => {
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
      }, depth);
    }

    return {
      elements: scene.elements,
      appState: scene.appState,
      frontmatter: data.substring(0, trimLocation),
      files: scene.files,
      hasSVGwithBitmap,
    };
  }
  return {
    elements: [],
    appState: {},
    frontmatter: null,
    files: [],
    hasSVGwithBitmap,
  };
}

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
  depth: number
) {
  if (!loader) {
    loader = new EmbeddedFilesLoader(plugin);
  }
  const template = templatePath
    ? await getTemplate(plugin, templatePath, true, loader, depth)
    : null;
  let elements = template?.elements ?? [];
  elements = elements.concat(automateElements);
  return await getPNG(
    {
      type: "excalidraw",
      version: 2,
      source: "https://excalidraw.com",
      elements,
      appState: {
        theme: forceTheme ?? template?.appState?.theme ?? canvasTheme,
        viewBackgroundColor:
          template?.appState?.viewBackgroundColor ?? canvasBackgroundColor,
      },
      files: template?.files ?? {},
    },
    {
      withBackground:
        exportSettings?.withBackground ?? plugin.settings.exportWithBackground,
      withTheme: exportSettings?.withTheme ?? plugin.settings.exportWithTheme,
    },
    scale,
  );
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
): Promise<SVGSVGElement> {
  if (!loader) {
    loader = new EmbeddedFilesLoader(plugin);
  }
  const template = templatePath
    ? await getTemplate(plugin, templatePath, true, loader, depth)
    : null;
  let elements = template?.elements ?? [];
  elements = elements.concat(automateElements);
  const svg = await getSVG(
    {
      //createAndOpenDrawing
      type: "excalidraw",
      version: 2,
      source: "https://excalidraw.com",
      elements,
      appState: {
        theme: forceTheme ?? template?.appState?.theme ?? canvasTheme,
        viewBackgroundColor:
          template?.appState?.viewBackgroundColor ?? canvasBackgroundColor,
      },
      files: template?.files ?? {},
    },
    {
      withBackground:
        exportSettings?.withBackground ?? plugin.settings.exportWithBackground,
      withTheme: exportSettings?.withTheme ?? plugin.settings.exportWithTheme,
    },
    padding ?? plugin.settings.exportPaddingSVG,
  );
  if (template?.hasSVGwithBitmap) {
    svg.setAttribute("hasbitmap", "true");
  }
  return embedFont ? embedFontsInSVG(svg, plugin) : svg;
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
  return elements;
}

function errorMessage(message: string, source: string) {
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
        message: "this function is not avalable on Obsidian Mobile",
      });
      break;
    default:
      errorlog({
        where: "ExcalidrawAutomate",
        source,
        message: "unknown error",
      });
  }
}

export const insertLaTeXToView = (view: ExcalidrawView) => {
  const app = view.plugin.app;
  const ea = view.plugin.ea;
  const prompt = new Prompt(
    app,
    t("ENTER_LATEX"),
    "",
    "\\color{red}\\oint_S {E_n dA = \\frac{1}{{\\varepsilon _0 }}} Q_{inside}",
  );
  prompt.openAndGetValue(async (formula: string) => {
    if (!formula) {
      return;
    }
    ea.reset();
    await ea.addLaTex(0, 0, formula);
    ea.setView(view);
    ea.addElementsToView(true, false, true);
  });
};

export const search = async (view: ExcalidrawView) => {
  const ea = view.plugin.ea;
  ea.reset();
  ea.setView(view);
  const elements = ea.getViewElements().filter((el) => el.type === "text");
  if (elements.length === 0) {
    return;
  }
  let text = await ScriptEngine.inputPrompt(
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
  query = query.concat(text.split(" ").filter((s) => s.length !== 0));

  ea.targetView.selectElementsMatchingQuery(elements, query);
};
