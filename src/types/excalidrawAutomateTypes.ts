import {
  AppState,
  DataURL,
} from "@zsviczian/excalidraw/types/excalidraw/types";
import type { ExcalidrawElement } from "@zsviczian/excalidraw/types/element/src/types";
import { TFile } from "obsidian";
import { FileId } from "src/core";
import type { FrameRenderingOptions } from "./utilTypes";
import {
  ColorMap,
  PDFPageViewProps,
  Size,
  MimeType,
} from "./embeddedFileLoaderTypes";

export type SVGColorInfo = Map<
  string,
  {
    mappedTo: string;
    fill: boolean;
    stroke: boolean;
  }
>;

export type ScriptSettingValue = {
  value?: string | number | boolean;
  hidden?: boolean;
  description?: string;
  valueset?: string[];
  height?: number; //height of textarea in Plugin Settings if type is string
};

/**
 * Marker for UI helpers (e.g., suggesters) that, while active, should signal
 * host scripts to ignore or block their own keydown handlers.
 */
export interface KeyBlocker {
  isBlockingKeys(): boolean;
  close(): void;
}

export type ImageInfo = {
  mimeType: MimeType;
  id: FileId;
  dataURL: DataURL;
  created: number;
  isHyperLink?: boolean;
  hyperlink?: string;
  file?: string | TFile;
  hasSVGwithBitmap?: boolean;
  latex?: string;
  size?: Size;
  colorMap?: ColorMap;
  pdfPageViewProps?: PDFPageViewProps;
  renderScale?: number;
};

export interface AddImageOptions {
  topX: number;
  topY: number;
  imageFile: TFile | string;
  scale?: boolean;
  anchor?: boolean;
  colorMap?: ColorMap;
}

/** A rectangular region in Excalidraw scene coordinates. */
export interface SceneArea {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Optional ID of an element representing the area. */
  id?: string;
}

/** Controls how {@link ExcalidrawAutomate.getElementsInArea} selects elements. */
export interface ElementsInAreaOptions {
  /** Expands the area by this many scene units on every side. */
  margin?: number;
  /** Includes marker frames. Existing behavior excludes them by default. */
  includeMarkerFrames?: boolean;
  /** Includes containers, bound elements, and arrow binding targets needed by the result. */
  includeBoundElements?: boolean;
}

/** Restricts a view image export to a rectangular scene region. */
export interface ViewExportArea extends SceneArea {
  /** Expands both the selected content and exported viewport on every side. */
  margin?: number;
  /** Includes marker frames in the export candidate set. */
  includeMarkerFrames?: boolean;
  /**
   * Includes containers, bound elements, and arrow binding targets needed to
   * render intersecting elements. Defaults to `true` for area exports.
   */
  includeBoundElements?: boolean;
}

/** Options shared by view-based SVG and PNG exports. */
export interface ViewImageExportOptions {
  withBackground?: boolean;
  theme?: AppState["theme"];
  frameRendering?: FrameRenderingOptions;
  padding?: number;
  selectedOnly?: boolean;
  embedScene?: boolean;
  /** Complete replacement for the view elements used by the export. */
  elementsOverride?: readonly ExcalidrawElement[];
  /** Filters and anchors the export to an exact scene rectangle. */
  exportArea?: ViewExportArea;
}

/** Options for {@link ExcalidrawAutomate.createViewSVG}. */
export interface ViewSVGExportOptions extends ViewImageExportOptions {
  skipInliningFonts?: boolean;
}

/** Options for {@link ExcalidrawAutomate.createViewPNG}. */
export interface ViewPNGExportOptions extends ViewImageExportOptions {
  /** Raster scale applied to the exported viewport. */
  scale?: number;
}
