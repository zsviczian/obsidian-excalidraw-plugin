import { randomId, randomInteger } from "../utils";

import type {
  ExcalidrawEllipseElement,
  ExcalidrawRectangleElement,
} from "@zsviczian/excalidraw/types/element/src/types";
import type { Mutable } from "@zsviczian/excalidraw/types/common/src/utility-types";
import type { Radians } from "@zsviczian/excalidraw/types/math/src/types";

export type Point = [number, number];

/**
 * Mutable local copy of the fork's element base shape. The real
 * `_ExcalidrawElementBase` type is `Readonly` and not exported on its own,
 * so this is derived via `Omit` from `ExcalidrawRectangleElement` (which
 * adds nothing beyond the `type` discriminant over the real base) rather
 * than hand-duplicating every field -- field types can't drift from the
 * real ones this way. `Mutable` strips the `readonly` modifiers so the
 * existing object-literal-mutation style in attributes.ts keeps working.
 */
export type ExcalidrawElementBase = Mutable<
  Omit<ExcalidrawRectangleElement, "type">
>;

export type ExcalidrawRectangle = Mutable<ExcalidrawRectangleElement>;

export type ExcalidrawEllipse = Mutable<ExcalidrawEllipseElement>;

/**
 * NOTE: not yet aligned to the real `ExcalidrawLineElement` type. That type
 * additionally requires `startBinding`/`endBinding`/`startArrowhead`/
 * `endArrowhead`/`polygon` and branded `LocalPoint` tuples (via
 * `pointFrom()`) instead of plain `[number, number]`, which would also
 * touch every point-producing helper in this module (bezier.ts,
 * path-to-points.ts, ellipse.ts, transform.ts). Left as a local shape for
 * now; a real-type pass is a separate, larger step.
 */
export type ExcalidrawLine = ExcalidrawElementBase & {
  type: "line";
  points: readonly Point[];
};

export type ExcalidrawDraw = ExcalidrawElementBase & {
  type: "line";
  points: readonly Point[];
};

export type ExcalidrawGenericElement =
  | ExcalidrawRectangle
  | ExcalidrawEllipse
  | ExcalidrawLine
  | ExcalidrawDraw;

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
    angle: 0 as Radians,
    seed: randomInteger(),
    version: 0,
    versionNonce: 0,
    isDeleted: false,
    groupIds: [],
    // The following match the real fork's own newElement() defaults for a
    // freshly created, not-yet-in-scene element (packages/element/src/newElement.ts).
    frameId: null,
    index: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
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
