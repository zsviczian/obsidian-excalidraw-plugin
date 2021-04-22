import { TextFileView, WorkspaceLeaf } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom";
//import Excalidraw, {exportToSvg} from "@excalidraw/excalidraw";
import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import { AppState } from "@excalidraw/excalidraw/types/types";
import Excalidraw, {exportToSvg} from "aakansha-excalidraw";

import {VIEW_TYPE_EXCALIDRAW, EXCALIDRAW_FILE_EXTENSION, ICON_NAME} from './constants';

export default class ExcalidrawView extends TextFileView {
  private getScene: any;
  private excalidrawRef: React.MutableRefObject<any>;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.getScene = null;
    this.excalidrawRef = null;
  }


  // onload() {

  // }

  // onunload() {

  // }


  // get the new file content
  getViewData () {
    console.log("getViewData");
    if(this.getScene) 
      return this.getScene();
    else return this.data;
  }

  setViewData (data: string, clear: boolean) {   
    console.log("setViewData", this.leaf);
    if (this.app.workspace.layoutReady) {
      this.loadDrawing(data,clear);
    } else {
      this.registerEvent(this.app.workspace.on('layout-ready', async () => this.loadDrawing(data,clear)));
    }
  }

  private loadDrawing (data:string, clear:boolean) :void {  
    console.log("loadDrawing clear?",clear,data); 
    if(clear) this.clear();
    const excalidrawData = JSON.parse(data);
    this.instantiateExcalidraw({
      elements: excalidrawData.elements,
      appState: excalidrawData.appState,
      scrollToContent: true,
    });
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

  // clear the view content  
  clear() {
    
    //this.excalidrawRef.resetScene();
    return;
    console.log("clear");
    if(this.containerEl.hasChildNodes) {
      console.log("unmount ReactDOM");
      ReactDOM.unmountComponentAtNode(this.contentEl);
      this.getScene = null;
    }
  }

  private instantiateExcalidraw(initdata: any) {  
    //this.clear();
    console.log("this.instantiateExcalidraw");
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
          } catch(err) {console.log ("onResize ",err)}
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
            initialData: initdata
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