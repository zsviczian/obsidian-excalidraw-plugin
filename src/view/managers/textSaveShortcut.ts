import type ExcalidrawView from "../ExcalidrawView";

/**
 * Submit the owning text editor before forcing a vault save. Capture runs before
 * Excalidraw's textarea handler, which otherwise invokes standalone file export.
 * Blur retains the existing text-submission, history and mobile cleanup path.
 */
export function handleTextSaveShortcut(
  view: ExcalidrawView,
  event: KeyboardEvent,
): void {
  if (
    !(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey ||
    event.key.toLowerCase() !== "s"
  ) {
    return;
  }
  const editable = event.target as HTMLTextAreaElement | null;
  const api = view.excalidrawAPI;
  const file = view.file;
  if (
    !api || !file || view.isClosingOrMigrating() ||
    editable?.tagName !== "TEXTAREA" ||
    !editable.classList.contains("excalidraw-wysiwyg") ||
    editable.ownerDocument !== view.ownerDocument ||
    editable !== view.ownerDocument.activeElement ||
    !view.containerEl.contains(editable)
  ) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  // React must commit submission before the save coordinator captures its scene.
  view.packages.reactDOM.flushSync(() => editable.blur());
  if (
    view.excalidrawAPI === api && view.file === file &&
    !view.isClosingOrMigrating()
  ) {
    void view.forceSave(false, true);
  }
}
