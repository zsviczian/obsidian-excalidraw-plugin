import "obsidian";
//import { ExcalidrawAutomate } from "./ExcalidrawAutomate";
//export ExcalidrawAutomate from "./ExcalidrawAutomate";
//export {ExcalidrawAutomate} from  "./ExcaildrawAutomate";
export type { ExcalidrawBindableElement, ExcalidrawElement, FileId, FillStyle, StrokeRoundness, StrokeStyle } from "@zsviczian/excalidraw/types/excalidraw/element/types";
export type { Point } from "src/types/types";
export const getEA = (view?:any): any => {
  try {
    return window.ExcalidrawAutomate.getAPI(view);
  } catch(e) {
    console.log({message: "Excalidraw not available", fn: getEA});
    return null;
  }
}