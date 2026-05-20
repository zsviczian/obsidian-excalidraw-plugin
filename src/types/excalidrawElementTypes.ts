import { ExcalidrawFrameElement } from "@zsviczian/excalidraw/types/element/src/types";

export type NamedExcalidrawFrameElement = ExcalidrawFrameElement & {
  frameRole?: string;
  name?: string;
};
