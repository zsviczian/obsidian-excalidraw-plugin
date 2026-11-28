import { Component } from "obsidian";
import { t } from "src/lang/helpers";
import { setElementHidden } from "src/utils/htmlUtils";
import { setStyle } from "src/utils/styleUtils";

const MIN_GALLERY_SHARE = 15;
const MAX_GALLERY_SHARE = 85;
const KEYBOARD_STEP = 5;

/** Owns the divider between the two independently scrollable resource panes. */
export class VisualResourceSplit extends Component {
  private drag: { pointerId: number; startY: number; startShare: number } | null = null;
  private readonly handle: HTMLDivElement;

  constructor(
    private readonly panes: HTMLDivElement,
    private readonly gallery: HTMLDivElement,
    private readonly frames: HTMLDivElement,
    private galleryShare: number,
  ) {
    super();
    this.handle = panes.createDiv({
      cls: "excalidraw-resource-divider",
      attr: {
        role: "separator",
        tabindex: "0",
        "aria-label": t("VR_RESIZE_FRAMES"),
        "aria-orientation": "horizontal",
        "aria-controls": this.gallery.id,
        "aria-valuemin": String(MIN_GALLERY_SHARE),
        "aria-valuemax": String(MAX_GALLERY_SHARE),
      },
    });
    frames.before(this.handle);
    this.resize(galleryShare);
    this.showFrames(false);
  }

  /** Keep the divider's gestures in its own document and lifetime. */
  public onload(): void {
    this.registerDomEvent(this.handle, "pointerdown", event => {
      if (this.drag || event.button !== 0) return;
      this.handle.setPointerCapture(event.pointerId);
      this.drag = { pointerId: event.pointerId, startY: event.clientY, startShare: this.galleryShare };
      this.handle.focus();
      event.preventDefault();
    });
    this.registerDomEvent(this.handle, "pointermove", event => {
      if (event.pointerId !== this.drag?.pointerId) return;
      const available = this.gallery.offsetHeight + this.frames.offsetHeight;
      if (available) this.resize(this.drag.startShare + 100 * (event.clientY - this.drag.startY) / available);
    });
    const endDrag = (event: PointerEvent) => {
      if (event.pointerId === this.drag?.pointerId) this.cancelDrag();
    };
    this.registerDomEvent(this.handle, "pointerup", endDrag);
    this.registerDomEvent(this.handle, "pointercancel", endDrag);
    this.registerDomEvent(this.handle, "lostpointercapture", endDrag);
    this.registerDomEvent(this.handle, "keydown", event => {
      const sizes: Record<string, number> = {
        ArrowUp: this.galleryShare - KEYBOARD_STEP,
        ArrowDown: this.galleryShare + KEYBOARD_STEP,
        Home: MIN_GALLERY_SHARE,
        End: MAX_GALLERY_SHARE,
      };
      if (!Object.hasOwn(sizes, event.key)) return;
      event.preventDefault();
      this.resize(sizes[event.key]);
    });
    this.register(() => this.cancelDrag());
  }

  /** Collapse the frame pane while retaining this tab's chosen split. */
  public showFrames(show: boolean): void {
    if (!show) this.cancelDrag();
    setElementHidden(this.handle, !show);
    setElementHidden(this.frames, !show);
  }

  /** Release an active pointer when the tab closes or moves between windows. */
  public cancelDrag(): void {
    const pointerId = this.drag?.pointerId;
    this.drag = null;
    if (pointerId !== undefined && this.handle.hasPointerCapture(pointerId)) {
      this.handle.releasePointerCapture(pointerId);
    }
  }

  private resize(galleryShare: number): void {
    this.galleryShare = Math.max(MIN_GALLERY_SHARE, Math.min(MAX_GALLERY_SHARE, galleryShare));
    this.handle.setAttribute("aria-valuenow", String(Math.round(this.galleryShare)));
    setStyle(this.panes, {
      "--excalidraw-resource-gallery-share": String(this.galleryShare),
      "--excalidraw-resource-frames-share": String(100 - this.galleryShare),
    });
  }
}
