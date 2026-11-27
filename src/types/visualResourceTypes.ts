import type { LibraryItem } from "@zsviczian/excalidraw/types/excalidraw/types";

/** Lightweight references used by discovery, collections, and insertion. */
export type VisualResourceLocator =
  | { provider: "vault"; path: string; frame?: string }
  | { provider: "lucide"; icon: string }
  | { provider: "stencil"; id: string; path?: string }
  | { provider: "framework"; path: string; id: string };

export type VisualResourceKind = "icon" | "image" | "drawing" | "frame" | "note" | "stencil" | "framework";
export type VisualResourceFilter = Exclude<VisualResourceKind, "frame" | "note"> | "lucide" | "other";

export interface FrameworkInstallState { mtime: number; digest: string }
export interface FrameworkRemote { fname: string; mtime: number }

export interface VisualResource {
  locator: VisualResourceLocator;
  kind: VisualResourceKind;
  title: string;
  source: string;
  keywords: string[];
  groups?: string[];
  other?: boolean;
  frames?: VisualResource[];
  inspectFrames?: boolean;
  previewElements?: LibraryItem["elements"];
}

export interface VisualDiscoveryRule {
  name: string;
  pattern: string;
  folderPattern?: string;
  extensions?: string;
  maxKb?: string;
  property?: string;
  value?: string;
  frameType?: "frame" | "magicframe";
}

export interface VisualResourcePreferences {
  rules?: Record<"icon" | "drawing" | "frame", VisualDiscoveryRule[]>;
  filters?: VisualResourceFilter[];
  groups?: string[];
  list?: boolean;
  iconGroups?: Record<string, string[]>;
  iconWidth?: number;
  thumbnailSize?: number;
  lightBackground?: string;
  darkBackground?: string;
  excludeFolders?: string;
  linkSvgSource?: boolean;
  svgSourceProperty?: string;
}

export interface VisualDiscoveryCandidate {
  path: string;
  folder: string;
  basename: string;
  extension: string;
  size: number;
  image: boolean;
  drawing: boolean;
  properties?: Record<string, unknown>;
  frame?: { name: string; type?: "frame" | "magicframe" };
}
