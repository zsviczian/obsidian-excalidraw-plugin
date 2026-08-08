import type { Mutable } from "@zsviczian/excalidraw/types/common/src/utility-types";
import type { ExcalidrawElement } from "@zsviczian/excalidraw/types/element/src/types";
import { getCommonBoundingBox, restoreElements } from "src/constants/constants";

/**
 * Calculates the axis-aligned bounds shared by a collection of elements.
 *
 * @param elements - Elements whose bounds should be measured.
 * @returns The minimum and maximum coordinates as `[minX, minY, maxX, maxY]`.
 */
export function estimateBounds(
  elements: ExcalidrawElement[],
): [number, number, number, number] {
  const bb = getCommonBoundingBox(elements);
  return [bb.minX, bb.minY, bb.maxX, bb.maxY];
}

/**
 * Moves elements so their top-left corner or center is at a scene position.
 *
 * @param elements - Elements to reposition. Their coordinates are mutated.
 * @param newPosition - Target scene position.
 * @param center - Whether to align the combined center instead of the top-left.
 * @returns Restored elements with dimensions refreshed and bindings repaired.
 */
export function repositionElementsToCursor(
  elements: ExcalidrawElement[],
  newPosition: { x: number; y: number },
  center: boolean = false,
): ExcalidrawElement[] {
  const [x1, y1, x2, y2] = estimateBounds(elements);
  let [offsetX, offsetY] = [0, 0];
  if (center) {
    [offsetX, offsetY] = [
      newPosition.x - (x1 + x2) / 2,
      newPosition.y - (y1 + y2) / 2,
    ];
  } else {
    [offsetX, offsetY] = [newPosition.x - x1, newPosition.y - y1];
  }

  elements.forEach((element: Mutable<ExcalidrawElement>) => {
    element.x = element.x + offsetX;
    element.y = element.y + offsetY;
  });

  return restoreElements(elements, null, {
    refreshDimensions: true,
    repairBindings: true,
  });
}

/**
 * Deep-clones an element while advancing its Excalidraw version metadata.
 *
 * @param element - Element to clone.
 * @returns A mutable clone with the same ID and refreshed version metadata.
 * @remarks This internal helper does not assign a new element ID.
 */
export function cloneElement(
  element: ExcalidrawElement,
): Mutable<ExcalidrawElement> {
  const clone = JSON.parse(
    JSON.stringify(element),
  ) as Mutable<ExcalidrawElement>;
  clone.version = element.version + 1;
  clone.updated = Date.now();
  clone.versionNonce = Math.floor(Math.random() * 1000000000);
  return clone;
}

/**
 * Gets the ID of the first text element bound to a container.
 *
 * @param container - Container element, or `null` when none is available.
 * @returns The bound text element ID, or `null` when no text is bound.
 */
export function getBoundTextElementId(
  container: ExcalidrawElement | null,
): string | null {
  return container?.boundElements?.length
    ? container.boundElements.find((element) => element.type === "text")?.id ||
        null
    : null;
}
