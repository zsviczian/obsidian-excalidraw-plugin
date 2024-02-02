import { ExcalidrawAutomate } from "./ExcalidrawAutomate";

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

declare global {
  interface Window {
      ExcalidrawAutomate: ExcalidrawAutomate;
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
  interface Editor {
    insertText(data: string): void;
  }
  interface MetadataCache {
    getBacklinksForFile(file: TFile): any;
    getLinks(): { [id: string]: Array<{ link: string; displayText: string; original: string; position: any }> };
  }
}