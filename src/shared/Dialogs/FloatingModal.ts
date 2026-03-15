import { App, Modal } from "obsidian";
import { clamp } from "@radix-ui/number";

function getClientPoint(e: PointerEvent | TouchEvent) {
  if (e.type.startsWith("touch")) {
    const t = (e as TouchEvent).touches[0] ?? (e as TouchEvent).changedTouches[0];
    return t ? { x: t.clientX, y: t.clientY } : null;
  }
  const p = e as PointerEvent;
  return { x: p.clientX, y: p.clientY };
}

function pointInRect(pt: { x: number; y: number }, r: DOMRect, padding = 1): boolean {
  return (
    pt.x >= r.left - padding &&
    pt.x <= r.right + padding &&
    pt.y >= r.top - padding &&
    pt.y <= r.bottom + padding
  );
}

function isPointOnText(e: PointerEvent | TouchEvent, doc: Document): boolean {
  const pt = getClientPoint(e);
  if (!pt) return false;

  let offsetNode: Node | null = null;
  let offset: number | null = null;

  // Chromium/Firefox-ish
  const caretPos = doc.caretPositionFromPoint?.(pt.x, pt.y);
  if (caretPos?.offsetNode) {
    offsetNode = caretPos.offsetNode;
    offset = typeof caretPos.offset === "number" ? caretPos.offset : null;
  } else {
    // Safari/WebKit
    const caretRange = doc.caretRangeFromPoint?.(pt.x, pt.y);
    if (caretRange?.startContainer) {
      offsetNode = caretRange.startContainer;
      offset = typeof caretRange.startOffset === "number" ? caretRange.startOffset : null;
    }
  }

  if (!offsetNode || offsetNode.nodeType !== Node.TEXT_NODE || offset == null) return false;
  if (!offsetNode.textContent?.trim()) return false;

  const textNode = offsetNode as Text;
  const len = textNode.data.length;
  const at = Math.max(0, Math.min(offset, len));

  const range = doc.createRange();
  if (at < len) {
    range.setStart(textNode, at);
    range.setEnd(textNode, at + 1);
  } else if (at > 0) {
    range.setStart(textNode, at - 1);
    range.setEnd(textNode, at);
  } else {
    return false;
  }

  const rects = Array.from(range.getClientRects());
  if (rects.length === 0) return false;

  return rects.some((r) => pointInRect(pt, r, 1));
}

export class FloatingModal extends Modal {
  private dragging = false;
  private offsetX = 0;
  private offsetY = 0;
  private readonly pointerDownHandler: (e: PointerEvent | TouchEvent) => void;
  private readonly pointerMoveHandler: (e: PointerEvent | TouchEvent) => void;
  private readonly pointerUpHandler: () => void;

  private disableKeyCapture = true; // new flag: when true, let keystrokes pass through to workspace
  private previousActive?: HTMLElement = null; // stores element focused before opening
  private readonly modalKeydownStopHandler: (e: KeyboardEvent) => void; // store handler so we can remove it
  private ownerWindow: Window = window;
  private ownerDocument: Document = document;

  constructor(app: App) {
    super(app);
    // Initialize event handlers with proper binding
    this.pointerDownHandler = this.handlePointerDown.bind(this);
    this.pointerMoveHandler = this.handlePointerMove.bind(this);
    this.pointerUpHandler = this.handlePointerUp.bind(this);
    this.modalKeydownStopHandler = (ev: KeyboardEvent) => ev.stopPropagation();

    this.setDimBackground(false);
  }

  protected shouldNotStartDrag(target: HTMLElement, event: PointerEvent | TouchEvent): boolean {
    return Boolean(
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLButtonElement ||
      isPointOnText(event, this.ownerDocument) ||
      target.closest(".clickable-icon") ||
      // ensure close button never starts drag
      target.closest(".modal-close-button")
    )
  }

  private handlePointerDown(e: PointerEvent | TouchEvent): void {
    // Get the target element
    const target = e.target as HTMLElement;

    // Ignore if clicking on interactive elements
    if (this.shouldNotStartDrag(target, e)) {
      return;
    }

    // For touch events, prevent default behavior to avoid Obsidian's handling
    if (e.type === "touchstart") {
      e.preventDefault();
      e.stopPropagation();

      if ((e as TouchEvent).touches.length !== 1) return;

      const touch = (e as TouchEvent).touches[0];
      this.dragging = true;
      const { modalEl } = this;
      this.offsetX = touch.clientX - modalEl.getBoundingClientRect().left;
      this.offsetY = touch.clientY - modalEl.getBoundingClientRect().top;
      modalEl.style.height = "fit-content";

      // Add touch-specific event listeners
      this.ownerDocument.addEventListener("touchmove", this.pointerMoveHandler as (e: TouchEvent) => void, {
        passive: false,
      });
      this.ownerDocument.addEventListener("touchend", this.pointerUpHandler);
      this.ownerDocument.addEventListener("touchcancel", this.pointerUpHandler);
    } else {
      // Handle pointer events
      this.dragging = true;
      const { modalEl } = this;
      const pointerEvent = e as PointerEvent;
      this.offsetX = pointerEvent.clientX - modalEl.getBoundingClientRect().left;
      this.offsetY = pointerEvent.clientY - modalEl.getBoundingClientRect().top;

      // Add pointer-specific event listeners
      this.ownerDocument.addEventListener("pointermove", this.pointerMoveHandler as (e: PointerEvent) => void);
      this.ownerDocument.addEventListener("pointerup", this.pointerUpHandler);
      // Capture the pointer to ensure we get events even when outside the target
      target.setPointerCapture(pointerEvent.pointerId);
    }
  }

  private handlePointerMove(e: PointerEvent | TouchEvent): void {
    if (!this.dragging) return;
    const { modalEl } = this;

    // Prevent default behavior
    e.preventDefault();
    if (e.type === "touchmove") e.stopPropagation();

    const { clientX, clientY } = (e.type === "touchmove") ?
        (e as TouchEvent).touches[0] : e as PointerEvent;

    // Prevent moving the modal offscreen
    const { width, height } = modalEl.getBoundingClientRect();
    const margin = 8;
    const x = clamp(clientX - this.offsetX, [margin, this.ownerWindow.innerWidth - width - margin]);
    const y = clamp(clientY - this.offsetY, [margin, this.ownerWindow.innerHeight - height - margin]);

    // Position the modal element
    modalEl.style.left = `${x}px`;
    modalEl.style.top = `${y}px`;
  }

  private handlePointerUp(): void {
    this.dragging = false;
    // Remove all event listeners
    this.ownerDocument.removeEventListener("pointermove", this.pointerMoveHandler as (e: PointerEvent) => void);
    this.ownerDocument.removeEventListener("pointerup", this.pointerUpHandler);
    this.ownerDocument.removeEventListener("touchmove", this.pointerMoveHandler as (e: TouchEvent) => void);
    this.ownerDocument.removeEventListener("touchend", this.pointerUpHandler);
    this.ownerDocument.removeEventListener("touchcancel", this.pointerUpHandler);
  }

  open(): void {
    super.open();
    this.ownerDocument = this.modalEl.ownerDocument ?? document;
    this.ownerWindow = this.ownerDocument.defaultView ?? window;
    // NEW: capture previously focused element & release Obsidian modal key trapping
    if (this.disableKeyCapture) {
      this.previousActive = this.ownerDocument.activeElement as HTMLElement | null;
      try {
        // Release modal scope so focus and key handling can return to the workspace.
        // @ts-ignore
        this.app.keymap.popScope(this.scope);
      } catch {}
      // prevent automatic selection / focus restoration
      this.shouldRestoreSelection = false;
    }
    setTimeout(() => {
      // @ts-ignore
      const { containerEl, modalEl, bgEl } = this;
      containerEl.addClass("mod-excalidraw-draggable")

      // Set initial position and make modal draggable
      if (modalEl) {
        modalEl.style.pointerEvents = "auto";
        // Position absolute is needed for custom positioning
        modalEl.style.position = "absolute";

        // Center the modal initially
        const rect = modalEl.getBoundingClientRect();
        const centerX = this.ownerWindow.innerWidth / 2 - rect.width / 2;
        const centerY = this.ownerWindow.innerHeight / 2 - rect.height / 2;

        modalEl.style.left = `${centerX}px`;
        modalEl.style.top = `${centerY}px`;
        modalEl.style.transform = "none";

        // Add event listeners for both pointer and touch events
        modalEl.addEventListener("pointerdown", this.pointerDownHandler as (e: PointerEvent) => void);
        modalEl.addEventListener("touchstart", this.pointerDownHandler as (e: TouchEvent) => void, {
          passive: false,
        });

        if (this.disableKeyCapture) {
          // Prevent the modal from stealing focus
          modalEl.setAttr("tabindex", "-1");

          // In order to propagate keypresses, modal container and backdrop
          // need to ignore (and thus propagate) any pointerEvents.
          containerEl.style.pointerEvents = "none";
          if (bgEl) bgEl.style.pointerEvents = "none";

          // Refocus previous element (if still in DOM)
          if (this.previousActive?.isConnected) {
            this.previousActive.focus({ preventScroll: true });
          }
          // Stop key events originating inside the modal from bubbling back
          modalEl.addEventListener("keydown", this.modalKeydownStopHandler, { capture: true });
        }

        // NEW: re-enable pointer events on the close button so it is tappable on mobile
        const closeBtn = containerEl.querySelector(".modal-close-button");
        if (closeBtn) {
          (closeBtn as HTMLElement).style.pointerEvents = "auto";
        }
      }
    });
  }

  close(): void {
    // Optional: restore previous focus if body ended up focused
    if (this.disableKeyCapture && this.previousActive?.isConnected && this.ownerDocument.activeElement === this.ownerDocument.body) {
      try { this.previousActive.focus({ preventScroll: true }); } catch {}
    }
    const { modalEl } = this;
    // Clean up event listeners
    if (modalEl) {
      modalEl.removeEventListener("pointerdown", this.pointerDownHandler as (e: PointerEvent) => void);
      modalEl.removeEventListener("touchstart", this.pointerDownHandler as (e: TouchEvent) => void);
      // Remove the capturing keydown stopper if it was added
      modalEl.removeEventListener("keydown", this.modalKeydownStopHandler, { capture: true });
    }
    // Remove any remaining document event listeners
    this.handlePointerUp();

    super.close();
  }

  // (Optional helper if you want to toggle later)
  enableKeyCapture() { this.disableKeyCapture = false; }
  disableKeyCaptureFn() { this.disableKeyCapture = true; }
}