import chroma from "chroma-js";
import { ExcalidrawElementBase } from "./elements/ExcalidrawElement";

export function hexWithAlpha(color: string, alpha: number): string {
  return chroma(color).alpha(alpha).css();
}

export function has(el: Element, attr: string): boolean {
  return el.hasAttribute(attr);
}

export function get(el: Element, attr: string, backup?: string): string {
  return el.getAttribute(attr) || backup || "";
}

export function getNum(el: Element, attr: string, backup?: number): number {
  const numVal = Number(get(el, attr));
  return Number.isNaN(numVal) ? backup || 0 : numVal;
}

type ExPartialElement = Partial<ExcalidrawElementBase>;

type AttrHandlerArgs = {
  el: Element;
  exVals: ExPartialElement;
};

type PresAttrName =
  | "stroke"
  | "stroke-opacity"
  | "stroke-width"
  | "fill"
  | "fill-opacity"
  | "opacity";

type PresAttrHandlers = {
  [key in PresAttrName]: (args: AttrHandlerArgs) => void;
};

const attrHandlers: PresAttrHandlers = {
  stroke: ({ el, exVals }) => {
    const strokeColor = get(el, "stroke");

    exVals.strokeColor = has(el, "stroke-opacity")
      ? hexWithAlpha(strokeColor, getNum(el, "stroke-opacity"))
      : strokeColor;
  },

  "stroke-opacity": ({ el, exVals }) => {
    exVals.strokeColor = hexWithAlpha(
      get(el, "stroke", "#000000"),
      getNum(el, "stroke-opacity"),
    );
  },

  "stroke-width": ({ el, exVals }) => {
    exVals.strokeWidth = getNum(el, "stroke-width");
  },

  fill: ({ el, exVals }) => {
    const fill = get(el, `fill`);

    exVals.backgroundColor = fill === "none" ? "#00000000" : fill;
  },

  "fill-opacity": ({ el, exVals }) => {
    exVals.backgroundColor = hexWithAlpha(
      get(el, "fill", "#000000"),
      getNum(el, "fill-opacity"),
    );
  },

  opacity: ({ el, exVals }) => {
    exVals.opacity = getNum(el, "opacity", 100);
  },
};

// Presentation Attributes for SVG Elements:
// https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/Presentation
export function presAttrsToElementValues(
  el: Element,
): Partial<ExcalidrawElementBase> {
  const exVals = [...el.attributes].reduce((exVals, attr) => {
    const name = attr.name;

    if (name in attrHandlers) {
      attrHandlers[name as PresAttrName]({ el, exVals });
    }

    return exVals;
  }, {} as ExPartialElement);

  return exVals;
}

type FilterAttrs = Partial<
  Pick<ExcalidrawElementBase, "x" | "y" | "width" | "height">
>;

export function filterAttrsToElementValues(el: Element): FilterAttrs {
  const filterVals: FilterAttrs = {};

  if (has(el, "x")) {
    filterVals.x = getNum(el, "x");
  }

  if (has(el, "y")) {
    filterVals.y = getNum(el, "y");
  }

  if (has(el, "width")) {
    filterVals.width = getNum(el, "width");
  }

  if (has(el, "height")) {
    filterVals.height = getNum(el, "height");
  }

  return filterVals;
}

export function pointsAttrToPoints(el: Element): number[][] {
  let points: number[][] = [];

  if (has(el, "points")) {
    points = get(el, "points")
      .split(" ")
      .map((p) => p.split(",").map(parseFloat));
  }

  return points;
}
