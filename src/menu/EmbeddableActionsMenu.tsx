import { TFile } from "obsidian";
import * as React from "react";
import ExcalidrawView from "../ExcalidrawView";
import { ExcalidrawElement, ExcalidrawEmbeddableElement } from "@zsviczian/excalidraw/types/element/types";
import { AppState, ExcalidrawImperativeAPI } from "@zsviczian/excalidraw/types/types";
import { ActionButton } from "./ActionButton";
import { ICONS } from "./ActionIcons";
import { t } from "src/lang/helpers";
import { ScriptEngine } from "src/Scripts";
import { ROOTELEMENTSIZE, mutateElement, nanoid, sceneCoordsToViewportCoords } from "src/constants";
import { REGEX_LINK, REG_LINKINDEX_HYPERLINK } from "src/ExcalidrawData";
import { processLinkText, useDefaultExcalidrawFrame } from "src/utils/CustomEmbeddableUtils";
import { cleanSectionHeading } from "src/utils/ObsidianUtils";

export class EmbeddableMenu {

  constructor( 
    private view:ExcalidrawView,
    private containerRef: React.RefObject<HTMLDivElement>,
  ) {
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
    mutateElement (element,{link});
    view.excalidrawData.elementLinks.set(element.id, link);
    view.setDirty(99);
    view.updateScene({appState: {activeEmbeddable: null}});
  }

  private menuFadeTimeout: number = 0;
  private menuElementId: string = null;
  private handleMouseEnter () {
    clearTimeout(this.menuFadeTimeout);
    this.containerRef.current?.style.setProperty("opacity", "1");
  };

  private handleMouseLeave () {
    const self = this;
    this.menuFadeTimeout = window.setTimeout(() => {
      self.containerRef.current?.style.setProperty("opacity", "0.2");
    }, 5000);
  };


  renderButtons(appState: AppState) {
    const view = this.view;
    const app = view.app;
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
    let isObsidianiFrame = element.link?.match(REG_LINKINDEX_HYPERLINK);
  
    if(!isExcalidrawiFrame && !isObsidianiFrame) {
      const res = REGEX_LINK.getRes(element.link).next();
      if(!res || (!res.value && res.done)) {
        return null;
      }
  
      link = REGEX_LINK.getLink(res);
  
      isObsidianiFrame = link.match(REG_LINKINDEX_HYPERLINK);

      if(!isObsidianiFrame) {
        const { subpath, file } = processLinkText(link, view);
        if(!file || file.extension!=="md") return null;
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
              <ActionButton
                key={"MarkdownSection"}
                title={t("NARROW_TO_HEADING")}
                action={async () => {
                  const sections = (await app.metadataCache.blockCache
                    .getForFile({ isCancelled: () => false },file))
                    .blocks.filter((b: any) => b.display && b.node?.type === "heading");
                  const values = [""].concat(
                    sections.map((b: any) => `#${cleanSectionHeading(b.display)}`)
                  );
                  const display = [t("SHOW_ENTIRE_FILE")].concat(
                    sections.map((b: any) => b.display)
                  );
                  const newSubpath = await ScriptEngine.suggester(
                    app, display, values, "Select section from document"
                  );
                  if(!newSubpath && newSubpath!=="") return;
                  if (newSubpath !== subpath) {
                    this.updateElement(newSubpath, element, file);
                  }
                }}
                icon={ICONS.ZoomToSection}
                view={view}
              />
              <ActionButton
                key={"MarkdownBlock"}
                title={t("NARROW_TO_BLOCK")}
                action={async () => {
                  if(!file) return;
                  const paragrphs = (await app.metadataCache.blockCache
                    .getForFile({ isCancelled: () => false },file))
                    .blocks.filter((b: any) => b.display && b.node?.type === "paragraph");
                  const values = ["entire-file"].concat(paragrphs);
                  const display = [t("SHOW_ENTIRE_FILE")].concat(
                    paragrphs.map((b: any) => `${b.node?.id ? `#^${b.node.id}: ` : ``}${b.display.trim()}`));
    
                  const selectedBlock = await ScriptEngine.suggester(
                    app, display, values, "Select section from document"
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
                    const fileContents = await app.vault.cachedRead(file);
                    if(!fileContents) return;
                    await app.vault.modify(file, fileContents.slice(0, offset) + ` ^${blockID}` + fileContents.slice(offset));
                    await sleep(200); //wait for cache to update
                  }
                  this.updateElement(`#^${blockID}`, element, file);
                }}
                icon={ICONS.ZoomToBlock}
                view={view}
              />
              <ActionButton
                key={"ZoomToElement"}
                title={t("ZOOM_TO_FIT")}
                action={() => {
                  if(!element) return;
                  api.zoomToFit([element], view.plugin.settings.zoomToFitMaxLevel, 0.1);
                }}
                icon={ICONS.ZoomToSelectedElement}
                view={view}
              />
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
                action={()=>{
                  iframe.src = link;
                }}
                icon={ICONS.Reload}
                view={view}
              />
            )}
            <ActionButton
              key={"Open"}
              title={t("OPEN_IN_BROWSER")}
              action={() => {
                view.openExternalLink(
                  !iframe.src.startsWith("https://www.youtube.com") && !iframe.src.startsWith("https://player.vimeo.com") 
                  ? iframe.src
                  : element.link
                );
              }}
              icon={ICONS.Globe}
              view={view}
            />
            <ActionButton
              key={"ZoomToElement"}
              title={t("ZOOM_TO_FIT")}
              action={() => {
                if(!element) return;
                api.zoomToFit([element], view.plugin.settings.zoomToFitMaxLevel, 0.1);
              }}
              icon={ICONS.ZoomToSelectedElement}
              view={view}
            />
          </div>
        </div>  
      );
    }
  }
}
