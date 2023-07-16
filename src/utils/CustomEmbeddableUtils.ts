import { NonDeletedExcalidrawElement } from "@zsviczian/excalidraw/types/element/types";
import { DEVICE, REG_LINKINDEX_INVALIDCHARS, TWITTER_REG } from "src/Constants";
import { getParentOfClass } from "./ObsidianUtils";
import { TFile, WorkspaceLeaf } from "obsidian";
import { getLinkParts } from "./Utils";
import ExcalidrawView from "src/ExcalidrawView";

export const useDefaultExcalidrawFrame = (element: NonDeletedExcalidrawElement) => {
  return !element.link.startsWith("[") && !element.link.match(TWITTER_REG);
}

export const leafMap = new Map<string, WorkspaceLeaf>();

//This is definitely not the right solution, feels like sticking plaster
//patch disappearing content on mobile
export const patchMobileView = (view: ExcalidrawView) => {
  if(DEVICE.isDesktop) return;
  console.log("patching mobile view");
  const parent = getParentOfClass(view.containerEl,"mod-top");
  if(parent) {
    if(!parent.hasClass("mod-visible")) {
      parent.addClass("mod-visible");
    }
  }
}

export const processLinkText = (linkText: string, view:ExcalidrawView): { subpath:string, file:TFile } => {
  let subpath:string = null;

  if (linkText.search("#") > -1) {
    const linkParts = getLinkParts(linkText, view.file);
    subpath = `#${linkParts.isBlockRef ? "^" : ""}${linkParts.ref}`;
    linkText = linkParts.path;
  }

  if (linkText.match(REG_LINKINDEX_INVALIDCHARS)) {
    return {subpath, file: null};
  }

  const file = app.metadataCache.getFirstLinkpathDest(
    linkText,
    view.file.path,
  );

  return { subpath, file };
}