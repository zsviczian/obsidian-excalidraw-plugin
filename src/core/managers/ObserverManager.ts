import { t } from "src/lang/helpers";
import { DEBUGGING } from "src/utils/debugHelper";
import type ExcalidrawPlugin from "src/core/main";
import { CustomMutationObserver } from "src/utils/debugHelper";
import { DEVICE } from "src/constants/constants";
import {
  getExcalidrawViews,
  isObsidianThemeDark,
} from "src/utils/obsidianUtils";
import { App, Notice, TFile } from "obsidian";
import {
  isInstanceOfDocumentFragment,
  isInstanceOfElement,
} from "src/utils/typechecks";
import type ExcalidrawView from "src/view/ExcalidrawView";

declare const mainDocument: Document;
const MODAL_CONTAINER_SELECTOR = ".modal-container";

/**
 * Checks an observed DOM node without relying on cross-window constructors.
 *
 * Mutation records can contain nodes from an Obsidian popout realm whose
 * `instanceof Element` identity is not reliable after window migration.
 */
const isObservedElement = (node: Node): node is Element =>
  node.nodeType === 1 && typeof (node as Element).matches === "function";

export class ObserverManager {
  private plugin: ExcalidrawPlugin;
  private app: App;
  private themeObserver: MutationObserver | CustomMutationObserver;
  private fileExplorerObserver: MutationObserver | CustomMutationObserver;
  private modalContainerObserver:
    | MutationObserver
    | CustomMutationObserver
    | null = null;
  private modalObservedView: ExcalidrawView | null = null;
  private workspaceDrawerLeftObserver:
    | MutationObserver
    | CustomMutationObserver;
  private workspaceDrawerRightObserver:
    | MutationObserver
    | CustomMutationObserver;
  private activeViewDoc: Document;

  get settings() {
    return this.plugin.settings;
  }

  constructor(plugin: ExcalidrawPlugin) {
    this.plugin = plugin;
    this.app = plugin.app;
  }

  public initialize() {
    try {
      if (this.settings.matchThemeTrigger) {
        this.addThemeObserver();
      }
      this.experimentalFileTypeDisplayToggle(
        this.settings.experimentalFileType,
      );
      this.addModalContainerObserver();
      if (this.app.isMobile) {
        this.addWorkspaceDrawerObserver();
      }
    } catch (e) {
      new Notice(t("ERROR_ADDING_OBSERVER_MANAGER"), 6000);
      console.error("Error adding ObserverManager", e);
    }
    this.plugin.logStartupEvent("ObserverManager added");
  }

  public destroy() {
    this.removeThemeObserver();
    this.removeModalContainerObserver();
    if (this.workspaceDrawerLeftObserver) {
      this.workspaceDrawerLeftObserver.disconnect();
      this.workspaceDrawerLeftObserver = null;
    }
    if (this.workspaceDrawerRightObserver) {
      this.workspaceDrawerRightObserver.disconnect();
      this.workspaceDrawerRightObserver = null;
    }
    if (this.fileExplorerObserver) {
      this.fileExplorerObserver.disconnect();
      this.fileExplorerObserver = null;
    }

    this.plugin = null;
    this.app = null;
    this.activeViewDoc = null;
  }

  public addThemeObserver() {
    if (this.themeObserver) {
      return;
    }
    const { matchThemeTrigger } = this.settings;
    if (!matchThemeTrigger) {
      return;
    }

    const themeObserverFn: MutationCallback = (mutations: MutationRecord[]) => {
      const { matchThemeTrigger } = this.settings;
      if (!matchThemeTrigger) {
        return;
      }

      const bodyClassList = mainDocument.body.classList;
      const mutation = mutations[0];
      if (mutation?.oldValue === bodyClassList.value) {
        return;
      }

      const darkClass = bodyClassList.contains("theme-dark");
      if (mutation?.oldValue?.includes("theme-dark") === darkClass) {
        return;
      }

      window.setTimeout(() => {
        //run async to avoid blocking the UI
        const theme = isObsidianThemeDark() ? "dark" : "light";
        const excalidrawViews = getExcalidrawViews(this.app, true);
        excalidrawViews.forEach((excalidrawView) => {
          if (excalidrawView.file) {
            excalidrawView.setTheme(theme);
          }
        });
      });
    };

    this.themeObserver = DEBUGGING
      ? new CustomMutationObserver(themeObserverFn, "themeObserver")
      : new MutationObserver(themeObserverFn);

    this.themeObserver.observe(mainDocument.body, {
      attributeOldValue: true,
      attributeFilter: ["class"],
    });
  }

  public removeThemeObserver() {
    if (!this.themeObserver) {
      return;
    }
    this.themeObserver.disconnect();
    this.themeObserver = null;
  }

  public experimentalFileTypeDisplayToggle(enabled: boolean) {
    if (enabled) {
      void this.experimentalFileTypeDisplay();
      return;
    }
    if (this.fileExplorerObserver) {
      this.fileExplorerObserver.disconnect();
    }
    this.fileExplorerObserver = null;
  }

  /**
   * Display characters configured in settings, in front of the filename, if the markdown file is an excalidraw drawing
   * Must be called after the workspace is ready
   * The function is called from onload()
   */
  private async experimentalFileTypeDisplay() {
    const tagClassName = "excalidraw-filetype-tag";
    const insertFiletype = (el: HTMLElement) => {
      if (!el || el.querySelector(`.${tagClassName}`)) {
        return;
      }
      const filename = el.getAttribute("data-path");
      if (!filename) {
        return;
      }
      const f = this.app.vault.getAbstractFileByPath(filename);
      if (!f || !(f instanceof TFile)) {
        return;
      }
      if (this.plugin.isExcalidrawFile(f)) {
        el.insertAfter(
          createDiv({
            cls: ["nav-file-tag", tagClassName],
            text: this.settings.experimentalFileTag,
          }),
          el.firstChild,
        );
      }
    };

    const fileExplorerObserverFn: MutationCallback = (mutationsList) => {
      const ensureFiletypes = (target: Element | DocumentFragment) => {
        target.querySelectorAll?.(".nav-file-title").forEach(insertFiletype);
      };

      mutationsList.forEach((mutation) => {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (
              isInstanceOfElement(node) ||
              isInstanceOfDocumentFragment(node)
            ) {
              ensureFiletypes(node);
            }
          });
          if (isInstanceOfElement(mutation.target)) {
            // Handles folders that were collapsed/expanded without adding nodes
            ensureFiletypes(mutation.target);
          }
          return;
        }

        if (
          mutation.type === "attributes" &&
          isInstanceOfElement(mutation.target)
        ) {
          ensureFiletypes(mutation.target);
        }
      });
    };

    this.fileExplorerObserver = DEBUGGING
      ? new CustomMutationObserver(
          fileExplorerObserverFn,
          "fileExplorerObserver",
        )
      : new MutationObserver(fileExplorerObserverFn);

    const attachObserversToContainers = (): boolean => {
      const containers = Array.from(
        mainDocument.querySelectorAll(".nav-files-container"),
      );
      if (!containers.length) {
        return false;
      }

      containers.forEach((container) => {
        container.querySelectorAll(".nav-file-title").forEach(insertFiletype); //apply tags to items already shown
        this.fileExplorerObserver.observe(container, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "aria-expanded"],
        });
      });

      return true;
    };

    if (!attachObserversToContainers() && DEVICE.isMobile) {
      // On mobile, the file explorer lives inside drawers and may not be in the DOM yet.
      const waitForFileExplorer = new MutationObserver(
        (mutations, observer) => {
          for (const mutation of mutations) {
            if (mutation.type !== "childList") {
              continue;
            }
            const added = Array.from(mutation.addedNodes ?? []);
            const hasContainer = added.some(
              (node) =>
                isInstanceOfElement(node) &&
                (node.matches?.(".nav-files-container") ||
                  node.querySelector?.(".nav-files-container")),
            );
            if (!hasContainer) {
              continue;
            }
            if (attachObserversToContainers()) {
              observer.disconnect();
              break;
            }
          }
        },
      );

      waitForFileExplorer.observe(mainDocument.body, {
        childList: true,
        subtree: true,
      });
    }
  }

  /**
   * Saves a dirty drawing when an Obsidian modal opens in its live document.
   *
   * @param view - The active or same-leaf replacement view to observe.
   */
  public addModalContainerObserver(view = this.plugin.activeExcalidrawView) {
    if (!view) {
      return;
    }
    const activeViewDoc = view.containerEl.ownerDocument;
    if (this.modalContainerObserver) {
      if (
        this.activeViewDoc === activeViewDoc &&
        this.modalObservedView === view
      ) {
        return;
      }
      this.removeModalContainerObserver();
    }
    //The user clicks settings, or "open another vault", or the command palette.
    //Other body portals, including inline suggestions, must not interrupt editing with a save.
    const modalContainerObserverFn: MutationCallback = (
      mutations: MutationRecord[],
    ) => {
      const observedView = this.modalObservedView;
      const addedNodes = mutations.flatMap((mutation) =>
        mutation.type === "childList"
          ? Array.from(mutation.addedNodes)
          : [],
      );
      const modalOpened = addedNodes.some(
        (node) =>
          isObservedElement(node) &&
          (node.matches(MODAL_CONTAINER_SELECTOR) ||
            node.querySelector(MODAL_CONTAINER_SELECTOR) !== null),
      );
      if (
        !modalOpened ||
        !observedView ||
        observedView.semaphores?.viewunload ||
        !observedView.isDirty() ||
        !observedView.excalidrawAPI
      ) {
        return;
      }

      const { errorMessage } = observedView.excalidrawAPI.getAppState();
      if (!errorMessage) {
        void observedView.save();
      }
    };

    this.activeViewDoc = activeViewDoc;
    this.modalObservedView = view;
    // Keep the observer constructor and target in the same window realm so a
    // migrated view never depends on its destroyed source window.
    this.modalContainerObserver = DEBUGGING
      ? new CustomMutationObserver(
          modalContainerObserverFn,
          "modalContainerObserver",
        )
      : new (activeViewDoc.defaultView?.MutationObserver ?? MutationObserver)(
          modalContainerObserverFn,
        );
    this.modalContainerObserver.observe(activeViewDoc.body, {
      childList: true,
    });
  }

  public removeModalContainerObserver() {
    if (!this.modalContainerObserver) {
      return;
    }
    this.modalContainerObserver.disconnect();
    this.modalContainerObserver = null;
    this.modalObservedView = null;
    this.activeViewDoc = null;
  }

  private addWorkspaceDrawerObserver() {
    //when the user activates the sliding drawers on Obsidian Mobile
    if (this.workspaceDrawerLeftObserver || this.workspaceDrawerRightObserver) {
      return;
    }

    const leftWorkspaceDrawer = mainDocument.querySelector<HTMLElement>(
      ".workspace .workspace-drawer.mod-left",
    );
    const rightWorkspaceDrawer = mainDocument.querySelector<HTMLElement>(
      ".workspace .workspace-drawer.mod-right",
    );
    if (!leftWorkspaceDrawer && !rightWorkspaceDrawer) {
      return;
    }

    const parseDisplay = (value?: string | null): string => {
      if (!value) {
        return "";
      }
      const match = value.match(/display:\s*([^;]+);?/i);
      return match ? match[1].trim() : "";
    };

    const action: MutationCallback = (mutations) => {
      const activeView = this.plugin.activeExcalidrawView;
      if (!activeView || activeView.semaphores?.viewunload) {
        return;
      }

      for (const mutation of mutations) {
        if (
          mutation.type !== "attributes" ||
          mutation.attributeName !== "style"
        ) {
          continue;
        }

        const target = mutation.target as HTMLElement;
        const newDisplay = target.style.display;
        const oldDisplay = parseDisplay(mutation.oldValue);

        // Drawer finished closing: refresh to fix pointer offset after CSS transitions
        if (newDisplay === "none" && oldDisplay !== "none") {
          activeView.refresh();
          continue;
        }

        // Drawer just opened after being hidden: keep the previous autosave safeguard
        if (
          oldDisplay === "none" &&
          newDisplay !== "none" &&
          activeView.isDirty()
        ) {
          void activeView.save();
        }
      }
    };

    const options = {
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ["style"],
    };

    if (leftWorkspaceDrawer) {
      this.workspaceDrawerLeftObserver = DEBUGGING
        ? new CustomMutationObserver(action, "slidingDrawerLeftObserver")
        : new MutationObserver(action);
      this.workspaceDrawerLeftObserver.observe(leftWorkspaceDrawer, options);
    }

    if (rightWorkspaceDrawer) {
      this.workspaceDrawerRightObserver = DEBUGGING
        ? new CustomMutationObserver(action, "slidingDrawerRightObserver")
        : new MutationObserver(action);
      this.workspaceDrawerRightObserver.observe(rightWorkspaceDrawer, options);
    }
  }
}
