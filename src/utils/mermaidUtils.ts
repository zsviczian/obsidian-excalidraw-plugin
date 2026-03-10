import { ExcalidrawElement, ExcalidrawImageElement } from "@zsviczian/excalidraw/types/element/src/types";
import { requireApiVersion } from "obsidian";

export function getMermaidImageElements (elements: ExcalidrawElement[]):ExcalidrawImageElement[] {
  return elements
  ? elements.filter((element) =>
    element.type === "image" && element.customData?.mermaidText
  ) as ExcalidrawImageElement[]
  : [];
}
 
export function getMermaidText (element: ExcalidrawElement):string {
  return element.customData?.mermaidText;
}

export function shouldRenderMermaid():boolean {
  return requireApiVersion("1.4.14");
}