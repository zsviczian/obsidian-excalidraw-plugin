/** Join nearby open line centerlines without tangent restrictions or partial workbench mutations. */
import type { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";
import type { ConcatenateLinesOptions, ConcatenateLinesResult } from "src/types/strokeConversionTypes";
import type { Mutable } from "@zsviczian/excalidraw/types/common/src/utility-types";
import type { ExcalidrawLineElement } from "@zsviczian/excalidraw/types/element/src/types";
import { cloneElement } from "./excalidrawElementUtils";
import { simplifyStroke, strokeCenterline, strokeGeometry, strokeLimit } from "./strokeGeometry";
import type { StrokePoint } from "./strokeGeometry";

/** The first line's ID survives; all other joined copies become tombstones until explicit publication. */
export function concatenateWorkbenchLines(ea: ExcalidrawAutomate, ids: string[], options: ConcatenateLinesOptions = {}): ConcatenateLinesResult {
  if (!Array.isArray(ids) || ids.length < 2 || ids.length > 100 || new Set(ids).size !== ids.length) throw Error("Choose 2–100 distinct line IDs");
  const sources = ids.map(id => ea.getElement(id));
  if (sources.some(el => !el || el.isDeleted || el.type !== "line" || el.polygon || el.boundElements?.length || el.startBinding || el.endBinding || el.startArrowhead || el.endArrowhead)) throw Error("Concatenation requires open workbench lines without labels, bindings or arrowheads");
  const first = sources[0], compare = ["strokeColor", "backgroundColor", "fillStyle", "strokeWidth", "strokeStyle", "roughness", "opacity", "locked", "link", "frameId", "groupIds", "customData"];
  if (sources.some(el => compare.some(key => JSON.stringify(el[key]) !== JSON.stringify(first[key])))) throw Error("Align line styles, groups, frame and metadata explicitly before concatenating");
  const maxGap = strokeLimit(options.maxGap, 1, 0, 1000), tolerance = strokeLimit(options.tolerance, 0.5, 0.000001, 10), maxPoints = strokeLimit(options.maxPoints, 10000, 2, 100000);
  if (!Number.isInteger(maxPoints)) throw Error("Point budget must be an integer");
  const runtime = ea.plugin.getCLIRuntime();
  let count = 0;
  const paths = sources.map(el => {
    if (el.type !== "line") throw Error("Expected line");
    const points = strokeCenterline(el, runtime, tolerance / 2, maxPoints);
    count += points.length; if (count > 100000) throw Error("Concatenation input point budget exceeded");
    return points;
  });
  let chain = paths[0];
  const pending = paths.slice(1);
  while (pending.length) {
    let best: { index: number; atStart: boolean; reverse: boolean; distance: number } | null = null;
    pending.forEach((path, index) => {
      for (const atStart of [false, true]) for (const reverse of [false, true]) {
        const a = atStart ? chain[0] : chain.at(-1);
        const b = atStart ? (reverse ? path[0] : path.at(-1)) : (reverse ? path.at(-1) : path[0]);
        const distance = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (distance <= maxGap && (!best || distance < best.distance)) best = { index, atStart, reverse, distance };
      }
    });
    if (!best) throw Error("Selected lines do not form one continuous endpoint chain; leave branches separate");
    const next: StrokePoint[] = pending.splice(best.index, 1)[0];
    if (best.reverse) next.reverse();
    chain = best.atStart ? [...next, ...chain.slice(best.distance < 1e-9 ? 1 : 0)] : [...chain, ...next.slice(best.distance < 1e-9 ? 1 : 0)];
  }
  chain = simplifyStroke(chain, tolerance / 2);
  if (chain.length > maxPoints) throw Error("Stroke point budget exceeded");
  const merged: Mutable<ExcalidrawLineElement> & Record<string, unknown> = { ...cloneElement(first), ...strokeGeometry(chain), type: "line", polygon: false, roundness: null,
    startBinding: null, endBinding: null, startArrowhead: null, endArrowhead: null, lastCommittedPoint: null };
  // No mutation occurs until all geometry/style/budget checks have succeeded.
  const removed = sources.slice(1).map(el => ({ ...cloneElement(el), isDeleted: true }));
  ea.elementsDict[first.id] = merged;
  removed.forEach(el => { ea.elementsDict[el.id] = el; });
  return { id: first.id, removedIds: ids.slice(1), pointCount: chain.length,
    warnings: sources.some(el => el.roundness) ? ["Rounded segments were sampled into a polyline; rough ink and endpoint joins can render differently."] : [] };
}
