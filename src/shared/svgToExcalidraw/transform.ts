/** SVG affine coordinates are resolved before native geometry is emitted. */
import type { SVGMatrix } from "src/types/svgConversionTypes";
import type { Point } from "./elements/ExcalidrawElement";
export const identity: SVGMatrix = [1, 0, 0, 1, 0, 0];
const numberPattern = /[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi;

/** Parses a finite SVG number list without silently discarding invalid tokens. */
export function numbers(value: string): number[] {
  if (value.replace(numberPattern, "").replace(/[\s,]/g, ""))
    throw Error("Invalid SVG number list");
  const result = (value.match(numberPattern) ?? []).map(Number);
  if (result.some((n) => !Number.isFinite(n) || Math.abs(n) > 1e9))
    throw Error("SVG coordinate limit exceeded");
  return result;
}
/** Composes an SVG parent matrix with a local transform in double precision. */
export function multiply(a: SVGMatrix, b: SVGMatrix): SVGMatrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
/** Applies a transform and rejects geometry that cannot safely enter a scene. */
export function transformPoint([x, y]: Point, m: SVGMatrix): Point {
  const point: Point = [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  if (point.some((n) => !Number.isFinite(n) || Math.abs(n) > 1e7))
    throw Error("SVG transformed coordinate limit exceeded");
  return point;
}
/** Parses SVG transforms, including rotation about a point. */
export function parseTransform(value: string): SVGMatrix {
  let matrix = identity;
  const chunks = [...value.matchAll(/([a-z]+)\s*\(([^)]*)\)/gi)];
  if (value.replace(/([a-z]+)\s*\(([^)]*)\)/gi, "").replace(/[\s,]/g, ""))
    throw Error("Invalid SVG transform");
  for (const [, name, args] of chunks) {
    const n = numbers(args);
    let local: SVGMatrix;
    switch (name) {
      case "matrix":
        if (n.length !== 6) throw Error("Invalid matrix");
        local = n as unknown as SVGMatrix;
        break;
      case "translate":
        if (n.length < 1 || n.length > 2) throw Error("Invalid translate");
        local = [1, 0, 0, 1, n[0], n[1] ?? 0];
        break;
      case "scale":
        if (n.length < 1 || n.length > 2) throw Error("Invalid scale");
        local = [n[0], 0, 0, n[1] ?? n[0], 0, 0];
        break;
      case "rotate": {
        if (n.length !== 1 && n.length !== 3) throw Error("Invalid rotate");
        const radians = (n[0] * Math.PI) / 180,
          c = Math.cos(radians),
          s = Math.sin(radians);
        local = [c, s, -s, c, 0, 0];
        if (n.length === 3)
          local = multiply(multiply([1, 0, 0, 1, n[1], n[2]], local), [
            1,
            0,
            0,
            1,
            -n[1],
            -n[2],
          ]);
        break;
      }
      case "skewX":
      case "skewY": {
        if (n.length !== 1) throw Error("Invalid skew");
        const t = Math.tan((n[0] * Math.PI) / 180);
        local = name === "skewX" ? [1, 0, t, 1, 0, 0] : [1, t, 0, 1, 0, 0];
        break;
      }
      default:
        throw Error(`Unsupported SVG transform: ${name}`);
    }
    matrix = multiply(matrix, local);
    transformPoint([0, 0], matrix);
    transformPoint([1, 1], matrix);
  }
  return matrix;
}
/** Resolves SVG/CSS absolute lengths and viewport-relative percentages. */
export function length(
  value: string | null,
  fallback = 0,
  reference = 0,
): number {
  if (value === null || value.trim() === "" || value === "auto")
    return fallback;
  const match = value
    .trim()
    .match(
      /^([-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?)\s*(px|pt|pc|mm|cm|in|%)?$/i,
    );
  if (!match) throw Error(`Unsupported SVG length: ${value}`);
  const units: Record<string, number> = {
    px: 1,
    pt: 96 / 72,
    pc: 16,
    mm: 96 / 25.4,
    cm: 96 / 2.54,
    in: 96,
    "%": reference / 100,
  };
  const result = Number(match[1]) * units[(match[2] ?? "px").toLowerCase()];
  if (!Number.isFinite(result) || Math.abs(result) > 1e7)
    throw Error("SVG length limit exceeded");
  return result;
}
/** Computes viewBox alignment; callers diagnose clipping/slice separately. */
export function viewportMatrix(
  box: number[],
  width: number,
  height: number,
  aspect: string,
): SVGMatrix {
  aspect = aspect.replace(/^defer\s+/, "");
  if (box.length !== 4 || box[2] <= 0 || box[3] <= 0 || width < 0 || height < 0)
    throw Error("Invalid SVG viewport");
  let sx = width / box[2],
    sy = height / box[3];
  if (aspect === "none") return [sx, 0, 0, sy, -box[0] * sx, -box[1] * sy];
  const parts = aspect.trim().split(/\s+/),
    align = parts[0] || "xMidYMid";
  if (
    !/^x(Min|Mid|Max)Y(Min|Mid|Max)$/.test(align) ||
    (parts[1] && !["meet", "slice"].includes(parts[1]))
  )
    throw Error("Unsupported preserveAspectRatio");
  sx = sy = parts[1] === "slice" ? Math.max(sx, sy) : Math.min(sx, sy);
  const dx = width - box[2] * sx,
    dy = height - box[3] * sy;
  return [
    sx,
    0,
    0,
    sy,
    -box[0] * sx +
      (align.includes("xMid") ? dx / 2 : align.includes("xMax") ? dx : 0),
    -box[1] * sy +
      (align.includes("YMid") ? dy / 2 : align.includes("YMax") ? dy : 0),
  ];
}
