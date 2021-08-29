# [◀ Excalidraw Automate How To](../readme.md)
## Attributes and functions overview
Here's the interface implemented by ExcalidrawAutomate:

```typescript
ExcalidrawAutomate: {
  plugin: ExcalidrawPlugin;
  elementIds: [];
  elementsDict: {},
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
  canvas: {theme: string, viewBackgroundColor: string};
  setFillStyle(val:number): void;
  setStrokeStyle(val:number): void;
  setStrokeSharpness(val:number): void;
  setFontFamily(val:number): void;
  setTheme(val:number): void;
  addToGroup(objectIds:[]):void;
  addRect(topX:number, topY:number, width:number, height:number):string;
  addDiamond(topX:number, topY:number, width:number, height:number):string;
  addEllipse(topX:number, topY:number, width:number, height:number):string;
  addText(topX:number, topY:number, text:string, formatting?:{width?:number, height?:number,textAlign?: string, verticalAlign?:string, box?: boolean, boxPadding?: number},id?:string):string;
  addLine(points: [[x:number,y:number]]):void;
  addArrow(points: [[x:number,y:number]],formatting?:{startArrowHead:string,endArrowHead:string,startObjectId:string,endObjectId:string}):void ;
  connectObjects(objectA: string, connectionA: ConnectionPoint, objectB: string, connectionB: ConnectionPoint, formatting?:{numberOfPoints: number,startArrowHead:string,endArrowHead:string, padding: number}):void;
  toClipboard(templatePath?:string): void;
  create(params?:{filename: string, foldername:string, templatePath:string, onNewPane: boolean}):Promise<void>;
  createSVG(templatePath?:string):Promise<SVGSVGElement>;
  createPNG(templatePath?:string):Promise<any>;
  wrapText(text:string, lineLen:number):string;
  clear(): void;
  reset(): void;
  isExcalidrawFile(f:TFile): boolean;  
};
```