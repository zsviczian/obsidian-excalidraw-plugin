import type { Mutable } from "@zsviczian/excalidraw/types/common/src/utility-types";
import type { ExcalidrawElement } from "@zsviczian/excalidraw/types/element/src/types";
import {
  getCommonBoundingBox,
  nanoid,
  restoreElements,
} from "src/constants/constants";
import type {
  ElementsInAreaOptions,
  SceneArea,
} from "src/types/excalidrawAutomateTypes";

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
 * Returns a normalized copy of a scene area, optionally inflated on every side.
 *
 * @param area - Scene rectangle to normalize.
 * @param margin - Scene-unit margin added around the rectangle.
 */
export function normalizeSceneArea(
  area: SceneArea,
  margin: number = 0,
): SceneArea {
  const left = Math.min(area.x, area.x + area.width) - margin;
  const top = Math.min(area.y, area.y + area.height) - margin;
  const right = Math.max(area.x, area.x + area.width) + margin;
  const bottom = Math.max(area.y, area.y + area.height) + margin;
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    ...(area.id ? { id: area.id } : {}),
  };
}

function expandBoundElementIds(
  selectedIds: Set<string>,
  elements: readonly ExcalidrawElement[],
): void {
  const elementsById = new Map(elements.map((element) => [element.id, element]));
  const queue = [...selectedIds];
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) continue;
    const element = elementsById.get(id);
    if (!element) continue;
    const relatedIds: string[] = [];
    if (element.type === "text" && element.containerId) {
      relatedIds.push(element.containerId);
    }
    for (const boundElement of element.boundElements ?? []) {
      relatedIds.push(boundElement.id);
    }
    if (element.type === "arrow") {
      if (element.startBinding?.elementId) {
        relatedIds.push(element.startBinding.elementId);
      }
      if (element.endBinding?.elementId) {
        relatedIds.push(element.endBinding.elementId);
      }
    }
    for (const id of relatedIds) {
      if (!selectedIds.has(id) && elementsById.has(id)) {
        selectedIds.add(id);
        queue.push(id);
      }
    }
  }
}

/**
 * Returns elements whose axis-aligned rendered bounds intersect a scene area.
 *
 * @remarks
 * Results preserve the source array's stacking order. Marker frames are
 * excluded by default to preserve the historical ExcalidrawAutomate behavior.
 */
export function getElementsIntersectionArea(
  elements: readonly ExcalidrawElement[],
  area: SceneArea,
  options: ElementsInAreaOptions = {},
): ExcalidrawElement[] {
  const normalizedArea = normalizeSceneArea(area, options.margin);
  const areaRight = normalizedArea.x + normalizedArea.width;
  const areaBottom = normalizedArea.y + normalizedArea.height;
  const selectedIds = new Set<string>();

  for (const element of elements) {
    if (
      !options.includeMarkerFrames &&
      element.type === "frame" &&
      element.frameRole === "marker"
    ) {
      continue;
    }
    if (normalizedArea.id && element.id === normalizedArea.id) {
      selectedIds.add(element.id);
      continue;
    }
    const bounds = getCommonBoundingBox([element]);
    if (
      bounds.minX < areaRight &&
      bounds.maxX > normalizedArea.x &&
      bounds.minY < areaBottom &&
      bounds.maxY > normalizedArea.y
    ) {
      selectedIds.add(element.id);
    }
  }

  if (options.includeBoundElements) {
    expandBoundElementIds(selectedIds, elements);
  }
  return elements.filter((element) => selectedIds.has(element.id));
}

/**
 * Backward-compatible name for {@link getElementsIntersectionArea}.
 */
export function getElementsInArea(
  elements: readonly ExcalidrawElement[],
  area: SceneArea,
  options: ElementsInAreaOptions = {},
): ExcalidrawElement[] {
  return getElementsIntersectionArea(elements, area, options);
}

/**
 * Creates an invisible rectangle that pins an export to an exact scene area.
 *
 * @remarks The returned element is detached data and never enters the EA workbench.
 */
export function createExportAreaAnchor(area: SceneArea): ExcalidrawElement {
  const normalizedArea = normalizeSceneArea(area);
  return {
    id: nanoid(),
    type: "rectangle",
    x: normalizedArea.x,
    y: normalizedArea.y,
    width: normalizedArea.width,
    height: normalizedArea.height,
    angle: 0,
    strokeColor: "#000000",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 0.01,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 0,
    groupIds: [],
    frameId: null,
    index: "a0",
    roundness: null,
    seed: 1,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: [],
    updated: Date.now(),
    link: null,
    locked: false,
    hasTextLink: false,
  } as unknown as ExcalidrawElement;
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
