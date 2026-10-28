/** Per-call exact-path creation without changing interactive defaults or settings. */
export interface ExactDrawingCreationOptions {
  exactPath: string;
  /** Synchronous session/target validation immediately before each write. */
  validateBeforeCreate?: () => void;
}

/** Internal interactive result; cancellation never becomes implicit blank data. */
export type PreparedDrawing = { kind: "ready"; data: string } | { kind: "cancel" };
