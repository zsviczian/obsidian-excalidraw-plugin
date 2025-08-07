import { App, Modal } from "obsidian";

export class FloatingModal extends Modal {
  private dragging = false;
  private offsetX = 0;
  private offsetY = 0;
  private pointerDownHandler: (e: PointerEvent | TouchEvent) => void;
  private pointerMoveHandler: (e: PointerEvent | TouchEvent) => void;
  private pointerUpHandler: () => void;

  constructor(app: App) {
    super(app);

    // Initialize event handlers with proper binding
    this.pointerDownHandler = this.handlePointerDown.bind(this);
    this.pointerMoveHandler = this.handlePointerMove.bind(this);
    this.pointerUpHandler = this.handlePointerUp.bind(this);
  }

  private handlePointerDown(e: PointerEvent | TouchEvent): void {
    // Get the target element
    const target = e.target as HTMLElement;

    // Ignore if clicking on interactive elements
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLButtonElement ||
      target.closest(".clickable-icon")
    ) {
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

      // Add touch-specific event listeners
      document.addEventListener("touchmove", this.pointerMoveHandler as (e: TouchEvent) => void, {
        passive: false,
      });
      document.addEventListener("touchend", this.pointerUpHandler);
      document.addEventListener("touchcancel", this.pointerUpHandler);
    } else {
      // Handle pointer events
      this.dragging = true;
      const { modalEl } = this;
      const pointerEvent = e as PointerEvent;
      this.offsetX = pointerEvent.clientX - modalEl.getBoundingClientRect().left;
      this.offsetY = pointerEvent.clientY - modalEl.getBoundingClientRect().top;

      // Add pointer-specific event listeners
      document.addEventListener("pointermove", this.pointerMoveHandler as (e: PointerEvent) => void);
      document.addEventListener("pointerup", this.pointerUpHandler);
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

    let clientX, clientY;

    if (e.type === "touchmove") {
      const touch = (e as TouchEvent).touches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      const pointerEvent = e as PointerEvent;
      clientX = pointerEvent.clientX;
      clientY = pointerEvent.clientY;
    }

    const x = clientX - this.offsetX;
    const y = clientY - this.offsetY;

    // Position the modal element
    modalEl.style.left = `${x}px`;
    modalEl.style.top = `${y}px`;
    modalEl.style.transform = "none"; // Remove centering transform
  }

  private handlePointerUp(): void {
    this.dragging = false;
    // Remove all event listeners
    document.removeEventListener("pointermove", this.pointerMoveHandler as (e: PointerEvent) => void);
    document.removeEventListener("pointerup", this.pointerUpHandler);
    document.removeEventListener("touchmove", this.pointerMoveHandler as (e: TouchEvent) => void);
    document.removeEventListener("touchend", this.pointerUpHandler);
    document.removeEventListener("touchcancel", this.pointerUpHandler);
  }

  open(): void {
    super.open();
    setTimeout(() => {
      //@ts-ignore
      const { containerEl, modalEl, bgEl } = this;
      containerEl.style.pointerEvents = "none";
      if (bgEl) bgEl.style.display = "none";

      // Set initial position and make modal draggable
      if (modalEl) {
        modalEl.style.pointerEvents = "auto";
        // Position absolute is needed for custom positioning
        modalEl.style.position = "absolute";

        // Center the modal initially
        const rect = modalEl.getBoundingClientRect();
        const centerX = window.innerWidth / 2 - rect.width / 2;
        const centerY = window.innerHeight / 2 - rect.height / 2;

        modalEl.style.left = `${centerX}px`;
        modalEl.style.top = `${centerY}px`;
        modalEl.style.transform = "none";
        const modalStyle = window.getComputedStyle(modalEl);
        modalEl.style.borderBottomLeftRadius = modalStyle.borderTopLeftRadius;
        modalEl.style.borderBottomRightRadius = modalStyle.borderTopRightRadius;

        // Add event listeners for both pointer and touch events
        modalEl.addEventListener("pointerdown", this.pointerDownHandler as (e: PointerEvent) => void);
        modalEl.addEventListener("touchstart", this.pointerDownHandler as (e: TouchEvent) => void, {
          passive: false,
        });
      }
    });
  }

  close(): void {
    const { modalEl } = this;
    // Clean up event listeners
    if (modalEl) {
      modalEl.removeEventListener("pointerdown", this.pointerDownHandler as (e: PointerEvent) => void);
      modalEl.removeEventListener("touchstart", this.pointerDownHandler as (e: TouchEvent) => void);
    }
    // Remove any remaining document event listeners
    this.handlePointerUp();

    super.close();
  }
}