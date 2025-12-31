import clsx from "clsx";
import { Notice, TFile } from "obsidian";
import * as React from "react";
import { ActionButton } from "./ActionButton";
import { ICONS, saveIcon, stringToSVG } from "../../../constants/actionIcons";
import { DEVICE, SCRIPT_INSTALL_FOLDER } from "../../../constants/constants";
import { insertLaTeXToView, search } from "../../../utils/excalidrawAutomateUtils";
import ExcalidrawView, { TextMode } from "../../ExcalidrawView";
import { t } from "../../../lang/helpers";
import { ReleaseNotes } from "../../../shared/Dialogs/ReleaseNotes";
import { ScriptIconMap } from "../../../shared/Scripts";
import { ScriptInstallPrompt } from "src/shared/Dialogs/ScriptInstallPrompt";
import { ExcalidrawImperativeAPI } from "@zsviczian/excalidraw/types/excalidraw/types";
import { isWinALTorMacOPT, isWinCTRLorMacCMD, isSHIFT } from "src/utils/modifierkeyHelper";
import { InsertPDFModal } from "src/shared/Dialogs/InsertPDFModal";
import { ExportDialog } from "src/shared/Dialogs/ExportDialog";
import { openExternalLink } from "src/utils/excalidrawViewUtils";
import { UniversalInsertFileModal } from "src/shared/Dialogs/UniversalInsertFileModal";
import { DEBUGGING, debug } from "src/utils/debugHelper";
import { REM_VALUE } from "src/core/managers/StylesManager";
import { getExcalidrawViews } from "src/utils/obsidianUtils";
import { UIModeSettings } from "src/shared/Dialogs/UIModeSettings";

declare const PLUGIN_VERSION: string;

type PanelProps = {
  visible: boolean;
  view: WeakRef<ExcalidrawView>;
  centerPointer: Function;
  observer: WeakRef<ResizeObserver>;
};

export type PanelState = {
  visible: boolean;
  top: number;
  left: number;
  theme: "dark" | "light";
  excalidrawViewMode: boolean;
  minimized: boolean;
  isDirty: boolean;
  isFullscreen: boolean;
  isPreviewMode: boolean;
  scriptIconMap: ScriptIconMap | null;
};

const TOOLS_PANEL_WIDTH = () => REM_VALUE * 14.4;

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
  public containerRef: React.RefObject<HTMLDivElement>;
  private getView(): ExcalidrawView | null {
    return this.props.view?.deref() ?? null;
  }

  componentWillUnmount(): void {
    if (this.containerRef.current) {
      this.props.observer.deref()?.unobserve(this.containerRef.current);
    }
    this.setState({ scriptIconMap: null });
    this.containerRef = null;
  }

  constructor(props: PanelProps) {
    super(props);
    const react = this.getView()?.packages.react;
    this.containerRef = react.createRef();
    this.state = {
      visible: props.visible,
      top: 50,
      left: 200,
      theme: "dark",
      excalidrawViewMode: false,
      minimized: false,
      isDirty: false,
      isFullscreen: false,
      isPreviewMode: true,
      scriptIconMap: {},
    };
  }

  updateScriptIconMap(scriptIconMap: ScriptIconMap) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.updateScriptIconMap, "ToolsPanel.updateScriptIconMap()");
    this.setState(() => {
      return { scriptIconMap };
    });
  }

  setPreviewMode(isPreviewMode: boolean) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.setPreviewMode, "ToolsPanel.setPreviewMode()");
    this.setState(() => {
      return {
        isPreviewMode,
      };
    });
  }

  setFullscreen(isFullscreen: boolean) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.setFullscreen, "ToolsPanel.setFullscreen()");
    this.setState(() => {
      return {
        isFullscreen,
      };
    });
  }

  setDirty(isDirty: boolean) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.setDirty, "ToolsPanel.setDirty()");
    this.setState(() => {
      return {
        isDirty,
      };
    });
  }

  setExcalidrawViewMode(isViewModeEnabled: boolean) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.setExcalidrawViewMode, "ToolsPanel.setExcalidrawViewMode()");
    this.setState(() => {
      return {
        excalidrawViewMode: isViewModeEnabled,
      };
    });
  }

  toggleVisibility(isMobileOrZen: boolean) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.toggleVisibility, "ToolsPanel.toggleVisibility()");
    this.setTopCenter(isMobileOrZen);
    this.setState((prevState: PanelState) => {
      return {
        visible: !prevState.visible,
      };
    });
  }

  updateVisibility() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.updateVisibility, "ToolsPanel.updateVisibility()");
    this.forceUpdate();
  }

  setTheme(theme: "dark" | "light") {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.setTheme, "ToolsPanel.setTheme()");
    this.setState((prevState: PanelState) => {
      return {
        theme,
      };
    });
  }

  setTopCenter(isMobileOrZen: boolean) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.setTopCenter, "ToolsPanel.setTopCenter()");
    this.setState(() => {
      return {
        left:
          (this.containerRef.current.clientWidth -
            TOOLS_PANEL_WIDTH() -
            (isMobileOrZen ? 0 : TOOLS_PANEL_WIDTH() + 4)) /
          2 +
          this.containerRef.current.parentElement.offsetLeft +
          (isMobileOrZen ? 0 : TOOLS_PANEL_WIDTH() + 4),
        top: 64 + this.containerRef.current.parentElement.offsetTop,
      };
    });
  }

  updatePosition(deltaY: number = 0, deltaX: number = 0) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.updatePosition, "ToolsPanel.updatePosition()");
    this.setState(() => {
      const {
        offsetTop,
        offsetLeft,
        clientWidth: width,
        clientHeight: height,
      } = this.containerRef.current.firstElementChild as HTMLElement;

      const top = offsetTop - deltaY;
      const left = offsetLeft - deltaX;

      const {
        clientWidth: parentWidth,
        clientHeight: parentHeight,
        offsetTop: parentOffsetTop,
        offsetLeft: parentOffsetLeft,
      } = this.containerRef.current.parentElement;

      this.previousHeight = parentHeight;
      this.previousWidth = parentWidth;
      this.onBottomEdge = top >= parentHeight - height + parentOffsetTop;
      this.onRightEdge = left >= parentWidth - width + parentOffsetLeft;

      return {
        top:
          top < parentOffsetTop
            ? parentOffsetTop
            : this.onBottomEdge
              ? parentHeight - height + parentOffsetTop
              : top,
        left:
          left < parentOffsetLeft
            ? parentOffsetLeft
            : this.onRightEdge
              ? parentWidth - width + parentOffsetLeft
              : left,
      };
    });
  }

  actionOpenScriptInstallDialog() {
    const view = this.getView();
    if (!view) return;
    new ScriptInstallPrompt(view.plugin).open()
  }

  actionOpenReleaseNotes() {
    const view = this.getView();
    if (!view) return
    new ReleaseNotes(view.app, view.plugin, PLUGIN_VERSION).open();
  }

  actionConvertExcalidrawToMD() {
    this.getView()?.convertExcalidrawToMD();
  }

  actionToggleViewMode() {
    const view = this.getView();
    if (!view) return;
    if (this.state.isPreviewMode) {
      view.changeTextMode(TextMode.raw);
    } else {
      view.changeTextMode(TextMode.parsed);
    }
  }

  actionToggleTrayMode() {
    const plugin = this.getView()?.plugin;
    if (!plugin) return;
    new UIModeSettings(plugin).open();
  }

  actionToggleFullscreen() {
    const view = this.getView();
    if (!view) return;
    if (this.state.isFullscreen) {
      view.exitFullscreen();
    } else {
      view.gotoFullscreen();
    }
  }

  actionSearch() {
    const view = this.getView();
    if (!view) return;
    search(view);
  }

  actionOCR(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    const view = this.getView();
    const plugin = view?.plugin;
    if (!view || !plugin) return;
    if (!plugin.settings.taskboneEnabled) {
      new Notice("Taskbone OCR is not enabled. Please go to plugins settings to enable it.", 4000);
      return;
    }
    plugin.taskbone.getTextForView(view, { forceReScan: isWinCTRLorMacCMD(e) });
  }

  actionOpenLink(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    const view = this.getView();
    if (!view) return;
    const event = new MouseEvent("click", {
      ctrlKey: e.ctrlKey || !(DEVICE.isIOS || DEVICE.isMacOS),
      metaKey: e.metaKey || (DEVICE.isIOS || DEVICE.isMacOS),
      shiftKey: e.shiftKey,
      altKey: e.altKey,
    });
    view.handleLinkClick(event, true);
  }

  actionOpenLinkProperties() {
    const view = this.getView();
    if (!view) return;
    const event = new MouseEvent("click", {
      ctrlKey: true,
      metaKey: true,
      shiftKey: false,
      altKey: false,
    });
    view.handleLinkClick(event);
  }

  actionForceSave() {
    const view = this.getView();
    if (!view) return;
    view.forceSave();
  }

  actionExportLibrary() {
    const plugin = this.getView()?.plugin;
    if (!plugin) return;
    plugin.exportLibrary();
  }

  actionExportImage() {
    const view = this.getView();
    if (!view) return;
    if (!view.exportDialog) {
      view.exportDialog = new ExportDialog(view.plugin, view, view.file);
      view.exportDialog.createForm();
    }
    view.exportDialog.open();
  }

  actionOpenAsMarkdown() {
    const view = this.getView();
    if (!view) return;
    view.openAsMarkdown();
  }

  actionLinkToElement(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    const view = this.getView();
    if (!view) return;
    if (isWinALTorMacOPT(e)) {
      openExternalLink("https://youtu.be/yZQoJg2RCKI", view.app);
      return;
    }
    view.copyLinkToSelectedElementToClipboard(
      isWinCTRLorMacCMD(e) ? "group=" : (isSHIFT(e) ? "area=" : "")
    );
  }

  actionAddAnyFile() {
    const view = this.getView();
    const plugin = view?.plugin;
    if (!view || !plugin) return;
    this.props.centerPointer();
    const insertFileModal = new UniversalInsertFileModal(plugin, view);
    insertFileModal.open();
  }

  actionInsertImage() {
    const view = this.getView();
    const plugin = view?.plugin;
    if (!view || !plugin) return;
    this.props.centerPointer();
    plugin.insertImageDialog.start(view);
  }

  actionInsertPDF() {
    const view = this.getView();
    const plugin = view?.plugin;
    if (!view || !plugin) return;
    this.props.centerPointer();
    const insertPDFModal = new InsertPDFModal(plugin, view);
    insertPDFModal.open();
  }

  actionInsertMarkdown() {
    const view = this.getView();
    const plugin = view?.plugin;
    if (!view || !plugin) return;
    this.props.centerPointer();
    plugin.insertMDDialog.start(view);
  }

  actionInsertBackOfNote() {
    const view = this.getView();
    if (!view) return;
    this.props.centerPointer();
    view.insertBackOfTheNoteCard();
  }

  actionInsertLaTeX(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    const view = this.getView();
    if (!view) return;
    if (isWinALTorMacOPT(e)) {
      openExternalLink("https://youtu.be/r08wk-58DPk", view.app);
      return;
    }
    this.props.centerPointer();
    insertLaTeXToView(view);
  }

  actionInsertLink() {
    const view = this.getView();
    const plugin = view?.plugin;
    if (!view || !plugin) return;
    this.props.centerPointer();
    plugin.insertLinkDialog.start(
      view.file.path,
      (text: string, fontFamily?: 1 | 2 | 3 | 4, save?: boolean) => view.addText(text, fontFamily, save),
    );
  }

  actionImportSVG(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    const view = this.getView();
    const plugin = view?.plugin;
    if (!view || !plugin) return;
    plugin.importSVGDialog.start(view);
  }

  actionCropImage(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    // @ts-ignore
    this.view.app.commands.executeCommandById("obsidian-excalidraw-plugin:crop-image");
  }

  async actionRunScript(key: string) {
    const view = this.getView();
    const plugin = view?.plugin;
    if (!view || !plugin) return;
    const f = plugin.app.vault.getAbstractFileByPath(key);
    if (f && f instanceof TFile) {
      plugin.scriptEngine.executeScript(
        view,
        await plugin.app.vault.read(f),
        plugin.scriptEngine.getScriptName(f),
        f
      );
    }
  }

  async actionPinScript(key: string, scriptName: string) {
    const view = this.getView();
    const plugin = view?.plugin;
    if (!view || !plugin) return;
    const api = view.excalidrawAPI as ExcalidrawImperativeAPI;
    await plugin.loadSettings();
    const index = plugin.settings.pinnedScripts.indexOf(key)
    if (index > -1) {
      plugin.settings.pinnedScripts.splice(index, 1);
      api?.setToast({ message: `Pin removed: ${scriptName}`, duration: 3000, closable: true });
    } else {
      plugin.settings.pinnedScripts.push(key);
      api?.setToast({ message: `Pinned: ${scriptName}`, duration: 3000, closable: true })
    }
    await plugin.saveSettings();
    getExcalidrawViews(plugin.app).forEach(excalidrawView => excalidrawView.updatePinnedScripts());
  }

  private islandOnClick(event: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    event.preventDefault();
    if (
      Math.abs(this.penDownX - this.pos3) > 5 ||
      Math.abs(this.penDownY - this.pos4) > 5
    ) {
      return;
    }
    this.setState((prevState: PanelState) => {
      return {
        minimized: !prevState.minimized,
      };
    });
  }

  private islandOnPointerDown(event: React.PointerEvent) {
    const view = this.getView();
    if (!view || view.plugin.settings.pinObsidianTools) return;

    const onDrag = (e: PointerEvent) => {
      e.preventDefault();
      this.pos1 = this.pos3 - e.clientX;
      this.pos2 = this.pos4 - e.clientY;
      this.pos3 = e.clientX;
      this.pos4 = e.clientY;
      this.updatePosition(this.pos2, this.pos1);
    };

    const onPointerUp = () => {
      view.ownerDocument?.removeEventListener("pointerup", onPointerUp);
      view.ownerDocument?.removeEventListener("pointermove", onDrag);
    };

    event.preventDefault();
    this.penDownX = this.pos3 = event.clientX;
    this.penDownY = this.pos4 = event.clientY;
    view.ownerDocument.addEventListener("pointerup", onPointerUp);
    view.ownerDocument.addEventListener("pointermove", onDrag);
  };

  render() {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.render, "ToolsPanel.render()");
    const view = this.getView();
    const pinObsidianTools = view?.plugin.settings.pinObsidianTools ?? false;
    return (
      <div
        ref={this.containerRef}
        className={clsx("excalidraw", {
          "theme--dark": this.state.theme === "dark",
        })}
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          touchAction: "none",
          pointerEvents: "none",
        }}
      >
        <div
          className="Island"
          style={{
            position: "absolute",
            top: pinObsidianTools ? "62px" : `${this.state.top}px`,
            left: pinObsidianTools ? "50%" : `${this.state.left}px`,
            transform: pinObsidianTools ? "translateX(-50%)" : "none",
            width: `14.4rem`,
            display:
              (this.state.visible || pinObsidianTools) && !this.state.excalidrawViewMode
                ? "block"
                : "none",
            height: "fit-content",
            maxHeight: "400px",
            zIndex: 5,
            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              height: "26px",
              width: "100%",
              cursor: pinObsidianTools ? "default" : "move",
            }}
            onClick={this.islandOnClick.bind(this)}
            onPointerDown={this.islandOnPointerDown.bind(this)}
          >
            <svg
              aria-hidden="true"
              focusable="false"
              role="img"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 228 26"
            >
              <path
                stroke="var(--icon-fill-color)"
                strokeWidth="2"
                d="M40,7 h148 M40,13 h148 M40,19 h148"
              />
            </svg>
          </div>
          <div
            className="Island App-menu__left scrollbar"
            style={{
              maxHeight: "350px",
              width: "initial",
              //@ts-ignore
              "--padding": "0.125rem",
              display: this.state.minimized ? "none" : "block",
            }}
          >
            <div className="selected-shape-actions">
              <fieldset>
                <legend>Utility actions</legend>
                <div className="buttonList buttonListIcon">
                  <ActionButton
                    key={"scriptEngine"}
                    title={t("INSTALL_SCRIPT_BUTTON")}
                    action={this.actionOpenScriptInstallDialog.bind(this)}
                    icon={ICONS.scriptEngine}
                  />
                  <ActionButton
                    key={"release-notes"}
                    title={t("READ_RELEASE_NOTES")}
                    action={this.actionOpenReleaseNotes.bind(this)}
                    icon={ICONS.releaseNotes}
                  />
                  {this.state.isPreviewMode === null ? (
                    <ActionButton
                      key={"convert"}
                      title={t("CONVERT_FILE")}
                      action={(this.actionConvertExcalidrawToMD.bind(this))}
                      icon={ICONS.convertFile}
                    />
                  ) : !this.state.isPreviewMode && (
                    <ActionButton
                      key={"viewmode"}
                      title={this.state.isPreviewMode ? t("PARSED") : t("RAW")}
                      action={this.actionToggleViewMode.bind(this)}
                      icon={
                        this.state.isPreviewMode
                          ? ICONS.rawMode
                          : ICONS.parsedMode
                      }
                    />
                  )}
                  <ActionButton
                    key={"ui-mode"}
                    title={t("UI_MODE")}
                    action={this.actionToggleTrayMode.bind(this)}
                    icon={ICONS.trayMode}
                  />
                  <ActionButton
                    key={"fullscreen"}
                    title={
                      this.state.isFullscreen
                        ? t("EXIT_FULLSCREEN")
                        : t("GOTO_FULLSCREEN")
                    }
                    action={this.actionToggleFullscreen.bind(this)}
                    icon={
                      this.state.isFullscreen
                        ? ICONS.exitFullScreen
                        : ICONS.gotoFullScreen
                    }
                  />
                </div>
                <div className="buttonList buttonListIcon">
                  <ActionButton
                    key={"search"}
                    title={t("SEARCH")}
                    action={this.actionSearch.bind(this)}
                    icon={ICONS.search}
                  />
                  <ActionButton
                    key={"ocr"}
                    title={t("RUN_OCR")}
                    action={this.actionOCR.bind(this)}
                    icon={ICONS.ocr}
                  />
                  <ActionButton
                    key={"openLink"}
                    title={t("OPEN_LINK_CLICK")}
                    action={this.actionOpenLink.bind(this)}
                    icon={ICONS.openLink}
                  />
                  <ActionButton
                    key={"openLinkProperties"}
                    title={t("OPEN_LINK_PROPS")}
                    action={this.actionOpenLinkProperties.bind(this)}
                    icon={ICONS.openLinkProperties}
                  />
                  <ActionButton
                    key={"save"}
                    title={t("FORCE_SAVE")}
                    action={this.actionForceSave.bind(this)}
                    icon={saveIcon(this.state.isDirty)}
                  />
                </div>
              </fieldset>
              <fieldset>
                <legend>Export actions</legend>
                <div className="buttonList buttonListIcon">
                  <ActionButton
                    key={"lib"}
                    title={t("DOWNLOAD_LIBRARY")}
                    action={this.actionExportLibrary.bind(this)}
                    icon={ICONS.exportLibrary}
                  />
                  <ActionButton
                    key={"exportIMG"}
                    title={t("EXPORT_IMAGE")}
                    action={this.actionExportImage.bind(this)}
                    icon={ICONS.ExportImage}
                  />
                  <ActionButton
                    key={"md"}
                    title={t("OPEN_AS_MD")}
                    action={this.actionOpenAsMarkdown.bind(this)}
                    icon={ICONS.switchToMarkdown}
                  />
                  <ActionButton
                    key={"link-to-element"}
                    title={t("INSERT_LINK_TO_ELEMENT")}
                    action={this.actionLinkToElement.bind(this)}
                    icon={ICONS.copyElementLink}
                  />
                </div>
              </fieldset>
              <fieldset>
                <legend>Insert actions</legend>
                <div className="buttonList buttonListIcon">
                  <ActionButton
                    key={"anyfile"}
                    title={t("UNIVERSAL_ADD_FILE")}
                    action={this.actionAddAnyFile.bind(this)}
                    icon={ICONS["add-file"]}
                  />
                  <ActionButton
                    key={"image"}
                    title={t("INSERT_IMAGE")}
                    action={this.actionInsertImage.bind(this)}
                    icon={ICONS.insertImage}
                  />
                  <ActionButton
                    key={"pdf"}
                    title={t("INSERT_PDF")}
                    action={this.actionInsertPDF.bind(this)}
                    icon={ICONS.insertPDF}
                  />
                  <ActionButton
                    key={"insertMD"}
                    title={t("INSERT_MD")}
                    action={this.actionInsertMarkdown.bind(this)}
                    icon={ICONS.insertMD}
                  />
                  <ActionButton
                    key={"insertBackOfNote"}
                    title={t("INSERT_CARD")}
                    action={this.actionInsertBackOfNote.bind(this)}
                    icon={ICONS.BackOfNote}
                  />
                  <ActionButton
                    key={"latex"}
                    title={t("INSERT_LATEX")}
                    action={this.actionInsertLaTeX.bind(this)}
                    icon={ICONS.insertLaTeX}
                  />
                  <ActionButton
                    key={"link"}
                    title={t("INSERT_LINK")}
                    action={this.actionInsertLink.bind(this)}
                    icon={ICONS.insertLink}
                  />
                  <ActionButton
                    key={"import-svg"}
                    title={t("IMPORT_SVG")}
                    action={this.actionImportSVG.bind(this)}
                    icon={ICONS.importSVG}
                  />
                  <ActionButton
                    key={"crop-image"}
                    title={t("CROP_IMAGE")}
                    action={this.actionCropImage.bind(this)}
                    icon={ICONS.Crop}
                  />
                </div>
              </fieldset>
              {this.renderScriptButtons(false)}
              {this.renderScriptButtons(true)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  private renderScriptButtons(isDownloaded: boolean) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.renderScriptButtons, "ToolsPanel.renderScriptButtons()");
    if (Object.keys(this.state.scriptIconMap).length === 0) {
      return "";
    }

    const view = this.getView();
    const plugin = view?.plugin;
    if (!view || !plugin) return null;


    if (!plugin._loaded) {
      return null;
    }

    const downloadedScriptsRoot = `${plugin.settings.scriptFolderPath}/${SCRIPT_INSTALL_FOLDER}/`;

    const filterCondition = (key: string): boolean =>
      isDownloaded
        ? key.startsWith(downloadedScriptsRoot)
        : !key.startsWith(downloadedScriptsRoot);

    if (
      Object.keys(this.state.scriptIconMap).filter((k) => filterCondition(k))
        .length === 0
    ) {
      return "";
    }

    const groups = new Set<string>();

    Object.keys(this.state.scriptIconMap)
      .filter((k) => filterCondition(k))
      .forEach(k => groups.add(this.state.scriptIconMap[k].group))

    const scriptlist = Array.from(groups).sort((a, b) => a > b ? 1 : -1);
    scriptlist.push(scriptlist.shift());
    return (
      <>
        {scriptlist.map((group, index) => (
          <fieldset key={`${group}-${index}`}>
            <legend>{isDownloaded ? group : (group === "" ? "User" : "User/" + group)}</legend>
            <div className="buttonList buttonListIcon">
              {Object.entries(this.state.scriptIconMap)
                .filter(([k, v]) => v.group === group)
                .sort()
                .map(([key, value]) => (
                  <ActionButton
                    key={key}
                    title={value.name}
                    action={this.actionRunScript.bind(this, key)}
                    longpress={this.actionPinScript.bind(this, key, value.name)}
                    icon={
                      new WeakRef(value.svgString
                        ? stringToSVG(value.svgString)
                        : (
                          ICONS.cog
                        )).deref()
                    }
                  />
                ))}
            </div>
          </fieldset>
        ))}
      </>
    );
  }
}
