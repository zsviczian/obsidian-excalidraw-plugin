/**
 * Types for the selected-element action menu provider mechanism
 * (`view.selectedElementActionsMenu`), shared between the view-owned
 * `SelectedElementActionsMenu` component and the public
 * `ExcalidrawAutomate.registerElementActionProvider()` scripting API.
 */
import type { ExcalidrawElement } from "@zsviczian/excalidraw/types/element/src/types";

export type SelectedElementMenuAction = {
  id: string;
  title: string;
  icon: string;
  action: () => void;
};

export type SelectedElementMenuProvider = {
  id: string;
  getActions: (
    element: ExcalidrawElement,
  ) => readonly SelectedElementMenuAction[];
};
