import type ExcalidrawView from "../ExcalidrawView";

/**
 * Identifies canvas Alt/Option+Arrow events that must reach Excalidraw before
 * Obsidian's configurable editor commands consume them. The root-scope caller
 * uses a wildcard handler so unrelated input continues to its existing scope.
 */
export function isCanvasFlowchartNavigationShortcut(
  view: ExcalidrawView | null,
  event: KeyboardEvent,
): boolean {
  if (!view || !event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
      event.defaultPrevented || event.isComposing ||
      !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key) ||
      view.isClosingOrMigrating()) return false;

  const api = view.excalidrawAPI;
  const container = view.excalidrawContainer;
  const target = event.target;
  if (!api || !container || target !== view.ownerDocument.activeElement ||
      (target !== container && target !== container.querySelector("canvas.interactive"))) return false;

  const state = api.getAppState();
  if (state.isLoading || state.viewModeEnabled || state.editingTextElement ||
      state.openDialog || state.openPopup || state.newElement || state.resizingElement) return false;

  return api.getSceneElements().filter(element => state.selectedElementIds[element.id]).length === 1;
}
