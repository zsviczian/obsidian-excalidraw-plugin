import { FuzzySuggestModal } from "obsidian";
import type { ExcalidrawFrameElement } from "@zsviczian/excalidraw/types/element/src/types";
import type ExcalidrawView from "src/view/ExcalidrawView";
import { getSceneFrames } from "src/utils/frameMetadata";
import { t } from "src/lang/helpers";

/** Fuzzy frame navigation keeps the existing viewport/selection semantics and drawing mode. */
export class FrameNavigator extends FuzzySuggestModal<ExcalidrawFrameElement> {
  private readonly file: ExcalidrawView["file"];
  private readonly api: ExcalidrawView["excalidrawAPI"];

  constructor(private readonly view: ExcalidrawView, private readonly onClosed: () => void) {
    super(view.app); this.file = view.file; this.api = view.excalidrawAPI;
    this.setPlaceholder(t("FRAME_NAVIGATE"));
  }

  getItems(): ExcalidrawFrameElement[] { return getSceneFrames(this.view.getViewElements()); }

  getItemText(frame: ExcalidrawFrameElement): string {
    return frame.name?.trim() ? frame.name : `${t(frame.frameRole === "marker" ? "FRAME_UNNAMED_MARKER" : "FRAME_UNNAMED")} (${frame.id})`;
  }

  onChooseItem(frame: ExcalidrawFrameElement): void {
    if (this.view.file !== this.file || this.view.excalidrawAPI !== this.api || this.view.isClosingOrMigrating()) return;
    if (!getSceneFrames(this.view.getViewElements()).some(current => current.id === frame.id)) return;
    void this.view.zoomToElementId(frame.id, false);
  }

  onClose(): void { super.onClose(); this.onClosed(); }
}
