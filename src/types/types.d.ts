import { ExcalidrawAutomate } from "../ExcalidrawAutomate";
import { ExcalidrawLib } from "../ExcalidrawLib";

export type ConnectionPoint = "top" | "bottom" | "left" | "right" | null;

export type Packages = {
  react: any,
  reactDOM: any,
  excalidrawLib: typeof ExcalidrawLib,
}

export type ValueOf<T> = T[keyof T];

export type DynamicStyle = "none" | "gray" | "colorful";

export type GridSettings = {
  DYNAMIC_COLOR: boolean;  // Whether the grid color is dynamic
  COLOR: string;           // The grid color (in hex format)
  OPACITY: number;         // The grid opacity (hex value between "00" and "FF")
};

export type DeviceType = {
  isDesktop: boolean,
  isPhone: boolean,
  isTablet: boolean,
  isMobile: boolean,
  isLinux: boolean,
  isMacOS: boolean,
  isWindows: boolean,
  isIOS: boolean,
  isAndroid: boolean,
};

declare global {
  interface Window {
      ExcalidrawAutomate: ExcalidrawAutomate;
      pdfjsLib: any;
  }
}

declare module "obsidian" {
  interface App {
    internalPlugins: any;
    isMobile(): boolean;
    getObsidianUrl(file:TFile): string;
    metadataTypeManager: {
      setType(name:string, type:string): void;
    };
  }
  interface Keymap {
    getRootScope(): Scope;
  }
  interface Scope {
    keys: any[];
  }
  interface Workspace {
    on(
      name: "hover-link",
      callback: (e: MouseEvent) => any,
      ctx?: any,
    ): EventRef;
  }
  interface DataAdapter {
    url: {
      pathToFileURL(path: string): URL;
    },
    basePath: string;
  }
  interface FoldPosition {
    from: number;
    to: number;
  }

  interface FoldInfo {
    folds: FoldPosition[];
    lines: number;
  }
  
  interface MarkdownSubView {
    applyFoldInfo(foldInfo: FoldInfo): void;
    getFoldInfo(): FoldInfo | null;
  }
  /*interface Editor {
    insertText(data: string): void;
  }*/
  interface MetadataCache {
    getBacklinksForFile(file: TFile): any;
    getLinks(): { [id: string]: Array<{ link: string; displayText: string; original: string; position: any }> };
  }
}