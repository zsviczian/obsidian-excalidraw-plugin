import type { AppState } from "@zsviczian/excalidraw/types/excalidraw/types";

/** App-state values whose changes are meaningful to drawing persistence. */
export interface TrackedAppStateSnapshot {
  theme: AppState["theme"];
  viewBackgroundColor: AppState["viewBackgroundColor"];
  gridSize: AppState["gridSize"];
  gridStep: AppState["gridStep"];
  gridModeEnabled: AppState["gridModeEnabled"];
  colorPalette: AppState["colorPalette"];
  colorTopPicks: AppState["colorTopPicks"];
  frameRendering: AppState["frameRendering"];
  objectsSnapModeEnabled: AppState["objectsSnapModeEnabled"];
  bindingPreference: AppState["bindingPreference"];
  isMidpointSnappingEnabled: AppState["isMidpointSnappingEnabled"];
  boxSelectionMode: AppState["boxSelectionMode"];
  scrollX: AppState["scrollX"];
  scrollY: AppState["scrollY"];
  zoom: AppState["zoom"]["value"];
}

/** Captures only app state that can independently require drawing persistence. */
export function captureTrackedAppState(
  appState: AppState,
): TrackedAppStateSnapshot {
  return {
    theme: appState.theme,
    viewBackgroundColor: appState.viewBackgroundColor,
    gridSize: appState.gridSize,
    gridStep: appState.gridStep,
    gridModeEnabled: appState.gridModeEnabled,
    colorPalette: appState.colorPalette,
    colorTopPicks: appState.colorTopPicks,
    frameRendering: appState.frameRendering,
    objectsSnapModeEnabled: appState.objectsSnapModeEnabled,
    bindingPreference: appState.bindingPreference,
    isMidpointSnappingEnabled: appState.isMidpointSnappingEnabled,
    boxSelectionMode: appState.boxSelectionMode,
    scrollX: appState.scrollX,
    scrollY: appState.scrollY,
    zoom: appState.zoom.value,
  };
}

function areStructuredValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (
    left === null ||
    right === null ||
    typeof left !== "object" ||
    typeof right !== "object"
  ) {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) =>
        areStructuredValuesEqual(value, right[index]),
      )
    );
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.hasOwn(rightRecord, key) &&
        areStructuredValuesEqual(leftRecord[key], rightRecord[key]),
    )
  );
}

/**
 * Reports whether drawing-owned app state changed. Viewport state participates
 * only when opening the drawing will not replace it with zoom-to-fit.
 */
export function didTrackedAppStateChange(
  previous: TrackedAppStateSnapshot,
  next: TrackedAppStateSnapshot,
  trackViewport: boolean,
): boolean {
  return (
    previous.theme !== next.theme ||
    previous.viewBackgroundColor !== next.viewBackgroundColor ||
    previous.gridSize !== next.gridSize ||
    previous.gridStep !== next.gridStep ||
    previous.gridModeEnabled !== next.gridModeEnabled ||
    !areStructuredValuesEqual(previous.colorPalette, next.colorPalette) ||
    !areStructuredValuesEqual(previous.colorTopPicks, next.colorTopPicks) ||
    !areStructuredValuesEqual(previous.frameRendering, next.frameRendering) ||
    previous.objectsSnapModeEnabled !== next.objectsSnapModeEnabled ||
    previous.bindingPreference !== next.bindingPreference ||
    previous.isMidpointSnappingEnabled !== next.isMidpointSnappingEnabled ||
    previous.boxSelectionMode !== next.boxSelectionMode ||
    (trackViewport &&
      (previous.scrollX !== next.scrollX ||
        previous.scrollY !== next.scrollY ||
        previous.zoom !== next.zoom))
  );
}
