import { App, Modal } from "obsidian";

export class FloatingModal extends Modal {
  private dragging = false;
  private offsetX = 0;
  private offsetY = 0;
  private pointerDownHandler: (e: PointerEvent) => void;
  private pointerMoveHandler: (e: PointerEvent) => void;
  private pointerUpHandler: () => void;

  constructor(app: App) {
    super(app);

    // Initialize event handlers with proper binding
    this.pointerDownHandler = this.handlePointerDown.bind(this);
    this.pointerMoveHandler = this.handlePointerMove.bind(this);
    this.pointerUpHandler = this.handlePointerUp.bind(this);
  }

  private handlePointerDown(e: PointerEvent): void {
    // Ignore if clicking on interactive elements
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement ||
      e.target instanceof HTMLButtonElement ||
      (e.target as HTMLElement).closest(".clickable-icon")
    ) {
      return;
    }

    this.dragging = true;
    const { modalEl } = this;
    this.offsetX = e.clientX - modalEl.getBoundingClientRect().left;
    this.offsetY = e.clientY - modalEl.getBoundingClientRect().top;

    // Add global event listeners for move and up events
    document.addEventListener("pointermove", this.pointerMoveHandler);
    document.addEventListener("pointerup", this.pointerUpHandler);
    // Capture the pointer to ensure we get events even when outside the target
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this.dragging) return;
    const { modalEl } = this;

    e.preventDefault();

    const x = e.clientX - this.offsetX;
    const y = e.clientY - this.offsetY;

    // Position the modal element
    modalEl.style.left = `${x}px`;
    modalEl.style.top = `${y}px`;
    modalEl.style.transform = "none"; // Remove centering transform
  }

  private handlePointerUp(): void {
    this.dragging = false;
    document.removeEventListener("pointermove", this.pointerMoveHandler);
    document.removeEventListener("pointerup", this.pointerUpHandler);
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

        // Add pointer down listener to start dragging
        modalEl.addEventListener("pointerdown", this.pointerDownHandler);
      }
    });
  }

  close(): void {
    const { modalEl } = this;
    // Clean up event listeners
    if (modalEl) {
      modalEl.removeEventListener("pointerdown", this.pointerDownHandler);
    }
    document.removeEventListener("pointermove", this.pointerMoveHandler);
    document.removeEventListener("pointerup", this.pointerUpHandler);

    super.close();
  }
}