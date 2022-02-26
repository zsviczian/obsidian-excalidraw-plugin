import {
  TextFileView,
  WorkspaceLeaf,
  normalizePath,
  TFile,
  WorkspaceItem,
  Notice,
  Menu,
  MarkdownView,
} from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom";
import Excalidraw, { getSceneVersion } from "@zsviczian/excalidraw";
import {
  ExcalidrawElement,
  ExcalidrawImageElement,
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
} from "@zsviczian/excalidraw/types/element/types";
import {
  AppState,
  BinaryFileData,
  ExcalidrawImperativeAPI,
  LibraryItems,
} from "@zsviczian/excalidraw/types/types";
import {
  VIEW_TYPE_EXCALIDRAW,
  ICON_NAME,
  DISK_ICON_NAME,
  SCRIPTENGINE_ICON_NAME,
  PNG_ICON_NAME,
  SVG_ICON_NAME,
  FRONTMATTER_KEY,
  TEXT_DISPLAY_RAW_ICON_NAME,
  TEXT_DISPLAY_PARSED_ICON_NAME,
  FULLSCREEN_ICON_NAME,
  IMAGE_TYPES,
  CTRL_OR_CMD,
  REG_LINKINDEX_INVALIDCHARS,
  KEYCODE,
  LOCAL_PROTOCOL,
} from "./constants";
import ExcalidrawPlugin from "./main";
import { repositionElementsToCursor } from "./ExcalidrawAutomate";
import { t } from "./lang/helpers";
import {
  ExcalidrawData,
  REG_LINKINDEX_HYPERLINK,
  REGEX_LINK,
} from "./ExcalidrawData";
import {
  checkAndCreateFolder,
  checkExcalidrawVersion,
  //debug,
  download,
  embedFontsInSVG,
  errorlog,
  //getBakPath,
  getIMGFilename,
  getNewOrAdjacentLeaf,
  getNewUniqueFilepath,
  getPNG,
  getSVG,
  rotatedDimensions,
  scaleLoadedImage,
  splitFolderAndFilename,
  svgToBase64,
  viewportCoordsToSceneCoords,
} from "./Utils";
import { NewFileActions, Prompt } from "./Prompt";
import { ClipboardData } from "@zsviczian/excalidraw/types/clipboard";
import { updateEquation } from "./LaTeX";
import {
  EmbeddedFile,
  EmbeddedFilesLoader,
  FileData,
} from "./EmbeddedFileLoader";
import { ScriptInstallPrompt } from "./ScriptInstallPrompt";
import { ObsidianMenu, ToolsPanel } from "./ObsidianMenu";

export enum TextMode {
  parsed,
  raw,
}

interface WorkspaceItemExt extends WorkspaceItem {
  containerEl: HTMLElement;
}

export interface ExportSettings {
  withBackground: boolean;
  withTheme: boolean;
}

export const addFiles = async (
  files: FileData[],
  view: ExcalidrawView,
  isDark?: boolean,
) => {
  if (!files || files.length === 0 || !view) {
    return;
  }
  files = files.filter((f) => f.size.height > 0 && f.size.width > 0); //height will be zero when file does not exisig in case of broken embedded file links
  if (files.length === 0) {
    return;
  }
  const s = scaleLoadedImage(view.getScene(), files);
  if (isDark === undefined) {
    isDark = s.scene.appState.theme;
  }
  if (s.dirty) {
    //debug({where:"ExcalidrawView.addFiles",file:view.file.name,dataTheme:view.excalidrawData.scene.appState.theme,before:"updateScene",state:scene.appState})
    view.excalidrawAPI.updateScene({
      elements: s.scene.elements,
      appState: s.scene.appState,
      commitToHistory: false,
    });
  }
  for (const f of files) {
    if (view.excalidrawData.hasFile(f.id)) {
      const embeddedFile = view.excalidrawData.getFile(f.id);

      embeddedFile.setImage(
        f.dataURL,
        f.mimeType,
        f.size,
        isDark,
        f.hasSVGwithBitmap,
      );
    }
    if (view.excalidrawData.hasEquation(f.id)) {
      const latex = view.excalidrawData.getEquation(f.id).latex;
      view.excalidrawData.setEquation(f.id, { latex, isLoaded: true });
    }
  }
  view.excalidrawAPI.addFiles(files);
};

export default class ExcalidrawView extends TextFileView {
  public excalidrawData: ExcalidrawData;
  public getScene: Function = null;
  public addElements: Function = null; //add elements to the active Excalidraw drawing
  private getSelectedTextElement: Function = null;
  private getSelectedImageElement: Function = null;
  public addText: Function = null;
  private refresh: Function = null;
  public excalidrawRef: React.MutableRefObject<any> = null;
  public excalidrawAPI: any = null;
  public excalidrawWrapperRef: React.MutableRefObject<any> = null;
  public toolsPanelRef: React.MutableRefObject<any> = null;
  private justLoaded: boolean = false;
  private preventAutozoomOnLoad: boolean = false;
  public plugin: ExcalidrawPlugin;
  private dirty: string = null;
  public autosaveTimer: any = null;
  public autosaving: boolean = false;
  public textMode: TextMode = TextMode.raw;
  private textIsParsed_Element: HTMLElement;
  private textIsRaw_Element: HTMLElement;
  private preventReload: boolean = true;
  public compatibilityMode: boolean = false;
  private obsidianMenu: ObsidianMenu;
  //store key state for view mode link resolution
  /*private ctrlKeyDown = false;
  private shiftKeyDown = false;
  private altKeyDown = false;*/

  //https://stackoverflow.com/questions/27132796/is-there-any-javascript-event-fired-when-the-on-screen-keyboard-on-mobile-safari
  private isEditingText: boolean = false;
  private isEditingTextResetTimer: NodeJS.Timeout = null;

  id: string = (this.leaf as any).id;

  constructor(leaf: WorkspaceLeaf, plugin: ExcalidrawPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.excalidrawData = new ExcalidrawData(plugin);
  }

  public saveExcalidraw(scene?: any) {
    if (!scene) {
      if (!this.getScene) {
        return false;
      }
      scene = this.getScene();
    }
    const filepath = `${this.file.path.substring(
      0,
      this.file.path.lastIndexOf(".md"),
    )}.excalidraw`;
    const file = this.app.vault.getAbstractFileByPath(normalizePath(filepath));
    if (file && file instanceof TFile) {
      this.app.vault.modify(file, JSON.stringify(scene, null, "\t"));
    } else {
      this.app.vault.create(filepath, JSON.stringify(scene, null, "\t"));
    }
  }

  public async exportExcalidraw() {
    if (!this.getScene || !this.file) {
      return;
    }
    //@ts-ignore
    if (this.app.isMobile) {
      const prompt = new Prompt(
        this.app,
        "Please provide filename",
        this.file.basename,
        "filename, leave blank to cancel action",
      );
      prompt.openAndGetValue(async (filename: string) => {
        if (!filename) {
          return;
        }
        filename = `${filename}.excalidraw`;
        const folderpath = splitFolderAndFilename(
          this.file.path,
        ).folderpath;
        await checkAndCreateFolder(this.app.vault, folderpath); //create folder if it does not exist
        const fname = getNewUniqueFilepath(
          this.app.vault,
          filename,
          folderpath,
        );
        this.app.vault.create(
          fname,
          JSON.stringify(this.getScene(), null, "\t"),
        );
        new Notice(`Exported to ${fname}`, 6000);
      });
      return;
    }
    download(
      "data:text/plain;charset=utf-8",
      encodeURIComponent(JSON.stringify(this.getScene(), null, "\t")),
      `${this.file.basename}.excalidraw`,
    );
  }

  public async saveSVG(scene?: any) {
    if (!scene) {
      if (!this.getScene) {
        return false;
      }
      scene = this.getScene();
    }
    const filepath = getIMGFilename(this.file.path, "svg"); //.substring(0,this.file.path.lastIndexOf(this.compatibilityMode ? '.excalidraw':'.md')) + '.svg';
    const file = this.app.vault.getAbstractFileByPath(normalizePath(filepath));
    const exportSettings: ExportSettings = {
      withBackground: this.plugin.settings.exportWithBackground,
      withTheme: this.plugin.settings.exportWithTheme,
    };
    const svg = await getSVG (
      scene,
      exportSettings,
      this.plugin.settings.exportPaddingSVG,  
    );
    if (!svg) {
      return;
    }
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(
      embedFontsInSVG(svg, this.plugin),
    );
    if (file && file instanceof TFile) {
      await this.app.vault.modify(file, svgString);
    } else {
      await this.app.vault.create(filepath, svgString);
    }
  }

  public async savePNG(scene?: any) {
    if (!scene) {
      if (!this.getScene) {
        return false;
      }
      scene = this.getScene();
    }

    const filepath = getIMGFilename(this.file.path, "png"); //this.file.path.substring(0,this.file.path.lastIndexOf(this.compatibilityMode ? '.excalidraw':'.md')) + '.png';
    const file = this.app.vault.getAbstractFileByPath(normalizePath(filepath));

    const exportSettings: ExportSettings = {
      withBackground: this.plugin.settings.exportWithBackground,
      withTheme: this.plugin.settings.exportWithTheme,
    };
    const png = await getPNG(
      scene,
      exportSettings,
      this.plugin.settings.pngExportScale,
    );
    if (!png) {
      return;
    }
    if (file && file instanceof TFile) {
      await this.app.vault.modifyBinary(file, await png.arrayBuffer());
    } else {
      await this.app.vault.createBinary(filepath, await png.arrayBuffer());
    }
  }

  //Save is triggered by multiple threads when an Excalidraw pane is terminated
  //- by the view itself
  //- by the activeLeafChangeEventHandler change event handler
  //- by monkeypatches on detach(next)
  //This semaphore helps avoid collision of saves
  private preventSave:boolean = false; //this.saving is taken by Obsidian. When I set this, nothing got saved at all.
  async save(preventReload: boolean = true, forcesave: boolean = false) {
    if(this.preventSave) {
      return;
    }
    this.preventSave = true;

    if (!this.getScene) {
      this.preventSave = false;
      return;
    }
    if (!this.isLoaded) {
      this.preventSave = false;
      return;
    }
    if(!this.file || !this.app.vault.getAbstractFileByPath(this.file.path)) {
      this.preventSave = false;
      return; //file was recently deleted
    }

    this.preventReload = preventReload;
    const allowSave = (this.dirty !== null && this.dirty) || this.autosaving || forcesave; //dirty == false when view.file == null;
    this.dirty = null;
    const scene = this.getScene();

    if (this.compatibilityMode) {
      await this.excalidrawData.syncElements(scene);
    } else if (
      (await this.excalidrawData.syncElements(scene)) &&
      !this.autosaving
    ) {
      await this.loadDrawing(false);
    }

    //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/396
    /*const bakfilepath = getBakPath(this.file);
    try {
      if (await this.app.vault.adapter.exists(bakfilepath)) {
        await this.app.vault.adapter.remove(bakfilepath);
      }
      await this.app.vault.adapter.copy(this.file.path, bakfilepath);
    } catch(e) {
      console.error({where: "ExcalidrawView.save copy backup file", error: e});
    }*/

    if(allowSave) {
      await super.save();
      this.diskIcon.querySelector("svg").removeClass("excalidraw-dirty");
    }
    /*try {
      await this.app.vault.adapter.remove(bakfilepath);
    } catch(e) {
      console.error({where: "ExcalidrawView.save removing backup file", error: e});
    }*/

    if (!this.autosaving) {
      if (this.plugin.settings.autoexportSVG) {
        await this.saveSVG();
      }
      if (this.plugin.settings.autoexportPNG) {
        await this.savePNG();
      }
      if (
        !this.compatibilityMode &&
        this.plugin.settings.autoexportExcalidraw
      ) {
        this.saveExcalidraw();
      }
    }
    this.preventSave = false;
  }

  // get the new file content
  // if drawing is in Text Element Edit Lock, then everything should be parsed and in sync
  // if drawing is in Text Element Edit Unlock, then everything is raw and parse and so an async function is not required here
  getViewData() {
    //console.log("ExcalidrawView.getViewData()");
    if (!this.getScene) {
      return this.data;
    }
    if (!this.excalidrawData.loaded) {
      return this.data;
    }
    const scene = this.getScene();
    if (!this.compatibilityMode) {
      let trimLocation = this.data.search(/(^%%\n)?# Text Elements\n/m);
      if (trimLocation == -1) {
        trimLocation = this.data.search(/(%%\n)?# Drawing\n/);
      }
      if (trimLocation == -1) {
        return this.data;
      }

      let header = this.data
        .substring(0, trimLocation)
        .replace(
          /excalidraw-plugin:\s.*\n/,
          `${FRONTMATTER_KEY}: ${
            this.textMode == TextMode.raw ? "raw\n" : "parsed\n"
          }`,
        );

      //this should be removed at a later time. Left it here to remediate 1.4.9 mistake
      const REG_IMG = /(^---[\w\W]*?---\n)(!\[\[.*?]]\n(%%\n)?)/m; //(%%\n)? because of 1.4.8-beta... to be backward compatible with anyone who installed that version
      if (header.match(REG_IMG)) {
        header = header.replace(REG_IMG, "$1");
      }
      //end of remove
      if(!this.excalidrawData.disableCompression) {
        this.excalidrawData.disableCompression = this.isEditedAsMarkdownInOtherView();
      }
      const reuslt = header + this.excalidrawData.generateMD();
      this.excalidrawData.disableCompression = false;
      return reuslt;
    }
    if (this.compatibilityMode) {
      return JSON.stringify(scene, null, "\t");
    }
    return this.data;
  }

  addFullscreenchangeEvent() {
    //excalidrawWrapperRef.current
    this.contentEl.onfullscreenchange = () => {
      if (this.plugin.settings.zoomToFitOnResize) {
        this.zoomToFit();
      }
      if (!this.isFullscreen()) {
        this.clearFullscreenObserver();
        this.contentEl.removeAttribute("style");
      }
      if (this.toolsPanelRef && this.toolsPanelRef.current) {
        this.toolsPanelRef.current.setFullscreen(this.isFullscreen());
      }
    };
  }

  fullscreenModalObserver: MutationObserver = null;
  gotoFullscreen() {
    if (!this.excalidrawWrapperRef) {
      return;
    }
    this.contentEl.requestFullscreen(); //{navigationUI: "hide"});
    this.excalidrawWrapperRef.current.firstElementChild?.focus();
    this.contentEl.setAttribute("style", "padding:0px;margin:0px;");
    if (this.toolsPanelRef && this.toolsPanelRef.current) {
      this.toolsPanelRef.current.setFullscreen(true);
    }

    this.fullscreenModalObserver = new MutationObserver((m) => {
      if (m.length !== 1) {
        return;
      }
      if (!m[0].addedNodes || m[0].addedNodes.length !== 1) {
        return;
      }
      const node: Node = m[0].addedNodes[0];
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }
      const element = node as HTMLElement;
      if (!element.classList.contains("modal-container")) {
        return;
      }
      this.contentEl.appendChild(element);
      element.querySelector("input").focus();
    });

    this.fullscreenModalObserver.observe(document.body, {
      childList: true,
      subtree: false,
    });
  }

  clearFullscreenObserver() {
    if (this.fullscreenModalObserver) {
      this.fullscreenModalObserver.disconnect();
      this.fullscreenModalObserver = null;
    }
  }

  isFullscreen(): boolean {
    return (
      document.fullscreenEnabled &&
      document.fullscreenElement === this.contentEl // excalidrawWrapperRef?.current
    ); //this.contentEl;
  }

  exitFullscreen() {
    document.exitFullscreen();
    if (this.toolsPanelRef && this.toolsPanelRef.current) {
      this.toolsPanelRef.current.setFullscreen(true);
    }
  }

  async handleLinkClick(view: ExcalidrawView, ev: MouseEvent) {
    const selectedText = this.getSelectedTextElement();
    let file = null;
    let lineNum = 0;
    let linkText: string = null;

    if (selectedText?.id) {
      linkText =
        this.textMode === TextMode.parsed
          ? this.excalidrawData.getRawText(selectedText.id)
          : selectedText.text;

      if (!linkText) {
        return;
      }
      linkText = linkText.replaceAll("\n", ""); //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/187
      if (linkText.match(REG_LINKINDEX_HYPERLINK)) {
        window.open(linkText, "_blank");
        return;
      }

      const parts = REGEX_LINK.getRes(linkText).next();
      if (!parts.value) {
        const tags = linkText
          .matchAll(/#([\p{Letter}\p{Emoji_Presentation}\p{Number}\/_-]+)/gu)
          .next();
        if (!tags.value || tags.value.length < 2) {
          new Notice(t("TEXT_ELEMENT_EMPTY"), 4000);
          return;
        }
        const search = this.app.workspace.getLeavesOfType("search");
        if (search.length == 0) {
          return;
        }
        //@ts-ignore
        search[0].view.setQuery(`tag:${tags.value[1]}`);
        this.app.workspace.revealLeaf(search[0]);

        if (this.isFullscreen()) {
          this.exitFullscreen();
        }
        return;
      }

      linkText = REGEX_LINK.getLink(parts);

      if (linkText.match(REG_LINKINDEX_HYPERLINK)) {
        window.open(linkText, "_blank");
        return;
      }

      if (linkText.search("#") > -1) {
        lineNum = (await this.excalidrawData.getTransclusion(linkText)).lineNum;
        linkText = linkText.substring(0, linkText.search("#"));
      }
      if (linkText.match(REG_LINKINDEX_INVALIDCHARS)) {
        new Notice(t("FILENAME_INVALID_CHARS"), 4000);
        return;
      }
      file = view.app.metadataCache.getFirstLinkpathDest(
        linkText,
        view.file.path,
      );
    } else {
      const selectedImage = this.getSelectedImageElement();
      if (selectedImage?.id) {
        if (this.excalidrawData.hasEquation(selectedImage.fileId)) {
          const equation = this.excalidrawData.getEquation(
            selectedImage.fileId,
          ).latex;
          const prompt = new Prompt(this.app, t("ENTER_LATEX"), equation, "");
          prompt.openAndGetValue(async (formula: string) => {
            if (!formula) {
              return;
            }
            this.excalidrawData.setEquation(selectedImage.fileId, {
              latex: formula,
              isLoaded: false,
            });
            await this.save(true);
            await updateEquation(
              formula,
              selectedImage.fileId,
              this,
              addFiles,
              this.plugin,
            );
          });
          return;
        }
        await this.save(true); //in case pasted images haven't been saved yet
        if (this.excalidrawData.hasFile(selectedImage.fileId)) {
          if (ev.altKey) {
            const ef = this.excalidrawData.getFile(selectedImage.fileId);
            if (
              ef.file.extension === "md" &&
              !this.plugin.isExcalidrawFile(ef.file)
            ) {
              const prompt = new Prompt(
                this.app,
                "Customize the link",
                ef.linkParts.original,
                "",
                "Do not add [[square brackets]] around the filename!<br>Follow this format when editing your link:<br><mark>filename#^blockref|WIDTHxMAXHEIGHT</mark>",
              );
              prompt.openAndGetValue(async (link: string) => {
                if (!link) {
                  return;
                }
                ef.resetImage(this.file.path, link);
                await this.save(true);
                await this.loadSceneFiles();
              });
              return;
            }
          }
          linkText = this.excalidrawData.getFile(selectedImage.fileId).file
            .path;
          file = this.excalidrawData.getFile(selectedImage.fileId).file;
        }
      }
    }
    
    if (!linkText) {
      new Notice(t("LINK_BUTTON_CLICK_NO_TEXT"), 20000);
      return;
    }

    try {
      if (ev.shiftKey && this.isFullscreen()) {
        this.exitFullscreen();
      }
      if (!file) {
        (new NewFileActions(this.plugin,linkText,ev.shiftKey,view)).open();
        return;
      }
      const leaf = ev.shiftKey
        ? getNewOrAdjacentLeaf(this.plugin, view.leaf)
        : view.leaf;
      leaf.openFile(file, { eState: { line: lineNum - 1 } }); //if file exists open file and jump to reference
      view.app.workspace.setActiveLeaf(leaf,true,true);
    } catch (e) {
      new Notice(e, 4000);
    }
  }

  onResize() {
    if (!this.plugin.settings.zoomToFitOnResize) {
      return;
    }
    if (!this.excalidrawRef) {
      return;
    }
    if (this.isEditingText) {
      return;
    }
    //final fallback to prevent resizing when text element is in edit mode
    //this is to prevent jumping text due to on-screen keyboard popup
    if (this.excalidrawAPI?.getAppState()?.editingElement?.type === "text") {
      return;
    }
    this.zoomToFit(false);
  }

  diskIcon: HTMLElement;
  onload() {
    this.addAction(SCRIPTENGINE_ICON_NAME, t("INSTALL_SCRIPT_BUTTON"), () => {
      new ScriptInstallPrompt(this.plugin).open();
    });

    this.diskIcon = this.addAction(DISK_ICON_NAME, t("FORCE_SAVE"), async () => {
      await this.save(false, true);
      this.plugin.triggerEmbedUpdates();
      this.loadSceneFiles();
    });

    this.textIsRaw_Element = this.addAction(
      TEXT_DISPLAY_RAW_ICON_NAME,
      t("RAW"),
      () => this.changeTextMode(TextMode.parsed),
    );
    this.textIsParsed_Element = this.addAction(
      TEXT_DISPLAY_PARSED_ICON_NAME,
      t("PARSED"),
      () => this.changeTextMode(TextMode.raw),
    );

    this.addAction("link", t("OPEN_LINK"), (ev) =>
      this.handleLinkClick(this, ev),
    );

    if (!this.app.isMobile) {
      this.addAction(
        FULLSCREEN_ICON_NAME,
        "Press ESC to exit fullscreen mode",
        () => this.gotoFullscreen(),
      );
    }

    //this is to solve sliding panes bug
    if (this.app.workspace.layoutReady) {
      (
        this.app.workspace.rootSplit as WorkspaceItem as WorkspaceItemExt
      ).containerEl.addEventListener("scroll", () => {
        if (this.refresh) {
          this.refresh();
        }
      });
    } else {
      this.app.workspace.onLayoutReady(async () =>
        (
          this.app.workspace.rootSplit as WorkspaceItem as WorkspaceItemExt
        ).containerEl.addEventListener("scroll", () => {
          if (this.refresh) {
            this.refresh();
          }
        }),
      );
    }
    this.setupAutosaveTimer();
    this.contentEl.addClass("excalidraw-view");
  }

  public setTheme(theme: string) {
    if (!this.excalidrawRef) {
      return;
    }
    const st: AppState = this.excalidrawAPI.getAppState();
    this.excalidrawData.scene.theme = theme;
    //debug({where:"ExcalidrawView.setTheme",file:this.file.name,dataTheme:this.excalidrawData.scene.appState.theme,before:"updateScene"});
    this.excalidrawAPI.updateScene({
      appState: {
        ...st,
        theme,
      },
      commitToHistory: false,
    });
  }

  public async changeTextMode(textMode: TextMode, reload: boolean = true) {
    this.textMode = textMode;
    if (textMode === TextMode.parsed) {
      this.textIsRaw_Element.hide();
      this.textIsParsed_Element.show();
    } else {
      this.textIsRaw_Element.show();
      this.textIsParsed_Element.hide();
    }
    if(this.toolsPanelRef && this.toolsPanelRef.current) {
      this.toolsPanelRef.current.setPreviewMode(textMode === TextMode.parsed);
    }
    if (reload) {
      await this.save(false,true);
      this.updateContainerSize();
      this.excalidrawAPI.history.clear(); //to avoid undo replacing links with parsed text
    }
  }

  public setupAutosaveTimer() {
    const timer = async () => {
      if (
        this.isLoaded &&
        this.dirty && 
        this.dirty == this.file?.path &&
        this.plugin.settings.autosave
      ) {
        this.dirty = null;
        this.autosaving = true;
        if (this.excalidrawRef) {
          await this.save();
        }
        this.autosaving = false;
      }
    };
    if (this.autosaveTimer) {
      clearInterval(this.autosaveTimer);
    } // clear previous timer if one exists
    if(this.plugin.settings.autosave) {
      this.autosaveTimer = setInterval(timer, this.plugin.settings.autosaveInterval);
    }
  }

  //save current drawing when user closes workspace leaf
  async onunload() {
    const tooltip = document.body.querySelector("body>div.excalidraw-tooltip,div.excalidraw-tooltip--visible");
    if(tooltip) {
      document.body.removeChild(tooltip);
    }
    if (this.autosaveTimer) {
      clearInterval(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    if (this.fullscreenModalObserver) {
      this.fullscreenModalObserver.disconnect();
      this.fullscreenModalObserver = null;
    }
  }

  public async reload(fullreload: boolean = false, file?: TFile) {
    if (this.preventReload) {
      this.preventReload = false;
      return;
    }
    this.diskIcon.querySelector("svg").removeClass("excalidraw-dirty");
    if (this.compatibilityMode) {
      this.dirty = null;
      return;
    }
    if (!this.excalidrawRef) {
      return;
    }
    if (!this.file) {
      return;
    }
    const loadOnModifyTrigger = (file && file === this.file);
    if (loadOnModifyTrigger) {
      this.data = await this.app.vault.cachedRead(file);
      this.preventAutozoomOnLoad = true;
    }
    if (fullreload) {
      await this.excalidrawData.loadData(this.data, this.file, this.textMode);
    } else {
      await this.excalidrawData.setTextMode(this.textMode);
    }
    this.excalidrawData.scene.appState.theme =
      this.excalidrawAPI.getAppState().theme;
    await this.loadDrawing(loadOnModifyTrigger);
    this.dirty = null;
  }

  // clear the view content
  clear() {
    if (!this.excalidrawRef) {
      return;
    }
    if (this.activeLoader) {
      this.activeLoader.terminate = true;
    }
    this.nextLoader = null;
    this.excalidrawAPI.resetScene();
    this.excalidrawAPI.history.clear();
  }

  private isLoaded: boolean = false;
  async setViewData(data: string, clear: boolean = false) {
    checkExcalidrawVersion(this.app);
    this.isLoaded = false;
    if (clear) {
      this.clear();
    }
    data = this.data = data.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
    this.app.workspace.onLayoutReady(async () => {
      this.compatibilityMode = this.file.extension === "excalidraw";
      await this.plugin.loadSettings();
      if (this.compatibilityMode) {
        this.textIsRaw_Element.hide();
        this.textIsParsed_Element.hide();
        await this.excalidrawData.loadLegacyData(data, this.file);
        if (!this.plugin.settings.compatibilityMode) {
          new Notice(t("COMPATIBILITY_MODE"), 4000);
        }
        this.excalidrawData.disableCompression = true;
      } else {
        this.excalidrawData.disableCompression = false;
        const textMode = getTextMode(data);
        this.changeTextMode(textMode, false);
        try {
          if (
            !(await this.excalidrawData.loadData(
              data,
              this.file,
              this.textMode,
            ))
          ) {
            return;
          }
        } catch (e) {
          errorlog({ where: "ExcalidrawView.setViewData", error: e });
          new Notice(
            `Error loading drawing:\n${e.message}${
              e.message === "Cannot read property 'index' of undefined"
                ? "\n'# Drawing' section is likely missing"
                : ""
            }\n\nTry manually fixing the file or restoring an earlier version from sync history.\n\nYou may also look for the backup file with last working version in the same folder (same filename as your drawing, but starting with a dot. e.g. <code>drawing.md</code> => <code>.drawing.md.bak</code>). Note the backup files do not get synchronized, so look for the backup file on other devices as well.`,
            10000,
          );
          this.setMarkdownView();
          return;
        }
      }
      await this.loadDrawing(true);
      this.isLoaded = true;
    });
  }

  public activeLoader: EmbeddedFilesLoader = null;
  private nextLoader: EmbeddedFilesLoader = null;
  public async loadSceneFiles() {
    const loader = new EmbeddedFilesLoader(this.plugin);

    const runLoader = (l: EmbeddedFilesLoader) => {
      this.nextLoader = null;
      this.activeLoader = l;
      l.loadSceneFiles(
        this.excalidrawData,
        (files: FileData[], isDark: boolean) => {
          if (!files) {
            return;
          }
          addFiles(files, this, isDark);
          this.activeLoader = null;
          if (this.nextLoader) {
            runLoader(this.nextLoader);
          }
        },
      );
    };
    if (!this.activeLoader) {
      runLoader(loader);
    } else {
      this.nextLoader = loader;
    }
  }

  setDefaultTrayMode() {
    const om = this.excalidrawData.getOpenMode();
    if(om.zenModeEnabled || om.viewModeEnabled) return;
    setTimeout(()=> {
      if(!this.excalidrawAPI) return;
      const st = this.excalidrawAPI.getAppState();
      st.trayModeEnabled = this.plugin.settings.defaultTrayMode;
      this.excalidrawAPI.updateScene({appState:st});
    }, 150);
  }

  initialContainerSizeUpdate = false;
  /**
   *
   * @param justloaded - a flag to trigger zoom to fit after the drawing has been loaded
   */
  private async loadDrawing(justloaded: boolean) {
    const excalidrawData = this.excalidrawData.scene;
    this.justLoaded = justloaded;
    this.initialContainerSizeUpdate =justloaded;
    this.dirty = null;
    this.diskIcon.querySelector("svg").removeClass("excalidraw-dirty");
    const om = this.excalidrawData.getOpenMode();
    this.preventReload = false;   
    if (this.excalidrawRef) {
      //isLoaded flags that a new file is being loaded, isLoaded will be true after loadDrawing completes
      const viewModeEnabled = !this.isLoaded
        ? om.viewModeEnabled
        : this.excalidrawAPI.getAppState().viewModeEnabled;
      const zenModeEnabled = !this.isLoaded
        ? om.zenModeEnabled
        : this.excalidrawAPI.getAppState().zenModeEnabled;
      //debug({where:"ExcalidrawView.loadDrawing",file:this.file.name,dataTheme:excalidrawData.appState.theme,before:"updateScene"})
      this.excalidrawAPI.setLocalFont(
        this.plugin.settings.experimentalEnableFourthFont,
      );

      this.excalidrawAPI.updateScene({
        elements: excalidrawData.elements,
        appState: {
          ...excalidrawData.appState,
          zenModeEnabled,
          viewModeEnabled,
          linkOpacity: this.plugin.settings.linkOpacity,
        },
        files: excalidrawData.files,
        commitToHistory: true,
      });
      if (
        this.app.workspace.activeLeaf === this.leaf &&
        this.excalidrawWrapperRef
      ) {
        //.firstElmentChild solves this issue: https://github.com/zsviczian/obsidian-excalidraw-plugin/pull/346
        this.excalidrawWrapperRef.current?.firstElementChild?.focus();
      }
      //debug({where:"ExcalidrawView.loadDrawing",file:this.file.name,before:"this.loadSceneFiles"});
      this.loadSceneFiles();
      this.updateContainerSize(null, true);
      this.setDefaultTrayMode();
      this.initializeToolsIconPanelAfterLoading();
    } else {
      this.instantiateExcalidraw({
        elements: excalidrawData.elements,
        appState: {
          ...excalidrawData.appState,
          zenModeEnabled: om.zenModeEnabled,
          viewModeEnabled: om.viewModeEnabled,
          linkOpacity: this.plugin.settings.linkOpacity,
        },
        files: excalidrawData.files,
        libraryItems: await this.getLibrary(),
      });
      //files are loaded on excalidrawRef readyPromise
    }
    const isCompressed = this.data.match(/```compressed\-json\n/gm) !== null;

    if(
      !this.compatibilityMode && 
      (this.plugin.settings.compress !== isCompressed) &&
      !this.isEditedAsMarkdownInOtherView()
    ) {
      this.dirty = this.file?.path;
      this.diskIcon.querySelector("svg").addClass("excalidraw-dirty");
    }
  }

  isEditedAsMarkdownInOtherView():boolean {
    //if the user is editing the same file in markdown mode, do not compress it
    const leaves = this.app.workspace.getLeavesOfType("markdown");
    return leaves
      .filter(leaf => (leaf.view as MarkdownView).file === this.file)
      .length > 0;
  }

  public initializeToolsIconPanelAfterLoading() {
    const st = this.excalidrawAPI?.getAppState();
    const panel = this.toolsPanelRef?.current;
    if(!panel) return;
    panel.setTheme(st.theme);
    panel.setExcalidrawViewMode(st.viewModeEnabled);
    panel.setPreviewMode(this.compatibilityMode ? null : this.textMode === TextMode.parsed);
    panel.updateScriptIconMap(this.plugin.scriptEngine.scriptIconMap);
  }

  //Compatibility mode with .excalidraw files
  canAcceptExtension(extension: string) {
    return extension == "excalidraw";
  }

  // gets the title of the document
  getDisplayText() {
    if (this.file) {
      return this.file.basename;
    }
    return t("NOFILE");
  }

  // the view type name
  getViewType() {
    return VIEW_TYPE_EXCALIDRAW;
  }

  // icon for the view
  getIcon() {
    return ICON_NAME;
  }

  setMarkdownView() {
    this.plugin.excalidrawFileModes[this.id || this.file.path] = "markdown";
    this.plugin.setMarkdownView(this.leaf);
  }

  public async openAsMarkdown() {
    if(this.plugin.settings.compress === true) {
      this.excalidrawData.disableCompression = true;
      await this.save(true,true);
    }
    this.setMarkdownView();
  }

  public async convertExcalidrawToMD() {
    await this.save();
    this.plugin.openDrawing(
      await this.plugin.convertSingleExcalidrawToMD(this.file),
      false,
    );
  }

  onMoreOptionsMenu(menu: Menu) {
    // Add a menu item to force the board to markdown view
    if (!this.compatibilityMode) {
      menu
        .addItem((item) => {
          item
            .setTitle(t("OPEN_AS_MD"))
            .setIcon("document")
            .onClick(() => {
              this.openAsMarkdown();
            });
        })
        .addItem((item) => {
          item
            .setTitle(t("EXPORT_EXCALIDRAW"))
            .setIcon(ICON_NAME)
            .onClick(async () => {
              this.exportExcalidraw();
            });
        });
    } else {
      menu.addItem((item) => {
        item.setTitle(t("CONVERT_FILE")).onClick(() => 
          this.convertExcalidrawToMD()
        );
      });
    }
    menu
      .addItem((item) => {
        item
          .setTitle(t("SAVE_AS_PNG"))
          .setIcon(PNG_ICON_NAME)
          .onClick(async (ev) => {
            if (!this.getScene || !this.file) {
              return;
            }
            if (ev[CTRL_OR_CMD]) {
              //.ctrlKey||ev.metaKey) {
              const exportSettings: ExportSettings = {
                withBackground: this.plugin.settings.exportWithBackground,
                withTheme: this.plugin.settings.exportWithTheme,
              };
              const png = await getPNG(
                this.getScene(),
                exportSettings,
                this.plugin.settings.pngExportScale,
              );
              if (!png) {
                return;
              }
              const reader = new FileReader();
              reader.readAsDataURL(png);
              const self = this;
              reader.onloadend = function () {
                const base64data = reader.result;
                download(null, base64data, `${self.file.basename}.png`);
              };
              return;
            }
            this.savePNG();
          });
      })
      .addItem((item) => {
        item
          .setTitle(t("SAVE_AS_SVG"))
          .setIcon(SVG_ICON_NAME)
          .onClick(async (ev) => {
            if (!this.getScene || !this.file) {
              return;
            }
            if (ev[CTRL_OR_CMD]) {
              //.ctrlKey||ev.metaKey) {
              const exportSettings: ExportSettings = {
                withBackground: this.plugin.settings.exportWithBackground,
                withTheme: this.plugin.settings.exportWithTheme,
              };
              let svg = await getSVG (
                this.getScene(),
                exportSettings,
                this.plugin.settings.exportPaddingSVG,
              );
              if (!svg) {
                return null;
              }
              svg = embedFontsInSVG(svg, this.plugin);
              download(
                null,
                svgToBase64(svg.outerHTML),
                `${this.file.basename}.svg`,
              );
              return;
            }
            this.saveSVG();
          });
      })
      .addSeparator();
    super.onMoreOptionsMenu(menu);
  }

  async getLibrary() {
    const data: any = this.plugin.getStencilLibrary();
    return data?.library ? data.library : data?.libraryItems ?? [];
  }

  previousSceneVersion = 0;
  private instantiateExcalidraw(initdata: any) {
    //console.log("ExcalidrawView.instantiateExcalidraw()");
    this.dirty = null;
    this.diskIcon.querySelector("svg").removeClass("excalidraw-dirty");
    const reactElement = React.createElement(() => {
      let currentPosition = { x: 0, y: 0 };
      const excalidrawWrapperRef = React.useRef(null);
      const toolsPanelRef = React.useRef(null);
      const [dimensions, setDimensions] = React.useState({
        width: undefined,
        height: undefined,
      });

      this.toolsPanelRef = toolsPanelRef;
      this.obsidianMenu = new ObsidianMenu(this.plugin,toolsPanelRef);


      
      //excalidrawRef readypromise based on
      //https://codesandbox.io/s/eexcalidraw-resolvable-promise-d0qg3?file=/src/App.js:167-760
      const resolvablePromise = () => {
        let resolve;
        let reject;
        const promise = new Promise((_resolve, _reject) => {
          resolve = _resolve;
          reject = _reject;
        });
        //@ts-ignore
        promise.resolve = resolve;
        //@ts-ignore
        promise.reject = reject;
        return promise;
      };

      // To memoize value between rerenders
      const excalidrawRef = React.useMemo(
        () => ({
          current: {
            readyPromise: resolvablePromise(),
          },
        }),
        [],
      );

      React.useEffect(() => {
        excalidrawRef.current.readyPromise.then((api:ExcalidrawImperativeAPI) => {
          this.excalidrawAPI = api;
          //console.log({where:"ExcalidrawView.React.ReadyPromise"});
          //debug({where:"ExcalidrawView.React.useEffect",file:this.file.name,before:"this.loadSceneFiles"});
          this.excalidrawAPI.setLocalFont(
            this.plugin.settings.experimentalEnableFourthFont,
          );
          this.loadSceneFiles();
          this.updateContainerSize(null, true);
          this.setDefaultTrayMode();
          this.excalidrawWrapperRef.current.firstElementChild?.focus();
          this.addFullscreenchangeEvent();
          this.initializeToolsIconPanelAfterLoading();
        });
      }, [excalidrawRef]);

      this.excalidrawRef = excalidrawRef;
      this.excalidrawWrapperRef = excalidrawWrapperRef;

      const setCurrentPositionToCenter = () => {
        if(!excalidrawRef || !excalidrawRef.current) return;
        const st = this.excalidrawAPI.getAppState();
        const {
          width,
          height
        } = st;
        currentPosition = viewportCoordsToSceneCoords({
          clientX: width/2,
          clientY: height/2
        }, st)
      }

      React.useEffect(() => {
        setDimensions({
          width: this.contentEl.clientWidth,
          height: this.contentEl.clientHeight,
        });

        const onResize = () => {
          try {
            setDimensions({
              width: this.contentEl.clientWidth,
              height: this.contentEl.clientHeight,
            });
            if(this.toolsPanelRef && this.toolsPanelRef.current) {
              this.toolsPanelRef.current.updatePosition();
            }
          } catch (err) {
            errorlog({
              where: "Excalidraw React-Wrapper, onResize",
              error: err,
            });
          }
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
      }, [excalidrawWrapperRef]);

      this.getSelectedTextElement = (): { id: string; text: string } => {
        if (!excalidrawRef?.current) {
          return { id: null, text: null };
        }
        if (this.excalidrawAPI.getAppState().viewModeEnabled) {
          if (selectedTextElement) {
            const retval = selectedTextElement;
            selectedTextElement = null;
            return retval;
          }
          return { id: null, text: null };
        }
        const selectedElement = this.excalidrawAPI
          .getSceneElements()
          .filter(
            (el: ExcalidrawElement) =>
              el.id ===
              Object.keys(
                this.excalidrawAPI.getAppState().selectedElementIds,
              )[0],
          );
        if (selectedElement.length === 0) {
          return { id: null, text: null };
        }

        if (selectedElement[0].type === "text") {
          return { id: selectedElement[0].id, text: selectedElement[0].text };
        } //a text element was selected. Return text

        if (selectedElement[0].type === "image") {
          return { id: null, text: null };
        }

        const boundTextElements = selectedElement[0].boundElements?.filter(
          (be: any) => be.type === "text",
        );
        if (boundTextElements?.length > 0) {
          const textElement = this.excalidrawAPI
            .getSceneElements()
            .filter(
              (el: ExcalidrawElement) => el.id === boundTextElements[0].id,
            );
          if (textElement.length > 0) {
            return { id: textElement[0].id, text: textElement[0].text };
          }
        } //is a text container selected?

        if (selectedElement[0].groupIds.length === 0) {
          return { id: null, text: null };
        } //is the selected element part of a group?

        const group = selectedElement[0].groupIds[0]; //if yes, take the first group it is part of
        const textElement = this.excalidrawAPI
          .getSceneElements()
          .filter((el: any) => el.groupIds?.includes(group))
          .filter((el: any) => el.type === "text"); //filter for text elements of the group
        if (textElement.length === 0) {
          return { id: null, text: null };
        } //the group had no text element member

        return { id: selectedElement[0].id, text: selectedElement[0].text }; //return text element text
      };

      this.getSelectedImageElement = (): { id: string; fileId: string } => {
        if (!excalidrawRef?.current) {
          return { id: null, fileId: null };
        }
        if (this.excalidrawAPI.getAppState().viewModeEnabled) {
          if (selectedImageElement) {
            const retval = selectedImageElement;
            selectedImageElement = null;
            return retval;
          }
          return { id: null, fileId: null };
        }
        const selectedElement = this.excalidrawAPI
          .getSceneElements()
          .filter(
            (el: any) =>
              el.id ==
              Object.keys(
                this.excalidrawAPI.getAppState().selectedElementIds,
              )[0],
          );
        if (selectedElement.length === 0) {
          return { id: null, fileId: null };
        }
        if (selectedElement[0].type == "image") {
          return {
            id: selectedElement[0].id,
            fileId: selectedElement[0].fileId,
          };
        } //an image element was selected. Return fileId

        if (selectedElement[0].type === "text") {
          return { id: null, fileId: null };
        }

        if (selectedElement[0].groupIds.length === 0) {
          return { id: null, fileId: null };
        } //is the selected element part of a group?
        const group = selectedElement[0].groupIds[0]; //if yes, take the first group it is part of
        const imageElement = this.excalidrawAPI
          .getSceneElements()
          .filter((el: any) => el.groupIds?.includes(group))
          .filter((el: any) => el.type == "image"); //filter for Image elements of the group
        if (imageElement.length === 0) {
          return { id: null, fileId: null };
        } //the group had no image element member
        return { id: imageElement[0].id, fileId: imageElement[0].fileId }; //return image element fileId
      };

      this.addText = (text: string, fontFamily?: 1 | 2 | 3 | 4) => {
        if (!excalidrawRef?.current) {
          return;
        }
        const st: AppState = this.excalidrawAPI.getAppState();
        const ea = this.plugin.ea;
        ea.reset();
        ea.style.strokeColor = st.currentItemStrokeColor??"black";
        ea.style.opacity = st.currentItemOpacity??1;
        ea.style.fontFamily = fontFamily??st.currentItemFontFamily??1;
        ea.style.fontSize = st.currentItemFontSize??20;
        ea.style.textAlign = st.currentItemTextAlign??"left";
        ea.addText(currentPosition.x, currentPosition.y, text);
        this.addElements(ea.getElements(), false, true);
      };

      this.addElements = async (
        newElements: ExcalidrawElement[],
        repositionToCursor: boolean = false,
        save: boolean = false,
        images: any,
        newElementsOnTop: boolean = false,
      ): Promise<boolean> => {
        if (!excalidrawRef?.current) {
          return false;
        }

        const textElements = newElements.filter((el) => el.type == "text");
        for (let i = 0; i < textElements.length; i++) {
          const [parseResultWrapped, parseResult, link] =
            await this.excalidrawData.addTextElement(
              textElements[i].id,
              //@ts-ignore
              textElements[i].text,
              //@ts-ignore
              textElements[i].rawText, //TODO: implement originalText support in ExcalidrawAutomate
            );
          //@ts-ignore  
          if(link) textElements[i].link = link;
          if (this.textMode == TextMode.parsed) {
            this.excalidrawData.updateTextElement(
              textElements[i],
              parseResultWrapped,
              parseResult,
            );
          }
        }

        if (repositionToCursor) {
          newElements = repositionElementsToCursor(
            newElements,
            currentPosition,
            true,
          );
        }

        const newIds = newElements.map((e) => e.id);
        const el: ExcalidrawElement[] = this.excalidrawAPI.getSceneElements();
        const removeList: string[] = [];

        //need to update elements in scene.elements to maintain sequence of layers
        for (let i = 0; i < el.length; i++) {
          const id = el[i].id;
          if (newIds.includes(id)) {
            el[i] = newElements.filter((ne) => ne.id === id)[0];
            removeList.push(id);
          }
        }

        const elements = newElementsOnTop
          ? el.concat(newElements.filter((e) => !removeList.includes(e.id)))
          : newElements.filter((e) => !removeList.includes(e.id)).concat(el);
        this.excalidrawAPI.updateScene({
          elements,
          commitToHistory: true,
        });

        if (images) {
          const files: BinaryFileData[] = [];
          Object.keys(images).forEach((k) => {
            files.push({
              mimeType: images[k].mimeType,
              id: images[k].id,
              dataURL: images[k].dataURL,
              created: images[k].created,
            });
            if (images[k].file) {
              const embeddedFile = new EmbeddedFile(
                this.plugin,
                this.file.path,
                images[k].file,
              );
              const st: AppState = this.excalidrawAPI.getAppState();
              embeddedFile.setImage(
                images[k].dataURL,
                images[k].mimeType,
                images[k].size,
                st.theme === "dark",
                images[k].hasSVGwithBitmap,
              );
              this.excalidrawData.setFile(images[k].id, embeddedFile);
            }
            if (images[k].latex) {
              this.excalidrawData.setEquation(images[k].id, {
                latex: images[k].latex,
                isLoaded: true,
              });
            }
          });
          this.excalidrawAPI.addFiles(files);
        }
        if (save) {
          await this.save(false); //preventReload=false will ensure that markdown links are paresed and displayed correctly
        } else {
          this.dirty = this.file?.path;
          this.diskIcon.querySelector("svg").addClass("excalidraw-dirty");
        }
        return true;
      };

      this.getScene = () => {
        if (!excalidrawRef?.current) {
          return null;
        }
        const el: ExcalidrawElement[] = this.excalidrawAPI.getSceneElements();
        const st: AppState = this.excalidrawAPI.getAppState();
        const files = this.excalidrawAPI.getFiles();

        if (files) {
          const imgIds = el
            .filter((e) => e.type === "image")
            .map((e: any) => e.fileId);
          const toDelete = Object.keys(files).filter(
            (k) => !imgIds.contains(k),
          );
          toDelete.forEach((k) => delete files[k]);
        }

        return {
          type: "excalidraw",
          version: 2,
          source: "https://excalidraw.com",
          elements: el,
          appState: {
            theme: st.theme,
            viewBackgroundColor: st.viewBackgroundColor,
            currentItemStrokeColor: st.currentItemStrokeColor,
            currentItemBackgroundColor: st.currentItemBackgroundColor,
            currentItemFillStyle: st.currentItemFillStyle,
            currentItemStrokeWidth: st.currentItemStrokeWidth,
            currentItemStrokeStyle: st.currentItemStrokeStyle,
            currentItemRoughness: st.currentItemRoughness,
            currentItemOpacity: st.currentItemOpacity,
            currentItemFontFamily: st.currentItemFontFamily,
            currentItemFontSize: st.currentItemFontSize,
            currentItemTextAlign: st.currentItemTextAlign,
            currentItemStrokeSharpness: st.currentItemStrokeSharpness,
            currentItemStartArrowhead: st.currentItemStartArrowhead,
            currentItemEndArrowhead: st.currentItemEndArrowhead,
            currentItemLinearStrokeSharpness:
              st.currentItemLinearStrokeSharpness,
            gridSize: st.gridSize,
            colorPalette: st.colorPalette,
          },
          files,
        };
      };

      this.refresh = () => {
        if (!excalidrawRef?.current) {
          return;
        }
        this.excalidrawAPI.refresh();
      };

      //variables used to handle click events in view mode
      let selectedTextElement: { id: string; text: string } = null;
      let selectedImageElement: { id: string; fileId: string } = null;
      let timestamp = 0;
      let blockOnMouseButtonDown = false;

      const getElementsAtPointer = (
        pointer: any,
        elements: ExcalidrawElement[],
        type: string,
      ): ExcalidrawElement[] => {
        return elements.filter((e: ExcalidrawElement) => {
          if (e.type !== type) {
            return false;
          }
          const [x, y, w, h] = rotatedDimensions(e);
          return (
            x <= pointer.x &&
            x + w >= pointer.x &&
            y <= pointer.y &&
            y + h >= pointer.y
          );
        });
      };

      const getTextElementAtPointer = (pointer: any) => {
        const elements = getElementsAtPointer(
          pointer,
          this.excalidrawAPI.getSceneElements(),
          "text",
        ) as ExcalidrawTextElement[];
        if (elements.length == 0) {
          return { id: null, text: null };
        }
        if (elements.length === 1) {
          return { id: elements[0].id, text: elements[0].text };
        }
        //if more than 1 text elements are at the location, look for one that has a link
        const elementsWithLinks = elements.filter(
          (e: ExcalidrawTextElement) => {
            const text: string =
              this.textMode === TextMode.parsed
                ? this.excalidrawData.getRawText(e.id)
                : e.text;
            if (!text) {
              return false;
            }
            if (text.match(REG_LINKINDEX_HYPERLINK)) {
              return true;
            }
            const parts = REGEX_LINK.getRes(text).next();
            if (!parts.value) {
              return false;
            }
            return true;
          },
        );
        //if there are no text elements with links, return the first element without a link
        if (elementsWithLinks.length == 0) {
          return { id: elements[0].id, text: elements[0].text };
        }
        //if there are still multiple text elements with links on top of each other, return the first
        return { id: elementsWithLinks[0].id, text: elementsWithLinks[0].text };
      };

      const getImageElementAtPointer = (pointer: any) => {
        const elements = getElementsAtPointer(
          pointer,
          this.excalidrawAPI.getSceneElements(),
          "image",
        ) as ExcalidrawImageElement[];
        if (elements.length === 0) {
          return { id: null, fileId: null };
        }
        if (elements.length >= 1) {
          return { id: elements[0].id, fileId: elements[0].fileId };
        }
        //if more than 1 image elements are at the location, return the first
      };

      let hoverPoint = { x: 0, y: 0 };
      let hoverPreviewTarget: EventTarget = null;
      const clearHoverPreview = () => {
        if (hoverPreviewTarget) {
          const event = new MouseEvent("click", {
            view: window,
            bubbles: true,
            cancelable: true,
          });
          hoverPreviewTarget.dispatchEvent(event);
          hoverPreviewTarget = null;
        }
      };

      const dropAction = (transfer: DataTransfer) => {
        // Return a 'copy' or 'link' action according to the content types, or undefined if no recognized type
        const files = (this.app as any).dragManager.draggable?.files;
        if (files) {
          if (files[0] == this.file) {
            files.shift();
            (
              this.app as any
            ).dragManager.draggable.title = `${files.length} files`;
          }
        }
        if (
          ["file", "files"].includes(
            (this.app as any).dragManager.draggable?.type,
          )
        ) {
          return "link";
        }
        if (
          transfer.types?.includes("text/html") ||
          transfer.types?.includes("text/plain") ||
          transfer.types?.includes("Files")
        ) {
          return "copy";
        }
      };

      let viewModeEnabled = false;
      const handleLinkClick = () => {
        selectedTextElement = getTextElementAtPointer(currentPosition);
        if (selectedTextElement && selectedTextElement.id) {
          const event = new MouseEvent("click", {
            ctrlKey: true,
            metaKey: true,
            shiftKey: this.plugin.shiftKeyDown,
            altKey: this.plugin.altKeyDown,
          });
          this.handleLinkClick(this, event);
          selectedTextElement = null;
        }
        selectedImageElement = getImageElementAtPointer(currentPosition);
        if (selectedImageElement && selectedImageElement.id) {
          const event = new MouseEvent("click", {
            ctrlKey: true,
            metaKey: true,
            shiftKey: this.plugin.shiftKeyDown,
            altKey: this.plugin.altKeyDown,
          });
          this.handleLinkClick(this, event);
          selectedImageElement = null;
        }
      };

      let mouseEvent: any = null;

      const showHoverPreview = (linktext?:string) => {
        if(!linktext) {
          linktext = "";
          const selectedElement = getTextElementAtPointer(currentPosition);
          if (!selectedElement || !selectedElement.text) {
            const selectedImgElement = getImageElementAtPointer(currentPosition);
            if (!selectedImgElement || !selectedImgElement.fileId) {
              return;
            }
            if (!this.excalidrawData.hasFile(selectedImgElement.fileId)) {
              return;
            }
            const ef = this.excalidrawData.getFile(selectedImgElement.fileId);
            const ref = ef.linkParts.ref
              ? `#${ef.linkParts.isBlockRef ? "^" : ""}${ef.linkParts.ref}`
              : "";
            linktext =
              this.excalidrawData.getFile(selectedImgElement.fileId).file.path +
              ref;
          } else {
            const text: string =
              this.textMode === TextMode.parsed
                ? this.excalidrawData.getRawText(selectedElement.id)
                : selectedElement.text;

            if (!text) {
              return;
            }
            if (text.match(REG_LINKINDEX_HYPERLINK)) {
              return;
            }

            const parts = REGEX_LINK.getRes(text).next();
            if (!parts.value) {
              return;
            }
            linktext = REGEX_LINK.getLink(parts); //parts.value[2] ? parts.value[2]:parts.value[6];
            if (linktext.match(REG_LINKINDEX_HYPERLINK)) {
              return;
            }
          }
        }

        this.plugin.hover.linkText = linktext;
        this.plugin.hover.sourcePath = this.file.path;
        hoverPreviewTarget = this.contentEl; //e.target;
        this.app.workspace.trigger("hover-link", {
          event: mouseEvent,
          source: VIEW_TYPE_EXCALIDRAW,
          hoverParent: hoverPreviewTarget,
          targetEl: hoverPreviewTarget,
          linktext: this.plugin.hover.linkText,
          sourcePath: this.plugin.hover.sourcePath,
        });
        hoverPoint = currentPosition;
        if (this.isFullscreen()) {
          const self = this;
          setTimeout(() => {
            const popover = document.body.querySelector("div.popover");
            if (popover) {
              self.contentEl.append(popover);
            }
          }, 100);
        }
      };

      const excalidrawDiv = React.createElement(
        "div",
        {
          className: "excalidraw-wrapper",
          ref: excalidrawWrapperRef,
          key: "abc",
          tabIndex: 0,
          onKeyDown: (e: any) => {
            //@ts-ignore
            if (e.target === excalidrawDiv.ref.current) {
              return;
            } //event should originate from the canvas
            if (this.isFullscreen() && e.keyCode === KEYCODE.ESC) {
              this.exitFullscreen();
            }

            /*
            this.ctrlKeyDown = e[CTRL_OR_CMD]; //.ctrlKey||e.metaKey;
            this.shiftKeyDown = e.shiftKey;
            this.altKeyDown = e.altKey;*/

            if (e[CTRL_OR_CMD] && !e.shiftKey && !e.altKey) {
              showHoverPreview();
            }
          },
          /*          onKeyUp: (e: any) => {
            this.ctrlKeyDown = e[CTRL_OR_CMD]; //.ctrlKey||e.metaKey;
            this.shiftKeyDown = e.shiftKey;
            this.altKeyDown = e.altKey;
          },*/
          onClick: (e: MouseEvent): any => {
            if (!e[CTRL_OR_CMD]) {
              return;
            } //.ctrlKey||e.metaKey)) return;
            if (!this.plugin.settings.allowCtrlClick) {
              return;
            }
            if (
              !(
                this.getSelectedTextElement().id ||
                this.getSelectedImageElement().id
              )
            ) {
              return;
            }
            this.handleLinkClick(this, e);
          },
          onMouseMove: (e: MouseEvent) => {
            //@ts-ignore
            mouseEvent = e.nativeEvent;
          },
          onMouseOver: () => {
            clearHoverPreview();
          },
          onDragOver: (e: any) => {
            const action = dropAction(e.dataTransfer);
            if (action) {
              e.dataTransfer.dropEffect = action;
              e.preventDefault();
              return false;
            }
          },
          onDragLeave: () => {},
        },
        React.createElement(Excalidraw.default, {
          ref: excalidrawRef,
          width: dimensions.width,
          height: dimensions.height,
          UIOptions: {
            canvasActions: {
              loadScene: false,
              saveScene: false,
              saveAsScene: false,
              export: { saveFileToDisk: false },
              saveAsImage: false,
              saveToActiveFile: false,
            },
          },
          initialData: initdata,
          detectScroll: true,
          onPointerUpdate: (p: any) => {
            currentPosition = p.pointer;
            if (
              hoverPreviewTarget &&
              (Math.abs(hoverPoint.x - p.pointer.x) > 50 ||
                Math.abs(hoverPoint.y - p.pointer.y) > 50)
            ) {
              clearHoverPreview();
            }
            if (!viewModeEnabled) {
              return;
            }

            const buttonDown = !blockOnMouseButtonDown && p.button === "down";
            if (buttonDown) {
              blockOnMouseButtonDown = true;

              //ctrl click
              if (this.plugin.ctrlKeyDown) {
                handleLinkClick();
                return;
              }

              //dobule click
              const now = new Date().getTime();
              if (now - timestamp < 600) {
                handleLinkClick();
              }
              timestamp = now;
              return;
            }
            if (p.button === "up") {
              blockOnMouseButtonDown = false;
            }
            if (this.plugin.ctrlKeyDown) {
              showHoverPreview();
            }
          },
          autoFocus: true,
          onChange: (et: ExcalidrawElement[], st: AppState) => {
            viewModeEnabled = st.viewModeEnabled;
            if (this.justLoaded) {
              this.justLoaded = false;
              if(!this.preventAutozoomOnLoad) this.zoomToFit(false);
              this.preventAutozoomOnLoad = false;
              this.previousSceneVersion = getSceneVersion(et);
              return;
            }
            if (
              st.editingElement === null &&
              st.resizingElement === null &&
              st.draggingElement === null &&
              st.editingGroupId === null &&
              st.editingLinearElement === null
            ) {
              const sceneVersion = getSceneVersion(et);
              if (
                sceneVersion > 0 &&
                sceneVersion !== this.previousSceneVersion
              ) {
                this.previousSceneVersion = sceneVersion;
                this.dirty = this.file?.path;
                this.diskIcon.querySelector("svg").addClass("excalidraw-dirty");
              }
            }
          },
          onLibraryChange: (items: LibraryItems) => {
            (async () => {
              const lib = {
                type: "excalidrawlib",
                version: 2,
                source: "https://excalidraw.com",
                libraryItems: items,
              };
              this.plugin.setStencilLibrary(lib);
              await this.plugin.saveSettings();
            })();
          },
          renderTopRightUI: this.obsidianMenu.renderButton,
          onPaste: (data: ClipboardData) => {
            //, event: ClipboardEvent | null
            if (data.elements) {
              const self = this;
              setTimeout(() => self.save(false), 300);
            }
            return true;
          },
          onThemeChange: async (newTheme: string) => {
            //debug({where:"ExcalidrawView.onThemeChange",file:this.file.name,before:"this.loadSceneFiles",newTheme});
            this.excalidrawData.scene.appState.theme = newTheme;
            this.loadSceneFiles();
            toolsPanelRef?.current?.setTheme(newTheme);
          },
          onDrop: (event: React.DragEvent<HTMLDivElement>): boolean => {
            const st: AppState = this.excalidrawAPI.getAppState();
            currentPosition = viewportCoordsToSceneCoords(
              { clientX: event.clientX, clientY: event.clientY },
              st,
            );

            const draggable = (this.app as any).dragManager.draggable;
            const onDropHook = (
              type: "file" | "text" | "unknown",
              files: TFile[],
              text: string,
            ): boolean => {
              if (this.plugin.ea.onDropHook) {
                try {
                  return this.plugin.ea.onDropHook({
                    //@ts-ignore
                    ea: this.plugin.ea, //the Excalidraw Automate object
                    event, //React.DragEvent<HTMLDivElement>
                    draggable, //Obsidian draggable object
                    type, //"file"|"text"
                    payload: {
                      files, //TFile[] array of dropped files
                      text, //string
                    },
                    excalidrawFile: this.file, //the file receiving the drop event
                    view: this, //the excalidraw view receiving the drop
                    pointerPosition: currentPosition, //the pointer position on canvas at the time of drop
                  });
                } catch (e) {
                  new Notice("on drop hook error. See console log for details");
                  errorlog({ where: "ExcalidrawView.onDrop", error: e });
                  return false;
                }
              } else {
                return false;
              }
            };

            switch (draggable?.type) {
              case "file":
                if (!onDropHook("file", [draggable.file], null)) {
                  //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/422
                  if(draggable.file.path.match(REG_LINKINDEX_INVALIDCHARS)) {
                    new Notice(t("FILENAME_INVALID_CHARS"), 4000);
                    return false;
                  }
                  //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/468
                  event[CTRL_OR_CMD]=event.shiftKey || event[CTRL_OR_CMD];
                  if (
                    event[CTRL_OR_CMD] && //.ctrlKey||event.metaKey)
                    (IMAGE_TYPES.contains(draggable.file.extension) ||
                      draggable.file.extension === "md")
                  ) {
                    const ea = this.plugin.ea;
                    ea.reset();
                    ea.setView(this);
                    (async () => {
                      ea.canvas.theme = this.excalidrawAPI.getAppState().theme;
                      await ea.addImage(
                        currentPosition.x,
                        currentPosition.y,
                        draggable.file,
                      );
                      ea.addElementsToView(false, false, true);
                    })();
                    return false;
                  }
                  this.addText(
                    `[[${this.app.metadataCache.fileToLinktext(
                      draggable.file,
                      this.file.path,
                      true,
                    )}]]`,
                  );
                }
                return false;
              case "files":
                if (!onDropHook("file", draggable.files, null)) {
                  for (const f of draggable.files) {
                    this.addText(
                      `[[${this.app.metadataCache.fileToLinktext(
                        f,
                        this.file.path,
                        true,
                      )}]]`,
                    );
                    currentPosition.y += st.currentItemFontSize * 2;
                  }
                }
                return false;
            }
            if (event.dataTransfer.types.includes("text/plain")) {
              const text: string = event.dataTransfer.getData("text");
              if (!text) {
                return true;
              }
              if (!onDropHook("text", null, text)) {
                if (
                  this.plugin.settings.iframelyAllowed &&
                  text.match(/^https?:\/\/\S*$/)
                ) {
                  let linkAdded = false;
                  const self = this;
                  ajaxPromise({
                    url: `http://iframely.server.crestify.com/iframely?url=${text}`,
                  }).then(
                    (res) => {
                      if (!res || linkAdded) {
                        return false;
                      }
                      linkAdded = true;
                      const data = JSON.parse(res);
                      if (!data || !data.meta?.title) {
                        this.addText(text);
                        return false;
                      }
                      this.addText(`[${data.meta.title}](${text})`);
                      return false;
                    },
                    () => {
                      if (linkAdded) {
                        return false;
                      }
                      linkAdded = true;
                      self.addText(text);
                    },
                  );
                  setTimeout(() => {
                    if (linkAdded) {
                      return;
                    }
                    linkAdded = true;
                    self.addText(text);
                  }, 600);
                  return false;
                }
                this.addText(text.replace(/(!\[\[.*#[^\]]*\]\])/g, "$1{40}"));
              }
              return false;
            }
            if (onDropHook("unknown", null, null)) {
              return false;
            }
            return true;
          },
          onBeforeTextEdit: (textElement: ExcalidrawTextElement) => {
            if (this.autosaveTimer) {
              //stopping autosave to avoid autosave overwriting text while the user edits it
              clearInterval(this.autosaveTimer);
              this.autosaveTimer = null;
            }
            clearTimeout(this.isEditingTextResetTimer);
            this.isEditingTextResetTimer = null;
            this.isEditingText = true; //to prevent autoresize on mobile when keyboard pops up
            //if(this.textMode==TextMode.parsed) {
            const raw = this.excalidrawData.getRawText(textElement.id);
            if (!raw) {
              return textElement.rawText;
            }
            return raw;
            /*}
            return null;*/
          },
          onBeforeTextSubmit: (
            textElement: ExcalidrawTextElement,
            text: string,
            originalText: string,
            isDeleted: boolean,
          ): [string, string, string] => {
            this.isEditingText = true;
            this.isEditingTextResetTimer = setTimeout(() => {
              this.isEditingText = false;
              this.isEditingTextResetTimer = null;
            }, 1500); // to give time for the onscreen keyboard to disappear

            if (isDeleted) {
              this.excalidrawData.deleteTextElement(textElement.id);
              this.dirty = this.file?.path;
              this.diskIcon.querySelector("svg").addClass("excalidraw-dirty");
              this.setupAutosaveTimer();
              return [null, null, null];
            }

            //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/318
            //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/299
            /*if (!this.app.isMobile) {
              setTimeout(() => {
                this?.excalidrawWrapperRef?.current?.firstElementChild?.focus();
              }, 50);
            }*/

            const containerId = textElement.containerId;

            //If the parsed text is different than the raw text, and if View is in TextMode.parsed
            //Then I need to clear the undo history to avoid overwriting raw text with parsed text and losing links
            if (
              text !== textElement.text ||
              originalText !== textElement.originalText ||
              !this.excalidrawData.getRawText(textElement.id)
            ) {
              //the user made changes to the text or the text is missing from Excalidraw Data (recently copy/pasted)
              //setTextElement will attempt a quick parse (without processing transclusions)
              const [parseResultWrapped, parseResultOriginal, link] =
                this.excalidrawData.setTextElement(
                  textElement.id,
                  text,
                  originalText,
                  async () => {
                    await this.save(false);
                    //this.updateContainerSize(4,textElement.id,true); //not required, because save preventReload==false, it will reload and update container sizes
                    //this callback function will only be invoked if quick parse fails, i.e. there is a transclusion in the raw text
                    //thus I only check if TextMode.parsed, text is always != with parseResult
                    if (this.textMode === TextMode.parsed) {
                      this.excalidrawAPI.history.clear();
                    }
                    this.setupAutosaveTimer();
                  },
                );
              if (parseResultWrapped) {
                if (containerId) {
                  this.updateContainerSize(containerId, true);
                }
                //there were no transclusions in the raw text, quick parse was successful
                this.setupAutosaveTimer();
                if (this.textMode === TextMode.raw) {
                  return [parseResultWrapped, parseResultOriginal, link];
                } //text is displayed in raw, no need to clear the history, undo will not create problems
                if (text === parseResultWrapped) { 
                  if(link) {//don't forget the case: link-prefix:"" && link-brackets:true
                    return [parseResultWrapped, parseResultOriginal, link];
                  }
                  return [null, null, null];
                } //There were no links to parse, raw text and parsed text are equivalent
                this.excalidrawAPI.history.clear();
                return [parseResultWrapped, parseResultOriginal, link];
              }
              return [null, null, null];
            }
            this.setupAutosaveTimer();
            if (containerId) {
              this.updateContainerSize(containerId, true);
            }
            if (this.textMode === TextMode.parsed) {
              return this.excalidrawData.getParsedText(textElement.id);
            }
            return [null, null, null];
          },
          onLinkOpen: (element:ExcalidrawElement, e:any): void => {
            e.preventDefault();
            if(!element) return;
            const link = element.link;
            if(!link || link === "") return;
            const event = e?.detail?.nativeEvent;
            if(link.startsWith(LOCAL_PROTOCOL) || link.startsWith("[[")) {
              (async () => {
                const linkMatch = link.match(/(md:\/\/)?\[\[(?<link>.*?)\]\]/);
                if(!linkMatch) return;
                let linkText = linkMatch.groups["link"];

                let lineNum = 0;
                if (linkText.search("#") > -1) {
                  lineNum = (await this.excalidrawData.getTransclusion(linkText)).lineNum;
                  linkText = linkText.substring(0, linkText.search("#"));
                }

                if (linkText.match(REG_LINKINDEX_INVALIDCHARS)) {
                  new Notice(t("FILENAME_INVALID_CHARS"), 4000);
                  return;
                }

                const file = this.app.metadataCache.getFirstLinkpathDest(
                  linkText,
                  this.file.path,
                );

                const useNewLeaf = event.shift || event[CTRL_OR_CMD];

                if (useNewLeaf && this.isFullscreen()) {
                  this.exitFullscreen();
                }
                if (!file) {
                  (new NewFileActions(this.plugin,linkText,useNewLeaf,this)).open();
                  return;
                }
                try {
                  const leaf = useNewLeaf
                    ? getNewOrAdjacentLeaf(this.plugin, this.leaf)
                    : this.leaf;
                  leaf.openFile(file, { eState: { line: lineNum - 1 } }); //if file exists open file and jump to reference
                } catch (e) {
                  new Notice(e, 4000);
                }
              })();
              return;
            }
            window.open(link);
          },
          onLinkHover: (
            element:NonDeletedExcalidrawElement,
            event: React.PointerEvent<HTMLCanvasElement>
          ): void => { 
            if(element && (this.plugin.settings.hoverPreviewWithoutCTRL || event[CTRL_OR_CMD])){
              mouseEvent = event;
              mouseEvent.ctrlKey = true;
              const link = element.link;
              if(!link || link === "") return;
              if(link.startsWith(LOCAL_PROTOCOL) || link.startsWith("[[")) {
                const linkMatch = link.match(/(md:\/\/)?\[\[(?<link>.*?)\]\]/);
                if(!linkMatch) return;
                let linkText = linkMatch.groups["link"]; 
                if (linkText.search("#") > -1) {             
                  linkText = linkText.substring(0, linkText.search("#"));
                }  
                showHoverPreview(linkText);
              }
            };
          },
          onViewModeChange: (isViewModeEnabled:boolean)=> {
            this.toolsPanelRef?.current?.setExcalidrawViewMode(isViewModeEnabled);
          }

        }),
        React.createElement(ToolsPanel,{
          ref: toolsPanelRef,
          visible: false,
          view: this,
          centerPointer: setCurrentPositionToCenter
        })
      );

      const observer = React.useRef(
        new ResizeObserver(entries => {
          const {width,height} = entries[0].contentRect;
          const dx = toolsPanelRef.current.onRightEdge 
            ? toolsPanelRef.current.previousWidth - width
            : 0;
          const dy = toolsPanelRef.current.onBottomEdge
            ? toolsPanelRef.current.previousHeight - height
            : 0;
          toolsPanelRef.current.updatePosition(dy,dx);
        })
      )
      React.useEffect(() => {
        if (toolsPanelRef.current) {
          observer.current.observe(toolsPanelRef.current.containerRef.current)
        }
        return () => {
          observer.current.unobserve(toolsPanelRef.current.containerRef.current)
        }
      }, [toolsPanelRef, observer])

      return React.createElement(React.Fragment, null, excalidrawDiv);
    });
    ReactDOM.render(reactElement, this.contentEl, () => {
    });
  }

  private updateContainerSize(containerId?: string, delay: boolean = false) {
    const api = this.excalidrawAPI;
    const update = () => {
      const containers = containerId
        ? api
            .getSceneElements()
            .filter((el: ExcalidrawElement) => el.id === containerId)
        : api
            .getSceneElements()
            .filter((el: ExcalidrawElement) =>
              el.boundElements?.map((e) => e.type).includes("text"),
            );
      if(containers.length > 0) {
        if(this.initialContainerSizeUpdate) { //updateContainerSize will bump scene version which will trigger a false autosave
          this.justLoaded = true;             //after load, which will lead to a ping-pong between two syncronizing devices
        }
        api.updateContainerSize(containers);
      }
      this.initialContainerSizeUpdate = false;
    };
    if (delay) {
      setTimeout(() => update(), 50);
    } else {
      update();
    }
  }

  public zoomToFit(delay: boolean = true) {
    if (!this.excalidrawRef || this.isEditingText) {
      return;
    }
    const maxZoom = this.plugin.settings.zoomToFitMaxLevel;
    const current = this.excalidrawAPI;
    const elements = current.getSceneElements();
    if (delay) {
      //time for the DOM to render, I am sure there is a more elegant solution
      setTimeout(
        () =>
          current.zoomToFit(elements, maxZoom, this.isFullscreen() ? 0 : 0.05),
        100,
      );
    } else {
      current.zoomToFit(elements, maxZoom, this.isFullscreen() ? 0 : 0.05);
    }
  }
}

export function getTextMode(data: string): TextMode {
  const parsed =
    data.search("excalidraw-plugin: parsed\n") > -1 ||
    data.search("excalidraw-plugin: locked\n") > -1; //locked for backward compatibility
  return parsed ? TextMode.parsed : TextMode.raw;
}
