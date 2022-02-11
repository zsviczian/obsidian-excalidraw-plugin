import {
  TFile,
  Plugin,
  WorkspaceLeaf,
  addIcon,
  App,
  PluginManifest,
  MarkdownView,
  normalizePath,
  Menu,
  MenuItem,
  TAbstractFile,
  ViewState,
  Notice,
  loadMathJax,
  Scope,
  request,
} from "obsidian";
import {
  BLANK_DRAWING,
  VIEW_TYPE_EXCALIDRAW,
  EXCALIDRAW_ICON,
  ICON_NAME,
  SCRIPTENGINE_ICON,
  SCRIPTENGINE_ICON_NAME,
  DISK_ICON,
  DISK_ICON_NAME,
  PNG_ICON,
  PNG_ICON_NAME,
  SVG_ICON,
  SVG_ICON_NAME,
  RERENDER_EVENT,
  FRONTMATTER_KEY,
  FRONTMATTER,
  JSON_parse,
  nanoid,
  DARK_BLANK_DRAWING,
  CTRL_OR_CMD,
  SCRIPT_INSTALL_CODEBLOCK,
  SCRIPT_INSTALL_FOLDER,
  VIRGIL_FONT,
  VIRGIL_DATAURL,
} from "./constants";
import ExcalidrawView, { TextMode } from "./ExcalidrawView";
import { getMarkdownDrawingSection } from "./ExcalidrawData";
import {
  ExcalidrawSettings,
  DEFAULT_SETTINGS,
  ExcalidrawSettingTab,
} from "./settings";
import { openDialogAction, OpenFileDialog } from "./openDrawing";
import { InsertLinkDialog } from "./InsertLinkDialog";
import { InsertImageDialog } from "./InsertImageDialog";
import { InsertMDDialog } from "./InsertMDDialog";
import {
  initExcalidrawAutomate,
  destroyExcalidrawAutomate,
  ExcalidrawAutomate,
} from "./ExcalidrawAutomate";
import { Prompt } from "./Prompt";
import { around } from "monkey-around";
import { t } from "./lang/helpers";
import {
  checkAndCreateFolder,
  download,
  errorlog,
  getAttachmentsFolderAndFilePath,
  getFontDataURL,
  getIMGPathFromExcalidrawFile,
  getNewUniqueFilepath,
  isObsidianThemeDark,
  log,
  sleep,
} from "./Utils";
import { OneOffs } from "./OneOffs";
import { FileId } from "@zsviczian/excalidraw/types/element/types";
import { ScriptEngine } from "./Scripts";
import {
  hoverEvent,
  initializeMarkdownPostProcessor,
  markdownPostProcessor,
  observer,
} from "./MarkdownPostProcessor";
import { FieldSuggestor } from "./FieldSuggestor";

declare module "obsidian" {
  interface App {
    isMobile(): boolean;
  }
  interface Workspace {
    on(
      name: "hover-link",
      callback: (e: MouseEvent) => any,
      ctx?: any,
    ): EventRef;
  }
}

export default class ExcalidrawPlugin extends Plugin {
  public excalidrawFileModes: { [file: string]: string } = {};
  private _loaded: boolean = false;
  public settings: ExcalidrawSettings;
  private openDialog: OpenFileDialog;
  private insertLinkDialog: InsertLinkDialog;
  private insertImageDialog: InsertImageDialog;
  private insertMDDialog: InsertMDDialog;
  private activeExcalidrawView: ExcalidrawView = null;
  public lastActiveExcalidrawFilePath: string = null;
  public hover: { linkText: string; sourcePath: string } = {
    linkText: null,
    sourcePath: null,
  };
  private observer: MutationObserver;
  private themeObserver: MutationObserver;
  private fileExplorerObserver: MutationObserver;
  public opencount: number = 0;
  public ea: ExcalidrawAutomate;
  //A master list of fileIds to facilitate copy / paste
  public filesMaster: Map<FileId, { path: string; hasSVGwithBitmap: boolean }> =
    null; //fileId, path
  public equationsMaster: Map<FileId, string> = null; //fileId, formula
  public mathjax: any = null;
  private mathjaxDiv: HTMLDivElement = null;
  public scriptEngine: ScriptEngine;
  public fourthFontDef: string = VIRGIL_FONT;
  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    this.filesMaster = new Map<
      FileId,
      { path: string; hasSVGwithBitmap: boolean }
    >();
    this.equationsMaster = new Map<FileId, string>();
  }

  async onload() {
    addIcon(ICON_NAME, EXCALIDRAW_ICON);
    addIcon(SCRIPTENGINE_ICON_NAME, SCRIPTENGINE_ICON);
    addIcon(DISK_ICON_NAME, DISK_ICON);
    addIcon(PNG_ICON_NAME, PNG_ICON);
    addIcon(SVG_ICON_NAME, SVG_ICON);

    await this.loadSettings();
    this.addSettingTab(new ExcalidrawSettingTab(this.app, this));
    this.ea = await initExcalidrawAutomate(this);

    this.registerView(
      VIEW_TYPE_EXCALIDRAW,
      (leaf: WorkspaceLeaf) => new ExcalidrawView(leaf, this),
    );

    //Compatibility mode with .excalidraw files
    this.registerExtensions(["excalidraw"], VIEW_TYPE_EXCALIDRAW);

    this.addMarkdownPostProcessor();
    this.registerInstallCodeblockProcessor();
    this.addThemeObserver();
    this.experimentalFileTypeDisplayToggle(this.settings.experimentalFileType);
    this.registerCommands();
    this.registerEventListeners();
    this.initializeFourthFont();
    this.registerEditorSuggest(new FieldSuggestor(this));

    //inspiration taken from kanban:
    //https://github.com/mgmeyers/obsidian-kanban/blob/44118e25661bff9ebfe54f71ae33805dc88ffa53/src/main.ts#L267
    this.registerMonkeyPatches();

    if (!this.app.isMobile) {
      const electron: string = process?.versions?.electron;
      if (electron && electron?.startsWith("8.")) {
        new Notice(
          `You are running an older version of the electron Browser (${electron}). If Excalidraw does not start up, please reinstall Obsidian with the latest installer and try again.`,
          10000,
        );
      }
    }

    const patches = new OneOffs(this);
    patches.migrationNotice();
    patches.patchCommentBlock();
    patches.wysiwygPatch();
    patches.imageElementLaunchNotice();

    this.switchToExcalidarwAfterLoad();

    this.loadMathJax();

    const self = this;
    this.app.workspace.onLayoutReady(() => {
      this.scriptEngine = new ScriptEngine(self);
    });
  }

  public initializeFourthFont() {
    this.app.workspace.onLayoutReady(async () => {
      const font = await getFontDataURL(
        this.app,
        this.settings.experimantalFourthFont,
        "",
        "LocalFont",
      );
      const fourthFontDataURL =
        font.dataURL === "" ? VIRGIL_DATAURL : font.dataURL;
      this.fourthFontDef = font.fontDef;
      const newStylesheet = document.createElement("style");
      newStylesheet.id = "local-font-stylesheet";
      newStylesheet.textContent = `
        @font-face {
          font-family: 'LocalFont';
          src: url("${fourthFontDataURL}");
          font-display: swap;
        }
      `;
      // replace the old local font <style> element with the one we just created
      const oldStylesheet = document.getElementById(newStylesheet.id);
      document.head.appendChild(newStylesheet);
      if (oldStylesheet) {
        document.head.removeChild(oldStylesheet);
      }

      await (document as any).fonts.load(`20px LocalFont`);
    });
  }

  private loadMathJax() {
    //loading Obsidian MathJax as fallback
    this.app.workspace.onLayoutReady(() => {
      loadMathJax();
    });

    this.mathjaxDiv = document.body.createDiv();
    this.mathjaxDiv.title = "Excalidraw MathJax Support";
    this.mathjaxDiv.style.display = "none";
    const iframe = this.mathjaxDiv.createEl("iframe");
    const doc = iframe.contentWindow.document;
    const script = doc.createElement("script");
    script.type = "text/javascript";
    script.onload = () => {
      const win = iframe.contentWindow;
      //@ts-ignore
      win.MathJax.startup.pagePromise.then(() => {
        //@ts-ignore
        this.mathjax = win.MathJax;
      });
    };

    script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js";
    //script.src = MATHJAX_DATAURL;
    doc.head.appendChild(script);
  }

  private switchToExcalidarwAfterLoad() {
    const self = this;
    this.app.workspace.onLayoutReady(() => {
      let leaf: WorkspaceLeaf;
      for (leaf of self.app.workspace.getLeavesOfType("markdown")) {
        if (
          leaf.view instanceof MarkdownView &&
          self.isExcalidrawFile(leaf.view.file)
        ) {
          self.excalidrawFileModes[(leaf as any).id || leaf.view.file.path] =
            VIEW_TYPE_EXCALIDRAW;
          self.setExcalidrawView(leaf);
        }
      }
    });
  }

  private registerInstallCodeblockProcessor() {
    const codeblockProcessor = async (source: string, el: HTMLElement) => {
      //Button next to the "List of available scripts" at the top
      //In try/catch block because this approach is very error prone, depends on
      //MarkdownRenderer() and index.md structure, in case these are not as
      //expected this code will break
      let button2: HTMLButtonElement = null;
      try {
        const link: HTMLElement = el.parentElement.querySelector(
          `a[href="#${el.previousElementSibling.getAttribute(
            "data-heading",
          )}"]`,
        );
        link.style.paddingRight = "10px";
        button2 = link.parentElement.createEl("button", null, (b) => {
          b.setText(t("UPDATE_SCRIPT"));
          b.addClass("mod-cta");
          b.style.backgroundColor = "var(--interactive-success)";
          b.style.display = "none";
        });
      } catch (e) {
        errorlog({
          where: "this.registerInstallCodeblockProcessor",
          source,
          error: e,
        });
      }

      source = source.trim();
      el.createEl("button", null, async (button) => {
        const setButtonText = (
          text: "CHECKING" | "INSTALL" | "UPTODATE" | "UPDATE" | "ERROR",
        ) => {
          if (button2) {
            button2.style.display = "none";
          }
          switch (text) {
            case "CHECKING":
              button.setText(t("CHECKING_SCRIPT"));
              button.style.backgroundColor = "var(--interactive-normal)";
              break;
            case "INSTALL":
              button.setText(t("INSTALL_SCRIPT"));
              button.style.backgroundColor = "var(--interactive-accent)";
              break;
            case "UPTODATE":
              button.setText(t("UPTODATE_SCRIPT"));
              button.style.backgroundColor = "var(--interactive-normal)";
              break;
            case "UPDATE":
              button.setText(t("UPDATE_SCRIPT"));
              button.style.backgroundColor = "var(--interactive-success)";
              if (button2) {
                button2.style.display = null;
              }
              break;
            case "ERROR":
              button.setText(t("UNABLETOCHECK_SCRIPT"));
              button.style.backgroundColor = "var(--interactive-normal)";
              break;
          }
        };
        button.addClass("mod-cta");
        let decodedURI = source;
        try {
          decodedURI = decodeURI(source);
        } catch (e) {
          errorlog({
            where:
              "ExcalidrawPlugin.registerInstallCodeblockProcessor.codeblockProcessor.onClick",
            source,
            error: e,
          });
        }
        const fname = decodedURI.substring(decodedURI.lastIndexOf("/") + 1);
        const folder = `${this.settings.scriptFolderPath}/${SCRIPT_INSTALL_FOLDER}`;
        const path = `${folder}/${fname}`;
        let f = this.app.vault.getAbstractFileByPath(path);
        setButtonText(f ? "CHECKING" : "INSTALL");
        button.onclick = async () => {
          try {
            const data = await request({ url: source });
            if (f) {
              await this.app.vault.modify(f as TFile, data);
            } else {
              await checkAndCreateFolder(this.app.vault, folder);
              f = await this.app.vault.create(path, data);
            }
            setButtonText("UPTODATE");
            new Notice(`Installed: ${(f as TFile).basename}`);
          } catch (e) {
            new Notice(`Error installing script: ${fname}`);
            errorlog({
              where:
                "ExcalidrawPlugin.registerInstallCodeblockProcessor.codeblockProcessor.onClick",
              error: e,
            });
          }
        };
        if (button2) {
          button2.onclick = button.onclick;
        }

        //check modified date on github
        //https://superuser.com/questions/1406875/how-to-get-the-latest-commit-date-of-a-file-from-a-given-github-reposotiry
        if (!f || !(f instanceof TFile)) {
          return;
        }
        const msgHead =
          "https://api.github.com/repos/zsviczian/obsidian-excalidraw-plugin/commits?path=ea-scripts%2F";
        const msgTail = "&page=1&per_page=1";
        const data = await request({
          url: msgHead + encodeURI(fname) + msgTail,
        });
        if (!data) {
          setButtonText("ERROR");
          return;
        }
        const result = JSON.parse(data);
        if (result.length === 0 || !result[0]?.commit?.committer?.date) {
          setButtonText("ERROR");
          return;
        }
        //@ts-ignore
        const mtime = new Date(result[0].commit.committer.date) / 1;
        if (mtime > f.stat.mtime) {
          setButtonText("UPDATE");
          return;
        }
        setButtonText("UPTODATE");
      });
    };

    this.registerMarkdownCodeBlockProcessor(
      SCRIPT_INSTALL_CODEBLOCK,
      async (source, el) => {
        el.addEventListener(RERENDER_EVENT, async (e) => {
          e.stopPropagation();
          el.empty();
          codeblockProcessor(source, el);
        });
        codeblockProcessor(source, el);
      },
    );
  }

  /**
   * Displays a transcluded .excalidraw image in markdown preview mode
   */
  private addMarkdownPostProcessor() {
    initializeMarkdownPostProcessor(this);
    this.registerMarkdownPostProcessor(markdownPostProcessor);

    // internal-link quick preview
    this.registerEvent(this.app.workspace.on("hover-link", hoverEvent));

    //monitoring for div.popover.hover-popover.file-embed.is-loaded to be added to the DOM tree
    this.observer = observer;
    this.observer.observe(document, { childList: true, subtree: true });
  }

  private addThemeObserver() {
    this.themeObserver = new MutationObserver(async (m: MutationRecord[]) => {
      if (!this.settings.matchThemeTrigger) {
        return;
      }
      //@ts-ignore
      if (m[0]?.oldValue === m[0]?.target?.getAttribute("class")) {
        return;
      }
      if (
        m[0]?.oldValue?.includes("theme-dark") ===
        //@ts-ignore
        m[0]?.target?.classList?.contains("theme-dark")
      ) {
        return;
      }
      const theme = isObsidianThemeDark() ? "dark" : "light";
      const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);
      leaves.forEach((leaf: WorkspaceLeaf) => {
        const excalidrawView = leaf.view as ExcalidrawView;
        if (excalidrawView.file && excalidrawView.excalidrawRef) {
          excalidrawView.setTheme(theme);
        }
      });
    });
    this.themeObserver.observe(document.body, {
      attributeOldValue: true,
      attributeFilter: ["class"],
    });
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
   */
  private experimentalFileTypeDisplay() {
    const insertFiletype = (el: HTMLElement) => {
      if (el.childElementCount != 1) {
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
      if (this.isExcalidrawFile(f)) {
        el.insertBefore(
          createDiv({
            cls: "nav-file-tag",
            text: this.settings.experimentalFileTag,
          }),
          el.firstChild,
        );
      }
    };

    this.fileExplorerObserver = new MutationObserver((m) => {
      const mutationsWithNodes = m.filter((v) => v.addedNodes.length > 0);
      mutationsWithNodes.forEach((mu) => {
        mu.addedNodes.forEach((n) => {
          if (!(n instanceof Element)) {
            return;
          }
          n.querySelectorAll(".nav-file-title").forEach(insertFiletype);
        });
      });
    });

    const self = this;
    this.app.workspace.onLayoutReady(() => {
      document.querySelectorAll(".nav-file-title").forEach(insertFiletype); //apply filetype to files already displayed
      self.fileExplorerObserver.observe(document.querySelector(".workspace"), {
        childList: true,
        subtree: true,
      });
    });
  }

  private registerCommands() {
    this.openDialog = new OpenFileDialog(this.app, this);
    this.insertLinkDialog = new InsertLinkDialog(this.app);
    this.insertImageDialog = new InsertImageDialog(this);
    this.insertMDDialog = new InsertMDDialog(this);

    this.addRibbonIcon(ICON_NAME, t("CREATE_NEW"), async (e) => {
      this.createAndOpenDrawing(this.getNextDefaultFilename(), e[CTRL_OR_CMD]); //.ctrlKey||e.metaKey);
    });

    const fileMenuHandlerCreateNew = (menu: Menu, file: TFile) => {
      menu.addItem((item: MenuItem) => {
        item
          .setTitle(t("CREATE_NEW"))
          .setIcon(ICON_NAME)
          .onClick(() => {
            let folderpath = file.path;
            if (file instanceof TFile) {
              folderpath = normalizePath(
                file.path.substr(0, file.path.lastIndexOf(file.name)),
              );
            }
            this.createAndOpenDrawing(
              this.getNextDefaultFilename(),
              false,
              folderpath,
            );
          });
      });
    };

    this.registerEvent(
      this.app.workspace.on("file-menu", fileMenuHandlerCreateNew),
    );

    const fileMenuHandlerConvertKeepExtension = (menu: Menu, file: TFile) => {
      if (file instanceof TFile && file.extension == "excalidraw") {
        menu.addItem((item: MenuItem) => {
          item.setTitle(t("CONVERT_FILE_KEEP_EXT")).onClick(() => {
            this.convertSingleExcalidrawToMD(file, false, false);
          });
        });
      }
    };

    this.registerEvent(
      this.app.workspace.on("file-menu", fileMenuHandlerConvertKeepExtension),
    );

    const fileMenuHandlerConvertReplaceExtension = (
      menu: Menu,
      file: TFile,
    ) => {
      if (file instanceof TFile && file.extension == "excalidraw") {
        menu.addItem((item: MenuItem) => {
          item.setTitle(t("CONVERT_FILE_REPLACE_EXT")).onClick(() => {
            this.convertSingleExcalidrawToMD(file, true, true);
          });
        });
      }
    };

    this.registerEvent(
      this.app.workspace.on(
        "file-menu",
        fileMenuHandlerConvertReplaceExtension,
      ),
    );

    this.addCommand({
      id: "excalidraw-download-lib",
      name: t("DOWNLOAD_LIBRARY"),
      callback: async () => {
        if (this.app.isMobile) {
          const prompt = new Prompt(
            this.app,
            "Please provide a filename",
            "my-library",
            "filename, leave blank to cancel action",
          );
          prompt.openAndGetValue(async (filename: string) => {
            if (!filename) {
              return;
            }
            filename = `${filename}.excalidrawlib`;
            const folderpath = normalizePath(this.settings.folder);
            await checkAndCreateFolder(this.app.vault, folderpath); //create folder if it does not exist
            const fname = getNewUniqueFilepath(
              this.app.vault,
              filename,
              folderpath,
            );
            this.app.vault.create(fname, this.settings.library);
            new Notice(`Exported library to ${fname}`, 6000);
          });
          return;
        }
        download(
          "data:text/plain;charset=utf-8",
          encodeURIComponent(
            JSON.stringify(this.settings.library2, null, "\t"),
          ),
          "my-obsidian-library.excalidrawlib",
        );
      },
    });

    this.addCommand({
      id: "excalidraw-open",
      name: t("OPEN_EXISTING_NEW_PANE"),
      callback: () => {
        this.openDialog.start(openDialogAction.openFile, true);
      },
    });

    this.addCommand({
      id: "excalidraw-open-on-current",
      name: t("OPEN_EXISTING_ACTIVE_PANE"),
      callback: () => {
        this.openDialog.start(openDialogAction.openFile, false);
      },
    });

    this.addCommand({
      id: "excalidraw-insert-transclusion",
      name: t("TRANSCLUDE"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return this.app.workspace.activeLeaf.view.getViewType() == "markdown";
        }
        this.openDialog.start(openDialogAction.insertLinkToDrawing, false);
        return true;
      },
    });

    this.addCommand({
      id: "excalidraw-insert-last-active-transclusion",
      name: t("TRANSCLUDE_MOST_RECENT"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (
            this.app.workspace.activeLeaf.view.getViewType() == "markdown" &&
            this.lastActiveExcalidrawFilePath != null
          );
        }
        const file = this.app.vault.getAbstractFileByPath(this.lastActiveExcalidrawFilePath);
        if(!(file instanceof TFile)) return false;
        this.embedDrawing(file);
        return true;
      },
    });

    this.addCommand({
      id: "excalidraw-autocreate",
      name: t("NEW_IN_NEW_PANE"),
      callback: () => {
        this.createAndOpenDrawing(this.getNextDefaultFilename(), true);
      },
    });

    this.addCommand({
      id: "excalidraw-autocreate-on-current",
      name: t("NEW_IN_ACTIVE_PANE"),
      callback: () => {
        this.createAndOpenDrawing(this.getNextDefaultFilename(), false);
      },
    });

    const insertDrawingToDoc = async (inNewPane: boolean) => {
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!activeView) {
        return;
      }
      const prefix = this.settings.drawingEmbedPrefixWithFilename
        ? `${activeView.file.basename}_`
        : "";
      const date = window
        .moment()
        .format(this.settings.drawingFilenameDateTime);
      const extension = this.settings.compatibilityMode
        ? ".excalidraw"
        : ".excalidraw.md";
      const filename = prefix + date + extension;
      const folder = this.settings.embedUseExcalidrawFolder
        ? null
        : (
            await getAttachmentsFolderAndFilePath(
              this.app,
              activeView.file.path,
              filename,
            )
          ).folder;
      const file = await this.createDrawing(filename, folder);
      await this.embedDrawing(file);
      this.openDrawing(file, inNewPane);
    };

    this.addCommand({
      id: "excalidraw-autocreate-and-embed",
      name: t("NEW_IN_NEW_PANE_EMBED"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return this.app.workspace.activeLeaf.view.getViewType() == "markdown";
        }
        insertDrawingToDoc(true);
        return true;
      },
    });

    this.addCommand({
      id: "excalidraw-autocreate-and-embed-on-current",
      name: t("NEW_IN_ACTIVE_PANE_EMBED"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return this.app.workspace.activeLeaf.view.getViewType() == "markdown";
        }
        insertDrawingToDoc(false);
        return true;
      },
    });

    this.addCommand({
      id: "export-svg",
      name: t("EXPORT_SVG"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (
            this.app.workspace.activeLeaf.view.getViewType() ==
            VIEW_TYPE_EXCALIDRAW
          );
        }
        const view = this.app.workspace.activeLeaf.view;
        if (view instanceof ExcalidrawView) {
          view.saveSVG();
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "export-png",
      name: t("EXPORT_PNG"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (
            this.app.workspace.activeLeaf.view.getViewType() ==
            VIEW_TYPE_EXCALIDRAW
          );
        }
        const view = this.app.workspace.activeLeaf.view;
        if (view instanceof ExcalidrawView) {
          view.savePNG();
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "toggle-lock",
      hotkeys: [{ modifiers: ["Ctrl" || "Meta", "Shift"], key: "e" }],
      name: t("TOGGLE_LOCK"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          if (
            this.app.workspace.activeLeaf.view.getViewType() ==
            VIEW_TYPE_EXCALIDRAW
          ) {
            return !(this.app.workspace.activeLeaf.view as ExcalidrawView)
              .compatibilityMode;
          }
          return false;
        }
        const view = this.app.workspace.activeLeaf.view;
        if (view instanceof ExcalidrawView) {
          view.changeTextMode(
            view.textMode == TextMode.parsed ? TextMode.raw : TextMode.parsed,
          );
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "delete-file",
      name: t("DELETE_FILE"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          const view = this.app.workspace.activeLeaf.view;
          return view instanceof ExcalidrawView;
        }
        const view = this.app.workspace.activeLeaf.view;
        if (view instanceof ExcalidrawView) {
          this.ea.reset();
          this.ea.setView(view);
          const el = this.ea.getViewSelectedElement();
          if (el.type !== "image") {
            new Notice(
              "Please select an image or embedded markdown document",
              4000,
            );
            return true;
          }
          const file = this.ea.getViewFileForImageElement(el);
          if (!file) {
            new Notice(
              "Please select an image or embedded markdown document",
              4000,
            );
            return true;
          }
          this.app.vault.delete(file);
          this.ea.deleteViewElements([el]);
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "insert-link",
      hotkeys: [{ modifiers: ["Ctrl" || "Meta", "Shift"], key: "k" }],
      name: t("INSERT_LINK"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          const view = this.app.workspace.activeLeaf.view;
          return view instanceof ExcalidrawView;
        }
        const view = this.app.workspace.activeLeaf.view;
        if (view instanceof ExcalidrawView) {
          this.insertLinkDialog.start(view.file.path, view.addText);
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "insert-image",
      name: t("INSERT_IMAGE"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          const view = this.app.workspace.activeLeaf.view;
          return view instanceof ExcalidrawView;
        }
        const view = this.app.workspace.activeLeaf.view;
        if (view instanceof ExcalidrawView) {
          this.insertImageDialog.start(view);
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "tray-mode",
      name: t("TRAY_MODE"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          const view = this.app.workspace.activeLeaf.view;
          return view instanceof ExcalidrawView;
        }
        const view = this.app.workspace.activeLeaf.view;
        if (view instanceof ExcalidrawView && view.excalidrawAPI) {
          const st = view.excalidrawAPI.getAppState();
          st.isMobile = !st.isMobile;
          view.excalidrawAPI.updateScene({appState:st});
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "insert-md",
      name: t("INSERT_MD"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          const view = this.app.workspace.activeLeaf.view;
          return view instanceof ExcalidrawView;
        }
        const view = this.app.workspace.activeLeaf.view;
        if (view instanceof ExcalidrawView) {
          this.insertMDDialog.start(view);
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "insert-LaTeX-symbol",
      name: t("INSERT_LATEX"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (
            this.app.workspace.activeLeaf.view.getViewType() ==
            VIEW_TYPE_EXCALIDRAW
          );
        }
        const view = this.app.workspace.activeLeaf.view;
        if (view instanceof ExcalidrawView) {
          const prompt = new Prompt(
            this.app,
            t("ENTER_LATEX"),
            "",
            "\\color{red}\\oint_S {E_n dA = \\frac{1}{{\\varepsilon _0 }}} Q_{inside}",
          );
          prompt.openAndGetValue(async (formula: string) => {
            if (!formula) {
              return;
            }
            const ea = this.ea;
            ea.reset();
            await ea.addLaTex(0, 0, formula);
            ea.setView(view);
            ea.addElementsToView(true, false);
          });
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "toggle-excalidraw-view",
      name: t("TOGGLE_MODE"),
      checkCallback: (checking) => {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
          return false;
        }
        const fileIsExcalidraw = this.isExcalidrawFile(activeFile);

        if (checking) {
          if (
            this.app.workspace.activeLeaf.view.getViewType() ==
            VIEW_TYPE_EXCALIDRAW
          ) {
            return !(this.app.workspace.activeLeaf.view as ExcalidrawView)
              .compatibilityMode;
          }
          return fileIsExcalidraw;
        }

        const activeLeaf = this.app.workspace.activeLeaf;

        if (activeLeaf?.view && activeLeaf.view instanceof ExcalidrawView) {
          this.excalidrawFileModes[(activeLeaf as any).id || activeFile.path] =
            "markdown";
          this.setMarkdownView(activeLeaf);
        } else if (fileIsExcalidraw) {
          this.excalidrawFileModes[(activeLeaf as any).id || activeFile.path] =
            VIEW_TYPE_EXCALIDRAW;
          this.setExcalidrawView(activeLeaf);
        }
      },
    });

    this.addCommand({
      id: "convert-to-excalidraw",
      name: t("CONVERT_NOTE_TO_EXCALIDRAW"),
      checkCallback: (checking) => {
        const activeFile = this.app.workspace.getActiveFile();
        const activeLeaf = this.app.workspace.activeLeaf;

        if (!activeFile || !activeLeaf) {
          return false;
        }

        const isFileEmpty = activeFile.stat.size === 0;

        if (checking) {
          return isFileEmpty;
        }
        if (isFileEmpty) {
          (async () => {
            await this.app.vault.modify(
              activeFile,
              await this.getBlankDrawing(),
            );
            this.setExcalidrawView(activeLeaf);
          })();
        }
      },
    });

    this.addCommand({
      id: "convert-excalidraw",
      name: t("CONVERT_EXCALIDRAW"),
      checkCallback: (checking) => {
        if (checking) {
          const files = this.app.vault
            .getFiles()
            .filter((f) => f.extension == "excalidraw");
          return files.length > 0;
        }
        this.convertExcalidrawToMD();
        return true;
      },
    });
  }

  public async convertSingleExcalidrawToMD(
    file: TFile,
    replaceExtension: boolean = false,
    keepOriginal: boolean = false,
  ): Promise<TFile> {
    const data = await this.app.vault.read(file);
    const filename =
      file.name.substr(0, file.name.lastIndexOf(".excalidraw")) +
      (replaceExtension ? ".md" : ".excalidraw.md");
    const fname = getNewUniqueFilepath(
      this.app.vault,
      filename,
      normalizePath(file.path.substring(0, file.path.lastIndexOf(file.name))),
    );
    log(fname);
    const result = await this.app.vault.create(
      fname,
      FRONTMATTER + (await this.exportSceneToMD(data)),
    );
    if (this.settings.keepInSync) {
      [".svg", ".png"].forEach((ext: string) => {
        const oldIMGpath =
          file.path.substring(0, file.path.lastIndexOf(".excalidraw")) + ext;
        const imgFile = this.app.vault.getAbstractFileByPath(
          normalizePath(oldIMGpath),
        );
        if (imgFile && imgFile instanceof TFile) {
          const newIMGpath = fname.substring(0, fname.lastIndexOf(".md")) + ext;
          this.app.fileManager.renameFile(imgFile, newIMGpath);
        }
      });
    }
    if (!keepOriginal) {
      this.app.vault.delete(file);
    }
    return result;
  }

  public async convertExcalidrawToMD(
    replaceExtension: boolean = false,
    keepOriginal: boolean = false,
  ) {
    const files = this.app.vault
      .getFiles()
      .filter((f) => f.extension == "excalidraw");
    for (const file of files) {
      this.convertSingleExcalidrawToMD(file, replaceExtension, keepOriginal);
    }
    new Notice(`Converted ${files.length} files.`);
  }

  private registerMonkeyPatches() {
    const self = this;

    // Monkey patch WorkspaceLeaf to open Excalidraw drawings with ExcalidrawView by default
    this.register(
      around(WorkspaceLeaf.prototype, {
        // Drawings can be viewed as markdown or Excalidraw, and we keep track of the mode
        // while the file is open. When the file closes, we no longer need to keep track of it.
        detach(next) {
          return function () {
            const state = this.view?.getState();

            if (
              state?.file &&
              self.excalidrawFileModes[this.id || state.file]
            ) {
              delete self.excalidrawFileModes[this.id || state.file];
            }

            return next.apply(this);
          };
        },

        setViewState(next) {
          return function (state: ViewState, ...rest: any[]) {
            if (
              // Don't force excalidraw mode during shutdown
              self._loaded &&
              // If we have a markdown file
              state.type === "markdown" &&
              state.state?.file &&
              // And the current mode of the file is not set to markdown
              self.excalidrawFileModes[this.id || state.state.file] !==
                "markdown"
            ) {
              // Then check for the excalidraw frontMatterKey
              const cache = self.app.metadataCache.getCache(state.state.file);

              if (cache?.frontmatter && cache.frontmatter[FRONTMATTER_KEY]) {
                // If we have it, force the view type to excalidraw
                const newState = {
                  ...state,
                  type: VIEW_TYPE_EXCALIDRAW,
                };

                self.excalidrawFileModes[state.state.file] =
                  VIEW_TYPE_EXCALIDRAW;

                return next.apply(this, [newState, ...rest]);
              }
            }

            return next.apply(this, [state, ...rest]);
          };
        },
      }),
    );

    // Add a menu item to go back to Excalidraw view
    this.register(
      around(MarkdownView.prototype, {
        onMoreOptionsMenu(next) {
          return function (menu: Menu) {
            const file = this.file;
            const cache = file
              ? self.app.metadataCache.getFileCache(file)
              : null;

            if (
              !file ||
              !cache?.frontmatter ||
              !cache.frontmatter[FRONTMATTER_KEY]
            ) {
              return next.call(this, menu);
            }

            menu
              .addItem((item) => {
                item
                  .setTitle(t("OPEN_AS_EXCALIDRAW"))
                  .setIcon(ICON_NAME)
                  .onClick(() => {
                    self.excalidrawFileModes[this.leaf.id || file.path] =
                      VIEW_TYPE_EXCALIDRAW;
                    self.setExcalidrawView(this.leaf);
                  });
              })
              .addSeparator();

            next.call(this, menu);
          };
        },
      }),
    );
  }

  public ctrlKeyDown: boolean;
  public shiftKeyDown: boolean;
  public altKeyDown: boolean;
  public onKeyUp: any;
  public onKeyDown: any;

  private popScope: Function = null;
  private registerEventListeners() {
    const self = this;
    this.app.workspace.onLayoutReady(async () => {
      self.onKeyUp = (e: KeyboardEvent) => {
        self.ctrlKeyDown = e[CTRL_OR_CMD];
        self.shiftKeyDown = e.shiftKey;
        self.altKeyDown = e.altKey;
      };

      self.onKeyDown = (e: KeyboardEvent) => {
        this.ctrlKeyDown = e[CTRL_OR_CMD];
        this.shiftKeyDown = e.shiftKey;
        this.altKeyDown = e.altKey;
      };

      window.addEventListener("keydown", self.onKeyDown, false);
      window.addEventListener("keyup", self.onKeyUp, false);

      //watch filename change to rename .svg, .png; to sync to .md; to update links
      const renameEventHandler = async (
        file: TAbstractFile,
        oldPath: string,
      ) => {
        if (!(file instanceof TFile)) {
          return;
        }
        if (!self.isExcalidrawFile(file)) {
          return;
        }
        if (!self.settings.keepInSync) {
          return;
        }
        [".svg", ".png", ".excalidraw"].forEach(async (ext: string) => {
          const oldIMGpath = getIMGPathFromExcalidrawFile(oldPath, ext);
          const imgFile = self.app.vault.getAbstractFileByPath(
            normalizePath(oldIMGpath),
          );
          if (imgFile && imgFile instanceof TFile) {
            const newIMGpath = getIMGPathFromExcalidrawFile(file.path, ext);
            await self.app.fileManager.renameFile(imgFile, newIMGpath);
          }
        });
      };
      self.registerEvent(self.app.vault.on("rename", renameEventHandler));

      const modifyEventHandler = async (file: TFile) => {
        const leaves = self.app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);
        leaves.forEach((leaf: WorkspaceLeaf) => {
          const excalidrawView = leaf.view as ExcalidrawView;
          if (
            excalidrawView.file &&
            (excalidrawView.file.path === file.path ||
              (file.extension === "excalidraw" &&
                `${file.path.substring(
                  0,
                  file.path.lastIndexOf(".excalidraw"),
                )}.md` === excalidrawView.file.path))
          ) {
            //debug({where:"ExcalidrawPlugin.modifyEventHandler",file:file.name,reloadfile:excalidrawView.file,before:"reload(true)"});
            excalidrawView.reload(true, excalidrawView.file);
          }
        });
      };
      self.registerEvent(self.app.vault.on("modify", modifyEventHandler));

      //watch file delete and delete corresponding .svg and .png
      const deleteEventHandler = async (file: TFile) => {
        if (!(file instanceof TFile)) {
          return;
        }
        const isExcalidarwFile =
          //@ts-ignore
          (file.unsafeCachedData &&
            //@ts-ignore
            file.unsafeCachedData.search(
              /---[\r\n]+[\s\S]*excalidraw-plugin:\s*\w+[\r\n]+[\s\S]*---/gm,
            ) > -1) ||
          file.extension == "excalidraw";
        if (!isExcalidarwFile) {
          return;
        }

        //close excalidraw view where this file is open
        const leaves = self.app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);
        for (let i = 0; i < leaves.length; i++) {
          if ((leaves[i].view as ExcalidrawView).file.path == file.path) {
            await leaves[i].setViewState({
              type: VIEW_TYPE_EXCALIDRAW,
              state: { file: null },
            });
          }
        }

        //delete PNG and SVG files as well
        if (self.settings.keepInSync) {
          setTimeout(()=>{
            [".svg", ".png", ".excalidraw"].forEach(async (ext: string) => {
              const imgPath = getIMGPathFromExcalidrawFile(file.path, ext);
              const imgFile = self.app.vault.getAbstractFileByPath(
                normalizePath(imgPath),
              );
              if (imgFile && imgFile instanceof TFile) {
                await self.app.vault.delete(imgFile);
              }
            });
          },500);
        }
        
      };
      self.registerEvent(self.app.vault.on("delete", deleteEventHandler));

      //save open drawings when user quits the application
      const quitEventHandler = async () => {
        const leaves = self.app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);
        for (let i = 0; i < leaves.length; i++) {
          await (leaves[i].view as ExcalidrawView).save(true);
        }
      };
      self.registerEvent(self.app.workspace.on("quit", quitEventHandler));

      //save Excalidraw leaf and update embeds when switching to another leaf
      const activeLeafChangeEventHandler = async (leaf: WorkspaceLeaf) => {
        const previouslyActiveEV = self.activeExcalidrawView;
        const newActiveviewEV: ExcalidrawView =
          leaf.view instanceof ExcalidrawView ? leaf.view : null;
        self.activeExcalidrawView = newActiveviewEV;

        if (newActiveviewEV) {
          self.lastActiveExcalidrawFilePath = newActiveviewEV.file?.path;
        }

        if (previouslyActiveEV && previouslyActiveEV != newActiveviewEV) {
          if (previouslyActiveEV.leaf != leaf) {
            //if loading new view to same leaf then don't save. Excalidarw view will take care of saving anyway.
            //avoid double saving
            await previouslyActiveEV.save(true); //this will update transclusions in the drawing
          }
          if (previouslyActiveEV.file) {
            self.triggerEmbedUpdates(previouslyActiveEV.file.path);
          }
        }

        if (
          newActiveviewEV &&
          (!previouslyActiveEV || previouslyActiveEV.leaf != leaf)
        ) {
          //the user switched to a new leaf
          //timeout gives time to the view being exited to finish saving
          const f = newActiveviewEV.file;
          if (newActiveviewEV.file) {
            setTimeout(() => {
              //@ts-ignore
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

        //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/300
        if (self.popScope) {
          self.popScope();
          self.popScope = null;
        }
        if (newActiveviewEV) {
          //@ts-ignore
          const scope = new Scope(self.app.scope);
          scope.register(["Mod"], "Enter", () => true);
          //@ts-ignore
          self.app.keymap.pushScope(scope);
          self.popScope = () => {
            //@ts-ignore
            self.app.keymap.popScope(scope);
          };
        }
      };
      self.registerEvent(
        self.app.workspace.on(
          "active-leaf-change",
          activeLeafChangeEventHandler,
        ),
      );
    });
  }

  onunload() {
    window.removeEventListener("keydown", this.onKeyDown, false);
    window.removeEventListener("keyup", this.onKeyUp, false);

    destroyExcalidrawAutomate();
    if (this.popScope) {
      this.popScope();
      this.popScope = null;
    }
    this.observer.disconnect();
    this.themeObserver.disconnect();
    if (this.fileExplorerObserver) {
      this.fileExplorerObserver.disconnect();
    }
    const excalidrawLeaves =
      this.app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);
    excalidrawLeaves.forEach((leaf) => {
      this.setMarkdownView(leaf);
    });
    if (this.mathjaxDiv) {
      document.body.removeChild(this.mathjaxDiv);
    }
    //this.settings.drawingOpenCount += this.opencount;
    //this.settings.loadCount++;
    //this.saveSettings();
  }

  public async embedDrawing(file: TFile) {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView && activeView.file) {
      const data = this.app.metadataCache.fileToLinktext(
        file,
        activeView.file.path,
        this.settings.embedType === "excalidraw"
      )
      const editor = activeView.editor;
      if (this.settings.embedType === "excalidraw") {
        editor.replaceSelection(`![[${data}]]`);
        editor.focus();
        return;
      }

      const filename = getIMGPathFromExcalidrawFile(
        data,"."+this.settings.embedType.toLowerCase()
      );
      const filepath = getIMGPathFromExcalidrawFile(
        file.path,"."+this.settings.embedType.toLowerCase()
      );
     
      await this.app.vault.create(filepath, "");
      //await sleep(200);

      editor.replaceSelection(
        `![[${filename}]]\n%%[[${data}|🖋 Edit in Excalidraw]]%%`,
      );
      editor.focus();
    }
  }

  public async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  public getStencilLibrary(): {} {
    if (
      this.settings.library === "" ||
      this.settings.library === "deprecated"
    ) {
      return this.settings.library2;
    }
    return JSON_parse(this.settings.library);
  }

  public setStencilLibrary(library: {}) {
    this.settings.library = "deprecated";
    this.settings.library2 = library;
  }

  public triggerEmbedUpdates(filepath?: string) {
    const e = document.createEvent("Event");
    e.initEvent(RERENDER_EVENT, true, false);
    document
      .querySelectorAll(
        `div[class^='excalidraw-svg']${
          filepath ? `[src='${filepath.replaceAll("'", "\\'")}']` : ""
        }`,
      )
      .forEach((el) => el.dispatchEvent(e));
  }

  public openDrawing(drawingFile: TFile, onNewPane: boolean) {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);
    let leaf: WorkspaceLeaf = null;

    if (leaves?.length > 0) {
      leaf = leaves[0];
    }
    if (!leaf) {
      leaf = this.app.workspace.activeLeaf;
    }

    if (!leaf) {
      leaf = this.app.workspace.getLeaf();
    }

    if (onNewPane) {
      leaf = this.app.workspace.createLeafBySplit(leaf);
    }

    leaf.setViewState({
      type: VIEW_TYPE_EXCALIDRAW,
      state: { file: drawingFile.path },
    });
  }

  private getNextDefaultFilename(): string {
    return (
      this.settings.drawingFilenamePrefix +
      window.moment().format(this.settings.drawingFilenameDateTime) +
      (this.settings.compatibilityMode ? ".excalidraw" : ".excalidraw.md")
    );
  }

  public async getBlankDrawing(): Promise<string> {
    const template = this.app.metadataCache.getFirstLinkpathDest(
      normalizePath(this.settings.templateFilePath),
      "",
    );
    if (template && template instanceof TFile) {
      if (
        (template.extension == "md" && !this.settings.compatibilityMode) ||
        (template.extension == "excalidraw" && this.settings.compatibilityMode)
      ) {
        const data = await this.app.vault.read(template);
        if (data) {
          return data;
        }
      }
    }
    if (this.settings.compatibilityMode) {
      return this.settings.matchTheme && isObsidianThemeDark()
        ? DARK_BLANK_DRAWING
        : BLANK_DRAWING;
    }
    const blank =
      this.settings.matchTheme && isObsidianThemeDark()
        ? DARK_BLANK_DRAWING
        : BLANK_DRAWING;
    return `${FRONTMATTER}\n${getMarkdownDrawingSection(blank)}`;
  }

  /**
   * Extracts the text elements from an Excalidraw scene into a string of ids as headers followed by the text contents
   * @param {string} data - Excalidraw scene JSON string
   * @returns {string} - Text starting with the "# Text Elements" header and followed by each "## id-value" and text
   */
  public async exportSceneToMD(data: string): Promise<string> {
    if (!data) {
      return "";
    }
    const excalidrawData = JSON_parse(data);
    const textElements = excalidrawData.elements?.filter(
      (el: any) => el.type == "text",
    );
    let outString = "# Text Elements\n";
    let id: string;
    for (const te of textElements) {
      id = te.id;
      //replacing Excalidraw text IDs with my own, because default IDs may contain
      //characters not recognized by Obsidian block references
      //also Excalidraw IDs are inconveniently long
      if (te.id.length > 8) {
        id = nanoid();
        data = data.replaceAll(te.id, id); //brute force approach to replace all occurances.
      }
      outString += `${te.text} ^${id}\n\n`;
    }
    return (
      outString +
      getMarkdownDrawingSection(JSON.stringify(JSON_parse(data), null, "\t"))
    );
  }

  public async createDrawing(
    filename: string,
    foldername?: string,
    initData?: string,
  ): Promise<TFile> {
    const folderpath = normalizePath(
      foldername ? foldername : this.settings.folder,
    );
    await checkAndCreateFolder(this.app.vault, folderpath); //create folder if it does not exist
    const fname = getNewUniqueFilepath(this.app.vault, filename, folderpath);
    return await this.app.vault.create(
      fname,
      initData ?? (await this.getBlankDrawing()),
    );
  }

  public async createAndOpenDrawing(
    filename: string,
    onNewPane: boolean,
    foldername?: string,
    initData?: string,
  ): Promise<string> {
    const file = await this.createDrawing(filename, foldername, initData);
    this.openDrawing(file, onNewPane);
    return file.path;
  }

  public async setMarkdownView(leaf: WorkspaceLeaf) {
    const state = leaf.view.getState();

    await leaf.setViewState({
      type: VIEW_TYPE_EXCALIDRAW,
      state: { file: null },
    });

    await leaf.setViewState(
      {
        type: "markdown",
        state,
        popstate: true,
      } as ViewState,
      { focus: true },
    );
  }

  private async setExcalidrawView(leaf: WorkspaceLeaf) {
    await leaf.setViewState({
      type: VIEW_TYPE_EXCALIDRAW,
      state: leaf.view.getState(),
      popstate: true,
    } as ViewState);
  }

  public isExcalidrawFile(f: TFile) {
    if (f.extension == "excalidraw") {
      return true;
    }
    const fileCache = f ? this.app.metadataCache.getFileCache(f) : null;
    return !!fileCache?.frontmatter && !!fileCache.frontmatter[FRONTMATTER_KEY];
  }
}
