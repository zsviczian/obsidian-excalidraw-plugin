import { EventRef, Workspace, ItemView, WorkspaceLeaf, TFile } from "obsidian";
import { VIEW_TYPE_EXCALIDRAW } from "./constants";
import * as ReactDOM from "react-dom";
import * as React from "react";
import Excalidraw, { exportToCanvas, exportToSvg, exportToBlob } from "@excalidraw/excalidraw";
import type SceneData from "@excalidraw/excalidraw";
import '../styles.css';
import Scene from "@excalidraw/excalidraw/types/scene/Scene";
import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import { AppState } from "@excalidraw/excalidraw/types/types";

export default class ExcalidrawView extends ItemView {
  getSVG: any;
  getPNG: any;
  file: TFile;

  workspace: Workspace;
  
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.workspace = this.app.workspace;
    this.file = null;
  }

  private instantiateExcalidraw(initdata: any) {
    ReactDOM.unmountComponentAtNode(this.contentEl);
    
    ReactDOM.render(React.createElement(() => {
      let previousSceneVersion = 0;
      const excalidrawRef = React.useRef(null);
      const excalidrawWrapperRef = React.useRef(null);
      const [dimensions, setDimensions] = React.useState({
        width: undefined,
        height: undefined
      });
      
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
       
/*      this.getScene = function() {
        return {
          elements: excalidrawRef.current.getSceneElements(),
          appState: excalidrawRef.current.getAppState()
        };              
      };*/

/*      this.updateScene = function(scene: Scene) {
        sceneJustUpdated = true;
        excalidrawRef.current.updateScene(scene);
      };*/

      return React.createElement(
        React.Fragment,
        null,
        React.createElement(
          "div",
          {
            className: "excalidraw-wrapper",
            ref: excalidrawWrapperRef
          },
          React.createElement(Excalidraw.default, {
            ref: excalidrawRef,
            width: dimensions.width,
            height: dimensions.height,
            UIOptions: {
              canvasActions: {
                loadScene: false,
                saveScene: true,
                saveAsScene: false
              },
            },
            initialData: initdata,
            onChange: (el: ExcalidrawElement[], st: AppState) => { 
              if (st.editingElement == null && st.resizingElement == null && 
                  st.draggingElement == null && st.editingGroupId == null &&
                  st.editingLinearElement == null ) {
                const sceneVersion = Excalidraw.getSceneVersion(el);
                if(sceneVersion != previousSceneVersion) {
                  previousSceneVersion = sceneVersion;                 
                  this.saveFile(JSON.stringify({
                    "type": "excalidraw",
                    "version": 2,
                    "source": "https://excalidraw.com",
                    "elements": el.filter(e => !e.isDeleted),
                    "appState": {
                      "theme": st.theme,
                      "viewBackgroundColor": st.viewBackgroundColor
                    }
                  }));
                }
              }
            },
          })
        )
      );
    }),(this as any).contentEl);
  }

  private async saveFile(content: string) {
    await this.app.vault.modify(this.file, content);
  }

  public loadDrawing(file: TFile) {
    this.file = file;
    this.app.vault.read(file).then((content: string) => {
      const data = JSON.parse(content);
      this.instantiateExcalidraw({
        elements: data.elements,
        appState: data.appState,
        scrollToContent: true,
      });
    });
    
  }

  public getCurrentDrawingFilename() {
    return this.file == null ? '' : this.file.path;
  }

  getDisplayText() {
    return this.file!=null ? this.file.basename : "Excalidraw";
  }

  getIcon() {
      return "palette";
  }

  getViewType() {
      return VIEW_TYPE_EXCALIDRAW;
  }

}
