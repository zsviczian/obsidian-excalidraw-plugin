import { AppState } from "@zsviczian/excalidraw/types/types";
import clsx from "clsx";
import { Notice, TFile } from "obsidian";
import * as React from "react";
import { SCRIPT_INSTALL_FOLDER } from "./constants";
import { insertLaTeXToView, search } from "./ExcalidrawAutomate";
import ExcalidrawView, { TextMode } from "./ExcalidrawView";
import { t } from "./lang/helpers";
import ExcalidrawPlugin from "./main";
import { ScriptIconMap } from "./Scripts";
import { getIMGFilename } from "./Utils";

const dark = '<svg style="color:#ced4da;fill:#ced4da" ';
const light = '<svg style="color:#212529;fill:#212529" ';

type PanelProps = {
  visible: boolean;
  view: ExcalidrawView;
  centerPointer: Function;
}

type PanelState = {
  visible: boolean;
  top: number;
  left: number;
  theme: "dark"|"light";
  excalidrawViewMode: boolean;
  minimized: boolean;
  isFullscreen: boolean;
  isPreviewMode: boolean;
  scriptIconMap: ScriptIconMap;
}

const TOOLS_PANEL_WIDTH = 228;

export class ToolsPanel extends React.Component<PanelProps, PanelState> {
  pos1: number = 0;
  pos2: number = 0;
  pos3: number = 0;
  pos4: number = 0;
  penDownX: number = 0;
  penDownY: number = 0;
  previousWidth: number = 0;
  previousHeight: number = 0;
  onRightEdge: boolean = false;
  onBottomEdge: boolean = false;
  private containerRef = React.createRef<HTMLDivElement>();

  constructor(props: PanelProps) {
    super(props);
    this.state = {
      visible: props.visible,
      top: 50,
      left: 200,
      theme: "dark",
      excalidrawViewMode: false,
      minimized: false,
      isFullscreen: false,
      isPreviewMode: true,
      scriptIconMap: {},
    }
  } 

  updateScriptIconMap(scriptIconMap:ScriptIconMap) {
    this.setState(()=>{
      return {scriptIconMap}
    });
  }

  setPreviewMode(isPreviewMode: boolean) {
    this.setState(()=>{
      return {
        isPreviewMode,
      }
    })
  }

  setFullscreen(isFullscreen: boolean) {
    this.setState(()=>{
      return {
        isFullscreen,
      }
    })
  }

  setExcalidrawViewMode(isViewModeEnabled: boolean) {
    this.setState(()=>{
      return {
        excalidrawViewMode: isViewModeEnabled,
      }
    });
  }

  toggleVisibility(isMobileOrZen: boolean) {
    this.setTopCenter(isMobileOrZen);
    this.setState((prevState: PanelState) => {
      return {
        visible: !prevState.visible
      }
    });
  }

  setTheme(theme:"dark"|"light") {
    this.setState((prevState: PanelState) => {
      return {
        theme: theme
      }
    });
  }

  setTopCenter(isMobileOrZen:boolean) {
    this.setState(()=>{
      return {
        left: (this.containerRef.current.clientWidth -
                TOOLS_PANEL_WIDTH -
                (isMobileOrZen?0:TOOLS_PANEL_WIDTH+4)
              ) / 
              2+this.containerRef.current.parentElement.offsetLeft +
              (isMobileOrZen?0:TOOLS_PANEL_WIDTH+4),
        top: 64 + this.containerRef.current.parentElement.offsetTop
      }
    })
  }

  updatePosition(deltaY:number=0, deltaX:number=0) {
    this.setState(()=>{
      const {
        offsetTop,
        offsetLeft,
        clientWidth: width,
        clientHeight: height
      } = this.containerRef.current.firstElementChild as HTMLElement

      const top = offsetTop - deltaY;
      const left = offsetLeft - deltaX;

      const {
        clientWidth: parentWidth,
        clientHeight: parentHeight,
        offsetTop: parentOffsetTop,
        offsetLeft: parentOffsetLeft
      } = this.containerRef.current.parentElement;

      this.previousHeight = parentHeight;
      this.previousWidth = parentWidth;
      this.onBottomEdge = top >= parentHeight - height + parentOffsetTop;
      this.onRightEdge = left >= parentWidth - width + parentOffsetLeft;

      return {
        top: top < parentOffsetTop
          ? parentOffsetTop
          : this.onBottomEdge
            ? parentHeight - height + parentOffsetTop
            : top,
        left: left < parentOffsetLeft
          ? parentOffsetLeft
          : this.onRightEdge
            ? parentWidth - width + parentOffsetLeft
            : left
      }
    })
  }
  
  render () {
    const downloadedScriptsRoot=`${this.props.view.plugin.settings.scriptFolderPath}/${SCRIPT_INSTALL_FOLDER}/`
    return (
      <div
        ref={this.containerRef}
        className={clsx(
          "excalidraw",
          {
            "theme--dark": this.state.theme==="dark"
          }
        )}
        style={{
          width:"100%",
          height:"100%",
          position:"absolute",
          touchAction:"none"
        }}
      >
        <div
          className="Island"
          style={{
            top: this.state.top + "px",
            left: this.state.left + "px",
            width:TOOLS_PANEL_WIDTH+"px",
            display: this.state.visible && !this.state.excalidrawViewMode ? "block":"none",
            height: "fit-content",
            maxHeight: "400px",
            zIndex: 3,
          }}
        >
          <div
           style={{
              height: "26px",
              width: "100%",
              cursor: "move",
            }}
            onClick={(event: React.MouseEvent<HTMLDivElement, MouseEvent>)=>{
              event.preventDefault();
              if(Math.abs(this.penDownX-this.pos3)>5 || Math.abs(this.penDownY-this.pos4)>5) return;
              this.setState((prevState:PanelState)=>{
                return {
                  minimized: !prevState.minimized
                }
              })
            }}
            
            onPointerDown={(event: React.PointerEvent)=> {
              const onDrag = (e:PointerEvent) => {
                e.preventDefault();
                this.pos1 = this.pos3 - e.clientX;
                this.pos2 = this.pos4 - e.clientY;
                this.pos3 = e.clientX;
                this.pos4 = e.clientY;              
                this.updatePosition(this.pos2,this.pos1)
              }

              const onPointerUp = () => {
                document.removeEventListener("pointerup",onPointerUp)
                document.removeEventListener("pointermove",onDrag)
              }

              event.preventDefault();
              this.penDownX = this.pos3 = event.clientX;
              this.penDownY = this.pos4 = event.clientY;
              document.addEventListener("pointerup",onPointerUp);
              document.addEventListener("pointermove",onDrag);
            }}
          >
            <svg aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 228 26">
              <path stroke="var(--icon-fill-color)" strokeWidth="2" d="M40,7 h148 M40,13 h148 M40,19 h148"/>
            </svg>
          </div>
          <div 
            className="Island App-menu__left scrollbar"
            style={{ 
              maxHeight:"350px",
              //@ts-ignore
              "--padding":2,
              display: this.state.minimized ? "none":"block",
            }}
          >
            <div 
              className="panelColumn"
            >
              <fieldset>
                <legend>Utility actions</legend>
                <div className="buttonList buttonListIcon">
                  <ActionButton
                    key={"search"}
                    title={t("SEARCH")}
                    action={()=> {
                      search(this.props.view);
                    }}
                    icon={ICONS.search}
                  />
                  <ActionButton
                    key={"md"}
                    title={t("OPEN_AS_MD")}
                    action={()=> {
                      this.props.view.openAsMarkdown();
                    }}
                    icon={ICONS.switchToMarkdown}
                  />
                  <ActionButton
                    key={"fullscreen"}
                    title={this.state.isFullscreen ? t("EXIT_FULLSCREEN") : t("GOTO_FULLSCREEN")}
                    action={()=> {
                      if(this.state.isFullscreen) {
                        this.props.view.exitFullscreen();
                      } else {
                        this.props.view.gotoFullscreen();
                      }
                    }}
                    icon={this.state.isFullscreen ? ICONS.exitFullScreen : ICONS.gotoFullScreen}
                  />
                  { this.state.isPreviewMode === null 
                    ? (<ActionButton
                      key={"convert"}
                      title={t("CONVERT_FILE")}
                      action={()=> {
                        this.props.view.convertExcalidrawToMD();
                      }}
                      icon={ICONS.convertFile}
                    />)
                    : (<ActionButton
                        key={"viewmode"}
                        title={this.state.isPreviewMode ? t("PARSED"):t("RAW")}
                        action={()=> {
                          if(this.state.isPreviewMode) {
                            this.props.view.changeTextMode(TextMode.raw);
                          } else {
                            this.props.view.changeTextMode(TextMode.parsed);
                          }
                        }}
                        icon={this.state.isPreviewMode ? ICONS.rawMode : ICONS.parsedMode}
                      />)
                  }
                </div>
              </fieldset>
              <fieldset>
                <legend>Export actions</legend>
                <div className="buttonList buttonListIcon">
                  <ActionButton
                    key={"lib"}
                    title={t("DOWNLOAD_LIBRARY")}
                    action={()=>{
                      this.props.view.plugin.exportLibrary();
                    }}
                    icon={ICONS.exportLibrary}
                  />
                  <ActionButton
                    key={"svg"}
                    title={t("EXPORT_SVG")}
                    action={()=>{
                      this.props.view.saveSVG();
                      new Notice("File saved: " + getIMGFilename(this.props.view.file.path, "svg"));
                    }}
                    icon={ICONS.exportSVG}
                  />
                  <ActionButton
                    key={"png"}
                    title={t("EXPORT_PNG")}
                    action={()=>{
                      this.props.view.savePNG();
                      new Notice("File saved: "+getIMGFilename(this.props.view.file.path, "png"));
                    }}
                    icon={ICONS.exportPNG}
                  />
                  <ActionButton
                    key={"excalidraw"}
                    title={t("EXPORT_EXCALIDRAW")}
                    action={()=>{
                      this.props.view.exportExcalidraw();
                    }}
                    icon={ICONS.exportExcalidraw}
                  />
                </div>
              </fieldset>
              <fieldset>
                <legend>Insert actions</legend>
                <div className="buttonList buttonListIcon">
                  <ActionButton
                    key={"image"}
                    title={t("INSERT_IMAGE")}
                    action={()=> {
                      this.props.centerPointer();
                      this.props.view.plugin.insertImageDialog.start(
                        this.props.view)
                    }}
                    icon={ICONS.insertImage}
                  />
                  <ActionButton
                    key={"insertMD"}
                    title={t("INSERT_MD")}
                    action={()=> {
                      this.props.centerPointer();
                      this.props.view.plugin.insertMDDialog.start(
                        this.props.view)
                    }}
                    icon={ICONS.insertMD}
                  />
                  <ActionButton
                    key={"latex"}
                    title={t("INSERT_LATEX")}
                    action={()=> {
                      this.props.centerPointer();
                      insertLaTeXToView(this.props.view)
                    }}
                    icon={ICONS.insertLaTeX}
                  />
                  <ActionButton
                    key={"link"}
                    title={t("INSERT_LINK")}
                    action={()=> {
                      this.props.centerPointer();
                      this.props.view.plugin.insertLinkDialog.start(
                        this.props.view.file.path, 
                        this.props.view.addText
                      );
                    }}
                    icon={ICONS.insertLink}
                  />
                </div>
              </fieldset>
              {this.state.scriptIconMap !== {} && 
                Object.keys(this.state.scriptIconMap).filter(k=>!k.startsWith(downloadedScriptsRoot)).length !== 0
                ? (<fieldset>
                    <legend>User Scripts</legend>
                    <div className="buttonList buttonListIcon">
                      {Object.keys(this.state.scriptIconMap)
                        .filter(k=>!k.startsWith(downloadedScriptsRoot))
                        .sort()
                        .map((key:string) =>
                        <ActionButton
                          key={key}
                          title={this.state.scriptIconMap[key].name}
                          action={()=> {
                            const f = this.props.view.app.vault.getAbstractFileByPath(key);
                            if(f && f instanceof TFile) {
                              this.props.view.plugin.scriptEngine.executeScript(this.props.view,f);
                            }
                          }}
                          icon={this.state.scriptIconMap[key].iconBase64 
                            ? <img 
                                src={`data:image/svg+xml,${encodeURIComponent(
                                  this.state.theme==="dark"
                                  ? this.state.scriptIconMap[key].iconBase64.replace("<svg ",dark)
                                  : this.state.scriptIconMap[key].iconBase64.replace("<svg ",light)
                                )}`}
                              />
                            : ICONS.cog}
                        />
                      )}
                    </div>
                  </fieldset>) 
                : ""
              }
              {this.state.scriptIconMap !== {} && 
                Object.keys(this.state.scriptIconMap).filter(k=>k.startsWith(downloadedScriptsRoot)).length !== 0
                ? (<fieldset>
                    <legend>Downloaded Scripts</legend>
                    <div className="buttonList buttonListIcon">
                      {Object.keys(this.state.scriptIconMap)
                        .filter(k=>k.startsWith(downloadedScriptsRoot))
                        .sort()
                        .map((key:string) =>
                        <ActionButton
                          key={key}
                          title={this.state.scriptIconMap[key].name.replace(SCRIPT_INSTALL_FOLDER+"/","")}
                          action={()=> {
                            const f = this.props.view.app.vault.getAbstractFileByPath(key);
                            if(f && f instanceof TFile) {
                              this.props.view.plugin.scriptEngine.executeScript(this.props.view,f);
                            }
                          }}
                          icon={this.state.scriptIconMap[key].iconBase64 
                          ? <img 
                              src={`data:image/svg+xml,${encodeURIComponent(
                                this.state.theme==="dark"
                                ? this.state.scriptIconMap[key].iconBase64.replace("<svg ",dark)
                                : this.state.scriptIconMap[key].iconBase64.replace("<svg ",light)
                              )}`}
                            />
                          : ICONS.cog}
                        />
                      )}
                    </div>
                  </fieldset>) 
                : ""
              }
            </div>
          </div>
        </div>
      </div>
    )
  }
}

type ButtonProps = {
  title: string;
  action: Function;
  icon: JSX.Element;
  key: string;
}

type ButtonState = {
  visible: boolean;
}

class ActionButton extends React.Component<ButtonProps, ButtonState> {
  constructor(props: ButtonProps) {
    super(props);
    this.state = {
      visible: true,
    }
  } 

  render() {
    return (
      <button
        key={this.props.key}
        style={{
          width:"fit-content",
          padding:"2px",
          margin:"4px"
        }}
        className="ToolIcon_type_button ToolIcon_size_small ToolIcon_type_button--show ToolIcon"
        title={this.props.title}
        aria-label={this.props.title}
        onClick={()=>this.props.action()}
    >
      <div className="ToolIcon__icon" aria-hidden="true">
        {this.props.icon}
      </div>
    </button>

    );
  }
}
export class ObsidianMenu {
  plugin: ExcalidrawPlugin;
  toolsRef: React.MutableRefObject<any>

  constructor(plugin: ExcalidrawPlugin, toolsRef: React.MutableRefObject<any>) {
    this.plugin = plugin;
    this.toolsRef = toolsRef;
  }

  renderButton = (isMobile: boolean, appState: AppState) => {
    return (
      <label 
        className={clsx(
          "ToolIcon ToolIcon_type_floating",
          "ToolIcon_size_medium",
          {
            "is-mobile": isMobile,
          },
        )}
        onClick={() => {
          this.toolsRef.current.setTheme(appState.theme);
          this.toolsRef.current.toggleVisibility(appState.zenModeEnabled||isMobile);
        }}>
        <div className="ToolIcon__icon" aria-hidden="true">
          <svg aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 166 267"><path fill="transparent" d="M0 0h165.742v267.245H0z"/><g fillRule="evenodd"><path fill="#bd7efc" strokeWidth="0" d="M55.5 96.49 39.92 57.05 111.28 10l4.58 36.54L55.5 95.65"/><path fill="none" stroke="#410380" strokeWidth=".5" d="M55.5 96.49c-5.79-14.66-11.59-29.33-15.58-39.44M55.5 96.49c-3.79-9.59-7.58-19.18-15.58-39.44m0 0C60.13 43.72 80.34 30.4 111.28 10M39.92 57.05C60.82 43.27 81.73 29.49 111.28 10m0 0c.97 7.72 1.94 15.45 4.58 36.54M111.28 10c1.14 9.12 2.29 18.24 4.58 36.54m0 0C95.41 63.18 74.96 79.82 55.5 95.65m60.36-49.11C102.78 57.18 89.71 67.82 55.5 95.65m0 0v.84m0-.84v.84"/></g><g fillRule="evenodd"><path fill="#e2c4ff" strokeWidth="0" d="m111.234 10.06 44.51 42.07-40.66-5.08-3.85-36.99"/><path fill="none" stroke="#410380" strokeWidth=".5" d="M111.234 10.06c11.83 11.18 23.65 22.36 44.51 42.07m-44.51-42.07 44.51 42.07m0 0c-13.07-1.63-26.13-3.27-40.66-5.08m40.66 5.08c-11.33-1.41-22.67-2.83-40.66-5.08m0 0c-1.17-11.29-2.35-22.58-3.85-36.99m3.85 36.99c-1.47-14.17-2.95-28.33-3.85-36.99m0 0s0 0 0 0m0 0s0 0 0 0"/></g><g fillRule="evenodd"><path fill="#2f005e" strokeWidth="0" d="m10 127.778 45.77-32.99-15.57-38.08-30.2 71.07"/><path fill="none" stroke="#410380" strokeWidth=".5" d="M10 127.778c16.85-12.14 33.7-24.29 45.77-32.99M10 127.778c16.59-11.95 33.17-23.91 45.77-32.99m0 0c-6.14-15.02-12.29-30.05-15.57-38.08m15.57 38.08c-4.08-9.98-8.16-19.96-15.57-38.08m0 0c-11.16 26.27-22.33 52.54-30.2 71.07m30.2-71.07c-10.12 23.81-20.23 47.61-30.2 71.07m0 0s0 0 0 0m0 0s0 0 0 0"/></g><g fillRule="evenodd"><path fill="#410380" strokeWidth="0" d="m40.208 235.61 15.76-140.4-45.92 32.92 30.16 107.48"/><path fill="none" stroke="#410380" strokeWidth=".5" d="M40.208 235.61c3.7-33.01 7.41-66.02 15.76-140.4m-15.76 140.4c3.38-30.16 6.77-60.32 15.76-140.4m0 0c-10.83 7.76-21.66 15.53-45.92 32.92m45.92-32.92c-11.69 8.38-23.37 16.75-45.92 32.92m0 0c6.84 24.4 13.69 48.8 30.16 107.48m-30.16-107.48c6.67 23.77 13.33 47.53 30.16 107.48m0 0s0 0 0 0m0 0s0 0 0 0"/></g><g fillRule="evenodd"><path fill="#943feb" strokeWidth="0" d="m111.234 240.434-12.47 16.67-42.36-161.87 58.81-48.3 40.46 5.25-44.44 188.25"/><path fill="none" stroke="#410380" strokeWidth=".5" d="M111.234 240.434c-3.79 5.06-7.57 10.12-12.47 16.67m12.47-16.67c-4.43 5.93-8.87 11.85-12.47 16.67m0 0c-16.8-64.17-33.59-128.35-42.36-161.87m42.36 161.87c-9.74-37.2-19.47-74.41-42.36-161.87m0 0c15.03-12.35 30.07-24.7 58.81-48.3m-58.81 48.3c22.49-18.47 44.97-36.94 58.81-48.3m0 0c9.48 1.23 18.95 2.46 40.46 5.25m-40.46-5.25c13.01 1.69 26.02 3.38 40.46 5.25m0 0c-10.95 46.41-21.91 92.82-44.44 188.25m44.44-188.25c-12.2 51.71-24.41 103.42-44.44 188.25m0 0s0 0 0 0m0 0s0 0 0 0"/></g><g fillRule="evenodd"><path fill="#6212b3" strokeWidth="0" d="m40.379 235.667 15.9-140.21 42.43 161.79-58.33-21.58"/><path fill="none" stroke="#410380" strokeWidth=".5" d="M40.379 235.667c4.83-42.62 9.67-85.25 15.9-140.21m-15.9 140.21c5.84-51.52 11.69-103.03 15.9-140.21m0 0c10.98 41.87 21.96 83.74 42.43 161.79m-42.43-161.79c13.28 50.63 26.56 101.25 42.43 161.79m0 0c-11.8-4.37-23.6-8.74-58.33-21.58m58.33 21.58c-21.73-8.04-43.47-16.08-58.33-21.58m0 0s0 0 0 0m0 0s0 0 0 0"/></g></svg>
        </div>
      </label>
    );
  }
}

const ICONS = {
  exportLibrary: (
    <svg aria-hidden="true" focusable="false" role="img"  xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 190">
      <g fillRule="evenodd">
        <path strokeWidth="0" d="M50 10h20v20H50"/>
      <path fill="none" strokeWidth="2" d="M50 10h20m-20 0h20m0 0v20m0-20v20m0 0H50m20 0H50m0 0V10m0 20V10"/>
      </g>
      <g fillRule="evenodd">
        <path strokeWidth="0" d="M90 10h20v20H90"/>
      <path fill="none" strokeWidth="2" d="M90 10h20m-20 0h20m0 0v20m0-20v20m0 0H90m20 0H90m0 0V10m0 20V10"/>
      </g>
      <g fillRule="evenodd">
        <path strokeWidth="0" d="M130 10h20v20h-20"/>
      <path fill="none" strokeWidth="2" d="M130 10h20m-20 0h20m0 0v20m0-20v20m0 0h-20m20 0h-20m0 0V10m0 20V10"/>
      </g>
      <g fillRule="evenodd">
        <path strokeWidth="0" d="M170 10h20v20h-20"/>
      <path fill="none" strokeWidth="2" d="M170 10h20m-20 0h20m0 0v20m0-20v20m0 0h-20m20 0h-20m0 0V10m0 20V10"/>
      </g>
      <g fillRule="evenodd">
        <path strokeWidth="0" d="M70 50h60v80h20l-50 50-50-50h20V50"/>
      <path fill="none" strokeWidth="2" d="M70 50h60m-60 0h60m0 0v80m0-80v80m0 0h20m-20 0h20m0 0-50 50m50-50-50 50m0 0-50-50m50 50-50-50m0 0h20m-20 0h20m0 0V50m0 80V50m0 0s0 0 0 0m0 0s0 0 0 0m0 0s0 0 0 0m0 0s0 0 0 0"/>
      </g>
      <g fillRule="evenodd">
        <path strokeWidth="0" d="M10 10h20v20H10"/>
      <path fill="none" strokeWidth="2" d="M10 10h20m-20 0h20m0 0v20m0-20v20m0 0H10m20 0H10m0 0V10m0 20V10"/>
      </g>
    </svg>
  ),
  //far fa-image
  insertImage: (
    <svg aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <path d="M464 64H48C21.49 64 0 85.49 0 112v288c0 26.51 21.49 48 48 48h416c26.51 0 48-21.49 48-48V112c0-26.51-21.49-48-48-48zm-6 336H54a6 6 0 0 1-6-6V118a6 6 0 0 1 6-6h404a6 6 0 0 1 6 6v276a6 6 0 0 1-6 6zM128 152c-22.091 0-40 17.909-40 40s17.909 40 40 40 40-17.909 40-40-17.909-40-40-40zM96 352h320v-80l-87.515-87.515c-4.686-4.686-12.284-4.686-16.971 0L192 304l-39.515-39.515c-4.686-4.686-12.284-4.686-16.971 0L96 304v48z"/>
    </svg>
  ),
  //far fa-file-alt
  insertMD: (
    <svg aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
      <path d="M288 248v28c0 6.6-5.4 12-12 12H108c-6.6 0-12-5.4-12-12v-28c0-6.6 5.4-12 12-12h168c6.6 0 12 5.4 12 12zm-12 72H108c-6.6 0-12 5.4-12 12v28c0 6.6 5.4 12 12 12h168c6.6 0 12-5.4 12-12v-28c0-6.6-5.4-12-12-12zm108-188.1V464c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V48C0 21.5 21.5 0 48 0h204.1C264.8 0 277 5.1 286 14.1L369.9 98c9 8.9 14.1 21.2 14.1 33.9zm-128-80V128h76.1L256 51.9zM336 464V176H232c-13.3 0-24-10.7-24-24V48H48v416h288z"/>
    </svg>
  ),
  //far fa-square-root-alt
  insertLaTeX: (
    <svg aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512">
      <path d="M571.31 251.31l-22.62-22.62c-6.25-6.25-16.38-6.25-22.63 0L480 274.75l-46.06-46.06c-6.25-6.25-16.38-6.25-22.63 0l-22.62 22.62c-6.25 6.25-6.25 16.38 0 22.63L434.75 320l-46.06 46.06c-6.25 6.25-6.25 16.38 0 22.63l22.62 22.62c6.25 6.25 16.38 6.25 22.63 0L480 365.25l46.06 46.06c6.25 6.25 16.38 6.25 22.63 0l22.62-22.62c6.25-6.25 6.25-16.38 0-22.63L525.25 320l46.06-46.06c6.25-6.25 6.25-16.38 0-22.63zM552 0H307.65c-14.54 0-27.26 9.8-30.95 23.87l-84.79 322.8-58.41-106.1A32.008 32.008 0 0 0 105.47 224H24c-13.25 0-24 10.74-24 24v48c0 13.25 10.75 24 24 24h43.62l88.88 163.73C168.99 503.5 186.3 512 204.94 512c17.27 0 44.44-9 54.28-41.48L357.03 96H552c13.25 0 24-10.75 24-24V24c0-13.26-10.75-24-24-24z"/>
    </svg>
  ),
  //fas fa-link
  insertLink: (
    <svg aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <path d="M326.612 185.391c59.747 59.809 58.927 155.698.36 214.59-.11.12-.24.25-.36.37l-67.2 67.2c-59.27 59.27-155.699 59.262-214.96 0-59.27-59.26-59.27-155.7 0-214.96l37.106-37.106c9.84-9.84 26.786-3.3 27.294 10.606.648 17.722 3.826 35.527 9.69 52.721 1.986 5.822.567 12.262-3.783 16.612l-13.087 13.087c-28.026 28.026-28.905 73.66-1.155 101.96 28.024 28.579 74.086 28.749 102.325.51l67.2-67.19c28.191-28.191 28.073-73.757 0-101.83-3.701-3.694-7.429-6.564-10.341-8.569a16.037 16.037 0 0 1-6.947-12.606c-.396-10.567 3.348-21.456 11.698-29.806l21.054-21.055c5.521-5.521 14.182-6.199 20.584-1.731a152.482 152.482 0 0 1 20.522 17.197zM467.547 44.449c-59.261-59.262-155.69-59.27-214.96 0l-67.2 67.2c-.12.12-.25.25-.36.37-58.566 58.892-59.387 154.781.36 214.59a152.454 152.454 0 0 0 20.521 17.196c6.402 4.468 15.064 3.789 20.584-1.731l21.054-21.055c8.35-8.35 12.094-19.239 11.698-29.806a16.037 16.037 0 0 0-6.947-12.606c-2.912-2.005-6.64-4.875-10.341-8.569-28.073-28.073-28.191-73.639 0-101.83l67.2-67.19c28.239-28.239 74.3-28.069 102.325.51 27.75 28.3 26.872 73.934-1.155 101.96l-13.087 13.087c-4.35 4.35-5.769 10.79-3.783 16.612 5.864 17.194 9.042 34.999 9.69 52.721.509 13.906 17.454 20.446 27.294 10.606l37.106-37.106c59.271-59.259 59.271-155.699.001-214.959z"/>
    </svg>
  ),
  exportSVG: (
    <svg viewBox="0 0 28 28">
      <text style={{fontSize:"28px", fontWeight:"bold"}} x="4" y="24">S</text>
    </svg>
  ),
  exportPNG: (
    <svg viewBox="0 0 28 28">
      <text style={{fontSize:"28px", fontWeight:"bold"}} x="4" y="24">P</text>
    </svg>
  ),
  exportExcalidraw: (
    <svg aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <g transform="translate(30,5)">
        <path d="M14.45 1.715c-2.723 2.148-6.915 5.797-10.223 8.93l-2.61 2.445.477 3.207c.258 1.75.738 5.176 1.031 7.582.332 2.406.66 4.668.773 4.996.145.438 0 .656-.406.656-.699 0-.734-.183 1.176 5.832.7 2.297 1.363 4.414 1.434 4.633.074.254.367.363.699.254.332-.145.515-.438.406-.691-.113-.293.074-.586.367-.696.403-.144.367-.437-.258-1.492-.992-1.64-3.53-15.64-3.675-20.164-.11-3.207-.11-3.242 1.25-5.066 1.324-1.786 4.375-4.485 9.078-7.91 1.324-.985 2.648-2.079 3.015-2.446.551-.656.809-.472 5.442 4.414 2.683 2.805 5.664 5.688 6.617 6.414l1.766 1.313-1.36 2.844c-.734 1.53-3.715 7.437-6.656 13.054-6.137 11.813-4.887 10.68-12.02 10.79l-4.632.038-1.547 1.75c-1.617 1.86-1.836 2.551-1.063 3.72.293.398.512 1.054.512 1.456 0 .656.258.766 1.73.84.918.035 1.762.145 1.875.254.11.11.258 2.371.368 5.031l.144 4.813-2.46 5.25C1.616 72.516 0 76.527 0 77.84c0 .691.148 1.273.293 1.273.367 0 .367-.035 15.332-30.988 6.95-14.363 13.531-27.89 14.633-30.113 1.101-2.227 2.094-4.266 2.168-4.559.074-.328-2.461-2.844-6.508-6.379C22.281 3.864 19.082.95 18.785.621c-.844-1.023-2.094-.695-4.336 1.094zM15.7 43.64c-1.692 3.246-1.766 3.28-6.4 3.5-4.081.218-4.152.183-4.152-.582 0-.438-.148-1.024-.332-1.313-.222-.328-.074-.914.442-1.715l.808-1.238h3.676c2.024-.04 4.34-.184 5.149-.328.808-.149 1.507-.219 1.578-.184.074.035-.293.875-.77 1.86zm-3.09 5.832c-.294.765-1.067 2.37-1.692 3.574-1.027 2.043-1.137 2.113-1.395 1.277-.148-.511-.257-2.008-.296-3.355-.036-2.66-.11-2.625 2.98-2.809l.992-.035zm0 0"/>
        <path d="M15.55 10.39c-.66.473-.843.95-.843 2.153 0 1.422.11 1.64 1.102 2.039.992.402 1.25.367 2.39-.398 1.508-1.024 1.543-1.278.442-2.918-.957-1.422-1.914-1.676-3.09-.875zm2.098 1.313c.586 1.02.22 1.785-.882 1.785-.993 0-1.434-.984-.883-1.968.441-.801 1.285-.727 1.765.183zm0 0M38.602 18.594c0 .183-.22.363-.477.363-.219 0-.844 1.023-1.324 2.262-1.469 3.793-16.176 32.629-16.211 31.718 0-.472-.223-.8-.59-.8-.516 0-.59.289-.367 1.71.219 1.641.074 2.008-5.149 12.071-2.941 5.723-6.101 11.703-7.02 13.305-.956 1.68-1.69 3.5-1.765 4.265-.11 1.313.035 1.496 3.235 4.23 1.84 1.606 4.191 3.61 5.222 4.52 4.63 4.196 6.801 5.871 7.387 5.762.883-.145 14.523-14.328 14.559-15.129 0-.367-.66-5.906-1.47-12.324-1.398-10.938-2.722-23.734-2.573-24.973.109-.765-.442-4.633-.844-6.308-.332-1.313-.184-1.86 2.46-7.84 1.544-3.535 3.567-7.875 4.45-9.625.844-1.75 1.582-3.281 1.582-3.39 0-.11-.258-.18-.55-.18-.298 0-.555.144-.555.363zm-8.454 27.234c.403 2.55 1.211 8.676 1.801 13.598 1.14 9.043 2.461 19.07 2.832 21.62.219 1.278.07 1.532-2.316 4.157-4.156 4.629-8.567 9.188-10.074 10.356l-1.399 1.093-7.168-6.636c-6.617-6.051-7.168-6.672-6.765-7.403.222-.398 2.097-3.789 4.156-7.508 2.058-3.718 4.777-8.68 6.027-11.011 1.29-2.371 2.465-4.41 2.684-4.52.258-.148.332 3.535.258 11.375-.149 11.703-.11 11.739 1.066 11.485.148 0 .258-5.907.258-13.09V56.293l3.86-7.656c2.132-4.23 3.898-7.621 3.972-7.586.07.039.441 2.187.808 4.777zm0 0"/>
      </g>
    </svg>
  ),
  //fa-solid fa-magnifying-glass
  search: (
    <svg aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <path d="M500.3 443.7l-119.7-119.7c27.22-40.41 40.65-90.9 33.46-144.7C401.8 87.79 326.8 13.32 235.2 1.723C99.01-15.51-15.51 99.01 1.724 235.2c11.6 91.64 86.08 166.7 177.6 178.9c53.8 7.189 104.3-6.236 144.7-33.46l119.7 119.7c15.62 15.62 40.95 15.62 56.57 0C515.9 484.7 515.9 459.3 500.3 443.7zM79.1 208c0-70.58 57.42-128 128-128s128 57.42 128 128c0 70.58-57.42 128-128 128S79.1 278.6 79.1 208z"/>
    </svg>
  ),
  //fa-brands fa-markdown
  switchToMarkdown: (
    <svg aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512">
      <path d="M593.8 59.1H46.2C20.7 59.1 0 79.8 0 105.2v301.5c0 25.5 20.7 46.2 46.2 46.2h547.7c25.5 0 46.2-20.7 46.1-46.1V105.2c0-25.4-20.7-46.1-46.2-46.1zM338.5 360.6H277v-120l-61.5 76.9-61.5-76.9v120H92.3V151.4h61.5l61.5 76.9 61.5-76.9h61.5v209.2zm135.3 3.1L381.5 256H443V151.4h61.5V256H566z"/>
    </svg>
  ),
  //fa-solid fa-expand
  gotoFullScreen: (
    <svg aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
      <path d="M128 32H32C14.31 32 0 46.31 0 64v96c0 17.69 14.31 32 32 32s32-14.31 32-32V96h64c17.69 0 32-14.31 32-32S145.7 32 128 32zM416 32h-96c-17.69 0-32 14.31-32 32s14.31 32 32 32h64v64c0 17.69 14.31 32 32 32s32-14.31 32-32V64C448 46.31 433.7 32 416 32zM128 416H64v-64c0-17.69-14.31-32-32-32s-32 14.31-32 32v96c0 17.69 14.31 32 32 32h96c17.69 0 32-14.31 32-32S145.7 416 128 416zM416 320c-17.69 0-32 14.31-32 32v64h-64c-17.69 0-32 14.31-32 32s14.31 32 32 32h96c17.69 0 32-14.31 32-32v-96C448 334.3 433.7 320 416 320z"/>
    </svg>
  ),
  //fa-solid fa-compress
  exitFullScreen: (
    <svg aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
      <path d="M128 320H32c-17.69 0-32 14.31-32 32s14.31 32 32 32h64v64c0 17.69 14.31 32 32 32s32-14.31 32-32v-96C160 334.3 145.7 320 128 320zM416 320h-96c-17.69 0-32 14.31-32 32v96c0 17.69 14.31 32 32 32s32-14.31 32-32v-64h64c17.69 0 32-14.31 32-32S433.7 320 416 320zM320 192h96c17.69 0 32-14.31 32-32s-14.31-32-32-32h-64V64c0-17.69-14.31-32-32-32s-32 14.31-32 32v96C288 177.7 302.3 192 320 192zM128 32C110.3 32 96 46.31 96 64v64H32C14.31 128 0 142.3 0 160s14.31 32 32 32h96c17.69 0 32-14.31 32-32V64C160 46.31 145.7 32 128 32z"/>
    </svg>
  ),
  //fa-solid fa-book-open-reader
  releaseNotes: (
    <svg aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <path d="M0 219.2v212.5c0 14.25 11.62 26.25 26.5 27C75.32 461.2 180.2 471.3 240 511.9V245.2C181.4 205.5 79.99 194.8 29.84 192C13.59 191.1 0 203.6 0 219.2zM482.2 192c-50.09 2.848-151.3 13.47-209.1 53.09C272.1 245.2 272 245.3 272 245.5v266.5c60.04-40.39 164.7-50.76 213.5-53.28C500.4 457.9 512 445.9 512 431.7V219.2C512 203.6 498.4 191.1 482.2 192zM352 96c0-53-43-96-96-96S160 43 160 96s43 96 96 96S352 149 352 96z"/>
    </svg>
  ),
  rawMode: (
    <svg aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60">
      <path stroke="var(--icon-fill-color)" strokeWidth="4" d="M20 10H10m10 0H10m0 0v40m0-40v40m0 0h10m-10 0h10M40 10H30m10 0H30m0 0v40m0-40v40m0 0h10m-10 0h10M60 10h10m-10 0h10m0 0v40m0-40v40m0 0H60m10 0H60M80 10h10m-10 0h10m0 0v40m0-40v40m0 0H80m10 0H80"/>
    </svg>
  ),
  //fa-solid fa-glasses
  parsedMode: (
    <svg aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512">
      <path d="M574.1 280.4l-45.38-181.8c-5.875-23.63-21.62-44-43-55.75c-21.5-11.75-46.1-14.13-70.25-6.375l-15.25 5.125c-8.375 2.75-12.87 11.88-10 20.25l5 15.13c2.75 8.375 11.88 12.88 20.25 10.13l13.12-4.375c10.88-3.625 23-3.625 33.25 1.75c10.25 5.375 17.5 14.5 20.38 25.75l38.38 153.9c-22.12-6.875-49.75-12.5-81.13-12.5c-34.88 0-73.1 7-114.9 26.75H251.4C210.5 258.6 171.4 251.6 136.5 251.6c-31.38 0-59 5.625-81.12 12.5l38.38-153.9c2.875-11.25 10.12-20.38 20.5-25.75C124.4 79.12 136.5 79.12 147.4 82.74l13.12 4.375c8.375 2.75 17.5-1.75 20.25-10.13l5-15.13C188.6 53.49 184.1 44.37 175.6 41.62l-15.25-5.125c-23.13-7.75-48.75-5.375-70.13 6.375c-21.37 11.75-37.12 32.13-43 55.75L1.875 280.4C.6251 285.4 .0001 290.6 .0001 295.9v70.25C.0001 428.1 51.63 480 115.3 480h37.13c60.25 0 110.4-46 114.9-105.4l2.875-38.63h35.75l2.875 38.63C313.3 433.1 363.4 480 423.6 480h37.13c63.62 0 115.2-51 115.2-113.9V295.9C576 290.6 575.4 285.5 574.1 280.4zM203.4 369.7c-2 26-24.38 46.25-51 46.25H115.2C87 415.1 64 393.6 64 366.1v-37.5c18.12-6.5 43.38-13 72.62-13c23.88 0 47.25 4.375 69.88 13L203.4 369.7zM512 366.1c0 27.5-23 49.88-51.25 49.88h-37.13c-26.62 0-49-20.25-51-46.25l-3.125-41.13c22.62-8.625 46.13-13 70-13c29 0 54.38 6.5 72.5 13V366.1z"/>
    </svg>
  ),
  convertFile: (
    <svg aria-hidden="true" focusable="false" role="img" viewBox="0 110 700 340" xmlns="http://www.w3.org/2000/svg">
      <path d="m593.95 239.4v-1.5742c-0.85547-1.8828-2.043-3.6016-3.5-5.0742l-52.5-52.5c-1.4688-1.457-3.1875-2.6445-5.0742-3.5h-1.5742c-1.4727-0.49219-3.0039-0.78516-4.5508-0.875h-124.25c-4.6406 0-9.0938 1.8438-12.375 5.125s-5.125 7.7344-5.125 12.375v87.5h-70v-105.88-1.0508c-0.089844-1.5469-0.38281-3.0781-0.875-4.5508v-1.5742c-0.85547-1.8828-2.043-3.6016-3.5-5.0742l-52.5-52.5c-1.4727-1.457-3.1914-2.6445-5.0742-3.5h-1.5742c-1.7031-0.875-3.5352-1.4688-5.4258-1.75h-123.55c-4.6406 0-9.0938 1.8438-12.375 5.125s-5.125 7.7344-5.125 12.375v245c0 4.6406 1.8438 9.0938 5.125 12.375s7.7344 5.125 12.375 5.125h175c4.6406 0 9.0938-1.8438 12.375-5.125s5.125-7.7344 5.125-12.375v-52.5h70v122.5c0 4.6406 1.8438 9.0938 5.125 12.375s7.7344 5.125 12.375 5.125h175c4.6406 0 9.0938-1.8438 12.375-5.125s5.125-7.7344 5.125-12.375v-192.5-1.0508c-0.14453-1.5547-0.5-3.0859-1.0508-4.5508zm-313.95 110.6h-140v-210h87.5v35c0 4.6406 1.8438 9.0938 5.125 12.375s7.7344 5.125 12.375 5.125h35v87.5h-52.5c-6.2539 0-12.031 3.3359-15.156 8.75s-3.125 12.086 0 17.5 8.9023 8.75 15.156 8.75h52.5zm140 70v-105h27.824l-5.0742 5.0742c-3.7031 3.1719-5.9141 7.7461-6.1055 12.617-0.1875 4.8711 1.668 9.6016 5.1133 13.051 3.4492 3.4453 8.1797 5.3008 13.051 5.1133 4.8711-0.19141 9.4453-2.4023 12.617-6.1055l35-35c3.2578-3.2773 5.0898-7.7148 5.0898-12.336 0-4.625-1.832-9.0586-5.0898-12.34l-35-35c-4.5078-3.8555-10.66-5.1719-16.348-3.4883-5.6875 1.6797-10.137 6.1289-11.816 11.816-1.6836 5.6914-0.37109 11.844 3.4883 16.348l5.0742 5.0742h-27.824v-69.824h87.5v35c0 4.6406 1.8438 9.0938 5.125 12.375s7.7344 5.125 12.375 5.125h35v157.5z"/>
    </svg>
  ),
  cog: (
    <svg aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <path d="M495.9 166.6C499.2 175.2 496.4 184.9 489.6 191.2L446.3 230.6C447.4 238.9 448 247.4 448 256C448 264.6 447.4 273.1 446.3 281.4L489.6 320.8C496.4 327.1 499.2 336.8 495.9 345.4C491.5 357.3 486.2 368.8 480.2 379.7L475.5 387.8C468.9 398.8 461.5 409.2 453.4 419.1C447.4 426.2 437.7 428.7 428.9 425.9L373.2 408.1C359.8 418.4 344.1 427 329.2 433.6L316.7 490.7C314.7 499.7 307.7 506.1 298.5 508.5C284.7 510.8 270.5 512 255.1 512C241.5 512 227.3 510.8 213.5 508.5C204.3 506.1 197.3 499.7 195.3 490.7L182.8 433.6C167 427 152.2 418.4 138.8 408.1L83.14 425.9C74.3 428.7 64.55 426.2 58.63 419.1C50.52 409.2 43.12 398.8 36.52 387.8L31.84 379.7C25.77 368.8 20.49 357.3 16.06 345.4C12.82 336.8 15.55 327.1 22.41 320.8L65.67 281.4C64.57 273.1 64 264.6 64 256C64 247.4 64.57 238.9 65.67 230.6L22.41 191.2C15.55 184.9 12.82 175.3 16.06 166.6C20.49 154.7 25.78 143.2 31.84 132.3L36.51 124.2C43.12 113.2 50.52 102.8 58.63 92.95C64.55 85.8 74.3 83.32 83.14 86.14L138.8 103.9C152.2 93.56 167 84.96 182.8 78.43L195.3 21.33C197.3 12.25 204.3 5.04 213.5 3.51C227.3 1.201 241.5 0 256 0C270.5 0 284.7 1.201 298.5 3.51C307.7 5.04 314.7 12.25 316.7 21.33L329.2 78.43C344.1 84.96 359.8 93.56 373.2 103.9L428.9 86.14C437.7 83.32 447.4 85.8 453.4 92.95C461.5 102.8 468.9 113.2 475.5 124.2L480.2 132.3C486.2 143.2 491.5 154.7 495.9 166.6V166.6zM256 336C300.2 336 336 300.2 336 255.1C336 211.8 300.2 175.1 256 175.1C211.8 175.1 176 211.8 176 255.1C176 300.2 211.8 336 256 336z"/>
    </svg>
  )
}