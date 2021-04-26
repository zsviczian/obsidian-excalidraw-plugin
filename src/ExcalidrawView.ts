import { 
  TextFileView, 
  WorkspaceLeaf, 
  normalizePath,
  TFile,
} from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom";
import Excalidraw, {exportToSvg} from "@excalidraw/excalidraw";
//import Excalidraw, {exportToSvg} from "aakansha-excalidraw";
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
} from './constants';
import ExcalidrawPlugin from './main';

export interface ExportSettings {
  withBackground: boolean,
  withTheme: boolean
}

export default class ExcalidrawView extends TextFileView {
  private getScene: any;
  private excalidrawRef: React.MutableRefObject<any>;
  private justLoaded: boolean;
  private plugin: ExcalidrawPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: ExcalidrawPlugin) {
    super(leaf);
    this.getScene = null;
    this.excalidrawRef = null;
    this.plugin = plugin;
    this.justLoaded = false;
  }

  // get the new file content
  getViewData () {
    if(this.getScene) {
      const scene = this.getScene();
      if(this.plugin.settings.autoexportSVG) this.saveSVG(scene);
      return scene;
    }
    else return this.data;
  }

  private async saveSVG(data: string) {
    const filepath = this.file.path.substring(0,this.file.path.lastIndexOf('.excalidraw')) + '.svg';
    const file = this.app.vault.getAbstractFileByPath(normalizePath(filepath));
    const exportSettings: ExportSettings = {
      withBackground: this.plugin.settings.exportWithBackground, 
      withTheme: this.plugin.settings.exportWithTheme
    }
    const svg = ExcalidrawView.getSVG(data,exportSettings)?.outerHTML;
    if(file && file instanceof TFile) await this.app.vault.modify(file,svg);
    else await this.app.vault.create(filepath,svg);
  }

  async onunload() {
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
            key: "xyz",
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
            onChange: (et:ExcalidrawElement[],st:AppState) => {
              if(this.justLoaded) {
                this.justLoaded = false;             
                const e = new KeyboardEvent("keydown", {bubbles : true, cancelable : true, shiftKey : true, code:"Digit1"});
                this.contentEl.querySelector("canvas")?.dispatchEvent(e);
              }
            },
            onLibraryChange: async (items:LibraryItems) => {
              this.plugin.settings.library = EXCALIDRAW_LIB_HEADER+JSON.stringify(items)+'}';
              this.plugin.saveSettings();
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
}