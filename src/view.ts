import { ItemView, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_EXCALIDRAW } from "./constants";
import * as ReactDOM from "react-dom";
import * as React from "react";
import Excalidraw, {
    exportToCanvas,
    exportToSvg,
    exportToBlob
  } from "@excalidraw/excalidraw";
import '../styles.css';

export default class ExcalidrawView extends ItemView {

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);

        ReactDOM.render(React.createElement(() => {
            const excalidrawRef = React.useRef(null);
            const excalidrawWrapperRef = React.useRef(null);
            const [dimensions, setDimensions] = React.useState({
              width: undefined,
              height: undefined
            });
                        
            React.useEffect(() => {
              setDimensions({
                width: excalidrawWrapperRef.current.getBoundingClientRect().width,
                height: excalidrawWrapperRef.current.getBoundingClientRect().height
              });
              const onResize = () => {
                try {
                  setDimensions({
                    width: excalidrawWrapperRef.current.getBoundingClientRect().width,
                    height: excalidrawWrapperRef.current.getBoundingClientRect().height
                  });
                } catch(err) {console.log ("onResize ",err)}
              };
      
              window.addEventListener("resize", onResize);
              this.onResize = onResize;
      
              return () => window.removeEventListener("resize", onResize);
            }, [excalidrawWrapperRef]);
                  
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
                  height: dimensions.height
                })
              )
            );
        }),(this as any).contentEl);
    }

    getDisplayText() {
        return "Excalidraw";
    }

    getIcon() {
        return "palette";
    }

    getViewType() {
        return VIEW_TYPE_EXCALIDRAW;
    }

    async onOpen() {

    }
}
