import { TFile, View, WorkspaceLeaf } from "obsidian";
import { ExcalidrawAutomate } from "../shared/ExcalidrawAutomate";
import { ExcalidrawLib } from "./excalidrawLib";
import type { PdfJsLibrary } from "./pdfJsTypes";

type PolyBoolLibrary = {
  epsilon(value: number): void;
};

type ObsidianInternalPluginInstance = {
  openGlobalSearch?(query: string): void;
  apiList?(): Promise<{
    files?: Array<{
      path: string;
    }>;
  }>;
};

type ObsidianInternalPlugin = {
  _loaded?: boolean;
  load?(): Promise<void>;
  views?: {
    canvas(leaf: WorkspaceLeaf): {
      canvas: unknown;
    };
  };
  instance?: ObsidianInternalPluginInstance;
};

type ObsidianInternalPluginsManager = {
  plugins: Record<string, ObsidianInternalPlugin | undefined>;
  getPluginById(id: string): ObsidianInternalPlugin | undefined;
};

type ObsidianSettingsManager = {
  open(): void;
  openTabById(tabId: string): void;
};

type ObsidianViewRegistry = {
  getViewTypeForFile?(file: TFile): string | null | undefined;
  getViewTypeByFile?(file: TFile): string | null | undefined;
  getTypeByFile?(file: TFile): string | null | undefined;
  getViewTypeByExtension?(ext: string): string | null | undefined;
  getTypeByExtension?(ext: string): string | null | undefined;
};

type MarkdownBlockNode = {
  type: string;
  id?: string;
  depth?: number;
  level?: number;
  value?: string;
  title?: string;
  data?: {
    hProperties?: {
      dataHeading?: string;
    };
  };
  children?: MarkdownBlockNode[];
  position: {
    start: {
      offset: number;
      line: number;
    };
    end: {
      offset: number;
    };
  };
};

type ObsidianDragManager = {
  draggable?: {
    file?: TFile;
    files?: TFile[];
    title?: string;
    type?: string;
  };
};

type MarkdownBlockCacheEntry = {
  display: string;
  node: MarkdownBlockNode;
};

type MarkdownBlockCacheResult = {
  blocks: MarkdownBlockCacheEntry[];
};

type BacklinksForFileResult = {
  data: Record<string, import("obsidian").LinkCache[]>;
};

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

export type ObsidianDraggable = {
  type?: "file" | "files" | "link" | string;
  file?: TFile;
  files?: TFile[];
  title?: string;
  [key: string]: unknown;
};

export type ConnectionPoint = "top" | "bottom" | "left" | "right" | null;

export type Packages = {
  react: typeof import("react");
  reactDOM: typeof import("react-dom/client");
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

export type LocalGraphView = View & {
  file?: TFile;
  loadFile?: (file: TFile) => void;
};

declare global {
  const LZString: {
    compressToBase64: (value: string) => string;
    decompressFromBase64: (value: string) => string | null;
  };

  interface Window {
    ExcalidrawAutomate: ExcalidrawAutomate;
    pdfjsLib: PdfJsLibrary;
    PolyBool?: PolyBoolLibrary;
    electronWindow?: {
      isAlwaysOnTop(): boolean;
      setAlwaysOnTop(flag: boolean): void;
    };
    eval: typeof window.eval;
    React?: typeof import("react");
    ReactDOM?: typeof import("react-dom/client");
    ExcalidrawLib?: typeof ExcalidrawLib;
  }
  interface File {
    path?: string;
  }
}

declare module "obsidian" {
  interface App {
    appId: string;
    dragManager: ObsidianDragManager;
    viewRegistry?: ObsidianViewRegistry;
    internalPlugins: ObsidianInternalPluginsManager;
    setting: ObsidianSettingsManager;
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
          setBackground?(color: string | null, isInverted: boolean): void;
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
    keys: Array<{
      key?: string;
      modifiers?: Array<"Mod" | "Ctrl" | "Meta" | "Shift" | "Alt">;
    }>;
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
    floatingSplit?: WorkspaceSplit;
    getAdjacentLeafInDirection(
      leaf: WorkspaceLeaf,
      direction: string,
    ): WorkspaceLeaf;
    on(
      name: "hover-link",
      callback: (e: MouseEvent) => boolean | void,
      ctx?: Component,
    ): EventRef;
  }
  interface WorkspaceSplit {
    containerEl: HTMLDivElement;
    children?: WorkspaceContainer[];
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
    getBacklinksForFile(file: TFile): BacklinksForFileResult | null;
    getLinks(): Record<string, import("obsidian").LinkCache[]>;
    getCachedFiles(): string[];
    blockCache: {
      getForFile(
        x: { isCancelled(): boolean },
        f: TAbstractFile,
      ): Promise<MarkdownBlockCacheResult>;
    };
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
