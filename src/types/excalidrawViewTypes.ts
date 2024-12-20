// src/types/ExcalidrawViewTypes.ts

import { WorkspaceLeaf } from "obsidian";
import { FileId } from "@zsviczian/excalidraw/types/excalidraw/element/types";
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
  editNode?: Function;
}

export interface ViewSemaphores {
  warnAboutLinearElementLinkClick: boolean;
  //flag to prevent overwriting the changes the user makes in an embeddable view editing the back side of the drawing
  embeddableIsEditingSelf: boolean;
  popoutUnload: boolean; //the unloaded Excalidraw view was the last leaf in the popout window
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
  dirty: string; //null if there are no changes to be saved, the path of the file if the drawing has unsaved changes

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
  wheelTimeout:number; //used to avoid hover preview while zooming
}