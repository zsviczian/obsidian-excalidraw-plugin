/** Explicit workbench stroke conversion; source scene objects are never mutated. */
import type { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";
import type { StrokeConversionOptions, StrokeConversionResult } from "src/types/strokeConversionTypes";
import type { PenOptions } from "src/types/penTypes";
import type { Mutable } from "@zsviczian/excalidraw/types/common/src/utility-types";
import type { ExcalidrawFreeDrawElement, ExcalidrawLineElement } from "@zsviczian/excalidraw/types/element/src/types";
import { cloneElement } from "./excalidrawElementUtils";
import { setFreedrawPenOptions } from "./elementCustomDataUtils";
import { simplifyStroke, strokeCenterline, strokeGeometry, strokeLimit } from "./strokeGeometry";

/** Uniform default preserves a line's nominal width and sampled centerline in the fork. */
const uniformPen: PenOptions = {
  highlighter: false, constantPressure: true, hasOutline: false, outlineWidth: 1,
  options: { thinning: 0, smoothing: 0, streamline: 0, easing: "linear", simulatePressure: false,
    start: { cap: true, taper: 0, easing: "linear" }, end: { cap: true, taper: 0, easing: "linear" } },
};

/** Validate custom Perfect Freehand values before they can reach the renderer. */
function validatePen(pen: PenOptions): void {
  for (const key of ["highlighter", "constantPressure", "hasOutline"] as const) if (typeof pen[key] !== "boolean") throw Error(`Invalid pen ${key}`);
  strokeLimit(pen.outlineWidth, 1, 0, 100);
  if (!pen.options) throw Error("Pen options are required");
  const opts = pen.options;
  strokeLimit(opts.thinning, 0, -1, 1); strokeLimit(opts.smoothing, 0, 0, 1); strokeLimit(opts.streamline, 0, 0, 1);
  if (typeof opts.easing !== "string" || (opts.simulatePressure !== undefined && typeof opts.simulatePressure !== "boolean")) throw Error("Invalid pen pressure/easing");
  for (const tip of [opts.start, opts.end]) {
    if (!tip || typeof tip.cap !== "boolean" || typeof tip.easing !== "string") throw Error("Invalid pen tip");
    if (typeof tip.taper !== "boolean") strokeLimit(tip.taper, 0, 0, 100000);
  }
}

/** Convert a copied workbench line/free-draw stroke, preserving ID, groups, frame and other metadata. */
export function convertWorkbenchStroke(ea: ExcalidrawAutomate, id: string, target: "line" | "freedraw", options: StrokeConversionOptions = {}): StrokeConversionResult {
  const source = ea.getElement(id);
  if (!source || source.isDeleted || !["line", "freedraw"].includes(source.type) || source.type === target) throw Error("Choose an existing workbench stroke of the opposite type");
  if (source.type !== "line" && source.type !== "freedraw") throw Error("Only line/free-draw conversion is supported");
  if (source.boundElements?.length || (source.type === "line" && (source.startBinding || source.endBinding || source.startArrowhead || source.endArrowhead))) throw Error("Detach stroke labels, bindings and arrowheads explicitly before conversion");
  const tolerance = strokeLimit(options.tolerance, 0.5, 0.000001, 10), maxPoints = strokeLimit(options.maxPoints, 10000, 2, 100000);
  if (!Number.isInteger(maxPoints)) throw Error("Point budget must be an integer");
  if (target === "line" && options.penOptions !== undefined) throw Error("Custom pen options apply only to free-draw strokes");
  const pen = options.penOptions ?? uniformPen;
  if (target === "freedraw") validatePen(pen);
  const centerline = strokeCenterline(source, ea.plugin.getCLIRuntime(), tolerance, 100000);
  const points = target === "line" ? simplifyStroke(centerline, tolerance) : centerline;
  if (points.length > maxPoints) throw Error("Stroke point budget exceeded; increase it or use a larger tolerance");
  const closed = Math.hypot(points[0][0] - points.at(-1)[0], points[0][1] - points.at(-1)[1]) <= tolerance;
  // Exact closure is required for the fork to retain a line's polygon flag on restoration.
  if (target === "line" && closed) points[points.length - 1] = [...points[0]];
  // cloneElement retains the discriminant; its general return type does not retain this narrowed stroke union.
  const geometry = strokeGeometry(points), base = cloneElement(source) as typeof source, warnings: string[] = [];
  // The fork renders nominal free-draw width at 4.25 times the element strokeWidth.
  const strokeWidth = strokeLimit(options.strokeWidth, source.strokeWidth * (target === "line" ? 4.25 : 1 / 4.25), 0, 10000);
  if (target === "freedraw") {
    const converted: Mutable<ExcalidrawFreeDrawElement> & Record<string, unknown> = { ...base, ...geometry, type: "freedraw", strokeWidth, roughness: 0, roundness: null,
      pressures: points.map(() => 0.5), simulatePressure: pen.options.simulatePressure ?? !pen.constantPressure,
      strokeOptions: { variability: "constant" as const, streamline: 0 },
      backgroundColor: source.type === "line" && !closed ? "transparent" : source.backgroundColor };
    for (const key of ["polygon", "startArrowhead", "endArrowhead", "startBinding", "endBinding", "lastCommittedPoint"]) Reflect.deleteProperty(converted, key);
    setFreedrawPenOptions(converted, pen);
    ea.elementsDict[id] = converted;
    warnings.push("excalidraw.com ignores custom free-draw options; appearance can differ there.");
    if (source.roughness) warnings.push("Converted the ideal centerline, not the original rough ink jitter.");
  } else {
    const converted: Mutable<ExcalidrawLineElement> & Record<string, unknown> = { ...base, ...geometry, type: "line", strokeWidth, roughness: 0,
      polygon: closed && points.length >= 4, roundness: null,
      startArrowhead: null, endArrowhead: null, startBinding: null, endBinding: null, lastCommittedPoint: null };
    for (const key of ["pressures", "simulatePressure", "strokeOptions"]) Reflect.deleteProperty(converted, key);
    setFreedrawPenOptions(converted);
    ea.elementsDict[id] = converted;
    warnings.push("Line conversion removes pressure, taper and custom cap/outline behavior; stroke width is a nominal approximation. Supply strokeWidth to override it.");
  }
  return { id, type: target, pointCount: points.length, warnings };
}
