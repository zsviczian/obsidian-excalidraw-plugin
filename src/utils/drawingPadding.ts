import type { ExcalidrawElement } from "@zsviczian/excalidraw/types/element/src/types";
import { getDrawingPreviewParts } from "./drawingPreviewLink";

export const OUTER_PADDING_MAX = 100;

/** Symmetric area expansion reaches every scene edge, then adds 100 units of space. */
export function getDrawingPaddingMax(elements: readonly ExcalidrawElement[], link: string,
  getCommonBoundingBox: typeof import("@zsviczian/excalidraw").getCommonBoundingBox): number {
  const parts = getDrawingPreviewParts(link);
  if (!parts.hasArearef) return OUTER_PADDING_MAX;
  const visible = elements.filter(element => !element.isDeleted);
  const area = visible.find(element => element.id === parts.blockref);
  if (!area) return OUTER_PADDING_MAX;
  const container = "containerId" in area && visible.find(element => element.id === area.containerId);
  const bounds = getCommonBoundingBox(visible), crop = getCommonBoundingBox(container ? [area, container] : [area]);
  const expansion = Math.max(0, crop.minX - bounds.minX, crop.minY - bounds.minY,
    bounds.maxX - crop.maxX, bounds.maxY - crop.maxY);
  return Number.isFinite(expansion) ? Math.min(Number.MAX_SAFE_INTEGER, Math.ceil(expansion + OUTER_PADDING_MAX)) : OUTER_PADDING_MAX;
}
