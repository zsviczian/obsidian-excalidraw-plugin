import ExcalidrawPlugin from "./main";
import { 
  FillStyle,
  StrokeStyle,
  StrokeSharpness,
  ExcalidrawElement,
} from "@zsviczian/excalidraw/types/element/types";
import {
  normalizePath,
  TFile
} from "obsidian"
import ExcalidrawView from "./ExcalidrawView";
import { getJSON } from "./ExcalidrawData";
import { 
  FRONTMATTER, 
  nanoid, 
  JSON_parse, 
  VIEW_TYPE_EXCALIDRAW
} from "./constants";
import { wrapText } from "./Utils";

declare type ConnectionPoint = "top"|"bottom"|"left"|"right";

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
    canvas: {theme: string, viewBackgroundColor: string, gridSize: number};
    setFillStyle(val:number): void;
    setStrokeStyle(val:number): void;
    setStrokeSharpness(val:number): void;
    setFontFamily(val:number): void;
    setTheme(val:number): void;
    addToGroup(objectIds:[]):string;
    toClipboard(templatePath?:string): void;
    getElements():ExcalidrawElement[];
    getElement(id:string):ExcalidrawElement;
    create(params?:{filename?: string, foldername?:string, templatePath?:string, onNewPane?: boolean}):Promise<void>;
    createSVG(templatePath?:string):Promise<SVGSVGElement>;
    createPNG(templatePath?:string):Promise<any>;
    wrapText(text:string, lineLen:number):string;
    addRect(topX:number, topY:number, width:number, height:number):string;
    addDiamond(topX:number, topY:number, width:number, height:number):string;
    addEllipse(topX:number, topY:number, width:number, height:number):string;
    addBlob(topX:number, topY:number, width:number, height:number):string;
    addText(topX:number, topY:number, text:string, formatting?:{wrapAt?:number, width?:number, height?:number,textAlign?: string, verticalAlign?:string, box?: boolean, boxPadding?: number},id?:string):string;
    addLine(points: [[x:number,y:number]]):string;
    addArrow(points: [[x:number,y:number]],formatting?:{startArrowHead?:string,endArrowHead?:string,startObjectId?:string,endObjectId?:string}):string ;
    connectObjects(objectA: string, connectionA: ConnectionPoint, objectB: string, connectionB: ConnectionPoint, formatting?:{numberOfPoints?: number,startArrowHead?:string,endArrowHead?:string, padding?: number}):void;
    clear(): void;
    reset(): void;
    isExcalidrawFile(f:TFile): boolean;  
    //view manipulation
    targetView: ExcalidrawView;
    setView(view:ExcalidrawView|"first"|"active"):ExcalidrawView;
    getExcalidrawAPI():any;
    getViewSelectedElement():ExcalidrawElement;
    getViewSelectedElements():ExcalidrawElement[];
    viewToggleFullScreen(forceViewMode?:boolean):void;
    connectObjectWithViewSelectedElement(objectA:string,connectionA: ConnectionPoint, connectionB: ConnectionPoint, formatting?:{numberOfPoints?: number,startArrowHead?:string,endArrowHead?:string, padding?: number}):boolean;
    addElementsToView(repositionToCursor:boolean, save:boolean):Promise<boolean>;
  };
}

declare let window: ExcalidrawAutomate;

export async function initExcalidrawAutomate(plugin: ExcalidrawPlugin) {
  window.ExcalidrawAutomate = {
    plugin: plugin,
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
      endArrowHead: "arrow",
    },
    canvas: {theme: "light", viewBackgroundColor: "#FFFFFF", gridSize: 0},
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
    addToGroup(objectIds:[]):string {
      const id = nanoid();
      objectIds.forEach((objectId)=>{
        this.elementsDict[objectId]?.groupIds?.push(id);
      });
      return id;
    },
    async toClipboard(templatePath?:string) {
      const template = templatePath ? (await getTemplate(templatePath)) : null;
      let elements = template ? template.elements : [];
      elements.concat(this.getElements());
      navigator.clipboard.writeText(
        JSON.stringify({
          "type":"excalidraw/clipboard",
          "elements": elements,
      }));
    },
    getElements():ExcalidrawElement[] {
      let elements=[];
      const elementIds = Object.keys(this.elementsDict);
      for (let i=0;i<elementIds.length;i++) {
        elements.push(this.elementsDict[elementIds[i]]);
      }
      return elements;
    },
    getElement(id:string):ExcalidrawElement {
      return this.elementsDict[id];
    },
    async create(params?:{filename?: string, foldername?:string, templatePath?:string, onNewPane?: boolean}) {
      const template = params?.templatePath ? (await getTemplate(params.templatePath)) : null;
      let elements = template ? template.elements : [];
      elements = elements.concat(this.getElements());
      plugin.createDrawing(
        params?.filename ? params.filename + '.excalidraw.md' : this.plugin.getNextDefaultFilename(),
        params?.onNewPane ? params.onNewPane : false,
        params?.foldername ? params.foldername : this.plugin.settings.folder,
        FRONTMATTER + plugin.exportSceneToMD(
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
            gridSize: template ? template.appState.gridSize : this.canvas.gridSize
          }
        }))
      );  
    },
    async createSVG(templatePath?:string):Promise<SVGSVGElement> {
      const template = templatePath ? (await getTemplate(templatePath)) : null;
      let elements = template ? template.elements : [];
      elements.concat(this.getElements());
      return await ExcalidrawView.getSVG(
        {//createDrawing
          "type": "excalidraw",
          "version": 2,
          "source": "https://excalidraw.com",
          "elements": elements,
          "appState": {
            "theme": template ? template.appState.theme : this.canvas.theme,
            "viewBackgroundColor": template? template.appState.viewBackgroundColor : this.canvas.viewBackgroundColor
          }
        },//),
        {
          withBackground: plugin.settings.exportWithBackground, 
          withTheme: plugin.settings.exportWithTheme
        }
      )     
    },
    async createPNG(templatePath?:string, scale:number=1) {
      const template = templatePath ? (await getTemplate(templatePath)) : null;
      let elements = template ? template.elements : [];
      elements.concat(this.getElements());
      return ExcalidrawView.getPNG(
        { 
          "type": "excalidraw",
          "version": 2,
          "source": "https://excalidraw.com",
          "elements": elements,
          "appState": {
            "theme": template ? template.appState.theme : this.canvas.theme,
            "viewBackgroundColor": template? template.appState.viewBackgroundColor : this.canvas.viewBackgroundColor
          }
        },
        {
          withBackground: plugin.settings.exportWithBackground, 
          withTheme: plugin.settings.exportWithTheme
        },
        scale
      )  
    },
    wrapText(text:string, lineLen:number):string {
      return wrapText(text,lineLen,this.plugin.settings.forceWrap);
    },
    addRect(topX:number, topY:number, width:number, height:number):string {
      const id = nanoid();
      this.elementsDict[id] = boxedElement(id,"rectangle",topX,topY,width,height);
      return id;
    },
    addDiamond(topX:number, topY:number, width:number, height:number):string {
      const id = nanoid();
      this.elementsDict[id] = boxedElement(id,"diamond",topX,topY,width,height);
      return id;
    },
    addEllipse(topX:number, topY:number, width:number, height:number):string {
      const id = nanoid();
      this.elementsDict[id] = boxedElement(id,"ellipse",topX,topY,width,height);
      return id;
    }, 
    addBlob(topX:number, topY:number, width:number, height:number):string {
      const b = height*0.5; //minor axis of the ellipsis
      const a = width*0.5; //major axis of the ellipsis
      const sx = a/9; 
      const sy = b*0.8;
      const step = 6;
      let p:any = [];
      const pushPoint = (i:number,dir:number) => {
          const x = i + Math.random()*sx-sx/2;
          p.push([x+Math.random()*sx-sx/2+(i%2)*sx/6+topX,dir*Math.sqrt(b*b*(1-(x*x)/(a*a)))+Math.random()*sy-sy/2+(i%2)*sy/6+topY]);
      }
      let i:number;
      for (i=-a+sx/2;i<=a-sx/2;i+=a/step) {
        pushPoint(i,1);
      }
      for(i=a-sx/2;i>=-a+sx/2;i-=a/step) {
        pushPoint(i,-1);
      }
      p.push(p[0]);
      const scale = (p:[[x:number,y:number]]):[[x:number,y:number]] => {
        const box = getLineBox(p);
        const scaleX = width/box.w;
        const scaleY = height/box.h;
        let i;
        for(i=0;i<p.length;i++) {
          let [x,y] = p[i];
          x = (x-box.x)*scaleX+box.x;
          y = (y-box.y)*scaleY+box.y;
          p[i]=[x,y]
        }
        return p;
      }
      const id=this.addLine(scale(p));
      this.elementsDict[id]=repositionElementsToCursor([this.getElement(id)],{x:topX,y:topY},false)[0];
      return id;
    }, 
    addText( 
      topX:number, 
      topY:number, 
      text:string, 
      formatting?:{
        wrapAt?:number, 
        width?:number, 
        height?:number,
        textAlign?:string, 
        verticalAlign?:string, 
        box?: boolean|"box"|"blob"|"ellipse"|"diamond", 
        boxPadding?:number
      },
      id?:string
    ):string {
      id = id ?? nanoid();
      text = (formatting?.wrapAt) ? this.wrapText(text,formatting.wrapAt):text;
      const {w, h, baseline} = measureText(text, this.style.fontSize,this.style.fontFamily);
      const width = formatting?.width ? formatting.width : w;
      const height = formatting?.height ? formatting.height : h;
      
      let boxId:string = null;
      const boxPadding = formatting?.boxPadding ?? 10;
      if(formatting?.box) {
        switch(formatting?.box) {
          case true || "box": 
            boxId = this.addRect(topX-boxPadding,topY-boxPadding,width+2*boxPadding,height+2*boxPadding);
            break;
          case "ellipse":
            boxId = this.addEllipse(topX-boxPadding,topY-boxPadding,width+2*boxPadding,height+2*boxPadding);
            break;
          case "diamond":
            boxId = this.addDiamond(topX-boxPadding,topY-boxPadding,width+2*boxPadding,height+2*boxPadding);
            break;
          case "blob":
            boxId = this.addBlob(topX-boxPadding,topY-boxPadding,width+2*boxPadding,height+2*boxPadding);
            break;
        }       
      }
      this.elementsDict[id] = {
        text: text,
        fontSize: window.ExcalidrawAutomate.style.fontSize,
        fontFamily: window.ExcalidrawAutomate.style.fontFamily,
        textAlign: formatting?.textAlign ? formatting.textAlign : window.ExcalidrawAutomate.style.textAlign,
        verticalAlign: formatting?.verticalAlign ? formatting.verticalAlign : window.ExcalidrawAutomate.style.verticalAlign,
        baseline: baseline,
        ... boxedElement(id,"text",topX,topY,width,height)
      };
      if (boxId) this.addToGroup([id,boxId])
      return boxId ?? id;
    },
    addLine(points: [[x:number,y:number]]):string {
      const box = getLineBox(points);
      const id = nanoid();
      //this.elementIds.push(id);
      this.elementsDict[id] = {
        points: normalizeLinePoints(points,box),
        lastCommittedPoint: null,
        startBinding: null,
        endBinding: null,
        startArrowhead: null,
        endArrowhead: null,
        ... boxedElement(id,"line",box.x,box.y,box.w,box.h)
      };
      return id;
    },
    addArrow(points: [[x:number,y:number]],formatting?:{startArrowHead?:string,endArrowHead?:string,startObjectId?:string,endObjectId?:string}):string {
      const box = getLineBox(points);
      const id = nanoid();
      //this.elementIds.push(id);
      this.elementsDict[id] = {
        points: normalizeLinePoints(points,box),
        lastCommittedPoint: null,
        startBinding: {elementId:formatting?.startObjectId,focus:0.1,gap:4},
        endBinding: {elementId:formatting?.endObjectId,focus:0.1,gap:4},
        startArrowhead: formatting?.startArrowHead ? formatting.startArrowHead : this.style.startArrowHead,
        endArrowhead: formatting?.endArrowHead ? formatting.endArrowHead : this.style.endArrowHead,
        ... boxedElement(id,"arrow",box.x,box.y,box.w,box.h)
      };
      if(formatting?.startObjectId) {
        if(!this.elementsDict[formatting.startObjectId].boundElementIds) this.elementsDict[formatting.startObjectId].boundElementIds = [];
        this.elementsDict[formatting.startObjectId].boundElementIds.push(id);
      }
      if(formatting?.endObjectId) {
        if(!this.elementsDict[formatting.endObjectId].boundElementIds) this.elementsDict[formatting.endObjectId].boundElementIds = [];
        this.elementsDict[formatting.endObjectId].boundElementIds.push(id);
      }
      return id;
    },
    connectObjects(objectA: string, connectionA: ConnectionPoint, objectB: string, connectionB: ConnectionPoint, formatting?:{numberOfPoints?: number,startArrowHead?:string,endArrowHead?:string, padding?: number}):void {
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
      this.canvas.gridSize = 0;
    },
    isExcalidrawFile(f:TFile):boolean {
      return this.plugin.isExcalidrawFile(f);
    },
    targetView: null,
    setView(view:ExcalidrawView|"first"|"active"):ExcalidrawView {
      if(view == "active") {
        const v = this.plugin.app.workspace.activeLeaf.view;
        if(!(v instanceof ExcalidrawView)) return;
        this.targetView = v;
      }
      if(view == "first") {
        const leaves = this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);
        if(!leaves || leaves.length == 0) return;
        this.targetView = (leaves[0].view as ExcalidrawView);
      }
      if(view instanceof ExcalidrawView) this.targetView = view;
      return this.targetView;
    },
    getExcalidrawAPI():any {
      if (!this.targetView || !this.targetView?._loaded) {
        errorMessage("targetView not set", "getExcalidrawAPI()");
        return null;
      }
      return (this.targetView as ExcalidrawView).excalidrawRef.current;
    },
    getViewSelectedElement():any {      
      const elements = this.getViewSelectedElements();
      return elements ? elements[0] : null;
    },
    getViewSelectedElements():any[] {
      if (!this.targetView || !this.targetView?._loaded) {
        errorMessage("targetView not set", "getViewSelectedElements()");
        return [];
      }
      const current = this.targetView?.excalidrawRef?.current;
      const selectedElements = current?.getAppState()?.selectedElementIds;
      if(!selectedElements) return [];
      const selectedElementsKeys = Object.keys(selectedElements);
      if(!selectedElementsKeys) return [];     
      return current.getSceneElements().filter((e:any)=>selectedElementsKeys.includes(e.id));
    },
    viewToggleFullScreen(forceViewMode:boolean = false):void {
      if (this.plugin.app.isMobile) {
        errorMessage("mobile not supported", "viewToggleFullScreen()");
        return;
      }
      if (!this.targetView || !this.targetView?._loaded) {
        errorMessage("targetView not set", "viewToggleFullScreen()");
        return;
      }
      if(forceViewMode){
        const ref = this.getExcalidrawAPI();
        ref.updateScene({
          elements: ref.getSceneElements(),
          appState: { 
            viewModeEnabled: true,
            ...  ref.appState, 
          },
          commitToHistory: false,
        });
      } 
      if(document.fullscreenElement === (this.targetView as ExcalidrawView).contentEl) {
        document.exitFullscreen();
      } else {
        (this.targetView as ExcalidrawView).contentEl.requestFullscreen();
      }
    },
    connectObjectWithViewSelectedElement(objectA:string,connectionA: ConnectionPoint, connectionB: ConnectionPoint, formatting?:{numberOfPoints?: number,startArrowHead?:string,endArrowHead?:string, padding?: number}):boolean {
      const el = this.getViewSelectedElement();
      if(!el) return false;
      const id = el.id;
      this.elementsDict[id] = el;
      this.connectObjects(objectA,connectionA,id,connectionB,formatting);
      delete this.elementsDict[id];
      return true;
    },
    async addElementsToView(repositionToCursor:boolean = false, save:boolean=false):Promise<boolean> {
      if (!this.targetView || !this.targetView?._loaded) {
        errorMessage("targetView not set", "addElementsToView()");
        return false;
      }
      const elements = this.getElements();
      return await this.targetView.addElements(elements,repositionToCursor,save);
    },
  
  };
  await initFonts();
}

export function destroyExcalidrawAutomate() {
  delete window.ExcalidrawAutomate;
}

function normalizeLinePoints(points:[[x:number,y:number]],box:{x:number,y:number,w:number,h:number}) {
  let p = [];
  for(let i=0;i<points.length;i++) {
    p.push([points[i][0]-box.x, points[i][1]-box.y]);
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
  const [x1,y1,x2,y2] = estimateLineBound(points);
  return {
    x: x1,
    y: y1,
    w: x2-x1, //Math.abs(points[points.length-1][0]-points[0][0]),
    h: y2-y1  //Math.abs(points[points.length-1][1]-points[0][1])
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
  for (let i=1;i<=3;i++) {
    await (document as any).fonts.load('20px ' + getFontFamily(i));
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
  const app = window.ExcalidrawAutomate.plugin.app;
  const vault = app.vault;
  const file = app.metadataCache.getFirstLinkpathDest(normalizePath(fileWithPath),'');
  if(file && file instanceof TFile) {
    const data = await vault.read(file);
    const excalidrawData = JSON_parse(getJSON(data));
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

function estimateLineBound(points:any):[number,number,number,number] {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  points.forEach((p:any) => {
    const [x,y] = p;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  });
  return[minX,minY,maxX,maxY];
}

export function estimateElementBounds (element:ExcalidrawElement):[number,number,number,number] {
  if(element.type=="line" || element.type=="arrow") {
    const [minX,minY,maxX,maxY] = estimateLineBound(element.points);
    return [minX+element.x,minY+element.y,maxX+element.x,maxY+element.y];
  }
  return[element.x,element.y,element.x+element.width,element.y+element.height];
} 

export function estimateBounds (elements:ExcalidrawElement[]):[number,number,number,number] {
  if(!elements.length) return [0,0,0,0];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  elements.forEach((element)=>{
    const [x1,y1,x2,y2] = estimateElementBounds(element);
    minX = Math.min(minX, x1);
    minY = Math.min(minY, y1);
    maxX = Math.max(maxX, x2);
    maxY = Math.max(maxY, y2);
  });
  return [minX,minY,maxX,maxY];
}

export function repositionElementsToCursor (elements:ExcalidrawElement[],newPosition:{x:number, y:number},center:boolean=false):ExcalidrawElement[] {
  const [x1,y1,x2,y2] = estimateBounds(elements);
  let [offsetX,offsetY] = [0,0];
  if (center) {
    [offsetX,offsetY] = [newPosition.x-(x1+x2)/2,newPosition.y-(y1+y2)/2];
  } else {
    [offsetX,offsetY] = [newPosition.x-x1,newPosition.y-y1];
  }

  elements.forEach((element:any)=>{ //using any so I can write read-only propery x & y
    element.x=element.x+offsetX;
    element.y=element.y+offsetY;
  });
  return elements;
}

function errorMessage(message: string, source: string) {
  switch(message) {
    case "targetView not set": 
      console.log(source, "ExcalidrawAutomate: targetView not set, or no longer active. Use setView before calling this function");
      break;
    case "mobile not supported":
      console.log(source, "ExcalidrawAutomate: this function is not avalable on Obsidian Mobile");
      break;
    default:
      console.log(source, "ExcalidrawAutomate: unknown error");
  }
}
