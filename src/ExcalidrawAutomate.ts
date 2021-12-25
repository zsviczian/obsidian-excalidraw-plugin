import ExcalidrawPlugin from "./main";
import {
  FillStyle,
  StrokeStyle,
  StrokeSharpness,
  ExcalidrawElement,
  ExcalidrawBindableElement,
} from "@zsviczian/excalidraw/types/element/types";
import { normalizePath, TFile } from "obsidian";
import ExcalidrawView, { ExportSettings, TextMode } from "./ExcalidrawView";
import { ExcalidrawData } from "./ExcalidrawData";
import {
  FRONTMATTER,
  nanoid,
  VIEW_TYPE_EXCALIDRAW,
  MAX_IMAGE_SIZE,
} from "./constants";
import {
  //debug,
  embedFontsInSVG,
  errorlog,
  getPNG,
  getSVG,
  isObsidianThemeDark,
  scaleLoadedImage,
  wrapText,
} from "./Utils";
import { AppState, Point } from "@zsviczian/excalidraw/types/types";
import { EmbeddedFilesLoader, FileData } from "./EmbeddedFileLoader";
import { tex2dataURL } from "./LaTeX";
import {
  determineFocusDistance,
  getCommonBoundingBox,
  getMaximumGroups,
  intersectElementWithLine,
} from "@zsviczian/excalidraw";

declare type ConnectionPoint = "top" | "bottom" | "left" | "right" | null;
const GAP = 4;

export interface ExcalidrawAutomate {
  plugin: ExcalidrawPlugin;
  elementsDict: {}; //contains the ExcalidrawElements currently edited in Automate indexed by el.id
  imagesDict: {}; //the images files including DataURL, indexed by fileId
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
    fontFamily: number; //1: Virgil, 2:Helvetica, 3:Cascadia
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
  setFillStyle(val: number): void; //0:"hachure", 1:"cross-hatch" 2:"solid"
  setStrokeStyle(val: number): void; //0:"solid", 1:"dashed", 2:"dotted"
  setStrokeSharpness(val: number): void; //0:"round", 1:"sharp"
  setFontFamily(val: number): void; //1: Virgil, 2:Helvetica, 3:Cascadia
  setTheme(val: number): void; //0:"light", 1:"dark"
  addToGroup(objectIds: []): string;
  toClipboard(templatePath?: string): void;
  getElements(): ExcalidrawElement[]; //get all elements from ExcalidrawAutomate elementsDict
  getElement(id: string): ExcalidrawElement; //get single element from ExcalidrawAutomate elementsDict
  create(params?: {
    //create a drawing and save it to filename
    filename?: string; //if null: default filename as defined in Excalidraw settings
    foldername?: string; //if null: default folder as defined in Excalidraw settings
    templatePath?: string;
    onNewPane?: boolean;
    frontmatterKeys?: {
      "excalidraw-plugin"?: "raw" | "parsed";
      "excalidraw-link-prefix"?: string;
      "excalidraw-link-brackets"?: boolean;
      "excalidraw-url-prefix"?: string;
    };
  }): Promise<string>;
  createSVG(
    templatePath?: string,
    embedFont?: boolean,
    exportSettings?: ExportSettings, //use ExcalidrawAutomate.getExportSettings(boolean,boolean)
    loader?: EmbeddedFilesLoader, //use ExcalidrawAutomate.getEmbeddedFilesLoader(boolean?)
    theme?: string,
  ): Promise<SVGSVGElement>;
  createPNG(
    templatePath?: string,
    scale?: number,
    exportSettings?: ExportSettings, //use ExcalidrawAutomate.getExportSettings(boolean,boolean)
    loader?: EmbeddedFilesLoader, //use ExcalidrawAutomate.getEmbeddedFilesLoader(boolean?)
    theme?: string,
  ): Promise<any>;
  wrapText(text: string, lineLen: number): string;
  addRect(topX: number, topY: number, width: number, height: number): string;
  addDiamond(topX: number, topY: number, width: number, height: number): string;
  addEllipse(topX: number, topY: number, width: number, height: number): string;
  addBlob(topX: number, topY: number, width: number, height: number): string;
  addText(
    topX: number,
    topY: number,
    text: string,
    formatting?: {
      wrapAt?: number;
      width?: number;
      height?: number;
      textAlign?: string;
      box?: boolean | "box" | "blob" | "ellipse" | "diamond"; //if !null, text will be boxed
      boxPadding?: number;
    },
    id?: string,
  ): string;
  addLine(points: [[x: number, y: number]]): string;
  addArrow(
    points: [[x: number, y: number]],
    formatting?: {
      startArrowHead?: string;
      endArrowHead?: string;
      startObjectId?: string;
      endObjectId?: string;
    },
  ): string;
  addImage(topX: number, topY: number, imageFile: TFile): Promise<string>;
  addLaTex(topX: number, topY: number, tex: string): Promise<string>;
  connectObjects(
    objectA: string,
    connectionA: ConnectionPoint, //type ConnectionPoint = "top" | "bottom" | "left" | "right" | null
    objectB: string,
    connectionB: ConnectionPoint, //when passed null, Excalidraw will automatically decide
    formatting?: {
      numberOfPoints?: number; //points on the line. Default is 0 ie. line will only have a start and end point
      startArrowHead?: string; //"triangle"|"dot"|"arrow"|"bar"|null
      endArrowHead?: string; //"triangle"|"dot"|"arrow"|"bar"|null
      padding?: number;
    },
  ): void;
  clear(): void; //clear elementsDict and imagesDict only
  reset(): void; //clear() + reset all style values to default
  isExcalidrawFile(f: TFile): boolean; //returns true if MD file is an Excalidraw file
  //view manipulation
  targetView: ExcalidrawView; //the view currently edited
  setView(view: ExcalidrawView | "first" | "active"): ExcalidrawView;
  getExcalidrawAPI(): any; //https://github.com/excalidraw/excalidraw/tree/master/src/packages/excalidraw#ref
  getViewElements(): ExcalidrawElement[]; //get elements in View
  deleteViewElements(el: ExcalidrawElement[]): boolean;
  getViewSelectedElement(): ExcalidrawElement; //get the selected element in the view, if more are selected, get the first
  getViewSelectedElements(): ExcalidrawElement[];
  copyViewElementsToEAforEditing(elements: ExcalidrawElement[]): void; //copies elements from view to elementsDict for editing
  viewToggleFullScreen(forceViewMode?: boolean): void;
  connectObjectWithViewSelectedElement( //connect an object to the selected element in the view
    objectA: string, //see connectObjects
    connectionA: ConnectionPoint,
    connectionB: ConnectionPoint,
    formatting?: {
      numberOfPoints?: number;
      startArrowHead?: string;
      endArrowHead?: string;
      padding?: number;
    },
  ): boolean;
  addElementsToView( //Adds elements from elementsDict to the current view
    repositionToCursor: boolean,
    save: boolean,
  ): Promise<boolean>;
  onDropHook(data: {
    //if set Excalidraw will call this function onDrop events
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
  }): boolean; //a return of true will stop the default onDrop processing in Excalidraw
  mostRecentMarkdownSVG: SVGSVGElement; //Markdown renderer will drop a copy of the most recent SVG here for debugging purposes
  getEmbeddedFilesLoader(isDark?: boolean): EmbeddedFilesLoader; //utility function to generate EmbeddedFilesLoader object
  getExportSettings( //utility function to generate ExportSettings object
    withBackground: boolean,
    withTheme: boolean,
  ): ExportSettings;
  getBoundingBox(elements: ExcalidrawElement[]): {
    //get bounding box of elements
    topX: number; //bounding box is the box encapsulating all of the elements completely
    topY: number;
    width: number;
    height: number;
  };
  //elements grouped by the highest level groups
  getMaximumGroups(elements: ExcalidrawElement[]): ExcalidrawElement[][];
  //gets the largest element from a group. useful when a text element is grouped with a box, and you want to connect an arrow to the box
  getLargestElement(elements: ExcalidrawElement[]): ExcalidrawElement;
  // Returns 2 or 0 intersection points between line going through `a` and `b`
  // and the `element`, in ascending order of distance from `a`.
  intersectElementWithLine(
    element: ExcalidrawBindableElement,
    a: readonly [number, number],
    b: readonly [number, number],
    gap?: number, //if given, element is inflated by this value
  ): Point[];
}

declare let window: any;

export async function initExcalidrawAutomate(
  plugin: ExcalidrawPlugin,
): Promise<ExcalidrawAutomate> {
  window.ExcalidrawAutomate = {
    plugin,
    elementsDict: {},
    imagesDict: {},
    style: {
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
      endArrowHead: "arrow",
    },
    canvas: { theme: "light", viewBackgroundColor: "#FFFFFF", gridSize: 0 },
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
    },
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
    },
    setStrokeSharpness(val: number) {
      switch (val) {
        case 0:
          this.style.strokeSharpness = "round";
          return "round";
        default:
          this.style.strokeSharpness = "sharp";
          return "sharp";
      }
    },
    setFontFamily(val: number) {
      switch (val) {
        case 1:
          this.style.fontFamily = 1;
          return getFontFamily(1);
        case 2:
          this.style.fontFamily = 2;
          return getFontFamily(2);
        default:
          this.style.strokeSharpness = 3;
          return getFontFamily(3);
      }
    },
    setTheme(val: number) {
      switch (val) {
        case 0:
          this.canvas.theme = "light";
          return "light";
        default:
          this.canvas.theme = "dark";
          return "dark";
      }
    },
    addToGroup(objectIds: []): string {
      const id = nanoid();
      objectIds.forEach((objectId) => {
        this.elementsDict[objectId]?.groupIds?.push(id);
      });
      return id;
    },
    async toClipboard(templatePath?: string) {
      const template = templatePath
        ? await getTemplate(
            this.plugin,
            templatePath,
            false,
            new EmbeddedFilesLoader(this.plugin),
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
    },
    getElements(): ExcalidrawElement[] {
      const elements = [];
      const elementIds = Object.keys(this.elementsDict);
      for (let i = 0; i < elementIds.length; i++) {
        elements.push(this.elementsDict[elementIds[i]]);
      }
      return elements;
    },
    getElement(id: string): ExcalidrawElement {
      return this.elementsDict[id];
    },
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
      };
    }): Promise<string> {
      const template = params?.templatePath
        ? await getTemplate(
            this.plugin,
            params.templatePath,
            true,
            new EmbeddedFilesLoader(this.plugin),
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

      return plugin.createDrawing(
        params?.filename
          ? `${params.filename}.excalidraw.md`
          : this.plugin.getNextDefaultFilename(),
        params?.onNewPane ? params.onNewPane : false,
        params?.foldername ? params.foldername : this.plugin.settings.folder,
        this.plugin.settings.compatibilityMode
          ? JSON.stringify(scene, null, "\t")
          : frontmatter +
              (await plugin.exportSceneToMD(JSON.stringify(scene, null, "\t"))),
      );
    },
    async createSVG(
      templatePath?: string,
      embedFont: boolean = false,
      exportSettings?: ExportSettings,
      loader?: EmbeddedFilesLoader,
      theme?: string,
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
          withBackground: this.plugin.settings.exportBackground,
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
      );
    },
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
          withBackground: this.plugin.settings.exportBackground,
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
      );
    },
    wrapText(text: string, lineLen: number): string {
      return wrapText(text, lineLen, this.plugin.settings.forceWrap);
    },
    addRect(topX: number, topY: number, width: number, height: number): string {
      const id = nanoid();
      this.elementsDict[id] = boxedElement(
        id,
        "rectangle",
        topX,
        topY,
        width,
        height,
      );
      return id;
    },
    addDiamond(
      topX: number,
      topY: number,
      width: number,
      height: number,
    ): string {
      const id = nanoid();
      this.elementsDict[id] = boxedElement(
        id,
        "diamond",
        topX,
        topY,
        width,
        height,
      );
      return id;
    },
    addEllipse(
      topX: number,
      topY: number,
      width: number,
      height: number,
    ): string {
      const id = nanoid();
      this.elementsDict[id] = boxedElement(
        id,
        "ellipse",
        topX,
        topY,
        width,
        height,
      );
      return id;
    },
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
    },
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
      const { w, h, baseline } = measureText(
        text,
        this.style.fontSize,
        this.style.fontFamily,
      );
      const width = formatting?.width ? formatting.width : w;
      const height = formatting?.height ? formatting.height : h;

      let boxId: string = null;
      const boxPadding = formatting?.boxPadding ?? 30;
      if (formatting?.box) {
        switch (formatting?.box) {
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
      const ea = window.ExcalidrawAutomate;
      this.elementsDict[id] = {
        text,
        fontSize: ea.style.fontSize,
        fontFamily: ea.style.fontFamily,
        textAlign: formatting?.textAlign
          ? formatting.textAlign
          : ea.style.textAlign,
        verticalAlign: ea.style.verticalAlign,
        baseline,
        ...boxedElement(id, "text", topX, topY, width, height),
        containerId: boxId,
        originalText,
        rawText: originalText,
      };
      if (boxId && formatting?.box === "blob") {
        this.addToGroup([id, boxId]);
      }
      if (boxId && formatting?.box !== "blob") {
        const box = this.elementsDict[boxId];
        if (!box.boundElements) {
          box.boundElements = [];
        }
        box.boundElements.push({ type: "text", id });
      }
      return boxId ?? id;
    },
    addLine(points: [[x: number, y: number]]): string {
      const box = getLineBox(points);
      const id = nanoid();
      //this.elementIds.push(id);
      this.elementsDict[id] = {
        points: normalizeLinePoints(points),
        lastCommittedPoint: null,
        startBinding: null,
        endBinding: null,
        startArrowhead: null,
        endArrowhead: null,
        ...boxedElement(id, "line", points[0][0], points[0][1], box.w, box.h),
      };
      return id;
    },
    addArrow(
      points: [[x: number, y: number]],
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
      //this.elementIds.push(id);
      this.elementsDict[id] = {
        points: normalizeLinePoints(points),
        lastCommittedPoint: null,
        startBinding: {
          elementId: formatting?.startObjectId,
          focus: formatting?.startObjectId
            ? determineFocusDistance(
                this.getElement(formatting?.startObjectId),
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
                this.getElement(formatting?.endObjectId),
                startPoint,
                endPoint,
              )
            : 0.1,
          gap: GAP,
        },
        startArrowhead: formatting?.startArrowHead
          ? formatting.startArrowHead
          : this.style.startArrowHead,
        endArrowhead: formatting?.endArrowHead
          ? formatting.endArrowHead
          : this.style.endArrowHead,
        ...boxedElement(id, "arrow", points[0][0], points[0][1], box.w, box.h),
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
    },
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
      const image = await loader.getObsidianImage(imageFile);
      if (!image) {
        return null;
      }
      this.imagesDict[image.fileId] = {
        mimeType: image.mimeType,
        id: image.fileId,
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
      this.elementsDict[id] = boxedElement(
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
    },
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
      this.elementsDict[id] = boxedElement(
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
    },
    connectObjects(
      objectA: string,
      connectionA: ConnectionPoint,
      objectB: string,
      connectionB: ConnectionPoint,
      formatting?: {
        numberOfPoints?: number;
        startArrowHead?: string;
        endArrowHead?: string;
        padding?: number;
      },
    ): void {
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
      const points = [];
      for (let i = 0; i < numAP; i++) {
        points.push([
          aX + (i * (bX - aX)) / (numAP - 1),
          aY + (i * (bY - aY)) / (numAP - 1),
        ]);
      }
      this.addArrow(points, {
        startArrowHead: formatting?.startArrowHead,
        endArrowHead: formatting?.endArrowHead,
        startObjectId: objectA,
        endObjectId: objectB,
      });
    },
    clear() {
      this.elementsDict = {};
      this.imagesDict = {};
    },
    reset() {
      this.clear();
      this.style.strokeColor = "#000000";
      this.style.backgroundColor = "transparent";
      this.style.angle = 0;
      this.style.fillStyle = "hachure";
      this.style.strokeWidth = 1;
      this.style.strokeStyle = "solid";
      this.style.roughness = 1;
      this.style.opacity = 100;
      this.style.strokeSharpness = "sharp";
      this.style.fontFamily = 1;
      this.style.fontSize = 20;
      this.style.textAlign = "left";
      this.style.verticalAlign = "top";
      this.style.startArrowHead = null;
      this.style.endArrowHead = "arrow";
      this.canvas.theme = "light";
      this.canvas.viewBackgroundColor = "#FFFFFF";
      this.canvas.gridSize = 0;
    },
    isExcalidrawFile(f: TFile): boolean {
      return this.plugin.isExcalidrawFile(f);
    },
    targetView: null,
    setView(view: ExcalidrawView | "first" | "active"): ExcalidrawView {
      if (view == "active") {
        const v = this.plugin.app.workspace.activeLeaf.view;
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
    },
    getExcalidrawAPI(): any {
      if (!this.targetView || !this.targetView?._loaded) {
        errorMessage("targetView not set", "getExcalidrawAPI()");
        return null;
      }
      return (this.targetView as ExcalidrawView).excalidrawAPI;
    },
    getViewElements(): ExcalidrawElement[] {
      if (!this.targetView || !this.targetView?._loaded) {
        errorMessage("targetView not set", "getViewSelectedElements()");
        return [];
      }
      const current = this.targetView?.excalidrawRef?.current;
      if (!current) {
        return [];
      }
      return current?.getSceneElements();
    },
    deleteViewElements(elToDelete: ExcalidrawElement[]): boolean {
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
      current.updateScene({
        elements: el.filter((e: ExcalidrawElement) => !elToDelete.includes(e)),
        appState: st,
        commitToHistory: true,
      });
      //this.targetView.save();
      return true;
    },
    getViewSelectedElement(): any {
      const elements = this.getViewSelectedElements();
      return elements ? elements[0] : null;
    },
    getViewSelectedElements(): any[] {
      if (!this.targetView || !this.targetView?._loaded) {
        errorMessage("targetView not set", "getViewSelectedElements()");
        return [];
      }
      const current = this.targetView?.excalidrawRef?.current;
      const selectedElements = current?.getAppState()?.selectedElementIds;
      if (!selectedElements) {
        return [];
      }
      const selectedElementsKeys = Object.keys(selectedElements);
      if (!selectedElementsKeys) {
        return [];
      }
      return current
        .getSceneElements()
        .filter((e: any) => selectedElementsKeys.includes(e.id));
    },
    copyViewElementsToEAforEditing(elements: ExcalidrawElement[]): void {
      elements.forEach((el) => {
        this.elementsDict[el.id] = {
          version: el.version + 1,
          ...el,
        };
      });
    },
    viewToggleFullScreen(forceViewMode: boolean = false): void {
      if (this.plugin.app.isMobile) {
        errorMessage("mobile not supported", "viewToggleFullScreen()");
        return;
      }
      if (!this.targetView || !this.targetView?._loaded) {
        errorMessage("targetView not set", "viewToggleFullScreen()");
        return;
      }
      if (forceViewMode) {
        const ref = this.getExcalidrawAPI();
        ref.updateScene({
          elements: ref.getSceneElements(),
          appState: {
            viewModeEnabled: true,
            ...ref.appState,
          },
          commitToHistory: false,
        });
      }
      if (
        document.fullscreenElement ===
        (this.targetView as ExcalidrawView).contentEl
      ) {
        document.exitFullscreen();
      } else {
        (this.targetView as ExcalidrawView).contentEl.requestFullscreen();
      }
    },
    connectObjectWithViewSelectedElement(
      objectA: string,
      connectionA: ConnectionPoint,
      connectionB: ConnectionPoint,
      formatting?: {
        numberOfPoints?: number;
        startArrowHead?: string;
        endArrowHead?: string;
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
    },
    async addElementsToView(
      repositionToCursor: boolean = false,
      save: boolean = true,
    ): Promise<boolean> {
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
      );
    },
    onDropHook: null,
    mostRecentMarkdownSVG: null,
    getEmbeddedFilesLoader(isDark?: boolean): EmbeddedFilesLoader {
      return new EmbeddedFilesLoader(this.plugin, isDark);
    },
    getExportSettings(
      withBackground: boolean,
      withTheme: boolean,
    ): ExportSettings {
      return { withBackground, withTheme };
    },
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
    },
    getMaximumGroups(elements: ExcalidrawElement[]): ExcalidrawElement[][] {
      return getMaximumGroups(elements);
    },
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
    },
    intersectElementWithLine(
      element: ExcalidrawBindableElement,
      a: readonly [number, number],
      b: readonly [number, number],
      gap?: number,
    ): Point[] {
      return intersectElementWithLine(element, a, b, gap);
    },
  };
  await initFonts();
  return window.ExcalidrawAutomate;
}

export function destroyExcalidrawAutomate() {
  delete window.ExcalidrawAutomate;
}

function normalizeLinePoints(
  points: [[x: number, y: number]],
  //box: { x: number; y: number; w: number; h: number },
) {
  const p = [];
  const [x, y] = points[0];
  for (let i = 0; i < points.length; i++) {
    p.push([points[i][0] - x, points[i][1] - y]);
  }
  return p;
}

function boxedElement(
  id: string,
  eltype: any,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const ea = window.ExcalidrawAutomate;
  return {
    id,
    type: eltype,
    x,
    y,
    width: w,
    height: h,
    angle: ea.style.angle,
    strokeColor: ea.style.strokeColor,
    backgroundColor: ea.style.backgroundColor,
    fillStyle: ea.style.fillStyle,
    strokeWidth: ea.style.strokeWidth,
    strokeStyle: ea.style.strokeStyle,
    roughness: ea.style.roughness,
    opacity: ea.style.opacity,
    strokeSharpness: ea.style.strokeSharpness,
    seed: Math.floor(Math.random() * 100000),
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    groupIds: [] as any,
    boundElements: [] as any,
  };
}

function getLineBox(points: [[x: number, y: number]]) {
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
  }
}

async function initFonts() {
  for (let i = 1; i <= 3; i++) {
    await (document as any).fonts.load(`20px ${getFontFamily(i)}`);
  }
}

export function measureText(
  newText: string,
  fontSize: number,
  fontFamily: number,
) {
  const line = document.createElement("div");
  const body = document.body;
  line.style.position = "absolute";
  line.style.whiteSpace = "pre";
  line.style.font = `${fontSize.toString()}px ${getFontFamily(fontFamily)}`;
  body.appendChild(line);
  line.innerText = newText
    .split("\n")
    // replace empty lines with single space because leading/trailing empty
    // lines would be stripped from computation
    .map((x) => x || " ")
    .join("\n");
  const width = line.offsetWidth;
  const height = line.offsetHeight;
  // Now creating 1px sized item that will be aligned to baseline
  // to calculate baseline shift
  const span = document.createElement("span");
  span.style.display = "inline-block";
  span.style.overflow = "hidden";
  span.style.width = "1px";
  span.style.height = "1px";
  line.appendChild(span);
  // Baseline is important for positioning text on canvas
  const baseline = span.offsetTop + span.offsetHeight;
  document.body.removeChild(line);
  return { w: width, h: height, baseline };
}

async function getTemplate(
  plugin: ExcalidrawPlugin,
  fileWithPath: string,
  loadFiles: boolean = false,
  loader: EmbeddedFilesLoader,
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
      });
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
) {
  if (!loader) {
    loader = new EmbeddedFilesLoader(plugin);
  }
  const template = templatePath
    ? await getTemplate(plugin, templatePath, true, loader)
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
): Promise<SVGSVGElement> {
  if (!loader) {
    loader = new EmbeddedFilesLoader(plugin);
  }
  const template = templatePath
    ? await getTemplate(plugin, templatePath, true, loader)
    : null;
  let elements = template?.elements ?? [];
  elements = elements.concat(automateElements);
  const svg = await getSVG(
    {
      //createDrawing
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
  );
  if (template?.hasSVGwithBitmap) {
    svg.setAttribute("hasbitmap", "true");
  }
  return embedFont ? embedFontsInSVG(svg) : svg;
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
