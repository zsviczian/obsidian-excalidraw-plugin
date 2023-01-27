import { ExcalidrawImageElement } from "@zsviczian/excalidraw/types/element/types";
import { AppState, ExcalidrawImperativeAPI } from "@zsviczian/excalidraw/types/types";
import clsx from "clsx";
import { backgroundClip } from "html2canvas/dist/types/css/property-descriptors/background-clip";
import { TFile } from "obsidian";
import * as React from "react";
import { VIEW_TYPE_EXCALIDRAW } from "src/Constants";
import { PenSettingsModal } from "src/dialogs/PenSettingsModal";
import { ReleaseNotes } from "src/dialogs/ReleaseNotes";
import ExcalidrawView from "src/ExcalidrawView";
import { t } from "src/lang/helpers";
import { PENS } from "src/utils/Pens";
import ExcalidrawPlugin from "../main";
import { ICONS, penIcon, stringToSVG } from "./ActionIcons";

declare const PLUGIN_VERSION:string;

export class ObsidianMenu {
  private clickTimestamp:number[];
  constructor(
    private plugin: ExcalidrawPlugin,
    private toolsRef: React.MutableRefObject<any>,
    private view: ExcalidrawView
  ) {
    this.clickTimestamp = Array.from({length: Object.keys(PENS).length}, () => 0);
  }

  renderButton = (isMobile: boolean, appState: AppState) => {
    return (
      <>
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
            this.toolsRef.current.toggleVisibility(
              appState.zenModeEnabled || isMobile,
            );
          }}
        >
          <div className="ToolIcon__icon" aria-hidden="true">
            {ICONS.obsidian}
          </div>
        </label>
        {appState.customPens?.map((key,index)=>{ //custom pens
          const pen = this.plugin.settings.customPens[index]
          //Reset stroke setting when changing to a different tool
          if( 
            appState.resetCustomPen &&
            appState.activeTool.type !== "freedraw" &&
            appState.currentStrokeOptions === pen.penOptions
          ) {
            setTimeout(()=>{
              const api = this.view.excalidrawAPI;
              const st = appState.resetCustomPen;
              api.updateScene({
                appState: {
                  currentItemStrokeWidth: st.currentItemStrokeWidth,
                  currentItemBackgroundColor: st.currentItemBackgroundColor,
                  currentItemStrokeColor: st.currentItemStrokeColor,
                  currentItemFillStyle: st.currentItemFillStyle,
                  currentItemRoughness: st.currentItemRoughness,
                  resetCustomPen: null,
                }
              })
            })
          }
          //if Pen settings are loaded, select custom pen when activating the freedraw element
          if (
            !appState.resetCustomPen &&
            appState.activeTool.type === "freedraw" &&
            appState.currentStrokeOptions === pen.penOptions
          ) {
            setTimeout(()=>{
              const api = this.view.excalidrawAPI;
              const st = api.getAppState();
              api.updateScene({
                appState: {
                  currentStrokeOptions: pen.penOptions,
                  ...pen.strokeWidth === 0 ? null : {currentItemStrokeWidth: pen.strokeWidth},
                  ...pen.backgroundColor ? {currentItemBackgroundColor: pen.backgroundColor} : null,
                  ...pen.strokeColor ? {currentItemStrokeColor: pen.strokeColor} : null,
                  ...pen.fillStyle === "" ? null : {currentItemFillStyle: pen.fillStyle},
                  ...pen.roughness ? null : {currentItemRoughness: pen.roughness},
                  ...pen.freedrawOnly ? {resetCustomPen: {
                    currentItemStrokeWidth: st.currentItemStrokeWidth,
                    currentItemBackgroundColor: st.currentItemBackgroundColor,
                    currentItemStrokeColor: st.currentItemStrokeColor,
                    currentItemFillStyle: st.currentItemFillStyle,
                    currentItemRoughness: st.currentItemRoughness,
                  }} : {}
                }
              })
            })
          }
          return (
            <label
              key={index}
              className={clsx(
                "ToolIcon ToolIcon_type_floating",
                "ToolIcon_size_medium",
                {
                  "is-mobile": isMobile,
                },
              )}
              onClick={() => {
                const now = Date.now();
                const dblClick = now-this.clickTimestamp[index] < 500;
                //open pen settings on double click
                if(dblClick) {
                  const penSettings = new PenSettingsModal(this.plugin,this.view,index);
                  (async () => {
                    await this.plugin.loadSettings();
                    penSettings.open();
                  })();
                  return;
                }
                this.clickTimestamp[index] = now;
                
                const api = this.view.excalidrawAPI;
                const st = api.getAppState();
                //single second click to reset freedraw to default
                if(st.currentStrokeOptions === pen.penOptions) {
                  const rcp = st.resetCustomPen;
                  api.updateScene({
                    appState: {
                      ...rcp ? {
                        currentItemStrokeWidth: rcp.currentItemStrokeWidth,
                        currentItemBackgroundColor: rcp.currentItemBackgroundColor,
                        currentItemStrokeColor: rcp.currentItemStrokeColor,
                        currentItemFillStyle: rcp.currentItemFillStyle,
                        currentItemRoughness: rcp.currentItemRoughness
                      }:{},
                      resetCustomPen: null,
                      currentStrokeOptions: null,
                    }
                  })

                  return;
                }

                //apply pen settings to canvas
                api.updateScene({
                  appState: {
                    currentStrokeOptions: pen.penOptions,
                    ...pen.strokeWidth === 0 ? null : {currentItemStrokeWidth: pen.strokeWidth},
                    ...pen.backgroundColor ? {currentItemBackgroundColor: pen.backgroundColor} : null,
                    ...pen.strokeColor ? {currentItemStrokeColor: pen.strokeColor} : null,
                    ...pen.fillStyle === "" ? null : {currentItemFillStyle: pen.fillStyle},
                    ...pen.roughness ? null : {currentItemRoughness: pen.roughness},
                    ...pen.freedrawOnly ? {resetCustomPen: {
                      currentItemStrokeWidth: st.currentItemStrokeWidth,
                      currentItemBackgroundColor: st.currentItemBackgroundColor,
                      currentItemStrokeColor: st.currentItemStrokeColor,
                      currentItemFillStyle: st.currentItemFillStyle,
                      currentItemRoughness: st.currentItemRoughness,
                    }} : {}
                  }
                });
                api.setActiveTool({type:"freedraw"});
              }}
            >
              <div
                className="ToolIcon__icon"
                aria-label={pen.type}
                style={{
                  ...appState.activeTool.type === "freedraw" && appState.currentStrokeOptions === pen.penOptions
                    ? {background: "var(--color-primary)"}
                    : {}
                }}
              >
                {penIcon(pen)}
              </div>
            </label>

          )
        })}
        {appState?.pinnedScripts?.map((key,index)=>{ //pinned scripts
          const scriptProp = this.plugin.scriptEngine.scriptIconMap[key];
          const name = scriptProp?.name ?? "";
          const icon = scriptProp?.svgString
            ? stringToSVG(scriptProp.svgString)
            : ICONS.cog;
          let longpressTimout = 0;
          return (
            <label
              key = {index}
              className={clsx(
                "ToolIcon ToolIcon_type_floating",
                "ToolIcon_size_medium",
                {
                  "is-mobile": isMobile,
                },
              )}
              onClick={() => {
                if(longpressTimout) {
                  window.clearTimeout(longpressTimout);
                  longpressTimout = 0;
                  (async ()=>{
                    const f = app.vault.getAbstractFileByPath(key);
                    if (f && f instanceof TFile) {
                      this.plugin.scriptEngine.executeScript(
                        this.view,
                        await app.vault.read(f),
                        this.plugin.scriptEngine.getScriptName(f),
                        f
                      );
                    }
                  })()
                }
              }}
              onPointerDown={()=>{
                longpressTimout = window.setTimeout(
                  () => {
                    longpressTimout = 0;
                    (async () =>{
                      await this.plugin.loadSettings();
                      const index = this.plugin.settings.pinnedScripts.indexOf(key)
                      if(index > -1) {
                        this.plugin.settings.pinnedScripts.splice(index,1);
                        this.view.excalidrawAPI?.setToast({message:`Pin removed: ${name}`});
                      } 
                      await this.plugin.saveSettings();
                      app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW).forEach(v=> {
                        if (v.view instanceof ExcalidrawView) v.view.updatePinnedScripts()
                      })
                      })()
                  },
                  1500
                )
              }}
            >
              <div className="ToolIcon__icon" aria-label={name}>
                {icon}
              </div>
            </label>
          )
        })}
      </>
    );
  };
}
