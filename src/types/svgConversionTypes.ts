/** Internal SVG conversion context. No new persisted element or scripting contract. */
import type {
  Point,
  ExcalidrawGenericElement,
} from "src/shared/svgToExcalidraw/elements/ExcalidrawElement";
export type SVGMatrix = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
];
export type SVGWarning =
  | "compositing"
  | "stroke"
  | "paint"
  | "text"
  | "unsupported"
  | "css"
  | "viewport";
export type SVGStyle = Record<string, string>;
export type SVGContour = { points: Point[]; closed: boolean };
export type SVGContext = {
  matrix: SVGMatrix;
  style: SVGStyle;
  opacity: number;
  groups: string[];
  viewport: { width: number; height: number };
};
export type SVGConversionState = {
  textCharacters: number;
  measureText?: SVGTextMeasurer;
  elements: ExcalidrawGenericElement[];
  warnings: Set<SVGWarning>;
  nodes: number;
  points: number;
  operations: number;
  references: Set<Element>;
  ids: Map<string, Element>;
  rules: {
    selector: string;
    declarations: SVGStyle;
    specificity: readonly [ids: number, classes: number, types: number];
    order: number;
  }[];
};

/** Host font metrics keep conversion synchronous without importing another renderer. */
export type SVGTextMeasurer = (
  text: string, fontSize: number, fontFamily: number, lineHeight: number,
) => { width: number; height: number };
