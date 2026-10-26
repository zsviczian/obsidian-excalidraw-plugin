/** Per-call exact-path creation without changing interactive defaults or settings. */
export interface ExactDrawingCreationOptions {
  exactPath: string;
  /** Synchronous session/target validation immediately before each write. */
  validateBeforeCreate?: () => void;
}
