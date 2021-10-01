# [◀ Excalidraw Automate How To](../readme.md)
## Attributes and functions overview
Here's the interface implemented by ExcalidrawAutomate:

```typescript
export interface ExcalidrawAutomate extends Window {
  ExcalidrawAutomate: {
    plugin: ExcalidrawPlugin;
    elementsDict: {};
    style: {
      strokeColor: string;
      backgroundColor: string;
      angle: number;
      fillStyle: FillStyle;
      strokeWidth: number;
      storkeStyle: StrokeStyle;
      roughness: number;
      opacity: number;
      strokeSharpness: StrokeSharpness;
      fontFamily: number;
      fontSize: number;
      textAlign: string;
      verticalAlign: string;
      startArrowHead: string;
      endArrowHead: string;
    }
    canvas: {
      theme: string, 
      viewBackgroundColor: string, 
      gridSize: number
    };
    setFillStyle (val:number): void;
    setStrokeStyle (val:number): void;
    setStrokeSharpness (val:number): void;
    setFontFamily (val:number): void;
    setTheme (val:number): void;
    addToGroup (objectIds:[]):string;
    toClipboard (templatePath?:string): void;
    getElements ():ExcalidrawElement[];
    getElement (id:string):ExcalidrawElement;
    create (
      params?: {
        filename?: string, 
        foldername?:string, 
        templatePath?:string, 
        onNewPane?: boolean,
        frontmatterKeys?:{
          "excalidraw-plugin"?: "raw"|"parsed",
          "excalidraw-link-prefix"?: string,
          "excalidraw-link-brackets"?: boolean,
          "excalidraw-url-prefix"?: string
        }
      }
    ):Promise<string>;
    createSVG (templatePath?:string):Promise<SVGSVGElement>;
    createPNG (templatePath?:string):Promise<any>;
    wrapText (text:string, lineLen:number):string;
    addRect (topX:number, topY:number, width:number, height:number):string;
    addDiamond (topX:number, topY:number, width:number, height:number):string;
    addEllipse (topX:number, topY:number, width:number, height:number):string;
    addBlob (topX:number, topY:number, width:number, height:number):string;
    addText (
      topX:number, 
      topY:number, 
      text:string, 
      formatting?: {
        wrapAt?:number, 
        width?:number, 
        height?:number,
        textAlign?: string, 
        box?: "box"|"blob"|"ellipse"|"diamond", 
        boxPadding?: number
      },
      id?:string
    ):string;
    addLine(points: [[x:number,y:number]]):string;
    addArrow (
      points: [[x:number,y:number]],
      formatting?: {
        startArrowHead?:string,
        endArrowHead?:string,
        startObjectId?:string,
        endObjectId?:string
      }
    ):string ;
    connectObjects (
      objectA: string, 
      connectionA: ConnectionPoint, 
      objectB: string, 
      connectionB: ConnectionPoint, 
      formatting?: {
        numberOfPoints?: number,
        startArrowHead?:string,
        endArrowHead?:string, 
        padding?: number
      }
    ):void;
    clear (): void;
    reset (): void;
    isExcalidrawFile (f:TFile): boolean;  
    //view manipulation
    targetView: ExcalidrawView;
    setView (view:ExcalidrawView|"first"|"active"):ExcalidrawView;
    getExcalidrawAPI ():any;
    getViewElements ():ExcalidrawElement[];
    deleteViewElements (el: ExcalidrawElement[]):boolean;
    getViewSelectedElement( ):ExcalidrawElement;
    getViewSelectedElements ():ExcalidrawElement[];
    viewToggleFullScreen (forceViewMode?:boolean):void;
    connectObjectWithViewSelectedElement (
      objectA:string,
      connectionA: ConnectionPoint, 
      connectionB: ConnectionPoint, 
      formatting?: {
        numberOfPoints?: number,
        startArrowHead?:string,
        endArrowHead?:string, 
        padding?: number
      }
    ):boolean;
    addElementsToView (repositionToCursor:boolean, save:boolean):Promise<boolean>;
    onDropHook (data: {
      ea: ExcalidrawAutomate, 
      event: React.DragEvent<HTMLDivElement>,
      draggable: any, //Obsidian draggable object
      type: "file"|"text"|"unknown",
      payload: {
        files: TFile[], //TFile[] array of dropped files
        text: string, //string 
      },
      excalidrawFile: TFile, //the file receiving the drop event
      view: ExcalidrawView, //the excalidraw view receiving the drop
      pointerPosition: {x:number, y:number} //the pointer position on canvas at the time of drop
    }):boolean;
  };
}
```

