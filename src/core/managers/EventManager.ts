import { WorkspaceLeaf, TFile, Editor, MarkdownView, MarkdownFileInfo, MetadataCache, App, EventRef, Menu, FileView } from "obsidian";
import { ExcalidrawElement } from "@zsviczian/excalidraw/types/excalidraw/element/types";
import { getLink } from "../../utils/fileUtils";
import { editorInsertText, getExcalidrawViews, getParentOfClass, setExcalidrawView } from "../../utils/obsidianUtils";
import ExcalidrawPlugin from "src/core/main";
import { DEBUGGING, debug } from "src/utils/debugHelper";
import { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";
import { DEVICE, FRONTMATTER_KEYS, ICON_NAME, VIEW_TYPE_EXCALIDRAW } from "src/constants/constants";
import ExcalidrawView from "src/view/ExcalidrawView";
import { t } from "src/lang/helpers";

/**
 * Registers event listeners for the plugin
 * Must be constructed after the workspace is ready (onLayoutReady) 
 * Intended to be called from onLayoutReady in onload()
 */
export class EventManager {
  private plugin: ExcalidrawPlugin;
  private app: App;
  public leafChangeTimeout: number|null = null;
  private removeEventLisnters:(()=>void)[] = []; //only used if I register an event directly, not via Obsidian's registerEvent
  private previouslyActiveLeaf: WorkspaceLeaf;
  private splitViewLeafSwitchTimestamp: number = 0;

  get settings() {
    return this.plugin.settings;
  }

  get ea():ExcalidrawAutomate {
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
    if(this.leafChangeTimeout) {
      window.clearTimeout(this.leafChangeTimeout);
      this.leafChangeTimeout = null;
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

  public isRecentSplitViewSwitch():boolean {
    return (Date.now() - this.splitViewLeafSwitchTimestamp) < 3000;
  }

  public async registerEvents() {
    await this.plugin.awaitInit();
    this.registerEvent(this.app.workspace.on("editor-paste", this.onPasteHandler.bind(this)));
    this.registerEvent(this.app.vault.on("rename", this.onRenameHandler.bind(this)));
    this.registerEvent(this.app.vault.on("modify", this.onModifyHandler.bind(this)));
    this.registerEvent(this.app.vault.on("delete", this.onDeleteHandler.bind(this)));

    //save Excalidraw leaf and update embeds when switching to another leaf
    this.registerEvent(this.plugin.app.workspace.on("active-leaf-change", this.onActiveLeafChangeHandler.bind(this)));

    this.registerEvent(this.app.workspace.on("layout-change", this.onLayoutChangeHandler.bind(this)));

    //File Save Trigger Handlers
    //Save the drawing if the user clicks outside the Excalidraw Canvas
    const onClickEventSaveActiveDrawing = this.onClickSaveActiveDrawing.bind(this);
    this.app.workspace.containerEl.addEventListener("click", onClickEventSaveActiveDrawing);
    this.removeEventLisnters.push(() => {
      this.app.workspace.containerEl.removeEventListener("click", onClickEventSaveActiveDrawing)
    });
    this.registerEvent(this.app.workspace.on("file-menu", this.onFileMenuSaveActiveDrawing.bind(this)));

    const metaCache: MetadataCache = this.app.metadataCache;
    this.registerEvent(
      metaCache.on("changed", (file, _, cache) =>
        this.plugin.updateFileCache(file, cache?.frontmatter),
      ),
    );

    this.registerEvent(this.app.workspace.on("file-menu", this.onFileMenuHandler.bind(this)));
    this.plugin.registerEvent(this.plugin.app.workspace.on("editor-menu", this.onEditorMenuHandler.bind(this)));
  }

  private onLayoutChangeHandler() {
    getExcalidrawViews(this.app).forEach(excalidrawView=>excalidrawView.refresh());
  }

  private onPasteHandler (evt: ClipboardEvent, editor: Editor, info: MarkdownView | MarkdownFileInfo ) {
    if(evt.defaultPrevented) return
    const data = evt.clipboardData.getData("text/plain");
    if (!data) return;
    if (data.startsWith(`{"type":"excalidraw/clipboard"`)) {
      evt.preventDefault();
      try {
        const drawing = JSON.parse(data);
        const hasOneTextElement = drawing.elements.filter((el:ExcalidrawElement)=>el.type==="text").length === 1;
        if (!(hasOneTextElement || drawing.elements?.length === 1)) {
          return;
        }
        const element = hasOneTextElement
          ? drawing.elements.filter((el:ExcalidrawElement)=>el.type==="text")[0]
          : drawing.elements[0];
        if (element.type === "image") {
          const fileinfo = this.plugin.filesMaster.get(element.fileId);
          if(fileinfo && fileinfo.path) {
            let path = fileinfo.path;
            const sourceFile = info.file;
            const imageFile = this.app.vault.getAbstractFileByPath(path);
            if(sourceFile && imageFile && imageFile instanceof TFile) {
              path = this.app.metadataCache.fileToLinktext(imageFile,sourceFile.path);
            }
            editorInsertText(editor, getLink(this.plugin, {path}));
          }
          return;
        }
        if (element.type === "text") {
          editorInsertText(editor, element.rawText);
          return;
        }
        if (element.link) {
          editorInsertText(editor, `${element.link}`);
          return;
        }
      } catch (e) {
      }
    }
  };

  private onRenameHandler(file: TFile, oldPath: string) {
    this.plugin.renameEventHandler(file, oldPath);
  }

  private onModifyHandler(file: TFile) {
    this.plugin.modifyEventHandler(file);
  }

  private onDeleteHandler(file: TFile) {
    this.plugin.deleteEventHandler(file);
  }

  public async onActiveLeafChangeHandler (leaf: WorkspaceLeaf) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.onActiveLeafChangeHandler,`onActiveLeafChangeEventHandler`, leaf);
    //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/723

    if (leaf.view && leaf.view.getViewType() === "pdf") {
      this.plugin.lastPDFLeafID = leaf.id;
    }

    if(this.leafChangeTimeout) {
      window.clearTimeout(this.leafChangeTimeout);
    }
    this.leafChangeTimeout = window.setTimeout(()=>{this.leafChangeTimeout = null;},1000);

    if(this.settings.overrideObsidianFontSize) {
      if(leaf.view && (leaf.view.getViewType() === VIEW_TYPE_EXCALIDRAW)) {
        document.documentElement.style.fontSize = "";
      } 
    }

    const previouslyActiveEV = this.activeExcalidrawView;
    const newActiveviewEV: ExcalidrawView =
      leaf.view instanceof ExcalidrawView ? leaf.view : null;
    this.activeExcalidrawView = newActiveviewEV;
    const previousFile = (this.previouslyActiveLeaf?.view as FileView)?.file;
    const currentFile = (leaf?.view as FileView).file;
    //editing the same file in a different leaf
    if(currentFile && (previousFile === currentFile)) {
      if((this.previouslyActiveLeaf.view instanceof MarkdownView   && leaf.view instanceof ExcalidrawView)) {
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

    //!Temporary hack
    //https://discord.com/channels/686053708261228577/817515900349448202/1031101635784613968
    if (DEVICE.isMobile && newActiveviewEV && !previouslyActiveEV) {
      const navbar = document.querySelector("body>.app-container>.mobile-navbar");
      if(navbar && navbar instanceof HTMLDivElement) {
        navbar.style.position="relative";
      }
    }

    if (DEVICE.isMobile && !newActiveviewEV && previouslyActiveEV) {
      const navbar = document.querySelector("body>.app-container>.mobile-navbar");
      if(navbar && navbar instanceof HTMLDivElement) {
        navbar.style.position="";
      }
    }

    //----------------------
    //----------------------

    if (previouslyActiveEV && previouslyActiveEV !== newActiveviewEV) {
      if (previouslyActiveEV.leaf !== leaf) {
        //if loading new view to same leaf then don't save. Excalidarw view will take care of saving anyway.
        //avoid double saving
        if(previouslyActiveEV?.isDirty() && !previouslyActiveEV.semaphores?.viewunload) {
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
        setTimeout(() => {
          if (!newActiveviewEV || !newActiveviewEV._loaded) {
            return;
          }
          if (newActiveviewEV.file?.path !== f?.path) {
            return;
          }
          if (newActiveviewEV.activeLoader) {
            return;
          }
          newActiveviewEV.loadSceneFiles();
        }, 2000);
      } //refresh embedded files
    }

    
    if (
      newActiveviewEV && newActiveviewEV._loaded &&
      newActiveviewEV.isLoaded && newActiveviewEV.excalidrawAPI &&
      this.ea.onCanvasColorChangeHook
    ) {
      this.ea.onCanvasColorChangeHook(
        this.ea,
        newActiveviewEV,
        newActiveviewEV.excalidrawAPI.getAppState().viewBackgroundColor
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
      e.target && ((e.target as Element).className === "excalidraw__canvas" ||
      getParentOfClass((e.target as Element),"excalidraw-wrapper"))
    ) {
      return;
    }
    this.activeExcalidrawView.save();
  }

  private onFileMenuSaveActiveDrawing () {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.onFileMenuSaveActiveDrawing,`onFileMenuSaveActiveDrawing`);
    if (
      !this.activeExcalidrawView ||
      !this.activeExcalidrawView?.isDirty()
    ) {
      return;
    }
    this.activeExcalidrawView.save();
  };

  private onFileMenuHandler(menu: Menu, file: TFile, source: string, leaf: WorkspaceLeaf) {
    (process.env.NODE_ENV === 'development') && DEBUGGING && debug(this.onFileMenuHandler, `EventManager.onFileMenuHandler`, file, source, leaf);
    if (!leaf) return;
    const view = leaf.view;
    if(!view || !(view instanceof MarkdownView)) return;
    if (!(file instanceof TFile)) return;
    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache?.frontmatter || !cache.frontmatter[FRONTMATTER_KEYS["plugin"].name]) return;
    
    menu.addItem(item => {
      item
      .setTitle(t("OPEN_AS_EXCALIDRAW"))
      .setIcon(ICON_NAME)
      .setSection("pane")
      .onClick(async () => {
        await view.save();
        this.plugin.excalidrawFileModes[leaf.id || file.path] = VIEW_TYPE_EXCALIDRAW;
        setExcalidrawView(leaf);
      })});
    menu.items.unshift(menu.items.pop());
  }

  private onEditorMenuHandler(menu: Menu, editor: Editor, view: MarkdownView) {
    if(!view || !(view instanceof MarkdownView)) return;
    const file = view.file;
    const leaf = view.leaf;
    if (!view.file) return;
    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache?.frontmatter || !cache.frontmatter[FRONTMATTER_KEYS["plugin"].name]) return;
    
    menu.addItem(item => item
      .setTitle(t("OPEN_AS_EXCALIDRAW"))
      .setIcon(ICON_NAME)
      .setSection("excalidraw")
      .onClick(async () => {
        await view.save();
        this.plugin.excalidrawFileModes[leaf.id || file.path] = VIEW_TYPE_EXCALIDRAW;
        setExcalidrawView(leaf);
      })
    );
  }
}