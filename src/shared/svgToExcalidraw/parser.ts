import type { ExcalidrawGenericElement } from "./elements/ExcalidrawElement";
import type {
  SVGConversionState,
  SVGWarning,
  SVGTextMeasurer,
  SVGMatrix,
} from "src/types/svgConversionTypes";
import { walkSVG } from "./walker";

export type ConversionResult = {
  hasErrors: boolean;
  errors: string;
  content: ExcalidrawGenericElement[];
  warnings: SVGWarning[];
};

/** Synchronously stages a bounded conversion; failure never publishes partial elements. */
export const svgToExcalidraw = (
  svgString: string,
  options: {
    measureText?: SVGTextMeasurer;
    transform?: SVGMatrix;
    boundsViewport?: { width: number; height: number };
  } = {},
): ConversionResult => {
  try {
    if (typeof svgString !== "string" || svgString.length > 2000000)
      throw Error("SVG input size limit exceeded");
    let tags = 0;
    const tagPattern = /<[A-Za-z_]/g;
    while (tagPattern.exec(svgString))
      if (++tags > 20000) throw Error("SVG input element limit exceeded");
    if (/<!DOCTYPE|<!ENTITY/i.test(svgString))
      throw Error("SVG document types and entities are not supported");
    const doc = new DOMParser().parseFromString(svgString, "image/svg+xml");
    const root = doc.documentElement;
    if (
      doc.getElementsByTagName("parsererror").length ||
      root?.localName !== "svg" ||
      (root.namespaceURI && root.namespaceURI !== "http://www.w3.org/2000/svg")
    )
      throw Error("Invalid SVG XML document");
    const state: SVGConversionState = {
      textCharacters: 0,
      measureText: options.measureText,
      elements: [],
      warnings: new Set(),
      nodes: 0,
      points: 0,
      operations: 0,
      references: new Set(),
      ids: new Map(),
      rules: [],
    };
    if (/<\?xml-stylesheet/i.test(svgString)) state.warnings.add("css");
    walkSVG(root, state, options.transform, options.boundsViewport);
    return {
      hasErrors: false,
      errors: "",
      content: state.elements,
      warnings: [...state.warnings],
    };
  } catch (error: unknown) {
    return {
      hasErrors: true,
      errors:
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "SVG conversion failed",
      content: [],
      warnings: [],
    };
  }
};
