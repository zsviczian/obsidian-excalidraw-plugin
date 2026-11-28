import { MarkdownView, type TFile, type View } from "obsidian";
import { VIEW_TYPE_EXCALIDRAW } from "src/constants/constants";
import type ExcalidrawView from "src/view/ExcalidrawView";

/** The small native Canvas surface used by Obsidian's file-node insertion. */
type CanvasControls = {
  readonly?: boolean;
  posFromEvt(event: MouseEvent): { x: number; y: number };
  createFileNode(options: { pos: { x: number; y: number }; file: TFile; subpath?: string; save: boolean; focus: boolean }): unknown;
};

export function drawingTarget(view: View | null): ExcalidrawView | null {
  return view?.getViewType() === VIEW_TYPE_EXCALIDRAW ? view as ExcalidrawView : null;
}

export function isDocumentTarget(view: View | null): boolean {
  return view?.getViewType() === "markdown" || view?.getViewType() === "canvas";
}

export function canvasTarget(view: View | null): CanvasControls | null {
  if (view?.getViewType() !== "canvas") return null;
  const canvas = view.canvas as (CanvasControls & NonNullable<View["canvas"]>) | undefined;
  return typeof canvas?.createFileNode === "function" && typeof canvas.posFromEvt === "function" ? canvas : null;
}

export function writableDocument(view: View | null): boolean {
  return !!view?.file && view.leaf.view === view &&
    (view instanceof MarkdownView ? view.getMode() === "source" : canvasTarget(view)?.readonly === false);
}

export function addCanvasResource(view: View, file: TFile, subpath?: string): void {
  const canvas = canvasTarget(view);
  if (!canvas || canvas.readonly !== false || !view.containerEl.isConnected) throw Error("Canvas target is unavailable");
  const viewport = view.containerEl.getBoundingClientRect();
  const win = view.containerEl.ownerDocument.defaultView;
  const pos = canvas.posFromEvt(new win.MouseEvent("mousemove", {
    clientX: viewport.left + viewport.width / 2,
    clientY: viewport.top + viewport.height / 2,
  }));
  if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) throw Error("Canvas position is unavailable");
  canvas.createFileNode({ pos, file, subpath, save: true, focus: false });
}
