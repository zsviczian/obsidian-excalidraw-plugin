import type { SVGWarning } from "./svgConversionTypes";

/** Installed Lucide icon construction; coordinates describe the nominal viewport. */
export interface LucideIconOptions {
  icon: string;
  x?: number;
  y?: number;
  /** Longest viewport side in scene units; defaults to 96. */
  size?: number;
  /** Final scene stroke width; omitted means proportional source width. */
  strokeWidth?: number;
  strokeColor?: string;
  roughness?: number;
  /** Native percentage, 0–100. */
  opacity?: number;
}

/** One fresh outer group, including single-element icons; no group element exists. */
export type LucideIconResult = {
  icon: string;
  groupId: string;
  elementIds: string[];
  warnings: SVGWarning[];
  /** Nominal viewport, retaining source padding; use runtime bounds for painted bounds. */
  viewport: { x: number; y: number; width: number; height: number };
};

/** Canonical identifiers come only from the running Obsidian registry. */
export interface LucideIconEntry {
  icon: string;
  name: string;
}
