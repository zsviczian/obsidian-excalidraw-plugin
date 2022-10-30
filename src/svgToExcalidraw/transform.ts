import Group from "./elements/Group";
import { vec3, mat4 } from "gl-matrix";

/*
SVG transform attr is a bit strange in that it can accept traditional
css transform string (at least per spec) as well as a it's own "unitless"
version of transform functions.

https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/transform
*/

const transformFunctions = {
  matrix: "matrix",
  matrix3d: "matrix3d",
  perspective: "perspective",
  rotate: "rotate",
  rotate3d: "rotate3d",
  rotateX: "rotateX",
  rotateY: "rotateY",
  rotateZ: "rotateZ",
  scale: "scale",
  scale3d: "scale3d",
  scaleX: "scaleX",
  scaleY: "scaleY",
  scaleZ: "scaleZ",
  skew: "skew",
  skewX: "skewX",
  skewY: "skewY",
  translate: "translate",
  translate3d: "translate3d",
  translateX: "translateX",
  translateY: "translateY",
  translateZ: "translateZ",
} as const;

const transformFunctionsArr = Object.keys(transformFunctions);

// type Transform

type TransformFuncValue = {
  value: string;
  unit: string;
};

type TransformFunc = {
  type: keyof typeof transformFunctions;
  values: TransformFuncValue[];
};

const defaultUnits = {
  matrix: "",
  matrix3d: "",
  perspective: "perspective",
  rotate: "deg",
  rotate3d: "deg",
  rotateX: "deg",
  rotateY: "deg",
  rotateZ: "deg",
  scale: "",
  scale3d: "",
  scaleX: "",
  scaleY: "",
  scaleZ: "",
  skew: "skew",
  skewX: "deg",
  skewY: "deg",
  translate: "px",
  translate3d: "px",
  translateX: "px",
  translateY: "px",
  translateZ: "px",
};

// Convert between possible svg transform attribute values to css transform attribute values.
const svgTransformToCSSTransform = (svgTransformStr: string): string => {
  // Create transform function string "chunks", e.g "rotate(90deg)"
  const tFuncs = svgTransformStr.match(/(\w+)\(([^)]*)\)/g);
  if (!tFuncs) {
    return "";
  }

  const tFuncValues: TransformFunc[] = tFuncs.map((tFuncStr): TransformFunc => {
    const type = tFuncStr.split("(")[0] as keyof typeof transformFunctions;
    if (!type) {
      throw new Error("Unable to find transform name");
    }
    if (!transformFunctionsArr.includes(type)) {
      throw new Error(`transform function name "${type}" is not valid`);
    }

    // get the arg/props of the transform function, e.g "90deg".
    const tFuncParts = tFuncStr.match(/([-+]?[0-9]*\.?[0-9]+)([a-z])*/g);
    if (!tFuncParts) {
      return { type, values: [] };
    }

    let values = tFuncParts.map((a): TransformFuncValue => {
      // Separate the arg value and unit. e.g ["90", "deg"]
      const [value, unit] = a.matchAll(/([-+]?[0-9]*\.?[0-9]+)|([a-z])*/g);

      return {
        unit: unit[0] || defaultUnits[type],
        value: value[0],
      };
    });

    // Not supporting x, y args of svg rotate transform yet...
    if (values && type === "rotate" && values?.length > 1) {
      values = [values[0]];
    }

    return {
      type,
      values,
    };
  });

  // Generate a string of transform functions that can be set as a CSS Transform.
  const csstransformStr = tFuncValues
    .map(({ type, values }) => {
      const valStr = values
        .map(({ unit, value }) => `${value}${unit}`)
        .join(", ");
      return `${type}(${valStr})`;
    })
    .join(" ");

  return csstransformStr;
};

export const createDOMMatrixFromSVGStr = (
  svgTransformStr: string,
): DOMMatrix => {
  const cssTransformStr = svgTransformToCSSTransform(svgTransformStr);

  return new DOMMatrix(cssTransformStr);
};

export function getElementMatrix(el: Element): mat4 {
  if (el.hasAttribute("transform")) {
    const elMat = new DOMMatrix(
      svgTransformToCSSTransform(el.getAttribute("transform") || ""),
    );

    return mat4.multiply(mat4.create(), mat4.create(), elMat.toFloat32Array());
  }

  return mat4.create();
}

export function getTransformMatrix(el: Element, groups: Group[]): mat4 {
  const accumMat = groups
    .map(({ element }) => getElementMatrix(element))
    .concat([getElementMatrix(el)])
    .reduce((acc, mat) => mat4.multiply(acc, acc, mat), mat4.create());

  return accumMat;
}

export function transformPoints(
  points: number[][],
  transform: mat4,
): [number, number][] {
  return points.map(([x, y]) => {
    const [newX, newY] = vec3.transformMat4(
      vec3.create(),
      vec3.fromValues(x, y, 1),
      transform,
    );

    return [newX, newY];
  });
}
