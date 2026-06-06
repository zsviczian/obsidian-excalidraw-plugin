import {
  WorkspaceLeaf,
  TFile,
  Editor,
  MarkdownView,
  MarkdownFileInfo,
  MetadataCache,
  App,
  EventRef,
  Menu,
  FileView,
} from "obsidian";
import { ExcalidrawElement } from "@zsviczian/excalidraw/types/element/src/types";
import { getLink } from "../../utils/fileUtils";
import {
  editorInsertText,
  getExcalidrawViews,
  getParentOfClass,
  isUnwantedLeaf,
  setExcalidrawView,
} from "../../utils/obsidianUtils";
import ExcalidrawPlugin from "src/core/main";
import { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";
import {
  FRONTMATTER_KEYS,
  ICON_NAME,
  mainDocument,
  VIEW_TYPE_EXCALIDRAW,
} from "src/constants/constants";
import ExcalidrawView from "src/view/ExcalidrawView";
import { t } from "src/lang/helpers";
import {
  getChangedTopLevelDependencyFileIDs,
  setMobileNavbarPosition,
} from "src/utils/excalidrawViewUtils";

/**
 * Registers event listeners for the plugin
 * Must be constructed after the workspace is ready (onLayoutReady)
 * Intended to be called from onLayoutReady in onload()
 */
export class EventManager {
  private plugin: ExcalidrawPlugin;
  private app: App;
  public leafChangeTimeout: number | null = null;
  private removeEventLisnters: (() => void)[] = []; //only used if I register an event directly, not via Obsidian's registerEvent
  private previouslyActiveLeaf: WorkspaceLeaf;
  private splitViewLeafSwitchTimestamp: number = 0;
  private debunceActiveLeafChangeHandlerTimer: number | null = null;

  get settings() {
    return this.plugin.settings;
  }

  get ea(): ExcalidrawAutomate {
    return this.plugin.ea;
  }

  get activeExcalidrawView() {
    return this.plugin.activeExcalidrawView;
  }

  set activeExcalidrawView(view: ExcalidrawView) {
    this.plugin.activeExcalidrawView = view;
  }

  private registerEvent(eventRef: EventRef): void {
    this.plugin.registerEvent(eventRef);
  }

  constructor(plugin: ExcalidrawPlugin) {
    this.plugin = plugin;
    this.app = plugin.app;
  }

  destroy() {
    if (this.leafChangeTimeout) {
      window.clearTimeout(this.leafChangeTimeout);
      this.leafChangeTimeout = null;
    }
    if (this.debunceActiveLeafChangeHandlerTimer) {
      window.clearTimeout(this.debunceActiveLeafChangeHandlerTimer);
      this.debunceActiveLeafChangeHandlerTimer = null;
    }
    this.removeEventLisnters.forEach((removeEventListener) =>
      removeEventListener(),
    );
    this.removeEventLisnters = [];
  }

  public async initialize() {
    try {
      await this.registerEvents();
    } catch (e) {
      console.error("Error registering event listeners", e);
    }
    this.plugin.logStartupEvent("Event listeners registered");
  }

  public isRecentSplitViewSwitch(): boolean {
    return Date.now() - this.splitViewLeafSwitchTimestamp < 3000;
  }

  public async registerEvents() {
    await this.plugin.awaitInit();
    this.registerEvent(
      this.app.workspace.on("editor-paste", this.onPasteHandler.bind(this)),
    );
    this.registerEvent(
      this.app.vault.on("rename", this.onRenameHandler.bind(this)),
    );
    this.registerEvent(
      this.app.vault.on("modify", this.onModifyHandler.bind(this)),
    );
    this.registerEvent(
      this.app.vault.on("delete", this.onDeleteHandler.bind(this)),
    );

    //save Excalidraw leaf and update embeds when switching to another leaf
    this.registerEvent(
      this.plugin.app.workspace.on(
        "active-leaf-change",
        this.onActiveLeafChangeHandler.bind(this),
      ),
    );

    this.registerEvent(
      this.app.workspace.on(
        "layout-change",
        this.onLayoutChangeHandler.bind(this),
      ),
    );

    //File Save Trigger Handlers
    //Save the drawing if the user clicks outside the Excalidraw Canvas
    const onClickEventSaveActiveDrawing =
      this.onClickSaveActiveDrawing.bind(this);
    this.app.workspace.containerEl.addEventListener(
      "click",
      onClickEventSaveActiveDrawing,
    );
    this.removeEventLisnters.push(() => {
      this.app.workspace.containerEl.removeEventListener(
        "click",
        onClickEventSaveActiveDrawing,
      );
    });
    this.registerEvent(
      this.app.workspace.on(
        "file-menu",
        this.onFileMenuSaveActiveDrawing.bind(this),
      ),
    );

    const metaCache: MetadataCache = this.app.metadataCache;
    this.registerEvent(
      metaCache.on("changed", (file, _, cache) =>
        this.plugin.updateFileCache(file, cache?.frontmatter),
      ),
    );

    this.registerEvent(
      this.app.workspace.on("file-menu", this.onFileMenuHandler.bind(this)),
    );
    this.plugin.registerEvent(
      this.plugin.app.workspace.on(
        "editor-menu",
        this.onEditorMenuHandler.bind(this),
      ),
    );
  }

  public setDebounceActiveLeafChangeHandler() {
    if (this.debunceActiveLeafChangeHandlerTimer) {
      window.clearTimeout(this.debunceActiveLeafChangeHandlerTimer);
    }
    this.debunceActiveLeafChangeHandlerTimer = window.setTimeout(() => {
      this.debunceActiveLeafChangeHandlerTimer = null;
    }, 50);
  }

  private onLayoutChangeHandler() {
    if (this.app.workspace.layoutReady) {
      getExcalidrawViews(this.app, true).forEach(
        (excalidrawView) =>
          !!excalidrawView?.refresh && excalidrawView.refresh(),
      );
    }
  }

  private onPasteHandler(
    evt: ClipboardEvent,
    editor: Editor,
    info: MarkdownView | MarkdownFileInfo,
  ) {
    if (evt.defaultPrevented) {
      return;
    }
    const data = evt.clipboardData.getData("text/plain");
    if (!data) {
      return;
    }
    if (data.startsWith(`{"type":"excalidraw/clipboard"`)) {
      evt.preventDefault();
      try {
        const drawing = JSON.parse(data);
        const hasOneTextElement =
          drawing.elements.filter((el: ExcalidrawElement) => el.type === "text")
            .length === 1;
        if (!(hasOneTextElement || drawing.elements?.length === 1)) {
          return;
        }
        const element = hasOneTextElement
          ? drawing.elements.filter(
              (el: ExcalidrawElement) => el.type === "text",
            )[0]
          : drawing.elements[0];
        if (element.type === "image") {
          const fileinfo = this.plugin.filesMaster.get(element.fileId);
          if (fileinfo && fileinfo.path) {
            let path = fileinfo.path.split("|")[0]; // strip size anchoring (e.g. |100%)
            const sourceFile = info.file;
            const imageFile = this.app.vault.getAbstractFileByPath(path);
            if (sourceFile && imageFile && imageFile instanceof TFile) {
              path = this.app.metadataCache.fileToLinktext(
                imageFile,
                sourceFile.path,
              );
            }
            if (fileinfo.blockrefData) {
              path = `${path}#${fileinfo.blockrefData.split("|")[0]}`; // strip size anchoring (e.g. |100%)
            }
            editorInsertText(editor, getLink(this.plugin, { path }));
          }
          return;
        }
        if (element.type === "text") {
          editorInsertText(editor, element.rawText);
          return;
        }
        if (element.link) {
          editorInsertText(editor, `${element.link}`);
        }
      } catch (_) {}
    }
  }

  private onRenameHandler(file: TFile, oldPath: string) {
    void this.plugin.renameEventHandler(file, oldPath);
  }

  private onModifyHandler(file: TFile) {
    void this.plugin.modifyEventHandler(file);
  }

  private onDeleteHandler(file: TFile) {
    void this.plugin.deleteEventHandler(file);
  }

  public async onActiveLeafChangeHandler(leaf: WorkspaceLeaf) {
    //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/723

    if (this.debunceActiveLeafChangeHandlerTimer) {
      return;
    }

    //In Obsidian 1.8.x the active excalidraw leaf is obscured by an empty leaf without a parent
    //This hack resolves it
    if (this.app.workspace.activeLeaf === leaf && isUnwantedLeaf(leaf)) {
      leaf.detach();
      return;
    }

    if (leaf.view && leaf.view.getViewType() === "pdf") {
      this.plugin.lastPDFLeafID = leaf.id;
    }

    if (leaf.view && leaf.view.getViewType() === VIEW_TYPE_EXCALIDRAW) {
      this.plugin.lastActiveExcalidrawLeafID = leaf.id;
    } else {
      const lastLeaf = this.app.workspace.getLeafById(
        this.plugin.lastActiveExcalidrawLeafID,
      );
      if (!lastLeaf || !(lastLeaf.view instanceof ExcalidrawView)) {
        this.plugin.lastActiveExcalidrawLeafID = null;
      }
    }

    if (this.leafChangeTimeout) {
      window.clearTimeout(this.leafChangeTimeout);
    }
    this.leafChangeTimeout = window.setTimeout(() => {
      this.leafChangeTimeout = null;
    }, 1000);

    if (this.settings.overrideObsidianFontSize) {
      if (leaf.view && leaf.view.getViewType() === VIEW_TYPE_EXCALIDRAW) {
        mainDocument.documentElement.style.fontSize = "";
      }
    }

    const previouslyActiveEV = this.activeExcalidrawView;
    const newActiveviewEV: ExcalidrawView =
      leaf.view instanceof ExcalidrawView ? leaf.view : null;
    this.activeExcalidrawView = newActiveviewEV;
    const previousFile = (this.previouslyActiveLeaf?.view as FileView)?.file;
    const currentFile = (leaf?.view as FileView).file;
    //editing the same file in a different leaf
    if (currentFile && previousFile === currentFile) {
      if (
        this.previouslyActiveLeaf.view instanceof MarkdownView &&
        leaf.view instanceof ExcalidrawView
      ) {
        this.splitViewLeafSwitchTimestamp = Date.now();
      }
    }
    this.previouslyActiveLeaf = leaf;

    if (newActiveviewEV) {
      this.plugin.addModalContainerObserver();
      this.plugin.lastActiveExcalidrawFilePath = newActiveviewEV.file?.path;
    } else {
      this.plugin.removeModalContainerObserver();
    }

    setMobileNavbarPosition(!!newActiveviewEV);
    //----------------------
    //----------------------

    if (previouslyActiveEV && previouslyActiveEV !== newActiveviewEV) {
      if (previouslyActiveEV.leaf !== leaf) {
        //if loading new view to same leaf then don't save. Excalidraw view will take care of saving anyway.
        //avoid double saving
        if (
          previouslyActiveEV?.isDirty() &&
          !previouslyActiveEV.semaphores?.viewunload
        ) {
          await previouslyActiveEV.save(true); //this will update transclusions in the drawing
        }
      }
      if (previouslyActiveEV.file) {
        this.plugin.triggerEmbedUpdates(previouslyActiveEV.file.path);
      }
    }

    if (
      newActiveviewEV &&
      (!previouslyActiveEV || previouslyActiveEV.leaf !== leaf)
    ) {
      //the user switched to a new leaf
      //timeout gives time to the view being exited to finish saving
      const f = newActiveviewEV.file;
      if (newActiveviewEV.file) {
        window.setTimeout(() => {
          if (!newActiveviewEV || !newActiveviewEV._loaded) {
            return;
          }
          if (newActiveviewEV.file?.path !== f?.path) {
            return;
          }
          if (newActiveviewEV.activeLoader) {
            return;
          }
          const changedDependencyFileIDs =
            getChangedTopLevelDependencyFileIDs(newActiveviewEV);
          if (changedDependencyFileIDs.size > 0) {
            // Reload only top-level embeds whose own file changed or whose
            // dependency tree contains a newer nested Excalidraw file.
            newActiveviewEV.scheduleSceneFileDeferredValidation(
              changedDependencyFileIDs,
              false,
              true,
            );
          }
        }, 2000);
      } //refresh embedded files
    }

    if (
      newActiveviewEV &&
      newActiveviewEV._loaded &&
      newActiveviewEV.isLoaded &&
      newActiveviewEV.excalidrawAPI &&
      this.ea.onCanvasColorChangeHook
    ) {
      this.ea.onCanvasColorChangeHook(
        this.ea,
        newActiveviewEV,
        newActiveviewEV.excalidrawAPI.getAppState().viewBackgroundColor,
      );
    }

    //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/300
    if (this.plugin.popScope) {
      this.plugin.popScope();
      this.plugin.popScope = null;
    }
    if (newActiveviewEV) {
      this.plugin.registerHotkeyOverrides();
    }
  }

  //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/551
  private onClickSaveActiveDrawing(e: PointerEvent) {
    if (
      !this.activeExcalidrawView ||
      !this.activeExcalidrawView?.isDirty() ||
      (e.target &&
        ((e.target as Element).className === "excalidraw__canvas" ||
          getParentOfClass(e.target as Element, "excalidraw-wrapper")))
    ) {
      return;
    }
    void this.activeExcalidrawView.save();
  }

  private onFileMenuSaveActiveDrawing() {
    if (!this.activeExcalidrawView || !this.activeExcalidrawView?.isDirty()) {
      return;
    }
    void this.activeExcalidrawView.save();
  }

  private onFileMenuHandler(
    menu: Menu,
    file: TFile,
    source: string,
    leaf: WorkspaceLeaf,
  ) {
    if (!leaf) {
      return;
    }
    const view = leaf.view;
    if (!view || !(view instanceof MarkdownView)) {
      return;
    }
    if (!(file instanceof TFile)) {
      return;
    }
    const cache = this.app.metadataCache.getFileCache(file);
    if (
      !cache?.frontmatter ||
      !cache.frontmatter[FRONTMATTER_KEYS.plugin.name]
    ) {
      return;
    }

    menu.addItem((item) => {
      item
        .setTitle(t("OPEN_AS_EXCALIDRAW"))
        .setIcon(ICON_NAME)
        .setSection("pane")
        .onClick(async () => {
          await view.save();
          this.plugin.excalidrawFileModes[leaf.id || file.path] =
            VIEW_TYPE_EXCALIDRAW;
          void setExcalidrawView(leaf);
        });
    });
    menu.items.unshift(menu.items.pop());
  }

  private onEditorMenuHandler(menu: Menu, editor: Editor, view: MarkdownView) {
    if (!view || !(view instanceof MarkdownView)) {
      return;
    }
    const file = view.file;
    const leaf = view.leaf;
    if (!view.file) {
      return;
    }
    const cache = this.app.metadataCache.getFileCache(file);
    if (
      !cache?.frontmatter ||
      !cache.frontmatter[FRONTMATTER_KEYS.plugin.name]
    ) {
      return;
    }

    menu.addItem((item) =>
      item
        .setTitle(t("OPEN_AS_EXCALIDRAW"))
        .setIcon(ICON_NAME)
        .setSection("excalidraw")
        .onClick(async () => {
          await view.save();
          this.plugin.excalidrawFileModes[leaf.id || file.path] =
            VIEW_TYPE_EXCALIDRAW;
          void setExcalidrawView(leaf);
        }),
    );
  }
}
