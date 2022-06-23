import { ExcalidrawBindableElement, ExcalidrawElement, FileId, FillStyle, NonDeletedExcalidrawElement, StrokeSharpness, StrokeStyle } from "@zsviczian/excalidraw/types/element/types";
import { Point } from "@zsviczian/excalidraw/types/types";
import { TFile, WorkspaceLeaf } from "obsidian";
import { EmbeddedFilesLoader } from "./EmbeddedFileLoader";
import { ExcalidrawAutomate } from "./ExcalidrawAutomate";
import ExcalidrawView, { ExportSettings } from "./ExcalidrawView";
import ExcalidrawPlugin from "./main";


export type ConnectionPoint = "top" | "bottom" | "left" | "right" | null;

export type Packages = {
  react: any,
  reactDOM: any,
  excalidrawLib: any,
}

export interface ExcalidrawAutomateInterface {
  plugin: ExcalidrawPlugin;
  elementsDict: {[key:string]:any}; //contains the ExcalidrawElements currently edited in Automate indexed by el.id
  imagesDict: {[key: FileId]: any}; //the images files including DataURL, indexed by fileId
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
  getAPI(view?:ExcalidrawView):ExcalidrawAutomate;
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
    padding?: number
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
  ): string;
  addLabelToLine(lineId: string, label:string): string;
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
  getViewFileForImageElement(el: ExcalidrawElement): TFile | null; //Returns the TFile file handle for the image element
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
    repositionToCursor?: boolean, //default is false
    save?: boolean, //default is true
    //newElementsOnTop controls whether elements created with ExcalidrawAutomate
    //are added at the bottom of the stack or the top of the stack of elements already in the view
    //Note that elements copied to the view with copyViewElementsToEAforEditing retain their
    //position in the stack of elements in the view even if modified using EA
    newElementsOnTop?: boolean, //default is false, i.e. the new elements get to the bottom of the stack
  ): Promise<boolean>;
  registerThisAsViewEA():boolean;
  deregisterThisAsViewEA():boolean;
  onViewUnloadHook(view: ExcalidrawView): void;
  onViewModeChangeHook(isViewModeEnabled:boolean, view: ExcalidrawView, ea: ExcalidrawAutomate): void;
  onLinkHoverHook(
    element: NonDeletedExcalidrawElement,
    linkText: string,
    view: ExcalidrawView,
    ea: ExcalidrawAutomate
  ):boolean;
  onLinkClickHook(
    element: ExcalidrawElement,
    linkText: string,
    event: MouseEvent,
    view: ExcalidrawView,
    ea: ExcalidrawAutomate
  ): boolean;
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

  //See OCR plugin for example on how to use scriptSettings
  activeScript: string; //Set automatically by the ScriptEngine
  getScriptSettings(): {}; //Returns script settings. Saves settings in plugin settings, under the activeScript key
  setScriptSettings(settings: any): Promise<void>; //sets script settings.
  openFileInNewOrAdjacentLeaf(file: TFile): WorkspaceLeaf; //Open a file in a new workspaceleaf or reuse an existing adjacent leaf depending on Excalidraw Plugin Settings
  measureText(text: string): { width: number; height: number }; //measure text size based on current style settings
  //verifyMinimumPluginVersion returns true if plugin version is >= than required
  //recommended use:
  //if(!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("1.5.20")) {new Notice("message");return;}
  verifyMinimumPluginVersion(requiredVersion: string): boolean;
  isExcalidrawView(view: any): boolean;
  selectElementsInView(elements: ExcalidrawElement[]): void; //sets selection in view
  generateElementId(): string; //returns an 8 character long random id
  cloneElement(element: ExcalidrawElement): ExcalidrawElement; //Returns a clone of the element with a new id
  moveViewElementToZIndex(elementId: number, newZIndex: number): void; //Moves the element to a specific position in the z-index
  hexStringToRgb(color: string): number[];
  rgbToHexString(color: number[]): string;
  hslToRgb(color: number[]): number[];
  rgbToHsl(color: number[]): number[];
  colorNameToHex(color: string): string;
}