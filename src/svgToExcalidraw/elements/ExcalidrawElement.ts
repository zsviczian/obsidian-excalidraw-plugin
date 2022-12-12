import { randomId, randomInteger } from "../utils";

import { ExcalidrawLinearElement, FillStyle, GroupId, RoundnessType, StrokeStyle } from "@zsviczian/excalidraw/types/element/types";

export type Point = [number, number];

export type ExcalidrawElementBase = {
  id: string;
  x: number;
  y: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  roundness: null | { type: RoundnessType; value?: number };
  roughness: number;
  opacity: number;
  width: number;
  height: number;
  angle: number;
  /** Random integer used to seed shape generation so that the roughjs shape
      doesn't differ across renders. */
  seed: number;
  /** Integer that is sequentially incremented on each change. Used to reconcile
      elements during collaboration or when saving to server. */
  version: number;
  /** Random integer that is regenerated on each change.
      Used for deterministic reconciliation of updates during collaboration,
      in case the versions (see above) are identical. */
  versionNonce: number;
  isDeleted: boolean;
  /** List of groups the element belongs to.
      Ordered from deepest to shallowest. */
  groupIds: GroupId[];
  /** Ids of (linear) elements that are bound to this element. */
  boundElementIds: ExcalidrawLinearElement["id"][] | null;
};

export type ExcalidrawRectangle = ExcalidrawElementBase & {
  type: "rectangle";
};

export type ExcalidrawLine = ExcalidrawElementBase & {
  type: "line";
  points: readonly Point[];
};

export type ExcalidrawEllipse = ExcalidrawElementBase & {
  type: "ellipse";
};

export type ExcalidrawGenericElement =
  | ExcalidrawRectangle
  | ExcalidrawEllipse
  | ExcalidrawLine
  | ExcalidrawDraw;

export type ExcalidrawDraw = ExcalidrawElementBase & {
  type: "line";
  points: readonly Point[];
};

export function createExElement(): ExcalidrawElementBase {
  return {
    id: randomId(),
    x: 0,
    y: 0,
    strokeColor: "#000000",
    backgroundColor: "#000000",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roundness: null,
    roughness: 0,
    opacity: 100,
    width: 0,
    height: 0,
    angle: 0,
    seed: randomInteger(),
    version: 0,
    versionNonce: 0,
    isDeleted: false,
    groupIds: [],
    boundElementIds: null,
  };
}

export function createExRect(): ExcalidrawRectangle {
  return {
    ...createExElement(),
    type: "rectangle",
  };
}

export function createExLine(): ExcalidrawLine {
  return {
    ...createExElement(),
    type: "line",
    points: [],
  };
}

export function createExEllipse(): ExcalidrawEllipse {
  return {
    ...createExElement(),
    type: "ellipse",
  };
}

export function createExDraw(): ExcalidrawDraw {
  return {
    ...createExElement(),
    type: "line",
    points: [],
  };
}
