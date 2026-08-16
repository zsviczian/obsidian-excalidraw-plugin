import { randomId, randomInteger } from "../utils";

import type {
  ExcalidrawEllipseElement,
  ExcalidrawLineElement,
  ExcalidrawRectangleElement,
} from "@zsviczian/excalidraw/types/element/src/types";
import type { Mutable } from "@zsviczian/excalidraw/types/common/src/utility-types";
import type { LocalPoint } from "@zsviczian/excalidraw/types/math/src/types";
import type { Radians } from "@zsviczian/excalidraw/types/math/src/types";

/** Internal, unbranded working point used by every geometry helper in this
 * module (bezier/ellipse/path math, matrix transforms). Only converted to
 * the real fork's branded `LocalPoint` at the point an element is finalized
 * -- see `toLocalPoint()`. */
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

export type ExcalidrawLine = Mutable<ExcalidrawLineElement>;

export type ExcalidrawGenericElement =
  | ExcalidrawRectangle
  | ExcalidrawEllipse
  | ExcalidrawLine;

/**
 * Reimplements the fork's `pointFrom<LocalPoint>(x, y)` locally instead of
 * importing it: at runtime that function is just `[x, y] as Point` (a pure
 * compile-time brand, verified against packages/math/src/point.ts in the
 * fork), and this plugin never imports runtime Excalidraw code directly --
 * the actual runtime is loaded separately per-window via `PackageManager`/
 * `window.ExcalidrawLib`. Importing it here would statically bundle a
 * second copy of fork code into the plugin build.
 */
const toLocalPoint = ([x, y]: Point): LocalPoint => [x, y] as LocalPoint;

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

export function createExEllipse(): ExcalidrawEllipse {
  return {
    ...createExElement(),
    type: "ellipse",
  };
}

/** SVG shapes converted to a "line" element are always closed, fillable
 * regions (the polygon feature didn't exist yet when this module was
 * written; every caller wants `polygon: true`). */
export function createExLine(points: readonly Point[] = []): ExcalidrawLine {
  return {
    ...createExElement(),
    type: "line",
    polygon: true,
    points: points.map(toLocalPoint),
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: null,
  };
}
