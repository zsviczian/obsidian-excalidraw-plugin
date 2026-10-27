/** Diagnose outer image clipping without changing editable geometry or inventing masks. */
import type { ExcalidrawGenericElement } from "./elements/ExcalidrawElement";

/** Checks painted native bounds against the fixed outer SVG image viewport. */
export function exceedsViewport(
  elements: ExcalidrawGenericElement[],
  width: number,
  height: number,
): boolean {
  const epsilon = Math.max(1, width, height) * 1e-6;
  for (const element of elements) {
    const fill = element.backgroundColor !== "transparent",
      stroke = element.strokeColor !== "transparent" && element.strokeWidth > 0;
    if (element.opacity === 0 || (!fill && !stroke)) continue;
    let minX: number, minY: number, maxX: number, maxY: number;
    if (element.type === "line") {
      minX = minY = Infinity;
      maxX = maxY = -Infinity;
      for (const [x, y] of element.points) {
        minX = Math.min(minX, element.x + x);
        minY = Math.min(minY, element.y + y);
        maxX = Math.max(maxX, element.x + x);
        maxY = Math.max(maxY, element.y + y);
      }
    } else {
      const cx = element.x + element.width / 2,
        cy = element.y + element.height / 2,
        c = Math.cos(element.angle),
        s = Math.sin(element.angle),
        rx = element.width / 2,
        ry = element.height / 2;
      const dx =
        element.type === "ellipse"
          ? Math.hypot(rx * c, ry * s)
          : Math.abs(rx * c) + Math.abs(ry * s);
      const dy =
        element.type === "ellipse"
          ? Math.hypot(rx * s, ry * c)
          : Math.abs(rx * s) + Math.abs(ry * c);
      minX = cx - dx;
      maxX = cx + dx;
      minY = cy - dy;
      maxY = cy + dy;
    }
    const margin = stroke ? element.strokeWidth / 2 : 0;
    if (
      minX - margin < -epsilon ||
      minY - margin < -epsilon ||
      maxX + margin > width + epsilon ||
      maxY + margin > height + epsilon
    )
      return true;
  }
  return false;
}
