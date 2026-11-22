import type { PenOptions } from "./penTypes";

/** Explicit geometric approximation limits in scene units, independent of zoom. */
export interface StrokeConversionOptions {
  tolerance?: number;
  maxPoints?: number;
  strokeWidth?: number;
  penOptions?: PenOptions;
}

/** Workbench-only conversion acknowledgment; publication and saving remain explicit. */
export interface StrokeConversionResult {
  id: string;
  type: "line" | "freedraw";
  pointCount: number;
  warnings: string[];
}

/** Join only neighboring open line endpoints; reject a disconnected selection atomically. */
export interface ConcatenateLinesOptions {
  maxGap?: number;
  tolerance?: number;
  maxPoints?: number;
}

/** The first input ID survives; other joined IDs are staged as deleted. */
export interface ConcatenateLinesResult {
  id: string;
  removedIds: string[];
  pointCount: number;
  warnings: string[];
}
