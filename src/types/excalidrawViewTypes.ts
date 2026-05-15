// src/types/ExcalidrawViewTypes.ts

import { ViewStateResult, WorkspaceLeaf } from "obsidian";
import {
  AppState,
  BinaryFiles,
  ExcalidrawInitialDataState,
  ExcalidrawProps,
  LibraryItems,
  SceneData,
} from "@zsviczian/excalidraw/types/excalidraw/types";
import {
  ExcalidrawElement,
  FileId,
} from "@zsviczian/excalidraw/types/element/src/types";
import { CaptureUpdateActionType } from "@zsviczian/excalidraw/types/element/src/store";
import { ObsidianCanvasNode } from "../view/managers/CanvasNodeFactory";

export type Position = { x: number; y: number };

export interface SelectedElementWithLink {
  id: string | null;
  text: string | null;
}

export interface SelectedImage {
  id: string | null;
  fileId: FileId | null;
}

export interface EmbeddableLeafRef {
  leaf: WorkspaceLeaf;
  node?: ObsidianCanvasNode;
  editNode?: () => void;
}

export interface AutoexportConfig {
  png: boolean; // Whether to auto-export to PNG
  svg: boolean; // Whether to auto-export to SVG
  excalidraw: boolean; // Whether to auto-export to Excalidraw format
  theme: "light" | "dark" | "both"; // The theme to use for the export
}

export type ExcalidrawViewScene = Omit<
  SceneData,
  "collaborators" | "captureUpdate"
> & {
  elements: NonNullable<SceneData["elements"]>;
  appState: NonNullable<SceneData["appState"]>;
  files: BinaryFiles;
};

export type ExcalidrawViewInitialData = ExcalidrawInitialDataState & {
  libraryItems?: LibraryItems;
};

export type ExcalidrawViewAppState = Omit<
  Partial<AppState>,
  "showHyperlinkPopup"
> & {
  currentStrokeOptions?: unknown;
  resetCustomPen?: unknown;
  customPens?: unknown[];
  pinnedScripts?: string[];
  showHyperlinkPopup?:
    | AppState["showHyperlinkPopup"]
    | {
        newValue: string;
        oldValue: string;
      };
};

export type ExcalidrawViewUpdateScene = {
  elements?: ExcalidrawElement[];
  appState?: ExcalidrawViewAppState;
  files?: BinaryFiles;
  forceFlushSync?: boolean;
  captureUpdate?: CaptureUpdateActionType;
  storeAction?: "capture" | "none" | "update"; //https://:github.com/excalidraw/excalidraw/pull/7898
};

export type ExcalidrawLinkOpenEvent = Parameters<
  NonNullable<ExcalidrawProps["onLinkOpen"]>
>[1];

export type StencilLibraryData = {
  library?: LibraryItems;
  libraryItems?: LibraryItems;
};

export interface ExcalidrawEphemeralState {
  rename?: string;
  subpath?: string;
  line?: number;
  match?: {
    content?: string;
    matches?: [number, number][];
  };
}

export type MarkdownViewOpenState =
  | ViewStateResult
  | { focus: boolean }
  | ExcalidrawEphemeralState;

export type MarkdownBlockCacheEntry = {
  display: string;
  node: {
    type: string;
    id?: string;
    [key: string]: unknown;
  };
};

export interface ViewSemaphores {
  warnAboutLinearElementLinkClick: boolean;
  //flag to prevent overwriting the changes the user makes in an embeddable view editing the back side of the drawing
  embeddableIsEditingSelf: boolean;
  popoutUnload: boolean; //the unloaded Excalidraw view was the last leaf in the popout window
  viewloaded: boolean; //onLayoutReady in view.onload has completed.
  viewunload: boolean;
  //first time initialization of the view
  scriptsReady: boolean;

  //The role of justLoaded is to capture the Excalidraw.onChange event that fires right after the canvas was loaded for the first time to
  //- prevent the first onChange event to mark the file as dirty and to consequently cause a save right after load, causing sync issues in turn
  //- trigger autozoom (in conjunction with preventAutozoomOnLoad)
  justLoaded: boolean;

  //the modifyEventHandler in main.ts will fire when an Excalidraw file has changed (e.g. due to sync)
  //when a drawing that is currently open in a view receives a sync update, excalidraw reload() is triggered
  //the preventAutozoomOnLoad flag will prevent the open drawing from autozooming when it is reloaded
  preventAutozoom: boolean;

  autosaving: boolean; //flags that autosaving is in progress. Autosave is an async timer, the flag prevents collision with force save
  forceSaving: boolean; //flags that forcesaving is in progress. The flag prevents collision with autosaving
  dirty: string | null; //null if there are no changes to be saved, the path of the file if the drawing has unsaved changes

  //reload() is triggered by modifyEventHandler in main.ts. preventReload is a one time flag to abort reloading
  //to avoid interrupting the flow of drawing by the user.
  preventReload: boolean;

  isEditingText: boolean; //https://stackoverflow.com/questions/27132796/is-there-any-javascript-event-fired-when-the-on-screen-keyboard-on-mobile-safari

  //Save is triggered by multiple threads when an Excalidraw pane is terminated
  //- by the view itself
  //- by the activeLeafChangeEventHandler change event handler
  //- by monkeypatches on detach(next)
  //This semaphore helps avoid collision of saves
  saving: boolean;
  hoverSleep: boolean; //flag with timer to prevent hover preview from being triggered dozens of times
  wheelTimeout: number | null; //used to avoid hover preview while zooming
  shouldSaveImportedImage: boolean; //forceSave after image import via the Excalidraw Image Tool or by way of paste
}
