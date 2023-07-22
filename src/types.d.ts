import { ExcalidrawBindableElement, ExcalidrawElement, ExcalidrawImageElement, FileId, FillStyle, NonDeletedExcalidrawElement, RoundnessType, StrokeRoundness, StrokeStyle } from "@zsviczian/excalidraw/types/element/types";
import { AppState, BinaryFileData, ExcalidrawImperativeAPI, Point } from "@zsviczian/excalidraw/types/types";
import { TFile, WorkspaceLeaf } from "obsidian";
import { EmbeddedFilesLoader } from "./EmbeddedFileLoader";
import { ExcalidrawAutomate } from "./ExcalidrawAutomate";
import ExcalidrawView, { ExportSettings } from "./ExcalidrawView";
import ExcalidrawPlugin from "./main";
import { ColorMaster } from "colormaster";
import { TInput } from "colormaster/types";
import { ClipboardData } from "@zsviczian/excalidraw/types/clipboard";
import { PaneTarget } from "./utils/ModifierkeyHelper";


export type ConnectionPoint = "top" | "bottom" | "left" | "right" | null;

export type Packages = {
  react: any,
  reactDOM: any,
  excalidrawLib: any,
}

export type ValueOf<T> = T[keyof T];

export type DynamicStyle = "none" | "gray" | "colorful";

export type DeviceType = {
  isDesktop: boolean,
  isPhone: boolean,
  isTablet: boolean,
  isMobile: boolean,
  isLinux: boolean,
  isMacOS: boolean,
  isWindows: boolean,
  isIOS: boolean,
  isAndroid: boolean
};