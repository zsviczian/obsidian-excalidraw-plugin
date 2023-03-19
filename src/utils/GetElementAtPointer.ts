import { ExcalidrawElement, ExcalidrawImageElement, ExcalidrawTextElement } from "@zsviczian/excalidraw/types/element/types";
import { REGEX_LINK, REG_LINKINDEX_HYPERLINK } from "src/ExcalidrawData";
import ExcalidrawView, { TextMode } from "src/ExcalidrawView";
import { rotatedDimensions } from "./Utils";

export const getElementsAtPointer = (
  pointer: any,
  elements: ExcalidrawElement[],
  type?: string,
): ExcalidrawElement[] => {
  return elements.filter((e: ExcalidrawElement) => {
    if (type && e.type !== type) {
      return false;
    }
    if (e.locked) {
      return false;
    }
    const [x, y, w, h] = rotatedDimensions(e);
    return (
      x <= pointer.x &&
      x + w >= pointer.x &&
      y <= pointer.y &&
      y + h >= pointer.y
    );
  });
};

export const getTextElementAtPointer = (pointer: any, view: ExcalidrawView) => {
  const api = view.excalidrawAPI;
  if (!api) {
    return { id: null, text: null };
  }
  const elements = getElementsAtPointer(
    pointer,
    api.getSceneElements(),
    "text",
  ) as ExcalidrawTextElement[];
  if (elements.length == 0) {
    return { id: null, text: null };
  }
  if (elements.length === 1) {
    return { id: elements[0].id, text: elements[0].text };
  }
  //if more than 1 text elements are at the location, look for one that has a link
  const elementsWithLinks = elements.filter(
    (e: ExcalidrawTextElement) => {
      const text: string =
        view.textMode === TextMode.parsed
          ? view.excalidrawData.getRawText(e.id)
          : e.text;
      if (!text) {
        return false;
      }
      if (text.match(REG_LINKINDEX_HYPERLINK)) {
        return true;
      }
      const parts = REGEX_LINK.getRes(text).next();
      if (!parts.value) {
        return false;
      }
      return true;
    },
  );
  //if there are no text elements with links, return the first element without a link
  if (elementsWithLinks.length == 0) {
    return { id: elements[0].id, text: elements[0].text };
  }
  //if there are still multiple text elements with links on top of each other, return the first
  return { id: elementsWithLinks[0].id, text: elementsWithLinks[0].text };
};

export const getImageElementAtPointer = (pointer: any, view: ExcalidrawView) => {
  const api = view.excalidrawAPI;
  if (!api) {
    return;
  }
  const elements = getElementsAtPointer(
    pointer,
    api.getSceneElements(),
    "image",
  ) as ExcalidrawImageElement[];
  if (elements.length === 0) {
    return { id: null, fileId: null };
  }
  if (elements.length >= 1) {
    return { id: elements[0].id, fileId: elements[0].fileId };
  }
  //if more than 1 image elements are at the location, return the first
};

export const getElementWithLinkAtPointer = (pointer: any, view: ExcalidrawView) => {
const api = view.excalidrawAPI;
  if (!api) {
    return;
  }
  const elements = (
    getElementsAtPointer(
      pointer,
      api.getSceneElements(),
    ) as ExcalidrawImageElement[]
  ).filter((el) => el.link);

  if (elements.length === 0) {
    return { id: null, text: null };
  }

  if (elements.length >= 1) {
    return { id: elements[0].id, text: elements[0].link };
  }
};