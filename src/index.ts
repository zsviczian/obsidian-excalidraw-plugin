import "obsidian";
import { ExcalidrawAutomate } from "./ExcalidrawAutomate";
import ExcalidrawView from "./ExcalidrawView";
export {ExcalidrawAutomateInterface} from  "./types";
export type { ExcalidrawBindableElement, ExcalidrawElement, FileId, FillStyle, StrokeSharpness, StrokeStyle } from "@zsviczian/excalidraw/types/element/types";
export type { Point } from "@zsviczian/excalidraw/types/types";
export const getEA = (view?:ExcalidrawView): ExcalidrawAutomate => {
  return window.ExcalidrawAutomate.getAPI(view);
}