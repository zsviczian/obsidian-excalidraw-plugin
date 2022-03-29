import {
  TextFileView,
  WorkspaceLeaf,
  normalizePath,
  TFile,
  WorkspaceItem,
  Notice,
  Menu,
  MarkdownView,
  request,
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
} from "./Constants";
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
  debug,
  download,
  embedFontsInSVG,
  errorlog,
  getExportTheme,
  //getBakPath,
  getIMGFilename,
  getLinkParts,
  getNewOrAdjacentLeaf,
  getNewUniqueFilepath,
  getPNG,
  getPNGScale,
  getSVG,
  getSVGPadding,
  getWithBackground,
  hasExportTheme,
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
import { ObsidianMenu } from "./ObsidianMenu";
import { ToolsPanel } from "./ToolsPanel";
import { ScriptEngine } from "./Scripts";

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
  //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/544
  files = files.filter((f) => f && f.size && f.size.height > 0 && f.size.width > 0); //height will be zero when file does not exisig in case of broken embedded file links
  if (files.length === 0) {
    return;
  }
  const s = scaleLoadedImage(view.getScene(), files);
  if (isDark === undefined) {
    isDark = s.scene.appState.theme;
  }
  if (s.dirty) {
    //debug({where:"ExcalidrawView.addFiles",file:view.file.name,dataTheme:view.excalidrawData.scene.appState.theme,before:"updateScene",state:scene.appState})
    view.updateScene({
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

const warningUnknowSeriousError = () => {
  new Notice(
    "WARNING: Excalidraw ran into an unknown problem!!!\n\n" +
    "There is a risk that your most recent changes cannot be saved.\n\n" +
    "1) Please select your drawing using CTRL/CMD+A and make a copy with CTRL/CMD+C. " +
    "2) Then create an empty drawing in a new pane by CTRL/CMD+clicking the Excalidraw ribbon button, " +
    "3) and paste your work to the new document with CTRL/CMD+V.",
    60000,
  );
}

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

  public semaphores: {
    //The role of justLoaded is to capture the Excalidraw.onChange event that fires right after the canvas was loaded for the first time to
    //- prevent the first onChange event to mark the file as dirty and to consequently cause a save right after load, causing sync issues in turn
    //- trigger autozoom (in conjunction with preventAutozoomOnLoad)
    justLoaded: boolean,

    //the modifyEventHandler in main.ts will fire when an Excalidraw file has changed (e.g. due to sync)
    //when a drawing that is currently open in a view receives a sync update, excalidraw reload() is triggered
    //the preventAutozoomOnLoad flag will prevent the open drawing from autozooming when it is reloaded
    preventAutozoom: boolean, 
    
    autosaving: boolean, //flags that autosaving is in progress. Autosave is an async timer, the flag prevents collision with force save
    forceSaving: boolean, //flags that forcesaving is in progress. The flag prevents collision with autosaving
    dirty: string, //null if there are no changes to be saved, the path of the file if the drawing has unsaved changes
    
    //reload() is triggered by modifyEventHandler in main.ts. preventReload is a one time flag to abort reloading
    //to avoid interrupting the flow of drawing by the user.
    preventReload: boolean, 
    
    isEditingText: boolean, //https://stackoverflow.com/questions/27132796/is-there-any-javascript-event-fired-when-the-on-screen-keyboard-on-mobile-safari
    
    //Save is triggered by multiple threads when an Excalidraw pane is terminated
    //- by the view itself
    //- by the activeLeafChangeEventHandler change event handler
    //- by monkeypatches on detach(next)
    //This semaphore helps avoid collision of saves
    saving: boolean, 
    hoverSleep: boolean, //flag with timer to prevent hover preview from being triggered dozens of times
  } = {
    justLoaded: false,
    preventAutozoom: false,
    autosaving: false,
    dirty: null,
    preventReload: false,
    isEditingText: false,
    saving: false,
    forceSaving: false,
    hoverSleep: false,
  }
  
  public plugin: ExcalidrawPlugin;
  public autosaveTimer: any = null;
  public textMode: TextMode = TextMode.raw;
  private textIsParsed_Element: HTMLElement;
  private textIsRaw_Element: HTMLElement;
  public compatibilityMode: boolean = false;
  private obsidianMenu: ObsidianMenu;
  //store key state for view mode link resolution
  /*private ctrlKeyDown = false;
  private shiftKeyDown = false;
  private altKeyDown = false;*/

  //https://stackoverflow.com/questions/27132796/is-there-any-javascript-event-fired-when-the-on-screen-keyboard-on-mobile-safari
  private isEditingTextResetTimer: NodeJS.Timeout = null;

  id: string = (this.leaf as any).id;

  constructor(leaf: WorkspaceLeaf, plugin: ExcalidrawPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.excalidrawData = new ExcalidrawData(plugin);
  }

    preventAutozoom() {
    this.semaphores.preventAutozoom=true;
    setTimeout(()=>this.semaphores.preventAutozoom = false,2000)
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
        const folderpath = splitFolderAndFilename(this.file.path).folderpath;
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

  public async svg(scene: any): Promise<SVGSVGElement> {
    const exportSettings: ExportSettings = {
      withBackground: getWithBackground(this.plugin, this.file),
      withTheme: true,
    };
    return await getSVG(
      {
        ...scene,
        ...{
          appState: {
            ...scene.appState,
            theme:getExportTheme( this.plugin, this.file,scene.appState.theme )
          }
        }
      },
      exportSettings,
      getSVGPadding(this.plugin,this.file),
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

    const svg = await this.svg(scene);
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

  public async png (scene: any): Promise<Blob> {
    const exportSettings: ExportSettings = {
      withBackground: getWithBackground(this.plugin, this.file),
      withTheme: true,
    };
    return await getPNG(
      {
        ...scene,
        ...{
          appState: {
            ...scene.appState,
            theme:getExportTheme( this.plugin, this.file,scene.appState.theme )
          }
        }
      },
      exportSettings,
      getPNGScale(this.plugin, this.file),
    );
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

    const png = await this.png(scene);
    if (!png) {
      return;
    }
    if (file && file instanceof TFile) {
      await this.app.vault.modifyBinary(file, await png.arrayBuffer());
    } else {
      await this.app.vault.createBinary(filepath, await png.arrayBuffer());
    }
  }

  async save(preventReload: boolean = true, forcesave: boolean = false) {
    //debug({where:"save", preventReload, forcesave, semaphores:this.semaphores});
    if (this.semaphores.saving) {
      return;
    }
    this.semaphores.saving = true;

    if (!this.getScene) {
      this.semaphores.saving = false;
      return;
    }
    if (!this.isLoaded) {
      this.semaphores.saving = false;
      return;
    }
    if (!this.file || !this.app.vault.getAbstractFileByPath(this.file.path)) {
      this.semaphores.saving = false;
      return; //file was recently deleted
    }

    try {
      const allowSave =
        (this.semaphores.dirty !== null && this.semaphores.dirty) ||
        this.semaphores.autosaving || forcesave; //dirty == false when view.file == null;
      const scene = this.getScene();

      if (this.compatibilityMode) {
        await this.excalidrawData.syncElements(scene);
      } else if (
        (await this.excalidrawData.syncElements(scene)) &&
        !this.semaphores.autosaving
      ) {
        await this.loadDrawing(false);
      }

      if (allowSave) {
        //reload() is triggered indirectly when saving by the modifyEventHandler in main.ts
        //prevent reload is set here to override reload when not wanted: typically when the user is editing
        //and we do not want to interrupt the flow by reloading the drawing into the canvas.
        this.semaphores.preventReload = preventReload;      
        await super.save();
        this.clearDirty();
      }

      if (!this.semaphores.autosaving) {
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
    } catch(e) {
      errorlog({
        where:"ExcalidrawView.save",
        fn:this.save,
        error: e
      });
      warningUnknowSeriousError();
    }
    this.semaphores.saving = false;
  }

  // get the new file content
  // if drawing is in Text Element Edit Lock, then everything should be parsed and in sync
  // if drawing is in Text Element Edit Unlock, then everything is raw and parse and so an async function is not required here
  getViewData() {
    //debug({where:"getViewData",semaphores:this.semaphores});
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
      if (!this.excalidrawData.disableCompression) {
        this.excalidrawData.disableCompression =
          this.isEditedAsMarkdownInOtherView();
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
    if (this.toolsPanelRef && this.toolsPanelRef.current) {
      this.toolsPanelRef.current.setFullscreen(true);
    }
    if (this.app.isMobile) {
      const newStylesheet = document.createElement("style");
      newStylesheet.id = "excalidraw-full-screen";
      newStylesheet.textContent = `
        .workspace-leaf-content .view-content {
          padding: 0px !important;
        }
        .view-header {
          height: 1px !important;
        }
        .status-bar {
          display: none !important;
        }`;

      const oldStylesheet = document.getElementById(newStylesheet.id);
      if (oldStylesheet) {
        document.head.removeChild(oldStylesheet);
      }
      document.head.appendChild(newStylesheet);
      return;
    }
    this.contentEl.requestFullscreen(); //{navigationUI: "hide"});
    this.excalidrawWrapperRef.current.firstElementChild?.focus();
    this.contentEl.setAttribute("style", "padding:0px;margin:0px;");

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
    if (this.toolsPanelRef && this.toolsPanelRef.current) {
      this.toolsPanelRef.current.setFullscreen(false);
    }
    if (this.app.isMobile) {
      const oldStylesheet = document.getElementById("excalidraw-full-screen");
      if (oldStylesheet) {
        document.head.removeChild(oldStylesheet);
      }
      return;
    }
    document.exitFullscreen();
  }

  async handleLinkClick(view: ExcalidrawView, ev: MouseEvent) {
    const selectedText = this.getSelectedTextElement();
    let file = null;
    //let lineNum = 0;
    let subpath:string = null;
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
        const linkParts = getLinkParts(linkText, this.file);
        subpath = `#${linkParts.isBlockRef?"^":""}${linkParts.ref}`;
        linkText = linkParts.path;
        //lineNum = (await this.excalidrawData.getTransclusion(linkText)).lineNum;
        //linkText = linkText.substring(0, linkText.search("#"));
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
            if (!formula || formula === equation) {
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
            this.setDirty();
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
                if (!link || ef.linkParts.original === link) {
                  return;
                }
                ef.resetImage(this.file.path, link);
                await this.save(true);
                await this.loadSceneFiles();
                this.setDirty();
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
        new NewFileActions(this.plugin, linkText, ev.shiftKey, view).open();
        return;
      }
      const leaf = ev.shiftKey
        ? getNewOrAdjacentLeaf(this.plugin, view.leaf)
        : view.leaf;
      leaf.openFile(file, subpath?{ eState: { subpath } }:undefined); //if file exists open file and jump to reference
      //leaf.openFile(file, { eState: { line: lineNum - 1 } }); //if file exists open file and jump to reference
      view.app.workspace.setActiveLeaf(leaf, true, true);
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
    if (this.semaphores.isEditingText) {
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

    this.diskIcon = this.addAction(
      DISK_ICON_NAME,
      t("FORCE_SAVE"),
      async () => {
        if(this.semaphores.autosaving) return;
        this.semaphores.forceSaving = true;
        await this.save(false, true);
        this.plugin.triggerEmbedUpdates();
        this.loadSceneFiles();
        this.semaphores.forceSaving = false;
        new Notice("Save successful",1000);
      },
    );

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
    if(this.file) { //if there is an export theme set, override the theme change
      if(hasExportTheme(this.plugin,this.file)) return;
    }
    const st: AppState = this.excalidrawAPI.getAppState();
    this.excalidrawData.scene.theme = theme;
    //debug({where:"ExcalidrawView.setTheme",file:this.file.name,dataTheme:this.excalidrawData.scene.appState.theme,before:"updateScene"});
    this.updateScene({
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
    if (this.toolsPanelRef && this.toolsPanelRef.current) {
      this.toolsPanelRef.current.setPreviewMode(textMode === TextMode.parsed);
    }
    if (reload) {
      await this.save(false, true);
      this.updateContainerSize();
      this.excalidrawAPI.history.clear(); //to avoid undo replacing links with parsed text
    }
  }

  public setupAutosaveTimer() {
    const timer = async () => {
      if (
        this.isLoaded &&
        this.semaphores.dirty &&
        this.semaphores.dirty == this.file?.path &&
        this.plugin.settings.autosave &&
        !this.semaphores.forceSaving
      ) {
        this.autosaveTimer = null;
        this.semaphores.autosaving = true;
        if (this.excalidrawRef) {
          await this.save();
        }
        this.semaphores.autosaving = false;
        this.autosaveTimer = setTimeout(
          timer,
          this.plugin.settings.autosaveInterval,
        );
      } else {
        this.autosaveTimer = setTimeout(
          timer,
          this.isLoaded && this.plugin.activeExcalidrawView === this
            ? 1000 //try again in 1 second
            : this.plugin.settings.autosaveInterval, 
        );
      }
    };
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    } // clear previous timer if one exists
    if (this.plugin.settings.autosave) {
      this.autosaveTimer = setTimeout(
        timer,
        this.plugin.settings.autosaveInterval,
      );
    }
  }

  //save current drawing when user closes workspace leaf
  async onunload() {
    const tooltip = document.body.querySelector(
      "body>div.excalidraw-tooltip,div.excalidraw-tooltip--visible",
    );
    if (tooltip) {
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

  /**
   * reload is triggered by the modifyEventHandler in main.ts when ever an excalidraw drawing that is currently open
   * in a workspace leaf is modified. There can be two reasons for the file change:
   * - The user saves the drawing in the active view (either force-save or autosave)
   * - The file is modified by some other process, typically as a result of background sync, or because the drawing is open
   *   side by side, e.g. the canvas in one view and markdown view in the other.
   * @param fullreload 
   * @param file 
   * @returns 
   */
  public async reload(fullreload: boolean = false, file?: TFile) {
    //debug({where:"reload", fullreload,file, semaphores:this.semaphores});
    if (this.semaphores.preventReload) {
      this.semaphores.preventReload = false;
      return;
    }
    this.diskIcon.querySelector("svg").removeClass("excalidraw-dirty");
    if (this.compatibilityMode) {
      this.clearDirty();
      return;
    }
    if (!this.excalidrawRef) {
      return;
    }
    if (!this.file) {
      return;
    }
    const loadOnModifyTrigger = file && file === this.file;
    if (loadOnModifyTrigger) {
      this.data = await this.app.vault.read(file);
      this.preventAutozoom();
    }
    if (fullreload) {
      await this.excalidrawData.loadData(this.data, this.file, this.textMode);
    } else {
      await this.excalidrawData.setTextMode(this.textMode);
    }
    this.excalidrawData.scene.appState.theme =
      this.excalidrawAPI.getAppState().theme;
    await this.loadDrawing(loadOnModifyTrigger);
    this.clearDirty();
  }

  zoomToElementId(id:string) {
    if(!this.excalidrawAPI) {
      return;
    }
    const elements = this.excalidrawAPI.getSceneElements()
      .filter((el:ExcalidrawElement) => el.id === id);
    if(elements.length===0) {
      return;
    }
    if(!this.excalidrawAPI.getAppState().viewModeEnabled) {
      this.excalidrawAPI.selectElements(elements);
    }
    this.excalidrawAPI.zoomToFit(
        elements,
        this.plugin.settings.zoomToFitMaxLevel,
        0.05,
      );
  }

  setEphemeralState(state: any): void {
    if(!state) return;
    const self = this;
    let query:string[] = null;

    if(
      state.match &&
      state.match.content &&
      state.match.matches &&
      state.match.matches.length === 1 &&
      state.match.matches[0].length === 2
    ) {
      query = [state.match.content.substring(
        state.match.matches[0][0],
        state.match.matches[0][1]
      )];
    }

    if(state.subpath && state.subpath.length>2) {
      if(state.subpath[1]==="^") {
        const id = state.subpath.substring(2);
        setTimeout(()=>self.zoomToElementId(id),300);
      } else {
        query = ["# " + state.subpath.substring(1)];
      }
    }

    if(state.line && state.line>0) {
      query = [this.data.split("\n")[state.line-1]];
    }

    if(query) {
      setTimeout(()=>{
        if(!self.excalidrawAPI) {
          return;
        }
        const elements = self.excalidrawAPI.getSceneElements()
          .filter((el:ExcalidrawElement) => el.type === "text");
        self.selectElementsMatchingQuery(
          elements,
          query,
          !this.excalidrawAPI.getAppState().viewModeEnabled,
          true
        );
      },300);
    }

    super.setEphemeralState(state);
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
    this.previousSceneVersion = 0;
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
            }\n\nTry manually fixing the file or restoring an earlier version from sync history.`,
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
    if(!this.excalidrawAPI) {
      return;
    }
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

  initialContainerSizeUpdate = false;
  /**
   *
   * @param justloaded - a flag to trigger zoom to fit after the drawing has been loaded
   */
  private async loadDrawing(justloaded: boolean) {
    //debug({where:"loadDrawing", justloaded, semaphores:this.semaphores});
    const excalidrawData = this.excalidrawData.scene;
    this.semaphores.justLoaded = justloaded;
    this.initialContainerSizeUpdate = justloaded;
    this.clearDirty();
    const om = this.excalidrawData.getOpenMode();
    this.semaphores.preventReload = false;
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

      this.updateScene({
        elements: excalidrawData.elements,
        appState: {
          ...excalidrawData.appState,
          zenModeEnabled,
          viewModeEnabled,
          linkOpacity: this.plugin.settings.linkOpacity,
          trayModeEnabled: this.plugin.settings.defaultTrayMode,
        },
        files: excalidrawData.files,
        commitToHistory: true,
      },justloaded);
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
      this.initializeToolsIconPanelAfterLoading();
    } else {
      this.instantiateExcalidraw({
        elements: excalidrawData.elements,
        appState: {
          ...excalidrawData.appState,
          zenModeEnabled: om.zenModeEnabled,
          viewModeEnabled: om.viewModeEnabled,
          linkOpacity: this.plugin.settings.linkOpacity,
          trayModeEnabled: this.plugin.settings.defaultTrayMode,
        },
        files: excalidrawData.files,
        libraryItems: await this.getLibrary(),
      });
      //files are loaded on excalidrawRef readyPromise
    }
    const isCompressed = this.data.match(/```compressed\-json\n/gm) !== null;

    if (
      !this.compatibilityMode &&
      this.plugin.settings.compress !== isCompressed &&
      !this.isEditedAsMarkdownInOtherView()
    ) {
      this.setDirty();
    }
  }

  isEditedAsMarkdownInOtherView(): boolean {
    //if the user is editing the same file in markdown mode, do not compress it
    const leaves = this.app.workspace.getLeavesOfType("markdown");
    return (
      leaves.filter((leaf) => (leaf.view as MarkdownView).file === this.file)
        .length > 0
    );
  }

  public setDirty() {
    this.semaphores.dirty = this.file?.path;
    this.diskIcon.querySelector("svg").addClass("excalidraw-dirty");
  }

  public clearDirty() {
    this.semaphores.dirty = null;
    this.diskIcon.querySelector("svg").removeClass("excalidraw-dirty");
  }

  public initializeToolsIconPanelAfterLoading() {
    const st = this.excalidrawAPI?.getAppState();
    const panel = this.toolsPanelRef?.current;
    if (!panel) {
      return;
    }
    panel.setTheme(st.theme);
    panel.setExcalidrawViewMode(st.viewModeEnabled);
    panel.setPreviewMode(
      this.compatibilityMode ? null : this.textMode === TextMode.parsed,
    );
    panel.updateScriptIconMap(this.plugin.scriptEngine.scriptIconMap);
  }

  //Compatibility mode with .excalidraw files
  canAcceptExtension(extension: string) {
    return extension === "excalidraw"; //["excalidraw","md"].includes(extension);
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
    if (this.plugin.settings.compress === true) {
      this.excalidrawData.disableCompression = true;
      await this.save(true, true);
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
        item
          .setTitle(t("CONVERT_FILE"))
          .onClick(() => this.convertExcalidrawToMD());
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
              const png = await this.png(this.getScene());
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
              let svg = await this.svg(this.getScene());
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

  private previousSceneVersion = 0;
  private previousBackgroundColor = "";
  private instantiateExcalidraw(initdata: any) {
    //console.log("ExcalidrawView.instantiateExcalidraw()");
    this.clearDirty();
    const reactElement = React.createElement(() => {
      let currentPosition = { x: 0, y: 0 };
      const excalidrawWrapperRef = React.useRef(null);
      const toolsPanelRef = React.useRef(null);
      const [dimensions, setDimensions] = React.useState({
        width: undefined,
        height: undefined,
      });

      this.toolsPanelRef = toolsPanelRef;
      this.obsidianMenu = new ObsidianMenu(this.plugin, toolsPanelRef);

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
        excalidrawRef.current.readyPromise.then(
          (api: ExcalidrawImperativeAPI) => {
            this.excalidrawAPI = api;
            //console.log({where:"ExcalidrawView.React.ReadyPromise"});
            //debug({where:"ExcalidrawView.React.useEffect",file:this.file.name,before:"this.loadSceneFiles"});
            this.excalidrawAPI.setLocalFont(
              this.plugin.settings.experimentalEnableFourthFont,
            );
            this.loadSceneFiles();
            this.updateContainerSize(null, true);
            this.excalidrawWrapperRef.current.firstElementChild?.focus();
            const om = this.excalidrawData.getOpenMode();
/*            this.excalidrawAPI.setTrayMode(
              !(om.zenModeEnabled || om.viewModeEnabled) &&
              this.plugin.settings.defaultTrayMode,
            );*/
            this.addFullscreenchangeEvent();
            this.initializeToolsIconPanelAfterLoading();
          },
        );
      }, [excalidrawRef]);

      this.excalidrawRef = excalidrawRef;
      this.excalidrawWrapperRef = excalidrawWrapperRef;

      const setCurrentPositionToCenter = () => {
        if (!excalidrawRef || !excalidrawRef.current) {
          return;
        }
        const st = this.excalidrawAPI.getAppState();
        const { width, height } = st;
        currentPosition = viewportCoordsToSceneCoords(
          {
            clientX: width / 2,
            clientY: height / 2,
          },
          st,
        );
      };

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
            if (this.toolsPanelRef && this.toolsPanelRef.current) {
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

      this.addText = async (text: string, fontFamily?: 1 | 2 | 3 | 4):Promise<string> => {
        if (!excalidrawRef?.current) {
          return;
        }
        const st: AppState = this.excalidrawAPI.getAppState();
        const ea = this.plugin.ea;
        ea.reset();
        ea.style.strokeColor = st.currentItemStrokeColor ?? "black";
        ea.style.opacity = st.currentItemOpacity ?? 1;
        ea.style.fontFamily = fontFamily ?? st.currentItemFontFamily ?? 1;
        ea.style.fontSize = st.currentItemFontSize ?? 20;
        ea.style.textAlign = st.currentItemTextAlign ?? "left";
        const id = ea.addText(currentPosition.x, currentPosition.y, text);
        await this.addElements(ea.getElements(), false, true);
        return id;
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
          if (link) {
            //@ts-ignore
            textElements[i].link = link;
          }
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
        this.updateScene({
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
          this.setDirty();
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

      const showHoverPreview = (linktext?: string) => {
        if (!linktext) {
          linktext = "";
          const selectedElement = getTextElementAtPointer(currentPosition);
          if (!selectedElement || !selectedElement.text) {
            const selectedImgElement =
              getImageElementAtPointer(currentPosition);
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

        if(this.semaphores.hoverSleep) return;   
        
        const f = this.app.metadataCache.getFirstLinkpathDest(
          linktext,
          this.file.path,
        );
        if(!f) return;

        if (document.querySelector(`div.popover-title[data-path="${f.path}"]`)) return;

        this.semaphores.hoverSleep = true;
        const self = this;
        setTimeout(() => self.semaphores.hoverSleep = false, 500);
        this.plugin.hover.linkText = linktext;
        this.plugin.hover.sourcePath = this.file.path;
        hoverPreviewTarget = this.contentEl; //e.target;
        this.app.workspace.trigger("hover-link", {
          event: mouseEvent,
          source: VIEW_TYPE_EXCALIDRAW,
          hoverParent: hoverPreviewTarget,
          targetEl: null, //hoverPreviewTarget,
          linktext: this.plugin.hover.linkText,
          sourcePath: this.plugin.hover.sourcePath,
        });
        hoverPoint = currentPosition;
        if (this.isFullscreen()) {
          const self = this;
          setTimeout(() => {
            const popover = document.querySelector(`div.popover-title[data-path="${f.path}"]`)?.parentElement?.parentElement?.parentElement 
              ?? document.body.querySelector("div.popover");
            if (popover) {
              self.contentEl.append(popover);
            }
          }, 400);
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
            if (this.semaphores.justLoaded) {
              this.semaphores.justLoaded = false;
              if (!this.semaphores.preventAutozoom) {
                this.zoomToFit(false);
              }
              this.previousSceneVersion = getSceneVersion(et);
              this.previousBackgroundColor = st.viewBackgroundColor;
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
                (sceneVersion > 0 &&
                sceneVersion !== this.previousSceneVersion) ||
                st.viewBackgroundColor !== this.previousBackgroundColor
              ) {
                this.previousSceneVersion = sceneVersion;
                this.previousBackgroundColor = st.viewBackgroundColor;
                this.setDirty();
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
                  if (draggable.file.path.match(REG_LINKINDEX_INVALIDCHARS)) {
                    new Notice(t("FILENAME_INVALID_CHARS"), 4000);
                    return false;
                  }
                  //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/468
                  event[CTRL_OR_CMD] = event.shiftKey || event[CTRL_OR_CMD];
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
                  (async () => {
                    const id = await this.addText(text);
                    const url = `http://iframely.server.crestify.com/iframely?url=${text}`;
                    const data = JSON.parse(await request({url}));
                    if (!data || data.error || !data.meta?.title) {
                      return false;
                    }
                    const ea = this.plugin.ea;
                    ea.reset();
                    ea.setView(this);
                    const el = ea.getViewElements().filter((el)=>el.id===id);
                    if(el.length===1) {
                      //@ts-ignore
                      el[0].text = el[0].originalText = el[0].rawText = `[${data.meta.title}](${text})`;
                      ea.copyViewElementsToEAforEditing(el);
                      ea.addElementsToView(false, false, false);
                    }
                    return false;
                  })();
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
            this.semaphores.isEditingText = true; //to prevent autoresize on mobile when keyboard pops up
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
            this.semaphores.isEditingText = true;
            this.isEditingTextResetTimer = setTimeout(() => {
              this.semaphores.isEditingText = false;
              this.isEditingTextResetTimer = null;
            }, 1500); // to give time for the onscreen keyboard to disappear
            
            this.setupAutosaveTimer();

            if (isDeleted) {
              this.excalidrawData.deleteTextElement(textElement.id);
              this.setDirty();
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
              this.setDirty();
              const [parseResultWrapped, parseResultOriginal, link] =
                this.excalidrawData.setTextElement(
                  textElement.id,
                  text,
                  originalText,
                  async () => {
                    await this.save(false);
                    //save preventReload==false, it will reload and update container sizes
                    //this callback function will only be invoked if quick parse fails, i.e. there is a transclusion in the raw text
                    //thus I only check if TextMode.parsed, text is always != with parseResult
                    if (this.textMode === TextMode.parsed) {
                      this.excalidrawAPI.history.clear();
                    }
                  },
                );
              if (parseResultWrapped) {
                //there were no transclusions in the raw text, quick parse was successful
                if (containerId) {
                  this.updateContainerSize(containerId, true);
                }
                if (this.textMode === TextMode.raw) {
                  return [text, originalText, link];
                } //text is displayed in raw, no need to clear the history, undo will not create problems
                if (text === parseResultWrapped) {
                  if (link) {
                    //don't forget the case: link-prefix:"" && link-brackets:true
                    return [parseResultWrapped, parseResultOriginal, link];
                  }
                  return [null, null, null];
                } //There were no links to parse, raw text and parsed text are equivalent
                this.excalidrawAPI.history.clear();
                return [parseResultWrapped, parseResultOriginal, link];
              }
              return [null, null, null];
            }
            if (containerId) {
              this.updateContainerSize(containerId, true);
            }
            if (this.textMode === TextMode.parsed) {
              return this.excalidrawData.getParsedText(textElement.id);
            }
            return [null, null, null];
          },
          onLinkOpen: (element: ExcalidrawElement, e: any): void => {
            e.preventDefault();
            if (!element) {
              return;
            }
            const link = element.link;
            if (!link || link === "") {
              return;
            }
            const event = e?.detail?.nativeEvent;
            if (link.startsWith(LOCAL_PROTOCOL) || link.startsWith("[[")) {
              (async () => {
                const linkMatch = link.match(/(md:\/\/)?\[\[(?<link>.*?)\]\]/);
                if (!linkMatch) {
                  return;
                }
                let linkText = linkMatch.groups.link;

                //let lineNum = 0;
                let subpath:string = null;
                if (linkText.search("#") > -1) {
                  const linkParts = getLinkParts(linkText, this.file);
                  subpath = `#${linkParts.isBlockRef?"^":""}${linkParts.ref}`;
                  linkText = linkParts.path;
                  
                  //lineNum = (
                  //  await this.excalidrawData.getTransclusion(linkText)
                  //).lineNum;
                  //linkText = linkText.substring(0, linkText.search("#"));
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
                  new NewFileActions(
                    this.plugin,
                    linkText,
                    useNewLeaf,
                    this,
                  ).open();
                  return;
                }
                if(file===this.file) {
                  if(subpath) {
                    this.setEphemeralState({subpath});
                    return;
                  }
                  this.zoomToFit(false);
                } else {
                  try {
                    const leaf = useNewLeaf
                      ? getNewOrAdjacentLeaf(this.plugin, this.leaf)
                      : this.leaf;
                    leaf.openFile(file, subpath?{ eState: { subpath } }:undefined); //if file exists open file and jump to reference
                    //leaf.openFile(file, { eState: { line: lineNum - 1 } }); //if file exists open file and jump to reference
                  } catch (e) {
                    new Notice(e, 4000);
                  }
                }
              })();
              return;
            }
            window.open(link);
          },
          onLinkHover: (
            element: NonDeletedExcalidrawElement,
            event: React.PointerEvent<HTMLCanvasElement>,
          ): void => {
            if (
              element &&
              (this.plugin.settings.hoverPreviewWithoutCTRL ||
                event[CTRL_OR_CMD])
            ) {
              mouseEvent = event;
              mouseEvent.ctrlKey = true;
              const link = element.link;
              if (!link || link === "") {
                return;
              }
              if (link.startsWith(LOCAL_PROTOCOL) || link.startsWith("[[")) {
                const linkMatch = link.match(/(md:\/\/)?\[\[(?<link>.*?)\]\]/);
                if (!linkMatch) {
                  return;
                }
                let linkText = linkMatch.groups.link;
                if (linkText.search("#") > -1) {
                  linkText = linkText.substring(0, linkText.search("#"));
                }
                showHoverPreview(linkText);
              }
            }
          },
          onViewModeChange: (isViewModeEnabled: boolean) => {
            this.toolsPanelRef?.current?.setExcalidrawViewMode(
              isViewModeEnabled,
            );
          },
        }),
        React.createElement(ToolsPanel, {
          ref: toolsPanelRef,
          visible: false,
          view: this,
          centerPointer: setCurrentPositionToCenter,
        }),
      );

      const observer = React.useRef(
        new ResizeObserver((entries) => {
          const { width, height } = entries[0].contentRect;
          const dx = toolsPanelRef.current.onRightEdge
            ? toolsPanelRef.current.previousWidth - width
            : 0;
          const dy = toolsPanelRef.current.onBottomEdge
            ? toolsPanelRef.current.previousHeight - height
            : 0;
          toolsPanelRef.current.updatePosition(dy, dx);
        }),
      );
      React.useEffect(() => {
        if (toolsPanelRef.current) {
          observer.current.observe(toolsPanelRef.current.containerRef.current);
        }
        return () => {
          observer.current.unobserve(
            toolsPanelRef.current.containerRef.current,
          );
        };
      }, [toolsPanelRef, observer]);

      return React.createElement(React.Fragment, null, excalidrawDiv);
    });
    ReactDOM.render(reactElement, this.contentEl, () => {});
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
      if (containers.length > 0) {
        if (this.initialContainerSizeUpdate) {
          //updateContainerSize will bump scene version which will trigger a false autosave
          //after load, which will lead to a ping-pong between two syncronizing devices
          this.semaphores.justLoaded = true;
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
    if (!this.excalidrawRef || this.semaphores.isEditingText) {
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

  public async toggleTrayMode() {
    const st = this.excalidrawAPI.getAppState();
    this.excalidrawAPI.updateScene({
      appState: {trayModeEnabled: !st.trayModeEnabled}
    })

    //just in case settings were updated via Obsidian sync
    await this.plugin.loadSettings();
    this.plugin.settings.defaultTrayMode = !st.trayModeEnabled;
    this.plugin.saveSettings();
  }

  public selectElementsMatchingQuery(
    elements:ExcalidrawElement[],
    query:string[],
    selectResult:boolean = true,
    exactMatch: boolean = false //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/530
  ) {
    if(!elements || elements.length === 0 || !query || query.length === 0) {
      return;
    }

    const match = elements.filter((el: any) =>
      query.some((q) => {
        const text = el.rawText.toLowerCase().replaceAll("\n", " ").trim();
        if(exactMatch) {
          const m = text.match(/^#*(# .*)/);
          if(!m || m.length!==2) return false;
          return m[1] === q.toLowerCase();
        }
        return text.match(q.toLowerCase()); //to distinguish between "# frame" and "# frame 1"
      })
    );
    if (match.length === 0) {
      new Notice("I could not find a matching text element");
      return;
    }

    const API = this.excalidrawAPI;
    if(!API) {
      return;
    }
    if(selectResult) {
      API.selectElements(match);
    }
    API.zoomToFit(
      match,
      this.plugin.settings.zoomToFitMaxLevel,
      0.05,
    );
  }

  public getViewSelectedElements():ExcalidrawElement[] {
    const API = this.excalidrawAPI;
    const selectedElements = API.getAppState()?.selectedElementIds;
    if (!selectedElements) {
      return [];
    }
    const selectedElementsKeys = Object.keys(selectedElements);
    if (!selectedElementsKeys) {
      return [];
    }
    const elements: ExcalidrawElement[] = API
      .getSceneElements()
      .filter((e: any) => selectedElementsKeys.includes(e.id));

    const containerBoundTextElmenetsReferencedInElements = elements
      .filter(
        (el) =>
          el.boundElements &&
          el.boundElements.filter((be) => be.type === "text").length > 0,
      )
      .map(
        (el) =>
          el.boundElements
            .filter((be) => be.type === "text")
            .map((be) => be.id)[0],
      );

    const elementIDs = elements
      .map((el) => el.id)
      .concat(containerBoundTextElmenetsReferencedInElements);

    return API.getSceneElements().filter((el: ExcalidrawElement) =>
      elementIDs.contains(el.id),
    );
  }

  public async copyLinkToSelectedElementToClipboard() {
    const elements = this.getViewSelectedElements();
    if(elements.length!==1) {
      new Notice(t("INSERT_LINK_TO_ELEMENT_ERROR"));
      return;
    }
    const alias = await ScriptEngine.inputPrompt(
      this.app,
      "Set link alias",
      "Leave empty if you do not want to set an alias",
      "",
    );
    navigator.clipboard.writeText(`[[${this.file.path}#^${
      elements[0].id}${alias?`|${alias}`:``}]]`);
    new Notice(t("INSERT_LINK_TO_ELEMENT_READY"));
  }

  public updateScene(scene:{
    elements?: ExcalidrawElement[],
    appState?: any,
    files?: any,
    commitToHistory?: boolean,
  }, restore: boolean = false) {
    if(!this.excalidrawAPI) return;
    const shouldRestoreElements = scene.elements && restore;
    if(shouldRestoreElements) {
      scene.elements = this.excalidrawAPI.restore(scene).elements;
    }
    try {
      this.excalidrawAPI.updateScene(scene);
    } catch(e) {
      errorlog({
        where:"ExcalidrawView.updateScene 1st attempt",
        fn:this.updateScene,
        error: e,
        scene: scene,
        willDoSecondAttempt: !shouldRestoreElements
      });
      if(!shouldRestoreElements) { //second attempt
        try {
            scene.elements = this.excalidrawAPI.restore(scene).elements;
            this.excalidrawAPI.updateScene(scene);
        } catch (e) {
          errorlog({
            where:"ExcalidrawView.updateScene 2nd attempt",
            fn:this.updateScene,
            error: e,
            scene: scene
          });
          warningUnknowSeriousError();
        }
      } else {
        warningUnknowSeriousError();
      }
    }
  }
}

export function getTextMode(data: string): TextMode {
  const parsed =
    data.search("excalidraw-plugin: parsed\n") > -1 ||
    data.search("excalidraw-plugin: locked\n") > -1; //locked for backward compatibility
  return parsed ? TextMode.parsed : TextMode.raw;
}
