/** Bounded centerline sampling uses the same Rough.js curve as the fork's collision geometry. */
import { RoughGenerator } from "roughjs/bin/generator";
import type { ExcalidrawElement, ExcalidrawLinearElement, ExcalidrawLineElement, ExcalidrawFreeDrawElement } from "@zsviczian/excalidraw/types/element/src/types";
import type { Packages } from "src/types/types";
import { segmentDistance } from "src/shared/svgToExcalidraw/pathGeometry";

export type StrokePoint = Parameters<typeof segmentDistance>[0];
export type StrokeElement = ExcalidrawLinearElement | ExcalidrawFreeDrawElement;

/** Reject non-finite limits before allocating or changing any workbench element. */
export function strokeLimit(value: number | undefined, fallback: number, min: number, max: number): number {
  const result = value ?? fallback;
  if (!Number.isFinite(result) || result < min || result > max) throw Error(`Stroke option must be between ${min} and ${max}`);
  return result;
}

/** Adaptive cubic subdivision also handles loops whose endpoints coincide. */
export function sampleStrokeCurve(points: [StrokePoint, StrokePoint, StrokePoint, StrokePoint], tolerance: number, push: (p: StrokePoint) => void): void {
  const middle = (a: StrokePoint, b: StrokePoint): StrokePoint => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const pending = [{ points, depth: 0 }];
  while (pending.length) {
    const { points: [a, b, c, d], depth } = pending.pop();
    if (Math.max(segmentDistance(b, a, d), segmentDistance(c, a, d)) <= tolerance ** 2) push(d);
    else {
      if (depth >= 20) throw Error("Stroke curve subdivision limit exceeded");
      const ab = middle(a, b), bc = middle(b, c), cd = middle(c, d), left = middle(ab, bc), right = middle(bc, cd), center = middle(left, right);
      pending.push({ points: [center, right, cd, d], depth: depth + 1 }, { points: [a, ab, left, center], depth: depth + 1 });
    }
  }
}

/** World-space ideal centerline; rotation pivots come from the installed fork's actual bounds. */
export function strokeCenterline(element: StrokeElement, runtime: NonNullable<Packages["excalidrawLib"]>, tolerance: number, maxPoints: number): StrokePoint[] {
  if (element.type !== "line" && element.type !== "freedraw") throw Error("Only line/free-draw centerlines are supported");
  if (element.points.length < 2 || element.points.length > 100000 || element.points.some(p => p.length !== 2 || !p.every(Number.isFinite))) throw Error("Stroke requires 2–100000 finite points");
  if (![element.x, element.y, element.angle].every(Number.isFinite)) throw Error("Invalid stroke geometry");
  const unrotated = { ...element, angle: 0 } as ExcalidrawElement;
  const [x1, y1, x2, y2] = runtime.getCommonBounds([unrotated]);
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
  if (![cx, cy].every(Number.isFinite)) throw Error("Invalid stroke bounds");
  const points: StrokePoint[] = [];
  const push = (p: StrokePoint) => {
    const x = p[0] + element.x - cx, y = p[1] + element.y - cy;
    const next: StrokePoint = [cx + x * Math.cos(element.angle) - y * Math.sin(element.angle), cy + x * Math.sin(element.angle) + y * Math.cos(element.angle)];
    const last = points.at(-1);
    if (!last || last[0] !== next[0] || last[1] !== next[1]) points.push(next);
    if (points.length > maxPoints) throw Error("Stroke point budget exceeded");
  };
  if (element.type === "line" && element.roundness) {
    // Matches generateLinearCollisionShape: remove rough jitter, retain the exact spline model.
    const ops = new RoughGenerator().curve(element.points.map((p): StrokePoint => [p[0], p[1]]), {
      seed: element.seed, roughness: 0, preserveVertices: true, disableMultiStroke: true, disableMultiStrokeFill: true,
    }).sets[0].ops.slice(0, element.points.length);
    let previous: StrokePoint;
    for (const op of ops) {
      if (op.op === "move") { previous = [op.data[0], op.data[1]]; push(previous); }
      else if (op.op === "bcurveTo" && previous) {
        const end: StrokePoint = [op.data[4], op.data[5]];
        sampleStrokeCurve([previous, [op.data[0], op.data[1]], [op.data[2], op.data[3]], end], tolerance, push); previous = end;
      } else throw Error("Unsupported stroke curve operation");
    }
  } else element.points.forEach(p => push([p[0], p[1]]));
  if (element.type === "line" && "polygon" in element && element.polygon === true && points.length > 1 && Math.hypot(points[0][0] - points.at(-1)[0], points[0][1] - points.at(-1)[1]) > 1e-9) {
    points.push([...points[0]]);
    if (points.length > maxPoints) throw Error("Stroke point budget exceeded");
  }
  return points;
}

/** Ramer–Douglas–Peucker preserves endpoints/corners and bounds centerline error. */
export function simplifyStroke(points: StrokePoint[], tolerance: number): StrokePoint[] {
  if (points.length < 3) return points.map(p => [...p]);
  const keep = new Set([0, points.length - 1]), pending = [[0, points.length - 1]]; let work = 0;
  while (pending.length) {
    const [start, end] = pending.pop(); let furthest = -1, distance = tolerance ** 2;
    for (let i = start + 1; i < end; i++) {
      if (++work > 8000000) throw Error("Stroke simplification work budget exceeded");
      const next = segmentDistance(points[i], points[start], points[end]);
      if (next > distance) { distance = next; furthest = i; }
    }
    if (furthest !== -1) { keep.add(furthest); pending.push([start, furthest], [furthest, end]); }
  }
  return [...keep].sort((a, b) => a - b).map(i => [...points[i]]);
}

/** Normalize around the first world-space point, retaining negative local coordinates. */
export function strokeGeometry(points: StrokePoint[]) {
  if (points.length < 2) throw Error("Stroke has no nonzero centerline");
  const [x, y] = points[0];
  const bounds = points.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [x, y, x, y]);
  return { x, y, angle: 0 as ExcalidrawElement["angle"],
    width: bounds[2] - bounds[0], height: bounds[3] - bounds[1],
    // Coordinates were validated/sampled above; branding is added only at the canonical element boundary.
    points: points.map(p => [p[0] - x, p[1] - y]) as unknown as ExcalidrawLineElement["points"] };
}
