import ExcalidrawPlugin from "./main";
import { 
  ExcalidrawElement,
  FillStyle,
  StrokeStyle,
  StrokeSharpness,
  FontFamily,
} from "@excalidraw/excalidraw/types/element/types";
import {
  normalizePath,
  TFile
} from "obsidian"
import ExcalidrawView from "./ExcalidrawView";
import { getJSON } from "./ExcalidrawData";
import { nanoid } from "./constants";

declare type ConnectionPoint = "top"|"bottom"|"left"|"right";

export interface ExcalidrawAutomate extends Window {
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
      fontFamily: FontFamily;
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
    toClipboard(templatePath?:string): void;
    create(params?:{filename: string, foldername:string, templatePath:string, onNewPane: boolean}):Promise<void>;
    createSVG(templatePath?:string):Promise<SVGSVGElement>;
    createPNG(templatePath?:string):Promise<any>;
    addRect(topX:number, topY:number, width:number, height:number):string;
    addDiamond(topX:number, topY:number, width:number, height:number):string;
    addEllipse(topX:number, topY:number, width:number, height:number):string;
    addText(topX:number, topY:number, text:string, formatting?:{width:number, height:number,textAlign: string, verticalAlign:string, box: boolean, boxPadding: number}):string;
    addLine(points: [[x:number,y:number]]):void;
    addArrow(points: [[x:number,y:number]],formatting?:{startArrowHead:string,endArrowHead:string,startObjectId:string,endObjectId:string}):void ;
    connectObjects(objectA: string, connectionA: ConnectionPoint, objectB: string, connectionB: ConnectionPoint, formatting?:{numberOfPoints: number,startArrowHead:string,endArrowHead:string, padding: number}):void;
    clear(): void;
    reset(): void;
    isExcalidrawFile(f:TFile): boolean;  
  };
}

declare let window: ExcalidrawAutomate;

export function initExcalidrawAutomate(plugin: ExcalidrawPlugin) {
  window.ExcalidrawAutomate = {
    plugin: plugin,
    elementIds: [],
    elementsDict: {},
    style: {
      strokeColor: "#000000",
      backgroundColor: "transparent",
      angle: 0,
      fillStyle: "hachure",
      strokeWidth:1,
      storkeStyle: "solid",
      roughness: 1,
      opacity: 100,
      strokeSharpness: "sharp",
      fontFamily: 1,
      fontSize: 20,
      textAlign: "left",
      verticalAlign: "top",
      startArrowHead: null,
      endArrowHead: "arrow"
    },
    canvas: {theme: "light", viewBackgroundColor: "#FFFFFF"},
    setFillStyle (val:number) {
      switch(val) {
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
    setStrokeStyle (val:number) {
      switch(val) {
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
    setStrokeSharpness (val:number) {
      switch(val) {
        case 0: 
          this.style.strokeSharpness = "round";
          return "round";
        default:
          this.style.strokeSharpness = "sharp";
          return "sharp";
      }
    },
    setFontFamily (val:number) {
      switch(val) {
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
    setTheme (val:number) {
      switch(val) {
        case 0: 
          this.canvas.theme = "light";
          return "light";
        default:
          this.canvas.theme = "dark";
          return "dark";
      }      
    },
    addToGroup(objectIds:[]):void {
      const id = nanoid();
      objectIds.forEach((objectId)=>{
        this.elementsDict[objectId]?.groupIds?.push(id);
      });
    },
    async toClipboard(templatePath?:string) {
      const template = templatePath ? (await getTemplate(templatePath)) : null;
      let elements = template ? template.elements : [];
      for (let i=0;i<this.elementIds.length;i++) {
        elements.push(this.elementsDict[this.elementIds[i]]);
      }
      navigator.clipboard.writeText(
        JSON.stringify({
          "type":"excalidraw/clipboard",
          "elements": elements,
      }));
    },
    async create(params?:{filename: string, foldername:string, templatePath:string, onNewPane: boolean}) {
      const template = params?.templatePath ? (await getTemplate(params.templatePath)) : null;
      let elements = template ? template.elements : [];
      for (let i=0;i<this.elementIds.length;i++) {
        elements.push(this.elementsDict[this.elementIds[i]]);
      }
      plugin.createDrawing(
        params?.filename ? params.filename + '.excalidraw' : this.plugin.getNextDefaultFilename(),
        params?.onNewPane ? params.onNewPane : false,
        params?.foldername ? params.foldername : this.plugin.settings.folder,
        JSON.stringify({
          type: "excalidraw",
          version: 2,
          source: "https://excalidraw.com",
          elements: elements,
          appState: {
            theme: template ? template.appState.theme : this.canvas.theme,
            viewBackgroundColor: template? template.appState.viewBackgroundColor : this.canvas.viewBackgroundColor,
            currentItemStrokeColor: template? template.appState.currentItemStrokeColor : this.style.strokeColor,
            currentItemBackgroundColor: template? template.appState.currentItemBackgroundColor : this.style.backgroundColor,
            currentItemFillStyle: template? template.appState.currentItemFillStyle : this.style.fillStyle,
            currentItemStrokeWidth: template? template.appState.currentItemStrokeWidth : this.style.strokeWidth,
            currentItemStrokeStyle: template? template.appState.currentItemStrokeStyle : this.style.strokeStyle,
            currentItemRoughness: template? template.appState.currentItemRoughness : this.style.roughness,
            currentItemOpacity: template? template.appState.currentItemOpacity : this.style.opacity,
            currentItemFontFamily: template? template.appState.currentItemFontFamily : this.style.fontFamily,
            currentItemFontSize: template? template.appState.currentItemFontSize : this.style.fontSize,
            currentItemTextAlign: template? template.appState.currentItemTextAlign : this.style.textAlign,
            currentItemStrokeSharpness: template? template.appState.currentItemStrokeSharpness : this.style.strokeSharpness,
            currentItemStartArrowhead: template? template.appState.currentItemStartArrowhead: this.style.startArrowHead,
            currentItemEndArrowhead: template? template.appState.currentItemEndArrowhead : this.style.endArrowHead,
            currentItemLinearStrokeSharpness: template? template.appState.currentItemLinearStrokeSharpness : this.style.strokeSharpness,
          }
        })
      );  
    },
    async createSVG(templatePath?:string):Promise<SVGSVGElement> {
      const template = templatePath ? (await getTemplate(templatePath)) : null;
      let elements = template ? template.elements : [];
      for (let i=0;i<this.elementIds.length;i++) {
        elements.push(this.elementsDict[this.elementIds[i]]);
      }
      return ExcalidrawView.getSVG(
        JSON.stringify({
          "type": "excalidraw",
          "version": 2,
          "source": "https://excalidraw.com",
          "elements": elements,
          "appState": {
            "theme": template ? template.appState.theme : this.canvas.theme,
            "viewBackgroundColor": template? template.appState.viewBackgroundColor : this.canvas.viewBackgroundColor
          }
        }),
        {
          withBackground: plugin.settings.exportWithBackground, 
          withTheme: plugin.settings.exportWithTheme
        }
      )     
    },
    async createPNG(templatePath?:string) {
      const template = templatePath ? (await getTemplate(templatePath)) : null;
      let elements = template ? template.elements : [];
      for (let i=0;i<this.elementIds.length;i++) {
        elements.push(this.elementsDict[this.elementIds[i]]);
      }
      return ExcalidrawView.getPNG(
        JSON.stringify({
          "type": "excalidraw",
          "version": 2,
          "source": "https://excalidraw.com",
          "elements": elements,
          "appState": {
            "theme": template ? template.appState.theme : this.canvas.theme,
            "viewBackgroundColor": template? template.appState.viewBackgroundColor : this.canvas.viewBackgroundColor
          }
        }),
        {
          withBackground: plugin.settings.exportWithBackground, 
          withTheme: plugin.settings.exportWithTheme
        }
      )  
    },
    addRect(topX:number, topY:number, width:number, height:number):string {
      const id = nanoid();
      this.elementIds.push(id);
      this.elementsDict[id] = boxedElement(id,"rectangle",topX,topY,width,height);
      return id;
    },
    addDiamond(topX:number, topY:number, width:number, height:number):string {
      const id = nanoid();
      this.elementIds.push(id);
      this.elementsDict[id] = boxedElement(id,"diamond",topX,topY,width,height);
      return id;
    },
    addEllipse(topX:number, topY:number, width:number, height:number):string {
      const id = nanoid();
      this.elementIds.push(id);
      this.elementsDict[id] = boxedElement(id,"ellipse",topX,topY,width,height);
      return id;
    },
    addText(topX:number, topY:number, text:string, formatting?:{width:number, height:number,textAlign: string, verticalAlign:string, box: boolean, boxPadding: number}):string {
      const id = nanoid();    
      const {w, h, baseline} = measureText(text, this.style.fontSize,this.style.fontFamily);
      const width = formatting?.width ? formatting.width : w;
      const height = formatting?.height ? formatting.height : h;
      this.elementIds.push(id);
      this.elementsDict[id] = {
        text: text,
        fontSize: window.ExcalidrawAutomate.style.fontSize,
        fontFamily: window.ExcalidrawAutomate.style.fontFamily,
        textAlign: formatting?.textAlign ? formatting.textAlign : window.ExcalidrawAutomate.style.textAlign,
        verticalAlign: formatting?.verticalAlign ? formatting.verticalAlign : window.ExcalidrawAutomate.style.verticalAlign,
        baseline: baseline,
        ... boxedElement(id,"text",topX,topY,width,height)
      };
      if(formatting?.box) {
        const boxPadding = formatting?.boxPadding ? formatting.boxPadding : 10;
        const boxId = this.addRect(topX-boxPadding,topY-boxPadding,width+2*boxPadding,height+2*boxPadding);
        this.addToGroup([id,boxId])
        return boxId; 
      }
      return id;
    },
    addLine(points: [[x:number,y:number]]):void {
      const box = getLineBox(points);
      const id = nanoid();
      this.elementIds.push(id);
      this.elementsDict[id] = {
        points: normalizeLinePoints(points),
        lastCommittedPoint: null,
        startBinding: null,
        endBinding: null,
        startArrowhead: null,
        endArrowhead: null,
        ... boxedElement(id,"line",box.x,box.y,box.w,box.h)
      };
    },
    addArrow(points: [[x:number,y:number]],formatting?:{startArrowHead:string,endArrowHead:string,startObjectId:string,endObjectId:string}):void {
      const box = getLineBox(points);
      const id = nanoid();
      this.elementIds.push(id);
      this.elementsDict[id] = {
        points: normalizeLinePoints(points),
        lastCommittedPoint: null,
        startBinding: {elementId:formatting?.startObjectId,focus:0.1,gap:4},
        endBinding: {elementId:formatting?.endObjectId,focus:0.1,gap:4},
        startArrowhead: formatting?.startArrowHead ? formatting.startArrowHead : this.style.startArrowHead,
        endArrowhead: formatting?.endArrowHead ? formatting.endArrowHead : this.style.endArrowHead,
        ... boxedElement(id,"arrow",box.x,box.y,box.w,box.h)
      };
      if(formatting?.startObjectId) this.elementsDict[formatting.startObjectId].boundElementIds.push(id);
      if(formatting?.endObjectId) this.elementsDict[formatting.endObjectId].boundElementIds.push(id);
    },
    connectObjects(objectA: string, connectionA: ConnectionPoint, objectB: string, connectionB: ConnectionPoint, formatting?:{numberOfPoints: number,startArrowHead:string,endArrowHead:string, padding: number}):void {
      if(!(this.elementsDict[objectA] && this.elementsDict[objectB])) {
        return;
      }
      const padding = formatting?.padding ? formatting.padding : 10;
      const numberOfPoints = formatting?.numberOfPoints ? formatting.numberOfPoints : 0;
      const getSidePoints = (side:string, el:any) => {
        switch(side) {
          case "bottom": 
            return [((el.x) + (el.x+el.width))/2, el.y+el.height+padding];
          case "left": 
            return [el.x-padding, ((el.y) + (el.y+el.height))/2];
          case "right": 
            return [el.x+el.width+padding, ((el.y) + (el.y+el.height))/2];
          default: //"top"
            return [((el.x) + (el.x+el.width))/2, el.y-padding];
        }
      }
      const [aX, aY] = getSidePoints(connectionA,this.elementsDict[objectA]);
      const [bX, bY] = getSidePoints(connectionB,this.elementsDict[objectB]);
      const numAP = numberOfPoints+2; //number of break points plus the beginning and the end
      let points = [];
      for(let i=0;i<numAP;i++)
        points.push([aX+i*(bX-aX)/(numAP-1), aY+i*(bY-aY)/(numAP-1)]);
      this.addArrow(points,{ 
        startArrowHead: formatting?.startArrowHead,
        endArrowHead: formatting?.endArrowHead,
        startObjectId: objectA, 
        endObjectId: objectB
      });
    },
    clear() {
      this.elementIds = [];
      this.elementsDict = {};
    },
    reset() {
      this.clear();
      this.style.strokeColor= "#000000";
      this.style.backgroundColor= "transparent";
      this.style.angle= 0;
      this.style.fillStyle= "hachure";
      this.style.strokeWidth= 1;
      this.style.storkeStyle= "solid";
      this.style.roughness= 1;
      this.style.opacity= 100;
      this.style.strokeSharpness= "sharp";
      this.style.fontFamily= 1;
      this.style.fontSize= 20;
      this.style.textAlign= "left";
      this.style.verticalAlign= "top";
      this.style.startArrowHead= null;
      this.style.endArrowHead= "arrow";
      this.canvas.theme = "light";
      this.canvas.viewBackgroundColor="#FFFFFF";
    },
    isExcalidrawFile(f:TFile) {
      return this.plugin.isExcalidrawFile(f);
    }
  
  };
  initFonts();
}

export function destroyExcalidrawAutomate() {
  delete window.ExcalidrawAutomate;
}

function normalizeLinePoints(points:[[x:number,y:number]]) {
  let p = [];
  for(let i=0;i<points.length;i++) {
    p.push([points[i][0]-points[0][0], points[i][1]-points[0][1]]);
  }
  return p;
}

function boxedElement(id:string,eltype:any,x:number,y:number,w:number,h:number) {
  return {
    id: id,
    type: eltype,
    x: x,
    y: y,
    width: w,
    height: h, 
    angle: window.ExcalidrawAutomate.style.angle,
    strokeColor: window.ExcalidrawAutomate.style.strokeColor,
    backgroundColor: window.ExcalidrawAutomate.style.backgroundColor,
    fillStyle: window.ExcalidrawAutomate.style.fillStyle,
    strokeWidth: window.ExcalidrawAutomate.style.strokeWidth,
    storkeStyle: window.ExcalidrawAutomate.style.storkeStyle,
    roughness: window.ExcalidrawAutomate.style.roughness,
    opacity: window.ExcalidrawAutomate.style.opacity,
    strokeSharpness: window.ExcalidrawAutomate.style.strokeSharpness,
    seed: Math.floor(Math.random() * 100000),
    version: 1,
    versionNounce: 1,
    isDeleted: false,
    groupIds: [] as any,
    boundElementIds: [] as any,
  };
}

function getLineBox(points: [[x:number,y:number]]) {
  return {
    x: points[0][0],
    y: points[0][1],
    w: Math.abs(points[points.length-1][0]-points[0][0]),
    h: Math.abs(points[points.length-1][1]-points[0][1])
  }
}

function getFontFamily(id:number) {
  switch (id) {
    case 1: return "Virgil, Segoe UI Emoji";
    case 2: return "Helvetica, Segoe UI Emoji";
    case 3: return "Cascadia, Segoe UI Emoji"; 
  }
}

async function initFonts () {
  for (let i=0;i<3;i++) {
    await (document as any).fonts.load(
      window.ExcalidrawAutomate.style.fontSize.toString()+'px ' +
      getFontFamily(window.ExcalidrawAutomate.style.fontFamily)
    );
  }
}

export function measureText (newText:string, fontSize:number, fontFamily:number) {
  const line = document.createElement("div");
  const body = document.body;
  line.style.position = "absolute";
  line.style.whiteSpace = "pre";
  line.style.font = fontSize.toString()+'px ' + getFontFamily(fontFamily);
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
  return {w: width, h: height, baseline: baseline };
};

async function getTemplate(fileWithPath: string):Promise<{elements: any,appState: any}> {
  const vault = window.ExcalidrawAutomate.plugin.app.vault;
  const file = vault.getAbstractFileByPath(normalizePath(fileWithPath));
  if(file && file instanceof TFile) {
    const data = await vault.read(file);
    const excalidrawData = JSON.parse(getJSON(data));
    return {
      elements: excalidrawData.elements,
      appState: excalidrawData.appState,  
    };
  };
  return {
    elements: [],
    appState: {},
  }
}
