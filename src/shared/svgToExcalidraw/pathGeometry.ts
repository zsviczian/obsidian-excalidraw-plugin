/** Bounded path normalization and adaptive, transformed-space curve sampling. */
import { parsePath, absolutize, normalize } from "path-data-parser";
import type {
  SVGContour,
  SVGConversionState,
  SVGMatrix,
} from "src/types/svgConversionTypes";
import type { Point } from "./elements/ExcalidrawElement";
import { transformPoint } from "./transform";

const arity: Record<string, number> = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Q: 4,
  T: 2,
  A: 7,
  Z: 0,
};
const tokenPattern = /[a-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi;

/** Guards the upstream parser against malformed/zero-arity input and unbounded expansion. */
export function validatePath(path: string): void {
  if (path.length > 500000) throw Error("SVG path size limit exceeded");
  const tokens = path.match(tokenPattern) ?? [];
  if (
    path.replace(tokenPattern, "").replace(/[\s,]/g, "") ||
    tokens.length > 100000
  )
    throw Error("Invalid or excessive SVG path data");
  let command = "",
    count = 0;
  for (const token of tokens) {
    if (/^[a-z]$/i.test(token)) {
      if (command && (count < arity[command] || count % arity[command] !== 0))
        throw Error("Incomplete SVG path command");
      command = token.toUpperCase();
      count = 0;
      if (!(command in arity)) throw Error("Unknown SVG path command");
      if (command === "Z") command = "";
    } else {
      if (!command) throw Error("SVG number without path command");
      const n = Number(token);
      if (!Number.isFinite(n) || Math.abs(n) > 1e7)
        throw Error("SVG path coordinate limit exceeded");
      if (command === "A" && [3, 4].includes(count % 7) && n !== 0 && n !== 1)
        throw Error("Invalid SVG arc flag");
      count++;
    }
  }
  if (command && (count < arity[command] || count % arity[command] !== 0))
    throw Error("Incomplete SVG path command");
  if (tokens.length && !/^[mM]$/.test(tokens[0]))
    throw Error("SVG path must begin with moveto");
}

/** Squared distance to a finite segment; also handles coincident curve endpoints. */
export function segmentDistance(point: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    divisor = dx * dx + dy * dy;
  const t = divisor
    ? Math.max(
        0,
        Math.min(
          1,
          ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / divisor,
        ),
      )
    : 0;
  return (point[0] - a[0] - t * dx) ** 2 + (point[1] - a[1] - t * dy) ** 2;
}
const midpoint = (a: Point, b: Point): Point => [
  (a[0] + b[0]) / 2,
  (a[1] + b[1]) / 2,
];

/** Converts SVG commands, including arcs, retaining distinct open and closed subpaths. */
export function pathContours(
  path: string,
  matrix: SVGMatrix,
  state: SVGConversionState,
): SVGContour[] {
  validatePath(path);
  if (!path.trim()) return [];
  const absolute = absolutize(parsePath(path));
  // SVG arcs with a zero radius are lines; coincident endpoints draw no arc.
  // Normalize these before passing them to the existing cubic-arc converter.
  let pen: Point = [0, 0],
    start: Point = [0, 0];
  const safe: typeof absolute = [];
  for (const segment of absolute) {
    let current = segment;
    const { key, data } = segment;
    if (key === "A") {
      const end: Point = [data[5], data[6]];
      if (end[0] === pen[0] && end[1] === pen[1]) continue;
      current =
        data[0] === 0 || data[1] === 0
          ? { key: "L", data: end }
          : {
              key,
              data: [Math.abs(data[0]), Math.abs(data[1]), ...data.slice(2)],
            };
    }
    safe.push(current);
    if (key === "Z") pen = start;
    else if (key === "H") pen = [data[0], pen[1]];
    else if (key === "V") pen = [pen[0], data[0]];
    else pen = [data.at(-2), data.at(-1)];
    if (key === "M") start = pen;
  }
  const segments = normalize(safe);
  if (segments.length > 20000) throw Error("SVG segment limit exceeded");
  const contours: SVGContour[] = [];
  let current: SVGContour | null = null;
  const push = (point: Point) => {
    if (++state.points > 100000) throw Error("SVG point limit exceeded");
    const last = current.points.at(-1);
    if (!last || point[0] !== last[0] || point[1] !== last[1])
      current.points.push(point);
  };
  for (const { key, data } of segments) {
    if (data.some((n) => !Number.isFinite(n)))
      throw Error("Invalid normalized SVG path");
    if (key === "M") {
      current = { points: [], closed: false };
      contours.push(current);
      push(transformPoint([data[0], data[1]], matrix));
    } else if (key === "Z") {
      if (current) {
        current.closed = true;
        push([...current.points[0]]);
      }
    } else {
      if (!current || current.closed) {
        const start = current?.points[0];
        if (!start) throw Error("SVG path missing initial point");
        current = { points: [start], closed: false };
        contours.push(current);
      }
      if (key === "L") push(transformPoint([data[0], data[1]], matrix));
      else if (key === "C") {
        const a = current.points.at(-1),
          b = transformPoint([data[0], data[1]], matrix),
          c = transformPoint([data[2], data[3]], matrix),
          d = transformPoint([data[4], data[5]], matrix);
        const extent = Math.max(
          Math.hypot(b[0] - a[0], b[1] - a[1]),
          Math.hypot(c[0] - a[0], c[1] - a[1]),
          Math.hypot(d[0] - a[0], d[1] - a[1]),
        );
        const tolerance = Math.max(1e-6, Math.min(0.1, extent * 0.005));
        const stack: { points: [Point, Point, Point, Point]; depth: number }[] =
          [{ points: [a, b, c, d], depth: 0 }];
        while (stack.length) {
          if (++state.operations > 8000000)
            throw Error("SVG conversion work limit exceeded");
          const {
            points: [p, q, r, s],
            depth,
          } = stack.pop();
          if (
            Math.max(segmentDistance(q, p, s), segmentDistance(r, p, s)) <=
            tolerance * tolerance
          )
            push(s);
          else {
            if (depth >= 20)
              throw Error("SVG curve subdivision limit exceeded");
            const pq = midpoint(p, q),
              qr = midpoint(q, r),
              rs = midpoint(r, s),
              left = midpoint(pq, qr),
              right = midpoint(qr, rs),
              center = midpoint(left, right);
            stack.push(
              { points: [center, right, rs, s], depth: depth + 1 },
              { points: [p, pq, left, center], depth: depth + 1 },
            );
          }
        }
      } else throw Error(`Unsupported normalized SVG command: ${key}`);
    }
  }
  return contours;
}
