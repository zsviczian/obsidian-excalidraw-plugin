import { setIcon } from "obsidian";
import type { ExcalidrawElement } from "@zsviczian/excalidraw/types/element/src/types";
import type { AppState } from "@zsviczian/excalidraw/types/excalidraw/types";
import {
  ROOTELEMENTSIZE,
  sceneCoordsToViewportCoords,
} from "src/constants/constants";

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

const getSingleSelectedElementId = (
  selectedElementIds: AppState["selectedElementIds"],
): string | null => {
  let selectedId: string | null = null;
  for (const id in selectedElementIds) {
    if (!selectedElementIds[id]) {
      continue;
    }
    if (selectedId !== null) {
      return null;
    }
    selectedId = id;
  }
  return selectedId;
};

/**
 * Renders plugin-owned actions for a single selected Excalidraw element.
 *
 * Action providers are resolved only when selection changes. On ordinary scene
 * changes, the controller reuses the cached element index and only updates DOM
 * coordinates when the element or viewport position actually changed.
 */
export class SelectedElementActionsMenu {
  private readonly providers: SelectedElementMenuProvider[] = [];
  private menuEl: HTMLDivElement | null = null;
  private actionsEl: HTMLDivElement | null = null;
  private selectedElementId: string | null = null;
  private selectedElementIndex = -1;
  private actionElementType: ExcalidrawElement["type"] | null = null;
  private actionElementFileId: string | null = null;
  private actionElementCustomData: ExcalidrawElement["customData"] | null = null;
  private positionKey = "";

  constructor(private readonly getHost: () => HTMLElement | null | undefined) {}

  /** Registers an internal action provider and returns its cleanup callback. */
  public registerProvider(provider: SelectedElementMenuProvider): () => void {
    this.providers.push(provider);
    this.selectedElementId = null;
    return () => {
      const index = this.providers.indexOf(provider);
      if (index !== -1) {
        this.providers.splice(index, 1);
        this.selectedElementId = null;
      }
    };
  }

  /** Updates selection and position from Excalidraw's existing onChange data. */
  public update(
    elements: readonly ExcalidrawElement[],
    appState: AppState,
  ): void {
    const selectedId = getSingleSelectedElementId(appState.selectedElementIds);
    if (!selectedId) {
      this.hide();
      return;
    }

    const selectionChanged = selectedId !== this.selectedElementId;
    if (selectionChanged) {
      this.selectedElementId = selectedId;
      this.selectedElementIndex = elements.findIndex(
        (element) => element.id === selectedId,
      );
      this.positionKey = "";
    }

    let element = elements[this.selectedElementIndex];
    if (!element || element.id !== selectedId) {
      this.selectedElementIndex = elements.findIndex(
        (candidate) => candidate.id === selectedId,
      );
      element = elements[this.selectedElementIndex];
    }
    if (!element || element.isDeleted) {
      this.hide();
      return;
    }

    const fileId = element.type === "image" ? element.fileId : null;
    const actionTargetChanged =
      selectionChanged ||
      element.type !== this.actionElementType ||
      fileId !== this.actionElementFileId ||
      element.customData !== this.actionElementCustomData;
    if (actionTargetChanged) {
      this.actionElementType = element.type;
      this.actionElementFileId = fileId;
      this.actionElementCustomData = element.customData;
      const actions = this.providers.flatMap((provider) =>
        provider.getActions(element),
      );
      if (actions.length === 0) {
        this.hide(false);
        return;
      }
      this.renderActions(actions);
    } else if (
      !this.menuEl ||
      this.menuEl.hidden ||
      this.menuEl.hasClass("is-hidden")
    ) {
      return;
    }

    this.updatePosition(element, appState);
  }

  /** Removes the menu and all provider references. */
  public destroy(): void {
    this.menuEl?.remove();
    this.menuEl = null;
    this.actionsEl = null;
    this.providers.length = 0;
    this.selectedElementId = null;
    this.selectedElementIndex = -1;
    this.clearActionTarget();
    this.positionKey = "";
  }

  private renderActions(actions: readonly SelectedElementMenuAction[]): void {
    const menuEl = this.ensureMenu();
    if (!menuEl || !this.actionsEl) {
      return;
    }
    this.actionsEl.empty();
    actions.forEach((action) => {
      const button = this.actionsEl.createEl("button", {
        cls: "ToolIcon_type_button ToolIcon_size_small ToolIcon_type_button--show ToolIcon",
        attr: {
          type: "button",
          title: action.title,
          "aria-label": action.title,
        },
      });
      const iconEl = button.createDiv({
        cls: "ToolIcon__icon",
        attr: { "aria-hidden": "true" },
      });
      setIcon(iconEl, action.icon);
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        action.action();
      });
    });
    menuEl.hidden = false;
    menuEl.removeClass("is-hidden");
  }

  private ensureMenu(): HTMLDivElement | null {
    const host = this.getHost();
    if (!host) {
      return null;
    }
    if (!this.menuEl) {
      this.menuEl = host.createDiv({
        cls: "embeddable-menu excalidraw-selected-element-menu is-hidden"
      });
      this.actionsEl = this.menuEl.createDiv({ cls: "Island" });
    }
    if (this.menuEl.parentElement !== host) {
      host.appendChild(this.menuEl);
    }
    return this.menuEl;
  }

  private updatePosition(
    element: ExcalidrawElement,
    appState: AppState,
  ): void {
    const key = [
      element.x,
      element.y,
      appState.scrollX,
      appState.scrollY,
      appState.zoom.value,
      appState.offsetLeft,
      appState.offsetTop,
    ].join(":");
    if (key === this.positionKey) {
      return;
    }
    this.positionKey = key;
    const { x, y } = sceneCoordsToViewportCoords(
      { sceneX: element.x, sceneY: element.y },
      appState,
    );
    if (this.menuEl) {
      this.menuEl.style.top = `${y - 2.5 * ROOTELEMENTSIZE - appState.offsetTop}px`;
      this.menuEl.style.left = `${x - appState.offsetLeft}px`;
    }
  }

  private hide(clearSelection: boolean = true): void {
    if (this.menuEl) {
      this.menuEl.hidden = true;
      this.menuEl.addClass("is-hidden");
    }
    this.positionKey = "";
    if (clearSelection) {
      this.selectedElementId = null;
      this.selectedElementIndex = -1;
      this.clearActionTarget();
    }
  }

  private clearActionTarget(): void {
    this.actionElementType = null;
    this.actionElementFileId = null;
    this.actionElementCustomData = null;
  }
}
