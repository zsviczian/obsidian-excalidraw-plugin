import ExcalidrawPlugin from "./main";
import { 
  ExcalidrawElement,
  FillStyle,
  StrokeStyle,
  StrokeSharpness,
  FontFamily,
} from "@excalidraw/excalidraw/types/element/types";
import {nanoid} from "nanoid";
import {
  normalizePath,
  parseFrontMatterAliases,
  TFile
} from "obsidian"

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
    setFillStyle: Function;
    setStrokeStyle: Function;
    setStrokeSharpness: Function;
    setFontFamily: Function;
    setTheme: Function;
    create: Function;
    addRect: Function;
    addDiamond: Function;
    addEllipse: Function;
    addText: Function;
    addLine: Function;
    addArrow: Function;
    connectObjects: Function;
    clear: Function;
    reset: Function;
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
          this.canvas = "dark";
          return "dark";
      }      
    },
    async create(filename?: string, foldername?:string, templatePath?:string, onNewPane: boolean = false) {
      let elements = templatePath ? (await getTemplate(templatePath)).elements : [];
      for (let i=0;i<this.elementIds.length;i++) {
        elements.push(this.elementsDict[this.elementIds[i]]);
      }
      plugin.createDrawing(
        filename ? filename + '.excalidraw' : this.plugin.getNextDefaultFilename(),
        onNewPane,
        foldername ? foldername : this.plugin.settings.folder,
        (()=>{
          return JSON.stringify({
            "type": "excalidraw",
            "version": 2,
            "source": "https://excalidraw.com",
            "elements": elements,
            "appState": {
              "theme": this.canvas.theme,
              "viewBackgroundColor": this.canvas.viewBackgroundColor
            }
          });
      })());  
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
    async addText(topX:number, topY:number, text:string, width?:number, height?:number,textAlign?: string, verticalAlign?:string):Promise<string> {
      const id = nanoid();    
      const {w, h, baseline} = await measureText(text);
      this.elementIds.push(id);
      this.elementsDict[id] = {
        text: text,
        fontSize: window.ExcalidrawAutomate.style.fontSize,
        fontFamily: window.ExcalidrawAutomate.style.fontFamily,
        textAlign: textAlign ? textAlign : window.ExcalidrawAutomate.style.textAlign,
        verticalAlign: verticalAlign ? verticalAlign : window.ExcalidrawAutomate.style.verticalAlign,
        baseline: baseline,
        ... boxedElement(id,"text",topX,topY,width ? width:w, height ? height:h)
      };
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
    addArrow(points: [[x:number,y:number]],startArrowHead?:string,endArrowHead?:string,startBinding?:string,endBinding?:string):void {
      const box = getLineBox(points);
      const id = nanoid();
      this.elementIds.push(id);
      this.elementsDict[id] = {
        points: normalizeLinePoints(points),
        lastCommittedPoint: null,
        startBinding: {elementId:startBinding,focus:0.1,gap:4},
        endBinding: {elementId:endBinding,focus:0.1,gap:4},
        startArrowhead: startArrowHead ? startArrowHead : this.style.startArrowHead,
        endArrowhead: endArrowHead ? endArrowHead : this.style.endArrowHead,
        ... boxedElement(id,"arrow",box.x,box.y,box.w,box.h)
      };
      if(startBinding) this.elementsDict[startBinding].boundElementIds.push(id);
      if(endBinding) this.elementsDict[endBinding].boundElementIds.push(id);
    },
    connectObjects(objectA: string, connectionA: ConnectionPoint, objectB: string, connectionB: ConnectionPoint, numberOfPoints: number = 1,startArrowHead?:string,endArrowHead?:string):void {
      if(!(this.elementsDict[objectA] && this.elementsDict[objectB])) {
        return;
      }
      const getSidePoints = (side:string, el:any) => {
        switch(side) {
          case "bottom": 
            return [((el.x) + (el.x+el.width))/2, el.y+el.height];
          case "left": 
            return [el.x, ((el.y) + (el.y+el.height))/2];
          case "right": 
            return [el.x+el.width, ((el.y) + (el.y+el.height))/2];
          default: //"top"
            return [((el.x) + (el.x+el.width))/2, el.y];
        }
      }
      const [aX, aY] = getSidePoints(connectionA,this.elementsDict[objectA]);
      const [bX, bY] = getSidePoints(connectionB,this.elementsDict[objectB]);
      const numAP = numberOfPoints+2; //number of break points plus the beginning and the end
      let points = [];
      for(let i=0;i<numAP;i++)
        points.push([aX+i*(bX-aX)/(numAP-1), aY+i*(bY-aY)/(numAP-1)]);
      this.addArrow(points,startArrowHead,endArrowHead,objectA,objectB);
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
  }
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
  let leftX:number,rightX:number = points[0][0];
  let topY:number,bottomY:number = points[0][1];
  for (let i=0;i<points.length;i++) {
    leftX = (leftX < points[i][0]) ? leftX : points[i][0];
    topY = (topY < points[i][1]) ? topY : points[i][1];
    rightX = (rightX > points[i][0]) ? rightX : points[i][0];
    bottomY = (bottomY > points[i][1]) ? bottomY : points[i][1];
  }
  return {
    x: leftX,
    y: topY,
    w: rightX-leftX,
    h: bottomY-topY
  };
}

function getFontFamily(id:number) {
  switch (id) {
    case 1: return "Virgil, Segoe UI Emoji";
    case 2: return "Helvetica, Segoe UI Emoji";
    case 3: return "Cascadia, Segoe UI Emoji"; 
  }
}

async function measureText (newText:string) {
  const line = document.createElement("div");
  const body = document.body;
  line.style.position = "absolute";
  line.style.whiteSpace = "pre";
  line.style.font = window.ExcalidrawAutomate.style.fontSize.toString()+'px ' +
                    getFontFamily(window.ExcalidrawAutomate.style.fontFamily);
  await (document as any).fonts.load(line.style.font);
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
    const excalidrawData = JSON.parse(data);
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
