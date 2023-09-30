import { ExcalidrawElement, ExcalidrawImageElement } from "@zsviczian/excalidraw/types/element/types";
import { requireApiVersion } from "obsidian";

export const getMermaidImageElements = (elements: ExcalidrawElement[]):ExcalidrawImageElement[] =>
  elements
  ? elements.filter((element) =>
    element.type === "image" && element.customData?.mermaidText
  ) as ExcalidrawImageElement[]
  : [];
 
export const getMermaidText = (element: ExcalidrawElement):string =>
  element.customData?.mermaidText;

export const shouldRenderMermaid = ():boolean => requireApiVersion("1.4.14");