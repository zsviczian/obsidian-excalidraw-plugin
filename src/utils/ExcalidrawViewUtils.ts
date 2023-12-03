
import { MAX_IMAGE_SIZE, IMAGE_TYPES, ANIMATED_IMAGE_TYPES } from "src/constants/constants";
import { TFile } from "obsidian";
import { ExcalidrawAutomate } from "src/ExcalidrawAutomate";
import { REGEX_LINK, REG_LINKINDEX_HYPERLINK } from "src/ExcalidrawData";

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