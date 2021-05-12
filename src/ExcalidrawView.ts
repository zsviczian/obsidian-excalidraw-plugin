import { 
  TextFileView, 
  WorkspaceLeaf, 
  normalizePath,
  TFile,
  WorkspaceItem
} from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom";
//import Excalidraw, {exportToSvg, getSceneVersion} from "@excalidraw/excalidraw";
import Excalidraw, {exportToSvg, getSceneVersion} from "aakansha-excalidraw";
import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import { 
  AppState,
  LibraryItems 
} from "@excalidraw/excalidraw/types/types";
import {
  VIEW_TYPE_EXCALIDRAW,
  EXCALIDRAW_FILE_EXTENSION, 
  ICON_NAME,
  EXCALIDRAW_LIB_HEADER,
  VIRGIL_FONT,
  CASCADIA_FONT,
  DISK_ICON_NAME,
  PNG_ICON_NAME,
  SVG_ICON_NAME
} from './constants';
import ExcalidrawPlugin from './main';

interface WorkspaceItemExt extends WorkspaceItem {
  containerEl: HTMLElement;
}

export interface ExportSettings {
  withBackground: boolean,
  withTheme: boolean
}

export default class ExcalidrawView extends TextFileView {
  private getScene: Function;
  private refresh: Function;
  private excalidrawRef: React.MutableRefObject<any>;
  private justLoaded: boolean;
  private plugin: ExcalidrawPlugin;
  private dirty: boolean;
  private autosaveTimer: any;
  private previousSceneVersion: number;

  constructor(leaf: WorkspaceLeaf, plugin: ExcalidrawPlugin) {
    super(leaf);
    this.getScene = null;
    this.refresh = null;
    this.excalidrawRef = null;
    this.plugin = plugin;
    this.justLoaded = false;
    this.dirty = false;
    this.autosaveTimer = null;
    this.previousSceneVersion = 0;
  }

  public async saveSVG(data?: string) {
    if(!data) {
      if (!this.getScene) return false;
      data = this.getScene();
    }
    const filepath = this.file.path.substring(0,this.file.path.lastIndexOf('.'+EXCALIDRAW_FILE_EXTENSION)) + '.svg';
    const file = this.app.vault.getAbstractFileByPath(normalizePath(filepath));
    const exportSettings: ExportSettings = {
      withBackground: this.plugin.settings.exportWithBackground, 
      withTheme: this.plugin.settings.exportWithTheme
    }
    const svg = ExcalidrawView.getSVG(data,exportSettings);
    if(!svg) return;
    //replace font references with base64 fonts
    const includesVirgil = svg.querySelector("text[font-family^='Virgil']") != null;
    const includesCascadia = svg.querySelector("text[font-family^='Cascadia']") != null; 
    const defs = svg.querySelector("defs");
    if (defs && (includesCascadia || includesVirgil)) {
      defs.innerHTML = "<style>" + (includesVirgil ? VIRGIL_FONT : "") + (includesCascadia ? CASCADIA_FONT : "")+"</style>";
    }
    const svgString = svg.outerHTML;                  
    if(file && file instanceof TFile) await this.app.vault.modify(file,svgString);
    else await this.app.vault.create(filepath,svgString);
  }

  public async savePNG(data?: string) {
    if(!data) {
      if (!this.getScene) return false;
      data = this.getScene();
    }
    const filepath = this.file.path.substring(0,this.file.path.lastIndexOf('.'+EXCALIDRAW_FILE_EXTENSION)) + '.png';
    const file = this.app.vault.getAbstractFileByPath(normalizePath(filepath));
    const exportSettings: ExportSettings = {
      withBackground: this.plugin.settings.exportWithBackground, 
      withTheme: this.plugin.settings.exportWithTheme
    }
    const png = await ExcalidrawView.getPNG(data,exportSettings);
    if(!png) return;
    if(file && file instanceof TFile) await this.app.vault.modifyBinary(file,await png.arrayBuffer());
    else await this.app.vault.createBinary(filepath,await png.arrayBuffer());    
  }

  // get the new file content
  getViewData () {
    if(this.getScene) {
      const scene = this.getScene();
      if(this.plugin.settings.autoexportSVG) this.saveSVG(scene);
      if(this.plugin.settings.autoexportPNG) this.savePNG(scene);
      return scene;
    }
    else return this.data;
  }
  
  async onload() {
    this.addAction(DISK_ICON_NAME,"Force-save now to update transclusion visible in adjacent workspace pane\n(Please note, that autosave is always on)",async (ev)=> {
      await this.save();
      this.plugin.triggerEmbedUpdates();
    });
    this.addAction(PNG_ICON_NAME,"Export as PNG",async (ev)=>this.savePNG());
    this.addAction(SVG_ICON_NAME,"Export as SVG",async (ev)=>this.saveSVG());
    //this is to solve sliding panes bug
    if (this.app.workspace.layoutReady) {
      (this.app.workspace.rootSplit as WorkspaceItem as WorkspaceItemExt).containerEl.addEventListener('scroll',(e)=>{if(this.refresh) this.refresh();});
    } else {
      this.registerEvent(this.app.workspace.on('layout-ready', async () => (this.app.workspace.rootSplit as WorkspaceItem as WorkspaceItemExt).containerEl.addEventListener('scroll',(e)=>{if(this.refresh) this.refresh();})));
    }

    this.setupAutosaveTimer();
  }

  private setupAutosaveTimer() {
    const timer = async () => {
      if(this.dirty) {
        this.dirty = false;
        if(this.excalidrawRef) await this.save();
        this.plugin.triggerEmbedUpdates();
        console.log("save");
      }
    }
    this.autosaveTimer = setInterval(timer,30000);
  }

  //save current drawing when user closes workspace leaf
  async onunload() {
    if(this.autosaveTimer) clearInterval(this.autosaveTimer);
    if(this.excalidrawRef) await this.save();
  }

  setViewData (data: string, clear: boolean) {   
    if (this.app.workspace.layoutReady) {
      this.loadDrawing(data,clear);
    } else {
      this.registerEvent(this.app.workspace.on('layout-ready', async () => this.loadDrawing(data,clear)));
    }
  }

  // clear the view content  
  clear() {
    if(this.excalidrawRef) {
      this.excalidrawRef = null;
      this.getScene = null;
      this.refresh = null;
      ReactDOM.unmountComponentAtNode(this.contentEl);
    }
  }
  
  private async loadDrawing (data:string, clear:boolean) {   
    if(clear) this.clear();
    this.justLoaded = true; //a flag to trigger zoom to fit after the drawing has been loaded
    const excalidrawData = JSON.parse(data);
    if(this.excalidrawRef) {
      this.excalidrawRef.current.updateScene({
        elements: excalidrawData.elements,
        appState: excalidrawData.appState,  
      });
    } else {
      this.instantiateExcalidraw({
        elements: excalidrawData.elements,
        appState: excalidrawData.appState,
        scrollToContent: true,
        libraryItems: await this.getLibrary(),
      });
    }
  }

  // gets the title of the document
  getDisplayText() {
    if(this.file) return this.file.basename;
    else return "Excalidraw (no file)";
  }

  // confirms this view can accept csv extension
  canAcceptExtension(extension: string) {
    return extension == EXCALIDRAW_FILE_EXTENSION;
  }  

  // the view type name
  getViewType() {
    return VIEW_TYPE_EXCALIDRAW;
  }

  // icon for the view
  getIcon() {
    return ICON_NAME;
  }

  async getLibrary() {
    const data = JSON.parse(this.plugin.settings.library);
    return data?.library ? data.library : [];
  }

  
  private instantiateExcalidraw(initdata: any) {  
    this.dirty = false;
    this.previousSceneVersion = 0;
    const reactElement = React.createElement(() => {
      const excalidrawRef = React.useRef(null);
      const excalidrawWrapperRef = React.useRef(null);
      const [dimensions, setDimensions] = React.useState({
        width: undefined,
        height: undefined
      });
      
      this.excalidrawRef = excalidrawRef;
      React.useEffect(() => {
        setDimensions({
          width: this.contentEl.clientWidth, 
          height: this.contentEl.clientHeight, 
        });
        
        const onResize = () => {
          try {
            setDimensions({
              width: this.contentEl.clientWidth, 
              height: this.contentEl.clientHeight, 
            });
          } catch(err) {console.log ("Excalidraw React-Wrapper, onResize ",err)}
        };
        window.addEventListener("resize", onResize); 
        return () => window.removeEventListener("resize", onResize);
      }, [excalidrawWrapperRef]);

      this.getScene = () => {
        if(!excalidrawRef?.current) {
          return null;
        }
        const el: ExcalidrawElement[] = excalidrawRef.current.getSceneElements();
        const st: AppState = excalidrawRef.current.getAppState();
        return JSON.stringify({
          "type": "excalidraw",
          "version": 2,
          "source": "https://excalidraw.com",
          "elements": el, 
          "appState": {
            "theme": st.theme,
            "viewBackgroundColor": st.viewBackgroundColor,
          }
        });
      };

      this.refresh = () => {
        if(!excalidrawRef?.current) return;
        excalidrawRef.current.refresh();
      };
      
      return React.createElement(
        React.Fragment,
        null,
        React.createElement(
          "div",
          {
            className: "excalidraw-wrapper",
            ref: excalidrawWrapperRef,
            key: "abc",
          },
          React.createElement(Excalidraw.default, {
            ref: excalidrawRef,
            width: dimensions.width,
            height: dimensions.height,
            UIOptions: {
              canvasActions: {
                loadScene: false,
                saveScene: false,
                saveAsScene: false,
                export: false
              },
            },
            initialData: initdata,
            detectScroll: true,
            onChange: (et:ExcalidrawElement[],st:AppState) => {
              if(this.justLoaded) {
                this.justLoaded = false;             
                const e = new KeyboardEvent("keydown", {bubbles : true, cancelable : true, shiftKey : true, code:"Digit1"});
                this.contentEl.querySelector("canvas")?.dispatchEvent(e);
              } 
              if (st.editingElement == null && st.resizingElement == null && 
                  st.draggingElement == null && st.editingGroupId == null &&
                  st.editingLinearElement == null ) {
                const sceneVersion = Excalidraw.getSceneVersion(et);
                if(sceneVersion != this.previousSceneVersion) {
                  this.previousSceneVersion = sceneVersion;
                  this.dirty=true;
                }
              }
            },
            onLibraryChange: (items:LibraryItems) => {
              (async () => {
                this.plugin.settings.library = EXCALIDRAW_LIB_HEADER+JSON.stringify(items)+'}';
                await this.plugin.saveSettings();  
              })();
            }
          })
        )
      );
    });
    ReactDOM.render(reactElement,(this as any).contentEl);  
  }

  public static getSVG(data:string, exportSettings:ExportSettings):SVGSVGElement {
    try {
      const excalidrawData = JSON.parse(data);
      return exportToSvg({
        elements: excalidrawData.elements,
        appState: {
          exportBackground: exportSettings.withBackground,
          exportWithDarkMode: exportSettings.withTheme ? (excalidrawData.appState?.theme=="light" ? false : true) : false,
          ... excalidrawData.appState,},
        exportPadding:10,
        metadata: "Generated by Excalidraw-Obsidian plugin",
      });
    } catch (error) {
      return null;
    }
  }

  public static async getPNG(data:string, exportSettings:ExportSettings) {
    try {
      const excalidrawData = JSON.parse(data);      
      return await Excalidraw.exportToBlob({
          elements: excalidrawData.elements,
          appState: {
            exportBackground: exportSettings.withBackground,
            exportWithDarkMode: exportSettings.withTheme ? (excalidrawData.appState?.theme=="light" ? false : true) : false,
            ... excalidrawData.appState,},
          mimeType: "image/png",
          exportWithDarkMode: "true",
          metadata: "Generated by Excalidraw-Obsidian plugin",
      });
    } catch (error) {
      return null;
    }
  }
}