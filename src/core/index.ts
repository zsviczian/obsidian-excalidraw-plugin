import "obsidian";
import type { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";
import type ExcalidrawView from "src/view/ExcalidrawView";
//import { ExcalidrawAutomate } from "./ExcalidrawAutomate";
//export ExcalidrawAutomate from "./ExcalidrawAutomate";
//export {ExcalidrawAutomate} from  "./ExcaildrawAutomate";
export type {
  ExcalidrawBindableElement,
  ExcalidrawElement,
  FileId,
  FillStyle,
  StrokeRoundness,
  StrokeStyle,
} from "@zsviczian/excalidraw/types/element/src/types";
export type { Point } from "src/types/types";
export const getEA = (view?: ExcalidrawView): ExcalidrawAutomate | null => {
  try {
    return window.ExcalidrawAutomate.getAPI(view);
  } catch (_) {
    console.log({ message: "Excalidraw not available", fn: getEA });
    return null;
  }
};
