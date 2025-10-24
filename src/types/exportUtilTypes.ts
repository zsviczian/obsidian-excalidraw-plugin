import { FrameRenderingOptions } from "./utilTypes";

export type PDFPageAlignment = 
  | "center" 
  | "top-left" 
  | "top-center" 
  | "top-right" 
  | "bottom-left" 
  | "bottom-center" 
  | "bottom-right"
  | "center-left"
  | "center-right";
export type PDFPageMarginString = "none" | "tiny" | "normal";

export interface PDFExportScale {
  fitToPage: number; // 0 means use zoom, >1 means fit to that many pages exactly
  zoom?: number;
}

export interface PDFMargin {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface PDFPageProperties {
  dimensions?: {width: number; height: number};
  backgroundColor?: string;
  margin: PDFMargin;
  alignment: PDFPageAlignment;
}

export interface PageDimensions {
  width: number;
  height: number;
}

export type PageOrientation = "portrait" | "landscape";

// All dimensions in pixels (pt)
export const STANDARD_PAGE_SIZES = {
  A0: { width: 3179.52, height: 4494.96 }, // 33.11 × 46.81 inches
  A1: { width: 2245.76, height: 3179.52 }, // 23.39 × 33.11 inches
  A2: { width: 1587.76, height: 2245.76 }, // 16.54 × 23.39 inches
  A3: { width: 1122.56, height: 1587.76 }, // 11.69 × 16.54 inches
  A4: { width: 794.56, height: 1122.56 },  // 8.27 × 11.69 inches
  A5: { width: 559.37, height: 794.56 },   // 5.83 × 8.27 inches
  A6: { width: 397.28, height: 559.37 },   // 4.13 × 5.83 inches
  Legal: { width: 816, height: 1344 },     // 8.5 × 14 inches
  Letter: { width: 816, height: 1056 },    // 8.5 × 11 inches
  Tabloid: { width: 1056, height: 1632 },  // 11 × 17 inches
  Ledger: { width: 1632, height: 1056 },   // 17 × 11 inches
  "HD Screen": { width: 1920, height: 1080 },// 16:9 aspect ratio
  "MATCH IMAGE": { width: 0, height: 0 },    // 0 means use the current screen size
} as const;

export type PageSize = keyof typeof STANDARD_PAGE_SIZES;

export interface ExportSettings {
  withBackground: boolean;
  withTheme: boolean;
  isMask: boolean;
  frameRendering?: FrameRenderingOptions; //optional, overrides relevant appState settings for rendering the frame
  skipInliningFonts?: boolean;
}