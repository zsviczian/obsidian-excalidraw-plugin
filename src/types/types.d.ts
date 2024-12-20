import { TFile } from "obsidian";
import { ExcalidrawAutomate } from "../shared/ExcalidrawAutomate";
import { ExcalidrawLib } from "./excalidrawLib";

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

export type Point = [number, number];

export type LinkSuggestion = {
  file: TFile;
  path: string;
  alias?: string;
}

declare global {
  interface Window {
      ExcalidrawAutomate: ExcalidrawAutomate;
      pdfjsLib: any;
      eval: (x: string) => any;
      React?: any;
      ReactDOM?: any;
      ExcalidrawLib?: any;
  }
  interface File {
    path?: string;
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
    plugins: {
      plugins: {
        [key: string]: Plugin | undefined;
      };
    };
  }
  interface FileManager {
    promptForFileRename(file: TFile): Promise<void>;
  }
  interface FileView {
    _loaded: boolean;
    headerEl: HTMLElement;
  }
  interface TextFileView {
    lastSavedData: string;
  }
  interface Menu {
    items: MenuItem[];
  }
  interface Keymap {
    getRootScope(): Scope;
  }
  interface Scope {
    keys: any[];
  }
  interface WorkspaceLeaf {
    id: string;
    containerEl: HTMLDivElement;
    tabHeaderInnerTitleEl: HTMLDivElement;
    tabHeaderInnerIconEl: HTMLDivElement;
  }
  interface WorkspaceWindowInitData {
    x?: number;
    y?: number;
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
    getCachedFiles(): string[];
  }

  interface HoverPopover {
    containerEl: HTMLElement;
    hide(): void;
  }

  interface Plugin {
    _loaded: boolean;
  }
}