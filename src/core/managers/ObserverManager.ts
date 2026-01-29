import { debug, DEBUGGING } from "src/utils/debugHelper";
import ExcalidrawPlugin from "src/core/main";
import { CustomMutationObserver } from "src/utils/debugHelper";
import { getExcalidrawViews, isObsidianThemeDark } from "src/utils/obsidianUtils";
import { App, Notice, TFile } from "obsidian";
import { ExcalidrawImperativeAPI } from "@zsviczian/excalidraw/types/excalidraw/types";

export class ObserverManager {
  private plugin: ExcalidrawPlugin;
  private app: App;
  private themeObserver: MutationObserver | CustomMutationObserver;
  private fileExplorerObserver: MutationObserver | CustomMutationObserver;
  private modalContainerObserver: MutationObserver | CustomMutationObserver;
  private workspaceDrawerLeftObserver: MutationObserver | CustomMutationObserver;
  private workspaceDrawerRightObserver: MutationObserver | CustomMutationObserver;
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
      if(this.settings.matchThemeTrigger) this.addThemeObserver();
      this.experimentalFileTypeDisplayToggle(this.settings.experimentalFileType);
      this.addModalContainerObserver();
      if (this.app.isMobile) {
        this.addWorkspaceDrawerObserver();
      }
    } catch (e) {
      new Notice("Error adding ObserverManager", 6000);
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
    if(this.themeObserver) return;
    const { matchThemeTrigger } = this.settings;
    if (!matchThemeTrigger) return;

    const themeObserverFn:MutationCallback = async (mutations: MutationRecord[]) => {
      (process.env.NODE_ENV === 'development') && DEBUGGING && debug(themeObserverFn, `ExcalidrawPlugin.addThemeObserver`, mutations);
      const { matchThemeTrigger } = this.settings;
      if (!matchThemeTrigger) return;

      const bodyClassList = document.body.classList;
      const mutation = mutations[0];
      if (mutation?.oldValue === bodyClassList.value) return;
      
      const darkClass = bodyClassList.contains('theme-dark');
      if (mutation?.oldValue?.includes('theme-dark') === darkClass) return;

      setTimeout(()=>{ //run async to avoid blocking the UI
        const theme = isObsidianThemeDark() ? "dark" : "light";
        const excalidrawViews = getExcalidrawViews(this.app);
        excalidrawViews.forEach(excalidrawView => {
          if (excalidrawView.file && excalidrawView.excalidrawAPI) {
            excalidrawView.setTheme(theme);
          }
        });
      });
    };

    this.themeObserver = DEBUGGING
      ? new CustomMutationObserver(themeObserverFn, "themeObserver")
      : new MutationObserver(themeObserverFn);
  
    this.themeObserver.observe(document.body, {
      attributeOldValue: true,
      attributeFilter: ["class"],
    });
  }

  public removeThemeObserver() {
    if(!this.themeObserver) return;
    this.themeObserver.disconnect();
    this.themeObserver = null;
  }

  public experimentalFileTypeDisplayToggle(enabled: boolean) {
    if (enabled) {
      this.experimentalFileTypeDisplay();
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
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.experimentalFileTypeDisplay, `ExcalidrawPlugin.experimentalFileTypeDisplay`);
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

    const fileExplorerObserverFn:MutationCallback = (mutationsList) => {
      (process.env.NODE_ENV === 'development') && DEBUGGING && debug(fileExplorerObserverFn, `ExcalidrawPlugin.experimentalFileTypeDisplay > fileExplorerObserverFn`, mutationsList);
      const ensureFiletypes = (target: Element | DocumentFragment) => {
        target.querySelectorAll?.(".nav-file-title").forEach(insertFiletype);
      };

      mutationsList.forEach((mutation) => {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof Element || node instanceof DocumentFragment) {
              ensureFiletypes(node);
            }
          });
          if (mutation.target instanceof Element) {
            // Handles folders that were collapsed/expanded without adding nodes
            ensureFiletypes(mutation.target);
          }
          return;
        }

        if (mutation.type === "attributes" && mutation.target instanceof Element) {
          ensureFiletypes(mutation.target);
        }
      });
    };

    this.fileExplorerObserver = DEBUGGING
      ? new CustomMutationObserver(fileExplorerObserverFn, "fileExplorerObserver")
      : new MutationObserver(fileExplorerObserverFn);

    //the part that should only run after onLayoutReady
    document.querySelectorAll(".nav-file-title").forEach(insertFiletype); //apply filetype to files already displayed
    const container = document.querySelector(".nav-files-container");
    if (container) {
      this.fileExplorerObserver.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "aria-expanded"],
      });
    }
  }

  /**
   * Monitors if the user clicks outside the Excalidraw view, and saves the drawing if it's dirty
   * @returns 
   */
  public addModalContainerObserver() {
    if(!this.plugin.activeExcalidrawView) return;
    if(this.modalContainerObserver) {
      if(this.activeViewDoc === this.plugin.activeExcalidrawView.ownerDocument) {
        return;
      }
      this.removeModalContainerObserver();
    }
    //The user clicks settings, or "open another vault", or the command palette
    const modalContainerObserverFn: MutationCallback = async (m: MutationRecord[]) => {
      (process.env.NODE_ENV === 'development') && DEBUGGING && debug(modalContainerObserverFn,`ExcalidrawPlugin.modalContainerObserverFn`, m);
      const view = this.plugin.activeExcalidrawView;
      if (
        (m.length !== 1) ||
        (m[0].type !== "childList") ||
        (m[0].addedNodes.length !== 1) ||
        (!view) ||
        view.semaphores?.viewunload ||
        (!view.isDirty())
      ) {
        return;
      }
      
      const { errorMessage } = (view.excalidrawAPI as ExcalidrawImperativeAPI).getAppState();
      if (!errorMessage) this.plugin.activeExcalidrawView.save();
    };

    this.modalContainerObserver = DEBUGGING
      ? new CustomMutationObserver(modalContainerObserverFn, "modalContainerObserver")
      : new MutationObserver(modalContainerObserverFn);
    this.activeViewDoc = this.plugin.activeExcalidrawView.ownerDocument;
    this.modalContainerObserver.observe(this.activeViewDoc.body, {
      childList: true,
    });    
  }

  public removeModalContainerObserver() {
    if(!this.modalContainerObserver) return;
    this.modalContainerObserver.disconnect();
    this.activeViewDoc = null;
    this.modalContainerObserver = null;
  }

  private addWorkspaceDrawerObserver() {
    //when the user activates the sliding drawers on Obsidian Mobile
    if (this.workspaceDrawerLeftObserver || this.workspaceDrawerRightObserver) return;

    const leftWorkspaceDrawer = document.querySelector<HTMLElement>(".workspace .workspace-drawer.mod-left");
    const rightWorkspaceDrawer = document.querySelector<HTMLElement>(".workspace .workspace-drawer.mod-right");
    if (!leftWorkspaceDrawer && !rightWorkspaceDrawer) return;

    const parseDisplay = (value?: string | null): string => {
      if (!value) return "";
      const match = value.match(/display:\s*([^;]+);?/i);
      return match ? match[1].trim() : "";
    };

    const action: MutationCallback = (mutations) => {
      const activeView = this.plugin.activeExcalidrawView;
      if (!activeView || activeView.semaphores?.viewunload) return;

      for (const mutation of mutations) {
        if (mutation.type !== "attributes" || mutation.attributeName !== "style") continue;

        const target = mutation.target as HTMLElement;
        const newDisplay = target.style.display;
        const oldDisplay = parseDisplay(mutation.oldValue as string);

        // Drawer finished closing: refresh to fix pointer offset after CSS transitions
        if (newDisplay === "none" && oldDisplay !== "none") {
          activeView.refresh();
          continue;
        }

        // Drawer just opened after being hidden: keep the previous autosave safeguard
        if (oldDisplay === "none" && newDisplay !== "none" && activeView.isDirty()) {
          activeView.save();
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