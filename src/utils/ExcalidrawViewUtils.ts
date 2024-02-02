
import { MAX_IMAGE_SIZE, IMAGE_TYPES, ANIMATED_IMAGE_TYPES } from "src/constants/constants";
import { App, TFile } from "obsidian";
import { ExcalidrawAutomate } from "src/ExcalidrawAutomate";
import { REGEX_LINK, REG_LINKINDEX_HYPERLINK } from "src/ExcalidrawData";
import ExcalidrawView from "src/ExcalidrawView";
import { ExcalidrawElement } from "@zsviczian/excalidraw/types/excalidraw/element/types";
import { getLinkParts } from "./Utils";

export const insertImageToView = async (
  ea: ExcalidrawAutomate,
  position: { x: number, y: number },
  file: TFile | string,
  scale?: boolean,
):Promise<string> => {
  ea.clear();
  ea.style.strokeColor = "transparent";
  ea.style.backgroundColor = "transparent";
  const api = ea.getExcalidrawAPI();
  ea.canvas.theme = api.getAppState().theme;
  const id = await ea.addImage(
    position.x,
    position.y,
    file,
    scale,
  );
  await ea.addElementsToView(false, true, true);
  return id;
}

export const insertEmbeddableToView = async (
  ea: ExcalidrawAutomate,
  position: { x: number, y: number },
  file?: TFile,
  link?: string,
):Promise<string> => {
  ea.clear();
  ea.style.strokeColor = "transparent";
  ea.style.backgroundColor = "transparent";
  if(file && (IMAGE_TYPES.contains(file.extension) || ea.isExcalidrawFile(file)) && !ANIMATED_IMAGE_TYPES.contains(file.extension)) {
    return await insertImageToView(ea, position, file);
  } else {
    const id = ea.addEmbeddable(
      position.x,
      position.y,
      MAX_IMAGE_SIZE,
      MAX_IMAGE_SIZE,
      link,
      file,
    );
    await ea.addElementsToView(false, true, true);
    return id;
  }
}

export const getLinkTextFromLink = (text: string): string => {
  if (!text) return;
  if (text.match(REG_LINKINDEX_HYPERLINK)) return;

  const parts = REGEX_LINK.getRes(text).next();
  if (!parts.value) return;

  const linktext = REGEX_LINK.getLink(parts); //parts.value[2] ? parts.value[2]:parts.value[6];
  if (linktext.match(REG_LINKINDEX_HYPERLINK)) return;

  return linktext;
}

export const openTagSearch = (link:string, app: App, view?: ExcalidrawView) => {
  const tags = link
    .matchAll(/#([\p{Letter}\p{Emoji_Presentation}\p{Number}\/_-]+)/gu)
    .next();
  if (!tags.value || tags.value.length < 2) {
    return;
  }
  const search = app.workspace.getLeavesOfType("search");
  if (search.length == 0) {
    return;
  }
  //@ts-ignore
  search[0].view.setQuery(`tag:${tags.value[1]}`);
  app.workspace.revealLeaf(search[0]);

  if (view && view.isFullscreen()) {
    view.exitFullscreen();
  }
  return;
}

export const openExternalLink = (link:string, app: App, element?: ExcalidrawElement):boolean => {
  if (link.match(/^cmd:\/\/.*/)) {
    const cmd = link.replace("cmd://", "");
    //@ts-ignore
    app.commands.executeCommandById(cmd);
    return true;
  }
  if (link.match(REG_LINKINDEX_HYPERLINK)) {
      window.open(link, "_blank");
    return true;
  }
  return false;
}

export const getExcalidrawFileForwardLinks = (app: App, excalidrawFile: TFile):string => {
  let secondOrderLinks = "";
  const forwardLinks = app.metadataCache.getLinks()[excalidrawFile.path];
  if(forwardLinks && forwardLinks.length > 0) {
    const linkset = new Set<string>();
    forwardLinks.forEach(link => {
      const linkparts = getLinkParts(link.link);
      const f = app.metadataCache.getFirstLinkpathDest(linkparts.path, excalidrawFile.path);
      if(f && f.path !== excalidrawFile.path) {
        linkset.add(`[[${f.path}${linkparts.ref?"#"+linkparts.ref:""}|Second Order Link: ${f.basename}]]`);
      }
    });
    secondOrderLinks = [...linkset].join(" ");             
  }
  return secondOrderLinks;
}