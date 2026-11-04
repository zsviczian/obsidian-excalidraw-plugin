/**
 * Resolve winding on a bounded planar segment arrangement. Only boundaries
 * between filled/unfilled faces survive, so overlaps do not darken translucent
 * fills and internal contours never become white/background-colored patches.
 */
import type { SVGConversionState } from "src/types/svgConversionTypes";
import type { Point } from "./elements/ExcalidrawElement";
import { bridgeHoles } from "./holeBridges";

const cross = (a: Point, b: Point) => a[0] * b[1] - a[1] * b[0];
const minus = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
type Edge = { a: Point; b: Point; cuts: number[]; ring: number; index: number };
/** Signed area of a ring; a repeated closing point is optional. */
export function ringArea(points: Point[]): number {
  return (
    points.reduce(
      (sum, p, i) => sum + cross(p, points[(i + 1) % points.length]),
      0,
    ) / 2
  );
}
/** Winding number, used for source fill rules and hole ownership. */
export function winding(point: Point, rings: Point[][]): number {
  let result = 0;
  for (const ring of rings)
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      const side = cross(minus(b, a), minus(point, a));
      if (a[1] <= point[1] && b[1] > point[1] && side > 0) result++;
      else if (a[1] > point[1] && b[1] <= point[1] && side < 0) result--;
    }
  return result;
}

/** Returns native even-odd polygons with zero-width bridges through real holes. */
export function filledPolygons(
  rings: Point[][],
  rule: string,
  state: SVGConversionState,
): Point[][] {
  if (!["nonzero", "evenodd"].includes(rule))
    throw Error("Unsupported SVG fill rule");
  const edges: Edge[] = [];
  const counts = rings.map(() => 0);
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [ringIndex, ring] of rings.entries())
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      minX = Math.min(minX, a[0]);
      minY = Math.min(minY, a[1]);
      maxX = Math.max(maxX, a[0]);
      maxY = Math.max(maxY, a[1]);
      if (a[0] !== b[0] || a[1] !== b[1])
        edges.push({
          a,
          b,
          cuts: [0, 1],
          ring: ringIndex,
          index: counts[ringIndex]++,
        });
    }
  if (!edges.length) return [];
  const epsilon = Math.max(1e-12, Math.max(maxX - minX, maxY - minY) * 1e-10);
  const work = () => {
    if (++state.operations > 8000000)
      throw Error("SVG topology work limit exceeded");
  };
  let splitCount = 0;
  const cut = (edge: Edge, t: number) => {
    if (t >= -1e-10 && t <= 1 + 1e-10) {
      if (++splitCount > 100000) throw Error("SVG intersection limit exceeded");
      edge.cuts.push(Math.max(0, Math.min(1, t)));
    }
  };
  // Sweep on the longest axis: dense simple outlines must not require all-pairs work.
  const axis = maxX - minX >= maxY - minY ? 0 : 1;
  const lower = (edge: Edge) => Math.min(edge.a[axis], edge.b[axis]);
  const upper = (edge: Edge) => Math.max(edge.a[axis], edge.b[axis]);
  let active: Edge[] = [],
    intersecting = false;
  for (const e of edges.slice().sort((a, b) => lower(a) - lower(b))) {
    active = active.filter((edge) => upper(edge) + epsilon >= lower(e));
    for (const f of active) {
      work();
      if (
        Math.max(e.a[0], e.b[0]) + epsilon < Math.min(f.a[0], f.b[0]) ||
        Math.max(f.a[0], f.b[0]) + epsilon < Math.min(e.a[0], e.b[0]) ||
        Math.max(e.a[1], e.b[1]) + epsilon < Math.min(f.a[1], f.b[1]) ||
        Math.max(f.a[1], f.b[1]) + epsilon < Math.min(e.a[1], e.b[1])
      )
        continue;
      const r = minus(e.b, e.a),
        s = minus(f.b, f.a),
        q = minus(f.a, e.a),
        denom = cross(r, s);
      if (Math.abs(denom) > 1e-12 * Math.hypot(...r) * Math.hypot(...s)) {
        const t = cross(q, s) / denom,
          u = cross(q, r) / denom;
        if (t >= -1e-10 && t <= 1 + 1e-10 && u >= -1e-10 && u <= 1 + 1e-10) {
          const adjacent =
            e.ring === f.ring &&
            (Math.abs(e.index - f.index) === 1 ||
              Math.abs(e.index - f.index) === counts[e.ring] - 1);
          if (!adjacent) intersecting = true;
          cut(e, t);
          cut(f, u);
        }
      } else if (Math.abs(cross(q, r)) <= epsilon * Math.hypot(...r)) {
        const project = (p: Point, a: Point, d: Point) =>
          (minus(p, a)[0] * d[0] + minus(p, a)[1] * d[1]) /
          (d[0] * d[0] + d[1] * d[1]);
        const t0 = project(f.a, e.a, r),
          t1 = project(f.b, e.a, r);
        if (
          Math.min(1, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1)) >
          1e-10
        )
          intersecting = true;
        cut(e, project(f.a, e.a, r));
        cut(e, project(f.b, e.a, r));
        cut(f, project(e.a, f.a, s));
        cut(f, project(e.b, f.a, s));
      }
    }
    active.push(e);
  }
  const stitch = (loops: Point[][]) => {
    const outers = loops.filter((r) => ringArea(r) > 0),
      holes = loops.filter((r) => ringArea(r) < 0),
      assigned = new Map<Point[], Point[][]>();
    for (const hole of holes) {
      let owner: Point[] | null = null,
        area = Infinity;
      for (const outer of outers) {
        for (let i = 0; i < outer.length; i++) work();
        const size = ringArea(outer);
        if (size < area && winding(hole[0], [outer]) !== 0) {
          owner = outer;
          area = size;
        }
      }
      if (!owner) throw Error("Unowned SVG hole");
      const list = assigned.get(owner) ?? [];
      list.push(hole);
      assigned.set(owner, list);
    }
    return outers.map((outer) => bridgeHoles(outer, assigned.get(outer) ?? []));
  };
  if (!intersecting) {
    const bounds = rings.map((r) =>
      r.reduce(
        (b, p) => [
          Math.min(b[0], p[0]),
          Math.min(b[1], p[1]),
          Math.max(b[2], p[0]),
          Math.max(b[3], p[1]),
        ],
        [Infinity, Infinity, -Infinity, -Infinity],
      ),
    );
    const boundaries: Point[][] = [];
    for (let i = 0; i < rings.length; i++) {
      const ring = rings[i],
        area = ringArea(ring);
      if (!ring.length || Math.abs(area) <= epsilon * epsilon) continue;
      let outside = 0;
      for (let j = 0; j < rings.length; j++) {
        if (i === j) continue;
        work();
        const b = bounds[j],
          p = ring[0];
        if (p[0] < b[0] || p[1] < b[1] || p[0] > b[2] || p[1] > b[3]) continue;
        for (let k = 0; k < rings[j].length; k++) work();
        outside += winding(p, [rings[j]]);
      }
      const before =
        rule === "evenodd" ? Math.abs(outside) % 2 !== 0 : outside !== 0;
      const after =
        rule === "evenodd" ? !before : outside + (area > 0 ? 1 : -1) !== 0;
      if (before === after) continue;
      boundaries.push(
        (after ? area > 0 : area < 0) ? ring : ring.slice().reverse(),
      );
    }
    return stitch(boundaries);
  }
  const key = (p: Point) =>
    `${Math.round((p[0] - minX) / epsilon)},${Math.round((p[1] - minY) / epsilon)}`;
  const nodes = new Map<string, Point>(),
    boundary = new Map<string, { from: string; to: string }>();
  const filled = (p: Point) => {
    for (let i = 0; i < edges.length; i++) work();
    const n = winding(p, rings);
    return rule === "evenodd" ? Math.abs(n) % 2 !== 0 : n !== 0;
  };
  for (const edge of edges) {
    const cuts = [...new Set(edge.cuts)].sort((a, b) => a - b),
      r = minus(edge.b, edge.a);
    for (let i = 1; i < cuts.length; i++) {
      if (cuts[i] - cuts[i - 1] < 1e-12) continue;
      const a: Point = [
          edge.a[0] + r[0] * cuts[i - 1],
          edge.a[1] + r[1] * cuts[i - 1],
        ],
        b: Point = [edge.a[0] + r[0] * cuts[i], edge.a[1] + r[1] * cuts[i]];
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        size = Math.hypot(dx, dy),
        offset = Math.min(size / 100, epsilon * 8);
      const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const left = filled([
          mid[0] - (dy / size) * offset,
          mid[1] + (dx / size) * offset,
        ]),
        right = filled([
          mid[0] + (dy / size) * offset,
          mid[1] - (dx / size) * offset,
        ]);
      if (left === right) continue;
      const from = key(left ? a : b),
        to = key(left ? b : a);
      if (from === to) continue;
      nodes.set(from, left ? a : b);
      nodes.set(to, left ? b : a);
      boundary.set(`${from}:${to}`, { from, to });
    }
  }
  const outgoing = new Map<string, { from: string; to: string }[]>();
  for (const edge of boundary.values()) {
    const list = outgoing.get(edge.from) ?? [];
    list.push(edge);
    outgoing.set(edge.from, list);
  }
  const visited = new Set<string>(),
    loops: Point[][] = [];
  for (const start of boundary.values()) {
    if (visited.has(`${start.from}:${start.to}`)) continue;
    let edge = start;
    const points: Point[] = [];
    for (let steps = 0; ; steps++) {
      work();
      const id = `${edge.from}:${edge.to}`;
      if (visited.has(id)) {
        if (edge !== start) throw Error("Ambiguous SVG fill boundary");
        break;
      }
      if (steps > boundary.size)
        throw Error("SVG fill boundary limit exceeded");
      visited.add(id);
      points.push(nodes.get(edge.from));
      const a = nodes.get(edge.from),
        b = nodes.get(edge.to),
        reverse = Math.atan2(a[1] - b[1], a[0] - b[0]);
      const choices = outgoing.get(edge.to) ?? [];
      const turn = (candidate: { to: string }) => {
        const c = nodes.get(candidate.to);
        return (
          (reverse - Math.atan2(c[1] - b[1], c[0] - b[0]) + Math.PI * 4) %
          (Math.PI * 2)
        );
      };
      edge = choices.reduce(
        (best, next) => (!best || turn(next) < turn(best) ? next : best),
        null,
      );
      if (!edge) throw Error("Open SVG fill boundary");
    }
    if (points.length >= 3 && Math.abs(ringArea(points)) > epsilon * epsilon)
      loops.push(points);
  }
  return stitch(loops);
}
