import { debug, DEBUGGING } from "src/utils/debugHelper";
import ExcalidrawPlugin from "src/core/main";
import { CustomMutationObserver } from "src/utils/debugHelper";
import { getExcalidrawViews, isObsidianThemeDark } from "src/utils/obsidianUtils";
import { App, Notice, TFile } from "obsidian";

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
    }
    if (this.workspaceDrawerRightObserver) {
      this.workspaceDrawerRightObserver.disconnect();
    }
    if (this.fileExplorerObserver) {
      this.fileExplorerObserver.disconnect();
    }
    if (this.workspaceDrawerRightObserver) {
      this.workspaceDrawerRightObserver.disconnect();
    }
    if (this.workspaceDrawerLeftObserver) {
      this.workspaceDrawerLeftObserver.disconnect();
    }
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
    const insertFiletype = (el: HTMLElement) => {
      if (el.childElementCount !== 1) {
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
        el.insertBefore(
          createDiv({
            cls: "nav-file-tag",
            text: this.settings.experimentalFileTag,
          }),
          el.firstChild,
        );
      }
    };

    const fileExplorerObserverFn:MutationCallback = (mutationsList) => {
      (process.env.NODE_ENV === 'development') && DEBUGGING && debug(fileExplorerObserverFn, `ExcalidrawPlugin.experimentalFileTypeDisplay > fileExplorerObserverFn`, mutationsList);
      const mutationsWithNodes = mutationsList.filter((mutation) => mutation.addedNodes.length > 0);
      mutationsWithNodes.forEach((mutationNode) => {
        mutationNode.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) {
            return;
          }
          node.querySelectorAll(".nav-file-title").forEach(insertFiletype);
        });
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
      if (
        (m.length !== 1) ||
        (m[0].type !== "childList") ||
        (m[0].addedNodes.length !== 1) ||
        (!this.plugin.activeExcalidrawView) ||
        this.plugin.activeExcalidrawView?.semaphores?.viewunload ||
        (!this.plugin.activeExcalidrawView?.isDirty())
      ) {
        return;
      }
      this.plugin.activeExcalidrawView.save();
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
    const leftWorkspaceDrawer = document.querySelector(
      ".workspace-drawer.mod-left",
    );
    const rightWorkspaceDrawer = document.querySelector(
      ".workspace-drawer.mod-right",
    );
    if (leftWorkspaceDrawer || rightWorkspaceDrawer) {
      const action = async (m: MutationRecord[]) => {
        if (
          m[0].oldValue !== "display: none;" ||
          !this.plugin.activeExcalidrawView ||
          !this.plugin.activeExcalidrawView?.isDirty()
        ) {
          return;
        }
        this.plugin.activeExcalidrawView.save();
      };
      const options = {
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
        this.workspaceDrawerRightObserver.observe(
          rightWorkspaceDrawer,
          options,
        );
      }
    }
  }
}