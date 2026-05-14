import { VIEW_TYPE_EXCALIDRAW } from "src/constants/constants";
import ExcalidrawPlugin from "src/core/main";
import type ExcalidrawView from "src/view/ExcalidrawView";

export function getLastActiveExcalidrawView(
  plugin: ExcalidrawPlugin,
): ExcalidrawView | null {
  const leaf = plugin.app.workspace.getLeafById(
    plugin.lastActiveExcalidrawLeafID,
  );
  if (leaf?.view?.getViewType?.() === VIEW_TYPE_EXCALIDRAW) {
    return leaf.view as ExcalidrawView;
  }
  return null;
}
