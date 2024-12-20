import { TFile } from "obsidian";
import * as React from "react";
import ExcalidrawView from "../../ExcalidrawView";
import { ExcalidrawElement, ExcalidrawEmbeddableElement } from "@zsviczian/excalidraw/types/excalidraw/element/types";
import { AppState, ExcalidrawImperativeAPI } from "@zsviczian/excalidraw/types/excalidraw/types";
import { ActionButton } from "./ActionButton";
import { ICONS } from "../../../constants/actionIcons";
import { t } from "src/lang/helpers";
import { ScriptEngine } from "../../../shared/Scripts";
import { MD_EX_SECTIONS, ROOTELEMENTSIZE, nanoid, sceneCoordsToViewportCoords } from "src/constants/constants";
import { REGEX_LINK, REG_LINKINDEX_HYPERLINK } from "../../../shared/ExcalidrawData";
import { processLinkText, useDefaultExcalidrawFrame } from "src/utils/customEmbeddableUtils";
import { cleanSectionHeading } from "src/utils/obsidianUtils";
import { EmbeddableSettings } from "src/shared/Dialogs/EmbeddableSettings";
import { openExternalLink } from "src/utils/excalidrawViewUtils";
import { getEA } from "src/core";
import { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";

export class EmbeddableMenu {
  private menuFadeTimeout: number = 0;
  private menuElementId: string = null;

  constructor( 
    private view:ExcalidrawView,
    private containerRef: React.RefObject<HTMLDivElement>,
  ) {
  }

  public destroy() {
    if(this.menuFadeTimeout) {
      clearTimeout(this.menuFadeTimeout);
      this.menuFadeTimeout = null;
    }
    this.view = null;
    this.containerRef = null;
    this.updateElement = null;
    this.handleMouseEnter = null;
    this.handleMouseLeave = null;
    this.renderButtons = null;
  }

  private updateElement = (subpath: string, element: ExcalidrawEmbeddableElement, file: TFile) => {
    if(!element) return;
    const view = this.view;
    const app = view.app;
    element = view.excalidrawAPI.getSceneElements().find((e:ExcalidrawElement) => e.id === element.id);
    if(!element) return;
    const path = app.metadataCache.fileToLinktext(
      file,
      view.file.path,
      file.extension === "md",
    )
    const link = `[[${path}${subpath}]]`;
    const ea = getEA(view) as ExcalidrawAutomate;
    ea.copyViewElementsToEAforEditing([element]);
    ea.getElement(element.id).link = link;
    view.excalidrawData.elementLinks.set(element.id, link);
    ea.addElementsToView(false, true, true).then(() => ea.destroy());
  }

  private handleMouseEnter () {
    clearTimeout(this.menuFadeTimeout);
    this.containerRef.current?.style.setProperty("opacity", "1");
  };

  private handleMouseLeave () {
    this.menuFadeTimeout = window.setTimeout(() => {
      this.containerRef.current?.style.setProperty("opacity", "0.2");
    }, 5000);
  };

  private async actionMarkdownSelection (file: TFile, isExcalidrawFile: boolean, subpath: string, element: ExcalidrawEmbeddableElement) {
    this.view.updateScene({appState: {activeEmbeddable: null}, storeAction: "update"});
    const sections = (await this.view.app.metadataCache.blockCache
      .getForFile({ isCancelled: () => false },file))
      .blocks.filter((b: any) => b.display && b.node?.type === "heading")
      .filter((b: any) => !isExcalidrawFile || !MD_EX_SECTIONS.includes(b.display));
    let values, display;
    if(isExcalidrawFile) {
      values = sections.map((b: any) => `#${cleanSectionHeading(b.display)}`);
      display = sections.map((b: any) => b.display);
    } else {
      values = [""].concat(
        sections.map((b: any) => `#${cleanSectionHeading(b.display)}`)
      );
      display = [t("SHOW_ENTIRE_FILE")].concat(
        sections.map((b: any) => b.display)
      );
    }
    const newSubpath = await ScriptEngine.suggester(
      this.view.app, display, values, "Select section from document"
    );
    if(!newSubpath && newSubpath!=="") return;
    if (newSubpath !== subpath) {
      this.updateElement(newSubpath, element, file);
    }
  }

  private async actionMarkdownBlock (file: TFile, subpath: string, element: ExcalidrawEmbeddableElement) {
    if(!file) return;
    this.view.updateScene({appState: {activeEmbeddable: null}, storeAction: "update"});
    const paragraphs = (await this.view.app.metadataCache.blockCache
      .getForFile({ isCancelled: () => false },file))
      .blocks.filter((b: any) => b.display && b.node && 
        (b.node.type === "paragraph" || b.node.type === "blockquote" || b.node.type === "listItem" || b.node.type === "table" || b.node.type === "callout")
      );
    const values = ["entire-file"].concat(paragraphs);
    const display = [t("SHOW_ENTIRE_FILE")].concat(
      paragraphs.map((b: any) => `${b.node?.id ? `#^${b.node.id}: ` : ``}${b.display.trim()}`));

    const selectedBlock = await ScriptEngine.suggester(
      this.view.app, display, values, "Select section from document"
    );
    if(!selectedBlock) return;

    if(selectedBlock==="entire-file") {
      if(subpath==="") return;
      this.updateElement("", element, file);
      return;
    }

    let blockID = selectedBlock.node.id;
    if(blockID && (`#^${blockID}` === subpath)) return;
    if (!blockID) {
      const offset = selectedBlock.node?.position?.end?.offset;
      if(!offset) return;
      blockID = nanoid();
      const fileContents = await this.view.app.vault.cachedRead(file);
      if(!fileContents) return;
      await this.view.app.vault.modify(file, fileContents.slice(0, offset) + ` ^${blockID}` + fileContents.slice(offset));
      await sleep(200); //wait for cache to update
    }
    this.updateElement(`#^${blockID}`, element, file);
  }

  private actionZoomToElement (element: ExcalidrawEmbeddableElement, maxLevel?: number) {
    if(!element) return;
    const api = this.view.excalidrawAPI as ExcalidrawImperativeAPI;
    api.zoomToFit([element], maxLevel ?? this.view.plugin.settings.zoomToFitMaxLevel, 0.1);
  }

  private actionProperties (element: ExcalidrawEmbeddableElement, file: TFile) {
    if(!element) return;
    new EmbeddableSettings(this.view.plugin,this.view,file,element).open();
  }

  private actionCrop (element: ExcalidrawEmbeddableElement) {
    if(!element) return;
    //@ts-ignore
    this.view.app.commands.executeCommandById("obsidian-excalidraw-plugin:crop-image");
  }

  private actionReload (iframe: HTMLIFrameElement, link: string) {
    iframe.src = link;
  }

  private actionOpen (iframe: HTMLIFrameElement, element: ExcalidrawEmbeddableElement) {
    openExternalLink(
      !iframe.src.startsWith("https://www.youtube.com") && !iframe.src.startsWith("https://player.vimeo.com") 
        ? iframe.src
        : element.link,
      this.view.app
    );
  }

  private actionCopyCode (element: ExcalidrawEmbeddableElement, link: string) {
    if(!element) return;
    navigator.clipboard.writeText(atob(link.split(",")[1]));
  }

  renderButtons(appState: AppState) {
    const view = this.view;
    const api = view?.excalidrawAPI as ExcalidrawImperativeAPI;
    if(!api) return null;
    if(!view.file) return null;
    const disableFrameButtons = appState.viewModeEnabled && !view.allowFrameButtonsInViewMode;
    if(!appState.activeEmbeddable || appState.activeEmbeddable.state !== "active" || disableFrameButtons) {
      this.menuElementId = null;
      if(this.menuFadeTimeout) {
        clearTimeout(this.menuFadeTimeout);
        this.menuFadeTimeout = 0;
      }
      return null;
    }
    const element = appState.activeEmbeddable?.element as ExcalidrawEmbeddableElement;
    if(this.menuElementId !== element.id) {
      this.menuElementId = element.id;
      this.handleMouseLeave();
    }
    let link = element.link;
    if(!link) return null;

    const isExcalidrawiFrame = useDefaultExcalidrawFrame(element);
    let isObsidianiFrame = Boolean(element.link?.match(REG_LINKINDEX_HYPERLINK));
  
    if(!isExcalidrawiFrame && !isObsidianiFrame) {
      if(link.startsWith("data:text/html")) {
        isObsidianiFrame = true;
      } else {
        const res = REGEX_LINK.getRes(element.link).next();
        if(!res || (!res.value && res.done)) {
          return null;
        }
    
        link = REGEX_LINK.getLink(res);
    
        isObsidianiFrame = Boolean(link.match(REG_LINKINDEX_HYPERLINK));
      }

      if(!isObsidianiFrame) {
        const { subpath, file } = processLinkText(link, view);
        if(!file) return;
        const isMD = file.extension==="md";
        const isExcalidrawFile = view.plugin.isExcalidrawFile(file);
        const isPDF = file.extension==="pdf";
        const { x, y } = sceneCoordsToViewportCoords( { sceneX: element.x, sceneY: element.y }, appState);
        const top = `${y-2.5*ROOTELEMENTSIZE-appState.offsetTop}px`;
        const left = `${x-appState.offsetLeft}px`;
        
        return (
          <div
            ref={this.containerRef}
            className="embeddable-menu"
            style={{
              top,
              left,
              opacity: 1,
            }}
            onMouseEnter={()=>this.handleMouseEnter()}
            onPointerDown={()=>this.handleMouseEnter()}
            onMouseLeave={()=>this.handleMouseLeave()}
          >  
            <div
              className="Island"
              style={{
                position: "relative",
                display: "block",
              }}
            >
              {isMD && (
                <ActionButton
                  key={"MarkdownSection"}
                  title={t("NARROW_TO_HEADING")}
                  action={async () => this.actionMarkdownSelection(file, isExcalidrawFile, subpath, element)}
                  icon={ICONS.ZoomToSection}
                />
              )}
              {isMD && !isExcalidrawFile && (
                <ActionButton
                  key={"MarkdownBlock"}
                  title={t("NARROW_TO_BLOCK")}
                  action={async () => this.actionMarkdownBlock(file, subpath, element)}
                  icon={ICONS.ZoomToBlock}
                />
              )}
              <ActionButton
                key={"ZoomToElement"}
                title={t("ZOOM_TO_FIT")}
                action={() => this.actionZoomToElement(element,30)}
                icon={ICONS.ZoomToSelectedElement}
              />
              <ActionButton
                key={"Properties"}
                title={t("PROPERTIES")}
                action={() => this.actionProperties(element, file)}
                icon={ICONS.Properties}
              />
              {isPDF && (
                <ActionButton
                key={"Crop"}
                title={t("CROP_PAGE")}
                action={() => this.actionCrop(element)}
                icon={ICONS.Crop}
              />
              )}
            </div>
          </div>  
        );
      }
    }
    if(isObsidianiFrame || isExcalidrawiFrame) {
      const iframe = isExcalidrawiFrame
        ? api.getHTMLIFrameElement(element.id)
        : view.getEmbeddableElementById(element.id);
      if(!iframe || !iframe.contentWindow) return null;
      const { x, y } = sceneCoordsToViewportCoords( { sceneX: element.x, sceneY: element.y }, appState);
      const top = `${y-2.5*ROOTELEMENTSIZE-appState.offsetTop}px`;
      const left = `${x-appState.offsetLeft}px`;
      return (
        <div
          ref={this.containerRef}
          className="embeddable-menu"
          style={{
            top,
            left,
            opacity: 1,
          }}
          onMouseEnter={()=>this.handleMouseEnter()}
          onPointerDown={()=>this.handleMouseEnter()}
          onMouseLeave={()=>this.handleMouseLeave()}
        >  
          <div
            className="Island"
            style={{
              position: "relative",
              display: "block",
            }}
          >
            {(iframe.src !== link) && !iframe.src.startsWith("https://www.youtube.com") && !iframe.src.startsWith("https://player.vimeo.com") && (
              <ActionButton
                key={"Reload"}
                title={t("RELOAD")}
                action={()=> this.actionReload(iframe, link)}
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
