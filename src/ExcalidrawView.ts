import { 
  TextFileView, 
  WorkspaceLeaf, 
  TFile 
} from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom";
//import Excalidraw, {exportToSvg} from "@excalidraw/excalidraw";
import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import { AppState,LibraryItems } from "@excalidraw/excalidraw/types/types";
import Excalidraw, {exportToSvg } from "aakansha-excalidraw";
import {
  VIEW_TYPE_EXCALIDRAW,
  EXCALIDRAW_FILE_EXTENSION, 
  ICON_NAME, 
  BLANK_DRAWING, 
  EXCALIDRAWLIB_FILE_EXTENSION
} from './constants';
import { getElementsAtPosition } from "@excalidraw/excalidraw/types/scene";


export default class ExcalidrawView extends TextFileView {
  private getScene: any;
  private excalidrawRef: React.MutableRefObject<any>;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.getScene = null;
    this.excalidrawRef = null;
  }

  onload() {
    const excalidrawData = JSON.parse(BLANK_DRAWING);
    this.instantiateExcalidraw({
      elements: excalidrawData.elements,
      appState: excalidrawData.appState,
      scrollToContent: true,
      libraryItems: this.getLibraries()
    });
  }

  // get the new file content
  getViewData () {
    if(this.getScene) 
      return this.getScene();
    else return this.data;
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
    if(this.excalidrawRef) this.excalidrawRef.current.resetScene();
  }

  private loadDrawing (data:string, clear:boolean) :void {   
    if(clear) this.clear();
    const excalidrawData = JSON.parse(data);
    if(this.excalidrawRef) {
      this.excalidrawRef.current.updateScene({
        elements: excalidrawData.elements,
        appState: excalidrawData.appState,  
      });
      this.excalidrawRef.current.setScrollToContent(excalidrawData.elements);
    } else {
      this.instantiateExcalidraw({
        elements: excalidrawData.elements,
        appState: excalidrawData.appState,
        scrollToContent: true,
        libraryItems: this.getLibraries()
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

  async getLibraries() {
    const excalidrawLibFiles = this.app.vault.getFiles();
    const files = (excalidrawLibFiles || [])
              .filter((f:TFile) => (f.extension==EXCALIDRAWLIB_FILE_EXTENSION));
    let libs:LibraryItems = [];
    let data;
    for (let i=0;i<files.length;i++) {
      data = JSON.parse(await this.app.vault.read(files[i]));
      libs = libs.concat(data.library);
    }
    const result = JSON.stringify(libs);
    return result;
  }

  
  private instantiateExcalidraw(initdata: any) {  
    //this.clear();
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
            "gridSize": st.gridSize,
            "zenModeEnabled": st.zenModeEnabled
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
          },
          React.createElement(Excalidraw.default, {
            ref: excalidrawRef,
            width: dimensions.width,
            height: dimensions.height,
            UIOptions: {
              canvasActions: {
                loadScene: false,
                saveScene: false,
                saveAsScene: false
              },
            },
            initialData: initdata,
            onLibraryChange: (items:LibraryItems) => {console.log("onLibraryChange",items,JSON.stringify(items))}
          })
        )
      );
    });
    ReactDOM.render(reactElement,(this as any).contentEl);
  }

  public static getSVG(data:string):SVGSVGElement {
    try {
      const excalidrawData = JSON.parse(data);
      return exportToSvg({
        elements: excalidrawData.elements,
        appState: {
          exportBackground: true,
          exportWithDarkMode: excalidrawData.appState?.theme=="light" ? false : true,
          ... excalidrawData.appState,},
        exportPadding:10,
        metadata: "Generated by Excalidraw-Obsidian plugin",
      });
    } catch (error) {
      return null;
    }
  }
}