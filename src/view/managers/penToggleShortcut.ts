import type ExcalidrawView from "../ExcalidrawView";

/** Let an unmodified P leave freedraw without changing the fork's tool shortcuts. */
export function handlePenToggleShortcut(view: ExcalidrawView, event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
      event.key.toLowerCase() !== "p") return false;
  const api = view.excalidrawAPI, target = event.target as HTMLElement | null;
  if (!api || view.isClosingOrMigrating() || target?.ownerDocument !== view.ownerDocument ||
      target !== view.ownerDocument.activeElement || !view.containerEl.contains(target) ||
      !target.closest(".excalidraw") ||
      target.closest("input, textarea, select, button, [contenteditable], [role=dialog], [role=menu], .excalidraw__embeddable-container")) return false;
  const state = api.getAppState();
  if (state.activeTool.type !== "freedraw" || state.viewModeEnabled || state.newElement || state.openDialog) return false;
  event.preventDefault(); event.stopPropagation();
  // Holding the pen button must not oscillate between tools on key repeat.
  if (!event.repeat) api.setActiveTool({ type: "selection" });
  return true;
}
