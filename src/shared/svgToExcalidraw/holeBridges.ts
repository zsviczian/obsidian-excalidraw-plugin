/** Single-ring native polygons encode holes through doubled zero-width bridges. */
import type { Point } from "./elements/ExcalidrawElement";

/** Splices holes into their outer contour without adding paint or stroke seams. */
export function bridgeHoles(outer: Point[], holes: Point[][]): Point[] {
  const open = (points: Point[]) => {
    const copy = points.slice(),
      last = copy.at(-1);
    if (copy.length > 1 && last[0] === copy[0][0] && last[1] === copy[0][1])
      copy.pop();
    return copy;
  };
  let ring = open(outer);
  const rightmost = (points: Point[]) =>
    points.reduce(
      (best, p, i) =>
        p[0] > points[best][0] ||
        (p[0] === points[best][0] && p[1] < points[best][1])
          ? i
          : best,
      0,
    );
  for (const hole of holes
    .map(open)
    .slice()
    .sort((a, b) => b[rightmost(b)][0] - a[rightmost(a)][0])) {
    const index = rightmost(hole),
      h = hole[index];
    let bestX = Infinity,
      best = -1;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      if (a[1] > h[1] === b[1] > h[1]) continue;
      const x = a[0] + ((h[1] - a[1]) * (b[0] - a[0])) / (b[1] - a[1]);
      if (x >= h[0] && x < bestX) {
        bestX = x;
        best = i;
      }
    }
    if (best < 0) throw Error("Cannot connect SVG hole");
    const bridge: Point = [bestX, h[1]];
    const rotated = [...hole.slice(index), ...hole.slice(0, index), h];
    ring = [
      ...ring.slice(0, best + 1),
      bridge,
      ...rotated,
      bridge,
      ...ring.slice(best + 1),
    ];
  }
  return [...ring, ring[0]];
}
