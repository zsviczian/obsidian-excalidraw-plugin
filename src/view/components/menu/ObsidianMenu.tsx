import {
  AppState,
  ExcalidrawImperativeAPI,
} from "@zsviczian/excalidraw/types/excalidraw/types";
import clsx from "clsx";
import { TFile } from "obsidian";
import * as React from "react";
import { DEVICE } from "src/constants/constants";
import { PenSettingsModal } from "src/shared/Dialogs/PenSettingsModal";
import ExcalidrawView from "src/view/ExcalidrawView";
import { ExtendedFillStyle, PenStyle } from "src/types/penTypes";
import { PENS } from "src/utils/pens";
import ExcalidrawPlugin from "../../../core/main";
import { ICONS, penIcon, stringToSVG } from "../../../constants/actionIcons";
import { UniversalInsertFileModal } from "src/shared/Dialogs/UniversalInsertFileModal";
import { t } from "src/lang/helpers";
import { getExcalidrawViews } from "src/utils/obsidianUtils";
import { CaptureUpdateAction } from "src/constants/constants";
import {
  getAppStateStrokeWidthEntry,
  getFreedrawStrokeWidthByKey,
} from "src/utils/excalidrawAutomateUtils";
import { ToolsPanel } from "./ToolsPanel";

export type ResetCustomPenState = {
  currentItemStrokeWidthKey?: string;
  currentItemStrokeWidth?: number;
  currentItemStrokeVariability?: string;
  currentItemBackgroundColor?: string;
  currentItemStrokeColor?: string;
  currentItemFillStyle?: string;
  currentItemRoughness?: number;
};

export function setPen(pen: PenStyle, api: ExcalidrawImperativeAPI) {
  const st = api.getAppState();
  const strokeWidthEntry =
    !pen.strokeWidth || pen.strokeWidth === 0
      ? {}
      : getAppStateStrokeWidthEntry(undefined, pen.strokeWidth);

  // Changed null to undefined so it neatly satisfies Partial<...>
  const currentItemStrokeWidthKey =
    "currentItemStrokeWidthKey" in strokeWidthEntry
      ? strokeWidthEntry.currentItemStrokeWidthKey
      : undefined;
  const currentItemStrokeWidth =
    "currentItemStrokeWidth" in strokeWidthEntry
      ? strokeWidthEntry.currentItemStrokeWidth
      : undefined;

  // 1. Build the object and explicitly type it as your custom AppState
  const nextAppState: Partial<AppState> = {
    currentStrokeOptions: pen.penOptions,
    currentItemStrokeWidthKey,
    currentItemStrokeWidth,
    currentItemStrokeVariability: pen.penOptions.constantPressure
      ? "constant"
      : "variable",
    ...(pen.backgroundColor
      ? { currentItemBackgroundColor: pen.backgroundColor }
      : null),
    ...(pen.strokeColor ? { currentItemStrokeColor: pen.strokeColor } : null),
    ...(pen.fillStyle === "" ? null : { currentItemFillStyle: pen.fillStyle }),
    ...(pen.roughness !== null
      ? { currentItemRoughness: pen.roughness }
      : null),
    ...(pen.freedrawOnly && !st.resetCustomPen //switching from custom pen to next custom pen
      ? {
          resetCustomPen: {
            currentItemStrokeWidthKey: st.currentItemStrokeWidthKey as
              | "extraThin"
              | "thin"
              | "medium"
              | "bold"
              | "extraBold",
            currentItemStrokeWidth: st.currentItemStrokeWidth,
            currentItemStrokeVariability: st.currentItemStrokeVariability as
              | "constant"
              | "variable",
            currentItemBackgroundColor: st.currentItemBackgroundColor,
            currentItemStrokeColor: st.currentItemStrokeColor,
            currentItemFillStyle: st.currentItemFillStyle as ExtendedFillStyle,
            currentItemRoughness: st.currentItemRoughness,
          },
        }
      : null),
  };

  // 2. Cast it back to Partial<AppState> here to satisfy Excalidraw's API
  api.updateScene({
    appState: nextAppState as Pick<AppState, keyof AppState>,
    captureUpdate: CaptureUpdateAction.NEVER,
  });
}

export function resetStrokeOptions(
  resetCustomPen: ResetCustomPenState | null,
  api: ExcalidrawImperativeAPI,
  clearCurrentStrokeOptions: boolean,
) {
  // 1. Build the object and explicitly type it as your custom AppState
  const nextAppState: Partial<AppState> = {
    ...(resetCustomPen
      ? {
          currentItemStrokeWidthKey: resetCustomPen.currentItemStrokeWidthKey,
          currentItemStrokeWidth: resetCustomPen.currentItemStrokeWidth,
          currentItemBackgroundColor: resetCustomPen.currentItemBackgroundColor,
          currentItemStrokeColor: resetCustomPen.currentItemStrokeColor,
          currentItemFillStyle: resetCustomPen.currentItemFillStyle,
          currentItemRoughness: resetCustomPen.currentItemRoughness,
          currentItemStrokeVariability:
            resetCustomPen.currentItemStrokeVariability,
        }
      : null),
    resetCustomPen: null,
    ...(clearCurrentStrokeOptions ? { currentStrokeOptions: null } : null),
  };

  // 2. Cast it back to Partial<AppState> here to satisfy Excalidraw's API
  api.updateScene({
    appState: nextAppState as Pick<AppState, keyof AppState>,
    captureUpdate: CaptureUpdateAction.NEVER,
  });
}

export class ObsidianMenu {
  private clickTimestamp: number[];
  private activePens: Record<number, PenStyle> = {};
  private longpressTimeout: { [key: number]: number } = {};
  private prevClickTimestamp: number = 0;
  constructor(
    private plugin: ExcalidrawPlugin,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ref instance is injected from ToolsPanel and carries imperative methods.
    private toolsRef: React.MutableRefObject<ToolsPanel>,
    private view: ExcalidrawView,
  ) {
    this.clickTimestamp = Array.from(
      { length: Object.keys(PENS).length },
      () => 0,
    );
  }

  private actionCustomPenLabelClick(index: number, pen: PenStyle) {
    const now = Date.now();
    const dblClick = now - this.clickTimestamp[index] < 500;
    //open pen settings on double click
    if (dblClick) {
      const penSettings = new PenSettingsModal(this.plugin, this.view, index);
      void (async () => {
        await this.plugin.loadSettings();
        penSettings.open();
      })();
      return;
    }
    this.clickTimestamp[index] = now;

    const api = this.view.excalidrawAPI;
    const st = api.getAppState();

    //single second click to reset freedraw to default
    if (
      st.currentStrokeOptions === pen.penOptions &&
      st.activeTool.type === "freedraw"
    ) {
      resetStrokeOptions(st.resetCustomPen as ResetCustomPenState, api, true);
      return;
    }

    //apply pen settings to canvas
    this.activePens[index] = this.activePens[index] ?? { ...pen };
    setPen(this.activePens[index], api);
    api.setActiveTool({ type: "freedraw" });
  }

  private actionScriptButtonPointerUp(index: number, key: string) {
    if (this.longpressTimeout[index]) {
      this.view.ownerWindow.clearTimeout(this.longpressTimeout[index]);
      this.longpressTimeout[index] = 0;
      void (async () => {
        const f = this.view.app.vault.getAbstractFileByPath(key);
        if (f && f instanceof TFile) {
          await this.plugin.scriptEngine.executeScript(
            this.view,
            await this.view.app.vault.read(f),
            this.plugin.scriptEngine.getScriptName(f),
            f,
          );
        }
      })();
    }
  }

  private actionScriptButtonPointerDown(
    index: number,
    key: string,
    name: string,
  ) {
    const now = Date.now();
    if (this.longpressTimeout[index] > 0) {
      this.view.ownerWindow.clearTimeout(this.longpressTimeout[index]);
      this.longpressTimeout[index] = 0;
    }
    if (now - this.prevClickTimestamp >= 500) {
      this.longpressTimeout[index] = this.view.ownerWindow.setTimeout(() => {
        this.longpressTimeout[index] = 0;
        void (async () => {
          await this.plugin.loadSettings();
          const index = this.plugin.settings.pinnedScripts.indexOf(key);
          if (index > -1) {
            this.plugin.settings.pinnedScripts.splice(index, 1);
            this.view.excalidrawAPI?.setToast({
              message: `Pin removed: ${name}`,
              duration: 3000,
              closable: true,
            });
          }
          await this.plugin.saveSettings();
          getExcalidrawViews(this.plugin.app, true).forEach((excalidrawView) =>
            excalidrawView.updatePinnedScripts(),
          );
        })();
      }, 1500);
    }
    this.prevClickTimestamp = now;
  }

  private actionShowHideMenu(isMobile: boolean, appState: AppState) {
    this.toolsRef.current.setTheme(appState.theme as "dark" | "light");
    this.toolsRef.current.toggleVisibility(appState.zenModeEnabled || isMobile);
  }

  private actionInsertAnyFile() {
    this.view.setCurrentPositionToCenter();
    const insertFileModal = new UniversalInsertFileModal(
      this.plugin,
      this.view,
    );
    insertFileModal.open();
  }

  private actionToggleFullscreen() {
    if (this.view.isFullscreen()) {
      this.view.exitFullscreen();
    } else {
      this.view.gotoFullscreen();
    }
    this.view.excalidrawAPI?.updateScene({
      appState: {},
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }

  public renderCustomPens(isMobile: boolean, appState: AppState) {
    return appState.customPens?.map((_, index) => {
      const pen = this.plugin.settings.customPens[index];
      //Reset stroke setting when changing to a different tool
      if (
        appState.resetCustomPen &&
        appState.activeTool.type !== "freedraw" &&
        appState.currentStrokeOptions === pen.penOptions
      ) {
        window.setTimeout(() =>
          resetStrokeOptions(
            appState.resetCustomPen as ResetCustomPenState,
            this.view.excalidrawAPI,
            false,
          ),
        );
      }
      //if Pen settings are loaded, select custom pen when activating the freedraw element
      if (
        !appState.resetCustomPen &&
        appState.activeTool.type === "freedraw" &&
        appState.currentStrokeOptions === pen.penOptions &&
        pen.freedrawOnly
      ) {
        window.setTimeout(() =>
          setPen(this.activePens[index] ?? pen, this.view.excalidrawAPI),
        );
      }

      if (
        appState.resetCustomPen &&
        appState.activeTool.type === "freedraw" &&
        appState.currentStrokeOptions === pen.penOptions &&
        pen.freedrawOnly
      ) {
        const activePen = this.activePens[index] ?? { ...pen };
        activePen.strokeWidth = getFreedrawStrokeWidthByKey(
          appState.currentItemStrokeWidthKey as
            | "extraThin"
            | "thin"
            | "medium"
            | "bold"
            | "extraBold",
          appState.currentItemStrokeWidth,
        );
        activePen.backgroundColor = appState.currentItemBackgroundColor;
        activePen.strokeColor = appState.currentItemStrokeColor;
        activePen.fillStyle =
          appState.currentItemFillStyle as ExtendedFillStyle;
        activePen.roughness = appState.currentItemRoughness;
        this.activePens[index] = activePen;
      }

      return (
        <label
          key={index}
          className={clsx("ToolIcon", "ToolIcon_size_medium", {
            "is-mobile": isMobile,
          })}
          onClick={() => this.actionCustomPenLabelClick(index, pen)}
        >
          <div
            className="ToolIcon__icon"
            aria-label={DEVICE.isDesktop ? pen.type : undefined}
            style={{
              ...(appState.activeTool.type === "freedraw" &&
              appState.currentStrokeOptions === pen.penOptions
                ? { background: "var(--color-primary)" }
                : {}),
            }}
          >
            {penIcon(pen)}
          </div>
        </label>
      );
    });
  }

  public renderPinnedScriptButtons(isMobile: boolean, appState: AppState) {
    return appState?.pinnedScripts?.map((key, index) => {
      //pinned scripts
      const scriptProp = this.plugin.scriptEngine.scriptIconMap[key];
      const name = scriptProp?.name ?? "";
      const icon = scriptProp?.svgString
        ? stringToSVG(scriptProp.svgString)
        : ICONS.cog;
      if (!this.longpressTimeout[index]) {
        this.longpressTimeout[index] = 0;
      }
      return (
        <label
          key={index}
          className={clsx("ToolIcon", "ToolIcon_size_medium", {
            "is-mobile": isMobile,
          })}
          onPointerUp={() => this.actionScriptButtonPointerUp(index, key)}
          onPointerDown={() =>
            this.actionScriptButtonPointerDown(index, key, name)
          }
        >
          <div
            className="ToolIcon__icon"
            aria-label={DEVICE.isDesktop ? name : undefined}
          >
            {icon}
          </div>
        </label>
      );
    });
  }

  public renderButton(isMobile: boolean, appState: AppState) {
    const isFullscreen = this.view.isFullscreen();
    return (
      <>
        <label
          className={clsx("ToolIcon", "ToolIcon_size_medium", {
            "is-mobile": isMobile,
          })}
          onClick={() => this.actionShowHideMenu(isMobile, appState)}
        >
          <div
            className="ToolIcon__icon"
            aria-label={t("OBSIDIAN_TOOLS_PANEL")}
          >
            {ICONS.obsidian}
          </div>
        </label>
        <label
          className={clsx("ToolIcon", "ToolIcon_size_medium", {
            "is-mobile": isMobile,
          })}
          onClick={() => this.actionInsertAnyFile()}
        >
          <div className="ToolIcon__icon" aria-label={t("UNIVERSAL_ADD_FILE")}>
            {ICONS["add-file"]}
          </div>
        </label>
        <label
          className={clsx("ToolIcon", "ToolIcon_size_medium", {
            "is-mobile": isMobile,
          })}
          onClick={() => this.actionToggleFullscreen()}
        >
          <div
            className="ToolIcon__icon"
            aria-label={
              isFullscreen ? t("EXIT_FULLSCREEN") : t("GOTO_FULLSCREEN")
            }
          >
            {isFullscreen ? ICONS.exitFullScreen : ICONS.gotoFullScreen}
          </div>
        </label>
        {this.renderCustomPens(isMobile, appState)}
        {this.renderPinnedScriptButtons(isMobile, appState)}
      </>
    );
  }

  destroy() {
    Object.values(this.longpressTimeout).forEach((t) =>
      this.view.ownerWindow.clearTimeout(t),
    );
    this.longpressTimeout = {};
    this.activePens = {};
    this.plugin = null;
    this.toolsRef = null;
    this.view = null;
    this.clickTimestamp = null;
    this.renderButton = null;
    this.renderCustomPens = null;
    this.renderPinnedScriptButtons = null;
  }
}
