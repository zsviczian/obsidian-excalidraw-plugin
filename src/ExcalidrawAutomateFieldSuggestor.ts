export const EXCALIDRAW_AUTOMATE_INFO = [
  {
    field: "plugin",
    desc: "The ExcalidrawPlugin object",
    after: '.',
    alt: true,
  },
  {
    field: "elementsDict",
    desc: "The {} dictionary object, contains the ExcalidrawElements currently edited in Automate indexed by el.id",
    after: '[""]',
    alt: true,
  },
  {
    field: "imagesDict",
    desc: "the images files including DataURL, indexed by fileId",
    after: '[""]',
    alt: true,
  },
  {
    field: "style.strokeColor",
    desc: "[string] valid css color. See https://www.w3schools.com/colors/default.asp for more.",
    after: '',
    alt: true,
  },
  {
    field: "style.backgroundColor",
    desc: "[string] valid css color. See https://www.w3schools.com/colors/default.asp for more.",
    after: '',
    alt: true,
  },
  {
    field: "style.angle",
    desc: "[number] rotation of the object in radian",
    after: '',
    alt: true,
  },
  {
    field: "style.fillStyle",
    desc: "[string] 'hachure' | 'cross-hatch' | 'solid'",
    after: '',
    alt: true,
  },
  {
    field: "style.strokeWidth",
    desc: "[number]",
    after: '',
    alt: true,
  },
  {
    field: "style.strokeStyle",
    desc: "[string] 'solid' | 'dashed' | 'dotted'",
    after: '',
    alt: true,
  },
  {
    field: "style.roughness",
    desc: "[number]",
    after: '',
    alt: true,
  },
  {
    field: "style.opacity",
    desc: "[number]",
    after: '',
    alt: true,
  },  
  {
    field: "style.strokeSharpness",
    desc: "[string] 'round' | 'sharp'",
    after: '',
    alt: true,
  },
  {
    field: "style.fontFamily",
    desc: "[number] 1: Virgil, 2:Helvetica, 3:Cascadia, 4:LocalFont",
    after: '',
    alt: true,
  },
  {
    field: "style.fontSize",
    desc: "[number]",
    after: '',
    alt: true,
  },  
  {
    field: "style.textAlign",
    desc: "[string] 'left' | 'right' | 'center'",
    after: '',
    alt: true,
  },
  {
    field: "style.verticalAlign",
    desc: "[string] for future use, has no effect currently; 'top' | 'bottom' | 'middle'",
    after: '',
    alt: true,
  },
  {
    field: "style.startArrowHead",
    desc: "[string] 'triangle' | 'dot' | 'arrow' | 'bar' | null",
    after: '',
    alt: true,
  },
  {
    field: "style.endArrowHead",
    desc: "[string] 'triangle' | 'dot' | 'arrow' | 'bar' | null",
    after: '',
    alt: true,
  },
  {
    field: "canvas.theme",
    desc: "[string] 'dark' | 'light'",
    after: '',
    alt: true,
  },
  {
    field: "canvas.viewBackgroundColor",
    desc: "[string] valid css color. See https://www.w3schools.com/colors/default.asp for more.",
    after: '',
    alt: true,
  },
  {
    field: "canvas.gridSize",
    desc: "[number]",
    after: '',
    alt: true,
  },
  {
    field: "addToGroup",
    desc: "addToGroup(objectIds: []): string;",
    after: '',
    alt: true,
  },
  {
    field: "toCliboard",
    desc: "toClipboard(templatePath?: string): void; //copies current elements using template to clipboard, ready to be pasted into an excalidraw canvas",
    after: '',
    alt: true,
  },
  {
    field: "getElements",
    desc: "getElements(): ExcalidrawElement[]; //get all elements from ExcalidrawAutomate elementsDict",
    after: '',
    alt: true,
  },

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