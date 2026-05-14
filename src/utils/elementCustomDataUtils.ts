import type { Mutable } from "@zsviczian/excalidraw/types/common/src/utility-types";
import type { ExcalidrawElement } from "@zsviczian/excalidraw/types/element/src/types";

export function addAppendUpdateCustomData(
  el: Mutable<ExcalidrawElement>,
  newData: Partial<Record<string, unknown>>,
): ExcalidrawElement {
  if (!newData) return el;
  if (!el.customData) el.customData = {};
  for (const key in newData) {
    if (typeof newData[key] === "undefined") {
      delete el.customData[key];
      continue;
    }
    el.customData[key] = newData[key];
  }
  return el;
}
