import { TFile } from "obsidian";
import * as React from "react";
import ExcalidrawView from "../../ExcalidrawView";
import {
  ExcalidrawElement,
  ExcalidrawEmbeddableElement,
} from "@zsviczian/excalidraw/types/element/src/types";
import { AppState } from "@zsviczian/excalidraw/types/excalidraw/types";
import { ActionButton } from "./ActionButton";
import { ICONS } from "../../../constants/actionIcons";
import { t } from "src/lang/helpers";
import { ScriptEngine } from "../../../shared/Scripts";
import {
  MD_EX_SECTIONS,
  ROOTELEMENTSIZE,
  sceneCoordsToViewportCoords,
} from "src/constants/constants";
import {
  REGEX_LINK,
  REG_LINKINDEX_HYPERLINK,
} from "../../../shared/ExcalidrawData";
import {
  processLinkText,
  useDefaultExcalidrawFrame,
} from "src/utils/customEmbeddableUtils";
import { getActivePDFPageNumberFromPDFView } from "src/utils/obsidianUtils";
import { cleanSectionHeading } from "src/utils/pathUtils";
import {
  EmbeddableSettings,
  EmbeddableMDCustomProps,
} from "src/shared/Dialogs/EmbeddableSettings";
import {
  insertImageToView,
  openExternalLink,
} from "src/utils/excalidrawViewUtils";
import { getEA } from "src/core";
import { CaptureUpdateAction } from "src/constants/constants";
import { URLs } from "src/constants/safeUrls";
import { setStyle } from "src/utils/styleUtils";
import { addAppendUpdateCustomData } from "src/utils/elementCustomDataUtils";
import {
  selectMarkdownBlockSubpath,
  selectMarkdownHeadingSubpath,
} from "src/shared/Suggesters/markdownSubpathSuggester";

export class EmbeddableMenu {
  private menuFadeTimeout: number = 0;
  private menuElementId: string = null;

  constructor(
    private view: ExcalidrawView,
    private containerRef: React.RefObject<HTMLDivElement>,
  ) {}

  public destroy() {
    if (this.menuFadeTimeout) {
      window.clearTimeout(this.menuFadeTimeout);
      this.menuFadeTimeout = null;
    }
    this.view = null;
    this.containerRef = null;
    this.updateElement = null;
    this.handleMouseEnter = null;
    this.handleMouseLeave = null;
    this.renderButtons = null;
  }

  private updateElement = async (
    subpath: string,
    element: ExcalidrawEmbeddableElement,
    file: TFile,
    save: boolean = true,
  ) => {
    if (!element) {
      return;
    }
    const view = this.view;
    const app = view.app;
    element = view.excalidrawAPI
      .getSceneElements()
      .find(
        (e: ExcalidrawElement) => e.id === element.id,
      ) as ExcalidrawEmbeddableElement;
    if (!element) {
      return;
    }
    const path = app.metadataCache.fileToLinktext(
      file,
      view.file.path,
      file.extension === "md",
    );
    const link = `[[${path}${subpath}]]`;
    const ea = getEA(view);
    ea.copyViewElementsToEAforEditing([element]);
    ea.getElement(element.id).link = link;
    view.excalidrawData.elementLinks.set(element.id, link);
    await ea.addElementsToView(false, save, true);
    ea.destroy();
  };

  private handleMouseEnter() {
    window.clearTimeout(this.menuFadeTimeout);
    if (this.containerRef.current) {
      setStyle(this.containerRef.current, {
        opacity: "1",
      });
    }
  }

  private handleMouseLeave() {
    this.menuFadeTimeout = window.setTimeout(() => {
      if (this.containerRef.current) {
        setStyle(this.containerRef.current, {
          opacity: "0.2",
        });
      }
    }, 5000);
  }

  private async actionBaseViewSelection(
    file: TFile,
    subpath: string,
    element: ExcalidrawEmbeddableElement,
  ) {
    this.view.updateScene({
      appState: { activeEmbeddable: null },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    const views = Array.from(
      (await this.view.app.vault.read(file)).matchAll(/\s*name: (.*)$/gm),
    ).map((x) => x?.[1]);
    const values = [""].concat(
      views.map((b: string) => `#${cleanSectionHeading(b)}`),
    );
    const display = [t("DO_NOT_PIN_VIEW")].concat(views.map((b: string) => b));

    const newSubpath = await ScriptEngine.suggester(
      this.view.app,
      display,
      values,
      t("SELECT_VIEW"),
    );
    if (!newSubpath && newSubpath !== "") {
      return;
    }
    if (newSubpath !== subpath) {
      await this.updateElement(newSubpath, element, file);
    }
  }

  private async actionMarkdownSelection(
    file: TFile,
    isExcalidrawFile: boolean,
    subpath: string,
    element: ExcalidrawEmbeddableElement,
  ) {
    this.view.updateScene({
      appState: { activeEmbeddable: null },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    const newSubpath = await selectMarkdownHeadingSubpath(
      this.view.app,
      file,
      isExcalidrawFile,
    );
    if (newSubpath !== null && newSubpath !== subpath) {
      await this.updateElement(newSubpath, element, file);
    }
  }

  private actionBookmarkPage(element: ExcalidrawEmbeddableElement) {
    if (!element) {
      return;
    }
    const pdfView = this.view.getEmbeddableLeafElementById(element.id)?.node
      ?.child;
    if (!pdfView) {
      return;
    }
    const page = getActivePDFPageNumberFromPDFView(pdfView);
    if (!page) {
      return;
    }
    const pdfFile: TFile = pdfView?.file;
    if (!pdfFile) {
      return;
    }
    void this.updateElement(`#page=${page}`, element, pdfFile, false);
  }

  private async actionInsertPageAsImage(element: ExcalidrawEmbeddableElement) {
    if (!element) {
      return;
    }
    const pdfView = this.view.getEmbeddableLeafElementById(element.id)?.node
      ?.child;
    if (!pdfView) {
      return;
    }
    const page = getActivePDFPageNumberFromPDFView(pdfView);
    if (!page) {
      return;
    }
    const pdfFile: TFile = pdfView?.file;
    if (!pdfFile) {
      return;
    }
    const ea = getEA(this.view);
    ea.selectElementsInView([]);
    const x = element.x + element.width + 20;
    const y = element.y;
    const path = this.view.app.metadataCache.fileToLinktext(
      pdfFile,
      this.view.file.path,
      false,
    );
    const id = await insertImageToView(
      ea,
      { x, y },
      `${path}#page=${page}`,
      undefined,
      undefined,
      false,
    );
    ea.selectElementsInView([id]);
    ea.destroy();
  }

  private async actionMarkdownBlock(
    file: TFile,
    subpath: string,
    element: ExcalidrawEmbeddableElement,
  ) {
    if (!file) {
      return;
    }
    this.view.updateScene({
      appState: { activeEmbeddable: null },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    const newSubpath = await selectMarkdownBlockSubpath(
      this.view.app,
      file,
    );
    if (newSubpath !== null && newSubpath !== subpath) {
      await this.updateElement(newSubpath, element, file);
    }
  }

  private actionZoomToElement(
    element: ExcalidrawEmbeddableElement,
    maxLevel?: number,
  ) {
    if (!element) {
      return;
    }
    const api = this.view.excalidrawAPI;
    api.zoomToFit(
      [element],
      maxLevel ?? this.view.plugin.settings.zoomToFitMaxLevel,
      0.1,
    );
  }

  private async actionTogglePropertiesVisible(
    element: ExcalidrawEmbeddableElement,
  ) {
    if (!element) {
      return;
    }
    const mdProps =
      (element.customData?.mdProps as EmbeddableMDCustomProps) ??
      this.view.plugin.settings.embeddableMarkdownDefaults;
    const isVisible = mdProps.propertiesVisible !== false;
    mdProps.propertiesVisible = !isVisible;

    const ea = getEA(this.view);
    ea.copyViewElementsToEAforEditing([element]);
    const eaEl = ea.getElement(element.id);
    addAppendUpdateCustomData(eaEl, { mdProps });
    await ea.addElementsToView();
    ea.destroy();

    // Fetch the updated element reference from the scene
    const api = this.view.excalidrawAPI;
    const updatedElement = api
      .getSceneElements()
      .find(
        (e: ExcalidrawElement) => e.id === element.id,
      ) as ExcalidrawEmbeddableElement;

    // Force an appState update so the React menu component re-renders
    if (updatedElement) {
      this.view.updateScene({
        appState: {
          activeEmbeddable: {
            element: updatedElement,
            state: "active",
          },
        },
      });
    }
  }

  private async actionToggleLockReadingMode(
    element: ExcalidrawEmbeddableElement,
  ) {
    if (!element) {
      return;
    }
    const mdProps =
      (element.customData?.mdProps as EmbeddableMDCustomProps) ??
      this.view.plugin.settings.embeddableMarkdownDefaults;
    const isLocked = !!mdProps.lockedReadingMode;
    mdProps.lockedReadingMode = !isLocked;

    const ea = getEA(this.view);
    ea.copyViewElementsToEAforEditing([element]);
    const eaEl = ea.getElement(element.id);
    addAppendUpdateCustomData(eaEl, mdProps);
    await ea.addElementsToView();
    ea.destroy();

    // Fetch the updated element reference from the scene
    const api = this.view.excalidrawAPI;
    const updatedElement = api
      .getSceneElements()
      .find(
        (e: ExcalidrawElement) => e.id === element.id,
      ) as ExcalidrawEmbeddableElement;

    // Force an appState update so the React menu component re-renders
    if (updatedElement) {
      this.view.updateScene({
        appState: {
          activeEmbeddable: {
            element: updatedElement,
            state: "active",
          },
        },
      });
    }
  }

  private actionProperties(element: ExcalidrawEmbeddableElement, file: TFile) {
    if (!element) {
      return;
    }
    new EmbeddableSettings(this.view.plugin, this.view, file, element).open();
  }

  private actionCrop(element: ExcalidrawEmbeddableElement) {
    if (!element) {
      return;
    }
    this.view.app.commands.executeCommandById(
      "obsidian-excalidraw-plugin:crop-image",
    );
  }

  private actionReload(iframe: HTMLIFrameElement, link: string) {
    iframe.src = link;
  }

  private actionOpen(
    iframe: HTMLIFrameElement,
    element: ExcalidrawEmbeddableElement,
  ) {
    openExternalLink(
      !iframe.src.startsWith(URLs.WWW_YOUTUBE_COM) &&
        !iframe.src.startsWith(URLs.PLAYER_VIMEO_COM)
        ? iframe.src
        : element.link,
      this.view.app,
    );
  }

  private actionCopyCode(element: ExcalidrawEmbeddableElement, link: string) {
    if (!element) {
      return;
    }
    void navigator.clipboard.writeText(atob(link.split(",")[1]));
  }

  renderButtons(appState: AppState) {
    const view = this.view;
    const api = view?.excalidrawAPI;
    if (!api) {
      return null;
    }
    if (!view.file) {
      return null;
    }
    const disableFrameButtons =
      appState.viewModeEnabled && !view.allowFrameButtonsInViewMode;
    if (
      !appState.activeEmbeddable ||
      appState.activeEmbeddable.state !== "active" ||
      disableFrameButtons
    ) {
      this.menuElementId = null;
      if (this.menuFadeTimeout) {
        window.clearTimeout(this.menuFadeTimeout);
        this.menuFadeTimeout = 0;
      }
      return null;
    }
    const element = appState.activeEmbeddable
      ?.element as ExcalidrawEmbeddableElement;
    if (this.menuElementId !== element.id) {
      this.menuElementId = element.id;
      this.handleMouseLeave();
    }
    let link = element.link;
    if (!link) {
      return null;
    }

    const isExcalidrawiFrame = useDefaultExcalidrawFrame(element);
    let isObsidianiFrame = Boolean(
      element.link?.match(REG_LINKINDEX_HYPERLINK),
    );

    if (!isExcalidrawiFrame && !isObsidianiFrame) {
      if (link.startsWith("data:text/html")) {
        isObsidianiFrame = true;
      } else {
        const res = REGEX_LINK.getRes(element.link).next();
        if (!res || (!res.value && res.done)) {
          return null;
        }

        link = REGEX_LINK.getLink(res);

        isObsidianiFrame = Boolean(link.match(REG_LINKINDEX_HYPERLINK));
      }

      if (!isObsidianiFrame) {
        const { subpath, file } = processLinkText(link, view);
        if (!file) {
          return;
        }
        const isMD = file.extension === "md";
        const isBase = file.extension === "base";
        const isExcalidrawFile = view.plugin.isExcalidrawFile(file);
        const isPDF = file.extension === "pdf";
        const canConvertToMarkdownImage =
          isMD &&
          (!isExcalidrawFile ||
            file.path !== view.file.path ||
            (file.path === view.file.path &&
              Boolean(subpath) &&
              !subpath.startsWith("#^") &&
              !MD_EX_SECTIONS.some(
                (heading) =>
                  cleanSectionHeading(heading).toLocaleLowerCase() ===
                  cleanSectionHeading(subpath).toLocaleLowerCase(),
              )));
        const { x, y } = sceneCoordsToViewportCoords(
          { sceneX: element.x, sceneY: element.y },
          appState,
        );
        const top = `${y - 2.5 * ROOTELEMENTSIZE - appState.offsetTop}px`;
        const left = `${x - appState.offsetLeft}px`;
        const mdProps =
          (element.customData?.mdProps as EmbeddableMDCustomProps) ??
          view.plugin.settings.embeddableMarkdownDefaults;
        const isLockedReadingMode = !!mdProps.lockedReadingMode;
        const isPropertiesVisible = mdProps.propertiesVisible !== false;
        const isGlobalPropertiesHidden =
          view.app.vault.getConfig("propertiesInDocument") === "hidden";

        return (
          <div
            ref={this.containerRef}
            className="embeddable-menu"
            style={{
              top,
              left,
              opacity: 1,
            }}
            onMouseEnter={() => this.handleMouseEnter()}
            onPointerDown={() => this.handleMouseEnter()}
            onMouseLeave={() => this.handleMouseLeave()}
          >
            <div
              className="Island"
              style={{
                position: "relative",
                display: "block",
              }}
            >
              {isBase && (
                <ActionButton
                  key={"MarkdownSection"}
                  title={t("PIN_VIEW")}
                  action={() =>
                    void this.actionBaseViewSelection(file, subpath, element)
                  }
                  icon={ICONS.ZoomToSection}
                />
              )}
              {isMD && (
                <ActionButton
                  key={"MarkdownSection"}
                  title={t("NARROW_TO_HEADING")}
                  action={() =>
                    void this.actionMarkdownSelection(
                      file,
                      isExcalidrawFile,
                      subpath,
                      element,
                    )
                  }
                  icon={ICONS.ZoomToSection}
                />
              )}
              {isMD && !isExcalidrawFile && (
                <ActionButton
                  key={"MarkdownBlock"}
                  title={t("NARROW_TO_BLOCK")}
                  action={() =>
                    void this.actionMarkdownBlock(file, subpath, element)
                  }
                  icon={ICONS.ZoomToBlock}
                />
              )}
              {isMD &&
                !isExcalidrawFile &&
                !subpath &&
                !isGlobalPropertiesHidden && (
                  <ActionButton
                    key="TogglePropertiesVisible"
                    title={
                      isPropertiesVisible
                        ? t("HIDE_PROPERTIES")
                        : t("SHOW_PROPERTIES")
                    }
                    action={() =>
                      void this.actionTogglePropertiesVisible(element)
                    }
                    icon={
                      isPropertiesVisible ? ICONS.File : ICONS.FileCodeCorner
                    }
                  />
                )}
              {canConvertToMarkdownImage && (
                <ActionButton
                  key="ConvertToMarkdownImage"
                  title={t("CONVERT_EMBEDDABLE_TO_MARKDOWN_IMAGE")}
                  action={() =>
                    void view.convertEmbeddableToMarkdownImage(element.id)
                  }
                  icon={ICONS.insertImage}
                />
              )}
              {isMD && (
                <ActionButton
                  key="LockReadingMode"
                  title={
                    isLockedReadingMode
                      ? t("UNLOCK_READING_MODE")
                      : t("LOCK_READING_MODE")
                  }
                  action={() => void this.actionToggleLockReadingMode(element)}
                  icon={isLockedReadingMode ? ICONS.Edit : ICONS.Read}
                />
              )}
              <ActionButton
                key={"ZoomToElement"}
                title={t("ZOOM_TO_FIT")}
                action={() => this.actionZoomToElement(element, 30)}
                icon={ICONS.ZoomToSelectedElement}
              />
              <ActionButton
                key={"Properties"}
                title={t("PROPERTIES")}
                action={() => this.actionProperties(element, file)}
                icon={ICONS.Properties}
              />
              {isPDF && (
                <>
                  <ActionButton
                    key={"Crop"}
                    title={t("CROP_PAGE")}
                    action={() => this.actionCrop(element)}
                    icon={ICONS.Crop}
                  />
                  <ActionButton
                    key={"Bookmark"}
                    title={t("BOOKMARK_PAGE")}
                    action={() => this.actionBookmarkPage(element)}
                    icon={ICONS.Bookmark}
                  />
                  <ActionButton
                    key={"Camera"}
                    title={t("CAPTURE_PAGE")}
                    action={() => {
                      void this.actionInsertPageAsImage(element);
                    }}
                    icon={ICONS.Camera}
                  />
                </>
              )}
            </div>
          </div>
        );
      }
    }
    if (isObsidianiFrame || isExcalidrawiFrame) {
      const iframe = (
        isExcalidrawiFrame
          ? (api.getHTMLIFrameElement as (id: string) => HTMLIFrameElement)(
              element.id,
            )
          : view.getEmbeddableElementById(element.id)
      ) as HTMLIFrameElement;
      if (!iframe || !iframe.contentWindow) {
        return null;
      }
      const { x, y } = sceneCoordsToViewportCoords(
        { sceneX: element.x, sceneY: element.y },
        appState,
      );
      const top = `${y - 2.5 * ROOTELEMENTSIZE - appState.offsetTop}px`;
      const left = `${x - appState.offsetLeft}px`;
      return (
        <div
          ref={this.containerRef}
          className="embeddable-menu"
          style={{
            top,
            left,
            opacity: 1,
          }}
          onMouseEnter={() => this.handleMouseEnter()}
          onPointerDown={() => this.handleMouseEnter()}
          onMouseLeave={() => this.handleMouseLeave()}
        >
          <div
            className="Island"
            style={{
              position: "relative",
              display: "block",
            }}
          >
            {iframe.src !== link &&
              !iframe.src.startsWith(URLs.WWW_YOUTUBE_COM) &&
              !iframe.src.startsWith(URLs.PLAYER_VIMEO_COM) && (
                <ActionButton
                  key={"Reload"}
                  title={t("RELOAD")}
                  action={() => this.actionReload(iframe, link)}
                  icon={ICONS.Reload}
                />
              )}
            <ActionButton
              key={"Open"}
              title={t("OPEN_IN_BROWSER")}
              action={() => this.actionOpen(iframe, element)}
              icon={ICONS.Globe}
            />
            <ActionButton
              key={"ZoomToElement"}
              title={t("ZOOM_TO_FIT")}
              action={() => this.actionZoomToElement(element)}
              icon={ICONS.ZoomToSelectedElement}
            />
            <ActionButton
              key={"Properties"}
              title={t("PROPERTIES")}
              action={() => this.actionProperties(element, null)}
              icon={ICONS.Properties}
            />
            {link?.startsWith("data:text/html") && (
              <ActionButton
                key={"CopyCode"}
                title={t("COPYCODE")}
                action={() => this.actionCopyCode(element, link)}
                icon={ICONS.Copy}
              />
            )}
          </div>
        </div>
      );
    }
  }
}
