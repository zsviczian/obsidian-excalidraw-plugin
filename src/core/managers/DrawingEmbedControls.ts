import { Component, MarkdownRenderChild, Notice, setIcon, setTooltip } from "obsidian";
import { getEmbedDimensions, rewriteEmbedDimensions } from "../editor/embedDimensions";
import type { DrawingEmbedActions, EmbedSourceBinding } from "src/types/drawingEmbedTypes";
import { DrawingEmbedPreviewModal } from "src/shared/Dialogs/DrawingEmbedPreviewModal";
import { t } from "src/lang/helpers";
import { removeStyle, setStyle } from "src/utils/styleUtils";
import { labelDrawingEmbedControl } from "./drawingEmbedActions";

interface ResizeGesture {
  owner: Component;
  kind: "pointer" | "keyboard";
  id?: number;
  startX: number;
  startY: number;
  startWidth: number;
  width: number;
  aspect: number;
  max: number;
  min: number;
}

/** Controls belong to the generated preview frame, never CodeMirror's widget root. */
export class DrawingEmbedControls extends MarkdownRenderChild {
  private toolbar: HTMLElement;
  private handle: HTMLButtonElement | null = null;
  private visual: HTMLElement | SVGElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private gesture: ResizeGesture | null = null;
  private active = false;
  private modals = new Set<DrawingEmbedPreviewModal>();

  constructor(
    frame: HTMLElement,
    private readonly actions: DrawingEmbedActions,
    private readonly source?: EmbedSourceBinding,
  ) {
    super(frame);
  }

  /** Attach once; visual replacement only remounts the existing owned controls. */
  onload(): void {
    this.active = true;
    const frame = this.containerEl, doc = frame.ownerDocument, win = doc.defaultView;
    frame.addClass("excalidraw-embed-controls-frame");
    this.toolbar = frame.createDiv({ cls: "excalidraw-embed-toolbar", attr: { role: "toolbar" } });
    labelDrawingEmbedControl(this.toolbar, t("EMBED_ACTIONS"));
    // Native table cells also handle compatibility mouse/touch events. A
    // toolbar press must not activate the cell editor underneath our action.
    this.registerDomEvent(this.toolbar, "mousedown", event => event.stopPropagation());
    this.registerDomEvent(this.toolbar, "touchstart", event => event.stopPropagation());
    const button = (action: string, icon: string, label: string, callback: (event: MouseEvent) => void) => {
      const element = this.toolbar.createEl("button", { cls: "clickable-icon", attr: { type: "button", "aria-label": label, "data-excalidraw-embed-action": action } });
      setIcon(element, icon);
      if (action === "preview") labelDrawingEmbedControl(element, label);
      else setTooltip(element, label);
      this.registerDomEvent(element, "pointerdown", event => event.stopPropagation());
      this.registerDomEvent(element, "click", event => { event.preventDefault(); event.stopPropagation(); callback(event); });
      return element;
    };
    button("preview", "expand", t("EMBED_PREVIEW_TITLE"), event => {
      if (!this.current()) return;
      const opener = event.currentTarget as HTMLElement;
      const modal = new DrawingEmbedPreviewModal(this.actions.app, this.actions, opener, () => this.modals.delete(modal));
      this.modals.add(modal); modal.open();
    });
    const open = button("open", "pencil", this.actions.getOpenTooltip(), event => { if (this.current()) this.actions.openDrawing(event); });
    this.registerDomEvent(open, "pointerenter", () => setTooltip(open, this.actions.getOpenTooltip()));
    this.registerDomEvent(open, "focus", () => setTooltip(open, this.actions.getOpenTooltip()));
    if (this.source) {
      button("edit", "code-2", t("EMBED_EDIT_SOURCE"), () => { if (!this.source.select()) this.changed(); });
      button("reset", "rotate-ccw", t("EMBED_RESET_SIZE"), () => this.reset());
      this.handle = frame.createEl("button", { cls: "excalidraw-embed-resize-handle clickable-icon", attr: { type: "button", "aria-label": t("EMBED_RESIZE"), "data-excalidraw-embed-action": "resize" } });
      labelDrawingEmbedControl(this.handle, t("EMBED_RESIZE"));
      this.registerDomEvent(this.handle, "pointerdown", event => this.pointerStart(event));
      this.registerDomEvent(this.handle, "dblclick", event => { event.preventDefault(); event.stopPropagation(); this.reset(); });
      this.registerDomEvent(this.handle, "keydown", event => this.keyboard(event));
      this.registerDomEvent(this.handle, "keyup", event => {
        if (event.key.startsWith("Arrow") && this.gesture?.kind === "keyboard") { event.preventDefault(); this.finish(true); }
      });
      this.registerDomEvent(this.handle, "blur", () => this.finish(false));
    }
    const observer = new win.MutationObserver(() => this.refresh());
    observer.observe(frame, { childList: true, subtree: true });
    this.register(() => observer.disconnect());
    if (typeof win.ResizeObserver === "function") {
      let frameId: number | null = null;
      this.resizeObserver = new win.ResizeObserver(() => {
        // Placement can change flow. Write outside observer delivery, and
        // coalesce notifications into disposable owning-window UI work.
        if (frameId === null) frameId = win.requestAnimationFrame(() => {
          frameId = null; this.placeToolbar();
        });
      });
      this.register(() => {
        this.resizeObserver?.disconnect(); this.resizeObserver = null;
        if (frameId !== null) win.cancelAnimationFrame(frameId);
      });
    }
    this.registerDomEvent(frame, "load", () => this.placeToolbar(), true);
    this.registerDomEvent(frame, "pointerenter", () => this.placeToolbar());
    this.registerDomEvent(frame, "focusin", () => this.placeToolbar());
    this.registerDomEvent(win, "resize", () => this.placeToolbar());
    const scroller = frame.closest<HTMLElement>(".cm-scroller, .markdown-preview-view");
    if (scroller) this.registerDomEvent(scroller, "scroll", () => this.placeToolbar(), { passive: true });
    this.refresh();
  }

  private current(): boolean {
    return this.active && this.containerEl.isConnected && this.actions.isCurrent() && (!this.source || this.source.isCurrent());
  }

  private changed(): void {
    if (this.active) new Notice(t("EMBED_SOURCE_CHANGED"));
  }

  private refresh(): void {
    const image = this.containerEl.querySelector<HTMLElement>(".excalidraw-embedded-img");
    const visual = image?.querySelector<SVGElement | HTMLImageElement>("img, svg") ?? image;
    if (visual !== this.visual) {
      this.finish(false); this.visual = visual;
      this.resizeObserver?.disconnect();
      if (visual) this.resizeObserver?.observe(visual);
    }
    if (!image) return;
    if (this.toolbar.parentElement !== this.containerEl) this.containerEl.append(this.toolbar);
    if (this.handle && this.handle.parentElement !== this.containerEl) this.containerEl.append(this.handle);
    this.placeToolbar();
  }

  private placeToolbar(): void {
    const frame = this.containerEl;
    if (!this.active || !frame.isConnected) return;
    let visual = this.visual?.getBoundingClientRect() ?? frame.getBoundingClientRect();
    const editor = frame.closest(".cm-scroller, .markdown-preview-view");
    const top = editor?.getBoundingClientRect().top ?? 0;
    // Obsidian's image widget uses contain: paint. Keep the normal toolbar
    // inside its image; small previews need an in-flow row below instead.
    const right = frame.closest(".cm-content, .markdown-preview-view")?.getBoundingClientRect().right ?? frame.ownerDocument.defaultView.innerWidth;
    setStyle(frame, { "--excalidraw-embed-toolbar-width": `${Math.max(44, right - visual.left - 8)}px` });
    const toolbar = this.toolbar.getBoundingClientRect();
    frame.toggleClass("excalidraw-embed-controls-below", visual.width < toolbar.width + 8 || visual.height < toolbar.height + 8);
    // Switching to/from an in-flow row changes the frame's height immediately.
    const bounds = frame.getBoundingClientRect();
    visual = this.visual?.getBoundingClientRect() ?? bounds;
    const handle = this.handle?.getBoundingClientRect();
    setStyle(frame, {
      "--excalidraw-embed-toolbar-row-width": `${toolbar.width}px`,
      "--excalidraw-embed-toolbar-right": `${Math.max(0, bounds.right - visual.right + 4)}px`,
      "--excalidraw-embed-control-top": `${Math.max(visual.top, top) - bounds.top + 4}px`,
      "--excalidraw-embed-control-right": `${Math.max(0, Math.min(bounds.width - (handle?.width ?? 0), bounds.right - visual.right + 2))}px`,
      "--excalidraw-embed-control-bottom": `${Math.max(0, Math.min(bounds.height - (handle?.height ?? 0), bounds.bottom - visual.bottom + 2))}px`,
    });
  }

  private start(kind: ResizeGesture["kind"], x = 0, id?: number, y = 0): boolean {
    if (!this.source || !this.current() || !this.visual) return false;
    this.finish(false);
    const bounds = this.visual.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return false;
    const frame = this.containerEl, content = frame.closest(".cm-content");
    const max = Math.max(bounds.width, (content?.getBoundingClientRect().right ?? frame.ownerDocument.defaultView.innerWidth) - frame.getBoundingClientRect().left - 8);
    const owner = new Component(); owner.load();
    this.gesture = { owner, kind, id, startX: x, startY: y, startWidth: bounds.width, width: bounds.width, aspect: bounds.width / bounds.height, max, min: Math.min(32, max) };
    owner.registerDomEvent(frame.ownerDocument.defaultView, "keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); this.finish(false); }
    }, true);
    owner.registerDomEvent(frame.ownerDocument.defaultView, "blur", () => this.finish(false));
    return true;
  }

  private pointerStart(event: PointerEvent): void {
    if (event.button !== 0 || !this.start("pointer", event.clientX, event.pointerId, event.clientY)) return;
    event.preventDefault(); event.stopPropagation();
    this.handle.focus({ preventScroll: true });
    this.handle.setPointerCapture(event.pointerId);
    const gesture = this.gesture, win = this.containerEl.ownerDocument.defaultView;
    gesture.owner.registerDomEvent(win, "pointermove", move => {
      if (move.pointerId !== gesture.id) return;
      if (!this.current()) { this.finish(false); return; }
      move.preventDefault();
      const dx = move.clientX - gesture.startX, dy = (move.clientY - gesture.startY) * gesture.aspect;
      this.preview(gesture.startWidth + (Math.abs(dx) >= Math.abs(dy) ? dx : dy));
    }, { passive: false });
    gesture.owner.registerDomEvent(win, "pointerup", up => { if (up.pointerId === gesture.id) this.finish(true); });
    gesture.owner.registerDomEvent(win, "pointercancel", cancel => { if (cancel.pointerId === gesture.id) this.finish(false); });
    gesture.owner.registerDomEvent(this.handle, "lostpointercapture", () => this.finish(false));
  }

  private keyboard(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "Home") { event.preventDefault(); event.stopPropagation(); this.reset(); return; }
    if (event.key === "Enter" && this.gesture?.kind === "keyboard") { event.preventDefault(); this.finish(true); return; }
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (!this.gesture && !this.start("keyboard")) return;
    const sign = event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 1;
    this.preview(this.gesture.width + sign * (event.shiftKey ? 32 : 8));
  }

  private preview(width: number): void {
    if (!this.gesture) return;
    this.gesture.width = Math.round(Math.min(this.gesture.max, Math.max(this.gesture.min, width)));
    this.containerEl.addClass("excalidraw-embed-resizing");
    setStyle(this.containerEl, {
      "--excalidraw-embed-resize-width": `${this.gesture.width}px`,
      "--excalidraw-embed-resize-height": `${this.gesture.width / this.gesture.aspect}px`,
    });
    this.placeToolbar();
  }

  private finish(commit: boolean): void {
    const gesture = this.gesture;
    if (!gesture) return;
    this.gesture = null; gesture.owner.unload();
    if (gesture.id !== undefined && this.handle?.hasPointerCapture(gesture.id)) this.handle.releasePointerCapture(gesture.id);
    this.containerEl.removeClass("excalidraw-embed-resizing");
    removeStyle(this.containerEl, ["--excalidraw-embed-resize-width", "--excalidraw-embed-resize-height"]);
    this.placeToolbar();
    if (!commit || !this.current() || Math.abs(gesture.width - gesture.startWidth) < 1) return;
    const dimensions = getEmbedDimensions(this.source.text);
    const text = rewriteEmbedDimensions(this.source.text, { width: gesture.width, ...(dimensions?.height ? { height: Math.max(1, Math.round(gesture.width / gesture.aspect)) } : {}) });
    if (!text || !this.source.replace(text)) this.changed();
  }

  private reset(): void {
    this.finish(false);
    const text = this.source && rewriteEmbedDimensions(this.source.text, null);
    if (!this.current() || !text || !this.source.replace(text)) this.changed();
  }

  /** Closing a view or replacing a frame cancels gestures and releases its dialogs. */
  onunload(): void {
    this.active = false; this.finish(false);
    for (const modal of [...this.modals]) modal.close();
    this.modals.clear(); this.toolbar?.remove(); this.handle?.remove();
    this.containerEl.removeClass("excalidraw-embed-controls-frame", "excalidraw-embed-controls-below");
    removeStyle(this.containerEl, ["--excalidraw-embed-toolbar-width", "--excalidraw-embed-toolbar-row-width", "--excalidraw-embed-toolbar-right", "--excalidraw-embed-resize-width", "--excalidraw-embed-resize-height", "--excalidraw-embed-control-top", "--excalidraw-embed-control-right", "--excalidraw-embed-control-bottom"]);
  }
}
