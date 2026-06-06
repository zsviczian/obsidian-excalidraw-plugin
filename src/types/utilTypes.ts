import { TFile } from "obsidian";

export type FILENAMEPARTS = {
  filepath: string;
  hasBlockref: boolean;
  hasGroupref: boolean;
  hasTaskbone: boolean;
  hasArearef: boolean;
  hasFrameref: boolean;
  hasClippedFrameref: boolean;
  hasSectionref: boolean;
  blockref: string;
  sectionref: string;
  linkpartReference: string;
  linkpartAlias: string;
};

export enum PreviewImageType {
  PNG = "PNG",
  SVGIMG = "SVGIMG",
  SVG = "SVG",
}

export interface FrameRenderingOptions {
  enabled: boolean;
  name: boolean;
  outline: boolean;
  clip: boolean;
}

export type PaneTarget =
  | "active-pane"
  | "new-pane"
  | "popout-window"
  | "new-tab"
  | "md-properties";

export interface NestedFileNode {
  file: TFile;
  /**
   * All distinct dependency paths from the root file down to this embedded file.
   * Each path is an ordered array of TFile objects starting with the `rootFile` at index 0.
   *
   * @example
   * If Root -> A -> B2.2 and Root -> B -> B2 -> B2.2
   * The paths for B2.2 will be:
   * [
   *   [Root, A, B2.2],
   *   [Root, B, B2, B2.2]
   * ]
   *
   * Usage: To find which top-level embeds to reload if this file changes,
   * you can map over `paths` and collect `path[1]`.
   */
  paths: TFile[][];
}

export type NestedFileMap = Map<TFile, NestedFileNode>;
