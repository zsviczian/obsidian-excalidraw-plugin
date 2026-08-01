import type { TFile } from "obsidian";

/** A selectable font value and the optional vault file used for its preview. */
export interface SelectableFontOption {
  value: string;
  label: string;
  fontFile?: TFile;
}
