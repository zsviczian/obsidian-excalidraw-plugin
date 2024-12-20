import { AppState, ExcalidrawImperativeAPI } from "@zsviczian/excalidraw/types/excalidraw/types";
import clsx from "clsx";
import { TFile } from "obsidian";
import * as React from "react";
import { DEVICE } from "src/constants/constants";
import { PenSettingsModal } from "src/shared/Dialogs/PenSettingsModal";
import ExcalidrawView from "src/view/ExcalidrawView";
import { PenStyle } from "src/types/penTypes";
import { PENS } from "src/utils/pens";
import ExcalidrawPlugin from "../../../core/main";
import { ICONS, penIcon, stringToSVG } from "../../../constants/actionIcons";
import { UniversalInsertFileModal } from "src/shared/Dialogs/UniversalInsertFileModal";
import { t } from "src/lang/helpers";
import { getExcalidrawViews } from "src/utils/obsidianUtils";

export function setPen (pen: PenStyle, api: any) {
  const st = api.getAppState();
  api.updateScene({
    appState: {
      currentStrokeOptions: pen.penOptions,
      ...(!pen.strokeWidth || (pen.strokeWidth === 0)) ? null : {currentItemStrokeWidth: pen.strokeWidth},
      ...pen.backgroundColor ? {currentItemBackgroundColor: pen.backgroundColor} : null,
      ...pen.strokeColor ? {currentItemStrokeColor: pen.strokeColor} : null,
      ...pen.fillStyle === "" ? null : {currentItemFillStyle: pen.fillStyle},
      ...pen.roughness ? null : {currentItemRoughness: pen.roughness},
      ...pen.freedrawOnly && !st.resetCustomPen //switching from custom pen to next custom pen
        ? {
          resetCustomPen: {
            currentItemStrokeWidth:     st.currentItemStrokeWidth,
            currentItemBackgroundColor: st.currentItemBackgroundColor,
            currentItemStrokeColor:     st.currentItemStrokeColor,
            currentItemFillStyle:       st.currentItemFillStyle,
            currentItemRoughness:       st.currentItemRoughness,
          }} 
        : null,
    },
    storeAction: "update",
  })
}

export function resetStrokeOptions (resetCustomPen:any, api: ExcalidrawImperativeAPI, clearCurrentStrokeOptions: boolean) {
  api.updateScene({
    appState: {
      ...resetCustomPen ? {
        currentItemStrokeWidth:     resetCustomPen.currentItemStrokeWidth,
        currentItemBackgroundColor: resetCustomPen.currentItemBackgroundColor,
        currentItemStrokeColor:     resetCustomPen.currentItemStrokeColor,
        currentItemFillStyle:       resetCustomPen.currentItemFillStyle,
        currentItemRoughness:       resetCustomPen.currentItemRoughness,
      }: null,
      resetCustomPen: null,
      ...clearCurrentStrokeOptions ? {currentStrokeOptions: null} : null,
    },
    storeAction: "update",
  });
}

export class ObsidianMenu {
  private clickTimestamp:number[];
  private activePen: PenStyle;
  private longpressTimeout : { [key: number]: number } = {};
  private prevClickTimestamp: number = 0;
  constructor(
    private plugin: ExcalidrawPlugin,
    private toolsRef: React.MutableRefObject<any>,
    private view: ExcalidrawView,
  ) {
    this.clickTimestamp = Array.from({length: Object.keys(PENS).length}, () => 0);
  }

  private actionCustomPenLabelClick(index: number, pen: PenStyle) {
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
    if(st.currentStrokeOptions === pen.penOptions && st.activeTool.type === "freedraw") {
      resetStrokeOptions(st.resetCustomPen, api, true);
      return;
    }

    //apply pen settings to canvas
    this.activePen = {...pen};
    setPen(pen,api);
    api.setActiveTool({type:"freedraw"});
  }

  private actionScriptButtonPonterUp(index: number, key: string) {
    if(this.longpressTimeout[index]) {
      this.view.ownerWindow.clearTimeout(this.longpressTimeout[index]);
      this.longpressTimeout[index] = 0;
      (async ()=>{
        const f = this.view.app.vault.getAbstractFileByPath(key);
        if (f && f instanceof TFile) {
          this.plugin.scriptEngine.executeScript(
            this.view,
            await this.view.app.vault.read(f),
            this.plugin.scriptEngine.getScriptName(f),
            f
          );
        }
      })()
    }
  }

  private actionScriptButtonPointerDown(index: number, key: string) {
    const now = Date.now();
    if(this.longpressTimeout[index]>0) {
      this.view.ownerWindow.clearTimeout(this.longpressTimeout[index]);
      this.longpressTimeout[index] = 0;
    }
    if(now-this.prevClickTimestamp >= 500) {
      this.longpressTimeout[index] = this.view.ownerWindow.setTimeout(
        () => {
          this.longpressTimeout[index] = 0;
          (async () =>{
            await this.plugin.loadSettings();
            const index = this.plugin.settings.pinnedScripts.indexOf(key)
            if(index > -1) {
              this.plugin.settings.pinnedScripts.splice(index,1);
              this.view.excalidrawAPI?.setToast({message:`Pin removed: ${name}`, duration: 3000, closable: true});
            } 
            await this.plugin.saveSettings();
            getExcalidrawViews(this.plugin.app).forEach(excalidrawView=>excalidrawView.updatePinnedScripts());
          })()
        },
        1500
      )
    }
    this.prevClickTimestamp = now;
  }

  private actionShowHideMenu (isMobile: boolean, appState: AppState) {
    this.toolsRef.current.setTheme(appState.theme);
    this.toolsRef.current.toggleVisibility(
      appState.zenModeEnabled || isMobile,
    );
  }

  private actionInsertAnyFile() {
    this.view.setCurrentPositionToCenter();
    const insertFileModal = new UniversalInsertFileModal(this.plugin, this.view);
    insertFileModal.open();
  }

  public renderCustomPens (isMobile: boolean, appState: AppState) {
    return(
      appState.customPens?.map((_,index)=>{
        const pen = this.plugin.settings.customPens[index]
        //Reset stroke setting when changing to a different tool
        if( 
          appState.resetCustomPen &&
          appState.activeTool.type !== "freedraw" &&
          appState.currentStrokeOptions === pen.penOptions
        ) {
          setTimeout(()=> resetStrokeOptions(appState.resetCustomPen, this.view.excalidrawAPI, false));
        }
        //if Pen settings are loaded, select custom pen when activating the freedraw element
        if (
          !appState.resetCustomPen &&
          appState.activeTool.type === "freedraw" &&
          appState.currentStrokeOptions === pen.penOptions &&
          pen.freedrawOnly
        ) {
          setTimeout(()=>setPen(this.activePen,this.view.excalidrawAPI));
        }

        if(
          this.activePen &&
          appState.resetCustomPen &&
          appState.activeTool.type === "freedraw" &&
          appState.currentStrokeOptions === pen.penOptions &&
          pen.freedrawOnly
        ) {
          this.activePen.strokeWidth = appState.currentItemStrokeWidth;
          this.activePen.backgroundColor = appState.currentItemBackgroundColor;
          this.activePen.strokeColor = appState.currentItemStrokeColor;
          this.activePen.fillStyle = appState.currentItemFillStyle;
          this.activePen.roughness = appState.currentItemRoughness;
        }

        return (
          <label
            key={index}
            className={clsx(
              "ToolIcon",
              "ToolIcon_size_medium",
              {
                "is-mobile": isMobile,
              },
            )}
            onClick={ this.actionCustomPenLabelClick.bind(this,index, pen) }
          >
            <div
              className="ToolIcon__icon"
              aria-label={DEVICE.isDesktop ? pen.type : undefined}
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
      })
    )
  }

  public renderPinnedScriptButtons (isMobile: boolean, appState: AppState) {
    return (
      appState?.pinnedScripts?.map((key,index)=>{ //pinned scripts
        const scriptProp = this.plugin.scriptEngine.scriptIconMap[key];
        const name = scriptProp?.name ?? "";
        const icon = scriptProp?.svgString
          ? stringToSVG(scriptProp.svgString)
          : ICONS.cog;
        if(!this.longpressTimeout[index]) this.longpressTimeout[index] = 0;
        return (
          <label
            key = {index}
            className={clsx(
              "ToolIcon",
              "ToolIcon_size_medium",
              {
                "is-mobile": isMobile,
              },
            )}
            onPointerUp={this.actionScriptButtonPonterUp.bind(this,index,key)}
            onPointerDown={this.actionScriptButtonPointerDown.bind(this,index,key)}
          >
            <div
              className="ToolIcon__icon"
              aria-label={DEVICE.isDesktop ? name : undefined}
            >
              {icon}
            </div>
          </label>
        )
      })
    )
  }

  public renderButton (isMobile: boolean, appState: AppState) {
    return (
      <>
        <label
          className={clsx(
            "ToolIcon",
            "ToolIcon_size_medium",
            {
              "is-mobile": isMobile,
            },
          )}
          onClick={this.actionShowHideMenu.bind(this,isMobile,appState)}
        >
          <div className="ToolIcon__icon" aria-label={t("OBSIDIAN_TOOLS_PANEL")}>
            {ICONS.obsidian}
          </div>
        </label>
        <label
          className={clsx(
            "ToolIcon",
            "ToolIcon_size_medium",
            {
              "is-mobile": isMobile,
            },
          )}
          onClick={this.actionInsertAnyFile.bind(this)}
        >
          <div className="ToolIcon__icon" aria-label={t("UNIVERSAL_ADD_FILE")}>
            {ICONS["add-file"]}
          </div>
        </label>
        {this.renderCustomPens(isMobile,appState)}
        {this.renderPinnedScriptButtons(isMobile,appState)}
      </>
    );
  };

  destroy() {
    Object.values(this.longpressTimeout).forEach(
      t=>this.view.ownerWindow.clearTimeout(t)
    );
    this.longpressTimeout = {};
    this.activePen = null;
    this.plugin = null;
    this.toolsRef = null;
    this.view = null;
    this.clickTimestamp = null;
    this.renderButton = null;
    this.renderCustomPens = null;
    this.renderPinnedScriptButtons = null;
  }
}
