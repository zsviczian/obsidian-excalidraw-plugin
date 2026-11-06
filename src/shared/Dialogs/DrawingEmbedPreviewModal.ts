import { App, Component, Modal, setIcon, setTooltip } from "obsidian";
import { t } from "src/lang/helpers";
import { setStyle } from "src/utils/styleUtils";
import type { DrawingEmbedPreview } from "src/types/drawingEmbedTypes";

type Point = { x: number; y: number };

/** Read-only fit/zoom/pan viewer, independently owning its image and input lifetime. */
export class DrawingEmbedPreviewModal extends Modal {
  private owner: Component | null = null;
  private image: HTMLElement | null = null;
  private surface: HTMLElement;
  private stage: HTMLElement;
  private status: HTMLElement;
  private active = false;
  private zoom = 1;
  private pan: Point = { x: 0, y: 0 };
  private pointers = new Map<number, Point>();
  private gesture: { center: Point; distance: number; zoom: number; pan: Point } | null = null;

  constructor(
    app: App,
    private readonly preview: DrawingEmbedPreview,
    private readonly opener: HTMLElement,
    private readonly onClosed: () => void,
  ) {
    super(app);
  }

  /** Modal.open() places the viewer in Obsidian's active window on all supported versions. */
  onOpen(): void {
    this.active = true;
    this.owner = new Component();
    this.owner.load();
    this.modalEl.addClass("excalidraw-embed-preview-modal");
    this.setTitle(t("EMBED_PREVIEW_TITLE"));
    const toolbar = this.contentEl.createDiv({ cls: "excalidraw-embed-preview-toolbar", attr: { role: "toolbar", "aria-label": t("EMBED_PREVIEW_TITLE") } });
    const button = (icon: string, label: string, action: () => void) => {
      const element = toolbar.createEl("button", { cls: "clickable-icon", attr: { type: "button", "aria-label": label } });
      setIcon(element, icon); setTooltip(element, label);
      this.owner.registerDomEvent(element, "click", action);
    };
    button("zoom-out", t("EMBED_PREVIEW_ZOOM_OUT"), () => this.scale(this.zoom / 1.25));
    button("maximize", t("EMBED_PREVIEW_FIT"), () => { this.zoom = 1; this.pan = { x: 0, y: 0 }; this.renderTransform(); });
    button("zoom-in", t("EMBED_PREVIEW_ZOOM_IN"), () => this.scale(this.zoom * 1.25));
    button("x", t("EMBED_PREVIEW_CLOSE"), () => this.close());
    this.stage = this.contentEl.createDiv({ cls: "excalidraw-embed-preview-stage", attr: { tabindex: "0", "aria-label": t("EMBED_PREVIEW_PAN") } });
    this.surface = this.stage.createDiv("excalidraw-embed-preview-surface");
    this.status = this.stage.createDiv({ cls: "excalidraw-embed-preview-status", text: t("EMBED_PREVIEW_LOADING"), attr: { role: "status" } });
    this.owner.registerDomEvent(this.stage, "wheel", event => {
      event.preventDefault();
      this.scale(this.zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1));
    }, { passive: false });
    this.owner.registerDomEvent(this.stage, "pointerdown", event => {
      if (event.button !== 0) return;
      event.preventDefault();
      this.stage.focus({ preventScroll: true });
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      this.stage.setPointerCapture(event.pointerId);
      this.beginGesture();
    });
    this.owner.registerDomEvent(this.stage, "pointermove", event => {
      if (!this.pointers.has(event.pointerId) || !this.gesture) return;
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const position = this.pointerPosition(), start = this.gesture;
      this.zoom = Math.min(8, Math.max(0.25, start.zoom * (start.distance ? position.distance / start.distance : 1)));
      this.pan = { x: start.pan.x + position.center.x - start.center.x, y: start.pan.y + position.center.y - start.center.y };
      this.renderTransform();
    });
    const release = (event: PointerEvent) => {
      this.pointers.delete(event.pointerId);
      if (this.stage.hasPointerCapture(event.pointerId)) this.stage.releasePointerCapture(event.pointerId);
      this.beginGesture();
    };
    this.owner.registerDomEvent(this.stage, "pointerup", release);
    this.owner.registerDomEvent(this.stage, "pointercancel", release);
    this.owner.registerDomEvent(this.stage, "lostpointercapture", release);
    this.owner.registerDomEvent(this.stage, "keydown", event => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (["+", "=", "-", "0", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        if (event.key === "+" || event.key === "=") this.scale(this.zoom * 1.25);
        else if (event.key === "-") this.scale(this.zoom / 1.25);
        else if (event.key === "0") { this.zoom = 1; this.pan = { x: 0, y: 0 }; }
        else {
          this.pan.x += event.key === "ArrowLeft" ? 24 : event.key === "ArrowRight" ? -24 : 0;
          this.pan.y += event.key === "ArrowUp" ? 24 : event.key === "ArrowDown" ? -24 : 0;
        }
        this.renderTransform();
      }
    });
    // The viewer is read-only, including hyperlinks in an inline SVG payload.
    this.owner.registerDomEvent(this.surface, "click", event => event.preventDefault());
    this.stage.focus({ preventScroll: true });
    void this.loadPreview();
  }

  private async loadPreview(): Promise<void> {
    let image: HTMLElement;
    try {
      image = await this.preview.create(() => this.active);
      if (!this.active) { if (image) this.preview.discard(image); return; }
      if (!image) { this.status.setText(t("EMBED_PREVIEW_FAILED")); return; }
      this.image = image;
      this.status.remove();
      this.surface.append(image);
    } catch {
      if (this.active) this.status.setText(t("EMBED_PREVIEW_FAILED"));
      if (image) this.preview.discard(image);
    }
  }

  private pointerPosition(): { center: Point; distance: number } {
    const points = [...this.pointers.values()];
    const first = points[0] ?? { x: 0, y: 0 }, second = points[1] ?? first;
    return { center: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }, distance: Math.hypot(first.x - second.x, first.y - second.y) };
  }

  private beginGesture(): void {
    this.gesture = this.pointers.size ? { ...this.pointerPosition(), zoom: this.zoom, pan: { ...this.pan } } : null;
  }

  private scale(value: number): void {
    this.zoom = Math.min(8, Math.max(0.25, value));
    this.renderTransform();
  }

  private renderTransform(): void {
    setStyle(this.surface, { transform: `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom})` });
    this.stage.setAttribute("data-zoom", this.zoom.toString());
  }

  /** Cancel async work and release only the image created for this viewer. */
  onClose(): void {
    this.active = false;
    this.owner?.unload(); this.owner = null;
    for (const id of this.pointers.keys()) if (this.stage?.hasPointerCapture(id)) this.stage.releasePointerCapture(id);
    this.pointers.clear(); this.gesture = null;
    if (this.image) { this.preview.discard(this.image); this.image = null; }
    this.contentEl.empty();
    if (this.opener.isConnected && !this.opener.ownerDocument.defaultView.closed) this.opener.focus({ preventScroll: true });
    this.onClosed();
  }
}
