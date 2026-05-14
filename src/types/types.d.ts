import { TFile } from "obsidian";
import { ExcalidrawAutomate } from "../shared/ExcalidrawAutomate";
import { ExcalidrawLib } from "./excalidrawLib";

export type ObsidianCommand = {
  id: string;
  name: string;
  icon?: string;
  mobileOnly?: boolean;
  repeatable?: boolean;
};

export type ObsidianCommandManager = {
  listCommands(): ObsidianCommand[];
  executeCommandById(commandId: string): boolean;
  commands: Record<string, ObsidianCommand>;
};

export type ConnectionPoint = "top" | "bottom" | "left" | "right" | null;

export type Packages = {
  react: any;
  reactDOM: any;
  excalidrawLib: typeof ExcalidrawLib | null;
};

export type ValueOf<T> = T[keyof T];

export type DynamicStyle = "none" | "gray" | "colorful";

export type GridSettings = {
  DYNAMIC_COLOR: boolean; // Whether the grid color is dynamic
  COLOR: string; // The grid color (in hex format)
  OPACITY: number; // The grid opacity (hex value between "00" and "FF")
  GRID_DIRECTION: { horizontal: boolean; vertical: boolean }; // Whether the grid is horizontal or vertical
};

export type DeviceType = {
  isDesktop: boolean;
  isPhone: boolean;
  isTablet: boolean;
  isMobile: boolean;
  isLinux: boolean;
  isMacOS: boolean;
  isWindows: boolean;
  isIOS: boolean;
  isAndroid: boolean;
};

export type Point = [number, number];

export type LinkSuggestion = {
  file: TFile;
  path: string;
  alias?: string;
};

declare global {
  interface Window {
    ExcalidrawAutomate: ExcalidrawAutomate;
    pdfjsLib: any;
    PolyBool?: any;
    electronWindow?: {
      isAlwaysOnTop(): boolean;
      setAlwaysOnTop(flag: boolean): void;
    };
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
    appId: string;
    internalPlugins: any;
    setting: any;
    commands: ObsidianCommandManager;
    isMobile(): boolean;
    getAccentColor(): string;
    getObsidianUrl(file: TFile): string;
    metadataTypeManager: {
      setType(name: string, type: string): void;
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
  interface Vault {
    getAbstractFileByPathInsensitive(path: string): TAbstractFile | null;
  }
  interface FileView {
    _loaded: boolean;
    headerEl: HTMLElement;
  }
  interface View {
    file?: TFile;
    canvas?: {
      setReadonly(readonly: boolean): void;
    };
    modes?: Record<string, unknown>;
    setMode?(mode: unknown): void;
    viewer?: {
      child?: {
        pdfViewer?: {
          page?: number;
        };
      };
    };
  }
  interface TextFileView {
    lastSavedData: string;
  }
  interface Menu {
    items: MenuItem[];
  }
  interface Setting {
    setVisibility(visible: boolean): Setting;
  }
  interface Modal {
    containerEl: HTMLElement;
    modalEl: HTMLElement;
    bgEl: HTMLElement;
    titleEl: HTMLElement;
    headerEl: HTMLElement;
    /**
     * Whether to *dim* the background behind the modal. If {@link dimmed} is `true`, the
     * opacity-value from [setBackgroundOpacity]{@link Modal#setBackgroundOpacity} or
     * the default of `0.85` is used.
     * @note The hidden backdrop will still catch focus.
     */
    setDimBackground(dimmed: boolean): Modal;
    /** Sets the opacity of the Modal backdrop. */
    setBackgroundOpacity(opacity: number): Modal;
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
    isVisible?(): boolean;
  }
  interface WorkspaceWindowInitData {
    x?: number;
    y?: number;
  }
  interface WorkspaceTabs {
    type?: string;
    children?: unknown[];
  }
  interface WorkspaceMobileDrawer {
    type?: string;
    children?: unknown[];
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
    };
    basePath: string;
    fs: {
      readFile(
        path: string,
        encoding: BufferEncoding,
        callback: (err: NodeJS.ErrnoException | null, data: string) => void,
      ): void;
      readFile(
        path: string,
        callback: (err: NodeJS.ErrnoException | null, data: Buffer) => void,
      ): void;
    };
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
  interface MarkdownPostProcessorContext {
    remainingNestLevel: number;
    containerEl: HTMLElement;
  }
  /*interface Editor {
    insertText(data: string): void;
  }*/
  interface MetadataCache {
    getLinkSuggestions?(): Array<{
      alias?: string;
      path: string;
      file: TFile;
    }>;
    getBacklinksForFile(file: TFile): any;
    getLinks(): {
      [id: string]: Array<{
        link: string;
        displayText: string;
        original: string;
        position: any;
      }>;
    };
    getCachedFiles(): string[];
  }

  interface FuzzySuggestModal<T> {
    chooser: {
      values: Array<{ item: T }>;
      selectedItem: number;
    };
  }

  interface HoverPopover {
    containerEl: HTMLElement;
    embed?: {
      editor?: unknown;
    };
    hide(): void;
  }

  interface Plugin {
    _loaded: boolean;
  }
}
